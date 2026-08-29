import rawFixture from "./clearance-alternative-route-v1.geojson?raw";

type Coordinate = [number, number];
type Fixture = { xSupplyMesh: { provider: string; profile: string; sourceRevision: string; generatedAt: string }; features: [{ properties: { relation: { vehicleId: string; currentRouteId: string; avoidsRiskId: string; alternativeRouteId: string }; summary: { distanceMeters: number; durationSeconds: number }; avoidance: Record<string, unknown> }; geometry: { type: "LineString"; coordinates: Coordinate[] } }] };
function deepFreeze<T>(value: T): T { if (typeof value === "object" && value !== null) for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child); return Object.freeze(value); }
const fixture = JSON.parse(rawFixture) as Fixture;
const feature = fixture.features[0];
export const clearanceAlternativeCatalog = deepFreeze({
  relation: feature.properties.relation,
  geometry: feature.geometry,
  summary: feature.properties.summary,
  provenance: { provider: fixture.xSupplyMesh.provider, profile: fixture.xSupplyMesh.profile, sourceRevision: fixture.xSupplyMesh.sourceRevision, generatedAt: fixture.xSupplyMesh.generatedAt, avoidance: feature.properties.avoidance },
});
