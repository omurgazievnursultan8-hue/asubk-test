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
await page.evaluate(()=>{const t=[...document.querySelectorAll('vaadin-tab')].find(t=>/Процентные ставки/i.test(t.innerText));t&&t.click();});
await page.waitForTimeout(1500);
// open multi-select-combo-box (toggle button on right)
const box=await page.evaluate(()=>{const c=document.querySelector('vaadin-multi-select-combo-box');const r=c.getBoundingClientRect();return{x:r.left+r.width-16,y:r.top+r.height/2};});
await page.mouse.click(box.x,box.y); await page.waitForTimeout(1000);
const items=await page.evaluate(()=>{
  const ov=document.querySelectorAll('vaadin-multi-select-combo-box-item,vaadin-combo-box-item');
  return [...ov].map(i=>i.innerText.trim()).filter(Boolean);
});
log('RATE_VALUE_OPTIONS:',JSON.stringify(items));
const ph=await page.evaluate(()=>{const c=document.querySelector('vaadin-multi-select-combo-box');return{placeholder:c.placeholder||null,itemLabelPath:c.itemLabelPath||null};});
log('COMBO_META:',JSON.stringify(ph));
await page.screenshot({path:'.auth/live-tab3-rateopts.png'});
await ctx.close();
