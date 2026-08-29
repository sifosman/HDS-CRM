import { test, expect } from "@playwright/test";

/**
 * Catalog page + Price-Objection Funnel tests — run as owner.
 * Validates change requests #8 (catalog management) and #9 (funnel).
 */

test.describe("Product Catalog (#8)", () => {
  test("catalog page renders with products", async ({ page }) => {
    await page.goto("/catalog");
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator("h1").first()).toHaveText(/Product Catalog/i);
    // Should have product cards or categories
    const cards = page.locator("[data-slot='card']");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
  });

  test("catalog page shows product count stats", async ({ page }) => {
    await page.goto("/catalog");
    // Should show Total Products, Active, Discontinued stats
    await expect(page.getByText(/Total Products/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Active \(visible to bot\)/i)).toBeVisible();
    await expect(page.getByText(/Discontinued \(hidden\)/i)).toBeVisible();
  });

  test("catalog page has search input", async ({ page }) => {
    await page.goto("/catalog");
    const search = page.locator("input[placeholder*='Search']");
    await expect(search).toBeVisible({ timeout: 10000 });
  });

  test("catalog search filters products", async ({ page }) => {
    await page.goto("/catalog");
    const search = page.locator("input[placeholder*='Search']");
    await search.fill("melamine");
    await page.waitForTimeout(500);
    // Should show filtered results (product names containing "melamine")
    const productNames = page.locator("[class*='line-clamp']");
    const count = await productNames.count();
    expect(count).toBeGreaterThan(0);
  });

  test("catalog page has category filter", async ({ page }) => {
    await page.goto("/catalog");
    // Should have a category select dropdown
    const categorySelect = page.locator("button[role='combobox']").first();
    await expect(categorySelect).toBeVisible({ timeout: 10000 });
  });

  test("mark discontinued button exists on products", async ({ page }) => {
    await page.goto("/catalog");
    // Should have "Mark Discontinued" buttons on active products
    await expect(page.getByText(/Mark Discontinued/i).first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Price-Objection Funnel (#9)", () => {
  test("AI performance page has funnel section", async ({ page }) => {
    await page.goto("/reports/ai-performance");
    await expect(page.locator("h1, h2, h3").first()).toBeVisible();
    // Should have the Price-Objection Close Rate Funnel section
    await expect(page.getByText(/Price-Objection/i).first()).toBeVisible({ timeout: 15000 });
  });

  test("funnel KPI cards are present", async ({ page }) => {
    await page.goto("/reports/ai-performance");
    // Should have KPI cards for objection rate, quote after objection, etc.
    await expect(page.getByText(/Objection Rate/i).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Quote After Objection/i).first()).toBeVisible();
    await expect(page.getByText(/Close Attempt Rate/i).first()).toBeVisible();
    await expect(page.getByText(/Win Rate/i).first()).toBeVisible();
  });

  test("funnel chart renders", async ({ page }) => {
    await page.goto("/reports/ai-performance");
    // Should have a recharts chart for the funnel
    const charts = page.locator(".recharts-surface");
    await expect(charts.first()).toBeVisible({ timeout: 15000 });
  });

  test("objection type breakdown table is present", async ({ page }) => {
    await page.goto("/reports/ai-performance");
    // Should have an objection type breakdown table
    await expect(page.getByText(/Objection Type Breakdown/i).first()).toBeVisible({ timeout: 15000 });
  });
});
