import { test, expect } from "@playwright/test";

/**
 * Broadcasts page functional tests — run as owner.
 */

test.describe("Broadcasts", () => {
  test("renders the broadcasts page", async ({ page }) => {
    await page.goto("/broadcasts");
    await expect(page.getByRole("heading", { name: /broadcast/i })).toBeVisible();
  });

  test("has a create campaign button or KPI cards", async ({ page }) => {
    await page.goto("/broadcasts");
    const createBtn = page.getByRole("button", { name: /new broadcast|create|add|send/i });
    const kpiText = page.getByText("Total Campaigns");
    await expect(createBtn.or(kpiText).first()).toBeVisible();
  });
});
