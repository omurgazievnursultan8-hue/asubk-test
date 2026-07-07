// scripts/inspect/loan-credit-zalog.mjs
// Dumps the «Залог» (tab 11) of loan-credits record 18: buttons, states,
// grid columns, and what «Редактировать»/«Просмотр» open.
import { chromium } from 'playwright-core';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';
const recordId = process.argv[2] || '18';

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1700, height: 1100 },
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
  await page.waitForTimeout(2500);
}

await page.goto(BASE + `loan-credits/${recordId}`, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

// Click «Залог» tab
const clicked = await page.evaluate(() => {
  const t = [...document.querySelectorAll('vaadin-tab')].find(t => t.innerText.trim() === 'Залог');
  if (t) { t.click(); return true; }
  return false;
});
console.log('CLICKED ZALOG TAB:', clicked);
await page.waitForTimeout(2000);

// Dump buttons visible in the active tab panel
const dump = await page.evaluate(() => {
  // find the visible tabsheet panel
  const btns = [...document.querySelectorAll('vaadin-button')]
    .filter(b => b.getBoundingClientRect().width > 0 && b.getBoundingClientRect().top > 100)
    .map(b => ({ text: b.innerText.trim(), disabled: b.hasAttribute('disabled') || b.disabled }));
  // grid columns
  const grids = [...document.querySelectorAll('vaadin-grid')].filter(g => g.getBoundingClientRect().width > 0);
  const cols = grids.map(g => [...g.querySelectorAll('vaadin-grid-column, vaadin-grid-sort-column')]
    .map(c => c.getAttribute('header') || c.path || '').filter(Boolean));
  const rowCount = grids.map(g => g.querySelectorAll('tbody tr, td').length);
  return { btns, cols, rowCount };
});
console.log('BUTTONS:', JSON.stringify(dump.btns, null, 2));
console.log('GRID COLS:', JSON.stringify(dump.cols));
console.log('GRID ROW/CELL COUNT:', JSON.stringify(dump.rowCount));

// Try clicking «Редактировать» (no selection) to see if anything opens / notification
const before = page.url();
await page.evaluate(() => {
  const b = [...document.querySelectorAll('vaadin-button')].find(b => b.innerText.trim() === 'Редактировать' && b.getBoundingClientRect().top > 100);
  if (b && !b.disabled) b.click();
});
await page.waitForTimeout(1500);
const afterEdit = await page.evaluate(() => ({
  url: location.href,
  dialogs: [...document.querySelectorAll('vaadin-dialog-overlay, [role=dialog]')].filter(d=>d.getBoundingClientRect().width>0).map(d=>d.innerText.slice(0,200)),
  notif: [...document.querySelectorAll('vaadin-notification-card')].map(n=>n.innerText.trim()),
}));
console.log('AFTER EDIT CLICK:', JSON.stringify(afterEdit, null, 2));

await ctx.close();
