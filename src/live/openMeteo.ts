import type { OperatingRegion } from "../domain/entities";
import type { LiveConditionSeverity, LiveWeatherKind, LiveWeatherObservation } from "./liveConditions";

export type OpenMeteoWeatherResult = Readonly<{
  observations: readonly LiveWeatherObservation[];
  airQualityAvailable: boolean;
}>;

type JsonRecord = Record<string, unknown>;
type CurrentValues = Record<string, unknown>;
type OpenMeteoLocation = Readonly<{ current?: CurrentValues }>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function locations(value: unknown): OpenMeteoLocation[] {
  if (Array.isArray(value)) return value.filter(isRecord) as OpenMeteoLocation[];
  return isRecord(value) ? [value as OpenMeteoLocation] : [];
}

async function fetchJson(url: URL, fetchImpl: typeof fetch, signal: AbortSignal): Promise<unknown> {
  const response = await fetchImpl(url, { headers: { accept: "application/json" }, signal });
  if (!response.ok) throw new Error(`Open-Meteo returned HTTP ${response.status}.`);
  return response.json() as Promise<unknown>;
}

function weatherKind(current: CurrentValues, air: CurrentValues): LiveWeatherKind {
  const code = finite(current.weather_code);
  const precipitation = finite(current.precipitation) ?? 0;
  const rain = finite(current.rain) ?? 0;
  const showers = finite(current.showers) ?? 0;
  const snowfall = finite(current.snowfall) ?? 0;
  const gusts = finite(current.wind_gusts_10m) ?? 0;
  const wind = finite(current.wind_speed_10m) ?? 0;
  const dust = finite(air.dust) ?? 0;
  const aerosol = finite(air.aerosol_optical_depth) ?? 0;
  const cloudCover = finite(current.cloud_cover) ?? 0;

  if (snowfall >= 0.1 || (code !== null && ((code >= 71 && code <= 77) || code === 85 || code === 86))) return "snow";
  if ((code !== null && code >= 95) || gusts >= 72) return "storm";
  if (dust >= 60 || aerosol >= 0.65) return "calima";
  if (rain + showers >= 0.1 || precipitation >= 0.2 || (code !== null && code >= 51 && code <= 82)) return "rain";
  if (code === 45 || code === 48) return "fog";
  if (gusts >= 55 || wind >= 42) return "wind";
  if (cloudCover >= 55 || (code !== null && code >= 1 && code <= 3)) return "cloudy";
  return "clear";
}

function severity(kind: LiveWeatherKind, current: CurrentValues, air: CurrentValues): LiveConditionSeverity {
  const precipitation = finite(current.precipitation) ?? 0;
  const snowfall = finite(current.snowfall) ?? 0;
  const gusts = finite(current.wind_gusts_10m) ?? 0;
  const dust = finite(air.dust) ?? 0;
  const aqi = finite(air.european_aqi) ?? 0;

  if (gusts >= 100 || precipitation >= 20 || snowfall >= 8 || dust >= 250 || aqi > 100) return "critical";
  if (kind === "storm" || gusts >= 75 || precipitation >= 8 || snowfall >= 3 || dust >= 130 || aqi >= 80) return "warning";
  if (!["clear", "cloudy"].includes(kind) || gusts >= 50 || precipitation > 0 || snowfall > 0 || dust >= 60 || aqi >= 60) return "advisory";
  return "normal";
}

function summary(kind: LiveWeatherKind, current: CurrentValues, air: CurrentValues): string {
  const labels: Record<LiveWeatherKind, string> = {
    clear: "Clear",
    cloudy: "Cloudy",
    rain: "Rain",
    snow: "Snow",
    storm: "Storm",
    wind: "Strong wind",
    fog: "Fog",
    calima: "Calima / dust",
  };
  const temperature = finite(current.temperature_2m);
  const gusts = finite(current.wind_gusts_10m);
  const precipitation = finite(current.precipitation);
  const dust = finite(air.dust);
  const details = [
    temperature === null ? null : `${temperature.toFixed(1)} °C`,
    precipitation === null || precipitation <= 0 ? null : `${precipitation.toFixed(1)} mm`,
    gusts === null ? null : `gusts ${Math.round(gusts)} km/h`,
    dust === null || dust < 40 ? null : `dust ${Math.round(dust)} µg/m³`,
  ].filter((value): value is string => value !== null);
  return `${labels[kind]}${details.length > 0 ? ` · ${details.join(" · ")}` : ""}`;
}

function coordinateParams(scenario: OperatingRegion): Readonly<{ latitude: string; longitude: string }> {
  const vehicles = scenario.vehicles.slice(0, 15);
  return {
    latitude: vehicles.map(({ position }) => position.geometry.coordinates[1].toFixed(6)).join(","),
    longitude: vehicles.map(({ position }) => position.geometry.coordinates[0].toFixed(6)).join(","),
  };
}

export async function fetchOpenMeteoWeather(
  scenario: OperatingRegion,
  fetchImpl: typeof fetch,
  signal: AbortSignal,
): Promise<OpenMeteoWeatherResult> {
  const vehicles = scenario.vehicles.slice(0, 15);
  if (vehicles.length === 0) return { observations: [], airQualityAvailable: false };
  const coordinates = coordinateParams(scenario);

  const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
  forecastUrl.searchParams.set("latitude", coordinates.latitude);
  forecastUrl.searchParams.set("longitude", coordinates.longitude);
  forecastUrl.searchParams.set("current", "temperature_2m,precipitation,rain,showers,snowfall,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m");
  forecastUrl.searchParams.set("timezone", "UTC");
  forecastUrl.searchParams.set("forecast_days", "1");

  const airUrl = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  airUrl.searchParams.set("latitude", coordinates.latitude);
  airUrl.searchParams.set("longitude", coordinates.longitude);
  airUrl.searchParams.set("current", "pm10,dust,aerosol_optical_depth,european_aqi");
  airUrl.searchParams.set("timezone", "UTC");
  airUrl.searchParams.set("forecast_days", "1");

  const forecastPayload = await fetchJson(forecastUrl, fetchImpl, signal);
  const forecastLocations = locations(forecastPayload);
  if (forecastLocations.length !== vehicles.length) throw new Error("Open-Meteo returned an unexpected location count.");

  let airLocations: OpenMeteoLocation[] = [];
  try {
    airLocations = locations(await fetchJson(airUrl, fetchImpl, signal));
  } catch {
    airLocations = [];
  }
  const airQualityAvailable = airLocations.length === vehicles.length;

  const observations = vehicles.map((vehicle, index): LiveWeatherObservation => {
    const current = forecastLocations[index]?.current ?? {};
    const air = airLocations[index]?.current ?? {};
    const kind = weatherKind(current, air);
    const [longitude, latitude] = vehicle.position.geometry.coordinates;
    const observedAt = typeof current.time === "string" ? current.time : new Date().toISOString();
    return {
      id: `live-weather:${vehicle.internalId}`,
      vehicleId: vehicle.internalId,
      vehicleLabel: vehicle.label.trim() || vehicle.fleetNumber,
      coordinates: [longitude, latitude],
      observedAt,
      kind,
      severity: severity(kind, current, air),
      weatherCode: finite(current.weather_code),
      temperatureC: finite(current.temperature_2m),
      precipitationMm: finite(current.precipitation),
      snowfallCm: finite(current.snowfall),
      cloudCoverPercent: finite(current.cloud_cover),
      windSpeedKmh: finite(current.wind_speed_10m),
      windDirectionDegrees: finite(current.wind_direction_10m),
      windGustsKmh: finite(current.wind_gusts_10m),
      pm10MicrogramsM3: finite(air.pm10),
      dustMicrogramsM3: finite(air.dust),
      aerosolOpticalDepth: finite(air.aerosol_optical_depth),
      europeanAqi: finite(air.european_aqi),
      summary: summary(kind, current, air),
    };
  });

  return { observations, airQualityAvailable };
}
