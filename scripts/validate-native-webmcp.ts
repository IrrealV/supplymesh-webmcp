import { chromium, type Page } from "@playwright/test";
import { isDeepStrictEqual } from "node:util";

type NativeTool = { description: string; inputSchema: unknown; name: string };
type ToolResult = { content: [{ text: string; type: "text" }] };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function schema(value: unknown): unknown {
  return typeof value === "string" ? JSON.parse(value) as unknown : value;
}

async function tools(page: Page): Promise<NativeTool[]> {
  return page.evaluate(async () => {
    type Context = { getTools(): Promise<NativeTool[]> };
    const context = (document as unknown as { modelContext?: Context }).modelContext;
    if (context === undefined) throw new Error("Native document.modelContext is unavailable.");
    return context.getTools();
  });
}

async function execute(page: Page, name: string, input: unknown): Promise<unknown> {
  const response = await page.evaluate(async ({ input, name }) => {
    type RegisteredTool = NativeTool;
    type Context = { executeTool(tool: RegisteredTool, input: string): Promise<string | ToolResult>; getTools(): Promise<RegisteredTool[]> };
    const context = (document as unknown as { modelContext?: Context }).modelContext;
    if (context === undefined) throw new Error("Native document.modelContext is unavailable.");
    const tool = (await context.getTools()).find((candidate) => candidate.name === name);
    if (tool === undefined) throw new Error(`Native tool ${name} is unavailable.`);
    const result = await context.executeTool(tool, JSON.stringify(input));
    return typeof result === "string" ? JSON.parse(result) as ToolResult : result;
  }, { input, name });
  assert(response.content.length === 1 && response.content[0].type === "text", `${name} returned an invalid envelope.`);
  return JSON.parse(response.content[0].text) as unknown;
}

async function verifySignalIsolation(page: Page): Promise<{ leftRetired: boolean; rightRetired: boolean; rightSurvived: boolean }> {
  return page.evaluate(async () => {
    type TemporaryTool = NativeTool & { execute(): ToolResult };
    type Context = { registerTool(tool: TemporaryTool, options: { signal: AbortSignal }): Promise<void> | void; getTools(): Promise<NativeTool[]> };
    const context = (document as unknown as { modelContext?: Context }).modelContext;
    if (context === undefined) throw new Error("Native document.modelContext is unavailable.");
    const left = new AbortController();
    const right = new AbortController();
    const inputSchema = { type: "object", properties: {}, additionalProperties: false };
    const execute = (): ToolResult => ({ content: [{ type: "text", text: "{}" }] });
    await context.registerTool({ name: "native_signal_left", description: "Temporary signal isolation evidence.", inputSchema, execute }, { signal: left.signal });
    await context.registerTool({ name: "native_signal_right", description: "Temporary signal isolation evidence.", inputSchema, execute }, { signal: right.signal });
    left.abort();
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const active = (await context.getTools()).map(({ name }) => name);
      if (!active.includes("native_signal_left") && active.includes("native_signal_right")) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const afterLeft = (await context.getTools()).map(({ name }) => name);
    right.abort();
    for (let attempt = 0; attempt < 100 && (await context.getTools()).some(({ name }) => name === "native_signal_right"); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 10));
    const afterRight = (await context.getTools()).map(({ name }) => name);
    return { leftRetired: !afterLeft.includes("native_signal_left"), rightSurvived: afterLeft.includes("native_signal_right"), rightRetired: !afterRight.includes("native_signal_right") };
  });
}

const vehicleInputSchema = {
  type: "object",
  properties: { vehicleId: { type: "string", minLength: 1 } },
  required: ["vehicleId"],
  additionalProperties: false,
};
const dimensionsInputSchema = {
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
const cargoInputSchema = {
  type: "object",
  properties: {
    description: { type: "string", minLength: 1 },
    refrigeration: { type: "string", enum: ["ambient", "chilled", "frozen"] },
    priority: { type: "string", enum: ["standard", "priority", "critical"] },
  },
  required: ["description", "refrigeration", "priority"],
  additionalProperties: false,
};

const browser = await chromium.launch({
  args: ["--enable-features=WebMCP"],
  executablePath: "/usr/bin/chromium",
  headless: true,
});
const errors: string[] = [];

try {
  const page = await browser.newPage({ reducedMotion: "reduce", viewport: { height: 900, width: 1440 } });
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  const registrationViolation = await page.evaluate(async () => {
    type Context = { getTools(): Promise<NativeTool[]> };
    const context = (document as unknown as { modelContext?: Context }).modelContext;
    if (context === undefined) throw new Error("Native document.modelContext is unavailable.");
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const count = (await context.getTools()).length;
      if (document.querySelector(".console-shell") !== null) return count !== 12;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error("The console did not render after native registration.");
  });
  assert(!registrationViolation, "The console rendered before all mandatory native tools registered.");

  const registered = await tools(page);
  const names = registered.map(({ name }) => name).sort();
  const expectedNames = [
    "fleet_status",
    "fleet_vehicle_assign_route",
    "fleet_vehicle_create",
    "fleet_vehicle_delete",
    "fleet_vehicle_update",
    "recovery_operations_context",
    "recovery_options_compare",
    "recovery_plan_stage",
    "rest_opportunities_compare",
    "scenario_current",
    "vehicle_get",
    "vehicle_rename",
  ];
  assert(JSON.stringify(names) === JSON.stringify(expectedNames), `Unexpected native tools: ${names.join(", ")}`);
  assert(!names.some((name) => /rest.*schedule|schedule.*rest|rest.*approve/i.test(name)), "Native WebMCP exposed forbidden rest scheduling authority.");

  const schemas = Object.fromEntries(registered.map(({ inputSchema, name }) => [name, schema(inputSchema)]));
  assert(isDeepStrictEqual(schemas.scenario_current, { type: "object", properties: {}, additionalProperties: false }), `scenario_current schema changed: ${JSON.stringify(schemas.scenario_current)}`);
  assert(isDeepStrictEqual(schemas.fleet_status, { type: "object", properties: {}, additionalProperties: false }), `fleet_status schema changed: ${JSON.stringify(schemas.fleet_status)}`);
  assert(isDeepStrictEqual(schemas.vehicle_get, vehicleInputSchema), `vehicle_get schema changed: ${JSON.stringify(schemas.vehicle_get)}`);
  assert(isDeepStrictEqual(schemas.rest_opportunities_compare, vehicleInputSchema), `rest_opportunities_compare schema changed: ${JSON.stringify(schemas.rest_opportunities_compare)}`);
  assert(isDeepStrictEqual(schemas.vehicle_rename, { type: "object", properties: { vehicleId: { type: "string", minLength: 1 }, label: { type: "string", minLength: 1 } }, required: ["vehicleId", "label"], additionalProperties: false }), `vehicle_rename schema changed: ${JSON.stringify(schemas.vehicle_rename)}`);
  assert(isDeepStrictEqual(schemas.recovery_operations_context, { type: "object", properties: {}, additionalProperties: false }), `recovery_operations_context schema changed: ${JSON.stringify(schemas.recovery_operations_context)}`);
  assert(isDeepStrictEqual(schemas.recovery_options_compare, { type: "object", properties: {}, additionalProperties: false }), `recovery_options_compare schema changed: ${JSON.stringify(schemas.recovery_options_compare)}`);
  assert(isDeepStrictEqual(schemas.recovery_plan_stage, { type: "object", properties: { selectedOptionId: { type: "string", minLength: 1 } }, required: ["selectedOptionId"], additionalProperties: false }), `recovery_plan_stage schema changed: ${JSON.stringify(schemas.recovery_plan_stage)}`);

  assert(isDeepStrictEqual(schemas.fleet_vehicle_create, {
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
  }), `fleet_vehicle_create schema changed: ${JSON.stringify(schemas.fleet_vehicle_create)}`);
  assert(isDeepStrictEqual(schemas.fleet_vehicle_update, {
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
  }), `fleet_vehicle_update schema changed: ${JSON.stringify(schemas.fleet_vehicle_update)}`);
  assert(isDeepStrictEqual(schemas.fleet_vehicle_assign_route, {
    type: "object",
    properties: { vehicleId: { type: "string", minLength: 1 }, routeId: { type: "string" } },
    required: ["vehicleId"],
    additionalProperties: false,
  }), `fleet_vehicle_assign_route schema changed: ${JSON.stringify(schemas.fleet_vehicle_assign_route)}`);
  assert(isDeepStrictEqual(schemas.fleet_vehicle_delete, vehicleInputSchema), `fleet_vehicle_delete schema changed: ${JSON.stringify(schemas.fleet_vehicle_delete)}`);

  const signalIsolation = await verifySignalIsolation(page);
  assert(signalIsolation.leftRetired && signalIsolation.rightSurvived && signalIsolation.rightRetired, `Native AbortSignal isolation failed: ${JSON.stringify(signalIsolation)}`);

  const fleet = await execute(page, "fleet_status", {});
  assert(JSON.stringify(fleet).includes('"total":15'), "Native fleet query did not return 15 vehicles.");

  const restComparison = await execute(page, "rest_opportunities_compare", { vehicleId: "vehicle-012" }) as {
    ok?: boolean;
    data?: {
      recommendedOptionId?: string;
      policy?: { humanSchedulesRest?: boolean; mandatoryRestIsNeverReduced?: boolean };
      options?: Array<{ extraRestMinutes?: number; feasible?: boolean }>;
    };
  };
  assert(restComparison.ok === true, "Native rest-opportunity comparison failed.");
  assert(restComparison.data?.recommendedOptionId === "rest-window-max-55", "Native rest comparison selected the wrong recommendation.");
  assert(restComparison.data?.policy?.humanSchedulesRest === true && restComparison.data?.policy?.mandatoryRestIsNeverReduced === true, "Native rest policy lost the human scheduling boundary.");
  assert(JSON.stringify(restComparison.data?.options?.map(({ extraRestMinutes, feasible }) => ({ extraRestMinutes, feasible }))) === JSON.stringify([
    { extraRestMinutes: 40, feasible: true },
    { extraRestMinutes: 55, feasible: true },
    { extraRestMinutes: 70, feasible: false },
  ]), "Native rest comparison returned unexpected candidates.");
  const invalidRest = await execute(page, "rest_opportunities_compare", { vehicleId: "vehicle-012", tolerance: 999 });
  assert(JSON.stringify(invalidRest).includes('"code":"invalid-input"'), "Native rest comparison accepted agent-supplied tolerance.");

  const original = await execute(page, "vehicle_get", { vehicleId: "vehicle-002" }) as { data?: { label?: string }; ok?: boolean };
  assert(original.ok === true && typeof original.data?.label === "string", "Native vehicle query failed.");
  const renamed = await execute(page, "vehicle_rename", { vehicleId: "vehicle-002", label: "Native Release Evidence" });
  assert(JSON.stringify(renamed).includes('"label":"Native Release Evidence"'), "Native rename failed.");
  await page.getByRole("button", { exact: true, name: "Native Release Evidence" }).waitFor();
  const parity = await execute(page, "vehicle_get", { vehicleId: "vehicle-002" });
  assert(JSON.stringify(parity).includes('"label":"Native Release Evidence"'), "Native query/UI parity failed.");
  const invalid = await execute(page, "vehicle_rename", { vehicleId: "vehicle-002", label: "N".repeat(65) });
  assert(JSON.stringify(invalid).includes('"code":"invalid-label"'), "Native invalid-label result was not structured.");
  await execute(page, "vehicle_rename", { vehicleId: "vehicle-002", label: original.data.label });
  await page.getByRole("button", { exact: true, name: original.data.label }).waitFor();

  const createResult = await execute(page, "fleet_vehicle_create", {
    fleetNumber: "FM-900",
    plate: "9000-NVT",
    label: "Native Vehicle Unit",
    dimensions: { vehicleType: "Semi-trailer", heightMeters: 4.0, lengthMeters: 16.5, weightTonnes: 32 },
    cargo: { description: "High-value electronics", refrigeration: "ambient", priority: "priority" },
  }) as { data?: { internalId: string; label: string; status: string }; ok?: boolean };
  assert(createResult.ok === true && typeof createResult.data?.internalId === "string", "Native vehicle creation failed.");
  const createdId = createResult.data.internalId;
  await page.getByRole("button", { exact: true, name: "Native Vehicle Unit" }).waitFor();
  const getCreated = await execute(page, "vehicle_get", { vehicleId: createdId }) as { data?: { status: string; label: string }; ok?: boolean };
  assert(getCreated.ok === true && getCreated.data?.status === "resting", "Native created vehicle not resting.");

  const updateResult = await execute(page, "fleet_vehicle_update", {
    vehicleId: createdId,
    label: "Updated Native Vehicle",
    dimensions: { vehicleType: "Rigid box truck", heightMeters: 3.5, lengthMeters: 12.0, weightTonnes: 18 },
  }) as { data?: { label: string }; ok?: boolean };
  assert(updateResult.ok === true && updateResult.data?.label === "Updated Native Vehicle", "Native vehicle update failed.");
  await page.getByRole("button", { exact: true, name: "Updated Native Vehicle" }).waitFor();

  const unassignResult = await execute(page, "fleet_vehicle_assign_route", { vehicleId: "vehicle-012", routeId: "" }) as { data?: { status: string; routeId: string }; ok?: boolean };
  assert(unassignResult.ok === true && unassignResult.data?.status === "resting", "Native route unassign failed.");
  const assignResult = await execute(page, "fleet_vehicle_assign_route", { vehicleId: createdId, routeId: "route-012" }) as { data?: { status: string; routeId: string }; ok?: boolean };
  assert(assignResult.ok === true && assignResult.data?.status === "driving" && assignResult.data?.routeId === "route-012", `Native route assignment to new vehicle failed: ${JSON.stringify(assignResult)}`);
  const scenarioCheck = await execute(page, "scenario_current", {}) as { data?: { routes: Array<{ id: string; vehicleId: string }> }; ok?: boolean };
  assert(scenarioCheck.ok === true, "Native scenario_current query failed.");
  const assignedRouteObj = scenarioCheck.data?.routes.find((route) => route.id === "route-012");
  assert(assignedRouteObj?.vehicleId === createdId, `Route.vehicleId was not updated to ${createdId}, got ${assignedRouteObj?.vehicleId}`);

  const deleteResult = await execute(page, "fleet_vehicle_delete", { vehicleId: createdId }) as { ok?: boolean };
  assert(deleteResult.ok === true, "Native vehicle deletion failed.");
  const afterDelete = await execute(page, "vehicle_get", { vehicleId: createdId }) as { ok?: boolean };
  assert(afterDelete.ok === false, "Deleted vehicle still returned by vehicle_get.");
  await execute(page, "fleet_vehicle_assign_route", { vehicleId: "vehicle-012", routeId: "route-012" });

  const cleanup = await page.evaluate(async () => {
    type Context = { getTools(): Promise<NativeTool[]> };
    const context = (document as unknown as { modelContext: Context }).modelContext;
    const before = (await context.getTools()).length;
    window.dispatchEvent(new Event("beforeunload"));
    for (let attempt = 0; attempt < 100 && (await context.getTools()).length !== 0; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 10));
    return { after: (await context.getTools()).length, before };
  });
  assert(cleanup.before === 12 && cleanup.after === 0, `Native cleanup was ${cleanup.before}→${cleanup.after}, expected 12→0.`);
  assert(errors.length === 0, `Browser errors: ${errors.join(" | ")}`);
  console.log(JSON.stringify({ browser: await browser.version(), cleanup: "12→0", errors: 0, registrationBeforeRender: true, schemas: 12, signalIsolation, tools: names }));
} finally {
  await browser.close();
}
