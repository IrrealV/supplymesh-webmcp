import * as Dialog from "@radix-ui/react-dialog";
import { X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type { OperationsApi } from "../../domain/operations/createOperationsApi";
import { getVehicleDisplayName, type OperatingRegion, type OperationalRisk, type Vehicle } from "../../domain/entities";
import { catalog, interpolate, type Catalog, type Locale } from "../../preferences/i18n/catalog";
import { DeleteVehicleDialog } from "./DeleteVehicleDialog";

type DrawerProps = { isFollowing: boolean; locale: Locale; onClose(): void; onRestoreFollow(): void; onScenarioChange(scenario: OperatingRegion): void; operations: OperationsApi; scenario: OperatingRegion; vehicle: Vehicle };

function present(value: string, fallback: string): string { return value.trim() || fallback; }
function measure(value: number, unit: string, fallback: string): string { return Number.isFinite(value) ? `${value} ${unit}` : fallback; }
function statusLabel(vehicle: Vehicle, copy: Catalog): string { return vehicle.status === "driving" ? copy.statusDriving : vehicle.status === "resting" ? copy.statusResting : vehicle.status === "needs-attention" ? copy.statusNeedsAttention : copy.statusCritical; }
function refrigerationLabel(vehicle: Vehicle, copy: Catalog): string { return vehicle.cargo.refrigeration === "chilled" ? copy.chilled : vehicle.cargo.refrigeration === "frozen" ? copy.frozen : copy.ambient; }
function priorityLabel(vehicle: Vehicle, copy: Catalog): string { return vehicle.cargo.priority === "priority" ? copy.priorityUrgent : vehicle.cargo.priority === "critical" ? copy.priorityCritical : copy.priorityStandard; }
function tabletQuery(): boolean { return typeof window !== "undefined" && window.matchMedia?.("(min-width: 768px) and (max-width: 1023px)").matches === true; }
function riskText(risk: OperationalRisk, vehicle: Vehicle, copy: Catalog): string {
  if (risk.limitMeters !== undefined) return interpolate(copy.heightComparison, { height: vehicle.dimensions.heightMeters, clearance: risk.limitMeters });
  if (risk.limitTonnes !== undefined) return interpolate(copy.clearanceComparison, { weight: vehicle.dimensions.weightTonnes, limit: risk.limitTonnes });
  return present(risk.title, copy.notAvailable);
}

export function VehicleDrawer({ isFollowing, locale, onClose, onRestoreFollow, onScenarioChange, operations, scenario, vehicle }: DrawerProps) {
  const copy = catalog(locale);
  const drawerRef = useRef<HTMLElement>(null);
  const [usesTabletDialog, setUsesTabletDialog] = useState(tabletQuery);
  const [label, setLabel] = useState(vehicle.label);
  const [error, setError] = useState("");
  const risks = scenario.risks.filter((risk) => risk.affectedVehicleIds.includes(vehicle.internalId));
  useEffect(() => {
    if (window.matchMedia === undefined) return;
    const media = window.matchMedia("(min-width: 768px) and (max-width: 1023px)");
    const updateDialogMode = (): void => setUsesTabletDialog(media.matches);
    updateDialogMode();
    media.addEventListener("change", updateDialogMode);
    return () => media.removeEventListener("change", updateDialogMode);
  }, []);
  useEffect(() => { if (!usesTabletDialog) drawerRef.current?.focus(); }, [usesTabletDialog]);
  function refreshScenario(): void { const result = operations.scenarioCurrent(); if (result.ok) onScenarioChange(result.data); }
  function saveLabel(): void { const result = operations.vehicleRename({ vehicleId: vehicle.internalId, label }); if (!result.ok) { setError(copy.invalidLabel); return; } setError(""); setLabel(result.data.label); refreshScenario(); }
  function deleteVehicle(): void { const result = operations.vehicleDelete(vehicle.internalId); if (!result.ok) { setError(copy.notAvailable); return; } refreshScenario(); onClose(); }
  const contents = <>
    <header className="drawer-header"><div>{usesTabletDialog ? <Dialog.Title asChild><strong>{getVehicleDisplayName(vehicle)}</strong></Dialog.Title> : <strong>{getVehicleDisplayName(vehicle)}</strong>}<span>{vehicle.fleetNumber}</span></div><button aria-label={copy.closeInspection} className="drawer-close" onClick={onClose} type="button"><X aria-hidden="true" size={18} /></button></header>
    <div className="drawer-body"><section><label htmlFor="vehicle-label">{copy.label}</label><div className="label-edit"><input id="vehicle-label" onChange={(event) => setLabel(event.target.value)} value={label} /><button onClick={saveLabel} type="button">{copy.saveLabel}</button></div>{error && <p className="drawer-error" role="alert">{error}</p>}</section>
      <dl className="inspection-list"><div><dt>{copy.fleetNumber}</dt><dd>{vehicle.fleetNumber}</dd></div><div><dt>{copy.plate}</dt><dd>{present(vehicle.plate, copy.notAvailable)}</dd></div><div><dt>{copy.origin}</dt><dd>{present(vehicle.origin.name, copy.notAvailable)}</dd></div><div><dt>{copy.destination}</dt><dd>{present(vehicle.destination.name, copy.notAvailable)}</dd></div><div><dt>{copy.currentRoute}</dt><dd>{present(vehicle.currentRoute, copy.notAvailable)}</dd></div><div><dt>{copy.status}</dt><dd>{statusLabel(vehicle, copy)}</dd></div><div><dt>{copy.cargo}</dt><dd>{present(vehicle.cargo.description, copy.notAvailable)}</dd></div><div><dt>{copy.refrigeration}</dt><dd>{refrigerationLabel(vehicle, copy)}</dd></div><div><dt>{copy.priority}</dt><dd>{priorityLabel(vehicle, copy)}</dd></div><div><dt>{copy.vehicleType}</dt><dd>{present(vehicle.dimensions.vehicleType, copy.notAvailable)}</dd></div><div><dt>{copy.length}</dt><dd>{measure(vehicle.dimensions.lengthMeters, copy.meters, copy.notAvailable)}</dd></div><div><dt>{copy.vehicleHeight}</dt><dd>{measure(vehicle.dimensions.heightMeters, copy.meters, copy.notAvailable)}</dd></div><div><dt>{copy.weight}</dt><dd>{measure(vehicle.dimensions.weightTonnes, copy.tonnes, copy.notAvailable)}</dd></div><div><dt>{copy.remainingDrive}</dt><dd>{measure(vehicle.timing.remainingDriveMinutes, copy.minutes, copy.notAvailable)}</dd></div><div><dt>{copy.restDeadline}</dt><dd>{present(vehicle.timing.restDeadline, copy.notAvailable)}</dd></div><div><dt>{copy.eta}</dt><dd>{present(vehicle.timing.eta, copy.notAvailable)}</dd></div><div><dt>{copy.delay}</dt><dd>{measure(vehicle.timing.delayMinutes, copy.minutes, copy.notAvailable)}</dd></div></dl>
      <section className="risk-comparison"><h2>{copy.riskComparison}</h2>{risks.length === 0 ? <p>{copy.notAvailable}</p> : risks.map((risk) => <p key={risk.id}>{riskText(risk, vehicle, copy)}</p>)}</section>
      {!isFollowing && <button className="follow-control" onClick={onRestoreFollow} type="button">{interpolate(copy.followVehicle, { label: getVehicleDisplayName(vehicle) })}</button>}
      <DeleteVehicleDialog locale={locale} onConfirm={deleteVehicle} vehicle={vehicle} />
    </div>
  </>;
  if (usesTabletDialog) {
    return <Dialog.Root onOpenChange={(open) => { if (!open) onClose(); }} open><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content aria-describedby={undefined} aria-label={copy.vehicleInspection} className="vehicle-drawer">{contents}</Dialog.Content></Dialog.Portal></Dialog.Root>;
  }
  return <aside aria-label={copy.vehicleInspection} className="vehicle-drawer" onKeyDown={(event) => { if (event.key === "Escape") onClose(); }} ref={drawerRef} role="complementary" tabIndex={-1}>{contents}</aside>;
}
