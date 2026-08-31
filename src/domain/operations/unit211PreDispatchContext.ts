import type { OperatingRegion, RouteSummary } from "../entities";
import type { ScenarioRepository } from "../ports/ScenarioRepository";
import { createAssessAuthoritativeVerticalClearance, type AuthoritativeVerticalClearanceAssessmentResult } from "./authoritativeVerticalAssessment";

const VEHICLE_ID = "vehicle-011";
const FLEET_NUMBER = "FM-211";
const ROUTE_ID = "route-011";
const RISK_ID = "restriction-height-3.9";
const ALTERNATIVE_ROUTE_ID = "alternative-route-011-clearance-v1";
const COORDINATE_COUNT_MAX = 10_000;
const PRE_DISPATCH_ROUTE_PROGRESS = 0;

type Coordinate = [number, number];
type PointGeometry = { type: "Point"; coordinates: Coordinate };
type LineGeometry = { type: "LineString"; coordinates: Coordinate[] };
type PolygonGeometry = { type: "Polygon"; coordinates: Coordinate[][] };
type RejectedAssessment = Extract<AuthoritativeVerticalClearanceAssessmentResult, { ok: true }>;
type AlternativeRelation = { vehicleId: string; currentRouteId: string; avoidsRiskId: string; alternativeRouteId: string };
type Avoidance = { shape: string; radiusMeters: number; steps: number; minimumClearanceMeters: number; polygon: PolygonGeometry };
type AlternativeProvenance = { provider: string; profile: string; sourceRevision: string; generatedAt: string; avoidance: Avoidance };
type TemporalFacts = { remainingRouteMinutes: number; remainingDriveMinutes: number; estimatedCompletionAt: string; restDeadline: string };
type NullableTemporalFacts = { [Key in keyof TemporalFacts]: TemporalFacts[Key] | null };
type TemporalAssessment =
  | (TemporalFacts & { status: "PASS"; reasonCode: "TEMPORAL_WINDOW_SATISFIED" })
  | (TemporalFacts & { status: "FAIL"; reasonCode: "DRIVE_TIME_VIOLATION" | "REST_DEADLINE_VIOLATION" | "DRIVE_TIME_AND_REST_DEADLINE_VIOLATION" })
  | (NullableTemporalFacts & { status: "UNKNOWN"; reasonCode: "TEMPORAL_SOURCE_INVALID" });

export type Unit211PreDispatchContextFailureReason =
  | "SCENARIO_INVALID" | "UNIT_211_INVALID" | "CURRENT_ROUTE_INVALID" | "CURRENT_RISK_INVALID" | "TEMPORAL_SOURCE_INVALID"
  | "AUTHORITATIVE_CLEARANCE_ASSESSMENT_FAILED" | "CURRENT_ROUTE_UNEXPECTEDLY_NOT_REJECTED" | "ROUTE_011_INCIDENT_SNAP_INVALID"
  | "ALTERNATIVE_SOURCE_UNAVAILABLE" | "ALTERNATIVE_RELATION_INVALID" | "ALTERNATIVE_GEOMETRY_INVALID"
  | "ALTERNATIVE_SUMMARY_INVALID" | "ALTERNATIVE_PROVENANCE_INVALID" | "ALTERNATIVE_AVOIDANCE_INVALID" | "ALTERNATIVE_ADMISSION_INVALID";

type Unit211PreDispatchContext = {
  scenarioClock: { instant: "2026-08-28T09:00:00.000Z"; mode: "deterministic-demo" };
  unit: { vehicleId: "vehicle-011"; fleetNumber: "FM-211" };
  origin: { name: "Toledo" };
  currentRouteId: "route-011";
  routeProgress: 0;
  isRouteStarted: false;
  position: PointGeometry;
  temporalSource: { remainingDriveMinutes: number; restDeadline: string };
};

type Unit211PreDispatchData = {
  context: Unit211PreDispatchContext;
  incident: { id: "incident-route-011-restriction-height-3.9"; vehicleId: "vehicle-011"; riskId: "restriction-height-3.9"; routeId: "route-011"; snapIndex: number; point: PointGeometry; exclusionPolygon: PolygonGeometry };
  options: [
    { kind: "CURRENT"; disposition: "REJECTED"; routeId: "route-011"; geometry: LineGeometry; summary: RouteSummary; clearanceAssessment: RejectedAssessment; temporalAssessment: TemporalAssessment },
    { kind: "ALTERNATIVE"; disposition: "SUPPORTED_FOR_COMPARISON"; alternativeRouteId: "alternative-route-011-clearance-v1"; geometry: LineGeometry; summary: RouteSummary; relation: AlternativeRelation; provenance: AlternativeProvenance; avoidsExclusionZone: true; temporalAssessment: TemporalAssessment },
  ];
};

export type Unit211PreDispatchContextResult =
  | { ok: true; data: Unit211PreDispatchData }
  | { ok: false; reasonCode: Unit211PreDispatchContextFailureReason };

type Validation<T> = { ok: true; data: T } | Extract<Unit211PreDispatchContextResult, { ok: false }>;
type CurrentSource = { scenario: OperatingRegion; geometry: LineGeometry; summary: RouteSummary; remainingDriveMinutes: number; restDeadline: string; routeSnaps: unknown };
type AlternativeSource = { relation: AlternativeRelation; geometry: LineGeometry; summary: RouteSummary; provenance: AlternativeProvenance };

function failure(reasonCode: Unit211PreDispatchContextFailureReason): Extract<Unit211PreDispatchContextResult, { ok: false }> {
  return { ok: false, reasonCode };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isZero(value: unknown): value is 0 {
  return typeof value === "number" && Object.is(value, 0);
}

function isCoordinate(value: unknown): value is Coordinate {
  return Array.isArray(value) && value.length === 2 && value.every((entry: unknown) => typeof entry === "number" && Number.isFinite(entry));
}

function copyCoordinates(value: unknown, countMin: number): Coordinate[] | false {
  if (!Array.isArray(value) || value.length < countMin || value.length > COORDINATE_COUNT_MAX) return false;
  const coordinates: Coordinate[] = [];
  for (const entry of value) {
    if (!isCoordinate(entry)) return false;
    coordinates.push([entry[0], entry[1]]);
  }
  return coordinates;
}

function copyLineGeometry(value: unknown): LineGeometry | false {
  if (!isRecord(value) || value.type !== "LineString") return false;
  const coordinates = copyCoordinates(value.coordinates, 2);
  return coordinates === false ? false : { type: "LineString", coordinates };
}

function copyPolygonGeometry(value: unknown): PolygonGeometry | false {
  if (!isRecord(value) || value.type !== "Polygon" || !Array.isArray(value.coordinates) || value.coordinates.length === 0 || value.coordinates.length > 16) return false;
  const rings: Coordinate[][] = [];
  for (const ring of value.coordinates) {
    const coordinates = copyCoordinates(ring, 4);
    if (coordinates === false) return false;
    const first = coordinates[0]; const last = coordinates.at(-1);
    if (last === undefined || first[0] !== last[0] || first[1] !== last[1]) return false;
    rings.push(coordinates);
  }
  return { type: "Polygon", coordinates: rings };
}

function copySummary(value: unknown): RouteSummary | false {
  if (!isRecord(value) || !isPositiveFinite(value.distanceMeters) || !isPositiveFinite(value.durationSeconds)) return false;
  return { distanceMeters: value.distanceMeters, durationSeconds: value.durationSeconds };
}

function instantMilliseconds(value: unknown): number | false {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  const milliseconds = Date.parse(value); const canonical = value.includes(".") ? value : value.replace("Z", ".000Z");
  if (!Number.isFinite(milliseconds)) return false;
  const instant = new Date(milliseconds);
  return Number.isFinite(instant.getTime()) && instant.toISOString() === canonical ? milliseconds : false;
}

function isIsoInstant(value: unknown): value is string {
  return instantMilliseconds(value) !== false;
}

function temporalAssessment(context: Unit211PreDispatchContext, durationSeconds: number): TemporalAssessment {
  const scenarioClockMilliseconds = instantMilliseconds(context.scenarioClock.instant);
  const restDeadlineMilliseconds = instantMilliseconds(context.temporalSource.restDeadline);
  const isProgressValid = isZero(context.routeProgress);
  const remainingDriveMinutes = Number.isFinite(context.temporalSource.remainingDriveMinutes) && context.temporalSource.remainingDriveMinutes >= 0 ? context.temporalSource.remainingDriveMinutes : null;
  const restDeadline = restDeadlineMilliseconds === false ? null : context.temporalSource.restDeadline;
  let remainingRouteSeconds: number | null = null;
  let remainingRouteMinutes: number | null = null;
  if (Number.isFinite(durationSeconds) && durationSeconds > 0 && isProgressValid) {
    const seconds = durationSeconds * (1 - context.routeProgress);
    const minutes = seconds / 60;
    if (Number.isFinite(seconds) && seconds > 0 && Number.isFinite(minutes) && minutes > 0) {
      remainingRouteSeconds = seconds; remainingRouteMinutes = minutes;
    }
  }
  let completionDeltaMilliseconds: number | null = null;
  if (remainingRouteSeconds !== null) {
    const milliseconds = remainingRouteSeconds * 1_000;
    if (Number.isFinite(milliseconds) && milliseconds > 0 && Number.isSafeInteger(milliseconds)) completionDeltaMilliseconds = milliseconds;
  }
  let estimatedCompletionMilliseconds: number | null = null;
  let estimatedCompletionAt: string | null = null;
  if (scenarioClockMilliseconds !== false && completionDeltaMilliseconds !== null) {
    const milliseconds = scenarioClockMilliseconds + completionDeltaMilliseconds;
    if (Number.isFinite(milliseconds) && Number.isSafeInteger(milliseconds) && milliseconds > scenarioClockMilliseconds && milliseconds - scenarioClockMilliseconds === completionDeltaMilliseconds) {
      const instant = new Date(milliseconds);
      if (instant.getTime() === milliseconds) {
        const isoInstant = instant.toISOString();
        if (instantMilliseconds(isoInstant) === milliseconds) {
          estimatedCompletionMilliseconds = milliseconds; estimatedCompletionAt = isoInstant;
        }
      }
    }
  }
  const facts = { remainingRouteMinutes, remainingDriveMinutes, estimatedCompletionAt, restDeadline };
  if (scenarioClockMilliseconds === false || restDeadlineMilliseconds === false || restDeadlineMilliseconds < scenarioClockMilliseconds || remainingRouteMinutes === null || remainingDriveMinutes === null || completionDeltaMilliseconds === null || estimatedCompletionMilliseconds === null || estimatedCompletionAt === null || restDeadline === null) {
    return { ...facts, status: "UNKNOWN", reasonCode: "TEMPORAL_SOURCE_INVALID" };
  }
  const knownFacts: TemporalFacts = { remainingRouteMinutes, remainingDriveMinutes, estimatedCompletionAt, restDeadline };
  const isDriveTimeViolated = remainingRouteMinutes > remainingDriveMinutes;
  const isRestDeadlineViolated = estimatedCompletionMilliseconds > restDeadlineMilliseconds;
  if (!isDriveTimeViolated && !isRestDeadlineViolated) return { ...knownFacts, status: "PASS", reasonCode: "TEMPORAL_WINDOW_SATISFIED" };
  if (isDriveTimeViolated && isRestDeadlineViolated) return { ...knownFacts, status: "FAIL", reasonCode: "DRIVE_TIME_AND_REST_DEADLINE_VIOLATION" };
  return { ...knownFacts, status: "FAIL", reasonCode: isDriveTimeViolated ? "DRIVE_TIME_VIOLATION" : "REST_DEADLINE_VIOLATION" };
}

function validateCurrentSource(value: unknown): Validation<CurrentSource> {
  if (!isRecord(value) || value.id !== "spain-v1" || !Array.isArray(value.vehicles) || !Array.isArray(value.routes) || !Array.isArray(value.risks)) return failure("SCENARIO_INVALID");
  const scenario = value as OperatingRegion;
  const units = scenario.vehicles.filter((candidate: unknown) => isRecord(candidate) && candidate.internalId === VEHICLE_ID);
  if (units.length !== 1) return failure("UNIT_211_INVALID");
  const unit = units[0];
  if (unit.fleetNumber !== FLEET_NUMBER || unit.routeId !== ROUTE_ID || !isRecord(unit.origin) || unit.origin.name !== "Toledo") return failure("UNIT_211_INVALID");
  if (typeof unit.routeProgress !== "number" || !Number.isFinite(unit.routeProgress) || unit.routeProgress < 0 || unit.routeProgress > 1) return failure("TEMPORAL_SOURCE_INVALID");
  if (!isRecord(unit.timing) || typeof unit.timing.remainingDriveMinutes !== "number" || !Number.isFinite(unit.timing.remainingDriveMinutes) || unit.timing.remainingDriveMinutes < 0 || !isIsoInstant(unit.timing.restDeadline)) return failure("TEMPORAL_SOURCE_INVALID");
  const routes = scenario.routes.filter((candidate: unknown) => isRecord(candidate) && candidate.id === ROUTE_ID);
  if (routes.length !== 1) return failure("CURRENT_ROUTE_INVALID");
  const route = routes[0];
  if (route.vehicleId !== VEHICLE_ID || !isRecord(route.geometry) || route.geometry.type !== "Feature" || !isRecord(route.geometry.geometry)) return failure("CURRENT_ROUTE_INVALID");
  const geometry = copyLineGeometry(route.geometry.geometry); const summary = copySummary(route.summary);
  if (geometry === false || summary === false) return failure("CURRENT_ROUTE_INVALID");
  const risks = scenario.risks.filter((candidate: unknown) => isRecord(candidate) && candidate.id === RISK_ID);
  if (risks.length !== 1) return failure("CURRENT_RISK_INVALID");
  return { ok: true, data: { scenario, geometry, summary, remainingDriveMinutes: unit.timing.remainingDriveMinutes, restDeadline: unit.timing.restDeadline, routeSnaps: route.riskSnaps } };
}

function validateAlternativeSource(value: unknown): Validation<AlternativeSource> {
  if (!isRecord(value)) return failure("ALTERNATIVE_SOURCE_UNAVAILABLE");
  if (!isRecord(value.relation)) return failure("ALTERNATIVE_RELATION_INVALID");
  const relation = value.relation;
  if (relation.vehicleId !== VEHICLE_ID || relation.currentRouteId !== ROUTE_ID || relation.avoidsRiskId !== RISK_ID || relation.alternativeRouteId !== ALTERNATIVE_ROUTE_ID) return failure("ALTERNATIVE_RELATION_INVALID");
  const geometry = copyLineGeometry(value.geometry);
  if (geometry === false) return failure("ALTERNATIVE_GEOMETRY_INVALID");
  const summary = copySummary(value.summary);
  if (summary === false) return failure("ALTERNATIVE_SUMMARY_INVALID");
  if (!isRecord(value.provenance)) return failure("ALTERNATIVE_PROVENANCE_INVALID");
  const provenance = value.provenance;
  if (typeof provenance.provider !== "string" || provenance.provider.length === 0 || typeof provenance.profile !== "string" || provenance.profile.length === 0 || typeof provenance.sourceRevision !== "string" || !/^[a-f0-9]{64}$/.test(provenance.sourceRevision) || !isIsoInstant(provenance.generatedAt)) return failure("ALTERNATIVE_PROVENANCE_INVALID");
  if (!isRecord(provenance.avoidance)) return failure("ALTERNATIVE_AVOIDANCE_INVALID");
  const avoidance = provenance.avoidance; const polygon = copyPolygonGeometry(avoidance.polygon);
  if (avoidance.shape !== "geodesic-circle" || !isPositiveFinite(avoidance.radiusMeters) || typeof avoidance.steps !== "number" || !Number.isInteger(avoidance.steps) || avoidance.steps < 3 || !isPositiveFinite(avoidance.minimumClearanceMeters) || polygon === false) return failure("ALTERNATIVE_AVOIDANCE_INVALID");
  return { ok: true, data: {
    relation: { vehicleId: VEHICLE_ID, currentRouteId: ROUTE_ID, avoidsRiskId: RISK_ID, alternativeRouteId: ALTERNATIVE_ROUTE_ID }, geometry, summary,
    provenance: { provider: provenance.provider, profile: provenance.profile, sourceRevision: provenance.sourceRevision, generatedAt: provenance.generatedAt, avoidance: { shape: avoidance.shape, radiusMeters: avoidance.radiusMeters, steps: avoidance.steps, minimumClearanceMeters: avoidance.minimumClearanceMeters, polygon } },
  } };
}

function incidentFrom(routeSnaps: unknown, geometry: LineGeometry): { snapIndex: number; point: PointGeometry } | false {
  if (!Array.isArray(routeSnaps)) return false;
  const matches = routeSnaps.filter((snap: unknown) => isRecord(snap) && snap.riskId === RISK_ID && snap.routeId === ROUTE_ID);
  if (matches.length !== 1) return false;
  const snap = matches[0]; const index = snap.startIndex;
  if (snap.kind !== "point" || typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= geometry.coordinates.length || snap.endIndex !== index || !isCoordinate(snap.startCoordinate) || !isCoordinate(snap.endCoordinate)) return false;
  const coordinate = geometry.coordinates[index];
  if (snap.startCoordinate[0] !== coordinate[0] || snap.startCoordinate[1] !== coordinate[1] || snap.endCoordinate[0] !== coordinate[0] || snap.endCoordinate[1] !== coordinate[1]) return false;
  return { snapIndex: index, point: { type: "Point", coordinates: [coordinate[0], coordinate[1]] } };
}

function isExactRejection(assessment: RejectedAssessment): boolean {
  const { data } = assessment;
  return data.vehicleId === VEHICLE_ID && data.riskId === RISK_ID && data.routeId === ROUTE_ID && data.vehicleHeightMeters === 3.8 && data.clearanceBufferMeters === 0.2 && data.requiredClearanceMeters === 4 && data.restrictionLimitMeters === 3.9 && data.status === "FAIL" && data.reasonCode === "CLEARANCE_VIOLATION";
}

export function createUnit211PreDispatchContext(repository: Pick<ScenarioRepository, "scenarioCurrent">, readAlternativeCatalog: () => unknown, admittedAlternativeCatalog: unknown): () => Unit211PreDispatchContextResult {
  return () => {
    let scenarioValue: unknown; let alternativeValue: unknown;
    try { scenarioValue = repository.scenarioCurrent(); } catch { scenarioValue = false; }
    try { alternativeValue = readAlternativeCatalog(); } catch { alternativeValue = false; }
    let current: Validation<CurrentSource>;
    try { current = validateCurrentSource(scenarioValue); } catch { return failure("SCENARIO_INVALID"); }
    if (!current.ok) return current;
    let incident: ReturnType<typeof incidentFrom>;
    try { incident = incidentFrom(current.data.routeSnaps, current.data.geometry); } catch { return failure("ROUTE_011_INCIDENT_SNAP_INVALID"); }
    if (incident === false) return failure("ROUTE_011_INCIDENT_SNAP_INVALID");
    let clearanceAssessment: AuthoritativeVerticalClearanceAssessmentResult;
    try { clearanceAssessment = createAssessAuthoritativeVerticalClearance({ scenarioCurrent: () => current.data.scenario })({ vehicleId: VEHICLE_ID, riskId: RISK_ID, clearanceBufferMeters: 0.2 }); } catch { return failure("AUTHORITATIVE_CLEARANCE_ASSESSMENT_FAILED"); }
    if (!clearanceAssessment.ok) return failure("AUTHORITATIVE_CLEARANCE_ASSESSMENT_FAILED");
    if (clearanceAssessment.data.status !== "FAIL") return failure("CURRENT_ROUTE_UNEXPECTEDLY_NOT_REJECTED");
    if (!isExactRejection(clearanceAssessment)) return failure("AUTHORITATIVE_CLEARANCE_ASSESSMENT_FAILED");
    let alternative: Validation<AlternativeSource>;
    try { alternative = validateAlternativeSource(alternativeValue); } catch { return failure("ALTERNATIVE_SOURCE_UNAVAILABLE"); }
    if (!alternative.ok) return alternative;
    if (alternativeValue !== admittedAlternativeCatalog) return failure("ALTERNATIVE_ADMISSION_INVALID");
    const firstCoordinate = current.data.geometry.coordinates[0]; const exclusionPolygon = alternative.data.provenance.avoidance.polygon;
    const context: Unit211PreDispatchContext = { scenarioClock: { instant: "2026-08-28T09:00:00.000Z", mode: "deterministic-demo" }, unit: { vehicleId: VEHICLE_ID, fleetNumber: FLEET_NUMBER }, origin: { name: "Toledo" }, currentRouteId: ROUTE_ID, routeProgress: PRE_DISPATCH_ROUTE_PROGRESS, isRouteStarted: false, position: { type: "Point", coordinates: [firstCoordinate[0], firstCoordinate[1]] }, temporalSource: { remainingDriveMinutes: current.data.remainingDriveMinutes, restDeadline: current.data.restDeadline } };
    return { ok: true, data: {
      context,
      incident: { id: "incident-route-011-restriction-height-3.9", vehicleId: VEHICLE_ID, riskId: RISK_ID, routeId: ROUTE_ID, snapIndex: incident.snapIndex, point: incident.point, exclusionPolygon },
      options: [
        { kind: "CURRENT", disposition: "REJECTED", routeId: ROUTE_ID, geometry: current.data.geometry, summary: current.data.summary, clearanceAssessment, temporalAssessment: temporalAssessment(context, current.data.summary.durationSeconds) },
        { kind: "ALTERNATIVE", disposition: "SUPPORTED_FOR_COMPARISON", alternativeRouteId: ALTERNATIVE_ROUTE_ID, geometry: alternative.data.geometry, summary: alternative.data.summary, relation: alternative.data.relation, provenance: alternative.data.provenance, avoidsExclusionZone: true, temporalAssessment: temporalAssessment(context, alternative.data.summary.durationSeconds) },
      ],
    } };
  };
}
