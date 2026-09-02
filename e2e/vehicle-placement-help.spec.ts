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

async function openConsole(page: Page, width = 1440, height = 900): Promise<void> {
  await page.setViewportSize({ width, height });
  await installWebMcp(page);
  await page.goto("/");
  await expect(page.locator(".console-shell")).toBeVisible();
}

test.describe("Minibatch B: Map-based vehicle placement, functional Help, and clean topbar", () => {
  test("topbar removes Account, provides functional accessible bilingual Help dialog, and enforces Spain only", async ({ page }) => {
    await openConsole(page);

    // 1. Account is completely removed
    const accountBtn = page.getByRole("button", { name: /Account|Cuenta/i });
    await expect(accountBtn).toHaveCount(0);

    // 2. Spain only: no country/region selector
    const regionSelect = page.locator(".region-select, select[name=region], [aria-label*='region']");
    await expect(regionSelect).toHaveCount(0);

    // 3. Functional Help dialog in English
    const helpBtn = page.getByRole("button", { name: "Help", exact: true });
    await expect(helpBtn).toBeVisible();
    await helpBtn.click();

    const helpDialog = page.locator(".help-dialog-content");
    await expect(helpDialog).toBeVisible();
    await expect(helpDialog.getByRole("heading", { name: "SupplyMesh Help" })).toBeVisible();

    // Verify all key sections exist
    await expect(helpDialog).toContainText("Selection & Following");
    await expect(helpDialog).toContainText("Alert vs Movement Status");
    await expect(helpDialog).toContainText("Close Range Mode (3D)");
    await expect(helpDialog).toContainText("Vehicle Placement & Routes");
    await expect(helpDialog).toContainText("Unit 211 Demo");
    await expect(helpDialog).toContainText("Recommended Agent Prompt");
    await expect(helpDialog).toContainText("Human Authority");

    // Copy demo prompt button
    const copyBtn = helpDialog.locator(".help-copy-prompt-btn");
    await expect(copyBtn).toBeVisible();
    await expect(copyBtn).toContainText("Copy demo prompt");

    // Escape closes Help dialog
    await page.keyboard.press("Escape");
    await expect(helpDialog).toHaveCount(0);

    // 4. Test Spanish localization for Help
    await page.getByRole("button", { name: "Language" }).click();
    await page.getByRole("menuitem", { name: "Español" }).click();

    const ayudaBtn = page.getByRole("button", { name: "Ayuda", exact: true });
    await expect(ayudaBtn).toBeVisible();
    await ayudaBtn.click();

    const helpDialogEs = page.locator(".help-dialog-content");
    await expect(helpDialogEs).toBeVisible();
    await expect(helpDialogEs.getByRole("heading", { name: "Ayuda de SupplyMesh" })).toBeVisible();
    await expect(helpDialogEs).toContainText("Selección y seguimiento");
    await expect(helpDialogEs).toContainText("Alerta vs movimiento");
    await expect(helpDialogEs).toContainText("Modo Close Range (3D)");
    await expect(helpDialogEs).toContainText("Añadir vehículos y rutas");
    await expect(helpDialogEs).toContainText("Demo de Unit 211");
    await expect(helpDialogEs).toContainText("Prompt recomendado");
    await expect(helpDialogEs).toContainText("Autoridad y aprobación humana");

    await page.keyboard.press("Escape");
    await expect(helpDialogEs).toHaveCount(0);
  });

  test("map-first vehicle placement flow: placement mode, precision click, preview marker, drawer, create and cancel", async ({ page }) => {
    await openConsole(page);

    // Expand filter rail
    const expandBtn = page.getByRole("button", { name: "Expand filters" });
    if (await expandBtn.isVisible()) {
      await expandBtn.click();
    }

    // Click "Add vehicle" button in filter rail
    const addVehicleBtn = page.getByRole("button", { name: "Add vehicle" });
    await expect(addVehicleBtn).toBeVisible();
    await addVehicleBtn.click();

    // Map enters placement mode with banner and crosshair cursor
    const banner = page.locator(".map-placement-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("Click the map to place the vehicle");

    const map = page.locator(".fleet-map");
    await expect(map).toHaveClass(/placement-mode/);

    // Cancel via banner button removes placement mode
    await banner.getByRole("button", { name: "Cancel" }).click();
    await expect(banner).toHaveCount(0);
    await expect(map).not.toHaveClass(/placement-mode/);

    // Re-enter placement mode
    await addVehicleBtn.click();
    await expect(banner).toBeVisible();

    // Click on the map near Madrid coordinates (center of map container)
    const mapBox = await map.boundingBox();
    expect(mapBox).not.toBeNull();
    const clickX = mapBox!.x + mapBox!.width * 0.52;
    const clickY = mapBox!.y + mapBox!.height * 0.48;
    await page.mouse.click(clickX, clickY);

    // Preview marker appears on the map
    const previewMarker = page.locator(".placement-preview-marker");
    await expect(previewMarker).toBeVisible();

    // Right-side drawer opens with create form
    const drawer = page.locator(".vehicle-placement-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("heading", { name: "Add vehicle" })).toBeVisible();
    await expect(drawer.locator(".vehicle-placement-coords")).toBeVisible();

    // Test Cancel button removes preview marker and closes drawer
    const cancelDrawerBtn = drawer.getByRole("button", { name: "Cancel" });
    await cancelDrawerBtn.click();
    await expect(drawer).toHaveCount(0);
    await expect(previewMarker).toHaveCount(0);

    // Re-enter placement and click again to actually create
    await addVehicleBtn.click();
    await page.mouse.click(clickX, clickY);
    await expect(drawer).toBeVisible();

    // Fill in custom details
    await drawer.locator("#placement-fleet-num").fill("Unit 288");
    await drawer.locator("#placement-plate").fill("8888 JJJ");
    await drawer.locator("#placement-label").fill("Valencia Express");

    // Submit form
    const submitBtn = drawer.getByRole("button", { name: "Add vehicle" });
    await submitBtn.click();

    // Drawer and preview marker should disappear
    await expect(drawer).toHaveCount(0);
    await expect(previewMarker).toHaveCount(0);

    // Newly created vehicle should be in resting status and selected in inspection
    const inspection = page.locator(".vehicle-inspection");
    await expect(inspection).toBeVisible();
    await expect(inspection).toContainText("Unit 288");
    await expect(inspection).toContainText("Valencia Express");
    await expect(inspection).toContainText("Resting");

    // Check movement status shows stopped with mandatory rest reason
    await expect(inspection.locator("[data-vehicle-motion-status=stopped]")).toBeVisible();
    await expect(inspection.locator("[data-vehicle-stopped-reason]")).toContainText("Mandatory rest");

    // Zoom into zoom 14 to verify Three.js or 2D marker is rendered
    await page.evaluate(() => {
      const el = document.querySelector(".leaflet-container") as HTMLElement & {
        _leaflet_map?: { setZoom(zoom: number): void };
      };
      el?._leaflet_map?.setZoom(14);
    });
    await page.waitForTimeout(400);

    // The vehicle marker label displays the custom label
    const marker = page.locator(".fleet-marker-label").filter({ hasText: "Valencia Express" });
    await expect(marker).toBeVisible();
  });
});
