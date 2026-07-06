// Scrape full borrower list grid (untruncated) + toolbar/filter labels.
import { chromium } from 'playwright-core';
import { writeFileSync } from 'fs';
const BASE = 'https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', 'admin'); await page.fill('input[name=password]', 'admin');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }).catch(()=>{}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(2500);
}
await page.goto(BASE + 'loan-applicants', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
const out = {};
out.title = await page.evaluate(() => document.querySelector('h1,h2,[class*=title]')?.textContent?.trim());
out.buttons = await page.evaluate(() => [...document.querySelectorAll('vaadin-button')].map(b => ({
  label: b.textContent.trim(), disabled: b.hasAttribute('disabled') })).filter(b => b.label));
out.filterLabels = await page.evaluate(() => [...document.querySelectorAll('label')].map(l => l.textContent.trim()).filter(Boolean));
// grid: read header cols then body rows in DOM order (5 cols per row)
out.grid = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('vaadin-grid-cell-content')].map(c => c.textContent.trim());
  return cells;
});
out.rowCount = await page.evaluate(() => {
  const m = document.body.innerText.match(/(\d+)\s*строк/); return m ? m[1] : null;
});
writeFileSync('.auth/borrower-list.json', JSON.stringify(out, null, 2));
console.log('title:', out.title, '| rows:', out.rowCount);
console.log('buttons:', out.buttons.map(b => b.label + (b.disabled?'(off)':'')).join(' | '));
console.log('grid cells:', out.grid.length);
console.log(JSON.stringify(out.grid, null, 1));
await ctx.close();
