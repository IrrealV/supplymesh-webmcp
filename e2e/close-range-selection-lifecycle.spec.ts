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

async function setMapZoom(page: Page, zoom: number): Promise<void> {
  await page.locator(".fleet-map").evaluate(async (node, targetZoom) => {
    const element = node as HTMLElement & {
      _leaflet_map?: {
        getCenter(): { lat: number; lng: number };
        setView(center: { lat: number; lng: number }, zoom: number, options: { animate: boolean }): void;
      };
    };
    const map = element._leaflet_map;
    if (map === undefined) throw new Error("Leaflet map is unavailable.");
    map.setView(map.getCenter(), targetZoom, { animate: false });
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }, zoom);
  await expect(page.locator(".fleet-map")).toHaveAttribute("data-close-range-mode", zoom >= 14 ? "active" : "inactive");
}

type LegacyMarkerPaint = Readonly<{
  auraDisplay: string;
  auraAfterContent: string;
  auraAfterDisplay: string;
  auraBeforeContent: string;
  auraBeforeDisplay: string;
  pinAfterContent: string;
  pinAfterDisplay: string;
  pinAnimationName: string;
  pinBackground: string;
  pinBeforeContent: string;
  pinBeforeDisplay: string;
  pinBorderColor: string;
  pinBoxShadow: string;
  pinOpacity: string;
}>;

async function legacyMarkerPaint(page: Page, vehicleId: string): Promise<LegacyMarkerPaint> {
  return page.locator(`[data-vehicle-truck="${vehicleId}"]`).evaluate((pin) => {
    const aura = pin.querySelector<HTMLElement>(".fleet-selection-aura");
    if (aura === null) throw new Error("Legacy selection aura is unavailable.");
    const pinStyle = getComputedStyle(pin);
    const pinBefore = getComputedStyle(pin, "::before");
    const pinAfter = getComputedStyle(pin, "::after");
    const auraBefore = getComputedStyle(aura, "::before");
    const auraAfter = getComputedStyle(aura, "::after");
    return {
      auraDisplay: getComputedStyle(aura).display,
      auraAfterContent: auraAfter.content,
      auraAfterDisplay: auraAfter.display,
      auraBeforeContent: auraBefore.content,
      auraBeforeDisplay: auraBefore.display,
      pinAfterContent: pinAfter.content,
      pinAfterDisplay: pinAfter.display,
      pinAnimationName: pinStyle.animationName,
      pinBackground: pinStyle.backgroundColor,
      pinBeforeContent: pinBefore.content,
      pinBeforeDisplay: pinBefore.display,
      pinBorderColor: pinStyle.borderTopColor,
      pinBoxShadow: pinStyle.boxShadow,
      pinOpacity: pinStyle.opacity,
    };
  });
}

function expectLegacyMarkerNotToPaint(paint: LegacyMarkerPaint): void {
  expect(paint).toEqual({
    auraDisplay: "none",
    auraAfterContent: "none",
    auraAfterDisplay: "none",
    auraBeforeContent: "none",
    auraBeforeDisplay: "none",
    pinAfterContent: "none",
    pinAfterDisplay: "none",
    pinAnimationName: "none",
    pinBackground: "rgba(0, 0, 0, 0)",
    pinBeforeContent: "none",
    pinBeforeDisplay: "none",
    pinBorderColor: "rgba(0, 0, 0, 0)",
    pinBoxShadow: "none",
    pinOpacity: "0",
  });
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
  await expect(page.locator(".fleet-map")).toHaveAttribute("data-close-range-vehicle-id", "vehicle-006");

  const canvas = page.locator("[data-three-canvas=shared]");
  await expect(canvas).toHaveCount(1);
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute("data-three-selection-style", "model-emphasis");
  await expect(canvas).toHaveAttribute("data-three-selected-vehicle", "vehicle-006");
  await expect.poll(() => visibleTruckCount(page)).toBeGreaterThan(0);

  expectLegacyMarkerNotToPaint(await legacyMarkerPaint(page, "vehicle-006"));
  expectLegacyMarkerNotToPaint(await legacyMarkerPaint(page, "vehicle-005"));

  const rendererGeneration = await canvas.getAttribute("data-three-renderer-generation");
  expect(rendererGeneration).not.toBeNull();
  await canvas.evaluate((node) => {
    (window as typeof window & { __closeRangeCanvas?: Element }).__closeRangeCanvas = node;
  });

  await page.getByRole("button", { name: "Close inspection" }).click();

  await expect(page.locator(".vehicle-inspection")).toHaveCount(0);
  await expect(page.locator(".fleet-map")).toHaveAttribute("data-close-range-mode", "active");
  await expect(canvas).toHaveCount(1);
  await expect(canvas).toHaveAttribute("data-three-renderer-generation", rendererGeneration!);
  await expect(canvas).toHaveAttribute("data-three-selected-vehicle", "");
  expect(await canvas.evaluate((node) => (window as typeof window & { __closeRangeCanvas?: Element }).__closeRangeCanvas === node)).toBe(true);
  await expect.poll(() => visibleTruckCount(page)).toBeGreaterThan(0);
  await expect(page.locator(".fleet-map")).not.toHaveAttribute("data-close-range-vehicle-id");
  await expect(page.locator(".fleet-map")).toHaveAttribute("data-close-range-camera", "static");
  expectLegacyMarkerNotToPaint(await legacyMarkerPaint(page, "vehicle-006"));

  await mkdir(evidenceDirectory, { recursive: true });
  await page.screenshot({ animations: "disabled", path: `${evidenceDirectory}/truck-remains-after-inspection-close.png` });

  await setMapZoom(page, 13.5);
  await expect(page.locator("[data-three-canvas=shared]")).toHaveCount(0);
  const restoredPin = await legacyMarkerPaint(page, "vehicle-006");
  expect(restoredPin.pinOpacity).toBe("1");
  expect(restoredPin.pinBackground).not.toBe("rgba(0, 0, 0, 0)");
});
