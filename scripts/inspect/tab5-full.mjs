import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1100}});
const page=ctx.pages()[0]||await ctx.newPage();
const log=(...a)=>console.log(...a);
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loan-programs',{waitUntil:'networkidle',timeout:60000});await page.waitForTimeout(2000);
await page.evaluate(()=>{const b=[...document.querySelectorAll('vaadin-button')].find(b=>/Создать/i.test(b.innerText));b&&b.click();});await page.waitForTimeout(2500);
// list all tabs first
log('TABS:',JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('vaadin-tab')].map(t=>t.innerText.trim()))));
await page.evaluate(()=>{const t=[...document.querySelectorAll('vaadin-tab')].find(t=>/Льготн/i.test(t.innerText));t&&t.click();});await page.waitForTimeout(1500);

const dump=()=>page.evaluate(()=>{
  const ownLabel=(el)=>el.querySelector('label,[slot=label]')?.innerText?.trim()||(el.innerText||'').split('\n').map(s=>s.trim()).filter(Boolean)[0]||null;
  const TAGS=['vaadin-text-field','vaadin-text-area','vaadin-big-decimal-field','vaadin-number-field','vaadin-integer-field','jmix-value-picker','vaadin-select','vaadin-checkbox','vaadin-combo-box','vaadin-date-picker','vaadin-multi-select-combo-box'];
  const fields=[...document.querySelectorAll(TAGS.join(','))].filter(e=>e.getBoundingClientRect().width>0).map(el=>{const r=el.getBoundingClientRect();let val=null;if(el.tagName.toLowerCase()==='vaadin-select')val=el.shadowRoot?.querySelector('vaadin-select-value-button')?.innerText?.trim()||el.value;const checked=el.tagName.toLowerCase()==='vaadin-checkbox'?el.checked:null;return {tag:el.tagName.toLowerCase(),label:ownLabel(el),x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),val,checked};}).sort((a,b)=>a.y-b.y||a.x-b.x);
  const headers=[];document.querySelectorAll('*').forEach(e=>{if(e.childElementCount)return;const b=e.getBoundingClientRect();if(b.width<1||b.top<120)return;const fs=parseFloat(getComputedStyle(e).fontSize),fw=getComputedStyle(e).fontWeight;const t=(e.innerText||'').trim();if(t&&t.length<60&&fs>=15&&fw>=600)headers.push({t,x:Math.round(b.left),y:Math.round(b.top),fs});});
  return {fields,headers:[...new Map(headers.map(h=>[h.t+h.y,h])).values()]};
});
log('===TAB5 DEFAULT===');log(JSON.stringify(await dump(),null,1));
// toggle every checkbox on, re-dump to reveal conditional fields
await page.evaluate(()=>{document.querySelectorAll('vaadin-checkbox').forEach(c=>{if(!c.checked){c.checked=true;c.dispatchEvent(new Event('change',{bubbles:true}));c.dispatchEvent(new Event('checked-changed',{bubbles:true}));}});});
await page.waitForTimeout(1600);
log('===TAB5 ALL CHECKED===');log(JSON.stringify(await dump(),null,1));
await page.screenshot({path:'.auth/t5-checked.png',fullPage:true});
await ctx.close();
