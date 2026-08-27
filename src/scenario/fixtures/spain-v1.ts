import type { Cargo, Dimensions, OperatingRegion, OperationalRisk, Place, Vehicle, VehicleStatus } from "../../domain/entities";
import { getVehicleDisplayName } from "../../domain/entities";
import { geoLine, geoPoint, geoPolygon, type Coordinates } from "../geometry";

type VehicleSeed = readonly [string, string, string, VehicleStatus, Coordinates, string, Coordinates, string, string];

const vehicleSeeds: VehicleSeed[] = [
  ["vehicle-001", "FM-201", "1534 LKT", "driving", [-3.7038, 40.4168], "Madrid", [-2.9349, 43.263], "Bilbao", "Medical supplies"],
  ["vehicle-002", "FM-202", "2841 MCV", "resting", [-2.935, 43.263], "Bilbao", [-0.8891, 41.6488], "Zaragoza", "Packaged food"],
  ["vehicle-003", "FM-203", "3972 NHR", "needs-attention", [-0.8891, 41.6488], "Zaragoza", [2.1734, 41.3851], "Barcelona", "Temperature-controlled produce"],
  ["vehicle-004", "FM-204", "4618 PJD", "critical", [2.1734, 41.3851], "Barcelona", [-0.3763, 39.4699], "Valencia", "Frozen pharmaceuticals"],
  ["vehicle-005", "FM-205", "5189 RLS", "driving", [-0.3763, 39.4699], "Valencia", [-3.5986, 37.1773], "Granada", "Retail pallets"],
  ["vehicle-006", "FM-206", "6294 SDW", "resting", [-3.5986, 37.1773], "Granada", [-5.9845, 37.3891], "Seville", "Chilled dairy"],
  ["vehicle-007", "FM-207", "7341 TGF", "needs-attention", [-5.9845, 37.3891], "Seville", [-6.2886, 36.5271], "Cadiz", "Container parts"],
  ["vehicle-008", "FM-208", "8462 VNB", "critical", [-6.2886, 36.5271], "Cadiz", [-4.4214, 36.7213], "Malaga", "Urgent spare parts"],
  ["vehicle-009", "FM-209", "9513 WPR", "driving", [-4.4214, 36.7213], "Malaga", [-1.1307, 37.9922], "Murcia", "Fresh citrus"],
  ["vehicle-010", "FM-210", "1674 XBD", "resting", [-1.1307, 37.9922], "Murcia", [-3.7038, 40.4168], "Madrid", "Ambient beverages"],
  ["vehicle-011", "FM-211", "2785 YKC", "needs-attention", [-4.0273, 39.8628], "Toledo", [-3.7496, 40.4637], "Alcobendas", "High-value electronics"],
  ["vehicle-012", "FM-212", "3896 ZMF", "critical", [-1.9812, 43.3183], "Santander", [-3.7038, 40.4168], "Madrid", "Refrigerated vaccines"],
  ["vehicle-013", "FM-213", "4927 BQH", "driving", [-8.4115, 43.3623], "A Coruna", [-5.6619, 40.9701], "Valladolid", "Paper rolls"],
  ["vehicle-014", "FM-214", "5638 CRV", "resting", [-4.1088, 38.8786], "Merida", [-3.7038, 40.4168], "Madrid", "Automotive components"],
  ["vehicle-015", "FM-215", "6749 DTX", "driving", [-3.8099, 43.4623], "Torrelavega", [-2.9349, 43.263], "Bilbao", "Industrial tooling"],
];

function place(name: string, coordinates: Coordinates): Place {
  return { name, position: geoPoint(coordinates) };
}

function cargo(index: number, description: string): Cargo {
  return { description, refrigeration: index % 4 === 3 ? "frozen" : index % 3 === 2 ? "chilled" : "ambient", priority: index % 4 === 3 ? "critical" : index % 3 === 2 ? "priority" : "standard" };
}

function dimensions(index: number): Dimensions {
  return { vehicleType: index % 2 === 0 ? "Articulated curtain-sider" : "Reefer tractor-trailer", lengthMeters: 16.5, heightMeters: 3.8, weightTonnes: 18 + (index % 7) };
}

function vehicleFromSeed(seed: VehicleSeed, index: number): Vehicle {
  const [internalId, fleetNumber, plate, status, originCoordinates, originName, destinationCoordinates, destinationName, cargoDescription] = seed;
  const routeId = `route-${String(index + 1).padStart(3, "0")}`;
  return {
    internalId, fleetNumber, plate, label: index === 0 ? "" : `Unit ${fleetNumber.slice(-3)}`, position: geoPoint(originCoordinates), status,
    cargo: cargo(index, cargoDescription), dimensions: dimensions(index),
    timing: { remainingDriveMinutes: 45 + index * 19, restDeadline: `2026-08-28T${String(6 + (index % 12)).padStart(2, "0")}:00:00Z`, eta: `2026-08-28T${String(10 + (index % 10)).padStart(2, "0")}:30:00Z`, delayMinutes: index % 4 === 0 ? 25 : 0 },
    origin: place(originName, originCoordinates), destination: place(destinationName, destinationCoordinates), currentRoute: `${originName} to ${destinationName}`, routeId,
    riskIds: [index % 5 === 0 ? "restriction-height-3.9" : index % 5 === 1 ? "restriction-weight-26" : index % 5 === 2 ? "closure-ap-68" : index % 5 === 3 ? "severe-snow-leon" : `rest-deadline-${internalId}`],
  };
}

function createRisks(): OperationalRisk[] {
  return [
    { id: "restriction-height-3.9", kind: "height-restriction", severity: "high", title: "3.9 m clearance restriction", geometry: geoLine([-3.91, 40.48], [-3.82, 40.45]), affectedVehicleIds: ["vehicle-001", "vehicle-006", "vehicle-011"], limitMeters: 3.9 },
    { id: "restriction-weight-26", kind: "weight-restriction", severity: "medium", title: "26 t weight restriction", geometry: geoLine([-1.06, 42.18], [-0.99, 42.08]), affectedVehicleIds: ["vehicle-002", "vehicle-007", "vehicle-012"], limitTonnes: 26 },
    { id: "closure-ap-68", kind: "road-closure", severity: "critical", title: "AP-68 closure segment", geometry: geoLine([-2.01, 42.55], [-1.78, 42.42]), affectedVehicleIds: ["vehicle-003", "vehicle-008", "vehicle-013"] },
    { id: "severe-snow-leon", kind: "severe-snow", severity: "high", title: "Severe snow advisory", geometry: geoPolygon([[-5.75, 42.62], [-5.42, 42.62], [-5.42, 42.83], [-5.75, 42.83]]), affectedVehicleIds: ["vehicle-004", "vehicle-009", "vehicle-014"] },
    ...vehicleSeeds.map(([internalId], index) => ({ id: `rest-deadline-${internalId}`, kind: "rest-deadline" as const, severity: index % 4 === 3 ? "critical" as const : "high" as const, title: "Driving and rest deadline", geometry: geoLine(vehicleSeeds[index][4], vehicleSeeds[index][6]), affectedVehicleIds: [internalId], vehicleId: internalId, deadline: `2026-08-28T${String(6 + (index % 12)).padStart(2, "0")}:00:00Z` })),
  ];
}

export function createSpainScenario(): OperatingRegion {
  const vehicles = vehicleSeeds.map(vehicleFromSeed);
  return {
    id: "spain-v1", name: "Iberian operational corridor", vehicles,
    routes: vehicles.map((vehicle) => ({ id: vehicle.routeId, vehicleId: vehicle.internalId, name: vehicle.currentRoute, geometry: geoLine(vehicle.origin.position.geometry.coordinates, vehicle.destination.position.geometry.coordinates) })),
    risks: createRisks(),
  };
}

export { getVehicleDisplayName };
