import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1600,height:1000}});
const page=ctx.pages()[0]||await ctx.newPage();
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]','admin');await page.fill('input[name=password]','admin');await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loansCredit',{waitUntil:'networkidle',timeout:60000});
await page.waitForTimeout(2500);
const out=await page.evaluate(()=>{
  const cells=[...document.querySelectorAll('vaadin-grid-cell-content')].map(c=>c.textContent.trim());
  // header cells are the ones with sort text; grab first ~12 non-empty distinct that look like headers
  const headers=[...document.querySelectorAll('vaadin-grid-sorter')].map(s=>s.textContent.trim()).filter(Boolean);
  const re=/рассмотрени|Одобрен|Отклон|Требует|Подача|Регистрац|Черновик|Закрыт|Действ|Выдан|Погаш|Активн|Просроч/i;
  const statuses=[...new Set(cells.filter(t=>re.test(t)))];
  return {headers, statuses, sampleCells:cells.slice(0,60)};
});
console.log(JSON.stringify(out,null,2));
await ctx.close();
