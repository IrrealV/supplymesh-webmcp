import { describe, expect, it } from "vitest";
import { createRecoveryApplication } from "../../app/createApplication";
import type { RecoveryResult } from "../../domain/recovery/recoveryContracts";
import { createRecoveryTools } from "./registerRecoveryTools";
import type { WebMcpTool } from "./webMcpTypes";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  public getItem(key: string): string | null { return this.values.get(key) ?? null; }
  public setItem(key: string, value: string): void { this.values.set(key, value); }
}

function success<T>(result: RecoveryResult<T>): T {
  if (!result.ok) throw new Error(`Expected success, received ${result.error.code}.`);
  return result.data;
}

function names(app: ReturnType<typeof createRecoveryApplication>): string[] {
  return createRecoveryTools(success(app.recoveryAgent.planStatus()), { operations: app.operations, recoveryAgent: app.recoveryAgent, recoveryExecution: app.recoveryExecution }).map(({ name }) => name);
}

function tool(app: ReturnType<typeof createRecoveryApplication>, name: string): WebMcpTool {
  const found = createRecoveryTools(success(app.recoveryAgent.planStatus()), { operations: app.operations, recoveryAgent: app.recoveryAgent, recoveryExecution: app.recoveryExecution }).find((candidate) => candidate.name === name);
  if (found === undefined) throw new Error(`Missing recovery tool ${name}.`);
  return found;
}

async function toolResult(tool: WebMcpTool, input: unknown): Promise<unknown> {
  const response = await tool.execute(input);
  return JSON.parse(response.content[0].text) as unknown;
}

describe("recovery WebMCP tools", () => {
  it("should expose the exact state-scoped recovery tool sets with zero approval authority", async () => {
    const app = createRecoveryApplication({ storage: new MemoryStorage() });
    expect(names(app)).toStrictEqual(["recovery_operations_context", "recovery_options_compare", "recovery_plan_stage"]);
    const plan = success(await app.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" }));
    expect(names(app)).toStrictEqual(["recovery_operations_context", "recovery_plan_status", "recovery_plan_request_review", "recovery_reset"]);
    success(app.recoveryAgent.requestReview({ planId: plan.planId }));
    expect(names(app)).toStrictEqual(["recovery_operations_context", "recovery_plan_status", "recovery_reset"]);
    success(app.recoveryHuman.approvePlan({ planId: plan.planId }));
    expect(names(app)).toStrictEqual(["recovery_operations_context", "recovery_plan_status", "recovery_plan_execute", "recovery_reset"]);
    success(await app.recoveryExecution.executeApprovedPlan({ planId: plan.planId }));
    expect(names(app)).toStrictEqual(["recovery_operations_context", "recovery_plan_status", "recovery_verify", "recovery_reset"]);
    success(await app.recoveryExecution.verifyExecution({ planId: plan.planId }));
    expect(names(app)).toStrictEqual(["recovery_operations_context", "recovery_plan_status", "recovery_receipt_get", "recovery_reset"]);

    const rejected = createRecoveryApplication({ storage: new MemoryStorage() });
    const rejectedPlan = success(await rejected.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" }));
    success(rejected.recoveryHuman.rejectPlan({ planId: rejectedPlan.planId }));
    expect(names(rejected)).toStrictEqual(["recovery_operations_context", "recovery_options_compare", "recovery_plan_stage", "recovery_plan_status", "recovery_reset"]);

    const invalidated = createRecoveryApplication({ storage: new MemoryStorage() });
    const invalidatedPlan = success(await invalidated.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" }));
    expect(invalidated.operations.vehicleDelete("vehicle-001").ok).toBe(true);
    expect(names(invalidated)).toStrictEqual(["recovery_operations_context", "recovery_options_compare", "recovery_plan_stage", "recovery_plan_status", "recovery_reset"]);
    expect(invalidatedPlan.planId).not.toBe("");

    const allNames = [...names(app), ...names(rejected), ...names(invalidated)];
    expect(allNames.some((name) => /approve|reject/i.test(name))).toBe(false);
  }, 15_000);

  it("should independently guard a stale execute tool after rejection", async () => {
    const app = createRecoveryApplication({ storage: new MemoryStorage() });
    const plan = success(await app.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" }));
    success(app.recoveryAgent.requestReview({ planId: plan.planId }));
    success(app.recoveryHuman.approvePlan({ planId: plan.planId }));
    const execute = createRecoveryTools(success(app.recoveryAgent.planStatus()), { operations: app.operations, recoveryAgent: app.recoveryAgent, recoveryExecution: app.recoveryExecution }).find(({ name }) => name === "recovery_plan_execute");
    if (execute === undefined) throw new Error("Execute tool was not created.");
    success(app.recoveryHuman.rejectPlan({ planId: plan.planId }));

    const result = await toolResult(execute, { planId: plan.planId });

    expect(result).toMatchObject({ ok: false, error: { code: "INVALID_WORKFLOW_STATE" } });
    expect(success(app.recoveryAgent.planStatus()).workflowStatus).toBe("REJECTED");
  });

  it("should enforce exact input schemas and redact asynchronous failures", async () => {
    const app = createRecoveryApplication({ storage: new MemoryStorage() });
    const tools = createRecoveryTools(success(app.recoveryAgent.planStatus()), { operations: app.operations, recoveryAgent: app.recoveryAgent, recoveryExecution: app.recoveryExecution });
    const context = tools.find(({ name }) => name === "recovery_operations_context");
    const stage = tools.find(({ name }) => name === "recovery_plan_stage");
    if (context === undefined || stage === undefined) throw new Error("Initial recovery tools were not created.");

    expect(await toolResult(context, { extra: true })).toMatchObject({ ok: false, error: { code: "INVALID_INPUT" } });
    expect(await toolResult(stage, { selectedOptionId: "alternative-route-011-clearance-v1", fingerprint: "attacker" })).toMatchObject({ ok: false, error: { code: "INVALID_INPUT" } });
  });

  it("should project a concise natural agent handoff without exposing approval authority", async () => {
    const app = createRecoveryApplication({ storage: new MemoryStorage() });
    const compareTool = tool(app, "recovery_options_compare");
    expect(compareTool.description).toContain("recommendedOptionId");
    const comparison = await toolResult(compareTool, {}) as { ok: true; data: { recommendedOptionId: string; nextAction: string } };
    expect(comparison.data).toMatchObject({ recommendedOptionId: "alternative-route-011-clearance-v1", nextAction: "recovery_plan_stage" });

    const staged = await toolResult(tool(app, "recovery_plan_stage"), { selectedOptionId: comparison.data.recommendedOptionId }) as { ok: true; data: { planId: string; nextAction: string } };
    expect(staged.data).toMatchObject({ nextAction: "recovery_plan_request_review" });
    const requested = await toolResult(tool(app, "recovery_plan_request_review"), { planId: staged.data.planId }) as { ok: true; data: Record<string, unknown> };
    expect(requested.data).toMatchObject({
      workflowStatus: "REVIEW_REQUESTED",
      requiredHumanAction: "Approve or reject from the visible SupplyMesh interface.",
      agentCanApprove: false,
      nextAction: "wait_for_human_review",
    });
    expect(names(app).some((name) => /approve|reject/i.test(name))).toBe(false);

    success(app.recoveryHuman.approvePlan({ planId: staged.data.planId }));
    const approved = await toolResult(tool(app, "recovery_plan_status"), {}) as { ok: true; data: Record<string, unknown> };
    expect(approved.data).toMatchObject({ workflowStatus: "APPROVED", nextAction: "recovery_plan_execute" });
    const executed = await toolResult(tool(app, "recovery_plan_execute"), { planId: staged.data.planId }) as { ok: true; data: Record<string, unknown> };
    expect(executed.data).toMatchObject({ nextAction: "recovery_verify" });
    const verified = await toolResult(tool(app, "recovery_verify"), { planId: staged.data.planId }) as { ok: true; data: Record<string, unknown> };
    expect(verified.data).toMatchObject({ nextAction: "recovery_receipt_get" });
    const receipt = await toolResult(tool(app, "recovery_receipt_get"), { planId: staged.data.planId }) as { ok: true; data: Record<string, unknown> };
    expect(receipt.data).toMatchObject({ nextAction: null });
  });
});
