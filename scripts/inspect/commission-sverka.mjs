// scripts/inspect/commission-sverka.mjs — full sverka of /loan-application-commissions
// list view (filter/statcards/toolbar/grid/pager) + "+ Создать" flow (does it have «Далее»?)
import { chromium } from 'playwright-core';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1700, height: 1100 },
});
const page = ctx.pages()[0] || await ctx.newPage();
const log = (...a) => console.log(...a);

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', USER);
  await page.fill('input[name=password]', PASS);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}),
    page.keyboard.press('Enter'),
  ]);
  await page.waitForTimeout(2500);
}
await page.goto(BASE + 'loan-application-commissions', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);

log('URL:', page.url());

// ---- filter fields (labels) ----
log('\n== FILTER LABELS ==');
log(JSON.stringify(await page.evaluate(() =>
  [...document.querySelectorAll('label, vaadin-text-field, vaadin-select, vaadin-combo-box, vaadin-date-picker')]
    .map(e => (e.getAttribute && e.getAttribute('label')) || (e.tagName==='LABEL'? e.innerText.trim():''))
    .filter(Boolean))));

// ---- stat cards text ----
log('\n== STAT CARDS (text near top) ==');
log(JSON.stringify(await page.evaluate(() => {
  const out=[];
  document.querySelectorAll('*').forEach(e=>{
    if(e.childElementCount) return;
    const r=e.getBoundingClientRect(); if(r.top<90||r.top>320||r.width<1) return;
    const t=(e.innerText||'').replace(/\s+/g,' ').trim();
    if(t) out.push({t,x:Math.round(r.left),y:Math.round(r.top)});
  });
  return out;
})));

// ---- toolbar buttons ----
log('\n== TOOLBAR BUTTONS ==');
log(JSON.stringify(await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-button')].filter(b=>b.getBoundingClientRect().width>0)
    .map(b=>b.innerText.trim()).filter(Boolean))));

// ---- grid header + rows ----
log('\n== GRID HEADERS ==');
log(JSON.stringify(await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-grid-cell-content')]
    .filter(c=>{const r=c.getBoundingClientRect();return r.top<260&&r.top>120&&r.width>0;})
    .map(c=>c.innerText.trim()).filter(Boolean))));

log('\n== GRID ALL CELLS (first ~40) ==');
log(JSON.stringify(await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-grid-cell-content')]
    .filter(c=>c.getBoundingClientRect().width>0)
    .map(c=>c.innerText.trim()).slice(0,40))));

// ---- pager ----
log('\n== PAGER / ROWCOUNT text ==');
log(JSON.stringify(await page.evaluate(() => {
  const out=[];
  document.querySelectorAll('*').forEach(e=>{
    if(e.childElementCount) return;
    const t=(e.innerText||'').replace(/\s+/g,' ').trim();
    if(/строк|строка|записей|\bиз\b|^\d+$/.test(t) && t.length<30){
      const r=e.getBoundingClientRect(); if(r.width>0&&r.top>320) out.push(t);
    }
  });
  return [...new Set(out)];
})));

await page.screenshot({ path: '.auth/commission-list-live.png', fullPage: false });
log('\nSHOT .auth/commission-list-live.png');

// ================= CREATE FLOW =================
log('\n\n############ CLICK "+ Создать" ############');
await page.evaluate(() => {
  const b=[...document.querySelectorAll('vaadin-button')].find(x=>/Создать|Создание|Добавить/i.test(x.innerText));
  b?.click();
});
await page.waitForTimeout(2500);
log('URL after Создать:', page.url());

log('\n== CREATE: dialog/overlay present? ==');
log(JSON.stringify(await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-dialog-overlay, vaadin-confirm-dialog-overlay')].map(d=>({
    open:true, text:(d.innerText||'').replace(/\s+/g,' ').slice(0,200)
  })))));

log('\n== CREATE: buttons visible ==');
log(JSON.stringify(await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-button')].filter(b=>b.getBoundingClientRect().width>0)
    .map(b=>b.innerText.trim()).filter(Boolean))));

log('\n== CREATE: field labels ==');
log(JSON.stringify(await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-text-field, vaadin-select, vaadin-combo-box, vaadin-date-picker, vaadin-text-area, vaadin-integer-field, vaadin-number-field')]
    .filter(e=>e.getBoundingClientRect().width>0)
    .map(e=>({tag:e.tagName.toLowerCase(), label:e.getAttribute('label')||''})))));

log('\n== CREATE: tabs (if wizard) ==');
log(JSON.stringify(await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-tab')].filter(t=>t.getBoundingClientRect().width>0)
    .map(t=>t.innerText.trim()))));

await page.screenshot({ path: '.auth/commission-create-live.png', fullPage: false });
log('\nSHOT .auth/commission-create-live.png');

await ctx.close();
