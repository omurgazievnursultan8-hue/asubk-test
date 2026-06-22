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
// read select items value+text
const items=await page.evaluate(()=>{const s=document.querySelector('vaadin-select');const list=s?._items||[];return {curVal:s.value, items:[...document.querySelectorAll('vaadin-select vaadin-list-box vaadin-item')].map(i=>({v:i.getAttribute('value'),t:i.innerText.trim()}))};});
log('SELECT ITEMS(before open):',JSON.stringify(items));
// open + capture overlay items
await page.evaluate(()=>{const s=document.querySelector('vaadin-select');if(s)s.opened=true;});
await page.waitForTimeout(800);
const ov=await page.evaluate(()=>[...document.querySelectorAll('vaadin-select-overlay vaadin-item')].map(i=>({v:i.getAttribute('value'),t:i.innerText.trim()})));
log('OVERLAY ITEMS:',JSON.stringify(ov));
// click Диапазон item in overlay
await page.evaluate(()=>{const it=[...document.querySelectorAll('vaadin-select-overlay vaadin-item')].find(i=>/Диапазон/i.test(i.innerText));if(it)it.click();});
await page.waitForTimeout(1500);
const after=await page.evaluate(()=>{
  const labelOf=(el)=>{let lab=null,node=el;for(let up=0;up<4&&node;up++){node=node.parentElement;if(!node)break;for(const c of node.children){if(c===el||c.contains(el))continue;const t=(c.innerText||'').replace(/\s+/g,' ').trim();if(t&&t.length<60&&!/^\*$/.test(t)){lab=t;break;}}if(lab)break;}return lab;};
  const TAGS=['vaadin-text-field','vaadin-big-decimal-field','vaadin-number-field','vaadin-integer-field','vaadin-multi-select-combo-box','vaadin-select','vaadin-checkbox'];
  const sv=document.querySelector('vaadin-select')?.value;
  return {selVal:sv, fields:[...document.querySelectorAll(TAGS.join(','))].filter(e=>e.getBoundingClientRect().width>0).map(el=>{const r=el.getBoundingClientRect();return {tag:el.tagName.toLowerCase(),label:labelOf(el),x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)};}).sort((a,b)=>a.y-b.y||a.x-b.x)};
});
log('AFTER ДИАПАЗОН:',JSON.stringify(after));
await page.screenshot({path:'.auth/t3-range-ok.png',fullPage:true});
await ctx.close();
