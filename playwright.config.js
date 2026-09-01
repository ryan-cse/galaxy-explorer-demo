const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright E2E layer for Galaxy Explorer.
 *
 * Runs against a local static server serving the repo root, so tests
 * exercise exactly the code on this branch (not the live Pages deploy).
 * Kept separate from the Vitest unit layer (tests/**\/*.test.js) and from
 * the mabl E2E layer in .github/workflows/deploy.yml.
 *
 * Written in CommonJS to match the repo (no "type":"module" in package.json).
 * Each test gets a fresh browser context, so localStorage — where favorites
 * are persisted under the "galaxy.favorites" key — starts empty every time.
 */
module.exports = defineConfig({
  testDir: './e2e',
  // The app loads its catalog live from SWAPI. Run serially so parallel
  // browsers don't contend for that external API (and Google Fonts) and
  // trip navigation/render timeouts. The suite is small, so cost is minimal.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    navigationTimeout: 45_000,
    actionTimeout: 15_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npx http-server . -p 4173 -c-1 --silent',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
