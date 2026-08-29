import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import manifestJson from "../src/scenario/fixtures/ors-route-manifest.json" with { type: "json" };
import { generateRouteFixture, verifyRouteFixture, type RouteGenerationManifest } from "./routes/generator";

const manifest = manifestJson as RouteGenerationManifest;
const outputPath = fileURLToPath(new URL("../src/scenario/fixtures/ors-routes.geojson", import.meta.url));
async function assertRuntimeBoundary(): Promise<void> {
  for (const path of await readdir("src", { recursive: true })) {
    if (!path.endsWith(".ts") && !path.endsWith(".tsx")) continue;
    const source = await readFile(`src/${path}`, "utf8");
    if (/ORS_API_KEY|from\s+["'][^"']*scripts|\bfetch\s*\(/.test(source)) throw new Error(`Runtime routing boundary failed in ${path}.`);
  }
}
async function main(): Promise<void> {
  if (process.argv[2] === "generate") { const result = await generateRouteFixture({ apiKey: process.env.ORS_API_KEY, manifest, outputPath }); console.log(`${result.changed ? "Generated" : "Verified unchanged"} ${result.routeCount} ORS routes (${result.coordinateCount} coordinates); sourceRevision ${result.sourceRevision}.`); return; }
  if (process.argv[2] === "verify") { const result = await verifyRouteFixture(manifest, JSON.parse(await readFile(outputPath, "utf8")) as unknown); await assertRuntimeBoundary(); console.log(`Verified ${result.routeCount} ORS routes (${result.coordinateCount} coordinates); sourceRevision ${result.sourceRevision}; runtime provider boundary clean.`); return; }
  throw new Error("Expected generate or verify action.");
}
if (import.meta.main) main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Route fixture command failed."); process.exitCode = 1; });
