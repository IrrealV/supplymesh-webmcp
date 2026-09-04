import { describe, expect, it } from "vitest";
import { advanceRouteProgress, prepareRoutePath, resolveActiveRoute, sampleRoutePath, startFrameLoop, type FrameScheduler } from "./closeRangeMotion";

describe("close range route motion", () => {
  it("should sample a distance-weighted path and clamp progress to its endpoints", () => {
    const path = prepareRoutePath([[0, 0], [0, 1], [2, 1]]);

    expect(sampleRoutePath(path, -1).coordinate).toStrictEqual([0, 0]);
    expect(sampleRoutePath(path, 0.5).coordinate[0]).toBeCloseTo(0.5, 2);
    expect(sampleRoutePath(path, 2).coordinate).toStrictEqual([2, 1]);
  });

  it.each([
    ["north", [[0, 0], [0, 1]], 0],
    ["east", [[0, 0], [1, 0]], 90],
    ["south", [[0, 1], [0, 0]], 180],
    ["west", [[1, 0], [0, 0]], 270],
  ] as const)("should expose %s bearing from adjacent route geometry", (_direction, coordinates, bearing) => {
    expect(sampleRoutePath(prepareRoutePath(coordinates), 0.5).bearing).toBeCloseTo(bearing, 4);
  });

  it("should advance by physical speed without mutating or exceeding progress bounds", () => {
    const initial = 0.5;

    expect(advanceRouteProgress(initial, 1_000, 100, 10)).toBeCloseTo(0.6, 6);
    expect(advanceRouteProgress(0.99, 1_000, 100, 10)).toBe(1);
    expect(advanceRouteProgress(initial, -1, 100, 10)).toBe(initial);
  });

  it("should resolve route replacement from the vehicle current route identity", () => {
    const routes = [
      { id: "current", vehicleId: "vehicle-011" },
      { id: "replacement", vehicleId: "vehicle-011" },
    ];

    expect(resolveActiveRoute(routes, "vehicle-011", "current")?.id).toBe("current");
    expect(resolveActiveRoute(routes, "vehicle-011", "replacement")?.id).toBe("replacement");
  });

  it("should cancel the pending frame and reject late callbacks after cleanup", () => {
    const callbacks = new Map<number, FrameRequestCallback>();
    let nextId = 0;
    const scheduler: FrameScheduler = {
      cancel: (id) => { callbacks.delete(id); },
      request: (callback) => { const id = ++nextId; callbacks.set(id, callback); return id; },
    };
    const frames: number[] = [];
    const stop = startFrameLoop(scheduler, (time) => { frames.push(time); });
    const first = callbacks.get(1)!; callbacks.delete(1); first(16);
    const late = callbacks.get(2)!;

    stop();
    late(32);

    expect(frames).toStrictEqual([16]);
    expect(callbacks.size).toBe(0);
  });
});
