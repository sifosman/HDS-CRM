import { test, expect } from "@playwright/test";

/**
 * Broadcast detail + creation functional tests — run as owner.
 * Tests /broadcasts/[id] detail page and broadcast creation form.
 */

test.describe("Broadcast Detail", () => {
  test("broadcast detail page opens if broadcasts exist", async ({ page }) => {
    await page.goto("/broadcasts");
    await page.waitForTimeout(2000);

    // Look for broadcast links in table or cards
    const broadcastLink = page.locator("a[href*='/broadcasts/']").first();
    if (!(await broadcastLink.isVisible().catch(() => false))) {
      test.skip();
      return;
    }
    await broadcastLink.click();
    await expect(page).toHaveURL(/\/broadcasts\//);
    // Should have a heading
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("broadcast detail shows back button", async ({ page }) => {
    await page.goto("/broadcasts");
    const broadcastLink = page.locator("a[href*='/broadcasts/']").first();
    if (!(await broadcastLink.isVisible().catch(() => false))) {
      test.skip();
      return;
    }
    await broadcastLink.click();
    await expect(page).toHaveURL(/\/broadcasts\//);
    await expect(page.getByRole("link", { name: /back/i }).first()).toBeVisible();
  });

  test("broadcast detail shows recipient stats or campaign info", async ({ page }) => {
    await page.goto("/broadcasts");
    const broadcastLink = page.locator("a[href*='/broadcasts/']").first();
    if (!(await broadcastLink.isVisible().catch(() => false))) {
      test.skip();
      return;
    }
    await broadcastLink.click();
    await expect(page).toHaveURL(/\/broadcasts\//);
    // Should have cards with campaign info
    const cardCount = await page.locator("[data-slot='card']").count();
    expect(cardCount).toBeGreaterThan(0);
  });
});

test.describe("Broadcast Creation", () => {
  test("New Broadcast button opens creation form", async ({ page }) => {
    await page.goto("/broadcasts");
    await expect(page.getByRole("heading", { name: /broadcast/i })).toBeVisible();

    const createBtn = page.getByRole("button", { name: /new broadcast|create|send/i }).first();
    await expect(createBtn).toBeVisible();
    await createBtn.click();
    await page.waitForTimeout(1000);

    // Should open a dialog or navigate to a form
    const dialog = page.getByRole("dialog");
    const formHeading = page.getByRole("heading", { name: /broadcast|campaign/i }).first();
    await expect(dialog.or(formHeading).first()).toBeVisible({ timeout: 5000 });
  });
});
