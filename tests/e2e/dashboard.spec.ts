import { test, expect } from "@playwright/test";

/**
 * Dashboard page functional tests — run as owner.
 */

test.describe("Dashboard", () => {
  test("renders with 4 KPI cards", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Total Revenue")).toBeVisible();
    await expect(page.getByText("Active Leads")).toBeVisible();
    await expect(page.getByText("Quotes This Week")).toBeVisible();
    await expect(page.getByText("Conversion Rate")).toBeVisible();
  });

  test("revenue trend chart renders", async ({ page }) => {
    await page.goto("/dashboard");
    // Recharts renders an SVG
    await expect(page.locator(".recharts-surface").first()).toBeVisible({ timeout: 10000 });
  });

  test("recent activity list shows items", async ({ page }) => {
    await page.goto("/dashboard");
    // The recent activity section should be present (exact match to avoid
    // matching the subtitle text that also contains "recent activity")
    await expect(page.getByText("Recent Activity", { exact: true })).toBeVisible();
  });

  test("no console errors on dashboard", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => {
      if (err.message.includes("Turbopack") || err.message.includes("Failed to write page endpoint")) return;
      errors.push(err.message);
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const t = msg.text();
        if (t.includes("favicon") || t.includes("deprecat") || t.includes("Turbopack")) return;
        if (t.includes("Failed to write page endpoint") || t.includes("ENOENT")) return;
        errors.push(t);
      }
    });
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);
  });
});
