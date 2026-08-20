import { test, expect } from "@playwright/test";

/**
 * Intelligence page functional tests — run as owner.
 */

test.describe("Intelligence", () => {
  test("renders the intelligence page", async ({ page }) => {
    await page.goto("/intelligence");
    await expect(page.getByRole("heading", { name: /intelligence/i })).toBeVisible();
  });

  test("shows KPI cards or report cards", async ({ page }) => {
    await page.goto("/intelligence");
    // The page should have some content — KPI cards or report cards
    await expect(page.locator("[data-slot='card']").first()).toBeVisible({ timeout: 10000 });
  });
});
