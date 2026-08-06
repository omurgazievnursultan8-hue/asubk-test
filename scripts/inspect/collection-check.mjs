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
/* Провал, а не падение. Волна ЗС (перезатравка) показала цену прежней формы: смоук
   ронялся ПЕРВЫМ же обращением к исчезнувшему делу (`.deadlines[0].base` на undefined
   вне ev), и хвост в полторы тысячи ассертов молчал — отчёт врал не числом, а обрывом.
   Поэтому: условие можно передать функцией, и исключение внутри неё = провал ЭТОЙ
   проверки со строкой причины. Значение-не-функция принимается как прежде. */
const ok = (name, cond) => {
  n++;
  let v = cond;
  if(typeof v === 'function'){ try { v = v(); } catch(e){ console.log('      ! ' + e.message); v = false; } }
  if(!v) fails++;
  console.log(`${v?'  ok':'FAIL'}  ${name}`);
};
const head = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 62 - t.length)));

const g = mk();                        // общий DOM для read-only проверок
const R = id => `REQ_INDEX['${id}']`;
const P = id => `PROCESSES.find(x=>x.id==='${id}')`;

/* ЗС · страховка от повторения истории: смоук приколочен к id затравки, а затравка
   пересобирается волнами. Разом сверяем ВСЕ id, которые этот файл упоминает, с живыми
   PROCESSES/REQ_INDEX — исчезнувший id становится одной названной находкой со списком,
   а не молчаливым undefined в середине выражения. */
const SELF = readFileSync(new URL(import.meta.url), 'utf8');
const srcReqIds  = [...new Set([...SELF.matchAll(/'(\d{3}\/[^'\/]+\/[зпго])'/g)].map(m => m[1]))];
const srcProcIds = [...new Set([...SELF.matchAll(/(?:P\('|id===')(\d{3})'/g)].map(m => m[1]))];
const goneReqs  = srcReqIds.filter(id => !g.ev(`!!REQ_INDEX[${JSON.stringify(id)}]`));
const goneProcs = srcProcIds.filter(id => !g.ev(`PROCESSES.some(p=>p.id===${JSON.stringify(id)})`));
head('ЗС · смоук ссылается только на живые id затравки');
ok('все дела, упомянутые в смоуке, есть в затравке'      + (goneProcs.length ? ` — нет: ${goneProcs.join(' ')}` : ''), goneProcs.length === 0);
ok('все требования, упомянутые в смоуке, есть в затравке' + (goneReqs.length  ? ` — нет: ${goneReqs.join(' ')}`  : ''), goneReqs.length  === 0);
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
   g.ev(`allReqs().every(r => r.id === r.proc+'/'+r.credit+'/'+({'заёмщик':'з','поручитель':'п','гарант':'г','госорган':'о'}[r.role]))`));
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
/* Волна ЗС: пару «заёмщик + поручитель по одному договору» несёт ситуация K1-ОБЕСП
   (дела 307 · 308 гарант · 309 отраслевой госорган), прежнее дело 142 стало
   однотребовательным (K3-ДОБРОВОЛЬНОЕ). Дальше 307 — рабочая лошадь солидарности. */
ok('дело 307 — два требования по одному договору',
   g.ev(`${P('307')}.requirements.map(r=>r.role).join(',')`) === 'заёмщик,поручитель');
ok('солидарный сосед заёмщика — поручитель',
   g.ev(`solidaryWith(${R('307/307/з')}).map(r=>r.id).join(',')`) === '307/307/п');
ok('обеспечение бывает трёх ролей — поручитель, гарант, отраслевой госорган (K1-ОБЕСП)',
   g.ev(`['307','308','309'].map(id=>PROCESSES.find(p=>p.id===id).requirements[1].role).join(',')`)
     === 'поручитель,гарант,госорган');
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
/* Охваты пересчитаны по затравке ЗС: у 412 залоговый способ снят (обращение на предмет
   залога живёт в K2-ИЗВЕЩ — дела 324…326), остались объёмы «полный остаток» у судебных
   требований и «просроченная сумма» у претензионного. Правило то же: сумма — из охвата. */
ok('охваты требований 412 — свёртка их мер, сумма считается из охвата',
   g.ev(`${P('412')}.requirements.map(r=>scopeLabel(scopeOf(r))).join(',')`)
     === 'полный остаток / деньгами,полный остаток / деньгами,просроченная сумма / деньгами'
   && g.ev(`claimOf(${R('412/562/з')}) < claimOf(${R('412/561/з')})`)
   && g.ev(`scopeLabel(scopeOf(${R('324/324/з')}))`) === 'полный остаток / обращением на предмет залога');
ok('категория дела — worst-of по кредитам, не поле дела',
   g.ev(`${P('412')}.requirements.map(r=>catOfReq(r)).join(',')`) === 'high,high,mid'
   && g.ev(`catOfProcess(${P('412')})`) === 'high');
/* Затравка ЗС: залоговых вопросов на многокредитном деле нет (у 412 вопрос один —
   поручение Председателя, оно уровня ДЕЛА и по договорам не разбирается). Правило
   «решение по одному договору не открывает меру по другому» от этого не исчезло —
   вопрос заводится в тесте, на своём же деле 412, в отдельном DOM (mk). */
ok('КР-10 · решение по договору 561 не открывает извещение по 562', mk().ev(`(() => {
  const p = PROCESSES.find(x=>x.id==='412');
  p.committeeQuestions.push({ organ:ORGANS[2], initiator:'ДАК',
    topic:'Начало внесудебного обращения взыскания на залог', credits:['561'],
    decided:true, decision:'разрешено', positive:true, meetingDate:'01.07.2026',
    protocolNo:'КЗ-99', protocolDate:'01.07.2026' });
  return gateReason(REQ_INDEX['412/561/з'], 'Извещение об обращении на залог') === null
    && /Решение есть, но по другому кредиту \\(Дог\\. №561 /.test(
         String(gateReason(REQ_INDEX['412/562/з'], 'Извещение об обращении на залог')));
})()`));
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
ok('в карточке нет селектора фазы', (() => { const m = mk(); m.ev("openDetail('307/307/з')");
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
ok('332/332/з — Иск, контур К3, судебная стадия',
   g.ev(`phaseOf(${R('332/332/з')})`) === 'Иск' && g.ev(`contourOf(${R('332/332/з')})`) === 'К3'
   && g.ev(`stageOfReq(${R('332/332/з')})`) === 'Судебный порядок');
ok('201/201/з — мер нет → фаза открытия, контур К0',
   g.ev(`phaseOf(${R('201/201/з')})`) === 'Досудебное урегулирование' && g.ev(`contourOf(${R('201/201/з')})`) === 'К0');
ok('Р-7 · веха с более поздней датой побеждает позицию в массиве', mk().ev(`(() => {
  const r = REQ_INDEX['142/142/з'];
  r._proc.measures.unshift({sec:'Исполнительное', kind:'Постановление на исполнении',
    dates:{event:'01.07.2026', received:'01.07.2026', registered:'01.07.2026'}, num:'ТЕСТ-1', targets:[r.id]});
  return phaseOf(r);
})()`) === 'На исполнении');
{ const m = mk(); m.ev(`openDetail('364/364/з')`); m.ev(`switchTab(${TAB.mery})`);
  ok('таймлайн К6 показывает три шага банкротства', m.active().querySelectorAll('.tl-step').length === 3); }
{ const a = mk(), b = mk();
  /* ЗС: право безакцепта несёт кредит (bezakceptRight) — оно есть у K1-БА-ГЕЙТ (310)
     и нет у K1-БА-НЕТ (315); прежние 204/205 стали делами окна ожидания (K0-ЗАКР). */
  a.ev(`openDetail('310/310/з')`); a.ev(`switchTab(${TAB.mery})`);
  b.ev(`openDetail('315/315/з')`); b.ev(`switchTab(${TAB.mery})`);
  ok('безакцепт в таймлайне только при праве договора (310 да, 315 нет)',
     /Безакцептное списание/.test(a.active().querySelector('.timeline').textContent)
     && !/Безакцептное списание/.test(b.active().querySelector('.timeline').textContent)); }
/* К7 переписан волной ЗС: контур — ровно две фазы, «Признана безнадёжной» ставит
   ЗАКЛЮЧЕНИЕ КОМИССИИ, «Списана» — акт о списании (два вида). Ликвидация, смерть и
   приговор фазу больше не ставят: это ОСНОВАНИЯ заключения (basisKinds), внешние
   факты, а не шаги маршрута. */
ok('К7 · контур — ровно две фазы: признана безнадёжной → списана',
   g.ev(`CONTOURS['К7'].phases.join('>')`) === 'Признана безнадёжной>Списана');
ok('К7 · «Признана безнадёжной» ставит заключение комиссии, и фаза встречается в данных',
   g.ev(`kindPhase('Заключение комиссии о безнадёжности')`) === 'Признана безнадёжной'
   && g.ev(`allReqs().some(r=>phaseOf(r)==='Признана безнадёжной')`));
ok('К7 · «Списана» ставят оба акта о списании, и фаза встречается в данных',
   g.ev(`kindPhase('Акт Кабинета Министров о списании')`) === 'Списана'
   && g.ev(`kindPhase('Решение уполномоченного госоргана о списании')`) === 'Списана'
   && g.ev(`allReqs().some(r=>phaseOf(r)==='Списана')`));
for(const b of ['Выписка о ликвидации юр. лица','Решение суда (умерший / отсутствующий / недееспособный)','Приговор суда'])
  ok(`К7 · «${b}» — основание заключения комиссии, а не веха`,
     g.ev(`kindOf(${JSON.stringify(b)}).basisKinds`) === null
     && g.ev(`kindPhase(${JSON.stringify(b)})`) === null
     && g.ev(`kindOf('Заключение комиссии о безнадёжности').basisKinds.includes(${JSON.stringify(b)})`));

/* ══════════════════════════════════════════════════════════════════════════
   Р-5 — КАТЕГОРИЯ РИСКА НА КРЕДИТЕ, worst-of вверх
   ══════════════════════════════════════════════════════════════════════════ */
head('Р-5 · категория риска');
/* Ситуация РИСК волны ЗС: 397 — два кредита (50 дней mid + 0 дней с фактором комитета
   high), 391 — подавление 181-го дня, 394 — два кредита разной тяжести. Прежние 209/210
   этой роли больше не несут (210 стало делом паузы-реструктуризации). */
ok('catOfCredit → «высокий» при нуле дней и факторе high (397, договор 398)',
   g.ev(`catOfCredit(${P('397')}.credits[1]).days`) === 0
   && g.ev(`catOfCredit(${P('397')}.credits[1]).level`) === 'high');
/* Шаг 3 наряда (ADR-0064): отложение — свёртка живого рассмотрения, а не флаг кредита.
   Проверяем и результат (до worst-of, категория средняя), и ИСТОЧНИК: хранимого
   suppress181 в данных не осталось нигде, а отложение указывает на то самое состояние. */
ok('отложение 181-го применяется до worst-of и выводится из состояния (391)',
   g.ev(`catOfCredit(${P('391')}.credits[0]).deferred`) === true
   && g.ev(`catOfCredit(${P('391')}.credits[0]).daysEff`) === 'mid'
   && g.ev(`catOfCredit(${P('391')}.credits[0]).defer.kind`) === 'restructuring'
   && g.ev(`PROCESSES.every(p => p.credits.every(c => !('suppress181' in c)))`));
/* Зафиксированный отказ (п. 19.1) снимает отложение НЕ в свой день, а на следующий:
   на дату фиксации категория ещё средняя. Проверяется на копии затравки — состояние
   правится прямо в ней, поэтому вычисление обязано смотреть на данные, а не на кэш. */
ok('отказ в реструктуризации: в день фиксации — средний, назавтра — высокий', mk().ev(`(() => {
  const c = ${P('391')}.credits[0];
  const s = REQ_INDEX['391/391/з'].states.find(x => x.kind === 'restructuring');
  s.refusedAt = TODAY;
  const sameDay = catOfCredit(c).level;
  s.refusedAt = ruSub(TODAY, 1);
  return sameDay === 'mid' && catOfCredit(c).level === 'high';
})()`));
ok('категория дела = worst-of по кредитам (397 → high при mid+high, 391 → mid)',
   g.ev(`catOfProcess(${P('397')})`) === 'high' && g.ev(`catOfProcess(${P('391')})`) === 'mid');
/* catOfReq ОПРЕДЕЛЕНА как catLevelOfCredit(r._credit) — сверять её с собственным
   определением бессмысленно (и `ev(x) === ev(y)` прошло бы даже на двух undefined).
   Проверяем НАБЛЮДАЕМОЕ: у многокредитного дела 397 кредит 397 даёт mid, кредит 398 —
   high, а worst-of самого дела — high. Значит карточка обязана показать двум его
   требованиям РАЗНЫЕ категории, и требованию по кредиту 397 — «Средний», а не категорию
   дела. Сравнение с литералами: undefined/null ни с одной стороны не пройдёт. */
ok('категория требования берётся у его кредита, а не у дела', (() => {
  const catOnCard = id => { const m = mk(); m.ev(`openDetail('${id}')`);
    const dim = [...m.dhead().querySelectorAll('.phead-dims .dim')]
      .map(x => x.textContent.replace(/\s+/g, ' '))
      .find(t => /Категория риска/.test(t));
    return (dim && (dim.match(/(Норма|Средний|Высокий)/) || [])[1]) || null; };
  return catOnCard('397/397/з') === 'Средний'
      && catOnCard('397/398/з') === 'Высокий'
      && g.ev(`catOfProcess(${P('397')})`) === 'high';   // у дела high — значит «Средний» пришёл не от дела
})());
/* КД-2/КД-3: плитки и раскрытие worst-of живут в шапке ВИДА, не в панели. */
{ const m = mk(); m.ev(`openDetail('397/397/з')`); m.ev('catOpen=false; toggleCat()');
  ok('раскрытие показывает входы покредитно (2 кредита + worst-of)',
     m.dhead().querySelectorAll('.cat-expand .row').length === 3); }
/* Шаг 3 наряда (ADR-0064): «подавлен» ушло вместе с послаблением — раскрытие обязано
   называть отложенный ПЕРЕВОД и предел, до которого он отложен, иначе на витрине снова
   получится «высокий, которому сделали скидку». */
{ const m = mk(); m.ev(`openDetail('391/391/з')`); m.ev('catOpen=false; toggleCat()');
  const t = m.dhead().querySelector('.cat-expand').textContent;
  ok('честная категория видна при отложенном переводе («перевод отложен» + предел)',
     /перевод отложен/.test(t) && /20\.08\.2026/.test(t) && !/подавлен/.test(t)); }
ok('сортировка по категории идёт по тяжести (rank), не по алфавиту',
   g.ev(`sortVal(${R('351/351/з')},'cat')`) === g.ev('CAT_RANK.high'));

/* ══════════════════════════════════════════════════════════════════════════
   М-4 (ADR-0004) — ДОЛГ ЕСТЬ ПРОЕКЦИЯ LEDGER, А НЕ ХРАНИМАЯ СУММА
   ══════════════════════════════════════════════════════════════════════════ */
head('М-4 · долг — проекция снимка модуля кредита');
ok('в данных не осталось c.debt / c.claim',
   g.ev(`PROCESSES.every(p => p.credits.every(c => !('debt' in c) && !('claim' in c)))`));
/* ЗС · «SEED = декларация + билдер»: литерал debt:{ теперь ЕСТЬ в исходнике, но только
   как ВХОД декларации затравки — билдер разносит его в LEDGER, а на кредит модели он не
   попадает. Проверяем не отсутствие строки, а само правило ADR-0004: снимок объявлен по
   каждому кредиту, живёт в LEDGER, и ни у одного кредита нет своего долга/притязания. */
ok('debt объявляется затравкой, а живёт в LEDGER — на кредите его нет (ADR-0004)',
   g.ev(`SEED.every(c => [].concat(c.credit||[], c.credits||[]).every(cr => !!cr.debt))`)
   && g.ev(`Object.keys(LEDGER).length === PROCESSES.flatMap(p=>p.credits).length`)
   && g.ev(`PROCESSES.every(p => p.credits.every(c => !('debt' in c) && !('claim' in c)))`)
   && !/\bclaim:'/.test(HTML));
ok('LEDGER есть по каждому кредиту требования',        g.ev(`allReqs().every(r => !!LEDGER[r.credit])`));
ok('у снимка есть дата среза',                         g.ev(`allReqs().every(r => debtOf(r).asOf !== '—')`));
ok('пять статей долга: четыре корзины LEDGER + расходы взыскания',
   g.ev('LEDGER_BUCKETS.length') === 4 && g.ev(`'costs' in DEBT_LABELS`));
ok('claim = востребованное по статьям + расходы',
   g.ev(`allReqs().every(r => { const d=debtOf(r);
     return Math.abs(d.claim - (d.rows.reduce((s,x)=>s+x.claimable,0) + d.costs)) < 0.005; })`));
/* Числа сняты с живой затравки ЗС (дело 307, договор 307): востребовано 122 300,00 при
   остатке 152 300,00 — охват «просроченная сумма», значит клейм строго меньше остатка. */
ok('охват «просроченная сумма» — востребовано меньше остатка',
   g.ev(`claimOf(${R('307/307/з')})`) === 122300 && g.ev(`debtOf(${R('307/307/з')}).totalLeft`) === 152300);
ok('охват «полный остаток» — востребован весь остаток',
   g.ev(`allReqs().filter(r=>scopeOf(r).volume==='полный остаток').every(r=>{const d=debtOf(r);return Math.abs(d.claim-d.totalLeft)<0.005;})`));
ok('расходы — статья требования, у кредита их нет',
   g.ev(`allReqs().some(r=>(r.costs||[]).length) && PROCESSES.every(p=>p.credits.every(c=>!('costs' in c)))`));
ok('смена охвата (новая устанавливающая мера в журнале) меняет проекцию, снимок не трогает', mk().ev(`(() => {
  const r = REQ_INDEX['307/307/з'], before = claimOf(r), snap = JSON.stringify(LEDGER[r.credit]);
  r._proc.measures.push({ sec:'Судебный', kind:'Исковое заявление', dates:D('29.07.2026','29.07.2026','29.07.2026'),
    num:'ИСК-ТЕСТ', purpose:'тест смены охвата', scope:{volume:'полный остаток',method:'деньгами'},
    sum:'0,00', responsible:'тест', targets:[r.id] });
  return before === 122300 && claimOf(r) === 152300 && JSON.stringify(LEDGER[r.credit]) === snap;
})()`));
ok('§2.2 · агрегат по делу считается один раз на кредит',
   g.ev(`claimTotal(${P('307')}.requirements)`) === 122300);
ok('§2.2 · солидарная строка показывает полную сумму',
   g.ev(`claimOf(${R('307/307/п')})`) === g.ev(`claimOf(${R('307/307/з')})`));
ok('§2.2 · по многокредитному делу суммы кредитов складываются',
   g.ev(`claimSum(${P('402')})`) === g.ev(`${P('402')}.requirements.reduce((s,r)=>s+claimOf(r),0)`));
/* У солидарной пары 307 охват «просроченная сумма», а расход входит в притязание только
   при охвате «полный остаток» (costItems[].claimable). Поэтому охват заёмщика сперва
   ускоряется его собственной мерой (цель одна — он сам), и только потом вносится расход:
   так видны обе половины правила — своя сумма выросла, у солидарного соседа нет. */
ok('расход увеличивает сумму требования и не задевает солидарного соседа', mk().ev(`(() => {
  openDetail('307/307/з');
  curProc.measures.push({ sec:'Судебный', kind:'Исковое заявление', dates:D('20.07.2026','20.07.2026','20.07.2026'),
    num:'ТЕСТ-ИСК-307', scope:{volume:'полный остаток',method:'деньгами'}, sum:'152 300,00', targets:[curReq.id] });
  const before = claimOf(curReq), sol = claimOf(REQ_INDEX['307/307/п']);
  openCostModal();
  document.getElementById('costAmount').value = '1 000,00';
  document.getElementById('costKind').value = 'Государственная пошлина';
  saveCost();
  return before === 152300 && sol === 122300
      && claimOf(curReq) === before + 1000 && claimOf(REQ_INDEX['307/307/п']) === sol;
})()`));
/* Затравка ЗС состоявшихся реализаций залога не содержит (c.realization нет ни у одного
   предмета — торги в K4-ТОРГИ доведены только до акта несостоявшихся торгов), поэтому
   выручка задаётся в тесте на залоговом деле 326 (два предмета, охват «обращением на
   предмет залога»). Модель — наряд «выручка/очередь» (ADR-0054): факт реализации и
   делёж между кредитами живут на ПРЕДМЕТЕ (c.realization/.distribution), не на процессе
   (p.realization снят); делёж — на вкладке «Залог», не «Долг». Проверяется то же правило:
   п. 48 — строка возврата залогодателю обязательна даже при нуле, непокрытый остаток
   назван пунктом 33. */
{ const m = mk();
  /* Ссылка на предмет пересобирается заново в КАЖДОМ m.ev() (индексом 0, не
     локальной const): top-level const из одного w.eval() не переживает
     следующий отдельный вызов в jsdom — найдено при кодировании этого теста. */
  m.ev(`
    PROCESSES.find(p=>p.id==='326').colls[0].realStage = 'реализовано';
    PROCESSES.find(p=>p.id==='326').colls[0].realization = { proceeds: 50000, costs: 0, date: '21.07.2026' };
  `);
  m.ev(`openDetail('326/326/з')`); m.ev(`switchTab(${TAB.zalog})`);
  ok('п. 48 · делёж не опубликован — заметка-приглашение видна (326)',
     /делёж между кредитами ещё не опубликован/.test(m.active().textContent));
  m.ev(`
    openRealizationModal(0);
    document.getElementById('realBasis').value = 'Постановление о распределении (тест)';
    saveDistribution(0);
  `);
  m.ev(`switchTab(${TAB.zalog})`);
  ok('п. 48 · строка возврата залогодателю при реализации залога (326)',
     /Возврат залогодателю/.test(m.active().textContent));
  ok('п. 33 · непокрытый остаток назван пунктом (326)', /п\. 33/.test(m.active().textContent)); }

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
/* п. 32 «один иск ко всем ответчикам»: затравка ЗС мер с двумя целями не содержит —
   каждое дело K1-ОБЕСП ведёт претензию заёмщику и требование поручителю раздельно.
   Само правило от этого не исчезло: общий судебный акт заводится в тесте на солидарной
   паре 307, в отдельном DOM, и обязан двинуть фазу ОБОИХ требований. */
ok('акт по общему иску двигает фазу обоих солидарных ответчиков (п. 32)', mk().ev(`(() => {
  const p = PROCESSES.find(x=>x.id==='307'), t = p.requirements.map(r=>r.id);
  p.measures.push({ sec:'Судебный', kind:'Определение о принятии искового заявления к производству',
    dates:D('20.07.2026','20.07.2026','20.07.2026'), num:'ТЕСТ-ОПР-307',
    outcome:'принято к производству', sum:'122 300,00', targets:t });
  return t.length === 2
      && phaseOf(REQ_INDEX['307/307/з']) === 'Иск' && phaseOf(REQ_INDEX['307/307/п']) === 'Иск';
})()`));
ok('требование поручителю двигает только его требование',
   g.ev(`${P('307')}.measures.find(m=>m.num==='ТП-307').targets.join(',')`) === '307/307/п');
ok('три оси результата упразднены (ADR-0028 п.1) — единый outcome, resultIsDocument-вид его не несёт (иск 142)',
   g.ev(`(()=>{
  const isk = ${P('142')}.measures.find(x=>x.kind==='Исковое заявление');
  const tp  = ${P('307')}.measures.find(x=>x.num==='ТП-307');
  return kindOf('Исковое заявление').resultIsDocument && isk.outcome === undefined
      && !kindOf('Требование поручителю').resultIsDocument && typeof tp.outcome === 'string';
})()`));
{ const m = mk(); m.setRole('Куратор ОД / ДАК / РП');   // 307 ведёт ДАК — «Акт сверки» его вид (В-9)
  ok('мера на две цели считает сумму один раз на кредит (§2.2)', m.ev(`(() => {
    openDetail('307/307/з');
    openMeasureModal();
    document.getElementById('mKind').value = 'Акт сверки';
    document.querySelectorAll('.mTgt').forEach(x => x.checked = true);
    syncMeasureWarnings();
    if(document.getElementById('mSave').disabled) return false;
    saveMeasure();
    const m = curProc.measures[0];
    return m.targets.length === 2 && parseSum(m.sum) === 122300;
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
/* Пересчитано по затравке ЗС: закрыты 14 требований (T-ПОГАШЕНИЕ 208 · 380, K0-РЕТРО
   206 · 207, K6-ЗАВЕРШЕНО 364 · 365, K7 370…378) и ровно те же 14 дел — все они
   однотребовательные, поэтому числа совпадают. */
ok('закрытых требований 14, закрытых дел 14',
   g.ev(`allReqs().filter(isClosedReq).length`) === 14 && g.ev(`PROCESSES.filter(isClosed).length`) === 14);
ok('Р-9 · ретро-закрытое дело скрыто из списка по умолчанию (K0-РЕТРО 206)',
   g.ev(`baseSet().some(r => r.proc==='206')`) === false);
/* ADR-0023 §5: группа больше не зависит от подтверждения передачи — источник теперь
   терминальный исход / состояние лица / худшая стадия открытых требований. */
/* §4.14: значения групп — коды нормы, а не наши имена. 208 стоял «Погашенные» —
   теперь «5.1» (п. 64); 402 стоял «Досудебный порядок» — имя СТАДИИ, группой Порядок
   его не называет вовсе, и досудебная работа по норме остаётся «1.1» (п. 14 присвоил,
   п. 21 переведёт только на иске). Стадия при этом никуда не делась — она отдельная ось
   и своим фильтром показывается по-прежнему. */
ok('терминальный исход даёт группу «5.1 Погашенные» (208)', g.ev(`groupOf(${P('208')})`) === '5.1'
   && g.ev(`groupLabelOf(${P('208')})`) === '5.1 Погашенные');
ok('группа выводится и при ждущей приёма передаче — по стадии открытых требований (402)',
   g.ev(`${P('402')}.requirements.every(r=>handoverPending(r))`)
   && g.ev(`groupOf(${P('402')})`) === '1.1' && g.ev(`stageOfReq(${P('402')}.requirements[0])`) === 'Досудебный порядок');

/* ══════════════════════════════════════════════════════════════════════════
   М-11 — СОСТОЯНИЯ ПО ПРИРОДЕ: обязательство · лицо · ведение дела
   ══════════════════════════════════════════════════════════════════════════ */
head('М-11 · состояния по природе');
ok('состояния обязательства живут на требовании',   g.ev(`allReqs().every(r => Array.isArray(r.states))`));
/* Затравка ЗС держит паузу только на однотребовательных делах (K1-ПАУЗА-ГП 317 · 318,
   K1-ПАУЗА-РЕСТР 319 · 210), поэтому «не задевает солидарного соседа» показывается на
   паре 307: пауза ставится тем же путём, что и в интерфейсе, и остаётся у заёмщика. */
/* Шаг 3 наряда (ADR-0063): пауза по п. 17 ставится РЕШЕНИЕМ комитета — форма без его
   реквизитов состояния не пишет вовсе, поэтому сценарий заполняет их наравне с датами. */
ok('пауза стоит на требовании заёмщика, не на солидарном поручителе', mk().ev(`(() => {
  openDetail('307/307/з');
  openPauseModal();
  document.getElementById('pauseType').value = 'Гарантийное письмо (п. 17)';
  document.getElementById('pauseFrom').value = '2026-07-21';
  document.getElementById('pauseUntil').value = '2026-08-20';
  document.getElementById('pauseDecision').value = 'протокол ПРОТ-307/БА от 21.07.2026';
  savePause();
  return !!pausedState(REQ_INDEX['307/307/з']) && !pausedState(REQ_INDEX['307/307/п']);
})()`));
ok('пауза по п. 17 без реквизитов решения комитета не ставится', mk().ev(`(() => {
  openDetail('307/307/з');
  openPauseModal();
  document.getElementById('pauseType').value = 'Гарантийное письмо (п. 17)';
  document.getElementById('pauseFrom').value = '2026-07-21';
  document.getElementById('pauseUntil').value = '2026-08-20';
  savePause();
  return !pausedState(REQ_INDEX['307/307/з']);
})()`));
ok('оверлей подменяет надпись фазы, саму фазу не трогает',
   g.ev(`displayPhase(${R('210/210/з')})`) === 'Рассмотрение вопроса реструктуризации'
   && g.ev(`phaseOf(${R('210/210/з')})`) === 'Повторная претензия');
/* Состояние лица в затравке ЗС — смерть заёмщика у K5 (356…359); поле теперь label/since,
   типа больше нет. Проверяем природу: состояние висит на ЛИЦЕ, у соседнего дела его нет. */
ok('состояние лица не привязано к обязательству',
   g.ev(`PERSONS[REQ_INDEX['356/356/з'].obligor].state.label`) === 'смерть заёмщика'
   && g.ev(`!PERSONS[REQ_INDEX['201/201/з'].obligor].state`));
ok('состояние лица не приостанавливает меры',
   g.ev(`!measureGate(${R('356/356/з')}, 'Акт сверки')`));
ok('состояние ведения дела живёт на деле (конфликт, окно)',
   g.ev(`!!${P('395')}.conflict && !!${P('201')}.window`));
ok('таблица состояний даёт уровень лица', mk().ev(`(() => {
  openDetail('356/356/з'); return stateRows(curReq).join('').includes('lvl-person');
})()`));
ok('таблица состояний даёт уровень ведения дела', mk().ev(`(() => {
  openDetail('395/395/з'); return stateRows(curReq).join('').includes('lvl-deal');
})()`));
ok('таблица состояний даёт уровень обязательства', mk().ev(`(() => {
  openDetail('210/210/з');
  return stateRows(curReq).join('').includes('lvl-req');
})()`));
/* ADR-0047 (наряд МП-11): «соглашение ложится на требование и солидарных соседей»
   тестировала attachAgreementState() — снята вместе со всей второй бухгалтерией.
   Многоцелевая регистрация («один иск/мера ко всем ответчикам», п. 32) — теперь
   ЦЕЛИКОМ обычный measureTargetsHtml()/measureTargets(), уже покрытый другими
   проверками этого файла для прочих видов меры; Проект/Определение/Констатация
   мирового ничего своего в этот механизм не добавляют — отдельного теста не нужно. */
/* Гейт проверяется мерой ИЗ ПРЕДМЕТА приостановки: гарантийное письмо (п. 17)
   останавливает безакцептное списание и НЕ трогает повторную претензию (ADR-0063) —
   раньше здесь стояла именно претензия, и проверка подтверждала слишком широкую паузу. */
ok('пауза ставится и снимается на требовании', mk().ev(`(() => {
  openDetail('201/201/з');
  openPauseModal();
  document.getElementById('pauseType').value = 'Гарантийное письмо (п. 17)';
  document.getElementById('pauseFrom').value = '2026-07-21';
  document.getElementById('pauseUntil').value = '2026-08-20';
  document.getElementById('pauseDecision').value = 'протокол ПРОТ-201/БА от 21.07.2026';
  savePause();
  const on = !!pausedState(curReq) && measureGate(curReq,'Безакцептное списание').kind === 'pause';
  liftPause();
  return on && !pausedState(curReq);
})()`));
/* ADR-0047 (наряд МП-11): «нарушение соглашения гасит состояние» тестировала
   msSyncStates() на p.agreements[] — оба сняты. Добровольное исполнение не несёт
   исхода «нарушено» в справочнике (outcomes:[{value:'заключено'}], один исход) и
   не блокирует ничего — снятие теста, не перенос. */

/* ══════════════════════════════════════════════════════════════════════════
   ГЕЙТЫ — на уровне требования; гейта «пересечение» больше нет
   ══════════════════════════════════════════════════════════════════════════ */
head('гейты регистрации');
ok('закрытое требование мер не регистрирует',
   g.ev(`measureGate(${R('208/208/з')}, 'Повторная претензия').kind`) === 'closed');
ok('окно ожидания блокирует первичную претензию',
   g.ev(`measureGate(${R('201/201/з')}, 'Первичная претензия').kind`) === 'window'
   && /Окно ожидания/.test(g.ev(`measureGate(${R('201/201/з')}, 'Первичная претензия').reason`)));
/* Проба сменена со «Служебной записки в ДПО» на «Акт сверки» (§4.14): у записки теперь
   своё предусловие — вручение претензии (п. 20.1, servedKinds), и на деле 201 претензии
   ещё нет вовсе, так что гейт вернулся бы не пустой. Проверяется по-прежнему то же:
   окно ожидания держит ТОЛЬКО первичную претензию, соседние виды ему не подчиняются. */
ok('окно ожидания не блокирует прочие виды',
   g.ev(`!measureGate(${R('201/201/з')}, 'Акт сверки')`));
ok('окно нигде не превышает 14 к.д.',   g.ev(`PROCESSES.every(p => !p.window || p.window.days <= 14)`));
ok('отстранение куратора блокирует всё по делу',
   g.ev(`measureGate(${R('395/395/з')}, 'Повторная претензия').kind`) === 'conflict');
/* Живая пауза (210) даёт вид гейта, а изоляцию — та же пара 307: пауза ставится
   заёмщику, у солидарного поручителя гейта нет. */
{ const m = mk();
  ok('пауза требования блокирует только его',
     g.ev(`measureGate(${R('210/210/з')}, 'Повторная претензия').kind`) === 'pause'
     && m.ev(`(() => {
       openDetail('307/307/з');
       openPauseModal();
       document.getElementById('pauseType').value = 'Гарантийное письмо (п. 17)';
       document.getElementById('pauseFrom').value = '2026-07-21';
       document.getElementById('pauseUntil').value = '2026-08-20';
       document.getElementById('pauseDecision').value = 'протокол ПРОТ-307/БА от 21.07.2026';
       savePause();
       const g1 = measureGate(REQ_INDEX['307/307/з'], 'Безакцептное списание');
       const g2 = measureGate(REQ_INDEX['307/307/п'], 'Безакцептное списание');
       return g1 && g1.kind === 'pause' && (!g2 || g2.kind !== 'pause');
     })()`)); }
/* ADR-0063 · ШИРИНА паузы, а не сам факт блокировки: у каждой паузы свой предмет.
   Гарантийное письмо (п. 17) останавливает безакцепт и не трогает претензию; рассмотрение
   реструктуризации (п. 18) останавливает меры п. 16 и не трогает судебный трек. */
ok('гарантийное письмо останавливает безакцепт, но не претензию (317)',
   g.ev(`measureGate(${R('317/317/з')}, 'Безакцептное списание').kind`) === 'pause'
   && g.ev(`(measureGate(${R('317/317/з')}, 'Повторная претензия')||{}).kind !== 'pause'`));
ok('рассмотрение реструктуризации останавливает меры п. 16, но не иск (210)',
   g.ev(`measureGate(${R('210/210/з')}, 'Безакцептное списание').kind`) === 'pause'
   && g.ev(`(measureGate(${R('210/210/з')}, 'Исковое заявление')||{}).kind !== 'pause'`));
ok('безакцепт заблокирован без решения комитета (310, K1-БА-ГЕЙТ)',
   g.ev(`gateReason(${R('310/310/з')}, 'Безакцептное списание')`) !== null);
{ const m = mk(); m.setRole('Отдел проблемных кредитов (ОПК)');
  ok('иск заблокирован без поручения Председателя (310, роль ОПК)',
     /поручени/i.test(m.ev(`gateReason(${R('310/310/з')}, 'Исковое заявление')`))); }
/* Task 2/4 расщепили «Исковое заявление» на resultIsDocument (не веха) + внешние акты-
   определения/решения (Иск/Решение суда двигает АКТ, не наше обращение) — внутри
   контура К3 (Судебный) не осталось ни одной ВЕХИ вида «наш документ», по которой можно
   воспроизвести старый сценарий «повторная регистрация уже пройденной вехи». Контур К1 —
   единственный, целиком состоящий из наших документов; 304 (K1-ПРЕТ2) стоит на «Повторной
   претензии» и паузой не прикрыт, поэтому виден именно гейт последовательности. */
{ const m = mk(); m.setRole('Куратор ОД / ДАК / РП');
  ok('пройденная веха не регистрируется повторно (304/304/з уже на фазе «Повторная претензия»)',
     m.ev(`measureGate(${R('304/304/з')}, 'Первичная претензия').kind`) === 'sequence'); }
{ const m = mk(); m.setRole('Отраслевой департамент (ОД)');
  ok('В-9 · извещение недоступно отраслевому департаменту (полномочие ДПО)',
     /ДПО/.test(m.ev(`subdivReason('Извещение об обращении на залог')`))); }
ok('каждый гейт называет причину и пункт',
   g.ev(`Object.keys(GATES).every(k => { const r = gateReason(${R('310/310/з')}, k); return r===null || /п\\. /.test(r); })`));
ok('внесудебный порядок недоступен для имущественного комплекса (жёсткая блокировка)',
   g.ev(`${P('326')}.colls.some(c => /имущественный комплекс/.test(c.ban))`));
ok('гейта «пересечение» в коде нет',   !/crossingOnCourt/.test(HTML));
/* §4.14: снятого окна претензии больше не хватает — п. 16.2 требует ещё и телефонных
   переговоров. Фикстура регистрирует их и ждёт ПУСТОЙ гейт: проверяется по-прежнему то
   же самое, но теперь полный состав условий нормы, а не одно окно. */
ok('закрытие окна отметкой открывает гейт', mk().ev(`(() => {
  openDetail('201/201/з'); closeWindowMark();
  openMeasureModal();
  document.getElementById('mKind').value = 'Телефонные переговоры с заёмщиком';
  syncMeasureWarnings();
  document.getElementById('mNum').value = 'ТЕСТ-ТП';
  saveMeasure();
  return curProc.window.open === false && !measureGate(curReq, 'Первичная претензия');
})()`));
ok('кнопок назначения / переназначения / продления заданий нет',
   (() => { const m = mk(); m.ev(`openDetail('201/201/з')`);
     return !/Назначить исполнителя|Переназначить|Продлить срок/i.test(m.allTabsText()); })());
/* Позиций в диалоге ровно столько, сколько их в чек-листе передачи (у 390 затравка ЗС
   даёт три) — и все они галочки с data-item, а не поле свободного текста: отклонение
   по-прежнему структурное (п. 19.2). */
{ const m = mk(); m.ev(`openDetail('390/390/з')`); m.ev(`openRejectProc('390/390/з')`);
  ok('чек-лист структурный: отклонение перечисляет позиции чек-листа передачи (п. 19.2)',
     m.$$('#modalHost .rejChk').length === m.ev(`REQ_INDEX['390/390/з'].handovers.slice(-1)[0].checklist.length`)
     && m.$$('#modalHost .rejChk').length === 3
     && m.$$('#modalHost .rejChk').every(c => c.type === 'checkbox' && !!c.getAttribute('data-item'))
     && m.$$('#modalHost textarea').length === 0); }

/* ══════════════════════════════════════════════════════════════════════════
   СРОКИ — Р-3: вычисление от базы шаблона, сущности «задание» нет
   ══════════════════════════════════════════════════════════════════════════ */
head('Р-3 · сроки порядка');
ok('шаблонов сроков 49, у каждого база, срок и пункт',   // было 45 — наряд п.7 добавил строки 46/47 (7а) и 48 (7б); 49 — шаг 4 наряда сверки, п. 37 (`ADR-0068`)
   g.ev('DEADLINE_TEMPLATES.length') === 49 && g.ev(`DEADLINE_TEMPLATES.every(t => t.base && t.term && t.point)`));
/* Апелляционный срок волны ЗС живёт в K3-РЕШЕНИЕ (336 · 337): база — дата ВЫНЕСЕНИЯ
   решения, не дата ввода записи. Разыменование внутри ev — исчезнувшее дело даёт провал
   проверки, а не обрыв прогона. */
ok('остаток срока считается от базы шаблона, не от даты ввода (336 апелляция)',
   g.ev(`(() => { const d = ${P('336')}.deadlines.find(x=>dlAction(x)==='Апелляционная жалоба');
     return !!d && /вынесения решения/.test(d.base) && daysLeft(d) === daysLeft({due:d.due}); })()`));

/* ══════════════════════════════════════════════════════════════════════════
   ИНТЕРАКТИВ — регистрация, сторно, ускорение
   ══════════════════════════════════════════════════════════════════════════ */
head('интерактив');
ok('регистрация вехи двигает фазу свёрткой', mk().ev(`(() => {
  openDetail('201/201/з'); closeWindowMark();
  /* §4.14: переговоры п. 16.2 — предусловие претензии; сами они вехой не являются
     (ни один их исход не несёт setsPhase), так что фазу по-прежнему двигает претензия. */
  openMeasureModal();
  document.getElementById('mKind').value = 'Телефонные переговоры с заёмщиком';
  syncMeasureWarnings();
  document.getElementById('mNum').value = 'ТЕСТ-ТП';
  saveMeasure();
  openMeasureModal();
  document.getElementById('mKind').value = 'Первичная претензия';
  syncMeasureWarnings();
  document.getElementById('mNum').value = 'ТЕСТ-ПР';
  saveMeasure();
  return phaseOf(curReq);
})()`) === 'Претензия');
{ const m = mk(); m.ev(`openDetail('332/332/з')`);
  const before = m.ev('curProc.measures.length');
  /* Task 2/4/Task 3: фазу «Иск» устанавливает больше не сам иск (resultIsDocument,
     outcomes:null — не веха), а дочерний акт «Определение о принятии искового заявления
     к производству» (basedOn на иск, ADR-0027/0031/0038). Сторно откатывает фазу — цель
     сторно поэтому дочерний акт, не сам иск. Дело ЗС-затравки — 332 (K3-ИСК): определение
     там ПОСЛЕДНЯЯ веха, поэтому откат виден (у 142 после него есть решение суда). */
  const idx = m.ev(`curProc.measures.findIndex(x => x.kind==='Определение о принятии искового заявления к производству')`);
  m.ev(`openStornoModal(${idx})`); m.$('#stReason').value = 'ошибочная регистрация'; m.ev(`doStorno(${idx})`);
  ok('И-3 · сторно не удаляет строку',
     m.ev('curProc.measures.length') === before && m.ev(`curProc.measures[${idx}].storno != null`));
  ok('сторно акта о принятии иска откатывает фазу требования',
     m.ev(`phaseOf(REQ_INDEX['332/332/з'])`) === 'Повторная претензия');
  ok('в журнале дела нет ручного отката — фаза записана как свёртка',
     /свёртк/i.test(m.ev('curProc.history[0].what'))); }
{ const m = mk(); m.ev(`openDetail('142/142/з')`); m.ev(`switchTab(${TAB.mery})`);
  /* Сумма иска ИСК-142 — 249 000,00 на дату документа; долг с тех пор жив своей жизнью,
     но документ не пересчитывается (И-1). */
  ok('И-1 · сумма документа иммутабельна, расхождение только помечается',
     g.ev(`${P('142')}.measures.find(x=>x.kind==='Исковое заявление').sum`) === '249 000,00'); }
/* Шаг 4 наряда, §4.6 (`ADR-0067`): ускорение — следствие регистрации извещения, а не
   отдельный клик. Прежняя проверка сторожила ровно обратное («пересчёт выполняется на
   клике»): диалог с парой «Отмена / Зарегистрировать и пересчитать» позволял оставить
   долг неускоренным, чего п. 20.1 не допускает. Теперь модалка только сообщает — у неё
   одна кнопка, и слова «Отмена» в ней нет. */
ok('В-8/§4.6 · извещение ускоряет долг само — модалка сообщает, а не спрашивает', mk().ev(`(() => {
  openDetail('307/307/з'); noticeIzveschenie(applyIzveschenie());
  const t = document.getElementById('modalHost').textContent;
  return /наступили в день регистрации/i.test(t) && !/Отмена/.test(t)
      && document.querySelectorAll('#modalHost .modal-f button').length === 1;
})()`));
ok('В-8/§4.6 · регистрация извещения зовёт ускорение прямо, без промежуточного согласия',
   /if\(kind==='Извещение об обращении на залог'\)\{ const res=applyIzveschenie\(\)/.test(HTML)
   && !/recalcOnIzveschenie/.test(HTML));
/* Ускорение живёт НА МЕРЕ (accelerated + scope), а не полем требования: после клика
   веха несёт обе цели, и притязание обоих солидарных требований становится полным
   остатком. ВНИМАНИЕ (находка волны ЗС, отчёт Task 11): у поручителя ярлык охвата при
   этом остаётся прежним — его собственная веха «Требование поручителю» той же даты
   выигрывает у ускоренной претензии в scopeSetter (сравнение по дате, затем по позиции
   в массиве). Деньги ускорены, надпись — нет; здесь проверяется то, что модель делает. */
ok('извещение ускоряет охват всех солидарных требований (мера, не поле — ADR-0025)', mk().ev(`(() => {
  openDetail('307/307/з'); applyIzveschenie();
  const z = REQ_INDEX['307/307/з'], p = REQ_INDEX['307/307/п'], veha = liveMilestones(z).slice(-1)[0];
  return scopeOf(z).volume === 'полный остаток' && veha.accelerated === true
      && veha.targets.includes(p.id) && z.scope === undefined && p.scope === undefined
      && claimOf(z) === 152300 && claimOf(p) === 152300;
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
  filterState = { stage:'Досудебный порядок' }; const has = visibleReqs().some(r => r.id === '332/332/з');
  filterState = {}; return has;
})()`) === false);
/* Вкладок девять: вкладка «Процедура» снята (ADR-0023 — процедуры дела больше нет),
   у группы «дело» осталось три — Общее · Согласования · История. */
ok('вкладки разделены: 3 дела + 6 требования',
   g.ev(`TABS.filter(t=>t.group==='дело').length`) === 3
   && g.ev(`TABS.filter(t=>t.group==='требование').length`) === 6 && g.ev('TABS.length') === 9);
{ const m = mk(); m.ev(`openDetail('307/307/з')`);
  ok('четыре плитки в шапке карточки, все нередактируемые с подписью источника',
     m.dhead().querySelectorAll('.phead-dims .dim').length === 4
     && m.dhead().querySelectorAll('.phead-dims input, .phead-dims select').length === 0
     && m.dhead().querySelectorAll('.phead-dims .dim .src').length === 4); }
/* Передача, ждущая приёма, живёт в ситуации ВЕД-ПЕРЕДАЧА и на многокредитном 402:
   у 402 счётчик приёма показывает 3 р.д. из 5, у 390 — 2 р.д. */
ok('счётчик приёма передачи работает (402/570/з — осталось 3 р.д.)', g.ev(`(() => {
  const r = REQ_INDEX['402/570/з']; const h = r.handovers[r.handovers.length-1];
  return h.state==='ждёт' && h.leftRd === 3 && h.deadlineRd === 5;
})()`));
{ const m = mk(); m.ev(`openDetail('402/570/з')`); m.ev(`openProcChangeModal('402/570/з')`);
  ok('словарь принимающих подразделений закрыт (селектор из DEPARTMENTS)',
     m.ev('DEPARTMENTS.length') >= 7 && m.$$('#newDept option').length === m.ev("DEPARTMENTS.length - 1")); }
ok('карточка открывается по id требования', mk().ev(`(() => {
  openDetail('307/307/п'); return curReq.id === '307/307/п' && curProc.id === '307';
})()`));
ok('карточка по id дела берёт первое требование', mk().ev(`(() => {
  openDetail('307'); return curProc.id === '307' && curReq.id === '307/307/з';
})()`));
ok('все девять панелей рендерятся без ошибок', (() => {
  const s = mk(); s.ev(`openDetail('307/307/з')`);
  for(let i=0;i<s.ev('TABS.length');i++) s.ev(`switchTab(${i})`);
  return s.errs.length === 0;
})());
ok('переключение требования не уводит с карточки', mk().ev(`(() => {
  openDetail('307/307/з'); pickReq('307/307/п');
  return curReq.id === '307/307/п' && document.getElementById('view-detail').style.display === 'flex';
})()`));
ok('хеш переживает кириллический id требования', mk().ev(`(() => {
  openDetail('307/307/п'); return curHash() === 'detail/307/307/п/' + TABS[curTab].slug;
})()`));
ok('возврат по хешу открывает то же требование', mk().ev(`(() => {
  openDetail('307/307/п'); showView('list'); location.hash = 'detail/307/307/п'; restoreFromHash();
  return curReq.id === '307/307/п';
})()`));
ok('реестр претензий ведёт на требование-адресат', mk().ev(`(() => {
  regRender('claims');
  return /openDetail\\('\\d+\\/[^\\/']+\\/[зпго]'/.test(document.getElementById('claimsBody').innerHTML);
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
    return !availableKinds(REQ_INDEX['201/201/з']).includes('Первичная претензия');
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
   МИРОВОЕ И ДОБРОВОЛЬНОЕ — ADR-0047, наряд МП-11: «Мировое соглашение» (один
   вид, внешний акт с единственным исходом) расщеплено на три вида журнала —
   «Проект…»/«Определение об утверждении…»/«Констатация нарушения…». Вторая
   бухгалтерия (p.agreements[], msApprove/msReject/msBreach/msSyncStates/
   attachAgreementState/openAgreementModal/agSync/agSave, msStageEligible/
   msHasSuit/msHasCourtAct) снята целиком — регистрация обычной формой
   (openMeasureModal/saveMeasure), статус/пауза/слой вычисляются из живых мер
   (mirovoeApprovalOf/mirovoeBreachOf/mirovoeProjectsOf, рядом с msComputeRows).
   ══════════════════════════════════════════════════════════════════════════ */
head('МС · мировое соглашение (ADR-0047, наряд МП-11)');
ok('МС-1 · срок производный ≈ 3.5 (8 платежей × 6 мес)',
   g.ev(`msTermYears(msSeedSchedule('15.08.2026',6,8,96400))`) === 3.5);
ok('МС-1 · срок производный === 3.0 (7 платежей × 6 мес)',
   g.ev(`msTermYears(msSeedSchedule('15.10.2026',6,7,112000))`) === 3.0);
ok('МС-1 · гейт блок при >5 лет и истёкших сроках',   g.ev('msTermGate(true,6).level') === 'block');
ok('МС-1 · гейт warn (не блок) при >5 лет без истёкших', g.ev('msTermGate(false,6).level') === 'warn');
ok('МС-1 · гейт ok при ≤5 лет',
   g.ev('msTermGate(true,5).level') === 'ok' && g.ev('msTermGate(true,3.5).level') === 'ok');
ok('МС-1 · дефолт истёкших сроков — из охвата требования (п. 20.1)',
   g.ev(`msExpiredDefault(${R('120/120/з')})`) === true && g.ev(`msExpiredDefault(${R('201/201/з')})`) === false);
ok('МС-1 · каскад графика «Определения…»: последний остаток 0, сумма тела == итог', g.ev(`(()=>{
  const m = ${P('120')}.measures.find(x=>x.kind==='Определение об утверждении мирового соглашения');
  const total = m.schedule.reduce((s,r)=>s+r.principal,0);
  const rows = msComputeRows(m,{rate:m.rate,base:365,start:m.dates.event,principalTotal:total});
  return Math.abs(rows[rows.length-1].close)<0.01 && Math.abs(rows.reduce((s,r)=>s+r.principal,0)-total)<0.01;
})()`));
ok('МС-5 · «Проект…» требует живого иска (PRECONDITIONS basis:true) — доступен на 142 (иск в цепочке), не на 201 (претензионная стадия)',
   !g.ev(`preconditionReason(${R('142/142/з')}, 'Проект мирового соглашения')`)
   && !!g.ev(`preconditionReason(${R('201/201/з')}, 'Проект мирового соглашения')`));
ok('«Констатация нарушения…» требует живого «Определения…» — доступна на 120 (утверждено), не на 344 (только проект)',
   !g.ev(`preconditionReason(${R('120/120/з')}, 'Констатация нарушения мирового соглашения')`)
   && !!g.ev(`preconditionReason(${R('344/344/з')}, 'Констатация нарушения мирового соглашения')`));
ok('mirovoeApprovalOf/mirovoeBreachOf: 120 живо утверждено и не нарушено, 344 не утверждено',
   g.ev(`!!mirovoeApprovalOf(${R('120/120/з')}) && !mirovoeBreachOf(${R('120/120/з')}, mirovoeApprovalOf(${R('120/120/з')}))`)
   && !g.ev(`mirovoeApprovalOf(${R('344/344/з')})`));
/* «Акт сверки» — вид без PRECONDITIONS-записи и без строки в MEASURE_SUBDIV: чистый
   зонд, не путается с обычными гейтами последовательности/подразделения (у 344/142
   «Повторная претензия» и так блокируется предшествующей фазой — гейт другой природы,
   не про МС; проверять нужно ИМЕННО пробой без посторонних гейтов на пути). */
ok('measureGate: живое утверждённое МС ставит паузу на новые меры принуждения (120), не на дело без утверждения (344)',
   g.ev(`measureGate(${R('120/120/з')}, 'Акт сверки').kind`) === 'pause'
   && g.ev(`measureGate(${R('344/344/з')}, 'Акт сверки')`) === null);
ok('measureGate не блокирует саму «Констатацию нарушения» паузой МС (иначе тупик — паузу нечем закрыть; роль ОПК — своя подразделенческая матрица В-9)', (() => {
  g.ev(`document.getElementById('roleSel').value='Отдел проблемных кредитов (ОПК)'`);
  const gate = g.ev(`measureGate(${R('120/120/з')}, 'Констатация нарушения мирового соглашения')`);
  g.ev(`document.getElementById('roleSel').value='Куратор ОД / ДАК / РП'`);
  return gate === null;
})());
ok('добровольное исполнение НЕ ставит паузу (вторая бухгалтерия/блокировка dobrovolnoe снята, ADR-0047)',
   g.ev(`measureGate(${R('142/142/з')}, 'Акт сверки')`) === null);
ok('layerOf: слой 120 = сумма графика «Определения…» (AWARD_KINDS/m.awards — наряд п.2/п.3 переиспользован целиком, новых денежных машин нет)', g.ev(`(()=>{
  const m = ${P('120')}.measures.find(x=>x.kind==='Определение об утверждении мирового соглашения');
  const total = m.schedule.reduce((s,r)=>s+r.principal,0);
  const l = layerOf(${P('120')}, '120');
  return l && Math.abs(l.sum-total)<0.01;
})()`));
ok('msBanner(r) — по живым мерам требования, не по снятому p.agreements-объекту',
   /утверждено судом/.test(g.ev(`(() => { openDetail('120/120/з'); return msBanner(curReq); })()`))
   && /проект, не утверждён/.test(g.ev(`(() => { openDetail('344/344/з'); return msBanner(curReq); })()`)));
{ const m = mk(); m.ev(`openDetail('344/344/з'); const rs=document.getElementById('roleSel'); if(rs) rs.value='Отдел проблемных кредитов (ОПК)';
  openMeasureModal(); document.getElementById('mKind').value='Проект мирового соглашения'; syncMeasureWarnings();
  document.getElementById('mMsYears').value='6'; document.getElementById('mMsExpired').checked=true; refreshMsGate();`);
  ok('МС-1 · срок >5 лет при истёкших сроках блокирует сохранение (форма регистрации)',
     m.$('#mSave').disabled === true && /не превышает 5 лет/.test(m.$('#mMsTermGate').textContent)); }
{ const m = mk(); m.ev(`openDetail('344/344/з'); const rs=document.getElementById('roleSel'); if(rs) rs.value='Отдел проблемных кредитов (ОПК)';
  openMeasureModal(); document.getElementById('mKind').value='Проект мирового соглашения'; syncMeasureWarnings();
  document.getElementById('mMsNotWorse').checked=true; refreshMsGate();`);
  ok('МС-2 · save разблокируется после «не льготнее» (срок ≤5 лет умолчанием, форма регистрации)',
     m.$('#mSave').disabled === false); }

/* ══════════════════════════════════════════════════════════════════════════
   ПЕРСИСТ ДЕМО — снимок делится на дела и требования
   ══════════════════════════════════════════════════════════════════════════ */
head('персист демо-состояния');
ok('снимок не роняется круговыми ссылками и восстанавливает поля требования; охват переживает круг как часть меры (ADR-0025), не отдельной записью', mk().ev(`(() => {
  openDetail('142/142/з');
  curReq.costs.push({ date:TODAY, kind:'Государственная пошлина', amount:2500, note:null });
  const scopeBefore = scopeLabel(scopeOf(curReq));
  persistState();
  if(!localStorage.getItem(STORE_KEY)) return false;
  restoreState();
  const r = REQ_INDEX['142/142/з'];
  return !!r && scopeLabel(scopeOf(r)) === scopeBefore && r.costs.some(c => c.amount === 2500)
      && r._proc.id === '142' && allReqs().length === 100;   // затравка ЗС: 91 дело · 100 требований
})()`));
ok('после восстановления живое МС снова определяется по мерам (ADR-0047 — не по r.states.agreement, снятому вместе с p.agreements[])', mk().ev(`(() => {
  openDetail('120/120/з'); persistState(); restoreState();
  const r = REQ_INDEX['120/120/з'];
  return !!r && !!mirovoeApprovalOf(r) && !mirovoeBreachOf(r, mirovoeApprovalOf(r));
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
  const best = d => Math.max(...d.reqs.map(r => claimOf(r)));
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
ok('находка 3: подсказка метки называет причину — отложенный перевод или фактор комитета', L.ev(`(() => {
  const r = allReqs().find(r => catOfCredit(r._credit).deferred);
  const r2 = allReqs().find(r => { const c = catOfCredit(r._credit); return c.level !== c.raw && !c.deferred; });
  return !!r && /Перевод на 181-й день отложен/.test(catDivergeMark(r))
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
/* Список устанавливающих видов больше не переписывается сюда руками: он ЕСТЬ в самом
   макете (SCOPE_KIND_DEFAULT) — восемь видов, плюс «Извещение об обращении на залог»,
   которому охват ставит отдельный шаг applyIzveschenie (В-8, п. 20.1). Размер словаря
   зафиксирован, чтобы тихое пополнение справочника было видно. */
ok('scope на мере встречается только у устанавливающих видов (SCOPE_KIND_DEFAULT + извещение)', g.ev(`(() => {
  const ESTABLISHING = new Set([...Object.keys(SCOPE_KIND_DEFAULT), 'Извещение об обращении на залог']);
  return Object.keys(SCOPE_KIND_DEFAULT).length === 8
      && PROCESSES.flatMap(p=>p.measures||[]).filter(m=>m.scope).every(m => ESTABLISHING.has(m.kind));
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
   L.ev('LIST_WIDTHS.length') === 8
   && Math.abs(L.ev(`LIST_WIDTHS.reduce((a,w)=>a+parseFloat(w),0)`) - 100) < 0.001);  // сумма долей — float
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
   && /onclick="toggleFilterPanel\(this\)"/.test(HTML_SRC));
/* Панель свёрнута по умолчанию — её шапка единственный вход в фильтр, и без фокуса
   он был недостижим с клавиатуры вовсе. То же у плиток и у шапок-сортировок: они
   переключатели, а строка списка (ТР-6) с клавиатуры работала с самого начала. */
ok('шапка фильтра доступна с клавиатуры и сообщает раскрытие', (() => {
  const m = mk(), h = m.$('.filter-head');
  const before = h.getAttribute('aria-expanded');
  m.ev(`toggleFilterPanel(document.querySelector('.filter-head'))`);
  return h.getAttribute('tabindex') === '0' && h.getAttribute('role') === 'button'
      && before === 'false' && h.getAttribute('aria-expanded') === 'true'
      && h.classList.contains('open'); })());
ok('плитки доступны с клавиатуры и говорят о нажатом состоянии', (() => {
  const m = mk(); m.ev(`renderList(); clickTile('gate')`);
  const tiles = m.$$('#listTiles .tile');
  const gate = tiles.find(t => t.getAttribute('aria-pressed') === 'true');
  return tiles.every(t => t.getAttribute('tabindex') === '0' && t.getAttribute('role') === 'button')
      && !!gate && /Заблокировано/.test(gate.textContent)
      && tiles.filter(t => t.getAttribute('aria-pressed') === 'true').length === 1
      && tiles[0].getAttribute('aria-pressed') === null;   // «Всего» отбор не задаёт
})());
ok('шапки колонок доступны с клавиатуры и несут aria-sort', (() => {
  const m = mk(); m.ev('renderList()');
  const th = m.$$('#listHead th');
  const sorted = th.filter(t => t.getAttribute('aria-sort') !== 'none');
  return th.length === 8 && th.every(t => t.getAttribute('tabindex') === '0')
      && sorted.length === 1 && sorted[0].getAttribute('aria-sort') === 'descending'
      && /Сумма требования/.test(sorted[0].textContent); })());
ok('у фокуса есть видимая обводка — у шапки фильтра, плитки и шапки колонки',
   /\.filter-head:focus-visible\{/.test(HTML_SRC) && /\.tile:focus-visible\{/.test(HTML_SRC)
   && /thead th:focus-visible\{/.test(HTML_SRC));
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
ok('ПЛ-Д1: раскладка фиксированная',          /table\.grid\{ width:100%;[^}]*table-layout:fixed/.test(HTML_SRC));
/* Доли colgroup считаны под бюджет 1240 px. Ниже него они врут: при окне 1440 таблица
   становилась 1080 и «Кредитный договор» обрезался во всех 135 строках. */
ok('таблица не сжимается ниже бюджета замера — уже него прокрутка обёртки',
   /table\.grid\{[^}]*min-width:1240px/.test(HTML_SRC) && /\.grid-wrap\{[^}]*overflow:auto/.test(HTML_SRC));
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
   && parseFloat(L.ev(`LIST_WIDTHS[5]`)) >= 9.6   // подразделение:  было 8; 119 px = «подразделение» 97 + жёлоб 16
   && parseFloat(L.ev(`LIST_WIDTHS[6]`)) >= 9.4   // сумма:          было 9
   && parseFloat(L.ev(`LIST_WIDTHS[7]`)) >= 7.5); // дней просрочки: было 6
/* Замер в живом Chrome после перераспределения (1240 px, все 135 требований): не влезают
   только три вещи, и все три — осознанно. Способ охвата «обращением на предмет залога»
   (208 px против 162 колонки) — термин ADR-0025, целиком в подсказке; «Рассмотрение
   вопроса реструктуризации» (380 против 244) — колонка держит МОДАЛЬНОЕ значение (ПЛ-Д3);
   имя с бейджем состояния (268 против 247) — имя дублируется в подсказке и в карточке.
   Номер договора, категория, сумма, дни и ОБЪЁМ охвата не обрезаются ни в одной строке. */
ok('охвату хватает ширины на объём — обрезаться может только длинный способ',
   parseFloat(L.ev(`LIST_WIDTHS[2]`)) >= 13.1);   // 162 px; «просроченная сумма» = 157 с паддингом
ok('ПЛ-Д3: фазе оставлено модальное значение, добавка снята с имени',
   parseFloat(L.ev(`LIST_WIDTHS[3]`)) >= 19.7     // 244 px — ровно ячейка 119 строк из 132
   && parseFloat(L.ev(`LIST_WIDTHS[0]`)) < 22);   // имя дублируется в шапке дела и в title
ok('ячейки тела по-прежнему обрезаются с подсказкой, а не переносятся',
   /tbody td\{[^}]*white-space:nowrap/.test(HTML_SRC) && /tbody td\{[^}]*text-overflow:ellipsis/.test(HTML_SRC));
/* ПЛОТНОСТЬ. Двухстрочные ячейки с height:auto давали шесть разных высот строки
   (49/51/54/56/59/73 px) — повторяющейся единицы у таблицы не оставалось. Высота
   фиксирована, а всё, что могло её растянуть, ограничено структурно: ровно две .pline,
   каждая в одну строку, и потолок у .pwrap. jsdom пикселей не считает — проверяем то,
   из чего высота складывается. Замер в живом Chrome после правки: все 135 строк 47 px. */
ok('двухстрочные ячейки фиксированы по высоте, а не растут по содержимому',
   /td\.wrap2\{ height:46px/.test(HTML_SRC) && /td\.twoline\{ height:46px/.test(HTML_SRC)
   && /\.pwrap\{[^}]*max-height:38px/.test(HTML_SRC));
ok('в каждой строке у охвата и фазы ровно по две строки-.pline, не больше',
   rowsOnPage().every(tr => [...tr.children[2].querySelectorAll('.pline')].length === 2
                         && [...tr.children[3].querySelectorAll('.pline')].length <= 2));
ok('.pwrap ставится и когда трека нет — иначе фаза растекается на три строки',
   rowsOnPage().every(tr => !!tr.children[3].querySelector('.pwrap')));
ok('пилюля в строке списка компактнее карточной', /tbody \.pill\{[^}]*line-height:15px/.test(HTML_SRC));
ok('охват показан двумя половинами (ADR-0025), объём отдельной строкой', rowsOnPage().every(tr => {
  const l = [...tr.children[2].querySelectorAll('.pline')].map(e => e.textContent.trim());
  return ['просроченная сумма','полный остаток'].includes(l[0])
      && ['деньгами','обращением на предмет залога'].includes(l[1]); }));
/* «Дог.» дословно повторяло шапку колонки, «от» — служебное: 8 символов ≈ 40 px в
   каждой из 135 строк, из-за которых с хвоста уходил ГОД договора. */
ok('номер договора в ячейке короткий, а в подсказке полный', rowsOnPage().every(tr => {
  const td = tr.children[1];
  return !/^Дог\./.test(td.textContent.trim()) && /^Дог\. №/.test(td.getAttribute('title')||'')
      && /\d{2}\.\d{2}\.\d{4}$/.test(td.textContent.trim()); }));
ok('выгрузка отдаёт номер договора полностью, а не экранное сокращение',
   L.ev(`exportTsv().tsv.includes('Дог. №')`));
/* Стрелка сортировки рисуется у ВСЕХ восьми колонок — значит все восемь обязаны
   сортировать. «Охват» уходил в default sortVal (r.scope нет — охват свёртка мер) и
   отдавал '' у всех строк: колонка выглядела рабочей, а порядок не менялся. */
ok('каждая колонка списка сортируется по различающему значению, а не по пустоте',
   L.ev(`LIST_COLS.every(c => new Set(allReqs().map(r => String(sortVal(r, c.k)))).size > 1)`));
ok('охват сортируется по строгости (полный остаток строже просроченной суммы)',
   L.ev(`SCOPE_RANK({volume:'полный остаток',method:'обращением на предмет залога'})
       > SCOPE_RANK({volume:'полный остаток',method:'деньгами'})
       && SCOPE_RANK({volume:'полный остаток',method:'деньгами'})
       > SCOPE_RANK({volume:'просроченная сумма',method:'деньгами'})`));

head('отбор реестра — в адресе (паритет с СК-6 / КР / КД-8)');
ok('чистый реестр остаётся коротким «#list»',
   L.ev(`(() => { resetAllConditions(); return listHash(); })()`) === 'list');
/* resetAllConditions снимает условия отбора, но не сортировку и не размер страницы —
   они не условия. Поэтому исходное состояние задаётся явно. */
const listDefaults = `resetAllConditions(); sortKey='claim'; sortDir=-1; onPageSize(25);`;
/* Стадия для проверки страницы — «Досудебный порядок»: в затравке ЗС там 44 требования,
   то есть при 25 строках вторая страница существует (у «Судебного порядка» их 21 — одна
   страница, и p=2 в адрес бы не попал не из-за адреса, а из-за отбора). */
ok('поля, сортировка и страница попадают в адрес', mk().ev(`(() => {
  renderList(); ${listDefaults} setDep('stage','Досудебный порядок'); sortList('overdueDays'); gotoPage(2);
  return listHash(); })()`)
   === 'list/stage=Досудебный порядок;sort=overdueDays;p=2');
ok('плитка и размер страницы — тоже в адресе', mk().ev(`(() => {
  renderList(); ${listDefaults} clickTile('gate'); onPageSize(50);
  return listHash(); })()`)
   === 'list/tile=gate;n=50');
ok('F5 возвращает тот же отбор — поля, плитку, сортировку и страницу', mk().ev(`(() => {
  renderList(); ${listDefaults} setDep('stage','Досудебный порядок');
  sortList('overdueDays'); gotoPage(2);
  const h = curHash(), n = document.querySelectorAll('#listBody tr.rowopen').length;
  location.hash = 'list'; restoreFromHash();          // «перезагрузка» на чистый реестр
  location.hash = h; restoreFromHash();
  return filterState.stage === 'Досудебный порядок'
      && sortKey === 'overdueDays' && sortDir === 1 && curPage === 2
      && document.querySelectorAll('#listBody tr.rowopen').length === n; })()`));
ok('значение со слэшем (охват) переживает адрес', mk().ev(`(() => {
  renderList(); setF('scope','полный остаток / деньгами'); const h = curHash();
  location.hash = 'list'; restoreFromHash(); location.hash = h; restoreFromHash();
  return filterState.scope === 'полный остаток / деньгами'; })()`));
ok('мусор в адресе не становится условием отбора', mk().ev(`(() => {
  renderList(); location.hash = 'list/нетТакогоПоля=1;tile=нетТакойПлитки;sort=нетТакойКолонки;n=7';
  restoreFromHash();
  return Object.keys(filterState).length === 0 && tileFilter === null
      && sortKey === 'claim' && PAGE_SIZE === 25; })()`));
ok('тоггл ретро-закрытых тоже в адресе', mk().ev(`(() => {
  renderList(); const rt = document.getElementById('retroToggle');
  rt.checked = true; renderList();
  const h = curHash(); location.hash = 'list'; restoreFromHash();
  location.hash = h; restoreFromHash();
  return /retro=1/.test(h) && document.getElementById('retroToggle').checked; })()`));
/* Дело — ось группировки этого реестра: оно в подсказке строки, в выгрузке и в поиске
   «Сроков на контроле» (dlQ), а искаться по нему было нельзя. */
ok('поиск находит требование по номеру дела', L.ev(`(() => {
  resetAllConditions(); setF('q','В-2026-000142');
  const rs = visibleReqs(); resetAllConditions();
  return rs.length > 0 && rs.every(r => r._proc.id === '142'); })()`));
ok('подпись поля поиска называет все три ключа', /Заёмщик, ИНН или № дела/.test(HTML_SRC));

/* ══════════════════════════════════════════════════════════════════════════
   ВОЛНА КД (28.07.2026) — карточка дела. Решения КД-1…КД-15, дефекты КД-Д1…КД-Д16.
   Разбор: mockups/collection/ASUBK-status-razrabotki.md · устройство: §14.2 спецификации.
   ══════════════════════════════════════════════════════════════════════════ */
/* Волна ЗС: делом с двумя требованиями стало 307 (K1-ОБЕСП, заёмщик + поручитель по
   одному договору) — прежнее 142 однотребовательное. Тождество дела то же самое:
   ОсОО «Бек Кабель», ИНН 01912201610212, Бишкек, куратор Тукинова А.С. */
const D = mk();            // общий DOM волны: карточка на деле с двумя требованиями
D.ev(`openDetail('307/307/з')`);
const dims  = () => [...D.dhead().querySelectorAll('.phead-dims .dim .dl')].map(x=>x.textContent.trim().split(' ▸')[0]);
const tabs  = () => [...D.doc.querySelectorAll('.dtab')].map(x=>x.textContent.trim());
const slugs = () => D.ev('TABS.map(t=>t.slug)');

head('КД-1 · рамка: рабочее место по требованию');
ok('карточка всегда открыта на требовании', D.ev('!!curReq'));
ok('умолчание — «Обзор», а не папка дела', D.ev(`TABS[DEFAULT_TAB].slug === 'obzor'`));
ok('открытие из реестра ведёт на «Обзор»',
   (D.ev(`openDetail('307/307/з')`), D.ev(`TABS[curTab].slug === 'obzor'`)));
ok('открытие по id дела берёт первое требование и тот же разрез',
   mk().ev(`(() => { openDetail('307'); return curReq.id === '307/307/з' && TABS[curTab].slug === 'obzor'; })()`));

head('КД-2 · шапка — часть вида, а не панелей');
ok('шапка живёт вне #detailPanels', !!D.dhead() && !D.dhead().closest('#detailPanels'));
ok('шапка одна на все вкладки: заголовок, чипы и плитки на каждой', (() => {
  const m = mk(); m.ev(`openDetail('307/307/з')`);
  for(let i=0;i<m.ev('TABS.length');i++){
    m.ev(`switchTab(${i})`);
    const h = m.dhead();
    if(!h.querySelector('.dhead-id') || !h.querySelector('.reqchips') || !h.querySelector('.phead-dims')) return false;
  }
  return true;
})());
/* Баннер — не постоянная часть шапки, а сообщение о блокировке: он есть ровно там, где
   блокировка есть (210 — пауза), и его нет там, где её нет (307). Раньше это проверялось
   на деле, у которого пауза была всегда, и «ровно один баннер» читалось как «всегда». */
ok('баннер блокировки — на всех вкладках дела с блокировкой и нигде на деле без неё', (() => {
  const a = mk(); a.ev(`openDetail('210/210/з')`);
  const b = mk(); b.ev(`openDetail('307/307/з')`);
  for(let i=0;i<a.ev('TABS.length');i++){
    a.ev(`switchTab(${i})`); b.ev(`switchTab(${i})`);
    if(a.dhead().querySelectorAll('.phead-banner').length !== 1) return false;
    if(b.dhead().querySelectorAll('.phead-banner').length !== 0) return false;
  }
  return true;
})());
/* Блокировку несут дела ЗС с состоянием: 210 — пауза реструктуризации, 201 — окно
   ожидания, 395 — отстранённый куратор. Баннер обязан быть виден там, где блокировка бьёт. */
ok('баннер блокировки виден на «Журнале мер» — там, где блокировка и бьёт', (() => {
  return ['210/210/з','201/201/з','395/395/з'].every(id => {
    const m = mk(); m.ev(`openDetail('${id}')`); m.ev(`switchTab(${TAB.mery})`);
    return /пауза|Окно ожидания|куратор отстранён|Лицо:/.test(m.dhead().textContent); }); })());
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
/* ADR-0023: «процедура» дела ушла — заголовок сводит группу, куратора и сумму по делу;
   владение (dealOwnerLabel) остаётся выводимым, но плиткой уже не показывается. */
ok('группа и куратор — в заголовке дела, старой процедуры там больше нет',
   !dims().some(d=>/Процедура|Группа/.test(d))
   && D.ev('dealOwnerLabel(curProc)') === 'ДАК'
   && /группа /.test(D.doc.querySelector('.dhead-run').textContent)
   && /куратор Тукинова/.test(D.doc.querySelector('.dhead-run').textContent)
   && !/Работа с судебными органами|Взыскание задолженности/.test(D.doc.querySelector('.dhead-run').textContent));
ok('счётчик приёма передачи виден в журнале передач вкладки «Дело» (402/570/з)', (() => {
  const m = mk(); m.ev(`openDetail('402/570/з')`);
  m.ev(`switchTab(TABS.findIndex(t=>t.slug==='obschee'))`);
  return /осталось 3 р\.д\. \(срок подтверждения\)/.test(m.active().textContent); })());
ok('раскрытие worst-of работает из шапки',
   (D.ev('catOpen=false; toggleCat()'), D.dhead().querySelectorAll('.cat-expand .row').length > 0));

head('КД-4 · имена и порядок вкладок');
/* Вкладка «Процедура» снята вместе с самой процедурой (ADR-0023): у группы «дело»
   осталось три вкладки, первая из них так и называется — «Дело». */
ok('группа «дело»: Дело · Согласования · История',
   slugs().slice(0,3).join(',') === 'obschee,soglasovaniya,istoriya');
ok('группа «требование»: Обзор · Журнал мер · Долг · Суд · Особые состояния · Залог',
   slugs().slice(3).join(',') === 'obzor,mery,dolg,sud,sostoyaniya,zalog');
ok('«Долг» перед «Судом» — по частоте (долг у всех требований, суд у немногих дел)',
   TAB.dolg < TAB.sud);
ok('слага delo нет — вкладка дела зовётся obschee', !slugs().includes('delo'));
ok('«Ведение дела» и «Процедура» из вкладок ушли',
   !tabs().some(t=>/Ведение дела|Процедура/.test(t)));

head('КД-5 · Суд и Залог — по требованию, а не по делу');
/* courtActs[] демонтирован (Task 3, ADR-0027/0031) — акт инстанции ТЕПЕРЬ САМ МЕРА
   расщеплённого судебного вида (COURT_ACT_KINDS), а не отдельная сущность на поле
   процесса: у него есть собственные targets, а связь с породившим иском/жалобой —
   basedOn (не отдельный measureNum-указатель). */
ok('courtActs[] демонтирован — отдельного поля на процессе больше нет',
   D.ev(`PROCESSES.every(p => !('courtActs' in p))`));
ok('акт ссылается на меру-основание через basedOn (не measureNum на отдельной сущности)',
   D.ev(`courtActsOf(REQ_INDEX['142/142/з']).length === 2
      && courtActsOf(REQ_INDEX['142/142/з']).every(m => !!m.basedOn && basedOnValid(m))`));
ok('привязка акта выводится через targets самой меры',
   D.ev(`(()=>{const m=courtActsOf(REQ_INDEX['142/142/з'])[0];
     return Array.isArray(m.targets) && boundToReq(REQ_INDEX['142/142/з'], m.num) === true;})()`));
/* п. 32: акт, поданный к обоим ответчикам, виден обоим требованиям. Затравка ЗС мер с
   двумя целями не держит (см. М-5), поэтому акт заводится в тесте на паре 307. */
ok('акт к обоим ответчикам виден обоим требованиям (п. 32)', mk().ev(`(() => {
  const p = PROCESSES.find(x=>x.id==='307'), t = p.requirements.map(r=>r.id);
  p.measures.push({ sec:'Судебный', kind:'Исковое заявление', dates:D('15.07.2026','15.07.2026','15.07.2026'),
    num:'ТЕСТ-ИСК-307', scope:{volume:'полный остаток',method:'деньгами'}, sum:'152 300,00', targets:t });
  p.measures.push({ sec:'Судебный', kind:'Определение о принятии искового заявления к производству',
    dates:D('20.07.2026','20.07.2026','20.07.2026'), num:'ТЕСТ-ОПР-307', basedOn:'ТЕСТ-ИСК-307',
    outcome:'принято к производству', sum:'152 300,00', targets:t });
  const act = p.measures.find(m=>m.num==='ТЕСТ-ОПР-307');
  return basedOnValid(act)
      && courtActsOf(REQ_INDEX['307/307/з']).length === 1
      && courtActsOf(REQ_INDEX['307/307/п']).length === 1;
})()`));
ok('чужой судебный процесс в требование не протекает', D.ev(`(()=>{
  /* ОПР-561 — акт по договору 561 того же многокредитного дела 412 */
  return boundToReq(REQ_INDEX['412/561/з'], 'ОПР-561') === true
      && boundToReq(REQ_INDEX['412/560/з'], 'ОПР-561') === false;})()`));
ok('предмет залога привязан к кредиту',
   D.ev(`PROCESSES.every(p=>p.colls.every(c=>c.credit==null || p.credits.some(x=>x.id===c.credit)))`));
ok('на стенде все 12 предметов привязаны',   // затравка ЗС: 12 предметов залога у 11 дел
   D.ev(`PROCESSES.reduce((a,p)=>a+p.colls.length,0)`) === 12
   && D.ev(`PROCESSES.reduce((a,p)=>a+p.colls.filter(c=>c.credit==null).length,0)`) === 0);
ok('залог виден требованию по его договору — и всем требованиям того же договора',
   D.ev(`allReqs().every(r => collsOf(r).length === (r._proc.colls||[]).filter(c=>c.credit===r.credit).length)`)
   && D.ev(`collsOf(REQ_INDEX['326/326/з']).length`) === 2);
ok('строка без привязки не прячется, а помечается «по делу»', (() => {
  const pill = D.ev('String(dealLevelPill)');
  return /по делу/.test(pill) && /Ссылки на меру нет/.test(pill); })());
ok('фильтр пропускает непривязанное, а не выбрасывает (заседания — measureNum-привязка, courtActs демонтирован)',
   D.ev(`(() => {
  const r = REQ_INDEX['332/332/з'];
  return boundToReq(r, null) === null && boundToReq(r, 'НЕТ-ТАКОЙ') === null
      && (r._proc.hearings||[]).filter(h=>boundToReq(r,h.measureNum)!==false).length
         >= (r._proc.hearings||[]).filter(h=>boundToReq(r,h.measureNum)===true).length; })()`));

head('КД-6 · срок принадлежит требованию');
ok('у срока есть цели', D.ev(`PROCESSES.every(p=>p.deadlines.every(d=>Array.isArray(d.targets)))`));
ok('дело-уровневые сроки (приём передачи, конфликт) целей не получили',
   D.ev(`PROCESSES.flatMap(p=>p.deadlines).filter(d=>!d.targets.length)
         .every(d=>/статуса? процедуры|конфликт/i.test(dlAction(d)))`));
ok('срок виден требованию из своих целей (336 — апелляция по его решению суда)',
   D.ev(`deadlinesOf(REQ_INDEX['336/336/з']).some(d=>dlAction(d)==='Апелляционная жалоба')`));
/* Сроков с двумя целями затравка ЗС не содержит вовсе (у всех живых targets.length 1 или 0),
   поэтому правило «один срок по общему иску виден ОБОИМ адресатам» показывается синтетикой
   в отдельном DOM. Берём трёхтребовательное дело 412 и целим срок в ДВА требования из трёх:
   два обязаны его видеть, третье — нет. Отрицательный случай здесь и есть проверка: без
   него утверждение вырождается в определение deadlinesOf (там ровно этот же фильтр). */
ok('срок с двумя целями виден обоим адресатам и не течёт в третье требование дела', mk().ev(`(() => {
  if(PROCESSES.flatMap(x=>dlOf(x)).some(d=>(d.targets||[]).length > 1)) return false;  // в затравке таких нет
  const p = PROCESSES.find(x=>x.id==='412'), t = p.requirements.map(r=>r.id);
  if(t.length !== 3) return false;
  const d = { action:'ТЕСТ-СРОК-ОБЩИЙ', due:'01.09.2026', targets:[t[0], t[1]] };
  p.deadlines.push(d);
  return deadlinesOf(REQ_INDEX[t[0]]).includes(d)
      && deadlinesOf(REQ_INDEX[t[1]]).includes(d)
      && !deadlinesOf(REQ_INDEX[t[2]]).includes(d);
})()`));
/* Сроки заёмщика в требование поручителя не текут: цели срока разделяют их так же,
   как меры — каждый срок таргетится на СВОЙ id, не общий. Волна ЗС-2 (вывод сроков по
   журналу): очередь заёмщика 2 → 3 (тпл 41 «Служебная записка в ДПО о судебном
   взыскании», выведенный от истечения срока повторной претензии ПР-307/2). Волна
   давности (наряд п.7б, davnostDeadlines): тпл 48 считается НЕЗАВИСИМО на каждом
   открытом требовании кредита — заёмщик 3 → 4, поручитель 0 → 1 (свой давностный срок
   со своим targets:[id], НЕ общая запись двух).
   Инвариант («не текут») по-прежнему в силе: считаем не отсутствие срока у поручителя,
   а то, что targets не пересекаются. */
ok('сроки заёмщика в сроки поручителя не текут (раздельные targets, не общий счёт)',
   D.ev(`deadlinesOf(REQ_INDEX['307/307/з']).length`) === 4
   && D.ev(`deadlinesOf(REQ_INDEX['307/307/п']).length`) === 1
   && D.ev(`!deadlinesOf(REQ_INDEX['307/307/п']).some(d => (d.targets||[]).includes('307/307/з'))`)
   && D.ev(`!deadlinesOf(REQ_INDEX['307/307/з']).some(d => (d.targets||[]).includes('307/307/п'))`));
ok('блок сроков стоит на «Обзоре» и назван уровнем', (() => {
  const m = mk(); m.ev(`openDetail('307/307/з')`); m.ev(`switchTab(${TAB.obzor})`);
  return /Сроки на контроле по требованию/.test(m.active().textContent); })());

head('КД-7 · чипы требований');
ok('дело с двумя требованиями даёт кнопки-переключатели',
   D.dhead().querySelectorAll('button.reqchip').length === 2);
ok('дело с одним требованием даёт подпись, а не кнопку', (() => {
  const m = mk(); m.ev(`openDetail('201/201/з')`);
  return m.dhead().querySelectorAll('.reqchip.solo').length === 1
      && m.dhead().querySelectorAll('button.reqchip').length === 0; })());
ok('чип рисуется всегда — и когда переключать нечего',
   mk().ev(`(() => { openDetail('201/201/з');
     return document.querySelectorAll('#detailHead .reqchip').length === 1; })()`));
ok('на вкладке дела чипы приглушены (обещание §14.2)', (() => {
  const m = mk(); m.ev(`openDetail('307/307/з')`); m.ev(`switchTab(${TAB.obschee})`);
  const on = m.dhead().classList.contains('deal-tab');
  m.ev(`switchTab(${TAB.mery})`);
  return on && !m.dhead().classList.contains('deal-tab'); })());
ok('переключение требования вкладку сохраняет', mk().ev(`(() => {
  openDetail('307/307/з'); switchTab(${TAB.dolg}); pickReq('307/307/п');
  return TABS[curTab].slug === 'dolg' && curReq.id === '307/307/п'; })()`));

head('КД-8 · вкладка в URL слагом');
ok('хеш содержит слаг вкладки', /detail\/307\/307\/з\/sud$/.test(
   mk().ev(`(() => { openDetail('307/307/з'); switchTab(${TAB.sud}); return curHash(); })()`)));
ok('F5 возвращает ту же вкладку и то же требование', mk().ev(`(() => {
  openDetail('307/307/п'); switchTab(${TAB.zalog}); const h = curHash();
  showView('list'); location.hash = h; restoreFromHash();
  return curReq.id === '307/307/п' && TABS[curTab].slug === 'zalog'; })()`));
ok('хеш без слага открывает умолчание', mk().ev(`(() => {
  location.hash = 'detail/307/307/п'; restoreFromHash();
  return curReq.id === '307/307/п' && TABS[curTab].slug === 'obzor'; })()`));
ok('слаг, а не индекс: перестановка вкладок старых ссылок не ломает',
   g.ev(`TABS.every(t=>/^[a-z]+$/.test(t.slug))`) && new Set(slugs()).size === 9);

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
  for(const id of ['307/307/з','120/120/з','201/201/з','412/560/з','326/326/з']){
    s.ev(`openDetail('${id}')`);
    for(let i=0;i<s.ev('TABS.length');i++) s.ev(`switchTab(${i})`);
  }
  return s.errs.length === 0;
})());

head('КД-10 · действия контекстные, футер не действует');
/* Футер карточки снят целиком — действий вне панелей у неё больше нет (обещание КД-10
   «футер не действует» доведено до конца: ни кнопки, ни самого контейнера). */
ok('футера с действиями у карточки нет вовсе',
   D.doc.querySelectorAll('#view-detail .footer').length === 0);
ok('утверждение «карточка read-only» из шапки-комментария снято',
   !/Карточка read-only/.test(HTML));
ok('действия живут в панелях', (() => {
  const m = mk(); m.ev(`openDetail('307/307/з')`); m.ev(`switchTab(${TAB.mery})`);
  return m.active().querySelectorAll('button').length > 1; })());

head('КД-11 · крошка — путь, а не второй заголовок');
/* Крошка карточки — одно звено: номер дела (setCrumb([['дело №…']]), collection.html).
   Звена-ссылки «назад в реестр» в ней сейчас нет — см. находку в отчёте Task 11. */
ok('крошка называет дело номером и одним звеном',
   /дело №В-2026-000307/.test(D.$('#crumbTitle').textContent)
   && D.$('#crumbTitle').children.length === 1);
ok('крошка не дублирует шапку (ни требования, ни фазы)',
   !/307\/307\/з|Претензия|Рассмотрение вопроса/.test(D.$('#crumbTitle').textContent));
ok('точка записи крошки одна', (HTML.match(/getElementById\('crumbTitle'\)/g)||[]).length === 1);
ok('возврат в реестр сохраняет страницу и фильтры', mk().ev(`(() => {
  renderList(); onPageSize(50); gotoPage(2); const page = curPage, size = PAGE_SIZE;
  openDetail('307/307/з'); showView('list');
  return curPage === page && PAGE_SIZE === size
      && document.querySelectorAll('#listBody tr.rowopen').length > 0; })()`));

head('КД-12 · «Общее» не дублирует чипы');
{ const m = mk(); m.ev(`openDetail('307/307/з')`); m.ev(`switchTab(${TAB.obschee})`);
  const t = m.active().textContent;
  ok('таблицы «Требования дела» на вкладке нет', !/Требования дела/.test(t));
  ok('дублей счётчика и суммы по делу нет', !/Требований в деле|Сумма по делу/.test(t));
  /* Блок называется «Участники дела»: лицо · роль · состояние лица — в чип это не влезает. */
  ok('участники дела остались — их вопрос в чип не помещается',
     /Участники дела/.test(t) && /поручитель/.test(t) && /Состояние лица/.test(t));
  ok('паспорт дела на месте', /Общие сведения/.test(t) && /Заёмщик/.test(t) && /Основание открытия/.test(t)); }

head('КД-13 · счётчики вкладок и пустые состояния с причиной');
ok('счётчик стоит у вкладок-списков', D.doc.querySelectorAll('.dtab .dtab-n').length >= 6);
ok('нулевой счётчик приглушён, но вкладка не спрятана', (() => {
  const m = mk(); m.ev(`openDetail('201/201/з')`);
  const zero = [...m.doc.querySelectorAll('.dtab .dtab-n.zero')];
  return zero.length > 0 && m.doc.querySelectorAll('.dtab').length === 9; })());
ok('счётчик «Особых состояний» равен показанному на вкладке',
   D.ev(`stateCount(curReq) === stateRows(curReq).length + (curReq.states||[]).filter(s=>s.kind==='mirovoe').length`));
ok('счётчик «Суда» считает акты и заседания требования',
   D.ev(`TABS[${TAB.sud}].count(curProc,curReq) === courtActsOf(curReq).length + hearingsOf(curReq).length`));
{ const m = mk(); m.ev(`openDetail('397/398/з')`);   // требование без сроков, состояний, суда и залога
  const empt = {};
  for(let i=0;i<m.ev('TABS.length');i++){ m.ev(`switchTab(${i})`);
    const e = m.active().querySelector('.cgrid-empty'); if(e) empt[m.ev('TABS[curTab].slug')] = e.textContent; }
  ok('пустой «Суд» называет причину и стадию', /до судебной стадии оно не доходило/.test(empt.sud||''));
  ok('пустой «Залог» называет договор и обеспечение', /Залога по договору/.test(empt.zalog||''));
  ok('пустые «Особые состояния» говорят, что порядок обычный', /Взыскание идёт обычным порядком/.test(empt.sostoyaniya||''));
  ok('ни одно пустое состояние не осталось голым фактом',
     Object.values(empt).every(t => t.trim().length > 60)); }
/* Волна давности (наряд п.7б): давность — универсальный срок, живёт у ЛЮБОГО открытого
   требования с непогашенным кредитом (davnostDeadlines). 397/398/з больше не «без
   сроков» — теперь у него давность есть. Пустая очередь возможна только у ЗАКРЫТОГО
   требования (isClosedReq пропускает его в davnostDeadlines) — фикстура сдвинута на
   206/206/з, где очередь пуста по другой причине (дело закрыто, не «фич нет»). */
{ const m = mk(); m.ev(`openDetail('206/206/з')`);
  let obzorEmpty = '';
  for(let i=0;i<m.ev('TABS.length');i++){ m.ev(`switchTab(${i})`);
    if(m.ev('TABS[curTab].slug') === 'obzor'){
      const e = m.active().querySelector('.cgrid-empty'); obzorEmpty = e ? e.textContent : ''; } }
  ok('пустые сроки отсылают в реестр «Сроки на контроле» (закрытое требование)',
     /Сроки на контроле/.test(obzorEmpty)); }

head('КД-14 · дата снимка денег подписана везде');
/* Отдельной строки-подписи в шапке (.dhead-money / moneyStamp) больше нет — дату снимка
   несёт подсказка суммы требования (ниже) и обе панели денег; дубля быть не должно. */
ok('в шапке нет второй, отдельной подписи снимка',
   D.doc.querySelectorAll('.dhead-money').length === 0);
/* Дата снимка — у КРЕДИТА требования, а не одна на дело: сдвигаем её у первого договора
   многокредитного дела и смотрим, что карточка соседнего требования осталась при своей. */
ok('карточка берёт дату снимка у кредита требования, а не одну на дело', mk().ev(`(() => {
  const p = PROCESSES.find(x=>x.credits.length>1 && new Set(x.requirements.map(r=>r.credit)).size>1);
  LEDGER[p.credits[0].id].asOf = '20.07.2026';
  openDetail(p.requirements[0].id, TAB_BY_SLUG('dolg'));
  const a = document.querySelector('#detailPanels .detail-panel.active').innerHTML;
  openDetail(p.requirements[1].id, TAB_BY_SLUG('dolg'));
  const b = document.querySelector('#detailPanels .detail-panel.active').innerHTML;
  return /снимок модуля кредита на <b>20\\.07\\.2026<\\/b>/.test(a)
      && /снимок модуля кредита на <b>25\\.07\\.2026<\\/b>/.test(b); })()`));
ok('у суммы чипа есть подсказка с датой',
   /Снимок модуля кредита на 25\.07\.2026/.test(D.dhead().querySelector('.rc-sub span').getAttribute('title')||''));
ok('поле «Сумма требования» несёт дату снимка', (() => {
  const m = mk(); m.ev(`openDetail('307/307/з')`); m.ev(`switchTab(${TAB.obzor})`);
  return /снимок на 25\.07\.2026/.test(m.active().innerHTML); })());
ok('таблица долга по-прежнему называет свою дату', (() => {
  const m = mk(); m.ev(`openDetail('307/307/з')`); m.ev(`switchTab(${TAB.dolg})`);
  return /снимок модуля кредита на <b>25\.07\.2026<\/b>/.test(m.active().innerHTML); })());

head('КД-15 · заголовок дела в две строки');
/* Номер дела уехал из строки тождества в крошку (setCrumb) — в шапке остались заёмщик,
   ИНН-ссылка и регион; во второй строке — сумма по делу, группа и куратор. */
ok('строка тождества: заёмщик · ИНН · регион', (() => {
  const t = D.doc.querySelector('.dhead-id').textContent;
  return /Бек Кабель/.test(t) && /ИНН 01912201610212/.test(t) && /Бишкек/.test(t); })());
ok('строка ведения: сумма по делу · группа · куратор', (() => {
  const t = D.doc.querySelector('.dhead-run').textContent;
  return /итого на сумму/.test(t) && /122 300,00/.test(t)
      && /группа /.test(t) && /куратор Тукинова/.test(t); })());
ok('ИНН — ссылка в карточку заёмщика', !!D.doc.querySelector('.dhead-id a'));
ok('сумма по делу считается один раз на кредит (§2.2)',
   D.ev(`claimTotal(PROCESSES.find(p=>p.id==='307').requirements)
       < PROCESSES.find(p=>p.id==='307').requirements.reduce((a,r)=>a+claimOf(r),0)`));

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

/* Числа этого раздела пересчитаны с нуля по затравке ЗС (91 дело · 100 требований), снято
   с живой страницы. Волна ЗС-2 (вывод сроков по журналу: билдер ставит срок там, где его
   база уже в журнале, а закрывающая мера — ещё нет) добавила 36 экземпляров четырёх
   шаблонов — тпл 5 (5 дел K0), 7 (5 дел), 22 (2 дела), 41 (24 дела): `dlAll()` даёт
   112 записей вместо 76, из них горизонт 7 дней пропускает 80 вместо 70 (просроченных
   59 вместо 54, истекает сегодня по-прежнему 1). Прежние 37/50/18 остались от старой
   затравки, 76/70/54 — от затравки ЗС до вывода сроков.
   Наряд МП-11 (ADR-0047): дыра тпл 45 у ИСК-344 (была просрочена — «дыра просрочена…»
   выше) закрылась живой мерой «Проект мирового соглашения» (basedOn на иск, миграция
   SEED дела 344) — минус одна запись очереди, и она же просроченная: 80→79, 59→58.
   Шаг 2 наряда (1-й день просрочки, п. 16.1): длина очереди 79 → 86. Записей столько
   же (112), но у дел K0 открытие сместилось на пять дней НАЗАД (opened = начало
   просрочки, а не пятый день после него), и семь сроков тпл 5, стоявших за горизонтом
   7 дней, вошли в него. Просроченных по-прежнему 58 — сместились только предстоящие. */
head('СК-1/СК-6 · очередь с горизонтом, а не список просроченного');
ok('умолчание — горизонт 7 дней',            S.ev(`dlHorizon`) === '7' && /Горизонт: 7 дней/.test(sFrame()));
/* Шаг 4 наряда (§4.6, `ADR-0067`): 86 → 85. Из словаря оснований ушло «решение об
   ускорении п.20.1», и дело 582, сеявшее ровно его, закрывать стало нечего — оно снято
   вместе со своим сроком тпл 5. Просроченных по-прежнему 58: снятый срок был предстоящим. */
/* §4.8 сверки (`ADR-0077`): 85 → 87 и 58 → 59 просроченных. Затравка получила дело 327 —
   второй полюс развилки п. 16.5 (региональный проект с ожидающим гейтом безакцепта);
   его цепочка «повторная, age 11» несёт два срока, один из которых уже просрочен. */
/* §4.14 сверки: 87 → 91 и 59 → 62 просроченных. Затравка получила два дела нового кода
   K1-ПАУЗА-ПРОГ (328 · 329) — второе основание паузы п. 17, риски срыва программ, оба
   полюса развилки комитета; их цепочки «повторная» несут по два срока. */
/* `ADR-0080`: 91 → 92 и 62 → 63 просроченных. Затравка получила два дела кода
   K3-ЖАЛОБА-ЗАЁМЩИКА (366 · 367); срок даёт только 367 — оно старше (age 190) и его
   цепочка успевает выйти за горизонт, у 366 (age 140) непогашенного срока не остаётся. */
ok('предстоящие сроки показаны, а не только просроченные',
   sRows().length === 92 && sRows().filter(r=>/просрочен/.test(r.textContent)).length === 63);
ok('горизонт «всё» даёт все 112 сроков',     (()=>{ S.ev(`dlSetHorizon('all')`); return sRows().length === 112; })());
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
/* СК-Д2 был про два срока, у которых ХРАНИМОЕ поле leftDays врало о глубине просрочки.
   Хранимых leftDays затравка ЗС не содержит вовсе (проверка строкой выше), поэтому
   правило показывается на живых записях: глубина в очереди целиком производна от даты
   срока и даты отсчёта. Числа сняты со страницы: у дела 304 обе претензии дают −47 и −23,
   у дела 391 — −155 и −131 (прежние 205 · 142 · 206 сроков больше не несут).
   Волна ЗС-2: у 391 появилась ТРЕТЬЯ строка −117 — тпл 41 «Служебная записка в ДПО о
   судебном взыскании», due 31.03.2026, выведенный от истечения срока повторной претензии
   (srcMeasure ПР-391/2); записки в журнале 391 нет, поэтому обязательство осталось в
   очереди. У 304 записка есть — его две строки не изменились. */
ok('глубина просрочки производна, а не взята из хранимого поля (СК-Д2)', () => {
  const of = no => sRows().filter(r=>new RegExp('В-2026-000'+no).test(r.textContent))
                          .map(r=>r.querySelectorAll('td')[1].textContent.trim());
  return of('304').join('|') === '−47 · просрочен|−23 · просрочен'
      && of('391').join('|') === '−155 · просрочен|−131 · просрочен|−117 · просрочен'; });
ok('глубина просрочки честная: дело 391 — −155, а не −1',
   () => /−155 · просрочен/.test(sRows().find(r=>/В-2026-000391/.test(r.textContent)).textContent));

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
  /* Края очереди сняты со страницы: самый глубокий просроченный — −150 (дело 391,
     первичная претензия от 07.02.2026), самый дальний в горизонте 7 дней — +6.
     Волна ЗС-2: длина очереди 70 → 80 (36 выведенных сроков, из них 10 попадают в
     горизонт 7 дней); оба края не сдвинулись — ни один выведенный срок не глубже
     первичной претензии 391 и не дальше +6. Наряд МП-11: 80 → 79 (дыра ИСК-344
     закрылась — см. комментарий у «предстоящие сроки показаны» выше); края те же,
     удалённая запись не была ни самой глубокой, ни самой дальней.
     Шаг 2 наряда (1-й день просрочки): 79 → 86, и сдвинулись ОБА края. Глубокий —
     −155: у дела 391 age поднят 140 → 145, иначе после укорочения цепочки на пять
     дней осталось бы 178 и подавлять 181-й день стало бы нечего. Дальний — +7:
     сроки тпл 5 у дел K0 подтянулись в горизонт вместе с открытием.
     Шаг 4 наряда (§4.6): 86 → 85 вместе с делом 582 (см. комментарий у «предстоящие
     сроки показаны» выше); края не сдвинулись — снятый срок не был ни тем, ни другим.
     §4.8 сверки (`ADR-0077`): 85 → 87 вместе с делом 327; края опять те же — сроки
     свежей повторной претензии не глубже 391 и не дальше +7.
     §4.14 сверки: 87 → 91 вместе с делами 328 · 329; края опять те же по той же причине.
     `ADR-0080`: 91 → 92 вместе с делом 367 (второе новое, 366, своего срока не даёт), и
     ГЛУБОКИЙ край сдвинулся −155 → −160: 367 старше дела 391 на пять дней (age 190
     против 145 у 391 при более короткой цепочке), и его непогашенный срок оказался
     самым просроченным в очереди. Дальний край прежний +7. */
  return a.length === 92 && a.every((v,i) => i === 0 || a[i-1] <= v) && a[0] === -160 && a[a.length-1] === 7; })());
ok('клик по колонке меняет ключ и направление', (()=>{
  S.ev(`dlSortBy('due')`); const up = S.ev(`dlSort.k==='due' && dlSort.dir===1`);
  S.ev(`dlSortBy('due')`); const down = S.ev(`dlSort.dir===-1`);
  S.ev(`dlSort={k:'left',dir:1}; dlRefresh()`); return up && down; })());

head('СК-7/СК-12 · рамка со счётчиками, пустое состояние с причиной');
ok('плиток на экране сроков нет',            S.$('#view-deadlines .tile') === null);
ok('рамка считает очередь и называет дату отсчёта',   // счётчики сняты с #dlFrame живой страницы
   // Волна ЗС-2: «показано 70 из 76 · просрочено 54» → «показано 80 из 112 · просрочено 59».
   /показано 80 из 112 · просрочено 59 · истекает сегодня 1 · отсчёт от 21\.07\.2026/.test(sFrame()));
ok('пустое состояние называет условия и даёт их снять', (()=>{
  S.doc.getElementById('dlQ').value = 'такого-заёмщика-нет'; S.ev(`dlRefresh()`);
  const e = S.$('#deadlinesBody .list-empty');
  const good = e && /Условия отбора/.test(e.textContent) && !!e.querySelector('button');
  S.ev(`dlResetAll(); dlSetHorizon('7')`); return good; })());

head('СК-8 · ответственный выведен: куратор дела × подразделение шаблона');
ok('у каждого срока есть выведенный ответственный',
   S.ev(`dlAll().every(x=>['subdiv','external','system','none'].includes(x.resp.kind))`));
/* Синтетическая половина правила — ФОРМА: разводим шаблон и требование в отдельном DOM,
   требованию дела 336 ставим ДАК, шаблон №27 остаётся за ОПК — ответственный обязан
   остаться ОПК. Прежняя редакция этого комментария оправдывала синтетику тем, что «ни у
   одного живого срока затравки ЗС подразделение шаблона и подразделение требования не
   расходятся (все шесть выведенных — ОПК)»; после волны ЗС-2 (вывод сроков по журналу)
   это неверно — расхождения появились на настоящих данных, и живую половину проверяет
   ассерт ниже. Синтетика остаётся: она держит форму правила независимо от того, какие
   дела лежат в затравке завтра. */
ok('подразделение берётся из шаблона, а не из дела', mk().ev(`(() => {
  const p = PROCESSES.find(x=>x.id==='336'), d = p.deadlines[0];
  const before = dlResponsible(p,d).subdiv;
  REQ_INDEX['336/336/з'].subdivision = 'ДАК';
  const after = dlResponsible(p,d).subdiv;
  return d.tpl === 27 && TPL_BY_N[27].resp === 'ОПК' && before === 'ОПК' && after === 'ОПК';
})()`));
/* Живая половина того же правила — ДАННЫЕ. Числа сняты со страницы после волны ЗС-2:
   `dlAll()` даёт 112 записей, ответственный выведен ПОДРАЗДЕЛЕНИЕМ у 42 из них
   (ДАК 10 · ОД 24 · ДПО 2 · ОПК 6; ещё 69 — «на заёмщике», 1 — «не выведено»), и на 22
   записях подразделение, названное ШАБЛОНОМ, не совпадает с ведущим подразделением
   требования: тпл 5 ×5, тпл 7 ×2, тпл 22 ×2, тпл 41 ×13. Самый частый случай —
   «Служебная записка в ДПО о судебном взыскании» (тпл 41, шаблон называет ОД) на
   требовании ДАК: записку по чужому договору готовит куратор ОД, а ведёт требование
   ДАК. До ЗС-2 таких строк было ноль — все шесть выведенных сроков были ОПК-шными,
   и на живых данных «из шаблона» действительно было неотличимо от «из требования».
   Второй конъюнкт и есть правило: на КАЖДОЙ такой строке dlResponsible обязан вернуть
   подразделение шаблона, а не требования. */
ok('на живых данных подразделение шаблона побеждает подразделение требования', S.ev(`(() => {
  const rows = dlAll().filter(x => { const t = subdivInText((dlTpl(x.d)||{}).resp);
    return t && x.reqs[0] && t !== x.reqs[0].subdivision; });
  return rows.length === 22
      && rows.every(x => x.resp.kind === 'subdiv' && x.resp.subdiv === subdivInText(dlTpl(x.d).resp));
})()`));
/* В затравке ЗС «не выведено» остался ровно один срок — решение по конфликту интересов
   (дело 395): шаблон называет исполнителя ролью «Правление», требования у срока нет. */
ok('«не выведено» ровно у одного дело-уровневого срока',
   S.ev(`dlAll().filter(x=>x.resp.kind==='none').length === 1`)
   && S.ev(`dlAll().filter(x=>x.resp.kind==='none').every(x=>!x.reqs.length)`));
/* Шаблоны 6 и 8 — сроки исполнения первичной и повторной претензии; иных сроков «на
   заёмщике» в затравке нет, поэтому множество внешних шаблонов фиксируется целиком. */
ok('срок исполнения претензии числится за заёмщиком, а не за сотрудником',
   S.ev(`[...new Set(dlAll().filter(x=>x.resp.kind==='external').map(x=>x.d.tpl))].sort().join(',') === '6,8'`)
   && S.ev(`[6,8].every(n=>TPL_BY_N[n].resp === 'заёмщик')`));
/* Проверяем ВСЕ строки, а не первую: подсказка обязана называть правило вывода у каждого
   ответственного — куратор × шаблон, обязательство заёмщика либо «выводить не из чего». */
ok('у ответственного есть подсказка с правилом вывода',
   sRows().every(r => /куратор дела .+ × подразделение шаблона|подразделение выводить не из чего|обязательство исполняет заёмщик \(шаблон Порядка\)/
     .test(r.querySelectorAll('td')[5].getAttribute('title') || '')));

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
     /* Дело 391 (ОсОО «Ат-Башы Мал») — с ним в очереди две претензионные записи;
        прежнее дело 206 в затравке ЗС ретро-закрыто и сроков не несёт вовсе. */
     return hit('Ат-Башы')>0 && hit('В-2026-000391')>0 && hit(PROCESSES.find(p=>p.id==='391').inn)>0; })()`));
ok('активные условия видны чипами', (()=>{
  S.doc.getElementById('dlQ').value = 'Темир'; S.ev(`dlRefresh()`);
  const c = S.$$('#dlChips .fchip').map(x=>x.textContent).join('|');
  S.ev(`dlClear('q')`); return /Поиск: Темир/.test(c) && /Горизонт: 7 дней/.test(c); })());

head('СК-10 · клик ведёт туда, где срок живёт');
ok('срок требования открывает требование на «Обзоре»',
   () => /openDetail\('391\/391\/з', TAB_BY_SLUG\('obzor'\)\)/.test(
     sRows().find(r=>/В-2026-000391/.test(r.textContent)).getAttribute('onclick')));
/* Вкладки «Процедура» больше нет (ADR-0023 — процедуры дела нет как сущности), журнал
   передачи и подтверждение статуса живут на вкладке дела «Общее» — туда срок и ведёт. */
ok('срок подтверждения статуса процедуры ведёт на вкладку дела',
   S.ev(`dlTarget({p:{id:'210'}, reqs:[], act:'Подтверждение или отклонение статуса процедуры'}).join('/')`) === '210/obschee'
   && S.ev(`TABS.every(t=>t.slug !== 'procedura')`));
ok('срок по конфликту интересов ведёт в «Особые состояния»',
   S.ev(`dlTarget({p:{id:'205'}, reqs:[], act:'Уведомление о конфликте интересов'}).join('/')`) === '205/sostoyaniya');
ok('строка открывается и с клавиатуры',      sRows().every(r => r.getAttribute('tabindex') === '0' && /Enter/.test(r.getAttribute('onkeydown'))));

head('СК-11 · срок ссылается на шаблон номером');
ok('у каждого срока либо шаблон, либо метка «вне Порядка»',
   S.ev(`PROCESSES.flatMap(p=>p.deadlines).every(d=>d.tpl ? !!TPL_BY_N[d.tpl] : !!d.action)`));
ok('пять недостающих шаблонов добавлены (40–44)',
   S.ev(`[40,41,42,43,44].every(n=>!!TPL_BY_N[n])`)
   && S.ev(`[40,41,42,43,44].map(n=>TPL_BY_N[n].point).join('/')`) === 'Р-8/19.2/44/38/Р-12');
ok('строковой связи со справочником больше нет', !/templTerm/.test(HTML.replace(/templTerm искала[\s\S]*?dlPoint\./,'')));
ok('шаблон находится у всех сроков Порядка (было «—» у 15 из 45)',
   S.ev(`PROCESSES.flatMap(p=>p.deadlines).filter(d=>d.tpl).every(d=>!!dlTerm(d) && !!dlPoint(d))`));
/* КР-15: два хранимых срока «вне Порядка» были ручными копиями даты заседания —
   их вывели из самого заседания, поэтому у хранимых сроков шаблон теперь есть у всех. */
/* В затравке ЗС вне Порядка остался ровно один производный срок — «Следующее судебное
   заседание» дела 333; он наступает позже семидневного горизонта, поэтому в очередь
   попадает только на горизонте «всё» (там его и смотрим, горизонт затем возвращается). */
ok('«вне Порядка» помечено, а не выброшено',
   S.ev(`PROCESSES.flatMap(p=>p.deadlines).filter(d=>!d.tpl).length === 0`)
   && S.ev(`PROCESSES.flatMap(p=>dlOf(p)).filter(d=>!d.tpl).length === 1`)
   && (()=>{ S.ev(`dlSetHorizon('all')`); const has = sRows().some(r=>/вне Порядка/.test(r.textContent));
             S.ev(`dlSetHorizon('7')`); return has; })());
ok('«п. —» больше не рисуется (СК-Д13)',     !sRows().some(r=>/п\. —/.test(r.textContent)));
ok('Р-8 подписан без «п.» — это решение проекта, не пункт Порядка',
   S.ev(`dlPointLabel({tpl:40}) === 'Р-8' && dlPointLabel({tpl:5}) === 'п. 16.2'`));

head('СК-13 · срок снимается фактом, а не отметкой');
ok('кнопки «выполнено» у срока нет',         !/выполнено/i.test(S.$('#view-deadlines').innerHTML));
ok('карта закрытия ссылается на существующие виды мер',
   S.ev(`Object.values(DEADLINE_CLOSERS).flat().every(k=>MEASURE_KIND_NAMES.includes(k))`)
   && S.ev(`Object.keys(DEADLINE_CLOSERS).every(n=>!!TPL_BY_N[n])`));
/* Единственный хранимый срок затравки ЗС, у которого есть закрыватель в DEADLINE_CLOSERS, —
   апелляционный (шаблон №27 → «Апелляционная жалоба») у дел 336 и 337 K3-РЕШЕНИЕ;
   у прежнего 202 (K0-ОКНО) хранимых сроков не осталось вовсе. */
ok('регистрация меры снимает срок с контроля', (()=>{
  const m = mk();
  const before = m.ev(`PROCESSES.find(p=>p.id==='336').deadlines.length`);
  const closed = m.ev(`closeDeadlinesBy(PROCESSES.find(p=>p.id==='336'),'Апелляционная жалоба',
                       PROCESSES.find(p=>p.id==='336').requirements.map(r=>r.id)).length`);
  const after = m.ev(`PROCESSES.find(p=>p.id==='336').deadlines.length`);
  return before === 1 && closed === 1 && after === 0; })());
ok('чужая мера чужой срок не трогает',
   S.ev(`closeDeadlinesBy({deadlines:[{tpl:5,targets:['x']}]}, 'Акт сверки', ['x']).length === 0`));
ok('saveMeasure зовёт снятие срока и пишет это в историю',
   /closeDeadlinesBy\(p, kind, targets\.map/.test(HTML) && /снят с контроля/.test(HTML));

/* Шаг 4 наряда сверки №41, §4.5 (`ADR-0066`) — маршрут после возврата ИЛ. Норма (п. 36)
   называет два выхода, которых в справочнике не было вовсе; МП5-14 объявил три других,
   ни один из которых нормой не назван. Проверяется состав выходов и то, что оба
   нормативных вида действительно заведены и рождаются постановлением о возврате. */
head('§4.5 · выходы после возврата ИЛ — норма п. 36 (шаг 4 наряда)');
ok('оба выхода п. 36 заведены видами мер',
   S.ev(`MEASURE_KIND_NAMES.includes('Жалоба на акты судебного исполнителя')
      && MEASURE_KIND_NAMES.includes('Направление материалов в САК на банкротство')`));
ok('оба рождаются постановлением о возврате ИЛ (basisKinds), а не открываются на пустом месте',
   S.ev(`['Жалоба на акты судебного исполнителя','Направление материалов в САК на банкротство']
          .every(k => (kindOf(k).basisKinds||[]).includes('Постановление о возврате ИЛ'))`));
/* Жалоба — resultIsDocument той же природы, что «Частная жалоба»: фазу двигает акт ПО
   жалобе, а не сама жалоба (ADR-0031 п.3). Направление материалов фазу не двигает тоже:
   контур К6 открывает «Инициирование банкротства», ему направление лишь предшествует. */
ok('ни один из двух выходов фазу не двигает',
   S.ev(`!isMilestone('Жалоба на акты судебного исполнителя')
      && !isMilestone('Направление материалов в САК на банкротство')`));
ok('срок 47 закрывают пять выходов — два по норме п. 36, один по закону об ИП, два под оговоркой «в том числе»',
   S.ev(`DEADLINE_CLOSERS[47].length === 5
      && ['Жалоба на акты судебного исполнителя','Направление материалов в САК на банкротство',
          'Повторное предъявление ИЛ','Извещение об обращении на залог','Заключение комиссии о безнадёжности']
         .every(k => DEADLINE_CLOSERS[47].includes(k))`));
/* Признание безнадёжной держит срок не только «в том числе»-оговоркой, но и технически:
   без него у безнадёжного требования снять срок 47 стало бы нечем. */
ok('признание безнадёжной осталось закрывателем — иначе срок 47 у безнадёжного требования не снять ничем',
   S.ev(`DEADLINE_CLOSERS[47].includes('Заключение комиссии о безнадёжности')`));

/* Шаг 4 наряда, §4.11 (`ADR-0068`) — общего рукопожатия п. 98 в редакции №41 нет. check_points:ignore
   Подтверждения точечные, срок норма даёт ровно одному переходу (п. 37, 3 р.д.);
   рукопожатие модели остаётся ПРОЕКТНЫМ и подписано `ADR-0023`, а не пунктом Порядка. */
head('§4.11 · подтверждение передачи — точечное по норме, общее по проекту (шаг 4 наряда)');
ok('срок п. 37 заведён: 3 р.д., ответственный — отраслевой департамент',
   S.ev(`TPL_BY_N[49] && TPL_BY_N[49].term === '3 р.д.' && TPL_BY_N[49].point === '37'
      && /отраслевой департамент/.test(TPL_BY_N[49].resp)`));
ok('проектное рукопожатие (тпл 34) подписано ADR-0023, а не пунктом Порядка',
   S.ev(`TPL_BY_N[34].point === 'ADR-0023' && dlPointLabel({tpl:34}) === 'ADR-0023'`));
ok('срок п. 37 подписан пунктом — это норма, а не решение проекта',
   S.ev(`dlPointLabel({tpl:49}) === 'п. 37'`));
ok('мёртвого п. 98 в макете не осталось ни в одном шаблоне срока',   // check_points:ignore
   S.ev(`DEADLINE_TEMPLATES.every(t => t.point !== '98')`));

/* Шаг 5 наряда, §4.12 (`ADR-0069`) — глава 10 (пп. 50–54): не одно заявление, а цепочка.
   Два входящих документа, предложение родственникам и — только при отказе — два запроса. */
head('§4.12 · смерть заёмщика — цепочка главы 10 (шаг 5 наряда)');
ok('пять видов главы 10 заведены и лежат в разделе «Правопреемство»',
   S.ev(`['Свидетельство о смерти','Справка о составе семьи','Предложение родственникам о добровольном принятии задолженности',
          'Запрос в нотариальные органы','Запрос в государственную регистрационную службу']
         .every(k => MEASURE_KIND_NAMES.includes(k) && sectionOf(k) === 'Правопреемство')`));
ok('свидетельство и справка — входящие документы: их получают, предусловия к ним не применяются (§3.4)',
   S.ev(`['Свидетельство о смерти','Справка о составе семьи'].every(k => kindOf(k).source === 'внешний акт')`));
ok('предложение родственникам требует справки о составе семьи (п. 51.3 «после получения справки»)',
   S.ev(`(kindOf('Предложение родственникам о добровольном принятии задолженности').basisKinds||[])
          .includes('Справка о составе семьи')
      && RULES.preconditions['Предложение родственникам о добровольном принятии задолженности'].basis === true`));
/* П. 52 разрешает запросы «в случае ОТКАЗА близких родственников» — предусловие читает
   пару вид×исход, а не сам факт предложения: принятое предложение запросов не открывает. */
ok('запросы нотариусу и в ГРС требуют именно исхода «отказ», а не самого предложения',
   S.ev(`['Запрос в нотариальные органы','Запрос в государственную регистрационную службу'].every(k => {
     const f = RULES.preconditions[k].facts;
     return f.length === 1 && f[0].outcome === 'отказ' && f[0].point === '52'
         && f[0].kinds.includes('Предложение родственникам о добровольном принятии задолженности'); })`));
/* П. 53 «после сбора всех необходимых документов» — но только в ветви смерти: правопреемство
   бывает и при реорганизации, и требовать там нотариуса значило бы запретить законный переход. */
ok('заявление о правопреемнике требует обоих запросов только при живом свидетельстве о смерти', S.ev(`(() => {
  const f = RULES.preconditions['Заявление об установлении правопреемника'].facts;
  return f.length === 2 && f.every(x => (x.onlyIfKinds||[]).includes('Свидетельство о смерти') && x.point === '53');
})()`));
ok('на живом требовании: без свидетельства заявление не держится главой 10, со свидетельством — держится', mk().ev(`(() => {
  const r = REQ_INDEX['361/361/з'], p = r._proc;         // K6-ИНИЦ: исполнительное производство пройдено, порог 1 взят
  const base = preconditionReason(r, 'Заявление об установлении правопреемника');
  const fake = {sec:'Правопреемство', kind:'Свидетельство о смерти', dates:D(TODAY,TODAY),
                num:'ТЕСТ-СС', outcome:'получено', targets:[r.id]};
  p.measures.push(fake);
  const after = preconditionReason(r, 'Заявление об установлении правопреемника');
  p.measures.pop();
  return base === null && /п\\. 53/.test(after||'') && /Запрос в нотариальные органы/.test(after||'');
})()`));

/* Шаг 5 наряда, §4.13 (`ADR-0070`) — банкротство получило жёсткие предусловия: три факта
   (пп. 55, 56, 57) плюс порог долга ст. 9-1 Закона о банкротстве. */
head('§4.13 · предусловия банкротства — пп. 55–57 и порог ст. 9-1 (шаг 5 наряда)');
ok('оба входа банкротной ветви заведены видами: уведомление п. 55 и признание долга п. 56',
   S.ev(`['Уведомление о намерении инициировать банкротство','Признание долга должником в судебном заседании']
          .every(k => MEASURE_KIND_NAMES.includes(k) && sectionOf(k) === 'Банкротство')`));
ok('у заявления на банкротство три требуемых факта, и каждый подписан своим пунктом',
   S.ev(`(() => { const f = RULES.preconditions['Заявление на банкротство'].facts;
     return f.length === 3 && f.map(x=>x.point).join(',') === '56,57,55'; })()`));
ok('ИЛИ-ветвь п. 56 внутри одной группы: судебный акт ЛИБО письменное признание должника',
   S.ev(`(() => { const g = RULES.preconditions['Заявление на банкротство'].facts[0];
     return g.kinds.includes('Решение суда') && g.kinds.includes('Признание долга должником в судебном заседании'); })()`));
ok('п. 57 требует постановления о возврате ИЛ — «Постановление на исполнении» его не заменяет',
   S.ev(`(() => { const g = RULES.preconditions['Заявление на банкротство'].facts[1];
     return g.kinds.length === 1 && g.kinds[0] === 'Постановление о возврате ИЛ'; })()`));
/* ПЕРЕВЁРНУТО ШАГОМ 6. До пересева дело 361 (K6-ИНИЦ) стояло на «Постановлении на
   исполнении», постановления о ВОЗВРАТЕ ИЛ и уведомления п. 55 в цепочке не было, и
   проверка утверждала обратное — что гейт НЕ молчит. Для той затравки это было верно.
   Пересев (ilReturned:true + направление материалов в САК + уведомление п. 55) закрыл
   долг шага 5: затравка теперь показывает норму, а не противоречит ей. */
ok('затравка банкротной ветви удовлетворяет предусловиям пп. 55–57 — на живом требовании гейт молчит',
   S.ev(`preconditionReason(${R('361/361/з')}, 'Заявление на банкротство') === null`));
ok('и молчит не потому, что гейт слеп: снятие любого из трёх фактов возвращает его пункт', mk().ev(`(() => {
  const r = REQ_INDEX['361/361/з'], p = r._proc;
  const probes = [['Постановление о возврате ИЛ','57'],
                  ['Уведомление о намерении инициировать банкротство','55'],
                  ['Решение суда','56']];
  return probes.every(([kind, point]) => {
    const hidden = p.measures.filter(m => m.kind === kind);
    const kept = p.measures.slice();
    p.measures = p.measures.filter(m => m.kind !== kind);
    const why = preconditionReason(r, 'Заявление на банкротство');
    p.measures = kept;
    return hidden.length > 0 && new RegExp('п\\\\. ' + point).test(why || '');
  });
})()`));
ok('направление материалов в САК требует живого постановления о возврате ИЛ (п. 36/57)',
   S.ev(`RULES.preconditions['Направление материалов в САК на банкротство'].basis === true`));
/* Порог — величина ЗАКОНА, не Порядка: пока не задан, предусловие молчит. Выдуманное
   число заблокировало бы работу и выглядело бы нормой (`ADR-0070`). */
ok('порог ст. 9-1 в записи есть, но не задан — и потому не блокирует',
   S.ev(`'minDebt' in RULES_DEFAULTS.preconditions['Заявление на банкротство']
      && RULES_DEFAULTS.preconditions['Заявление на банкротство'].minDebt === null`));
ok('заданный порог начинает держать требование и называет обе суммы', mk().ev(`(() => {
  const r = REQ_INDEX['361/361/з'];
  RULES.preconditions['Заявление на банкротство'] = { ...RULES.preconditions['Заявление на банкротство'], facts: [], minDebt: 1 };
  const low = preconditionReason(r, 'Заявление на банкротство');
  RULES.preconditions['Заявление на банкротство'] = { ...RULES.preconditions['Заявление на банкротство'], minDebt: claimOf(r) + 1000 };
  const high = preconditionReason(r, 'Заявление на банкротство');
  return low === null && /ст\\. 9-1/.test(high||'') && /п\\. 56/.test(high||'');
})()`));
/* Состав фактов и окно ожидания приходят из справочника, а не из localStorage: слияние
   правил раньше знало только четыре поля и роняло `windowTpl` при первой перезагрузке. */
ok('перезагрузка правил не теряет требуемые факты и окно ожидания', mk().ev(`(() => {
  persistRules();
  const saved = JSON.parse(localStorage.getItem(RULES_KEY));
  delete saved.rules.preconditions['Заявление на банкротство'].facts;   // как если бы правила сохранила прежняя версия
  delete saved.rules.preconditions['Повторное предъявление ИЛ'].windowTpl;
  mergeRules(saved.rules);
  return RULES.preconditions['Заявление на банкротство'].facts.length === 3
      && RULES.preconditions['Повторное предъявление ИЛ'].windowTpl === 46;
})()`));
/* Проверки складываются, а не выбирают одну: до шага 5 совпавшая requiredPhase/minLevel
   возвращала null сразу, и всё, что ниже в записи, до проверки не доходило. */
ok('порог и факты проверяются вместе — ранний выход по достигнутому порогу снят',
   !/if\(cur === pc\.requiredPhase\) return null;/.test(HTML)
   && /pc\.requiredPhase && cur !== pc\.requiredPhase/.test(HTML));

/* Шаг 6 наряда, §4.15 (`ADR-0071`) — три оставшиеся строки таблицы «видов, которых нет в
   справочнике». Две из трёх оказались не дырой в возражении, а дырой в ЖАЛОБЕ: возражения
   были, но ссылались основанием на НАШУ жалобу того же названия. */
head('§4.15 · жалоба заёмщика и имя п. 30.6 (шаг 6 наряда)');
ok('обе жалобы заёмщика заведены входящими видами судебного раздела',
   S.ev(`['Апелляционная жалоба заёмщика','Кассационная жалоба заёмщика'].every(k =>
     MEASURE_KIND_NAMES.includes(k) && kindOf(k).source === 'внешний акт' && sectionOf(k) === 'Судебный')`));
/* Кассационную заёмщик подаёт на акт АПЕЛЛЯЦИОННОЙ инстанции (п. 30.5), а не на решение
   первой — разные основания у пары, а не копия одного. */
ok('основания пары разведены: апелляционная — от решения суда, кассационная — от акта апелляции',
   S.ev(`kindOf('Апелляционная жалоба заёмщика').basisKinds.join(',') === 'Решение суда'
      && kindOf('Кассационная жалоба заёмщика').basisKinds.join(',') === 'Постановление апелляционной инстанции'`));
ok('оба возражения (пп. 30.4/30.5) основаны теперь на жалобе ЗАЁМЩИКА, а не на нашей',
   S.ev(`kindOf('Возражение на апелляционную жалобу').basisKinds.join(',') === 'Апелляционная жалоба заёмщика'
      && kindOf('Возражение на кассационную жалобу').basisKinds.join(',') === 'Кассационная жалоба заёмщика'`));
/* Акт апелляционной инстанции выносится по жалобе ЛЮБОЙ стороны — иначе обжалование
   заёмщиком заканчивалось бы актом без законного основания в журнале. */
ok('акт апелляционной инстанции принимает обе жалобы — нашу и заёмщика',
   S.ev(`kindOf('Постановление апелляционной инстанции').basisKinds.join(',')
      === 'Апелляционная жалоба,Апелляционная жалоба заёмщика'`));
/* Наши жалобы остаются НАШИМИ документами со своими сроками подачи (тпл 27, 28) —
   расщепление по подателю ничего у них не отняло. */
ok('наши жалоба и сроки не тронуты: тпл 27/28 по-прежнему закрываются нашими жалобами',
   S.ev(`kindOf('Апелляционная жалоба').source === 'наш документ'
      && DEADLINE_CLOSERS[27].join(',') === 'Апелляционная жалоба'
      && DEADLINE_CLOSERS[28].join(',') === 'Кассационная жалоба'`));
/* Срока для возражения норма не даёт («в соответствии с процессуальным законодательством») —
   пустая строка шаблона была бы мнимым обязательством (`ADR-0068`). */
ok('шаблона срока под возражение нет — норма его не называет',
   S.ev(`DEADLINE_TEMPLATES.every(t => !/^Возражение/.test(t.action))`));
ok('имя п. 30.6 приведено к норме, старого в справочнике не осталось',
   S.ev(`MEASURE_KIND_NAMES.includes('Заявление о восстановлении пропущенного процессуального срока')
      && !MEASURE_KIND_NAMES.includes('Заявление о восстановлении пропущенных сроков')`));
ok('заявление п. 30.6 и парный акт МП-3 сошлись в названии предмета',
   S.ev(`kindOf('Определение о восстановлении процессуального срока').basisKinds.join(',')
      === 'Заявление о восстановлении пропущенного процессуального срока'`));

/* Шаг 6 наряда, МП-3 (`ADR-0072`) — долг модели, объявленный разбором 02.08.2026 и не
   реализованный ни одной последующей волной: восемь видов с `resultIsDocument:true`, ни
   один из которых не назван ничьим основанием, — срок по ним не закрыть никогда. */
head('МП-3 · восемь видов без ответа закрыты (шаг 6 наряда)');
ok('четыре акта-ответа заведены видами судебного раздела',
   S.ev(`['Определение об отмене решения по вновь открывшимся обстоятельствам',
          'Определение об отмене решения по новым обстоятельствам',
          'Определение об изменении способа и порядка исполнения',
          'Определение о восстановлении процессуального срока'].every(k =>
     MEASURE_KIND_NAMES.includes(k) && kindOf(k).source === 'внешний акт' && sectionOf(k) === 'Судебный')`));
ok('каждый отвечает своему обращению, а не catch-all «Определению суда (прочее)»',
   S.ev(`[['Определение об отмене решения по вновь открывшимся обстоятельствам','Заявление по вновь открывшимся обстоятельствам'],
          ['Определение об отмене решения по новым обстоятельствам','Заявление по новым обстоятельствам'],
          ['Определение об изменении способа и порядка исполнения','Заявление об изменении способа и порядка исполнения'],
          ['Определение о восстановлении процессуального срока','Заявление о восстановлении пропущенного процессуального срока']]
     .every(([act, req]) => kindOf(act).basisKinds.join(',') === req)`));
/* Системное следствие двух отмен — денежное: слой гаснет (`ADR-0043`/`ADR-0049`). Свёртка
   layerOf кинд-уровневая, поэтому у обоих единственный исход — вид с двумя гасил бы слой
   и отрицательным тоже. */
ok('две отмены гасят слой и несут ровно один исход',
   S.ev(`['Определение об отмене решения по вновь открывшимся обстоятельствам',
          'Определение об отмене решения по новым обстоятельствам'].every(k =>
     AWARD_DEATH_KINDS.has(k) && kindOf(k).outcomes.length === 1)`));
ok('три уточнения иска потеряли resultIsDocument и получили свой исход',
   S.ev(`['Уточнение исковых требований','Увеличение исковых требований','Уменьшение исковых требований']
     .every(k => kindOf(k).resultIsDocument === false
              && kindOf(k).outcomes.map(o=>o.value).join(',') === 'принято судом,отклонено'
              && kindOf(k).outcomes.every(o => !o.setsPhase))`));
/* ГЛАВНЫЙ инвариант МП-3, а не перечисление: НИ ОДИН вид с resultIsDocument:true не остался
   без вида, называющего его своим основанием. Именно это и есть определение задачи. */
ok('ни один вид с resultIsDocument не остался без отвечающего акта', S.ev(`(() => {
  const named = new Set(MEASURE_KINDS.flatMap(k => k.basisKinds || []));
  const orphans = MEASURE_KINDS.filter(k => k.resultIsDocument && !named.has(k.name)).map(k => k.name);
  return orphans.length === 0;
})()`));

/* Шаг 6 наряда — пересев затравки: долг, оставленный шагом 5. Правило действует вперёд и
   прошлого не отменяет, но затравка обязана показывать норму, а не противоречить ей. */
head('пересев · глава 10 и предусловия банкротства в затравке (шаг 6 наряда)');
ok('дело 356 несёт цепочку главы 10 целиком и в порядке нормы', S.ev(`(() => {
  const p = PROCESSES.find(x => x.id === '356');
  const chain = ['Свидетельство о смерти','Справка о составе семьи',
                 'Предложение родственникам о добровольном принятии задолженности',
                 'Запрос в нотариальные органы','Запрос в государственную регистрационную службу',
                 'Заявление об установлении правопреемника'];
  const got = p.measures.filter(m => chain.includes(m.kind)).map(m => m.kind);
  return got.join('|') === chain.join('|');
})()`));
/* Исход предложения — «отказ»: только он открывает запросы п. 52 у гейта, и только отказ
   ведёт дело дальше в суд за правопреемником. */
ok('предложение родственникам в затравке отказано — иначе запросы п. 52 гейт бы не пустил',
   S.ev(`PROCESSES.find(x=>x.id==='356').measures
     .find(m => m.kind === 'Предложение родственникам о добровольном принятии задолженности').outcome === 'отказ'`));
/* Гейт проверяется на 356 БЕЗ уже зарегистрированного заявления: с ним требование стоит на
   фазе «Заявление об установлении правопреемника», и первым отвечает blockIfPhaseIn
   («повторная регистрация не предусмотрена») — фактов главы 10 он тогда просто не смотрит.
   Снимаем заявление, спрашиваем гейт, возвращаем. */
ok('на живом требовании 356 цепочка главы 10 открывает заявление о правопреемнике', mk().ev(`(() => {
  const r = REQ_INDEX['356/356/з'], p = r._proc;
  const kept = p.measures.slice();
  p.measures = p.measures.filter(m => m.kind !== 'Заявление об установлении правопреемника');
  const openWhy = preconditionReason(r, 'Заявление об установлении правопреемника');
  p.measures = p.measures.filter(m => m.kind !== 'Запрос в нотариальные органы');
  const cutWhy = preconditionReason(r, 'Заявление об установлении правопреемника');
  p.measures = kept;
  return openWhy === null && /п\\. 53/.test(cutWhy||'') && /Запрос в нотариальные органы/.test(cutWhy||'');
})()`));
/* Цепочка строится только в ветви СМЕРТИ: правопреемство бывает и при реорганизации, и
   требование п. 53 у гейта условно ровно поэтому (`ADR-0069`). */
ok('цепочка привязана к смерти, а не к правопреемству вообще', S.ev(`(() => {
  const withDeath = PROCESSES.filter(p => (p.measures||[]).some(m => m.kind === 'Свидетельство о смерти')).map(p=>p.id).sort();
  return withDeath.join(',') === '356,357,358,359';
})()`));
ok('банкротные дела стоят на возврате ИЛ, направлении в САК и уведомлении п. 55', S.ev(`(() => {
  const need = ['Постановление о возврате ИЛ','Направление материалов в САК на банкротство',
                'Уведомление о намерении инициировать банкротство','Заявление на банкротство'];
  return ['360','361','362','363','364','365'].every(id => {
    const ms = (PROCESSES.find(x=>x.id===id).measures||[]).map(m=>m.kind);
    return need.every(k => ms.includes(k));
  });
})()`));
/* Срок 47 («Предельный срок повторного предъявления ИЛ») отсчитывается от постановления о
   возврате — без направления материалов в САК шесть банкротных дел висели бы с открытым
   обязательством, которого они никогда не исполнят. */
ok('направление материалов в САК снимает срок 47 у банкротных дел',
   S.ev(`DEADLINE_CLOSERS[47].includes('Направление материалов в САК на банкротство')`));

head('СК-14 · блок сроков в карточке — та же арифметика');
/* Дело 304 (K1-ПРЕТ2) — требование со сроками в карточке: обе претензии просрочены,
   первая на −47 (шаблон №6, п. 16.2). Прежнее 142 в затравке ЗС сроков не несёт вовсе. */
{ const m = mk(); m.ev(`openDetail('304/304/з', TAB_BY_SLUG('obzor'))`);
  const th = [...m.$('.dl-grid').querySelectorAll('th')].map(t=>t.textContent.trim());
  const tr = m.$('.dl-grid tbody tr');
  ok('колонки карточки: обязательство · срок · остаток · база · пункт',
     () => th.join('|') === 'Обязательство|Срок|Осталось, к.д.|База отсчёта|Пункт');
  ok('в карточке дата срока, а не длительность', () => /^\d{2}\.\d{2}\.\d{4}$/.test(tr.querySelectorAll('td')[1].textContent.trim()));
  ok('в карточке тот же производный остаток',    () => /−47 · просрочен/.test(tr.textContent)
     && tr.querySelectorAll('td')[2].textContent.trim()
        === '−' + Math.abs(m.ev(`daysLeft(PROCESSES.find(p=>p.id==='304').deadlines[0])`)) + ' · просрочен');
  ok('подсказка карточки называет шаблон номером', () => /шаблон №6 \(п\. 16\.2\)/.test(tr.getAttribute('title')));
  ok('горизонта и фильтров в карточке нет',      () => !m.$('.dl-grid').closest('.panel-wrap').querySelector('#dlSeg')); }

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
/* Заседаний в затравке ЗС восемь (по четыре пары «извещение + судебный процесс» на делах
   330…334), из них не наступившее и дающее срок — одно: производный срок ровно один. */
ok('срок выводится из заседания и держит ссылку на него',
   H.ev(`PROCESSES.flatMap(p=>hearingDeadlines(p)).length === 1`)
   && H.ev(`PROCESSES.flatMap(p=>hearingDeadlines(p)).every(d=>!!d._hearing)`));
ok('в очередь выводится только не наступившее заседание',
   H.ev(`PROCESSES.flatMap(p=>hearingDeadlines(p)).every(d=>daysLeft(d) >= 0)`)
   && H.ev(`PROCESSES.flatMap(p=>p.hearings||[]).length === 8`)
   && H.ev(`PROCESSES.flatMap(p=>p.hearings||[]).filter(h=>(hLeft(h) ?? -1) < 0).length > 0`));  // наступившие есть, и в очередь они не попали
ok('очередь сроков видит заседание строкой',
   H.ev(`dlAll().filter(x=>x.d._hearing).length === 1`));
ok('снимок состояния производный срок не хранит',
   H.ev(`(()=>{ persistState(); return !/Следующее судебное заседание/.test(localStorage.getItem(STORE_KEY)||''); })()`));

head('КР-3/КР-4 · заседания: исход вместо статуса, сегменты');
ok('восемь колонок в заданном порядке',
   rCols(H,'hearings').join('|') === 'Дата и время|Осталось, к.д.|Вид|Заёмщик|Требование|Место|Представитель ФКФ|Исход');
ok('колонки «Статус» с планированием больше нет', !rCols(H,'hearings').includes('Статус'));
/* НАХОДКА ВОЛНЫ ЗС (отчёт Task 11): состоявшихся «Судебных процессов» без внесённого
   исхода затравка не содержит — все четыре прошедших закрыты исходом, а прошедшие
   «Извещения о назначении» исходом не меряются вовсе (hApplicable=false). Поэтому на
   живых данных сегмент «Предстоящие» даёт ровно две предстоящие строки, а само правило
   «прошедшее без исхода из сегмента не прячется» показывается синтетикой в отдельном
   DOM: у прошедшего судебного процесса снимаем исход и ждём его строку в сегменте. */
ok('умолчание — предстоящие: в сегменте только предстоящие строки',
   H.ev(`regState.hearings.seg`) === 'upcoming'
   && rRows(H,'hearings').length === 2
   && rRows(H,'hearings').filter(r=>/предстоит/.test(r.textContent)).length === 2);
ok('прошедшее без внесённого исхода из сегмента «Предстоящие» не прячется', mk().ev(`(() => {
  navClick('Заседания (реестр)');
  const before = REGS.hearings.all().filter(x=>x.n != null && x.n < 0 && !x.done && hApplicable(x.h)).length;
  const x = REGS.hearings.all().find(y => y.n != null && y.n < 0 && y.done && hApplicable(y.h));
  x.h.outcome = ''; regRefresh('hearings');
  const rows = [...document.querySelectorAll('#hearingsBody tr')].filter(r=>!r.classList.contains('rowempty'));
  return before === 0 && rows.length === 3
      && rows.filter(r=>/исход не внесён/.test(r.textContent)).length === 1;
})()`));
ok('сегмент «Прошедшие» даёт только прошедшие', (()=>{
   H.ev(`regSetSeg('hearings','past')`); const n = rRows(H,'hearings').length;
   const all = (H.ev(`regSetSeg('hearings','all')`), rRows(H,'hearings').length);
   H.ev(`regSetSeg('hearings','upcoming')`); return n === 6 && all === 8; })());
ok('мера-основание — подписью, а не колонкой',   // первая строка сегмента — заседание по ИСК-333
   /мера ИСК-/.test(rRows(H,'hearings')[0].textContent)
   && /Мера-основание: ИСК-333 · участники:/.test(rRows(H,'hearings')[0].getAttribute('title')));
ok('представитель ФКФ выведен из участников, а не введён руками',
   H.ev(`REGS.hearings.all().every(x=>!!x.rep)`) && !/rep:'/.test(HTML));
ok('рамка называет очередь, дыру и ближайшее заседание',   // счётчики сняты с #hearingsFrame
   /предстоит <b>2<\/b> · прошло без внесённого исхода <b>0<\/b> · ближайшее <b>24\.07\.2026 10:30<\/b>/.test(H.$('#hearingsFrame').innerHTML));

head('КР-5/КР-6/КР-7 · претензии: ось вручение, сумма документа неизменна');
ok('семь колонок, ось — вручение',
   rCols(C,'claims').join('|') === 'Вид|Номер|Отправлена|Вручение|Заёмщик|Требование|Сумма');
ok('мёртвой колонки «Статус» нет',           !rCols(C,'claims').includes('Статус'));
/* НАХОДКА ВОЛНЫ ЗС (отчёт Task 11): претензий без подтверждённого вручения затравка не
   содержит вовсе — у каждой живой претензии есть served.date, счётчик п. 19.2 равен нулю.
   Правило (подсветка + отбор сегментом) поэтому показывается синтетикой в отдельном DOM:
   у одной вручённой претензии снимаем served и ждём и подсветку, и её же в сегменте. */
ok('невручённых в затравке нет — счётчик п. 20.1 честно нулевой',
   rRows(C,'claims').filter(r=>r.classList.contains('mrow-undelivered')).length === 0
   && C.ev(`REGS.claims.all().filter(x=>!x.m.storno && !(x.m.served&&x.m.served.date)).length === 0`));
ok('невручённое подсвечено независимо от сегмента и им же отбирается', mk().ev(`(() => {
  navClick('Претензии (реестр)');
  const x = REGS.claims.all().find(y=>!y.m.storno && y.m.served && y.m.served.date);
  delete x.m.served; regRefresh('claims');
  const rows = () => [...document.querySelectorAll('#claimsBody tr')].filter(r=>!r.classList.contains('rowempty'));
  const hl  = rows().filter(r=>r.classList.contains('mrow-undelivered')).length;
  const txt = rows().filter(r=>/не подтверждено \\(п\\. 20\\.1\\)/.test(r.textContent)).length;
  regSetSeg('claims','undelivered'); const seg = rows().length;
  return hl === 1 && txt === 1 && seg === 1;
})()`));
ok('сегмент «Сторнированные» отбирает сторно', (()=>{
   C.ev(`regSetSeg('claims','undelivered')`); const n = rRows(C,'claims').length;
   C.ev(`regSetSeg('claims','storno')`);      const s = rRows(C,'claims').length;
   C.ev(`regSetSeg('claims','all')`);         return n === 0 && s === 2; })());
ok('три даты Р-7 и результат — в подсказке строки',
   /Событие .+ · поступление .+ · регистрация .+ · результат: /.test(rRows(C,'claims')[0].getAttribute('title')));
ok('сумма документа не пересчитана, расхождение подписано «сейчас …»',   // 120 из 194 строк (было 116 из 190 — `ADR-0080` добавил дела 366/367 кода K3-ЖАЛОБА-ЗАЁМЩИКА, каждое несёт обе свои претензии; было 112 из 180 — `ADR-0079`, дела 346/347; было 110 из 178 — наряд п.7в, кейс 701)
   rRows(C,'claims').filter(r=>/сейчас /.test(r.textContent)).length === 120
   && C.ev(`REGS.claims.all().every(x=>x.doc === parseSum(x.m.sum))`));
ok('дельта суммы нигде не хранится (ADR-0001)',
   C.ev(`PROCESSES.flatMap(p=>p.measures||[]).every(m=>m.sumNow===undefined && m.delta===undefined)`));
ok('рамка считает вручение, сторно и расхождение',   // счётчики сняты с #claimsFrame
   /без подтверждения вручения <b>0<\/b> \(п\. 20\.1\) · сторнировано <b>2<\/b> · сумма документа разошлась с требованием у <b>120<\/b>/
     .test(C.$('#claimsFrame').innerHTML));

head('КР-8/КР-9/КР-11 · вопросы: состояние выводится в одном месте');
ok('семь колонок, состояние первым',
   rCols(Q,'committee').join('|') === 'Состояние|Предмет|Орган|Заёмщик|Договоры|Инициатор|Заседание');
ok('умолчание — ждут решения',               Q.ev(`regState.committee.seg`) === 'pending'
   && rRows(Q,'committee').length === 7 && Q.ev(`REGS.committee.all().length`) === 78);   // 7 нерешённых из 78 (было 7 из 76 — `ADR-0080` добавил дела 366/367 жалобы заёмщика, оба доходят до решения суда и приносят по решённому вопросу; было 7 из 74 — `ADR-0079`, дела 346/347)
ok('состояний ровно четыре',                 Q.ev(`Object.keys(CQ_STATE).join('/')`) === 'pending/scheduled/positive/negative');
ok('заглушки в поле решения решением больше не считаются',
   Q.ev(`CQ_NON_DECISION.size === 4`)
   && Q.ev(`PROCESSES.flatMap(p=>p.committeeQuestions).filter(q=>!q.decided && q.decision).length === 0`));
ok('состояние читают реестр, карточка и гейт из одного хелпера',
   (HTML.match(/questionState\(/g)||[]).length >= 4);
/* НАХОДКА ВОЛНЫ ЗС (отчёт Task 11): у каждого нерешённого вопроса затравки дата заседания
   есть (все шесть — 15.07.2026), состояния pending в живых данных нет вовсе. Правило
   «дата не проставлена → «не назначено», а не прочерк» показывается синтетикой. */
ok('вопрос без даты заседания назван «не назначено», а не прочерком', mk().ev(`(() => {
  const q = PROCESSES.find(x=>x.id==='311').committeeQuestions[0];
  const wasScheduled = questionState(q).k === 'scheduled';
  delete q.meetingDate;
  navClick('Вопросы на коллегиальные органы (реестр)'); regSetSeg('committee','pending');
  const rows = [...document.querySelectorAll('#committeeBody tr')].filter(r=>!r.classList.contains('rowempty'));
  return wasScheduled && questionState(q).k === 'pending'
      && rows.filter(r=>/не назначено/.test(r.textContent)).length === 1
      && !rows.some(r=>/—/.test(r.querySelectorAll('td')[6].textContent));
})()`));
ok('гейтовый вопрос называет, какое действие держит',   // все семь нерешённых держат действие (было шесть — дело 327, §4.8)
   rRows(Q,'committee').filter(r=>/блокирует: /.test(r.textContent)).length === 7);
ok('протокол и решение — подписями, отдельных колонок нет',
   !rCols(Q,'committee').includes('Протокол') && !rCols(Q,'committee').includes('Решение')
   && Q.ev(`regSetSeg('committee','decided')`) === undefined
   && rRows(Q,'committee').some(r=>/протокол /.test(r.textContent)));
ok('рамка считает очередь, безадресные и заблокированные действия', (()=>{
   Q.ev(`regSetSeg('committee','pending')`);
   return /ждут решения <b>7<\/b> · из них без даты заседания <b>0<\/b> · отказов <b>0<\/b> · держат заблокированным действие <b>7<\/b>/
     .test(Q.$('#committeeFrame').innerHTML); })());   // счётчики сняты с #committeeFrame; 6 → 7 — дело 327 (§4.8)
ok('прочерк вместо номера протокола убран из затравки',
   Q.ev(`PROCESSES.flatMap(p=>p.committeeQuestions).filter(q=>q.protocolNo === '—').length === 0`));

head('КР-10 · гейт сверяется по предмету и по договору');
/* Шесть предметов затравки ЗС: безакцепт · внесудебное обращение на залог · поручение о
   судебном взыскании · признание безнадёжной · списание · нецелевое использование.
   Смысл проверки прежний — написание одно на предмет, разнобоя формулировок нет. */
ok('предмет вопроса приведён к одному написанию',
   Q.ev(`[...new Set(PROCESSES.flatMap(p=>p.committeeQuestions.map(q=>q.topic)))].length === 6`)
   /* Пять из шести — предметы справочника CQ_SUBJECTS слово в слово; шестой заведён как
      СВОБОДНЫЙ предмет, что справочник и разрешает («Другое (иной вопрос)»). Список
      свободных фиксируется целиком: тихо пополниться он не сможет. */
   && Q.ev(`[...new Set(PROCESSES.flatMap(p=>p.committeeQuestions.map(q=>q.topic)))]
              .filter(t => !CQ_SUBJECTS.some(s=>s.topic===t)).join('|')`)
        === 'Установление факта нецелевого использования кредитных средств');
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
/* НАХОДКА ВОЛНЫ ЗС (отчёт Task 11): отказов органа затравка не содержит ни одного — все
   66 решённых вопросов положительные. Правило «отказ назван отказом и приводит протокол»
   поэтому показывается синтетикой в отдельном DOM: вопросу дела 310 (K1-БА-ГЕЙТ, тот же
   предмет «Запуск безакцептного списания») проставляем отказ и читаем причину гейта. */
ok('отказ назван отказом и приводит протокол', mk().ev(`(() => {
  const q = PROCESSES.find(x=>x.id==='310').committeeQuestions[0];
  if(PROCESSES.flatMap(p=>p.committeeQuestions).some(y=>y.decided && !y.positive)) return false;  // в затравке отказов нет
  q.decided = true; q.positive = false; q.decision = 'отказано';
  q.protocolNo = 'КО-99'; q.protocolDate = '14.07.2026';
  return /Орган отказал \\(протокол КО-99 от 14\\.07\\.2026\\)/
    .test(gateReason(REQ_INDEX['310/310/з'],'Безакцептное списание'))
    && questionState(q).k === 'negative';
})()`));
/* Назначенный, но нерешённый вопрос — дело 310 (заседание 15.07.2026); дело 201 вопроса
   не выносило вовсе. Прежнее 314 в затравке ЗС решение уже получило. */
ok('невынесенный и назначенный вопрос дают разные причины',
   /Вопрос не вынесен\./.test(Q.ev(`gateReason(PROCESSES.find(p=>p.id==='201').requirements[0],'Безакцептное списание')`))
   && /назначен на заседание 15\.07\.2026, решение не внесено/
     .test(Q.ev(`gateReason(PROCESSES.find(p=>p.id==='310').requirements[0],'Безакцептное списание')`)));
ok('правила, сохранённые до волны, гейт не ломают (запасной ход на GATES)', mk().ev(`(()=>{
  /* restoreRules подменяет раздел целиком: старый снимок приедет без topic. */
  Object.keys(RULES.gates).forEach(k => { delete RULES.gates[k].topic; });
  const p = PROCESSES.find(x=>x.id==='310');
  return gateTopic('Безакцептное списание') === 'Запуск безакцептного списания'
      && /назначен на заседание/.test(gateReason(p.requirements[0],'Безакцептное списание'));
})()`));
ok('поручение Председателя остаётся уровнем дела, а не вопросом',
   /требует поручения Председателя Правления \(п\. 21\)/
     .test(Q.ev(`gateReason(PROCESSES.find(p=>!p.poruchenie).requirements[0],'Исковое заявление')`)));

head('КР-12 · клик ведёт туда, где запись живёт');
ok('заседание открывает «Суд» требования',   // первая строка сегмента — заседание дела 333
   /openDetail\('333\/333\/з', TAB_BY_SLUG\('sud'\)\)/.test(rRows(H,'hearings')[0].getAttribute('onclick')));
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
/* «не выведено» — тоже ВЫВЕДЕННОЕ значение: опция обязана стоять ровно тогда, когда у
   какого-то вопроса инициатор в подразделение не разворачивается. В затравке ЗС таких
   нет (инициаторы — ДАК/САК/ОД/ОПК), опции поэтому нет, и это правильное поведение. */
ok('список подразделений строится из выведенных значений (ТР-5)',
   Q.ev(`[...document.getElementById('committeeSubdiv').options].slice(1)
          .every(o => o.value === 'не выведено' || REGS.committee.all().some(x=>REGS.committee.subdiv(x) === o.value))`)
   && Q.ev(`[...document.getElementById('committeeSubdiv').options].some(o=>o.value === 'не выведено')
            === REGS.committee.all().some(x=>REGS.committee.subdiv(x) === null)`)
   && Q.ev(`REGS.committee.all().some(x=>REGS.committee.subdiv(x) === null) === false`));
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

/* Раздел ФИКСИРУЕТ покрытие затравки — что она несёт и чего не несёт. Три состояния
   волна ЗС растеряла (прошедший судебный процесс без исхода · отказ органа · вопрос без
   даты заседания); их ПРАВИЛА проверены синтетикой выше (КР-3 · КР-8 · КР-10), а здесь
   зафиксирован сам факт непокрытия — чтобы возвращение состояния в затравку было видно
   провалом, а не прошло молча. Находки перечислены в отчёте Task 11. */
head('КР-14 · что затравка покрывает, а чего в ней нет');
ok('прошедшие без исхода — только извещения; судебного процесса без исхода в затравке нет',
   H.ev(`REGS.hearings.all().filter(x=>x.n != null && x.n < 0 && !x.done).length === 3`)
   && H.ev(`REGS.hearings.all().filter(x=>x.n != null && x.n < 0 && !x.done).every(x=>!hApplicable(x.h))`)
   && H.ev(`REGS.hearings.all().filter(x=>x.n != null && x.n < 0 && !x.done && hApplicable(x.h)).length === 0`));
ok('есть сторнированная претензия-дубль',
   C.ev(`REGS.claims.all().filter(x=>!!x.m.storno).length === 2`)
   && C.ev(`PROCESSES.flatMap(p=>p.measures||[]).some(m=>/дубль ПР-320\\/2/.test((m.storno||{}).reason||''))`));
ok('есть требование гаранту и сам гарант обязанным лицом',   // гарант живёт на деле 308 (K1-ОБЕСП)
   C.ev(`PROCESSES.find(p=>p.id==='308').obligors.filter(o=>o.role==='гарант').length === 1`)
   && C.ev(`REGS.claims.all().some(x=>x.m.kind === 'Требование гаранту')`));
ok('отказов органа в затравке нет — все решённые вопросы положительные',
   Q.ev(`REGS.committee.all().filter(x=>x.st.k === 'negative').length === 0`)
   && Q.ev(`REGS.committee.all().filter(x=>x.st.k === 'positive').length === 71`));   // было 69 — `ADR-0080`, дела 366/367 жалобы заёмщика; 67 — `ADR-0079`, дела 346/347
ok('нерешённые вопросы все назначены — вопроса без даты заседания в затравке нет',
   Q.ev(`REGS.committee.all().filter(x=>x.st.k === 'pending').length === 0`)
   && Q.ev(`REGS.committee.all().filter(x=>x.st.k === 'scheduled').length === 7`));   // 6 → 7: дело 327 (§4.8)

head('КР-15 · карточка и реестр читают одно и то же');
/* Заседания живут на делах 332…334 и 120; дело 333 (K3-ИСК) — с заседаниями и живой
   колонкой исхода. Прежнее 142 в затравке ЗС заседаний не несёт. */
{ const m = mk(); m.ev(`openDetail('333/333/з', TAB_BY_SLUG('sud'))`);
  const a = m.active();
  ok('в карточке колонка заседания — «Исход», а не «Статус»',
     /<th>Исход<\/th>/.test(a.innerHTML) && !/<th>Статус<\/th>/.test(a.innerHTML)); }
/* Та же находка, что и в КР-3: прошедшего судебного процесса без исхода в затравке нет
   (все закрыты), поэтому пометку карточки показываем синтетикой на деле 334. */
ok('прошедшее без исхода помечено и в карточке', mk().ev(`(() => {
  const h = PROCESSES.find(p=>p.id==='334').hearings.find(x=>x.kind==='Судебный процесс' && x.outcome);
  h.outcome = '';
  openDetail('334/334/з', TAB_BY_SLUG('sud'));
  return /исход не внесён/.test(document.querySelector('#detailPanels .detail-panel.active').textContent);
})()`));
/* Назначенный, но нерешённый вопрос — дело 310 (K1-БА-ГЕЙТ). */
{ const m = mk(); m.ev(`openDetail('310/310/з', TAB_BY_SLUG('soglasovaniya'))`);
  const a = m.active();
  ok('карточка печатает то же состояние вопроса, что и реестр',
     /назначен на заседание/.test(a.textContent)
     && a.textContent.includes(m.ev(`questionState(PROCESSES.find(p=>p.id==='310').committeeQuestions[0]).t`)));
  /* Прежняя формулировка искала в карточке строку «открывает вопрос «…»» — такой строки в
     мокапе нет (см. отчёт Task 11). Правило то же и проверяется по существу: карточка
     печатает ПРЕДМЕТ вопроса, и это ровно тот предмет, по которому гейт ищет решение. */
  ok('карточка называет предмет вопроса — тот самый, который ищет гейт',
     a.textContent.includes(m.ev(`PROCESSES.find(p=>p.id==='310').committeeQuestions[0].topic`))
     && m.ev(`gateTopic('Безакцептное списание')`)
        === m.ev(`PROCESSES.find(p=>p.id==='310').committeeQuestions[0].topic`));
  ok('договоры вопроса печатаются номером, а не id',
     !/>\s*310\s*</.test(a.innerHTML) && /Дог\. №/.test(a.textContent)); }

head('КР-16 · границы волны');
ok('вкладка «Гейты» настроек по-прежнему читается',
   g.ev(`Object.keys(RULES.gates).length === 4`)
   && g.ev(`Object.keys(RULES.gates).every(k=>!!RULES.gates[k].organ && !!RULES.gates[k].point && !!RULES.gates[k].topic)`));
ok('реестр требований и карточка волной не тронуты',   // затравка ЗС: 9 вкладок (КД-4) · 100 требований
   g.ev(`TABS.length === 9`) && g.ev(`allReqs().length === 100`));

/* ADR-0031: жалоба фазу не двигает — состояние иска остаётся неопределённым до акта
   вышестоящей инстанции; фазу двигает именно акт (Task 4). В затравке ЗС этот сценарий
   несёт ситуация K3-АПЕЛЛЯЦИЯ (дела 340 · 341): обе меры зарегистрированы — «Апелляционная
   жалоба» АЖ-340 (resultIsDocument, без outcome) и дочернее «Постановление апелляционной
   инстанции» ПА-340 (basedOn на жалобу, с outcome). Прежнее 330 стало делом K3-ИСК-ЖДЁМ. */
head('ADR-0031 · апелляция не веха, акт вышестоящей инстанции — веха');
ok('жалоба не несёт setsPhase, дочернее постановление несёт',
   g.ev(`measureSetsPhase(PROCESSES.find(p=>p.id==='340').measures.find(m=>m.kind==='Апелляционная жалоба'))`) === null
   && !!g.ev(`measureSetsPhase(PROCESSES.find(p=>p.id==='340').measures.find(m=>m.kind==='Постановление апелляционной инстанции'))`));
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
   g.ev(`!basedOnValid({basedOn:'НЕТ-ТАКОГО-НОМЕРА', targets:['142/142/з'], _proc: PROCESSES.find(x=>x.id==='142')})`));
/* ПР-142/1 — живая мера дела 142, целящая только в 142/142/з; цель «307/307/з» ей чужая
   (другое дело), пересечение targets пустое — ссылка адресует чужую меру. */
ok('пустое пересечение targets меры и её основания — дефект',
   g.ev(`!basedOnValid({basedOn:'ПР-142/1', targets:['307/307/з'], _proc: PROCESSES.find(x=>x.id==='142')})`)
   && g.ev(`basedOnValid({basedOn:'ПР-142/1', targets:['142/142/з'], _proc: PROCESSES.find(x=>x.id==='142')})`));
/* Шаг 6 наряда (МП-3, `ADR-0072`): четвёртым основанием встало «Заявление о выдаче
   исполнительных листов» — ответ на него И ЕСТЬ сам лист. Три СЛОЕОБРАЗУЮЩИХ вида
   (решение · приказ · определение об утверждении МС) при этом не изменились: следующая
   строка проверяет именно их, отдельно от полного списка оснований. */
ok('ИЛ ссылается на решение суда / приказ / определение об утверждении мирового соглашения + заявление о выдаче (ПМ-Д6, наряд МП-11/ADR-0047, дополнен МП-3/ADR-0072)',
   g.ev(`kindOf('Исполнительный лист').basisKinds.join(',')`) === 'Решение суда,Судебный приказ,Определение об утверждении мирового соглашения,Заявление о выдаче исполнительных листов');
ok('слоеобразующая тройка от этого не выросла: AWARD_KINDS по-прежнему четыре вида присуждения',
   g.ev(`[...AWARD_KINDS].join(',')`) === 'Решение суда,Судебный приказ,Определение об утверждении мирового соглашения,Дополнительное решение суда');
/* Мер с двумя целями затравка ЗС не содержит вовсе (см. М-5), поэтому построчное сторно
   показывается на синтетической мере солидарной пары 307 — там две цели по одному
   договору, и сторно одной из них не должно гасить меру для второй. */
ok('сторно построчно (ADR-0029 п.3): мера остаётся живой для не сторнированной цели',
   mk().ev(`(() => {
     const p = PROCESSES.find(x=>x.id==='307'), t = p.requirements.map(r=>r.id);
     if(t.length !== 2) return false;
     const m = { sec:'Судебный', kind:'Исковое заявление', dates:D('20.07.2026','20.07.2026','20.07.2026'),
                 num:'ТЕСТ-ИСК-СТОРНО-ЦЕЛЬ', scope:{volume:'полный остаток',method:'деньгами'},
                 sum:'152 300,00', targets:t };
     p.measures.push(m);
     const bothLive = liveMeasuresOf(REQ_INDEX[t[0]]).includes(m) && liveMeasuresOf(REQ_INDEX[t[1]]).includes(m);
     m.stornoTargets = { [t[1]]: {reason:'тест', by:'т', at:'21.07.2026'} };
     const live = liveMeasuresOf(REQ_INDEX[t[0]]).includes(m);
     const notLiveForStornoed = !liveMeasuresOf(REQ_INDEX[t[1]]).includes(m);
     return bothLive && live && notLiveForStornoed;
   })()`));

/* ADR-0032 (Task 7) — урегулирование и треки: свёртки журнала, не хранимые поля.
   Пауза: `p.pause`/`active` сняты, «действует» вычисляет pauseOpenerOf/pauseClosed —
   открыватель есть, срок не истёк, закрывателя (нарушение/снятие) нет. Судебный и
   исполнительный треки — новая фича, тем же паттерном opener/closer, что DEADLINE_CLOSERS
   (см. SUD_OPENERS/SUD_CLOSERS/ISP_OPENERS/ISP_CLOSERS), но на MEASURE_KINDS, а не на
   отдельном справочнике. Затравка ЗС держит эти три случая на РАЗНЫХ делах (прежнее 320
   несло оба трека сразу — в новой затравке 320 это K1-СТОРНО): пауза «рассмотрение
   реструктуризации» — дело 319 (K1-ПАУЗА-РЕСТР), открытый судебный трек — дело 332
   (K3-ИСК: определение ОПР-332 без решения-закрывателя), открытый исполнительный трек —
   дело 342 (K3-ИЛ: ИЛ-342, постановления о возврате нет). Закрытый судебный трек —
   дело 336 (K3-РЕШЕНИЕ: ОПР-336 закрыт последующим «Решением суда» РС-336). */
head('ADR-0032 · урегулирование и треки (ПМ-Д8)');
ok('`pause` как хранимое поле дела снят полностью (замена — settlement, факты без active)',
   g.ev(`PROCESSES.every(p => !('pause' in p))`));
ok('открытый опенер без закрывателя — пауза видна активной (дело 319, req 319/319/з)',
   g.ev(`!!pausedState(${R('319/319/з')}) && pausedState(${R('319/319/з')}).kind === 'restructuring'`));
ok('открытый опенер без закрывателя — судебный трек виден активным (дело 332, req 332/332/з, ОПР-332)',
   g.ev(`(() => { const t = sudTrackOf(${R('332/332/з')}); return !!t && t.num === 'ОПР-332'; })()`));
ok('открытый опенер без закрывателя — исполнительный трек виден активным (дело 342, req 342/342/з, ИЛ-342)',
   g.ev(`(() => { const t = ispTrackOf(${R('342/342/з')}); return !!t && t.num === 'ИЛ-342'; })()`));
ok('закрыватель гасит судебный трек — дело 336 (ОПР-336 закрыт последующим «Решение суда» РС-336)',
   g.ev(`!sudTrackOf(${R('336/336/з')})`)
   && g.ev(`PROCESSES.find(p=>p.id==='336').measures.some(m=>m.num==='ОПР-336')`)
   && g.ev(`PROCESSES.find(p=>p.id==='336').measures.some(m=>m.num==='РС-336')`));
ok('решение №3 · TERMINAL_BY_MEASURE больше не содержит «Акт сверки о полном погашении»',
   g.ev(`!('Акт сверки о полном погашении' in TERMINAL_BY_MEASURE)`));
ok('акт сверки о полном погашении сам не терминирует — при живом остатке outcomeOf не меняется',
   g.ev(`(() => {
     const r = ${R('142/142/з')};
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
/* Все 12 снимков залога затравки ЗС свежие (08…18.07.2026 при отсчёте от 21.07.2026),
   устаревших нет — поэтому правило показываем и на живых данных (все свежие), и
   синтетикой: сдвигаем дату одного снимка за порог COLL_SNAPSHOT_STALE_DAYS. */
ok('устарелость снимка залога вычисляется (collSnapshotStale)',
   g.ev(`PROCESSES.every(p=>(p.colls||[]).every(c=>!collSnapshotStale(c)))`)
   && mk().ev(`(() => {
        const c = PROCESSES.flatMap(p=>p.colls||[])[0];
        const fresh = collSnapshotStale(c);
        c.snapshotAt = '01.01.2026';
        return fresh === false && collSnapshotStale(c) === true;
      })()`));

/* ══════════════════════════════════════════════════════════════════════════
   РМ-Д5 · «Сроки на контроле» — дыра по отсутствию дочерней меры
   ══════════════════════════════════════════════════════════════════════════ */
/* Дело 374 из затравки ушло. Сценарий «иск подан, ответа суда нет» несёт ситуация
   K3-ИСК-ЖДЁМ (дела 330 · 331) — ровно эти два иска дают дыру. Дело 344 (K3-МС) до
   наряда МП-11 давало третью, ПРОСРОЧЕННУЮ дыру — «мировое ещё проект, определения по
   иску нет»; ADR-0047 положил в журнал живую меру «Проект мирового соглашения» с
   basedOn на ИСК-344 (миграция SEED, 344 больше не молчит — прогресс есть, дыры нет).
   «Просрочена» — теперь синтетикой push/pop (тем же приёмом, что соседние мутирующие
   проверки этой же группы), не живым примером затравки: реальный «просроченный» кейс
   без ответа суда наряд не завёл, а держать её без покрытия — терять регресс на
   isOverdue() у самой дыры. */
head('РМ-Д5 · дыра по отсутствию дочерней меры (resultIsDocument)');
ok('иск без определения виден как дыра в очереди сроков (дело 331, ИСК-331, детей нет)',
   g.ev(`dlOf(${P('331')}).some(d => d.tpl===45 && d._childGapOf && d._childGapOf.num==='ИСК-331')`));
ok('дыра просрочена, когда 10 к.д. шаблона №45 истекли (синтетика push/pop)', g.ev(`(() => {
  const p = ${P('331')};
  const fake = {sec:'Судебный', kind:'Исковое заявление', dates:D('01.01.2026','01.01.2026'),
                num:'ТЕСТ-ИСК-ПРОСРОЧЕН', targets:['331/331/з']};
  p.measures.push(fake);
  const d = dlOf(p).find(x=>x._childGapOf && x._childGapOf.num==='ТЕСТ-ИСК-ПРОСРОЧЕН');
  const result = !!d && d.tpl===45 && isOverdue(d);
  p.measures.pop();
  return result;
})()`));
ok('видна в общем реестре «Сроки на контроле» (dlAll), привязана к требованию 331/331/з',
   g.ev(`dlAll().some(x => x.d._childGapOf && x.d._childGapOf.num==='ИСК-331' && x.reqs.some(r=>r.id==='331/331/з'))`));
ok('видна на вкладке требования (deadlinesOf) — тот же расчёт, что в общем реестре',
   g.ev(`deadlinesOf(${R('331/331/з')}).some(d => d._childGapOf && d._childGapOf.num==='ИСК-331')`));
ok('появление живой дочерней меры с basedOn на иск закрывает дыру (мутирующий тест, push/pop)',
   g.ev(`(() => {
     const p = ${P('331')};
     const parent = p.measures.find(m=>m.num==='ИСК-331');
     const before = dlOf(p).some(d => d._childGapOf && d._childGapOf.num==='ИСК-331');
     const fake = {sec:'Судебный', kind:'Определение о принятии искового заявления к производству',
                   dates:D('01.06.2026','01.06.2026','01.06.2026'), num:'ТЕСТ-ОПР', outcome:'принято к производству',
                   basedOn:'ИСК-331', targets:[...parent.targets]};
     p.measures.push(fake);
     const after = dlOf(p).some(d => d._childGapOf && d._childGapOf.num==='ИСК-331');
     p.measures.pop();
     return before === true && after === false;
   })()`));
ok('сторно на мере-родителе снимает дыру — respect storno (мутирующий тест, push/pop)',
   g.ev(`(() => {
     const p = ${P('331')};
     const parent = p.measures.find(m=>m.num==='ИСК-331');
     const fake = {sec:'Судебный', kind:'Исковое заявление', dates:D('01.05.2026','01.05.2026','01.05.2026'),
                   num:'ТЕСТ-ИСК-СТОРНО', storno:{reason:'тест', by:'т', at:TODAY}, targets:[...parent.targets]};
     p.measures.push(fake);
     const has = dlOf(p).some(d => d._childGapOf && d._childGapOf.num==='ТЕСТ-ИСК-СТОРНО');
     p.measures.pop();
     return !has;
   })()`));
/* Дыр в затравке было три (ИСК-330 · ИСК-331 · ИСК-344) — наряд МП-11 (ADR-0047) закрыл
   третью: 344 получил живую «Проект мирового соглашения», basedOn на ИСК-344 (миграция
   SEED, комментарий выше) — дочерняя мера у иска теперь есть, дыра не показывается.
   Осталось две; все ОСТАЛЬНЫЕ 53 иска (было 51 — `ADR-0080` добавил 366/367 кода
   K3-ЖАЛОБА-ЗАЁМЩИКА, оба с решением суда в цепочке; было 49 — `ADR-0079`, дела 346/347;
   было 47 — наряд п.7в добавил 701; было 48 до наряда МП-11) свой ответ/прогресс уже
   получили. */
ok('иски с уже зарегистрированным живым ответом суда (basedOn) дыр не показывают',
   g.ev(`(() => {
     const gaps = new Set(PROCESSES.flatMap(p => dlOf(p).filter(d=>d._childGapOf).map(d=>d._childGapOf.num)));
     const all  = PROCESSES.flatMap(p => (p.measures||[]).filter(m=>m.kind==='Исковое заявление').map(m=>m.num));
     return [...gaps].sort().join(',') === 'ИСК-330,ИСК-331'
         && all.length === 55 && all.filter(n=>!gaps.has(n)).length === 53;
   })()`));
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
  m.ev(`openDetail('201/201/з'); closeWindowMark();`);
  /* §4.14: претензия требует переговоров (п. 16.2) — без них тело меры не появится
     вовсе и весь блок пометок остался бы без предмета. */
  m.ev(`openMeasureModal()`);
  m.doc.getElementById('mKind').value = 'Телефонные переговоры с заёмщиком';
  m.ev(`syncMeasureWarnings()`);
  m.doc.getElementById('mNum').value = 'ТЕСТ-ТП-ПОМЕТКА';
  m.ev(`saveMeasure()`);
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
   g.ev(`!basedOnValid({basedOn:'ПР-142/1', targets:['307/307/з'], _proc: PROCESSES.find(x=>x.id==='142')})`)
   && g.ev(`PROCESSES.every(p => (p.measures||[]).every(m => !m.basedOn || basedOnValid(m)))`));

/* 2) ADR-0032 п.1: открытый трек (опенер без закрывателя) виден активным и гасится
   появлением закрывателя — мутирующий push/pop на реальном деле 332 (req 332/332/з,
   K3-ИСК: судебный трек открыт определением ОПР-332, закрывателя в затравке нет). */
ok('инвариант · открытый трек виден активным и закрывается при появлении закрывателя (push/pop, дело 332)',
   g.ev(`(() => {
     const r = ${R('332/332/з')}, p = r._proc;
     const before = sudTrackOf(r);
     const fake = {sec:'Судебный', kind:'Решение суда', dates:D('01.07.2026','01.07.2026','01.07.2026'),
                   num:'ТЕСТ-ЗАКР-ТРЕК', outcome:'иск удовлетворён полностью', targets:[r.id]};
     p.measures.push(fake);
     const after = sudTrackOf(r);
     p.measures.pop();
     const restored = sudTrackOf(r);
     return !!before && before.num==='ОПР-332' && after===null && !!restored && restored.num==='ОПР-332';
   })()`));

/* 3) ADR-0035 п.2 / ADR-0027 п.1: вид с resultIsDocument:true — результат приходит
   ОТДЕЛЬНЫМ документом дочерней меры, поэтому такая мера сама исход не несёт вовсе.
   Проверка по ВСЕМ мерам ВСЕХ процессов, не по одному образцу. */
ok('инвариант · resultIsDocument-вид никогда не несёт outcome (по всем мерам всех дел)',
   g.ev(`PROCESSES.every(p => (p.measures||[]).every(m => {
     const kd = kindOf(m.kind); return !kd || !kd.resultIsDocument || m.outcome === undefined;
   }))`));

/* 4) ADR-0032 п.2: активная пауза трассируется к живому опенеру, у которого нет
   закрывателя (pauseOpenerOf + pauseClosed) — реальный случай, дело 319 (K1-ПАУЗА-РЕСТР). */
ok('инвариант · активная пауза трассируется к живому опенеру без закрывателя (pauseOpenerOf/pauseClosed, дело 319)',
   g.ev(`(() => {
     const s = pauseOpenerOf(${R('319/319/з')});
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
   g.ev(`MEASURE_KINDS.filter(k=>k.source==='внешний акт').every(k => measureGate(${R('201/201/з')}, k.name) === null)`)
   && g.ev(`kindOf('Апелляционная жалоба').source==='наш документ' && !!measureGate(${R('201/201/з')}, 'Апелляционная жалоба')`));

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
ok('видов мер 81 (было 51 — Task 2/4 расщепили «Определение суда» на 5 + добавили «Постановление апелляционной инстанции»; было 59 до наряда п.7 — п.7а добавил «Повторное предъявление ИЛ»; было 60 до наряда п.1 — добавил «Дополнительное решение суда» (ADR-0046) и «Определение о повороте исполнения» (ADR-0049); было 62 до наряда МП-11 — ADR-0047 расщепил «Мировое соглашение» на «Проект…»/«Определение об утверждении…»/«Констатация нарушения…», −1+3; было 64 до шага 4 наряда сверки — `ADR-0066` добавил два выхода п. 36: «Жалоба на акты судебного исполнителя» и «Направление материалов в САК на банкротство»; было 66 до шага 5 — `ADR-0069` добавил пять видов главы 10 (свидетельство о смерти · справка о составе семьи · предложение родственникам · запрос нотариусу · запрос в ГРС), `ADR-0070` — два входа банкротной ветви (уведомление п. 55 · признание долга п. 56); было 73 до шага 6 — `ADR-0071` добавил две жалобы ЗАЁМЩИКА (апелляционную и кассационную, пп. 30.4/30.5), `ADR-0072` — четыре акта-ответа МП-3 (две отмены решения по вновь открывшимся / новым обстоятельствам, определение об изменении способа и порядка исполнения, определение о восстановлении процессуального срока); было 79 до §4.14 — заведены «Телефонные переговоры с заёмщиком», п. 16.2; было 80 до кассационной ветви — `ADR-0079` завёл «Постановление кассационной инстанции», парный акт к обеим кассационным жалобам)',
   g.ev('MEASURE_KINDS.length') === 81);
/* Видов-вех 22: 17 прежних + К7 переписан волной ЗС (заключение комиссии → «Признана
   безнадёжной» и два акта о списании → «Списана» вместо трёх снятых вех-фактов) плюс
   разделённые «Решение суда (отсутствие правопреемника)» и «Заявление об установлении
   правопреемника» плюс наряд п.1 — «Дополнительное решение суда» тоже ставит фазу
   «Решение суда» (единственным своим outcome). Пересчитано по живому справочнику:
   MEASURE_KINDS с непустым kindPhase. */
ok('видов-вех 22 (свёртка kindPhase, MILESTONE_KINDS как отдельный справочник снят — ADR-0033/0038)',
   g.ev(`MEASURE_KINDS.filter(k=>kindPhase(k.name)).length`) === 22);
ok('шаблонов сроков 49',        g.ev('DEADLINE_TEMPLATES.length') === 49);
ok('контуров К0…К7 — восемь',   g.ev('Object.keys(CONTOURS).length') === 8);
ok('разделов мер семь',         g.ev('SECTION_ORDER.length') === 7);
ok('редактор правил на месте',  g.ev(`typeof RULES === 'object' && typeof resetRulesAll === 'function'`));
ok('логика мирового на месте (ADR-0047, наряд МП-11 — msStageEligible/msNotWorseOk/msSyncStates сняты)',
   g.ev(`['msTermGate','msSeedSchedule','msComputeRows','mirovoeApprovalOf','mirovoeBreachOf','mirovoeProjectsOf'].every(f=>typeof window[f]==='function')`));

/* ══════════════════════════════════════════════════════════════════════════
   ОБОЛОЧКА — сворачивание бокового меню
   ══════════════════════════════════════════════════════════════════════════ */
head('оболочка · сворачивание меню');
/* Бургер в шапке нёс cursor:pointer и подпись «Меню», но не имел ни обработчика,
   ни функции, ни правила скрытия — кнопка выглядела рабочей и не делала ничего.
   Образец рабочего поведения — mockups/loan-credit/credit.html и
   mockups/collateral/zalog.html: класс `nav-collapsed` на `.app`. */
ok('toggleNav объявлена',            g.ev(`typeof toggleNav === 'function'`));
ok('бургер шапки вызывает toggleNav', /toggleNav\(\)/.test((g.$('.topbar .menu')||{}).getAttribute?.('onclick') || ''));
ok('правило скрытия .app.nav-collapsed .sidebar есть в стилях',
   /\.app\.nav-collapsed\s+\.sidebar\s*\{[^}]*display\s*:\s*none/.test(HTML));
ok('toggleNav сворачивает и разворачивает', g.ev(`(() => {
     const app = document.querySelector('.app');
     const was = app.classList.contains('nav-collapsed');
     toggleNav(); const on = app.classList.contains('nav-collapsed');
     toggleNav(); const off = app.classList.contains('nav-collapsed');
     return was === false && on === true && off === false;
   })()`));
/* Состояние переживает перерисовку и перезагрузку: класс на .app рендеры не трогают,
   но выбор пользователя должен пережить и F5 — иначе свёрнутое меню разворачивается
   на каждом переходе по хэшу. */
ok('свёрнутость переживает перезагрузку (localStorage)', g.ev(`(() => {
     toggleNav();
     const saved = localStorage.getItem('asubk.collection.navCollapsed');
     toggleNav();
     return saved === '1' && localStorage.getItem('asubk.collection.navCollapsed') === '0';
   })()`));

/* ═══ §4.8 сверки · РАЗВИЛКА БЕЗАКЦЕПТА ПО ТИПУ ПРОЕКТА (п. 16.5, `ADR-0077`) ═══════ */
head('§4.8 · безакцепт — два комитета по типу проекта (п. 16.5, ADR-0077)');
ok('справочник типов проекта — два значения, третьего норма не даёт',
   g.ev(`PROJECT_TYPES.join('/')`) === 'ДАК/региональный');
ok('тип проекта объявлен у КАЖДОГО кредита затравки — умолчания нет',
   g.ev(`PROCESSES.flatMap(p=>p.credits||[]).every(c=>PROJECT_TYPES.includes(c.projectType))`)
   && g.ev(`PROCESSES.flatMap(p=>p.credits||[]).length`) >= 100);
ok('тип проекта НЕ выводится из ведущего подразделения — поля разные',
   /* Ровно та ловушка, ради которой поле и заведено: subdiv едет по эстафете, и у
      эскалированных кредитов происхождения в нём уже нет. Проверка ищет кредиты, где
      subdiv вне {ДАК}, а тип проекта при этом объявлен — вывести его из subdiv нечем. */
   g.ev(`PROCESSES.flatMap(p=>p.credits||[]).filter(c=>['ОПК','ДПО','САК'].includes(c.subdiv) && c.projectType).length`) > 0);
ok('развилочный гейт ровно один — безакцепт (п. 16.5)',
   g.ev(`Object.keys(GATES).filter(k=>GATES[k].organByProject).join('|')`) === 'Безакцептное списание'
   && g.ev(`Object.keys(GATES).filter(k=>GATES[k].organ && GATES[k].organByProject).length`) === 0);
ok('развилочный гейт своего единственного органа не имеет — только пару',
   g.ev(`GATES['Безакцептное списание'].organ === undefined`)
   && g.ev(`gateOrgans(GATES['Безакцептное списание']).length`) === 2);
ok('оба комитета п. 16.5 берутся из закрытого справочника ORGANS',
   g.ev(`gateOrgan(GATES['Безакцептное списание'],'ДАК') === ORGANS[0]`)
   && g.ev(`gateOrgan(GATES['Безакцептное списание'],'региональный') === ORGANS[1]`));
ok('неизвестный тип проекта органа НЕ получает — молчаливого умолчания нет',
   g.ev(`gateOrgan(GATES['Безакцептное списание'], undefined) === null`)
   && g.ev(`gateOrgan(GATES['Безакцептное списание'], 'иной') === null`));
/* Два полюса на живых данных: 310 — проект ДАК, 327 — региональный; ожидающий гейт
   безакцепта у обоих, а орган вопроса разный. Без дела 327 развилка жила бы в коде. */
ok('вопрос затравки уходит в комитет, назначенный ТИПОМ ПРОЕКТА',
   g.ev(`PROCESSES.find(p=>p.id==='310').credits[0].projectType`) === 'ДАК'
   && g.ev(`PROCESSES.find(p=>p.id==='310').committeeQuestions[0].organ`) === g.ev(`ORGANS[0]`)
   && g.ev(`PROCESSES.find(p=>p.id==='327').credits[0].projectType`) === 'региональный'
   && g.ev(`PROCESSES.find(p=>p.id==='327').committeeQuestions[0].organ`) === g.ev(`ORGANS[1]`));
ok('причина блокировки называет ТОТ комитет, что назначен типу проекта',
   /администрированию бюджетных кредитов/.test(g.ev(`gateReason(REQ_INDEX['310/310/з'],'Безакцептное списание')`))
   && /региональному развитию/.test(g.ev(`gateReason(REQ_INDEX['327/327/з'],'Безакцептное списание')`))
   && !/региональному развитию/.test(g.ev(`gateReason(REQ_INDEX['310/310/з'],'Безакцептное списание')`)));
ok('дело-уровневый вызов кредита не знает и называет ОБА через слэш',
   g.ev(`gateOrgansLabel(GATES['Безакцептное списание'])`) === g.ev(`ORGANS[0]+' / '+ORGANS[1]`));
ok('экран правил печатает оба органа и подписывает, чем они разводятся', (()=>{
   const m = mk(); m.asAdmin(); m.ev(`navClick('Настройки правил'); settingsTab='gates'; renderSettings()`);
   const t = m.doc.getElementById('view-settings').textContent;
   return /Комитет по администрированию бюджетных кредитов \/ Комитет по региональному развитию/.test(t)
       && /по типу проекта \(ДАК \/ региональный\), п\. 16\.5/.test(t); })());
/* Один вопрос — один орган. Смешанный набор кредитов ни органа не подставляет, ни
   сохраняться не должен: половина записи адресовалась бы чужому комитету, и гейт
   открылся бы всем по решению органа без компетенции. */
ok('смешанный набор типов проекта форма не подставляет и не сохраняет', mk().ev(`(() => {
  const p = PROCESSES.find(x=>x.id==='412');
  p.credits[0].projectType = 'ДАК'; p.credits[1].projectType = 'региональный';
  openDetail('412/560/з', TAB_BY_SLUG('soglasovaniya'));
  openCommitteeQuestionModal();
  document.getElementById('cqSubject').value = 'Запуск безакцептного списания';
  onCqSubjectChange();
  const note = document.getElementById('cqOrganNote').textContent;
  const before = (p.committeeQuestions||[]).length;
  saveCommitteeQuestion();
  return /разных типов проекта/.test(note) && (p.committeeQuestions||[]).length === before;
})()`));
ok('однородный набор орган подставляет сам и сохранение проходит', mk().ev(`(() => {
  const p = PROCESSES.find(x=>x.id==='412');
  p.credits.forEach(c => c.projectType = 'региональный');
  openDetail('412/560/з', TAB_BY_SLUG('soglasovaniya'));
  openCommitteeQuestionModal();
  document.getElementById('cqSubject').value = 'Запуск безакцептного списания';
  onCqSubjectChange();
  return document.getElementById('cqOrgan').value === ORGANS[1]
      && /типом проекта/.test(document.getElementById('cqOrganNote').textContent);
})()`));
/* Шаблоны сроков ветви Б: строка 13 стояла «5 р.д. от получения документов от РП» —
   ни срока, ни базы в п. 16.5 нет. Норма даёт куратору 10 р.д. от той же базы, что и
   ветви А, — дня повторного направления требований. */
ok('обе ветви п. 16.5 считаются от одной базы, выдуманных 5 р.д. больше нет', (()=>{
   const t = n => g.ev(`JSON.stringify(DEADLINE_TEMPLATES.find(x=>x.n===${n}))`);
   const j = n => JSON.parse(t(n));
   return j(11).term === '10 р.д.' && j(11).base === 'дата повторного направления требований'
       && j(12).term === '3 р.д.'  && j(12).base === 'дата повторного направления требований'
       && j(13).term === '10 р.д.' && j(13).base === 'дата повторного направления требований'
       && [11,12,13,14].every(n => j(n).point === '16.5'); })());
ok('шаблоны ветвей называют СВОЙ комитет, а не «Комитет» вообще',
   /комитет по администрированию кредитов/.test(g.ev(`DEADLINE_TEMPLATES.find(x=>x.n===11).action`))
   && /комитет по региональному развитию/.test(g.ev(`DEADLINE_TEMPLATES.find(x=>x.n===13).action`)));

head('§4.14 · мелочи с ценой — семь точек редакции №41');

/* 1 · тпл 38, п. 9 — «в срок до 1 сентября текущего календарного года». */
ok('акт сверки на 1 января подписывается до 1 сентября, не до 1 июля', (()=>{
   const t = JSON.parse(g.ev(`JSON.stringify(DEADLINE_TEMPLATES.find(x=>x.n===38))`));
   return t.term === 'до 1 сентября' && t.base === '1 января' && t.point === '9'; })());

/* 2 · телефонные переговоры, п. 16.2 — вид, ступень хребта и предусловие претензии. */
ok('телефонные переговоры заведены видом досудебного раздела',
   g.ev(`!!kindOf('Телефонные переговоры с заёмщиком')`)
   && g.ev(`sectionOf('Телефонные переговоры с заёмщиком')`) === 'Досудебный'
   && g.ev(`kindOf('Телефонные переговоры с заёмщиком').needsDelivery`) === false);
ok('переговоры вехой не являются — маршрут двигает претензия, а не звонок',
   g.ev(`isMilestone('Телефонные переговоры с заёмщиком')`) === false
   && g.ev(`kindOf('Телефонные переговоры с заёмщиком').outcomes.every(o=>!o.setsPhase && !o.setsTerminal)`));
ok('исход «связь не установлена» существует — недоступный заёмщик взыскание не останавливает',
   g.ev(`kindOf('Телефонные переговоры с заёмщиком').outcomes.some(o=>/связь с заёмщиком не установлена/.test(o.value))`));
ok('первичная претензия требует факта переговоров (п. 16.2), исхода не требует', (()=>{
   const pc = JSON.parse(g.ev(`JSON.stringify(RULES.preconditions['Первичная претензия'])`));
   const f  = (pc.facts||[]).find(x=>x.kinds.includes('Телефонные переговоры с заёмщиком'));
   return !!f && f.point === '16.2' && f.outcome === undefined; })());
ok('гейт претензии без переговоров называет пункт и вид', (()=>{
   const r = g.ev(`(() => {
     const p = PROCESSES.find(x=>x.id==='201');
     p.window.open = false;
     return preconditionReason(REQ_INDEX['201/201/з'], 'Первичная претензия') || '';
   })()`);
   return /Телефонные переговоры с заёмщиком/.test(r) && /п\. 16\.2/.test(r); })());
ok('переговоры стоят первой ступенью хребта и открывают дело в тот же день',
   g.ev(`SPINE[0].kind`) === 'Телефонные переговоры с заёмщиком' && g.ev(`SPINE[0].gap`) === 0
   && g.ev(`SPINE_KEYS[0]`) === 'переговоры');
/* Сверка ПО КРЕДИТУ, не по делу: у многокредитных дел (412 · 402 · 394) цепочки
   независимы, и переговоры одного кредита законно позже претензии другого. Номер
   ступени несёт id кредита — им и связываются пары. */
ok('в затравке переговоры предшествуют претензии по каждому кредиту',
   g.ev(`(() => {
     const all = PROCESSES.flatMap(p=>p.measures||[]);
     const claims = all.filter(m=>m.kind==='Первичная претензия');
     return claims.length > 0 && claims.every(c => {
       const id = c.num.replace(/^ПР-/,'').replace(/\\/1$/,'');
       const t = all.find(m=>m.num === 'ТЛФ-'+id);
       return !!t && ruD(t.dates.event) <= ruD(c.dates.event);
     });
   })()`));
ok('шаблон 5 называет обе обязанности одного срока (п. 16.2)',
   /Телефонные переговоры и первичная претензия/.test(g.ev(`DEADLINE_TEMPLATES.find(x=>x.n===5).action`)));

/* 3 · доказательство доставки — реквизит КАНАЛА, не одна строка на все (п. 16). */
ok('справочник доказательств покрывает все каналы претензий',
   g.ev(`DELIVERY_CHANNELS_CLAIM.every(c => (DELIVERY_PROOF[c]||{}).docs && DELIVERY_PROOF[c].docs.length)`));
ok('СЭД бумажного уведомления не требует, бумажные каналы — требуют',
   g.ev(`DELIVERY_PROOF['СЭД'].paper`) === false
   && g.ev(`DELIVERY_PROOF['Почта'].paper && DELIVERY_PROOF['Нарочно'].paper`)
   && /электронный отчёт СЭД/.test(g.ev(`DELIVERY_PROOF['СЭД'].docs[0]`)));
ok('бумага даёт нормой названную пару — уведомление либо отметка о получении',
   g.ev(`DELIVERY_PROOF['Почта'].docs.length`) === 2
   && /почтовое уведомление о вручении/.test(g.ev(`DELIVERY_PROOF['Почта'].docs[0]`))
   && /отметка заёмщика \(залогодателя\) о получении/.test(g.ev(`DELIVERY_PROOF['Почта'].docs[1]`))
   && g.ev(`DELIVERY_PROOF['Нарочно'].docs.join('')`) === 'отметка заёмщика (залогодателя) о получении');
ok('выдуманных «акта вручения нарочно» и «квитанции СЭД» в данных не осталось',
   g.ev(`PROCESSES.flatMap(p=>p.measures||[]).every(m => !m.served || !/акт вручения нарочно|квитанция СЭД/.test(m.served.doc||''))`)
   && g.ev(`Object.values(DELIVERY_PROOF).every(c => c.docs.every(d => !/акт вручения|квитанция СЭД/.test(d)))`));
ok('умолчание затравки берётся из справочника, а не отдельным литералом',
   g.ev(`DELIVERY_CHANNELS_CLAIM.every(c => deliveryDocFor(c) === DELIVERY_PROOF[c].docs[0])`));
ok('вся затравка вручена документом из набора своего канала',
   g.ev(`PROCESSES.flatMap(p=>p.measures||[]).filter(m=>m.served && m.served.doc)
          .every(m => deliveryProofsFor(m.sent && m.sent.channel).includes(m.served.doc))`));
ok('поле документа — справочник канала, а не свободный текст', (()=>{
   const m = mk();
   m.ev(`openDetail('317/317/з'); (()=>{ const i=curProc.measures.findIndex(x=>x.kind==='Первичная претензия'); openAnnotationModal(i); })()`);
   const sel = m.doc.getElementById('aServedDoc');
   const opts = [...sel.options].map(o=>o.value).filter(Boolean);
   m.ev(`document.getElementById('aChannel').value='СЭД'; onDeliveryChannelChange()`);
   const sed = [...m.doc.getElementById('aServedDoc').options].map(o=>o.value).filter(Boolean);
   return sel.tagName === 'SELECT' && opts.length > 0
       && sed.length === 1 && /электронный отчёт СЭД/.test(sed[0])
       && /СЭД/.test(m.doc.getElementById('aProofNote').textContent); })());
ok('вручение без документа не сохраняется', (()=>{
   const m = mk();
   const i = m.ev(`openDetail('317/317/з'); curProc.measures.findIndex(x=>x.kind==='Первичная претензия')`);
   const before = m.ev(`JSON.stringify(curProc.measures[${i}].served)`);
   m.ev(`openAnnotationModal(${i})`);
   m.doc.getElementById('aServedDate').value = '2026-07-18';
   m.doc.getElementById('aServedDoc').value = '';
   m.doc.getElementById('aReason').value = 'проверка гарда';
   m.ev(`saveAnnotation(${i})`);
   return m.ev(`JSON.stringify(curProc.measures[${i}].served)`) === before; })());

/* 4 · направление ≠ вручение: срок должника от направления, пакет ДПО — от вручения. */
ok('ось вручения ссылается на п. 20.1, а не на п. 19.2 (там о вручении нет ни слова)',
   !/не подтверждено \(п\. 19\.2\)/.test(HTML) && !/вручения <b>\$\{bad\}<\/b> \(п\. 19\.2\)/.test(HTML)
   && /не подтверждено \(п\. 20\.1\)/.test(HTML));
ok('«мера не исполнена» из-за невручения больше нигде не утверждается',
   !/не исполнена: нет подтверждения вручения/.test(HTML));
ok('записка в ДПО требует вручённой претензии (п. 20.1)', (()=>{
   const pc = JSON.parse(g.ev(`JSON.stringify(RULES.preconditions['Служебная записка в ДПО'])`));
   return !!pc.servedKinds && pc.servedKinds.point === '20.1'
       && pc.servedKinds.kinds.join('|') === 'Первичная претензия|Повторная претензия'; })());
ok('снятое вручение закрывает записку в ДПО и называет причину', mk().ev(`(() => {
  const p = PROCESSES.find(x=>x.id==='317'), r = REQ_INDEX['317/317/з'];
  const cl = p.measures.find(m=>m.kind==='Повторная претензия'), pr = p.measures.find(m=>m.kind==='Первичная претензия');
  const было = preconditionReason(r, 'Служебная записка в ДПО');
  delete cl.served; delete pr.served;
  const стало = preconditionReason(r, 'Служебная записка в ДПО') || '';
  return было === null && /вручени/.test(стало) && /п\\. 20\\.1/.test(стало);
})()`));
ok('срок должника по-прежнему считается от направления, вручения не спрашивает',
   g.ev(`DEADLINE_TEMPLATES.find(x=>x.n===6).base`) === 'дата направления'
   && g.ev(`DEADLINE_TEMPLATES.find(x=>x.n===8).base`) === 'дата направления'
   && g.ev(`DEADLINE_TEMPLATES.every(t => !/вручен/i.test(t.base))`));

/* 5 + 6 · группы платёжеспособности — закрытый справочник нормы; п. 14 даёт базовую. */
ok('групп ровно девять, все с кодом, именем и пунктом',
   g.ev(`PAY_GROUPS.length`) === 9
   && g.ev(`PAY_GROUPS.every(x => x.code && x.name && x.point)`)
   && g.ev(`PAY_GROUPS.map(x=>x.code).join(' ')`) === '1.1 2.1 2.2 2.3 3.1 3.2 4 5.1 5.2');
ok('имена групп — нормы, не наши', (()=>{
   const n = c => g.ev(`PAY_GROUP_BY_CODE['${c}'].name`);
   return n('1.1') === 'Производят погашение по графику' && n('2.1') === 'Работа с судебными органами'
       && n('2.2') === 'Проводится работа по исполнительным листам' && n('2.3') === 'Работа по инициированию банкротства'
       && n('3.1') === 'Проводится процедура банкротства' && n('3.2') === 'Процедура банкротства завершена'
       && n('4') === 'Безнадёжные долги' && n('5.1') === 'Погашенные' && n('5.2') === 'Списанные'; })());
ok('всякая выведенная группа — из справочника, имён стадий среди них нет',
   g.ev(`PROCESSES.map(groupOf).filter(Boolean).every(c => !!PAY_GROUP_BY_CODE[c])`)
   && g.ev(`PROCESSES.map(groupOf).every(c => !Object.keys(STAGE_RANK).includes(c))`));
/* П. 14 — «при первичном внесении сведений заёмщику автоматически присваивается статус
   «Группа 1.1»»; следующий перевод норма называет только на иске (п. 21). Отсюда 1.1 и
   у наблюдения, и у досудебной работы, и у дела без открытых требований. */
ok('досудебная работа и наблюдение читаются как 1.1 (п. 14 присвоил, п. 21 переведёт)',
   g.ev(`STAGE_GROUP['Наблюдение']`) === '1.1' && g.ev(`STAGE_GROUP['Досудебный порядок']`) === '1.1'
   && g.ev(`STAGE_GROUP['Судебный порядок']`) === '2.1'
   && g.ev(`STAGE_GROUP['Исполнительное производство']`) === '2.2');
ok('банкротство разведено: инициирование 2.3, признание 3.1',
   g.ev(`BANKRUPTCY_GROUP['Инициирование банкротства']`) === '2.3'
   && g.ev(`BANKRUPTCY_GROUP['Признание банкротом']`) === '3.1');
ok('завершённое банкротство больше не «безнадёжное», списание — своя группа',
   g.ev(`TERMINAL_GROUP['Завершена процедура банкротства']`) === '3.2'
   && g.ev(`TERMINAL_GROUP['Признана безнадёжной']`) === '4'
   && g.ev(`TERMINAL_GROUP['Списана']`) === '5.2'
   && g.ev(`TERMINAL_GROUP['Полное погашение']`) === '5.1');
ok('подпись группы несёт и код, и имя — во всех читателях одна функция',
   g.ev(`payGroupLabel('2.2')`) === '2.2 Проводится работа по исполнительным листам'
   && g.ev(`payGroupLabel('9.9')`) === null
   && (HTML.match(/groupLabelOf\(/g)||[]).length >= 5);
/* Две группы справочника недостижимы, и до разведки 05.08.2026 здесь стояла неверная
   причина: «у затравки нет ни одного дела с таким терминалом». Дела есть, и не два, а
   ВОСЕМЬ. terminalCandidateOf возвращает «Признана безнадёжной» на 370/371 (ликвидация),
   372/373 (умерший) и 375/376 (приговор) и «Списана» на 377/378. Все восемь отсекает
   вторая половина outcomeOf: tracksClosedFor === false — судебный и исполнительный треки
   дела не закрыты, требование закрытым не считается, дело валится в 2.2.
   Это расхождение ПО СУЩЕСТВУ, а не дыра данных: дело с актом Кабинета Министров о
   списании числится в группе «2.2. Проводится работа по исполнительным листам».
   097/379 (`K7-КОМИССИЯ`) сюда не относятся и терминала законно не имеют — заключение у
   них ещё «на рассмотрении», меры нет вовсе. */
ok('затравка достаёт семь групп из девяти — 4 и 5.2 недостижимы',
   g.ev(`[...new Set(PROCESSES.map(groupOf).filter(Boolean))].sort().join(' ')`)
     === '1.1 2.1 2.2 2.3 3.1 3.2 5.1');
ok('причина одна на обе группы — незакрытые треки, а не отсутствие дел',
   g.ev(`(() => { const blocked = PROCESSES.flatMap(p => (p.requirements||[])
       .filter(r => ['Признана безнадёжной','Списана'].includes(terminalCandidateOf(r)))
       .map(r => ({ id:p.id, tracks:tracksClosedFor(r), grp:groupOf(p) })));
     return blocked.length === 8 && blocked.every(x => x.tracks === false && x.grp === '2.2')
       && [...new Set(blocked.map(x=>x.id))].sort().join(' ') === '370 371 372 373 375 376 377 378'; })()`));
ok('дела на рассмотрении комиссии терминала законно не имеют — их в счёт не берём',
   g.ev(`['097','379'].every(id => PROCESSES.find(x=>x.id===id).requirements.every(r => terminalCandidateOf(r) === null))`));
ok('следствие видно в реестре: дело с актом о списании числится по исполнительным листам',
   g.ev(`groupOf(PROCESSES.find(x=>x.id==='377'))`) === '2.2'
   && g.ev(`(PROCESSES.find(x=>x.id==='377').measures||[]).some(m=>/о списании/.test(m.kind) && m.outcome==='списана')`));

/* 7 · второе основание паузы п. 17 — риски срыва программ. */
ok('оснований паузы по п. 17 два, предмет у них один — безакцепт',
   g.ev(`PAUSE_KINDS.has('program_risk')`)
   && g.ev(`PAUSE_SCOPE.program_risk.point`) === '17'
   && g.ev(`[...PAUSE_SCOPE.program_risk.kinds].sort().join('|') === [...PAUSE_SCOPE.guarantee_letter.kinds].sort().join('|')`));
ok('70 к.д. привязаны к письму — у рисков срыва программ предела норма не назвала',
   g.ev(`PAUSE_TYPES.find(t=>t.type==='guarantee_letter').limit`) === 70
   && g.ev(`PAUSE_TYPES.find(t=>t.type==='restructuring').limit`) === 70
   && g.ev(`PAUSE_TYPES.find(t=>t.type==='program_risk').limit`) === null);
ok('решение комитета обязательно для обоих оснований п. 17',
   g.ev(`PAUSE_TYPES.filter(t=>t.point==='17').every(t=>t.needsDecision)`)
   && g.ev(`PAUSE_TYPES.filter(t=>t.point==='17').length`) === 2);
ok('затравка несёт обе стороны развилки комитета на новом основании', (()=>{
   const st = k => g.ev(`(() => {
     const r = PROCESSES.find(p=>p.id==='${k}').requirements[0];
     const s = (r.states||[]).find(x=>x.kind==='program_risk');
     return s ? s.committee + ' | ' + ((ruD(s.until)-ruD(s.since))/864e5) : '';
   })()`);
   const a = st('328'), b = st('329');
   return /Комитет по региональному развитию/.test(a) && /Комитет по администрированию бюджетных кредитов/.test(b)
       && Number(a.split('| ')[1]) > 70 && Number(b.split('| ')[1]) > 70; })());
ok('пауза по рискам блокирует безакцепт и не трогает претензии',
   g.ev(`measureGate(REQ_INDEX['328/328/з'], 'Безакцептное списание').kind`) === 'pause'
   && g.ev(`(measureGate(REQ_INDEX['328/328/з'], 'Исковое заявление')||{}).kind !== 'pause'`));
ok('своя подпись у нового основания есть в таблице состояний и в пилюле реестра',
   g.ev(`STATE_LABEL.program_risk`) === 'Отсрочка по рискам срыва программ (п. 17)'
   && g.ev(`PAUSE_PILL.program_risk`) === 'риски срыва программ');

/* ============================================================
   ADR-0079 · КАССАЦИОННАЯ ВЕТВЬ — акт, основание жалобы и второй разворот слоя.
   `ADR-0071` завёл обе кассационные ЖАЛОБЫ и сознательно оставил парный АКТ на разбор:
   «заводить одинокий акт без разбора значило бы гадать о его исходах и о том, что они
   делают со слоем». Разбор проведён — проверки ниже держат обе его половины: справочник
   (вид, основания, пять исходов) и деньги (восстановление против отмены). */
head('ADR-0079 · кассационная ветвь');

// 1. Справочник
ok('парный акт кассации заведён — внешний акт поверх обеих кассационных жалоб',
   g.ev(`(() => { const k = kindOf('Постановление кассационной инстанции');
     return !!k && k.source === 'внешний акт' && k.resultIsDocument === false
       && k.basisKinds.join(' / ') === 'Кассационная жалоба / Кассационная жалоба заёмщика'; })()`));
ok('исходов пять — четыре зеркальны апелляционным, пятый свой',
   g.ev(`kindOf('Постановление кассационной инстанции').outcomes.map(o=>o.value).join(' | ')`)
   === 'оставлено в силе | изменено | апелляция отменена, решение первой инстанции в силе | отменено, на новое рассмотрение | отменено, в иске отказано');
ok('маршрут исходов тот же, что у апелляции: пересмотр по существу держит «Решение суда», отмена откатывает на «Иск»',
   g.ev(`kindOf('Постановление кассационной инстанции').outcomes.filter(o=>o.setsPhase==='Решение суда').length === 3
      && kindOf('Постановление кассационной инстанции').outcomes.filter(o=>o.setsPhase==='Иск').length === 2`));
/* Не про формулировку, а про условие: `isReviewReversal` узнаёт отмену по префиксу
   «отменено», и восстанавливающий исход обязан под него НЕ попасть — иначе слой погаснет
   там, где норма его сохраняет. Переименуют исход неосторожно — падает здесь, а не в
   деньгах через две волны. */
ok('восстанавливающий исход не читается общей отменой',
   g.ev(`isReviewReversal({kind:CASSATION_ACT_KIND, outcome:CASSATION_RESTORE_OUTCOME}) === false
      && isCassationRestore({kind:CASSATION_ACT_KIND, outcome:CASSATION_RESTORE_OUTCOME}) === true
      && isReviewReversal({kind:CASSATION_ACT_KIND, outcome:'отменено, на новое рассмотрение'}) === true`));
ok('актов пересмотра ровно два и оба судебного раздела',
   g.ev(`REVIEW_ACT_KINDS.size === 2 && [...REVIEW_ACT_KINDS].every(k=>KIND_SECTION[k]==='Судебный')`));
ok('ни один акт пересмотра слоя не заводит — только правит существующий',
   g.ev(`[...REVIEW_ACT_KINDS].every(k=>!AWARD_KINDS.has(k) && !AWARD_DEATH_KINDS.has(k))`));

// 2. Основание нашей кассационной жалобы (п. 30.3)
/* Справочник противоречил собственному шаблону срока: тпл 28 отсчитывал три месяца от
   акта апелляционной инстанции, а вид разрешал кассацию прямо на решение первой. */
ok('кассационная жалоба идёт на акт апелляционной инстанции, а не на решение первой (п. 30.3)',
   g.ev(`kindOf('Кассационная жалоба').basisKinds.join('/')`) === 'Постановление апелляционной инстанции'
   && g.ev(`kindOf('Кассационная жалоба заёмщика').basisKinds.join('/')`) === 'Постановление апелляционной инстанции');
ok('вид и шаблон срока называют одно и то же основание',
   g.ev(`(() => { const t = DEADLINE_TEMPLATES.find(x=>x.n===28);
     return t.point === '30.3' && /акта апелляционной инстанции/.test(t.base)
       && kindOf('Кассационная жалоба').basisKinds.includes(APPEAL_ACT_KIND); })()`));

// 3. Деньги — восстановление против отмены
/* Дело 346: решение первой инстанции присудило 300 000, апелляция ЗАМЕНИЛА присуждение
   на 180 000 ('corrects', МП-2), кассация отменила апелляцию. Слой обязан вернуться к
   акту первой инстанции — не к 180 000 (тогда восстановление ничего не делает) и не в
   null (тогда оно читается общей отменой). */
ok('до кассации слой был апелляционным — правка 180 000 отношением corrects',
   g.ev(`(() => { const p = PROCESSES.find(x=>x.id==='346');
     const pa = p.measures.find(m=>m.num==='ПА-346'); const a = pa.awards['346/346/з'];
     return pa.outcome === 'изменено' && a.principal === 180000
       && a.relation.type === 'corrects' && a.relation.of === 'РС-346'; })()`));
ok('кассационное восстановление возвращает слой акту первой инстанции, а не гасит его',
   g.ev(`(() => { const p = PROCESSES.find(x=>x.id==='346'); const L = layerOf(p, '346');
     return !!L && L.sum === 300000 && L.act.num === 'РС-346' && L.correctedBy === null; })()`));
ok('в пуле свёртки восстановление убирает себя и апелляцию, решение оставляет',
   g.ev(`(() => { const p = PROCESSES.find(x=>x.id==='346');
     const chain = ['РС-346','ПА-346','ПК-346'].map(n=>p.measures.find(m=>m.num===n));
     return dropRestoredAppeals(chain).map(m=>m.num).join(',') === 'РС-346'; })()`));
ok('обычная кассационная отмена слой гасит и откатывает фазу на «Иск»',
   g.ev(`(() => { const p = PROCESSES.find(x=>x.id==='347');
     return layerOf(p, '347') === null && phaseOf(p.requirements[0]) === 'Иск'; })()`));
/* Сверка «требовали → присудили» ходит по basedOn ОТДЕЛЬНОЙ свёрткой (claimChainsFor) —
   она обязана прийти к тому же акту, что layerOf, иначе карточка и деньги разойдутся.
   `ADR-0080`: снимается на ЖИВЫХ данных — до этой волны `m.claims` не нёс ни один из 101
   дела, и проверка стояла на подставленном объекте с откатом (единственное, чем её тогда
   можно было поднять). Затравка получила опцию claimed на пяти исках, поэтому подстановки
   больше нет: расходись свёртки — провалится на настоящем деле. */
ok('сверка «требовали → присудили» ходит той же свёрткой, что и слой',
   g.ev(`(() => { const r = REQ_INDEX['346/346/з'];
     const ch = claimChainsFor(r).filter(x=>x.award);
     return ch.length === 1 && ch[0].root.num === 'ИСК-346' && ch[0].award.num === 'РС-346'; })()`));
ok('требуемое по статьям несут ровно пять исков затравки — по одному на состояние сверки',
   g.ev(`(() => { const withClaims = PROCESSES.flatMap(p=>(p.measures||[]).filter(m=>m.claims).map(m=>m.num));
     return withClaims.sort().join(',') === 'ИСК-332,ИСК-346,ИСК-347,ИСК-366,ИСК-367'; })()`));
ok('иск без присуждения даёт цепочку с пустой правой колонкой, а не пустую сверку',
   g.ev(`(() => { const r = REQ_INDEX['332/332/з']; const ch = claimChainsFor(r);
     return ch.length === 1 && ch[0].root.num === 'ИСК-332' && ch[0].award === null
       && ch[0].root.claims[r.id].principal === 264000; })()`));
ok('экран сверки на живой затравке рисует таблицу, а не заглушку «сверять пока нечего»',
   g.ev(`(() => { const html = claimsReconcileHtml(REQ_INDEX['346/346/з']);
     return /<table/.test(html) && !/сверять пока нечего/.test(html)
       && /сверять пока нечего/.test(claimsReconcileHtml(REQ_INDEX['330/330/з'])); })()`));

// 4. Границы затравки — названы, чтобы не сойти за полноту
ok('присуждение на судебном акте несут четыре дела — кассационная ветвь и жалоба заёмщика',
   g.ev(`(() => { const withAward = PROCESSES.flatMap(p=>(p.measures||[]).filter(m=>m.kind==='Решение суда' && m.awards).map(m=>m.num));
     return withAward.sort().join(',') === 'РС-346,РС-347,РС-366,РС-367'; })()`));
ok('кассационного акта без апелляционного в затравке нет — кассация возможна только поверх апелляции',
   g.ev(`PROCESSES.every(p => { const ms = p.measures||[];
     return !ms.some(m=>m.kind===CASSATION_ACT_KIND) || ms.some(m=>m.kind===APPEAL_ACT_KIND); })`));

head('ADR-0080 · жалоба заёмщика, возражение и требуемое по статьям');

// 1. Справочник — зеркало нашей ветки, не копия
ok('граница жалобы заёмщика взята из справочника исходов, а не написана строкой',
   g.ev(`REJECTED_VERDICT === 'в иске отказано'
     && kindOf('Решение суда').outcomes.some(o=>o.value === REJECTED_VERDICT)`));
ok('основания жалоб заёмщика зеркальны нашим — решение и акт апелляции',
   g.ev(`JSON.stringify(kindOf('Апелляционная жалоба заёмщика').basisKinds) === JSON.stringify(['Решение суда'])
     && JSON.stringify(kindOf('Кассационная жалоба заёмщика').basisKinds) === JSON.stringify([APPEAL_ACT_KIND])`));
ok('оба возражения — НАШ документ на основании жалобы ЗАЁМЩИКА',
   g.ev(`['Возражение на апелляционную жалобу','Возражение на кассационную жалобу'].every(n => {
     const k = kindOf(n); return k.source === 'наш документ' && k.basisKinds.length === 1
       && /жалоба заёмщика/.test(k.basisKinds[0]); })`));
/* П. 30.4/30.5 дают обязанность возразить и НЕ дают срока («в соответствии с процессуальным
   законодательством») — шаблона поэтому нет ни одного, и это условие, а не пропуск (ADR-0068). */
ok('у возражения срока в справочнике нет — норма его не назначает',
   g.ev(`DEADLINE_TEMPLATES.every(t => !/озражени/.test(t.action + ' ' + t.base))`));

// 2. Маршрут: жалоба заёмщика → наше возражение → акт инстанции
ok('дело 366 несёт полную цепочку п. 30.4 — жалоба заёмщика, возражение, акт апелляции',
   g.ev(`(() => { const ms = PROCESSES.find(p=>p.id==='366').measures;
     const n = k => (ms.find(m=>m.kind===k)||{}).num;
     return n('Апелляционная жалоба заёмщика') === 'АЖЗ-366'
       && n('Возражение на апелляционную жалобу') === 'ВАЖ-366'
       && n(APPEAL_ACT_KIND) === 'ПА-366'; })()`));
/* Акт выносится ПО ЖАЛОБЕ; возражение — довод в том же деле, а не основание акта.
   Если basedOn уедет на возражение, цепочка оснований разорвётся: у возражения свой корень. */
ok('акт инстанции ссылается на жалобу заёмщика, а не на наше возражение',
   g.ev(`(() => { const ms = PROCESSES.find(p=>p.id==='366').measures;
     const pa = ms.find(m=>m.num==='ПА-366'), vaj = ms.find(m=>m.num==='ВАЖ-366');
     return pa.basedOn === 'АЖЗ-366' && vaj.basedOn === 'АЖЗ-366'; })()`));
ok('кассационная ветвь заёмщика ссылается на акт апелляции (п. 30.5), а не на решение',
   g.ev(`(() => { const ms = PROCESSES.find(p=>p.id==='367').measures;
     const kjz = ms.find(m=>m.num==='КЖЗ-367'), vkj = ms.find(m=>m.num==='ВКЖ-367'), pk = ms.find(m=>m.num==='ПК-367');
     return kjz.basedOn === 'ПА-367' && vkj.basedOn === 'КЖЗ-367' && pk.basedOn === 'КЖЗ-367'; })()`));
ok('обязанность возразить поднята на КАЖДОЙ жалобе заёмщика затравки, а не на образцовой',
   g.ev(`PROCESSES.every(p => (p.measures||[]).every(m => {
     if(!/^(Апелляционная|Кассационная) жалоба заёмщика$/.test(m.kind)) return true;
     const answer = m.kind === 'Апелляционная жалоба заёмщика'
       ? 'Возражение на апелляционную жалобу' : 'Возражение на кассационную жалобу';
     return (p.measures||[]).some(x => x.kind === answer && x.basedOn === m.num); }))`));
ok('жалобы заёмщика зарегистрированы как внешний акт с исходом «подана»',
   g.ev(`PROCESSES.flatMap(p=>p.measures||[]).filter(m=>/жалоба заёмщика$/.test(m.kind))
     .every(m => m.outcome === 'подана' && !!m.received && !!m.received.date)`));

// 3. Полярность повода — обратная нашей
ok('п. 30.4: жалоба заёмщика стоит только там, где иск удовлетворён',
   g.ev(`PROCESSES.every(p => { const ms = p.measures||[];
     if(!ms.some(m=>m.kind==='Апелляционная жалоба заёмщика')) return true;
     const rs = ms.find(m=>m.kind==='Решение суда');
     return !!rs && rs.outcome !== REJECTED_VERDICT; })`));
ok('на одном решении затравка держит жалобу одной стороны — цепочки не смешаны',
   g.ev(`PROCESSES.every(p => { const ms = p.measures||[];
     return !(ms.some(m=>m.kind==='Апелляционная жалоба') && ms.some(m=>m.kind==='Апелляционная жалоба заёмщика')); })`));

// 4. Деньги: чужая жалоба слоя не двигает, чужая отмена — гасит
ok('апелляция по жалобе заёмщика слоя не заводит — он остаётся на акте первой инстанции',
   g.ev(`(() => { const L = layerOf(PROCESSES.find(p=>p.id==='366'), '366');
     return !!L && L.sum === 240000 && L.act.num === 'РС-366' && L.correctedBy === null; })()`));
ok('кассация по жалобе заёмщика отменяет так же, как наша — слой гаснет, фаза откатывается',
   g.ev(`(() => { const p = PROCESSES.find(x=>x.id==='367');
     return layerOf(p, '367') === null && phaseOf(p.requirements[0]) === 'Иск'; })()`));
ok('после отмены сверка обрывается актом отмены — правая колонка пуста, а не нулевая',
   g.ev(`(() => { const r = REQ_INDEX['367/367/з']; const ch = claimChainsFor(r);
     return ch.length === 1 && ch[0].award.num === 'ПК-367'
       && !effectiveAward(r._proc.measures, ch[0].award, r.id); })()`));

console.log(`\nОШИБОК КОНСОЛИ (jsdomError): ${g.errs.length}`);
g.errs.forEach(e => console.log('  ' + e));
console.log(`ВСЕГО ПРОВЕРОК: ${n} · ПРОВАЛЕНО: ${fails}`);
process.exit(fails || g.errs.length ? 1 : 0);
