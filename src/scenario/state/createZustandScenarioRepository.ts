import { createStore } from "zustand/vanilla";
import type { OperatingRegion, Vehicle } from "../../domain/entities";
import type { OperationalRecoveryRepository, SemanticScenarioMutation } from "../../domain/ports/OperationalRecoveryRepository";
import type { ScenarioRepository } from "../../domain/ports/ScenarioRepository";
import { browserSha256Crypto, sha256Fingerprint, type Sha256Crypto } from "../../domain/recovery/canonicalJson";
import {
  RecoveryErrorCodes,
  RecoveryWorkflowStatuses,
  recoveryFailure,
  recoverySuccess,
  type ApprovalGrant,
  type OperationalRecoverySnapshot,
  type RecoveryPlan,
  type RecoveryResult,
} from "../../domain/recovery/recoveryContracts";
import { recoveryPlansEqual, validateAndNormalizeRecoveryPlan } from "../../domain/recovery/recoveryValidation";
import { createSpainScenario } from "../fixtures/spain-v1";
import { browserStorage, loadScenarioOverrides, saveScenarioOverrides, type ScenarioOverrides, type StorageLike } from "../persistence/overrideStorage";

type ScenarioState = { scenario: OperatingRegion; overrides: ScenarioOverrides; operational: OperationalRecoverySnapshot };
export type ZustandScenarioRepository = ScenarioRepository & OperationalRecoveryRepository;

const initialOperationalSnapshot: OperationalRecoverySnapshot = {
  scenarioRevision: 1,
  workflowStatus: RecoveryWorkflowStatuses.idle,
  incident: {
    id: "incident-route-011-restriction-height-3.9",
    vehicleId: "vehicle-011",
    riskId: "restriction-height-3.9",
    routeId: "route-011",
    status: "OPEN",
  },
  plan: null,
  approvalGrant: null,
};

function applyOverrides(overrides: ScenarioOverrides): OperatingRegion {
  const fixture = createSpainScenario();
  const deleted = new Set(overrides.deletedVehicleIds);
  return {
    ...fixture,
    vehicles: fixture.vehicles.filter((vehicle) => !deleted.has(vehicle.internalId)).map((vehicle) => ({ ...vehicle, label: overrides.labels[vehicle.internalId] ?? vehicle.label })),
    routes: fixture.routes.filter((route) => !deleted.has(route.vehicleId)),
  };
}

function findVehicle(scenario: OperatingRegion, vehicleId: string): Vehicle | undefined {
  return scenario.vehicles.find((vehicle) => vehicle.internalId === vehicleId);
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

function detachedSnapshot(snapshot: OperationalRecoverySnapshot): OperationalRecoverySnapshot {
  return deepFreeze(structuredClone(snapshot));
}

function repositoryFailure<T>(): RecoveryResult<T> {
  return recoveryFailure(RecoveryErrorCodes.repositoryFailure, "The operational recovery repository could not complete the transition.", ["RETRY", "CONTACT_OPERATOR"]);
}

function revisionMismatch<T>(): RecoveryResult<T> {
  return recoveryFailure(RecoveryErrorCodes.revisionMismatch, "The scenario changed before the recovery transition could commit.", ["COMPARE_OPTIONS", "STAGE_PLAN"]);
}

function invalidWorkflow<T>(): RecoveryResult<T> {
  return recoveryFailure(RecoveryErrorCodes.invalidWorkflowState, "The recovery workflow is not in a valid state for this transition.", ["COMPARE_OPTIONS", "CONTACT_OPERATOR"]);
}

function planMismatch<T>(): RecoveryResult<T> {
  return recoveryFailure(RecoveryErrorCodes.planMismatch, "The requested plan does not match the active recovery plan.", ["COMPARE_OPTIONS", "CONTACT_OPERATOR"]);
}

function isActive(snapshot: OperationalRecoverySnapshot): boolean {
  return snapshot.workflowStatus === RecoveryWorkflowStatuses.staged
    || snapshot.workflowStatus === RecoveryWorkflowStatuses.reviewRequested
    || snapshot.workflowStatus === RecoveryWorkflowStatuses.approved;
}

function invalidatedAfterMutation(snapshot: OperationalRecoverySnapshot): OperationalRecoverySnapshot {
  return {
    ...snapshot,
    scenarioRevision: snapshot.scenarioRevision + 1,
    workflowStatus: isActive(snapshot) ? RecoveryWorkflowStatuses.invalidated : snapshot.workflowStatus,
    approvalGrant: isActive(snapshot) ? null : snapshot.approvalGrant,
  };
}

type StageDisposition = "STAGE" | "IDEMPOTENT";

function stageDisposition(snapshot: OperationalRecoverySnapshot, expectedScenarioRevision: number, plan: RecoveryPlan): RecoveryResult<StageDisposition> {
  if (snapshot.scenarioRevision !== expectedScenarioRevision) return revisionMismatch();
  if (isActive(snapshot)) return recoveryPlansEqual(snapshot.plan, plan) ? recoverySuccess("IDEMPOTENT") : planMismatch();
  if (snapshot.workflowStatus !== RecoveryWorkflowStatuses.idle && snapshot.workflowStatus !== RecoveryWorkflowStatuses.rejected && snapshot.workflowStatus !== RecoveryWorkflowStatuses.invalidated) return invalidWorkflow();
  return recoverySuccess("STAGE");
}

export function createZustandScenarioRepository(storage: StorageLike = browserStorage(), cryptoCapability: Sha256Crypto | null | undefined = browserSha256Crypto()): ZustandScenarioRepository {
  const overrides = loadScenarioOverrides(storage);
  const store = createStore<ScenarioState>()(() => ({ overrides, scenario: applyOverrides(overrides), operational: initialOperationalSnapshot }));

  function persist(nextOverrides: ScenarioOverrides): boolean {
    if (!saveScenarioOverrides(storage, nextOverrides)) return false;
    store.setState({ overrides: nextOverrides, scenario: applyOverrides(nextOverrides) });
    return true;
  }

  function operationalTransition(transition: (snapshot: OperationalRecoverySnapshot) => RecoveryResult<OperationalRecoverySnapshot>): RecoveryResult<OperationalRecoverySnapshot> {
    let result: RecoveryResult<OperationalRecoverySnapshot> = repositoryFailure();
    try {
      store.setState((state) => {
        const candidate = transition(state.operational);
        if (!candidate.ok) {
          result = candidate;
          return state;
        }
        if (candidate.data === state.operational) {
          result = recoverySuccess(detachedSnapshot(state.operational));
          return state;
        }
        const next = detachedSnapshot(candidate.data);
        result = recoverySuccess(detachedSnapshot(next));
        return { ...state, operational: next };
      });
      return result;
    } catch {
      return repositoryFailure();
    }
  }

  return {
    scenarioCurrent: () => store.getState().scenario,
    vehicleGet: (vehicleId) => findVehicle(store.getState().scenario, vehicleId),
    vehicleRename: (vehicleId, label) => {
      const vehicle = findVehicle(store.getState().scenario, vehicleId);
      if (vehicle === undefined) return undefined;
      const nextOverrides = { ...store.getState().overrides, labels: { ...store.getState().overrides.labels, [vehicleId]: label } };
      return persist(nextOverrides) ? findVehicle(store.getState().scenario, vehicleId) : undefined;
    },
    vehicleDelete: (vehicleId) => {
      let deletedVehicle: Vehicle | undefined;
      store.setState((state) => {
        const vehicle = findVehicle(state.scenario, vehicleId);
        if (vehicle === undefined) return state;
        const labels = { ...state.overrides.labels };
        delete labels[vehicleId];
        const nextOverrides = { ...state.overrides, labels, deletedVehicleIds: [...new Set([...state.overrides.deletedVehicleIds, vehicleId])] };
        if (!saveScenarioOverrides(storage, nextOverrides)) return state;
        deletedVehicle = structuredClone(vehicle);
        return { overrides: nextOverrides, scenario: applyOverrides(nextOverrides), operational: invalidatedAfterMutation(state.operational) };
      });
      return deletedVehicle;
    },
    operationalRead: () => {
      try {
        return recoverySuccess(detachedSnapshot(store.getState().operational));
      } catch {
        return repositoryFailure();
      }
    },
    operationalStage: async ({ expectedScenarioRevision, plan }) => {
      const validated = validateAndNormalizeRecoveryPlan(plan);
      if (validated === false || validated.plan.basedOnScenarioRevision !== expectedScenarioRevision) return planMismatch();
      let preflight: RecoveryResult<StageDisposition>;
      try {
        preflight = stageDisposition(store.getState().operational, expectedScenarioRevision, validated.plan);
      } catch {
        return repositoryFailure();
      }
      if (!preflight.ok) return preflight;
      const recomputed = await sha256Fingerprint(validated.payload, cryptoCapability);
      if (!recomputed.ok) return recomputed;
      if (recomputed.data !== validated.plan.fingerprint) return planMismatch();
      return operationalTransition((snapshot) => {
        const disposition = stageDisposition(snapshot, expectedScenarioRevision, validated.plan);
        if (!disposition.ok) return disposition;
        if (disposition.data === "IDEMPOTENT") return recoverySuccess(snapshot);
        return recoverySuccess({ ...snapshot, workflowStatus: RecoveryWorkflowStatuses.staged, plan: deepFreeze(structuredClone(validated.plan)), approvalGrant: null });
      });
    },
    operationalRequestReview: ({ expectedScenarioRevision, planId }) => operationalTransition((snapshot) => {
      if (snapshot.scenarioRevision !== expectedScenarioRevision) return revisionMismatch();
      if (snapshot.plan === null || snapshot.plan.planId !== planId) return planMismatch();
      if (snapshot.workflowStatus === RecoveryWorkflowStatuses.reviewRequested || snapshot.workflowStatus === RecoveryWorkflowStatuses.approved) return recoverySuccess(snapshot);
      if (snapshot.workflowStatus !== RecoveryWorkflowStatuses.staged) return invalidWorkflow();
      return recoverySuccess({ ...snapshot, workflowStatus: RecoveryWorkflowStatuses.reviewRequested });
    }),
    operationalApprove: ({ expectedScenarioRevision, planId }) => operationalTransition((snapshot) => {
      if (snapshot.scenarioRevision !== expectedScenarioRevision) return revisionMismatch();
      if (snapshot.plan === null || snapshot.plan.planId !== planId) return planMismatch();
      if (snapshot.workflowStatus === RecoveryWorkflowStatuses.approved && snapshot.approvalGrant !== null) return recoverySuccess(snapshot);
      if (snapshot.workflowStatus !== RecoveryWorkflowStatuses.reviewRequested) return invalidWorkflow();
      const approvalGrant: ApprovalGrant = {
        planId: snapshot.plan.planId,
        fingerprint: snapshot.plan.fingerprint,
        scenarioRevision: snapshot.scenarioRevision,
        approvedAt: snapshot.plan.createdAt,
        approvedBy: "human-ui",
        used: false,
      };
      return recoverySuccess({ ...snapshot, workflowStatus: RecoveryWorkflowStatuses.approved, approvalGrant });
    }),
    operationalReject: ({ expectedScenarioRevision, planId }) => operationalTransition((snapshot) => {
      if (snapshot.scenarioRevision !== expectedScenarioRevision) return revisionMismatch();
      if (snapshot.plan === null || snapshot.plan.planId !== planId) return planMismatch();
      if (snapshot.workflowStatus === RecoveryWorkflowStatuses.rejected) return recoverySuccess(snapshot);
      if (snapshot.workflowStatus !== RecoveryWorkflowStatuses.staged && snapshot.workflowStatus !== RecoveryWorkflowStatuses.reviewRequested && snapshot.workflowStatus !== RecoveryWorkflowStatuses.approved) return invalidWorkflow();
      return recoverySuccess({ ...snapshot, workflowStatus: RecoveryWorkflowStatuses.rejected, approvalGrant: null });
    }),
    operationalInvalidateForScenarioMutation: ({ expectedScenarioRevision, mutation }: Readonly<{ expectedScenarioRevision: number; mutation: SemanticScenarioMutation }>) => {
      void mutation;
      return operationalTransition((snapshot) => snapshot.scenarioRevision === expectedScenarioRevision ? recoverySuccess(invalidatedAfterMutation(snapshot)) : revisionMismatch());
    },
    operationalSubscribe: (listener) => store.subscribe((state, previousState) => {
      if (state.operational === previousState.operational) return;
      try {
        listener(detachedSnapshot(state.operational));
      } catch {
        // Subscriber failures cannot roll back an already committed repository transition.
      }
    }),
  };
}
