import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1200}});
const page=ctx.pages()[0]||await ctx.newPage();
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loan-programs',{waitUntil:'networkidle',timeout:60000});await page.waitForTimeout(2000);
await page.evaluate(()=>{const b=[...document.querySelectorAll('vaadin-button')].find(b=>/Создать/i.test(b.innerText));b&&b.click();});await page.waitForTimeout(2500);
await page.evaluate(()=>{const t=[...document.querySelectorAll('vaadin-tab')].find(t=>/Предпросмотр/i.test(t.innerText));t&&t.click();});await page.waitForTimeout(1500);
const o=await page.evaluate(()=>{
  const out=[];
  document.querySelectorAll('*').forEach(e=>{
    if(e.childElementCount) return;
    const b=e.getBoundingClientRect(); if(b.width<1||b.top<110) return;
    const t=(e.innerText||'').trim(); if(!t||t.length>80) return;
    const cs=getComputedStyle(e); const fs=parseFloat(cs.fontSize), fw=cs.fontWeight;
    out.push({t,x:Math.round(b.left),y:Math.round(b.top),fs,bold:fw>=600});
  });
  const seen=new Set();
  return out.filter(r=>{const k=r.t+r.x+r.y; if(seen.has(k))return false; seen.add(k); return true;}).sort((a,b)=>a.y-b.y||a.x-b.x);
});
console.log(JSON.stringify(o,null,0));
await ctx.close();
