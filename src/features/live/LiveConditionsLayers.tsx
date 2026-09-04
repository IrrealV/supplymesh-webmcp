import { divIcon } from "leaflet";
import { Marker, Tooltip, useMap } from "react-leaflet";
import type { Locale } from "../../preferences/i18n/catalog";
import type { LiveConditionsSnapshot, LiveTrafficCategory, LiveWeatherKind } from "../../live/liveConditions";

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

export function LiveConditionsLayers({ locale, snapshot }: { locale: Locale; snapshot: LiveConditionsSnapshot }) {
  const map = useMap();
  const weather = snapshot.weather.observations.filter(({ severity }) => severity !== "normal");
  const traffic = snapshot.traffic.incidents;
  const copy = locale === "es" ? { weather: "Tiempo en vivo", traffic: "Incidencia DGT", route: "Ruta próxima", updated: "Observado" } : { weather: "Live weather", traffic: "DGT incident", route: "Nearest route", updated: "Observed" };

  return (
    <>
      {weather.map((observation) => {
        const [longitude, latitude] = observation.coordinates;
        const title = `${copy.weather}: ${observation.vehicleLabel} · ${observation.summary}`;
        return (
          <Marker
            eventHandlers={{ click: () => map.flyTo([latitude, longitude], Math.max(map.getZoom(), 10), { animate: true, duration: 0.45 }) }}
            icon={divIcon({
              className: `live-map-marker live-weather-marker live-severity-${observation.severity}`,
              html: `<button aria-label="${escapeHtml(title)}" data-live-weather-marker="${escapeHtml(observation.vehicleId)}" type="button"><span aria-hidden="true">${weatherSymbols[observation.kind]}</span></button>`,
              iconAnchor: [18, 18],
              iconSize: [36, 36],
            })}
            key={observation.id}
            pane="live-conditions"
            position={[latitude, longitude]}
            title={title}
          >
            <Tooltip direction="top" offset={[0, -18]} opacity={0.96}>
              <strong>{observation.vehicleLabel}</strong><br />
              {observation.summary}<br />
              <small>{copy.updated}: {observation.observedAt}</small>
            </Tooltip>
          </Marker>
        );
      })}

      {traffic.map((incident) => {
        const [longitude, latitude] = incident.coordinates;
        const title = `${copy.traffic}: ${incident.title}`;
        return (
          <Marker
            eventHandlers={{ click: () => map.flyTo([latitude, longitude], Math.max(map.getZoom(), 11), { animate: true, duration: 0.45 }) }}
            icon={divIcon({
              className: `live-map-marker live-traffic-marker live-traffic-${incident.category} live-severity-${incident.severity}`,
              html: `<button aria-label="${escapeHtml(title)}" data-live-traffic-marker="${escapeHtml(incident.id)}" type="button"><span aria-hidden="true">${trafficSymbols[incident.category]}</span></button>`,
              iconAnchor: [18, 18],
              iconSize: [36, 36],
            })}
            key={incident.id}
            pane="live-conditions"
            position={[latitude, longitude]}
            title={title}
          >
            <Tooltip direction="top" offset={[0, -18]} opacity={0.96}>
              <strong>{incident.title}</strong><br />
              {incident.municipality ?? incident.province ?? incident.nearestRouteId}<br />
              <small>{copy.route}: {incident.nearestRouteId} · {incident.distanceToRouteKm.toFixed(1)} km</small>
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
}
