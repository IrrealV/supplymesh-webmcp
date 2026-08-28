import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { getVehicleDisplayName, type Vehicle } from "../../domain/entities";
import { catalog, interpolate, type Locale } from "../../preferences/i18n/catalog";

export function DeleteVehicleDialog({ locale, onConfirm, vehicle }: { locale: Locale; onConfirm(): void; vehicle: Vehicle }) {
  const copy = catalog(locale);
  const label = getVehicleDisplayName(vehicle);
  return <AlertDialog.Root><AlertDialog.Trigger asChild><button className="drawer-delete" type="button">{copy.deleteVehicle}</button></AlertDialog.Trigger><AlertDialog.Portal><AlertDialog.Overlay className="dialog-overlay" /><AlertDialog.Content className="delete-dialog"><AlertDialog.Title>{copy.deleteVehicle}</AlertDialog.Title><AlertDialog.Description>{interpolate(copy.deleteConsequence, { label })}</AlertDialog.Description><div className="dialog-actions"><AlertDialog.Cancel asChild><button type="button">{copy.cancel}</button></AlertDialog.Cancel><AlertDialog.Action asChild><button className="drawer-delete" onClick={onConfirm} type="button">{copy.delete}</button></AlertDialog.Action></div></AlertDialog.Content></AlertDialog.Portal></AlertDialog.Root>;
}
