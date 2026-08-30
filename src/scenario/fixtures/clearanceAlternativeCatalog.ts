import rawFixture from "./clearance-alternative-route-v1.geojson?raw";

type Coordinate = [number, number];
type PolygonGeometry = {
  coordinates: Coordinate[][];
  type: "Polygon";
};
type Avoidance = {
  minimumClearanceMeters: number;
  polygon: PolygonGeometry;
  radiusMeters: number;
  shape: "geodesic-circle";
  steps: number;
};
type Fixture = {
  features: [{
    geometry: {
      coordinates: Coordinate[];
      type: "LineString";
    };
    properties: {
      avoidance: Avoidance;
      relation: {
        alternativeRouteId: string;
        avoidsRiskId: string;
        currentRouteId: string;
        vehicleId: string;
      };
      summary: {
        distanceMeters: number;
        durationSeconds: number;
      };
    };
  }];
  xSupplyMesh: {
    generatedAt: string;
    profile: string;
    provider: string;
    sourceRevision: string;
  };
};

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
  }
  return Object.freeze(value);
}

const fixture = JSON.parse(rawFixture) as Fixture;
const feature = fixture.features[0];

export const clearanceAlternativeCatalog = deepFreeze({
  geometry: feature.geometry,
  provenance: {
    avoidance: feature.properties.avoidance,
    generatedAt: fixture.xSupplyMesh.generatedAt,
    profile: fixture.xSupplyMesh.profile,
    provider: fixture.xSupplyMesh.provider,
    sourceRevision: fixture.xSupplyMesh.sourceRevision,
  },
  relation: feature.properties.relation,
  summary: feature.properties.summary,
});
