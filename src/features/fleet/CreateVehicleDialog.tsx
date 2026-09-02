import { useEffect, useState } from "react";
import { Plus, X, MapPin } from "@phosphor-icons/react";
import type { VehicleCreateCommand, OperatingRegion } from "../../domain/entities";
import type { OperationsApi } from "../../domain/operations/createOperationsApi";
import { catalog, type Locale } from "../../preferences/i18n/catalog";
import { useUiCoordinationStore } from "../../app/state/useUiCoordinationStore";

type AddVehicleButtonProps = {
  isExpanded?: boolean;
  locale: Locale;
};

export function AddVehicleButton({ isExpanded = true, locale }: AddVehicleButtonProps) {
  const placementMode = useUiCoordinationStore((s) => s.placementMode);
  const startPlacement = useUiCoordinationStore((s) => s.startPlacement);
  const cancelPlacement = useUiCoordinationStore((s) => s.cancelPlacement);
  const copy = catalog(locale);

  return (
    <button
      type="button"
      className={`add-vehicle-btn ${placementMode ? "placement-active" : ""}`}
      onClick={() => {
        if (placementMode) cancelPlacement();
        else startPlacement();
      }}
      aria-label={copy.addVehicle}
      title={copy.addVehicle}
    >
      <Plus size={18} weight="bold" />
      {isExpanded && <span>{copy.addVehicle}</span>}
    </button>
  );
}

type VehiclePlacementDrawerProps = {
  coordinates: [number, number];
  locale: Locale;
  operations: OperationsApi;
  onScenarioChange(scenario: OperatingRegion): void;
  onClose(): void;
};

export function VehiclePlacementDrawer({
  coordinates,
  locale,
  operations,
  onScenarioChange,
  onClose,
}: VehiclePlacementDrawerProps) {
  const copy = catalog(locale);
  const cancelPlacement = useUiCoordinationStore((s) => s.cancelPlacement);
  const selectVehicle = useUiCoordinationStore((s) => s.selectVehicle);

  const [fleetNumber, setFleetNumber] = useState("Unit 216");
  const [plate, setPlate] = useState("4567 LMN");
  const [label, setLabel] = useState("Iberian Logistics");
  const [vehicleType, setVehicleType] = useState("Articulated curtain-sider");
  const [lengthMeters, setLengthMeters] = useState(16.5);
  const [heightMeters, setHeightMeters] = useState(4.0);
  const [weightTonnes, setWeightTonnes] = useState(40.0);
  const [cargoDesc, setCargoDesc] = useState("General Freight");
  const [refrigeration, setRefrigeration] = useState<"ambient" | "chilled" | "frozen">("ambient");
  const [priority, setPriority] = useState<"standard" | "priority" | "critical">("standard");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cancelPlacement();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cancelPlacement, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const command: VehicleCreateCommand = {
      fleetNumber: fleetNumber.trim(),
      plate: plate.trim(),
      label: label.trim() || undefined,
      dimensions: {
        vehicleType,
        lengthMeters: Number(lengthMeters),
        heightMeters: Number(heightMeters),
        weightTonnes: Number(weightTonnes),
      },
      cargo: {
        description: cargoDesc.trim(),
        refrigeration,
        priority,
      },
      initialPosition: coordinates,
    };

    const result = operations.vehicleCreate(command);
    if (result.ok) {
      const scenarioResult = operations.scenarioCurrent();
      if (scenarioResult.ok) {
        onScenarioChange(scenarioResult.data);
      }
      cancelPlacement();
      onClose();
      selectVehicle(result.data.internalId);
    } else {
      setError(result.error.message || "Failed to create vehicle");
      setIsSubmitting(false);
    }
  };

  const [lng, lat] = coordinates;

  return (
    <div className="vehicle-placement-drawer" role="dialog" aria-label={copy.addVehicle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <h2>{copy.addVehicle}</h2>
        <button
          type="button"
          onClick={() => {
            cancelPlacement();
            onClose();
          }}
          aria-label="Close"
          style={{ background: "transparent", border: "none", color: "#8fa5b8", cursor: "pointer" }}
        >
          <X size={20} />
        </button>
      </div>

      <div className="vehicle-placement-coords">
        <MapPin size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} />
        <span>
          {lat.toFixed(4)}° N, {lng.toFixed(4)}° E
        </span>
      </div>

      {error && (
        <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", padding: "8px", borderRadius: "6px", color: "#fca5a5", fontSize: "12px", marginBottom: "12px" }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="placement-form-group">
          <label htmlFor="placement-fleet-num">{copy.fleetNumber} *</label>
          <input
            id="placement-fleet-num"
            required
            value={fleetNumber}
            onChange={(e) => setFleetNumber(e.target.value)}
          />
        </div>

        <div className="placement-form-group">
          <label htmlFor="placement-plate">{copy.plate} *</label>
          <input
            id="placement-plate"
            required
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
          />
        </div>

        <div className="placement-form-group">
          <label htmlFor="placement-label">{copy.label}</label>
          <input
            id="placement-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>

        <div className="placement-form-group">
          <label htmlFor="placement-vehicle-type">{copy.vehicleType}</label>
          <select
            id="placement-vehicle-type"
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
          >
            <option value="Articulated curtain-sider">Articulated curtain-sider</option>
            <option value="Rigid truck">Rigid truck</option>
            <option value="Refrigerated van">Refrigerated van</option>
            <option value="Semi-trailer">Semi-trailer</option>
          </select>
        </div>

        <div className="placement-dimensions-row">
          <div className="placement-form-group">
            <label htmlFor="placement-len">{copy.length} (m)</label>
            <input
              id="placement-len"
              type="number"
              step="0.1"
              min="1"
              max="30"
              required
              value={lengthMeters}
              onChange={(e) => setLengthMeters(parseFloat(e.target.value))}
            />
          </div>
          <div className="placement-form-group">
            <label htmlFor="placement-hgt">{copy.vehicleHeight} (m)</label>
            <input
              id="placement-hgt"
              type="number"
              step="0.05"
              min="1"
              max="5"
              required
              value={heightMeters}
              onChange={(e) => setHeightMeters(parseFloat(e.target.value))}
            />
          </div>
          <div className="placement-form-group">
            <label htmlFor="placement-wgt">{copy.weight} (t)</label>
            <input
              id="placement-wgt"
              type="number"
              step="0.5"
              min="1"
              max="60"
              required
              value={weightTonnes}
              onChange={(e) => setWeightTonnes(parseFloat(e.target.value))}
            />
          </div>
        </div>

        <div className="placement-form-group">
          <label htmlFor="placement-cargo-desc">{copy.cargo} *</label>
          <input
            id="placement-cargo-desc"
            required
            value={cargoDesc}
            onChange={(e) => setCargoDesc(e.target.value)}
          />
        </div>

        <div className="placement-dimensions-row">
          <div className="placement-form-group" style={{ gridColumn: "span 2" }}>
            <label htmlFor="placement-refrig">{copy.refrigeration}</label>
            <select
              id="placement-refrig"
              value={refrigeration}
              onChange={(e) => setRefrigeration(e.target.value as "ambient" | "chilled" | "frozen")}
            >
              <option value="ambient">{copy.ambient}</option>
              <option value="chilled">{copy.chilled}</option>
              <option value="frozen">{copy.frozen}</option>
            </select>
          </div>
          <div className="placement-form-group">
            <label htmlFor="placement-prior">{copy.priority}</label>
            <select
              id="placement-prior"
              value={priority}
              onChange={(e) => setPriority(e.target.value as "standard" | "priority" | "critical")}
            >
              <option value="standard">{copy.priorityStandard}</option>
              <option value="priority">{copy.priorityUrgent}</option>
              <option value="critical">{copy.priorityCritical}</option>
            </select>
          </div>
        </div>

        <p style={{ fontSize: "11px", color: "#8fa5b8", margin: "14px 0 0 0", lineHeight: "1.4" }}>
          {locale === "es"
            ? "El vehículo se creará en reposo sin ruta asignada en las coordenadas marcadas. Puede asignarle una ruta real posteriormente desde Editar vehículo; el vehículo se situará en el inicio de dicha ruta."
            : "The vehicle will be created in resting status without an assigned route at the marked coordinates. You can assign a real route later via Edit vehicle; the vehicle will reposition to that route's origin."}
        </p>

        <div className="placement-form-actions">
          <button
            type="button"
            onClick={() => {
              cancelPlacement();
              onClose();
            }}
          >
            {copy.cancel}
          </button>
          <button type="submit" disabled={isSubmitting}>
            {copy.addVehicle}
          </button>
        </div>
      </form>
    </div>
  );
}

// Backward compatibility export
export const CreateVehicleDialog = AddVehicleButton;
