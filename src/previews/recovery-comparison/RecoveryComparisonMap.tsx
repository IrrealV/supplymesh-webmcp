import { latLngBounds } from "leaflet";
import { useEffect } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { RecoveryComparisonLayers, RecoveryIncidentInset } from "../../features/recovery-comparison/RecoveryComparisonLayers";
import type { RecoveryCoordinate, Unit211RecoveryComparisonModel } from "../../features/recovery-comparison/unit211RecoveryComparisonModel";

const latLng = ([longitude, latitude]: RecoveryCoordinate): [number, number] => [latitude, longitude];
function MapAccessibility() { const map = useMap(); useEffect(() => { const node = map.getContainer(); node.setAttribute("aria-label", "Interactive recovery route map"); node.setAttribute("aria-describedby", "recovery-map-summary"); node.setAttribute("role", "region"); return () => { node.removeAttribute("aria-label"); node.removeAttribute("aria-describedby"); node.removeAttribute("role"); }; }, [map]); return null; }

export function RecoveryComparisonMap({ model }: { model: Unit211RecoveryComparisonModel }) {
  const bounds = latLngBounds([...model.current.coordinates, ...model.alternative.coordinates, ...model.incident.exclusionCoordinates].map(latLng));
  return <section aria-describedby="recovery-map-summary" aria-label="Recovery route comparison overview" className="recovery-map-shell" id="recovery-comparison-map" tabIndex={-1}><p className="visually-hidden" id="recovery-map-summary">{model.vehicle.displayLabel}. The {model.current.statusLabel} current route, {model.alternative.statusLabel} alternative route, exclusion zone, and clearance incident are shown together.</p><MapContainer bounds={bounds} boundsOptions={{ padding: [34, 34] }} className="recovery-map" maxZoom={13} minZoom={7} zoomControl><MapAccessibility /><TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><RecoveryComparisonLayers comparison locale="en" model={model} showUnit /></MapContainer><RecoveryIncidentInset locale="en" model={model} /><div aria-label="Route comparison legend" className="recovery-map-legend" role="group"><strong>Comparison</strong><ul><li><i className="legend-current" />Current · {model.current.statusLabel}</li><li><i className="legend-alternative" />Alternative · {model.alternative.statusLabel}</li><li><i className="legend-exclusion" />Exclusion zone</li><li><i className="legend-incident" />{model.incident.restrictionMeters.toFixed(2)} m incident</li></ul></div></section>;
}
