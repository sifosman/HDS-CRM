import { test, expect } from "@playwright/test";

/**
 * Templates page functional tests — run as owner.
 */

test.describe("Templates", () => {
  test("renders the templates page", async ({ page }) => {
    await page.goto("/templates");
    await expect(page.getByRole("heading", { name: /templates/i })).toBeVisible();
  });

  test("has a create template button or empty state", async ({ page }) => {
    await page.goto("/templates");
    const createBtn = page.getByRole("button", { name: /new template|create|add/i });
    const emptyState = page.getByText(/no templates|empty|get started/i);
    await expect(createBtn.or(emptyState).first()).toBeVisible();
  });
});
