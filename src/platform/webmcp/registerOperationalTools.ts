import type { DomainResult, OperatingRegion } from "../../domain/entities";
import type { OperationsApi } from "../../domain/operations/createOperationsApi";
import type { JsonSchema, WebMcpTool, WebMcpToolResponse } from "./webMcpTypes";

type ScenarioChangeHandler = (scenario: OperatingRegion) => void;

const emptyInputSchema: JsonSchema = { type: "object", properties: {}, additionalProperties: false };
const vehicleGetInputSchema: JsonSchema = { type: "object", properties: { vehicleId: { type: "string", minLength: 1 } }, required: ["vehicleId"], additionalProperties: false };
const vehicleRenameInputSchema: JsonSchema = { type: "object", properties: { vehicleId: { type: "string", minLength: 1 }, label: { type: "string", minLength: 1 } }, required: ["vehicleId", "label"], additionalProperties: false };

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
      name: "scenario_region_select",
      description: "Switches the operational region for the scenario.",
      inputSchema: { type: "object", properties: { regionId: { type: "string" } }, required: ["regionId"], additionalProperties: false },
      execute: (input: any) => {
        try {
          if (typeof input?.regionId !== "string") return toolResponse(failure("invalid-input", "Invalid regionId"));
          const result = operations.scenarioRegionSelect(input.regionId);
          if (result.ok) publishScenario(operations, onScenarioChange);
          return toolResponse(result);
        } catch {
          return toolResponse(failure("operation-failed", "The operation could not be completed."));
        }
      },
    },
    {
      name: "avoidance_area_set",
      description: "Sets an active avoidance zone constraint.",
      inputSchema: { type: "object", properties: { radiusMeters: { type: "number" }, coordinates: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 }, enabled: { type: "boolean" } }, required: ["enabled"], additionalProperties: false },
      execute: (input: any) => {
        try {
          const store = (globalThis as any).__UI_COORDINATION_STORE__ || require("../../app/state/useUiCoordinationStore").useUiCoordinationStore;
          if (input.enabled && input.coordinates && input.radiusMeters) {
            store.getState().setAvoidanceArea({ radiusMeters: input.radiusMeters, coordinates: input.coordinates });
          } else {
            store.getState().setAvoidanceArea(null);
          }
          return toolResponse({ ok: true, data: { success: true } });
        } catch (e) {
          return toolResponse(failure("operation-failed", "Could not set avoidance area."));
        }
      },
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
      description: "Creates a new vehicle.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      execute: (input: any) => {
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
      description: "Updates an existing vehicle.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      execute: (input: any) => {
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
      description: "Assigns a route to a vehicle.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      execute: (input: any) => {
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
      description: "Deletes a vehicle.",
      inputSchema: vehicleGetInputSchema,
      execute: (input: any) => {
        try {
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
