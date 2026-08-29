import { divIcon, type DivIcon } from "leaflet";
import { Fragment } from "react";
import { Marker } from "react-leaflet";
import { getVehicleDisplayName } from "../../domain/entities";
import { catalog, interpolate, type Locale } from "../../preferences/i18n/catalog";
import type { DerivedVehicle, LayerState } from "./layers";

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function createVehicleMarkerIcons(vehicle: DerivedVehicle["vehicle"], state: LayerState): { truck: DivIcon; label: DivIcon } {
  const label = escapeHtml(getVehicleDisplayName(vehicle));
  const status = escapeHtml(vehicle.status);
  return {
    truck: divIcon({
      className: `fleet-truck-icon map-layer-${state}`,
      html: `<span class="fleet-status-pin status-${status}" aria-hidden="true"></span><span class="fleet-truck-shape" aria-hidden="true"><span></span></span>`,
      iconAnchor: [15, 15], iconSize: [30, 30],
    }),
    label: divIcon({
      className: `fleet-label-icon map-layer-${state}`,
      html: `<span class="fleet-marker-label">${label}</span>`,
      iconAnchor: [-18, 14], iconSize: [104, 28],
    }),
  };
}

export function VehicleMarkerLayer({ locale, onSelect, vehicles }: { locale: Locale; onSelect(vehicleId: string): void; vehicles: readonly DerivedVehicle[] }) {
  const copy = catalog(locale);
  const suffix = locale === "es" ? { truck: "camión", label: "etiqueta" } : { truck: "truck", label: "label" };
  return vehicles.map(({ vehicle, state, zIndex }) => {
    const [longitude, latitude] = vehicle.position.geometry.coordinates;
    const displayName = getVehicleDisplayName(vehicle);
    const selectName = interpolate(copy.selectVehicle, { label: displayName });
    const icons = createVehicleMarkerIcons(vehicle, state);
    const eventHandlers = { click: () => onSelect(vehicle.internalId) };
    return <Fragment key={vehicle.internalId}>
      <Marker alt={`${selectName} ${suffix.truck}`} eventHandlers={eventHandlers} icon={icons.truck} keyboard position={[latitude, longitude]} title={`${selectName} ${suffix.truck}`} zIndexOffset={zIndex} />
      <Marker alt={`${selectName} ${suffix.label}`} eventHandlers={eventHandlers} icon={icons.label} keyboard position={[latitude, longitude]} title={`${selectName} ${suffix.label}`} zIndexOffset={zIndex + 1} />
    </Fragment>;
  });
}
