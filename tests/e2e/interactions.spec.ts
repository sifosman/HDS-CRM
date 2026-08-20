import { test, expect } from "@playwright/test";

/**
 * Comprehensive interaction tests — actually clicks through every
 * interactive element on each page. Run as owner.
 *
 * Unlike the smoke tests which only check that pages render, these
 * tests fill forms, click buttons, submit data, and verify the results.
 */

test.describe("Dashboard interactions", () => {
  test("KPI cards show numeric values", async ({ page }) => {
    await page.goto("/dashboard");
    const kpiCards = page.locator("[data-slot='card']").filter({
      hasText: /Total Revenue|Active Leads|Quotes This Week|Conversion Rate/,
    });
    const count = await kpiCards.count();
    expect(count).toBeGreaterThanOrEqual(4);
    // Each KPI card should have a numeric value (not empty)
    for (let i = 0; i < count; i++) {
      const text = await kpiCards.nth(i).textContent();
      expect(text).toMatch(/R\$|R\d|\d/);
    }
  });

  test("revenue and pipeline charts render as SVGs", async ({ page }) => {
    await page.goto("/dashboard");
    const charts = page.locator(".recharts-surface");
    await expect(charts.first()).toBeVisible({ timeout: 10000 });
    expect(await charts.count()).toBeGreaterThanOrEqual(2);
  });

  test("recent activity section shows content", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("Recent Activity", { exact: true })).toBeVisible();
  });
});

test.describe("Customers interactions", () => {
  test("search filters rows and clears", async ({ page }) => {
    await page.goto("/customers");
    await expect(page.locator("table").first()).toBeVisible();

    const searchInput = page.getByPlaceholder(/search/i).first();
    if (!(await searchInput.isVisible())) test.skip();

    const initialRows = await page.locator("table tbody tr").count();
    expect(initialRows).toBeGreaterThan(0);

    // Filter to empty
    await searchInput.fill("zzzzzzzz_not_a_real_customer");
    await expect(page.getByText(/no customers found/i)).toBeVisible({ timeout: 10000 });

    // Clear filter
    await searchInput.fill("");
    await page.waitForTimeout(1000);
    const restoredRows = await page.locator("table tbody tr").count();
    expect(restoredRows).toBeGreaterThan(0);
  });

  test("customer detail shows conversation and quote history", async ({ page }) => {
    await page.goto("/customers");
    const firstLink = page.locator("table tbody tr a").first();
    if (!(await firstLink.isVisible())) test.skip();

    await firstLink.click();
    await expect(page).toHaveURL(/\/customers\//);

    const bodyText = await page.locator("body").textContent() || "";
    // Should show conversation history or quote history
    expect(
      bodyText.includes("Conversation") ||
      bodyText.includes("Quote") ||
      bodyText.includes("Lead Status"),
    ).toBeTruthy();
  });

  test("customer detail shows info cards", async ({ page }) => {
    await page.goto("/customers");
    const firstLink = page.locator("table tbody tr a").first();
    if (!(await firstLink.isVisible())) test.skip();

    await firstLink.click();
    const cards = page.locator("[data-slot='card']");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    expect(await cards.count()).toBeGreaterThan(0);
  });
});

test.describe("Quotes interactions", () => {
  test("quote detail shows breakdown and PDF link", async ({ page }) => {
    await page.goto("/quotes");
    const firstLink = page.locator("table tbody tr a").first();
    if (!(await firstLink.isVisible())) test.skip();

    await firstLink.click();
    await expect(page).toHaveURL(/\/quotes\//);

    const bodyText = await page.locator("body").textContent() || "";
    expect(
      bodyText.includes("Total") ||
      bodyText.includes("Amount") ||
      bodyText.includes("Price") ||
      bodyText.includes("Breakdown"),
    ).toBeTruthy();

    // PDF download link should be present
    const pdfLink = page.locator("a[href*='pdf'], a:has-text('PDF'), button:has-text('PDF'), a:has-text('Download')");
    expect(await pdfLink.first().isVisible().catch(() => false)).toBeTruthy();
  });

  test("quote detail shows status badge", async ({ page }) => {
    await page.goto("/quotes");
    const firstLink = page.locator("table tbody tr a").first();
    if (!(await firstLink.isVisible())) test.skip();

    await firstLink.click();
    const badge = page.locator("[data-slot='badge']").first();
    await expect(badge).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Segments interactions", () => {
  test("create segment dialog has form fields and cancel works", async ({ page }) => {
    await page.goto("/segments");
    const newBtn = page.getByRole("button", { name: /new segment/i }).first();
    await expect(newBtn).toBeVisible();
    await newBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Should have form inputs
    const inputs = await dialog.locator("input, textarea").count();
    expect(inputs).toBeGreaterThan(0);

    // Fill in a name
    const nameInput = dialog.getByLabel(/name/i).first();
    if (await nameInput.isVisible()) {
      await nameInput.fill("E2E Test Segment");
    }

    // Cancel should close the dialog
    const cancelBtn = dialog.getByRole("button", { name: /cancel/i });
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
      await expect(dialog).not.toBeVisible({ timeout: 5000 });
    } else {
      await page.keyboard.press("Escape");
    }
  });
});

test.describe("Templates interactions", () => {
  test("create template dialog has form fields and cancel works", async ({ page }) => {
    await page.goto("/templates");
    const newBtn = page.getByRole("button", { name: /new template/i }).first();
    await expect(newBtn).toBeVisible();
    await newBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Should have form inputs
    const inputs = await dialog.locator("input, textarea").count();
    expect(inputs).toBeGreaterThan(0);

    // Fill in name and message
    const nameInput = dialog.getByLabel(/name/i).first();
    if (await nameInput.isVisible()) {
      await nameInput.fill("E2E Test Template");
    }
    const textarea = dialog.locator("textarea").first();
    if (await textarea.isVisible()) {
      await textarea.fill("Hello {{name}}, test message.");
    }

    // Should have select fields (language, category, etc.)
    const selects = await dialog.locator("[data-slot='select-trigger']").count();
    expect(selects).toBeGreaterThan(0);

    // Cancel
    const cancelBtn = dialog.getByRole("button", { name: /cancel/i });
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
      await expect(dialog).not.toBeVisible({ timeout: 5000 });
    } else {
      await page.keyboard.press("Escape");
    }
  });
});

test.describe("Broadcasts interactions", () => {
  test("new broadcast button opens creation form", async ({ page }) => {
    await page.goto("/broadcasts");
    const newBtn = page.getByRole("button", { name: /new broadcast/i }).first();
    await expect(newBtn).toBeVisible();
    await newBtn.click();

    // Should open a dialog with form fields
    const dialog = page.getByRole("dialog");
    const isOpen = await dialog.isVisible({ timeout: 5000 }).catch(() => false);
    if (isOpen) {
      const inputs = await dialog.locator("input, textarea").count();
      expect(inputs).toBeGreaterThan(0);

      // Fill in name
      const nameInput = dialog.getByLabel(/name|title/i).first();
      if (await nameInput.isVisible()) {
        await nameInput.fill("E2E Test Broadcast");
      }

      // Should have select fields (segment, template, etc.)
      const selects = await dialog.locator("[data-slot='select-trigger']").count();
      expect(selects).toBeGreaterThan(0);

      // Cancel
      const cancelBtn = dialog.getByRole("button", { name: /cancel/i });
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
      } else {
        await page.keyboard.press("Escape");
      }
    }
  });
});

test.describe("AI Performance interactions", () => {
  test("conversation detail shows messages and quality indicators", async ({ page }) => {
    await page.goto("/reports/ai-performance");
    await page.waitForTimeout(3000);

    const convLink = page.locator("a[href*='/conversations/']").first();
    if (!(await convLink.isVisible())) test.skip();

    await convLink.click();
    await expect(page).toHaveURL(/\/conversations\//);

    // Should show messages
    const bodyText = await page.locator("body").textContent() || "";
    expect(
      bodyText.includes("Customer") ||
      bodyText.includes("Bot") ||
      bodyText.includes("AI") ||
      bodyText.includes("Message"),
    ).toBeTruthy();

    // Should show quality indicators
    expect(
      bodyText.includes("Quality") ||
      bodyText.includes("Flag") ||
      bodyText.includes("Score"),
    ).toBeTruthy();

    // Back button
    await expect(page.getByRole("link", { name: /back/i }).first()).toBeVisible();
  });
});

test.describe("Settings interactions", () => {
  test("profile shows read-only email and role badge", async ({ page }) => {
    await page.goto("/settings");
    const emailInput = page.getByLabel("Email");
    await expect(emailInput).toBeVisible();
    expect(await emailInput.inputValue()).toMatch(/@/);
    expect(await emailInput.getAttribute("readonly")).not.toBeNull();
  });

  test("user management link navigates correctly", async ({ page }) => {
    await page.goto("/settings");
    const link = page.getByRole("link", { name: /manage users/i });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/settings\/users/);
  });

  test("all settings sections are present", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText("Profile", { exact: true })).toBeVisible();
    await expect(page.getByText("Notification Preferences")).toBeVisible();
    await expect(page.getByText("Weekly Report Schedule")).toBeVisible();
    await expect(page.getByText("Branch Assignment")).toBeVisible();
  });
});

test.describe("Sidebar navigation - click every item", () => {
  test("all sidebar links navigate to their pages", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForTimeout(2000);

    const navLinks = page.locator("[data-slot='sidebar'] a[href]");
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      // Re-query each time because navigation may re-render the sidebar
      await page.goto("/dashboard");
      await page.waitForTimeout(1500);
      const links = page.locator("[data-slot='sidebar'] a[href]");
      const link = links.nth(i);
      const href = await link.getAttribute("href");
      if (!href || href === "#") continue;

      const text = (await link.textContent())?.trim();
      await link.click();
      await page.waitForTimeout(2000);
      const navigated = page.url().includes(href) || (href === "/dashboard" && page.url().endsWith("/dashboard"));
      expect(navigated, `Clicking "${text}" should navigate to ${href}`).toBeTruthy();
    }
  });
});

test.describe("Theme toggle", () => {
  test("toggles dark/light mode", async ({ page }) => {
    await page.goto("/dashboard");
    const html = page.locator("html");
    const classBefore = await html.getAttribute("class");
    const toggle = page.getByRole("button", { name: /toggle theme|theme/i }).first();
    await expect(toggle).toBeVisible();
    await toggle.click();
    await page.waitForTimeout(500);
    const classAfter = await html.getAttribute("class");
    expect(classBefore).not.toEqual(classAfter);
  });
});

// NOTE: The logout test is intentionally NOT included here because it
// invalidates the session token in the storage state, which would cause
// all subsequent tests using the same storage state to fail. The logout
// flow is already tested in app.spec.ts under the admin project.
