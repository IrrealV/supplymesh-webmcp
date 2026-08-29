import type { FleetFilter } from "../../app/state/useUiCoordinationStore";
import type { OperatingRegion, OperationalRisk, Route, Vehicle } from "../../domain/entities";
import { selectFilterResults } from "../fleet/filtering";

export type LayerState = "normal" | "matched" | "muted" | "selected";
export type DerivedVehicle = { vehicle: Vehicle; state: LayerState; zIndex: number };
export type DerivedRoute = { route: Route; state: LayerState };
export type DerivedRisk = { risk: OperationalRisk; state: LayerState };
export type MapLayers = { vehicles: DerivedVehicle[]; routes: DerivedRoute[]; risks: DerivedRisk[] };

function layerState(vehicleId: string, matchingIds: ReadonlySet<string>, selectedVehicleId: string, hasFilters: boolean): LayerState {
  if (vehicleId === selectedVehicleId) return "selected";
  if (selectedVehicleId !== "") return "muted";
  if (!hasFilters) return "normal";
  return matchingIds.has(vehicleId) ? "matched" : "muted";
}

export function deriveMapLayers(scenario: OperatingRegion, activeFilters: ReadonlySet<FleetFilter>, selectedVehicleId: string): MapLayers {
  const matchingIds = new Set(selectFilterResults(scenario, activeFilters).map(({ vehicle }) => vehicle.internalId));
  const hasFilters = activeFilters.size > 0;
  const vehicles = scenario.vehicles.map((vehicle) => {
    const state = layerState(vehicle.internalId, matchingIds, selectedVehicleId, hasFilters);
    const zIndex = state === "selected" ? 1400 : state === "matched" ? 900 : state === "normal" ? 600 : 200;
    return { vehicle, state, zIndex };
  });
  const routes = scenario.routes
    .map((route) => ({ route, state: layerState(route.vehicleId, matchingIds, selectedVehicleId, hasFilters) }))
    .sort((left, right) => Number(left.state === "selected") - Number(right.state === "selected"));
  const risks = scenario.risks.map((risk) => {
    const isSelected = selectedVehicleId !== "" && risk.affectedVehicleIds.includes(selectedVehicleId);
    const isMatched = risk.affectedVehicleIds.some((vehicleId) => matchingIds.has(vehicleId));
    const state: LayerState = isSelected ? "selected" : selectedVehicleId !== "" ? "muted" : !hasFilters ? "normal" : isMatched ? "matched" : "muted";
    return { risk, state };
  });
  return { vehicles, routes, risks };
}
