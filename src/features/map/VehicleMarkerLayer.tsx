import { divIcon, type DivIcon } from "leaflet";
import { Fragment, useEffect } from "react";
import { Marker, useMap } from "react-leaflet";
import { getVehicleDisplayName } from "../../domain/entities";
import { catalog, interpolate, type Locale } from "../../preferences/i18n/catalog";
import type { DerivedVehicle, LayerState } from "./layers";
import { placeLabels, type ScreenRect } from "./labelPlacement";

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function createVehicleMarkerIcons(vehicle: DerivedVehicle["vehicle"], state: LayerState): { truck: DivIcon; label: DivIcon } {
  const label = escapeHtml(getVehicleDisplayName(vehicle));
  const status = escapeHtml(vehicle.status);
  return {
    truck: divIcon({
      className: `fleet-truck-icon map-layer-${state}`,
      html: `<span data-vehicle-truck="${vehicle.internalId}" class="fleet-status-pin status-${status}" aria-hidden="true"></span><span class="fleet-truck-shape" aria-hidden="true"><span></span></span>`,
      iconAnchor: [15, 15], iconSize: [30, 30],
    }),
    label: divIcon({
      className: `fleet-label-icon map-layer-${state}`,
      html: `<span data-vehicle-label="${vehicle.internalId}" class="fleet-marker-label">${label}</span>`,
      iconAnchor: [-18, 14], iconSize: [104, 28],
    }),
  };
}

export function VehicleMarkerLayer({ locale, onSelect, vehicles }: { locale: Locale; onSelect(vehicleId: string): void; vehicles: readonly DerivedVehicle[] }) {
  const map = useMap();
  const copy = catalog(locale);
  const suffix = locale === "es" ? { truck: "camión", label: "etiqueta" } : { truck: "truck", label: "label" };
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
        const obstacles: ScreenRect[] = [...trucks.values(), ...[...map.getContainer().querySelectorAll<HTMLElement>(".risk-marker")].map((node) => node.getBoundingClientRect())];
        const points = labelNodes.map((node) => { const truck = trucks.get(node.dataset.vehicleLabel!)!; return { id: node.dataset.vehicleLabel!, x: truck.x + truck.width / 2, y: truck.y + truck.height / 2 }; });
        const placements = new Map(placeLabels(points, { x: containerRect.x + 8, y: containerRect.y + 8, width: containerRect.width - 16, height: containerRect.height - 16 }, obstacles).map((entry) => [entry.id, entry.rect]));
        labelNodes.forEach((node) => { const root = node.closest<HTMLElement>(".fleet-label-icon")!; const base = root.getBoundingClientRect(); const target = placements.get(node.dataset.vehicleLabel!)!; root.style.translate = `${target.x - base.x}px ${target.y - base.y}px`; });
      });
    };
    map.on("moveend zoomend resize", place); place();
    return () => { cancelAnimationFrame(frame); map.off("moveend zoomend resize", place); };
  }, [map, vehicles]);

  return vehicles.map(({ vehicle, state, zIndex }) => {
    const [longitude, latitude] = vehicle.position.geometry.coordinates;
    const displayName = getVehicleDisplayName(vehicle);
    const selectName = interpolate(copy.selectVehicle, { label: displayName });
    const icons = createVehicleMarkerIcons(vehicle, state);
    const eventHandlers = { click: () => onSelect(vehicle.internalId) };
    return <Fragment key={vehicle.internalId}>
      <Marker alt={`${selectName} ${suffix.truck}`} eventHandlers={eventHandlers} icon={icons.truck} keyboard pane="fleet-trucks" position={[latitude, longitude]} title={`${selectName} ${suffix.truck}`} zIndexOffset={zIndex} />
      <Marker alt={`${selectName} ${suffix.label}`} eventHandlers={eventHandlers} icon={icons.label} keyboard pane="fleet-labels" position={[latitude, longitude]} title={`${selectName} ${suffix.label}`} zIndexOffset={zIndex + 1} />
    </Fragment>;
  });
}
