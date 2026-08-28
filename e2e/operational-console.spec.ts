import { expect, test, type Page } from "@playwright/test";

async function installModelContextSeam(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: { registerTool: async () => undefined },
    });
  });
}

test("should block the console when the WebMCP capability is unavailable", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("alert")).toHaveText("WebMCP is required to access this console.");
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(page.getByText("SupplyMesh")).toHaveCount(0);
  await expect(page.getByText(/continue manually|skip|disable ai/i)).toHaveCount(0);
});

test("should support the desktop operational workflow with a local model-context seam", async ({ page }) => {
  await installModelContextSeam(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await expect(page.getByRole("main")).toHaveClass(/console-shell/);
  await expect(page.getByRole("button", { name: "Language" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Help" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Account" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Vehicle inspection" })).toHaveCount(0);
  await expect(page.getByText(/LIVE|Agent|Simulation|Stage plan|Chat/i)).toHaveCount(0);

  await page.getByRole("button", { name: "Critical" }).click();
  await expect(page.getByRole("button", { name: "Critical" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Critical" }).click();
  await expect(page.getByRole("button", { name: "Critical" })).toHaveAttribute("aria-pressed", "false");

  await page.getByRole("button", { name: "Select FM-201" }).click();
  const drawer = page.getByRole("complementary", { name: "Vehicle inspection" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText("Madrid", { exact: true })).toBeVisible();

  await page.locator(".map-frame").dispatchEvent("pointerdown");
  await expect(drawer.getByRole("button", { name: "Follow FM-201" })).toBeVisible();
  await drawer.getByRole("button", { name: "Follow FM-201" }).click();
  await expect(drawer.getByRole("button", { name: "Follow FM-201" })).toHaveCount(0);

  await drawer.getByLabel("Label").fill("Night Dispatch");
  await drawer.getByRole("button", { name: "Save label" }).click();
  await expect(page.getByRole("button", { name: "Select Night Dispatch" })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Select Night Dispatch" }).click();

  await page.getByRole("button", { name: "Delete vehicle" }).click();
  const confirmation = page.getByRole("alertdialog");
  await expect(confirmation).toContainText("Night Dispatch");
  await expect(confirmation).toContainText("current route");
  await confirmation.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("button", { name: "Select Night Dispatch" })).toBeVisible();

  await page.getByRole("button", { name: "Delete vehicle" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("complementary", { name: "Vehicle inspection" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Select Night Dispatch" })).toHaveCount(0);

  await page.getByRole("button", { name: "Language" }).click();
  await page.getByRole("menuitem", { name: "Español" }).click();
  await expect(page.getByRole("button", { name: "Ayuda" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Ayuda" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
});

test("should render vehicle inspection as a tablet dialog with a local model-context seam", async ({ page }) => {
  await installModelContextSeam(page);
  await page.setViewportSize({ width: 900, height: 900 });
  await page.goto("/");

  await page.getByRole("button", { name: "Select FM-201" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("FM-201");
  await expect(dialog.getByText("Madrid", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Close inspection" }).click();
  await expect(dialog).toHaveCount(0);
});
