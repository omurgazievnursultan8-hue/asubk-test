import { chromium } from 'playwright-core';

const BASE = 'https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile', { channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1700, height: 1100 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle' });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', 'admin'); await page.fill('input[name=password]', 'admin');
  await Promise.all([page.waitForNavigation().catch(()=>{}), page.keyboard.press('Enter')]); await page.waitForTimeout(2500);
}
await page.goto(BASE + 'loan-programs/new', { waitUntil: 'networkidle' }); await page.waitForTimeout(2500);

// inspect first jmix-value-picker internals
const info = await page.evaluate(() => {
  const p = [...document.querySelectorAll('jmix-value-picker')].find(e => e.getBoundingClientRect().width > 0);
  if (!p) return 'no picker';
  const light = [...p.children].map(c => ({ tag: c.tagName, slot: c.getAttribute('slot'), theme: c.getAttribute('theme'), aria: c.getAttribute('aria-label') }));
  const shadowBtns = p.shadowRoot ? [...p.shadowRoot.querySelectorAll('*')].map(e=>e.tagName).filter((v,i,a)=>a.indexOf(v)===i) : 'no shadow';
  return { lightChildren: light, shadowTags: shadowBtns };
});
console.log('PICKER:', JSON.stringify(info, null, 1));

// click the suffix button and see what overlay appears
const p = page.locator('jmix-value-picker').first();
const btn = p.locator('vaadin-button').first();
const n = await btn.count();
console.log('buttons in picker:', n);
await btn.click({ timeout: 5000 }).catch(e => console.log('click err', String(e).slice(0,60)));
await page.waitForTimeout(1500);
const overlays = await page.evaluate(() => [...document.querySelectorAll('body *')].map(e=>e.tagName).filter(t=>/OVERLAY|DIALOG/.test(t)).filter((v,i,a)=>a.indexOf(v)===i));
console.log('OVERLAYS:', overlays);
const dlg = await page.evaluate(() => {
  const ov = document.querySelector('[class*=overlay], vaadin-dialog-overlay, vaadin-combo-box-overlay');
  if (!ov) return null;
  return { tag: ov.tagName, title: ov.querySelector('h2,[part=title],[slot=title]')?.textContent?.trim(), cols: [...ov.querySelectorAll('vaadin-grid-column,vaadin-grid-sort-column')].map(c=>c.header||c.path).filter(Boolean), cells: [...ov.querySelectorAll('vaadin-grid-cell-content')].map(c=>c.textContent.trim()).filter(Boolean).slice(0,20) };
});
console.log('DLG:', JSON.stringify(dlg, null, 1));
await page.screenshot({ path: '.auth/lookup-open.png' });
await ctx.close();
