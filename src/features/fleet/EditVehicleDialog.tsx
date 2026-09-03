import * as Dialog from "@radix-ui/react-dialog";
import { Pencil } from "@phosphor-icons/react";
import { useState, type FormEvent } from "react";
import type { OperatingRegion, Vehicle, VehicleAssignRouteCommand, VehicleUpdateCommand } from "../../domain/entities";
import type { OperationsApi } from "../../domain/operations/createOperationsApi";
import type { Locale } from "../../preferences/i18n/catalog";
import "./editVehicleDialog.css";

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
  const [error, setError] = useState("");

  const resetForm = (): void => {
    setPlate(vehicle.plate);
    setLabel(vehicle.label);
    setVehicleType(vehicle.dimensions.vehicleType);
    setLengthMeters(vehicle.dimensions.lengthMeters);
    setHeightMeters(vehicle.dimensions.heightMeters);
    setWeightTonnes(vehicle.dimensions.weightTonnes);
    setCargoDesc(vehicle.cargo.description);
    setRefrigeration(vehicle.cargo.refrigeration);
    setPriority(vehicle.cargo.priority);
    setRouteId(vehicle.routeId || "");
    setError("");
  };

  const handleOpenChange = (nextOpen: boolean): void => {
    if (nextOpen) resetForm();
    setOpen(nextOpen);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setError("");

    const selectedRoute = routeId === "" ? undefined : scenario.routes.find((route) => route.id === routeId);
    if (routeId !== "" && selectedRoute === undefined) {
      setError("The selected route is no longer available.");
      return;
    }
    if (selectedRoute !== undefined && selectedRoute.vehicleId !== "" && selectedRoute.vehicleId !== vehicle.internalId) {
      setError("That route is already assigned to another vehicle.");
      return;
    }

    const updateCommand: VehicleUpdateCommand = {
      vehicleId: vehicle.internalId,
      plate,
      label,
      dimensions: { vehicleType, lengthMeters, heightMeters, weightTonnes },
      cargo: { description: cargoDesc, refrigeration, priority },
    };
    const assignCommand: VehicleAssignRouteCommand = {
      vehicleId: vehicle.internalId,
      routeId: routeId || undefined,
    };

    const updateResult = operations.vehicleUpdate(updateCommand);
    if (!updateResult.ok) {
      setError(updateResult.error.message);
      return;
    }

    const routeResult = operations.vehicleAssignRoute(assignCommand);
    if (!routeResult.ok) {
      setError(routeResult.error.message);
      return;
    }

    const scenarioResult = operations.scenarioCurrent();
    if (!scenarioResult.ok) {
      setError(scenarioResult.error.message);
      return;
    }

    onScenarioChange(scenarioResult.data);
    setOpen(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <button type="button" aria-label="Edit vehicle" className="edit-vehicle-button">
          <Pencil size={16} /> Edit Vehicle
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="edit-vehicle-dialog-overlay" />
        <Dialog.Content className="edit-vehicle-dialog-content">
          <header className="edit-vehicle-dialog-header">
            <Dialog.Title>Edit Vehicle</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" aria-label="Close edit vehicle" className="edit-vehicle-dialog-close">×</button>
            </Dialog.Close>
          </header>
          <Dialog.Description className="visually-hidden">
            Update vehicle, cargo, dimensions, and route assignment.
          </Dialog.Description>

          <form className="edit-vehicle-form" onSubmit={handleSubmit}>
            <div className="edit-vehicle-form-grid">
              <label htmlFor="edit-vehicle-plate">Plate
                <input id="edit-vehicle-plate" required value={plate} onChange={(event) => setPlate(event.target.value)} />
              </label>
              <label htmlFor="edit-vehicle-label">Label
                <input id="edit-vehicle-label" required value={label} onChange={(event) => setLabel(event.target.value)} />
              </label>
              <label data-span="full" htmlFor="edit-vehicle-type">Vehicle Type
                <input id="edit-vehicle-type" required value={vehicleType} onChange={(event) => setVehicleType(event.target.value)} />
              </label>
              <label htmlFor="edit-vehicle-length">Length (m)
                <input id="edit-vehicle-length" min="0.1" type="number" step="0.1" required value={lengthMeters} onChange={(event) => setLengthMeters(Number.parseFloat(event.target.value))} />
              </label>
              <label htmlFor="edit-vehicle-height">Height (m)
                <input id="edit-vehicle-height" min="0.1" type="number" step="0.1" required value={heightMeters} onChange={(event) => setHeightMeters(Number.parseFloat(event.target.value))} />
              </label>
              <label htmlFor="edit-vehicle-weight">Weight (t)
                <input id="edit-vehicle-weight" min="0.1" type="number" step="0.1" required value={weightTonnes} onChange={(event) => setWeightTonnes(Number.parseFloat(event.target.value))} />
              </label>
              <label htmlFor="edit-vehicle-refrigeration">Refrigeration
                <select id="edit-vehicle-refrigeration" value={refrigeration} onChange={(event) => setRefrigeration(event.target.value as "ambient" | "chilled" | "frozen")}>
                  <option value="ambient">Ambient</option>
                  <option value="chilled">Chilled</option>
                  <option value="frozen">Frozen</option>
                </select>
              </label>
              <label htmlFor="edit-vehicle-priority">Priority
                <select id="edit-vehicle-priority" value={priority} onChange={(event) => setPriority(event.target.value as "standard" | "priority" | "critical")}>
                  <option value="standard">Standard</option>
                  <option value="priority">Priority</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
              <label data-span="full" htmlFor="edit-vehicle-cargo">Cargo Description
                <input id="edit-vehicle-cargo" required value={cargoDesc} onChange={(event) => setCargoDesc(event.target.value)} />
              </label>
              <label data-span="full" htmlFor="edit-vehicle-route">Route
                <select aria-label="Route" id="edit-vehicle-route" value={routeId} onChange={(event) => setRouteId(event.target.value)}>
                  <option value="">None (Resting)</option>
                  {scenario.routes.map((route) => {
                    const assignedElsewhere = route.vehicleId !== "" && route.vehicleId !== vehicle.internalId;
                    return (
                      <option disabled={assignedElsewhere} key={route.id} value={route.id}>
                        {route.name}{assignedElsewhere ? " — assigned" : ""}
                      </option>
                    );
                  })}
                </select>
              </label>
            </div>

            {error !== "" && <p className="edit-vehicle-dialog-error" role="alert">{error}</p>}

            <div className="edit-vehicle-dialog-actions">
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
