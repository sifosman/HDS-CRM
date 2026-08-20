import { test, expect } from "@playwright/test";

/**
 * Customer detail page functional tests — run as owner.
 * Tests /customers/[phone] detail page rendering and interactions.
 */

test.describe("Customer Detail", () => {
  test("navigating from customers table opens detail page", async ({ page }) => {
    await page.goto("/customers");
    await expect(page.locator("table").first()).toBeVisible();

    const firstRowLink = page.locator("table tbody tr a").first();
    if (!(await firstRowLink.isVisible().catch(() => false))) {
      test.skip();
      return;
    }
    await firstRowLink.click();
    await expect(page).toHaveURL(/\/customers\//);
  });

  test("detail page shows customer name and back button", async ({ page }) => {
    await page.goto("/customers");
    const firstRowLink = page.locator("table tbody tr a").first();
    if (!(await firstRowLink.isVisible().catch(() => false))) {
      test.skip();
      return;
    }
    await firstRowLink.click();
    await expect(page).toHaveURL(/\/customers\//);
    // Should have a back link
    await expect(page.getByRole("link", { name: /back to customers/i })).toBeVisible();
    // Should have a heading with customer name
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("detail page shows customer info cards", async ({ page }) => {
    await page.goto("/customers");
    const firstRowLink = page.locator("table tbody tr a").first();
    if (!(await firstRowLink.isVisible().catch(() => false))) {
      test.skip();
      return;
    }
    await firstRowLink.click();
    await expect(page).toHaveURL(/\/customers\//);
    // Should have multiple info cards
    const cardCount = await page.locator("[data-slot='card']").count();
    expect(cardCount).toBeGreaterThan(0);
  });

  test("detail page shows conversation or quote history", async ({ page }) => {
    await page.goto("/customers");
    const firstRowLink = page.locator("table tbody tr a").first();
    if (!(await firstRowLink.isVisible().catch(() => false))) {
      test.skip();
      return;
    }
    await firstRowLink.click();
    await expect(page).toHaveURL(/\/customers\//);
    // The page should contain some history content — conversations, quotes, or notes
    const bodyText = await page.locator("body").textContent() || "";
    const hasHistory =
      bodyText.includes("Conversation") ||
      bodyText.includes("Quote") ||
      bodyText.includes("Note") ||
      bodyText.includes("Activity") ||
      bodyText.includes("Lead Status");
    expect(hasHistory).toBeTruthy();
  });

  test("no console errors on customer detail page", async ({ page }) => {
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

    await page.goto("/customers");
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
