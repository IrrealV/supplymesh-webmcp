import { describe, expect, it } from "vitest";
import { createOperationsApi } from "./createOperationsApi";
import { createZustandScenarioRepository } from "../../scenario/state/createZustandScenarioRepository";
import type { VehicleCreateCommand, VehicleUpdateCommand, VehicleAssignRouteCommand } from "../entities";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe("createOperationsApi", () => {
  it("should create a new resting vehicle at valid Madrid logistics hub coordinates", () => {
    const repository = createZustandScenarioRepository(new MemoryStorage());
    const api = createOperationsApi(repository);
    const command: VehicleCreateCommand = {
      fleetNumber: "Unit 888",
      plate: "8888-ABC",
      label: "Madrid Reserve",
      dimensions: { vehicleType: "Articulated curtain-sider", lengthMeters: 16.5, heightMeters: 3.8, weightTonnes: 24 },
      cargo: { description: "Dry Goods", refrigeration: "ambient", priority: "standard" }
    };
    const result = api.vehicleCreate(command);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.fleetNumber).toBe("Unit 888");
      expect(result.data.status).toBe("resting");
      expect(result.data.position.geometry.coordinates).toStrictEqual([-3.7038, 40.4168]);
      expect(result.data.position.geometry.coordinates).not.toStrictEqual([0, 0]);
      expect(result.data.timing.restDeadline.length).toBeGreaterThan(0);
      expect(result.data.cargo.id).toMatch(/^cargo-/);
    }
  });

  it("should create a driving vehicle at the start coordinates of its assigned route", () => {
    const repository = createZustandScenarioRepository(new MemoryStorage());
    repository.vehicleAssignRoute("vehicle-012", "");
    const api = createOperationsApi(repository);
    // route-012 exists and is now unassigned
    const command: VehicleCreateCommand = {
      fleetNumber: "Unit 777",
      plate: "7777-XYZ",
      label: "Active Freight",
      routeId: "route-012",
      dimensions: { vehicleType: "Articulated curtain-sider", lengthMeters: 16.5, heightMeters: 3.8, weightTonnes: 24 },
      cargo: { description: "Produce", refrigeration: "chilled", priority: "priority" }
    };
    const result = api.vehicleCreate(command);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe("driving");
      expect(result.data.routeId).toBe("route-012");
      expect(result.data.position.geometry.coordinates[0]).not.toBe(0);
      expect(result.data.position.geometry.coordinates[1]).not.toBe(0);
    }
  });

  it("should reject assigning a route that is already assigned to another vehicle", () => {
    const repository = createZustandScenarioRepository(new MemoryStorage());
    const api = createOperationsApi(repository);
    
    // Create vehicle without route
    const created = api.vehicleCreate({
      fleetNumber: "Unit 666",
      plate: "6666-BBB",
      label: "Extra Unit",
      dimensions: { vehicleType: "Articulated curtain-sider", lengthMeters: 16.5, heightMeters: 3.8, weightTonnes: 24 },
      cargo: { description: "Parts", refrigeration: "ambient", priority: "standard" }
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    // Try assigning route-011 (already assigned to Unit 211)
    const assignCommand: VehicleAssignRouteCommand = {
      vehicleId: created.data.internalId,
      routeId: "route-011"
    };
    const assignResult = api.vehicleAssignRoute(assignCommand);
    expect(assignResult.ok).toBe(false);
    if (!assignResult.ok) {
      expect(assignResult.error.code).toBe("route-already-assigned");
    }
  });

  it("should update a vehicle and preserve its cargo id", () => {
    const repository = createZustandScenarioRepository(new MemoryStorage());
    const api = createOperationsApi(repository);
    const vehicleId = repository.scenarioCurrent().vehicles[0].internalId;
    const initial = api.vehicleGet(vehicleId);
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;

    const command: VehicleUpdateCommand = {
      vehicleId,
      plate: "9999-NEW",
      label: "Updated Label",
      dimensions: { vehicleType: "Articulated curtain-sider", lengthMeters: 18, heightMeters: 4.1, weightTonnes: 26 },
      cargo: { description: "Pharma", refrigeration: "chilled", priority: "critical" }
    };
    const result = api.vehicleUpdate(command);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.plate).toBe("9999-NEW");
      expect(result.data.label).toBe("Updated Label");
      expect(result.data.cargo.id).toBe(initial.data.cargo.id);
      expect(result.data.dimensions.heightMeters).toBe(4.1);
    }
  });
});
