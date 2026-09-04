import { create } from "zustand";

export const FilterCategories = ["all", "resting", "needs-attention", "critical", "weather-affected", "driving-rest-risk", "road-restriction-issues"] as const;
export type FilterCategory = (typeof FilterCategories)[number];
export type FleetFilter = Exclude<FilterCategory, "all">;
export type PanelContext = { mode: "overview" | "results"; returnFocusId: string };
export type Selection = { kind: "none" } | { kind: "vehicle"; vehicleId: string };
export type Follow = { kind: "none" } | { kind: "vehicle"; vehicleId: string };
export type MapFocusTarget = { kind: "none" } | { kind: "vehicle" | "route" | "comparison"; requestId: number; vehicleId: string };
export type RailState = "compact" | "expanded";

type UiCoordinationState = {
  activeFilters: ReadonlySet<FleetFilter>;
  focusRequestId: number;
  follow: Follow;
  mapFocusTarget: MapFocusTarget;
  panelContext: PanelContext;
  railState: RailState;
  selection: Selection;
  placementMode: boolean;
  placementCoordinates: [number, number] | null;
  acknowledgeMapFocus(requestId: number): void;
  cancelFollow(): void;
  clearFilters(returnFocusId: string): void;
  closeSelection(): string;
  focusComparison(vehicleId: string): void;
  focusRoute(vehicleId: string): void;
  restoreFollow(): void;
  selectVehicle(vehicleId: string, returnFocusId?: string): void;
  setRailState(railState: RailState): void;
  toggleFilter(filter: FleetFilter, returnFocusId: string): void;
  startPlacement(): void;
  setPlacementCoordinates(coords: [number, number]): void;
  cancelPlacement(): void;
};

const noFollow: Follow = { kind: "none" };
const noFocus: MapFocusTarget = { kind: "none" };
const noSelection: Selection = { kind: "none" };

export const useUiCoordinationStore = create<UiCoordinationState>()((set, get) => ({
  activeFilters: new Set<FleetFilter>(),
  focusRequestId: 0,
  follow: noFollow,
  mapFocusTarget: noFocus,
  panelContext: { mode: "overview", returnFocusId: "operational-map" },
  railState: "compact",
  selection: noSelection,
  placementMode: false,
  placementCoordinates: null,
  startPlacement: () => set({ placementMode: true, placementCoordinates: null, selection: noSelection, follow: noFollow }),
  setPlacementCoordinates: (coords) => set({ placementCoordinates: coords }),
  cancelPlacement: () => set({ placementMode: false, placementCoordinates: null }),
  acknowledgeMapFocus: (requestId) => set((state) => state.mapFocusTarget.kind !== "none" && state.mapFocusTarget.requestId === requestId ? { mapFocusTarget: noFocus } : {}),
  cancelFollow: () => set({ follow: noFollow }),
  clearFilters: (returnFocusId) => set({ activeFilters: new Set<FleetFilter>(), panelContext: { mode: "overview", returnFocusId } }),
  closeSelection: () => {
    const returnFocusId = get().panelContext.returnFocusId;
    set({ follow: noFollow, mapFocusTarget: noFocus, selection: noSelection });
    return returnFocusId;
  },
  focusComparison: (vehicleId) => set((state) => { const requestId = state.focusRequestId + 1; return { focusRequestId: requestId, mapFocusTarget: { kind: "comparison", requestId, vehicleId } }; }),
  focusRoute: (vehicleId) => set((state) => {
    const requestId = state.focusRequestId + 1;
    return { focusRequestId: requestId, mapFocusTarget: { kind: "route", requestId, vehicleId } };
  }),
  restoreFollow: () => set((state) => {
    if (state.selection.kind !== "vehicle") return { follow: noFollow };
    const requestId = state.focusRequestId + 1;
    return {
      focusRequestId: requestId,
      follow: { kind: "vehicle", vehicleId: state.selection.vehicleId },
      mapFocusTarget: { kind: "vehicle", requestId, vehicleId: state.selection.vehicleId },
    };
  }),
  selectVehicle: (vehicleId, returnFocusId) => set((state) => {
    const requestId = state.focusRequestId + 1;
    return {
      focusRequestId: requestId,
      follow: { kind: "vehicle", vehicleId },
      mapFocusTarget: { kind: "vehicle", requestId, vehicleId },
      panelContext: { ...state.panelContext, returnFocusId: returnFocusId ?? state.panelContext.returnFocusId },
      selection: { kind: "vehicle", vehicleId },
    };
  }),
  setRailState: (railState) => set({ railState }),
  toggleFilter: (filter, returnFocusId) => set((state) => {
    const activeFilters = new Set(state.activeFilters);
    if (activeFilters.has(filter)) {
      activeFilters.delete(filter);
    } else {
      activeFilters.add(filter);
    }
    return {
      activeFilters,
      panelContext: { mode: activeFilters.size === 0 ? "overview" : "results", returnFocusId },
      railState: "expanded",
    };
  }),
}));
