import { catalog, operationalCopy, type Locale } from "../../preferences/i18n/catalog";

export function MapLegend({ locale }: { locale: Locale }) {
  const copy = catalog(locale);
  const operations = operationalCopy(locale);
  const label = locale === "es" ? "Leyenda del mapa" : "Map legend";
  const entries = [
    ["route", copy.route],
    ["restriction", copy.roadRestrictionIssues],
    ["closure", operations.roadClosure],
    ["weather", copy.weatherAffected],
    ["rest", copy.drivingRestRisk],
  ] as const;
  return <section aria-label={label} className="map-legend" role="group"><ul>{entries.map(([kind, text]) => <li key={kind}><span aria-hidden="true" className={`legend-swatch legend-${kind}`} />{text}</li>)}</ul></section>;
}
