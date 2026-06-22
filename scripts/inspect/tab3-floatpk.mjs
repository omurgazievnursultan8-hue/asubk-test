import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1100}});
const page=ctx.pages()[0]||await ctx.newPage();
const log=(...a)=>console.log(...a);
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loan-programs',{waitUntil:'networkidle',timeout:60000});await page.waitForTimeout(2000);
await page.evaluate(()=>{const b=[...document.querySelectorAll('vaadin-button')].find(b=>/Создать/i.test(b.innerText));b&&b.click();});await page.waitForTimeout(2500);
await page.evaluate(()=>{const t=[...document.querySelectorAll('vaadin-tab')].find(t=>/Процентные ставки/i.test(t.innerText));t&&t.click();});await page.waitForTimeout(1500);
await page.evaluate(()=>{const c=document.querySelector('vaadin-checkbox');if(c){const i=c.shadowRoot?.querySelector('input');(i||c).click();}});
await page.waitForTimeout(1800);
// inspect picker internal buttons
const btnInfo=await page.evaluate(()=>{
  const p=[...document.querySelectorAll('jmix-value-picker')].filter(e=>e.getBoundingClientRect().top>460)[0];
  const btns=[...(p.querySelectorAll('vaadin-button,*[slot]'))].map(b=>({tag:b.tagName.toLowerCase(),slot:b.getAttribute('slot'),aria:b.getAttribute('aria-label'),txt:(b.innerText||'').trim().slice(0,10)}));
  return {childCount:p.children.length, btns};
});
log('PICKER INTERNALS:',JSON.stringify(btnInfo,null,1));
// click first action button (slot or vaadin-button) inside picker
await page.evaluate(()=>{const p=[...document.querySelectorAll('jmix-value-picker')].filter(e=>e.getBoundingClientRect().top>460)[0];const b=p.querySelector('vaadin-button');if(b)b.click();});
await page.waitForTimeout(1800);
let dlg=await page.evaluate(()=>{const d=document.querySelector('vaadin-dialog-overlay');if(!d)return{open:false};const title=(d.querySelector('[slot=title]')?.innerText||d.innerText.split('\n')[0]||'').trim();const grid=d.querySelector('vaadin-grid');const cells=grid?[...grid.querySelectorAll('vaadin-grid-cell-content')].map(c=>c.innerText.trim()).filter(Boolean).slice(0,30):[];const pager=(d.innerText.match(/\d+\s+строк[аи]?/)||[''])[0];const btns=[...d.querySelectorAll('vaadin-button')].filter(b=>b.getBoundingClientRect().width>0).map(b=>b.innerText.trim()).filter(Boolean);return {open:true,title,pager,cells,btns};});
log('MODAL via vaadin-button:',JSON.stringify(dlg,null,1));
if(!dlg.open){ // try slotted action button click
  await page.evaluate(()=>{const p=[...document.querySelectorAll('jmix-value-picker')].filter(e=>e.getBoundingClientRect().top>460)[0];const b=[...p.querySelectorAll('*')].find(e=>e.getAttribute&&/action|open/i.test(e.getAttribute('slot')||'')|| /•|⋯/.test(e.innerText||''));if(b)b.click();});
  await page.waitForTimeout(1500);
  dlg=await page.evaluate(()=>{const d=document.querySelector('vaadin-dialog-overlay');if(!d)return{open:false};const title=(d.querySelector('[slot=title]')?.innerText||d.innerText.split('\n')[0]||'').trim();const grid=d.querySelector('vaadin-grid');const cells=grid?[...grid.querySelectorAll('vaadin-grid-cell-content')].map(c=>c.innerText.trim()).filter(Boolean).slice(0,30):[];const pager=(d.innerText.match(/\d+\s+строк[аи]?/)||[''])[0];const btns=[...d.querySelectorAll('vaadin-button')].filter(b=>b.getBoundingClientRect().width>0).map(b=>b.innerText.trim()).filter(Boolean);return {open:true,title,pager,cells,btns};});
  log('MODAL via slot:',JSON.stringify(dlg,null,1));
}
await page.screenshot({path:'.auth/t3-floatpk.png',fullPage:true});
await ctx.close();
