import { describe, expect, it } from "vitest";
import type { FleetFilter } from "../../app/state/useUiCoordinationStore";
import { createSpainScenario } from "../../scenario/fixtures/spain-v1";
import { filterCount, selectFilterResults, vehicleMatchesFilter } from "./filtering";

describe("fleet filtering", () => {
  it("should derive all seven category counts from the scenario", () => {
    const scenario = createSpainScenario();

    expect(["all", "resting", "needs-attention", "critical", "weather-affected", "driving-rest-risk", "road-restriction-issues"].map((category) => filterCount(category as Parameters<typeof filterCount>[0], scenario))).toEqual([15, 4, 3, 3, 3, 15, 9]);
    expect(vehicleMatchesFilter(scenario.vehicles[3], "weather-affected", scenario)).toBe(true);
  });

  it("should union independent filters, deduplicate matches, and preserve exact priority", () => {
    const scenario = createSpainScenario();
    const filters = new Set<FleetFilter>(["critical", "weather-affected"]);

    const results = selectFilterResults(scenario, filters);

    expect(results.map(({ vehicle }) => vehicle.fleetNumber)).toEqual(["FM-204", "FM-208", "FM-212", "FM-209", "FM-214"]);
    expect(results.filter(({ vehicle }) => vehicle.internalId === "vehicle-004")).toHaveLength(1);
    expect(results[0].matchingCategories).toEqual(["critical", "weather-affected"]);
    expect(results[0].matchingRisks.map(({ kind }) => kind)).toEqual(["severe-snow"]);
    expect(results[0].severity).toBe("high");
  });

  it("should fall back to all vehicles and order risk before driving and resting", () => {
    const scenario = createSpainScenario();
    scenario.risks = scenario.risks.filter((risk) => risk.id === "closure-ap-68");

    const results = selectFilterResults(scenario, new Set<FleetFilter>());

    expect(results).toHaveLength(15);
    expect(results.map(({ vehicle }) => vehicle.status).slice(0, 6)).toEqual(["critical", "critical", "critical", "needs-attention", "needs-attention", "needs-attention"]);
    expect(results.findIndex(({ vehicle }) => vehicle.internalId === "vehicle-013")).toBeLessThan(results.findIndex(({ vehicle }) => vehicle.internalId === "vehicle-001"));
    expect(results.findIndex(({ vehicle }) => vehicle.status === "driving")).toBeLessThan(results.findIndex(({ vehicle }) => vehicle.status === "resting"));
  });
});
