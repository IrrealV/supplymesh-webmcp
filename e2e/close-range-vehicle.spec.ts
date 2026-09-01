import { expect, test, type Page } from "@playwright/test";

async function installWebMcp(page: Page): Promise<void> {
  await page.addInitScript(() => Object.defineProperty(document, "modelContext", { configurable: true, value: {
    registerTool: async (_tool: { name: string }, options: { signal: AbortSignal }) => options.signal.addEventListener("abort", () => undefined, { once: true }),
  } }));
}

async function openConsole(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await installWebMcp(page);
  await page.goto("/");
  await expect(page.locator(".console-shell")).toBeVisible();
}

async function selectUnit211(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Select Unit 211 clearance incident", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".fleet-map")).toHaveAttribute("data-close-range-mode", "active");
}

async function expectUnit211LabelClear(page: Page): Promise<void> {
  const label = page.locator("[data-vehicle-label=vehicle-011]");
  await expect(label).toBeVisible();
  const clearance = await label.evaluate((node) => {
    const labelRect = node.getBoundingClientRect();
    const mapRect = node.closest(".fleet-map")!.getBoundingClientRect();
    const truckRect = document.querySelector("[data-vehicle-truck=vehicle-011]")!.closest(".fleet-truck-icon")!.getBoundingClientRect();
    const separate = labelRect.right <= truckRect.left || labelRect.left >= truckRect.right || labelRect.bottom <= truckRect.top || labelRect.top >= truckRect.bottom;
    return { contained: labelRect.left >= mapRect.left && labelRect.right <= mapRect.right && labelRect.top >= mapRect.top && labelRect.bottom <= mapRect.bottom, label: [labelRect.left, labelRect.top, labelRect.right, labelRect.bottom], separate, truck: [truckRect.left, truckRect.top, truckRect.right, truckRect.bottom] };
  });
  expect(clearance.contained).toBe(true);
  expect(clearance.separate, JSON.stringify(clearance)).toBe(true);
}

test.beforeEach(async ({ page }) => page.emulateMedia({ reducedMotion: "reduce" }));

test("selected follow swaps exactly one 2D marker for a static close-range truck", async ({ page }) => {
  await openConsole(page, 1440, 900);
  const map = page.locator(".fleet-map");

  await expect(map).toHaveAttribute("data-close-range-renderer", "css-3d");
  await expect(map).toHaveAttribute("data-close-range-mode", "inactive");
  await expect(page.locator(".fleet-truck-icon")).toHaveCount(15);
  await expect(page.locator("[data-close-range-model]")).toHaveCount(0);
  await expect(page.locator(".map-frame canvas")).toHaveCount(0);

  await selectUnit211(page);

  await expect(map).toHaveAttribute("data-close-range-vehicle-id", "vehicle-011");
  await expect(page.locator(".fleet-truck-icon.close-range-vehicle-active")).toHaveCount(1);
  await expect(page.locator("[data-close-range-model=vehicle-011]")).toBeVisible();
  await expect(page.getByRole("button", { name: "Unit 211", exact: true })).toHaveCount(1);
  await expect(page.locator(".close-range-truck-rig")).toHaveCSS("animation-name", "none");
  await expectUnit211LabelClear(page);

  await page.locator(".map-frame").dispatchEvent("wheel");
  await expect(map).toHaveAttribute("data-close-range-mode", "inactive");
  await expect(page.locator("[data-close-range-model]")).toHaveCount(0);
  await expectUnit211LabelClear(page);

  await page.getByRole("button", { name: "Follow Unit 211" }).click();
  await expect(map).toHaveAttribute("data-close-range-mode", "active");
  await expect(page.locator("[data-close-range-model=vehicle-011]")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(map).toHaveAttribute("data-close-range-mode", "inactive");
  await expect(page.locator("[data-close-range-model]")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Operational map" })).toBeFocused();
});

test("tablet keeps the close-range truck behind its usable inspection drawer", async ({ page }) => {
  await openConsole(page, 900, 900);
  await selectUnit211(page);

  const drawer = page.getByRole("dialog", { name: "Unit 211" });
  const bounds = await drawer.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(900);
  await expect(page.locator("[data-close-range-model=vehicle-011]")).toBeVisible();
  await expect(page.locator(".fleet-label-icon")).toHaveCount(15);
  expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(900);

  await page.locator(".map-frame").dispatchEvent("wheel");
  await page.getByRole("button", { name: "Follow Unit 211" }).click();
  await expect(drawer).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Operational map" })).toBeFocused();
});

test("forced WebGL absence retains the selected 2D marker", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", { configurable: true, value: () => null });
  });
  await openConsole(page, 1440, 900);
  const map = page.locator(".fleet-map");

  await expect(map).toHaveAttribute("data-close-range-renderer", "2d-fallback");
  await page.getByRole("button", { name: "Select Unit 211 clearance incident", exact: true }).focus();
  await page.keyboard.press("Enter");

  await expect(map).toHaveAttribute("data-close-range-mode", "inactive");
  await expect(page.locator("[data-close-range-model]")).toHaveCount(0);
  await expect(page.locator(".fleet-truck-icon")).toHaveCount(15);
  await expect(page.locator(".fleet-truck-icon.map-layer-selected .fleet-vehicle-glyph")).toBeVisible();
});
