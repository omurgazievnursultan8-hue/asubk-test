// ПРИЁМКА модуля «Управление организационной структурой» (мокап v2, доработка v3).
// Каждый из 15 дефектов аудита стал проверкой «действие отклонено»,
// каждый из 9 пропусков — проверкой «действие выполнимо».
// План: docs/superpowers/plans/2026-07-14-org-structure-v3-crud.md
//   node scripts/inspect/org-structure-v2-audit.mjs
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = 'file://' + path.join(root, 'mockups/org-structure/org-structure-v2.html');

let pass = 0, fail = 0;
const check = (name, cond) => { cond ? (pass++, console.log('PASS  ' + name)) : (fail++, console.log('FAIL  ' + name)); };
const D = '2026-07-11';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url);
await page.waitForTimeout(200);
const reload = async () => { await page.goto(url); await page.waitForTimeout(150); };

/* ================== ДЕФЕКТЫ, КОТОРЫЕ ДОЛЖНЫ БЫТЬ ЗАКРЫТЫ ================== */

// 1-2. Кнопки рабочих списков живые
console.log('\n--- рабочие списки «Требует внимания» ---');
await page.click('#probTabs .dtab[data-prob="headVacant"]');
await page.locator('#probs .rowact').first().click();
await page.waitForTimeout(150);
check('«Назначить» из списка вакансий открывает форму назначения',
  await page.locator('#maBack.open').count() === 1);
await page.click('#maCancel');
await page.click('#probTabs .dtab[data-prob="actingExpiring"]');
await page.locator('#probs .rowact').first().click();
await page.waitForTimeout(150);
check('«Продлить» из списка истекающих и.о. открывает форму продления',
  (await page.locator('#gfHead').innerText()).includes('Продление'));
await page.click('#gfCancel');

// 3. Закрытие требует подтверждения
console.log('\n--- закрытие подразделения ---');
await page.evaluate(() => { state.view = 'units'; state.sel = 'sector'; state.tab = 'liq'; render(); });
await page.waitForTimeout(120);
await page.click('#liqBtn');
await page.waitForTimeout(120);
check('закрытие открывает форму, а не срабатывает в один клик',
  (await page.locator('#gfHead').innerText()).includes('Закрытие подразделения'));
await page.click('#gfSubmit');
check('без галочки подтверждения закрытие не проходит',
  (await page.locator('#gfErr').innerText()).includes('Подтвердите'));

// 13/14. Правопреемник + передача территории
await page.click('#gfCancel');
await page.evaluate(() => { state.view = 'units'; state.sel = 'jal'; state.tab = 'overview'; render(); });
await page.waitForTimeout(100);
const jalTerr = await page.evaluate(() => problemsAt(state.date).orphanTerr.length);
await reload();
await page.evaluate(async () => {   // закрываем Ошское РП по-настоящему: сначала освобождаем и переподчиняем
  state.view = 'units'; state.sel = 'oshrisk'; state.tab = 'overview'; render();
});
await page.waitForTimeout(100);

// 4. ТУПИК СНЯТ: закрытие непустого подразделения доводится до конца ЧЕРЕЗ UI
console.log('\n--- сценарий: закрыть Ошское РП целиком (раньше был тупик) ---');
await page.click('#caMove');                                   // переподчиняем Отдел рисков из Оша в Департамент рисков
await page.waitForTimeout(120);
await page.selectOption('#gf_parent', { label: 'Департамент рисков' });
await page.click('#gfSubmit');
await page.waitForTimeout(150);
check('переподчинение выполнено и версионировано',
  await page.evaluate(d => parentAt('oshrisk', d) === 'riskgo', D)
  && await page.evaluate(() => parentAt('oshrisk', '2024-01-01') === 'osh'));   // прошлое не переписано

const oshBlockers = await page.evaluate(d => liqBlockers('osh', d), D);
check('после переподчинения у Ошского РП не осталось действующих подчинённых',
  !oshBlockers.some(r => r.includes('подчинённые')));

await page.evaluate(() => { state.sel = 'osh'; state.tab = 'liq'; render(); });
await page.waitForTimeout(120);
check('Ошское РП пусто по назначениям — закрытие разблокировано',
  await page.locator('#liqBtn').isEnabled());
await page.click('#liqBtn');
await page.waitForTimeout(120);
await page.selectOption('#gf_succ', { label: 'Головной офис' });
await page.check('#gf_ok');
await page.click('#gfSubmit');
await page.waitForTimeout(200);
const closed = await page.evaluate(() => ({
  liq: unit('osh').liquidated, succ: unit('osh').successor,
  goTerr: unit('go').territory, orphan: problemsAt(state.date).orphanTerr.map(x => x.terr),
  ev: EVENT_LOG[0],
}));
check('закрытие непустого подразделения доведено до конца через UI', closed.liq === D);
check('правопреемник записан и ушёл в событие наружу',
  closed.succ === 'go' && /правопреемник="go"/.test(closed.ev));
check('территория передана правопреемнику — «без подразделения» не осталось',
  closed.goTerr.includes('Ошская область') && !closed.orphan.includes('Ошская область'));

// 7. Отмена закрытия
await page.evaluate(() => { state.tab = 'liq'; render(); });
await page.waitForTimeout(100);
await page.click('#reopenBtn');
await page.waitForTimeout(100);
await page.click('#gfSubmit');
await page.waitForTimeout(150);
check('ошибочное закрытие отменяется',
  await page.evaluate(() => unit('osh').liquidated === null)
  && await page.evaluate(() => /unit\.reopened/.test(EVENT_LOG[0])));

/* --- валидации, которые раньше пропускали неверные данные --- */
console.log('\n--- валидации назначений ---');
await reload();
const V = await page.evaluate(async () => {
  const out = {};
  const openOn = async (unitId, posId) => {
    state.view = 'units'; state.sel = unitId; state.tab = 'staff'; render();
    await new Promise(r => setTimeout(r, 40));
    openAssign(posId);
  };
  const submit = () => { document.getElementById('maSubmit').click(); return document.getElementById('maErr').textContent; };

  // 5. переполнение штата: ps_sector — 1 ставка
  await openOn('sector', 'ps_sector');
  document.getElementById('maEmp').value = 'e_und';
  document.getElementById('maKind').value = 'combine';
  document.getElementById('maRate').value = '1';
  submit();
  document.getElementById('maEmp').value = 'e_aud';
  out.overfill = submit();
  out.overfillCount = ASSIGN.filter(a => a.posId === 'ps_sector').length;
  closeModals();

  // 6. дубль совместительства на ту же единицу
  await openOn('oshrisk', 'ps_oshrsp');
  document.getElementById('maEmp').value = 'e_spec';
  document.getElementById('maKind').value = 'combine';
  document.getElementById('maRate').value = '0.1';
  out.dupCombine = submit();
  closeModals();

  // 7. пересечение основных мест задним числом (у Каримова основное с 2020-03-01 бессрочно).
  // Раньше проверка стояла в точке `from`, где чужое основное ещё не действовало, — и второе основное проходило.
  await openOn('sector', 'ps_sector');
  document.getElementById('maEmp').value  = 'e_und';
  document.getElementById('maKind').value = 'main';
  document.getElementById('maFrom').value = '2020-06-01';
  document.getElementById('maTo').value   = '2021-01-01';
  out.overlapMain = submit();
  out.invAfter = checkMainInvariant('2020-08-01').length;
  closeModals();

  // 11. назначение раньше создания подразделения (Ошское РП создано 2021-01-01)
  await openOn('osh', 'ps_osh');
  document.getElementById('maEmp').value  = 'e_io';
  document.getElementById('maKind').value = 'main';
  document.getElementById('maFrom').value = '2015-01-01';
  out.preDate = submit();
  closeModals();

  // 12. и.о. на 20 лет
  await openOn('osh', 'ps_osh');
  document.getElementById('maKind').value = 'acting';
  document.getElementById('maKind').dispatchEvent(new Event('change'));
  document.getElementById('maFrom').value   = '2026-07-11';
  document.getElementById('maTo').value     = '2046-01-01';
  document.getElementById('maReason').value = 'приказ №2';
  out.longActing = submit();
  closeModals();
  return out;
});
check('переполнение штата отклонено', /не помещается/.test(V.overfill) && V.overfillCount === 1);
check('дубль совместительства на ту же единицу отклонён', /уже назначен/.test(V.dupCombine));
check('пересечение основных мест работы отклонено (проверка по интервалу, не в точке)',
  /уже есть основное место работы/.test(V.overlapMain) && V.invAfter === 0);
check('назначение раньше создания подразделения отклонено', /создано/.test(V.preDate));
check('и.о. сверх предельного срока отклонён', /Предельный срок/.test(V.longActing));

console.log('\n--- валидации структуры и штата ---');
await reload();
const S = await page.evaluate(async () => {
  const out = {};
  // 9. второй верхний уровень
  openAddUnit();
  out.rootOption = [...document.getElementById('auParent').options].some(o => o.value === '');
  document.getElementById('auName').value = 'Второй головной офис';
  document.getElementById('auSubmit').click();
  out.roots = liveUnitsAt(state.date).filter(u => parentAt(u.id, state.date) == null).length;
  closeModals();

  // 16. дубль названия
  openAddUnit();
  document.getElementById('auName').value = 'Кредитный департамент';
  document.getElementById('auSubmit').click();
  out.dupName = document.getElementById('auErr').textContent;
  closeModals();

  // 10. дробные ставки
  state.view = 'units'; state.sel = 'sector'; state.tab = 'staff'; render();
  await new Promise(r => setTimeout(r, 40));
  openAddPos('sector');
  document.getElementById('mpTitle').value = 'chief';
  document.getElementById('mpUnits').value = '2.5';
  document.getElementById('mpSubmit').click();
  out.frac = document.getElementById('mpErr').textContent;
  closeModals();

  // 8. штатное расписание историчнo
  openAddPos('sector');
  document.getElementById('mpTitle').value = 'chief';
  document.getElementById('mpUnits').value = '3';
  document.getElementById('mpSubmit').click();
  await new Promise(r => setTimeout(r, 60));
  out.plannedNow  = unitStaffAt('sector', '2026-07-11').planned;
  out.plannedPast = unitStaffAt('sector', '2021-01-01').planned;

  // 15. закрытие задним числом поверх более поздних событий (у сектора переименование 2023-06-01)
  out.laterBlocked = liqBlockers('sector', '2020-06-01').some(r => r.includes('события после'));
  return out;
});
check('второй верхний уровень: опции «без вышестоящего» нет и корень остался один',
  !S.rootOption && S.roots === 1);
check('дубль названия подразделения отклонён', /уже действует/.test(S.dupName));
check('дробное число ставок отклонено', /целое/.test(S.frac));
check('штатное расписание историчнo: единица, заведённая сегодня, на 2021 год не видна',
  S.plannedNow === 4 && S.plannedPast === 1);
check('закрытие задним числом поверх более поздних событий заблокировано', S.laterBlocked);

// 17. территория — справочник, а не свободный текст
console.log('\n--- территория, метрики, экспорт ---');
await reload();
const T = await page.evaluate(async () => {
  state.view = 'units'; state.sel = 'osh'; state.tab = 'overview'; render();
  await new Promise(r => setTimeout(r, 40));
  openTerritory();
  const opts = [...document.querySelectorAll('[data-cl="terr"]')].map(x => x.value);
  closeModals();
  return { opts, free: opts.every(o => TERRITORIES.includes(o)) };
});
check('территория выбирается из справочника — опечатки невозможны',
  T.free && T.opts.includes('Ошская область') && !T.opts.includes('Ошская обл.'));

// 18. одна формула вакантности: и.о. не убирает подразделение из рабочего списка
const VAC = await page.evaluate(async () => {
  const before = problemsAt(state.date).headVacant.map(x => x.unitId);
  ACTING.push({ id: 'io_t', posId: 'ps_osh', empId: 'e_io', from: '2026-07-01', to: '2026-08-01', reason: 'тест' });
  render();
  const p = problemsAt(state.date).headVacant.find(x => x.unitId === 'osh');
  const m = metricsAt(state.date);
  return { before, still: !!p, covered: !!(p && p.acting), head: m.vac.head, headOpen: m.vac.headOpen };
});
check('и.о. вакансию не закрывает: подразделение остаётся в списке с пометкой «прикрыто и.о.»',
  VAC.still && VAC.covered && VAC.head === 2 && VAC.headOpen === 1);

/* ================== ПРОПУЩЕННЫЕ ДЕЙСТВИЯ: ТЕПЕРЬ ВЫПОЛНИМЫ ================== */
console.log('\n--- пропущенные действия ---');
await reload();
const A = await page.evaluate(async () => {
  const out = {};
  const sub = () => document.getElementById('gfSubmit').click();

  // переименование
  state.view = 'units'; state.sel = 'creditgo'; state.tab = 'overview'; render();
  await new Promise(r => setTimeout(r, 40));
  openRename();
  document.getElementById('gf_name').value = 'Департамент кредитования';
  sub();
  out.renameNow  = nameAt('creditgo', '2026-07-11');
  out.renamePast = nameAt('creditgo', '2023-01-01');     // история не переписана
  out.renameEv   = EVENT_LOG[0];

  // правка штатной единицы
  state.tab = 'staff'; render(); await new Promise(r => setTimeout(r, 40));
  openEditPos('ps_creditsp');
  document.getElementById('gf_units').value = '4';
  sub();
  out.unitsNow  = unitsAt('ps_creditsp', '2026-07-11');
  out.unitsPast = unitsAt('ps_creditsp', '2023-01-01');  // версия сохранена

  // нельзя урезать ставки ниже занятых
  openEditPos('ps_creditsp');
  document.getElementById('gf_units').value = '0';
  sub();
  out.shrinkErr = document.getElementById('gfErr').textContent;
  closeModals();

  // закрытие штатной единицы
  openClosePos('ps_sector');
  sub();
  out.posClosed = posById('ps_sector').to;

  // прекращение и.о.
  openStopActing('io1');
  sub();
  out.ioStopped = ACTING.find(a => a.id === 'io1').to;

  // справочник должностей: правка и удаление
  state.view = 'titles'; render(); await new Promise(r => setTimeout(r, 40));
  openEditTitle('chief');
  document.getElementById('gf_name').value = 'Ведущий специалист';
  sub();
  out.titleName = TITLES.chief.name;
  out.delUsed = (()=>{ openDelTitle('chief'); const e = document.getElementById('gfSubmit').click();
                       const err = document.getElementById('gfErr').textContent; closeModals(); return err; })();

  // новый сотрудник
  state.view = 'people'; render(); await new Promise(r => setTimeout(r, 40));
  document.getElementById('addEmpBtn').click();
  document.getElementById('gf_fio').value = 'Тестов Т. Т.';
  sub();
  out.newEmp = Object.values(EMPLOYEES).includes('Тестов Т. Т.');
  return out;
});
check('переименование выполняется и версионируется (прошлое не переписано)',
  A.renameNow === 'Департамент кредитования' && A.renamePast === 'Кредитный департамент'
  && /unit\.renamed/.test(A.renameEv));
check('число ставок правится и версионируется', A.unitsNow === 4 && A.unitsPast === 1);
check('ставки нельзя урезать ниже занятых', /Занято/.test(A.shrinkErr) || /целое/.test(A.shrinkErr));
check('штатная единица закрывается', A.posClosed === D);
check('и.о. прекращается досрочно', A.ioStopped === D);
check('должность справочника правится', A.titleName === 'Ведущий специалист');
check('используемая должность не удаляется', /используется/.test(A.delUsed));
check('новый сотрудник заводится', A.newEmp);

// поиск
await reload();
await page.evaluate(() => { state.view = 'units'; render(); });
await page.fill('#treeQ', 'Ошское');
await page.waitForTimeout(150);
const treeTxt = await page.locator('#tree').innerText();
check('поиск по структуре: совпадение показано вместе с предками',
  treeTxt.includes('Ошское РП') && treeTxt.includes('Головной офис') && !treeTxt.includes('Служба андеррайтинга'));
await page.evaluate(() => { state.view = 'titles'; render(); });
await page.fill('#titlesQ', 'зампред-которого-нет');
await page.waitForTimeout(120);
check('поиск по должностям фильтрует', (await page.locator('#titlesBody').innerText()).includes('Ничего не найдено'));

// экспорт
const dl = page.waitForEvent('download', { timeout: 4000 }).catch(() => null);
await page.evaluate(() => { state.view = 'overview'; render(); });
await page.click('#ovExport');
const file = await dl;
check('экспорт структуры в CSV скачивается', !!file && /оргструктура_.*\.csv/.test(file.suggestedFilename()));

// роль «Наблюдатель» — все новые действия тоже под замком
await reload();
const obs = await page.evaluate(async () => {
  document.getElementById('roleSel').value = 'obs';
  document.getElementById('roleSel').dispatchEvent(new Event('change'));
  await new Promise(r => setTimeout(r, 60));
  state.view = 'units'; state.sel = 'creditgo'; state.tab = 'overview'; render();
  await new Promise(r => setTimeout(r, 60));
  const dis = ['caRename', 'caMove', 'caTerr'].every(id => document.getElementById(id).disabled);
  openRename(); openReparent(); openTerritory(); openLiquidate('sector');
  return { dis, opened: document.querySelectorAll('.modal-back.open').length };
});
check('роль «Наблюдатель»: новые действия заблокированы и не открываются программно',
  obs.dis && obs.opened === 0);

console.log(`\nконсольных ошибок: ${errors.length}`);
errors.slice(0, 5).forEach(e => console.log('  ! ' + e));
console.log(`\n${fail ? 'ЕСТЬ ПРОВАЛЫ' : 'ALL PASS'} — ${pass} pass, ${fail} fail`);
await browser.close();
process.exit(fail ? 1 : 0);
