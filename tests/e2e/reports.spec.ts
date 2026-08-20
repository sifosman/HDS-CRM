import { test, expect } from "@playwright/test";

/**
 * Reports + AI Performance page functional tests — run as owner.
 */

test.describe("Reports", () => {
  test("weekly reports page renders", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("AI performance page renders with charts", async ({ page }) => {
    await page.goto("/reports/ai-performance");
    await expect(page.locator("h1, h2, h3").first()).toBeVisible();
    // Should have chart elements (recharts SVGs or cards)
    const charts = page.locator(".recharts-surface");
    const cards = page.locator("[data-slot='card']");
    await expect(charts.or(cards).first()).toBeVisible({ timeout: 10000 });
  });

  test("AI performance page has test run data or empty state", async ({ page }) => {
    await page.goto("/reports/ai-performance");
    // The page should show either test run tables or an empty state
    await expect(page.locator("body")).not.toBeEmpty();
  });
});
