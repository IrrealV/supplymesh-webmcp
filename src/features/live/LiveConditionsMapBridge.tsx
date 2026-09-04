import { divIcon, layerGroup, marker, type LayerGroup, type Map as LeafletMap } from "leaflet";
import { useEffect } from "react";
import type { LiveConditionsSnapshot, LiveTrafficCategory, LiveWeatherKind } from "../../live/liveConditions";
import type { Locale } from "../../preferences/i18n/catalog";

const weatherSymbols: Record<LiveWeatherKind, string> = {
  clear: "☀",
  cloudy: "☁",
  rain: "🌧",
  snow: "❄",
  storm: "⚡",
  wind: "↝",
  fog: "≋",
  calima: "◌",
};

const trafficSymbols: Record<LiveTrafficCategory, string> = {
  accident: "!",
  congestion: "≋",
  closure: "×",
  works: "◆",
  vehicle: "■",
  weather: "☂",
  obstruction: "▲",
  other: "!",
};

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function findMap(): LeafletMap | undefined {
  const container = document.querySelector(".fleet-map") as (HTMLElement & { _leaflet_map?: LeafletMap }) | null;
  return container?._leaflet_map;
}

function mountLayers(map: LeafletMap, locale: Locale, snapshot: LiveConditionsSnapshot): LayerGroup {
  const layers = layerGroup().addTo(map);
  const copy = locale === "es" ? { observed: "Observado", route: "Ruta próxima" } : { observed: "Observed", route: "Nearest route" };

  for (const observation of snapshot.weather.observations.filter(({ severity }) => severity !== "normal")) {
    const [longitude, latitude] = observation.coordinates;
    const title = `${observation.vehicleLabel} · ${observation.summary}`;
    const item = marker([latitude, longitude], {
      icon: divIcon({
        className: `live-map-marker live-weather-marker live-severity-${observation.severity}`,
        html: `<button aria-label="${escapeHtml(title)}" data-live-weather-marker="${escapeHtml(observation.vehicleId)}" type="button"><span aria-hidden="true">${weatherSymbols[observation.kind]}</span></button>`,
        iconAnchor: [18, 18],
        iconSize: [36, 36],
      }),
      keyboard: true,
      pane: "risk-tokens",
      title,
    });
    item.bindTooltip(`<strong>${escapeHtml(observation.vehicleLabel)}</strong><br>${escapeHtml(observation.summary)}<br><small>${copy.observed}: ${escapeHtml(observation.observedAt)}</small>`, { direction: "top", offset: [0, -18], opacity: 0.96 });
    item.on("click", () => map.flyTo([latitude, longitude], Math.max(map.getZoom(), 10), { animate: true, duration: 0.45 }));
    layers.addLayer(item);
  }

  for (const incident of snapshot.traffic.incidents) {
    const [longitude, latitude] = incident.coordinates;
    const title = incident.title;
    const item = marker([latitude, longitude], {
      icon: divIcon({
        className: `live-map-marker live-traffic-marker live-traffic-${incident.category} live-severity-${incident.severity}`,
        html: `<button aria-label="${escapeHtml(title)}" data-live-traffic-marker="${escapeHtml(incident.id)}" type="button"><span aria-hidden="true">${trafficSymbols[incident.category]}</span></button>`,
        iconAnchor: [18, 18],
        iconSize: [36, 36],
      }),
      keyboard: true,
      pane: "risk-tokens",
      title,
    });
    item.bindTooltip(`<strong>${escapeHtml(incident.title)}</strong><br>${escapeHtml(incident.municipality ?? incident.province ?? incident.nearestRouteId)}<br><small>${copy.route}: ${escapeHtml(incident.nearestRouteId)} · ${incident.distanceToRouteKm.toFixed(1)} km</small>`, { direction: "top", offset: [0, -18], opacity: 0.96 });
    item.on("click", () => map.flyTo([latitude, longitude], Math.max(map.getZoom(), 11), { animate: true, duration: 0.45 }));
    layers.addLayer(item);
  }

  return layers;
}

export function LiveConditionsMapBridge({ locale, snapshot }: { locale: Locale; snapshot: LiveConditionsSnapshot }) {
  useEffect(() => {
    if (!snapshot.enabled) return;
    let cancelled = false;
    let mounted: LayerGroup | undefined;
    let attempts = 0;

    const attach = (): void => {
      if (cancelled) return;
      const map = findMap();
      if (map === undefined) {
        attempts += 1;
        if (attempts < 120) window.setTimeout(attach, 50);
        return;
      }
      mounted = mountLayers(map, locale, snapshot);
    };

    attach();
    return () => {
      cancelled = true;
      mounted?.remove();
    };
  }, [locale, snapshot]);

  return null;
}
