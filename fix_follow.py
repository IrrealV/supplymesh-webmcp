with open('e2e/close-range-vehicle.spec.ts', 'r') as f:
    content = f.read()

old_focus = """  await page.getByRole("button", { name: "FM-201", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".fleet-map")).toHaveAttribute("data-close-range-mode", "active");
  const map = page.locator(".fleet-map");
  await expect(map).toHaveAttribute("data-close-range-camera", "following");"""

new_focus = """  await page.getByRole("button", { name: "FM-201", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Follow FM-201" }).click();
  await expect(page.locator(".fleet-map")).toHaveAttribute("data-close-range-mode", "active");
  const map = page.locator(".fleet-map");
  await expect(map).toHaveAttribute("data-close-range-camera", "following");"""

content = content.replace(old_focus, new_focus)

with open('e2e/close-range-vehicle.spec.ts', 'w') as f:
    f.write(content)
