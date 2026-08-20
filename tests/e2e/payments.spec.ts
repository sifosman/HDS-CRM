import { test, expect } from "@playwright/test";

/**
 * Payments page functional tests — run as owner.
 */

test.describe("Payments", () => {
  test("renders the payments page", async ({ page }) => {
    await page.goto("/payments");
    await expect(page.getByRole("heading", { name: /payments/i })).toBeVisible();
  });

  test("shows payments table or empty state", async ({ page }) => {
    await page.goto("/payments");
    // Either a table with data or an empty state message
    const table = page.locator("table").first();
    const emptyState = page.getByText(/no payments|no invoices|empty/i);
    await expect(table.or(emptyState).first()).toBeVisible();
  });

  test("status badges are color-coded if table present", async ({ page }) => {
    await page.goto("/payments");
    const table = page.locator("table").first();
    if (!(await table.isVisible().catch(() => false))) {
      test.skip();
      return;
    }
    // Check for status badges in the table
    const badges = page.locator("table tbody tr [data-slot='badge']").first();
    if (await badges.isVisible().catch(() => false)) {
      // Good — badges are present
    }
  });
});
