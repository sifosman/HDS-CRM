import { test, expect } from "@playwright/test";

/**
 * AI Performance conversation detail + segment/template creation tests — run as owner.
 */

test.describe("Conversation Detail", () => {
  test("conversation detail page opens from AI performance", async ({ page }) => {
    await page.goto("/reports/ai-performance");
    await page.waitForTimeout(3000);

    const convLink = page.locator("a[href*='/conversations/']").first();
    if (!(await convLink.isVisible().catch(() => false))) {
      test.skip();
      return;
    }
    await convLink.click();
    await expect(page).toHaveURL(/\/conversations\//);
    // Should have a heading
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("conversation detail shows back link", async ({ page }) => {
    await page.goto("/reports/ai-performance");
    const convLink = page.locator("a[href*='/conversations/']").first();
    if (!(await convLink.isVisible().catch(() => false))) {
      test.skip();
      return;
    }
    await convLink.click();
    await expect(page).toHaveURL(/\/conversations\//);
    await expect(page.getByRole("link", { name: /back/i }).first()).toBeVisible();
  });

  test("conversation detail shows messages or log entries", async ({ page }) => {
    await page.goto("/reports/ai-performance");
    const convLink = page.locator("a[href*='/conversations/']").first();
    if (!(await convLink.isVisible().catch(() => false))) {
      test.skip();
      return;
    }
    await convLink.click();
    await expect(page).toHaveURL(/\/conversations\//);
    // The page should contain conversation content
    const bodyText = await page.locator("body").textContent() || "";
    const hasContent =
      bodyText.includes("Customer") ||
      bodyText.includes("Bot") ||
      bodyText.includes("Message") ||
      bodyText.includes("Conversation") ||
      bodyText.includes("Quality");
    expect(hasContent).toBeTruthy();
  });
});

test.describe("Segment Creation", () => {
  test("New Segment button opens creation dialog", async ({ page }) => {
    await page.goto("/segments");
    await expect(page.getByRole("heading", { name: /segments/i })).toBeVisible();

    const newSegBtn = page.getByRole("button", { name: /new segment|create/i }).first();
    await expect(newSegBtn).toBeVisible();
    await newSegBtn.click();
    await page.waitForTimeout(1000);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    // Should have form fields
    const formFields = await dialog.locator("input, textarea, [data-slot='select-trigger']").count();
    expect(formFields).toBeGreaterThan(0);
  });
});

test.describe("Template Creation", () => {
  test("New Template button opens creation dialog", async ({ page }) => {
    await page.goto("/templates");
    await expect(page.getByRole("heading", { name: /templates/i })).toBeVisible();

    const newTplBtn = page.getByRole("button", { name: /new template|create/i }).first();
    await expect(newTplBtn).toBeVisible();
    await newTplBtn.click();
    await page.waitForTimeout(1000);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    // Should have form fields
    const formFields = await dialog.locator("input, textarea, [data-slot='select-trigger']").count();
    expect(formFields).toBeGreaterThan(0);
  });
});
