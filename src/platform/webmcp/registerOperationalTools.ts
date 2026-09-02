import type { DomainResult, OperatingRegion, VehicleAssignRouteCommand, VehicleCreateCommand, VehicleUpdateCommand } from "../../domain/entities";
import type { OperationsApi } from "../../domain/operations/createOperationsApi";
import type { JsonSchema, WebMcpTool, WebMcpToolResponse } from "./webMcpTypes";

type ScenarioChangeHandler = (scenario: OperatingRegion) => void;

const emptyInputSchema: JsonSchema = { type: "object", properties: {}, additionalProperties: false };
const vehicleGetInputSchema: JsonSchema = { type: "object", properties: { vehicleId: { type: "string", minLength: 1 } }, required: ["vehicleId"], additionalProperties: false };
const vehicleRenameInputSchema: JsonSchema = { type: "object", properties: { vehicleId: { type: "string", minLength: 1 }, label: { type: "string", minLength: 1 } }, required: ["vehicleId", "label"], additionalProperties: false };

const vehicleCreateInputSchema: JsonSchema = {
  type: "object",
  properties: {
    fleetNumber: { type: "string", minLength: 1 },
    plate: { type: "string", minLength: 1 },
    label: { type: "string" },
    routeId: { type: "string" },
    cargo: {
      type: "object",
      properties: {
        description: { type: "string" },
        weightKg: { type: "number" },
        type: { type: "string", enum: ["ambient", "chilled", "frozen"] },
      },
    },
    dimensions: {
      type: "object",
      properties: {
        heightMeters: { type: "number" },
        widthMeters: { type: "number" },
        lengthMeters: { type: "number" },
      },
    },
  },
  required: ["fleetNumber", "plate"],
  additionalProperties: false,
};

const vehicleUpdateInputSchema: JsonSchema = {
  type: "object",
  properties: {
    vehicleId: { type: "string", minLength: 1 },
    plate: { type: "string" },
    label: { type: "string" },
    cargo: {
      type: "object",
      properties: {
        description: { type: "string" },
        weightKg: { type: "number" },
        type: { type: "string", enum: ["ambient", "chilled", "frozen"] },
      },
    },
    dimensions: {
      type: "object",
      properties: {
        heightMeters: { type: "number" },
        widthMeters: { type: "number" },
        lengthMeters: { type: "number" },
      },
    },
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

function isEmptyInput(input: unknown): boolean {
  return isRecord(input) && hasExactKeys(input, []);
}

function isVehicleInput(input: unknown): input is { vehicleId: string } {
  return isRecord(input) && hasExactKeys(input, ["vehicleId"]) && typeof input.vehicleId === "string" && input.vehicleId.trim().length > 0;
}

function isVehicleRenameInput(input: unknown): input is { vehicleId: string; label: string } {
  return isRecord(input) && hasExactKeys(input, ["vehicleId", "label"]) && typeof input.vehicleId === "string" && input.vehicleId.trim().length > 0 && typeof input.label === "string" && input.label.trim().length > 0;
}

function isVehicleCreateInput(input: unknown): input is VehicleCreateCommand {
  if (!isRecord(input)) return false;
  if (typeof input.fleetNumber !== "string" || input.fleetNumber.trim().length === 0) return false;
  if (typeof input.plate !== "string" || input.plate.trim().length === 0) return false;
  if (input.label !== undefined && typeof input.label !== "string") return false;
  if (input.routeId !== undefined && typeof input.routeId !== "string") return false;
  if (input.dimensions !== undefined && !isRecord(input.dimensions)) return false;
  if (input.cargo !== undefined && !isRecord(input.cargo)) return false;
  return true;
}

function isVehicleUpdateInput(input: unknown): input is VehicleUpdateCommand {
  if (!isRecord(input)) return false;
  if (typeof input.vehicleId !== "string" || input.vehicleId.trim().length === 0) return false;
  if (input.plate !== undefined && typeof input.plate !== "string") return false;
  if (input.label !== undefined && typeof input.label !== "string") return false;
  if (input.dimensions !== undefined && !isRecord(input.dimensions)) return false;
  if (input.cargo !== undefined && !isRecord(input.cargo)) return false;
  return true;
}

function isVehicleAssignRouteInput(input: unknown): input is VehicleAssignRouteCommand {
  if (!isRecord(input)) return false;
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
  if (onScenarioChange === undefined) {
    return;
  }

  try {
    const result = operations.scenarioCurrent();
    if (result.ok) {
      onScenarioChange(result.data);
    }
  } catch {
    // Tool output remains safe when an optional UI refresh callback fails.
  }
}

function executeRename(operations: OperationsApi, input: { vehicleId: string; label: string }, onScenarioChange: ScenarioChangeHandler | undefined): WebMcpToolResponse {
  try {
    const result = operations.vehicleRename(input);
    if (result.ok) {
      publishScenario(operations, onScenarioChange);
    }
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
      name: "vehicle_rename",
      description: "Updates a vehicle label.",
      inputSchema: vehicleRenameInputSchema,
      execute: (input) => {
        if (!isVehicleRenameInput(input)) {
          return toolResponse(failure("invalid-input", "The tool input is invalid."));
        }

        return executeRename(operations, input, onScenarioChange);
      },
    },
    {
      name: "fleet_vehicle_create",
      description: "Creates a new vehicle with valid attributes, dimensions, cargo, and initial position.",
      inputSchema: vehicleCreateInputSchema,
      execute: (input: unknown) => {
        if (!isVehicleCreateInput(input)) {
          return toolResponse(failure("invalid-input", "The tool input is invalid. Provide valid fleetNumber and plate."));
        }
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
        if (!isVehicleUpdateInput(input)) {
          return toolResponse(failure("invalid-input", "The tool input is invalid. Provide valid vehicleId."));
        }
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
        if (!isVehicleAssignRouteInput(input)) {
          return toolResponse(failure("invalid-input", "The tool input is invalid. Provide valid vehicleId."));
        }
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
