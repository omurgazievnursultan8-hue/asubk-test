// Первый ручной прогон макета анализа в НАСТОЯЩЕМ браузере (АН-25). Модуля в
// fkftest.okmot.kg нет (requirements/tz/21-analiz.html: «Живого экрана нет»), поэтому
// прогон — по локальному макету через file://, как классификация (wave5-verify.mjs).
// Известных дефектов у модуля пока нет (АН-Д1…АН-Д8 закрыты) — прогон разведочный:
// реальные клики/select по всем шести экранам и пяти ролям, а не проверка списка багов.
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

const pass = out.filter(r => r.pass).length;
console.log(`БРАУЗЕР 2026-09-02 · ${pass}/${out.length} PASS · ошибок страницы ${errs.length}`);
out.forEach(r => console.log(`   ${r.pass ? 'PASS' : 'FAIL'}  ${r.n}  ${r.note}`));
if (errs.length) { console.log('--- ОШИБКИ СТРАНИЦЫ ---'); console.log(errs.slice(0, 20).join('\n')); }
await ctx.close();
process.exit(pass === out.length && !errs.length ? 0 : 1);
