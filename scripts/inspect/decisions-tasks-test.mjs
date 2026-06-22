// Acceptance test: drives mockups/decision/decisions.html (file://) headless and
// asserts each Phase-1 task R1–R7 is built + behaves per TODO.md spec.
// Run: node scripts/inspect/decisions-tasks-test.mjs
import { chromium } from 'playwright-core';
import { resolve } from 'node:path';

const mockPath = 'file://' + resolve('mockups/decision/decisions.html');
const ctx = await chromium.launchPersistentContext('.auth/profile-tasks', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1700, height: 1100 },
});
const page = ctx.pages()[0] || await ctx.newPage();

// dialog capture (alert/confirm). acceptNext=true → accept, else dismiss.
let acceptNext = false;
const dialogs = [];
page.on('dialog', async d => { dialogs.push(d.message()); acceptNext ? await d.accept() : await d.dismiss(); });
const lastDialog = () => dialogs[dialogs.length - 1] || '';

// ---- helpers ----
const setStatus = s => page.evaluate(s => {
  conditions = [{ prop: 'status', label: 'Статус', type: 'enum', op: 'equal', value: s }];
  filterDirty = false; renderConds(); applyFilter();
}, s);
const setRole = r => page.evaluate(r => { const e = document.getElementById('roleSel'); e.value = r; e.dispatchEvent(new Event('change')); }, r);
const selectByName = p => page.evaluate(p => { const i = filtered.findIndex(r => r.name.startsWith(p)); if (i < 0) return false; selectRow(i, true); return true; }, p);
const selectFirst = () => page.evaluate(() => { const tr = document.querySelector('#rows tr[data-i]'); if (!tr) return false; selectRow(+tr.dataset.i, true); return true; });
const btn = id => page.evaluate(id => { const e = document.getElementById(id); return e ? { hidden: !!e.hidden, disabled: !!e.disabled } : null; }, id);
const click = id => page.evaluate(id => document.getElementById(id).click(), id);
const openDetail = () => page.evaluate(() => openDetail());
const detailTab = i => page.evaluate(i => selectDetailTab(i), i);

// ---- result tracker ----
const R = {};
const check = (task, name, pass, detail = '') => {
  (R[task] = R[task] || []).push({ name, pass, detail });
};

// fresh seed
await page.goto(mockPath, { waitUntil: 'load', timeout: 30000 });
await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(300);

// ============================================================ R7 workflow
{
  const statuses = await page.evaluate(() => STATUSES.length);
  check('R7', '6 статусов в модели', statuses === 6, `STATUSES=${statuses}`);

  await setRole('author'); await setStatus('Черновик'); await selectFirst();
  const sub = await btn('btnSubmit'), ed = await btn('btnEdit'), ap = await btn('btnApprove');
  check('R7', 'Автор/Черновик: «Отправить» активна', sub && !sub.hidden && !sub.disabled, JSON.stringify(sub));
  check('R7', 'Автор/Черновик: «Изменить» активна', ed && !ed.hidden && !ed.disabled, JSON.stringify(ed));
  check('R7', 'Автор: кнопки согласующего скрыты («Одобрить»)', ap && ap.hidden, JSON.stringify(ap));

  await setRole('approver'); await setStatus('На рассмотрении'); await selectFirst();
  const apr = await btn('btnApprove'), rej = await btn('btnReject'), ret = await btn('btnReturn');
  check('R7', 'Согласующий/На рассмотрении: «Одобрить» активна', apr && !apr.hidden && !apr.disabled, JSON.stringify(apr));
  check('R7', 'Согласующий: «Отклонить»+«Вернуть» активны', rej && !rej.disabled && ret && !ret.disabled);

  await setRole('admin'); await setStatus('Отклонён'); await selectFirst();
  const rea = await btn('btnReactivate');
  check('R7', 'Админ/Отклонён: «Вернуть на рассмотрение» активна', rea && !rea.hidden && !rea.disabled, JSON.stringify(rea));

  await setRole('author'); await setStatus('Действует'); await selectFirst();
  const edD = await btn('btnEdit');
  check('R7', 'Гашение по статусу: «Изменить» неактивна для «Действует»', edD && edD.disabled, JSON.stringify(edD));
}

// ============================================================ R3 code gen
{
  await setRole('author'); await setStatus('Черновик');
  await click('btnCreate'); await page.waitForTimeout(150);
  const ro = await page.evaluate(() => document.getElementById('createCode').readOnly);
  check('R3', 'Поле «Код» read-only', ro === true);
  const code = await page.evaluate(() => {
    const v = document.querySelector('#createView .lookup .val');
    v.textContent = 'Постановление'; v.classList.add('filled');
    document.getElementById('decisionDate').value = '01.01.2026';
    updateCodePreview();
    return document.getElementById('createCode').value;
  });
  check('R3', 'Код сгенерирован {ТИП}-{ГГГГ}-{NNNN}', /^ПОСТ-2026-\d{4}$/.test(code), code);
  await click('createCancel');
}

// ============================================================ R5 date validation
{
  await setStatus('Черновик'); await click('btnCreate'); await page.waitForTimeout(150);
  // future date via manual input
  const tomorrow = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 1); const p = n => String(n).padStart(2, '0'); return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`; });
  acceptNext = true;
  await page.evaluate(t => { const i = document.getElementById('decisionDate'); i.value = t; i.dispatchEvent(new Event('change')); }, tomorrow);
  await page.waitForTimeout(100);
  acceptNext = false;
  const cleared = await page.evaluate(() => document.getElementById('decisionDate').value);
  check('R5', 'Будущая дата: сообщение об ошибке', /будущ/i.test(lastDialog()), lastDialog());
  check('R5', 'Будущая дата: поле сброшено', cleared === '', `value="${cleared}"`);
  // calendar disables future days
  await click('calToggle'); await page.waitForTimeout(100);
  const futureDisabled = await page.evaluate(() => document.querySelectorAll('.dp-day.future[disabled]').length);
  check('R5', 'Календарь: будущие дни заблокированы', futureDisabled > 0, `disabled future days=${futureDisabled}`);
  await click('createCancel');
}

// ============================================================ R1 documents
{
  const colHasDoc = await page.evaluate(() => [...document.querySelectorAll('#grid thead th')].some(th => th.textContent.includes('Документ')));
  check('R1', 'Грид: колонка «Документ»', colHasDoc);

  await setRole('author'); await setStatus('Действует');
  await selectByName('Распоряжение Жогорку'); await openDetail(); await detailTab(2); await page.waitForTimeout(100);
  const dz = await page.evaluate(() => { const e = document.getElementById('docDrop'); return !!e && e.offsetParent !== null; });
  const banner = await page.evaluate(() => document.getElementById('docBannerText').textContent);
  check('R1', 'Вкладка «Документы»: dropzone виден', dz);
  check('R1', 'Баннер: только PDF, до 20 МБ', /PDF/.test(banner) && /20/.test(banner), banner.slice(0, 60));
  const fileRows = await page.evaluate(() => document.querySelectorAll('#docList .file-row').length);
  check('R1', 'Файлы одобренного решения показаны', fileRows > 0, `rows=${fileRows}`);
  const delDisabled = await page.evaluate(() => { const b = document.querySelector('#docList .linkbtn.danger[data-act=remove]'); return b ? b.disabled : null; });
  check('R1', 'Удаление файла запрещено у «Действует»', delDisabled === true, `disabled=${delDisabled}`);

  // approve gating: На рассмотрении без основного документа → нельзя одобрить
  await page.evaluate(() => showView('listView'));
  await setRole('approver'); await setStatus('На рассмотрении'); await selectByName('Распоряжение Кабинета Министров');
  acceptNext = false; // alert
  await click('btnApprove'); await page.waitForTimeout(100);
  check('R1', 'Одобрение без основного документа заблокировано', /без основного документа/.test(lastDialog()), lastDialog().slice(0, 50));
}

// ============================================================ R2 reason+audit+reversibility
{
  await page.evaluate(() => showView('listView'));
  await setRole('approver'); await setStatus('На рассмотрении'); await selectFirst();
  await click('btnReject'); await page.waitForTimeout(100);
  const open = await page.evaluate(() => document.getElementById('reasonOverlay').classList.contains('open'));
  const confDisabled0 = await page.evaluate(() => document.getElementById('reasonConfirm').disabled);
  check('R2', 'Отклонение: модалка причины открывается', open);
  check('R2', 'Причина пуста → «Отклонить» недоступна', confDisabled0 === true);
  await page.evaluate(() => { const t = document.getElementById('reasonText'); t.value = 'Тестовая причина'; t.dispatchEvent(new Event('input')); });
  const confDisabled1 = await page.evaluate(() => document.getElementById('reasonConfirm').disabled);
  check('R2', 'Причина введена → «Отклонить» активна', confDisabled1 === false);
  await click('reasonCancel');

  // audit timeline
  await setStatus('Действует'); await selectFirst(); await openDetail(); await detailTab(3); await page.waitForTimeout(100);
  const tl = await page.evaluate(() => document.querySelectorAll('#dTimeline .tl-item').length);
  check('R2', 'Вкладка «История»: таймлайн заполнен', tl > 0, `events=${tl}`);

  // reversibility
  await page.evaluate(() => showView('listView'));
  await setRole('admin'); await setStatus('Закрыт'); await selectFirst();
  const rea = await btn('btnReactivate');
  check('R2', 'Обратимость: админ возвращает «Закрыт» → активна', rea && !rea.hidden && !rea.disabled, JSON.stringify(rea));
}

// ============================================================ R4 delete guards
{
  await page.evaluate(() => showView('listView'));
  await setRole('author'); await setStatus('Черновик'); await selectFirst();
  const dDraft = await btn('btnDelete');
  check('R4', 'Удаление активно для «Черновик»', dDraft && !dDraft.hidden && !dDraft.disabled, JSON.stringify(dDraft));

  await setStatus('Действует'); await selectFirst();
  const dLive = await btn('btnDelete');
  check('R4', 'Удаление недоступно для «Действует»', dLive && (dLive.hidden || dLive.disabled), JSON.stringify(dLive));

  // referential guard message (set refs>0 on a draft, attempt delete)
  await setStatus('Черновик'); await selectFirst();
  await page.evaluate(() => { filtered[selected].refs = 2; });
  acceptNext = false; // alert (refs check fires before reason modal)
  await click('btnDelete'); await page.waitForTimeout(100);
  check('R4', 'Защита ссылок: внятное сообщение', /Нельзя удалить.*ссылаются/.test(lastDialog()), lastDialog().slice(0, 50));

  // P1-07: чистый черновик → удаление через модалку причины (reasonOverlay), не голый confirm()
  await setStatus('Черновик'); await selectFirst();
  await page.evaluate(() => { filtered[selected].refs = 0; filtered[selected].deleted = false; });
  await click('btnDelete'); await page.waitForTimeout(100);
  const delOpen = await page.evaluate(() => document.getElementById('reasonOverlay').classList.contains('open'));
  check('R4', 'Удаление: модалка причины открывается (не confirm)', delOpen);
  const delConf0 = await page.evaluate(() => document.getElementById('reasonConfirm').disabled);
  check('R4', 'Причина удаления пуста → «Удалить» недоступна', delConf0 === true);
  await page.evaluate(() => { const t = document.getElementById('reasonText'); t.value = 'Дубликат записи'; t.dispatchEvent(new Event('input')); });
  const delConf1 = await page.evaluate(() => document.getElementById('reasonConfirm').disabled);
  check('R4', 'Причина введена → «Удалить» активна', delConf1 === false);
  const delName = await page.evaluate(() => filtered[selected].name);
  await click('reasonConfirm'); await page.waitForTimeout(100);
  const gone = await page.evaluate(n => { const r = DATA.find(x => x.name === n); return !!r && r.deleted === true; }, delName);
  check('R4', 'Soft-delete: запись помечена удалённой (остаётся в DATA)', gone, `name=${delName}`);
  const logged = await page.evaluate(n => { const r = DATA.find(x => x.name === n); const e = r && r.log && r.log[r.log.length - 1]; return !!e && e.action === 'Удаление' && e.reason === 'Дубликат записи'; }, delName);
  check('R4', 'Журнал: запись «Удаление» с причиной', logged);
  const hidden = await page.evaluate(n => !filtered.some(x => x.name === n), delName);
  check('R4', 'Список: soft-deleted скрыт из грида', hidden);
}

// ============================================================ R6 detail page
{
  await page.evaluate(() => showView('listView'));
  await setRole('author'); await setStatus('Действует'); await selectByName('Распоряжение Жогорку'); await openDetail(); await page.waitForTimeout(100);
  const tabs = await page.evaluate(() => [...document.querySelectorAll('#detailTabs .tab')].map(t => t.textContent.trim()));
  const want = ['Общая информация', 'Кредитные программы', 'Документы', 'История'];
  check('R6', '4 вкладки карточки', want.every(w => tabs.includes(w)), tabs.join(' | '));
  const org = await page.evaluate(() => document.getElementById('dOrg').textContent.trim());
  check('R6', 'Поле «Орган» заполнено', org && org !== '—', org);
  const active = await page.evaluate(() => document.getElementById('dActive').textContent.trim());
  check('R6', '«Действующее решение» бейдж Да/Нет', /^(Да|Нет)$/.test(active), active);
  await detailTab(1); await page.waitForTimeout(100);
  const progs = await page.evaluate(() => document.querySelectorAll('#dPrograms tr').length);
  check('R6', 'Вкладка «Кредитные программы»: таблица', progs > 0, `rows=${progs}`);
}

await page.screenshot({ path: '.auth/decisions-tasks-test.png', fullPage: true }).catch(() => {});
await ctx.close();

// ---- report ----
let total = 0, passed = 0;
for (const [task, list] of Object.entries(R)) {
  console.log(`\n=== ${task} ===`);
  for (const c of list) {
    total++; if (c.pass) passed++;
    console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? '  — ' + c.detail : ''}`);
  }
}
console.log(`\n${passed}/${total} checks passed`);
process.exit(passed === total ? 0 : 1);
