import type { Unit211PreDispatchContextFailureReason, Unit211PreDispatchContextResult } from "../../domain/operations/unit211PreDispatchContext";

export type PreviewCoordinate = readonly [number, number];
type PreDispatchData = Extract<Unit211PreDispatchContextResult, { ok: true }>["data"];
type PreviewRoute<Status extends string> = Readonly<{ id: string; status: Status; coordinates: readonly PreviewCoordinate[]; distance: string; duration: string; distanceMeters: number; durationSeconds: number }>;
export type Unit211RecoveryPreviewModel = Readonly<{
  kind: "development-preview";
  scenarioClock: Readonly<{ instant: string; mode: string }>;
  vehicle: Readonly<{ id: string; displayLabel: string; fleetNumber: string; location: string; state: string; position: PreviewCoordinate }>;
  incident: Readonly<{ id: string; riskId: string; position: PreviewCoordinate; restrictionMeters: number; exclusionRadiusMeters: number; horizontalSeparationMeters: number; horizontalSeparation: string; exclusionCoordinates: readonly PreviewCoordinate[] }>;
  clearance: Readonly<{ vehicleHeightMeters: number; humanBufferMeters: number; requiredMeters: number; status: string; reasonCode: string; equation: string }>;
  current: PreviewRoute<PreDispatchData["options"][0]["disposition"]>;
  alternative: PreviewRoute<PreDispatchData["options"][1]["disposition"]> & Readonly<{ avoidsExclusionZone: boolean }>;
  delta: Readonly<{ distance: string; duration: string }>;
  resolvedRisks: readonly string[];
  unknownData: readonly string[];
}>;
export type Unit211RecoveryPreviewState = Unit211RecoveryPreviewModel | Readonly<{ kind: "operation-failure"; reasonCode: Unit211PreDispatchContextFailureReason }>;

function formatDistance(value: number): string { return `${(value / 1_000).toFixed(1)} km`; }
function formatDuration(value: number): string { const hours = Math.floor(value / 3_600); const minutes = Math.floor((value % 3_600) / 60); const seconds = value - hours * 3_600 - minutes * 60; return `${hours} h ${minutes} min ${Number.isInteger(seconds) ? seconds.toFixed(0) : seconds.toFixed(1)} s`; }
function formatDelta(value: number, format: (absoluteValue: number) => string, decrease: string, increase: string): string { return value === 0 ? "No change" : `${format(Math.abs(value))} ${value > 0 ? decrease : increase}`; }
function formatUnitLabel(fleetNumber: string): string { return `Unit ${fleetNumber.replace(/^FM-/, "")}`; }
function copyCoordinate([longitude, latitude]: readonly [number, number]): PreviewCoordinate { return [longitude, latitude]; }
function copyCoordinates(values: readonly (readonly [number, number])[]): PreviewCoordinate[] { return values.map(copyCoordinate); }
function deepFreeze<T>(value: T): T { if (typeof value === "object" && value !== null && !Object.isFrozen(value)) { for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child); Object.freeze(value); } return value; }

export function createUnit211RecoveryPreviewModel(result: Unit211PreDispatchContextResult): Unit211RecoveryPreviewState {
  if (!result.ok) return Object.freeze({ kind: "operation-failure", reasonCode: result.reasonCode });
  const { context, incident, options } = result.data; const [current, alternative] = options; const assessment = current.clearanceAssessment.data;
  const horizontalSeparationMeters = alternative.provenance.avoidance.minimumClearanceMeters;
  const distanceDeltaMeters = current.summary.distanceMeters - alternative.summary.distanceMeters;
  const durationDeltaSeconds = current.summary.durationSeconds - alternative.summary.durationSeconds;
  return deepFreeze({
    kind: "development-preview",
    scenarioClock: { ...context.scenarioClock },
    vehicle: { id: context.unit.vehicleId, displayLabel: formatUnitLabel(context.unit.fleetNumber), fleetNumber: context.unit.fleetNumber, location: context.origin.name, state: context.isRouteStarted ? "Route started" : "Before departure", position: copyCoordinate(context.position.coordinates) },
    incident: { id: incident.id, riskId: incident.riskId, position: copyCoordinate(incident.point.coordinates), restrictionMeters: assessment.restrictionLimitMeters, exclusionRadiusMeters: alternative.provenance.avoidance.radiusMeters, horizontalSeparationMeters, horizontalSeparation: formatDistance(horizontalSeparationMeters), exclusionCoordinates: copyCoordinates(incident.exclusionPolygon.coordinates[0]) },
    clearance: { vehicleHeightMeters: assessment.vehicleHeightMeters, humanBufferMeters: assessment.clearanceBufferMeters, requiredMeters: assessment.requiredClearanceMeters, status: assessment.status, reasonCode: assessment.reasonCode, equation: `${assessment.vehicleHeightMeters.toFixed(2)} + ${assessment.clearanceBufferMeters.toFixed(2)} = ${assessment.requiredClearanceMeters.toFixed(2)} m required` },
    current: { id: current.routeId, status: current.disposition, coordinates: copyCoordinates(current.geometry.coordinates), distance: formatDistance(current.summary.distanceMeters), duration: formatDuration(current.summary.durationSeconds), ...current.summary },
    alternative: { id: alternative.alternativeRouteId, status: alternative.disposition, avoidsExclusionZone: alternative.avoidsExclusionZone, coordinates: copyCoordinates(alternative.geometry.coordinates), distance: formatDistance(alternative.summary.distanceMeters), duration: formatDuration(alternative.summary.durationSeconds), ...alternative.summary },
    delta: { distance: formatDelta(distanceDeltaMeters, formatDistance, "shorter", "longer"), duration: formatDelta(durationDeltaSeconds, (value) => `${value.toFixed(1)} s`, "faster", "slower") },
    resolvedRisks: [`${assessment.reasonCode}: current route disposition is ${current.disposition}.`, `${alternative.relation.avoidsRiskId}: exclusion-zone avoidance is ${alternative.avoidsExclusionZone ? "confirmed" : "not confirmed"}.`, `Horizontal separation from exclusion zone: ${formatDistance(horizontalSeparationMeters)}.`],
    unknownData: [],
  });
}
