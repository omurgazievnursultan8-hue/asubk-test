import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url';
import path from 'path';

/* ================================================================
   ZONE 2 — матрица ролей × фаз × прав + режим правки + навигация.
   Гоняет can(), тулбар, вкладки, редактор заключений, edit-mode.
   ================================================================ */

const HTML = path.resolve('mockups/loan-application/loan-application.html');
const URL = pathToFileURL(HTML).href;
const PROFILE = '/tmp/claude-1000/-home-azamat-projects-asubk-credit-module/6cba1142-d414-4023-9699-97169fbf0a64/scratchpad/p-zone2';

// Тест-заявки (номера-константы из seed):
const A_DRAFT_GROUP = 'З-2026-000105'; // Новый · isGroup · без залога · _seedConfirmed (confirmedMet=true)
const A_DRAFT_COLL  = 'З-2026-000080'; // Требуется доп. · залог · не группа (не seedConfirmed)
const A_REVIEW      = 'З-2026-000103'; // На рассмотрении · залог · не группа
const A_LOCKED      = 'З-2026-000101'; // Одобрена (locked)

let PASS = 0, FAIL = 0, ASSERTS = 0;
const fails = [];
function ok(name, cond, detail){
  ASSERTS++;
  if (cond){ PASS++; }
  else { FAIL++; fails.push(name + (detail!==undefined?` [${JSON.stringify(detail)}]`:'')); console.log('FAIL', name, detail!==undefined?JSON.stringify(detail):''); }
}

const jsErrors = [];

const ctx = await chromium.launchPersistentContext(PROFILE, {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1500, height: 1600 },
});
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => { jsErrors.push('pageerror: ' + e.message); console.log('JSERR pageerror:', e.message); });
page.on('console', m => { if (m.type() === 'error'){ jsErrors.push('console.error: ' + m.text()); console.log('JSERR console:', m.text()); } });

await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(300);

// helpers driving real globals
const setRole = r => page.evaluate(r => setRole(r), r);
const setDept = k => page.evaluate(k => setDept(k), k);
const goto = (num, panel) => page.evaluate(([n,p]) => gotoDetail(n, p), [num, panel]);
const showTab = p => page.evaluate(p => showTab(p), p);

// Read current detail UI state
async function ui(){
  return page.evaluate(() => {
    const q = s => document.querySelector(s);
    const qa = s => [...document.querySelectorAll(s)];
    const activeTabs = qa('.tabbar-tab.active').map(t => t.dataset.panel);
    const activePanels = qa('.detail-panel.active').map(p => p.id);
    const tabbar = qa('.tabbar-tab').map(t => ({ panel:t.dataset.panel, label:t.textContent.replace(/\s+/g,' ').trim() }));
    const tbBtns = qa('#detailToolbar button').map(b => ({ t:b.textContent.trim(), disabled:b.disabled }));
    // conditions editable inputs (data-bind markers)
    const condBinds = qa('#tab-cond [data-bind]').map(e => e.getAttribute('data-bind'));
    // conclusions
    const assignSel = !!q('#conclAddSel');
    const conclEditor = qa('#tab-concl .concl-edit, #tab-concl .concl-locked').length; // editConcl-регион: форма ИЛИ замороженное внесённое
    const withdrawBtn = qa('#tab-concl .concl-locked button').some(b=>/Отозвать/.test(b.textContent));
    const conclHint = qa('#tab-concl .tab-note').some(n=>/Отдел/.test(n.textContent));
    // commission voting tools (phase B) / prelim tools
    const comVoteRow = qa('#tab-6 .com-toolrow button, #tab-6 .com-tools button').map(b=>b.textContent.trim());
    const deptSelOpts = qa('#deptSel option').map(o=>o.value);
    const deptSwitchHidden = q('#deptSwitch') ? q('#deptSwitch').hidden : null;
    const listBtns = ['btnCreate','btnEdit','btnDel','btnCom'].map(id => { const b=document.getElementById(id); return b? {id, hidden:b.hidden}:null; });
    return { activeTabs, activePanels, tabbar, tbBtns, condBinds, assignSel, conclEditor, withdrawBtn, conclHint, comVoteRow, deptSelOpts, deptSwitchHidden, listBtns };
  });
}
const toolbarLabels = u => u.tbBtns.map(b=>b.t);
const hasBtn = (u,txt) => u.tbBtns.some(b=>b.t===txt);

console.log('\n================= PART 1: ПОЛНАЯ МАТРИЦА can() (5 ролей × 9 статусов) =================\n');

const matrix = await page.evaluate(({baseNum}) => {
  const statuses = Object.keys(STATUS_META);
  const roles = ['spec','gf','dept','com','ro'];
  const base = APPLICATIONS.find(a => a.num === baseNum);
  const out = [];
  const savedRole = document.getElementById('roleSel').value;
  for (const role of roles){
    setRole(role);
    if (role === 'dept') setDept('risk');
    for (const st of statuses){
      const app = structuredClone(base); delete app._concl; app.status = st;
      const cap = can(app);
      out.push({ role, st, phase: cap.phase,
        canEditReq: cap.canEditReq, canEditOp: cap.canEditOp, canEditSched: cap.canEditSched,
        vote: cap.vote, confirmDoc: cap.confirmDoc, assignDepts: cap.assignDepts,
        editConcl: cap.editConcl('risk'), withdrawConcl: cap.withdrawConcl('risk'),
        toolbar: cap.toolbar });
    }
  }
  setRole(savedRole);
  return out;
}, { baseNum: A_DRAFT_GROUP });

// expected model (documented intent) — mirror of spec to catch impl drift
const draftStatuses = ['Новый','Требуется доп. информация'];
const reviewStatuses = ['На рассмотрении','Ожидает решения/программы'];
function phaseOf(st){ return draftStatuses.includes(st) ? 'draft' : reviewStatuses.includes(st) ? 'review' : 'locked'; }
// confirmedMet=true for base 105; risk seed is submitted 'cond' for 105 → withdraw available in draft/dept
function expect(role, st){
  const ph = phaseOf(st);
  return {
    canEditReq: role==='spec' && ph==='draft',
    canEditOp:  role==='com'  && ph==='review',
    canEditSched: (role==='spec' && ph==='draft') || (role==='com' && ph==='locked'),
    vote: role==='com' && ph==='review',
    confirmDoc: role==='gf' && ph==='draft',
    assignDepts: role==='spec' && ph==='draft',
    editConcl: role==='dept' && ph==='draft',            // confirmedMet true, dept=risk
    withdrawConcl: role==='dept' && ph==='draft',         // risk submitted in 105 seed
    toolbar: role==='spec',
  };
}
const FIELDS = ['canEditReq','canEditOp','canEditSched','vote','confirmDoc','assignDepts','editConcl','withdrawConcl','toolbar'];
let matrixMismatch = 0;
for (const row of matrix){
  const exp = expect(row.role, row.st);
  ok(`phase[${row.role}/${row.st}]`, row.phase === phaseOf(row.st), {got:row.phase, exp:phaseOf(row.st)});
  for (const f of FIELDS){
    const good = row[f] === exp[f];
    if (!good){ matrixMismatch++; console.log(`  MATRIX-DRIFT ${row.role}/${row.st}.${f}: impl=${row[f]} spec=${exp[f]}`); }
    ok(`can.${f}[${row.role}/${row.st}]`, good, good?undefined:{impl:row[f],spec:exp[f]});
  }
}
console.log(`Матрица: ${matrix.length} ячеек, drift=${matrixMismatch}`);

// Компактный дамп «интересных» строк (любое право = true)
console.log('\n--- строки матрицы с ненулевыми правами ---');
for (const r of matrix){
  const on = FIELDS.filter(f=>r[f]);
  if (on.length) console.log(`  ${r.role.padEnd(4)} ${r.st.padEnd(28)} ph=${r.phase.padEnd(7)} → ${on.join(', ')}`);
}

console.log('\n================= PART 2: UI vs can() — драйв реального интерфейса =================\n');

// ---- 2.1 Условные вкладки ----
await setRole('spec');
await goto(A_DRAFT_GROUP);
let u = await ui();
const gLabels = u.tabbar.map(t=>t.label);
ok('105(group): вкладка «Члены группы» есть', gLabels.some(l=>/Члены группы/.test(l)), gLabels);
ok('105(group): вкладки «Залог» НЕТ', !gLabels.some(l=>/Залог/.test(l)), gLabels);

await goto(A_REVIEW);
u = await ui();
const cLabels = u.tabbar.map(t=>t.label);
ok('103(coll): вкладка «Залог» есть', cLabels.some(l=>/Залог/.test(l)), cLabels);
ok('103(coll): вкладки «Члены группы» НЕТ', !cLabels.some(l=>/Члены группы/.test(l)), cLabels);

// ---- 2.2 gotoDetail на несуществующую вкладку ----
await goto(A_DRAFT_GROUP, 'tab-4'); // Залог — для 105 нет
u = await ui();
ok('gotoDetail(105,tab-4[нет]) → откат на первую вкладку', u.activeTabs.length===1 && u.activeTabs[0]==='tab-0', u.activeTabs);
ok('gotoDetail(105,tab-4[нет]) → активна ровно одна панель tab-0', u.activePanels.length===1 && u.activePanels[0]==='tab-0', u.activePanels);

await goto(A_DRAFT_GROUP, 'tab-3'); // Члены группы — есть
u = await ui();
ok('gotoDetail(105,tab-3[есть]) → активна tab-3', u.activeTabs[0]==='tab-3' && u.activePanels[0]==='tab-3', {t:u.activeTabs,p:u.activePanels});

// ---- 2.3 таббар/панель синхрон: ровно одна active, совпадают ----
await goto(A_DRAFT_GROUP, 'tab-concl');
u = await ui();
ok('sync: ровно одна активная вкладка', u.activeTabs.length===1, u.activeTabs);
ok('sync: ровно одна активная панель', u.activePanels.length===1, u.activePanels);
ok('sync: активная вкладка = активная панель = tab-concl', u.activeTabs[0]==='tab-concl' && u.activePanels[0]==='tab-concl', {t:u.activeTabs,p:u.activePanels});

// ---- 2.4 Переход с «Залог» на заявку без «Залог» ----
await goto(A_REVIEW, 'tab-4'); // 103 на Залоге
u = await ui();
ok('103 открыт на tab-4(Залог)', u.activeTabs[0]==='tab-4', u.activeTabs);
await goto(A_DRAFT_GROUP);      // 105 без Залога — активная вкладка исчезла
u = await ui();
ok('105 после 103@Залог → нет висящей активной вкладки, откат на первую', u.activeTabs.length===1 && u.activeTabs[0]==='tab-0', u.activeTabs);

console.log('\n--- 2.5 РОЛЬ spec на draft(105) ---');
await setRole('spec');
await goto(A_DRAFT_GROUP, 'tab-0');
u = await ui();
ok('spec: тулбар содержит «Изменить»', hasBtn(u,'Изменить'), toolbarLabels(u));
ok('spec: тулбар содержит «Удалить»', hasBtn(u,'Удалить'), toolbarLabels(u));
ok('spec: тулбар содержит «Отозвать»', hasBtn(u,'Отозвать'), toolbarLabels(u));
ok('spec: тулбар содержит «Отправить в комиссию»', u.tbBtns.some(b=>/Отправить в комиссию/.test(b.t)), toolbarLabels(u));
ok('spec: спец-кнопки списка видимы', u.listBtns.every(b=>b && b.hidden===false), u.listBtns);
// conditions read-only до входа в режим
await showTab('tab-cond'); u = await ui();
ok('spec/view: в «Условиях» нет редактируемых полей (0 data-bind)', u.condBinds.length===0, u.condBinds.length);
// concl assign panel
await showTab('tab-concl'); u = await ui();
ok('spec: панель назначения отделов активна (+ Добавить отдел)', u.assignSel===true, u.assignSel);
ok('spec: своего редактора заключения нет', u.conclEditor===0, u.conclEditor);
ok('spec: подсказка «переключите роль на Отдел» видна', u.conclHint===true, u.conclHint);

console.log('\n--- 2.6 Режим правки: enter → change → cancel/save ---');
await setRole('spec');
await goto(A_DRAFT_GROUP, 'tab-cond');
await page.evaluate(() => enterEdit());
u = await ui();
ok('spec/edit: тулбар = Сохранить/Отмена', hasBtn(u,'Сохранить') && hasBtn(u,'Отмена'), toolbarLabels(u));
ok('spec/edit: в «Условиях» появились редактируемые поля (data-bind>0)', u.condBinds.length>0, u.condBinds.length);
// change a bound field & verify live-write + cancel revert + save persist
const editRes = await page.evaluate((num) => {
  const app = APPLICATIONS.find(a=>a.num===num);
  const el = document.querySelector('#tab-cond input[data-bind], #tab-cond textarea[data-bind]');
  if (!el) return { ok:false, reason:'no bound input' };
  const bind = el.getAttribute('data-bind');
  const before = app[bind];
  // live write
  el.value = 'ZZZ777';
  el.dispatchEvent(new Event('input', { bubbles:true }));
  const live = app[bind];
  cancelEdit();
  const afterCancel = app[bind];
  // now save path
  enterEdit();
  const el2 = document.querySelector(`#tab-cond [data-bind="${bind}"]`);
  el2.value = 'YYY888';
  el2.dispatchEvent(new Event('input', { bubbles:true }));
  saveEdit();
  const afterSave = app[bind];
  // restore original to keep data clean
  enterEdit();
  const el3 = document.querySelector(`#tab-cond [data-bind="${bind}"]`);
  if (el3){ el3.value = before==null?'':before; el3.dispatchEvent(new Event('input',{bubbles:true})); }
  saveEdit();
  return { ok:true, bind, before, live, afterCancel, afterSave };
}, A_DRAFT_GROUP);
ok('edit: правка пишется в объект вживую', editRes.ok && editRes.live==='ZZZ777', editRes);
ok('edit: «Отмена» откатывает к снимку', editRes.ok && editRes.afterCancel===editRes.before, editRes);
ok('edit: «Сохранить» фиксирует правку', editRes.ok && editRes.afterSave==='YYY888', editRes);

console.log('\n--- 2.7 Смена роли при незакоммиченной правке (_revertEdit, тот же app) ---');
const roleRevert = await page.evaluate((num) => {
  setRole('spec'); gotoDetail(num, 'tab-cond'); enterEdit();
  const app = APPLICATIONS.find(a=>a.num===num);
  const el = document.querySelector('#tab-cond input[data-bind], #tab-cond textarea[data-bind]');
  const bind = el.getAttribute('data-bind'); const before = app[bind];
  el.value='MIDEDIT'; el.dispatchEvent(new Event('input',{bubbles:true}));
  const dirty = app[bind];
  setRole('ro'); // должно откатить и выйти из правки
  const after = app[bind];
  const editModeGone = !document.querySelector('#detailToolbar button') || ![...document.querySelectorAll('#detailToolbar button')].some(b=>/Сохранить/.test(b.textContent));
  setRole('spec');
  return { bind, before, dirty, after, editModeGone };
}, A_DRAFT_GROUP);
ok('роль-свитч: правка была применена вживую', roleRevert.dirty==='MIDEDIT', roleRevert);
ok('роль-свитч: смена роли откатывает правку', roleRevert.after===roleRevert.before, roleRevert);
ok('роль-свитч: режим правки выключен', roleRevert.editModeGone===true, roleRevert);

console.log('\n--- 2.8 Переключение вкладки в режиме правки ---');
const tabInEdit = await page.evaluate((num) => {
  setRole('spec'); gotoDetail(num,'tab-cond'); enterEdit();
  const el = document.querySelector('#tab-cond input[data-bind], #tab-cond textarea[data-bind]');
  const bind = el.getAttribute('data-bind');
  el.value='TABKEEP'; el.dispatchEvent(new Event('input',{bubbles:true}));
  showTab('tab-0');            // уходим
  const stillEdit1 = [...document.querySelectorAll('#detailToolbar button')].some(b=>/Сохранить/.test(b.textContent));
  showTab('tab-cond');         // возвращаемся
  const el2 = document.querySelector(`#tab-cond [data-bind="${bind}"]`);
  const keptVal = el2 ? el2.value : null;
  const stillEdit2 = [...document.querySelectorAll('#detailToolbar button')].some(b=>/Сохранить/.test(b.textContent));
  cancelEdit();
  return { stillEdit1, stillEdit2, keptVal };
}, A_DRAFT_GROUP);
ok('таб-свитч в правке: режим правки сохраняется', tabInEdit.stillEdit1 && tabInEdit.stillEdit2, tabInEdit);
ok('таб-свитч в правке: набранное значение не потеряно', tabInEdit.keptVal==='TABKEEP', tabInEdit);

console.log('\n--- 2.9 Смена ЗАЯВКИ в режиме правки (leak / dangling snapshot) ---');
const appSwitch = await page.evaluate((nums) => {
  const [ga, gb] = nums;
  const A = APPLICATIONS.find(a=>a.num===ga);
  const Bref = APPLICATIONS.find(a=>a.num===gb);      // держим ССЫЛКУ (num может быть перезаписан)
  const Asnap = JSON.parse(JSON.stringify(A));
  const Bsnap = JSON.parse(JSON.stringify(Bref));
  setRole('spec'); gotoDetail(ga, 'tab-cond'); enterEdit();
  const el = document.querySelector('#tab-cond input[data-bind], #tab-cond textarea[data-bind]');
  const bind = el.getAttribute('data-bind'); const before = A[bind];
  el.value='LEAKTEST'; el.dispatchEvent(new Event('input',{bubbles:true}));
  // уходим на ДРУГУЮ заявку без Save/Cancel
  gotoDetail(gb, 'tab-0');
  const editModeAfter = [...document.querySelectorAll('#detailToolbar button')].some(b=>/Сохранить/.test(b.textContent));
  const leakedA = A[bind]; // осталась ли непринятая правка в объекте A
  // теперь коррупция: setRole (→ _revertEdit) при dangling snapshot и _detailApp=B
  setRole('com');
  const Bcorrupted = Bref.num !== gb || Bref.name !== Bsnap.name || Bref.status !== Bsnap.status;
  const Bnum = Bref.num, Bname = Bref.name, Bstatus = Bref.status;
  // ПОЛНОЕ восстановление данных (иначе последующие тесты сломаются)
  setRole('spec');
  Object.keys(Bref).forEach(k => { if (!(k in Bsnap)) delete Bref[k]; }); Object.assign(Bref, Bsnap);
  Object.keys(A).forEach(k => { if (!(k in Asnap)) delete A[k]; }); Object.assign(A, Asnap);
  return { bind, before, leakedA, editModeAfter, Bnum, BnumExpect: gb, Bname, BnameExpect: Bsnap.name, Bstatus, BstatusExpect: Bsnap.status, Bcorrupted };
}, [A_DRAFT_GROUP, A_REVIEW]);
ok('app-свитч: режим правки сбрасывается на новой заявке', appSwitch.editModeAfter===false, appSwitch);
ok('app-свитч: НЕсохранённая правка НЕ должна оставаться в объекте A', appSwitch.leakedA===appSwitch.before, {bind:appSwitch.bind, before:appSwitch.before, leaked:appSwitch.leakedA});
ok('app-свитч→роль-свитч: заявка B НЕ должна быть повреждена _revertEdit', appSwitch.Bcorrupted===false, appSwitch);

console.log('\n--- 2.10 РОЛЬ com на review(103): editOp + голосование ---');
await setRole('com');
await goto(A_REVIEW, 'tab-cond');
u = await ui();
ok('com/review: тулбар содержит «Изменить» (canEditOp)', hasBtn(u,'Изменить'), toolbarLabels(u));
ok('com/review: «Условия» read-only до входа в правку (0 data-bind)', u.condBinds.length===0, u.condBinds.length);
await page.evaluate(()=>enterEdit()); await showTab('tab-cond'); u = await ui();
ok('com/review/edit: «Условия» стали редактируемыми (data-bind>0)', u.condBinds.length>0, u.condBinds.length);
await page.evaluate(()=>cancelEdit());
await showTab('tab-6'); u = await ui();
ok('com/review: во вкладке «Комиссия» есть действия комиссии', u.comVoteRow.length>0, u.comVoteRow);

console.log('\n--- 2.11 РОЛЬ spec на review(103): только чтение ---');
await setRole('spec');
await goto(A_REVIEW, 'tab-cond');
u = await ui();
ok('spec/review: НЕТ «Изменить» (canEditNow=false)', !hasBtn(u,'Изменить'), toolbarLabels(u));
ok('spec/review: тулбар содержит «Отозвать» (spec toolbar)', hasBtn(u,'Отозвать'), toolbarLabels(u));
ok('spec/review: «Условия» read-only (0 data-bind)', u.condBinds.length===0, u.condBinds.length);

console.log('\n--- 2.12 РОЛЬ com на locked(101): canEditSched → «Изменить» ---');
await setRole('com');
await goto(A_LOCKED, 'tab-0');
u = await ui();
ok('com/locked: тулбар содержит «Изменить» (график, P3-R13)', hasBtn(u,'Изменить'), toolbarLabels(u));

console.log('\n--- 2.13 РОЛЬ spec на locked(101): «Сформировать кредит» ---');
await setRole('spec');
await goto(A_LOCKED, 'tab-0');
u = await ui();
ok('spec/locked(Одобрена): тулбар «Сформировать кредит»', u.tbBtns.some(b=>/Сформировать кредит/.test(b.t)), toolbarLabels(u));

console.log('\n--- 2.14 РОЛЬ dept: редактор своего отдела (105, confirmedMet) ---');
await setRole('dept');
await setDept('risk');
await goto(A_DRAFT_GROUP, 'tab-concl');
u = await ui();
// risk в seed 105 = submitted 'cond' → редактор в замороженном виде + Отозвать
ok('dept/risk: редактор своего отдела отрисован', u.conclEditor>0, u.conclEditor);
ok('dept/risk(submitted): кнопка «Отозвать» доступна', u.withdrawBtn===true, u.withdrawBtn);
ok('dept: НЕТ панели назначения отделов (assignDepts=false)', u.assignSel===false, u.assignSel);
// переключить на неназначенный отдел → откат к первому назначенному
const deptFallback = await page.evaluate((num) => {
  setRole('dept'); gotoDetail(num,'tab-concl');
  const assigned = _conclOf(_detailApp).assigned.map(a=>a.dept);
  setDept('security'); // security НЕ назначен на 105
  const opts = [...document.querySelectorAll('#deptSel option')].map(o=>o.value);
  const selVal = document.getElementById('deptSel').value;
  return { assigned, opts, selVal, securityAssigned: assigned.includes('security') };
}, A_DRAFT_GROUP);
ok('dept: security не назначен на 105', deptFallback.securityAssigned===false, deptFallback);
ok('dept: setDept(неназначенный) → селектор откатывается к назначенному', deptFallback.assigned.includes(deptFallback.selVal), deptFallback);
ok('dept: селектор показывает только назначенные отделы', deptFallback.opts.every(o=>deptFallback.assigned.includes(o)), deptFallback);

console.log('\n--- 2.15 can()-снимок роли: сменили роль ПОСЛЕ can(), затем editConcl ---');
const snapTest = await page.evaluate((num) => {
  setRole('dept'); setDept('risk'); gotoDetail(num,'tab-concl');
  const app = _detailApp;
  const cap = can(app);            // снимок: curRole=dept, curDept=risk
  const before = cap.editConcl('risk');
  setRole('spec');                 // роль сменилась ПОСЛЕ can()
  const after = cap.editConcl('risk'); // должно остаться как на момент снимка
  setRole('dept'); setDept('risk');
  return { before, after };
}, A_DRAFT_GROUP);
ok('can-снимок: editConcl не «уезжает» после смены роли', snapTest.before===snapTest.after && snapTest.before===true, snapTest);

console.log('\n--- 2.16 РОЛЬ ro (остальные): ничего не редактируемо/активно ---');
for (const [num, label] of [[A_DRAFT_GROUP,'draft/105'],[A_REVIEW,'review/103'],[A_LOCKED,'locked/101']]){
  await setRole('ro');
  await goto(num, 'tab-0');
  u = await ui();
  ok(`ro ${label}: тулбар пуст`, u.tbBtns.length===0, toolbarLabels(u));
  ok(`ro ${label}: спец-кнопки списка скрыты`, u.listBtns.every(b=>b && b.hidden===true), u.listBtns);
  await showTab('tab-cond'); u = await ui();
  ok(`ro ${label}: «Условия» без редактируемых полей`, u.condBinds.length===0, u.condBinds.length);
  await showTab('tab-concl'); u = await ui();
  ok(`ro ${label}: нет панели назначения отделов`, u.assignSel===false, u.assignSel);
  ok(`ro ${label}: нет своего редактора заключения`, u.conclEditor===0, u.conclEditor);
  await showTab('tab-6'); u = await ui();
  ok(`ro ${label}: нет активных действий во вкладке «Комиссия»`, u.comVoteRow.length===0, u.comVoteRow);
}

console.log('\n--- 2.17 Навигация список ↔ деталка ---');
const nav = await page.evaluate((num) => {
  showView('list');
  const listShown1 = document.getElementById('view-list').style.display !== 'none';
  gotoDetail(num);
  const detailShown = document.getElementById('view-detail').style.display !== 'none';
  // кнопка назад
  const back = document.getElementById('crumbBack');
  const backVisible = back && back.style.display !== 'none';
  _crumbBack && _crumbBack();
  const listShown2 = document.getElementById('view-list').style.display !== 'none';
  const detailHidden = document.getElementById('view-detail').style.display === 'none';
  // повторное открытие
  gotoDetail(num);
  const reDetail = document.getElementById('view-detail').style.display !== 'none';
  return { listShown1, detailShown, backVisible, listShown2, detailHidden, reDetail };
}, A_DRAFT_GROUP);
ok('nav: список виден стартово', nav.listShown1, nav);
ok('nav: открытие деталки показывает detail', nav.detailShown, nav);
ok('nav: кнопка «назад» видима в деталке', nav.backVisible, nav);
ok('nav: назад → список виден, деталка скрыта', nav.listShown2 && nav.detailHidden, nav);
ok('nav: повторное открытие деталки работает', nav.reDetail, nav);

// финальный контроль JS-ошибок
console.log('\n================= JS-ОШИБКИ =================');
if (jsErrors.length) jsErrors.forEach(e=>console.log('  ', e)); else console.log('  нет');

console.log('\n================= СВОДКА =================');
console.log(`Ассертов: ${ASSERTS} · PASS: ${PASS} · FAIL: ${FAIL} · JS-ошибок: ${jsErrors.length} · matrix-drift: ${matrixMismatch}`);
if (fails.length){ console.log('\nПРОВАЛЫ:'); fails.forEach(f=>console.log('  ✗', f)); }

await ctx.close();
process.exit(0);
