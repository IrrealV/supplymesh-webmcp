with open('e2e/close-range-vehicle.spec.ts', 'r') as f:
    content = f.read()

# Fix 1: wheel scroll retains 3D mode
content = content.replace(
    'await expect(map).toHaveAttribute("data-close-range-mode", "inactive");',
    'await expect(map).toHaveAttribute("data-close-range-mode", "active");'
)
content = content.replace(
    'await expect(page.locator("[data-close-range-model]")).toHaveCount(0);',
    'await expect(page.locator("[data-close-range-model]")).toHaveCount(15);'
)

# Fix 2: use vehicle-001 instead of 011 for testing motion
old_motion_test = """test("follow motion advances along the active route with bearing and camera tracking", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openConsole(page, 1440, 900);
  await selectUnit211(page);"""

new_motion_test = """test("follow motion advances along the active route with bearing and camera tracking", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openConsole(page, 1440, 900);
  await page.getByRole("button", { name: "Unit 201", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".fleet-map")).toHaveAttribute("data-close-range-mode", "active");"""
content = content.replace(old_motion_test, new_motion_test)

# Also need to fix readMotion to read vehicle-001!
content = content.replace('page.locator("[data-close-range-model=vehicle-011]")', 'page.locator("[data-close-range-model]")')

with open('e2e/close-range-vehicle.spec.ts', 'w') as f:
    f.write(content)
