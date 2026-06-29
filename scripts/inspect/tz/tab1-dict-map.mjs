// Tab-1 lookup audit: enumerate jmix-value-picker fields on the loan-program
// create form (вкл.1 active), capture each field's LABEL + the dictionary it
// opens (dialog title / grid columns / sample / row-count / toolbar buttons).
// Goal: confirm which справочники вкл.1 actually consumes. (2026-06-25)
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
await page.goto(BASE + 'loan-programs', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);
await page.evaluate(() => { const b=[...document.querySelectorAll('vaadin-button')].find(b=>/Создать/i.test(b.innerText)); b&&b.click(); });
await page.waitForTimeout(2500);

// active tab name
const activeTab = await page.evaluate(() => {
  const t = [...document.querySelectorAll('vaadin-tab')].find(t=>t.hasAttribute('selected'));
  return t ? t.innerText.trim() : '(?)';
});
log('ACTIVE TAB:', activeTab);

// For each picker: label + visibility (is it on the currently shown tab?)
const pickers = await page.evaluate(() => {
  function labelFor(el){
    // jmix-value-picker exposes .label; fallback to enclosing form-item / vaadin label
    let l = el.getAttribute('label') || el.label || '';
    if(!l){ const fi = el.closest('vaadin-form-item'); if(fi){ const lab = fi.querySelector('label,[slot=label]'); if(lab) l = lab.innerText; } }
    if(!l){ const lab = el.previousElementSibling; if(lab && /label/i.test(lab.tagName)) l = lab.innerText; }
    return (l||'').trim();
  }
  return [...document.querySelectorAll('jmix-value-picker')].map((el,i)=>{
    const r = el.getBoundingClientRect();
    const visible = r.width>0 && r.height>0 && r.top>=0 && r.top<1100;
    return {i, label:labelFor(el), visible, x:Math.round(r.left), y:Math.round(r.top), w:Math.round(r.width), h:Math.round(r.height)};
  });
});
log('PICKERS (all in DOM):', JSON.stringify(pickers, null, 1));

function dumpDialog(){
  return page.evaluate(() => {
    const dlg = document.querySelector('vaadin-dialog-overlay');
    if(!dlg) return { open:false };
    const title = (dlg.querySelector('[slot=title]')?.innerText || dlg.querySelector('h2,h3')?.innerText || dlg.innerText.split('\n')[0] || '').trim();
    const grid = dlg.querySelector('vaadin-grid');
    let cols = [];
    if(grid) cols = [...grid.querySelectorAll('vaadin-grid-column')].map(c=>(c.getAttribute('header')||c.path||''));
    const cells = grid ? [...grid.querySelectorAll('vaadin-grid-cell-content')].map(c=>c.innerText.trim()).filter(Boolean) : [];
    const buttons = [...dlg.querySelectorAll('vaadin-button')].filter(b=>b.getBoundingClientRect().width>0).map(b=>b.innerText.trim()).filter(Boolean);
    const pager = (dlg.innerText.match(/\d+\s+(?:строк[аи]?|элемент\w*|записи?\w*)/) || [''])[0];
    return { open:true, title, cols, pager, buttons, rowSample:cells.slice(0,40) };
  });
}

for(const p of pickers){
  if(!p.visible) { log(`\n--- picker #${p.i} "${p.label}" HIDDEN (other tab), skip ---`); continue; }
  const cx = p.x + p.w - 58, cy = p.y + Math.round(p.h/2);
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(1600);
  const d = await dumpDialog();
  log(`\n===== picker #${p.i}  LABEL="${p.label}"  =====`);
  log(JSON.stringify(d, null, 1));
  await page.evaluate(() => {
    const dlg = document.querySelector('vaadin-dialog-overlay'); if(!dlg) return;
    const c = [...dlg.querySelectorAll('vaadin-button')].find(b=>/отмен|закрыть|cancel|close/i.test(b.innerText)); if(c) c.click();
  });
  await page.keyboard.press('Escape').catch(()=>{});
  await page.waitForTimeout(700);
}
await ctx.close();
