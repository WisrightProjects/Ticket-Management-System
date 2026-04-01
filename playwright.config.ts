import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

// Load server/.env into the test process so WEBHOOK_SECRET, TEST_BACKEND_URL,
// and other vars are available in test files via process.env
dotenv.config({ path: "./server/.env" });

export default defineConfig({
  testDir: "./tests",
  outputDir: "./tests/test-results",
  globalSetup: "./tests/global-setup.ts",
  globalTeardown: "./tests/global-teardown.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["html", { outputFolder: "./tests/playwright-report" }]],
  use: {
    baseURL: "http://localhost:5174",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "cd server && bun run src/index.ts",
      port: 5001,
      env: {
        ...process.env,
        PORT: "5001",
        DATABASE_URL: "postgresql://postgres:1234@localhost:5433/ticket_management_test",
        BETTER_AUTH_SECRET: "test-secret-only-for-testing-do-not-use-in-production-abcdef1234567890",
        BETTER_AUTH_URL: "http://localhost:5001",
        CLIENT_URL: "http://localhost:5174",
        NODE_ENV: "test",
      },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "cd client && bun run dev --port 5174",
      port: 5174,
      env: {
        ...process.env,
        VITE_API_URL: "http://localhost:5174",
        VITE_APP_URL: "http://localhost:5174",
        PROXY_TARGET: "http://127.0.0.1:5001",
      },
      reuseExistingServer: !process.env.CI,
    },
  ],
});
