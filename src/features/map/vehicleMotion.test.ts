import { describe, it, expect } from "vitest";
import { evaluateVehicleMotion } from "./vehicleMotion";
import type { Vehicle } from "../../domain/entities";

function mockVehicle(partial: Partial<Vehicle>): Vehicle {
  return {
    internalId: "test-vehicle",
    fleetNumber: "TEST-01",
    plate: "1234 ABC",
    label: "Test Truck",
    status: "driving",
    routeId: "route-test",
    currentRoute: "route-test",
    routeProgress: 0.25,
    speedKmH: 82,
    dimensions: {
      vehicleType: "semi-trailer",
      lengthMeters: 16.5,
      heightMeters: 4.0,
      weightTonnes: 40,
    },
    cargo: {
      id: "cargo-1",
      description: "Dry goods",
      refrigeration: "ambient",
      priority: "standard",
    },
    origin: {
      id: "origin-1",
      name: "Madrid",
      position: { type: "Feature", geometry: { type: "Point", coordinates: [-3.7038, 40.4168] }, properties: {} },
    },
    destination: {
      id: "dest-1",
      name: "Barcelona",
      position: { type: "Feature", geometry: { type: "Point", coordinates: [2.1734, 41.3851] }, properties: {} },
    },
    position: {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-3.5, 40.5] },
      properties: {},
    },
    timing: {
      remainingDriveMinutes: 180,
      restDeadline: "2026-08-28T14:00:00Z",
      eta: "2026-08-28T18:00:00Z",
      delayMinutes: 0,
    },
    riskIds: [],
    ...partial,
  };
}

describe("vehicleMotion policy", () => {
  it("should evaluate resting vehicle as stopped with mandatory rest reason", () => {
    const v = mockVehicle({ status: "resting" });
    const motion = evaluateVehicleMotion(v);
    expect(motion.isMoving).toBe(false);
    expect(motion.reasonCode).toBe("mandatory-rest");
    expect(motion.reasonText.en).toBe("Mandatory rest");
    expect(motion.reasonText.es).toBe("Descanso obligatorio");
  });

  it("should evaluate unassigned vehicle without route as stopped", () => {
    const v = mockVehicle({ routeId: "" });
    const motion = evaluateVehicleMotion(v);
    expect(motion.isMoving).toBe(false);
    expect(motion.reasonCode).toBe("no-route");
    expect(motion.reasonText.en).toBe("No route assigned");
    expect(motion.reasonText.es).toBe("Sin ruta asignada");
  });

  it("should hold Unit 211 (vehicle-011) at pre-dispatch safety hold on route-011", () => {
    const v = mockVehicle({ internalId: "vehicle-011", routeId: "route-011" });
    const motion = evaluateVehicleMotion(v);
    expect(motion.isMoving).toBe(false);
    expect(motion.reasonCode).toBe("pre-dispatch-hold");
    expect(motion.reasonText.en).toBe("Pre-dispatch safety hold");
    expect(motion.reasonText.es).toBe("Parada de seguridad pre-despacho");
  });

  it("should allow needs-attention vehicles with routes to move continuously", () => {
    const v = mockVehicle({ status: "needs-attention", internalId: "vehicle-003", routeId: "route-003" });
    const motion = evaluateVehicleMotion(v);
    expect(motion.isMoving).toBe(true);
    expect(motion.reasonCode).toBeNull();
  });

  it("should allow critical vehicles with routes to move continuously unless explicitly stopped", () => {
    const v = mockVehicle({ status: "critical", internalId: "vehicle-004", routeId: "route-004" });
    const motion = evaluateVehicleMotion(v);
    expect(motion.isMoving).toBe(true);
    expect(motion.reasonCode).toBeNull();
  });

  it("should allow Unit 211 to advance once recovered with alternative route", () => {
    const v = mockVehicle({
      internalId: "vehicle-011",
      routeId: "alternative-route-011-clearance-v1",
      status: "driving",
    });
    const motion = evaluateVehicleMotion(v);
    expect(motion.isMoving).toBe(true);
    expect(motion.reasonCode).toBeNull();
  });
});
