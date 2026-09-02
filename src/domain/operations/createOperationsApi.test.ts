import { describe, expect, it } from "vitest";
import { createOperationsApi } from "./createOperationsApi";
import type { ScenarioRepository } from "../ports/ScenarioRepository";
import type { Vehicle, VehicleCreateCommand, VehicleUpdateCommand, VehicleAssignRouteCommand, OperatingRegion, FleetStatus, VehicleRenameCommand } from "../entities";

const mockRepository = (): ScenarioRepository => ({
  scenarioCurrent: () => ({} as OperatingRegion),
  fleetStatus: () => ({} as FleetStatus),
  vehicleGet: (id) => ({ cargo: { id: "cargo-1" } } as Vehicle),
  vehicleRename: () => ({} as Vehicle),
  vehicleDelete: () => ({} as Vehicle),
  vehicleCreate: (v) => v,
  vehicleUpdate: (id, updates) => ({ internalId: id, ...updates } as unknown as Vehicle),
  vehicleAssignRoute: (id, routeId) => ({ internalId: id, routeId } as unknown as Vehicle),
});

describe("createOperationsApi", () => {
  it("should create a new vehicle with resting status if no route is assigned", () => {
    const api = createOperationsApi(mockRepository());
    const command: VehicleCreateCommand = {
      fleetNumber: "FM-100",
      plate: "XYZ 123",
      label: "New Vehicle",
      dimensions: { vehicleType: "Truck", lengthMeters: 10, heightMeters: 4, weightTonnes: 15 },
      cargo: { description: "General", refrigeration: "ambient", priority: "standard" }
    };
    const result = api.vehicleCreate(command);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.fleetNumber).toBe("FM-100");
      expect(result.data.status).toBe("resting");
      expect(result.data.cargo.id).toMatch(/^cargo-/);
    }
  });

  it("should update a vehicle and preserve its cargo id", () => {
    const api = createOperationsApi(mockRepository());
    const command: VehicleUpdateCommand = {
      vehicleId: "v-1",
      plate: "XYZ 123",
      label: "Updated Vehicle",
      dimensions: { vehicleType: "Truck", lengthMeters: 10, heightMeters: 4, weightTonnes: 15 },
      cargo: { description: "General", refrigeration: "ambient", priority: "standard" }
    };
    const result = api.vehicleUpdate(command);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.cargo.id).toBe("cargo-1");
    }
  });

  it("should assign a route to a vehicle", () => {
    const api = createOperationsApi(mockRepository());
    const command: VehicleAssignRouteCommand = {
      vehicleId: "v-1",
      routeId: "route-1"
    };
    const result = api.vehicleAssignRoute(command);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.routeId).toBe("route-1");
    }
  });
});
