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
await page.locator('#creditOrderTypeField #entityLookupAction').click({ timeout: 5000 });
await page.waitForTimeout(2500);
const info = await page.evaluate(() => {
  const ov = [...document.querySelectorAll('vaadin-dialog-overlay')].pop();
  if (!ov) return 'no overlay';
  return {
    title: ov.querySelector('h2,[part=title],header')?.textContent?.trim(),
    cols: [...ov.querySelectorAll('vaadin-grid-column,vaadin-grid-sort-column')].map(c=>c.header||c.path).filter(Boolean),
    cells: [...ov.querySelectorAll('vaadin-grid-cell-content')].map(c=>c.textContent.trim()).filter(Boolean).slice(0,30),
    buttons: [...ov.querySelectorAll('vaadin-button')].map(b=>(b.innerText||b.getAttribute('aria-label')||'').trim()).filter(Boolean),
  };
});
log('VID LOOKUP:', JSON.stringify(info, null, 1));
await page.screenshot({ path: '.auth/vid-lookup.png', fullPage: true });
// footer OK buttons on the form (check actual text)
const allBtns = await page.evaluate(()=>[...document.querySelectorAll('vaadin-button')].filter(b=>b.getBoundingClientRect().width>0).map(b=>JSON.stringify((b.innerText||'').trim())));
log('ALL VISIBLE BUTTONS:', JSON.stringify(allBtns));
await ctx.close();
