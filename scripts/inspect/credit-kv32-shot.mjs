/* КВ-32 · «Классификация» в настоящем браузере: одна дверь — карандаш в заголовке
   карточки, в любом ЖЦ, и прямая правка модалкой (как у реквизитов договора). Проверяет,
   что второй двери и подписей основания под полями больше нет. Снимки — .auth/kv32/. */
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url'; import { resolve } from 'path'; import { mkdirSync } from 'fs';
const OUT = '.auth/kv32'; mkdirSync(OUT, { recursive: true });
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1680, height: 1200 } });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type()==='error') errs.push('console: '+m.text()); });
await page.goto(pathToFileURL(resolve('mockups/loan-credit/credit.html')).href, { waitUntil:'load' });
await page.waitForTimeout(300);

const openDogovor = async id => { await page.evaluate(i => CR.openDetail(i), id);
  await page.evaluate(() => { const x=[...document.querySelectorAll('.dtab')].find(e=>e.textContent.trim()==='Договор'); x&&x.click(); });
  await page.waitForTimeout(250); };
const card = () => page.evaluate(() => {
  const h = [...document.querySelectorAll('.section-h')].find(e => e.textContent.trim().startsWith('Классификация'));
  if (!h) return null;
  const box = h.parentElement;
  return { двери: [...h.querySelectorAll('button')].map(b => b.textContent.trim() || 'карандаш'),
           values: [...box.querySelectorAll('.field .val')].map(v => v.textContent.trim()),
           подписи: [...box.querySelectorAll('.field .src')].map(v => v.textContent.trim()) };
});
const shot = n => page.screenshot({ path: `${OUT}/${n}.png`, fullPage: false });
const firstCredit = life => page.evaluate(l => (CR.db.credits.find(c => c.lifecycle === l) || {}).id, life);

/* 1) «Проект» — карандаш. */
const proj = await firstCredit('Проект');
await openDogovor(proj);
console.log('Проект', proj, JSON.stringify(await card()));
await shot('proekt-card');

/* 2) Действующий кредит — та же одна дверь, тот же карандаш. */
const act = await firstCredit('Действует');
await openDogovor(act);
console.log('Действует', act, JSON.stringify(await card()));
await shot('deistvuet-card');

/* 3) Модалка: четыре поля, три из них — списки набора программы. Ни даты вступления,
   ни основания, ни примечания в форме быть не должно. */
await page.evaluate(() => CR.openClassificationModal()); await page.waitForTimeout(200);
console.log('модалка правки:', await page.evaluate(() => {
  const s=[...document.querySelectorAll('.modal select')];
  return { заголовок:document.querySelector('.modal .section-h, .modal h3')?.textContent.trim().slice(0,40),
           поля:[...document.querySelectorAll('.modal .flabel')].map(x=>x.textContent.trim()),
           селектов:s.length, вариантов:s.map(x=>x.options.length),
           датПолей:document.querySelectorAll('.modal input[type=date]').length }; }));
await shot('modal');

/* 4) Правка проходит: значение легло на поле кредита, запись в журнале одна. */
const saved = await page.evaluate(() => {
  const c = CR.db.credits.find(x => x.lifecycle === 'Действует');
  const set = CR.programClassification(c);
  const next = set.line.find(v => v !== c.line) || set.line[0];
  const before = c.audit.length;
  document.getElementById('klLine').value = next;
  document.getElementById('klPurpose').value = 'Пополнение оборотных средств';
  CR.submitClassification();
  return { next, стало:c.line, записейВЖурнале:c.audit.length-before,
           действие:c.audit[c.audit.length-1].what };
});
await page.waitForTimeout(250);
console.log('после правки:', JSON.stringify(saved), JSON.stringify(await card()));
await shot('posle-pravki');

/* 5) Отказ вслух (§0.3): значение вне набора программы форма не примет молча. */
await page.evaluate(() => CR.openClassificationModal()); await page.waitForTimeout(200);
const refusal = await page.evaluate(() => {
  const sel = document.getElementById('klKind');
  const opt = document.createElement('option'); opt.value = 'Ипотека'; opt.textContent = 'Ипотека';
  sel.appendChild(opt); sel.value = 'Ипотека';
  CR.submitClassification();
  const box = document.getElementById('modalErr');
  return box ? box.textContent.trim().slice(0,120) : 'ОТКАЗ НЕ ПОКАЗАН';
});
console.log('вне набора:', refusal);
await shot('otkaz-vne-nabora');
await page.evaluate(() => CR.closeModal());

console.log('ошибок консоли:', errs.length, errs.slice(0,3));
await ctx.close();
