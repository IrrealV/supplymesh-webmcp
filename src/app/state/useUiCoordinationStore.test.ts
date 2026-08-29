import { beforeEach, describe, expect, it } from "vitest";
import { createSpainScenario } from "../../scenario/fixtures/spain-v1";
import { useUiCoordinationStore } from "./useUiCoordinationStore";

function resetUi(): void {
  useUiCoordinationStore.setState(useUiCoordinationStore.getInitialState(), true);
}

describe("useUiCoordinationStore", () => {
  beforeEach(resetUi);

  it("should coordinate independent filters with immutable set replacements", () => {
    const initialFilters = useUiCoordinationStore.getState().activeFilters;

    useUiCoordinationStore.getState().toggleFilter("critical", "filter-critical");
    const criticalFilters = useUiCoordinationStore.getState().activeFilters;
    useUiCoordinationStore.getState().toggleFilter("weather-affected", "filter-weather-affected");

    const state = useUiCoordinationStore.getState();
    expect([...state.activeFilters]).toEqual(["critical", "weather-affected"]);
    expect(state.activeFilters).not.toBe(criticalFilters);
    expect(criticalFilters).not.toBe(initialFilters);
    expect([...initialFilters]).toEqual([]);
    expect([...criticalFilters]).toEqual(["critical"]);
    expect(state.panelContext).toEqual({ mode: "results", returnFocusId: "filter-weather-affected" });
    expect(state.railState).toBe("expanded");

    state.clearFilters("filter-all");

    expect([...useUiCoordinationStore.getState().activeFilters]).toEqual([]);
    expect(useUiCoordinationStore.getState().panelContext).toEqual({ mode: "overview", returnFocusId: "filter-all" });
  });

  it("should replace selection and follow while preserving the results context", () => {
    const store = useUiCoordinationStore.getState();
    store.toggleFilter("critical", "filter-critical");
    store.selectVehicle("vehicle-001", "vehicle-001-control");
    store.cancelFollow();
    store.restoreFollow();
    store.selectVehicle("vehicle-002", "vehicle-002-control");

    const state = useUiCoordinationStore.getState();
    expect(state.selection).toEqual({ kind: "vehicle", vehicleId: "vehicle-002" });
    expect(state.follow).toEqual({ kind: "vehicle", vehicleId: "vehicle-002" });
    expect(state.panelContext).toEqual({ mode: "results", returnFocusId: "vehicle-002-control" });
    expect([...state.activeFilters]).toEqual(["critical"]);
  });

  it("should acknowledge only the current map focus request", () => {
    const store = useUiCoordinationStore.getState();
    store.selectVehicle("vehicle-001", "vehicle-001-control");
    const selectionRequest = useUiCoordinationStore.getState().mapFocusTarget;
    store.focusRoute("vehicle-001");
    const routeRequest = useUiCoordinationStore.getState().mapFocusTarget;

    expect(selectionRequest).toEqual({ kind: "vehicle", requestId: 1, vehicleId: "vehicle-001" });
    expect(routeRequest).toEqual({ kind: "route", requestId: 2, vehicleId: "vehicle-001" });

    store.acknowledgeMapFocus(1);
    expect(useUiCoordinationStore.getState().mapFocusTarget).toEqual(routeRequest);

    store.acknowledgeMapFocus(2);
    expect(useUiCoordinationStore.getState().mapFocusTarget).toEqual({ kind: "none" });
  });

  it("should restore the prior context and focus target when inspection closes", () => {
    const store = useUiCoordinationStore.getState();
    store.toggleFilter("resting", "filter-resting");
    store.selectVehicle("vehicle-001");

    const returnFocusId = store.closeSelection();
    const state = useUiCoordinationStore.getState();

    expect(returnFocusId).toBe("filter-resting");
    expect(state.selection).toEqual({ kind: "none" });
    expect(state.follow).toEqual({ kind: "none" });
    expect(state.mapFocusTarget).toEqual({ kind: "none" });
    expect(state.panelContext).toEqual({ mode: "results", returnFocusId: "filter-resting" });
    expect([...state.activeFilters]).toEqual(["resting"]);
  });

  it("should keep transient coordination independent from scenario data", () => {
    const scenario = createSpainScenario();
    const scenarioSnapshot = structuredClone(scenario);

    useUiCoordinationStore.getState().toggleFilter("critical", "filter-critical");
    useUiCoordinationStore.getState().selectVehicle("vehicle-001", "vehicle-001-control");
    useUiCoordinationStore.getState().closeSelection();

    expect(scenario).toEqual(scenarioSnapshot);
    expect(Object.hasOwn(useUiCoordinationStore.getState(), "scenario")).toBe(false);
    expect(Object.hasOwn(useUiCoordinationStore.getState(), "vehicles")).toBe(false);
  });
});
