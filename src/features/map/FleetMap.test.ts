import { describe, expect, it } from "vitest";
import { getVehicleDisplayName } from "../../domain/entities";
import { createSpainScenario } from "../../scenario/fixtures/spain-v1";
import { deriveMapLayers } from "./layers";
import { MapEventCoordinator } from "./MapEventCoordinator";

describe("FleetMap layers", () => {
  it("should derive all controlled map layers and fallback marker labels", () => {
    const scenario = createSpainScenario();
    const layers = deriveMapLayers(scenario, "", "");

    expect(layers.vehicles).toHaveLength(15);
    expect(layers.risks).toHaveLength(19);
    expect(getVehicleDisplayName(scenario.vehicles[0])).toBe("FM-201");
    expect(layers.vehicles.every((entry) => entry.isEmphasized)).toBe(true);
  });

  it("should highlight filtered and selected context while de-emphasizing secondary layers", () => {
    const scenario = createSpainScenario();
    const filtered = deriveMapLayers(scenario, "critical", "");
    const selected = deriveMapLayers(scenario, "critical", "vehicle-001");

    expect(filtered.vehicles.filter((entry) => entry.isEmphasized)).toHaveLength(3);
    expect(selected.vehicles.filter((entry) => entry.isEmphasized).map((entry) => entry.vehicle.internalId)).toEqual(["vehicle-001"]);
    expect(selected.risks.filter((entry) => entry.isEmphasized).every((entry) => entry.risk.affectedVehicleIds.includes("vehicle-001"))).toBe(true);
  });
});

describe("MapEventCoordinator", () => {
  it("should preserve follow during programmatic focus and cancel it for manual navigation", () => {
    const coordinator = new MapEventCoordinator();

    coordinator.beginProgrammaticFocus();
    const duringFocus = coordinator.shouldCancelFollowForViewportMove();
    coordinator.settleProgrammaticFocus();
    const afterFocus = coordinator.shouldCancelFollowForViewportMove();
    coordinator.beginProgrammaticFocus();
    const manual = coordinator.shouldCancelFollowForManualInteraction();

    expect(duringFocus).toBe(false);
    expect(afterFocus).toBe(true);
    expect(manual).toBe(true);
    expect(coordinator.shouldCancelFollowForViewportMove()).toBe(true);
  });
});
