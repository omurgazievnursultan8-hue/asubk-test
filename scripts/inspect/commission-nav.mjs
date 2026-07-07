import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/', USER=process.env.OK_USER||'admin', PASS=process.env.OK_PASS||'admin';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1300}});
const page=ctx.pages()[0]||await ctx.newPage();
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]',USER);await page.fill('input[name=password]',PASS);await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loan-application-commissions',{waitUntil:'networkidle'}); await page.waitForTimeout(2500);
// expand all nav groups then list items under "Приложение"
const nav=await page.evaluate(()=>{
  const clean=s=>(s||'').replace(/\s+/g,' ').trim();
  const items=[...document.querySelectorAll('vaadin-side-nav-item, a')].map(a=>clean(a.textContent)).filter(Boolean);
  return items.filter(t=>/Users|Подразделения|Сотрудники подразделения|Освоение|Резерв|Платеж|Список Траншей|LoanLedger/i.test(t)).slice(0,15);
});
console.log('APP GROUP ITEMS:',JSON.stringify(nav));
await ctx.close();
