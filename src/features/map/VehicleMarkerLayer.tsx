import { divIcon, type DivIcon, type Marker as LeafletMarker } from "leaflet";
import { Fragment, useEffect, useRef, useState } from "react";
import { Marker, useMap } from "react-leaflet";
import { useUiCoordinationStore } from "../../app/state/useUiCoordinationStore";
import { getVehicleDisplayName, type Route } from "../../domain/entities";
import { catalog, interpolate, type Locale } from "../../preferences/i18n/catalog";
import { advanceRouteProgress, prepareRoutePath, resolveActiveRoute, sampleRoutePath, startFrameLoop } from "./closeRangeMotion";
import { detectWebGlSupport, resolveCloseRangeVehicleId } from "./closeRangeMode";
import type { DerivedVehicle, LayerState } from "./layers";
import { placeLabels, type ScreenRect } from "./labelPlacement";
import type { MapEventCoordinator } from "./MapEventCoordinator";

const LABEL_ZOOM_THRESHOLD = 7.5;

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function closeRangeTruckMarkup(vehicleId: string): string {
  return `<span aria-hidden="true" class="close-range-truck-model" data-close-range-model="${escapeHtml(vehicleId)}"><span class="close-range-truck-shadow"></span><span class="close-range-truck-rig"><span class="close-range-truck-trailer"></span><span class="close-range-truck-cab"></span><span class="close-range-truck-chassis"></span><span class="close-range-truck-wheel wheel-rear"></span><span class="close-range-truck-wheel wheel-front"></span></span></span>`;
}

function createVehicleMarkerIcons(vehicle: DerivedVehicle["vehicle"], state: LayerState, isCloseRangeActive: boolean): { truck: DivIcon; label: DivIcon } {
  const label = escapeHtml(getVehicleDisplayName(vehicle));
  const status = escapeHtml(vehicle.status);
  const closeRangeClass = isCloseRangeActive ? " close-range-vehicle-active" : "";
  const closeRangeModel = isCloseRangeActive ? closeRangeTruckMarkup(vehicle.internalId) : "";
  return {
    truck: divIcon({
      className: `fleet-truck-icon map-layer-${state}${closeRangeClass}`,
      html: `<span data-vehicle-truck="${vehicle.internalId}" class="fleet-status-pin fleet-vehicle-pin status-${status}" aria-hidden="true"><span class="fleet-selection-aura"></span><svg class="fleet-vehicle-glyph" viewBox="0 0 28 28"><path d="M4.5 7.5h12.3v9.4H4.5z"/><path d="M16.8 10.2h4.1l2.6 3.2v3.5h-6.7z"/><circle cx="8" cy="19.2" r="2.1"/><circle cx="20.2" cy="19.2" r="2.1"/></svg>${closeRangeModel}</span>`,
      iconAnchor: isCloseRangeActive ? [56, 54] : [20, 20],
      iconSize: isCloseRangeActive ? [112, 92] : [40, 40],
    }),
    label: divIcon({
      className: `fleet-label-icon map-layer-${state}`,
      html: `<span data-vehicle-label="${vehicle.internalId}" class="fleet-marker-label" aria-hidden="true">${label}</span>`,
      iconAnchor: [52, 50], iconSize: [112, 30],
    }),
  };
}

export function VehicleMarkerLayer({ coordinator, locale, onSelect, routes, vehicles }: { coordinator: MapEventCoordinator; locale: Locale; onSelect(vehicleId: string): void; routes: readonly Route[]; vehicles: readonly DerivedVehicle[] }) {
  const map = useMap();
  const labelMarkers = useRef(new Map<string, LeafletMarker>());
  const truckMarkers = useRef(new Map<string, LeafletMarker>());
  const follow = useUiCoordinationStore((state) => state.follow);
  const selection = useUiCoordinationStore((state) => state.selection);
  const [mapZoom, setMapZoom] = useState(() => map.getZoom());
  const [isWebGlAvailable] = useState(() => typeof window.WebGLRenderingContext !== "undefined" && detectWebGlSupport());
  const copy = catalog(locale);
  const suffix = locale === "es" ? { truck: "camion", label: "etiqueta" } : { truck: "truck", label: "label" };
  const closeRangeVehicleId = resolveCloseRangeVehicleId({
    followedVehicleId: follow.kind === "vehicle" ? follow.vehicleId : "",
    isWebGlAvailable,
    selectedVehicleId: selection.kind === "vehicle" ? selection.vehicleId : "",
    zoom: mapZoom,
  });
  useEffect(() => {
    const container = map.getContainer();
    const syncZoom = (): void => {
      const zoom = map.getZoom();
      container.classList.toggle("map-labels-visible", zoom >= LABEL_ZOOM_THRESHOLD);
      setMapZoom((current) => current === zoom ? current : zoom);
    };
    map.on("zoom zoomend", syncZoom);
    syncZoom();
    return () => { map.off("zoom zoomend", syncZoom); container.classList.remove("map-labels-visible"); };
  }, [map]);
  useEffect(() => {
    const container = map.getContainer();
    container.dataset.closeRangeMode = closeRangeVehicleId === "" ? "inactive" : "active";
    container.dataset.closeRangeRenderer = isWebGlAvailable ? "css-3d" : "2d-fallback";
    if (closeRangeVehicleId === "") delete container.dataset.closeRangeVehicleId;
    else container.dataset.closeRangeVehicleId = closeRangeVehicleId;
    return () => {
      delete container.dataset.closeRangeMode;
      delete container.dataset.closeRangeRenderer;
      delete container.dataset.closeRangeVehicleId;
    };
  }, [closeRangeVehicleId, isWebGlAvailable, map]);
  useEffect(() => {
    let frame = 0;
    const place = (): void => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const containerRect = map.getContainer().getBoundingClientRect();
        const labelNodes = [...map.getContainer().querySelectorAll<HTMLElement>("[data-vehicle-label]")];
        const roots = labelNodes.map((node) => node.closest<HTMLElement>(".fleet-label-icon")!).filter(Boolean);
        roots.forEach((root) => { root.style.translate = "0 0"; });
        const trucks = new Map([...map.getContainer().querySelectorAll<HTMLElement>("[data-vehicle-truck]")].map((node) => [node.dataset.vehicleTruck!, node.closest<HTMLElement>(".fleet-truck-icon")!.getBoundingClientRect()]));
        const obstacles: ScreenRect[] = [...trucks.values(), ...[...map.getContainer().querySelectorAll<HTMLElement>(".risk-marker")].map((node) => node.getBoundingClientRect())].map(({ height, width, x, y }) => ({ height: height + 16, width: width + 16, x: x - 8, y: y - 8 }));
        const points = labelNodes.map((node) => { const truck = trucks.get(node.dataset.vehicleLabel!)!; return { id: node.dataset.vehicleLabel!, x: truck.x + truck.width / 2, y: truck.y + truck.height / 2 }; });
        const placements = new Map(placeLabels(points, { x: containerRect.x + 8, y: containerRect.y + 8, width: containerRect.width - 16, height: containerRect.height - 16 }, obstacles).map((entry) => [entry.id, entry.rect]));
        labelNodes.forEach((node) => { const root = node.closest<HTMLElement>(".fleet-label-icon")!; const base = root.getBoundingClientRect(); const target = placements.get(node.dataset.vehicleLabel!)!; root.style.translate = `${target.x - base.x}px ${target.y - base.y}px`; });
      });
    };
    map.on("moveend zoomend resize", place); place();
    return () => { cancelAnimationFrame(frame); map.off("moveend zoomend resize", place); };
  }, [closeRangeVehicleId, map, vehicles]);
  useEffect(() => {
    if (closeRangeVehicleId === "") { return; }
    const activeVehicle = vehicles.find(({ vehicle }) => vehicle.internalId === closeRangeVehicleId)?.vehicle;
    const activeRoute = activeVehicle === undefined ? undefined : resolveActiveRoute(routes, activeVehicle.internalId, activeVehicle.routeId);
    const truck = truckMarkers.current.get(closeRangeVehicleId); const label = labelMarkers.current.get(closeRangeVehicleId);
    if (activeVehicle === undefined || activeRoute === undefined || truck === undefined || label === undefined) { return; }
    const path = prepareRoutePath(activeRoute.geometry.geometry.coordinates);
    const container = map.getContainer(); const model = container.querySelector<HTMLElement>("[data-close-range-model]");
    const [authoritativeLongitude, authoritativeLatitude] = activeVehicle.position.geometry.coordinates;
    let progress = activeVehicle.routeProgress; let previousTime = 0; let lastPanTime = Number.NEGATIVE_INFINITY;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    const renderFrame = (): [number, number] => {
      const sample = sampleRoutePath(path, progress); const [longitude, latitude] = sample.coordinate;
      truck.setLatLng([latitude, longitude]); label.setLatLng([latitude, longitude]);
      const bearing = sample.bearing.toFixed(2); const renderedProgress = sample.progress.toFixed(6);
      container.dataset.closeRangeBearing = bearing; container.dataset.closeRangeProgress = renderedProgress; container.dataset.closeRangeRouteId = activeRoute.id;
      if (model !== null) { model.dataset.routeBearing = bearing; model.dataset.routeProgress = renderedProgress; model.style.setProperty("--close-range-bearing", `${sample.bearing - 63}deg`); }
      return [latitude, longitude];
    };
    const reset = (): void => {
      truck.setLatLng([authoritativeLatitude, authoritativeLongitude]); label.setLatLng([authoritativeLatitude, authoritativeLongitude]);
      delete container.dataset.closeRangeBearing; delete container.dataset.closeRangeProgress; delete container.dataset.closeRangeRouteId; delete container.dataset.closeRangeCamera;
      if (model !== null) { delete model.dataset.routeBearing; delete model.dataset.routeProgress; model.style.removeProperty("--close-range-bearing"); }
    };
    renderFrame(); container.dataset.closeRangeCamera = reduceMotion ? "static" : "following";
    if (reduceMotion) { return reset; }
    const scheduler = { cancel: window.cancelAnimationFrame.bind(window), request: window.requestAnimationFrame.bind(window) };
    const stop = startFrameLoop(scheduler, (time) => {
      if (document.hidden) { previousTime = 0; return; }
      const elapsed = previousTime === 0 ? 0 : Math.min(100, time - previousTime); previousTime = time;
      progress = advanceRouteProgress(progress, elapsed, activeRoute.summary.distanceMeters, 24);
      const position = renderFrame();
      if (time - lastPanTime >= 120) {
        coordinator.beginProgrammaticChange();
        try { map.panTo(position, { animate: false }); } finally { coordinator.settleProgrammaticChange(); }
        lastPanTime = time;
      }
    });
    const handleVisibility = (): void => { previousTime = 0; container.dataset.closeRangeCamera = document.hidden ? "paused" : "following"; };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", handleVisibility); reset(); };
  }, [closeRangeVehicleId, coordinator, locale, map, routes, vehicles]);

  return vehicles.map(({ vehicle, state, zIndex }) => {
    const [longitude, latitude] = vehicle.position.geometry.coordinates;
    const displayName = getVehicleDisplayName(vehicle);
    const selectName = interpolate(copy.selectVehicle, { label: displayName });
    const icons = createVehicleMarkerIcons(vehicle, state, vehicle.internalId === closeRangeVehicleId);
    const eventHandlers = { click: () => onSelect(vehicle.internalId) };
    return <Fragment key={vehicle.internalId}>
      <Marker alt={displayName} eventHandlers={eventHandlers} icon={icons.truck} key={`truck:${vehicle.internalId}:${displayName}`} keyboard pane="fleet-trucks" position={[latitude, longitude]} ref={(marker) => { if (marker === null) truckMarkers.current.delete(vehicle.internalId); else truckMarkers.current.set(vehicle.internalId, marker); }} title={displayName} zIndexOffset={zIndex} />
      <Marker alt={`${selectName} ${suffix.label}`} eventHandlers={eventHandlers} icon={icons.label} key={`label:${vehicle.internalId}:${displayName}`} keyboard pane="fleet-labels" position={[latitude, longitude]} ref={(marker) => { if (marker === null) labelMarkers.current.delete(vehicle.internalId); else labelMarkers.current.set(vehicle.internalId, marker); }} title={`${selectName} ${suffix.label}`} zIndexOffset={zIndex + 1} />
    </Fragment>;
  });
}
