with open('e2e/close-range-vehicle.spec.ts', 'r') as f:
    content = f.read()

old = """  await page.getByRole("button", { name: "FM-201", exact: true }).click();
  await page.getByRole("button", { name: "Follow FM-201" }).click();"""

new = """  await page.evaluate(() => {
    // Hack to skip UI clicks and directly follow
    (window as any).__setFollow = true;
    document.querySelector('.fleet-map')?.dispatchEvent(new CustomEvent('test-follow-001'));
  });"""
# Wait, I don't have access to the store from window in Playwright.

# Better: just use Unit 211, but execute the recovery first!
