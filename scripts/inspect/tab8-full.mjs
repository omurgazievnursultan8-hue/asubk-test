import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1100}});
const page=ctx.pages()[0]||await ctx.newPage();
const log=(...a)=>console.log(...a);
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loan-programs',{waitUntil:'networkidle',timeout:60000});await page.waitForTimeout(2000);
await page.evaluate(()=>{const b=[...document.querySelectorAll('vaadin-button')].find(b=>/Создать/i.test(b.innerText));b&&b.click();});await page.waitForTimeout(2500);
const goTab=async()=>{await page.evaluate(()=>{const t=[...document.querySelectorAll('vaadin-tab')].find(t=>/Залогов/i.test(t.innerText));t&&t.click();});await page.waitForTimeout(1500);};
await goTab();

const dump=()=>page.evaluate(()=>{
  const ownLabel=(el)=>el.label||el.getAttribute('label')||el.querySelector('label')?.innerText?.trim()||null;
  const TAGS=['vaadin-text-field','vaadin-text-area','vaadin-big-decimal-field','vaadin-number-field','vaadin-integer-field','jmix-value-picker','vaadin-select','vaadin-checkbox','vaadin-combo-box','vaadin-date-picker','vaadin-multi-select-combo-box'];
  const fields=[...document.querySelectorAll(TAGS.join(','))].filter(e=>e.getBoundingClientRect().width>0).map(el=>{const r=el.getBoundingClientRect();const tg=el.tagName.toLowerCase();let val=null;if(tg==='vaadin-select')val=el.shadowRoot?.querySelector('vaadin-select-value-button')?.innerText?.trim()||el.value;const checked=tg==='vaadin-checkbox'?el.checked:null;const req=el.required||el.hasAttribute('required')||null;return {tag:tg,label:ownLabel(el),x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),val,checked,req};}).sort((a,b)=>a.y-b.y||a.x-b.x);
  const headers=[];document.querySelectorAll('*').forEach(e=>{if(e.childElementCount)return;const b=e.getBoundingClientRect();if(b.width<1||b.top<120)return;const fs=parseFloat(getComputedStyle(e).fontSize),fw=getComputedStyle(e).fontWeight;const t=(e.innerText||'').trim();if(t&&t.length<70&&fs>=15&&fw>=600)headers.push({t,x:Math.round(b.left),y:Math.round(b.top),fs});});
  const grids=[...document.querySelectorAll('vaadin-grid')].filter(g=>g.getBoundingClientRect().width>0).map(g=>{const r=g.getBoundingClientRect();const cols=[...g.querySelectorAll('vaadin-grid-column')].map(c=>c.getAttribute('header')||c.path||'');return {x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),cols};});
  const btns=[...document.querySelectorAll('vaadin-button')].filter(b=>{const r=b.getBoundingClientRect();return r.width>0&&r.top>120;}).map(b=>{const r=b.getBoundingClientRect();return {t:(b.innerText||'').trim()||b.getAttribute('aria-label'),x:Math.round(r.left),y:Math.round(r.top)};});
  const checks=[...document.querySelectorAll('vaadin-checkbox')].filter(c=>c.getBoundingClientRect().width>0).map(c=>({label:(c.innerText||'').trim()||c.getAttribute('aria-label'),checked:c.checked,y:Math.round(c.getBoundingClientRect().top)}));
  return {fields,headers:[...new Map(headers.map(h=>[h.t+h.y,h])).values()],grids,btns,checks};
});
log('TABS:',JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('vaadin-tab')].map(t=>t.innerText.trim()))));
log('===TAB8 DEFAULT===');log(JSON.stringify(await dump(),null,1));
await page.screenshot({path:'.auth/t8-default.png',fullPage:true});
// toggle all checkboxes ON to reveal conditional fields
await page.evaluate(()=>{document.querySelectorAll('vaadin-checkbox').forEach(c=>{if(!c.checked){c.checked=true;c.dispatchEvent(new Event('change',{bubbles:true}));c.dispatchEvent(new Event('checked-changed',{bubbles:true}));}});});
await page.waitForTimeout(1600);
log('===TAB8 ALL CHECKED===');log(JSON.stringify(await dump(),null,1));
await page.screenshot({path:'.auth/t8-checked.png',fullPage:true});
await ctx.close();
