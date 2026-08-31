import { describe, expect, it } from "vitest";
import { createUnit211RecoveryPreviewModel } from "./unit211RecoveryPreviewModel";

describe("Unit 211 recovery preview model", () => {
  it("should present the authoritative failed clearance assessment and real route options", () => {
    const model = createUnit211RecoveryPreviewModel();

    expect(model).toMatchObject({
      kind: "development-preview",
      vehicle: { id: "vehicle-011", label: "Unit 211", fleetNumber: "FM-211", location: "Toledo", state: "Before departure" },
      incident: { id: "restriction-height-3.9", position: [-3.897481, 40.149232], restrictionMeters: 3.9 },
      clearance: { vehicleHeightMeters: 3.8, humanBufferMeters: 0.2, requiredMeters: 4, status: "FAIL", equation: "3.80 + 0.20 = 4.00 m required" },
      current: { id: "route-011", status: "rejected", distance: "99.7 km", duration: "1 h 28 min 12.1 s" },
      alternative: { id: "alternative-route-011-clearance-v1", status: "valid", distance: "80.3 km", duration: "1 h 28 min 2.5 s" },
      delta: { distance: "19.4 km shorter", duration: "9.6 s faster" },
    });
    expect(model.current.coordinates).toHaveLength(1_120);
    expect(model.alternative.coordinates).toHaveLength(743);
  });

  it("should expose an immutable pre-dispatch position and exact exclusion geometry", () => {
    const model = createUnit211RecoveryPreviewModel();

    expect(model.vehicle.position).toStrictEqual(model.current.coordinates[0]);
    expect(model.incident.exclusionCoordinates).toHaveLength(65);
    expect(model.incident.exclusionRadiusMeters).toBe(250);
    expect(model.incident.horizontalSeparationMeters).toBeCloseTo(5_724.858608, 6);
    expect(Object.isFrozen(model)).toBe(true);
    expect(Object.isFrozen(model.current.coordinates)).toBe(true);
    expect(Object.isFrozen(model.incident.exclusionCoordinates)).toBe(true);
  });
});
