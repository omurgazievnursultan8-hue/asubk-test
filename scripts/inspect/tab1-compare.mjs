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
await page.goto(BASE + 'loan-programs', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);

// click «Создать»
const clicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll('vaadin-button')].find(b => /Создать/i.test(b.innerText));
  if (b) { b.click(); return true; } return false;
});
log('Создать clicked:', clicked);
await page.waitForTimeout(2500);

// tab strip labels
const tabs = await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-tab')].filter(t=>t.getBoundingClientRect().width>0).map(t=>t.innerText.trim()));
log('TABS:', JSON.stringify(tabs));

// section headers (group titles) in current tab panel
const sections = await page.evaluate(() => {
  const out=[];
  document.querySelectorAll('h1,h2,h3,h4,span,div,label').forEach(e=>{
    const r=e.getBoundingClientRect(); if(r.width<1||r.height<1) return;
    const t=(e.childElementCount===0?e.innerText:'' ).trim();
    if(t && t.length<60 && /информаци|параметр|дополнит/i.test(t)) out.push({t, y:Math.round(r.top), fw:getComputedStyle(e).fontWeight, fs:getComputedStyle(e).fontSize});
  });
  return out;
});
log('SECTION HEADERS:', JSON.stringify(sections, null, 1));

function dumpFields() {
  return page.evaluate(() => {
    const TAGS = ['vaadin-text-field','vaadin-text-area','vaadin-big-decimal-field','vaadin-number-field','vaadin-integer-field','jmix-value-picker','jmix-multi-value-picker','vaadin-combo-box','vaadin-select','vaadin-checkbox','vaadin-date-picker','vaadin-multi-select-combo-box'];
    return [...document.querySelectorAll(TAGS.join(','))].filter(e=>e.getBoundingClientRect().width>0).map(el => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const inp = el.shadowRoot?.querySelector('input,textarea');
      const ics = inp ? getComputedStyle(inp) : null;
      return {
        tag: el.tagName.toLowerCase(),
        label: (el.label ?? el.getAttribute('label') ?? (el.querySelector('label')?.innerText) ?? '').trim() || null,
        required: el.required===true||el.hasAttribute('required'),
        readonly: el.readonly===true||el.hasAttribute('readonly'),
        disabled: el.disabled===true||el.hasAttribute('disabled'),
        x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
        bg: ics?.backgroundColor || cs.backgroundColor,
        value: (el.value||'').toString().slice(0,40)
      };
    });
  });
}
const fields = await dumpFields();
log('FIELD COUNT:', fields.length);
log('FIELDS:', JSON.stringify(fields, null, 1));

// footer buttons
const btns = await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-button')].filter(b=>b.getBoundingClientRect().width>0).map(b=>b.innerText.trim()).filter(Boolean));
log('BUTTONS:', JSON.stringify(btns));

await page.screenshot({ path: '.auth/live-tab1.png', fullPage: true });
await ctx.close();
