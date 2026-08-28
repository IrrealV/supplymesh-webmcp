import { describe, expect, it } from "vitest";
import { createOperationsApi } from "../../domain/operations/createOperationsApi";
import { SCENARIO_OVERRIDES_STORAGE_KEY } from "./overrideStorage";
import { createZustandScenarioRepository } from "../state/createZustandScenarioRepository";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  public get length(): number {
    return this.values.size;
  }

  public clear(): void {
    this.values.clear();
  }

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  public removeItem(key: string): void {
    this.values.delete(key);
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function expectData<T>(result: { ok: true; data: T } | { ok: false }): T {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error("Expected a successful domain result.");
  }
  return result.data;
}

describe("scenario overrides", () => {
  it("falls back from corrupt or obsolete data without changing the locale key", () => {
    const storage = new MemoryStorage();
    storage.setItem("locale:v1", "es");
    storage.setItem(SCENARIO_OVERRIDES_STORAGE_KEY, "not-json");

    const corruptScenario = createZustandScenarioRepository(storage).scenarioCurrent();
    storage.setItem(SCENARIO_OVERRIDES_STORAGE_KEY, JSON.stringify({ version: 2, labels: {}, deletedVehicleIds: [] }));
    const obsoleteScenario = createZustandScenarioRepository(storage).scenarioCurrent();

    expect(corruptScenario.vehicles).toHaveLength(15);
    expect(obsoleteScenario.vehicles).toHaveLength(15);
    expect(storage.getItem("locale:v1")).toBe("es");
  });

  it("falls back from a persisted label longer than 64 characters", () => {
    const storage = new MemoryStorage();
    const fixtureVehicle = createZustandScenarioRepository(storage).scenarioCurrent().vehicles[0];
    storage.setItem("locale:v1", "es");
    storage.setItem(SCENARIO_OVERRIDES_STORAGE_KEY, JSON.stringify({
      version: 1,
      labels: { [fixtureVehicle.internalId]: "x".repeat(65) },
      deletedVehicleIds: [],
    }));

    const reloadedVehicle = createZustandScenarioRepository(storage).vehicleGet(fixtureVehicle.internalId);

    expect(reloadedVehicle?.label).toBe(fixtureVehicle.label);
    expect(storage.getItem("locale:v1")).toBe("es");
  });

  it("validates and persists label edits through the shared operations API", () => {
    const storage = new MemoryStorage();
    const api = createOperationsApi(createZustandScenarioRepository(storage));
    const vehicleId = expectData(api.scenarioCurrent()).vehicles[0].internalId;

    const invalid = api.vehicleRename({ vehicleId, label: "   " });
    const renamed = expectData(api.vehicleRename({ vehicleId, label: "Night Dispatch" }));
    const reloaded = createOperationsApi(createZustandScenarioRepository(storage));

    expect(invalid.ok).toBe(false);
    expect(renamed.label).toBe("Night Dispatch");
    expect(expectData(reloaded.vehicleGet(vehicleId)).label).toBe("Night Dispatch");
  });

  it("keeps query results identical for independent callers of the shared API", () => {
    const api = createOperationsApi(createZustandScenarioRepository(new MemoryStorage()));
    const vehicleId = expectData(api.scenarioCurrent()).vehicles[3].internalId;

    const reactResult = api.vehicleGet(vehicleId);
    const toolResult = api.vehicleGet(vehicleId);

    expect(toolResult).toStrictEqual(reactResult);
    expect(expectData(api.fleetStatus())).toStrictEqual({
      total: 15,
      byStatus: { driving: 5, resting: 4, "needs-attention": 3, critical: 3 },
    });
  });

  it("deletes a vehicle and its route atomically", () => {
    const api = createOperationsApi(createZustandScenarioRepository(new MemoryStorage()));
    const before = expectData(api.scenarioCurrent());
    const vehicle = before.vehicles[0];

    expectData(api.vehicleDelete(vehicle.internalId));
    const after = expectData(api.scenarioCurrent());

    expect(after.vehicles).toHaveLength(14);
    expect(after.vehicles.some((entry) => entry.internalId === vehicle.internalId)).toBe(false);
    expect(after.routes.some((route) => route.id === vehicle.routeId)).toBe(false);
  });
});
