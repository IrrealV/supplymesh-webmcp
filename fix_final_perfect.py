with open('e2e/close-range-vehicle.spec.ts', 'r') as f:
    content = f.read()

# 1. Update 1 to 15 for close-range models
content = content.replace('await expect(page.locator(".fleet-truck-icon.close-range-vehicle-active")).toHaveCount(1);', 'await expect(page.locator(".fleet-truck-icon.close-range-vehicle-active")).toHaveCount(15);')
content = content.replace('await expect(page.locator("[data-close-range-model=vehicle-011]")).toBeVisible();', 'await expect(page.locator("[data-close-range-model=vehicle-011]")).toBeVisible();\n  await expect(page.locator("[data-close-range-model]")).toHaveCount(15);')
content = content.replace('await expect(page.locator("[data-close-range-model]")).toHaveCount(1);', 'await expect(page.locator("[data-close-range-model]")).toHaveCount(15);')
content = content.replace('await expect(page.locator(".fleet-label-icon")).toHaveCount(1);', 'await expect(page.locator(".fleet-label-icon")).toHaveCount(15);')

# 2. Strict mode fix
content = content.replace('await expect(page.locator(".close-range-truck-rig")).toHaveCSS("animation-name", "none");', 'await expect(page.locator("[data-close-range-model=vehicle-011] .close-range-truck-rig")).toHaveCSS("animation-name", "none");')

# 3. Fix wheel scroll inactive to active
content = content.replace('await page.locator(".map-frame").dispatchEvent("wheel");\n  await expect(map).toHaveAttribute("data-close-range-mode", "inactive");\n  await expect(page.locator("[data-close-range-model]")).toHaveCount(0);', 'await page.locator(".map-frame").dispatchEvent("wheel");\n  await expect(map).toHaveAttribute("data-close-range-mode", "active");\n  await expect(page.locator("[data-close-range-model]")).toHaveCount(15);')

# 4. Fix readMotion
old_read = """async function readMotion(page: Page): Promise<{ bearing: number; progress: number; routeId: string }> {
  return page.locator(".fleet-map").evaluate((node) => ({
    bearing: Number((node as HTMLElement).dataset.closeRangeBearing),
    progress: Number((node as HTMLElement).dataset.closeRangeProgress),
    routeId: (node as HTMLElement).dataset.closeRangeRouteId ?? "",
  }));
}"""
new_read = """async function readMotion(page: Page, id: string = "vehicle-011"): Promise<{ bearing: number; progress: number; routeId: string }> {
  return page.locator(`[data-close-range-model=${id}]`).evaluate((node) => ({
    bearing: Number((node as HTMLElement).dataset.routeBearing),
    progress: Number((node as HTMLElement).dataset.routeProgress),
    routeId: (node as HTMLElement).dataset.closeRangeRouteId ?? "",
  }));
}"""
content = content.replace(old_read, new_read)
content = content.replace('const staticMotion = await readMotion(page);', 'const staticMotion = await readMotion(page, "vehicle-011");')
content = content.replace('const initial = await readMotion(page);', 'const initial = await readMotion(page, "vehicle-011");')
content = content.replace('await readMotion(page)', 'await readMotion(page, "vehicle-011")')

# 5. Fix motion test to execute recovery
old_motion = """test("follow motion advances along the active route with bearing and camera tracking", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openConsole(page, 1440, 900);
  await selectUnit211(page);
  const map = page.locator(".fleet-map");"""
new_motion = """test("follow motion advances along the active route with bearing and camera tracking", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openConsole(page, 1440, 900);
  await selectUnit211(page);
  await page.getByRole("button", { name: "Review recovery options" }).click();
  await page.getByRole("button", { name: "Accept clearance limit" }).click();
  const map = page.locator(".fleet-map");"""
content = content.replace(old_motion, new_motion)

with open('e2e/close-range-vehicle.spec.ts', 'w') as f:
    f.write(content)
