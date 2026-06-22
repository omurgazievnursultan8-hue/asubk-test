import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1100}});
const page=ctx.pages()[0]||await ctx.newPage();
const log=(...a)=>console.log(...a);
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loan-programs',{waitUntil:'networkidle',timeout:60000});await page.waitForTimeout(2000);
await page.evaluate(()=>{const b=[...document.querySelectorAll('vaadin-button')].find(b=>/Создать/i.test(b.innerText));b&&b.click();});await page.waitForTimeout(2500);
await page.evaluate(()=>{const t=[...document.querySelectorAll('vaadin-tab')].find(t=>/Штрафы/i.test(t.innerText));t&&t.click();});await page.waitForTimeout(1500);

const dump=()=>page.evaluate(()=>{
  const ownLabel=(el)=>el.querySelector('label,[slot=label]')?.innerText?.trim()||(el.innerText||'').split('\n').map(s=>s.trim()).filter(Boolean)[0]||null;
  const TAGS=['vaadin-text-field','vaadin-text-area','vaadin-big-decimal-field','vaadin-number-field','vaadin-integer-field','jmix-value-picker','vaadin-select','vaadin-checkbox','vaadin-combo-box'];
  const fields=[...document.querySelectorAll(TAGS.join(','))].filter(e=>e.getBoundingClientRect().width>0).map(el=>{const r=el.getBoundingClientRect();let val=null;if(el.tagName.toLowerCase()==='vaadin-select')val=el.shadowRoot?.querySelector('vaadin-select-value-button')?.innerText?.trim()||el.value;return {tag:el.tagName.toLowerCase(),label:ownLabel(el),x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),val};}).sort((a,b)=>a.y-b.y||a.x-b.x);
  const headers=[];document.querySelectorAll('*').forEach(e=>{if(e.childElementCount)return;const b=e.getBoundingClientRect();if(b.width<1||b.top<120)return;const fs=parseFloat(getComputedStyle(e).fontSize),fw=getComputedStyle(e).fontWeight;const t=(e.innerText||'').trim();if(t&&t.length<55&&fs>=15&&fw>=600)headers.push({t,x:Math.round(b.left),y:Math.round(b.top),fs});});
  // any suffix/static text like «% от суммы кредита»
  const suffixes=[];document.querySelectorAll('span,div,label').forEach(e=>{if(e.childElementCount)return;const t=(e.innerText||'').trim();const r=e.getBoundingClientRect();if(t&&/%|сумм|кредит/i.test(t)&&t.length<40&&r.top>120&&r.width>0)suffixes.push({t,x:Math.round(r.left),y:Math.round(r.top)});});
  return {fields,headers,suffixes:[...new Map(suffixes.map(s=>[s.t+s.y,s])).values()]};
});
log('===TAB4 DEFAULT===');log(JSON.stringify(await dump()));
// select options
log('SELECT OPTS:',JSON.stringify(await page.evaluate(()=>{const s=document.querySelector('vaadin-select');if(!s)return null;s.opened=true;const o=[...new Set([...document.querySelectorAll('vaadin-select-overlay vaadin-item,vaadin-item')].map(i=>i.innerText.trim()))];s.opened=false;return o;})));
await page.screenshot({path:'.auth/t4-default.png',fullPage:true});

// switch BOTH selects to Диапазон
await page.evaluate(()=>{document.querySelectorAll('vaadin-select').forEach(s=>{s.value='2';s.dispatchEvent(new Event('change',{bubbles:true}));});});
await page.waitForTimeout(1600);
log('===TAB4 ДИАПАЗОН===');log(JSON.stringify(await dump()));
await page.screenshot({path:'.auth/t4-range.png',fullPage:true});
await ctx.close();
