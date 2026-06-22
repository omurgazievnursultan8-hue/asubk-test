import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1100}});
const page=ctx.pages()[0]||await ctx.newPage();
const log=(...a)=>console.log(...a);
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loan-programs',{waitUntil:'networkidle',timeout:60000});await page.waitForTimeout(2000);
await page.evaluate(()=>{const b=[...document.querySelectorAll('vaadin-button')].find(b=>/Создать/i.test(b.innerText));b&&b.click();});await page.waitForTimeout(2500);
await page.evaluate(()=>{const t=[...document.querySelectorAll('vaadin-tab')].find(t=>/Льготн/i.test(t.innerText));t&&t.click();});await page.waitForTimeout(1200);
await page.evaluate(()=>{document.querySelectorAll('vaadin-checkbox').forEach(c=>{if(!c.checked){c.checked=true;c.dispatchEvent(new Event('change',{bubbles:true}));c.dispatchEvent(new Event('checked-changed',{bubbles:true}));}});});
await page.waitForTimeout(1500);

const lbl=(el)=>{const a=el.getAttribute('aria-label');if(a)return a;const l=el.querySelector('label');if(l&&l.innerText.trim())return l.innerText.trim();const lf=el.querySelector('[slot=label]');if(lf&&lf.innerText.trim())return lf.innerText.trim();const t=(el.innerText||'').trim();return t||null;};
log(JSON.stringify(await page.evaluate(()=>{
  const lbl=(el)=>{const a=el.getAttribute('aria-label');if(a)return a;const l=el.querySelector('label');if(l&&l.innerText.trim())return l.innerText.trim();const t=(el.innerText||'').trim();return t.split('\n')[0]||null;};
  return [...document.querySelectorAll('vaadin-checkbox,vaadin-select,vaadin-text-area')].filter(e=>e.getBoundingClientRect().width>0).map(e=>{const r=e.getBoundingClientRect();return {tag:e.tagName.toLowerCase(),y:Math.round(r.top),x:Math.round(r.left),label:lbl(e),placeholder:e.getAttribute('placeholder')};}).sort((a,b)=>a.y-b.y||a.x-b.x);
},)));
// select options for first select
log('SELECT OPTS:',JSON.stringify(await page.evaluate(async()=>{const out=[];const sels=[...document.querySelectorAll('vaadin-select')].filter(e=>e.getBoundingClientRect().width>0);for(const s of sels){s.opened=true;await new Promise(r=>setTimeout(r,300));const o=[...new Set([...document.querySelectorAll('vaadin-select-overlay vaadin-item,vaadin-item')].map(i=>i.innerText.trim()))];s.opened=false;out.push(o);}return out;})));
await ctx.close();
