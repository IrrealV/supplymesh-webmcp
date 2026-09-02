import { divIcon, type DivIcon, type Marker as LeafletMarker } from "leaflet";
import { Fragment, useEffect, useRef, useState } from "react";
import { Marker, useMap } from "react-leaflet";
import { useUiCoordinationStore } from "../../app/state/useUiCoordinationStore";
import { getVehicleDisplayName, type Route } from "../../domain/entities";
import { catalog, interpolate, type Locale } from "../../preferences/i18n/catalog";
import { startFrameLoop } from "./closeRangeMotion";
import { detectWebGlSupport, isCloseRangeModeActive } from "./closeRangeMode";
import { useFleetMotionStore } from "./fleetMotionStore";
import type { DerivedVehicle, LayerState } from "./layers";
import { placeLabels, type ScreenRect } from "./labelPlacement";
import type { MapEventCoordinator } from "./MapEventCoordinator";
import { evaluateVehicleMotion } from "./vehicleMotion";
import { ThreeFleetOverlay } from "./three/ThreeFleetOverlay";

const LABEL_ZOOM_THRESHOLD = 7.5;

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function createVehicleMarkerIcons(
  vehicle: DerivedVehicle["vehicle"],
  state: LayerState,
  isCloseRangeActive: boolean,
  locale: Locale
): { truck: DivIcon; label: DivIcon } {
  const label = escapeHtml(getVehicleDisplayName(vehicle));
  const status = escapeHtml(vehicle.status);
  const closeRangeClass = isCloseRangeActive ? " close-range-vehicle-active" : "";
  const motionEval = evaluateVehicleMotion(vehicle);
  const stoppedBadge = !motionEval.isMoving
    ? `<span class="fleet-stopped-badge" data-stopped-indicator="${vehicle.internalId}" title="${escapeHtml(motionEval.reasonText[locale])}">🛑</span>`
    : "";

  return {
    truck: divIcon({
      className: `fleet-truck-icon map-layer-${state}${closeRangeClass}`,
      html: `<span data-vehicle-truck="${vehicle.internalId}" data-motion-status="${motionEval.isMoving ? "moving" : "stopped"}" ${!motionEval.isMoving ? `data-stopped-reason="${escapeHtml(motionEval.reasonText[locale])}"` : ""} class="fleet-status-pin fleet-vehicle-pin status-${status}" aria-hidden="true" title="${!motionEval.isMoving ? escapeHtml(motionEval.reasonText[locale]) : ""}"><span class="fleet-selection-aura"></span><svg class="fleet-vehicle-glyph" viewBox="0 0 28 28"><path d="M4.5 7.5h12.3v9.4H4.5z"/><path d="M16.8 10.2h4.1l2.6 3.2v3.5h-6.7z"/><circle cx="8" cy="19.2" r="2.1"/><circle cx="20.2" cy="19.2" r="2.1"/></svg>${stoppedBadge}</span>`,
      iconAnchor: [20, 20],
      iconSize: [40, 40],
    }),
    label: divIcon({
      className: `fleet-label-icon map-layer-${state}`,
      html: `<span data-vehicle-label="${vehicle.internalId}" class="fleet-marker-label" aria-hidden="true">${label}</span>`,
      iconAnchor: [52, 50],
      iconSize: [112, 30],
    }),
  };
}

export function VehicleMarkerLayer({ coordinator, locale, onSelect, routes, vehicles }: { coordinator: MapEventCoordinator; locale: Locale; onSelect(vehicleId: string): void; routes: readonly Route[]; vehicles: readonly DerivedVehicle[] }) {
  const map = useMap();
  const labelMarkers = useRef(new Map<string, LeafletMarker>());
  const truckMarkers = useRef(new Map<string, LeafletMarker>());
  const follow = useUiCoordinationStore((state) => state.follow);
  const [mapZoom, setMapZoom] = useState(() => map.getZoom());
  const [isWebGlAvailable] = useState(() => typeof window.WebGLRenderingContext !== "undefined" && detectWebGlSupport());
  const copy = catalog(locale);
  const suffix = locale === "es" ? { truck: "camion", label: "etiqueta" } : { truck: "truck", label: "label" };
  const is3DMode = isCloseRangeModeActive({ isWebGlAvailable, zoom: mapZoom });
  const followedVehicleId = follow.kind === "vehicle" ? follow.vehicleId : "";
  useEffect(() => {
    useFleetMotionStore.getState().initialize(vehicles.map(v => v.vehicle), routes);
  }, [vehicles, routes]);
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
    container.dataset.closeRangeMode = is3DMode ? "active" : "inactive";
    container.dataset.closeRangeRenderer = isWebGlAvailable ? "three-webgl" : "2d-fallback";
    if (!is3DMode) delete container.dataset.closeRangeVehicleId;
    else if (followedVehicleId) container.dataset.closeRangeVehicleId = followedVehicleId;
    return () => {
      delete container.dataset.closeRangeMode;
      delete container.dataset.closeRangeRenderer;
      delete container.dataset.closeRangeVehicleId;
    };
  }, [is3DMode, followedVehicleId, isWebGlAvailable, map]);
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
  }, [is3DMode, map, vehicles]);
  useEffect(() => {
    let previousTime = 0; let lastPanTime = Number.NEGATIVE_INFINITY;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    const container = map.getContainer();
    
    const reset = (): void => {
      vehicles.forEach(({ vehicle }) => {
        const truck = truckMarkers.current.get(vehicle.internalId);
        const label = labelMarkers.current.get(vehicle.internalId);
        const [authoritativeLongitude, authoritativeLatitude] = vehicle.position.geometry.coordinates;
        if (truck) truck.setLatLng([authoritativeLatitude, authoritativeLongitude]);
        if (label) label.setLatLng([authoritativeLatitude, authoritativeLongitude]);
      });
      delete container.dataset.closeRangeCamera;
    };
    
    if (reduceMotion) {
      container.dataset.closeRangeCamera = "static";
      return reset;
    }
    
    const scheduler = {
      cancel: (id: number) => {
        if (typeof window.cancelAnimationFrame === "function") {
          window.cancelAnimationFrame(id);
        } else {
          clearTimeout(id);
        }
      },
      request: (callback: FrameRequestCallback) => {
        if (typeof window.requestAnimationFrame === "function") {
          return window.requestAnimationFrame(callback);
        }
        return Number(setTimeout(() => callback(performance.now()), 16));
      },
    };
    const stop = startFrameLoop(scheduler, (time) => {
      if (document.hidden) { previousTime = 0; return; }
      const elapsed = previousTime === 0 ? 0 : Math.min(100, time - previousTime); previousTime = time;
      
      const store = useFleetMotionStore.getState();
      store.updateFrame(elapsed, routes, vehicles.map(v => v.vehicle));
      const motions = store.motions;
      
      let followedPosition: [number, number] | null = null;
      
      vehicles.forEach(({ vehicle }) => {
        const motion = motions[vehicle.internalId];
        if (!motion) return;
        const truck = truckMarkers.current.get(vehicle.internalId);
        const label = labelMarkers.current.get(vehicle.internalId);
        if (truck) truck.setLatLng([motion.latitude, motion.longitude]);
        if (label) label.setLatLng([motion.latitude, motion.longitude]);
        
        if (followedVehicleId === vehicle.internalId) {
          followedPosition = [motion.latitude, motion.longitude];
        }
      });
      
      if (followedPosition && followedVehicleId) {
        container.dataset.closeRangeCamera = "following";
        if (is3DMode && time - lastPanTime >= 120) {
          coordinator.beginProgrammaticChange();
          try { map.panTo(followedPosition, { animate: false }); } finally { coordinator.settleProgrammaticChange(); }
          lastPanTime = time;
        }
      } else {
        container.dataset.closeRangeCamera = "static";
      }
    });
    
    const handleVisibility = (): void => { previousTime = 0; if(document.hidden) container.dataset.closeRangeCamera = "paused"; };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", handleVisibility); };
  }, [coordinator, followedVehicleId, is3DMode, map, routes, vehicles]);

  const selection = useUiCoordinationStore((state) => state.selection);
  const selectedVehicleId = selection.kind === "vehicle" ? selection.vehicleId : "";

  return (
    <>
      <ThreeFleetOverlay
        active={is3DMode}
        vehicles={vehicles}
        selectedVehicleId={selectedVehicleId}
      />
      {vehicles.map(({ vehicle, state, zIndex }) => {
        const [longitude, latitude] = vehicle.position.geometry.coordinates;
        const displayName = getVehicleDisplayName(vehicle);
        const selectName = interpolate(copy.selectVehicle, { label: displayName });
        const icons = createVehicleMarkerIcons(vehicle, state, is3DMode, locale);
        const eventHandlers = { click: () => onSelect(vehicle.internalId) };
        return (
          <Fragment key={vehicle.internalId}>
            <Marker
              alt={displayName}
              eventHandlers={eventHandlers}
              icon={icons.truck}
              key={`truck:${vehicle.internalId}:${displayName}`}
              keyboard
              pane="fleet-trucks"
              position={[latitude, longitude]}
              ref={(marker) => {
                if (marker === null) truckMarkers.current.delete(vehicle.internalId);
                else truckMarkers.current.set(vehicle.internalId, marker);
              }}
              title={displayName}
              zIndexOffset={zIndex}
            />
            <Marker
              alt={`${selectName} ${suffix.label}`}
              eventHandlers={eventHandlers}
              icon={icons.label}
              key={`label:${vehicle.internalId}:${displayName}`}
              keyboard
              pane="fleet-labels"
              position={[latitude, longitude]}
              ref={(marker) => {
                if (marker === null) labelMarkers.current.delete(vehicle.internalId);
                else labelMarkers.current.set(vehicle.internalId, marker);
              }}
              title={`${selectName} ${suffix.label}`}
              zIndexOffset={zIndex + 1}
            />
          </Fragment>
        );
      })}
    </>
  );
}
