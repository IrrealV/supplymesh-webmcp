import { createStore } from "zustand/vanilla";
import type { OperatingRegion, Vehicle } from "../../domain/entities";
import type { ScenarioRepository } from "../../domain/ports/ScenarioRepository";
import { createSpainScenario } from "../fixtures/spain-v1";
import { browserStorage, loadScenarioOverrides, saveScenarioOverrides, type ScenarioOverrides, type StorageLike } from "../persistence/overrideStorage";

type ScenarioState = { scenario: OperatingRegion; overrides: ScenarioOverrides };

function applyOverrides(overrides: ScenarioOverrides): OperatingRegion {
  const fixture = createSpainScenario();
  const deleted = new Set(overrides.deletedVehicleIds);
  return {
    ...fixture,
    vehicles: fixture.vehicles.filter((vehicle) => !deleted.has(vehicle.internalId)).map((vehicle) => ({ ...vehicle, label: overrides.labels[vehicle.internalId] ?? vehicle.label })),
    routes: fixture.routes.filter((route) => !deleted.has(route.vehicleId)),
  };
}

function findVehicle(scenario: OperatingRegion, vehicleId: string): Vehicle | undefined {
  return scenario.vehicles.find((vehicle) => vehicle.internalId === vehicleId);
}

export function createZustandScenarioRepository(storage: StorageLike = browserStorage()): ScenarioRepository {
  const overrides = loadScenarioOverrides(storage);
  const store = createStore<ScenarioState>()(() => ({ overrides, scenario: applyOverrides(overrides) }));

  function persist(nextOverrides: ScenarioOverrides): boolean {
    if (!saveScenarioOverrides(storage, nextOverrides)) return false;
    store.setState({ overrides: nextOverrides, scenario: applyOverrides(nextOverrides) });
    return true;
  }

  return {
    scenarioCurrent: () => store.getState().scenario,
    vehicleGet: (vehicleId) => findVehicle(store.getState().scenario, vehicleId),
    vehicleRename: (vehicleId, label) => {
      const vehicle = findVehicle(store.getState().scenario, vehicleId);
      if (vehicle === undefined) return undefined;
      const nextOverrides = { ...store.getState().overrides, labels: { ...store.getState().overrides.labels, [vehicleId]: label } };
      return persist(nextOverrides) ? findVehicle(store.getState().scenario, vehicleId) : undefined;
    },
    vehicleDelete: (vehicleId) => {
      const vehicle = findVehicle(store.getState().scenario, vehicleId);
      if (vehicle === undefined) return undefined;
      const labels = { ...store.getState().overrides.labels };
      delete labels[vehicleId];
      const nextOverrides = { ...store.getState().overrides, labels, deletedVehicleIds: [...new Set([...store.getState().overrides.deletedVehicleIds, vehicleId])] };
      return persist(nextOverrides) ? vehicle : undefined;
    },
  };
}
