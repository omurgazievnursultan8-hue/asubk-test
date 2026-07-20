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

// --- Находка 3 (финальное ревью): мёртвый хелпер esc() удалён (экранирование делает escAttr) ---
ok('esc() больше не объявлена', (await page.evaluate(() => typeof esc)) === 'undefined');

// --- T1: список ---
ok('6 процессов в гриде', (await page.locator('#listBody tr').count()) === 6);
ok('№ процесса структурный', (await page.locator('#listBody tr[data-id="142"] td').first().innerText()) === 'В-2026-000142');
ok('«Открыть процесс» заблокирована до выбора', await page.locator('#btnOpen').isDisabled());
await page.click('#listBody tr[data-id="142"]');
ok('после выбора строки кнопка активна', !(await page.locator('#btnOpen').isDisabled()));
await page.click('#btnOpen');
ok('карточка имеет вкладки', (await page.locator('#detailTabbar .dtab').count()) >= 7);
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
await page.click('#detailTabbar .dtab:has-text("Охват")');
const ohvat = page.locator('#detailPanels .detail-panel.active');
ok('плашка пересечения видна', await ohvat.locator('.overlap-note').isVisible());
ok('плашка называет соседний процесс', (await ohvat.locator('.overlap-note').innerText()).includes('В-2026-000151'));
await ohvat.locator('.overlap-note .rowlink').click();
ok('ссылка открыла соседний процесс', (await page.locator('#crumbTitle').innerText()).includes('В-2026-000151'));

// у 133 плашки нет
await page.click('#detailPanels');                            // фокус, не важно
await page.goto(FILE, { waitUntil: 'load' });
await page.click('#listBody tr[data-id="133"]');
await page.click('#btnOpen');
await page.click('#detailTabbar .dtab:has-text("Охват")');
ok('у 133 плашки нет', (await page.locator('#detailPanels .detail-panel.active').locator('.overlap-note').count()) === 0);

// модалка «Добавить кредит» предупреждает по реальным данным
await page.goto(FILE, { waitUntil: 'load' });
await page.click('#listBody tr[data-id="142"]');
await page.click('#btnOpen');
await page.click('#detailTabbar .dtab:has-text("Охват")');
await page.click('#detailPanels .detail-panel.active >> .gtoolbar .btn');
ok('модалка охвата открыта', await page.locator('#modalHost.open').isVisible());
ok('модалка предупреждает о конкретном пересечении', (await page.locator('#modalHost .warn-inline').innerText()).includes('В-2026-000151'));

// --- T5: заметка вкладки «Охват» описывает реальный триггер пересечения (по кредиту, не по предмету) ---
await page.goto(FILE, { waitUntil: 'load' });
await page.click('#listBody tr[data-id="142"]');
await page.click('#btnOpen');
await page.click('#detailTabbar .dtab:has-text("Охват")');
const ohvatNoteText = await page.locator('#detailPanels .detail-panel.active').locator('.section-note').innerText();
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
// 133: единственный процесс с механизмом «Событие» (решение ревью — навесить на 133,
// чтобы красная ветка overlayBanner/panelSpecial была видна вживую, а не только в коде).
const b133 = await banner('133');
ok('у 133 красный баннер события', b133 && b133.cls.includes('danger') && b133.txt.includes('Событие'));
ok('баннер события у 133 говорит про спецпроцедуру', b133 && b133.txt.includes('спецпроцедур'));
ok('баннер события у 133 говорит, что фаза сохранена', b133 && b133.txt.includes('фаза сохранена'));
ok('фаза 133 в шапке карточки НЕ меняется механизмом «Событие» (осталась «Повторная претензия»)',
  (await page.locator('#detailPanels .phead-dims .dim').nth(1).locator('.dv').innerText()) === 'Повторная претензия');
ok('CSS для события объявлен', await page.evaluate(() =>
  [...document.styleSheets[0].cssRules].some(r => r.selectorText === '.phead-banner.danger')));

// --- T6: журнал мер ---
// Инвариант вместо хрупкой проверки по числу: любой вид меры, встречающийся хоть у одного
// процесса в данных, обязан быть в справочнике MEASURE_KINDS (иначе дропдаун «Зарегистрировать
// меру» не сможет породить меру, которая уже есть в журнале). Плюс MILESTONE_KINDS и
// NEEDS_DELIVERY не должны содержать «сирот» — видов, отсутствующих в самом справочнике.
await page.goto(FILE, { waitUntil: 'load' });
const kinds = await page.evaluate(() => {
  const dataKinds = [...new Set(PROCESSES.flatMap(p => p.measures.map(m => m.kind)))];
  const missingFromDict = dataKinds.filter(k => !MEASURE_KINDS.includes(k));
  const milestoneOrphans = [...MILESTONE_KINDS].filter(k => !MEASURE_KINDS.includes(k));
  const deliveryOrphans = [...NEEDS_DELIVERY].filter(k => !MEASURE_KINDS.includes(k));
  return {
    missingFromDict, milestoneOrphans, deliveryOrphans,
    milestoneIsk: isMilestone('Исковое заявление'),
    milestoneApel: isMilestone('Апелляционная жалоба'),
    needsPret: needsDelivery('Первичная претензия'),
    needsIl: needsDelivery('Исполнительный лист'),
  };
});
ok(`каждый вид меры из данных процессов есть в MEASURE_KINDS${kinds.missingFromDict.length ? ' (отсутствуют: ' + kinds.missingFromDict.join(', ') + ')' : ''}`,
  kinds.missingFromDict.length === 0);
ok(`MILESTONE_KINDS ⊆ MEASURE_KINDS${kinds.milestoneOrphans.length ? ' (сироты: ' + kinds.milestoneOrphans.join(', ') + ')' : ''}`,
  kinds.milestoneOrphans.length === 0);
ok(`NEEDS_DELIVERY ⊆ MEASURE_KINDS${kinds.deliveryOrphans.length ? ' (сироты: ' + kinds.deliveryOrphans.join(', ') + ')' : ''}`,
  kinds.deliveryOrphans.length === 0);
ok('иск — веха', kinds.milestoneIsk === true);
ok('апелляция — НЕ веха (мера внутри фазы)', kinds.milestoneApel === false);
ok('претензия требует вручения', kinds.needsPret === true);
ok('исполнительный лист вручения не требует', kinds.needsIl === false);

// 133: мера ПР-233 без подтверждения вручения → помечена
await page.click('#listBody tr[data-id="133"]');
await page.click('#btnOpen');
await page.click('#detailTabbar .dtab:has-text("Журнал мер")');
const mery = page.locator('#detailPanels .detail-panel.active');
ok('неисполненная мера помечена', (await mery.locator('tr.mrow-undelivered').count()) === 1);
ok('пометка объясняет причину', (await mery.locator('tr.mrow-undelivered').innerText()).includes('не исполнена'));

// таймлайн — досудебная цепочка из 3 фаз, текущая «Повторная претензия»
ok('таймлайн досудебной стадии — 3 шага', (await mery.locator('.tl-step').count()) === 3);
ok('текущий шаг — второй', (await mery.locator('.tl-step >> nth=1 >> .tl-dot').getAttribute('class')).includes('cur'));
ok('первый шаг пройден', (await mery.locator('.tl-step >> nth=0 >> .tl-dot').innerText()) === '✓');

// таймлайн 142 — принудительная цепочка из 5 фаз
await page.goto(FILE, { waitUntil: 'load' });
await page.click('#listBody tr[data-id="142"]');
await page.click('#btnOpen');
await page.click('#detailTabbar .dtab:has-text("Журнал мер")');
ok('таймлайн принудительной стадии — 5 шагов', (await page.locator('#detailPanels .detail-panel.active >> .tl-step').count()) === 5);

// модалка меры: предупреждение о сдвиге фазы условное
await page.click('#detailPanels .detail-panel.active >> .gtoolbar .btn');
ok('модалка меры открыта', await page.locator('#modalHost.open').isVisible());
await page.selectOption('#mKind', 'Исковое заявление');
ok('для вехи предупреждение о фазе видно', await page.locator('#mWarnPhase').isVisible());
await page.selectOption('#mKind', 'Апелляционная жалоба');
ok('для не-вехи предупреждение о фазе скрыто', !(await page.locator('#mWarnPhase').isVisible()));
await page.selectOption('#mKind', 'Первичная претензия');
ok('для претензии видно предупреждение о вручении', await page.locator('#mWarnDelivery').isVisible());
await page.selectOption('#mKind', 'Исполнительный лист');
ok('для ИЛ предупреждение о вручении скрыто', !(await page.locator('#mWarnDelivery').isVisible()));

// --- T7: Escape и подложка ---
await page.goto(FILE, { waitUntil: 'load' });
await page.click('#listBody tr[data-id="142"]');
await page.click('#btnOpen');
await page.click('#detailTabbar .dtab:has-text("Журнал мер")');
await page.click('#detailPanels .detail-panel.active >> .gtoolbar .btn');
ok('модалка открыта', await page.locator('#modalHost.open').isVisible());
await page.keyboard.press('Escape');
ok('Escape закрыл модалку', !(await page.locator('#modalHost').evaluate(e => e.classList.contains('open'))));
await page.click('#detailPanels .detail-panel.active >> .gtoolbar .btn');
await page.mouse.click(20, 20);   // клик по подложке вне окна модалки
ok('клик по подложке закрыл модалку', !(await page.locator('#modalHost').evaluate(e => e.classList.contains('open'))));

// --- T8: особые состояния / передачи / залог ---
await page.goto(FILE, { waitUntil: 'load' });
const noFake = await page.evaluate(() =>
  PROCESSES.every(p => p.special.every(s => s.name !== '—')));
ok('фейковых строк-заглушек в данных нет', noFake);
const noFilter = await page.evaluate(() => panelSpecial.toString().includes("!=='—'"));
ok('костыль-фильтр убран из panelSpecial', noFilter === false);

// 142: особых состояний нет → честное пустое состояние
await page.click('#listBody tr[data-id="142"]');
await page.click('#btnOpen');
await page.click('#detailTabbar .dtab:has-text("Особые состояния")');
ok('у 142 пустое состояние', (await page.locator('#detailPanels .detail-panel.active >> .cgrid-empty').count()) === 1);

// 151: пауза одной строкой
await page.goto(FILE, { waitUntil: 'load' });
await page.click('#listBody tr[data-id="151"]');
await page.click('#btnOpen');
await page.click('#detailTabbar .dtab:has-text("Особые состояния")');
const sp151 = page.locator('#detailPanels .detail-panel.active');
ok('у 151 одна строка особого состояния', (await sp151.locator('tbody tr').count()) === 1);
ok('строка — пауза', (await sp151.locator('tbody tr .pill').innerText()) === 'пауза');
ok('дедлайн паузы в строке', (await sp151.locator('tbody tr').innerText()).includes('18.09.2026'));

// 104: отклонённая передача с причиной + залог с причиной запрета
await page.goto(FILE, { waitUntil: 'load' });
await page.click('#listBody tr[data-id="104"]');
await page.click('#btnOpen');
await page.click('#detailTabbar .dtab:has-text("Передачи дела")');
const ho = page.locator('#detailPanels .detail-panel.active');
ok('три передачи у 104', (await ho.locator('tbody tr').count()) === 3);
ok('одна отклонена', (await ho.locator('tbody tr .pill.high').count()) === 1);
ok('причина отклонения показана', (await ho.innerText()).includes('нет акта несостоявшихся торгов'));

await page.click('#detailTabbar .dtab:has-text("Залог")');
const zl = page.locator('#detailPanels .detail-panel.active');
ok('запрет внесудебного с причиной', (await zl.locator('tbody tr .pill.high').innerText()) === 'имущественный комплекс');
ok('статус реализации показан', (await zl.innerText()).includes('торги не состоялись'));

// 142: залога нет → пустое состояние
await page.goto(FILE, { waitUntil: 'load' });
await page.click('#listBody tr[data-id="142"]');
await page.click('#btnOpen');
await page.click('#detailTabbar .dtab:has-text("Залог")');
ok('у 142 залога нет', (await page.locator('#detailPanels .detail-panel.active >> .cgrid-empty').count()) === 1);

// 151: залог без запрета → тире, не пустая метка
await page.goto(FILE, { waitUntil: 'load' });
await page.click('#listBody tr[data-id="151"]');
await page.click('#btnOpen');
await page.click('#detailTabbar .dtab:has-text("Залог")');
const zl151 = page.locator('#detailPanels .detail-panel.active');
ok('у 151 запрета нет — тире, не пустая метка', (await zl151.locator('tbody tr').innerText()).trim().endsWith('—'));
ok('у 151 нет пустого pill high', (await zl151.locator('tbody tr .pill.high').count()) === 0);

// 120: залог без запрета → тире, не пустая метка
await page.goto(FILE, { waitUntil: 'load' });
await page.click('#listBody tr[data-id="120"]');
await page.click('#btnOpen');
await page.click('#detailTabbar .dtab:has-text("Залог")');
const zl120 = page.locator('#detailPanels .detail-panel.active');
ok('у 120 запрета нет — тире, не пустая метка', (await zl120.locator('tbody tr').innerText()).trim().endsWith('—'));
ok('у 120 нет пустого pill high', (await zl120.locator('tbody tr .pill.high').count()) === 0);

// 133: особое состояние — событие (красная метка), фаза в данных не тронута
await page.goto(FILE, { waitUntil: 'load' });
await page.click('#listBody tr[data-id="133"]');
await page.click('#btnOpen');
await page.click('#detailTabbar .dtab:has-text("Особые состояния")');
const sp133 = page.locator('#detailPanels .detail-panel.active');
const sp133Rows = await sp133.locator('tbody tr').count();
ok('у 133 одна строка особого состояния', sp133Rows === 1);
const sp133PillCount = await sp133.locator('tbody tr .pill').count();
ok('строка — событие', sp133PillCount === 1 && (await sp133.locator('tbody tr .pill').innerText()) === 'событие');
ok('строка — красная метка (pill high)', (await sp133.locator('tbody tr .pill.high').count()) === 1);
const sp133Text = sp133Rows ? await sp133.locator('tbody tr').innerText() : '';
ok('примечание упоминает установление правопреемника', sp133Text.includes('правопреемник'));

// 120: особое состояние — соглашение (синяя метка)
await page.goto(FILE, { waitUntil: 'load' });
await page.click('#listBody tr[data-id="120"]');
await page.click('#btnOpen');
await page.click('#detailTabbar .dtab:has-text("Особые состояния")');
const sp120 = page.locator('#detailPanels .detail-panel.active');
ok('у 120 метка — соглашение', (await sp120.locator('tbody tr .pill').innerText()) === 'соглашение');

// --- T9: роль, сортировка, приёмка ---
await page.goto(FILE, { waitUntil: 'load' });
const roles = await page.locator('#roleSel option').allInnerTexts();
ok('5 ролей в переключателе', roles.length === 5);
ok('роли модуля перечислены', roles.includes('Отдел проблемных кредитов') && roles.includes('Наблюдатель'));
await page.selectOption('#roleSel', 'Наблюдатель');
ok('смена роли даёт тост', (await page.locator('#toastWrap .toast').innerText()).includes('Наблюдатель'));

// сортировка по клику на заголовок
const firstId = () => page.locator('#listBody tr').first().getAttribute('data-id');
await page.click('#listHead th >> nth=0');
const asc = await firstId();
await page.click('#listHead th >> nth=0');
const desc = await firstId();
ok('сортировка по № переворачивается', asc !== desc);

// каждая из вкладок непуста у каждого процесса
for(const id of ['142','151','133','120','104','097']){
  await page.goto(FILE, { waitUntil: 'load' });
  await page.click(`#listBody tr[data-id="${id}"]`);
  await page.click('#btnOpen');
  const tabCount = await page.locator('#detailTabbar .dtab').count();
  for(let t=0; t<tabCount; t++){
    await page.click(`#detailTabbar .dtab >> nth=${t}`);
    const txt = (await page.locator(`#detailPanels .detail-panel >> nth=${t}`).innerText()).trim();
    ok(`процесс ${id}, вкладка ${t+1} непуста`, txt.length > 40);
  }
}

// фаза нигде не редактируется селектором
await page.goto(FILE, { waitUntil: 'load' });
await page.click('#listBody tr[data-id="142"]');
await page.click('#btnOpen');
ok('в карточке нет селектора фазы', (await page.locator('#detailPanels select').count()) === 0);

// --- T10: колонка «Фаза» — метка оверлея должна помещаться целиком (регрессия ревью) ---
// Запас против нестабильного рендера на границе пикселя: правый край метки .pill должен
// оставаться минимум на 4px внутри правого края ячейки, а не просто не вылезать за него.
const PILL_MARGIN_PX = 4;
const pillMargin = (pillBox, cellBox) => (cellBox.x + cellBox.width) - (pillBox.x + pillBox.width);

// 120 «На исполнении» + метка «соглашение» — самая длинная комбинация фазы+оверлея в данных.
await page.goto(FILE, { waitUntil: 'load' });
const phaseCell120 = page.locator('#listBody tr[data-id="120"] td').nth(3);
const cellBox120 = await phaseCell120.boundingBox();
const pillBox120 = await phaseCell120.locator('.pill').boundingBox();
ok('120: метка «соглашение» внутри ячейки «Фаза» с запасом ≥4px от правого края',
  !!pillBox120 && !!cellBox120 && pillMargin(pillBox120, cellBox120) >= PILL_MARGIN_PX);
const sc120 = await phaseCell120.evaluate(td => ({ sw: td.scrollWidth, cw: td.clientWidth }));
ok('120: ячейка «Фаза» не обрезана (scrollWidth<=clientWidth)', sc120.sw <= sc120.cw);

// 151 «Извещение» + «пауза» — текст короче, но не должен был случайно сломаться при расширении колонки.
const phaseCell151 = page.locator('#listBody tr[data-id="151"] td').nth(3);
const cellBox151 = await phaseCell151.boundingBox();
const pillBox151 = await phaseCell151.locator('.pill').boundingBox();
ok('151: метка «пауза» внутри ячейки «Фаза» с запасом ≥4px от правого края',
  !!pillBox151 && !!cellBox151 && pillMargin(pillBox151, cellBox151) >= PILL_MARGIN_PX);
const sc151 = await phaseCell151.evaluate(td => ({ sw: td.scrollWidth, cw: td.clientWidth }));
ok('151: ячейка «Фаза» не обрезана', sc151.sw <= sc151.cw);

// 133 «Повторная претензия» (20 симв.) + «событие» — самый длинный текст фазы в данных.
const phaseCell133 = page.locator('#listBody tr[data-id="133"] td').nth(3);
const cellBox133 = await phaseCell133.boundingBox();
const hasPill133 = (await phaseCell133.locator('.pill').count()) > 0;
const pillBox133 = hasPill133 ? await phaseCell133.locator('.pill').boundingBox() : null;
ok('133: метка «событие» внутри ячейки «Фаза» с запасом ≥4px от правого края',
  !!pillBox133 && !!cellBox133 && pillMargin(pillBox133, cellBox133) >= PILL_MARGIN_PX);
const sc133 = await phaseCell133.evaluate(td => ({ sw: td.scrollWidth, cw: td.clientWidth }));
ok('133: ячейка «Фаза» не обрезана (scrollWidth<=clientWidth)', sc133.sw <= sc133.cw);
ok('133: текст фазы в списке — «Повторная претензия»', (await phaseCell133.innerText()).includes('Повторная претензия'));
ok('133: метка в списке — «событие»', (await phaseCell133.innerText()).includes('событие'));

// терминальные 097/104 показывают исход в колонке «Фаза» — тоже длинный текст, тоже не должен обрезаться.
for (const id of ['097', '104']) {
  const cell = page.locator(`#listBody tr[data-id="${id}"] td`).nth(3);
  const sc = await cell.evaluate(td => ({ sw: td.scrollWidth, cw: td.clientWidth }));
  ok(`${id}: терминальный исход в «Фазе» не обрезан`, sc.sw <= sc.cw);
}

// Полное покрытие: ни один заголовок (7 th), ни одна ячейка (6 строк × 7 колонок) не обрезаны —
// проверка не только колонки «Фаза», а всей раскладки после перераспределения ширин.
const headOverflow = await page.locator('#listHead th').evaluateAll(
  ths => ths.map(th => ({ sw: th.scrollWidth, cw: th.clientWidth })));
ok(`все 7 заголовков не обрезаны (scrollWidth<=clientWidth)`, headOverflow.length === 7 &&
  headOverflow.every(({ sw, cw }) => sw <= cw));
const cellOverflow = await page.locator('#listBody tr').evaluateAll(
  trs => trs.flatMap(tr => [...tr.children].map(td => ({ sw: td.scrollWidth, cw: td.clientWidth }))));
ok(`все 42 ячейки (6×7) не обрезаны (scrollWidth<=clientWidth)`, cellOverflow.length === 42 &&
  cellOverflow.every(({ sw, cw }) => sw <= cw));

// title с полным текстом у обрезаемых колонок: Заёмщик, Охват, Фаза, Владелец (конвенция commission.html).
for (const id of ['120', '151', '133', '142', '097', '104']) {
  const tr = page.locator(`#listBody tr[data-id="${id}"]`);
  const borrowerTitle = await tr.locator('td').nth(1).getAttribute('title');
  const scopeTitle = await tr.locator('td').nth(2).getAttribute('title');
  const phaseTitle = await tr.locator('td').nth(3).getAttribute('title');
  const ownerTitle = await tr.locator('td').nth(6).getAttribute('title');
  ok(`${id}: title у «Заёмщик» непустой`, !!borrowerTitle);
  ok(`${id}: title у «Охват» непустой`, !!scopeTitle);
  ok(`${id}: title у «Фаза» непустой`, !!phaseTitle);
  ok(`${id}: title у «Владелец» непустой`, !!ownerTitle);
}
const phaseTitle120 = await page.locator('#listBody tr[data-id="120"] td').nth(3).getAttribute('title');
ok('120: title «Фазы» включает и саму фазу, и метку оверлея',
  !!phaseTitle120 && phaseTitle120.includes('На исполнении') && phaseTitle120.toLowerCase().includes('соглашение'));
const phaseTitle151 = await page.locator('#listBody tr[data-id="151"] td').nth(3).getAttribute('title');
ok('151: title «Фазы» включает и саму фазу, и метку оверлея',
  !!phaseTitle151 && phaseTitle151.includes('Извещение') && phaseTitle151.toLowerCase().includes('пауза'));
const phaseTitle133 = await page.locator('#listBody tr[data-id="133"] td').nth(3).getAttribute('title');
ok('133: title «Фазы» включает и саму фазу, и метку оверлея (событие)',
  !!phaseTitle133 && phaseTitle133.includes('Повторная претензия') && phaseTitle133.toLowerCase().includes('событие'));
const phaseTitle104 = await page.locator('#listBody tr[data-id="104"] td').nth(3).getAttribute('title');
ok('104: title «Фазы» — исход терминального процесса', !!phaseTitle104 && phaseTitle104.includes('Принятие имущества'));
const phaseTitle097 = await page.locator('#listBody tr[data-id="097"] td').nth(3).getAttribute('title');
ok('097: title «Фазы» — исход терминального процесса', !!phaseTitle097 && phaseTitle097.includes('Безнадёжный долг'));

// === #1 Расчёт долга ===
await page.goto(FILE, { waitUntil: 'load' });
const fin = await page.evaluate(() => ({
  hasFmt: typeof fmtKGS === 'function',
  fmt: typeof fmtKGS === 'function' && fmtKGS(40000),
  hasLeft: typeof debtLeft === 'function',
  left: typeof debtLeft === 'function' && debtLeft({accrued:48900, paid:900}),
  // инвариант сумм: итог начислено = сумма меры-основания фазы, для всех процессов
  invariantOk: (typeof phaseMeasureSum === 'function') && PROCESSES.every(p => {
    const c = p.credits[0];
    if (!c || !c.debt) return false;
    const acc = ['principal','interest','penalty','fees'].reduce((s,k)=>s+c.debt[k].accrued, 0);
    const ms = phaseMeasureSum(p);
    return ms === null ? false : Math.abs(acc - ms) < 0.005;
  }),
  penaltyNote151: PROCESSES.find(p=>p.id==='151').credits[0].debt.penalty.note || '',
  writtenOff097: !!PROCESSES.find(p=>p.id==='097').credits[0].writtenOff,
}));
ok('fmtKGS форматирует с пробелом-разделителем', fin.fmt === '40 000,00');
ok('debtLeft = начислено − погашено', fin.left === 48000);
ok('инвариант: итог по статьям = сумма меры-основания фазы (все процессы)', fin.invariantOk === true);
ok('у 151 пеня несёт метку открытого вопроса (пауза)', /откр|пауз/i.test(fin.penaltyNote151));
ok('у 097 требование помечено «списано»', fin.writtenOff097 === true);

await page.click('#listBody tr[data-id="142"]');
await page.click('#btnOpen');
ok('после Task 2 вкладок 9', (await page.locator('#detailTabbar .dtab').count()) === 9);
await page.click('#detailTabbar .dtab:has-text("Расчёт долга")');
const rasch = page.locator('#detailPanels .detail-panel.active');
ok('в «Расчёт долга» есть итоговая строка', (await rasch.locator('table.cgrid tr.total').count()) >= 1);
ok('итог 142 = 48 900,00', (await rasch.locator('table.cgrid tr.total').first().innerText()).includes('48 900,00'));

// === #2 Заседания ===
await page.goto(FILE, { waitUntil: 'load' });
await page.click('#listBody tr[data-id="142"]');
await page.click('#btnOpen');
ok('после Task 3 вкладок 9', (await page.locator('#detailTabbar .dtab').count()) === 9);
await page.click('#detailTabbar .dtab:has-text("Заседания")');
const hear = page.locator('#detailPanels .detail-panel.active');
ok('у 142 три заседания', (await hear.locator('table.cgrid tbody tr').count()) === 3);
ok('заседание ссылается на меру ИСК-77', (await hear.innerText()).includes('ИСК-77'));
ok('есть подстатус отложения', /отлож/i.test(await hear.innerText()));
ok('есть место — районный суд', /районный суд/i.test(await hear.innerText()));
// у досудебного 133 — пустое состояние
await page.goto(FILE, { waitUntil: 'load' });
await page.click('#listBody tr[data-id="133"]');
await page.click('#btnOpen');
await page.click('#detailTabbar .dtab:has-text("Заседания")');
ok('у 133 заседаний нет (пустое состояние)', (await page.locator('#detailPanels .detail-panel.active .cgrid-empty').count()) === 1);

// === #5 Ответственный ===
await page.goto(FILE, { waitUntil: 'load' });
await page.click('#listBody tr[data-id="142"]');
await page.click('#btnOpen');
await page.click('#detailTabbar .dtab:has-text("Журнал мер")');
const meryResp = page.locator('#detailPanels .detail-panel.active');
ok('в «Журнале мер» есть колонка «Ответственный»', (await meryResp.locator('thead th:has-text("Ответственный")').count()) === 1);
ok('ФИО ответственного отрисовано', /Тукинова|Танаев|Осмонов/.test(await meryResp.innerText()));

// === #4 Вложения ===
await page.goto(FILE, { waitUntil: 'load' });
await page.click('#listBody tr[data-id="142"]');
await page.click('#btnOpen');
await page.click('#detailTabbar .dtab:has-text("Журнал мер")');
const meryDocs = page.locator('#detailPanels .detail-panel.active');
ok('в «Журнале мер» есть колонка «Вложения»', (await meryDocs.locator('thead th:has-text("Вложения")').count()) === 1);
ok('есть кнопка-скрепка со счётчиком', (await meryDocs.locator('button.docs-btn').first().isVisible()));
await meryDocs.locator('button.docs-btn').first().click();
ok('модалка вложений открылась', await page.locator('#modalHost.open').isVisible());
ok('в модалке перечислены сканы', /квитанц|скан|\.pdf/i.test(await page.locator('#modalHost').innerText()));
await page.keyboard.press('Escape');
ok('модалка вложений закрылась по Escape', !(await page.locator('#modalHost.open').isVisible()));

// === #6 Состояние претензии + аннулирование ===
await page.goto(FILE, { waitUntil: 'load' });
await page.click('#listBody tr[data-id="133"]');
await page.click('#btnOpen');
await page.click('#detailTabbar .dtab:has-text("Журнал мер")');
const meryReg = page.locator('#detailPanels .detail-panel.active');
ok('у 133 есть мера-черновик (pill «черновик»)', (await meryReg.locator('.pill:has-text("черновик")').count()) >= 1);
ok('есть кнопка «Аннулировать»', (await meryReg.locator('button:has-text("Аннулировать")').first().isVisible()));
// аннулирование меры-вехи показывает откат фазы
await meryReg.locator('button:has-text("Аннулировать")').first().click();
ok('аннулирование меры-вехи даёт тост об откате фазы', /откач|фаз/i.test(await page.locator('#toastWrap').innerText()));

console.log(`\nОШИБОК КОНСОЛИ: ${errors.length}`);
errors.forEach(e => console.log('  ' + e));
console.log(`ПРОВАЛЕНО АССЕРТОВ: ${fails}`);
await ctx.close();
process.exit(fails || errors.length ? 1 : 0);
