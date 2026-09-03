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

    const accountBtn = page.getByRole("button", { name: /Account|Cuenta/i });
    await expect(accountBtn).toHaveCount(0);

    const regionSelect = page.locator(".region-select, select[name=region], [aria-label*='region']");
    await expect(regionSelect).toHaveCount(0);

    const helpBtn = page.getByRole("button", { name: "Help", exact: true });
    await expect(helpBtn).toBeVisible();
    await helpBtn.click();

    const helpDialog = page.locator(".help-dialog-content");
    await expect(helpDialog).toBeVisible();
    await expect(helpDialog.getByRole("heading", { name: "SupplyMesh Help" })).toBeVisible();
    await expect(helpDialog).toContainText("Selection & Following");
    await expect(helpDialog).toContainText("Alert vs Movement Status");
    await expect(helpDialog).toContainText("Close Range Mode (3D)");
    await expect(helpDialog).toContainText("Vehicle Placement & Routes");
    await expect(helpDialog).toContainText("More rest from delivery slack");
    await expect(helpDialog).toContainText("Unit 211 Demo");
    await expect(helpDialog).toContainText("Recommended Agent Prompt");
    await expect(helpDialog).toContainText("Human Authority");

    const copyBtn = helpDialog.locator(".help-copy-prompt-btn");
    await expect(copyBtn).toBeVisible();
    await expect(copyBtn).toContainText("Copy demo prompt");

    await page.keyboard.press("Escape");
    await expect(helpDialog).toHaveCount(0);

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
    await expect(helpDialogEs).toContainText("Más descanso usando el margen");
    await expect(helpDialogEs).toContainText("Demo de Unit 211");
    await expect(helpDialogEs).toContainText("Prompt recomendado");
    await expect(helpDialogEs).toContainText("Autoridad y aprobación humana");

    await page.keyboard.press("Escape");
    await expect(helpDialogEs).toHaveCount(0);
  });

  test("map-first vehicle placement flow: placement mode, precision click, preview marker, drawer, create and cancel", async ({ page }) => {
    await openConsole(page);

    const expandBtn = page.getByRole("button", { name: "Expand filters" });
    if (await expandBtn.isVisible()) {
      await expandBtn.click();
    }

    const addVehicleBtn = page.getByRole("button", { name: "Add vehicle" });
    await expect(addVehicleBtn).toBeVisible();
    await addVehicleBtn.click();

    const banner = page.locator(".map-placement-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("Click the map to place the vehicle");

    const map = page.locator(".fleet-map");
    await expect(map).toHaveClass(/placement-mode/);

    await banner.getByRole("button", { name: "Cancel" }).click();
    await expect(banner).toHaveCount(0);
    await expect(map).not.toHaveClass(/placement-mode/);

    await addVehicleBtn.click();
    await expect(banner).toBeVisible();

    const mapBox = await map.boundingBox();
    expect(mapBox).not.toBeNull();
    const clickX = mapBox!.x + mapBox!.width * 0.52;
    const clickY = mapBox!.y + mapBox!.height * 0.48;
    await page.mouse.click(clickX, clickY);

    const previewMarker = page.locator(".placement-preview-marker");
    await expect(previewMarker).toBeVisible();

    const drawer = page.locator(".vehicle-placement-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("heading", { name: "Add vehicle" })).toBeVisible();
    await expect(drawer.locator(".vehicle-placement-coords")).toBeVisible();

    const cancelDrawerBtn = drawer.getByRole("button", { name: "Cancel" });
    await cancelDrawerBtn.click();
    await expect(drawer).toHaveCount(0);
    await expect(previewMarker).toHaveCount(0);

    await addVehicleBtn.click();
    await page.mouse.click(clickX, clickY);
    await expect(drawer).toBeVisible();

    await drawer.locator("#placement-fleet-num").fill("Unit 288");
    await drawer.locator("#placement-plate").fill("8888 JJJ");
    await drawer.locator("#placement-label").fill("Valencia Express");

    const submitBtn = drawer.getByRole("button", { name: "Add vehicle" });
    await submitBtn.click();

    await expect(drawer).toHaveCount(0);
    await expect(previewMarker).toHaveCount(0);

    const inspection = page.locator(".vehicle-inspection");
    await expect(inspection).toBeVisible();
    await expect(inspection).toContainText("Unit 288");
    await expect(inspection).toContainText("Valencia Express");
    await expect(inspection).toContainText("Resting");

    await expect(inspection.locator("[data-vehicle-motion-status=stopped]")).toBeVisible();
    await expect(inspection.locator("[data-vehicle-stopped-reason]")).toContainText("No route assigned");

    await page.evaluate(() => {
      const el = document.querySelector(".leaflet-container") as HTMLElement & {
        _leaflet_map?: { setZoom(zoom: number): void };
      };
      el?._leaflet_map?.setZoom(14);
    });

    const canvas = page.locator("[data-three-canvas=shared]");
    await expect(canvas).toHaveCount(1);
    await expect(canvas).toHaveAttribute("data-three-model", "volumetric-v2");
    await expect.poll(async () => Number(await canvas.getAttribute("data-three-visible-trucks"))).toBeGreaterThan(0);
    await expect(inspection).toContainText("Valencia Express");
  });
});
