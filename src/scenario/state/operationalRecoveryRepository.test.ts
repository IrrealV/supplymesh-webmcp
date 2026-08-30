import { describe, expect, it } from "vitest";
import type {
  ApprovalGrant,
  OperationReceipt,
  RecoveryPlan,
  RecoveryResult,
} from "../../domain/recovery/types";
import type { OperationalRecoveryRepository } from "../../domain/ports/OperationalRecoveryRepository";
import {
  SCENARIO_OVERRIDES_STORAGE_KEY,
  type StorageLike,
} from "../persistence/overrideStorage";
import { createUnit211RecoveryFixture } from "../recovery/createUnit211RecoveryFixture";
import { verifyUnit211Recovery } from "../recovery/verifyUnit211Recovery";
import { createZustandOperationalRecoveryRepository } from "./createZustandOperationalRecoveryRepository";

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function expectSuccess<T>(result: RecoveryResult<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(`Expected success, received ${result.error.code}.`);
  }
  return result.data;
}

function expectFailure<T>(result: RecoveryResult<T>, code: string): void {
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("Expected recovery operation to fail.");
  }
  expect(result.error.code).toBe(code);
}

function approvePlan(repository: OperationalRecoveryRepository): {
  approval: ApprovalGrant;
  plan: RecoveryPlan;
} {
  const options = expectSuccess(repository.recoveryOptionsCompare());
  const selected = options.find(({ kind }) => kind === "ALTERNATIVE_ROUTE");
  if (selected === undefined) {
    throw new Error("Alternative option missing.");
  }
  const plan = expectSuccess(repository.recoveryPlanStage({
    selectedOptionId: selected.id,
  }));
  expectSuccess(repository.recoveryPlanRequestReview({ planId: plan.id }));
  const approval = expectSuccess(repository.recoveryPlanApprove({ planId: plan.id }));
  return { approval, plan };
}

function executeApproved(
  repository: OperationalRecoveryRepository,
  approval: ApprovalGrant,
): RecoveryResult<OperationReceipt> {
  return repository.recoveryPlanExecute({
    fingerprint: approval.fingerprint,
    planId: approval.planId,
    proposedRouteId: approval.proposedRouteId,
    vehicleId: approval.vehicleId,
  });
}

describe("authoritative operational recovery repository", () => {
  it("should return defensive snapshots and subscribe without exposing Zustand authority", () => {
    const repository = createZustandOperationalRecoveryRepository(new MemoryStorage());
    const leaked = repository.recoverySnapshot();
    const receivedRevisions: number[] = [];
    const unsubscribe = repository.subscribeRecovery((snapshot) => {
      receivedRevisions.push(snapshot.scenarioRevision);
      snapshot.constraints.clearanceBufferMeters.value = 0.9;
    });

    leaked.constraints.clearanceBufferMeters.value = 0.8;
    leaked.scenario.vehicles[10].routeProgress = 0.5;
    expectSuccess(repository.recoveryOptionsCompare());
    unsubscribe();
    expectSuccess(repository.clearanceBufferSet({ clearanceBufferMeters: 0.3 }));

    const authoritative = repository.recoverySnapshot();
    expect(authoritative.constraints.clearanceBufferMeters.value).toBe(0.3);
    expect(authoritative.scenario.vehicles[10].routeProgress).toBe(0);
    expect(receivedRevisions).toStrictEqual([1]);
  });

  it("should stage and review a plan without advancing revision or mutating the active route", () => {
    const repository = createZustandOperationalRecoveryRepository(new MemoryStorage());
    const before = repository.recoverySnapshot();
    const options = expectSuccess(repository.recoveryOptionsCompare());
    const alternative = options.find(({ kind }) => kind === "ALTERNATIVE_ROUTE");
    if (alternative === undefined) {
      throw new Error("Alternative option missing.");
    }

    const plan = expectSuccess(repository.recoveryPlanStage({
      selectedOptionId: alternative.id,
    }));
    const reviewed = expectSuccess(
      repository.recoveryPlanRequestReview({ planId: plan.id }),
    );
    const after = repository.recoverySnapshot();

    expect(plan).toMatchObject({
      basedOnScenarioRevision: 1,
      currentRouteId: "route-011",
      incidentId: "incident-unit-211-clearance-v1",
      proposedRouteId: "alternative-route-011-clearance-v1",
      status: "STAGED",
      vehicleId: "vehicle-011",
    });
    expect(plan.fingerprint).toMatch(/^fnv1a64:[a-f0-9]{16}$/);
    expect(reviewed.status).toBe("REVIEW_REQUESTED");
    expect(after.scenarioRevision).toBe(before.scenarioRevision);
    expect(after.scenario.vehicles[10].routeId).toBe("route-011");
    expect(after.incident.status).toBe("OPEN");
    expect(after.workflowState).toBe("REVIEW_REQUESTED");
  });

  it("should bind human-only approval to every execution authority field", () => {
    const repository = createZustandOperationalRecoveryRepository(new MemoryStorage());
    const { approval, plan } = approvePlan(repository);

    expect(approval).toStrictEqual({
      approvedAt: "2026-08-28T09:00:00.000Z",
      approvedBy: "human-ui",
      constraints: plan.constraints,
      currentRouteId: "route-011",
      fingerprint: plan.fingerprint,
      incidentId: "incident-unit-211-clearance-v1",
      planId: plan.id,
      proposedRouteId: "alternative-route-011-clearance-v1",
      scenarioRevision: 1,
      selectedOptionId: "option-alternative-route-011-clearance-v1",
      used: false,
      vehicleId: "vehicle-011",
    });
    expect(repository.recoverySnapshot().scenarioRevision).toBe(1);
    expect(repository.recoverySnapshot().workflowState).toBe("APPROVED");
  });

  it("should atomically execute the approved route once and preserve cargo", () => {
    const repository = createZustandOperationalRecoveryRepository(new MemoryStorage());
    const before = repository.recoverySnapshot();
    const cargoBefore = structuredClone(before.scenario.vehicles[10].cargo);
    const { approval } = approvePlan(repository);

    const receipt = expectSuccess(executeApproved(repository, approval));
    const after = repository.recoverySnapshot();
    const vehicle = after.scenario.vehicles.find(
      ({ internalId }) => internalId === "vehicle-011",
    );

    expect(receipt).toMatchObject({
      afterRevision: 2,
      appliedRouteId: "alternative-route-011-clearance-v1",
      approvalFingerprint: approval.fingerprint,
      approvalSource: "human-ui",
      beforeRevision: 1,
      executedOnce: true,
      incidentId: "incident-unit-211-clearance-v1",
      previousRouteId: "route-011",
      vehicleId: "vehicle-011",
      verificationSummary: { reportId: "", status: "PENDING" },
    });
    expect(vehicle?.routeId).toBe("alternative-route-011-clearance-v1");
    expect(vehicle?.cargo).toStrictEqual(cargoBefore);
    expect(vehicle?.destination.name).toBe("Alcobendas");
    expect(after.scenario.routes.filter(
      ({ vehicleId }) => vehicleId === "vehicle-011",
    )).toHaveLength(1);
    expect(after.scenario.routes.some(({ id }) => id === "route-011")).toBe(false);
    expect(after.incident.status).toBe("RESOLVED");
    expect(after.approval?.used).toBe(true);
    expect(after.plan?.status).toBe("EXECUTED");
    expect(after.routeEffectCount).toBe(1);
    expect(after.scenarioRevision).toBe(2);
    expect(after.workflowState).toBe("EXECUTED");
    expect(after.auditTimeline.filter(
      ({ action }) => action === "RECOVERY_PLAN_EXECUTED",
    )).toHaveLength(1);
  });

  it("should reconcile a second execution to the stable receipt without duplicating effects", () => {
    const repository = createZustandOperationalRecoveryRepository(new MemoryStorage());
    const { approval } = approvePlan(repository);
    const first = expectSuccess(executeApproved(repository, approval));
    const firstSnapshot = repository.recoverySnapshot();
    const secondResult = executeApproved(repository, approval);
    const second = expectSuccess(secondResult);
    const secondSnapshot = repository.recoverySnapshot();

    expect(secondResult.ok && secondResult.code).toBe("ALREADY_EXECUTED");
    expect(second).toStrictEqual(first);
    expect(secondSnapshot).toStrictEqual(firstSnapshot);
    expect(secondSnapshot.routeEffectCount).toBe(1);
    expect(secondSnapshot.auditTimeline.filter(
      ({ action }) => action === "RECOVERY_PLAN_EXECUTED",
    )).toHaveLength(1);
  });


  it("should keep approved and terminal workflow authority closed against reopening", () => {
    const approvedRepository = createZustandOperationalRecoveryRepository(
      new MemoryStorage(),
    );
    approvePlan(approvedRepository);
    const approvedBefore = approvedRepository.recoverySnapshot();

    expectFailure(
      approvedRepository.recoveryOptionsCompare(),
      "WORKFLOW_LOCKED",
    );
    expect(approvedRepository.recoverySnapshot()).toStrictEqual(approvedBefore);

    const terminalRepository = createZustandOperationalRecoveryRepository(
      new MemoryStorage(),
    );
    const terminalApproval = approvePlan(terminalRepository).approval;
    expectSuccess(executeApproved(terminalRepository, terminalApproval));
    expectSuccess(terminalRepository.recoveryVerify({
      planId: terminalApproval.planId,
    }));
    const terminalBefore = terminalRepository.recoverySnapshot();
    const selectedOptionId = terminalBefore.plan?.selectedOptionId;
    if (selectedOptionId === undefined) {
      throw new Error("Executed plan missing.");
    }

    expectFailure(
      terminalRepository.recoveryOptionsCompare(),
      "WORKFLOW_COMPLETE",
    );
    expectFailure(
      terminalRepository.recoveryPlanStage({ selectedOptionId }),
      "WORKFLOW_COMPLETE",
    );
    expect(terminalRepository.recoverySnapshot()).toStrictEqual(terminalBefore);
  });

  it("should reconcile post-verification execution to the one current receipt", () => {
    const repository = createZustandOperationalRecoveryRepository(new MemoryStorage());
    const { approval } = approvePlan(repository);
    const executedReceipt = expectSuccess(executeApproved(repository, approval));
    expectSuccess(repository.recoveryVerify({ planId: approval.planId }));
    const currentReceipt = expectSuccess(
      repository.operationReceiptGet({ planId: approval.planId }),
    );
    const beforeReplay = repository.recoverySnapshot();

    const replayResult = executeApproved(repository, approval);
    const replayedReceipt = expectSuccess(replayResult);

    expect(replayResult.ok && replayResult.code).toBe("ALREADY_EXECUTED");
    expect(replayedReceipt).toStrictEqual(currentReceipt);
    expect(replayedReceipt.receiptId).toBe(executedReceipt.receiptId);
    expect(repository.recoverySnapshot()).toStrictEqual(beforeReplay);
  });

  it("should fail closed for tampered fingerprint, route, or vehicle arguments", () => {
    const cases = [
      {
        code: "FINGERPRINT_MISMATCH",
        mutate: (approval: ApprovalGrant) => ({
          fingerprint: "fnv1a64:0000000000000000",
          planId: approval.planId,
          proposedRouteId: approval.proposedRouteId,
          vehicleId: approval.vehicleId,
        }),
      },
      {
        code: "PLAN_BINDING_MISMATCH",
        mutate: (approval: ApprovalGrant) => ({
          fingerprint: approval.fingerprint,
          planId: approval.planId,
          proposedRouteId: "route-attacker",
          vehicleId: approval.vehicleId,
        }),
      },
      {
        code: "WRONG_VEHICLE",
        mutate: (approval: ApprovalGrant) => ({
          fingerprint: approval.fingerprint,
          planId: approval.planId,
          proposedRouteId: approval.proposedRouteId,
          vehicleId: "vehicle-001",
        }),
      },
    ];

    for (const testCase of cases) {
      const repository = createZustandOperationalRecoveryRepository(new MemoryStorage());
      const { approval } = approvePlan(repository);
      const before = repository.recoverySnapshot();

      expectFailure(repository.recoveryPlanExecute(testCase.mutate(approval)), testCase.code);
      expect(repository.recoverySnapshot()).toStrictEqual(before);
    }
  });

  it("should increment revision, invalidate approval, recompute options, and audit a buffer change", () => {
    const repository = createZustandOperationalRecoveryRepository(new MemoryStorage());
    const { approval } = approvePlan(repository);

    expectSuccess(repository.clearanceBufferSet({ clearanceBufferMeters: 0.3 }));
    const after = repository.recoverySnapshot();
    const alternative = after.options.find(({ kind }) => kind === "ALTERNATIVE_ROUTE");

    expect(after.scenarioRevision).toBe(2);
    expect(after.constraints.clearanceBufferMeters.value).toBe(0.3);
    expect(after.workflowState).toBe("INVALIDATED");
    expect(after.plan?.status).toBe("INVALIDATED");
    expect(after.approval).toBeUndefined();
    expect(alternative?.validation.clearance.requiredClearanceMeters).toBe(4.1);
    expect(after.auditTimeline.at(-1)).toMatchObject({
      action: "CLEARANCE_BUFFER_CHANGED",
      actor: "human",
      reasonCode: "APPROVAL_INVALIDATED",
      scenarioRevision: 2,
    });

    const stale = executeApproved(repository, approval);
    expectFailure(stale, "APPROVAL_INVALIDATED");
    expect(repository.recoverySnapshot()).toStrictEqual(after);
  });

  it("should reject invalid or unchanged buffer inputs without unintended revision changes", () => {
    const repository = createZustandOperationalRecoveryRepository(new MemoryStorage());

    expectFailure(
      repository.clearanceBufferSet({ clearanceBufferMeters: 1.1 }),
      "INVALID_CONSTRAINT",
    );
    const unchanged = repository.clearanceBufferSet({ clearanceBufferMeters: 0.2 });

    expect(unchanged.ok && unchanged.code).toBe("CONSTRAINT_UNCHANGED");
    expect(repository.recoverySnapshot().scenarioRevision).toBe(1);
    expect(repository.recoverySnapshot().auditTimeline).toHaveLength(1);
  });

  it("should independently verify authoritative state and update the existing receipt", () => {
    const repository = createZustandOperationalRecoveryRepository(new MemoryStorage());
    const { approval } = approvePlan(repository);
    const executedReceipt = expectSuccess(executeApproved(repository, approval));

    const report = expectSuccess(
      repository.recoveryVerify({ planId: approval.planId }),
    );
    const after = repository.recoverySnapshot();

    expect(report.overall).toBe("PASS");
    expect(report.checks).toStrictEqual([
      { name: "clearance", reasonCode: "CLEARANCE_VERIFIED", status: "PASS" },
      { name: "restWindow", reasonCode: "REST_WINDOW_VERIFIED", status: "PASS" },
      { name: "cargoContinuity", reasonCode: "CARGO_CONTINUITY_VERIFIED", status: "PASS" },
      { name: "approvedFingerprint", reasonCode: "APPROVED_FINGERPRINT_VERIFIED", status: "PASS" },
      { name: "noDuplicateApplication", reasonCode: "SINGLE_ROUTE_EFFECT_VERIFIED", status: "PASS" },
      { name: "incidentResolved", reasonCode: "INCIDENT_RESOLUTION_VERIFIED", status: "PASS" },
    ]);
    expect(after.workflowState).toBe("VERIFIED");
    expect(after.scenarioRevision).toBe(2);
    expect(after.receipt?.receiptId).toBe(executedReceipt.receiptId);
    expect(after.receipt?.verificationSummary).toStrictEqual({
      reportId: report.id,
      status: "PASS",
    });
    expect(expectSuccess(
      repository.operationReceiptGet({ planId: approval.planId }),
    )).toStrictEqual(after.receipt);
  });

  it("should surface independent verification failures for tampering", () => {
    const repository = createZustandOperationalRecoveryRepository(new MemoryStorage());
    const { approval } = approvePlan(repository);
    expectSuccess(executeApproved(repository, approval));
    const baseline = createUnit211RecoveryFixture();

    const duplicated = repository.recoverySnapshot();
    duplicated.routeEffectCount = 2;
    const duplicateReport = verifyUnit211Recovery(duplicated, baseline);

    const cargoTampered = repository.recoverySnapshot();
    cargoTampered.scenario.vehicles[10].cargo.priority = "critical";
    const cargoReport = verifyUnit211Recovery(cargoTampered, baseline);

    const fingerprintTampered = repository.recoverySnapshot();
    if (fingerprintTampered.plan === undefined) {
      throw new Error("Executed plan missing.");
    }
    fingerprintTampered.plan.fingerprint = "fnv1a64:0000000000000000";
    const fingerprintReport = verifyUnit211Recovery(fingerprintTampered, baseline);


    const receiptTampered = repository.recoverySnapshot();
    if (receiptTampered.receipt === undefined) {
      throw new Error("Execution receipt missing.");
    }
    receiptTampered.receipt.planId = "recovery-plan-attacker";
    receiptTampered.receipt.appliedRouteId = "route-attacker";
    receiptTampered.receipt.constraints.clearanceBufferMeters.value = 0.9;
    const receiptReport = verifyUnit211Recovery(receiptTampered, baseline);

    expect(duplicateReport.overall).toBe("FAIL");
    expect(duplicateReport.checks.find(
      ({ name }) => name === "noDuplicateApplication",
    )?.status).toBe("FAIL");
    expect(cargoReport.checks.find(
      ({ name }) => name === "cargoContinuity",
    )?.status).toBe("FAIL");
    expect(fingerprintReport.checks.find(
      ({ name }) => name === "approvedFingerprint",
    )?.status).toBe("FAIL");
    expect(receiptReport.overall).toBe("FAIL");
    expect(receiptReport.checks.find(
      ({ name }) => name === "approvedFingerprint",
    )?.status).toBe("FAIL");
    expect(receiptReport.checks.find(
      ({ name }) => name === "noDuplicateApplication",
    )?.status).toBe("FAIL");
  });

  it("should reset the complete baseline at a new revision without clearing locale", () => {
    const storage = new MemoryStorage();
    storage.setItem("locale:v1", "es");
    const repository = createZustandOperationalRecoveryRepository(storage);
    const { approval } = approvePlan(repository);
    expectSuccess(executeApproved(repository, approval));
    expectSuccess(repository.recoveryVerify({ planId: approval.planId }));
    const beforeRevision = repository.recoverySnapshot().scenarioRevision;

    const reset = expectSuccess(repository.recoveryReset());
    const vehicle = reset.scenario.vehicles.find(
      ({ internalId }) => internalId === "vehicle-011",
    );

    expect(reset.scenarioRevision).toBe(beforeRevision + 1);
    expect(reset.workflowState).toBe("IDLE");
    expect(reset.options).toStrictEqual([]);
    expect(reset.plan).toBeUndefined();
    expect(reset.approval).toBeUndefined();
    expect(reset.verification).toBeUndefined();
    expect(reset.receipt).toBeUndefined();
    expect(reset.routeEffectCount).toBe(0);
    expect(vehicle).toMatchObject({ routeId: "route-011", routeProgress: 0 });
    expect(reset.incident.status).toBe("OPEN");
    expect(reset.constraints.clearanceBufferMeters.value).toBe(0.2);
    expect(reset.auditTimeline).toStrictEqual([{
      action: "DEMO_RESET",
      actor: "human",
      id: "audit-0001",
      result: "SUCCESS",
      scenarioRevision: beforeRevision + 1,
      sequence: 1,
      target: "unit-211-pre-dispatch-v1",
      timestamp: "2026-08-28T09:00:00.000Z",
    }]);
    expect(storage.getItem("locale:v1")).toBe("es");
    expect(storage.getItem(SCENARIO_OVERRIDES_STORAGE_KEY)).toBe(
      '{"version":1,"labels":{},"deletedVehicleIds":[]}',
    );
  });

  it("should keep receipts free of driver identity and stable after verification", () => {
    const repository = createZustandOperationalRecoveryRepository(new MemoryStorage());
    const { approval } = approvePlan(repository);
    expectSuccess(executeApproved(repository, approval));
    expectSuccess(repository.recoveryVerify({ planId: approval.planId }));
    const first = expectSuccess(
      repository.operationReceiptGet({ planId: approval.planId }),
    );
    const second = expectSuccess(
      repository.operationReceiptGet({ planId: approval.planId }),
    );
    const serialized = JSON.stringify(first);

    expect(second).toStrictEqual(first);
    expect(serialized).not.toContain("2785 YKC");
    expect(serialized.toLowerCase()).not.toContain("driver");
    expect(serialized).not.toContain("plate");
  });
});
