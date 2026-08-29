import type { GeoLine, RiskRouteSnap, RouteSummary } from "../../domain/entities";
import rawFixture from "./ors-routes.geojson?raw";

type Coordinate = [number, number];
type RouteCatalogEntry = { routeId: string; originId: string; destinationId: string; logicalEndpoints: [Coordinate, Coordinate]; returnedEndpoints: [Coordinate, Coordinate]; snapDistancesMeters: [number, number]; summary: RouteSummary; riskSnaps: RiskRouteSnap[]; geometry: GeoLine };
type FixtureFeature = { type: "Feature"; properties: Omit<RouteCatalogEntry, "geometry">; geometry: GeoLine["geometry"] };
type FixtureCollection = { type: "FeatureCollection"; xSupplyMesh: { generated: true; fixtureSchemaVersion: 1; provider: "openrouteservice"; profile: "driving-hgv"; sourceRevision: string; routeCount: number }; features: FixtureFeature[] };

export class RouteFixtureError extends Error {}
function validCoordinate(value: unknown): value is Coordinate { return Array.isArray(value) && value.length === 2 && value.every((entry) => typeof entry === "number" && Number.isFinite(entry)); }
function parseFixture(serialized: string): FixtureCollection {
  let value: unknown; try { value = JSON.parse(serialized); } catch { throw new RouteFixtureError("Route fixture is not valid JSON."); }
  const fixture = value as Partial<FixtureCollection>;
  if (fixture.type !== "FeatureCollection" || fixture.xSupplyMesh?.generated !== true || fixture.xSupplyMesh.fixtureSchemaVersion !== 1 || fixture.xSupplyMesh.provider !== "openrouteservice" || fixture.xSupplyMesh.profile !== "driving-hgv" || !/^[a-f0-9]{64}$/.test(fixture.xSupplyMesh.sourceRevision ?? "") || !Array.isArray(fixture.features) || fixture.features.length !== fixture.xSupplyMesh.routeCount) throw new RouteFixtureError("Route fixture provenance is invalid.");
  const routeIds = new Set<string>();
  for (const feature of fixture.features) {
    const coordinates = feature?.geometry?.coordinates; const properties = feature?.properties;
    if (feature?.type !== "Feature" || feature.geometry?.type !== "LineString" || !Array.isArray(coordinates) || coordinates.length < 3 || !coordinates.every(validCoordinate) || typeof properties?.routeId !== "string" || routeIds.has(properties.routeId) || !Array.isArray(properties.riskSnaps)) throw new RouteFixtureError("Route fixture feature is invalid.");
    routeIds.add(properties.routeId);
    if (JSON.stringify(properties.returnedEndpoints) !== JSON.stringify([coordinates[0], coordinates.at(-1)])) throw new RouteFixtureError(`Returned endpoint drift for ${properties.routeId}.`);
    for (const snap of properties.riskSnaps) if (!Number.isInteger(snap.startIndex) || !Number.isInteger(snap.endIndex) || JSON.stringify(coordinates[snap.startIndex]) !== JSON.stringify(snap.startCoordinate) || JSON.stringify(coordinates[snap.endIndex]) !== JSON.stringify(snap.endCoordinate)) throw new RouteFixtureError(`Risk snap drift for ${properties.routeId}.`);
  }
  return fixture as FixtureCollection;
}
export function loadRouteCatalog(serialized = rawFixture): ReadonlyMap<string, RouteCatalogEntry> {
  const fixture = parseFixture(serialized);
  return new Map(fixture.features.map((feature) => [feature.properties.routeId, { ...feature.properties, riskSnaps: feature.properties.riskSnaps.map((snap) => ({ ...snap, routeId: feature.properties.routeId })), geometry: { type: "Feature", properties: {}, geometry: feature.geometry } }]));
}
export const routeCatalog = loadRouteCatalog();
