import { describe, expect, it } from "vitest";
import { createRecoveryApplication } from "../../app/createApplication";
import { useUiCoordinationStore } from "../../app/state/useUiCoordinationStore";
import type { Unit211PreDispatchContextResult } from "../operations/unit211PreDispatchContext";
import type { OperationalRecoveryRepository } from "../ports/OperationalRecoveryRepository";
import { createOperationsApi } from "../operations/createOperationsApi";
import { clearanceAlternativeCatalog } from "../../scenario/fixtures/clearanceAlternativeCatalog";
import { createZustandScenarioRepository } from "../../scenario/state/createZustandScenarioRepository";
import { createOperationalTools } from "../../platform/webmcp/registerOperationalTools";
import { sha256Fingerprint, type Sha256Crypto } from "./canonicalJson";
import { createRecoveryAgentCapability, createRecoveryHumanCapability } from "./createRecoveryCapabilities";
import type { OperationalRecoverySnapshot, RecoveryPlan, RecoveryPlanPayload, RecoveryResult } from "./recoveryContracts";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

class RejectingStorage extends MemoryStorage {
  public override setItem(): void {
    throw new Error("storage rejected write");
  }
}

function success<T>(result: RecoveryResult<T>): T {
  if (!result.ok) throw new Error(`Expected recovery success, received ${result.error.code}.`);
  return result.data;
}

function failureCode(result: RecoveryResult<unknown>): string {
  if (result.ok) throw new Error("Expected recovery failure.");
  return result.error.code;
}

function expectDeepFrozen(value: unknown, seen = new WeakSet<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeepFrozen(child, seen);
}

function application(options: Parameters<typeof createRecoveryApplication>[0] = {}) {
  return createRecoveryApplication({ storage: new MemoryStorage(), ...options });
}

async function stagedPlan(app = application()): Promise<{ app: ReturnType<typeof application>; plan: RecoveryPlan }> {
  const plan = success(await app.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" }));
  return { app, plan };
}

function mutableComparison(): { repository: ReturnType<typeof createZustandScenarioRepository>; result: Unit211PreDispatchContextResult } {
  const repository = createZustandScenarioRepository(new MemoryStorage());
  const operations = createOperationsApi(repository, { readAlternativeCatalog: () => clearanceAlternativeCatalog, admittedAlternativeCatalog: clearanceAlternativeCatalog });
  return { repository, result: structuredClone(operations.unit211PreDispatchContext()) };
}

function comparisonReader(result: Unit211PreDispatchContextResult): () => Unit211PreDispatchContextResult {
  return () => structuredClone(result);
}

function payloadFrom(plan: RecoveryPlan): RecoveryPlanPayload {
  const { fingerprint, ...payload } = plan;
  expect(fingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
  return payload;
}

type Path = readonly (string | number)[];

function leafPaths(value: unknown, path: Path = []): Path[] {
  if (Array.isArray(value)) return value.flatMap((child, index) => leafPaths(child, [...path, index]));
  if (typeof value === "object" && value !== null) return Object.entries(value).flatMap(([key, child]) => leafPaths(child, [...path, key]));
  return [path];
}

function changedValue(value: unknown): unknown {
  if (typeof value === "string") return `${value}-changed`;
  if (typeof value === "number") return value + 1;
  if (typeof value === "boolean") return !value;
  return "changed";
}

function changeAtPath(value: RecoveryPlanPayload, path: Path): RecoveryPlanPayload {
  const clone: unknown = structuredClone(value);
  let parent: unknown = clone;
  for (const segment of path.slice(0, -1)) {
    if (typeof parent !== "object" || parent === null) throw new Error("Payload path parent is invalid.");
    parent = Reflect.get(parent, segment);
  }
  const leaf = path.at(-1);
  if (leaf === undefined || typeof parent !== "object" || parent === null) throw new Error("Payload leaf path is invalid.");
  Reflect.set(parent, leaf, changedValue(Reflect.get(parent, leaf)));
  return clone as RecoveryPlanPayload;
}

function constantCrypto(byte = 0xab): Sha256Crypto {
  return {
    digest: async () => {
      const digest = new Uint8Array(new ArrayBuffer(32));
      digest.fill(byte);
      return digest.buffer;
    },
  };
}

function repositoryReturning(result: unknown): OperationalRecoveryRepository {
  return { ...repositoryBoundaryBase, operationalRead: () => result as RecoveryResult<OperationalRecoverySnapshot> };
}

const repositoryBoundaryBase = createZustandScenarioRepository(new MemoryStorage());

describe("recovery planning authority", () => {
  it("should expose capability-separated APIs and the exact initial operational state", () => {
    const app = application();

    expect(Object.keys(app.recoveryAgent).sort()).toStrictEqual(["compareOptions", "planStatus", "requestReview", "stagePlan"]);
    expect(Object.keys(app.recoveryHuman).sort()).toStrictEqual(["approvePlan", "rejectPlan"]);
    const initial = success(app.recoveryAgent.planStatus());
    expectDeepFrozen(initial);
    expect(initial).toStrictEqual({
      scenarioRevision: 1,
      workflowStatus: "IDLE",
      incident: { id: "incident-route-011-restriction-height-3.9", vehicleId: "vehicle-011", riskId: "restriction-height-3.9", routeId: "route-011", status: "OPEN" },
      plan: null,
      approvalGrant: null,
      executionRecord: null,
      executionEffects: [],
      verificationReport: null,
      receipt: null,
    });
  });

  it("should expose the authoritative detached Unit 211 comparison without mutation authority", () => {
    const app = application();
    const first = success(app.recoveryAgent.compareOptions());
    const second = success(app.recoveryAgent.compareOptions());

    expect(first.options.map((option) => option.kind)).toStrictEqual(["CURRENT", "ALTERNATIVE"]);
    expect(first.options[0].summary).toStrictEqual({ distanceMeters: 99706.6, durationSeconds: 5292.1 });
    expect(first.options[1].summary).toStrictEqual({ distanceMeters: 80298.9, durationSeconds: 5282.5 });
    expectDeepFrozen(first);
    expect(Object.isFrozen(first.options[1].geometry.coordinates)).toBe(true);
    expect(Reflect.set(first.options[1].geometry.coordinates[0], "0", 99)).toBe(false);
    expect(first).toStrictEqual(second);
    expect(first).not.toBe(second);
  });

  it.each([
    ["empty object", {}, "INVALID_INPUT"],
    ["blank option", { selectedOptionId: " " }, "INVALID_INPUT"],
    ["current route", { selectedOptionId: "route-011" }, "OPTION_NOT_ADMITTED"],
    ["unknown option", { selectedOptionId: "alternative-unknown" }, "OPTION_NOT_ADMITTED"],
    ["extra key", { selectedOptionId: "alternative-route-011-clearance-v1", revision: 1 }, "INVALID_INPUT"],
    ["submitted clearance", { selectedOptionId: "alternative-route-011-clearance-v1", clearanceBufferMeters: 0 }, "INVALID_INPUT"],
    ["submitted metrics", { selectedOptionId: "alternative-route-011-clearance-v1", metrics: {} }, "INVALID_INPUT"],
    ["submitted fingerprint", { selectedOptionId: "alternative-route-011-clearance-v1", fingerprint: `sha256:${"0".repeat(64)}` }, "INVALID_INPUT"],
  ])("should reject $0 staging input", async (_label, input, expectedCode) => {
    const result = await application().recoveryAgent.stagePlan(input);

    expect(failureCode(result)).toBe(expectedCode);
  });

  it("should stage the exact authoritative plan without changing the scenario, incident, approval, or revision", async () => {
    const app = application();
    const scenarioBefore = app.operations.scenarioCurrent();

    const plan = success(await app.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" }));
    const status = success(app.recoveryAgent.planStatus());

    expect(plan).toStrictEqual({
      planId: "recovery-plan:vehicle-011:revision-1:alternative-route-011-clearance-v1",
      basedOnScenarioRevision: 1,
      selectedOptionId: "alternative-route-011-clearance-v1",
      vehicleId: "vehicle-011",
      incidentId: "incident-route-011-restriction-height-3.9",
      currentRouteId: "route-011",
      proposedRouteId: "alternative-route-011-clearance-v1",
      hardConstraints: { clearanceBufferMeters: 0.2, protectRestDeadline: true, keepCargoAssignment: true, requireExclusionZoneAvoidance: true },
      constraintResults: {
        currentClearance: { ok: true, data: { vehicleId: "vehicle-011", riskId: "restriction-height-3.9", routeId: "route-011", vehicleHeightMeters: 3.8, clearanceBufferMeters: 0.2, requiredClearanceMeters: 4, restrictionLimitMeters: 3.9, status: "FAIL", reasonCode: "CLEARANCE_VIOLATION" } },
        proposedClearance: { status: "PASS", reasonCode: "MINIMUM_CLEARANCE_SATISFIED", clearanceBufferMeters: 0.2, minimumClearanceMeters: 5724.858608188861 },
        proposedAvoidance: { status: "PASS", reasonCode: "EXCLUSION_ZONE_AVOIDED", avoidsExclusionZone: true, avoidsRiskId: "restriction-height-3.9" },
        proposedTemporal: { remainingRouteMinutes: 88.04166666666667, remainingDriveMinutes: 235, estimatedCompletionAt: "2026-08-28T10:28:02.500Z", restDeadline: "2026-08-28T16:00:00Z", status: "PASS", reasonCode: "TEMPORAL_WINDOW_SATISFIED" },
        proposedCargoContinuity: { status: "PASS", reasonCode: "CARGO_CONTINUITY_SATISFIED", referenceFacts: { vehicleId: "vehicle-011", cargoId: "cargo-011", destinationId: "alcobendas", refrigeration: "ambient", priority: "standard" }, optionFacts: { vehicleId: "vehicle-011", cargoId: "cargo-011", destinationId: "alcobendas", refrigeration: "ambient", priority: "standard" } },
      },
      metrics: {
        current: { distanceMeters: 99706.6, durationSeconds: 5292.1, remainingRouteMinutes: 88.20166666666667, estimatedCompletionAt: "2026-08-28T10:28:12.100Z" },
        proposed: { distanceMeters: 80298.9, durationSeconds: 5282.5, remainingRouteMinutes: 88.04166666666667, estimatedCompletionAt: "2026-08-28T10:28:02.500Z" },
      },
      createdAt: "2026-08-28T09:00:00.000Z",
      admittedRouteSourceRevision: "688161cb725d59117a55243b78e41b8191e5b0d718f7eff0c51fe783e680fdd0",
      admittedRouteDigest: "sha256:33ce42625f7ff7bb1497ff6cb8ee9fb6bd2883c591bb936b780d31ae290dca18",
      fingerprint: "sha256:8f1d35ff329fdd549ac9a5cf29dd918f848dcaa7465ef5bdccbeff7091f21b13",
    });
    expect(status).toStrictEqual({ scenarioRevision: 1, workflowStatus: "STAGED", incident: { id: "incident-route-011-restriction-height-3.9", vehicleId: "vehicle-011", riskId: "restriction-height-3.9", routeId: "route-011", status: "OPEN" }, plan, approvalGrant: null, executionRecord: null, executionEffects: [], verificationReport: null, receipt: null });
    expect(plan.fingerprint).toBe("sha256:8f1d35ff329fdd549ac9a5cf29dd918f848dcaa7465ef5bdccbeff7091f21b13");
    expectDeepFrozen(plan);
    expectDeepFrozen(status);
    expect(app.operations.scenarioCurrent()).toStrictEqual(scenarioBefore);
  });

  it("should return the exact existing plan after revalidation without additional digests or transitions", async () => {
    let digestCalls = 0;
    const cryptoCapability: Sha256Crypto = { digest: async (bytes) => { digestCalls += 1; return globalThis.crypto.subtle.digest("SHA-256", bytes); } };
    const app = application({ cryptoCapability });
    let transitionCount = 0;
    const unsubscribe = app.operational.subscribe(() => { transitionCount += 1; });

    const first = success(await app.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" }));
    const second = success(await app.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" }));
    unsubscribe();

    expect(second).toStrictEqual(first);
    expect(second).not.toBe(first);
    expectDeepFrozen(first);
    expectDeepFrozen(second);
    expect(digestCalls).toBe(5);
    expect(transitionCount).toBe(1);
    expect(success(app.recoveryAgent.planStatus()).scenarioRevision).toBe(1);
  });

  it("property: changing every plan payload leaf should change its SHA-256 fingerprint", async () => {
    const { plan } = await stagedPlan();
    const payload = payloadFrom(plan);
    const paths = leafPaths(payload);

    for (const path of paths) {
      const changed = success(await sha256Fingerprint(changeAtPath(payload, path)));
      expect(changed, path.join(".")).not.toBe(plan.fingerprint);
    }
    expect(paths.length).toBeGreaterThan(35);
  });

  it.each([
    ["clearance FAIL", (result: Unit211PreDispatchContextResult) => { if (result.ok) result.data.options[1].provenance.avoidance.minimumClearanceMeters = 0.1; }, "SAFETY_EVIDENCE_FAILED"],
    ["clearance UNKNOWN", (result: Unit211PreDispatchContextResult) => { if (result.ok) Reflect.set(result.data.options[1].provenance.avoidance, "minimumClearanceMeters", Number.NaN); }, "SAFETY_EVIDENCE_UNKNOWN"],
    ["avoidance FAIL", (result: Unit211PreDispatchContextResult) => { if (result.ok) Reflect.set(result.data.options[1], "avoidsExclusionZone", false); }, "SAFETY_EVIDENCE_FAILED"],
    ["avoidance UNKNOWN", (result: Unit211PreDispatchContextResult) => { if (result.ok) Reflect.deleteProperty(result.data.options[1], "avoidsExclusionZone"); }, "SAFETY_EVIDENCE_UNKNOWN"],
    ["temporal FAIL", (result: Unit211PreDispatchContextResult) => { if (result.ok) Reflect.set(result.data.options[1].temporalAssessment, "status", "FAIL"); }, "SAFETY_EVIDENCE_FAILED"],
    ["temporal UNKNOWN", (result: Unit211PreDispatchContextResult) => { if (result.ok) Reflect.set(result.data.options[1].temporalAssessment, "status", "UNKNOWN"); }, "SAFETY_EVIDENCE_UNKNOWN"],
    ["cargo FAIL", (result: Unit211PreDispatchContextResult) => { if (result.ok) Reflect.set(result.data.options[1].cargoContinuityAssessment, "status", "FAIL"); }, "SAFETY_EVIDENCE_FAILED"],
    ["cargo UNKNOWN", (result: Unit211PreDispatchContextResult) => { if (result.ok) Reflect.set(result.data.options[1].cargoContinuityAssessment, "status", "UNKNOWN"); }, "SAFETY_EVIDENCE_UNKNOWN"],
  ])("should fail closed for proposed %s evidence", async (_label, mutate, expectedCode) => {
    const { repository, result } = mutableComparison();
    mutate(result);
    const agent = createRecoveryAgentCapability(repository, comparisonReader(result));

    const stage = await agent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" });

    expect(failureCode(stage)).toBe(expectedCode);
    expect(success(repository.operationalRead()).plan).toBeNull();
  });

  it("should reject a recomputed plan fingerprint with a mismatched admitted route digest", async () => {
    const { plan } = await stagedPlan();
    const payload: RecoveryPlanPayload = { ...payloadFrom(plan), admittedRouteDigest: `sha256:${"0".repeat(64)}` };
    const fingerprint = success(await sha256Fingerprint(payload));
    const repository = createZustandScenarioRepository(new MemoryStorage());

    const result = await repository.operationalStage({ expectedScenarioRevision: 1, plan: { ...payload, fingerprint } });

    expect(failureCode(result)).toBe("PLAN_MISMATCH");
    expect(success(repository.operationalRead()).plan).toBeNull();
  });

  it.each([
    ["FAIL", "FAIL", "SAFETY_EVIDENCE_FAILED"],
    ["UNKNOWN", "UNKNOWN", "SAFETY_EVIDENCE_UNKNOWN"],
  ] as const)("should revalidate an existing plan when fresh cargo evidence becomes %s", async (_label, status, expectedCode) => {
    let digestCalls = 0;
    const cryptoCapability: Sha256Crypto = { digest: async (bytes) => { digestCalls += 1; return globalThis.crypto.subtle.digest("SHA-256", bytes); } };
    const repository = createZustandScenarioRepository(new MemoryStorage(), cryptoCapability);
    const operations = createOperationsApi(repository, { readAlternativeCatalog: () => clearanceAlternativeCatalog, admittedAlternativeCatalog: clearanceAlternativeCatalog });
    const result = structuredClone(operations.unit211PreDispatchContext());
    const agent = createRecoveryAgentCapability(repository, comparisonReader(result), cryptoCapability);
    const plan = success(await agent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" }));
    if (!result.ok) throw new Error("Expected an authoritative comparison.");
    Reflect.set(result.data.options[1].cargoContinuityAssessment, "status", status);

    const repeated = await agent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" });

    expect(failureCode(repeated)).toBe(expectedCode);
    expect(digestCalls).toBe(4);
    expect(success(repository.operationalRead()).plan).toStrictEqual(plan);
  });

  it("should reject an existing plan when the admitted catalog metrics change after staging", async () => {
    const catalog = structuredClone(clearanceAlternativeCatalog);
    const app = application({ readAlternativeCatalog: () => catalog, admittedAlternativeCatalog: catalog });
    const plan = success(await app.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" }));
    Reflect.set(catalog.summary, "distanceMeters", 80299);

    const repeated = await app.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" });

    expect(failureCode(repeated)).toBe("PLAN_MISMATCH");
    expect(success(app.recoveryAgent.planStatus()).plan).toStrictEqual(plan);
  });

  it("should reject the existing-plan fast path when revision changes during fresh comparison", async () => {
    const { repository, result } = mutableComparison();
    let comparisonReads = 0;
    const agent = createRecoveryAgentCapability(repository, () => {
      comparisonReads += 1;
      if (comparisonReads === 2) success(repository.operationalInvalidateForScenarioMutation({ expectedScenarioRevision: 1, mutation: "CATALOG" }));
      return structuredClone(result);
    });
    success(await agent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" }));

    const repeated = await agent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" });

    expect(failureCode(repeated)).toBe("REVISION_MISMATCH");
    expect(success(repository.operationalRead()).workflowStatus).toBe("INVALIDATED");
  });

  it("should leave no plan when crypto is unavailable or rejects", async () => {
    const unavailable = application({ cryptoCapability: null });
    const rejecting = application({ cryptoCapability: { digest: async () => { throw new Error("rejected"); } } });

    expect(failureCode(await unavailable.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" }))).toBe("CRYPTO_UNAVAILABLE");
    expect(failureCode(await rejecting.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" }))).toBe("CRYPTO_FAILURE");
    expect(success(unavailable.recoveryAgent.planStatus()).plan).toBeNull();
    expect(success(rejecting.recoveryAgent.planStatus()).plan).toBeNull();
  });

  it("should reject an async stage CAS after a concurrent relevant vehicle deletion", async () => {
    let digestBytes: Uint8Array<ArrayBuffer> | undefined;
    let resolveDigest: ((value: ArrayBuffer) => void) | undefined;
    let digestCalls = 0;
    let markStarted = (): void => undefined;
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    const cryptoCapability: Sha256Crypto = { digest: (bytes) => {
      digestCalls += 1;
      if (digestCalls !== 3) return globalThis.crypto.subtle.digest("SHA-256", bytes);
      digestBytes = bytes;
      markStarted();
      return new Promise((resolve) => { resolveDigest = resolve; });
    } };
    const app = application({ cryptoCapability });

    const staging = app.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" });
    await started;
    if (digestBytes === undefined || resolveDigest === undefined) throw new Error("The digest did not start.");
    const deleted = app.operations.vehicleDelete("vehicle-001");
    resolveDigest(await globalThis.crypto.subtle.digest("SHA-256", digestBytes));
    const result = await staging;

    expect(deleted.ok).toBe(true);
    expect(failureCode(result)).toBe("REVISION_MISMATCH");
    expect(success(app.recoveryAgent.planStatus())).toMatchObject({ scenarioRevision: 2, workflowStatus: "IDLE", plan: null, approvalGrant: null });
  });
});

describe("recovery review and human authority", () => {
  it("should request review idempotently, reject wrong plans and states, and never downgrade approval", async () => {
    const { app, plan } = await stagedPlan();

    expect(failureCode(app.recoveryAgent.requestReview({ planId: "wrong-plan" }))).toBe("PLAN_MISMATCH");
    const requested = success(app.recoveryAgent.requestReview({ planId: plan.planId }));
    const repeated = success(app.recoveryAgent.requestReview({ planId: plan.planId }));
    const grant = success(app.recoveryHuman.approvePlan({ planId: plan.planId }));
    const afterApprovalRequest = success(app.recoveryAgent.requestReview({ planId: plan.planId }));

    expect(requested.workflowStatus).toBe("REVIEW_REQUESTED");
    expect(repeated).toStrictEqual(requested);
    expect(grant).toStrictEqual({ planId: plan.planId, fingerprint: plan.fingerprint, scenarioRevision: 1, approvedAt: plan.createdAt, approvedBy: "human-ui", used: false });
    expect(afterApprovalRequest.workflowStatus).toBe("APPROVED");
    expect(afterApprovalRequest.approvalGrant).toStrictEqual(grant);
  });

  it("should reject review requests from IDLE and REJECTED states", async () => {
    const app = application();
    expect(failureCode(app.recoveryAgent.requestReview({ planId: "missing-plan" }))).toBe("PLAN_MISMATCH");
    const plan = success(await app.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" }));
    success(app.recoveryHuman.rejectPlan({ planId: plan.planId }));

    expect(failureCode(app.recoveryAgent.requestReview({ planId: plan.planId }))).toBe("INVALID_WORKFLOW_STATE");
  });

  it("should make approval human-only, exact-bound, and idempotent", async () => {
    const { app, plan } = await stagedPlan();

    expect(failureCode(app.recoveryHuman.approvePlan({ planId: plan.planId }))).toBe("INVALID_WORKFLOW_STATE");
    app.recoveryAgent.requestReview({ planId: plan.planId });
    expect(failureCode(app.recoveryHuman.approvePlan({ planId: "wrong-plan" }))).toBe("PLAN_MISMATCH");
    const first = success(app.recoveryHuman.approvePlan({ planId: plan.planId }));
    const second = success(app.recoveryHuman.approvePlan({ planId: plan.planId }));

    expect(first).toStrictEqual(second);
    expect(first.fingerprint).toBe(plan.fingerprint);
    expect(first.scenarioRevision).toBe(plan.basedOnScenarioRevision);
  });

  it("should reject plans stably and remove approval without changing route or incident", async () => {
    const { app, plan } = await stagedPlan();
    app.recoveryAgent.requestReview({ planId: plan.planId });
    app.recoveryHuman.approvePlan({ planId: plan.planId });
    const scenarioBefore = app.operations.scenarioCurrent();

    const first = success(app.recoveryHuman.rejectPlan({ planId: plan.planId }));
    const second = success(app.recoveryHuman.rejectPlan({ planId: plan.planId }));

    expect(first).toStrictEqual(second);
    expect(first.workflowStatus).toBe("REJECTED");
    expect(first.approvalGrant).toBeNull();
    expect(first.incident.status).toBe("OPEN");
    expect(app.operations.scenarioCurrent()).toStrictEqual(scenarioBefore);
  });

  it("should increment revision and invalidate an approved grant after relevant deletion while cosmetic rename stays non-relevant", async () => {
    const { app, plan } = await stagedPlan();
    app.recoveryAgent.requestReview({ planId: plan.planId });
    app.recoveryHuman.approvePlan({ planId: plan.planId });

    const renamed = app.operations.vehicleRename({ vehicleId: "vehicle-001", label: "Cosmetic Label" });
    const afterRename = success(app.recoveryAgent.planStatus());
    const deleted = app.operations.vehicleDelete("vehicle-002");
    const afterDelete = success(app.recoveryAgent.planStatus());

    expect(renamed.ok).toBe(true);
    expect(afterRename).toMatchObject({ scenarioRevision: 1, workflowStatus: "APPROVED", approvalGrant: { planId: plan.planId } });
    expect(deleted.ok).toBe(true);
    expect(afterDelete).toMatchObject({ scenarioRevision: 2, workflowStatus: "INVALIDATED", plan: { planId: plan.planId }, approvalGrant: null });
  });

  it("should keep scenario and recovery state unchanged when persistence rejects a relevant deletion", async () => {
    const app = createRecoveryApplication({ storage: new RejectingStorage() });
    const plan = success(await app.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" }));
    success(app.recoveryAgent.requestReview({ planId: plan.planId }));
    success(app.recoveryHuman.approvePlan({ planId: plan.planId }));
    const scenarioBefore = app.operations.scenarioCurrent();
    const recoveryBefore = success(app.recoveryAgent.planStatus());

    const deletion = app.operations.vehicleDelete("vehicle-001");

    expect(deletion).toStrictEqual({ ok: false, error: { code: "vehicle-not-found", message: "Vehicle vehicle-001 was not found." } });
    expect(app.operations.scenarioCurrent()).toStrictEqual(scenarioBefore);
    expect(success(app.recoveryAgent.planStatus())).toStrictEqual(recoveryBefore);
  });

  it("should expose a semantic repository invalidation seam and detached subscriptions", () => {
    const repository = createZustandScenarioRepository(new MemoryStorage());
    const received: OperationalRecoverySnapshot[] = [];
    const unsubscribe = repository.operationalSubscribe((snapshot) => { received.push(snapshot); });

    const result = repository.operationalInvalidateForScenarioMutation({ expectedScenarioRevision: 1, mutation: "TIMING" });
    const stale = repository.operationalInvalidateForScenarioMutation({ expectedScenarioRevision: 1, mutation: "ROUTE" });
    unsubscribe();

    expect(success(result).scenarioRevision).toBe(2);
    expect(failureCode(stale)).toBe("REVISION_MISMATCH");
    expect(received).toHaveLength(1);
    expect(received[0]).not.toBe(success(result));
    expect(Object.isFrozen(received[0])).toBe(true);
  });
});

describe("recovery fail-closed boundaries", () => {
  it("should structure repository read, write, and malformed-data failures without partial state", async () => {
    const { repository, result } = mutableComparison();
    const throwingRead: OperationalRecoveryRepository = { ...repository, operationalRead: () => { throw new Error("read failed"); } };
    const malformedRead: OperationalRecoveryRepository = { ...repository, operationalRead: () => ({ ok: true, data: { scenarioRevision: 1 } }) as unknown as RecoveryResult<OperationalRecoverySnapshot> };
    const throwingWrite: OperationalRecoveryRepository = { ...repository, operationalStage: () => { throw new Error("write failed"); } };

    expect(failureCode(createRecoveryAgentCapability(throwingRead, comparisonReader(result)).planStatus())).toBe("REPOSITORY_FAILURE");
    expect(failureCode(createRecoveryAgentCapability(malformedRead, comparisonReader(result)).planStatus())).toBe("MALFORMED_REPOSITORY_DATA");
    expect(failureCode(await createRecoveryAgentCapability(throwingWrite, comparisonReader(result)).stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" }))).toBe("REPOSITORY_FAILURE");
    expect(success(repository.operationalRead()).plan).toBeNull();
  });

  it("should reject every malformed workflow snapshot invariant", async () => {
    const { app, plan } = await stagedPlan();
    success(app.recoveryAgent.requestReview({ planId: plan.planId }));
    const grant = success(app.recoveryHuman.approvePlan({ planId: plan.planId }));
    const initial = success(application().recoveryAgent.planStatus());
    const staged = { ...initial, workflowStatus: "STAGED", plan } as const;
    const review = { ...staged, workflowStatus: "REVIEW_REQUESTED" } as const;
    const approved = { ...staged, workflowStatus: "APPROVED", approvalGrant: grant } as const;
    const rejected = { ...staged, workflowStatus: "REJECTED" } as const;
    const invalidated = { ...staged, scenarioRevision: 2, workflowStatus: "INVALIDATED" } as const;
    const malformedPlan = { ...plan, metrics: { ...plan.metrics, proposed: { ...plan.metrics.proposed, distanceMeters: 1 } } };
    const cases: readonly [string, unknown][] = [
      ["zero revision", { ...initial, scenarioRevision: 0 }],
      ["unsafe revision", { ...initial, scenarioRevision: Number.MAX_SAFE_INTEGER + 1 }],
      ["wrong incident identity", { ...initial, incident: { ...initial.incident, vehicleId: "vehicle-001" } }],
      ["extra incident field", { ...initial, incident: { ...initial.incident, extra: true } }],
      ["IDLE plan", { ...initial, plan }],
      ["IDLE grant", { ...initial, approvalGrant: grant }],
      ["STAGED without plan", { ...staged, plan: null }],
      ["STAGED with grant", { ...staged, approvalGrant: grant }],
      ["STAGED stale revision", { ...staged, scenarioRevision: 2 }],
      ["REVIEW_REQUESTED without plan", { ...review, plan: null }],
      ["REVIEW_REQUESTED with grant", { ...review, approvalGrant: grant }],
      ["APPROVED without plan", { ...approved, plan: null }],
      ["APPROVED without grant", { ...approved, approvalGrant: null }],
      ["APPROVED wrong grant plan", { ...approved, approvalGrant: { ...grant, planId: "wrong" } }],
      ["APPROVED wrong grant fingerprint", { ...approved, approvalGrant: { ...grant, fingerprint: `sha256:${"0".repeat(64)}` } }],
      ["APPROVED wrong grant revision", { ...approved, approvalGrant: { ...grant, scenarioRevision: 2 } }],
      ["APPROVED used grant", { ...approved, approvalGrant: { ...grant, used: true } }],
      ["APPROVED extra grant field", { ...approved, approvalGrant: { ...grant, extra: true } }],
      ["REJECTED without plan", { ...rejected, plan: null }],
      ["REJECTED with grant", { ...rejected, approvalGrant: grant }],
      ["INVALIDATED without plan", { ...invalidated, plan: null }],
      ["INVALIDATED current plan revision", { ...invalidated, scenarioRevision: plan.basedOnScenarioRevision }],
      ["INVALIDATED with grant", { ...invalidated, approvalGrant: grant }],
      ["non-authoritative plan", { ...staged, plan: malformedPlan }],
      ["extra snapshot field", { ...initial, extra: true }],
    ];

    for (const [label, candidate] of cases) {
      const agent = createRecoveryAgentCapability(repositoryReturning({ ok: true, data: candidate }), () => ({ ok: false, reasonCode: "SCENARIO_INVALID" }));
      expect(failureCode(agent.planStatus()), label).toBe("MALFORMED_REPOSITORY_DATA");
    }
  });

  it("should reject malformed repository result and failure envelopes", () => {
    const initial = success(application().recoveryAgent.planStatus());
    const validFailure = { ok: false, error: { code: "REPOSITORY_FAILURE", message: "Repository failed.", actions: ["RETRY"] } };
    const sparseActions = Array(2);
    sparseActions[0] = "RETRY";
    const cases: readonly [string, unknown][] = [
      ["success extra key", { ok: true, data: initial, extra: true }],
      ["success missing data", { ok: true }],
      ["success wrong payload", { ok: true, data: { scenarioRevision: 1 } }],
      ["failure extra key", { ...validFailure, extra: true }],
      ["error extra key", { ok: false, error: { ...validFailure.error, extra: true } }],
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
    expect(tools.map(({ name }) => name)).toStrictEqual(["scenario_current", "fleet_status", "vehicle_get", "vehicle_rename"]);
    expect(tools.some(({ name }) => /approve|reject|reset|execute|recovery/i.test(name))).toBe(false);
  });

  it("should reject exact-key human inputs and keep human methods absent from the agent capability", async () => {
    const { app, plan } = await stagedPlan();
    app.recoveryAgent.requestReview({ planId: plan.planId });

    expect(failureCode(app.recoveryHuman.approvePlan({ planId: plan.planId, approvedBy: "agent" }))).toBe("INVALID_INPUT");
    expect(failureCode(app.recoveryHuman.rejectPlan({ planId: " " }))).toBe("INVALID_INPUT");
    expect(Reflect.has(app.recoveryAgent, "approvePlan")).toBe(false);
    expect(Reflect.has(app.recoveryAgent, "rejectPlan")).toBe(false);
    expect(Reflect.has(app.recoveryAgent, "invalidatePlan")).toBe(false);
  });

  it("should keep repository transitions guarded against stale revisions and malformed plans", async () => {
    const { repository, result } = mutableComparison();
    const agent = createRecoveryAgentCapability(repository, comparisonReader(result));
    const plan = success(await agent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" }));
    const malformed = { ...plan, fingerprint: "sha256:invalid" } as RecoveryPlan;

    expect(failureCode(repository.operationalRequestReview({ expectedScenarioRevision: 0, planId: plan.planId }))).toBe("REVISION_MISMATCH");
    repository.operationalInvalidateForScenarioMutation({ expectedScenarioRevision: 1, mutation: "ROUTE" });
    expect(failureCode(await repository.operationalStage({ expectedScenarioRevision: 2, plan: malformed }))).toBe("PLAN_MISMATCH");
    expect(success(repository.operationalRead()).workflowStatus).toBe("INVALIDATED");
  });

  it("should reject every retained-fingerprint payload tamper without writing a plan", async () => {
    const { plan } = await stagedPlan();
    const payload = payloadFrom(plan);

    const repository = createZustandScenarioRepository(new MemoryStorage());
    for (const path of leafPaths(payload)) {
      const tampered: RecoveryPlan = { ...changeAtPath(payload, path), fingerprint: plan.fingerprint };
      const result = await repository.operationalStage({ expectedScenarioRevision: 1, plan: tampered });

      expect(failureCode(result), path.join(".")).toBe("PLAN_MISMATCH");
      expect(success(repository.operationalRead()).plan, path.join(".")).toBeNull();
    }
  });

  it.each([
    ["metrics", ["metrics", "proposed", "distanceMeters"]],
    ["results", ["constraintResults", "proposedTemporal", "remainingRouteMinutes"]],
    ["routes", ["proposedRouteId"]],
  ] as const)("should reject recomputed but non-authoritative %s", async (_label, path) => {
    const { plan } = await stagedPlan();
    const changedPayload = changeAtPath(payloadFrom(plan), path);
    const fingerprint = success(await sha256Fingerprint(changedPayload));
    const changedPlan: RecoveryPlan = { ...changedPayload, fingerprint };
    const repository = createZustandScenarioRepository(new MemoryStorage());

    const result = await repository.operationalStage({ expectedScenarioRevision: 1, plan: changedPlan });

    expect(failureCode(result)).toBe("PLAN_MISMATCH");
    expect(success(repository.operationalRead()).plan).toBeNull();
  });

  it("should not treat a colliding fingerprint with different complete payload as repository idempotence", async () => {
    const cryptoCapability = constantCrypto();
    const app = application({ cryptoCapability });
    const plan = success(await app.recoveryAgent.stagePlan({ selectedOptionId: "alternative-route-011-clearance-v1" }));
    const differentPayload = changeAtPath(payloadFrom(plan), ["metrics", "proposed", "durationSeconds"]);
    const collidingPlan: RecoveryPlan = { ...differentPayload, fingerprint: plan.fingerprint };
    const repository = createZustandScenarioRepository(new MemoryStorage(), cryptoCapability);
    success(await repository.operationalStage({ expectedScenarioRevision: 1, plan }));

    const result = await repository.operationalStage({ expectedScenarioRevision: 1, plan: collidingPlan });

    expect(failureCode(result)).toBe("PLAN_MISMATCH");
    expect(success(repository.operationalRead()).plan).toStrictEqual(plan);
  });

  it("should leave repository state untouched when its own crypto capability fails", async () => {
    const { plan } = await stagedPlan();
    const rejecting = createZustandScenarioRepository(new MemoryStorage(), { digest: async () => { throw new Error("repository digest rejected"); } });
    const unavailable = createZustandScenarioRepository(new MemoryStorage(), null);

    expect(failureCode(await rejecting.operationalStage({ expectedScenarioRevision: 1, plan }))).toBe("CRYPTO_FAILURE");
    expect(failureCode(await unavailable.operationalStage({ expectedScenarioRevision: 1, plan }))).toBe("CRYPTO_UNAVAILABLE");
    expect(success(rejecting.operationalRead()).plan).toBeNull();
    expect(success(unavailable.operationalRead()).plan).toBeNull();
  });

  it("should perform the repository revision CAS again after its asynchronous digest", async () => {
    const { plan } = await stagedPlan();
    let digestBytes: Uint8Array<ArrayBuffer> | undefined;
    let resolveDigest: ((value: ArrayBuffer) => void) | undefined;
    let markStarted = (): void => undefined;
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    let digestCalls = 0;
    const cryptoCapability: Sha256Crypto = { digest: (bytes) => {
      digestCalls += 1;
      if (digestCalls !== 1) return globalThis.crypto.subtle.digest("SHA-256", bytes);
      digestBytes = bytes;
      markStarted();
      return new Promise((resolve) => { resolveDigest = resolve; });
    } };
    const repository = createZustandScenarioRepository(new MemoryStorage(), cryptoCapability);

    const staging = repository.operationalStage({ expectedScenarioRevision: 1, plan });
    await started;
    if (digestBytes === undefined || resolveDigest === undefined) throw new Error("The repository digest did not start.");
    success(repository.operationalInvalidateForScenarioMutation({ expectedScenarioRevision: 1, mutation: "RISK" }));
    resolveDigest(await globalThis.crypto.subtle.digest("SHA-256", digestBytes));
    const result = await staging;

    expect(failureCode(result)).toBe("REVISION_MISMATCH");
    expect(success(repository.operationalRead())).toMatchObject({ scenarioRevision: 2, workflowStatus: "IDLE", plan: null, approvalGrant: null });
  });

  it("should keep approval and rejection exclusively on the human capability factory", () => {
    const repository = createZustandScenarioRepository(new MemoryStorage());
    const human = createRecoveryHumanCapability(repository);

    expect(Object.keys(human).sort()).toStrictEqual(["approvePlan", "rejectPlan"]);
  });
});
