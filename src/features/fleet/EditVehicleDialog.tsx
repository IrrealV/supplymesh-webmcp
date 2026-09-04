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

type EditVehicleCopy = {
  ambient: string;
  assigned: string;
  cancel: string;
  cargoDescription: string;
  chilled: string;
  close: string;
  critical: string;
  description: string;
  edit: string;
  frozen: string;
  height: string;
  label: string;
  length: string;
  noneResting: string;
  plate: string;
  priority: string;
  refrigeration: string;
  route: string;
  routeAssigned: string;
  routeUnavailable: string;
  save: string;
  standard: string;
  title: string;
  vehicleType: string;
  weight: string;
};

const editVehicleCopies: Record<Locale, EditVehicleCopy> = {
  en: {
    ambient: "Ambient",
    assigned: "assigned",
    cancel: "Cancel",
    cargoDescription: "Cargo description",
    chilled: "Chilled",
    close: "Close edit vehicle",
    critical: "Critical",
    description: "Update vehicle, cargo, dimensions, and route assignment.",
    edit: "Edit Vehicle",
    frozen: "Frozen",
    height: "Height (m)",
    label: "Label",
    length: "Length (m)",
    noneResting: "None (Resting)",
    plate: "Plate",
    priority: "Priority",
    refrigeration: "Refrigeration",
    route: "Route",
    routeAssigned: "That route is already assigned to another vehicle.",
    routeUnavailable: "The selected route is no longer available.",
    save: "Save",
    standard: "Standard",
    title: "Edit Vehicle",
    vehicleType: "Vehicle type",
    weight: "Weight (t)",
  },
  es: {
    ambient: "Ambiente",
    assigned: "asignada",
    cancel: "Cancelar",
    cargoDescription: "Descripción de la carga",
    chilled: "Refrigerada",
    close: "Cerrar edición del vehículo",
    critical: "Crítica",
    description: "Actualiza el vehículo, la carga, las dimensiones y la asignación de ruta.",
    edit: "Editar vehículo",
    frozen: "Congelada",
    height: "Altura (m)",
    label: "Etiqueta",
    length: "Longitud (m)",
    noneResting: "Ninguna (en descanso)",
    plate: "Matrícula",
    priority: "Prioridad",
    refrigeration: "Refrigeración",
    route: "Ruta",
    routeAssigned: "Esa ruta ya está asignada a otro vehículo.",
    routeUnavailable: "La ruta seleccionada ya no está disponible.",
    save: "Guardar",
    standard: "Estándar",
    title: "Editar vehículo",
    vehicleType: "Tipo de vehículo",
    weight: "Peso (t)",
  },
};

export function EditVehicleDialog({ locale, operations, scenario, vehicle, onScenarioChange }: EditVehicleDialogProps) {
  const copy = editVehicleCopies[locale];
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
      setError(copy.routeUnavailable);
      return;
    }
    if (selectedRoute !== undefined && selectedRoute.vehicleId !== "" && selectedRoute.vehicleId !== vehicle.internalId) {
      setError(copy.routeAssigned);
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
        <button type="button" aria-label={copy.edit} className="edit-vehicle-button">
          <Pencil aria-hidden="true" size={16} /> {copy.edit}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="edit-vehicle-dialog-overlay" />
        <Dialog.Content className="edit-vehicle-dialog-content">
          <header className="edit-vehicle-dialog-header">
            <Dialog.Title>{copy.title}</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" aria-label={copy.close} className="edit-vehicle-dialog-close">×</button>
            </Dialog.Close>
          </header>
          <Dialog.Description className="visually-hidden">{copy.description}</Dialog.Description>

          <form className="edit-vehicle-form" onSubmit={handleSubmit}>
            <div className="edit-vehicle-form-grid">
              <label htmlFor="edit-vehicle-plate">{copy.plate}
                <input id="edit-vehicle-plate" required value={plate} onChange={(event) => setPlate(event.target.value)} />
              </label>
              <label htmlFor="edit-vehicle-label">{copy.label}
                <input id="edit-vehicle-label" required value={label} onChange={(event) => setLabel(event.target.value)} />
              </label>
              <label data-span="full" htmlFor="edit-vehicle-type">{copy.vehicleType}
                <input id="edit-vehicle-type" required value={vehicleType} onChange={(event) => setVehicleType(event.target.value)} />
              </label>
              <label htmlFor="edit-vehicle-length">{copy.length}
                <input id="edit-vehicle-length" min="0.1" type="number" step="0.1" required value={lengthMeters} onChange={(event) => setLengthMeters(Number.parseFloat(event.target.value))} />
              </label>
              <label htmlFor="edit-vehicle-height">{copy.height}
                <input id="edit-vehicle-height" min="0.1" type="number" step="0.1" required value={heightMeters} onChange={(event) => setHeightMeters(Number.parseFloat(event.target.value))} />
              </label>
              <label htmlFor="edit-vehicle-weight">{copy.weight}
                <input id="edit-vehicle-weight" min="0.1" type="number" step="0.1" required value={weightTonnes} onChange={(event) => setWeightTonnes(Number.parseFloat(event.target.value))} />
              </label>
              <label htmlFor="edit-vehicle-refrigeration">{copy.refrigeration}
                <select id="edit-vehicle-refrigeration" value={refrigeration} onChange={(event) => setRefrigeration(event.target.value as "ambient" | "chilled" | "frozen")}>
                  <option value="ambient">{copy.ambient}</option>
                  <option value="chilled">{copy.chilled}</option>
                  <option value="frozen">{copy.frozen}</option>
                </select>
              </label>
              <label htmlFor="edit-vehicle-priority">{copy.priority}
                <select id="edit-vehicle-priority" value={priority} onChange={(event) => setPriority(event.target.value as "standard" | "priority" | "critical")}>
                  <option value="standard">{copy.standard}</option>
                  <option value="priority">{copy.priority}</option>
                  <option value="critical">{copy.critical}</option>
                </select>
              </label>
              <label data-span="full" htmlFor="edit-vehicle-cargo">{copy.cargoDescription}
                <input id="edit-vehicle-cargo" required value={cargoDesc} onChange={(event) => setCargoDesc(event.target.value)} />
              </label>
              <label data-span="full" htmlFor="edit-vehicle-route">{copy.route}
                <select aria-label={copy.route} id="edit-vehicle-route" value={routeId} onChange={(event) => setRouteId(event.target.value)}>
                  <option value="">{copy.noneResting}</option>
                  {scenario.routes.map((route) => {
                    const assignedElsewhere = route.vehicleId !== "" && route.vehicleId !== vehicle.internalId;
                    return (
                      <option disabled={assignedElsewhere} key={route.id} value={route.id}>
                        {route.name}{assignedElsewhere ? ` — ${copy.assigned}` : ""}
                      </option>
                    );
                  })}
                </select>
              </label>
            </div>

            {error !== "" && <p className="edit-vehicle-dialog-error" role="alert">{error}</p>}

            <div className="edit-vehicle-dialog-actions">
              <Dialog.Close asChild>
                <button type="button">{copy.cancel}</button>
              </Dialog.Close>
              <button type="submit">{copy.save}</button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
