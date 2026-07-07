// Phase 5 — precise capture of the CREDIT LIST view (/loansCredit) for the
// "точная копия" mockup diff. Dumps: column headers (exact), toolbar buttons in
// order, filter panel, pager text, row count, per-cell text of every row, and the
// enabled/disabled state of row-action buttons before/after selecting a row.
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'fs';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';
const OUTDIR = '.auth/loan-credit';
mkdirSync(OUTDIR, { recursive: true });

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
const log = (...a) => console.log(...a);

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

await page.goto(BASE + 'loansCredit', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

const out = {};

// ---- column headers, in order ----
out.headers = await page.evaluate(() => {
  const grid = document.querySelector('vaadin-grid');
  if (!grid) return null;
  const cols = [...grid.querySelectorAll('vaadin-grid-column, vaadin-grid-sort-column')];
  return cols.map(c => {
    const hdr = c.querySelector('vaadin-grid-cell-content, [slot=header]');
    return (c.getAttribute('header') || (hdr && hdr.textContent.trim()) || '').trim();
  });
});

// header cells actually rendered (covers slotted header content)
out.headerCells = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('vaadin-grid-cell-content')].map(e => e.textContent.trim());
  return rows;
});

// ---- toolbar buttons in DOM order (text + title + icon-only?) ----
out.toolbar = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('vaadin-button, vaadin-menu-bar-button, vaadin-menu-bar')];
  return btns.map(b => ({
    text: b.textContent.trim(),
    title: b.getAttribute('title') || '',
    theme: b.getAttribute('theme') || '',
    disabled: b.hasAttribute('disabled'),
  }));
});

// ---- filter / search area labels ----
out.filterArea = await page.evaluate(() => {
  const t = document.body.innerText;
  const rows = t.split('\n').map(s => s.trim()).filter(Boolean);
  return rows.slice(0, 40);
});

// ---- pager / row-count text ----
out.pager = await page.evaluate(() => {
  const m = document.body.innerText.match(/\d+\s*(строк|записей|rows)/i);
  return m ? m[0] : null;
});

// ---- every data row, cell by cell ----
out.rows = await page.evaluate(() => {
  const grid = document.querySelector('vaadin-grid');
  if (!grid) return null;
  const cells = [...grid.querySelectorAll('vaadin-grid-cell-content')]
    .map(e => e.textContent.trim());
  return cells; // caller slices by column count
});

await page.screenshot({ path: `${OUTDIR}/LIVE-list.png`, fullPage: false });

// ---- row-action button state: before selecting ----
const btnState = async () => page.evaluate(() => {
  const find = (label) => {
    const b = [...document.querySelectorAll('vaadin-button')]
      .find(x => x.textContent.trim() === label);
    return b ? { found: true, disabled: b.hasAttribute('disabled') } : { found: false };
  };
  return { Изменить: find('Изменить'), Просмотр: find('Просмотр') };
});
out.btnBeforeSelect = await btnState();

// click first data row
await page.evaluate(() => {
  const cell = document.querySelector('vaadin-grid-cell-content');
  const row = cell && cell.closest ? cell : null;
});
const firstRow = await page.$('vaadin-grid');
if (firstRow) {
  const box = await firstRow.boundingBox();
  if (box) { await page.mouse.click(box.x + 60, box.y + 90); await page.waitForTimeout(800); }
}
out.btnAfterSelect = await btnState();
await page.screenshot({ path: `${OUTDIR}/LIVE-list-selected.png`, fullPage: false });

writeFileSync(`${OUTDIR}/list-diff.json`, JSON.stringify(out, null, 2));
log('HEADERS:', JSON.stringify(out.headers));
log('TOOLBAR:', JSON.stringify(out.toolbar));
log('PAGER:', out.pager);
log('BTN before:', JSON.stringify(out.btnBeforeSelect));
log('BTN after :', JSON.stringify(out.btnAfterSelect));
log('rows cells total:', out.rows ? out.rows.length : 'none');
log('saved -> .auth/loan-credit/list-diff.json + LIVE-list*.png');
await ctx.close();
