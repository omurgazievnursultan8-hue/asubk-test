import { load, test, ok, no, eq, near, has, hasNot, report } from './harness-v2.mjs';

/* Тесты пиннят решения целевой модели (ASUBK-zalog-model-v2.md).
   Каждый ссылается на параграф спеки, который он защищает. */

test('S0: файл исполняется, шов __zt доступен', () => {
  const { zt } = load();
  ok(typeof zt.coverage === 'function', 'coverage не в шве');
  ok(typeof zt.gate === 'function', 'gate не в шве');
});

test('§4.1: две базы — знаменатель гейта это сумма кредита, мониторинга — остаток долга', () => {
  const { zt } = load();
  const c = zt.CREDITS.find(x=>x.id==='K1');
  eq(zt.coverage('K1','origination').denom, c.amount, 'база оформления');
  eq(zt.coverage('K1','current').denom, c._debt, 'база мониторинга');
  ok(zt.coverage('K1','current').index > zt.coverage('K1','origination').index,
     'при остатке меньше суммы текущая обеспеченность должна быть выше');
});

test('Н-1: порог — функция состава, а не константа', () => {
  const { zt } = load();
  eq(zt.requiredCover('K1').req, 1.20, 'ликвидный состав → 120%');
  eq(zt.requiredCover('K2').req, 1.50, 'движимое неликвидное в составе → 150%');
  ok(zt.coverage('K2','origination').liquidRuleApplies, 'правило доли ликвида должно включиться при 150%');
});

test('Н-2: решение Кабинета Министров перебивает нормативный порог', () => {
  const { zt } = load();
  const c = zt.CREDITS.find(x=>x.id==='K3');
  const g1 = zt.gate('credit',{credit:c},'K3');
  ok(g1.blocked.some(x=>x.rule.id==='C-03'), 'без реквизитов решения регистрация должна блокироваться');
  eq(g1.blocked.find(x=>x.rule.id==='C-03').rule.admit, null, 'C-03 — без права допуска');
  c.kmDecision = { no:'ПКМ-2026/118', ratio:1.0 };
  eq(zt.requiredCover('K3').req, 1.0, 'порог берётся из решения');
  no(zt.gate('credit',{credit:c},'K3').blocked.some(x=>x.rule.id==='C-03'), 'после внесения реквизитов блок снят');
});

test('§4.2: один индекс, коэффициент по подтипу; поручительство при k=0 не покрывает', () => {
  const { zt } = load();
  eq(zt.PARAMS.k['поручительство'], 0, 'демо-настройка: поручительство отключено');
  const cv = zt.coverage('K5','origination');
  ok(cv.parts.surety.length > 0, 'договор поручительства должен быть в составе');
  eq(cv.numSurety, 0, 'вклад поручительства при k=0 равен нулю');
  // включаем — механизм должен заработать без правки кода
  zt.PARAMS.k['поручительство'] = 0.5;
  ok(zt.coverage('K5','origination').numSurety > 0, 'при k>0 поручительство входит в индекс');
});

test('Н-3: банковская гарантия — запас 120% в иной валюте', () => {
  const { zt } = load();
  const g = zt.coverage('K4','origination').parts.guarantee[0];
  ok(g, 'гарантия должна быть в составе K4');
  eq(g.need, 1.20, 'валюта гарантии USD ≠ валюта кредита KGS → запас 120%');
  near(g.effective, g.kgs/1.2, 'вклад = сумма ÷ требуемый запас');
});

test('§3.2: переоценка вниз роняет вклад, но НЕ трогает веса (нет обрезки effShare)', () => {
  const { zt } = load();
  const alloc = zt.ALLOC.find(a=>a.assetId==='A3');
  eq(alloc.weight, 1.00, 'вес до переоценки');
  const before = zt.pledgeValue('A3','2026-03-20');   // по первой оценке
  const after  = zt.pledgeValue('A3');                 // после переоценки вниз
  ok(after < before, 'стоимость должна упасть');
  eq(zt.ALLOC.find(a=>a.assetId==='A3').weight, 1.00, 'вес после переоценки не изменился');
});

test('§3.2: инвариант Σ весов ≤ 1 считается по активу', () => {
  const { zt } = load();
  near(zt.weightSum('A1'), 0.90, 'A1 распределён на два кредита');
  eq(zt.weightSum('A2'), 1.00, 'A2 отнесён целиком');
});

test('Н-12: применённая залоговая не может быть выше расчётной', () => {
  const { zt } = load();
  zt.VALUATIONS.push({ id:'VX', assetId:'A5', date:'2026-07-01', appraisal:10000000,
    appraiser:'т', lic:'т', report:'т', override:99000000 });
  const calc = 10000000 * 0.70;
  eq(zt.pledgeValue('A5'), calc, 'подъём выше расчётной игнорируется');
});

test('Н-4: правила стоп-листа без права допуска не пропускаются ни при какой роли', () => {
  const { zt } = load();
  const a01 = zt.RULES.find(r=>r.id==='A-01');
  eq(a01.admit, null, 'земли с/х — без права допуска');
  const a02 = zt.RULES.find(r=>r.id==='A-02');
  eq(a02.admit, null, 'износ ≥ предела — без права допуска');
  const g = zt.gate('asset',{ asset:zt.ASSETS.find(a=>a.id==='A8') }, 'A8');
  ok(g.blocked.some(x=>x.rule.id==='A-02'), 'износ 74% при пределе 70% должен блокировать');
  zt.setRole('committee');
  ok(zt.gate('asset',{ asset:zt.ASSETS.find(a=>a.id==='A8') }, 'A8').blocked.some(x=>x.rule.id==='A-02'),
     'комитет не может допустить правило без права допуска');
});

test('§5.2: чужие обременения ловятся одним запросом по типу', () => {
  const { zt } = load();
  const g = zt.gate('asset',{ asset:zt.ASSETS.find(a=>a.id==='A3') }, 'A3');
  ok(g.results.some(r=>r.rule.id==='A-09' && r.fired), 'налоговый арест должен сработать в A-09');
});

test('§5.1: четыре ортогональные оси, все выводятся', () => {
  const { zt } = load();
  const ax = zt.axesOf('A2');
  eq(Object.keys(ax).length, 4, 'ровно четыре оси');
  has(ax['Правовое состояние'], 'отметка не получена', 'ось правового состояния выводится из журнала обременений');
  eq(ax['Расчётная задействованность'], 'отнесён полностью');
});

test('Н-6: периодичность обследования — матрица «платёжеспособность × движимость», не вид залога', () => {
  const { zt } = load();
  eq(zt.surveyInterval('A1').months, 36, 'платёжеспособный + недвижимое = 36 мес.');
  eq(zt.surveyInterval('A3').months, 12, 'неплатёжеспособный + движимое = 12 мес.');
});

test('§6.1: гейт и кнопка используют один вызов — регистрация при блоке не проходит', () => {
  const { zt } = load();
  const g3 = zt.AGREEMENTS.find(a=>a.id==='G3');
  eq(g3.stage, 'проект');
  zt.ACT.register('G3');
  eq(g3.stage, 'проект', 'договор с незавершённым маршрутом не должен зарегистрироваться');
});

test('Н-14: маршрут ровно из 6 шагов и он гейтует регистрацию', () => {
  const { win, zt } = load();
  eq(win.eval('DOC_ROUTE.length'), 6);
  const g = zt.gate('agreement',{ agr:zt.AGREEMENTS.find(a=>a.id==='G3') },'G3');
  ok(g.blocked.some(x=>x.rule.id==='D-01'), 'незавершённый маршрут блокирует');
});

test('Н-17: возраст поручителя вне 18–70 блокирует без права допуска', () => {
  const { zt } = load();
  const g6 = zt.AGREEMENTS.find(a=>a.id==='G6');   // поручитель 1954 г.р. → 72 года
  const g = zt.gate('agreement',{ agr:g6 },'G6');
  const hit = g.blocked.find(x=>x.rule.id==='D-02');
  ok(hit, 'возраст должен блокировать');
  eq(hit.rule.admit, null, 'без права допуска');
});

test('§6.3: допуск фиксируется в едином журнале и снимает блок', () => {
  const { zt } = load();
  const a4 = zt.ASSETS.find(a=>a.id==='A4');       // ТМЦ без полиса, допуск уже выдан в демо
  const g = zt.gate('asset',{ asset:a4 }, 'A4');
  const r = g.results.find(x=>x.rule.id==='A-05');
  ok(r.fired, 'правило о страховании должно сработать');
  ok(r.admission, 'должен найтись допуск в журнале');
  no(r.blocking, 'допуск снимает блокировку');
  eq(r.admission.pv, 'v2025-12', 'допуск хранит версию параметров (§6.2)');
});

test('§5.1: дефекты вычисляются, а не хранятся флагами', () => {
  const { zt } = load();
  const d = zt.defects();
  ok(d.some(x=>x.t.includes('отметка в оригиналах не получена')), 'A2: запрет без отметки');
  ok(d.some(x=>x.t.includes('решения Кабинета Министров')), 'K3: нет реквизитов решения КМ');
  // снимаем причину — дефект должен исчезнуть без какой-либо записи «снять флаг»
  zt.CREDITS.find(c=>c.id==='K3').kmDecision = { no:'ПКМ-1', ratio:1.0 };
  no(zt.defects().some(x=>x.t.includes('решения Кабинета Министров')), 'дефект исчезает сам');
});

test('§7.7: замена — одна транзакция; при просрочке блок без права допуска', () => {
  const { zt } = load();
  const r01 = zt.RULES.find(r=>r.id==='R-01');
  eq(r01.admit, null, 'замена при просрочке — без права допуска');
  const g = zt.gate('replace',{ credit:zt.CREDITS.find(c=>c.id==='K2'),
    form:{ deptConsent:true, dakOpinion:true, inValue:1, outValue:1, inLiquid:true, outLiquid:true } }, 'A3');
  ok(g.blocked.some(x=>x.rule.id==='R-01'), 'K2 в просрочке → замена запрещена');
});

test('Н-8: акт обследования без фотофиксации и подписей не принимается', () => {
  const { zt } = load();
  const g = zt.gate('survey',{ asset:zt.ASSETS.find(a=>a.id==='A1'),
    form:{ outcome:'проведено', conclusion:'ок', photos:false, oneSided:false } }, 'A1');
  ok(g.blocked.some(x=>x.rule.id==='S-02'), 'нет фотофиксации');
  ok(g.blocked.some(x=>x.rule.id==='S-04'), 'нет подписей');
  const g2 = zt.gate('survey',{ asset:zt.ASSETS.find(a=>a.id==='A1'),
    form:{ outcome:'не состоялось', conclusion:'доступ не предоставлен', photos:false } }, 'A1');
  eq(g2.blocked.length, 0, 'исход «не состоялось» — полноценный результат, фотофиксация не требуется');
});

test('Н-10: снятие запрета требует цепочки из 4 согласований', () => {
  const { win } = load();
  eq(win.eval('RELEASE_CHAIN.length'), 4);
  eq(win.eval('RELEASE_GROUNDS.length'), 11, 'классификатор оснований — 11 позиций');
});

test('§6.1: интерфейс печатает формулировку правила, а не хардкод порога', () => {
  const { win, html } = load();
  win.eval('VIEW={name:"credit",id:"K2",tab:"gate"}; render();');
  const h = html();
  has(h, 'Индекс обеспеченности ниже требуемого порога', 'формулировка берётся из RULES');
  has(h, '150,0%', 'печатается порог состава, а не «120%»');
  has(h, 'Н-1 · Прил.1', 'печатается пункт норматива из записи правила');
});

test('§9: остаток долга читается через контракт, а не хранится в модуле', () => {
  const { win, zt } = load();
  eq(win.eval('typeof EXT.debtBalance'), 'function');
  const before = zt.coverage('K1','current').index;
  zt.CREDITS.find(c=>c.id==='K1')._debt = 5000000;   // «кредитный модуль» пересчитал
  ok(zt.coverage('K1','current').index > before, 'индекс пересчитался на лету, снимок не читается');
});

report();
