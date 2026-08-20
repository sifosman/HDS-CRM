import { test, expect } from "@playwright/test";

/**
 * Quotes page functional tests — run as owner.
 */

test.describe("Quotes", () => {
  test("renders the quotes table", async ({ page }) => {
    await page.goto("/quotes");
    await expect(page.getByRole("heading", { name: "Quotes" })).toBeVisible();
    await expect(page.locator("table").first()).toBeVisible();
  });

  test("table has expected columns", async ({ page }) => {
    await page.goto("/quotes");
    const headerText = await page.locator("table thead").textContent();
    expect(headerText).toMatch(/quote|date|total|status/i);
  });

  test("clicking a quote row opens detail page", async ({ page }) => {
    await page.goto("/quotes");
    const firstRowLink = page.locator("table tbody tr a").first();
    if (!(await firstRowLink.isVisible().catch(() => false))) {
      test.skip();
      return;
    }
    await firstRowLink.click();
    await expect(page).toHaveURL(/\/quotes\//);
  });

  test("quote detail page shows back button", async ({ page }) => {
    await page.goto("/quotes");
    const firstRowLink = page.locator("table tbody tr a").first();
    if (!(await firstRowLink.isVisible().catch(() => false))) {
      test.skip();
      return;
    }
    await firstRowLink.click();
    await expect(page).toHaveURL(/\/quotes\//);
    await expect(page.getByRole("link", { name: /back to quotes/i })).toBeVisible();
  });
});
