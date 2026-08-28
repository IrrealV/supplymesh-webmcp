import type { FilterCategory, FleetFilter } from "../../app/state/useUiCoordinationStore";
import type { OperatingRegion, OperationalRisk, RiskSeverity, Vehicle } from "../../domain/entities";

export type FilterResult = {
  matchingCategories: readonly FilterCategory[];
  matchingRisks: readonly OperationalRisk[];
  severity: RiskSeverity;
  vehicle: Vehicle;
};

const severityRank: Record<RiskSeverity, number> = { low: 0, medium: 1, high: 2, critical: 3 };

function vehicleRisks(vehicle: Vehicle, scenario: OperatingRegion): OperationalRisk[] {
  return scenario.risks.filter((risk) => risk.affectedVehicleIds.includes(vehicle.internalId));
}

function riskMatchesFilter(risk: OperationalRisk, category: FleetFilter): boolean {
  if (category === "weather-affected") return risk.kind === "severe-snow";
  if (category === "driving-rest-risk") return risk.kind === "rest-deadline";
  if (category === "road-restriction-issues") return risk.kind === "height-restriction" || risk.kind === "weight-restriction" || risk.kind === "road-closure";
  return false;
}

export function vehicleMatchesFilter(vehicle: Vehicle, category: FilterCategory, scenario: OperatingRegion): boolean {
  if (category === "all") return true;
  if (category === "resting" || category === "needs-attention" || category === "critical") return vehicle.status === category;
  const risks = vehicleRisks(vehicle, scenario);
  if (category === "weather-affected") return risks.some((risk) => risk.kind === "severe-snow");
  if (category === "driving-rest-risk") return risks.some((risk) => risk.kind === "rest-deadline");
  return risks.some((risk) => risk.kind === "height-restriction" || risk.kind === "weight-restriction" || risk.kind === "road-closure");
}

export function filterCount(category: FilterCategory, scenario: OperatingRegion): number {
  return scenario.vehicles.filter((vehicle) => vehicleMatchesFilter(vehicle, category, scenario)).length;
}

function resultPriority(result: FilterResult, scenario: OperatingRegion): number {
  if (result.vehicle.status === "critical") return 0;
  if (result.vehicle.status === "needs-attention") return 1;
  if (vehicleRisks(result.vehicle, scenario).length > 0) return 2;
  if (result.vehicle.status === "driving") return 3;
  return 4;
}

function resultSeverity(vehicle: Vehicle, risks: readonly OperationalRisk[]): RiskSeverity {
  if (risks.length > 0) return risks.reduce<RiskSeverity>((highest, risk) => severityRank[risk.severity] > severityRank[highest] ? risk.severity : highest, "low");
  if (vehicle.status === "critical") return "critical";
  if (vehicle.status === "needs-attention") return "high";
  return "low";
}

export function selectFilterResults(scenario: OperatingRegion, activeFilters: ReadonlySet<FleetFilter>): FilterResult[] {
  const categories: readonly FilterCategory[] = activeFilters.size === 0 ? ["all"] : [...activeFilters];
  const results = scenario.vehicles.flatMap((vehicle) => {
    const matchingCategories = categories.filter((category) => vehicleMatchesFilter(vehicle, category, scenario));
    if (matchingCategories.length === 0) return [];
    const risks = vehicleRisks(vehicle, scenario);
    const matchingRisks = activeFilters.size === 0 ? risks : risks.filter((risk) => [...activeFilters].some((category) => riskMatchesFilter(risk, category)));
    return [{ matchingCategories, matchingRisks, severity: resultSeverity(vehicle, matchingRisks), vehicle }];
  });
  return results.sort((left, right) => resultPriority(left, scenario) - resultPriority(right, scenario) || left.vehicle.fleetNumber.localeCompare(right.vehicle.fleetNumber));
}
