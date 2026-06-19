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

// inspect dialog: title, toolbar buttons, filter chip text, close icons (with coords)
const info = await page.evaluate(()=>{
  const ov=[...document.querySelectorAll('vaadin-dialog-overlay')].pop();
  const r=ov.getBoundingClientRect();
  const txt=ov.textContent.replace(/\s+/g,' ').slice(0,300);
  const btns=[...ov.querySelectorAll('vaadin-button')].map(b=>(b.innerText||b.getAttribute('aria-label')||'').trim()).filter(Boolean);
  const closes=[...ov.querySelectorAll('vaadin-icon[icon*="close"]')].map(e=>{const b=e.getBoundingClientRect();return{x:Math.round(b.left),y:Math.round(b.top)};});
  const hasFilterWord=/Фильтр|статус/i.test(txt);
  return {dlgBox:{x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width)}, headText:txt, btns, closes, hasFilterWord};
});
log('DIALOG HEAD TEXT:', info.headText);
log('DIALOG BUTTONS:', JSON.stringify(info.btns));
log('CLOSE ICONS in dialog:', JSON.stringify(info.closes));
await page.screenshot({ path: '.auth/picker-open.png', fullPage: true });

// try clearing each close icon that is NOT the dialog's own close (top-right corner)
for (const c of info.closes) {
  // skip the dialog close (near top-right corner of dialog)
  if (c.x > info.dlgBox.x + info.dlgBox.w - 80) continue;
  await page.mouse.click(c.x+6, c.y+6);
  await page.waitForTimeout(1500);
}
// refresh inside dialog if there is Обновить
await page.evaluate(()=>{const ov=[...document.querySelectorAll('vaadin-dialog-overlay')].pop();const b=[...ov.querySelectorAll('vaadin-button')].find(x=>/Обновить/.test(x.innerText));b?.click();});
await page.waitForTimeout(2000);

const after = await page.evaluate(async ()=>{
  const ov=[...document.querySelectorAll('vaadin-dialog-overlay')].pop();
  const grid=ov.querySelector('vaadin-grid');
  for(const idx of [50,100]){grid.scrollToIndex(idx);await new Promise(r=>setTimeout(r,300));}
  const size=grid._effectiveSize??grid.size??null;
  const st=new Set(); const names=new Set();
  for(let i=0;i<=(size||0);i++){grid.scrollToIndex(i);await new Promise(r=>setTimeout(r,60));for(const c of grid.querySelectorAll('vaadin-grid-cell-content')){const t=c.textContent.trim();if(/^(Одобрен|На стадии рассмотрения|Закрыт|Отклонен|Черновик)$/.test(t))st.add(t);if(t.length>4)names.add(t);}}
  return {size, statuses:[...st], hasZZZ:[...names].some(n=>n.includes('ZZZ ТЕСТ'))};
});
log('\nAFTER clearing filter — picker size:', after.size, 'statuses:', JSON.stringify(after.statuses), 'hasZZZ:', after.hasZZZ);
await page.screenshot({ path: '.auth/picker-cleared.png', fullPage: true });
await ctx.close();
