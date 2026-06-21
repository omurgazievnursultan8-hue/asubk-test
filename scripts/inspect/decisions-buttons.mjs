import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url';

/* Functional click-through of every button in mockups/decision/decisions.html.
   Asserts real EFFECT (view switch, row change, popup open, status flip),
   not just listener presence. Covers R1 approve-gating, R2 reason modal +
   reactivate (Вернуть на рассмотрение), R4 delete rules. проверено 2026-06-21. */

const file = 'mockups/decision/decisions.html';
const f = pathToFileURL(process.cwd() + '/' + file).href;
const ctx = await chromium.launchPersistentContext('.auth/profile',
  { channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1700, height: 1100 } });
const page = ctx.pages()[0] || await ctx.newPage();
page.on('dialog', d => d.accept());            // auto-accept confirm()/alert() (delete/approve/reject blocks)

let pass = 0, fail = 0;
const ok  = (n, c) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

async function fresh(){
  await page.goto(f, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.removeItem('asubk_decisions_v2'));   // current LS key
  await page.reload({ waitUntil: 'networkidle' });
}

const rowCount  = () => page.locator('#rowCount').textContent();
const visible   = id => page.locator('#' + id).evaluate(e => getComputedStyle(e).display !== 'none');
const enabled   = id => page.locator('#' + id).evaluate(e => !e.disabled);
const firstRow  = () => page.locator('#rows tr[data-i]').first();
/* switch the default status condition to a given value via its lookup */
async function setStatusFilter(value){
  await page.locator('#condRows .cond-val').first().click();
  await page.locator('#lkRows tr', { hasText: value }).first().click();
  await page.locator('#lkSelect').click();
  await page.waitForTimeout(150);
}

await fresh();

/* ---- 0. date picker prefills today at load (cleared later on Создать by design) ---- */
ok('date prefilled today at load', /^\d{2}\.\d{2}\.\d{4}$/.test(await page.locator('#decisionDate').inputValue()));

/* ---- 1. default filter (Статус = Одобрен) ---- */
ok('default filter shows 7 Одобрен', (await rowCount()).startsWith('7'));

/* ---- 2. select Одобрен row: Edit/View enabled; Approve/Reject/Reactivate/Delete disabled (R4/R7) ---- */
await firstRow().click();
ok('row select -> Изменить enabled',  await enabled('btnEdit'));
ok('row select -> Просмотр enabled',  await enabled('btnView'));
ok('Одобрен row -> Удалить disabled (R4)',     !(await enabled('btnDelete')));
ok('Одобрен row -> Одобрить disabled',         !(await enabled('btnApprove')));
ok('Одобрен row -> Отклонить disabled',        !(await enabled('btnReject')));
ok('Одобрен row -> Вернуть disabled (R2)',     !(await enabled('btnReactivate')));

/* ---- 3. btnView -> detail view ---- */
await page.locator('#btnView').click();
ok('Просмотр -> detailView visible', await visible('detailView'));
const dTitle = await page.locator('#detailTitle').textContent();
ok('detail title filled', dTitle.length > 1 && dTitle !== '—');

/* ---- 4. detail tabs ---- */
await page.locator('#detailTabs .tab[data-tab="1"]').click();
ok('detail tab Кредитные программы active',
   await page.locator('#detailView .tabpanel[data-panel="1"]').evaluate(e => e.classList.contains('active')));

/* ---- 5. detailEdit -> create/edit view, prefilled, title=Редактирование ---- */
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
ok('Создать -> код readonly (R3)',
   await page.locator('#createCode').evaluate(e => e.readOnly));

/* ---- 9. date picker: toggle + pick day ---- */
await page.locator('#calToggle').click();
ok('calToggle -> popup open', await page.locator('.dp-pop.open').count() === 1);
await page.locator('.dp-day:not(.muted):not(.future)', { hasText: /^15$/ }).first().click();
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
ok('R3 -> код preview generated after kind+date',
   /-\d{4}-\d{4}$/.test(await page.locator('#createCode').inputValue()));   // Cyrillic ТИП prefix, \w won't match

/* ---- 11. createOk -> new row, filter switches to На стадии ---- */
await page.locator('#createView .create-form .field .control input').first().fill('КНОПОЧНЫЙ ТЕСТ X');
await page.locator('#createOk').click();
ok('createOk -> back to list', await visible('listView'));
const afterCreate = await page.locator('#rows tr[data-i] td:first-child').allTextContents();
ok('createOk -> new row present', afterCreate.some(t => t.includes('КНОПОЧНЫЙ ТЕСТ')));

/* ---- 12. Approve on pending row: blocked without main doc (R1), then succeeds ---- */
await page.locator('#rows tr[data-i]', { hasText: 'КНОПОЧНЫЙ ТЕСТ' }).first().click();
ok('pending row -> Одобрить enabled', await enabled('btnApprove'));
ok('pending row -> Отклонить enabled', await enabled('btnReject'));
const cntPending = await rowCount();
await page.locator('#btnApprove').click();                 // R1: no main doc -> alert (auto-accepted), no change
await page.waitForTimeout(150);
ok('Одобрить blocked without main doc (R1)', (await rowCount()) === cntPending);
/* attach a main PDF to the selected record, then approve via approveSelected (confirm auto-accepted) */
await page.evaluate(() => {
  const rec = filtered[selected];
  rec.docs.push({ id:'btnpdf', name:'main.pdf', size:1000, main:true, version:1, at:'now', by:'admin' });
  persist();
  approveSelected();
});
await page.waitForTimeout(150);
ok('Одобрить with main doc -> row leaves На-стадии filter (R1)', (await rowCount()) !== cntPending);

/* ---- 13. Reject path: reason modal mandatory (R2) ---- */
await fresh();
await page.locator('#btnCreate').click();
await page.locator('#createView .create-form .field .control input').first().fill('REJECT ТЕСТ');
await page.locator('#createOk').click();
await page.locator('#rows tr[data-i]', { hasText: 'REJECT ТЕСТ' }).first().click();
await page.locator('#btnReject').click();
ok('Отклонить -> reason modal open (R2)', await page.locator('#reasonOverlay.open').count() === 1);
ok('reason confirm disabled without reason (R2)', !(await enabled('reasonConfirm')));
await page.locator('#reasonText').fill('Причина: тест кнопок');
await page.locator('#reasonText').dispatchEvent('input');
ok('reason confirm enabled after text (R2)', await enabled('reasonConfirm'));
await page.locator('#reasonConfirm').click();
await page.waitForTimeout(150);
await setStatusFilter('Закрыт');
const closed = await page.locator('#rows tr[data-i] td:first-child').allTextContents();
ok('Отклонить -> row now Закрыт', closed.some(t => t.includes('REJECT ТЕСТ')));

/* ---- 13b. Reactivate (Вернуть на рассмотрение) — R2 reversibility ---- */
await page.locator('#rows tr[data-i]', { hasText: 'REJECT ТЕСТ' }).first().click();
ok('Закрыт row -> Вернуть enabled (R2)', await enabled('btnReactivate'));
ok('Закрыт row -> Одобрить disabled', !(await enabled('btnApprove')));
await page.locator('#btnReactivate').click();
ok('Вернуть -> reason modal open (R2)', await page.locator('#reasonOverlay.open').count() === 1);
await page.locator('#reasonText').fill('Причина: возврат теста');
await page.locator('#reasonText').dispatchEvent('input');
await page.locator('#reasonConfirm').click();
await page.waitForTimeout(150);
await setStatusFilter('На стадии');
const reopened = await page.locator('#rows tr[data-i] td:first-child').allTextContents();
ok('Вернуть -> row back to На стадии (R2)', reopened.some(t => t.includes('REJECT ТЕСТ')));

/* ---- 14. Delete — only pending, refs-guarded, soft-delete (R4) ---- */
await fresh();
await firstRow().click();                                  // row 0 = Одобрен
ok('Одобрен row -> Удалить disabled (R4)', !(await enabled('btnDelete')));
await setStatusFilter('На стадии');
/* refs>0 pending: delete blocked (alert auto-accepted, no decrease) */
const refName = await page.evaluate(() => { const r = filtered.find(d => d.refs > 0); return r ? r.name : null; });
if (refName){
  const c0 = parseInt(await rowCount(), 10);
  await page.locator('#rows tr[data-i]', { hasText: refName }).first().click();
  await page.locator('#btnDelete').click();
  await page.waitForTimeout(150);
  ok('Удалить pending refs>0 -> blocked (R4)', parseInt(await rowCount(), 10) === c0);
} else ok('Удалить pending refs>0 -> blocked (R4) [no refs record seeded]', false);
/* refs=0 pending: soft-delete succeeds (confirm auto-accepted) */
const delName = await page.evaluate(() => { const r = filtered.find(d => d.refs === 0); return r ? r.name : null; });
const before = parseInt(await rowCount(), 10);
await page.locator('#rows tr[data-i]', { hasText: delName }).first().click();
await page.locator('#btnDelete').click();
await page.waitForTimeout(150);
ok('Удалить pending refs=0 -> rowCount decreased (R4)', parseInt(await rowCount(), 10) === before - 1);
ok('Удалить -> record soft-deleted (R4)',
   await page.evaluate(n => { const r = DATA.find(d => d.name === n); return !!(r && r.deleted); }, delName));

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
