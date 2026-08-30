import type {
  HumanConstraints,
  OperationalRecoverySnapshot,
  ScenarioClock,
} from "../../domain/recovery/types";
import { geoPoint } from "../geometry";
import { createSpainScenario } from "../fixtures/spain-v1";
import { readClearanceAlternativeRuntime } from "./clearanceAlternativeAdapter";

export const UNIT_211_RECOVERY_FIXTURE_VERSION = "unit-211-pre-dispatch-v1";
export const UNIT_211_SCENARIO_REVISION_INITIAL = 1;
export const UNIT_211_SCENARIO_CLOCK: ScenarioClock = {
  instant: "2026-08-28T09:00:00.000Z",
  mode: "deterministic-demo",
};

export const UNIT_211_HUMAN_CONSTRAINTS: HumanConstraints = {
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
};

export function createUnit211RecoveryFixture(): OperationalRecoverySnapshot {
  const scenario = createSpainScenario();
  const runtime = readClearanceAlternativeRuntime();
  const vehicleIndex = scenario.vehicles.findIndex(
    ({ internalId }) => internalId === runtime.vehicleId,
  );
  const route = scenario.routes.find(({ id }) => id === runtime.currentRouteId);
  if (vehicleIndex < 0 || route === undefined) {
    throw new Error("Unit 211 recovery fixture identity is unavailable.");
  }

  const vehicle = scenario.vehicles[vehicleIndex];
  scenario.vehicles[vehicleIndex] = {
    ...vehicle,
    position: geoPoint(route.geometry.geometry.coordinates[0]),
    routeProgress: 0,
  };

  return {
    auditTimeline: [{
      action: "SCENARIO_SNAPSHOT_CREATED",
      actor: "system",
      id: "audit-0001",
      result: "SUCCESS",
      scenarioRevision: UNIT_211_SCENARIO_REVISION_INITIAL,
      sequence: 1,
      target: UNIT_211_RECOVERY_FIXTURE_VERSION,
      timestamp: UNIT_211_SCENARIO_CLOCK.instant,
    }],
    constraints: structuredClone(UNIT_211_HUMAN_CONSTRAINTS),
    fixtureVersion: UNIT_211_RECOVERY_FIXTURE_VERSION,
    incident: {
      availableClearanceMeters: 3.9,
      exclusionZone: {
        geometry: runtime.exclusionZone,
        properties: {},
        type: "Feature",
      },
      id: "incident-unit-211-clearance-v1",
      incidentPoint: geoPoint(runtime.incidentSnap.coordinate),
      openedAt: UNIT_211_SCENARIO_CLOCK.instant,
      reasonCode: "CLEARANCE_BUFFER_VIOLATION",
      riskId: runtime.incidentSnap.riskId,
      routeId: runtime.currentRouteId,
      snapIndex: runtime.incidentSnap.index,
      status: "OPEN",
      vehicleId: runtime.vehicleId,
    },
    options: [],
    routeEffectCount: 0,
    scenario,
    scenarioClock: structuredClone(UNIT_211_SCENARIO_CLOCK),
    scenarioRevision: UNIT_211_SCENARIO_REVISION_INITIAL,
    workflowState: "IDLE",
  };
}
