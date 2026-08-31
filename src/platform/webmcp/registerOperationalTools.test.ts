import { describe, expect, it } from "vitest";
import type { OperationsApi } from "../../domain/operations/createOperationsApi";
import type { DomainResult, FleetStatus, OperatingRegion, Vehicle } from "../../domain/entities";
import { createOperationsApi } from "../../domain/operations/createOperationsApi";
import { createZustandScenarioRepository } from "../../scenario/state/createZustandScenarioRepository";
import { createOperationalTools } from "./registerOperationalTools";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function toolResult(tool: ReturnType<typeof createOperationalTools>[number], input: unknown): DomainResult<unknown> {
  const response = tool.execute(input);
  expect(response.content).toHaveLength(1);
  expect(response.content[0].type).toBe("text");
  return JSON.parse(response.content[0].text) as DomainResult<unknown>;
}

function failingOperations(): OperationsApi {
  const unavailable = <T>(): DomainResult<T> => {
    throw new Error("credential=not-for-tool-output");
  };

  return {
    assessAuthoritativeVerticalClearance: () => {
      throw new Error("credential=not-for-tool-output");
    },
    fleetStatus: (): DomainResult<FleetStatus> => unavailable(),
    scenarioCurrent: (): DomainResult<OperatingRegion> => unavailable(),
    unit211PreDispatchContext: () => {
      throw new Error("credential=not-for-tool-output");
    },
    vehicleDelete: (): DomainResult<Vehicle> => unavailable(),
    vehicleGet: (): DomainResult<Vehicle> => unavailable(),
    vehicleRename: (): DomainResult<Vehicle> => unavailable(),
  };
}

describe("createOperationalTools", () => {
  it("should expose exactly the four documented schemas and JSON text envelope", () => {
    const tools = createOperationalTools(createOperationsApi(createZustandScenarioRepository(new MemoryStorage())));

    expect(tools.map((tool) => ({ name: tool.name, inputSchema: tool.inputSchema }))).toStrictEqual([
      { name: "scenario_current", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
      { name: "fleet_status", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
      { name: "vehicle_get", inputSchema: { type: "object", properties: { vehicleId: { type: "string", minLength: 1 } }, required: ["vehicleId"], additionalProperties: false } },
      { name: "vehicle_rename", inputSchema: { type: "object", properties: { vehicleId: { type: "string", minLength: 1 }, label: { type: "string", minLength: 1 } }, required: ["vehicleId", "label"], additionalProperties: false } },
    ]);

    const result = toolResult(tools[0], {});
    expect(result.ok).toBe(true);
  });

  it("should preserve shared UI query and rename outcomes through tools", () => {
    const operations = createOperationsApi(createZustandScenarioRepository(new MemoryStorage()));
    let publishedScenario: OperatingRegion | undefined;
    const tools = createOperationalTools(operations, (scenario) => {
      publishedScenario = scenario;
    });
    const scenarioResult = operations.scenarioCurrent();
    const vehicleId = scenarioResult.ok ? scenarioResult.data.vehicles[0].internalId : "";
    const vehicleGet = tools.find((tool) => tool.name === "vehicle_get");
    const vehicleRename = tools.find((tool) => tool.name === "vehicle_rename");

    if (vehicleGet === undefined || vehicleRename === undefined) {
      throw new Error("Required WebMCP tools were not created.");
    }

    expect(toolResult(vehicleGet, { vehicleId })).toStrictEqual(operations.vehicleGet(vehicleId));
    expect(toolResult(vehicleRename, { vehicleId, label: "Night Dispatch" })).toStrictEqual(operations.vehicleRename({ vehicleId, label: "Night Dispatch" }));
    expect(publishedScenario?.vehicles.find((vehicle) => vehicle.internalId === vehicleId)?.label).toBe("Night Dispatch");
  });

  it("should reject invalid input and prevent operational diagnostics from reaching tool output", () => {
    const tools = createOperationalTools(failingOperations());
    const vehicleGet = tools.find((tool) => tool.name === "vehicle_get");
    const scenarioCurrent = tools.find((tool) => tool.name === "scenario_current");

    if (vehicleGet === undefined || scenarioCurrent === undefined) {
      throw new Error("Required WebMCP tools were not created.");
    }

    expect(toolResult(vehicleGet, { vehicleId: "", unexpected: true })).toStrictEqual({ ok: false, error: { code: "invalid-input", message: "The tool input is invalid." } });
    const result = toolResult(scenarioCurrent, {});
    expect(result).toStrictEqual({ ok: false, error: { code: "operation-failed", message: "The operation could not be completed." } });
    expect(JSON.stringify(result)).not.toContain("credential");
  });
});
