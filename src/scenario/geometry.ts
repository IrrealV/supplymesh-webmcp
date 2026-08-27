import { lineString, point, polygon } from "@turf/helpers";
import type { Position } from "geojson";
import type { GeoLine, GeoPoint, GeoPolygon } from "../domain/entities";

export type Coordinates = Position;

export function geoPoint(coordinates: Coordinates): GeoPoint {
  return point(coordinates);
}

export function geoLine(...coordinates: Coordinates[]): GeoLine {
  return lineString(coordinates);
}

export function geoPolygon(coordinates: Coordinates[]): GeoPolygon {
  return polygon([[...coordinates, coordinates[0]]]);
}
