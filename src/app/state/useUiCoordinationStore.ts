import { create } from "zustand";

export const FilterCategories = ["all", "resting", "needs-attention", "critical", "weather-affected", "driving-rest-risk", "road-restriction-issues"] as const;
export type FilterCategory = (typeof FilterCategories)[number];

type UiCoordinationState = {
  activeFilter: FilterCategory | "";
  drawerOpen: boolean;
  isRailExpanded: boolean;
  isFollowing: boolean;
  selectedVehicleId: string;
  selectVehicle(vehicleId: string): void;
  closeDrawer(): void;
  toggleFilter(category: FilterCategory): void;
  collapseRail(): void;
  cancelFollow(): void;
  restoreFollow(): void;
};

export const useUiCoordinationStore = create<UiCoordinationState>()((set) => ({
  activeFilter: "",
  drawerOpen: false,
  isRailExpanded: false,
  isFollowing: false,
  selectedVehicleId: "",
  selectVehicle: (selectedVehicleId) => set({ selectedVehicleId, drawerOpen: true, isFollowing: true }),
  closeDrawer: () => set({ selectedVehicleId: "", drawerOpen: false, isFollowing: false }),
  toggleFilter: (category) => set((state) => ({ activeFilter: state.activeFilter === category ? "" : category, isRailExpanded: true })),
  collapseRail: () => set({ isRailExpanded: false }),
  cancelFollow: () => set({ isFollowing: false }),
  restoreFollow: () => set({ isFollowing: true }),
}));
