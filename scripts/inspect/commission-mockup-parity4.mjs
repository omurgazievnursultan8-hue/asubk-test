// commission-mockup-parity4 — плитки-счётчики, кликабельность плиток,
// иконка «глаз» (почему disabled), кнопка «Просмотр заявки».
import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/', USER=process.env.OK_USER||'admin', PASS=process.env.OK_PASS||'admin';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1600,height:1000}});
const page=ctx.pages()[0]||await ctx.newPage(); const log=(...a)=>console.log(...a); const J=o=>JSON.stringify(o);
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]',USER);await page.fill('input[name=password]',PASS);await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
await page.goto(BASE+'loan-application-commissions',{waitUntil:'networkidle'}); await page.waitForTimeout(3000);

log('== ПЛИТКИ ==');
log(J(await page.evaluate(()=>{
  const cards=[...document.querySelectorAll('div,vaadin-vertical-layout')].filter(d=>{
    const r=d.getBoundingClientRect(); return r.top>250&&r.top<330&&r.width>100&&r.width<300&&/\n/.test((d.innerText||'').trim());});
  return cards.map(c=>({txt:(c.innerText||'').trim().replace(/\n/g,' = '), cur:getComputedStyle(c).cursor,
    hasClick:!!c.onclick, border:getComputedStyle(c).borderColor}));
})));

log('\n== «ГЛАЗ» в Члены комиссии (Просмотр 138) ==');
await page.getByText('Проверка комиссии - 138',{exact:true}).first().click(); await page.waitForTimeout(900);
await page.getByRole('button',{name:'Просмотр',exact:true}).click(); await page.waitForTimeout(4000);
log(J(await page.evaluate(()=>[...document.querySelectorAll('vaadin-button')]
  .filter(b=>!(b.innerText||'').trim()&&b.querySelector('vaadin-icon')&&b.getBoundingClientRect().width>0)
  .map(b=>({icon:b.querySelector('vaadin-icon')?.getAttribute('icon'), dis:b.hasAttribute('disabled'),
            title:b.getAttribute('title')||b.getAttribute('aria-label')||'', y:Math.round(b.getBoundingClientRect().y)})))));
await page.screenshot({path:'.auth/parity-members-eye.png', fullPage:true});

log('\n== «Просмотр заявки» (кнопка в Просмотре) ==');
const urlBefore = page.url();
await page.getByRole('button',{name:'Просмотр заявки'}).click(); await page.waitForTimeout(4000);
log('  URL не меняется: ' + (page.url()===urlBefore));
log('  открытые оверлеи: ' + J(await page.evaluate(()=>[...document.querySelectorAll('vaadin-dialog-overlay')]
  .map(o=>(o.innerText||'').trim().replace(/\n/g,' | ').slice(0,70)))));
await page.screenshot({path:'.auth/parity-view-application.png'});
await ctx.close();
