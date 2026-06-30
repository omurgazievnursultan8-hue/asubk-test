// Live verify v3: open Просмотр detail + walk tabs (R1 docs grid, R2 history),
// deep-probe Документы tab, and create a labelled test draft to verify
// R3 code-gen + R7 Отправить→На рассмотрении + R2 reject-reason dialog.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const BASE = 'https://fkftest.okmot.kg/';
const SHOT = '.auth/live-verify'; mkdirSync(SHOT, { recursive: true });
const ctx = await chromium.launchPersistentContext('.auth/profile', { channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1700, height: 1100 } });
const page = ctx.pages()[0] || await ctx.newPage();
const log = (...a) => console.log(...a);
const dialogs = [];
page.on('dialog', async d => { dialogs.push(d.message()); log('NATIVE DIALOG:', d.message().slice(0,140)); await d.dismiss(); });
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) { await page.fill('input[name=username]','admin'); await page.fill('input[name=password]','admin'); await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}), page.keyboard.press('Enter')]); await page.waitForTimeout(2500); }

const detailDump = () => page.evaluate(() => {
  const ov = document.querySelector('vaadin-dialog-overlay') || document;
  return {
    upload: !!ov.querySelector?.('vaadin-upload') || !!document.querySelector('vaadin-upload'),
    uploadFiles: document.querySelectorAll('vaadin-upload-file').length,
    gridCols: [...document.querySelectorAll('vaadin-grid-column,vaadin-grid-sort-column')].map(c=>c.header||c.path).filter(Boolean),
    gridCells: [...document.querySelectorAll('vaadin-grid-cell-content')].map(c=>c.textContent.trim()).filter(Boolean).slice(0,40),
    buttons: [...document.querySelectorAll('vaadin-button')].filter(b=>b.getBoundingClientRect().width>0).map(b=>(b.innerText||'').trim()).filter(t=>t&&t!=='Выйти'),
  };
});
const selectByStatus = (status) => page.evaluate((status) => { for (const c of document.querySelectorAll('vaadin-grid-cell-content')) { if (c.textContent.trim()===status){ c.click(); return true; } } return false; }, status);
const jsClick = (re) => page.evaluate((reStr) => { const re=new RegExp(reStr); for (const b of document.querySelectorAll('vaadin-button')){ if(re.test((b.innerText||'').trim()) && !b.disabled){ b.click(); return (b.innerText||'').trim(); } } return null; }, re.source||re);

// ============ DETAIL via Просмотр ============
await page.goto(BASE + 'gov-decisions', { waitUntil: 'networkidle', timeout: 60000 }); await page.waitForTimeout(2500);
await selectByStatus('Действует'); await page.waitForTimeout(800);
log('clicked Просмотр:', await jsClick(/^Просмотр$/)); await page.waitForTimeout(2500);
try {
log('DETAIL URL:', page.url());
const tnames = await page.$$eval('vaadin-tab', els=>els.map(e=>e.innerText.trim()));
log('DETAIL TABS:', JSON.stringify(tnames));
const tabEls = await page.$$('vaadin-tab');
for (let i=0;i<tabEls.length;i++){ await tabEls[i].click(); await page.waitForTimeout(900); log(`DETAIL TAB[${tnames[i]}]:`, JSON.stringify(await detailDump())); await page.screenshot({ path: `${SHOT}/v3-detail-${i}-${tnames[i].slice(0,8)}.png`, fullPage:true }); }
// detail field readonly check (R6 view mode)
log('DETAIL all readonly?', await page.evaluate(()=>{ const f=[...document.querySelectorAll('vaadin-text-field,vaadin-text-area,vaadin-date-picker,jmix-value-picker,vaadin-checkbox')].filter(e=>e.getBoundingClientRect().width>0); return { total:f.length, editable:f.filter(e=>!(e.readonly||e.hasAttribute('readonly')||e.disabled)).map(e=>e.querySelector('label')?.textContent?.trim()||e.getAttribute('aria-label')) }; }));
} catch(e){ log('detail walk err', String(e).slice(0,140)); }
await page.goto(BASE + 'gov-decisions', { waitUntil:'networkidle' }); await page.waitForTimeout(1500);

// ============ R1 deep: create-form Документы tab ============
await page.goto(BASE + 'gov-decisions/new', { waitUntil: 'networkidle', timeout: 60000 }); await page.waitForTimeout(2000);
{ const tEls = await page.$$('vaadin-tab'); const tn = await page.$$eval('vaadin-tab', e=>e.map(x=>x.innerText.trim()));
  const di = tn.findIndex(x=>x.includes('Документ')); if (di>=0){ await tEls[di].click(); await page.waitForTimeout(900);
    log('\nNEW Документы tab:', JSON.stringify(await detailDump())); await page.screenshot({ path:`${SHOT}/v3-new-doc.png`, fullPage:true }); } }

// ============ R3 + R7 + R2: create labelled test draft ============
await page.goto(BASE + 'gov-decisions/new', { waitUntil: 'networkidle', timeout: 60000 }); await page.waitForTimeout(2000);
const stamp = '20260630';
try {
  // Вид решения picker → pick first
  const vp = page.locator('jmix-value-picker').first();
  await vp.locator('vaadin-button').first().click(); await page.waitForTimeout(1200);
  const picked = await page.evaluate(()=>{ const ov=document.querySelector('vaadin-dialog-overlay,vaadin-combo-box-overlay'); if(!ov) return 'no-overlay'; const c=ov.querySelector('vaadin-grid-cell-content'); if(c){ c.click(); return c.textContent.trim(); } const it=ov.querySelector('vaadin-item'); if(it){it.click();return it.textContent.trim();} return 'no-item'; });
  log('Вид решения picked:', picked); await page.waitForTimeout(800);
  // a select dialog may need OK
  const okBtn = page.locator('vaadin-dialog-overlay vaadin-button', { hasText: /Выбрать|ОК|OK|Select/i }).first();
  if (await okBtn.count()) { await okBtn.click().catch(()=>{}); await page.waitForTimeout(600); }
  // fill Номер + Наименование
  await page.evaluate((s)=>{ const set=(label,val)=>{ for(const el of document.querySelectorAll('vaadin-text-field,vaadin-text-area')){ const l=el.querySelector('label')?.textContent?.trim()||el.getAttribute('aria-label'); if(l===label){ const inp=el.querySelector('input,textarea'); inp.value=val; inp.dispatchEvent(new Event('input',{bubbles:true})); el.value=val; } } };
    set('Номер решения','QA-TEST-'+s); set('Наименование','QA-TEST автотест '+s); set('Краткое наименование','QA-TEST '+s);
  }, stamp);
  await page.waitForTimeout(400);
  log('Код before save (readonly preview):', await page.evaluate(()=>{ for(const el of document.querySelectorAll('vaadin-text-field')){ const l=el.querySelector('label')?.textContent?.trim()||el.getAttribute('aria-label'); if(l==='Код') return el.value; } return null; }));
  await page.screenshot({ path:`${SHOT}/v3-create-filled.png`, fullPage:true });
  // SAVE
  log('clicked save:', await jsClick(/^OK$/)); await page.waitForTimeout(2500);
  log('After save URL:', page.url());
  log('Toast/validation:', await page.evaluate(()=>[...document.querySelectorAll('vaadin-notification-card, .v-notification, [part=overlay]')].map(n=>n.innerText.trim()).filter(Boolean).slice(0,5)));
} catch(e){ log('create err', String(e).slice(0,160)); }

// re-open list, find our test record, read its Код + Статус
await page.goto(BASE + 'gov-decisions', { waitUntil:'networkidle' }); await page.waitForTimeout(2500);
const found = await page.evaluate((s)=>{ const cells=[...document.querySelectorAll('vaadin-grid-cell-content')].map(c=>c.textContent.trim()); const i=cells.findIndex(t=>t.includes('QA-TEST автотест '+s)); if(i<0) return null; return cells.slice(Math.max(0,i-2), i+8); }, stamp);
log('\nTEST RECORD row context (R3 code, P1-12 visible):', JSON.stringify(found));

await ctx.close();
log('\nDONE v3. dialogs:', JSON.stringify(dialogs));
