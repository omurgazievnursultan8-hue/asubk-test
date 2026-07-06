// Phase 5 — full capture of loan-credit detail for the "точная копия" mockup.
// Dumps list (columns + rows) and every detail tab (labels, values, control types,
// grid columns/rows) for a working record. Read-only-ish (opens edit route, no save).
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'fs';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';
const PROFILE = '.auth/profile';
const REC = process.env.REC || '18';
const OUTDIR = '.auth/loan-credit';
mkdirSync(OUTDIR, { recursive: true });

const ctx = await chromium.launchPersistentContext(PROFILE, {
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

const out = { list: {}, detail: { record: REC, tabs: [] } };

// ---------- LIST ----------
await page.goto(BASE + 'loansCredit', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
out.list.columns = await page.$$eval('vaadin-grid-cell-content',
  els => els.map(e => e.textContent.trim()).filter(Boolean).slice(0, 14));
out.list.toolbar = await page.$$eval('vaadin-button, vaadin-menu-bar-button',
  els => els.map(e => e.textContent.trim()).filter(Boolean));
await page.screenshot({ path: `${OUTDIR}/list.png`, fullPage: false });

// ---------- DETAIL ----------
await page.goto(BASE + `loan-credits/${REC}`, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);
out.detail.header = await page.evaluate(() =>
  (document.querySelector('h1,h2,[class*=title],[class*=Title]')?.textContent || '').trim());
out.detail.crash = await page.evaluate(() =>
  /Непредвиденная ошибка|Unexpected error|Internal Server Error/.test(document.body.innerText));

// tab labels
const tabEls = await page.$$('vaadin-tab');
const tabNames = [];
for (const t of tabEls) tabNames.push((await t.textContent()).trim());
out.detail.tabNames = tabNames;
log('TABS:', tabNames);

// dump one tab: labels+values of fields, plus grid columns/rows if present
async function dumpActiveTab() {
  return await page.evaluate(() => {
    const clean = s => (s || '').replace(/\s+/g, ' ').trim();
    // form fields (vaadin text/combo/date/checkbox/textarea)
    const fields = [];
    const sels = 'vaadin-text-field,vaadin-number-field,vaadin-combo-box,vaadin-date-picker,vaadin-date-time-picker,vaadin-time-picker,vaadin-text-area,vaadin-checkbox,vaadin-select,vaadin-big-decimal-field';
    const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    document.querySelectorAll(sels).forEach(el => {
      if (!visible(el)) return;
      const tag = el.tagName.toLowerCase();
      const label = clean(el.getAttribute('label') || el.querySelector('label')?.textContent);
      let value = '';
      if (tag === 'vaadin-checkbox') value = el.hasAttribute('checked') ? 'checked' : '';
      else value = clean(el.value || el.querySelector('input')?.value);
      const ro = el.hasAttribute('readonly');
      const dis = el.hasAttribute('disabled');
      fields.push({ tag, label, value, ro, dis });
    });
    // grids
    const grids = [];
    document.querySelectorAll('vaadin-grid').forEach(g => {
      const cells = [...g.querySelectorAll('vaadin-grid-cell-content')]
        .map(c => clean(c.textContent)).filter(Boolean);
      grids.push(cells.slice(0, 40));
    });
    // buttons in the visible tab body
    const btns = [...document.querySelectorAll('vaadin-button')]
      .map(b => clean(b.textContent)).filter(Boolean);
    return { fields, grids, btns };
  });
}

for (let i = 0; i < tabEls.length; i++) {
  try { await tabEls[i].scrollIntoViewIfNeeded(); await tabEls[i].click({ timeout: 5000 }); }
  catch { try { await tabEls[i].click({ force: true, timeout: 5000 }); } catch {} }
  await page.waitForTimeout(1200);
  const name = tabNames[i];
  const data = await dumpActiveTab();
  out.detail.tabs.push({ i, name, ...data });
  await page.screenshot({ path: `${OUTDIR}/tab-${i}-${name.replace(/[^\wа-яА-Я]+/g, '_').slice(0,24)}.png` });
  log(`\n--- TAB ${i}: ${name} ---`);
  data.fields.forEach(f => log(`  [${f.tag}] "${f.label}" = "${f.value}"${f.ro?' RO':''}${f.dis?' DIS':''}`));
  if (data.grids.length) data.grids.forEach((g,gi)=>log(`  GRID${gi}:`, g.join(' | ')));
  log('  BTNS:', data.btns.join(' · '));
}

writeFileSync(`${OUTDIR}/dump.json`, JSON.stringify(out, null, 2));
log('\nSaved', `${OUTDIR}/dump.json`);
await ctx.close();
