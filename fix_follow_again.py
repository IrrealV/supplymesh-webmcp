with open('e2e/close-range-vehicle.spec.ts', 'r') as f:
    content = f.read()

old = """  await page.getByRole("button", { name: "Unit 205", exact: true }).click();
  await expect(page.locator(".fleet-map")).toHaveAttribute("data-close-range-mode", "active", { timeout: 10000 });"""

new = """  await page.getByRole("button", { name: "Unit 205", exact: true }).click();
  await page.getByRole("button", { name: "Follow Unit 205" }).click();
  await expect(page.locator(".fleet-map")).toHaveAttribute("data-close-range-mode", "active", { timeout: 10000 });"""

content = content.replace(old, new)
with open('e2e/close-range-vehicle.spec.ts', 'w') as f:
    f.write(content)
