import { type OperatingRegion, type Vehicle, type Route, type Place, type Cargo, type Dimensions } from "../../domain/entities";
import { geoPoint, geoLine, type Coordinates } from "../geometry";

type VehicleSeed = [internalId: string, fleetNumber: string, plate: string, status: Vehicle["status"], originCoordinates: Coordinates, originName: string, destinationCoordinates: Coordinates, destinationName: string, cargoId: string, cargoDescription: string];

const vehicleSeeds: VehicleSeed[] = [
  ["vehicle-fr-001", "FM-F01", "AB-123-CD", "driving", [1.4442, 43.6045], "Toulouse", [4.8357, 45.7640], "Lyon", "cargo-fr-001", "Aerospace components"],
  ["vehicle-fr-002", "FM-F02", "EF-456-GH", "resting", [4.8357, 45.7640], "Lyon", [5.3698, 43.2965], "Marseille", "cargo-fr-002", "Textiles"],
  ["vehicle-fr-003", "FM-F03", "IJ-789-KL", "needs-attention", [5.3698, 43.2965], "Marseille", [-0.5792, 44.8378], "Bordeaux", "cargo-fr-003", "Wine shipments"],
  ["vehicle-fr-004", "FM-F04", "MN-012-OP", "critical", [-0.5792, 44.8378], "Bordeaux", [2.3522, 48.8566], "Paris", "cargo-fr-004", "Luxury goods"],
  ["vehicle-fr-005", "FM-F05", "QR-345-ST", "driving", [2.3522, 48.8566], "Paris", [1.4442, 43.6045], "Toulouse", "cargo-fr-005", "Electronics"],
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

function createFranceRoutes(): Route[] {
  return vehicleSeeds.map((seed, index) => {
    const routeId = `route-fr-${String(index + 1).padStart(3, "0")}`;
    const [internalId, , , , originCoordinates, , destinationCoordinates] = seed;
    const coords: Coordinates[] = [originCoordinates, [(originCoordinates[0]+destinationCoordinates[0])/2, (originCoordinates[1]+destinationCoordinates[1])/2], destinationCoordinates];
    return {
      id: routeId,
      vehicleId: internalId,
      name: `Route ${routeId}`,
      geometry: geoLine(coords[0], coords[2]),
      summary: { distanceMeters: 500000, durationSeconds: 18000 },
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
    origin: place("origin-fr", originName, originCoordinates), destination: place("dest-fr", destinationName, destinationCoordinates), currentRoute: `${originName} to ${destinationName}`, routeId: route.id, routeProgress,
    riskIds: [],
  };
}

export function createFranceScenario(): OperatingRegion {
  const routes = createFranceRoutes();
  const vehicles = vehicleSeeds.map((seed, idx) => vehicleFromSeed(seed, idx, routes));
  return {
    id: "france-v1", name: "France · Occitanie & Rhône", vehicles, routes,
    risks: [
      { id: "fr-risk-1", kind: "road-closure", severity: "high", title: "A7 Closure", geometry: geoLine([4.83, 45.76], [5.36, 43.29]), affectedVehicleIds: [] }
    ],
  };
}
