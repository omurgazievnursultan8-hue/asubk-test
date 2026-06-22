import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1100}});
const page=ctx.pages()[0]||await ctx.newPage();
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loan-programs',{waitUntil:'networkidle',timeout:60000});await page.waitForTimeout(2000);
await page.evaluate(()=>{const b=[...document.querySelectorAll('vaadin-button')].find(b=>/Создать/i.test(b.innerText));b&&b.click();});await page.waitForTimeout(2500);
const out=await page.evaluate(()=>{
  const r=[];document.querySelectorAll('*').forEach(e=>{if(e.childElementCount)return;const b=e.getBoundingClientRect();if(b.width<1||b.height<1)return;const fw=getComputedStyle(e).fontWeight,fs=parseFloat(getComputedStyle(e).fontSize);const t=(e.innerText||'').trim();if(t&&t.length<40&&fs>=16&&(fw>=600)){r.push({t,x:Math.round(b.left),y:Math.round(b.top),fs,fw});}});return r;
});
console.log(JSON.stringify(out));
await ctx.close();
