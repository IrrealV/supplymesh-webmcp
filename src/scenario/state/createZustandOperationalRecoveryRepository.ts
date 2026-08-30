import { createStore } from "zustand/vanilla";
import type { OperatingRegion, Route, Vehicle } from "../../domain/entities";
import type { OperationalRecoveryRepository } from "../../domain/ports/OperationalRecoveryRepository";
import { canonicalSerialize, createPlanFingerprint } from "../../domain/recovery/fingerprint";
import { isClearanceBufferMetersValid } from "../../domain/recovery/policies";
import {
  createApprovalGrant,
  isApprovalCurrent,
  isPlanCurrent,
  planFingerprintPayload,
  stageRecoveryPlan,
} from "../../domain/recovery/transitions";
import type {
  AuditEvent,
  OperationReceipt,
  OperationalRecoverySnapshot,
  RecoveryOption,
  RecoveryPlan,
  RecoveryResult,
  VerificationReport,
} from "../../domain/recovery/types";
import {
  browserStorage,
  loadScenarioOverrides,
  saveScenarioOverrides,
  type ScenarioOverrides,
  type StorageLike,
} from "../persistence/overrideStorage";
import { readClearanceAlternativeRuntime } from "../recovery/clearanceAlternativeAdapter";
import {
  createUnit211RecoveryFixture,
  UNIT_211_RECOVERY_FIXTURE_VERSION,
} from "../recovery/createUnit211RecoveryFixture";
import { createUnit211RecoveryOptions } from "../recovery/createUnit211RecoveryOptions";
import { verifyUnit211Recovery } from "../recovery/verifyUnit211Recovery";

type OperationalStoreState = {
  overrides: ScenarioOverrides;
  snapshot: OperationalRecoverySnapshot;
};

type AuditInput = {
  action: string;
  actor: AuditEvent["actor"];
  reasonCode?: string;
  result?: AuditEvent["result"];
  scenarioRevision?: number;
  target: string;
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

function cloneSnapshot(snapshot: OperationalRecoverySnapshot): OperationalRecoverySnapshot {
  return structuredClone(snapshot);
}

function nextAuditEvent(
  snapshot: OperationalRecoverySnapshot,
  input: AuditInput,
): AuditEvent {
  const sequence = (snapshot.auditTimeline.at(-1)?.sequence ?? 0) + 1;
  return {
    action: input.action,
    actor: input.actor,
    id: `audit-${String(sequence).padStart(4, "0")}`,
    ...(input.reasonCode === undefined ? {} : { reasonCode: input.reasonCode }),
    result: input.result ?? "SUCCESS",
    scenarioRevision: input.scenarioRevision ?? snapshot.scenarioRevision,
    sequence,
    target: input.target,
    timestamp: snapshot.scenarioClock.instant,
  };
}

function appendAudit(
  snapshot: OperationalRecoverySnapshot,
  input: AuditInput,
): { event: AuditEvent; timeline: AuditEvent[] } {
  const event = nextAuditEvent(snapshot, input);
  return { event, timeline: [...snapshot.auditTimeline, event] };
}

function findVehicle(
  scenario: OperatingRegion,
  vehicleId: string,
): Vehicle | undefined {
  return scenario.vehicles.find(({ internalId }) => internalId === vehicleId);
}

function applyOverrides(
  snapshot: OperationalRecoverySnapshot,
  overrides: ScenarioOverrides,
): OperationalRecoverySnapshot {
  const deleted = new Set(
    overrides.deletedVehicleIds.filter((vehicleId) => vehicleId !== "vehicle-011"),
  );
  return {
    ...snapshot,
    scenario: {
      ...snapshot.scenario,
      routes: snapshot.scenario.routes.filter(
        ({ vehicleId }) => !deleted.has(vehicleId),
      ),
      vehicles: snapshot.scenario.vehicles
        .filter(({ internalId }) => !deleted.has(internalId))
        .map((vehicle) => ({
          ...vehicle,
          label: overrides.labels[vehicle.internalId] ?? vehicle.label,
        })),
    },
  };
}

function optionForPlan(
  snapshot: OperationalRecoverySnapshot,
  plan: RecoveryPlan,
): RecoveryOption | undefined {
  return createUnit211RecoveryOptions(snapshot).find(
    ({ id }) => id === plan.selectedOptionId,
  );
}

function receiptCommandMatches(
  receipt: OperationReceipt,
  command: {
    fingerprint: string;
    planId: string;
    proposedRouteId: string;
    vehicleId: string;
  },
): RecoveryResult<OperationReceipt> {
  if (command.vehicleId !== receipt.vehicleId) {
    return failure(
      "WRONG_VEHICLE",
      "The execution vehicle does not match the approved receipt.",
      "Re-read the approved plan status.",
    );
  }
  if (command.proposedRouteId !== receipt.appliedRouteId) {
    return failure(
      "PLAN_BINDING_MISMATCH",
      "The execution route does not match the approved receipt.",
      "Use the route bound by the human approval.",
    );
  }
  if (command.fingerprint !== receipt.approvalFingerprint) {
    return failure(
      "FINGERPRINT_MISMATCH",
      "The execution fingerprint does not match the approved receipt.",
      "Re-read the approved plan status.",
    );
  }
  return success("ALREADY_EXECUTED", receipt);
}

export function createZustandOperationalRecoveryRepository(
  storage: StorageLike = browserStorage(),
): OperationalRecoveryRepository {
  const overrides = loadScenarioOverrides(storage);
  const initialSnapshot = applyOverrides(createUnit211RecoveryFixture(), overrides);
  const store = createStore<OperationalStoreState>()(() => ({
    overrides,
    snapshot: initialSnapshot,
  }));

  return {
    scenarioCurrent: () => structuredClone(store.getState().snapshot.scenario),
    vehicleGet: (vehicleId) => {
      const vehicle = findVehicle(store.getState().snapshot.scenario, vehicleId);
      return vehicle === undefined ? undefined : structuredClone(vehicle);
    },
    vehicleRename: (vehicleId, label) => {
      const state = store.getState();
      const vehicle = findVehicle(state.snapshot.scenario, vehicleId);
      if (vehicle === undefined) {
        return undefined;
      }
      const nextOverrides: ScenarioOverrides = {
        ...state.overrides,
        labels: { ...state.overrides.labels, [vehicleId]: label },
      };
      if (!saveScenarioOverrides(storage, nextOverrides)) {
        return undefined;
      }
      const renamed = { ...vehicle, label };
      store.setState({
        overrides: nextOverrides,
        snapshot: {
          ...state.snapshot,
          scenario: {
            ...state.snapshot.scenario,
            vehicles: state.snapshot.scenario.vehicles.map((entry) =>
              entry.internalId === vehicleId ? renamed : entry
            ),
          },
        },
      });
      return structuredClone(renamed);
    },
    vehicleDelete: (vehicleId) => {
      const state = store.getState();
      const vehicle = findVehicle(state.snapshot.scenario, vehicleId);
      if (vehicle === undefined || vehicleId === "vehicle-011") {
        return undefined;
      }
      const labels = { ...state.overrides.labels };
      delete labels[vehicleId];
      const nextOverrides: ScenarioOverrides = {
        deletedVehicleIds: [
          ...new Set([...state.overrides.deletedVehicleIds, vehicleId]),
        ],
        labels,
        version: 1,
      };
      if (!saveScenarioOverrides(storage, nextOverrides)) {
        return undefined;
      }
      store.setState({
        overrides: nextOverrides,
        snapshot: {
          ...state.snapshot,
          scenario: {
            ...state.snapshot.scenario,
            routes: state.snapshot.scenario.routes.filter(
              ({ vehicleId: routeVehicleId }) => routeVehicleId !== vehicleId,
            ),
            vehicles: state.snapshot.scenario.vehicles.filter(
              ({ internalId }) => internalId !== vehicleId,
            ),
          },
        },
      });
      return structuredClone(vehicle);
    },
    recoverySnapshot: () => cloneSnapshot(store.getState().snapshot),
    subscribeRecovery: (listener) =>
      store.subscribe((state, previousState) => {
        if (state.snapshot !== previousState.snapshot) {
          listener(cloneSnapshot(state.snapshot));
        }
      }),
    recoveryOptionsCompare: () => {
      let result: RecoveryResult<RecoveryOption[]> = failure(
        "OPTIONS_UNAVAILABLE",
        "Recovery options could not be compared.",
        "Inspect the incident and retry.",
      );
      store.setState((state) => {
        const snapshot = state.snapshot;
        if (snapshot.incident.status !== "OPEN" || snapshot.receipt !== undefined) {
          result = failure(
            "WORKFLOW_COMPLETE",
            "Recovery options cannot change after execution.",
            "Reset the deterministic demo to start again.",
          );
          return state;
        }
        if (![
          "IDLE",
          "OPTIONS_READY",
          "INVALIDATED",
          "REJECTED",
        ].includes(snapshot.workflowState)) {
          result = failure(
            "WORKFLOW_LOCKED",
            "Recovery options cannot be recomputed while a plan holds workflow authority.",
            "Continue the current plan workflow or change a hard constraint.",
          );
          return state;
        }
        const options = createUnit211RecoveryOptions(snapshot);
        const audit = appendAudit(snapshot, {
          action: "RECOVERY_OPTIONS_COMPARED",
          actor: "agent",
          target: snapshot.incident.id,
        });
        const nextSnapshot: OperationalRecoverySnapshot = {
          ...snapshot,
          auditTimeline: audit.timeline,
          options,
          workflowState: "OPTIONS_READY",
        };
        result = success("OPTIONS_READY", options);
        return { ...state, snapshot: nextSnapshot };
      });
      return result;
    },
    recoveryPlanStage: ({ selectedOptionId }) => {
      let result: RecoveryResult<RecoveryPlan> = failure(
        "PLAN_NOT_STAGED",
        "The recovery plan could not be staged.",
        "Compare recovery options first.",
      );
      store.setState((state) => {
        const snapshot = state.snapshot;
        if (snapshot.incident.status !== "OPEN" || snapshot.receipt !== undefined) {
          result = failure(
            "WORKFLOW_COMPLETE",
            "A completed recovery workflow cannot stage another plan.",
            "Reset the deterministic demo to start again.",
          );
          return state;
        }
        if (![
          "OPTIONS_READY",
          "INVALIDATED",
        ].includes(snapshot.workflowState)) {
          result = failure(
            "WORKFLOW_LOCKED",
            "A plan can only be staged from current recovery options.",
            "Compare options or finish the current plan workflow.",
          );
          return state;
        }
        const option = snapshot.options.find(({ id }) => id === selectedOptionId);
        if (option === undefined) {
          result = failure(
            "OPTION_NOT_FOUND",
            "The selected recovery option is not available.",
            "Compare current recovery options.",
          );
          return state;
        }
        if (!option.feasible || option.kind !== "ALTERNATIVE_ROUTE") {
          result = failure(
            "OPTION_INFEASIBLE",
            "Only a feasible verified alternative can be staged.",
            "Select the verified clearance alternative.",
          );
          return state;
        }
        const plan = stageRecoveryPlan(snapshot, option);
        const audit = appendAudit(snapshot, {
          action: "RECOVERY_PLAN_STAGED",
          actor: "agent",
          target: plan.id,
        });
        const nextSnapshot: OperationalRecoverySnapshot = {
          ...snapshot,
          approval: undefined,
          auditTimeline: audit.timeline,
          plan,
          verification: undefined,
          workflowState: "PLAN_STAGED",
        };
        result = success("PLAN_STAGED", plan);
        return { ...state, snapshot: nextSnapshot };
      });
      return result;
    },
    recoveryPlanRequestReview: ({ planId }) => {
      let result: RecoveryResult<RecoveryPlan> = failure(
        "REVIEW_NOT_REQUESTED",
        "Human review could not be requested.",
        "Stage a current recovery plan first.",
      );
      store.setState((state) => {
        const snapshot = state.snapshot;
        const plan = snapshot.plan;
        if (plan === undefined || plan.id !== planId) {
          result = failure(
            "PLAN_NOT_FOUND",
            "The recovery plan was not found.",
            "Read the current plan status.",
          );
          return state;
        }
        if (plan.status !== "STAGED" || !isPlanCurrent(snapshot, plan)) {
          result = failure(
            "STATE_CHANGED",
            "The staged plan no longer matches authoritative state.",
            "Recompare options and stage a new plan.",
          );
          return state;
        }
        const reviewedPlan: RecoveryPlan = {
          ...plan,
          status: "REVIEW_REQUESTED",
        };
        const audit = appendAudit(snapshot, {
          action: "RECOVERY_REVIEW_REQUESTED",
          actor: "agent",
          target: plan.id,
        });
        const nextSnapshot: OperationalRecoverySnapshot = {
          ...snapshot,
          auditTimeline: audit.timeline,
          plan: reviewedPlan,
          workflowState: "REVIEW_REQUESTED",
        };
        result = success("REVIEW_REQUESTED", reviewedPlan);
        return { ...state, snapshot: nextSnapshot };
      });
      return result;
    },
    recoveryPlanApprove: ({ planId }) => {
      let result = failure<ReturnType<typeof createApprovalGrant>>(
        "APPROVAL_NOT_GRANTED",
        "The recovery plan could not be approved.",
        "Request human review of a current plan.",
      );
      store.setState((state) => {
        const snapshot = state.snapshot;
        const plan = snapshot.plan;
        if (plan === undefined || plan.id !== planId) {
          result = failure(
            "PLAN_NOT_FOUND",
            "The recovery plan was not found.",
            "Read the current plan status.",
          );
          return state;
        }
        const currentOption = optionForPlan(snapshot, plan);
        if (
          plan.status !== "REVIEW_REQUESTED"
          || !isPlanCurrent(snapshot, plan)
          || currentOption === undefined
          || !currentOption.feasible
        ) {
          result = failure(
            "STATE_CHANGED",
            "The plan is stale or no longer satisfies hard constraints.",
            "Recompare options and request review again.",
          );
          return state;
        }
        const approval = createApprovalGrant(snapshot, plan);
        const approvedPlan: RecoveryPlan = { ...plan, status: "APPROVED" };
        const audit = appendAudit(snapshot, {
          action: "RECOVERY_PLAN_APPROVED",
          actor: "human",
          target: plan.id,
        });
        const nextSnapshot: OperationalRecoverySnapshot = {
          ...snapshot,
          approval,
          auditTimeline: audit.timeline,
          plan: approvedPlan,
          workflowState: "APPROVED",
        };
        result = success("APPROVED", approval);
        return { ...state, snapshot: nextSnapshot };
      });
      return result;
    },
    recoveryPlanReject: ({ planId }) => {
      let result: RecoveryResult<RecoveryPlan> = failure(
        "REJECTION_NOT_RECORDED",
        "The recovery plan could not be rejected.",
        "Request human review of a current plan.",
      );
      store.setState((state) => {
        const snapshot = state.snapshot;
        const plan = snapshot.plan;
        if (plan === undefined || plan.id !== planId) {
          result = failure(
            "PLAN_NOT_FOUND",
            "The recovery plan was not found.",
            "Read the current plan status.",
          );
          return state;
        }
        if (plan.status !== "REVIEW_REQUESTED" && plan.status !== "APPROVED") {
          result = failure(
            "REVIEW_REQUIRED",
            "Only a plan in human review can be rejected.",
            "Request review before rejecting the plan.",
          );
          return state;
        }
        const rejectedPlan: RecoveryPlan = { ...plan, status: "REJECTED" };
        const audit = appendAudit(snapshot, {
          action: "RECOVERY_PLAN_REJECTED",
          actor: "human",
          reasonCode: "HUMAN_REJECTED",
          result: "REJECTED",
          target: plan.id,
        });
        const nextSnapshot: OperationalRecoverySnapshot = {
          ...snapshot,
          approval: undefined,
          auditTimeline: audit.timeline,
          plan: rejectedPlan,
          workflowState: "REJECTED",
        };
        result = success("REJECTED", rejectedPlan);
        return { ...state, snapshot: nextSnapshot };
      });
      return result;
    },
    clearanceBufferSet: ({ clearanceBufferMeters }) => {
      let result: RecoveryResult<OperationalRecoverySnapshot> = failure(
        "CONSTRAINT_NOT_CHANGED",
        "The clearance buffer could not be changed.",
        "Use a finite value from 0 through 1 metre.",
      );
      store.setState((state) => {
        const snapshot = state.snapshot;
        if (!isClearanceBufferMetersValid(clearanceBufferMeters)) {
          result = failure(
            "INVALID_CONSTRAINT",
            "Clearance buffer must be a finite value from 0 through 1 metre.",
            "Choose a valid human clearance buffer.",
          );
          return state;
        }
        if (snapshot.receipt !== undefined) {
          result = failure(
            "WORKFLOW_COMPLETE",
            "Constraints cannot change after execution.",
            "Reset the deterministic demo to start again.",
          );
          return state;
        }
        if (
          snapshot.constraints.clearanceBufferMeters.value
          === clearanceBufferMeters
        ) {
          result = success("CONSTRAINT_UNCHANGED", snapshot);
          return state;
        }

        const scenarioRevision = snapshot.scenarioRevision + 1;
        const nextPlan = snapshot.plan === undefined
          ? undefined
          : { ...snapshot.plan, status: "INVALIDATED" as const };
        const projection: OperationalRecoverySnapshot = {
          ...snapshot,
          approval: undefined,
          constraints: {
            ...snapshot.constraints,
            clearanceBufferMeters: {
              ...snapshot.constraints.clearanceBufferMeters,
              value: clearanceBufferMeters,
            },
          },
          plan: nextPlan,
          scenarioRevision,
          verification: undefined,
          workflowState: nextPlan === undefined ? "OPTIONS_READY" : "INVALIDATED",
        };
        const options = createUnit211RecoveryOptions(projection);
        const audit = appendAudit(projection, {
          action: "CLEARANCE_BUFFER_CHANGED",
          actor: "human",
          reasonCode: nextPlan === undefined
            ? "CONSTRAINT_CHANGED"
            : "APPROVAL_INVALIDATED",
          scenarioRevision,
          target: snapshot.incident.id,
        });
        const nextSnapshot: OperationalRecoverySnapshot = {
          ...projection,
          auditTimeline: audit.timeline,
          options,
        };
        result = success("CONSTRAINT_CHANGED", nextSnapshot);
        return { ...state, snapshot: nextSnapshot };
      });
      return result;
    },
    recoveryPlanExecute: (command) => {
      let result: RecoveryResult<OperationReceipt> = failure(
        "EXECUTION_REJECTED",
        "The approved recovery plan could not be executed.",
        "Read the current plan and approval status.",
      );
      store.setState((state) => {
        const snapshot = state.snapshot;
        if (
          snapshot.receipt !== undefined
          && snapshot.receipt.planId === command.planId
        ) {
          result = receiptCommandMatches(snapshot.receipt, command);
          return state;
        }

        const plan = snapshot.plan;
        if (plan === undefined || plan.id !== command.planId) {
          result = failure(
            "PLAN_NOT_FOUND",
            "The recovery plan was not found.",
            "Read the current plan status.",
          );
          return state;
        }
        if (plan.status === "INVALIDATED") {
          result = failure(
            "APPROVAL_INVALIDATED",
            "The plan approval was invalidated by authoritative state.",
            "Recompare options and request human review again.",
          );
          return state;
        }
        if (command.vehicleId !== plan.vehicleId) {
          result = failure(
            "WRONG_VEHICLE",
            "The execution vehicle does not match the approved plan.",
            "Use the vehicle bound by the human approval.",
          );
          return state;
        }
        if (command.proposedRouteId !== plan.proposedRouteId) {
          result = failure(
            "PLAN_BINDING_MISMATCH",
            "The execution route does not match the approved plan.",
            "Use the route bound by the human approval.",
          );
          return state;
        }
        if (command.fingerprint !== plan.fingerprint) {
          result = failure(
            "FINGERPRINT_MISMATCH",
            "The execution fingerprint does not match the approved plan.",
            "Read the current approved plan status.",
          );
          return state;
        }

        const approval = snapshot.approval;
        if (
          plan.status !== "APPROVED"
          || approval === undefined
          || approval.used
        ) {
          result = failure(
            "APPROVAL_REQUIRED",
            "A current unused human approval is required.",
            "Request human review and approval.",
          );
          return state;
        }
        if (!isApprovalCurrent(snapshot, plan, approval)) {
          result = failure(
            "STATE_CHANGED",
            "Authoritative state no longer matches the human approval.",
            "Recompare options and request approval again.",
          );
          return state;
        }
        const recomputedFingerprint = createPlanFingerprint(
          planFingerprintPayload(plan),
        );
        const option = optionForPlan(snapshot, plan);
        if (
          recomputedFingerprint !== command.fingerprint
          || option === undefined
          || !option.feasible
          || option.routeId !== plan.proposedRouteId
          || canonicalSerialize(plan.optionMetrics)
            !== canonicalSerialize({
              distanceMeters: option.metrics.summary.distanceMeters,
              durationSeconds: option.metrics.summary.durationSeconds,
            })
        ) {
          result = failure(
            "APPROVAL_INVALIDATED",
            "The approved plan failed authoritative revalidation.",
            "Recompare options and request approval again.",
          );
          return state;
        }
        if (snapshot.incident.status !== "OPEN") {
          result = failure(
            "INCIDENT_STATE_CHANGED",
            "The approved incident is no longer open.",
            "Inspect current incident state.",
          );
          return state;
        }

        const vehicle = findVehicle(snapshot.scenario, plan.vehicleId);
        const currentRouteIndex = snapshot.scenario.routes.findIndex(
          ({ id, vehicleId }) =>
            id === plan.currentRouteId && vehicleId === plan.vehicleId
        );
        if (
          vehicle === undefined
          || vehicle.routeId !== plan.currentRouteId
          || currentRouteIndex < 0
        ) {
          result = failure(
            "STATE_CHANGED",
            "The active vehicle route no longer matches the approved plan.",
            "Recompare options and stage a new plan.",
          );
          return state;
        }

        const runtime = readClearanceAlternativeRuntime();
        const afterRevision = snapshot.scenarioRevision + 1;
        const audit = appendAudit(snapshot, {
          action: "RECOVERY_PLAN_EXECUTED",
          actor: "agent",
          scenarioRevision: afterRevision,
          target: plan.id,
        });
        const appliedRoute: Route = {
          geometry: structuredClone(runtime.geometry),
          id: plan.proposedRouteId,
          name: vehicle.currentRoute,
          riskSnaps: [],
          summary: structuredClone(runtime.summary),
          vehicleId: vehicle.internalId,
        };
        const routes = [...snapshot.scenario.routes];
        routes[currentRouteIndex] = appliedRoute;
        const vehicles = snapshot.scenario.vehicles.map((entry) =>
          entry.internalId === vehicle.internalId
            ? {
              ...entry,
              cargo: structuredClone(vehicle.cargo),
              riskIds: entry.riskIds.filter(
                (riskId) => riskId !== snapshot.incident.riskId,
              ),
              routeId: plan.proposedRouteId,
              routeProgress: 0,
            }
            : entry
        );
        const receipt: OperationReceipt = {
          afterRevision,
          appliedRouteId: plan.proposedRouteId,
          approvalFingerprint: approval.fingerprint,
          approvalSource: approval.approvedBy,
          auditEventIds: audit.timeline.map(({ id }) => id),
          beforeRevision: snapshot.scenarioRevision,
          constraints: structuredClone(snapshot.constraints),
          executedOnce: true,
          incidentId: snapshot.incident.id,
          planId: plan.id,
          previousRouteId: plan.currentRouteId,
          receiptId: `operation-receipt-${plan.id}`,
          vehicleId: plan.vehicleId,
          verificationSummary: { reportId: "", status: "PENDING" },
        };
        const nextSnapshot: OperationalRecoverySnapshot = {
          ...snapshot,
          approval: { ...approval, used: true },
          auditTimeline: audit.timeline,
          incident: { ...snapshot.incident, status: "RESOLVED" },
          plan: { ...plan, status: "EXECUTED" },
          receipt,
          routeEffectCount: snapshot.routeEffectCount + 1,
          scenario: { ...snapshot.scenario, routes, vehicles },
          scenarioRevision: afterRevision,
          verification: undefined,
          workflowState: "EXECUTED",
        };
        result = success("EXECUTED", receipt);
        return { ...state, snapshot: nextSnapshot };
      });
      return result;
    },
    recoveryVerify: ({ planId }) => {
      let result: RecoveryResult<VerificationReport> = failure(
        "VERIFICATION_UNAVAILABLE",
        "Recovery verification is not available.",
        "Execute an approved recovery plan first.",
      );
      store.setState((state) => {
        const snapshot = state.snapshot;
        if (
          snapshot.verification !== undefined
          && snapshot.verification.planId === planId
        ) {
          result = success("ALREADY_VERIFIED", snapshot.verification);
          return state;
        }
        if (
          snapshot.receipt === undefined
          || snapshot.receipt.planId !== planId
        ) {
          result = failure(
            "NOT_EXECUTED",
            "No executed recovery receipt exists for this plan.",
            "Execute the approved plan first.",
          );
          return state;
        }

        const report = verifyUnit211Recovery(
          cloneSnapshot(snapshot),
          createUnit211RecoveryFixture(),
        );
        const audit = appendAudit(snapshot, {
          action: "RECOVERY_VERIFIED",
          actor: "system",
          reasonCode: report.overall === "PASS"
            ? "VERIFICATION_PASS"
            : "VERIFICATION_FAIL",
          result: report.overall === "PASS" ? "SUCCESS" : "REJECTED",
          target: report.id,
        });
        const receipt: OperationReceipt = {
          ...snapshot.receipt,
          auditEventIds: audit.timeline.map(({ id }) => id),
          verificationSummary: {
            reportId: report.id,
            status: report.overall,
          },
        };
        const nextSnapshot: OperationalRecoverySnapshot = {
          ...snapshot,
          auditTimeline: audit.timeline,
          receipt,
          verification: report,
          workflowState: report.overall === "PASS"
            ? "VERIFIED"
            : "VERIFICATION_FAILED",
        };
        result = success(
          report.overall === "PASS" ? "VERIFIED" : "VERIFICATION_FAILED",
          report,
        );
        return { ...state, snapshot: nextSnapshot };
      });
      return result;
    },
    operationReceiptGet: ({ planId }) => {
      const receipt = store.getState().snapshot.receipt;
      if (receipt === undefined || receipt.planId !== planId) {
        return failure(
          "RECEIPT_NOT_FOUND",
          "No operation receipt exists for this plan.",
          "Execute and verify the approved recovery plan.",
        );
      }
      return success("RECEIPT_READY", receipt);
    },
    recoveryReset: () => {
      const state = store.getState();
      const emptyOverrides: ScenarioOverrides = {
        version: 1,
        labels: {},
        deletedVehicleIds: [],
      };
      if (!saveScenarioOverrides(storage, emptyOverrides)) {
        return failure(
          "RESET_PERSISTENCE_FAILED",
          "The deterministic demo reset could not be persisted.",
          "Retry after browser storage becomes available.",
        );
      }
      const scenarioRevision = state.snapshot.scenarioRevision + 1;
      const baseline = createUnit211RecoveryFixture();
      const resetSnapshot: OperationalRecoverySnapshot = {
        ...baseline,
        auditTimeline: [{
          action: "DEMO_RESET",
          actor: "human",
          id: "audit-0001",
          result: "SUCCESS",
          scenarioRevision,
          sequence: 1,
          target: UNIT_211_RECOVERY_FIXTURE_VERSION,
          timestamp: baseline.scenarioClock.instant,
        }],
        scenarioRevision,
      };
      store.setState({ overrides: emptyOverrides, snapshot: resetSnapshot });
      return success("RESET", resetSnapshot);
    },
  };
}
