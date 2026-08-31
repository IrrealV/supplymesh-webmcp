import { divIcon, latLngBounds, type LatLngTuple } from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, Pane, Polygon, Polyline, TileLayer, useMap } from "react-leaflet";
import type { PreviewCoordinate, Unit211RecoveryPreviewModel } from "./unit211RecoveryPreviewModel";

function latLng([longitude, latitude]: PreviewCoordinate): LatLngTuple { return [latitude, longitude]; }
function MapAccessibility({ label }: { label: string }) { const map = useMap(); useEffect(() => { const container = map.getContainer(); container.setAttribute("aria-label", label); container.setAttribute("role", "region"); return () => { container.removeAttribute("aria-label"); container.removeAttribute("role"); }; }, [label, map]); return null; }
const unitIcon = divIcon({ className: "recovery-unit-marker", html: '<span aria-label="Unit 211 at Toledo before departure" role="img">211</span>', iconAnchor: [18, 18], iconSize: [36, 36] });
const incidentIcon = divIcon({ className: "recovery-incident-marker", html: '<span aria-label="3.90 metre clearance incident" role="img">3.90 m</span>', iconAnchor: [25, 18], iconSize: [50, 36] });
const incidentPointIcon = divIcon({ className: "recovery-inset-marker", html: '<span aria-label="Clearance incident location" role="img"></span>', iconAnchor: [7, 7], iconSize: [14, 14] });

export function RecoveryComparisonMap({ model }: { model: Unit211RecoveryPreviewModel }) {
  const current = model.current.coordinates.map(latLng); const alternative = model.alternative.coordinates.map(latLng); const exclusion = model.incident.exclusionCoordinates.map(latLng);
  const bounds = latLngBounds([...current, ...alternative, ...exclusion]);
  return <section aria-describedby="recovery-map-summary" aria-label="Route comparison map" className="recovery-map-shell" id="recovery-comparison-map" tabIndex={-1}><p className="visually-hidden" id="recovery-map-summary">Unit 211 is at Toledo before departure. The rejected current route, valid alternative route, exact exclusion zone, and clearance incident are shown together.</p>
    <MapContainer bounds={bounds} boundsOptions={{ padding: [34, 34] }} className="recovery-map" maxZoom={13} minZoom={7} zoomControl>
      <MapAccessibility label="Route comparison map" />
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Pane name="recovery-exclusion" style={{ zIndex: 420 }} /><Pane name="recovery-routes" style={{ zIndex: 430 }} /><Pane name="recovery-markers" style={{ zIndex: 620 }} />
      <Polygon pane="recovery-exclusion" pathOptions={{ className: "recovery-exclusion", color: "#7c3aed", dashArray: "7 5", fillColor: "#8b5cf6", fillOpacity: 0.2, weight: 2.5 }} positions={exclusion} />
      <Polyline pane="recovery-routes" pathOptions={{ className: "recovery-current-route", color: "#d91929", dashArray: "10 8", opacity: 0.88, weight: 4 }} positions={current} />
      <Polyline pane="recovery-routes" pathOptions={{ className: "recovery-alternative-route", color: "#079455", opacity: 0.95, weight: 4.5 }} positions={alternative} />
      <Marker alt="Unit 211 at Toledo before departure" icon={unitIcon} interactive={false} keyboard={false} pane="recovery-markers" position={latLng(model.vehicle.position)} title="Unit 211 · Toledo · Before departure" />
      <Marker alt="3.90 metre clearance incident" icon={incidentIcon} interactive={false} keyboard={false} pane="recovery-markers" position={latLng(model.incident.position)} title="3.90 m clearance incident" />
    </MapContainer>
    <aside aria-label="Incident detail" className="recovery-incident-inset"><strong>Incident detail · Exact 250 m zone</strong><MapContainer attributionControl={false} center={latLng(model.incident.position)} className="recovery-inset-map" doubleClickZoom={false} dragging={false} keyboard={false} scrollWheelZoom={false} touchZoom={false} zoom={14} zoomControl={false}><MapAccessibility label="Exact exclusion zone detail map" /><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><Polygon pathOptions={{ color: "#7c3aed", dashArray: "7 5", fillColor: "#8b5cf6", fillOpacity: 0.25, weight: 3 }} positions={exclusion} /><Polyline pathOptions={{ color: "#d91929", dashArray: "8 6", opacity: 0.9, weight: 3 }} positions={current} /><Marker icon={incidentPointIcon} interactive={false} keyboard={false} position={latLng(model.incident.position)} /></MapContainer></aside>
    <div aria-label="Route comparison legend" className="recovery-map-legend" role="group"><strong>Comparison</strong><ul><li><i className="legend-current" />Current · rejected</li><li><i className="legend-alternative" />Alternative · valid</li><li><i className="legend-exclusion" />Exclusion zone</li><li><i className="legend-incident" />3.90 m incident</li></ul></div>
  </section>;
}
