import { expect, test } from "@playwright/test";

test("should enforce the production gate despite a bypass-like build variable", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("alert")).toHaveText("WebMCP is required to access this console.");
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(page.locator(".console-shell")).toHaveCount(0);
  await expect(page.getByText(/continue manually|skip|disable ai/i)).toHaveCount(0);
  await expect(page.getByText(/Fleet Edit|Create vehicle|Assign route|Reroute|Agent|Chat/i)).toHaveCount(0);
});
