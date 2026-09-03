import { describe, expect, it } from "vitest";
import { createSpainScenario } from "../../../scenario/fixtures/spain-v1";
import {
  createWeatherOverlayDataUrl,
  createWeatherOverlaySvg,
  isWeatherRiskKind,
  weatherRiskBounds,
  weatherZoomBand,
} from "./WeatherRiskOverlay";

const rectangle = [
  [-8.65, 43.15],
  [-8.15, 43.15],
  [-8.15, 43.5],
  [-8.65, 43.5],
  [-8.65, 43.15],
] as const;

describe("WeatherRiskOverlay", () => {
  it("should expose rich effects only after overview zoom while preserving a dedicated close band", () => {
    expect(weatherZoomBand(Number.NaN)).toBe("overview");
    expect(weatherZoomBand(6.5)).toBe("overview");
    expect(weatherZoomBand(7.99)).toBe("overview");
    expect(weatherZoomBand(8)).toBe("mid");
    expect(weatherZoomBand(13.99)).toBe("mid");
    expect(weatherZoomBand(14)).toBe("close");
    expect(weatherZoomBand(18)).toBe("close");
  });

  it("should derive Leaflet bounds from the real geographic risk polygon", () => {
    const rain = createSpainScenario().risks.find(({ id }) => id === "heavy-rain-galicia");
    expect(rain).toBeDefined();
    if (rain === undefined) return;

    const bounds = weatherRiskBounds(rain);
    expect(bounds.getWest()).toBeCloseTo(-8.65);
    expect(bounds.getEast()).toBeCloseTo(-8.15);
    expect(bounds.getSouth()).toBeCloseTo(43.15);
    expect(bounds.getNorth()).toBeCloseTo(43.5);
  });

  it("should generate polygon-clipped SVG rather than a fixed circular screen-space effect", () => {
    const rain = createWeatherOverlaySvg("heavy-rain", rectangle, "mid", false);
    expect(rain).toContain('<clipPath id="weather-zone">');
    expect(rain).toContain("<polygon points=");
    expect(rain).toContain('clip-path="url(#weather-zone)"');
    expect(rain).toContain("weather-rain");
    expect(rain).toContain("<line");
    expect(rain).toContain('viewBox="0 0 1000 1000"');
    expect(rain).not.toContain("border-radius");
    expect(rain).not.toContain("360px");
    expect(rain).not.toContain('<circle cx="500" cy="500"');

    const url = createWeatherOverlayDataUrl("heavy-rain", rectangle, "mid", false);
    expect(url.startsWith("data:image/svg+xml;charset=UTF-8,")).toBe(true);
    expect(decodeURIComponent(url)).toContain("weather-rain");
  });

  it("should keep close-range particle sizes screen-legible with repeating patterns", () => {
    const rain = createWeatherOverlaySvg("heavy-rain", rectangle, "close", false);
    const snow = createWeatherOverlaySvg("severe-snow", rectangle, "close", false);
    const storm = createWeatherOverlaySvg("severe-storm", rectangle, "close", false);
    const calima = createWeatherOverlaySvg("calima", rectangle, "close", false);

    expect(rain).toContain('viewBox="0 0 8000 8000"');
    expect(rain).toContain('pattern id="weather-rain-pattern"');
    expect(rain).toContain('width="64" height="88"');
    expect(snow).toContain('pattern id="weather-snow-pattern"');
    expect(snow).toContain('width="104" height="104"');
    expect(storm).toContain('pattern id="weather-storm-pattern"');
    expect(storm).toContain("weather-close-lightning");
    expect(calima).toContain('pattern id="weather-calima-pattern"');
    expect(calima).toContain("weather-calima-base");
    expect(new Set([rain, snow, storm, calima]).size).toBe(4);

    // The previous implementation generated a handful of shapes in a fixed
    // 1000-unit viewBox, which turned into enormous drops/flakes at close zoom.
    expect(rain.match(/<line/g)?.length).toBe(2);
    expect(snow.match(/<circle/g)?.length).toBe(4);
  });

  it("should keep reduced-motion weather visible while removing its animation rules", () => {
    const staticRain = createWeatherOverlaySvg("heavy-rain", rectangle, "close", true);
    expect(staticRain).toContain("weather-rain-pattern");
    expect(staticRain).toContain("<line");
    expect(staticRain).not.toContain("@keyframes");
    expect(staticRain).not.toContain("animation:");
  });

  it("should identify only supported weather risk kinds", () => {
    expect(isWeatherRiskKind("heavy-rain")).toBe(true);
    expect(isWeatherRiskKind("severe-snow")).toBe(true);
    expect(isWeatherRiskKind("severe-storm")).toBe(true);
    expect(isWeatherRiskKind("calima")).toBe(true);
    expect(isWeatherRiskKind("road-closure")).toBe(false);
  });
});
