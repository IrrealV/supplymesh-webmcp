import { divIcon, type DivIcon } from "leaflet";
import { Fragment, useEffect, useState } from "react";
import { Marker, useMap } from "react-leaflet";
import { useUiCoordinationStore } from "../../app/state/useUiCoordinationStore";
import { getVehicleDisplayName } from "../../domain/entities";
import { catalog, interpolate, type Locale } from "../../preferences/i18n/catalog";
import { detectWebGlSupport, resolveCloseRangeVehicleId } from "./closeRangeMode";
import type { DerivedVehicle, LayerState } from "./layers";
import { placeLabels, type ScreenRect } from "./labelPlacement";

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

export function VehicleMarkerLayer({ locale, onSelect, vehicles }: { locale: Locale; onSelect(vehicleId: string): void; vehicles: readonly DerivedVehicle[] }) {
  const map = useMap();
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

  return vehicles.map(({ vehicle, state, zIndex }) => {
    const [longitude, latitude] = vehicle.position.geometry.coordinates;
    const displayName = getVehicleDisplayName(vehicle);
    const selectName = interpolate(copy.selectVehicle, { label: displayName });
    const icons = createVehicleMarkerIcons(vehicle, state, vehicle.internalId === closeRangeVehicleId);
    const eventHandlers = { click: () => onSelect(vehicle.internalId) };
    return <Fragment key={vehicle.internalId}>
      <Marker alt={displayName} eventHandlers={eventHandlers} icon={icons.truck} key={`truck:${vehicle.internalId}:${displayName}`} keyboard pane="fleet-trucks" position={[latitude, longitude]} title={displayName} zIndexOffset={zIndex} />
      <Marker alt={`${selectName} ${suffix.label}`} eventHandlers={eventHandlers} icon={icons.label} key={`label:${vehicle.internalId}:${displayName}`} keyboard pane="fleet-labels" position={[latitude, longitude]} title={`${selectName} ${suffix.label}`} zIndexOffset={zIndex + 1} />
    </Fragment>;
  });
}
