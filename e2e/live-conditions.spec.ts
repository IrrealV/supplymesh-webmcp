import { mkdir } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

type RegisteredTool = { name: string; execute(input: unknown): Promise<{ content: [{ text: string }] }> | { content: [{ text: string }] } };

async function installWebMcp(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const tools: RegisteredTool[] = [];
    Object.defineProperty(window, "__liveTools", { configurable: true, value: tools });
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: {
        getTools: async () => tools,
        registerTool: async (tool: RegisteredTool, options: { signal: AbortSignal }) => {
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

function weatherLocations() {
  return Array.from({ length: 15 }, (_, index) => ({
    current: {
      time: "2026-09-03T20:00",
      temperature_2m: 19 + index * 0.4,
      precipitation: index === 0 ? 7.5 : 0,
      rain: index === 0 ? 7.5 : 0,
      showers: 0,
      snowfall: index === 1 ? 3.2 : 0,
      weather_code: index === 0 ? 65 : index === 1 ? 75 : index === 2 ? 95 : 1,
      cloud_cover: index < 3 ? 92 : 24,
      wind_speed_10m: index === 2 ? 52 : 18,
      wind_direction_10m: 245,
      wind_gusts_10m: index === 2 ? 84 : 32,
    },
  }));
}

function airLocations() {
  return Array.from({ length: 15 }, (_, index) => ({
    current: {
      pm10: index === 3 ? 130 : 14,
      dust: index === 3 ? 142 : 7,
      aerosol_optical_depth: index === 3 ? 0.78 : 0.12,
      european_aqi: index === 3 ? 84 : 17,
    },
  }));
}

const dgtXml = `<?xml version="1.0" encoding="UTF-8"?>
<d2:payload xmlns:d2="http://levelC/schema/3/d2Payload" xmlns:sit="http://levelC/schema/3/situation" xmlns:loc="http://levelC/schema/3/locationReferencing" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <d2:publicationTime>2026-09-03T20:05:00Z</d2:publicationTime>
  <sit:situation id="live-incident-madrid">
    <sit:overallSeverity>high</sit:overallSeverity>
    <sit:situationRecord id="record-1" xsi:type="sit:Accident">
      <loc:roadName>A-1</loc:roadName>
      <sit:situationRecordVersionTime>2026-09-03T20:04:00Z</sit:situationRecordVersionTime>
      <sit:locationReference><loc:point><loc:pointCoordinates><loc:latitude>40.4168</loc:latitude><loc:longitude>-3.7038</loc:longitude></loc:pointCoordinates></loc:point></sit:locationReference>
    </sit:situationRecord>
  </sit:situation>
</d2:payload>`;

async function executeLiveTool(page: Page, refresh: boolean): Promise<unknown> {
  return page.evaluate(async (shouldRefresh) => {
    const tools = (window as unknown as { __liveTools: RegisteredTool[] }).__liveTools;
    const tool = tools.find(({ name }) => name === "live_conditions_get");
    if (tool === undefined) throw new Error("live_conditions_get is unavailable");
    const response = await tool.execute({ refresh: shouldRefresh });
    return JSON.parse(response.content[0].text) as unknown;
  }, refresh);
}

test("live weather and DGT traffic remain advisory, visible and API-key free", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.route("https://api.open-meteo.com/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(weatherLocations()) }));
  await page.route("https://air-quality-api.open-meteo.com/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(airLocations()) }));
  await page.route("**/api/live-traffic", (route) => route.fulfill({ status: 200, contentType: "application/xml", body: dgtXml }));
  await installWebMcp(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await expect(page.locator(".console-shell")).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __liveTools: RegisteredTool[] }).__liveTools.map(({ name }) => name))).toContain("live_conditions_get");

  const panel = page.getByRole("complementary", { name: "Live weather & traffic" });
  await expect(panel).toBeVisible();
  const enabled = await executeLiveTool(page, true) as { ok?: boolean; data?: { advisoryOnly?: boolean; enabled?: boolean } };
  expect(enabled).toMatchObject({ ok: true, data: { advisoryOnly: true, enabled: true } });

  await expect(panel.locator('[data-provider-state="ready"]')).toHaveCount(2);
  await expect(panel.locator("[data-live-weather-summary]")).toHaveCount(4);
  await expect(panel.locator("[data-live-traffic-summary]")).toHaveCount(1);
  await expect(page.locator("[data-live-weather-marker]")).toHaveCount(4);
  await expect(page.locator("[data-live-traffic-marker]")).toHaveCount(1);
  await expect(panel).toContainText("Advisory layer");
  await expect(panel).toContainText("DGT coverage");

  const toolResult = await executeLiveTool(page, false) as { ok?: boolean; data?: { advisoryOnly?: boolean; summary?: { adverseWeatherVehicles?: number; routeRelevantTrafficIncidents?: number } } };
  expect(toolResult).toMatchObject({ ok: true, data: { advisoryOnly: true, summary: { adverseWeatherVehicles: 4, routeRelevantTrafficIncidents: 1 } } });

  await mkdir("test-results/live-conditions", { recursive: true });
  await page.screenshot({ animations: "disabled", path: "test-results/live-conditions/live-weather-traffic.png" });

  expect(requests.some((url) => url.includes("open-meteo.com"))).toBe(true);
  expect(requests.some((url) => url.endsWith("/api/live-traffic"))).toBe(true);
  expect(requests.join(" ")).not.toMatch(/api[_-]?key=|apikey=/i);

  await panel.getByRole("button", { name: "Pause live data" }).click();
  await expect(page.locator("[data-live-weather-marker]")).toHaveCount(0);
  await expect(page.locator("[data-live-traffic-marker]")).toHaveCount(0);
});
