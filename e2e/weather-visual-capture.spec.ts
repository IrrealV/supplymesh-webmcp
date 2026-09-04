import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const outputDirectory = "test-results/weather-visual-review";

async function installWebMcp(page: Page): Promise<void> {
  await page.addInitScript(() => Object.defineProperty(document, "modelContext", {
    configurable: true,
    value: {
      registerTool: async (_tool: { name: string }, options: { signal: AbortSignal }) => {
        options.signal.addEventListener("abort", () => undefined, { once: true });
      },
    },
  }));
}

async function settleMap(page: Page): Promise<void> {
  await page.waitForTimeout(1_100);
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

async function setMapView(page: Page, latitude: number, longitude: number, zoom: number): Promise<void> {
  await page.evaluate(({ latitude, longitude, zoom }) => {
    const container = document.querySelector(".leaflet-container") as HTMLElement & {
      _leaflet_map?: { setView(coordinates: [number, number], nextZoom: number, options?: { animate: boolean }): void };
    };
    container._leaflet_map?.setView([latitude, longitude], zoom, { animate: false });
  }, { latitude, longitude, zoom });
  await settleMap(page);
}

type CaptureDefinition = Readonly<{
  fileName: string;
  kind: "heavy-rain" | "severe-snow" | "severe-storm" | "calima";
  latitude: number;
  longitude: number;
  zoom: number;
}>;

test("capture geographic weather zones for human visual review", async ({ page }) => {
  test.setTimeout(90_000);
  mkdirSync(outputDirectory, { recursive: true });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await installWebMcp(page);
  await page.goto("/");
  await expect(page.locator(".console-shell")).toBeVisible();
  await settleMap(page);

  await expect(page.locator(".weather-geographic-overlay")).toHaveCount(0);
  await page.screenshot({ path: `${outputDirectory}/00-overview-clean.png` });

  const captures: readonly CaptureDefinition[] = [
    { fileName: "01-rain-mid.png", kind: "heavy-rain", latitude: 43.325, longitude: -8.4, zoom: 10 },
    { fileName: "02-rain-close.png", kind: "heavy-rain", latitude: 43.325, longitude: -8.4, zoom: 14.5 },
    { fileName: "03-snow-mid.png", kind: "severe-snow", latitude: 42.725, longitude: -5.585, zoom: 10 },
    { fileName: "04-snow-close.png", kind: "severe-snow", latitude: 42.725, longitude: -5.585, zoom: 14.5 },
    { fileName: "05-storm-mid.png", kind: "severe-storm", latitude: 41.65, longitude: -0.875, zoom: 10 },
    { fileName: "06-storm-close.png", kind: "severe-storm", latitude: 41.65, longitude: -0.875, zoom: 14.5 },
    { fileName: "07-calima-mid.png", kind: "calima", latitude: 37.1, longitude: -3.55, zoom: 10 },
    { fileName: "08-calima-close.png", kind: "calima", latitude: 37.1, longitude: -3.55, zoom: 14.5 },
  ];

  const metrics: Array<Record<string, number | string | boolean>> = [];
  for (const capture of captures) {
    await setMapView(page, capture.latitude, capture.longitude, capture.zoom);
    const overlay = page.locator(`.weather-geographic-${capture.kind}`);
    await expect(overlay).toHaveCount(1);
    await expect(overlay).toBeVisible();
    const measurement = await overlay.evaluate((node) => {
      const overlayRect = node.getBoundingClientRect();
      const mapRect = node.closest(".fleet-map")?.getBoundingClientRect();
      return {
        width: overlayRect.width,
        height: overlayRect.height,
        mapWidth: mapRect?.width ?? 0,
        mapHeight: mapRect?.height ?? 0,
        intersectsViewport: overlayRect.right > (mapRect?.left ?? 0)
          && overlayRect.left < (mapRect?.right ?? 0)
          && overlayRect.bottom > (mapRect?.top ?? 0)
          && overlayRect.top < (mapRect?.bottom ?? 0),
      };
    });
    expect(measurement.width).toBeGreaterThan(0);
    expect(measurement.height).toBeGreaterThan(0);
    expect(measurement.intersectsViewport).toBe(true);
    metrics.push({
      fileName: capture.fileName,
      kind: capture.kind,
      zoom: capture.zoom,
      ...measurement,
    });
    await page.screenshot({ path: `${outputDirectory}/${capture.fileName}` });
  }

  writeFileSync(`${outputDirectory}/metrics.json`, JSON.stringify(metrics, null, 2));
});
