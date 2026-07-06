// Screenshot mockup dialogs: picker (Вид кредита), tranche form, payment form, calendar.
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url';
import { resolve } from 'path';
const ctx = await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1600,height:1000}});
const page = ctx.pages()[0]||await ctx.newPage();
const url = pathToFileURL(resolve('mockups/loan-credit/loan-credit.html')).href;
const errs=[]; page.on('console',m=>{if(m.type()==='error')errs.push(m.text());}); page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.goto(url,{waitUntil:'load'}); await page.waitForTimeout(300);
await page.click('#listBody tr:nth-child(10)'); await page.click('#btnEdit'); await page.waitForTimeout(300);

// tab0: open «Вид кредита» picker (first ••• button)
await page.evaluate(()=>window.switchTab(0)); await page.waitForTimeout(200);
await page.click('#dpanel-0 .lookup[data-key="Вид кредита"] .pick'); await page.waitForTimeout(300);
await page.screenshot({path:'.auth/loan-credit/MOCK-picker.png'});
// select a row + verify Выбрать enables
await page.click('#modalHost .eb-grid tbody tr:nth-child(3)'); await page.waitForTimeout(150);
await page.screenshot({path:'.auth/loan-credit/MOCK-picker-sel.png'});
await page.click('#ebPick'); await page.waitForTimeout(200); // applies value
await page.screenshot({path:'.auth/loan-credit/MOCK-picker-applied.png'});

// Куратор picker (multi-col Субъекты)
await page.click('#dpanel-0 .lookup[data-key="Куратор"] .pick'); await page.waitForTimeout(300);
await page.screenshot({path:'.auth/loan-credit/MOCK-picker-kurator.png'});
await page.evaluate(()=>window.closeModal());

// tranche form
await page.evaluate(()=>window.switchTab(5)); await page.waitForTimeout(200);
await page.click('#dpanel-5 .gtoolbar button'); await page.waitForTimeout(300);
await page.screenshot({path:'.auth/loan-credit/MOCK-tranche.png'});
await page.evaluate(()=>window.closeModal());

// payment form
await page.evaluate(()=>window.switchTab(7)); await page.waitForTimeout(200);
await page.click('#dpanel-7 .gtoolbar button'); await page.waitForTimeout(300);
await page.screenshot({path:'.auth/loan-credit/MOCK-payment.png'});
await page.evaluate(()=>window.closeModal());

// calendar on Детальный расчет
await page.evaluate(()=>window.switchTab(9)); await page.waitForTimeout(200);
await page.click('#dpanel-9 .control.grey input[readonly]'); await page.waitForTimeout(300);
await page.screenshot({path:'.auth/loan-credit/MOCK-calendar.png'});

console.log('ERRORS:', errs.length?errs.join(' | '):'none');
await ctx.close();
