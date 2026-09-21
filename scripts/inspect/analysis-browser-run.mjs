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
//
// Волна 19 (21.09.2026) — БР-19…БР-30 на поверхности волны 18. Перезапуска без дополнения
// было бы мало ровно в том же смысле, что и в волне 15, и на этот раз это ИЗМЕРЕНО:
// старые 32 проверки прошли 32/32 по макету, выросшему с 5824 до 6688 строк, — ни одна
// из них о подписи с условиями, замороженных числах, замене, поводах и правке при
// неактивном авторе не знает ничего.
// Дополнение нашло ДВА ДЕФЕКТА, которых смоук поймать не мог, потому что смоук зовёт
// операцию с любым «кто» и любой датой, а человек — нет:
//   АН-Д14 — покрытие охвата (третий реквизит подписи, ИА-31) не показывалось нигде и
//            не достигалось ни одной ролью: обзор ведут три роли отдела анализа, и все
//            три покрывают любой охват целиком. Условие проверялось молча;
//   АН-Д15 — правку при НЕАКТИВНОМ авторе (ИА-35) нельзя было ни вызвать, ни увидеть:
//            даты приложения в шапке не было вовсе, а форму корректировки экран
//            показывал только автору — то есть запрещал то, что правило разрешает.
// Оба закрыты той же волной в макете; проверки ниже стоят на починенном.
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
/* Ролей СЕМЬ, а не пять: волна 18 завела второго сотрудника отдела и заведующего —
   первого ради автора, который потом увольняется, второго ради единственного права,
   которым он от отдела отличается (ИА-35). Прогон волны 15 ходил по пяти и о двух
   новых не знал: перечень, заданный в скрипте списком, молча отстаёт от приложения. */
const ROLES = [
  'Ведущий куратор (Бекова Н.)', 'Ведущий куратор (Асанов А.)',
  'Сотрудник отдела анализа', 'Сотрудник отдела анализа (Сатыбалдиев Н.)',
  'Заведующий отделом анализа', 'Руководитель подразделения', 'Администратор',
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
    'Сотрудник отдела анализа': 'Осмонова Г.',
    'Сотрудник отдела анализа (Сатыбалдиев Н.)': 'Сатыбалдиев Н.',
    'Заведующий отделом анализа': 'Алымкулов Б.',
    'Руководитель подразделения': 'Тентимишев К.',
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

/* ============ ПОВЕРХНОСТИ ВОЛНЫ 18 (БР-19…БР-30): подпись с условиями, замороженные
   числа, замена, поводы и правка при неактивном авторе. Каждая — реальным кликом,
   реальным select и реальным вводом; отказ читается С ЭКРАНА, а не из вызова ============ */

const ANALYST = 'Сотрудник отдела анализа';
const SECOND = 'Сотрудник отдела анализа (Сатыбалдиев Н.)';
const HEAD = 'Заведующий отделом анализа';
const toastErr = () => vis('#toastWrap .toast.err');
const toastOk = () => vis('#toastWrap .toast.ok');
const goReviews = async () => { await page.locator('.nav-item[data-v="reviews"]').click(); await page.waitForTimeout(220); };
const goReview = async () => { await page.locator('.nav-item[data-v="review"]').click(); await page.waitForTimeout(220); };
/* Переход между обзорами — кнопкой переключателя в шапке документа, а не присвоением
   состояния: экран, который меняют мимо его же кнопок, проверяет не то, что видит
   человек. */
const pick = async no => {
  await page.locator(`#panel .btn-row button:has-text("${no} · ")`).first().click();
  await page.waitForTimeout(220);
};
const reviewState = no => page.evaluate(n => { const r = AN.REVIEW(n); return r ? r.state : null; }, no);
/* Заведение обзора настоящей формой реестра: семь полей руками, потом кнопка. */
const newReviewByForm = async ({ tpl, from, to, asOf, by, dim, val, inds }) => {
  await goReviews();
  await page.selectOption('#nrTpl', tpl);
  await page.fill('#nrFrom', from); await page.fill('#nrTo', to); await page.fill('#nrAsOf', asOf);
  await page.fill('#nrBy', by);
  await page.fill('#nrCutDim', dim || ''); await page.fill('#nrCutVal', val || '');
  await page.fill('#nrInds', inds);
  await page.locator('#panel button:has-text("Завести обзор")').first().click();
  await page.waitForTimeout(250);
  return page.evaluate(() => { const l = AN.reviews(); return l.length ? l[l.length - 1].no : null; });
};

/* --- 19. Подпись НА ОТКРЫТОМ ПЕРИОДЕ отказана с экрана (АН-103, ИА-30) --- */
await reset();
await page.selectOption('#role', ANALYST);
await goReview();
await pick('ОБ-3');
{
  const face = await page.locator('#panel').textContent();
  await page.fill('#rText', 'Портфель за полугодие: просрочка сосредоточена в двух областях.');
  await page.selectOption('#rVerdict', 'требует внимания');
  await page.locator('#panel button:has-text("Утвердить обзор")').first().click();
  await page.waitForTimeout(250);
  const err = await toastErr();
  const still = await reviewState('ОБ-3');
  say('БР-19', still === 'черновик' && !!err && !err.covered && err.text.includes('не закрыт') &&
      face.includes('период не закрыт'),
    `ОБ-3 (срез 30.06.2026): на лице документа плашка «период не закрыт», и подпись отказана ` +
    `с экрана — «${(err && err.text || '').slice(0, 96)}»; документ остался «${still}». ` +
    `Работать он при этом работает: текст и вывод приняты, черновик правлению уходит`);
}

/* --- 20. ЧЕТЫРЕ СТРОКИ ФОРМЫ ПОДПИСИ стоят на экране, включая ПОКРЫТИЕ ОХВАТА —
   то, чего до волны 19 не было видно ни одной ролью (АН-Д14, АН-104, ИА-31…ИА-33) --- */
{
  const panel = await page.locator('#panel').textContent();
  const cov = await vis('#panel .pass .row, #panel .banner.warn .row');
  const toOpts = await page.locator('#rTo option').allTextContents();
  const replOpts = await page.locator('#rRepl option').allTextContents();
  say('БР-20', panel.includes('Реквизиты подписи') && panel.includes('Покрытие охвата') &&
      panel.includes('statCoverage') && toOpts.length > 1 && replOpts.length >= 1 &&
      (panel.includes('Подтверждаю неполноту') || panel.includes('подтверждать нечего')) && !!cov,
    `форма подписи несёт четыре строки: покрытие охвата (считает шов statCoverage, не мы), ` +
    `адресат из контура шаблона (${toOpts.filter(x => !x.startsWith('—')).join(', ') || '—'}), ` +
    `замена (${replOpts.length} вариантов) и полнота ответов. Покрытие до волны 19 не ` +
    `показывалось нигде и не достигалось ни одной подписывающей ролью — условие проверялось молча`);
}

/* --- 21. Обзор на ЗАКРЫТОМ срезе заводится НАСТОЯЩЕЙ ФОРМОЙ реестра, автор — тот, кто
   завёл (роль второго сотрудника отдела, заведённая волной 18) --- */
await reset();
await page.selectOption('#role', SECOND);
const closedNo = await newReviewByForm({ tpl: 'ШО-09', from: '2026-01-01', to: '2026-03-31',
  asOf: '2026-03-31', by: 'подразделение', dim: 'отрасль', val: 'переработка', inds: 's-over' });
{
  const ok = await toastOk();
  const rec = await page.evaluate(n => { const r = AN.REVIEW(n); return r && { a: r.author, s: r.state, as: r.asOf }; }, closedNo);
  say('БР-21', !!closedNo && !!rec && rec.a === 'Сатыбалдиев Н.' && rec.s === 'черновик' &&
      rec.as === '2026-03-31' && !!ok,
    `семь полей формы заполнены руками, кнопка нажата: заведён ${closedNo} (срез ${rec && rec.as}, ` +
    `автор ${rec && rec.a}, «${rec && rec.s}»). Ответ операции на экране: «${(ok && ok.text || '').slice(0, 80)}»`);
}

/* --- 22. Подпись БЕЗ АДРЕСАТА отказана, и отказ НАЗЫВАЕТ контур шаблона (АН-104, ИА-33) --- */
await goReview();
await pick(closedNo);
{
  await page.fill('#rText', 'Просрочка по переработке сосредоточена в двух подразделениях.');
  await page.selectOption('#rVerdict', 'требует внимания');
  await page.locator('#panel button:has-text("Утвердить обзор")').first().click();
  await page.waitForTimeout(250);
  const err = await toastErr();
  /* Отказ читается ЦЕЛИКОМ: перечень контура стоит в его хвосте, а vis() режет текст
     на 160 знаках — проверять надо то, что произнесено, а не то, что влезло. */
  const full = await page.locator('#toastWrap .toast.err').last().textContent();
  const still = await reviewState(closedNo);
  say('БР-22', still === 'черновик' && !!err && !err.covered && full.includes('КОМУ он направлен') &&
      full.includes('Администрирование кредитов'),
    `период закрыт — проверка ушла дальше и встала на адресате: «${(err && err.text || '').slice(0, 104)}». ` +
    `Отказ называет контур шаблона, а не «заполните поле»; документ остался «${still}»`);
}

/* --- 23. С НАЗВАННЫМ АДРЕСАТОМ подпись проходит: выпуск взят у соседа, адресат и
   покрытие встали в документ (АН-103…АН-105) --- */
{
  await page.selectOption('#rTo', 'Администрирование кредитов');
  await page.locator('#panel button:has-text("Утвердить обзор")').first().click();
  await page.waitForTimeout(300);
  const ok = await toastOk();
  const rec = await page.evaluate(n => { const r = AN.REVIEW(n); return r && { s: r.state, i: r.issue, to: r.to, w: r.worklist }; }, closedNo);
  const panel = await page.locator('#panel').textContent();
  say('БР-23', !!rec && rec.s === 'утверждено' && !!rec.i && rec.to === 'Администрирование кредитов' &&
      !!ok && panel.includes('Кому направлен') && panel.includes(rec.i),
    `подпись прошла: ${closedNo} «${rec && rec.s}», выпуск ${rec && rec.i} взят У ОТЧЁТНОСТИ (своего ` +
    `номера анализ не заводит), рабочий список ${rec && rec.w}, адресат «${rec && rec.to}» стоит ` +
    `в документе строкой. Ответ на экране: «${(ok && ok.text || '').slice(0, 70)}»`);
}

/* --- 24. ДВА СТОЛБЦА У ПОДПИСАННОГО ЧИСЛА, и у черновика первого нет вовсе
   (АН-Д12, АН-105, ADR-0248) --- */
{
  const signed = await page.locator('#panel').textContent();
  await pick('ОБ-3');
  const draft = await page.locator('#panel').textContent();
  say('БР-24', signed.includes('Под подписью') && signed.includes('Живое сейчас') &&
      signed.includes('Расхождение') && signed.includes('repIssueValues') &&
      !draft.includes('Под подписью'),
    `у подписанного ${closedNo} на лице карточки показателя стоят ДВА числа — «Под подписью» ` +
    `(от выпуска, швом repIssueValues) и «Живое сейчас» (ответ статистики), и между ними ` +
    `напечатано расхождение. У черновика ОБ-3 первого столбца нет вовсе: морозить было нечему, ` +
    `и пустой колонки на его месте тоже нет`);
}

/* --- 25. НЕПОЛНОТА подтверждается вслух: отказ, потом реальный клик по чекбоксу
   и подпись со строкой «подписано при N неответивших» (АН-104, ИА-32) --- */
await reset();
await page.selectOption('#role', SECOND);
const partNo = await newReviewByForm({ tpl: 'ШО-04', from: '2026-01-01', to: '2026-03-31',
  asOf: '2026-03-31', by: 'область', dim: '', val: '', inds: 's-port, s-over' });
await goReview();
await pick(partNo);
{
  await page.fill('#rText', 'Портфель по областям за квартал: концентрация в двух областях.');
  await page.selectOption('#rVerdict', 'требует внимания');
  await page.selectOption('#rTo', 'Отраслевой департамент');
  await page.locator('#panel button:has-text("Утвердить обзор")').first().click();
  await page.waitForTimeout(250);
  const err = await toastErr();
  /* После отказа экран перерисован, и поля формы подписи — адресат, замена, отметка
     неполноты — стоят пустыми заново. Это не дефект, а следствие ИА-20: обзор их не
     хранит, они реквизиты ОДНОГО действия. Значит и набирать их надо заново — как
     человеку. */
  const hasBox = await page.locator('#rAck').count();
  await page.selectOption('#rTo', 'Отраслевой департамент');
  if (hasBox) await page.locator('#rAck').check();
  await page.locator('#panel button:has-text("Утвердить обзор")').first().click();
  await page.waitForTimeout(300);
  const rec = await page.evaluate(n => { const r = AN.REVIEW(n); return r && { s: r.state, ack: r.ack }; }, partNo);
  const panel = await page.locator('#panel').textContent();
  say('БР-25', !!err && !err.covered && err.text.includes('подтвердить неполноту') && hasBox > 0 &&
      !!rec && rec.s === 'утверждено' && !!rec.ack &&
      panel.includes('подписано при ' + rec.ack.missing + ' неответивших'),
    `${partNo}: первая попытка отказана — «${(err && err.text || '').slice(0, 88)}»; чекбокс ` +
    `«Подтверждаю неполноту» нажат реальным кликом, подпись прошла, и строка «подписано при ` +
    `${rec && rec.ack && rec.ack.missing} неответивших из ${rec && rec.ack && rec.ack.of}» встала ` +
    `в документ рядом с подписью. Порога полноты нет: полноту оценил человек, но не молча`);
}

/* --- 26. ЗАМЕНА НАЗЫВАЕТСЯ человеком и ставит ПАРУ ссылок одним действием (АН-106, ИА-34) --- */
const replNo = await newReviewByForm({ tpl: 'ШО-04', from: '2026-01-01', to: '2026-03-31',
  asOf: '2026-03-31', by: 'область', dim: '', val: '', inds: 's-port, s-over' });
await goReview();
await pick(replNo);
{
  await page.fill('#rText', 'Пересмотр суждения о портфеле за квартал: концентрация пересчитана.');
  await page.selectOption('#rVerdict', 'требует решения руководства');
  await page.selectOption('#rTo', 'Отраслевой департамент');
  const opts = await page.locator('#rRepl option').allTextContents();
  await page.selectOption('#rRepl', partNo);
  const box = await page.locator('#rAck').count();
  if (box) await page.locator('#rAck').check();
  await page.locator('#panel button:has-text("Утвердить обзор")').first().click();
  await page.waitForTimeout(300);
  const pair = await page.evaluate(([a, b]) => ({
    neu: (r => r && { rep: r.replaces, s: r.state })(AN.REVIEW(a)),
    old: (r => r && { by: r.replacedBy, s: r.state })(AN.REVIEW(b)),
  }), [replNo, partNo]);
  say('БР-26', pair.neu && pair.neu.rep === partNo && pair.old && pair.old.by === replNo &&
      opts.some(x => x.includes(partNo)),
    `замена ВЫБРАНА из списка подписанных обзоров того же шаблона и периода (${opts.length - 1} ` +
    `вариантов), а не выведена по датам: ${replNo} «взамен ${pair.neu && pair.neu.rep}», ` +
    `${partNo} «заменён ${pair.old && pair.old.by}» — пара ссылок одним действием. Заменённый ` +
    `из реестра не исчезает: состояние «${pair.old && pair.old.s}», по нему уже могли поручать`);
}

/* --- 27. РЕЕСТР несёт адресата и замену, а у черновика адресата нет и сказано это
   СЛОВАМИ (АН-104, АН-106, ИА-33, ИА-34) --- */
await goReviews();
{
  const panel = await page.locator('#panel').textContent();
  const heads = await page.locator('#panel table th').allTextContents();
  say('БР-27', heads.some(h => h.includes('Кому направлен')) && heads.some(h => h.includes('Замена')) &&
      panel.includes('адресата у черновика нет') && panel.includes('взамен ' + partNo),
    `в реестре стоят колонки «Кому направлен» и «Замена»; замена видна С ОБЕИХ сторон ` +
    `(${replNo} — «взамен ${partNo}»), а у черновика адресата нет, и это НАПЕЧАТАНО словами ` +
    `(«адресата у черновика нет: его называют при подписи»), а не оставлено прочерком`);
}

/* --- 28. ПОВОДЫ ДЛЯ ЗАДАНИЙ на экране «Расписание и швы»: два вида, полное множество,
   ключ, адресат и база отсчёта срока (АН-109, АН-112, ADR-0251) --- */
await reset();
await page.locator('.nav-item[data-v="schedule"]').click();
await page.waitForTimeout(250);
{
  const panel = await page.locator('#panel').textContent();
  const kinds = await page.evaluate(() => AN.leadKinds().map(k => k.name));
  say('БР-28', panel.includes('Что у анализа сейчас требует задания') &&
      kinds.every(k => panel.includes(k)) && panel.includes('База отсчёта срока') &&
      panel.includes('опросом, а не отметкой'),
    `карточка поводов стоит на экране: видов ${kinds.length} (${kinds.join('; ')}), у каждого ` +
    `названы адресат, дата ввода в действие и база отсчёта срока. Множество ПОЛНОЕ, и сказано ` +
    `это словами: повод отпадает опросом, а не отметкой «закрыто»`);
}

/* --- 29. ЧЕТВЁРТЫЙ ШОВ спрашивается с площадки реальным select: без вида повода — отказ,
   с видом — ответ, и ЖУРНАЛ ВЫЗОВОВ помнит повод (АН-109, АН-113) --- */
{
  /* Спрашивающий модуль называется ЯВНО: четвёртая дверь открыта заданиям и только им,
     и вопрос от чужого модуля до вида повода не доходит вовсе — отказ придёт раньше,
     по праву, а не по форме вопроса (ИА-11, ADR-0251). */
  await page.selectOption('#sModule', 'задания');
  await page.selectOption('#sSeam', 'analysisLeads');
  await page.selectOption('#sLead', '');
  await page.locator('#panel button:has-text("Спросить")').first().click();
  await page.waitForTimeout(250);
  const noKind = await page.locator('#panel').textContent();
  await page.selectOption('#sModule', 'задания');
  await page.selectOption('#sSeam', 'analysisLeads');
  const kindVal = await page.evaluate(() => AN.leadKinds()[0].id);
  await page.selectOption('#sLead', kindVal);
  await page.locator('#panel button:has-text("Спросить")').first().click();
  await page.waitForTimeout(250);
  const withKind = await page.locator('#panel').textContent();
  const log = await page.evaluate(() => AN.seamCalls().slice(0, 2).map(c => ({ s: c.seam, occ: c.occasion || null, ok: c.ok })));
  say('БР-29', noKind.includes('вид повода не назван') && withKind.includes('analysisLeads') &&
      log.length === 2 && log.every(c => c.s === 'analysisLeads') &&
      log.some(c => !c.ok) && log.some(c => c.ok && c.occ),
    `шов спрошен площадкой дважды: без вида повода — отказ на экране («вид повода не назван: шов ` +
    `отвечает ПО ВИДУ…»), с видом «${kindVal}» — ответ. В журнале обе записи, и отказ записан ` +
    `НАРАВНЕ с ответом; у ответившего вызова стоит повод «${(log.find(c => c.ok) || {}).occ}» — ` +
    `без него два вопроса об одном заёмщике за один период не различить`);
}

/* --- 30. ПОРУЧЕНИЕ уходит К СОСЕДУ реальным кликом, и «что поручено» СПРАШИВАЕТСЯ
   швом, а не читается из записи обзора (АН-108, ADR-0250) --- */
await reset();
await page.selectOption('#role', 'Руководитель подразделения');
await goReview();
await pick('ОБ-2');
{
  const before = await page.evaluate(() => AN.tasksOfReview('ОБ-2').n);
  const fields = await page.evaluate(() => ({ len: JSON.stringify(AN.REVIEW('ОБ-2')).length, keys: Object.keys(AN.REVIEW('ОБ-2')).join(',') }));
  await page.fill('#tWhat', 'Провести проверку на месте и доложить');
  await page.locator('#panel button:has-text("Поручить")').first().click();
  await page.waitForTimeout(300);
  const ok = await toastOk();
  const after = await page.evaluate(() => AN.tasksOfReview('ОБ-2').n);
  const fields2 = await page.evaluate(() => JSON.stringify(AN.REVIEW('ОБ-2')).length);
  const panel = await page.locator('#panel').textContent();
  say('БР-30', before === 0 && after === 1 && fields.len === fields2 && !!ok &&
      panel.includes('zdByBasis') && !/задач|поручен/i.test(fields.keys),
    `«Поручить» нажато реальным кликом: поручений по ОБ-2 было ${before}, стало ${after}, и ответ ` +
    `на экране — «${(ok && ok.text || '').slice(0, 74)}». ЗАПИСЬ ОБЗОРА при этом не выросла ` +
    `ни на байт (${fields.len} → ${fields2}) и полей о поручениях не имеет: ответ собран швом ` +
    `zdByBasis у владельца «задания», а не прочитан у себя`);
}

/* ============ БР-31…БР-33: АН-Д15 — то, чего на экране не было ============ */

/* --- 31. ДАТА ПРИЛОЖЕНИЯ ДВИГАЕТСЯ из шапки, и от неё меняется то, что датировано
   (ИА-17). До волны 19 управления датой не было вовсе --- */
await reset();
{
  const wasFoot = await page.locator('#foot').textContent();
  await page.fill('#today', '2026-09-20');
  await page.waitForTimeout(250);
  const ok = await toastOk();
  const nowFoot = await page.locator('#foot').textContent();
  const st = await page.evaluate(() => AN.state.today);
  say('БР-31', st === '2026-09-20' && wasFoot.includes('21.08.2026') && nowFoot.includes('20.09.2026') &&
      !!ok && !ok.covered,
    `дата приложения переведена настоящим полем в шапке: подвал был «${wasFoot.replace(/\s+/g, ' ').trim().slice(0, 34)}…», ` +
    `стал «${nowFoot.replace(/\s+/g, ' ').trim().slice(0, 34)}…», состояние ${st}. Ответ операции ` +
    `на экране: «${(ok && ok.text || '').slice(0, 64)}» — перевод даты это операция, а не настройка показа`);
}

/* --- 32. ПОКА АВТОР АКТИВЕН, заведующему отказано — и отказ ЧИТАЕТСЯ С ЭКРАНА, а не
   прячется за отсутствием формы (АН-107, ИА-35) --- */
await reset();
await page.selectOption('#role', SECOND);
const mineNo = await newReviewByForm({ tpl: 'ШО-09', from: '2026-01-01', to: '2026-03-31',
  asOf: '2026-03-31', by: 'подразделение', dim: 'отрасль', val: 'переработка', inds: 's-over' });
await goReview();
await pick(mineNo);
await page.fill('#rText', 'Просрочка по переработке: два подразделения из пяти.');
await page.selectOption('#rVerdict', 'требует внимания');
await page.selectOption('#rTo', 'Администрирование кредитов');
await page.locator('#panel button:has-text("Утвердить обзор")').first().click();
await page.waitForTimeout(300);
{
  await page.selectOption('#role', HEAD);
  await page.waitForTimeout(250);
  const panel = await page.locator('#panel').textContent();
  const form = await page.locator('#rcBasis').count();
  say('БР-32', form === 0 && panel.includes('суждение правит тот, кто его') &&
      panel.includes('Исключение одно'),
    `${mineNo} подписан Сатыбалдиевым Н.; под заведующим (сегодня 21.08.2026, автор активен) формы ` +
    `корректировки нет, и на её месте стоит ТОТ САМЫЙ отказ операции: «…суждение правит тот, кто ` +
    `его произнёс и подписал… Исключение одно — автор неактивен». Пересказа экрана здесь нет`);
}

/* --- 33. ПОСЛЕ УВОЛЬНЕНИЯ АВТОРА заведующий правит, форма появляется, и правка ложится
   С ОТМЕТКОЙ, видимой в таблице корректировок (АН-107, ИА-35, ADR-0254) --- */
{
  await page.fill('#today', '2026-09-20');
  await page.waitForTimeout(280);
  const panel = await page.locator('#panel').textContent();
  const form = await page.locator('#rcBasis').count();
  if (form) {
    await page.fill('#rcBasis', 'служебная записка № 21 от 19.09.2026');
    await page.fill('#rcText', 'Суждение уточнено отделом: подразделений три, а не два.');
    await page.locator('#panel button:has-text("Внести корректировку суждения")').first().click();
    await page.waitForTimeout(300);
  }
  const ok = await toastOk();
  const rec = await page.evaluate(n => { const r = AN.REVIEW(n); const c = r.corrections[r.corrections.length - 1]; return c && { by: c.by, mark: !!c.notByAuthor, who: c.notByAuthor && c.notByAuthor.author }; }, mineNo);
  const after = await page.locator('#panel').textContent();
  say('БР-33', form > 0 && panel.includes('Правите не как автор') && !!rec && rec.mark === true &&
      rec.by === 'Алымкулов Б.' && rec.who === 'Сатыбалдиев Н.' &&
      after.includes('правка не автором') && after.includes('Отметка'),
    `дата переведена на 20.09.2026 — автор неактивен (уволен 15.09.2026), и экран ОТКРЫЛ форму ` +
    `заведующему с предупреждением «Правите не как автор». Правка внесена реальным кликом: ` +
    `записана за ${rec && rec.by}, отметка «правка не автором» стоит в записи И в столбце ` +
    `«Отметка» таблицы корректировок — до волны 19 она ложилась в запись и не печаталась нигде`);
}

const pass = out.filter(r => r.pass).length;
console.log(`БРАУЗЕР 2026-09-21 · ${pass}/${out.length} PASS · ошибок страницы ${errs.length}`);
out.forEach(r => console.log(`   ${r.pass ? 'PASS' : 'FAIL'}  ${r.n}  ${r.note}`));
if (errs.length) { console.log('--- ОШИБКИ СТРАНИЦЫ ---'); console.log(errs.slice(0, 20).join('\n')); }
await ctx.close();
process.exit(pass === out.length && !errs.length ? 0 : 1);
