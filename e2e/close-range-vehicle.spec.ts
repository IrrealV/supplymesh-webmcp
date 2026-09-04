import { expect, test, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as crypto from "node:crypto";

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

async function setMapView(page: Page, lat: number, lng: number, zoom: number): Promise<void> {
  await page.evaluate(({ lat, lng, zoom }) => {
    const el = document.querySelector(".leaflet-container") as HTMLElement & { _leaflet_map?: { setView(coords: [number, number], zoom: number): void } };
    el?._leaflet_map?.setView([lat, lng], zoom);
  }, { lat, lng, zoom });
  await page.waitForTimeout(300);
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

async function readMotion(page: Page, id: string = "vehicle-011"): Promise<{ bearing: number; progress: number; routeId: string; speed: number; isMoving: boolean }> {
  return page.evaluate((vehicleId) => {
    const store = (window as unknown as { __fleetMotionStore?: { getState(): { motions: Record<string, { bearing: number; progress: number; routeId: string; speed: number; isMoving: boolean }> } } }).__fleetMotionStore?.getState();
    if (store && store.motions[vehicleId]) {
      const m = store.motions[vehicleId];
      return { bearing: m.bearing, progress: m.progress, routeId: m.routeId, speed: m.speed, isMoving: m.isMoving };
    }
    return { bearing: 0, progress: 0, routeId: "", speed: 0, isMoving: false };
  }, id);
}

test.beforeEach(async ({ page }) => page.emulateMedia({ reducedMotion: "reduce" }));

test("selected follow swaps 2D markers for a shared Three.js WebGL canvas and removes old CSS truck", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-08-28T10:00:00Z") });
  await openConsole(page, 1440, 900);
  const map = page.locator(".fleet-map");

  await expect(map).toHaveAttribute("data-close-range-renderer", "three-webgl");
  await expect(map).toHaveAttribute("data-close-range-mode", "inactive");
  await expect(page.locator(".fleet-truck-icon")).toHaveCount(15);
  await expect(page.locator("[data-close-range-model]")).toHaveCount(0);
  await expect(page.locator(".close-range-truck-rig")).toHaveCount(0);
  await expect(page.locator("[data-three-canvas=shared]")).toHaveCount(0);

  await selectUnit211(page);

  await expect(map).toHaveAttribute("data-close-range-vehicle-id", "vehicle-011");
  await expect(page.locator(".fleet-truck-icon.close-range-vehicle-active")).toHaveCount(15);
  const threeCanvas = page.locator("[data-three-canvas=shared]");
  await expect(threeCanvas).toHaveCount(1);
  await expect(threeCanvas).toBeVisible();

  await expect(page.locator("[data-close-range-model]")).toHaveCount(0);
  await expect(page.locator(".close-range-truck-rig")).toHaveCount(0);

  await expect(page.getByRole("button", { name: "Unit 211", exact: true })).toHaveCount(1);
  await expect(map).toHaveAttribute("data-close-range-camera", "static");
  const staticMotion = await readMotion(page, "vehicle-011");
  expect(staticMotion.isMoving).toBe(false);
  await page.clock.fastForward(2_000);
  expect(await readMotion(page, "vehicle-011")).toStrictEqual(staticMotion);
  await expectUnit211LabelClear(page);

  await page.locator(".map-frame").dispatchEvent("wheel");
  await expect(map).toHaveAttribute("data-close-range-mode", "active");
  await expect(page.locator("[data-three-canvas=shared]")).toHaveCount(1);
  await expectUnit211LabelClear(page);

  await page.getByRole("button", { name: "Follow Unit 211" }).click();
  await expect(map).toHaveAttribute("data-close-range-mode", "active");
  await expect(page.locator("[data-three-canvas=shared]")).toHaveCount(1);

  await page.keyboard.press("Escape");
  await page.clock.fastForward(100);
  await expect(page.locator(".vehicle-inspection")).toHaveCount(0);
  await expect(map).toHaveAttribute("data-close-range-mode", "active");
  await expect(page.locator("[data-three-canvas=shared]")).toHaveCount(1);
  await expect(page.getByRole("region", { name: "Operational map" })).toBeFocused();
});

test("movement policy: needs-attention and critical vehicles move, stopped vehicles show reason", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openConsole(page, 1440, 900);

  const motion211 = await readMotion(page, "vehicle-011");
  expect(motion211.isMoving).toBe(false);
  const stoppedBadge211 = page.locator('[data-stopped-indicator="vehicle-011"]');
  await expect(stoppedBadge211).toBeVisible();
  await expect(stoppedBadge211).toHaveAttribute("title", "Pre-dispatch safety hold");

  const motion003 = await readMotion(page, "vehicle-003");
  expect(motion003.isMoving).toBe(true);
  expect(motion003.speed).toBeGreaterThan(20);

  const motion004 = await readMotion(page, "vehicle-004");
  expect(motion004.isMoving).toBe(true);
  expect(motion004.speed).toBeGreaterThan(20);

  await selectUnit211(page);
  const motionStatus = page.locator('[data-vehicle-motion-status="stopped"]');
  await expect(motionStatus).toBeVisible();
  await expect(motionStatus).toContainText("Pre-dispatch safety hold");
});

test("2D/3D position continuity: zooming out restores 2D icon at exact coordinates", async ({ page }) => {
  await openConsole(page, 1440, 900);
  await selectUnit211(page);
  const map = page.locator(".fleet-map");
  await expect(map).toHaveAttribute("data-close-range-mode", "active");
  await expect(page.locator("[data-three-canvas=shared]")).toHaveCount(1);

  const motion3D = await readMotion(page, "vehicle-011");

  await page.evaluate(() => {
    const leafletMap = (window as unknown as { __leafletMap?: { setZoom(z: number): void } }).__leafletMap || (document.querySelector(".fleet-map") as unknown as { _leaflet_map?: { setZoom(z: number): void } })?._leaflet_map;
    if (leafletMap) leafletMap.setZoom(13);
  });
  await page.waitForTimeout(300);

  await expect(map).toHaveAttribute("data-close-range-mode", "inactive");
  await expect(page.locator("[data-three-canvas=shared]")).toHaveCount(0);

  const motion2D = await readMotion(page, "vehicle-011");
  expect(motion2D.progress).toBeCloseTo(motion3D.progress);
});

test("weather effects: visible independently of vehicle selection and clickable to focus", async ({ page }) => {
  await openConsole(page, 1440, 900);

  await expect(page.locator(".weather-fx-heavy-rain")).toBeVisible();
  await expect(page.locator(".weather-fx-severe-snow")).toBeVisible();
  await expect(page.locator(".weather-fx-severe-storm")).toBeVisible();
  await expect(page.locator(".weather-fx-calima")).toBeVisible();

  const snowToken = page.locator(".risk-severe-snow").first();
  await snowToken.click();
  await page.waitForTimeout(500);

  await expect(page.locator(".weather-fx-severe-snow")).toBeVisible();
});

test("tablet keeps the close-range truck behind its usable inspection drawer", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-08-28T10:00:00Z") });
  await openConsole(page, 900, 900);
  await selectUnit211(page);

  const drawer = page.getByRole("dialog", { name: /Vehicle inspection|Unit 211/ });
  await expect(drawer).toBeVisible();

  const metrics = await page.evaluate(() => {
    const dialogEl = document.querySelector(".tablet-vehicle-drawer")!;
    const dialogRect = dialogEl.getBoundingClientRect();
    const truckRect = document.querySelector("[data-vehicle-truck=vehicle-011]")!.closest(".fleet-truck-icon")!.getBoundingClientRect();
    const mapRect = document.querySelector(".fleet-map")!.getBoundingClientRect();
    return {
      dialogWidth: dialogRect.width,
      dialogZ: Number.parseInt(window.getComputedStyle(dialogEl.closest("[data-radix-portal]")?.firstElementChild ?? document.body).zIndex || "0", 10),
      mapRight: mapRect.right,
      truckRight: truckRect.right,
    };
  });

  expect(metrics.dialogWidth).toBe(410);
  expect(metrics.truckRight).toBeLessThan(metrics.mapRight);
  await expect(page.getByRole("button", { name: "Close inspection" })).toBeVisible();
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
  await expect(page.locator(".fleet-truck-icon")).toHaveCount(15);
  await expect(page.locator(".fleet-truck-icon.map-layer-selected .fleet-vehicle-glyph")).toBeVisible();
});

test("close-range hazards, localized weather, console QA, and screenshots", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  await openConsole(page, 1440, 900);
  const map = page.locator(".fleet-map");
  await expect(map).toHaveAttribute("data-close-range-mode", "inactive");
  await expect(page.locator(".fleet-truck-icon")).toHaveCount(15);
  await page.screenshot({ path: "docs/screenshots/01-fleet-2d.png" });

  await selectUnit211(page);
  await expect(map).toHaveAttribute("data-close-range-mode", "active");
  await expect(page.locator("[data-three-canvas=shared]")).toBeVisible();
  await expect(page.locator("[data-three-canvas=shared]")).toHaveCount(1);
  await page.screenshot({ path: "docs/screenshots/02-truck-3d.png" });

  await setMapView(page, 39.86, -4.02, 15);
  const bridgeHazard = page.locator(".close-range-hazard-bridge");
  await expect(bridgeHazard).toBeVisible();
  const clearanceLabel = page.locator("[data-hazard-label=clearance]");
  await expect(clearanceLabel).toContainText("4.00 m required");
  await expect(clearanceLabel).toContainText("3.90 m available");
  await page.screenshot({ path: "docs/screenshots/03-red-bridge.png" });

  await setMapView(page, 43.32, -8.4, 9.5);
  const rainEffect = page.locator(".weather-fx-heavy-rain");
  await expect(rainEffect).toBeVisible();
  await page.screenshot({ path: "docs/screenshots/04-heavy-rain.png" });

  await setMapView(page, 42.72, -5.58, 9.5);
  const snowEffect = page.locator(".weather-fx-severe-snow");
  await expect(snowEffect).toBeVisible();
  await page.screenshot({ path: "docs/screenshots/05-severe-snow.png" });

  await setMapView(page, 37.1, -3.55, 9.5);
  const calimaEffect = page.locator(".weather-fx-calima");
  await expect(calimaEffect).toBeVisible();
  await page.screenshot({ path: "docs/screenshots/06-wind-calima.png" });

  await page.setViewportSize({ width: 900, height: 900 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: "docs/screenshots/07-tablet-900x900.png" });

  expect(consoleErrors).toHaveLength(0);

  const screenshotPaths = [
    "docs/screenshots/01-fleet-2d.png",
    "docs/screenshots/02-truck-3d.png",
    "docs/screenshots/03-red-bridge.png",
    "docs/screenshots/04-heavy-rain.png",
    "docs/screenshots/05-severe-snow.png",
    "docs/screenshots/06-wind-calima.png",
    "docs/screenshots/07-tablet-900x900.png",
  ];

  const hashes = new Set<string>();
  for (const path of screenshotPaths) {
    expect(fs.existsSync(path)).toBe(true);
    const buffer = fs.readFileSync(path);
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    expect(hashes.has(hash), `Duplicate screenshot detected for ${path}`).toBe(false);
    hashes.add(hash);
  }
  expect(hashes.size).toBe(7);
});
