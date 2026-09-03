export type LiveDataState = "idle" | "loading" | "ready" | "partial" | "unavailable";

export type LiveWeatherKind = "clear" | "cloudy" | "fog" | "rain" | "snow" | "storm" | "wind";

export type LiveWeatherObservation = Readonly<{
  id: string;
  locationName: string;
  latitude: number;
  longitude: number;
  observedAt: string;
  temperatureC: number;
  apparentTemperatureC: number;
  precipitationMm: number;
  rainMm: number;
  snowfallCm: number;
  weatherCode: number;
  windSpeedKmh: number;
  windGustKmh: number;
  kind: LiveWeatherKind;
}>;

export type LiveTrafficSeverity = "low" | "medium" | "high" | "critical";

export type LiveTrafficEvent = Readonly<{
  id: string;
  eventType: string;
  severity: LiveTrafficSeverity;
  latitude: number;
  longitude: number;
  road: string;
  description: string;
  direction: string;
  updatedAt: string;
  validFrom?: string;
  validTo?: string;
}>;

export type LiveConditionsSnapshot = Readonly<{
  status: Exclude<LiveDataState, "idle" | "loading">;
  fetchedAt: string;
  weather: readonly LiveWeatherObservation[];
  traffic: readonly LiveTrafficEvent[];
  weatherAvailable: boolean;
  trafficAvailable: boolean;
  warnings: readonly string[];
  sources: Readonly<{
    weather: "Open-Meteo";
    traffic: "Dirección General de Tráfico (DGT)";
  }>;
  advisoryOnly: true;
}>;

export const LIVE_WEATHER_STATIONS = [
  { id: "galicia", locationName: "A Coruña", latitude: 43.3623, longitude: -8.4115 },
  { id: "leon", locationName: "León", latitude: 42.5987, longitude: -5.5671 },
  { id: "ebro", locationName: "Zaragoza", latitude: 41.6488, longitude: -0.8891 },
  { id: "centre", locationName: "Madrid", latitude: 40.4168, longitude: -3.7038 },
  { id: "east", locationName: "Valencia", latitude: 39.4699, longitude: -0.3763 },
  { id: "andalusia", locationName: "Granada", latitude: 37.1773, longitude: -3.5986 },
] as const;

export function weatherKindFromCode(code: number, windGustKmh: number): LiveWeatherKind {
  if (code >= 95) return "storm";
  if (code >= 71 && code <= 86) return "snow";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if (code >= 45 && code <= 48) return "fog";
  if (windGustKmh >= 55) return "wind";
  if (code >= 1 && code <= 3) return "cloudy";
  return "clear";
}

export function liveWeatherSymbol(kind: LiveWeatherKind): string {
  if (kind === "rain") return "🌧";
  if (kind === "snow") return "❄";
  if (kind === "storm") return "⚡";
  if (kind === "wind") return "🌬";
  if (kind === "fog") return "🌫";
  if (kind === "cloudy") return "☁";
  return "☀";
}
