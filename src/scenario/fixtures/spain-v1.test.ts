import { describe, expect, it } from "vitest";
import { createSpainScenario, getVehicleDisplayName } from "./spain-v1";

describe("Spain scenario fixture", () => {
  it("is repeatable, offline, and contains exactly fifteen unique plausible vehicles", () => {
    const first = createSpainScenario();
    const second = createSpainScenario();

    expect(second).toStrictEqual(first);
    expect(first.vehicles).toHaveLength(15);
    expect(new Set(first.vehicles.map((vehicle) => vehicle.internalId)).size).toBe(15);
    expect(new Set(first.vehicles.map((vehicle) => vehicle.fleetNumber)).size).toBe(15);
    expect(new Set(first.vehicles.map((vehicle) => vehicle.plate)).size).toBe(15);

    for (const vehicle of first.vehicles) {
      const [longitude, latitude] = vehicle.position.geometry.coordinates;
      expect(longitude).toBeGreaterThan(-10);
      expect(longitude).toBeLessThan(4);
      expect(latitude).toBeGreaterThan(36);
      expect(latitude).toBeLessThan(44);
    }
  });

  it("uses fleet number when an editable label is absent", () => {
    const vehicle = createSpainScenario().vehicles[0];
    const unlabeledVehicle = { ...vehicle, label: "  " };

    expect(getVehicleDisplayName(unlabeledVehicle)).toBe(vehicle.fleetNumber);
  });

  it("covers operational fields, all statuses, routes, and controlled risks", () => {
    const scenario = createSpainScenario();
    const statuses = new Set(scenario.vehicles.map((vehicle) => vehicle.status));

    expect(statuses).toStrictEqual(
      new Set(["driving", "resting", "needs-attention", "critical"]),
    );
    expect(scenario.routes).toHaveLength(15);
    expect(scenario.routes.every((route) => route.geometry.geometry.type === "LineString" && route.geometry.geometry.coordinates.length > 2)).toBe(true);

    for (const vehicle of scenario.vehicles) {
      expect(vehicle.routeId.length).toBeGreaterThan(0);
      expect(vehicle.routeProgress).toBeGreaterThanOrEqual(0);
      expect(vehicle.routeProgress).toBeLessThanOrEqual(1);
      expect(vehicle.origin.name.length).toBeGreaterThan(0);
      expect(vehicle.destination.name.length).toBeGreaterThan(0);
      expect(vehicle.currentRoute.length).toBeGreaterThan(0);
      expect(vehicle.cargo.description.length).toBeGreaterThan(0);
      expect(vehicle.dimensions.heightMeters).toBeGreaterThan(0);
      expect(vehicle.timing.restDeadline).toMatch(/^2026-/);
      expect(vehicle.riskIds.length).toBeGreaterThan(0);
    }

    const height = scenario.risks.find((risk) => risk.kind === "height-restriction");
    const weight = scenario.risks.find((risk) => risk.kind === "weight-restriction");
    const closure = scenario.risks.find((risk) => risk.kind === "road-closure");
    const snow = scenario.risks.find((risk) => risk.kind === "severe-snow");
    const deadline = scenario.risks.find((risk) => risk.kind === "rest-deadline");

    expect(height?.limitMeters).toBe(3.9);
    expect(weight?.limitTonnes).toBe(26);
    expect(closure?.geometry.geometry.type).toBe("LineString");
    expect(snow?.geometry.geometry.type).toBe("Polygon");
    expect(snow?.severity).toBe("high");
    expect(deadline?.vehicleId).toBe("vehicle-001");
  });

  it("derives endpoint positions and keeps risk associations snapped symmetrically", () => {
    const scenario = createSpainScenario(); const firstRoute = scenario.routes[0]; const lastRoute = scenario.routes.at(-1)!;
    expect(scenario.vehicles[0].position.geometry.coordinates).toStrictEqual(firstRoute.geometry.geometry.coordinates[0]);
    expect(scenario.vehicles.at(-1)!.position.geometry.coordinates).toStrictEqual(lastRoute.geometry.geometry.coordinates.at(-1));
    for (const risk of scenario.risks) for (const snap of risk.routeSnaps ?? []) {
      const route = scenario.routes.find((candidate) => candidate.id === snap.routeId);
      expect(route).not.toBeUndefined(); expect(risk.affectedVehicleIds).toContain(route!.vehicleId);
      expect(route!.geometry.geometry.coordinates[snap.startIndex]).toStrictEqual(snap.startCoordinate);
      expect(route!.geometry.geometry.coordinates[snap.endIndex]).toStrictEqual(snap.endCoordinate);
    }
  });
});
