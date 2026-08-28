import * as Tooltip from "@radix-ui/react-tooltip";
import { CaretDoubleLeft, CloudSnow, RoadHorizon, Timer, Truck, WarningCircle, WarningOctagon } from "@phosphor-icons/react";
import { FilterCategories, type FilterCategory, useUiCoordinationStore } from "../../app/state/useUiCoordinationStore";
import type { OperatingRegion } from "../../domain/entities";
import { catalog, filterLabel, type Locale } from "../../preferences/i18n/catalog";
import { filterCount } from "./filtering";

const icons = {
  all: Truck, resting: Timer, "needs-attention": WarningCircle, critical: WarningOctagon,
  "weather-affected": CloudSnow, "driving-rest-risk": Timer, "road-restriction-issues": RoadHorizon,
} satisfies Record<FilterCategory, typeof Truck>;

export function FilterRail({ locale, scenario }: { locale: Locale; scenario: OperatingRegion }) {
  const activeFilters = useUiCoordinationStore((state) => state.activeFilters);
  const railState = useUiCoordinationStore((state) => state.railState);
  const clearFilters = useUiCoordinationStore((state) => state.clearFilters);
  const toggleFilter = useUiCoordinationStore((state) => state.toggleFilter);
  const setRailState = useUiCoordinationStore((state) => state.setRailState);
  const copy = catalog(locale);
  const isRailExpanded = railState === "expanded";

  return (
    <Tooltip.Provider delayDuration={0}>
      <aside aria-label={copy.fleetFilters} className={`filter-rail ${isRailExpanded ? "filter-rail-expanded" : ""}`}>
        {isRailExpanded && <button aria-label={copy.collapseRail} className="rail-collapse" onClick={() => setRailState("compact")} type="button"><CaretDoubleLeft aria-hidden="true" size={18} /></button>}
        {FilterCategories.map((category) => {
          const Icon = icons[category];
          const label = filterLabel(category, locale);
          const count = filterCount(category, scenario);
          const isActive = category === "all" ? activeFilters.size === 0 : activeFilters.has(category);
          const activate = (): void => category === "all" ? clearFilters(`filter-${category}`) : toggleFilter(category, `filter-${category}`);
          return (
            <Tooltip.Root key={category}>
              <Tooltip.Trigger asChild>
                <button aria-describedby={`filter-${category}-count`} aria-label={label} aria-pressed={isActive} className={`filter-control ${isActive ? "filter-control-active" : ""}`} id={`filter-${category}`} onClick={activate} type="button">
                  <Icon aria-hidden="true" size={19} weight="bold" />
                  {isRailExpanded && <span>{label}</span>}
                  <b id={`filter-${category}-count`}>{count}</b>
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal><Tooltip.Content className="rail-tooltip" side="right">{label}<Tooltip.Arrow className="rail-tooltip-arrow" /></Tooltip.Content></Tooltip.Portal>
            </Tooltip.Root>
          );
        })}
      </aside>
    </Tooltip.Provider>
  );
}
