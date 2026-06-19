import { chromium } from 'playwright-core';
const BASE = 'https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile', { channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1700, height: 1100 } });
const page = ctx.pages()[0] || await ctx.newPage();
const log = (...a) => console.log(...a);

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', 'admin'); await page.fill('input[name=password]', 'admin');
  await Promise.all([page.waitForNavigation().catch(() => {}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(2500);
}

// ---- gov-decisions list: what statuses exist ----
await page.goto(BASE + 'gov-decisions', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
const govCols = await page.evaluate(() => [...document.querySelectorAll('vaadin-grid-column,vaadin-grid-sort-column')].map(c => c.header || c.path).filter(Boolean));
const govCells = await page.evaluate(() => [...document.querySelectorAll('vaadin-grid-cell-content')].map(c => c.textContent.trim()).filter(Boolean));
log('GOV COLUMNS:', JSON.stringify(govCols));
log('GOV STATUSES present:', JSON.stringify([...new Set(govCells.filter(r => /рассмотр|одобр|закры|действ|отклон|чернов|доработ/i.test(r)))]));
log('GOV CELLS sample:', JSON.stringify(govCells.slice(0, 80)));

// ---- loan-program create form: open Решение правительства picker ----
await page.goto(BASE + 'loan-programs/new', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);

// target the gov-decision picker by id
const target = page.locator('#govDecisionField');
if (!(await target.count())) { log('!! #govDecisionField NOT found'); await ctx.close(); process.exit(0); }
// click the ••• lookup action (opens the entity selection screen)
await target.locator('#entityLookupAction').click({ timeout: 5000 });
await page.waitForTimeout(2500);
log('OVERLAYS:', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('[class*=overlay],vaadin-dialog-overlay,vaadin-combo-box-overlay')].map(o => o.tagName.toLowerCase()))));

const dlg = await page.evaluate(() => {
  const ov = document.querySelector('vaadin-dialog-overlay, vaadin-combo-box-overlay, vaadin-select-overlay');
  if (!ov) return null;
  const cols = [...ov.querySelectorAll('vaadin-grid-column,vaadin-grid-sort-column')].map(c => c.header || c.path).filter(Boolean);
  const cells = [...ov.querySelectorAll('vaadin-grid-cell-content')].map(c => c.textContent.trim()).filter(Boolean);
  const title = ov.querySelector('[part="header"], h2, header')?.textContent?.trim() || null;
  // any filter/status combo inside the dialog
  const combos = [...ov.querySelectorAll('vaadin-combo-box,vaadin-select,vaadin-text-field')].map(c => ({
    tag: c.tagName.toLowerCase(),
    label: c.querySelector(':scope > label[slot="label"]')?.textContent?.trim() || c.getAttribute('aria-label') || null,
    value: (c.value || '').toString().slice(0, 40),
  }));
  return { title, cols, cells: cells.slice(0, 200), combos };
});
log('\n=== РЕШЕНИЕ PICKER DIALOG ===');
log('TITLE:', dlg?.title);
log('COLS:', JSON.stringify(dlg?.cols));
log('FILTER COMBOS:', JSON.stringify(dlg?.combos));
log('CELLS:', JSON.stringify(dlg?.cells));
log('PICKER STATUSES shown:', JSON.stringify([...new Set((dlg?.cells || []).filter(r => /рассмотр|одобр|закры|действ|отклон|чернов|доработ/i.test(r)))]));
await page.screenshot({ path: '.auth/decision-picker.png', fullPage: true });
await ctx.close();
