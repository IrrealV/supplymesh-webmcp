import type { Feature, LineString, Point, Polygon } from "geojson";

export const VehicleStatuses = {
  driving: "driving",
  resting: "resting",
  needsAttention: "needs-attention",
  critical: "critical",
} as const;

export type VehicleStatus = (typeof VehicleStatuses)[keyof typeof VehicleStatuses];
export type GeoPoint = Feature<Point>;
export type GeoLine = Feature<LineString>;
export type GeoPolygon = Feature<Polygon>;
export type RiskSeverity = "low" | "medium" | "high" | "critical";
export type RiskKind =
  | "height-restriction"
  | "weight-restriction"
  | "road-closure"
  | "severe-snow"
  | "rest-deadline";

export type Place = { name: string; position: GeoPoint };
export type Cargo = { description: string; refrigeration: "ambient" | "chilled" | "frozen"; priority: "standard" | "priority" | "critical" };
export type Dimensions = { vehicleType: string; lengthMeters: number; heightMeters: number; weightTonnes: number };
export type Timing = { remainingDriveMinutes: number; restDeadline: string; eta: string; delayMinutes: number };
export type Vehicle = {
  internalId: string;
  fleetNumber: string;
  label: string;
  plate: string;
  position: GeoPoint;
  status: VehicleStatus;
  cargo: Cargo;
  dimensions: Dimensions;
  timing: Timing;
  origin: Place;
  destination: Place;
  currentRoute: string;
  routeId: string;
  riskIds: string[];
};
export type Route = { id: string; vehicleId: string; name: string; geometry: GeoLine };
export type OperationalRisk = {
  id: string;
  kind: RiskKind;
  severity: RiskSeverity;
  title: string;
  geometry: GeoLine | GeoPolygon;
  affectedVehicleIds: string[];
  limitMeters?: number;
  limitTonnes?: number;
  vehicleId?: string;
  deadline?: string;
};
export type OperatingRegion = { id: string; name: string; vehicles: Vehicle[]; routes: Route[]; risks: OperationalRisk[] };
export type FleetStatus = { total: number; byStatus: Record<VehicleStatus, number> };
export type DomainResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };
export type VehicleRenameCommand = { vehicleId: string; label: string };

export function getVehicleDisplayName(vehicle: Vehicle): string {
  return vehicle.label.trim() || vehicle.fleetNumber;
}
