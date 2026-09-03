import { mkdir } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const evidenceDirectory = "test-results/threejs-presentation";

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

async function setMapView(page: Page, zoom: number): Promise<void> {
  await page.locator(".fleet-map").evaluate((node, targetZoom) => {
    const element = node as HTMLElement & {
      _leaflet_map?: {
        setView(center: [number, number], zoom: number, options: { animate: boolean }): void;
      };
    };
    element._leaflet_map?.setView([39.862774, -4.027341], targetZoom, { animate: false });
  }, zoom);
  await expect(page.locator(".fleet-map")).toHaveAttribute("data-close-range-mode", zoom >= 14 ? "active" : "inactive");
}

async function capture(page: Page, name: string): Promise<void> {
  await mkdir(evidenceDirectory, { recursive: true });
  await page.screenshot({ animations: "disabled", path: `${evidenceDirectory}/${name}` });
}

async function expectRenderedModel(page: Page, zoom: string): Promise<void> {
  const canvas = page.locator("[data-three-canvas=shared]");
  await expect(canvas).toHaveCount(1);
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute("data-three-model", "volumetric-v2");
  await expect(canvas).toHaveAttribute("data-three-zoom", zoom);
  await expect.poll(async () => Number(await canvas.getAttribute("data-three-visible-trucks"))).toBeGreaterThan(0);
  await expect(page.locator(".fleet-map")).toHaveAttribute("data-three-model", "volumetric-v2");
}

async function visibleLabelCount(page: Page): Promise<number> {
  return page.locator(".fleet-label-icon").evaluateAll((roots) => roots.filter((root) => {
    const style = getComputedStyle(root);
    const rect = root.getBoundingClientRect();
    return style.visibility === "visible" && style.opacity !== "0" && rect.width > 0 && rect.height > 0;
  }).length);
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await installWebMcp(page);
  await page.goto("/");
  await expect(page.locator(".console-shell")).toBeVisible();
});

test("volumetric trucks remain readable and map-anchored at zoom 14, 15.5, and 17", async ({ page }) => {
  await setMapView(page, 13.5);
  await expect(page.locator("[data-three-canvas=shared]")).toHaveCount(0);

  const unit211 = page.locator('.fleet-truck-icon:has([data-vehicle-truck="vehicle-011"])');
  await expect(unit211).toBeVisible();
  await unit211.click();
  await expect(page.locator(".vehicle-inspection")).toBeVisible();

  await setMapView(page, 14);
  await expectRenderedModel(page, "14.00");
  await expect.poll(() => visibleLabelCount(page)).toBeGreaterThan(0);
  expect(await visibleLabelCount(page)).toBeLessThan(15);
  await capture(page, "01-threejs-zoom-14.png");

  await setMapView(page, 15.5);
  await expectRenderedModel(page, "15.50");
  await expect(page.locator("[data-vehicle-label=vehicle-011]")).toBeVisible();
  await capture(page, "02-threejs-zoom-15-5.png");

  await setMapView(page, 17);
  await expectRenderedModel(page, "17.00");
  await expect(page.locator("[data-vehicle-label=vehicle-011]")).toBeVisible();
  await expect.poll(() => visibleLabelCount(page)).toBeGreaterThan(0);
  expect(await visibleLabelCount(page)).toBeLessThanOrEqual(3);
  await capture(page, "03-threejs-zoom-17.png");

  await setMapView(page, 13.5);
  await expect(page.locator("[data-three-canvas=shared]")).toHaveCount(0);
  await expect(page.locator('[data-vehicle-truck="vehicle-011"]')).toBeVisible();
});
