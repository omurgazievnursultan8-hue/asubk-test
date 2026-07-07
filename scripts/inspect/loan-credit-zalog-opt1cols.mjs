import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const USER=process.env.OK_USER||'admin', PASS=process.env.OK_PASS||'admin';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1900,height:1100}});
const page=ctx.pages()[0]||await ctx.newPage();
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]',USER);await page.fill('input[name=password]',PASS);await Promise.all([page.waitForNavigation({waitUntil:'networkidle',timeout:60000}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loan-credits/18',{waitUntil:'networkidle',timeout:60000});
await page.waitForTimeout(3000);
await page.evaluate(()=>{const t=[...document.querySelectorAll('vaadin-tab')].find(t=>t.innerText.trim()==='Залог');if(t)t.click();});
await page.waitForTimeout(1500);
await page.mouse.click(393,164);
await page.waitForTimeout(700);
await page.evaluate(()=>{const it=[...document.querySelectorAll('[role=menuitem],vaadin-menu-bar-item')].find(i=>i.innerText.trim()==='Выбрать существующий залоговый договор');if(it)it.click();});
await page.waitForTimeout(2500);
const cols=await page.evaluate(()=>{
  const g=[...document.querySelectorAll('vaadin-dialog-overlay vaadin-grid, [role=dialog] vaadin-grid')].find(g=>g.getBoundingClientRect().width>0);
  if(!g) return null;
  // header cells render text in <vaadin-grid-cell-content> slotted; read sorter/text
  return [...g.querySelectorAll('vaadin-grid-sort-column,vaadin-grid-column')].map(c=>c.getAttribute('header')||c.getAttribute('path')||'');
});
// also read visible header text from light DOM slots
const hdr=await page.evaluate(()=>[...document.querySelectorAll('vaadin-grid-cell-content')].map(c=>c.innerText.trim()).filter(Boolean).slice(0,25));
// filter condition labels
const filt=await page.evaluate(()=>[...document.querySelectorAll('vaadin-dialog-overlay [class*=label], [role=dialog] label')].map(l=>l.innerText.trim()).filter(Boolean).slice(0,20));
console.log('COLS(attr):',JSON.stringify(cols));
console.log('HEADER/CELL TEXT:',JSON.stringify(hdr,null,1));
await ctx.close();
