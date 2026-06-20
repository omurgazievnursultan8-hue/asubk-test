// Playwright UI tests for the ASUBK Credit Module (live test stand).
// Tests are organized by phase; each entity gets its own folder under tests/.
// Auth runs once (auth.setup.js) and is reused via storageState.
const { defineConfig, devices } = require('@playwright/test');

const BASE = process.env.OK_BASE || 'https://fkftest.okmot.kg/';
const STORAGE = 'tests/.auth/state.json';

module.exports = defineConfig({
  testDir: './tests',
  // The stand is remote + shared test data — keep it serial-ish and patient.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'tests/.report' }]],
  use: {
    baseURL: BASE,
    channel: 'chrome', // system Chrome, matches scripts/inspect/*.mjs (no bundled browser)
    ignoreHTTPSErrors: true,
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
    viewport: { width: 1600, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.js/ },
    {
      name: 'chromium',
      testIgnore: /auth\.setup\.js/,
      use: { ...devices['Desktop Chrome'], channel: 'chrome', storageState: STORAGE },
      dependencies: ['setup'],
    },
  ],
});
