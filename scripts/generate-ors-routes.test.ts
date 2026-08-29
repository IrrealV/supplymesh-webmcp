import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { calculateSourceRevision, generateRouteFixture, verifyRouteFixture, type AcceptedRoute, type RouteGenerationManifest } from "./routes/generator";

const key = "unit-test-secret-value";
const route = (routeId: string, from: [number, number], to: [number, number], radiuses?: number[]) => ({ routeId, origin: { id: `${routeId}-origin`, coordinates: from }, destination: { id: `${routeId}-destination`, coordinates: to }, request: { preference: "recommended", options: {}, ...(radiuses === undefined ? {} : { radiuses }) } });
const manifest: RouteGenerationManifest = { version: 1, routes: [route("route-014", [-4.1088, 38.8786], [-3.7038, 40.4168], [547, 350]), route("route-001", [-3.7038, 40.4168], [-2.9349, 43.263])] };
const directories: string[] = [];

async function outputPath(): Promise<string> { const directory = await mkdtemp(join(tmpdir(), "supplymesh-routes-")); directories.push(directory); return join(directory, "routes.geojson"); }
function responseFor(init: RequestInit, endpointOffset = 0): Response {
  const { coordinates } = JSON.parse(String(init.body)) as { coordinates: [[number, number], [number, number]] }; const [start, end] = coordinates;
  const returnedStart: [number, number] = [start[0] + endpointOffset, start[1]];
  return Response.json({ features: [{ type: "Feature", properties: { summary: { distance: 1000, duration: 100 } }, geometry: { type: "LineString", coordinates: [returnedStart, [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2], end] } }] });
}
afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

describe("ORS route generator", () => {
  it.each(["", "   "])("should reject a missing or whitespace key before requests", async (apiKey) => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(generateRouteFixture({ apiKey, fetcher, manifest, outputPath: await outputPath() })).rejects.toThrow("ORS_API_KEY is required");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([{ radiuses: [547] }, { radiuses: [547, 0] }, { radiuses: [547, Number.NaN] }, { radiuses: [547, Number.POSITIVE_INFINITY] }])("should reject invalid per-coordinate radiuses before requests", async ({ radiuses }) => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(generateRouteFixture({ apiKey: key, fetcher, manifest: { version: 1, routes: [route("route-014", [-4.1088, 38.8786], [-3.7038, 40.4168], radiuses)] }, outputPath: await outputPath() })).rejects.toThrow("radiuses");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("should pass route-014 radiuses unchanged while omitting defaults and preserving logical coordinates", async () => {
    const requests: Array<{ routeId: string; body: Record<string, unknown>; headers: Record<string, string> }> = [];
    const fetcher = vi.fn<typeof fetch>(async (_input, init: RequestInit = {}) => { const body = JSON.parse(String(init.body)) as Record<string, unknown>; requests.push({ routeId: JSON.stringify(body.coordinates).includes("-4.1088") ? "route-014" : "route-001", body, headers: Object.fromEntries(new Headers(init.headers)) }); return responseFor(init, JSON.stringify(body.coordinates).includes("-4.1088") ? 0.0045 : 0); });
    await generateRouteFixture({ apiKey: key, fetcher, manifest, outputPath: await outputPath() });
    expect(requests.map(({ routeId }) => routeId)).toStrictEqual(["route-001", "route-014"]);
    expect(requests[0].body).not.toHaveProperty("radiuses");
    expect(requests[1].body).toStrictEqual({ coordinates: [[-4.1088, 38.8786], [-3.7038, 40.4168]], preference: "recommended", options: {}, radiuses: [547, 350], instructions: false });
    expect(requests[1].headers).toStrictEqual({ authorization: key, "content-type": "application/json" });
    expect(JSON.stringify(requests)).not.toContain("alternative");
  });

  it("should preserve returned geometry separately and reject endpoints outside configured radiuses", async () => {
    const path = await outputPath();
    const fetcher = vi.fn<typeof fetch>(async (_input, init = {}) => responseFor(init, 0.0045));
    await generateRouteFixture({ apiKey: key, fetcher, manifest: { version: 1, routes: [manifest.routes[0]] }, outputPath: path });
    const fixture = JSON.parse(await readFile(path, "utf8")) as { features: Array<{ geometry: { coordinates: number[][] }; properties: { logicalEndpoints: number[][]; returnedEndpoints: number[][]; snapDistancesMeters: number[] } }> };
    expect(fixture.features[0].properties.logicalEndpoints[0]).toStrictEqual([-4.1088, 38.8786]);
    expect(fixture.features[0].properties.returnedEndpoints).toStrictEqual([fixture.features[0].geometry.coordinates[0], fixture.features[0].geometry.coordinates.at(-1)]);
    expect(fixture.features[0].properties.snapDistancesMeters[0]).toBeGreaterThan(350);
    await expect(generateRouteFixture({ apiKey: key, fetcher, manifest: { version: 1, routes: [route("route-001", [-4.1088, 38.8786], [-3.7038, 40.4168])] }, outputPath: await outputPath() })).rejects.toThrow("radius");
  });

  it("should retry only quota and server failures with bounded Retry-After/backoff", async () => {
    const sleeps: number[] = []; const responses = [new Response(null, { status: 429, headers: { "Retry-After": "1" } }), new Response(null, { status: 503 }), undefined];
    const fetcher = vi.fn<typeof fetch>(async (_input, init = {}) => responses.shift() ?? responseFor(init));
    await generateRouteFixture({ apiKey: key, fetcher, manifest: { version: 1, routes: [manifest.routes[0]] }, outputPath: await outputPath(), sleep: async (milliseconds) => { sleeps.push(milliseconds); } });
    expect(fetcher).toHaveBeenCalledTimes(3); expect(sleeps).toStrictEqual([1000, 500]);
  });

  it.each([[400, 1], [429, 4]])("should reject HTTP %i without leaking the key", async (status, calls) => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(null, { status })); let message = "";
    try { await generateRouteFixture({ apiKey: key, fetcher, manifest: { version: 1, routes: [manifest.routes[0]] }, outputPath: await outputPath(), sleep: async () => undefined }); } catch (error) { message = error instanceof Error ? error.message : String(error); }
    expect(message).not.toContain(key); expect(fetcher).toHaveBeenCalledTimes(calls);
  });

  it.each([["malformed", { features: [] }], ["surplus", { features: [{}, {}] }]])("should reject %s responses atomically", async (_name, payload) => {
    const path = await outputPath(); await writeFile(path, "accepted-bytes"); const fetcher = vi.fn<typeof fetch>(async () => Response.json(payload));
    await expect(generateRouteFixture({ apiKey: key, fetcher, manifest: { version: 1, routes: [manifest.routes[0]] }, outputPath: path })).rejects.toThrow();
    expect(await readFile(path, "utf8")).toBe("accepted-bytes");
  });

  it("should canonicalize -0, ordering, volatile exclusions, and materialized radiuses", () => {
    const routes: AcceptedRoute[] = [{ routeId: "route-001", originId: "a", destinationId: "b", logicalEndpoints: [[-0, 40], [2, 42]], returnedEndpoints: [[0, 40], [2, 42]], snapDistancesMeters: [0, 0], coordinates: [[0, 40], [1, 41], [2, 42]], summary: { distanceMeters: 10, durationSeconds: 2 }, riskSnaps: [] }];
    const omitted = { version: 1, routes: [route("route-001", [-0, 40], [2, 42])] }; const baseline = calculateSourceRevision(omitted, routes);
    const volatileRoutes: Array<AcceptedRoute & { providerTimestamp: string }> = [{ ...routes[0], providerTimestamp: "ignored" }];
    expect(baseline).toBe(calculateSourceRevision({ routes: [route("route-001", [0, 40], [2, 42])], version: 1 }, volatileRoutes));
    expect(calculateSourceRevision({ version: 1, routes: [route("route-001", [0, 40], [2, 42], [350, 350])] }, routes)).not.toBe(baseline);
    expect(calculateSourceRevision(omitted, [{ ...routes[0], coordinates: [[0, 40], [1.1, 41], [2, 42]] }])).not.toBe(baseline);
  });

  it("should preserve bytes and timestamp for an unchanged hash", async () => {
    const path = await outputPath(); const fetcher = vi.fn<typeof fetch>(async (_input, init = {}) => responseFor(init));
    await generateRouteFixture({ apiKey: key, fetcher, manifest, now: () => new Date("2026-08-29T00:00:00.000Z"), outputPath: path });
    const before = { bytes: await readFile(path, "utf8"), modified: (await stat(path)).mtimeMs }; await new Promise((resolve) => setTimeout(resolve, 20));
    const result = await generateRouteFixture({ apiKey: key, fetcher, manifest, now: () => new Date("2027-01-01T00:00:00.000Z"), outputPath: path });
    expect({ bytes: await readFile(path, "utf8"), modified: (await stat(path)).mtimeMs }).toStrictEqual(before); expect(result.changed).toBe(false);
    await expect(verifyRouteFixture(manifest, JSON.parse(before.bytes))).resolves.toMatchObject({ routeCount: 2 });
  });
});
