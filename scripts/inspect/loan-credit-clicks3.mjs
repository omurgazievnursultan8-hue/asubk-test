// Robust capture: all picker dialog rows + all select options + payment-add + date calendar.
// Closes overlays by clicking their «Отмена»/close, falling back to Escape.
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
const out={selects:{},pickers:[],addPayment:null,dateCalendar:null};
const tab=async n=>{const ts=await page.$$('vaadin-tab');for(const t of ts){if((await t.textContent()).trim()===n){await t.click({force:true});await page.waitForTimeout(1000);return;}}};
async function closeOverlay(){
  // click «Отмена» inside the top overlay
  const clicked=await page.evaluate(()=>{const ov=[...document.querySelectorAll('vaadin-dialog-overlay,vaadin-select-overlay,vaadin-combo-box-overlay,vaadin-date-picker-overlay')].pop();
    if(!ov)return false;const b=[...ov.querySelectorAll('vaadin-button')].find(x=>/Отмена|Cancel/.test(x.textContent));if(b){b.click();return true;}return false;});
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');await page.waitForTimeout(500);
}
function dumpDialog(){return page.evaluate(()=>{const clean=s=>(s||'').replace(/\s+/g,' ').trim();
  const ov=[...document.querySelectorAll('vaadin-dialog-overlay')].pop();if(!ov)return null;
  const title=clean(ov.getAttribute('aria-label')||ov.getAttribute('header-title'));
  const cols=[...ov.querySelectorAll('vaadin-grid-cell-content')].map(c=>clean(c.textContent)).filter(Boolean);
  const btns=[...ov.querySelectorAll('vaadin-button')].map(b=>clean(b.textContent)).filter(Boolean);
  const flds=[...ov.querySelectorAll('vaadin-text-field,vaadin-combo-box,vaadin-date-picker,vaadin-big-decimal-field,vaadin-number-field,vaadin-integer-field,vaadin-select,jmix-value-picker,vaadin-text-area')].map(f=>({l:clean(f.getAttribute('label')),v:clean(f.value||f.querySelector('input')?.value)}));
  return {title,cols,btns,flds};});}

// ---------- SELECT / COMBO options ----------
await tab('Условия кредита');
for(const label of ['Метод погашения кредита','Вид штрафа за просрочку по осн.с.','Вид штрафа за просрочку по процентам']){
  const clicked=await page.evaluate(l=>{const e=[...document.querySelectorAll('vaadin-select')].find(x=>(x.getAttribute('label')||'').trim()===l);if(e){e.querySelector('vaadin-select-value-button')?.click()||e.click();return true;}return false;},label);
  await page.waitForTimeout(700);
  const o=await page.evaluate(()=>{const ov=[...document.querySelectorAll('vaadin-select-overlay')].pop();return ov?[...ov.querySelectorAll('vaadin-item')].map(i=>i.textContent.replace(/\s+/g,' ').trim()):null;});
  out.selects[label]=o;log('SELECT',label,'=>',JSON.stringify(o));await closeOverlay();
}
await tab('Общая информация');
{const clicked=await page.evaluate(()=>{const e=document.querySelector('vaadin-combo-box[label="Статус кредита"]');if(e){e.click();return true;}return false;});
 await page.waitForTimeout(700);
 const o=await page.evaluate(()=>{const ov=[...document.querySelectorAll('vaadin-combo-box-overlay')].pop();return ov?[...ov.querySelectorAll('vaadin-combo-box-item')].map(i=>i.textContent.replace(/\s+/g,' ').trim()):null;});
 out.selects['Статус кредита']=o;log('COMBO Статус кредита =>',JSON.stringify(o));await closeOverlay();}

// ---------- PICKER dialogs (all on tab0) ----------
await tab('Общая информация');
const nPick=await page.$$eval('jmix-value-picker',e=>e.length);
for(let i=0;i<nPick;i++){
  const label=await page.$$eval('jmix-value-picker',(els,i)=>(els[i].getAttribute('label')||'').trim(),i);
  const ok=await page.evaluate(i=>{const p=document.querySelectorAll('jmix-value-picker')[i];const b=p?.querySelector('jmix-value-picker-button');if(b){b.click();return true;}return false;},i);
  await page.waitForTimeout(1500);
  const d=await dumpDialog();
  if(d&&d.cols.length){out.pickers.push({i,label,title:d.title,rows:d.cols,btns:d.btns});log(`PICK#${i} [${label}] "${d.title}" rows=`,d.cols.slice(0,12).join(' | '));}
  else log(`PICK#${i} [${label}]: no rows (${d?d.title:'no overlay'})`);
  await closeOverlay();await page.waitForTimeout(400);
}

// ---------- date-picker calendar ----------
await tab('Общая информация');
{const ok=await page.evaluate(()=>{const dp=document.querySelector('vaadin-date-picker');if(dp){dp.querySelector('[part=toggle-button]')?.click()||dp.click();return true;}return false;});
 await page.waitForTimeout(900);
 const cal=await page.evaluate(()=>{const ov=document.querySelector('vaadin-date-picker-overlay');if(!ov)return null;return {hasCal:!!ov.querySelector('vaadin-month-calendar,[part=months]'),today:!!ov.querySelector('[part=today-button]')};});
 out.dateCalendar=cal;log('DATE CAL:',JSON.stringify(cal));if(cal)await page.screenshot({path:`${OUT}/datecal.png`});await closeOverlay();}

// ---------- Add Payment ----------
await tab('Платеж');
{const ok=await page.evaluate(()=>{const b=[...document.querySelectorAll('vaadin-button')].find(x=>x.textContent.trim()==='Добавить');if(b){b.click();return true;}return false;});
 await page.waitForTimeout(1600);const d=await dumpDialog();out.addPayment=d;await page.screenshot({path:`${OUT}/add-payment.png`});
 log('ADD PAYMENT:',d?d.title:'none','flds=',d?d.flds.map(f=>f.l).join(', '):'');await closeOverlay();}

writeFileSync(`${OUT}/clicks3.json`,JSON.stringify(out,null,2));
log('\nSaved',`${OUT}/clicks3.json`);
await ctx.close();
