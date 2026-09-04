import { expect, test, type Page } from "@playwright/test";

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

async function setMapView(page: Page, latitude: number, longitude: number, zoom: number): Promise<void> {
  await page.evaluate(({ latitude, longitude, zoom }) => {
    const container = document.querySelector(".leaflet-container") as HTMLElement & {
      _leaflet_map?: { setView(coordinates: [number, number], nextZoom: number, options?: { animate: boolean }): void };
    };
    container._leaflet_map?.setView([latitude, longitude], zoom, { animate: false });
  }, { latitude, longitude, zoom });
  await page.waitForTimeout(250);
}

test("weather remains geographic: clean overview, bounded mid-zoom effect, and natural map scaling", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await installWebMcp(page);
  await page.goto("/");
  await expect(page.locator(".console-shell")).toBeVisible();

  const map = page.locator(".fleet-map");
  await expect(map).toBeVisible();

  // Overview keeps only compact tokens and geographic polygon outlines.
  await expect(page.locator(".weather-geographic-overlay")).toHaveCount(0);
  await expect(page.locator(".weather-fx-zone")).toHaveCount(0);
  await expect(page.locator(".risk-heavy-rain")).not.toHaveCount(0);
  await expect(page.locator(".risk-severe-snow")).not.toHaveCount(0);

  // A weather token frames its geographic bounds and reveals the richer layer.
  await page.locator(".risk-heavy-rain").first().click();
  const rain = page.locator(".weather-geographic-heavy-rain");
  await expect(rain).toBeVisible();
  await expect(rain).toHaveClass(/weather-geographic-mid/);

  // The image overlay is tied to geographic bounds, so its pixel footprint
  // grows naturally as the map zooms in instead of remaining a 360px circle.
  await setMapView(page, 43.325, -8.4, 9);
  const widthAtNine = await rain.evaluate((node) => node.getBoundingClientRect().width);
  expect(widthAtNine).toBeGreaterThan(0);

  await setMapView(page, 43.325, -8.4, 11);
  const widthAtEleven = await rain.evaluate((node) => node.getBoundingClientRect().width);
  expect(widthAtEleven).toBeGreaterThan(widthAtNine * 2);

  // Returning to overview removes rich effects rather than leaving giant
  // fixed-pixel discs on top of the fleet.
  await setMapView(page, 40.1, -3.55, 6.5);
  await expect(page.locator(".weather-geographic-overlay")).toHaveCount(0);
  await expect(page.locator(".risk-heavy-rain")).not.toHaveCount(0);
});
