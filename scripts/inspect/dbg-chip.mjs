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
// find element containing the filter chip text "Статус" near top, dump its HTML
const html = await page.evaluate(()=>{
  // locate the toolbar/filter container: an element whose text has "Фильтр" or a combo with Одобрен
  const all=[...document.querySelectorAll('*')];
  const host=all.find(e=>/Фильтр/.test(e.childNodes[0]?.textContent||'') && e.getBoundingClientRect().top<150);
  const cont = host?.closest('div') || document.querySelector('main')||document.body;
  return cont.outerHTML.slice(0,2500);
});
log('FILTER REGION HTML:\n', html);
// list all small icon buttons near top with their aria/icon
const tops = await page.evaluate(()=>[...document.querySelectorAll('vaadin-button,vaadin-icon,button')].filter(b=>{const r=b.getBoundingClientRect();return r.top<160&&r.width>0;}).map(b=>({tag:b.tagName.toLowerCase(),al:b.getAttribute('aria-label'),icon:b.getAttribute('icon')||b.querySelector('vaadin-icon')?.getAttribute('icon'),txt:(b.innerText||'').trim().slice(0,20),x:Math.round(b.getBoundingClientRect().left)})));
log('\nTOP BUTTONS:', JSON.stringify(tops,null,1));
await ctx.close();
