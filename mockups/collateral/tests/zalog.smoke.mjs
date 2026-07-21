import { load, test, ok, eq, near, has, hasNot, report } from './harness.mjs';

test('S0: файл грузится, шов __zt доступен', () => {
  const { zt } = load();
  ok(zt, 'window.__zt отсутствует');
  ok(typeof zt.requiredCover === 'function', 'requiredCover не в шве');
});

// D1: COVER_MIN — единая псевдоконстанта покрытия — удаляется; требуемое обеспечение
// считается через requiredCover(creditId, cs), т.к. порог зависит от состава залога
// (П1 §2.3–2.4), а не является одним числом на все кредиты.
test('D1-1: COVER_MIN отсутствует как символ', () => {
  const { win } = load();
  // top-level const/let в классическом <script> НЕ становится свойством window,
  // поэтому проверяем сам биндинг верхнего уровня скрипта через win.eval, а не
  // typeof win.COVER_MIN (та проверка была бы 'undefined' и до фикса — не РЕД).
  eq(win.eval('typeof COVER_MIN'), 'undefined', 'COVER_MIN должен быть удалён как символ верхнего уровня');
});

// D2: хардкод «120%» в пользовательских строках заменяется на pct(req) — порог покрытия
// не всегда 120% (ликвид), для состава с движимым неликвидным предметом это 150%
// (requiredCover, П1 §2.3–2.4). Прогон полного цикла регистрации черновика с таким
// составом не должен нигде показать фиксированные «Гейт 120%».
test('D2-1: нет литерала «120%» в пользовательских строках при пороге 150%', () => {
  const { win, zt } = load();
  // Кредит К-Т1 обеспечен ДВУМЯ предметами: ликвидным (недвижимость) на 90% суммы
  // (Р-1 п.3 требует долю ликвида ≥80%, когда порог 150%) и движимым неликвидным
  // (оборудование) — присутствие последнего переводит requiredCover на 150% (П1 §2.3–2.4).
  zt.CREDITS.push({ id:'К-Т1', num:'Тестовый кредит Т1', inn:'22105198800047', amount:100000, status:'Действующий', overdue:false, otherSecurity:null });
  const liquidIt = win.normalizeItem({ id:'П-Т1', kind:'Недвижимое имущество', name:'Тестовое здание', pledger:'22105198800047',
    ident:'ТЕСТ-1', appraised:200000, apprDate:'01.07.2026', apprReport:'ОЦ-ТЕСТ1',
    override:null, ban:null, lost:false, realizing:false, needReval:false, everPledged:false,
    lastSurvey:'01.07.2026', lastReval:'01.07.2026', revals:[], surveys:[], history:[] });
  liquidIt.prereqs.encumbranceCert.present = true;
  const movableIt = win.normalizeItem({ id:'П-Т2', kind:'Оборудование', name:'Тестовый станок', pledger:'22105198800047',
    ident:'ТЕСТ-2', appraised:400000, apprDate:'01.07.2026', apprReport:'ОЦ-ТЕСТ2',
    override:null, ban:null, lost:false, realizing:false, needReval:false, everPledged:false,
    lastSurvey:'01.07.2026', lastReval:'01.07.2026', revals:[], surveys:[], history:[] });
  movableIt.prereqs.encumbranceCert.present = true;
  zt.ITEMS.push(liquidIt, movableIt);
  // 90 000 (ликвид, 90%>=80%) + 65 000 (движимое неликвидное) = 155 000 на 100 000 кредита = 155% >= 150%.
  zt.CONTRACTS.push({ id:'Д-Т1', no:'', date:'', status:'Оформляется', inn:'22105198800047',
    notary:'', notaryNo:'', notaryDate:'', cert:'',
    credits:['К-Т1'], allocs:[{item:'П-Т1', credit:'К-Т1', share:90000}, {item:'П-Т2', credit:'К-Т1', share:65000}],
    undercovered:null, addenda:[], history:[] });
  eq(zt.requiredCover('К-Т1', zt.CONTRACTS.filter(c=>c.id==='Д-Т1')).req, zt.COVER_MOVABLE, 'сценарий теста должен давать порог 150%');
  const gate = win.gateCheck(zt.contract('Д-Т1'));
  ok(gate.ok, 'сценарий теста должен проходить гейт покрытия (150% + доля ликвида >=80%)');
  win.openRegister('Д-Т1');
  win.document.getElementById('rgNo').value = 'ЗД-ТЕСТ/1';
  win.document.getElementById('rgNotary').value = 'Нотариус Тест';
  win.document.getElementById('rgNotaryNo').value = 'НР-ТЕСТ/1';
  win.document.getElementById('rgCert').value = 'ЗС-ТЕСТ/1';
  win.doRegister('Д-Т1');
  const html = win.document.body.innerHTML;
  // грубая проверка: хардкод-строки триггеров не содержат фиксированного «120%»
  hasNot(html, 'Гейт 120%', 'тост «Гейт 120% пройден» — хардкод');
});

// R13: requiredCover возвращает {req,source} вместо голого числа — порог всегда несёт
// свою нормативную ссылку (П1 §2.3/§2.4/§2.6), а не «магическое число» без пояснения.
test('R13-1: requiredCover возвращает {req,source}', () => {
  const { zt } = load();
  const r = zt.requiredCover('К-56', zt.CONTRACTS.filter(c=>c.status==='Зарегистрирован'));
  eq(typeof r.req, 'number'); ok(typeof r.source === 'string' && r.source.length>0);
});
test('R13-2: чисто ликвидный состав → 1.2 и источник П1 §2.3', () => {
  const { zt } = load();
  // К-56 (Д-001, «Зарегистрирован») обеспечен единственным предметом П-001 —
  // «Недвижимое имущество» (liquid:true, movable:false) — состав чисто ликвидный.
  const r = zt.requiredCover('К-56', zt.CONTRACTS.filter(c=>c.status==='Зарегистрирован'));
  near(r.req, 1.2, 'ликвидный порог'); has(r.source, 'П1 §2.3');
});

test('R13-3: coverage-строка движимого неликвида несёт источник П1 §2.4', () => {
  const { zt } = load();
  // Кредит К-40 (Д-004, «Зарегистрирован») обеспечен единственным предметом П-005 —
  // «Транспортное средство» (KINDS: movable:true, liquid:false) — состав чисто
  // движимый-неликвидный. requiredCover должна дать 150% / П1 §2.4, и эта же ссылка
  // обязана долетать до coverage-строки гейта (её .source используют строки-пороги
  // в UI, которые правит этот фикс), а не потеряться при пересборке coverage().
  const cs = zt.CONTRACTS.filter(c => c.status === 'Зарегистрирован');
  const row = zt.coverage(cs, 'К-40');
  near(row.req, zt.COVER_MOVABLE, 'движимый неликвидный порог — 150%');
  has(row.source, 'П1 §2.4');
});

// R13-4: правка COVER_LIQUID в справочнике (saveRefbook) доезжает до расчёта requiredCover —
// порог должен читаться из живой переменной верхнего уровня скрипта, а не из снапшота,
// захваченного при первом вызове. win.COVER_LIQUID = ... НЕ годится для имитации этого:
// top-level `let` в классическом <script> не становится свойством window (см. D1-1), так что
// такое присваивание создаёт мёртвое свойство окна, которое requiredCover никогда не читает.
// Настоящая мутация живого биндинга — через win.eval('COVER_LIQUID = 1.5') (косвенный eval
// в реализме окна видит и переприсваивает тот же лексический COVER_LIQUID, что читает
// requiredCover). Каждый test() вызывает load() заново (свежий jsdom) — эта мутация не
// протекает в другие тесты.
test('R13-4: правка COVER_LIQUID в справочнике доезжает до расчёта', () => {
  const { win, zt } = load();
  const cs = zt.CONTRACTS.filter(c=>c.status==='Зарегистрирован');
  const before = zt.requiredCover('К-56', cs).req;
  near(before, 1.2, 'до правки порог — дефолтный ликвидный 120%');
  win.eval('COVER_LIQUID = 1.5');
  const after = zt.requiredCover('К-56', cs).req;
  eq(after, 1.5, 'после правки справочника requiredCover должна прочитать новое значение живого COVER_LIQUID');
});

// D1: требуемое покрытие меняется при смене состава залога (не единая COVER_MIN на все
// кредиты, см. комментарий к D1-1) — проверяем ОБЕ границы на реальных фикстурах:
// К-56 (Д-001) обеспечен только ликвидным П-001 (Недвижимое имущество) → 120% / П1 §2.3;
// К-40 (Д-004) обеспечен только движимым неликвидным П-005 (Транспортное средство,
// KINDS: movable:true, liquid:false) → 150% / П1 §2.4 (те же фикстуры, что в R13-2/R13-3).
test('D1-4: требуемое покрытие меняется при смене состава — обе границы', () => {
  const { zt } = load();
  const regContracts = zt.CONTRACTS.filter(c => c.status === 'Зарегистрирован');
  const liq = zt.requiredCover('К-56', regContracts);
  near(liq.req, 1.2, 'чисто ликвидный состав — 120%');
  has(liq.source, 'П1 §2.3');
  const mov = zt.requiredCover('К-40', regContracts);
  near(mov.req, 1.5, 'движимый неликвидный состав — 150%');
  has(mov.source, 'П1 §2.4');
});

// Р-19 (ПОЛ §9.1): роль «Комиссия по залогу» и гварды canEdit/canCommission переименованы
// на нормативную матрицу ролей. Тест брифа (typeof win.canCurate/win.canCommission) был
// сломан: top-level const/let в классическом <script> не становятся свойствами window, так
// что win.canCurate === undefined ДО и ПОСЛЕ фикса (ложный REDpass), а
// eq(typeof win.canCommission,'undefined') проходит вакуумно (никогда не был window-полем).
// Проверяем по-настоящему: существование — через шов __zt (куда фикс обязан экспортировать
// все 4 гварда), удаление старого имени — через лексический биндинг верхнего уровня скрипта
// (win.eval видит и читает тот же скоуп, что видит сам скрипт — см. комментарий к R13-4).
test('R19-1: роль «Комиссия по залогу» отсутствует в файле (любой регистр/падеж «по залогу»)', () => {
  const { win } = load();
  const html = win.document.documentElement.outerHTML;
  hasNot(html, 'Комиссия по залогу', '«Комиссия по залогу» должна быть переименована');
  hasNot(html.toLowerCase(), 'комиссия по залогу', 'нет и в нижнем регистре (именительный)');
  hasNot(html.toLowerCase(), 'комиссии по залогу', 'нет и в нижнем регистре (родительный/дательный)');
});
test('R19-2: гварды переименованы (шов __zt) и старые имена удалены (лексический скоуп)', () => {
  const { win, zt } = load();
  ok(typeof zt.canCurate === 'function', 'canCurate — в шве __zt');
  ok(typeof zt.canCommittee === 'function', 'canCommittee — в шве __zt');
  ok(typeof zt.canHeadOfDept === 'function', 'canHeadOfDept — в шве __zt');
  ok(typeof zt.canHeadOfUnit === 'function', 'canHeadOfUnit — в шве __zt');
  eq(win.eval('typeof canEdit'), 'undefined', 'старое имя canEdit удалено как биндинг верхнего уровня');
  eq(win.eval('typeof canCommission'), 'undefined', 'старое имя canCommission удалено как биндинг верхнего уровня');
});

report();
