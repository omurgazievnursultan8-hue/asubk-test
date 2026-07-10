// Проверка to-be мокапа взыскания (mockups/collection/collection.html).
// Спек: docs/superpowers/specs/2026-07-10-collection-mockup-design.md
// Запуск: node scripts/inspect/collection-check.mjs
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const FILE = pathToFileURL(resolve('mockups/collection/collection.html')).href;
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.goto(FILE, { waitUntil: 'load' });

let fails = 0;
const ok = (name, cond) => { if (!cond) fails++; console.log(`${cond ? '  ok' : 'FAIL'}  ${name}`); };

// --- T1: список ---
ok('4 процесса в гриде', (await page.locator('#listBody tr').count()) === 4);
ok('№ процесса структурный', (await page.locator('#listBody tr[data-id="142"] td').first().innerText()) === 'В-2026-000142');
ok('«Открыть процесс» заблокирована до выбора', await page.locator('#btnOpen').isDisabled());
await page.click('#listBody tr[data-id="142"]');
ok('после выбора строки кнопка активна', !(await page.locator('#btnOpen').isDisabled()));
await page.click('#btnOpen');
ok('7 вкладок', (await page.locator('#detailTabbar .dtab').count()) === 7);
ok('хлебная крошка с номером', (await page.locator('#crumbTitle').innerText()).includes('В-2026-000142'));

// --- T2: вычисляемые правила ---
const rules = await page.evaluate(() => ({
  hasCatOf: typeof catOf === 'function',
  hasStageOf: typeof stageOf === 'function',
  b5:   typeof catOf === 'function' && catOf(5),
  b6:   typeof catOf === 'function' && catOf(6),
  b180: typeof catOf === 'function' && catOf(180),
  b181: typeof catOf === 'function' && catOf(181),
  storedCat:   PROCESSES.some(p => 'cat' in p),
  storedStage: PROCESSES.some(p => 'stage' in p),
  stageOfIsk:  typeof stageOf === 'function' && stageOf('Иск'),
  stageOfPret: typeof stageOf === 'function' && stageOf('Повторная претензия'),
}));
ok('catOf объявлена', rules.hasCatOf);
ok('stageOf объявлена', rules.hasStageOf);
ok('граница 5 дн → норма', rules.b5 === 'norm');
ok('граница 6 дн → средний', rules.b6 === 'mid');
ok('граница 180 дн → средний', rules.b180 === 'mid');
ok('граница 181 дн → высокий', rules.b181 === 'high');
ok('поле cat удалено из данных', rules.storedCat === false);
ok('поле stage удалено из данных', rules.storedStage === false);
ok('stageOf(«Иск») → Принудительная', rules.stageOfIsk === 'Принудительная');
ok('stageOf(«Повторная претензия») → Досудебная', rules.stageOfPret === 'Досудебная');

// --- T3: сортировка по колонке «Категория» (регрессия после удаления поля cat) ---
await page.evaluate(() => showView('list'));
await page.click('#listHead th:has-text("Категория")');
const catSortIds = await page.locator('#listBody tr').evaluateAll(trs => trs.map(tr => tr.dataset.id));
ok('клик «Категория» переупорядочивает строки', JSON.stringify(catSortIds) !== JSON.stringify(['120','133','142','151']));
ok('после сортировки по категории первой идёт строка с наименьшей просрочкой (id 133)', catSortIds[0] === '133');

console.log(`\nОШИБОК КОНСОЛИ: ${errors.length}`);
errors.forEach(e => console.log('  ' + e));
console.log(`ПРОВАЛЕНО АССЕРТОВ: ${fails}`);
await ctx.close();
process.exit(fails || errors.length ? 1 : 0);
