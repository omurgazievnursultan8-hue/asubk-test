// Dump «Условия кредита» (rates, penalty rates, day-count method) for a loan-credit.
//   REC=19 node scripts/inspect/accrual-terms.mjs
import { chromium } from 'playwright-core';
const BASE = 'https://fkftest.okmot.kg/';
const REC = process.env.REC || '19';
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1900, height: 1100 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', 'admin'); await page.fill('input[name=password]', 'admin');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(()=>{}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(2500);
}
await page.goto(BASE + `loan-credits/${REC}`, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(4000);
for (const t of await page.$$('vaadin-tab')) if (/Услови/.test(await t.textContent())) { await t.click({ force: true }); break; }
await page.waitForTimeout(5000);
const txt = await page.evaluate(() => {
  const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const cont = [...document.querySelectorAll('vaadin-form-layout,vaadin-vertical-layout')].filter(vis);
  return cont.length ? cont[0].innerText : document.body.innerText;
});
console.log('--- innerText of Условия кредита ---');
console.log(txt.slice(0, 2500));
console.log('--- fields ---');
console.log(JSON.stringify(await page.evaluate(() => {
  const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  return [...document.querySelectorAll('vaadin-text-field,vaadin-big-decimal-field,vaadin-number-field,vaadin-select,vaadin-combo-box,vaadin-date-picker,vaadin-checkbox')]
    .filter(vis).map(f => ({
      tag: f.tagName.toLowerCase(),
      label: f.getAttribute('label') || f.querySelector('label')?.textContent?.trim(),
      value: f.tagName.toLowerCase() === 'vaadin-checkbox' ? String(f.checked) : (f.value ?? f.querySelector('input')?.value),
      shown: f.querySelector('input')?.value,
    }));
}), null, 1));
await ctx.close();
