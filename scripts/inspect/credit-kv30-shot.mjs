/* КВ-30 · «Классификация» в настоящем браузере: дверь в заголовке карточки (карандаш в
   «Проекте», кнопка ДС после регистрации), подпись основания под изменённым полем и обе
   модалки. Печатает, чем открыта дверь и что показывает карточка. Снимки — .auth/kv30/. */
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url'; import { resolve } from 'path'; import { mkdirSync } from 'fs';
const OUT = '.auth/kv30'; mkdirSync(OUT, { recursive: true });
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
/* Что показывает карточка: чем открыта дверь, какие значения и есть ли подписи основания. */
const card = () => page.evaluate(() => {
  const h = [...document.querySelectorAll('.section-h')].find(e => e.textContent.trim().startsWith('Классификация'));
  if (!h) return null;
  const box = h.parentElement, btn = h.querySelector('button');
  return { door: btn ? (btn.textContent.trim() || 'карандаш') : 'нет',
           disabled: btn ? /not-allowed/.test(btn.style.cursor) : null,
           values: [...box.querySelectorAll('.field .val')].map(v => v.textContent.trim()),
           src: [...box.querySelectorAll('.field .src')].map(v => v.textContent.trim()) };
});
const shot = n => page.screenshot({ path: `${OUT}/${n}.png`, fullPage: false });
const firstCredit = life => page.evaluate(l => (CR.db.credits.find(c => c.lifecycle === l) || {}).id, life);

/* 1) ЖЦ «Проект» — правка напрямую, карандаш. */
const proj = await firstCredit('Проект');
await openDogovor(proj);
console.log('Проект', proj, JSON.stringify(await card()));
await shot('proekt-card');
await page.evaluate(() => CR.openClassificationModal()); await page.waitForTimeout(200);
console.log('модалка правки:', await page.evaluate(() => {
  const s=[...document.querySelectorAll('.modal select')]; return { селектов:s.length,
    вариантов:s.map(x=>x.options.length), поля:[...document.querySelectorAll('.modal .flabel')].map(x=>x.textContent.trim()) }; }));
await shot('proekt-modal');
await page.evaluate(() => CR.closeModal());

/* 2) Действующий кредит — только доп. соглашением; оформляем ДС и смотрим подпись. */
const act = await firstCredit('Действует');
await openDogovor(act);
console.log('Действует', act, JSON.stringify(await card()));
await page.evaluate(() => CR.openClassificationAgrModal()); await page.waitForTimeout(200);
await shot('deistvuet-modal');
const done = await page.evaluate(() => {
  const c = CR.db.credits.find(x => x.lifecycle === 'Действует');
  const set = CR.programClassification(c);
  const next = set.line.find(v => v !== c.line) || set.line[0];
  document.getElementById('klaNum').value = 'ДС-КЛ-Э1';
  document.getElementById('klaLine').value = next;
  CR.submitClassificationAgr();
  return { next, записей: c.classificationRecords.length, дс: c.agreements.map(a => a.num).slice(-1)[0] };
});
await page.waitForTimeout(250);
console.log('после ДС:', JSON.stringify(done), JSON.stringify(await card()));
await shot('deistvuet-card');

console.log('ошибок консоли:', errs.length, errs.slice(0,3));
await ctx.close();
