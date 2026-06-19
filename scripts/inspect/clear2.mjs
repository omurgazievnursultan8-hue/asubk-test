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
async function dump(){return await page.evaluate(async()=>{const g=document.querySelector('vaadin-grid');const size=g._effectiveSize??g.size??null;const seen=new Map();const col=()=>{for(const c of g.querySelectorAll('vaadin-grid-cell-content')){const k=c.getAttribute('slot');if(k)seen.set(k,c.textContent.trim());}};for(let i=0;i<(size||0);i++){g.scrollToIndex(i);await new Promise(r=>setTimeout(r,40));col();}return{size,cells:[...seen.values()].filter(Boolean)};});}
log('BEFORE size:', (await dump()).size);
// click the filter chip remove-X at (947,152)
await page.mouse.click(947, 152);
await page.waitForTimeout(2000);
// also click Обновить (refresh) if present
await page.locator('vaadin-button').filter({hasText:'Обновить'}).first().click({timeout:3000}).catch(()=>{});
await page.waitForTimeout(2500);
const after = await dump();
log('AFTER size:', after.size, 'statuses:', JSON.stringify([...new Set(after.cells.filter(r=>/рассмотр|одобр|закры|отклон|чернов/i.test(r)))]));
const zi=after.cells.findIndex(c=>c.includes('ZZZ ТЕСТ'));
log('ZZZ present?', zi>=0, zi>=0?JSON.stringify(after.cells.slice(zi,zi+9)):'');
await page.screenshot({path:'.auth/list-cleared2.png', fullPage:true});
await ctx.close();
