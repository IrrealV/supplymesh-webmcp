import type { Cargo, Dimensions, OperatingRegion, OperationalRisk, Place, RiskRouteSnap, Route, Vehicle, VehicleStatus } from "../../domain/entities";
import { getVehicleDisplayName } from "../../domain/entities";
import { geoLine, geoPoint, geoPolygon, type Coordinates } from "../geometry";
import { assertRouteProgress, pointAtRouteProgress } from "../routeRuntime";
import { routeCatalog } from "./routeCatalog";

type VehicleSeed = readonly [string, string, string, VehicleStatus, Coordinates, string, Coordinates, string, string, string];

const vehicleSeeds: VehicleSeed[] = [
  ["vehicle-001", "FM-201", "1534 LKT", "driving", [-3.7038, 40.4168], "Madrid", [-2.9349, 43.263], "Bilbao", "cargo-001", "Medical supplies"],
  ["vehicle-002", "FM-202", "2841 MCV", "resting", [-2.935, 43.263], "Bilbao", [-0.8891, 41.6488], "Zaragoza", "cargo-002", "Packaged food"],
  ["vehicle-003", "FM-203", "3972 NHR", "needs-attention", [-0.8891, 41.6488], "Zaragoza", [2.1734, 41.3851], "Barcelona", "cargo-003", "Temperature-controlled produce"],
  ["vehicle-004", "FM-204", "4618 PJD", "critical", [2.1734, 41.3851], "Barcelona", [-0.3763, 39.4699], "Valencia", "cargo-004", "Frozen pharmaceuticals"],
  ["vehicle-005", "FM-205", "5189 RLS", "driving", [-0.3763, 39.4699], "Valencia", [-3.5986, 37.1773], "Granada", "cargo-005", "Retail pallets"],
  ["vehicle-006", "FM-206", "6294 SDW", "resting", [-3.5986, 37.1773], "Granada", [-5.9845, 37.3891], "Seville", "cargo-006", "Chilled dairy"],
  ["vehicle-007", "FM-207", "7341 TGF", "needs-attention", [-5.9845, 37.3891], "Seville", [-6.2886, 36.5271], "Cadiz", "cargo-007", "Container parts"],
  ["vehicle-008", "FM-208", "8462 VNB", "critical", [-6.2886, 36.5271], "Cadiz", [-4.4214, 36.7213], "Malaga", "cargo-008", "Urgent spare parts"],
  ["vehicle-009", "FM-209", "9513 WPR", "driving", [-4.4214, 36.7213], "Malaga", [-1.1307, 37.9922], "Murcia", "cargo-009", "Fresh citrus"],
  ["vehicle-010", "FM-210", "1674 XBD", "resting", [-1.1307, 37.9922], "Murcia", [-3.7038, 40.4168], "Madrid", "cargo-010", "Ambient beverages"],
  ["vehicle-011", "FM-211", "2785 YKC", "needs-attention", [-4.0273, 39.8628], "Toledo", [-3.7496, 40.4637], "Alcobendas", "cargo-011", "High-value electronics"],
  ["vehicle-012", "FM-212", "3896 ZMF", "critical", [-1.9812, 43.3183], "Santander", [-3.7038, 40.4168], "Madrid", "cargo-012", "Refrigerated vaccines"],
  ["vehicle-013", "FM-213", "4927 BQH", "driving", [-8.4115, 43.3623], "A Coruna", [-5.6619, 40.9701], "Valladolid", "cargo-013", "Paper rolls"],
  ["vehicle-014", "FM-214", "5638 CRV", "resting", [-4.1088, 38.8786], "Merida", [-3.7038, 40.4168], "Madrid", "cargo-014", "Automotive components"],
  ["vehicle-015", "FM-215", "6749 DTX", "driving", [-3.8099, 43.4623], "Torrelavega", [-2.9349, 43.263], "Bilbao", "cargo-015", "Industrial tooling"],
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

function vehicleFromSeed(seed: VehicleSeed, index: number): Vehicle {
  const [internalId, fleetNumber, plate, status, originCoordinates, originName, destinationCoordinates, destinationName, cargoId, cargoDescription] = seed;
  const routeId = `route-${String(index + 1).padStart(3, "0")}`;
  const route = routeCatalog.get(routeId); const routeProgress = index / (vehicleSeeds.length - 1);
  if (route === undefined) throw new Error(`Missing route fixture ${routeId}.`); assertRouteProgress(routeProgress);
  return {
    internalId, fleetNumber, plate, label: index === 0 ? "" : `Unit ${fleetNumber.slice(-3)}`, position: pointAtRouteProgress(route.geometry.geometry.coordinates, routeProgress), status,
    cargo: cargo(cargoId, index, cargoDescription), dimensions: dimensions(index),
    timing: { remainingDriveMinutes: 45 + index * 19, restDeadline: `2026-08-28T${String(6 + (index % 12)).padStart(2, "0")}:00:00Z`, eta: `2026-08-28T${String(10 + (index % 10)).padStart(2, "0")}:30:00Z`, delayMinutes: index % 4 === 0 ? 25 : 0 },
    origin: place(route.originId, originName, originCoordinates), destination: place(route.destinationId, destinationName, destinationCoordinates), currentRoute: `${originName} to ${destinationName}`, routeId, routeProgress,
    riskIds: route.riskSnaps.map(({ riskId }) => riskId),
  };
}

function snaps(routes: Route[], riskId: string): RiskRouteSnap[] { return routes.flatMap((route) => route.riskSnaps.filter((snap) => snap.riskId === riskId)); }
function affected(routes: Route[], routeSnaps: RiskRouteSnap[]): string[] { const ids = new Set(routeSnaps.map((snap) => routes.find((route) => route.id === snap.routeId)?.vehicleId).filter((id): id is string => id !== undefined)); return [...ids]; }
function snappedLine(routeSnaps: RiskRouteSnap[]) { const snap = routeSnaps[0]; if (snap === undefined) throw new Error("Missing risk snap."); return geoLine(snap.startCoordinate, snap.endCoordinate); }
function createRisks(routes: Route[]): OperationalRisk[] {
  const shared = (id: string, rest: Omit<OperationalRisk, "id" | "geometry" | "affectedVehicleIds" | "routeSnaps">): OperationalRisk => { const routeSnaps = snaps(routes, id); return { id, ...rest, geometry: snappedLine(routeSnaps), affectedVehicleIds: affected(routes, routeSnaps), routeSnaps }; };
  return [
    shared("restriction-height-3.9", { kind: "height-restriction", severity: "high", title: "3.9 m clearance restriction", limitMeters: 3.9 }),
    shared("restriction-weight-26", { kind: "weight-restriction", severity: "medium", title: "26 t weight restriction", limitTonnes: 26 }),
    shared("closure-ap-68", { kind: "road-closure", severity: "critical", title: "AP-68 closure segment" }),
    (() => { const routeSnaps = snaps(routes, "severe-snow-leon"); return { id: "severe-snow-leon", kind: "severe-snow" as const, severity: "high" as const, title: "Severe snow advisory", geometry: geoPolygon([[-5.75, 42.62], [-5.42, 42.62], [-5.42, 42.83], [-5.75, 42.83]]), affectedVehicleIds: affected(routes, routeSnaps), routeSnaps }; })(),
    ...vehicleSeeds.map(([internalId], index) => { const id = `rest-deadline-${internalId}`; const routeSnaps = snaps(routes, id); return { id, kind: "rest-deadline" as const, severity: index % 4 === 3 ? "critical" as const : "high" as const, title: "Driving and rest deadline", geometry: snappedLine(routeSnaps), affectedVehicleIds: [internalId], routeSnaps, vehicleId: internalId, deadline: `2026-08-28T${String(6 + (index % 12)).padStart(2, "0")}:00:00Z` }; }),
  ];
}

export function createSpainScenario(): OperatingRegion {
  const vehicles = vehicleSeeds.map(vehicleFromSeed);
  const routes = vehicles.map((vehicle) => { const fixture = routeCatalog.get(vehicle.routeId); if (fixture === undefined) throw new Error(`Missing route fixture ${vehicle.routeId}.`); return { id: vehicle.routeId, vehicleId: vehicle.internalId, name: vehicle.currentRoute, geometry: fixture.geometry, summary: fixture.summary, riskSnaps: fixture.riskSnaps }; });
  return {
    id: "spain-v1", name: "Iberian operational corridor", vehicles,
    routes,
    risks: createRisks(routes),
  };
}

export { getVehicleDisplayName };
