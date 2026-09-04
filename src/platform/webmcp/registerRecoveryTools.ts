import type { OperatingRegion } from "../../domain/entities";
import type { OperationsApi } from "../../domain/operations/createOperationsApi";
import type { Unit211PreDispatchData } from "../../domain/operations/unit211PreDispatchContext";
import { RecoveryWorkflowStatuses, type OperationalRecoverySnapshot, type RecoveryAgentCapability, type RecoveryExecutionCapability, type RecoveryResult, type RecoveryWorkflowStatus } from "../../domain/recovery/recoveryContracts";
import type { JsonSchema, WebMcpTool, WebMcpToolResponse } from "./webMcpTypes";

type ScenarioChangeHandler = (scenario: OperatingRegion) => void;
type Dependencies = Readonly<{ recoveryAgent: RecoveryAgentCapability; recoveryExecution: RecoveryExecutionCapability; operations: OperationsApi; onScenarioChange?: ScenarioChangeHandler }>;

const emptyInputSchema: JsonSchema = { type: "object", properties: {}, additionalProperties: false };
const planIdSchema: JsonSchema = { type: "object", properties: { planId: { type: "string", minLength: 1 } }, required: ["planId"], additionalProperties: false };
const selectedOptionSchema: JsonSchema = { type: "object", properties: { selectedOptionId: { type: "string", minLength: 1 } }, required: ["selectedOptionId"], additionalProperties: false };

function response(value: unknown): WebMcpToolResponse {
  return { content: [{ type: "text", text: JSON.stringify(value) }] };
}

function failed(): WebMcpToolResponse {
  return response({ ok: false, error: { code: "operation-failed", message: "The operation could not be completed." } });
}

function invalid(): WebMcpToolResponse {
  return response({ ok: false, error: { code: "INVALID_INPUT", message: "The tool input is invalid.", actions: ["RETRY"] } });
}

function isEmptyInput(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value) && Reflect.ownKeys(value).length === 0;
}

type Guidance = Readonly<Record<string, unknown>>;

function guided<T extends object>(result: RecoveryResult<T>, guidance: (data: T) => Guidance): RecoveryResult<T & Guidance> {
  return result.ok ? { ...result, data: { ...result.data, ...guidance(result.data) } } : result;
}

function statusGuidance(data: OperationalRecoverySnapshot): Guidance {
  switch (data.workflowStatus) {
    case RecoveryWorkflowStatuses.idle: return { nextAction: "recovery_options_compare" };
    case RecoveryWorkflowStatuses.staged: return { nextAction: "recovery_plan_request_review" };
    case RecoveryWorkflowStatuses.reviewRequested: return { nextAction: "wait_for_human_review", requiredHumanAction: "Approve or reject from the visible SupplyMesh interface.", agentCanApprove: false };
    case RecoveryWorkflowStatuses.approved: return { nextAction: "recovery_plan_execute" };
    case RecoveryWorkflowStatuses.rejected:
    case RecoveryWorkflowStatuses.invalidated: return { nextAction: "recovery_options_compare" };
    case RecoveryWorkflowStatuses.executed:
    case RecoveryWorkflowStatuses.verificationFailed: return { nextAction: "recovery_verify" };
    case RecoveryWorkflowStatuses.verified: return { nextAction: "recovery_receipt_get" };
  }
}

async function execute<T extends object>(operation: () => RecoveryResult<T> | Promise<RecoveryResult<T>>, guidance?: (data: T) => Guidance): Promise<WebMcpToolResponse> {
  try {
    const result = await operation();
    return response(guidance === undefined ? result : guided(result, guidance));
  } catch {
    return failed();
  }
}

function publishScenario(dependencies: Dependencies, result: RecoveryResult<unknown>): void {
  if (!result.ok || dependencies.onScenarioChange === undefined) return;
  try {
    const current = dependencies.operations.scenarioCurrent();
    if (current.ok) {
      dependencies.onScenarioChange(current.data);
    }
  } catch {
    // Optional UI refresh failures never alter tool results.
  }
}

async function executeAndPublish<T extends object>(dependencies: Dependencies, operation: () => RecoveryResult<T> | Promise<RecoveryResult<T>>, guidance?: (data: T) => Guidance): Promise<WebMcpToolResponse> {
  try {
    const result = await operation();
    publishScenario(dependencies, result);
    return response(guidance === undefined ? result : guided(result, guidance));
  } catch {
    return failed();
  }
}

export function recoveryToolNamesForStatus(status: RecoveryWorkflowStatus): readonly string[] {
  const context = "recovery_operations_context";
  const statusTool = "recovery_plan_status";
  const reset = "recovery_reset";
  switch (status) {
    case RecoveryWorkflowStatuses.idle:
      return [context, "recovery_options_compare", "recovery_plan_stage"];
    case RecoveryWorkflowStatuses.staged:
      return [context, statusTool, "recovery_plan_request_review", reset];
    case RecoveryWorkflowStatuses.reviewRequested:
      return [context, statusTool, reset];
    case RecoveryWorkflowStatuses.approved:
      return [context, statusTool, "recovery_plan_execute", reset];
    case RecoveryWorkflowStatuses.rejected:
    case RecoveryWorkflowStatuses.invalidated:
      return [context, "recovery_options_compare", "recovery_plan_stage", statusTool, reset];
    case RecoveryWorkflowStatuses.executed:
      return [context, statusTool, "recovery_verify", reset];
    case RecoveryWorkflowStatuses.verified:
      return [context, statusTool, "recovery_receipt_get", reset];
    case RecoveryWorkflowStatuses.verificationFailed:
      return [context, statusTool, "recovery_verify", reset];
  }
}

export function createRecoveryTools(snapshot: OperationalRecoverySnapshot, dependencies: Dependencies): WebMcpTool[] {
  const comparisonGuidance = (data: Unit211PreDispatchData): Guidance => ({ recommendedOptionId: data.options[1].alternativeRouteId, nextAction: "recovery_plan_stage" });
  const all: Record<string, WebMcpTool> = {
    recovery_operations_context: { name: "recovery_operations_context", description: "Reads the authoritative Unit 211 options, recommendedOptionId, and nextAction without changing state.", inputSchema: emptyInputSchema, execute: (input) => isEmptyInput(input) ? execute(() => dependencies.recoveryAgent.compareOptions(), comparisonGuidance) : invalid() },
    recovery_options_compare: { name: "recovery_options_compare", description: "Compares admitted Unit 211 options and returns recommendedOptionId plus the next agent action.", inputSchema: emptyInputSchema, execute: (input) => isEmptyInput(input) ? execute(() => dependencies.recoveryAgent.compareOptions(), comparisonGuidance) : invalid() },
    recovery_plan_stage: { name: "recovery_plan_stage", description: "Stages the admitted selectedOptionId and returns its authoritative planId for the review request.", inputSchema: selectedOptionSchema, execute: (input) => execute(() => dependencies.recoveryAgent.stagePlan(input), () => ({ nextAction: "recovery_plan_request_review" })) },
    recovery_plan_request_review: { name: "recovery_plan_request_review", description: "Requests visible human review; the agent cannot approve or reject the plan.", inputSchema: planIdSchema, execute: (input) => execute(() => dependencies.recoveryAgent.requestReview(input), statusGuidance) },
    recovery_plan_status: { name: "recovery_plan_status", description: "Reads the authoritative workflowStatus and state-appropriate nextAction.", inputSchema: emptyInputSchema, execute: (input) => isEmptyInput(input) ? execute(() => dependencies.recoveryAgent.planStatus(), statusGuidance) : invalid() },
    recovery_plan_execute: { name: "recovery_plan_execute", description: "Executes an exactly approved plan once, then directs the agent to verification.", inputSchema: planIdSchema, execute: (input) => executeAndPublish(dependencies, () => dependencies.recoveryExecution.executeApprovedPlan(input), () => ({ nextAction: "recovery_verify" })) },
    recovery_verify: { name: "recovery_verify", description: "Verifies authoritative execution evidence and directs a passing result to the receipt.", inputSchema: planIdSchema, execute: (input) => execute(() => dependencies.recoveryExecution.verifyExecution(input), (data) => ({ nextAction: data.status === "PASS" ? "recovery_receipt_get" : "recovery_verify" })) },
    recovery_receipt_get: { name: "recovery_receipt_get", description: "Returns the stable verified recovery receipt and completes the workflow.", inputSchema: planIdSchema, execute: (input) => execute(() => dependencies.recoveryExecution.receiptGet(input), () => ({ nextAction: null })) },
    recovery_reset: { name: "recovery_reset", description: "Resets the deterministic recovery cycle to its operational baseline.", inputSchema: emptyInputSchema, execute: (input) => executeAndPublish(dependencies, () => dependencies.recoveryExecution.reset(input), statusGuidance) },
  };
  return recoveryToolNamesForStatus(snapshot.workflowStatus).map((name) => all[name]);
}
