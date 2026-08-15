// «Состав» и «График» под реструктуризацию (КВ-26; вкладка пересобрана КВ-33, переименована
// КВ-35, тело уведено на «Расчёты» КВ-36).
// K-1 — обычный кредит: колонок статей в графике нет, а журнал «Освоение и переносы» на
// «Составе» есть и состоит из одних освоений — с КВ-33 секция стоит всегда, отдельной
// таблицы «Освоение» больше нет. K-7 — два применённых ДС и третье в хвосте «Условий»:
// производные транши с происхождением, статьи в графике, сверка ИР-2′, кнопка «Применить ДС».
// Волна 14.08.2026 п. 8 сняла таблицу тела и с «Расчётов» — ИР-3 остаётся моделью, но на
// карточке не показывается; переносы по ДС видны журналом «Состава».
//   node scripts/inspect/credit-transhi-grafik-shot.mjs
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url';
import { resolve } from 'path';
import { mkdirSync } from 'fs';

const OUT = '.auth/kv26';
mkdirSync(OUT, { recursive: true });

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1680, height: 1500 },
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

await page.goto(pathToFileURL(resolve('mockups/loan-credit/credit.html')).href, { waitUntil: 'load' });
await page.waitForTimeout(300);

const openTab = async (id, tab) => {
  await page.evaluate(i => CR.openDetail(i), id);
  await page.evaluate(t => { const x=[...document.querySelectorAll('.dtab')].find(e=>e.textContent.trim()===t); x&&x.click(); }, tab);
  await page.waitForTimeout(250);
};
const text = () => page.evaluate(() => (document.querySelector('#detailBody')||document.body).innerText);
const shot = n => page.screenshot({ path: `${OUT}/${n}.png`, fullPage: true });

const report = [];
const say = (k, v) => report.push(`${k}: ${v}`);

// --- K-1: обычный кредит не изменился ---
await openTab('K-1', 'Состав');
let t = await text();
say('K-1 транши · «Происхождение»', /Происхождение/.test(t));
say('K-1 транши · только «освоение»', /освоение/.test(t) && !/разделение по ДС/.test(t));
say('K-1 состав · «Освоение и переносы по кредиту» (КВ-33 — всегда)', /Освоение и переносы по кредиту/.test(t));
say('K-1 состав · тела здесь нет (КВ-36)', !/Остаток тела/.test(t) && /Не освоено/.test(t));
say('K-1 транши · освоение строкой движения, отдельной секции нет',
    /Освоение/.test(t) && !/Плат\. поручение/.test(t));
say('K-1 транши · снятое снято (Состояние · Курс · плитки)',
    !/Состояние/.test(t) && !/Курс/.test(t) && !/Доступно к распределению/.test(t));
await shot('k1-transhi');
await openTab('K-1', 'График');
t = await text();
say('K-1 график · статейных колонок нет', !/Накопл\./.test(t) && !/Прочие/.test(t));
say('K-1 график · плашки ИР-2′ нет', !/ИР-2/.test(t));
await shot('k1-grafik');

// --- K-7: два ДС применены ---
await openTab('K-7', 'Состав');
t = await text();
say('K-7 транши · происхождение «разделение по ДС»', /разделение по ДС/.test(t));
say('K-7 состав · тела здесь нет (КВ-36)', !/Остаток тела/.test(t));
say('K-7 состав · «Освоение и переносы по кредиту»', /Освоение и переносы по кредиту/.test(t));
say('K-7 состав · перенос по ДС в журнале', /Перенос по ДС/.test(t) && /Принято по ДС/.test(t));
say('K-7 транши · производные не в распределении', /в распределение не входят/.test(t));
// строка-контекст вместо плитки «Доступно к распределению» (КВ-33): распределение не уходит
// в минус от производных — при полном разборе договора она так и говорит, а не рисует 0
say('K-7 состав · распределение не в минусе',
    !/−\s*\d/.test((t.match(/Распределено[^\n]*/) || [''])[0]));
await shot('k7-transhi');

/* КВ-36 переехала, волна 14.08.2026 п. 8 сняла: таблицы «Тело по траншам» на «Расчётах»
   больше нет — у 49 кредитов из 60 она вырождалась в строку из трёх чисел, два из которых
   печатал свод, а её «Погашено» (разнесение по позициям) спорило с «Погашено» свода (пул).
   К-7 — кредит с переносами, то есть худший случай снятия: смотрим здесь, что переносы
   остались видны журналом «Состава» (проверено выше), а «Расчёты» держат свод и леджер. */
await openTab('K-7', 'Расчёты');
t = await text();
say('K-7 расчёты · таблицы тела нет', !/Тело по траншам/.test(t) && !/Остаток тела/.test(t));
say('K-7 расчёты · свод называет свою область', /Свод по кредиту на/.test(t));
say('K-7 расчёты · свод статей на месте', /К погашению/.test(t) && /Основной долг/.test(t));
await shot('k7-raschety-svod');

// график производного транша (область — транш 2)
await page.evaluate(() => CR.setCardScope(2));
await page.evaluate(() => { const x=[...document.querySelectorAll('.dtab')].find(e=>e.textContent.trim()==='График'); x&&x.click(); });
await page.waitForTimeout(250);
t = await text();
// «Накопл.» — сокращение, которого в макете нет: SCHED_ARTICLES зовут статьи полностью
// («Накопленные проценты» / «Накопленная пеня» / «Прочее», :3831). Проба сверялась с
// несуществующей строкой и потому молча краснела; сверяем с настоящими ярлыками.
say('K-7 график Т2 · статьи', /Накопленные проценты/.test(t) || /Накопленная пеня/.test(t));
say('K-7 график Т2 · сверка ИР-2′', /ИР-2/.test(t));
say('K-7 график Т2 · основание ДС', /ДС-РС-200/.test(t));
await shot('k7-grafik-transh2');

await page.evaluate(() => CR.setCardScope('credit'));
await page.evaluate(() => { const x=[...document.querySelectorAll('.dtab')].find(e=>e.textContent.trim()==='График'); x&&x.click(); });
await page.waitForTimeout(250);
t = await text();
say('K-7 график «по кредиту» · пометка ДС у строк производного', /ДС-РС-200/.test(t));
await shot('k7-grafik-credit');

// --- хвост «Условий»: кнопка «Применить ДС» ---
await openTab('K-7', 'Условия');
t = await text();
say('K-7 условия · ДС-РС-2003 в хвосте', /ДС-РС-2003/.test(t));
say('K-7 условия · кнопка «Применить ДС»', /Применить ДС/.test(t));
await shot('k7-usloviya-hvost');

const before = await page.evaluate(() => CR.db.credits.find(c => c.id === 'K-7').tranches.length);
const res = await page.evaluate(() => CR.applyDsByNum('ДС-РС-2003'));
await page.waitForTimeout(250);
const after = await page.evaluate(() => CR.db.credits.find(c => c.id === 'K-7').tranches.length);
t = await text();
say('K-7 применение ДС · ok', res.ok === true);
say('K-7 применение ДС · траншей', `${before} → ${after}`);
say('K-7 применение ДС · ДС ушло из хвоста', !/ДС-РС-2003[\s\S]{0,400}Применить ДС/.test(t));
await shot('k7-usloviya-posle');

await openTab('K-7', 'Состав');
await shot('k7-transhi-posle');

console.log(report.join('\n'));
console.log(errs.length ? 'ОШИБКИ:\n' + errs.join('\n') : 'ошибок консоли нет');
await ctx.close();
