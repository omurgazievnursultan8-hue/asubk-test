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
await page.goto(BASE + 'gov-decisions/new', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
const fields = await page.evaluate(() => {
  const TAGS = ['vaadin-text-field','vaadin-text-area','vaadin-date-picker','jmix-value-picker','vaadin-combo-box','vaadin-select','vaadin-checkbox'];
  return [...document.querySelectorAll(TAGS.join(','))].filter(e=>e.getBoundingClientRect().width>0).map(el => ({
    tag: el.tagName.toLowerCase(), id: el.id||null, label: el.label ?? null,
    required: el.required===true||el.hasAttribute('required'), readonly: el.readonly===true,
    value: (el.value||'').toString().slice(0,40)
  }));
});
log('CREATE FIELDS:', JSON.stringify(fields, null, 1));
const btns = await page.evaluate(()=>[...document.querySelectorAll('vaadin-button')].filter(b=>b.getBoundingClientRect().width>0).map(b=>b.innerText.trim()).filter(Boolean));
log('FOOTER BUTTONS:', JSON.stringify(btns));
await ctx.close();
