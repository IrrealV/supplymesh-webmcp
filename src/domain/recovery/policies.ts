import { booleanIntersects } from "@turf/turf";
import type { GeoLine, GeoPolygon } from "../entities";
import type {
  CargoAssignment,
  CargoContinuityValidation,
  ClearanceValidation,
  GeometryAvoidanceValidation,
  RestWindowValidation,
  ScenarioClock,
} from "./types";

export const CLEARANCE_BUFFER_METERS_MIN = 0;
export const CLEARANCE_BUFFER_METERS_MAX = 1;

type ClearancePolicyInput = {
  availableClearanceMeters: number;
  clearanceBufferMeters: number;
  isRestrictionApplicable: boolean;
  vehicleHeightMeters: number;
};

type RestWindowInput = {
  currentProgress: number;
  protectRestDeadline: boolean;
  remainingDriveMinutes: number;
  reserveMinutes: number;
  restDeadline: string;
  routeDurationSeconds: number;
  scenarioClock: ScenarioClock;
};

function isFiniteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function roundMeters(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

export function isClearanceBufferMetersValid(bufferMeters: number): boolean {
  return Number.isFinite(bufferMeters)
    && bufferMeters >= CLEARANCE_BUFFER_METERS_MIN
    && bufferMeters <= CLEARANCE_BUFFER_METERS_MAX;
}

export function validateClearancePolicy(input: ClearancePolicyInput): ClearanceValidation {
  const requiredClearanceMeters = roundMeters(
    input.vehicleHeightMeters + input.clearanceBufferMeters,
  );
  const isValid = isFiniteNonNegative(input.vehicleHeightMeters)
    && isFiniteNonNegative(input.availableClearanceMeters)
    && isClearanceBufferMetersValid(input.clearanceBufferMeters);

  if (!isValid) {
    return {
      ...input,
      reasonCode: "CLEARANCE_DATA_INVALID",
      requiredClearanceMeters: 0,
      status: "UNKNOWN",
    };
  }
  if (!input.isRestrictionApplicable) {
    return {
      availableClearanceMeters: input.availableClearanceMeters,
      clearanceBufferMeters: input.clearanceBufferMeters,
      reasonCode: "CLEARANCE_RESTRICTION_AVOIDED",
      requiredClearanceMeters,
      status: "PASS",
      vehicleHeightMeters: input.vehicleHeightMeters,
    };
  }

  const isSatisfied = input.availableClearanceMeters >= requiredClearanceMeters;
  return {
    availableClearanceMeters: input.availableClearanceMeters,
    clearanceBufferMeters: input.clearanceBufferMeters,
    reasonCode: isSatisfied
      ? "CLEARANCE_REQUIREMENT_SATISFIED"
      : "CLEARANCE_BUFFER_VIOLATION",
    requiredClearanceMeters,
    status: isSatisfied ? "PASS" : "FAIL",
    vehicleHeightMeters: input.vehicleHeightMeters,
  };
}

export function validateGeometryAvoidance(
  routeGeometry: GeoLine,
  exclusionZone: GeoPolygon,
  minimumSeparationMeters: number,
): GeometryAvoidanceValidation {
  if (!Number.isFinite(minimumSeparationMeters) || minimumSeparationMeters < 0) {
    return {
      minimumSeparationMeters: 0,
      reasonCode: "GEOMETRY_DATA_INVALID",
      status: "UNKNOWN",
    };
  }

  try {
    if (booleanIntersects(routeGeometry, exclusionZone)) {
      return {
        minimumSeparationMeters: 0,
        reasonCode: "EXCLUSION_ZONE_INTERSECTION",
        status: "FAIL",
      };
    }
  } catch {
    return {
      minimumSeparationMeters: 0,
      reasonCode: "GEOMETRY_DATA_INVALID",
      status: "UNKNOWN",
    };
  }

  return {
    minimumSeparationMeters,
    reasonCode: "EXCLUSION_ZONE_AVOIDED",
    status: "PASS",
  };
}

function invalidRestWindow(input: RestWindowInput): RestWindowValidation {
  return {
    estimatedCompletionAt: "",
    isCompletionBeforeDeadline: false,
    isDurationWithinRemainingDrive: false,
    reasonCode: "REST_WINDOW_DATA_INVALID",
    remainingDriveMinutes: input.remainingDriveMinutes,
    remainingRouteMinutes: 0,
    reserveMinutes: input.reserveMinutes,
    restDeadline: input.restDeadline,
    status: "UNKNOWN",
  };
}

export function validateRestWindow(input: RestWindowInput): RestWindowValidation {
  const clockMilliseconds = Date.parse(input.scenarioClock.instant);
  const deadlineMilliseconds = Date.parse(input.restDeadline);
  const isValid = Number.isFinite(clockMilliseconds)
    && Number.isFinite(deadlineMilliseconds)
    && isFiniteNonNegative(input.routeDurationSeconds)
    && isFiniteNonNegative(input.remainingDriveMinutes)
    && isFiniteNonNegative(input.reserveMinutes)
    && Number.isFinite(input.currentProgress)
    && input.currentProgress >= 0
    && input.currentProgress <= 1;

  if (!isValid) {
    return invalidRestWindow(input);
  }

  const remainingRouteSeconds = input.routeDurationSeconds * (1 - input.currentProgress);
  const remainingRouteMinutes = remainingRouteSeconds / 60;
  const estimatedCompletionAt = new Date(
    clockMilliseconds + (remainingRouteSeconds + input.reserveMinutes * 60) * 1_000,
  ).toISOString();
  const isDurationWithinRemainingDrive =
    remainingRouteMinutes + input.reserveMinutes <= input.remainingDriveMinutes;
  const isCompletionBeforeDeadline = Date.parse(estimatedCompletionAt) <= deadlineMilliseconds;

  if (!input.protectRestDeadline) {
    return {
      estimatedCompletionAt,
      isCompletionBeforeDeadline,
      isDurationWithinRemainingDrive,
      reasonCode: "REST_PROTECTION_DISABLED",
      remainingDriveMinutes: input.remainingDriveMinutes,
      remainingRouteMinutes,
      reserveMinutes: input.reserveMinutes,
      restDeadline: input.restDeadline,
      status: "PASS",
    };
  }

  const isSatisfied = isDurationWithinRemainingDrive && isCompletionBeforeDeadline;
  return {
    estimatedCompletionAt,
    isCompletionBeforeDeadline,
    isDurationWithinRemainingDrive,
    reasonCode: isSatisfied ? "REST_WINDOW_SATISFIED" : "REST_WINDOW_VIOLATION",
    remainingDriveMinutes: input.remainingDriveMinutes,
    remainingRouteMinutes,
    reserveMinutes: input.reserveMinutes,
    restDeadline: input.restDeadline,
    status: isSatisfied ? "PASS" : "FAIL",
  };
}

export function validateCargoContinuity(
  before: CargoAssignment,
  after: CargoAssignment,
): CargoContinuityValidation {
  const vehicleUnchanged = before.vehicleId === after.vehicleId;
  const destinationUnchanged = before.destinationId === after.destinationId;
  const cargoAssignmentUnchanged =
    before.cargo.description === after.cargo.description
    && before.cargo.refrigeration === after.cargo.refrigeration
    && before.cargo.priority === after.cargo.priority;
  const isPreserved = vehicleUnchanged
    && destinationUnchanged
    && cargoAssignmentUnchanged;

  return {
    cargoAssignmentUnchanged,
    destinationUnchanged,
    reasonCode: isPreserved
      ? "CARGO_CONTINUITY_PRESERVED"
      : "CARGO_CONTINUITY_VIOLATION",
    status: isPreserved ? "PASS" : "FAIL",
    vehicleUnchanged,
  };
}
