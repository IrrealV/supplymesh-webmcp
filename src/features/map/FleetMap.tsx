import { divIcon, latLngBounds, type LatLngExpression, type Map as LeafletMap } from "leaflet";
import { Fragment, useEffect, useMemo } from "react";
import { MapContainer, Marker, Polygon, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { useUiCoordinationStore } from "../../app/state/useUiCoordinationStore";
import type { OperatingRegion, OperationalRisk, RiskSeverity } from "../../domain/entities";
import { catalog, operationalCopy, type Locale } from "../../preferences/i18n/catalog";
import { deriveMapLayers, type DerivedRisk, type DerivedRoute } from "./layers";
import { MapEventCoordinator } from "./MapEventCoordinator";
import { MapLegend } from "./MapLegend";
import { VehicleMarkerLayer } from "./VehicleMarkerLayer";

const SPAIN_BOUNDS: [[number, number], [number, number]] = [[35.4, -9.7], [44.3, 3.6]];
const severityColors: Record<RiskSeverity, string> = { low: "#657985", medium: "#a66a18", high: "#c4512d", critical: "#b4232d" };

function toPosition([longitude, latitude]: number[]): [number, number] { return [latitude, longitude]; }
function routePositions(route: DerivedRoute["route"]): LatLngExpression[] { return route.geometry.geometry.coordinates.map(toPosition); }
function escapeHtml(value: string): string { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }

function MapFocus({ coordinator, scenario }: { coordinator: MapEventCoordinator; scenario: OperatingRegion }) {
  const map = useMap();
  const target = useUiCoordinationStore((state) => state.mapFocusTarget);
  useEffect(() => {
    if (target.kind === "none") return;
    const route = scenario.routes.find(({ vehicleId }) => vehicleId === target.vehicleId);
    if (route === undefined) { useUiCoordinationStore.getState().acknowledgeMapFocus(target.requestId); return; }
    coordinator.beginProgrammaticChange();
    let isFinished = false;
    const finish = (): void => {
      if (isFinished) return;
      isFinished = true;
      coordinator.settleProgrammaticChange();
      useUiCoordinationStore.getState().acknowledgeMapFocus(target.requestId);
    };
    map.once("moveend", finish);
    map.fitBounds(latLngBounds(routePositions(route)), { animate: true, duration: 0.45, maxZoom: 8, padding: [48, 48] });
    const timeout = window.setTimeout(finish, 800);
    return () => { window.clearTimeout(timeout); map.off("moveend", finish); };
  }, [coordinator, map, scenario.routes, target]);
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
  if (risk.kind === "severe-snow") return operations.severeWeather;
  return `${copy.drivingRestRisk} ${risk.deadline?.slice(11, 16) ?? ""}`.trim();
}

function riskIcon(entry: DerivedRisk, locale: Locale) {
  const { risk, state } = entry; const label = escapeHtml(riskLabel(risk, locale));
  const symbol = risk.kind === "height-restriction" ? `${risk.limitMeters}m` : risk.kind === "weight-restriction" ? `${risk.limitTonnes}t` : risk.kind === "road-closure" ? "×" : risk.kind === "severe-snow" ? "SNOW" : "REST";
  return divIcon({ className: `risk-marker risk-${risk.kind} map-layer-${state}`, html: `<span class="risk-marker-symbol">${symbol}</span><span class="risk-marker-label">${label}</span>`, iconAnchor: [14, 14], iconSize: [120, 28] });
}

function RiskLayers({ entries, locale }: { entries: readonly DerivedRisk[]; locale: Locale }) {
  return entries.map((entry) => {
    const { risk, state } = entry; const color = severityColors[risk.severity]; const opacity = state === "muted" ? 0.18 : state === "selected" ? 1 : 0.72;
    const pathOptions = { className: `risk-overlay risk-overlay-${risk.kind} risk-overlay-${risk.severity} map-path-${state}`, color, dashArray: risk.kind === "road-closure" ? "8 6" : undefined, fillColor: color, fillOpacity: risk.kind === "severe-snow" ? opacity * 0.16 : 0, opacity, weight: state === "selected" ? 5 : 3 };
    const shape = risk.geometry.geometry.type === "Polygon"
      ? <Polygon pathOptions={pathOptions} positions={risk.geometry.geometry.coordinates[0].map(toPosition)} />
      : <Polyline noClip pathOptions={pathOptions} positions={risk.geometry.geometry.coordinates.map(toPosition)} smoothFactor={0} />;
    return <Fragment key={risk.id}>{shape}<Marker alt={riskLabel(risk, locale)} icon={riskIcon(entry, locale)} interactive={false} keyboard={false} position={riskPosition(risk)} title={riskLabel(risk, locale)} zIndexOffset={state === "selected" ? 1300 : 500} /></Fragment>;
  });
}

function routeStyle({ state }: DerivedRoute) {
  const className = `route-corridor route-corridor-${state}`;
  if (state === "selected") return { className, color: "#2563a6", opacity: 1, weight: 5 };
  if (state === "matched") return { className, color: "#47758a", opacity: 0.72, weight: 3 };
  if (state === "muted") return { className, color: "#647781", opacity: 0.14, weight: 2 };
  return { className, color: "#607985", opacity: 0.48, weight: 2 };
}

export function FleetMap({ locale, scenario }: { locale: Locale; scenario: OperatingRegion }) {
  const activeFilters = useUiCoordinationStore((state) => state.activeFilters);
  const panelContext = useUiCoordinationStore((state) => state.panelContext);
  const railState = useUiCoordinationStore((state) => state.railState);
  const selection = useUiCoordinationStore((state) => state.selection);
  const selectedVehicleId = selection.kind === "vehicle" ? selection.vehicleId : "";
  const layers = useMemo(() => deriveMapLayers(scenario, activeFilters, selectedVehicleId), [activeFilters, scenario, selectedVehicleId]);
  const coordinator = useMemo(() => new MapEventCoordinator(), []);
  const copy = catalog(locale);
  const cancelManualFollow = (): void => { coordinator.recordManualInteraction(); useUiCoordinationStore.getState().cancelFollow(); };
  const layoutSignature = `${railState}:${panelContext.mode}:${selection.kind}:${selectedVehicleId}`;
  return <div aria-label={copy.currentRoute} className="map-frame" onKeyDown={(event) => { if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "+", "-", "="].includes(event.key)) cancelManualFollow(); }} onPointerDown={cancelManualFollow} onWheel={cancelManualFollow}>
    <MapContainer bounds={SPAIN_BOUNDS} boundsOptions={{ padding: [24, 24] }} className="fleet-map" maxZoom={12} minZoom={5} zoomControl>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <MapEvents coordinator={coordinator} /><MapFocus coordinator={coordinator} scenario={scenario} /><MapLayout coordinator={coordinator} signature={layoutSignature} />
      {layers.routes.map((entry) => <Polyline key={entry.route.id} noClip pathOptions={routeStyle(entry)} positions={routePositions(entry.route)} smoothFactor={0} />)}
      <RiskLayers entries={layers.risks} locale={locale} />
      <VehicleMarkerLayer locale={locale} onSelect={(vehicleId) => useUiCoordinationStore.getState().selectVehicle(vehicleId)} vehicles={layers.vehicles} />
    </MapContainer>
    <MapLegend locale={locale} />
  </div>;
}
