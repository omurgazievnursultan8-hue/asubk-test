// Drive the accrual engine on a loan-credit card: click one button on the
// «Детальный расчет» tab, then diff the detail grid + /loan-ledgers.
//   REC=18 BTNS="Рассчитать|Расчет на весь график" node scripts/inspect/accrual-clicks.mjs
// Env: REC (record id), BTNS (pipe-separated button captions, in order),
//      DATE (optional, set «Дата расчета» as dd.MM.yyyy before clicking),
//      FILTER (substring to keep only this credit's ledger rows).
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'fs';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';
const REC = process.env.REC || '18';
const BTNS = (process.env.BTNS || '').split('|').filter(Boolean);
const DATE = process.env.DATE || '';
const FILTER = process.env.FILTER || '';
const TAG = process.env.TAG || 'run';
const OUT = '.auth/accrual';
mkdirSync(OUT, { recursive: true });

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1900, height: 1100 },
});
const page = ctx.pages()[0] || await ctx.newPage();
let errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 250)));
page.on('console', m => { if (m.type() === 'error' && !/WebSocket/.test(m.text())) errs.push('console: ' + m.text().slice(0, 250)); });
page.on('response', r => { if (r.status() >= 400) errs.push(`http ${r.status()} ${r.url().slice(0, 100)}`); });

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', USER);
  await page.fill('input[name=password]', PASS);
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(2500);
}

const gridRows = () => page.evaluate(() => {
  const clean = s => (s || '').replace(/\s+/g, ' ').trim();
  const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const g = [...document.querySelectorAll('vaadin-grid')].filter(vis)[0];
  if (!g) return null;
  const n = [...g.querySelectorAll('vaadin-grid-column,vaadin-grid-sort-column')].length || 1;
  const cells = [...g.querySelectorAll('vaadin-grid-cell-content')].map(c => clean(c.textContent));
  const rows = [];
  for (let r = 0; r < cells.length; r += n) rows.push(cells.slice(r, r + n));
  return rows;
});

const notifications = () => page.evaluate(() => [...document.querySelectorAll('vaadin-notification-card')]
  .map(c => c.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean));

async function openDetailTab() {
  await page.goto(BASE + `loan-credits/${REC}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3500);
  const ts = await page.$$('vaadin-tab');
  for (const t of ts) {
    if (/Детальн/.test((await t.textContent()) || '')) { await t.click({ force: true }); await page.waitForTimeout(2500); return true; }
  }
  return false;
}

async function dumpLedger(label) {
  await page.goto(BASE + 'loan-ledgers', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);
  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => { const g = document.querySelector('vaadin-grid'); const t = g && g.shadowRoot?.querySelector('#table'); if (t) t.scrollTop = t.scrollHeight; });
    await page.waitForTimeout(300);
  }
  const rows = await page.evaluate(() => {
    const clean = s => (s || '').replace(/\s+/g, ' ').trim();
    const g = document.querySelector('vaadin-grid');
    const n = [...g.querySelectorAll('vaadin-grid-column,vaadin-grid-sort-column')].length || 1;
    const cells = [...g.querySelectorAll('vaadin-grid-cell-content')].map(c => clean(c.textContent));
    const out = [];
    for (let r = 0; r < cells.length; r += n) out.push(cells.slice(r, r + n));
    return out;
  });
  const f = FILTER ? rows.filter(r => r.join('|').includes(FILTER)) : rows;
  console.log(`--- LEDGER [${label}] total=${rows.length} matched=${f.length}`);
  f.forEach(r => console.log('    L|', r.join(' | ')));
  return f;
}

const printRows = (label, rows) => {
  console.log(`--- DETAIL GRID [${label}] rows=${rows ? rows.length : 'null'}`);
  (rows || []).forEach(r => console.log('    D|', r.join(' | ')));
};


async function setCalcDate(d) {
  const dps = await page.$$('vaadin-date-picker');
  for (const dp of dps) {
    const ok = await dp.evaluate(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 &&
        (el.id === 'manualProcessingDateField' || /Дата расчета/.test((el.getAttribute('label') || '') + ' ' + (el.querySelector('label')?.textContent || '')));
    });
    if (!ok) continue;
    const inp = await dp.$('input');
    await inp.click({ clickCount: 3 });
    await inp.fill(d);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1800);
    const cur = await inp.inputValue();
    console.log('Дата расчета set ->', cur);
    return true;
  }
  console.log('!!! Дата расчета field not found');
  return false;
}

// ---- step 0: baseline
await openDetailTab();
if (DATE) await setCalcDate(DATE);
let rows = await gridRows();
printRows('t0', rows);
let led = await dumpLedger('t0');
const results = { t0: { rows, led } };

const SAME = process.env.SAME === '1';   // do not reopen the card between clicks
if (SAME) {
  await openDetailTab();
  if (DATE) await setCalcDate(DATE);
}
let first = true;
for (const cap of BTNS) {
  if (!SAME) await openDetailTab();
  first = false;
  if (DATE && !SAME) await setCalcDate(DATE);
  errs = [];
  const btns = await page.$$('vaadin-button');
  let hit = null;
  for (const b of btns) {
    const t = (await b.textContent() || '').replace(/\s+/g, ' ').trim();
    if (t === cap) { hit = b; break; }
  }
  if (!hit) { console.log(`\n!!! BUTTON NOT FOUND: ${cap}`); continue; }
  console.log(`\n######## CLICK «${cap}» ########`);
  await hit.click({ force: true });
  await page.waitForTimeout(6000);
  const notes = await notifications();
  const crash = await page.evaluate(() => { const t = document.body.innerText; const m = t.match(/Непредвиденная ошибка[\s\S]{0,200}/); return m ? m[0] : null; });
  console.log('NOTIFICATIONS:', JSON.stringify(notes));
  if (crash) console.log('CRASH TEXT:', crash);
  console.log('ERRORS:', errs.length ? errs.slice(0, 8) : 'нет');
  rows = await gridRows();
  printRows('after ' + cap, rows);
  await page.screenshot({ path: `${OUT}/${TAG}-${cap.replace(/[^\wа-яА-Я]+/g, '_')}-${Object.keys(results).length}.png`, fullPage: true });
  if (!SAME) led = await dumpLedger('after ' + cap);
  results[cap + '#' + Object.keys(results).length] = { rows, led, notes, errs, crash };
}

if (SAME) await dumpLedger('final');
writeFileSync(`${OUT}/clicks-${TAG}.json`, JSON.stringify(results, null, 1));
await ctx.close();
