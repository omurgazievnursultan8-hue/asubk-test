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

const labelOf=(el)=>{};
const dump=()=>page.evaluate(()=>{
  const labelOf=(el)=>{let lab=null,node=el;for(let up=0;up<4&&node;up++){node=node.parentElement;if(!node)break;for(const c of node.children){if(c===el||c.contains(el))continue;const t=(c.innerText||'').replace(/\s+/g,' ').trim();if(t&&t.length<70&&!/^\*$/.test(t)){lab=t;break;}}if(lab)break;}return lab;};
  const TAGS=['vaadin-text-field','vaadin-text-area','vaadin-big-decimal-field','vaadin-number-field','vaadin-integer-field','jmix-value-picker','vaadin-multi-select-combo-box','vaadin-select','vaadin-checkbox','vaadin-combo-box','vaadin-date-picker'];
  const fields=[...document.querySelectorAll(TAGS.join(','))].filter(e=>e.getBoundingClientRect().width>0).map(el=>{const r=el.getBoundingClientRect();return {tag:el.tagName.toLowerCase(),label:labelOf(el),x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)};}).sort((a,b)=>a.y-b.y||a.x-b.x);
  const headers=[];document.querySelectorAll('*').forEach(e=>{if(e.childElementCount)return;const b=e.getBoundingClientRect();if(b.width<1||b.top<120)return;const fs=parseFloat(getComputedStyle(e).fontSize),fw=getComputedStyle(e).fontWeight;const t=(e.innerText||'').trim();if(t&&t.length<45&&fs>=15&&fw>=600)headers.push({t,x:Math.round(b.left),y:Math.round(b.top),fs});});
  return {fields,headers};
});
log('BEFORE CHECK:',JSON.stringify(await dump()));
// click checkbox
await page.evaluate(()=>{const c=document.querySelector('vaadin-checkbox');if(c){const i=c.shadowRoot?.querySelector('input');(i||c).click();}});
await page.waitForTimeout(1800);
const checked=await page.evaluate(()=>{const c=document.querySelector('vaadin-checkbox');return {checked:c?.checked, aria:c?.getAttribute('aria-checked')};});
log('CHECKBOX STATE:',JSON.stringify(checked));
log('AFTER CHECK:',JSON.stringify(await dump()));
await page.screenshot({path:'.auth/t3-float-on.png',fullPage:true});
await ctx.close();
