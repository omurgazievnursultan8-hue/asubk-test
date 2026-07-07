import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1600,height:1000}});
const page=ctx.pages()[0]||await ctx.newPage();
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle',timeout:60000}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loansCredit',{waitUntil:'networkidle',timeout:60000});
await page.waitForTimeout(3000);
const w=await page.evaluate(()=>{
  const cells=[...document.querySelectorAll('vaadin-grid-cell-content')].slice(0,11);
  const tot=cells.reduce((a,c)=>a+c.getBoundingClientRect().width,0);
  return cells.map(c=>({t:c.textContent.trim().slice(0,14),px:Math.round(c.getBoundingClientRect().width),pct:+(c.getBoundingClientRect().width/tot*100).toFixed(1)}));
});
console.log(JSON.stringify(w,null,0));
const gw=await page.evaluate(()=>Math.round(document.querySelector('vaadin-grid').getBoundingClientRect().width));
console.log('GRID WIDTH px:',gw);
await ctx.close();
