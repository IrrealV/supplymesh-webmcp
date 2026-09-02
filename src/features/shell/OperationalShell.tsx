import { ChartPieSlice } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
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
import { RecoveryWorkflowStatuses, type OperationalRecoverySnapshot, type RecoveryAgentCapability, type RecoveryExecutionCapability, type RecoveryHumanCapability, type RecoveryResult } from "../../domain/recovery/recoveryContracts";
import type { RecoveryWorkflowAction } from "../recovery-comparison/RecoveryWorkflowPanel";

type OperationalShellProps = {
  locale: Locale;
  onLocaleChange(locale: Locale): void;
  onScenarioChange(scenario: OperatingRegion): void;
  operations: OperationsApi;
  operational?: Readonly<{ read(): RecoveryResult<OperationalRecoverySnapshot>; subscribe(listener: (snapshot: OperationalRecoverySnapshot) => void): () => void }>;
  recoveryAgent?: RecoveryAgentCapability;
  recoveryExecution?: RecoveryExecutionCapability;
  recoveryHuman?: RecoveryHumanCapability;
  scenario: OperatingRegion;
};
function unit211PreDispatchContextForSnapshot(operations: OperationsApi, scenarioSnapshot: OperatingRegion): Unit211PreDispatchContextResult { void scenarioSnapshot; return operations.unit211PreDispatchContext(); }

export function OperationalShell({ locale, onLocaleChange, onScenarioChange, operational, operations, recoveryExecution, recoveryHuman, scenario }: OperationalShellProps) {
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
  const [comparisonRequest, setComparisonRequest] = useState<Readonly<{ result: Unit211PreDispatchContextResult; vehicle: NonNullable<typeof selectedVehicle> }>>();
  const [recoveryOpen, setRecoveryOpen] = useState(false); const [recoveryState, setRecoveryState] = useState(() => operational?.read()); const [actionFailure, setActionFailure] = useState<Extract<RecoveryResult<never>, { ok: false }>["error"]>(); const [refreshFailure, setRefreshFailure] = useState<Readonly<{ code: string; message: string }>>(); const [pending, setPending] = useState<RecoveryWorkflowAction>(); const actionLock = useRef(false); const previousWorkflowStatus = useRef(recoveryState?.ok ? recoveryState.data.workflowStatus : undefined);
  const comparison = useMemo(() => !recoveryOpen || comparisonRequest === undefined ? undefined : createUnit211RecoveryComparisonModel(comparisonRequest.result, locale), [comparisonRequest, locale, recoveryOpen]);
  const inspectionVehicle = selectedVehicle ?? (recoveryOpen ? comparisonRequest?.vehicle : undefined); const snapshot = recoveryState?.ok ? recoveryState.data : undefined;
  useEffect(() => operational?.subscribe((next) => { const previous = previousWorkflowStatus.current; previousWorkflowStatus.current = next.workflowStatus; setRecoveryState({ ok: true, data: next }); if (!((next.workflowStatus === RecoveryWorkflowStatuses.executed && previous !== next.workflowStatus) || (next.workflowStatus === RecoveryWorkflowStatuses.idle && previous !== undefined && previous !== next.workflowStatus))) return; const current = operations.scenarioCurrent(); if (!current.ok) { setRefreshFailure(current.error); return; } setRefreshFailure(undefined); onScenarioChange(current.data); if (next.workflowStatus === RecoveryWorkflowStatuses.idle) { const vehicle = current.data.vehicles.find(({ internalId }) => internalId === "vehicle-011"); if (vehicle) setComparisonRequest({ result: operations.unit211PreDispatchContext(), vehicle }); } }), [onScenarioChange, operational, operations]);

  function focusMap(event: MouseEvent<HTMLAnchorElement>): void {
    event.preventDefault();
    document.getElementById("operational-map")?.focus();
  }

  function closeInspection(): void {
    setComparisonRequest(undefined); setRecoveryOpen(false);
    const returnFocusId = useUiCoordinationStore.getState().closeSelection();
    requestAnimationFrame(() => (document.getElementById(returnFocusId) ?? document.getElementById("context-panel-heading") ?? document.getElementById("context-panel"))?.focus());
  }
  function reviewRecovery(): void { if (!selectedVehicle) return; const result = operations.unit211PreDispatchContext(); setComparisonRequest({ result, vehicle: selectedVehicle }); setRecoveryOpen(true); if (result.ok) useUiCoordinationStore.getState().focusComparison(result.data.context.unit.vehicleId); }
  function backFromRecovery(): void { if (selectedVehicle === undefined) { closeInspection(); return; } setRecoveryOpen(false); requestAnimationFrame(() => document.getElementById("review-recovery-options")?.focus()); }
  async function runRecoveryAction(action: RecoveryWorkflowAction): Promise<void> {
    if (actionLock.current || snapshot === undefined || operational === undefined) return; actionLock.current = true; setPending(action); setActionFailure(undefined); const planId = snapshot.plan?.planId; let result: RecoveryResult<unknown> | undefined;
    try {
      if (action === "approve" && recoveryHuman && planId) result = recoveryHuman.approvePlan({ planId });
      else if (action === "reject" && recoveryHuman && planId) result = recoveryHuman.rejectPlan({ planId });
      else if (action === "escalate" && recoveryHuman && planId) { result = recoveryHuman.rejectPlan({ planId }); console.log(`Escalated plan ${planId} at ${new Date().toISOString()} with reason: Hold & Escalate`); }
      else if (action === "reset" && recoveryExecution) result = recoveryExecution.reset({});
      if (result && !result.ok) setActionFailure(result.error); setRecoveryState(operational.read());
    } finally { actionLock.current = false; setPending(undefined); }
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
      <Topbar locale={locale} onLocaleChange={onLocaleChange} scenario={scenario} operations={operations} onScenarioChange={onScenarioChange} />
      <main className={`console-workspace ${railState === "expanded" ? "rail-is-expanded" : ""}`}>
        <FilterRail isTablet={isTablet} locale={locale} onInteraction={() => setTabletOverviewOpen(false)} scenario={scenario} operations={operations} onScenarioChange={onScenarioChange} />
        <section aria-describedby={comparison?.kind === "ready" ? "recovery-map-summary" : undefined} aria-label={copy.operationalMap} className="map-workspace" id="operational-map" role="region" tabIndex={-1}>
          <FleetMap availableComparison={availableComparison.kind === "ready" ? availableComparison : undefined} comparison={comparison?.kind === "ready" ? comparison : undefined} locale={locale} recoveryExecuted={snapshot?.executionRecord != null} scenario={scenario} />
        </section>
        {isTablet && inspectionVehicle === undefined && panelContext.mode === "overview" && !tabletOverviewOpen && <button aria-label={panelCopy.openOverview} className="tablet-overview-trigger" onClick={openTabletOverview} type="button"><ChartPieSlice aria-hidden="true" size={19} /><span>{panelCopy.operationalOverview}</span></button>}
        {inspectionVehicle === undefined ? (
          <ContextPanel closeLabel={panelContext.mode === "overview" ? panelCopy.closeOverview : copy.closeResults} label={panelContext.mode === "overview" ? panelCopy.operationalOverview : copy.fleetFilters} mode={panelContext.mode} onClose={panelContext.mode === "overview" ? () => setTabletOverviewOpen(false) : closeResults} tabletOpen={panelContext.mode === "results" || tabletOverviewOpen}>
            {panelContext.mode === "overview" ? <OperationalOverview locale={locale} scenario={scenario} /> : <FilterResults locale={locale} scenario={scenario} />}
          </ContextPanel>
        ) : (
          <VehicleInspection comparison={comparison} isFollowing={follow.kind === "vehicle" && follow.vehicleId === inspectionVehicle.internalId} key={inspectionVehicle.internalId} locale={locale} onBackFromRecovery={backFromRecovery} onClose={closeInspection} onDeleted={() => comparisonRequest ? setRecoveryOpen(true) : closeInspection()} onRestoreFollow={() => useUiCoordinationStore.getState().restoreFollow()} onReviewRecovery={inspectionVehicle.internalId === "vehicle-011" && (availableComparison.kind === "ready" || snapshot?.plan != null) ? reviewRecovery : undefined} onScenarioChange={onScenarioChange} onViewRoute={() => useUiCoordinationStore.getState().focusRoute(inspectionVehicle.internalId)} operations={operations} recovery={comparison === undefined || !operational || !recoveryExecution || !recoveryHuman ? undefined : { actionFailure, onAction: (action) => { void runRecoveryAction(action); }, pending, refreshFailure, snapshot, snapshotFailure: recoveryState && !recoveryState.ok ? recoveryState.error : undefined }} recoveryUnavailableReason={availableComparison.kind === "operation-failure" && inspectionVehicle.internalId === "vehicle-011" ? availableComparison.reasonCode : undefined} scenario={scenario} vehicle={inspectionVehicle} />
        )}
      </main>
    </div>
  );
}
