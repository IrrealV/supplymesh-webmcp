import { describe, expect, it } from "vitest";
import { CLOSE_RANGE_ZOOM_MIN, detectWebGlSupport, resolveCloseRangeVehicleId } from "./closeRangeMode";

const activeVehicle = {
  followedVehicleId: "vehicle-011",
  isWebGlAvailable: true,
  selectedVehicleId: "vehicle-011",
  zoom: CLOSE_RANGE_ZOOM_MIN,
};

describe("close range mode", () => {
  it("should activate only for the same selected and followed vehicle at close zoom", () => {
    expect(resolveCloseRangeVehicleId(activeVehicle)).toBe("vehicle-011");
  });

  it.each([
    ["zoom is too far", { zoom: CLOSE_RANGE_ZOOM_MIN - 0.5 }],
    ["another vehicle is followed", { followedVehicleId: "vehicle-004" }],
    ["WebGL is unavailable", { isWebGlAvailable: false }],
  ])("should remain 2D when %s", (_reason, overrides) => {
    expect(resolveCloseRangeVehicleId({ ...activeVehicle, ...overrides })).toBe("");
  });

  it("should probe WebGL without retaining or attaching the probe canvas", () => {
    let probeCount = 0;
    const supported = detectWebGlSupport(() => {
      probeCount += 1;
      return { getContext: (contextId) => contextId === "webgl" ? {} : null };
    });

    expect(supported).toBe(true);
    expect(probeCount).toBe(1);
    expect(document.querySelectorAll("canvas")).toHaveLength(0);
  });

  it("should fail closed when WebGL probing throws", () => {
    expect(detectWebGlSupport(() => { throw new Error("blocked"); })).toBe(false);
  });
});
