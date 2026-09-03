import { expect, test, type Page } from "@playwright/test";

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

test("the Three.js view hides the legacy 2D selection aura", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await installWebMcp(page);
  await page.goto("/");
  await expect(page.locator(".console-shell")).toBeVisible();

  const incident = page.getByRole("button", {
    name: "Select Unit 211 clearance incident",
    exact: true,
  });
  await incident.focus();
  await page.keyboard.press("Enter");

  const map = page.locator(".fleet-map");
  await expect(map).toHaveAttribute("data-close-range-mode", "active");
  await expect(page.locator("[data-three-canvas=shared]")).toHaveCount(1);

  const legacyAuras = page.locator(
    ".fleet-truck-icon.close-range-vehicle-active .fleet-selection-aura",
  );
  await expect(legacyAuras).toHaveCount(15);
  expect(
    await legacyAuras.evaluateAll((nodes) =>
      nodes.every((node) => getComputedStyle(node).display === "none"),
    ),
  ).toBe(true);
});
