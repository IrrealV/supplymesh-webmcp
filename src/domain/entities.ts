import type { Feature, LineString, Point, Polygon } from "geojson";

export const VEHICLE_LABEL_LENGTH_MAX = 64;

export function isVehicleLabelValid(label: string): boolean {
  const normalizedLength = label.trim().length;
  return normalizedLength > 0 && normalizedLength <= VEHICLE_LABEL_LENGTH_MAX;
}

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
export type RouteSummary = { distanceMeters: number; durationSeconds: number };
export type RiskRouteSnap = { riskId: string; routeId?: string; kind: "point" | "segment"; startIndex: number; endIndex: number; startCoordinate: number[]; endCoordinate: number[] };
export type RiskSeverity = "low" | "medium" | "high" | "critical";
export type RiskKind =
  | "height-restriction"
  | "weight-restriction"
  | "road-closure"
  | "severe-snow"
  | "heavy-rain"
  | "severe-storm"
  | "calima"
  | "rest-deadline"
  | "landslide";

export type Place = { id: string; name: string; position: GeoPoint };
export type Cargo = { id: string; description: string; refrigeration: "ambient" | "chilled" | "frozen"; priority: "standard" | "priority" | "critical" };
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
  routeProgress: number;
  riskIds: string[];
  speedKmH?: number;
};
export type Route = { id: string; vehicleId: string; name: string; geometry: GeoLine; summary: RouteSummary; riskSnaps: RiskRouteSnap[] };
export type OperationalRisk = {
  id: string;
  kind: RiskKind;
  severity: RiskSeverity;
  title: string;
  geometry: GeoLine | GeoPolygon;
  affectedVehicleIds: string[];
  routeSnaps?: RiskRouteSnap[];
  limitMeters?: number;
  limitTonnes?: number;
  vehicleId?: string;
  deadline?: string;
};
export type OperatingRegion = { id: string; name: string; vehicles: Vehicle[]; routes: Route[]; risks: OperationalRisk[] };
export type FleetStatus = { total: number; byStatus: Record<VehicleStatus, number> };
export type DomainResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };
export type VehicleRenameCommand = { vehicleId: string; label: string };
export type VehicleCreateCommand = {
  fleetNumber: string;
  plate: string;
  label: string;
  dimensions: Dimensions;
  cargo: Omit<Cargo, "id">;
  routeId?: string;
};
export type VehicleUpdateCommand = {
  vehicleId: string;
  plate: string;
  label: string;
  dimensions: Dimensions;
  cargo: Omit<Cargo, "id">;
};
export type VehicleAssignRouteCommand = {
  vehicleId: string;
  routeId: string | undefined;
};

export function getVehicleDisplayName(vehicle: Vehicle): string {
  return vehicle.label.trim() || vehicle.fleetNumber;
}
