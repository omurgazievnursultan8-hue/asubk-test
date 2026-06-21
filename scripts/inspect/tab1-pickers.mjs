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

const pickerInfo = await page.evaluate(() =>
  [...document.querySelectorAll('jmix-value-picker')].map((el,i)=>{ const r=el.getBoundingClientRect(); return {i, x:Math.round(r.left), y:Math.round(r.top), w:Math.round(r.width), h:Math.round(r.height)}; }));
log('PICKERS:', JSON.stringify(pickerInfo));

function dumpDialog() {
  return page.evaluate(() => {
    const dlg = document.querySelector('vaadin-dialog-overlay');
    if (!dlg) return { open:false };
    const title = (dlg.querySelector('[slot=title]')?.innerText || dlg.querySelector('h2,h3')?.innerText || dlg.innerText.split('\n')[0] || '').trim();
    const search = !!dlg.querySelector('vaadin-text-field input, input[type=text], vaadin-text-field');
    const grid = dlg.querySelector('vaadin-grid');
    let cols = [];
    if (grid) cols = [...grid.querySelectorAll('vaadin-grid-column')].map(c=>(c.getAttribute('header')||c.path||''));
    const headerCells = grid ? [...grid.shadowRoot.querySelectorAll('thead th, [part~="header-cell"]')].map(t=>t.innerText.trim()).filter(Boolean) : [];
    const cells = grid ? [...grid.querySelectorAll('vaadin-grid-cell-content')].map(c=>c.innerText.trim()).filter(Boolean) : [];
    const buttons = [...dlg.querySelectorAll('vaadin-button')].filter(b=>b.getBoundingClientRect().width>0).map(b=>b.innerText.trim()).filter(Boolean);
    const hasCheckbox = !!dlg.querySelector('vaadin-checkbox');
    // exact "N строк/строки/строка" pager text
    const pager = (dlg.innerText.match(/\d+\s+строк[аи]?/) || [''])[0];
    return { open:true, title, search, gridPresent:!!grid, colAttrs:cols, headerCells, pager, rowSample:cells.slice(0,200), buttons, hasCheckbox };
  });
}

for (let i=0;i<pickerInfo.length;i++){
  // ••• sits left of the ✕ clear button at the right edge; click by coordinate
  const pi = pickerInfo[i];
  const cx = pi.x + pi.w - 58, cy = pi.y + Math.round(pi.h/2);
  await page.mouse.click(cx, cy);
  const opened = true;
  await page.waitForTimeout(1600);
  const d = await dumpDialog();
  log(`\n===== PICKER #${i} (x${pickerInfo[i].x},y${pickerInfo[i].y}) opened=${opened} =====`);
  log(JSON.stringify(d, null, 1));
  await page.screenshot({ path: `.auth/picker-${i}.png` });
  await page.evaluate(() => {
    const dlg = document.querySelector('vaadin-dialog-overlay');
    if(!dlg) return;
    const cancel = [...dlg.querySelectorAll('vaadin-button')].find(b=>/отмен|закрыть|cancel|close/i.test(b.innerText));
    if(cancel) cancel.click();
  });
  await page.keyboard.press('Escape').catch(()=>{});
  await page.waitForTimeout(800);
}
await ctx.close();
