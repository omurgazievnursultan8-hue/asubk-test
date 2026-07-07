// commission-sverka4 — capture voting/decision dialogs on edit screen (cancel each, no mutation)
import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/', USER=process.env.OK_USER||'admin', PASS=process.env.OK_PASS||'admin';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1700,height:1300}});
const page=ctx.pages()[0]||await ctx.newPage(); const log=(...a)=>console.log(...a);
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]',USER);await page.fill('input[name=password]',PASS);await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loan-application-commissions',{waitUntil:'networkidle',timeout:60000}); await page.waitForTimeout(2500);
await page.getByText('Проверка комиссии - 138',{exact:true}).first().click();
await page.waitForTimeout(800);
await page.getByRole('button',{name:'Изменить'}).click();
await page.waitForTimeout(2800);
log('EDIT URL:',page.url());

async function dumpOverlay(tag){
  const info=await page.evaluate(()=>{
    const ov=[...document.querySelectorAll('vaadin-dialog-overlay,vaadin-confirm-dialog-overlay,vaadin-notification-card')].filter(d=>d.getBoundingClientRect().width>0);
    return ov.map(d=>({
      text:(d.innerText||'').replace(/\s+/g,' ').slice(0,300),
      fields:[...d.querySelectorAll('vaadin-text-field,vaadin-select,vaadin-combo-box,vaadin-date-picker,vaadin-text-area')].map(e=>{const l=e.querySelector('label');return (l&&l.textContent||e.getAttribute('label')||'').trim();}),
      buttons:[...d.querySelectorAll('vaadin-button')].map(b=>b.innerText.trim()).filter(Boolean),
    }));
  });
  log(`\n== ${tag} OVERLAY ==`, JSON.stringify(info));
  await page.screenshot({path:'.auth/commission-dlg-'+tag+'.png'});
}
async function cancel(){
  await page.evaluate(()=>{const b=[...document.querySelectorAll('vaadin-dialog-overlay vaadin-button,vaadin-confirm-dialog-overlay vaadin-button')].find(x=>/Отмена|Отменить|Закрыть|Нет|Cancel/i.test(x.innerText));if(b)b.click();});
  await page.keyboard.press('Escape').catch(()=>{});
  await page.waitForTimeout(800);
}

// Проголосовать (select a member row first)
await page.evaluate(()=>{const c=[...document.querySelectorAll('vaadin-grid-cell-content')].find(x=>/НУРМАНБЕТ/.test(x.innerText));c?.click();});
await page.waitForTimeout(500);
await page.getByRole('button',{name:'Проголосовать'}).click().catch(()=>{});
await page.waitForTimeout(1500);
await dumpOverlay('vote'); await cancel();

// Одобрить
await page.getByRole('button',{name:'Одобрить'}).click().catch(()=>{});
await page.waitForTimeout(1500);
await dumpOverlay('approve'); await cancel();

// Отклонить
await page.getByRole('button',{name:'Отклонить'}).click().catch(()=>{});
await page.waitForTimeout(1500);
await dumpOverlay('reject'); await cancel();

// Запросить доп. информацию
await page.getByRole('button',{name:'Запросить доп. информацию'}).click().catch(()=>{});
await page.waitForTimeout(1500);
await dumpOverlay('moreinfo'); await cancel();

log('\nFINAL URL (should still be edit):',page.url());
await ctx.close();
