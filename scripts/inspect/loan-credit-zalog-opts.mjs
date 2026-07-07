// What each «Добавить» menu option opens: «Создать новый…» / «Выбрать существующий…».
// Usage: node loan-credit-zalog-opts.mjs [id] [0|1]   (0=Создать, 1=Выбрать)
import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const USER=process.env.OK_USER||'admin', PASS=process.env.OK_PASS||'admin';
const id=process.argv[2]||'18';
const opt=parseInt(process.argv[3]||'0',10);
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1100}});
const page=ctx.pages()[0]||await ctx.newPage();
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]',USER);await page.fill('input[name=password]',PASS);await Promise.all([page.waitForNavigation({waitUntil:'networkidle',timeout:60000}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+`loan-credits/${id}`,{waitUntil:'networkidle',timeout:60000});
await page.waitForTimeout(3000);
await page.evaluate(()=>{const t=[...document.querySelectorAll('vaadin-tab')].find(t=>t.innerText.trim()==='Залог');if(t)t.click();});
await page.waitForTimeout(1800);
const urlBefore=page.url();
// open «Добавить»
await page.mouse.click(393,164);
await page.waitForTimeout(800);
// click chosen menu item by text
const label=opt===0?'Создать новый залоговый договор':'Выбрать существующий залоговый договор';
await page.evaluate((lbl)=>{const it=[...document.querySelectorAll('[role=menuitem], vaadin-menu-bar-item, vaadin-context-menu-item')].find(i=>i.innerText.trim()===lbl);if(it)it.click();},label);
await page.waitForTimeout(2500);
const res=await page.evaluate(()=>{
  const dlgs=[...document.querySelectorAll('vaadin-dialog-overlay, [role=dialog]')].filter(d=>d.getBoundingClientRect().width>0);
  const dialog=dlgs.map(d=>{
    const title=d.querySelector('h2,.draggable, [slot=title], vaadin-dialog-header, .v-dialog-header')?.innerText
      || d.innerText.split('\n')[0];
    const btns=[...d.querySelectorAll('vaadin-button, button')].filter(b=>b.getBoundingClientRect().width>0).map(b=>b.innerText.trim()).filter(Boolean);
    const fields=[...d.querySelectorAll('vaadin-text-field,vaadin-big-decimal-field,vaadin-number-field,vaadin-integer-field,vaadin-combo-box,vaadin-select,vaadin-date-picker,vaadin-date-time-picker,vaadin-checkbox,jmix-value-picker,vaadin-text-area')].map(f=>({tag:f.tagName.toLowerCase(),label:f.label||f.getAttribute('label')||''}));
    const cols=[...d.querySelectorAll('vaadin-grid-column,vaadin-grid-sort-column')].map(c=>c.getAttribute('header')||c.path||'').filter(Boolean);
    return {titleGuess:title?.slice(0,120), btns, fieldCount:fields.length, fields:fields.slice(0,60), gridCols:cols};
  });
  const notif=[...document.querySelectorAll('vaadin-notification-card')].map(n=>n.innerText.trim());
  return {url:location.href, dialogCount:dlgs.length, dialog, notif, bodyHead:document.querySelector('h2,h1,[class*=title]')?.innerText?.slice(0,80)||''};
});
console.log('OPTION:',label);
console.log('URL_BEFORE:',urlBefore);
console.log(JSON.stringify(res,null,1));
await page.screenshot({path:`.auth/zalog-opt${opt}.png`});
console.log('SHOT: .auth/zalog-opt'+opt+'.png');
await ctx.close();
