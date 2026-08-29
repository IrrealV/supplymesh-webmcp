import { createHash } from "node:crypto";
import { open, readFile, rename, unlink } from "node:fs/promises";
import distance from "@turf/distance";

export type Coordinate = [number, number];
export type ManifestRoute = { routeId: string; origin: { id: string; coordinates: Coordinate }; destination: { id: string; coordinates: Coordinate }; request: { preference: string; options: Record<string, unknown>; radiuses?: number[] } };
export type RouteGenerationManifest = { version: number; routes: ManifestRoute[] };
export type RiskSnap = { riskId: string; kind: "point" | "segment"; startIndex: number; endIndex: number; startCoordinate: Coordinate; endCoordinate: Coordinate };
export type AcceptedRoute = { routeId: string; originId: string; destinationId: string; logicalEndpoints: [Coordinate, Coordinate]; returnedEndpoints: [Coordinate, Coordinate]; snapDistancesMeters: [number, number]; coordinates: Coordinate[]; summary: { distanceMeters: number; durationSeconds: number }; riskSnaps: RiskSnap[] };
type RecordValue = Record<string, unknown>;
type Fixture = { type: "FeatureCollection"; xSupplyMesh: { generated: true; fixtureSchemaVersion: 1; provider: "openrouteservice"; profile: "driving-hgv"; generatedAt: string; manifestRevision: string; sourceRevision: string; routeCount: number }; features: Array<{ type: "Feature"; properties: Omit<AcceptedRoute, "coordinates">; geometry: { type: "LineString"; coordinates: Coordinate[] } }> };
type GenerateOptions = { apiKey: string | undefined; fetcher?: typeof fetch; manifest: RouteGenerationManifest; now?: () => Date; outputPath: string; sleep?: (milliseconds: number) => Promise<void> };
const ENDPOINT = "https://api.openrouteservice.org/v2/directions/driving-hgv/geojson";
const DEFAULT_RADIUS_METERS = 350;

function isRecord(value: unknown): value is RecordValue { return typeof value === "object" && value !== null && !Array.isArray(value); }
function coordinate(value: unknown, context: string): Coordinate {
  if (!Array.isArray(value) || value.length !== 2 || !value.every((entry) => typeof entry === "number" && Number.isFinite(entry))) throw new Error(`Invalid coordinate for ${context}.`);
  const result: Coordinate = [Object.is(value[0], -0) ? 0 : value[0], Object.is(value[1], -0) ? 0 : value[1]];
  if (result[0] < -10 || result[0] > 4 || result[1] < 35 || result[1] > 44.5) throw new Error(`Coordinate outside Spain bounds for ${context}.`);
  return result;
}
function radiuses(route: ManifestRoute): [number, number] {
  const configured = route.request.radiuses;
  if (configured === undefined) return [DEFAULT_RADIUS_METERS, DEFAULT_RADIUS_METERS];
  if (configured.length !== 2 || configured.some((radius) => !Number.isFinite(radius) || radius <= 0)) throw new Error(`Invalid radiuses for ${route.routeId}.`);
  return [configured[0], configured[1]];
}
function sortedManifest(manifest: RouteGenerationManifest): RouteGenerationManifest {
  if (manifest.version !== 1 || !Array.isArray(manifest.routes) || manifest.routes.length === 0) throw new Error("Route manifest version or routes are invalid.");
  const routes = [...manifest.routes].sort((left, right) => left.routeId.localeCompare(right.routeId));
  if (new Set(routes.map(({ routeId }) => routeId)).size !== routes.length) throw new Error("Route manifest IDs must be unique.");
  for (const route of routes) {
    if (!/^route-\d{3}$/.test(route.routeId) || !route.origin.id || !route.destination.id || !isRecord(route.request.options) || !route.request.preference || "alternative_routes" in route.request.options) throw new Error(`Invalid manifest route ${route.routeId}.`);
    coordinate(route.origin.coordinates, `${route.routeId} origin`); coordinate(route.destination.coordinates, `${route.routeId} destination`); radiuses(route);
  }
  return { version: manifest.version, routes };
}
function canonicalValue(value: unknown): unknown {
  if (typeof value === "number") { if (!Number.isFinite(value)) throw new Error("Canonical JSON cannot contain non-finite numbers."); return Object.is(value, -0) ? 0 : value; }
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (isRecord(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  throw new Error("Canonical JSON contains an unsupported value.");
}
export function canonicalJSON(value: unknown): string { return JSON.stringify(canonicalValue(value)); }
function sha256(value: unknown): string { return createHash("sha256").update(canonicalJSON(value), "utf8").digest("hex"); }
export function canonicalSha256(value: unknown): string { return sha256(value); }
function canonicalManifest(manifest: RouteGenerationManifest): RouteGenerationManifest {
  const stable = sortedManifest(manifest);
  return { version: stable.version, routes: stable.routes.map((route) => ({ ...route, request: { preference: route.request.preference, options: route.request.options, radiuses: route.request.radiuses ?? null } })) } as RouteGenerationManifest;
}
function cleanRoute(route: AcceptedRoute): AcceptedRoute { return { routeId: route.routeId, originId: route.originId, destinationId: route.destinationId, logicalEndpoints: route.logicalEndpoints, returnedEndpoints: route.returnedEndpoints, snapDistancesMeters: route.snapDistancesMeters, coordinates: route.coordinates, summary: route.summary, riskSnaps: [...route.riskSnaps].sort((a, b) => a.riskId.localeCompare(b.riskId)) }; }
export function calculateSourceRevision(manifest: RouteGenerationManifest, routes: AcceptedRoute[]): string { return sha256({ fixtureSchemaVersion: 1, provider: "openrouteservice", profile: "driving-hgv", manifest: canonicalManifest(manifest), routes: [...routes].map(cleanRoute).sort((a, b) => a.routeId.localeCompare(b.routeId)) }); }

function snapDistance(left: Coordinate, right: Coordinate): number { return distance(left, right, { units: "meters" }); }
function riskSnaps(routeId: string, coordinates: Coordinate[]): RiskSnap[] {
  const number = Number(routeId.slice(-3)); const shared = ["restriction-height-3.9", "restriction-weight-26", "closure-ap-68", "severe-snow-leon", ""][(number - 1) % 5];
  const inputs: Array<{ riskId: string; kind: "point" | "segment"; ratio: number }> = [{ riskId: `rest-deadline-vehicle-${String(number).padStart(3, "0")}`, kind: "segment", ratio: 0.72 }];
  if (shared) inputs.push({ riskId: shared, kind: shared.startsWith("restriction") ? "point" : "segment", ratio: 0.48 });
  return inputs.map(({ riskId, kind, ratio }) => { const startIndex = Math.min(coordinates.length - 2, Math.floor((coordinates.length - 1) * ratio)); const endIndex = kind === "point" ? startIndex : startIndex + 1; return { riskId, kind, startIndex, endIndex, startCoordinate: coordinates[startIndex], endCoordinate: coordinates[endIndex] }; }).sort((a, b) => a.riskId.localeCompare(b.riskId));
}
function retryDelay(response: Response, retry: number): number { const header = response.headers.get("Retry-After"); const value = header === null ? Number.NaN : Number(header); return Number.isFinite(value) && value >= 0 ? Math.min(value * 1000, 5000) : Math.min(250 * 2 ** retry, 2000); }
export async function requestRoute(route: ManifestRoute, apiKey: string, fetcher: typeof fetch, sleep: (milliseconds: number) => Promise<void>): Promise<AcceptedRoute> {
  const body = JSON.stringify({ coordinates: [route.origin.coordinates, route.destination.coordinates], preference: route.request.preference, options: route.request.options, ...(route.request.radiuses === undefined ? {} : { radiuses: route.request.radiuses }), instructions: false });
  for (let attempt = 0; attempt <= 3; attempt += 1) {
    let response: Response; try { response = await fetcher(ENDPOINT, { method: "POST", headers: { Authorization: apiKey, "Content-Type": "application/json" }, body }); } catch { throw new Error(`ORS request failed for ${route.routeId}.`); }
    const retryable = response.status === 429 || response.status >= 500;
    if (!response.ok && retryable && attempt < 3) { await sleep(retryDelay(response, attempt)); continue; }
    if (!response.ok) throw new Error(`ORS request failed for ${route.routeId} with HTTP ${response.status}.`);
    let payload: unknown; try { payload = await response.json(); } catch { throw new Error(`ORS returned malformed JSON for ${route.routeId}.`); }
    if (!isRecord(payload) || !Array.isArray(payload.features) || payload.features.length !== 1) throw new Error(`ORS returned an invalid feature count for ${route.routeId}.`);
    const feature = payload.features[0];
    if (!isRecord(feature) || !isRecord(feature.geometry) || feature.geometry.type !== "LineString" || !Array.isArray(feature.geometry.coordinates) || feature.geometry.coordinates.length < 3 || !isRecord(feature.properties) || !isRecord(feature.properties.summary)) throw new Error(`ORS returned malformed route data for ${route.routeId}.`);
    const coordinates = feature.geometry.coordinates.map((entry, index) => coordinate(entry, `${route.routeId} coordinate ${index}`)); const returnedEndpoints: [Coordinate, Coordinate] = [coordinates[0], coordinates.at(-1)!]; const logicalEndpoints: [Coordinate, Coordinate] = [route.origin.coordinates, route.destination.coordinates]; const snapDistancesMeters: [number, number] = [snapDistance(logicalEndpoints[0], returnedEndpoints[0]), snapDistance(logicalEndpoints[1], returnedEndpoints[1])]; const bounds = radiuses(route);
    if (snapDistancesMeters.some((value, index) => value > bounds[index] || value > 2000)) throw new Error(`ORS endpoint radius failed for ${route.routeId}.`);
    const summary = feature.properties.summary; if (typeof summary.distance !== "number" || !Number.isFinite(summary.distance) || summary.distance <= 0 || typeof summary.duration !== "number" || !Number.isFinite(summary.duration) || summary.duration <= 0) throw new Error(`ORS returned an invalid summary for ${route.routeId}.`);
    return { routeId: route.routeId, originId: route.origin.id, destinationId: route.destination.id, logicalEndpoints, returnedEndpoints, snapDistancesMeters, coordinates, summary: { distanceMeters: summary.distance, durationSeconds: summary.duration }, riskSnaps: riskSnaps(route.routeId, coordinates) };
  }
  throw new Error(`ORS retry limit reached for ${route.routeId}.`);
}
function fixtureFrom(manifest: RouteGenerationManifest, routes: AcceptedRoute[], generatedAt: string): Fixture { const stableRoutes = [...routes].map(cleanRoute).sort((a, b) => a.routeId.localeCompare(b.routeId)); return { type: "FeatureCollection", xSupplyMesh: { generated: true, fixtureSchemaVersion: 1, provider: "openrouteservice", profile: "driving-hgv", generatedAt, manifestRevision: sha256(canonicalManifest(manifest)), sourceRevision: calculateSourceRevision(manifest, stableRoutes), routeCount: stableRoutes.length }, features: stableRoutes.map(({ coordinates, ...properties }) => ({ type: "Feature", properties, geometry: { type: "LineString", coordinates } })) }; }
function pair(value: unknown, context: string): [Coordinate, Coordinate] { if (!Array.isArray(value) || value.length !== 2) throw new Error(`Fixture ${context} is malformed.`); return [coordinate(value[0], `${context} 0`), coordinate(value[1], `${context} 1`)]; }
function routeFromFeature(value: unknown): AcceptedRoute {
  if (!isRecord(value) || value.type !== "Feature" || !isRecord(value.properties) || !isRecord(value.geometry) || value.geometry.type !== "LineString" || !Array.isArray(value.geometry.coordinates)) throw new Error("Fixture feature is malformed.");
  const properties = value.properties; const summary = properties.summary; const snaps = properties.riskSnaps; const distances = properties.snapDistancesMeters;
  if (typeof properties.routeId !== "string" || typeof properties.originId !== "string" || typeof properties.destinationId !== "string" || !isRecord(summary) || !Array.isArray(snaps) || !Array.isArray(distances) || distances.length !== 2 || !distances.every((entry) => typeof entry === "number" && Number.isFinite(entry))) throw new Error("Fixture properties are malformed.");
  const coordinates = value.geometry.coordinates.map((entry, index) => coordinate(entry, `${properties.routeId} coordinate ${index}`)); if (coordinates.length < 3 || typeof summary.distanceMeters !== "number" || summary.distanceMeters <= 0 || typeof summary.durationSeconds !== "number" || summary.durationSeconds <= 0) throw new Error(`Fixture summary or geometry is invalid for ${properties.routeId}.`);
  const riskSnaps = snaps.map((snap): RiskSnap => { if (!isRecord(snap) || typeof snap.riskId !== "string" || (snap.kind !== "point" && snap.kind !== "segment") || !Number.isInteger(snap.startIndex) || !Number.isInteger(snap.endIndex)) throw new Error(`Fixture risk snap is invalid for ${properties.routeId}.`); const startIndex = snap.startIndex as number; const endIndex = snap.endIndex as number; const startCoordinate = coordinate(snap.startCoordinate, `${properties.routeId} snap start`); const endCoordinate = coordinate(snap.endCoordinate, `${properties.routeId} snap end`); if (startIndex < 0 || endIndex >= coordinates.length || JSON.stringify(coordinates[startIndex]) !== JSON.stringify(startCoordinate) || JSON.stringify(coordinates[endIndex]) !== JSON.stringify(endCoordinate) || (snap.kind === "point" ? endIndex !== startIndex : endIndex !== startIndex + 1)) throw new Error(`Fixture risk snap drifted for ${properties.routeId}.`); return { riskId: snap.riskId, kind: snap.kind, startIndex, endIndex, startCoordinate, endCoordinate }; });
  return { routeId: properties.routeId, originId: properties.originId, destinationId: properties.destinationId, logicalEndpoints: pair(properties.logicalEndpoints, "logical endpoints"), returnedEndpoints: pair(properties.returnedEndpoints, "returned endpoints"), snapDistancesMeters: [distances[0] as number, distances[1] as number], coordinates, summary: { distanceMeters: summary.distanceMeters, durationSeconds: summary.durationSeconds }, riskSnaps };
}
export async function verifyRouteFixture(manifest: RouteGenerationManifest, value: unknown): Promise<{ routeCount: number; sourceRevision: string; coordinateCount: number }> {
  const stableManifest = sortedManifest(manifest); if (!isRecord(value) || value.type !== "FeatureCollection" || !isRecord(value.xSupplyMesh) || !Array.isArray(value.features)) throw new Error("Route fixture collection is malformed.");
  const metadata = value.xSupplyMesh; const routes = value.features.map(routeFromFeature).sort((a, b) => a.routeId.localeCompare(b.routeId)); if (JSON.stringify(routes.map(({ routeId }) => routeId)) !== JSON.stringify(stableManifest.routes.map(({ routeId }) => routeId))) throw new Error("Route fixture IDs do not match the manifest.");
  for (let index = 0; index < routes.length; index += 1) { const route = routes[index]; const request = stableManifest.routes[index]; const bounds = radiuses(request); if (route.originId !== request.origin.id || route.destinationId !== request.destination.id || JSON.stringify(route.logicalEndpoints) !== JSON.stringify([request.origin.coordinates, request.destination.coordinates]) || JSON.stringify(route.returnedEndpoints) !== JSON.stringify([route.coordinates[0], route.coordinates.at(-1)])) throw new Error(`Fixture endpoint association failed for ${route.routeId}.`); const computed = route.logicalEndpoints.map((endpoint, endpointIndex) => snapDistance(endpoint, route.returnedEndpoints[endpointIndex])) as [number, number]; if (computed.some((distanceMeters, endpointIndex) => distanceMeters !== route.snapDistancesMeters[endpointIndex] || distanceMeters > bounds[endpointIndex] || distanceMeters > 2000)) throw new Error(`Fixture endpoint radius failed for ${route.routeId}.`); if (JSON.stringify(route.riskSnaps.map(({ riskId }) => riskId)) !== JSON.stringify(riskSnaps(route.routeId, route.coordinates).map(({ riskId }) => riskId))) throw new Error(`Fixture risk associations failed for ${route.routeId}.`); }
  const sourceRevision = calculateSourceRevision(stableManifest, routes); if (metadata.generated !== true || metadata.fixtureSchemaVersion !== 1 || metadata.provider !== "openrouteservice" || metadata.profile !== "driving-hgv" || metadata.routeCount !== routes.length || metadata.manifestRevision !== sha256(canonicalManifest(stableManifest)) || metadata.sourceRevision !== sourceRevision || typeof metadata.generatedAt !== "string" || new Date(metadata.generatedAt).toISOString() !== metadata.generatedAt) throw new Error("Route fixture provenance is invalid.");
  return { routeCount: routes.length, sourceRevision, coordinateCount: routes.reduce((total, route) => total + route.coordinates.length, 0) };
}
export async function writeAtomically(path: string, bytes: string, renameFile: typeof rename = rename): Promise<void> { const temporaryPath = `${path}.tmp-${process.pid}-${Date.now()}`; let handle: Awaited<ReturnType<typeof open>> | undefined; try { handle = await open(temporaryPath, "w"); await handle.writeFile(bytes, "utf8"); await handle.sync(); await handle.close(); handle = undefined; await renameFile(temporaryPath, path); } catch (error) { await handle?.close().catch(() => undefined); await unlink(temporaryPath).catch(() => undefined); throw error; } }
export async function generateRouteFixture(options: GenerateOptions): Promise<{ changed: boolean; routeCount: number; coordinateCount: number; sourceRevision: string }> {
  if (options.apiKey === undefined || options.apiKey.trim().length === 0) throw new Error("ORS_API_KEY is required in the process environment."); const manifest = sortedManifest(options.manifest); const fetcher = options.fetcher ?? fetch; const sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))); const routes: AcceptedRoute[] = [];
  for (const route of manifest.routes) routes.push(await requestRoute(route, options.apiKey, fetcher, sleep)); const fixture = fixtureFrom(manifest, routes, (options.now ?? (() => new Date()))().toISOString());
  try { const existing = JSON.parse(await readFile(options.outputPath, "utf8")) as unknown; const verified = await verifyRouteFixture(manifest, existing); if (verified.sourceRevision === fixture.xSupplyMesh.sourceRevision) return { changed: false, ...verified }; } catch { /* Replace absent/invalid prior bytes only after full in-memory validation. */ }
  const verified = await verifyRouteFixture(manifest, fixture); await writeAtomically(options.outputPath, `${JSON.stringify(fixture)}\n`); return { changed: true, ...verified };
}
