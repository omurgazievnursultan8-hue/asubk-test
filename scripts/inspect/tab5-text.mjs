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
// all visible text leaf nodes in panel area
log(JSON.stringify(await page.evaluate(()=>{
  const out=[];
  document.querySelectorAll('*').forEach(e=>{
    if(e.childElementCount)return;
    const t=(e.textContent||'').trim();
    if(!t||t.length>80)return;
    const r=e.getBoundingClientRect();
    if(r.width<1||r.top<130)return;
    out.push({t,x:Math.round(r.left),y:Math.round(r.top),fs:Math.round(parseFloat(getComputedStyle(e).fontSize))});
  });
  return [...new Map(out.map(o=>[o.t+o.x+o.y,o])).values()].sort((a,b)=>a.y-b.y||a.x-b.x);
},null)));
// open select via clicking value button to read overlay items
log('OPTS:',JSON.stringify(await page.evaluate(async()=>{
  const s=[...document.querySelectorAll('vaadin-select')].find(e=>e.getBoundingClientRect().width>0);
  if(!s)return null;
  const btn=s.shadowRoot?.querySelector('vaadin-select-value-button')||s.querySelector('vaadin-select-value-button');
  btn&&btn.click();
  await new Promise(r=>setTimeout(r,500));
  return [...document.querySelectorAll('vaadin-select-overlay vaadin-item,vaadin-item,vaadin-select-item')].map(i=>i.textContent.trim()).filter(Boolean);
})));
await ctx.close();
