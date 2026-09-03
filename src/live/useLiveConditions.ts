import { useCallback, useEffect, useState } from "react";
import { loadLiveConditions } from "./loadLiveConditions";
import type { LiveConditionsSnapshot, LiveDataState } from "./liveConditions";

const REFRESH_INTERVAL_MS = 5 * 60 * 1_000;

export type LiveConditionsViewState = Readonly<{
  state: LiveDataState;
  snapshot?: LiveConditionsSnapshot;
  refresh(): void;
}>;

export function useLiveConditions(enabled: boolean): LiveConditionsViewState {
  const [snapshot, setSnapshot] = useState<LiveConditionsSnapshot>();
  const [state, setState] = useState<LiveDataState>("idle");
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((current) => current + 1), []);

  useEffect(() => {
    if (!enabled) {
      setState("idle");
      return;
    }

    const controller = new AbortController();
    let active = true;
    const load = async (): Promise<void> => {
      setState("loading");
      const next = await loadLiveConditions(controller.signal);
      if (!active) return;
      setSnapshot(next);
      setState(next.status);
    };
    void load();
    const interval = globalThis.setInterval(() => void load(), REFRESH_INTERVAL_MS);
    return () => {
      active = false;
      controller.abort();
      globalThis.clearInterval(interval);
    };
  }, [enabled, refreshKey]);

  return { refresh, snapshot, state };
}
