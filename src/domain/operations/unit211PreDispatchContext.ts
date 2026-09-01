import type { Cargo, OperatingRegion, Route, RouteSummary, Vehicle } from "../entities";
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
export type Unit211RejectedClearanceAssessment = Extract<AuthoritativeVerticalClearanceAssessmentResult, { ok: true }>;
export type Unit211AlternativeRelation = { vehicleId: string; currentRouteId: string; avoidsRiskId: string; alternativeRouteId: string };
export type Unit211AvoidanceEvidence = { shape: string; radiusMeters: number; steps: number; minimumClearanceMeters: number; polygon: PolygonGeometry };
export type Unit211AlternativeProvenance = { provider: string; profile: string; sourceRevision: string; generatedAt: string; avoidance: Unit211AvoidanceEvidence };
type TemporalFacts = { remainingRouteMinutes: number; remainingDriveMinutes: number; estimatedCompletionAt: string; restDeadline: string };
type NullableTemporalFacts = { [Key in keyof TemporalFacts]: TemporalFacts[Key] | null };
export type Unit211TemporalAssessment =
  | (TemporalFacts & { status: "PASS"; reasonCode: "TEMPORAL_WINDOW_SATISFIED" })
  | (TemporalFacts & { status: "FAIL"; reasonCode: "DRIVE_TIME_VIOLATION" | "REST_DEADLINE_VIOLATION" | "DRIVE_TIME_AND_REST_DEADLINE_VIOLATION" })
  | (NullableTemporalFacts & { status: "UNKNOWN"; reasonCode: "TEMPORAL_SOURCE_INVALID" });
export type Unit211CargoContinuityFacts = { vehicleId: string; cargoId: string; destinationId: string; refrigeration: Cargo["refrigeration"]; priority: Cargo["priority"] };
type CargoContinuityMismatchReasonCode = "VEHICLE_ID_MISMATCH" | "CARGO_ID_MISMATCH" | "DESTINATION_ID_MISMATCH" | "REFRIGERATION_MISMATCH" | "PRIORITY_MISMATCH";
type CargoContinuitySourceReasonCode = "VEHICLE_MISSING" | "VEHICLE_ID_INVALID" | "VEHICLE_ID_AMBIGUOUS" | "CARGO_ID_INVALID" | "CARGO_ID_AMBIGUOUS" | "DESTINATION_ID_INVALID" | "REFRIGERATION_INVALID" | "PRIORITY_INVALID";
export type Unit211CargoContinuityAssessment =
  | { status: "PASS"; reasonCode: "CARGO_CONTINUITY_SATISFIED"; referenceFacts: Unit211CargoContinuityFacts; optionFacts: Unit211CargoContinuityFacts }
  | { status: "FAIL"; reasonCode: "CARGO_CONTINUITY_MISMATCH"; mismatchReasonCodes: CargoContinuityMismatchReasonCode[]; referenceFacts: Unit211CargoContinuityFacts; optionFacts: Unit211CargoContinuityFacts }
  | { status: "UNKNOWN"; reasonCode: "CARGO_CONTINUITY_SOURCE_INVALID"; source: "SCENARIO" | "REFERENCE" | "OPTION"; sourceReasonCode: CargoContinuitySourceReasonCode };

export type Unit211PreDispatchContextFailureReason =
  | "SCENARIO_INVALID" | "UNIT_211_INVALID" | "CURRENT_ROUTE_INVALID" | "CURRENT_RISK_INVALID" | "TEMPORAL_SOURCE_INVALID"
  | "AUTHORITATIVE_CLEARANCE_ASSESSMENT_FAILED" | "CURRENT_ROUTE_UNEXPECTEDLY_NOT_REJECTED" | "ROUTE_011_INCIDENT_SNAP_INVALID"
  | "ALTERNATIVE_SOURCE_UNAVAILABLE" | "ALTERNATIVE_RELATION_INVALID" | "ALTERNATIVE_GEOMETRY_INVALID"
  | "ALTERNATIVE_SUMMARY_INVALID" | "ALTERNATIVE_PROVENANCE_INVALID" | "ALTERNATIVE_AVOIDANCE_INVALID" | "ALTERNATIVE_ADMISSION_INVALID";

export type Unit211PreDispatchContext = {
  scenarioClock: { instant: "2026-08-28T09:00:00.000Z"; mode: "deterministic-demo" };
  unit: { vehicleId: "vehicle-011"; fleetNumber: "FM-211" };
  origin: { name: "Toledo" };
  currentRouteId: "route-011";
  routeProgress: 0;
  isRouteStarted: false;
  position: PointGeometry;
  temporalSource: { remainingDriveMinutes: number; restDeadline: string };
};

export type Unit211CurrentOption = { kind: "CURRENT"; disposition: "REJECTED"; routeId: "route-011"; geometry: LineGeometry; summary: RouteSummary; clearanceAssessment: Unit211RejectedClearanceAssessment; temporalAssessment: Unit211TemporalAssessment; cargoContinuityAssessment: Unit211CargoContinuityAssessment };
export type Unit211AlternativeOption = { kind: "ALTERNATIVE"; disposition: "SUPPORTED_FOR_COMPARISON"; alternativeRouteId: "alternative-route-011-clearance-v1"; geometry: LineGeometry; summary: RouteSummary; relation: Unit211AlternativeRelation; provenance: Unit211AlternativeProvenance; avoidsExclusionZone: true; temporalAssessment: Unit211TemporalAssessment; cargoContinuityAssessment: Unit211CargoContinuityAssessment };

export type Unit211PreDispatchData = {
  context: Unit211PreDispatchContext;
  incident: { id: "incident-route-011-restriction-height-3.9"; vehicleId: "vehicle-011"; riskId: "restriction-height-3.9"; routeId: "route-011"; snapIndex: number; point: PointGeometry; exclusionPolygon: PolygonGeometry };
  options: [
    Unit211CurrentOption,
    Unit211AlternativeOption,
  ];
};

export type Unit211PreDispatchContextResult =
  | { ok: true; data: Unit211PreDispatchData }
  | { ok: false; reasonCode: Unit211PreDispatchContextFailureReason };

type Validation<T> = { ok: true; data: T } | Extract<Unit211PreDispatchContextResult, { ok: false }>;
type CurrentSource = { scenario: OperatingRegion; identityIndex: IdentityIndex; vehicleId: string; geometry: LineGeometry; summary: RouteSummary; remainingDriveMinutes: number; restDeadline: string; routeSnaps: unknown };
type AlternativeSource = { relation: Unit211AlternativeRelation; geometry: LineGeometry; summary: RouteSummary; provenance: Unit211AlternativeProvenance };
type SourceValidation = { ok: true } | { ok: false; sourceReasonCode: CargoContinuitySourceReasonCode };
type CargoContinuityFactsValidation = { ok: true; data: Readonly<Unit211CargoContinuityFacts> } | { ok: false; sourceReasonCode: "VEHICLE_MISSING" };
type CapturedField = { ok: true; isDataProperty: boolean; value: unknown } | { ok: false };
type IdentityIndex = { validation: SourceValidation; factsByVehicleId: ReadonlyMap<string, Readonly<Unit211CargoContinuityFacts>>; sourcesByVehicleId: ReadonlyMap<string, readonly Vehicle[]>; normalizedVehicles: Vehicle[] };

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

function isStableId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value;
}

function isRefrigeration(value: unknown): value is Cargo["refrigeration"] {
  return value === "ambient" || value === "chilled" || value === "frozen";
}

function isPriority(value: unknown): value is Cargo["priority"] {
  return value === "standard" || value === "priority" || value === "critical";
}

function captureField(record: Record<string, unknown>, key: string): CapturedField {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(record, key); const value = record[key];
    return { ok: true, isDataProperty: descriptor !== undefined && "value" in descriptor, value };
  } catch {
    return { ok: false };
  }
}

function incrementCount(counts: Map<string, number>, id: string): void {
  counts.set(id, (counts.get(id) ?? 0) + 1);
}

function buildIdentityIndex(values: unknown[]): IdentityIndex {
  const sourcesByVehicleId = new Map<string, Vehicle[]>(); const cargoIdCounts = new Map<string, number>(); const normalizedVehicles: Vehicle[] = [];
  const candidates: Array<Readonly<Unit211CargoContinuityFacts>> = []; let sourceReasonCode: CargoContinuitySourceReasonCode | false = false;
  for (const value of values) {
    if (!isRecord(value)) { if (sourceReasonCode === false) sourceReasonCode = "VEHICLE_ID_INVALID"; continue; }
    const vehicleIdField = captureField(value, "internalId"); const cargoField = captureField(value, "cargo"); const destinationField = captureField(value, "destination");
    const cargo = cargoField.ok && isRecord(cargoField.value) ? cargoField.value : false; const destination = destinationField.ok && isRecord(destinationField.value) ? destinationField.value : false;
    const cargoIdField = cargo === false ? { ok: false } as const : captureField(cargo, "id");
    const refrigerationField = cargo === false ? { ok: false } as const : captureField(cargo, "refrigeration");
    const priorityField = cargo === false ? { ok: false } as const : captureField(cargo, "priority");
    const destinationIdField = destination === false ? { ok: false } as const : captureField(destination, "id");
    const vehicleId = vehicleIdField.ok && isStableId(vehicleIdField.value) ? vehicleIdField.value : false;
    const cargoId = cargoIdField.ok && isStableId(cargoIdField.value) ? cargoIdField.value : false;
    const destinationId = destinationIdField.ok && isStableId(destinationIdField.value) ? destinationIdField.value : false;
    const refrigeration = refrigerationField.ok && isRefrigeration(refrigerationField.value) ? refrigerationField.value : false;
    const priority = priorityField.ok && isPriority(priorityField.value) ? priorityField.value : false;
    const isVehicleIdValid = vehicleIdField.ok && vehicleIdField.isDataProperty && vehicleId !== false;
    const isCargoIdValid = cargoField.ok && cargoField.isDataProperty && cargo !== false && cargoIdField.ok && cargoIdField.isDataProperty && cargoId !== false;
    const isDestinationIdValid = destinationField.ok && destinationField.isDataProperty && destination !== false && destinationIdField.ok && destinationIdField.isDataProperty && destinationId !== false;
    const isRefrigerationValid = cargo !== false && refrigerationField.ok && refrigerationField.isDataProperty && refrigeration !== false;
    const isPriorityValid = cargo !== false && priorityField.ok && priorityField.isDataProperty && priority !== false;
    if (sourceReasonCode === false) sourceReasonCode = !isVehicleIdValid ? "VEHICLE_ID_INVALID" : !isCargoIdValid ? "CARGO_ID_INVALID" : !isDestinationIdValid ? "DESTINATION_ID_INVALID" : !isRefrigerationValid ? "REFRIGERATION_INVALID" : !isPriorityValid ? "PRIORITY_INVALID" : false;
    if (vehicleId !== false) {
      const source = value as Vehicle; const sources = sourcesByVehicleId.get(vehicleId);
      if (sources === undefined) sourcesByVehicleId.set(vehicleId, [source]); else sources.push(source);
      normalizedVehicles.push(new Proxy(source, { get: (target, property, receiver) => property === "internalId" ? vehicleId : Reflect.get(target, property, receiver) }));
    }
    if (cargoId !== false) incrementCount(cargoIdCounts, cargoId);
    if (isVehicleIdValid && isCargoIdValid && isDestinationIdValid && isRefrigerationValid && isPriorityValid) candidates.push(Object.freeze({ vehicleId, cargoId, destinationId, refrigeration, priority }));
  }
  if (sourceReasonCode === false && [...sourcesByVehicleId.values()].some((sources) => sources.length !== 1)) sourceReasonCode = "VEHICLE_ID_AMBIGUOUS";
  if (sourceReasonCode === false && [...cargoIdCounts.values()].some((count) => count !== 1)) sourceReasonCode = "CARGO_ID_AMBIGUOUS";
  const factsByVehicleId = new Map<string, Readonly<Unit211CargoContinuityFacts>>();
  for (const facts of candidates) if (sourcesByVehicleId.get(facts.vehicleId)?.length === 1 && cargoIdCounts.get(facts.cargoId) === 1) factsByVehicleId.set(facts.vehicleId, facts);
  return { validation: sourceReasonCode === false ? { ok: true } : { ok: false, sourceReasonCode }, factsByVehicleId, sourcesByVehicleId, normalizedVehicles };
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

function temporalAssessment(context: Unit211PreDispatchContext, durationSeconds: number): Unit211TemporalAssessment {
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

function cargoContinuityFacts(index: IdentityIndex, vehicleId: string): CargoContinuityFactsValidation {
  const facts = index.factsByVehicleId.get(vehicleId);
  return facts === undefined ? { ok: false, sourceReasonCode: "VEHICLE_MISSING" } : { ok: true, data: facts };
}

function cargoContinuityAssessment(scenarioValidation: SourceValidation, reference: CargoContinuityFactsValidation, option: CargoContinuityFactsValidation): Unit211CargoContinuityAssessment {
  if (!scenarioValidation.ok) return { status: "UNKNOWN", reasonCode: "CARGO_CONTINUITY_SOURCE_INVALID", source: "SCENARIO", sourceReasonCode: scenarioValidation.sourceReasonCode };
  if (!reference.ok) return { status: "UNKNOWN", reasonCode: "CARGO_CONTINUITY_SOURCE_INVALID", source: "REFERENCE", sourceReasonCode: reference.sourceReasonCode };
  if (!option.ok) return { status: "UNKNOWN", reasonCode: "CARGO_CONTINUITY_SOURCE_INVALID", source: "OPTION", sourceReasonCode: option.sourceReasonCode };
  const referenceFacts = { ...reference.data }; const optionFacts = { ...option.data };
  const mismatchReasonCodes: CargoContinuityMismatchReasonCode[] = [];
  if (referenceFacts.vehicleId !== optionFacts.vehicleId) mismatchReasonCodes.push("VEHICLE_ID_MISMATCH");
  if (referenceFacts.cargoId !== optionFacts.cargoId) mismatchReasonCodes.push("CARGO_ID_MISMATCH");
  if (referenceFacts.destinationId !== optionFacts.destinationId) mismatchReasonCodes.push("DESTINATION_ID_MISMATCH");
  if (referenceFacts.refrigeration !== optionFacts.refrigeration) mismatchReasonCodes.push("REFRIGERATION_MISMATCH");
  if (referenceFacts.priority !== optionFacts.priority) mismatchReasonCodes.push("PRIORITY_MISMATCH");
  return mismatchReasonCodes.length === 0
    ? { status: "PASS", reasonCode: "CARGO_CONTINUITY_SATISFIED", referenceFacts, optionFacts }
    : { status: "FAIL", reasonCode: "CARGO_CONTINUITY_MISMATCH", mismatchReasonCodes, referenceFacts, optionFacts };
}

function validateCurrentSource(value: unknown): Validation<CurrentSource> {
  if (!isRecord(value)) return failure("SCENARIO_INVALID");
  const scenarioIdField = captureField(value, "id"); const vehiclesField = captureField(value, "vehicles"); const routesField = captureField(value, "routes"); const risksField = captureField(value, "risks");
  if (!scenarioIdField.ok || !scenarioIdField.isDataProperty || scenarioIdField.value !== "spain-v1" || !vehiclesField.ok || !vehiclesField.isDataProperty || !Array.isArray(vehiclesField.value) || !routesField.ok || !routesField.isDataProperty || !Array.isArray(routesField.value) || !risksField.ok || !risksField.isDataProperty || !Array.isArray(risksField.value)) return failure("SCENARIO_INVALID");
  const identityIndex = buildIdentityIndex(vehiclesField.value); const units = identityIndex.sourcesByVehicleId.get(VEHICLE_ID) ?? [];
  if (units.length !== 1) return failure("UNIT_211_INVALID");
  const unit = units[0]; const routes = routesField.value; const risks = risksField.value;
  if (unit.fleetNumber !== FLEET_NUMBER || unit.routeId !== ROUTE_ID || !isRecord(unit.origin) || unit.origin.name !== "Toledo") return failure("UNIT_211_INVALID");
  if (typeof unit.routeProgress !== "number" || !Number.isFinite(unit.routeProgress) || unit.routeProgress < 0 || unit.routeProgress > 1) return failure("TEMPORAL_SOURCE_INVALID");
  if (!isRecord(unit.timing) || typeof unit.timing.remainingDriveMinutes !== "number" || !Number.isFinite(unit.timing.remainingDriveMinutes) || unit.timing.remainingDriveMinutes < 0 || !isIsoInstant(unit.timing.restDeadline)) return failure("TEMPORAL_SOURCE_INVALID");
  const currentRoutes = routes.filter((candidate: unknown) => isRecord(candidate) && candidate.id === ROUTE_ID);
  if (currentRoutes.length !== 1) return failure("CURRENT_ROUTE_INVALID");
  const route = currentRoutes[0]; const routeVehicleIdField = captureField(route, "vehicleId");
  if (!routeVehicleIdField.ok || !routeVehicleIdField.isDataProperty || !isStableId(routeVehicleIdField.value) || routeVehicleIdField.value !== VEHICLE_ID || !isRecord(route.geometry) || route.geometry.type !== "Feature" || !isRecord(route.geometry.geometry)) return failure("CURRENT_ROUTE_INVALID");
  const routeVehicleId = routeVehicleIdField.value;
  const geometry = copyLineGeometry(route.geometry.geometry); const summary = copySummary(route.summary);
  if (geometry === false || summary === false) return failure("CURRENT_ROUTE_INVALID");
  const currentRisks = risks.filter((candidate: unknown) => isRecord(candidate) && candidate.id === RISK_ID);
  if (currentRisks.length !== 1) return failure("CURRENT_RISK_INVALID");
  const normalizedRoute = new Proxy(route as Route, { get: (target, property, receiver) => property === "vehicleId" ? routeVehicleId : Reflect.get(target, property, receiver) });
  const scenario: OperatingRegion = { id: "spain-v1", name: "", vehicles: identityIndex.normalizedVehicles, routes: routes.map((candidate) => candidate === route ? normalizedRoute : candidate as Route), risks: risks as OperatingRegion["risks"] };
  return { ok: true, data: { scenario, identityIndex, vehicleId: routeVehicleId, geometry, summary, remainingDriveMinutes: unit.timing.remainingDriveMinutes, restDeadline: unit.timing.restDeadline, routeSnaps: route.riskSnaps } };
}

function validateAlternativeSource(value: unknown): Validation<AlternativeSource> {
  if (!isRecord(value)) return failure("ALTERNATIVE_SOURCE_UNAVAILABLE");
  const relationField = captureField(value, "relation");
  if (!relationField.ok) return failure("ALTERNATIVE_SOURCE_UNAVAILABLE");
  if (!relationField.isDataProperty || !isRecord(relationField.value)) return failure("ALTERNATIVE_RELATION_INVALID");
  const relation = relationField.value; const vehicleIdField = captureField(relation, "vehicleId"); const currentRouteIdField = captureField(relation, "currentRouteId"); const avoidsRiskIdField = captureField(relation, "avoidsRiskId"); const alternativeRouteIdField = captureField(relation, "alternativeRouteId");
  if (!vehicleIdField.ok || !vehicleIdField.isDataProperty || !isStableId(vehicleIdField.value) || !currentRouteIdField.ok || !currentRouteIdField.isDataProperty || currentRouteIdField.value !== ROUTE_ID || !avoidsRiskIdField.ok || !avoidsRiskIdField.isDataProperty || avoidsRiskIdField.value !== RISK_ID || !alternativeRouteIdField.ok || !alternativeRouteIdField.isDataProperty || alternativeRouteIdField.value !== ALTERNATIVE_ROUTE_ID) return failure("ALTERNATIVE_RELATION_INVALID");
  const vehicleId = vehicleIdField.value;
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
    relation: { vehicleId, currentRouteId: ROUTE_ID, avoidsRiskId: RISK_ID, alternativeRouteId: ALTERNATIVE_ROUTE_ID }, geometry, summary,
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

function isExactRejection(assessment: Unit211RejectedClearanceAssessment): boolean {
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
    const referenceFacts = cargoContinuityFacts(current.data.identityIndex, VEHICLE_ID);
    const currentOptionFacts = cargoContinuityFacts(current.data.identityIndex, current.data.vehicleId);
    const alternativeOptionFacts = cargoContinuityFacts(current.data.identityIndex, alternative.data.relation.vehicleId);
    return { ok: true, data: {
      context,
      incident: { id: "incident-route-011-restriction-height-3.9", vehicleId: VEHICLE_ID, riskId: RISK_ID, routeId: ROUTE_ID, snapIndex: incident.snapIndex, point: incident.point, exclusionPolygon },
      options: [
        { kind: "CURRENT", disposition: "REJECTED", routeId: ROUTE_ID, geometry: current.data.geometry, summary: current.data.summary, clearanceAssessment, temporalAssessment: temporalAssessment(context, current.data.summary.durationSeconds), cargoContinuityAssessment: cargoContinuityAssessment(current.data.identityIndex.validation, referenceFacts, currentOptionFacts) },
        { kind: "ALTERNATIVE", disposition: "SUPPORTED_FOR_COMPARISON", alternativeRouteId: ALTERNATIVE_ROUTE_ID, geometry: alternative.data.geometry, summary: alternative.data.summary, relation: alternative.data.relation, provenance: alternative.data.provenance, avoidsExclusionZone: true, temporalAssessment: temporalAssessment(context, alternative.data.summary.durationSeconds), cargoContinuityAssessment: cargoContinuityAssessment(current.data.identityIndex.validation, referenceFacts, alternativeOptionFacts) },
      ],
    } };
  };
}
