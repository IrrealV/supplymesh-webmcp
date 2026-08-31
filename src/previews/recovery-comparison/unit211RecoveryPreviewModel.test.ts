import { describe, expect, it } from "vitest";
import { createApplication } from "../../app/createApplication";
import { createOperationsApi } from "../../domain/operations/createOperationsApi";
import { createZustandScenarioRepository } from "../../scenario/state/createZustandScenarioRepository";
import { createUnit211RecoveryComparisonModel } from "../../features/recovery-comparison/unit211RecoveryComparisonModel";

type Mutable<T> = T extends object ? { -readonly [Key in keyof T]: Mutable<T[Key]> } : T;

function mutableSuccessResult() {
  const result = createApplication().unit211PreDispatchContext();
  if (!result.ok) throw new Error(`Expected domain data, received ${result.reasonCode}.`);
  return structuredClone(result) as Mutable<typeof result>;
}

describe("Unit 211 recovery preview model", () => {
  it("should project the real pre-dispatch operation result without rebuilding domain data", () => {
    const result = createApplication().unit211PreDispatchContext();
    const model = createUnit211RecoveryComparisonModel(result, "en");

    expect(model.kind).toBe("ready");
    if (model.kind !== "ready") throw new Error(`Expected preview data, received ${model.reasonCode}.`);
    if (!result.ok) throw new Error(`Expected domain data, received ${result.reasonCode}.`);

    expect(model).toMatchObject({
      scenarioClock: result.data.context.scenarioClock,
      vehicle: {
        id: result.data.context.unit.vehicleId,
        displayLabel: "Unit 211",
        fleetNumber: result.data.context.unit.fleetNumber,
        location: result.data.context.origin.name,
        state: "Before departure",
      },
      incident: {
        id: result.data.incident.id,
        riskId: result.data.incident.riskId,
        position: result.data.incident.point.coordinates,
        restrictionMeters: result.data.options[0].clearanceAssessment.data.restrictionLimitMeters,
      },
      clearance: {
        vehicleHeightMeters: result.data.options[0].clearanceAssessment.data.vehicleHeightMeters,
        humanBufferMeters: result.data.options[0].clearanceAssessment.data.clearanceBufferMeters,
        requiredMeters: result.data.options[0].clearanceAssessment.data.requiredClearanceMeters,
        status: result.data.options[0].clearanceAssessment.data.status,
        reasonCode: result.data.options[0].clearanceAssessment.data.reasonCode,
      },
      current: {
        id: result.data.options[0].routeId,
        status: result.data.options[0].disposition,
        statusLabel: "Rejected",
        distanceMeters: result.data.options[0].summary.distanceMeters,
        durationSeconds: result.data.options[0].summary.durationSeconds,
      },
      alternative: {
        id: result.data.options[1].alternativeRouteId,
        status: result.data.options[1].disposition,
        statusLabel: "Supported for comparison",
        distanceMeters: result.data.options[1].summary.distanceMeters,
        durationSeconds: result.data.options[1].summary.durationSeconds,
        avoidsExclusionZone: result.data.options[1].avoidsExclusionZone,
      },
    });
    expect(model.vehicle.position).toStrictEqual(result.data.context.position.coordinates);
    expect(model.current.coordinates).toStrictEqual(result.data.options[0].geometry.coordinates);
    expect(model.alternative.coordinates).toStrictEqual(result.data.options[1].geometry.coordinates);
    expect(model.incident.exclusionCoordinates).toStrictEqual(result.data.incident.exclusionPolygon.coordinates[0]);
    expect(model.current.coordinates).toHaveLength(1_120);
    expect(model.alternative.coordinates).toHaveLength(743);
    expect(model.incident.exclusionCoordinates).toHaveLength(65);
    expect(model.clearance.equation).toBe("3.80 + 0.20 = 4.00 m required");
    expect(Object.isFrozen(model)).toBe(true);
    expect(Object.isFrozen(model.current.coordinates)).toBe(true);
    expect(Object.isFrozen(model.incident.exclusionCoordinates)).toBe(true);
  });

  it("should project varied operation values without retaining source coordinate references", () => {
    const result = mutableSuccessResult();
    (result.data.context.scenarioClock as { instant: string }).instant = "2032-04-05T06:07:08.000Z";
    (result.data.context.unit as { fleetNumber: string }).fleetNumber = "FM-987";
    (result.data.context.origin as { name: string }).name = "Injected origin";
    result.data.context.position.coordinates = [-4.5, 39.9];
    result.data.incident.point.coordinates = [-4.4, 39.8];
    result.data.incident.exclusionPolygon.coordinates[0][0] = [-4.3, 39.7];
    result.data.options[0].geometry.coordinates[0] = [-4.2, 39.6];
    result.data.options[1].geometry.coordinates[0] = [-4.1, 39.5];
    result.data.options[0].summary.distanceMeters = 12_345;
    result.data.options[1].summary.durationSeconds = 4_321;
    result.data.options[0].clearanceAssessment.data.vehicleHeightMeters = 3.55;
    result.data.options[0].clearanceAssessment.data.clearanceBufferMeters = 0.35;
    result.data.options[0].clearanceAssessment.data.requiredClearanceMeters = 3.9;
    result.data.options[0].clearanceAssessment.data.restrictionLimitMeters = 3.75;
    result.data.options[1].provenance.avoidance.radiusMeters = 275;
    result.data.options[1].provenance.avoidance.minimumClearanceMeters = 2_750;
    (result.data.options[0] as { disposition: string }).disposition = "NEEDS_HUMAN_REVIEW";
    (result.data.options[1] as { disposition: string }).disposition = "SUPPORTED_FOR_REVIEW";

    const model = createUnit211RecoveryComparisonModel(result, "en");
    if (model.kind !== "ready") throw new Error(`Expected preview data, received ${model.reasonCode}.`);

    expect(model).toMatchObject({ scenarioClock: { instant: "2032-04-05T06:07:08.000Z" }, vehicle: { displayLabel: "Unit 987", location: "Injected origin", position: [-4.5, 39.9] }, incident: { position: [-4.4, 39.8], restrictionMeters: 3.75, exclusionRadiusMeters: 275, horizontalSeparationMeters: 2_750 }, clearance: { vehicleHeightMeters: 3.55, humanBufferMeters: 0.35, requiredMeters: 3.9, equation: "3.55 + 0.35 = 3.90 m required" }, current: { distanceMeters: 12_345, status: "NEEDS_HUMAN_REVIEW", statusLabel: "Needs human review" }, alternative: { durationSeconds: 4_321, status: "SUPPORTED_FOR_REVIEW", statusLabel: "Supported for review" } });
    expect(model.vehicle.position).not.toBe(result.data.context.position.coordinates);
    expect(model.incident.position).not.toBe(result.data.incident.point.coordinates);
    expect(model.incident.exclusionCoordinates).not.toBe(result.data.incident.exclusionPolygon.coordinates[0]);
    expect(model.incident.exclusionCoordinates[0]).not.toBe(result.data.incident.exclusionPolygon.coordinates[0][0]);
    expect(model.current.coordinates).not.toBe(result.data.options[0].geometry.coordinates);
    expect(model.current.coordinates[0]).not.toBe(result.data.options[0].geometry.coordinates[0]);
    expect(model.alternative.coordinates).not.toBe(result.data.options[1].geometry.coordinates);
    expect(model.alternative.coordinates[0]).not.toBe(result.data.options[1].geometry.coordinates[0]);
  });

  it("should preserve a structured operation failure without interpreting its reason code", () => {
    const result = createOperationsApi(createZustandScenarioRepository()).unit211PreDispatchContext();
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected a structured pre-dispatch failure.");

    expect(createUnit211RecoveryComparisonModel(result, "en")).toStrictEqual({
      kind: "operation-failure",
      reasonCode: result.reasonCode,
    });
  });
});
