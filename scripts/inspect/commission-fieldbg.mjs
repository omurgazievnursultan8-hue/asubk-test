// probe field backgrounds/borders in readonly detail vs editor
import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/', USER=process.env.OK_USER||'admin', PASS=process.env.OK_PASS||'admin';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1300}});
const page=ctx.pages()[0]||await ctx.newPage(); const log=(...a)=>console.log(...a); const J=o=>JSON.stringify(o);
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]',USER);await page.fill('input[name=password]',PASS);await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}

function probe(){
  const clean=s=>(s||'').replace(/\s+/g,' ').trim();
  const out=[];
  for(const e of document.querySelectorAll('vaadin-text-field,vaadin-select,vaadin-date-picker,vaadin-text-area')){
    const lbl=clean(e.querySelector('label')?.textContent||e.getAttribute('label'));
    if(!lbl)continue;
    // the actual visible box is the ::part(input-field) inner div
    const box=e.shadowRoot?.querySelector('[part="input-field"]');
    const cs=box?getComputedStyle(box):getComputedStyle(e);
    out.push({lbl,bg:cs.backgroundColor,bord:cs.borderTopWidth+' '+cs.borderTopStyle+' '+cs.borderTopColor});
  }
  return out;
}

// DETAIL readonly 138
await page.goto(BASE+'loan-application-commissions',{waitUntil:'networkidle'}); await page.waitForTimeout(2500);
await page.getByText('Проверка комиссии - 138',{exact:true}).first().click(); await page.waitForTimeout(700);
await page.getByRole('button',{name:'Просмотр'}).click(); await page.waitForTimeout(2500);
log('DETAIL(readonly) URL:',page.url());
log(J(await page.evaluate(probe)));

// EDITOR 138
await page.goto(BASE+'loan-application-commissions',{waitUntil:'networkidle'}); await page.waitForTimeout(2500);
await page.getByText('Проверка комиссии - 138',{exact:true}).first().click(); await page.waitForTimeout(700);
await page.getByRole('button',{name:'Изменить'}).click(); await page.waitForTimeout(3000);
log('\nEDITOR URL:',page.url());
log(J(await page.evaluate(probe)));
await ctx.close();
