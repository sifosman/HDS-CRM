import { test, expect } from "@playwright/test";

/**
 * Customers page functional tests — run as owner.
 */

test.describe("Customers", () => {
  test("renders the customers table", async ({ page }) => {
    await page.goto("/customers");
    await expect(page.getByRole("heading", { name: "Customers" })).toBeVisible();
    await expect(page.locator("table").first()).toBeVisible();
  });

  test("table has expected columns", async ({ page }) => {
    await page.goto("/customers");
    await expect(page.locator("table thead")).toBeVisible();
    // Check for key column headers
    const headerText = await page.locator("table thead").textContent();
    expect(headerText).toMatch(/phone|customer/i);
  });

  test("search filters rows", async ({ page }) => {
    await page.goto("/customers");
    await expect(page.locator("table").first()).toBeVisible();

    const initialRows = await page.locator("table tbody tr").count();
    if (initialRows === 0) {
      test.skip();
      return;
    }

    const searchInput = page.getByPlaceholder(/search/i).first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill("zzzzzzzz_not_a_real_customer");
      await expect(page.getByText("No customers found")).toBeVisible({ timeout: 10000 });
    }
  });

  test("clicking a row opens customer detail", async ({ page }) => {
    await page.goto("/customers");
    const firstRowLink = page.locator("table tbody tr a").first();
    if (!(await firstRowLink.isVisible().catch(() => false))) {
      test.skip();
      return;
    }
    await firstRowLink.click();
    await expect(page).toHaveURL(/\/customers\//);
  });
});
