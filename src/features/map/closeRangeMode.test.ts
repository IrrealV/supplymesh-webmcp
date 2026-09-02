import { describe, expect, it } from "vitest";
import { CLOSE_RANGE_ZOOM_MIN, detectWebGlSupport, isCloseRangeModeActive } from "./closeRangeMode";

const activeInput = {
  isWebGlAvailable: true,
  zoom: CLOSE_RANGE_ZOOM_MIN,
};

describe("close range mode", () => {
  it("should activate at close zoom with webgl", () => {
    expect(isCloseRangeModeActive(activeInput)).toBe(true);
  });

  it.each([
    ["zoom is too far", { zoom: CLOSE_RANGE_ZOOM_MIN - 0.5 }],
    ["WebGL is unavailable", { isWebGlAvailable: false }],
  ])("should remain 2D when %s", (_reason, overrides) => {
    expect(isCloseRangeModeActive({ ...activeInput, ...overrides })).toBe(false);
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
