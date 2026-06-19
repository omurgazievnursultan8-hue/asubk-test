import { chromium } from 'playwright-core';
const BASE = 'https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile', { channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1700, height: 1100 } });
const page = ctx.pages()[0] || await ctx.newPage();
const log = (...a)=>console.log(...a);
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]','admin'); await page.fill('input[name=password]','admin');
  await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}), page.keyboard.press('Enter')]); await page.waitForTimeout(2500);
}
await page.goto(BASE + 'gov-decisions/new', { waitUntil:'networkidle', timeout:60000 }); await page.waitForTimeout(2500);
// click picker via JS, dump all overlays
await page.evaluate(() => { const p=[...document.querySelectorAll('jmix-value-picker')].find(e=>e.getBoundingClientRect().width>0); const b=p?.shadowRoot?.querySelector('vaadin-button')||p?.querySelector('vaadin-button'); b?.click(); });
await page.waitForTimeout(1800);
const ov = await page.evaluate(() => {
  const all=[...document.querySelectorAll('[class*=overlay],vaadin-dialog-overlay,vaadin-combo-box-overlay,vaadin-grid')];
  const last=all.filter(o=>o.getBoundingClientRect().width>0).pop();
  if(!last) return 'none';
  return { tag:last.tagName, title:last.querySelector('h2,[part=title]')?.textContent?.trim(),
    cells:[...document.querySelectorAll('vaadin-grid-cell-content')].map(c=>c.textContent.trim()).filter(Boolean) };
});
log('LOOKUP OVERLAY:', JSON.stringify(ov));
await page.screenshot({path:'.auth/gov-lookup.png'});
await page.keyboard.press('Escape');

// DETAIL via JS double-click on a row, then Просмотр
await page.goto(BASE + 'gov-decisions', { waitUntil:'networkidle', timeout:60000 }); await page.waitForTimeout(2500);
await page.evaluate(() => { const c=[...document.querySelectorAll('vaadin-grid-cell-content')].find(x=>x.textContent.trim().length>3); c?.click(); });
await page.waitForTimeout(800);
await page.evaluate(() => { const b=[...document.querySelectorAll('vaadin-button')].find(x=>/Просмотр/.test(x.innerText)); b?.click(); });
await page.waitForTimeout(2500);
log('DETAIL URL:', page.url());
const df = await page.evaluate(() => {
  const tabs=[...document.querySelectorAll('vaadin-tab')].filter(e=>e.getBoundingClientRect().width>0).map(e=>e.innerText.trim());
  const fields=[...document.querySelectorAll('vaadin-text-field,vaadin-text-area,vaadin-date-picker,jmix-value-picker')].filter(e=>e.getBoundingClientRect().width>0).map(el=>({tag:el.tagName.toLowerCase(),readonly:el.readonly===true,value:(el.value||'').toString().slice(0,50)}));
  const btns=[...document.querySelectorAll('vaadin-button')].filter(b=>b.getBoundingClientRect().width>0).map(b=>b.innerText.trim()).filter(Boolean);
  return {tabs,fields,btns};
});
log('DETAIL:', JSON.stringify(df, null, 1));
await page.screenshot({path:'.auth/gov-detail.png', fullPage:true});
await ctx.close();
