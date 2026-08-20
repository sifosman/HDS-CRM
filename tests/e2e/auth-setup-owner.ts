import { test as setup, expect } from "@playwright/test";

/**
 * Auth setup for the Owner role. Logs in via the UI and persists the
 * session to storageState so RBAC tests can run as owner.
 */

const AUTH_FILE = "tests/e2e/.auth/owner.json";

setup("authenticate as owner", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /sign in to hds crm/i })).toBeVisible();

  await page.getByLabel("Email").fill("owner.test@hdsgroup.co.za");
  await page.getByLabel("Password").fill("TestOwner123!");
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.context().storageState({ path: AUTH_FILE });
});
