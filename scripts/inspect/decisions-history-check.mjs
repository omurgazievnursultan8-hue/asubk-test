// Check whether История (audit) populates for the E5 test record that transitioned Черновик→На рассмотрении.
import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1100}});
const page=ctx.pages()[0]||await ctx.newPage(); const log=(...a)=>console.log(...a);
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
const jsClick=(re)=>page.evaluate((reStr)=>{const re=new RegExp(reStr);for(const b of document.querySelectorAll('vaadin-button')){if(re.test((b.innerText||'').trim())&&!b.disabled){b.click();return (b.innerText||'').trim();}}return null;},re.source||re);
await page.goto(BASE+'gov-decisions',{waitUntil:'networkidle'}); await page.waitForTimeout(2500);
await page.evaluate(()=>{for(const c of document.querySelectorAll('vaadin-grid-cell-content')){if(c.textContent.trim().includes('QA-TEST автотест E5')){c.click();return;}}});
await page.waitForTimeout(700);
log('Просмотр:',await jsClick(/^Просмотр$/)); await page.waitForTimeout(2000);
const tnames=await page.$$eval('vaadin-tab',e=>e.map(x=>x.innerText.trim())); const tabs=await page.$$('vaadin-tab');
const hi=tnames.findIndex(t=>t==='История'); if(hi>=0){await tabs[hi].click(); await page.waitForTimeout(1200);}
log('E5 История rows:',await page.evaluate(()=>{const cells=[...document.querySelectorAll('vaadin-grid-cell-content')].map(c=>c.textContent.trim());return cells;}));
await page.screenshot({path:'.auth/live-verify/e5-history.png',fullPage:true});
await ctx.close();
