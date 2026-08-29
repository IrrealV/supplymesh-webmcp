import { describe, expect, it } from "vitest";
import { pointAtRouteProgress } from "./routeRuntime";

const route = [[-3, 40], [-2, 41], [-1, 42]];
describe("route runtime", () => {
  it("should resolve exact endpoints at progress bounds", () => {
    expect(pointAtRouteProgress(route, 0).geometry.coordinates).toStrictEqual(route[0]);
    expect(pointAtRouteProgress(route, 1).geometry.coordinates).toStrictEqual(route[2]);
    expect(pointAtRouteProgress(route, -1).geometry.coordinates).toStrictEqual(route[0]);
    expect(pointAtRouteProgress(route, 2).geometry.coordinates).toStrictEqual(route[2]);
  });
  it.each([Number.NaN, Number.POSITIVE_INFINITY])("should reject invalid progress %s", (progress) => { expect(() => pointAtRouteProgress(route, progress)).toThrow("Cannot resolve route position"); });
});
