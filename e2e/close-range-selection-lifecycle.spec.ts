import { mkdir } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const evidenceDirectory = "test-results/close-range-selection-lifecycle";

async function installWebMcp(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: {
        registerTool: async (_tool: { name: string }, options: { signal: AbortSignal }) => {
          options.signal.addEventListener("abort", () => undefined, { once: true });
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
}

async function visibleTruckCount(page: Page): Promise<number> {
  return Number(await page.locator("[data-three-canvas=shared]").getAttribute("data-three-visible-trucks"));
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("close range hides the legacy aura and keeps the shared 3D renderer alive when inspection closes", async ({ page }) => {
  await openConsole(page);

  const unit206Marker = page.locator('.fleet-truck-icon:has([data-vehicle-truck="vehicle-006"])');
  await expect(unit206Marker).toBeVisible();
  await unit206Marker.focus();
  await page.keyboard.press("Enter");

  await expect(page.locator(".vehicle-inspection")).toBeVisible();
  await expect(page.locator(".fleet-map")).toHaveAttribute("data-close-range-mode", "active");

  const canvas = page.locator("[data-three-canvas=shared]");
  await expect(canvas).toHaveCount(1);
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute("data-three-selection-style", "model-emphasis");
  await expect(canvas).toHaveAttribute("data-three-selected-vehicle", "vehicle-006");
  await expect.poll(() => visibleTruckCount(page)).toBeGreaterThan(0);

  const legacyAura = page.locator(".fleet-truck-icon.map-layer-selected.close-range-vehicle-active .fleet-selection-aura");
  await expect(legacyAura).toHaveCount(1);
  await expect(legacyAura).toHaveCSS("display", "none");

  const rendererGeneration = await canvas.getAttribute("data-three-renderer-generation");
  expect(rendererGeneration).not.toBeNull();

  await page.getByRole("button", { name: "Close inspection" }).click();

  await expect(page.locator(".vehicle-inspection")).toHaveCount(0);
  await expect(page.locator(".fleet-map")).toHaveAttribute("data-close-range-mode", "active");
  await expect(canvas).toHaveCount(1);
  await expect(canvas).toHaveAttribute("data-three-renderer-generation", rendererGeneration!);
  await expect(canvas).toHaveAttribute("data-three-selected-vehicle", "");
  await expect.poll(() => visibleTruckCount(page)).toBeGreaterThan(0);

  await mkdir(evidenceDirectory, { recursive: true });
  await page.screenshot({ animations: "disabled", path: `${evidenceDirectory}/truck-remains-after-inspection-close.png` });
});
