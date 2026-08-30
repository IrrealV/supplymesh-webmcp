import type { Route, Vehicle } from "../../domain/entities";
import {
  validateCargoContinuity,
  validateClearancePolicy,
  validateGeometryAvoidance,
  validateRestWindow,
} from "../../domain/recovery/policies";
import type {
  OperationalRecoverySnapshot,
  RecoveryOption,
  RecoveryOptionValidation,
} from "../../domain/recovery/types";
import { readClearanceAlternativeRuntime } from "./clearanceAlternativeAdapter";

function requiredVehicle(snapshot: OperationalRecoverySnapshot): Vehicle {
  const vehicle = snapshot.scenario.vehicles.find(
    ({ internalId }) => internalId === snapshot.incident.vehicleId,
  );
  if (vehicle === undefined) {
    throw new Error("Unit 211 is unavailable for recovery comparison.");
  }
  return vehicle;
}

function requiredRoute(snapshot: OperationalRecoverySnapshot): Route {
  const route = snapshot.scenario.routes.find(
    ({ id }) => id === snapshot.incident.routeId,
  );
  if (route === undefined) {
    throw new Error("Unit 211 current route is unavailable for recovery comparison.");
  }
  return route;
}

function optionIsFeasible(validation: RecoveryOptionValidation): boolean {
  return Object.values(validation).every(({ status }) => status === "PASS");
}

function reasonCodes(validation: RecoveryOptionValidation): string[] {
  return Object.values(validation)
    .filter(({ status }) => status !== "PASS")
    .map(({ reasonCode }) => reasonCode);
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

export function createUnit211RecoveryOptions(
  snapshot: OperationalRecoverySnapshot,
): RecoveryOption[] {
  const runtime = readClearanceAlternativeRuntime();
  const vehicle = requiredVehicle(snapshot);
  const currentRoute = requiredRoute(snapshot);
  const cargoAssignment = {
    cargo: vehicle.cargo,
    destinationId: vehicle.destination.name,
    vehicleId: vehicle.internalId,
  };
  const clearanceBufferMeters = snapshot.constraints.clearanceBufferMeters.value;
  const protectRestDeadline = snapshot.constraints.protectRestDeadline.value;

  const currentValidation: RecoveryOptionValidation = {
    cargoContinuity: validateCargoContinuity(cargoAssignment, cargoAssignment),
    clearance: validateClearancePolicy({
      availableClearanceMeters: snapshot.incident.availableClearanceMeters,
      clearanceBufferMeters,
      isRestrictionApplicable: true,
      vehicleHeightMeters: vehicle.dimensions.heightMeters,
    }),
    geometryAvoidance: validateGeometryAvoidance(
      currentRoute.geometry,
      snapshot.incident.exclusionZone,
      0,
    ),
    restWindow: validateRestWindow({
      currentProgress: vehicle.routeProgress,
      protectRestDeadline,
      remainingDriveMinutes: vehicle.timing.remainingDriveMinutes,
      reserveMinutes: 0,
      restDeadline: vehicle.timing.restDeadline,
      routeDurationSeconds: currentRoute.summary.durationSeconds,
      scenarioClock: snapshot.scenarioClock,
    }),
  };
  const alternativeValidation: RecoveryOptionValidation = {
    cargoContinuity: validateCargoContinuity(cargoAssignment, cargoAssignment),
    clearance: validateClearancePolicy({
      availableClearanceMeters: snapshot.incident.availableClearanceMeters,
      clearanceBufferMeters,
      isRestrictionApplicable: false,
      vehicleHeightMeters: vehicle.dimensions.heightMeters,
    }),
    geometryAvoidance: validateGeometryAvoidance(
      runtime.geometry,
      snapshot.incident.exclusionZone,
      runtime.minimumSeparationMeters,
    ),
    restWindow: validateRestWindow({
      currentProgress: 0,
      protectRestDeadline,
      remainingDriveMinutes: vehicle.timing.remainingDriveMinutes,
      reserveMinutes: 0,
      restDeadline: vehicle.timing.restDeadline,
      routeDurationSeconds: runtime.summary.durationSeconds,
      scenarioClock: snapshot.scenarioClock,
    }),
  };

  return [
    {
      currentRouteId: currentRoute.id,
      feasible: optionIsFeasible(currentValidation),
      geometry: structuredClone(currentRoute.geometry),
      id: "option-current-route-011",
      incidentId: snapshot.incident.id,
      kind: "CURRENT_ROUTE",
      metrics: {
        distanceDeltaMeters: 0,
        durationDeltaSeconds: 0,
        summary: structuredClone(currentRoute.summary),
      },
      reasonCodes: reasonCodes(currentValidation),
      risksIntroduced: [],
      risksResolved: [],
      routeId: currentRoute.id,
      validation: currentValidation,
      vehicleId: vehicle.internalId,
    },
    {
      currentRouteId: currentRoute.id,
      feasible: optionIsFeasible(alternativeValidation),
      geometry: structuredClone(runtime.geometry),
      id: "option-alternative-route-011-clearance-v1",
      incidentId: snapshot.incident.id,
      kind: "ALTERNATIVE_ROUTE",
      metrics: {
        distanceDeltaMeters: roundOne(
          runtime.summary.distanceMeters - currentRoute.summary.distanceMeters,
        ),
        durationDeltaSeconds: roundOne(
          runtime.summary.durationSeconds - currentRoute.summary.durationSeconds,
        ),
        summary: structuredClone(runtime.summary),
      },
      reasonCodes: reasonCodes(alternativeValidation),
      risksIntroduced: [],
      risksResolved: [snapshot.incident.riskId],
      routeId: runtime.alternativeRouteId,
      validation: alternativeValidation,
      vehicleId: vehicle.internalId,
    },
  ];
}
