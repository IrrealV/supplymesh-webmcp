import { describe, expect, it } from "vitest";
import { lineString, point, pointToLineDistance, pointToPolygonDistance, polygon } from "@turf/turf";
import { clearanceAlternativeCatalog } from "../../scenario/fixtures/clearanceAlternativeCatalog";
import { readAdmittedRecoveryRoute, recoveryRouteDigest } from "./recoveryRouteAdmission";

function expectDeepFrozen(value: unknown, seen = new WeakSet<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeepFrozen(child, seen);
}

describe("recovery route admission", () => {
  it("should independently admit the complete checked-in route evidence", () => {
    const result = readAdmittedRecoveryRoute(() => clearanceAlternativeCatalog);
    const catalog = clearanceAlternativeCatalog as unknown as MutableCatalog;
    const route = lineString(catalog.geometry.coordinates);
    const area = polygon(catalog.provenance.avoidance.polygon.coordinates);
    const computed = Math.min(
      ...catalog.geometry.coordinates.map((coordinate) => pointToPolygonDistance(point(coordinate), area, { units: "meters" })),
      ...catalog.provenance.avoidance.polygon.coordinates[0].map((coordinate) => pointToLineDistance(point(coordinate), route, { units: "meters" })),
    );

    expect(computed).toBeCloseTo(catalog.provenance.avoidance.minimumClearanceMeters, 9);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected admitted evidence.");
    const repeated = readAdmittedRecoveryRoute(() => clearanceAlternativeCatalog);
    if (!repeated.ok) throw new Error("Expected repeated admitted evidence.");
    expectDeepFrozen(result.data);
    expect(Object.isFrozen(result.data.geometry.coordinates[0])).toBe(true);
    expect(Object.isFrozen(result.data.provenance.avoidance.polygon.coordinates[0])).toBe(true);
    expect(Reflect.set(result.data.geometry.coordinates[0], "0", 99)).toBe(false);
    expect(repeated.data).toStrictEqual(result.data);
    expect(repeated.data).not.toBe(result.data);
  });

  it.each([
    ["geometry", (catalog: MutableCatalog) => { catalog.geometry.coordinates[10][0] += 0.01; }],
    ["summary", (catalog: MutableCatalog) => { catalog.summary.distanceMeters += 1; }],
    ["provenance", (catalog: MutableCatalog) => { catalog.provenance.sourceRevision = "0".repeat(64); }],
    ["asserted minimum", (catalog: MutableCatalog) => { catalog.provenance.avoidance.minimumClearanceMeters += 1; }],
  ])("should reject in-place %s tampering", (_label, mutate) => {
    const catalog = structuredClone(clearanceAlternativeCatalog);
    mutate(catalog as unknown as MutableCatalog);

    expect(readAdmittedRecoveryRoute(() => catalog).ok).toBe(false);
  });

  it("should produce one deterministic digest for the complete evidence payload", async () => {
    const evidence = readAdmittedRecoveryRoute(() => clearanceAlternativeCatalog);
    if (!evidence.ok) throw new Error("Expected admitted evidence.");

    const digest = await recoveryRouteDigest(evidence.data);

    expect(digest).toStrictEqual({ ok: true, data: "sha256:33ce42625f7ff7bb1497ff6cb8ee9fb6bd2883c591bb936b780d31ae290dca18" });
  });

  it("should reject sparse coordinates and accessor-backed catalog fields", () => {
    const sparse = structuredClone(clearanceAlternativeCatalog) as unknown as MutableCatalog;
    delete sparse.geometry.coordinates[10];
    const accessor = structuredClone(clearanceAlternativeCatalog) as unknown as Record<string, unknown>;
    const summary = accessor.summary;
    Object.defineProperty(accessor, "summary", { configurable: true, enumerable: true, get: () => summary });

    expect(readAdmittedRecoveryRoute(() => sparse).ok).toBe(false);
    expect(readAdmittedRecoveryRoute(() => accessor).ok).toBe(false);
  });
});

type MutableCatalog = {
  geometry: { coordinates: number[][] };
  summary: { distanceMeters: number };
  provenance: { sourceRevision: string; avoidance: { minimumClearanceMeters: number; polygon: { coordinates: number[][][] } } };
};
