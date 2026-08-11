import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for HDS CRM Dashboard E2E tests (Phase 7).
 *
 * Tests run against the local Next.js dev server. Auth is handled via a
 * global setup that logs in through the Supabase client and stores the
 * session cookies in browser context storageState.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 20_000,
  },

  projects: [
    {
      name: "setup",
      testMatch: /auth-setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/user.json",
      },
      testIgnore: /auth-setup\.ts/,
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    cwd: ".",
  },
});
