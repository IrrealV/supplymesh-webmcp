import type { OperationalRecoveryRepository } from "../ports/OperationalRecoveryRepository";
import type { Unit211PreDispatchContextResult, Unit211PreDispatchData } from "../operations/unit211PreDispatchContext";
import { sha256Fingerprint, type Sha256Crypto } from "./canonicalJson";
import {
  RecoveryErrorCodes,
  RecoveryWorkflowStatuses,
  recoveryFailure,
  recoverySuccess,
  type ApprovalGrant,
  type OperationalRecoverySnapshot,
  type RecoveryAgentCapability,
  type RecoveryAvoidanceResult,
  type RecoveryClearanceResult,
  type RecoveryConstraintResults,
  type RecoveryErrorCode,
  type RecoveryHumanCapability,
  type RecoveryPlan,
  type RecoveryPlanPayload,
  type RecoveryResult,
  type RecoveryRouteMetrics,
} from "./recoveryContracts";
import {
  detachedOperationalSnapshot,
  normalizeRecoverySnapshotResult,
  payloadFromRecoveryPlan,
  recoveryPlanPayloadsEqual,
  recoveryPlansEqual,
} from "./recoveryValidation";

type ComparisonReader = () => Unit211PreDispatchContextResult;
type PlanInput = Readonly<{ selectedOptionId: string }>;
type PlanIdInput = Readonly<{ planId: string }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactStringInput(value: unknown, key: "selectedOptionId" | "planId"): string | false {
  if (!isRecord(value)) return false;
  let keys: (string | symbol)[];
  let descriptor: PropertyDescriptor | undefined;
  try {
    keys = Reflect.ownKeys(value);
    descriptor = Object.getOwnPropertyDescriptor(value, key);
  } catch {
    return false;
  }
  if (keys.length !== 1 || keys[0] !== key || descriptor === undefined || !("value" in descriptor) || typeof descriptor.value !== "string" || descriptor.value.trim().length === 0) return false;
  return descriptor.value;
}

function invalidInput<T>(expected: string): RecoveryResult<T> {
  return recoveryFailure(RecoveryErrorCodes.invalidInput, `The input must contain exactly one non-blank ${expected}.`, ["COMPARE_OPTIONS"]);
}

function comparisonUnavailable<T>(): RecoveryResult<T> {
  return recoveryFailure(RecoveryErrorCodes.comparisonUnavailable, "The authoritative Unit 211 comparison is unavailable or malformed.", ["RETRY", "CONTACT_OPERATOR"]);
}

function repositoryFailure<T>(isMalformed: boolean): RecoveryResult<T> {
  return recoveryFailure(
    isMalformed ? RecoveryErrorCodes.malformedRepositoryData : RecoveryErrorCodes.repositoryFailure,
    isMalformed ? "The operational recovery repository returned malformed data." : "The operational recovery repository could not complete the request.",
    ["RETRY", "CONTACT_OPERATOR"],
  );
}

function revisionMismatch<T>(): RecoveryResult<T> {
  return recoveryFailure(RecoveryErrorCodes.revisionMismatch, "The scenario changed before the recovery transition could commit.", ["COMPARE_OPTIONS", "STAGE_PLAN"]);
}

function planConflict<T>(): RecoveryResult<T> {
  return recoveryFailure(RecoveryErrorCodes.planMismatch, "The fresh authoritative plan does not match the active recovery plan.", ["COMPARE_OPTIONS", "CONTACT_OPERATOR"]);
}

function isFingerprint(value: unknown): value is `sha256:${string}` {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
}

function repositoryCall(operation: () => RecoveryResult<OperationalRecoverySnapshot>): RecoveryResult<OperationalRecoverySnapshot> {
  let result: unknown;
  try {
    result = operation();
  } catch {
    return repositoryFailure(false);
  }
  const normalized = normalizeRecoverySnapshotResult(result);
  if (normalized === false) return repositoryFailure(true);
  return normalized.ok ? recoverySuccess(detachedOperationalSnapshot(normalized.data)) : normalized;
}

async function repositoryCallAsync(operation: () => Promise<RecoveryResult<OperationalRecoverySnapshot>>): Promise<RecoveryResult<OperationalRecoverySnapshot>> {
  let result: unknown;
  try {
    result = await operation();
  } catch {
    return repositoryFailure(false);
  }
  const normalized = normalizeRecoverySnapshotResult(result);
  if (normalized === false) return repositoryFailure(true);
  return normalized.ok ? recoverySuccess(detachedOperationalSnapshot(normalized.data)) : normalized;
}

function detachedComparison(data: Unit211PreDispatchData): RecoveryResult<Unit211PreDispatchData> {
  try {
    return recoverySuccess(structuredClone(data));
  } catch {
    return comparisonUnavailable();
  }
}

function compare(readComparison: ComparisonReader): RecoveryResult<Unit211PreDispatchData> {
  let result: Unit211PreDispatchContextResult;
  try {
    result = readComparison();
  } catch {
    return comparisonUnavailable();
  }
  if (!isRecord(result) || result.ok !== true || !isRecord(result.data) || !Array.isArray(result.data.options) || result.data.options.length !== 2) return comparisonUnavailable();
  return detachedComparison(result.data);
}

function clearanceResult(value: unknown): RecoveryClearanceResult {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return { status: "UNKNOWN", reasonCode: "CLEARANCE_EVIDENCE_INVALID", clearanceBufferMeters: 0.2, minimumClearanceMeters: null };
  }
  return value >= 0.2
    ? { status: "PASS", reasonCode: "MINIMUM_CLEARANCE_SATISFIED", clearanceBufferMeters: 0.2, minimumClearanceMeters: value }
    : { status: "FAIL", reasonCode: "MINIMUM_CLEARANCE_VIOLATION", clearanceBufferMeters: 0.2, minimumClearanceMeters: value };
}

function avoidanceResult(avoidsExclusionZone: unknown, avoidsRiskId: unknown): RecoveryAvoidanceResult {
  if (typeof avoidsExclusionZone !== "boolean" || typeof avoidsRiskId !== "string" || avoidsRiskId.trim().length === 0) {
    return { status: "UNKNOWN", reasonCode: "AVOIDANCE_EVIDENCE_INVALID", avoidsExclusionZone: null, avoidsRiskId: "" };
  }
  return avoidsExclusionZone
    ? { status: "PASS", reasonCode: "EXCLUSION_ZONE_AVOIDED", avoidsExclusionZone: true, avoidsRiskId }
    : { status: "FAIL", reasonCode: "EXCLUSION_ZONE_NOT_AVOIDED", avoidsExclusionZone: false, avoidsRiskId };
}

function metrics(summary: unknown, temporal: unknown): RecoveryRouteMetrics | false {
  if (!isRecord(summary) || typeof summary.distanceMeters !== "number" || !Number.isFinite(summary.distanceMeters) || summary.distanceMeters <= 0
    || typeof summary.durationSeconds !== "number" || !Number.isFinite(summary.durationSeconds) || summary.durationSeconds <= 0
    || !isRecord(temporal)) return false;
  const remainingRouteMinutes = temporal.remainingRouteMinutes;
  const estimatedCompletionAt = temporal.estimatedCompletionAt;
  if ((remainingRouteMinutes !== null && (typeof remainingRouteMinutes !== "number" || !Number.isFinite(remainingRouteMinutes) || remainingRouteMinutes <= 0))
    || (estimatedCompletionAt !== null && typeof estimatedCompletionAt !== "string")) return false;
  return { distanceMeters: summary.distanceMeters, durationSeconds: summary.durationSeconds, remainingRouteMinutes, estimatedCompletionAt };
}

function evidenceStatus(value: unknown): "PASS" | "FAIL" | "UNKNOWN" {
  return isRecord(value) && (value.status === "PASS" || value.status === "FAIL" || value.status === "UNKNOWN") ? value.status : "UNKNOWN";
}

function isTemporalPass(value: unknown): boolean {
  return isRecord(value)
    && value.status === "PASS"
    && value.reasonCode === "TEMPORAL_WINDOW_SATISFIED"
    && typeof value.remainingRouteMinutes === "number"
    && Number.isFinite(value.remainingRouteMinutes)
    && value.remainingRouteMinutes > 0
    && typeof value.remainingDriveMinutes === "number"
    && Number.isFinite(value.remainingDriveMinutes)
    && value.remainingDriveMinutes >= value.remainingRouteMinutes
    && typeof value.estimatedCompletionAt === "string"
    && typeof value.restDeadline === "string";
}

function isCargoFacts(value: unknown): boolean {
  return isRecord(value)
    && typeof value.vehicleId === "string"
    && value.vehicleId.length > 0
    && typeof value.cargoId === "string"
    && value.cargoId.length > 0
    && typeof value.destinationId === "string"
    && value.destinationId.length > 0
    && (value.refrigeration === "ambient" || value.refrigeration === "chilled" || value.refrigeration === "frozen")
    && (value.priority === "standard" || value.priority === "priority" || value.priority === "critical");
}

function isCargoPass(value: unknown): boolean {
  return isRecord(value)
    && value.status === "PASS"
    && value.reasonCode === "CARGO_CONTINUITY_SATISFIED"
    && isCargoFacts(value.referenceFacts)
    && isCargoFacts(value.optionFacts);
}

function isCurrentClearanceRejection(value: unknown): boolean {
  return isRecord(value)
    && value.ok === true
    && isRecord(value.data)
    && value.data.vehicleId === "vehicle-011"
    && value.data.riskId === "restriction-height-3.9"
    && value.data.routeId === "route-011"
    && value.data.vehicleHeightMeters === 3.8
    && value.data.clearanceBufferMeters === 0.2
    && value.data.requiredClearanceMeters === 4
    && value.data.restrictionLimitMeters === 3.9
    && value.data.status === "FAIL"
    && value.data.reasonCode === "CLEARANCE_VIOLATION";
}

function planPayload(data: Unit211PreDispatchData, revision: number, selectedOptionId: string): RecoveryResult<RecoveryPlanPayload> {
  try {
    const current = data.options[0];
    const proposed = data.options[1];
    if (selectedOptionId !== "alternative-route-011-clearance-v1" || current.kind !== "CURRENT" || proposed.kind !== "ALTERNATIVE" || selectedOptionId !== proposed.alternativeRouteId) {
      return recoveryFailure(RecoveryErrorCodes.optionNotAdmitted, "Only the admitted viable alternative option can be staged.", ["COMPARE_OPTIONS", "SELECT_ADMITTED_OPTION"]);
    }
    if (data.context.unit.vehicleId !== "vehicle-011"
      || data.context.currentRouteId !== "route-011"
      || data.incident.id !== "incident-route-011-restriction-height-3.9"
      || proposed.relation.vehicleId !== "vehicle-011"
      || proposed.relation.currentRouteId !== "route-011"
      || proposed.relation.avoidsRiskId !== "restriction-height-3.9"
      || proposed.relation.alternativeRouteId !== selectedOptionId
      || !isCurrentClearanceRejection(current.clearanceAssessment)) return comparisonUnavailable();
    const proposedClearance = clearanceResult(proposed.provenance.avoidance.minimumClearanceMeters);
    const proposedAvoidance = avoidanceResult(proposed.avoidsExclusionZone, proposed.relation.avoidsRiskId);
    const statuses = [proposedClearance.status, proposedAvoidance.status, evidenceStatus(proposed.temporalAssessment), evidenceStatus(proposed.cargoContinuityAssessment)];
    if (statuses.includes("UNKNOWN")) {
      return recoveryFailure(RecoveryErrorCodes.safetyEvidenceUnknown, "The proposed option has unknown hard-constraint evidence.", ["COMPARE_OPTIONS", "CONTACT_OPERATOR"]);
    }
    if (statuses.includes("FAIL")) {
      return recoveryFailure(RecoveryErrorCodes.safetyEvidenceFailed, "The proposed option fails a hard recovery constraint.", ["COMPARE_OPTIONS", "SELECT_ADMITTED_OPTION"]);
    }
    if (!isTemporalPass(proposed.temporalAssessment) || !isCargoPass(proposed.cargoContinuityAssessment)) {
      return recoveryFailure(RecoveryErrorCodes.safetyEvidenceUnknown, "The proposed option has malformed hard-constraint evidence.", ["COMPARE_OPTIONS", "CONTACT_OPERATOR"]);
    }
    const currentMetrics = metrics(current.summary, current.temporalAssessment);
    const proposedMetrics = metrics(proposed.summary, proposed.temporalAssessment);
    if (currentMetrics === false || proposedMetrics === false || !isFingerprint(`sha256:${proposed.provenance.sourceRevision}`)) return comparisonUnavailable();
    const constraintResults: RecoveryConstraintResults = {
      currentClearance: structuredClone(current.clearanceAssessment),
      proposedClearance,
      proposedAvoidance,
      proposedTemporal: structuredClone(proposed.temporalAssessment),
      proposedCargoContinuity: structuredClone(proposed.cargoContinuityAssessment),
    };
    return recoverySuccess({
      planId: `recovery-plan:vehicle-011:revision-${revision}:${selectedOptionId}`,
      basedOnScenarioRevision: revision,
      selectedOptionId,
      vehicleId: data.context.unit.vehicleId,
      incidentId: data.incident.id,
      currentRouteId: data.context.currentRouteId,
      proposedRouteId: proposed.alternativeRouteId,
      hardConstraints: { clearanceBufferMeters: 0.2, protectRestDeadline: true, keepCargoAssignment: true, requireExclusionZoneAvoidance: true },
      constraintResults,
      metrics: { current: currentMetrics, proposed: proposedMetrics },
      createdAt: data.context.scenarioClock.instant,
      admittedRouteSourceRevision: proposed.provenance.sourceRevision,
    });
  } catch {
    return comparisonUnavailable();
  }
}

function activeExistingPlan(snapshot: OperationalRecoverySnapshot, selectedOptionId: string): RecoveryPlan | false {
  return snapshot.plan !== null
    && snapshot.plan.selectedOptionId === selectedOptionId
    && snapshot.plan.basedOnScenarioRevision === snapshot.scenarioRevision
    && (snapshot.workflowStatus === RecoveryWorkflowStatuses.staged || snapshot.workflowStatus === RecoveryWorkflowStatuses.reviewRequested || snapshot.workflowStatus === RecoveryWorkflowStatuses.approved)
    ? snapshot.plan
    : false;
}

export function createRecoveryAgentCapability(repository: OperationalRecoveryRepository, readComparison: ComparisonReader, cryptoCapability?: Sha256Crypto | null): RecoveryAgentCapability {
  return {
    compareOptions: () => compare(readComparison),
    stagePlan: async (input: unknown): Promise<RecoveryResult<RecoveryPlan>> => {
      const selectedOptionId = exactStringInput(input, "selectedOptionId");
      if (selectedOptionId === false) return invalidInput("selectedOptionId");
      const captured = repositoryCall(repository.operationalRead);
      if (!captured.ok) return captured;
      const comparison = compare(readComparison);
      if (!comparison.ok) return comparison;
      const payload = planPayload(comparison.data, captured.data.scenarioRevision, selectedOptionId);
      if (!payload.ok) return payload;
      const existingPlan = activeExistingPlan(captured.data, selectedOptionId);
      if (existingPlan !== false) {
        const existingPayload = payloadFromRecoveryPlan(existingPlan);
        if (existingPayload === false) return repositoryFailure(true);
        if (!recoveryPlanPayloadsEqual(payload.data, existingPayload)) return planConflict();
        const confirmed = repositoryCall(repository.operationalRead);
        if (!confirmed.ok) return confirmed;
        if (confirmed.data.scenarioRevision !== captured.data.scenarioRevision) return revisionMismatch();
        const confirmedPlan = activeExistingPlan(confirmed.data, selectedOptionId);
        return confirmedPlan !== false && recoveryPlansEqual(existingPlan, confirmedPlan) ? recoverySuccess(confirmedPlan) : planConflict();
      }
      const fingerprint = await sha256Fingerprint(payload.data, cryptoCapability);
      if (!fingerprint.ok) return fingerprint;
      const plan: RecoveryPlan = { ...payload.data, fingerprint: fingerprint.data };
      const committed = await repositoryCallAsync(() => repository.operationalStage({ expectedScenarioRevision: captured.data.scenarioRevision, plan }));
      if (!committed.ok) return committed;
      return committed.data.plan !== null && recoveryPlansEqual(committed.data.plan, plan)
        ? recoverySuccess(committed.data.plan)
        : repositoryFailure(true);
    },
    requestReview: (input: unknown): RecoveryResult<OperationalRecoverySnapshot> => {
      const planId = exactStringInput(input, "planId");
      if (planId === false) return invalidInput("planId");
      const captured = repositoryCall(repository.operationalRead);
      return captured.ok ? repositoryCall(() => repository.operationalRequestReview({ expectedScenarioRevision: captured.data.scenarioRevision, planId })) : captured;
    },
    planStatus: (): RecoveryResult<OperationalRecoverySnapshot> => repositoryCall(repository.operationalRead),
  };
}

export function createRecoveryHumanCapability(repository: OperationalRecoveryRepository): RecoveryHumanCapability {
  return {
    approvePlan: (input: unknown): RecoveryResult<ApprovalGrant> => {
      const planId = exactStringInput(input, "planId");
      if (planId === false) return invalidInput("planId");
      const captured = repositoryCall(repository.operationalRead);
      if (!captured.ok) return captured;
      const approved = repositoryCall(() => repository.operationalApprove({ expectedScenarioRevision: captured.data.scenarioRevision, planId }));
      return approved.ok && approved.data.approvalGrant !== null ? recoverySuccess(approved.data.approvalGrant) : approved.ok ? repositoryFailure(true) : approved;
    },
    rejectPlan: (input: unknown): RecoveryResult<OperationalRecoverySnapshot> => {
      const planId = exactStringInput(input, "planId");
      if (planId === false) return invalidInput("planId");
      const captured = repositoryCall(repository.operationalRead);
      return captured.ok ? repositoryCall(() => repository.operationalReject({ expectedScenarioRevision: captured.data.scenarioRevision, planId })) : captured;
    },
  };
}

export type RecoveryCapabilityFactoryOptions = Readonly<{ cryptoCapability?: Sha256Crypto | null }>;
export type RecoveryStageInput = PlanInput;
export type RecoveryPlanIdInput = PlanIdInput;
export type RecoveryRepositoryErrorCode = RecoveryErrorCode;
