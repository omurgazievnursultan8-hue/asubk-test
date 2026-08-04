import { load, multiCredit, test, ok, no, eq, has, hasNot, report } from './harness.mjs';

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

report();
