import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1600,height:1000}});
const page=ctx.pages()[0]||await ctx.newPage();
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle',timeout:60000}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loansCredit',{waitUntil:'networkidle',timeout:60000});
await page.waitForTimeout(3000);
// full text of all body cells grouped by rows using DOM row index
const data=await page.evaluate(()=>{
  const cells=[...document.querySelectorAll('vaadin-grid-cell-content')];
  // each cell has __gridCell?; group by parent slot index approach: read all non-empty then rely on order
  return cells.map(c=>c.textContent).filter((t,i,arr)=>true);
});
// header is first 11; then rows. print raw first 33
console.log(JSON.stringify(data.slice(0,44)));
await ctx.close();
