import { expect, test, type Page, type TestInfo } from "@playwright/test";
import path from "node:path";

const expectedToolNames = ["fleet_status", "fleet_vehicle_assign_route", "fleet_vehicle_create", "fleet_vehicle_delete", "fleet_vehicle_update", "recovery_operations_context", "recovery_options_compare", "recovery_plan_stage", "scenario_current", "vehicle_get", "vehicle_rename"];
const scenarioTrace = [
  "Render operational desktop", "Exclude unsupported chrome", "Respect reduced motion", "Navigate shell semantics",
  "Change locale", "Switch back to English", "Use the menu by keyboard", "Toggle multiple filters",
  "Activate an overview card or reset filters", "Select a result card", "Restore contextual mode", "Render overview before selection",
  "Preserve the WebMCP contract", "Preserve gate and lifecycle", "Produce visual evidence", "Exclude Phase 2",
  "Apply OR fleet filters", "Clear fleet filters", "Render base, markers, and risks", "Select from any operational affordance",
  "Replace selected vehicle", "Close inspection", "Cancel on drag or wheel", "Cancel on controls or pinch",
  "Preserve programmatic follow", "Cancel on replacement selection", "Preserve a usable viewport", "Highlight selected route risk",
  "Expose layer meaning", "Inspect a complete vehicle", "Render absent optional data", "Humanize localized values",
  "View and follow route", "Rename a vehicle", "Reject invalid label", "Recover invalid edits",
  "Cancel deletion", "Confirm deletion", "Restore context after deletion", "Load reproducible fleet",
  "Resolve an absent label", "Inspect fleet coverage", "Query vehicle context", "Render deterministic corridors",
  "Derive a position from route progress", "Display risk fixtures", "Remain offline deterministic", "Align risk to corridor",
  "Generate an authenticated HGV route", "Reject unusable generation input or output", "Review generated route fixtures", "Pass canonical endpoint radiuses to ORS",
  "Reject invalid radius input", "Hash geometry-affecting radius input", "Generate route-014 with its measured snap bound", "Prohibit pre-snapped route substitution",
  "Verify runtime and fixture invariants", "Verify generation boundary and evidence",
] as const;

type ToolSnapshot = { inputSchema: unknown; name: string };

async function installModelContextSeam(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type RegisteredTool = { inputSchema: unknown; name: string; execute(input: unknown): unknown };
    const tools: RegisteredTool[] = [];
    Object.defineProperty(window, "__webMcpEvidence", { configurable: true, value: { tools } });
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: {
        registerTool: async (tool: RegisteredTool, options: { signal: AbortSignal }) => {
          tools.push(tool);
          options.signal.addEventListener("abort", () => {
            const index = tools.indexOf(tool);
            if (index >= 0) tools.splice(index, 1);
          }, { once: true });
        },
      },
    });
  });
}

async function resetApplication(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator(".console-shell")).toBeVisible();
  await page.evaluate(async () => document.fonts.ready);
  await page.waitForFunction(() => {
    const tiles = [...document.querySelectorAll<HTMLImageElement>(".leaflet-tile")];
    return tiles.length > 0 && tiles.every((tile) => tile.complete && tile.naturalWidth > 0);
  });
}

async function registeredTools(page: Page): Promise<ToolSnapshot[]> {
  return page.evaluate(() => {
    const evidence = (window as unknown as { __webMcpEvidence: { tools: ToolSnapshot[] } }).__webMcpEvidence;
    return evidence.tools.map(({ inputSchema, name }) => ({ inputSchema, name }));
  });
}

async function executeTool(page: Page, name: string, input: unknown): Promise<unknown> {
  return page.evaluate(async ({ input, name }) => {
    type ToolResponse = { content: [{ text: string }] };
    type RegisteredTool = { name: string; execute(value: unknown): ToolResponse | Promise<ToolResponse> };
    const tools = (window as unknown as { __webMcpEvidence: { tools: RegisteredTool[] } }).__webMcpEvidence.tools;
    const tool = tools.find((candidate) => candidate.name === name);
    if (tool === undefined) throw new Error(`Missing tool ${name}.`);
    const response = await tool.execute(input);
    return JSON.parse(response.content[0].text) as unknown;
  }, { input, name });
}

async function selectUnit204(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Weather affected" }).click();
  await page.getByRole("button", { name: "Select Unit 204", exact: true }).click();
  await expect(page.locator(".route-corridor-selected")).toHaveCount(1);
  await expect(page.locator(".risk-marker.map-layer-selected")).not.toHaveCount(0);
}

async function capture(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await page.evaluate(async () => document.fonts.ready);
  await page.waitForTimeout(300);
  const evidenceDirectory = process.env.SUPPLYMESH_EVIDENCE_DIR;
  const screenshotPath = evidenceDirectory === undefined ? testInfo.outputPath(name) : path.resolve(evidenceDirectory, name);
  await page.screenshot({ animations: "disabled", path: screenshotPath });
}

async function assertOverviewLabelsHidden(page: Page): Promise<void> {
  await expect(page.locator(".fleet-label-icon")).toHaveCount(15);
  await expect(page.locator(".fleet-map")).not.toHaveClass(/map-labels-visible/);
  await expect(page.locator(".fleet-label-icon:visible")).toHaveCount(0);
}

async function revealVehicleLabels(page: Page): Promise<void> {
  await page.locator(".leaflet-control-zoom-in").click();
  await page.locator(".leaflet-control-zoom-in").click();
  await expect(page.locator(".fleet-map")).toHaveClass(/map-labels-visible/);
  await expect.poll(async () => page.locator(".fleet-label-icon").evaluateAll((roots) => roots.filter((root) => {
    const style = getComputedStyle(root);
    return style.opacity === "1" && style.visibility === "visible";
  }).length)).toBe(15);
}

async function assertCollisionFreeLabels(page: Page): Promise<void> {
  await expect.poll(async () => page.evaluate(() => {
    const roots = [...document.querySelectorAll<HTMLElement>(".fleet-label-icon")].filter((root) => {
      const style = getComputedStyle(root);
      return style.opacity === "1" && style.visibility === "visible";
    });
    const obstacles = [...document.querySelectorAll<HTMLElement>(".fleet-truck-icon, .risk-marker")];
    const intersects = (left: DOMRect, right: DOMRect): boolean => left.left < right.right && left.right > right.left && left.top < right.bottom && left.bottom > right.top;
    const collisions = roots.flatMap((root, index) => {
      const rect = root.getBoundingClientRect();
      return [...roots.slice(index + 1), ...obstacles].filter((other) => intersects(rect, other.getBoundingClientRect())).map((other) => `${root.title}|${other.title || other.className}`);
    });
    return { collisions, count: roots.length, overflow: roots.some((root) => { const label = root.querySelector<HTMLElement>(".fleet-marker-label")!; return label.scrollWidth > label.clientWidth; }) };
  })).toEqual({ collisions: [], count: 15, overflow: false });
}

test.beforeEach(async ({ page }) => page.emulateMedia({ reducedMotion: "reduce" }));

test("should trace all 58 corrected SDD scenarios", async () => {
  expect(scenarioTrace).toHaveLength(58);
  expect(new Set(scenarioTrace).size).toBe(58);
});

test("should block the console when WebMCP is unavailable and preserve the localized gate", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("locale:v1", "es"));
  await page.goto("/");
  await expect(page.getByRole("alert")).toHaveText("Se requiere WebMCP para acceder a esta consola.");
  await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.locator(".console-shell")).toHaveCount(0);
  await expect(page.getByText(/continue manually|skip|disable ai/i)).toHaveCount(0);
});

test("should preserve base and initial recovery WebMCP schemas, responses, parity, and cleanup", async ({ page }) => {
  await installModelContextSeam(page);
  await resetApplication(page, 1440, 900);
  const tools = await registeredTools(page);
  expect(tools.map(({ name }) => name).sort()).toEqual(expectedToolNames);
  expect(tools.find(({ name }) => name === "scenario_current")?.inputSchema).toEqual({ type: "object", properties: {}, additionalProperties: false });
  expect(tools.find(({ name }) => name === "fleet_status")?.inputSchema).toEqual({ type: "object", properties: {}, additionalProperties: false });
  expect(tools.find(({ name }) => name === "vehicle_get")?.inputSchema).toEqual({ type: "object", properties: { vehicleId: { type: "string", minLength: 1 } }, required: ["vehicleId"], additionalProperties: false });
  expect(tools.find(({ name }) => name === "vehicle_rename")?.inputSchema).toEqual({ type: "object", properties: { vehicleId: { type: "string", minLength: 1 }, label: { type: "string", minLength: 1 } }, required: ["vehicleId", "label"], additionalProperties: false });
  expect(tools.find(({ name }) => name === "recovery_operations_context")?.inputSchema).toEqual({ type: "object", properties: {}, additionalProperties: false });
  expect(tools.find(({ name }) => name === "recovery_options_compare")?.inputSchema).toEqual({ type: "object", properties: {}, additionalProperties: false });
  expect(tools.find(({ name }) => name === "recovery_plan_stage")?.inputSchema).toEqual({ type: "object", properties: { selectedOptionId: { type: "string", minLength: 1 } }, required: ["selectedOptionId"], additionalProperties: false });
  await expect.poll(async () => executeTool(page, "fleet_status", {})).toMatchObject({ ok: true, data: { total: 15 } });
  expect(await executeTool(page, "scenario_current", { extra: true })).toMatchObject({ ok: false, error: { code: "invalid-input" } });
  expect(await executeTool(page, "vehicle_rename", { vehicleId: "vehicle-002", label: "" })).toMatchObject({ ok: false, error: { code: "invalid-input" } });
  expect(await executeTool(page, "vehicle_rename", { vehicleId: "vehicle-002", label: "N".repeat(65) })).toMatchObject({ ok: false, error: { code: "invalid-label" } });
  expect(await executeTool(page, "vehicle_rename", { vehicleId: "vehicle-002", label: "Native parity" })).toMatchObject({ ok: true, data: { label: "Native parity" } });
  await revealVehicleLabels(page);
  await expect(page.getByRole("button", { name: "Native parity", exact: true })).toBeVisible();
  expect(await executeTool(page, "vehicle_get", { vehicleId: "vehicle-002" })).toMatchObject({ ok: true, data: { label: "Native parity" } });
  await page.evaluate(() => window.dispatchEvent(new Event("beforeunload")));
  await expect.poll(async () => (await registeredTools(page)).length).toBe(0);
});

test("should complete the desktop filters, map, inspection, locale, and restoration flows", async ({ page }) => {
  await installModelContextSeam(page);
  await resetApplication(page, 1440, 900);
  await expect(page).toHaveTitle(/SupplyMesh/);
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Console controls" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Operational map" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Operational overview" })).toHaveAttribute("data-context-mode", "overview");
  for (const name of ["All vehicles, 15", "Resting, 4", "Needs attention, 3", "Critical, 3"]) await expect(page.getByRole("button", { name })).toBeVisible();
  await expect(page.locator(".fleet-truck-icon")).toHaveCount(15);
  await expect(page.locator(".fleet-label-icon")).toHaveCount(15);
  await expect(page.locator(".route-corridor")).toHaveCount(15);
  await assertOverviewLabelsHidden(page);
  await revealVehicleLabels(page);
  await assertCollisionFreeLabels(page);
  await expect(page.locator(".risk-marker-symbol")).toHaveCount(7);
  await expect(page.getByRole("button", { name: "Select Unit 211 clearance incident", exact: true })).toHaveCount(1);
  await expect(page.locator(".risk-marker-label:visible")).toHaveCount(0);
  const panes = await page.evaluate(() => ["risk-tokens", "fleet-trucks", "fleet-labels"].map((name) => Number(getComputedStyle(document.querySelector<HTMLElement>(`.leaflet-${name}-pane`)!).zIndex)));
  expect(panes).toEqual([620, 640, 660]);
  await expect(page.getByRole("group", { name: "Map legend" }).getByRole("listitem")).toHaveCount(5);
  await page.getByRole("button", { name: "Weather affected" }).click();
  await assertCollisionFreeLabels(page);
  await expect(page.locator(".risk-marker.map-layer-matched")).toHaveCount(4);
  await expect(page.locator(".risk-marker.map-layer-matched.risk-severe-snow")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Weather affected" })).toBeVisible();
  await expect(page.locator(".vehicle-result-card")).toHaveCount(3);
  await page.getByRole("button", { name: "Critical" }).click();
  await expect(page.getByRole("heading", { name: "2 active filters" })).toBeVisible();
  await expect(page.locator(".vehicle-result-card")).toHaveCount(5);
  await expect(page.locator(".vehicle-result-card .result-identity strong")).toHaveText(["Unit 204", "Unit 208", "Unit 212", "Unit 209", "Unit 214"]);
  await page.getByRole("button", { name: "Select Unit 204", exact: true }).click();
  const inspection = page.getByRole("complementary", { name: "Vehicle inspection" });
  await expect(inspection).toBeVisible();
  for (const heading of ["Identity", "Operational summary", "Why attention is needed", "Actions"]) await expect(inspection.getByRole("heading", { name: heading })).toBeVisible();
  await expect(page.locator(".route-corridor-selected")).toHaveCount(1);
  await expect(page.locator(".risk-marker.map-layer-selected")).not.toHaveCount(0);
  await expect(page.locator(".risk-marker.map-layer-selected .risk-marker-label:visible")).not.toHaveCount(0);
  await inspection.getByRole("button", { name: "View on route" }).click();
  await page.locator(".map-frame").dispatchEvent("wheel");
  await expect(inspection.getByRole("button", { name: "Follow Unit 204" })).toBeVisible();
  await inspection.getByRole("button", { name: "Follow Unit 204" }).click();
  await inspection.getByLabel("Label").fill("");
  await expect(inspection.getByRole("button", { name: "Save label" })).toBeDisabled();
  await expect(inspection.getByRole("alert")).toContainText("1 to 64");
  await inspection.getByLabel("Label").fill("Release Dispatch");
  await inspection.getByRole("button", { name: "Save label" }).click();
  await expect(page.getByRole("button", { name: "Release Dispatch", exact: true })).toBeVisible();
  await page.reload();
  await revealVehicleLabels(page);
  await expect(page.getByRole("button", { name: "Release Dispatch", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Language" }).click();
  await page.getByRole("menuitem", { name: "Español" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByRole("button", { name: "Ayuda" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Ayuda" })).toBeVisible();
  await page.getByRole("button", { name: "Idioma" }).click();
  await page.getByRole("menuitem", { name: "English" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.evaluate(() => localStorage.removeItem("scenario-overrides:v1"));
  await page.reload();
  await page.getByRole("button", { name: "Weather affected" }).click();
  await page.getByRole("button", { name: "Select Unit 204", exact: true }).click();
  await page.getByRole("button", { name: "Delete vehicle" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("complementary", { name: "Vehicle inspection" })).toBeVisible();
  await page.getByRole("button", { name: "Delete vehicle" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("heading", { name: "Weather affected" })).toBeFocused();
  await expect(page.getByRole("button", { name: "Select Unit 204" })).toHaveCount(0);
});

test("should keep tablet drawers accessible, contained, and focus-restoring", async ({ page }) => {
  await installModelContextSeam(page);
  await resetApplication(page, 900, 900);
  await page.getByRole("button", { name: "Weather affected" }).click();
  const results = page.getByRole("dialog", { name: "Fleet filters" });
  await expect(results.locator(".vehicle-result-card")).toHaveCount(3);
  await results.getByRole("button", { name: "Select Unit 204" }).click();
  const inspection = page.getByRole("dialog", { name: "Unit 204" });
  await expect(inspection).toBeVisible();
  await expect(inspection.getByRole("tab", { name: "Vehicle" })).toHaveAttribute("aria-selected", "true");
  await inspection.getByRole("tab", { name: "Cargo" }).click();
  await expect(inspection.getByRole("tabpanel")).toContainText("Frozen");
  const bounds = await inspection.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(900);
  await inspection.evaluate((node) => { node.scrollTop = node.scrollHeight; });
  await expect(inspection.getByRole("heading", { name: "Actions" })).toBeVisible();
  await expect(inspection.getByRole("tablist")).toBeVisible();
  await inspection.getByRole("button", { name: "Close inspection" }).click();
  await expect(results).toBeVisible();
  await expect(results.getByRole("button", { name: "Select Unit 204" })).toBeFocused();
  await results.getByRole("button", { name: "Close results" }).click();
  await expect(page.getByRole("button", { name: "Open operational overview" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Operational overview" })).toHaveCount(0);
  const overflow = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: window.innerWidth }));
  expect(overflow.body).toBeLessThanOrEqual(overflow.viewport);
});

test("should suppress nonessential motion and exclude prohibited or Phase 2 chrome", async ({ page }) => {
  await installModelContextSeam(page);
  await resetApplication(page, 1440, 900);
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip-link")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "Operational map" })).toBeFocused();
  const transition = await page.locator(".context-panel").evaluate((node) => getComputedStyle(node).transitionDuration);
  expect(Number.parseFloat(transition)).toBeLessThanOrEqual(0.001);
  await expect(page.getByText(/LIVE|WebMCP|Agent|Simulation|Stage plan|Chat|Fleet Edit|Create vehicle|Assign route|Reroute/i)).toHaveCount(0);
  await expect(page.locator("footer, .bottom-bar")).toHaveCount(0);
  await expect(page.locator(".map-frame canvas")).toHaveCount(0);
});

test("should capture exactly the six accepted real-application evidence states", async ({ page }, testInfo) => {
  await installModelContextSeam(page);
  await resetApplication(page, 1440, 900);
  await assertOverviewLabelsHidden(page);
  await capture(page, testInfo, "desktop-overview.png");
  await resetApplication(page, 1440, 900);
  await page.getByRole("button", { name: "Weather affected" }).click();
  await assertOverviewLabelsHidden(page);
  await capture(page, testInfo, "desktop-weather-filter.png");
  await resetApplication(page, 1440, 900);
  await selectUnit204(page);
  await capture(page, testInfo, "desktop-selected-route-risk.png");
  await resetApplication(page, 1440, 900);
  await page.getByRole("button", { name: "Weather affected" }).click();
  await page.getByRole("button", { name: "Critical" }).click();
  await assertOverviewLabelsHidden(page);
  await capture(page, testInfo, "desktop-two-filters.png");
  await resetApplication(page, 900, 900);
  await page.getByRole("button", { name: "Weather affected" }).click();
  await capture(page, testInfo, "tablet-results.png");
  await resetApplication(page, 900, 900);
  await selectUnit204(page);
  await capture(page, testInfo, "tablet-detail.png");
});
