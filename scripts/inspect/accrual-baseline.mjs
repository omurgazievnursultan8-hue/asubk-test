// Baseline dump of the accrual engine on a loan-credit card.
//   REC=18 node scripts/inspect/accrual-baseline.mjs
// Dumps: tab list, «Условия кредита», «График погашений», «Детальный расчет»,
// «Резерв», plus /loan-ledgers filtered by nothing (full list) for reference.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'fs';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';
const REC = process.env.REC || '18';
const OUT = '.auth/accrual';
mkdirSync(OUT, { recursive: true });

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1800, height: 1100 },
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 300)));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 300)); });
page.on('response', r => { if (r.status() >= 400) errs.push(`http ${r.status()} ${r.url().slice(0, 120)}`); });

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', USER);
  await page.fill('input[name=password]', PASS);
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(2500);
}
console.log('login ok ->', page.url());

await page.goto(BASE + `loan-credits/${REC}`, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3500);
console.log('URL:', page.url());

// crash detection
const crash = await page.evaluate(() => {
  const t = document.body.innerText;
  return /Непредвиденная ошибка|Unexpected error/.test(t) ? t.slice(0, 400) : null;
});
if (crash) { console.log('CRASH:', crash); await ctx.close(); process.exit(1); }

const tabs = await page.$$eval('vaadin-tab', ts => ts.map(t => t.textContent.replace(/\s+/g, ' ').trim()));
console.log('TABS:', JSON.stringify(tabs, null, 1));

// generic dump of the currently visible tab content
async function dumpVisible(label) {
  const data = await page.evaluate(() => {
    const clean = s => (s || '').replace(/\s+/g, ' ').trim();
    const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const fields = [...document.querySelectorAll('vaadin-text-field,vaadin-combo-box,vaadin-date-picker,vaadin-number-field,vaadin-big-decimal-field,vaadin-integer-field,vaadin-select,vaadin-checkbox,vaadin-text-area')]
      .filter(vis)
      .map(f => ({
        tag: f.tagName.toLowerCase(),
        label: clean(f.getAttribute('label')) || clean(f.querySelector('label')?.textContent),
        value: f.tagName.toLowerCase() === 'vaadin-checkbox' ? String(f.checked) : (f.value ?? clean(f.querySelector('input')?.value)),
      }));
    const grids = [...document.querySelectorAll('vaadin-grid')].filter(vis).map(g => {
      const cols = [...g.querySelectorAll('vaadin-grid-column,vaadin-grid-sort-column')].map(c => clean(c.getAttribute('header') || c.getAttribute('path')));
      const cells = [...g.querySelectorAll('vaadin-grid-cell-content')].map(c => clean(c.textContent));
      return { cols, cells };
    });
    const btns = [...document.querySelectorAll('vaadin-button')].filter(vis).map(b => clean(b.textContent)).filter(Boolean);
    return { fields, grids, btns };
  });
  console.log(`\n===== TAB: ${label} =====`);
  console.log('BUTTONS:', JSON.stringify(data.btns));
  console.log('FIELDS:');
  data.fields.forEach(f => console.log(`   [${f.tag}] ${f.label || '(no label)'} = ${f.value}`));
  data.grids.forEach((g, i) => {
    console.log(`GRID#${i} cols(${g.cols.length}):`, JSON.stringify(g.cols));
    console.log(`GRID#${i} cells(${g.cells.length}):`);
    // reconstruct rows: header cells appear first in DOM order usually; print raw chunks
    const n = g.cols.length || 1;
    for (let r = 0; r < g.cells.length; r += n) {
      console.log('   |', g.cells.slice(r, r + n).join(' | '));
    }
  });
  return data;
}

const tabByName = async (re) => {
  const ts = await page.$$('vaadin-tab');
  for (const t of ts) {
    const txt = (await t.textContent()).replace(/\s+/g, ' ').trim();
    if (re.test(txt)) { await t.click({ force: true }); await page.waitForTimeout(1800); return txt; }
  }
  return null;
};

const want = [/Услови/i, /График/i, /Детальн/i, /Резерв/i];
const all = {};
for (const re of want) {
  const name = await tabByName(re);
  if (!name) { console.log('\n!!! tab not found for', re); continue; }
  all[name] = await dumpVisible(name);
  await page.screenshot({ path: `${OUT}/rec${REC}-${name.replace(/[^\wа-яА-Я]+/g, '_')}.png`, fullPage: true });
}

console.log('\nERRORS:', errs.length ? errs.slice(0, 20) : 'нет');
writeFileSync(`${OUT}/baseline-${REC}.json`, JSON.stringify({ tabs, all, errs }, null, 1));
await ctx.close();
