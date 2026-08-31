import { describe, expect, it } from "vitest";
import { createApplication } from "../../app/createApplication";
import { createOperationsApi } from "../../domain/operations/createOperationsApi";
import { createZustandScenarioRepository } from "../../scenario/state/createZustandScenarioRepository";
import { createUnit211RecoveryPreviewModel } from "./unit211RecoveryPreviewModel";

describe("Unit 211 recovery preview model", () => {
  it("should project the real pre-dispatch operation result without rebuilding domain data", () => {
    const result = createApplication().unit211PreDispatchContext();
    const model = createUnit211RecoveryPreviewModel(result);

    expect(model.kind).toBe("development-preview");
    if (model.kind !== "development-preview") throw new Error(`Expected preview data, received ${model.reasonCode}.`);
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
        distanceMeters: result.data.options[0].summary.distanceMeters,
        durationSeconds: result.data.options[0].summary.durationSeconds,
      },
      alternative: {
        id: result.data.options[1].alternativeRouteId,
        status: result.data.options[1].disposition,
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

  it("should preserve a structured operation failure without interpreting its reason code", () => {
    const result = createOperationsApi(createZustandScenarioRepository()).unit211PreDispatchContext();
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected a structured pre-dispatch failure.");

    expect(createUnit211RecoveryPreviewModel(result)).toStrictEqual({
      kind: "operation-failure",
      reasonCode: result.reasonCode,
    });
  });
});
