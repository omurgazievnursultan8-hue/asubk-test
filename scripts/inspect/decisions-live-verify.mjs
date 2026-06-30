// Live verification of dev-reported Phase-1 (Решение правительства) tasks R1–R7
// against https://fkftest.okmot.kg/ . Read-only probe; does NOT mutate records.
// Run: node scripts/inspect/decisions-live-verify.mjs
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const BASE = 'https://fkftest.okmot.kg/';
const SHOT = '.auth/live-verify';
mkdirSync(SHOT, { recursive: true });
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1700, height: 1100 },
});
const page = ctx.pages()[0] || await ctx.newPage();
const log = (...a) => console.log(...a);

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', 'admin'); await page.fill('input[name=password]', 'admin');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }).catch(()=>{}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(2500);
}
log('LOGIN OK:', page.url());

const dumpFields = () => page.evaluate(() => {
  const TAGS = ['vaadin-text-field','vaadin-text-area','vaadin-number-field','vaadin-integer-field','vaadin-big-decimal-field','vaadin-date-picker','vaadin-date-time-picker','vaadin-combo-box','vaadin-select','vaadin-checkbox','vaadin-multi-select-combo-box','jmix-value-picker','vaadin-upload'];
  const res = [];
  for (const el of document.querySelectorAll(TAGS.join(','))) {
    const r = el.getBoundingClientRect(); if (!(r.width>0&&r.height>0)) continue;
    let lab = el.querySelector(':scope > label[slot="label"]')?.textContent?.trim()
           || el.shadowRoot?.querySelector('[part="label"]')?.textContent?.trim()
           || el.getAttribute('aria-label') || null;
    res.push({ tag: el.tagName.toLowerCase(), label: lab, required: el.hasAttribute('required')||el.required===true, readonly: el.readonly===true||el.hasAttribute('readonly'), value: (el.value||'').toString().slice(0,40) });
  }
  return res;
});
const buttons = () => page.evaluate(() => [...document.querySelectorAll('vaadin-button, vaadin-menu-bar-button')]
  .filter(b => b.getBoundingClientRect().width > 0)
  .map(b => ({ t:(b.innerText||b.getAttribute('aria-label')||b.title||'').trim(), disabled: b.disabled===true||b.hasAttribute('disabled') }))
  .filter(b => b.t));

// ============ LIST VIEW (R6 grid, R1 doc col, R7 statuses, P1-12 filter) ============
await page.goto(BASE + 'gov-decisions', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
log('\n===== LIST VIEW =====', page.url());
log('TOOLBAR:', JSON.stringify(await buttons()));
const cols = await page.evaluate(() => [...document.querySelectorAll('vaadin-grid-column, vaadin-grid-sort-column')].map(c => c.header || c.path).filter(Boolean));
log('COLUMNS:', JSON.stringify(cols));
const gridSize = await page.evaluate(() => { const g = document.querySelector('vaadin-grid'); return g && g._dataProviderController ? g._effectiveSize : (g ? g.size : null); });
log('GRID effectiveSize:', gridSize);
const rowcells = await page.evaluate(() => [...document.querySelectorAll('vaadin-grid-cell-content')].map(c => c.textContent.trim()).filter(Boolean));
log('STATUSES seen in rows:', JSON.stringify([...new Set(rowcells.filter(r => /рассмотр|Одобр|Закры|Действ|Отклон|Чернов|доработ/i.test(r)))]));
log('ROWCELLS sample:', JSON.stringify(rowcells.slice(0, 60)));
await page.screenshot({ path: SHOT + '/01-list.png', fullPage: true });

// status filter options (R7)
try {
  const fbtn = page.locator('vaadin-button', { hasText: /Фильтр|Добавить условие|условие/i }).first();
  if (await fbtn.count()) { await fbtn.click(); await page.waitForTimeout(1000);
    const fopts = await page.evaluate(() => { const ov = document.querySelector('vaadin-combo-box-overlay, vaadin-select-overlay, vaadin-context-menu-overlay, vaadin-menu-bar-overlay'); return ov ? [...ov.querySelectorAll('vaadin-item, vaadin-select-item, [role=menuitem]')].map(x=>x.textContent.trim()).filter(Boolean):null; });
    log('FILTER FIELDS:', JSON.stringify(fopts)); await page.keyboard.press('Escape');
  }
} catch (e) { log('filter err', String(e).slice(0,80)); }

// ============ CREATE FORM (R3 code, R5 date, R1 upload) ============
await page.goto(BASE + 'gov-decisions/new', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
log('\n===== CREATE FORM =====', page.url());
const tabs = await page.$$eval('vaadin-tab', els => els.map(e => e.innerText.trim()));
log('TABS:', JSON.stringify(tabs));
log('FIELDS:', JSON.stringify(await dumpFields(), null, 0));
log('UPLOAD present (R1):', await page.evaluate(() => !!document.querySelector('vaadin-upload')));
log('BUTTONS:', JSON.stringify(await buttons()));
// R5: probe date picker future allowance
try {
  const dp = page.locator('vaadin-date-picker').first();
  if (await dp.count()) {
    const min = await dp.evaluate(el => el.max || el.getAttribute('max') || null);
    log('DATE max attr (R5 cap):', min);
  }
} catch (e) {}
await page.screenshot({ path: SHOT + '/02-create.png', fullPage: true });

// Вид решения lookup (R3 type codes)
try {
  const pk = page.locator('jmix-value-picker').first();
  if (await pk.count()) { await pk.locator('vaadin-button').first().click({ timeout: 4000 }).catch(()=>{}); await page.waitForTimeout(1200);
    const dlg = await page.evaluate(() => { const ov = document.querySelector('vaadin-dialog-overlay, vaadin-combo-box-overlay'); return ov ? { cols:[...ov.querySelectorAll('vaadin-grid-column,vaadin-grid-sort-column')].map(c=>c.header||c.path).filter(Boolean), cells:[...ov.querySelectorAll('vaadin-grid-cell-content')].map(c=>c.textContent.trim()).filter(Boolean).slice(0,40)}:null; });
    log('ВИД РЕШЕНИЯ lookup:', JSON.stringify(dlg)); await page.keyboard.press('Escape');
  }
} catch (e) { log('lookup err', String(e).slice(0,80)); }

// ============ DETAIL / VIEW first record (R6 tabs, R2/R4 actions) ============
await page.goto(BASE + 'gov-decisions', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);
try {
  await page.locator('vaadin-grid-cell-content').nth(0).click(); await page.waitForTimeout(700);
  log('\n===== AFTER ROW SELECT =====');
  log('ROW-ACTION BUTTONS:', JSON.stringify(await buttons()));
  // try open detail via Просмотр or Изменить or double-click
  const viewBtn = page.locator('vaadin-button', { hasText: /Просмотр|Изменить|Открыть/i }).first();
  if (await viewBtn.count()) { await viewBtn.click(); await page.waitForTimeout(2000); }
  else { await page.locator('vaadin-grid-cell-content').nth(0).dblclick(); await page.waitForTimeout(2000); }
  log('\n===== DETAIL VIEW =====', page.url());
  log('DETAIL TABS:', JSON.stringify(await page.$$eval('vaadin-tab', els => els.map(e=>e.innerText.trim()))));
  log('DETAIL FIELDS:', JSON.stringify(await dumpFields()));
  log('DETAIL BUTTONS:', JSON.stringify(await buttons()));
  log('UPLOAD in detail (R1):', await page.evaluate(() => !!document.querySelector('vaadin-upload')));
  await page.screenshot({ path: SHOT + '/03-detail.png', fullPage: true });
} catch (e) { log('detail err', String(e).slice(0,150)); }

await ctx.close();
log('\nDONE. shots in', SHOT);
