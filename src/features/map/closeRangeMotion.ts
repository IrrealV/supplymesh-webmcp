export type RouteCoordinate = readonly [longitude: number, latitude: number];
export type RoutePath = Readonly<{ cumulative: readonly number[]; length: number; points: readonly RouteCoordinate[] }>;
export type RouteSample = Readonly<{ bearing: number; coordinate: RouteCoordinate; progress: number }>;
export type FrameScheduler = Readonly<{ cancel(id: number): void; request(callback: FrameRequestCallback): number }>;

function clampProgress(progress: number): number {
  return Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
}

function segmentLength([leftLongitude, leftLatitude]: RouteCoordinate, [rightLongitude, rightLatitude]: RouteCoordinate): number {
  const longitudeScale = Math.cos(((leftLatitude + rightLatitude) / 2) * Math.PI / 180);
  return Math.hypot((rightLongitude - leftLongitude) * longitudeScale, rightLatitude - leftLatitude);
}

export function prepareRoutePath(coordinates: readonly (readonly number[])[]): RoutePath {
  if (coordinates.length < 2) { throw new Error("Close-range motion requires route geometry."); }
  const points = coordinates.map((coordinate): RouteCoordinate => {
    const [longitude, latitude] = coordinate;
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) { throw new Error("Close-range route geometry is invalid."); }
    return [longitude, latitude];
  });
  const cumulative = [0];
  for (let index = 1; index < points.length; index += 1) {
    cumulative.push(cumulative[index - 1] + segmentLength(points[index - 1], points[index]));
  }
  return { cumulative, length: cumulative.at(-1)!, points };
}

function coordinateAt(path: RoutePath, distance: number): RouteCoordinate {
  if (path.length === 0 || distance <= 0) { return path.points[0]; }
  if (distance >= path.length) { return path.points.at(-1)!; }
  let low = 1; let high = path.cumulative.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (path.cumulative[middle] < distance) { low = middle + 1; } else { high = middle; }
  }
  const startDistance = path.cumulative[low - 1];
  const segmentDistance = path.cumulative[low] - startDistance;
  const ratio = segmentDistance === 0 ? 0 : (distance - startDistance) / segmentDistance;
  const [startLongitude, startLatitude] = path.points[low - 1];
  const [endLongitude, endLatitude] = path.points[low];
  return [startLongitude + (endLongitude - startLongitude) * ratio, startLatitude + (endLatitude - startLatitude) * ratio];
}

function bearingBetween([startLongitude, startLatitude]: RouteCoordinate, [endLongitude, endLatitude]: RouteCoordinate): number {
  const east = (endLongitude - startLongitude) * Math.cos(((startLatitude + endLatitude) / 2) * Math.PI / 180);
  const north = endLatitude - startLatitude;
  return (Math.atan2(east, north) * 180 / Math.PI + 360) % 360;
}

export function sampleRoutePath(path: RoutePath, progress: number): RouteSample {
  const boundedProgress = clampProgress(progress);
  const distance = path.length * boundedProgress;
  const lookAhead = Math.max(path.length * 0.0004, Number.EPSILON);
  const coordinate = coordinateAt(path, distance);
  const bearing = bearingBetween(coordinateAt(path, distance - lookAhead), coordinateAt(path, distance + lookAhead));
  return { bearing, coordinate, progress: boundedProgress };
}

export function advanceRouteProgress(progress: number, elapsedMs: number, distanceMeters: number, speedMetersPerSecond: number): number {
  const boundedProgress = clampProgress(progress);
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0 || !Number.isFinite(distanceMeters) || distanceMeters <= 0 || !Number.isFinite(speedMetersPerSecond) || speedMetersPerSecond <= 0) { return boundedProgress; }
  return clampProgress(boundedProgress + speedMetersPerSecond * elapsedMs / 1_000 / distanceMeters);
}

export function resolveActiveRoute<T extends { id: string; vehicleId: string }>(routes: readonly T[], vehicleId: string, routeId: string): T | undefined {
  return routes.find((route) => route.id === routeId && route.vehicleId === vehicleId);
}

export function startFrameLoop(scheduler: FrameScheduler, onFrame: FrameRequestCallback): () => void {
  let active = true; let frame = 0;
  const run: FrameRequestCallback = (time) => {
    if (!active) { return; }
    onFrame(time);
    if (active) { frame = scheduler.request(run); }
  };
  frame = scheduler.request(run);
  return () => { active = false; scheduler.cancel(frame); };
}
