// Compare live gov-decisions list page vs mockups/decision/decisions.html.
// Captures: screenshots (both), computed styles/sizes of key components on live,
// toolbar, grid columns, row sample. Output -> .auth/decisions-*.{png,json}
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = 'https://fkftest.okmot.kg/';
const VIEW = { width: 1700, height: 1100 };
const ctx = await chromium.launchPersistentContext('.auth/profile', { channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: VIEW });
const page = ctx.pages()[0] || await ctx.newPage();
const log = (...a) => console.log(...a);

const styleOf = (sel, props) => page.evaluate(({ sel, props }) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  const o = { _box: { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) } };
  for (const p of props) o[p] = cs.getPropertyValue(p);
  return o;
}, { sel, props });

const PROPS = ['font-family','font-size','font-weight','line-height','color','background-color','border','border-radius','padding','box-shadow','letter-spacing','text-transform'];

// ================= LIVE =================
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', 'admin'); await page.fill('input[name=password]', 'admin');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }).catch(()=>{}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(2500);
}
await page.goto(BASE + 'gov-decisions', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);
log('LIVE URL:', page.url());

const live = {};
live.toolbar = await page.evaluate(() => {
  return [...document.querySelectorAll('vaadin-button, vaadin-menu-bar-button')]
    .filter(b => b.getBoundingClientRect().width > 0)
    .map(b => {
      const cs = getComputedStyle(b); const r = b.getBoundingClientRect();
      return { text: (b.innerText||b.getAttribute('aria-label')||b.title||'').trim(),
        w: Math.round(r.width), h: Math.round(r.height),
        bg: cs.backgroundColor, color: cs.color, fontSize: cs.fontSize, fontWeight: cs.fontWeight,
        radius: cs.borderRadius, theme: b.getAttribute('theme') };
    });
});
live.columns = await page.evaluate(() => [...document.querySelectorAll('vaadin-grid-column, vaadin-grid-sort-column')].map(c => c.header || c.path).filter(Boolean));
live.rows = await page.evaluate(() => [...document.querySelectorAll('vaadin-grid-cell-content')].map(c => c.textContent.trim()).filter(Boolean).slice(0, 80));
live.body = await styleOf('body', PROPS);
live.grid = await styleOf('vaadin-grid', PROPS);
live.headerRow = await page.evaluate(() => {
  const c = document.querySelector('vaadin-grid');
  if (!c) return null;
  const th = c.shadowRoot?.querySelector('thead tr, [part~="header-cell"]');
  if (!th) return null;
  const cs = getComputedStyle(th); const r = th.getBoundingClientRect();
  return { h: Math.round(r.height), bg: cs.backgroundColor, color: cs.color, fontSize: cs.fontSize, fontWeight: cs.fontWeight };
});
live.badges = await page.evaluate(() => {
  const out = [];
  for (const c of document.querySelectorAll('vaadin-grid-cell-content')) {
    const span = c.querySelector('span,div,vaadin-icon,[class]');
    if (span && /рассмотр|Одобр|Закры|Действ|Отклон|Чернов|доработ|актив/i.test(c.textContent)) {
      const cs = getComputedStyle(span);
      out.push({ text: c.textContent.trim().slice(0,40), bg: cs.backgroundColor, color: cs.color, radius: cs.borderRadius, padding: cs.padding, fontSize: cs.fontSize });
      if (out.length >= 8) break;
    }
  }
  return out;
});
live.sidebar = await styleOf('vaadin-app-layout [slot=drawer], [class*=sidebar], nav', PROPS);
live.title = await page.evaluate(() => {
  const h = document.querySelector('h1,h2,[class*=title],[class*=header]');
  return h ? h.textContent.trim().slice(0,60) : null;
});
live.filters = await page.evaluate(() => [...document.querySelectorAll('vaadin-text-field,vaadin-combo-box,vaadin-select,vaadin-date-picker')]
  .filter(e=>e.getBoundingClientRect().width>0)
  .map(e=>{ const r=e.getBoundingClientRect(); return { tag:e.tagName.toLowerCase(), label:e.label||e.getAttribute('aria-label')||null, w:Math.round(r.width), h:Math.round(r.height) }; }).slice(0,20));

writeFileSync('.auth/decisions-live.json', JSON.stringify(live, null, 2));
await page.screenshot({ path: '.auth/decisions-live.png', fullPage: true });
await page.screenshot({ path: '.auth/decisions-live-fold.png' });
log('LIVE captured. toolbar=%d cols=%d rows=%d', live.toolbar.length, live.columns.length, live.rows.length);

// ================= MOCKUP =================
const mockPath = 'file://' + resolve('mockups/decision/decisions.html');
await page.goto(mockPath, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(800);
await page.screenshot({ path: '.auth/decisions-mock.png', fullPage: true });
await page.screenshot({ path: '.auth/decisions-mock-fold.png' });
const mock = {};
mock.toolbarBtns = await page.evaluate(() => [...document.querySelectorAll('button,.btn,[class*=btn]')].filter(b=>b.getBoundingClientRect().width>0).map(b=>{const cs=getComputedStyle(b);const r=b.getBoundingClientRect();return{text:b.innerText.trim().slice(0,30),w:Math.round(r.width),h:Math.round(r.height),bg:cs.backgroundColor,color:cs.color,fontSize:cs.fontSize,radius:cs.borderRadius};}).slice(0,30));
mock.cols = await page.evaluate(() => [...document.querySelectorAll('thead th, table th, [role=columnheader]')].map(c=>c.textContent.trim()).filter(Boolean));
writeFileSync('.auth/decisions-mock.json', JSON.stringify(mock, null, 2));
log('MOCK captured. btns=%d cols=%d', mock.toolbarBtns.length, mock.cols.length);

// ============ CREATE FORM: LIVE ============
const dumpFields = () => page.evaluate(() => {
  const TAGS = ['vaadin-text-field','vaadin-text-area','vaadin-number-field','vaadin-integer-field','vaadin-big-decimal-field','vaadin-date-picker','vaadin-date-time-picker','vaadin-combo-box','vaadin-select','vaadin-checkbox','vaadin-multi-select-combo-box','jmix-value-picker','vaadin-upload'];
  const res = [];
  for (const el of document.querySelectorAll(TAGS.join(','))) {
    const r = el.getBoundingClientRect(); if (!(r.width>0&&r.height>0)) continue;
    const cs = getComputedStyle(el);
    let lab = el.querySelector(':scope > label[slot="label"]')?.textContent?.trim()
           || el.shadowRoot?.querySelector('[part="label"]')?.textContent?.trim()
           || el.getAttribute('aria-label') || null;
    res.push({ tag: el.tagName.toLowerCase(), label: lab, required: el.hasAttribute('required')||el.required===true, readonly: el.readonly===true||el.hasAttribute('readonly'), w: Math.round(r.width), h: Math.round(r.height), value: (el.value||'').toString().slice(0,30) });
  }
  return res;
});
await page.goto(BASE + 'gov-decisions/new', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);
const liveNew = { url: page.url() };
liveNew.tabs = await page.$$eval('vaadin-tab', els => els.map(e => e.innerText.trim()));
liveNew.title = await page.evaluate(() => { const h=document.querySelector('h1,h2,[class*=title]'); return h?h.textContent.trim().slice(0,60):null; });
const tabEls = await page.$$('vaadin-tab');
liveNew.fieldsByTab = {};
if (tabEls.length) {
  for (let t = 0; t < tabEls.length; t++) { await tabEls[t].click(); await page.waitForTimeout(500); liveNew.fieldsByTab[liveNew.tabs[t]||('tab'+t)] = await dumpFields(); }
} else { liveNew.fieldsByTab['(no tabs)'] = await dumpFields(); }
// footer/save buttons
liveNew.buttons = await page.evaluate(() => [...document.querySelectorAll('vaadin-button')].filter(b=>b.getBoundingClientRect().width>0).map(b=>{const cs=getComputedStyle(b);const r=b.getBoundingClientRect();return{text:b.innerText.trim(),w:Math.round(r.width),h:Math.round(r.height),bg:cs.backgroundColor,color:cs.color,theme:b.getAttribute('theme')};}).filter(b=>b.text));
writeFileSync('.auth/decisions-live-new.json', JSON.stringify(liveNew, null, 2));
await page.screenshot({ path: '.auth/decisions-live-new.png', fullPage: true });
await page.screenshot({ path: '.auth/decisions-live-new-fold.png' });
log('LIVE NEW captured. tabs=%j', liveNew.tabs);

// ============ CREATE FORM: MOCK ============
await page.goto(mockPath, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(400);
await page.evaluate(() => { const b=document.getElementById('btnCreate'); if (b) b.click(); });
await page.waitForTimeout(500);
await page.screenshot({ path: '.auth/decisions-mock-new.png', fullPage: true });
await page.screenshot({ path: '.auth/decisions-mock-new-fold.png' });
log('MOCK NEW captured.');

await ctx.close();
