// Positional select-option grab (selects have no label attr). Open each vaadin-select
// on «Общие условия» + «Условия траншей», dump overlay <vaadin-item> text + nearby label.
import { chromium } from 'playwright-core';
import { writeFileSync } from 'fs';
const BASE='https://fkftest.okmot.kg/';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1600,height:1000}});
const page=ctx.pages()[0]||await ctx.newPage();
const log=(...a)=>console.log(...a);
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle',timeout:60000}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loan-credits/18',{waitUntil:'networkidle',timeout:60000});await page.waitForTimeout(3000);
const tab=async n=>{const ts=await page.$$('vaadin-tab');for(const t of ts){if((await t.textContent()).trim()===n){await t.click({force:true});await page.waitForTimeout(1100);return;}}};
const esc=async()=>{await page.keyboard.press('Escape');await page.waitForTimeout(350);};
const out={};

async function grabAllSelects(scopeName){
  const n=await page.$$eval('vaadin-select',e=>e.length);
  for(let i=0;i<n;i++){
    // nearby label = closest preceding element text
    const label=await page.evaluate(idx=>{
      const s=document.querySelectorAll('vaadin-select')[idx];
      const r=s.getBoundingClientRect(); if(r.width===0)return '__hidden__';
      // walk up to a wrapper, find a label-ish text above
      let lbl='';
      let w=s;
      for(let k=0;k<4&&w;k++){w=w.parentElement;
        const cand=[...(w?.querySelectorAll('label,[class*=label],span')||[])].map(e=>e.textContent.trim()).filter(t=>t&&t.length<40);
        if(cand.length){lbl=cand[0];break;}}
      return lbl;
    },i);
    if(label==='__hidden__')continue;
    const box=await page.$(`vaadin-select >> nth=${i}`);
    const b=await box.boundingBox(); if(!b)continue;
    await page.mouse.click(b.x+b.width-16,b.y+b.height/2); await page.waitForTimeout(700);
    const items=await page.evaluate(()=>{const ov=[...document.querySelectorAll('vaadin-select-overlay')].pop();return ov?[...ov.querySelectorAll('vaadin-item')].map(i=>i.textContent.replace(/\s+/g,' ').trim()):[];});
    await esc();
    if(items.length){out[`${scopeName}#${i} (${label})`]=items; log(`${scopeName} select#${i} [${label}] =>`,JSON.stringify(items));}
  }
}
await tab('Условия кредита');
await page.evaluate(()=>{const t=[...document.querySelectorAll('vaadin-tab')].find(x=>x.textContent.trim()==='Общие условия');t&&t.click();});
await page.waitForTimeout(800);
await grabAllSelects('Общие');
await page.evaluate(()=>{const t=[...document.querySelectorAll('vaadin-tab')].find(x=>x.textContent.trim()==='Условия траншей');t&&t.click();});
await page.waitForTimeout(1000);
await grabAllSelects('Траншей');

// combo «Статус кредита»
await tab('Общая информация');
{const box=await page.$('vaadin-combo-box');const b=await box.boundingBox();if(b){await page.mouse.click(b.x+b.width-16,b.y+b.height/2);await page.waitForTimeout(800);}
 const o=await page.evaluate(()=>{const ov=[...document.querySelectorAll('vaadin-combo-box-overlay')].pop();return ov?[...ov.querySelectorAll('vaadin-combo-box-item')].map(i=>i.textContent.replace(/\s+/g,' ').trim()):[];});
 out['Статус кредита (combo)']=o; log('COMBO Статус кредита =>',JSON.stringify(o)); await esc();}

writeFileSync('.auth/loan-credit/selopts2.json',JSON.stringify(out,null,2));
log('\nSaved');
await ctx.close();
