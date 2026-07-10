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
ok('6 процессов в гриде', (await page.locator('#listBody tr').count()) === 6);
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

// --- T3: 6 процессов, два терминальных ---
await page.goto(FILE, { waitUntil: 'load' });
ok('6 процессов в гриде', (await page.locator('#listBody tr').count()) === 6);
ok('терминальная строка приглушена', (await page.locator('#listBody tr.terminal').count()) === 2);
const t104 = page.locator('#listBody tr[data-id="104"]');
ok('у 104 в колонке фазы — исход', (await t104.locator('td').nth(3).innerText()).includes('Принятие имущества'));
const t097 = page.locator('#listBody tr[data-id="097"], #listBody tr[data-id="97"]');
ok('у 097 группа 4', (await t097.locator('td').nth(5).innerText()) === '4');
await page.click('#listBody tr[data-id="104"]');
await page.click('#btnOpen');
const gen104 = page.locator('#detailPanels .detail-panel').first();
// ro() renders values inside <input readonly> — form-control values are not part of
// .innerText() (pre-existing behaviour of every ro() field, not specific to this data),
// so check the actual input value of the labelled field instead of substring-matching innerText.
const outcomeVal = await gen104.locator('.field').filter({ hasText: 'Исход' }).locator('input').inputValue();
const closedVal = await gen104.locator('.field').filter({ hasText: 'Дата закрытия' }).locator('input').inputValue();
ok('исход заполнен на «Общей»', outcomeVal === 'Принятие имущества');
ok('дата закрытия заполнена', closedVal === '14.05.2026');

// --- T3: сортировка по колонке «Категория» (регрессия после удаления поля cat) ---
await page.evaluate(() => showView('list'));
await page.click('#listHead th:has-text("Категория")');
const catSortIds = await page.locator('#listBody tr').evaluateAll(trs => trs.map(tr => tr.dataset.id));
ok('клик «Категория» переупорядочивает строки', JSON.stringify(catSortIds) !== JSON.stringify(['120','133','142','151']));
ok('после сортировки по категории первой идёт строка с наименьшей просрочкой (id 133)', catSortIds[0] === '133');

// --- T4: контроль пересечения охвата ---
await page.goto(FILE, { waitUntil: 'load' });
const ov = await page.evaluate(() => ({
  has: typeof overlaps === 'function',
  n142: typeof overlaps === 'function' && overlaps(PROCESSES.find(p => p.id === '142')).length,
  n133: typeof overlaps === 'function' && overlaps(PROCESSES.find(p => p.id === '133')).length,
  other142: typeof overlaps === 'function' && overlaps(PROCESSES.find(p => p.id === '142'))[0]?.other.id,
}));
ok('overlaps объявлена', ov.has);
ok('у 142 одно пересечение', ov.n142 === 1);
ok('пересечение указывает на 151', ov.other142 === '151');
ok('у одинокого 133 пересечений нет', ov.n133 === 0);

await page.click('#listBody tr[data-id="142"]');
await page.click('#btnOpen');
await page.click('#detailTabbar .dtab >> nth=1');           // вкладка «Охват»
const ohvat = page.locator('#detailPanels .detail-panel >> nth=1');
ok('плашка пересечения видна', await ohvat.locator('.overlap-note').isVisible());
ok('плашка называет соседний процесс', (await ohvat.locator('.overlap-note').innerText()).includes('В-2026-000151'));
await ohvat.locator('.overlap-note .rowlink').click();
ok('ссылка открыла соседний процесс', (await page.locator('#crumbTitle').innerText()).includes('В-2026-000151'));

// у 133 плашки нет
await page.click('#detailPanels');                            // фокус, не важно
await page.goto(FILE, { waitUntil: 'load' });
await page.click('#listBody tr[data-id="133"]');
await page.click('#btnOpen');
await page.click('#detailTabbar .dtab >> nth=1');
ok('у 133 плашки нет', (await page.locator('#detailPanels .detail-panel >> nth=1').locator('.overlap-note').count()) === 0);

// модалка «Добавить кредит» предупреждает по реальным данным
await page.goto(FILE, { waitUntil: 'load' });
await page.click('#listBody tr[data-id="142"]');
await page.click('#btnOpen');
await page.click('#detailTabbar .dtab >> nth=1');
await page.click('#detailPanels .detail-panel >> nth=1 >> .gtoolbar .btn');
ok('модалка охвата открыта', await page.locator('#modalHost.open').isVisible());
ok('модалка предупреждает о конкретном пересечении', (await page.locator('#modalHost .warn-inline').innerText()).includes('В-2026-000151'));

// --- T5: заметка вкладки «Охват» описывает реальный триггер пересечения (по кредиту, не по предмету) ---
await page.goto(FILE, { waitUntil: 'load' });
await page.click('#listBody tr[data-id="142"]');
await page.click('#btnOpen');
await page.click('#detailTabbar .dtab >> nth=1');           // вкладка «Охват»
const ohvatNoteText = await page.locator('#detailPanels .detail-panel >> nth=1').locator('.section-note').innerText();
const claimsSameSubjectTrigger = /тот\s+же\s+предмет[\s\S]{0,20}взыскива/i.test(ohvatNoteText);
ok('заметка не утверждает, что триггер — совпадение предмета', !claimsSameSubjectTrigger);
const mentionsOtherActiveProcessByCredit =
  /кредит[\s\S]{0,60}друг(?:ой|ом|им)\s+активн(?:ый|ом|ым)\s+процесс/i.test(ohvatNoteText) ||
  /друг(?:ой|ом|им)\s+активн(?:ый|ом|ым)\s+процесс[\s\S]{0,60}кредит/i.test(ohvatNoteText);
ok('заметка упоминает другой активный процесс по кредиту', mentionsOtherActiveProcessByCredit);

// --- T5: шапка-индикатор ---
await page.goto(FILE, { waitUntil: 'load' });
await page.click('#listBody tr[data-id="142"]');
await page.click('#btnOpen');
const head = page.locator('#detailPanels .phead').first();
ok('4 плитки в шапке', (await head.locator('.dim').count()) === 4);
const srcs = await head.locator('.dim .src').allInnerTexts();
ok('подпись стадии', srcs[0] === 'производная от фазы');
ok('подпись фазы называет меру-основание', srcs[1] === 'по документу-основанию: ИСК-77');
ok('подпись категории с днями', srcs[2] === 'вычислено · 214 дн просрочки');
ok('подпись группы', srcs[3] === 'атрибут заёмщика');
ok('плитка фазы не селектор', (await head.locator('.dim select').count()) === 0);
ok('внизу карточки только «Закрыть»', (await page.locator('#view-detail .footer .btn').count()) === 1);
ok('кнопка называется «Закрыть»', (await page.locator('#view-detail .footer .btn').innerText()).includes('Закрыть'));
ok('OK/Отмена отсутствуют', !(await page.locator('#view-detail .footer').innerText()).includes('Отмена'));

// баннеры трёх типов
const banner = async id => {
  await page.goto(FILE, { waitUntil: 'load' });
  await page.click(`#listBody tr[data-id="${id}"]`);
  await page.click('#btnOpen');
  const b = page.locator('#detailPanels .phead-banner').first();
  return (await b.count()) ? { cls: await b.getAttribute('class'), txt: await b.innerText() } : null;
};
const b151 = await banner('151');
ok('у 151 янтарный баннер паузы', b151 && b151.cls.includes('warn') && b151.txt.includes('Пауза'));
ok('баннер паузы называет scope и дедлайн', b151 && b151.txt.includes('весь процесс') && b151.txt.includes('18.09.2026'));
ok('баннер паузы говорит, что фаза сохранена', b151 && b151.txt.includes('фаза сохранена'));
const b120 = await banner('120');
ok('у 120 синий баннер соглашения', b120 && b120.cls.includes('info') && b120.txt.includes('соглашени'));
ok('баннер соглашения про график, не дедлайн', b120 && b120.txt.includes('график'));
const b133 = await banner('133');
ok('у 133 баннера нет', b133 === null);
ok('CSS для события объявлен', await page.evaluate(() =>
  [...document.styleSheets[0].cssRules].some(r => r.selectorText === '.phead-banner.danger')));

console.log(`\nОШИБОК КОНСОЛИ: ${errors.length}`);
errors.forEach(e => console.log('  ' + e));
console.log(`ПРОВАЛЕНО АССЕРТОВ: ${fails}`);
await ctx.close();
process.exit(fails || errors.length ? 1 : 0);
