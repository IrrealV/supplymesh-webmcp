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
    const schema = { type: "object", properties: {}, additionalProperties: false };
    const execute = (): ToolResult => ({ content: [{ type: "text", text: "{}" }] });
    await context.registerTool({ name: "native_signal_left", description: "Temporary signal isolation evidence.", inputSchema: schema, execute }, { signal: left.signal });
    await context.registerTool({ name: "native_signal_right", description: "Temporary signal isolation evidence.", inputSchema: schema, execute }, { signal: right.signal });
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
      if (document.querySelector(".console-shell") !== null) return count !== 7;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error("The console did not render after native registration.");
  });
  assert(!registrationViolation, "The console rendered before all mandatory native tools registered.");

  const registered = await tools(page);
  const names = registered.map(({ name }) => name).sort();
  assert(JSON.stringify(names) === JSON.stringify(["fleet_status", "recovery_operations_context", "recovery_options_compare", "recovery_plan_stage", "scenario_current", "vehicle_get", "vehicle_rename"]), `Unexpected native tools: ${names.join(", ")}`);
  const schemas = Object.fromEntries(registered.map(({ inputSchema, name }) => [name, schema(inputSchema)]));
  assert(isDeepStrictEqual(schemas.scenario_current, { type: "object", properties: {}, additionalProperties: false }), `scenario_current schema changed: ${JSON.stringify(schemas.scenario_current)}`);
  assert(isDeepStrictEqual(schemas.fleet_status, { type: "object", properties: {}, additionalProperties: false }), `fleet_status schema changed: ${JSON.stringify(schemas.fleet_status)}`);
  assert(isDeepStrictEqual(schemas.vehicle_get, { type: "object", properties: { vehicleId: { type: "string", minLength: 1 } }, required: ["vehicleId"], additionalProperties: false }), `vehicle_get schema changed: ${JSON.stringify(schemas.vehicle_get)}`);
  assert(isDeepStrictEqual(schemas.vehicle_rename, { type: "object", properties: { vehicleId: { type: "string", minLength: 1 }, label: { type: "string", minLength: 1 } }, required: ["vehicleId", "label"], additionalProperties: false }), `vehicle_rename schema changed: ${JSON.stringify(schemas.vehicle_rename)}`);
  assert(isDeepStrictEqual(schemas.recovery_operations_context, { type: "object", properties: {}, additionalProperties: false }), `recovery_operations_context schema changed: ${JSON.stringify(schemas.recovery_operations_context)}`);
  assert(isDeepStrictEqual(schemas.recovery_options_compare, { type: "object", properties: {}, additionalProperties: false }), `recovery_options_compare schema changed: ${JSON.stringify(schemas.recovery_options_compare)}`);
  assert(isDeepStrictEqual(schemas.recovery_plan_stage, { type: "object", properties: { selectedOptionId: { type: "string", minLength: 1 } }, required: ["selectedOptionId"], additionalProperties: false }), `recovery_plan_stage schema changed: ${JSON.stringify(schemas.recovery_plan_stage)}`);
  const signalIsolation = await verifySignalIsolation(page);
  assert(signalIsolation.leftRetired && signalIsolation.rightSurvived && signalIsolation.rightRetired, `Native AbortSignal isolation failed: ${JSON.stringify(signalIsolation)}`);
  console.log(JSON.stringify({ nativeSignalIsolation: signalIsolation }));

  const fleet = await execute(page, "fleet_status", {});
  assert(JSON.stringify(fleet).includes('"total":15'), "Native fleet query did not return 15 vehicles.");
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

  const cleanup = await page.evaluate(async () => {
    type Context = { getTools(): Promise<NativeTool[]> };
    const context = (document as unknown as { modelContext: Context }).modelContext;
    const before = (await context.getTools()).length;
    window.dispatchEvent(new Event("beforeunload"));
    for (let attempt = 0; attempt < 100 && (await context.getTools()).length !== 0; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 10));
    return { after: (await context.getTools()).length, before };
  });
  assert(cleanup.before === 7 && cleanup.after === 0, `Native cleanup was ${cleanup.before}→${cleanup.after}, expected 7→0.`);
  assert(errors.length === 0, `Browser errors: ${errors.join(" | ")}`);
  console.log(JSON.stringify({ browser: await browser.version(), cleanup: "7→0", errors: 0, registrationBeforeRender: true, schemas: 7, signalIsolation, tools: names }));
} finally {
  await browser.close();
}
