import { chromium } from 'playwright-core';

const BASE = 'https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile', { channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1700, height: 1100 } });
const page = ctx.pages()[0] || await ctx.newPage();
const log = (...a) => console.log(...a);
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', 'admin'); await page.fill('input[name=password]', 'admin');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }).catch(()=>{}), page.keyboard.press('Enter')]); await page.waitForTimeout(2500);
}

// CREATE FORM — read .label property + date picker min/max
await page.goto(BASE + 'gov-decisions/new', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
const fields = await page.evaluate(() => {
  const TAGS = ['vaadin-text-field','vaadin-text-area','vaadin-date-picker','jmix-value-picker','vaadin-combo-box','vaadin-select','vaadin-upload','vaadin-checkbox'];
  return [...document.querySelectorAll(TAGS.join(','))].filter(e=>e.getBoundingClientRect().width>0).map(el => ({
    tag: el.tagName.toLowerCase(), label: el.label ?? null, required: el.required===true||el.hasAttribute('required'),
    readonly: el.readonly===true, value: (el.value||'').toString().slice(0,40),
    min: el.min ?? null, max: el.max ?? null
  }));
});
log('CREATE FIELDS:', JSON.stringify(fields, null, 1));

// open Вид решения lookup
try {
  const pk = page.locator('jmix-value-picker').first();
  await pk.locator('vaadin-button').last().click({ timeout: 4000 }).catch(()=>{});
  await page.waitForTimeout(1500);
  const dlg = await page.evaluate(() => {
    const ov = [...document.querySelectorAll('vaadin-dialog-overlay, vaadin-combo-box-overlay')].pop();
    if (!ov) return null;
    return { cols: [...ov.querySelectorAll('vaadin-grid-column,vaadin-grid-sort-column')].map(c=>c.header||c.path).filter(Boolean),
             cells: [...ov.querySelectorAll('vaadin-grid-cell-content')].map(c=>c.textContent.trim()).filter(Boolean).slice(0,40) };
  });
  log('ВИД lookup:', JSON.stringify(dlg));
  await page.keyboard.press('Escape');
} catch(e){ log('lookup err', String(e).slice(0,80)); }

// DETAIL VIEW: select first row then Просмотр
await page.goto(BASE + 'gov-decisions', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);
await page.locator('vaadin-grid').first().locator('vaadin-grid-cell-content').nth(8).click({ timeout: 5000 }).catch(e=>log('rowclick', String(e).slice(0,50)));
await page.waitForTimeout(600);
await page.locator('vaadin-button').filter({ hasText: 'Просмотр' }).first().click({ timeout: 8000 }).catch(e=>log('viewbtn', String(e).slice(0,50)));
await page.waitForTimeout(2500);
log('DETAIL URL:', page.url());
const dfields = await page.evaluate(() => {
  const TAGS = ['vaadin-text-field','vaadin-text-area','vaadin-date-picker','jmix-value-picker','vaadin-combo-box','vaadin-select','vaadin-tab','vaadin-upload'];
  return [...document.querySelectorAll(TAGS.join(','))].filter(e=>e.getBoundingClientRect().width>0).map(el => ({
    tag: el.tagName.toLowerCase(), label: el.label ?? (el.tagName==='VAADIN-TAB'?el.innerText.trim():null), readonly: el.readonly===true, value:(el.value||'').toString().slice(0,40) }));
});
log('DETAIL FIELDS:', JSON.stringify(dfields, null, 1));
log('DETAIL BUTTONS:', JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('vaadin-button')].filter(b=>b.getBoundingClientRect().width>0).map(b=>b.innerText.trim()).filter(Boolean))));
await page.screenshot({ path: '.auth/gov-detail.png', fullPage: true });
await ctx.close();
