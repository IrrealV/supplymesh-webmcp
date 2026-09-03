import { fetchLiveTraffic } from "./dgtTrafficClient";
import { fetchLiveWeather } from "./openMeteoClient";
import type { LiveConditionsSnapshot } from "./liveConditions";

const REQUEST_TIMEOUT_MS = 9_000;

export async function loadLiveConditions(parentSignal?: AbortSignal): Promise<LiveConditionsSnapshot> {
  const controller = new AbortController();
  const abortFromParent = () => controller.abort(parentSignal?.reason);
  parentSignal?.addEventListener("abort", abortFromParent, { once: true });
  const timeout = globalThis.setTimeout(() => controller.abort(new DOMException("Live data request timed out.", "TimeoutError")), REQUEST_TIMEOUT_MS);

  try {
    const [weatherResult, trafficResult] = await Promise.allSettled([
      fetchLiveWeather(controller.signal),
      fetchLiveTraffic(controller.signal),
    ]);
    const weather = weatherResult.status === "fulfilled" ? weatherResult.value : [];
    const traffic = trafficResult.status === "fulfilled" ? trafficResult.value : [];
    const weatherAvailable = weatherResult.status === "fulfilled";
    const trafficAvailable = trafficResult.status === "fulfilled";
    const warnings = [
      ...(weatherResult.status === "rejected" ? [`Weather unavailable: ${String(weatherResult.reason instanceof Error ? weatherResult.reason.message : weatherResult.reason)}`] : []),
      ...(trafficResult.status === "rejected" ? [`Traffic unavailable: ${String(trafficResult.reason instanceof Error ? trafficResult.reason.message : trafficResult.reason)}`] : []),
    ];

    return {
      advisoryOnly: true,
      fetchedAt: new Date().toISOString(),
      sources: { traffic: "Dirección General de Tráfico (DGT)", weather: "Open-Meteo" },
      status: weatherAvailable && trafficAvailable ? "ready" : weatherAvailable || trafficAvailable ? "partial" : "unavailable",
      traffic,
      trafficAvailable,
      warnings,
      weather,
      weatherAvailable,
    };
  } finally {
    globalThis.clearTimeout(timeout);
    parentSignal?.removeEventListener("abort", abortFromParent);
  }
}
