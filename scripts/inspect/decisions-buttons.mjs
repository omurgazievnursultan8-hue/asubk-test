import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url';

/* Functional click-through of every button in mockups/decision/decisions.html.
   Asserts real EFFECT (view switch, row change, popup open, status flip),
   not just listener presence. проверено 2026-06-21. */

const file = 'mockups/decision/decisions.html';
const f = pathToFileURL(process.cwd() + '/' + file).href;
const ctx = await chromium.launchPersistentContext('.auth/profile',
  { channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1700, height: 1100 } });
const page = ctx.pages()[0] || await ctx.newPage();
page.on('dialog', d => d.accept());            // auto-accept confirm() (delete/approve/reject)

let pass = 0, fail = 0;
const ok  = (n, c) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

async function fresh(){
  await page.goto(f, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.removeItem('asubk_decisions_v1'));
  await page.reload({ waitUntil: 'networkidle' });
}

const rowCount  = () => page.locator('#rowCount').textContent();
const visible   = id => page.locator('#' + id).evaluate(e => getComputedStyle(e).display !== 'none');
const enabled   = id => page.locator('#' + id).evaluate(e => !e.disabled);
const firstRow  = () => page.locator('#rows tr[data-i]').first();

await fresh();

/* ---- 0. date picker prefills today at load (cleared later on Создать by design) ---- */
ok('date prefilled today at load', /^\d{2}\.\d{2}\.\d{4}$/.test(await page.locator('#decisionDate').inputValue()));

/* ---- 1. default filter (Статус = Одобрен) ---- */
ok('default filter shows 7 Одобрен', (await rowCount()).startsWith('7'));

/* ---- 2. select row enables Edit/View/Delete, NOT Approve/Reject (Одобрен) ---- */
await firstRow().click();
ok('row select -> Изменить enabled',  await enabled('btnEdit'));
ok('row select -> Просмотр enabled',  await enabled('btnView'));
ok('row select -> Удалить enabled',   await enabled('btnDelete'));
ok('Одобрен row -> Одобрить disabled',!(await enabled('btnApprove')));
ok('Одобрен row -> Отклонить disabled',!(await enabled('btnReject')));

/* ---- 3. btnView -> detail view ---- */
await page.locator('#btnView').click();
ok('Просмотр -> detailView visible', await visible('detailView'));
const dTitle = await page.locator('#detailTitle').textContent();
ok('detail title filled', dTitle.length > 1 && dTitle !== '—');

/* ---- 4. detail tabs ---- */
await page.locator('#detailTabs .tab[data-tab="1"]').click();
ok('detail tab Примечание active',
   await page.locator('#detailView .tabpanel[data-panel="1"]').evaluate(e => e.classList.contains('active')));

/* ---- 5. detailEdit (THE FIX) -> create/edit view, prefilled, title=Редактирование ---- */
await page.locator('#detailEdit').click();
ok('detailEdit -> createView visible', await visible('createView'));
const cTitle = await page.locator('#createTitle').textContent();
ok('detailEdit -> title=Редактирование', cTitle.startsWith('Редактирование'));
const nameVal = await page.locator('#createView .create-form .field .control input').first().inputValue();
ok('detailEdit -> name prefilled', nameVal.length > 0);

/* ---- 6. createCancel -> list ---- */
await page.locator('#createCancel').click();
ok('Отмена -> listView visible', await visible('listView'));

/* ---- 7. btnEdit (toolbar) parity ---- */
await page.locator('#rows tr[data-i="1"]').click();   // distinct row (row 0 still selected from step 2)
await page.locator('#btnEdit').click();
ok('toolbar Изменить -> createView', await visible('createView'));
ok('toolbar Изменить -> Редактирование title',
   (await page.locator('#createTitle').textContent()).startsWith('Редактирование'));
await page.locator('#createCancel').click();

/* ---- 8. btnCreate -> empty create form ---- */
await page.locator('#btnCreate').click();
ok('Создать -> createView', await visible('createView'));
ok('Создать -> title=Решение правительства',
   (await page.locator('#createTitle').textContent()) === 'Решение правительства');
const emptyName = await page.locator('#createView .create-form .field .control input').first().inputValue();
ok('Создать -> name empty', emptyName === '');

/* ---- 9. date picker: toggle + pick day ---- */
await page.locator('#calToggle').click();
ok('calToggle -> popup open', await page.locator('.dp-pop.open').count() === 1);
await page.locator('.dp-day:not(.muted)', { hasText: /^15$/ }).first().click();
ok('pick day 15 -> value contains .15.', (await page.locator('#decisionDate').inputValue()).includes('.15.') ||
   /^15\./.test(await page.locator('#decisionDate').inputValue()));
ok('pick day -> popup closed', await page.locator('.dp-pop.open').count() === 0);

/* ---- 10. Вид решения entity-lookup picker ---- */
await page.locator('#createView .lookup .pick').click();
ok('Вид решения pick -> entity lookup open', await page.locator('#lkOverlay.open').count() === 1);
await page.locator('#lkRows tr').first().click();
await page.locator('#lkSelect').click();
ok('lookup select -> val filled',
   await page.locator('#createView .lookup .val').evaluate(e => e.classList.contains('filled')));

/* ---- 11. createOk -> new row, filter switches to На стадии ---- */
await page.locator('#createView .create-form .field .control input').first().fill('КНОПОЧНЫЙ ТЕСТ X');
await page.locator('#createOk').click();
ok('createOk -> back to list', await visible('listView'));
const afterCreate = await page.locator('#rows tr[data-i] td:first-child').allTextContents();
ok('createOk -> new row present', afterCreate.some(t => t.includes('КНОПОЧНЫЙ ТЕСТ')));

/* ---- 12. Approve/Reject on pending row (filter now На стадии) ---- */
await page.locator('#rows tr[data-i]', { hasText: 'КНОПОЧНЫЙ ТЕСТ' }).first().click();
ok('pending row -> Одобрить enabled', await enabled('btnApprove'));
ok('pending row -> Отклонить enabled', await enabled('btnReject'));
const beforeApprove = (await rowCount());
await page.locator('#btnApprove').click();
await page.waitForTimeout(150);
ok('Одобрить -> row leaves На-стадии filter', (await rowCount()) !== beforeApprove);

/* ---- 13. Reject path ---- */
await fresh();
await page.locator('#btnCreate').click();
await page.locator('#createView .create-form .field .control input').first().fill('REJECT ТЕСТ');
await page.locator('#createOk').click();
await page.locator('#rows tr[data-i]', { hasText: 'REJECT ТЕСТ' }).first().click();
await page.locator('#btnReject').click();
await page.waitForTimeout(150);
// switch filter to Закрыт to verify it became Закрыт
await page.locator('#condRows .cond-val').first().click();
await page.locator('#lkRows tr', { hasText: 'Закрыт' }).first().click();
await page.locator('#lkSelect').click();
await page.waitForTimeout(150);
const closed = await page.locator('#rows tr[data-i] td:first-child').allTextContents();
ok('Отклонить -> row now Закрыт', closed.some(t => t.includes('REJECT ТЕСТ')));

/* ---- 14. Delete ---- */
await fresh();
const before = parseInt(await rowCount(), 10);
await firstRow().click();
await page.locator('#btnDelete').click();
await page.waitForTimeout(150);
ok('Удалить -> rowCount decreased', parseInt(await rowCount(), 10) === before - 1);

/* ---- 15. column-visibility menu ---- */
await page.locator('#btnColumns').click();
ok('Столбцы -> menu open', await page.locator('#colMenu.open').count() === 1);
await page.locator('#colMenu input[data-col="1"]').uncheck();
ok('uncheck col -> header hidden',
   await page.locator('#grid thead th:nth-child(2)').evaluate(e => e.style.display === 'none'));
await page.locator('#colMenu input[data-col="1"]').check();

/* ---- 16. filter: collapse, add condition, operator popover, caret reset, settings ---- */
await page.locator('#filterHead').click();   // collapse
ok('filterHead -> panel collapsed',
   await page.locator('#filterWrap').evaluate(e => e.classList.contains('collapsed')));
await page.locator('#filterHead').click();   // expand back

await page.locator('#addCond').click();
ok('Добавить условие -> property lookup open', await page.locator('#lookupOverlay.open').count() === 1);
await page.locator('#lookupRows tr', { hasText: 'Наименование' }).first().click();
await page.locator('#lookupSelect').click();
ok('add condition -> 2 cond rows', await page.locator('#condRows .cond-row').count() === 2);

await page.locator('#condRows .cond-row').first().locator('[data-act=op]').click();
ok('operator chip -> popover open', await page.locator('.fpop').count() === 1);
await page.locator('.fpop-item', { hasText: '<>' }).first().click();
ok('operator changed to <>',
   (await page.locator('#condRows .cond-row').first().locator('[data-act=op]').textContent()).includes('<>'));

await page.locator('#btnApplyCaret').click();
ok('Обновить caret -> popover open', await page.locator('.fpop').count() === 1);
await page.locator('.fpop-item', { hasText: 'Сбросить фильтр' }).click();
ok('Сбросить фильтр -> back to 1 cond row', await page.locator('#condRows .cond-row').count() === 1);

await page.locator('#btnFilterSettings').click();
ok('Настройки фильтра -> popover open', await page.locator('.fpop').count() === 1);
await page.mouse.click(5, 5);

await page.locator('#btnApply').click();
ok('Обновить -> still on list (applies)', await visible('listView'));

/* ---- 17. sidebar nav-group collapse ---- */
const grpOpenBefore = await page.locator('.nav-group').first().evaluate(e => e.classList.contains('open'));
await page.locator('.nav-group .nav-toggle').first().click();
ok('nav-group toggle -> open state flips',
   (await page.locator('.nav-group').first().evaluate(e => e.classList.contains('open'))) !== grpOpenBefore);

/* ---- 18. DEAD buttons — confirm no effect (documented decorative) ---- */
const cntBefore = await rowCount();
await page.locator('.pager button[title="Вперёд"]').first().click().catch(()=>{});
ok('pager ›  -> no row change (decorative)', (await rowCount()) === cntBefore);

const navHref = await page.locator('.nav-item.active').first().evaluate(e => e.getAttribute('href'));
ok('nav-item has no href (decorative stub)', navHref === null);

console.log(`\n==== ${pass} PASS / ${fail} FAIL ====`);
await ctx.close();
process.exit(fail ? 1 : 0);
