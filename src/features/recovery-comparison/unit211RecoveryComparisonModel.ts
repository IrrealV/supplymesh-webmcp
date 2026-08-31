import type { Unit211PreDispatchContextFailureReason, Unit211PreDispatchContextResult } from "../../domain/operations/unit211PreDispatchContext";
import { recoveryComparisonCopy, type Locale } from "../../preferences/i18n/catalog";

export type PreviewCoordinate = readonly [number, number];
type PreDispatchData = Extract<Unit211PreDispatchContextResult, { ok: true }>["data"];
type PreviewRoute<Status extends string> = Readonly<{ id: string; status: Status; statusLabel: string; coordinates: readonly PreviewCoordinate[]; distance: string; duration: string; distanceMeters: number; durationSeconds: number }>;
export type Unit211RecoveryPreviewModel = Readonly<{
  kind: "ready";
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
export type RecoveryCoordinate = PreviewCoordinate;
export type Unit211RecoveryComparisonModel = Unit211RecoveryPreviewModel;
export type Unit211RecoveryComparisonState = Unit211RecoveryPreviewState;

function formatDecimal(value: number, locale: Locale, digits: number): string { return new Intl.NumberFormat(locale === "es" ? "es-ES" : "en-GB", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value); }
function formatDistance(value: number, locale: Locale): string { return `${formatDecimal(value / 1_000, locale, 1)} km`; }
function formatDuration(value: number, locale: Locale): string { const hours = Math.floor(value / 3_600); const minutes = Math.floor((value % 3_600) / 60); const seconds = value - hours * 3_600 - minutes * 60; return `${hours} h ${minutes} min ${formatDecimal(seconds, locale, Number.isInteger(seconds) ? 0 : 1)} s`; }
function formatDelta(value: number, format: (absoluteValue: number) => string, decrease: string, increase: string, noChange: string): string { return value === 0 ? noChange : `${format(Math.abs(value))} ${value > 0 ? decrease : increase}`; }
function formatUnitLabel(fleetNumber: string): string { return `Unit ${fleetNumber.replace(/^FM-/, "")}`; }
function statusLabel(value: string, locale: Locale): string { const copy = recoveryComparisonCopy(locale); if (value === "REJECTED") return copy.rejected; if (value === ["SUPPORTED", "FOR", "COMPARISON"].join("_")) return copy.supported; const normalized = value.toLowerCase().replaceAll("_", " "); return normalized.length === 0 ? "" : `${normalized[0].toUpperCase()}${normalized.slice(1)}`; }
function copyCoordinate([longitude, latitude]: readonly [number, number]): RecoveryCoordinate { return [longitude, latitude]; }
function copyCoordinates(values: readonly (readonly [number, number])[]): RecoveryCoordinate[] { return values.map(copyCoordinate); }
function deepFreeze<T>(value: T): T { if (typeof value === "object" && value !== null && !Object.isFrozen(value)) { for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child); Object.freeze(value); } return value; }

export function createUnit211RecoveryComparisonModel(result: Unit211PreDispatchContextResult, locale: Locale): Unit211RecoveryComparisonState {
  if (!result.ok) return Object.freeze({ kind: "operation-failure", reasonCode: result.reasonCode });
  const copy = recoveryComparisonCopy(locale);
  const { context, incident, options } = result.data; const [current, alternative] = options; const assessment = current.clearanceAssessment.data;
  const horizontalSeparationMeters = alternative.provenance.avoidance.minimumClearanceMeters;
  const distanceDeltaMeters = current.summary.distanceMeters - alternative.summary.distanceMeters;
  const durationDeltaSeconds = current.summary.durationSeconds - alternative.summary.durationSeconds;
  return deepFreeze({
    kind: "ready",
    scenarioClock: { ...context.scenarioClock },
    vehicle: { id: context.unit.vehicleId, displayLabel: formatUnitLabel(context.unit.fleetNumber), fleetNumber: context.unit.fleetNumber, location: context.origin.name, state: context.isRouteStarted ? copy.routeStarted : copy.beforeDeparture, position: copyCoordinate(context.position.coordinates) },
    incident: { id: incident.id, riskId: incident.riskId, position: copyCoordinate(incident.point.coordinates), restrictionMeters: assessment.restrictionLimitMeters, exclusionRadiusMeters: alternative.provenance.avoidance.radiusMeters, horizontalSeparationMeters, horizontalSeparation: formatDistance(horizontalSeparationMeters, locale), exclusionCoordinates: copyCoordinates(incident.exclusionPolygon.coordinates[0]) },
    clearance: { vehicleHeightMeters: assessment.vehicleHeightMeters, humanBufferMeters: assessment.clearanceBufferMeters, requiredMeters: assessment.requiredClearanceMeters, status: assessment.status, reasonCode: assessment.reasonCode, equation: `${formatDecimal(assessment.vehicleHeightMeters, locale, 2)} + ${formatDecimal(assessment.clearanceBufferMeters, locale, 2)} = ${formatDecimal(assessment.requiredClearanceMeters, locale, 2)} ${copy.requiredSuffix}` },
    current: { id: current.routeId, status: current.disposition, statusLabel: statusLabel(current.disposition, locale), coordinates: copyCoordinates(current.geometry.coordinates), distance: formatDistance(current.summary.distanceMeters, locale), duration: formatDuration(current.summary.durationSeconds, locale), ...current.summary },
    alternative: { id: alternative.alternativeRouteId, status: alternative.disposition, statusLabel: statusLabel(alternative.disposition, locale), avoidsExclusionZone: alternative.avoidsExclusionZone, coordinates: copyCoordinates(alternative.geometry.coordinates), distance: formatDistance(alternative.summary.distanceMeters, locale), duration: formatDuration(alternative.summary.durationSeconds, locale), ...alternative.summary },
    delta: { distance: formatDelta(distanceDeltaMeters, (value) => formatDistance(value, locale), copy.shorter, copy.longer, copy.noChange), duration: formatDelta(durationDeltaSeconds, (value) => `${formatDecimal(value, locale, 1)} s`, copy.faster, copy.slower, copy.noChange) },
    resolvedRisks: [`${assessment.reasonCode}: ${copy.keepCurrent} · ${copy.rejected}.`, `${alternative.relation.avoidsRiskId}: ${alternative.avoidsExclusionZone ? copy.alternativeAvoids : copy.alternativeAvoidanceUnknown}`, `${copy.exclusionZone}: ${formatDistance(horizontalSeparationMeters, locale)}.`],
    unknownData: [],
  });
}
