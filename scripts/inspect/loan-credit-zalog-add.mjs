// Inspect the «Добавить ▾» dropdown on Залог tab: menu items + what they open.
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
// menu-bars in the tab toolbar
const mb=await page.evaluate(()=>[...document.querySelectorAll('vaadin-menu-bar')].filter(m=>m.getBoundingClientRect().width>0).map(m=>m.innerText.trim()));
console.log('MENU-BARS:',JSON.stringify(mb));
// click «Добавить»
await page.evaluate(()=>{
  const mbs=[...document.querySelectorAll('vaadin-menu-bar')].filter(m=>m.getBoundingClientRect().width>0);
  const target=mbs.find(m=>m.innerText.includes('Добавить'))||mbs[0];
  const btn=target&&target.shadowRoot?target.shadowRoot.querySelector('vaadin-menu-bar-button'):null;
  (btn||target).click();
});
await page.waitForTimeout(1200);
const items=await page.evaluate(()=>[...document.querySelectorAll('vaadin-menu-bar-item, vaadin-context-menu-item, [role=menuitem]')].filter(i=>i.getBoundingClientRect().width>0).map(i=>i.innerText.trim()));
console.log('DROPDOWN ITEMS:',JSON.stringify(items,null,1));
await page.screenshot({path:'.auth/zalog-add-menu.png'});
console.log('SHOT: .auth/zalog-add-menu.png');
await ctx.close();
