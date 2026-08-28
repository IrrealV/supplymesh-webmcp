import { divIcon } from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Polygon, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { useUiCoordinationStore } from "../../app/state/useUiCoordinationStore";
import { getVehicleDisplayName, type OperatingRegion, type Vehicle } from "../../domain/entities";
import { catalog, interpolate, type Locale } from "../../preferences/i18n/catalog";
import { MapEventCoordinator } from "./MapEventCoordinator";
import { deriveMapLayers } from "./layers";

function escapeMarkerHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function markerIcon(vehicle: Vehicle, isEmphasized: boolean, selectLabel: string) {
  const label = getVehicleDisplayName(vehicle);
  const className = isEmphasized ? "fleet-marker-active" : "fleet-marker-muted";
  return divIcon({ className: "fleet-marker-wrap", html: `<button aria-label="${escapeMarkerHtml(selectLabel)}" class="fleet-marker ${className}" type="button">${escapeMarkerHtml(label)}</button>`, iconAnchor: [42, 15] });
}

function MapFocus({ selectedVehicle, coordinator }: { selectedVehicle: Vehicle | undefined; coordinator: MapEventCoordinator }) {
  const map = useMap();
  useEffect(() => {
    if (selectedVehicle === undefined) return;
    coordinator.beginProgrammaticFocus();
    const [longitude, latitude] = selectedVehicle.position.geometry.coordinates;
    map.flyTo([latitude, longitude], Math.max(map.getZoom(), 7), { duration: 0.65 });
  }, [coordinator, map, selectedVehicle]);
  return null;
}

function MapEvents({ coordinator }: { coordinator: MapEventCoordinator }) {
  const cancelFollow = useUiCoordinationStore((state) => state.cancelFollow);
  useMapEvents({
    movestart: () => { if (coordinator.shouldCancelFollowForViewportMove()) cancelFollow(); },
    moveend: () => coordinator.settleProgrammaticFocus(),
    dragstart: () => { if (coordinator.shouldCancelFollowForManualInteraction()) cancelFollow(); },
    zoomstart: () => { if (coordinator.shouldCancelFollowForViewportMove()) cancelFollow(); },
  });
  return null;
}

export function FleetMap({ locale, scenario }: { locale: Locale; scenario: OperatingRegion }) {
  const activeFilters = useUiCoordinationStore((state) => state.activeFilters);
  const selection = useUiCoordinationStore((state) => state.selection);
  const selectVehicle = useUiCoordinationStore((state) => state.selectVehicle);
  const activeFilter = [...activeFilters][0] ?? "";
  const selectedVehicleId = selection.kind === "vehicle" ? selection.vehicleId : "";
  const layers = useMemo(() => deriveMapLayers(scenario, activeFilter, selectedVehicleId), [activeFilter, scenario, selectedVehicleId]);
  const coordinator = useMemo(() => new MapEventCoordinator(), []);
  const selectedVehicle = scenario.vehicles.find((vehicle) => vehicle.internalId === selectedVehicleId);
  const copy = catalog(locale);

  return (
    <div aria-label={copy.currentRoute} className="map-frame" onKeyDown={() => useUiCoordinationStore.getState().cancelFollow()} onPointerDown={() => coordinator.shouldCancelFollowForManualInteraction() && useUiCoordinationStore.getState().cancelFollow()} onWheel={() => coordinator.shouldCancelFollowForManualInteraction() && useUiCoordinationStore.getState().cancelFollow()}>
      <MapContainer bounds={[[35.4, -9.7], [44.3, 3.6]]} className="fleet-map" zoomControl={false}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapEvents coordinator={coordinator} />
        <MapFocus coordinator={coordinator} selectedVehicle={selectedVehicle} />
        {scenario.routes.map((route) => {
          const isEmphasized = route.vehicleId === selectedVehicleId || (selectedVehicleId === "" && layers.vehicles.find((entry) => entry.vehicle.internalId === route.vehicleId)?.isEmphasized);
          return <Polyline key={route.id} pathOptions={{ color: "#0f766e", opacity: isEmphasized ? 0.76 : 0.15, weight: isEmphasized ? 3 : 2 }} positions={route.geometry.geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude])} />;
        })}
        {layers.risks.map(({ risk, isEmphasized }) => {
          const pathOptions = { color: risk.severity === "critical" ? "#b91c1c" : "#b45309", fillOpacity: isEmphasized ? 0.15 : 0.04, opacity: isEmphasized ? 0.8 : 0.16, weight: isEmphasized ? 3 : 2 };
          if (risk.geometry.geometry.type === "Polygon") {
            const positions = risk.geometry.geometry.coordinates[0].map(([longitude, latitude]) => [latitude, longitude] as [number, number]);
            return <Polygon key={risk.id} pathOptions={pathOptions} positions={positions} />;
          }
          const positions = risk.geometry.geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude] as [number, number]);
          return <Polyline key={risk.id} pathOptions={pathOptions} positions={positions} />;
        })}
        {layers.vehicles.map(({ vehicle, isEmphasized }) => {
          const [longitude, latitude] = vehicle.position.geometry.coordinates;
          return <Marker eventHandlers={{ click: () => selectVehicle(vehicle.internalId) }} icon={markerIcon(vehicle, isEmphasized, interpolate(copy.selectVehicle, { label: getVehicleDisplayName(vehicle) }))} keyboard={false} key={vehicle.internalId} position={[latitude, longitude]} />;
        })}
      </MapContainer>
    </div>
  );
}
