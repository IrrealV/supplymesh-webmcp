import { ArrowsClockwise, Broadcast, CaretDown, CaretUp, CloudSun, Power, PowerSlash, TrafficCone } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import type { Locale } from "../../preferences/i18n/catalog";
import type { LiveConditionSeverity, LiveConditionsSnapshot, LiveConditionsStore, LiveTrafficCategory, LiveWeatherKind } from "../../live/liveConditions";
import "./liveConditions.css";

type LiveConditionsPanelProps = {
  locale: Locale;
  snapshot: LiveConditionsSnapshot;
  store: LiveConditionsStore;
};

const severityRank: Record<LiveConditionSeverity, number> = { normal: 0, advisory: 1, warning: 2, critical: 3 };

const weatherLabels: Record<Locale, Record<LiveWeatherKind, string>> = {
  en: { clear: "Clear", cloudy: "Cloudy", rain: "Rain", snow: "Snow", storm: "Storm", wind: "Strong wind", fog: "Fog", calima: "Calima / dust" },
  es: { clear: "Despejado", cloudy: "Nublado", rain: "Lluvia", snow: "Nieve", storm: "Tormenta", wind: "Viento fuerte", fog: "Niebla", calima: "Calima / polvo" },
};

const trafficLabels: Record<Locale, Record<LiveTrafficCategory, string>> = {
  en: { accident: "Accident", congestion: "Congestion", closure: "Restriction", works: "Road works", vehicle: "Stopped vehicle", weather: "Road weather", obstruction: "Obstruction", other: "Incident" },
  es: { accident: "Accidente", congestion: "Retención", closure: "Restricción", works: "Obras", vehicle: "Vehículo detenido", weather: "Meteorología vial", obstruction: "Obstáculo", other: "Incidencia" },
};

function formatUpdate(value: string | null, locale: Locale): string {
  if (value === null) return locale === "es" ? "Sin actualizar" : "Not refreshed";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(date);
}

function providerLabel(state: LiveConditionsSnapshot["weather"]["provider"]["state"], locale: Locale): string {
  const labels = {
    en: { idle: "Off", loading: "Loading", ready: "Live", error: "Unavailable" },
    es: { idle: "Apagado", loading: "Cargando", ready: "En vivo", error: "No disponible" },
  } as const;
  return labels[locale][state];
}

export function LiveConditionsPanel({ locale, snapshot, store }: LiveConditionsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const weather = useMemo(() => [...snapshot.weather.observations]
    .sort((left, right) => severityRank[right.severity] - severityRank[left.severity] || left.vehicleLabel.localeCompare(right.vehicleLabel))
    .slice(0, 4), [snapshot.weather.observations]);
  const traffic = snapshot.traffic.incidents.slice(0, 4);
  const copy = locale === "es" ? {
    title: "Meteorología y tráfico en vivo",
    enable: "Activar datos en vivo",
    disable: "Pausar datos en vivo",
    refresh: "Actualizar ahora",
    collapse: "Contraer datos en vivo",
    expand: "Expandir datos en vivo",
    weather: "Tiempo sobre la flota",
    traffic: "Incidencias DGT cercanas a rutas",
    observed: "vehículos observados",
    adverse: "con aviso meteorológico",
    national: "incidencias nacionales",
    relevant: "cerca de rutas",
    noTraffic: "No hay incidencias DGT próximas a las rutas verificadas.",
    noWeather: "Activa la capa para consultar las condiciones actuales.",
    advisory: "Capa informativa: no modifica automáticamente planes, restricciones ni rutas.",
    coverage: "Cobertura DGT: España salvo Cataluña y País Vasco.",
    updated: "Actualizado",
    route: "ruta",
    distance: "de la ruta",
  } : {
    title: "Live weather & traffic",
    enable: "Enable live data",
    disable: "Pause live data",
    refresh: "Refresh now",
    collapse: "Collapse live data",
    expand: "Expand live data",
    weather: "Weather across the fleet",
    traffic: "DGT incidents near routes",
    observed: "vehicles observed",
    adverse: "with weather advisory",
    national: "national incidents",
    relevant: "near routes",
    noTraffic: "No DGT incidents are currently close to the verified routes.",
    noWeather: "Enable the layer to query current conditions.",
    advisory: "Advisory layer: it never changes plans, constraints, or routes automatically.",
    coverage: "DGT coverage: Spain except Catalonia and the Basque Country.",
    updated: "Updated",
    route: "route",
    distance: "from route",
  };

  const toggleEnabled = (): void => {
    if (snapshot.enabled) {
      store.disable();
      return;
    }
    setExpanded(true);
    void store.enable();
  };

  return (
    <aside aria-label={copy.title} className={`live-conditions-panel${expanded ? " live-conditions-panel-expanded" : ""}`} data-live-enabled={snapshot.enabled}>
      <header className="live-conditions-header">
        <div>
          <span aria-hidden="true" className={`live-pulse live-pulse-${snapshot.refreshing ? "loading" : snapshot.enabled ? "active" : "idle"}`} />
          <strong>{copy.title}</strong>
        </div>
        <div className="live-conditions-header-actions">
          <button aria-label={snapshot.enabled ? copy.disable : copy.enable} onClick={toggleEnabled} type="button">
            {snapshot.enabled ? <PowerSlash aria-hidden="true" size={17} /> : <Power aria-hidden="true" size={17} />}
          </button>
          <button aria-label={expanded ? copy.collapse : copy.expand} onClick={() => setExpanded((value) => !value)} type="button">
            {expanded ? <CaretUp aria-hidden="true" size={17} /> : <CaretDown aria-hidden="true" size={17} />}
          </button>
        </div>
      </header>

      {!expanded ? (
        <p className="live-conditions-compact">
          {snapshot.enabled ? `${snapshot.summary.adverseWeatherVehicles} ${copy.adverse} · ${snapshot.summary.routeRelevantTrafficIncidents} ${copy.relevant}` : copy.enable}
        </p>
      ) : (
        <div className="live-conditions-body">
          <div className="live-provider-row">
            <span><CloudSun aria-hidden="true" size={18} /> Open-Meteo <b data-provider-state={snapshot.weather.provider.state}>{providerLabel(snapshot.weather.provider.state, locale)}</b></span>
            <span><TrafficCone aria-hidden="true" size={18} /> DGT <b data-provider-state={snapshot.traffic.provider.state}>{providerLabel(snapshot.traffic.provider.state, locale)}</b></span>
          </div>

          <div className="live-summary-grid">
            <span><b>{snapshot.summary.observedVehicles}</b>{copy.observed}</span>
            <span><b>{snapshot.summary.adverseWeatherVehicles}</b>{copy.adverse}</span>
            <span><b>{snapshot.traffic.nationalIncidentCount}</b>{copy.national}</span>
            <span><b>{snapshot.summary.routeRelevantTrafficIncidents}</b>{copy.relevant}</span>
          </div>

          <section className="live-condition-section" aria-labelledby="live-weather-heading">
            <h3 id="live-weather-heading"><CloudSun aria-hidden="true" size={17} />{copy.weather}</h3>
            {weather.length === 0 ? <p>{copy.noWeather}</p> : (
              <ul>
                {weather.map((observation) => (
                  <li data-live-weather-summary={observation.vehicleId} data-severity={observation.severity} key={observation.id}>
                    <span><b>{observation.vehicleLabel}</b>{weatherLabels[locale][observation.kind]}</span>
                    <small>{observation.temperatureC === null ? "—" : `${observation.temperatureC.toFixed(1)} °C`} · {observation.windGustsKmh === null ? "—" : `${Math.round(observation.windGustsKmh)} km/h`}</small>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="live-condition-section" aria-labelledby="live-traffic-heading">
            <h3 id="live-traffic-heading"><TrafficCone aria-hidden="true" size={17} />{copy.traffic}</h3>
            {traffic.length === 0 ? <p>{copy.noTraffic}</p> : (
              <ul>
                {traffic.map((incident) => (
                  <li data-live-traffic-summary={incident.id} data-severity={incident.severity} key={incident.id}>
                    <span><b>{trafficLabels[locale][incident.category]}{incident.roadName ? ` · ${incident.roadName}` : ""}</b>{incident.municipality ?? incident.province ?? incident.nearestRouteId}</span>
                    <small>{copy.route} {incident.nearestRouteId} · {incident.distanceToRouteKm.toFixed(1)} km {copy.distance}</small>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {(snapshot.weather.provider.message || snapshot.traffic.provider.message) && (
            <div className="live-provider-errors" role="status">
              {snapshot.weather.provider.message && <p>Open-Meteo: {snapshot.weather.provider.message}</p>}
              {snapshot.traffic.provider.message && <p>DGT: {snapshot.traffic.provider.message}</p>}
            </div>
          )}

          <footer className="live-conditions-footer">
            <p>{copy.advisory}</p>
            <p>{copy.coverage}</p>
            <div>
              <span>{copy.updated}: {formatUpdate(snapshot.fetchedAt, locale)}</span>
              <button aria-label={copy.refresh} disabled={snapshot.refreshing} onClick={() => { void store.refresh(true); }} type="button">
                <ArrowsClockwise aria-hidden="true" className={snapshot.refreshing ? "live-refresh-spinning" : ""} size={16} />
                {copy.refresh}
              </button>
            </div>
            <p className="live-attribution">
              <Broadcast aria-hidden="true" size={14} />
              <a href="https://open-meteo.com/" rel="noreferrer" target="_blank">Open-Meteo</a>
              <span>·</span>
              <a href="https://nap.dgt.es/" rel="noreferrer" target="_blank">DGT NAP</a>
            </p>
          </footer>
        </div>
      )}
    </aside>
  );
}
