import { isVehicleLabelValid, type DomainResult, type FleetStatus, type OperatingRegion, type Vehicle, type VehicleRenameCommand, type VehicleStatus } from "../entities";
import { deepDetachAndFreeze } from "../deepDetach";
import type { ScenarioRepository } from "../ports/ScenarioRepository";
import { createAssessAuthoritativeVerticalClearance, type AssessAuthoritativeVerticalClearance } from "./authoritativeVerticalAssessment";
import { createUnit211PreDispatchContext, type Unit211PreDispatchContextResult } from "./unit211PreDispatchContext";

type OperationsApiOptions = { readAlternativeCatalog(): unknown; admittedAlternativeCatalog: unknown };

export type OperationsApi = {
  scenarioCurrent(): DomainResult<OperatingRegion>;
  assessAuthoritativeVerticalClearance: AssessAuthoritativeVerticalClearance;
  unit211PreDispatchContext(): Unit211PreDispatchContextResult;
  fleetStatus(): DomainResult<FleetStatus>;
  vehicleGet(vehicleId: string): DomainResult<Vehicle>;
  vehicleRename(command: VehicleRenameCommand): DomainResult<Vehicle>;
  vehicleDelete(vehicleId: string): DomainResult<Vehicle>;
};

function failure<T>(code: string, message: string): DomainResult<T> {
  return { ok: false, error: { code, message } };
}

function vehicleResult(vehicle: Vehicle | undefined, vehicleId: string): DomainResult<Vehicle> {
  if (vehicle === undefined) return failure("vehicle-not-found", `Vehicle ${vehicleId} was not found.`);
  const detached = deepDetachAndFreeze(vehicle);
  return detached.ok ? { ok: true, data: detached.data } : failure("repository-data-invalid", "The vehicle repository returned malformed data.");
}

export function createOperationsApi(repository: ScenarioRepository, options?: OperationsApiOptions): OperationsApi {
  return {
    scenarioCurrent: () => {
      try {
        const detached = deepDetachAndFreeze(repository.scenarioCurrent());
        return detached.ok ? { ok: true, data: detached.data } : failure("repository-data-invalid", "The scenario repository returned malformed data.");
      } catch {
        return failure("repository-data-invalid", "The scenario repository returned malformed data.");
      }
    },
    assessAuthoritativeVerticalClearance: createAssessAuthoritativeVerticalClearance(repository),
    unit211PreDispatchContext: createUnit211PreDispatchContext(repository, options?.readAlternativeCatalog ?? (() => undefined), options?.admittedAlternativeCatalog),
    fleetStatus: () => {
      const byStatus: Record<VehicleStatus, number> = { driving: 0, resting: 0, "needs-attention": 0, critical: 0 };
      for (const vehicle of repository.scenarioCurrent().vehicles) {
        byStatus[vehicle.status] += 1;
      }
      return { ok: true, data: { total: repository.scenarioCurrent().vehicles.length, byStatus } };
    },
    vehicleGet: (vehicleId) => vehicleResult(repository.vehicleGet(vehicleId), vehicleId),
    vehicleRename: ({ vehicleId, label }) => {
      const normalizedLabel = label.trim();
      if (!isVehicleLabelValid(normalizedLabel)) {
        return failure("invalid-label", "Vehicle labels must contain between 1 and 64 characters.");
      }
      return vehicleResult(repository.vehicleRename(vehicleId, normalizedLabel), vehicleId);
    },
    vehicleDelete: (vehicleId) => vehicleResult(repository.vehicleDelete(vehicleId), vehicleId),
  };
}
