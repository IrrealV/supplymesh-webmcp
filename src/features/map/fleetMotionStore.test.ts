import distance from "@turf/distance";
import { point } from "@turf/helpers";
import { afterEach, describe, expect, it } from "vitest";
import { createRecoveryApplication } from "../../app/createApplication";
import { deriveUnit211RouteCoherence } from "../../domain/operations/unit211RouteCoherence";
import { clearanceAlternativeCatalog } from "../../scenario/fixtures/clearanceAlternativeCatalog";
import { prepareRoutePath, sampleRoutePath } from "./closeRangeMotion";
import { useFleetMotionStore } from "./fleetMotionStore";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  public getItem(key: string): string | null { return this.values.get(key) ?? null; }
  public setItem(key: string, value: string): void { this.values.set(key, value); }
}

function success<T>(result: { ok: true; data: T } | { ok: false; error: { code: string } }): T {
  if (!result.ok) throw new Error(result.error.code);
  return result.data;
}

afterEach(() => useFleetMotionStore.setState({ motions: {}, routePaths: {} }));

describe("Unit 211 recovery motion handoff", () => {
  it("holds at the shared origin, changes route without teleporting, then advances forward with bounded steps", async () => {
    const app = createRecoveryApplication({ storage: new MemoryStorage() });
    const before = success(app.operations.scenarioCurrent());
    const beforeUnit = before.vehicles.find(({ internalId }) => internalId === "vehicle-011");
    const currentRoute = before.routes.find(({ id }) => id === "route-011");
    const hazard = currentRoute?.riskSnaps.find(({ riskId }) => riskId === "restriction-height-3.9");
    if (beforeUnit === undefined || currentRoute === undefined || hazard === undefined) throw new Error("Unit 211 route evidence is missing.");
    const coherence = deriveUnit211RouteCoherence({ currentCoordinates: currentRoute.geometry.geometry.coordinates, alternativeCoordinates: clearanceAlternativeCatalog.geometry.coordinates, vehicleCoordinate: beforeUnit.position.geometry.coordinates, hazardIndex: hazard.startIndex });
    useFleetMotionStore.getState().initialize(before.vehicles, before.routes);
    useFleetMotionStore.getState().updateFrame(1_000, before.routes, before.vehicles);
    const held = useFleetMotionStore.getState().motions[beforeUnit.internalId];
    expect(held).toMatchObject({ routeId: "route-011", progress: 0, isMoving: false, speed: 0 });
    expect([held.longitude, held.latitude]).toStrictEqual(beforeUnit.position.geometry.coordinates);

    const plan = success(await app.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" }));
    success(app.recoveryAgent.requestReview({ planId: plan.planId }));
    success(app.recoveryHuman.approvePlan({ planId: plan.planId }));
    success(await app.recoveryExecution.executeApprovedPlan({ planId: plan.planId }));
    const after = success(app.operations.scenarioCurrent());
    const afterUnit = after.vehicles.find(({ internalId }) => internalId === "vehicle-011");
    const alternativeRoute = after.routes.find(({ id }) => id === "alternative-route-011-clearance-v1");
    if (afterUnit === undefined || alternativeRoute === undefined) throw new Error("Recovered Unit 211 route is missing.");
    useFleetMotionStore.getState().initialize(after.vehicles, after.routes);
    const handedOff = useFleetMotionStore.getState().motions[afterUnit.internalId];
    expect(handedOff).toMatchObject({ routeId: "alternative-route-011-clearance-v1", progress: 0, isMoving: true });
    expect([handedOff.longitude, handedOff.latitude]).toStrictEqual([held.longitude, held.latitude]);

    let previous = handedOff;
    for (let frame = 0; frame < 75; frame += 1) {
      useFleetMotionStore.getState().updateFrame(1_000, after.routes, after.vehicles);
      const current = useFleetMotionStore.getState().motions[afterUnit.internalId];
      const stepMeters = distance(point([previous.longitude, previous.latitude]), point([current.longitude, current.latitude]), { units: "meters" });
      expect(current.progress).toBeGreaterThan(previous.progress);
      expect(stepMeters).toBeGreaterThan(0);
      expect(stepMeters).toBeLessThan(30);
      expect(Number.isFinite(current.bearing)).toBe(true);
      previous = current;
    }
    expect(previous.progress).toBeGreaterThan(coherence.diversionDistanceMeters / alternativeRoute.summary.distanceMeters);
    const expectedSample = sampleRoutePath(prepareRoutePath(alternativeRoute.geometry.geometry.coordinates), previous.progress);
    expect([previous.longitude, previous.latitude]).toStrictEqual(expectedSample.coordinate);
    expect(previous.bearing).toBeCloseTo(expectedSample.bearing, 8);
  }, 15_000);
});
