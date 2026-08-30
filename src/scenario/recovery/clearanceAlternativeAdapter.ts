import type { GeoLine, GeoPolygon, RouteSummary } from "../../domain/entities";
import { clearanceAlternativeCatalog } from "../fixtures/clearanceAlternativeCatalog";
import { routeCatalog } from "../fixtures/routeCatalog";

type Coordinate = [number, number];

export type ClearanceAlternativeRuntime = {
  alternativeRouteId: string;
  currentRouteId: string;
  exclusionZone: GeoPolygon["geometry"];
  geometry: GeoLine;
  incidentSnap: {
    coordinate: Coordinate;
    index: number;
    riskId: string;
    routeId: string;
  };
  minimumSeparationMeters: number;
  provenance: {
    generatedAt: string;
    profile: string;
    provider: string;
    sourceRevision: string;
  };
  summary: RouteSummary;
  vehicleId: string;
};

function isCoordinate(value: unknown): value is Coordinate {
  return Array.isArray(value)
    && value.length === 2
    && value.every((entry) => typeof entry === "number" && Number.isFinite(entry));
}

function fail(message: string): never {
  throw new Error(`Invalid clearance alternative runtime: ${message}`);
}

function copyCoordinate(value: readonly number[]): Coordinate {
  if (!isCoordinate(value)) {
    return fail("coordinate");
  }
  return [value[0], value[1]];
}

export function readClearanceAlternativeRuntime(): ClearanceAlternativeRuntime {
  const { geometry, provenance, relation, summary } = clearanceAlternativeCatalog;
  const currentRoute = routeCatalog.get(relation.currentRouteId);
  const incidentSnap = currentRoute?.riskSnaps.find(
    ({ riskId }) => riskId === relation.avoidsRiskId,
  );
  const avoidance = provenance.avoidance;

  if (
    relation.vehicleId !== "vehicle-011"
    || relation.currentRouteId !== "route-011"
    || relation.alternativeRouteId !== "alternative-route-011-clearance-v1"
    || relation.avoidsRiskId !== "restriction-height-3.9"
  ) {
    return fail("relation");
  }
  if (
    currentRoute === undefined
    || incidentSnap === undefined
    || incidentSnap.kind !== "point"
    || incidentSnap.startIndex !== 537
    || incidentSnap.endIndex !== 537
    || !isCoordinate(incidentSnap.startCoordinate)
    || !isCoordinate(incidentSnap.endCoordinate)
    || JSON.stringify(incidentSnap.startCoordinate)
      !== JSON.stringify(currentRoute.geometry.geometry.coordinates[537])
  ) {
    return fail("route-011 incident snap");
  }
  if (
    geometry.type !== "LineString"
    || geometry.coordinates.length < 3
    || !geometry.coordinates.every(isCoordinate)
    || avoidance.shape !== "geodesic-circle"
    || avoidance.radiusMeters !== 250
    || avoidance.steps !== 64
    || avoidance.polygon.type !== "Polygon"
    || avoidance.polygon.coordinates.length !== 1
    || avoidance.polygon.coordinates[0].length !== 65
    || !avoidance.polygon.coordinates[0].every(isCoordinate)
    || !Number.isFinite(avoidance.minimumClearanceMeters)
    || avoidance.minimumClearanceMeters <= 0
    || !Number.isFinite(summary.distanceMeters)
    || !Number.isFinite(summary.durationSeconds)
  ) {
    return fail("geometry or evidence");
  }

  return {
    alternativeRouteId: relation.alternativeRouteId,
    currentRouteId: relation.currentRouteId,
    exclusionZone: structuredClone(avoidance.polygon),
    geometry: {
      geometry: structuredClone(geometry),
      properties: {},
      type: "Feature",
    },
    incidentSnap: {
      coordinate: copyCoordinate(incidentSnap.startCoordinate),
      index: incidentSnap.startIndex,
      riskId: incidentSnap.riskId,
      routeId: relation.currentRouteId,
    },
    minimumSeparationMeters: avoidance.minimumClearanceMeters,
    provenance: {
      generatedAt: provenance.generatedAt,
      profile: provenance.profile,
      provider: provenance.provider,
      sourceRevision: provenance.sourceRevision,
    },
    summary: structuredClone(summary),
    vehicleId: relation.vehicleId,
  };
}
