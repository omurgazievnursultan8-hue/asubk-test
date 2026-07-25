// Probe the /payments create form: does it auto-split a payment by the
// repayment queue (ОД → проценты → штрафы) or is the split typed by hand?
//   node scripts/inspect/accrual-payment.mjs
import { chromium } from 'playwright-core';
const BASE = 'https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1900, height: 1100 },
});
const page = ctx.pages()[0] || await ctx.newPage();
const notes = [];
page.on('console', m => { if (m.type() === 'error' && !/WebSocket/.test(m.text())) notes.push(m.text().slice(0, 200)); });
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', 'admin'); await page.fill('input[name=password]', 'admin');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(2500);
}
await page.goto(BASE + 'payments', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);
for (const b of await page.$$('vaadin-button')) {
  if ((await b.textContent() || '').trim() === 'Создать') { await b.click({ force: true }); break; }
}
await page.waitForTimeout(4000);
console.log('URL after Создать:', page.url());

console.log('\nALL VISIBLE FORM COMPONENTS (tag / label / id / readOnly):');
console.log(JSON.stringify(await page.evaluate(() => {
  const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const clean = s => (s || '').replace(/\s+/g, ' ').trim();
  const sel = 'vaadin-text-field,vaadin-big-decimal-field,vaadin-number-field,vaadin-integer-field,vaadin-select,vaadin-combo-box,vaadin-date-picker,vaadin-checkbox,vaadin-text-area,vaadin-custom-field,vaadin-horizontal-layout';
  return [...document.querySelectorAll(sel)].filter(vis).map(f => ({
    tag: f.tagName.toLowerCase(),
    label: clean(f.getAttribute('label') || f.querySelector(':scope > label')?.textContent),
    id: f.id, ro: f.readOnly === true, value: typeof f.value === 'string' ? f.value : undefined,
  })).filter(x => x.label);
}), null, 1));

console.log('\nBUTTONS:', JSON.stringify(await page.evaluate(() => {
  const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  return [...document.querySelectorAll('vaadin-button')].filter(vis).map(b => b.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);
})));

await page.screenshot({ path: '.auth/accrual/payment-create.png', fullPage: true });
console.log('\nCONSOLE ERRORS:', notes.slice(0, 5));
await ctx.close();
