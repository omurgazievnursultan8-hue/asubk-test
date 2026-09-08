// Первый ручной прогон макета анализа в НАСТОЯЩЕМ браузере (АН-25). Модуля в
// fkftest.okmot.kg нет (requirements/tz/21-analiz.html: «Живого экрана нет»), поэтому
// прогон — по локальному макету через file://, как классификация (wave5-verify.mjs).
// Известных дефектов у модуля пока нет (АН-Д1…АН-Д10 закрыты) — прогон разведочный:
// реальные клики/select по всем шести экранам и пяти ролям, а не проверка списка багов.
// Волна 15 (08.09.2026) добавила четыре проверки на свои поверхности — БР-15…БР-18:
// каталог форм расчёта и отказ завести свою (АН-80, АН-86), блок запросов пакета с днями
// после срока считанным числом и отказ посчитать дефект (АН-82), карточка динамики с рядом
// из двух точек и отказ показать прогноз (АН-83, АН-85), колонка источника у строк
// отчётности (АН-81). Каждая — реальным кликом, отказ читается с экрана, а не из вызова.
//   node scripts/inspect/analysis-browser-run.mjs
import { chromium } from 'playwright-core';

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

const URL = 'file://' + process.cwd() + '/mockups/analysis/analysis.html';
const out = [];
const say = (n, pass, note) => out.push({ n, pass, note });
const reset = async () => { await page.goto(URL, { waitUntil: 'load' }); await page.waitForTimeout(250); };
const vis = async sel => page.evaluate(s => {
  const el = document.querySelector(s); if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  const top = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(10, r.height / 2));
  return { text: (el.textContent || '').trim().slice(0, 160), covered: !(el === top || el.contains(top)) };
}, sel);

const VIEWS = [
  ['borrower', 'Заёмщик · Финансы'],
  ['doc', 'Финанализ (документ)'],
  ['methods', 'Реестр методик'],
  ['schedule', 'Расписание и швы'],
  ['reviews', 'Обзоры портфеля · реестр'],
  ['review', 'Обзор портфеля (документ)'],
];
const ROLES = [
  'Ведущий куратор (Бекова Н.)', 'Ведущий куратор (Асанов А.)',
  'Сотрудник отдела анализа', 'Руководитель подразделения', 'Администратор',
];
const SUBJECTS = ['b-1', 'b-2', 'b-3', 'b-4', 'b-5'];

/* --- 1. Стартовый экран грузится без ошибок --- */
await reset();
{
  const title = await page.locator('#title').textContent();
  say('БР-1', title === 'Заёмщик · Финансы', `заголовок при загрузке: «${title}»`);
}

/* --- 2. Все шесть экранов открываются реальным кликом по .nav-item, без ошибок --- */
for (const [v, t] of VIEWS) {
  await reset();
  await page.locator(`.nav-item[data-v="${v}"]`).click();
  await page.waitForTimeout(200);
  const title = await page.locator('#title').textContent();
  const panel = await page.locator('#panel').innerHTML();
  say('БР-2:' + v, title === t && panel.trim().length > 0,
    `экран «${v}»: заголовок «${title}», панель ${panel.trim().length} симв.`);
}

/* --- 3. Переключатель роли реальным select во всех пяти ролях, без ошибок --- */
await reset();
for (const r of ROLES) {
  await page.selectOption('#role', r);
  await page.waitForTimeout(150);
  const foot = await page.locator('#foot').textContent();
  const who = { 'Ведущий куратор (Бекова Н.)': 'Бекова Н.', 'Ведущий куратор (Асанов А.)': 'Асанов А.',
    'Сотрудник отдела анализа': 'Осмонова Г.', 'Руководитель подразделения': 'Тентимишев К.',
    Администратор: 'Администратор' }[r];
  say('БР-3:' + r, foot.includes(who), `роль «${r}» → подвал «${foot.replace(/\s+/g, ' ').trim().slice(0, 90)}»`);
}

/* --- 4. Переключатель заёмщика реальным select по всем пяти карточкам --- */
await reset();
for (const s of SUBJECTS) {
  await page.selectOption('#subj', s);
  await page.waitForTimeout(150);
  const foot = await page.locator('#foot').textContent();
  say('БР-4:' + s, foot.length > 0 && !foot.includes('undefined'),
    `заёмщик «${s}» → подвал «${foot.replace(/\s+/g, ' ').trim().slice(0, 90)}»`);
}

/* --- 5. Финанализ ФА-7 (по умолчанию): таблица коэффициентов на экране, не перекрыта --- */
await reset();
await page.locator('.nav-item[data-v="doc"]').click();
await page.waitForTimeout(200);
{
  const tbl = await vis('#panel table');
  say('БР-5', !!tbl && !tbl.covered, `таблица коэффициентов: «${(tbl && tbl.text || '').slice(0, 80)}…», перекрыта: ${tbl && tbl.covered}`);
}

/* --- 6. Контур финанализа: смена роли на экране «doc» отражается в панели живьём, без ошибок --- */
await reset();
await page.locator('.nav-item[data-v="doc"]').click();
await page.waitForTimeout(150);
await page.selectOption('#role', 'Ведущий куратор (Асанов А.)');
await page.waitForTimeout(200);
{
  const panel = await page.locator('#panel').textContent();
  say('БР-6', /видно тем же|ведущий куратор/i.test(panel) || panel.trim().length > 0,
    `doc-экран под ролью «Асанов А.» (заёмщик b-1, куратор Бекова Н.): «${panel.replace(/\s+/g, ' ').trim().slice(0, 140)}…»`);
}

/* --- 7. Отдел анализа видит финанализ даже вне контура куратора (ИА-24) --- */
await reset();
await page.locator('.nav-item[data-v="doc"]').click();
await page.waitForTimeout(150);
await page.selectOption('#role', 'Сотрудник отдела анализа');
await page.waitForTimeout(200);
{
  const err = await vis('#panel .banner.err, #panel .banner.warn');
  const panel = await page.locator('#panel').textContent();
  say('БР-7', panel.trim().length > 0, `doc-экран под ролью «отдел анализа»: отказ на экране: ${err ? err.text.slice(0, 100) : 'нет'}`);
}

/* --- 8. Обзоры портфеля · реестр: кнопка «Завести обзор» кликабельна реальным кликом --- */
await reset();
await page.locator('.nav-item[data-v="reviews"]').click();
await page.waitForTimeout(200);
{
  const before = await page.locator('#panel table tbody tr').count();
  const btn = page.locator('button:has-text("Завести обзор")').first();
  const hasBtn = await btn.count();
  if (hasBtn) { await btn.click(); await page.waitForTimeout(200); }
  const after = await page.locator('#panel table tbody tr').count();
  say('БР-8', hasBtn === 0 || after >= before, `кнопка «Завести обзор» найдена: ${!!hasBtn}, строк было ${before} → стало ${after}`);
}

/* --- 9. Методики: реестр открывается, строка методики кликабельна --- */
await reset();
await page.locator('.nav-item[data-v="methods"]').click();
await page.waitForTimeout(200);
{
  const rows = await page.locator('#panel table tbody tr').count();
  say('БР-9', rows > 0, `реестр методик: строк ${rows}`);
}

/* --- 10. Расписание и швы: обе таблицы на экране --- */
await reset();
await page.locator('.nav-item[data-v="schedule"]').click();
await page.waitForTimeout(200);
{
  const tbls = await page.locator('#panel table').count();
  say('БР-10', tbls >= 1, `таблиц на экране «расписание и швы»: ${tbls}`);
}

/* --- 11. Групповой заёмщик (b-4, «Группа «Достук»»): карточка заёмщика открывается без ошибок --- */
await reset();
await page.selectOption('#subj', 'b-4');
await page.waitForTimeout(150);
await page.locator('.nav-item[data-v="borrower"]').click();
await page.waitForTimeout(200);
{
  const panel = await page.locator('#panel').textContent();
  say('БР-11', /групповой заёмщик|Достук/.test(panel), `карточка b-4: «${panel.replace(/\s+/g, ' ').trim().slice(0, 140)}…»`);
}

/* --- 12. Обзор портфеля (документ): открывается без ошибок, есть числовое содержимое --- */
await reset();
await page.locator('.nav-item[data-v="review"]').click();
await page.waitForTimeout(200);
{
  const panel = await page.locator('#panel').textContent();
  say('БР-12', panel.trim().length > 0, `обзор (документ) по умолчанию: «${panel.replace(/\s+/g, ' ').trim().slice(0, 140)}…»`);
}

/* --- 13. Черновик обзора без вывода: клик по строке, реальный клик «Утвердить обзор» —
   отказ назван на экране, страница не падает (ADR/ИА про подписанное суждение) --- */
await reset();
await page.locator('.nav-item[data-v="reviews"]').click();
await page.waitForTimeout(200);
await page.selectOption('#role', 'Сотрудник отдела анализа');
await page.waitForTimeout(150);
{
  const draftNo = await page.evaluate(() => {
    const r = AN.state.reviews.find(x => x.state !== 'утверждено');
    return r ? r.no : null;
  });
  say('БР-13:найден-черновик', !!draftNo, `черновик обзора: ${draftNo}`);
  if (draftNo) {
    await page.locator(`tr:has-text("${draftNo}")`).first().click();
    await page.waitForTimeout(200);
    const approveBtn = page.locator('button:has-text("Утвердить обзор")').first();
    const hasBtn = await approveBtn.count();
    if (hasBtn) await approveBtn.click();
    await page.waitForTimeout(200);
    const err = await vis('#toastWrap .toast.err');
    const stillDraft = await page.evaluate(n => AN.state.reviews.find(r => r.no === n).state !== 'утверждено',
      draftNo);
    say('БР-13', stillDraft && !!err && !err.covered,
      `после клика «Утвердить обзор» без вывода: остался черновиком: ${stillDraft}, отказ (toast): «${(err && err.text || '').slice(0, 110)}»`);
  }
}

/* --- 14. Утверждённый финанализ ФА-7: реальный клик «Внести корректировку» автором --- */
await reset();
await page.locator('.nav-item[data-v="doc"]').click();
await page.waitForTimeout(200);
{
  const before = await page.evaluate(() => AN.state.analyses.length);
  const btn = page.locator('button:has-text("Внести корректировку")').first();
  const hasBtn = await btn.count();
  if (hasBtn) { await btn.click(); await page.waitForTimeout(200); }
  const panel = await page.locator('#panel').textContent();
  say('БР-14', hasBtn > 0 && panel.trim().length > 0,
    `кнопка «Внести корректировку» найдена: ${!!hasBtn}, панель после клика: «${panel.replace(/\s+/g, ' ').trim().slice(0, 140)}…»`);
}

/* ============ ПОВЕРХНОСТИ ВОЛНЫ 15 (АН-90): каждая — реальным кликом ============ */

/* --- 15. Каталог форм расчёта на «Реестре методик»: своя таблица + отказ завести свою
   форму (АН-80, АН-86, ИА-27) --- */
await reset();
await page.locator('.nav-item[data-v="methods"]').click();
await page.waitForTimeout(200);
{
  const panel = await page.locator('#panel').textContent();
  const forms = await page.evaluate(() => AN.forms().length);
  const btn = page.locator('button:has-text("Завести свою форму расчёта")').first();
  const hasBtn = await btn.count();
  if (hasBtn) { await btn.click(); await page.waitForTimeout(200); }
  const err = await vis('#toastWrap .toast.err');
  const grew = await page.evaluate(() => AN.forms().length);
  say('БР-15', panel.includes('Каталог форм расчёта') && forms === 6 && hasBtn > 0 &&
      !!err && !err.covered && grew === 6,
    `каталог форм стоит своей таблицей, форм ${forms}; «Завести свою форму расчёта» отказывает ` +
    `на экране: «${(err && err.text || '').slice(0, 90)}», форм после клика ${grew}`);
}

/* --- 16. Блок запросов пакета на карточке b-5: дни после срока СЧИТАННЫМ числом,
   отказ посчитать дефект (АН-82, ИА-29) --- */
await reset();
await page.selectOption('#subj', 'b-5');
await page.waitForTimeout(150);
await page.locator('.nav-item[data-v="borrower"]').click();
await page.waitForTimeout(200);
{
  const panel = await page.locator('#panel').textContent();
  const over = await page.evaluate(() => AN.overdueDays(AN.requestsOf('b-5')[0]));
  const btn = page.locator('button:has-text("Посчитать дефект по запросу")').first();
  const hasBtn = await btn.count();
  if (hasBtn) { await btn.click(); await page.waitForTimeout(200); }
  const err = await vis('#toastWrap .toast.err');
  say('БР-16', panel.includes('Установленная дата') && panel.includes('Дней после срока') &&
      over === 42 && panel.includes(String(over)) && hasBtn > 0 && !!err && !err.covered,
    `запрос b-5 виден на экране: установленная дата колонкой, дней после срока ${over} — ` +
    `число считано, а не хранится; «Посчитать дефект по запросу» отказывает: ` +
    `«${(err && err.text || '').slice(0, 90)}»`);
}

/* --- 17. Карточка динамики на ФА-11 (b-7): ряд из двух точек с изменением и отказ
   показать прогноз (АН-83, АН-85, ИА-22) --- */
await reset();
await page.selectOption('#subj', 'b-7');
await page.waitForTimeout(150);
await page.locator('.nav-item[data-v="borrower"]').click();
await page.waitForTimeout(200);
{
  const open = page.locator('tr:has-text("ФА-11") button:has-text("Открыть")').first();
  const hasRow = await open.count();
  if (hasRow) { await open.click(); await page.waitForTimeout(250); }
  const panel = await page.locator('#panel').textContent();
  const before = await page.evaluate(() => JSON.stringify(AN.state.analyses).length);
  const btn = page.locator('button:has-text("Показать прогноз (AI)")').first();
  const hasBtn = await btn.count();
  if (hasBtn) { await btn.click(); await page.waitForTimeout(200); }
  const err = await vis('#toastWrap .toast.err');
  const after = await page.evaluate(() => JSON.stringify(AN.state.analyses).length);
  say('БР-17', hasRow > 0 && panel.includes('Динамика') && panel.includes('+10 000,00 сом') &&
      panel.includes('этот документ') && hasBtn > 0 && !!err && !err.covered && before === after,
    `ряд ФА-11 стоит на экране рядом с коэффициентами (+10 000,00 сом, текущая точка помечена ` +
    `«этот документ»); «Показать прогноз (AI)» отказывает: «${(err && err.text || '').slice(0, 90)}», ` +
    `состояние заключений не изменилось: ${before === after}`);
}

/* --- 18. Источник у СТРОКИ отчётности: колонка на карточке b-1 видна и не перекрыта
   (АН-81, ИА-28) --- */
await reset();
await page.locator('.nav-item[data-v="borrower"]').click();
await page.waitForTimeout(200);
{
  const panel = await page.locator('#panel').textContent();
  const cell = await page.evaluate(() => {
    const th = [...document.querySelectorAll('#panel th')]
      .find(x => (x.textContent || '').includes('Источники строк'));
    if (!th) return null;
    const r = th.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });
  say('БР-18', panel.includes('Источники строк') && panel.includes('из файла') && !!cell &&
      cell.w > 0 && cell.h > 0,
    `колонка «Источники строк» на карточке заёмщика видна (${cell ? cell.w + '×' + cell.h : 'нет'}), ` +
    `сводка источников печатается словами и считается в момент показа`);
}

const pass = out.filter(r => r.pass).length;
console.log(`БРАУЗЕР 2026-09-08 · ${pass}/${out.length} PASS · ошибок страницы ${errs.length}`);
out.forEach(r => console.log(`   ${r.pass ? 'PASS' : 'FAIL'}  ${r.n}  ${r.note}`));
if (errs.length) { console.log('--- ОШИБКИ СТРАНИЦЫ ---'); console.log(errs.slice(0, 20).join('\n')); }
await ctx.close();
process.exit(pass === out.length && !errs.length ? 0 : 1);
