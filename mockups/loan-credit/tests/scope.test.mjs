import { load, multiCredit, sameMethodCredit, test, ok, no, eq, has, hasNot, report } from './harness.mjs';

test('S0: файл грузится, шов CR доступен, сид отработал', () => {
  const { CR } = load();
  ok(typeof CR.renderTab === 'function', 'CR.renderTab не в шве');
  // КВ-26: +К-7 — демо разделения транша по ДС (два применённых ДС, три транша)
  ok(CR.db.credits.length === 60, 'ожидалось 60 демо-кредитов, стало ' + CR.db.credits.length);
});

test('S1: фикстура K-C40 даёт два графика и расхождение метода', () => {
  const { CR } = load();
  const c = multiCredit(CR);
  eq(c.tranches.length, 2, 'K-C40 должен быть двухтраншевым');
  // КВ-26: флага active нет — действующая версия выводится по срезу (scheduleAt)
  eq(c.tranches.filter(t => !!CR.scheduleAt(t, CR.TODAY)).length, 2,
     'оба транша должны получить действующую версию графика');
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
  // Слово «консолидировано» было вторым именем той же области (правка 5 финальной волны):
  // шапка говорит «По кредиту», «График»/«Прогноз» — «по кредиту». Проверяем ровно тот же
  // факт, что и прежде (заголовок детального расчёта назвал область, а не транш), но
  // словами шапки — и строже: целым заголовком, а не одним словом из него.
  has(h, 'Детальный расчёт (по кредиту)', 'заголовок расчёта должен назвать область словами шапки');
  hasNot(h, 'консолидировано', 'второго имени области в макете больше нет');
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
  // тот же признак «область = по кредиту», что и в T2-3, новыми словами (правка 5)
  has(CR.renderTab('Расчёты', c), 'Детальный расчёт (по кредиту)', 'при повторном входе область должна быть «по кредиту»');
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
  has(h, 'Расхождения с графиком (по кредиту)', 'заголовок должен назвать область');
  // КВ-34: витрина свёрнута — сетки плиток и плашек на вкладке больше нет
  hasNot(h, 'phead-dims', 'плитки прогноза сняты волной КВ-34 — их место в строке-контексте');
  hasNot(h, 'info-plate', 'плашки состояния свёрнуты во вторую строку контекста');
});

test('T4-2: счётчик расхождений в заголовке считает по всем траншам области', () => {
  const { CR } = load();
  const c = multiCredit(CR);
  const idx = CR.derive(c, CR.TODAY).ledger.index;
  const sm = CR.forecastSummary(c, c.tranches, idx, CR.TODAY);
  const diff = sm.rows.filter(r => Math.abs(r.delta) > 0.005).length;
  CR.openDetail('K-C40');
  CR.setCardScope('credit');
  const h = CR.renderTab('Прогноз', c);
  has(h, `расходится ${diff} из ${sm.rows.length}`,
      `счётчик обязан сложить позиции обоих траншей: ${diff} из ${sm.rows.length}`);
  // счётчик — в заголовке секции, отдельной полосы под ним нет (КВ-34)
  hasNot(h, 'gtoolbar', 'тулбар прогноза снят: кнопка уехала в заголовок секции');
  has(h, 'CR.setPrognozAll(true)', 'кнопка раскрытия обязана остаться — она в заголовке');
  // формулировка счётчика одна на оба состояния: кнопка меняет видимое, а не посчитанное
  CR.setPrognozAll(true);
  has(CR.renderTab('Прогноз', c), `расходится ${diff} из ${sm.rows.length}`,
      'при раскрытии всех позиций счётчик не меняется');
});

test('T4-3: на конкретном транше «Прогноз» колонки «Транш» не показывает', () => {
  const { CR } = load();
  const c = multiCredit(CR);
  CR.openDetail('K-C40');
  CR.setCardScope(2);
  const h = CR.renderTab('Прогноз', c);
  hasNot(h, '>Транш<', 'на одном транше колонка «Транш» избыточна');
  has(h, 'Расхождения с графиком (транш №2)', 'заголовок должен назвать транш');
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
  // openTab добавлен правкой 7 финальной волны: карточка открывается на «Договоре», а
  // подпись теперь рендерится только на вкладках, ЧИТАЮЩИХ область (на инертных она
  // спорила с подсказкой погашенного контрола). Утверждения теста не менялись — только
  // приведено состояние, в котором подпись вообще уместна; обратный случай проверяет F7.
  CR.openTab('Состав');
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

/* ============================================================================
   ФИНАЛЬНАЯ ПРАВКА ВОЛНЫ КВ-17 (04.08.2026) — F1…F7 по номерам находок ревью.
   ============================================================================ */

/* F1 — «Прогноз»: недобор прошлого принадлежит ОБЛАСТИ, а не первой строке таблицы.
   Прежняя проба F1-1 сторожила раскладку хвоста в первую будущую позицию транша —
   поведение снято ADR-0104/0105 (недобор остаётся на своих датах и вперёд не переносится),
   и инвариант теперь держат смоуки #101/#104 credit-check.mjs. Осталась одна проба:
   строка-контекст (КВ-34) называет недобор той области, которая выбрана в шапке. */
test('F1-2: строка-контекст называет недобор СВОЕЙ области', () => {
  const { CR } = load();
  const c = multiCredit(CR);
  CR.openDetail('K-C40');
  const idx = CR.derive(c, CR.TODAY).ledger.index;
  const tailOf = ts => CR.forecastSummary(c, ts, idx, CR.TODAY).tail;
  const whole = tailOf(c.tranches);
  const own   = tailOf([c.tranches[1]]);
  ok(Math.abs(whole - own) > 0.005,
     'фикстура бесполезна: кредитный недобор совпал с траншевым — правку не отличить');
  CR.setCardScope('credit');
  const h = CR.renderTab('Прогноз', c);
  has(h, 'недобор <b title=', 'недобор обязан нести тултип с правилом ADR-0105/0074 §2');
  has(h, CR.money(whole) + '</b>', 'при «по кредиту» назван кредитный недобор');
  hasNot(h, CR.money(own) + '</b>', 'траншевый недобор при области «по кредиту» — ложь');
  CR.setCardScope(2);
  const h2 = CR.renderTab('Прогноз', c);
  has(h2, CR.money(own) + '</b>', 'на транше №2 назван его собственный недобор');
  hasNot(h2, CR.money(whole) + '</b>', 'кредитный недобор на транше — чужая сумма');
});

/* F2 — «Состав» в собственном состоянии по умолчанию (область = «по кредиту»). */
/* КВ-33 переименовала блок освоений в «Движение по кредиту» / «Движение по траншу №N»
   (грид движения, а не одних освоений) — проба перенацелена на новый заголовок. */
test('F2-1: «Состав» при «по кредиту» — движение слито, с колонкой «Транш»', () => {
  const { CR } = load();
  const c = multiCredit(CR);
  CR.openDetail('K-C40');
  CR.setCardScope('credit');
  const h = CR.renderTab('Состав', c);
  hasNot(h, 'Движение по траншу №—', 'транша №— не бывает — это дыра в состоянии по умолчанию');
  has(h, 'Движение по кредиту', 'заголовок блока обязан назвать область');
  const blk = h.slice(h.indexOf('Движение по кредиту'));   // только грид движения, без таблицы траншей
  has(blk, '>Транш<', 'слитый грид обязан развести строки колонкой «Транш»');
  hasNot(blk, 'Движений нет', 'освоения есть у обоих траншей — грид не может быть пуст');
  has(blk, '15.02.2026', 'освоение транша №1 обязано попасть в слитый вид');
  has(blk, '01.03.2026', 'освоение транша №2 обязано попасть в слитый вид');
  ok(blk.indexOf('15.02.2026') < blk.indexOf('01.03.2026'), 'слитый грид сортируется по дате');
  CR.setCardScope(2);
  const h2 = CR.renderTab('Состав', c);
  has(h2, 'Движение по траншу №2', 'на транше заголовок называет транш');
  const blk2 = h2.slice(h2.indexOf('Движение по траншу №2'));
  hasNot(blk2, '15.02.2026', 'на транше №2 освоение транша №1 не показывается');
  hasNot(blk2, '>Транш<', 'на одном транше колонка «Транш» избыточна');
});

/* КВ-33 увела «Закрыть транш» из тулбара иконкой В СТРОКУ: имя транша берётся из строки,
   а не из области в шапке, поэтому гасить кнопку при «по кредиту» больше нечего — проба
   сторожит именно это (действие живёт у своего предмета, правило КВ-25/КВ-32). */
test('F2-2: «Закрыть транш» — иконка в строке, живая при любой области', () => {
  const { CR } = load();
  const c = multiCredit(CR);
  CR.openDetail('K-C40');
  CR.setCardScope('credit');
  const h = CR.renderTab('Состав', c);
  hasNot(h, 'Закрыть транш №—', 'кнопка не может называть транш №—');
  hasNot(h, 'Закрытие — действие по траншу; выберите транш в шапке',
      'отказа больше нет: имя транша даёт строка, а не область в шапке');
  hasNot(h, 'CR.openCloseTrancheModal()', 'безымянного вызова не осталось — транш всегда назван');
  has(h, 'CR.openCloseTrancheModal(1)', 'у строки транша №1 своя иконка закрытия');
  has(h, 'CR.openCloseTrancheModal(2)', 'у строки транша №2 своя иконка закрытия');
  has(h, 'Закрыть транш №2', 'тултип иконки называет транш строки');
  CR.setCardScope(2);
  const h2 = CR.renderTab('Состав', c);
  has(h2, 'CR.openCloseTrancheModal(1)', 'реестр траншей области не сужается — строки все');
  has(h2, 'CR.openCloseTrancheModal(2)', 'иконка транша №2 на месте и при выборе транша');
});

/* F2-3 — обратная сторона F2-2, и разводит их ЯРЛЫК. «Закрыть транш №N» называет транш,
   которого при области «по кредиту» у неё нет, — гасим. «Внести освоение» не называет
   никакого: транш спрашивает модалка своим селектом, предвыбранным по спеке КВ-17
   («Решение» 1: предвыбор из scopeTranche(c), при null — ПЕРВЫЙ АКТИВНЫЙ транш).
   Значит кнопка обязана быть живой ровно в том состоянии, в котором карточка
   открывается, иначе главное действие вкладки мертво при входе. */
test('F2-3: «Внести освоение» при «по кредиту» — живая, модалка спрашивает транш', () => {
  const { CR, win } = load();
  const c = multiCredit(CR);
  CR.openDetail('K-C40');
  CR.setCardScope('credit');
  has(CR.renderTab('Состав', c), 'CR.openDisbModal()',
      'в состоянии по умолчанию главное действие вкладки обязано быть живым');
  hasNot(CR.renderTab('Состав', c), 'Освоение — действие по траншу',
      'ярлык транша не называет — гасить нечего');
  CR.openDisbModal();
  const s = win.document.getElementById('disbTranche');
  ok(s, 'модалка обязана спросить транш своим селектом');
  ok(['1','2'].includes(s.value), 'предвыбор обязан указать на транш, стало: ' + s.value);
});

test('F2-4: при «по кредиту» освоение адресуется ПЕРВОМУ АКТИВНОМУ траншу', () => {
  const { CR, win } = load();
  const c = multiCredit(CR);
  eq(CR.closeTranche(c, { trancheNo: 1, date: '01.07.2026', reason: 'проверка предвыбора' }).ok,
     true, 'транш №1 обязан закрыться — иначе проверять нечего');
  CR.openDetail('K-C40');
  CR.setCardScope('credit');
  // гейт больше не мерится траншем №1: по нему освоение запрещено (Г-17), и кнопка,
  // мерившая его, погасла бы с причиной «Транш закрыт» — при живом транше №2
  hasNot(CR.renderTab('Состав', c), 'Транш закрыт',
      'гейт обязан читать первый АКТИВНЫЙ транш, а не первый по списку');
  has(CR.renderTab('Состав', c), 'CR.openDisbModal()', 'кнопка обязана остаться живой');
  CR.openDisbModal();
  eq(win.document.getElementById('disbTranche').value, '2',
     'предвыбор модалки обязан совпасть с траншем, по которому мерился гейт');
});

/* F3 — «по кредиту» = ВСЕ транши кредита, закрытые включительно. */
test('F3-1: закрытый транш — «График» и «Расчёты» согласны, что такое «по кредиту»', () => {
  const { CR } = load();
  const c = multiCredit(CR);
  eq(CR.closeTranche(c, { trancheNo: 2, date: '01.07.2026', reason: 'проверка области' }).ok,
     true, 'транш №2 обязан закрыться — иначе проверять нечего');
  CR.openDetail('K-C40');
  CR.setCardScope('credit');
  // «График»: в таблице версий транш стоит отдельной ячейкой сразу после версии.
  // С КВ-27 таблица уехала за раскрытие — открываем его, иначе пробе нечего читать.
  CR.toggleGrafikVers();
  const versTr = s => [...new Set((s.match(/<td>v\d+<\/td><td>№(\d+)<\/td>/g) || [])
    .map(x => x.match(/№(\d+)/)[1]))].sort().join(',');
  // «Расчёты»: в леджере транш стоит отдельной ячейкой сразу после даты
  const ledTr = s => [...new Set((s.match(/--surface-card\)">\d{2}\.\d{2}\.\d{4}<\/td>\s*<td>№(\d+)<\/td>/g) || [])
    .map(x => x.match(/№(\d+)<\/td>$/)[1]))].sort().join(',');
  const g = versTr(CR.renderTab('График', c));
  const r = ledTr(CR.renderTab('Расчёты', c));
  eq(g, '1,2', '«График» обязан показать оба транша, закрытый включительно');
  eq(g, r, `«График» (${g}) и «Расчёты» (${r}) обязаны сойтись в том, что такое «по кредиту»`);
  const n = CR.trancheScheduleRows(c.tranches[0]).length + CR.trancheScheduleRows(c.tranches[1]).length;
  has(CR.renderTab('График', c), 'Платежей в графике</div><div class="dv">' + n + '<',
      `свод графика обязан насчитать ${n} позиций — по всем траншам`);
  // «Прогноз» — та же вкладка-близнец, тот же ответ
  has(CR.renderTab('Прогноз', c), '>Транш<', '«Прогноз» обязан остаться слитым');
});

/* F4 — «Условия»: два своих выбора транша обязаны стартовать от области карточки. */
test('F4-1: сводная матрица условий стартует от области карточки', () => {
  const { CR } = load();
  const c = multiCredit(CR);
  CR.openDetail('K-C40');
  CR.setCardScope(2);
  CR.toggleCondMatrix();
  const h = CR.renderTab('Условия', c);
  has(h, 'subtab active" onclick="CR.setCondMatrixTranche(2)"', 'активной обязана быть вкладка транша №2');
  hasNot(h, 'subtab active" onclick="CR.setCondMatrixTranche(1)"', 'транш №1 области не соответствует');
  CR.setCondMatrixTranche(1);          // навигация внутри вкладки — за пользователем
  has(CR.renderTab('Условия', c), 'subtab active" onclick="CR.setCondMatrixTranche(1)"',
      'явный выбор вкладки обязан пережить область');
});

test('F4-2: разворот журнала условий стартует от области карточки', () => {
  const { CR } = load();
  const c = multiCredit(CR);
  CR.openDetail('K-C40');
  CR.setCardScope(2);
  CR.toggleCondGroup('КОМ-C239@application');   // единственная группа K-C40, правящая ОБА транша
  const h = CR.renderTab('Условия', c);
  has(h, 'subtab active" onclick="CR.setCondTranche(2)"', 'активной обязана быть вкладка транша №2');
  hasNot(h, 'subtab active" onclick="CR.setCondTranche(1)"', 'транш №1 области не соответствует');
  CR.setCondTranche(1);
  has(CR.renderTab('Условия', c), 'subtab active" onclick="CR.setCondTranche(1)"',
      'явный выбор вкладки обязан пережить область');
});

/* F7 — подпись под плитками бессмысленна там, где область не читают. */
test('F7: подпись про плитки — только на вкладках, читающих область', () => {
  const { CR, win } = load();
  multiCredit(CR);
  CR.openDetail('K-C40');
  CR.setCardScope(2);
  const card = () => win.document.getElementById('cr-card-body').innerHTML;   // см. комментарий у T5-5
  CR.openTab('График');
  has(card(), 'Плитки — по кредиту целиком', 'на вкладке, читающей область, подпись обязана быть');
  CR.openTab('Договор');
  hasNot(card(), 'Плитки — по кредиту целиком',
         'на инертной вкладке подпись противоречит подсказке погашенного контрола');
});

report();
