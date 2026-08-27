import type { FilterCategory } from "../../app/state/useUiCoordinationStore";
import type { OperatingRegion, Vehicle } from "../../domain/entities";

export function vehicleMatchesFilter(vehicle: Vehicle, category: FilterCategory, scenario: OperatingRegion): boolean {
  if (category === "all") return true;
  if (category === "resting" || category === "needs-attention" || category === "critical") return vehicle.status === category;
  const risks = scenario.risks.filter((risk) => risk.affectedVehicleIds.includes(vehicle.internalId));
  if (category === "weather-affected") return risks.some((risk) => risk.kind === "severe-snow");
  if (category === "driving-rest-risk") return risks.some((risk) => risk.kind === "rest-deadline");
  return risks.some((risk) => risk.kind === "height-restriction" || risk.kind === "weight-restriction" || risk.kind === "road-closure");
}

export function filterCount(category: FilterCategory, scenario: OperatingRegion): number {
  return scenario.vehicles.filter((vehicle) => vehicleMatchesFilter(vehicle, category, scenario)).length;
}
