import { describe, expect, it } from "vitest";
import { CLOSE_RANGE_ZOOM_MIN, detectWebGlSupport, resolveCloseRangeVehicleId } from "./closeRangeMode";

describe("close range mode", () => {
  it("should activate only for the same selected and followed vehicle at close zoom", () => {
    expect(resolveCloseRangeVehicleId({
      followedVehicleId: "vehicle-011",
      isWebGlAvailable: true,
      selectedVehicleId: "vehicle-011",
      zoom: CLOSE_RANGE_ZOOM_MIN,
    })).toBe("vehicle-011");

    expect(resolveCloseRangeVehicleId({
      followedVehicleId: "vehicle-011",
      isWebGlAvailable: true,
      selectedVehicleId: "vehicle-011",
      zoom: CLOSE_RANGE_ZOOM_MIN - 0.5,
    })).toBe("");
    expect(resolveCloseRangeVehicleId({
      followedVehicleId: "vehicle-004",
      isWebGlAvailable: true,
      selectedVehicleId: "vehicle-011",
      zoom: CLOSE_RANGE_ZOOM_MIN,
    })).toBe("");
    expect(resolveCloseRangeVehicleId({
      followedVehicleId: "vehicle-011",
      isWebGlAvailable: false,
      selectedVehicleId: "vehicle-011",
      zoom: CLOSE_RANGE_ZOOM_MIN,
    })).toBe("");
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
