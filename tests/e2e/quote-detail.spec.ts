import { test, expect } from "@playwright/test";

/**
 * Quote detail page functional tests — run as owner.
 * Tests /quotes/[id] detail page rendering and interactions.
 */

test.describe("Quote Detail", () => {
  test("navigating from quotes table opens detail page", async ({ page }) => {
    await page.goto("/quotes");
    await expect(page.locator("table").first()).toBeVisible();

    const firstRowLink = page.locator("table tbody tr a").first();
    if (!(await firstRowLink.isVisible().catch(() => false))) {
      test.skip();
      return;
    }
    await firstRowLink.click();
    await expect(page).toHaveURL(/\/quotes\//);
  });

  test("detail page shows quote number and back button", async ({ page }) => {
    await page.goto("/quotes");
    const firstRowLink = page.locator("table tbody tr a").first();
    if (!(await firstRowLink.isVisible().catch(() => false))) {
      test.skip();
      return;
    }
    await firstRowLink.click();
    await expect(page).toHaveURL(/\/quotes\//);
    await expect(page.getByRole("link", { name: /back to quotes/i })).toBeVisible();
    // Should have a heading with quote number
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("detail page shows quote info cards", async ({ page }) => {
    await page.goto("/quotes");
    const firstRowLink = page.locator("table tbody tr a").first();
    if (!(await firstRowLink.isVisible().catch(() => false))) {
      test.skip();
      return;
    }
    await firstRowLink.click();
    await expect(page).toHaveURL(/\/quotes\//);
    // Should have info cards
    const cardCount = await page.locator("[data-slot='card']").count();
    expect(cardCount).toBeGreaterThan(0);
  });

  test("detail page shows quote breakdown or line items", async ({ page }) => {
    await page.goto("/quotes");
    const firstRowLink = page.locator("table tbody tr a").first();
    if (!(await firstRowLink.isVisible().catch(() => false))) {
      test.skip();
      return;
    }
    await firstRowLink.click();
    await expect(page).toHaveURL(/\/quotes\//);
    // The page should contain quote details — amounts, line items, or breakdown
    const bodyText = await page.locator("body").textContent() || "";
    const hasQuoteDetails =
      bodyText.includes("Total") ||
      bodyText.includes("Amount") ||
      bodyText.includes("Price") ||
      bodyText.includes("Item") ||
      bodyText.includes("Breakdown");
    expect(hasQuoteDetails).toBeTruthy();
  });

  test("no console errors on quote detail page", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => {
      if (err.message.includes("Turbopack") || err.message.includes("Failed to write page endpoint")) return;
      errors.push(err.message);
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const t = msg.text();
        if (t.includes("favicon") || t.includes("deprecat") || t.includes("Turbopack")) return;
        if (t.includes("Failed to write page endpoint") || t.includes("ENOENT")) return;
        errors.push(t);
      }
    });

    await page.goto("/quotes");
    const firstRowLink = page.locator("table tbody tr a").first();
    if (!(await firstRowLink.isVisible().catch(() => false))) {
      test.skip();
      return;
    }
    await firstRowLink.click();
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);
  });
});
