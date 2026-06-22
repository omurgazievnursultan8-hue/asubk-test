import { chromium } from 'playwright-core';
const BASE = 'https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile', { channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1700, height: 1100 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', 'admin'); await page.fill('input[name=password]', 'admin');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }).catch(()=>{}), page.keyboard.press('Enter')]); await page.waitForTimeout(2500);
}
await page.goto(BASE + 'loan-programs', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);
await page.evaluate(() => { const b=[...document.querySelectorAll('vaadin-button')].find(b=>/Создать/i.test(b.innerText)); b&&b.click(); });
await page.waitForTimeout(2500);

const fields = await page.evaluate(() => {
  const TAGS = ['vaadin-text-field','vaadin-text-area','vaadin-big-decimal-field','vaadin-number-field','vaadin-integer-field','jmix-value-picker','jmix-multi-value-picker','vaadin-combo-box','vaadin-select','vaadin-checkbox','vaadin-date-picker','vaadin-multi-select-combo-box'];
  const getLabel = (el) => {
    // Vaadin label: el.label prop, or <label slot=label>, or part=label inside shadow
    let l = el.label || el.getAttribute('label');
    if (!l) { const sl = el.querySelector('label,[slot=label]'); if (sl) l = sl.innerText; }
    if (!l && el.shadowRoot) { const sr = el.shadowRoot.querySelector('[part=label],label'); if (sr) l = sr.innerText; }
    return (l||'').trim() || null;
  };
  return [...document.querySelectorAll(TAGS.join(','))].filter(e=>e.getBoundingClientRect().width>0).map(el => {
    const r = el.getBoundingClientRect();
    const inp = el.shadowRoot?.querySelector('input,textarea');
    const ics = inp ? getComputedStyle(inp) : null;
    const fieldEl = el.shadowRoot?.querySelector('[part="input-field"]');
    const fcs = fieldEl ? getComputedStyle(fieldEl) : null;
    // required marker: vaadin shows [part=required-indicator]
    const reqInd = el.shadowRoot?.querySelector('[part=required-indicator]');
    const reqVisible = reqInd ? getComputedStyle(reqInd, '::after').content !== 'none' : false;
    return {
      tag: el.tagName.toLowerCase(),
      label: getLabel(el),
      required: el.required===true||el.hasAttribute('required'),
      readonly: el.readonly===true||el.hasAttribute('readonly'),
      x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
      fieldBg: fcs?.backgroundColor || null,
      fieldRadius: fcs?.borderRadius || null,
      borderBottom: fcs?.borderBottom || null,
    };
  }).sort((a,b)=> a.y-b.y || a.x-b.x);
});
console.log('FIELDS:', JSON.stringify(fields, null, 1));
await ctx.close();
