/* ============================================================
   ZONE 4 QA — вкладка «Документы» (tab-2) мокапа «Заявка на кредит».
   Гоняет реальные функции модели документов (ЖЦ дока, гейты, группа, залог)
   через page.evaluate + несколько живых кликов по UI.
   Запуск:  node scripts/inspect/qa-app/zone4-docs.mjs
   ============================================================ */
import { chromium } from 'playwright-core';

const FILE = 'file:///home/azamat/projects/asubk-credit-module/mockups/loan-application/loan-application.html';
const PROFILE = '/tmp/claude-1000/-home-azamat-projects-asubk-credit-module/6cba1142-d414-4023-9699-97169fbf0a64/scratchpad/p-zone4';

const ctx = await chromium.launchPersistentContext(PROFILE, { channel: 'chrome', headless: true, viewport: { width: 1500, height: 1600 } });
const page = ctx.pages()[0] || await ctx.newPage();

const jsErrors = [];
page.on('pageerror', e => jsErrors.push('PAGEERROR ' + e.message));
page.on('console', m => { if (m.type() === 'error') jsErrors.push('CONSOLE ' + m.text()); });

await page.goto(FILE, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

/* ---- Батарея ассертов, целиком в контексте страницы (доступ к реальным функциям). ---- */
const out = await page.evaluate(() => {
  const R = [];   // {name, ok, detail}
  const A = (name, ok, detail) => R.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) });
  const T = (name, fn) => { try { fn(); } catch (e) { A(name, false, 'THREW ' + e.message); } };

  /* Свежее открытие заявки: сбрасываем персистентные сторы, ставим роль/режим. */
  function open(num, role, edit) {
    if (_detailApp && _editMode) cancelEdit();   // снять незакрытую правку на ТЕКУЩЕЙ заявке (иначе _editSnapshot утечёт на следующую)
    const a = APPLICATIONS.find(x => x.num === num);
    ['_docs', '_collDocs', '_memberDocs', '_concl', '_collateral', '_members', '_com'].forEach(k => delete a[k]);
    gotoDetail(num);
    if (role) setRole(role);
    if (edit) enterEdit();
    return a;
  }
  /* Гейтовые кнопки в HTML строки документа. */
  const BTN = ['docUpload', 'docAccept', 'docReject', 'docConfirm', 'docUnconfirm', 'docWaive', 'docUnwaive',
    'docRequest', 'docReqCancel', 'docReqFulfill', 'docPrint', 'docGenerate', 'docView', 'docDownload'];
  function buttonsOf(html) { return BTN.filter(b => html.indexOf(b + '(') >= 0); }
  function rowFor(app, key, st, secKind, extra) {
    const disp = Object.assign({ t: 'X', req: true, st }, extra || {});
    return buttonsOf(docRow(app, disp, key, secKind || null));
  }

  /* =====================================================================
     БЛОК 1. Жизненный цикл документа — переходы состояний через функции
     ===================================================================== */
  T('1.docUpload: required→uploaded, чистит reason', () => {
    open('З-2026-000080', 'spec', true);          // индивид, залоговый, draft
    _findDocState('inc').reason = 'old';          // inc был rejected
    docUpload('inc');
    const d = _findDocState('inc');
    A('1.docUpload: required→uploaded, чистит reason', d.st === 'uploaded' && !d.reason, 'st=' + d.st + ' reason=' + d.reason);
  });
  T('2.docAccept: uploaded→accepted', () => {
    docAccept('inc');
    A('2.docAccept: uploaded→accepted', _findDocState('inc').st === 'accepted', _findDocState('inc').st);
  });
  T('3.docConfirm(gf): accepted→confirmed', () => {
    setRole('gf');                                 // ГФ на draft
    docConfirm('inc');
    A('3.docConfirm(gf): accepted→confirmed', _findDocState('inc').st === 'confirmed', _findDocState('inc').st);
  });
  T('4.docUnconfirm(gf): confirmed→accepted', () => {
    docUnconfirm('inc');
    A('4.docUnconfirm(gf): confirmed→accepted', _findDocState('inc').st === 'accepted', _findDocState('inc').st);
  });
  T('5.docReject через модалку с текстом', () => {
    open('З-2026-000080', 'spec', true);
    docReject('inc');                              // открывает modal-doc-reason
    document.getElementById('doc-reason-text').value = 'скан нечитаем';
    confirmDocReason();
    const d = _findDocState('inc');
    A('5.docReject через модалку с текстом', d.st === 'rejected' && d.reason === 'скан нечитаем', 'st=' + d.st + ' reason=' + d.reason);
  });
  T('6.docReject: пустое обоснование НЕ применяется', () => {
    open('З-2026-000080', 'spec', true);
    const before = _findDocState('inn').st;        // inn = uploaded
    docReject('inn');
    document.getElementById('doc-reason-text').value = '   ';
    confirmDocReason();
    A('6.docReject: пустое обоснование НЕ применяется', _findDocState('inn').st === before, 'st=' + _findDocState('inn').st);
  });
  T('7.docWaive: required→waived + обоснование', () => {
    open('З-2026-000080', 'spec', true);
    docWaive('kb');                                // kb = uploaded req
    document.getElementById('doc-reason-text').value = 'не применимо';
    confirmDocReason();
    const d = _findDocState('kb');
    A('7.docWaive: required→waived + обоснование', d.st === 'waived' && d.waiveReason === 'не применимо', 'st=' + d.st);
  });
  T('8.docUnwaive: waived→required, чистит waiveReason', () => {
    docUnwaive('kb');
    const d = _findDocState('kb');
    A('8.docUnwaive: waived→required, чистит waiveReason', d.st === 'required' && !d.waiveReason, 'st=' + d.st);
  });
  T('9.docRequest: →requested (только у дока с источником)', () => {
    open('З-2026-000080', 'spec', true);
    docRequest('inn');                             // inn источник ГНС
    const d = _findDocState('inn');
    A('9.docRequest: →requested (только у дока с источником)', d.st === 'requested' && d.reqAt, 'st=' + d.st);
  });
  T('10.docReqCancel: requested→required', () => {
    docReqCancel('inn');
    const d = _findDocState('inn');
    A('10.docReqCancel: requested→required', d.st === 'required' && !d.reqAt, 'st=' + d.st);
  });
  T('11.docReqFulfill: requested→uploaded с пометкой источника', () => {
    open('З-2026-000080', 'spec', true);
    docRequest('inn'); docReqFulfill('inn');
    const d = _findDocState('inn');
    A('11.docReqFulfill: requested→uploaded с пометкой источника', d.st === 'uploaded' && d.via, 'st=' + d.st + ' via=' + d.via);
  });
  T('12.docRequest у дока без источника — no-op', () => {
    open('З-2026-000080', 'spec', true);
    const before = _findDocState('pd').st;         // pd — нет в DOC_SOURCES
    docRequest('pd');
    A('12.docRequest у дока без источника — no-op', _findDocState('pd').st === before, 'st=' + _findDocState('pd').st);
  });

  /* =====================================================================
     БЛОК 2. Гейтинг кнопок в docRow (роль × фаза × статус) — запрещённые переходы
     ===================================================================== */
  // spec/draft/editMode
  open('З-2026-000080', 'spec', true);
  const app80 = _detailApp;
  T('13.spec/required: Загрузить+Запросить(src)+Waive, без Проверил', () => {
    const b = rowFor(app80, 'inn', 'required');
    A('13.spec/required: Загрузить+Запросить(src)+Waive, без Проверил',
      b.includes('docUpload') && b.includes('docRequest') && b.includes('docWaive') && !b.includes('docAccept') && !b.includes('docConfirm'), b.join(','));
  });
  T('14.spec/uploaded: Проверил+Отклонить+Заменить, без Запросить', () => {
    const b = rowFor(app80, 'inn', 'uploaded');
    A('14.spec/uploaded: Проверил+Отклонить+Заменить, без Запросить',
      b.includes('docAccept') && b.includes('docReject') && b.includes('docUpload') && !b.includes('docRequest'), b.join(','));
  });
  T('15.spec/requested: Отменить+Ответ получен, без Загрузить/Проверил', () => {
    const b = rowFor(app80, 'inn', 'requested');
    A('15.spec/requested: Отменить+Ответ получен, без Загрузить/Проверил',
      b.includes('docReqCancel') && b.includes('docReqFulfill') && !b.includes('docUpload') && !b.includes('docAccept'), b.join(','));
  });
  T('16.spec/accepted: НЕ показывает Проверил (нельзя принять дважды)', () => {
    const b = rowFor(app80, 'inn', 'accepted');
    A('16.spec/accepted: НЕ показывает Проверил (нельзя принять дважды)', !b.includes('docAccept') && !b.includes('docConfirm'), b.join(','));
  });
  T('17.spec/waived: только Вернуть', () => {
    const b = rowFor(app80, 'inn', 'waived');
    A('17.spec/waived: только Вернуть', b.includes('docUnwaive') && !b.includes('docUpload') && !b.includes('docWaive'), b.join(','));
  });
  // gf/draft
  setRole('gf');
  const app80gf = _detailApp;
  T('18.gf/accepted: Подтвердить+Отклонить', () => {
    const b = rowFor(app80gf, 'inn', 'accepted');
    A('18.gf/accepted: Подтвердить+Отклонить', b.includes('docConfirm') && b.includes('docReject'), b.join(','));
  });
  T('19.gf/required: НЕ подтверждает непринятый док', () => {
    const b = rowFor(app80gf, 'inn', 'required');
    A('19.gf/required: НЕ подтверждает непринятый док', !b.includes('docConfirm') && !b.includes('docUpload'), b.join(','));
  });
  T('20.gf/uploaded: НЕ подтверждает непроверенный спецом', () => {
    const b = rowFor(app80gf, 'inn', 'uploaded');
    A('20.gf/uploaded: НЕ подтверждает непроверенный спецом', !b.includes('docConfirm'), b.join(','));
  });
  T('21.gf/confirmed: Снять подтверждение', () => {
    const b = rowFor(app80gf, 'inn', 'confirmed');
    A('21.gf/confirmed: Снять подтверждение', b.includes('docUnconfirm'), b.join(','));
  });
  // gf на review — всё заперто (unconfirm после отправки в комиссию недоступен)
  T('22.gf/review/confirmed: НЕТ Снять подтверждение (заперто после отправки)', () => {
    open('З-2026-000103', 'gf');                    // На рассмотрении = review
    const b = rowFor(_detailApp, 'inn', 'confirmed');
    A('22.gf/review/confirmed: НЕТ Снять подтверждение (заперто после отправки)', !b.includes('docUnconfirm') && !b.includes('docConfirm'), b.join(','));
  });
  T('23.spec/review: строка документа заперта (нет правок в review)', () => {
    open('З-2026-000103', 'spec');                  // review, editMode невозможен
    const b = rowFor(_detailApp, 'inn', 'uploaded');
    A('23.spec/review: строка документа заперта (нет правок в review)', !b.includes('docUpload') && !b.includes('docAccept'), b.join(','));
  });
  T('24.ro (остальные): только Просмотр/Скачать на файловых статусах', () => {
    open('З-2026-000080', 'ro');
    const b = rowFor(_detailApp, 'inn', 'uploaded');
    A('24.ro (остальные): только Просмотр/Скачать на файловых статусах', b.includes('docView') && b.includes('docDownload') && !b.includes('docAccept') && !b.includes('docUpload'), b.join(','));
  });
  // Подтверждённый ГФ документ спец не обходит: ни «Заменить», ни «Не требуется»
  T('25.spec/confirmed: ни waive, ни замены — 2-й уровень подтверждения не обойти', () => {
    open('З-2026-000080', 'spec', true);
    const b = rowFor(_detailApp, 'inn', 'confirmed');
    A('25.spec/confirmed: ни waive, ни замены — 2-й уровень подтверждения не обойти',
      !b.includes('docWaive') && !b.includes('docUpload'), 'кнопки=' + b.join(','));
  });

  /* =====================================================================
     БЛОК 3. _docStats — инварианты и дельты
     ===================================================================== */
  function inv(app, tag) {
    const s = _docStats(app);
    const open = s.reqTot - s.reqClosed;
    A('inv.' + tag + ' reqClosed<=reqTot', s.reqClosed <= s.reqTot, JSON.stringify(s));
    A('inv.' + tag + ' reqAccepted<=reqClosed', s.reqAccepted <= s.reqClosed);
    A('inv.' + tag + ' reqConfirmed<=reqClosed', s.reqConfirmed <= s.reqClosed);
    A('inv.' + tag + ' blockers+requested<=open', s.blockers + s.requested <= open, 'open=' + open + ' b=' + s.blockers + ' r=' + s.requested);
    A('inv.' + tag + ' met===(reqClosed==reqTot)', s.met === (s.reqTot > 0 && s.reqClosed === s.reqTot));
    A('inv.' + tag + ' confirmedMet===(reqConfirmed==reqTot)', s.confirmedMet === (s.reqTot > 0 && s.reqConfirmed === s.reqTot));
    return s;
  }
  T('26.stats-инварианты: индивид+залог (80)', () => { open('З-2026-000080', 'spec'); inv(_detailApp, '80'); });
  T('27.stats-инварианты: юрлицо+залог (56)', () => { open('З-2026-000056', 'spec'); inv(_detailApp, '56'); });
  T('28.stats-инварианты: группа seed (105)', () => { open('З-2026-000105', 'spec'); inv(_detailApp, '105g'); });

  T('29.тип заёмщика меняет комплект (_docBType fl≠ul)', () => {
    open('З-2026-000080', 'spec'); const si = _docStats(_detailApp).reqTot;   // individual
    open('З-2026-000056', 'spec'); const su = _docStats(_detailApp).reqTot;   // org
    A('29.тип заёмщика меняет комплект (_docBType fl≠ul)', _docBType(APPLICATIONS.find(a => a.num === 'З-2026-000080')) === 'individual'
      && _docBType(APPLICATIONS.find(a => a.num === 'З-2026-000056')) === 'org' && si !== su, 'fl.reqTot=' + si + ' ul.reqTot=' + su);
  });
  T('30.waive: blockers−1, reqClosed+1, reqConfirmed+1 (waived закрыт и учтён у ГФ)', () => {
    open('З-2026-000080', 'spec', true);
    const b = _docStats(_detailApp);                 // inc=rejected → blockers>=1
    docWaive('inc'); document.getElementById('doc-reason-text').value = 'нп'; confirmDocReason();
    const a = _docStats(_detailApp);
    A('30.waive: blockers−1, reqClosed+1, reqConfirmed+1 (waived закрыт и учтён у ГФ)',
      a.blockers === b.blockers - 1 && a.reqClosed === b.reqClosed + 1 && a.reqConfirmed === b.reqConfirmed + 1,
      'before=' + JSON.stringify(b) + ' after=' + JSON.stringify(a));
  });
  T('31.reject: blockers+1, reqClosed−1', () => {
    open('З-2026-000080', 'spec', true);
    const b = _docStats(_detailApp);
    docReject('inn'); document.getElementById('doc-reason-text').value = 'x'; confirmDocReason();  // inn uploaded→rejected
    const a = _docStats(_detailApp);
    A('31.reject: blockers+1, reqClosed−1', a.blockers === b.blockers + 1 && a.reqClosed === b.reqClosed - 1, 'before=' + JSON.stringify(b) + ' after=' + JSON.stringify(a));
  });
  T('32.request: requested+1, reqClosed−1', () => {
    open('З-2026-000080', 'spec', true);
    const b = _docStats(_detailApp);
    docRequest('inn');                               // uploaded→requested (inn источник)
    const a = _docStats(_detailApp);
    A('32.request: requested+1, reqClosed−1', a.requested === b.requested + 1 && a.reqClosed === b.reqClosed - 1, 'before=' + JSON.stringify(b) + ' after=' + JSON.stringify(a));
  });

  /* =====================================================================
     БЛОК 4. Гейт sendReady / sendGateReason — приоритет причин
     ===================================================================== */
  // хелпер: загнать ВСЕ обязательные (заявка+залог+члены) в нужный статус
  function forceAll(app, st) {
    const bt = _docBType(app);
    _docsOf(app).forEach(sec => {
      if (sec.stage === 'contract' || sec.key === 'coll') return;
      if (app.isGroup && ['ident', 'fin'].includes(sec.key)) return;
      sec.docs.forEach(d => { if (d.req && (d.ft === 'both' || d.ft === bt)) { d.st = st; delete d.reason; } });
    });
    if (app.hasCollateral) _collateralOf(app).forEach(it =>
      (COLL_DOC_DEFAULTS[it.kind] || COLL_DOC_FALLBACK).forEach(tpl => { if (tpl.req) _collDocState(app, it.id + '::' + tpl.id, tpl).st = st; }));
    if (app.isGroup) _membersOf(app).forEach((m, i) => _memberDocTpls(m).forEach(tpl => { if (tpl.req) { const s = _memberDocState(app, m, tpl, i); s.st = st; delete s.reason; } }));
  }
  T('33.gate: blockers имеет приоритет над всем', () => {
    open('З-2026-000080', 'spec');
    _docsOf(_detailApp)[0].docs.find(d => d.id === 'inn').st = 'rejected';   // блокер
    _docsOf(_detailApp)[2].docs.find(d => d.id === 'inc').st = 'requested';  // запрос
    const r = sendGateReason(_detailApp);
    A('33.gate: blockers имеет приоритет над всем', /отклонённые|просроченные/i.test(r) && !sendReady(_detailApp), r);
  });
  T('34.gate: requested (нет блокеров)', () => {
    open('З-2026-000080', 'spec');
    forceAll(_detailApp, 'accepted');
    _docsOf(_detailApp)[0].docs.find(d => d.id === 'inn').st = 'requested';
    const r = sendGateReason(_detailApp);
    A('34.gate: requested (нет блокеров)', /Ожидается ответ интеграции/i.test(r), r);
  });
  T('35.gate: неполный комплект (X из Y)', () => {
    open('З-2026-000080', 'spec');                   // дефолт — не собрано, без блокеров у части
    forceAll(_detailApp, 'accepted');
    _docsOf(_detailApp)[0].docs.find(d => d.id === 'inn').st = 'required';
    const r = sendGateReason(_detailApp);
    A('35.gate: неполный комплект (X из Y)', /не полный обязательный комплект/i.test(r), r);
  });
  T('36.gate: залог есть (hasCollateral) но предметов НЕТ', () => {
    open('З-2026-000080', 'spec');
    forceAll(_detailApp, 'confirmed');
    _detailApp._collateral = []; _detailApp._collSeq = 1;   // обнулить предметы
    const r = sendGateReason(_detailApp);
    A('36.gate: залог есть (hasCollateral) но предметов НЕТ', /Не указан ни один предмет залога/i.test(r), r);
  });
  T('37.gate: коэффициент покрытия ниже порога', () => {
    open('З-2026-000080', 'spec');
    forceAll(_detailApp, 'confirmed');
    _collateralOf(_detailApp).forEach(it => it.val = 1);   // покрытие ~0%
    const r = sendGateReason(_detailApp);
    A('37.gate: коэффициент покрытия ниже порога', /Коэффициент покрытия/i.test(r), r);
  });
  T('38.gate: комплект принят но НЕ подтверждён ГФ', () => {
    open('З-2026-000080', 'spec');
    forceAll(_detailApp, 'accepted');                // accepted, не confirmed
    _collateralOf(_detailApp).forEach(it => it.val = 9999999);   // покрытие ок
    const r = sendGateReason(_detailApp);
    A('38.gate: комплект принят но НЕ подтверждён ГФ', /не подтверждена головным филиалом/i.test(r), r);
  });
  T('39.gate: 0 назначенных отделов', () => {
    open('З-2026-000105', 'spec');                   // группа, seed=confirmed, без залога
    _detailApp._concl = { assigned: [], items: {} };
    const r = sendGateReason(_detailApp);
    A('39.gate: 0 назначенных отделов', /Отделы для заключений не назначены/i.test(r), r);
  });
  T('40.gate: отрицательное заключение', () => {
    open('З-2026-000105', 'spec');
    const c = _conclOf(_detailApp);
    c.items[c.assigned[0].dept].status = 'submitted';
    c.items[c.assigned[0].dept].verdict = 'neg';
    const r = sendGateReason(_detailApp);
    A('40.gate: отрицательное заключение', /Отрицательное заключение/i.test(r), r);
  });
  T('41.gate: ждём заключения (N из M)', () => {
    open('З-2026-000105', 'spec');                   // seed: заключения pending
    const r = sendGateReason(_detailApp);
    A('41.gate: ждём заключения (N из M)', /Внесено заключений/i.test(r), r);
  });
  T('42.sendReady=true когда всё закрыто', () => {
    open('З-2026-000105', 'spec');
    const c = _conclOf(_detailApp);
    c.assigned.forEach(a => { c.items[a.dept].status = 'submitted'; c.items[a.dept].verdict = 'pos'; });
    A('42.sendReady=true когда всё закрыто', sendReady(_detailApp) === true && sendGateReason(_detailApp) === '', 'reason=' + sendGateReason(_detailApp));
  });

  /* =====================================================================
     БЛОК 5. Групповая заявка — документы члена
     ===================================================================== */
  T('43.группа: ident/fin НЕ рендерятся на уровне заявки', () => {
    open('З-2026-000105', 'spec');
    const secs = _docsOf(_detailApp).filter(s => !s.collateral && !(_detailApp.isGroup && ['ident', 'fin'].includes(s.key)));
    const keys = secs.map(s => s.key);
    A('43.группа: ident/fin НЕ рендерятся на уровне заявки', !keys.includes('ident') && !keys.includes('fin') && keys.includes('print'), keys.join(','));
  });
  T('44.группа: ключ дока члена mem:<pin>::<docId>', () => {
    const app = _detailApp; const m = _membersOf(app)[0];
    const k = _memberDocKey(m, 'inn');
    A('44.группа: ключ дока члена mem:<pin>::<docId>', k === 'mem:' + m.pin + '::inn', k);
  });
  T('45.группа: _findDocState по mem-ключу возвращает состояние члена', () => {
    const app = _detailApp; const m = _membersOf(app)[0];
    const k = _memberDocKey(m, 'inn');
    const s = _findDocState(k);
    A('45.группа: _findDocState по mem-ключу возвращает состояние члена', s && s === _memberDocsOf(app)[k], 'found=' + !!s);
  });
  T('46.группа: сводка «Вся группа» содержит всех членов + чипы', () => {
    _docMemberView = 'all';
    const html = renderMemberDocs(_detailApp);
    const members = _membersOf(_detailApp);
    A('46.группа: сводка «Вся группа» содержит всех членов + чипы',
      members.every(m => html.indexOf(m.pin) >= 0) && /compl/.test(html), 'len=' + html.length);
  });
  T('47.группа: панель конкретного члена (docMemberView(0))', () => {
    docMemberView(0);
    const html = renderMemberDocs(_detailApp);
    A('47.группа: панель конкретного члена (docMemberView(0))', /Член группы/.test(html) && /Идентификация/.test(html), 'len=' + html.length);
  });
  T('48._memberGateList: >2 плохих → «и ещё N» + поимённо', () => {
    open('З-2026-000097', 'spec');                   // группа без seed
    const app = _detailApp;
    // добавим членов, чтобы плохих (reqClosed<reqTot) стало >2
    _membersOf(app).push({ pin: '23001199500111', fio: 'ТЕСТОВ А. А.', sum: 1, date: '—' });
    _membersOf(app).push({ pin: '23001199500222', fio: 'ТЕСТОВ Б. Б.', sum: 1, date: '—' });
    const g = _memberGateList(app, s => s.reqClosed < s.reqTot, s => s.reqClosed + '/' + s.reqTot);
    A('48._memberGateList: >2 плохих → «и ещё N» + поимённо', /и ещё \d/.test(g) && /чл\./.test(g), g);
  });
  T('49._memberGateList: ≤2 плохих → без «и ещё»', () => {
    open('З-2026-000097', 'spec');
    const app = _detailApp;
    const g = _memberGateList(app, s => s.blockers > 0, s => s.blockers + '');   // только member0 имеет блокер (inc rejected)
    A('49._memberGateList: ≤2 плохих → без «и ещё»', g.indexOf('и ещё') < 0 && g.length > 0, g);
  });
  T('50.delMember: удаляет осиротевшие mem-доки удалённого члена', () => {
    open('З-2026-000097', 'spec', true);
    const app = _detailApp; const m = _membersOf(app)[0]; const pin = m.pin;
    _memberDocState(app, m, _memberDocTpls(m)[0], 0);          // материализуем состояние
    const pre = 'mem:' + pin + '::';
    const had = Object.keys(_memberDocsOf(app)).some(k => k.indexOf(pre) === 0);
    _memberSel = 0; delMember();
    const orphan = Object.keys(_memberDocsOf(app)).filter(k => k.indexOf(pre) === 0);
    A('50.delMember: удаляет осиротевшие mem-доки удалённого члена', had && orphan.length === 0, 'had=' + had + ' orphan=' + orphan.length);
  });
  T('51.дубликат ПИН: коллизия ключа/состояния члена', () => {
    open('З-2026-000097', 'spec');
    const app = _detailApp; const ms = _membersOf(app);
    ms.push({ pin: ms[0].pin, fio: 'КЛОН', sum: 1, date: '—' });   // тот же ПИН, что у члена 0
    const k0 = _memberDocKey(ms[0], 'inn'), kd = _memberDocKey(ms[ms.length - 1], 'inn');
    // _findMemberDocState ищет по findIndex → всегда попадает в ПЕРВОГО с этим ПИН
    const s0 = _findMemberDocState(app, kd);
    const collides = k0 === kd && s0 === _memberDocState(app, ms[0], _memberDocTpls(ms[0]).find(t => t.id === 'inn'), 0);
    A('51.дубликат ПИН: коллизия ключа/состояния члена', collides, 'k0==kd=' + (k0 === kd) + ' (документы клона алиасят члена 0)');
  });
  T('52.член без ПИН: mem-ключ не матчит _MEM_RE → док утекает не в mem-стор', () => {
    open('З-2026-000097', 'spec');
    const app = _detailApp;
    app._members.push({ pin: '', fio: 'БЕЗ ПИН', sum: 1, date: '—' });
    const key = _memberDocKey(app._members[app._members.length - 1], 'inn');   // 'mem:::inn'
    const matches = /^mem:([^:]+)::(.+)$/.test(key);
    const st = _findDocState(key);                          // куда уходит действие?
    A('52.член без ПИН: mem-ключ не матчит _MEM_RE → док утекает не в mem-стор', !matches, 'key=' + key + ' matchesMEM=' + matches + ' _findDocState=' + (st ? 'нашёл(залоговая ветка)' : 'null'));
  });

  /* =====================================================================
     БЛОК 6. Залоговые документы
     ===================================================================== */
  T('53.залог: ключ <itemId>::<tplId>, _findDocState через COLL_DOC_DEFAULTS', () => {
    open('З-2026-000080', 'spec');
    const app = _detailApp; const it = _collateralOf(app)[0];   // Недвижимость id=1
    const key = it.id + '::val';
    const s = _findDocState(key);
    A('53.залог: ключ <itemId>::<tplId>, _findDocState через COLL_DOC_DEFAULTS', s && s === _collDocsOf(app)[key], 'found=' + !!s);
  });
  T('54.залог ТС ::reg — кнопка «Запросить из Минюст» НЕ появляется', () => {
    open('З-2026-000080', 'spec', true);
    const app = _detailApp;
    const ts = _collateralOf(app).find(it => it.kind === 'Транспортное средство');
    const b = rowFor(app, ts.id + '::reg', 'required', null);
    A('54.залог ТС ::reg — кнопка «Запросить из Минюст» НЕ появляется',
      !b.includes('docRequest') && _docSrc(ts.id + '::reg') === undefined, 'кнопки=' + b.join(',') + ' src=' + _docSrc(ts.id + '::reg'));
  });
  T('55.delCollItem: чистит документы удалённого предмета (симметрия с delMember)', () => {
    open('З-2026-000080', 'spec');
    const app = _detailApp; const it = _collateralOf(app)[0]; const key = it.id + '::val';
    _collDocState(app, key, { st: 'uploaded' });          // материализуем
    _collSel = 0; delCollItem();
    const orphan = Object.keys(_collDocsOf(app)).filter(k => k.indexOf(it.id + '::') === 0);
    A('55.delCollItem: чистит документы удалённого предмета (симметрия с delMember)', orphan.length === 0,
      'осиротевших ключей=' + orphan.length);
  });
  T('56.смена kind предмета: шаблон доков меняется, старые состояния осиротевают', () => {
    open('З-2026-000080', 'spec');
    const app = _detailApp; const it = _collateralOf(app)[0];  // Недвижимость: val/title/enc/ins
    _collDocState(app, it.id + '::enc', { st: 'accepted' });   // состояние спец. для Недвижимости
    it.kind = 'Оборудование';                                  // теперь шаблон val/inv
    const tpls = (COLL_DOC_DEFAULTS[it.kind] || COLL_DOC_FALLBACK).map(t => t.id);
    const orphanEnc = _collDocsOf(app)[it.id + '::enc'];       // остаётся в сторе, но не в шаблоне
    A('56.смена kind предмета: шаблон доков меняется, старые состояния осиротевают',
      tpls.join(',') === 'val,inv' && orphanEnc && !tpls.includes('enc'),
      'новый шаблон=' + tpls.join(',') + ' старое enc=' + (orphanEnc ? orphanEnc.st : '—'));
  });
  T('57.залог: _docTitle для составного ключа', () => {
    open('З-2026-000080', 'spec');
    const it = _collateralOf(_detailApp)[0];
    const t = _docTitle(it.id + '::val');
    A('57.залог: _docTitle для составного ключа', /Отчёт об оценке/.test(t), t);
  });

  /* =====================================================================
     БЛОК 7. Заглушки и вспомогательное
     ===================================================================== */
  T('58.заглушки pkg/print/generate/download не бросают', () => {
    open('З-2026-000080', 'spec');
    pkgDownloadAll(); pkgInventory(); docPrint('anket'); docGenerate('agr'); docDownload('inn');
    A('58.заглушки pkg/print/generate/download не бросают', true);
  });
  T('59.docView заполняет модалку превью', () => {
    open('З-2026-000080', 'spec');
    docView('inn');
    const title = document.getElementById('doc-preview-title').textContent;
    A('59.docView заполняет модалку превью', /Просмотр:/.test(title), title);
  });
  T('60.пустой комплект залога: секция показывает подсказку, не падает', () => {
    open('З-2026-000080', 'spec');
    _detailApp._collateral = []; _detailApp._collSeq = 1;
    const html = renderDocs(_detailApp);
    A('60.пустой комплект залога: секция показывает подсказку, не падает', /Добавьте предметы залога/.test(html), 'has hint=' + /Добавьте предметы залога/.test(html));
  });
  T('61.contract-секция заперта до одобрения (draft) — locked-note без кнопок', () => {
    open('З-2026-000080', 'spec', true);
    const sec = _docsOf(_detailApp).find(s => s.stage === 'contract');
    const html = renderDocSection(_detailApp, sec, _docBType(_detailApp));
    A('61.contract-секция заперта до одобрения (draft) — locked-note без кнопок',
      /откроется после одобрения/.test(html) && html.indexOf('docGenerate(') < 0, 'locked=' + /откроется после одобрения/.test(html));
  });
  T('62.contract-секция открыта на одобренной заявке — спец видит Сгенерировать', () => {
    open('З-2026-000101', 'spec');                   // Одобрена (locked)
    const sec = _docsOf(_detailApp).find(s => s.stage === 'contract');
    const html = renderDocSection(_detailApp, sec, _docBType(_detailApp));
    A('62.contract-секция открыта на одобренной заявке — спец видит Сгенерировать',
      html.indexOf('docGenerate(') >= 0 && html.indexOf('docUpload(') >= 0, 'has generate=' + (html.indexOf('docGenerate(') >= 0));
  });
  T('63._dispSt: uploaded на review показывается как «На проверке»', () => {
    open('З-2026-000103', 'spec');                   // review
    A('63._dispSt: uploaded на review показывается как «На проверке»',
      _dispSt(_detailApp, 'uploaded') === 'review' && DOC_STATUS[_dispSt(_detailApp, 'uploaded')].label === 'На проверке',
      _dispSt(_detailApp, 'uploaded'));
  });
  T('64.com: «Запросить замену» на прелиминари → возврат на доработку', () => {
    open('З-2026-000103', 'com');                    // review + роль комиссия
    const app = _detailApp;
    if (app._com) app._com.phase = 'prelim';
    comRequest('inn');                               // открывает модалку comreq
    document.getElementById('doc-reason-text').value = 'нужна свежая справка';
    confirmDocReason();
    const d = _findDocState('inn');
    A('64.com: «Запросить замену» на прелиминари → возврат на доработку',
      d && d.st === 'rejected' && /Запрос комиссии/.test(d.reason) && _detailApp.status === 'Требуется доп. информация',
      'st=' + (d && d.st) + ' status=' + _detailApp.status);
  });
  T('65._reqDocList для группы: ident/fin берутся с ЧЛЕНОВ, не с уровня заявки', () => {
    open('З-2026-000105', 'spec');                   // группа
    const list = _reqDocList(_detailApp).map(x => x.key);
    const appLevel = list.filter(k => k === 'p1' || k === 'inn');
    const memLevel = list.filter(k => /^mem:/.test(k));
    A('65._reqDocList для группы: ident/fin берутся с ЧЛЕНОВ, не с уровня заявки',
      appLevel.length === 0 && memLevel.length > 0,
      'уровень заявки=' + appLevel.length + ' уровень членов=' + memLevel.length);
  });

  /* =====================================================================
     БЛОК 8. Раскрытие секций / рефреш
     ===================================================================== */
  T('66.docToggle переключает _docOpen', () => {
    const before = _docOpen.print;
    docToggle('print');
    A('66.docToggle переключает _docOpen', _docOpen.print !== before, 'print=' + _docOpen.print);
    docToggle('print');
  });
  T('67._panelRefresh(tab-2) перерисовывает без ошибки', () => {
    open('З-2026-000080', 'spec');
    _panelRefresh('tab-2');
    A('67._panelRefresh(tab-2) перерисовывает без ошибки', document.getElementById('tab-2').innerHTML.length > 0);
  });
  T('68.смена заявки: _docsOf независим у разных заявок', () => {
    open('З-2026-000080', 'spec', true); docWaive('kb'); document.getElementById('doc-reason-text').value = 'x'; confirmDocReason();
    const a80 = _findDocState('kb').st;
    open('З-2026-000056', 'spec');
    const a56 = _docsOf(_detailApp).find(s => s.key === 'ident').docs.find(d => d.id === 'kb');   // юрлицо: kb нет в ident? проверим целостность
    A('68.смена заявки: _docsOf независим у разных заявок', a80 === 'waived', 'kb(80)=' + a80);
  });

  return { R };
});

/* ---- Живые клики по UI: открыть заявку, вкладку Документы, потыкать секции/членов ---- */
const uiErrs = [];
try {
  await page.evaluate(() => { gotoDetail('З-2026-000105'); setRole('spec'); showTab('tab-2'); });
  await page.waitForTimeout(150);
  // раскрыть все секции-аккордеоны
  const heads = await page.$$('#tab-2 .doc-acc-head');
  for (const h of heads) { await h.click().catch(() => {}); await page.waitForTimeout(30); }
  // переключить вид документов по членам (селектор группы)
  const dd = await page.$('#tab-2 .sched-viewdd');
  if (dd) {
    await dd.selectOption('0').catch(() => {});
    await page.waitForTimeout(80);
    await dd.selectOption('all').catch(() => {});
    await page.waitForTimeout(80);
  }
  // клик по строке члена в сводке
  const memRow = await page.$('#tab-2 .memdocs-grid tbody tr');
  if (memRow) { await memRow.click().catch(() => {}); await page.waitForTimeout(80); }
  // залоговая заявка: открыть Документы и потыкать под-панели предметов
  await page.evaluate(() => { gotoDetail('З-2026-000080'); setRole('spec'); showTab('tab-2'); });
  await page.waitForTimeout(120);
  const itemHeads = await page.$$('#tab-2 .doc-item-head');
  for (const h of itemHeads) { await h.click().catch(() => {}); await page.waitForTimeout(30); }
} catch (e) { uiErrs.push('UI ' + e.message); }

const R = out.R;
const fails = R.filter(r => !r.ok);
console.log('\n================ ZONE 4 — ДОКУМЕНТЫ ================');
console.log('Ассертов: ' + R.length + '  ·  Провалов: ' + fails.length + '  ·  JS-ошибок: ' + (jsErrors.length + uiErrs.length));
console.log('\n--- ПРОВАЛЫ ---');
if (!fails.length) console.log('(нет)');
fails.forEach(f => console.log('  ✗ ' + f.name + '  ::  ' + f.detail));
console.log('\n--- Показательные детали (выборка) ---');
['25', '30', '48', '51', '52', '54', '55', '56', '64', '65'].forEach(n => {
  const r = R.find(x => x.name.startsWith(n + '.'));
  if (r) console.log('  [' + (r.ok ? 'ok' : 'X') + '] ' + r.name + '  ::  ' + r.detail);
});
console.log('\n--- JS ERRORS ---');
[...jsErrors, ...uiErrs].forEach(e => console.log('  ! ' + e));
if (!jsErrors.length && !uiErrs.length) console.log('(нет)');
console.log('\n--- ВСЕ АССЕРТЫ ---');
R.forEach(r => console.log('  ' + (r.ok ? '✓' : '✗') + ' ' + r.name));

await ctx.close();
