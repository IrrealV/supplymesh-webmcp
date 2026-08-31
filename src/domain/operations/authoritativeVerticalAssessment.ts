import type { OperatingRegion, OperationalRisk, Route, Vehicle } from "../entities";
import type { ScenarioRepository } from "../ports/ScenarioRepository";

export type AuthoritativeVerticalClearanceAssessmentInput = Readonly<{ vehicleId: string; riskId: string; clearanceBufferMeters: number }>;

type InvalidReasonCode =
  | "INVALID_BUFFER" | "VEHICLE_NOT_FOUND" | "ROUTE_NOT_FOUND" | "RISK_NOT_FOUND"
  | "RISK_KIND_NOT_HEIGHT_RESTRICTION" | "ROUTE_OWNERSHIP_MISMATCH" | "VEHICLE_NOT_AFFECTED"
  | "ROUTE_RISK_ASSOCIATION_MISSING" | "ROUTE_SPECIFIC_SNAP_MISSING" | "ROUTE_SPECIFIC_SNAP_INCONSISTENT"
  | "INVALID_VEHICLE_HEIGHT" | "INVALID_RESTRICTION_LIMIT" | "INVALID_REQUIRED_CLEARANCE";

type InvalidAssessment = Readonly<{ ok: false; reasonCode: InvalidReasonCode }>;

export type AuthoritativeVerticalClearanceAssessmentResult =
  | InvalidAssessment
  | Readonly<{
      ok: true;
      data: Readonly<{
        vehicleId: string; riskId: string; routeId: string;
        vehicleHeightMeters: number; clearanceBufferMeters: number;
        requiredClearanceMeters: number; restrictionLimitMeters: number;
        status: "PASS" | "FAIL";
        reasonCode: "CLEARANCE_SATISFIED" | "CLEARANCE_VIOLATION";
      }>;
    }>;

export type AssessAuthoritativeVerticalClearance = (input: AuthoritativeVerticalClearanceAssessmentInput) => AuthoritativeVerticalClearanceAssessmentResult;

type SnapValidation = Readonly<{ ok: true }> | InvalidAssessment;
type ScenarioReader = Pick<ScenarioRepository, "scenarioCurrent">;
type Coordinate = readonly [number, number];
type ValidSnap = Readonly<{ riskId: string; routeId: string; kind: "point" | "segment"; startIndex: number; endIndex: number; startCoordinate: Coordinate; endCoordinate: Coordinate }>;

function invalid(reasonCode: InvalidReasonCode): InvalidAssessment {
  return { ok: false, reasonCode };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCoordinate(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && value.every((entry: unknown) => typeof entry === "number" && Number.isFinite(entry));
}

function isIndex(value: unknown, length: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0 && value < length;
}

function validatedSnap(value: unknown, routeId: string, riskId: string, geometry: unknown): ValidSnap | false {
  if (!isRecord(value) || value.riskId !== riskId || value.routeId !== routeId || (value.kind !== "point" && value.kind !== "segment") || !Array.isArray(geometry)) {
    return false;
  }
  const { startIndex, endIndex } = value;
  if (!isIndex(startIndex, geometry.length) || !isIndex(endIndex, geometry.length) || (value.kind === "point" ? endIndex !== startIndex : endIndex !== startIndex + 1)) {
    return false;
  }
  const startCoordinate = value.startCoordinate;
  const endCoordinate = value.endCoordinate;
  const routeStart: unknown = geometry[startIndex];
  const routeEnd: unknown = geometry[endIndex];
  if (!isCoordinate(startCoordinate) || !isCoordinate(endCoordinate) || !isCoordinate(routeStart) || !isCoordinate(routeEnd)
    || startCoordinate[0] !== routeStart[0] || startCoordinate[1] !== routeStart[1]
    || endCoordinate[0] !== routeEnd[0] || endCoordinate[1] !== routeEnd[1]) {
    return false;
  }
  return { riskId, routeId, kind: value.kind, startIndex, endIndex, startCoordinate, endCoordinate };
}

function snapsMatch(left: ValidSnap, right: ValidSnap): boolean {
  return left.riskId === right.riskId
    && left.routeId === right.routeId
    && left.kind === right.kind
    && left.startIndex === right.startIndex
    && left.endIndex === right.endIndex
    && left.startCoordinate[0] === right.startCoordinate[0]
    && left.startCoordinate[1] === right.startCoordinate[1]
    && left.endCoordinate[0] === right.endCoordinate[0]
    && left.endCoordinate[1] === right.endCoordinate[1];
}

function validateRouteSnap(route: Route, risk: OperationalRisk): SnapValidation {
  const routeSnaps = (Array.isArray(route.riskSnaps) ? route.riskSnaps : []).filter((snap: unknown) => isRecord(snap) && snap.riskId === risk.id);
  if (routeSnaps.length === 0) {
    return invalid("ROUTE_RISK_ASSOCIATION_MISSING");
  }
  if (routeSnaps.length !== 1) {
    return invalid("ROUTE_SPECIFIC_SNAP_INCONSISTENT");
  }

  const riskSnaps = (Array.isArray(risk.routeSnaps) ? risk.routeSnaps : []).filter((snap: unknown) => isRecord(snap) && snap.riskId === risk.id && snap.routeId === route.id);
  if (riskSnaps.length === 0) {
    return invalid("ROUTE_SPECIFIC_SNAP_MISSING");
  }
  if (riskSnaps.length !== 1) {
    return invalid("ROUTE_SPECIFIC_SNAP_INCONSISTENT");
  }
  const feature: unknown = route.geometry;
  const geometry = isRecord(feature) && isRecord(feature.geometry) ? feature.geometry.coordinates : false;
  const routeSnap = validatedSnap(routeSnaps[0], route.id, risk.id, geometry);
  const riskSnap = validatedSnap(riskSnaps[0], route.id, risk.id, geometry);
  if (routeSnap === false || riskSnap === false || !snapsMatch(routeSnap, riskSnap)) {
    return invalid("ROUTE_SPECIFIC_SNAP_INCONSISTENT");
  }
  return { ok: true };
}

function isPositiveFinite(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function decide(vehicle: Vehicle, route: Route, risk: OperationalRisk, input: AuthoritativeVerticalClearanceAssessmentInput): AuthoritativeVerticalClearanceAssessmentResult {
  const vehicleHeightMeters = vehicle.dimensions.heightMeters;
  if (!isPositiveFinite(vehicleHeightMeters)) {
    return invalid("INVALID_VEHICLE_HEIGHT");
  }
  const restrictionLimitMeters = risk.limitMeters;
  if (!isPositiveFinite(restrictionLimitMeters)) {
    return invalid("INVALID_RESTRICTION_LIMIT");
  }

  const requiredClearanceMeters = vehicleHeightMeters + input.clearanceBufferMeters;
  if (!Number.isFinite(requiredClearanceMeters)) {
    return invalid("INVALID_REQUIRED_CLEARANCE");
  }
  const status = requiredClearanceMeters <= restrictionLimitMeters ? "PASS" : "FAIL";
  return {
    ok: true,
    data: {
      vehicleId: vehicle.internalId,
      riskId: risk.id,
      routeId: route.id,
      vehicleHeightMeters,
      clearanceBufferMeters: input.clearanceBufferMeters,
      requiredClearanceMeters,
      restrictionLimitMeters,
      status,
      reasonCode: status === "PASS" ? "CLEARANCE_SATISFIED" : "CLEARANCE_VIOLATION",
    },
  };
}

function assessScenario(scenario: OperatingRegion, input: AuthoritativeVerticalClearanceAssessmentInput): AuthoritativeVerticalClearanceAssessmentResult {
  const vehicle = scenario.vehicles.find((candidate) => candidate.internalId === input.vehicleId);
  if (vehicle === undefined) {
    return invalid("VEHICLE_NOT_FOUND");
  }
  const route = scenario.routes.find((candidate) => candidate.id === vehicle.routeId);
  if (route === undefined) {
    return invalid("ROUTE_NOT_FOUND");
  }
  if (route.vehicleId !== vehicle.internalId) {
    return invalid("ROUTE_OWNERSHIP_MISMATCH");
  }
  const risk = scenario.risks.find((candidate) => candidate.id === input.riskId);
  if (risk === undefined) {
    return invalid("RISK_NOT_FOUND");
  }
  if (risk.kind !== "height-restriction") {
    return invalid("RISK_KIND_NOT_HEIGHT_RESTRICTION");
  }
  if (!risk.affectedVehicleIds.includes(vehicle.internalId)) {
    return invalid("VEHICLE_NOT_AFFECTED");
  }
  const snapValidation = validateRouteSnap(route, risk);
  if (!snapValidation.ok) {
    return snapValidation;
  }
  return decide(vehicle, route, risk, input);
}

export function createAssessAuthoritativeVerticalClearance(repository: ScenarioReader): AssessAuthoritativeVerticalClearance {
  return (input) => {
    if (!Number.isFinite(input.clearanceBufferMeters) || input.clearanceBufferMeters < 0) {
      return invalid("INVALID_BUFFER");
    }
    return assessScenario(repository.scenarioCurrent(), input);
  };
}
