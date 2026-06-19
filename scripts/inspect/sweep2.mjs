import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';

const BASE = 'https://fkftest.okmot.kg/';
const PROFILE = '.auth/profile';
const FIELD_TAGS = ['vaadin-text-field','vaadin-text-area','vaadin-number-field','vaadin-integer-field','vaadin-big-decimal-field','vaadin-date-picker','vaadin-combo-box','vaadin-select','vaadin-checkbox','vaadin-checkbox-group','vaadin-multi-select-combo-box','jmix-value-picker','jmix-multi-value-picker'];

const ctx = await chromium.launchPersistentContext(PROFILE, { channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1700, height: 1100 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', 'admin');
  await page.fill('input[name=password]', 'admin');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }).catch(()=>{}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(2500);
}
await page.goto(BASE + 'loan-programs/new', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

const tabs = await page.$$eval('vaadin-tab', els => els.map(e => e.innerText.trim()));
const extract = (tagList) => {
  const labelOf = (el) => {
    const s = el.querySelector(':scope > label, :scope > [slot="label"]');
    if (s && s.textContent.trim()) return s.textContent.trim();
    const sr = el.shadowRoot?.querySelector('[part="label"]');
    if (sr && sr.textContent.trim()) return sr.textContent.trim();
    return null;
  };
  const out = [];
  for (const tag of tagList) {
    for (const el of document.querySelectorAll(tag)) {
      const r = el.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0)) continue;
      const rec = {
        tag, label: labelOf(el),
        required: el.hasAttribute('required') || el.required === true,
        readonly: el.readonly === true || el.hasAttribute('readonly'),
      };
      if (tag === 'vaadin-select') {
        rec.selectedText = el.shadowRoot?.querySelector('[part="value"]')?.textContent?.trim()
          || el.querySelector('vaadin-select-value-button')?.textContent?.trim() || null;
      }
      if (el.items && Array.isArray(el.items)) rec.items = el.items.map(i => typeof i==='string'?i:(i.label??i.value??'')).slice(0,25);
      out.push(rec);
    }
  }
  return out;
};

const result = { tabs, perTab: {} };
const tabEls = await page.$$('vaadin-tab');
for (let i = 0; i < tabEls.length; i++) {
  await tabEls[i].click();
  await page.waitForTimeout(800);
  result.perTab[tabs[i]] = await page.evaluate(extract, FIELD_TAGS);
  console.log(`Tab ${i+1} ${tabs[i]}: ${result.perTab[tabs[i]].length}`);
}
writeFileSync('.auth/sweep2.json', JSON.stringify(result, null, 1));
console.log('done');
await ctx.close();
