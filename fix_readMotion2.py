with open('e2e/close-range-vehicle.spec.ts', 'r') as f:
    content = f.read()

old_motion = """async function readMotion(page: Page): Promise<{ bearing: number; progress: number; routeId: string }> {
  return page.locator("[data-close-range-model]").evaluate((node) => ({
    bearing: Number((node as HTMLElement).dataset.routeBearing),
    progress: Number((node as HTMLElement).dataset.routeProgress),
    routeId: (node as HTMLElement).dataset.closeRangeRouteId ?? "",
  }));
}"""

new_motion = """async function readMotion(page: Page, id: string = "vehicle-011"): Promise<{ bearing: number; progress: number; routeId: string }> {
  return page.locator(`[data-close-range-model=${id}]`).evaluate((node) => ({
    bearing: Number((node as HTMLElement).dataset.routeBearing),
    progress: Number((node as HTMLElement).dataset.routeProgress),
    routeId: (node as HTMLElement).dataset.closeRangeRouteId ?? "",
  }));
}"""

content = content.replace(old_motion, new_motion)
content = content.replace('await readMotion(page)', 'await readMotion(page, "vehicle-001")')
# Wait, I need to restore the first test's readMotion call to "vehicle-011"!
content = content.replace('const staticMotion = await readMotion(page, "vehicle-001");', 'const staticMotion = await readMotion(page, "vehicle-011");')

with open('e2e/close-range-vehicle.spec.ts', 'w') as f:
    f.write(content)
