import { X } from "@phosphor-icons/react";
import { useUiCoordinationStore } from "../../app/state/useUiCoordinationStore";
import type { OperatingRegion } from "../../domain/entities";
import { filterLabel, interpolate, operationalCopy, type Locale } from "../../preferences/i18n/catalog";
import { selectFilterResults } from "./filtering";
import { VehicleResultCard } from "./VehicleResultCard";

export function FilterResults({ locale, scenario }: { locale: Locale; scenario: OperatingRegion }) {
  const activeFilters = useUiCoordinationStore((state) => state.activeFilters);
  const filters = [...activeFilters];
  const copy = operationalCopy(locale);
  const heading = filters.length === 1 ? filterLabel(filters[0], locale) : interpolate(copy.activeFilters, { count: filters.length });
  return <>
    <div className="context-panel-header"><h1 id="context-panel-heading" tabIndex={-1}>{heading}</h1><span>{selectFilterResults(scenario, activeFilters).length}</span></div>
    <div aria-label={heading} className="filter-chips">
      {filters.map((filter) => {
        const label = filterLabel(filter, locale);
        return <button aria-label={interpolate(copy.removeFilter, { filter: label })} key={filter} onClick={() => useUiCoordinationStore.getState().toggleFilter(filter, `filter-${filter}`)} type="button"><span>{label}</span><X aria-hidden="true" size={13} weight="bold" /></button>;
      })}
    </div>
    <div className="filter-results-list">{selectFilterResults(scenario, activeFilters).map((result) => <VehicleResultCard key={result.vehicle.internalId} locale={locale} result={result} />)}</div>
  </>;
}
