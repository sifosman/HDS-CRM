import { test, expect } from "@playwright/test";

/**
 * Settings page functional tests — run as owner.
 */

test.describe("Settings", () => {
  test("renders with profile card", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByText("Profile", { exact: true })).toBeVisible();
  });

  test("shows user email and role badge", async ({ page }) => {
    await page.goto("/settings");
    // The profile section shows the email in a read-only input
    const emailInput = page.getByLabel("Email");
    await expect(emailInput).toBeVisible();
    const emailValue = await emailInput.inputValue();
    expect(emailValue).toMatch(/owner\.test@hdsgroup\.co\.za|mohamed@owdsolutions\.co\.za/);
    // Role badge should be visible
    await expect(page.getByText("Owner").first()).toBeVisible();
  });

  test("shows user management link for owner", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText("User Management").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /manage users/i })).toBeVisible();
  });

  test("notification preferences section is present", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText("Notification Preferences")).toBeVisible();
  });

  test("branch assignment section is present", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText("Branch Assignment")).toBeVisible();
  });
});
