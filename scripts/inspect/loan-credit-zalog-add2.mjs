import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const USER=process.env.OK_USER||'admin', PASS=process.env.OK_PASS||'admin';
const id=process.argv[2]||'18';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1100}});
const page=ctx.pages()[0]||await ctx.newPage();
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]',USER);await page.fill('input[name=password]',PASS);await Promise.all([page.waitForNavigation({waitUntil:'networkidle',timeout:60000}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+`loan-credits/${id}`,{waitUntil:'networkidle',timeout:60000});
await page.waitForTimeout(3000);
await page.evaluate(()=>{const t=[...document.querySelectorAll('vaadin-tab')].find(t=>t.innerText.trim()==='Залог');if(t)t.click();});
await page.waitForTimeout(1800);
// real mouse click on «Добавить ▾» center (x~393,y~164 from prior shot)
await page.mouse.click(393,164);
await page.waitForTimeout(1000);
const items=await page.evaluate(()=>{
  const ov=[...document.querySelectorAll('vaadin-menu-bar-overlay, vaadin-context-menu-overlay')].filter(o=>o.getBoundingClientRect().width>0);
  const list=[...document.querySelectorAll('[role=menuitem], vaadin-menu-bar-item, vaadin-context-menu-item')].filter(i=>i.getBoundingClientRect().width>0).map(i=>i.innerText.trim());
  return {overlayCount:ov.length, items:[...new Set(list)]};
});
console.log('OVERLAY/ITEMS:',JSON.stringify(items,null,1));
await page.screenshot({path:'.auth/zalog-add-menu2.png'});
await ctx.close();
