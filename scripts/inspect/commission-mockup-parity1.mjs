// commission-mockup-parity2 — вторая часть сверки (редактор + диалог «Ваш отзыв»).
// Немутирующая: Да/OK/Удалить не нажимаются.
import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/', USER=process.env.OK_USER||'admin', PASS=process.env.OK_PASS||'admin';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1600,height:1000}});
const page=ctx.pages()[0]||await ctx.newPage();
const log=(...a)=>console.log(...a); const J=o=>JSON.stringify(o);
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]',USER);await page.fill('input[name=password]',PASS);await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
const list = async () => { await page.goto(BASE+'loan-application-commissions',{waitUntil:'networkidle',timeout:60000}); await page.waitForTimeout(3000); };
const overlays = () => page.evaluate(()=>[...document.querySelectorAll('vaadin-dialog-overlay,vaadin-confirm-dialog-overlay')].map(o=>(o.innerText||'').trim().slice(0,60)));
const btnDump = () => page.evaluate(()=>[...document.querySelectorAll('vaadin-button,button')]
  .filter(b=>b.getBoundingClientRect().width>0)
  .map(b=>({t:(b.innerText||'').trim().slice(0,34)||('[icon '+(b.getAttribute('aria-label')||b.getAttribute('theme')||'')+']'), dis:b.hasAttribute('disabled')||!!b.disabled})));

// ---- 0. ФИЛЬТР — по скриншоту + пейджеру через locator ----
await list();
const pagerText = async () => (await page.getByText(/^\d+ строк/).first().innerText().catch(()=>'(?)'));
log('== ФИЛЬТР ==');
log('  до: ' + await pagerText());
await page.locator('vaadin-text-field').first().locator('input').fill('zzz'); await page.waitForTimeout(2500);
log('  «zzz»: ' + await pagerText());
await page.locator('vaadin-text-field').first().locator('input').fill('138'); await page.waitForTimeout(2500);
log('  «138»: ' + await pagerText());
await page.locator('vaadin-text-field').first().locator('input').fill(''); await page.waitForTimeout(2000);
log('  очищено: ' + await pagerText());

// ---- 1. РЕДАКТОР 138 ----
log('\n== РЕДАКТОР 138 ==');
await list();
await page.getByText('Проверка комиссии - 138',{exact:true}).first().click(); await page.waitForTimeout(900);
await page.getByRole('button',{name:'Изменить'}).click(); await page.waitForTimeout(4500);
log('  URL: ' + page.url());
log('  кнопки: ' + J(await btnDump()));
log('  date-picker: ' + await page.locator('vaadin-date-picker').count()
  + ' | select: ' + await page.locator('vaadin-select').count()
  + ' | value-picker: ' + await page.locator('jmix-value-picker,jmix-entity-picker').count()
  + ' | upload: ' + await page.locator('vaadin-upload,input[type=file]').count());
await page.screenshot({path:'.auth/parity-editor-138.png', fullPage:true});

// датапикер «Дата заседания» кликабелен?
const dp = page.locator('vaadin-date-picker').first();
if (await dp.count()) { await dp.click(); await page.waitForTimeout(1500);
  log('  клик по датапикеру → оверлеев: ' + await page.evaluate(()=>document.querySelectorAll('vaadin-date-picker-overlay').length));
  await page.keyboard.press('Escape'); await page.waitForTimeout(800); }

// ---- 2. ДИАЛОГ «Ваш отзыв» ----
log('\n== ДИАЛОГ «Ваш отзыв» ==');
await page.getByRole('button',{name:'Проголосовать'}).click({timeout:15000}).catch(e=>log('  Проголосовать: '+e.message.split('\n')[0]));
await page.waitForTimeout(3000);
log('  оверлеи: ' + J(await overlays()));
log('  контролы: ' + J(await page.evaluate(()=>{
  const ov=[...document.querySelectorAll('vaadin-dialog-overlay')].pop(); if(!ov) return 'НЕТ';
  return { selects:[...ov.querySelectorAll('vaadin-combo-box,vaadin-select')].map(s=>s.tagName.toLowerCase()),
           uploads:ov.querySelectorAll('vaadin-upload,input[type=file]').length,
           btns:[...ov.querySelectorAll('vaadin-button')].map(b=>(b.innerText||'').trim()||'[icon]') };
})));
await page.screenshot({path:'.auth/parity-vote-dialog.png'});
const dsel = page.locator('vaadin-dialog-overlay vaadin-select, vaadin-dialog-overlay vaadin-combo-box').first();
if (await dsel.count()) { await dsel.click(); await page.waitForTimeout(2000);
  log('  опции «Решение»: ' + J(await page.evaluate(()=>[...document.querySelectorAll('vaadin-select-item,vaadin-combo-box-item,vaadin-item')].map(i=>(i.innerText||'').trim()).filter(Boolean))));
  await page.keyboard.press('Escape'); await page.waitForTimeout(1200); }
log('  Escape по диалогу → оверлеев: ' + ((await page.keyboard.press('Escape'), await page.waitForTimeout(1800), (await overlays()).length)));
if ((await overlays()).length) { await page.mouse.click(15,980); await page.waitForTimeout(1500);
  log('  клик по подложке → оверлеев: ' + (await overlays()).length); }

// ---- 3. ПОДТВЕРЖДЕНИЕ (открыть, НЕ подтверждать) ----
log('\n== ПОДТВЕРЖДЕНИЕ (Одобрить → Отмена) ==');
await page.getByRole('button',{name:'Одобрить'}).click({timeout:10000}).catch(e=>log('  Одобрить: '+e.message.split('\n')[0]));
await page.waitForTimeout(2000);
log('  оверлеи: ' + J(await overlays()));
log('  Escape → оверлеев: ' + ((await page.keyboard.press('Escape'), await page.waitForTimeout(1500), (await overlays()).length)));
const cancel = page.locator('vaadin-confirm-dialog-overlay vaadin-button, vaadin-dialog-overlay vaadin-button').filter({hasText:'Отмена'});
if (await cancel.count()) { await cancel.first().click(); await page.waitForTimeout(1500); log('  Отмена → оверлеев: ' + (await overlays()).length); }

// ---- 4. СОЗДАТЬ (открыть, не сохранять) ----
log('\n== СОЗДАТЬ (/new) ==');
await list();
await page.getByRole('button',{name:'Создать'}).click(); await page.waitForTimeout(4000);
log('  URL: ' + page.url());
log('  кнопки: ' + J(await btnDump()));
log('  редактируемых пикеров в шапке: ' + await page.locator('jmix-value-picker,jmix-entity-picker,vaadin-combo-box').count());
await page.screenshot({path:'.auth/parity-create.png', fullPage:true});
await ctx.close();
