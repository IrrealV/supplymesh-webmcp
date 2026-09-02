export const CLOSE_RANGE_ZOOM_MIN = 14;
export const CLOSE_RANGE_FOCUS_ZOOM = 15.5;

type CloseRangeModeInput = Readonly<{
  isWebGlAvailable: boolean;
  zoom: number;
}>;

export type WebGlProbeCanvas = Readonly<{
  getContext(contextId: "webgl2" | "webgl"): object | null;
}>;

function createBrowserProbeCanvas(): WebGlProbeCanvas {
  const canvas = document.createElement("canvas");
  return { getContext: (contextId) => canvas.getContext(contextId) };
}

export function detectWebGlSupport(createCanvas: () => WebGlProbeCanvas = createBrowserProbeCanvas): boolean {
  try {
    const canvas = createCanvas();
    return canvas.getContext("webgl2") !== null || canvas.getContext("webgl") !== null;
  } catch {
    return false;
  }
}

export function isCloseRangeModeActive(input: CloseRangeModeInput): boolean {
  return input.isWebGlAvailable && input.zoom >= CLOSE_RANGE_ZOOM_MIN;
}
