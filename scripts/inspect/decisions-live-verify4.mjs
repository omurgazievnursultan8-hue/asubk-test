// Live verify v4: create labelled test draft → confirm R3 code-gen format + P1-12
// visibility; then select a На рассмотрении record and click Отклонить to confirm
// R2 reason dialog (not silent). Cancels without committing the reject.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const BASE='https://fkftest.okmot.kg/'; const SHOT='.auth/live-verify'; mkdirSync(SHOT,{recursive:true});
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1100}});
const page=ctx.pages()[0]||await ctx.newPage(); const log=(...a)=>console.log(...a);
const dialogs=[]; page.on('dialog',async d=>{dialogs.push(d.message());log('NATIVE DIALOG:',d.message().slice(0,140));await d.dismiss();});
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
const jsClick=(re)=>page.evaluate((reStr)=>{const re=new RegExp(reStr);for(const b of document.querySelectorAll('vaadin-button')){if(re.test((b.innerText||'').trim())&&!b.disabled){b.click();return (b.innerText||'').trim();}}return null;},re.source||re);
const selectByStatus=(s)=>page.evaluate((s)=>{for(const c of document.querySelectorAll('vaadin-grid-cell-content')){if(c.textContent.trim()===s){c.click();return true;}}return false;},s);

// ============ CREATE test draft for R3 ============
await page.goto(BASE+'gov-decisions/new',{waitUntil:'networkidle',timeout:60000}); await page.waitForTimeout(2500);
const stamp=String(process.env.STAMP||'A1');
try{
  // open Вид решения picker robustly
  let opened=await page.evaluate(()=>{const b=document.getElementById('entityLookupAction'); if(!b)return 'no-action'; b.click(); return 'clicked';});
  log('picker open:',opened); await page.waitForTimeout(2500);
  const ovInfo=await page.evaluate(()=>{const ov=document.querySelector('vaadin-dialog-overlay,vaadin-combo-box-overlay,vaadin-context-menu-overlay'); if(!ov)return null; return {cells:[...ov.querySelectorAll('vaadin-grid-cell-content,vaadin-item')].map(c=>c.textContent.trim()).filter(Boolean).slice(0,20), buttons:[...ov.querySelectorAll('vaadin-button')].map(b=>b.innerText.trim())};});
  log('lookup overlay:',JSON.stringify(ovInfo));
  const picked=await page.evaluate(()=>{const ov=document.querySelector('vaadin-dialog-overlay,vaadin-combo-box-overlay,vaadin-context-menu-overlay'); if(!ov)return 'no-overlay'; const re=/Постановление|Распоряжение|Основное|Решение|ПКР|РКМ|РПКР|ПКМ/; for(const c of ov.querySelectorAll('vaadin-grid-cell-content')){const t=c.textContent.trim(); if(re.test(t)){ const ev=t=>c.dispatchEvent(new MouseEvent(t,{bubbles:true,composed:true,cancelable:true})); ev('mousedown');ev('mouseup');ev('click');ev('dblclick'); return 'dblclick:'+t; }} return 'no-match';});
  log('Вид решения picked:',picked); await page.waitForTimeout(1500);
  await jsClick(/^Выбрать$/); await page.waitForTimeout(1200);
  log('Вид решения value now:',await page.evaluate(()=>document.getElementById('creditOrderTypeField')?.value||document.querySelector('jmix-value-picker')?.innerText?.trim()?.slice(0,40)));
  await page.evaluate((s)=>{const set=(label,val)=>{for(const el of document.querySelectorAll('vaadin-text-field,vaadin-text-area')){const l=el.querySelector('label')?.textContent?.trim()||el.getAttribute('aria-label'); if(l===label){const inp=el.querySelector('input,textarea'); if(inp){inp.value=val; inp.dispatchEvent(new Event('input',{bubbles:true})); inp.dispatchEvent(new Event('change',{bubbles:true}));}}}};
    set('Номер решения','QA'+s); set('Наименование','QA-TEST автотест '+s); set('Краткое наименование','QA'+s);},stamp);
  await page.waitForTimeout(500);
  await page.screenshot({path:`${SHOT}/v4-filled.png`,fullPage:true});
  log('clicked save:',await jsClick(/^OK$/)); await page.waitForTimeout(3000);
  log('after save URL:',page.url());
  log('notifications:',await page.evaluate(()=>[...document.querySelectorAll('vaadin-notification-card')].map(n=>n.innerText.trim()).filter(Boolean)));
}catch(e){log('create err',String(e).slice(0,160));}

// find record in list, read code
await page.goto(BASE+'gov-decisions',{waitUntil:'networkidle'}); await page.waitForTimeout(2500);
const ctxRow=await page.evaluate((s)=>{const cells=[...document.querySelectorAll('vaadin-grid-cell-content')].map(c=>c.textContent.trim()); const i=cells.findIndex(t=>t.includes('QA-TEST автотест '+s)); if(i<0)return {found:false,total:cells.length}; return {found:true, ctx:cells.slice(Math.max(0,i-3),i+6)};},stamp);
log('TEST RECORD (R3 code / P1-12):',JSON.stringify(ctxRow));

// ============ R2 reject-reason dialog on a На рассмотрении record (if any) ============
const hasReview=await selectByStatus('На рассмотрении'); await page.waitForTimeout(700);
log('\nНа рассмотрении present:',hasReview);
if(hasReview){
  log('clicked Отклонить:',await jsClick(/^Отклонить$/)); await page.waitForTimeout(1500);
  const dlg=await page.evaluate(()=>{const ov=document.querySelector('vaadin-dialog-overlay'); if(!ov)return null; return {title:ov.querySelector('[part=title], h2, header')?.textContent?.trim()||null, hasReasonField:!!ov.querySelector('vaadin-text-area,vaadin-text-field'), buttons:[...ov.querySelectorAll('vaadin-button')].map(b=>b.innerText.trim())};});
  log('REJECT DIALOG (R2):',JSON.stringify(dlg));
  await page.screenshot({path:`${SHOT}/v4-reject-dialog.png`,fullPage:true});
  await jsClick(/Отмена|Cancel|Закрыть/); // do NOT commit
}
await ctx.close(); log('\nDONE v4. dialogs:',JSON.stringify(dialogs));
