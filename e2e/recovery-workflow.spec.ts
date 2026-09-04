import { expect, test, type Page } from "@playwright/test";

type ToolResponse = { content: [{ text: string }] };
type RegisteredTool = { name: string; execute(input: unknown): Promise<ToolResponse> };
type WorkflowResult<T> = { ok: true; data: T } | { ok: false; error: { code: string } };

async function installWebMcp(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type Tool = { name: string; execute(input: unknown): unknown }; const tools: Tool[] = [];
    Object.defineProperty(window, "__recoveryTools", { configurable: true, value: tools });
    Object.defineProperty(document, "modelContext", { configurable: true, value: { registerTool: async (tool: Tool, options: { signal: AbortSignal }) => { tools.push(tool); options.signal.addEventListener("abort", () => { const index = tools.indexOf(tool); if (index >= 0) tools.splice(index, 1); }, { once: true }); } } });
  });
}

async function openConsole(page: Page, width = 1440, height = 900): Promise<void> { await page.setViewportSize({ width, height }); await installWebMcp(page); await page.goto("/"); await expect(page.locator(".console-shell")).toBeVisible(); }
async function openRecovery(page: Page): Promise<void> { await page.getByRole("button", { name: "Select Unit 211 clearance incident", exact: true }).focus(); await page.keyboard.press("Enter"); await page.getByRole("button", { name: "Review recovery options" }).click(); await expect(page.getByRole("heading", { name: "Recovery comparison" })).toBeFocused(); }
async function toolNames(page: Page): Promise<string[]> { return page.evaluate(() => (window as unknown as { __recoveryTools: RegisteredTool[] }).__recoveryTools.map(({ name }) => name).sort()); }
async function executeTool<T>(page: Page, name: string, input: unknown): Promise<WorkflowResult<T>> { return page.evaluate(async ({ input, name }) => { const tool = (window as unknown as { __recoveryTools: RegisteredTool[] }).__recoveryTools.find((entry) => entry.name === name); if (!tool) throw new Error("Missing recovery tool: " + name); return JSON.parse((await tool.execute(input)).content[0].text) as WorkflowResult<T>; }, { input, name }); }
async function expectUnit211AppliedRoute(page: Page): Promise<void> {
  await expect(page.locator('[data-route-id="alternative-route-011-clearance-v1"][data-route-owner="vehicle-011"]')).toHaveCount(1);
  await expect(page.locator('[data-route-id="route-011"]')).toHaveCount(0);
}
async function panOperationalMap(page: Page): Promise<void> {
  await page.locator(".fleet-map").evaluate(async (node) => {
    type MapHandle = { once(event: "moveend", listener: () => void): void; panBy(offset: [number, number], options: { animate: boolean }): void };
    const map = (node as HTMLElement & { _leaflet_map?: MapHandle })._leaflet_map;
    if (map === undefined) throw new Error("Leaflet map is unavailable.");
    await new Promise<void>((resolve) => { map.once("moveend", resolve); map.panBy([96, 48], { animate: false }); });
  });
}
async function stageForReview(page: Page): Promise<string> {
  await expect.poll(() => toolNames(page)).toContain("recovery_plan_stage");
  const comparison = await executeTool<{ recommendedOptionId: string; nextAction: string }>(page, "recovery_options_compare", {}); if (!comparison.ok) throw new Error(comparison.error.code);
  expect(comparison.data).toMatchObject({ recommendedOptionId: "alternative-route-011-clearance-v1", nextAction: "recovery_plan_stage" });
  const staged = await executeTool<{ planId: string; nextAction: string }>(page, comparison.data.nextAction, { selectedOptionId: comparison.data.recommendedOptionId }); if (!staged.ok) throw new Error(staged.error.code);
  expect(staged.data.nextAction).toBe("recovery_plan_request_review");
  await expect(page.getByText("STAGED", { exact: true })).toBeVisible(); await expect.poll(() => toolNames(page)).toContain("recovery_plan_request_review");
  const reviewed = await executeTool<{ workflowStatus: string; requiredHumanAction: string; agentCanApprove: boolean; nextAction: string }>(page, staged.data.nextAction, { planId: staged.data.planId }); if (!reviewed.ok) throw new Error(reviewed.error.code);
  expect(reviewed.data).toMatchObject({ workflowStatus: "REVIEW_REQUESTED", requiredHumanAction: "Approve or reject from the visible SupplyMesh interface.", agentCanApprove: false, nextAction: "wait_for_human_review" });
  await expect(page.getByText("REVIEW_REQUESTED", { exact: true })).toBeVisible(); return staged.data.planId;
}
async function approve(page: Page): Promise<void> { await page.getByRole("button", { name: "Approve" }).click(); await expect(page.getByText("APPROVED", { exact: true })).toBeVisible(); }

const forbiddenAgentControls = /Prepare plan|Request human review|Execute|Verify execution|Retry verification|Get receipt|Compare options|Plan status/;
test.beforeEach(async ({ page }) => page.emulateMedia({ reducedMotion: "reduce" }));

test("full workflow is agent-driven around the human approval boundary", async ({ page }) => {
  await openConsole(page); await openRecovery(page); await expect(page.getByRole("button", { name: forbiddenAgentControls })).toHaveCount(0); const planId = await stageForReview(page);
  await expect(page.getByRole("button", { name: "Approve" })).toBeVisible(); await expect(page.getByRole("button", { name: "Approve" })).toBeFocused(); await expect(page.getByRole("button", { name: "Reject" })).toBeVisible(); await expect(page.locator("#recovery-map-summary")).toHaveAttribute("data-route-state", "comparison"); await approve(page);
  await expect(page.getByText("Human approval authorizes agent execution")).toBeVisible(); await expect(page.getByText(/Agent capability enabled/)).toHaveCount(0); await expect.poll(() => toolNames(page)).toContain("recovery_plan_execute");
  const approved = await executeTool<{ nextAction: string }>(page, "recovery_plan_status", {}); if (!approved.ok) throw new Error(approved.error.code); expect(approved.data.nextAction).toBe("recovery_plan_execute");
  const executed = await executeTool<{ nextAction: string }>(page, approved.data.nextAction, { planId }); if (!executed.ok) throw new Error(executed.error.code); expect(executed.data.nextAction).toBe("recovery_verify"); await expect(page.getByText("EXECUTED", { exact: true })).toBeVisible();
  await expect.poll(() => toolNames(page)).not.toContain("recovery_plan_execute"); await expect.poll(() => toolNames(page)).toContain("recovery_verify");
  await expect(page.locator("#recovery-map-summary")).toHaveAttribute("data-route-state", "applied"); await expect(page.getByText("RESOLVED", { exact: true })).toBeVisible(); await expect(page.getByText("Execution evidence is available for agent verification")).toBeVisible();
  const verified = await executeTool<{ nextAction: string }>(page, executed.data.nextAction, { planId }); if (!verified.ok) throw new Error(verified.error.code); expect(verified.data.nextAction).toBe("recovery_receipt_get"); await expect(page.getByText("VERIFIED", { exact: true })).toBeVisible(); await expect(page.locator(".verification-matrix li")).toHaveCount(15); await expect(page.getByRole("heading", { name: "Verified receipt" })).toBeVisible();
  await expect.poll(() => toolNames(page)).not.toContain("recovery_verify"); await expect.poll(() => toolNames(page)).toContain("recovery_receipt_get");
  const receipt = await executeTool<{ receiptId: string; nextAction: null }>(page, verified.data.nextAction, { planId }); expect(receipt.ok).toBe(true); if (receipt.ok) expect(receipt.data.nextAction).toBeNull(); const receiptPanel = page.locator(".workflow-receipt"); await expect(receiptPanel).toContainText("route-011 → alternative-route-011-clearance-v1"); await expect(receiptPanel).toContainText("human-ui");
});

test("executed Unit 211 route stays authoritative outside comparison and selection state", async ({ page }) => {
  await openConsole(page);
  await expect(page.locator('[data-route-id="route-011"][data-route-owner="vehicle-011"]')).toHaveCount(1);
  await expect(page.locator('[data-route-id="alternative-route-011-clearance-v1"]')).toHaveCount(0);
  await openRecovery(page);
  await expect(page.locator("#recovery-map-summary")).toHaveAttribute("data-route-state", "comparison");
  const planId = await stageForReview(page); await approve(page);
  await expect.poll(() => toolNames(page)).toContain("recovery_plan_execute");
  await executeTool(page, "recovery_plan_execute", { planId });
  await expect(page.getByText("EXECUTED", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to vehicle details" }).click();
  await expectUnit211AppliedRoute(page);
  await page.keyboard.press("Escape");
  await expectUnit211AppliedRoute(page);
  await page.getByRole("button", { name: "Weather affected" }).click();
  await expectUnit211AppliedRoute(page);
  await page.getByRole("button", { name: "Select Unit 204", exact: true }).click();
  await expectUnit211AppliedRoute(page);
  await panOperationalMap(page);
  await expectUnit211AppliedRoute(page);
  await page.locator(".leaflet-control-zoom-in").click();
  await expectUnit211AppliedRoute(page);
  await page.getByRole("button", { name: "Help", exact: true }).click();
  await expect(page.locator(".help-dialog-content")).toBeVisible();
  await page.keyboard.press("Escape");
  await expectUnit211AppliedRoute(page);
  await page.getByRole("button", { name: "Unit 211", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expectUnit211AppliedRoute(page);

  await executeTool(page, "recovery_reset", {});
  await expect(page.locator('[data-route-id="route-011"][data-route-owner="vehicle-011"]')).toHaveCount(1);
  await expect(page.locator('[data-route-id="alternative-route-011-clearance-v1"]')).toHaveCount(0);
});

test("human rejection exposes no execution authority", async ({ page }) => {
  await openConsole(page); await openRecovery(page); await stageForReview(page); await page.getByRole("button", { name: "Reject" }).click(); await expect(page.getByText("REJECTED", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0); await expect(page.getByRole("button", { name: forbiddenAgentControls })).toHaveCount(0); await expect.poll(() => toolNames(page)).not.toContain("recovery_plan_execute");
  await page.getByRole("button", { name: "Reset demo" }).click(); await stageForReview(page); await page.getByRole("button", { name: "Back to vehicle details" }).click(); await page.getByRole("button", { name: "Delete vehicle" }).click(); await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click(); await expect(page.getByText("INVALIDATED", { exact: true })).toBeVisible(); await expect.poll(() => toolNames(page)).not.toContain("recovery_plan_execute");
});

test("approval enables agent execute and a real failed verification without human execution controls", async ({ page }) => {
  await openConsole(page); await openRecovery(page); const planId = await stageForReview(page); await approve(page); await expect(page.getByRole("button", { name: forbiddenAgentControls })).toHaveCount(0);
  await executeTool(page, "recovery_plan_execute", { planId }); await expect.poll(() => toolNames(page)).toContain("recovery_verify"); await page.getByRole("button", { name: "Back to vehicle details" }).click(); await page.getByRole("button", { name: "Delete vehicle" }).click(); await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click(); await executeTool(page, "recovery_verify", { planId }); await expect(page.getByText("VERIFICATION_FAILED", { exact: true })).toBeVisible(); await expect(page.locator(".verification-matrix [data-status=FAIL]").first()).toBeVisible(); await expect(page.getByRole("heading", { name: "Verified receipt" })).toHaveCount(0);
});

test("second agent execution is idempotent", async ({ page }) => {
  await openConsole(page); await openRecovery(page); const planId = await stageForReview(page); await approve(page); await expect.poll(() => toolNames(page)).toContain("recovery_plan_execute");
  const outcomes = await page.evaluate(async ({ planId }) => { const tool = (window as unknown as { __recoveryTools: RegisteredTool[] }).__recoveryTools.find(({ name }) => name === "recovery_plan_execute")!; return Promise.all([tool.execute({ planId }), tool.execute({ planId })]).then((responses) => responses.map(({ content }) => JSON.parse(content[0].text).data.status).sort()); }, { planId });
  expect(outcomes).toEqual(["ALREADY_EXECUTED", "EXECUTED"]); await expect(page.getByText("EXECUTED", { exact: true })).toBeVisible();
});

test("Reset demo preserves Spanish locale", async ({ page }) => {
  await openConsole(page); await page.getByRole("button", { name: "Language" }).click(); await page.getByRole("menuitem", { name: "Español" }).click(); await page.getByRole("button", { name: "Seleccionar incidencia de gálibo de Unit 211" }).focus(); await page.keyboard.press("Enter"); await page.getByRole("button", { name: "Revisar opciones de recuperación" }).click();
  await expect.poll(() => toolNames(page)).toContain("recovery_plan_stage"); const comparison = await executeTool<{ options: [{ routeId: string }, { alternativeRouteId: string }] }>(page, "recovery_options_compare", {}); if (!comparison.ok) throw new Error(comparison.error.code); await executeTool(page, "recovery_plan_stage", { selectedOptionId: comparison.data.options[1].alternativeRouteId });
  await page.getByRole("button", { name: "Reiniciar demo" }).click(); await expect(page.getByText("IDLE", { exact: true })).toBeVisible(); await expect(page.getByText("Comparación disponible")).toBeVisible(); expect(await page.locator("html").getAttribute("lang")).toBe("es");
});

test("tablet 900x900 keeps the human review usable", async ({ page }) => {
  await openConsole(page, 900, 900); await openRecovery(page); await stageForReview(page); const panel = page.getByRole("dialog", { name: "Unit 211" }); await expect(panel.getByRole("button", { name: "Approve" })).toBeVisible(); await expect(panel.getByRole("button", { name: "Reject" })).toBeVisible(); await expect(page.locator(".recovery-incident-inset")).toBeVisible();
  await expect(panel.locator('[data-human-review-actions="true"]')).toBeInViewport();
  const bounds = await panel.boundingBox(); expect(bounds).not.toBeNull(); expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(900); expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(900); await page.getByRole("button", { name: "Back to vehicle details" }).click(); await expect(page.getByRole("button", { name: "Review recovery options" })).toBeFocused(); await page.getByRole("button", { name: "Review recovery options" }).click(); await page.keyboard.press("Escape"); await expect(page.getByRole("button", { name: "Review recovery options" })).toBeFocused(); await page.keyboard.press("Escape"); await expect(page.locator("#operational-map")).toBeFocused();
});
