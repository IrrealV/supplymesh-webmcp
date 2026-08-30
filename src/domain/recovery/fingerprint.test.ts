import { describe, expect, it } from "vitest";
import { canonicalSerialize, createPlanFingerprint } from "./fingerprint";

const planPayload = {
  basedOnScenarioRevision: 1,
  constraints: {
    clearanceBufferMeters: { hardness: "hard", source: "human", value: 0.2 },
    keepCargoAssignment: { hardness: "hard", source: "human", value: true },
    protectRestDeadline: { hardness: "hard", source: "human", value: true },
  },
  currentRouteId: "route-011",
  incidentId: "incident-unit-211-clearance-v1",
  optionMetrics: { distanceMeters: 80_298.9, durationSeconds: 5_282.5 },
  planId: "recovery-plan-vehicle-011-r1",
  proposedRouteId: "alternative-route-011-clearance-v1",
  selectedOptionId: "option-alternative-route-011-clearance-v1",
  vehicleId: "vehicle-011",
};

describe("canonical recovery plan fingerprint", () => {
  it("should serialize recursively with deterministic object-key ordering", () => {
    const left = { z: [{ b: 2, a: 1 }], a: "value" };
    const right = { a: "value", z: [{ a: 1, b: 2 }] };

    expect(canonicalSerialize(left)).toBe('{"a":"value","z":[{"a":1,"b":2}]}');
    expect(canonicalSerialize(right)).toBe(canonicalSerialize(left));
  });

  it("should produce a truthfully named browser-safe deterministic fingerprint", () => {
    const reordered = {
      vehicleId: planPayload.vehicleId,
      selectedOptionId: planPayload.selectedOptionId,
      proposedRouteId: planPayload.proposedRouteId,
      planId: planPayload.planId,
      optionMetrics: planPayload.optionMetrics,
      incidentId: planPayload.incidentId,
      currentRouteId: planPayload.currentRouteId,
      constraints: planPayload.constraints,
      basedOnScenarioRevision: planPayload.basedOnScenarioRevision,
    };

    expect(createPlanFingerprint(reordered)).toBe(createPlanFingerprint(planPayload));
    expect(createPlanFingerprint(planPayload)).toMatch(/^fnv1a64:[a-f0-9]{16}$/);
  });

  it("should detect a tampered route, revision, constraint, or option metric", () => {
    const original = createPlanFingerprint(planPayload);
    const tamperedPayloads = [
      { ...planPayload, proposedRouteId: "route-attacker" },
      { ...planPayload, basedOnScenarioRevision: 2 },
      { ...planPayload, constraints: { ...planPayload.constraints, clearanceBufferMeters: { hardness: "hard", source: "human", value: 0.3 } } },
      { ...planPayload, optionMetrics: { ...planPayload.optionMetrics, durationSeconds: 5_000 } },
    ];

    for (const payload of tamperedPayloads) {
      expect(createPlanFingerprint(payload)).not.toBe(original);
    }
  });

  it.each([
    [{ value: Number.NaN }],
    [{ value: undefined }],
    [{ value: () => "unsupported" }],
  ])("should reject unsupported canonical values", (value) => {
    expect(() => canonicalSerialize(value)).toThrow("canonical");
  });
});
