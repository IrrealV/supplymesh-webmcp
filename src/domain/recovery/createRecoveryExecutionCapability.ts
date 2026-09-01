import type { Unit211PreDispatchContextResult } from "../operations/unit211PreDispatchContext";
import type { OperationalRecoveryRepository } from "../ports/OperationalRecoveryRepository";
import { deepDetachAndFreeze } from "../deepDetach";
import { canonicalJson, sha256Fingerprint, type Sha256Crypto } from "./canonicalJson";
import { RecoveryErrorCodes, RecoveryWorkflowStatuses, recoveryFailure, recoverySuccess, type OperationalRecoverySnapshot, type RecoveryExecutionCapability, type RecoveryResult } from "./recoveryContracts";
import { readAdmittedRecoveryRoute, recoveryRouteDigest, recoveryRouteEvidenceFromOption } from "./recoveryRouteAdmission";
import { isOperationalRecoverySnapshot, payloadFromRecoveryPlan } from "./recoveryValidation";

type ComparisonReader = () => Unit211PreDispatchContextResult;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactPlanId(value: unknown): string | false {
  if (!isRecord(value)) return false;
  const keys = Reflect.ownKeys(value);
  const descriptor = Object.getOwnPropertyDescriptor(value, "planId");
  return keys.length === 1 && keys[0] === "planId" && descriptor !== undefined && "value" in descriptor && typeof descriptor.value === "string" && descriptor.value.trim().length > 0 ? descriptor.value : false;
}

function isEmptyInput(value: unknown): boolean {
  return isRecord(value) && Reflect.ownKeys(value).length === 0;
}

function invalidInput<T>(expected: string): RecoveryResult<T> {
  return recoveryFailure(RecoveryErrorCodes.invalidInput, `The input must contain exactly ${expected}.`, ["RETRY"]);
}

function repositoryFailure<T>(): RecoveryResult<T> {
  return recoveryFailure(RecoveryErrorCodes.repositoryFailure, "The operational recovery repository could not complete the request.", ["RETRY", "CONTACT_OPERATOR"]);
}

function malformedRepository<T>(): RecoveryResult<T> {
  return recoveryFailure(RecoveryErrorCodes.malformedRepositoryData, "The operational recovery repository returned malformed data.", ["RETRY", "CONTACT_OPERATOR"]);
}

function planMismatch<T>(): RecoveryResult<T> {
  return recoveryFailure(RecoveryErrorCodes.planMismatch, "The requested plan does not match the active recovery plan.", ["COMPARE_OPTIONS", "CONTACT_OPERATOR"]);
}

function invalidWorkflow<T>(): RecoveryResult<T> {
  return recoveryFailure(RecoveryErrorCodes.invalidWorkflowState, "The recovery workflow is not in a valid state for this transition.", ["CONTACT_OPERATOR"]);
}

function comparisonUnavailable<T>(): RecoveryResult<T> {
  return recoveryFailure(RecoveryErrorCodes.comparisonUnavailable, "The authoritative Unit 211 comparison is unavailable or malformed.", ["RETRY", "CONTACT_OPERATOR"]);
}

function readSnapshot(repository: OperationalRecoveryRepository): RecoveryResult<OperationalRecoverySnapshot> {
  try {
    const result = repository.operationalRead();
    if (!result.ok) return result;
    if (!isOperationalRecoverySnapshot(result.data)) return malformedRepository();
    const detached = deepDetachAndFreeze(result.data);
    return detached.ok ? recoverySuccess(detached.data) : malformedRepository();
  } catch {
    return repositoryFailure();
  }
}

function detachedSuccess<T>(value: T): RecoveryResult<T> {
  const detached = deepDetachAndFreeze(value);
  return detached.ok ? recoverySuccess(detached.data) : malformedRepository();
}

function exact(left: unknown, right: unknown): boolean {
  const leftCanonical = canonicalJson(left);
  const rightCanonical = canonicalJson(right);
  return leftCanonical.ok && rightCanonical.ok && leftCanonical.data === rightCanonical.data;
}

async function validatePlanAndRoute(snapshot: OperationalRecoverySnapshot, readCatalog: () => unknown, cryptoCapability: Sha256Crypto | null | undefined): Promise<RecoveryResult<true>> {
  const plan = snapshot.plan;
  if (plan === null) return planMismatch();
  const payload = payloadFromRecoveryPlan(plan);
  if (payload === false) return malformedRepository();
  const fingerprint = await sha256Fingerprint(payload, cryptoCapability);
  if (!fingerprint.ok) return fingerprint;
  if (fingerprint.data !== plan.fingerprint) return planMismatch();
  const admitted = readAdmittedRecoveryRoute(readCatalog);
  if (!admitted.ok) return admitted;
  const digest = await recoveryRouteDigest(admitted.data, cryptoCapability);
  if (!digest.ok) return digest;
  return digest.data === plan.admittedRouteDigest ? recoverySuccess(true) : planMismatch();
}

export function createRecoveryExecutionCapability(repository: OperationalRecoveryRepository, readComparison: ComparisonReader, readCatalog: () => unknown, cryptoCapability: Sha256Crypto | null | undefined): RecoveryExecutionCapability {
  return {
    executeApprovedPlan: async (input) => {
      const planId = exactPlanId(input);
      if (planId === false) return invalidInput("one non-blank planId");
      const captured = readSnapshot(repository);
      if (!captured.ok) return captured;
      const plan = captured.data.plan;
      if (plan === null || plan.planId !== planId) return planMismatch();
      const isReplay = captured.data.executionRecord !== null;
      if (!isReplay && (captured.data.workflowStatus !== RecoveryWorkflowStatuses.approved || captured.data.approvalGrant?.used !== false)) return invalidWorkflow();
      if (isReplay && captured.data.executionRecord?.planId !== planId) return planMismatch();
      const binding = await validatePlanAndRoute(captured.data, readCatalog, cryptoCapability);
      if (!binding.ok) return binding;
      if (!isReplay) {
        let comparison: Unit211PreDispatchContextResult;
        try { comparison = readComparison(); } catch { return comparisonUnavailable(); }
        if (!comparison.ok) return comparisonUnavailable();
        const comparedEvidence = recoveryRouteEvidenceFromOption(comparison.data.options[1]);
        if (!comparedEvidence.ok) return comparisonUnavailable();
        const comparedDigest = await recoveryRouteDigest(comparedEvidence.data, cryptoCapability);
        if (!comparedDigest.ok) return comparedDigest;
        if (comparedDigest.data !== plan.admittedRouteDigest) return planMismatch();
      }
      try {
        const result = await repository.operationalExecute({ expectedScenarioRevision: captured.data.scenarioRevision, planId });
        if (!result.ok) return result;
        const confirmed = readSnapshot(repository);
        if (!confirmed.ok) return confirmed;
        return confirmed.data.executionRecord !== null && exact(confirmed.data.executionRecord, result.data.execution) ? detachedSuccess(result.data) : malformedRepository();
      } catch {
        return repositoryFailure();
      }
    },
    verifyExecution: async (input) => {
      const planId = exactPlanId(input);
      if (planId === false) return invalidInput("one non-blank planId");
      const captured = readSnapshot(repository);
      if (!captured.ok) return captured;
      if (captured.data.plan?.planId !== planId || captured.data.executionRecord?.planId !== planId) return planMismatch();
      if (captured.data.workflowStatus !== RecoveryWorkflowStatuses.executed && captured.data.workflowStatus !== RecoveryWorkflowStatuses.verificationFailed && captured.data.workflowStatus !== RecoveryWorkflowStatuses.verified) return invalidWorkflow();
      const binding = await validatePlanAndRoute(captured.data, readCatalog, cryptoCapability);
      if (!binding.ok) return binding;
      try {
        const result = await repository.operationalVerify({ expectedScenarioRevision: captured.data.scenarioRevision, planId });
        if (!result.ok) return result;
        const confirmed = readSnapshot(repository);
        if (!confirmed.ok) return confirmed;
        return confirmed.data.verificationReport !== null && exact(confirmed.data.verificationReport, result.data) ? detachedSuccess(result.data) : malformedRepository();
      } catch {
        return repositoryFailure();
      }
    },
    receiptGet: (input) => {
      const planId = exactPlanId(input);
      if (planId === false) return invalidInput("one non-blank planId");
      try {
        const result = repository.operationalReceiptGet({ planId });
        if (!result.ok) return result;
        const confirmed = readSnapshot(repository);
        if (!confirmed.ok) return confirmed;
        return confirmed.data.receipt !== null && exact(confirmed.data.receipt, result.data) ? detachedSuccess(result.data) : malformedRepository();
      } catch { return repositoryFailure(); }
    },
    reset: (input) => {
      if (!isEmptyInput(input)) return invalidInput("an empty object");
      const captured = readSnapshot(repository);
      if (!captured.ok) return captured;
      try {
        const result = repository.operationalReset({ expectedScenarioRevision: captured.data.scenarioRevision });
        return result.ok ? detachedSuccess(result.data) : result;
      } catch { return repositoryFailure(); }
    },
  };
}
