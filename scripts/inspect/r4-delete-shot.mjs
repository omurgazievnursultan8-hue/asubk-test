// R4: capture the gov-decision LIST toolbar where «Удалить» stays active on an
// approved («Одобрен») row while «Изменить» is disabled (P1-05). Selects an
// approved row, then full-page shot. Raw only; Russian annotations via PIL later.
import { chromium } from 'playwright-core';
const BASE = 'https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile', { channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1700, height: 1100 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', 'admin'); await page.fill('input[name=password]', 'admin');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }).catch(()=>{}), page.keyboard.press('Enter')]); await page.waitForTimeout(2500);
}
await page.goto(BASE + 'gov-decisions', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
// click a grid cell whose text === "Одобрен" to select that row
const clicked = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('vaadin-grid-cell-content')];
  const c = cells.find(e => e.textContent.trim() === 'Одобрен');
  if (c) { c.click(); return true; }
  return false;
});
console.log('selected approved row:', clicked);
await page.waitForTimeout(1500);
const OUT = 'screenshots/04-gov-list-delete.png';
await page.screenshot({ path: OUT, fullPage: true });
console.log('saved', OUT);
await ctx.close();
