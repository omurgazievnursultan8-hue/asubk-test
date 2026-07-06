// Screenshot the borrower mockup for side-by-side compare with the live page.
import { chromium } from 'playwright-core';
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto('file://' + process.cwd() + '/mockups/borrower/borrower.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.screenshot({ path: '.auth/borrower/mock-tab0.png', fullPage: true });
await page.click('.tab[data-tab=credits]'); await page.waitForTimeout(300);
await page.screenshot({ path: '.auth/borrower/mock-credits.png', fullPage: true });
console.log('shot done');
await ctx.close();
