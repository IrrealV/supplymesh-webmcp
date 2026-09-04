import { describe, expect, it } from "vitest";
import { createSpainScenario } from "../../scenario/fixtures/spain-v1";
import { createZustandScenarioRepository } from "../../scenario/state/createZustandScenarioRepository";
import type { StorageLike } from "../../scenario/persistence/overrideStorage";
import { createOperationsApi } from "./createOperationsApi";
import { compareRestOpportunities, REST_OPPORTUNITY_VEHICLE_ID, REST_SCENARIO_CLOCK } from "./restOpportunities";

function memoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe("driver-first rest opportunities", () => {
  it("derives two feasible choices and rejects the option outside delivery tolerance", () => {
    const result = compareRestOpportunities(createSpainScenario(), REST_OPPORTUNITY_VEHICLE_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.scenarioClock).toBe(REST_SCENARIO_CLOCK);
    expect(result.data.currentEta).toBe("2026-08-28T11:30:00Z");
    expect(result.data.committedDeliveryAt).toBe("2026-08-28T12:21:00.000Z");
    expect(result.data.policy).toEqual({
      objective: "MAXIMIZE_ADDITIONAL_REST",
      mandatoryRestIsNeverReduced: true,
      routeGeometryUnchanged: true,
      humanSchedulesRest: true,
    });

    const [early, recommended, late] = result.data.options;
    expect(early).toMatchObject({
      id: "rest-window-early-40",
      extraRestMinutes: 40,
      accessMinutes: 4,
      projectedArrivalAt: "2026-08-28T12:14:00.000Z",
      contractualDelayMinutes: 0,
      deliveryMarginMinutes: 7,
      feasible: true,
      recommended: false,
    });
    expect(recommended).toMatchObject({
      id: "rest-window-max-55",
      extraRestMinutes: 55,
      accessMinutes: 6,
      projectedArrivalAt: "2026-08-28T12:31:00.000Z",
      contractualDelayMinutes: 10,
      feasible: true,
      recommended: true,
    });
    expect(late).toMatchObject({
      id: "rest-window-late-70",
      extraRestMinutes: 70,
      accessMinutes: 8,
      projectedArrivalAt: "2026-08-28T12:48:00.000Z",
      contractualDelayMinutes: 27,
      feasible: false,
      reasonCode: "DELIVERY_TOLERANCE_EXCEEDED",
    });
    expect(result.data.recommendedOptionId).toBe("rest-window-max-55");
    expect(recommended.qualifiesAsMandatoryBreak).toBe(false);
  });

  it("fails closed for unknown vehicles, unsupported vehicles, missing routes, and invalid timing", () => {
    const scenario = createSpainScenario();
    expect(compareRestOpportunities(scenario, "missing")).toMatchObject({ ok: false, error: { code: "vehicle-not-found" } });
    expect(compareRestOpportunities(scenario, "vehicle-001")).toMatchObject({ ok: false, error: { code: "rest-opportunities-unavailable" } });

    const noRoute = structuredClone(scenario);
    const target = noRoute.vehicles.find(({ internalId }) => internalId === REST_OPPORTUNITY_VEHICLE_ID)!;
    target.routeId = "";
    expect(compareRestOpportunities(noRoute, REST_OPPORTUNITY_VEHICLE_ID)).toMatchObject({ ok: false, error: { code: "route-not-assigned" } });

    const invalidTiming = structuredClone(scenario);
    invalidTiming.vehicles.find(({ internalId }) => internalId === REST_OPPORTUNITY_VEHICLE_ID)!.timing.eta = "not-a-date";
    expect(compareRestOpportunities(invalidTiming, REST_OPPORTUNITY_VEHICLE_ID)).toMatchObject({ ok: false, error: { code: "timing-invalid" } });
  });

  it("schedules only a feasible option through the human operation and verifies the persisted plan", () => {
    const storage = memoryStorage();
    const operations = createOperationsApi(createZustandScenarioRepository(storage, null));

    expect(operations.restOpportunitySchedule({ vehicleId: REST_OPPORTUNITY_VEHICLE_ID, opportunityId: "rest-window-late-70" })).toMatchObject({
      ok: false,
      error: { code: "rest-opportunity-infeasible" },
    });

    const scheduled = operations.restOpportunitySchedule({ vehicleId: REST_OPPORTUNITY_VEHICLE_ID, opportunityId: "rest-window-max-55" });
    expect(scheduled.ok).toBe(true);
    if (!scheduled.ok) return;
    expect(scheduled.data.timing.eta).toBe("2026-08-28T12:31:00.000Z");
    expect(scheduled.data.scheduledRest).toMatchObject({
      planId: "rest-plan:vehicle-012:rest-window-max-55",
      scheduledAt: REST_SCENARIO_CLOCK,
      scheduledBy: "human-ui",
      extraRestMinutes: 55,
      contractualDelayMinutes: 10,
      status: "SCHEDULED",
    });

    const repeated = operations.restOpportunitySchedule({ vehicleId: REST_OPPORTUNITY_VEHICLE_ID, opportunityId: "rest-window-max-55" });
    expect(repeated).toEqual(scheduled);

    const rebuilt = createOperationsApi(createZustandScenarioRepository(storage, null));
    const comparison = rebuilt.restOpportunitiesCompare(REST_OPPORTUNITY_VEHICLE_ID);
    expect(comparison.ok).toBe(true);
    if (!comparison.ok) return;
    expect(comparison.data.scheduledRest?.opportunityId).toBe("rest-window-max-55");
    expect(comparison.data.verification?.status).toBe("PASS");
    expect(comparison.data.verification?.checks).toHaveLength(7);
    expect(comparison.data.verification?.checks.every(({ status }) => status === "PASS")).toBe(true);
  });

  it("clears a scheduled stop and restores the original ETA", () => {
    const operations = createOperationsApi(createZustandScenarioRepository(memoryStorage(), null));
    const scheduled = operations.restOpportunitySchedule({ vehicleId: REST_OPPORTUNITY_VEHICLE_ID, opportunityId: "rest-window-early-40" });
    expect(scheduled).toMatchObject({ ok: true, data: { timing: { eta: "2026-08-28T12:14:00.000Z" } } });

    const cleared = operations.restOpportunityClear(REST_OPPORTUNITY_VEHICLE_ID);
    expect(cleared).toMatchObject({
      ok: true,
      data: {
        timing: { eta: "2026-08-28T11:30:00Z" },
        scheduledRest: null,
      },
    });
  });

  it("clears a scheduled stop automatically when the route is unassigned", () => {
    const operations = createOperationsApi(createZustandScenarioRepository(memoryStorage(), null));
    expect(operations.restOpportunitySchedule({ vehicleId: REST_OPPORTUNITY_VEHICLE_ID, opportunityId: "rest-window-max-55" }).ok).toBe(true);
    const unassigned = operations.vehicleAssignRoute({ vehicleId: REST_OPPORTUNITY_VEHICLE_ID, routeId: undefined });
    expect(unassigned).toMatchObject({
      ok: true,
      data: {
        routeId: "",
        timing: { eta: "2026-08-28T11:30:00Z" },
        scheduledRest: null,
      },
    });
  });
});
