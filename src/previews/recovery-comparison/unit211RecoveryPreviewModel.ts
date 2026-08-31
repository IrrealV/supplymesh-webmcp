import { createAssessAuthoritativeVerticalClearance } from "../../domain/operations/authoritativeVerticalAssessment";
import { clearanceAlternativeCatalog } from "../../scenario/fixtures/clearanceAlternativeCatalog";
import { createSpainScenario } from "../../scenario/fixtures/spain-v1";

export type PreviewCoordinate = readonly [number, number];
type PreviewRoute = Readonly<{ id: string; status: "rejected" | "valid"; coordinates: readonly PreviewCoordinate[]; distance: string; duration: string; distanceMeters: number; durationSeconds: number }>;
export type Unit211RecoveryPreviewModel = Readonly<{
  kind: "development-preview";
  vehicle: Readonly<{ id: string; label: string; fleetNumber: string; location: string; destination: string; state: "Before departure"; position: PreviewCoordinate }>;
  incident: Readonly<{ id: string; position: PreviewCoordinate; restrictionMeters: number; exclusionRadiusMeters: number; horizontalSeparationMeters: number; horizontalSeparation: string; exclusionCoordinates: readonly PreviewCoordinate[] }>;
  clearance: Readonly<{ vehicleHeightMeters: number; humanBufferMeters: number; requiredMeters: number; status: "FAIL"; equation: string }>;
  current: PreviewRoute;
  alternative: PreviewRoute;
  delta: Readonly<{ distance: string; duration: string }>;
  resolvedRisks: readonly string[];
  unknownData: readonly string[];
}>;

function required<T>(value: T | undefined, message: string): T { if (value === undefined) throw new Error(message); return value; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function coordinate(value: unknown): PreviewCoordinate | false { return Array.isArray(value) && value.length === 2 && value.every((entry) => typeof entry === "number" && Number.isFinite(entry)) ? [value[0], value[1]] : false; }
function coordinates(values: readonly number[][]): PreviewCoordinate[] { return values.map((value) => { const result = coordinate(value); if (result === false) throw new Error("Recovery preview route coordinates are invalid."); return result; }); }
function finiteNumber(value: unknown, label: string): number { if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Recovery preview ${label} is invalid.`); return value; }
function readAvoidance(value: Record<string, unknown>): { radiusMeters: number; horizontalSeparationMeters: number; polygon: PreviewCoordinate[] } {
  const polygon = value.polygon;
  if (!isRecord(polygon) || polygon.type !== "Polygon" || !Array.isArray(polygon.coordinates) || !Array.isArray(polygon.coordinates[0])) throw new Error("Recovery preview exclusion polygon is invalid.");
  const ring = polygon.coordinates[0].map((value) => { const result = coordinate(value); if (result === false) throw new Error("Recovery preview exclusion coordinate is invalid."); return result; });
  return { radiusMeters: finiteNumber(value.radiusMeters, "exclusion radius"), horizontalSeparationMeters: finiteNumber(value.minimumClearanceMeters, "horizontal separation"), polygon: ring };
}
function formatDistance(value: number): string { return `${(value / 1_000).toFixed(1)} km`; }
function formatDuration(value: number): string { const hours = Math.floor(value / 3_600); const minutes = Math.floor((value % 3_600) / 60); const seconds = value - hours * 3_600 - minutes * 60; return `${hours} h ${minutes} min ${Number.isInteger(seconds) ? seconds.toFixed(0) : seconds.toFixed(1)} s`; }
function deepFreeze<T>(value: T): T { if (typeof value === "object" && value !== null && !Object.isFrozen(value)) { for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child); Object.freeze(value); } return value; }

export function createUnit211RecoveryPreviewModel(): Unit211RecoveryPreviewModel {
  const scenario = createSpainScenario();
  const vehicle = required(scenario.vehicles.find(({ internalId }) => internalId === "vehicle-011"), "Unit 211 is missing from the recovery preview source.");
  const route = required(scenario.routes.find(({ id }) => id === "route-011"), "Route 011 is missing from the recovery preview source.");
  const snap = required(route.riskSnaps.find(({ riskId }) => riskId === "restriction-height-3.9"), "Route 011 clearance snap is missing.");
  const assessment = createAssessAuthoritativeVerticalClearance({ scenarioCurrent: () => scenario })({ vehicleId: vehicle.internalId, riskId: snap.riskId, clearanceBufferMeters: 0.2 });
  if (!assessment.ok || assessment.data.status !== "FAIL") throw new Error("Unit 211 no longer has the expected authoritative clearance failure.");
  const alternative = clearanceAlternativeCatalog;
  if (alternative.relation.vehicleId !== vehicle.internalId || alternative.relation.currentRouteId !== route.id || alternative.relation.avoidsRiskId !== snap.riskId) throw new Error("Recovery preview alternative relation is inconsistent.");
  const currentCoordinates = coordinates(route.geometry.geometry.coordinates);
  const alternativeCoordinates = coordinates(alternative.geometry.coordinates);
  const avoidance = readAvoidance(alternative.provenance.avoidance);
  const current = { id: route.id, status: "rejected" as const, coordinates: currentCoordinates, distance: formatDistance(route.summary.distanceMeters), duration: formatDuration(route.summary.durationSeconds), ...route.summary };
  const candidate = { id: alternative.relation.alternativeRouteId, status: "valid" as const, coordinates: alternativeCoordinates, distance: formatDistance(alternative.summary.distanceMeters), duration: formatDuration(alternative.summary.durationSeconds), ...alternative.summary };
  return deepFreeze({
    kind: "development-preview",
    vehicle: { id: vehicle.internalId, label: vehicle.label, fleetNumber: vehicle.fleetNumber, location: vehicle.origin.name, destination: vehicle.destination.name, state: "Before departure", position: currentCoordinates[0] },
    incident: { id: snap.riskId, position: coordinate(snap.startCoordinate) || (() => { throw new Error("Route 011 incident coordinate is invalid."); })(), restrictionMeters: assessment.data.restrictionLimitMeters, exclusionRadiusMeters: avoidance.radiusMeters, horizontalSeparationMeters: avoidance.horizontalSeparationMeters, horizontalSeparation: formatDistance(avoidance.horizontalSeparationMeters), exclusionCoordinates: avoidance.polygon },
    clearance: { vehicleHeightMeters: assessment.data.vehicleHeightMeters, humanBufferMeters: assessment.data.clearanceBufferMeters, requiredMeters: assessment.data.requiredClearanceMeters, status: assessment.data.status, equation: `${assessment.data.vehicleHeightMeters.toFixed(2)} + ${assessment.data.clearanceBufferMeters.toFixed(2)} = ${assessment.data.requiredClearanceMeters.toFixed(2)} m required` },
    current,
    alternative: candidate,
    delta: { distance: `${formatDistance(route.summary.distanceMeters - alternative.summary.distanceMeters)} shorter`, duration: `${(route.summary.durationSeconds - alternative.summary.durationSeconds).toFixed(1)} s faster` },
    resolvedRisks: ["Current-route clearance conflict identified from authoritative data.", `Alternative geometry avoids the ${avoidance.radiusMeters} m exclusion zone.`, `Horizontal separation from exclusion zone: ${formatDistance(avoidance.horizontalSeparationMeters)}.`],
    unknownData: ["Live traffic is unavailable.", "Elevation and turn-level validation are unavailable.", "Rest and cargo continuity are not evaluated in this preview."],
  });
}
