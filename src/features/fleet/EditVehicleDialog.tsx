import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import type { VehicleUpdateCommand, OperatingRegion, Vehicle, VehicleAssignRouteCommand } from "../../domain/entities";
import type { OperationsApi } from "../../domain/operations/createOperationsApi";
import type { Locale } from "../../preferences/i18n/catalog";
import { Pencil } from "@phosphor-icons/react";

type EditVehicleDialogProps = {
  locale: Locale;
  operations: OperationsApi;
  scenario: OperatingRegion;
  vehicle: Vehicle;
  onScenarioChange(scenario: OperatingRegion): void;
};

export function EditVehicleDialog({ operations, scenario, vehicle, onScenarioChange }: EditVehicleDialogProps) {
  const [open, setOpen] = useState(false);

  const [plate, setPlate] = useState(vehicle.plate);
  const [label, setLabel] = useState(vehicle.label);
  const [vehicleType, setVehicleType] = useState(vehicle.dimensions.vehicleType);
  const [lengthMeters, setLengthMeters] = useState(vehicle.dimensions.lengthMeters);
  const [heightMeters, setHeightMeters] = useState(vehicle.dimensions.heightMeters);
  const [weightTonnes, setWeightTonnes] = useState(vehicle.dimensions.weightTonnes);
  const [cargoDesc, setCargoDesc] = useState(vehicle.cargo.description);
  const [refrigeration, setRefrigeration] = useState(vehicle.cargo.refrigeration);
  const [priority, setPriority] = useState(vehicle.cargo.priority);
  const [routeId, setRouteId] = useState(vehicle.routeId || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updateCommand: VehicleUpdateCommand = {
      vehicleId: vehicle.internalId,
      plate,
      label,
      dimensions: { vehicleType, lengthMeters, heightMeters, weightTonnes },
      cargo: { description: cargoDesc, refrigeration, priority }
    };
    const assignCommand: VehicleAssignRouteCommand = {
      vehicleId: vehicle.internalId,
      routeId: routeId || undefined
    };
    
    const resUpdate = operations.vehicleUpdate(updateCommand);
    const resRoute = operations.vehicleAssignRoute(assignCommand);

    if (resUpdate.ok && resRoute.ok) {
      const scenarioResult = operations.scenarioCurrent();
      if (scenarioResult.ok) {
        onScenarioChange(scenarioResult.data);
      }
      setOpen(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" aria-label="Edit vehicle" className="edit-vehicle-button" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <Pencil size={16} /> Edit Vehicle
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <Dialog.Title>Edit Vehicle</Dialog.Title>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
            <label>Plate: <input required value={plate} onChange={e => setPlate(e.target.value)} /></label>
            <label>Label: <input required value={label} onChange={e => setLabel(e.target.value)} /></label>
            <label>Vehicle Type: <input required value={vehicleType} onChange={e => setVehicleType(e.target.value)} /></label>
            <label>Length (m): <input type="number" step="0.1" required value={lengthMeters} onChange={e => setLengthMeters(parseFloat(e.target.value))} /></label>
            <label>Height (m): <input type="number" step="0.1" required value={heightMeters} onChange={e => setHeightMeters(parseFloat(e.target.value))} /></label>
            <label>Weight (t): <input type="number" step="0.1" required value={weightTonnes} onChange={e => setWeightTonnes(parseFloat(e.target.value))} /></label>
            <label>Cargo Description: <input required value={cargoDesc} onChange={e => setCargoDesc(e.target.value)} /></label>
            <label>Refrigeration: 
              <select value={refrigeration} onChange={e => setRefrigeration(e.target.value as "ambient" | "chilled" | "frozen")}>
                <option value="ambient">Ambient</option>
                <option value="chilled">Chilled</option>
                <option value="frozen">Frozen</option>
              </select>
            </label>
            <label>Priority:
              <select value={priority} onChange={e => setPriority(e.target.value as "standard" | "priority" | "critical")}>
                <option value="standard">Standard</option>
                <option value="priority">Priority</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            <label>Route:
              <select value={routeId} onChange={e => setRouteId(e.target.value)}>
                <option value="">None (Resting)</option>
                {scenario.routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
            <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <Dialog.Close asChild>
                <button type="button">Cancel</button>
              </Dialog.Close>
              <button type="submit">Save</button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
