import { RecoveryComparisonMap } from "./RecoveryComparisonMap";
import { RecoveryComparisonPanel } from "./RecoveryComparisonPanel";
import type { Unit211RecoveryPreviewModel } from "./unit211RecoveryPreviewModel";

export function RecoveryComparisonPreview({ model }: { model: Unit211RecoveryPreviewModel }) {
  return <div className="recovery-preview-shell"><a className="skip-link" href="#recovery-comparison-map">Skip to route comparison map</a><header className="recovery-preview-topbar"><div className="recovery-brand"><img alt="" height="34" src="/favicon.svg" width="34" /><strong>SupplyMesh</strong></div><div className="recovery-preview-state"><span>Visual review</span><b>Unit 211 · Pre-dispatch</b></div></header><main className="recovery-preview-workspace"><RecoveryComparisonMap model={model} /><RecoveryComparisonPanel model={model} /></main></div>;
}
