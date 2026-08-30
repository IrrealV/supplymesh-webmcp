import { describe, expect, it } from "vitest";
import { createSpainScenario } from "../fixtures/spain-v1";
import { readClearanceAlternativeRuntime } from "./clearanceAlternativeAdapter";
import { createUnit211RecoveryFixture } from "./createUnit211RecoveryFixture";
import { createUnit211RecoveryOptions } from "./createUnit211RecoveryOptions";

function vehicleFrom(
  snapshot: ReturnType<typeof createUnit211RecoveryFixture>,
): ReturnType<typeof createUnit211RecoveryFixture>["scenario"]["vehicles"][number] {
  const vehicle = snapshot.scenario.vehicles.find(
    ({ internalId }) => internalId === "vehicle-011",
  );
  if (vehicle === undefined) {
    throw new Error("Unit 211 missing from recovery fixture.");
  }
  return vehicle;
}

describe("Unit 211 deterministic recovery fixture", () => {
  it("should derive a versioned pre-dispatch snapshot without mutating the base fixture", () => {
    const base = createSpainScenario();
    const baseVehicle = base.vehicles.find(
      ({ internalId }) => internalId === "vehicle-011",
    );
    const snapshot = createUnit211RecoveryFixture();
    const vehicle = vehicleFrom(snapshot);
    const route = snapshot.scenario.routes.find(({ id }) => id === "route-011");

    expect(baseVehicle?.routeProgress).toBeCloseTo(10 / 14);
    expect(vehicle.routeProgress).toBe(0);
    expect(vehicle.position.geometry.coordinates).toStrictEqual(
      route?.geometry.geometry.coordinates[0],
    );
    expect(vehicle.origin.name).toBe("Toledo");
    expect(vehicle.destination.name).toBe("Alcobendas");
    expect(vehicle.routeId).toBe("route-011");
    expect(snapshot.fixtureVersion).toBe("unit-211-pre-dispatch-v1");
    expect(snapshot.scenarioClock).toStrictEqual({
      instant: "2026-08-28T09:00:00.000Z",
      mode: "deterministic-demo",
    });
    expect(snapshot.scenarioRevision).toBe(1);
    expect(snapshot.workflowState).toBe("IDLE");
    expect(createSpainScenario()).toStrictEqual(base);
  });

  it("should derive incident point and polygon from the exact route-011 adapter", () => {
    const runtime = readClearanceAlternativeRuntime();
    const snapshot = createUnit211RecoveryFixture();

    expect(runtime.incidentSnap).toStrictEqual({
      coordinate: [-3.897481, 40.149232],
      index: 537,
      riskId: "restriction-height-3.9",
      routeId: "route-011",
    });
    expect(snapshot.incident).toMatchObject({
      availableClearanceMeters: 3.9,
      id: "incident-unit-211-clearance-v1",
      reasonCode: "CLEARANCE_BUFFER_VIOLATION",
      riskId: "restriction-height-3.9",
      routeId: "route-011",
      snapIndex: 537,
      status: "OPEN",
      vehicleId: "vehicle-011",
    });
    expect(snapshot.incident.incidentPoint.geometry.coordinates).toStrictEqual(
      runtime.incidentSnap.coordinate,
    );
    expect(snapshot.incident.exclusionZone.geometry).toStrictEqual(
      runtime.exclusionZone,
    );
    expect(runtime.summary).toStrictEqual({
      distanceMeters: 80_298.9,
      durationSeconds: 5_282.5,
    });
    expect(runtime.minimumSeparationMeters).toBeCloseTo(5_724.858608, 6);
  });

  it("should expose the exact hard human constraints and an initial audit event", () => {
    const snapshot = createUnit211RecoveryFixture();

    expect(snapshot.constraints).toStrictEqual({
      clearanceBufferMeters: {
        hardness: "hard",
        name: "clearanceBufferMeters",
        source: "human",
        value: 0.2,
      },
      keepCargoAssignment: {
        hardness: "hard",
        name: "keepCargoAssignment",
        source: "human",
        value: true,
      },
      protectRestDeadline: {
        hardness: "hard",
        name: "protectRestDeadline",
        source: "human",
        value: true,
      },
    });
    expect(snapshot.auditTimeline).toStrictEqual([{
      action: "SCENARIO_SNAPSHOT_CREATED",
      actor: "system",
      id: "audit-0001",
      result: "SUCCESS",
      scenarioRevision: 1,
      sequence: 1,
      target: "unit-211-pre-dispatch-v1",
      timestamp: "2026-08-28T09:00:00.000Z",
    }]);
  });

  it("should compare the current route and verified alternative without fictional metrics", () => {
    const options = createUnit211RecoveryOptions(createUnit211RecoveryFixture());
    const current = options.find(({ kind }) => kind === "CURRENT_ROUTE");
    const alternative = options.find(({ kind }) => kind === "ALTERNATIVE_ROUTE");

    expect(current).toMatchObject({
      feasible: false,
      metrics: {
        distanceDeltaMeters: 0,
        durationDeltaSeconds: 0,
        summary: { distanceMeters: 99_706.6, durationSeconds: 5_292.1 },
      },
      reasonCodes: ["CLEARANCE_BUFFER_VIOLATION", "EXCLUSION_ZONE_INTERSECTION"],
      routeId: "route-011",
      validation: {
        clearance: {
          availableClearanceMeters: 3.9,
          clearanceBufferMeters: 0.2,
          requiredClearanceMeters: 4,
          status: "FAIL",
          vehicleHeightMeters: 3.8,
        },
      },
    });
    expect(alternative).toMatchObject({
      feasible: true,
      metrics: {
        distanceDeltaMeters: -19_407.7,
        durationDeltaSeconds: -9.6,
        summary: { distanceMeters: 80_298.9, durationSeconds: 5_282.5 },
      },
      reasonCodes: [],
      risksIntroduced: [],
      risksResolved: ["restriction-height-3.9"],
      routeId: "alternative-route-011-clearance-v1",
      validation: {
        cargoContinuity: { status: "PASS" },
        clearance: {
          reasonCode: "CLEARANCE_RESTRICTION_AVOIDED",
          requiredClearanceMeters: 4,
          status: "PASS",
        },
        geometryAvoidance: {
          reasonCode: "EXCLUSION_ZONE_AVOIDED",
          status: "PASS",
        },
        restWindow: {
          estimatedCompletionAt: "2026-08-28T10:28:02.500Z",
          reasonCode: "REST_WINDOW_SATISFIED",
          reserveMinutes: 0,
          status: "PASS",
        },
      },
    });
  });
});
