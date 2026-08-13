/* КВ-31 · «Классификация»: изменение ≠ корректировка, в настоящем браузере. Проверяет две
   двери в заголовке карточки после регистрации («Изменить» и «Исправить»), выбор вида
   основания в модалке изменения и корректировку без документа — с пометкой «✎ исправлено»
   под полем. Снимки — .auth/kv31/. */
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url'; import { resolve } from 'path'; import { mkdirSync } from 'fs';
const OUT = '.auth/kv31'; mkdirSync(OUT, { recursive: true });
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
           src: [...box.querySelectorAll('.field .src')].map(v => v.textContent.trim()) };
});
const shot = n => page.screenshot({ path: `${OUT}/${n}.png`, fullPage: false });

/* Действующий кредит: обе двери на месте. */
const act = await page.evaluate(() => (CR.db.credits.find(c => c.lifecycle === 'Действует') || {}).id);
await openDogovor(act);
console.log('Действует', act, JSON.stringify(await card()));
await shot('deistvuet-card');

/* 1) Изменение по документу: вид основания переключается, чужой документ берётся ссылкой. */
await page.evaluate(() => CR.openClassificationAgrModal()); await page.waitForTimeout(200);
console.log('модалка изменения:', await page.evaluate(() => {
  const k = document.getElementById('klaKind');
  return { виды:[...k.options].map(o=>o.textContent), полей:document.querySelectorAll('.modal .flabel').length }; }));
await shot('izmenenie-modal');
console.log('после переключения на «Решение суда»:', await page.evaluate(() => {
  const k = document.getElementById('klaKind'); k.value='court'; CR.clsBasisChanged();
  const ref = document.getElementById('klaRef');
  return { дсПоля:document.getElementById('klaAgrFields').style.display,
           ссылка:document.getElementById('klaRefField').style.display,
           вариант:ref.options[0] && ref.options[0].textContent, отключено:ref.disabled }; }));
await page.evaluate(() => CR.closeModal());

/* 2) Корректировка: ни даты, ни документа — только примечание и верные значения. */
await page.evaluate(() => CR.openClassificationFixModal()); await page.waitForTimeout(200);
console.log('модалка корректировки:', await page.evaluate(() => ({
  поля:[...document.querySelectorAll('.modal .flabel')].map(x=>x.textContent.trim()),
  цели:[...document.querySelectorAll('.modal .cat-expand .row')].map(r=>r.textContent.trim().replace(/\s+/g,' ')) })));
await shot('korrektirovka-modal');
const fixed = await page.evaluate(() => {
  const c = CR.db.credits.find(x => x.lifecycle === 'Действует');
  const set = CR.programClassification(c);
  const right = set.fundingSource.find(v => v !== c.fundingSource) || set.fundingSource[0];
  document.getElementById('klfNote').value = 'п. 1.2 кредитного договора';
  document.getElementById('klfFundingSource').value = right;
  CR.submitClassificationFix();
  return { right, записей:c.classificationRecords.length, дс:c.agreements.length,
           журнал:c.audit[c.audit.length-1].what };
});
await page.waitForTimeout(250);
console.log('после корректировки:', JSON.stringify(fixed), JSON.stringify(await card()));
await shot('posle-korrektirovki');

/* 3) Отказ без примечания говорит вслух (§0.3). */
await page.evaluate(() => CR.openClassificationFixModal()); await page.waitForTimeout(200);
const refusal = await page.evaluate(() => {
  const c = CR.db.credits.find(x => x.lifecycle === 'Действует');
  const set = CR.programClassification(c);
  document.getElementById('klfKind').value = set.kind.find(v => v !== CR.classificationAt(c, CR.TODAY).kind) || set.kind[0];
  CR.submitClassificationFix();
  const box = document.getElementById('modalErr');
  return box ? box.textContent.trim().slice(0,140) : 'ОТКАЗ НЕ ПОКАЗАН';
});
console.log('без примечания:', refusal);
await shot('otkaz-bez-primechaniya');
await page.evaluate(() => CR.closeModal());

console.log('ошибок консоли:', errs.length, errs.slice(0,3));
await ctx.close();
