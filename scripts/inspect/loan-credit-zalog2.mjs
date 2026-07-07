// Re-inspect «Залог» toolbar: dump every button with text, aria-label, title, icon.
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
const r=await page.evaluate(()=>{
  // залог grid is inside the active tabsheet; find its enclosing hbox toolbar
  const grid=[...document.querySelectorAll('vaadin-grid')].find(g=>g.getBoundingClientRect().width>0);
  let panel=grid; while(panel && panel.tagName!=='VAADIN-VERTICAL-LAYOUT' && panel.parentElement) panel=panel.parentElement;
  const scope=panel||document;
  const btns=[...scope.querySelectorAll('vaadin-button')].filter(b=>b.getBoundingClientRect().width>0).map(b=>({
    text:b.innerText.trim(),
    aria:b.getAttribute('aria-label')||'',
    title:b.getAttribute('title')||'',
    icon:(b.querySelector('vaadin-icon')?.getAttribute('icon'))||(b.querySelector('iron-icon')?.getAttribute('icon'))||'',
    theme:b.getAttribute('theme')||'',
    disabled:b.disabled||b.hasAttribute('disabled'),
  }));
  return {btns};
});
console.log(JSON.stringify(r.btns,null,2));
await ctx.close();
