import type { OperatingRegion } from "../../domain/entities";
import type { OperationsApi } from "../../domain/operations/createOperationsApi";
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

async function execute(operation: () => RecoveryResult<unknown> | Promise<RecoveryResult<unknown>>): Promise<WebMcpToolResponse> {
  try {
    return response(await operation());
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

async function executeAndPublish(dependencies: Dependencies, operation: () => RecoveryResult<unknown> | Promise<RecoveryResult<unknown>>): Promise<WebMcpToolResponse> {
  try {
    const result = await operation();
    publishScenario(dependencies, result);
    return response(result);
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
  const all: Record<string, WebMcpTool> = {
    recovery_operations_context: { name: "recovery_operations_context", description: "Gets the authoritative Unit 211 recovery context.", inputSchema: emptyInputSchema, execute: (input) => isEmptyInput(input) ? execute(() => dependencies.recoveryAgent.compareOptions()) : invalid() },
    recovery_options_compare: { name: "recovery_options_compare", description: "Compares the admitted Unit 211 recovery options.", inputSchema: emptyInputSchema, execute: (input) => isEmptyInput(input) ? execute(() => dependencies.recoveryAgent.compareOptions()) : invalid() },
    recovery_plan_stage: { name: "recovery_plan_stage", description: "Stages the admitted recovery option for human review.", inputSchema: selectedOptionSchema, execute: (input) => execute(() => dependencies.recoveryAgent.stagePlan(input)) },
    recovery_plan_request_review: { name: "recovery_plan_request_review", description: "Requests human review of a staged recovery plan.", inputSchema: planIdSchema, execute: (input) => execute(() => dependencies.recoveryAgent.requestReview(input)) },
    recovery_plan_status: { name: "recovery_plan_status", description: "Gets the current recovery workflow status.", inputSchema: emptyInputSchema, execute: (input) => isEmptyInput(input) ? execute(() => dependencies.recoveryAgent.planStatus()) : invalid() },
    recovery_plan_execute: { name: "recovery_plan_execute", description: "Executes an exactly approved recovery plan.", inputSchema: planIdSchema, execute: (input) => executeAndPublish(dependencies, () => dependencies.recoveryExecution.executeApprovedPlan(input)) },
    recovery_verify: { name: "recovery_verify", description: "Independently verifies an executed recovery plan.", inputSchema: planIdSchema, execute: (input) => execute(() => dependencies.recoveryExecution.verifyExecution(input)) },
    recovery_receipt_get: { name: "recovery_receipt_get", description: "Gets the stable verified recovery receipt.", inputSchema: planIdSchema, execute: (input) => execute(() => dependencies.recoveryExecution.receiptGet(input)) },
    recovery_reset: { name: "recovery_reset", description: "Resets the deterministic recovery cycle to its operational baseline.", inputSchema: emptyInputSchema, execute: (input) => executeAndPublish(dependencies, () => dependencies.recoveryExecution.reset(input)) },
  };
  return recoveryToolNamesForStatus(snapshot.workflowStatus).map((name) => all[name]);
}
