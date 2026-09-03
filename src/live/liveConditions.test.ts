import { describe, expect, it, vi } from "vitest";
import { createSpainScenario } from "../scenario/fixtures/spain-v1";
import { createLiveConditionsStore, type LiveTrafficIncident, type LiveWeatherObservation } from "./liveConditions";

const weather: LiveWeatherObservation = {
  id: "weather:1",
  vehicleId: "vehicle-001",
  vehicleLabel: "Unit 201",
  coordinates: [-3.7, 40.4],
  observedAt: "2026-09-03T20:00:00Z",
  kind: "rain",
  severity: "advisory",
  weatherCode: 61,
  temperatureC: 21,
  precipitationMm: 1.4,
  snowfallCm: 0,
  cloudCoverPercent: 85,
  windSpeedKmh: 24,
  windDirectionDegrees: 250,
  windGustsKmh: 41,
  pm10MicrogramsM3: 12,
  dustMicrogramsM3: 6,
  aerosolOpticalDepth: 0.1,
  europeanAqi: 18,
  summary: "Rain · 21.0 °C",
};

const traffic: LiveTrafficIncident = {
  id: "traffic:1",
  coordinates: [-3.69, 40.42],
  category: "accident",
  severity: "warning",
  title: "Traffic accident · A-1",
  roadName: "A-1",
  province: "Madrid",
  municipality: "Madrid",
  cause: null,
  managementType: null,
  updatedAt: "2026-09-03T20:00:00Z",
  nearestRouteId: "route-001",
  affectedVehicleId: "vehicle-001",
  distanceToRouteKm: 0.4,
};

describe("createLiveConditionsStore", () => {
  it("enables, refreshes, publishes both providers and pauses without discarding evidence", async () => {
    const listeners = vi.fn();
    const store = createLiveConditionsStore(
      () => ({ ok: true, data: createSpainScenario() }),
      {
        fetchImpl: vi.fn<typeof fetch>(),
        now: () => new Date("2026-09-03T20:10:00Z"),
        refreshIntervalMs: 60_000,
        fetchWeather: vi.fn().mockResolvedValue({ observations: [weather], airQualityAvailable: true }),
        fetchTraffic: vi.fn().mockResolvedValue({ incidents: [traffic], nationalIncidentCount: 42, feedPublishedAt: "2026-09-03T20:09:00Z" }),
      },
    );
    const unsubscribe = store.subscribe(listeners);

    const result = await store.enable();

    expect(result.enabled).toBe(true);
    expect(result.refreshing).toBe(false);
    expect(result.weather.provider.state).toBe("ready");
    expect(result.traffic.provider.state).toBe("ready");
    expect(result.summary).toEqual({ observedVehicles: 1, adverseWeatherVehicles: 1, routeRelevantTrafficIncidents: 1 });
    expect(result.traffic.nationalIncidentCount).toBe(42);
    expect(listeners).toHaveBeenCalled();

    store.disable();
    expect(store.read().enabled).toBe(false);
    expect(store.read().weather.observations).toHaveLength(1);
    unsubscribe();
    store.dispose();
  });

  it("returns a degraded snapshot when one public provider is unavailable", async () => {
    const store = createLiveConditionsStore(
      () => ({ ok: true, data: createSpainScenario() }),
      {
        fetchImpl: vi.fn<typeof fetch>(),
        fetchWeather: vi.fn().mockResolvedValue({ observations: [weather], airQualityAvailable: false }),
        fetchTraffic: vi.fn().mockRejectedValue(new Error("DGT timeout")),
      },
    );

    const result = await store.refresh(true);

    expect(result.weather.provider.state).toBe("ready");
    expect(result.traffic.provider.state).toBe("error");
    expect(result.traffic.provider.message).toContain("DGT timeout");
    expect(result.weather.observations).toHaveLength(1);
    store.dispose();
  });
});
