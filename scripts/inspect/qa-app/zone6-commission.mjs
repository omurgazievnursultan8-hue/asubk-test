/* Zone 6 QA — вкладка «Комиссия» (tab-6) + поток отправки заявки в комиссию.
   Тестируется mockups/loan-application/loan-application.html (только чтение).
   Запуск: node scripts/inspect/qa-app/zone6-commission.mjs  (из корня репо) */
import { chromium } from 'playwright-core';

const FILE = 'file:///home/azamat/projects/asubk-credit-module/mockups/loan-application/loan-application.html';
const PROFILE = '/tmp/claude-1000/-home-azamat-projects-asubk-credit-module/6cba1142-d414-4023-9699-97169fbf0a64/scratchpad/p-zone6';

const ctx = await chromium.launchPersistentContext(PROFILE, { channel:'chrome', headless:true, viewport:{ width:1500, height:1600 } });
const page = ctx.pages()[0] || await ctx.newPage();
const jsErrs = [];
page.on('pageerror', e => jsErrs.push('PAGEERROR ' + e.message));
page.on('console', m => { if (m.type() === 'error') jsErrs.push('CONSOLE ' + m.text()); });

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, extra){ if (cond){ pass++; } else { fail++; fails.push(name + (extra ? ' :: ' + extra : '')); console.log('  FAIL', name, extra || ''); } }

await page.goto(FILE, { waitUntil:'networkidle' });
await page.waitForTimeout(400);

// ---------------------------------------------------------------------------
console.log('\n== 1. commissionFor: null для Новый/Отозвана, объект для остальных ==');
const cf = await page.evaluate(() => {
  const mk = st => ({ status:st, num:'X', amount:'1 000 000,00', program:'ТУР', inn:'20907199400957' });
  const test = st => { try { const r = commissionFor(mk(st)); return r === null ? 'null' : 'obj'; } catch(e){ return 'THROW:' + e.message; } };
  const statuses = ['Новый','Отозвана','На рассмотрении','Требуется доп. информация','Одобрена','Ожидает решения/программы','На оформлении','Оформлена','Отклонена','Одобрено','Отклонено','НесуществующийСтатус'];
  const out = {}; statuses.forEach(s => out[s] = test(s));
  return out;
});
ok('commissionFor(Новый)=null', cf['Новый'] === 'null', cf['Новый']);
ok('commissionFor(Отозвана)=null', cf['Отозвана'] === 'null', cf['Отозвана']);
ok('commissionFor(На рассмотрении)=obj', cf['На рассмотрении'] === 'obj', cf['На рассмотрении']);
ok('commissionFor(Одобрена)=obj', cf['Одобрена'] === 'obj', cf['Одобрена']);
ok('commissionFor(Отклонена)=obj', cf['Отклонена'] === 'obj', cf['Отклонена']);
// Алиасные (старые) статусы: в sets их нет → должны вернуть null без падения
ok('commissionFor(Одобрено алиас) не падает и =null', cf['Одобрено'] === 'null', cf['Одобрено']);
ok('commissionFor(Отклонено алиас) не падает и =null', cf['Отклонено'] === 'null', cf['Отклонено']);
ok('commissionFor(неизвестный статус)=null', cf['НесуществующийСтатус'] === 'null', cf['НесуществующийСтатус']);

console.log('\n== 1b. STATUS_ALIAS нормализация: в APPLICATIONS нет сырых Одобрено/Отклонено ==');
const rawAlias = await page.evaluate(() => {
  const bad = APPLICATIONS.filter(a => a.status === 'Одобрено' || a.status === 'Отклонено').map(a => a.num);
  const metaOdobreno = STATUS_META['Одобрено'];   // ключ отсутствует → undefined (алиас в 'Одобрена')
  const metaOdobrena = !!STATUS_META['Одобрена'];
  return { bad, metaOdobrenoUndef: metaOdobreno === undefined, metaOdobrena };
});
ok('нет заявок со статусом-алиасом после загрузки', rawAlias.bad.length === 0, JSON.stringify(rawAlias.bad));
ok('STATUS_META ключа Одобрено нет (только Одобрена)', rawAlias.metaOdobrenoUndef && rawAlias.metaOdobrena, JSON.stringify(rawAlias));

console.log('\n== 2. sendGateReason: приоритет причин отказа ==');
const gate = await page.evaluate(() => {
  // Синтетические app-состояния с мок-хелперами. Патчим глобальные хелперы временно.
  const _dS = window._docStats, _cov = window.coverageOf, _cc = window._conclCounts,
        _neg = window._conclNegDepts, _cw = window._conclWaiting;
  const R = {};
  const run = (name, patch) => {
    Object.assign(window, patch.fns);
    try { R[name] = sendGateReason(patch.app); } catch(e){ R[name] = 'THROW:' + e.message; }
    window._docStats=_dS; window.coverageOf=_cov; window._conclCounts=_cc; window._conclNegDepts=_neg; window._conclWaiting=_cw;
  };
  const base = { met:false, blockers:0, requested:0, reqClosed:0, reqTot:5, reqConfirmed:0, confirmedMet:false };
  // Приоритет 1: отклонённые/просроченные доки (blockers) — раньше "не полный комплект"
  run('blockers', { app:{ isGroup:false, hasCollateral:false },
    fns:{ _docStats:()=>({...base, blockers:2}) } });
  // Приоритет 2: ожидание интеграции (requested) — при met=false, blockers=0
  run('requested', { app:{ isGroup:false, hasCollateral:false },
    fns:{ _docStats:()=>({...base, requested:1}) } });
  // Приоритет 3: не полный комплект
  run('incomplete', { app:{ isGroup:false, hasCollateral:false },
    fns:{ _docStats:()=>({...base, reqClosed:3}) } });
  // Приоритет 4: залог — нет предметов (met=true)
  run('coll-noitems', { app:{ isGroup:false, hasCollateral:true },
    fns:{ _docStats:()=>({...base, met:true, confirmedMet:true}), coverageOf:()=>({hasItems:false, covOk:false, cov:0}) } });
  // Приоритет 5: залог — покрытие ниже порога
  run('coll-lowcov', { app:{ isGroup:false, hasCollateral:true },
    fns:{ _docStats:()=>({...base, met:true, confirmedMet:true}), coverageOf:()=>({hasItems:true, covOk:false, cov:80}) } });
  // Приоритет 6: не подтверждён ГФ (met=true, залога нет, confirmedMet=false)
  run('notconfirmed', { app:{ isGroup:false, hasCollateral:false },
    fns:{ _docStats:()=>({...base, met:true, confirmedMet:false, reqConfirmed:2}) } });
  // Приоритет 7: отделы не назначены (всё ок по докам, cc.total=0)
  run('nodepts', { app:{ isGroup:false, hasCollateral:false },
    fns:{ _docStats:()=>({...base, met:true, confirmedMet:true, reqConfirmed:5}), _conclCounts:()=>({total:0, done:0}), _conclNegDepts:()=>[] } });
  // Приоритет 8: отрицательное заключение
  run('neg', { app:{ isGroup:false, hasCollateral:false },
    fns:{ _docStats:()=>({...base, met:true, confirmedMet:true, reqConfirmed:5}), _conclCounts:()=>({total:2, done:2}), _conclNegDepts:()=>['risk'] } });
  // Приоритет 9: не все заключения внесены
  run('pending-concl', { app:{ isGroup:false, hasCollateral:false },
    fns:{ _docStats:()=>({...base, met:true, confirmedMet:true, reqConfirmed:5}), _conclCounts:()=>({total:3, done:1}), _conclNegDepts:()=>[], _conclWaiting:()=>['Юридический'] } });
  // Всё готово → ''
  run('ready', { app:{ isGroup:false, hasCollateral:false },
    fns:{ _docStats:()=>({...base, met:true, confirmedMet:true, reqConfirmed:5}), _conclCounts:()=>({total:2, done:2}), _conclNegDepts:()=>[] } });
  return R;
});
ok('гейт: blockers → "отклонённые/просроченные"', /отклонённые|просроченные/.test(gate.blockers), gate.blockers);
ok('гейт: requested → "Ожидается ответ интеграции"', /Ожидается ответ интеграции/.test(gate.requested), gate.requested);
ok('гейт: incomplete → "не полный обязательный комплект"', /не полный обязательный комплект/.test(gate.incomplete), gate.incomplete);
ok('гейт: залог без предметов', /Не указан ни один предмет залога/.test(gate['coll-noitems']), gate['coll-noitems']);
ok('гейт: залог покрытие ниже порога', /Коэффициент покрытия/.test(gate['coll-lowcov']), gate['coll-lowcov']);
ok('гейт: не подтверждён ГФ', /не подтверждена головным филиалом/.test(gate.notconfirmed), gate.notconfirmed);
ok('гейт: отделы не назначены', /Отделы для заключений не назначены/.test(gate.nodepts), gate.nodepts);
ok('гейт: отрицательное заключение', /Отрицательное заключение/.test(gate.neg), gate.neg);
ok('гейт: не все заключения внесены', /Внесено заключений/.test(gate['pending-concl']), gate['pending-concl']);
ok('гейт: всё готово → пустая строка', gate.ready === '', JSON.stringify(gate.ready));
// Приоритет: blockers должен победить requested (оба met=false)
const prio = await page.evaluate(() => {
  const _dS = window._docStats;
  window._docStats = () => ({ met:false, blockers:1, requested:1, reqClosed:2, reqTot:5, reqConfirmed:0, confirmedMet:false });
  const r = sendGateReason({ isGroup:false, hasCollateral:false });
  window._docStats = _dS; return r;
});
ok('приоритет blockers > requested', /отклонённые|просроченные/.test(prio), prio);

console.log('\n== 3. appStage: узел для каждого статуса ==');
const stages = await page.evaluate(() => {
  const mk = (st, com) => { const a = { status:st, num:'S', amount:'1 000 000,00', program:'ТУР', inn:'20907199400957' }; if (com) a._com = com; return a; };
  // подмешаем всё-ок хелперы для draft-веток
  const set = (ds, cn) => { window._docStats = () => ds; window.conclusionsReady = () => cn; window._conclNegDepts = () => []; };
  const _dS = window._docStats, _cr = window.conclusionsReady, _neg = window._conclNegDepts;
  const R = {};
  const decided = ['Одобрена','Ожидает решения/программы','На оформлении','Оформлена'];
  decided.forEach(s => { R[s] = appStage(mk(s)); });
  R['Отклонена'] = appStage(mk('Отклонена'));
  R['review-prelim'] = appStage(mk('На рассмотрении', { phase:'prelim' }));
  R['review-session'] = appStage(mk('На рассмотрении', { phase:'session' }));
  // Черновик, комплект не собран
  set({ accMet:false, confirmedMet:false }, false); R['draft-nocollect'] = appStage(mk('Новый'));
  // Собран/принят, но не подтверждён ГФ
  set({ accMet:true, confirmedMet:false }, false); R['draft-notconfirmed'] = appStage(mk('Новый'));
  // Подтверждён, заключений нет
  set({ accMet:true, confirmedMet:true }, false); R['draft-noconcl'] = appStage(mk('Требуется доп. информация'));
  // Всё готово
  set({ accMet:true, confirmedMet:true }, true); R['draft-ready'] = appStage(mk('Новый'));
  window._docStats=_dS; window.conclusionsReady=_cr; window._conclNegDepts=_neg;
  return R;
});
ok('appStage(Одобрена)=узел5 approved', stages['Одобрена'].i === 5 && stages['Одобрена'].decided === 'approved', JSON.stringify(stages['Одобрена']));
ok('appStage(Оформлена)=узел5 approved', stages['Оформлена'].i === 5 && stages['Оформлена'].decided === 'approved');
ok('appStage(Отклонена)=узел5 rejected', stages['Отклонена'].i === 5 && stages['Отклонена'].decided === 'rejected', JSON.stringify(stages['Отклонена']));
ok('appStage(На рассм., prelim)=узел4', stages['review-prelim'].i === 4, JSON.stringify(stages['review-prelim']));
ok('appStage(На рассм., session)=узел5', stages['review-session'].i === 5, JSON.stringify(stages['review-session']));
ok('appStage(черновик, не собран)=узел1', stages['draft-nocollect'].i === 1, JSON.stringify(stages['draft-nocollect']));
ok('appStage(собран, не подтв.)=узел2', stages['draft-notconfirmed'].i === 2, JSON.stringify(stages['draft-notconfirmed']));
ok('appStage(подтв., без закл.)=узел3', stages['draft-noconcl'].i === 3, JSON.stringify(stages['draft-noconcl']));
ok('appStage(всё готово)=узел3 ready', stages['draft-ready'].i === 3 && stages['draft-ready'].ready === true, JSON.stringify(stages['draft-ready']));

console.log('\n== 4. STATUS_META step для каждого статуса ==');
const steps = await page.evaluate(() => {
  const R = {};
  Object.keys(STATUS_META).forEach(s => R[s] = STATUS_META[s].step);
  return {
    R,
    stepperEl: !!document.getElementById('stepper'),
    deadFns: ['renderStepper','STATUS_STEP_MAP','STEP_LABELS','STEP_DATE'].filter(n => typeof window[n] !== 'undefined'),
  };
});
ok('#stepper удалён из вёрстки (шапочный степпер убран)', steps.stepperEl === false, String(steps.stepperEl));
ok('мёртвый код степпера удалён (renderStepper/STATUS_STEP_MAP/STEP_*)', steps.deadFns.length === 0, JSON.stringify(steps.deadFns));
ok('step: Новый=0', steps.R['Новый'] === 0);
ok('step: На рассмотрении=1', steps.R['На рассмотрении'] === 1);
ok('step: Одобрена=2', steps.R['Одобрена'] === 2);
ok('step: На оформлении=3', steps.R['На оформлении'] === 3);
ok('step: Оформлена=4', steps.R['Оформлена'] === 4);

console.log('\n== 5. _comStateOf: засев фаз по статусу ==');
const comState = await page.evaluate(() => {
  const mk = st => ({ status:st, num:'C'+st, amount:'1 000 000,00', program:'ТУР', inn:'20907199400957' });
  const s1 = _comStateOf(mk('На рассмотрении'));           // open → prelim, без подписей/скана
  const s2 = _comStateOf(mk('Одобрена'));                  // closed → session, подписи+скан
  const s3 = _comStateOf(mk('Требуется доп. информация')); // open:false → session, closed
  return {
    review: { phase:s1.phase, anySign:s1.sign.some(Boolean), scan:s1.scan },
    approved: { phase:s2.phase, allSign:s2.sign.every(Boolean), scan:s2.scan },
    info: { phase:s3.phase, scan:s3.scan },
  };
});
ok('_comStateOf(На рассм.): prelim, без подписей, без скана', comState.review.phase === 'prelim' && !comState.review.anySign && !comState.review.scan, JSON.stringify(comState.review));
ok('_comStateOf(Одобрена): session, все подписи, скан', comState.approved.phase === 'session' && comState.approved.allSign && comState.approved.scan, JSON.stringify(comState.approved));
ok('_comStateOf(Треб.доп.инфо): session', comState.info.phase === 'session', JSON.stringify(comState.info));

console.log('\n== 6. Действия комиссии: НЕТ проверки роли в модели ==');
// Драйвим реальные глобальные сеттеры: gotoDetail (устанавливает _detailApp), setRole.
const roleGuard = await page.evaluate(() => {
  gotoDetail('З-2026-000103');                    // На рассмотрении → _detailApp=103
  const app = APPLICATIONS.find(a => a.num === 'З-2026-000103');
  _comStateOf(app); app._com.phase = 'prelim'; app._com.sign = [false,false,false,false]; app._com.scan = false;
  setRole('ro');                                  // роль «Остальные»: кнопок в UI нет
  const before = app._com.phase;
  comAdvance();                                   // модель не проверяет роль
  const afterAdvance = app._com.phase;
  comSign(0);
  const signedByRo = app._com.sign[0];
  comUploadProtocol();
  const scanByRo = app._com.scan;
  setRole('spec');
  return { before, afterAdvance, signedByRo, scanByRo };
});
ok('comAdvance не срабатывает ролью ro (гард в модели, а не только в UI)', roleGuard.before === 'prelim' && roleGuard.afterAdvance === 'prelim', JSON.stringify(roleGuard));
ok('comSign не срабатывает ролью ro', roleGuard.signedByRo === false, JSON.stringify(roleGuard));
ok('comUploadProtocol не срабатывает ролью ro', roleGuard.scanByRo === false, JSON.stringify(roleGuard));

console.log('\n== 6b. comAdvance/comUploadProtocol без гейтов ==');
const advNoGate = await page.evaluate(() => {
  gotoDetail('З-2026-000103');
  const app = APPLICATIONS.find(a => a.num === 'З-2026-000103');
  _comStateOf(app); app._com.phase = 'prelim'; app._com.sign = [false,false,false,false]; app._com.scan = false;
  setRole('com');
  comAdvance();                                    // нет проверки заключений/подписей/комплекта
  const phase = app._com.phase;
  app._com.scan = false;
  comUploadProtocol();                             // до подписей — модель не блокирует
  const scanNoSign = app._com.scan;
  setRole('spec');
  return { phase, scanNoSign };
});
ok('comAdvance не выносит на заседание без подтверждённого комплекта/заключений', advNoGate.phase === 'prelim', JSON.stringify(advNoGate));
ok('comUploadProtocol не пишет скан без подписей (гард в модели, не только UI)', advNoGate.scanNoSign === false, JSON.stringify(advNoGate));

console.log('\n== 7. Голоса захардкожены; кнопки голосования = демо-тост ==');
const votes = await page.evaluate(() => {
  const app = { status:'На рассмотрении', num:'V', amount:'1 000 000,00', program:'ТУР', inn:'20907199400957' };
  const c1 = commissionFor(app);
  const votesBefore = c1.members.map(m => m.vote);
  // «голосование» через toolbarAction ничего не меняет — commissionFor пересоздаёт объект из статуса
  const c2 = commissionFor(app);
  const votesAfter = c2.members.map(m => m.vote);
  return { votesBefore, votesAfter, open:c1.open };
});
ok('votes(На рассм.)=[—,Одобрить,—,Отклонить]', JSON.stringify(votes.votesBefore) === JSON.stringify(['—','Одобрить','—','Отклонить']), JSON.stringify(votes.votesBefore));
ok('commissionFor(На рассм.).open=true', votes.open === true);
ok('голоса детерминированы статусом (не хранятся)', JSON.stringify(votes.votesBefore) === JSON.stringify(votes.votesAfter));

console.log('\n== 8. _reqDocList: контракт/coll исключены; залог подмешан; группа ==');
const reqDoc = await page.evaluate(() => {
  const find = num => APPLICATIONS.find(a => a.num === num);
  // юрлицо с залогом (АгроИнвест КР) — 103
  const org = find('З-2026-000103');
  window._detailApp = org;
  const orgList = _reqDocList(org);
  // Групповая (Поддержка сельхозпроизводителей) — 105
  const grp = find('З-2026-000105');
  window._detailApp = grp;
  const grpList = _reqDocList(grp);
  const hasMemberDocs = grpList.some(d => /^mem:/.test(d.key));
  // есть ли contract/coll ключи
  const orgHasContractOrColl = orgList.some(d => /contract|::/.test(d.key) === false ? false : false);
  return {
    orgCount: orgList.length,
    orgHasColl: org.hasCollateral && orgList.some(d => d.key.indexOf('::') >= 0),
    grpCount: grpList.length,
    grpHasMemberDocs: hasMemberDocs,
    grpKeys: grpList.map(d => d.key),
  };
});
ok('_reqDocList(юрлицо+залог): содержит залоговые доки (::)', reqDoc.orgHasColl === true, JSON.stringify(reqDoc.orgHasColl));
ok('_reqDocList: непустой для юрлица', reqDoc.orgCount > 0, String(reqDoc.orgCount));
ok('_reqDocList(группа): документы членов попадают (mem:<pin>::<docId>), app-level ident/fin — нет',
   reqDoc.grpHasMemberDocs === true && !reqDoc.grpKeys.some(k => k === 'p1' || k === 'inn'), JSON.stringify(reqDoc.grpKeys));

console.log('\n== 9. Сквозной путь: черновик 105 → отправка → На рассмотрении ==');
// 9a. Довносим заключения ролью dept (legal, analytics) через реальные setRole/setDept/conclSubmit
const readyState = await page.evaluate(() => {
  gotoDetail('З-2026-000105', 'tab-concl');            // _detailApp=105 (Новый, комплект подтверждён ГФ)
  const app = APPLICATIONS.find(a => a.num === 'З-2026-000105');
  const before = sendReady(app);
  const beforeReason = sendGateReason(app);
  setRole('dept');                                     // роль «Отдел»
  const fill = (dept) => {
    setDept(dept);                                     // _deptKey=dept, перерисовка tab-concl
    const it = _conclOf(app).items[dept];
    it.verdict = 'pos'; it.text = 'Заключение отдела ' + dept + ' — положительное, замечаний нет.';
    const v = document.getElementById('concl-v-' + dept); if (v) v.value = 'pos';
    const t = document.getElementById('concl-t-' + dept); if (t) t.value = it.text;
    conclSubmit(dept);
    return _conclOf(app).items[dept].status;
  };
  const legalSt = fill('legal');
  const analyticsSt = fill('analytics');
  setRole('spec');
  return { before, beforeReason, legalSt, analyticsSt, after:sendReady(app), afterReason:sendGateReason(app) };
});
ok('105: sendReady=false до внесения заключений', readyState.before === false, readyState.beforeReason);
ok('105: legal внесён ролью dept', readyState.legalSt === 'submitted', readyState.legalSt);
ok('105: analytics внесён ролью dept', readyState.analyticsSt === 'submitted', readyState.analyticsSt);
ok('105: sendReady=true после всех заключений', readyState.after === true, readyState.afterReason);

// 9b. Список → выбор строки → кнопка «Отправить в комиссию»
const btnState = await page.evaluate(() => {
  showView('list');
  selectRow('З-2026-000105');
  const b = document.getElementById('btnCom');
  return { disabled: b.disabled, title: b.title };
});
ok('btnCom активна для готовой заявки 105', btnState.disabled === false, JSON.stringify(btnState));

// открыть модалку кликом по реальной кнопке
await page.evaluate(() => document.getElementById('btnCom').click());
await page.waitForTimeout(150);
const modalOpen = await page.evaluate(() => document.getElementById('modal-send').classList.contains('open'));
ok('модалка отправки открылась', modalOpen === true);

// 9c. submitSend без выбора комиссии — статус не меняется, поле invalid
const noPick = await page.evaluate(() => {
  const app = APPLICATIONS.find(a => a.num === 'З-2026-000105');
  const stBefore = app.status;
  submitSend();
  return { stBefore, stAfter: app.status, invalid: document.getElementById('send-commission-field').classList.contains('invalid'), stillOpen: document.getElementById('modal-send').classList.contains('open') };
});
ok('submitSend без выбора не меняет статус', noPick.stBefore === noPick.stAfter && noPick.stAfter === 'Новый', JSON.stringify(noPick));
ok('submitSend без выбора: поле invalid, модалка открыта', noPick.invalid && noPick.stillOpen);

// 9d. onSendCommissionChange: выбор снимает invalid (через реальный select + событие)
const afterPick = await page.evaluate(() => {
  const sel = document.getElementById('send-commission');
  sel.value = 'Комиссия по заявкам';
  onSendCommissionChange();
  return document.getElementById('send-commission-field').classList.contains('invalid');
});
ok('onSendCommissionChange снял invalid после выбора', afterPick === false);

// 9e. submitSend с выбором → статус На рассмотрении
const sent = await page.evaluate(() => {
  submitSend();
  const app = APPLICATIONS.find(a => a.num === 'З-2026-000105');
  const c = commissionFor(app);
  const stage = appStage(app);
  return { status: app.status, modalClosed: !document.getElementById('modal-send').classList.contains('open'), commissionNotNull: c !== null, stageI: stage.i };
});
ok('после отправки: статус=На рассмотрении', sent.status === 'На рассмотрении', sent.status);
ok('после отправки: модалка закрыта', sent.modalClosed === true);
ok('после отправки: commissionFor больше не null', sent.commissionNotNull === true);
ok('после отправки: appStage=узел4 (комиссия предв.)', sent.stageI === 4, String(sent.stageI));

// 9f. renderCommission для 105 теперь показывает фазу prelim
const comPanel = await page.evaluate(() => {
  const app = APPLICATIONS.find(a => a.num === 'З-2026-000105');
  const html = renderCommission(app);
  return { hasPrelim: /Предварительное изучение/.test(html), hasBanner: /ещё не отправлена/.test(html) };
});
ok('renderCommission(105): фаза предв. изучения, баннера «не отправлена» нет', comPanel.hasPrelim && !comPanel.hasBanner, JSON.stringify(comPanel));

console.log('\n== 10. renderCommission: баннер для Новый/Отозвана (нет комиссии) ==');
const banner = await page.evaluate(() => {
  const mk = st => ({ status:st, num:'B'+st, amount:'1 000 000,00', program:'ТУР', inn:'20907199400957' });
  const h1 = renderCommission(mk('Новый'));
  const h2 = renderCommission(mk('Отозвана'));
  return { newBanner: /ещё не отправлена/.test(h1), withdrawnBanner: /ещё не отправлена/.test(h2) };
});
ok('renderCommission(Новый): баннер «ещё не отправлена»', banner.newBanner === true);
ok('renderCommission(Отозвана): баннер «ещё не отправлена»', banner.withdrawnBanner === true);

console.log('\n== 11. Двойная отправка: btnCom дизейблится на уже отправленной ==');
const dbl = await page.evaluate(() => {
  // 105 уже 'На рассмотрении'
  selectRow('З-2026-000105');
  const b = document.getElementById('btnCom');
  const disabled = b.disabled;
  const title = b.title;
  // selectRow уже выставил _selNum=105; прямой openSendModal проверяет только sendReady (не статус)
  let opened = false;
  try { openSendModal('credit'); opened = document.getElementById('modal-send').classList.contains('open'); } catch(e){}
  if (opened) closeModal('modal-send');
  return { disabled, title, openSendModalBypasses: opened };
});
ok('btnCom дизейблена для «На рассмотрении» (UI блокирует повторную отправку)', dbl.disabled === true, JSON.stringify(dbl));
ok('openSendModal проверяет статус — прямой вызов на «На рассмотрении» модалку не открывает', dbl.openSendModalBypasses === false, JSON.stringify(dbl));

console.log('\n== 12. Детальный тулбар «Отправить в комиссию» = демо-тост (не openSendModal) ==');
const detailSend = await page.evaluate(() => {
  // Найдём заявку в статусе Новый и посмотрим, что делает кнопка тулбара при sendReady
  const src = TOOLBAR['Новый'].map(x => x[0]);
  // renderToolbar для готовой заявки вставляет onclick toolbarAction (демо), НЕ openSendModal
  const html = (function(){
    const app = APPLICATIONS.find(a => a.num === 'З-2026-000105');   // теперь На рассмотрении, вернём Новый временно
    const saved = app.status; app.status = 'Новый';
    setRole('spec');
    renderToolbar(app);
    const h = document.getElementById('detailToolbar').innerHTML;
    app.status = saved;
    return h;
  })();
  return { toolbarHasSend: src.includes('Отправить в комиссию'), usesToolbarAction: /toolbarAction\('Отправить в комиссию'\)/.test(html), usesOpenSendModal: /openSendModal/.test(html) };
});
ok('тулбар статуса Новый содержит «Отправить в комиссию»', detailSend.toolbarHasSend === true);
ok('детальная кнопка «Отправить» вызывает openSendModal — тот же флоу, что и из списка', detailSend.usesToolbarAction === false && detailSend.usesOpenSendModal === true, JSON.stringify(detailSend));

// ---------------------------------------------------------------------------
console.log('\n================ ИТОГ ================');
console.log(`Ассертов: ${pass + fail} | PASS: ${pass} | FAIL: ${fail} | JS-ошибок: ${jsErrs.length}`);
if (fails.length){ console.log('\nПРОВАЛЫ:'); fails.forEach(f => console.log('  - ' + f)); }
if (jsErrs.length){ console.log('\nJS-ОШИБКИ:'); jsErrs.forEach(e => console.log('  - ' + e)); }

await ctx.close();
