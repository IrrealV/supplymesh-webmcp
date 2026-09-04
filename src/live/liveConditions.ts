import type { DomainResult, OperatingRegion } from "../domain/entities";
import { fetchDgtTraffic, type DgtTrafficResult } from "./dgtTraffic";
import { fetchOpenMeteoWeather, type OpenMeteoWeatherResult } from "./openMeteo";

export const LIVE_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const MINIMUM_REFRESH_GAP_MS = 20 * 1000;
const REQUEST_TIMEOUT_MS = 12 * 1000;

export type LiveProviderState = "idle" | "loading" | "ready" | "error";
export type LiveConditionSeverity = "normal" | "advisory" | "warning" | "critical";
export type LiveWeatherKind = "clear" | "cloudy" | "rain" | "snow" | "storm" | "wind" | "fog" | "calima";
export type LiveTrafficCategory = "accident" | "congestion" | "closure" | "works" | "vehicle" | "weather" | "obstruction" | "other";

export type LiveWeatherObservation = Readonly<{
  id: string;
  vehicleId: string;
  vehicleLabel: string;
  coordinates: readonly [longitude: number, latitude: number];
  observedAt: string;
  kind: LiveWeatherKind;
  severity: LiveConditionSeverity;
  weatherCode: number | null;
  temperatureC: number | null;
  precipitationMm: number | null;
  snowfallCm: number | null;
  cloudCoverPercent: number | null;
  windSpeedKmh: number | null;
  windDirectionDegrees: number | null;
  windGustsKmh: number | null;
  pm10MicrogramsM3: number | null;
  dustMicrogramsM3: number | null;
  aerosolOpticalDepth: number | null;
  europeanAqi: number | null;
  summary: string;
}>;

export type LiveTrafficIncident = Readonly<{
  id: string;
  coordinates: readonly [longitude: number, latitude: number];
  category: LiveTrafficCategory;
  severity: LiveConditionSeverity;
  title: string;
  roadName: string | null;
  province: string | null;
  municipality: string | null;
  cause: string | null;
  managementType: string | null;
  updatedAt: string | null;
  nearestRouteId: string;
  affectedVehicleId: string | null;
  distanceToRouteKm: number;
}>;

export type LiveProviderSnapshot = Readonly<{
  state: LiveProviderState;
  source: string;
  attribution: string;
  fetchedAt: string | null;
  message: string | null;
}>;

export type LiveConditionsSnapshot = Readonly<{
  enabled: boolean;
  refreshing: boolean;
  fetchedAt: string | null;
  advisoryOnly: true;
  weather: Readonly<{
    provider: LiveProviderSnapshot;
    observations: readonly LiveWeatherObservation[];
    airQualityAvailable: boolean;
  }>;
  traffic: Readonly<{
    provider: LiveProviderSnapshot;
    incidents: readonly LiveTrafficIncident[];
    nationalIncidentCount: number;
    coverageNote: string;
  }>;
  summary: Readonly<{
    observedVehicles: number;
    adverseWeatherVehicles: number;
    routeRelevantTrafficIncidents: number;
  }>;
}>;

export type LiveConditionsStore = Readonly<{
  read(): LiveConditionsSnapshot;
  subscribe(listener: (snapshot: LiveConditionsSnapshot) => void): () => void;
  enable(): Promise<LiveConditionsSnapshot>;
  disable(): void;
  refresh(force?: boolean): Promise<LiveConditionsSnapshot>;
  dispose(): void;
}>;

type LiveConditionsDependencies = Readonly<{
  fetchImpl?: typeof fetch;
  now?: () => Date;
  refreshIntervalMs?: number;
  fetchWeather?: (scenario: OperatingRegion, fetchImpl: typeof fetch, signal: AbortSignal) => Promise<OpenMeteoWeatherResult>;
  fetchTraffic?: (scenario: OperatingRegion, fetchImpl: typeof fetch, signal: AbortSignal) => Promise<DgtTrafficResult>;
}>;

function provider(state: LiveProviderState, source: string, attribution: string, fetchedAt: string | null = null, message: string | null = null): LiveProviderSnapshot {
  return { state, source, attribution, fetchedAt, message };
}

function initialSnapshot(): LiveConditionsSnapshot {
  return {
    enabled: false,
    refreshing: false,
    fetchedAt: null,
    advisoryOnly: true,
    weather: {
      provider: provider("idle", "Open-Meteo", "Weather: Open-Meteo; air quality: CAMS via Open-Meteo"),
      observations: [],
      airQualityAvailable: false,
    },
    traffic: {
      provider: provider("idle", "DGT DATEX II", "Traffic incidents: Dirección General de Tráfico"),
      incidents: [],
      nationalIncidentCount: 0,
      coverageNote: "DGT coverage excludes Catalonia and the Basque Country.",
    },
    summary: {
      observedVehicles: 0,
      adverseWeatherVehicles: 0,
      routeRelevantTrafficIncidents: 0,
    },
  };
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) return error.message.slice(0, 180);
  return "Live provider unavailable.";
}

function scenarioFrom(result: DomainResult<OperatingRegion>): OperatingRegion {
  if (!result.ok) throw new Error("The current scenario is unavailable.");
  return result.data;
}

export function createLiveConditionsStore(
  getScenario: () => DomainResult<OperatingRegion>,
  dependencies: LiveConditionsDependencies = {},
): LiveConditionsStore {
  const fetchImpl = dependencies.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const now = dependencies.now ?? (() => new Date());
  const refreshIntervalMs = dependencies.refreshIntervalMs ?? LIVE_REFRESH_INTERVAL_MS;
  const fetchWeather = dependencies.fetchWeather ?? fetchOpenMeteoWeather;
  const fetchTraffic = dependencies.fetchTraffic ?? fetchDgtTraffic;
  const listeners = new Set<(snapshot: LiveConditionsSnapshot) => void>();
  let snapshot = initialSnapshot();
  let timer: ReturnType<typeof setInterval> | undefined;
  let inFlight: Promise<LiveConditionsSnapshot> | undefined;
  let lastAttemptAt = 0;
  let disposed = false;

  const publish = (next: LiveConditionsSnapshot): LiveConditionsSnapshot => {
    snapshot = next;
    for (const listener of listeners) listener(snapshot);
    return snapshot;
  };

  const schedule = (): void => {
    if (timer !== undefined || disposed || !snapshot.enabled) return;
    timer = setInterval(() => { void refresh(false); }, refreshIntervalMs);
  };

  const clearSchedule = (): void => {
    if (timer === undefined) return;
    clearInterval(timer);
    timer = undefined;
  };

  const refresh = async (force = false): Promise<LiveConditionsSnapshot> => {
    if (disposed) return snapshot;
    if (inFlight !== undefined) return inFlight;
    const attemptAt = now().getTime();
    if (!force && snapshot.fetchedAt !== null && attemptAt - lastAttemptAt < MINIMUM_REFRESH_GAP_MS) return snapshot;
    lastAttemptAt = attemptAt;

    const previous = snapshot;
    publish({
      ...previous,
      refreshing: true,
      weather: { ...previous.weather, provider: { ...previous.weather.provider, state: "loading", message: null } },
      traffic: { ...previous.traffic, provider: { ...previous.traffic.provider, state: "loading", message: null } },
    });

    inFlight = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const fetchedAt = now().toISOString();

      try {
        const scenario = scenarioFrom(getScenario());
        const [weatherResult, trafficResult] = await Promise.allSettled([
          fetchWeather(scenario, fetchImpl, controller.signal),
          fetchTraffic(scenario, fetchImpl, controller.signal),
        ]);

        const weather = weatherResult.status === "fulfilled"
          ? {
              provider: provider("ready", "Open-Meteo", "Weather: Open-Meteo; air quality: CAMS via Open-Meteo", fetchedAt),
              observations: weatherResult.value.observations,
              airQualityAvailable: weatherResult.value.airQualityAvailable,
            }
          : {
              ...previous.weather,
              provider: provider("error", "Open-Meteo", "Weather: Open-Meteo; air quality: CAMS via Open-Meteo", previous.weather.provider.fetchedAt, safeErrorMessage(weatherResult.reason)),
            };

        const traffic = trafficResult.status === "fulfilled"
          ? {
              provider: provider("ready", "DGT DATEX II", "Traffic incidents: Dirección General de Tráfico", fetchedAt),
              incidents: trafficResult.value.incidents,
              nationalIncidentCount: trafficResult.value.nationalIncidentCount,
              coverageNote: "DGT coverage excludes Catalonia and the Basque Country.",
            }
          : {
              ...previous.traffic,
              provider: provider("error", "DGT DATEX II", "Traffic incidents: Dirección General de Tráfico", previous.traffic.provider.fetchedAt, safeErrorMessage(trafficResult.reason)),
            };

        return publish({
          enabled: snapshot.enabled,
          refreshing: false,
          fetchedAt,
          advisoryOnly: true,
          weather,
          traffic,
          summary: {
            observedVehicles: weather.observations.length,
            adverseWeatherVehicles: weather.observations.filter(({ severity }) => severity !== "normal").length,
            routeRelevantTrafficIncidents: traffic.incidents.length,
          },
        });
      } finally {
        clearTimeout(timeout);
        inFlight = undefined;
      }
    })().catch((error) => publish({
      ...snapshot,
      refreshing: false,
      fetchedAt: now().toISOString(),
      weather: { ...snapshot.weather, provider: provider("error", "Open-Meteo", "Weather: Open-Meteo; air quality: CAMS via Open-Meteo", snapshot.weather.provider.fetchedAt, safeErrorMessage(error)) },
      traffic: { ...snapshot.traffic, provider: provider("error", "DGT DATEX II", "Traffic incidents: Dirección General de Tráfico", snapshot.traffic.provider.fetchedAt, safeErrorMessage(error)) },
    }));

    return inFlight;
  };

  return {
    read: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async enable() {
      if (!snapshot.enabled) publish({ ...snapshot, enabled: true });
      schedule();
      return refresh(true);
    },
    disable() {
      clearSchedule();
      if (snapshot.enabled) publish({ ...snapshot, enabled: false });
    },
    refresh,
    dispose() {
      disposed = true;
      clearSchedule();
      listeners.clear();
    },
  };
}

export function liveConditionsForAgent(snapshot: LiveConditionsSnapshot): LiveConditionsSnapshot {
  return {
    ...snapshot,
    weather: { ...snapshot.weather, observations: snapshot.weather.observations.slice(0, 15) },
    traffic: { ...snapshot.traffic, incidents: snapshot.traffic.incidents.slice(0, 25) },
  };
}
