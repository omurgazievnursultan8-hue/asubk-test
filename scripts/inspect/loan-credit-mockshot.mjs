// Screenshot the loan-credit mockup (list + detail tabs) for visual verification.
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url';
import { resolve } from 'path';

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
const url = pathToFileURL(resolve('mockups/loan-credit/loan-credit.html')).href;
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(400);
await page.screenshot({ path: '.auth/loan-credit/MOCK-list.png' });

// select a row, open detail
await page.click('#listBody tr:nth-child(10)');
await page.click('#btnEdit');
await page.waitForTimeout(300);
const tabs = [0,3,4,9];
for (const t of tabs) {
  await page.evaluate(i => window.switchTab(i), t);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `.auth/loan-credit/MOCK-tab${t}.png` });
}
console.log('done');
await ctx.close();
