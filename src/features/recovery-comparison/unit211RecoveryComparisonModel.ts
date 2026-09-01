import type { Unit211PreDispatchContextFailureReason, Unit211PreDispatchContextResult } from "../../domain/operations/unit211PreDispatchContext";
import { recoveryComparisonCopy, type Locale } from "../../preferences/i18n/catalog";

export type RecoveryCoordinate = readonly [number, number];
type PreDispatchData = Extract<Unit211PreDispatchContextResult, { ok: true }>["data"];
type PreDispatchOption = PreDispatchData["options"][number];
type TemporalAssessment = PreDispatchOption["temporalAssessment"];
type CargoContinuityAssessment = PreDispatchOption["cargoContinuityAssessment"];
type RecoveryRoute<Status extends string> = Readonly<{ id: string; status: Status; statusLabel: string; coordinates: readonly RecoveryCoordinate[]; distance: string; duration: string; distanceMeters: number; durationSeconds: number; temporal: TemporalAssessment; cargoContinuity: CargoContinuityAssessment }>;
export type Unit211RecoveryComparisonModel = Readonly<{
  kind: "ready";
  scenarioClock: Readonly<{ instant: string; mode: string }>;
  vehicle: Readonly<{ id: string; displayLabel: string; fleetNumber: string; location: string; state: string; position: RecoveryCoordinate }>;
  incident: Readonly<{ id: string; riskId: string; position: RecoveryCoordinate; restrictionMeters: number; exclusionRadiusMeters: number; exclusionCoordinates: readonly RecoveryCoordinate[] }>;
  clearance: Readonly<{ vehicleHeightMeters: number; humanBufferMeters: number; requiredMeters: number; status: string; reasonCode: string; equation: string }>;
  current: RecoveryRoute<PreDispatchData["options"][0]["disposition"]>;
  alternative: RecoveryRoute<PreDispatchData["options"][1]["disposition"]> & Readonly<{ avoidsExclusionZone: boolean }>;
}>;
export type Unit211RecoveryComparisonState = Unit211RecoveryComparisonModel | Readonly<{ kind: "operation-failure"; reasonCode: Unit211PreDispatchContextFailureReason }>;

function formatDecimal(value: number, locale: Locale, digits: number): string { return new Intl.NumberFormat(locale === "es" ? "es-ES" : "en-GB", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value); }
function formatDistance(value: number, locale: Locale): string { return `${formatDecimal(value / 1_000, locale, 1)} km`; }
function formatDuration(value: number, locale: Locale): string { const hours = Math.floor(value / 3_600); const minutes = Math.floor((value % 3_600) / 60); const seconds = value - hours * 3_600 - minutes * 60; return `${hours} h ${minutes} min ${formatDecimal(seconds, locale, Number.isInteger(seconds) ? 0 : 1)} s`; }
function formatUnitLabel(fleetNumber: string): string { return `Unit ${fleetNumber.replace(/^FM-/, "")}`; }
function statusLabel(value: string, locale: Locale): string { const copy = recoveryComparisonCopy(locale); if (value === "REJECTED") return copy.rejected; if (value === ["SUPPORTED", "FOR", "COMPARISON"].join("_")) return copy.supported; const normalized = value.toLowerCase().replaceAll("_", " "); return normalized.length === 0 ? "" : `${normalized[0].toUpperCase()}${normalized.slice(1)}`; }
function copyCoordinate([longitude, latitude]: readonly [number, number]): RecoveryCoordinate { return [longitude, latitude]; }
function copyCoordinates(values: readonly (readonly [number, number])[]): RecoveryCoordinate[] { return values.map(copyCoordinate); }
function copyTemporal(value: TemporalAssessment): TemporalAssessment { return { ...value }; }
function copyCargoContinuity(value: CargoContinuityAssessment): CargoContinuityAssessment {
  if (value.status === "UNKNOWN") return { ...value };
  const facts = { referenceFacts: { ...value.referenceFacts }, optionFacts: { ...value.optionFacts } };
  return value.status === "FAIL" ? { ...value, ...facts, mismatchReasonCodes: [...value.mismatchReasonCodes] } : { ...value, ...facts };
}
function deepFreeze<T>(value: T): T { if (typeof value === "object" && value !== null && !Object.isFrozen(value)) { for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child); Object.freeze(value); } return value; }

export function createUnit211RecoveryComparisonModel(result: Unit211PreDispatchContextResult, locale: Locale): Unit211RecoveryComparisonState {
  if (!result.ok) return Object.freeze({ kind: "operation-failure", reasonCode: result.reasonCode });
  const copy = recoveryComparisonCopy(locale); const { context, incident, options } = result.data; const [current, alternative] = options; const assessment = current.clearanceAssessment.data;
  return deepFreeze({
    kind: "ready",
    scenarioClock: { ...context.scenarioClock },
    vehicle: { id: context.unit.vehicleId, displayLabel: formatUnitLabel(context.unit.fleetNumber), fleetNumber: context.unit.fleetNumber, location: context.origin.name, state: context.isRouteStarted ? copy.routeStarted : copy.beforeDeparture, position: copyCoordinate(context.position.coordinates) },
    incident: { id: incident.id, riskId: incident.riskId, position: copyCoordinate(incident.point.coordinates), restrictionMeters: assessment.restrictionLimitMeters, exclusionRadiusMeters: alternative.provenance.avoidance.radiusMeters, exclusionCoordinates: copyCoordinates(incident.exclusionPolygon.coordinates[0]) },
    clearance: { vehicleHeightMeters: assessment.vehicleHeightMeters, humanBufferMeters: assessment.clearanceBufferMeters, requiredMeters: assessment.requiredClearanceMeters, status: assessment.status, reasonCode: assessment.reasonCode, equation: `${formatDecimal(assessment.vehicleHeightMeters, locale, 2)} + ${formatDecimal(assessment.clearanceBufferMeters, locale, 2)} = ${formatDecimal(assessment.requiredClearanceMeters, locale, 2)} ${copy.requiredSuffix}` },
    current: { id: current.routeId, status: current.disposition, statusLabel: statusLabel(current.disposition, locale), coordinates: copyCoordinates(current.geometry.coordinates), distance: formatDistance(current.summary.distanceMeters, locale), duration: formatDuration(current.summary.durationSeconds, locale), ...current.summary, temporal: copyTemporal(current.temporalAssessment), cargoContinuity: copyCargoContinuity(current.cargoContinuityAssessment) },
    alternative: { id: alternative.alternativeRouteId, status: alternative.disposition, statusLabel: statusLabel(alternative.disposition, locale), avoidsExclusionZone: alternative.avoidsExclusionZone, coordinates: copyCoordinates(alternative.geometry.coordinates), distance: formatDistance(alternative.summary.distanceMeters, locale), duration: formatDuration(alternative.summary.durationSeconds, locale), ...alternative.summary, temporal: copyTemporal(alternative.temporalAssessment), cargoContinuity: copyCargoContinuity(alternative.cargoContinuityAssessment) },
  });
}
