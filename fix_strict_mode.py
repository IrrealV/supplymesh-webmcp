with open('e2e/close-range-vehicle.spec.ts', 'r') as f:
    content = f.read()

content = content.replace(
    'await expect(page.locator(".close-range-truck-rig")).toHaveCSS("animation-name", "none");',
    'await expect(page.locator("[data-close-range-model=vehicle-011] .close-range-truck-rig")).toHaveCSS("animation-name", "none");'
)

with open('e2e/close-range-vehicle.spec.ts', 'w') as f:
    f.write(content)
