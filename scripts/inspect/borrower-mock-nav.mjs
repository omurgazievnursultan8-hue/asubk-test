import { chromium } from 'playwright-core';
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => console.log('  [pageerror]', e.message));
const BASE = 'http://localhost:8777/';

// 1) double-click a row -> detail
await page.goto(BASE + 'borrower-list.html', { waitUntil: 'networkidle' });
await page.dblclick('#rows tr:first-child');
await page.waitForLoadState('networkidle');
console.log('dblclick ->', page.url().split('/').pop(), '| title:', await page.evaluate(() => document.querySelector('.topbar .title')?.textContent));

// 2) select + Изменить -> detail
await page.goto(BASE + 'borrower-list.html', { waitUntil: 'networkidle' });
await page.click('#rows tr:nth-child(2)');
console.log('Изменить disabled after select:', await page.getAttribute('#btnEdit', 'disabled'));
await page.click('#btnEdit');
await page.waitForLoadState('networkidle');
console.log('Изменить ->', page.url().split('/').pop(), '| title:', await page.evaluate(() => document.querySelector('.topbar .title')?.textContent));
await ctx.close();
