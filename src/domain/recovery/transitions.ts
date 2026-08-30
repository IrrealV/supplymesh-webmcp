import { canonicalSerialize, createPlanFingerprint } from "./fingerprint";
import type {
  ApprovalGrant,
  OperationalRecoverySnapshot,
  PlanFingerprintPayload,
  RecoveryOption,
  RecoveryPlan,
} from "./types";

export function planFingerprintPayload(plan: RecoveryPlan): PlanFingerprintPayload {
  return {
    basedOnScenarioRevision: plan.basedOnScenarioRevision,
    constraints: plan.constraints,
    currentRouteId: plan.currentRouteId,
    incidentId: plan.incidentId,
    optionMetrics: plan.optionMetrics,
    planId: plan.id,
    proposedRouteId: plan.proposedRouteId,
    selectedOptionId: plan.selectedOptionId,
    vehicleId: plan.vehicleId,
  };
}

export function stageRecoveryPlan(
  snapshot: OperationalRecoverySnapshot,
  option: RecoveryOption,
): RecoveryPlan {
  const planWithoutFingerprint: Omit<RecoveryPlan, "fingerprint"> = {
    basedOnScenarioRevision: snapshot.scenarioRevision,
    constraints: structuredClone(snapshot.constraints),
    createdAt: snapshot.scenarioClock.instant,
    currentRouteId: option.currentRouteId,
    id: `recovery-plan-${option.vehicleId}-r${snapshot.scenarioRevision}`,
    incidentId: option.incidentId,
    optionMetrics: {
      distanceMeters: option.metrics.summary.distanceMeters,
      durationSeconds: option.metrics.summary.durationSeconds,
    },
    proposedRouteId: option.routeId,
    selectedOptionId: option.id,
    status: "STAGED",
    vehicleId: option.vehicleId,
  };
  const fingerprint = createPlanFingerprint({
    basedOnScenarioRevision: planWithoutFingerprint.basedOnScenarioRevision,
    constraints: planWithoutFingerprint.constraints,
    currentRouteId: planWithoutFingerprint.currentRouteId,
    incidentId: planWithoutFingerprint.incidentId,
    optionMetrics: planWithoutFingerprint.optionMetrics,
    planId: planWithoutFingerprint.id,
    proposedRouteId: planWithoutFingerprint.proposedRouteId,
    selectedOptionId: planWithoutFingerprint.selectedOptionId,
    vehicleId: planWithoutFingerprint.vehicleId,
  });

  return { ...planWithoutFingerprint, fingerprint };
}

export function createApprovalGrant(
  snapshot: OperationalRecoverySnapshot,
  plan: RecoveryPlan,
): ApprovalGrant {
  return {
    approvedAt: snapshot.scenarioClock.instant,
    approvedBy: "human-ui",
    constraints: structuredClone(snapshot.constraints),
    currentRouteId: plan.currentRouteId,
    fingerprint: plan.fingerprint,
    incidentId: plan.incidentId,
    planId: plan.id,
    proposedRouteId: plan.proposedRouteId,
    scenarioRevision: snapshot.scenarioRevision,
    selectedOptionId: plan.selectedOptionId,
    used: false,
    vehicleId: plan.vehicleId,
  };
}

export function isPlanCurrent(
  snapshot: OperationalRecoverySnapshot,
  plan: RecoveryPlan,
): boolean {
  return plan.basedOnScenarioRevision === snapshot.scenarioRevision
    && plan.incidentId === snapshot.incident.id
    && plan.vehicleId === snapshot.incident.vehicleId
    && plan.currentRouteId === snapshot.incident.routeId
    && canonicalSerialize(plan.constraints) === canonicalSerialize(snapshot.constraints)
    && createPlanFingerprint(planFingerprintPayload(plan)) === plan.fingerprint;
}

export function isApprovalCurrent(
  snapshot: OperationalRecoverySnapshot,
  plan: RecoveryPlan,
  approval: ApprovalGrant,
): boolean {
  return isPlanCurrent(snapshot, plan)
    && approval.planId === plan.id
    && approval.fingerprint === plan.fingerprint
    && approval.scenarioRevision === snapshot.scenarioRevision
    && approval.vehicleId === plan.vehicleId
    && approval.currentRouteId === plan.currentRouteId
    && approval.proposedRouteId === plan.proposedRouteId
    && approval.incidentId === plan.incidentId
    && approval.selectedOptionId === plan.selectedOptionId
    && canonicalSerialize(approval.constraints)
      === canonicalSerialize(snapshot.constraints);
}
