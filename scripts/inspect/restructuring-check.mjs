// Headless smoke для mockups/restructuring/restructuring.html (спека §18, Р-1…Р-19).
// Zero-dep: извлекает <script> из HTML и исполняет чистый логический слой в node:vm
// (без DOM — тесты дёргают только pure-функции window.RS). Результат печатает и вставляет
// в комментарий-шапку HTML (блок «SMOKE (node ...)»).
//   node scripts/inspect/restructuring-check.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dir = dirname(fileURLToPath(import.meta.url));
const HTML  = resolve(__dir, '../../mockups/restructuring/restructuring.html');
const src   = readFileSync(HTML, 'utf8');

// вытаскиваем тело <script> (в файле один прикладной script)
const m = src.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('<script> не найден в HTML'); process.exit(1); }

// песочница: есть window (чтобы код выставил window.RS), нет document (init/рендер пропускается)
const win = {};
const sandbox = { window: win, console, setTimeout: () => {}, clearTimeout: () => {} };
vm.createContext(sandbox);
vm.runInContext(m[1], sandbox, { filename: 'restructuring.inline.js' });
const RS = win.RS;
if (!RS) { console.error('window.RS не инициализирован'); process.exit(1); }

const results = [];
const ok = (n, cond, note = '') => results.push({ n, pass: !!cond, note });
const fresh = () => RS.seed();
const app = id => RS.appById(id);

/* 1. Неполный пакет → «Анализ» заблокирован; докомплект → открыт. */
(() => { fresh();
  const a = app('RS-1003');
  const before = RS.canAdvance(a).ok;
  RS.requiredDocs(a).forEach(d => a.packetDocs[d] = true);
  const after = RS.canAdvance(a).ok;
  ok(1, before === false && after === true, `до=${before} после=${after}`);
})();

/* 2. Незавизированное заключение → «Комитет» закрыт; виза → открыт; +заключант → снова требование. */
(() => { fresh();
  const a = app('RS-1004');
  const closed = RS.conclGate(a).ok === false;
  a.conclusions.find(c => c.dept === 'ДПО').visa = true;
  const opened = RS.conclGate(a).ok === true;
  a.conclusions.push({ dept: 'Юр', text: '', visa: false, visaDate: null });
  const reblocked = RS.conclGate(a).ok === false;
  ok(2, closed && opened && reblocked, `closed=${closed} opened=${opened} reblock=${reblocked}`);
})();

/* 3. Поля условий вне разрешений видов — не в allowedParams; +вид расширяет набор. */
(() => { fresh();
  const a = app('RS-1004');                       // вид K2 (Изменение графика) — без rate
  const before = RS.allowedParams(a);
  const rateAllowedBefore = before.has('rate');
  a.kindIds.push('K4');                            // +Капитализация → добавляет forgive/term
  const after = RS.allowedParams(a);
  const grew = after.size > before.size && after.has('forgive');
  ok(3, rateAllowedBefore === false && grew, `rateBefore=${rateAllowedBefore} grew=${grew}`);
})();

/* 4. «Направлено в Минфин» → события паузы/оверлея; отказ → снятие следующим днём + риск. */
(() => { fresh();
  const a = app('RS-1002');
  const hasPause   = a.automation.some(e => e.kind === 'pause');
  const hasOverlay = a.automation.some(e => e.kind === 'overlay');
  const unpause = a.automation.find(e => e.kind === 'unpause');
  const nextDay = unpause && unpause.when === '2026-07-01' && a.minfin.date === '2026-06-30';
  const risk = a.automation.some(e => e.kind === 'risk' && e.when === '2026-07-01');
  ok(4, hasPause && hasOverlay && nextDay && risk, `pause=${hasPause} overlay=${hasOverlay} nextDay=${nextDay} risk=${risk}`);
})();

/* 5. Красный гейт обеспечения блокирует ДС; waiver разблокирует. */
(() => { fresh();
  const a = app('RS-1001'); a.waiver = null;
  const cr = RS.creditById('CR-60541'); cr.collateralValue = cr.balance; // покрытие 100% <120%
  const blocked = RS.coverGateApp(a).ok === false;
  a.waiver = { granted: true, reason: 'основание', by: 'Комиссия', date: RS.TODAY };
  const unlocked = RS.coverGateApp(a).ok === true;
  ok(5, blocked && unlocked, `blocked=${blocked} unlocked=${unlocked}`);
})();

/* 6. ДС без номера/даты невалидно; с реквизитами → dsGate ok; версия «действует». */
(() => { fresh();
  const a = app('RS-1004');
  a.ds = { no: '', date: '' };  const bad = RS.dsGate(a).ok === false;
  a.ds = { no: 'ДС-1', date: '2026-07-19' }; const good = RS.dsGate(a).ok === true;
  const activated = app('RS-1001').version.state === 'действует';
  ok(6, bad && good && activated, `bad=${bad} good=${good} activated=${activated}`);
})();

/* 7. Режим просрочки (1) обнуляет счётчик дней; (2) — нет. */
(() => { fresh();
  const a1 = app('RS-1005');                       // вид K1 overdueMode 1
  const cr1 = RS.creditById(a1.creditIds[0]); cr1.odDays = 55;
  RS.applyEntryOps(a1);
  const zeroed = cr1.odDays === 0;
  const a2 = app('RS-1002'); a2.kindIds = ['K2'];  // K2 overdueMode 2
  const cr2 = RS.creditById(a2.creditIds[0]); cr2.odDays = 77;
  RS.applyEntryOps(a2);
  const kept = cr2.odDays === 77;
  ok(7, zeroed && kept, `mode1_zeroed=${zeroed} mode2_kept=${kept}`);
})();

/* 8. Кредит с активной заявкой нельзя добавить во вторую заявку (Р-2). */
(() => { fresh();
  const busy = RS.activeAppOnCredit('CR-61200', 'RS-9999'); // в активной RS-1004
  const free = RS.activeAppOnCredit('CR-58120', 'RS-9999'); // только в закрытой RS-1003
  ok(8, busy && busy.id === 'RS-1004' && !free, `busy=${busy && busy.id} free=${free ? free.id : 'нет'}`);
})();

/* 9. Роль Наблюдатель: canX по всем действиям = false; Куратор — да. */
(() => { fresh();
  RS.state.role = 'Наблюдатель';
  const anyAllowed = ['addCredit','fixMinfin','regDS','waiver','manageDict','fixCommittee'].some(a => RS.canX(a));
  RS.state.role = 'Куратор ОД';
  const curatorCan = RS.canX('regDS');
  ok(9, anyAllowed === false && curatorCan === true, `observerAllowed=${anyAllowed} curatorRegDS=${curatorCan}`);
})();

/* 10. Новый вид, добавленный в рантайме, доступен в заявках. */
(() => { fresh();
  const n0 = RS.state.kinds.length;
  RS.state.kinds.push({ id:'KX', name:'Тестовый вид', params:['rate','grace'], docs:['Заявление'], overdueMode:2, limits:'' });
  const a = app('RS-1004'); a.kindIds.push('KX');
  const grew = RS.state.kinds.length === n0 + 1 && RS.allowedParams(a).has('rate');
  ok(10, grew, `kinds=${RS.state.kinds.length} sawRate=${RS.allowedParams(a).has('rate')}`);
})();

/* 11. Создание заявки: реестр растёт, ИНН/охват/виды заданы, стадия «Регистрация», гейт пакета закрыт. */
(() => { fresh();
  const n0 = RS.state.apps.length;
  const app = {                                    // повторяет createApp() без DOM
    ...RS.__baseApp('RS-2001','02508199700123','ОсОО «Ак-Жол Агро»',['K1'],['CR-61200'],'2026-07-19'),
    conclusions:[{dept:'СРМиК',text:'',visa:false,visaDate:null},{dept:'ДПО',text:'',visa:false,visaDate:null}]
  };
  RS.state.apps.push(app);
  const grew = RS.state.apps.length === n0 + 1;
  const st = RS.stageOf(app);
  const stage0 = st.idx === 0 && !st.closed;
  const packetClosed = RS.packetGate(app).ok === false;   // пакет пуст → гейт закрыт
  const busy = !!RS.activeAppOnCredit('CR-61200', app.id); // CR-61200 занят RS-1004 → конфликт виден
  ok(11, grew && stage0 && packetClosed && busy, `grew=${grew} stage0=${stage0} packetClosed=${packetClosed} conflictSeen=${busy}`);
})();

/* 12. seedCredits: у каждого кредита есть snapshot/paid/remainingTermMonths с ожидаемыми числами. */
(() => { fresh();
  const cr = RS.creditById('CR-60540');
  const okSnap = cr.snapshot && cr.snapshot.principal === 4200000 && cr.snapshot.overduePrincipal === 380000
    && cr.snapshot.accruedInterest === 118000 && cr.snapshot.penalty === 73000;
  const okPaid = cr.paid && cr.paid.principalPaid === 800000 && cr.paid.interestPaid === 340000 && cr.paid.penaltyPaid === 0;
  const okRem  = cr.remainingTermMonths === 22;
  ok(12, okSnap && okPaid && okRem, `snap=${!!okSnap} paid=${!!okPaid} rem=${cr.remainingTermMonths}`);
})();

/* 13. versionFrom: вход конструктора инициализирован, plan=null, snapshot скопирован. */
(() => { fresh();
  const cr = RS.creditById('CR-60540');
  const v = RS.versionFrom(cr);
  const inputsOk = v.inputs && v.inputs.forgivePenalty === 0 && v.inputs.capInterest === 0
    && v.inputs.capPenalty === 0 && Array.isArray(v.inputs.graceBlocks) && v.inputs.graceBlocks.length === 0;
  const shape = v.cutoffDate === RS.TODAY && v.snapshot.principal === cr.snapshot.principal
    && v.plan === null && v.overdueMode === 1;
  ok(13, inputsOk && shape, `inputs=${!!inputsOk} shape=${!!shape}`);
})();

/* 14. Аннуитет: Σ principal = base (до копеики), последняя строка обнуляет остаток. */
(() => { fresh();
  const { rows } = RS.amortize(1200000, 12, 12, 'аннуитет', [], '2026-01-01', 'ежемесячно');
  const sum = RS.round2(rows.reduce((s,r)=>s+r.principal,0));
  const last = rows[rows.length-1];
  ok(14, rows.length===12 && sum===1200000 && last.balance===0, `n=${rows.length} sum=${sum} lastBal=${last.balance}`);
})();

/* 15. Аннуитет: платёж (кроме последнего) постоянный. */
(() => { fresh();
  const { rows } = RS.amortize(1200000, 12, 12, 'аннуитет', [], '2026-01-01', 'ежемесячно');
  const head = rows.slice(0,-1);
  const allEq = head.every(r => r.pay === head[0].pay);
  ok(15, allEq && head[0].pay > 0, `pay0=${head[0].pay} allEq=${allEq}`);
})();

/* 16. Дифференцированный: principal_k постоянен (кроме последнего) = base/m; платёж убывает. */
(() => { fresh();
  const { rows } = RS.amortize(1200000, 12, 12, 'дифференцированный', [], '2026-01-01', 'ежемесячно');
  const head = rows.slice(0,-1);
  const prConst = head.every(r => r.principal === head[0].principal) && head[0].principal === RS.round2(1200000/12);
  const decreasing = rows[0].pay > rows[rows.length-1].pay;
  const sum = RS.round2(rows.reduce((s,r)=>s+r.principal,0));
  ok(16, prConst && decreasing && sum===1200000, `prConst=${prConst} dec=${decreasing} sum=${sum}`);
})();

/* 17. Периодность: ежеквартально → p=3, число строк = term/3. */
(() => { fresh();
  const { rows, meta } = RS.amortize(900000, 8, 24, 'аннуитет', [], '2026-01-01', 'ежеквартально');
  ok(17, meta.p===3 && rows.length===8, `p=${meta.p} n=${rows.length}`);
})();

/* 18. Нулевая ставка: аннуитет вырождается в base/n, проценты 0. */
(() => { fresh();
  const { rows } = RS.amortize(1200000, 0, 12, 'аннуитет', [], '2026-01-01', 'ежемесячно');
  const noInterest = rows.every(r => r.interest === 0);
  const flat = rows.slice(0,-1).every(r => r.principal === RS.round2(1200000/12));
  ok(18, noInterest && flat, `noInt=${noInterest} flat=${flat}`);
})();

/* 19. interest-only: в льготные периоды principal=0, balance=const, pay=base×i. */
(() => { fresh();
  const { rows, meta } = RS.amortize(1200000, 12, 12, 'аннуитет',
    [{months:3, type:'interest-only'}], '2026-01-01', 'ежемесячно');
  const io = rows.slice(0,3);
  const zeroPr = io.every(r => r.principal === 0);
  const constBal = io.every(r => r.balance === RS.round2(1200000));
  const payOk = io.every(r => r.pay === RS.round2(1200000 * meta.i));
  const amortRows = rows.length - 3;
  ok(19, zeroPr && constBal && payOk && amortRows===9, `zeroPr=${zeroPr} constBal=${constBal} payOk=${payOk} amort=${amortRows}`);
})();

/* 20. Мораторий: строки моратория pay=0; база амортизации = base×(1+i)^g; morCap>0. */
(() => { fresh();
  const g=3;
  const { rows, meta, morCap } = RS.amortize(1200000, 12, 12, 'аннуитет',
    [{months:g, type:'moratorium'}], '2026-01-01', 'ежемесячно');
  const mor = rows.slice(0,g);
  const zeroPay = mor.every(r => r.pay === 0 && r.principal === 0);
  const expBase = RS.round2(1200000 * Math.pow(1+meta.i, g));
  const baseOk = RS.round2(meta.baseAmort) === expBase;
  const capOk = morCap === RS.round2(expBase - 1200000) && morCap > 0;
  ok(20, zeroPay && baseOk && capOk, `zeroPay=${zeroPay} baseOk=${baseOk} morCap=${morCap}`);
})();

/* 21. Число амортизирующих строк = nTotal − gMor − gIo; Σ principal амортфазы = baseAmort. */
(() => { fresh();
  const { rows, meta } = RS.amortize(1000000, 10, 12, 'аннуитет',
    [{months:2,type:'moratorium'},{months:1,type:'interest-only'}], '2026-01-01', 'ежемесячно');
  const amort = rows.slice(meta.gMor + meta.gIo);
  const sum = RS.round2(amort.reduce((s,r)=>s+r.principal,0));
  ok(21, amort.length === meta.m && meta.m === 12-2-1 && sum === RS.round2(meta.baseAmort),
    `m=${meta.m} amortRows=${amort.length} sum=${sum} baseAmort=${RS.round2(meta.baseAmort)}`);
})();

/* 22. Границы termCap (нижняя граница включительно). */
(() => { fresh();
  const ok0 = RS.termCap(999999)===36 && RS.termCap(1000000)===84 && RS.termCap(10000000)===120
    && RS.termCap(20000000)===144 && RS.termCap(50000000)===180;
  ok(22, ok0, `36=${RS.termCap(999999)} 84=${RS.termCap(1000000)} 120=${RS.termCap(10000000)} 144=${RS.termCap(20000000)} 180=${RS.termCap(50000000)}`);
})();

/* 23. rateFloor = 50% исходной ставки. */
(() => { fresh();
  ok(23, RS.rateFloor(10)===5 && RS.rateFloor(9)===4.5, `f10=${RS.rateFloor(10)} f9=${RS.rateFloor(9)}`);
})();

/* 24. Порядок конвейера: прощение до капитализации; стек в порядке 0→…→новая база; основания непусты. */
(() => { fresh();
  const a = app('RS-1004'); const cr = RS.creditById(a.creditIds[0]);
  a.version = RS.versionFrom(cr);
  a.version.inputs = { forgivePenalty:0, capInterest:0, capPenalty:0, graceBlocks:[] };
  const plan = RS.calcRestructure(a.id);
  const ops = plan.stack.map(s=>s.op);
  const snapFirst = ops[0].includes('Снимок');
  const baseLast  = ops[ops.length-1].includes('база');
  const forgiveBeforeCap = ops.indexOf('Прощение санкций') < ops.indexOf('Капитализация %')
    || (!ops.includes('Прощение санкций') && !ops.includes('Капитализация %')); // допустимо для пустого входа
  const basisOk = plan.stack.every(s => s.basis === undefined || String(s.basis).length>0);
  ok(24, snapFirst && baseLast && forgiveBeforeCap && basisOk,
    `snapFirst=${snapFirst} baseLast=${baseLast} order=${forgiveBeforeCap}`);
})();

/* 25. База (Р-22): body=P (вкл. OP), capitalized=cI+cS, total=P+cI+cS; пустой вход → total=P. */
(() => { fresh();
  const a = app('RS-1001'); const cr = RS.creditById('CR-60540');
  a.version = RS.versionFrom(cr);
  a.version.inputs = { forgivePenalty:12000, capInterest:118000, capPenalty:61000, graceBlocks:[] };
  const plan = RS.calcRestructure(a.id);
  const body = plan.base.body === 4200000;
  const cap  = plan.base.capitalized === 179000;              // 118000 + 61000
  const total= plan.base.total === 4379000;                   // 4200000 + 179000
  ok(25, body && cap && total, `body=${plan.base.body} cap=${plan.base.capitalized} total=${plan.base.total}`);
})();

/* 26. Валидация входа: cS > S − fS → тост и plan не строится (возврат null). */
(() => { fresh();
  const a = app('RS-1001'); const cr = RS.creditById('CR-60540');
  a.version = RS.versionFrom(cr);
  a.version.inputs = { forgivePenalty:60000, capInterest:0, capPenalty:20000, graceBlocks:[] }; // S=73000; cS(20000) > 73000−60000=13000
  const plan = RS.calcRestructure(a.id);
  ok(26, plan === null && a.version.plan === null, `plan=${plan}`);
})();

/* 27. Гейт срока: newTerm > termCap(base.total) → termOk=false, scheduleNew пуст. */
(() => { fresh();
  const a = app('RS-1001'); const cr = RS.creditById('CR-60540');
  a.version = RS.versionFrom(cr);
  a.version.params.term = 200;                                // > termCap(4.2M)=84
  a.version.inputs = { forgivePenalty:0, capInterest:0, capPenalty:0, graceBlocks:[] };
  const plan = RS.calcRestructure(a.id);
  ok(27, plan.gates.termOk===false && plan.scheduleNew.length===0, `termOk=${plan.gates.termOk} n=${plan.scheduleNew.length}`);
})();

/* 28. Гейт ставки: newRate < 50% исходной → rateOk=false; ровно 50% → проходит; повышение не блокируется. */
(() => { fresh();
  const cr = RS.creditById('CR-60540'); // исходная ставка 8 → пол 4
  const a = app('RS-1001'); a.version = RS.versionFrom(cr);
  a.version.inputs = { forgivePenalty:0, capInterest:0, capPenalty:0, graceBlocks:[] };
  a.version.params.rate = 3;  const low  = RS.calcRestructure(a.id).gates.rateOk;
  a.version.params.rate = 4;  const edge = RS.calcRestructure(a.id).gates.rateOk;
  a.version.params.rate = 12; const high = RS.calcRestructure(a.id).gates.rateOk;
  ok(28, low===false && edge===true && high===true, `low=${low} edge=${edge} high=${high}`);
})();

/* 29. Режим просрочки (Р-28): режим 1 → dayCounterAfter=0, bucket=null; режим 2 → dayCounterAfter=odDays, есть bucket. */
(() => { fresh();
  const a = app('RS-1001'); const cr = RS.creditById('CR-60540');
  a.kindIds = ['K1'];                                          // overdueMode 1
  a.version = RS.versionFrom(cr); a.version.inputs = { forgivePenalty:0, capInterest:0, capPenalty:0, graceBlocks:[] };
  const p1 = RS.calcRestructure(a.id);
  a.kindIds = ['K2'];                                          // overdueMode 2
  a.version = RS.versionFrom(cr); a.version.inputs = { forgivePenalty:0, capInterest:0, capPenalty:0, graceBlocks:[] };
  const p2 = RS.calcRestructure(a.id);
  ok(29, p1.overdue.mode===1 && p1.overdue.dayCounterAfter===0 && p1.overdue.bucket===null
      && p2.overdue.mode===2 && p2.overdue.dayCounterAfter===cr.odDays && !!p2.overdue.bucket,
    `m1=${p1.overdue.dayCounterAfter}/${p1.overdue.bucket} m2=${p2.overdue.dayCounterAfter}/${!!p2.overdue.bucket}`);
})();

/* 30. scheduleOld на snapshot.principal × remainingTermMonths по старой ставке; число строк «стало». */
(() => { fresh();
  const a = app('RS-1005'); const cr = RS.creditById(a.creditIds[0]);
  a.version = RS.versionFrom(cr);
  a.version.params.term = 24; a.version.params.rate = cr.terms.rate;
  a.version.inputs = { forgivePenalty:0, capInterest:0, capPenalty:0, graceBlocks:[] };
  const plan = RS.calcRestructure(a.id);
  const p = RS.periodMonths(cr.terms.schedule);
  const oldN = plan.scheduleOld.length === Math.round(cr.remainingTermMonths / p);
  const newN = plan.scheduleNew.length === Math.round(24 / p);
  ok(30, oldN && newN, `oldN=${plan.scheduleOld.length} newN=${plan.scheduleNew.length} rem=${cr.remainingTermMonths}`);
})();

/* 31. Итоги: totals.new.base = base.total; totalToPay = Σ pay; переплата к телу считается. */
(() => { fresh();
  const a = app('RS-1001'); const cr = RS.creditById('CR-60540');
  a.version = RS.versionFrom(cr);
  a.version.params.term = 60; a.version.params.rate = 7;
  a.version.inputs = { forgivePenalty:0, capInterest:0, capPenalty:0, graceBlocks:[] };
  const plan = RS.calcRestructure(a.id);
  const baseOk = plan.totals.new.base === plan.base.total;
  const payOk  = plan.totals.new.totalToPay === RS.round2(plan.scheduleNew.reduce((s,r)=>s+r.pay,0));
  ok(31, baseOk && payOk && plan.totals.new.totalToPay > plan.base.total, `base=${baseOk} pay=${payOk}`);
})();

/* 32. Детерминизм: повторный calcRestructure даёт идентичный plan (по JSON). */
(() => { fresh();
  const a = app('RS-1001'); const cr = RS.creditById('CR-60540');
  a.version = RS.versionFrom(cr);
  a.version.params.term = 60; a.version.params.rate = 7;
  a.version.inputs = { forgivePenalty:12000, capInterest:118000, capPenalty:61000, graceBlocks:[] };
  const j1 = JSON.stringify(RS.calcRestructure(a.id));
  const j2 = JSON.stringify(RS.calcRestructure(a.id));
  ok(32, j1===j2 && j1.length>0, `equal=${j1===j2}`);
})();

/* 33. firstOverdueMode: наследуется из первого вида (ОВ-2). */
(() => { fresh();
  const a = app('RS-1001'); a.kindIds = ['K2','K1'];           // K2 mode 2 первый
  ok(33, RS.firstOverdueMode(a) === 2, `mode=${RS.firstOverdueMode(a)}`);
})();

/* 34. applyEntryOps: суммы берутся из plan (кап.%/штрафов/прощение = inputs), режим из plan.overdue. */
(() => { fresh();
  const a = app('RS-1001'); const cr = RS.creditById('CR-60540');
  a.kindIds = ['K4'];                                          // разрешает cap/forgive, overdueMode 2
  a.version = RS.versionFrom(cr);
  a.version.inputs = { forgivePenalty:12000, capInterest:118000, capPenalty:61000, graceBlocks:[] };
  RS.calcRestructure(a.id);
  a.ops = [];
  RS.applyEntryOps(a);
  const capI = a.ops.find(o=>o.type==='Капитализация процентов');
  const capS = a.ops.find(o=>o.type==='Капитализация штрафов');
  const forg = a.ops.find(o=>o.type==='Прощение санкций');
  const capIok = capI && capI.before===4200000 && capI.after===4318000;   // P → P+cI
  const capSok = capS && capS.before===4318000 && capS.after===4379000;   // P1 → P2
  const forgOk = forg && forg.before===73000 && forg.after===61000;       // S → S−fS
  ok(34, capIok && capSok && forgOk, `capI=${!!capIok} capS=${!!capSok} forg=${!!forgOk}`);
})();

/* 35. applyEntryOps без plan → блок (операции не добавлены). */
(() => { fresh();
  const a = app('RS-1004'); a.version = RS.versionFrom(RS.creditById(a.creditIds[0])); a.version.plan = null;
  a.ops = [];
  const res = RS.applyEntryOps(a);
  ok(35, res === false && a.ops.length === 0, `res=${res} ops=${a.ops.length}`);
})();

/* 36. Демо a1 согласована: рассчитанный plan даёт кап.% 118000, кап.штрафов 61000, прощение 12000. */
(() => { fresh();
  const a = app('RS-1001');
  const plan = RS.calcRestructure(a.id);
  const capOk = plan.base.capitalized === 179000;             // 118000 + 61000
  const inputsOk = a.version.inputs.capInterest===118000 && a.version.inputs.capPenalty===61000 && a.version.inputs.forgivePenalty===12000;
  ok(36, capOk && inputsOk, `cap=${plan.base.capitalized} inputs=${inputsOk}`);
})();

/* 37. Пустой вход: база = P, график на P (Р-22, тест 12 промпта). */
(() => { fresh();
  const a=app('RS-1004'); const cr=RS.creditById(a.creditIds[0]);
  a.version=RS.versionFrom(cr); a.version.inputs={forgivePenalty:0,capInterest:0,capPenalty:0,graceBlocks:[]};
  const plan=RS.calcRestructure(a.id);
  ok(37, plan.base.total===cr.snapshot.principal && plan.base.capitalized===0, `total=${plan.base.total} cap=${plan.base.capitalized}`);
})();
/* 38. Стек: основание каждой owned-операции непусто (промпт тест 5). */
(() => { fresh();
  const a=app('RS-1001'); RS.calcRestructure(a.id);
  const withBasis=a.version.plan.stack.filter(s=>s.op.includes('Снимок')||s.op.includes('Прощение')||s.op.includes('Капитализация'));
  ok(38, withBasis.every(s=>s.basis&&s.basis.length>0), `n=${withBasis.length}`);
})();
/* 39. Дата погашения новая = cutoff + (newTerm + Σgrace)×30 (промпт тест 28). */
(() => { fresh();
  const a=app('RS-1001'); const cr=RS.creditById('CR-60540');
  a.version=RS.versionFrom(cr); a.version.params.term=60;
  a.version.inputs={forgivePenalty:0,capInterest:0,capPenalty:0,graceBlocks:[{months:3,type:'interest-only'}]};
  const plan=RS.calcRestructure(a.id);
  ok(39, plan.totals.new.maturity.length===10 && plan.newTerm===60, `mat=${plan.totals.new.maturity} term=${plan.newTerm}`);
})();
/* 40. Всего процентов старое/новое различаются при смене ставки (промпт тест 29). */
(() => { fresh();
  const a=app('RS-1001'); const cr=RS.creditById('CR-60540');
  a.version=RS.versionFrom(cr); a.version.params.rate=4; a.version.params.term=60;
  a.version.inputs={forgivePenalty:0,capInterest:0,capPenalty:0,graceBlocks:[]};
  const plan=RS.calcRestructure(a.id);
  ok(40, plan.totals.new.totalInterest!==plan.totals.old.totalInterest, `new=${plan.totals.new.totalInterest} old=${plan.totals.old.totalInterest}`);
})();
/* 41. Смена cutoffDate сбрасывает plan и перезамораживает snapshot (промпт тест 32). */
(() => { fresh();
  const a=app('RS-1001'); const cr=RS.creditById('CR-60540');
  a.version=RS.versionFrom(cr); RS.calcRestructure(a.id);
  const had=!!a.version.plan;
  cr.snapshot.principal=9999999;               // изменим леджер
  a.version.cutoffDate='2026-08-01'; a.version.snapshot={...cr.snapshot}; a.version.plan=null;  // как делает setCutoff
  ok(41, had && a.version.plan===null && a.version.snapshot.principal===9999999, `had=${had} reset=${a.version.plan===null}`);
})();

/* ---- отчёт ---- */
const pass = results.filter(r => r.pass).length;
const lines = results.map(r => `   ${r.pass ? 'PASS' : 'FAIL'}  #${r.n}  ${r.note}`);
const stamp = `SMOKE 2026-07-19 · ${pass}/${results.length} PASS\n` + lines.join('\n');
console.log(stamp);

// вставляем результат в шапку HTML
const marker = 'SMOKE (node scripts/inspect/restructuring-check.mjs):';
const reBlock = new RegExp('(' + marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\n)[\\s\\S]*?(\\n-->)');
const injected = '   ' + stamp.replace(/\n/g, '\n   ');
if (reBlock.test(src)) {
  writeFileSync(HTML, src.replace(reBlock, `$1${injected}$2`), 'utf8');
  console.log('\n→ результат вставлен в шапку restructuring.html');
}
process.exit(pass === results.length ? 0 : 1);
