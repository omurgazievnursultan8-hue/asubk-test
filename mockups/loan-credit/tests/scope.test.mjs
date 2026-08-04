import { load, multiCredit, sameMethodCredit, test, ok, no, eq, has, hasNot, report } from './harness.mjs';

test('S0: файл грузится, шов CR доступен, сид отработал', () => {
  const { CR } = load();
  ok(typeof CR.renderTab === 'function', 'CR.renderTab не в шве');
  ok(CR.db.credits.length === 59, 'ожидалось 59 демо-кредитов, стало ' + CR.db.credits.length);
});

test('S1: фикстура K-C40 даёт два графика и расхождение метода', () => {
  const { CR } = load();
  const c = multiCredit(CR);
  eq(c.tranches.length, 2, 'K-C40 должен быть двухтраншевым');
  eq(c.tranches.filter(t => (t.schedules||[]).some(s => s.active)).length, 2,
     'оба транша должны получить активную версию графика');
  const methods = c.tranches.map(t => CR.conditionsAt(t, CR.TODAY).method);
  ok(methods[0] !== methods[1], 'методы траншей должны расходиться, стало: ' + methods.join(' | '));
});

test('T2-1: сеттер один — setCardScope; трёх прежних нет', () => {
  const { CR } = load();
  ok(typeof CR.setCardScope === 'function', 'CR.setCardScope отсутствует');
  eq(typeof CR.selectDetailTranche, 'undefined', 'CR.selectDetailTranche должен быть удалён');
  eq(typeof CR.setCondScope, 'undefined', 'CR.setCondScope должен быть удалён');
  eq(typeof CR.setCalcMode, 'undefined', 'CR.setCalcMode должен быть удалён');
});

test('T2-2: область общая — выбор транша виден на всех пяти вкладках', () => {
  const { CR } = load();
  const c = multiCredit(CR);
  CR.openDetail('K-C40');
  CR.setCardScope(2);
  has(CR.renderTab('График', c),  'транш №2', '«График» не увидел область');
  has(CR.renderTab('Прогноз', c), 'транш №2', '«Прогноз» не увидел область');
  has(CR.renderTab('Расчёты', c), 'транш №2', '«Расчёты» не увидели область');
});

test('T2-3: «Расчёты» — область «по кредиту» даёт консолидированный вид без чекбокса', () => {
  const { CR } = load();
  const c = multiCredit(CR);
  CR.openDetail('K-C40');
  CR.setCardScope('credit');
  const h = CR.renderTab('Расчёты', c);
  has(h, 'консолидировано', 'заголовок расчёта должен сказать «консолидировано»');
  hasNot(h, 'retro-toggle', 'чекбокс «консолидировано по кредиту» должен исчезнуть');
});

test('T2-4: «Условия» — агрегат и расхождения только при области «по кредиту»', () => {
  const { CR } = load();
  const c = multiCredit(CR);
  CR.openDetail('K-C40');
  CR.setCardScope('credit');
  has(CR.renderTab('Условия', c), 'Расхождения по траншам', 'при агрегате блок расхождений обязан быть');
  CR.setCardScope(2);
  hasNot(CR.renderTab('Условия', c), 'Расхождения по траншам', 'на транше блок расхождений не показывается');
});

test('T2-5: кредит с одним траншем — область всегда разрешается в транш №1', () => {
  const { CR } = load();
  const c = CR.db.credits.find(x => x.id === 'K-3');
  eq(c.tranches.length, 1, 'фикстура K-3 должна быть однотраншевой');
  CR.openDetail('K-3');
  CR.setCardScope('credit');
  has(CR.renderTab('График', c), 'транш №1', 'при одном транше «по кредиту» обязано дать транш №1');
});

test('T2-6: сброс при открытии карточки — область возвращается в «по кредиту»', () => {
  const { CR } = load();
  const c = multiCredit(CR);
  CR.openDetail('K-C40');
  CR.setCardScope(2);
  CR.backToList();
  CR.openDetail('K-C40');
  has(CR.renderTab('Расчёты', c), 'консолидировано', 'при повторном входе область должна быть «по кредиту»');
});

test('T3-1: «График» при «по кредиту» — слитая таблица с колонкой «Транш»', () => {
  const { CR } = load();
  const c = multiCredit(CR);
  CR.openDetail('K-C40');
  CR.setCardScope('credit');
  const h = CR.renderTab('График', c);
  has(h, '>Транш<', 'в шапке таблицы позиций должна появиться колонка «Транш»');
  has(h, 'по кредиту', 'заголовки секций должны сказать «по кредиту», а не «транш №N»');
  hasNot(h, 'транш №1)', 'заголовок не должен называть один транш');
});

test('T3-2: слитая таблица содержит позиции ОБОИХ траншей', () => {
  const { CR } = load();
  const c = multiCredit(CR);
  CR.openDetail('K-C40');
  const rowsAt = scope => { CR.setCardScope(scope); return (CR.renderTab('График', c).match(/<tr/g) || []).length; };
  const n1 = rowsAt(1), n2 = rowsAt(2), nAll = rowsAt('credit');
  ok(nAll > n1 && nAll > n2, `слитая (${nAll}) должна быть длиннее каждой отдельной (${n1}/${n2})`);
});

test('T3-3: плитки — суммы по траншам', () => {
  const { CR } = load();
  const c = multiCredit(CR);
  CR.openDetail('K-C40');
  const t1 = CR.trancheScheduleRows(c.tranches[0]).length;
  const t2 = CR.trancheScheduleRows(c.tranches[1]).length;
  CR.setCardScope('credit');
  has(CR.renderTab('График', c), '>' + (t1 + t2) + '<', `плитка «Платежей в графике» должна показать ${t1+t2}`);
});

test('T3-4: расхождение методов — плитка платежа гасится подписью', () => {
  const { CR } = load();
  const c = multiCredit(CR);
  CR.openDetail('K-C40');
  CR.setCardScope('credit');
  has(CR.renderTab('График', c), 'несколько методов погашения',
      'при разных методах траншей плитка платежа обязана это сказать');
});

test('T3-5: «Сформировать график» при «по кредиту» неактивна', () => {
  const { CR } = load();
  const c = multiCredit(CR);
  CR.openDetail('K-C40');
  CR.setCardScope('credit');
  has(CR.renderTab('График', c), 'График принадлежит траншу — выберите транш в шапке',
      'кнопка построения должна быть погашена с этой причиной');
  CR.setCardScope(1);
  hasNot(CR.renderTab('График', c), 'График принадлежит траншу — выберите транш в шапке',
      'на конкретном транше кнопка обязана ожить');
});

test('T3-6: однотраншевый кредит слитого вида не получает', () => {
  const { CR } = load();
  const c = CR.db.credits.find(x => x.id === 'K-3');
  CR.openDetail('K-3');
  CR.setCardScope('credit');
  const h = CR.renderTab('График', c);
  has(h, 'транш №1', 'при одном транше вкладка обязана остаться обычной');
  hasNot(h, 'несколько методов погашения', 'расхождению не с чем возникать');
});

test('T3-7: несколько траншей, метод общий — платёж не суммируется', () => {
  const { CR } = load();
  const c = sameMethodCredit(CR);
  CR.openDetail('K-1');
  CR.setCardScope('credit');
  const h = CR.renderTab('График', c);
  has(h, 'у каждого транша свой платёж',
      'при общем методе плитка платежа обязана сказать, что платёж не общий');
  hasNot(h, 'несколько методов погашения',
      'методы совпадают — расхождению взяться неоткуда');
});

test('T4-1: «Прогноз» при «по кредиту» — слитая таблица с колонкой «Транш»', () => {
  const { CR } = load();
  const c = multiCredit(CR);
  CR.openDetail('K-C40');
  CR.setCardScope('credit');
  const h = CR.renderTab('Прогноз', c);
  has(h, '>Транш<', 'в шапке таблицы прогноза должна появиться колонка «Транш»');
  has(h, 'Прогноз — позиции (по кредиту)', 'заголовок должен назвать область');
});

test('T4-2: плитки прогноза складываются по траншам', () => {
  const { CR } = load();
  const c = multiCredit(CR);
  const idx = CR.derive(c, CR.TODAY).ledger.index;
  const cnt = t => CR.trancheForecastRows(t, idx, CR.TODAY).filter(r => !r.past).length;
  const all = cnt(c.tranches[0]) + cnt(c.tranches[1]);
  CR.openDetail('K-C40');
  CR.setCardScope('credit');
  has(CR.renderTab('Прогноз', c), all + ' позиц.', `плитка «Ждём впереди» должна насчитать ${all} позиций`);
});

test('T4-3: на конкретном транше «Прогноз» колонки «Транш» не показывает', () => {
  const { CR } = load();
  const c = multiCredit(CR);
  CR.openDetail('K-C40');
  CR.setCardScope(2);
  const h = CR.renderTab('Прогноз', c);
  hasNot(h, '>Транш<', 'на одном транше колонка «Транш» избыточна');
  has(h, 'Прогноз — позиции (транш №2)', 'заголовок должен назвать транш');
});

test('T5-1: контрол области — в шапке, внутри вкладок его нет', () => {
  const { CR, win } = load();
  const c = multiCredit(CR);
  CR.openDetail('K-C40');
  CR.openTab('График');
  const head = win.document.querySelector('.phead-acts').innerHTML;
  has(head, 'CR.setCardScope', 'переключатель обязан быть в шапке');
  has(head, 'Область', 'у переключателя должна быть подпись «Область»');
  for (const tab of ['Условия','График','Прогноз','Расчёты'])
    hasNot(CR.renderTab(tab, c), 'CR.setCardScope', `на вкладке «${tab}» свой селект должен исчезнуть`);
});

test('T5-2: область читается раньше даты среза', () => {
  const { CR, win } = load();
  multiCredit(CR);
  CR.openDetail('K-C40');
  const head = win.document.querySelector('.phead-acts').innerHTML;
  ok(head.indexOf('CR.setCardScope') < head.indexOf('По состоянию на'),
     '«Область» должна стоять перед «По состоянию на»');
});

test('T5-3: на инертных вкладках контрол погашен с подсказкой', () => {
  const { CR, win } = load();
  multiCredit(CR);
  CR.openDetail('K-C40');
  CR.openTab('Договор');
  const head = win.document.querySelector('.phead-acts').innerHTML;
  has(head, 'disabled', 'на вкладке «Договор» контрол обязан быть неактивен');
  has(head, 'Вкладка «Договор» — всегда по кредиту целиком', 'подсказка обязана назвать вкладку');
  CR.openTab('Расчёты');
  hasNot(win.document.querySelector('.phead-acts').innerHTML, 'disabled',
         'на вкладке «Расчёты» контрол обязан ожить');
});

test('T5-4: у кредита с одним траншем контрола нет вовсе', () => {
  const { CR, win } = load();
  CR.openDetail('K-3');
  hasNot(win.document.querySelector('.phead-acts').innerHTML, 'CR.setCardScope',
         'при одном транше выбирать нечего — контрол не рендерится');
});

test('T5-5: при выбранном транше под плитками стоит подпись про шапку', () => {
  const { CR, win } = load();
  multiCredit(CR);
  CR.openDetail('K-C40');
  CR.setCardScope(2);
  // Scoped to #cr-card-body (renderDetail's mount point), not document.body: the
  // inline <script> is itself a body child, and jsdom (like any DOM) serializes a
  // <script>'s raw source text into body.innerHTML — the caption string sits in that
  // source once no matter the scope, so hasNot() against body.innerHTML could never
  // pass. #cr-card-body holds only the rendered card, not the script tag.
  const card = () => win.document.getElementById('cr-card-body').innerHTML;
  has(card(), 'Плитки — по кредиту целиком',
      'подпись, снимающая ложное обещание плиток, обязана появиться');
  CR.setCardScope('credit');
  hasNot(card(), 'Плитки — по кредиту целиком',
         'при области «по кредиту» подпись избыточна');
});

test('T5-6: закрытый транш в списке помечен', () => {
  const { CR, win } = load();
  CR.openDetail('K-C41');       // транш №2 закрыт (Г-17)
  const head = win.document.querySelector('.phead-acts').innerHTML;
  has(head, 'Транш №2 · закрыт', 'закрытый транш обязан быть виден и помечен');
});

test('T6-1: модалка освоения предвыбрана областью', () => {
  const { CR, win } = load();
  multiCredit(CR);
  CR.openDetail('K-C40');
  CR.setCardScope(2);
  CR.openDisbModal();
  const sel = win.document.getElementById('disbTranche');
  ok(sel, 'селект транша в модалке освоения обязан существовать');
  eq(sel.value, '2', 'предвыбор должен прийти из области карточки');
});

// Брифовский вариант (multiCredit() → область=2 → цель освоения=1) не может пройти ни
// при какой реализации: транш №1 у K-C40 освоен ПОЛНОСТЬЮ уже в сиде (300000 из 300000,
// см. seedDb/mkScen, disb:'partial' у этого сценария означает «первый транш — целиком,
// второй — нисколько», а не частичное освоение внутри транша), а multiCredit() сверху
// добивает и транш №2 до 100% — цели для довнесения не остаётся ни на одном из двух
// (проверено эмпирически через CR.addDisbursement: гейт «Σ освоений транша не может
// превышать сумму транша» срабатывает на обоих траншах после multiCredit()). Тест
// зеркалим: цель — транш №2 (в сырых данных сеида свободен на все 200000, multiCredit()
// не зовём, чтобы не занять его), старт области — транш №1. Проверяемое поведение то
// же самое — выбор ДРУГОГО транша в модалке освоения после подтверждения передвигает
// область карточки на него.
test('T6-2: выбор другого транша в модалке двигает область карточки', () => {
  const { CR, win } = load();
  const c = CR.db.credits.find(x => x.id === 'K-C40');
  CR.openDetail('K-C40');
  CR.setCardScope(1);
  CR.openDisbModal();
  win.document.getElementById('disbTranche').value = '2';
  win.document.getElementById('disbAmount').value = '1000';
  CR.submitDisb();
  has(CR.renderTab('Расчёты', c), 'транш №2', 'после освоения область обязана встать на транш действия');
});

test('T6-3: смена области не сбрасывает дату среза и наоборот', () => {
  const { CR, win } = load();
  multiCredit(CR);
  CR.openDetail('K-C40');
  CR.setCardAsOf('01.06.2026');
  CR.setCardScope(2);
  has(win.document.body.innerHTML, '01.06.2026', 'дата среза обязана пережить смену области');
  CR.setCardAsOf('01.07.2026');
  has(win.document.querySelector('.phead-acts').innerHTML, 'value="2" selected',
      'область обязана пережить смену даты');
});

// T6-4: не из брифа — брифовский план ошибочно считал submitPayment уже симметричным
// submitDisb/submitSched (см. дефект в отчёте задачи 6); контроллер поручил исправить
// здесь же. Форма та же, что у T6-2, но через платёжную модалку: роль по умолчанию
// («Кредитный специалист») права savePayment не имеет — только «Бухгалтер» и
// «Начальник отдела», поэтому роль переключаем перед открытием модалки.
test('T6-4: выбор другого транша в модалке платежа двигает область карточки', () => {
  const { CR, win } = load();
  win.document.getElementById('roleSel').value = 'Бухгалтер';
  CR.onRoleChange();
  const c = multiCredit(CR);
  CR.openDetail('K-C40');
  CR.setCardScope(2);
  CR.openPaymentModal();
  win.document.getElementById('payTranche').value = '1';
  win.document.getElementById('payAmount').value = '1000';
  win.document.getElementById('payDate').value = CR.TODAY.split('.').reverse().join('-');
  CR.submitPayment();
  has(CR.renderTab('Расчёты', c), 'транш №1', 'после платежа область обязана встать на транш действия');
});

report();
