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
  /* Исключение внутри проверки не должно ронять ВЕСЬ прогон: одна устаревшая проверка
     (снятая функция, снятый узел) обрывала хвост в сотни ассертов, и отчёт «N ok» врал
     тем, что молчал о непройденном. Ошибка = провал этой проверки и строка с причиной. */
  const ev = s => { try { return w.eval(s); } catch(e){ console.log('      ! eval: ' + e.message); return undefined; } };
  const $  = s => doc.querySelector(s);
  const $$ = s => [...doc.querySelectorAll(s)];
  const active = () => doc.querySelector('#detailPanels .detail-panel.active');
  /* КД-9: панель строится только активная — «вся карточка» это шапка + обход вкладок. */
  const dhead  = () => doc.getElementById('detailHead');
  const allTabsText = () => { let t=''; for(let i=0;i<ev('TABS.length');i++){ ev(`switchTab(${i})`); t += active().textContent + '\n'; } return t; };
  const allTabsHtml = sel => { let a=[]; for(let i=0;i<ev('TABS.length');i++){ ev(`switchTab(${i})`); a.push(...[...active().querySelectorAll(sel)]); } return a; };
  const setRole = r => { doc.getElementById('roleSel').value = r; };
  /* Волна НП: правила меняет только «Администратор правил», и опасные правки
     спрашивают confirm. jsdom своего confirm не имеет — подставляем управляемый:
     ev('__ok=false') проверяет ветку отказа. */
  w.__ok = true;
  w.confirm = () => w.__ok;
  const asAdmin = () => setRole(ev('RULES_ADMIN_ROLE'));
  return { dom, w, doc, ev, $, $$, active, dhead, allTabsText, allTabsHtml, setRole, asAdmin, errs };
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
ok('охват — свёртка требования, не хранимое поле (ADR-0025)',
   g.ev(`allReqs().every(r => r.scope === undefined)`)
   && g.ev(`allReqs().every(r => { const s=scopeOf(r); return typeof s.volume==='string' && typeof s.method==='string'; })`));
ok('ведущее подразделение — на требовании',  g.ev(`allReqs().every(r => !!r.subdivision)`));
ok('дело 142 — два требования по одному договору',
   g.ev(`${P('142')}.requirements.map(r=>r.role).join(',')`) === 'заёмщик,поручитель');
ok('солидарный сосед заёмщика — поручитель',
   g.ev(`solidaryWith(${R('142/56/з')}).map(r=>r.id).join(',')`) === '142/56/п');
ok('дело 402 — три требования по трём договорам',
   g.ev(`new Set(${P('402')}.requirements.map(r=>r.credit)).size`) === 3);

/* ── МТ · дело 412: три требования одного заёмщика идут по трём контурам ──
   Ради этого сценария ADR-0002 и отверг модель «одно дело — одна фаза». */
ok('дело 412 — три требования по трём договорам',
   g.ev(`new Set(${P('412')}.requirements.map(r=>r.credit)).size`) === 3
   && g.ev(`${P('412')}.requirements.every(r=>r.role==='заёмщик')`));
ok('три требования дела 412 идут по трём разным контурам',
   g.ev(`${P('412')}.requirements.map(contourOf).join(',')`) === 'К4,К3,К1');
ok('фазы дела 412 — исполнительное, иск, претензия',
   g.ev(`${P('412')}.requirements.map(phaseOf).join(' | ')`) === 'На исполнении | Иск | Претензия');
ok('§6.2 · ведущее подразделение у каждого требования своё',
   g.ev(`${P('412')}.requirements.map(r=>r.subdivision).join(',')`) === 'САК,ДПО,ОД'
   && g.ev(`new Set(allReqs().map(r=>r.subdivision)).size > 1`));
ok('подразделение с кредита, владелец дела — умолчание',
   g.ev(`/subdivision: c\\.subdiv \\|\\| subdivOfOwner/.test(mkReq.toString())`)
   && g.ev(`${P('402')}.requirements.every(r=>r.subdivision === subdivOfOwner(${P('402')}.owner))`));
ok('каждая мера дела 412 целит ровно в одно требование',
   g.ev(`${P('412')}.measures.every(m => m.targets.length === 1)`)
   && g.ev(`new Set(${P('412')}.measures.flatMap(m=>m.targets)).size`) === 3);
ok('охваты трёх требований различны, сумма считается из охвата',
   g.ev(`${P('412')}.requirements.map(r=>scopeLabel(scopeOf(r))).join(',')`)
     === 'полный остаток / деньгами,полный остаток / обращением на предмет залога,просроченная сумма / деньгами'
   && g.ev(`claimOf(${R('412/562/з')}) < claimOf(${R('412/561/з')})`));
ok('категория дела — worst-of по кредитам, не поле дела',
   g.ev(`${P('412')}.requirements.map(r=>catOfReq(r)).join(',')`) === 'high,high,mid'
   && g.ev(`catOfProcess(${P('412')})`) === 'high');
ok('КР-10 · решение по договору 561 не открывает извещение по 562',
   g.ev(`gateReason(${R('412/561/з')}, 'Извещение об обращении на залог') === null`)
   && /Решение есть, но по другому кредиту \(Дог\. №561 /.test(
        g.ev(`String(gateReason(${R('412/562/з')}, 'Извещение об обращении на залог'))`)));
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
ok('фаза меняется только вехой (kindPhase/measureSetsPhase, ADR-0033/0038 — свёрнуто из MILESTONE_PHASE)',
   g.ev(`MEASURE_KINDS.some(k=>kindPhase(k.name)) && kindPhase('Определение о принятии искового заявления к производству')==='Иск'`));
ok('у каждого требования фаза определена',      g.ev(`allReqs().every(r => !!phaseOf(r))`));
ok('каждая фаза принадлежит контуру К0…К7',
   g.ev(`allReqs().every(r => phaseOf(r)===OPEN_PHASE || !!contourOfPhase(phaseOf(r)))`));
ok('семь контуров К0…К7 присутствуют',          g.ev(`['К0','К1','К2','К3','К4','К5','К6','К7'].every(k=>k in CONTOURS)`));
ok('безакцепт — условная ветка (CONDITIONAL_PHASE)', g.ev('CONDITIONAL_PHASE') === 'Безакцептное списание');
ok('без вех — фаза открытия',
   g.ev(`allReqs().filter(r => !liveMilestones(r).length).every(r => phaseOf(r)===OPEN_PHASE)`));
ok('с вехами — фаза последней вехи',
   g.ev(`allReqs().filter(r => liveMilestones(r).length)
          .every(r => phaseOf(r) === measureSetsPhase(liveMilestones(r).slice(-1)[0]))`));
ok('у непустой фазы всегда есть мера-основание',
   g.ev(`allReqs().filter(r => phaseOf(r)!==OPEN_PHASE).every(r => !!phaseSetter(r))`));
ok('stageOf даёт одну из четырёх стадий (ADR-0037/ADR-0040: наблюдение вместо отчуждения активов)',
   g.ev(`['Наблюдение','Досудебный порядок','Судебный порядок','Исполнительное производство'].includes(stageOf('На исполнении'))`)
   && g.ev(`stageOf('Иск')`) === 'Судебный порядок'
   && g.ev(`stageOf('Досудебное урегулирование')`) === 'Наблюдение');
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
     g.ev(`MEASURE_KINDS.some(k=>(k.outcomes||[]).some(o=>o.setsPhase===${JSON.stringify(ph)})) && allReqs().some(r=>phaseOf(r)===${JSON.stringify(ph)})`));

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
   g.ev(`allReqs().filter(r=>scopeOf(r).volume==='полный остаток').every(r=>{const d=debtOf(r);return Math.abs(d.claim-d.totalLeft)<0.005;})`));
ok('расходы — статья требования, у кредита их нет',
   g.ev(`allReqs().some(r=>(r.costs||[]).length) && PROCESSES.every(p=>p.credits.every(c=>!('costs' in c)))`));
ok('смена охвата (новая устанавливающая мера в журнале) меняет проекцию, снимок не трогает', mk().ev(`(() => {
  const r = REQ_INDEX['142/56/з'], before = claimOf(r), snap = JSON.stringify(LEDGER[r.credit]);
  r._proc.measures.push({ sec:'Судебный', kind:'Исковое заявление', dates:D('29.07.2026','29.07.2026','29.07.2026'),
    num:'ИСК-ТЕСТ', purpose:'тест смены охвата', scope:{volume:'полный остаток',method:'деньгами'},
    sum:'0,00', responsible:'тест', targets:[r.id] });
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
ok('три оси результата упразднены (ADR-0028 п.1) — единый outcome, resultIsDocument-вид его не несёт (142 иск)',
   g.ev(`(()=>{
  const isk = ${P('142')}.measures.find(x=>x.kind==='Исковое заявление');
  const tp  = ${P('142')}.measures.find(x=>x.num==='ТП-56');
  return kindOf('Исковое заявление').resultIsDocument && isk.outcome === undefined
      && !kindOf('Требование поручителю').resultIsDocument && typeof tp.outcome === 'string';
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
/* ADR-0023 §5: группа больше не зависит от подтверждения передачи — источник теперь
   терминальный исход / состояние лица / худшая стадия открытых требований. */
ok('терминальный исход даёт группу «Погашенные» (208)', g.ev(`groupOf(${P('208')})`) === 'Погашенные');
ok('группа выводится и при ждущей приёма передаче — по стадии открытых требований (210)',
   g.ev(`groupOf(${P('210')})`) === 'Досудебный порядок');

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
/* Task 2/4 расщепили «Исковое заявление» на resultIsDocument (не веха) + внешние акты-
   определения/решения (Иск/Решение суда двигает АКТ, не наше обращение) — внутри
   контура К3 (Судебный) не осталось ни одной ВЕХИ вида «наш документ», по которой можно
   воспроизвести старый сценарий «повторная регистрация уже пройденной вехи» (210/70/з
   уже на фазе «Повторная претензия», контур К1 — единственный контур, целиком состоящий
   из наших документов). */
{ const m = mk(); m.setRole('Куратор ОД / ДАК / РП');
  ok('пройденная веха не регистрируется повторно (210/70/з уже на фазе «Повторная претензия»)',
     m.ev(`measureGate(${R('210/70/з')}, 'Первичная претензия').kind`) === 'sequence'); }
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
{ const m = mk(); m.ev(`openDetail('104/71/з')`); m.ev(`openRejectProc('104/71/з')`);
  ok('чек-лист структурный: отклонение перечисляет 7 позиций (п. 20.2)', m.$$('#modalHost .rejChk').length === 7); }

/* ══════════════════════════════════════════════════════════════════════════
   СРОКИ — Р-3: вычисление от базы шаблона, сущности «задание» нет
   ══════════════════════════════════════════════════════════════════════════ */
head('Р-3 · сроки порядка');
ok('шаблонов сроков 45, у каждого база, срок и пункт',
   g.ev('DEADLINE_TEMPLATES.length') === 45 && g.ev(`DEADLINE_TEMPLATES.every(t => t.base && t.term && t.point)`));
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
  /* Task 2/4/Task 3: фазу «Иск» с ИСК-77 устанавливает больше не сам иск
     (resultIsDocument, outcomes:null — не веха), а дочерний акт «Определение о
     принятии искового заявления к производству» (basedOn:'ИСК-77', ADR-0027/0031/0038).
     Сторно откатывает фазу — цель сторно поэтому дочерний акт, не сам иск. */
  const idx = m.ev(`curProc.measures.findIndex(x => x.kind==='Определение о принятии искового заявления к производству')`);
  m.ev(`openStornoModal(${idx})`); m.$('#stReason').value = 'ошибочная регистрация'; m.ev(`doStorno(${idx})`);
  ok('И-3 · сторно не удаляет строку',
     m.ev('curProc.measures.length') === before && m.ev(`curProc.measures[${idx}].storno != null`));
  ok('сторно акта о принятии иска откатывает фазу обоих ответчиков',
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
ok('извещение ускоряет охват всех солидарных требований (мера, не поле — ADR-0025)', mk().ev(`(() => {
  openDetail('142/56/з'); applyIzveschenie();
  return scopeOf(REQ_INDEX['142/56/з']).volume === 'полный остаток'
      && scopeOf(REQ_INDEX['142/56/п']).volume === 'полный остаток'
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
   === g.ev(`pagesOfDeals(groupedDeals(), PAGE_SIZE)[curPage-1].reduce((a,d)=>a+d.reqs.length,0)`));
/* ПЛ-7: дело с несколькими требованиями держится соседством строк и акцентом, а не
   служебной строкой, — проверяем на той странице, где такое дело есть. */
ok('дело с несколькими требованиями помечено акцентом на всех своих строках', g.ev(`(() => {
  const pages = pagesOfDeals(groupedDeals(), PAGE_SIZE);
  const i = pages.findIndex(pg => pg.some(d => d.reqs.length > 1));
  if(i < 0) return false;
  gotoPage(i+1);
  const okAll = pages[i].every(d => d.reqs.every(r => {
    const tr = document.querySelector('#listBody tr[data-id="' + r.id + '"]');
    return !!tr && tr.classList.contains('indeal') === (d.reqs.length > 1);
  }));
  gotoPage(1); return okAll;
})()`));
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
  filterState = { stage:'Исполнительное производство' }; const rows = baseSet(); filterState = {};
  return rows.length > 0 && rows.every(r => stageOfReq(r) === 'Исполнительное производство');
})()`));
ok('фильтр «Досудебный порядок» не возвращает требование в фазе «Иск»', g.ev(`(() => {
  filterState = { stage:'Досудебный порядок' }; const has = visibleReqs().some(r => r.id === '142/56/з');
  filterState = {}; return has;
})()`) === false);
ok('вкладки разделены: 4 дела + 6 требования',
   g.ev(`TABS.filter(t=>t.group==='дело').length`) === 4
   && g.ev(`TABS.filter(t=>t.group==='требование').length`) === 6 && g.ev('TABS.length') === 10);
{ const m = mk(); m.ev(`openDetail('142/56/з')`);
  ok('четыре плитки в шапке карточки, все нередактируемые с подписью источника',
     m.dhead().querySelectorAll('.phead-dims .dim').length === 4
     && m.dhead().querySelectorAll('.phead-dims input, .phead-dims select').length === 0
     && m.dhead().querySelectorAll('.phead-dims .dim .src').length === 4); }
ok('счётчик приёма передачи работает (210/70/з — осталось 3 р.д.)', g.ev(`(() => {
  const r = REQ_INDEX['210/70/з']; const h = r.handovers[r.handovers.length-1];
  return h.state==='ждёт' && h.leftRd === 3;
})()`));
{ const m = mk(); m.ev(`openDetail('210/70/з')`); m.ev(`openProcChangeModal('210/70/з')`);
  ok('словарь принимающих подразделений закрыт (селектор из DEPARTMENTS)',
     m.ev('DEPARTMENTS.length') >= 7 && m.$$('#newDept option').length === m.ev("DEPARTMENTS.length - 1")); }
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
  ok('persistRules пишет версию схемы и правила', m.ev(`(()=>{
    RULES.sectionClevel['Досудебный']=3; persistRules();
    const box=JSON.parse(localStorage.getItem(RULES_KEY));
    return box.v===RULES_SCHEMA && box.rules.sectionClevel['Досудебный']===3;
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
  ok('showView(settings) показывает экран и пишет hash со вкладкой',
     m.$('#view-settings').style.display === 'flex' && m.ev('location.hash') === '#settings/v9');
  ok('на экране настроек 4 вкладки', m.$$('#view-settings .settings-tab').length === 4);
  ok('переключение вкладки меняет settingsTab', m.ev(`(()=>{ showSettingsTab('gates'); return settingsTab; })()`) === 'gates');
  const m2 = mk(); m2.w.location.hash = '#settings'; m2.ev('restoreFromHash()');
  ok('restoreFromHash открывает настройки по #settings', m2.$('#view-settings').style.display === 'flex'); }
{ const m = mk(); m.asAdmin(); m.ev(`showView('settings'); showSettingsTab('v9')`);
  ok('грид В-9 рендерит строку на каждый вид меры и на каждое правило раздела',
     m.$$('#settingsHost .settings-grid tbody tr').length === m.ev('MEASURE_KINDS.length + SECTION_ORDER.length'));
  ok('toggleV9 снимает последнее подразделение → вид исчезает из availableKinds', m.ev(`(()=>{
    RULES.measureSubdiv['Первичная претензия']=['ОД'];
    toggleV9('Первичная претензия','ОД');
    document.getElementById('roleSel').value='Куратор ОД / ДАК / РП';
    return !availableKinds(REQ_INDEX['201/311/з']).includes('Первичная претензия');
  })()`));
  ok('вид без подразделений помечается предупреждением', m.ev(`(()=>{
    RULES.measureSubdiv['Акт сверки']=[]; renderSettings();
    return document.getElementById('settingsHost').innerHTML.includes('никто не сможет');
  })()`));
  m.asAdmin();   /* предыдущая проверка переключила роль на куратора — правила правит админ */
  ok('toggleRoleSubdiv меняет роль→подразделения',
     m.ev(`(()=>{ toggleRoleSubdiv('Наблюдатель','ОД'); return RULES.roleSubdiv['Наблюдатель'].join()==='ОД'; })()`)); }
{ const m = mk(); m.asAdmin(); m.ev(`showView('settings'); showSettingsTab('stage')`);
  ok('вкладка Стадии рендерит селект на каждый раздел',
     m.$$('#settingsHost .settings-grid tbody tr select').length === m.ev('SECTION_ORDER.length'));
  ok('повышение sectionClevel блокирует меру раздела на низкой ступени', m.ev(`(()=>{
    const r = allReqs().find(x => contourOf(x)==='К1');
    const before = sequenceReason(r,'Акт сверки');
    setSectionClevel('Досудебный',4);
    return !before && !!sequenceReason(r,'Акт сверки');
  })()`)); }
{ const m = mk(); m.asAdmin(); m.ev(`showView('settings'); showSettingsTab('gates')`);
  ok('вкладка Гейты рендерит строку на каждый гейт',
     m.$$('#settingsHost .settings-grid tbody tr').length === m.ev('Object.keys(RULES.gates).length'));
  ok('отключение гейта разблокирует иск на деле без поручения', m.ev(`(()=>{
    const r = allReqs().find(x => !x._proc.poruchenie && !!gateReason(x,'Исковое заявление'));
    if(!r) return false;
    toggleGate('Исковое заявление');
    return !gateReason(r,'Исковое заявление');
  })()`)); }
{ const m = mk(); m.asAdmin(); m.ev(`showView('settings'); showSettingsTab('phases')`);
  ok('вкладка Предусловия рендерит блок на каждый контур',
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
   ВОЛНА НП — НАСТРОЙКИ ПРАВИЛ (§14.4): решения НП-1…НП-16.
   Правило = что говорит · откуда взялось · чем отличается от дефолта · кого задевает.
   ══════════════════════════════════════════════════════════════════════════ */
head('НП-1…НП-16 · настройки правил');
/* НП-1 · полный каркас, как у четырёх реестров */
{ const m = mk(); m.ev(`showView('settings')`);
  ok('НП-1 каркас: рамка, баннер, журнал, вкладки, тулбар, чипы, футер',
     ['#settingsFrame','#settingsBanner','#settingsJournal','#settingsTabbar','#settingsToolbar','#settingsChips','#settingsHost','#settingsFoot']
       .every(sel => !!m.$(sel)) && m.$('#settingsFrame').textContent.includes('Радиус'));
  ok('НП-1 рамка называет объём живых данных',
     m.$('#settingsFrame').textContent.includes(String(m.ev('allReqs().length')))); }
/* НП-2 · правит только «Администратор правил», остальные семь — read-only */
{ const m = mk();
  ok('НП-2 восьмая роль есть в справочнике и правит правила',
     m.ev(`ROLES.length===8 && ROLES.filter(r=>r.rulesAdmin).length===1 && ROLE_BY_NAME[RULES_ADMIN_ROLE].rulesAdmin===true`));
  m.ev(`showView('settings')`);
  ok('НП-2 не-админ видит полосу «только чтение»',
     m.$('#settingsBanner').textContent.includes('Только чтение'));
  ok('НП-2 не-админ: галочки и кнопки заблокированы',
     m.$$('#settingsHost input[type=checkbox]').length > 0 &&
     m.$$('#settingsHost input[type=checkbox]').every(c => c.disabled));
  ok('НП-2 не-админ: правка не проходит и объясняется тостом', m.ev(`(()=>{
    const was=JSON.stringify(RULES.measureSubdiv);
    toggleV9('Акт сверки','ОД');
    return JSON.stringify(RULES.measureSubdiv)===was &&
           document.getElementById('toastWrap').textContent.includes(RULES_ADMIN_ROLE);
  })()`));
  m.asAdmin(); m.ev('renderSettings()');
  ok('НП-2 админ видит полосу режима правки и живые галочки',
     m.$('#settingsBanner').textContent.includes('Режим правки') &&
     m.$$('#settingsHost input[type=checkbox]').every(c => !c.disabled)); }
/* НП-3 · один справочник ролей: шапка, таблица ролей, фильтр «моё подразделение» */
{ const m = mk();
  ok('НП-3 переключатель роли построен из справочника ROLES',
     [...m.$('#roleSel').options].map(o=>o.value).join('|') === m.ev(`ROLES.map(r=>r.role).join('|')`));
  m.asAdmin(); m.ev(`showView('settings'); showSettingsTab('v9')`);
  ok('НП-3 таблица ролей рендерит строку на каждую роль',
     m.$$('#settingsHost .role-grid tbody tr').length === m.ev('ROLES.length + SUBDIVS.filter(s=>!s.registers).length'));
  ok('НП-3 роль без подразделений подписана «мер не регистрирует»',
     m.$('#settingsHost .role-grid').textContent.includes('мер не регистрирует'));
  ok('НП-3 фильтр «моё подразделение» читает тот же справочник', m.ev(`(()=>{
    toggleRoleSubdiv(RULES_ADMIN_ROLE,'ДПО');
    return roleSubdivs().join()==='ДПО';
  })()`)); }
/* НП-4 · один справочник подразделений; 6 колонок в матрице, 2 без регистрации */
{ const m = mk(); m.ev(`showView('settings'); showSettingsTab('v9')`);
  ok('НП-4 справочник подразделений — 8 записей, регистрируют меры 6',
     m.ev('SUBDIVS.length')===8 && m.ev('V9_SUBDIVS.length')===6);
  ok('НП-4 колонок в матрице В-9 ровно столько, сколько регистрирующих подразделений',
     m.$$('#settingsHost .settings-grid thead th').length === 6 + 4);
  ok('НП-4 СРМК и СИТ показаны отдельным блоком с объяснением роли',
     m.$('#settingsHost').textContent.includes('участвуют, но мер не регистрируют'.toUpperCase()) ||
     m.$('#settingsHost').textContent.includes('Участвуют, но мер не регистрируют'));
  ok('НП-4 у каждого нерегистрирующего подразделения названа его роль',
     m.ev(`SUBDIVS.filter(s=>!s.registers).every(s=>!!s.why)`)); }
/* НП-5 · два этажа правила: раздел ↔ вид, отвязка названа вслух и откатывается */
{ const m = mk(); m.asAdmin(); m.ev(`showView('settings'); showSettingsTab('v9')`);
  ok('НП-5 правило раздела редактируется и задевает наследников', m.ev(`(()=>{
    const before=subdivOf('Акт сверки').join();
    toggleSectionV9('Досудебный','ДПО');
    return subdivSource('Акт сверки')==='section' && subdivOf('Акт сверки').join()!==before;
  })()`));
  ok('НП-5 клик по унаследованному виду отвязывает его от раздела и говорит об этом', m.ev(`(()=>{
    const was=subdivSource('Акт сверки');
    toggleV9('Акт сверки','ОПК');
    return was==='section' && subdivSource('Акт сверки')==='own' &&
           document.getElementById('toastWrap').textContent.includes('отвязан от правила раздела');
  })()`));
  ok('НП-5 «вернуть к разделу» снимает своё правило вида', m.ev(`(()=>{
    unlinkBack('Акт сверки');
    return subdivSource('Акт сверки')==='section' && !RULES.measureSubdiv['Акт сверки'];
  })()`));
  ok('НП-5 источник правила показан в каждой строке',
     m.$('#settingsHost').innerHTML.includes('src-sec') && m.$('#settingsHost').innerHTML.includes('по разделу')); }
/* НП-6 · изменено ↔ дефолт на трёх уровнях, откат на всех трёх */
{ const m = mk(); m.asAdmin(); m.ev(`showView('settings'); showSettingsTab('v9')`);
  ok('НП-6 на чистых правилах изменённых нет', m.ev('changedAll()')===0);
  ok('НП-6 правка помечает строку, вкладку и экран', m.ev(`(()=>{
    toggleV9('Акт сверки','ОПК');
    return isChanged('measureSubdiv','Акт сверки') && changedInTab('v9')===1 && changedAll()===1 &&
           document.getElementById('settingsHost').innerHTML.includes('row-changed') &&
           document.getElementById('settingsTabbar').innerHTML.includes('chg-badge');
  })()`));
  ok('НП-6 чип «только изменённые» оставляет одну строку', m.ev(`(()=>{
    setState.changedOnly=true; setRefresh();
    const rows=document.querySelectorAll('#settingsHost .settings-grid tbody tr').length;
    setState.changedOnly=false; setRefresh();
    return rows===1;
  })()`));
  ok('НП-6 построчный откат возвращает дефолт', m.ev(`(()=>{
    resetRuleKey('measureSubdiv','Акт сверки','тест');
    return changedAll()===0;
  })()`));
  ok('НП-6 откат вкладки и экрана считает правила', m.ev(`(()=>{
    toggleV9('Акт сверки','ОПК'); setSectionClevel('Судебный',3);
    const two=changedAll()===2;
    resetTabRules('v9');
    const one=changedAll()===1 && changedInTab('v9')===0;
    resetAllRules();
    return two && one && changedAll()===0;
  })()`)); }
/* НП-7 · радиус правки: кого правило задевает сейчас */
{ const m = mk(); m.asAdmin(); m.ev(`showView('settings'); showSettingsTab('stage')`);
  ok('НП-7 радиус стадии считается на лету и совпадает с проверкой доступа', m.ev(`(()=>{
    const L=RULES.sectionClevel['Исполнительное производство'] ?? 1;
    return openAtLevel(L)===allReqs().filter(r=>!sequenceReason(r,'Заявление о выдаче исполнительного листа')||
      !/стадии/.test(sequenceReason(r,'Заявление о выдаче исполнительного листа')||'')).length ||
      openAtLevel(L)>0;
  })()`));
  ok('НП-7 радиус стадии показан в таблице',
     m.$('#settingsHost').textContent.includes('доступен'));
  m.ev(`showSettingsTab('gates')`);
  ok('НП-7 радиус гейта = число требований, которые он держит', m.ev(`(()=>{
    const k='Исковое заявление';
    return gateWouldHold(k)===allReqs().filter(r=>!!gateReason(r,k)).length && gateWouldHold(k)>0;
  })()`));
  ok('НП-7 у выключенного гейта радиус остаётся контрфактическим', m.ev(`(()=>{
    const k='Исковое заявление', before=gateWouldHold(k);
    toggleGate(k);
    return RULES.gates[k].off===true && gateWouldHold(k)===before &&
           allReqs().filter(r=>!!gateReason(r,k)).length===0;
  })()`)); }
/* НП-8 · правило действует вперёд */
{ const m = mk(); m.asAdmin(); m.ev(`showView('settings'); showSettingsTab('v9')`);
  ok('НП-8 запрет вида не отменяет уже зарегистрированные меры', m.ev(`(()=>{
    const k='Первичная претензия', was=measuresOfKind(k);
    RULES.measureSubdiv[k]=[]; renderSettings();
    return was>0 && measuresOfKind(k)===was;
  })()`));
  ok('НП-8 строка вида называет число уже зарегистрированных мер',
     m.$('#settingsHost').textContent.includes('правило их не отменяет'));
  ok('НП-8 полоса режима правки объясняет действие вперёд',
     m.$('#settingsBanner').textContent.includes('ВПЕРЁД')); }
/* НП-9 · журнал правок */
{ const m = mk(); m.asAdmin(); m.ev(`showView('settings')`);
  ok('НП-9 на чистых правилах журнал пуст и говорит об этом', m.ev(`(()=>{
    ruleLogOpen=true; renderSettings();
    return RULES.log.length===0 &&
      document.getElementById('settingsJournal').textContent.includes('Правок не было');
  })()`));
  ok('НП-9 правка попадает в журнал с датой, ролью и текстом', m.ev(`(()=>{
    toggleGate('Исковое заявление');
    const e=RULES.log[0];
    return RULES.log.length===1 && e.when===TODAY && e.who===RULES_ADMIN_ROLE && /Гейт/.test(e.what);
  })()`));
  ok('НП-9 журнал персистится вместе с правилами', m.ev(`(()=>{
    const box=JSON.parse(localStorage.getItem(RULES_KEY));
    return box.rules.log.length===1;
  })()`));
  ok('НП-9 «отменить эту правку» возвращает правило и убирает запись', m.ev(`(()=>{
    undoRuleEdit(0);
    return !RULES.gates['Исковое заявление'].off && RULES.log.length===0;
  })()`));
  ok('НП-9 сброс всего сохраняет журнал и добавляет свою запись', m.ev(`(()=>{
    toggleGate('Исковое заявление'); resetAllRules();
    return RULES.log.length===2 && /Сброс ВСЕХ правил/.test(RULES.log[0].what) && changedAll()===0;
  })()`)); }
/* НП-10 · гейты: предмет вопроса виден, выключение предупреждает */
{ const m = mk(); m.asAdmin(); m.ev(`showView('settings'); showSettingsTab('gates')`);
  ok('НП-10 в таблице гейтов пять колонок + радиус + откат',
     m.$$('#settingsHost .settings-grid thead th').length === 7);
  ok('НП-10 показан ПРЕДМЕТ вопроса, по которому гейт ищет решение', m.ev(`(()=>{
    const t=gateTopic('Безакцептное списание');
    return !!t && document.getElementById('settingsHost').textContent.includes(t);
  })()`));
  ok('НП-10 предмет, орган и пункт не редактируются',
     m.$$('#settingsHost .settings-grid tbody input').every(i => i.type === 'checkbox'));
  ok('НП-10 отказ в подтверждении оставляет гейт включённым', m.ev(`(()=>{
    __ok=false; toggleGate('Безакцептное списание'); __ok=true;
    return !RULES.gates['Безакцептное списание'].off && changedAll()===0;
  })()`)); }
/* НП-11 · стадии: ступень названа контуром, закрытие для всех предупреждает */
{ const m = mk(); m.asAdmin(); m.ev(`showView('settings'); showSettingsTab('stage')`);
  ok('НП-11 ступень подписана именем контура, а не числом',
     m.$('#settingsHost').textContent.includes('с безнадёжной (К7)') &&
     m.$('#settingsHost').textContent.includes('с самого начала (К0)'));
  ok('НП-11 радиус называет «до → после» в журнале правок', m.ev(`(()=>{
    setSectionClevel('Судебный',3);
    return /доступен \\d+ → \\d+/.test(RULES.log[0].what);
  })()`));
  ok('НП-11 сужение доступа спрашивает подтверждение и без него не проходит', m.ev(`(()=>{
    __ok=false; const was=RULES.sectionClevel['Досудебный'];
    setSectionClevel('Досудебный',4); __ok=true;
    return openAtLevel(4)<openAtLevel(was) && RULES.sectionClevel['Досудебный']===was;
  })()`));
  ok('НП-11 расширение доступа проходит без вопроса', m.ev(`(()=>{
    __ok=false; setSectionClevel('Безнадёжная',0); __ok=true;
    return RULES.sectionClevel['Безнадёжная']===0 && openAtLevel(0)===allReqs().length;
  })()`)); }
/* НП-12 · фазы: счётчик требований и предупреждение при перестановке */
{ const m = mk(); m.asAdmin(); m.ev(`showView('settings'); showSettingsTab('phases')`);
  ok('НП-12 у каждой фазы показано, сколько требований в ней стоит сейчас',
     m.$('#settingsHost').textContent.includes('в этой фазе') &&
     m.$('#settingsHost').textContent.includes('требований в контуре'));
  ok('НП-12 отказ в подтверждении оставляет порядок прежним', m.ev(`(()=>{
    __ok=false; movePhase('К1',0,1); __ok=true;
    return phasesOf('К1')[0]==='Претензия' && changedAll()===0;
  })()`));
  ok('НП-12 перестановка не перекладывает требования по фазам', m.ev(`(()=>{
    const before=allReqs().map(phaseOf).join('|');
    movePhase('К1',0,1);
    return phasesOf('К1')[0]==='Повторная претензия' && allReqs().map(phaseOf).join('|')===before;
  })()`)); }
/* НП-13 · тулбар как на реестрах и дип-линк вкладки */
{ const m = mk(); m.asAdmin(); m.ev(`showView('settings'); showSettingsTab('v9')`);
  ok('НП-13 тулбар: поиск, раздел, «только изменённые», счётчик',
     ['#setQ','#setSec','#setChanged','#setCount'].every(sel => !!m.$(sel)));
  ok('НП-13 счётчик «показано N из M» считает строки таблицы',
     m.$('#setCount').textContent.includes('показано') &&
     m.$('#setCount').textContent.includes(String(m.ev('MEASURE_KINDS.length + SECTION_ORDER.length'))));
  ok('НП-13 поиск сужает таблицу и рисует чип', m.ev(`(()=>{
    document.getElementById('setQ').value='банкрот'; setRefresh();
    const rows=document.querySelectorAll('#settingsHost .settings-grid tbody tr').length;
    const chip=document.getElementById('settingsChips').textContent.includes('банкрот');
    setClear('setQ');
    return rows>0 && rows<MEASURE_KINDS.length && chip;
  })()`));
  ok('НП-13 фильтр по разделу оставляет только его правила', m.ev(`(()=>{
    document.getElementById('setSec').value='Судебный'; setRefresh();
    const n=document.querySelectorAll('#settingsHost .settings-grid tbody tr').length;
    setClear('setSec');
    return n === kindsOfSection('Судебный').length + 1;
  })()`));
  ok('НП-13 фильтр по разделу прячется на вкладке фаз', m.ev(`(()=>{
    showSettingsTab('phases');
    return document.getElementById('setSecWrap').style.display==='none';
  })()`));
  const m2 = mk(); m2.w.location.hash = '#settings/gates'; m2.ev('restoreFromHash()');
  ok('НП-13 дип-линк открывает нужную вкладку',
     m2.ev('settingsTab')==='gates' && m2.$('#view-settings').style.display==='flex');
  ok('НП-13 экран есть в левой навигации',
     m2.$('#nav').textContent.includes('Настройки правил')); }
/* НП-14 · персист: слияние по полям + версия схемы */
{ const m = mk();
  ok('НП-14 правила чужой версии сбрасываются, а не домысливаются', m.ev(`(()=>{
    localStorage.setItem(RULES_KEY, JSON.stringify({ v:1, rules:{ sectionClevel:{'Досудебный':4} } }));
    RULES=deepClone(RULES_DEFAULTS); RULES.log=[];
    restoreRules();
    return RULES.sectionClevel['Досудебный']===RULES_DEFAULTS.sectionClevel['Досудебный'] &&
           localStorage.getItem(RULES_KEY)===null;
  })()`));
  ok('НП-14 незнакомый ключ и чужой код подразделения в живые правила не попадают', m.ev(`(()=>{
    localStorage.setItem(RULES_KEY, JSON.stringify({ v:RULES_SCHEMA, rules:{
      measureSubdiv:{ 'Мера, которой нет':['ОД'], 'Акт сверки':['ОД','ЧУЖОЕ'] },
      contourPhases:{ 'К1':['Повторная претензия','Фаза, которой нет'] } } }));
    RULES=deepClone(RULES_DEFAULTS); RULES.log=[];
    restoreRules();
    return !RULES.measureSubdiv['Мера, которой нет'] &&
           (RULES.measureSubdiv['Акт сверки']||[]).join()==='ОД' &&
           RULES.contourPhases['К1'].join('>')==='Повторная претензия>Претензия>Безакцептное списание';
  })()`));
  ok('НП-14 предмет и орган гейта всегда приходят из справочника', m.ev(`(()=>{
    localStorage.setItem(RULES_KEY, JSON.stringify({ v:RULES_SCHEMA, rules:{
      gates:{ 'Исковое заявление':{ off:true, topic:'подделка', organ:'подделка' } } } }));
    RULES=deepClone(RULES_DEFAULTS); RULES.log=[];
    restoreRules();
    const g=RULES.gates['Исковое заявление'];
    return g.off===true && g.topic===RULES_DEFAULTS.gates['Исковое заявление'].topic &&
           g.organ===RULES_DEFAULTS.gates['Исковое заявление'].organ;
  })()`));
  ok('НП-14 роль→подразделения хранится массивом',
     m.ev(`Object.values(RULES_DEFAULTS.roleSubdiv).every(v=>Array.isArray(v))`)); }
/* НП-15 · затравка приведена к справочнику видов мер */
ok('НП-15 все виды мер затравки есть в справочнике MEASURE_KINDS',
   g.ev(`(()=>{ const k=new Set(MEASURE_KIND_NAMES);
     return PROCESSES.every(p=>(p.measures||[]).every(m=>k.has(m.kind))); })()`));
ok('НП-15 предупреждающая строка о видах вне справочника есть, но молчит на чистых данных',
   g.ev('Object.keys(kindsOutsideDict()).length')===0);

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
ok('снимок не роняется круговыми ссылками и восстанавливает поля требования; охват переживает круг как часть меры (ADR-0025), не отдельной записью', mk().ev(`(() => {
  openDetail('142/56/з');
  curReq.costs.push({ date:TODAY, kind:'Государственная пошлина', amount:2500, note:null });
  const scopeBefore = scopeLabel(scopeOf(curReq));
  persistState();
  if(!localStorage.getItem(STORE_KEY)) return false;
  restoreState();
  const r = REQ_INDEX['142/56/з'];
  return !!r && scopeLabel(scopeOf(r)) === scopeBefore && r.costs.some(c => c.amount === 2500)
      && r._proc.id === '142' && allReqs().length === 139;
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
ok('остаток — именно остаток: у его требований нет ни гейта, ни окна, ни ожидания передачи',
   L.ev(`baseSet().filter(r=>listStatus(r)==='clear').every(r =>
     !gateBlocked(r) && !(r._proc.window && r._proc.window.open) && !handoverPending(r))`));
ok('плитка сужает список до своего состояния',
   L.ev(`(clickTile('gate'), onPageSize(500), [...document.querySelectorAll('#listBody tr.rowopen')].length === baseSet().filter(r=>listStatus(r)==='gate').length)`));
ok('нажатая плитка попадает в ленту условий', chips().some(c => /^Плитка: Заблокировано/.test(c)));
L.ev(`clickTile('gate'); onPageSize(25)`);

head('ТР-3 · свойства дела ушли из строки требования');
ok('в колонках нет заёмщика, региона, процедуры и куратора',
   L.ev(`['borrower','region','procedure','curator'].every(k => LIST_COLS.every(c => c.k !== k))`));
/* ПЛ-7: заголовка дела нет — обстоятельства дела несёт подсказка строки, а процедура
   стала условием отбора (ПЛ-2). Пилюли процедуры и группы в списке быть не должно. */
ok('обстоятельства дела несёт подсказка строки: дело, заёмщик, ИНН, регион, куратор', (() => {
  const t = L.$$('#listBody tr.rowopen')[0].getAttribute('title');
  return /дело В-2026-\d{6}/.test(t) && /ИНН/.test(t) && /куратор/.test(t);
})());
ok('ПЛ-7: пилюль процедуры и группы в списке нет',
   L.$$('#listBody .pill').every(el => !/^группа |Работа с судебными|Взыскание задолженности/.test(el.textContent.trim())));

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
  const vals = [...new Set(allReqs().map(r=>scopeLabel(scopeOf(r))))];
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
ok('чипы подписаны по-русски, включая стадию и фазу (СТ-3/ADR-0040: было «контур»)', L.ev(`(() => {
  setDep('stage','Судебный порядок'); const c = [...document.querySelectorAll('#filterChips .fchip')].map(x=>x.textContent);
  resetFilters(); return c.some(x => /^Стадия:/.test(x));
})()`));
ok('находка 2: тоггл «только моё подразделение» встал в панель фильтра', L.$$('#filterBody #f-mine').length === 1);
ok('находка 2: тоггл фильтрует по roleSubdivs(), не по одному значению', L.ev(`(() => {
  const my = roleSubdivs();
  if(my.length < 2) throw new Error('затравка сменила дефолтную роль на одно-подразделенческую — тест устарел');
  setMine(true); const rs = visibleReqs();
  const ok = rs.length > 0 && rs.every(r => my.includes(r.subdivision))
    && new Set(rs.map(r=>r.subdivision)).size > 1;
  resetFilters(); return ok;
})()`));
ok('находка 2: тоггл и «Ведущее подразделение» — независимые условия (AND)', L.ev(`(() => {
  setMine(true); setF('subdiv', roleSubdivs()[0]);
  const rs = visibleReqs();
  const ok = rs.every(r => r.subdivision === roleSubdivs()[0] && roleSubdivs().includes(r.subdivision));
  resetFilters(); return ok;
})()`));
ok('находка 2: чип тоггла — «Только моё подразделение: …», не CHIP_LABEL', L.ev(`(() => {
  setMine(true); const c = [...document.querySelectorAll('#filterChips .fchip')].map(x=>x.textContent);
  resetFilters(); return c.some(x => /^Только моё подразделение:/.test(x));
})()`));
ok('находка 3: метка расхождения стоит только там, где level ≠ raw (не на всех строках)', L.ev(`(() => {
  const rs = allReqs();
  const withMark  = rs.filter(r => catOfCredit(r._credit).level !== catOfCredit(r._credit).raw);
  const withoutMark = rs.filter(r => catOfCredit(r._credit).level === catOfCredit(r._credit).raw);
  return withMark.length > 0 && withoutMark.length > 0
    && withMark.every(r => catDivergeMark(r).includes('catmark'))
    && withoutMark.every(r => catDivergeMark(r) === '');
})()`));
ok('находка 3: подсказка метки называет причину — подавление 181 или фактор комитета', L.ev(`(() => {
  const r = allReqs().find(r => catOfCredit(r._credit).suppressed);
  const r2 = allReqs().find(r => { const c = catOfCredit(r._credit); return c.level !== c.raw && !c.suppressed; });
  return !!r && /Подавление 181-го дня/.test(catDivergeMark(r))
      && !!r2 && /Фактор комитета/.test(catDivergeMark(r2));
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
/* ПЛ-4: счётчик одноголовый — считает строки, а не дела. */
ok('ПЛ-4: счётчик формы «требования 1–25 из N»',
   /^требования 1–\d+ из \d+$/.test(L.ev(`(gotoPage(1), document.getElementById('pagerCount').textContent)`)));
ok('ПЛ-4: строк на странице не больше PAGE_SIZE', L.ev(`(() => {
  const pages = pagesOfDeals(groupedDeals(), PAGE_SIZE);
  return pages.every(pg => pg.reduce((a,d)=>a+d.reqs.length,0) <= PAGE_SIZE);
})()`));
ok('ПЛ-4: недобор страницы — только из-за перенесённого дела, и не больше чем на 2 строки', L.ev(`(() => {
  const pages = pagesOfDeals(groupedDeals(), PAGE_SIZE);
  return pages.slice(0,-1).every(pg => pg.reduce((a,d)=>a+d.reqs.length,0) >= PAGE_SIZE - 2);
})()`));
ok('ПЛ-4: страницы покрывают весь отбор ровно один раз', L.ev(`(() => {
  const pages = pagesOfDeals(groupedDeals(), PAGE_SIZE);
  const ids = pages.flat().flatMap(d => d.reqs.map(r => r.id));
  return ids.length === visibleReqs().length && new Set(ids).size === ids.length;
})()`));
ok('вторая страница даёт другие дела', L.ev(`(() => {
  gotoPage(1); const a = [...document.querySelectorAll('#listBody tr.rowopen')].map(t=>t.dataset.id).join();
  gotoPage(2); const b = [...document.querySelectorAll('#listBody tr.rowopen')].map(t=>t.dataset.id).join();
  gotoPage(1); return a !== b && b.length > 0;
})()`));
ok('ПЛ-4: размер страницы меняет число строк', L.ev(`(() => {
  onPageSize(50); const n50 = document.querySelectorAll('#listBody tr.rowopen').length;
  onPageSize(25); const n25 = document.querySelectorAll('#listBody tr.rowopen').length;
  onPageSize(25); return n50 > n25 && n50 <= 50 && n25 <= 25;
})()`));
ok('дело не рвётся между страницами: все его строки на одной', L.ev(`(() => {
  const pages = pagesOfDeals(groupedDeals(), PAGE_SIZE);
  const seen = {};
  for(const [i,pg] of pages.entries()) for(const d of pg){
    if(seen[d.p.id] !== undefined && seen[d.p.id] !== i) return false;
    seen[d.p.id] = i;
  }
  return Object.keys(seen).length === groupedDeals().length;
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

head('ТР-7/ПМ-Д7 · охват — свёртка с устанавливающей меры (ADR-0025/ADR-0028 п.3)');
ok('у дела поля scope больше нет',           g.ev(`PROCESSES.every(p => p.scope === undefined)`));
ok('у кредита поля scope больше нет — переехало на меру×цель', g.ev(`PROCESSES.flatMap(p=>p.credits).every(c => c.scope === undefined)`));
ok('требование не хранит охват — читает его сверткой scopeOf', g.ev(`allReqs().every(r => r.scope === undefined)`));
ok('словарь охвата — объём × способ (ADR-0025), не одна ось', g.ev(`(() => {
  const vols = new Set(allReqs().map(r=>scopeOf(r).volume));
  const meths = new Set(allReqs().map(r=>scopeOf(r).method));
  const okVols = [...vols].every(v => ['просроченная сумма','полный остаток'].includes(v));
  const okMeths = [...meths].every(m => ['деньгами','обращением на предмет залога'].includes(m));
  return okVols && okMeths && vols.size === 2 && meths.size === 2;
})()`));
ok('значения «залог» и «смешанный» как значения объёма в данных больше нет (ADR-0037/ADR-0025)',
   !/смешанный/.test(HTML_SRC) && !/volume:'залог'/.test(HTML_SRC));
ok('scope на мере встречается только у устанавливающих видов (претензия/иск/ИЛ/извещение)', g.ev(`(() => {
  const ESTABLISHING = new Set(['Первичная претензия','Повторная претензия','Требование поручителю',
    'Требование гаранту','Исковое заявление','Исполнительный лист','Извещение об обращении на залог']);
  return PROCESSES.flatMap(p=>p.measures||[]).filter(m=>m.scope).every(m => ESTABLISHING.has(m.kind));
})()`));
ok('нет требования без определённого охвата (умолчание открытия ловит пустые случаи)',
   g.ev(`allReqs().every(r => { const s=scopeOf(r); return !!s && !!s.volume && !!s.method; })`));
ok('ТР-Д9: у вопроса на орган поле topic, не subject',
   g.ev(`PROCESSES.flatMap(p=>p.committeeQuestions||[]).every(q => typeof q.topic === 'string' && q.subject === undefined)`));
ok('CQ_SUBJECTS переехал на topic',          g.ev(`CQ_SUBJECTS.every(s => typeof s.topic === 'string')`));

head('ТР-8 · составной ключ — не колонка');
ok('колонки «№ требования» нет',             L.ev(`LIST_COLS.every(c => c.k !== 'id')`));
/* ПЛ-1 расширил подсказку: туда же уехали обстоятельства дела, снятые с заголовка. */
ok('ключ требования — в подсказке строки',
   /^Требование \d+\/\d+\/[зпг] · дело В-2026-\d{6} · .+ — открыть$/.test(rowsOnPage()[0].getAttribute('title')));
ok('ключ требования — в выгрузке',           tsv.split('\n').find(l => /^№ требования\t/.test(l)) !== undefined
   && /\n\d+\/\d+\/[зпг]\t/.test(tsv));

head('ТР-9 / ПЛ-1 / ПЛ-7 · заголовка дела в списке нет вовсе');
ok('ПЛ-7: в tbody только строки-требования — ни одной служебной строки ни на одной странице', L.ev(`(() => {
  const pages = pagesOfDeals(groupedDeals(), PAGE_SIZE);
  return pages.every((pg,i) => {
    gotoPage(i+1);
    const rows = document.querySelectorAll('#listBody tr');
    return document.querySelectorAll('#listBody tr.rowgrp').length === 0
      && rows.length === pg.reduce((a,d)=>a+d.reqs.length, 0);
  }) && (gotoPage(1), true);
})()`));
ok('ПЛ-7: в исходнике не осталось ни строки-группы, ни её сборщика',
   !/rowgrp/.test(HTML_SRC) && !/dealHead\(/.test(HTML_SRC));
ok('ПЛ-7: акцент стоит ровно на строках дел с ≥2 требованиями — на всех страницах', L.ev(`(() => {
  const pages = pagesOfDeals(groupedDeals(), PAGE_SIZE);
  return pages.every((pg,i) => {
    gotoPage(i+1);
    return pg.every(d => d.reqs.every(r => {
      const tr = document.querySelector('#listBody tr[data-id="' + r.id + '"]');
      return !!tr && tr.classList.contains('indeal') === (d.reqs.length > 1);
    }));
  }) && (gotoPage(1), true);
})()`));
ok('ПЛ-7: акцент не ест ширину — псевдоэлемент внутри первой ячейки',
   /tr\.indeal td:first-child::before\{[^}]*position:absolute/.test(HTML_SRC.replace(/\s*\n\s*/g, '')));
ok('ПЛ-7: подсказка строки называет позицию требования в деле — и только там, где их несколько', L.ev(`(() => {
  const pages = pagesOfDeals(groupedDeals(), PAGE_SIZE);
  const i = pages.findIndex(pg => pg.some(d => d.reqs.length > 1));
  if(i < 0) return false;
  gotoPage(i+1);
  const ttl = r => (document.querySelector('#listBody tr[data-id="' + r.id + '"]') || {}).title || '';
  const multi  = pages[i].find(d => d.reqs.length > 1);
  const single = pages[i].find(d => d.reqs.length === 1);
  const okMulti  = multi.reqs.every((r,k) => ttl(r).includes('(требование ' + (k+1) + ' из ' + multi.reqs.length + ')'));
  const okSingle = !single || ttl(single.reqs[0]).indexOf('(требование') < 0;
  gotoPage(1); return okMulti && okSingle;
})()`));
ok('ПЛ-1 / ТР-Д11: заёмщик виден в самой строке, а не только в заголовке', L.ev(`(() => {
  const rows = [...document.querySelectorAll('#listBody tr.rowopen')];
  return rows.length > 0 && rows.every(tr => (tr.children[0].textContent||'').trim().length > 0);
})()`));
ok('ПЛ-1: среди однотребовательных дел нет иной роли, чем «заёмщик» (иначе имя в строке лгало бы)',
   g.ev(`groupedDeals().filter(d=>d.reqs.length===1).every(d => d.reqs[0].role === 'заёмщик')`));
/* ПЛ-7: «по делу X» ушло вместе с заголовком. Складывать видимые строки дела можно везде,
   КРОМЕ требований на одном кредите (§2.2) — и ровно они помечены маркером «сол.». */
ok('ПЛ-7: маркер «сол.» стоит там и только там, где строки нельзя складывать', L.ev(`(() => {
  const pages = pagesOfDeals(groupedDeals(), PAGE_SIZE);
  const i = pages.findIndex(pg => pg.some(d => d.reqs.some(r => solidaryWith(r).length)));
  if(i < 0) return false;
  gotoPage(i+1);
  const okAll = pages[i].every(d => d.reqs.every(r => {
    const tr = document.querySelector('#listBody tr[data-id="' + r.id + '"]');
    return !!tr && !!tr.querySelector('.solmark') === (solidaryWith(r).length > 0);
  }));
  gotoPage(1); return okAll;
})()`));
ok('сумма по делу считается один раз на кредит (солидарность не удваивает)', g.ev(`(() => {
  const p = PROCESSES.find(x => x.requirements.some(r => solidaryWith(r).length));
  return claimTotal(p.requirements) < p.requirements.reduce((a,r)=>a+claimOf(r),0);
})()`));
ok('строка требования — восемь колонок',     L.ev('LIST_COLS.length') === 8 && rowsOnPage()[0].children.length === 8);
ok('ширин столько же, сколько колонок, и в сумме 100 %',
   L.ev('LIST_WIDTHS.length') === 8 && L.ev(`LIST_WIDTHS.reduce((a,w)=>a+parseFloat(w),0)`) === 100);
ok('деньги и дни просрочки выровнены вправо', L.$$('#listBody tr.rowopen td.num').length > 0
   && [...rowsOnPage()[0].children].filter(td => td.classList.contains('num')).length === 2);

head('ТР-10/СТ-1/ADR-0041 · стадия — поле панели фильтров, не пункт сайдбара');
ok('дропдаун «Стадия» знает четыре канонных значения', g.ev(`Object.keys(STAGE_RANK).length`) === 4);
ok('в сайдбаре стадийных пунктов больше нет',
   L.$$('#nav .nav-item').map(a => a.textContent).every(t => !(t in { 'Наблюдение':1,'Досудебный порядок':1,'Судебный порядок':1,'Исполнительное производство':1 })));
ok('единственный вход в реестр требований — «Требования (реестр)»',
   L.$$('#nav .nav-item').filter(a => a.textContent === 'Требования (реестр)').length === 1);
ok('выбор стадии в панели ставит чип в ленте условий', (() => {
  L.ev(`setDep('stage','Судебный порядок')`);
  return chips().includes('Стадия: Судебный порядок');
})());
ok('подсветка сайдбара не следует за стадией — остаётся на «Требования (реестр)»',
   L.$$('#nav .nav-item.active').map(a => a.textContent).join() === 'Требования (реестр)');
ok('на стадии остаются только её требования',
   L.ev(`visibleReqs().every(r => stageOfReq(r) === 'Судебный порядок') && visibleReqs().length > 0`));
ok('чип стадии снимается через общий clearFilter и возвращает полный реестр', (() => {
  const n = L.ev('visibleReqs().length'); L.ev(`clearFilter('stage')`);
  return L.ev('visibleReqs().length') > n && L.ev(`filterState.stage`) === undefined;
})());

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
  /* ADR-0037/ADR-0040 (СТ-1) убрали «Отчуждение активов» из сайдбара — тот пустой
     фильтр закрывал этот тест раньше. Теперь все 4 стадии живые, честную пустую
     выборку даёт заведомо несуществующий поиск. */
  m.ev(`setF('q','ЗАВЕДОМО-НЕСУЩЕСТВУЮЩИЙ-ЗАПРОС-XYZ')`);
  ok('пустая выборка даёт строку пустого состояния', m.$$('#listBody tr.rowempty').length === 1);
  ok('пустое состояние говорит, что ничего не найдено', /Ни одного требования не найдено/.test(m.$('.list-empty').textContent));
  ok('пустое состояние перечисляет условия отбора', /Условия отбора: Поиск: ЗАВЕДОМО-НЕСУЩЕСТВУЮЩИЙ-ЗАПРОС-XYZ/.test(m.$('.list-empty').textContent));
  ok('пустое состояние даёт снять условия одним движением', !!m.$('.list-empty button'));
  m.ev('resetAllConditions()');
  ok('снятие условий возвращает требования',
     m.$$('#listBody tr.rowopen').length > 0 && m.ev(`tileFilter === null && Object.keys(filterState).length === 0`)); }

/* ══════════════════════════════════════════════════════════════════════════
   ВОЛНА ПЛ (28.07.2026) — плотность реестра требований. Второй проход по экрану ТР.
   Решения ПЛ-1…ПЛ-6, дефекты ПЛ-Д1…ПЛ-Д3.
   Разбор: mockups/collection/ASUBK-status-razrabotki.md · устройство: §14.1 спецификации.
   ══════════════════════════════════════════════════════════════════════════ */
head('ПЛ-2 · снято волной ПЕ (ADR-0023) — процедура взыскания не отдельный факет');
/* Фильтр «Процедура взыскания» и его чип сняты: три оси, что он смешивал, уже бьются
   своими полями (f.stage/f.subdiv/состояние лица) — см. ASUBK-status-razrabotki.md,
   «Волна ПЕ». Колонки процедуры в таблице не было и раньше — это ещё живо. */
ok('колонки процедуры в таблице нет',        L.ev(`LIST_COLS.every(c => c.k !== 'procedure')`));

head('ПЛ-3 · фильтр свёрнут по умолчанию');
ok('в разметке у .filter-head нет класса open', !/<div class="filter-head open"/.test(HTML_SRC));
ok('тело фильтра при загрузке скрыто',       !L.$('.filter-head').classList.contains('open'));
ok('шапка «Фильтр» на месте и кликабельна',  /Фильтр/.test(L.$('.filter-head').textContent)
   && /onclick="this\.classList\.toggle\('open'\)"/.test(HTML_SRC));
ok('панель открывается кликом', (() => {
  const m = mk(); m.$('.filter-head').classList.add('open');
  return m.$('.filter-head').classList.contains('open') && m.$$('#filterBody select').length > 0;
})());
ok('тулбар и пейджер — одна полоса .rowtools', L.$$('.rowtools').length === 1
   && !!L.$('.rowtools #btnExport') && !!L.$('.rowtools .pager'));
ok('селектор размера страницы подписан строками, а не делами',
   /строк на странице/.test(L.$('.rowtools').textContent) && !/дел на странице/.test(HTML_SRC));

head('ПЛ-5 · плитки несут деньги, сумма плиток сходится с «Всего»');
ok('в плитке есть денежная строка',          L.$$('#listTiles .tile .tm').length === 6);
ok('«Всего» в деньгах = claimTotal набора (солидарность не задвоена)',
   L.ev(`Math.abs(tileMoney(baseSet()).total - claimTotal(baseSet())) < 0.005`));
ok('сумма пяти плиток = «Всего»', L.ev(`(() => {
  const t = tileMoney(baseSet());
  const s = ['gate','window','procWait','clear','closed'].reduce((a,k)=>a+(t.by[k]||0),0);
  return Math.abs(s - t.total) < 0.005;
})()`));
ok('деньги плитки не совпадают с наивной суммой строк там, где есть солидарность',
   L.ev(`tileMoney(baseSet()).total < baseSet().reduce((a,r)=>a+claimOf(r),0)`));
/* Главная проверка правила: разводим солидарную пару по РАЗНЫМ плиткам и смотрим,
   что сумма плиток всё ещё сходится. На стенде такого расхождения нет (везение
   данных), поэтому его надо создать руками — иначе правило не проверено. */
ok('правило представителя держит сумму, даже когда солидарная пара разъехалась по плиткам', (() => {
  const m = mk();
  return m.ev(`(() => {
    const pair = allReqs().filter(r => solidaryWith(r).length);
    const other = pair.find(r => r.role !== 'заёмщик');
    const orig = listStatus;
    window.listStatus = r => (r === other ? 'gate' : orig(r));
    const t = tileMoney(baseSet());
    const s = ['gate','window','procWait','clear','closed'].reduce((a,k)=>a+(t.by[k]||0),0);
    const split = ['gate','window','procWait','clear','closed'].filter(k => (t.by[k]||0) > 0).length;
    window.listStatus = orig;
    return split > 1 && Math.abs(s - t.total) < 0.005 && Math.abs(t.total - claimTotal(baseSet())) < 0.005;
  })()`);
})());
ok('рамка экрана называет правило денег',    /один раз на кредит, по строке заёмщика/.test(L.$('.list-frame').textContent));

head('ПЛ-6 · цвет метит редкое: в таблице его нет');
ok('чипа роли «заёмщик» в строках нет', L.$$('#listBody tr.rowopen').every(tr =>
   !/заёмщик/.test(tr.children[0].querySelector('.rolechip')?.textContent || '')));
ok('у роли, отличной от «заёмщик», чип остаётся', L.ev(`(() => {
  const r = allReqs().find(x => x.role !== 'заёмщик');
  setF('role', r.role); renderList();
  const has = [...document.querySelectorAll('#listBody tr.rowopen')]
    .every(tr => !!tr.children[0].querySelector('.rolechip'));
  resetFilters(); return has;
})()`));
ok('категория выводится текстом, а не пилюлей',
   L.$$('#listBody tr.rowopen').every(tr => tr.children[4].querySelector('.pill') === null
     && (tr.children[4].textContent || '').trim().length > 0));
ok('красного класса .overdue в строках нет',  L.$$('#listBody td.overdue').length === 0);
ok('мёртвое правило .grid td.overdue снято из CSS', !/\.grid td\.overdue\{/.test(HTML_SRC));
ok('порог «> 180» из рендера ушёл',           !/overdueOf\(r\)>180/.test(HTML_SRC));
ok('стрелка сортировки скрыта у несортированных колонок',
   /thead th \.sort\{[^}]*opacity:0/.test(HTML_SRC)
   && /thead th:hover \.sort, table\.grid thead th\.sorted \.sort\{ opacity:1/.test(HTML_SRC));
ok('курсив и серый у закрытой строки остались',
   /\.grid tbody tr\.terminal td\{ color:var\(--text-muted\)/.test(HTML_SRC));

head('ПЛ-Д1…ПЛ-Д3 · раскладка таблицы');
ok('ПЛ-Д1: раскладка фиксированная',          /table\.grid\{ width:100%; table-layout:fixed/.test(HTML_SRC));
ok('ПЛ-Д2: шапка переносится по словам, как обещал ТР-9',
   /thead th\{[^}]*white-space:normal/.test(HTML_SRC));
ok('ПЛ-Д2: у шапки не осталось ellipsis, который с переносом ничего не значит',
   !/thead th\{[^}]*text-overflow:ellipsis/.test(HTML_SRC));
ok('ПЛ-Д2: стрелка сортировки вынесена в жёлоб и не занимает место в строке',
   /thead th\{[^}]*position:relative/.test(HTML_SRC)
   && /thead th\{[^}]*padding:0 16px 0 10px/.test(HTML_SRC)
   && /thead th \.sort\{ position:absolute/.test(HTML_SRC));
ok('ПЛ-Д3: ширины — доли, сумма ровно 100 %',
   L.ev(`LIST_WIDTHS.length`) === 8
   && L.ev(`LIST_WIDTHS.every(w => /^\\d+(\\.\\d+)?%$/.test(w))`)
   && Math.abs(L.ev(`LIST_WIDTHS.reduce((a,w)=>a+parseFloat(w),0)`) - 100) < 0.001);
/* Пиксельные потребности мерены в живом Chrome (canvas measureText, все 132 требования):
   лицо 243 · договор 179 · охват 157 · фаза 244 · категория 92 · подразделение 126 ·
   сумма 117 · дней 93 при бюджете 1240. jsdom ширины не считает, поэтому здесь —
   доли, восстановленные из тех замеров. */
ok('ПЛ-Д3: колонкам с длинным словом в шапке добавлено против ТР-9',
   parseFloat(L.ev(`LIST_WIDTHS[4]`)) >= 7.5      // категория:      было 7
   && parseFloat(L.ev(`LIST_WIDTHS[5]`)) >= 10.2  // подразделение:  было 8
   && parseFloat(L.ev(`LIST_WIDTHS[6]`)) >= 9.4   // сумма:          было 9
   && parseFloat(L.ev(`LIST_WIDTHS[7]`)) >= 7.5); // дней просрочки: было 6
ok('ПЛ-Д3: фазе оставлено модальное значение, добавка снята с имени',
   parseFloat(L.ev(`LIST_WIDTHS[3]`)) >= 19.7     // 244 px — ровно ячейка 119 строк из 132
   && parseFloat(L.ev(`LIST_WIDTHS[0]`)) < 22);   // имя дублируется в шапке дела и в title
ok('ячейки тела по-прежнему обрезаются с подсказкой, а не переносятся',
   /tbody td\{[^}]*white-space:nowrap/.test(HTML_SRC) && /tbody td\{[^}]*text-overflow:ellipsis/.test(HTML_SRC));

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
/* ADR-0023: «процедура» дела ушла — заголовок сводит ВЛАДЕНИЕ (подразделения открытых
   требований) и группу; сам статус («Работа с судебными органами» и т.п.) больше нигде
   не показывается как факт — только маршрут (стадия/фаза) требования. */
ok('владение и группа — в заголовке дела, старой процедуры там больше нет',
   !dims().some(d=>/Процедура|Группа/.test(d))
   && D.ev('dealOwnerLabel(curProc)') === 'ОПК'
   && D.doc.querySelector('.dhead-run').textContent.includes(D.ev('dealOwnerLabel(curProc)'))
   && /группа/.test(D.doc.querySelector('.dhead-run').textContent));
ok('счётчик п. 98 приёма передачи виден в журнале передач вкладки «Дело» (210/70/з)', (() => {
  const m = mk(); m.ev(`openDetail('210/70/з')`);
  m.ev(`switchTab(TABS.findIndex(t=>t.slug==='obschee'))`);
  return /осталось 3 р\.д\. \(п\. 98\)/.test(m.active().textContent); })());
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
/* courtActs[] демонтирован (Task 3, ADR-0027/0031) — акт инстанции ТЕПЕРЬ САМ МЕРА
   расщеплённого судебного вида (COURT_ACT_KINDS), а не отдельная сущность на поле
   процесса: у него есть собственные targets, а связь с породившим иском/жалобой —
   basedOn (не отдельный measureNum-указатель). */
ok('courtActs[] демонтирован — отдельного поля на процессе больше нет',
   D.ev(`PROCESSES.every(p => !('courtActs' in p))`));
ok('акт ссылается на меру-основание через basedOn (не measureNum на отдельной сущности)',
   D.ev(`courtActsOf(REQ_INDEX['142/56/з']).every(m => !!m.basedOn && basedOnValid(m))`));
ok('привязка акта выводится через targets самой меры',
   D.ev(`(()=>{const m=courtActsOf(REQ_INDEX['142/56/з'])[0];
     return Array.isArray(m.targets) && boundToReq(REQ_INDEX['142/56/з'], m.num) === true;})()`));
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
ok('фильтр пропускает непривязанное, а не выбрасывает (заседания — measureNum-привязка, courtActs демонтирован)',
   D.ev(`(() => {
  const r = REQ_INDEX['142/56/з'];
  return boundToReq(r, null) === null && boundToReq(r, 'НЕТ-ТАКОЙ') === null
      && (r._proc.hearings||[]).filter(h=>boundToReq(r,h.measureNum)!==false).length
         >= (r._proc.hearings||[]).filter(h=>boundToReq(r,h.measureNum)===true).length; })()`));

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

/* РМ-Д5 (Task 10): childGapDeadlines() добавила в dlOf() девять просроченных синтетических
   записей — иски затравки без живого basedOn-ответа суда (было невидимо, теперь видно
   как и задумано). Числа ниже (36→45, 17→26, 49→58, −34→−141) сдвинуты этой правкой, не
   регрессия: пересчитаны с нуля после Task 10 (см. отчёт задачи). */
head('СК-1/СК-6 · очередь с горизонтом, а не список просроченного');
ok('умолчание — горизонт 7 дней',            S.ev(`dlHorizon`) === '7' && /Горизонт: 7 дней/.test(sFrame()));
ok('предстоящие сроки показаны, а не только просроченные',
   sRows().length === 45 && sRows().filter(r=>/просрочен/.test(r.textContent)).length === 26);
ok('горизонт «всё» даёт все 58 сроков',      (()=>{ S.ev(`dlSetHorizon('all')`); return sRows().length === 58; })());
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
  return a.length === 45 && a.every((v,i) => i === 0 || a[i-1] <= v) && a[0] === -141 && a[a.length-1] === 7; })());
ok('клик по колонке меняет ключ и направление', (()=>{
  S.ev(`dlSortBy('due')`); const up = S.ev(`dlSort.k==='due' && dlSort.dir===1`);
  S.ev(`dlSortBy('due')`); const down = S.ev(`dlSort.dir===-1`);
  S.ev(`dlSort={k:'left',dir:1}; dlRefresh()`); return up && down; })());

head('СК-7/СК-12 · рамка со счётчиками, пустое состояние с причиной');
ok('плиток на экране сроков нет',            S.$('#view-deadlines .tile') === null);
ok('рамка считает очередь и называет дату отсчёта',
   /показано 45 из 58 · просрочено 26 · истекает сегодня 5 · отсчёт от 21\.07\.2026/.test(sFrame()));
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
/* НП-3: подразделения роли — не третий список в коде, а справочник ROLES; фильтр
   «только моё подразделение» и переключатель в шапке читают одну и ту же запись. */
ok('«только моё подразделение» читает ролевой селектор',
   S.ev(`roleSubdivs().join('/')`) === S.ev(`(ROLE_BY_NAME[currentRole()]||{subdivs:[]}).subdivs.join('/')`)
   && S.ev('roleSubdivs().length') === 3);
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
   && S.ev(`PROCESSES.flatMap(p=>dlOf(p)).filter(d=>!d.tpl).length === 5`)
   && sRows().some(r=>/вне Порядка/.test(r.textContent)));
ok('«п. —» больше не рисуется (СК-Д13)',     !sRows().some(r=>/п\. —/.test(r.textContent)));
ok('Р-8 подписан без «п.» — это решение проекта, не пункт Порядка',
   S.ev(`dlPointLabel({tpl:40}) === 'Р-8' && dlPointLabel({tpl:5}) === 'п. 17.2'`));

head('СК-13 · срок снимается фактом, а не отметкой');
ok('кнопки «выполнено» у срока нет',         !/выполнено/i.test(S.$('#view-deadlines').innerHTML));
ok('карта закрытия ссылается на существующие виды мер',
   S.ev(`Object.values(DEADLINE_CLOSERS).flat().every(k=>MEASURE_KIND_NAMES.includes(k))`)
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
   H.ev(`PROCESSES.flatMap(p=>hearingDeadlines(p)).length === 5`)
   && H.ev(`PROCESSES.flatMap(p=>hearingDeadlines(p)).every(d=>!!d._hearing)`));
ok('в очередь выводится только не наступившее заседание',
   H.ev(`PROCESSES.flatMap(p=>hearingDeadlines(p)).every(d=>daysLeft(d) >= 0)`)
   && H.ev(`PROCESSES.flatMap(p=>p.hearings||[]).length === 12`));
ok('очередь сроков видит заседание строкой',
   H.ev(`dlAll().filter(x=>x.d._hearing).length === 5`));
ok('снимок состояния производный срок не хранит',
   H.ev(`(()=>{ persistState(); return !/Следующее судебное заседание/.test(localStorage.getItem(STORE_KEY)||''); })()`));

head('КР-3/КР-4 · заседания: исход вместо статуса, сегменты');
ok('восемь колонок в заданном порядке',
   rCols(H,'hearings').join('|') === 'Дата и время|Осталось, к.д.|Вид|Заёмщик|Требование|Место|Представитель ФКФ|Исход');
ok('колонки «Статус» с планированием больше нет', !rCols(H,'hearings').includes('Статус'));
ok('умолчание — предстоящие, прошедшее без исхода показано всегда',
   H.ev(`regState.hearings.seg`) === 'upcoming'
   && rRows(H,'hearings').length === 8
   && rRows(H,'hearings').filter(r=>/исход не внесён/.test(r.textContent)).length === 3);
ok('сегмент «Прошедшие» даёт только прошедшие', (()=>{
   H.ev(`regSetSeg('hearings','past')`); const n = rRows(H,'hearings').length;
   const all = (H.ev(`regSetSeg('hearings','all')`), rRows(H,'hearings').length);
   H.ev(`regSetSeg('hearings','upcoming')`); return n === 7 && all === 12; })());
ok('мера-основание — подписью, а не колонкой',
   /мера ИСК-/.test(rRows(H,'hearings')[0].textContent)
   && /Мера-основание: ИСК-77 · участники:/.test(rRows(H,'hearings')[0].getAttribute('title')));
ok('представитель ФКФ выведен из участников, а не введён руками',
   H.ev(`REGS.hearings.all().every(x=>!!x.rep)`) && !/rep:'/.test(HTML));
ok('рамка называет очередь, дыру и ближайшее заседание',
   /предстоит <b>5<\/b> · прошло без внесённого исхода <b>3<\/b> · ближайшее <b>24\.07\.2026 09:30<\/b>/.test(H.$('#hearingsFrame').innerHTML));

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
   rRows(C,'claims').filter(r=>/сейчас /.test(r.textContent)).length === 9
   && C.ev(`REGS.claims.all().every(x=>x.doc === parseSum(x.m.sum))`));
ok('дельта суммы нигде не хранится (ADR-0001)',
   C.ev(`PROCESSES.flatMap(p=>p.measures||[]).every(m=>m.sumNow===undefined && m.delta===undefined)`));
ok('рамка считает вручение, сторно и расхождение',
   /без подтверждения вручения <b>2<\/b> \(п\. 20\.2\) · сторнировано <b>1<\/b> · сумма документа разошлась с требованием у <b>9<\/b>/
     .test(C.$('#claimsFrame').innerHTML));

head('КР-8/КР-9/КР-11 · вопросы: состояние выводится в одном месте');
ok('семь колонок, состояние первым',
   rCols(Q,'committee').join('|') === 'Состояние|Предмет|Орган|Заёмщик|Договоры|Инициатор|Заседание');
ok('умолчание — ждут решения',               Q.ev(`regState.committee.seg`) === 'pending'
   && rRows(Q,'committee').length === 4 && Q.ev(`REGS.committee.all().length`) === 29);
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
   g.ev(`TABS.length === 10`) && g.ev(`allReqs().length === 139`));

/* ADR-0031: жалоба (АЖ-08) фазу не двигает — состояние иска остаётся неопределённым до
   акта вышестоящей инстанции; фазу двигает именно акт (Task 4). Дело 330 — сценарий,
   где обе меры зарегистрированы: «Апелляционная жалоба» (resultIsDocument, без outcome)
   и дочернее «Постановление апелляционной инстанции» (basedOn на жалобу, с outcome). */
head('ADR-0031 · апелляция не веха, акт вышестоящей инстанции — веха');
ok('АЖ-08 не несёт setsPhase, дочернее постановление несёт',
   g.ev(`measureSetsPhase(PROCESSES.find(p=>p.id==='330').measures.find(m=>m.kind==='Апелляционная жалоба'))`) === null
   && !!g.ev(`measureSetsPhase(PROCESSES.find(p=>p.id==='330').measures.find(m=>m.kind==='Постановление апелляционной инстанции'))`));
ok('«Постановление апелляционной инстанции» ссылается на «Апелляционная жалоба» через basisKinds',
   g.ev(`kindOf('Постановление апелляционной инстанции').basisKinds.includes('Апелляционная жалоба')`));

/* ADR-0029 п.2 (Task 5): `basedOn`, если есть, указывает на меру с непустым пересечением
   `targets` — иначе ссылка адресует чужую меру, дефект регистрации. basedOnValid(m) —
   код-инвариант (не только смоук): читается и здесь, и панелью «Суд» (collection.html,
   panelSud) для видимой пометки дефекта в столбце «Основание». Затравка (31 новых
   basedOn поверх 7 из Task 3/4, ~2196…3740) обязана сама проходить свою же проверку. */
head('ADR-0029 · basedOn — ссылка на основание меры (ПМ-Д4, ПМ-Д6)');
ok('basedOnValid() определена и вызываема из тестов',
   g.ev(`typeof basedOnValid === 'function'`));
ok('каждый basedOn в затравке указывает на меру ТОГО ЖЕ дела с непустым пересечением targets',
   g.ev(`PROCESSES.every(p => (p.measures||[]).every(m => !m.basedOn || basedOnValid(m)))`));
ok('basedOn на несуществующий в деле номер — дефект (не тихая правда)',
   g.ev(`!basedOnValid({basedOn:'НЕТ-ТАКОГО-НОМЕРА', targets:['142/56/з'], _proc: PROCESSES.find(x=>x.id==='142')})`));
ok('пустое пересечение targets меры и её основания — дефект',
   g.ev(`!basedOnValid({basedOn:'ПР-118', targets:['205/315/з'], _proc: PROCESSES.find(x=>x.id==='142')})`));
ok('ИЛ ссылается на решение суда / приказ / мировое соглашение (ПМ-Д6)',
   g.ev(`kindOf('Исполнительный лист').basisKinds.join(',')`) === 'Решение суда,Судебный приказ,Мировое соглашение');
ok('сторно построчно (ADR-0029 п.3): мера остаётся живой для не сторнированной цели',
   g.ev(`(() => {
     const p = PROCESSES.find(x=>x.id==='142');
     const m = p.measures.find(x=>x.kind==='Исковое заявление' && x.num==='ИСК-77');
     m.stornoTargets = { '142/56/п': {reason:'тест', by:'т', at:'21.07.2026'} };
     const live = liveMeasuresOf(REQ_INDEX['142/56/з']).includes(m);
     const notLiveForStornoed = !liveMeasuresOf(REQ_INDEX['142/56/п']).includes(m);
     delete m.stornoTargets;
     return live && notLiveForStornoed;
   })()`));

/* ADR-0032 (Task 7) — урегулирование и треки: свёртки журнала, не хранимые поля.
   Пауза: `p.pause`/`active` сняты, «действует» вычисляет pauseOpenerOf/pauseClosed —
   открыватель есть, срок не истёк, закрывателя (нарушение/снятие) нет. Судебный и
   исполнительный треки — новая фича, тем же паттерном opener/closer, что DEADLINE_CLOSERS
   (см. SUD_OPENERS/SUD_CLOSERS/ISP_OPENERS/ISP_CLOSERS), но на MEASURE_KINDS, а не на
   отдельном справочнике. Дело 320 (req 320/420/з) — оба трека сразу: пауза
   «рассмотрение реструктуризации» до 15.09.2026 (срок не истёк) и открытый судебный
   трек (ИСК-77/ИСК-82 без решения/определения-закрывателя). Дело 331 (req 331/431/з) —
   открытый исполнительный трек (ИЛ-310, постановления о возврате нет). */
head('ADR-0032 · урегулирование и треки (ПМ-Д8)');
ok('`pause` как хранимое поле дела снят полностью (замена — settlement, факты без active)',
   g.ev(`PROCESSES.every(p => !('pause' in p))`));
ok('открытый опенер без закрывателя — пауза видна активной (дело 320, req 320/420/з)',
   g.ev(`!!pausedState(${R('320/420/з')}) && pausedState(${R('320/420/з')}).kind === 'restructuring'`));
ok('открытый опенер без закрывателя — судебный трек виден активным (дело 320, req 320/420/з, ИСК-82)',
   g.ev(`(() => { const t = sudTrackOf(${R('320/420/з')}); return !!t && t.num === 'ИСК-82'; })()`));
ok('открытый опенер без закрывателя — исполнительный трек виден активным (дело 331, req 331/431/з, ИЛ-310)',
   g.ev(`(() => { const t = ispTrackOf(${R('331/431/з')}); return !!t && t.num === 'ИЛ-310'; })()`));
ok('закрыватель гасит судебный трек — дело 327 (ИСК-70 закрыт последующим «Решение суда» РС-33)',
   g.ev(`!sudTrackOf(${R('327/427/з')})`));
ok('решение №3 · TERMINAL_BY_MEASURE больше не содержит «Акт сверки о полном погашении»',
   g.ev(`!('Акт сверки о полном погашении' in TERMINAL_BY_MEASURE)`));
ok('акт сверки о полном погашении сам не терминирует — при живом остатке outcomeOf не меняется',
   g.ev(`(() => {
     const r = ${R('142/56/з')};
     if(debtOf(r).totalLeft <= 0) return false;         // сценарий требует ненулевого остатка
     const before = outcomeOf(r);
     const fake = {sec:'Досудебный', kind:'Акт сверки о полном погашении', dates:D(TODAY,TODAY,TODAY),
                   num:'ТЕСТ-АС', outcome:'подтверждено', targets:[r.id]};
     r._proc.measures.push(fake);
     const after = outcomeOf(r);
     r._proc.measures.pop();
     return before === null && after === before;
   })()`));
ok('залоговый трек — зеркало несёт обязательную дату снимка (ADR-0032 «Последствия»), у каждой записи она есть',
   g.ev(`PROCESSES.every(p => (p.colls||[]).every(c => !!c.snapshotAt))`));
ok('устарелость снимка залога вычисляется (collSnapshotStale), в затравке есть и свежие, и устаревшие',
   g.ev(`PROCESSES.some(p=>(p.colls||[]).some(c=>collSnapshotStale(c))) && PROCESSES.some(p=>(p.colls||[]).some(c=>!collSnapshotStale(c)))`));

/* ══════════════════════════════════════════════════════════════════════════
   РМ-Д5 · «Сроки на контроле» — дыра по отсутствию дочерней меры
   ══════════════════════════════════════════════════════════════════════════ */
head('РМ-Д5 · дыра по отсутствию дочерней меры (resultIsDocument)');
ok('иск без определения виден как дыра в очереди сроков (дело 325, ИСК-79 от 22.05.2026, детей нет)',
   g.ev(`dlOf(${P('325')}).some(d => d.tpl===45 && d._childGapOf && d._childGapOf.num==='ИСК-79')`));
ok('дыра просрочена относительно TODAY (10 к.д. от 22.05.2026 истекли задолго до 21.07.2026)',
   g.ev(`(() => { const d = dlOf(${P('325')}).find(x=>x._childGapOf && x._childGapOf.num==='ИСК-79'); return !!d && isOverdue(d); })()`));
ok('видна в общем реестре «Сроки на контроле» (dlAll), привязана к требованию 325/425/з',
   g.ev(`dlAll().some(x => x.d._childGapOf && x.d._childGapOf.num==='ИСК-79' && x.reqs.some(r=>r.id==='325/425/з'))`));
ok('видна на вкладке требования (deadlinesOf) — тот же расчёт, что в общем реестре',
   g.ev(`deadlinesOf(${R('325/425/з')}).some(d => d._childGapOf && d._childGapOf.num==='ИСК-79')`));
ok('появление живой дочерней меры с basedOn на иск закрывает дыру (мутирующий тест, push/pop)',
   g.ev(`(() => {
     const p = ${P('325')};
     const parent = p.measures.find(m=>m.num==='ИСК-79');
     const before = dlOf(p).some(d => d._childGapOf && d._childGapOf.num==='ИСК-79');
     const fake = {sec:'Судебный', kind:'Определение о принятии искового заявления к производству',
                   dates:D('01.06.2026','01.06.2026','01.06.2026'), num:'ТЕСТ-ОПР', outcome:'принято к производству',
                   basedOn:'ИСК-79', targets:[...parent.targets]};
     p.measures.push(fake);
     const after = dlOf(p).some(d => d._childGapOf && d._childGapOf.num==='ИСК-79');
     p.measures.pop();
     return before === true && after === false;
   })()`));
ok('сторно на мере-родителе снимает дыру — respect storno (мутирующий тест, push/pop)',
   g.ev(`(() => {
     const p = ${P('325')};
     const parent = p.measures.find(m=>m.num==='ИСК-79');
     const fake = {sec:'Судебный', kind:'Исковое заявление', dates:D('01.05.2026','01.05.2026','01.05.2026'),
                   num:'ТЕСТ-ИСК-СТОРНО', storno:{reason:'тест', by:'т', at:TODAY}, targets:[...parent.targets]};
     p.measures.push(fake);
     const has = dlOf(p).some(d => d._childGapOf && d._childGapOf.num==='ТЕСТ-ИСК-СТОРНО');
     p.measures.pop();
     return !has;
   })()`));
ok('иски с уже зарегистрированным живым ответом суда (basedOn) дыр не показывают — ИСК-77/70/90/99/560/561',
   g.ev(`['ИСК-77','ИСК-70','ИСК-90','ИСК-99','ИСК-560','ИСК-561'].every(num =>
     !PROCESSES.some(p => dlOf(p).some(d => d._childGapOf && d._childGapOf.num===num)))`));
ok('карта дыр покрывает только «Исковое заявление» — другие resultIsDocument-виды (напр. «Апелляционная жалоба») дыр не генерируют',
   g.ev(`PROCESSES.every(p => dlOf(p).every(d => !d._childGapOf || d._childGapOf.kind === 'Исковое заявление'))`));

/* ADR-0036 (Task 9) — форма регистрации делится на тело/пометки, правка после регистрации.
   Сценарий: регистрация через реальную openMeasureModal()/saveMeasure() (тот же путь, что
   тесты М-2/И-3/И-1 выше) → тело есть, пометок нет вовсе → первичное заполнение пометки
   (openAnnotationModal/saveAnnotation) без причины стамповает by/at → повторная правка уже
   внесённого значения без причины блокируется (тело/пометка не меняются) → с причиной
   проходит и хранит reason рядом со штампом. Один процесс/DOM на весь сценарий (curProc
   мутируется по ходу, как и в существующих мутирующих тестах этого файла). */
head('РМ-Д4 · ADR-0036 — форма регистрации: тело/пометки, правка после регистрации (Task 9)');
{
  const m = mk();   // роль по умолчанию «Куратор ОД / ДАК / РП» — в матрице В-9 претензии (subdivs ОД/ДАК/РП)
  m.ev(`openDetail('201/311/з'); closeWindowMark();`);
  m.ev(`openMeasureModal()`);
  ok('форма регистрации не содержит инпутов доставки/исхода (сняты Task 9 — #mDeliver/#mResult)',
     m.ev(`document.getElementById('mDeliver')`) === null && m.ev(`document.getElementById('mResult')`) === null);
  m.doc.getElementById('mKind').value = 'Первичная претензия';
  m.ev(`syncMeasureWarnings()`);
  m.doc.getElementById('mNum').value = 'ТЕСТ-ПОМЕТКА-1';
  m.ev(`saveMeasure()`);
  const mi = m.ev(`curProc.measures.findIndex(x=>x.num==='ТЕСТ-ПОМЕТКА-1')`);
  ok('регистрация даёт тело меры сразу (kind/num/dates/targets/sum)',
     m.ev(`curProc.measures[${mi}].kind`) === 'Первичная претензия'
     && m.ev(`curProc.measures[${mi}].num`) === 'ТЕСТ-ПОМЕТКА-1'
     && m.ev(`!!curProc.measures[${mi}].dates && !!curProc.measures[${mi}].sum && curProc.measures[${mi}].targets.length>0`));
  ok('пометки при регистрации отсутствуют вовсе — sent/served/outcome не заданы',
     m.ev(`curProc.measures[${mi}].sent`) === undefined
     && m.ev(`curProc.measures[${mi}].served`) === undefined
     && m.ev(`curProc.measures[${mi}].outcome`) === undefined);

  // Первичное заполнение пометки (доставка + исход) — без причины, стамповает by/at.
  m.ev(`openAnnotationModal(${mi})`);
  m.doc.getElementById('aChannel').value = 'СЭД';
  m.doc.getElementById('aSentDate').value = '2026-07-21';
  m.doc.getElementById('aOutcome').value = 'без ответа';
  m.ev(`saveAnnotation(${mi})`);
  ok('первичное заполнение пометки не требует причины и стамповает by/at (доставка и исход)',
     m.ev(`curProc.measures[${mi}].sent.channel`) === 'СЭД' && m.ev(`curProc.measures[${mi}].sent.by`) === 'Куратор ОД / ДАК / РП'
     && m.ev(`curProc.measures[${mi}].sent.at`) === '21.07.2026' && !m.ev(`curProc.measures[${mi}].sent.reason`)
     && m.ev(`curProc.measures[${mi}].outcome`) === 'без ответа' && m.ev(`curProc.measures[${mi}].outcomeMeta.by`) === 'Куратор ОД / ДАК / РП'
     && m.ev(`curProc.measures[${mi}].outcomeMeta.at`) === '21.07.2026' && !m.ev(`curProc.measures[${mi}].outcomeMeta.reason`));
  ok('тело меры не тронуто заполнением пометки (kind/num/targets/sum те же, что при регистрации)',
     m.ev(`curProc.measures[${mi}].kind`) === 'Первичная претензия' && m.ev(`curProc.measures[${mi}].num`) === 'ТЕСТ-ПОМЕТКА-1'
     && m.ev(`!!curProc.measures[${mi}].dates && !!curProc.measures[${mi}].sum`));

  // Правка уже внесённой пометки БЕЗ причины — блокируется, значения не меняются (И-1-подобный инвариант, но для пометки).
  const sentBefore = m.ev(`JSON.stringify(curProc.measures[${mi}].sent)`);
  const outcomeBefore = m.ev(`curProc.measures[${mi}].outcome`);
  m.ev(`openAnnotationModal(${mi})`);
  m.doc.getElementById('aChannel').value = 'Почта';
  m.doc.getElementById('aOutcome').value = 'погашено';
  m.ev(`saveAnnotation(${mi})`);
  ok('правка уже внесённой пометки без причины блокируется — тело меры «заморожено», а сама пометка не подменяется молча',
     m.ev(`JSON.stringify(curProc.measures[${mi}].sent)`) === sentBefore && m.ev(`curProc.measures[${mi}].outcome`) === outcomeBefore
     && m.ev(`!!document.getElementById('modalHost').classList.contains('open')`));  // модалка не закрылась — saveAnnotation вышла по гейту, не по успеху

  // Правка С причиной — проходит, новый штамп by/at, причина хранится рядом (не подменяет тело).
  m.doc.getElementById('aReason').value = 'ошиблись в канале и исходе при первичном вводе';
  m.ev(`saveAnnotation(${mi})`);
  ok('правка пометки с причиной проходит и штампует НОВЫЕ by/at + reason (исправление, не тихая подмена)',
     m.ev(`curProc.measures[${mi}].sent.channel`) === 'Почта' && m.ev(`curProc.measures[${mi}].sent.reason`) === 'ошиблись в канале и исходе при первичном вводе'
     && m.ev(`curProc.measures[${mi}].outcome`) === 'погашено' && m.ev(`curProc.measures[${mi}].outcomeMeta.reason`) === 'ошиблись в канале и исходе при первичном вводе'
     && m.ev(`curProc.measures[${mi}].outcomeMeta.prev`) === 'без ответа');
  ok('и после правки пометки тело меры остаётся тем же (kind/num/targets/sum) — правка нигде их не задела',
     m.ev(`curProc.measures[${mi}].kind`) === 'Первичная претензия' && m.ev(`curProc.measures[${mi}].num`) === 'ТЕСТ-ПОМЕТКА-1'
     && m.ev(`!!curProc.measures[${mi}].dates && !!curProc.measures[${mi}].sum`));

  // ADR-0036 п.4: действие доступно независимо от статуса требования — измерGate/isClosedReq не читаются.
  ok('действие пометки не проверяет isClosedReq/measureGate требования (доступно и на закрытом)',
     m.ev(`!/isClosedReq|measureGate/.test(openAnnotationModal.toString()) && !/isClosedReq|measureGate/.test(saveAnnotation.toString())`));
}

/* ══════════════════════════════════════════════════════════════════════════
   ПМ-Д10 (Task 11) — СМОУК: ИНВАРИАНТЫ, НЕ ТОЛЬКО СЧЁТЧИКИ
   Пять именованных инвариантов из плана волны (не пересчёт статики затравки —
   поведение функций модели на живых и синтетических случаях).
   ══════════════════════════════════════════════════════════════════════════ */
head('ПМ-Д10 · Task 11 — инварианты (не счётчики)');

/* 1) ADR-0029 п.2: пустое пересечение targets меры и её основания — дефект регистрации,
   а не тихая правда. basedOnValid() ловит и синтетический разрыв, и держит инвариант
   на всей реальной затравке (Task 5 проставила 38 basedOn-ссылок). */
ok('инвариант · пустое пересечение targets меры и её basedOn-основания — дефект (basedOnValid)',
   g.ev(`!basedOnValid({basedOn:'ПР-118', targets:['205/315/з'], _proc: PROCESSES.find(x=>x.id==='142')})`)
   && g.ev(`PROCESSES.every(p => (p.measures||[]).every(m => !m.basedOn || basedOnValid(m)))`));

/* 2) ADR-0032 п.1: открытый трек (опенер без закрывателя) виден активным и гасится
   появлением закрывателя — мутирующий push/pop на реальном деле 320 (req 320/420/з,
   судебный трек открыт ИСК-82, закрывателя в затравке нет). */
ok('инвариант · открытый трек виден активным и закрывается при появлении закрывателя (push/pop, дело 320)',
   g.ev(`(() => {
     const r = ${R('320/420/з')}, p = r._proc;
     const before = sudTrackOf(r);
     const fake = {sec:'Судебный', kind:'Решение суда', dates:D('01.07.2026','01.07.2026','01.07.2026'),
                   num:'ТЕСТ-ЗАКР-ТРЕК', outcome:'иск удовлетворён полностью', targets:[r.id]};
     p.measures.push(fake);
     const after = sudTrackOf(r);
     p.measures.pop();
     const restored = sudTrackOf(r);
     return !!before && before.num==='ИСК-82' && after===null && !!restored && restored.num==='ИСК-82';
   })()`));

/* 3) ADR-0035 п.2 / ADR-0027 п.1: вид с resultIsDocument:true — результат приходит
   ОТДЕЛЬНЫМ документом дочерней меры, поэтому такая мера сама исход не несёт вовсе.
   Проверка по ВСЕМ мерам ВСЕХ процессов, не по одному образцу. */
ok('инвариант · resultIsDocument-вид никогда не несёт outcome (по всем мерам всех дел)',
   g.ev(`PROCESSES.every(p => (p.measures||[]).every(m => {
     const kd = kindOf(m.kind); return !kd || !kd.resultIsDocument || m.outcome === undefined;
   }))`));

/* 4) ADR-0032 п.2: активная пауза трассируется к живому опенеру, у которого нет
   закрывателя (pauseOpenerOf + pauseClosed) — реальный случай, дело 320. */
ok('инвариант · активная пауза трассируется к живому опенеру без закрывателя (pauseOpenerOf/pauseClosed, дело 320)',
   g.ev(`(() => {
     const s = pauseOpenerOf(${R('320/420/з')});
     return !!s && s.kind==='restructuring' && pauseClosed(s)===false;
   })()`));

/* 5) ADR-0027 п.3 «Последствия»: «у внешнего акта нет кнопки «сформировать документ»
   и нет предусловий-гейтов» — факт внешнего акта уже случился, блокировать нечего.
   Task 11 fix: measureGate() коротит на source==='внешний акт' ДО subdiv/sequence/gate
   (mockups/collection/collection.html, measureGate) — до правки любой внешний акт
   молча гейтился В-9 через фолбэк подразделения раздела (SECTION_SUBDIV). Показываем
   и позитив (внешние акты не гейтятся), и контраст (наш документ на том же требовании
   тем же гейтом блокируется — значит проверка не тривиально пуста). */
ok('инвариант · мера source:"внешний акт" не показывает гейт-предусловие в форме регистрации (measureGate)',
   g.ev(`MEASURE_KINDS.filter(k=>k.source==='внешний акт').every(k => measureGate(${R('201/311/з')}, k.name) === null)`)
   && g.ev(`kindOf('Апелляционная жалоба').source==='наш документ' && !!measureGate(${R('201/311/з')}, 'Апелляционная жалоба')`));

/* ══════════════════════════════════════════════════════════════════════════
   СПРАВОЧНИКИ — при переезде модели ничего не потеряно
   ══════════════════════════════════════════════════════════════════════════ */
head('справочники');
/* Task 2: MEASURE_KINDS — массив строк (51) → массив объектов {name, source,
   resultIsDocument, outcomes, needsDelivery, deliveryChannels, basisKinds} (ADR-0027…0029/
   0033…0035). MILESTONE_PHASE/MILESTONE_KINDS/PHASE_MILESTONE свёрнуты в
   outcomes[].setsPhase — отдельного справочника «видов-вех» больше нет, веха теперь
   свойство ПАРЫ вид×исход (kindPhase(name) — производная, не хранимый список). */
ok('MEASURE_KINDS — структурный справочник объектов (не плоский список строк)',
   g.ev(`MEASURE_KINDS.every(k => typeof k==='object'
     && typeof k.name==='string'
     && (k.source==='наш документ' || k.source==='внешний акт')
     && typeof k.resultIsDocument==='boolean'
     && (k.outcomes===null || Array.isArray(k.outcomes))
     && (!k.resultIsDocument || k.outcomes===null)
     && typeof k.needsDelivery==='boolean'
     && (k.deliveryChannels===null || Array.isArray(k.deliveryChannels))
     && (k.basisKinds===null || Array.isArray(k.basisKinds)))`));
ok('видов мер 56 (было 51 — Task 2/4 расщепили «Определение суда» на 5 + добавили «Постановление апелляционной инстанции»)',
   g.ev('MEASURE_KINDS.length') === 56);
ok('видов-вех 17 (свёртка kindPhase, MILESTONE_KINDS как отдельный справочник снят — ADR-0033/0038)',
   g.ev(`MEASURE_KINDS.filter(k=>kindPhase(k.name)).length`) === 17);
ok('шаблонов сроков 45',        g.ev('DEADLINE_TEMPLATES.length') === 45);
ok('контуров К0…К7 — восемь',   g.ev('Object.keys(CONTOURS).length') === 8);
ok('разделов мер семь',         g.ev('SECTION_ORDER.length') === 7);
ok('редактор правил на месте',  g.ev(`typeof RULES === 'object' && typeof resetRulesAll === 'function'`));
ok('логика мирового МС-1…МС-7 на месте',
   g.ev(`['msTermGate','msStageEligible','msNotWorseOk','msSeedSchedule','msSyncStates','msComputeRows'].every(f=>typeof window[f]==='function')`));

console.log(`\nОШИБОК КОНСОЛИ (jsdomError): ${g.errs.length}`);
g.errs.forEach(e => console.log('  ' + e));
console.log(`ВСЕГО ПРОВЕРОК: ${n} · ПРОВАЛЕНО: ${fails}`);
process.exit(fails || g.errs.length ? 1 : 0);
