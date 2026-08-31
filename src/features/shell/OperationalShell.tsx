import { ChartPieSlice } from "@phosphor-icons/react";
import { useMemo, useState, type MouseEvent } from "react";
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
import type { Unit211PreDispatchContextResult } from "../../domain/operations/unit211PreDispatchContext";
import { createUnit211RecoveryComparisonModel } from "../recovery-comparison/unit211RecoveryComparisonModel";

type OperationalShellProps = {
  locale: Locale;
  onLocaleChange(locale: Locale): void;
  onScenarioChange(scenario: OperatingRegion): void;
  operations: OperationsApi;
  scenario: OperatingRegion;
};
function unit211PreDispatchContextForSnapshot(operations: OperationsApi, scenarioSnapshot: OperatingRegion): Unit211PreDispatchContextResult { void scenarioSnapshot; return operations.unit211PreDispatchContext(); }

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
  const availableResult = useMemo(() => unit211PreDispatchContextForSnapshot(operations, scenario), [operations, scenario]);
  const availableComparison = useMemo(() => createUnit211RecoveryComparisonModel(availableResult, locale), [availableResult, locale]);
  const [comparisonRequest, setComparisonRequest] = useState<Readonly<{ result: Unit211PreDispatchContextResult; vehicleId: string }>>();
  const comparison = useMemo(() => comparisonRequest === undefined || comparisonRequest.vehicleId !== selectedVehicle?.internalId ? undefined : createUnit211RecoveryComparisonModel(comparisonRequest.result, locale), [comparisonRequest, locale, selectedVehicle?.internalId]);

  function focusMap(event: MouseEvent<HTMLAnchorElement>): void {
    event.preventDefault();
    document.getElementById("operational-map")?.focus();
  }

  function closeInspection(): void {
    setComparisonRequest(undefined);
    const returnFocusId = useUiCoordinationStore.getState().closeSelection();
    requestAnimationFrame(() => (document.getElementById(returnFocusId) ?? document.getElementById("context-panel-heading") ?? document.getElementById("context-panel"))?.focus());
  }
  function reviewRecovery(): void { if (!selectedVehicle) return; const result = operations.unit211PreDispatchContext(); setComparisonRequest({ result, vehicleId: selectedVehicle.internalId }); if (result.ok) useUiCoordinationStore.getState().focusComparison(result.data.context.unit.vehicleId); }
  function backFromRecovery(): void { setComparisonRequest(undefined); requestAnimationFrame(() => document.getElementById("review-recovery-options")?.focus()); }

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
        <section aria-describedby={comparison?.kind === "ready" ? "recovery-map-summary" : undefined} aria-label={copy.operationalMap} className="map-workspace" id="operational-map" role="region" tabIndex={-1}>
          <FleetMap availableComparison={availableComparison.kind === "ready" ? availableComparison : undefined} comparison={comparison?.kind === "ready" ? comparison : undefined} locale={locale} scenario={scenario} />
        </section>
        {isTablet && selectedVehicle === undefined && panelContext.mode === "overview" && !tabletOverviewOpen && <button aria-label={panelCopy.openOverview} className="tablet-overview-trigger" onClick={openTabletOverview} type="button"><ChartPieSlice aria-hidden="true" size={19} /><span>{panelCopy.operationalOverview}</span></button>}
        {selectedVehicle === undefined ? (
          <ContextPanel closeLabel={panelContext.mode === "overview" ? panelCopy.closeOverview : copy.closeResults} label={panelContext.mode === "overview" ? panelCopy.operationalOverview : copy.fleetFilters} mode={panelContext.mode} onClose={panelContext.mode === "overview" ? () => setTabletOverviewOpen(false) : closeResults} tabletOpen={panelContext.mode === "results" || tabletOverviewOpen}>
            {panelContext.mode === "overview" ? <OperationalOverview locale={locale} scenario={scenario} /> : <FilterResults locale={locale} scenario={scenario} />}
          </ContextPanel>
        ) : (
          <VehicleInspection comparison={comparison} isFollowing={follow.kind === "vehicle" && follow.vehicleId === selectedVehicle.internalId} key={selectedVehicle.internalId} locale={locale} onBackFromRecovery={backFromRecovery} onClose={closeInspection} onRestoreFollow={() => useUiCoordinationStore.getState().restoreFollow()} onReviewRecovery={availableComparison.kind === "ready" && availableComparison.vehicle.id === selectedVehicle.internalId ? reviewRecovery : undefined} onScenarioChange={onScenarioChange} onViewRoute={() => useUiCoordinationStore.getState().focusRoute(selectedVehicle.internalId)} operations={operations} recoveryUnavailableReason={availableComparison.kind === "operation-failure" && selectedVehicle.internalId === "vehicle-011" ? availableComparison.reasonCode : undefined} scenario={scenario} vehicle={selectedVehicle} />
        )}
      </main>
    </div>
  );
}
