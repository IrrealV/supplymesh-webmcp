import { ArrowClockwise, Broadcast, CloudSun, TrafficCone } from "@phosphor-icons/react";
import type { LiveConditionsViewState } from "../../../live/useLiveConditions";
import "./liveConditions.css";

export function LiveDataControl({ enabled, live, onToggle }: { enabled: boolean; live: LiveConditionsViewState; onToggle(): void }) {
  const weatherCount = live.snapshot?.weather.length ?? 0;
  const trafficCount = live.snapshot?.traffic.length ?? 0;
  const statusText = !enabled
    ? "Optional live layer off"
    : live.state === "loading"
      ? "Loading current conditions…"
      : live.state === "ready"
        ? `${weatherCount} weather stations · ${trafficCount} DGT events`
        : live.state === "partial"
          ? `Partial live data · ${weatherCount} weather · ${trafficCount} traffic`
          : "Live feeds unavailable · deterministic demo remains active";

  return (
    <aside aria-label="Live weather and traffic" className={`live-data-control live-data-${live.state}`} data-live-enabled={enabled}>
      <button aria-pressed={enabled} className="live-data-toggle" onClick={onToggle} type="button">
        <Broadcast aria-hidden="true" size={17} weight={enabled ? "fill" : "regular"} />
        <span>{enabled ? "Live data on" : "Enable live data"}</span>
      </button>
      <div aria-live="polite" className="live-data-status">
        <span className="live-data-dot" />
        <span>{statusText}</span>
      </div>
      {enabled && live.snapshot !== undefined && (
        <div className="live-data-sources">
          <span><CloudSun aria-hidden="true" size={14} /> Open-Meteo</span>
          <span><TrafficCone aria-hidden="true" size={14} /> DGT</span>
          <button aria-label="Refresh live data" onClick={live.refresh} type="button"><ArrowClockwise aria-hidden="true" size={14} /></button>
        </div>
      )}
      {enabled && live.snapshot?.warnings.map((warning) => <small key={warning}>{warning}</small>)}
      <small>Advisory only. Safety decisions remain deterministic.</small>
    </aside>
  );
}
