import { defineConfig, devices } from "@playwright/test";

/**
 * Config for the accessibility/responsive suites that live in this
 * directory. The root config's testDir is tests/e2e, which silently
 * excludes these files even when passed explicitly on the CLI (Playwright
 * only applies filters within testDir). Run with, for example:
 *
 *   npx playwright test --config tests/playwright.config.ts accessibility/
 */
export default defineConfig({
  testDir: ".",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
