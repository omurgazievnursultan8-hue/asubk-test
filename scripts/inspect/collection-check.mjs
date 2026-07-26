// Проверка мокапа взыскания (mockups/collection/collection.html) на jsdom.
// Модель: М-1 требование · М-2 фаза-свёртка · М-4 долг-проекция · М-5 цели меры ·
// М-9 производное закрытие · М-11 состояния по природе.
// Спецификация: mockups/collection/ASUBK-vzyskanie-logika.md; ADR: docs/adr/0002…0004.
// Запуск: node scripts/inspect/collection-check.mjs
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const HTML = readFileSync(resolve('mockups/collection/collection.html'), 'utf8');

/* Свежий DOM на каждый мутирующий тест: openDetail/сторно/окно меняют глобальное состояние. */
function mk(){
  const errs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errs.push('jsdomError: ' + (e.detail?.message || e.message)));
  /* url задаёт неопальный origin — без него jsdom бросает SecurityError на
     любом реальном обращении к localStorage (нужен тестам персиста). */
  const dom = new JSDOM(HTML, { runScripts:'dangerously', virtualConsole:vc, url:'http://localhost/' });
  const w = dom.window, doc = w.document;
  const ev = s => w.eval(s);
  const $  = s => doc.querySelector(s);
  const $$ = s => [...doc.querySelectorAll(s)];
  const active = () => doc.querySelector('#detailPanels .detail-panel.active');
  const setRole = r => { doc.getElementById('roleSel').value = r; };
  return { dom, w, doc, ev, $, $$, active, setRole, errs };
}

let fails = 0, n = 0;
const ok   = (name, cond) => { n++; if(!cond) fails++; console.log(`${cond?'  ok':'FAIL'}  ${name}`); };
const head = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 62 - t.length)));

const g = mk();                        // общий DOM для read-only проверок
const R = id => `REQ_INDEX['${id}']`;
const P = id => `PROCESSES.find(x=>x.id==='${id}')`;
/* Вкладки карточки: 0…3 — дело, 4…9 — требование (Журнал мер = 6, Долг = 5). */
const TAB = { deal:0, procedure:1, komitety:2, history:3, req:4, debt:5, mery:6, sud:7, special:8, zalog:9 };

/* ══════════════════════════════════════════════════════════════════════════
   М-1 (ADR-0002) — ЕДИНИЦА РАБОТЫ: требование = дело × кредит × обязанное лицо
   ══════════════════════════════════════════════════════════════════════════ */
head('М-1 · требование — единица работы');
ok('требований больше, чем дел',            g.ev('allReqs().length') > g.ev('PROCESSES.length'));
ok('индекс требований полон и без коллизий', g.ev('Object.keys(REQ_INDEX).length') === g.ev('allReqs().length'));
ok('id требования = дело/кредит/роль',
   g.ev(`allReqs().every(r => r.id === r.proc+'/'+r.credit+'/'+({'заёмщик':'з','поручитель':'п','гарант':'г'}[r.role]))`));
ok('у каждого требования есть кредит и обязанное лицо',
   g.ev(`allReqs().every(r => !!r._credit && !!PERSONS[r.obligor])`));
ok('пара (кредит × лицо) в деле уникальна',
   g.ev(`PROCESSES.every(p => new Set(p.requirements.map(r=>r.credit+'|'+r.obligor)).size === p.requirements.length)`));
ok('по каждому кредиту дела есть требование к заёмщику',
   g.ev(`PROCESSES.every(p => p.credits.every(c => p.requirements.some(r => r.credit===c.id && r.role==='заёмщик')))`));
ok('охват — свойство требования',            g.ev(`allReqs().every(r => typeof r.scope === 'string')`));
ok('ведущее подразделение — на требовании',  g.ev(`allReqs().every(r => !!r.subdivision)`));
ok('дело 142 — два требования по одному договору',
   g.ev(`${P('142')}.requirements.map(r=>r.role).join(',')`) === 'заёмщик,поручитель');
ok('солидарный сосед заёмщика — поручитель',
   g.ev(`solidaryWith(${R('142/56/з')}).map(r=>r.id).join(',')`) === '142/56/п');
ok('дело 402 — три требования по трём договорам',
   g.ev(`new Set(${P('402')}.requirements.map(r=>r.credit)).size`) === 3);
ok('дело — только папка: своей фазы / охвата / суммы у него нет',
   g.ev(`PROCESSES.every(p => !('phase' in p) && !('contour' in p) && !('claim' in p) && !('debt' in p))`));
ok('в данных дела нет полей cat / catDays / stage',
   g.ev(`PROCESSES.some(p => 'cat' in p || 'catDays' in p || 'stage' in p)`) === false);

/* ══════════════════════════════════════════════════════════════════════════
   М-2 (ADR-0003) — ФАЗА = СВЁРТКА ЖУРНАЛА МЕР ТРЕБОВАНИЯ
   ══════════════════════════════════════════════════════════════════════════ */
head('М-2 · фаза — свёртка журнала');
ok('хранимого поля фазы нет ни на одном требовании',
   g.ev(`allReqs().every(r => !('phase' in r) && !('contour' in r))`));
ok('в коде нет присваиваний фазы',              !/\b(p|r|curProc|curReq)\.(phase|contour)\s*=[^=]/.test(HTML));
ok('в карточке нет селектора фазы',             (g.ev("openDetail('142/56/з')"), g.$$('#detailPanels select').length === 0));
ok('фаза меняется только вехой (MILESTONE_PHASE)',
   g.ev(`Object.keys(MILESTONE_PHASE).length>0 && MILESTONE_PHASE['Исковое заявление']==='Иск'`));
ok('у каждого требования фаза определена',      g.ev(`allReqs().every(r => !!phaseOf(r))`));
ok('каждая фаза принадлежит контуру К0…К7',
   g.ev(`allReqs().every(r => phaseOf(r)===OPEN_PHASE || !!contourOfPhase(phaseOf(r)))`));
ok('семь контуров К0…К7 присутствуют',          g.ev(`['К0','К1','К2','К3','К4','К5','К6','К7'].every(k=>k in CONTOURS)`));
ok('безакцепт — условная ветка (CONDITIONAL_PHASE)', g.ev('CONDITIONAL_PHASE') === 'Безакцептное списание');
ok('без вех — фаза открытия',
   g.ev(`allReqs().filter(r => !liveMilestones(r).length).every(r => phaseOf(r)===OPEN_PHASE)`));
ok('с вехами — фаза последней вехи',
   g.ev(`allReqs().filter(r => liveMilestones(r).length)
          .every(r => phaseOf(r) === MILESTONE_PHASE[liveMilestones(r).slice(-1)[0].kind])`));
ok('у непустой фазы всегда есть мера-основание',
   g.ev(`allReqs().filter(r => phaseOf(r)!==OPEN_PHASE).every(r => !!phaseSetter(r))`));
ok('stageOf даёт одну из четырёх стадий',
   g.ev(`['Досудебный порядок','Судебный порядок','Исполнительное производство','Отчуждение активов'].includes(stageOf('На исполнении'))`)
   && g.ev(`stageOf('Иск')`) === 'Судебный порядок');
ok('стадия дела = worst-of по требованиям',
   g.ev(`PROCESSES.every(p => stageOfProc(p) === p.requirements.reduce((s,r)=> STAGE_RANK[stageOfReq(r)]>STAGE_RANK[s]?stageOfReq(r):s,'Досудебный порядок'))`));
ok('142/56/з — Иск, контур К3, судебная стадия',
   g.ev(`phaseOf(${R('142/56/з')})`) === 'Иск' && g.ev(`contourOf(${R('142/56/з')})`) === 'К3'
   && g.ev(`stageOfReq(${R('142/56/з')})`) === 'Судебный порядок');
ok('201/311/з — мер нет → фаза открытия, контур К0',
   g.ev(`phaseOf(${R('201/311/з')})`) === 'Досудебное урегулирование' && g.ev(`contourOf(${R('201/311/з')})`) === 'К0');
ok('Р-7 · веха с более поздней датой побеждает позицию в массиве', mk().ev(`(() => {
  const r = REQ_INDEX['142/56/з'];
  r._proc.measures.unshift({sec:'Исполнительное', kind:'Постановление на исполнении',
    dates:{event:'01.07.2026', received:'01.07.2026', registered:'01.07.2026'}, num:'ТЕСТ-1', targets:[r.id]});
  return phaseOf(r);
})()`) === 'На исполнении');
{ const m = mk(); m.ev(`openDetail('206/62/з')`); m.ev(`switchTab(${TAB.mery})`);
  ok('таймлайн К6 показывает три шага банкротства', m.active().querySelectorAll('.tl-step').length === 3); }
{ const a = mk(), b = mk();
  a.ev(`openDetail('204/314/з')`); a.ev(`switchTab(${TAB.mery})`);
  b.ev(`openDetail('205/315/з')`); b.ev(`switchTab(${TAB.mery})`);
  ok('безакцепт в таймлайне только при праве договора (204 да, 205 нет)',
     /Безакцептное списание/.test(a.active().querySelector('.timeline').textContent)
     && !/Безакцептное списание/.test(b.active().querySelector('.timeline').textContent)); }
for(const ph of ['Ликвидация юр. лица','Приговор суда','Решение суда (умерший / отсутствующий / недееспособный)'])
  ok(`К7 · фаза «${ph}» — веха и встречается в данных`,
     g.ev(`!!PHASE_MILESTONE[${JSON.stringify(ph)}] && allReqs().some(r=>phaseOf(r)===${JSON.stringify(ph)})`));

/* ══════════════════════════════════════════════════════════════════════════
   Р-5 — КАТЕГОРИЯ РИСКА НА КРЕДИТЕ, worst-of вверх
   ══════════════════════════════════════════════════════════════════════════ */
head('Р-5 · категория риска');
ok('catOfCredit → «высокий» при нуле дней и факторе high (209)',
   g.ev(`catOfCredit(${P('209')}.credits[0]).level`) === 'high');
ok('подавление 181-го применяется до worst-of (210)',
   g.ev(`catOfCredit(${P('210')}.credits[0]).suppressed`) === true
   && g.ev(`catOfCredit(${P('210')}.credits[0]).daysEff`) === 'mid');
ok('категория дела = worst-of по кредитам (210 → mid)', g.ev(`catOfProcess(${P('210')})`) === 'mid');
ok('категория требования берётся у его кредита',
   g.ev(`catOfReq(${R('210/70/з')})`) === g.ev(`catLevelOfCredit(${P('210')}.credits[0])`));
{ const m = mk(); m.ev(`openDetail('210/70/з')`); m.ev('catOpen=false; toggleCat()');
  ok('раскрытие показывает входы покредитно (2 кредита + worst-of)',
     m.active().querySelectorAll('.cat-expand .row').length === 3);
  ok('честная категория видна при подавлении («подавлен»)',
     /подавлен/.test(m.active().querySelector('.cat-expand').textContent)); }
ok('сортировка по категории идёт по тяжести (rank), не по алфавиту',
   g.ev(`sortVal(${R('209/56b/з')},'cat')`) === g.ev('CAT_RANK.high'));

/* ══════════════════════════════════════════════════════════════════════════
   М-4 (ADR-0004) — ДОЛГ ЕСТЬ ПРОЕКЦИЯ LEDGER, А НЕ ХРАНИМАЯ СУММА
   ══════════════════════════════════════════════════════════════════════════ */
head('М-4 · долг — проекция снимка модуля кредита');
ok('в данных не осталось c.debt / c.claim',
   g.ev(`PROCESSES.every(p => p.credits.every(c => !('debt' in c) && !('claim' in c)))`));
ok('в коде не осталось литералов debt:{ / claim:\'',   !/\bdebt:\{|\bclaim:'/.test(HTML));
ok('LEDGER есть по каждому кредиту требования',        g.ev(`allReqs().every(r => !!LEDGER[r.credit])`));
ok('у снимка есть дата среза',                         g.ev(`allReqs().every(r => debtOf(r).asOf !== '—')`));
ok('пять статей долга: четыре корзины LEDGER + расходы взыскания',
   g.ev('LEDGER_BUCKETS.length') === 4 && g.ev(`'costs' in DEBT_LABELS`));
ok('claim = востребованное по статьям + расходы',
   g.ev(`allReqs().every(r => { const d=debtOf(r);
     return Math.abs(d.claim - (d.rows.reduce((s,x)=>s+x.claimable,0) + d.costs)) < 0.005; })`));
ok('охват «просроченная сумма» — востребовано меньше остатка',
   g.ev(`claimOf(${R('142/56/з')})`) === 48900 && g.ev(`debtOf(${R('142/56/з')}).totalLeft`) === 152300);
ok('охват «полный остаток» — востребован весь остаток',
   g.ev(`allReqs().filter(r=>r.scope==='полный остаток').every(r=>{const d=debtOf(r);return Math.abs(d.claim-d.totalLeft)<0.005;})`));
ok('расходы — статья требования, у кредита их нет',
   g.ev(`allReqs().some(r=>(r.costs||[]).length) && PROCESSES.every(p=>p.credits.every(c=>!('costs' in c)))`));
ok('смена охвата меняет проекцию, снимок не трогает', mk().ev(`(() => {
  const r = REQ_INDEX['142/56/з'], before = claimOf(r), snap = JSON.stringify(LEDGER[r.credit]);
  r.scope = 'полный остаток';
  return before === 48900 && claimOf(r) === 152300 && JSON.stringify(LEDGER[r.credit]) === snap;
})()`));
ok('§2.2 · агрегат по делу считается один раз на кредит',
   g.ev(`claimTotal(${P('142')}.requirements)`) === 48900);
ok('§2.2 · солидарная строка показывает полную сумму',
   g.ev(`claimOf(${R('142/56/п')})`) === g.ev(`claimOf(${R('142/56/з')})`));
ok('§2.2 · по многокредитному делу суммы кредитов складываются',
   g.ev(`claimSum(${P('402')})`) === g.ev(`${P('402')}.requirements.reduce((s,r)=>s+claimOf(r),0)`));
ok('расход увеличивает сумму требования и не задевает солидарного соседа', mk().ev(`(() => {
  openDetail('142/56/з'); const before = claimOf(curReq);
  openCostModal();
  document.getElementById('costAmount').value = '1 000,00';
  document.getElementById('costKind').value = 'Государственная пошлина';
  saveCost();
  return claimOf(curReq) === before + 1000 && claimOf(REQ_INDEX['142/56/п']) === before;
})()`));
{ const m = mk(); m.ev(`openDetail('104/71/з')`); m.ev(`switchTab(${TAB.debt})`);
  ok('п. 49 · строка возврата залогодателю при реализации залога (104)',
     /Возврат залогодателю/.test(m.active().textContent));
  ok('п. 33 · непокрытый остаток назван пунктом (104)', /п\. 33/.test(m.active().textContent)); }

/* ══════════════════════════════════════════════════════════════════════════
   М-5 — МЕРА ХРАНИТСЯ НА ДЕЛЕ И ЦЕЛИТ В ТРЕБОВАНИЯ (п. 32: один иск ко всем)
   ══════════════════════════════════════════════════════════════════════════ */
head('М-5 · цели меры');
ok('у каждой меры есть непустой targets',
   g.ev(`PROCESSES.every(p => p.measures.every(m => Array.isArray(m.targets) && m.targets.length))`));
ok('цели меры — требования своего дела',
   g.ev(`PROCESSES.every(p => { const ids=new Set(p.requirements.map(r=>r.id));
     return p.measures.every(m => m.targets.every(t => ids.has(t))); })`));
ok('журнал требования = меры, целящие в него',
   g.ev(`allReqs().every(r => measuresOf(r).every(m => m.targets.includes(r.id)))`));
ok('иск ИСК-77 подан к обоим ответчикам → фаза «Иск» у обоих',
   g.ev(`${P('142')}.measures.find(m=>m.num==='ИСК-77').targets.length`) === 2
   && g.ev(`phaseOf(${R('142/56/п')})`) === 'Иск');
ok('требование поручителю двигает только его требование',
   g.ev(`${P('142')}.measures.find(m=>m.num==='ТП-56').targets.join(',')`) === '142/56/п');
ok('три оси результата независимы (142 иск: result / resultKind / execStage)', g.ev(`(()=>{
  const m = ${P('142')}.measures.find(x=>x.kind==='Исковое заявление');
  return !!m.result.group && !!m.resultKind && !!m.execStage && m.resultKind!==m.execStage;
})()`));
{ const m = mk(); m.setRole('Отдел проблемных кредитов (ОПК)');
  ok('мера на две цели считает сумму один раз на кредит (§2.2)', m.ev(`(() => {
    openDetail('142/56/з'); liftPause();                 // снимаем паузу требования, иначе гейт
    openMeasureModal();
    document.getElementById('mKind').value = 'Апелляционная жалоба';
    document.querySelectorAll('.mTgt').forEach(x => x.checked = true);
    syncMeasureWarnings();
    if(document.getElementById('mSave').disabled) return false;
    saveMeasure();
    const m = curProc.measures[0];
    return m.targets.length === 2 && parseSum(m.sum) === 48900;
  })()`)); }

/* ══════════════════════════════════════════════════════════════════════════
   М-9 — ЗАКРЫТИЕ ПРОИЗВОДНОЕ: кнопки «Закрыть» нет, сироты невозможны
   ══════════════════════════════════════════════════════════════════════════ */
head('М-9 · закрытие производное');
ok('хранимого исхода нет ни на деле, ни на требовании',
   g.ev(`PROCESSES.every(p => !('outcome' in p) && !('closed' in p)) && allReqs().every(r => !('outcome' in r))`));
ok('в интерфейсе нет кнопки закрытия',            !/>Закрыть (дело|требование|процесс)</.test(HTML));
ok('все четыре терминала объявлены',
   g.ev(`['Полное погашение','Признана безнадёжной','Списана','Завершена процедура банкротства'].every(o=>TERMINAL_OUTCOMES.has(o))`));
ok('исход требования = терминальная веха либо нулевой остаток',
   g.ev(`allReqs().every(r => { const o=outcomeOf(r); if(!o) return true;
     return liveMeasuresOf(r).some(m=>TERMINAL_BY_MEASURE[m.kind]===o) || debtOf(r).totalLeft <= 0; })`));
ok('дело закрыто ⟺ закрыты все его требования',
   g.ev(`PROCESSES.every(p => !!outcomeOfProc(p) === p.requirements.every(isClosedReq))`));
ok('сироты нет: у открытого требования всегда есть остаток',
   g.ev(`allReqs().filter(r=>!isClosedReq(r)).every(r => debtOf(r).totalLeft > 0)`));
ok('нулевой остаток закрывает требование сам',
   g.ev(`allReqs().filter(r => debtOf(r).totalLeft <= 0).every(isClosedReq)`));
ok('исход дела — сильнейший из исходов требований',
   g.ev(`PROCESSES.filter(outcomeOfProc).every(p => outcomeOfProc(p) ===
     p.requirements.map(outcomeOf).sort((a,b)=>TERMINAL_RANK[b]-TERMINAL_RANK[a])[0])`));
ok('закрытых требований 20, закрытых дел 20',
   g.ev(`allReqs().filter(isClosedReq).length`) === 20 && g.ev(`PROCESSES.filter(isClosed).length`) === 20);
ok('Р-9 · ретро-закрытое дело скрыто из списка по умолчанию',
   g.ev(`baseSet().some(r => r.proc==='203')`) === false);
ok('группа дела выводится из подтверждённой процедуры (208 → 5)', g.ev(`groupOf(${P('208')})`) === '5');
ok('группа не выведена при неподтверждённой процедуре (210)',     g.ev(`groupOf(${P('210')})`) === null);

/* ══════════════════════════════════════════════════════════════════════════
   М-11 — СОСТОЯНИЯ ПО ПРИРОДЕ: обязательство · лицо · ведение дела
   ══════════════════════════════════════════════════════════════════════════ */
head('М-11 · состояния по природе');
ok('состояния обязательства живут на требовании',   g.ev(`allReqs().every(r => Array.isArray(r.states))`));
ok('пауза 142 стоит на требовании заёмщика, не на поручителе',
   g.ev(`!!pausedState(${R('142/56/з')})`) && g.ev(`!pausedState(${R('142/56/п')})`));
ok('оверлей подменяет надпись фазы, саму фазу не трогает',
   g.ev(`displayPhase(${R('142/56/з')})`) === 'Рассмотрение вопроса реструктуризации'
   && g.ev(`phaseOf(${R('142/56/з')})`) === 'Иск');
ok('состояние лица не привязано к обязательству',
   g.ev(`PERSONS['п-142'].state.type`) === 'address_unknown' && g.ev(`!PERSONS['b-01912201610212'].state`));
ok('состояние лица не приостанавливает меры',
   g.ev(`!measureGate(${R('142/56/п')}, 'Акт сверки')`));
ok('состояние ведения дела живёт на деле (конфликт, окно)',
   g.ev(`!!${P('205')}.conflict && !!${P('201')}.window`));
ok('таблица состояний даёт уровень лица', mk().ev(`(() => {
  openDetail('142/56/п'); return stateRows(curReq).join('').includes('lvl-person');
})()`));
ok('таблица состояний даёт уровень ведения дела', mk().ev(`(() => {
  openDetail('205/315/з'); return stateRows(curReq).join('').includes('lvl-deal');
})()`));
ok('таблица состояний даёт уровень обязательства', mk().ev(`(() => {
  openDetail('142/56/з');
  return stateRows(curReq).join('').includes('lvl-req');
})()`));
ok('соглашение ложится на требование и солидарных соседей', mk().ev(`(() => {
  openDetail('142/56/з');
  const a = { type:'dobrovolnoe', num:'ТЕСТ-СДИ', breached:false };
  attachAgreementState(a, curReq);
  return REQ_INDEX['142/56/з'].states.some(s=>s.agreement===a)
      && REQ_INDEX['142/56/п'].states.some(s=>s.agreement===a);
})()`));
ok('пауза ставится и снимается на требовании', mk().ev(`(() => {
  openDetail('201/311/з');
  openPauseModal();
  document.getElementById('pauseType').value = 'Гарантийное письмо (п. 18)';
  document.getElementById('pauseFrom').value = '2026-07-21';
  document.getElementById('pauseUntil').value = '2026-08-20';
  savePause();
  const on = !!pausedState(curReq) && measureGate(curReq,'Повторная претензия').kind === 'pause';
  liftPause();
  return on && !pausedState(curReq);
})()`));
ok('нарушение соглашения гасит состояние, не удаляя его', mk().ev(`(() => {
  openDetail('120/40/з');
  const a = curProc.agreements.find(x=>x.type==='dobrovolnoe');
  const before = curReq.states.filter(s=>s.agreement===a).length;
  a.breached = true; msSyncStates(a);
  return before === 1 && curReq.states.filter(s=>s.agreement===a).length === 1
      && curReq.states.find(s=>s.agreement===a).active === false;
})()`));

/* ══════════════════════════════════════════════════════════════════════════
   ГЕЙТЫ — на уровне требования; гейта «пересечение» больше нет
   ══════════════════════════════════════════════════════════════════════════ */
head('гейты регистрации');
ok('закрытое требование мер не регистрирует',
   g.ev(`measureGate(${R('208/50/з')}, 'Повторная претензия').kind`) === 'closed');
ok('окно ожидания блокирует первичную претензию',
   g.ev(`measureGate(${R('201/311/з')}, 'Первичная претензия').kind`) === 'window'
   && /Окно ожидания/.test(g.ev(`measureGate(${R('201/311/з')}, 'Первичная претензия').reason`)));
ok('окно ожидания не блокирует прочие виды',
   g.ev(`!measureGate(${R('201/311/з')}, 'Служебная записка в ДПО')`));
ok('окно нигде не превышает 14 к.д.',   g.ev(`PROCESSES.every(p => !p.window || p.window.days <= 14)`));
ok('отстранение куратора блокирует всё по делу',
   g.ev(`measureGate(${R('205/315/з')}, 'Повторная претензия').kind`) === 'conflict');
ok('пауза требования блокирует только его',
   g.ev(`measureGate(${R('142/56/з')}, 'Акт сверки').kind`) === 'pause'
   && g.ev(`!measureGate(${R('142/56/п')}, 'Акт сверки')`));
ok('безакцепт заблокирован без решения комитета (204)',
   g.ev(`gateReason(${R('204/314/з')}, 'Безакцептное списание')`) !== null);
{ const m = mk(); m.setRole('Отдел проблемных кредитов (ОПК)');
  ok('иск заблокирован без поручения Председателя (204, роль ОПК)',
     /поручени/i.test(m.ev(`gateReason(${R('204/314/з')}, 'Исковое заявление')`))); }
{ const m = mk(); m.setRole('Отдел проблемных кредитов (ОПК)');
  ok('пройденная веха не регистрируется повторно (142 уже на фазе «Иск»)',
     m.ev(`measureGate(${R('142/56/п')}, 'Исковое заявление').kind`) === 'sequence'); }
{ const m = mk(); m.setRole('Отраслевой департамент (ОД)');
  ok('В-9 · извещение недоступно отраслевому департаменту (полномочие ДПО)',
     /ДПО/.test(m.ev(`subdivReason('Извещение об обращении на залог')`))); }
ok('каждый гейт называет причину и пункт',
   g.ev(`Object.keys(GATES).every(k => { const r = gateReason(${R('204/314/з')}, k); return r===null || /п\\. /.test(r); })`));
ok('внесудебный порядок недоступен для имущественного комплекса (жёсткая блокировка)',
   g.ev(`${P('104')}.colls.some(c => /имущественный комплекс/.test(c.ban))`));
ok('гейта «пересечение» в коде нет',   !/crossingOnCourt/.test(HTML));
ok('закрытие окна отметкой открывает гейт', mk().ev(`(() => {
  openDetail('201/311/з'); closeWindowMark();
  return curProc.window.open === false && !measureGate(curReq, 'Первичная претензия');
})()`));
ok('кнопок назначения / переназначения / продления заданий нет',
   (g.ev(`openDetail('201/311/з')`), !/Назначить исполнителя|Переназначить|Продлить срок/i.test(g.$('#detailPanels').textContent)));
{ const m = mk(); m.ev(`openDetail('104/71/з')`); m.ev('openRejectProc()');
  ok('чек-лист структурный: отклонение перечисляет 7 позиций (п. 20.2)', m.$$('#modalHost .rejChk').length === 7); }

/* ══════════════════════════════════════════════════════════════════════════
   СРОКИ — Р-3: вычисление от базы шаблона, сущности «задание» нет
   ══════════════════════════════════════════════════════════════════════════ */
head('Р-3 · сроки порядка');
ok('шаблонов сроков 39, у каждого база и пункт',
   g.ev('DEADLINE_TEMPLATES.length') === 39 && g.ev(`DEADLINE_TEMPLATES.every(t => t.base && t.point)`));
ok('остаток срока считается от базы шаблона, не от даты ввода (142 апелляция)',
   g.ev(`${P('142')}.deadlines[0].base`).includes('вынесения'));

/* ══════════════════════════════════════════════════════════════════════════
   ИНТЕРАКТИВ — регистрация, сторно, ускорение
   ══════════════════════════════════════════════════════════════════════════ */
head('интерактив');
ok('регистрация вехи двигает фазу свёрткой', mk().ev(`(() => {
  openDetail('201/311/з'); closeWindowMark();
  openMeasureModal();
  document.getElementById('mKind').value = 'Первичная претензия';
  syncMeasureWarnings();
  document.getElementById('mNum').value = 'ТЕСТ-ПР';
  saveMeasure();
  return phaseOf(curReq);
})()`) === 'Претензия');
{ const m = mk(); m.ev(`openDetail('142/56/з')`);
  const before = m.ev('curProc.measures.length');
  const idx = m.ev(`curProc.measures.findIndex(x => x.kind==='Исковое заявление')`);
  m.ev(`openStornoModal(${idx})`); m.$('#stReason').value = 'ошибочная регистрация'; m.ev(`doStorno(${idx})`);
  ok('И-3 · сторно не удаляет строку',
     m.ev('curProc.measures.length') === before && m.ev(`curProc.measures[${idx}].storno != null`));
  ok('сторно иска откатывает фазу обоих ответчиков',
     m.ev(`phaseOf(REQ_INDEX['142/56/з'])`) === 'Повторная претензия'
     && m.ev(`phaseOf(REQ_INDEX['142/56/п'])`) === 'Досудебное урегулирование');
  ok('в журнале дела нет ручного отката — фаза записана как свёртка',
     /свёртк/i.test(m.ev('curProc.history[0].what'))); }
{ const m = mk(); m.ev(`openDetail('142/56/з')`); m.ev(`switchTab(${TAB.mery})`);
  ok('И-1 · сумма документа иммутабельна, расхождение только помечается',
     g.ev(`${P('142')}.measures.find(x=>x.kind==='Исковое заявление').sum`) === '48 900,00'); }
ok('В-8 · пересчёт при извещении выполняется на клике (диалог с новой суммой)', mk().ev(`(() => {
  openDetail('142/56/з'); recalcOnIzveschenie();
  return /пересчита/i.test(document.getElementById('modalHost').textContent);
})()`));
ok('извещение ускоряет охват всех солидарных требований', mk().ev(`(() => {
  openDetail('142/56/з'); applyIzveschenie();
  return REQ_INDEX['142/56/з'].scope === 'полный остаток'
      && REQ_INDEX['142/56/п'].scope === 'полный остаток'
      && claimOf(REQ_INDEX['142/56/з']) === 152300;
})()`));

/* ══════════════════════════════════════════════════════════════════════════
   ЭКРАНЫ — список требований (М-13), карточка (М-14), реестры
   ══════════════════════════════════════════════════════════════════════════ */
head('экраны');
ok('база списка — требования, а не дела',
   g.ev(`(renderList(), baseSet().every(r => !!REQ_INDEX[r.id]))`));
ok('строк-требований столько же, сколько видимых требований',
   g.ev(`document.querySelectorAll('#listBody tr:not(.rowgrp)').length`) === g.ev('visibleReqs().length'));
ok('дело-папка выводится строкой-группой',   g.ev(`document.querySelectorAll('#listBody tr.rowgrp').length`) > 0);
ok('колонок В-11 столько же, сколько в LIST_COLS',
   g.ev(`document.querySelectorAll('#listHead th').length`) === g.ev('LIST_COLS.length'));
ok('у обрезаемых колонок есть title', g.$$('#listBody tr:not(.rowgrp)').every(tr => {
  const t = i => tr.children[i].getAttribute('title');
  return t(1) && t(2) && t(3) && t(5) && t(6);
}));
ok('закрытые требования приглушены классом terminal',
   g.ev(`document.querySelectorAll('#listBody tr.terminal').length`) > 0);
ok('сумма плиток равна «Всего» (истинный partition, P3-R32)', g.ev(`(() => {
  const s = baseSet();
  const sum = ['gate','window','procWait','overdue','closed'].reduce((a,k)=>a + s.filter(r=>listStatus(r)===k).length, 0);
  return s.length > 0 && s.length === sum;
})()`));
ok('фильтр по фазе работает от свёртки', g.ev(`(() => {
  filterState = { phase:'Иск' }; const rows = baseSet(); filterState = {};
  return rows.length > 0 && rows.every(r => phaseOf(r) === 'Иск');
})()`));
ok('фильтр стадии работает от свёртки', g.ev(`(() => {
  stageFilter = 'Исполнительное производство'; const rows = baseSet(); stageFilter = null;
  return rows.length > 0 && rows.every(r => stageOfReq(r) === 'Исполнительное производство');
})()`));
ok('фильтр «Досудебный порядок» не возвращает требование в фазе «Иск»', g.ev(`(() => {
  stageFilter = 'Досудебный порядок'; const has = visibleReqs().some(r => r.id === '142/56/з');
  stageFilter = null; return has;
})()`) === false);
ok('вкладки разделены: 4 дела + 6 требования',
   g.ev('DEAL_TABS.length') === 4 && g.ev('REQ_TABS.length') === 6 && g.ev('TABS.length') === 10);
{ const m = mk(); m.ev(`openDetail('142/56/з')`);
  ok('пять плиток в шапке карточки, все нередактируемые с подписью источника',
     m.active().querySelectorAll('.phead-dims .dim').length === 5
     && m.active().querySelectorAll('.phead-dims input, .phead-dims select').length === 0
     && m.active().querySelectorAll('.phead-dims .dim .src').length === 5); }
ok('счётчик подтверждения процедуры работает (210 — осталось 3 р.д.)',
   /осталось 3 р\.д\./.test(g.ev(`procSourceLabel(${P('210')})`)));
{ const m = mk(); m.ev(`openDetail('210/70/з')`); m.ev('openProcChangeModal()');
  ok('словарь статусов процедуры закрыт (селектор из PROCEDURE_DICT)',
     m.ev('PROCEDURE_DICT.length') >= 8 && m.$$('#newStatus option').length === m.ev('PROCEDURE_DICT.length')); }
ok('карточка открывается по id требования', mk().ev(`(() => {
  openDetail('142/56/п'); return curReq.id === '142/56/п' && curProc.id === '142';
})()`));
ok('карточка по id дела берёт первое требование', mk().ev(`(() => {
  openDetail('142'); return curProc.id === '142' && curReq.id === '142/56/з';
})()`));
ok('все десять панелей рендерятся без ошибок', (() => {
  const s = mk(); s.ev(`openDetail('142/56/з')`);
  for(let i=0;i<10;i++) s.ev(`switchTab(${i})`);
  return s.errs.length === 0;
})());
ok('переключение требования не уводит с карточки', mk().ev(`(() => {
  openDetail('142/56/з'); pickReq('142/56/п');
  return curReq.id === '142/56/п' && document.getElementById('view-detail').style.display === 'flex';
})()`));
ok('хеш переживает кириллический id требования', mk().ev(`(() => {
  openDetail('142/56/п'); return curHash() === 'detail/142/56/п';
})()`));
ok('возврат по хешу открывает то же требование', mk().ev(`(() => {
  openDetail('142/56/п'); showView('list'); location.hash = 'detail/142/56/п'; restoreFromHash();
  return curReq.id === '142/56/п';
})()`));
ok('реестр претензий ведёт на требование-адресат', mk().ev(`(() => {
  renderClaimsRegistry();
  return /openDetail\\('\\d+\\/[^\\/']+\\/[зпг]'\\)/.test(document.getElementById('claimsBody').innerHTML);
})()`));

/* ══════════════════════════════════════════════════════════════════════════
   RULES — единый слой правил, персист, экран настроек
   ══════════════════════════════════════════════════════════════════════════ */
head('RULES · правила и настройки');
ok('RULES.measureSubdiv идентичен литералу MEASURE_SUBDIV',
   g.ev('JSON.stringify(RULES.measureSubdiv)===JSON.stringify(MEASURE_SUBDIV)'));
ok('RULES.sectionClevel идентичен литералу SECTION_CLEVEL',
   g.ev('JSON.stringify(RULES.sectionClevel)===JSON.stringify(SECTION_CLEVEL)'));
ok('RULES.contourPhases.К1 совпадает с CONTOURS.К1.phases',
   g.ev(`JSON.stringify(RULES.contourPhases['К1'])===JSON.stringify(CONTOURS['К1'].phases)`));
ok('phasesOf(К1) читает порядок из RULES',
   g.ev(`phasesOf('К1').join('>')`) === 'Претензия>Повторная претензия>Безакцептное списание');
ok('RULES_DEFAULTS заморожен', g.ev('Object.isFrozen(RULES_DEFAULTS)') === true);
{ const m = mk();
  ok('persistRules пишет ключ RULES_KEY', m.ev(`(()=>{
    RULES.sectionClevel['Досудебный']=3; persistRules();
    return !!localStorage.getItem(RULES_KEY) && JSON.parse(localStorage.getItem(RULES_KEY)).sectionClevel['Досудебный']===3;
  })()`));
  ok('resetRulesAll восстанавливает дефолт', m.ev(`(()=>{
    RULES.sectionClevel['Досудебный']=3; resetRulesAll();
    return RULES.sectionClevel['Досудебный']===RULES_DEFAULTS.sectionClevel['Досудебный'];
  })()`));
  ok('resetRulesSection сбрасывает одну ось', m.ev(`(()=>{
    RULES.gates={}; RULES.sectionClevel['Судебный']=5; resetRulesSection('gates');
    return Object.keys(RULES.gates).length>0 && RULES.sectionClevel['Судебный']===5;
  })()`)); }
{ const m = mk(); m.ev(`showView('settings')`);
  ok('showView(settings) показывает экран и пишет hash',
     m.$('#view-settings').style.display === 'flex' && m.ev('location.hash') === '#settings');
  ok('на экране настроек 4 вкладки', m.$$('#view-settings .settings-tab').length === 4);
  ok('переключение вкладки меняет settingsTab', m.ev(`(()=>{ showSettingsTab('gates'); return settingsTab; })()`) === 'gates');
  const m2 = mk(); m2.w.location.hash = '#settings'; m2.ev('restoreFromHash()');
  ok('restoreFromHash открывает настройки по #settings', m2.$('#view-settings').style.display === 'flex'); }
{ const m = mk(); m.ev(`showView('settings'); showSettingsTab('v9')`);
  ok('грид В-9 рендерит строку на каждый вид меры',
     m.$$('#settingsHost .settings-grid tbody tr').length === m.ev('MEASURE_KINDS.length'));
  ok('toggleV9 снимает последнее подразделение → вид исчезает из availableKinds', m.ev(`(()=>{
    RULES.measureSubdiv['Первичная претензия']=['ОД'];
    document.getElementById('roleSel').value='Куратор ОД / ДАК / РП';
    toggleV9('Первичная претензия','ОД');
    return !availableKinds(REQ_INDEX['201/311/з']).includes('Первичная претензия');
  })()`));
  ok('вид без подразделений помечается предупреждением', m.ev(`(()=>{
    RULES.measureSubdiv['Акт сверки']=[]; renderSettings();
    return document.getElementById('settingsHost').innerHTML.includes('никто не сможет');
  })()`));
  ok('setRoleSubdiv меняет роль→подразделение',
     m.ev(`(()=>{ setRoleSubdiv('Наблюдатель','ОД'); return RULES.roleSubdiv['Наблюдатель']==='ОД'; })()`)); }
{ const m = mk(); m.ev(`showView('settings'); showSettingsTab('stage')`);
  ok('вкладка Стадии рендерит селект на каждый раздел',
     m.$$('#settingsHost .settings-grid tbody tr select').length === m.ev('SECTION_ORDER.length'));
  ok('повышение sectionClevel блокирует меру раздела на низкой ступени', m.ev(`(()=>{
    const r = allReqs().find(x => contourOf(x)==='К1');
    const before = sequenceReason(r,'Акт сверки');
    setSectionClevel('Досудебный',4);
    return !before && !!sequenceReason(r,'Акт сверки');
  })()`)); }
{ const m = mk(); m.ev(`showView('settings'); showSettingsTab('gates')`);
  ok('вкладка Гейты рендерит строку на каждый гейт',
     m.$$('#settingsHost .settings-grid tbody tr').length === m.ev('Object.keys(RULES.gates).length'));
  ok('отключение гейта разблокирует иск на деле без поручения', m.ev(`(()=>{
    const r = allReqs().find(x => !x._proc.poruchenie && !!gateReason(x,'Исковое заявление'));
    if(!r) return false;
    toggleGate('Исковое заявление');
    return !gateReason(r,'Исковое заявление');
  })()`)); }
{ const m = mk(); m.ev(`showView('settings'); showSettingsTab('phases')`);
  ok('вкладка Фазы рендерит блок на каждый контур',
     m.$$('#settingsHost .phase-contour').length === m.ev('Object.keys(CONTOURS).length'));
  ok('movePhase меняет порядок в RULES.contourPhases', m.ev(`(()=>{
    movePhase('К1',0,1);
    return phasesOf('К1')[0]==='Повторная претензия' && phasesOf('К1')[1]==='Претензия';
  })()`));
  ok('переупорядочивание меняет предусловие sequenceReason', m.ev(`(()=>{
    resetRulesSection('contourPhases');
    const r = allReqs().find(x => phaseOf(x)==='Претензия');
    const before = sequenceReason(r,'Повторная претензия');
    movePhase('К1',0,1);
    const after = sequenceReason(r,'Повторная претензия');
    resetRulesSection('contourPhases');
    return !before && !!after;
  })()`)); }

/* ══════════════════════════════════════════════════════════════════════════
   МИРОВОЕ И ДОБРОВОЛЬНОЕ — решения МС-1…МС-7 (стадия берётся у требования)
   ══════════════════════════════════════════════════════════════════════════ */
head('МС-1…МС-7 · соглашения');
ok('МС-1 · срок производный ≈ 3.5 (8 платежей × 6 мес)',
   g.ev(`msTermYears(msSeedSchedule('15.08.2026',6,8,96400))`) === 3.5);
ok('МС-1 · срок производный === 3.0 (7 платежей × 6 мес)',
   g.ev(`msTermYears(msSeedSchedule('15.10.2026',6,7,112000))`) === 3.0);
ok('МС-1 · гейт блок при >5 лет и истёкших сроках',   g.ev('msTermGate(true,6).level') === 'block');
ok('МС-1 · гейт warn (не блок) при >5 лет без истёкших', g.ev('msTermGate(false,6).level') === 'warn');
ok('МС-1 · гейт ok при ≤5 лет',
   g.ev('msTermGate(true,5).level') === 'ok' && g.ev('msTermGate(true,3.5).level') === 'ok');
ok('МС-1 · дефолт истёкших сроков — из охвата требования (п. 114)',
   g.ev(`msExpiredDefault(${R('120/40/з')})`) === true && g.ev(`msExpiredDefault(${R('201/311/з')})`) === false);
ok('МС-5 · мировое допустимо на судебной стадии требования, не раньше',
   g.ev(`msStageEligible(${R('142/56/з')},'mirovoe').ok`) === true
   && g.ev(`msStageEligible(${R('201/311/з')},'mirovoe').ok`) === false);
ok('МС-5 · добровольное требует судебного акта по требованию',
   g.ev(`msStageEligible(${R('120/40/з')},'dobrovolnoe').ok`) === true
   && g.ev(`msStageEligible(${R('201/311/з')},'dobrovolnoe').ok`) === false);
ok('МС-2 · аттестация «не льготнее» — только при attested',
   g.ev(`msNotWorseOk({notWorse:{attested:true}})`) === true
   && g.ev(`msNotWorseOk({notWorse:{attested:false}})`) === false && g.ev('msNotWorseOk({})') === false);
ok('МС-4 · мини-гейт графика (нужен и отдел, и непустой schedule[])',
   g.ev(`msScheduleReady({scheduleBy:'ОД',schedule:[{pay:'15.08.2026',principal:1}]})`) === true
   && g.ev(`msScheduleReady({scheduleBy:'',schedule:[{pay:'15.08.2026',principal:1}]})`) === false
   && g.ev(`msScheduleReady({scheduleBy:'ОД',schedule:[]})`) === false);
ok('МС-1 · каскад графика: последний остаток 0, сумма тела == итог', g.ev(`(()=>{
  const a = ${P('120')}.agreements[0];
  const total = a.schedule.reduce((s,r)=>s+r.principal,0);
  const rows = msComputeRows(a,{rate:a.rate,base:365,start:a.approvedAt,principalTotal:total});
  return Math.abs(rows[rows.length-1].close)<0.01 && Math.abs(rows.reduce((s,r)=>s+r.principal,0)-total)<0.01;
})()`));
{ const m = mk(); m.ev(`openDetail('337/437/з')`); m.ev(`msApprove('МС-18')`);
  ok('МС-3 · утверждение под гейтом (337: график + аттестация есть)',
     m.ev(`_msFind('МС-18').status`) === 'утверждено судом');
  ok('МС-3 · без графика отраслевого утвердить нельзя', m.ev(`(()=>{
    const a=_msFind('МС-18'); a.status='проект'; a.scheduleBy=''; msApprove('МС-18'); return a.status;
  })()`) === 'проект'); }
{ const m = mk(); m.ev(`openDetail('337/437/з')`); m.ev(`msReject('МС-18')`);
  ok('МС-3 · отказ в утверждении', m.ev(`_msFind('МС-18').status`) === 'отказано в утверждении'); }
{ const m = mk(); m.ev(`openDetail('120/40/з')`); m.ev(`msBreach('МС-12')`);
  ok('МС-7 · нарушение утверждённого МС ставит флаг breached', m.ev(`_msFind('МС-12').breached`) === true);
  ok('МС-7 · нарушение гасит состояние обязательства',
     m.ev(`REQ_INDEX['120/40/з'].states.some(s=>s.agreement && s.agreement.num==='МС-12' && s.active===false)`)); }
{ const m = mk(); m.ev(`openDetail('337/437/з')`);
  ok('МС-7 · msBreach не трогает проект (не утверждён судом)', m.ev(`(()=>{
    const a=_msFind('МС-18'); const b=a.breached; msBreach('МС-18'); return a.breached===b && !a.breached;
  })()`)); }
ok('МС-3 · баннер зависит от статуса (утверждено / проект / нарушено)',
   /утверждено судом/.test(g.ev(`msBanner(${P('120')}.agreements[0])`))
   && /проект, не утверждён/.test(g.ev(`msBanner(${P('337')}.agreements[0])`))
   && /нарушено/.test(g.ev(`msBanner({type:'mirovoe',num:'X',breached:true})`)));
ok('регистрация мирового привязана к требованию', mk().ev(`(() => {
  openDetail('142/56/з');
  openAgreementModal();
  document.getElementById('agNum').value = 'ТЕСТ-МС';
  document.getElementById('agSchedBy').value = 'ОД';
  document.getElementById('agNotWorse').checked = true;
  agSync(); agSave();
  const a = curProc.agreements.find(x=>x.num==='ТЕСТ-МС');
  return !!a && a.req === '142/56/з' && REQ_INDEX['142/56/п'].states.some(s=>s.agreement===a);
})()`));
{ const m = mk(); m.ev(`openDetail('120/40/з')`); m.ev('openAgreementModal()');
  m.doc.getElementById('agYears').value = '6'; m.doc.getElementById('agExpired').checked = true; m.ev('agSync()');
  ok('МС-1 · срок >5 лет при истёкших сроках блокирует сохранение',
     m.$('#agSave').disabled === true && /не превышает 5 лет/.test(m.$('#agTermGate').textContent)); }

/* ══════════════════════════════════════════════════════════════════════════
   ПЕРСИСТ ДЕМО — снимок делится на дела и требования
   ══════════════════════════════════════════════════════════════════════════ */
head('персист демо-состояния');
ok('снимок не роняется круговыми ссылками и восстанавливает поля требования', mk().ev(`(() => {
  openDetail('142/56/з');
  curReq.costs.push({ date:TODAY, kind:'Государственная пошлина', amount:2500, note:null });
  curReq.scope = 'полный остаток';
  persistState();
  if(!localStorage.getItem(STORE_KEY)) return false;
  restoreState();
  const r = REQ_INDEX['142/56/з'];
  return !!r && r.scope === 'полный остаток' && r.costs.some(c => c.amount === 2500)
      && r._proc.id === '142' && allReqs().length === 135;
})()`));
ok('после восстановления соглашение снова связано с состоянием', mk().ev(`(() => {
  openDetail('120/40/з'); persistState(); restoreState();
  const r = REQ_INDEX['120/40/з'];
  return r.states.some(s => s.agreement && s.agreement.num === 'МС-12');
})()`));

/* ══════════════════════════════════════════════════════════════════════════
   СПРАВОЧНИКИ — при переезде модели ничего не потеряно
   ══════════════════════════════════════════════════════════════════════════ */
head('справочники');
ok('видов мер 51',              g.ev('MEASURE_KINDS.length') === 51);
ok('видов-вех 16',              g.ev('MILESTONE_KINDS.size') === 16);
ok('шаблонов сроков 39',        g.ev('DEADLINE_TEMPLATES.length') === 39);
ok('контуров К0…К7 — восемь',   g.ev('Object.keys(CONTOURS).length') === 8);
ok('разделов мер семь',         g.ev('SECTION_ORDER.length') === 7);
ok('редактор правил на месте',  g.ev(`typeof RULES === 'object' && typeof resetRulesAll === 'function'`));
ok('логика мирового МС-1…МС-7 на месте',
   g.ev(`['msTermGate','msStageEligible','msNotWorseOk','msSeedSchedule','msSyncStates','msComputeRows'].every(f=>typeof window[f]==='function')`));

console.log(`\nОШИБОК КОНСОЛИ (jsdomError): ${g.errs.length}`);
g.errs.forEach(e => console.log('  ' + e));
console.log(`ВСЕГО ПРОВЕРОК: ${n} · ПРОВАЛЕНО: ${fails}`);
process.exit(fails || g.errs.length ? 1 : 0);
