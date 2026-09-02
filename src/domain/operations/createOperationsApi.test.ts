import { describe, expect, it } from "vitest";
import { createOperationsApi } from "./createOperationsApi";
import { createZustandScenarioRepository } from "../../scenario/state/createZustandScenarioRepository";
import { deriveMapLayers } from "../../features/map/layers";
import type { VehicleCreateCommand, VehicleUpdateCommand, VehicleAssignRouteCommand } from "../entities";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe("createOperationsApi", () => {
  it("should create a new resting vehicle with deterministic demo timing at valid Madrid logistics hub coordinates", () => {
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
      // Deterministic demo clock derivations (2026-08-28T09:00:00.000Z + 4.5h and 3.5h)
      expect(result.data.timing.restDeadline).toBe("2026-08-28T13:30:00.000Z");
      expect(result.data.timing.eta).toBe("2026-08-28T12:30:00.000Z");
      expect(result.data.cargo.id).toMatch(/^cargo-/);
    }
  });

  it("should create a driving vehicle with destination at the last point of its assigned route", () => {
    const repository = createZustandScenarioRepository(new MemoryStorage());
    repository.vehicleAssignRoute("vehicle-012", "");
    const api = createOperationsApi(repository);
    const route012 = repository.scenarioCurrent().routes.find((r) => r.id === "route-012")!;
    const lastCoord = route012.geometry.geometry.coordinates[route012.geometry.geometry.coordinates.length - 1];

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
      expect(result.data.position.geometry.coordinates).toStrictEqual(route012.geometry.geometry.coordinates[0]);
      // Uses the last point of the route as destination position
      expect(result.data.destination.position.geometry.coordinates).toStrictEqual(lastCoord);
    }
  });

  it("should assign and unassign routes cleanly, update Route.vehicleId, persist in storage, and highlight on selection", () => {
    const storage = new MemoryStorage();
    const repository = createZustandScenarioRepository(storage);
    const api = createOperationsApi(repository);
    
    // 1. Create an unassigned vehicle
    const created = api.vehicleCreate({
      fleetNumber: "Unit 666",
      plate: "6666-BBB",
      label: "Extra Unit",
      dimensions: { vehicleType: "Articulated curtain-sider", lengthMeters: 16.5, heightMeters: 3.8, weightTonnes: 24 },
      cargo: { description: "Parts", refrigeration: "ambient", priority: "standard" }
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const newVehicleId = created.data.internalId;

    // 2. Unassign route-012 from vehicle-012
    const unassignResult = api.vehicleAssignRoute({ vehicleId: "vehicle-012", routeId: "" });
    expect(unassignResult.ok).toBe(true);
    const scenarioAfterUnassign = repository.scenarioCurrent();
    const unassignedVehicle = scenarioAfterUnassign.vehicles.find((v) => v.internalId === "vehicle-012");
    expect(unassignedVehicle?.status).toBe("resting");
    expect(unassignedVehicle?.routeId).toBe("");
    const unassignedRoute = scenarioAfterUnassign.routes.find((r) => r.id === "route-012");
    expect(unassignedRoute?.vehicleId).toBe("");

    // 3. Assign route-012 to the newly created vehicle
    const assignResult = api.vehicleAssignRoute({ vehicleId: newVehicleId, routeId: "route-012" });
    expect(assignResult.ok).toBe(true);
    const scenarioAfterAssign = repository.scenarioCurrent();
    const assignedVehicle = scenarioAfterAssign.vehicles.find((v) => v.internalId === newVehicleId);
    expect(assignedVehicle?.status).toBe("driving");
    expect(assignedVehicle?.routeId).toBe("route-012");

    // Route.vehicleId is updated to the newly assigned vehicle
    const reassignedRoute = scenarioAfterAssign.routes.find((r) => r.id === "route-012");
    expect(reassignedRoute?.vehicleId).toBe(newVehicleId);

    // 4. Persistence verification: reloaded repository retains Route.vehicleId
    const reloadedRepo = createZustandScenarioRepository(storage);
    const reloadedScenario = reloadedRepo.scenarioCurrent();
    const persistedRoute = reloadedScenario.routes.find((r) => r.id === "route-012");
    expect(persistedRoute?.vehicleId).toBe(newVehicleId);

    // 5. Layer highlighting verification: selecting the new vehicle highlights its assigned route
    const layers = deriveMapLayers(reloadedScenario, new Set(), newVehicleId);
    const selectedRouteEntry = layers.routes.find((entry) => entry.route.id === "route-012");
    expect(selectedRouteEntry).toBeDefined();
    expect(selectedRouteEntry?.state).toBe("selected");
  });

  it("should reject assigning a route that is already assigned to another vehicle", () => {
    const repository = createZustandScenarioRepository(new MemoryStorage());
    const api = createOperationsApi(repository);
    
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
