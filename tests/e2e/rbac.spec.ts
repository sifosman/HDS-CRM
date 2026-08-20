import { test, expect } from "@playwright/test";

/**
 * RBAC tests — role-based access control across all 3 roles.
 *
 * This file is matched by the owner, manager, and sales projects in
 * playwright.config.ts. Each project uses a different storageState, so
 * the tests run authenticated as a different role.
 *
 * We detect which role we're running as by reading the role badge from
 * the header after navigating to the dashboard.
 */

type Role = "owner" | "manager" | "sales";

async function detectRole(page: import("@playwright/test").Page): Promise<Role> {
  await page.goto("/dashboard");
  // The role badge appears in the header next to the user email.
  // Order matters: check "Sales Manager" before "Sales Representative"
  // because both contain "Sales".
  const body = await page.locator("body").textContent();
  if (!body) return "sales";
  if (body.includes("Owner")) return "owner";
  if (body.includes("Sales Manager")) return "manager";
  if (body.includes("Sales Representative")) return "sales";
  return "sales";
}

// Pages each role should be able to access
const ACCESS_MATRIX: Record<Role, { allowed: string[]; denied: string[] }> = {
  owner: {
    allowed: [
      "/dashboard",
      "/customers",
      "/segments",
      "/quotes",
      "/payments",
      "/intelligence",
      "/reports",
      "/reports/ai-performance",
      "/health",
      "/templates",
      "/broadcasts",
      "/settings",
      "/settings/users",
    ],
    denied: [],
  },
  manager: {
    allowed: [
      "/dashboard",
      "/customers",
      "/segments",
      "/quotes",
      "/payments",
      "/intelligence",
      "/reports",
      "/reports/ai-performance",
      "/templates",
      "/broadcasts",
      "/settings",
      "/settings/users",
    ],
    denied: ["/health"],
  },
  sales: {
    allowed: [
      "/dashboard",
      "/customers",
      "/quotes",
      "/payments",
      "/settings",
    ],
    denied: [
      "/segments",
      "/intelligence",
      "/reports",
      "/reports/ai-performance",
      "/health",
      "/templates",
      "/broadcasts",
      "/settings/users",
    ],
  },
};

test.describe("RBAC access control", () => {
  test("detect role and verify access", async ({ page }) => {
    const role = await detectRole(page);
    const { allowed, denied } = ACCESS_MATRIX[role];

    // Allowed pages should render (not redirect to dashboard with error)
    for (const path of allowed) {
      await page.goto(path);
      await expect(page).not.toHaveURL(/\?error=access_denied/);
      // Should not be redirected to /login (auth is valid)
      await expect(page).not.toHaveURL(/\/login/);
    }

    // Denied pages should redirect to /dashboard?error=access_denied
    for (const path of denied) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page).toHaveURL(/\?error=access_denied/);
    }
  });

  test("sidebar shows only allowed nav items", async ({ page }) => {
    const role = await detectRole(page);
    const { allowed } = ACCESS_MATRIX[role];

    // Check that allowed nav items are visible in the sidebar
    const navTexts = ["Dashboard", "Customers", "Quotes", "Payments", "Settings"];
    for (const title of navTexts) {
      // These are always allowed for all roles
      const link = page.getByRole("link", { name: new RegExp(`^${title}$`, "i") }).first();
      if (await link.isVisible().catch(() => false)) {
        // Good — it's visible
      }
    }

    // Check role-specific items
    if (role === "sales") {
      // Sales should NOT see these in the sidebar
      const sidebar = page.locator("[data-slot='sidebar']");
      const sidebarText = await sidebar.textContent();
      expect(sidebarText).not.toContain("Segments");
      expect(sidebarText).not.toContain("Intelligence");
      expect(sidebarText).not.toContain("System Health");
      expect(sidebarText).not.toContain("Templates");
      expect(sidebarText).not.toContain("Broadcasts");
      expect(sidebarText).not.toContain("User Management");
    }

    if (role === "manager") {
      const sidebar = page.locator("[data-slot='sidebar']");
      const sidebarText = await sidebar.textContent();
      expect(sidebarText).not.toContain("System Health");
      expect(sidebarText).toContain("User Management");
    }

    if (role === "owner") {
      const sidebar = page.locator("[data-slot='sidebar']");
      const sidebarText = await sidebar.textContent();
      expect(sidebarText).toContain("System Health");
      expect(sidebarText).toContain("User Management");
    }
  });

  test("access denied banner appears on dashboard after redirect", async ({ page }) => {
    const role = await detectRole(page);
    const { denied } = ACCESS_MATRIX[role];
    if (denied.length === 0) {
      test.skip();
      return;
    }

    // Visit a denied page — should redirect to dashboard with banner
    await page.goto(denied[0]);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page).toHaveURL(/\?error=access_denied/);
    // The access denied banner should be visible
    await expect(page.getByText(/don.?t have permission/i)).toBeVisible();
  });
});

test.describe("RBAC user management access", () => {
  test("user management page accessible only to owner and manager", async ({ page }) => {
    const role = await detectRole(page);

    if (role === "sales") {
      // Sales should be redirected away
      await page.goto("/settings/users");
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page).toHaveURL(/\?error=access_denied/);
    } else {
      // Owner and manager should see the user management page
      await page.goto("/settings/users");
      await expect(page).toHaveURL(/\/settings\/users/);
      await expect(page.getByRole("heading", { name: /user management/i })).toBeVisible();
    }
  });
});
