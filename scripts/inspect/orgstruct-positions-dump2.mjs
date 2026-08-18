/** Clean dump of «Должности» grid (headers + rows) and the add-position dialog. READ-ONLY. */
import { chromium } from 'playwright-core';
const BASE = 'https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1680, height: 1050 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]','admin'); await page.fill('input[name=password]','admin');
  await Promise.all([page.waitForNavigation({waitUntil:'networkidle',timeout:60000}).catch(()=>{}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(2500);
}
await page.goto(BASE + 'org-structure-mgmt', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
await page.locator('[role=tab]', { hasText: 'Должности' }).first().click();
await page.waitForTimeout(2000);

const dump = await page.evaluate(() => {
  const main = document.querySelector('vaadin-app-layout > vaadin-vertical-layout:not([slot])');
  const grid = main.querySelector('vaadin-grid');
  if (!grid) return { err: 'no grid' };
  const cells = [...grid.querySelectorAll('vaadin-grid-cell-content')]
    .map(c => ({ y: c.getBoundingClientRect().top, x: c.getBoundingClientRect().left, t: c.innerText.trim() }))
    .filter(c => c.t !== '');
  const rows = {};
  cells.forEach(c => { const k = Math.round(c.y / 5) * 5; (rows[k] ||= []).push(c); });
  return Object.keys(rows).map(Number).sort((a,b)=>a-b)
    .map(k => rows[k].sort((a,b)=>a.x-b.x).map(c => c.t).join(' | '));
});
console.log('=== ДОЛЖНОСТИ grid ===');
console.log(Array.isArray(dump) ? dump.join('\n') : JSON.stringify(dump));

const btns = await page.evaluate(() => {
  const main = document.querySelector('vaadin-app-layout > vaadin-vertical-layout:not([slot])');
  return [...main.querySelectorAll('vaadin-button, button')]
    .filter(b => b.offsetParent !== null || b.getClientRects().length)
    .map(b => b.textContent.trim()).filter(Boolean);
});
console.log('VISIBLE BUTTONS:', JSON.stringify(btns));

const add = page.locator('vaadin-app-layout > vaadin-vertical-layout:not([slot]) vaadin-button')
  .filter({ hasText: /^Добавить$/ }).first();
if (await add.count()) {
  await add.click({ force: true }); await page.waitForTimeout(1600);
  const d = await page.evaluate(() => {
    const ov = document.querySelector('vaadin-dialog-overlay'); if (!ov) return null;
    return { text: ov.textContent.trim().slice(0,400),
      fields: [...ov.querySelectorAll('vaadin-text-field,vaadin-combo-box,vaadin-checkbox,vaadin-integer-field,vaadin-number-field,vaadin-select')].map(f=>f.tagName.toLowerCase()) };
  });
  console.log('NEW POSITION DIALOG:', JSON.stringify(d, null, 1));
  await page.screenshot({ path: '.auth/orgstruct-position-add.png', fullPage: true });
  await page.keyboard.press('Escape');
}
await ctx.close();
