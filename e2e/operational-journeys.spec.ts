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
type RouteSnapshot = {
  id: string;
  vehicleId: string;
  summary: { distanceMeters: number; durationSeconds: number };
};
type ScenarioSnapshot = { vehicles: VehicleSnapshot[]; routes: RouteSnapshot[] };
type RecoveryComparison = {
  options: [
    {
      routeId: string;
      summary: { distanceMeters: number; durationSeconds: number };
      temporalAssessment: { status: string; remainingRouteMinutes: number; remainingDriveMinutes: number; estimatedCompletionAt: string; restDeadline: string };
    },
    {
      alternativeRouteId: string;
      summary: { distanceMeters: number; durationSeconds: number };
      temporalAssessment: { status: string; remainingRouteMinutes: number; remainingDriveMinutes: number; estimatedCompletionAt: string; restDeadline: string };
    },
  ];
};

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

async function openConsole(page: Page, width = 1440, height = 900): Promise<void> {
  await page.setViewportSize({ width, height });
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

async function capture(page: Page, name: string): Promise<void> {
  await mkdir(evidenceDirectory, { recursive: true });
  await page.screenshot({ animations: "disabled", path: `${evidenceDirectory}/${name}` });
}

async function expandFilters(page: Page): Promise<void> {
  const expand = page.getByRole("button", { name: "Expand filters" });
  if (await expand.isVisible()) await expand.click();
}

async function selectVehicleMarker(page: Page, vehicleId: string): Promise<void> {
  const marker = page.locator(`[data-vehicle-truck="${vehicleId}"]`);
  await expect(marker).toBeVisible();
  await marker.click();
  await expect(page.locator(".vehicle-inspection")).toBeVisible();
}

async function setRouteThroughHumanUi(page: Page, routeId: string): Promise<void> {
  await page.getByRole("button", { name: "Edit vehicle" }).click();
  const dialog = page.getByRole("dialog").filter({ hasText: "Edit Vehicle" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Route:").selectOption(routeId);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toHaveCount(0);
}

async function openUnit211Recovery(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Select Unit 211 clearance incident", exact: true }).click();
  await page.getByRole("button", { name: "Review recovery options" }).click();
  await expect(page.getByRole("heading", { name: "Recovery comparison" })).toBeVisible();
}

async function stageForHumanReview(page: Page, comparison: RecoveryComparison): Promise<string> {
  const optionId = comparison.options[1].alternativeRouteId;
  const staged = await executeTool<{ planId: string }>(page, "recovery_plan_stage", { selectedOptionId: optionId });
  if (!staged.ok) throw new Error(staged.error.code);
  await expect(page.getByText("STAGED", { exact: true })).toBeVisible();
  await expect.poll(() => toolNames(page)).toContain("recovery_plan_request_review");
  const review = await executeTool(page, "recovery_plan_request_review", { planId: staged.data.planId });
  if (!review.ok) throw new Error(review.error.code);
  await expect(page.getByText("REVIEW_REQUESTED", { exact: true })).toBeVisible();
  return staged.data.planId;
}

async function grantClipboard(context: BrowserContext): Promise<void> {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:4173" });
}

test.beforeEach(async ({ page }) => page.emulateMedia({ reducedMotion: "reduce" }));

test("Help is functional: content, real clipboard copy, Escape, and focus restoration", async ({ context, page }) => {
  await grantClipboard(context);
  await openConsole(page);

  const help = page.getByRole("button", { name: "Help", exact: true });
  await help.click();
  const dialog = page.locator(".help-dialog-content");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Unit 211 Demo");
  await expect(dialog).toContainText("Human Authority");

  await dialog.locator(".help-copy-prompt-btn").click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain("Unit 211 clearance incident");
  await expect(dialog.locator(".help-copy-prompt-btn")).toContainText(/copied/i);
  await capture(page, "01-help-working.png");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(help).toBeFocused();
});

test("human fleet lifecycle: map placement, persistence, route edit, and confirmed deletion", async ({ page }) => {
  await openConsole(page);
  await expandFilters(page);
  await page.getByRole("button", { name: "Add vehicle" }).click();
  await expect(page.locator(".map-placement-banner")).toContainText("Click the map to place the vehicle");

  const map = page.locator(".fleet-map");
  const target = await map.evaluate((node) => {
    const element = node as HTMLElement & {
      _leaflet_map?: { containerPointToLatLng(point: [number, number]): { lat: number; lng: number } };
    };
    if (element._leaflet_map === undefined) throw new Error("Leaflet map is unavailable.");
    const rect = element.getBoundingClientRect();
    const x = rect.width * 0.56;
    const y = rect.height * 0.54;
    const coordinate = element._leaflet_map.containerPointToLatLng([x, y]);
    return { clientX: rect.left + x, clientY: rect.top + y, latitude: coordinate.lat, longitude: coordinate.lng };
  });
  await page.mouse.click(target.clientX, target.clientY);

  const drawer = page.locator(".vehicle-placement-drawer");
  await expect(page.locator(".placement-preview-marker")).toBeVisible();
  await expect(drawer).toBeVisible();
  await drawer.locator("#placement-fleet-num").fill("QA-HUM-901");
  await drawer.locator("#placement-plate").fill("9011 HUM");
  await drawer.locator("#placement-label").fill("Human QA Truck");
  await capture(page, "02-human-placement-form.png");
  await drawer.getByRole("button", { name: "Add vehicle" }).click();

  const created = (await scenario(page)).vehicles.find(({ fleetNumber }) => fleetNumber === "QA-HUM-901");
  expect(created).toBeDefined();
  if (created === undefined) return;
  expect(created.status).toBe("resting");
  expect(created.routeId).toBe("");
  expect(created.position.geometry.coordinates[0]).toBeCloseTo(target.longitude, 4);
  expect(created.position.geometry.coordinates[1]).toBeCloseTo(target.latitude, 4);
  await expect(page.locator(`[data-vehicle-truck="${created.internalId}"]`)).toBeVisible();
  await expect(page.locator(".fleet-truck-icon")).toHaveCount(16);
  await capture(page, "03-human-created-selected.png");

  await page.reload();
  await expect(page.locator(".console-shell")).toBeVisible();
  await expect.poll(() => toolNames(page)).toContain("scenario_current");
  const persisted = (await scenario(page)).vehicles.find(({ internalId }) => internalId === created.internalId);
  expect(persisted?.position.geometry.coordinates[0]).toBeCloseTo(target.longitude, 4);
  expect(persisted?.position.geometry.coordinates[1]).toBeCloseTo(target.latitude, 4);

  // Human frees route-012 from Unit 212 using the visible Edit dialog.
  await selectVehicleMarker(page, "vehicle-012");
  await setRouteThroughHumanUi(page, "");
  await expect.poll(async () => (await scenario(page)).vehicles.find(({ internalId }) => internalId === "vehicle-012")?.routeId).toBe("");

  // Human assigns that real route to the newly placed truck.
  await selectVehicleMarker(page, created.internalId);
  await setRouteThroughHumanUi(page, "route-012");
  await expect.poll(async () => (await scenario(page)).vehicles.find(({ internalId }) => internalId === created.internalId)?.routeId).toBe("route-012");
  await expect(page.locator(".route-corridor-selected")).toHaveCount(1);
  const assigned = (await scenario(page)).routes.find(({ id }) => id === "route-012");
  expect(assigned?.vehicleId).toBe(created.internalId);
  await capture(page, "04-human-route-assigned.png");

  // Cancel preserves the vehicle, then confirm removes it from UI and persistence.
  await page.getByRole("button", { name: "Delete vehicle" }).click();
  const deleteDialog = page.getByRole("alertdialog");
  await expect(deleteDialog).toBeVisible();
  await deleteDialog.getByRole("button", { name: "Cancel" }).click();
  expect((await scenario(page)).vehicles.some(({ internalId }) => internalId === created.internalId)).toBe(true);

  await page.getByRole("button", { name: "Delete vehicle" }).click();
  await capture(page, "05-human-delete-confirmation.png");
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect.poll(async () => (await scenario(page)).vehicles.length).toBe(15);
  await expect(page.locator(`[data-vehicle-truck="${created.internalId}"]`)).toHaveCount(0);

  await page.reload();
  await expect(page.locator(".console-shell")).toBeVisible();
  await expect.poll(() => toolNames(page)).toContain("scenario_current");
  expect((await scenario(page)).vehicles.some(({ internalId }) => internalId === created.internalId)).toBe(false);
});

test("agent fleet lifecycle: create, update, reassign two real routes, prove map path changes, and delete", async ({ page }) => {
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
  await expect(page.locator(`[data-vehicle-truck="${vehicleId}"]`)).toBeVisible();

  const update = await executeTool<VehicleSnapshot>(page, "fleet_vehicle_update", {
    vehicleId,
    label: "Agent Route Optimizer QA",
    plate: "9023 AGT",
    dimensions: { vehicleType: "Reefer tractor-trailer", lengthMeters: 16.2, heightMeters: 3.75, weightTonnes: 23 },
    cargo: { description: "Priority chilled QA cargo", refrigeration: "chilled", priority: "priority" },
  });
  expect(update).toMatchObject({ ok: true, data: { label: "Agent Route Optimizer QA", plate: "9023 AGT" } });

  // Free two fixture-backed routes through the same WebMCP contract.
  expect(await executeTool(page, "fleet_vehicle_assign_route", { vehicleId: "vehicle-012" })).toMatchObject({ ok: true });
  expect(await executeTool(page, "fleet_vehicle_assign_route", { vehicleId: "vehicle-013" })).toMatchObject({ ok: true });

  expect(await executeTool(page, "fleet_vehicle_assign_route", { vehicleId, routeId: "route-012" })).toMatchObject({ ok: true, data: { routeId: "route-012" } });
  await selectVehicleMarker(page, vehicleId);
  const selectedRoute = page.locator(".route-corridor-selected");
  await expect(selectedRoute).toHaveCount(1);
  const firstPath = await selectedRoute.getAttribute("d");
  expect(firstPath).toBeTruthy();
  await capture(page, "06-agent-route-012.png");

  expect(await executeTool(page, "fleet_vehicle_assign_route", { vehicleId, routeId: "route-013" })).toMatchObject({ ok: true, data: { routeId: "route-013" } });
  await expect.poll(() => selectedRoute.getAttribute("d")).not.toBe(firstPath);
  const afterSwitch = await scenario(page);
  expect(afterSwitch.routes.find(({ id }) => id === "route-012")?.vehicleId).toBe("");
  expect(afterSwitch.routes.find(({ id }) => id === "route-013")?.vehicleId).toBe(vehicleId);
  await capture(page, "07-agent-route-013.png");

  // Restore fixture ownership before deleting the temporary truck.
  expect(await executeTool(page, "fleet_vehicle_assign_route", { vehicleId })).toMatchObject({ ok: true });
  expect(await executeTool(page, "fleet_vehicle_assign_route", { vehicleId: "vehicle-012", routeId: "route-012" })).toMatchObject({ ok: true });
  expect(await executeTool(page, "fleet_vehicle_assign_route", { vehicleId: "vehicle-013", routeId: "route-013" })).toMatchObject({ ok: true });
  expect(await executeTool(page, "fleet_vehicle_delete", { vehicleId })).toMatchObject({ ok: true });
  await expect(page.locator(`[data-vehicle-truck="${vehicleId}"]`)).toHaveCount(0);
  await expect.poll(async () => (await scenario(page)).vehicles.length).toBe(15);
});

test("Unit 211 uses agent analysis plus human approval to apply the shorter route while protecting rest constraints", async ({ page }) => {
  await openConsole(page);
  await openUnit211Recovery(page);

  const comparisonResult = await executeTool<RecoveryComparison>(page, "recovery_options_compare", {});
  expect(comparisonResult.ok).toBe(true);
  if (!comparisonResult.ok) return;
  const [current, alternative] = comparisonResult.data.options;
  expect(current.routeId).toBe("route-011");
  expect(alternative.alternativeRouteId).toBe("alternative-route-011-clearance-v1");
  expect(alternative.summary.distanceMeters).toBeLessThan(current.summary.distanceMeters);
  expect(alternative.summary.durationSeconds).toBeLessThanOrEqual(current.summary.durationSeconds);
  expect(alternative.temporalAssessment.status).toBe("PASS");
  expect(alternative.temporalAssessment.remainingRouteMinutes).toBeLessThanOrEqual(alternative.temporalAssessment.remainingDriveMinutes);
  expect(Date.parse(alternative.temporalAssessment.estimatedCompletionAt)).toBeLessThanOrEqual(Date.parse(alternative.temporalAssessment.restDeadline));

  // Rest facts are hard inputs: the general CRUD tool rejects attempts to rewrite timing.
  expect(await executeTool(page, "fleet_vehicle_update", {
    vehicleId: "vehicle-011",
    timing: { remainingDriveMinutes: 999, restDeadline: "2099-01-01T00:00:00Z" },
  })).toMatchObject({ ok: false, error: { code: "invalid-input" } });
  expect((await toolNames(page)).some((name) => /approve|override.*rest|rest.*override/i.test(name))).toBe(false);

  const currentPath = page.locator(".recovery-current-route");
  const proposedPath = page.locator(".recovery-alternative-route");
  await expect(currentPath).toBeVisible();
  await expect(proposedPath).toBeVisible();
  const currentD = await currentPath.getAttribute("d");
  const proposedD = await proposedPath.getAttribute("d");
  expect(currentD).toBeTruthy();
  expect(proposedD).toBeTruthy();
  expect(proposedD).not.toBe(currentD);
  await capture(page, "08-recovery-compared.png");

  const planId = await stageForHumanReview(page, comparisonResult.data);
  await expect.poll(() => toolNames(page)).not.toContain("recovery_plan_execute");
  await capture(page, "09-recovery-awaiting-human.png");

  // This is the only authority transition in the test and it is performed in the visible UI.
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("APPROVED", { exact: true })).toBeVisible();
  await expect.poll(() => toolNames(page)).toContain("recovery_plan_execute");

  const execution = await executeTool<{ status: string }>(page, "recovery_plan_execute", { planId });
  expect(execution).toMatchObject({ ok: true, data: { status: "EXECUTED" } });
  await expect(page.locator(".recovery-current-route")).toHaveCount(0);
  const appliedPath = page.locator(".recovery-applied-route");
  await expect(appliedPath).toBeVisible();
  expect(await appliedPath.getAttribute("d")).toBe(proposedD);
  await expect(page.locator("#recovery-map-summary")).toHaveAttribute("data-route-state", "applied");

  const postExecution = await scenario(page);
  expect(postExecution.vehicles.find(({ internalId }) => internalId === "vehicle-011")?.routeId).toBe("alternative-route-011-clearance-v1");
  expect(postExecution.routes.find(({ id }) => id === "alternative-route-011-clearance-v1")?.vehicleId).toBe("vehicle-011");
  await capture(page, "10-recovery-shorter-route-applied.png");

  expect(await executeTool(page, "recovery_verify", { planId })).toMatchObject({ ok: true, data: { status: "PASS" } });
  await expect(page.getByText("VERIFIED", { exact: true })).toBeVisible();
  await expect(page.locator(".verification-matrix [data-status=PASS]")).toHaveCount(15);
  expect(await executeTool(page, "recovery_receipt_get", { planId })).toMatchObject({ ok: true });
  await capture(page, "11-recovery-verified-receipt.png");
});
