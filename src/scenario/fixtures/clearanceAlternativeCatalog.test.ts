import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { clearanceAlternativeCatalog } from "./clearanceAlternativeCatalog";

describe("clearance alternative catalog", () => {
  it("should expose only a deeply frozen offline relation, geometry, summary, and provenance", async () => {
    expect(Object.keys(clearanceAlternativeCatalog).sort()).toStrictEqual(["geometry", "provenance", "relation", "summary"]); expect(clearanceAlternativeCatalog.relation).toStrictEqual({ vehicleId: "vehicle-011", currentRouteId: "route-011", avoidsRiskId: "restriction-height-3.9", alternativeRouteId: "alternative-route-011-clearance-v1" });
    expect(Object.isFrozen(clearanceAlternativeCatalog)).toBe(true); expect(Object.isFrozen(clearanceAlternativeCatalog.geometry.coordinates)).toBe(true); expect(Object.isFrozen(clearanceAlternativeCatalog.geometry.coordinates[0])).toBe(true);
    expect(() => { (clearanceAlternativeCatalog.geometry.coordinates[0] as [number, number])[0] = 0; }).toThrow();
    const source = await readFile("src/scenario/fixtures/clearanceAlternativeCatalog.ts", "utf8"); expect(source).not.toMatch(new RegExp(`fetch\\s*\\(|${["ORS", "API", "KEY"].join("_")}|scripts/`));
  });

  it.each([
    ["src/scenario/fixtures/ors-route-manifest.json", "65172c3ae47fe52d97c41b9a811c9088fb464c3124a54367c17ecfd674b7ba3f"],
    ["src/scenario/fixtures/ors-routes.geojson", "977629e48cb9266eb167b095085f6768bc7f94ffec44f9650210cca979ad6b0e"],
  ])("should preserve protected bytes for %s", async (path, expected) => { expect(createHash("sha256").update(await readFile(path)).digest("hex")).toBe(expected); });

  it("should keep current consumers free of alternative, provider, staged-plan, application, movement, and tool integration", async () => {
    const roots = ["src/app", "src/features", "src/domain/operations", "src/platform/webmcp"]; const paths = (await Promise.all(roots.map(async (root) => (await readdir(root, { recursive: true })).filter((path) => /\.tsx?$/.test(path)).map((path) => `${root}/${path}`)))).flat(); paths.push("src/scenario/fixtures/spain-v1.ts");
    const sources = await Promise.all(paths.map(async (path) => `${path}\n${await readFile(path, "utf8")}`)); expect(sources.join("\n")).not.toMatch(new RegExp(`clearanceAlternative|clearance-alternative-route|alternativeRoute|stagedPlan|rerout|${["ORS", "API", "KEY"].join("_")}`));
  });
});
