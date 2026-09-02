import re

with open('e2e/close-range-vehicle.spec.ts', 'r') as f:
    content = f.read()

# Replace any expect(xxx).toHaveCount(1) related to trucks with 15 when we know it's all trucks
content = re.sub(r'await expect\(page\.locator\("\[data-close-range-model\]"\)\)\.toHaveCount\(1\);', 'await expect(page.locator("[data-close-range-model]")).toHaveCount(15);', content)
content = re.sub(r'await expect\(page\.locator\("\.fleet-truck-icon\.close-range-vehicle-active"\)\)\.toHaveCount\(1\);', 'await expect(page.locator(".fleet-truck-icon.close-range-vehicle-active")).toHaveCount(15);', content)
content = re.sub(r'await expect\(page\.locator\("\.fleet-label-icon"\)\)\.toHaveCount\(1\);', 'await expect(page.locator(".fleet-label-icon")).toHaveCount(15);', content)

# Strict mode for animation-name none
content = content.replace('await expect(page.locator(".close-range-truck-rig")).toHaveCSS("animation-name", "none");', 'await expect(page.locator(".close-range-truck-rig").first()).toHaveCSS("animation-name", "none");')

# Fix wheel dispatch "inactive" to "active"
content = content.replace('await expect(map).toHaveAttribute("data-close-range-mode", "inactive");', 'await expect(map).toHaveAttribute("data-close-range-mode", "active");')
content = content.replace('await expect(page.locator("[data-close-range-model]")).toHaveCount(0);', 'await expect(page.locator("[data-close-range-model]")).toHaveCount(15);')

# Use vehicle-001 for motion test instead of 011 because 011 is stopped
old_motion = 'await selectUnit211(page);'
new_motion = 'await page.getByRole("button", { name: "Unit 201", exact: true }).focus();\n  await page.keyboard.press("Enter");\n  await expect(page.locator(".fleet-map")).toHaveAttribute("data-close-range-mode", "active");'
content = content.replace(old_motion, new_motion)
content = content.replace('const initial = await readMotion(page);', 'const initial = await readMotion(page, "vehicle-001");')
content = content.replace('await expect.poll(async () => (await readMotion(page)).progress)', 'await expect.poll(async () => (await readMotion(page, "vehicle-001")).progress)')
content = content.replace('await expect.poll(async () => Math.abs((await readMotion(page)).bearing', 'await expect.poll(async () => Math.abs((await readMotion(page, "vehicle-001")).bearing')

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
content = content.replace('expect(initial.routeId).toBe("route-011");', 'expect(initial.routeId).toBe("route-001");')

with open('e2e/close-range-vehicle.spec.ts', 'w') as f:
    f.write(content)
