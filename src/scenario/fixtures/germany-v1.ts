import { type OperatingRegion, type Vehicle, type Route, type Place, type Cargo, type Dimensions } from "../../domain/entities";
import { geoPoint, geoLine, geoPolygon, type Coordinates } from "../geometry";

type VehicleSeed = [internalId: string, fleetNumber: string, plate: string, status: Vehicle["status"], originCoordinates: Coordinates, originName: string, destinationCoordinates: Coordinates, destinationName: string, cargoId: string, cargoDescription: string];

const vehicleSeeds: VehicleSeed[] = [
  ["vehicle-de-001", "FM-D01", "F-AB 123", "driving", [8.6821, 50.1109], "Frankfurt", [6.9531, 50.9375], "Cologne", "cargo-de-001", "Chemicals"],
  ["vehicle-de-002", "FM-D02", "K-CD 456", "resting", [6.9531, 50.9375], "Cologne", [11.5820, 48.1351], "Munich", "cargo-de-002", "Machinery"],
  ["vehicle-de-003", "FM-D03", "M-EF 789", "needs-attention", [11.5820, 48.1351], "Munich", [9.1829, 48.7758], "Stuttgart", "cargo-de-003", "Automotive Parts"],
  ["vehicle-de-004", "FM-D04", "S-GH 012", "critical", [9.1829, 48.7758], "Stuttgart", [9.9937, 53.5511], "Hamburg", "cargo-de-004", "Electronics"],
  ["vehicle-de-005", "FM-D05", "HH-IJ 345", "driving", [9.9937, 53.5511], "Hamburg", [8.6821, 50.1109], "Frankfurt", "cargo-de-005", "Consumer Goods"],
];

function place(id: string, name: string, coordinates: Coordinates): Place {
  return { id, name, position: geoPoint(coordinates) };
}

function cargo(id: string, index: number, description: string): Cargo {
  return { id, description, refrigeration: index % 4 === 3 ? "frozen" : index % 3 === 2 ? "chilled" : "ambient", priority: index % 4 === 3 ? "critical" : index % 3 === 2 ? "priority" : "standard" };
}

function dimensions(index: number): Dimensions {
  return { vehicleType: index % 2 === 0 ? "Articulated curtain-sider" : "Reefer tractor-trailer", lengthMeters: 16.5, heightMeters: 3.8, weightTonnes: 18 + (index % 7) };
}

function pointAtRouteProgress(coordinates: Coordinates[], progress: number): Vehicle["position"] {
  const c = coordinates;
  const p = Math.max(0, Math.min(1, progress));
  const idx = Math.floor(p * (c.length - 1));
  return geoPoint(c[idx]);
}

function createGermanyRoutes(): Route[] {
  return vehicleSeeds.map((seed, index) => {
    const routeId = `route-de-${String(index + 1).padStart(3, "0")}`;
    const [internalId, , , , originCoordinates, , destinationCoordinates] = seed;
    const coords: Coordinates[] = [originCoordinates, [(originCoordinates[0]+destinationCoordinates[0])/2, (originCoordinates[1]+destinationCoordinates[1])/2], destinationCoordinates];
    return {
      id: routeId,
      vehicleId: internalId,
      name: `Route ${routeId}`,
      geometry: geoLine(coords[0], coords[2]),
      summary: { distanceMeters: 400000, durationSeconds: 15000 },
      riskSnaps: []
    };
  });
}

function vehicleFromSeed(seed: VehicleSeed, index: number, routes: Route[]): Vehicle {
  const [internalId, fleetNumber, plate, status, originCoordinates, originName, destinationCoordinates, destinationName, cargoId, cargoDescription] = seed;
  const route = routes.find(r => r.vehicleId === internalId)!;
  const routeProgress = 0.5;
  return {
    internalId, fleetNumber, plate, label: `Unit ${fleetNumber.slice(-3)}`, position: pointAtRouteProgress(route.geometry.geometry.coordinates, routeProgress), status,
    cargo: cargo(cargoId, index, cargoDescription), dimensions: dimensions(index),
    timing: { remainingDriveMinutes: 45, restDeadline: `2026-08-28T12:00:00Z`, eta: `2026-08-28T16:30:00Z`, delayMinutes: 0 },
    origin: place("origin-de", originName, originCoordinates), destination: place("dest-de", destinationName, destinationCoordinates), currentRoute: `${originName} to ${destinationName}`, routeId: route.id, routeProgress,
    riskIds: [],
  };
}

export function createGermanyScenario(): OperatingRegion {
  const routes = createGermanyRoutes();
  const vehicles = vehicleSeeds.map((seed, idx) => vehicleFromSeed(seed, idx, routes));
  return {
    id: "germany-v1", name: "Germany · Rhine-Ruhr & Bavaria", vehicles, routes,
    risks: [
      { id: "de-risk-1", kind: "severe-snow", severity: "high", title: "Bavaria Snow", geometry: geoPolygon([[11,47],[12,47],[12,49],[11,49]]), affectedVehicleIds: [] }
    ],
  };
}
