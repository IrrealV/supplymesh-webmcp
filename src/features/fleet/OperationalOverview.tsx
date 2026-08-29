import type { FleetFilter } from "../../app/state/useUiCoordinationStore";
import { useUiCoordinationStore } from "../../app/state/useUiCoordinationStore";
import type { OperatingRegion } from "../../domain/entities";
import { filterLabel, operationalCopy, type Locale } from "../../preferences/i18n/catalog";
import { filterCount } from "./filtering";

const overviewCategories = ["all", "resting", "needs-attention", "critical"] as const;

export function OperationalOverview({ locale, scenario }: { locale: Locale; scenario: OperatingRegion }) {
  const activeFilters = useUiCoordinationStore((state) => state.activeFilters);
  const copy = operationalCopy(locale);
  function activate(category: (typeof overviewCategories)[number]): void {
    const store = useUiCoordinationStore.getState();
    if (category === "all") store.clearFilters("overview-all");
    else store.toggleFilter(category satisfies FleetFilter, `overview-${category}`);
  }
  return <>
    <div className="context-panel-header"><h1 id="context-panel-heading" tabIndex={-1}>{copy.operationalOverview}</h1></div>
    <div className="overview-grid">
      {overviewCategories.map((category) => {
        const count = filterCount(category, scenario);
        const label = filterLabel(category, locale);
        const isActive = category === "all" ? activeFilters.size === 0 : activeFilters.has(category);
        return <button aria-label={`${label}, ${count}`} aria-pressed={isActive} className={`overview-card overview-${category}`} id={`overview-${category}`} key={category} onClick={() => activate(category)} type="button"><span>{label}</span><strong>{count}</strong></button>;
      })}
    </div>
  </>;
}
