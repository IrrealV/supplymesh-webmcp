import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { booleanIntersects, circle, distance, lineString, point, pointToLineDistance, pointToPolygonDistance, polygon as turfPolygon } from "@turf/turf";
import manifestJson from "../src/scenario/fixtures/clearance-alternative-route-v1.manifest.json" with { type: "json" };
import { createSpainScenario } from "../src/scenario/fixtures/spain-v1";
import { canonicalJSON, canonicalSha256, requestRoute, writeAtomically, type Coordinate, type ManifestRoute } from "./routes/generator";

type PolygonGeometry = { type: "Polygon"; coordinates: Coordinate[][] };
type AlternativeManifest = { version: 1; relation: { vehicleId: string; currentRouteId: string; avoidsRiskId: string; alternativeRouteId: string }; avoidance: { shape: "geodesic-circle"; radiusMeters: number; steps: number } };
type Avoidance = AlternativeManifest["avoidance"] & { polygon: PolygonGeometry; minimumClearanceMeters: number };
type AlternativeProperties = { relation: AlternativeManifest["relation"]; logicalEndpoints: [Coordinate, Coordinate]; returnedEndpoints: [Coordinate, Coordinate]; snapDistancesMeters: [number, number]; summary: { distanceMeters: number; durationSeconds: number }; coordinateCount: number; avoidance: Avoidance };
type AlternativeFixture = { type: "FeatureCollection"; xSupplyMesh: { generated: true; fixtureSchemaVersion: 1; provider: "openrouteservice"; profile: "driving-hgv"; generatedAt: string; manifestRevision: string; currentRouteSourceRevision: string; sourceRevision: string; alternativeCount: 1 }; features: [{ type: "Feature"; properties: AlternativeProperties; geometry: { type: "LineString"; coordinates: Coordinate[] } }] };
type SourceOptions = { currentFixture?: unknown; manifest?: unknown };
type GenerateOptions = SourceOptions & { apiKey: string | undefined; fetcher?: typeof fetch; now?: () => Date; outputPath?: string; sleep?: (milliseconds: number) => Promise<void> };
type Result = { changed: boolean; sourceRevision: string; coordinateCount: number; distanceMeters: number; durationSeconds: number; minimumClearanceMeters: number };
type Source = { currentFixture: unknown; manifest: AlternativeManifest; polygon: PolygonGeometry };
const CURRENT_REVISION = "16e9952c577cfcc7de3e1cd8bfbc1ea068557c049d5674052b3b1e74fcacc439";
const EXPECTED_MANIFEST: AlternativeManifest = { version: 1, relation: { vehicleId: "vehicle-011", currentRouteId: "route-011", avoidsRiskId: "restriction-height-3.9", alternativeRouteId: "alternative-route-011-clearance-v1" }, avoidance: { shape: "geodesic-circle", radiusMeters: 250, steps: 64 } };
const ENDPOINTS: [Coordinate, Coordinate] = [[-4.0273, 39.8628], [-3.7496, 40.4637]];
const SNAP: Coordinate = [-3.897481, 40.149232];
const OUTPUT_PATH = resolve("src/scenario/fixtures/clearance-alternative-route-v1.geojson");
const CURRENT_PATH = resolve("src/scenario/fixtures/ors-routes.geojson");
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function exact(left: unknown, right: unknown): boolean { return canonicalJSON(left) === canonicalJSON(right); }
function coordinate(value: unknown, context: string): Coordinate { if (!Array.isArray(value) || value.length !== 2 || !value.every((entry) => typeof entry === "number" && Number.isFinite(entry))) throw new Error(`Invalid ${context}.`); return [value[0] as number, value[1] as number]; }
function coordinates(value: unknown): Coordinate[] { if (!Array.isArray(value) || value.length < 3 || value.length > 10_000) throw new Error("Alternative geometry coordinate count is invalid."); return value.map((entry, index) => coordinate(entry, `alternative coordinate ${index}`)); }
export function buildAvoidPolygon(): PolygonGeometry { return circle(SNAP, EXPECTED_MANIFEST.avoidance.radiusMeters, { steps: EXPECTED_MANIFEST.avoidance.steps, units: "meters" }).geometry as PolygonGeometry; }
async function loadSource(options: SourceOptions): Promise<Source> {
  const manifest = (options.manifest ?? manifestJson) as AlternativeManifest;
  if (!exact(manifest, EXPECTED_MANIFEST)) throw new Error("Clearance alternative manifest identity drifted.");
  const scenario = createSpainScenario(); const vehicle = scenario.vehicles.find(({ internalId }) => internalId === "vehicle-011"); const risk = scenario.risks.find(({ id }) => id === "restriction-height-3.9");
  if (vehicle?.fleetNumber !== "FM-211" || vehicle.label !== "Unit 211" || vehicle.routeId !== "route-011" || risk?.severity !== "high" || risk.limitMeters !== 3.9 || !risk.affectedVehicleIds.includes("vehicle-011")) throw new Error("Clearance vehicle or risk identity drifted.");
  const currentFixture = options.currentFixture ?? JSON.parse(await readFile(CURRENT_PATH, "utf8")) as unknown;
  if (!isRecord(currentFixture) || !isRecord(currentFixture.xSupplyMesh) || currentFixture.xSupplyMesh.sourceRevision !== CURRENT_REVISION || !Array.isArray(currentFixture.features)) throw new Error("Protected current route source is invalid.");
  const collection = currentFixture as { features: Array<{ properties: Record<string, unknown>; geometry: { coordinates: Coordinate[] } }> }; const route = collection.features.find(({ properties }) => properties.routeId === "route-011");
  if (route === undefined || route.geometry.coordinates.length !== 1_120 || !exact(route.properties.logicalEndpoints, ENDPOINTS) || !exact(route.properties.summary, { distanceMeters: 99_706.6, durationSeconds: 5_292.1 })) throw new Error("Protected current route identity drifted.");
  const snaps = route.properties.riskSnaps; const snap = Array.isArray(snaps) ? snaps.find((entry) => isRecord(entry) && entry.riskId === "restriction-height-3.9") : undefined;
  if (!isRecord(snap) || snap.kind !== "point" || snap.startIndex !== 537 || snap.endIndex !== 537 || !exact(snap.startCoordinate, SNAP) || !exact(route.geometry.coordinates[537], SNAP)) throw new Error("Protected current route source clearance snap drifted.");
  return { currentFixture, manifest, polygon: buildAvoidPolygon() };
}
function clearanceMeters(routeCoordinates: Coordinate[], polygon: PolygonGeometry): number {
  const line = lineString(routeCoordinates); const area = turfPolygon(polygon.coordinates);
  if (booleanIntersects(line, area)) throw new Error("Alternative geometry intersects or touches the avoidance polygon.");
  const routeMargin = Math.min(...routeCoordinates.map((entry) => pointToPolygonDistance(point(entry), area, { units: "meters" })));
  const boundaryMargin = Math.min(...polygon.coordinates[0].map((entry) => pointToLineDistance(point(entry), line, { units: "meters" })));
  const result = Math.min(routeMargin, boundaryMargin); if (!Number.isFinite(result) || result <= 0) throw new Error("Alternative geometry has no positive two-way clearance."); return result;
}
function canonicalPayload(source: Source, properties: AlternativeProperties, routeCoordinates: Coordinate[]): unknown {
  return { fixtureSchemaVersion: 1, provider: "openrouteservice", profile: "driving-hgv", manifest: source.manifest, currentRouteSourceRevision: CURRENT_REVISION, relation: properties.relation, request: { logicalEndpoints: ENDPOINTS, preference: "recommended", options: { avoid_polygons: source.polygon }, instructions: false }, route: { returnedEndpoints: properties.returnedEndpoints, snapDistancesMeters: properties.snapDistancesMeters, summary: properties.summary, coordinateCount: properties.coordinateCount, avoidance: properties.avoidance, coordinates: routeCoordinates } };
}
function resultFrom(fixture: AlternativeFixture, changed: boolean): Result { const properties = fixture.features[0].properties; return { changed, sourceRevision: fixture.xSupplyMesh.sourceRevision, coordinateCount: properties.coordinateCount, distanceMeters: properties.summary.distanceMeters, durationSeconds: properties.summary.durationSeconds, minimumClearanceMeters: properties.avoidance.minimumClearanceMeters }; }
export async function verifyClearanceAlternative(value: unknown, options: SourceOptions = {}): Promise<Result> {
  const source = await loadSource(options);
  if (!isRecord(value) || value.type !== "FeatureCollection" || !isRecord(value.xSupplyMesh) || !Array.isArray(value.features) || value.features.length !== 1) throw new Error("Alternative fixture collection is malformed.");
  const metadata = value.xSupplyMesh; const feature = value.features[0];
  if (!isRecord(feature) || feature.type !== "Feature" || !isRecord(feature.properties) || !isRecord(feature.geometry) || feature.geometry.type !== "LineString") throw new Error("Alternative fixture feature is malformed.");
  const properties = feature.properties; const routeCoordinates = coordinates(feature.geometry.coordinates); const summary = properties.summary; const avoidance = properties.avoidance;
  if (!isRecord(summary) || !isRecord(avoidance) || !exact(properties.relation, source.manifest.relation) || !exact(properties.logicalEndpoints, ENDPOINTS) || !Array.isArray(properties.returnedEndpoints) || !Array.isArray(properties.snapDistancesMeters)) throw new Error("Alternative fixture relation or route fields are invalid.");
  const returnedEndpoints: [Coordinate, Coordinate] = [coordinate(properties.returnedEndpoints[0], "returned origin"), coordinate(properties.returnedEndpoints[1], "returned destination")];
  const snapDistancesMeters: [number, number] = [distance(ENDPOINTS[0], returnedEndpoints[0], { units: "meters" }), distance(ENDPOINTS[1], returnedEndpoints[1], { units: "meters" })];
  if (!exact(returnedEndpoints, [routeCoordinates[0], routeCoordinates.at(-1)]) || !exact(properties.snapDistancesMeters, snapDistancesMeters) || snapDistancesMeters.some((entry) => entry > 350)) throw new Error("Alternative endpoint tolerance failed.");
  if (typeof summary.distanceMeters !== "number" || !Number.isFinite(summary.distanceMeters) || summary.distanceMeters <= 0 || summary.distanceMeters > 199_413.2 || typeof summary.durationSeconds !== "number" || !Number.isFinite(summary.durationSeconds) || summary.durationSeconds <= 0 || summary.durationSeconds > 10_584.2 || properties.coordinateCount !== routeCoordinates.length) throw new Error("Alternative summary or coordinate count is invalid.");
  const minimumClearanceMeters = clearanceMeters(routeCoordinates, source.polygon); const expectedAvoidance: Avoidance = { ...source.manifest.avoidance, polygon: source.polygon, minimumClearanceMeters };
  if (!exact(avoidance, expectedAvoidance)) throw new Error("Alternative avoidance evidence is invalid.");
  const normalized = { relation: source.manifest.relation, logicalEndpoints: ENDPOINTS, returnedEndpoints, snapDistancesMeters, summary: { distanceMeters: summary.distanceMeters, durationSeconds: summary.durationSeconds }, coordinateCount: routeCoordinates.length, avoidance: expectedAvoidance };
  const sourceRevision = canonicalSha256(canonicalPayload(source, normalized, routeCoordinates));
  if (metadata.generated !== true || metadata.fixtureSchemaVersion !== 1 || metadata.provider !== "openrouteservice" || metadata.profile !== "driving-hgv" || metadata.manifestRevision !== canonicalSha256(source.manifest) || metadata.currentRouteSourceRevision !== CURRENT_REVISION || metadata.sourceRevision !== sourceRevision || metadata.alternativeCount !== 1 || typeof metadata.generatedAt !== "string" || new Date(metadata.generatedAt).toISOString() !== metadata.generatedAt) throw new Error("Alternative fixture provenance or source revision is invalid.");
  return resultFrom(value as AlternativeFixture, false);
}
export async function generateClearanceAlternative(options: GenerateOptions): Promise<Result> {
  if (options.apiKey === undefined || options.apiKey.trim().length === 0) throw new Error("ORS_API_KEY is required in the process environment.");
  const source = await loadSource(options); const fetcher = options.fetcher ?? fetch; const sleep = options.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const request: ManifestRoute = { routeId: "route-011", origin: { id: "toledo", coordinates: ENDPOINTS[0] }, destination: { id: "alcobendas", coordinates: ENDPOINTS[1] }, request: { preference: "recommended", options: { avoid_polygons: source.polygon } } };
  const route = await requestRoute(request, options.apiKey, fetcher, sleep); const minimumClearanceMeters = clearanceMeters(route.coordinates, source.polygon);
  const properties: AlternativeProperties = { relation: source.manifest.relation, logicalEndpoints: ENDPOINTS, returnedEndpoints: route.returnedEndpoints, snapDistancesMeters: route.snapDistancesMeters, summary: route.summary, coordinateCount: route.coordinates.length, avoidance: { ...source.manifest.avoidance, polygon: source.polygon, minimumClearanceMeters } };
  const fixture: AlternativeFixture = { type: "FeatureCollection", xSupplyMesh: { generated: true, fixtureSchemaVersion: 1, provider: "openrouteservice", profile: "driving-hgv", generatedAt: (options.now ?? (() => new Date()))().toISOString(), manifestRevision: canonicalSha256(source.manifest), currentRouteSourceRevision: CURRENT_REVISION, sourceRevision: canonicalSha256(canonicalPayload(source, properties, route.coordinates)), alternativeCount: 1 }, features: [{ type: "Feature", properties, geometry: { type: "LineString", coordinates: route.coordinates } }] };
  await verifyClearanceAlternative(fixture, { currentFixture: source.currentFixture, manifest: source.manifest }); const outputPath = options.outputPath ?? OUTPUT_PATH;
  try { const existing = JSON.parse(await readFile(outputPath, "utf8")) as unknown; const verified = await verifyClearanceAlternative(existing, { currentFixture: source.currentFixture, manifest: source.manifest }); if (verified.sourceRevision === fixture.xSupplyMesh.sourceRevision) return verified; } catch { /* Replace only after the complete candidate has passed admission. */ }
  await writeAtomically(outputPath, `${JSON.stringify(fixture)}\n`); return resultFrom(fixture, true);
}
async function main(): Promise<void> {
  if (process.argv[2] === "generate") { const result = await generateClearanceAlternative({ apiKey: process.env.ORS_API_KEY }); console.log(`${result.changed ? "Generated" : "Verified unchanged"} 1 clearance alternative (${result.coordinateCount} coordinates, ${result.distanceMeters} m, ${result.durationSeconds} s, ${result.minimumClearanceMeters} m minimum clearance); sourceRevision ${result.sourceRevision}.`); return; }
  if (process.argv[2] === "verify") { const fixture = JSON.parse(await readFile(OUTPUT_PATH, "utf8")) as unknown; const result = await verifyClearanceAlternative(fixture); console.log(`Verified 1 clearance alternative (${result.coordinateCount} coordinates, ${result.distanceMeters} m, ${result.durationSeconds} s, ${result.minimumClearanceMeters} m minimum clearance); sourceRevision ${result.sourceRevision}.`); return; }
  throw new Error("Expected generate or verify action.");
}
if (import.meta.main) main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Clearance alternative command failed."); process.exitCode = 1; });
