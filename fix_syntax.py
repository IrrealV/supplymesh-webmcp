with open('e2e/close-range-vehicle.spec.ts', 'r') as f:
    content = f.read()

import re

# We have this malformed part:
# });
#   await openConsole(page, 1440, 900);
#   await selectUnit211(page);
#   const map = page.locator(".fleet-map");
#   await expect(map).toHaveAttribute("data-close-range-camera", "following");
#   const initial = await readMotion(page, "vehicle-005");

#   await expect.poll(async () => (await readMotion(page, "vehicle-005")).progress).toBeGreaterThan(initial.progress);
#   await expect.poll(async () => Math.abs((await readMotion(page, "vehicle-005")).bearing - initial.bearing)).toBeGreaterThan(0.001);

#   await page.locator(".map-frame").dispatchEvent("wheel");
#   await expect(map).toHaveAttribute("data-close-range-mode", "active");
#   await expect(page.locator("[data-close-range-model]")).toHaveCount(15);
# });

# Let's completely replace the entire test for "follow motion advances along the active route"
match = re.search(r'test\("follow motion advances along the active route with bearing and camera tracking", async \(\{ page \}\) => \{.*?\}\);\s*test\("tablet keeps the close-range truck behind its usable inspection drawer"', content, flags=re.DOTALL)
if match:
    new_test = """test("follow motion advances along the active route with bearing and camera tracking", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openConsole(page, 1440, 900);
  await selectUnit211(page);
  const map = page.locator(".fleet-map");
  await expect(map).toHaveAttribute("data-close-range-camera", "following");
  
  await page.getByRole("button", { name: "Review recovery options" }).click();
  await page.getByRole("button", { name: "Accept clearance limit" }).click();

  const initial = await readMotion(page, "vehicle-011");

  await expect.poll(async () => (await readMotion(page, "vehicle-011")).progress).toBeGreaterThan(initial.progress);
  await expect.poll(async () => Math.abs((await readMotion(page, "vehicle-011")).bearing - initial.bearing)).toBeGreaterThan(0.01);

  await page.locator(".map-frame").dispatchEvent("wheel");
  await expect(map).toHaveAttribute("data-close-range-mode", "active");
  await expect(page.locator("[data-close-range-model]")).toHaveCount(15);
});\n\ntest("tablet keeps the close-range truck behind its usable inspection drawer" """
    content = content[:match.start()] + new_test + content[match.end()-76:]

with open('e2e/close-range-vehicle.spec.ts', 'w') as f:
    f.write(content)
