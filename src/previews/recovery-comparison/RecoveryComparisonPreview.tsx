import { RecoveryComparisonMap } from "./RecoveryComparisonMap";
import { RecoveryComparisonFailure, RecoveryComparisonPanel } from "../../features/recovery-comparison/RecoveryComparisonPanel";
import type { Unit211RecoveryComparisonState } from "../../features/recovery-comparison/unit211RecoveryComparisonModel";

function PreviewTopbar({ context }: { context: string }) {
  return <header className="recovery-preview-topbar">
    <div className="recovery-brand"><img alt="" height="34" src="/favicon.svg" width="34" /><strong>SupplyMesh</strong></div>
    <div className="recovery-preview-state"><span>Visual review</span><b>{context}</b></div>
  </header>;
}

export function RecoveryComparisonPreview({ state }: { state: Unit211RecoveryComparisonState }) {
  if (state.kind === "operation-failure") {
    return <div className="recovery-preview-shell">
      <PreviewTopbar context="Pre-dispatch comparison" />
      <main className="recovery-preview-error-workspace">
        <RecoveryComparisonFailure locale="en" reasonCode={state.reasonCode} />
      </main>
    </div>;
  }

  return <div className="recovery-preview-shell">
    <a className="skip-link" href="#recovery-comparison-map">Skip to route comparison map</a>
    <PreviewTopbar context={`${state.vehicle.displayLabel} · Pre-dispatch`} />
    <main className="recovery-preview-workspace"><RecoveryComparisonMap model={state} /><aside className="recovery-panel"><RecoveryComparisonPanel locale="en" model={state} showPreviewAction /></aside></main>
  </div>;
}
