// commission-mockup-parity3 — третья часть сверки:
// диалог «Подтверждение», сохранение по OK, ✕ в лукапе, применение фильтра.
// Мутация ограничена: «Номер протокола» на записи 138 пишется и возвращается обратно.
// «Удалить → Да» НЕ нажимается (деструктивно).
import { chromium } from 'playwright-core';
const BASE='https://fkftest.okmot.kg/', USER=process.env.OK_USER||'admin', PASS=process.env.OK_PASS||'admin';
const ctx=await chromium.launchPersistentContext('.auth/profile',{channel:'chrome',headless:true,ignoreHTTPSErrors:true,viewport:{width:1600,height:1000}});
const page=ctx.pages()[0]||await ctx.newPage();
const log=(...a)=>console.log(...a); const J=o=>JSON.stringify(o);
await page.goto(BASE,{waitUntil:'networkidle',timeout:60000});
if(page.url().includes('/login')){await page.fill('input[name=username]',USER);await page.fill('input[name=password]',PASS);await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}),page.keyboard.press('Enter')]);await page.waitForTimeout(2500);}
const list = async () => { await page.goto(BASE+'loan-application-commissions',{waitUntil:'networkidle',timeout:60000}); await page.waitForTimeout(3000); };
const overlays = () => page.evaluate(()=>[...document.querySelectorAll('vaadin-dialog-overlay,vaadin-confirm-dialog-overlay')].map(o=>(o.innerText||'').trim().replace(/\n/g,' | ').slice(0,80)));

// ---- ФИЛЬТР: применяется ли без Enter / с Enter (скриншотами) ----
log('== ФИЛЬТР ==');
await list();
const inp = page.locator('vaadin-text-field').first().locator('input');
await inp.fill('zzz'); await page.waitForTimeout(3000);
await page.screenshot({path:'.auth/parity-filter-noenter.png', clip:{x:290,y:330,width:1300,height:60}});
await page.keyboard.press('Enter'); await page.waitForTimeout(3000);
await page.screenshot({path:'.auth/parity-filter-enter.png', clip:{x:290,y:330,width:1300,height:60}});
await inp.fill(''); await page.keyboard.press('Enter'); await page.waitForTimeout(2000);
log('  скриншоты: .auth/parity-filter-noenter.png / -enter.png');

// ---- ЛУКАП: ✕ при пустом значении ----
log('\n== ЛУКАП ✕ ==');
log(J(await page.evaluate(()=>[...document.querySelectorAll('jmix-value-picker')].map(p=>
  [...p.querySelectorAll('jmix-value-picker-button')].map(b=>({
    aria:b.getAttribute('aria-label')||'', dis:b.hasAttribute('disabled'),
    vis:b.getBoundingClientRect().width>0, icon:b.querySelector('vaadin-icon')?.getAttribute('icon')||''}))))));

// ---- РЕДАКТОР: диалог «Подтверждение» ----
log('\n== ПОДТВЕРЖДЕНИЕ ==');
await list();
await page.getByText('Проверка комиссии - 138',{exact:true}).first().click(); await page.waitForTimeout(900);
await page.getByRole('button',{name:'Изменить'}).click(); await page.waitForTimeout(4500);
await page.getByRole('button',{name:'Одобрить'}).click(); await page.waitForTimeout(2500);
log('  после «Одобрить» оверлеи: ' + J(await overlays()));
log('  кнопки диалога: ' + J(await page.evaluate(()=>{
  const ov=[...document.querySelectorAll('vaadin-confirm-dialog-overlay,vaadin-dialog-overlay')].pop();
  return ov?[...ov.querySelectorAll('vaadin-button')].map(b=>(b.innerText||'').trim()||'[icon]'):'НЕТ';
})));
await page.keyboard.press('Escape'); await page.waitForTimeout(1500);
log('  Escape → оверлеев: ' + (await overlays()).length);
const cancel = page.locator('vaadin-confirm-dialog-overlay, vaadin-dialog-overlay').locator('vaadin-button').filter({hasText:'Отмена'});
if (await cancel.count()) { await cancel.first().click(); await page.waitForTimeout(1500); }
log('  после Отмена оверлеев: ' + (await overlays()).length);

// ---- СОХРАНЕНИЕ по OK (обратимо) ----
log('\n== СОХРАНЕНИЕ по OK («Номер протокола») ==');
const protoField = page.locator('vaadin-text-field').filter({hasText:'Номер протокола'}).locator('input');
const cnt = await protoField.count();
log('  найдено полей «Номер протокола»: ' + cnt);
if (cnt) {
  log('  значение до: ' + J(await protoField.first().inputValue()));
  await protoField.first().fill('ТЕСТ-777'); await page.waitForTimeout(600);
  await page.getByRole('button',{name:'OK',exact:true}).click(); await page.waitForTimeout(4000);
  log('  URL после OK: ' + page.url());
  await page.getByText('Проверка комиссии - 138',{exact:true}).first().click(); await page.waitForTimeout(900);
  await page.getByRole('button',{name:'Изменить'}).click(); await page.waitForTimeout(4500);
  const after = await page.locator('vaadin-text-field').filter({hasText:'Номер протокола'}).locator('input').first().inputValue();
  log('  значение после переоткрытия: ' + J(after) + '  → сохранение ' + (after==='ТЕСТ-777'?'РАБОТАЕТ':'НЕ РАБОТАЕТ'));
  // откат
  await page.locator('vaadin-text-field').filter({hasText:'Номер протокола'}).locator('input').first().fill('');
  await page.getByRole('button',{name:'OK',exact:true}).click(); await page.waitForTimeout(3500);
  log('  откат выполнен');
}

// ---- УДАЛИТЬ: только открыть диалог, подтверждение НЕ нажимать ----
log('\n== УДАЛИТЬ (диалог, без подтверждения) ==');
await list();
await page.getByText('Проверка комиссии - 138',{exact:true}).first().click(); await page.waitForTimeout(900);
await page.getByRole('button',{name:'Удалить'}).click(); await page.waitForTimeout(2500);
log('  оверлеи: ' + J(await overlays()));
const c2 = page.locator('vaadin-confirm-dialog-overlay, vaadin-dialog-overlay').locator('vaadin-button').filter({hasText:/Отмена|Нет/});
if (await c2.count()) { await c2.first().click(); await page.waitForTimeout(1500); }
log('  после Отмена оверлеев: ' + (await overlays()).length);
await ctx.close();
