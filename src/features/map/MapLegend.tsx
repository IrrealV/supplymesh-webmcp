import { CaretDown, CaretUp, ListBullets } from "@phosphor-icons/react";
import { useState } from "react";
import { catalog, operationalCopy, type Locale } from "../../preferences/i18n/catalog";
import { useTabletViewport } from "../../app/presentation/useTabletViewport";

export function MapLegend({ locale }: { locale: Locale }) {
  const copy = catalog(locale);
  const operations = operationalCopy(locale);
  const label = locale === "es" ? "Leyenda del mapa" : "Map legend";
  const isTablet = useTabletViewport();
  const [isExpanded, setIsExpanded] = useState(false);
  const showsEntries = !isTablet || isExpanded;
  const entries = [
    ["route", copy.route],
    ["restriction", copy.roadRestrictionIssues],
    ["closure", operations.roadClosure],
    ["weather", copy.weatherAffected],
    ["rest", copy.drivingRestRisk],
  ] as const;

  return (
    <section aria-label={label} className={"map-legend " + (showsEntries ? "legend-is-expanded" : "legend-is-collapsed")} role="group">
      {isTablet && <button aria-expanded={isExpanded} aria-label={label} className="legend-toggle" onClick={() => setIsExpanded((current) => !current)} type="button"><ListBullets aria-hidden="true" size={18} /><span>{label}</span>{isExpanded ? <CaretDown aria-hidden="true" size={14} /> : <CaretUp aria-hidden="true" size={14} />}</button>}
      <ul aria-hidden={!showsEntries}>{entries.map(([kind, text]) => <li key={kind}><span aria-hidden="true" className={"legend-swatch legend-" + kind} />{text}</li>)}</ul>
    </section>
  );
}
