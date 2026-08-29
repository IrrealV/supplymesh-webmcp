import { ChartPieSlice } from "@phosphor-icons/react";
import { useState, type MouseEvent } from "react";
import { useUiCoordinationStore } from "../../app/state/useUiCoordinationStore";
import type { OperatingRegion } from "../../domain/entities";
import type { OperationsApi } from "../../domain/operations/createOperationsApi";
import { catalog, operationalCopy, type Locale } from "../../preferences/i18n/catalog";
import { FilterRail } from "../fleet/FilterRail";
import { FilterResults } from "../fleet/FilterResults";
import { OperationalOverview } from "../fleet/OperationalOverview";
import { VehicleInspection } from "../fleet/VehicleInspection";
import { FleetMap } from "../map/FleetMap";
import { ContextPanel } from "./ContextPanel";
import { Topbar } from "./Topbar";
import { useTabletViewport } from "../../app/presentation/useTabletViewport";

type OperationalShellProps = {
  locale: Locale;
  onLocaleChange(locale: Locale): void;
  onScenarioChange(scenario: OperatingRegion): void;
  operations: OperationsApi;
  scenario: OperatingRegion;
};

export function OperationalShell({ locale, onLocaleChange, onScenarioChange, operations, scenario }: OperationalShellProps) {
  const follow = useUiCoordinationStore((state) => state.follow);
  const panelContext = useUiCoordinationStore((state) => state.panelContext);
  const railState = useUiCoordinationStore((state) => state.railState);
  const selection = useUiCoordinationStore((state) => state.selection);
  const selectedVehicle = selection.kind === "vehicle" ? scenario.vehicles.find((vehicle) => vehicle.internalId === selection.vehicleId) : undefined;
  const copy = catalog(locale);
  const panelCopy = operationalCopy(locale);
  const isTablet = useTabletViewport();
  const [tabletOverviewOpen, setTabletOverviewOpen] = useState(false);


  function focusMap(event: MouseEvent<HTMLAnchorElement>): void {
    event.preventDefault();
    document.getElementById("operational-map")?.focus();
  }

  function closeInspection(): void {
    const returnFocusId = useUiCoordinationStore.getState().closeSelection();
    requestAnimationFrame(() => (document.getElementById(returnFocusId) ?? document.getElementById("context-panel-heading") ?? document.getElementById("context-panel"))?.focus());
  }

  function closeResults(): void {
    const activeFilter = useUiCoordinationStore.getState().activeFilters.values().next().value;
    const returnFocusId = activeFilter === undefined ? panelContext.returnFocusId : "filter-" + activeFilter;
    useUiCoordinationStore.getState().clearFilters(returnFocusId);
    requestAnimationFrame(() => (document.getElementById(returnFocusId) ?? document.getElementById("context-panel"))?.focus());
  }

  function openTabletOverview(): void {
    useUiCoordinationStore.getState().setRailState("compact");
    setTabletOverviewOpen(true);
  }

  return (
    <div className="console-shell">
      <a className="skip-link" href="#operational-map" onClick={focusMap}>{copy.operationalMap}</a>
      <Topbar locale={locale} onLocaleChange={onLocaleChange} />
      <main className={`console-workspace ${railState === "expanded" ? "rail-is-expanded" : ""}`}>
        <FilterRail isTablet={isTablet} locale={locale} onInteraction={() => setTabletOverviewOpen(false)} scenario={scenario} />
        <section aria-label={copy.operationalMap} className="map-workspace" id="operational-map" role="region" tabIndex={-1}>
          <FleetMap locale={locale} scenario={scenario} />
        </section>
        {isTablet && selectedVehicle === undefined && panelContext.mode === "overview" && !tabletOverviewOpen && <button aria-label={panelCopy.openOverview} className="tablet-overview-trigger" onClick={openTabletOverview} type="button"><ChartPieSlice aria-hidden="true" size={19} /><span>{panelCopy.operationalOverview}</span></button>}
        {selectedVehicle === undefined ? (
          <ContextPanel closeLabel={panelContext.mode === "overview" ? panelCopy.closeOverview : copy.closeResults} label={panelContext.mode === "overview" ? panelCopy.operationalOverview : copy.fleetFilters} mode={panelContext.mode} onClose={panelContext.mode === "overview" ? () => setTabletOverviewOpen(false) : closeResults} tabletOpen={panelContext.mode === "results" || tabletOverviewOpen}>
            {panelContext.mode === "overview" ? <OperationalOverview locale={locale} scenario={scenario} /> : <FilterResults locale={locale} scenario={scenario} />}
          </ContextPanel>
        ) : (
          <VehicleInspection isFollowing={follow.kind === "vehicle" && follow.vehicleId === selectedVehicle.internalId} key={selectedVehicle.internalId} locale={locale} onClose={closeInspection} onRestoreFollow={() => useUiCoordinationStore.getState().restoreFollow()} onScenarioChange={onScenarioChange} onViewRoute={() => useUiCoordinationStore.getState().focusRoute(selectedVehicle.internalId)} operations={operations} scenario={scenario} vehicle={selectedVehicle} />
        )}
      </main>
    </div>
  );
}
