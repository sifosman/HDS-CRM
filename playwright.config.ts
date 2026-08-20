import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for HDS CRM Dashboard E2E tests.
 *
 * Three role-based projects (owner, manager, sales) each with their own
 * auth setup and storage state, plus the original admin (mohamed) project
 * for the existing app.spec.ts suite.
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
    // --- Auth setup projects (run first) ---
    {
      name: "setup-admin",
      testMatch: /auth-setup\.ts$/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "setup-owner",
      testMatch: /auth-setup-owner\.ts$/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "setup-manager",
      testMatch: /auth-setup-manager\.ts$/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "setup-sales",
      testMatch: /auth-setup-sales\.ts$/,
      use: { ...devices["Desktop Chrome"] },
    },

    // --- Admin (mohamed) project: existing app.spec.ts ---
    {
      name: "admin",
      dependencies: ["setup-admin"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/user.json",
      },
      testMatch: /app\.spec\.ts$/,
    },

    // --- Owner project: rbac + user-management tests ---
    {
      name: "owner",
      dependencies: ["setup-owner"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/owner.json",
      },
      testMatch: /rbac\.spec\.ts|user-management\.spec\.ts|dashboard\.spec\.ts|customers\.spec\.ts|customer-detail\.spec\.ts|quotes\.spec\.ts|quote-detail\.spec\.ts|payments\.spec\.ts|segments\.spec\.ts|intelligence\.spec\.ts|reports\.spec\.ts|conversation-detail\.spec\.ts|health\.spec\.ts|templates\.spec\.ts|broadcasts\.spec\.ts|broadcast-detail\.spec\.ts|settings\.spec\.ts/,
    },

    // --- Manager project: rbac tests only ---
    {
      name: "manager",
      dependencies: ["setup-manager"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/manager.json",
      },
      testMatch: /rbac\.spec\.ts|user-management\.spec\.ts/,
    },

    // --- Sales project: rbac tests only ---
    {
      name: "sales",
      dependencies: ["setup-sales"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/sales.json",
      },
      testMatch: /rbac\.spec\.ts/,
    },
  ],

  webServer: {
    command: "npm run start",
    url: "http://localhost:3000/login",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    cwd: ".",
    env: {},
  },
});
