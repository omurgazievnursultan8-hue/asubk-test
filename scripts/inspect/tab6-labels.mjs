import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1100}});
const page=ctx.pages()[0]||await ctx.newPage();
const log=(...a)=>console.log(...a);
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loan-programs',{waitUntil:'networkidle',timeout:60000});await page.waitForTimeout(2000);
await page.evaluate(()=>{const b=[...document.querySelectorAll('vaadin-button')].find(b=>/Создать/i.test(b.innerText));b&&b.click();});await page.waitForTimeout(2500);
await page.evaluate(()=>{const t=[...document.querySelectorAll('vaadin-tab')].find(t=>/Платеж|Расч[её]т/i.test(t.innerText));t&&t.click();});await page.waitForTimeout(1500);

const out=await page.evaluate(()=>{
  const TAGS=['vaadin-text-field','vaadin-text-area','vaadin-big-decimal-field','vaadin-number-field','vaadin-integer-field','jmix-value-picker','vaadin-select','vaadin-checkbox','vaadin-combo-box','vaadin-date-picker','vaadin-multi-select-combo-box'];
  return [...document.querySelectorAll(TAGS.join(','))].filter(e=>e.getBoundingClientRect().width>0).map(el=>{
    const r=el.getBoundingClientRect();
    const lbl=el.label||el.getAttribute('label')||el.querySelector('label')?.innerText?.trim()||el.shadowRoot?.querySelector('[part=label],label')?.innerText?.trim()||null;
    let val=null;const tg=el.tagName.toLowerCase();
    if(tg==='vaadin-select')val=el.shadowRoot?.querySelector('vaadin-select-value-button')?.innerText?.trim()||el.value;
    const req=el.required||el.hasAttribute('required')||null;
    return {tag:tg,label:lbl,x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),val,req};
  }).sort((a,b)=>a.y-b.y||a.x-b.x);
});
log(JSON.stringify(out,null,1));
// select option lists via opening each
log('===OPTIONS===');
const sels=await page.$$('vaadin-select');
for(let i=0;i<sels.length;i++){
  const visible=await sels[i].evaluate(e=>e.getBoundingClientRect().width>0);if(!visible)continue;
  const lbl=await sels[i].evaluate(e=>e.label||null);
  const opts=await sels[i].evaluate(e=>{const items=e._menuElement?.items||e.shadowRoot?.querySelector('vaadin-select-overlay');return (e.items||[]).map(x=>x.label||x.value);});
  log(lbl, JSON.stringify(opts));
}
await ctx.close();
