// Проверка фичи «Заключения отделов» (спек 2026-07-10).
// Грузит мокап, драйвит назначение/ЖЦ заключений, ассертит модель и DOM. Ищет JS-ошибки.
import { chromium } from 'playwright-core';
const FILE = 'file://' + process.cwd() + '/mockups/loan-application/loan-application.html';
const ctx = await chromium.launchPersistentContext('.auth/profile-mock',
  { channel:'chrome', headless:true, viewport:{ width:1500, height:1600 } });
const page = ctx.pages()[0] || await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

await page.goto(FILE, { waitUntil:'networkidle' });
await page.waitForTimeout(400);

const results = [];
const check = (name, ok) => { results.push((ok ? 'PASS ' : 'FAIL ') + name); };

// Заявка З-2026-000105 — демо-сид: комплект подтверждён ГФ, залога нет,
// заключения в трёх состояниях (submitted · submitted · draft · pending).
async function openConcl(num, role){
  await page.evaluate(([n, r]) => { setRole(r || 'spec'); gotoDetail(n, 'tab-concl'); showTab('tab-concl'); }, [num, role]);
  await page.waitForTimeout(250);
}

// ── T1: справочник и модель ──────────────────────────────────────────────
await openConcl('З-2026-000105');
const t1 = await page.evaluate(() => {
  const app = _detailApp, c = _conclOf(app);
  return {
    dirKeys:   DEPT_DIR.map(d => d.key),
    dflt:      DEPT_DIR.filter(d => d.dflt).map(d => d.key),
    hasColl:   app.hasCollateral,
    assigned:  c.assigned.map(a => a.dept),
    statuses:  c.assigned.map(a => c.items[a.dept].status),
    riskV:     c.items.risk.verdict,
    riskConds: c.items.risk.conds.length,
    riskFiles: c.items.risk.files.length,
    lockedRisk:   _conclLocked(app, 'risk'),
    lockedLegal:  _conclLocked(app, 'legal'),
    counts:    _conclCounts(app),
    ready:     conclusionsReady(app),
    logLen:    c.items.risk.log.length,
  };
});
check('T1 справочник содержит 7 отделов', t1.dirKeys.length === 7 && t1.dirKeys.includes('analytics') && t1.dirKeys.includes('monitor'));
check('T1 дефолтные — risk + credit', t1.dflt.join(',') === 'risk,credit');
check('T1 у демо-заявки 105 залога нет', t1.hasColl === false);
check('T1 сид 105: назначены risk,credit,legal,analytics', t1.assigned.join(',') === 'risk,credit,legal,analytics');
check('T1 сид 105: статусы submitted,submitted,draft,pending', t1.statuses.join(',') === 'submitted,submitted,draft,pending');
check('T1 сид 105: риск — «С условиями», 2 пункта, 1 вложение', t1.riskV === 'cond' && t1.riskConds === 2 && t1.riskFiles === 1);
check('T1 дефолтный отдел заперт, опциональный — нет', t1.lockedRisk === true && t1.lockedLegal === false);
check('T1 счётчики: pos1 cond1 neg0 pending2 done2 total4',
  t1.counts.pos === 1 && t1.counts.cond === 1 && t1.counts.neg === 0 && t1.counts.pending === 2 &&
  t1.counts.done === 2 && t1.counts.total === 4);
check('T1 гейт закрыт — внесены не все', t1.ready === false);
check('T1 у внесённого заключения есть история', t1.logLen >= 2);

// ── T1b: залог → авто-назначение отдела залога; без залога — только дефолтные;
//        отклонённая заявка — neg у риска ─────────────────────────────────
const t1b = await page.evaluate(() => {
  const coll   = APPLICATIONS.find(a => a.hasCollateral && condPhase(a.status) === 'draft');
  const noColl = APPLICATIONS.find(a => !a.hasCollateral && condPhase(a.status) === 'draft' && a.num !== 'З-2026-000105');
  const rej    = APPLICATIONS.find(a => a.status === 'Отклонена');
  return {
    collDepts:   coll ? _conclOf(coll).assigned.map(a => a.dept) : null,
    collAuto:    coll ? _conclOf(coll).assigned.find(a => a.dept === 'coll').auto : null,
    collLocked:  coll ? _conclLocked(coll, 'coll') : null,
    noCollDepts: noColl ? _conclOf(noColl).assigned.map(a => a.dept) : null,
    noCollLock:  noColl ? _conclLocked(noColl, 'coll') : null,
    rejVerdict:  rej ? _conclOf(rej).items.risk.verdict : null,
    rejReady:    rej ? conclusionsReady(rej) : null,
    negDepts:    rej ? _conclNegDepts(rej) : null,
  };
});
check('T1b при залоге отдел залога назначен авто и заперт',
  t1b.collDepts && t1b.collDepts.join(',') === 'risk,credit,coll' && t1b.collAuto === true && t1b.collLocked === true);
check('T1b без залога назначены только дефолтные, coll не заперт',
  t1b.noCollDepts && t1b.noCollDepts.join(',') === 'risk,credit' && t1b.noCollLock === false);
check('T1b отклонённая заявка: у риска отрицательное', t1b.rejVerdict === 'neg');
check('T1b отрицательное закрывает гейт', t1b.rejReady === false && t1b.negDepts.join(',') === 'risk');

// ── T2: роль «Отдел» + селектор отдела, права ────────────────────────────
await openConcl('З-2026-000105', 'dept');
const t2 = await page.evaluate(() => {
  const app = _detailApp;
  const sw  = document.getElementById('deptSwitch');
  const sel = document.getElementById('deptSel');
  const opts = sel ? [...sel.options].map(o => o.value) : [];
  setDept('legal');
  const c = can(_detailApp);
  return {
    switchVisible: sw && !sw.hidden,
    opts,
    ownLegal:  c.editConcl('legal'),
    otherRisk: c.editConcl('risk'),
    withdrawRiskAsLegal: c.withdrawConcl('risk'),
    assign:    c.assignDepts,
  };
});
check('T2 селектор отдела виден в роли «Отдел»', t2.switchVisible === true);
check('T2 селектор перечисляет назначенные отделы', t2.opts.join(',') === 'risk,credit,legal,analytics');
check('T2 отдел правит только свой блок', t2.ownLegal === true && t2.otherRisk === false);
check('T2 отдел не отзывает чужое заключение', t2.withdrawRiskAsLegal === false);
check('T2 отдел не назначает отделы', t2.assign === false);

const t2b = await page.evaluate(() => {
  // риск внёс заключение → своя роль может отозвать
  setRole('dept'); setDept('risk');
  const c1 = can(_detailApp);
  // спец назначает; заключения не правит
  setRole('spec');
  const c2 = can(_detailApp);
  const sw = document.getElementById('deptSwitch');
  return { withdrawOwn:c1.withdrawConcl('risk'), draftOwn:c1.editConcl('risk'),
           specAssign:c2.assignDepts, specEdit:c2.editConcl('risk'), switchHidden: sw.hidden };
});
check('T2b свой отдел: правка и отзыв внесённого доступны', t2b.withdrawOwn === true && t2b.draftOwn === true);
check('T2b спец назначает, но не пишет заключения', t2b.specAssign === true && t2b.specEdit === false);
check('T2b у спеца селектор отдела скрыт', t2b.switchHidden === true);

// внесение закрыто, пока комплект не подтверждён ГФ (заявка З-2026-000080 — не подтверждена)
const t2c = await page.evaluate(() => {
  setRole('dept'); gotoDetail('З-2026-000080', 'tab-concl'); setDept('risk');
  return { confirmed:_docStats(_detailApp).confirmedMet, edit:can(_detailApp).editConcl('risk') };
});
check('T2c без подтверждения ГФ внесение закрыто', t2c.confirmed === false && t2c.edit === false);

// ── T3: панель назначения ────────────────────────────────────────────────
await openConcl('З-2026-000105', 'spec');
const t3 = await page.evaluate(() => {
  const chips = [...document.querySelectorAll('#tab-concl .dept-chip')].map(c => c.dataset.dept);
  const locked = [...document.querySelectorAll('#tab-concl .dept-chip.locked')].map(c => c.dataset.dept);
  const addOpts = [...document.querySelectorAll('#tab-concl #conclAddSel option')].map(o => o.value).filter(Boolean);
  return { chips, locked, addOpts };
});
check('T3 чипы = назначенные отделы', t3.chips.join(',') === 'risk,credit,legal,analytics');
check('T3 заперты только дефолтные', t3.locked.join(',') === 'risk,credit');
// coll в списке добора не появляется никогда: он назначается автоматически по наличию залога
check('T3 в «добавить» — неназначенные, кроме авто-отдела', t3.addOpts.join(',') === 'security,monitor');

const t3b = await page.evaluate(() => {
  conclAssign('security');
  const c = _conclOf(_detailApp);
  const it = c.items.security;
  return { assigned:c.assigned.map(a => a.dept), status:it.status, log:it.log.map(l => l.action) };
});
check('T3b добавление отдела создаёт pending-карточку',
  t3b.assigned.join(',') === 'risk,credit,legal,analytics,security' && t3b.status === 'pending' && t3b.log[0] === 'assigned');

// снятие пустого отдела — без подтверждения; снятие с заключением — через модалку
const t3c = await page.evaluate(() => {
  conclUnassign('security');                               // pending → сразу
  const afterEmpty = _conclOf(_detailApp).assigned.map(a => a.dept).join(',');
  conclUnassign('analytics');                              // тоже pending → сразу
  const afterPending = _conclOf(_detailApp).assigned.map(a => a.dept).join(',');
  conclUnassign('legal');                                  // legal — draft → спросит
  const modalOpen = document.getElementById('modal-concl-unassign').classList.contains('open');
  const still = _conclOf(_detailApp).assigned.map(a => a.dept).includes('legal');
  // отмена (крестик/«Отмена») должна разряжать _conclPendingUnassign, иначе последующий
  // confirm без свежего запроса снимет ранее отменённый отдел
  conclUnassignCancel();
  const modalClosedAfterCancel = !document.getElementById('modal-concl-unassign').classList.contains('open');
  conclUnassignConfirm();                                  // confirm без свежего unassign — не должен ничего снимать
  const afterCancelConfirm = _conclOf(_detailApp).assigned.map(a => a.dept).join(',');
  conclUnassign('legal');                                  // настоящий повторный запрос
  conclUnassignConfirm();
  const afterConfirm = _conclOf(_detailApp).assigned.map(a => a.dept).join(',');
  conclAssign('legal'); conclAssign('analytics');           // вернуть сид для следующих блоков
  _conclOf(_detailApp).items.legal.status = 'draft';
  _conclOf(_detailApp).items.legal.text = DEPT_MAP.legal.seed;
  return { afterEmpty, afterPending, modalOpen, still, modalClosedAfterCancel, afterCancelConfirm, afterConfirm };
});
check('T3c пустой отдел снимается сразу', t3c.afterEmpty === 'risk,credit,legal,analytics');
check('T3c pending снимается сразу', t3c.afterPending === 'risk,credit,legal');
check('T3c непустой отдел спрашивает подтверждение', t3c.modalOpen === true && t3c.still === true);
check('T3c отмена снятия закрывает модалку и разряжает _conclPendingUnassign',
  t3c.modalClosedAfterCancel === true && t3c.afterCancelConfirm === 'risk,credit,legal');
check('T3c подтверждение снимает отдел', t3c.afterConfirm === 'risk,credit');

const t3d = await page.evaluate(() => {
  conclUnassign('risk');                                   // заперт — снятие невозможно
  const kept = _conclOf(_detailApp).assigned.map(a => a.dept).includes('risk');
  setRole('dept'); showTab('tab-concl');                    // не спец → кнопок панели нет
  const btns = document.querySelectorAll('#tab-concl .dept-chip .chip-x, #tab-concl #conclAddSel').length;
  const panel = !!document.querySelector('#tab-concl .dept-panel');
  return { kept, btns, panel };
});
check('T3d дефолтный отдел снять нельзя', t3d.kept === true);
check('T3d не-спец видит панель, но без кнопок', t3d.panel === true && t3d.btns === 0);

console.log(results.join('\n'));
console.log(errors.length ? '\nERRORS:\n' + errors.join('\n') : '\nNO JS ERRORS');
await ctx.close();
if (results.some(r => r.startsWith('FAIL')) || errors.length) process.exit(1);
