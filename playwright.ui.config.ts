import { defineConfig } from "@playwright/test";

// Built frontend with mocked API responses; requires no HTTP server or database.
export default defineConfig({
  testDir: "./tests",
  testMatch: ["customer-workspace-ui.spec.ts", "staff-workspace-ui.spec.ts"],
  outputDir: "./tests/test-results/customer-ui",
  workers: 1,
  use: { viewport: { width: 1440, height: 1000 }, headless: true },
});
