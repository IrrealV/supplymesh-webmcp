import along from "@turf/along";
import { lineString } from "@turf/helpers";
import length from "@turf/length";
import type { GeoPoint } from "../domain/entities";
import { geoPoint, type Coordinates } from "./geometry";

export function assertRouteProgress(progress: number): void { if (!Number.isFinite(progress) || progress < 0 || progress > 1) throw new Error(`Invalid route progress ${String(progress)}.`); }
export function pointAtRouteProgress(coordinates: Coordinates[], progress: number): GeoPoint {
  if (!Number.isFinite(progress) || coordinates.length < 2) throw new Error("Cannot resolve route position.");
  if (progress <= 0) return geoPoint(coordinates[0]);
  if (progress >= 1) return geoPoint(coordinates.at(-1)!);
  const route = lineString(coordinates); return geoPoint(along(route, length(route) * progress).geometry.coordinates);
}
