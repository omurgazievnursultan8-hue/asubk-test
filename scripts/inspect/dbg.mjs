import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1100}});
const page=ctx.pages()[0]||await ctx.newPage();
await page.goto(BASE,{waitUntil:'domcontentloaded'});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation().catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loan-programs/new',{waitUntil:'networkidle'});await page.waitForTimeout(2500);
const d=await page.evaluate(()=>{const el=document.querySelector('#govDecisionField');return{light:el.innerHTML.slice(0,800),shadow:el.shadowRoot?el.shadowRoot.innerHTML.slice(0,900):null};});
console.log('LIGHT:',d.light);
console.log('SHADOW:',d.shadow);
await ctx.close();
