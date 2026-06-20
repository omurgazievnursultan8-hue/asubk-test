// Capture login flow screenshots for the user manual.
// Fresh (non-persistent) context => the login screen always shows.
import { chromium } from 'playwright-core';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';
const OUT = 'guides/user-manual/img';

const browser = await chromium.launch({ channel: 'chrome', headless: true, ignoreHTTPSErrors: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();

await page.goto(BASE + 'login', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(1500);
console.log('login URL:', page.url());

// 1) empty login screen
await page.screenshot({ path: `${OUT}/01-login-empty.png` });

// 2) credentials filled
await page.fill('input[name=username]', USER);
await page.fill('input[name=password]', PASS);
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/02-login-filled.png` });

// 3) submit -> dashboard
await Promise.all([
  page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}),
  page.keyboard.press('Enter'),
]);
await page.waitForTimeout(2500);
console.log('after login URL:', page.url());
console.log('TITLE:', await page.title());
await page.screenshot({ path: `${OUT}/03-dashboard.png` });

await browser.close();
console.log('done');
