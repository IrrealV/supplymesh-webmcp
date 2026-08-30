import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { clearanceAlternativeCatalog } from "./clearanceAlternativeCatalog";

describe("clearance alternative catalog", () => {
  it("should expose only a deeply frozen offline relation, geometry, summary, and provenance", async () => {
    expect(Object.keys(clearanceAlternativeCatalog).sort()).toStrictEqual([
      "geometry",
      "provenance",
      "relation",
      "summary",
    ]);
    expect(clearanceAlternativeCatalog.relation).toStrictEqual({
      alternativeRouteId: "alternative-route-011-clearance-v1",
      avoidsRiskId: "restriction-height-3.9",
      currentRouteId: "route-011",
      vehicleId: "vehicle-011",
    });
    expect(Object.isFrozen(clearanceAlternativeCatalog)).toBe(true);
    expect(Object.isFrozen(clearanceAlternativeCatalog.geometry.coordinates)).toBe(true);
    expect(Object.isFrozen(clearanceAlternativeCatalog.geometry.coordinates[0])).toBe(true);
    expect(() => {
      (clearanceAlternativeCatalog.geometry.coordinates[0] as [number, number])[0] = 0;
    }).toThrow();

    const source = await readFile(
      "src/scenario/fixtures/clearanceAlternativeCatalog.ts",
      "utf8",
    );
    expect(source).not.toMatch(
      new RegExp(`fetch\\s*\\(|${["ORS", "API", "KEY"].join("_")}|scripts/`),
    );
  });

  it.each([
    [
      "src/scenario/fixtures/ors-route-manifest.json",
      "65172c3ae47fe52d97c41b9a811c9088fb464c3124a54367c17ecfd674b7ba3f",
    ],
    [
      "src/scenario/fixtures/ors-routes.geojson",
      "977629e48cb9266eb167b095085f6768bc7f94ffec44f9650210cca979ad6b0e",
    ],
    [
      "src/scenario/fixtures/clearance-alternative-route-v1.manifest.json",
      "3e752093003f3e89a59dbfdc956305a2aebcf80b3f70cdade663437d190419b7",
    ],
    [
      "src/scenario/fixtures/clearance-alternative-route-v1.geojson",
      "93e115fe3b95a4dc6acb1d478031cf2d7dc7451a2d4c438819cd748774d320ea",
    ],
  ])("should preserve protected bytes for %s", async (path, expected) => {
    expect(createHash("sha256").update(await readFile(path)).digest("hex")).toBe(expected);
  });

  it("should expose one typed offline adapter without raw fixture imports in React or WebMCP", async () => {
    const roots = [
      "src/app",
      "src/features",
      "src/domain/operations",
      "src/platform/webmcp",
    ];
    const paths = (
      await Promise.all(
        roots.map(async (root) =>
          (await readdir(root, { recursive: true }))
            .filter((path) => /\.tsx?$/.test(path))
            .map((path) => `${root}/${path}`),
        ),
      )
    ).flat();
    const browserSources = (
      await Promise.all(paths.map((path) => readFile(path, "utf8")))
    ).join("\n");

    expect(browserSources).not.toMatch(
      /clearance-alternative-route-v1|clearanceAlternativeCatalog|[.]geojson\?raw/,
    );
    expect(browserSources).not.toMatch(
      new RegExp(`openrouteservice|fetch\\s*\\(|${["ORS", "API", "KEY"].join("_")}`, "i"),
    );

    const adapterSource = await readFile(
      "src/scenario/recovery/clearanceAlternativeAdapter.ts",
      "utf8",
    );
    expect(adapterSource).toMatch(
      /from\s+["']\.\.\/fixtures\/clearanceAlternativeCatalog["']/,
    );
    expect(adapterSource).not.toMatch(
      new RegExp(`[.]geojson\\?raw|fetch\\s*\\(|${["ORS", "API", "KEY"].join("_")}|scripts/`),
    );

    const sourcePaths = (await readdir("src", { recursive: true }))
      .filter((path) => /\.tsx?$/.test(path) && !/\.test\./.test(path))
      .map((path) => `src/${path}`);
    const catalogConsumers = [];
    for (const path of sourcePaths) {
      const source = await readFile(path, "utf8");
      if (/from\s+["'][^"']*clearanceAlternativeCatalog["']/.test(source)) {
        catalogConsumers.push(path);
      }
    }
    expect(catalogConsumers).toStrictEqual([
      "src/scenario/recovery/clearanceAlternativeAdapter.ts",
    ]);
  });
});
