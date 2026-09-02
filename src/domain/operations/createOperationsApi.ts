import { isVehicleLabelValid, type DomainResult, type FleetStatus, type OperatingRegion, type Vehicle, type VehicleRenameCommand, type VehicleStatus, type VehicleCreateCommand, type VehicleUpdateCommand, type VehicleAssignRouteCommand } from "../entities";
import { deepDetachAndFreeze } from "../deepDetach";
import type { ScenarioRepository } from "../ports/ScenarioRepository";
import { createAssessAuthoritativeVerticalClearance, type AssessAuthoritativeVerticalClearance } from "./authoritativeVerticalAssessment";
import { createUnit211PreDispatchContext, type Unit211PreDispatchContextResult } from "./unit211PreDispatchContext";
import { geoPoint, type Coordinates } from "../../scenario/geometry";

type OperationsApiOptions = { readAlternativeCatalog(): unknown; admittedAlternativeCatalog: unknown };

export type OperationsApi = {
  scenarioCurrent(): DomainResult<OperatingRegion>;
  scenarioRegionSelect(regionId: string): DomainResult<OperatingRegion>;
  assessAuthoritativeVerticalClearance: AssessAuthoritativeVerticalClearance;
  unit211PreDispatchContext(): Unit211PreDispatchContextResult;
  fleetStatus(): DomainResult<FleetStatus>;
  vehicleGet(vehicleId: string): DomainResult<Vehicle>;
  vehicleRename(command: VehicleRenameCommand): DomainResult<Vehicle>;
  vehicleDelete(vehicleId: string): DomainResult<Vehicle>;
  vehicleCreate(command: VehicleCreateCommand): DomainResult<Vehicle>;
  vehicleUpdate(command: VehicleUpdateCommand): DomainResult<Vehicle>;
  vehicleAssignRoute(command: VehicleAssignRouteCommand): DomainResult<Vehicle>;
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
    scenarioRegionSelect: (regionId) => {
      try {
        const selected = repository.scenarioRegionSelect(regionId);
        if (!selected) return failure("region-not-found", `Region ${regionId} was not found.`);
        const detached = deepDetachAndFreeze(selected);
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
    vehicleCreate: (command) => {
      if (!command.fleetNumber || !command.fleetNumber.trim()) {
        return failure("invalid-input", "Vehicle fleet number is required.");
      }
      if (!command.plate || !command.plate.trim()) {
        return failure("invalid-input", "Vehicle license plate is required.");
      }

      const scenario = repository.scenarioCurrent();
      const coords: Coordinates = command.initialPosition
        ? Array.isArray(command.initialPosition)
          ? [command.initialPosition[0], command.initialPosition[1]]
          : [command.initialPosition.longitude, command.initialPosition.latitude]
        : [-3.7038, 40.4168];
      let startCoords: Coordinates = coords;
      let endCoords: Coordinates = coords;
      let originName = "Madrid Reserve";
      let destName = "Madrid Reserve";
      let status: Vehicle["status"] = "resting";
      let assignedRouteId = "";

      if (command.routeId && command.routeId.trim()) {
        const route = scenario.routes.find((r) => r.id === command.routeId);
        if (!route) {
          return failure("route-not-found", `Route '${command.routeId}' does not exist.`);
        }
        const existingWithRoute = scenario.vehicles.find((v) => v.routeId === command.routeId);
        if (existingWithRoute) {
          return failure("route-already-assigned", `Route '${command.routeId}' is already assigned to vehicle ${existingWithRoute.fleetNumber || existingWithRoute.internalId}.`);
        }
        startCoords = route.geometry.geometry.coordinates[0] as Coordinates;
        endCoords = (route.geometry.geometry.coordinates[route.geometry.geometry.coordinates.length - 1] ?? startCoords) as Coordinates;
        originName = route.name.split("→")[0]?.trim() || "Origin";
        destName = route.name.split("→")[1]?.trim() || "Destination";
        status = "driving";
        assignedRouteId = command.routeId;
      }

      const DEMO_CLOCK_EPOCH_MS = Date.parse("2026-08-28T09:00:00.000Z");
      const internalId = `vehicle-${crypto.randomUUID().slice(0, 8)}`;
      const newVehicle: Vehicle = {
        internalId,
        fleetNumber: command.fleetNumber.trim(),
        label: (command.label || command.fleetNumber).trim(),
        plate: command.plate.trim(),
        position: geoPoint(startCoords),
        status,
        cargo: {
          id: `cargo-${crypto.randomUUID().slice(0, 8)}`,
          description: command.cargo?.description || "General Freight",
          refrigeration: command.cargo?.refrigeration || "ambient",
          priority: command.cargo?.priority || "standard",
        },
        dimensions: {
          vehicleType: command.dimensions?.vehicleType || "Articulated curtain-sider",
          heightMeters: Number(command.dimensions?.heightMeters) || 3.8,
          lengthMeters: Number(command.dimensions?.lengthMeters) || 16.5,
          weightTonnes: Number(command.dimensions?.weightTonnes) || 24,
        },
        timing: {
          remainingDriveMinutes: status === "driving" ? 240 : 0,
          restDeadline: new Date(DEMO_CLOCK_EPOCH_MS + 4.5 * 3600 * 1000).toISOString(),
          eta: new Date(DEMO_CLOCK_EPOCH_MS + 3.5 * 3600 * 1000).toISOString(),
          delayMinutes: 0,
        },
        origin: { id: `origin-${internalId}`, name: originName, position: geoPoint(startCoords) },
        destination: { id: `dest-${internalId}`, name: destName, position: geoPoint(endCoords) },
        currentRoute: assignedRouteId,
        routeId: assignedRouteId,
        routeProgress: 0,
        riskIds: [],
        speedKmH: status === "driving" ? 78 : 0,
      };

      return vehicleResult(repository.vehicleCreate(newVehicle), internalId);
    },
    vehicleUpdate: (command) => {
      const existing = repository.vehicleGet(command.vehicleId);
      if (!existing) {
        return failure("vehicle-not-found", `Vehicle '${command.vehicleId}' not found.`);
      }
      const cargoId = existing.cargo.id;
      const updates: Partial<Vehicle> = {
        plate: command.plate?.trim() || existing.plate,
        label: command.label?.trim() || existing.label,
        dimensions: command.dimensions ? {
          vehicleType: command.dimensions.vehicleType ?? existing.dimensions.vehicleType,
          heightMeters: Number(command.dimensions.heightMeters) || existing.dimensions.heightMeters,
          lengthMeters: Number(command.dimensions.lengthMeters) || existing.dimensions.lengthMeters,
          weightTonnes: Number(command.dimensions.weightTonnes) || existing.dimensions.weightTonnes,
        } : existing.dimensions,
        cargo: command.cargo ? {
          id: cargoId,
          description: command.cargo.description ?? existing.cargo.description,
          refrigeration: command.cargo.refrigeration ?? existing.cargo.refrigeration,
          priority: command.cargo.priority ?? existing.cargo.priority,
        } : existing.cargo,
      };
      return vehicleResult(repository.vehicleUpdate(command.vehicleId, updates), command.vehicleId);
    },
    vehicleAssignRoute: (command) => {
      const existing = repository.vehicleGet(command.vehicleId);
      if (!existing) {
        return failure("vehicle-not-found", `Vehicle '${command.vehicleId}' not found.`);
      }
      const scenario = repository.scenarioCurrent();

      if (command.routeId && command.routeId.trim()) {
        const route = scenario.routes.find((r) => r.id === command.routeId);
        if (!route) {
          return failure("route-not-found", `Route '${command.routeId}' does not exist.`);
        }
        const existingWithRoute = scenario.vehicles.find((v) => v.internalId !== command.vehicleId && v.routeId === command.routeId);
        if (existingWithRoute) {
          return failure("route-already-assigned", `Route '${command.routeId}' is already assigned to vehicle ${existingWithRoute.fleetNumber || existingWithRoute.internalId}.`);
        }
        const startCoords = route.geometry.geometry.coordinates[0] as Coordinates;
        const endCoords = (route.geometry.geometry.coordinates[route.geometry.geometry.coordinates.length - 1] ?? startCoords) as Coordinates;
        const originName = route.name.split("→")[0]?.trim() || existing.origin.name;
        const destName = route.name.split("→")[1]?.trim() || existing.destination.name;
        const updates: Partial<Vehicle> = {
          routeId: command.routeId,
          currentRoute: command.routeId,
          routeProgress: 0,
          status: "driving",
          position: geoPoint(startCoords),
          origin: { id: `origin-${command.vehicleId}`, name: originName, position: geoPoint(startCoords) },
          destination: { id: `dest-${command.vehicleId}`, name: destName, position: geoPoint(endCoords) },
          speedKmH: 78,
        };
        repository.vehicleUpdate(command.vehicleId, updates);
        return vehicleResult(repository.vehicleAssignRoute(command.vehicleId, command.routeId), command.vehicleId);
      } else {
        const updates: Partial<Vehicle> = {
          routeId: "",
          currentRoute: "",
          routeProgress: 0,
          status: "resting",
          speedKmH: 0,
        };
        repository.vehicleUpdate(command.vehicleId, updates);
        return vehicleResult(repository.vehicleAssignRoute(command.vehicleId, undefined), command.vehicleId);
      }
    },
  };
}
