import { divIcon, type LatLngBounds } from "leaflet";
import { useMemo, useState } from "react";
import { CircleMarker, Marker, Pane, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { liveWeatherSymbol, type LiveConditionsSnapshot, type LiveTrafficEvent } from "../../../live/liveConditions";
import "./liveConditions.css";

const severityStyle = {
  low: { color: "#516979", fillColor: "#6d8290", radius: 5 },
  medium: { color: "#a65f00", fillColor: "#f59e0b", radius: 6 },
  high: { color: "#b42318", fillColor: "#f04438", radius: 7 },
  critical: { color: "#7a0916", fillColor: "#d7192d", radius: 8 },
} as const;

function eventWithinBounds(event: LiveTrafficEvent, bounds: LatLngBounds): boolean {
  return bounds.contains([event.latitude, event.longitude]);
}

export function LiveConditionsLayer({ snapshot }: { snapshot?: LiveConditionsSnapshot }) {
  const map = useMap();
  const [viewport, setViewport] = useState(() => ({ bounds: map.getBounds(), zoom: map.getZoom() }));
  useMapEvents({
    moveend: () => setViewport({ bounds: map.getBounds(), zoom: map.getZoom() }),
    zoomend: () => setViewport({ bounds: map.getBounds(), zoom: map.getZoom() }),
  });

  const visibleTraffic = useMemo(() => {
    if (snapshot === undefined) return [];
    const minimumSeverity = viewport.zoom < 7 ? new Set(["critical", "high"]) : undefined;
    const limit = viewport.zoom < 7 ? 45 : 120;
    return snapshot.traffic
      .filter((event) => eventWithinBounds(event, viewport.bounds))
      .filter((event) => minimumSeverity === undefined || minimumSeverity.has(event.severity))
      .slice(0, limit);
  }, [snapshot, viewport]);

  if (snapshot === undefined) return null;

  return (
    <>
      <Pane name="live-conditions" style={{ zIndex: 585 }} />
      {snapshot.weather.map((weather) => {
        const label = `${weather.locationName}: ${Math.round(weather.temperatureC)} °C, ${weather.kind}, wind ${Math.round(weather.windSpeedKmh)} km/h`;
        return (
          <Marker
            alt={label}
            icon={divIcon({
              className: `live-weather-marker live-weather-${weather.kind}`,
              html: `<span class="live-weather-symbol">${liveWeatherSymbol(weather.kind)}</span><span class="live-weather-temperature">${Math.round(weather.temperatureC)}°</span>`,
              iconAnchor: [28, 18],
              iconSize: [56, 36],
            })}
            interactive
            key={weather.id}
            pane="live-conditions"
            position={[weather.latitude, weather.longitude]}
            title={label}
          >
            <Tooltip direction="top" offset={[0, -14]}>
              <strong>{weather.locationName}</strong><br />
              {Math.round(weather.temperatureC)} °C · {weather.kind}<br />
              Wind {Math.round(weather.windSpeedKmh)} km/h · gusts {Math.round(weather.windGustKmh)} km/h<br />
              Precipitation {weather.precipitationMm.toFixed(1)} mm · Open-Meteo
            </Tooltip>
          </Marker>
        );
      })}
      {visibleTraffic.map((event) => {
        const style = severityStyle[event.severity];
        return (
          <CircleMarker
            center={[event.latitude, event.longitude]}
            eventHandlers={{ click: () => map.flyTo([event.latitude, event.longitude], Math.max(map.getZoom(), 12), { animate: true, duration: 0.45 }) }}
            key={event.id}
            pane="live-conditions"
            pathOptions={{ className: `live-traffic-event live-traffic-${event.severity}`, color: style.color, fillColor: style.fillColor, fillOpacity: 0.78, opacity: 0.95, weight: 2 }}
            radius={style.radius}
          >
            <Tooltip direction="top" sticky>
              <strong>{event.road || "DGT traffic event"}</strong><br />
              {event.eventType} · {event.severity}<br />
              {event.description}<br />
              {event.direction && <>Direction: {event.direction}<br /></>}
              DGT · {event.updatedAt === new Date(0).toISOString() ? "live feed" : event.updatedAt}
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}
