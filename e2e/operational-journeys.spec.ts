import { mkdir } from "node:fs/promises";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

type ToolResponse = { content: [{ text: string }] };
type RegisteredTool = { name: string; execute(input: unknown): Promise<ToolResponse> | ToolResponse };
type Result<T> = { ok: true; data: T } | { ok: false; error: { code: string; message?: string } };
type VehicleSnapshot = {
  internalId: string;
  fleetNumber: string;
  label: string;
  routeId: string;
  status: string;
  position: { geometry: { coordinates: [number, number] } };
};
type RouteSnapshot = { id: string; vehicleId: string; summary: { distanceMeters: number; durationSeconds: number } };
type ScenarioSnapshot = { vehicles: VehicleSnapshot[]; routes: RouteSnapshot[] };
type TemporalAssessment = {
  status: string;
  remainingRouteMinutes: number;
  remainingDriveMinutes: number;
  estimatedCompletionAt: string;
  restDeadline: string;
};
type RecoveryComparison = {
  options: [
    { routeId: string; summary: RouteSnapshot["summary"]; temporalAssessment: TemporalAssessment },
    { alternativeRouteId: string; summary: RouteSnapshot["summary"]; temporalAssessment: TemporalAssessment },
  ];
};
type LeafletLayer = {
  options?: { className?: string };
  getLatLngs?: () => unknown;
};
type LeafletMap = { eachLayer(callback: (layer: LeafletLayer) => void): void };

const evidenceDirectory = "test-results/operational-journeys";

async function installWebMcp(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type Tool = { name: string; execute(input: unknown): unknown };
    const tools: Tool[] = [];
    Object.defineProperty(window, "__operationalQaTools", { configurable: true, value: tools });
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: {
        registerTool: async (tool: Tool, options: { signal: AbortSignal }) => {
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

async function openConsole(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installWebMcp(page);
  await page.goto("/");
  await expect(page.locator(".console-shell")).toBeVisible();
  await expect.poll(() => toolNames(page)).toContain("scenario_current");
}

async function toolNames(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const tools = (window as unknown as { __operationalQaTools: RegisteredTool[] }).__operationalQaTools;
    return [...new Set(tools.map(({ name }) => name))].sort();
  });
}

async function executeTool<T>(page: Page, name: string, input: unknown): Promise<Result<T>> {
  return page.evaluate(async ({ input, name }) => {
    const tools = (window as unknown as { __operationalQaTools: RegisteredTool[] }).__operationalQaTools;
    const tool = [...tools].reverse().find((candidate) => candidate.name === name);
    if (tool === undefined) throw new Error(`Missing WebMCP tool ${name}.`);
    const response = await tool.execute(input);
    return JSON.parse(response.content[0].text) as Result<T>;
  }, { input, name });
}

async function scenario(page: Page): Promise<ScenarioSnapshot> {
  const result = await executeTool<ScenarioSnapshot>(page, "scenario_current", {});
  if (!result.ok) throw new Error(result.error.code);
  return result.data;
}

async function recoveryLayers(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const element = document.querySelector(".fleet-map") as HTMLElement & { _leaflet_map?: LeafletMap } | null;
    const result: Record<string, string> = {};
    element?._leaflet_map?.eachLayer((layer) => {
      const className = layer.options?.className;
      if (typeof className !== "string" || !className.includes("recovery-")) return;
      result[className] = JSON.stringify(layer.getLatLngs?.() ?? null);
    });
    return result;
  });
}

async function capture(page: Page, name: string): Promise<void> {
  await mkdir(evidenceDirectory, { recursive: true });
  await page.screenshot({ animations: "disabled", path: `${evidenceDirectory}/${name}` });
}

async function selectVehicle(page: Page, vehicleId: string): Promise<void> {
  const marker = page.locator(`[data-vehicle-truck="${vehicleId}"]`);
  await expect(marker).toBeVisible();
  await marker.click();
  await expect(page.locator(".vehicle-inspection")).toBeVisible();
}

async function setRouteThroughHumanUi(page: Page, routeId: string): Promise<void> {
  await page.getByRole("button", { name: "Edit vehicle" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit Vehicle" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Route", { exact: true }).selectOption(routeId);
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

async function openUnit211Recovery(page: Page): Promise<void> {
  const incident = page.getByRole("button", { name: "Select Unit 211 clearance incident", exact: true });
  await incident.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Review recovery options" }).click();
  await expect(page.getByRole("heading", { name: "Recovery comparison" })).toBeVisible();
  await expect(page.locator("#recovery-map-summary")).toHaveAttribute("data-route-state", "comparison");
}

async function grantClipboard(context: BrowserContext): Promise<void> {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:4173" });
}

test.beforeEach(async ({ page }) => page.emulateMedia({ reducedMotion: "reduce" }));

test("Help opens, copies the real demo prompt, closes with Escape, and restores focus", async ({ context, page }) => {
  await grantClipboard(context);
  await openConsole(page);
  const help = page.getByRole("button", { name: "Help", exact: true });
  await help.click();
  const dialog = page.locator(".help-dialog-content");
  await expect(dialog).toContainText("Unit 211 Demo");
  await expect(dialog).toContainText("Human Authority");
  await dialog.locator(".help-copy-prompt-btn").click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain("Unit 211 clearance incident");
  await capture(page, "01-help-working.png");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(help).toBeFocused();
});

test("human lifecycle places, persists, assigns a real route, and deletes a vehicle", async ({ page }) => {
  test.setTimeout(60_000);
  await openConsole(page);
  const expand = page.getByRole("button", { name: "Expand filters" });
  if (await expand.isVisible()) await expand.click();
  await page.getByRole("button", { name: "Add vehicle" }).click();

  const map = page.locator(".fleet-map");
  const target = await map.evaluate((node) => {
    const element = node as HTMLElement & { _leaflet_map?: { containerPointToLatLng(point: [number, number]): { lat: number; lng: number } } };
    if (element._leaflet_map === undefined) throw new Error("Leaflet map is unavailable.");
    const rect = element.getBoundingClientRect();
    const x = rect.width * 0.56;
    const y = rect.height * 0.54;
    const coordinate = element._leaflet_map.containerPointToLatLng([x, y]);
    return { clientX: rect.left + x, clientY: rect.top + y, latitude: coordinate.lat, longitude: coordinate.lng };
  });
  await page.mouse.click(target.clientX, target.clientY);

  const drawer = page.locator(".vehicle-placement-drawer");
  await expect(drawer).toBeVisible();
  await drawer.locator("#placement-fleet-num").fill("QA-HUM-901");
  await drawer.locator("#placement-plate").fill("9011 HUM");
  await drawer.locator("#placement-label").fill("Human QA Truck");
  await capture(page, "02-human-placement-form.png");
  await drawer.getByRole("button", { name: "Add vehicle" }).click();

  const created = (await scenario(page)).vehicles.find(({ fleetNumber }) => fleetNumber === "QA-HUM-901");
  expect(created).toBeDefined();
  if (created === undefined) return;
  expect(created.routeId).toBe("");
  expect(Math.abs(created.position.geometry.coordinates[0] - target.longitude)).toBeLessThan(0.005);
  expect(Math.abs(created.position.geometry.coordinates[1] - target.latitude)).toBeLessThan(0.005);
  await expect(page.locator("[data-vehicle-stopped-reason]")).toContainText("No route assigned");

  await page.reload();
  await expect.poll(() => toolNames(page)).toContain("scenario_current");
  expect((await scenario(page)).vehicles.some(({ internalId }) => internalId === created.internalId)).toBe(true);

  await selectVehicle(page, "vehicle-012");
  await setRouteThroughHumanUi(page, "");
  await expect.poll(async () => (await scenario(page)).vehicles.find(({ internalId }) => internalId === "vehicle-012")?.routeId).toBe("");

  await selectVehicle(page, created.internalId);
  await setRouteThroughHumanUi(page, "route-012");
  await expect.poll(async () => (await scenario(page)).vehicles.find(({ internalId }) => internalId === created.internalId)?.routeId).toBe("route-012");
  expect((await scenario(page)).routes.find(({ id }) => id === "route-012")?.vehicleId).toBe(created.internalId);
  await expect(page.locator(".route-corridor-selected")).toHaveCount(1);
  await capture(page, "03-human-route-assigned.png");

  await page.getByRole("button", { name: "Delete vehicle" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();
  expect((await scenario(page)).vehicles.some(({ internalId }) => internalId === created.internalId)).toBe(true);
  await page.getByRole("button", { name: "Delete vehicle" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();
  await expect.poll(async () => (await scenario(page)).vehicles.length).toBe(15);
  await page.reload();
  await expect.poll(() => toolNames(page)).toContain("scenario_current");
  expect((await scenario(page)).vehicles.some(({ internalId }) => internalId === created.internalId)).toBe(false);
});

test("agent CRUD reassigns two real routes and the selected map path changes", async ({ page }) => {
  test.setTimeout(60_000);
  await openConsole(page);
  const creation = await executeTool<VehicleSnapshot>(page, "fleet_vehicle_create", {
    fleetNumber: "QA-AGT-902",
    plate: "9022 AGT",
    label: "Agent QA Truck",
    dimensions: { vehicleType: "Articulated curtain-sider", lengthMeters: 16.5, heightMeters: 3.8, weightTonnes: 24 },
    cargo: { description: "QA pallets", refrigeration: "ambient", priority: "standard" },
    initialPosition: { longitude: -3.7038, latitude: 40.4168 },
  });
  expect(creation.ok).toBe(true);
  if (!creation.ok) return;
  const vehicleId = creation.data.internalId;

  expect(await executeTool(page, "fleet_vehicle_update", {
    vehicleId,
    label: "Agent Route Optimizer QA",
    plate: "9023 AGT",
  })).toMatchObject({ ok: true, data: { label: "Agent Route Optimizer QA" } });

  expect(await executeTool(page, "fleet_vehicle_assign_route", { vehicleId: "vehicle-012" })).toMatchObject({ ok: true });
  expect(await executeTool(page, "fleet_vehicle_assign_route", { vehicleId: "vehicle-013" })).toMatchObject({ ok: true });
  expect(await executeTool(page, "fleet_vehicle_assign_route", { vehicleId, routeId: "route-012" })).toMatchObject({ ok: true });
  await selectVehicle(page, vehicleId);
  const selectedPath = page.locator(".route-corridor-selected");
  await expect(selectedPath).toHaveCount(1);
  const firstPath = await selectedPath.getAttribute("d");
  expect(firstPath).toBeTruthy();

  expect(await executeTool(page, "fleet_vehicle_assign_route", { vehicleId, routeId: "route-013" })).toMatchObject({ ok: true });
  await expect.poll(() => selectedPath.getAttribute("d")).not.toBe(firstPath);
  const afterSwitch = await scenario(page);
  expect(afterSwitch.routes.find(({ id }) => id === "route-012")?.vehicleId).toBe("");
  expect(afterSwitch.routes.find(({ id }) => id === "route-013")?.vehicleId).toBe(vehicleId);
  await capture(page, "04-agent-route-switched.png");

  await executeTool(page, "fleet_vehicle_assign_route", { vehicleId });
  await executeTool(page, "fleet_vehicle_assign_route", { vehicleId: "vehicle-012", routeId: "route-012" });
  await executeTool(page, "fleet_vehicle_assign_route", { vehicleId: "vehicle-013", routeId: "route-013" });
  expect(await executeTool(page, "fleet_vehicle_delete", { vehicleId })).toMatchObject({ ok: true });
});

test("Unit 211 combines agent analysis, human approval, shorter route execution, rest protection, and verification", async ({ page }) => {
  test.setTimeout(60_000);
  await openConsole(page);
  await openUnit211Recovery(page);

  const comparisonResult = await executeTool<RecoveryComparison>(page, "recovery_options_compare", {});
  expect(comparisonResult.ok).toBe(true);
  if (!comparisonResult.ok) return;
  const [current, alternative] = comparisonResult.data.options;
  expect(alternative.summary.distanceMeters).toBeLessThan(current.summary.distanceMeters);
  expect(alternative.summary.durationSeconds).toBeLessThanOrEqual(current.summary.durationSeconds);
  expect(alternative.temporalAssessment.status).toBe("PASS");
  expect(alternative.temporalAssessment.remainingRouteMinutes).toBeLessThanOrEqual(alternative.temporalAssessment.remainingDriveMinutes);
  expect(Date.parse(alternative.temporalAssessment.estimatedCompletionAt)).toBeLessThanOrEqual(Date.parse(alternative.temporalAssessment.restDeadline));

  const attemptToRewriteRest = await executeTool(page, "fleet_vehicle_update", {
    vehicleId: "vehicle-011",
    timing: { remainingDriveMinutes: 999, restDeadline: "2099-01-01T00:00:00Z" },
  });
  expect(attemptToRewriteRest).toMatchObject({ ok: false, error: { code: "invalid-input" } });
  expect((await toolNames(page)).some((name) => /approve|override.*rest|rest.*override/i.test(name))).toBe(false);

  await expect.poll(async () => Object.keys(await recoveryLayers(page))).toEqual(expect.arrayContaining(["recovery-current-route", "recovery-alternative-route"]));
  const beforeLayers = await recoveryLayers(page);
  expect(beforeLayers["recovery-current-route"]).not.toBe(beforeLayers["recovery-alternative-route"]);
  await capture(page, "05-recovery-comparison.png");

  const staged = await executeTool<{ planId: string }>(page, "recovery_plan_stage", { selectedOptionId: alternative.alternativeRouteId });
  expect(staged.ok).toBe(true);
  if (!staged.ok) return;
  await expect.poll(() => toolNames(page)).toContain("recovery_plan_request_review");
  expect(await executeTool(page, "recovery_plan_request_review", { planId: staged.data.planId })).toMatchObject({ ok: true });
  await expect.poll(() => toolNames(page)).not.toContain("recovery_plan_execute");
  await capture(page, "06-recovery-awaiting-human.png");

  await page.getByRole("button", { name: "Approve" }).click();
  await expect.poll(() => toolNames(page)).toContain("recovery_plan_execute");
  expect(await executeTool(page, "recovery_plan_execute", { planId: staged.data.planId })).toMatchObject({ ok: true, data: { status: "EXECUTED" } });
  await expect(page.locator("#recovery-map-summary")).toHaveAttribute("data-route-state", "applied");
  await expect.poll(async () => Object.keys(await recoveryLayers(page))).toContain("recovery-applied-route");
  const afterLayers = await recoveryLayers(page);
  expect(afterLayers["recovery-applied-route"]).toBe(beforeLayers["recovery-alternative-route"]);
  expect((await scenario(page)).vehicles.find(({ internalId }) => internalId === "vehicle-011")?.routeId).toBe("alternative-route-011-clearance-v1");
  await capture(page, "07-recovery-applied.png");

  expect(await executeTool(page, "recovery_verify", { planId: staged.data.planId })).toMatchObject({ ok: true, data: { status: "PASS" } });
  await expect(page.locator(".verification-matrix [data-status=PASS]")).toHaveCount(15);
  expect(await executeTool(page, "recovery_receipt_get", { planId: staged.data.planId })).toMatchObject({ ok: true });
});