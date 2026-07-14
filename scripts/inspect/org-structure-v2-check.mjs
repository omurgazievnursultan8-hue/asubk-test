/**
 * Проверка мокапа «Оргструктура v2 — Обзор» (mockups/org-structure/org-structure-v2.html).
 * Playwright + system Chrome, файл открывается по file://. Растёт от задачи к задаче.
 * Запуск: node scripts/inspect/org-structure-v2-check.mjs
 */
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const FILE = pathToFileURL(resolve('mockups/org-structure/org-structure-v2.html')).href;
const fails = [];
const ok = (name) => console.log('PASS  ' + name);
const check = (name, cond) => cond ? ok(name) : (fails.push(name), console.log('FAIL  ' + name));

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(FILE, { waitUntil: 'load' });

// --- Task 1: каркас вида «Обзор» ---
check('view-overview виден по умолчанию', await page.locator('#view-overview').isVisible());
check('crumb-title = «Оргструктура»',
  (await page.locator('.crumb-title').innerText()).trim() === 'Оргструктура');
check('структура подразделений НЕ показана на Обзоре',
  !(await page.locator('#view-units').isVisible()));

// --- четыре вида — вкладки одной страницы ---
check('модуль занимает один пункт сайдбара',
  await page.locator('.nav-item', { hasText: 'Оргструктура' }).count() === 1);
check('в таббаре 4 вкладки', await page.locator('#viewTabs .dtab').count() === 4);
check('вкладка «Обзор» активна по умолчанию',
  await page.locator('#viewTabs .dtab[data-view=overview]').evaluate(el => el.classList.contains('active')));
for (const [v, id] of [['units', '#view-units'], ['titles', '#view-titles'], ['people', '#view-people'], ['overview', '#view-overview']]) {
  await page.click(`#viewTabs .dtab[data-view=${v}]`);
  check(`вкладка ${v} показывает ${id} и подсвечена`,
    await page.locator(id).isVisible()
    && await page.locator(`#viewTabs .dtab[data-view=${v}]`).evaluate(el => el.classList.contains('active')));
}
check('вкладки видов не перебивают вкладки карточки подразделения (#tabbar)',
  await page.locator('#viewTabs .dtab.active').count() === 1);

// --- Task 2: слой производных функций (на 2026-07-11, демо-данные v1) ---
const m = await page.evaluate(() => metricsAt('2026-07-11'));
check('metricsAt: 7 подразделений создано, 1 закрыто → 6 действующих', m.units.total === 6);
check('metricsAt: 9 ставок по штату (1+1+1+2+1+1+1+1)', m.staff.planned === 9);
check('metricsAt: вакансия руководителя — 2 (Ошский филиал, Сектор)', m.vac.head === 2);
check('metricsAt: 1 действующее и.о.', m.acting.total === 1);
check('metricsAt: и.о. истекает ≤30 дней (до 2026-07-31)', m.acting.expiring === 1);
check('metricsAt: 1 совместительство', m.combine === 1);
check('metricsAt: правило «одно основное место работы» не нарушено', m.inv.length === 0);

const p = await page.evaluate(() => problemsAt('2026-07-11'));
check('problemsAt: вакансия руководителя у osh и sector',
  p.headVacant.map(x => x.unitId).sort().join(',') === 'osh,sector');
check('problemsAt: и.о. истекает — 1 запись', p.actingExpiring.length === 1);
check('problemsAt: закрытие заблокировано у go (верхний уровень) и osh (подчинённые+назначения)',
  p.liqBlocked.map(x => x.unitId).includes('osh') && p.liqBlocked.map(x => x.unitId).includes('go'));
check('problemsAt: подразделения без штатного расписания — их нет в демо-данных', p.noStaff.length === 0);

const ch = await page.evaluate(() => changesSince('2024-07-01', 3650).map(e => e.kind));
check('changesSince: за 10 лет есть создания, переименование, смена вышестоящего, закрытие',
  ['create', 'rename', 'move', 'liquidate'].every(k => ch.includes(k)));
check('changesSince: и.о. тоже событие ленты',
  (await page.evaluate(() => changesSince('2026-07-11', 60).some(e => e.kind === 'acting'))));

// --- Task 3: метрики на экране ---
check('на дашборде 6 плиток', await page.locator('#ovBody .metric').count() === 6);
check('плитка вакансий красная (вакантен руководитель)',
  await page.locator('#ovBody .metric[data-jump=vac]').evaluate(el => el.classList.contains('err')));
check('% заполненности показан',
  (await page.locator('#ovBody .metric[data-jump=staff]').innerText()).includes('%'));

// пустая дата: до создания верхнего уровня (2020-01-01) структуры нет
await page.fill('#dateInp', '2019-06-01');
await page.dispatchEvent('#dateInp', 'change');
check('пустая дата: плашка «структуры ещё нет»',
  (await page.locator('#ovBody').innerText()).includes('структуры ещё нет'));
check('пустая дата: метрики нулевые',
  (await page.locator('#ovBody .metric[data-jump=units] .mv').innerText()).trim() === '0');
await page.click('.date-chip[data-d="2026-07-11"]');

// --- Task 4: рабочие списки ---
check('есть секция «Требует внимания»',
  (await page.locator('#probs .sh-t').innerText()).includes('Требует внимания'));
check('6 табов проблем', await page.locator('#probs .dtab').count() === 6);
await page.locator('#probs .dtab[data-prob=headVacant]').click();
check('таб вакансий показывает 2 строки',
  await page.locator('#probs table.cgrid tbody tr').count() === 2);
await page.locator('#probs .dtab[data-prob=noStaff]').click();
check('пустой список пишет «Нарушений нет», а не прячется',
  (await page.locator('#probs').innerText()).includes('Нарушений нет'));

// клик по строке уводит в карточку подразделения
await page.locator('#probs .dtab[data-prob=headVacant]').click();
await page.locator('#probs table.cgrid tbody tr').first().click();
check('переход в вид «Подразделения»', await page.locator('#view-units').isVisible());
check('открыта вкладка «Штатное расписание»',
  await page.locator('#tabbar .dtab[data-tab=staff]').evaluate(el => el.classList.contains('active')));
await page.click('#viewTabs .dtab[data-view=overview]');

// роль Наблюдателя гасит действия
await page.selectOption('#roleSel', 'obs');
check('Наблюдатель: кнопки действий в списке задизейблены',
  await page.locator('#probs .rowact').first().isDisabled());
await page.click('#viewTabs .dtab[data-view=units]');
check('Наблюдатель: «+ Подразделение» задизейблена', await page.locator('#addUnitBtn').isDisabled());
await page.selectOption('#roleSel', 'hr');
await page.click('#viewTabs .dtab[data-view=overview]');

// --- Task 5: мини-структура и штат/факт ---
// ГО + 4 подчинённых: riskgo, creditgo, osh и закрытый jal (childrenAt не фильтрует
// закрытые — они обязаны быть видны зачёркнутыми, §5 спеки).
check('мини-структура: 2 уровня по умолчанию (ГО + 4 подчинённых = 5 строк)',
  await page.locator('#miniTree .otree li').count() === 5);
check('закрытое подразделение показано зачёркнутым',
  await page.locator('#miniTree .otree li.liq').count() === 1);
await page.click('#treeExpand');
check('после «раскрыть всё» строк больше',
  await page.locator('#miniTree .otree li').count() > 5);
check('вакансия руководителя помечена точкой',
  await page.locator('#miniTree .otree li .dotv').count() >= 1);
await page.locator('#miniTree .otree li').first().click();
check('клик по подразделению открывает карточку', await page.locator('#view-units').isVisible());
await page.click('#viewTabs .dtab[data-view=overview]');
check('«Штат и факт»: строка на каждый тип подразделения',
  await page.locator('#staffRoll tbody tr').count() >= 3);

// --- Task 6: лента изменений ---
check('лента: за 30 дней от 2026-07-11 событий нет → пустое состояние',
  (await page.locator('#changes').innerText()).includes('Изменений за'));
await page.selectOption('#chgWin', '365');
check('лента: за 365 дней события появились',
  await page.locator('#changes .ae').count() > 0);
check('лента: и.о. от 2026-06-01 в ленте есть',
  (await page.locator('#changes').innerText()).includes('И.о.'));
await page.selectOption('#chgWin', '30');

// --- Task 7: создание подразделения ---
// Кнопка «+ Подразделение» живёт только на вкладке «Подразделения» (одна точка входа).
check('на «Обзоре» кнопки создания нет', await page.locator('#ovAdd').count() === 0);
const unitsBefore = Number(await page.locator('#ovBody .metric[data-jump=units] .mv').innerText());
await page.click('#viewTabs .dtab[data-view=units]');
await page.click('#addUnitBtn');
await page.fill('#auName', 'Отдел взыскания Ошского филиала');
await page.selectOption('#auParent', 'osh');
await page.click('#auSubmit');
check('после создания остались на «Подразделениях»', await page.locator('#view-units').isVisible());
check('показан тост', await page.locator('#toast.show').isVisible());
await page.click('#viewTabs .dtab[data-view=overview]');
check('счётчик подразделений на «Обзоре» вырос',
  Number(await page.locator('#ovBody .metric[data-jump=units] .mv').innerText()) === unitsBefore + 1);
await page.locator('#probs .dtab[data-prob=noStaff]').click();
check('новое подразделение попало в список «Без штатного расписания»',
  (await page.locator('#probs').innerText()).includes('Отдел взыскания'));
check('печатный слой прячет сайдбар',
  await page.evaluate(() => [...document.styleSheets[0].cssRules]
    .some(r => r.conditionText === 'print' && r.cssText.includes('.sidebar'))));

// --- Справочник должностей: создание ---
await page.click('#viewTabs .dtab[data-view=titles]');
const titlesBefore = await page.locator('#titlesBody table.cgrid tbody tr').count();
await page.click('#addTitleBtn');
await page.fill('#mtName', 'Ведущий специалист');
await page.selectOption('#mtCat', 'специалист');
await page.click('#mtSubmit');
check('должность добавлена в справочник',
  await page.locator('#titlesBody table.cgrid tbody tr').count() === titlesBefore + 1);
check('новая должность нигде не используется',
  (await page.locator('#titlesBody table.cgrid tbody tr').last().innerText()).includes('не используется'));
await page.click('#addTitleBtn');
await page.fill('#mtName', 'Ведущий специалист');
await page.click('#mtSubmit');
check('дубль названия должности отклонён',
  (await page.locator('#mtErr').innerText()).length > 0
  && await page.locator('#titlesBody table.cgrid tbody tr').count() === titlesBefore + 1);
await page.click('#mtCancel');
await page.selectOption('#roleSel', 'obs');
check('Наблюдатель: «+ Должность» задизейблена', await page.locator('#addTitleBtn').isDisabled());
await page.selectOption('#roleSel', 'hr');

// --- Штатная единица в карточке подразделения ---
await page.click('#viewTabs .dtab[data-view=units]');
await page.locator('.tree-scroll .trow[data-id=sector]').click();
await page.click('#tabbar .dtab[data-tab=staff]');
const posBefore = await page.locator('#p-staff table.cgrid tbody tr').count();
await page.click('#addPosBtn');
await page.selectOption('#mpTitle', { label: 'Ведущий специалист' });
await page.fill('#mpUnits', '2');
await page.click('#mpSubmit');
check('штатная единица добавлена в подразделение',
  await page.locator('#p-staff table.cgrid tbody tr').count() === posBefore + 1);
check('новая штатная единица вакантна',
  (await page.locator('#p-staff table.cgrid tbody tr').last().innerText()).includes('вакансия'));
// у «Сектора мониторинга» уже есть руководитель (ps_sector) — второй запрещён
await page.click('#addPosBtn');
await page.selectOption('#mpTitle', { label: 'Ведущий специалист' });
await page.check('#mpHeadChk');
await page.click('#mpSubmit');
check('второй руководитель в подразделении отклонён',
  (await page.locator('#mpErr').innerText()).includes('уже есть руководитель'));
await page.click('#mpCancel');

// --- Назначение на штатную единицу ---
const rowVac = page.locator('#p-staff table.cgrid tbody tr', { hasText: 'Заведующий сектором' });
await rowVac.locator('.asgbtn').click();
await page.selectOption('#maEmp', { label: 'Иманова Н. С.' });   // у неё уже есть основное (ps_creditsp)
await page.selectOption('#maKind', 'main');
await page.click('#maSubmit');
check('второе основное назначение сотруднику отклонено',
  (await page.locator('#maErr').innerText()).includes('основное'));
await page.selectOption('#maKind', 'combine');
await page.fill('#maRate', '0.5');
await page.click('#maSubmit');
check('совместительство на вакансию оформлено',
  (await rowVac.innerText()).includes('совмест.'));
// совместитель руководителем не становится: head() смотрит только и.о. → основное,
// поэтому вакансия руководителя обязана остаться (метрика и рабочий список — заодно).
check('совместитель не закрывает вакансию руководителя',
  await page.evaluate(() => metricsAt(state.date).vac.head) === 2
  && await page.evaluate(() => problemsAt(state.date).headVacant.some(x => x.unitId === 'sector')));
// основное назначение — закрывает
await rowVac.locator('.asgbtn').click();
await page.selectOption('#maEmp', { label: 'Сыдыков Э. Ж.' });   // основного назначения не имеет
await page.selectOption('#maKind', 'main');
await page.click('#maSubmit');
check('основное назначение закрывает вакансию руководителя',
  await page.evaluate(() => metricsAt(state.date).vac.head) === 1);
check('«Сектор» ушёл из рабочего списка вакансий',
  await page.evaluate(() => problemsAt(state.date).headVacant.every(x => x.unitId !== 'sector')));

// --- новая штатная единица видна в «Обзоре» карточки подразделения ---
await page.click('#viewTabs .dtab[data-view=units]');
await page.locator('.tree-scroll .trow[data-id=osh]').click();
await page.click('#tabbar .dtab[data-tab=overview]');
const plannedBefore = Number(await page.locator('#ovUnitPlanned').innerText());
await page.click('#tabbar .dtab[data-tab=staff]');
await page.click('#addPosBtn');
await page.selectOption('#mpTitle', { label: 'Главный специалист' });
await page.fill('#mpUnits', '3');
await page.click('#mpSubmit');
await page.click('#tabbar .dtab[data-tab=overview]');
check('«Обзор» подразделения показывает штат и он вырос на 3 ставки',
  Number(await page.locator('#ovUnitPlanned').innerText()) === plannedBefore + 3);
check('«Обзор» подразделения показывает вакантные единицы',
  (await page.locator('#p-overview').innerText()).includes('Вакантных единиц'));

// --- Task 8: скриншоты для дев-команды ---
// reload обязателен: тест выше создал подразделение «Отдел взыскания», оно живёт в памяти
// страницы и иначе попал бы на все скриншоты.
await page.reload({ waitUntil: 'load' });
for (const [d, label] of [['2026-07-11', 'today'], ['2023-09-01', '2023']]) {
  await page.click(`.date-chip[data-d="${d}"]`);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `.auth/org-v2-${label}-hr.png`, fullPage: true });
}
await page.click('.date-chip[data-d="2026-07-11"]');
await page.selectOption('#roleSel', 'obs');
await page.waitForTimeout(200);
await page.screenshot({ path: '.auth/org-v2-today-obs.png', fullPage: true });
await page.selectOption('#roleSel', 'hr');
check('снят скриншот на 2026-07-11 без фантомного подразделения',
  !(await page.locator('#ovBody').innerText()).includes('Отдел взыскания'));

await ctx.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
process.exit(fails.length ? 1 : 0);
