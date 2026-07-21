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

// К-95 (Р-10 demo) обеспечен ТОЛЬКО банковской гарантией (Д-008 без залоговых долей).
// До Р-11 это форсировалось mirror-хаком `ok: other ? true : ...`; теперь ok должен
// вытекать из реального idxGuar>=1, а не из голого наличия otherSecurity.
test('R11-9: К-95 обеспечен банковской гарантией — реальный индекс, не mirror-хак', () => {
  const { zt } = load();
  const cs = zt.CONTRACTS.filter(c=>c.status==='Зарегистрирован');
  const row = zt.coverage(cs, 'К-95');
  ok(row.gReq !== null, 'гарантия распознана — gReq не null');
  ok(row.idxGuar >= 1, 'гарантия покрывает кредит на >=100% (К-95, amount=120000)');
  eq(row.ok, true, 'кредит обеспечен гарантией');
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

report();
