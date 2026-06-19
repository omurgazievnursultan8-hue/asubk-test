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
await page.goto(BASE + 'loan-programs/new', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
await page.locator('#govDecisionField #entityLookupAction').click({ timeout: 5000 });
await page.waitForTimeout(2500);

const dump = async () => page.evaluate(async ()=>{
  const ov=[...document.querySelectorAll('vaadin-dialog-overlay')].pop(); if(!ov) return {gone:true};
  const grid=ov.querySelector('vaadin-grid');
  for(const idx of [50,100]){grid.scrollToIndex(idx);await new Promise(r=>setTimeout(r,300));}
  const size=grid._effectiveSize??grid.size??null;
  const st=new Set();const names=new Set();
  for(let i=0;i<=(size||0);i++){grid.scrollToIndex(i);await new Promise(r=>setTimeout(r,60));for(const c of grid.querySelectorAll('vaadin-grid-cell-content')){const t=c.textContent.trim();if(/^(Одобрен|На стадии рассмотрения|Закрыт|Отклонен|Черновик)$/.test(t))st.add(t);if(t.length>4)names.add(t);}}
  return {size,statuses:[...st],hasZZZ:[...names].some(n=>n.includes('ZZZ ТЕСТ'))};
});
log('BEFORE:', JSON.stringify(await dump()));

// click ONLY the filter-chip remove X (the lower close icon, not the dialog-close in the corner)
await page.mouse.click(1298, 262);
await page.waitForTimeout(2500);
log('dialog still open?', await page.evaluate(()=>!![...document.querySelectorAll('vaadin-dialog-overlay')].pop()));
log('AFTER clear chip:', JSON.stringify(await dump()));
await page.screenshot({ path: '.auth/picker-cleared2.png', fullPage: true });
await ctx.close();
