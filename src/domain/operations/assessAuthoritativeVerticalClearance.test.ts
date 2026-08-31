import { describe, expect, it } from "vitest";
import type { OperatingRegion, OperationalRisk, RiskRouteSnap, Route, Vehicle } from "../entities";
import type { ScenarioRepository } from "../ports/ScenarioRepository";
import { createSpainScenario } from "../../scenario/fixtures/spain-v1";
import type { AuthoritativeVerticalClearanceAssessmentResult } from "./authoritativeVerticalAssessment";
import { createOperationsApi } from "./createOperationsApi";

const VEHICLE_ID = "vehicle-011";
const ROUTE_ID = "route-011";
const RISK_ID = "restriction-height-3.9";
const INPUT = { vehicleId: VEHICLE_ID, riskId: RISK_ID, clearanceBufferMeters: 0.2 } as const;

type FailureReason = Extract<AuthoritativeVerticalClearanceAssessmentResult, { ok: false }>["reasonCode"];
type RepositoryCalls = { scenarioCurrent: number };
type ScenarioCase = { label: string; reasonCode: FailureReason; mutate(scenario: OperatingRegion): void };
type SnapTargets = { route: Route; riskSnaps: RiskRouteSnap[]; routeSnap: RiskRouteSnap; riskSnap: RiskRouteSnap };
type SnapCase = { label: string; mutate(targets: SnapTargets): void };

function callsEmpty(): RepositoryCalls { return { scenarioCurrent: 0 }; }
function unexpectedRepositoryCall(): never { throw new Error("The clearance assessment must only read scenarioCurrent."); }
function repositoryFor(scenario: OperatingRegion, calls: RepositoryCalls): ScenarioRepository {
  return { scenarioCurrent: () => { calls.scenarioCurrent += 1; return scenario; }, vehicleGet: unexpectedRepositoryCall, vehicleRename: unexpectedRepositoryCall, vehicleDelete: unexpectedRepositoryCall };
}
function assess(scenario: OperatingRegion, clearanceBufferMeters: number): AuthoritativeVerticalClearanceAssessmentResult {
  return createOperationsApi(repositoryFor(scenario, callsEmpty())).assessAuthoritativeVerticalClearance({ ...INPUT, clearanceBufferMeters });
}
function required<T>(value: T | undefined, message: string): T { if (value === undefined) throw new Error(message); return value; }
function vehicleFrom(scenario: OperatingRegion): Vehicle { return required(scenario.vehicles.find((entry) => entry.internalId === VEHICLE_ID), "Unit 211 fixture is missing."); }
function routeFrom(scenario: OperatingRegion): Route { return required(scenario.routes.find((entry) => entry.id === ROUTE_ID), "Unit 211 route fixture is missing."); }
function riskFrom(scenario: OperatingRegion): OperationalRisk { return required(scenario.risks.find((entry) => entry.id === RISK_ID), "Unit 211 risk fixture is missing."); }
function cloneSnap(snap: RiskRouteSnap): RiskRouteSnap { return { ...snap, startCoordinate: [...snap.startCoordinate], endCoordinate: [...snap.endCoordinate] }; }
function snapTargets(scenario: OperatingRegion): SnapTargets {
  const route = routeFrom(scenario); const risk = riskFrom(scenario); route.riskSnaps = route.riskSnaps.map(cloneSnap); const riskSnaps = (risk.routeSnaps ?? []).map(cloneSnap); risk.routeSnaps = riskSnaps;
  return { route, riskSnaps, routeSnap: required(route.riskSnaps.find((snap) => snap.riskId === RISK_ID), "Route snap is missing."), riskSnap: required(riskSnaps.find((snap) => snap.riskId === RISK_ID && snap.routeId === ROUTE_ID), "Risk snap is missing.") };
}
function setField(target: object, key: string, value: unknown): void { Reflect.set(target, key, value); }
function unsetField(target: object, key: string): void { Reflect.deleteProperty(target, key); }
function moveRiskSnap({ route, riskSnap }: SnapTargets): void {
  const index = riskSnap.startIndex + 1; const coordinate = required(route.geometry.geometry.coordinates[index], "Next route coordinate is missing.");
  Object.assign(riskSnap, { startIndex: index, endIndex: index, startCoordinate: [...coordinate], endCoordinate: [...coordinate] });
}
function decision(vehicleHeightMeters: number, clearanceBufferMeters: number, requiredClearanceMeters: number, status: "PASS" | "FAIL"): AuthoritativeVerticalClearanceAssessmentResult {
  return { ok: true, data: { vehicleId: VEHICLE_ID, riskId: RISK_ID, routeId: ROUTE_ID, vehicleHeightMeters, clearanceBufferMeters, requiredClearanceMeters, restrictionLimitMeters: 3.9, status, reasonCode: status === "PASS" ? "CLEARANCE_SATISFIED" : "CLEARANCE_VIOLATION" } };
}

const relationFailures: readonly ScenarioCase[] = [
  { label: "missing vehicle", reasonCode: "VEHICLE_NOT_FOUND", mutate: (scenario) => { scenario.vehicles = scenario.vehicles.filter((entry) => entry.internalId !== VEHICLE_ID); } },
  { label: "missing current route", reasonCode: "ROUTE_NOT_FOUND", mutate: (scenario) => { scenario.routes = scenario.routes.filter((entry) => entry.id !== ROUTE_ID); } },
  { label: "missing risk", reasonCode: "RISK_NOT_FOUND", mutate: (scenario) => { scenario.risks = scenario.risks.filter((entry) => entry.id !== RISK_ID); } },
  { label: "wrong risk kind", reasonCode: "RISK_KIND_NOT_HEIGHT_RESTRICTION", mutate: (scenario) => { riskFrom(scenario).kind = "weight-restriction"; } },
  { label: "route owned by another vehicle", reasonCode: "ROUTE_OWNERSHIP_MISMATCH", mutate: (scenario) => { routeFrom(scenario).vehicleId = "vehicle-001"; } },
  { label: "vehicle absent from affected vehicles", reasonCode: "VEHICLE_NOT_AFFECTED", mutate: (scenario) => { const risk = riskFrom(scenario); risk.affectedVehicleIds = risk.affectedVehicleIds.filter((id) => id !== VEHICLE_ID); } },
  { label: "route risk association missing", reasonCode: "ROUTE_RISK_ASSOCIATION_MISSING", mutate: (scenario) => { const route = routeFrom(scenario); route.riskSnaps = route.riskSnaps.filter((snap) => snap.riskId !== RISK_ID); } },
  { label: "risk route-specific snap missing", reasonCode: "ROUTE_SPECIFIC_SNAP_MISSING", mutate: (scenario) => { const risk = riskFrom(scenario); risk.routeSnaps = (risk.routeSnaps ?? []).filter((snap) => snap.routeId !== ROUTE_ID); } },
];

const snapFailures: readonly SnapCase[] = [
  { label: "duplicate route-side snaps", mutate: ({ route, routeSnap }) => { route.riskSnaps.push(cloneSnap(routeSnap)); } },
  { label: "duplicate risk-side snaps", mutate: ({ riskSnaps, riskSnap }) => { riskSnaps.push(cloneSnap(riskSnap)); } },
  { label: "non-finite start index", mutate: ({ routeSnap }) => setField(routeSnap, "startIndex", Number.POSITIVE_INFINITY) },
  { label: "fractional end index", mutate: ({ riskSnap }) => setField(riskSnap, "endIndex", riskSnap.endIndex + 0.5) },
  { label: "negative start index", mutate: ({ routeSnap }) => setField(routeSnap, "startIndex", -1) },
  { label: "out-of-bounds end index", mutate: ({ route, riskSnap }) => setField(riskSnap, "endIndex", route.geometry.geometry.coordinates.length) },
  { label: "snap bound to another route", mutate: ({ routeSnap }) => setField(routeSnap, "routeId", "route-010") },
  { label: "invalid snap kind", mutate: ({ riskSnap }) => setField(riskSnap, "kind", "area") },
  { label: "invalid point index semantics", mutate: ({ routeSnap }) => setField(routeSnap, "endIndex", routeSnap.startIndex + 1) },
  { label: "invalid segment index semantics", mutate: ({ riskSnap }) => setField(riskSnap, "kind", "segment") },
  { label: "missing route-side coordinate array", mutate: ({ routeSnap }) => unsetField(routeSnap, "startCoordinate") },
  { label: "missing risk-side coordinate array", mutate: ({ riskSnap }) => unsetField(riskSnap, "endCoordinate") },
  { label: "malformed coordinate array", mutate: ({ routeSnap }) => setField(routeSnap, "startCoordinate", [0]) },
  { label: "non-finite coordinate", mutate: ({ riskSnap }) => setField(riskSnap, "endCoordinate", [Number.NaN, 0]) },
  { label: "coordinate not on route geometry", mutate: ({ routeSnap }) => setField(routeSnap, "startCoordinate", [0, 0]) },
  { label: "intrinsically valid copies that disagree", mutate: moveRiskSnap },
];

const numericFailures: readonly ScenarioCase[] = [
  ...[0, -1, Number.NaN, Number.POSITIVE_INFINITY].map((value): ScenarioCase => ({ label: `vehicle height ${String(value)}`, reasonCode: "INVALID_VEHICLE_HEIGHT", mutate: (scenario) => { vehicleFrom(scenario).dimensions.heightMeters = value; } })),
  { label: "absent restriction limit", reasonCode: "INVALID_RESTRICTION_LIMIT", mutate: (scenario) => unsetField(riskFrom(scenario), "limitMeters") },
  ...[0, -1, Number.NaN, Number.POSITIVE_INFINITY].map((value): ScenarioCase => ({ label: `restriction limit ${String(value)}`, reasonCode: "INVALID_RESTRICTION_LIMIT", mutate: (scenario) => { riskFrom(scenario).limitMeters = value; } })),
];

describe("assessAuthoritativeVerticalClearance", () => {
  it("should fail real Unit 211 when 3.80 m plus 0.20 m exceeds the 3.90 m restriction", () => { expect(assess(createSpainScenario(), 0.2)).toStrictEqual(decision(3.8, 0.2, 4, "FAIL")); });
  it("should pass when required clearance exactly equals the restriction limit", () => { expect(assess(createSpainScenario(), 0.1)).toStrictEqual(decision(3.8, 0.1, 3.9, "PASS")); });
  it("should compare fractional clearance without pre-decision rounding", () => {
    const scenario = createSpainScenario(); vehicleFrom(scenario).dimensions.heightMeters = 3.80078125;
    expect(assess(scenario, 0.099609375)).toStrictEqual(decision(3.80078125, 0.099609375, 3.900390625, "FAIL"));
  });
  it.each([
    { label: "negative", value: -0.01 }, { label: "NaN", value: Number.NaN },
    { label: "positive infinity", value: Number.POSITIVE_INFINITY }, { label: "negative infinity", value: Number.NEGATIVE_INFINITY },
  ])("should reject a $label clearance buffer", ({ value }) => { expect(assess(createSpainScenario(), value)).toStrictEqual({ ok: false, reasonCode: "INVALID_BUFFER" }); });
  it.each(relationFailures)("should fail closed for $label", ({ mutate, reasonCode }) => {
    const scenario = createSpainScenario(); mutate(scenario);
    expect(assess(scenario, 0.2)).toStrictEqual({ ok: false, reasonCode });
  });
  it.each(snapFailures)("should return structured snap failure without throwing for $label", ({ mutate }) => {
    const scenario = createSpainScenario(); mutate(snapTargets(scenario));
    expect(assess(scenario, 0.2)).toStrictEqual({ ok: false, reasonCode: "ROUTE_SPECIFIC_SNAP_INCONSISTENT" });
  });
  it.each(numericFailures)("should fail closed for $label", ({ mutate, reasonCode }) => {
    const scenario = createSpainScenario(); mutate(scenario);
    expect(assess(scenario, 0.2)).toStrictEqual({ ok: false, reasonCode });
  });
  it("should fail closed when the derived requirement overflows", () => {
    const scenario = createSpainScenario(); vehicleFrom(scenario).dimensions.heightMeters = Number.MAX_VALUE;
    expect(assess(scenario, Number.MAX_VALUE)).toStrictEqual({ ok: false, reasonCode: "INVALID_REQUIRED_CLEARANCE" });
  });
  it("should read one current scenario without repository mutation or scenario changes", () => {
    const scenario = createSpainScenario(); const scenarioBefore = structuredClone(scenario); const calls = callsEmpty(); const api = createOperationsApi(repositoryFor(scenario, calls));
    expect(api.assessAuthoritativeVerticalClearance(INPUT)).toStrictEqual(decision(3.8, 0.2, 4, "FAIL"));
    expect(calls).toStrictEqual({ scenarioCurrent: 1 }); expect(scenario).toStrictEqual(scenarioBefore);
  });
});
