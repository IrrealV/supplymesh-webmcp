import { divIcon, type LatLngTuple } from "leaflet";
import { Fragment } from "react";
import { Marker, Pane, useMap } from "react-leaflet";
import type { RestOpportunityComparison, RestOpportunityOption } from "../../../domain/operations/restOpportunities";
import type { Locale } from "../../../preferences/i18n/catalog";
import "./restOpportunityLayers.css";

function position(option: RestOpportunityOption): LatLngTuple {
  const [longitude, latitude] = option.stopPosition.geometry.coordinates;
  return [latitude, longitude];
}

function icon(option: RestOpportunityOption, scheduled: boolean) {
  const state = scheduled ? "scheduled" : option.recommended ? "recommended" : option.feasible ? "feasible" : "rejected";
  return divIcon({
    className: `rest-opportunity-marker rest-opportunity-${state}`,
    html: `<span aria-hidden="true">${scheduled ? "✓" : "☕"}</span><b>${option.extraRestMinutes}</b>`,
    iconAnchor: [18, 18],
    iconSize: [36, 36],
  });
}

export function RestOpportunityLayers({ comparison, locale }: { comparison: RestOpportunityComparison; locale: Locale }) {
  const map = useMap();
  const scheduledId = comparison.scheduledRest?.opportunityId;
  return (
    <Fragment>
      <Pane name="rest-opportunities" style={{ zIndex: 625 }} />
      {comparison.options.map((option) => {
        const scheduled = scheduledId === option.id;
        const status = scheduled
          ? locale === "es" ? "programado" : "scheduled"
          : option.feasible
            ? locale === "es" ? "viable" : "feasible"
            : locale === "es" ? "descartado" : "rejected";
        const title = `${option.stopName}: ${option.extraRestMinutes} min ${locale === "es" ? "de descanso adicional" : "extra rest"} · ${status}`;
        return (
          <Marker
            alt={title}
            eventHandlers={{ click: () => map.flyTo(position(option), Math.max(map.getZoom(), 12), { animate: true, duration: 0.35 }) }}
            icon={icon(option, scheduled)}
            key={option.id}
            pane="rest-opportunities"
            position={position(option)}
            title={title}
            zIndexOffset={scheduled ? 50 : option.recommended ? 30 : 0}
          />
        );
      })}
    </Fragment>
  );
}
