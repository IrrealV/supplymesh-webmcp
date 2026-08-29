import { ArrowRight, Bed, ClockCounterClockwise, Info, RoadHorizon, Ruler, Snowflake, Truck, Warning, WarningOctagon } from "@phosphor-icons/react";
import type { FleetFilter } from "../../app/state/useUiCoordinationStore";
import { useUiCoordinationStore } from "../../app/state/useUiCoordinationStore";
import type { OperatingRegion } from "../../domain/entities";
import { filterLabel, operationalCopy, type Locale } from "../../preferences/i18n/catalog";
import { filterCount } from "./filtering";

const overviewCategories = ["all", "resting", "needs-attention", "critical"] as const;
const overviewIcons = { all: Truck, resting: Bed, "needs-attention": Warning, critical: WarningOctagon };

export function OperationalOverview({ locale, scenario }: { locale: Locale; scenario: OperatingRegion }) {
  const activeFilters = useUiCoordinationStore((state) => state.activeFilters);
  const copy = operationalCopy(locale);
  const descriptions = locale === "es"
    ? { all: "Activos en la red", resting: "En descanso o pausa", "needs-attention": "Requieren seguimiento", critical: "Accion inmediata" }
    : { all: "Active across the network", resting: "At rest or on break", "needs-attention": "Require monitoring", critical: "Immediate action" };
  const conditions = [
    { icon: Snowflake, kind: "severe-snow", label: copy.severeWeather, tone: "weather" },
    { icon: RoadHorizon, kind: "road-closure", label: copy.roadClosure, tone: "critical" },
    { icon: Ruler, kind: "height-restriction", label: copy.lowClearance, tone: "restriction" },
  ] as const;

  function activate(category: (typeof overviewCategories)[number]): void {
    const store = useUiCoordinationStore.getState();
    if (category === "all") store.clearFilters("overview-all");
    else store.toggleFilter(category satisfies FleetFilter, `overview-${category}`);
  }

  return <>
    <div className="context-panel-header"><div><h1 id="context-panel-heading" tabIndex={-1}>{copy.operationalOverview} <Info aria-hidden="true" size={16} /></h1><p><span>{locale === "es" ? "Actualizado ahora" : "Updated just now"}</span><ClockCounterClockwise aria-hidden="true" size={15} /></p></div></div>
    <div className="overview-grid">
      {overviewCategories.map((category) => {
        const count = filterCount(category, scenario);
        const label = filterLabel(category, locale);
        const isActive = category === "all" ? activeFilters.size === 0 : activeFilters.has(category);
        const Icon = overviewIcons[category];
        return <button aria-label={`${label}, ${count}`} aria-pressed={isActive} className={`overview-card overview-${category}`} id={`overview-${category}`} key={category} onClick={() => activate(category)} type="button"><span className="overview-icon"><Icon aria-hidden="true" size={25} weight="fill" /></span><span className="overview-copy"><span>{label}</span><strong>{count}</strong><small>{descriptions[category]}</small></span><ArrowRight aria-hidden="true" className="overview-arrow" size={18} /></button>;
      })}
    </div>
    <section className="active-conditions"><h2>{locale === "es" ? "Condiciones activas" : "Active conditions"}</h2><div>{conditions.map(({ icon: Icon, kind, label, tone }) => { const count = scenario.risks.filter((risk) => risk.kind === kind).length; return <article className={`condition-row condition-${tone}`} key={kind}><Icon aria-hidden="true" size={22} weight="bold" /><span><strong>{label}</strong><small>{locale === "es" ? "En rutas activas" : "On active routes"}</small></span><b>{count}</b></article>; })}</div></section>
  </>;
}
