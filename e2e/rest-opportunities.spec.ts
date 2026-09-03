import { mkdir } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

type ToolResponse = { content: [{ text: string }] };
type RegisteredTool = { name: string; execute(input: unknown): ToolResponse | Promise<ToolResponse> };
type Result<T> = { ok: true; data: T } | { ok: false; error: { code: string } };
type RestComparison = {
  recommendedOptionId: string | null;
  policy: { mandatoryRestIsNeverReduced: true; humanSchedulesRest: true; routeGeometryUnchanged: true };
  options: Array<{
    id: string;
    extraRestMinutes: number;
    contractualDelayMinutes: number;
    feasible: boolean;
    recommended: boolean;
  }>;
  scheduledRest: null | { opportunityId: string; extraRestMinutes: number; projectedArrivalAt: string; scheduledBy: string };
  verification: null | { status: string; checks: Array<{ name: string; status: string }> };
};
type Scenario = {
  vehicles: Array<{
    internalId: string;
    routeId: string;
    timing: { eta: string };
    scheduledRest?: null | { opportunityId: string; extraRestMinutes: number };
  }>;
};

const evidenceDirectory = "test-results/rest-opportunities";

async function installWebMcp(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type Tool = { name: string; execute(input: unknown): unknown };
    const tools: Tool[] = [];
    Object.defineProperty(window, "__restQaTools", { configurable: true, value: tools });
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
  await expect.poll(() => toolNames(page)).toContain("rest_opportunities_compare");
}

async function toolNames(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const tools = (window as unknown as { __restQaTools: RegisteredTool[] }).__restQaTools;
    return [...new Set(tools.map(({ name }) => name))].sort();
  });
}

async function executeTool<T>(page: Page, name: string, input: unknown): Promise<Result<T>> {
  return page.evaluate(async ({ input, name }) => {
    const tools = (window as unknown as { __restQaTools: RegisteredTool[] }).__restQaTools;
    const tool = [...tools].reverse().find((candidate) => candidate.name === name);
    if (tool === undefined) throw new Error(`Missing WebMCP tool ${name}.`);
    const response = await tool.execute(input);
    return JSON.parse(response.content[0].text) as Result<T>;
  }, { input, name });
}

async function capture(page: Page, name: string): Promise<void> {
  await mkdir(evidenceDirectory, { recursive: true });
  await page.screenshot({ animations: "disabled", path: `${evidenceDirectory}/${name}` });
}

async function selectUnit212(page: Page): Promise<void> {
  const marker = page.locator('[data-vehicle-truck="vehicle-012"]');
  await expect(marker).toBeVisible();
  await marker.click();
  await expect(page.getByRole("heading", { name: "Driver rest opportunity" })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.removeItem("scenario-overrides:v1"));
});

test("agent compares driver-first rest opportunities while only the human can schedule one", async ({ page }) => {
  await openConsole(page);

  const names = await toolNames(page);
  expect(names).toContain("rest_opportunities_compare");
  expect(names.some((name) => /rest.*schedule|schedule.*rest|rest.*approve/i.test(name))).toBe(false);

  const comparison = await executeTool<RestComparison>(page, "rest_opportunities_compare", { vehicleId: "vehicle-012" });
  expect(comparison.ok).toBe(true);
  if (!comparison.ok) return;
  expect(comparison.data.recommendedOptionId).toBe("rest-window-max-55");
  expect(comparison.data.policy).toEqual({
    mandatoryRestIsNeverReduced: true,
    humanSchedulesRest: true,
    routeGeometryUnchanged: true,
  });
  expect(comparison.data.options.map(({ extraRestMinutes, contractualDelayMinutes, feasible, recommended }) => ({ extraRestMinutes, contractualDelayMinutes, feasible, recommended }))).toEqual([
    { extraRestMinutes: 40, contractualDelayMinutes: 0, feasible: true, recommended: false },
    { extraRestMinutes: 55, contractualDelayMinutes: 10, feasible: true, recommended: true },
    { extraRestMinutes: 70, contractualDelayMinutes: 27, feasible: false, recommended: false },
  ]);
  expect(await executeTool(page, "rest_opportunities_compare", { vehicleId: "vehicle-012", maxDelayMinutes: 999 })).toMatchObject({ ok: false, error: { code: "invalid-input" } });

  await selectUnit212(page);
  await page.getByRole("button", { name: "Compare extra rest" }).click();
  await expect(page.locator("[data-rest-opportunity]")).toHaveCount(3);
  await expect(page.locator('[data-rest-opportunity="rest-window-max-55"]')).toContainText("Recommended");
  await expect(page.locator('[data-rest-opportunity="rest-window-late-70"]')).toContainText("Rejected");
  await expect(page.locator(".rest-opportunity-marker")).toHaveCount(3);
  await capture(page, "01-agent-comparison-human-choice.png");

  const routePath = page.locator(".route-corridor-selected");
  await expect(routePath).toHaveCount(1);
  const routeBefore = await routePath.getAttribute("d");

  await page.getByRole("button", { name: "Schedule rest: Corridor rest point B" }).click();
  await expect(page.locator('[data-rest-scheduled="rest-window-max-55"]')).toContainText("55 min");
  await expect(page.locator('[data-rest-scheduled="rest-window-max-55"]')).toContainText("Plan verified · 7/7 PASS");
  await expect(page.locator(".rest-opportunity-scheduled")).toHaveCount(1);
  expect(await routePath.getAttribute("d")).toBe(routeBefore);

  const scenario = await executeTool<Scenario>(page, "scenario_current", {});
  expect(scenario.ok).toBe(true);
  if (!scenario.ok) return;
  const vehicle = scenario.data.vehicles.find(({ internalId }) => internalId === "vehicle-012");
  expect(vehicle).toMatchObject({
    routeId: "route-012",
    timing: { eta: "2026-08-28T12:31:00.000Z" },
    scheduledRest: { opportunityId: "rest-window-max-55", extraRestMinutes: 55 },
  });

  const verified = await executeTool<RestComparison>(page, "rest_opportunities_compare", { vehicleId: "vehicle-012" });
  expect(verified).toMatchObject({
    ok: true,
    data: {
      scheduledRest: { opportunityId: "rest-window-max-55", scheduledBy: "human-ui" },
      verification: { status: "PASS" },
    },
  });
  if (verified.ok) {
    expect(verified.data.verification?.checks).toHaveLength(7);
    expect(verified.data.verification?.checks.every(({ status }) => status === "PASS")).toBe(true);
  }
  await capture(page, "02-human-scheduled-verified-rest.png");
});

test("scheduled extra rest persists, localizes, and can be cleared by the human", async ({ page }) => {
  await openConsole(page);
  await selectUnit212(page);
  await page.getByRole("button", { name: "Compare extra rest" }).click();
  await page.getByRole("button", { name: "Schedule rest: Corridor rest point A" }).click();
  await expect(page.locator('[data-rest-scheduled="rest-window-early-40"]')).toBeVisible();

  await page.reload();
  await expect.poll(() => toolNames(page)).toContain("rest_opportunities_compare");
  await selectUnit212(page);
  await expect(page.locator('[data-rest-scheduled="rest-window-early-40"]')).toContainText("40 min");

  await page.getByRole("button", { name: "Language" }).click();
  await page.getByRole("menuitem", { name: "Español" }).click();
  await expect(page.getByRole("heading", { name: "Oportunidad de descanso" })).toBeVisible();
  await expect(page.locator('[data-rest-scheduled="rest-window-early-40"]')).toContainText("Descanso programado");
  await capture(page, "03-rest-plan-spanish.png");

  await page.getByRole("button", { name: "Quitar descanso programado" }).click();
  await expect(page.locator("[data-rest-scheduled]")).toHaveCount(0);
  const restored = await executeTool<Scenario>(page, "scenario_current", {});
  expect(restored).toMatchObject({
    ok: true,
    data: {
      vehicles: expect.arrayContaining([
        expect.objectContaining({
          internalId: "vehicle-012",
          timing: { eta: "2026-08-28T11:30:00Z" },
          scheduledRest: null,
        }),
      ]),
    },
  });
});
