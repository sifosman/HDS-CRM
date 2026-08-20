import { test, expect } from "@playwright/test";

/**
 * Segments page functional tests — run as owner.
 */

test.describe("Segments", () => {
  test("renders the segments page", async ({ page }) => {
    await page.goto("/segments");
    await expect(page.getByRole("heading", { name: /segments/i })).toBeVisible();
  });

  test("has a create segment button or empty state", async ({ page }) => {
    await page.goto("/segments");
    const createBtn = page.getByRole("button", { name: /new segment|create|add/i });
    const emptyState = page.getByText(/no segments|empty|get started/i);
    await expect(createBtn.or(emptyState).first()).toBeVisible();
  });
});
