// Capture live CLICK behaviours on loan-credit detail: what dialog/popup each
// picker (•••), Add button, combo/select and date-picker opens. Read-only-ish.
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'fs';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';
const REC = process.env.REC || '18';
const OUT = '.auth/loan-credit/clicks';
mkdirSync(OUT, { recursive: true });

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
  await Promise.all([page.waitForNavigation({ waitUntil:'networkidle', timeout:60000 }).catch(()=>{}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(2500);
}
await page.goto(BASE + `loan-credits/${REC}`, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

const out = { combos: {}, selects: {}, pickerDialogs: [], addDialogs: [] };

// dump the top-most overlay (vaadin-dialog / entity lookup)
async function dumpOverlay() {
  return await page.evaluate(() => {
    const clean = s => (s || '').replace(/\s+/g, ' ').trim();
    const ov = [...document.querySelectorAll('vaadin-dialog-overlay,vaadin-confirm-dialog-overlay')].pop();
    if (!ov) return null;
    const title = clean(ov.getAttribute('header-title') || ov.querySelector('[slot=title],h2,.v-dialog-header')?.textContent);
    const cols = [...ov.querySelectorAll('vaadin-grid-column')].map(c => clean(c.getAttribute('header') || c.getAttribute('path')));
    const cells = [...ov.querySelectorAll('vaadin-grid-cell-content')].map(c => clean(c.textContent)).filter(Boolean).slice(0, 40);
    const fields = [...ov.querySelectorAll('vaadin-text-field,vaadin-combo-box,vaadin-date-picker,vaadin-number-field,vaadin-big-decimal-field,vaadin-select,vaadin-text-area')]
      .map(f => ({ tag:f.tagName.toLowerCase(), label:clean(f.getAttribute('label')) }));
    const btns = [...ov.querySelectorAll('vaadin-button')].map(b => clean(b.textContent)).filter(Boolean);
    return { title, cols, cells, fields, btns };
  });
}
async function closeOverlay() {
  await page.keyboard.press('Escape').catch(()=>{});
  await page.waitForTimeout(600);
  // click any «Отмена»/Close if still open
  const cancel = await page.$('vaadin-dialog-overlay vaadin-button');
  await page.waitForTimeout(300);
}
const tabByName = async (name) => {
  const tabs = await page.$$('vaadin-tab');
  for (const t of tabs) { if ((await t.textContent()).trim() === name) { await t.click({force:true}); await page.waitForTimeout(1000); return true; } }
  return false;
};

// ---- 1) combo/select option lists ----
async function dumpSelectOptions(label) {
  const opts = await page.evaluate((lbl) => {
    const clean = s => (s||'').replace(/\s+/g,' ').trim();
    const el = [...document.querySelectorAll('vaadin-select,vaadin-combo-box')].find(e => clean(e.getAttribute('label'))===lbl);
    if (!el) return null;
    if (el.tagName.toLowerCase()==='vaadin-select') {
      const items = el.items || [];
      const fromItems = items.map(i=>clean(i.label||i.value));
      const fromDom = [...el.querySelectorAll('vaadin-item,vaadin-list-box vaadin-item')].map(i=>clean(i.textContent));
      return fromItems.length?fromItems:fromDom;
    }
    // combo-box: try filteredItems/items
    const its = el.filteredItems || el.items || [];
    return its.map(i => typeof i==='string'?i:clean(i.label||i.value||JSON.stringify(i)));
  }, label);
  return opts;
}

await tabByName('Общая информация');
out.combos['Статус кредита'] = await dumpSelectOptions('Статус кредита');
await tabByName('Условия кредита');
for (const l of ['Метод погашения кредита','Вид штрафа за просрочку по осн.с.','Вид штрафа за просрочку по процентам']) {
  out.selects[l] = await dumpSelectOptions(l);
}
log('COMBOS/SELECTS:', JSON.stringify({...out.combos, ...out.selects}, null, 1));

// ---- 2) picker ••• dialogs on tab0 ----
await tabByName('Общая информация');
// find lookup fields: they render as custom components; the ••• is a vaadin-button with dots
const dotBtns = await page.$$('vaadin-button');
let opened = 0;
for (let i = 0; i < dotBtns.length && opened < 12; i++) {
  const txt = (await dotBtns[i].textContent()).trim();
  const title = await dotBtns[i].getAttribute('title');
  // ••• picker buttons: empty text + no OK/Отмена; identify by aria/title or the dots glyph
  if (!/^(\.\.\.|•••|…)$/.test(txt) && !/выбрать|lookup|search/i.test(title||'')) continue;
  try {
    await dotBtns[i].scrollIntoViewIfNeeded();
    await dotBtns[i].click({ timeout: 4000 });
    await page.waitForTimeout(1500);
    const d = await dumpOverlay();
    if (d && (d.cols.length || d.title)) {
      out.pickerDialogs.push({ idx:i, ...d });
      await page.screenshot({ path: `${OUT}/picker-${opened}.png` });
      log(`PICKER#${opened}:`, d.title, '| cols:', d.cols.join(', '));
      opened++;
    }
    await closeOverlay();
  } catch(e){ await closeOverlay(); }
}

// ---- 3) Add dialogs on Транши / Платеж ----
for (const tab of ['Транши','Платеж']) {
  await tabByName(tab);
  const btns = await page.$$('vaadin-button');
  for (const b of btns) {
    if ((await b.textContent()).trim() === 'Добавить') {
      try {
        await b.click({ timeout:4000 }); await page.waitForTimeout(1500);
        const d = await dumpOverlay();
        if (d) { out.addDialogs.push({ tab, ...d }); await page.screenshot({ path:`${OUT}/add-${tab}.png` });
          log(`ADD[${tab}]:`, d.title, '| fields:', d.fields.map(f=>f.label).join(', ')); }
        await closeOverlay();
      } catch(e){ await closeOverlay(); }
      break;
    }
  }
}

writeFileSync(`${OUT}/clicks.json`, JSON.stringify(out, null, 2));
log('\nSaved', `${OUT}/clicks.json`);
await ctx.close();
