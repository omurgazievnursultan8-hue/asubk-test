import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';

const BASE = 'https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile', { channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1700, height: 1100 } });
const page = ctx.pages()[0] || await ctx.newPage();
const log = (...a) => console.log(...a);

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', 'admin'); await page.fill('input[name=password]', 'admin');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }).catch(()=>{}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(2500);
}

// ---------- LIST VIEW ----------
await page.goto(BASE + 'gov-decisions', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
log('URL:', page.url());

const toolbar = await page.evaluate(() => [...document.querySelectorAll('vaadin-button, vaadin-menu-bar-button')]
  .filter(b => b.getBoundingClientRect().width > 0)
  .map(b => (b.innerText || b.getAttribute('aria-label') || b.title || '').trim())
  .filter(Boolean));
log('TOOLBAR:', JSON.stringify(toolbar));

const cols = await page.evaluate(() => [...document.querySelectorAll('vaadin-grid-column, vaadin-grid-sort-column')]
  .map(c => c.header || c.path).filter(Boolean));
log('COLUMNS:', JSON.stringify(cols));

const rows = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('vaadin-grid-cell-content')].map(c => c.textContent.trim());
  return cells.filter(Boolean).slice(0, 120);
});
log('ROWCELLS(sample):', JSON.stringify(rows));

// distinct statuses present
log('STATUSES seen:', JSON.stringify([...new Set(rows.filter(r => /рассмотр|Одобр|Закры|Действ|Отклон|Чернов|доработ/i.test(r)))]));

await page.screenshot({ path: '.auth/gov-list.png', fullPage: true });

// ---------- FILTER BUILDER ----------
try {
  const fbtn = page.locator('vaadin-button', { hasText: /Фильтр|условие/i }).first();
  if (await fbtn.count()) {
    await fbtn.click(); await page.waitForTimeout(1200);
    const fopts = await page.evaluate(() => {
      const ov = document.querySelector('vaadin-combo-box-overlay, vaadin-select-overlay, vaadin-context-menu-overlay, vaadin-menu-bar-overlay');
      if (!ov) return null;
      return [...ov.querySelectorAll('vaadin-item, vaadin-select-item, [role=menuitem]')].map(x => x.textContent.trim()).filter(Boolean);
    });
    log('FILTER FIELDS:', JSON.stringify(fopts));
    await page.keyboard.press('Escape');
  }
} catch (e) { log('filter err', String(e).slice(0,80)); }

// ---------- CREATE FORM ----------
await page.goto(BASE + 'gov-decisions/new', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
log('\n--- CREATE FORM ---');
const tabs = await page.$$eval('vaadin-tab', els => els.map(e => e.innerText.trim()));
log('TABS:', JSON.stringify(tabs));

const dumpFields = () => page.evaluate(() => {
  const TAGS = ['vaadin-text-field','vaadin-text-area','vaadin-number-field','vaadin-integer-field','vaadin-big-decimal-field','vaadin-date-picker','vaadin-date-time-picker','vaadin-combo-box','vaadin-select','vaadin-checkbox','vaadin-multi-select-combo-box','jmix-value-picker','vaadin-upload'];
  const res = [];
  for (const el of document.querySelectorAll(TAGS.join(','))) {
    const r = el.getBoundingClientRect(); if (!(r.width>0&&r.height>0)) continue;
    let lab = el.querySelector(':scope > label[slot="label"]')?.textContent?.trim()
           || el.shadowRoot?.querySelector('[part="label"]')?.textContent?.trim()
           || el.getAttribute('aria-label') || null;
    res.push({ tag: el.tagName.toLowerCase(), label: lab, required: el.hasAttribute('required')||el.required===true, readonly: el.readonly===true||el.hasAttribute('readonly'), value: (el.value||'').toString().slice(0,30) });
  }
  return res;
});
const tabEls = await page.$$('vaadin-tab');
if (tabEls.length) {
  for (let t = 0; t < tabEls.length; t++) { await tabEls[t].click(); await page.waitForTimeout(500); log(`FIELDS[tab=${tabs[t]}]:`, JSON.stringify(await dumpFields())); }
} else {
  log('FIELDS:', JSON.stringify(await dumpFields()));
}

// Вид решения lookup overlay
try {
  const pk = page.locator('jmix-value-picker').first();
  if (await pk.count()) {
    await pk.locator('vaadin-button').first().click({ timeout: 4000 }).catch(()=>{});
    await page.waitForTimeout(1200);
    const dlg = await page.evaluate(() => {
      const ov = document.querySelector('vaadin-dialog-overlay, vaadin-combo-box-overlay');
      if (!ov) return null;
      return { cols: [...ov.querySelectorAll('vaadin-grid-column,vaadin-grid-sort-column')].map(c=>c.header||c.path).filter(Boolean), cells: [...ov.querySelectorAll('vaadin-grid-cell-content')].map(c=>c.textContent.trim()).filter(Boolean).slice(0,30) };
    });
    log('ВИД РЕШЕНИЯ lookup:', JSON.stringify(dlg));
    await page.keyboard.press('Escape');
  }
} catch (e) { log('lookup err', String(e).slice(0,80)); }
await page.screenshot({ path: '.auth/gov-new.png', fullPage: true });

// ---------- DETAIL / VIEW of first record ----------
await page.goto(BASE + 'gov-decisions', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);
try {
  await page.locator('vaadin-grid-cell-content').nth(0).click();
  await page.waitForTimeout(600);
  const viewBtn = page.locator('vaadin-button', { hasText: /Просмотр/i }).first();
  if (await viewBtn.count()) { await viewBtn.click(); await page.waitForTimeout(2000); }
  log('\n--- DETAIL VIEW ---');
  log('URL:', page.url());
  log('DETAIL FIELDS:', JSON.stringify(await dumpFields()));
  const detailBtns = await page.evaluate(() => [...document.querySelectorAll('vaadin-button')].filter(b=>b.getBoundingClientRect().width>0).map(b=>b.innerText.trim()).filter(Boolean));
  log('DETAIL BUTTONS:', JSON.stringify(detailBtns));
  await page.screenshot({ path: '.auth/gov-detail.png', fullPage: true });
} catch (e) { log('detail err', String(e).slice(0,120)); }

await ctx.close();
