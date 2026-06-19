import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';

const BASE = 'https://fkftest.okmot.kg/';
const PROFILE = '.auth/profile';
const FIELD_TAGS = [
  'vaadin-text-field','vaadin-text-area','vaadin-email-field','vaadin-number-field',
  'vaadin-integer-field','vaadin-big-decimal-field','vaadin-date-picker','vaadin-time-picker',
  'vaadin-date-time-picker','vaadin-combo-box','vaadin-select','vaadin-checkbox',
  'vaadin-checkbox-group','vaadin-radio-group','vaadin-multi-select-combo-box',
  'jmix-value-picker','jmix-multi-value-picker','vaadin-custom-field',
];

const ctx = await chromium.launchPersistentContext(PROFILE, {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1700, height: 1100 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', process.env.OK_USER || 'admin');
  await page.fill('input[name=password]', process.env.OK_PASS || 'admin');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}),
    page.keyboard.press('Enter'),
  ]);
  await page.waitForTimeout(2500);
  console.log('logged in, url:', page.url());
}
await page.goto(BASE + 'loan-programs/new', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);
console.log('URL:', page.url());

// collect tab labels
const tabs = await page.$$eval('vaadin-tab', els => els.map(e => e.innerText.trim()));
console.log('TABS:', JSON.stringify(tabs));

const dumpFields = (tagList) => {
  const out = [];
  for (const tag of tagList) {
    for (const el of document.querySelectorAll(tag)) {
      // skip if not visible
      const r = el.getBoundingClientRect();
      const visible = r.width > 0 && r.height > 0;
      const rec = {
        tag, label: el.label ?? null,
        required: el.required ?? null,
        readonly: el.readonly ?? null,
        disabled: el.disabled ?? null,
        invalid: el.invalid ?? null,
        placeholder: el.placeholder ?? null,
        value: (typeof el.value === 'string' ? el.value.slice(0, 30) : el.value) ?? null,
        visible,
      };
      // options for select/combo
      if (el.items && Array.isArray(el.items)) {
        rec.items = el.items.map(i => (typeof i === 'string' ? i : (i.label ?? i.value ?? JSON.stringify(i)))).slice(0, 20);
      }
      out.push(rec);
    }
  }
  return out;
};

const result = { url: page.url(), tabs, perTab: {} };
const tabEls = await page.$$('vaadin-tab');
for (let i = 0; i < tabEls.length; i++) {
  await tabEls[i].click();
  await page.waitForTimeout(900);
  const fields = await page.evaluate(dumpFields, FIELD_TAGS);
  // only keep visible (active tab) fields
  const vis = fields.filter(f => f.visible);
  result.perTab[`${i + 1}. ${tabs[i]}`] = vis;
  await page.screenshot({ path: `.auth/tab-${i + 1}.png`, fullPage: true });
  console.log(`Tab ${i + 1} "${tabs[i]}": ${vis.length} visible fields`);
}

writeFileSync('.auth/sweep.json', JSON.stringify(result, null, 2));
console.log('Wrote .auth/sweep.json');
await ctx.close();
