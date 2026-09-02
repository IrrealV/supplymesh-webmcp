import { divIcon, latLngBounds, type LatLngExpression, type Map as LeafletMap } from "leaflet";
import { Fragment, useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Pane, Polygon, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";
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

function toPosition([longitude, latitude]: readonly number[]): [number, number] { return [latitude, longitude]; }
function routePositions(route: DerivedRoute["route"]): LatLngExpression[] { return route.geometry.geometry.coordinates.map(toPosition); }
function escapeHtml(value: string | undefined): string { if (!value) return ""; return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }

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
  }, [comparison, coordinator, map, scenario, target]);
  return null;
}

function MapLayout({ coordinator, signature }: { coordinator: MapEventCoordinator; signature: string }) {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer() as HTMLElement & { _leaflet_map?: typeof map };
    container._leaflet_map = map;
    return () => {
      delete container._leaflet_map;
    };
  }, [map]);
  useEffect(() => {
    const handle = window.setTimeout(() => {
      coordinator.beginProgrammaticChange();
      map.invalidateSize();
      coordinator.settleProgrammaticChange();
    }, 240);
    return () => window.clearTimeout(handle);
  }, [coordinator, map, signature]);
  return null;
}

function MapEvents({ coordinator }: { coordinator: MapEventCoordinator }) {
  const onManualInteraction = (map: LeafletMap): void => {
    map.getContainer().focus();
    coordinator.recordManualInteraction();
    useUiCoordinationStore.getState().cancelFollow();
  };
  useMapEvents({
    dragstart: (event) => onManualInteraction(event.target),
    movestart: (event) => {
      if (coordinator.isProgrammaticChangeActive()) return;
      onManualInteraction(event.target);
    },
    zoomstart: (event) => {
      if (coordinator.isProgrammaticChangeActive()) return;
      onManualInteraction(event.target);
    },
  });
  return null;
}

function riskPosition(risk: OperationalRisk): [number, number] {
  if (risk.geometry.geometry.type === "Polygon") {
    const coordinates = risk.geometry.geometry.coordinates[0];
    const avgLng = coordinates.reduce((sum, [lng]) => sum + lng, 0) / coordinates.length;
    const avgLat = coordinates.reduce((sum, [, lat]) => sum + lat, 0) / coordinates.length;
    return [avgLat, avgLng];
  }
  return toPosition(risk.geometry.geometry.coordinates[0]);
}

function riskLabel(risk: OperationalRisk, locale: Locale): string {
  const copy = operationalCopy(locale);
  if (risk.kind === "height-restriction") return `${risk.limitMeters}m ${copy.lowClearance}`;
  if (risk.kind === "weight-restriction") return `${risk.limitTonnes}t ${copy.weightRestriction}`;
  if (risk.kind === "road-closure") return copy.roadClosure;
  if (risk.kind === "severe-snow") return copy.severeSnow;
  if (risk.kind === "heavy-rain") return copy.heavyRain;
  if (risk.kind === "severe-storm") return copy.severeStorm;
  if (risk.kind === "calima") return copy.calima;
  if (risk.kind === "landslide") return copy.landslide;
  return copy.restDeadlineRisk;
}

function riskIcon(entry: DerivedRisk, locale: Locale) {
  const { risk, state } = entry; const label = escapeHtml(riskLabel(risk, locale));
  const symbol = risk.kind === "height-restriction" ? `${risk.limitMeters}m` : risk.kind === "weight-restriction" ? `${risk.limitTonnes}t` : risk.kind === "road-closure" ? "×" : risk.kind === "severe-snow" ? String.fromCodePoint(0x2744) : risk.kind === "heavy-rain" ? String.fromCodePoint(0x1F327) : risk.kind === "severe-storm" ? String.fromCodePoint(0x26A1) : risk.kind === "calima" ? String.fromCodePoint(0x1F32B) : `REST ${risk.deadline?.slice(11, 16) ?? ""}`.trim();
  return divIcon({ className: `risk-marker risk-${risk.kind} map-layer-${state}`, html: `<span class="risk-marker-symbol">${symbol}</span><span class="risk-marker-label">${label}</span>`, iconAnchor: [14, 14], iconSize: [state === "selected" ? 120 : 64, 28] });
}

function RiskLayers({ entries, locale }: { entries: readonly DerivedRisk[]; locale: Locale }) {
  const map = useMap();
  const showWeatherFx = true;

  return entries.map((entry) => {
    const { risk, state } = entry;
    const isWeatherRisk = ["severe-snow", "heavy-rain", "severe-storm", "calima"].includes(risk.kind);
    const color = isWeatherRisk ? WEATHER_RISK_COLOR : severityColors[risk.severity];
    const opacity = state === "muted" ? 0.18 : state === "selected" ? 1 : 0.72;
    const fillOpacity = isWeatherRisk ? state === "muted" ? 0.12 : state === "selected" ? 0.35 : state === "matched" ? 0.30 : 0.25 : 0;
    const onRiskClick = () => {
      map.flyTo(riskPosition(risk), 9, { duration: 0.8 });
    };
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
      ? <Polygon key={shapeKey} {...pathOptions} eventHandlers={{ click: onRiskClick }} positions={risk.geometry.geometry.coordinates[0].map(toPosition)} />
      : <Polyline key={shapeKey} {...pathOptions} eventHandlers={{ click: onRiskClick }} noClip positions={risk.geometry.geometry.coordinates.map(toPosition)} smoothFactor={0} />;
      
    const weatherFx = isWeatherRisk && showWeatherFx ? (
      <Marker key={`fx-${shapeKey}`} alt="" interactive={false} keyboard={false} pane="weather-effects" position={riskPosition(risk)} icon={divIcon({ className: `weather-fx-container`, html: `<div class="weather-fx-zone weather-fx-${risk.kind}"></div>`, iconSize: [360, 360], iconAnchor: [180, 180] })} />
    ) : null;
    
    return (
      <Fragment key={risk.id}>
        {shape}
        {weatherFx}
        <Marker
          alt={riskLabel(risk, locale)}
          eventHandlers={{ click: onRiskClick }}
          icon={riskIcon(entry, locale)}
          interactive={true}
          keyboard={false}
          pane="risk-tokens"
          position={riskPosition(risk)}
          title={riskLabel(risk, locale)}
          zIndexOffset={state === "selected" ? 1300 : 500}
        />
      </Fragment>
    );
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
  const routeSnap = heightRisk?.routeSnaps?.find((snap) => snap.routeId === "route-011");
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

function MapPlacementHandler() {
  const placementMode = useUiCoordinationStore((state) => state.placementMode);
  const placementCoordinates = useUiCoordinationStore((state) => state.placementCoordinates);
  const setPlacementCoordinates = useUiCoordinationStore((state) => state.setPlacementCoordinates);
  const cancelPlacement = useUiCoordinationStore((state) => state.cancelPlacement);
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    if (placementMode) {
      container.classList.add("placement-mode");
    } else {
      container.classList.remove("placement-mode");
    }
    return () => {
      container.classList.remove("placement-mode");
    };
  }, [map, placementMode]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && placementMode) {
        cancelPlacement();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cancelPlacement, placementMode]);

  useMapEvents({
    click(e) {
      if (useUiCoordinationStore.getState().placementMode) {
        setPlacementCoordinates([e.latlng.lng, e.latlng.lat]);
      }
    },
  });

  if (!placementCoordinates) return null;

  return (
    <Marker
      position={[placementCoordinates[1], placementCoordinates[0]]}
      icon={divIcon({
        className: "placement-preview-marker",
        html: '<div class="placement-preview-pin"></div>',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      })}
      pane="fleet-trucks"
    />
  );
}

export function FleetMap({ availableComparison, comparison, locale, recoveryExecuted = false, scenario }: { availableComparison?: Unit211RecoveryComparisonModel; comparison?: Unit211RecoveryComparisonModel; locale: Locale; recoveryExecuted?: boolean; scenario: OperatingRegion }) {
  const activeFilters = useUiCoordinationStore((state) => state.activeFilters);
  const panelContext = useUiCoordinationStore((state) => state.panelContext);
  const selection = useUiCoordinationStore((state) => state.selection);
  const placementMode = useUiCoordinationStore((state) => state.placementMode);
  const placementCoordinates = useUiCoordinationStore((state) => state.placementCoordinates);
  const cancelPlacement = useUiCoordinationStore((state) => state.cancelPlacement);
  const selectedVehicleId = selection.kind === "vehicle" ? selection.vehicleId : "";
  const layers = useMemo(() => deriveMapLayers(scenario, activeFilters, selectedVehicleId), [activeFilters, scenario, selectedVehicleId]);
  const visibleRisks = useMemo(() => selectVisibleRisks(layers.risks, selectedVehicleId).filter(({ risk }) => risk.id !== (comparison ?? availableComparison)?.incident.riskId), [availableComparison, comparison, layers.risks, selectedVehicleId]);
  const coordinator = useMemo(() => new MapEventCoordinator(), []);
  const copy = catalog(locale);
  const cancelManualFollow = (): void => { coordinator.recordManualInteraction(); useUiCoordinationStore.getState().cancelFollow(); };
  const layoutSignature = `${panelContext.mode}:${selection.kind}:${selectedVehicleId}:${comparison?.incident.id ?? ""}`; const recoveryCopy = recoveryComparisonCopy(locale); const hasExecuted = recoveryExecuted;
  return <div aria-label={copy.currentRoute} className="map-frame" onKeyDown={(event) => { if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "+", "-", "="].includes(event.key)) cancelManualFollow(); }} onPointerDown={cancelManualFollow} onWheel={cancelManualFollow}>
    {placementMode && !placementCoordinates && (
      <div className="map-placement-banner" role="status">
        <span>🎯 {copy.placementBanner}</span>
        <button
          type="button"
          onClick={() => cancelPlacement()}
        >
          {copy.cancel}
        </button>
      </div>
    )}
    <MapContainer center={[40.1, -3.55]} className="fleet-map" maxZoom={18} minZoom={5} zoom={6.5} zoomControl zoomSnap={0.5}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Pane name="risk-tokens" style={{ zIndex: 620 }} /><Pane name="weather-effects" style={{ zIndex: 615 }} /><Pane name="fleet-trucks" style={{ zIndex: 640 }} /><Pane name="fleet-labels" style={{ zIndex: 660 }} /><Pane name="close-range-hazards" style={{ zIndex: 680 }} />
      <MapEvents coordinator={coordinator} /><MapFocus comparison={comparison} coordinator={coordinator} scenario={scenario} /><MapLayout coordinator={coordinator} signature={layoutSignature} />
      {layers.routes.filter((entry) => entry.route.id !== comparison?.current.id && entry.route.id !== comparison?.alternative.id).map((entry) => <Polyline key={`${entry.route.id}:${entry.state}`} {...routeStyle(entry)} noClip positions={routePositions(entry.route)} smoothFactor={0} />)}
      <RiskLayers entries={visibleRisks} locale={locale} />
      <CloseRangeBridgeHazard scenario={scenario} />
      <MapPlacementHandler />
      {(comparison ?? availableComparison) && <RecoveryComparisonLayers comparison={comparison !== undefined} executed={hasExecuted} locale={locale} model={(comparison ?? availableComparison)!} onIncidentSelect={comparison ? undefined : (vehicleId) => useUiCoordinationStore.getState().selectVehicle(vehicleId, "operational-map")} />}
      <VehicleMarkerLayer coordinator={coordinator} locale={locale} onSelect={(vehicleId) => useUiCoordinationStore.getState().selectVehicle(vehicleId)} routes={scenario.routes} vehicles={layers.vehicles} />
    </MapContainer>
    {comparison && <><p className="visually-hidden" data-route-state={hasExecuted ? "applied" : "comparison"} id="recovery-map-summary">{comparison.vehicle.displayLabel}. {recoveryCopy.current} · {comparison.current.statusLabel}. {recoveryCopy.alternative} · {comparison.alternative.statusLabel}. {recoveryCopy.exclusionZone}. {recoveryCopy.clearanceIncident}.</p><RecoveryIncidentInset locale={locale} model={comparison} /></>}
    <MapLegend locale={locale} />
  </div>;
}
