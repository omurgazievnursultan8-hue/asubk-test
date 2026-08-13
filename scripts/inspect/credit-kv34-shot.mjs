/* КВ-34 · «Прогноз» в настоящем браузере: строка-контекст вместо пяти плиток и четырёх
   плашек, правила — тултипами колонок, счётчик и кнопка — в заголовке секции. Заменяет
   credit-prognoz-shot.mjs, у которого все селекторы (.phead-dims/.info-plate/.gtoolbar)
   мертвы. Здесь же ЕДИНСТВЕННЫЙ способ увидеть досрочку: в демо-базе ни у одного из 60
   кредитов closing ≠ договорной даты, и ветка «раньше договора на N дней» достижима
   только внесением платежа выше графика. Снимки — .auth/kv34/.
     node scripts/inspect/credit-kv34-shot.mjs */
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url'; import { resolve } from 'path'; import { mkdirSync } from 'fs';
const OUT = '.auth/kv34'; mkdirSync(OUT, { recursive: true });
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1680, height: 1400 } });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type()==='error') errs.push('console: '+m.text()); });
await page.goto(pathToFileURL(resolve('mockups/loan-credit/credit.html')).href, { waitUntil:'load' });
await page.waitForTimeout(300);

const open = async (id, scope) => {
  await page.evaluate(i => CR.openDetail(i), id);
  await page.evaluate(() => { const t=[...document.querySelectorAll('.dtab')].find(x=>/^Прогноз$/.test(x.textContent.trim())); t&&t.click(); });
  if (scope !== undefined) { await page.evaluate(s => CR.setCardScope(s), scope); }
  await page.waitForTimeout(250);
};
/* Снимок ровно того, что волна оставила на экране: строка-контекст (две строки), заголовок
   секции со счётчиком, кнопка раскрытия, тултипы колонок, число строк таблицы. Старый
   носитель проверяется на ОТСУТСТВИЕ — если он вернётся, это видно в той же строке. */
const snap = () => page.evaluate(() => {
  /* тело вкладки — ПОСЛЕДНИЙ .panel-wrap карточки: первый занят шапкой кредита, и её
     собственные section-note/section-h попали бы в снимок как чужие */
  const wraps = document.querySelectorAll('#cr-card-body .panel-wrap');
  const root = wraps[wraps.length - 1] || document;
  const note = root.querySelector('.section-note');
  const h2 = [...root.querySelectorAll('.section-h')].find(e => /^Расхождения с графиком/.test(e.textContent.trim()));
  return {
    контекст: (note ? note.innerHTML : '').split('<br>')
      .map(s => s.replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim()),
    заголовок: h2 ? h2.textContent.replace(/\s+/g,' ').trim() : 'НЕТ',
    кнопка: h2 ? [...h2.querySelectorAll('button')].map(b => b.textContent.trim()) : [],
    тултипыКолонок: [...root.querySelectorAll('table.cgrid th[title]')]
      .map(t => t.textContent.trim() + ': ' + t.title.slice(0,54) + '…'),
    строк: [...root.querySelectorAll('table.cgrid tbody tr')]
      .filter(tr => /^№\d+$/.test((tr.children[0]||{}).innerText||'')).length,
    староеЕсть: ['.phead-dims','.info-plate','.gtoolbar'].filter(s => root.querySelector(s)),
  };
});
const shot = n => page.screenshot({ path: `${OUT}/${n}.png`, fullPage: true });

/* 1) Пять состояний вкладки. K-1 обычный · K-3 мировое соглашение + исчерпанный график ·
      K-6b закрыт с хвостом (цены дня быть НЕ должно, хотя в модели она 72,02) ·
      K-7 неосвоенные транши · K-2 графика нет. */
for (const id of ['K-1','K-3','K-6b','K-7','K-2']) {
  await open(id);
  console.log(id, JSON.stringify(await snap(), null, 1));
  await shot(id + '-prognoz');
}

/* 2) Обе области — на K-7 (три транша с графиком; у K-C40 второй транш без расписания,
      и сравнивать было бы нечего): «по кредиту» с колонкой «Транш» и «транш №2» без неё.
      Счётчик и недобор в строке обязаны смениться вместе с областью. */
for (const sc of ['credit', 2]) {
  await open('K-7', sc);
  const s = await snap();
  const trCol = await page.evaluate(() => { const w=document.querySelectorAll('#cr-card-body .panel-wrap');
    return [...(w[w.length-1]||document).querySelectorAll('table.cgrid th')].some(t => t.textContent.trim()==='Транш'); });
  console.log('K-7 область=' + sc, 'колонка «Транш»:', trCol, JSON.stringify(s, null, 1));
  await shot('K-7-' + (sc === 'credit' ? 'po-kreditu' : 'transh-2'));
}

/* 3) Кнопка в заголовке: состав таблицы переключается, СЧЁТЧИК НЕ МЕНЯЕТСЯ — кнопка
      меняет, что видно, а не что посчитано (иначе она читалась бы как фильтр расчёта). */
await open('K-1');
const before = await snap();
await page.evaluate(() => { const b=[...document.querySelectorAll('button')].find(x=>/Показать все позиции/.test(x.textContent)); b&&b.click(); });
await page.waitForTimeout(200);
const after = await snap();
console.log('раскрытие:', JSON.stringify({ было:{ заголовок:before.заголовок, строк:before.строк },
  стало:{ заголовок:after.заголовок, строк:after.строк },
  счётчикТотЖе: before.заголовок.replace(/Только расхождения|Показать все позиции/,'')
             === after.заголовок.replace(/Только расхождения|Показать все позиции/,'') }, null, 1));
await shot('K-1-vse-pozicii');
await page.evaluate(() => { const b=[...document.querySelectorAll('button')].find(x=>/Только расхождения/.test(x.textContent)); b&&b.click(); });
await page.waitForTimeout(200);

/* 4) ДОСРОЧКА — ветка «раньше договора на N дней», в демо-базе иначе недостижимая.
      Платёж 40 000 в тело гасит базу быстрее, хвостовые позиции обнуляются, и закрытие
      уезжает влево от договорной даты (ADR-0074 §1). */
await page.evaluate(() => {
  const c = CR.db.credits.find(x => x.id === 'K-1');
  c.mirror.payments.push({ num: 900, date: '20.07.2026', bindDate: '20.07.2026', amount: 40000,
    currency: 'KGS', rate: null, tranche: 1, reg: 'Импорт ЦК', match: 'Подтверждён ЦК',
    frozen: false, dispute: null, method: 'денежными средствами',
    layers: { principal: 40000, interest: 0, penalty: 0, fees: 0 } });
  CR.openDetail('K-1', 'Прогноз');
});
await page.waitForTimeout(250);
const dos = await snap();
console.log('K-1 после досрочки 40 000:', JSON.stringify(dos, null, 1));
console.log('ветка досрочки видна:', /раньше договора на/.test(dos.контекст.join(' ')));
await shot('K-1-dosrochka');

console.log(errs.length ? 'ОШИБКИ: ' + errs.join(' | ') : 'ошибок консоли нет');
await ctx.close();
