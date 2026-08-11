import { test as setup, expect } from "@playwright/test";

/**
 * Global setup: log in as the admin user via the UI and persist the
 * authenticated session to storageState so every subsequent test starts
 * already signed in.
 */

const AUTH_FILE = "tests/e2e/.auth/user.json";

setup("authenticate as admin", async ({ page }) => {
  await page.goto("/login");

  // The login page should render the sign-in form.
  await expect(page.getByRole("heading", { name: /sign in to hds crm/i })).toBeVisible();

  await page.getByLabel("Email").fill(process.env.E2E_USER_EMAIL || "mohamed@owdsolutions.co.za");
  await page.getByLabel("Password").fill(process.env.E2E_USER_PASSWORD || "Thierry14247!");
  await page.getByRole("button", { name: /sign in/i }).click();

  // Should redirect to /dashboard (the root / redirects to /dashboard).
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  // Persist storage state (cookies + localStorage) for later tests.
  await page.context().storageState({ path: AUTH_FILE });
});
