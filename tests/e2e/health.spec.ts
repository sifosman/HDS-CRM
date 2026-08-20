import { test, expect } from "@playwright/test";

/**
 * System Health page functional tests — run as owner (only owner has access).
 */

test.describe("System Health", () => {
  test("renders the health page", async ({ page }) => {
    await page.goto("/health");
    await expect(page.getByRole("heading", { name: /system health|health/i })).toBeVisible();
  });

  test("shows health cards or status indicators", async ({ page }) => {
    await page.goto("/health");
    // Should have health cards or KPI cards
    await expect(page.locator("[data-slot='card']").first()).toBeVisible({ timeout: 10000 });
  });
});
