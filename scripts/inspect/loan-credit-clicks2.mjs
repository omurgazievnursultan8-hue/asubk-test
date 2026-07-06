// Capture: (a) select/combo option lists, (b) each jmix-value-picker ••• dialog,
// (c) date-picker calendar, (d) Add-tranche dialog. Screenshots + JSON.
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'fs';
const BASE='https://fkftest.okmot.kg/';
const OUT='.auth/loan-credit/clicks'; mkdirSync(OUT,{recursive:true});
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1600,height:1000}});
const page=ctx.pages()[0]||await ctx.newPage();
const log=(...a)=>console.log(...a);
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle',timeout:60000}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loan-credits/18',{waitUntil:'networkidle',timeout:60000});
await page.waitForTimeout(3000);
const out={selects:{},pickers:[],datePicker:null,addTranche:null};
const tab=async n=>{const ts=await page.$$('vaadin-tab');for(const t of ts){if((await t.textContent()).trim()===n){await t.click({force:true});await page.waitForTimeout(1000);return;}}};
const esc=async()=>{await page.keyboard.press('Escape');await page.waitForTimeout(500);await page.keyboard.press('Escape');await page.waitForTimeout(400);};

// ---------- (a) SELECT options ----------
await tab('Условия кредита');
for(const label of ['Метод погашения кредита','Вид штрафа за просрочку по осн.с.','Вид штрафа за просрочку по процентам']){
  const el=await page.$(`vaadin-select[label="${label}"] vaadin-select-value-button, vaadin-select[label="${label}"]`);
  if(el){await el.click().catch(()=>{});await page.waitForTimeout(700);
    const o=await page.evaluate(()=>{const ov=[...document.querySelectorAll('vaadin-select-overlay')].pop();return ov?[...ov.querySelectorAll('vaadin-item')].map(i=>i.textContent.replace(/\s+/g,' ').trim()):null;});
    out.selects[label]=o; log('SELECT',label,'=>',JSON.stringify(o)); await esc();}
}
await tab('Общая информация');
{ const el=await page.$('vaadin-combo-box[label="Статус кредита"]');
  if(el){await el.click();await page.waitForTimeout(700);
    const o=await page.evaluate(()=>{const ov=[...document.querySelectorAll('vaadin-combo-box-overlay')].pop();return ov?[...ov.querySelectorAll('vaadin-combo-box-item')].map(i=>i.textContent.replace(/\s+/g,' ').trim()):null;});
    out.selects['Статус кредита']=o; log('COMBO Статус кредита =>',JSON.stringify(o)); await esc();}}

// ---------- (b) picker ••• dialogs ----------
function dumpOverlay(){return page.evaluate(()=>{const clean=s=>(s||'').replace(/\s+/g,' ').trim();
  const ov=[...document.querySelectorAll('vaadin-dialog-overlay')].pop();if(!ov)return null;
  const title=clean(ov.getAttribute('header-title')||ov.querySelector('h2,[slot=title]')?.textContent);
  const cols=[...ov.querySelectorAll('vaadin-grid-column,vaadin-grid-sort-column')].map(c=>clean(c.getAttribute('header')||c.getAttribute('path'))).filter(Boolean);
  const cells=[...ov.querySelectorAll('vaadin-grid-cell-content')].map(c=>clean(c.textContent)).filter(Boolean).slice(0,30);
  const btns=[...ov.querySelectorAll('vaadin-button')].map(b=>clean(b.textContent)).filter(Boolean);
  const flds=[...ov.querySelectorAll('vaadin-text-field,vaadin-combo-box,vaadin-date-picker,vaadin-big-decimal-field,vaadin-number-field,vaadin-integer-field,vaadin-select,jmix-value-picker,vaadin-text-area')].map(f=>clean(f.getAttribute('label')));
  return {title,cols,cells,btns,flds};});}

await tab('Общая информация');
// each jmix-value-picker: click its first jmix-value-picker-button (open action)
const nPick=await page.$$eval('jmix-value-picker',els=>els.length);
for(let i=0;i<nPick;i++){
  const label=await page.$$eval('jmix-value-picker',(els,i)=>{const e=els[i];return (e.getAttribute('label')||e.closest('[label]')?.getAttribute('label')||'').trim();},i);
  const btn=await page.evaluateHandle((i)=>{const p=document.querySelectorAll('jmix-value-picker')[i];return p?.querySelector('jmix-value-picker-button');},i);
  const el=btn.asElement();
  if(!el){continue;}
  try{await el.scrollIntoViewIfNeeded();await el.click({timeout:4000});await page.waitForTimeout(1600);
    const d=await dumpOverlay();
    if(d&&(d.cols.length||d.title)){out.pickers.push({i,label,...d});await page.screenshot({path:`${OUT}/pick-${i}.png`});log(`PICK#${i} [${label}]:`,d.title,'|',d.cols.join(', '),'| btns:',d.btns.join(','));}
    else log(`PICK#${i} [${label}]: no dialog`);
    await esc();
  }catch(e){log('pick err',i,e.message);await esc();}
}

// ---------- (c) date-picker calendar (Дата договора) ----------
await tab('Общая информация');
{ const dp=await page.$('vaadin-date-picker');
  if(dp){await dp.click();await page.waitForTimeout(800);
    const has=await page.evaluate(()=>!!document.querySelector('vaadin-date-picker-overlay,vaadin-month-calendar'));
    out.datePicker=has?'calendar overlay opens (month grid, prev/next, today)':'none';
    if(has)await page.screenshot({path:`${OUT}/datepicker.png`}); log('DATEPICKER:',out.datePicker); await esc();}}

// ---------- (d) Add-tranche dialog ----------
await tab('Транши');
{ const btns=await page.$$('vaadin-button');
  for(const b of btns){ if((await b.textContent()).trim()==='Добавить'){ await b.click();await page.waitForTimeout(1600);
    out.addTranche=await dumpOverlay(); await page.screenshot({path:`${OUT}/add-tranche.png`});
    log('ADD TRANCHE:',JSON.stringify(out.addTranche)); await esc(); break; } } }

writeFileSync(`${OUT}/clicks2.json`,JSON.stringify(out,null,2));
log('\nSaved',`${OUT}/clicks2.json`);
await ctx.close();
