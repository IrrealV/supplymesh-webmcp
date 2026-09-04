import distance from "@turf/distance";
import { point } from "@turf/helpers";

type Coordinate = readonly [number, number];
type CoordinateLike = readonly number[];

export const UNIT_211_ROUTE_JOIN_TOLERANCE_METERS = 1;

export type Unit211RouteCoherence = Readonly<{
  vehicleCoordinate: Coordinate;
  diversionCoordinate: Coordinate;
  currentDiversionIndex: number;
  alternativeDiversionIndex: number;
  hazardIndex: number;
  toleranceMeters: number;
  vehicleDistanceMeters: number;
  diversionDistanceMeters: number;
  hazardDistanceMeters: number;
  vehicleToDiversionMeters: number;
  diversionToHazardMeters: number;
}>;

type Input = Readonly<{
  currentCoordinates: readonly CoordinateLike[];
  alternativeCoordinates: readonly CoordinateLike[];
  vehicleCoordinate: CoordinateLike;
  hazardIndex: number;
  toleranceMeters?: number;
}>;

function distanceMeters(left: Coordinate, right: Coordinate): number {
  return distance(point([left[0], left[1]]), point([right[0], right[1]]), { units: "meters" });
}

function coordinate(value: CoordinateLike): Coordinate {
  if (value.length !== 2 || !Number.isFinite(value[0]) || !Number.isFinite(value[1])) throw new Error("Unit 211 coordinate is invalid.");
  return [value[0], value[1]];
}

function cumulativeDistances(coordinates: readonly Coordinate[]): number[] {
  const distances = [0];
  for (let index = 1; index < coordinates.length; index += 1) {
    distances.push(distances[index - 1] + distanceMeters(coordinates[index - 1], coordinates[index]));
  }
  return distances;
}

export function deriveUnit211RouteCoherence({ currentCoordinates, alternativeCoordinates, vehicleCoordinate, hazardIndex, toleranceMeters = UNIT_211_ROUTE_JOIN_TOLERANCE_METERS }: Input): Unit211RouteCoherence {
  if (!Number.isFinite(toleranceMeters) || toleranceMeters <= 0 || currentCoordinates.length < 3 || alternativeCoordinates.length < 3) throw new Error("Unit 211 route geometry is invalid.");
  if (!Number.isInteger(hazardIndex) || hazardIndex <= 0 || hazardIndex >= currentCoordinates.length) throw new Error("Unit 211 hazard index is invalid.");

  const current = currentCoordinates.map(coordinate); const alternative = alternativeCoordinates.map(coordinate); const vehicle = coordinate(vehicleCoordinate);
  const sharedCount = Math.min(current.length, alternative.length);
  let diversionIndex = -1;
  for (let index = 0; index < sharedCount; index += 1) {
    if (distanceMeters(current[index], alternative[index]) > toleranceMeters) break;
    diversionIndex = index;
  }
  if (diversionIndex <= 0 || diversionIndex >= sharedCount - 1) throw new Error("Unit 211 routes do not expose a bounded shared diversion.");

  const vehicleIndex = current.findIndex((candidate) => distanceMeters(candidate, vehicle) <= toleranceMeters);
  if (vehicleIndex < 0) throw new Error("Unit 211 is not on the current route geometry.");
  const cumulative = cumulativeDistances(current);
  const vehicleDistanceMeters = cumulative[vehicleIndex];
  const diversionDistanceMeters = cumulative[diversionIndex];
  const hazardDistanceMeters = cumulative[hazardIndex];
  if (!(vehicleDistanceMeters < diversionDistanceMeters && diversionDistanceMeters < hazardDistanceMeters)) throw new Error("Unit 211 route ordering is incoherent.");

  return Object.freeze({
    vehicleCoordinate: [vehicle[0], vehicle[1]] as const,
    diversionCoordinate: [current[diversionIndex][0], current[diversionIndex][1]] as const,
    currentDiversionIndex: diversionIndex,
    alternativeDiversionIndex: diversionIndex,
    hazardIndex,
    toleranceMeters,
    vehicleDistanceMeters,
    diversionDistanceMeters,
    hazardDistanceMeters,
    vehicleToDiversionMeters: diversionDistanceMeters - vehicleDistanceMeters,
    diversionToHazardMeters: hazardDistanceMeters - diversionDistanceMeters,
  });
}
