// One-time auth: log in to the test stand and persist storageState.
// Mirrors scripts/inspect/login.mjs (form at /login, creds admin/admin).
const { test, expect } = require('@playwright/test');

const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';
const STORAGE = 'tests/.auth/state.json';

test('authenticate', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });

  if (page.url().includes('/login')) {
    await page.fill('input[name=username]', USER);
    await page.fill('input[name=password]', PASS);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}),
      page.keyboard.press('Enter'),
    ]);
    await page.waitForTimeout(2000);
  }

  // Logged in => no longer on /login.
  expect(page.url(), 'should be redirected off /login after sign-in').not.toContain('/login');
  await page.context().storageState({ path: STORAGE });
});
