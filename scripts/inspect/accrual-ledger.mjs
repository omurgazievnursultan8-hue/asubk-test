// Dump /loan-ledgers (all rows) + /payments, to diff before/after accrual buttons.
//   TAG=before node scripts/inspect/accrual-ledger.mjs
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'fs';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';
const TAG = process.env.TAG || 'x';
const OUT = '.auth/accrual';
mkdirSync(OUT, { recursive: true });

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1900, height: 1100 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', USER);
  await page.fill('input[name=password]', PASS);
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(2500);
}

async function dumpGrid(route, label) {
  await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);
  // scroll grid to load all virtual rows
  for (let i = 0; i < 25; i++) {
    await page.evaluate(() => { const g = document.querySelector('vaadin-grid'); if (g) g.scrollBy ? g.scrollBy(0, 2000) : g.$?.table?.scrollBy(0, 2000); });
    await page.evaluate(() => { const g = document.querySelector('vaadin-grid'); const t = g && (g.shadowRoot?.querySelector('#table')); if (t) t.scrollTop = t.scrollHeight; });
    await page.waitForTimeout(350);
  }
  const res = await page.evaluate(() => {
    const clean = s => (s || '').replace(/\s+/g, ' ').trim();
    const g = document.querySelector('vaadin-grid');
    if (!g) return null;
    const cols = [...g.querySelectorAll('vaadin-grid-column,vaadin-grid-sort-column')].map(c => clean(c.getAttribute('header') || c.getAttribute('path')));
    const cells = [...g.querySelectorAll('vaadin-grid-cell-content')].map(c => clean(c.textContent));
    return { cols, cells };
  });
  if (!res) { console.log(label, 'NO GRID'); return null; }
  const n = res.cols.length || 1;
  const rows = [];
  for (let r = 0; r < res.cells.length; r += n) rows.push(res.cells.slice(r, r + n));
  console.log(`\n===== ${label} (${route}) cols=${n} rows=${rows.length} =====`);
  rows.forEach(r => console.log('  |', r.join(' | ')));
  return { cols: res.cols, rows };
}

const led = await dumpGrid('loan-ledgers', 'LoanLedger');
const pay = await dumpGrid('payments', 'Платежи');
writeFileSync(`${OUT}/ledger-${TAG}.json`, JSON.stringify({ led, pay }, null, 1));
await ctx.close();
