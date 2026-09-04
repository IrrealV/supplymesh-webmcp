import { describe, expect, it } from "vitest";
import { createRecoveryApplication } from "../../app/createApplication";
import { createOperationsApi } from "../operations/createOperationsApi";
import type { OperationalRecoveryRepository } from "../ports/OperationalRecoveryRepository";
import { clearanceAlternativeCatalog } from "../../scenario/fixtures/clearanceAlternativeCatalog";
import { createZustandScenarioRepository } from "../../scenario/state/createZustandScenarioRepository";
import { createRecoveryExecutionCapability } from "./createRecoveryExecutionCapability";
import { createRecoveryAgentCapability, createRecoveryHumanCapability } from "./createRecoveryCapabilities";
import type { Sha256Crypto } from "./canonicalJson";
import type { RecoveryResult, RecoveryVerificationReport } from "./recoveryContracts";

class MemoryStorage {
  protected readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

class RejectingStorage extends MemoryStorage {
  public isRejecting = false;

  public override setItem(key: string, value: string): void {
    if (this.isRejecting) throw new Error("storage rejected write");
    super.setItem(key, value);
  }
}

function success<T>(result: { ok: true; data: T } | { ok: false; error: { code: string } }): T {
  if (!result.ok) throw new Error(`Expected success, received ${result.error.code}.`);
  return result.data;
}

function failureCode(result: RecoveryResult<unknown>): string {
  if (result.ok) throw new Error("Expected failure.");
  return result.error.code;
}

function expectDeepFrozen(value: unknown, seen = new WeakSet<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeepFrozen(child, seen);
}

async function approvedApplication(storage: MemoryStorage = new MemoryStorage()) {
  const app = createRecoveryApplication({ storage });
  const plan = success(await app.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" }));
  success(app.recoveryAgent.requestReview({ planId: plan.planId }));
  success(app.recoveryHuman.approvePlan({ planId: plan.planId }));
  return { app, plan, storage };
}

describe("recovery execution capability", () => {
  it("should reject execution without exact human approval and reject agent-supplied execution facts", async () => {
    const app = createRecoveryApplication({ storage: new MemoryStorage() });
    const plan = success(await app.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" }));

    expect(failureCode(await app.recoveryExecution.executeApprovedPlan({ planId: plan.planId }))).toBe("INVALID_WORKFLOW_STATE");
    expect(failureCode(await app.recoveryExecution.executeApprovedPlan({ planId: plan.planId, routeId: "attacker-route" }))).toBe("INVALID_INPUT");
    expect(success(app.recoveryAgent.planStatus()).workflowStatus).toBe("STAGED");
  });

  it("should atomically execute once, consume approval, and preserve unrelated scenario facts", async () => {
    const { app, plan } = await approvedApplication();
    const before = success(app.operations.scenarioCurrent());
    const beforeUnit = before.vehicles.find(({ internalId }) => internalId === "vehicle-011");

    const outcome = success(await app.recoveryExecution.executeApprovedPlan({ planId: plan.planId }));
    const after = success(app.operations.scenarioCurrent());
    const afterUnit = after.vehicles.find(({ internalId }) => internalId === "vehicle-011");
    const status = success(app.recoveryAgent.planStatus());

    expect(outcome.status).toBe("EXECUTED");
    expectDeepFrozen(outcome);
    expect(Reflect.set(outcome.execution, "executionId", "alias-attack")).toBe(false);
    expect(after.routes.filter(({ vehicleId }) => vehicleId === "vehicle-011").map(({ id }) => id)).toStrictEqual(["alternative-route-011-clearance-v1"]);
    expect(after.routes.some(({ id }) => id === "route-011")).toBe(false);
    expect(afterUnit).toMatchObject({ routeId: "alternative-route-011-clearance-v1", routeProgress: 0, cargo: beforeUnit?.cargo, destination: beforeUnit?.destination, timing: beforeUnit?.timing });
    expect(afterUnit?.position.geometry.coordinates).toStrictEqual(beforeUnit?.position.geometry.coordinates);
    expect(after.vehicles.filter(({ internalId }) => internalId !== "vehicle-011")).toStrictEqual(before.vehicles.filter(({ internalId }) => internalId !== "vehicle-011"));
    expect(status).toMatchObject({ workflowStatus: "EXECUTED", scenarioRevision: 2, incident: { status: "RESOLVED" }, approvalGrant: { used: true }, executionEffects: [{ planId: plan.planId }] });
    expect(success(app.recoveryAgent.planStatus()).executionRecord?.executionId).toBe(outcome.execution.executionId);
    expect(status.executionEffects).toHaveLength(1);
  });

  it("should make double and concurrent execution exactly idempotent", async () => {
    const { app, plan } = await approvedApplication();

    const [left, right] = await Promise.all([
      app.recoveryExecution.executeApprovedPlan({ planId: plan.planId }),
      app.recoveryExecution.executeApprovedPlan({ planId: plan.planId }),
    ]);
    const repeated = success(await app.recoveryExecution.executeApprovedPlan({ planId: plan.planId }));
    const status = success(app.recoveryAgent.planStatus());

    expect([success(left).status, success(right).status].sort()).toStrictEqual(["ALREADY_EXECUTED", "EXECUTED"]);
    expect(repeated.status).toBe("ALREADY_EXECUTED");
    expectDeepFrozen(repeated);
    expect(status.scenarioRevision).toBe(2);
    expect(status.executionEffects).toHaveLength(1);
  });

  it("should independently verify and return one stable immutable receipt", async () => {
    const { app, plan } = await approvedApplication();
    success(await app.recoveryExecution.executeApprovedPlan({ planId: plan.planId }));

    expect(failureCode(app.recoveryExecution.receiptGet({ planId: plan.planId }))).toBe("RECEIPT_UNAVAILABLE");
    const report = success(await app.recoveryExecution.verifyExecution({ planId: plan.planId }));
    const first = success(app.recoveryExecution.receiptGet({ planId: plan.planId }));
    const secondReport = success(await app.recoveryExecution.verifyExecution({ planId: plan.planId }));
    const second = success(app.recoveryExecution.receiptGet({ planId: plan.planId }));

    expect(report.status).toBe("PASS");
    expect(report.checks).toHaveLength(15);
    expect(report.checks.every(({ status }) => status === "PASS")).toBe(true);
    expect(secondReport).toStrictEqual(report);
    expect(second).toStrictEqual(first);
    expect(secondReport).not.toBe(report);
    expect(second).not.toBe(first);
    expectDeepFrozen(report);
    expectDeepFrozen(first);
    expectDeepFrozen(secondReport);
    expectDeepFrozen(second);
    expect(Object.isFrozen(report.checks)).toBe(true);
    expect(Object.isFrozen(report.checks[0])).toBe(true);
    expect(Reflect.set(report.checks[0], "status", "FAIL")).toBe(false);
    expect(Reflect.set(first, "receiptId", "alias-attack")).toBe(false);
    expect(success(app.recoveryAgent.planStatus())).toMatchObject({ workflowStatus: "VERIFIED", receipt: first });
  });

  it("should converge concurrent verification on one report and receipt transition", async () => {
    const { app, plan } = await approvedApplication();
    success(await app.recoveryExecution.executeApprovedPlan({ planId: plan.planId }));
    let transitions = 0;
    const unsubscribe = app.operational.subscribe(() => { transitions += 1; });

    const [left, right] = await Promise.all([
      app.recoveryExecution.verifyExecution({ planId: plan.planId }),
      app.recoveryExecution.verifyExecution({ planId: plan.planId }),
    ]);
    unsubscribe();

    expect(success(left)).toStrictEqual(success(right));
    expect(transitions).toBe(1);
    expect(success(app.recoveryExecution.receiptGet({ planId: plan.planId })).verificationReport).toStrictEqual(success(left));
  });

  it("should reset deterministically, preserve locale, increment once, and remain idempotent", async () => {
    const storage = new MemoryStorage();
    storage.setItem("locale:v1", "es");
    const { app, plan } = await approvedApplication(storage);
    success(await app.recoveryExecution.executeApprovedPlan({ planId: plan.planId }));
    success(await app.recoveryExecution.verifyExecution({ planId: plan.planId }));

    const first = success(app.recoveryExecution.reset({}));
    const second = success(app.recoveryExecution.reset({}));
    const scenario = success(app.operations.scenarioCurrent());
    const unit = scenario.vehicles.find(({ internalId }) => internalId === "vehicle-011");

    expect(first).toStrictEqual(second);
    expect(second).not.toBe(first);
    expectDeepFrozen(first);
    expectDeepFrozen(second);
    expect(first).toMatchObject({ scenarioRevision: 3, workflowStatus: "IDLE", incident: { status: "OPEN" }, plan: null, approvalGrant: null, executionRecord: null, executionEffects: [], verificationReport: null, receipt: null });
    expect(unit).toMatchObject({ routeId: "route-011", routeProgress: 0 });
    expect(storage.getItem("locale:v1")).toBe("es");
  });

  it("should leave execution, verification, and reset state unchanged when persistence fails", async () => {
    const storage = new RejectingStorage();
    const { app, plan } = await approvedApplication(storage);
    const approved = success(app.recoveryAgent.planStatus());
    const scenarioBefore = success(app.operations.scenarioCurrent());
    storage.isRejecting = true;

    expect(failureCode(await app.recoveryExecution.executeApprovedPlan({ planId: plan.planId }))).toBe("REPOSITORY_FAILURE");
    expect(success(app.recoveryAgent.planStatus())).toStrictEqual(approved);
    expect(success(app.operations.scenarioCurrent())).toStrictEqual(scenarioBefore);

    storage.isRejecting = false;
    success(await app.recoveryExecution.executeApprovedPlan({ planId: plan.planId }));
    const executed = success(app.recoveryAgent.planStatus());
    const executedScenario = success(app.operations.scenarioCurrent());
    storage.isRejecting = true;
    expect(failureCode(await app.recoveryExecution.verifyExecution({ planId: plan.planId }))).toBe("REPOSITORY_FAILURE");
    expect(success(app.recoveryAgent.planStatus())).toStrictEqual(executed);
    expect(failureCode(app.recoveryExecution.reset({}))).toBe("REPOSITORY_FAILURE");
    expect(success(app.recoveryAgent.planStatus())).toStrictEqual(executed);
    expect(success(app.operations.scenarioCurrent())).toStrictEqual(executedScenario);
  });

  it("should reject conflicting replay plan identifiers", async () => {
    const { app, plan } = await approvedApplication();
    success(await app.recoveryExecution.executeApprovedPlan({ planId: plan.planId }));

    expect(failureCode(await app.recoveryExecution.executeApprovedPlan({ planId: "recovery-plan:conflict" }))).toBe("PLAN_MISMATCH");
  });

  it("should fail closed on invalidated, rejected, tampered-catalog, and crypto-fault execution", async () => {
    const invalidated = await approvedApplication();
    success(invalidated.app.operations.vehicleDelete("vehicle-001"));
    expect(failureCode(await invalidated.app.recoveryExecution.executeApprovedPlan({ planId: invalidated.plan.planId }))).toBe("INVALID_WORKFLOW_STATE");

    const rejected = await approvedApplication();
    success(rejected.app.recoveryHuman.rejectPlan({ planId: rejected.plan.planId }));
    expect(failureCode(await rejected.app.recoveryExecution.executeApprovedPlan({ planId: rejected.plan.planId }))).toBe("INVALID_WORKFLOW_STATE");

    const catalog = structuredClone(clearanceAlternativeCatalog);
    const tampered = await approvedApplication();
    const tamperedApp = createRecoveryApplication({ storage: new MemoryStorage(), readAlternativeCatalog: () => catalog, admittedAlternativeCatalog: catalog });
    const tamperedPlan = success(await tamperedApp.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" }));
    success(tamperedApp.recoveryAgent.requestReview({ planId: tamperedPlan.planId }));
    success(tamperedApp.recoveryHuman.approvePlan({ planId: tamperedPlan.planId }));
    Reflect.set(catalog.summary, "distanceMeters", 1);
    expect(failureCode(await tamperedApp.recoveryExecution.executeApprovedPlan({ planId: tamperedPlan.planId }))).toBe("COMPARISON_UNAVAILABLE");
    expect(success(tamperedApp.recoveryAgent.planStatus()).workflowStatus).toBe("APPROVED");
    expect(success(tampered.app.recoveryAgent.planStatus()).workflowStatus).toBe("APPROVED");

    let digestCalls = 0;
    const cryptoCapability: Sha256Crypto = { digest: async (bytes) => {
      digestCalls += 1;
      if (digestCalls > 4) throw new Error("execution digest failed");
      return globalThis.crypto.subtle.digest("SHA-256", bytes);
    } };
    const failedCrypto = await approvedApplicationWithCrypto(cryptoCapability);
    const before = success(failedCrypto.app.recoveryAgent.planStatus());
    expect(failureCode(await failedCrypto.app.recoveryExecution.executeApprovedPlan({ planId: failedCrypto.plan.planId }))).toBe("CRYPTO_FAILURE");
    expect(success(failedCrypto.app.recoveryAgent.planStatus())).toStrictEqual(before);
  });

  it.each([
    ["geometry", (catalog: MutableCatalog) => { catalog.geometry.coordinates[10][0] += 0.01; }, "COMPARISON_UNAVAILABLE"],
    ["polygon", (catalog: MutableCatalog) => { catalog.provenance.avoidance.polygon.coordinates[0][10][0] += 0.01; }, "COMPARISON_UNAVAILABLE"],
    ["summary", (catalog: MutableCatalog) => { catalog.summary.distanceMeters += 1; }, "COMPARISON_UNAVAILABLE"],
    ["provenance", (catalog: MutableCatalog) => { catalog.provenance.sourceRevision = "0".repeat(64); }, "COMPARISON_UNAVAILABLE"],
  ] as const)("should reject in-place admitted %s tampering after approval without execution mutation", async (_label, mutate, expectedCode) => {
    const catalog = structuredClone(clearanceAlternativeCatalog);
    const app = createRecoveryApplication({ storage: new MemoryStorage(), readAlternativeCatalog: () => catalog, admittedAlternativeCatalog: catalog });
    const plan = success(await app.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" }));
    success(app.recoveryAgent.requestReview({ planId: plan.planId }));
    success(app.recoveryHuman.approvePlan({ planId: plan.planId }));
    const before = success(app.recoveryAgent.planStatus());
    mutate(catalog as unknown as MutableCatalog);

    expect(failureCode(await app.recoveryExecution.executeApprovedPlan({ planId: plan.planId }))).toBe(expectedCode);
    expect(success(app.recoveryAgent.planStatus())).toStrictEqual(before);
    expect(success(app.operations.scenarioCurrent()).routes.some(({ id }) => id === "route-011")).toBe(true);
  });

  it.each([
    ["geometry", (catalog: MutableCatalog) => { catalog.geometry.coordinates[20][1] += 0.01; }, "COMPARISON_UNAVAILABLE"],
    ["polygon", (catalog: MutableCatalog) => { catalog.provenance.avoidance.polygon.coordinates[0][20][1] += 0.01; }, "PLAN_MISMATCH"],
    ["summary", (catalog: MutableCatalog) => { catalog.summary.durationSeconds += 1; }, "COMPARISON_UNAVAILABLE"],
    ["provenance", (catalog: MutableCatalog) => { catalog.provenance.provider = "tampered"; }, "COMPARISON_UNAVAILABLE"],
  ] as const)("should reject in-place admitted %s tampering before verification without report mutation", async (_label, mutate, expectedCode) => {
    const catalog = structuredClone(clearanceAlternativeCatalog);
    const app = createRecoveryApplication({ storage: new MemoryStorage(), readAlternativeCatalog: () => catalog, admittedAlternativeCatalog: catalog });
    const plan = success(await app.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" }));
    success(app.recoveryAgent.requestReview({ planId: plan.planId }));
    success(app.recoveryHuman.approvePlan({ planId: plan.planId }));
    success(await app.recoveryExecution.executeApprovedPlan({ planId: plan.planId }));
    mutate(catalog as unknown as MutableCatalog);

    expect(failureCode(await app.recoveryExecution.verifyExecution({ planId: plan.planId }))).toBe(expectedCode);
    expect(success(app.recoveryAgent.planStatus())).toMatchObject({ workflowStatus: "EXECUTED", verificationReport: null, receipt: null });
  });

  it("should reject a forged repository verification report without creating a receipt", async () => {
    const { app, plan } = await approvedApplication();
    success(await app.recoveryExecution.executeApprovedPlan({ planId: plan.planId }));
    const repository = createRepositoryForVerification(new MemoryStorage());
    const operations = createOperationsApi(repository, { readAlternativeCatalog: () => clearanceAlternativeCatalog, admittedAlternativeCatalog: clearanceAlternativeCatalog });
    const executionRecord = success(app.recoveryAgent.planStatus()).executionRecord;
    if (executionRecord === null) throw new Error("Execution record is unavailable.");
    const forged: RecoveryVerificationReport = { verificationId: `recovery-verification:${executionRecord.executionId}`, executionId: executionRecord.executionId, planId: plan.planId, fingerprint: plan.fingerprint, status: "PASS", checks: [], createdAt: executionRecord.createdAt };
    const fake: OperationalRecoveryRepository = { ...repository, operationalRead: app.operational.read, operationalVerify: async () => recoverySuccessForTest(forged) };
    const execution = createRecoveryExecutionCapability(fake, operations.unit211PreDispatchContext, () => clearanceAlternativeCatalog, { digest: (bytes) => globalThis.crypto.subtle.digest("SHA-256", bytes) });

    expect(failureCode(await execution.verifyExecution({ planId: plan.planId }))).toBe("MALFORMED_REPOSITORY_DATA");
    expect(Object.hasOwn(repository, "operationalCommitVerification")).toBe(false);
    expect(failureCode(app.recoveryExecution.receiptGet({ planId: plan.planId }))).toBe("RECEIPT_UNAVAILABLE");
  });

  it("should reject forged grant, effect, report, receipt, and workflow state before repository verification", async () => {
    const { app, plan } = await approvedApplication();
    success(await app.recoveryExecution.executeApprovedPlan({ planId: plan.planId }));
    const snapshot = success(app.recoveryAgent.planStatus());
    const repository = createRepositoryForVerification(new MemoryStorage());
    const operations = createOperationsApi(repository, { readAlternativeCatalog: () => clearanceAlternativeCatalog, admittedAlternativeCatalog: clearanceAlternativeCatalog });
    let verifyCalls = 0;
    const cases: readonly [string, unknown][] = [
      ["grant", { ...snapshot, approvalGrant: snapshot.approvalGrant === null ? null : { ...snapshot.approvalGrant, used: false } }],
      ["effect", { ...snapshot, executionEffects: [] }],
      ["report", { ...snapshot, verificationReport: { forged: true } }],
      ["receipt", { ...snapshot, receipt: { forged: true } }],
      ["workflow", { ...snapshot, workflowStatus: "VERIFIED" }],
    ];

    for (const [label, candidate] of cases) {
      const fake: OperationalRecoveryRepository = {
        ...repository,
        operationalRead: () => recoverySuccessForTest(candidate) as RecoveryResult<typeof snapshot>,
        operationalVerify: async () => { verifyCalls += 1; return recoveryFailureForTest(); },
      };
      const execution = createRecoveryExecutionCapability(fake, operations.unit211PreDispatchContext, () => clearanceAlternativeCatalog, { digest: (bytes) => globalThis.crypto.subtle.digest("SHA-256", bytes) });
      expect(failureCode(await execution.verifyExecution({ planId: plan.planId })), label).toBe("MALFORMED_REPOSITORY_DATA");
    }
    expect(verifyCalls).toBe(0);
    expect(failureCode(app.recoveryExecution.receiptGet({ planId: plan.planId }))).toBe("RECEIPT_UNAVAILABLE");
  });

  it("should reject a forged repository receipt result", async () => {
    const { app, plan } = await approvedApplication();
    success(await app.recoveryExecution.executeApprovedPlan({ planId: plan.planId }));
    success(await app.recoveryExecution.verifyExecution({ planId: plan.planId }));
    const receipt = success(app.recoveryExecution.receiptGet({ planId: plan.planId }));
    const repository = createRepositoryForVerification(new MemoryStorage());
    const fake: OperationalRecoveryRepository = { ...repository, operationalRead: app.operational.read, operationalReceiptGet: () => recoverySuccessForTest({ ...receipt, receiptId: "forged-receipt" }) };
    const operations = createOperationsApi(repository, { readAlternativeCatalog: () => clearanceAlternativeCatalog, admittedAlternativeCatalog: clearanceAlternativeCatalog });
    const execution = createRecoveryExecutionCapability(fake, operations.unit211PreDispatchContext, () => clearanceAlternativeCatalog, { digest: (bytes) => globalThis.crypto.subtle.digest("SHA-256", bytes) });

    expect(failureCode(execution.receiptGet({ planId: plan.planId }))).toBe("MALFORMED_REPOSITORY_DATA");
  });

  it("should reject forged persisted execution state and expose no receipt", async () => {
    const { app, plan } = await approvedApplication();
    success(await app.recoveryExecution.executeApprovedPlan({ planId: plan.planId }));
    success(await app.recoveryExecution.verifyExecution({ planId: plan.planId }));
    const verified = success(app.recoveryAgent.planStatus());
    const storage = new MemoryStorage();
    storage.setItem("scenario-overrides:v1", JSON.stringify({ version: 1, labels: {}, deletedVehicleIds: [], recoveryRouteApplied: true, operationalSnapshot: { ...verified, executionEffects: [] } }));

    const repository = createZustandScenarioRepository(storage);
    const restored = success(repository.operationalRead());

    expect(restored).toMatchObject({ scenarioRevision: 1, workflowStatus: "IDLE", plan: null, receipt: null });
    expect(failureCode(repository.operationalReceiptGet({ planId: plan.planId }))).toBe("PLAN_MISMATCH");
  });

  it("should persist verification failure when the admitted catalog is manipulated after execution", async () => {
    const catalog = structuredClone(clearanceAlternativeCatalog);
    const app = createRecoveryApplication({ storage: new MemoryStorage(), readAlternativeCatalog: () => catalog, admittedAlternativeCatalog: catalog });
    const plan = success(await app.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" }));
    success(app.recoveryAgent.requestReview({ planId: plan.planId }));
    success(app.recoveryHuman.approvePlan({ planId: plan.planId }));
    success(await app.recoveryExecution.executeApprovedPlan({ planId: plan.planId }));
    Reflect.set(catalog.provenance.avoidance, "minimumClearanceMeters", 1);

    expect(failureCode(await app.recoveryExecution.verifyExecution({ planId: plan.planId }))).toBe("COMPARISON_UNAVAILABLE");
    expect(failureCode(app.recoveryExecution.receiptGet({ planId: plan.planId }))).toBe("RECEIPT_UNAVAILABLE");
    expect(success(app.recoveryAgent.planStatus()).workflowStatus).toBe("EXECUTED");
  });

  it("should detect a post-execution scenario revision change during verification", async () => {
    const { app, plan } = await approvedApplication();
    success(await app.recoveryExecution.executeApprovedPlan({ planId: plan.planId }));
    expect(app.operations.vehicleDelete("vehicle-001").ok).toBe(true);

    const report = success(await app.recoveryExecution.verifyExecution({ planId: plan.planId }));

    expect(report.status).toBe("FAIL");
    expect(report.checks.find(({ name }) => name === "REVISION_INCREMENTED")?.status).toBe("FAIL");
    expect(success(app.recoveryAgent.planStatus())).toMatchObject({ scenarioRevision: 3, workflowStatus: "VERIFICATION_FAILED", receipt: null });
  });

  it("should persist verification failure when Unit 211 is removed after execution", async () => {
    const { app, plan } = await approvedApplication();
    success(await app.recoveryExecution.executeApprovedPlan({ planId: plan.planId }));
    expect(app.operations.vehicleDelete("vehicle-011").ok).toBe(true);

    const report = success(await app.recoveryExecution.verifyExecution({ planId: plan.planId }));

    expect(report.status).toBe("FAIL");
    expect(report.checks.find(({ name }) => name === "UNIT_ROUTE_SINGLETON")?.status).toBe("FAIL");
    expect(report.checks.find(({ name }) => name === "ACTIVE_ROUTE_BINDING")?.status).toBe("FAIL");
    expect(report.checks.find(({ name }) => name === "CARGO_CONTINUITY")?.status).toBe("FAIL");
    expect(failureCode(app.recoveryExecution.receiptGet({ planId: plan.planId }))).toBe("RECEIPT_UNAVAILABLE");
  });

  it("should expose execution separately from agent and human capabilities", async () => {
    const { app } = await approvedApplication();

    expect(Object.keys(app.recoveryExecution).sort()).toStrictEqual(["executeApprovedPlan", "receiptGet", "reset", "verifyExecution"]);
    expect(Reflect.has(app.recoveryAgent, "executeApprovedPlan")).toBe(false);
    expect(Reflect.has(app.recoveryExecution, "approvePlan")).toBe(false);
    expect(Reflect.has(app.recoveryExecution, "rejectPlan")).toBe(false);
  });

  it("should guard repository execution against stale revision, wrong plan, tampered fingerprint, and consumed grant", async () => {
    const repository = createRepositoryForVerification(new MemoryStorage());
    const operations = createOperationsApi(repository, { readAlternativeCatalog: () => clearanceAlternativeCatalog, admittedAlternativeCatalog: clearanceAlternativeCatalog });
    const cryptoCapability: Sha256Crypto = { digest: (bytes) => globalThis.crypto.subtle.digest("SHA-256", bytes) };
    const agent = createRecoveryAgentCapability(repository, operations.unit211PreDispatchContext, cryptoCapability);
    const human = createRecoveryHumanCapability(repository);
    const plan = success(await agent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" }));
    success(agent.requestReview({ planId: plan.planId }));
    success(human.approvePlan({ planId: plan.planId }));
    expect(failureCode(await repository.operationalExecute({ expectedScenarioRevision: 0, planId: plan.planId }))).toBe("REVISION_MISMATCH");
    expect(failureCode(await repository.operationalExecute({ expectedScenarioRevision: 1, planId: "wrong-plan" }))).toBe("PLAN_MISMATCH");
    expect(success(repository.operationalRead()).workflowStatus).toBe("APPROVED");

    const approved = success(repository.operationalRead());
    const consumedRepository: OperationalRecoveryRepository = { ...repository, operationalRead: () => recoverySuccessForTest({ ...approved, approvalGrant: approved.approvalGrant === null ? null : { ...approved.approvalGrant, used: true } }) };
    const consumedExecution = createRecoveryExecutionCapability(consumedRepository, operations.unit211PreDispatchContext, () => clearanceAlternativeCatalog, cryptoCapability);
    expect(failureCode(await consumedExecution.executeApprovedPlan({ planId: plan.planId }))).toBe("MALFORMED_REPOSITORY_DATA");
    expect(success(repository.operationalRead()).workflowStatus).toBe("APPROVED");
  });

  it("should emit one subscription transition for one concurrent execution effect", async () => {
    const repository = createRepositoryForVerification(new MemoryStorage());
    const operations = createOperationsApi(repository, { readAlternativeCatalog: () => clearanceAlternativeCatalog, admittedAlternativeCatalog: clearanceAlternativeCatalog });
    const cryptoCapability: Sha256Crypto = { digest: (bytes) => globalThis.crypto.subtle.digest("SHA-256", bytes) };
    const agent = createRecoveryAgentCapability(repository, operations.unit211PreDispatchContext, cryptoCapability);
    const human = createRecoveryHumanCapability(repository);
    const execution = createRecoveryExecutionCapability(repository, operations.unit211PreDispatchContext, () => clearanceAlternativeCatalog, cryptoCapability);
    const plan = success(await agent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" }));
    success(agent.requestReview({ planId: plan.planId }));
    success(human.approvePlan({ planId: plan.planId }));
    let transitions = 0;
    const unsubscribe = repository.operationalSubscribe(() => { transitions += 1; });

    await Promise.all([execution.executeApprovedPlan({ planId: plan.planId }), execution.executeApprovedPlan({ planId: plan.planId })]);
    unsubscribe();

    expect(transitions).toBe(1);
    expect(success(repository.operationalRead()).executionEffects).toHaveLength(1);
  });

  it("should detach and freeze every public scenario, vehicle, mutation, and operational result", () => {
    const repository = createRepositoryForVerification(new MemoryStorage());
    const operations = createOperationsApi(repository, { readAlternativeCatalog: () => clearanceAlternativeCatalog, admittedAlternativeCatalog: clearanceAlternativeCatalog });
    const scenario = repository.scenarioCurrent();
    const vehicle = repository.vehicleGet("vehicle-002");
    const renamed = repository.vehicleRename("vehicle-002", "Detached Rename");
    const apiScenario = success(operations.scenarioCurrent());
    const apiVehicle = success(operations.vehicleGet("vehicle-002"));
    const operational = success(repository.operationalRead());
    const verificationRead = success(repository.operationalVerificationRead());
    if (vehicle === undefined || renamed === undefined) throw new Error("Expected vehicle results.");

    expect(Object.isFrozen(scenario)).toBe(true);
    expect(Object.isFrozen(vehicle)).toBe(true);
    expect(Object.isFrozen(renamed)).toBe(true);
    expect(Object.isFrozen(apiScenario)).toBe(true);
    expect(Object.isFrozen(apiVehicle)).toBe(true);
    expect(Object.isFrozen(operational)).toBe(true);
    expect(Object.isFrozen(verificationRead)).toBe(true);
    expect(Reflect.set(scenario.vehicles[0], "label", "Alias Attack")).toBe(false);
    expect(Reflect.set(vehicle, "label", "Alias Attack")).toBe(false);
    expect(Reflect.set(renamed, "label", "Alias Attack")).toBe(false);
    expect(Reflect.set(apiVehicle, "label", "Alias Attack")).toBe(false);
    expect(Reflect.set(operational, "scenarioRevision", 99)).toBe(false);
    expect(Reflect.set(verificationRead.scenario.vehicles[0], "label", "Alias Attack")).toBe(false);
    expect(repository.vehicleGet("vehicle-002")?.label).toBe("Detached Rename");

    const deleted = repository.vehicleDelete("vehicle-003");
    if (deleted === undefined) throw new Error("Expected deleted vehicle.");
    expect(Object.isFrozen(deleted)).toBe(true);
    expect(Reflect.set(deleted, "label", "Alias Attack")).toBe(false);
    expect(repository.vehicleGet("vehicle-003")).toBeUndefined();
  });

  it("should ignore direct route-data injection and execute from immutable repository authority", async () => {
    const catalog = structuredClone(clearanceAlternativeCatalog);
    const storage = new MemoryStorage();
    const repository = createZustandScenarioRepository(storage, undefined, catalog);
    const operations = createOperationsApi(repository, { readAlternativeCatalog: () => catalog, admittedAlternativeCatalog: catalog });
    const agent = createRecoveryAgentCapability(repository, operations.unit211PreDispatchContext);
    const human = createRecoveryHumanCapability(repository);
    const plan = success(await agent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" }));
    success(agent.requestReview({ planId: plan.planId }));
    success(human.approvePlan({ planId: plan.planId }));
    const expectedFirstCoordinate = structuredClone(clearanceAlternativeCatalog.geometry.coordinates[0]);
    (catalog as unknown as MutableCatalog).geometry.coordinates[0][0] += 5;
    const injected = { expectedScenarioRevision: 1, planId: plan.planId, admittedRoute: { geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] } } };

    const result = await Reflect.apply(repository.operationalExecute, repository, [injected]) as RecoveryResult<unknown>;
    const applied = success(operations.scenarioCurrent()).routes.find(({ id }) => id === "alternative-route-011-clearance-v1");
    const verification = await Reflect.apply(repository.operationalVerify, repository, [{ expectedScenarioRevision: 2, planId: plan.planId, report: { forged: true }, receipt: { forged: true } }]) as RecoveryResult<RecoveryVerificationReport>;

    expect(result.ok).toBe(true);
    expect(applied?.geometry.geometry.coordinates[0]).toStrictEqual(expectedFirstCoordinate);
    expect(applied?.geometry.geometry.coordinates[0]).not.toStrictEqual((catalog as unknown as MutableCatalog).geometry.coordinates[0]);
    expect(success(verification).status).toBe("PASS");
    expect(success(verification).checks).toHaveLength(15);
    expect(Object.hasOwn(success(verification), "forged")).toBe(false);
  });
});

function recoverySuccessForTest<T>(data: T): RecoveryResult<T> {
  return { ok: true, data };
}

function recoveryFailureForTest<T>(): RecoveryResult<T> {
  return { ok: false, error: { code: "REPOSITORY_FAILURE", message: "Fake repository failure.", actions: ["RETRY"] } };
}

type MutableCatalog = {
  geometry: { coordinates: number[][] };
  summary: { distanceMeters: number; durationSeconds: number };
  provenance: { provider: string; sourceRevision: string; avoidance: { polygon: { coordinates: number[][][] } } };
};

function createRepositoryForVerification(storage: MemoryStorage) {
  return createZustandScenarioRepository(storage, undefined, clearanceAlternativeCatalog);
}

async function approvedApplicationWithCrypto(cryptoCapability: Sha256Crypto) {
  const app = createRecoveryApplication({ storage: new MemoryStorage(), cryptoCapability });
  const plan = success(await app.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" }));
  success(app.recoveryAgent.requestReview({ planId: plan.planId }));
  success(app.recoveryHuman.approvePlan({ planId: plan.planId }));
  return { app, plan };
}
