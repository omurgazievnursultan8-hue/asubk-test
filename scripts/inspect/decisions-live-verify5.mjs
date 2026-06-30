// Live verify v5: take the QA-TEST draft → Отправить (R7 →На рассмотрении) →
// Отклонить to capture R2 reason dialog (cancel). Also re-check toolbar gating at На рассмотрении.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const BASE='https://fkftest.okmot.kg/'; const SHOT='.auth/live-verify'; mkdirSync(SHOT,{recursive:true});
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1100}});
const page=ctx.pages()[0]||await ctx.newPage(); const log=(...a)=>console.log(...a);
const dialogs=[]; page.on('dialog',async d=>{dialogs.push(d.message());log('NATIVE DIALOG:',d.message().slice(0,160));await d.dismiss();});
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
const jsClick=(re)=>page.evaluate((reStr)=>{const re=new RegExp(reStr);for(const b of document.querySelectorAll('vaadin-button')){if(re.test((b.innerText||'').trim())&&!b.disabled){b.click();return (b.innerText||'').trim();}}return null;},re.source||re);
const toolbar=()=>page.evaluate(()=>[...document.querySelectorAll('vaadin-button')].filter(b=>b.getBoundingClientRect().width>0).map(b=>({t:(b.innerText||'').trim(),d:b.disabled===true})).filter(b=>b.t&&b.t!=='Выйти'));
// select the row containing a substring (clicks its Статус-area cell to select row)
const selectRowByText=(needle)=>page.evaluate((needle)=>{for(const c of document.querySelectorAll('vaadin-grid-cell-content')){if(c.textContent.trim().includes(needle)){c.click();return c.textContent.trim();}}return null;},needle);
const dlgInfo=()=>page.evaluate(()=>{const ov=[...document.querySelectorAll('vaadin-dialog-overlay')].pop(); if(!ov)return null; return {text:ov.innerText.replace(/\s+/g,' ').slice(0,200), hasReason:!!ov.querySelector('vaadin-text-area,vaadin-text-field'), reasonRequired:!!ov.querySelector('vaadin-text-area[required],vaadin-text-field[required]'), buttons:[...ov.querySelectorAll('vaadin-button')].map(b=>({t:b.innerText.trim(),d:b.disabled===true}))};});

const TARGET='QA-TEST автотест '+(process.env.STAMP||'E5');
await page.goto(BASE+'gov-decisions',{waitUntil:'networkidle'}); await page.waitForTimeout(2500);
log('select:',await selectRowByText(TARGET)); await page.waitForTimeout(700);
log('toolbar@Черновик:',JSON.stringify(await toolbar()));

// R7: Отправить → На рассмотрении
log('\nclick Отправить:',await jsClick(/^Отправить$/)); await page.waitForTimeout(1500);
let d=await dlgInfo(); if(d){log('Отправить dialog:',JSON.stringify(d)); // confirm if there is a confirm
  await jsClick(/Отправить|Подтвердить|^ОК$|^OK$|^Да$/); await page.waitForTimeout(1500);}
log('notif:',await page.evaluate(()=>[...document.querySelectorAll('vaadin-notification-card')].map(n=>n.innerText.trim()).filter(Boolean)));
await page.goto(BASE+'gov-decisions',{waitUntil:'networkidle'}); await page.waitForTimeout(2000);
const rowctx=await page.evaluate((t)=>{const cells=[...document.querySelectorAll('vaadin-grid-cell-content')].map(c=>c.textContent.trim());const i=cells.findIndex(x=>x.includes(t));return i<0?null:cells.slice(Math.max(0,i-3),i+6);},TARGET);
log('row after Отправить (status?):',JSON.stringify(rowctx));

// R2: select again, click Отклонить → reason dialog
log('\nselect again:',await selectRowByText(TARGET)); await page.waitForTimeout(700);
log('toolbar now:',JSON.stringify(await toolbar()));
log('click Отклонить:',await jsClick(/^Отклонить$/)); await page.waitForTimeout(1500);
const rej=await dlgInfo(); log('REJECT DIALOG (R2):',JSON.stringify(rej));
await page.screenshot({path:`${SHOT}/v5-reject-dialog.png`,fullPage:true});
// confirm-disabled-when-empty check
if(rej&&rej.hasReason){
  const confBefore=await page.evaluate(()=>{const ov=[...document.querySelectorAll('vaadin-dialog-overlay')].pop();const b=[...ov.querySelectorAll('vaadin-button')].find(x=>/Отклонить|Подтвердить|^ОК$|^OK$/.test(x.innerText.trim()));return b?b.disabled:null;});
  log('confirm disabled when reason empty:',confBefore);
}
await jsClick(/^Отмена$|Cancel|Закрыть/); // DO NOT commit reject
await ctx.close(); log('\nDONE v5. native dialogs:',JSON.stringify(dialogs));
