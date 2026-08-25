import { test, expect } from "@playwright/test";

/**
 * AI Training Advisor — owner-only feature tests.
 *
 * These tests run under the owner project (authenticated as owner).
 * They verify:
 * - The page loads and renders the workspace.
 * - The sidebar item is visible.
 * - The model selector exposes exactly five allowlisted models.
 * - Sessions can be created.
 * - The change-request dialog is accessible.
 * - The read-only notice is present.
 */

test.describe("AI Training Advisor", () => {
  test("page loads for owner", async ({ page }) => {
    await page.goto("/ai-training");
    await expect(page).not.toHaveURL(/\?error=access_denied/);
    await expect(page).not.toHaveURL(/\/login/);
    // The welcome view should be visible
    await expect(page.getByText("AI Training Advisor")).toBeVisible();
  });

  test("sidebar shows AI Training Advisor link", async ({ page }) => {
    await page.goto("/dashboard");
    const sidebar = page.locator("[data-slot='sidebar']");
    const sidebarText = await sidebar.textContent();
    expect(sidebarText).toContain("AI Training Advisor");
  });

  test("read-only notice is displayed", async ({ page }) => {
    await page.goto("/ai-training");
    await expect(page.getByText(/Read-only advisor/)).toBeVisible();
  });

  test("new chat button is visible", async ({ page }) => {
    await page.goto("/ai-training");
    await expect(page.getByRole("button", { name: /New Chat/i })).toBeVisible();
  });

  test("model selector shows five allowlisted models", async ({ page }) => {
    // First create a session to see the model selector
    await page.goto("/ai-training");
    await page.getByRole("button", { name: /New Chat/i }).click();
    // Wait for navigation to session page
    await page.waitForURL(/\/ai-training\/[a-f0-9-]+/);

    // Open the model selector
    const modelTrigger = page.locator("select, [role='combobox']").first();
    await modelTrigger.click();

    // Verify all five models are present
    const options = page.locator("[role='option']");
    const optionTexts = await options.allTextContents();
    const joined = optionTexts.join("\n");
    expect(joined).toContain("Claude Sonnet 5");
    expect(joined).toContain("GPT-5.6 Sol");
    expect(joined).toContain("Kimi K3");
    expect(joined).toContain("DeepSeek V4 Pro");
    expect(joined).toContain("Qwen 3.8 Max");
  });

  test("change requests panel is visible", async ({ page }) => {
    await page.goto("/ai-training");
    await expect(page.getByText("Change Requests")).toBeVisible();
  });

  test("chat API rejects unauthenticated requests", async ({ request }) => {
    const response = await request.post("/api/ai-training/chat", {
      data: {
        sessionId: "00000000-0000-0000-0000-000000000000",
        message: "test",
      },
    });
    // Should be 401 (not authenticated) since we're not sending cookies
    expect(response.status()).toBe(401);
  });

  test("chat API rejects invalid model IDs", async ({ page, request }) => {
    // Create a session first
    await page.goto("/ai-training");
    await page.getByRole("button", { name: /New Chat/i }).click();
    await page.waitForURL(/\/ai-training\/[a-f0-9-]+/);
    const sessionId = page.url().split("/ai-training/")[1];

    // Try to send with an invalid model — the API should reject it.
    // We use the request context with the page's cookies.
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    const response = await request.post("/api/ai-training/chat", {
      headers: { cookie: cookieHeader, "Content-Type": "application/json" },
      data: {
        sessionId,
        message: "test",
        model: "invalid/arbitrary-model",
      },
    });
    expect(response.status()).toBe(400);
  });
});
