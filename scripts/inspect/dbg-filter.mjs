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
await page.goto(BASE + 'gov-decisions', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
// is there a pre-applied filter chip / condition visible?
const pre = await page.evaluate(()=>[...document.querySelectorAll('jmix-property-filter,jmix-jpql-filter,[class*=filter] vaadin-text-field,vaadin-details,jmix-filter')].map(e=>e.outerHTML.slice(0,120)));
log('PREAPPLIED FILTER NODES:', JSON.stringify(pre.slice(0,8)));
// click "Добавить условие поиска"
await page.locator('vaadin-button').filter({ hasText:'Добавить условие поиска' }).first().click({ timeout:5000 }).catch(e=>log('addcond err',String(e).slice(0,60)));
await page.waitForTimeout(1500);
const ov = await page.evaluate(()=>{
  const o=[...document.querySelectorAll('vaadin-dialog-overlay,vaadin-combo-box-overlay,vaadin-context-menu-overlay')].pop();
  if(!o) return 'none';
  return { title:o.querySelector('h2,[part=title]')?.textContent?.trim(),
    items:[...o.querySelectorAll('vaadin-item,vaadin-combo-box,vaadin-select,vaadin-text-field')].map(i=>(i.label||i.textContent||'').trim()).filter(Boolean).slice(0,40) };
});
log('ADD-CONDITION OVERLAY:', JSON.stringify(ov,null,1));
await page.screenshot({path:'.auth/filter-overlay.png', fullPage:true});
await ctx.close();
