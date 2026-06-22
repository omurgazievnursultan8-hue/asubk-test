import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1100}});
const page=ctx.pages()[0]||await ctx.newPage();
const log=(...a)=>console.log(...a);
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loan-programs',{waitUntil:'networkidle',timeout:60000});await page.waitForTimeout(2000);
await page.evaluate(()=>{const b=[...document.querySelectorAll('vaadin-button')].find(b=>/Создать/i.test(b.innerText));b&&b.click();});
await page.waitForTimeout(2500);

// relaxed header scan in current tab panel
const headers=(tag)=>page.evaluate(()=>{const r=[];document.querySelectorAll('*').forEach(e=>{if(e.childElementCount)return;const b=e.getBoundingClientRect();if(b.width<1||b.height<1||b.top<120)return;const fs=parseFloat(getComputedStyle(e).fontSize),fw=getComputedStyle(e).fontWeight;const t=(e.innerText||'').trim();if(t&&t.length<45&&fs>=15&&fw>=600)r.push({t,x:Math.round(b.left),y:Math.round(b.top),fs});});return r;});

// TAB2
await page.evaluate(()=>{const t=[...document.querySelectorAll('vaadin-tab')].find(t=>/Сумма и срок/i.test(t.innerText));t&&t.click();});
await page.waitForTimeout(1500);
log('TAB2 HEADERS:',JSON.stringify(await headers()));

// TAB3
await page.evaluate(()=>{const t=[...document.querySelectorAll('vaadin-tab')].find(t=>/Процентные ставки/i.test(t.innerText));t&&t.click();});
await page.waitForTimeout(1500);
log('TAB3 HEADERS:',JSON.stringify(await headers()));

// TAB3 rate combo: click to open + wait + read items
await page.evaluate(()=>{const m=document.querySelector('vaadin-multi-select-combo-box');if(m){const tf=m.shadowRoot?.querySelector('[part="input-field"]')||m;m.click&&m.click();m.opened=true;}});
await page.waitForTimeout(1500);
const combo=await page.evaluate(()=>{const items=[...document.querySelectorAll('vaadin-multi-select-combo-box-item, vaadin-combo-box-item')].map(i=>i.innerText.trim());const ov=document.querySelector('vaadin-multi-select-combo-box-overlay');return {items, overlayText: ov?ov.innerText.trim().slice(0,120):null};});
log('TAB3 COMBO:',JSON.stringify(combo));
await page.evaluate(()=>{const m=document.querySelector('vaadin-multi-select-combo-box');if(m)m.opened=false;});

// TAB3 switch to Диапазон via overlay item click
await page.evaluate(()=>{const s=document.querySelector('vaadin-select');if(s)s.opened=true;});
await page.waitForTimeout(700);
await page.evaluate(()=>{const it=[...document.querySelectorAll('vaadin-select-overlay vaadin-item,vaadin-item')].find(i=>/Диапазон/i.test(i.innerText));it&&it.click();});
await page.waitForTimeout(1500);
const t3range=await page.evaluate(()=>{
  const labelOf=(el)=>{let lab=null,node=el;for(let up=0;up<4&&node;up++){node=node.parentElement;if(!node)break;for(const c of node.children){if(c===el||c.contains(el))continue;const t=(c.innerText||'').replace(/\s+/g,' ').trim();if(t&&t.length<60&&!/^\*$/.test(t)){lab=t;break;}}if(lab)break;}return lab;};
  const TAGS=['vaadin-text-field','vaadin-big-decimal-field','vaadin-number-field','vaadin-integer-field','vaadin-multi-select-combo-box','vaadin-select','vaadin-checkbox'];
  return [...document.querySelectorAll(TAGS.join(','))].filter(e=>e.getBoundingClientRect().width>0).map(el=>{const r=el.getBoundingClientRect();return {tag:el.tagName.toLowerCase(),label:labelOf(el),x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width)};}).sort((a,b)=>a.y-b.y||a.x-b.x);
});
log('TAB3 ДИАПАЗОН FIELDS:',JSON.stringify(t3range));
await page.screenshot({path:'.auth/t3-range-fixed.png',fullPage:true});
await ctx.close();
