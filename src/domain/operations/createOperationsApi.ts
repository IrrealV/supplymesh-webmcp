import type { DomainResult, FleetStatus, OperatingRegion, Vehicle, VehicleRenameCommand, VehicleStatus } from "../entities";
import type { ScenarioRepository } from "../ports/ScenarioRepository";

export type OperationsApi = {
  scenarioCurrent(): DomainResult<OperatingRegion>;
  fleetStatus(): DomainResult<FleetStatus>;
  vehicleGet(vehicleId: string): DomainResult<Vehicle>;
  vehicleRename(command: VehicleRenameCommand): DomainResult<Vehicle>;
  vehicleDelete(vehicleId: string): DomainResult<Vehicle>;
};

function failure<T>(code: string, message: string): DomainResult<T> {
  return { ok: false, error: { code, message } };
}

function vehicleResult(vehicle: Vehicle | undefined, vehicleId: string): DomainResult<Vehicle> {
  return vehicle === undefined ? failure("vehicle-not-found", `Vehicle ${vehicleId} was not found.`) : { ok: true, data: vehicle };
}

export function createOperationsApi(repository: ScenarioRepository): OperationsApi {
  return {
    scenarioCurrent: () => ({ ok: true, data: repository.scenarioCurrent() }),
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
      if (normalizedLabel.length === 0 || normalizedLabel.length > 64) {
        return failure("invalid-label", "Vehicle labels must contain between 1 and 64 characters.");
      }
      return vehicleResult(repository.vehicleRename(vehicleId, normalizedLabel), vehicleId);
    },
    vehicleDelete: (vehicleId) => vehicleResult(repository.vehicleDelete(vehicleId), vehicleId),
  };
}
