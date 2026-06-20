// Capture Government-decision screenshots for the user manual.
// Reuses the authed persistent profile under .auth/profile.
import { chromium } from 'playwright-core';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';
const OUT = 'guides/user-manual/img';

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 900 },
});
const page = ctx.pages()[0] || await ctx.newPage();

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', USER);
  await page.fill('input[name=password]', PASS);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}),
    page.keyboard.press('Enter'),
  ]);
  await page.waitForTimeout(2500);
}

// 1) LIST VIEW — select first data row so action buttons become enabled
await page.goto(BASE + 'gov-decisions', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
console.log('list URL:', page.url());
try {
  await page.locator('vaadin-grid-cell-content', { hasText: /Одобрен/i }).first().click({ timeout: 8000 });
  await page.waitForTimeout(800);
} catch (e) { console.log('row select err', String(e).slice(0, 80)); }
await page.screenshot({ path: `${OUT}/gov-01-list.png` });

// 2) CREATE FORM
await page.goto(BASE + 'gov-decisions/new', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
console.log('create URL:', page.url());
await page.screenshot({ path: `${OUT}/gov-02-create.png` });

// 3) DETAIL / VIEW of first record
await page.goto(BASE + 'gov-decisions', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);
try {
  await page.locator('vaadin-grid-cell-content', { hasText: /Одобрен/i }).first().click({ timeout: 8000 });
  await page.waitForTimeout(800);
  const viewBtn = page.locator('vaadin-button', { hasText: /Просмотр/i }).first();
  await viewBtn.click({ timeout: 8000 });
  await page.waitForTimeout(2500);
  console.log('detail URL:', page.url());
  await page.screenshot({ path: `${OUT}/gov-03-detail.png` });
} catch (e) { console.log('detail err', String(e).slice(0, 120)); }

await ctx.close();
console.log('done');
