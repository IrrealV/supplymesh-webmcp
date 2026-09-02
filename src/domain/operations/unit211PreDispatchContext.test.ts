import { describe, expect, it, vi } from "vitest";
import type { OperatingRegion, OperationalRisk, Route, Vehicle } from "../entities";
import type { ScenarioRepository } from "../ports/ScenarioRepository";
import { clearanceAlternativeCatalog } from "../../scenario/fixtures/clearanceAlternativeCatalog";
import { createSpainScenario } from "../../scenario/fixtures/spain-v1";
import { createOperationsApi } from "./createOperationsApi";
import type { Unit211PreDispatchContextFailureReason, Unit211PreDispatchContextResult } from "./unit211PreDispatchContext";

const VEHICLE_ID = "vehicle-011"; const ROUTE_ID = "route-011"; const RISK_ID = "restriction-height-3.9";
type Calls = { scenario: number; catalog: number };
type Success = Extract<Unit211PreDispatchContextResult, { ok: true }>;
type CatalogCase = { label: string; reasonCode: Unit211PreDispatchContextFailureReason; read(): unknown };
type AdmissionCase = { label: string; read(): unknown };
type ScenarioCase = { label: string; reasonCode: Unit211PreDispatchContextFailureReason; mutate(scenario: OperatingRegion): void };
type TemporalDecision = Pick<Success["data"]["options"][number]["temporalAssessment"], "status" | "reasonCode">;
type TemporalDecisionCase = { label: string; remainingDriveMinutes: number; restDeadline: string; expected: readonly [TemporalDecision, TemporalDecision] };
type CargoContinuityAssessment = Success["data"]["options"][number]["cargoContinuityAssessment"];
type PassedCargoContinuityAssessment = Extract<CargoContinuityAssessment, { status: "PASS" }>;
type UnknownCargoContinuityAssessment = Extract<CargoContinuityAssessment, { status: "UNKNOWN" }>;
type CargoContinuityFacts = PassedCargoContinuityAssessment["referenceFacts"];
type InvalidReferenceCase = { label: string; sourceReasonCode: UnknownCargoContinuityAssessment["sourceReasonCode"]; mutate(vehicle: Vehicle): void };
type OptionVehicleCase = { label: string; vehicleId: string; source: UnknownCargoContinuityAssessment["source"]; sourceReasonCode: UnknownCargoContinuityAssessment["sourceReasonCode"]; mutate(scenario: OperatingRegion): void };
type GlobalIdentityCase = { label: string; sourceReasonCode: UnknownCargoContinuityAssessment["sourceReasonCode"]; mutate(scenario: OperatingRegion): void };

function required<T>(value: T | undefined, message: string): T { if (value === undefined) throw new Error(message); return value; }
function vehicleById(scenario: OperatingRegion, vehicleId: string): Vehicle { return required(scenario.vehicles.find(({ internalId }) => internalId === vehicleId), `${vehicleId} is missing.`); }
function vehicleFrom(scenario: OperatingRegion): Vehicle { return vehicleById(scenario, VEHICLE_ID); }
function routeFrom(scenario: OperatingRegion): Route { return required(scenario.routes.find(({ id }) => id === ROUTE_ID), "Route 011 is missing."); }
function riskFrom(scenario: OperatingRegion): OperationalRisk { return required(scenario.risks.find(({ id }) => id === RISK_ID), "Clearance risk is missing."); }
function unexpectedMutation(): never { throw new Error("The pre-dispatch operation must be read-only."); }
function repositoryFor(scenario: OperatingRegion, calls: Calls): ScenarioRepository {
  return {
    scenarioCurrent: () => { calls.scenario += 1; return scenario; },
    scenarioRegionSelect: unexpectedMutation,
    vehicleGet: unexpectedMutation,
    vehicleRename: unexpectedMutation,
    vehicleDelete: unexpectedMutation,
    vehicleCreate: unexpectedMutation,
    vehicleUpdate: unexpectedMutation,
    vehicleAssignRoute: unexpectedMutation,
  };
}
function apiFor(scenario: OperatingRegion, read: () => unknown = () => clearanceAlternativeCatalog, admittedAlternativeCatalog: unknown = clearanceAlternativeCatalog): { api: ReturnType<typeof createOperationsApi>; calls: Calls } {
  const calls = { scenario: 0, catalog: 0 };
  return { api: createOperationsApi(repositoryFor(scenario, calls), { readAlternativeCatalog: () => { calls.catalog += 1; return read(); }, admittedAlternativeCatalog }), calls };
}
function success(result: Unit211PreDispatchContextResult): Success { if (!result.ok) throw new Error(`Expected success, received ${result.reasonCode}.`); return result; }
function fields(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(fields);
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) => [key, ...fields(child)]);
}
function revokedProxy(): unknown { const handle = Proxy.revocable({}, {}); handle.revoke(); return handle.proxy; }
function catalogForVehicle(vehicleId: string): typeof clearanceAlternativeCatalog { return { ...clearanceAlternativeCatalog, relation: { ...clearanceAlternativeCatalog.relation, vehicleId } }; }
function unit211Facts(): CargoContinuityFacts { return { vehicleId: "vehicle-011", cargoId: "cargo-011", destinationId: "alcobendas", refrigeration: "ambient", priority: "standard" }; }
function continuityPass(facts: CargoContinuityFacts = unit211Facts()): PassedCargoContinuityAssessment { return { status: "PASS", reasonCode: "CARGO_CONTINUITY_SATISFIED", referenceFacts: { ...facts }, optionFacts: { ...facts } }; }
function continuityUnknown(source: UnknownCargoContinuityAssessment["source"], sourceReasonCode: UnknownCargoContinuityAssessment["sourceReasonCode"]): UnknownCargoContinuityAssessment { return { status: "UNKNOWN", reasonCode: "CARGO_CONTINUITY_SOURCE_INVALID", source, sourceReasonCode }; }

const catalogFailures: readonly CatalogCase[] = [
  { label: "missing source", reasonCode: "ALTERNATIVE_SOURCE_UNAVAILABLE", read: () => undefined },
  { label: "throwing source", reasonCode: "ALTERNATIVE_SOURCE_UNAVAILABLE", read: () => { throw new Error("catalog unavailable"); } },
  { label: "unreadable source", reasonCode: "ALTERNATIVE_SOURCE_UNAVAILABLE", read: () => new Proxy({}, { get: () => { throw new Error("unreadable catalog"); } }) },
  { label: "revoked source", reasonCode: "ALTERNATIVE_SOURCE_UNAVAILABLE", read: revokedProxy },
  { label: "missing relation vehicle", reasonCode: "ALTERNATIVE_RELATION_INVALID", read: () => ({ ...clearanceAlternativeCatalog, relation: { ...clearanceAlternativeCatalog.relation, vehicleId: "" } }) },
  { label: "wrong current route relation", reasonCode: "ALTERNATIVE_RELATION_INVALID", read: () => ({ ...clearanceAlternativeCatalog, relation: { ...clearanceAlternativeCatalog.relation, currentRouteId: "route-001" } }) },
  { label: "wrong avoided risk relation", reasonCode: "ALTERNATIVE_RELATION_INVALID", read: () => ({ ...clearanceAlternativeCatalog, relation: { ...clearanceAlternativeCatalog.relation, avoidsRiskId: "other-risk" } }) },
  { label: "wrong alternative route relation", reasonCode: "ALTERNATIVE_RELATION_INVALID", read: () => ({ ...clearanceAlternativeCatalog, relation: { ...clearanceAlternativeCatalog.relation, alternativeRouteId: "other-alternative" } }) },
  { label: "non-finite geometry", reasonCode: "ALTERNATIVE_GEOMETRY_INVALID", read: () => ({ ...clearanceAlternativeCatalog, geometry: { type: "LineString", coordinates: [[0, 0], [Number.NaN, 1]] } }) },
  { label: "non-positive summary", reasonCode: "ALTERNATIVE_SUMMARY_INVALID", read: () => ({ ...clearanceAlternativeCatalog, summary: { ...clearanceAlternativeCatalog.summary, durationSeconds: 0 } }) },
  { label: "non-finite summary", reasonCode: "ALTERNATIVE_SUMMARY_INVALID", read: () => ({ ...clearanceAlternativeCatalog, summary: { ...clearanceAlternativeCatalog.summary, durationSeconds: Number.POSITIVE_INFINITY } }) },
  { label: "invalid provenance", reasonCode: "ALTERNATIVE_PROVENANCE_INVALID", read: () => ({ ...clearanceAlternativeCatalog, provenance: { ...clearanceAlternativeCatalog.provenance, generatedAt: "not-an-instant" } }) },
  { label: "non-positive minimum clearance", reasonCode: "ALTERNATIVE_AVOIDANCE_INVALID", read: () => ({ ...clearanceAlternativeCatalog, provenance: { ...clearanceAlternativeCatalog.provenance, avoidance: { ...clearanceAlternativeCatalog.provenance.avoidance, minimumClearanceMeters: 0 } } }) },
  { label: "open avoidance polygon", reasonCode: "ALTERNATIVE_AVOIDANCE_INVALID", read: () => ({ ...clearanceAlternativeCatalog, provenance: { ...clearanceAlternativeCatalog.provenance, avoidance: { ...clearanceAlternativeCatalog.provenance.avoidance, polygon: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]] } } } }) },
];

const admissionFailures: readonly AdmissionCase[] = [
  { label: "deep-equal catalog clone", read: () => structuredClone(clearanceAlternativeCatalog) },
  { label: "changed valid relation vehicle", read: () => catalogForVehicle("vehicle-004") },
  { label: "changed positive metrics", read: () => ({ ...clearanceAlternativeCatalog, summary: { ...clearanceAlternativeCatalog.summary, distanceMeters: 80299 } }) },
  { label: "changed valid provenance", read: () => ({ ...clearanceAlternativeCatalog, provenance: { ...clearanceAlternativeCatalog.provenance, provider: "other-provider", profile: "other-profile", sourceRevision: "a".repeat(64), generatedAt: "2026-08-30T14:31:47.453Z" } }) },
  { label: "changed valid line geometry", read: () => ({ ...clearanceAlternativeCatalog, geometry: { ...clearanceAlternativeCatalog.geometry, coordinates: [[-4, 39], ...clearanceAlternativeCatalog.geometry.coordinates.slice(1)] } }) },
  { label: "changed valid avoidance evidence", read: () => ({ ...clearanceAlternativeCatalog, provenance: { ...clearanceAlternativeCatalog.provenance, avoidance: { ...clearanceAlternativeCatalog.provenance.avoidance, minimumClearanceMeters: 1, polygon: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } } } }) },
];

const scenarioFailures: readonly ScenarioCase[] = [
  { label: "wrong scenario", reasonCode: "SCENARIO_INVALID", mutate: (scenario) => { scenario.id = "other"; } },
  { label: "wrong fixed fleet identity", reasonCode: "UNIT_211_INVALID", mutate: (scenario) => { vehicleFrom(scenario).fleetNumber = "FM-999"; } },
  { label: "invalid current geometry", reasonCode: "CURRENT_ROUTE_INVALID", mutate: (scenario) => { const route = routeFrom(scenario); route.geometry = structuredClone(route.geometry); Reflect.set(route.geometry.geometry, "type", "Point"); } },
  { label: "non-finite current duration", reasonCode: "CURRENT_ROUTE_INVALID", mutate: (scenario) => { const route = routeFrom(scenario); route.summary = { ...route.summary, durationSeconds: Number.NaN }; } },
  { label: "invalid remaining drive source", reasonCode: "TEMPORAL_SOURCE_INVALID", mutate: (scenario) => { vehicleFrom(scenario).timing.remainingDriveMinutes = Number.POSITIVE_INFINITY; } },
  { label: "invalid route progress source", reasonCode: "TEMPORAL_SOURCE_INVALID", mutate: (scenario) => { vehicleFrom(scenario).routeProgress = Number.NaN; } },
  { label: "invalid rest deadline source", reasonCode: "TEMPORAL_SOURCE_INVALID", mutate: (scenario) => { vehicleFrom(scenario).timing.restDeadline = "not-an-instant"; } },
];

const temporalDecisionCases: readonly TemporalDecisionCase[] = [
  { label: "exact equality at the remaining drive boundary", remainingDriveMinutes: 88.20166666666667, restDeadline: "2026-08-28T16:00:00Z", expected: [{ status: "PASS", reasonCode: "TEMPORAL_WINDOW_SATISFIED" }, { status: "PASS", reasonCode: "TEMPORAL_WINDOW_SATISFIED" }] },
  { label: "a drive-time violation", remainingDriveMinutes: 88, restDeadline: "2026-08-28T16:00:00Z", expected: [{ status: "FAIL", reasonCode: "DRIVE_TIME_VIOLATION" }, { status: "FAIL", reasonCode: "DRIVE_TIME_VIOLATION" }] },
  { label: "a rest-deadline violation", remainingDriveMinutes: 235, restDeadline: "2026-08-28T10:00:00Z", expected: [{ status: "FAIL", reasonCode: "REST_DEADLINE_VIOLATION" }, { status: "FAIL", reasonCode: "REST_DEADLINE_VIOLATION" }] },
  { label: "both temporal violations", remainingDriveMinutes: 88, restDeadline: "2026-08-28T10:00:00Z", expected: [{ status: "FAIL", reasonCode: "DRIVE_TIME_AND_REST_DEADLINE_VIOLATION" }, { status: "FAIL", reasonCode: "DRIVE_TIME_AND_REST_DEADLINE_VIOLATION" }] },
  { label: "an unrounded drive-time boundary", remainingDriveMinutes: 88.2, restDeadline: "2026-08-28T16:00:00Z", expected: [{ status: "FAIL", reasonCode: "DRIVE_TIME_VIOLATION" }, { status: "PASS", reasonCode: "TEMPORAL_WINDOW_SATISFIED" }] },
];

const invalidReferenceCases: readonly InvalidReferenceCase[] = [
  { label: "a missing cargo ID", sourceReasonCode: "CARGO_ID_INVALID", mutate: (vehicle) => { Reflect.deleteProperty(vehicle.cargo, "id"); } },
  { label: "a malformed cargo ID", sourceReasonCode: "CARGO_ID_INVALID", mutate: (vehicle) => { Reflect.set(vehicle.cargo, "id", 42); } },
  { label: "a missing destination ID", sourceReasonCode: "DESTINATION_ID_INVALID", mutate: (vehicle) => { Reflect.deleteProperty(vehicle.destination, "id"); } },
  { label: "a malformed destination ID", sourceReasonCode: "DESTINATION_ID_INVALID", mutate: (vehicle) => { Reflect.set(vehicle.destination, "id", " "); } },
  { label: "invalid refrigeration", sourceReasonCode: "REFRIGERATION_INVALID", mutate: (vehicle) => { Reflect.set(vehicle.cargo, "refrigeration", "heated"); } },
  { label: "invalid priority", sourceReasonCode: "PRIORITY_INVALID", mutate: (vehicle) => { Reflect.set(vehicle.cargo, "priority", "expedited"); } },
];

const optionVehicleCases: readonly OptionVehicleCase[] = [
  { label: "a missing option vehicle", vehicleId: "vehicle-missing", source: "OPTION", sourceReasonCode: "VEHICLE_MISSING", mutate: () => {} },
  { label: "a duplicate option vehicle", vehicleId: "vehicle-004", source: "SCENARIO", sourceReasonCode: "VEHICLE_ID_AMBIGUOUS", mutate: (scenario) => { scenario.vehicles.push(structuredClone(vehicleById(scenario, "vehicle-004"))); } },
];

const globalIdentityCases: readonly GlobalIdentityCase[] = [
  { label: "duplicate unrelated cargo IDs", sourceReasonCode: "CARGO_ID_AMBIGUOUS", mutate: (scenario) => { vehicleById(scenario, "vehicle-001").cargo.id = vehicleById(scenario, "vehicle-002").cargo.id; } },
  { label: "a malformed unrelated cargo ID", sourceReasonCode: "CARGO_ID_INVALID", mutate: (scenario) => { Reflect.set(vehicleById(scenario, "vehicle-001").cargo, "id", 42); } },
  { label: "duplicate unrelated vehicle IDs", sourceReasonCode: "VEHICLE_ID_AMBIGUOUS", mutate: (scenario) => { vehicleById(scenario, "vehicle-001").internalId = vehicleById(scenario, "vehicle-002").internalId; } },
  { label: "a malformed unrelated vehicle ID", sourceReasonCode: "VEHICLE_ID_INVALID", mutate: (scenario) => { Reflect.set(vehicleById(scenario, "vehicle-001"), "internalId", 42); } },
];

describe("unit211PreDispatchContext", () => {
  it("should return the exact deterministic context, incident, and two real route options", () => {
    const scenario = createSpainScenario(); const route = routeFrom(scenario); const vehicle = vehicleFrom(scenario); const routeSnap = required(route.riskSnaps.find(({ riskId }) => riskId === RISK_ID), "Route-specific snap is missing.");
    const sourceProgress = vehicle.routeProgress; const sourcePosition = structuredClone(vehicle.position.geometry.coordinates);
    const data = success(apiFor(scenario).api.unit211PreDispatchContext()).data;

    expect(data).toStrictEqual({
      context: { scenarioClock: { instant: "2026-08-28T09:00:00.000Z", mode: "deterministic-demo" }, unit: { vehicleId: "vehicle-011", fleetNumber: "FM-211" }, origin: { name: "Toledo" }, currentRouteId: "route-011", routeProgress: 0, isRouteStarted: false, position: { type: "Point", coordinates: route.geometry.geometry.coordinates[0] }, temporalSource: { remainingDriveMinutes: 235, restDeadline: "2026-08-28T16:00:00Z" } },
      incident: { id: "incident-route-011-restriction-height-3.9", vehicleId: "vehicle-011", riskId: RISK_ID, routeId: ROUTE_ID, snapIndex: routeSnap.startIndex, point: { type: "Point", coordinates: routeSnap.startCoordinate }, exclusionPolygon: clearanceAlternativeCatalog.provenance.avoidance.polygon },
      options: [
        { kind: "CURRENT", disposition: "REJECTED", routeId: ROUTE_ID, geometry: route.geometry.geometry, summary: { distanceMeters: 99706.6, durationSeconds: 5292.1 }, clearanceAssessment: { ok: true, data: { vehicleId: VEHICLE_ID, riskId: RISK_ID, routeId: ROUTE_ID, vehicleHeightMeters: 3.8, clearanceBufferMeters: 0.2, requiredClearanceMeters: 4, restrictionLimitMeters: 3.9, status: "FAIL", reasonCode: "CLEARANCE_VIOLATION" } }, temporalAssessment: { remainingRouteMinutes: 88.20166666666667, remainingDriveMinutes: 235, estimatedCompletionAt: "2026-08-28T10:28:12.100Z", restDeadline: "2026-08-28T16:00:00Z", status: "PASS", reasonCode: "TEMPORAL_WINDOW_SATISFIED" }, cargoContinuityAssessment: continuityPass() },
        { kind: "ALTERNATIVE", disposition: "SUPPORTED_FOR_COMPARISON", alternativeRouteId: "alternative-route-011-clearance-v1", geometry: clearanceAlternativeCatalog.geometry, summary: { distanceMeters: 80298.9, durationSeconds: 5282.5 }, relation: clearanceAlternativeCatalog.relation, provenance: clearanceAlternativeCatalog.provenance, avoidsExclusionZone: true, temporalAssessment: { remainingRouteMinutes: 88.04166666666667, remainingDriveMinutes: 235, estimatedCompletionAt: "2026-08-28T10:28:02.500Z", restDeadline: "2026-08-28T16:00:00Z", status: "PASS", reasonCode: "TEMPORAL_WINDOW_SATISFIED" }, cargoContinuityAssessment: continuityPass() },
      ],
    });
    expect(data.context.position.coordinates).toStrictEqual([-4.027341, 39.862774]);
    expect(sourceProgress).toBe(0.7142857142857143); expect(vehicle.routeProgress).toBe(sourceProgress); expect(vehicle.position.geometry.coordinates).toStrictEqual(sourcePosition);
    expect(data.context.routeProgress).toBe(0); expect(data.context.routeProgress).not.toBe(sourceProgress); expect(data.context.position.coordinates).not.toStrictEqual(sourcePosition);
    expect(data.options[0].temporalAssessment.remainingRouteMinutes).toBe(route.summary.durationSeconds / 60);
    expect(data.options[1].provenance.avoidance.minimumClearanceMeters).toBe(5724.858608188861);
  });

  it("should read each source once without mutation calls and use route-011 incident evidence", () => {
    const scenario = createSpainScenario(); const { api, calls } = apiFor(scenario); const data = success(api.unit211PreDispatchContext()).data; const risk = riskFrom(scenario);
    expect(calls).toStrictEqual({ scenario: 1, catalog: 1 });
    expect(data.options[0].clearanceAssessment).toStrictEqual({ ok: true, data: { vehicleId: VEHICLE_ID, riskId: RISK_ID, routeId: ROUTE_ID, vehicleHeightMeters: 3.8, clearanceBufferMeters: 0.2, requiredClearanceMeters: 4, restrictionLimitMeters: 3.9, status: "FAIL", reasonCode: "CLEARANCE_VIOLATION" } });
    expect({ snapIndex: data.incident.snapIndex, point: data.incident.point.coordinates }).toStrictEqual({ snapIndex: 537, point: [-3.897481, 40.149232] });
    expect(data.incident.point.coordinates).not.toStrictEqual(risk.geometry.geometry.coordinates[0]);
    expect(data.incident.exclusionPolygon).toBe(data.options[1].provenance.avoidance.polygon);
  });

  it("should repeat deeply equal results with independently detached source copies", () => {
    const scenario = createSpainScenario(); const scenarioBefore = structuredClone(scenario); const catalogBefore = structuredClone(clearanceAlternativeCatalog); const { api } = apiFor(scenario);
    const first = success(api.unit211PreDispatchContext()); const second = success(api.unit211PreDispatchContext());
    expect(first).toStrictEqual(second); expect(first.data).not.toBe(second.data);
    expect(first.data.options[0].geometry).not.toBe(second.data.options[0].geometry); expect(first.data.options[1].geometry).not.toBe(second.data.options[1].geometry);
    expect(first.data.options[0].temporalAssessment).not.toBe(second.data.options[0].temporalAssessment); expect(first.data.options[1].temporalAssessment).not.toBe(second.data.options[1].temporalAssessment);
    expect(first.data.options[0].cargoContinuityAssessment).not.toBe(second.data.options[0].cargoContinuityAssessment); expect(first.data.options[1].cargoContinuityAssessment).not.toBe(second.data.options[1].cargoContinuityAssessment);
    expect(first.data.incident.exclusionPolygon).not.toBe(second.data.incident.exclusionPolygon);
    const currentContinuity = first.data.options[0].cargoContinuityAssessment; const alternativeContinuity = first.data.options[1].cargoContinuityAssessment;
    if (currentContinuity.status !== "PASS" || alternativeContinuity.status !== "PASS") throw new Error("Expected real continuity assessments to pass.");
    expect(currentContinuity.referenceFacts).not.toBe(currentContinuity.optionFacts); expect(currentContinuity.referenceFacts).not.toBe(alternativeContinuity.referenceFacts);
    first.data.context.position.coordinates[0] = 0; first.data.options[0].geometry.coordinates[0][0] = 0; first.data.options[0].temporalAssessment.remainingRouteMinutes = 0; first.data.options[1].geometry.coordinates[0][0] = 0; first.data.incident.exclusionPolygon.coordinates[0][0][0] = 0; currentContinuity.referenceFacts.cargoId = "tampered"; alternativeContinuity.optionFacts.destinationId = "tampered";
    expect(scenario).toStrictEqual(scenarioBefore); expect(clearanceAlternativeCatalog).toStrictEqual(catalogBefore);
    expect(second.data.context.position.coordinates).toStrictEqual([-4.027341, 39.862774]); expect(second.data.options[0].temporalAssessment.remainingRouteMinutes).toBe(88.20166666666667); expect(second.data.options[0].cargoContinuityAssessment).toStrictEqual(continuityPass()); expect(second.data.incident.exclusionPolygon.coordinates[0][0][0]).toBe(-3.897481);
  });

  it("should report every continuity mismatch in deterministic fact order for another authoritative vehicle", () => {
    const scenario = createSpainScenario(); const catalog = catalogForVehicle("vehicle-004");
    const data = success(apiFor(scenario, () => catalog, catalog).api.unit211PreDispatchContext()).data;
    expect(data.options[0].cargoContinuityAssessment).toStrictEqual(continuityPass());
    expect(data.options[1].relation).toStrictEqual({ vehicleId: "vehicle-004", currentRouteId: ROUTE_ID, avoidsRiskId: RISK_ID, alternativeRouteId: "alternative-route-011-clearance-v1" });
    expect(data.options[1].cargoContinuityAssessment).toStrictEqual({
      status: "FAIL", reasonCode: "CARGO_CONTINUITY_MISMATCH",
      mismatchReasonCodes: ["VEHICLE_ID_MISMATCH", "CARGO_ID_MISMATCH", "DESTINATION_ID_MISMATCH", "REFRIGERATION_MISMATCH", "PRIORITY_MISMATCH"],
      referenceFacts: unit211Facts(), optionFacts: { vehicleId: "vehicle-004", cargoId: "cargo-004", destinationId: "valencia", refrigeration: "frozen", priority: "critical" },
    });
  });

  it("should not treat matching cargo descriptions or destination display names as identity evidence", () => {
    const scenario = createSpainScenario(); const reference = vehicleFrom(scenario); const option = vehicleById(scenario, "vehicle-012");
    option.cargo.description = reference.cargo.description; option.destination.name = reference.destination.name; option.cargo.refrigeration = reference.cargo.refrigeration; option.cargo.priority = reference.cargo.priority;
    const catalog = catalogForVehicle(option.internalId); const assessment = success(apiFor(scenario, () => catalog, catalog).api.unit211PreDispatchContext()).data.options[1].cargoContinuityAssessment;
    expect(assessment).toStrictEqual({ status: "FAIL", reasonCode: "CARGO_CONTINUITY_MISMATCH", mismatchReasonCodes: ["VEHICLE_ID_MISMATCH", "CARGO_ID_MISMATCH", "DESTINATION_ID_MISMATCH"], referenceFacts: unit211Facts(), optionFacts: { vehicleId: "vehicle-012", cargoId: "cargo-012", destinationId: "madrid", refrigeration: "ambient", priority: "standard" } });
    const assessmentFields = new Set(fields(assessment));
    for (const prohibited of ["description", "name", "cargoDescription", "destinationName"]) expect(assessmentFields.has(prohibited), prohibited).toBe(false);
    expect(JSON.stringify(assessment)).not.toContain(reference.cargo.description); expect(JSON.stringify(assessment)).not.toContain(reference.destination.name);
  });

  it("should accept a coherent stable identity change within the single captured snapshot", () => {
    const scenario = createSpainScenario(); const unit = vehicleFrom(scenario); unit.cargo.id = "cargo-stable-211"; unit.destination.id = "destination-stable-211";
    const facts: CargoContinuityFacts = { ...unit211Facts(), cargoId: "cargo-stable-211", destinationId: "destination-stable-211" };
    expect(success(apiFor(scenario).api.unit211PreDispatchContext()).data.options.map(({ cargoContinuityAssessment: assessment }) => assessment)).toStrictEqual([continuityPass(facts), continuityPass(facts)]);
  });

  it.each(invalidReferenceCases)("should return UNKNOWN for $label without throwing", ({ mutate, sourceReasonCode }) => {
    const scenario = createSpainScenario(); mutate(vehicleFrom(scenario));
    expect(success(apiFor(scenario).api.unit211PreDispatchContext()).data.options.map(({ cargoContinuityAssessment: assessment }) => assessment)).toStrictEqual([
      continuityUnknown("SCENARIO", sourceReasonCode), continuityUnknown("SCENARIO", sourceReasonCode),
    ]);
  });

  it.each(optionVehicleCases)("should return UNKNOWN for $label", ({ mutate, source, sourceReasonCode, vehicleId }) => {
    const scenario = createSpainScenario(); mutate(scenario); const catalog = catalogForVehicle(vehicleId);
    const assessments = success(apiFor(scenario, () => catalog, catalog).api.unit211PreDispatchContext()).data.options.map(({ cargoContinuityAssessment: assessment }) => assessment);
    expect(assessments).toStrictEqual(source === "OPTION" ? [continuityPass(), continuityUnknown(source, sourceReasonCode)] : [continuityUnknown(source, sourceReasonCode), continuityUnknown(source, sourceReasonCode)]);
  });

  it("should return UNKNOWN when an option cargo ID is ambiguous across vehicles", () => {
    const scenario = createSpainScenario(); vehicleById(scenario, "vehicle-004").cargo.id = vehicleById(scenario, "vehicle-005").cargo.id; const catalog = catalogForVehicle("vehicle-004");
    const assessments = success(apiFor(scenario, () => catalog, catalog).api.unit211PreDispatchContext()).data.options.map(({ cargoContinuityAssessment: assessment }) => assessment);
    expect(assessments).toStrictEqual([continuityUnknown("SCENARIO", "CARGO_ID_AMBIGUOUS"), continuityUnknown("SCENARIO", "CARGO_ID_AMBIGUOUS")]);
  });

  it.each(globalIdentityCases)("should block PASS globally for $label", ({ mutate, sourceReasonCode }) => {
    const scenario = createSpainScenario(); mutate(scenario); const unknown = continuityUnknown("SCENARIO", sourceReasonCode);
    expect(success(apiFor(scenario).api.unit211PreDispatchContext()).data.options.map(({ cargoContinuityAssessment: assessment }) => assessment)).toStrictEqual([unknown, unknown]);
  });

  it("should reject an alternating destination ID after exactly one captured read", () => {
    const scenario = createSpainScenario(); let reads = 0;
    Object.defineProperty(vehicleFrom(scenario).destination, "id", { configurable: true, get: () => ++reads === 1 ? "alcobendas" : 42 });
    const assessments = success(apiFor(scenario).api.unit211PreDispatchContext()).data.options.map(({ cargoContinuityAssessment: assessment }) => assessment);
    expect(reads).toBe(1); expect(assessments).toStrictEqual([continuityUnknown("SCENARIO", "DESTINATION_ID_INVALID"), continuityUnknown("SCENARIO", "DESTINATION_ID_INVALID")]);
  });

  it("should map a throwing destination ID getter to DESTINATION_ID_INVALID", () => {
    const scenario = createSpainScenario(); let reads = 0;
    Object.defineProperty(vehicleFrom(scenario).destination, "id", { configurable: true, get: () => { reads += 1; throw new Error("unreadable destination"); } });
    const assessments = success(apiFor(scenario).api.unit211PreDispatchContext()).data.options.map(({ cargoContinuityAssessment: assessment }) => assessment);
    expect(reads).toBe(1); expect(assessments).toStrictEqual([continuityUnknown("SCENARIO", "DESTINATION_ID_INVALID"), continuityUnknown("SCENARIO", "DESTINATION_ID_INVALID")]);
  });

  it("should reject an alternating admitted relation vehicle ID without leaking its second value", () => {
    const scenario = createSpainScenario(); const catalog = catalogForVehicle(VEHICLE_ID); let reads = 0;
    Object.defineProperty(catalog.relation, "vehicleId", { configurable: true, get: () => ++reads === 1 ? VEHICLE_ID : "vehicle-004" });
    expect(apiFor(scenario, () => catalog, catalog).api.unit211PreDispatchContext()).toStrictEqual({ ok: false, reasonCode: "ALTERNATIVE_RELATION_INVALID" }); expect(reads).toBe(1);
  });

  it("should capture changing vehicle and current-route identities once", () => {
    const vehicleScenario = createSpainScenario(); let vehicleReads = 0;
    Object.defineProperty(vehicleFrom(vehicleScenario), "internalId", { configurable: true, get: () => ++vehicleReads === 1 ? VEHICLE_ID : "vehicle-004" });
    const unknown = continuityUnknown("SCENARIO", "VEHICLE_ID_INVALID");
    expect(success(apiFor(vehicleScenario).api.unit211PreDispatchContext()).data.options.map(({ cargoContinuityAssessment: assessment }) => assessment)).toStrictEqual([unknown, unknown]); expect(vehicleReads).toBe(1);
    const routeScenario = createSpainScenario(); let routeReads = 0;
    Object.defineProperty(routeFrom(routeScenario), "vehicleId", { configurable: true, get: () => ++routeReads === 1 ? VEHICLE_ID : "vehicle-004" });
    expect(apiFor(routeScenario).api.unit211PreDispatchContext()).toStrictEqual({ ok: false, reasonCode: "CURRENT_ROUTE_INVALID" }); expect(routeReads).toBe(1);
  });

  it.each(temporalDecisionCases)("should decide $label from raw duration and pre-dispatch progress", ({ remainingDriveMinutes, restDeadline, expected }) => {
    const scenario = createSpainScenario(); const vehicle = vehicleFrom(scenario); vehicle.timing.remainingDriveMinutes = remainingDriveMinutes; vehicle.timing.restDeadline = restDeadline;
    const assessments = success(apiFor(scenario).api.unit211PreDispatchContext()).data.options.map(({ temporalAssessment: assessment }) => assessment);
    expect(assessments.map(({ remainingRouteMinutes, estimatedCompletionAt }) => ({ remainingRouteMinutes, estimatedCompletionAt }))).toStrictEqual([
      { remainingRouteMinutes: 88.20166666666667, estimatedCompletionAt: "2026-08-28T10:28:12.100Z" },
      { remainingRouteMinutes: 88.04166666666667, estimatedCompletionAt: "2026-08-28T10:28:02.500Z" },
    ]);
    expect(assessments.map(({ remainingDriveMinutes: driveMinutes, restDeadline: deadline }) => ({ remainingDriveMinutes: driveMinutes, restDeadline: deadline }))).toStrictEqual([
      { remainingDriveMinutes, restDeadline }, { remainingDriveMinutes, restDeadline },
    ]);
    expect(assessments.map(({ status, reasonCode }) => ({ status, reasonCode }))).toStrictEqual(expected);
  });

  it("should return UNKNOWN with honest fields when a finite duration cannot produce a valid completion instant", () => {
    const scenario = createSpainScenario(); const route = routeFrom(scenario); route.summary = { ...route.summary, durationSeconds: Number.MAX_VALUE };
    const data = success(apiFor(scenario).api.unit211PreDispatchContext()).data;
    expect(data.options[0].temporalAssessment).toStrictEqual({ remainingRouteMinutes: Number.MAX_VALUE / 60, remainingDriveMinutes: 235, estimatedCompletionAt: null, restDeadline: "2026-08-28T16:00:00Z", status: "UNKNOWN", reasonCode: "TEMPORAL_SOURCE_INVALID" });
    expect(data.options[1].temporalAssessment).toStrictEqual({ remainingRouteMinutes: 88.04166666666667, remainingDriveMinutes: 235, estimatedCompletionAt: "2026-08-28T10:28:02.500Z", restDeadline: "2026-08-28T16:00:00Z", status: "PASS", reasonCode: "TEMPORAL_WINDOW_SATISFIED" });
  });

  it.each([
    { label: "an underflowing Number.MIN_VALUE duration", durationSeconds: Number.MIN_VALUE, remainingRouteMinutes: null },
    { label: "a positive sub-millisecond duration", durationSeconds: 0.0001, remainingRouteMinutes: 0.0000016666666666666667 },
  ])("should return UNKNOWN with honest fields for $label", ({ durationSeconds, remainingRouteMinutes }) => {
    const scenario = createSpainScenario(); const route = routeFrom(scenario); route.summary = { ...route.summary, durationSeconds };
    const data = success(apiFor(scenario).api.unit211PreDispatchContext()).data;
    expect(data.options[0].temporalAssessment).toStrictEqual({ remainingRouteMinutes, remainingDriveMinutes: 235, estimatedCompletionAt: null, restDeadline: "2026-08-28T16:00:00Z", status: "UNKNOWN", reasonCode: "TEMPORAL_SOURCE_INVALID" });
    expect(data.options[1].temporalAssessment.status).toBe("PASS");
  });

  it("should return UNKNOWN without discarding derivable fields for an incoherent rest deadline", () => {
    const scenario = createSpainScenario(); vehicleFrom(scenario).timing.restDeadline = "2026-08-28T08:59:59Z";
    const assessments = success(apiFor(scenario).api.unit211PreDispatchContext()).data.options.map(({ temporalAssessment: assessment }) => assessment);
    expect(assessments).toStrictEqual([
      { remainingRouteMinutes: 88.20166666666667, remainingDriveMinutes: 235, estimatedCompletionAt: "2026-08-28T10:28:12.100Z", restDeadline: "2026-08-28T08:59:59Z", status: "UNKNOWN", reasonCode: "TEMPORAL_SOURCE_INVALID" },
      { remainingRouteMinutes: 88.04166666666667, remainingDriveMinutes: 235, estimatedCompletionAt: "2026-08-28T10:28:02.500Z", restDeadline: "2026-08-28T08:59:59Z", status: "UNKNOWN", reasonCode: "TEMPORAL_SOURCE_INVALID" },
    ]);
  });

  it("should return UNKNOWN when the fixed scenario clock cannot produce a valid instant", () => {
    const parseInstant = Date.parse.bind(Date); vi.spyOn(Date, "parse").mockImplementation((value) => value === "2026-08-28T09:00:00.000Z" ? Number.NaN : parseInstant(value));
    const assessments = success(apiFor(createSpainScenario()).api.unit211PreDispatchContext()).data.options.map(({ temporalAssessment: assessment }) => assessment);
    expect(assessments).toStrictEqual([
      { remainingRouteMinutes: 88.20166666666667, remainingDriveMinutes: 235, estimatedCompletionAt: null, restDeadline: "2026-08-28T16:00:00Z", status: "UNKNOWN", reasonCode: "TEMPORAL_SOURCE_INVALID" },
      { remainingRouteMinutes: 88.04166666666667, remainingDriveMinutes: 235, estimatedCompletionAt: null, restDeadline: "2026-08-28T16:00:00Z", status: "UNKNOWN", reasonCode: "TEMPORAL_SOURCE_INVALID" },
    ]);
  });

  it("should expose no reserve, rest toggle, policy scheduling, workflow, or mutation fields", () => {
    const outputFields = new Set(fields(success(apiFor(createSpainScenario()).api.unit211PreDispatchContext()).data));
    for (const prohibited of ["eta", "delay", "delayMinutes", "completionTime", "reserve", "cost", "costs", "toll", "tolls", "road", "roads", "restFeasible", "restCompliant", "restDecision", "restProtection", "restProtectionEnabled", "restToggle", "protectionEnabled", "policy", "schedule", "restSchedule", "plan", "approval", "execution", "receipt", "movement", "reset", "transfer", "assignment", "feasible", "selected", "applied", "workflow", "mutation", "wallClock", "dateNow"]) expect(outputFields.has(prohibited), prohibited).toBe(false);
  });

  it.each(catalogFailures)("should fail closed without throwing for $label", ({ read, reasonCode }) => {
    expect(apiFor(createSpainScenario(), read).api.unit211PreDispatchContext()).toStrictEqual({ ok: false, reasonCode });
  });

  it.each(admissionFailures)("should reject well-shaped but non-admitted catalog data for $label", ({ read }) => {
    expect(apiFor(createSpainScenario(), read).api.unit211PreDispatchContext()).toStrictEqual({ ok: false, reasonCode: "ALTERNATIVE_ADMISSION_INVALID" });
  });

  it.each(scenarioFailures)("should distinguish $label", ({ mutate, reasonCode }) => {
    const scenario = createSpainScenario(); mutate(scenario);
    expect(apiFor(scenario).api.unit211PreDispatchContext()).toStrictEqual({ ok: false, reasonCode });
  });

  it("should distinguish assessment failure, an unexpectedly accepted current route, and an invalid incident snap", () => {
    const invalidAssessment = createSpainScenario(); riskFrom(invalidAssessment).kind = "weight-restriction";
    const accepted = createSpainScenario(); vehicleFrom(accepted).dimensions.heightMeters = 3.6;
    const invalidIncident = createSpainScenario(); const invalidRoute = routeFrom(invalidIncident); invalidRoute.riskSnaps = structuredClone(invalidRoute.riskSnaps); required(invalidRoute.riskSnaps.find(({ riskId }) => riskId === RISK_ID), "Incident snap is missing.").startIndex += 1;
    expect(apiFor(invalidAssessment).api.unit211PreDispatchContext()).toStrictEqual({ ok: false, reasonCode: "AUTHORITATIVE_CLEARANCE_ASSESSMENT_FAILED" });
    expect(apiFor(accepted).api.unit211PreDispatchContext()).toStrictEqual({ ok: false, reasonCode: "CURRENT_ROUTE_UNEXPECTEDLY_NOT_REJECTED" });
    expect(apiFor(invalidIncident).api.unit211PreDispatchContext()).toStrictEqual({ ok: false, reasonCode: "ROUTE_011_INCIDENT_SNAP_INVALID" });
  });

  it("should reject duplicate conflicting target risks before clearance assessment", () => {
    const scenario = createSpainScenario(); const duplicate = structuredClone(riskFrom(scenario)); duplicate.limitMeters = 4.2; scenario.risks.push(duplicate);
    expect(apiFor(scenario).api.unit211PreDispatchContext()).toStrictEqual({ ok: false, reasonCode: "CURRENT_RISK_INVALID" });
  });

  it("should keep the required operation available when the optional catalog dependency is omitted", () => {
    const calls = { scenario: 0, catalog: 0 }; const api = createOperationsApi(repositoryFor(createSpainScenario(), calls));
    expect(api.unit211PreDispatchContext()).toStrictEqual({ ok: false, reasonCode: "ALTERNATIVE_SOURCE_UNAVAILABLE" }); expect(calls.scenario).toBe(1);
  });
});
