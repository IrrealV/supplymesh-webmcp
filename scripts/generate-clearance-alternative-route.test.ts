import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildAvoidPolygon, generateClearanceAlternative, verifyClearanceAlternative } from "./generate-clearance-alternative-route";

const apiKey = "test-only-secret";
const endpoints = [[-4.0273, 39.8628], [-3.7496, 40.4637]] as const;
const safeRoute = [[-4.0273, 39.8628], [-4.05, 40.12], [-4.05, 40.25], [-3.8, 40.3], [-3.7496, 40.4637]];
const directories: string[] = [];
let currentFixture: unknown;
beforeAll(async () => { currentFixture = JSON.parse(await readFile("src/scenario/fixtures/ors-routes.geojson", "utf8")) as unknown; });
afterAll(async () => { await Promise.all(directories.map((directory) => rm(directory, { recursive: true, force: true }))); });
async function outputPath(): Promise<string> { const directory = await mkdtemp(join(tmpdir(), "clearance-route-")); directories.push(directory); return join(directory, "alternative.geojson"); }
function response(coordinates: number[][] = safeRoute, distance = 110_000, duration = 6_000): Response { return Response.json({ features: [{ type: "Feature", properties: { summary: { distance, duration } }, geometry: { type: "LineString", coordinates } }] }); }
function clone<T>(value: T): T { return structuredClone(value); }

describe("clearance alternative generator", () => {
  it("should keep fixed identities and retry one candidate with the exact closed polygon", async () => {
    const bodies: string[] = []; const sleeps: number[] = []; const responses = [new Response(null, { status: 429 }), response()];
    const fetcher = vi.fn<typeof fetch>(async (_input, init = {}) => { bodies.push(String(init.body)); return responses.shift()!; });
    const path = await outputPath(); const result = await generateClearanceAlternative({ apiKey, currentFixture, fetcher, outputPath: path, sleep: async (milliseconds) => { sleeps.push(milliseconds); } });
    const body = JSON.parse(bodies[0]) as Record<string, unknown>; const polygon = buildAvoidPolygon(); const fixture = JSON.parse(await readFile(path, "utf8")) as { features: Array<{ properties: { relation: Record<string, string> } }> };
    expect(bodies).toStrictEqual([bodies[0], bodies[0]]); expect(sleeps).toStrictEqual([250]);
    expect(body).toStrictEqual({ coordinates: endpoints, preference: "recommended", options: { avoid_polygons: polygon }, instructions: false });
    expect(JSON.stringify(body)).not.toMatch(/radiuses|alternative_routes/); expect(polygon.coordinates[0]).toHaveLength(65); expect(polygon.coordinates[0][0]).toStrictEqual(polygon.coordinates[0].at(-1));
    expect(fixture.features).toHaveLength(1); expect(fixture.features[0].properties.relation).toStrictEqual({ vehicleId: "vehicle-011", currentRouteId: "route-011", avoidsRiskId: "restriction-height-3.9", alternativeRouteId: "alternative-route-011-clearance-v1" });
    expect(result).toMatchObject({ changed: true, coordinateCount: 5, distanceMeters: 110_000, durationSeconds: 6_000 }); expect(await readFile(path, "utf8")).not.toContain(apiKey);
  });

  it("should reject source drift before HTTP", async () => {
    const drifted = clone(currentFixture) as { features: Array<{ properties: { routeId: string }; geometry: { coordinates: number[][] } }> }; drifted.features.find(({ properties }) => properties.routeId === "route-011")!.geometry.coordinates[537] = [-3.8, 40.1];
    const fetcher = vi.fn<typeof fetch>();
    await expect(generateClearanceAlternative({ apiKey, currentFixture: drifted, fetcher, outputPath: await outputPath() })).rejects.toThrow("source"); expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    ["missing key", undefined, vi.fn<typeof fetch>(), "ORS_API_KEY", 0],
    ["provider rejection", apiKey, vi.fn<typeof fetch>(async () => new Response(null, { status: 400 })), "HTTP 400", 1],
    ["retry exhaustion", apiKey, vi.fn<typeof fetch>(async () => new Response(null, { status: 503 })), "HTTP 503", 4],
    ["malformed JSON", apiKey, vi.fn<typeof fetch>(async () => new Response("{", { status: 200 })), "malformed JSON", 1],
  ])("should fail closed for %s without leaking credentials", async (_name, key, fetcher, message, calls) => {
    const path = await outputPath(); await writeFile(path, "accepted-bytes"); let failure = "";
    try { await generateClearanceAlternative({ apiKey: key, currentFixture, fetcher, outputPath: path, sleep: async () => undefined }); } catch (error) { failure = error instanceof Error ? error.message : String(error); }
    expect(failure).toContain(message); expect(failure).not.toContain(apiKey); expect(fetcher).toHaveBeenCalledTimes(calls); expect(await readFile(path, "utf8")).toBe("accepted-bytes");
  });

  it.each([
    ["fewer than three coordinates", endpoints],
    ["polygon contact", [endpoints[0], [-3.897481, 40.149232], endpoints[1]]],
    ["endpoint drift", [[-4.02, 39.8628], ...safeRoute.slice(1)]],
    ["non-positive distance", safeRoute, 0, 6_000],
    ["excess duration", safeRoute, 110_000, 10_584.3],
  ])("should reject %s while preserving accepted bytes", async (_name, coordinates, distance = 110_000, duration = 6_000) => {
    const path = await outputPath(); await writeFile(path, "accepted-bytes"); const fetcher = vi.fn<typeof fetch>(async () => response(coordinates as number[][], distance, duration));
    await expect(generateClearanceAlternative({ apiKey, currentFixture, fetcher, outputPath: path })).rejects.toThrow(); expect(await readFile(path, "utf8")).toBe("accepted-bytes");
  });

  it("should reject canonical tampering and preserve bytes and mtime for a verified no-op", async () => {
    const path = await outputPath(); const fetcher = vi.fn<typeof fetch>(async () => response());
    await generateClearanceAlternative({ apiKey, currentFixture, fetcher, now: () => new Date("2026-08-29T00:00:00.000Z"), outputPath: path });
    const before = { bytes: await readFile(path, "utf8"), mtimeMs: (await stat(path)).mtimeMs }; const tampered = JSON.parse(before.bytes) as { features: Array<{ properties: { summary: { distanceMeters: number } } }> }; tampered.features[0].properties.summary.distanceMeters += 1;
    await expect(verifyClearanceAlternative(tampered, { currentFixture })).rejects.toThrow("revision"); await new Promise((resolve) => setTimeout(resolve, 20));
    const result = await generateClearanceAlternative({ apiKey, currentFixture, fetcher, now: () => new Date("2027-01-01T00:00:00.000Z"), outputPath: path });
    expect(result.changed).toBe(false); expect({ bytes: await readFile(path, "utf8"), mtimeMs: (await stat(path)).mtimeMs }).toStrictEqual(before);
  });
});
