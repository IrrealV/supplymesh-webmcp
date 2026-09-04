import { describe, expect, it } from "vitest";
import type { OperationsApi } from "../../domain/operations/createOperationsApi";
import type { RestOpportunityComparison } from "../../domain/operations/restOpportunities";
import type { DomainResult, FleetStatus, OperatingRegion, Vehicle } from "../../domain/entities";
import { createOperationsApi } from "../../domain/operations/createOperationsApi";
import { createZustandScenarioRepository } from "../../scenario/state/createZustandScenarioRepository";
import { createOperationalTools } from "./registerOperationalTools";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

async function toolResult<T = unknown>(tool: ReturnType<typeof createOperationalTools>[number], input: unknown): Promise<DomainResult<T>> {
  const response = await tool.execute(input);
  expect(response.content).toHaveLength(1);
  expect(response.content[0].type).toBe("text");
  return JSON.parse(response.content[0].text) as DomainResult<T>;
}

function failingOperations(): OperationsApi {
  const unavailable = <T>(): DomainResult<T> => { throw new Error("credential=not-for-tool-output"); };
  return {
    assessAuthoritativeVerticalClearance: () => { throw new Error("credential=not-for-tool-output"); },
    fleetStatus: (): DomainResult<FleetStatus> => unavailable(),
    scenarioCurrent: (): DomainResult<OperatingRegion> => unavailable(),
    scenarioRegionSelect: (): DomainResult<OperatingRegion> => unavailable(),
    unit211PreDispatchContext: () => { throw new Error("credential=not-for-tool-output"); },
    restOpportunitiesCompare: (): DomainResult<RestOpportunityComparison> => unavailable(),
    restOpportunitySchedule: (): DomainResult<Vehicle> => unavailable(),
    restOpportunityClear: (): DomainResult<Vehicle> => unavailable(),
    vehicleDelete: (): DomainResult<Vehicle> => unavailable(),
    vehicleGet: (): DomainResult<Vehicle> => unavailable(),
    vehicleRename: (): DomainResult<Vehicle> => unavailable(),
    vehicleCreate: (): DomainResult<Vehicle> => unavailable(),
    vehicleUpdate: (): DomainResult<Vehicle> => unavailable(),
    vehicleAssignRoute: (): DomainResult<Vehicle> => unavailable(),
  };
}

describe("createOperationalTools", () => {
  it("should expose exactly the 9 operational schemas and JSON text envelopes on the live UI surface", async () => {
    const tools = createOperationalTools(createOperationsApi(createZustandScenarioRepository(new MemoryStorage())), () => undefined);
    expect(tools.map((tool) => tool.name)).toStrictEqual([
      "scenario_current",
      "fleet_status",
      "vehicle_get",
      "rest_opportunities_compare",
      "vehicle_rename",
      "fleet_vehicle_create",
      "fleet_vehicle_update",
      "fleet_vehicle_assign_route",
      "fleet_vehicle_delete",
    ]);
    expect((await toolResult(tools[0], {})).ok).toBe(true);
  });

  it("should compare extra rest without exposing scheduling authority to WebMCP", async () => {
    const tools = createOperationalTools(createOperationsApi(createZustandScenarioRepository(new MemoryStorage())), () => undefined);
    const compareTool = tools.find((tool) => tool.name === "rest_opportunities_compare")!;
    const result = await toolResult<RestOpportunityComparison>(compareTool, { vehicleId: "vehicle-012" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.recommendedOptionId).toBe("rest-window-max-55");
    expect(result.data.options.map(({ extraRestMinutes, feasible }) => ({ extraRestMinutes, feasible }))).toEqual([
      { extraRestMinutes: 40, feasible: true },
      { extraRestMinutes: 55, feasible: true },
      { extraRestMinutes: 70, feasible: false },
    ]);
    expect(result.data.policy).toMatchObject({ mandatoryRestIsNeverReduced: true, humanSchedulesRest: true });
    expect(tools.some(({ name }) => /rest.*schedule|schedule.*rest|rest.*approve/i.test(name))).toBe(false);
    expect(await toolResult(compareTool, { vehicleId: "vehicle-012", tolerance: 999 })).toMatchObject({ ok: false, error: { code: "invalid-input" } });
  });

  it("should execute fleet_vehicle_create, update, assign, and delete with real inputs", async () => {
    const operations = createOperationsApi(createZustandScenarioRepository(new MemoryStorage()));
    let publishedScenario: OperatingRegion | undefined;
    const tools = createOperationalTools(operations, (scenario) => { publishedScenario = scenario; });

    const createTool = tools.find((tool) => tool.name === "fleet_vehicle_create")!;
    const updateTool = tools.find((tool) => tool.name === "fleet_vehicle_update")!;
    const assignTool = tools.find((tool) => tool.name === "fleet_vehicle_assign_route")!;
    const deleteTool = tools.find((tool) => tool.name === "fleet_vehicle_delete")!;

    const createResult = await toolResult<Vehicle>(createTool, {
      fleetNumber: "Unit 999",
      plate: "9999-XYZ",
      label: "Support Unit",
      dimensions: { vehicleType: "Articulated curtain-sider", heightMeters: 3.8, lengthMeters: 16.0, weightTonnes: 24 },
      cargo: { description: "Spare parts", refrigeration: "ambient", priority: "standard" },
    });
    expect(createResult.ok).toBe(true);
    if (!createResult.ok) return;

    const createdVehicle = createResult.data;
    expect(createdVehicle.fleetNumber).toBe("Unit 999");
    expect(createdVehicle.status).toBe("resting");
    expect(createdVehicle.position.geometry.coordinates).toStrictEqual([-3.7038, 40.4168]);
    expect(createdVehicle.position.geometry.coordinates).not.toStrictEqual([0, 0]);
    expect(createdVehicle.timing.restDeadline.length).toBeGreaterThan(0);
    expect(publishedScenario?.vehicles.some((vehicle) => vehicle.internalId === createdVehicle.internalId)).toBe(true);

    const updateResult = await toolResult<Vehicle>(updateTool, {
      vehicleId: createdVehicle.internalId,
      label: "Updated Support Unit",
      dimensions: { vehicleType: "Articulated curtain-sider", heightMeters: 4.0, lengthMeters: 16.5, weightTonnes: 26 },
    });
    expect(updateResult.ok).toBe(true);
    if (!updateResult.ok) return;
    expect(updateResult.data.label).toBe("Updated Support Unit");
    expect(updateResult.data.dimensions.heightMeters).toBe(4.0);

    const collisionAssign = await toolResult<Vehicle>(assignTool, { vehicleId: createdVehicle.internalId, routeId: "route-011" });
    expect(collisionAssign.ok).toBe(false);
    if (!collisionAssign.ok) expect(collisionAssign.error.code).toBe("route-already-assigned");

    const deleteResult = await toolResult<Vehicle>(deleteTool, { vehicleId: createdVehicle.internalId });
    expect(deleteResult.ok).toBe(true);
    expect(publishedScenario?.vehicles.some((vehicle) => vehicle.internalId === createdVehicle.internalId)).toBe(false);
  });

  it("should reject invalid inputs and prevent operational diagnostics from leaking", async () => {
    const tools = createOperationalTools(failingOperations());
    const vehicleGet = tools.find((tool) => tool.name === "vehicle_get")!;
    const createTool = tools.find((tool) => tool.name === "fleet_vehicle_create")!;
    const updateTool = tools.find((tool) => tool.name === "fleet_vehicle_update")!;
    const scenarioCurrent = tools.find((tool) => tool.name === "scenario_current")!;

    expect(await toolResult(vehicleGet, { vehicleId: "", unexpected: true })).toStrictEqual({ ok: false, error: { code: "invalid-input", message: "The tool input is invalid." } });
    expect(await toolResult(createTool, { fleetNumber: "" })).toStrictEqual({ ok: false, error: { code: "invalid-input", message: "The tool input is invalid. Provide valid fleetNumber and plate." } });
    expect(await toolResult(createTool, {
      fleetNumber: "Unit 123",
      plate: "1234-ABC",
      dimensions: { vehicleType: "Semi", heightMeters: 4, lengthMeters: 16, weightTonnes: 20 },
      cargo: { description: "Goods", refrigeration: "ambient", priority: "standard" },
      unexpectedProp: "leak",
    })).toStrictEqual({ ok: false, error: { code: "invalid-input", message: "The tool input is invalid. Provide valid fleetNumber and plate." } });
    expect(await toolResult(createTool, {
      fleetNumber: "Unit 123",
      plate: "1234-ABC",
      dimensions: { vehicleType: "Semi", heightMeters: 4, lengthMeters: 16, weightTonnes: 20 },
      cargo: { description: "Goods", refrigeration: "solar-powered", priority: "standard" },
    })).toStrictEqual({ ok: false, error: { code: "invalid-input", message: "The tool input is invalid. Provide valid fleetNumber and plate." } });
    expect(await toolResult(updateTool, {
      vehicleId: "vehicle-001",
      dimensions: { vehicleType: "Semi", heightMeters: -1, lengthMeters: 16, weightTonnes: 20 },
    })).toStrictEqual({ ok: false, error: { code: "invalid-input", message: "The tool input is invalid. Provide valid vehicleId." } });

    const result = await toolResult(scenarioCurrent, {});
    expect(result).toStrictEqual({ ok: false, error: { code: "operation-failed", message: "The operation could not be completed." } });
    expect(JSON.stringify(result)).not.toContain("credential");
  });
});
