with open('e2e/close-range-vehicle.spec.ts', 'r') as f:
    content = f.read()

old_motion = """async function readMotion(page: Page): Promise<{ bearing: number; progress: number; routeId: string }> {
  return page.locator(".fleet-map").evaluate((node) => ({
    bearing: Number((node as HTMLElement).dataset.closeRangeBearing),
    progress: Number((node as HTMLElement).dataset.closeRangeProgress),
    routeId: (node as HTMLElement).dataset.closeRangeRouteId ?? "",
  }));
}"""

new_motion = """async function readMotion(page: Page): Promise<{ bearing: number; progress: number; routeId: string }> {
  return page.locator("[data-close-range-model=vehicle-011]").evaluate((node) => ({
    bearing: Number((node as HTMLElement).dataset.routeBearing),
    progress: Number((node as HTMLElement).dataset.routeProgress),
    routeId: (node as HTMLElement).dataset.closeRangeRouteId ?? "",
  }));
}"""

content = content.replace(old_motion, new_motion)

with open('e2e/close-range-vehicle.spec.ts', 'w') as f:
    f.write(content)
