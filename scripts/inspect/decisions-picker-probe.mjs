import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1100}});
const page=ctx.pages()[0]||await ctx.newPage(); const log=(...a)=>console.log(...a);
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'gov-decisions/new',{waitUntil:'networkidle'}); await page.waitForTimeout(2500);
// structure of Вид решения picker
log('PICKER HTML:',await page.evaluate(()=>{const p=document.querySelector('jmix-value-picker'); return p?p.outerHTML.slice(0,500):'none';}));
// real click on its button
const pk=page.locator('jmix-value-picker').first();
const btns=await pk.locator('vaadin-button').count(); log('picker buttons:',btns);
try{ await pk.locator('vaadin-button').last().click({timeout:8000,force:true}); }catch(e){log('click err',String(e).slice(0,80));}
await page.waitForTimeout(2000);
log('OVERLAYS:',await page.evaluate(()=>[...document.querySelectorAll('vaadin-dialog-overlay,vaadin-combo-box-overlay,vaadin-context-menu-overlay,vaadin-select-overlay')].map(o=>o.tagName)));
log('OVERLAY content:',await page.evaluate(()=>{const ov=document.querySelector('vaadin-dialog-overlay,vaadin-combo-box-overlay'); if(!ov)return null; return {cols:[...ov.querySelectorAll('vaadin-grid-column,vaadin-grid-sort-column')].map(c=>c.header||c.path).filter(Boolean), cells:[...ov.querySelectorAll('vaadin-grid-cell-content,vaadin-item')].map(c=>c.textContent.trim()).filter(Boolean).slice(0,30), buttons:[...ov.querySelectorAll('vaadin-button')].map(b=>b.innerText.trim())};}));
await page.screenshot({path:'.auth/live-verify/picker-probe.png',fullPage:true});
await ctx.close();
