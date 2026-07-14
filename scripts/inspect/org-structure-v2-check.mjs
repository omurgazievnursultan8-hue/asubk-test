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
check('crumb-title = «Оргструктура · Обзор»',
  (await page.locator('.crumb-title').innerText()).includes('Обзор'));
check('в nav есть пункт «Обзор»',
  await page.locator('.nav-item', { hasText: 'Обзор' }).count() === 1);
check('дерево подразделений НЕ показано на Обзоре',
  !(await page.locator('#view-units').isVisible()));

// --- Task 2: слой производных функций (на 2026-07-11, демо-данные v1) ---
const m = await page.evaluate(() => metricsAt('2026-07-11'));
check('metricsAt: 7 узлов создано, 1 ликвидирован → 6 живых', m.units.total === 6);
check('metricsAt: 9 штатных единиц (1+1+1+2+1+1+1+1)', m.staff.planned === 9);
check('metricsAt: вакансия руководителя — 2 (Ошский филиал, Сектор)', m.vac.head === 2);
check('metricsAt: 1 действующее и.о.', m.acting.total === 1);
check('metricsAt: и.о. истекает ≤30 дней (до 2026-07-31)', m.acting.expiring === 1);
check('metricsAt: 1 совместительство', m.combine === 1);
check('metricsAt: инвариант не нарушен', m.inv.length === 0);

const p = await page.evaluate(() => problemsAt('2026-07-11'));
check('problemsAt: вакансия руководителя у osh и sector',
  p.headVacant.map(x => x.unitId).sort().join(',') === 'osh,sector');
check('problemsAt: и.о. истекает — 1 запись', p.actingExpiring.length === 1);
check('problemsAt: ликвидация заблокирована у go (корень) и osh (потомки+назначения)',
  p.liqBlocked.map(x => x.unitId).includes('osh') && p.liqBlocked.map(x => x.unitId).includes('go'));
check('problemsAt: узлы без штатки — их нет в демо-данных', p.noStaff.length === 0);

const ch = await page.evaluate(() => changesSince('2024-07-01', 3650).map(e => e.kind));
check('changesSince: за 10 лет есть создания, переименование, переподчинение, ликвидация',
  ['create', 'rename', 'move', 'liquidate'].every(k => ch.includes(k)));
check('changesSince: и.о. тоже событие ленты',
  (await page.evaluate(() => changesSince('2026-07-11', 60).some(e => e.kind === 'acting'))));

// --- Task 3: метрики на экране ---
check('на дашборде 6 плиток', await page.locator('#ovBody .metric').count() === 6);
check('плитка вакансий красная (вакантен руководитель)',
  await page.locator('#ovBody .metric[data-jump=vac]').evaluate(el => el.classList.contains('err')));
check('% укомплектованности показан',
  (await page.locator('#ovBody .metric[data-jump=staff]').innerText()).includes('%'));

// пустой срез: до создания корня (2020-01-01) структуры нет
await page.fill('#dateInp', '2019-06-01');
await page.dispatchEvent('#dateInp', 'change');
check('пустой срез: плашка «структура не существует»',
  (await page.locator('#ovBody').innerText()).includes('не существует'));
check('пустой срез: метрики нулевые',
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

// клик по строке уводит в карточку узла
await page.locator('#probs .dtab[data-prob=headVacant]').click();
await page.locator('#probs table.cgrid tbody tr').first().click();
check('переход в вид «Подразделения»', await page.locator('#view-units').isVisible());
check('открыта вкладка «Штатка»',
  await page.locator('#tabbar .dtab[data-tab=staff]').evaluate(el => el.classList.contains('active')));
await page.locator('.nav-item', { hasText: 'Обзор' }).click();

// роль Наблюдателя гасит действия
await page.selectOption('#roleSel', 'obs');
check('Наблюдатель: «+ Подразделение» задизейблена', await page.locator('#ovAdd').isDisabled());
check('Наблюдатель: кнопки действий в списке задизейблены',
  await page.locator('#probs .rowact').first().isDisabled());
await page.selectOption('#roleSel', 'hr');

// --- Task 5: мини-дерево и штат/факт ---
// ГО + 4 ребёнка: riskgo, creditgo, osh и ликвидированный jal (childrenAt не фильтрует
// ликвидированных — они обязаны быть видны зачёркнутыми, §5 спеки).
check('мини-дерево: 2 уровня по умолчанию (ГО + 4 ребёнка = 5 строк)',
  await page.locator('#miniTree .otree li').count() === 5);
check('ликвидированный узел показан зачёркнутым',
  await page.locator('#miniTree .otree li.liq').count() === 1);
await page.click('#treeExpand');
check('после «раскрыть всё» строк больше',
  await page.locator('#miniTree .otree li').count() > 5);
check('вакансия руководителя помечена точкой',
  await page.locator('#miniTree .otree li .dotv').count() >= 1);
await page.locator('#miniTree .otree li').first().click();
check('клик по узлу открывает карточку', await page.locator('#view-units').isVisible());
await page.locator('.nav-item', { hasText: 'Обзор' }).click();
check('«Штат и факт»: строка на каждый тип узла',
  await page.locator('#staffRoll tbody tr').count() >= 3);

await ctx.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
process.exit(fails.length ? 1 : 0);
