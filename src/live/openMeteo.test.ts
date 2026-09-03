import { describe, expect, it, vi } from "vitest";
import { createSpainScenario } from "../scenario/fixtures/spain-v1";
import { fetchOpenMeteoWeather } from "./openMeteo";

function forecast(index: number) {
  const base = {
    time: "2026-09-03T20:00",
    temperature_2m: 22 + index,
    precipitation: 0,
    rain: 0,
    showers: 0,
    snowfall: 0,
    weather_code: 1,
    cloud_cover: 20,
    wind_speed_10m: 18,
    wind_direction_10m: 245,
    wind_gusts_10m: 28,
  };
  if (index === 0) return { current: { ...base, precipitation: 9, rain: 9, weather_code: 65 } };
  if (index === 1) return { current: { ...base, snowfall: 4, weather_code: 75 } };
  if (index === 2) return { current: { ...base, weather_code: 95, wind_gusts_10m: 82 } };
  return { current: base };
}

function air(index: number) {
  return { current: { pm10: index === 3 ? 145 : 12, dust: index === 3 ? 150 : 8, aerosol_optical_depth: index === 3 ? 0.8 : 0.12, european_aqi: index === 3 ? 86 : 18 } };
}

describe("fetchOpenMeteoWeather", () => {
  it("queries all fleet positions without an API key and classifies live conditions", async () => {
    const scenario = createSpainScenario();
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(scenario.vehicles.map((_, index) => forecast(index))), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(scenario.vehicles.map((_, index) => air(index))), { status: 200 }));

    const result = await fetchOpenMeteoWeather(scenario, fetchImpl, new AbortController().signal);

    expect(result.observations).toHaveLength(15);
    expect(result.airQualityAvailable).toBe(true);
    expect(result.observations[0]).toMatchObject({ vehicleId: "vehicle-001", kind: "rain", severity: "warning" });
    expect(result.observations[1]).toMatchObject({ vehicleId: "vehicle-002", kind: "snow", severity: "warning" });
    expect(result.observations[2]).toMatchObject({ vehicleId: "vehicle-003", kind: "storm", severity: "warning" });
    expect(result.observations[3]).toMatchObject({ vehicleId: "vehicle-004", kind: "calima", severity: "warning" });

    const urls = fetchImpl.mock.calls.map(([input]) => String(input));
    expect(urls[0]).toContain("api.open-meteo.com/v1/forecast");
    expect(urls[1]).toContain("air-quality-api.open-meteo.com/v1/air-quality");
    expect(urls.join(" ")).not.toMatch(/api[_-]?key|apikey/i);
    expect(urls[0]).toContain("latitude=");
    expect(urls[0]).toContain("longitude=");
  });

  it("keeps weather available when the optional air-quality call fails", async () => {
    const scenario = createSpainScenario();
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(scenario.vehicles.map((_, index) => forecast(index))), { status: 200 }))
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }));

    const result = await fetchOpenMeteoWeather(scenario, fetchImpl, new AbortController().signal);

    expect(result.observations).toHaveLength(15);
    expect(result.airQualityAvailable).toBe(false);
    expect(result.observations[0].kind).toBe("rain");
    expect(result.observations[0].dustMicrogramsM3).toBeNull();
  });
});
