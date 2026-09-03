import type { Cargo, Dimensions, DomainResult, OperatingRegion, VehicleAssignRouteCommand, VehicleCreateCommand, VehicleUpdateCommand } from "../../domain/entities";
import type { OperationsApi } from "../../domain/operations/createOperationsApi";
import type { JsonSchema, WebMcpTool, WebMcpToolResponse } from "./webMcpTypes";

type ScenarioChangeHandler = (scenario: OperatingRegion) => void;

const emptyInputSchema: JsonSchema = { type: "object", properties: {}, additionalProperties: false };
const vehicleGetInputSchema: JsonSchema = { type: "object", properties: { vehicleId: { type: "string", minLength: 1 } }, required: ["vehicleId"], additionalProperties: false };
const vehicleRenameInputSchema: JsonSchema = { type: "object", properties: { vehicleId: { type: "string", minLength: 1 }, label: { type: "string", minLength: 1 } }, required: ["vehicleId", "label"], additionalProperties: false };

const cargoInputSchema: JsonSchema = {
  type: "object",
  properties: {
    description: { type: "string", minLength: 1 },
    refrigeration: { type: "string", enum: ["ambient", "chilled", "frozen"] },
    priority: { type: "string", enum: ["standard", "priority", "critical"] },
  },
  required: ["description", "refrigeration", "priority"],
  additionalProperties: false,
};

const dimensionsInputSchema: JsonSchema = {
  type: "object",
  properties: {
    vehicleType: { type: "string", minLength: 1 },
    lengthMeters: { type: "number", exclusiveMinimum: 0 },
    heightMeters: { type: "number", exclusiveMinimum: 0 },
    weightTonnes: { type: "number", exclusiveMinimum: 0 },
  },
  required: ["vehicleType", "lengthMeters", "heightMeters", "weightTonnes"],
  additionalProperties: false,
};

const vehicleCreateInputSchema: JsonSchema = {
  type: "object",
  properties: {
    fleetNumber: { type: "string", minLength: 1 },
    plate: { type: "string", minLength: 1 },
    label: { type: "string" },
    routeId: { type: "string" },
    dimensions: dimensionsInputSchema,
    cargo: cargoInputSchema,
    initialPosition: {
      type: "object",
      properties: {
        longitude: { type: "number", minimum: -180, maximum: 180 },
        latitude: { type: "number", minimum: -90, maximum: 90 },
      },
      required: ["longitude", "latitude"],
      additionalProperties: false,
    },
  },
  required: ["fleetNumber", "plate", "dimensions", "cargo"],
  additionalProperties: false,
};

const vehicleUpdateInputSchema: JsonSchema = {
  type: "object",
  properties: {
    vehicleId: { type: "string", minLength: 1 },
    plate: { type: "string", minLength: 1 },
    label: { type: "string" },
    dimensions: dimensionsInputSchema,
    cargo: cargoInputSchema,
  },
  required: ["vehicleId"],
  additionalProperties: false,
};

const vehicleAssignRouteInputSchema: JsonSchema = {
  type: "object",
  properties: {
    vehicleId: { type: "string", minLength: 1 },
    routeId: { type: "string" },
  },
  required: ["vehicleId"],
  additionalProperties: false,
};

function failure<T>(code: string, message: string): DomainResult<T> {
  return { ok: false, error: { code, message } };
}

function toolResponse<T>(result: DomainResult<T>): WebMcpToolResponse {
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function hasOnlyAllowedKeys(value: Record<string, unknown>, allowedKeys: string[]): boolean {
  const allowed = new Set(allowedKeys);
  return Object.keys(value).every((key) => allowed.has(key));
}

const REFRIGERATION_VALUES = new Set(["ambient", "chilled", "frozen"]);
const PRIORITY_VALUES = new Set(["standard", "priority", "critical"]);

function isFinitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isCargoInput(input: unknown): input is Omit<Cargo, "id"> {
  if (!isRecord(input)) return false;
  if (!hasOnlyAllowedKeys(input, ["description", "refrigeration", "priority"])) return false;
  if (typeof input.description !== "string" || input.description.trim().length === 0) return false;
  if (typeof input.refrigeration !== "string" || !REFRIGERATION_VALUES.has(input.refrigeration)) return false;
  if (typeof input.priority !== "string" || !PRIORITY_VALUES.has(input.priority)) return false;
  return true;
}

function isDimensionsInput(input: unknown): input is Dimensions {
  if (!isRecord(input)) return false;
  if (!hasOnlyAllowedKeys(input, ["vehicleType", "lengthMeters", "heightMeters", "weightTonnes"])) return false;
  if (typeof input.vehicleType !== "string" || input.vehicleType.trim().length === 0) return false;
  if (!isFinitePositive(input.lengthMeters) || input.lengthMeters > 50) return false;
  if (!isFinitePositive(input.heightMeters) || input.heightMeters > 10) return false;
  if (!isFinitePositive(input.weightTonnes) || input.weightTonnes > 200) return false;
  return true;
}

function isEmptyInput(input: unknown): boolean {
  return isRecord(input) && hasExactKeys(input, []);
}

function isVehicleInput(input: unknown): input is { vehicleId: string } {
  return isRecord(input) && hasExactKeys(input, ["vehicleId"]) && typeof input.vehicleId === "string" && input.vehicleId.trim().length > 0;
}

function isVehicleRenameInput(input: unknown): input is { vehicleId: string; label: string } {
  return isRecord(input) && hasExactKeys(input, ["vehicleId", "label"]) && typeof input.vehicleId === "string" && input.vehicleId.trim().length > 0 && typeof input.label === "string" && input.label.trim().length > 0;
}

function isInitialPositionInput(input: unknown): input is [number, number] | { longitude: number; latitude: number } {
  if (Array.isArray(input)) {
    if (input.length !== 2) return false;
    const [lon, lat] = input;
    if (typeof lon !== "number" || !Number.isFinite(lon) || lon < -180 || lon > 180) return false;
    if (typeof lat !== "number" || !Number.isFinite(lat) || lat < -90 || lat > 90) return false;
    return true;
  }
  if (!isRecord(input)) return false;
  if (!hasExactKeys(input, ["longitude", "latitude"])) return false;
  if (typeof input.longitude !== "number" || !Number.isFinite(input.longitude)) return false;
  if (typeof input.latitude !== "number" || !Number.isFinite(input.latitude)) return false;
  if (input.longitude < -180 || input.longitude > 180) return false;
  if (input.latitude < -90 || input.latitude > 90) return false;
  return true;
}

function isVehicleCreateInput(input: unknown): input is VehicleCreateCommand {
  if (!isRecord(input)) return false;
  if (!hasOnlyAllowedKeys(input, ["fleetNumber", "plate", "label", "routeId", "dimensions", "cargo", "initialPosition"])) return false;
  if (typeof input.fleetNumber !== "string" || input.fleetNumber.trim().length === 0) return false;
  if (typeof input.plate !== "string" || input.plate.trim().length === 0) return false;
  if (input.label !== undefined && (typeof input.label !== "string" || input.label.trim().length === 0)) return false;
  if (input.routeId !== undefined && typeof input.routeId !== "string") return false;
  if (!isDimensionsInput(input.dimensions)) return false;
  if (!isCargoInput(input.cargo)) return false;
  if (input.initialPosition !== undefined && !isInitialPositionInput(input.initialPosition)) return false;
  return true;
}

function isVehicleUpdateInput(input: unknown): input is VehicleUpdateCommand {
  if (!isRecord(input)) return false;
  if (!hasOnlyAllowedKeys(input, ["vehicleId", "plate", "label", "dimensions", "cargo"])) return false;
  if (typeof input.vehicleId !== "string" || input.vehicleId.trim().length === 0) return false;
  if (input.plate !== undefined && (typeof input.plate !== "string" || input.plate.trim().length === 0)) return false;
  if (input.label !== undefined && (typeof input.label !== "string" || input.label.trim().length === 0)) return false;
  if (input.dimensions !== undefined && !isDimensionsInput(input.dimensions)) return false;
  if (input.cargo !== undefined && !isCargoInput(input.cargo)) return false;
  return true;
}

function isVehicleAssignRouteInput(input: unknown): input is VehicleAssignRouteCommand {
  if (!isRecord(input)) return false;
  if (!hasOnlyAllowedKeys(input, ["vehicleId", "routeId"])) return false;
  if (typeof input.vehicleId !== "string" || input.vehicleId.trim().length === 0) return false;
  if (input.routeId !== undefined && typeof input.routeId !== "string") return false;
  return true;
}

function execute<T>(operation: () => DomainResult<T>): WebMcpToolResponse {
  try {
    return toolResponse(operation());
  } catch {
    return toolResponse(failure("operation-failed", "The operation could not be completed."));
  }
}

function publishScenario(operations: OperationsApi, onScenarioChange: ScenarioChangeHandler | undefined): void {
  if (onScenarioChange === undefined) return;
  try {
    const result = operations.scenarioCurrent();
    if (result.ok) onScenarioChange(result.data);
  } catch {
    // Tool output remains safe when an optional UI refresh callback fails.
  }
}

function executeRename(operations: OperationsApi, input: { vehicleId: string; label: string }, onScenarioChange: ScenarioChangeHandler | undefined): WebMcpToolResponse {
  try {
    const result = operations.vehicleRename(input);
    if (result.ok) publishScenario(operations, onScenarioChange);
    return toolResponse(result);
  } catch {
    return toolResponse(failure("operation-failed", "The operation could not be completed."));
  }
}

export function createOperationalTools(operations: OperationsApi, onScenarioChange?: ScenarioChangeHandler): WebMcpTool[] {
  return [
    {
      name: "scenario_current",
      description: "Gets the current operating region.",
      inputSchema: emptyInputSchema,
      execute: (input) => isEmptyInput(input) ? execute(operations.scenarioCurrent) : toolResponse(failure("invalid-input", "The tool input is invalid.")),
    },
    {
      name: "fleet_status",
      description: "Gets the current fleet status summary.",
      inputSchema: emptyInputSchema,
      execute: (input) => isEmptyInput(input) ? execute(operations.fleetStatus) : toolResponse(failure("invalid-input", "The tool input is invalid.")),
    },
    {
      name: "vehicle_get",
      description: "Gets a vehicle by its stable identifier.",
      inputSchema: vehicleGetInputSchema,
      execute: (input) => isVehicleInput(input) ? execute(() => operations.vehicleGet(input.vehicleId)) : toolResponse(failure("invalid-input", "The tool input is invalid.")),
    },
    {
      name: "rest_opportunities_compare",
      description: "Compares deterministic opportunities to give an eligible driver more rest while preserving the route, mandatory-rest protections, drive window, and delivery tolerance. Scheduling remains exclusively human.",
      inputSchema: vehicleGetInputSchema,
      execute: (input) => isVehicleInput(input) ? execute(() => operations.restOpportunitiesCompare(input.vehicleId)) : toolResponse(failure("invalid-input", "The tool input is invalid.")),
    },
    {
      name: "vehicle_rename",
      description: "Updates a vehicle label.",
      inputSchema: vehicleRenameInputSchema,
      execute: (input) => {
        if (!isVehicleRenameInput(input)) return toolResponse(failure("invalid-input", "The tool input is invalid."));
        return executeRename(operations, input, onScenarioChange);
      },
    },
    {
      name: "fleet_vehicle_create",
      description: "Creates a new vehicle with valid attributes, dimensions, cargo, and initial position.",
      inputSchema: vehicleCreateInputSchema,
      execute: (input: unknown) => {
        if (!isVehicleCreateInput(input)) return toolResponse(failure("invalid-input", "The tool input is invalid. Provide valid fleetNumber and plate."));
        try {
          const result = operations.vehicleCreate(input);
          if (result.ok) publishScenario(operations, onScenarioChange);
          return toolResponse(result);
        } catch {
          return toolResponse(failure("operation-failed", "The operation could not be completed."));
        }
      },
    },
    {
      name: "fleet_vehicle_update",
      description: "Updates an existing vehicle's dimensions, cargo, or label.",
      inputSchema: vehicleUpdateInputSchema,
      execute: (input: unknown) => {
        if (!isVehicleUpdateInput(input)) return toolResponse(failure("invalid-input", "The tool input is invalid. Provide valid vehicleId."));
        try {
          const result = operations.vehicleUpdate(input);
          if (result.ok) publishScenario(operations, onScenarioChange);
          return toolResponse(result);
        } catch {
          return toolResponse(failure("operation-failed", "The operation could not be completed."));
        }
      },
    },
    {
      name: "fleet_vehicle_assign_route",
      description: "Assigns or unassigns a route for a vehicle, updating position and checking for collisions.",
      inputSchema: vehicleAssignRouteInputSchema,
      execute: (input: unknown) => {
        if (!isVehicleAssignRouteInput(input)) return toolResponse(failure("invalid-input", "The tool input is invalid. Provide valid vehicleId."));
        try {
          const result = operations.vehicleAssignRoute(input);
          if (result.ok) publishScenario(operations, onScenarioChange);
          return toolResponse(result);
        } catch {
          return toolResponse(failure("operation-failed", "The operation could not be completed."));
        }
      },
    },
    {
      name: "fleet_vehicle_delete",
      description: "Deletes a vehicle from the active scenario.",
      inputSchema: vehicleGetInputSchema,
      execute: (input: unknown) => {
        try {
          if (!isVehicleInput(input)) return toolResponse(failure("invalid-input", "The tool input is invalid."));
          const result = operations.vehicleDelete(input.vehicleId);
          if (result.ok) publishScenario(operations, onScenarioChange);
          return toolResponse(result);
        } catch {
          return toolResponse(failure("operation-failed", "The operation could not be completed."));
        }
      },
    },
  ];
}
