import * as Tooltip from "@radix-ui/react-tooltip";
import { Bed, CaretDoubleLeft, CaretDoubleRight, RoadHorizon, Snowflake, SteeringWheel, Truck, Warning, WarningOctagon } from "@phosphor-icons/react";
import { FilterCategories, type FilterCategory, useUiCoordinationStore } from "../../app/state/useUiCoordinationStore";
import type { OperatingRegion } from "../../domain/entities";
import type { OperationsApi } from "../../domain/operations/createOperationsApi";
import { catalog, filterLabel, type Locale } from "../../preferences/i18n/catalog";
import { filterCount } from "./filtering";
import { CreateVehicleDialog } from "./CreateVehicleDialog";

const icons = {
  all: Truck, resting: Bed, "needs-attention": Warning, critical: WarningOctagon,
  "weather-affected": Snowflake, "driving-rest-risk": SteeringWheel, "road-restriction-issues": RoadHorizon,
} satisfies Record<FilterCategory, typeof Truck>;

export function FilterRail({ isTablet = false, locale, onInteraction, scenario, operations, onScenarioChange }: { isTablet?: boolean; locale: Locale; onInteraction?(): void; scenario: OperatingRegion; operations?: OperationsApi; onScenarioChange?: (scenario: OperatingRegion) => void }) {
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
        {isRailExpanded
          ? <div className="rail-heading">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <h2>{copy.fleetFilters}</h2>
                {operations && onScenarioChange && <CreateVehicleDialog locale={locale} operations={operations} scenario={scenario} onScenarioChange={onScenarioChange} />}
              </div>
              <button aria-label={copy.collapseRail} className="rail-collapse" onClick={() => setRailState("compact")} type="button"><CaretDoubleLeft aria-hidden="true" size={22} /></button>
            </div>
          : <button aria-label={copy.expandRail} className="rail-brand-control" onClick={() => { onInteraction?.(); setRailState("expanded"); }} type="button"><CaretDoubleRight aria-hidden="true" size={24} weight="bold" /></button>}
        {FilterCategories.map((category) => {
          const Icon = icons[category];
          const label = filterLabel(category, locale);
          const count = filterCount(category, scenario);
          const isActive = category === "all" ? activeFilters.size === 0 : activeFilters.has(category);
          const activate = (): void => {
            onInteraction?.();
            if (category === "all") clearFilters("filter-" + category);
            else toggleFilter(category, "filter-" + category);
            if (isTablet) setRailState("compact");
          };
          return (
            <Tooltip.Root key={category}>
              <Tooltip.Trigger asChild>
                <button aria-describedby={`filter-${category}-count`} aria-label={label} aria-pressed={isActive} className={`filter-control ${isActive ? "filter-control-active" : ""}`} id={`filter-${category}`} onClick={activate} type="button">
                  <Icon aria-hidden="true" size={26} weight={isActive ? "fill" : "regular"} />
                  {isRailExpanded && <span>{label}</span>}
                  <b id={`filter-${category}-count`}>{count}</b>
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal><Tooltip.Content className="rail-tooltip" side="right">{label}<Tooltip.Arrow className="rail-tooltip-arrow" /></Tooltip.Content></Tooltip.Portal>
            </Tooltip.Root>
          );
        })}
        {isRailExpanded && (
          <div style={{ padding: '1rem', borderTop: '1px solid var(--theme-base-border)', marginTop: '1rem', textAlign: 'center' }}>
            {useUiCoordinationStore.getState().avoidanceArea ? (
              <button onClick={() => useUiCoordinationStore.getState().setAvoidanceArea(null)} style={{ background: 'var(--theme-danger-bg)', color: '#fff', border: 'none', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer' }}>Remove Avoid Area</button>
            ) : (
              <button onClick={() => useUiCoordinationStore.getState().setAvoidanceArea({ radiusMeters: 5000, coordinates: [scenario.routes[0]?.geometry.geometry.coordinates[1][0] || 0, scenario.routes[0]?.geometry.geometry.coordinates[1][1] || 0] })} style={{ background: 'var(--theme-primary-bg)', color: '#fff', border: 'none', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer' }}>Set Avoid Area</button>
            )}
          </div>
        )}
      </aside>
    </Tooltip.Provider>
  );
}
