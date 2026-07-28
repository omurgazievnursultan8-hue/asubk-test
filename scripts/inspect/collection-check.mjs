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
  /* КД-9: панель строится только активная — «вся карточка» это шапка + обход вкладок. */
  const dhead  = () => doc.getElementById('detailHead');
  const allTabsText = () => { let t=''; for(let i=0;i<ev('TABS.length');i++){ ev(`switchTab(${i})`); t += active().textContent + '\n'; } return t; };
  const allTabsHtml = sel => { let a=[]; for(let i=0;i<ev('TABS.length');i++){ ev(`switchTab(${i})`); a.push(...[...active().querySelectorAll(sel)]); } return a; };
  const setRole = r => { doc.getElementById('roleSel').value = r; };
  return { dom, w, doc, ev, $, $$, active, dhead, allTabsText, allTabsHtml, setRole, errs };
}

let fails = 0, n = 0;
const ok   = (name, cond) => { n++; if(!cond) fails++; console.log(`${cond?'  ok':'FAIL'}  ${name}`); };
const head = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 62 - t.length)));

const g = mk();                        // общий DOM для read-only проверок
const R = id => `REQ_INDEX['${id}']`;
const P = id => `PROCESSES.find(x=>x.id==='${id}')`;
/* Вкладки карточки — реестр TABS (КД-9). Порядок: 0…3 дело, 4…9 требование (КД-4).
   Индексы берутся из самого мокапа по слагу, а не переписываются здесь руками. */
const TAB = Object.fromEntries(g.ev(`TABS.map(t=>t.slug)`).map((s,i)=>[s,i]));

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
/* КД-9: панель строится только активная — обходим все вкладки, иначе проверка сузилась бы. */
ok('в карточке нет селектора фазы', (() => { const m = mk(); m.ev("openDetail('142/56/з')");
  return m.allTabsHtml('select').length === 0 && m.dhead().querySelectorAll('select').length === 0; })());
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
/* КД-2/КД-3: плитки и раскрытие worst-of живут в шапке ВИДА, не в панели. */
{ const m = mk(); m.ev(`openDetail('210/70/з')`); m.ev('catOpen=false; toggleCat()');
  ok('раскрытие показывает входы покредитно (2 кредита + worst-of)',
     m.dhead().querySelectorAll('.cat-expand .row').length === 3);
  ok('честная категория видна при подавлении («подавлен»)',
     /подавлен/.test(m.dhead().querySelector('.cat-expand').textContent)); }
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
{ const m = mk(); m.ev(`openDetail('104/71/з')`); m.ev(`switchTab(${TAB.dolg})`);
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
   (() => { const m = mk(); m.ev(`openDetail('201/311/з')`);
     return !/Назначить исполнителя|Переназначить|Продлить срок/i.test(m.allTabsText()); })());
{ const m = mk(); m.ev(`openDetail('104/71/з')`); m.ev('openRejectProc()');
  ok('чек-лист структурный: отклонение перечисляет 7 позиций (п. 20.2)', m.$$('#modalHost .rejChk').length === 7); }

/* ══════════════════════════════════════════════════════════════════════════
   СРОКИ — Р-3: вычисление от базы шаблона, сущности «задание» нет
   ══════════════════════════════════════════════════════════════════════════ */
head('Р-3 · сроки порядка');
ok('шаблонов сроков 44, у каждого база, срок и пункт',
   g.ev('DEADLINE_TEMPLATES.length') === 44 && g.ev(`DEADLINE_TEMPLATES.every(t => t.base && t.term && t.point)`));
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
ok('строк-требований на странице столько же, сколько требований у её дел',
   g.ev(`(renderList(), document.querySelectorAll('#listBody tr.rowopen').length)`)
   === g.ev(`groupedDeals().slice((curPage-1)*PAGE_SIZE, curPage*PAGE_SIZE).reduce((a,d)=>a+d.reqs.length,0)`));
ok('дело-папка выводится строкой-группой',   g.ev(`document.querySelectorAll('#listBody tr.rowgrp').length`) > 0);
ok('колонок столько же, сколько в LIST_COLS',
   g.ev(`document.querySelectorAll('#listHead th').length`) === g.ev('LIST_COLS.length'));
ok('у обрезаемых колонок есть title', g.$$('#listBody tr.rowopen').every(tr => {
  const t = i => tr.children[i].getAttribute('title');
  return t(0) && t(1) && t(2) && t(3) && t(5) && t(6);
}));
ok('закрытые требования приглушены классом terminal',
   g.ev(`(onPageSize(500), document.querySelectorAll('#listBody tr.terminal').length)`) > 0);
ok('сумма плиток равна «Всего» (истинный partition, P3-R32)', g.ev(`(() => {
  const s = baseSet();
  const sum = ['gate','window','procWait','clear','closed'].reduce((a,k)=>a + s.filter(r=>listStatus(r)===k).length, 0);
  return s.length > 0 && s.length === sum;
})()`));
g.ev('onPageSize(25)');
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
   g.ev(`TABS.filter(t=>t.group==='дело').length`) === 4
   && g.ev(`TABS.filter(t=>t.group==='требование').length`) === 6 && g.ev('TABS.length') === 10);
{ const m = mk(); m.ev(`openDetail('142/56/з')`);
  ok('четыре плитки в шапке карточки, все нередактируемые с подписью источника',
     m.dhead().querySelectorAll('.phead-dims .dim').length === 4
     && m.dhead().querySelectorAll('.phead-dims input, .phead-dims select').length === 0
     && m.dhead().querySelectorAll('.phead-dims .dim .src').length === 4); }
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
  for(let i=0;i<s.ev('TABS.length');i++) s.ev(`switchTab(${i})`);
  return s.errs.length === 0;
})());
ok('переключение требования не уводит с карточки', mk().ev(`(() => {
  openDetail('142/56/з'); pickReq('142/56/п');
  return curReq.id === '142/56/п' && document.getElementById('view-detail').style.display === 'flex';
})()`));
ok('хеш переживает кириллический id требования', mk().ev(`(() => {
  openDetail('142/56/п'); return curHash() === 'detail/142/56/п/' + TABS[curTab].slug;
})()`));
ok('возврат по хешу открывает то же требование', mk().ev(`(() => {
  openDetail('142/56/п'); showView('list'); location.hash = 'detail/142/56/п'; restoreFromHash();
  return curReq.id === '142/56/п';
})()`));
ok('реестр претензий ведёт на требование-адресат', mk().ev(`(() => {
  regRender('claims');
  return /openDetail\\('\\d+\\/[^\\/']+\\/[зпг]'/.test(document.getElementById('claimsBody').innerHTML);
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
      && r._proc.id === '142' && allReqs().length === 136;
})()`));
ok('после восстановления соглашение снова связано с состоянием', mk().ev(`(() => {
  openDetail('120/40/з'); persistState(); restoreState();
  const r = REQ_INDEX['120/40/з'];
  return r.states.some(s => s.agreement && s.agreement.num === 'МС-12');
})()`));

/* ══════════════════════════════════════════════════════════════════════════
   ВОЛНА ТР — экран «Требования (реестр)».
   Решения ТР-1…ТР-11, дефекты ТР-Д1…ТР-Д12.
   Журнал волны: mockups/collection/ASUBK-status-razrabotki.md
   ══════════════════════════════════════════════════════════════════════════ */
const HTML_SRC = HTML;                       // для проверок «этого в исходнике больше нет»
const L = mk(); L.ev('renderList()');        // свой DOM: тесты волны мутируют фильтры и страницы
const tileLabels = () => L.$$('#listTiles .tile').map(t => t.querySelector('.tl').textContent);
const rowsOnPage = () => L.$$('#listBody tr.rowopen');
const chips      = () => L.$$('#filterChips .fchip').map(c => c.textContent.replace('×','').trim());

head('ТР-1 · реестр — состояние портфеля, а не рабочая очередь');
ok('рамка экрана названа вслух',            /Состояние портфеля взыскания/.test(L.$('.list-frame').textContent));
ok('очередь по срокам отправлена в свой реестр', /Сроки на контроле/.test(L.$('.list-frame').textContent));
ok('колонки «Ближайший срок» в реестре нет', L.ev(`LIST_COLS.every(c => c.k !== 'nearest')`));
ok('nearestDeadline снята — после ТР-3 её никто не звал (СК-Д14)', L.ev(`typeof nearestDeadline === 'undefined'`));

head('ТР-2 · плитки считают помехи, остаток назван честно');
ok('плиток шесть: всего + три помехи + остаток + закрытые', tileLabels().length === 6);
ok('плитки «Просрочен срок» больше нет',    !tileLabels().some(t => /Просрочен срок/.test(t)));
ok('остаточная корзина названа «В работе без помех»', L.ev(`TILE_LABELS.clear`) === 'В работе без помех');
ok('помехи идут перед остатком',
   tileLabels().indexOf('Заблокировано гейтом комитета') < tileLabels().indexOf('В работе без помех'));
ok('остаток — именно остаток: у его требований нет ни гейта, ни окна, ни ожидания процедуры',
   L.ev(`baseSet().filter(r=>listStatus(r)==='clear').every(r =>
     !gateBlocked(r) && !(r._proc.window && r._proc.window.open) &&
     !(r._proc.procedure && r._proc.procedure.confirm && r._proc.procedure.confirm.state==='ожидает'))`));
ok('плитка сужает список до своего состояния',
   L.ev(`(clickTile('gate'), onPageSize(500), [...document.querySelectorAll('#listBody tr.rowopen')].length === baseSet().filter(r=>listStatus(r)==='gate').length)`));
ok('нажатая плитка попадает в ленту условий', chips().some(c => /^Плитка: Заблокировано/.test(c)));
L.ev(`clickTile('gate'); onPageSize(25)`);

head('ТР-3 · свойства дела ушли из строки требования');
ok('в колонках нет заёмщика, региона, процедуры и куратора',
   L.ev(`['borrower','region','procedure','curator'].every(k => LIST_COLS.every(c => c.k !== k))`));
ok('заголовок дела несёт заёмщика, ИНН, регион, процедуру, группу и куратора', (() => {
  const t = L.$('#listBody tr.rowgrp td').textContent;
  return /ИНН/.test(t) && /куратор/.test(t) && /(группа|группа не выведена)/.test(t)
    && /(процедура не определена|Работа|Взыскание|Реструктур|Банкрот|Судебн|Исполнит|Списан)/.test(t);
})());

head('ТР-4 · группировка по делу — устройство таблицы, не режим');
ok('переключателя группировки в исходнике нет',      !/groupByBorrower/.test(HTML_SRC));
ok('каждое дело выводится одним непрерывным блоком', L.ev(`(() => {
  const ids = [...document.querySelectorAll('#listBody tr.rowopen')].map(tr => tr.dataset.id.split('/')[0]);
  const seen = new Set(); let prev = null;
  for(const id of ids){ if(id !== prev){ if(seen.has(id)) return false; seen.add(id); prev = id; } }
  return ids.length > 0;
})()`));
ok('дело всплывает по лучшей строке: при сортировке по сумме ↓ первое дело содержит максимум', L.ev(`(() => {
  sortKey='claim'; sortDir=-1; curPage=1; renderList();
  const deals = groupedDeals(); if(!deals.length) return false;
  const best = d => Math.max(...d.reqs.map(claimOf));
  return best(deals[0]) === Math.max(...deals.map(best));
})()`));
ok('внутри дела строки идут в порядке той же сортировки', L.ev(`(() => {
  const d = groupedDeals().find(d => d.reqs.length > 1); if(!d) return false;
  return d.reqs.every((r,i) => i === 0 || claimOf(d.reqs[i-1]) >= claimOf(r));
})()`));
ok('сортировка устойчива: равные ключи упорядочены по ключу требования', L.ev(`(() => {
  sortKey='cat'; sortDir=1; const rs = sortedReqs();
  for(let i=1;i<rs.length;i++) if(CAT_RANK[catOfReq(rs[i-1])] === CAT_RANK[catOfReq(rs[i])]
    && String(rs[i-1].id).localeCompare(String(rs[i].id),'ru') > 0) return false;
  sortKey='claim'; sortDir=-1; renderList(); return true;
})()`));

head('ТР-5 · фильтр: поля из требований, мёртвое снято');
const flabels = () => L.$$('#filterBody .flabel').map(x => x.textContent);
ok('поля «Владелец (отдел)» больше нет',      !flabels().includes('Владелец (отдел)'));
ok('появилось «Ведущее подразделение»',        flabels().includes('Ведущее подразделение'));
ok('ТР-Д1: опции подразделения = значениям требований', L.ev(`(() => {
  const opts = [...document.querySelectorAll('#f-subdiv option')].map(o=>o.value).filter(Boolean);
  const vals = [...new Set(allReqs().map(r=>r.subdivision))];
  return opts.length === vals.length && opts.every(o => vals.includes(o));
})()`));
ok('ТР-Д1: выбор подразделения возвращает НЕпустой список', L.ev(`(() => {
  setF('subdiv','ОПК'); const n = visibleReqs().length;
  const ok = n > 0 && visibleReqs().every(r => r.subdivision === 'ОПК');
  resetFilters(); return ok;
})()`));
ok('«Предмет требования» переименован в «Охват»',
   !flabels().includes('Предмет требования') && flabels().includes('Охват'));
ok('опции охвата берутся из требований, а не из дел', L.ev(`(() => {
  const opts = [...document.querySelectorAll('#f-scope option')].map(o=>o.value).filter(Boolean);
  const vals = [...new Set(allReqs().map(r=>r.scope))];
  return opts.length === vals.length && opts.every(o => vals.includes(o));
})()`));
ok('ТР-Д2: у ключа role появилось поле «Роль обязанного лица»', flabels().includes('Роль обязанного лица'));
ok('ТР-Д2: фильтр по роли работает', L.ev(`(() => {
  setF('role','поручитель'); const rs = visibleReqs();
  const ok = rs.length > 0 && rs.every(r => r.role === 'поручитель');
  resetFilters(); return ok;
})()`));
ok('ТР-Д10: сплит-кнопка «Обновить» снята',   L.$$('#filterBody .split').length === 0 && !/splitRefresh/.test(HTML_SRC));
ok('ТР-Д10: шестерёнка «Настройка колонок» снята', L.$$('.gear-btn').length === 0 && !/Настройка видимости колонок/.test(HTML_SRC));
ok('чипы подписаны по-русски, включая контур и фазу', L.ev(`(() => {
  setDep('contour','К2'); const c = [...document.querySelectorAll('#filterChips .fchip')].map(x=>x.textContent);
  resetFilters(); return c.some(x => /^Контур:/.test(x));
})()`));

head('ТР-6 · строка открывается кликом и Enter; пагинация и выгрузка настоящие');
ok('кнопки «Открыть требование» нет',        !/btnOpen/.test(HTML_SRC) && !/Открыть требование<\/button>/.test(HTML_SRC));
ok('строка помечена как открываемая и попадает в табуляцию',
   rowsOnPage()[0].getAttribute('tabindex') === '0' && rowsOnPage()[0].classList.contains('rowopen'));
{ const m = mk(); m.ev(`renderList(); document.querySelector('#listBody tr.rowopen').dispatchEvent(new Event('click',{bubbles:true}))`);
  ok('клик по строке открывает требование', m.ev(`!!curReq && document.getElementById('view-detail').style.display !== 'none'`)); }
{ const m = mk(); m.ev(`renderList();
  const tr = document.querySelector('#listBody tr.rowopen');
  const e = new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}); tr.dispatchEvent(e);`);
  ok('Enter на строке открывает требование', m.ev(`!!curReq && document.getElementById('view-detail').style.display !== 'none'`)); }
ok('ТР-Д4: пейджер настоящий — четыре живые кнопки, позиция и размер страницы',
   L.$$('#pagerNav button').length === 4 && !!L.$('#pagerNav .pager-pos') && !!L.$('#pagerSize'));
ok('ТР-Д5: счётчик не говорит «процессов»',  !/процессов/.test(L.$('#pagerCount').textContent) && !/>процессов</.test(HTML_SRC));
ok('счётчик формы «дела 1–25 из N»',         /^дела 1–\d+ из \d+ · требований на странице \d+ из \d+$/.test(L.ev(`(gotoPage(1), document.getElementById('pagerCount').textContent)`)));
ok('на странице ровно PAGE_SIZE дел (пока дел хватает)',
   L.$$('#listBody tr.rowgrp').length === L.ev('Math.min(PAGE_SIZE, groupedDeals().length)'));
ok('вторая страница даёт другие дела', L.ev(`(() => {
  gotoPage(1); const a = [...document.querySelectorAll('#listBody tr.rowopen')].map(t=>t.dataset.id).join();
  gotoPage(2); const b = [...document.querySelectorAll('#listBody tr.rowopen')].map(t=>t.dataset.id).join();
  gotoPage(1); return a !== b && b.length > 0;
})()`));
ok('размер страницы меняет число дел', L.ev(`(() => {
  onPageSize(50); const n50 = document.querySelectorAll('#listBody tr.rowgrp').length;
  onPageSize(25); const n25 = document.querySelectorAll('#listBody tr.rowgrp').length;
  return n50 === Math.min(50, groupedDeals().length) && n25 === 25;
})()`));
ok('дело не рвётся между страницами: все его строки на одной', L.ev(`(() => {
  const page = groupedDeals().slice(0, PAGE_SIZE);
  return page.every(d => d.reqs.length === d.p.requirements.filter(r => visibleReqs().includes(r)).length);
})()`));
ok('кнопка выгрузки на месте',               !!L.$('#btnExport') && /Выгрузить/.test(L.$('#btnExport').textContent));

head('ТР-6/ТР-11 · оттиск выгрузки');
const tsv = L.ev('exportTsv().tsv');
ok('оттиск называет реестр',                 /^Реестр требований \(взыскание задолженности\)/.test(tsv));
ok('оттиск несёт дату среза',                /\nСостояние на\t21\.07\.2026/.test(tsv));
ok('оттиск несёт дату снимка денег',         /\nДеньги — снимок модуля кредита на\t\d\d\.\d\d\.\d{4}/.test(tsv));
ok('оттиск несёт условия отбора',            /\nУсловия\t/.test(tsv));
ok('оттиск несёт сортировку и правило всплытия дела', /\nСортировка\t.*дела всплывают по лучшей строке/.test(tsv));
ok('оттиск несёт число дел и требований',    /\nДел\t\d+\n/.test(tsv) && /\nТребований\t\d+\n/.test(tsv));
ok('выгрузка отдаёт все страницы, а не текущую',
   Number((tsv.match(/\nТребований\t(\d+)\n/) || [])[1]) === L.ev('sortedReqs().length'));
ok('условия отбора попадают в оттиск дословно', (() => {
  L.ev(`setF('subdiv','ОПК')`); const t = L.ev('exportTsv().tsv'); L.ev('resetFilters()');
  return /\nУсловия\t.*Ведущее подразделение: ОПК/.test(t);
})());

head('ТР-7 · охват — только на требовании');
ok('у дела поля scope больше нет',           g.ev(`PROCESSES.every(p => p.scope === undefined)`));
ok('охват хранится на кредите',              g.ev(`PROCESSES.flatMap(p=>p.credits).every(c => typeof c.scope === 'string')`));
ok('требование берёт охват с кредита',       g.ev(`allReqs().every(r => r.scope === r._credit.scope)`));
ok('словарь охвата — три значения CONTEXT',  g.ev(`(() => {
  const v = [...new Set(allReqs().map(r=>r.scope))].sort();
  return v.length === 3 && v.join('|') === ['залог','полный остаток','просроченная сумма'].sort().join('|');
})()`));
ok('значения «смешанный» в данных нет',      !/смешанный/.test(HTML_SRC));
ok('ТР-Д9: у вопроса на орган поле topic, не subject',
   g.ev(`PROCESSES.flatMap(p=>p.committeeQuestions||[]).every(q => typeof q.topic === 'string' && q.subject === undefined)`));
ok('CQ_SUBJECTS переехал на topic',          g.ev(`CQ_SUBJECTS.every(s => typeof s.topic === 'string')`));

head('ТР-8 · составной ключ — не колонка');
ok('колонки «№ требования» нет',             L.ev(`LIST_COLS.every(c => c.k !== 'id')`));
ok('ключ требования — в подсказке строки',   /^Требование \d+\/\d+\/[зпг] — открыть$/.test(rowsOnPage()[0].getAttribute('title')));
ok('ключ требования — в выгрузке',           tsv.split('\n').find(l => /^№ требования\t/.test(l)) !== undefined
   && /\n\d+\/\d+\/[зпг]\t/.test(tsv));

head('ТР-9 · заголовок дела в одну строку');
ok('ТР-Д11: заголовок есть у КАЖДОГО дела на странице',
   L.$$('#listBody tr.rowgrp').length === L.ev('Math.min(PAGE_SIZE, groupedDeals().length)'));
ok('ТР-Д11: дело с единственным требованием тоже получает заголовок', L.ev(`(() => {
  const d = groupedDeals().slice(0,PAGE_SIZE).find(d => d.reqs.length === 1);
  if(!d) return false;
  const rows = [...document.querySelectorAll('#listBody tr')];
  const i = rows.findIndex(tr => tr.dataset.id === d.reqs[0].id);
  return i > 0 && rows[i-1].classList.contains('rowgrp');
})()`));
ok('заголовок несёт размер дела справа',     /дело В-2026-\d{6} · требований \d+ · по делу /.test(L.$('#listBody tr.rowgrp').textContent));
ok('сумма по делу считается один раз на кредит (солидарность не удваивает)', g.ev(`(() => {
  const p = PROCESSES.find(x => x.requirements.some(r => solidaryWith(r).length));
  return claimTotal(p.requirements) < p.requirements.reduce((a,r)=>a+claimOf(r),0);
})()`));
ok('строка требования — восемь колонок',     L.ev('LIST_COLS.length') === 8 && rowsOnPage()[0].children.length === 8);
ok('ширин столько же, сколько колонок, и в сумме 100 %',
   L.ev('LIST_WIDTHS.length') === 8 && L.ev(`LIST_WIDTHS.reduce((a,w)=>a+parseFloat(w),0)`) === 100);
ok('деньги и дни просрочки выровнены вправо', L.$$('#listBody tr.rowopen td.num').length > 0
   && [...rowsOnPage()[0].children].filter(td => td.classList.contains('num')).length === 2);

head('ТР-10 · стадии');
ok('в сайдбаре четыре стадийных пункта',     g.ev(`Object.keys(STAGE_RANK).length`) === 4);
ok('«Отчуждение активов» больше не заглушка: нет ни stub-класса, ни тоста вместо фильтра',
   L.$$('#nav .nav-item.stub').length === 0
   && L.ev(`(navClick('Отчуждение активов'), stageFilter === 'Отчуждение активов')`));
L.ev(`clearStage()`);
ok('переход на стадию ставит чип в ленте условий', (() => {
  L.ev(`navClick('Судебный порядок')`);
  return chips().includes('Стадия: Судебный порядок');
})());
ok('подсветка сайдбара следует за стадией',
   L.$$('#nav .nav-item.active').map(a => a.textContent).join() === 'Судебный порядок');
ok('на стадии остаются только её требования',
   L.ev(`visibleReqs().every(r => stageOfReq(r) === 'Судебный порядок') && visibleReqs().length > 0`));
ok('чип стадии снимается и возвращает полный реестр', (() => {
  const n = L.ev('visibleReqs().length'); L.ev('clearStage()');
  return L.ev('visibleReqs().length') > n && L.ev('stageFilter') === null;
})());
ok('подсветка вернулась на «Требования (реестр)»',
   L.$$('#nav .nav-item.active').map(a => a.textContent).join() === 'Требования (реестр)');

head('ТР-11 · одна подпись денег, честная при расхождении');
ok('пока снимок один — одна дата под таблицей',
   /Деньги — снимок модуля кредита на \d\d\.\d\d\.\d{4}/.test(L.$('#listMoney').textContent)
   && !/–/.test(L.$('#listMoney').textContent));
ok('подпись отмечает, что деньги не подчиняются дате среза', /дате среза реестра не подчиняются/.test(L.$('#listMoney').textContent));
ok('точная дата снимка — в подсказке суммы строки',
   /снимок денег на \d\d\.\d\d\.\d{4}/.test(rowsOnPage()[0].querySelector('td.num').getAttribute('title')));
{ const m = mk();
  m.ev(`onPageSize(500); LEDGER[Object.keys(LEDGER)[0]].asOf = '20.07.2026'; renderList()`);
  ok('разные даты — честный диапазон вместо одной даты',
     /Деньги — снимки модуля кредита на 20\.07\.2026 – 25\.07\.2026/.test(m.$('#listMoney').textContent));
  ok('при расхождении подпись отсылает к подсказке строки', /точная — в подсказке суммы/.test(m.$('#listMoney').textContent));
  ok('строка с иной датой несёт свою дату в подсказке',
     m.$$('#listBody tr.rowopen td.num').some(td => /снимок денег на 20\.07\.2026/.test(td.getAttribute('title') || '')));
  ok('диапазон дат уходит в оттиск выгрузки',
     /\nДеньги — снимок модуля кредита на\t20\.07\.2026 – 25\.07\.2026\t/.test(m.ev('exportTsv().tsv'))); }

head('ТР-Д12 · пустое состояние называет условия');
{ const m = mk();
  m.ev(`navClick('Отчуждение активов')`);
  ok('пустая выборка даёт строку пустого состояния', m.$$('#listBody tr.rowempty').length === 1);
  ok('пустое состояние говорит, что ничего не найдено', /Ни одного требования не найдено/.test(m.$('.list-empty').textContent));
  ok('пустое состояние перечисляет условия отбора', /Условия отбора: Стадия: Отчуждение активов/.test(m.$('.list-empty').textContent));
  ok('пустое состояние даёт снять условия одним движением', !!m.$('.list-empty button'));
  m.ev('resetAllConditions()');
  ok('снятие условий возвращает требования',
     m.$$('#listBody tr.rowopen').length > 0 && m.ev(`stageFilter === null && tileFilter === null && Object.keys(filterState).length === 0`)); }

/* ══════════════════════════════════════════════════════════════════════════
   ВОЛНА КД (28.07.2026) — карточка дела. Решения КД-1…КД-15, дефекты КД-Д1…КД-Д16.
   Разбор: mockups/collection/ASUBK-status-razrabotki.md · устройство: §14.2 спецификации.
   ══════════════════════════════════════════════════════════════════════════ */
const D = mk();            // общий DOM волны: карточка на деле с двумя требованиями
D.ev(`openDetail('142/56/з')`);
const dims  = () => [...D.dhead().querySelectorAll('.phead-dims .dim .dl')].map(x=>x.textContent.trim().split(' ▸')[0]);
const tabs  = () => [...D.doc.querySelectorAll('.dtab')].map(x=>x.textContent.trim());
const slugs = () => D.ev('TABS.map(t=>t.slug)');

head('КД-1 · рамка: рабочее место по требованию');
ok('карточка всегда открыта на требовании', D.ev('!!curReq'));
ok('умолчание — «Обзор», а не папка дела', D.ev(`TABS[DEFAULT_TAB].slug === 'obzor'`));
ok('открытие из реестра ведёт на «Обзор»',
   (D.ev(`openDetail('142/56/з')`), D.ev(`TABS[curTab].slug === 'obzor'`)));
ok('открытие по id дела берёт первое требование и тот же разрез',
   mk().ev(`(() => { openDetail('142'); return curReq.id === '142/56/з' && TABS[curTab].slug === 'obzor'; })()`));

head('КД-2 · шапка — часть вида, а не панелей');
ok('шапка живёт вне #detailPanels', !!D.dhead() && !D.dhead().closest('#detailPanels'));
ok('шапка одна на все вкладки: заголовок, баннеры, чипы и плитки на каждой', (() => {
  const m = mk(); m.ev(`openDetail('142/56/з')`);
  for(let i=0;i<m.ev('TABS.length');i++){
    m.ev(`switchTab(${i})`);
    const h = m.dhead();
    if(!h.querySelector('.dhead-id') || !h.querySelector('.reqchips')
       || !h.querySelector('.phead-dims') || h.querySelectorAll('.phead-banner').length !== 1) return false;
  }
  return true;
})());
ok('баннер блокировки виден на «Журнале мер» — там, где блокировка и бьёт', (() => {
  const m = mk(); m.ev(`openDetail('142/56/з')`); m.ev(`switchTab(${TAB.mery})`);
  return /пауза|Окно ожидания|куратор отстранён|Лицо:/.test(m.dhead().textContent); })());
ok('панель шапку больше не строит — дублей нет',
   D.doc.querySelectorAll('#detailPanels .phead-dims').length === 0);

head('КД-3 · четыре плитки, все уровня требования');
ok('плитки: Охват · Фаза · Категория · Ведущее подразделение',
   dims().join('|') === 'Охват|Фаза|Категория риска|Ведущее подразделение');
ok('стадия — подпись фазы, а не своя плитка',
   !dims().includes('Стадия')
   && /стадия «/.test(D.dhead().querySelectorAll('.phead-dims .dim')[1].textContent));
ok('процедура и группа ушли в заголовок дела',
   !dims().some(d=>/Процедура|Группа/.test(d))
   && /Работа с судебными органами/.test(D.doc.querySelector('.dhead-run').textContent)
   && /группа/.test(D.doc.querySelector('.dhead-run').textContent));
ok('счётчик п. 98 остался подписью, а не уехал в title', (() => {
  const m = mk(); m.ev(`openDetail('210/70/з')`);
  return /осталось 3 р\.д\. \(п\. 98\)/.test(m.doc.querySelector('.dhead-run').textContent); })());
ok('раскрытие worst-of работает из шапки',
   (D.ev('catOpen=false; toggleCat()'), D.dhead().querySelectorAll('.cat-expand .row').length > 0));

head('КД-4 · имена и порядок вкладок');
ok('группа «дело»: Общее · Процедура · Согласования · История',
   slugs().slice(0,4).join(',') === 'obschee,procedura,soglasovaniya,istoriya');
ok('группа «требование»: Обзор · Журнал мер · Долг · Суд · Особые состояния · Залог',
   slugs().slice(4).join(',') === 'obzor,mery,dolg,sud,sostoyaniya,zalog');
ok('«Долг» перед «Судом» — по частоте (долг у всех требований, суд у 5 дел)',
   TAB.dolg < TAB.sud);
ok('заикания «дело: Дело» больше нет', !slugs().includes('delo') && !tabs().some(t=>/^Дело/.test(t)));
ok('«Ведение дела» переименована в «Процедуру» — панель показывает только её',
   !tabs().some(t=>/Ведение дела/.test(t)));

head('КД-5 · Суд и Залог — по требованию, а не по делу');
ok('акт ссылается на меру-основание номером',
   D.ev(`PROCESSES.filter(p=>p.courtActs.length).every(p=>p.courtActs.every(a=>!!a.measureNum))`));
ok('привязка акта выводится через targets меры, не хранится',
   D.ev(`(()=>{const p=PROCESSES.find(x=>x.id==='142'); const a=p.courtActs[0];
     return !('targets' in a) && boundToReq(REQ_INDEX['142/56/з'], a.measureNum) === true;})()`));
ok('иск к обоим ответчикам виден обоим требованиям (п. 32)',
   D.ev(`courtActsOf(REQ_INDEX['142/56/з']).length === 1 && courtActsOf(REQ_INDEX['142/56/п']).length === 1`));
ok('чужой судебный процесс в требование не протекает', D.ev(`(()=>{
  const r=REQ_INDEX['142/56/п'];
  const fake={measureNum:'ТП-56'};                       // мера только к поручителю
  return boundToReq(REQ_INDEX['142/56/з'], fake.measureNum) === false;})()`));
ok('предмет залога привязан к кредиту',
   D.ev(`PROCESSES.every(p=>p.colls.every(c=>c.credit==null || p.credits.some(x=>x.id===c.credit)))`));
ok('на стенде все 25 предметов привязаны',
   D.ev(`PROCESSES.reduce((a,p)=>a+p.colls.filter(c=>c.credit==null).length,0)`) === 0);
ok('залог виден всем требованиям по своему договору',
   D.ev(`collsOf(REQ_INDEX['142/56/з']).length === collsOf(REQ_INDEX['142/56/п']).length`)
   && D.ev(`collsOf(REQ_INDEX['142/56/з']).length`) === 2);
ok('строка без привязки не прячется, а помечается «по делу»', (() => {
  const pill = D.ev('String(dealLevelPill)');
  return /по делу/.test(pill) && /Ссылки на меру нет/.test(pill); })());
ok('фильтр пропускает непривязанное, а не выбрасывает', D.ev(`(() => {
  const r = REQ_INDEX['142/56/з'];
  return boundToReq(r, null) === null && boundToReq(r, 'НЕТ-ТАКОЙ') === null
      && (r._proc.courtActs||[]).filter(a=>boundToReq(r,a.measureNum)!==false).length
         >= (r._proc.courtActs||[]).filter(a=>boundToReq(r,a.measureNum)===true).length; })()`));

head('КД-6 · срок принадлежит требованию');
ok('у срока есть цели', D.ev(`PROCESSES.every(p=>p.deadlines.every(d=>Array.isArray(d.targets)))`));
ok('дело-уровневые сроки (п. 98, конфликт) целей не получили',
   D.ev(`PROCESSES.flatMap(p=>p.deadlines).filter(d=>!d.targets.length)
         .every(d=>/статуса? процедуры|конфликт/i.test(dlAction(d)))`));
ok('срок апелляции по общему иску виден обоим требованиям',
   D.ev(`deadlinesOf(REQ_INDEX['142/56/з']).some(d=>dlAction(d)==='Апелляционная жалоба')
      && deadlinesOf(REQ_INDEX['142/56/п']).some(d=>dlAction(d)==='Апелляционная жалоба')`));
ok('пауза заёмщика в сроки поручителя не течёт',
   D.ev(`deadlinesOf(REQ_INDEX['142/56/п']).every(d=>!/Приостановка мер/.test(dlAction(d)))`));
ok('блок сроков стоит на «Обзоре» и назван уровнем', (() => {
  const m = mk(); m.ev(`openDetail('142/56/з')`); m.ev(`switchTab(${TAB.obzor})`);
  return /Сроки на контроле по требованию/.test(m.active().textContent); })());

head('КД-7 · чипы требований');
ok('дело с двумя требованиями даёт кнопки-переключатели',
   D.dhead().querySelectorAll('button.reqchip').length === 2);
ok('дело с одним требованием даёт подпись, а не кнопку', (() => {
  const m = mk(); m.ev(`openDetail('201/311/з')`);
  return m.dhead().querySelectorAll('.reqchip.solo').length === 1
      && m.dhead().querySelectorAll('button.reqchip').length === 0; })());
ok('чип рисуется всегда — и когда переключать нечего',
   mk().ev(`(() => { openDetail('201/311/з');
     return document.querySelectorAll('#detailHead .reqchip').length === 1; })()`));
ok('на вкладке дела чипы приглушены (обещание §14.2)', (() => {
  const m = mk(); m.ev(`openDetail('142/56/з')`); m.ev(`switchTab(${TAB.obschee})`);
  const on = m.dhead().classList.contains('deal-tab');
  m.ev(`switchTab(${TAB.mery})`);
  return on && !m.dhead().classList.contains('deal-tab'); })());
ok('переключение требования вкладку сохраняет', mk().ev(`(() => {
  openDetail('142/56/з'); switchTab(${TAB.dolg}); pickReq('142/56/п');
  return TABS[curTab].slug === 'dolg' && curReq.id === '142/56/п'; })()`));

head('КД-8 · вкладка в URL слагом');
ok('хеш содержит слаг вкладки', /detail\/142\/56\/з\/sud$/.test(
   mk().ev(`(() => { openDetail('142/56/з'); switchTab(${TAB.sud}); return curHash(); })()`)));
ok('F5 возвращает ту же вкладку и то же требование', mk().ev(`(() => {
  openDetail('142/56/п'); switchTab(${TAB.zalog}); const h = curHash();
  showView('list'); location.hash = h; restoreFromHash();
  return curReq.id === '142/56/п' && TABS[curTab].slug === 'zalog'; })()`));
ok('хеш без слага открывает умолчание', mk().ev(`(() => {
  location.hash = 'detail/142/56/п'; restoreFromHash();
  return curReq.id === '142/56/п' && TABS[curTab].slug === 'obzor'; })()`));
ok('слаг, а не индекс: перестановка вкладок старых ссылок не ломает',
   g.ev(`TABS.every(t=>/^[a-z]+$/.test(t.slug))`) && new Set(slugs()).size === 10);

head('КД-9 · реестр вкладок и ленивый рендер');
ok('вкладка описана объектом с слагом, группой и билдером',
   D.ev(`TABS.every(t=>typeof t.slug==='string' && /^(дело|требование)$/.test(t.group) && typeof t.build==='function')`));
ok('в DOM ровно одна панель — активная',
   D.doc.querySelectorAll('#detailPanels .detail-panel').length === 1);
ok('панель помечена слагом своей вкладки',
   D.active().getAttribute('data-tab') === D.ev('TABS[curTab].slug'));
ok('ручного массива билдеров больше нет', !/const builders\s*=/.test(HTML));
ok('обход всех вкладок на всех делах не даёт ошибок консоли', (() => {
  const s = mk();
  for(const id of ['142/56/з','120/40/з','201/311/з','405/403/з','104/71/з']){
    s.ev(`openDetail('${id}')`);
    for(let i=0;i<s.ev('TABS.length');i++) s.ev(`switchTab(${i})`);
  }
  return s.errs.length === 0;
})());

head('КД-10 · действия контекстные, футер не действует');
ok('в футере карточки только «Закрыть»',
   [...D.doc.querySelectorAll('#view-detail .footer button')].length === 1);
ok('утверждение «карточка read-only» из шапки-комментария снято',
   !/Карточка read-only/.test(HTML));
ok('действия живут в панелях', (() => {
  const m = mk(); m.ev(`openDetail('142/56/з')`); m.ev(`switchTab(${TAB.mery})`);
  return m.active().querySelectorAll('button').length > 1; })());

head('КД-11 · крошка — путь, а не второй заголовок');
ok('крошка показывает путь со звеном возврата',
   /Взыскание/.test(D.$('#crumbTitle').textContent)
   && !!D.$('#crumbTitle .crumb-link')
   && /дело В-2026-000142/.test(D.$('#crumbTitle').textContent));
ok('крошка не дублирует шапку (ни требования, ни фазы)',
   !/142\/56\/з|Иск|Рассмотрение вопроса/.test(D.$('#crumbTitle').textContent));
ok('точка записи крошки одна', (HTML.match(/getElementById\('crumbTitle'\)/g)||[]).length === 1);
ok('возврат в реестр сохраняет страницу и фильтры', mk().ev(`(() => {
  renderList(); onPageSize(50); gotoPage(2); const page = curPage, size = PAGE_SIZE;
  openDetail('142/56/з'); showView('list');
  return curPage === page && PAGE_SIZE === size
      && document.querySelectorAll('#listBody tr.rowopen').length > 0; })()`));

head('КД-12 · «Общее» не дублирует чипы');
{ const m = mk(); m.ev(`openDetail('142/56/з')`); m.ev(`switchTab(${TAB.obschee})`);
  const t = m.active().textContent;
  ok('таблицы «Требования дела» на вкладке нет', !/Требования дела/.test(t));
  ok('дублей счётчика и суммы по делу нет', !/Требований в деле|Сумма по делу/.test(t));
  ok('«Обязанные лица» остались — их вопрос в чип не помещается', /Обязанные лица/.test(t));
  ok('паспорт дела на месте', /Заёмщик \(якорь дела\)/.test(t) && /Основание открытия/.test(t)); }

head('КД-13 · счётчики вкладок и пустые состояния с причиной');
ok('счётчик стоит у вкладок-списков', D.doc.querySelectorAll('.dtab .dtab-n').length >= 6);
ok('нулевой счётчик приглушён, но вкладка не спрятана', (() => {
  const m = mk(); m.ev(`openDetail('201/311/з')`);
  const zero = [...m.doc.querySelectorAll('.dtab .dtab-n.zero')];
  return zero.length > 0 && m.doc.querySelectorAll('.dtab').length === 10; })());
ok('счётчик «Особых состояний» равен показанному на вкладке',
   D.ev(`stateCount(curReq) === stateRows(curReq).length + (curReq.states||[]).filter(s=>s.kind==='mirovoe').length`));
ok('счётчик «Суда» считает акты и заседания требования',
   D.ev(`TABS[${TAB.sud}].count(curProc,curReq) === courtActsOf(curReq).length + hearingsOf(curReq).length`));
{ const m = mk(); m.ev(`openDetail('203/313/з')`);   // дело без сроков, состояний, суда и залога
  const empt = {};
  for(let i=0;i<m.ev('TABS.length');i++){ m.ev(`switchTab(${i})`);
    const e = m.active().querySelector('.cgrid-empty'); if(e) empt[m.ev('TABS[curTab].slug')] = e.textContent; }
  ok('пустой «Суд» называет причину и стадию', /до судебной стадии оно не доходило/.test(empt.sud||''));
  ok('пустой «Залог» называет договор и обеспечение', /Залога по договору/.test(empt.zalog||''));
  ok('пустые «Особые состояния» говорят, что порядок обычный', /Взыскание идёт обычным порядком/.test(empt.sostoyaniya||''));
  ok('пустые сроки отсылают в реестр «Сроки на контроле»', /Сроки на контроле/.test(empt.obzor||''));
  ok('ни одно пустое состояние не осталось голым фактом',
     Object.values(empt).every(t => t.trim().length > 60)); }

head('КД-14 · дата снимка денег подписана везде');
ok('в шапке одна подпись снимка',
   D.doc.querySelectorAll('.dhead-money').length === 1
   && /снимок модуля кредита на 25\.07\.2026/.test(D.doc.querySelector('.dhead-money').textContent));
ok('расхождение дат называется диапазоном, а не максимумом', mk().ev(`(() => {
  const p = PROCESSES.find(x=>x.credits.length>1);
  const old = LEDGER[p.credits[0].id].asOf; LEDGER[p.credits[0].id].asOf = '20.07.2026';
  const s = moneyStamp(p); LEDGER[p.credits[0].id].asOf = old;
  return /20\\.07\\.2026 – 25\\.07\\.2026/.test(s) && /разные даты/.test(s); })()`));
ok('у суммы чипа есть подсказка с датой',
   /Снимок модуля кредита на 25\.07\.2026/.test(D.dhead().querySelector('.rc-sub span').getAttribute('title')||''));
ok('поле «Сумма требования» несёт дату снимка', (() => {
  const m = mk(); m.ev(`openDetail('142/56/з')`); m.ev(`switchTab(${TAB.obzor})`);
  return /снимок на 25\.07\.2026/.test(m.active().innerHTML); })());
ok('таблица долга по-прежнему называет свою дату', (() => {
  const m = mk(); m.ev(`openDetail('142/56/з')`); m.ev(`switchTab(${TAB.dolg})`);
  return /снимок модуля кредита на <b>25\.07\.2026<\/b>/.test(m.active().innerHTML); })());

head('КД-15 · заголовок дела в две строки');
ok('строка тождества: заёмщик · ИНН · регион · № дела', (() => {
  const t = D.doc.querySelector('.dhead-id').textContent;
  return /Бек Кабель/.test(t) && /ИНН 01912201610212/.test(t)
      && /Бишкек/.test(t) && /В-2026-000142/.test(t); })());
ok('строка ведения: процедура · группа · куратор · требований · сумма', (() => {
  const t = D.doc.querySelector('.dhead-run').textContent;
  return /Работа с судебными органами/.test(t) && /группа 2\.1/.test(t)
      && /куратор Тукинова/.test(t) && /требований 2/.test(t) && /по делу/.test(t); })());
ok('ИНН — ссылка в карточку заёмщика', !!D.doc.querySelector('.dhead-id a'));
ok('сумма по делу считается один раз на кредит (§2.2)',
   D.ev(`claimTotal(PROCESSES.find(p=>p.id==='142').requirements)
       < PROCESSES.find(p=>p.id==='142').requirements.reduce((a,r)=>a+claimOf(r),0)`));

head('КД-Д16 · имена функций от модели v2');
ok('panelOhvat переименована в panelDebt', !/function panelOhvat/.test(HTML) && /function panelDebt/.test(HTML));
ok('panelObschaya переименована в panelDeal', !/function panelObschaya/.test(HTML) && /function panelDeal/.test(HTML));

/* ══════════════════════════════════════════════════════════════════════════
   ВОЛНА СК — «Сроки на контроле» как рабочая очередь
   ══════════════════════════════════════════════════════════════════════════ */
const S = mk(); S.ev(`navClick('Сроки на контроле (реестр)')`);
const sRows  = () => S.$$('#deadlinesBody tr').filter(r => !r.classList.contains('rowempty'));
const sFrame = () => S.$('#dlFrame').textContent;
const sCols  = () => S.$$('#dlHead th').map(t => t.textContent.replace(/[↑↓↕]/g,'').trim());

head('СК-1/СК-6 · очередь с горизонтом, а не список просроченного');
ok('умолчание — горизонт 7 дней',            S.ev(`dlHorizon`) === '7' && /Горизонт: 7 дней/.test(sFrame()));
ok('предстоящие сроки показаны, а не только просроченные',
   sRows().length === 35 && sRows().filter(r=>/просрочен/.test(r.textContent)).length === 17);
ok('горизонт «всё» даёт все 47 сроков',      (()=>{ S.ev(`dlSetHorizon('all')`); return sRows().length === 47; })());
ok('просроченное проходит любой горизонт',   (()=>{ S.ev(`dlSetHorizon('7')`);
   return S.ev(`dlAll().filter(x=>x.n<0).every(dlPass)`); })());
ok('сегмент показывает выбранный горизонт',  S.$('#dlSeg button.on').dataset.h === '7');
ok('горизонт живёт в хеше — переживёт F5',   (()=>{ S.ev(`dlSetHorizon('30')`);
   const h = S.w.location.hash; S.ev(`dlSetHorizon('7')`); return h === '#deadlines/30'; })());
ok('хеш восстанавливает вид и горизонт', (()=>{
  const m = mk(); m.w.location.hash = '#deadlines/30'; m.ev(`restoreFromHash()`);
  return m.ev(`dlHorizon`) === '30' && m.doc.getElementById('view-deadlines').style.display === 'flex'
      && m.doc.querySelector('.nav-item.active').textContent === 'Сроки на контроле (реестр)'; })());

head('СК-2 · остаток производный, а не хранимый');
ok('хранимых leftDays / overdue в затравке нет',
   S.ev(`PROCESSES.flatMap(p=>p.deadlines).every(d=>d.leftDays===undefined && d.overdue===undefined)`));
ok('остаток считается из даты срока и даты отсчёта',
   S.ev(`daysLeft({due:'28.07.2026'}) === 7 && daysLeft({due:'17.06.2026'}) === -34 && daysLeft({due:TODAY}) === 0`));
ok('два спрятанных хранимым полем просроченных теперь видны (СК-Д2)', (()=>{
  const by = no => sRows().find(r=>new RegExp('В-2026-000'+no).test(r.textContent));
  return /−6 · просрочен/.test((by('205')||{textContent:''}).textContent)
      && /−19 · просрочен/.test((by('142')||{textContent:''}).textContent); })());
ok('глубина просрочки честная: дело 206 — −34, а не −1',
   /−34 · просрочен/.test(sRows().find(r=>/В-2026-000206/.test(r.textContent)).textContent));

head('СК-3/СК-4 · семь колонок, дата вместо длительности');
ok('колонки в заданном порядке',
   sCols().join('|') === 'Срок|Осталось, к.д.|Обязательство|Заёмщик|Требование|Ответственный|Пункт');
ok('единица счёта названа в шапке колонки',  /Осталось, к\.д\./.test(sCols()[1]));
ok('колонка «Срок» — дата, а не «10 р.д.»',
   sRows().every(r => /^\d{2}\.\d{2}\.\d{4}$/.test(r.querySelector('td').textContent.trim())));
ok('шаблонный срок и база отсчёта — в подсказке строки',
   /Отсчёт: .+ · срок по Порядку: .+ · шаблон №\d+/.test(sRows()[0].getAttribute('title')));
ok('заёмщик подписан номером дела',          /дело В-2026-\d{6}/.test(sRows()[0].textContent));

head('СК-5 · порядок по возрастанию остатка, сортировка по колонке');
ok('умолчание — по остатку вверх',           S.ev(`dlSort.k === 'left' && dlSort.dir === 1`));
ok('отрисованные строки идут по возрастанию остатка', (()=>{
  const a = sRows().map(r => Number(r.querySelectorAll('td')[1].textContent.trim().replace('−','-').split(' ')[0]));
  return a.length === 35 && a.every((v,i) => i === 0 || a[i-1] <= v) && a[0] === -34 && a[a.length-1] === 7; })());
ok('клик по колонке меняет ключ и направление', (()=>{
  S.ev(`dlSortBy('due')`); const up = S.ev(`dlSort.k==='due' && dlSort.dir===1`);
  S.ev(`dlSortBy('due')`); const down = S.ev(`dlSort.dir===-1`);
  S.ev(`dlSort={k:'left',dir:1}; dlRefresh()`); return up && down; })());

head('СК-7/СК-12 · рамка со счётчиками, пустое состояние с причиной');
ok('плиток на экране сроков нет',            S.$('#view-deadlines .tile') === null);
ok('рамка считает очередь и называет дату отсчёта',
   /показано 35 из 47 · просрочено 17 · истекает сегодня 5 · отсчёт от 21\.07\.2026/.test(sFrame()));
ok('пустое состояние называет условия и даёт их снять', (()=>{
  S.doc.getElementById('dlQ').value = 'такого-заёмщика-нет'; S.ev(`dlRefresh()`);
  const e = S.$('#deadlinesBody .list-empty');
  const good = e && /Условия отбора/.test(e.textContent) && !!e.querySelector('button');
  S.ev(`dlResetAll(); dlSetHorizon('7')`); return good; })());

head('СК-8 · ответственный выведен: куратор дела × подразделение шаблона');
ok('у каждого срока есть выведенный ответственный',
   S.ev(`dlAll().every(x=>['subdiv','external','system','none'].includes(x.resp.kind))`));
ok('подразделение берётся из шаблона, а не из дела',
   S.ev(`dlResponsible(PROCESSES.find(p=>p.id==='313'), PROCESSES.find(p=>p.id==='313').deadlines[0]).subdiv === 'ДАК'`));
ok('«не выведено» ровно у восьми дело-уровневых сроков',
   S.ev(`dlAll().filter(x=>x.resp.kind==='none').length === 8`)
   && S.ev(`dlAll().filter(x=>x.resp.kind==='none').every(x=>!x.reqs.length)`));
ok('срок исполнения претензии числится за заёмщиком, а не за сотрудником',
   S.ev(`dlAll().filter(x=>x.resp.kind==='external').every(x=>x.d.tpl===6)`));
ok('у ответственного есть подсказка с правилом вывода',
   /куратор дела .+ × подразделение шаблона|подразделение выводить не из чего/
     .test(sRows()[0].querySelectorAll('td')[5].getAttribute('title')));

head('СК-9 · условия отбора и лента чипов');
ok('список подразделений строится из выведенных значений (урок ТР-5)',
   S.ev(`(()=>{ const opts=[...document.getElementById('dlSubdiv').options].map(o=>o.value).filter(Boolean);
     return opts.length>1 && opts.every(v=>{ document.getElementById('dlSubdiv').value=v;
       const n=dlAll().filter(dlPass).length; document.getElementById('dlSubdiv').value=''; return n>0; }); })()`));
ok('«только моё подразделение» читает ролевой селектор',
   S.ev(`roleSubdivs().join('/')`) === 'ДАК/РП/ОД');
ok('фильтр по подразделению сужает выборку', (()=>{
  S.doc.getElementById('dlSubdiv').value = 'ОПК'; S.ev(`dlRefresh()`);
  const n = sRows().length, chips = S.$$('#dlChips .fchip').length;
  S.ev(`dlClear('subdiv')`); return n > 0 && n < 34 && chips === 2; })());
ok('поиск идёт по заёмщику, ИНН и номеру дела',
   S.ev(`(()=>{ const q=document.getElementById('dlQ');
     const hit=v=>{ q.value=v; const n=dlAll().filter(dlPass).length; q.value=''; return n; };
     return hit('Темир-Транс')>0 && hit('В-2026-000206')>0 && hit(PROCESSES.find(p=>p.id==='206').inn)>0; })()`));
ok('активные условия видны чипами', (()=>{
  S.doc.getElementById('dlQ').value = 'Темир'; S.ev(`dlRefresh()`);
  const c = S.$$('#dlChips .fchip').map(x=>x.textContent).join('|');
  S.ev(`dlClear('q')`); return /Поиск: Темир/.test(c) && /Горизонт: 7 дней/.test(c); })());

head('СК-10 · клик ведёт туда, где срок живёт');
ok('срок требования открывает требование на «Обзоре»',
   /openDetail\('206\/62\/з', TAB_BY_SLUG\('obzor'\)\)/.test(
     sRows().find(r=>/В-2026-000206/.test(r.textContent)).getAttribute('onclick')));
ok('срок подтверждения процедуры ведёт на «Процедуру»',
   S.ev(`dlTarget({p:{id:'210'}, reqs:[], act:'Подтверждение или отклонение статуса процедуры'}).join('/')`) === '210/procedura');
ok('срок по конфликту интересов ведёт в «Особые состояния»',
   S.ev(`dlTarget({p:{id:'205'}, reqs:[], act:'Уведомление о конфликте интересов'}).join('/')`) === '205/sostoyaniya');
ok('строка открывается и с клавиатуры',      sRows().every(r => r.getAttribute('tabindex') === '0' && /Enter/.test(r.getAttribute('onkeydown'))));

head('СК-11 · срок ссылается на шаблон номером');
ok('у каждого срока либо шаблон, либо метка «вне Порядка»',
   S.ev(`PROCESSES.flatMap(p=>p.deadlines).every(d=>d.tpl ? !!TPL_BY_N[d.tpl] : !!d.action)`));
ok('пять недостающих шаблонов добавлены (40–44)',
   S.ev(`[40,41,42,43,44].every(n=>!!TPL_BY_N[n])`)
   && S.ev(`[40,41,42,43,44].map(n=>TPL_BY_N[n].point).join('/')`) === 'Р-8/17.6/44/37/92');
ok('строковой связи со справочником больше нет', !/templTerm/.test(HTML.replace(/templTerm искала[\s\S]*?dlPoint\./,'')));
ok('шаблон находится у всех сроков Порядка (было «—» у 15 из 45)',
   S.ev(`PROCESSES.flatMap(p=>p.deadlines).filter(d=>d.tpl).every(d=>!!dlTerm(d) && !!dlPoint(d))`));
/* КР-15: два хранимых срока «вне Порядка» были ручными копиями даты заседания —
   их вывели из самого заседания, поэтому у хранимых сроков шаблон теперь есть у всех. */
ok('«вне Порядка» помечено, а не выброшено',
   S.ev(`PROCESSES.flatMap(p=>p.deadlines).filter(d=>!d.tpl).length === 0`)
   && S.ev(`PROCESSES.flatMap(p=>dlOf(p)).filter(d=>!d.tpl).length === 4`)
   && sRows().some(r=>/вне Порядка/.test(r.textContent)));
ok('«п. —» больше не рисуется (СК-Д13)',     !sRows().some(r=>/п\. —/.test(r.textContent)));
ok('Р-8 подписан без «п.» — это решение проекта, не пункт Порядка',
   S.ev(`dlPointLabel({tpl:40}) === 'Р-8' && dlPointLabel({tpl:5}) === 'п. 17.2'`));

head('СК-13 · срок снимается фактом, а не отметкой');
ok('кнопки «выполнено» у срока нет',         !/выполнено/i.test(S.$('#view-deadlines').innerHTML));
ok('карта закрытия ссылается на существующие виды мер',
   S.ev(`Object.values(DEADLINE_CLOSERS).flat().every(k=>MEASURE_KINDS.includes(k))`)
   && S.ev(`Object.keys(DEADLINE_CLOSERS).every(n=>!!TPL_BY_N[n])`));
ok('регистрация меры снимает срок с контроля', (()=>{
  const m = mk();
  const before = m.ev(`PROCESSES.find(p=>p.id==='202').deadlines.length`);
  const closed = m.ev(`closeDeadlinesBy(PROCESSES.find(p=>p.id==='202'),'Первичная претензия',
                       PROCESSES.find(p=>p.id==='202').requirements.map(r=>r.id)).length`);
  const after = m.ev(`PROCESSES.find(p=>p.id==='202').deadlines.length`);
  return before === 1 && closed === 1 && after === 0; })());
ok('чужая мера чужой срок не трогает',
   S.ev(`closeDeadlinesBy({deadlines:[{tpl:5,targets:['x']}]}, 'Акт сверки', ['x']).length === 0`));
ok('saveMeasure зовёт снятие срока и пишет это в историю',
   /closeDeadlinesBy\(p, kind, targets\.map/.test(HTML) && /снят с контроля/.test(HTML));

head('СК-14 · блок сроков в карточке — та же арифметика');
{ const m = mk(); m.ev(`openDetail('142/56/з', TAB_BY_SLUG('obzor'))`);
  const th = [...m.$('.dl-grid').querySelectorAll('th')].map(t=>t.textContent.trim());
  const tr = m.$('.dl-grid tbody tr');
  ok('колонки карточки: обязательство · срок · остаток · база · пункт',
     th.join('|') === 'Обязательство|Срок|Осталось, к.д.|База отсчёта|Пункт');
  ok('в карточке дата срока, а не длительность', /^\d{2}\.\d{2}\.\d{4}$/.test(tr.querySelectorAll('td')[1].textContent.trim()));
  ok('в карточке тот же производный остаток',    /−19 · просрочен/.test(tr.textContent));
  ok('подсказка карточки называет шаблон номером', /шаблон №27/.test(tr.getAttribute('title')));
  ok('горизонта и фильтров в карточке нет',      !m.$('.dl-grid').closest('.panel-wrap').querySelector('#dlSeg')); }

/* ══════════════════════════════════════════════════════════════════════════
   ВОЛНА КР — три кросс-процессных реестра на одном каркасе
   ══════════════════════════════════════════════════════════════════════════ */
const H = mk(); H.ev(`navClick('Заседания (реестр)')`);
const C = mk(); C.ev(`navClick('Претензии (реестр)')`);
const Q = mk(); Q.ev(`navClick('Вопросы на коллегиальные органы (реестр)')`);
const rRows  = (m,k) => m.$$('#'+k+'Body tr').filter(r => !r.classList.contains('rowempty'));
const rCols  = (m,k) => m.$$('#'+k+'Head th').map(t => t.textContent.replace(/[↑↓↕]/g,'').trim());
const rFrame = (m,k) => m.$('#'+k+'Frame').textContent;
const REG3   = [['hearings',H],['claims',C],['committee',Q]];

head('КР-1 · три реестра собраны одним каркасом');
ok('каркас описывает все три экрана',
   H.ev(`Object.keys(REGS).sort().join('/')`) === 'claims/committee/hearings');
ok('трёх самописных render-функций больше нет',
   !/function render(Hearings|Claims|Committee)Registry/.test(HTML));
ok('разметку пишет один builder — в вёрстке только пустые хосты',
   /<div id="hearingsHost"><\/div>/.test(HTML) && /<div id="claimsHost"><\/div>/.test(HTML)
   && /<div id="committeeHost"><\/div>/.test(HTML) && /function regBuild\(key\)/.test(HTML));
ok('у каждого экрана сегменты, «моё», подразделение, поиск, чипы и рамка',
   REG3.every(([k,m]) => ['Seg','Mine','Subdiv','Q','Chips','Frame','Head','Body'].every(s => !!m.$('#'+k+s))));
ok('шапка сортируемая на всех трёх',
   REG3.every(([k,m]) => m.$$('#'+k+'Head th').every(t => /regSortBy/.test(t.getAttribute('onclick')||''))));
ok('состояние экрана живёт в хеше (СК-6 перенесён на все три)', (()=>{
   const h = []; for(const [k,m] of REG3){ m.ev(`regSetSeg('${k}','all')`); h.push(m.w.location.hash); }
   H.ev(`regSetSeg('hearings','upcoming')`); C.ev(`regSetSeg('claims','all')`); Q.ev(`regSetSeg('committee','pending')`);
   return h.join(' ') === '#hearings/all #claims/all #committee/all'; })());
ok('хеш восстанавливает вид и сегмент', (()=>{
   const m = mk(); m.w.location.hash = '#committee/decided'; m.ev(`restoreFromHash()`);
   return m.ev(`regState.committee.seg`) === 'decided'
       && m.doc.getElementById('view-committee').style.display === 'flex'
       && m.doc.querySelector('.nav-item.active').textContent === 'Вопросы на коллегиальные органы (реестр)'; })());

head('КР-2 · заседание — одна сущность, срок выводится из него');
ok('хранимых сроков «Следующее судебное заседание» в затравке нет',
   H.ev(`PROCESSES.flatMap(p=>p.deadlines).filter(d=>/судебное заседание/i.test(d.action)).length === 0`));
ok('срок выводится из заседания и держит ссылку на него',
   H.ev(`PROCESSES.flatMap(p=>hearingDeadlines(p)).length === 4`)
   && H.ev(`PROCESSES.flatMap(p=>hearingDeadlines(p)).every(d=>!!d._hearing)`));
ok('в очередь выводится только не наступившее заседание',
   H.ev(`PROCESSES.flatMap(p=>hearingDeadlines(p)).every(d=>daysLeft(d) >= 0)`)
   && H.ev(`PROCESSES.flatMap(p=>p.hearings||[]).length === 10`));
ok('очередь сроков видит заседание строкой',
   H.ev(`dlAll().filter(x=>x.d._hearing).length === 4`));
ok('снимок состояния производный срок не хранит',
   H.ev(`(()=>{ persistState(); return !/Следующее судебное заседание/.test(localStorage.getItem(STORE_KEY)||''); })()`));

head('КР-3/КР-4 · заседания: исход вместо статуса, сегменты');
ok('восемь колонок в заданном порядке',
   rCols(H,'hearings').join('|') === 'Дата и время|Осталось, к.д.|Вид|Заёмщик|Требование|Место|Представитель ФКФ|Исход');
ok('колонки «Статус» с планированием больше нет', !rCols(H,'hearings').includes('Статус'));
ok('умолчание — предстоящие, прошедшее без исхода показано всегда',
   H.ev(`regState.hearings.seg`) === 'upcoming'
   && rRows(H,'hearings').length === 7
   && rRows(H,'hearings').filter(r=>/исход не внесён/.test(r.textContent)).length === 3);
ok('сегмент «Прошедшие» даёт только прошедшие', (()=>{
   H.ev(`regSetSeg('hearings','past')`); const n = rRows(H,'hearings').length;
   const all = (H.ev(`regSetSeg('hearings','all')`), rRows(H,'hearings').length);
   H.ev(`regSetSeg('hearings','upcoming')`); return n === 6 && all === 10; })());
ok('мера-основание — подписью, а не колонкой',
   /мера ИСК-/.test(rRows(H,'hearings')[0].textContent)
   && /Мера-основание: ИСК-77 · участники:/.test(rRows(H,'hearings')[0].getAttribute('title')));
ok('представитель ФКФ выведен из участников, а не введён руками',
   H.ev(`REGS.hearings.all().every(x=>!!x.rep)`) && !/rep:'/.test(HTML));
ok('рамка называет очередь, дыру и ближайшее заседание',
   /предстоит <b>4<\/b> · прошло без внесённого исхода <b>3<\/b> · ближайшее <b>24\.07\.2026 09:30<\/b>/.test(H.$('#hearingsFrame').innerHTML));

head('КР-5/КР-6/КР-7 · претензии: ось вручение, сумма документа неизменна');
ok('семь колонок, ось — вручение',
   rCols(C,'claims').join('|') === 'Вид|Номер|Отправлена|Вручение|Заёмщик|Требование|Сумма');
ok('мёртвой колонки «Статус» нет',           !rCols(C,'claims').includes('Статус'));
ok('невручённое подсвечено независимо от сегмента',
   rRows(C,'claims').filter(r=>r.classList.contains('mrow-undelivered')).length === 2
   && rRows(C,'claims').some(r=>/не подтверждено \(п\. 20\.2\)/.test(r.textContent)));
ok('сегмент «Не вручены» отбирает их же', (()=>{
   C.ev(`regSetSeg('claims','undelivered')`); const n = rRows(C,'claims').length;
   C.ev(`regSetSeg('claims','storno')`);      const s = rRows(C,'claims').length;
   C.ev(`regSetSeg('claims','all')`);         return n === 2 && s === 1; })());
ok('три даты Р-7 и результат — в подсказке строки',
   /Событие .+ · поступление .+ · регистрация .+ · результат: /.test(rRows(C,'claims')[0].getAttribute('title')));
ok('сумма документа не пересчитана, расхождение подписано «сейчас …»',
   rRows(C,'claims').filter(r=>/сейчас /.test(r.textContent)).length === 5
   && C.ev(`REGS.claims.all().every(x=>x.doc === parseSum(x.m.sum))`));
ok('дельта суммы нигде не хранится (ADR-0001)',
   C.ev(`PROCESSES.flatMap(p=>p.measures||[]).every(m=>m.sumNow===undefined && m.delta===undefined)`));
ok('рамка считает вручение, сторно и расхождение',
   /без подтверждения вручения <b>2<\/b> \(п\. 20\.2\) · сторнировано <b>1<\/b> · сумма документа разошлась с требованием у <b>5<\/b>/
     .test(C.$('#claimsFrame').innerHTML));

head('КР-8/КР-9/КР-11 · вопросы: состояние выводится в одном месте');
ok('семь колонок, состояние первым',
   rCols(Q,'committee').join('|') === 'Состояние|Предмет|Орган|Заёмщик|Договоры|Инициатор|Заседание');
ok('умолчание — ждут решения',               Q.ev(`regState.committee.seg`) === 'pending'
   && rRows(Q,'committee').length === 4 && Q.ev(`REGS.committee.all().length`) === 28);
ok('состояний ровно четыре',                 Q.ev(`Object.keys(CQ_STATE).join('/')`) === 'pending/scheduled/positive/negative');
ok('заглушки в поле решения решением больше не считаются',
   Q.ev(`CQ_NON_DECISION.size === 4`)
   && Q.ev(`PROCESSES.flatMap(p=>p.committeeQuestions).filter(q=>!q.decided && q.decision).length === 0`));
ok('состояние читают реестр, карточка и гейт из одного хелпера',
   (HTML.match(/questionState\(/g)||[]).length >= 4);
ok('вопрос без даты заседания назван «не назначено», а не прочерком',
   rRows(Q,'committee').filter(r=>/не назначено/.test(r.textContent)).length === 2);
ok('гейтовый вопрос называет, какое действие держит',
   rRows(Q,'committee').filter(r=>/блокирует: /.test(r.textContent)).length === 4);
ok('протокол и решение — подписями, отдельных колонок нет',
   !rCols(Q,'committee').includes('Протокол') && !rCols(Q,'committee').includes('Решение')
   && Q.ev(`regSetSeg('committee','decided')`) === undefined
   && rRows(Q,'committee').some(r=>/протокол /.test(r.textContent)));
ok('рамка считает очередь, безадресные и заблокированные действия', (()=>{
   Q.ev(`regSetSeg('committee','pending')`);
   return /ждут решения <b>4<\/b> · из них без даты заседания <b>2<\/b> · отказов <b>0<\/b> · держат заблокированным действие <b>4<\/b>/
     .test(Q.$('#committeeFrame').innerHTML); })());
ok('прочерк вместо номера протокола убран из затравки',
   Q.ev(`PROCESSES.flatMap(p=>p.committeeQuestions).filter(q=>q.protocolNo === '—').length === 0`));

head('КР-10 · гейт сверяется по предмету и по договору');
ok('предмет вопроса приведён к одному написанию',
   Q.ev(`[...new Set(PROCESSES.flatMap(p=>p.committeeQuestions.map(q=>q.topic)))].length === 5`));
ok('credits хранит id договора, а не его номер',
   Q.ev(`PROCESSES.every(p=>p.committeeQuestions.every(q=>(q.credits||[]).every(v=>p.credits.some(c=>c.id===v))))`));
ok('сверки «любой вопрос к тому же органу» больше нет', !/q\.organ === g\.organ/.test(HTML));
ok('решение по чужому договору гейт не открывает', mk().ev(`(()=>{
  const p = PROCESSES.find(x => x.credits.length > 1 && new Set(x.requirements.map(r=>r.credit)).size > 1);
  const a = p.requirements[0], b = p.requirements.find(r=>r.credit !== a.credit);
  p.committeeQuestions.push({ organ:ORGANS[2], initiator:'ДАК', topic:'Начало внесудебного обращения взыскания на залог',
    credits:[a.credit], decided:true, decision:'разрешено', positive:true, meetingDate:'01.07.2026',
    protocolNo:'КЗ-99', protocolDate:'01.07.2026' });
  return gateReason(a,'Извещение об обращении на залог') === null
      && /Решение есть, но по другому кредиту/.test(gateReason(b,'Извещение об обращении на залог'));
})()`));
ok('отказ назван отказом и приводит протокол',
   /Орган отказал \(протокол КО-44 от 14\.07\.2026\)/
     .test(Q.ev(`gateReason(PROCESSES.find(p=>p.id==='364').requirements[0],'Безакцептное списание')`)));
ok('невынесенный и назначенный вопрос дают разные причины',
   /Вопрос не вынесен\./.test(Q.ev(`gateReason(PROCESSES.find(p=>p.id==='201').requirements[0],'Безакцептное списание')`))
   && /назначен на заседание 02\.07\.2026, решение не внесено/
     .test(Q.ev(`gateReason(PROCESSES.find(p=>p.id==='314').requirements[0],'Безакцептное списание')`)));
ok('правила, сохранённые до волны, гейт не ломают (запасной ход на GATES)', mk().ev(`(()=>{
  /* restoreRules подменяет раздел целиком: старый снимок приедет без topic. */
  Object.keys(RULES.gates).forEach(k => { delete RULES.gates[k].topic; });
  const p = PROCESSES.find(x=>x.id==='314');
  return gateTopic('Безакцептное списание') === 'Запуск безакцептного списания'
      && /назначен на заседание/.test(gateReason(p.requirements[0],'Безакцептное списание'));
})()`));
ok('поручение Председателя остаётся уровнем дела, а не вопросом',
   /требует поручения Председателя Правления \(п\. 21\)/
     .test(Q.ev(`gateReason(PROCESSES.find(p=>!p.poruchenie).requirements[0],'Исковое заявление')`)));

head('КР-12 · клик ведёт туда, где запись живёт');
ok('заседание открывает «Суд» требования',
   /openDetail\('142\/56\/з', TAB_BY_SLUG\('sud'\)\)/.test(rRows(H,'hearings')[0].getAttribute('onclick')));
ok('претензия открывает «Журнал мер» адресата',
   /openDetail\('\d+\/[^\/']+\/[зпг]', TAB_BY_SLUG\('mery'\)\)/.test(rRows(C,'claims')[0].getAttribute('onclick')));
ok('вопрос открывает «Согласования» дела',
   /TAB_BY_SLUG\('soglasovaniya'\)/.test(rRows(Q,'committee')[0].getAttribute('onclick')));
ok('срок-проекция заседания ведёт на «Суд», а не на «Обзор»',
   H.ev(`dlTarget(dlAll().find(x=>x.d._hearing)).join('/')`).endsWith('/sud'));
ok('строка открывается и с клавиатуры на всех трёх',
   REG3.every(([k,m]) => rRows(m,k).every(r => r.getAttribute('tabindex') === '0' && /Enter/.test(r.getAttribute('onkeydown')))));

head('КР-13 · каркас СК целиком: условия, подразделение, пустое состояние');
ok('условия отбора идут лентой чипов и снимаются по одному', (()=>{
   /* Лента показывает ТОЛЬКО действующие условия: у claims умолчание — сегмент «Все»,
      условий нет, лента пуста. Появляется вместе с первым условием. */
   const empty = REG3.every(([k,m]) =>
     m.$('#'+k+'Chips').children.length === (m.ev(`!!regSeg('${k}').cond`) ? 1 : 0));
   return empty && REG3.every(([k,m]) => {
     m.doc.getElementById(k+'Q').value = 'Бек'; m.ev(`regRefresh('${k}')`);
     const c = m.$('#'+k+'Chips');
     const on = /Поиск: Бек/.test(c.textContent) && !!c.querySelector('.fchip button[onclick]');
     m.doc.getElementById(k+'Q').value = ''; m.ev(`regRefresh('${k}')`); return on; }); })());
ok('подразделение заседаний и претензий берётся от требования',
   H.ev(`REGS.hearings.subdiv(REGS.hearings.all().find(x=>x.reqs.length)) === REGS.hearings.all().find(x=>x.reqs.length).reqs[0].subdivision`)
   && C.ev(`REGS.claims.subdiv(REGS.claims.all().find(x=>x.reqs.length)) === REGS.claims.all().find(x=>x.reqs.length).reqs[0].subdivision`));
ok('подразделение вопроса — его инициатор, орган подразделением не считается',
   Q.ev(`REGS.committee.all().every(x=>{ const s = REGS.committee.subdiv(x);
     return s === null || SUBDIV_CODES.includes(s); })`));
ok('список подразделений строится из выведенных значений (ТР-5)',
   Q.ev(`[...document.getElementById('committeeSubdiv').options].slice(1)
          .every(o => o.value === 'не выведено' || REGS.committee.all().some(x=>REGS.committee.subdiv(x) === o.value))`)
   && Q.ev(`[...document.getElementById('committeeSubdiv').options].some(o=>o.value === 'не выведено')`));
ok('пустое состояние называет условия и даёт их снять', (()=>{
   const m = mk(); m.ev(`navClick('Претензии (реестр)')`);
   m.doc.getElementById('claimsQ').value = 'такого-заёмщика-нет'; m.ev(`regRefresh('claims')`);
   const e = m.$('#claimsBody .list-empty');
   return !!e && /Условия отбора/.test(e.textContent) && !!e.querySelector('button'); })());
ok('без условий пустое состояние называет причину, а не «записей нет»',
   /Условий отбора нет — ни по одному делу заседание не назначено/.test(HTML)
   && /Условий отбора нет — претензий и требований обязанным лицам/.test(HTML)
   && /Условий отбора нет — вопросов на коллегиальные органы/.test(HTML));
ok('сброс возвращает широкий сегмент', (()=>{
   const m = mk(); m.ev(`navClick('Вопросы на коллегиальные органы (реестр)')`);
   m.doc.getElementById('committeeQ').value = 'нет'; m.ev(`regResetAll('committee')`);
   return m.ev(`regState.committee.seg`) === 'all' && m.doc.getElementById('committeeQ').value === ''; })());

head('КР-14 · затравка покрывает новые состояния');
ok('есть прошедшее заседание без внесённого исхода',
   H.ev(`REGS.hearings.all().filter(x=>x.n != null && x.n < 0 && !x.done).length === 3`));
ok('есть сторнированная претензия-дубль',
   C.ev(`REGS.claims.all().filter(x=>!!x.m.storno).length === 1`)
   && C.ev(`PROCESSES.flatMap(p=>p.measures||[]).some(m=>/дубль ПР-140/.test((m.storno||{}).reason||''))`));
ok('есть требование гаранту и сам гарант обязанным лицом',
   C.ev(`PROCESSES.find(p=>p.id==='309').obligors.filter(o=>o.role==='гарант').length === 1`)
   && C.ev(`REGS.claims.all().some(x=>x.m.kind === 'Требование гаранту')`));
ok('есть отказ органа — гейт остаётся закрытым',
   Q.ev(`REGS.committee.all().filter(x=>x.st.k === 'negative').length === 1`));
ok('есть вопрос без даты заседания и вопрос назначенный',
   Q.ev(`REGS.committee.all().filter(x=>x.st.k === 'pending').length === 2`)
   && Q.ev(`REGS.committee.all().filter(x=>x.st.k === 'scheduled').length === 2`));

head('КР-15 · карточка и реестр читают одно и то же');
{ const m = mk(); m.ev(`openDetail('142/56/з', TAB_BY_SLUG('sud'))`);
  const a = m.active();
  ok('в карточке колонка заседания — «Исход», а не «Статус»',
     /<th>Исход<\/th>/.test(a.innerHTML) && !/<th>Статус<\/th>/.test(a.innerHTML));
  ok('прошедшее без исхода помечено и в карточке',  /исход не внесён/.test(a.textContent)); }
{ const m = mk(); m.ev(`openDetail('314/414/з', TAB_BY_SLUG('soglasovaniya'))`);
  const a = m.active();
  ok('карточка печатает то же состояние вопроса, что и реестр',
     /назначен на заседание/.test(a.textContent)
     && a.textContent.includes(m.ev(`questionState(PROCESSES.find(p=>p.id==='314').committeeQuestions[0]).t`)));
  ok('гейт в карточке называет предмет вопроса, который его открывает',
     /открывает вопрос «/.test(a.innerHTML));
  ok('договоры вопроса печатаются номером, а не id',
     !/>\s*414\s*</.test(a.innerHTML) && /Дог\. №/.test(a.textContent)); }

head('КР-16 · границы волны');
ok('вкладка «Гейты» настроек по-прежнему читается',
   g.ev(`Object.keys(RULES.gates).length === 4`)
   && g.ev(`Object.keys(RULES.gates).every(k=>!!RULES.gates[k].organ && !!RULES.gates[k].point && !!RULES.gates[k].topic)`));
ok('реестр требований и карточка волной не тронуты',
   g.ev(`TABS.length === 10`) && g.ev(`allReqs().length === 136`));

/* ══════════════════════════════════════════════════════════════════════════
   СПРАВОЧНИКИ — при переезде модели ничего не потеряно
   ══════════════════════════════════════════════════════════════════════════ */
head('справочники');
ok('видов мер 51',              g.ev('MEASURE_KINDS.length') === 51);
ok('видов-вех 16',              g.ev('MILESTONE_KINDS.size') === 16);
ok('шаблонов сроков 44',        g.ev('DEADLINE_TEMPLATES.length') === 44);
ok('контуров К0…К7 — восемь',   g.ev('Object.keys(CONTOURS).length') === 8);
ok('разделов мер семь',         g.ev('SECTION_ORDER.length') === 7);
ok('редактор правил на месте',  g.ev(`typeof RULES === 'object' && typeof resetRulesAll === 'function'`));
ok('логика мирового МС-1…МС-7 на месте',
   g.ev(`['msTermGate','msStageEligible','msNotWorseOk','msSeedSchedule','msSyncStates','msComputeRows'].every(f=>typeof window[f]==='function')`));

console.log(`\nОШИБОК КОНСОЛИ (jsdomError): ${g.errs.length}`);
g.errs.forEach(e => console.log('  ' + e));
console.log(`ВСЕГО ПРОВЕРОК: ${n} · ПРОВАЛЕНО: ${fails}`);
process.exit(fails || g.errs.length ? 1 : 0);
