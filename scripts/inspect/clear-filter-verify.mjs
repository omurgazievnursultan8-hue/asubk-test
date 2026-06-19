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

async function dumpGrid() {
  return await page.evaluate(async () => {
    const grid = document.querySelector('vaadin-grid');
    const size = grid?._effectiveSize ?? grid?.size ?? null;
    const seen = new Map();
    const collect = () => { for (const c of grid.querySelectorAll('vaadin-grid-cell-content')) { const k=c.getAttribute('slot'); if(k) seen.set(k,c.textContent.trim()); } };
    for (let i=0;i<(size||0);i++){ grid.scrollToIndex(i); await new Promise(r=>setTimeout(r,40)); collect(); }
    return { size, cells:[...seen.values()].filter(Boolean) };
  });
}

const before = await dumpGrid();
log('BEFORE clear — size:', before.size, 'statuses:', JSON.stringify([...new Set(before.cells.filter(r=>/рассмотр|одобр|закры|отклон|чернов/i.test(r)))]));

// dump the filter chip area
const chip = await page.evaluate(()=>{
  const txt=[...document.querySelectorAll('jmix-property-filter,vaadin-combo-box,vaadin-select')].map(e=>({tag:e.tagName.toLowerCase(),label:e.label||e.getAttribute('aria-label')||null,val:(e.value||'').toString().slice(0,30)})).filter(e=>e.label||e.val);
  return txt;
});
log('FILTER CHIP CONTROLS:', JSON.stringify(chip));

// clear the Статус filter: click the X icons in the filter bar (jmix close/remove)
await page.evaluate(()=>{
  // remove-condition buttons in the filter panel are vaadin-button with icon close, near the top
  const btns=[...document.querySelectorAll('vaadin-button')].filter(b=>{ const r=b.getBoundingClientRect(); return r.top<200 && r.width>0 && (b.querySelector('vaadin-icon[icon*="close"]')|| (b.getAttribute('aria-label')||'').match(/удал|очист|close|remove/i)); });
  btns.forEach(b=>b.click());
});
await page.waitForTimeout(2500);
const after = await dumpGrid();
log('AFTER clear — size:', after.size, 'statuses:', JSON.stringify([...new Set(after.cells.filter(r=>/рассмотр|одобр|закры|отклон|чернов/i.test(r)))]));
const zi = after.cells.findIndex(c=>c.includes('ZZZ ТЕСТ'));
log('ZZZ record present after clear?', zi>=0, zi>=0?'context:'+JSON.stringify(after.cells.slice(zi,zi+9)):'');
await page.screenshot({path:'.auth/list-unfiltered.png', fullPage:true});
await ctx.close();
