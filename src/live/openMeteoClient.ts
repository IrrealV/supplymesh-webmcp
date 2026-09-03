import { LIVE_WEATHER_STATIONS, weatherKindFromCode, type LiveWeatherObservation } from "./liveConditions";

const OPEN_METEO_ENDPOINT = "https://api.open-meteo.com/v1/forecast";
const CURRENT_FIELDS = [
  "temperature_2m",
  "apparent_temperature",
  "precipitation",
  "rain",
  "snowfall",
  "weather_code",
  "wind_speed_10m",
  "wind_gusts_10m",
].join(",");

type OpenMeteoCurrent = {
  time?: unknown;
  temperature_2m?: unknown;
  apparent_temperature?: unknown;
  precipitation?: unknown;
  rain?: unknown;
  snowfall?: unknown;
  weather_code?: unknown;
  wind_speed_10m?: unknown;
  wind_gusts_10m?: unknown;
};

type OpenMeteoResponse = { current?: OpenMeteoCurrent };

function finite(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Open-Meteo returned an invalid ${field}.`);
  return value;
}

function observedAt(value: unknown): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new Error("Open-Meteo returned an invalid observation time.");
  return value.endsWith("Z") ? value : `${value}Z`;
}

async function fetchStation(station: (typeof LIVE_WEATHER_STATIONS)[number], signal: AbortSignal): Promise<LiveWeatherObservation> {
  const url = new URL(OPEN_METEO_ENDPOINT);
  url.searchParams.set("latitude", String(station.latitude));
  url.searchParams.set("longitude", String(station.longitude));
  url.searchParams.set("current", CURRENT_FIELDS);
  url.searchParams.set("timezone", "UTC");
  url.searchParams.set("forecast_days", "1");

  const response = await fetch(url, { headers: { Accept: "application/json" }, signal });
  if (!response.ok) throw new Error(`Open-Meteo returned HTTP ${response.status}.`);
  const body = await response.json() as OpenMeteoResponse;
  const current = body.current;
  if (current === undefined) throw new Error("Open-Meteo omitted current conditions.");

  const windGustKmh = finite(current.wind_gusts_10m, "wind gust");
  const weatherCode = finite(current.weather_code, "weather code");
  return {
    ...station,
    apparentTemperatureC: finite(current.apparent_temperature, "apparent temperature"),
    kind: weatherKindFromCode(weatherCode, windGustKmh),
    observedAt: observedAt(current.time),
    precipitationMm: finite(current.precipitation, "precipitation"),
    rainMm: finite(current.rain, "rain"),
    snowfallCm: finite(current.snowfall, "snowfall"),
    temperatureC: finite(current.temperature_2m, "temperature"),
    weatherCode,
    windGustKmh,
    windSpeedKmh: finite(current.wind_speed_10m, "wind speed"),
  };
}

export async function fetchLiveWeather(signal: AbortSignal): Promise<readonly LiveWeatherObservation[]> {
  const results = await Promise.allSettled(LIVE_WEATHER_STATIONS.map((station) => fetchStation(station, signal)));
  const observations = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  if (observations.length === 0) throw new Error("No live weather station returned a valid observation.");
  return observations;
}
