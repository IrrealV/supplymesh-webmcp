import { describe, expect, it } from "vitest";
import type { RecoveryResult } from "../domain/recovery/types";
import type { StorageLike } from "../scenario/persistence/overrideStorage";
import { createApplication } from "./createApplication";

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function expectRecoverySuccess<T>(result: RecoveryResult<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(`Expected success, received ${result.error.code}.`);
  }
  return result.data;
}

describe("Phase 3 application recovery composition", () => {
  it("should expose separate agent and human facades over one live authority", () => {
    const application = createApplication(new MemoryStorage());

    expect(Object.keys(application.recovery.agent).sort()).toStrictEqual([
      "incidentInspect",
      "operationReceiptGet",
      "operationsContext",
      "recoveryOptionsCompare",
      "recoveryPlanExecute",
      "recoveryPlanRequestReview",
      "recoveryPlanStage",
      "recoveryPlanStatus",
      "recoveryVerify",
    ]);
    expect(Object.keys(application.recovery.human).sort()).toStrictEqual([
      "clearanceBufferSet",
      "recoveryPlanApprove",
      "recoveryPlanReject",
      "recoveryReset",
    ]);
    expect("recoveryPlanApprove" in application.recovery.agent).toBe(false);
    expect("recoveryPlanReject" in application.recovery.agent).toBe(false);
    expect("clearanceBufferSet" in application.recovery.agent).toBe(false);
    expect("recoveryReset" in application.recovery.agent).toBe(false);

    const initialContext = expectRecoverySuccess(
      application.recovery.agent.operationsContext(),
    );
    expect(initialContext).toMatchObject({
      scenarioClock: {
        instant: "2026-08-28T09:00:00.000Z",
        mode: "deterministic-demo",
      },
      scenarioRevision: 1,
      snapshotLabel: "Deterministic demo snapshot",
      vehicle: {
        fleetNumber: "FM-211",
        label: "Unit 211",
        vehicleId: "vehicle-011",
      },
      workflowState: "IDLE",
    });
    const serialized = JSON.stringify(initialContext);
    expect(serialized).not.toContain("2785 YKC");
    expect(serialized.toLowerCase()).not.toContain("plate");
    expect(serialized.toLowerCase()).not.toContain("driver");

    const renamed = application.vehicleRename({
      label: "Toledo Recovery",
      vehicleId: "vehicle-011",
    });
    expect(renamed.ok).toBe(true);
    expect(expectRecoverySuccess(
      application.recovery.agent.operationsContext(),
    ).vehicle.label).toBe("Toledo Recovery");

    expectRecoverySuccess(
      application.recovery.human.clearanceBufferSet({
        clearanceBufferMeters: 0.3,
      }),
    );
    const currentContext = expectRecoverySuccess(
      application.recovery.agent.operationsContext(),
    );
    expect(currentContext.scenarioRevision).toBe(2);
    expect(currentContext.constraints.clearanceBufferMeters.value).toBe(0.3);
  });

  it("should compose the complete agent-human workflow against the legacy scenario API", () => {
    const application = createApplication(new MemoryStorage());
    const options = expectRecoverySuccess(
      application.recovery.agent.recoveryOptionsCompare(),
    );
    expect(options.every((option) => !("geometry" in option))).toBe(true);
    expect(JSON.stringify(options).length).toBeLessThan(10_000);
    const alternative = options.find(({ kind }) => kind === "ALTERNATIVE_ROUTE");
    if (alternative === undefined) {
      throw new Error("Alternative option missing.");
    }

    const plan = expectRecoverySuccess(
      application.recovery.agent.recoveryPlanStage({
        selectedOptionId: alternative.id,
      }),
    );
    expectRecoverySuccess(
      application.recovery.agent.recoveryPlanRequestReview({
        planId: plan.id,
      }),
    );
    const pending = expectRecoverySuccess(
      application.recovery.agent.recoveryPlanStatus(),
    );
    expect(pending).toMatchObject({
      plan: { id: plan.id, status: "REVIEW_REQUESTED" },
      scenarioRevision: 1,
      workflowState: "REVIEW_REQUESTED",
    });

    const approval = expectRecoverySuccess(
      application.recovery.human.recoveryPlanApprove({ planId: plan.id }),
    );
    const receipt = expectRecoverySuccess(
      application.recovery.agent.recoveryPlanExecute({
        fingerprint: approval.fingerprint,
        planId: approval.planId,
        proposedRouteId: approval.proposedRouteId,
        vehicleId: approval.vehicleId,
      }),
    );
    const report = expectRecoverySuccess(
      application.recovery.agent.recoveryVerify({ planId: plan.id }),
    );
    const storedReceipt = expectRecoverySuccess(
      application.recovery.agent.operationReceiptGet({ planId: plan.id }),
    );
    const scenario = application.scenarioCurrent();

    expect(receipt.receiptId).toBe(storedReceipt.receiptId);
    expect(storedReceipt.verificationSummary).toStrictEqual({
      reportId: report.id,
      status: "PASS",
    });
    expect(report.overall).toBe("PASS");
    expect(scenario.ok).toBe(true);
    if (!scenario.ok) {
      throw new Error("Scenario unavailable.");
    }
    expect(scenario.data.vehicles.find(
      ({ internalId }) => internalId === "vehicle-011",
    )?.routeId).toBe("alternative-route-011-clearance-v1");
    expect(application.recovery.getSnapshot().workflowState).toBe("VERIFIED");
  });

  it("should keep rejection human-only and fail closed through the agent facade", () => {
    const application = createApplication(new MemoryStorage());
    const options = expectRecoverySuccess(
      application.recovery.agent.recoveryOptionsCompare(),
    );
    const alternative = options.find(({ kind }) => kind === "ALTERNATIVE_ROUTE");
    if (alternative === undefined) {
      throw new Error("Alternative option missing.");
    }
    const plan = expectRecoverySuccess(
      application.recovery.agent.recoveryPlanStage({
        selectedOptionId: alternative.id,
      }),
    );
    expectRecoverySuccess(
      application.recovery.agent.recoveryPlanRequestReview({
        planId: plan.id,
      }),
    );
    expectRecoverySuccess(
      application.recovery.human.recoveryPlanReject({ planId: plan.id }),
    );
    const before = application.recovery.getSnapshot();

    const execution = application.recovery.agent.recoveryPlanExecute({
      fingerprint: plan.fingerprint,
      planId: plan.id,
      proposedRouteId: plan.proposedRouteId,
      vehicleId: plan.vehicleId,
    });

    expect(execution.ok).toBe(false);
    if (execution.ok) {
      throw new Error("Rejected plan unexpectedly executed.");
    }
    expect(execution.error.code).toBe("APPROVAL_REQUIRED");
    expect(application.recovery.getSnapshot()).toStrictEqual(before);
    expect(before.workflowState).toBe("REJECTED");
    expect(before.approval).toBeUndefined();
    expect(before.scenario.vehicles.find(
      ({ internalId }) => internalId === "vehicle-011",
    )?.routeId).toBe("route-011");
  });

  it("should expose defensive UI snapshots and subscriptions without leaking store authority", () => {
    const application = createApplication(new MemoryStorage());
    const revisions: number[] = [];
    const unsubscribe = application.recovery.subscribe((snapshot) => {
      revisions.push(snapshot.scenarioRevision);
      snapshot.constraints.clearanceBufferMeters.value = 0.8;
    });
    const leaked = application.recovery.getSnapshot();
    leaked.constraints.clearanceBufferMeters.value = 0.9;

    expectRecoverySuccess(
      application.recovery.human.clearanceBufferSet({
        clearanceBufferMeters: 0.25,
      }),
    );
    unsubscribe();

    expect(revisions).toStrictEqual([2]);
    expect(
      application.recovery.getSnapshot().constraints.clearanceBufferMeters.value,
    ).toBe(0.25);
  });
});
