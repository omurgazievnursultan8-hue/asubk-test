// Проверка волны 7 макета классификации (ADR-0246, хранимый результат) в НАСТОЯЩЕМ браузере:
// новые экраны «Ожидают пересчёта», «Журнал ночного прохода», «Периоды и фиксация», карточка
// разбора и фильтр витрины проходятся мышью, сценарий P19-R18 — от ввода факта до закрытия июля.
// Смоук проверяет ту же логику без DOM; здесь ловятся ошибки страницы и мёртвые обработчики.
//   node scripts/inspect/classification-wave7-verify.mjs
import { chromium } from 'playwright-core';

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

const URL = 'file://' + process.cwd() + '/mockups/classification/classification.html';
const out = [];
const say = (n, pass, note) => out.push({ n, pass, note });
const pause = ms => page.waitForTimeout(ms);
const reset = async () => { await page.goto(URL, { waitUntil: 'load' }); await pause(250); };
const nav = async v => { await page.click(`.nav-item[data-v="${v}"]`); await pause(150); };
const text = sel => page.evaluate(s => { const el = document.querySelector(s); return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; }, sel);
const btn = async label => { await page.locator('#panel button', { hasText: label }).first().click(); await pause(200); };
const shot = name => page.screenshot({ path: `.auth/wave7-${name}.png`, fullPage: true });

/* --- P19-R18 мышью: остановленный обработчик, факт задним числом, отказ, разбор, закрытие --- */
await reset();
await nav('wait');
await btn('остановить');
const stopped = /остановлен/.test(await text('#foot'));

await nav('facts');
await page.selectOption('#fCredit', 'КД-2025/088');
await page.selectOption('#fKind', 'f-collDown');
await page.fill('#fWhen', '2026-06-12');
await page.fill('#fDoc', 'протокол КАБК № 19 от 30.06.2026');
await btn('Завести факт');
const badge = await text('#waitCnt');
say('R18·метка', stopped && badge === '1',
  `обработчик остановлен кнопкой, факт F-006 заведён формой; в меню «Ожидают пересчёта» — ${badge || 'пусто'}`);

await nav('wait');
const waitRow = await text('#panel tbody tr');
await shot('wait');
say('R18·очередь', /КД-2025\/088/.test(waitRow) && /01\.07\.2026/.test(waitRow) && /F-006/.test(waitRow),
  `строка очереди: «${waitRow.slice(0, 110)}»`);

await nav('per');
const banner = await text('#panel .banner.warn');
await btn('Закрыть период');
const stillOpen = await page.evaluate(() => CL.openPeriod());
say('R18·отказ', /КД-2025\/088 — ожидает пересчёта с 01\.07\.2026/.test(banner) && stillOpen === '2026-07',
  `баннер: «${banner.slice(0, 120)}»; после нажатия открыт ${stillOpen}`);

await nav('wait');
await btn('запустить');
const cleared = await text('#waitCnt');
await nav('per');
const n0 = await page.evaluate(() => CL.state.intervals.length);
await btn('Закрыть период');
const after = await page.evaluate(() => ({ open: CL.openPeriod(), n: CL.state.intervals.length }));
const julyRow = await page.evaluate(() => {
  const tr = Array.from(document.querySelectorAll('#panel tr')).find(t => /^\s*июль 2026/.test(t.textContent));
  return tr ? tr.textContent.replace(/\s+/g, ' ').trim() : '';
});
await shot('periods');
say('R18·закрыто', cleared === '' && after.open === '2026-08' && after.n === n0 && /закрыт/.test(julyRow),
  `метка разобрана (бейдж пуст), июль закрыт кнопкой, интервалов было ${n0} — стало ${after.n}; строка справочника: «${julyRow.slice(0, 80)}»`);

/* --- Отчёт п. 12: переключение месяцев чипами --- */
await page.locator('#panel .chip', { hasText: 'июнь 2026' }).first().click();
await pause(150);
const june = await text('#panel .card:last-of-type');
say('R20·отчёт', /Отчёт п\. 12 — июнь 2026/.test(await page.evaluate(() => document.getElementById('panel').textContent)) &&
  /просрочка 30 дн|просрочка \d+ дн/.test(await page.evaluate(() => document.getElementById('panel').textContent)),
  `чип «июнь 2026» переключил отчёт; предупреждение о сроке на месте`);

/* --- Витрина: фильтр состояний, срез на закрытую дату, карточка разбора --- */
await reset();
await nav('show');
await page.locator('#panel .chip', { hasText: 'нет данных' }).first().click();
await pause(150);
const rows = await page.evaluate(() => Array.from(document.querySelectorAll('#panel tr.pick')).map(t => t.textContent.replace(/\s+/g, ' ').trim().slice(0, 12)));
say('R13·фильтр', rows.length === 1 && /КД-2026\/012/.test(rows[0]), `фильтр «нет данных» оставил: ${rows.join(', ')}`);

await page.locator('#panel .chip', { hasText: 'все' }).first().click();
await page.selectOption('#asOf', '2026-06-30');
await pause(200);
const r117 = await page.evaluate(() => {
  const tr = Array.from(document.querySelectorAll('#panel tr.pick')).find(t => t.textContent.includes('КД-2024/117'));
  return tr ? tr.textContent.replace(/\s+/g, ' ').trim() : '';
});
say('R21·срез', /Высокий/i.test(r117) && /период закрыт/.test(r117), `на 30.06.2026: «${r117.slice(0, 120)}»`);

await page.selectOption('#asOf', '2026-08-14');
await pause(150);
await page.evaluate(() => CL.annulFact('F-003', 'заведён на другой кредит'));
await page.evaluate(() => CL.render());
await page.locator('#panel tr.pick', { hasText: 'КД-2025/088' }).first().click();
await pause(200);
const card = await page.evaluate(() => document.getElementById('panel').textContent.replace(/\s+/g, ' '));
await page.fill('#shT', '2026-08-14 00:00');
await page.fill('#shX', '2026-07-10');
await btn('Показать');
const shown = await page.evaluate(() => {
  const h = Array.from(document.querySelectorAll('#panel h3')).find(x => /на момент T/.test(x.textContent));
  return h ? h.parentElement.querySelector('tbody').textContent.replace(/\s+/g, ' ').trim() : '';
});
await shot('object-088');
say('R25·карточка', /История перезаписей объекта/.test(card) && /аннулирование F-003/.test(card) && /Разбор по шагам/.test(card) &&
  /журнала перезаписи/.test(shown),
  `карточка КД-2025/088: ряд, история перезаписей и разбор по шагам; «на момент 14.08 00:00 на 10.07»: «${shown.slice(0, 110)}»`);

/* --- Журнал ночного прохода: запуск кнопкой, фильтр видов --- */
await reset();
await nav('night');
await btn('Запустить ночной проход');
const foot = await text('#foot');
await page.locator('#panel .chip', { hasText: 'смена по дате' }).first().click();
await pause(150);
const nrows = await page.evaluate(() => Array.from(document.querySelectorAll('#panel tbody tr')).map(t => t.textContent.replace(/\s+/g, ' ').trim()));
await shot('night');
say('ночь', /15\.08\.2026/.test(foot) && nrows.length >= 1 && nrows.every(r => /смена по дате/.test(r)) && nrows.some(r => /КД-2025\/043/.test(r)),
  `после прохода «сегодня» 15.08.2026; фильтр «смена по дате» — ${nrows.length} строк(и), среди них КД-2025/043`);

/* --- Сбой владельца мышью: чип «Платежи», метка с ошибкой, повтор --- */
await reset();
await nav('wait');
await page.locator('#panel .chip', { hasText: 'Платежи' }).first().click();
await pause(150);
await page.evaluate(() => CL.addFact({ creditId: 'КД-2024/117', kindId: 'f-noAct', occurred: '2026-08-10', doc: 'протокол' }));
await page.evaluate(() => CL.render());
const errRow = await text('#panel tbody tr');
await page.locator('#panel .chip', { hasText: 'Платежи' }).first().click();
await pause(150);
await btn('разобрать сейчас');
const left = await page.evaluate(() => CL.state.markers.length);
say('сбой', /не ответил/.test(errRow) && left === 0,
  `«Платежи» выключены чипом: «${errRow.slice(0, 100)}»; включены — метка разобрана кнопкой, осталось ${left}`);

const pass = out.filter(r => r.pass).length;
console.log(`БРАУЗЕР 2026-09-18 · ${pass}/${out.length} PASS · ошибок страницы ${errs.length}`);
out.forEach(r => console.log(`   ${r.pass ? 'PASS' : 'FAIL'}  ${r.n}  ${r.note}`));
if (errs.length) console.log(errs.slice(0, 6).join('\n'));
await ctx.close();
process.exit(pass === out.length && !errs.length ? 0 : 1);
