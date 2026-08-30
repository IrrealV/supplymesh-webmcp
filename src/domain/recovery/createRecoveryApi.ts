import type { Cargo, GeoPoint } from "../entities";
import type { OperationalRecoveryRepository } from "../ports/OperationalRecoveryRepository";
import type {
  ApprovalGrant,
  HumanConstraints,
  OperationReceipt,
  OperationalRecoverySnapshot,
  RecoveryOption,
  RecoveryPlan,
  RecoveryResult,
  RecoveryVehicleReference,
  RecoveryWorkflowState,
  ScenarioClock,
  VerificationReport,
} from "./types";

export type RecoveryIncidentInspection = {
  availableClearanceMeters: number;
  exclusionZone: {
    coordinateCount: number;
    source: "clearance-alternative-runtime-adapter";
  };
  id: string;
  incidentPoint: GeoPoint;
  reasonCode: "CLEARANCE_BUFFER_VIOLATION";
  riskId: string;
  routeId: string;
  snapIndex: number;
  status: "OPEN" | "RESOLVED";
  vehicleId: string;
};

export type RecoveryVehicleContext = RecoveryVehicleReference & {
  cargo: Cargo;
  currentRouteId: string;
  destination: string;
  heightMeters: number;
  origin: string;
  remainingDriveMinutes: number;
  restDeadline: string;
  routeProgress: number;
};

export type RecoveryOperationsContext = {
  constraints: HumanConstraints;
  incident: RecoveryIncidentInspection;
  scenarioClock: ScenarioClock;
  scenarioRevision: number;
  snapshotLabel: "Deterministic demo snapshot";
  vehicle: RecoveryVehicleContext;
  workflowState: RecoveryWorkflowState;
};

export type RecoveryOptionSummary = Omit<RecoveryOption, "geometry">;

export type RecoveryPlanStatus = {
  approval?: ApprovalGrant;
  plan?: RecoveryPlan;
  scenarioRevision: number;
  workflowState: RecoveryWorkflowState;
};

export type RecoveryAgentApi = {
  incidentInspect(): RecoveryResult<RecoveryIncidentInspection>;
  operationReceiptGet(command: {
    planId: string;
  }): RecoveryResult<OperationReceipt>;
  operationsContext(): RecoveryResult<RecoveryOperationsContext>;
  recoveryOptionsCompare(): RecoveryResult<RecoveryOptionSummary[]>;
  recoveryPlanExecute(command: {
    fingerprint: string;
    planId: string;
    proposedRouteId: string;
    vehicleId: string;
  }): RecoveryResult<OperationReceipt>;
  recoveryPlanRequestReview(command: {
    planId: string;
  }): RecoveryResult<RecoveryPlan>;
  recoveryPlanStage(command: {
    selectedOptionId: string;
  }): RecoveryResult<RecoveryPlan>;
  recoveryPlanStatus(): RecoveryResult<RecoveryPlanStatus>;
  recoveryVerify(command: {
    planId: string;
  }): RecoveryResult<VerificationReport>;
};

export type RecoveryHumanApi = {
  clearanceBufferSet(command: {
    clearanceBufferMeters: number;
  }): RecoveryResult<OperationalRecoverySnapshot>;
  recoveryPlanApprove(command: {
    planId: string;
  }): RecoveryResult<ApprovalGrant>;
  recoveryPlanReject(command: {
    planId: string;
  }): RecoveryResult<RecoveryPlan>;
  recoveryReset(): RecoveryResult<OperationalRecoverySnapshot>;
};

export type RecoveryApi = {
  agent: RecoveryAgentApi;
  getSnapshot(): OperationalRecoverySnapshot;
  human: RecoveryHumanApi;
  subscribe(
    listener: (snapshot: OperationalRecoverySnapshot) => void,
  ): () => void;
};

function success<T>(code: string, data: T): RecoveryResult<T> {
  return { code, data: structuredClone(data), ok: true };
}

function failure<T>(
  code: string,
  message: string,
  nextAction: string,
): RecoveryResult<T> {
  return { error: { code, message, nextAction }, ok: false };
}

function incidentInspection(
  snapshot: OperationalRecoverySnapshot,
): RecoveryIncidentInspection {
  const polygon = snapshot.incident.exclusionZone.geometry.coordinates[0];
  return {
    availableClearanceMeters: snapshot.incident.availableClearanceMeters,
    exclusionZone: {
      coordinateCount: polygon?.length ?? 0,
      source: "clearance-alternative-runtime-adapter",
    },
    id: snapshot.incident.id,
    incidentPoint: structuredClone(snapshot.incident.incidentPoint),
    reasonCode: snapshot.incident.reasonCode,
    riskId: snapshot.incident.riskId,
    routeId: snapshot.incident.routeId,
    snapIndex: snapshot.incident.snapIndex,
    status: snapshot.incident.status,
    vehicleId: snapshot.incident.vehicleId,
  };
}

function recoveryVehicleContext(
  snapshot: OperationalRecoverySnapshot,
): RecoveryResult<RecoveryVehicleContext> {
  const vehicle = snapshot.scenario.vehicles.find(
    ({ internalId }) => internalId === snapshot.incident.vehicleId,
  );
  if (vehicle === undefined) {
    return failure(
      "VEHICLE_CONTEXT_UNAVAILABLE",
      "The incident vehicle is absent from authoritative state.",
      "Reset the deterministic demo and inspect the incident again.",
    );
  }
  return success("VEHICLE_CONTEXT_READY", {
    cargo: vehicle.cargo,
    currentRouteId: vehicle.routeId,
    destination: vehicle.destination.name,
    fleetNumber: vehicle.fleetNumber,
    heightMeters: vehicle.dimensions.heightMeters,
    label: vehicle.label,
    origin: vehicle.origin.name,
    remainingDriveMinutes: vehicle.timing.remainingDriveMinutes,
    restDeadline: vehicle.timing.restDeadline,
    routeProgress: vehicle.routeProgress,
    vehicleId: vehicle.internalId,
  });
}

function optionSummary(option: RecoveryOption): RecoveryOptionSummary {
  return structuredClone({
    currentRouteId: option.currentRouteId,
    feasible: option.feasible,
    id: option.id,
    incidentId: option.incidentId,
    kind: option.kind,
    metrics: option.metrics,
    reasonCodes: option.reasonCodes,
    risksIntroduced: option.risksIntroduced,
    risksResolved: option.risksResolved,
    routeId: option.routeId,
    validation: option.validation,
    vehicleId: option.vehicleId,
  });
}

export function createRecoveryApi(
  repository: OperationalRecoveryRepository,
): RecoveryApi {
  const agent: RecoveryAgentApi = {
    incidentInspect: () =>
      success(
        "INCIDENT_READY",
        incidentInspection(repository.recoverySnapshot()),
      ),
    operationReceiptGet: (command) =>
      repository.operationReceiptGet(command),
    operationsContext: () => {
      const snapshot = repository.recoverySnapshot();
      const vehicle = recoveryVehicleContext(snapshot);
      if (!vehicle.ok) {
        return vehicle;
      }
      return success("OPERATIONS_CONTEXT_READY", {
        constraints: snapshot.constraints,
        incident: incidentInspection(snapshot),
        scenarioClock: snapshot.scenarioClock,
        scenarioRevision: snapshot.scenarioRevision,
        snapshotLabel: "Deterministic demo snapshot",
        vehicle: vehicle.data,
        workflowState: snapshot.workflowState,
      });
    },
    recoveryOptionsCompare: () => {
      const result = repository.recoveryOptionsCompare();
      return result.ok
        ? success(result.code, result.data.map(optionSummary))
        : result;
    },
    recoveryPlanExecute: (command) =>
      repository.recoveryPlanExecute(command),
    recoveryPlanRequestReview: (command) =>
      repository.recoveryPlanRequestReview(command),
    recoveryPlanStage: (command) =>
      repository.recoveryPlanStage(command),
    recoveryPlanStatus: () => {
      const snapshot = repository.recoverySnapshot();
      return success("PLAN_STATUS_READY", {
        ...(snapshot.approval === undefined
          ? {}
          : { approval: snapshot.approval }),
        ...(snapshot.plan === undefined ? {} : { plan: snapshot.plan }),
        scenarioRevision: snapshot.scenarioRevision,
        workflowState: snapshot.workflowState,
      });
    },
    recoveryVerify: (command) => repository.recoveryVerify(command),
  };

  const human: RecoveryHumanApi = {
    clearanceBufferSet: (command) =>
      repository.clearanceBufferSet(command),
    recoveryPlanApprove: (command) =>
      repository.recoveryPlanApprove(command),
    recoveryPlanReject: (command) =>
      repository.recoveryPlanReject(command),
    recoveryReset: () => repository.recoveryReset(),
  };

  return {
    agent,
    getSnapshot: () => repository.recoverySnapshot(),
    human,
    subscribe: (listener) => repository.subscribeRecovery(listener),
  };
}
