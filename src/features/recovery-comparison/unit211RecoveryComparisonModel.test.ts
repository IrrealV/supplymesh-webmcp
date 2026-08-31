import { describe, expect, it } from "vitest";
import { createApplication } from "../../app/createApplication";
import { createUnit211RecoveryComparisonModel } from "./unit211RecoveryComparisonModel";

function successfulResult() {
  const result = createApplication().unit211PreDispatchContext();
  if (!result.ok) throw new Error(result.reasonCode);
  return result;
}

describe("createUnit211RecoveryComparisonModel", () => {
  it("should copy authoritative PASS evidence without retaining domain references", () => {
    const result = successfulResult();
    const model = createUnit211RecoveryComparisonModel(result, "en");
    if (model.kind !== "ready") throw new Error(model.reasonCode);

    expect(model.current.temporal).toStrictEqual(result.data.options[0].temporalAssessment);
    expect(model.current.cargoContinuity).toStrictEqual(result.data.options[0].cargoContinuityAssessment);
    expect(model.alternative.temporal.status).toBe("PASS");
    expect(model.alternative.cargoContinuity.status).toBe("PASS");
    expect(model.current.temporal).not.toBe(result.data.options[0].temporalAssessment);
    expect(model.current.cargoContinuity).not.toBe(result.data.options[0].cargoContinuityAssessment);
    expect(Object.isFrozen(result.data.options[0].temporalAssessment)).toBe(false);
    expect(Object.isFrozen(result.data.options[0].cargoContinuityAssessment)).toBe(false);
    expect(Object.isFrozen(model)).toBe(true);
  });

  it("should preserve authoritative FAIL and UNKNOWN discriminants with their evidence", () => {
    const result = successfulResult(); const pass = result.data.options[0].cargoContinuityAssessment;
    if (pass.status === "UNKNOWN") throw new Error(pass.reasonCode);
    Reflect.set(result.data.options[0], "temporalAssessment", { remainingRouteMinutes: 90, remainingDriveMinutes: 80, estimatedCompletionAt: "2026-08-28T10:30:00.000Z", restDeadline: "2026-08-28T16:00:00Z", status: "FAIL", reasonCode: "DRIVE_TIME_VIOLATION" });
    Reflect.set(result.data.options[0], "cargoContinuityAssessment", { status: "FAIL", reasonCode: "CARGO_CONTINUITY_MISMATCH", mismatchReasonCodes: ["CARGO_ID_MISMATCH"], referenceFacts: pass.referenceFacts, optionFacts: { ...pass.optionFacts, cargoId: "cargo-other" } });
    Reflect.set(result.data.options[1], "temporalAssessment", { remainingRouteMinutes: null, remainingDriveMinutes: 235, estimatedCompletionAt: null, restDeadline: "2026-08-28T16:00:00Z", status: "UNKNOWN", reasonCode: "TEMPORAL_SOURCE_INVALID" });
    Reflect.set(result.data.options[1], "cargoContinuityAssessment", { status: "UNKNOWN", reasonCode: "CARGO_CONTINUITY_SOURCE_INVALID", source: "OPTION", sourceReasonCode: "CARGO_ID_INVALID" });

    const model = createUnit211RecoveryComparisonModel(result, "en");
    if (model.kind !== "ready") throw new Error(model.reasonCode);
    expect(model.current.temporal).toMatchObject({ status: "FAIL", reasonCode: "DRIVE_TIME_VIOLATION", remainingRouteMinutes: 90, remainingDriveMinutes: 80 });
    expect(model.current.cargoContinuity).toMatchObject({ status: "FAIL", mismatchReasonCodes: ["CARGO_ID_MISMATCH"], optionFacts: { cargoId: "cargo-other" } });
    expect(model.alternative.temporal).toStrictEqual({ remainingRouteMinutes: null, remainingDriveMinutes: 235, estimatedCompletionAt: null, restDeadline: "2026-08-28T16:00:00Z", status: "UNKNOWN", reasonCode: "TEMPORAL_SOURCE_INVALID" });
    expect(model.alternative.cargoContinuity).toStrictEqual({ status: "UNKNOWN", reasonCode: "CARGO_CONTINUITY_SOURCE_INVALID", source: "OPTION", sourceReasonCode: "CARGO_ID_INVALID" });
  });

  it("should preserve a structured operation failure without interpretation", () => {
    const result = { ok: false, reasonCode: "ALTERNATIVE_SOURCE_UNAVAILABLE" } as const;
    expect(createUnit211RecoveryComparisonModel(result, "es")).toStrictEqual({ kind: "operation-failure", reasonCode: result.reasonCode });
  });
});
