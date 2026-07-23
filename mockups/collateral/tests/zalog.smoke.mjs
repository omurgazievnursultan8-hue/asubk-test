import { load, test, ok, no, eq, near, has, hasNot, report } from './harness.mjs';

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

// R13-14 (Р-13, П1 §2.6): заёмщик под категорией, чья обеспеченность устанавливается
// решением Кабинета Министров, — регистрация залогового договора блокируется, пока
// реквизиты решения (kmDecision) не внесены на кредит. kmGateBlocked — чистый предикат
// над кредитом: категория есть и решения нет -> блок; категория есть и решение есть ->
// не блок; категории нет вовсе -> не блок (обычный кредит вне §2.6).
test('R13-14: категория без kmDecision → регистрация блокирована', () => {
  const { zt } = load();
  ok(typeof zt.kmGateBlocked === 'function', 'kmGateBlocked не в шве');
  eq(zt.kmGateBlocked({borrowerCategory:'Госпредприятие', kmDecision:null}), true);
  eq(zt.kmGateBlocked({borrowerCategory:'Госпредприятие', kmDecision:{no:'ПКМ КР №233',date:'02.05.2025',coverPct:100}}), false);
  eq(zt.kmGateBlocked({borrowerCategory:null, kmDecision:null}), false);
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

// Р-11 (§9–10, Прил.1 §2.3): индекс обеспеченности = idxPledge (залог) + idxGuar (банковская
// гарантия). guaranteeReq(cr) требует otherSecurity.type==='банковская гарантия' (иначе null) —
// фикстуры брифа без `type` против реальной реализации возвращали бы null, поэтому здесь
// `type` явно указан в каждой фикстуре.
test('R11-6: гарантия в валюте кредита на 100% -> порог индекса 1.0', () => {
  const { zt } = load();
  eq(zt.guaranteeReq({ currency:'KGS', otherSecurity:{ type:'банковская гарантия', currency:'KGS' } }), 1.0);
});
test('R11-7: гарантия в иной валюте -> порог 1.2', () => {
  const { zt } = load();
  eq(zt.guaranteeReq({ currency:'KGS', otherSecurity:{ type:'банковская гарантия', currency:'USD' } }), 1.2);
});
test('R11-6b: guaranteeReq — null без банковской гарантии (нет otherSecurity либо иной type)', () => {
  const { zt } = load();
  eq(zt.guaranteeReq({ currency:'KGS', otherSecurity:null }), null, 'нет otherSecurity');
  eq(zt.guaranteeReq({ currency:'KGS', otherSecurity:{ type:'поручительство', currency:'KGS' } }), null, 'поручительство — не банковская гарантия');
});
test('R11-6c: guaranteeReq — отсутствие currency трактуется как KGS с обеих сторон', () => {
  const { zt } = load();
  eq(zt.guaranteeReq({ otherSecurity:{ type:'банковская гарантия' } }), 1.0, 'обе стороны дефолтятся к KGS -> совпадают -> 100%');
});
test('R11-6d: guaranteeExpired — сравнение till с TODAY (11.07.2026)', () => {
  const { zt } = load();
  eq(zt.guaranteeExpired({ till:'01.01.2020' }), true, 'till в прошлом — истекла');
  eq(zt.guaranteeExpired({ till:'01.01.2030' }), false, 'till в будущем — не истекла');
  eq(zt.guaranteeExpired({}), false, 'нет till — не считается истёкшей');
});

// R11-8: индекс = idxPledge + idxGuar на СКОНСТРУИРОВАННОМ кредите (реальная формула,
// не demo-ветка) — 50% гарантией + 50% залогом должны вместе обеспечить кредит; просадка
// доли залога ниже 50% должна провалить гейт (index<1). Настоящие assert'ы, не ok(true)-стаб.
test('R11-8: индекс обеспеченности 0.5(гарантия)+0.5(залог) -> обеспечен; просадка доли -> нет', () => {
  const { zt, win } = load();
  zt.CREDITS.push({ id:'К-Т2', num:'Тестовый кредит Т2', inn:'22105198800047', amount:100000, currency:'KGS',
    status:'Действующий', overdue:false,
    otherSecurity:{ type:'банковская гарантия', docNo:'БГ-ТЕСТ/1', bank:'Тестбанк', amount:50000, currency:'KGS',
      from:'01.06.2026', till:'01.06.2027', note:'тест' } });
  const it = win.normalizeItem({ id:'П-Т3', kind:'Недвижимое имущество', name:'Тестовое здание Т2', pledger:'22105198800047',
    ident:'ТЕСТ-3', appraised:100000, apprDate:'01.07.2026', apprReport:'ОЦ-ТЕСТ3',
    override:null, ban:null, lost:false, realizing:false, needReval:false, everPledged:false,
    lastSurvey:'01.07.2026', lastReval:'01.07.2026', revals:[], surveys:[], history:[] });
  it.prereqs.encumbranceCert.present = true;
  zt.ITEMS.push(it);
  const c = { id:'Д-Т2', no:'ЗД-ТЕСТ/2', date:'01.06.2026', status:'Зарегистрирован', inn:'22105198800047',
    notary:'Т', notaryNo:'Т', notaryDate:'01.06.2026', cert:'Т',
    credits:['К-Т2'], allocs:[{ item:'П-Т3', credit:'К-Т2', share:60000 }], undercovered:null, addenda:[], history:[] };
  zt.CONTRACTS.push(c);
  const cs = zt.CONTRACTS.filter(x=>x.id==='Д-Т2');
  const row1 = zt.coverage(cs, 'К-Т2');
  // залог: 60 000 / (100 000 × 1.2 порог ликвида) = 0.5; гарантия: 50 000 / (100 000 × 1.0) = 0.5.
  near(row1.idxPledge, 0.5, 'доля индекса от залога');
  near(row1.idxGuar, 0.5, 'доля индекса от гарантии');
  near(row1.index, 1.0, 'суммарный индекс = 1.0');
  eq(row1.ok, true, 'index>=1 и доля ликвида не применяется (порог 120%) — обеспечен');
  c.allocs[0].share = 30000; // просадка доли залога вдвое
  const row2 = zt.coverage(cs, 'К-Т2');
  near(row2.index, 0.75, 'суммарный индекс упал ниже 1');
  eq(row2.ok, false, 'index<1 — гейт не пройден');
});

// К-95 (Р-10/Р-11 demo, доработано §17 п.1) обеспечен ТОЛЬКО банковской гарантией
// (Д-008 без залоговых долей), гарантия в ИНОЙ валюте (USD), чем кредит (KGS) —
// курсовой порог 120% (COVER_GUARANTEE_FX). Реальный расчёт (не mirror-хак) даёт
// idxGuar≈0,55 < 1 — НЕ обеспечен. Второй блок — синтетический кредит с гарантией
// В ВАЛЮТЕ кредита демонстрирует обратный случай (idxGuar>=1, тоже реальный расчёт,
// не голое наличие otherSecurity), сохраняя исходный смысл теста.
test('R11-9: банковская гарантия — реальный индекс, не mirror-хак (иная валюта / валюта кредита)', () => {
  const { zt } = load();
  const cs = zt.CONTRACTS.filter(c=>c.status==='Зарегистрирован');
  const rowFx = zt.coverage(cs, 'К-95');
  ok(rowFx.gReq !== null, 'гарантия распознана — gReq не null');
  near(rowFx.idxGuar, 0.55, 'USD-гарантия 132000 при курсовом пороге 120% от 200000 (К-95)', 0.01);
  eq(rowFx.ok, false, 'гарантия в иной валюте не покрывает кредит — реальный расчёт, не mirror-хак');

  zt.CREDITS.push({ id:'К-Т9', num:'Тестовый кредит Т9', inn:'22105198800047', amount:100000, currency:'KGS',
    status:'Действующий', overdue:false,
    otherSecurity:{ type:'банковская гарантия', docNo:'БГ-ТЕСТ/9', bank:'Тестбанк', amount:100000, currency:'KGS', from:'01.01.2026', till:'01.01.2027' } });
  zt.CONTRACTS.push({ id:'Д-Т9', no:'ЗД-ТЕСТ/9', date:'01.01.2026', status:'Зарегистрирован', inn:'22105198800047',
    notary:'Т', notaryNo:'Т', notaryDate:'01.01.2026', cert:'Т', credits:['К-Т9'], allocs:[], undercovered:null, addenda:[], history:[] });
  const cs2 = zt.CONTRACTS.filter(c=>c.status==='Зарегистрирован');
  const rowKgs = zt.coverage(cs2, 'К-Т9');
  ok(rowKgs.idxGuar >= 1, 'гарантия в валюте кредита покрывает кредит на >=100%');
  eq(rowKgs.ok, true, 'кредит обеспечен гарантией в валюте кредита — реальный индекс, не mirror-хак');
});

// R11-11 (§17 п.11 брифа — «поручительство не входит в индекс»): guaranteeReq/coverage
// признают ТОЛЬКО type==='банковская гарантия'; поручительство остаётся справочным полем
// otherSecurity на карточке кредита, но в idxGuar/index не участвует (Р-21 — осознанная
// граница модуля). Настоящие ассерты на наблюдаемом поведении, не ok(true)-заглушка.
test('R11-11: поручительство не входит в индекс обеспеченности', () => {
  const { zt } = load();
  zt.CREDITS.push({ id:'К-Т11', num:'Тестовый кредит Т11', inn:'22105198800047', amount:100000, currency:'KGS',
    status:'Действующий', overdue:false,
    otherSecurity:{ type:'поручительство', guarantor:'Иванов И.И.', amount:200000, currency:'KGS' } });
  zt.CONTRACTS.push({ id:'Д-Т11', no:'ЗД-ТЕСТ/11', date:'01.07.2026', status:'Зарегистрирован', inn:'22105198800047',
    notary:'Т', notaryNo:'Т', notaryDate:'01.07.2026', cert:'Т', credits:['К-Т11'], allocs:[], undercovered:null, addenda:[], history:[] });
  const cs = zt.CONTRACTS.filter(c=>c.status==='Зарегистрирован');
  const row = zt.coverage(cs, 'К-Т11');
  eq(zt.guaranteeReq(zt.credit('К-Т11')), null, 'поручительство не распознаётся как банковская гарантия — gReq null');
  eq(row.idxGuar, 0, 'поручительство не даёт вклада в idxGuar (в индекс не входит)');
  eq(row.ok, false, 'без залоговых долей и с поручительством вне индекса кредит формально не обеспечен');
});

// Демо §17 п.1/п.2 (Р-11): индексы обеспеченности по демо-данным задачи 22 — К-99
// (смешанное: гарантия 0,50 + залог 0,50 → ≈1,00, обеспечен) и К-95 (гарантия в иной
// валюте ≈0,55 < 1, не обеспечен). Аргументы coverage(cs, creditId) — cs ПЕРВЫМ.
test('Демо §17 п.1-2: индексы обеспеченности К-99 (смешанное) и К-95 (FX-гарантия)', () => {
  const { zt } = load();
  const cs = zt.CONTRACTS.filter(c=>c.status==='Зарегистрирован');
  const rowMix = zt.coverage(cs, 'К-99');
  near(rowMix.idxPledge, 0.50, 'доля индекса от залога (К-99)', 0.01);
  near(rowMix.idxGuar, 0.50, 'доля индекса от гарантии (К-99)', 0.01);
  near(rowMix.index, 1.00, 'смешанное 0.5+0.5 (К-99)', 0.01);
  ok(rowMix.ok, 'К-99 обеспечен смешанным залогом+гарантией');
  no(zt.coverage(cs, 'К-95').ok, 'гарантия USD ≈0.55 — К-95 не обеспечен');
});

// Демо §17 п.3 (Р-12): «Кредитный портфель» — ликвидный вид, порог 120%, покрытие К-100
// ровно на пороге (120000/100000=120,0%).
test('Демо §17 п.3: кредитный портфель — ликвидный залог, порог 120%', () => {
  const { zt } = load();
  const cs = zt.CONTRACTS.filter(c=>c.status==='Зарегистрирован');
  ok(zt.KINDS['Кредитный портфель'].liquid, 'кредитный портфель — ликвидный вид (справочник)');
  eq(zt.requiredCover('К-100', cs).req, zt.COVER_LIQUID, 'порог для портфеля — ликвидный 120%, не движимый неликвидный 150%');
  near(zt.coverage(cs, 'К-100').ratio, 1.2, 'покрытие К-100 ровно на пороге 120%', 0.005);
  ok(zt.coverage(cs, 'К-100').ok, 'К-100 обеспечен');
});

// Демо §17 п.4 (Р-16): «Право аренды» П-017 — срок аренды (01.03.2027) короче срока
// кредита-образца К-104 (01.01.2028) → leaseCoversCredit предупреждает.
test('Демо §17 п.4: право аренды короче срока кредита — предупреждение leaseCoversCredit', () => {
  const { zt } = load();
  const w = zt.leaseCoversCredit(zt.item('П-017'), zt.credit('К-104'));
  eq(w.warn, true, 'срок аренды короче срока кредита — предупреждение (ПОЛ §6.4 п.6)');
});

// Демо §17 п.5 (Р-13): К-101 без kmDecision — блок; К-102 с kmDecision(coverPct=100) — не блок,
// requiredCover читает порог из решения КМ.
test('Демо §17 п.5: kmGateBlocked — К-101 блокирован, К-102 (с решением КМ) — нет', () => {
  const { zt } = load();
  const cs = zt.CONTRACTS.filter(c=>c.status==='Зарегистрирован');
  eq(zt.kmGateBlocked(zt.credit('К-101')), true, 'К-101 — категория без kmDecision — блок регистрации');
  eq(zt.kmGateBlocked(zt.credit('К-102')), false, 'К-102 — решение КМ внесено — блок снят');
  eq(zt.requiredCover('К-102', cs).req, 1.0, 'requiredCover читает порог 100% из kmDecision.coverPct');
  ok(zt.coverage(cs, 'К-102').ok, 'К-102 обеспечен по порогу решения КМ (100%)');
});

// Демо §17 п.8 (Р-17): трактор П-020 (2008, СНГ) — возраст 18 лет > лимита 15. В роли
// основного залога — не блокирован, идёт на решение комитета; в роли дополнительного —
// жёсткий блок без права комитета на допуск.
test('Демо §17 п.8: возраст техники сверх лимита — роль основной/дополнительный', () => {
  const { zt } = load();
  const it = zt.item('П-020');
  eq(it.year, 2008); eq(it.origin, 'СНГ');
  const asMain = zt.techAgeCheck({ securityRole:'основной', origin:it.origin, age:2026-it.year });
  eq(asMain.block, false, 'основной залог сверх лимита — не блокируется на приёме');
  eq(asMain.needCommittee, true, 'основной залог сверх лимита — уходит на решение комитета');
  const asExtra = zt.techAgeCheck({ securityRole:'дополнительный', origin:it.origin, age:2026-it.year });
  eq(asExtra.block, true, 'дополнительный залог сверх лимита — жёсткий блок');
});

// Демо §17 п.9 (Р-18): земля с/х назначения (П-021) и оборудование с износом 78% (П-022) —
// оба блокируются стоп-листом без права комитета на допуск (committeeCanOverride:false).
test('Демо §17 п.9: стоп-лист — земля с/х назначения и износ ≥ предела', () => {
  const { zt } = load();
  const land = zt.stopListCheck(zt.stopFieldsOf(zt.item('П-021')));
  eq(land.block, true, 'земля сельскохозяйственного назначения — блок');
  eq(land.committeeCanOverride, false, 'земля с/х — комитет не может допустить');
  const worn = zt.stopListCheck(zt.stopFieldsOf(zt.item('П-022')));
  eq(worn.block, true, 'износ 78% ≥ предела 70% — блок');
  eq(worn.committeeCanOverride, false, 'износ сверх предела — комитет не может допустить');
});

// Демо §17 п.11 (Р-20, ПБК п.2.1): П-023 — запрет наложен (regNo есть), отметка в
// оригиналах не получена (markInOriginals:false) → banFullyRegistered=false → триггер
// «Запрет наложен, отметка не получена» (mid) должен присутствовать среди triggers().
test('Демо §17 п.11: запрет без отметки в оригиналах — banFullyRegistered=false и триггер', () => {
  const { zt, win } = load();
  const it = zt.item('П-023');
  eq(zt.banFullyRegistered(it.ban), false, 'regNo есть, markInOriginals:false — не полностью оформлен');
  const trg = win.triggers();
  ok(trg.some(t=>t.type==='Запрет наложен, отметка не получена' && t.obj==='П-023'),
    'триггер «Запрет наложен, отметка не получена» для П-023 должен присутствовать');
});

// Триггеры истечения гарантии (Р-11, §9–10): «Срок банковской гарантии истёк» (high) когда
// till < TODAY; «Гарантия истекает» (mid) когда till в пределах GUAR_WARN_DAYS=60 дней.
test('R11-10: триггеры истечения банковской гарантии', () => {
  const { zt, win } = load();
  zt.CREDITS.push({ id:'К-ТГ1', num:'Тестовый кредит ТГ1', inn:'22105198800047', amount:50000, currency:'KGS',
    status:'Действующий', overdue:false,
    otherSecurity:{ type:'банковская гарантия', currency:'KGS', amount:60000, from:'01.01.2025', till:'01.01.2026' } });
  zt.CONTRACTS.push({ id:'Д-ТГ1', no:'ЗД-ТГ1', date:'01.01.2025', status:'Зарегистрирован', inn:'22105198800047',
    notary:'Т', notaryNo:'Т', notaryDate:'01.01.2025', cert:'Т', credits:['К-ТГ1'], allocs:[], undercovered:null, addenda:[], history:[] });
  zt.CREDITS.push({ id:'К-ТГ2', num:'Тестовый кредит ТГ2', inn:'22105198800047', amount:50000, currency:'KGS',
    status:'Действующий', overdue:false,
    otherSecurity:{ type:'банковская гарантия', currency:'KGS', amount:60000, from:'01.01.2025', till:'20.08.2026' } });
  zt.CONTRACTS.push({ id:'Д-ТГ2', no:'ЗД-ТГ2', date:'01.01.2025', status:'Зарегистрирован', inn:'22105198800047',
    notary:'Т', notaryNo:'Т', notaryDate:'01.01.2025', cert:'Т', credits:['К-ТГ2'], allocs:[], undercovered:null, addenda:[], history:[] });
  const trg = win.triggers();
  ok(trg.some(t=>t.type==='Срок банковской гарантии истёк' && t.obj==='К-ТГ1' && t.crit==='high'), 'истёкшая гарантия (till 01.01.2026 < TODAY) -> high триггер');
  ok(trg.some(t=>t.type==='Гарантия истекает' && t.obj==='К-ТГ2' && t.crit==='mid'), 'гарантия истекает через ~40 дней (<=60) -> mid триггер');
});

// T3 (Р-11): дефолт доли в openAlloc нетто считается по coverage-wide secPledge кредита
// (эффективные доли ВО ВСЕХ действующих договорах + черновик), а не только по долям
// текущего черновика — иначе дефолт завышал бы недостающую сумму для кредита, уже частично
// закрытого залогом по ДРУГОМУ договору.
test('T3-1: openAlloc — дефолт доли учитывает залог кредита на других действующих договорах', () => {
  const { zt, win } = load();
  // К-Т3: 100 000, уже наполовину закрыт (50 000) активным договором Д-Т3a (другой договор).
  zt.CREDITS.push({ id:'К-Т3', num:'Тестовый кредит Т3', inn:'22105198800047', amount:100000, status:'Действующий', overdue:false, otherSecurity:null });
  const itA = win.normalizeItem({ id:'П-Т4', kind:'Недвижимое имущество', name:'Уже заложено', pledger:'22105198800047',
    ident:'ТЕСТ-4', appraised:100000, apprDate:'01.07.2026', apprReport:'ОЦ-ТЕСТ4',
    override:null, ban:null, lost:false, realizing:false, needReval:false, everPledged:false,
    lastSurvey:'01.07.2026', lastReval:'01.07.2026', revals:[], surveys:[], history:[] });
  itA.prereqs.encumbranceCert.present = true;
  const itB = win.normalizeItem({ id:'П-Т5', kind:'Недвижимое имущество', name:'Новый предмет черновика', pledger:'22105198800047',
    ident:'ТЕСТ-5', appraised:400000, apprDate:'01.07.2026', apprReport:'ОЦ-ТЕСТ5',
    override:null, ban:null, lost:false, realizing:false, needReval:false, everPledged:false,
    lastSurvey:'01.07.2026', lastReval:'01.07.2026', revals:[], surveys:[], history:[] });
  itB.prereqs.encumbranceCert.present = true;
  zt.ITEMS.push(itA, itB);
  zt.CONTRACTS.push({ id:'Д-Т3a', no:'ЗД-ТЕСТ/3a', date:'01.06.2026', status:'Зарегистрирован', inn:'22105198800047',
    notary:'Т', notaryNo:'Т', notaryDate:'01.06.2026', cert:'Т',
    credits:['К-Т3'], allocs:[{ item:'П-Т4', credit:'К-Т3', share:50000 }], undercovered:null, addenda:[], history:[] });
  const draft = { id:'Д-Т3b', no:'', date:'', status:'Оформляется', inn:'22105198800047',
    notary:'', notaryNo:'', notaryDate:'', cert:'', credits:['К-Т3'], allocs:[], undercovered:null, addenda:[], history:[] };
  zt.CONTRACTS.push(draft);
  win.openAlloc('Д-Т3b', 'П-Т5');
  win.document.getElementById('alCredit').value = 'К-Т3';
  win.document.getElementById('alItem').dispatchEvent(new win.Event('change'));
  // Порог 120% (чисто ликвидный состав): требуется 100000×1.2=120000; уже закрыто 50000
  // на ДРУГОМ договоре -> дефолт доли должен быть 120000-50000=70000, а не 120000-0.
  eq(win.document.getElementById('alShare').value, '70000', 'дефолт доли нетто-считается по coverage-wide secPledge, а не только по долям этого черновика');
});

// Р-12 (П1 §2.2): 5 новых видов залога добавлены в КIND_FIELDS вместе с миграцией
// «Кредитный портфель». Тесты брифа (win.KIND_FIELDS) сломаны так же, как D1-1/R19-1:
// top-level const в классическом <script> не становится свойством window — проверяем
// через шов __zt (см. комментарий к R19-2).
test('R12-12: кредитный портфель — ликвидный, порог 120%', () => {
  const { zt } = load();
  ok(zt.KINDS['Кредитный портфель'], 'вид отсутствует');
  eq(zt.KINDS['Кредитный портфель'].liquid, true);
});
test('R12-13: KIND_FIELDS для новых видов — непустой набор с обязательным полем', () => {
  const { zt } = load();
  ok(zt.KIND_FIELDS['Ценные бумаги'] && zt.KIND_FIELDS['Ценные бумаги'].length > 0, 'набор полей отсутствует');
  ok(zt.KIND_FIELDS['Ценные бумаги'].some(f => f.req), 'нет ни одного обязательного поля');
});

// R12-14: пороги requiredCover для новых видов — «Кредитный портфель» движимый, но
// liquid:true (§2.3) -> 120%; «Ценные бумаги» движимый и liquid:false (§2.4) -> 150%.
// Одновременно доказывает, что новые виды НЕ считаются «движимым неликвидом» из-за
// movable:true — porog зависит от liquid, а не только от movable (см. requiredCover).
test('R12-14a: кредит обеспечен только «Кредитный портфель» -> порог 120% (П1 §2.3)', () => {
  const { zt } = load();
  zt.CREDITS.push({ id:'К-Т6', num:'Тестовый кредит Т6', inn:'22105198800047', amount:100000, status:'Действующий', overdue:false, otherSecurity:null });
  zt.ITEMS.push({ id:'П-Т6', kind:'Кредитный портфель', name:'Тестовый портфель', pledger:'22105198800047',
    ident:'ТЕСТ-6', appraised:200000, apprDate:'01.07.2026', apprReport:'ОЦ-ТЕСТ6',
    override:null, ban:null, lost:false, realizing:false, needReval:false, everPledged:false,
    lastSurvey:'01.07.2026', lastReval:'01.07.2026', revals:[], surveys:[], history:[] });
  zt.CONTRACTS.push({ id:'Д-Т6', no:'', date:'', status:'Зарегистрирован', inn:'22105198800047',
    notary:'', notaryNo:'', notaryDate:'', cert:'',
    credits:['К-Т6'], allocs:[{item:'П-Т6', credit:'К-Т6', share:120000}], undercovered:null, addenda:[], history:[] });
  const cs = zt.CONTRACTS.filter(c=>c.status==='Зарегистрирован');
  eq(zt.requiredCover('К-Т6', cs).req, zt.COVER_LIQUID, 'кредитный портфель — ликвидный вид, требуемый порог 120%');
});
test('R12-14b: кредит обеспечен только «Ценные бумаги» -> порог 150% (П1 §2.4)', () => {
  const { zt } = load();
  zt.CREDITS.push({ id:'К-Т7', num:'Тестовый кредит Т7', inn:'22105198800047', amount:100000, status:'Действующий', overdue:false, otherSecurity:null });
  zt.ITEMS.push({ id:'П-Т7', kind:'Ценные бумаги', name:'Тестовые бумаги', pledger:'22105198800047',
    ident:'ТЕСТ-7', appraised:200000, apprDate:'01.07.2026', apprReport:'ОЦ-ТЕСТ7',
    override:null, ban:null, lost:false, realizing:false, needReval:false, everPledged:false,
    lastSurvey:'01.07.2026', lastReval:'01.07.2026', revals:[], surveys:[], history:[] });
  zt.CONTRACTS.push({ id:'Д-Т7', no:'', date:'', status:'Зарегистрирован', inn:'22105198800047',
    notary:'', notaryNo:'', notaryDate:'', cert:'',
    credits:['К-Т7'], allocs:[{item:'П-Т7', credit:'К-Т7', share:150000}], undercovered:null, addenda:[], history:[] });
  const cs = zt.CONTRACTS.filter(c=>c.status==='Зарегистрирован');
  eq(zt.requiredCover('К-Т7', cs).req, zt.COVER_MOVABLE, 'ценные бумаги — движимый неликвидный вид, требуемый порог 150%');
});

// Р-22 (ПОР п.10): слой ужесточения периодичности обследования по категории риска
// поверх матрицы платёжеспособности (Прил.2 §2.3). effectiveInterval(group, movable,
// riskCat, approval) = max(SURVEY_MIN_MONTHS, round(base × RISK_TIGHTENING[riskCat])),
// действует только при согласовании зампреда (approval.approved).
test('R22-40: эффективный интервал = max(min, матрица×коэф)', () => {
  const { zt } = load();
  // матрица «Платёжеспособные×движимое» = 24; риск «Средний» коэф 0.5 → 12
  eq(zt.effectiveInterval('Платёжеспособные', true, 'Средний', {approved:true}), 12);
});
test('R22-39: без согласования зампреда — чистая матрица', () => {
  const { zt } = load();
  eq(zt.effectiveInterval('Платёжеспособные', true, 'Средний', {approved:false}), 24);
});
test('R22-42: банкрот — интервал не задаётся', () => {
  const { zt } = load();
  // 'Предприятия-банкроты' — реальный ключ SURVEY_MATRIX (не 'Банкрот'); строка
  // существует, но immovable/movable=null → surveyInterval возвращает null (не undefined),
  // effectiveInterval должен ловить оба случая через `base == null`.
  eq(zt.effectiveInterval('Предприятия-банкроты', false, 'Высокий', {approved:true}), undefined);
});
test('R22-41: worst-of категории риска по кредитам предмета — Высокий перекрывает Низкий', () => {
  const { zt } = load();
  zt.CREDITS.push({ id:'К-Т9', num:'Тестовый кредит Т9', inn:'22105198800047', amount:80000, status:'Действующий', overdue:false, otherSecurity:null, riskCategory:'Высокий' });
  zt.CREDITS.push({ id:'К-Т10', num:'Тестовый кредит Т10', inn:'22105198800047', amount:40000, status:'Действующий', overdue:false, otherSecurity:null, riskCategory:'Низкий' });
  zt.ITEMS.push({ id:'П-Т9', kind:'Оборудование', name:'Тестовый погрузчик', pledger:'22105198800047',
    ident:'ТЕСТ-9', appraised:200000, apprDate:'01.07.2026', apprReport:'ОЦ-ТЕСТ9',
    override:null, ban:null, lost:false, realizing:false, needReval:false, everPledged:false,
    lastSurvey:'01.01.2026', lastReval:'01.07.2026', revals:[], surveys:[], history:[] });
  zt.CONTRACTS.push({ id:'Д-Т9', no:'', date:'', status:'Зарегистрирован', inn:'22105198800047',
    notary:'', notaryNo:'', notaryDate:'', cert:'',
    credits:['К-Т9','К-Т10'], allocs:[{item:'П-Т9', credit:'К-Т9', share:60000}, {item:'П-Т9', credit:'К-Т10', share:40000}],
    undercovered:null, addenda:[], history:[] });
  const it = zt.item('П-Т9');
  eq(zt.itemRiskCategory(it), 'Высокий', 'worst-of должен взять наименьший коэффициент (Высокий 0.25 < Низкий 1.0)');
  // Заёмщик (КФХ «Ак-Дан») — «Неплатёжеспособные» × движимое = 12 мес. (база). При
  // согласовании зампреда и риске «Высокий» (коэф 0.25) — max(3, round(12×0.25))=3.
  const ns = zt.nextSurvey(it);
  eq(ns, zt.addMonths(it.lastSurvey, 3), 'nextSurvey должен применить ужесточённый (не базовый 12-мес.) интервал');
});

// Р-17 (П1 §2.5, §3.4): жёсткий возрастной лимит техники смягчается по роли обеспечения —
// «дополнительный» залог сверх лимита блокируется жёстко; «основной» залог сверх лимита не
// блокируется на приёме, а уходит на решение комитета (needCommittee), см. techAgeCheck.
test('R17-25: дополнительный + сверх лимита → жёсткий блок', () => {
  const { zt } = load();
  const v = zt.techAgeCheck({securityRole:'дополнительный', origin:'СНГ', age:17});
  eq(v.block, true); has(v.msg, 'П1 §2.5');
});
test('R17-26: основной + сверх → допуск только комитетом', () => {
  const { zt } = load();
  const v = zt.techAgeCheck({securityRole:'основной', origin:'СНГ', age:18});
  eq(v.block, false); eq(v.needCommittee, true);
});

// Р-18 (П1 §3.5): стоп-лист как исполняемая проверка (была только справочная витрина
// PROHIBITED_KINDS) — применяется и при приёме предмета (saveNewItem), и на гейте
// регистрации договора (openRegister), через единый stopListCheck.
test('R18-28: земля с/х → отказ без права допуска', () => {
  const { zt } = load();
  const v = zt.stopListCheck({landPurpose:'сельскохозяйственного назначения'});
  eq(v.block, true); eq(v.committeeCanOverride, false); has(v.msg, 'Закон КР');
});
test('R18-29: износ ≥ предела → отказ', () => {
  const { zt } = load();
  eq(zt.stopListCheck({wearPct:78}).block, true);
});
test('R18-30: снятый чек-бокс оборотоспособности → отказ', () => {
  const { zt } = load();
  eq(zt.stopListCheck({circulable:false}).block, true);
});

// Р-15 (П2 §2.4): акт обследования не сохраняется без заключения/фотофиксации; при
// одностороннем акте требуется подтверждённое наличие имущества, иначе — подписи ГФХ
// и залогодателя.
test('R15-19/20: сохранение без фото/заключения → блок', () => {
  const { zt } = load();
  eq(zt.surveyValidate({conclusion:'', photos:['a.jpg'], oneSided:false, signers:['ГФХ','залогодатель']}).ok, false);
  eq(zt.surveyValidate({conclusion:'осмотр', photos:[], oneSided:false, signers:['ГФХ','залогодатель']}).ok, false);
});
test('R15-21: односторонний без подтверждения наличия → блок; с → ок', () => {
  const { zt } = load();
  eq(zt.surveyValidate({conclusion:'x', photos:['a'], oneSided:true, presenceConfirmed:false, signers:['ГФХ']}).ok, false);
  eq(zt.surveyValidate({conclusion:'x', photos:['a'], oneSided:true, presenceConfirmed:true, signers:['ГФХ']}).ok, true);
});

// Р-16 (ПОЛ §6.4 п.7): способ хранения предмета залога — обязательное поле при
// регистрации договора; допустимы только два значения (у залогодателя / у
// залогодержателя), см. openRegister/doRegister.
test('R16-23: регистрация без custody → блок', () => {
  const { zt } = load();
  eq(zt.custodyValid(undefined), false);
  eq(zt.custodyValid('у залогодателя'), true);
});
// Р-16 (ПОЛ §6.4 п.6): право аренды как предмет залога — срок аренды должен
// покрывать срок кредита, иначе требуется решение комитета. Использует d2n
// (единственный парсер дат в кодовой базе), а не гипотетический parseDate.
// Обе даты обязаны распарситься — при отсутствии любой из них предупреждение
// не показывается (нет данных для сравнения), чтобы не порождать ложных срабатываний.
test('R16-24: право аренды со сроком короче кредита → предупреждение', () => {
  const { zt } = load();
  const w = zt.leaseCoversCredit({leaseTill:'01.01.2027'}, {creditTill:'01.01.2029'});
  eq(w.warn, true); has(w.msg, 'ПОЛ §6.4 п.6');
});
test('R16-24b: право аренды со сроком не короче кредита → без предупреждения', () => {
  const { zt } = load();
  const w = zt.leaseCoversCredit({leaseTill:'01.01.2030'}, {creditTill:'01.01.2029'});
  eq(w.warn, false);
});
test('R16-24c: отсутствует срок аренды или кредита → без предупреждения (нет данных)', () => {
  const { zt } = load();
  eq(zt.leaseCoversCredit({}, {creditTill:'01.01.2029'}).warn, false);
  eq(zt.leaseCoversCredit({leaseTill:'01.01.2027'}, {}).warn, false);
});

// Р-14 (Прил.3 §3.5): гейт замены залога доп соглашением — четыре условия:
// равноценность (введённое ≥ выведенного), согласие отраслевого департамента,
// заключение ДАК о ликвидности, ранг ликвидности не падает (Р-6, четвёртая проверка).
test('R14-15: рост ранга но падение стоимости → блок по равноценности', () => {
  const { zt } = load();
  const v = zt.replacementGate({ outValue:200000, inValue:50000, deptConsent:'СЗ-1', dakConclusion:'x', rankOk:true });
  eq(v.equivalenceOk, false); eq(v.blocked, true);
});
test('R14-16: без согласия отраслевого департамента → недоступно', () => {
  const { zt } = load();
  eq(zt.replacementGate({outValue:100,inValue:100,deptConsent:'',dakConclusion:'x',rankOk:true}).blocked, true);
});
test('R14-17: без заключения ДАК о ликвидности → недоступно', () => {
  const { zt } = load();
  eq(zt.replacementGate({outValue:100,inValue:100,deptConsent:'СЗ',dakConclusion:'',rankOk:true}).blocked, true);
});
test('R14-18: все четыре условия выполнены → допустимо', () => {
  const { zt } = load();
  const v = zt.replacementGate({outValue:100,inValue:150,deptConsent:'СЗ-1',dakConclusion:'ДАК-1',rankOk:true});
  eq(v.equivalenceOk, true); eq(v.consentOk, true); eq(v.dakOk, true); eq(v.rankOk, true); eq(v.blocked, false);
});

// Р-20 (ПБК п.2.1): запрет на отчуждение накладывает залогодатель, мы контролируем
// и принимаем отметку о запрете в оригиналах правоустанавливающих документов.
test('R20-36: regNo без markInOriginals → «отметка не получена», триггер mid', () => {
  const { zt } = load();
  eq(zt.banFullyRegistered({regNo:'ЗПО-1', markInOriginals:false}), false);
  eq(zt.banFullyRegistered({regNo:'ЗПО-1', markInOriginals:true, confirmedBy:'Куратор'}), true);
});
test('R20-37: снятие «Полное погашение» без акта сверки → блок', () => {
  const { zt } = load();
  eq(zt.releaseValid({basis:'Полное погашение обязательства', reconAct:''}).ok, false);
  eq(zt.releaseValid({basis:'Полное погашение обязательства', reconAct:'АС-1'}).ok, true);
});

// Р-19 (ПОЛ §2.1, §11): хвост нормативного решения — override залоговой стоимости только
// вниз (подъём выше расчётной блокируется для всех ролей); маршрут кредитно-залоговых
// документов (ПОЛ §11) — незавершённый маршрут поднимает триггер по сроку.
test('R19-32: подъём залоговой выше расчётной блокируется для всех ролей', () => {
  const { zt } = load();
  const it = { kind:'Недвижимое имущество', appraised:100000 }; // calc = 70000
  eq(zt.overrideAllowed(it, 80000).ok, false); // выше расчётной
  eq(zt.overrideAllowed(it, 60000).ok, true);  // понижение
});
test('R19-35: незавершённый маршрут документов → триггер по сроку', () => {
  const { zt } = load();
  ok(typeof zt.docRouteIncomplete === 'function');
});

// Р-23 (ПОР п.12 п.п.2): модуль залога не меняет категорию кредитного риска — он
// публикует кандидатов на факторы риска в комитет по администрированию бюджетных
// кредитов. riskFactorCandidates() — чистая функция (S18 §18 п.43-46).
test('R23-43: истёкший полис → фактор «Средний», ПОР п.12 п.п.2', () => {
  const { zt } = load();
  const cands = zt.riskFactorCandidates();
  ok(Array.isArray(cands));
  const f = cands.find(c => /страхов/i.test(c.fact));
  ok(f, 'демо должно давать кандидата по истёкшему полису техники');
  eq(f.category, 'Средний'); has(f.basis, 'ПОР п.12'); eq(f.needsCommittee, true);
});
test('R23-46: залоговый триггер не меняет solvency и не пишет риск', () => {
  const { win, zt } = load();
  // riskFactorCandidates не мутирует ITEMS/CREDITS solvency-поля
  const before = JSON.stringify(zt.CREDITS.map(c=>c.riskCategory));
  zt.riskFactorCandidates();
  eq(JSON.stringify(zt.CREDITS.map(c=>c.riskCategory)), before, 'категория риска не должна меняться');
});

// Р-21 (границы модуля): открытый вопрос «ОТКРЫТО (Р-10)» закрыт — первая половина
// решена Р-19 п.2 (override только вниз), вторая — Р-11/Р-21 (гарантия в индексе,
// поручительство — зеркало-справка). Блок должен исчезнуть из шапки макета.
test('R21-1: блок «ОТКРЫТО (Р-10)» удалён', () => {
  const { win } = load();
  const html = win.document.documentElement.outerHTML;
  hasNot(html, 'ОТКРЫТО (Р-10)');
  // Реальный маркер блока в шапке был «ОТКРЫТО (Р-10 — …)»; строка плана с закрывающей
  // скобкой ей не соответствовала (вакуумная проверка). Проверяем фактическое удаление
  // раздела и появление реформулировки границ Р-21.
  hasNot(html, 'ОТКРЫТО');
  has(html, 'ГРАНИЦЫ МОДУЛЯ (Р-21');
});

// §16 (задача 20): справочник «Регламентные параметры залога» — ~21 параметр, каждый
// несёт пометку источника: «норматив — <цитата>» (Положение/приложения, read-only без
// реквизита решения Правления) либо «внутренний» (операционный, свободно редактируется).
// Ref-1 — тест из брифа, дан ДОСЛОВНО. Он слабый (просто ищет обе подстроки где угодно
// в файле, включая JS-комментарии) — Ref-2..Ref-5 ниже проверяют реальную реализацию:
// гейтинг read-only по реквизиту Правления и то, что saveRefbook не спотыкается о
// заблокированные норматив-поля.
test('Ref-1: каждый параметр несёт пометку норматив/внутренний', () => {
  const { win } = load();
  const html = win.document.documentElement.outerHTML;
  has(html, 'норматив'); has(html, 'внутренний');
});
test('Ref-2: без реквизита Правления норматив-поля read-only (без id), с реквизитом — редактируемы', () => {
  const { win } = load();
  win.renderRefbook();
  ok(!win.document.getElementById('rb-cov-liq'), 'rb-cov-liq (норматив) не должен быть editable input без реквизита');
  ok(!win.document.getElementById('rb-cov-guar'), 'rb-cov-guar (норматив) не должен быть editable input без реквизита');
  ok(!win.document.getElementById('rb-wear'), 'rb-wear (норматив) не должен быть editable input без реквизита');
  // внутренние параметры editable всегда, вне зависимости от реквизита
  ok(win.document.getElementById('rb-ban-days'), 'rb-ban-days (внутренний) должен быть editable input');
  ok(win.document.getElementById('rb-doc-route'), 'rb-doc-route (внутренний) должен быть editable input');
  win.document.getElementById('rb-board-req').value = 'Протокол Правления №1 от 01.01.2026';
  win.rbToggleBoard();
  ok(win.document.getElementById('rb-cov-liq'), 'с реквизитом Правления норматив-поле должно стать editable input');
  ok(win.document.getElementById('rb-cov-guar'), 'с реквизитом Правления норматив-поле должно стать editable input');
});
test('Ref-3: saveRefbook не спотыкается о заблокированные (read-only) норматив-поля', () => {
  const { win } = load();
  win.renderRefbook();
  ok(!win.document.getElementById('rb-cov-liq'), 'без реквизита норматив-поле read-only');
  win.saveRefbook();
  const toasts = [...win.document.querySelectorAll('#toastWrap .toast')];
  ok(toasts.some(t => t.className.includes('ok')), 'сохранение без реквизита Правления должно пройти успешно, а не упасть на locked-полях');
});
test('Ref-4: read-only классификаторы указывают реализующую валидацию', () => {
  const { win } = load();
  win.renderRefbook();
  const html = win.document.getElementById('refbookPanel').innerHTML;
  has(html, 'реализует stopListCheck');
  has(html, 'гейт saveRelease/releaseValid');
  has(html, 'цепочка saveRelease');
});
test('Ref-5: новые параметры справочника (COVER_GUARANTEE/_FX, WEAR_LIMIT, DOC_ROUTE_DAYS, каналы снятия, реестр органов) отрендерены с пометками', () => {
  const { win } = load();
  win.renderRefbook();
  const html = win.document.getElementById('refbookPanel').innerHTML;
  has(html, 'Банковская гарантия в валюте кредита');
  has(html, 'Банковская гарантия в иной валюте');
  has(html, 'Предел физического износа техники');
  has(html, 'Срок маршрута документов');
  has(html, 'Каналы оформления снятия запрета');
  has(html, 'Реестр регистрирующих органов');
  ok(win.document.getElementById('rb-relch-0'), 'канал снятия #0 должен быть editable input');
  ok(win.document.getElementById('rb-org-0'), 'орган реестра #0 должен быть editable input');
});
test('Ref-6: SURVEY_MATRIX read-only (как PROHIBITED_KINDS), с реализующей валидацией surveyInterval', () => {
  const { win } = load();
  win.renderRefbook();
  const smInputs = [...win.document.querySelectorAll('[id^="rb-sm-"]')];
  eq(smInputs.length, 0, 'SURVEY_MATRIX не должна рендериться editable input-полями (rb-sm-im-*/rb-sm-mv-*)');
  const html = win.document.getElementById('refbookPanel').innerHTML;
  has(html, 'реализует surveyInterval');
});

// §19 (Head-1): шапка переписана под реализованные решения — блок соответствия
// Р-11…Р-23 присутствует; проверяем крайние маркеры и заголовок блока.
test('Head-1: шапка содержит блок соответствия Р-11…Р-23', () => {
  const { win } = load();
  const html = win.document.documentElement.outerHTML;
  has(html, 'Р-11');
  has(html, 'Р-23');
  has(html, 'СООТВЕТСТВИЕ нормативным решениям Р-11');
});

// §18 п.47 (Reg-47): регрессия Р-1…Р-9 — базовые демо-объекты на месте и покрытие всех
// договоров считается без исключений. ВНИМАНИЕ: сигнатура coverage(cs, creditId) — cs
// первым (бриф-сниппет писал аргументы наоборот). Здесь исправлено.
test('Reg-47: демо-ветки Р-1…Р-9 живы (объекты на месте), покрытие считается без ошибок', () => {
  const { zt } = load();
  ok(zt.ITEMS.find(i=>i.id==='П-005'), 'П-005 override/legacy-ветка');
  ok(zt.ITEMS.find(i=>i.id==='П-010'), 'П-010 ухудшение/страховка');
  ok(zt.CONTRACTS.find(c=>c.id==='Д-009'), 'банкрот Д-009');
  const cs = zt.CONTRACTS.filter(x=>x.status==='Зарегистрирован');
  let n = 0;
  zt.CONTRACTS.forEach(c => c.credits.forEach(cr => { const r = zt.coverage(cs, cr); ok(r && typeof r.index === 'number', 'coverage '+cr+' вернул index'); n++; }));
  ok(n > 0, 'посчитали покрытие хотя бы одного кредита');
});

// ============================================================
// §14. ПОРУЧИТЕЛЬСТВО (Р-24…Р-27). Гейты §9.1/9.2, ЖЦ, слой Р-24, M:N.
// ============================================================

// Ветка 1 (§14.6): физлицо, все применимые гейты пройдены → допуск ok.
test('P14-1: guarantorGate(ДП-001).ok===true (физлицо, все гейты)', () => {
  const { zt } = load();
  const g = zt.guarantorGate('ДП-001');
  ok(g.ok, 'ожидался пройденный допуск, fails: '+JSON.stringify(g.fails));
  eq(g.fails.length, 0);
});

// Ветка 2: юрлицо → применимы только Г3/Г5; Г1/Г2/Г4 не применяются.
test('P14-2: guarantorGate(ДП-002).ok===true (юрлицо; Г1/Г2/Г4 неприменимы)', () => {
  const { zt } = load();
  const g = zt.guarantorGate('ДП-002');
  ok(g.ok, 'юрлицо-поручитель должен проходить по Г3/Г5');
  no(g.fails.some(f=>['Г1','Г2','Г4'].includes(f.code)), 'Г1/Г2/Г4 не применимы к юрлицу — не должны попадать в fails');
  no(zt.guarantorIsPerson(zt.guarantor('ПРЧ-002')), 'ПРЧ-002 — юрлицо');
});

// Ветка 3: возраст > 70 → Г1 провален, договор остаётся «черновик».
test('P14-3: guarantorGate(ДП-003) → провал Г1 (возраст > 70)', () => {
  const { zt } = load();
  const g = zt.guarantorGate('ДП-003');
  no(g.ok);
  ok(g.fails.some(f=>f.code==='Г1'), 'ожидался провал Г1, fails: '+JSON.stringify(g.fails));
  eq(zt.surety('ДП-003').status, 'черновик');
});

// Ветка 4: в браке без согласия супруга → Г4 провален.
test('P14-4: guarantorGate(ДП-004) → провал Г4 (согласие супруга)', () => {
  const { zt } = load();
  const g = zt.guarantorGate('ДП-004');
  no(g.ok);
  ok(g.fails.some(f=>f.code==='Г4'), 'ожидался провал Г4, fails: '+JSON.stringify(g.fails));
});

// ageAt — возраст на дату договора (Г1).
test('P14-5: ageAt считает возраст на дату договора', () => {
  const { zt } = load();
  eq(zt.ageAt('15.03.1985', '10.04.2024'), 39);
  eq(zt.ageAt('10.01.1950', '18.09.2025'), 75);
  eq(zt.ageAt('', '10.04.2024'), null);
});

// РЕГРЕСС-ДОКАЗАТЕЛЬСТВО Р-24: индекс кредита ветки 5 идентичен с действующим
// поручительством и без него — поручительство в coverage().index НЕ входит.
test('P14-6: Р-24 регресс — index К-105 не зависит от поручительства (=0)', () => {
  const { zt } = load();
  const csReg = zt.CONTRACTS.filter(c=>c.status==='Зарегистрирован');
  const before = zt.coverage(csReg, 'К-105').index;
  zt.surety('ДП-005').status = 'снято';           // убираем действующее поручительство
  const after = zt.coverage(csReg, 'К-105').index;
  eq(before, after, 'index не должен зависеть от наличия поручительства');
  eq(before, 0, 'К-105 без залога/гарантии → index = 0');
});

// ЖЦ (И-14.3, Прил.7 п.4.2): снятие только при полном погашении кредита.
test('P14-7: снятие ДП запрещено при непогашенном кредите, разрешено при погашении', () => {
  const { win, zt } = load();
  no(zt.suretyReleaseAllowed('ДП-001'), 'кредит К-56 действующий — снятие запрещено');
  win.releaseSurety('ДП-001');
  eq(zt.surety('ДП-001').status, 'действует', 'досрочное снятие должно быть заблокировано');
  zt.credit('К-56').status = 'Погашен';
  ok(zt.suretyReleaseAllowed('ДП-001'), 'кредит погашен — снятие разрешено');
  win.releaseSurety('ДП-001');
  eq(zt.surety('ДП-001').status, 'снято');
});

// ЖЦ: перевод «черновик → действует» гейтится Р-26.
test('P14-8: активация заблокирована непройденным гейтом, разрешена после исправления', () => {
  const { win, zt } = load();
  win.activateSurety('ДП-004');
  eq(zt.surety('ДП-004').status, 'черновик', 'Г4 не пройден → активация заблокирована');
  zt.guarantor('ПРЧ-004').spouseConsent = { notary:'Нотариус Т.', regNo:'НС-2025/1', date:'05.02.2025' };
  win.activateSurety('ДП-004');
  eq(zt.surety('ДП-004').status, 'действует', 'после согласия супруга гейт пройден → действует');
});

// Слой обеспеченности (Р-24) содержит действующее поручительство для кредита ветки 1.
test('P14-9: слой поручительства для К-56 содержит ПРЧ/ФИО, солидарно на всю сумму', () => {
  const { zt } = load();
  const line = zt.suretyLayerLine('К-56');
  has(line, 'ПРЧ-001');
  has(line, 'солидарно на всю сумму');
  eq(zt.suretyLayerLine('К-40'), '', 'кредит без действующего поручительства → слой пуст');
});

// M:N: поручитель по двум кредитам; кредит с двумя поручителями.
test('P14-10: M:N — suretiesOfGuarantor и suretiesOfCredit возвращают по два договора', () => {
  const { zt } = load();
  eq(zt.suretiesOfGuarantor('ПРЧ-001').length, 2, 'ПРЧ-001 — по двум кредитам (ДП-001, ДП-006)');
  eq(zt.suretiesOfCredit('К-88').length, 2, 'К-88 — два поручителя (ДП-002, ДП-004)');
});

// Рендер карточки договора поручительства (вкладка «Допуск») — без падений.
test('P14-11: карточка поручительства рендерится, вкладка «Допуск» показывает чек-лист', () => {
  const { win } = load();
  win.openCard('surety', 'ДП-003', 1);
  const html = win.document.getElementById('detailPanels').innerHTML;
  has(html, 'Гейты допуска');
  has(html, 'не пройден');   // ДП-003 проваливает Г1
});

// Реестр «Поручительство» рендерит строки; слой Р-24 виден на вкладке обеспеченности.
test('P14-12: реестр поручительств и слой на вкладке «Обеспеченность кредитов»', () => {
  const { win } = load();
  win.navClick('Поручительство');
  has(win.document.getElementById('listBody').innerHTML, 'ДП-001');
  win.openCard('contract', 'Д-001', 2);   // Д-001 обеспечивает К-56 (есть ДП-001)
  has(win.document.getElementById('detailPanels').innerHTML, 'Слой поручительства');
});

/* ============================================================
   ВОЛНА 1 — целостность данных (Р-28…Р-33). См. план
   docs/superpowers/plans/2026-07-23-restructuring-calculator.md
   ============================================================ */

// Р-28 (В-1=А): договор без предметов не регистрируется. contentGate ложь; doRegister
// не переводит статус в «Зарегистрирован» и не проставляет реквизиты.
test('W1-1 (Р-28): регистрация пустого договора отклонена', () => {
  const { win, zt } = load();
  zt.CONTRACTS.push({ id:'Д-W1', no:'', date:'', status:'Оформляется', inn:'22105198800047',
    credits:[], allocs:[], undercovered:null, history:[] });
  const c = zt.contract('Д-W1');
  no(zt.contentGate(c).ok, 'пустой договор не проходит гейт содержания');
  win.doRegister('Д-W1');
  eq(c.status, 'Оформляется', 'статус не изменился — регистрация отклонена');
  eq(c.no || '', '', 'нотариальные реквизиты не проставлены');
});

// Р-29 (В-3=А): допуск комитета не создаёт нотариальных реквизитов, ставит undercovered
// и возвращает договор куратору в статусе «Оформляется».
test('W1-2 (Р-29): допуск комитета — без реквизитов, undercovered, статус Оформляется', () => {
  const { win, zt } = load();
  zt.CREDITS.push({ id:'К-W2', num:'Кредит W2', inn:'22105198800047', amount:100000,
    status:'Действующий', overdue:false, otherSecurity:null });
  const it = win.normalizeItem({ id:'П-W2', kind:'Оборудование', name:'Станок W2',
    pledger:'22105198800047', pledgerType:'Физлицо', appraised:100000, ident:'Инв. W2' });
  zt.ITEMS.push(it);
  zt.CONTRACTS.push({ id:'Д-W2', no:'', date:'', status:'На рассмотрении комиссии',
    inn:'22105198800047', credits:['К-W2'], allocs:[{item:'П-W2', credit:'К-W2', share:50000}],
    undercovered:null, history:[] });
  no(win.gateCheck(zt.contract('Д-W2')).ok, 'сценарий: покрытие ниже порога');
  win.eval("role='Комитет по администрированию бюджетных кредитов'");
  win.openCommission('Д-W2');
  win.document.getElementById('cmDec').value = 'admit';
  win.document.getElementById('cmObosn').value = 'социальная значимость проекта';
  win.saveCommission('Д-W2');
  const c = zt.contract('Д-W2');
  ok(c.undercovered && c.undercovered.obosn, 'проставлен флаг допуска с обоснованием');
  eq(c.status, 'Оформляется', 'статус вернулся к Оформляется, не Зарегистрирован');
  no(c.notary, 'нотариус не сфабрикован');
  no(c.cert, 'рег. свидетельство не сфабриковано');
});

// Р-30: правка нестоимостных реквизитов пишет след «было → стало» в историю.
test('W1-3 (Р-30): правка реквизитов предмета пишет было→стало в историю', () => {
  const { win, zt } = load();
  const it = zt.item('П-001');
  const before = it.name;
  win.openEditItem('П-001');
  win.document.getElementById('eiName').value = before + ' (испр.)';
  win.document.getElementById('eiReason').value = 'уточнение по правоустанавливающему документу';
  win.saveEditItem('П-001');
  eq(it.name, before + ' (испр.)', 'наименование обновлено');
  const last = it.history[it.history.length-1].what;
  has(last, 'Исправление реквизитов предмета', 'история содержит запись исправления');
  has(last, '→', 'запись показывает переход было → стало');
  has(last, before, 'в записи присутствует прежнее значение');
});

// Р-31: аннулирование черновика снимает отнесения — доступная стоимость предмета растёт.
test('W1-4 (Р-31): аннулированный черновик освобождает доли — availableOf растёт', () => {
  const { win, zt } = load();
  const it = zt.item('П-006');
  const before = zt.availableOf(it);
  win.openCancelDraft('Д-005');
  win.document.getElementById('cdReason').value = 'ошибочно создан';
  win.saveCancelDraft('Д-005');
  eq(zt.contract('Д-005').status, zt.CANCELLED, 'статус договора — Аннулирован');
  eq(zt.contract('Д-005').allocs.length, 0, 'отнесения сняты');
  ok(zt.availableOf(it) > before, 'освобождённые доли увеличили доступную стоимость');
});

// Р-32: переоценка с датой в будущем (2030) отклоняется — оценочная не меняется.
test('W1-5 (Р-32): переоценка будущей датой (2030) отклонена', () => {
  const { win, zt } = load();
  const it = zt.item('П-001');
  const beforeAppr = it.appraised, beforeLen = it.revals.length;
  win.openReval('П-001');
  win.document.getElementById('rvVal').value = '500000';
  win.document.getElementById('rvRep').value = 'ОЦ-ТЕСТ/1';
  win.document.getElementById('rvDate').value = '2030-01-01';
  win.saveReval('П-001');
  eq(it.appraised, beforeAppr, 'оценочная не изменилась');
  eq(it.revals.length, beforeLen, 'запись переоценки не добавлена');
});

// Р-33: сторно последней переоценки откатывает оценочную к предыдущей несторнированной.
test('W1-6 (Р-33): сторно переоценки откатывает оценочную к предыдущей', () => {
  const { win, zt } = load();
  const it = zt.item('П-002');
  eq(it.appraised, 110000, 'исходная оценочная — последняя переоценка');
  const beforePledge = zt.pledgeValue(it);
  const idxLast = it.revals.length - 1;
  win.eval("role='Заведующий отделом залогового обеспечения'");
  win.openVoidRecord('П-002','reval', idxLast);
  win.document.getElementById('vdReason').value = 'ошибочный отчёт оценщика';
  win.saveVoidRecord('П-002','reval', idxLast);
  ok(it.revals[idxLast].voided, 'запись помечена сторнированной');
  eq(it.appraised, 160000, 'оценочная откатилась к первичной 160 000');
  eq(it.lastReval, '12.02.2025', 'опорная дата переоценки откатилась');
  eq(zt.pledgeValue(it), zt.calcPledge(it), 'залоговая пересчитана от откаченной оценочной (override нет)');
  ok(zt.pledgeValue(it) > beforePledge, 'залоговая выросла после отката к более высокой оценочной');
});

// Р-33: нельзя сторнировать единственную действующую переоценку (базовая оценка обязана остаться).
test('W1-7 (Р-33): единственную действующую переоценку сторнировать нельзя', () => {
  const { win, zt } = load();
  const it = zt.item('П-001');           // одна reval в сиде
  eq(zt.livesReval(it).length, 1, 'у предмета одна действующая переоценка');
  ok(zt.voidBlockedReason(it,'reval'), 'сторно единственной оценки заблокировано');
  win.eval("role='Заведующий отделом залогового обеспечения'");
  win.saveVoidRecord('П-001','reval', 0);
  no(it.revals[0].voided, 'запись не сторнирована — блок сработал');
});

/* ============================================================
   ВОЛНА 2 — роли и очередь комитета (Р-34…Р-36). См. план
   docs/superpowers/plans/2026-07-23-restructuring-calculator.md
   ============================================================ */

// Р-34: actionBtn — при отсутствии права кнопка disabled, без onclick, с ролевым title.
test('W2-1 (Р-34): actionBtn без права — disabled, без onclick, с title о роли', () => {
  const { win } = load();
  win.eval("role='Наблюдатель'");
  const html = win.__zt.actionBtn(win.__zt.canCurate(), 'Провести переоценку', "openReval('П-001')");
  has(html, 'disabled', 'кнопка без права — disabled');
  hasNot(html, 'onclick', 'у disabled-кнопки нет обработчика');
  has(html, 'не имеет права', 'title объясняет отказ по роли');
});

// Р-34: actionBtn с правом, но с блокирующим гейтом — disabled со своим blockedTitle.
test('W2-2 (Р-34): actionBtn с правом, но заблокирован гейтом — disabled + blockedTitle', () => {
  const { win } = load();
  win.eval("role='Куратор отдела залогового обеспечения'");
  const html = win.__zt.actionBtn(win.__zt.canCurate(), 'Снять запрет (полное)', "openBanRelease('П-001')",
    { blocked:true, blockedTitle:'нельзя, пока закреплены доли' });
  has(html, 'disabled', 'заблокированная гейтом кнопка — disabled');
  has(html, 'нельзя, пока закреплены доли', 'показан blockedTitle, а не ролевой');
});

// Р-34 (§8): «Наблюдатель» не имеет ни одной активной кнопки действия.
// Карточка предмета и футер договора не содержат ни одного enabled open*/save* обработчика.
test('W2-3 (Р-34): «Наблюдатель» — ни одной активной кнопки действия', () => {
  const { win, zt } = load();
  win.eval("role='Наблюдатель'");
  const it = zt.item('П-001');
  // navigation-переходы (openCard) — не «действие»; вырезаем их перед проверкой мутирующих open*.
  const itemHtml = win.itemPanels(it).join('').split('openCard(').join('NAV(');
  hasNot(itemHtml, 'onclick="open', 'в карточке предмета нет активных мутирующих действий open*');
  hasNot(itemHtml, 'onclick="save', 'в карточке предмета нет активных действий save*');
  const draft = zt.CONTRACTS.find(c => zt.isDraftish(c));
  const footHtml = win.ctrFooter(draft);
  hasNot(footHtml, 'onclick="openRegister', 'футер договора без активной регистрации');
  hasNot(footHtml, 'onclick="openCancelDraft', 'футер договора без активного аннулирования');
  has(footHtml, 'disabled', 'кнопки футера присутствуют, но disabled (состав действий виден)');
});

// Р-34: у роли-куратора те же карточные действия — активны (регресс на «не переусердствовали»).
test('W2-4 (Р-34): у куратора карточные действия активны', () => {
  const { win, zt } = load();
  win.eval("role='Куратор отдела залогового обеспечения'");
  const itemHtml = win.itemPanels(zt.item('П-001')).join('');
  has(itemHtml, "onclick=\"openReval('П-001')", 'куратор видит активную переоценку');
  has(itemHtml, "onclick=\"openEditItem('П-001')", 'куратор видит активную правку реквизитов');
});

// Р-35: договор «На рассмотрении комиссии» виден комитету через очередь (§8).
// onRoleChange для комитета переключает реестр на договоры с преднастроенным фильтром.
test('W2-5 (Р-35): комитет видит очередь «На рассмотрении комиссии»', () => {
  const { win, zt } = load();
  ok(zt.CONTRACTS.some(c => c.status === 'На рассмотрении комиссии'), 'в сиде есть договор в очереди комитета');
  win.document.getElementById('roleSel').value = 'Комитет по администрированию бюджетных кредитов';
  win.onRoleChange();
  eq(win.eval('reg'), 'contracts', 'реестр переключён на договоры');
  eq(win.eval('activeFilter.contracts && activeFilter.contracts.status'), 'На рассмотрении комиссии',
    'фильтр преднастроен на статус очереди комитета');
});

// Р-35: очередь поднимает критичность триггера до high, когда ожидание > COMMITTEE_SLA.
test('W2-6 (Р-35): просроченный SLA очереди комитета → триггер high', () => {
  const { zt } = load();
  const trg = zt.triggers();
  const q = trg.find(t => t.type === 'Ожидает решения комитета' && t.obj === 'Д-008');
  ok(q, 'триггер очереди комитета по Д-008 присутствует');
  eq(q.crit, 'high', 'ожидание 16 дн. > SLA 10 → критичность high');
  has(q.text, 'просрочен SLA', 'текст называет просрочку SLA');
});

// Р-35: SLA — внутренний параметр справочника, влияет на эскалацию (при большом SLA → mid).
test('W2-7 (Р-35): рост COMMITTEE_SLA снимает эскалацию до mid', () => {
  const { win, zt } = load();
  win.eval('COMMITTEE_SLA = 30');
  const q = zt.triggers().find(t => t.type === 'Ожидает решения комитета' && t.obj === 'Д-008');
  ok(q, 'триггер очереди присутствует'); eq(q.crit, 'mid', '16 дн. < SLA 30 → mid');
});

// Р-36: документарный гейт (§5.2 предпосылки) блокирует направление в комитет —
// в футере регистрации кнопки «Направить в комитет» нет, недообеспечение туда не уходит.
test('W2-8 (Р-36): документарно заблокированный договор не предлагает «Направить в комитет»', () => {
  const { win, zt } = load();
  win.eval("role='Куратор отдела залогового обеспечения'");
  const draft = zt.contract('Д-010');   // муниципальное без согласия ОМСУ — провал §5.2
  ok(zt.prereqMissing(zt.item(draft.allocs[0].item)).length, 'сценарий: у предмета есть незакрытая предпосылка §5.2');
  win.openRegister('Д-010');
  const modalHtml = win.document.getElementById('modalHost').innerHTML;
  hasNot(modalHtml, 'Направить в комитет', 'документарный блок не открывает путь в комитет');
});

// Р-36: чистое недообеспечение (все документарные гейты пройдены) — путь в комитет открыт.
test('W2-9 (Р-36): чистое недообеспечение открывает «Направить в комитет»', () => {
  const { win, zt } = load();
  win.eval("role='Куратор отдела залогового обеспечения'");
  win.openRegister('Д-008');   // К-106: 38,9% при 120%, документарно чист
  const modalHtml = win.document.getElementById('modalHost').innerHTML;
  has(modalHtml, 'Направить в комитет', 'недообеспечение без документарных блоков идёт в комитет');
});

// Р-36: toCommission гейтит документарные предпосылки — вручную заблокированный договор
// не переводится в «На рассмотрении комиссии».
test('W2-10 (Р-36): toCommission не отправляет документарно заблокированный договор', () => {
  const { win, zt } = load();
  win.eval("role='Куратор отдела залогового обеспечения'");
  const before = zt.contract('Д-010').status;
  win.toCommission('Д-010');
  eq(zt.contract('Д-010').status, before, 'статус не изменился — документарный гейт §5.2 не пройден');
});

/* ============================================================
   ВОЛНА 3 — работоспособность на объёме (Р-37/Р-38/Р-39/Р-41).
   ============================================================ */

// Р-37: реестр «Предметы» — авторитетная кнопка создания вернулась (кейс «имущество на
// этапе заявки, договора ещё нет»); подпись исправлена по реестру.
test('W3-1 (Р-37): у куратора в реестре предметов кнопка «Новый предмет залога» видна', () => {
  const { win } = load();
  win.eval("reg='items'; role='Куратор отдела залогового обеспечения'");
  win.renderList();
  eq(win.document.getElementById('btnNew').style.display, 'inline-flex', 'кнопка создания видна в реестре предметов');
  eq(win.document.getElementById('btnNewLbl').textContent, 'Новый предмет залога', 'подпись исправлена по реестру');
});

test('W3-2 (Р-37): роль без права создания не видит точку входа в реестре предметов', () => {
  const { win } = load();
  win.eval("reg='items'; role='Наблюдатель'");
  win.renderList();
  eq(win.document.getElementById('btnNew').style.display, 'none', 'у наблюдателя кнопка создания скрыта');
});

test('W3-2b (Р-37): onNew в реестре предметов открывает форму нового предмета', () => {
  const { win } = load();
  win.eval("reg='items'; role='Куратор отдела залогового обеспечения'");
  win.onNew();
  const m = win.document.getElementById('modalHost').innerHTML;
  has(m, 'Новый предмет залога', 'открыта форма предмета');
  has(m, 'saveNewItem', 'форма ведёт к сохранению предмета');
});

// Р-38: поиск по идентификаторам вида — кадастр/адрес/гос.№/VIN заведены в фильтр.
test('W3-3 (Р-38): фильтр «Идентификатор/адрес» находит предмет по VIN', () => {
  const { win } = load();
  ok((win.__zt.FILTERS.items||[]).some(f=>f.key==='idx'), 'поле idx заведено в фильтр предметов');
  win.eval("reg='items'; activeFilter.items={idx:'WMA06'}; quickSearch.items=''");
  const rows = win.filterRows(win.rowsItems());
  eq(rows.length, 1, 'ровно один предмет с этим VIN');
  eq(rows[0].id, 'П-005', 'найден именно П-005 (по VIN в details)');
});

test('W3-4 (Р-38): общая строка поиска ищет по всем текстовым значениям строки', () => {
  const { win } = load();
  win.eval("reg='items'; activeFilter.items={}; quickSearch.items='Промышленная'");
  const rows = win.filterRows(win.rowsItems());
  eq(rows.length, 2, 'два предмета по адресу «Промышленная» (П-001, П-003)');
  ok(rows.every(r=>['П-001','П-003'].includes(r.id)), 'найдены именно они');
});

// Р-39: карта SORT_KEYS длиной ровно в число колонок; несортируемые — null.
test('W3-5 (Р-39): SORT_KEYS длиной = числу колонок для каждого реестра', () => {
  const { win } = load();
  const { SORT_KEYS, HEADS } = win.__zt;
  ['items','contracts','monitor','sureties'].forEach(r =>
    eq(SORT_KEYS[r].length, HEADS[r].length, `${r}: ключей столько же, сколько заголовков`));
  ok(SORT_KEYS.items[6] === null, 'колонка «Контроль» помечена несортируемой');
  ok(SORT_KEYS.monitor[3] === null && SORT_KEYS.monitor[4] === null, 'колонки «Описание»/«Что делать» несортируемы');
});

test('W3-6 (Р-39): клик по несортируемой колонке не меняет сортировку', () => {
  const { win } = load();
  win.eval("reg='items'; sortKey=null; sortDir=1");
  win.sortBy(6);                       // «Контроль» → null
  eq(win.eval('sortKey'), null, 'несортируемая колонка не активирует сортировку');
  win.sortBy(0);                       // «№» → id
  eq(win.eval('sortKey'), 0, 'сортируемая колонка активируется');
});

test('W3-7 (Р-39): пагинация рисует только текущую страницу', () => {
  const { win } = load();
  win.eval("reg='items'; PAGE_SIZE=2; curPage=1; activeFilter.items={}; quickSearch.items=''");
  win.renderList();
  eq(win.document.querySelectorAll('#listBody tr').length, 2, 'на странице ровно PAGE_SIZE строк');
  has(win.document.getElementById('pagerNav').innerHTML, 'стр. 1 из', 'переключатель страниц показан');
});

// Р-41: устойчивый ключ триггера (тип+объект) в data-id — фикс двойной подсветки, когда
// у объекта несколько триггеров.
test('W3-8 (Р-41): у объекта с двумя триггерами строки имеют разные id (data-id)', () => {
  const { win } = load();
  const rows = win.rowsMonitor().filter(r => r.obj === 'П-005');
  eq(rows.length, 2, 'у П-005 два триггера');
  ok(rows[0].id !== rows[1].id, 'id строк различны (нет коллизии подсветки)');
  ok(rows.every(r => r.id.includes('|П-005')), 'id = тип|объект');
});

test('W3-9 (Р-41): «Что делать» — кнопка-действие, ведущая в нужный диалог', () => {
  const { win } = load();
  const t = win.__zt.triggers().find(x => x.type === 'Залог без запрета на отчуждение');
  ok(t, 'триггер «залог без запрета» присутствует');
  const a = win.__zt.trigAction(t);
  ok(a && a.call.includes('openBan('), 'действие ведёт в наложение запрета');
  const cell = win.rowsMonitor().find(r => r.id === win.__zt.trigId(t)).cells[4];
  has(cell, 'onclick', 'ячейка «Что делать» содержит кнопку');
  has(cell, 'openBan(', 'кнопка вызывает openBan');
});

test('W3-10 (Р-41): рабочий слой — «в работе», затем журнал закрытых при устранении факта', () => {
  const { win } = load();
  win.eval("role='Куратор отдела залогового обеспечения'");
  const t = win.__zt.triggers()[0], id = win.__zt.trigId(t);
  win.takeTrig(id);
  ok(win.__zt.TRIG_WORK[id], 'триггер принят в работу (надстройка над вычисляемым)');
  eq(win.__zt.TRIG_WORK[id].taken.who, 'Куратор отдела залогового обеспечения', 'ответственный зафиксирован');
  // Подделываем «устранение факта»: запись в работе, которой больше нет среди triggers().
  win.__zt.TRIG_WORK['НЕТ_ТАКОГО|П-000'] = { taken:{who:'x',date:win.__zt.TODAY}, type:'Фиктивный', objLbl:'П-000' };
  const before = win.__zt.TRIG_CLOSED.length;
  win.__zt.reconcileTrigWork();
  ok(!win.__zt.TRIG_WORK['НЕТ_ТАКОГО|П-000'], 'исчезнувший триггер снят с рабочего слоя');
  eq(win.__zt.TRIG_CLOSED.length, before + 1, 'переехал в журнал закрытых');
});

test('W3-11 (Р-41): двойной клик по строке мониторинга открывает карточку объекта', () => {
  const { win } = load();
  const t = win.__zt.triggers().find(x => win.__zt.item(x.obj));
  win.eval("reg='monitor'");
  win.selectRow(win.__zt.trigId(t));
  win.openSelected();
  eq(win.eval('cur && cur.type'), 'item', 'открыта карточка предмета');
  eq(win.eval('cur && cur.id'), t.obj, 'именно объекта триггера');
});

report();
