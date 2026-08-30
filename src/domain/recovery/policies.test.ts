import { describe, expect, it } from "vitest";
import {
  isClearanceBufferMetersValid,
  validateCargoContinuity,
  validateClearancePolicy,
  validateRestWindow,
} from "./policies";

describe("recovery safety policies", () => {
  it("should reject Unit 211 current route with the exact clearance calculation", () => {
    const result = validateClearancePolicy({
      availableClearanceMeters: 3.9,
      clearanceBufferMeters: 0.2,
      isRestrictionApplicable: true,
      vehicleHeightMeters: 3.8,
    });

    expect(result).toStrictEqual({
      availableClearanceMeters: 3.9,
      clearanceBufferMeters: 0.2,
      reasonCode: "CLEARANCE_BUFFER_VIOLATION",
      requiredClearanceMeters: 4,
      status: "FAIL",
      vehicleHeightMeters: 3.8,
    });
  });

  it("should pass clearance only when the applicable route meets the buffered height", () => {
    expect(validateClearancePolicy({
      availableClearanceMeters: 4,
      clearanceBufferMeters: 0.2,
      isRestrictionApplicable: true,
      vehicleHeightMeters: 3.8,
    }).status).toBe("PASS");
    expect(validateClearancePolicy({
      availableClearanceMeters: 3.9,
      clearanceBufferMeters: 0.2,
      isRestrictionApplicable: false,
      vehicleHeightMeters: 3.8,
    })).toMatchObject({
      reasonCode: "CLEARANCE_RESTRICTION_AVOIDED",
      requiredClearanceMeters: 4,
      status: "PASS",
    });
  });

  it.each([
    [-0.01, false],
    [0, true],
    [0.2, true],
    [1, true],
    [1.01, false],
    [Number.NaN, false],
  ])("should bound clearance buffer %s", (bufferMeters, expected) => {
    expect(isClearanceBufferMetersValid(bufferMeters)).toBe(expected);
  });

  it("should validate the alternative temporal window from the deterministic clock", () => {
    const result = validateRestWindow({
      currentProgress: 0,
      protectRestDeadline: true,
      remainingDriveMinutes: 235,
      reserveMinutes: 0,
      restDeadline: "2026-08-28T16:00:00.000Z",
      routeDurationSeconds: 5_282.5,
      scenarioClock: { instant: "2026-08-28T09:00:00.000Z", mode: "deterministic-demo" },
    });

    expect(result).toStrictEqual({
      estimatedCompletionAt: "2026-08-28T10:28:02.500Z",
      isCompletionBeforeDeadline: true,
      isDurationWithinRemainingDrive: true,
      reasonCode: "REST_WINDOW_SATISFIED",
      remainingDriveMinutes: 235,
      remainingRouteMinutes: 88.04166666666667,
      reserveMinutes: 0,
      restDeadline: "2026-08-28T16:00:00.000Z",
      status: "PASS",
    });
  });

  it("should return unknown instead of inventing a rest decision for invalid time data", () => {
    const result = validateRestWindow({
      currentProgress: 0,
      protectRestDeadline: true,
      remainingDriveMinutes: 235,
      reserveMinutes: 0,
      restDeadline: "not-a-date",
      routeDurationSeconds: 5_282.5,
      scenarioClock: { instant: "2026-08-28T09:00:00.000Z", mode: "deterministic-demo" },
    });

    expect(result.status).toBe("UNKNOWN");
    expect(result.reasonCode).toBe("REST_WINDOW_DATA_INVALID");
  });

  it("should preserve vehicle, cargo, refrigeration, priority, and destination", () => {
    const assignment = {
      cargo: {
        description: "High-value electronics",
        priority: "standard" as const,
        refrigeration: "ambient" as const,
      },
      destinationId: "Alcobendas",
      vehicleId: "vehicle-011",
    };

    expect(validateCargoContinuity(assignment, structuredClone(assignment))).toStrictEqual({
      cargoAssignmentUnchanged: true,
      destinationUnchanged: true,
      reasonCode: "CARGO_CONTINUITY_PRESERVED",
      status: "PASS",
      vehicleUnchanged: true,
    });
    expect(validateCargoContinuity(assignment, {
      ...assignment,
      cargo: { ...assignment.cargo, priority: "critical" },
    })).toMatchObject({
      cargoAssignmentUnchanged: false,
      reasonCode: "CARGO_CONTINUITY_VIOLATION",
      status: "FAIL",
    });
  });
});
