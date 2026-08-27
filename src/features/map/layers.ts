import type { FilterCategory } from "../../app/state/useUiCoordinationStore";
import type { OperatingRegion, OperationalRisk, Vehicle } from "../../domain/entities";
import { vehicleMatchesFilter } from "../fleet/filtering";

type DerivedVehicle = { vehicle: Vehicle; isEmphasized: boolean };
type DerivedRisk = { risk: OperationalRisk; isEmphasized: boolean };
export type MapLayers = { vehicles: DerivedVehicle[]; risks: DerivedRisk[] };

export function deriveMapLayers(scenario: OperatingRegion, activeFilter: FilterCategory | "", selectedVehicleId: string): MapLayers {
  const hasFocus = activeFilter !== "" || selectedVehicleId !== "";
  const vehicles = scenario.vehicles.map((vehicle) => ({ vehicle, isEmphasized: selectedVehicleId === vehicle.internalId || (selectedVehicleId === "" && activeFilter !== "" && vehicleMatchesFilter(vehicle, activeFilter, scenario)) || !hasFocus }));
  const risks = scenario.risks.map((risk) => ({ risk, isEmphasized: selectedVehicleId !== "" ? risk.affectedVehicleIds.includes(selectedVehicleId) : activeFilter === "" || scenario.vehicles.some((vehicle) => risk.affectedVehicleIds.includes(vehicle.internalId) && vehicleMatchesFilter(vehicle, activeFilter, scenario)) }));
  return { vehicles, risks };
}
