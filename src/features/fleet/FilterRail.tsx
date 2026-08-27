import * as Tooltip from "@radix-ui/react-tooltip";
import { CaretDoubleLeft, CloudSnow, RoadHorizon, Timer, Truck, WarningCircle, WarningOctagon } from "@phosphor-icons/react";
import { FilterCategories, type FilterCategory, useUiCoordinationStore } from "../../app/state/useUiCoordinationStore";
import type { OperatingRegion } from "../../domain/entities";
import { catalog, filterLabel } from "../../preferences/i18n/catalog";
import { filterCount } from "./filtering";

const icons = {
  all: Truck, resting: Timer, "needs-attention": WarningCircle, critical: WarningOctagon,
  "weather-affected": CloudSnow, "driving-rest-risk": Timer, "road-restriction-issues": RoadHorizon,
} satisfies Record<FilterCategory, typeof Truck>;

export function FilterRail({ scenario }: { scenario: OperatingRegion }) {
  const activeFilter = useUiCoordinationStore((state) => state.activeFilter);
  const isRailExpanded = useUiCoordinationStore((state) => state.isRailExpanded);
  const toggleFilter = useUiCoordinationStore((state) => state.toggleFilter);
  const collapseRail = useUiCoordinationStore((state) => state.collapseRail);
  const copy = catalog();

  return (
    <Tooltip.Provider delayDuration={0}>
      <aside aria-label="Fleet filters" className={`filter-rail ${isRailExpanded ? "filter-rail-expanded" : ""}`}>
        {isRailExpanded && <button aria-label={copy.collapseRail} className="rail-collapse" onClick={collapseRail} type="button"><CaretDoubleLeft aria-hidden="true" size={18} /></button>}
        {FilterCategories.map((category) => {
          const Icon = icons[category];
          const label = filterLabel(category);
          return (
            <Tooltip.Root key={category}>
              <Tooltip.Trigger asChild>
                <button aria-label={label} aria-pressed={activeFilter === category} className={`filter-control ${activeFilter === category ? "filter-control-active" : ""}`} onClick={() => toggleFilter(category)} type="button">
                  <Icon aria-hidden="true" size={19} weight="bold" />
                  {isRailExpanded && <span>{label}</span>}
                  <b>{filterCount(category, scenario)}</b>
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
