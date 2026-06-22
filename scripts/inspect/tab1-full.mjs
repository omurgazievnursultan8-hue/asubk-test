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
await page.evaluate(() => { const b=[...document.querySelectorAll('vaadin-button')].find(b=>/Создать/i.test(b.innerText)); b&&b.click(); });
await page.waitForTimeout(2500);

// tabs
const tabs = await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-tab')].filter(t=>t.getBoundingClientRect().width>0).map(t=>t.innerText.trim()));
log('TABS:', JSON.stringify(tabs));

// section headers
const sections = await page.evaluate(() => {
  const out=[];
  document.querySelectorAll('*').forEach(e=>{
    if(e.childElementCount) return;
    const r=e.getBoundingClientRect(); if(r.width<1||r.height<1||r.top<150) return;
    const t=(e.innerText||'').trim();
    if(t && t.length<50 && /информаци|параметр|дополнит/i.test(t)) out.push({t, x:Math.round(r.left), y:Math.round(r.top), fw:getComputedStyle(e).fontWeight, fs:getComputedStyle(e).fontSize});
  });
  return out;
});
log('SECTIONS:', JSON.stringify(sections));

const fields = await page.evaluate(() => {
  const TAGS = ['vaadin-text-field','vaadin-text-area','vaadin-big-decimal-field','vaadin-number-field','vaadin-integer-field','jmix-value-picker','jmix-multi-value-picker','vaadin-combo-box','vaadin-select','vaadin-checkbox','vaadin-date-picker','vaadin-multi-select-combo-box'];
  const labelOf = (el) => {
    // 1) prop/attr
    let l = el.label || el.getAttribute('label');
    // 2) aria-labelledby chain
    if(!l){ const id=el.getAttribute('aria-labelledby'); if(id){ const t=id.split(' ').map(i=>document.getElementById(i)?.innerText||'').join(' ').trim(); if(t) l=t; } }
    // 3) wrapping vaadin-form-item label slot
    if(!l){ let p=el.closest('vaadin-form-item'); if(p){ const lab=p.querySelector('[slot=label]'); if(lab) l=lab.innerText; } }
    // 4) shadow part=label
    if(!l && el.shadowRoot){ const sr=el.shadowRoot.querySelector('[part=label]'); if(sr) l=sr.innerText; }
    // 5) preceding sibling label text
    if(!l){ const pv=el.previousElementSibling; if(pv && /label/i.test(pv.tagName)) l=pv.innerText; }
    return (l||'').replace(/\s+/g,' ').trim()||null;
  };
  return [...document.querySelectorAll(TAGS.join(','))].filter(e=>e.getBoundingClientRect().width>0).map(el => {
    const r = el.getBoundingClientRect();
    const fieldEl = el.shadowRoot?.querySelector('[part="input-field"]');
    const fcs = fieldEl ? getComputedStyle(fieldEl) : null;
    const reqInd = el.shadowRoot?.querySelector('[part=required-indicator]');
    return {
      tag: el.tagName.toLowerCase(),
      label: labelOf(el),
      required: el.required===true||el.hasAttribute('required'),
      readonly: el.readonly===true||el.hasAttribute('readonly'),
      x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
      bg: fcs?.backgroundColor||null, radius: fcs?.borderRadius||null,
    };
  }).sort((a,b)=> a.y-b.y || a.x-b.x);
});
log('FIELDCOUNT:', fields.length);
log('FIELDS:', JSON.stringify(fields));

const btns = await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-button')].filter(b=>b.getBoundingClientRect().width>0).map(b=>{const r=b.getBoundingClientRect();return {t:b.innerText.trim(), x:Math.round(r.left),y:Math.round(r.top)};}).filter(b=>b.t));
log('BUTTONS:', JSON.stringify(btns));

await page.screenshot({ path: '.auth/tab1-full.png', fullPage: true });
await ctx.close();
