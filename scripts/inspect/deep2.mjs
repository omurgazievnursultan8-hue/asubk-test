import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';

const BASE = 'https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile', { channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1700, height: 1100 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle' });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', 'admin'); await page.fill('input[name=password]', 'admin');
  await Promise.all([page.waitForNavigation().catch(()=>{}), page.keyboard.press('Enter')]); await page.waitForTimeout(2500);
}
await page.goto(BASE + 'loan-programs/new', { waitUntil: 'networkidle' }); await page.waitForTimeout(2500);

const tabs = await page.$$eval('vaadin-tab', els => els.map(e => e.innerText.trim()));
const tabEls = await page.$$('vaadin-tab');
const out = { labelsByTab: {}, lookups: [] };

for (let t = 0; t < tabEls.length; t++) {
  await tabEls[t].click();
  await page.waitForTimeout(700);
  // grab labels of all visible field components in DOM order
  out.labelsByTab[tabs[t]] = await page.evaluate(() => {
    const TAGS = ['vaadin-text-field','vaadin-text-area','vaadin-number-field','vaadin-integer-field','vaadin-big-decimal-field','vaadin-date-picker','vaadin-combo-box','vaadin-select','vaadin-checkbox','vaadin-multi-select-combo-box','jmix-value-picker'];
    const res = [];
    for (const el of document.querySelectorAll(TAGS.join(','))) {
      const r = el.getBoundingClientRect(); if (!(r.width>0&&r.height>0)) continue;
      let lab = el.querySelector(':scope > label[slot="label"]')?.textContent?.trim()
             || el.shadowRoot?.querySelector('[part="label"]')?.textContent?.trim()
             || el.getAttribute('aria-label') || null;
      res.push({ tag: el.tagName.toLowerCase(), label: lab, required: el.hasAttribute('required')||el.required===true, readonly: el.readonly===true });
    }
    return res;
  });

  // open each visible jmix-value-picker via its actions div, read overlay
  const pickers = await page.$$('jmix-value-picker');
  let vi = 0;
  for (const pk of pickers) {
    if (!(await pk.isVisible())) continue;
    const idx = vi++;
    try {
      const lab = await pk.evaluate(el => el.querySelector(':scope > label[slot="label"]')?.textContent?.trim() || null);
      // click first action button (••• open)
      const actBtn = await pk.evaluateHandle(el => el.querySelector('div[slot="actions"]')?.querySelector('vaadin-button,button,[role="button"]') || el.querySelector('div[slot="actions"]')?.firstElementChild);
      const el = actBtn.asElement();
      if (el) { await el.click(); }
      await page.waitForTimeout(1100);
      const dlg = await page.evaluate(() => {
        const ov = document.querySelector('vaadin-dialog-overlay, [class*="overlay"][opened], vaadin-combo-box-overlay');
        if (!ov) return null;
        const title = ov.querySelector('h2,[part="title"],[slot="title"]')?.textContent?.trim() || null;
        const cols = [...ov.querySelectorAll('vaadin-grid-column,vaadin-grid-sort-column')].map(c=>c.header||c.path).filter(Boolean);
        const cells = [...ov.querySelectorAll('vaadin-grid-cell-content')].map(c=>c.textContent.trim()).filter(Boolean).slice(0,18);
        return { title, cols, cells };
      });
      out.lookups.push({ tab: t+1, label: lab, index: idx, ...(dlg||{empty:true}) });
      await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    } catch (e) { out.lookups.push({ tab: t+1, index: idx, error: String(e).slice(0,90) }); await page.keyboard.press('Escape').catch(()=>{}); }
  }
  console.log(`Tab ${t+1} done`);
}
writeFileSync('.auth/deep2.json', JSON.stringify(out, null, 1));
console.log('done lookups=%d', out.lookups.length);
await ctx.close();
