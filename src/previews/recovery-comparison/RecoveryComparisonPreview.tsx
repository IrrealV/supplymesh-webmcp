import { RecoveryComparisonMap } from "./RecoveryComparisonMap";
import { RecoveryComparisonPanel } from "./RecoveryComparisonPanel";
import type { Unit211RecoveryPreviewState } from "./unit211RecoveryPreviewModel";

function PreviewTopbar({ context }: { context: string }) {
  return <header className="recovery-preview-topbar">
    <div className="recovery-brand"><img alt="" height="34" src="/favicon.svg" width="34" /><strong>SupplyMesh</strong></div>
    <div className="recovery-preview-state"><span>Visual review</span><b>{context}</b></div>
  </header>;
}

export function RecoveryComparisonPreview({ state }: { state: Unit211RecoveryPreviewState }) {
  if (state.kind === "operation-failure") {
    return <div className="recovery-preview-shell">
      <PreviewTopbar context="Pre-dispatch comparison" />
      <main className="recovery-preview-error-workspace">
        <section aria-labelledby="recovery-preview-error-heading" className="recovery-preview-error" role="alert">
          <span>Read-only domain result</span>
          <h1 id="recovery-preview-error-heading">Recovery comparison unavailable</h1>
          <p>The pre-dispatch operation returned a structured failure, so route options cannot be shown safely.</p>
          <dl><dt>Reason code</dt><dd><code>{state.reasonCode}</code></dd></dl>
          <p className="recovery-preview-error-assurance">No route was changed.</p>
        </section>
      </main>
    </div>;
  }

  return <div className="recovery-preview-shell">
    <a className="skip-link" href="#recovery-comparison-map">Skip to route comparison map</a>
    <PreviewTopbar context={`${state.vehicle.displayLabel} · Pre-dispatch`} />
    <main className="recovery-preview-workspace"><RecoveryComparisonMap model={state} /><RecoveryComparisonPanel model={state} /></main>
  </div>;
}
