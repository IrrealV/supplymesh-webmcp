import { divIcon, latLngBounds, type LatLngExpression, type Map as LeafletMap } from "leaflet";
import { Fragment, useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Pane, Polygon, Polyline, TileLayer, Circle, useMap, useMapEvents } from "react-leaflet";
import { useUiCoordinationStore } from "../../app/state/useUiCoordinationStore";
import type { OperatingRegion, OperationalRisk, RiskSeverity } from "../../domain/entities";
import { catalog, operationalCopy, type Locale } from "../../preferences/i18n/catalog";
import { deriveMapLayers, selectVisibleRisks, type DerivedRisk, type DerivedRoute } from "./layers";
import { MapEventCoordinator } from "./MapEventCoordinator";
import { MapLegend } from "./MapLegend";
import { VehicleMarkerLayer } from "./VehicleMarkerLayer";
import { RecoveryComparisonLayers, RecoveryIncidentInset } from "../recovery-comparison/RecoveryComparisonLayers";
import type { Unit211RecoveryComparisonModel } from "../recovery-comparison/unit211RecoveryComparisonModel";
import { recoveryComparisonCopy } from "../../preferences/i18n/catalog";
import { CLOSE_RANGE_FOCUS_ZOOM } from "./closeRangeMode";

const severityColors: Record<RiskSeverity, string> = { low: "#657985", medium: "#a66a18", high: "#c4512d", critical: "#b4232d" };
const WEATHER_RISK_COLOR = "#1268e8";

function RegionFramer({ regionId }: { regionId: string }) {
  const map = useMap();
  useEffect(() => {
    if (regionId === "france-v1") map.setView([45.75, 3.5], 6.5);
    else if (regionId === "germany-v1") map.setView([51.16, 10.45], 6.5);
    else map.setView([40.1, -3.55], 6.5);
  }, [regionId, map]);
  return null;
}

function AvoidanceAreaLayer() {
  const area = useUiCoordinationStore(state => state.avoidanceArea);
  if (!area) return null;
  return (
    <Pane name="avoidance-area" style={{ zIndex: 610 }}>
      <Circle center={[area.coordinates[1], area.coordinates[0]]} radius={area.radiusMeters} pathOptions={{ color: 'red', fillColor: '#ff0000', fillOpacity: 0.2 }} />
    </Pane>
  );
}

function toPosition([longitude, latitude]: readonly number[]): [number, number] { return [latitude, longitude]; }
function routePositions(route: DerivedRoute["route"]): LatLngExpression[] { return route.geometry.geometry.coordinates.map(toPosition); }
function escapeHtml(value: string): string { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }

function MapFocus({ comparison, coordinator, scenario }: { comparison?: Unit211RecoveryComparisonModel; coordinator: MapEventCoordinator; scenario: OperatingRegion }) {
  const map = useMap();
  const target = useUiCoordinationStore((state) => state.mapFocusTarget);
  useEffect(() => {
    if (target.kind === "none") return;
    const route = scenario.routes.find(({ vehicleId }) => vehicleId === target.vehicleId);
    const vehicle = scenario.vehicles.find(({ internalId }) => internalId === target.vehicleId);
    if (route === undefined || vehicle === undefined) { useUiCoordinationStore.getState().acknowledgeMapFocus(target.requestId); return; }

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    coordinator.beginProgrammaticChange();
    let isFinished = false;
    const finish = (): void => {
      if (isFinished) return;
      isFinished = true;
      coordinator.settleProgrammaticChange();
      useUiCoordinationStore.getState().acknowledgeMapFocus(target.requestId);
    };

    map.once("moveend", finish);
    if (target.kind === "vehicle") {
      const [longitude, latitude] = vehicle.position.geometry.coordinates;
      map.flyTo([latitude, longitude], CLOSE_RANGE_FOCUS_ZOOM, { animate: !reduceMotion, duration: 0.85, easeLinearity: 0.22 });
    } else if (target.kind === "comparison" && comparison !== undefined) {
      map.fitBounds(latLngBounds([...comparison.current.coordinates, ...comparison.alternative.coordinates, ...comparison.incident.exclusionCoordinates, comparison.incident.position].map(toPosition)), { animate: !reduceMotion, duration: 0.85, maxZoom: 12, padding: [48, 48] });
    } else {
      map.fitBounds(latLngBounds(routePositions(route)), { animate: !reduceMotion, duration: 0.85, maxZoom: 8, padding: [64, 64] });
    }

    const timeout = window.setTimeout(finish, reduceMotion ? 100 : 1400);
    return () => { window.clearTimeout(timeout); map.off("moveend", finish); };
  }, [comparison, coordinator, map, scenario.routes, scenario.vehicles, target]);
  return null;
}

function invalidateMap(map: LeafletMap, coordinator: MapEventCoordinator): number {
  coordinator.beginProgrammaticChange();
  map.invalidateSize({ animate: false, pan: false });
  return window.requestAnimationFrame(() => coordinator.settleProgrammaticChange());
}

function MapLayout({ coordinator, signature }: { coordinator: MapEventCoordinator; signature: string }) {
  const map = useMap();
  useEffect(() => { const frame = invalidateMap(map, coordinator); return () => window.cancelAnimationFrame(frame); }, [coordinator, map, signature]);
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const container = map.getContainer();
    const observer = new ResizeObserver(() => invalidateMap(map, coordinator));
    observer.observe(container);
    return () => observer.disconnect();
  }, [coordinator, map]);
  return null;
}

function MapEvents({ coordinator }: { coordinator: MapEventCoordinator }) {
  const cancelFollow = useUiCoordinationStore((state) => state.cancelFollow);
  const cancelForViewport = (): void => { if (coordinator.shouldCancelFollowForViewportMove()) cancelFollow(); };
  useMapEvents({ dragstart: () => { coordinator.recordManualInteraction(); cancelFollow(); }, movestart: cancelForViewport, zoomstart: cancelForViewport });
  return null;
}

function riskPosition(risk: OperationalRisk): [number, number] {
  const coordinates = risk.geometry.geometry.type === "Polygon" ? risk.geometry.geometry.coordinates[0] : risk.geometry.geometry.coordinates;
  const total = coordinates.reduce<[number, number]>((sum, [longitude, latitude]) => [sum[0] + longitude, sum[1] + latitude], [0, 0]);
  return [total[1] / coordinates.length, total[0] / coordinates.length];
}

function riskLabel(risk: OperationalRisk, locale: Locale): string {
  const copy = catalog(locale); const operations = operationalCopy(locale);
  if (risk.kind === "height-restriction") return `${operations.lowClearance} ${risk.limitMeters ?? 0} m`;
  if (risk.kind === "weight-restriction") return `${operations.weightRestriction} ${risk.limitTonnes ?? 0} t`;
  if (risk.kind === "road-closure") return operations.roadClosure;
  if (risk.kind === "severe-snow") return operations.severeSnow ?? operations.severeWeather;
  if (risk.kind === "heavy-rain") return operations.heavyRain ?? operations.severeWeather;
  if (risk.kind === "severe-storm") return operations.severeStorm ?? operations.severeWeather;
  if (risk.kind === "calima") return operations.calima ?? operations.severeWeather;
  return `${copy.drivingRestRisk} ${risk.deadline?.slice(11, 16) ?? ""}`.trim();
}

function riskIcon(entry: DerivedRisk, locale: Locale) {
  const { risk, state } = entry; const label = escapeHtml(riskLabel(risk, locale));
  const symbol = risk.kind === "height-restriction" ? `${risk.limitMeters}m` : risk.kind === "weight-restriction" ? `${risk.limitTonnes}t` : risk.kind === "road-closure" ? "×" : risk.kind === "severe-snow" ? String.fromCodePoint(0x2744) : risk.kind === "heavy-rain" ? String.fromCodePoint(0x1F327) : risk.kind === "severe-storm" ? String.fromCodePoint(0x26A1) : risk.kind === "calima" ? String.fromCodePoint(0x1F32B) : `REST ${risk.deadline?.slice(11, 16) ?? ""}`.trim();
  return divIcon({ className: `risk-marker risk-${risk.kind} map-layer-${state}`, html: `<span class="risk-marker-symbol">${symbol}</span><span class="risk-marker-label">${label}</span>`, iconAnchor: [14, 14], iconSize: [state === "selected" ? 120 : 64, 28] });
}

function RiskLayers({ entries, locale }: { entries: readonly DerivedRisk[]; locale: Locale }) {
  return entries.map((entry) => {
    const { risk, state } = entry;
    const isWeatherRisk = ["severe-snow", "heavy-rain", "severe-storm", "calima"].includes(risk.kind);
    const color = isWeatherRisk ? WEATHER_RISK_COLOR : severityColors[risk.severity];
    const opacity = state === "muted" ? 0.18 : state === "selected" ? 1 : 0.72;
    const fillOpacity = isWeatherRisk ? state === "muted" ? 0.06 : state === "selected" ? 0.26 : state === "matched" ? 0.22 : 0.18 : 0;
    const pathOptions = {
      className: `risk-overlay risk-overlay-${risk.kind} risk-overlay-${risk.severity} map-path-${state}`,
      color,
      dashArray: risk.kind === "road-closure" ? "8 6" : isWeatherRisk ? "7 5" : undefined,
      fillColor: color,
      fillOpacity,
      opacity: isWeatherRisk && state !== "muted" ? 0.9 : opacity,
      weight: state === "selected" ? 5 : isWeatherRisk ? 2.5 : 3,
    };
    const shapeKey = `${risk.id}:${state}`;
    const shape = risk.geometry.geometry.type === "Polygon"
      ? <Polygon key={shapeKey} {...pathOptions} positions={risk.geometry.geometry.coordinates[0].map(toPosition)} />
      : <Polyline key={shapeKey} {...pathOptions} noClip positions={risk.geometry.geometry.coordinates.map(toPosition)} smoothFactor={0} />;
      
    const weatherFx = isWeatherRisk ? (
      <Marker key={`fx-${shapeKey}`} alt="" interactive={false} keyboard={false} pane="weather-effects" position={riskPosition(risk)} icon={divIcon({ className: `weather-fx-container`, html: `<div class="weather-fx-zone weather-fx-${risk.kind}"></div>`, iconSize: [400, 400], iconAnchor: [200, 200] })} />
    ) : null;
    
    return <Fragment key={risk.id}>{shape}{weatherFx}<Marker alt={riskLabel(risk, locale)} icon={riskIcon(entry, locale)} interactive={false} keyboard={false} pane="risk-tokens" position={riskPosition(risk)} title={riskLabel(risk, locale)} zIndexOffset={state === "selected" ? 1300 : 500} /></Fragment>;
  });
}

function routeStyle({ state }: DerivedRoute) {
  const className = `route-corridor route-corridor-${state}`;
  if (state === "selected") return { className, color: "#2563a6", opacity: 1, weight: 5 };
  if (state === "matched") return { className, color: "#2f8f5b", opacity: 0.82, weight: 3 };
  if (state === "muted") return { className, color: "#647781", opacity: 0.14, weight: 2 };
  return { className, color: "#4c9a6a", opacity: 0.66, weight: 2.5 };
}

function CloseRangeBridgeHazard({ scenario }: { scenario: OperatingRegion }) {
  const map = useMap();
  const heightRisk = scenario.risks.find((r) => r.id === "restriction-height-3.9");
  const routeSnap = heightRisk?.routeSnaps?.[0];
  const [isModeActive, setIsModeActive] = useState(() => map.getContainer().dataset.closeRangeMode === "active");

  useEffect(() => {
    const container = map.getContainer();
    const update = () => setIsModeActive(container.dataset.closeRangeMode === "active");
    const observer = new MutationObserver(update);
    observer.observe(container, { attributes: true, attributeFilter: ["data-close-range-mode"] });
    update();
    return () => observer.disconnect();
  }, [map]);

  if (!isModeActive || !routeSnap) return null;

  const position = toPosition(routeSnap.startCoordinate);
  const html = `<div class="bridge-3d-structure" data-hazard="bridge-3d"><div class="bridge-pillar bridge-pillar-left"></div><div class="bridge-pillar bridge-pillar-right"></div><div class="bridge-beam"></div></div><div class="bridge-clearance-info" data-hazard-label="clearance">4.00 m required &middot; 3.90 m available</div>`;

  return <Marker position={position} pane="close-range-hazards" icon={divIcon({ className: "close-range-hazard-bridge", html, iconSize: [160, 80], iconAnchor: [80, 40] })} />;
}

export function FleetMap({ availableComparison, comparison, locale, recoveryExecuted = false, scenario }: { availableComparison?: Unit211RecoveryComparisonModel; comparison?: Unit211RecoveryComparisonModel; locale: Locale; recoveryExecuted?: boolean; scenario: OperatingRegion }) {
  const activeFilters = useUiCoordinationStore((state) => state.activeFilters);
  const panelContext = useUiCoordinationStore((state) => state.panelContext);
  const selection = useUiCoordinationStore((state) => state.selection);
  const selectedVehicleId = selection.kind === "vehicle" ? selection.vehicleId : "";
  const layers = useMemo(() => deriveMapLayers(scenario, activeFilters, selectedVehicleId), [activeFilters, scenario, selectedVehicleId]);
  const visibleRisks = useMemo(() => selectVisibleRisks(layers.risks, selectedVehicleId).filter(({ risk }) => risk.id !== (comparison ?? availableComparison)?.incident.riskId), [availableComparison, comparison, layers.risks, selectedVehicleId]);
  const coordinator = useMemo(() => new MapEventCoordinator(), []);
  const copy = catalog(locale);
  const cancelManualFollow = (): void => { coordinator.recordManualInteraction(); useUiCoordinationStore.getState().cancelFollow(); };
  const layoutSignature = `${panelContext.mode}:${selection.kind}:${selectedVehicleId}:${comparison?.incident.id ?? ""}`; const recoveryCopy = recoveryComparisonCopy(locale); const hasExecuted = recoveryExecuted;
  return <div aria-label={copy.currentRoute} className="map-frame" onKeyDown={(event) => { if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "+", "-", "="].includes(event.key)) cancelManualFollow(); }} onPointerDown={cancelManualFollow} onWheel={cancelManualFollow}>
    <MapContainer center={[40.1, -3.55]} className="fleet-map" maxZoom={18} minZoom={5} zoom={6.5} zoomControl zoomSnap={0.5}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Pane name="risk-tokens" style={{ zIndex: 620 }} /><Pane name="weather-effects" style={{ zIndex: 615 }} /><Pane name="fleet-trucks" style={{ zIndex: 640 }} /><Pane name="fleet-labels" style={{ zIndex: 660 }} /><Pane name="close-range-hazards" style={{ zIndex: 680 }} />
      <MapEvents coordinator={coordinator} /><MapFocus comparison={comparison} coordinator={coordinator} scenario={scenario} /><MapLayout coordinator={coordinator} signature={layoutSignature} />
      <RegionFramer regionId={scenario.id} />
      <AvoidanceAreaLayer />
      {layers.routes.filter((entry) => entry.route.id !== comparison?.current.id && entry.route.id !== comparison?.alternative.id).map((entry) => <Polyline key={`${entry.route.id}:${entry.state}`} {...routeStyle(entry)} noClip positions={routePositions(entry.route)} smoothFactor={0} />)}
      <RiskLayers entries={visibleRisks} locale={locale} />
      <CloseRangeBridgeHazard scenario={scenario} />
      {(comparison ?? availableComparison) && <RecoveryComparisonLayers comparison={comparison !== undefined} executed={hasExecuted} locale={locale} model={(comparison ?? availableComparison)!} onIncidentSelect={comparison ? undefined : (vehicleId) => useUiCoordinationStore.getState().selectVehicle(vehicleId, "operational-map")} />}
      <VehicleMarkerLayer coordinator={coordinator} locale={locale} onSelect={(vehicleId) => useUiCoordinationStore.getState().selectVehicle(vehicleId)} routes={scenario.routes} vehicles={layers.vehicles} />
    </MapContainer>
    {comparison && <><p className="visually-hidden" data-route-state={hasExecuted ? "applied" : "comparison"} id="recovery-map-summary">{comparison.vehicle.displayLabel}. {recoveryCopy.current} · {comparison.current.statusLabel}. {recoveryCopy.alternative} · {comparison.alternative.statusLabel}. {recoveryCopy.exclusionZone}. {recoveryCopy.clearanceIncident}.</p><RecoveryIncidentInset locale={locale} model={comparison} /></>}
    <MapLegend locale={locale} />
  </div>;
}
