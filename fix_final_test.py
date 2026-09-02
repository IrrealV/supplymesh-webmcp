with open('e2e/close-range-vehicle.spec.ts', 'r') as f:
    content = f.read()

# Revert my hacky FM-201 select logic
old_motion = """test("follow motion advances along the active route with bearing and camera tracking", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openConsole(page, 1440, 900);
  await page.getByRole("button", { name: "FM-201", exact: true }).click();
  await page.getByRole("button", { name: "Follow FM-201" }).click(); await expect(page.locator(".fleet-map")).toHaveAttribute("data-close-range-mode", "active", { timeout: 10000 });
  const map = page.locator(".fleet-map");
  await expect(map).toHaveAttribute("data-close-range-camera", "following", { timeout: 10000 });
  const initial = await readMotion(page, "vehicle-001");

  await expect.poll(async () => (await readMotion(page, "vehicle-001")).progress).toBeGreaterThan(initial.progress);
  await expect.poll(async () => Math.abs((await readMotion(page, "vehicle-001")).bearing - initial.bearing)).toBeGreaterThan(0.01);"""

new_motion = """test("follow motion advances along the active route with bearing and camera tracking", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openConsole(page, 1440, 900);
  await selectUnit211(page);
  const map = page.locator(".fleet-map");
  await expect(map).toHaveAttribute("data-close-range-camera", "following");
  
  // Accept the clearance limit so it starts moving
  await page.getByRole("button", { name: "Review recovery options" }).click();
  await page.getByRole("button", { name: "Accept clearance limit" }).click();

  const initial = await readMotion(page, "vehicle-011");

  await expect.poll(async () => (await readMotion(page, "vehicle-011")).progress).toBeGreaterThan(initial.progress);
  await expect.poll(async () => Math.abs((await readMotion(page, "vehicle-011")).bearing - initial.bearing)).toBeGreaterThan(0.01);"""

content = content.replace(old_motion, new_motion)

with open('e2e/close-range-vehicle.spec.ts', 'w') as f:
    f.write(content)
