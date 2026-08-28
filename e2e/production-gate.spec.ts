import { expect, test } from "@playwright/test";

test("should block a production build even when a bypass-like variable is set", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("alert")).toHaveText("WebMCP is required to access this console.");
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(page.getByText("SupplyMesh")).toHaveCount(0);
});
