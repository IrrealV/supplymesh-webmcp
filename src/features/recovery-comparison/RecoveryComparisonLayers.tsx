import { divIcon, type LatLngTuple } from "leaflet";
import { Fragment } from "react";
import { Marker, Pane, Polygon, Polyline } from "react-leaflet";
import { interpolate, recoveryComparisonCopy, type Locale } from "../../preferences/i18n/catalog";
import type { RecoveryCoordinate, Unit211RecoveryComparisonModel } from "./unit211RecoveryComparisonModel";

const latLng = ([longitude, latitude]: RecoveryCoordinate): LatLngTuple => [latitude, longitude];
function markerIcon(className: string, label: string, text: string) { return divIcon({ className, html: `<span aria-label="${label}" role="img">${text}</span>`, iconAnchor: [25, 18], iconSize: [52, 36] }); }

export function RecoveryComparisonLayers({ comparison, executed = false, locale, model, onIncidentSelect, showUnit = false }: { comparison: boolean; executed?: boolean; locale: Locale; model: Unit211RecoveryComparisonModel; onIncidentSelect?(vehicleId: string): void; showUnit?: boolean }) {
  const copy = recoveryComparisonCopy(locale); const restriction = model.incident.restrictionMeters.toFixed(2); const incidentLabel = interpolate(copy.selectIncident, { restriction }); const unitLabel = `${model.vehicle.displayLabel} · ${model.vehicle.location} · ${model.vehicle.state}`;
  return <Fragment><Pane name="recovery-exclusion" style={{ zIndex: 420 }} /><Pane name="recovery-routes" style={{ zIndex: 430 }} /><Pane name="recovery-markers" style={{ zIndex: 630 }} />
    {comparison && <><Polygon pane="recovery-exclusion" pathOptions={{ className: executed ? "recovery-exclusion recovery-exclusion-resolved" : "recovery-exclusion", color: executed ? "#079455" : "#7c3aed", dashArray: "7 5", fillColor: executed ? "#079455" : "#8b5cf6", fillOpacity: executed ? .08 : .2, weight: 2.5 }} positions={model.incident.exclusionCoordinates.map(latLng)} />{!executed && <Polyline pane="recovery-routes" pathOptions={{ className: "recovery-current-route", color: "#d91929", dashArray: "10 8", opacity: .88, weight: 4 }} positions={model.current.coordinates.map(latLng)} />}<Polyline pane="recovery-routes" pathOptions={{ className: executed ? "recovery-applied-route" : "recovery-alternative-route", color: "#079455", opacity: .95, weight: executed ? 5.5 : 4.5 }} positions={model.alternative.coordinates.map(latLng)} /></>}
    {showUnit && <Marker alt={unitLabel} icon={markerIcon("recovery-unit-marker", unitLabel, model.vehicle.fleetNumber.replace(/^FM-/, ""))} interactive={false} keyboard={false} pane="recovery-markers" position={latLng(model.vehicle.position)} title={unitLabel} />}
    <Marker alt={incidentLabel} eventHandlers={onIncidentSelect ? { click: () => onIncidentSelect(model.vehicle.id), keypress: (event) => { if ((event.originalEvent as KeyboardEvent).key === "Enter") onIncidentSelect(model.vehicle.id); } } : undefined} icon={markerIcon("recovery-incident-marker", incidentLabel, `${restriction} m`)} interactive={onIncidentSelect !== undefined} keyboard={onIncidentSelect !== undefined} pane="recovery-markers" position={latLng(model.incident.position)} title={incidentLabel} />
  </Fragment>;
}

export function RecoveryIncidentInset({ locale, model }: { locale: Locale; model: Unit211RecoveryComparisonModel }) {
  const copy = recoveryComparisonCopy(locale); const points = model.incident.exclusionCoordinates; const xs = points.map(([x]) => x); const ys = points.map(([, y]) => y); const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys); const project = ([x, y]: RecoveryCoordinate) => `${10 + 180 * (x - minX) / (maxX - minX)},${10 + 116 * (maxY - y) / (maxY - minY)}`;
  return <aside aria-label={copy.incidentDetail} className="recovery-incident-inset"><strong>{copy.incidentDetail} · {interpolate(copy.exactZone, { radius: model.incident.exclusionRadiusMeters.toFixed(0) })}</strong><svg aria-label={interpolate(copy.exactZone, { radius: model.incident.exclusionRadiusMeters.toFixed(0) })} className="recovery-inset-map" role="img" viewBox="0 0 200 136"><polygon className="recovery-inset-polygon" points={points.map(project).join(" ")} /><circle className="recovery-inset-point" cx={project(model.incident.position).split(",")[0]} cy={project(model.incident.position).split(",")[1]} r="5" /></svg></aside>;
}
