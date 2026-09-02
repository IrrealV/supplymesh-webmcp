import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, Truck, WarningCircle, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { isVehicleLabelValid, type OperatingRegion, type OperationalRisk, type Vehicle } from "../../domain/entities";
import type { OperationsApi } from "../../domain/operations/createOperationsApi";
import type { Unit211PreDispatchContextFailureReason } from "../../domain/operations/unit211PreDispatchContext";
import { catalog, interpolate, operationalCopy, recoveryComparisonCopy, type Catalog, type Locale } from "../../preferences/i18n/catalog";
import { useTabletViewport } from "../../app/presentation/useTabletViewport";
import { DeleteVehicleDialog } from "./DeleteVehicleDialog";
import { coordinateDistanceKilometers, formatDateTime, formatDuration, formatNumberUnit, formatRiskImpact, formatRiskKind, formatStatus, present, riskComparison } from "./formatters";
import { RecoveryComparisonFailure, RecoveryComparisonPanel } from "../recovery-comparison/RecoveryComparisonPanel";
import type { Unit211RecoveryComparisonState } from "../recovery-comparison/unit211RecoveryComparisonModel";
import { RecoveryWorkflowPanel, type RecoveryWorkflowPanelProps } from "../recovery-comparison/RecoveryWorkflowPanel";
import { EditVehicleDialog } from "./EditVehicleDialog";
import { evaluateVehicleMotion } from "../../domain/operations/vehicleMotion";

type InspectionProps = { comparison?: Unit211RecoveryComparisonState; isFollowing: boolean; locale: Locale; onBackFromRecovery?(): void; onClose(): void; onDeleted?(): void; onRestoreFollow(): void; onReviewRecovery?(): void; onScenarioChange(scenario: OperatingRegion): void; onViewRoute(): void; operations: OperationsApi; recovery?: Omit<RecoveryWorkflowPanelProps, "locale">; recoveryUnavailableReason?: Unit211PreDispatchContextFailureReason; scenario: OperatingRegion; vehicle: Vehicle };
type DetailTab = "vehicle" | "cargo" | "driver";
const severityRank = { low: 0, medium: 1, high: 2, critical: 3 } as const;

function refrigeration(vehicle: Vehicle, copy: Catalog): string { return vehicle.cargo.refrigeration === "chilled" ? copy.chilled : vehicle.cargo.refrigeration === "frozen" ? copy.frozen : copy.ambient; }
function priority(vehicle: Vehicle, copy: Catalog): string { return vehicle.cargo.priority === "priority" ? copy.priorityUrgent : vehicle.cargo.priority === "critical" ? copy.priorityCritical : copy.priorityStandard; }
function severityLabel(severity: OperationalRisk["severity"], locale: Locale): string { const copy = operationalCopy(locale); return severity === "critical" ? copy.severityCritical : severity === "high" ? copy.severityHigh : severity === "medium" ? copy.severityMedium : copy.severityLow; }

function DetailList({ locale, tab, vehicle, onOpenHud }: { locale: Locale; tab: DetailTab; vehicle: Vehicle; onOpenHud(): void }) {
  const copy = catalog(locale);
  if (tab === "cargo") return <dl className="inspection-detail-list"><div><dt>{copy.cargo}</dt><dd>{present(vehicle.cargo.description, copy.notAvailable)}</dd></div><div><dt>{copy.refrigeration}</dt><dd>{refrigeration(vehicle, copy)}</dd></div><div><dt>{copy.priority}</dt><dd>{priority(vehicle, copy)}</dd></div></dl>;
  if (tab === "driver") return (
    <div className="driver-details">
      <dl className="inspection-detail-list"><div><dt>{copy.remainingDrive}</dt><dd>{formatDuration(vehicle.timing.remainingDriveMinutes, locale, copy.notAvailable)}</dd></div><div><dt>{copy.restDeadline}</dt><dd>{formatDateTime(vehicle.timing.restDeadline, locale, copy.notAvailable)}</dd></div></dl>
      <section aria-labelledby="privacy-facts-heading" className="driver-privacy-panel" style={{ marginTop: '1rem', padding: '0.85rem', background: '#f4f7f9', border: '1px solid #d1dbe1', borderRadius: '4px' }}>
        <h4 id="privacy-facts-heading" style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem' }}>Verifiable Architecture Facts</h4>
        <ul style={{ margin: '0 0 0.75rem 0', paddingLeft: '1.2rem', fontSize: '0.8rem', color: '#334e68', lineHeight: 1.4 }}>
          <li>Client-side deterministic routing & clearance assessment</li>
          <li>Local-only state persistence via browser localStorage</li>
          <li>Zero external telemetry tracking or third-party ad beacons</li>
          <li>Explicit human approval gates for recovery execution</li>
        </ul>
        <button onClick={onOpenHud} style={{ padding: '0.4rem 0.75rem', background: '#193c57', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }} type="button">
          Preview Driver HUD
        </button>
      </section>
    </div>
  );
  return <dl className="inspection-detail-list"><div><dt>{copy.length}</dt><dd>{formatNumberUnit(vehicle.dimensions.lengthMeters, copy.meters, locale, copy.notAvailable)}</dd></div><div><dt>{copy.vehicleHeight}</dt><dd>{formatNumberUnit(vehicle.dimensions.heightMeters, copy.meters, locale, copy.notAvailable)}</dd></div><div><dt>{copy.weight}</dt><dd>{formatNumberUnit(vehicle.dimensions.weightTonnes, copy.tonnes, locale, copy.notAvailable)}</dd></div></dl>;
}

function RiskCard({ locale, risk, vehicle }: { locale: Locale; risk: OperationalRisk; vehicle: Vehicle }) {
  const copy = catalog(locale);
  const snap = risk.routeSnaps?.find((entry) => entry.routeId === vehicle.routeId);
  const distance = snap === undefined ? Number.NaN : coordinateDistanceKilometers(vehicle.position.geometry.coordinates, snap.startCoordinate);
  const comparison = risk.kind === "rest-deadline" ? formatDateTime(risk.deadline ?? vehicle.timing.restDeadline, locale, copy.notAvailable) : riskComparison(risk, vehicle.dimensions.heightMeters, vehicle.dimensions.weightTonnes, locale, copy);
  return <article className="risk-card" data-severity={risk.severity}><div className="risk-card-heading"><WarningCircle aria-hidden="true" size={18} weight="fill" /><strong>{formatRiskKind(risk.kind, copy)}</strong></div><p><b>{copy.impact}:</b> {formatRiskImpact(risk.kind, copy)}</p>{comparison && <p>{comparison}</p>}{Number.isFinite(distance) && <p>{copy.approximateDistance}: {formatNumberUnit(distance, "km", locale, copy.notAvailable)}</p>}</article>;
}

export function VehicleInspection({ comparison, isFollowing, locale, onBackFromRecovery, onClose, onDeleted, onRestoreFollow, onReviewRecovery, onScenarioChange, onViewRoute, operations, recovery, recoveryUnavailableReason, scenario, vehicle }: InspectionProps) {
  const copy = catalog(locale);
  const inspectionRef = useRef<HTMLElement>(null);
  const usesTabletDialog = useTabletViewport();
  const comparisonOpen = comparison !== undefined;
  const [tabletDrawerOpen, setTabletDrawerOpen] = useState(true);
  const closeTimerRef = useRef<number | undefined>(undefined);
  const [label, setLabel] = useState(vehicle.label);
  const [persistedLabel, setPersistedLabel] = useState(vehicle.label);
  const [hasEdited, setHasEdited] = useState(false);
  const [feedback, setFeedback] = useState<"none" | "saved" | "error">("none");
  const [tab, setTab] = useState<DetailTab>("vehicle");
  const [showHud, setShowHud] = useState(false);
  const risks = scenario.risks.filter((risk) => risk.affectedVehicleIds.includes(vehicle.internalId)).sort((left, right) => severityRank[right.severity] - severityRank[left.severity]);
  const highestRisk = risks[0];
  const normalizedLabel = label.trim();
  const isValid = isVehicleLabelValid(normalizedLabel);
  const canSave = isValid && normalizedLabel !== persistedLabel;
  const displayName = normalizedLabel || vehicle.fleetNumber;

  useEffect(() => () => {
    if (closeTimerRef.current !== undefined) window.clearTimeout(closeTimerRef.current);
  }, []);
  useEffect(() => { if (!usesTabletDialog) inspectionRef.current?.focus(); }, [usesTabletDialog]);
  useEffect(() => { if (comparisonOpen) requestAnimationFrame(() => document.getElementById("recovery-comparison-heading")?.focus()); }, [comparisonOpen]);

  function requestClose(): void {
    if (!usesTabletDialog) {
      onClose();
      return;
    }
    if (closeTimerRef.current !== undefined) return;
    setTabletDrawerOpen(false);
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    closeTimerRef.current = window.setTimeout(onClose, reduceMotion ? 0 : 220);
  }

  function refreshScenario(): void { const result = operations.scenarioCurrent(); if (result.ok) onScenarioChange(result.data); }
  function saveLabel(): void {
    if (!canSave) return;
    const result = operations.vehicleRename({ vehicleId: vehicle.internalId, label: normalizedLabel });
    if (!result.ok) { setFeedback("error"); return; }
    setLabel(result.data.label); setPersistedLabel(result.data.label); setHasEdited(false); setFeedback("saved"); refreshScenario();
  }
  function deleteVehicle(): void { const result = operations.vehicleDelete(vehicle.internalId); if (!result.ok) { setFeedback("error"); return; } refreshScenario(); onDeleted?.(); if (onDeleted === undefined) onClose(); }
  const tabs: Array<{ id: DetailTab; label: string }> = [{ id: "vehicle", label: copy.vehicleTab }, { id: "cargo", label: copy.cargoTab }, { id: "driver", label: copy.driverTab }];
  const recoveryCopy = recoveryComparisonCopy(locale); const contents = <>
    <header className="drawer-header">{comparison !== undefined && <button className="recovery-back" onClick={onBackFromRecovery} type="button"><ArrowLeft aria-hidden="true" size={18} />{recoveryCopy.backToVehicleDetails}</button>}<div>{usesTabletDialog ? <Dialog.Title asChild><strong>{displayName}</strong></Dialog.Title> : <strong>{displayName}</strong>}<span>{vehicle.fleetNumber}</span></div><button aria-label={copy.closeInspection} className="drawer-close" onClick={requestClose} type="button"><X aria-hidden="true" size={18} /></button></header>
    <div className="inspection-body">{comparison === undefined ? <>
      <section aria-labelledby="identity-heading" className="inspection-section"><h2 id="identity-heading">{copy.identity}</h2><div className="identity-heading"><Truck aria-hidden="true" size={22} /><span aria-label={`${copy.status}: ${formatStatus(vehicle.status, copy)}`} className={`identity-status status-${vehicle.status}`} /></div><label htmlFor="vehicle-label">{copy.label}</label><div className="label-edit"><input aria-invalid={hasEdited && !isValid} id="vehicle-label" onChange={(event) => { setLabel(event.target.value); setHasEdited(true); setFeedback("none"); }} value={label} /><button disabled={!canSave} onClick={saveLabel} type="button">{copy.saveLabel}</button></div>{hasEdited && !isValid && <p className="drawer-error" role="alert">{copy.invalidLabel}</p>}{feedback !== "none" && <p className="label-feedback" role={feedback === "saved" ? "status" : "alert"}>{feedback === "saved" ? copy.labelSaved : copy.notAvailable}</p>}<dl className="identity-list"><div><dt>{copy.fleetNumber}</dt><dd>{vehicle.fleetNumber}</dd></div><div><dt>{copy.plate}</dt><dd>{present(vehicle.plate, copy.notAvailable)}</dd></div><div><dt>{copy.vehicleType}</dt><dd>{present(vehicle.dimensions.vehicleType, copy.notAvailable)}</dd></div></dl></section>
      {(() => {
        const motionEval = evaluateVehicleMotion(vehicle);
        return (
          <section aria-labelledby="summary-heading" className="inspection-section operational-summary"><h2 id="summary-heading">{copy.operationalSummary}</h2><dl><div><dt>{copy.status}</dt><dd>{formatStatus(vehicle.status, copy)}</dd></div><div><dt>{locale === "es" ? "Movimiento" : "Movement"}</dt><dd data-vehicle-motion-status={motionEval.isMoving ? "moving" : "stopped"}>{motionEval.isMoving ? <span className="motion-tag tag-moving">🟢 {locale === "es" ? "En tránsito" : "In transit"} ({Math.round(vehicle.speedKmH || 82)} km/h)</span> : <span className="motion-tag tag-stopped" data-vehicle-stopped-reason={motionEval.reasonText[locale]}>🛑 {motionEval.reasonText[locale]}</span>}</dd></div><div><dt>{copy.route}</dt><dd>{present(vehicle.origin.name, copy.notAvailable)} → {present(vehicle.destination.name, copy.notAvailable)}</dd></div><div><dt>{copy.eta}</dt><dd>{formatDateTime(vehicle.timing.eta, locale, copy.notAvailable)}</dd></div>{vehicle.timing.delayMinutes > 0 && <div><dt>{copy.delay}</dt><dd>{formatDuration(vehicle.timing.delayMinutes, locale, copy.notAvailable)}</dd></div>}<div><dt>{copy.currentRisk}</dt><dd>{highestRisk === undefined ? copy.noCurrentRisk : `${severityLabel(highestRisk.severity, locale)} · ${formatRiskKind(highestRisk.kind, copy)}`}</dd></div></dl></section>
        );
      })()}
      <section aria-labelledby="risk-heading" className="inspection-section attention-section"><h2 id="risk-heading">{copy.whyAttention}</h2>{risks.length === 0 ? <p>{copy.noCurrentRisk}</p> : risks.map((risk) => <RiskCard key={risk.id} locale={locale} risk={risk} vehicle={vehicle} />)}</section>
      <section aria-label={copy.vehicleInspection} className="inspection-secondary"><div aria-label={copy.vehicleInspection} className="inspection-tabs" role="tablist">{tabs.map((entry) => <button aria-controls="inspection-tabpanel" aria-selected={tab === entry.id} id={`inspection-tab-${entry.id}`} key={entry.id} onClick={() => setTab(entry.id)} role="tab" type="button">{entry.label}</button>)}</div><div aria-labelledby={`inspection-tab-${tab}`} id="inspection-tabpanel" role="tabpanel"><DetailList locale={locale} onOpenHud={() => setShowHud(true)} tab={tab} vehicle={vehicle} /></div></section>
      <section aria-labelledby="actions-heading" className="inspection-section inspection-actions"><h2 id="actions-heading">{copy.actions}</h2>{recoveryUnavailableReason && <div aria-labelledby="recovery-unavailable-heading" className="recovery-inline-failure" role="alert"><strong id="recovery-unavailable-heading">{recoveryCopy.failureTitle}</strong><p>{recoveryCopy.failureDescription}</p><code>{recoveryUnavailableReason}</code><p>{recoveryCopy.noRouteChanged}</p></div>}<div><button className="primary-action" onClick={onViewRoute} type="button">{copy.viewOnRoute}</button>{onReviewRecovery && <button id="review-recovery-options" onClick={onReviewRecovery} type="button">{recoveryCopy.reviewOptions}</button>}{!isFollowing && <button className="follow-control" onClick={() => { onRestoreFollow(); requestAnimationFrame(() => inspectionRef.current?.focus()); }} type="button">{interpolate(copy.followVehicle, { label: displayName })}</button>}<EditVehicleDialog locale={locale} onScenarioChange={onScenarioChange} operations={operations} scenario={scenario} vehicle={vehicle} /><DeleteVehicleDialog locale={locale} onConfirm={deleteVehicle} vehicle={{ ...vehicle, label }} /></div></section>
    </> : comparison.kind === "ready" ? <RecoveryComparisonPanel locale={locale} model={comparison} workflow={recovery && <RecoveryWorkflowPanel {...recovery} locale={locale} />} /> : <><RecoveryComparisonFailure locale={locale} reasonCode={comparison.reasonCode} />{recovery && <RecoveryWorkflowPanel {...recovery} locale={locale} />}</>}</div>
    {showHud && (
      <div className="passive-hud-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999, background: '#0a1017', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <button onClick={() => setShowHud(false)} style={{ position: 'absolute', top: 20, right: 20, background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }} type="button"><X size={32} /></button>
        <span style={{ background: '#1e3851', border: '1px solid #36536c', padding: '4px 12px', borderRadius: '4px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1.25rem', color: '#90cdf4' }}>🧪 Preview Sintética · Driver HUD</span>
        <h1 style={{ fontSize: '4.5rem', margin: 0, fontFamily: 'monospace' }}>
          {vehicle.status === "driving" ? `${Math.round(vehicle.speedKmH || 78)}` : "0"} <span style={{ fontSize: '1.5rem', color: '#88a' }}>km/h</span>
        </h1>
        <p style={{ fontSize: '1.25rem', color: '#9fb3c8', marginTop: '0.5rem' }}>{present(vehicle.origin.name, copy.notAvailable)} → {present(vehicle.destination.name, copy.notAvailable)}</p>
        {highestRisk && (
          <div style={{ marginTop: '2rem', padding: '1rem 1.5rem', background: '#1c2936', border: '1px solid #d97706', borderRadius: '8px', textAlign: 'center', maxWidth: '420px' }}>
            <WarningCircle color="#f59e0b" size={40} />
            <h2 style={{ margin: '0.5rem 0', fontSize: '1.1rem' }}>{formatRiskKind(highestRisk.kind, copy)}</h2>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e1' }}>{highestRisk.title}</p>
          </div>
        )}
      </div>
    )}
  </>;
  if (usesTabletDialog) return <Dialog.Root modal={false} onOpenChange={(open) => { if (!open) requestClose(); }} open={tabletDrawerOpen}><Dialog.Portal><Dialog.Content aria-describedby={undefined} aria-label={copy.vehicleInspection} className="vehicle-inspection tablet-vehicle-drawer" onEscapeKeyDown={(event) => { if (comparison !== undefined) { event.preventDefault(); onBackFromRecovery?.(); } }} ref={(node) => { inspectionRef.current = node; }}>{contents}</Dialog.Content></Dialog.Portal></Dialog.Root>;
  return <aside aria-label={copy.vehicleInspection} className="vehicle-inspection" onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); if (comparison === undefined) onClose(); else onBackFromRecovery?.(); } }} ref={inspectionRef} role="complementary" tabIndex={-1}>{contents}</aside>;
}
