import { divIcon, latLngBounds, type LatLngTuple } from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, Pane, Polygon, Polyline, TileLayer, useMap } from "react-leaflet";
import type { PreviewCoordinate, Unit211RecoveryPreviewModel } from "./unit211RecoveryPreviewModel";

function latLng([longitude, latitude]: PreviewCoordinate): LatLngTuple { return [latitude, longitude]; }
function MapAccessibility({ descriptionId, label }: { descriptionId?: string; label: string }) { const map = useMap(); useEffect(() => { const container = map.getContainer(); container.setAttribute("aria-label", label); container.setAttribute("role", "region"); if (descriptionId) container.setAttribute("aria-describedby", descriptionId); return () => { container.removeAttribute("aria-describedby"); container.removeAttribute("aria-label"); container.removeAttribute("role"); }; }, [descriptionId, label, map]); return null; }
function markerContent(label: string, text: string): HTMLElement { const span = document.createElement("span"); span.setAttribute("aria-label", label); span.setAttribute("role", "img"); span.textContent = text; return span; }

export function RecoveryComparisonMap({ model }: { model: Unit211RecoveryPreviewModel }) {
  const current = model.current.coordinates.map(latLng); const alternative = model.alternative.coordinates.map(latLng); const exclusion = model.incident.exclusionCoordinates.map(latLng);
  const bounds = latLngBounds([...current, ...alternative, ...exclusion]);
  const unitLabel = `${model.vehicle.displayLabel} at ${model.vehicle.location}, ${model.vehicle.state}`; const incidentLabel = `${model.incident.restrictionMeters.toFixed(2)} metre clearance incident`;
  const unitIcon = divIcon({ className: "recovery-unit-marker", html: markerContent(unitLabel, model.vehicle.fleetNumber.replace(/^FM-/, "")), iconAnchor: [18, 18], iconSize: [36, 36] });
  const incidentIcon = divIcon({ className: "recovery-incident-marker", html: markerContent(incidentLabel, `${model.incident.restrictionMeters.toFixed(2)} m`), iconAnchor: [25, 18], iconSize: [50, 36] });
  const incidentPointIcon = divIcon({ className: "recovery-inset-marker", html: markerContent(`${incidentLabel} location`, ""), iconAnchor: [7, 7], iconSize: [14, 14] });
  return <section aria-describedby="recovery-map-summary" aria-label="Recovery route comparison overview" className="recovery-map-shell" id="recovery-comparison-map" tabIndex={-1}><p className="visually-hidden" id="recovery-map-summary">{unitLabel}. The {model.current.statusLabel} current route, {model.alternative.statusLabel} alternative route, exclusion zone, and clearance incident are shown together.</p>
    <MapContainer bounds={bounds} boundsOptions={{ padding: [34, 34] }} className="recovery-map" maxZoom={13} minZoom={7} zoomControl>
      <MapAccessibility descriptionId="recovery-map-summary" label="Interactive recovery route map" />
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Pane name="recovery-exclusion" style={{ zIndex: 420 }} /><Pane name="recovery-routes" style={{ zIndex: 430 }} /><Pane name="recovery-markers" style={{ zIndex: 620 }} />
      <Polygon pane="recovery-exclusion" pathOptions={{ className: "recovery-exclusion", color: "#7c3aed", dashArray: "7 5", fillColor: "#8b5cf6", fillOpacity: 0.2, weight: 2.5 }} positions={exclusion} />
      <Polyline pane="recovery-routes" pathOptions={{ className: "recovery-current-route", color: "#d91929", dashArray: "10 8", opacity: 0.88, weight: 4 }} positions={current} />
      <Polyline pane="recovery-routes" pathOptions={{ className: "recovery-alternative-route", color: "#079455", opacity: 0.95, weight: 4.5 }} positions={alternative} />
      <Marker alt={unitLabel} icon={unitIcon} interactive={false} keyboard={false} pane="recovery-markers" position={latLng(model.vehicle.position)} title={`${model.vehicle.displayLabel} · ${model.vehicle.location} · ${model.vehicle.state}`} />
      <Marker alt={incidentLabel} icon={incidentIcon} interactive={false} keyboard={false} pane="recovery-markers" position={latLng(model.incident.position)} title={incidentLabel} />
    </MapContainer>
    <aside aria-label="Incident detail" className="recovery-incident-inset"><strong>Incident detail · Exact {model.incident.exclusionRadiusMeters.toFixed(0)} m zone</strong><MapContainer attributionControl={false} center={latLng(model.incident.position)} className="recovery-inset-map" doubleClickZoom={false} dragging={false} keyboard={false} scrollWheelZoom={false} touchZoom={false} zoom={14} zoomControl={false}><MapAccessibility label="Exact exclusion zone detail map" /><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><Polygon pathOptions={{ color: "#7c3aed", dashArray: "7 5", fillColor: "#8b5cf6", fillOpacity: 0.25, weight: 3 }} positions={exclusion} /><Polyline pathOptions={{ color: "#d91929", dashArray: "8 6", opacity: 0.9, weight: 3 }} positions={current} /><Marker alt={`${incidentLabel} location`} icon={incidentPointIcon} interactive={false} keyboard={false} position={latLng(model.incident.position)} /></MapContainer></aside>
    <div aria-label="Route comparison legend" className="recovery-map-legend" role="group"><strong>Comparison</strong><ul><li><i className="legend-current" />Current · {model.current.statusLabel}</li><li><i className="legend-alternative" />Alternative · {model.alternative.statusLabel}</li><li><i className="legend-exclusion" />Exclusion zone</li><li><i className="legend-incident" />{model.incident.restrictionMeters.toFixed(2)} m incident</li></ul></div>
  </section>;
}
