import { chromium } from 'playwright-core';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';
const PROFILE = '.auth/profile';

const ctx = await chromium.launchPersistentContext(PROFILE, {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });

if (page.url().includes('/login')) {
  await page.fill('input[name=username]', USER);
  await page.fill('input[name=password]', PASS);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}),
    page.keyboard.press('Enter'),
  ]);
  await page.waitForTimeout(2000);
}
console.log('URL after login:', page.url());
console.log('TITLE:', await page.title());
await page.goto(BASE + 'loan-programs', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(1500);
console.log('URL loan-programs:', page.url());
await page.screenshot({ path: '.auth/loan-programs.png', fullPage: true });
await ctx.close();
