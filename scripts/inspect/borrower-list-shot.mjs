import { chromium } from 'playwright-core';
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto('file://' + process.cwd() + '/mockups/borrower/borrower-list.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.screenshot({ path: '.auth/borrower/mock-list.png', fullPage: true });
console.log('done');
await ctx.close();
