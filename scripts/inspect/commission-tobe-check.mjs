// Проверка to-be мокапа комиссий (mockups/loan-application-commission/commission.html).
// Гоняет ключевые сценарии: кворум-гейт, голос члена, фильтр-плитка, Escape в диалоге.
// Запуск: node scripts/inspect/commission-tobe-check.mjs
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const FILE = pathToFileURL(resolve('mockups/loan-application-commission/commission.html')).href;
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.goto(FILE, { waitUntil: 'load' });
const ok = (name, cond) => console.log(`${cond ? '  ok' : 'FAIL'}  ${name}`);

// --- список ---
ok('14 строк в гриде', (await page.locator('#rows tr').count()) === 14);
ok('плитка «Всего комиссий» = 14', (await page.locator('.statcard').nth(1).locator('.sc-num').innerText()) === '14');
ok('статус — чип, не текст', (await page.locator('#row138 .badge.review').count()) === 1);
ok('просрочка 140 подсвечена', (await page.locator('#row140 .badge.overdue').innerText()).includes('Просрочен 2'));
ok('крайний срок 144 = сегодня', (await page.locator('#row144 td:nth-child(6) .badge.review').innerText()) === 'Сегодня');

// «Ждут моего голоса» (роль по умолчанию — председатель): 138, 144, 147, 149
await page.click('.statcard.mine');
ok('фильтр «моя очередь» → 4 строки', (await page.locator('#rows tr').count()) === 4);
ok('чип фильтра появился', (await page.locator('#fChips .chip').count()) === 1);
await page.click('.chip button');
ok('чип снят → 14 строк', (await page.locator('#rows tr').count()) === 14);

// 145 — единственная запись с пройденным гейтом: 3 из 5, кворум 3, протокол № 5
await page.click('#row145');
await page.click('#btnOpen');
ok('145: прогресс 3 из 5', (await page.locator('#c-votetitle').innerText()) === 'Проголосовало 3 из 5');
ok('145: кворум набран', (await page.locator('#c-quorum').innerText()).includes('набран')
  && !(await page.locator('#c-quorum').innerText()).includes('не набран'));
ok('145: гейт пройден — «Одобрить» активна',
  !(await page.locator('#c-final .btn-approve').isDisabled()));
await page.click('#crumbBack');

// --- карточка 138: кворум не набран → решение заблокировано ---
await page.click('#row138');
await page.click('#btnOpen');
ok('прогресс «Проголосовало 0 из 2»', (await page.locator('#c-votetitle').innerText()) === 'Проголосовало 0 из 2');
ok('кворум не набран', (await page.locator('#c-quorum').innerText()).includes('не набран'));
// в #c-final теперь два баннера: гейт (первый) и «что будет после одобрения» (второй, поток A/B)
const gate = await page.locator('#c-final .note-banner').first().innerText();
ok('гейт называет причину (кворум)', gate.includes('Кворум не набран: проголосовало 0 из 2, требуется 2'));
ok('«Одобрить» disabled', await page.locator('#c-final .btn-approve').isDisabled());

// заполняем протокол — кнопки всё ещё заблокированы (нет голосов)
await page.fill('#f-protNo', '7');
ok('«Дата заседания» — календарь, а не текстовое поле',
  (await page.locator('#f-meetDate').getAttribute('type')) === 'date');
ok('дата заседания ограничена сегодняшним днём',
  (await page.locator('#f-meetDate').getAttribute('max')) === '2026-07-10');
await page.fill('#f-meetDate', '2026-07-10');   // «Дата заседания» — <input type="date">, значение в ISO
ok('дата легла в модель в дд.мм.гггг',
  (await page.evaluate(() => RECORDS.find(r => r.id === '138').meetDate)) === '10.07.2026');
ok('после протокола гейт всё ещё держит (нет кворума)', await page.locator('#c-final .btn-approve').isDisabled());

// --- голос председателя ---
await page.click('#c-members .btn-primary');
ok('диалог отзыва открыт', await page.locator('#ovVote.open').isVisible());
await page.click('#ovVote .btn-primary');            // без «Решения»
ok('пустое «Решение» → ошибка валидации', await page.locator('#v-dec-err.show').isVisible());
await page.selectOption('#v-dec', 'approve');
await page.selectOption('#v-risk', 'Низкий');
await page.fill('#v-cmt', 'Возражений нет.');
await page.click('#ovVote .btn-primary');
ok('диалог закрылся', !(await page.locator('#ovVote.open').isVisible()));
ok('голос виден в гриде состава', (await page.locator('#c-members .badge.approved').count()) === 1);
ok('прогресс 1 из 2', (await page.locator('#c-votetitle').innerText()) === 'Проголосовало 1 из 2');
ok('кворум 2 — всё ещё не набран', await page.locator('#c-final .btn-approve').isDisabled());

// --- голос второго члена: кворум набран → решение доступно ---
await page.selectOption('#roleSel', 'member');
await page.click('#c-members .btn-primary');
await page.selectOption('#v-dec', 'approve');
await page.click('#ovVote .btn-primary');
ok('прогресс 2 из 2', (await page.locator('#c-votetitle').innerText()) === 'Проголосовало 2 из 2');
ok('член комиссии не видит форму решения',
  (await page.locator('#c-final .note-banner').innerText()).includes('председатель'));

await page.selectOption('#roleSel', 'chair');
ok('председатель: гейт пройден', !(await page.locator('#c-final .btn-approve').isDisabled()));
ok('баннер «кворум набран»', (await page.locator('#c-final .note-banner.ok').innerText()).includes('Кворум набран'));

// --- подтверждение называет действие и запись ---
await page.click('#c-final .btn-reject');
const msg = await page.locator('#confirmMsg').innerText();
ok('подтверждение называет действие+запись', msg.includes('Отклонить') && msg.includes('К-2026-000138'));
ok('деструктив — красная кнопка', (await page.locator('#confirmOk').getAttribute('class')).includes('btn-danger'));
await page.keyboard.press('Escape');
ok('Escape закрыл подтверждение', !(await page.locator('#ovConfirm.open').isVisible()));

// --- запись 140: кворум набран (2 из 3), но гейт держит на протоколе ---
await page.click('.crumb-back');
await page.click('#row140');
await page.click('#btnOpen');
ok('140: прогресс 2 из 3', (await page.locator('#c-votetitle').innerText()) === 'Проголосовало 2 из 3');
ok('140: кворум 2 набран', (await page.locator('#c-quorum').innerText()).includes('набран'));
ok('140: гейт держит на протоколе',
  (await page.locator('#c-final .note-banner.warn').innerText()).includes('Не заполнен номер протокола'));

// --- Escape в форме отзыва с вводом → защита потери ввода ---
await page.selectOption('#roleSel', 'member');
ok('140: ДАДАБАЕВА уже голосовала — кнопки голоса нет',
  (await page.locator('#c-members .btn-primary').count()) === 0);
await page.click('.crumb-back');
await page.click('#row138');
await page.click('#btnOpen');
ok('138: свой голос подан — баннер ok',
  (await page.locator('#c-gate-vote .note-banner.ok').innerText()).includes('Ваш голос подан'));

// --- регрессии вёрстки, пойманные на скриншоте ---
ok('скрытый бейдж «роль не голосует» действительно скрыт',
  !(await page.locator('#c-mine-hint').isVisible()));
await page.selectOption('#roleSel', 'sec');
ok('секретарь: бейдж «роль не голосует» показан',
  (await page.locator('#c-mine-hint').innerText()).includes('не голосует'));
await page.click('.crumb-back');
await page.click('#row140');
await page.click('#btnOpen');
const emptyCmt = page.locator('#c-members tr').nth(2).locator('.cmt.none');
ok('пустой комментарий — прочерк, не dashed-блок',
  (await emptyCmt.innerText()) === '—'
  && (await emptyCmt.evaluate(el => getComputedStyle(el).borderStyle)) === 'none');
ok('свёрнутый фильтр-счётчик скрыт при пустом фильтре', !(await page.locator('#fCount').isVisible()));

// «Показать полностью» — по факту обрезки, не по длине строки
const rowChair = page.locator('#c-members tr').nth(0);
ok('обрезанный комментарий председателя получил «Показать полностью»',
  await rowChair.locator('.cmt-more').isVisible());
ok('пустой комментарий ИСАКОВА кнопки не получил',
  !(await page.locator('#c-members tr').nth(2).locator('.cmt-more').isVisible()));
await rowChair.locator('.cmt-more').click();
ok('раскрытый комментарий переносится по строкам',
  (await rowChair.locator('.cmt').evaluate(el => getComputedStyle(el).whiteSpace)) === 'normal');
ok('кнопка стала «Свернуть»', (await rowChair.locator('.cmt-more').innerText()) === 'Свернуть');

console.log('\nConsole errors:', errors.length ? errors : 'нет');
await page.screenshot({ path: '.auth/commission-tobe.png', fullPage: true });
await ctx.close();
