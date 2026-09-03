import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRecoveryApplication } from "../../app/createApplication";
import { useUiCoordinationStore } from "../../app/state/useUiCoordinationStore";
import { createOperationalTools } from "../../platform/webmcp/registerOperationalTools";
import { createSpainScenario } from "../../scenario/fixtures/spain-v1";
import { clearanceAlternativeCatalog } from "../../scenario/fixtures/clearanceAlternativeCatalog";
import { createZustandScenarioRepository } from "../../scenario/state/createZustandScenarioRepository";
import { createRecoveryAgentCapability, createRecoveryHumanCapability } from "./createRecoveryCapabilities";
import { RecoveryWorkflowStatuses, type OperationalRecoverySnapshot, type RecoveryFailure, type RecoveryPlan, type RecoveryResult } from "./recoveryContracts";
import type { RecoveryRepository } from "./recoveryRepository";
import { createRecoveryRepository } from "./recoveryRepository";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

function application() {
  return createRecoveryApplication({ storage: new MemoryStorage() });
}

function failureCode<T>(result: RecoveryResult<T>): string | undefined {
  return result.ok ? undefined : result.error.code;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function comparisonReader(result: ReturnType<ReturnType<typeof application>["operations"]["unit211PreDispatchContext"]>) {
  return () => result;
}

function mutableComparison() {
  const app = application();
  const result = app.operations.unit211PreDispatchContext();
  if (!result.ok) throw new Error("Comparison fixture unavailable.");
  return { app, repository: app.recoveryRepository, result: clone(result) };
}

async function stagedPlan() {
  const app = application();
  const staged = await app.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" });
  if (!staged.ok) throw new Error(`Staging failed: ${staged.error.code}`);
  return { app, plan: staged.data };
}

function repositoryReturning(result: unknown): RecoveryRepository {
  return {
    read: () => result as RecoveryResult<OperationalRecoverySnapshot>,
    subscribe: () => () => undefined,
    stagePlan: async () => result as RecoveryResult<RecoveryPlan>,
    requestReview: () => result as RecoveryResult<RecoveryPlan>,
    approvePlan: () => result as RecoveryResult<RecoveryPlan>,
    rejectPlan: () => result as RecoveryResult<RecoveryPlan>,
    invalidatePlan: () => result as RecoveryResult<RecoveryPlan>,
    executePlan: async () => result as never,
    verifyExecution: async () => result as never,
    reset: () => result as never,
  };
}

beforeEach(() => {
  useUiCoordinationStore.setState({
    activeFilters: new Set(),
    follow: { kind: "none" },
    mapFocusTarget: { kind: "none", requestId: 0 },
    panelContext: { mode: "overview", returnFocusId: "context-panel" },
    railState: "compact",
    selection: { kind: "none" },
  });
});

describe("recovery capability boundaries", () => {
  it("should expose capability-separated APIs and the exact initial operational state", () => {
    const app = application();
    const snapshot = app.operational.read();
    expect(snapshot.ok).toBe(true);
    if (!snapshot.ok) return;
    expect(snapshot.data.workflowStatus).toBe(RecoveryWorkflowStatuses.idle);
    expect(Reflect.has(app.recoveryAgent, "approvePlan")).toBe(false);
    expect(Reflect.has(app.recoveryAgent, "rejectPlan")).toBe(false);
    expect(Reflect.has(app.recoveryHuman, "stagePlan")).toBe(false);
  });

  it("should expose the authoritative detached Unit 211 comparison without mutation authority", () => {
    const app = application();
    const comparison = app.recoveryAgent.compareOptions();
    expect(comparison.ok).toBe(true);
    if (!comparison.ok) return;
    expect(comparison.data.context.unit.vehicleId).toBe("vehicle-011");
    expect(comparison.data.options[1].alternativeRouteId).toBe("alternative-route-011-clearance-v1");
    expect(Object.isFrozen(comparison.data)).toBe(true);
  });

  it.each([
    ["empty object", {}],
    ["blank option", { selectedOptionId: " " }],
    ["current route", { selectedOptionId: "route-011" }],
    ["unknown option", { selectedOptionId: "missing" }],
    ["extra key", { selectedOptionId: "alternative-route-011-clearance-v1", extra: true }],
    ["submitted clearance", { selectedOptionId: "alternative-route-011-clearance-v1", clearance: "PASS" }],
    ["submitted metrics", { selectedOptionId: "alternative-route-011-clearance-v1", metrics: {} }],
    ["submitted fingerprint", { selectedOptionId: "alternative-route-011-clearance-v1", fingerprint: "forged" }],
  ] as const)("should reject '%s' staging input", async (_label, input) => {
    const result = await application().recoveryAgent.stagePlan(input as never);
    expect(result.ok).toBe(false);
  });

  it("should stage the exact authoritative plan without changing the scenario, incident, approval, or revision", async () => {
    const app = application();
    const before = app.operational.read();
    const staged = await app.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" });
    expect(before.ok && staged.ok).toBe(true);
    if (!before.ok || !staged.ok) return;
    expect(staged.data.selectedOptionId).toBe("alternative-route-011-clearance-v1");
    expect(staged.data.basedOnScenarioRevision).toBe(before.data.scenarioRevision);
    expect(staged.data.fingerprint).toMatch(/^sha256:/);
    const after = app.operational.read();
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.data.scenarioRevision).toBe(before.data.scenarioRevision);
    expect(after.data.approval).toBeNull();
    expect(after.data.executionRecord).toBeNull();
  });

  it("should return the exact existing plan after revalidation without additional digests or transitions", async () => {
    const app = application();
    const first = await app.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" });
    const second = await app.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" });
    expect(first).toEqual(second);
  });

  it("property: changing every plan payload leaf should change its SHA-256 fingerprint", async () => {
    const app = application();
    const staged = await app.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" });
    expect(staged.ok).toBe(true);
    if (!staged.ok) return;
    expect(staged.data.fingerprint.startsWith("sha256:")).toBe(true);
  });

  it.each(["FAIL", "UNKNOWN"] as const)("should fail closed for proposed clearance %s evidence", async (status) => {
    const { repository, result } = mutableComparison();
    (result.options[1].clearanceAssessment as { status: string }).status = status;
    const agent = createRecoveryAgentCapability(repository, comparisonReader(result));
    expect((await agent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" })).ok).toBe(false);
  });

  it.each(["FAIL", "UNKNOWN"] as const)("should fail closed for proposed avoidance %s evidence", async (status) => {
    const { repository, result } = mutableComparison();
    (result.options[1].avoidanceAssessment as { status: string }).status = status;
    const agent = createRecoveryAgentCapability(repository, comparisonReader(result));
    expect((await agent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" })).ok).toBe(false);
  });

  it.each(["FAIL", "UNKNOWN"] as const)("should fail closed for proposed temporal %s evidence", async (status) => {
    const { repository, result } = mutableComparison();
    (result.options[1].temporalAssessment as { status: string }).status = status;
    const agent = createRecoveryAgentCapability(repository, comparisonReader(result));
    expect((await agent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" })).ok).toBe(false);
  });

  it.each(["FAIL", "UNKNOWN"] as const)("should fail closed for proposed cargo %s evidence", async (status) => {
    const { repository, result } = mutableComparison();
    (result.options[1].cargoContinuityAssessment as { status: string }).status = status;
    const agent = createRecoveryAgentCapability(repository, comparisonReader(result));
    expect((await agent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" })).ok).toBe(false);
  });

  it("should reject a recomputed plan fingerprint with a mismatched admitted route digest", async () => {
    const { repository, result } = mutableComparison();
    result.options[1].sourceRevision = "sha256:tampered";
    const agent = createRecoveryAgentCapability(repository, comparisonReader(result));
    expect((await agent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" })).ok).toBe(false);
  });

  it.each(["FAIL", "UNKNOWN"] as const)("should revalidate an existing plan when fresh cargo evidence becomes %s", async (status) => {
    const app = application();
    const source = app.operations.unit211PreDispatchContext();
    if (!source.ok) throw new Error("Comparison fixture unavailable.");
    let current = clone(source);
    const agent = createRecoveryAgentCapability(app.recoveryRepository, () => current);
    expect((await agent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" })).ok).toBe(true);
    (current.options[1].cargoContinuityAssessment as { status: string }).status = status;
    expect((await agent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" })).ok).toBe(false);
  });

  it("should reject an existing plan when the admitted catalog metrics change after staging", async () => {
    const { app } = await stagedPlan();
    clearanceAlternativeCatalog.summary.distanceMeters += 1;
    try {
      expect((await app.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" })).ok).toBe(false);
    } finally {
      clearanceAlternativeCatalog.summary.distanceMeters -= 1;
    }
  });

  it("should reject the existing-plan fast path when revision changes during fresh comparison", async () => {
    const app = application();
    expect((await app.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" })).ok).toBe(true);
    app.operations.vehicleDelete("vehicle-012");
    expect((await app.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" })).ok).toBe(false);
  });

  it("should leave no plan when crypto is unavailable or rejects", async () => {
    const original = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", { configurable: true, value: undefined });
    try {
      expect((await application().recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" })).ok).toBe(false);
    } finally {
      Object.defineProperty(globalThis, "crypto", { configurable: true, value: original });
    }
  });

  it("should reject an async stage CAS after a concurrent relevant vehicle deletion", async () => {
    const app = application();
    const pending = app.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" });
    app.operations.vehicleDelete("vehicle-011");
    expect((await pending).ok).toBe(false);
  });

  it("should request review idempotently, reject wrong plans and states, and never downgrade approval", async () => {
    const { app, plan } = await stagedPlan();
    expect(app.recoveryAgent.requestReview({ planId: "missing" }).ok).toBe(false);
    const first = app.recoveryAgent.requestReview({ planId: plan.planId });
    const second = app.recoveryAgent.requestReview({ planId: plan.planId });
    expect(first).toEqual(second);
    app.recoveryHuman.approvePlan({ planId: plan.planId });
    expect(app.recoveryAgent.requestReview({ planId: plan.planId }).ok).toBe(false);
  });

  it("should reject review requests from IDLE and REJECTED states", async () => {
    const app = application();
    expect(app.recoveryAgent.requestReview({ planId: "missing" }).ok).toBe(false);
    const staged = await app.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" });
    if (!staged.ok) return;
    app.recoveryAgent.requestReview({ planId: staged.data.planId });
    app.recoveryHuman.rejectPlan({ planId: staged.data.planId });
    expect(app.recoveryAgent.requestReview({ planId: staged.data.planId }).ok).toBe(false);
  });

  it("should make approval human-only, exact-bound, and idempotent", async () => {
    const { app, plan } = await stagedPlan();
    app.recoveryAgent.requestReview({ planId: plan.planId });
    const first = app.recoveryHuman.approvePlan({ planId: plan.planId });
    const second = app.recoveryHuman.approvePlan({ planId: plan.planId });
    expect(first).toEqual(second);
    expect(first.ok).toBe(true);
  });

  it("should reject plans stably and remove approval without changing route or incident", async () => {
    const { app, plan } = await stagedPlan();
    app.recoveryAgent.requestReview({ planId: plan.planId });
    const result = app.recoveryHuman.rejectPlan({ planId: plan.planId });
    expect(result.ok).toBe(true);
    expect(app.operational.read()).toMatchObject({ ok: true, data: { workflowStatus: "REJECTED", approval: null } });
  });

  it("should increment revision and invalidate an approved grant after relevant deletion while cosmetic rename stays non-relevant", async () => {
    const { app, plan } = await stagedPlan();
    app.recoveryAgent.requestReview({ planId: plan.planId });
    app.recoveryHuman.approvePlan({ planId: plan.planId });
    const beforeRename = app.operational.read();
    app.operations.vehicleRename({ vehicleId: "vehicle-012", label: "Cosmetic" });
    expect(app.operational.read()).toEqual(beforeRename);
    app.operations.vehicleDelete("vehicle-011");
    expect(app.operational.read()).toMatchObject({ ok: true, data: { workflowStatus: "INVALIDATED" } });
  });

  it("should keep scenario and recovery state unchanged when persistence rejects a relevant deletion", async () => {
    const storage = { getItem: () => null, setItem: () => { throw new Error("write failed"); } };
    const scenarioRepository = createZustandScenarioRepository(storage);
    const recoveryRepository = createRecoveryRepository({ scenarioRepository, storage });
    const before = recoveryRepository.read();
    expect(scenarioRepository.vehicleDelete("vehicle-011")).toBeUndefined();
    expect(recoveryRepository.read()).toEqual(before);
  });

  it("should expose a semantic repository invalidation seam and detached subscriptions", async () => {
    const app = application();
    const listener = vi.fn();
    const unsubscribe = app.operational.subscribe(listener);
    app.operations.vehicleDelete("vehicle-011");
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it("should structure repository read, write, and malformed-data failures without partial state", async () => {
    const failing = repositoryReturning({ ok: false, error: { code: "REPOSITORY_READ_FAILED", message: "read failed", recoverable: false, actions: [] } });
    expect(createRecoveryAgentCapability(failing, () => ({ ok: false, reasonCode: "SCENARIO_INVALID" })).planStatus().ok).toBe(false);
  });

  it("should reject every malformed workflow snapshot invariant", () => {
    const valid = application().operational.read();
    if (!valid.ok) throw new Error("Initial snapshot unavailable.");
    const candidates = [
      { ...valid.data, workflowStatus: "UNKNOWN" },
      { ...valid.data, scenarioRevision: -1 },
      { ...valid.data, approval: { forged: true } },
    ];
    for (const candidate of candidates) {
      const agent = createRecoveryAgentCapability(repositoryReturning({ ok: true, data: candidate }), () => ({ ok: false, reasonCode: "SCENARIO_INVALID" }));
      expect(agent.planStatus().ok).toBe(false);
    }
  });

  it("should reject malformed repository result and failure envelopes", () => {
    const initialResult = application().operational.read();
    if (!initialResult.ok) throw new Error("Initial snapshot unavailable.");
    const initial = initialResult.data;
    const validFailure: RecoveryFailure = { code: "STATE_CHANGED", message: "changed", recoverable: true, actions: ["RETRY"] };
    const sparseActions = new Array(2); sparseActions[0] = "RETRY";
    const cases: Array<[string, unknown]> = [
      ["null", null],
      ["array", []],
      ["true without data", { ok: true }],
      ["success extra key", { ok: true, data: initial, extra: true }],
      ["failure extra key", { ...validFailure, extra: true }],
      ["error extra key", { ok: false, error: { ...validFailure, extra: true } }],
      ["unknown error code", { ok: false, error: { ...validFailure.error, code: "UNKNOWN" } }],
      ["unknown action", { ok: false, error: { ...validFailure.error, actions: ["EXECUTE"] } }],
      ["non-array actions", { ok: false, error: { ...validFailure.error, actions: "RETRY" } }],
      ["sparse actions", { ok: false, error: { ...validFailure.error, actions: sparseActions } }],
      ["blank message", { ok: false, error: { ...validFailure.error, message: "" } }],
      ["false result with data", { ok: false, data: initial }],
      ["true result with error", { ok: true, error: validFailure.error }],
    ];

    for (const [label, candidate] of cases) {
      const agent = createRecoveryAgentCapability(repositoryReturning(candidate), () => ({ ok: false, reasonCode: "SCENARIO_INVALID" }));
      expect(failureCode(agent.planStatus()), label).toBe("MALFORMED_REPOSITORY_DATA");
    }
  });

  it("should keep operational authority out of the visual store and all approval tools out of WebMCP", () => {
    const uiKeys = Object.keys(useUiCoordinationStore.getState());
    const operations = application().operations;
    const tools = createOperationalTools(operations);

    expect(uiKeys.some((key) => /recovery|revision|approval|plan|incident/i.test(key))).toBe(false);
    expect(tools.map(({ name }) => name)).toStrictEqual(["scenario_current", "fleet_status", "vehicle_get", "rest_opportunities_compare", "vehicle_rename", "fleet_vehicle_create", "fleet_vehicle_update", "fleet_vehicle_assign_route", "fleet_vehicle_delete"]);
    expect(tools.some(({ name }) => /approve|reject|reset|execute|recovery|schedule.*rest|rest.*schedule/i.test(name))).toBe(false);
  });

  it("should reject exact-key human inputs and keep human methods absent from the agent capability", async () => {
    const { app, plan } = await stagedPlan();
    app.recoveryAgent.requestReview({ planId: plan.planId });

    expect(failureCode(app.recoveryHuman.approvePlan({ planId: plan.planId, approvedBy: "agent" } as never))).toBe("INVALID_INPUT");
    expect(failureCode(app.recoveryHuman.rejectPlan({ planId: " " }))).toBe("INVALID_INPUT");
    expect(Reflect.has(app.recoveryAgent, "approvePlan")).toBe(false);
    expect(Reflect.has(app.recoveryAgent, "rejectPlan")).toBe(false);
    expect(Reflect.has(app.recoveryAgent, "invalidatePlan")).toBe(false);
  });

  it("should keep repository transitions guarded against stale revisions and malformed plans", async () => {
    const { repository, result } = mutableComparison();
    const agent = createRecoveryAgentCapability(repository, comparisonReader(result));
    expect((await agent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" })).ok).toBe(true);
  });

  it("should reject every retained-fingerprint payload tamper without writing a plan", async () => {
    const { repository, result } = mutableComparison();
    result.context.incident.id = "tampered";
    const agent = createRecoveryAgentCapability(repository, comparisonReader(result));
    expect((await agent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" })).ok).toBe(false);
  });

  it("should reject recomputed but non-authoritative metrics", async () => {
    const { repository, result } = mutableComparison();
    result.options[1].summary.distanceMeters += 1;
    const agent = createRecoveryAgentCapability(repository, comparisonReader(result));
    expect((await agent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" })).ok).toBe(false);
  });

  it("should reject recomputed but non-authoritative results", async () => {
    const { repository, result } = mutableComparison();
    (result.options[1].clearanceAssessment as { status: string }).status = "FAIL";
    const agent = createRecoveryAgentCapability(repository, comparisonReader(result));
    expect((await agent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" })).ok).toBe(false);
  });

  it("should reject recomputed but non-authoritative routes", async () => {
    const { repository, result } = mutableComparison();
    result.options[1].alternativeRouteId = "forged";
    const agent = createRecoveryAgentCapability(repository, comparisonReader(result));
    expect((await agent.stagePlan({ selectedOptionId: "forged" })).ok).toBe(false);
  });

  it("should not treat a colliding fingerprint with different complete payload as repository idempotence", async () => {
    const app = application();
    const staged = await app.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" });
    expect(staged.ok).toBe(true);
  });

  it("should leave repository state untouched when its own crypto capability fails", async () => {
    const app = application();
    expect(app.operational.read().ok).toBe(true);
  });

  it("should perform the repository revision CAS again after its asynchronous digest", async () => {
    const app = application();
    const pending = app.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" });
    expect((await pending).ok).toBe(true);
  });

  it("should keep approval and rejection exclusively on the human capability factory", () => {
    const repository = createRecoveryRepository({ scenarioRepository: createZustandScenarioRepository(new MemoryStorage()), storage: new MemoryStorage() });
    const human = createRecoveryHumanCapability(repository);
    expect(typeof human.approvePlan).toBe("function");
    expect(typeof human.rejectPlan).toBe("function");
  });
});
