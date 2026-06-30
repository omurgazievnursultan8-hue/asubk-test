// Final checks: (1) commit reject on E5 with reason → verify reason persists in История + status Отклонён;
// (2) does Удалить on a Черновик open a reason modal (mockup R4) or bare confirm?
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const BASE='https://fkftest.okmot.kg/'; const SHOT='.auth/live-verify'; mkdirSync(SHOT,{recursive:true});
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1100}});
const page=ctx.pages()[0]||await ctx.newPage(); const log=(...a)=>console.log(...a);
const dialogs=[]; page.on('dialog',async d=>{dialogs.push(d.message());log('NATIVE DIALOG:',d.message().slice(0,160));await d.dismiss();});
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
const jsClick=(re)=>page.evaluate((reStr)=>{const re=new RegExp(reStr);for(const b of document.querySelectorAll('vaadin-button')){if(re.test((b.innerText||'').trim())&&!b.disabled){b.click();return (b.innerText||'').trim();}}return null;},re.source||re);
const sel=(needle)=>page.evaluate((n)=>{for(const c of document.querySelectorAll('vaadin-grid-cell-content')){if(c.textContent.trim().includes(n)){c.click();return c.textContent.trim();}}return null;},needle);

// ===== (1) commit reject on E5 with reason =====
await page.goto(BASE+'gov-decisions',{waitUntil:'networkidle'}); await page.waitForTimeout(2500);
log('sel E5:',await sel('QA-TEST автотест E5')); await page.waitForTimeout(600);
log('click Отклонить:',await jsClick(/^Отклонить$/)); await page.waitForTimeout(1200);
const reason='QA автотест: проверка причины отклонения';
await page.evaluate((r)=>{const ov=[...document.querySelectorAll('vaadin-dialog-overlay')].pop();const ta=ov.querySelector('vaadin-text-area,vaadin-text-field');const inp=ta.querySelector('textarea,input');inp.value=r;inp.dispatchEvent(new Event('input',{bubbles:true}));inp.dispatchEvent(new Event('change',{bubbles:true}));},reason);
await page.waitForTimeout(400);
log('commit reject OK:',await jsClick(/^OK$/)); await page.waitForTimeout(2000);
log('notif:',await page.evaluate(()=>[...document.querySelectorAll('vaadin-notification-card')].map(n=>n.innerText.trim()).filter(Boolean)));
// re-open list, read E5 row status + Последняя причина
await page.goto(BASE+'gov-decisions',{waitUntil:'networkidle'}); await page.waitForTimeout(2000);
log('E5 row after reject:',await page.evaluate(()=>{const cells=[...document.querySelectorAll('vaadin-grid-cell-content')].map(c=>c.textContent.trim());const i=cells.findIndex(t=>t.includes('QA-TEST автотест E5'));return i<0?null:cells.slice(Math.max(0,i-3),i+6);}));
// open detail История to verify reason persisted
await sel('QA-TEST автотест E5'); await page.waitForTimeout(500);
await jsClick(/^Просмотр$/); await page.waitForTimeout(1800);
const tnames=await page.$$eval('vaadin-tab',e=>e.map(x=>x.innerText.trim())); const tabs=await page.$$('vaadin-tab');
const hi=tnames.findIndex(t=>t==='История'); if(hi>=0){await tabs[hi].click();await page.waitForTimeout(1200);}
log('E5 История after reject:',JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('vaadin-grid-cell-content')].map(c=>c.textContent.trim()))));
await page.screenshot({path:`${SHOT}/final-history.png`,fullPage:true});
await jsClick(/^Отмена$/); await page.waitForTimeout(800);

// ===== (2) Удалить on a Черновик → reason modal or confirm? =====
await page.goto(BASE+'gov-decisions',{waitUntil:'networkidle'}); await page.waitForTimeout(2000);
const draft=await sel('Черновик'); await page.waitForTimeout(600);
log('\nsel Черновик:',draft);
const delEnabled=await page.evaluate(()=>{const b=[...document.querySelectorAll('vaadin-button')].find(x=>x.innerText.trim()==='Удалить');return b?!b.disabled:null;});
log('Удалить enabled:',delEnabled);
if(delEnabled){ log('click Удалить:',await jsClick(/^Удалить$/)); await page.waitForTimeout(1200);
  const dlg=await page.evaluate(()=>{const ov=[...document.querySelectorAll('vaadin-dialog-overlay')].pop();if(!ov)return null;return {text:ov.innerText.replace(/\s+/g,' ').slice(0,200),hasReason:!!ov.querySelector('vaadin-text-area,vaadin-text-field'),buttons:[...ov.querySelectorAll('vaadin-button')].map(b=>b.innerText.trim())};});
  log('DELETE dialog (R4):',JSON.stringify(dlg)); log('(native confirm?):',JSON.stringify(dialogs));
  await page.screenshot({path:`${SHOT}/final-delete.png`,fullPage:true});
  await jsClick(/^Отмена$|Cancel|^Нет$/); // do NOT commit delete
}
await ctx.close(); log('\nDONE final. native dialogs:',JSON.stringify(dialogs));
