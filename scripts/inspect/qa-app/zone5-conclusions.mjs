// Zone 5 — вкладка «Заключения» (tab-concl). EDGE-CASES.
// Дополняет счастливый путь scripts/inspect/conclusions-check.mjs: копает
// границы прав, потерю данных, идемпотентность, гейт при 0 отделах и т.п.
// Запуск: node scripts/inspect/qa-app/zone5-conclusions.mjs  (из корня репо)
import { chromium } from 'playwright-core';

const FILE = 'file://' + process.cwd() + '/mockups/loan-application/loan-application.html';
const PROFILE = '/tmp/claude-1000/-home-azamat-projects-asubk-credit-module/6cba1142-d414-4023-9699-97169fbf0a64/scratchpad/p-zone5';

const ctx = await chromium.launchPersistentContext(PROFILE,
  { channel:'chrome', headless:true, viewport:{ width:1500, height:1600 } });
const page = ctx.pages()[0] || await ctx.newPage();

const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

const results = [];
const check = (name, ok) => { results.push((ok ? 'PASS ' : 'FAIL ') + name); };

async function load(){
  await page.goto(FILE, { waitUntil:'networkidle' });
  await page.waitForTimeout(300);
}
async function open(num, role, dept){
  await page.evaluate(([n, r, d]) => {
    setRole(r || 'spec');
    if (r === 'dept' && d) setDept(d);
    gotoDetail(n, 'tab-concl'); showTab('tab-concl');
  }, [num, role, dept]);
  await page.waitForTimeout(150);
}

await load();

// ── A: Назначение отделов ────────────────────────────────────────────────
// A1: назначить ВСЕ 7 отделов на залоговой заявке (draft, ТУР → есть залог).
await open('З-2026-000080', 'spec');
const a1 = await page.evaluate(() => {
  const app = _detailApp;
  const seed = _conclOf(app).assigned.map(a => a.dept).join(',');     // risk,credit,coll
  ['legal', 'analytics', 'security', 'monitor'].forEach(k => conclAssign(k));
  const all = _conclOf(app).assigned.map(a => a.dept);
  const adderOpts = [...document.querySelectorAll('#tab-concl #conclAddSel option')].map(o => o.value).filter(Boolean);
  return { seed, all, adderGone: adderOpts.length === 0, total: _conclCounts(app).total };
});
check('A1 залоговый сид = risk,credit,coll', a1.seed === 'risk,credit,coll');
check('A1 можно назначить все 7 отделов', a1.all.length === 7 && a1.total === 7);
check('A1 когда назначены все — селектор добора пуст', a1.adderGone === true);

// A2: гейт при 0 отделах. Через UI недостижимо (risk/credit заперты), но проверяем
// текст гейта форсируя пустой assigned на подтверждённой заявке 105.
await open('З-2026-000105', 'spec');
const a2 = await page.evaluate(() => {
  const app = _detailApp, c = _conclOf(app);
  c.assigned = []; c.items = {};
  return {
    banner: _conclGateBanner(app),
    reason: sendGateReason(app),
    ready:  conclusionsReady(app),
    // недостижимость: у дефолтных нет кнопки ✕
    riskHasX: false,
  };
});
check('A2 при 0 отделах баннер зовёт назначить', /Отделы не назначены/.test(a2.banner));
check('A2 при 0 отделах гейт закрыт с причиной', a2.ready === false && /не назначен/i.test(a2.reason));

// A3: дефолтный отдел не имеет кнопки снятия (недостижимо снять через UI).
await load();                                              // A2 обнулил assigned у 105 — вернуть сид
await open('З-2026-000105', 'spec');
const a3 = await page.evaluate(() => {
  const riskChip = document.querySelector('#tab-concl .dept-chip[data-dept="risk"]');
  const creditChip = document.querySelector('#tab-concl .dept-chip[data-dept="credit"]');
  return {
    riskNoX:   !riskChip.querySelector('.chip-x') && !!riskChip.querySelector('.chip-lock'),
    creditNoX: !creditChip.querySelector('.chip-x') && !!creditChip.querySelector('.chip-lock'),
  };
});
check('A3 дефолтные чипы заперты (🔒, нет ✕)', a3.riskNoX === true && a3.creditNoX === true);

// A4: авто-отдел залога на залоговой заявке снять нельзя.
await open('З-2026-000080', 'spec');
const a4 = await page.evaluate(() => {
  conclUnassign('coll');                                   // locked (auto+залог)
  const still = _conclOf(_detailApp).assigned.some(a => a.dept === 'coll');
  const chip = document.querySelector('#tab-concl .dept-chip[data-dept="coll"]');
  return { still, locked: chip && chip.classList.contains('locked'), auto: !!chip.querySelector('.chip-auto') };
});
check('A4 отдел залога (авто) снять нельзя, чип заперт + метка «авто»',
  a4.still === true && a4.locked === true && a4.auto === true);

// A5: снять отдел с ВНЕСЁННЫМ заключением → данные удаляются; повторное
// назначение НЕ восстанавливает их (fresh pending). Модалка предупреждает.
await load();
await open('З-2026-000105', 'spec');
const a5 = await page.evaluate(() => {
  conclAssign('security');
  setRole('dept'); setDept('security');
  document.getElementById('concl-v-security').value = 'pos';
  document.getElementById('concl-t-security').value = 'Стоп-факторов не выявлено, проверка завершена.';
  conclSubmit('security');
  const submitted = _conclOf(_detailApp).items.security.status;
  setRole('spec');
  conclUnassign('security');                               // submitted → модалка
  const modalText = document.getElementById('concl-unassign-text').textContent;
  conclUnassignConfirm();
  const gone = !_conclOf(_detailApp).assigned.some(a => a.dept === 'security');
  conclAssign('security');                                 // назначаем заново
  const it = _conclOf(_detailApp).items.security;
  return { submitted, modalText, gone, status: it.status, text: it.text, logLen: it.log.length };
});
check('A5 снятие внесённого предупреждает об удалении',
  a5.submitted === 'submitted' && /будет удалено/.test(a5.modalText));
check('A5 повторное назначение даёт чистую pending-карточку (данные не восстановлены)',
  a5.gone === true && a5.status === 'pending' && a5.text === '' && a5.logLen === 1);

// A6: отмена снятия (модалка ✕/«Отмена») ничего не меняет.
await open('З-2026-000105', 'spec');
const a6 = await page.evaluate(() => {
  conclAssign('monitor');                                  // pending — снимется без модалки, назначим и внесём черновик
  setRole('dept'); setDept('monitor');
  document.getElementById('concl-t-monitor').value = 'Черновик мониторинга.';
  conclSaveDraft('monitor');                               // draft → снятие спросит
  setRole('spec');
  conclUnassign('monitor');
  const before = _conclOf(_detailApp).assigned.map(a => a.dept).join(',');
  conclUnassignCancel();
  const after = _conclOf(_detailApp).assigned.map(a => a.dept).join(',');
  const closed = !document.getElementById('modal-concl-unassign').classList.contains('open');
  return { before, after, closed };
});
check('A6 отмена снятия закрывает модалку и сохраняет отдел',
  a6.before === a6.after && /monitor/.test(a6.after) && a6.closed === true);

// A7: двойное назначение одного отдела — без дубля.
await load();                                              // сброс: A5/A6 добавляли отделы к 105
await open('З-2026-000105', 'spec');
const a7 = await page.evaluate(() => {
  const n0 = _conclOf(_detailApp).assigned.length;
  conclAssign('security'); conclAssign('security');
  const arr = _conclOf(_detailApp).assigned.map(a => a.dept);
  const dup = arr.filter(d => d === 'security').length;
  return { grew: arr.length === n0 + 1, dup };
});
check('A7 двойное назначение не создаёт дубль', a7.grew === true && a7.dup === 1);

// A8 (латентно): conclAssign('coll') на беззалоговой заявке — тост «назначен»,
// но _conclSyncColl удалит отдел на ближайшей перерисовке → фантомное действие.
await open('З-2026-000105', 'spec');
const a8 = await page.evaluate(() => {
  conclAssign('coll');                                     // покажет тост «Отдел назначен: Отдел залога»
  const after = _conclOf(_detailApp).assigned.some(a => a.dept === 'coll');   // _conclOf → sync снимет
  const collInAdder = [...document.querySelectorAll('#tab-concl #conclAddSel option')].map(o => o.value).includes('coll');
  return { after, collInAdder };
});
check('A8 coll в доборе не предлагается (авто-отдел)', a8.collInAdder === false);
check('A8 ручное conclAssign(coll) на беззалоговой — не остаётся (фантом, но тост «назначен» вводит в заблуждение)',
  a8.after === false);

// ── B: Синхронизация с залогом (_conclSyncColl) ──────────────────────────
await load();
await open('З-2026-000105', 'spec');
const b1 = await page.evaluate(() => {
  const app = _detailApp;
  const before = _conclOf(app).assigned.some(a => a.dept === 'coll');
  app.hasCollateral = true;                                // «появился залог»
  const c = _conclOf(app);                                 // _conclSyncColl добавит coll
  const rec = c.assigned.find(a => a.dept === 'coll');
  return { before, added: !!rec, auto: rec && rec.auto, locked: _conclLocked(app, 'coll'), item: !!c.items.coll };
});
check('B1 включение залога авто-назначает отдел залога (auto, заперт)',
  b1.before === false && b1.added === true && b1.auto === true && b1.locked === true && b1.item === true);

const b2 = await page.evaluate(() => {
  const app = _detailApp, c = _conclOf(app);
  const it = c.items.coll;
  it.status = 'submitted'; it.verdict = 'pos'; it.text = 'Залог оценён.'; it.author = 'ЖУМАБЕКОВ Н. Т.';
  it.log.push({ ts:'x', who:'y', action:'submitted', note:'' });
  const logBefore = it.log.length;
  app.hasCollateral = false;                               // «залог убрали»
  _conclOf(app);                                           // sync снимет coll + удалит item целиком
  const stillAssigned = c.assigned.some(a => a.dept === 'coll');
  const itemGone = !c.items.coll;
  return { logBefore, stillAssigned, itemGone };
});
check('B2 выключение залога молча удаляет внесённое заключение отдела залога вместе с историей',
  b2.stillAssigned === false && b2.itemGone === true);
// ↑ ДЕФЕКТ-наблюдение: в отличие от снятия отдела (модалка «будет удалено»),
//   _conclSyncColl удаляет submitted-заключение И его log без предупреждения/записи.

// ── C: ЖЦ и защита экшнов редактора ──────────────────────────────────────
await load();
// C1: conclCondDel/conclFileDel НЕ проверяют права → правят ВНЕСЁННОЕ (frozen) заключение.
await open('З-2026-000105', 'spec');                       // роль spec (не имеет права на заключения вовсе)
const c1 = await page.evaluate(() => {
  const it = _conclOf(_detailApp).items.risk;              // risk — submitted, 2 условия, 1 файл
  const conds0 = it.conds.length, files0 = it.files.length, status0 = it.status;
  conclCondDel('risk', 0);                                 // нет проверки can().editConcl → мутирует submitted
  const condsAfterDel = _conclOf(_detailApp).items.risk.conds.length;
  conclFileDel('risk', 0);                                 // то же для вложений
  const filesAfterDel = _conclOf(_detailApp).items.risk.files.length;
  const status1 = _conclOf(_detailApp).items.risk.status;
  return { conds0, files0, status0, condsAfterDel, filesAfterDel, status1 };
});
check('C1 предусловие: risk внесён (submitted) с 2 условиями и 1 файлом',
  c1.status0 === 'submitted' && c1.conds0 === 2 && c1.files0 === 1);
check('C1 conclCondDel/conclFileDel не трогают ВНЕСЁННОЕ (frozen) заключение из чужой роли (_conclEditable)',
  c1.condsAfterDel === c1.conds0 && c1.filesAfterDel === c1.files0 && c1.status1 === 'submitted');

// C2: роль dept на заявке в фазе review — редактор недоступен, conclSubmit no-op.
await load();
const c2 = await page.evaluate(() => {
  const rev = APPLICATIONS.find(a => a.status === 'На рассмотрении');
  setRole('dept'); gotoDetail(rev.num, 'tab-concl');
  const dep = _conclOf(rev).assigned[0].dept; setDept(dep);
  const edit = can(rev).editConcl(dep);
  const st0 = _conclOf(rev).items[dep].status;
  conclSubmit(dep); conclSaveDraft(dep); conclClear(dep);
  const st1 = _conclOf(rev).items[dep].status;
  return { phase: condPhase(rev.status), edit, unchanged: st0 === st1 };
});
check('C2 фаза review: заключения править нельзя, экшны — no-op',
  c2.phase === 'review' && c2.edit === false && c2.unchanged === true);

// C3: не-dept роли (gf/com/ro) не вносят заключения даже на подтверждённом черновике.
await load();
const c3 = await page.evaluate(() => {
  const out = {};
  ['gf', 'com', 'ro', 'spec'].forEach(r => {
    setRole(r); gotoDetail('З-2026-000105', 'tab-concl');
    const st0 = _conclOf(_detailApp).items.analytics.status;
    document.getElementById('concl-v-analytics') && (document.getElementById('concl-v-analytics').value = 'pos');
    conclSubmit('analytics');
    const st1 = _conclOf(_detailApp).items.analytics.status;
    out[r] = { edit: can(_detailApp).editConcl('analytics'), unchanged: st0 === st1 };
  });
  return out;
});
check('C3 gf/com/ro/spec не имеют права на заключение и conclSubmit — no-op',
  ['gf','com','ro','spec'].every(r => c3[r].edit === false && c3[r].unchanged === true));

// C4: conclWithdraw на черновике/pending — no-op (нет права: status !== submitted).
await load();
await open('З-2026-000105', 'dept', 'legal');             // legal — draft
const c4 = await page.evaluate(() => {
  const st0 = _conclOf(_detailApp).items.legal.status;    // draft
  conclWithdraw('legal');
  const modal = document.getElementById('modal-concl-withdraw').classList.contains('open');
  return { st0, modal };
});
check('C4 отзыв недоступен для черновика (модалка не открылась)', c4.st0 === 'draft' && c4.modal === false);

// ── E: Отрицательные вердикты ────────────────────────────────────────────
await load();
await open('З-2026-000105', 'spec');
const e1 = await page.evaluate(() => {
  const c = _conclOf(_detailApp);
  const set = (k, v) => { const it = c.items[k]; it.status = 'submitted'; it.verdict = v; it.text = 'x'; it.author = 'A'; it.date = 'd'; };
  set('risk', 'neg'); set('legal', 'neg'); set('credit', 'pos'); set('analytics', 'pos');
  const neg = _conclNegDepts(_detailApp);
  const banner = _conclGateBanner(_detailApp);
  const reason = sendGateReason(_detailApp);
  return { neg, banner, reason, ready: conclusionsReady(_detailApp), counts: _conclCounts(_detailApp) };
});
check('E1 два отрицательных отдела перечислены (модель)', e1.neg.join(',') === 'risk,legal');
check('E1 баннер называет оба отрицательных отдела',
  /Отдел рисков/.test(e1.banner) && /Юридический отдел/.test(e1.banner) && /err/.test(e1.banner));
check('E1 причина гейта называет оба отрицательных', /Отдел рисков/.test(e1.reason) && /Юридический отдел/.test(e1.reason));
check('E1 два neg: гейт закрыт, счётчик neg=2', e1.ready === false && e1.counts.neg === 2);

const e2 = await page.evaluate(() => {
  const c = _conclOf(_detailApp);
  ['risk', 'legal'].forEach(k => { const it = c.items[k]; it.verdict = 'pos'; });   // отозвали neg → внесли pos
  return { neg: _conclNegDepts(_detailApp), ready: conclusionsReady(_detailApp), banner: _conclGateBanner(_detailApp) };
});
check('E2 после замены neg→pos гейт открывается', e2.neg.length === 0 && e2.ready === true && /note-banner ok/.test(e2.banner));

// ── F: Возврат комиссией (_conclResetByCommission) ───────────────────────
await load();
await open('З-2026-000105', 'spec');
const f1 = await page.evaluate(() => {
  const c = _conclOf(_detailApp);
  // сид 105: risk submitted, credit submitted, legal draft, analytics pending
  const snap = k => ({ status: c.items[k].status, log: c.items[k].log.length, text: c.items[k].text, conds: c.items[k].conds.length });
  const before = { risk: snap('risk'), legal: snap('legal'), analytics: snap('analytics') };
  _conclResetByCommission(_detailApp);
  const after = { risk: snap('risk'), legal: snap('legal'), analytics: snap('analytics') };
  const riskLastAct = c.items.risk.log[c.items.risk.log.length - 1].action;
  return { before, after, riskLastAct };
});
check('F1 submitted → draft, вердикт снят, текст/условия целы',
  f1.after.risk.status === 'draft' && f1.after.risk.text === f1.before.risk.text && f1.after.risk.conds === f1.before.risk.conds);
check('F1 история не теряется, добавлена запись reset_by_commission',
  f1.after.risk.log === f1.before.risk.log + 1 && f1.riskLastAct === 'reset_by_commission');
check('F1 draft/pending заключения не тронуты возвратом',
  f1.after.legal.status === 'draft' && f1.after.legal.log === f1.before.legal.log &&
  f1.after.analytics.status === 'pending' && f1.after.analytics.log === f1.before.analytics.log);

// ── G: UI-устойчивость ───────────────────────────────────────────────────
await load();
// G1: conclToggleAll при 0 карточек — не падает; кнопки «Развернуть все» нет.
await open('З-2026-000105', 'spec');
const g1 = await page.evaluate(() => {
  const app = _detailApp, c = _conclOf(app);
  c.assigned = []; c.items = {};
  _panelRefresh('tab-concl');
  const btn = document.querySelector('#tab-concl .concl-listh');
  let threw = false;
  try { conclToggleAll(); } catch(e){ threw = true; }
  return { noBtn: !btn, threw };
});
check('G1 при 0 карточек «Развернуть все» отсутствует и conclToggleAll не падает',
  g1.noBtn === true && g1.threw === false);

// G2: conclScrollTo для несуществующего состояния — тост, без исключения.
await open('З-2026-000105', 'spec');
const g2 = await page.evaluate(() => {
  let threw = false;
  try { conclScrollTo('neg'); } catch(e){ threw = true; }   // на 105 отрицательных нет
  return { threw };
});
check('G2 conclScrollTo несуществующего состояния не падает', g2.threw === false);

// G3: chips-счётчики отражают сид 105 (pos1 cond1 neg0 pending2) через реальный DOM.
await load();                                              // G1 обнулил assigned у 105 — вернуть сид
await open('З-2026-000105', 'spec');
const g3 = await page.evaluate(() =>
  [...document.querySelectorAll('#tab-concl .vchip')].map(c => c.dataset.kind + ':' + c.dataset.n).join(' '));
check('G3 чипы-счётчики сида 105: pos1 cond1 neg0 pending2', g3 === 'pos:1 cond:1 neg:0 pending:2');

// ── H: Идемпотентность _conclOf/_conclSeed ───────────────────────────────
await load();
await open('З-2026-000105', 'spec');
const h1 = await page.evaluate(() => {
  const app = _detailApp;
  const ref1 = _conclOf(app);
  conclAssign('security');                                 // мутируем состояние
  const len = ref1.assigned.length;
  const ref2 = _conclOf(app);                              // повторный вызов не пересоздаёт
  return { same: ref1 === ref2, preserved: ref2.assigned.length === len, hasSecurity: ref2.assigned.some(a => a.dept === 'security') };
});
check('H1 _conclOf идемпотентен: возвращает тот же объект, не пересоздаёт состояние',
  h1.same === true && h1.preserved === true && h1.hasSecurity === true);

// ── Финал ────────────────────────────────────────────────────────────────
const fails = results.filter(r => r.startsWith('FAIL'));
console.log(results.join('\n'));
console.log('\n— ИТОГО: ' + results.length + ' ассертов, ' + fails.length + ' провалов, ' + errors.length + ' JS-ошибок —');
console.log(errors.length ? '\nERRORS:\n' + errors.join('\n') : 'NO JS ERRORS');

await ctx.close();
process.exit(fails.length || errors.length ? 1 : 0);
