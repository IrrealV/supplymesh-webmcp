import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import type { VehicleCreateCommand, OperatingRegion } from "../../domain/entities";
import type { OperationsApi } from "../../domain/operations/createOperationsApi";
import type { Locale } from "../../preferences/i18n/catalog";
import { Plus } from "@phosphor-icons/react";

type CreateVehicleDialogProps = {
  locale: Locale;
  operations: OperationsApi;
  scenario: OperatingRegion;
  onScenarioChange(scenario: OperatingRegion): void;
};

export function CreateVehicleDialog({ operations, scenario, onScenarioChange }: CreateVehicleDialogProps) {
  const [open, setOpen] = useState(false);

  const [fleetNumber, setFleetNumber] = useState("");
  const [plate, setPlate] = useState("");
  const [label, setLabel] = useState("");
  const [vehicleType, setVehicleType] = useState("Semi-trailer");
  const [lengthMeters, setLengthMeters] = useState(16.5);
  const [heightMeters, setHeightMeters] = useState(4.0);
  const [weightTonnes, setWeightTonnes] = useState(40.0);
  const [cargoDesc, setCargoDesc] = useState("Mixed goods");
  const [refrigeration, setRefrigeration] = useState<"ambient" | "chilled" | "frozen">("ambient");
  const [priority, setPriority] = useState<"standard" | "priority" | "critical">("standard");
  const [routeId, setRouteId] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const command: VehicleCreateCommand = {
      fleetNumber,
      plate,
      label,
      dimensions: { vehicleType, lengthMeters, heightMeters, weightTonnes },
      cargo: { description: cargoDesc, refrigeration, priority },
      routeId: routeId || undefined
    };
    const result = operations.vehicleCreate(command);
    if (result.ok) {
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
        <button className="create-vehicle-button" aria-label="Create vehicle" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', cursor: 'pointer', background: 'transparent', border: '1px solid #ccc', borderRadius: '4px' }}>
          <Plus size={16} /> Create vehicle
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <Dialog.Title>Create vehicle</Dialog.Title>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
            <label>Fleet Number: <input required value={fleetNumber} onChange={e => setFleetNumber(e.target.value)} /></label>
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
              <button type="submit">Create</button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
