import { canonicalJson } from "./canonicalJson";
import { deepDetachAndFreeze } from "../deepDetach";
import {
  RecoveryErrorCodes,
  RecoveryVerificationCheckNames,
  RecoveryWorkflowStatuses,
  type ApprovalGrant,
  type OperationalRecoverySnapshot,
  type RecoveryExecutionEffect,
  type RecoveryExecutionRecord,
  type RecoveryReceipt,
  type RecoveryVerificationReport,
  type RecoveryAction,
  type RecoveryPlan,
  type RecoveryPlanPayload,
  type RecoveryResult,
} from "./recoveryContracts";

const planPayloadKeys = ["planId", "basedOnScenarioRevision", "selectedOptionId", "vehicleId", "incidentId", "currentRouteId", "proposedRouteId", "hardConstraints", "constraintResults", "metrics", "createdAt", "admittedRouteSourceRevision", "admittedRouteDigest"] as const;
const recoveryActionSet = new Set<string>(["COMPARE_OPTIONS", "SELECT_ADMITTED_OPTION", "STAGE_PLAN", "REQUEST_REVIEW", "EXECUTE_PLAN", "VERIFY_EXECUTION", "GET_RECEIPT", "RESET", "RETRY", "CONTACT_OPERATOR"] satisfies readonly RecoveryAction[]);
const recoveryErrorCodeSet = new Set<string>(Object.values(RecoveryErrorCodes));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  let ownKeys: (string | symbol)[];
  try {
    ownKeys = Reflect.ownKeys(value);
  } catch {
    return false;
  }
  return ownKeys.length === keys.length && ownKeys.every((key) => typeof key === "string" && keys.includes(key));
}

function isCurrentClearance(value: unknown): boolean {
  if (!hasExactKeys(value, ["ok", "data"]) || value.ok !== true || !hasExactKeys(value.data, ["vehicleId", "riskId", "routeId", "vehicleHeightMeters", "clearanceBufferMeters", "requiredClearanceMeters", "restrictionLimitMeters", "status", "reasonCode"])) return false;
  const data = value.data;
  return data.vehicleId === "vehicle-011"
    && data.riskId === "restriction-height-3.9"
    && data.routeId === "route-011"
    && data.vehicleHeightMeters === 3.8
    && data.clearanceBufferMeters === 0.2
    && data.requiredClearanceMeters === 4
    && data.restrictionLimitMeters === 3.9
    && data.status === "FAIL"
    && data.reasonCode === "CLEARANCE_VIOLATION";
}

function isProposedClearance(value: unknown): boolean {
  return hasExactKeys(value, ["status", "reasonCode", "clearanceBufferMeters", "minimumClearanceMeters"])
    && value.status === "PASS"
    && value.reasonCode === "MINIMUM_CLEARANCE_SATISFIED"
    && value.clearanceBufferMeters === 0.2
    && value.minimumClearanceMeters === 5724.858608188861;
}

function isProposedAvoidance(value: unknown): boolean {
  return hasExactKeys(value, ["status", "reasonCode", "avoidsExclusionZone", "avoidsRiskId"])
    && value.status === "PASS"
    && value.reasonCode === "EXCLUSION_ZONE_AVOIDED"
    && value.avoidsExclusionZone === true
    && value.avoidsRiskId === "restriction-height-3.9";
}

function isProposedTemporal(value: unknown): boolean {
  return hasExactKeys(value, ["remainingRouteMinutes", "remainingDriveMinutes", "estimatedCompletionAt", "restDeadline", "status", "reasonCode"])
    && value.remainingRouteMinutes === 88.04166666666667
    && value.remainingDriveMinutes === 235
    && value.estimatedCompletionAt === "2026-08-28T10:28:02.500Z"
    && value.restDeadline === "2026-08-28T16:00:00Z"
    && value.status === "PASS"
    && value.reasonCode === "TEMPORAL_WINDOW_SATISFIED";
}

function isCargoFacts(value: unknown): boolean {
  return hasExactKeys(value, ["vehicleId", "cargoId", "destinationId", "refrigeration", "priority"])
    && value.vehicleId === "vehicle-011"
    && value.cargoId === "cargo-011"
    && value.destinationId === "alcobendas"
    && value.refrigeration === "ambient"
    && value.priority === "standard";
}

function isProposedCargo(value: unknown): boolean {
  return hasExactKeys(value, ["status", "reasonCode", "referenceFacts", "optionFacts"])
    && value.status === "PASS"
    && value.reasonCode === "CARGO_CONTINUITY_SATISFIED"
    && isCargoFacts(value.referenceFacts)
    && isCargoFacts(value.optionFacts);
}

function isConstraintResults(value: unknown): boolean {
  return hasExactKeys(value, ["currentClearance", "proposedClearance", "proposedAvoidance", "proposedTemporal", "proposedCargoContinuity"])
    && isCurrentClearance(value.currentClearance)
    && isProposedClearance(value.proposedClearance)
    && isProposedAvoidance(value.proposedAvoidance)
    && isProposedTemporal(value.proposedTemporal)
    && isProposedCargo(value.proposedCargoContinuity);
}

function isHardConstraints(value: unknown): boolean {
  return hasExactKeys(value, ["clearanceBufferMeters", "protectRestDeadline", "keepCargoAssignment", "requireExclusionZoneAvoidance"])
    && value.clearanceBufferMeters === 0.2
    && value.protectRestDeadline === true
    && value.keepCargoAssignment === true
    && value.requireExclusionZoneAvoidance === true;
}

function isRouteMetrics(value: unknown, kind: "current" | "proposed"): boolean {
  if (!hasExactKeys(value, ["distanceMeters", "durationSeconds", "remainingRouteMinutes", "estimatedCompletionAt"])) return false;
  return kind === "current"
    ? value.distanceMeters === 99706.6 && value.durationSeconds === 5292.1 && value.remainingRouteMinutes === 88.20166666666667 && value.estimatedCompletionAt === "2026-08-28T10:28:12.100Z"
    : value.distanceMeters === 80298.9 && value.durationSeconds === 5282.5 && value.remainingRouteMinutes === 88.04166666666667 && value.estimatedCompletionAt === "2026-08-28T10:28:02.500Z";
}

function isMetrics(value: unknown): boolean {
  return hasExactKeys(value, ["current", "proposed"])
    && isRouteMetrics(value.current, "current")
    && isRouteMetrics(value.proposed, "proposed");
}

export function isAuthoritativeRecoveryPlanPayload(value: unknown): value is RecoveryPlanPayload {
  if (!hasExactKeys(value, planPayloadKeys) || !canonicalJson(value).ok || !Number.isSafeInteger(value.basedOnScenarioRevision) || (value.basedOnScenarioRevision as number) <= 0) return false;
  const revision = value.basedOnScenarioRevision as number;
  return value.planId === `recovery-plan:vehicle-011:revision-${revision}:alternative-route-011-clearance-v1`
    && value.selectedOptionId === "alternative-route-011-clearance-v1"
    && value.vehicleId === "vehicle-011"
    && value.incidentId === "incident-route-011-restriction-height-3.9"
    && value.currentRouteId === "route-011"
    && value.proposedRouteId === "alternative-route-011-clearance-v1"
    && isHardConstraints(value.hardConstraints)
    && isConstraintResults(value.constraintResults)
    && isMetrics(value.metrics)
    && value.createdAt === "2026-08-28T09:00:00.000Z"
    && value.admittedRouteSourceRevision === "688161cb725d59117a55243b78e41b8191e5b0d718f7eff0c51fe783e680fdd0"
    && typeof value.admittedRouteDigest === "string"
    && /^sha256:[a-f0-9]{64}$/.test(value.admittedRouteDigest);
}

export function isAuthoritativeRecoveryPlan(value: unknown): value is RecoveryPlan {
  if (!hasExactKeys(value, [...planPayloadKeys, "fingerprint"]) || typeof value.fingerprint !== "string" || !/^sha256:[a-f0-9]{64}$/.test(value.fingerprint)) return false;
  const { fingerprint, ...payload } = value;
  void fingerprint;
  return isAuthoritativeRecoveryPlanPayload(payload);
}

function canonicalValue(value: unknown): string | false {
  const result = canonicalJson(value);
  return result.ok ? result.data : false;
}

export type ValidatedRecoveryPlan = Readonly<{ plan: RecoveryPlan; payload: RecoveryPlanPayload; canonicalPlan: string; canonicalPayload: string }>;

export function validateAndNormalizeRecoveryPlan(value: unknown): ValidatedRecoveryPlan | false {
  const canonicalPlan = canonicalValue(value);
  if (canonicalPlan === false) return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(canonicalPlan) as unknown;
  } catch {
    return false;
  }
  if (!isAuthoritativeRecoveryPlan(parsed)) return false;
  const { fingerprint, ...payload } = parsed;
  void fingerprint;
  if (!isAuthoritativeRecoveryPlanPayload(payload)) return false;
  const canonicalPayload = canonicalValue(payload);
  return canonicalPayload === false ? false : { plan: parsed, payload, canonicalPlan, canonicalPayload };
}

export function payloadFromRecoveryPlan(value: unknown): RecoveryPlanPayload | false {
  const validated = validateAndNormalizeRecoveryPlan(value);
  return validated === false ? false : validated.payload;
}

export function recoveryPlansEqual(left: unknown, right: unknown): boolean {
  const leftValidated = validateAndNormalizeRecoveryPlan(left);
  const rightValidated = validateAndNormalizeRecoveryPlan(right);
  return leftValidated !== false && rightValidated !== false && leftValidated.canonicalPlan === rightValidated.canonicalPlan;
}

export function recoveryPlanPayloadsEqual(left: unknown, right: unknown): boolean {
  if (!isAuthoritativeRecoveryPlanPayload(left) || !isAuthoritativeRecoveryPlanPayload(right)) return false;
  const leftCanonical = canonicalValue(left);
  return leftCanonical !== false && leftCanonical === canonicalValue(right);
}

function isIncident(value: unknown, status: "OPEN" | "RESOLVED"): boolean {
  return hasExactKeys(value, ["id", "vehicleId", "riskId", "routeId", "status"])
    && value.id === "incident-route-011-restriction-height-3.9"
    && value.vehicleId === "vehicle-011"
    && value.riskId === "restriction-height-3.9"
    && value.routeId === "route-011"
    && value.status === status;
}

function isApprovalGrant(value: unknown, plan: RecoveryPlan, scenarioRevision: number, used: boolean): value is ApprovalGrant {
  return hasExactKeys(value, ["planId", "fingerprint", "scenarioRevision", "approvedAt", "approvedBy", "used"])
    && value.planId === plan.planId
    && value.fingerprint === plan.fingerprint
    && value.scenarioRevision === scenarioRevision
    && value.approvedAt === plan.createdAt
    && value.approvedBy === "human-ui"
    && value.used === used;
}

function isExecutionRecord(value: unknown, plan: RecoveryPlan, revision: number): value is RecoveryExecutionRecord {
  return hasExactKeys(value, ["executionId", "planId", "fingerprint", "approvalSource", "approvedAt", "beforeRevision", "afterRevision", "previousRouteId", "appliedRouteId", "createdAt"])
    && value.executionId === `recovery-execution:${plan.planId}`
    && value.planId === plan.planId
    && value.fingerprint === plan.fingerprint
    && value.approvalSource === "human-ui"
    && value.approvedAt === plan.createdAt
    && value.beforeRevision === plan.basedOnScenarioRevision
    && value.afterRevision === plan.basedOnScenarioRevision + 1
    && revision >= value.afterRevision
    && value.previousRouteId === "route-011"
    && value.appliedRouteId === "alternative-route-011-clearance-v1"
    && value.createdAt === plan.createdAt;
}

function isExecutionEffect(value: unknown, record: RecoveryExecutionRecord): value is RecoveryExecutionEffect {
  return hasExactKeys(value, ["effectId", "executionId", "planId", "vehicleId", "previousRouteId", "appliedRouteId", "beforeRevision", "afterRevision"])
    && value.effectId === `recovery-effect:${record.executionId}`
    && value.executionId === record.executionId
    && value.planId === record.planId
    && value.vehicleId === "vehicle-011"
    && value.previousRouteId === record.previousRouteId
    && value.appliedRouteId === record.appliedRouteId
    && value.beforeRevision === record.beforeRevision
    && value.afterRevision === record.afterRevision;
}

function isVerificationReport(value: unknown, record: RecoveryExecutionRecord, expectedStatus: "PASS" | "FAIL"): value is RecoveryVerificationReport {
  if (!hasExactKeys(value, ["verificationId", "executionId", "planId", "fingerprint", "status", "checks", "createdAt"])
    || value.verificationId !== `recovery-verification:${record.executionId}`
    || value.executionId !== record.executionId
    || value.planId !== record.planId
    || value.fingerprint !== record.fingerprint
    || value.status !== expectedStatus
    || value.createdAt !== record.createdAt
    || !Array.isArray(value.checks)
    || value.checks.length !== RecoveryVerificationCheckNames.length) return false;
  const checks = value.checks as unknown[];
  const names = new Set<string>();
  for (const check of checks) {
    if (!hasExactKeys(check, ["name", "status"]) || typeof check.name !== "string" || (check.status !== "PASS" && check.status !== "FAIL") || names.has(check.name)) return false;
    names.add(check.name);
  }
  return RecoveryVerificationCheckNames.every((name, index) => names.has(name) && isRecord(checks[index]) && checks[index].name === name) && (expectedStatus === "PASS" ? checks.every((check) => isRecord(check) && check.status === "PASS") : checks.some((check) => isRecord(check) && check.status === "FAIL"));
}

function isReceipt(value: unknown, record: RecoveryExecutionRecord, report: RecoveryVerificationReport): value is RecoveryReceipt {
  return hasExactKeys(value, ["receiptId", "planId", "fingerprint", "approvalSource", "approvedAt", "beforeRevision", "afterRevision", "previousRouteId", "appliedRouteId", "executionId", "verificationReport", "createdAt"])
    && value.receiptId === `recovery-receipt:${record.executionId}`
    && value.planId === record.planId
    && value.fingerprint === record.fingerprint
    && value.approvalSource === record.approvalSource
    && value.approvedAt === record.approvedAt
    && value.beforeRevision === record.beforeRevision
    && value.afterRevision === record.afterRevision
    && value.previousRouteId === record.previousRouteId
    && value.appliedRouteId === record.appliedRouteId
    && value.executionId === record.executionId
    && canonicalValue(value.verificationReport) === canonicalValue(report)
    && value.createdAt === record.createdAt;
}

export function isOperationalRecoverySnapshot(value: unknown): value is OperationalRecoverySnapshot {
  if (!hasExactKeys(value, ["scenarioRevision", "workflowStatus", "incident", "plan", "approvalGrant", "executionRecord", "executionEffects", "verificationReport", "receipt"])
    || !canonicalJson(value).ok
    || !Number.isSafeInteger(value.scenarioRevision)
    || (value.scenarioRevision as number) <= 0) return false;
  const revision = value.scenarioRevision as number;
  const plan = value.plan === null ? null : isAuthoritativeRecoveryPlan(value.plan) ? value.plan : false;
  if (plan === false) return false;
  const hasNoExecution = value.executionRecord === null && Array.isArray(value.executionEffects) && value.executionEffects.length === 0 && value.verificationReport === null && value.receipt === null;
  switch (value.workflowStatus) {
    case RecoveryWorkflowStatuses.idle:
      return isIncident(value.incident, "OPEN") && plan === null && value.approvalGrant === null && hasNoExecution;
    case RecoveryWorkflowStatuses.staged:
    case RecoveryWorkflowStatuses.reviewRequested:
      return isIncident(value.incident, "OPEN") && plan !== null && plan.basedOnScenarioRevision === revision && value.approvalGrant === null && hasNoExecution;
    case RecoveryWorkflowStatuses.approved:
      return isIncident(value.incident, "OPEN") && plan !== null && plan.basedOnScenarioRevision === revision && isApprovalGrant(value.approvalGrant, plan, revision, false) && hasNoExecution;
    case RecoveryWorkflowStatuses.rejected:
      return isIncident(value.incident, "OPEN") && plan !== null && value.approvalGrant === null && plan.basedOnScenarioRevision <= revision && hasNoExecution;
    case RecoveryWorkflowStatuses.invalidated:
      return isIncident(value.incident, "OPEN") && plan !== null && value.approvalGrant === null && plan.basedOnScenarioRevision < revision && hasNoExecution;
    case RecoveryWorkflowStatuses.executed:
    case RecoveryWorkflowStatuses.verificationFailed:
    case RecoveryWorkflowStatuses.verified: {
      if (!isIncident(value.incident, "RESOLVED") || plan === null || !isApprovalGrant(value.approvalGrant, plan, plan.basedOnScenarioRevision, true) || !isExecutionRecord(value.executionRecord, plan, revision) || !Array.isArray(value.executionEffects) || value.executionEffects.length !== 1 || !isExecutionEffect(value.executionEffects[0], value.executionRecord)) return false;
      if (value.workflowStatus === RecoveryWorkflowStatuses.executed) return value.verificationReport === null && value.receipt === null;
      if (value.workflowStatus === RecoveryWorkflowStatuses.verificationFailed) return isVerificationReport(value.verificationReport, value.executionRecord, "FAIL") && value.receipt === null;
      return isVerificationReport(value.verificationReport, value.executionRecord, "PASS") && isReceipt(value.receipt, value.executionRecord, value.verificationReport);
    }
    default:
      return false;
  }
}

export function isRecoveryFailureResult(value: unknown): value is Extract<RecoveryResult<never>, { ok: false }> {
  return hasExactKeys(value, ["ok", "error"])
    && value.ok === false
    && hasExactKeys(value.error, ["code", "message", "actions"])
    && recoveryErrorCodeSet.has(value.error.code as string)
    && typeof value.error.message === "string"
    && value.error.message.length > 0
    && Array.isArray(value.error.actions)
    && canonicalJson(value.error.actions).ok
    && value.error.actions.every((action) => typeof action === "string" && recoveryActionSet.has(action));
}

export function isRecoverySnapshotResult(value: unknown): value is RecoveryResult<OperationalRecoverySnapshot> {
  if (!isRecord(value) || !canonicalJson(value).ok) return false;
  if (!hasExactKeys(value, value.ok === true ? ["ok", "data"] : ["ok", "error"])) return false;
  return value.ok === true ? isOperationalRecoverySnapshot(value.data) : isRecoveryFailureResult(value);
}

export function normalizeRecoverySnapshotResult(value: unknown): RecoveryResult<OperationalRecoverySnapshot> | false {
  const canonical = canonicalValue(value);
  if (canonical === false) return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(canonical) as unknown;
  } catch {
    return false;
  }
  return isRecoverySnapshotResult(parsed) ? parsed : false;
}

export function detachedOperationalSnapshot(value: OperationalRecoverySnapshot): OperationalRecoverySnapshot | false {
  const detached = deepDetachAndFreeze(value);
  return detached.ok ? detached.data : false;
}
