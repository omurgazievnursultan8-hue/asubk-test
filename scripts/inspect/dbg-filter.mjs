import { chromium } from 'playwright-core';
const BASE = 'https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile', { channel:'chrome', headless:true, ignoreHTTPSErrors:true, viewport:{width:1700,height:1100} });
const page = ctx.pages()[0] || await ctx.newPage();
const log=(...a)=>console.log(...a);
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'gov-decisions',{waitUntil:'networkidle',timeout:60000});
await page.waitForTimeout(2500);
const pager=async()=>{const t=await page.evaluate(()=>{const els=[...document.querySelectorAll('*')].filter(e=>/^\d+\s*стр/i.test((e.textContent||'').trim())&&e.children.length===0);return els.map(e=>e.textContent.trim())[0]||'?';});return t;};
log('pager_initial', await pager());

// open ••• picker, pick Закрыт, Выбрать
await page.evaluate(()=>{const b=document.querySelector('#entity_lookup')||[...document.querySelectorAll('vaadin-button')].find(x=>{const ic=x.querySelector('vaadin-icon');return ic&&/ellipsis|dots/i.test(ic.getAttribute('icon')||'');});b&&b.click();});
await page.waitForTimeout(1500);
await page.evaluate(()=>{const ov=[...document.querySelectorAll('vaadin-dialog-overlay')].pop();const c=[...ov.querySelectorAll('vaadin-grid-cell-content')].find(x=>x.textContent.trim()==='Закрыт');c&&c.click();});
await page.waitForTimeout(400);
await page.evaluate(()=>{const ov=[...document.querySelectorAll('vaadin-dialog-overlay')].pop();const b=[...ov.querySelectorAll('vaadin-button')].find(x=>/Выбрать/.test(x.innerText));b&&b.click();});
await page.waitForTimeout(2000);
log('=== after Выбрать, NO Обновить ===');
log('pager_afterSelect', await pager());
const firstStatus = await page.evaluate(()=>{const t=[...document.querySelectorAll('vaadin-grid-cell-content')].map(c=>c.textContent.trim());return t[9]||'?';}); // row0 col2
log('firstRowStatus_afterSelect', firstStatus);
await page.screenshot({path:'.auth/live-autoapply.png'});
await ctx.close();
