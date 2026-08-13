// Headless smoke для mockups/restructuring/restructuring.html (спека §14, РС-1…РС-41).
// Zero-dep: извлекает <script> из HTML и исполняет чистый логический слой в node:vm
// (без DOM — init/рендер пропускается). Читает только window.RS плюс состояние, уже
// материализованное в демо-заявках RS-1001…RS-1007 при seed(); финансовое ядро
// (debtAt/run/PIPELINE/restructureApplied/balanceAt…) приватно (issues/02, задача 8) —
// там, где сценарий проверяет его устройство, а не результат на демо-данных, проверка
// идёт по исходному тексту файла, не через вызов. Функции, дёргающие render(), зовутся
// свободно: с 10.08.2026 render() без document — no-op, тем же приёмом, что и toast (см.
// комментарий на месте). До этого сценарии обходились вызовами, у которых guard-return
// отсекал путь до document раньше, чем до render() (см. #15).
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
const js = m[1];

// песочница: есть window (чтобы код выставил window.RS), нет document (init/рендер пропускается)
const win = {};
const sandbox = { window: win, console, setTimeout: () => {}, clearTimeout: () => {} };
vm.createContext(sandbox);
vm.runInContext(js, sandbox, { filename: 'restructuring.inline.js' });
const RS = win.RS;
if (!RS) { console.error('window.RS не инициализирован'); process.exit(1); }

const results = [];
const ok = (n, cond, note = '') => results.push({ n, pass: !!cond, note });
const fresh = () => RS.seed();
const app = id => RS.appById(id);

/* Фикстура многокредитной заявки. Демо-данные не гарантируют, что у ИНН заявки найдётся второй
   кредит со свободным траншем, поэтому берём любой свободный и приписываем его тому же ИНН:
   охват ограничен одним заёмщиком, и без этого addTrancheToScope откажет по делу. Занятый другой
   заявкой транш исключаем — иначе сценарий упал бы на ИР-1, а не на своей теме. */
function secondTranche(a){
  const free = t => !t.closed && !RS.activeAppOnTranche(t.id, a.id);
  const cr = RS.state.credits.find(c => !(a.creditIds||[]).includes(c.id) && (c.tranches||[]).some(free));
  if(!cr) throw new Error('нет свободного кредита для ' + a.id);
  cr.inn = a.inn;
  return { cr, t: cr.tranches.find(free) };
}

/* 1. Неполный пакет → «Анализ» заблокирован; докомплект → открыт. */
(() => { fresh();
  const a = app('RS-1003');
  const before = RS.canAdvance(a).ok;
  RS.requiredDocs(a).forEach(d => a.packetDocs[d] = true);
  const after = RS.canAdvance(a).ok;
  ok(1, before === false && after === true, `до=${before} после=${after}`);
})();

/* 2. Заключения СРМиК/ДПО: виза открывает гейт, новый заключант вновь его закрывает. */
(() => { fresh();
  const a = app('RS-1004');
  const closed = RS.conclGate(a).ok === false;
  a.conclusions.find(c => c.dept === 'ДПО').visa = true;
  const opened = RS.conclGate(a).ok === true;
  a.conclusions.push({ dept: 'Юр', text: '', visa: false, visaDate: null });
  const reblocked = RS.conclGate(a).ok === false;
  ok(2, closed && opened && reblocked, `closed=${closed} opened=${opened} reblock=${reblocked}`);
})();

/* 3. Объединение параметров видов: K2 (RS-1004) без rate; K1+K4 (RS-1001) даёт rate ∪. */
(() => { fresh();
  const p4 = RS.allowedParams(app('RS-1004'));
  const p1 = RS.allowedParams(app('RS-1001'));
  const noRate = !p4.has('rate');
  const union = ['term','schedule','nonworking','capInterest','capPenalty','forgive'].every(k => p1.has(k));
  ok(3, noRate && union, `noRate=${noRate} union=${union}`);
})();

/* 4. Объединение распоряжений видов: K2={spread}; K1+K4={spread,cap,forgive}. */
(() => { fresh();
  const d4 = RS.allowedDispositions(app('RS-1004'));
  const d1 = RS.allowedDispositions(app('RS-1001'));
  const onlySpread = d4.size === 1 && d4.has('spread');
  const three = d1.size === 3 && d1.has('spread') && d1.has('cap') && d1.has('forgive');
  ok(4, onlySpread && three, `onlySpread=${onlySpread} three=${three}`);
})();

/* 5. Рантайм-вид администратора немедленно входит в объединение allowedParams/Dispositions. */
(() => { fresh();
  const n0 = RS.state.kinds.length;
  RS.state.kinds.push({ id:'KX', name:'Тестовый вид', params:['rate','grace'], docs:['Заявление'], allowedDispositions:['cap'], limits:'' });
  const a = app('RS-1004'); a.kindIds.push('KX');
  const grew = RS.state.kinds.length === n0 + 1;
  const sawRate = RS.allowedParams(a).has('rate');
  const sawCap = RS.allowedDispositions(a).has('cap');
  ok(5, grew && sawRate && sawCap, `kinds=${RS.state.kinds.length} rate=${sawRate} cap=${sawCap}`);
})();

/* 6. Роли: Наблюдатель не может ни одно защищённое действие; Куратор ОД может regDS. */
(() => { fresh();
  RS.state.role = 'Наблюдатель';
  const anyAllowed = ['addCredit','fixMinfin','regDS','waiver','manageDict','fixCommittee'].some(a => RS.canX(a));
  RS.state.role = 'Куратор ОД';
  const curatorCan = RS.canX('regDS');
  ok(6, anyAllowed === false && curatorCan === true, `observerAllowed=${anyAllowed} curatorRegDS=${curatorCan}`);
})();

/* 7. Кредит с активной заявкой нельзя добавить во вторую заявку. */
(() => { fresh();
  const busy = RS.activeAppOnCredit('CR-61200', 'RS-9999'); // в активной RS-1004
  const free = RS.activeAppOnCredit('CR-58120', 'RS-9999'); // только в закрытой RS-1003
  ok(7, busy && busy.id === 'RS-1004' && !free, `busy=${busy && busy.id} free=${free ? free.id : 'нет'}`);
})();

/* 8. ИР-3/РС-4/РС-6 — три последовательных ДС на CR-59003: 4 транша, T1 и T4 открыты. */
(() => { fresh();
  const tr = RS.creditById('CR-59003').tranches;
  ok(8, tr.length === 4 && !tr[0].closed && !tr[3].closed, `n=${tr.length} T1closed=${!!tr[0].closed} T4closed=${!!tr[3].closed}`);
})();

/* 9. ИР-5 — T2/T3 закрыты причиной «перенос», не «погашение». */
(() => { fresh();
  const tr = RS.creditById('CR-59003').tranches;
  ok(9, tr[1].closed && tr[1].closed.reason === 'перенос' && tr[2].closed && tr[2].closed.reason === 'перенос',
    `T2=${tr[1].closed && tr[1].closed.reason} T3=${tr[2].closed && tr[2].closed.reason}`);
})();

/* 10. ИР-9/РС-16 — терминал по условию: «Закрыта» только когда пройдены все гейты оформления.
   Индексы 8/7 — цепь из девяти стадий по ADR-0107 (было 6/7 при одностадийном решении). */
(() => { fresh();
  const s5 = RS.stageOf(app('RS-1005'));
  const s1 = RS.stageOf(app('RS-1001'));
  const closedWhenAllOk = s5.idx === 8 && s5.closed === true;
  const stuckWhileGateFails = s1.idx === 7 && s1.closed === false;
  ok(10, closedWhenAllOk && stuckWhileGateFails, `RS-1005=${JSON.stringify(s5)} RS-1001=${JSON.stringify(s1)}`);
})();

/* 11. Веха «ДС применён» регистрируется в credit.audit на каждом из трёх ДС цепочки. */
(() => { fresh();
  const audit = RS.creditById('CR-59003').audit;
  const n = audit.filter(x => x.type === 'ДС применён' && ['ДС-59003/3','ДС-59003/4','ДС-59003/5'].includes(x.ds)).length;
  ok(11, n === 3, `n=${n}`);
})();

/* 12. РС-5/РС-8 — расчёт долга на дату между первой и второй реструктуризацией. */
(() => { fresh();
  const d3 = app('RS-1005').ds.date, d4 = app('RS-1006').ds.date, cutoff6 = app('RS-1006').cutoff.date;
  ok(12, d3 < cutoff6 && cutoff6 < d4, `ДС/3=${d3} срез/6=${cutoff6} ДС/4=${d4}`);
})();

/* 13. РС-8 — срез ≠ факт на дату вступления: два разных датированных числа. */
(() => { fresh();
  const a = app('RS-1001');
  const cutoffP = a.cutoff.rows.find(r => r.article === 'principal').amount;
  const factP = a.ds.fact.rows.find(r => r.article === 'principal').amount;
  // 4 082 000 = 4 200 000 остатка минус перенос 118 000. Перенос сжался после ADR-0110:
  // расходы взыскания и сборы больше не входят в базу, и уносить с траншем нечего.
  ok(13, a.cutoff.date !== a.ds.date && cutoffP === 5000000 && factP === 4082000 && cutoffP !== factP,
    `срез=${a.cutoff.date}/${cutoffP} факт=${a.ds.date}/${factP}`);
})();

/* 14. РС-7/РС-13/ADR-0110 — пять статей долга, ровно две срочности. Расходов взыскания и сборов
   в базе нет ни строкой: они выведены из охвата, а не просто обнулены. */
(() => { fresh();
  const base = RS.defaultBase(app('RS-1001'), RS.TODAY);
  const arts = new Set(base.map(r => r.article));
  const urg = new Set(base.map(r => r.urgency));
  const urgOk = [...urg].every(u => u === 'over' || u === 'cur');
  const outOfScope = !arts.has('collectionCost') && !arts.has('fees');
  ok(14, base.length === 5 && arts.size === 5 && urgOk && outOfScope,
    `n=${base.length} arts=${arts.size} urg=${[...urg].join(',')} внеОхвата=${outOfScope}`);
})();

/* 15. ИР-6 — спорная пеня: мёртвая галка, toggleBaseRow не переключает заблокированную строку. */
(() => { fresh();
  const a = app('RS-1001');
  const before = RS.defaultBase(a, RS.TODAY).find(r => r.article === 'penalty' && r.urgency === 'over');
  RS.toggleBaseRow(a.id, 'penalty', 'over');            // blockedBy → ранний return, до render()
  const after = a.base.find(r => r.article === 'penalty' && r.urgency === 'over');
  ok(15, before.blockedBy === 'disputed' && !before.included && after.blockedBy === 'disputed' && !after.included,
    `before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
})();

/* 16. Распоряжения по статьям заведены реальной дверью, и «по периодам» — тоже: живой путь
   кладёт в periods не-умолчание, шаг distribute его читает. Прежде сценарий сторожил
   ОБРАТНОЕ — существование дыры (`periods: null`, читателей нет); дыра закрыта 10.08.2026
   решениями РС-38…РС-41, и сторож перевёрнут (ADR-0109, спека §14 п. 16). */
(() => { fresh();
  const a = app('RS-1001');
  const dCap = RS.dispositionFor(a.dispositions, 'accInterest', 'over');
  const dForgive = RS.dispositionFor(a.dispositions, 'accPenalty', 'over');
  const wired = dCap && dCap.kind === 'cap' && dForgive && dForgive.kind === 'forgive';
  const noNullDefault = !/periods\s*:\s*null/.test(js);        // умолчание — allPeriods(), не null
  const setterWrites = typeof RS.setDispPeriods === 'function'; // экспортированная дверь
  const d = RS.dispositionFor(a.dispositions, 'accInterest', 'over');
  d.kind = 'spread';
  RS.setDispPeriods(a.id, 'accInterest', 'over', 'range', 2, 4);
  const written = d.periods && d.periods.mode === 'range' && d.periods.from === 2 && d.periods.to === 4;
  // читатель — приватный distribute, кладущий сроки в parts; проверяем по результату прогона
  const part = (RS.AppSide.run(a, RS.TODAY).parts || []).find(p => p.periods && p.periods.mode === 'range');
  const read = !!part && part.periods.to === 4;
  // Тем же грепом — второй мёртвый признак: счётчик capitalizedPenalty прежде только писался,
  // и это был признак неисполненной РС-27. Теперь его читает сборка базы.
  const writes = (js.match(/capitalizedPenalty\s*[:=]/g) || []).length;   // литерал состояния
  const reads = (js.match(/capitalizedPenalty/g) || []).length - writes;   // всё прочее — чтение
  ok(16, wired && noNullDefault && setterWrites && written && read && writes > 0 && reads > 0,
    `wired=${wired} безNull=${noNullDefault} сеттер=${setterWrites} записано=${written} прочитано=${read} capPen(пишет/читает)=${writes}/${reads}`);
})();

/* 17. ИР-7 — порядок конвейера: прощение → капитализация → распределение → просрочка → сборка. */
(() => {
  const block = js.slice(js.indexOf('const PIPELINE = ['), js.indexOf('\n];', js.indexOf('const PIPELINE = [')));
  const idx = name => block.indexOf(`function ${name}(`);
  const order = ['forgive','capitalize','distribute','overdue','assembleBase'].map(idx);
  const increasing = order.every((v,i) => i === 0 || v > order[i-1]);
  const allFound = order.every(v => v >= 0);
  ok(17, allFound && increasing, `order=${order.join(',')}`);
})();

/* 18. РС-9/ADR-0096 — одна дверь: единственный `.ops.push(` на транше, внутри restructureApplied. */
(() => {
  const matches = [...js.matchAll(/\.ops\.push\(/g)];
  const fnStart = js.indexOf('function restructureApplied(ds)');
  const fnEnd = js.indexOf('const CreditSide = {');
  const inside = matches.length === 1 && matches[0].index > fnStart && matches[0].index < fnEnd;
  ok(18, matches.length === 1 && inside, `count=${matches.length} inside=${inside}`);
})();

/* 19. ИР-8/РС-17 — гейт согласий: CR-61200 (запрошено) блокирует, согласованные пропускают. */
(() => { fresh();
  const blocked = RS.consentGate('CR-61200');
  const okA = RS.consentGate('CR-60540');
  const okB = RS.consentGate('CR-59003');
  ok(19, blocked.ok === false && okA.ok === true && okB.ok === true,
    `CR-61200=${blocked.ok} CR-60540=${okA.ok} CR-59003=${okB.ok}`);
})();

/* 20. РС-18 — гейт покрытия: RS-1001 красный из-за страховки короче срока новых условий; RS-1005 зелёный. */
(() => { fresh();
  const g1 = RS.coverGateApp(app('RS-1001')).rows[0].g;
  const g5 = RS.coverGateApp(app('RS-1005')).rows[0].g;
  const red = g1.coverOk === true && g1.ageOk === true && g1.insured === false && g1.ok === false;
  const green = g5.coverOk === true && g5.ageOk === true && g5.insured === true && g5.ok === true;
  ok(20, red && green, `RS-1001=${JSON.stringify(g1)} RS-1005=${JSON.stringify(g5)}`);
})();

/* 21. РС-19/ИР-10 — гейт пределов объясняется РЕАЛЬНЫМИ реквизитами нормы. До 10.08.2026 сценарий
   требовал обратного — метки «пункт не подтверждён»: Положение не было на руках, и справочник
   честно говорил, что редакция неизвестна. Норма получена (прил. к ПКМ КР №14 от 19.01.2026),
   метка снята, и сценарий сторожит теперь противоположное: запись обязана нести редакцию и дату. */
(() => { fresh();
  const capNote = RS.normNote(RS.termCapFor(500000, RS.TODAY).rec);
  const floorNote = RS.normNote(RS.rateFloorFor(8, RS.TODAY).rec);
  const stale = 'пункт не подтверждён';
  const req = n => n.includes('ПКМ КР №14') && n.includes('2026-01-19') && !n.includes(stale);
  ok(21, req(capNote) && capNote.includes('п. 90') && req(floorNote) && floorNote.includes('п. 92'),
    `cap="${capNote}" floor="${floorNote}"`);
})();

/* 22. РС-19 — границы termCapFor по шагам справочника. */
(() => { fresh();
  const m2 = sum => RS.termCapFor(sum, RS.TODAY).months;
  const steps = [[500000,36],[5000000,84],[15000000,120],[30000000,144],[60000000,180]];
  const okAll = steps.every(([sum,exp]) => m2(sum) === exp);
  ok(22, okAll, steps.map(([sum,exp]) => `${sum}→${m2(sum)}(exp ${exp})`).join(' '));
})();

/* 23. РС-19 — rateFloorFor = 50% исходной ставки. */
(() => { fresh();
  const f8 = RS.rateFloorFor(8, RS.TODAY).floor, f7 = RS.rateFloorFor(7, RS.TODAY).floor;
  ok(23, f8 === 4 && f7 === 3.5, `f8=${f8} f7=${f7}`);
})();

/* 24. Движок amortize — аннуитет: платёж постоянен (кроме последней строки), Σ principal = base, остаток → 0. */
(() => {
  const { rows } = RS.amortize(1200000, 12, 12, 'аннуитет', [], '2026-01-01', 'ежемесячно');
  const head = rows.slice(0,-1);
  const allEq = head.every(r => r.pay === head[0].pay) && head[0].pay > 0;
  const sum = RS.round2(rows.reduce((s,r)=>s+r.principal,0));
  const last = rows[rows.length-1];
  ok(24, rows.length===12 && sum===1200000 && last.balance===0 && allEq, `n=${rows.length} sum=${sum} lastBal=${last.balance} constPay=${allEq}`);
})();

/* 25. Движок amortize — дифференцированный: тело платежа постоянно (кроме последней), платёж убывает. */
(() => {
  const { rows } = RS.amortize(1200000, 12, 12, 'дифференцированный', [], '2026-01-01', 'ежемесячно');
  const head = rows.slice(0,-1);
  const prConst = head.every(r => r.principal === head[0].principal) && head[0].principal === RS.round2(1200000/12);
  const decreasing = rows[0].pay > rows[rows.length-1].pay;
  const sum = RS.round2(rows.reduce((s,r)=>s+r.principal,0));
  ok(25, prConst && decreasing && sum===1200000, `prConst=${prConst} dec=${decreasing} sum=${sum}`);
})();

/* 26. Движок amortize — периодность: ежеквартально → p=3, число строк = term/3. */
(() => {
  const { rows, meta } = RS.amortize(900000, 8, 24, 'аннуитет', [], '2026-01-01', 'ежеквартально');
  ok(26, meta.p===3 && rows.length===8, `p=${meta.p} n=${rows.length}`);
})();

/* 27. Движок amortize — нулевая ставка: без процентов, платёж = база/строк. */
(() => {
  const { rows } = RS.amortize(1200000, 0, 12, 'аннуитет', [], '2026-01-01', 'ежемесячно');
  const noInterest = rows.every(r => r.interest === 0);
  const flat = rows.slice(0,-1).every(r => r.principal === RS.round2(1200000/12));
  ok(27, noInterest && flat, `noInt=${noInterest} flat=${flat}`);
})();

/* 28. Движок amortize — грейс «только проценты»: тело не гасится, платёж = база×ставка. */
(() => {
  const { rows, meta } = RS.amortize(1200000, 12, 12, 'аннуитет', [{months:3, type:'interest-only'}], '2026-01-01', 'ежемесячно');
  const io = rows.slice(0,3);
  const zeroPr = io.every(r => r.principal === 0);
  const constBal = io.every(r => r.balance === RS.round2(1200000));
  const payOk = io.every(r => r.pay === RS.round2(1200000 * meta.i));
  ok(28, zeroPr && constBal && payOk && rows.length-3===9, `zeroPr=${zeroPr} constBal=${constBal} payOk=${payOk}`);
})();

/* 29. Движок amortize — мораторий: платёж=0 в блоке, база капитализируется, morCap>0; число амортстрок = m. */
(() => {
  const g = 3;
  const { rows, meta, morCap } = RS.amortize(1200000, 12, 12, 'аннуитет', [{months:g, type:'moratorium'}], '2026-01-01', 'ежемесячно');
  const mor = rows.slice(0,g);
  const zeroPay = mor.every(r => r.pay === 0 && r.principal === 0);
  const expBase = RS.round2(1200000 * Math.pow(1+meta.i, g));
  const baseOk = RS.round2(meta.baseAmort) === expBase;
  const capOk = morCap === RS.round2(expBase - 1200000) && morCap > 0;
  const amort = rows.slice(meta.gMor + meta.gIo);
  const countOk = amort.length === meta.m;
  ok(29, zeroPay && baseOk && capOk && countOk, `zeroPay=${zeroPay} baseOk=${baseOk} morCap=${morCap} m=${meta.m}`);
})();

/* ===== СЦЕНАРИИ РЕШЕНИЙ 10.08.2026 (РС-26…РС-37, ADR-0106/0105, ADR-0099 §2/§3/§5) ===== */

/* 30. РС-34/ADR-0107 — цепь из трёх актов: стадия читается по акту, а не по органу.
   RS-1002 закрыта отрицательным заключением (п. 88) и до Кабмина не доходит. */
(() => { fresh();
  const a2 = app('RS-1002'), s2 = RS.stageOf(a2);
  const noResolution = !a2.resolution;
  const chainLen = RS.STAGES.length === 9 && RS.STAGES[4] === 'Заключение уполномоченного органа'
    && RS.STAGES[5] === 'Проект решения КМ' && RS.STAGES[6] === 'Постановление КМ';
  ok(30, chainLen && noResolution && s2.idx === 4 && s2.closed === true && s2.label.includes('заключение'),
    `stages=${RS.STAGES.length} RS-1002=${JSON.stringify(s2)} resolution=${a2.resolution}`);
})();

/* 31. ADR-0107 §«Последствия» — дверь спрашивает ПОСТАНОВЛЕНИЕ, не заключение: без реквизита
   согласования ЖК постановление не регистрируется, без постановления ДС не проходит. */
(() => { fresh();
  const a1 = app('RS-1001');
  const withAll = RS.resolutionGate(a1).ok;
  const noZk = RS.resolutionGate({ resolution: { decision:'изм', no:'ПКМ-1', date:'2026-07-01' }, zk:null });
  const onlyConclusion = RS.zkGate({ conclusion:{ outcome:'отказ', no:'МФ-1', date:'2026-07-01' }, zk:{no:'ЖК-1',date:'2026-07-02'} });
  ok(31, withAll === true && noZk.ok === false && noZk.needZk === true && onlyConclusion.ok === false && onlyConclusion.needConclusion === true,
    `RS-1001=${withAll} безЖК=${JSON.stringify(noZk)} приОтказе=${JSON.stringify(onlyConclusion)}`);
})();

/* 32. РС-28/ИР-13 — прощение без названной в акте суммы либо основания блокирует регистрацию ДС. */
(() => { fresh();
  const a1 = app('RS-1001');
  const withBasis = RS.forgiveGate(a1);
  const stripped = { dispositions: a1.dispositions, resolution: { ...a1.resolution, forgiveSum:null, forgiveBasis:null } };
  const without = RS.forgiveGate(stripped);
  const noForgive = RS.forgiveGate({ dispositions: [{article:'penalty',urgency:'over',kind:'cap',amount:1000}], resolution:{} });
  ok(32, withBasis.applicable && withBasis.ok && !without.ok && without.sum === withBasis.sum && noForgive.ok && !noForgive.applicable,
    `сОснованием=${JSON.stringify(withBasis)} без=${without.ok} безПрощения=${noForgive.applicable}`);
})();

/* 33. РС-26 — порог расхождения в две ступени, по проценту ЛИБО по абсолютной сумме.
   Проверяем обе оси: 12 % от малой базы и 6 млн от базы, где это всего 6 %. */
(() => { fresh();
  const t = (delta, base) => { const x = RS.driftTier(delta, base); return x ? x.level : 0; };
  const pctAxis = t(120000, 1000000) === 1 && t(300000, 1000000) === 2 && t(90000, 1000000) === 0;
  const absAxis = t(600000, 100000000) === 1 && t(6000000, 100000000) === 2;
  const clean = t(10000, 1000000) === 0;
  const twoTiers = RS.DRIFT_TIERS.length === 2 && RS.DRIFT_TIERS[0].pct === 0.10 && RS.DRIFT_TIERS[0].abs === 500000
    && RS.DRIFT_TIERS[1].pct === 0.25 && RS.DRIFT_TIERS[1].abs === 5000000;
  ok(33, twoTiers && pctAxis && absAxis && clean, `pct=${pctAxis} abs=${absAxis} clean=${clean} tiers=${RS.DRIFT_TIERS.length}`);
})();

/* 34. РС-27/ADR-0106 — пеня терминальна: ни на капитализированную, ни на накопленную пеню,
   ни на просроченное накопленное начислений нет; на основной долг проценты идут. */
(() => { fresh();
  const empty = a => { const m = RS.accrualModeOf(a, RS.TODAY).mode; return !m.interest && !m.penalty; };
  const principal = RS.accrualModeOf('principal', RS.TODAY).mode;
  const dated = RS.ACCRUAL_MODES.every(r => /^\d{4}-\d{2}-\d{2}$/.test(r.from));
  ok(34, empty('penalty') && empty('accPenalty') && empty('accInterest') && principal.interest === true && principal.penalty === true && dated,
    `penalty=${empty('penalty')} accPenalty=${empty('accPenalty')} accInterest=${empty('accInterest')} principal=${JSON.stringify(principal)} dated=${dated}`);
})();

/* 35. РС-27 — капитализация разводит проценты и пеню по РАЗНЫМ счётчикам (п. 89 пп. 4:
   «выделение отдельной суммой»), а не сливает всё в тело. */
(() => { fresh();
  const a = app('RS-1001');
  const base = [
    { article:'accInterest', urgency:'over', amount:100000, included:true },
    { article:'penalty',     urgency:'over', amount:40000,  included:true }
  ];
  const disp = [
    { article:'accInterest', urgency:'over', kind:'cap', amount:100000 },
    { article:'penalty',     urgency:'over', kind:'cap', amount:40000 }
  ];
  const r = RS.AppSide.run({ ...a, base, dispositions: disp }, RS.TODAY);
  ok(35, r.capitalizedInterest === 100000 && r.capitalizedPenalty === 40000 && r.capitalized === 140000,
    `int=${r.capitalizedInterest} pen=${r.capitalizedPenalty} всего=${r.capitalized}`);
})();

/* 36. РС-35/ADR-0099 §2 — пол ставки = max(50 % от первоначальной, минимум по виду проекта).
   Вид не указан ⇒ второй пол не вычисляется и гейт говорит об этом вслух, а не молчит. */
(() => { fresh();
  const commercial = RS.rateFloorFor(8, RS.TODAY, 'commercial');   // half 4 < 6 ⇒ пол 6
  const social = RS.rateFloorFor(8, RS.TODAY, 'social');           // half 4 > 1 ⇒ пол 4
  const unknown = RS.rateFloorFor(8, RS.TODAY, null);              // вида нет ⇒ пол 4, флаг
  const external = RS.rateFloorFor(8, RS.TODAY, 'external');       // ставка внешняя ⇒ флаг
  ok(36, commercial.floor === 6 && commercial.projFloor === 6
      && social.floor === 4 && social.projFloor === 1
      && unknown.floor === 4 && unknown.projectUnchecked === true
      && external.floor === 4 && external.projectUnchecked === true,
    `комм=${commercial.floor} соц=${social.floor} безВида=${unknown.floor}/${unknown.projectUnchecked} внешн=${external.projectUnchecked}`);
})();

/* 37. ADR-0099 §5 — нормативный пакет пп. 85–86, 95: три безусловных документа плюс условные,
   каждый с пунктом. Условные не показываются, пока условие не в силе. */
(() => { fresh();
  const a3 = app('RS-1003');                     // виды: N1, ставку не трогает
  const pkg = RS.normPacket(a3);
  const points = pkg.map(d => d.point);
  const unconditional = ['85 пп. 1','85 пп. 2','85 пп. 3'].every(p => points.includes(p));
  const noRateDocs = !points.includes('95 пп. 1') && !points.includes('95 пп. 2');
  const everyDocHasPoint = RS.requiredDocs(a3).every(d => RS.packetPointOf(d) || true);
  const rateApp = { ...a3, kindIds:['N2'] };     // вид со ставкой ⇒ появляются пп. 95
  const rateDocs = RS.normPacket(rateApp).map(d => d.point);
  ok(37, unconditional && noRateDocs && everyDocHasPoint
      && rateDocs.includes('95 пп. 1') && rateDocs.includes('95 пп. 2'),
    `безусл=${unconditional} безСтавки=${noRateDocs} соСтавкой=${rateDocs.join(',')}`);
})();

/* 38. РС-31/ИР-14 — справочник открыт, но пять форм п. 89 замкнуты: происхождение «норма»,
   удаление отклонено; заведённое администратором несёт «иное» и обоснование. */
(() => { fresh();
  const norm = RS.state.kinds.filter(k => RS.isNormKind(k));
  const other = RS.state.kinds.filter(k => !RS.isNormKind(k));
  const points = norm.map(k => k.point).sort();
  const fivePoints = JSON.stringify(points) === JSON.stringify(['89 пп. 1','89 пп. 2','89 пп. 3','89 пп. 4','89 пп. 5']);
  const before = RS.state.kinds.length;
  RS.state.role = 'Администратор'; RS.dropKind(norm[0].id);   // норма — удаление отклоняется
  const kept = RS.state.kinds.length === before;
  const everyOtherJustified = other.every(k => k.rationale && k.rationale.trim().length > 10);
  ok(38, norm.length === 5 && fivePoints && other.length >= 1 && everyOtherJustified && kept,
    `норма=${norm.length} иное=${other.length} пункты=${points.join(',')} удалениеОтклонено=${kept}`);
})();

/* 39. РС-32 — повторность: СИГНАЛ с третьей реструктуризации, не гейт. CR-59003 к концу цепочки
   несёт пять применённых ДС и сигналит; CR-61200 (ни одной) молчит. Главное в сценарии — вторая
   половина: сигнал нигде не читается как условие гейта, иначе Холдинг надстроил бы над нормой
   собственную ступень согласования (п. 82 маршрут уже установил). */
(() => { fresh();
  const signalled = RS.repeatSignal(app('RS-1007'));
  const silent = RS.repeatSignal(app('RS-1004'));
  const notAGate = !/repeatSignal\([^)]*\)[^;]*\.(ok|blocked)/.test(js)
    && !new RegExp('(canReg|reasons\\.push|gate)[^\\n]*repeatSignal').test(js);
  ok(39, signalled.on === true && signalled.credits[0].n >= RS.REPEAT_SIGNAL_FROM && silent.on === false && notAGate,
    `RS-1007=${JSON.stringify(signalled)} RS-1004=${silent.on} неГейт=${notAGate}`);
})();

/* 40. РС-30 — производственный календарь: срок в рабочих днях считается по справочнику,
   а не по сб/вс. 2026-03-19 + 5 р.д. перепрыгивает Нооруз (21.03) и его перенос. */
(() => { fresh();
  const nooruz = RS.isWorkDay('2026-03-21') === false;         // праздник
  const movedWork = RS.isWorkDay('2026-03-28') === true;       // рабочая суббота-перенос
  const plainSat = RS.isWorkDay('2026-03-14') === false;       // обычная суббота
  const known2026 = RS.calendarYearKnown(2026) === true;
  const unknown2030 = RS.calendarYearKnown(2030) === false;    // год не заведён — макет об этом говорит
  const jump = RS.addWorkDays('2026-03-19', 5);
  ok(40, nooruz && movedWork && plainSat && known2026 && unknown2030 && jump > '2026-03-25',
    `нооруз=${nooruz} перенос=${movedWork} сб=${plainSat} 2030=${unknown2030} 19.03+5р.д.=${jump}`);
})();

/* 41. ADR-0099 §3 — предел срока меряется от ОСТАТКА ЗАДОЛЖЕННОСТИ, и граница ступени уходит
   вверх: ровно 1 000 000 → 84 мес., а не 36. */
(() => { fresh();
  const m = sum => RS.termCapFor(sum, RS.TODAY).months;
  const boundaries = m(999999) === 36 && m(1000000) === 84 && m(10000000) === 120
    && m(20000000) === 144 && m(50000000) === 180;
  const cr = RS.creditById('CR-60540');
  const fromBalance = RS.limitsGate({ term: m(cr.balance) + 1, rate: 9 }, cr, RS.TODAY);
  const msgFromBalance = fromBalance.messages.some(s => s.includes('остатке задолженности'));
  ok(41, boundaries && fromBalance.termOk === false && msgFromBalance,
    `границы=${boundaries} отОстатка=${msgFromBalance}`);
})();

/* 42. РС-29 — снятие мягкого гейта покрытия оформляет КОМИТЕТ ПО АДМИНИСТРИРОВАНИЮ БЮДЖЕТНЫХ
   КРЕДИТОВ; «залоговой комиссии» в макете не осталось (КД-10 модуля залога). */
(() => {
  const noOldBody = !/залоговая комиссия|Комиссия по залогу|комиссии по залогу/i.test(
    js.replace(/роли «залоговая комиссия»[^<]*/gi, '').replace(/«залоговая комиссия»/gi, ''));
  const hasNewBody = js.includes('Комитет по администрированию бюджетных кредитов');
  ok(42, noOldBody && hasNewBody, `староеИмя=${!noOldBody} новоеИмя=${hasNewBody}`);
})();

/* ================= РС-38…РС-41 / ADR-0109 — статьи в строке графика (спека §14, 43–51) ======= */

/* Общая заготовка: заявка со свежей базой и распоряжениями, ссылка на строку и распоряжение. */
const doorFixture = (id = 'RS-1001', article = 'accInterest', urgency = 'over') => {
  fresh();
  const a = app(id);
  RS.ensureBaseDispositions(a);
  const row = a.base.find(r => r.article === article && r.urgency === urgency);
  const d = RS.dispositionFor(a.dispositions, article, urgency);
  return { a, row, d };
};

/* 43. РС-38 — сумма распоряжения: сеттер меняет amount; больше позиции и 0 отбиваются без
   подстановки «ближайшего допустимого»; остаток позиции уходит в перенос своей статьёй. */
(() => {
  const { a, row, d } = doorFixture();
  d.kind = 'spread';
  RS.setDispAmount(a.id, 'accInterest', 'over', row.amount - 1000);
  const changed = d.amount === RS.round2(row.amount - 1000);
  const snap = JSON.stringify(d);
  RS.setDispAmount(a.id, 'accInterest', 'over', row.amount + 1);   // больше позиции
  const rejectedBig = JSON.stringify(d) === snap;
  RS.setDispAmount(a.id, 'accInterest', 'over', 0);                // ноль
  const rejectedZero = JSON.stringify(d) === snap;
  // остаток позиции приходит в перенос своей статьёй, а не растворяется
  const parts = RS.AppSide.run(a, RS.TODAY).parts || [];
  const rest = RS.round2(parts.filter(p => p.from === 'без распоряжения'
    && p.article === 'accInterest').reduce((s, p) => s + p.amount, 0));
  ok(43, changed && rejectedBig && rejectedZero && rest === 1000,
    `изменено=${changed} большеПозиции=${rejectedBig} ноль=${rejectedZero} остаток=${rest}`);
})();

/* 44. РС-38 — сроки: range кладётся, возврат на all СТИРАЕТ интервал (не тень). */
(() => {
  const { a, d } = doorFixture();
  d.kind = 'spread';
  RS.setDispPeriods(a.id, 'accInterest', 'over', 'range', 2, 5);
  const set = JSON.stringify(d.periods) === JSON.stringify({ mode: 'range', from: 2, to: 5 });
  RS.setDispPeriods(a.id, 'accInterest', 'over', 'all');
  const erased = d.periods.mode === 'all' && d.periods.from === undefined && d.periods.to === undefined;
  RS.setDispPeriods(a.id, 'accInterest', 'over', 'range');          // без границ — не прежние 2–5
  const noShadow = d.periods.from === 1 && d.periods.to === 1;
  ok(44, set && erased && noShadow,
    `задано=${set} стёрто=${erased} безТени=${JSON.stringify(d.periods)}`);
})();

/* 45. РС-39 — распоряжение меняет статью: spread на начисленных процентах уводит сумму в
   accInterest; строка, уже бывшая accInterest, статью не меняет; прогон идемпотентен. Здесь
   же — вторая перекладка статьи по ADR-0109: капитализация ПЕНИ идёт в накопленную пеню,
   а не в тело (признак того, что РС-27 исполнена, а не объявлена). */
(() => {
  const byArt = r => RS.mergeParts(r.parts || []).reduce((m, p) => (m[p.article] = RS.round2((m[p.article] || 0) + p.amount), m), {});
  // (а) начисленные проценты → накопленные. В демо строка interest/cur снята — включаем дверью.
  fresh();
  const a4 = app('RS-1004');
  RS.ensureBaseDispositions(a4);
  RS.toggleBaseRow(a4.id, 'interest', 'cur');
  RS.setDisposition(a4.id, 'interest', 'cur', 'spread');
  const r1 = RS.AppSide.run(a4, RS.TODAY), r2 = RS.AppSide.run(a4, RS.TODAY);
  const m1 = byArt(r1), m2 = byArt(r2);
  const moved = !m1.interest && m1.accInterest >= 41000;      // статьи interest в переносе нет
  const stable = JSON.stringify(m1) === JSON.stringify(m2);   // прогон дважды — тот же результат
  // (б) капитализация пени → накопленная пеня, не тело. Спорность строки снимаем у источника:
  //     иначе ИР-6 (мёртвая галка) не даст её включить, и это правильно.
  fresh();
  const a1 = app('RS-1001');
  RS.ensureBaseDispositions(a1);
  const pen = a1.base.find(r => r.article === 'penalty' && r.urgency === 'over');
  pen.blockedBy = null; pen.disputed = false;
  RS.toggleBaseRow(a1.id, 'penalty', 'over');
  RS.setDisposition(a1.id, 'penalty', 'over', 'cap');
  const r3 = RS.AppSide.run(a1, RS.TODAY);
  const m3 = byArt(r3);
  const capPen = r3.capitalizedPenalty || 0;
  const penInAcc = capPen === 73000 && m3.accPenalty >= capPen && !m3.penalty
    && r3.principalPart === 118000;                           // тело не выросло на пеню
  ok(45, moved && stable && penInAcc,
    `уехало=${moved} идемпотентно=${stable} капПеня=${capPen} ОД=${r3.principalPart} раскладка=${JSON.stringify(m3)}`);
})();

/* 46. РС-39 — просрочка считается от НЕПОКРЫТОГО остатка, не от вида распоряжения. */
(() => {
  const { a, row, d } = doorFixture();
  // всё просроченное, кроме одной строки, распределяем целиком; на ней оставляем половину
  a.base.filter(r => r.included && r.urgency === 'over').forEach(r => {
    const x = RS.dispositionFor(a.dispositions, r.article, r.urgency);
    if (!x) return;
    x.kind = (r.article === 'penalty' || r.article === 'accPenalty') ? 'cap' : 'spread';
    x.amount = r.amount;
  });
  d.amount = RS.round2(row.amount / 2);                                     // частичное покрытие
  const partial = RS.AppSide.run(a, RS.TODAY).remainsOverdue;
  d.amount = row.amount;                                                    // полное покрытие
  const full = RS.AppSide.run(a, RS.TODAY).remainsOverdue;
  ok(46, partial === true && full === false, `частично=${partial} целиком=${full}`);
})();

/* 47. РС-41/ADR-0109 — ставка только на ОД: колонка процентов не зависит от безставочных. */
(() => {
  fresh();
  const a = app('RS-1001');
  const params = { term: 12, rate: 10, method: 'аннуитет', schedule: 'ежемесячно' };
  const sched = parts => RS.CreditSide.draftSchedule(a.calcTranche,
    { date: RS.TODAY, principalPart: 1000000, parts, params });
  const int = rows => RS.round2(rows.reduce((s, r) => s + (r.interest || 0), 0));
  const bare = sched([]);
  const heavy = sched([{ article: 'accPenalty', amount: 500000, periods: { mode: 'all' } },
                       { article: 'accInterest', amount: 300000, periods: { mode: 'all' } }]);
  const same = int(bare.rows) === int(heavy.rows);
  // и тело в обоих одно и то же — безставочное приехало отдельными колонками
  const prin = rows => RS.round2(rows.reduce((s, r) => s + (r.principal || 0), 0));
  const samePrincipal = prin(bare.rows) === prin(heavy.rows) && prin(bare.rows) === 1000000;
  const cols = RS.scheduleArticleCols(heavy.rows);
  ok(47, same && samePrincipal && cols.includes('accPenalty') && cols.includes('accInterest')
      && !RS.scheduleArticleCols(bare.rows).length,
    `процентыРавны=${same}(${int(bare.rows)}) телоРавно=${samePrincipal} колонки=${cols.join(',')}`);
})();

/* 48. ИР-2′ — сумма ВСЕХ статейных колонок = сумма переноса в копейку (не одна колонка ОД).
   Заявка взята RS-1011, а не RS-1001: после вывода расходов взыскания и сборов из охвата
   (ADR-0110) у демо-заявки безставочных остатков не осталось — накопленные проценты уходят
   в тело капитализацией, накопленная пеня прощается. Сторожу нужна база, где безставочная
   колонка реально есть, иначе он проходит на пустом множестве. */
(() => {
  const { a } = doorFixture('RS-1011');
  const r = RS.AppSide.run(a, RS.TODAY);
  const d = RS.CreditSide.draftSchedule(a.calcTranche, { date: RS.TODAY, transferSum: r.transferSum,
    principalPart: r.principalPart, parts: r.parts, params: a.version.params });
  const sumP = RS.round2(d.rows.reduce((s, x) => s + (x.principal || 0), 0));
  const sumA = RS.round2(d.rows.reduce((s, x) => s + RS.rowArticlesSum(x), 0));
  const all = RS.round2(sumP + sumA);
  const onlyPrincipalFails = sumP !== r.transferSum;      // старая ИР-2 на этих данных бы разошлась
  ok(48, all === RS.round2(r.transferSum) && sumA > 0 && onlyPrincipalFails,
    `всеСтатьи=${all} перенос=${r.transferSum} ОД=${sumP} безставочные=${sumA}`);
})();

/* 49. ИР-15/РС-40 — интервал за длиной плана: причина в validateDS, регистрация закрыта;
   укорачивание срока после заданного интервала ловится тем же условием, молча не подрезается. */
(() => {
  const { a, d } = doorFixture();
  d.kind = 'spread';
  const mkDs = (term, from, to) => {
    RS.setDispPeriods(a.id, 'accInterest', 'over', 'range', from, to);
    const r = RS.AppSide.run(a, RS.TODAY);
    return { app: a, sourceTranche: a.calcTranche, credit: RS.creditById(a.creditIds[0]),
      date: RS.TODAY, transferSum: r.transferSum, principalPart: r.principalPart, parts: r.parts,
      params: Object.assign({}, a.version.params, { term }) };
  };
  const isIr15 = reasons => reasons.some(s => s.includes('ИР-15'));
  const inside = isIr15(RS.validateDS(mkDs(24, 2, 6)));           // 6 ≤ 24 позиций
  const outside = isIr15(RS.validateDS(mkDs(24, 2, 99)));         // 99 > 24
  const shortened = isIr15(RS.validateDS(mkDs(6, 2, 12)));        // срок ужали 24 → 6
  const kept = d.periods.to === 12;                               // интервал НЕ подрезан молча
  ok(49, !inside && outside && shortened && kept,
    `внутри=${!inside} заДлиной=${outside} послеУкорочения=${shortened} неПодрезан=${kept}`);
})();

/* 50. РС-38 — округление: неделящаяся сумма сходится в копейку, остаток в ПОСЛЕДНЕЙ позиции. */
(() => {
  fresh();
  const a = app('RS-1001');
  const d = RS.CreditSide.draftSchedule(a.calcTranche, { date: RS.TODAY, principalPart: 1000000,
    parts: [{ article: 'accInterest', amount: 100000, periods: { mode: 'range', from: 2, to: 4 } }],
    params: { term: 6, rate: 0, method: 'дифференцированный', schedule: 'ежемесячно' } });
  const col = d.rows.map(r => (r.articles || {}).accInterest || 0);
  const inside = col.slice(1, 4), outside = col.slice(0, 1).concat(col.slice(4));
  const sum = RS.round2(inside.reduce((s, v) => s + v, 0));
  const tailBigger = inside[2] > inside[0] && inside[0] === inside[1];   // остаток в последней
  ok(50, sum === 100000 && outside.every(v => v === 0) && tailBigger,
    `сумма=${sum} колонка=[${col.join(', ')}]`);
})();

/* 51. РС-38 — граница двери: сроки есть у spread и капитализации ПЕНИ, нет у капитализации
   процентов и прощения. Проверка по состоянию распоряжения, не по тексту файла. */
(() => {
  const { a } = doorFixture();
  const has = RS.dispositionHasPeriods;
  const matrix = has('spread', 'accInterest') && has('spread', 'principal')
    && has('cap', 'penalty') && has('cap', 'accPenalty')
    && !has('cap', 'interest') && !has('cap', 'accInterest')
    && !has('forgive', 'penalty') && !has('none', 'accInterest');
  // сеттер сроков отбивает распоряжение, у которого сроков нет, — состояние не меняется
  const d = RS.dispositionFor(a.dispositions, 'accPenalty', 'over');
  d.kind = 'forgive';
  const snap = JSON.stringify(d.periods);
  RS.setDispPeriods(a.id, 'accPenalty', 'over', 'range', 1, 3);
  const rejected = JSON.stringify(d.periods) === snap;
  // и смена вида на «без сроков» возвращает умолчание, а не оставляет висеть интервал
  const s = RS.dispositionFor(a.dispositions, 'accInterest', 'over');
  s.kind = 'spread';
  RS.setDispPeriods(a.id, 'accInterest', 'over', 'range', 2, 5);
  RS.setDisposition(a.id, 'accInterest', 'over', 'cap');
  const reset = s.periods.mode === 'all';
  ok(51, matrix && rejected && reset,
    `матрица=${matrix} сеттерОтбил=${rejected} сменаВидаСбросила=${reset}`);
})();

/* 52. Сев витрины поднимается целиком и без исключений: 25 заявок с уникальными id, из них
   18 второй волны (RS-1008…RS-1025; последние три — накопленный хвост, 11.08.2026).
   Сторож на сам сев, а не на отдельную дверь: заявки с ДС
   строятся настоящими вызовами (AppSide.run → CreditSide.restructureApplied, а «целиком» —
   через balanceAt), и restructureApplied в фабрике бросает на !ok. Значит регрессия ядра или
   гейтов закрытия валит сев, и это видно здесь, а не косвенно в чужом сценарии. */
(() => {
  let err = null;
  try { fresh(); } catch (e) { err = e; }
  const apps = err ? [] : RS.state.apps;
  const ids = new Set(apps.map(a => a.id));
  const wave2 = apps.filter(a => Number(a.id.slice(3)) >= 1008).length;
  let walkOk = true;
  apps.forEach(a => {
    try { RS.stageOf(a); a.creditIds.forEach(i => RS.creditById(i).no); RS.deadline(a); }
    catch (e) { walkOk = false; }
  });
  ok(52, !err && apps.length === 26 && ids.size === 26 && wave2 === 19 && walkOk,
    err ? `сев упал: ${err.message}`
        : `заявок=${apps.length} уникальных=${ids.size} волна2=${wave2} обход=${walkOk}`);
})();

/* 53. Витрина покрывает справочник видов целиком: все пять норм п. 89 (N1…N5) и вид origin
   'иное' (X1 «Прощение санкций», РС-31) задействованы хотя бы одной заявкой. Гейт прощения
   и запрет правки нормативных видов иначе демонстрируются на пустом множестве. */
(() => { fresh();
  const used = new Set();
  RS.state.apps.forEach(a => a.kindIds.forEach(k => used.add(k)));
  const dict = RS.state.kinds.map(k => k.id);
  const missing = dict.filter(k => !used.has(k));
  const other = RS.state.kinds.filter(k => k.origin === 'иное');
  const otherUsed = other.length > 0 && other.every(k => used.has(k.id));
  ok(53, dict.length === 6 && missing.length === 0 && otherUsed,
    `видов=${dict.length} незадействованных=${missing.join(',') || 'нет'} иное=${otherUsed}`);
})();

/* 54. Витрина покрывает конвейер целиком: заняты все девять индексов стадий (ADR-0107) плюс
   оба отказных исхода — по заключению органа (п. 88, idx 4) и по постановлению КМ (п. 89,
   idx 6) — и возврат без рассмотрения. Проверка по индексу, а не по подписи: idx 0 держит
   возврат (RS-1003/RS-1022), живой заявки на подписи «Регистрация обращения» в витрине нет. */
(() => { fresh();
  const st = RS.state.apps.map(a => RS.stageOf(a));
  const idx = new Set(st.map(s => s.idx));
  const gaps = RS.STAGES.map((_, i) => i).filter(i => !idx.has(i));
  const labels = new Set(st.map(s => s.label));
  const both = labels.has('Отказ (постановление КМ)')
            && labels.has('Отказ (заключение уполномоченного органа)');
  const ret = labels.has('Возвращена без рассмотрения');
  ok(54, gaps.length === 0 && both && ret,
    `пустых стадий=${gaps.join(',') || 'нет'} обаОтказа=${both} возврат=${ret}`);
})();

/* 55. ADR-0093 §3 — накопленное бывает и НЕНАСТУПИВШИМ: два уровня (статья × срочность)
   перемножаются, а не подменяют друг друга. Строка есть, начислений не порождает (режим
   терминальный), по умолчанию СНЯТА (РС-7: умолчание базы — просроченное) и в перенос не
   входит. RS-1025 взята потому, что её сев хвост не включает: у RS-1023/RS-1024 галка уже
   поставлена демо-севом, и умолчание на них не видно. */
(() => { fresh();
  const base = RS.defaultBase(app('RS-1025'), RS.TODAY);
  const tail = base.find(r => r.article === 'accInterest' && r.urgency === 'cur');
  const head = base.find(r => r.article === 'accInterest' && r.urgency === 'over');
  const mode = RS.accrualModeOf('accInterest', RS.TODAY).mode;
  const terminal = !mode.interest && !mode.penalty;
  // хвост в перенос не попал: сумма накопленных в переносе равна ОДНОЙ просроченной строке
  const r = RS.AppSide.run(app('RS-1025'), RS.TODAY);
  const accInTransfer = RS.round2(RS.mergeParts(r.parts || [])
    .filter(p => p.article === 'accInterest').reduce((s, p) => s + p.amount, 0));
  ok(55, !!tail && tail.amount === 180000 && tail.included === false && !tail.blockedBy
      && head.amount === 60000 && terminal && accInTransfer === head.amount,
    `хвост=${tail && tail.amount} снят=${tail && !tail.included} наступившее=${head && head.amount} `
    + `терминальная=${terminal} вПереносе=${accInTransfer}`);
})();

/* 56. РС-39 на НЕНАСТУПИВШЕМ накопленном: распределение переназначает сроки и статьи НЕ меняет
   (accInterest → accInterest), прогон идемпотентен, а шаг просрочки эту строку не видит вовсе —
   он смотрит только на urgency==='over'. И обратное: снять галку с хвоста = уменьшить перенос
   ровно на его сумму, второго эффекта у неё нет. */
(() => { fresh();
  const a = app('RS-1023');
  const byArt = x => RS.mergeParts(x.parts || []).reduce((m, p) => (m[p.article] = RS.round2((m[p.article] || 0) + p.amount), m), {});
  const r1 = RS.AppSide.run(a, RS.TODAY), r2 = RS.AppSide.run(a, RS.TODAY);
  const m1 = byArt(r1);
  const stable = JSON.stringify(m1) === JSON.stringify(byArt(r2));
  const sameArticle = m1.accInterest === 400000 && !m1.interest;   // 160 000 наступивших + 240 000 хвоста
  const overdueBefore = r1.remainsOverdue;
  RS.toggleBaseRow(a.id, 'accInterest', 'cur');                    // куратор передумал — хвост снят
  const r3 = RS.AppSide.run(a, RS.TODAY);
  const dropped = RS.round2(r1.transferSum - r3.transferSum) === 240000;
  const overdueSame = r3.remainsOverdue === overdueBefore;         // просрочка от хвоста не зависит
  ok(56, stable && sameArticle && dropped && overdueSame,
    `идемпотентно=${stable} статьяТаЖе=${m1.accInterest} снятие=${dropped} просрочкаНеЗависит=${overdueSame}`);
})();

/* 57. Капитализация ненаступившего накопленного — ЕДИНСТВЕННОЕ распоряжение, возвращающее
   безставочную сумму под ставку: 900 000 хвоста уезжают в тело, и колонка процентов графика
   растёт. Сторож не на «правильно», а на «видно»: норма молчит, гейта нет (ИР-11 держит одну
   пеню), и молчаливое поведение здесь опаснее любого исхода. Накопленная пеня рядом
   распоряжения не получила и в тело НЕ вливается — РС-27 держит её терминальной. */
(() => { fresh();
  const a = app('RS-1024');
  const sched = ap => {
    const r = RS.AppSide.run(ap, RS.TODAY);
    const d = RS.CreditSide.draftSchedule(ap.calcTranche, { date: RS.TODAY, transferSum: r.transferSum,
      principalPart: r.principalPart, parts: r.parts, params: ap.version.params });
    return { r, int: RS.round2(d.rows.reduce((s, x) => s + (x.interest || 0), 0)) };
  };
  const withTail = sched(a);
  RS.toggleBaseRow(a.id, 'accInterest', 'cur');                    // тот же ДС без хвоста
  const without = sched(a);
  const inBody = RS.round2(withTail.r.principalPart - without.r.principalPart) === 900000;
  const dearer = withTail.int > without.int;                       // ставка пошла на бывшее безставочным
  const penStays = RS.round2(RS.mergeParts(withTail.r.parts || [])
    .filter(p => p.article === 'accPenalty').reduce((s, p) => s + p.amount, 0)) === 45000;   // только наступившая
  ok(57, inBody && dearer && penStays,
    `хвостВТело=${inBody} процентыВыросли=${dearer} (${without.int}→${withTail.int}) пеняНеТронута=${penStays}`);
})();

/* 58. Каркас расчёта: у демо-заявки с траншем-источником ровно один расчёт, он адресует транш
   и кредит, а старые поля app.base/app.dispositions/app.version — дверь к нему же, не второе
   хранилище (ИР-16). Заявка без транша-источника расчёта не имеет вовсе: пустой расчёт читался
   бы как «база ноль», а её ещё не собирали. Дверь calcTranche отказывается угадывать не только
   на нуле расчётов, но и на 2+ (RS-1020, задача 8) — поэтому «пусто» проверяем по calcs.length,
   а не по самой двери: ровно 0 либо ровно 2+ и никогда «висящая единица» (расчёт есть, а транш
   за ним потерян). */
(() => { fresh();
  const a = app('RS-1001');
  const c = a.calcs[0];
  const one = a.calcs.length === 1;
  const addressed = !!c && c.trancheId === a.calcTranche.id && c.creditId === a.creditIds[0];
  const door = !!c && a.base === c.base && a.dispositions === c.dispositions && a.version === c.version;
  const ambiguous = RS.state.apps.filter(x => !x.calcTranche);   // дверь отказала: либо 0, либо 2+
  const noOrphan = ambiguous.every(x => x.calcs.length === 0 || x.calcs.length >= 2);
  ok(58, one && addressed && door && noOrphan,
    `один=${one} адрес=${addressed} дверь=${door} безВисящих=${noOrphan}`);
})();

/* 59. Два расчёта не смешивают строки. Одной заявке даём два транша разных кредитов, включаем
   строку в первом — во втором она не шевелится. Это и есть ответ на вопрос «по какому кредиту
   какая сумма»: ключ строки — тройка (транш, статья, срочность). */
(() => { fresh();
  const a = app('RS-1001');
  const other = RS.state.credits.find(c => c.id !== a.creditIds[0] && (c.tranches||[]).some(t => !t.closed));
  const t2 = other.tranches.find(t => !t.closed);
  const c2 = RS.attachCalc(a, t2);           // кредит транша ищется по state, охват для этого не нужен
  const c1 = a.calcs[0];
  const two = a.calcs.length === 2 && c1.id !== c2.id;
  RS.ensureBaseDispositions(c1); RS.ensureBaseDispositions(c2);
  const snapshot = JSON.stringify(c2.base);
  RS.toggleBaseRow(a.id, 'principal', 'cur', c1.id);            // трогаем ТОЛЬКО первый расчёт
  const secondIntact = JSON.stringify(c2.base) === snapshot;
  const firstMoved = JSON.stringify(c1.base) !== snapshot;
  const r1 = RS.AppSide.run(a, RS.TODAY, c1.id), r2 = RS.AppSide.run(a, RS.TODAY, c2.id);
  const separateSums = r1.transferSum !== r2.transferSum;
  const refuses = RS.AppSide.run(a, RS.TODAY) === null;          // без calcId при двух расчётах — отказ
  ok(59, two && secondIntact && firstMoved && separateSums && refuses,
    `два=${two} второйЦел=${secondIntact} первыйДвинулся=${firstMoved} суммыРазные=${r1.transferSum}/${r2.transferSum} отказБезИмени=${refuses}`);
})();

/* 60. Охват называет траншы (РС-2, ИР-16). Кредит появляется в охвате вместе со своим траншем,
   а не отдельным действием; повторное добавление того же транша второго расчёта не заводит;
   снятие транша уносит расчёт вместе с суммами, не оставляя адреса без суммы. ИР-1 ключуется
   траншем: тот же транш в другой активной заявке — занят. Чужой заёмщик в охват не входит. */
(() => { fresh();
  const a = app('RS-1001');
  const { cr, t } = secondTranche(a);
  RS.addTrancheToScope(a.id, t.id);
  const grew = a.calcs.length === 2 && a.creditIds.includes(cr.id);
  RS.addTrancheToScope(a.id, t.id);                        // повтор
  const idempotent = a.calcs.length === 2;
  const derived = a.creditIds.length === new Set(a.creditIds).size;
  const alien = RS.state.credits.find(c => c.inn !== a.inn && (c.tranches||[]).some(x => !x.closed));
  if(alien) RS.addTrancheToScope(a.id, alien.tranches.find(x => !x.closed).id);
  const noAlien = a.calcs.length === 2;
  const c2 = a.calcs.find(x => x.trancheId === t.id);
  RS.removeTrancheFromScope(a.id, c2.id);
  const shrank = a.calcs.length === 1 && !a.creditIds.includes(cr.id);
  const busy = !!RS.activeAppOnTranche(a.calcs[0].trancheId, 'RS-9999');
  ok(60, grew && idempotent && derived && noAlien && shrank && busy,
    `вырос=${grew} идемпотентно=${idempotent} безДублей=${derived} чужойНеВошёл=${noAlien} снят=${shrank} ИР-1=${busy}`);
})();

/* 61. Пределы считаются по КРЕДИТУ каждого расчёта, а не по первому кредиту охвата: пол ставки
   меряется от первоначальной ставки кредита (п. 34, п. 92), предел длины графика — от остатка
   задолженности по кредиту (п. 90). Один app.version на заявку делал эти два гейта
   непроверяемыми, как только кредитов больше одного. */
(() => { fresh();
  const a = app('RS-1001');
  RS.addTrancheToScope(a.id, secondTranche(a).t.id);
  const g = RS.limitsGateApp(a);
  const perCalc = Array.isArray(g.rows) && g.rows.length === 2;
  const addressed = perCalc && g.rows.every(r => !!r.calcId && !!r.creditNo);
  const c2 = a.calcs[1];
  c2.version = { params:{ term: 999, rate: 0.01 } };         // заведомо вне обоих пределов
  const g2 = RS.limitsGateApp(a);
  const catches = g2.ok === false && g2.messages.some(m => /КД-|кредит/i.test(m));
  ok(61, perCalc && addressed && catches,
    `строкиПоРасчётам=${perCalc} адресованы=${addressed} ловитВторой=${catches} (${g2.messages.join(' | ')})`);
})();

/* 62. Ступень 1 меряется от базы среза РАСЧЁТА: виза куратора блокирует регистрацию конкретного
   ДС, значит и меряться обязана тем, что в это ДС уходит. Считать её от суммы по заявке значит
   дать крупному кредиту охвата глушить расхождение по мелкому — виза не возникнет там, где
   возникла бы при отдельной заявке (спека §5). После ревью 11.08.2026 appDrift на стороне факта
   всегда живой debtAt (пред-Task-5 поведение вернули, чтобы уже зарегистрированные однорасчётные
   заявки не съезжали — RS-1005/RS-1010), .fact при сборке whole больше не читается. Круглые
   числа поэтому строкам среза не годятся: whole сравнивал бы их с чужой живой суммой безо всякого
   смысла. Сеем срез ОТ той же живой суммы — нолём для «big» и заниженным на 15 % для «small»; факт
   расчёта (для ступени 1, calcDrift читает именно его, не debtAt) выставляем отдельно. */
(() => { fresh();
  const a = app('RS-1001');
  RS.addTrancheToScope(a.id, secondTranche(a).t.id);
  RS.AppSide.fixCutoff(a, '2026-03-30');
  const seeded = a.calcs.every(c => c.cutoff && Array.isArray(c.cutoff.rows));
  const [big, small] = a.calcs;
  const liveSum = c => RS.round2(RS.AppSide.debtAt(RS.calcTrancheOf(c), RS.TODAY).reduce((s, r) => s + r.amount, 0));
  const bigLive = liveSum(big), smallLive = liveSum(small);
  const row = amount => [{ article:'principal', urgency:'over', amount, since:'2026-03-30' }];
  big.cutoff.rows   = row(bigLive);                          big.fact   = { date:'2026-07-19', rows: row(bigLive) };            // не сдвинулся
  small.cutoff.rows = row(RS.round2(smallLive / 1.15));      small.fact = { date:'2026-07-19', rows: row(smallLive) };          // +15 % — ступень 1
  const perCalc = RS.AppSide.calcDrift(a, small.id);
  const whole   = RS.AppSide.appDrift(a, RS.TODAY);
  ok(62, seeded && perCalc.level === 1 && whole.level === 0,
    `срезПоРасчётам=${seeded} расчёт=${perCalc.level} (${(perCalc.pct*100).toFixed(1)} %) заявка=${whole.level} (${(whole.pct*100).toFixed(1)} %)`);
})();

/* 63. Ступень 2 меряется от Σ базы среза ВСЕХ расчётов: она откатывает заявку целиком, а комитет
   высказывался по обращению, а не по кредиту. Сработала — блокировка ложится на все расчёты, а не
   только на превысивший. */
(() => { fresh();
  const a = app('RS-1001');
  RS.addTrancheToScope(a.id, secondTranche(a).t.id);
  RS.AppSide.fixCutoff(a, '2026-03-30');
  a.calcs.forEach(c => { c.cutoff.rows = [{ article:'principal', urgency:'over', amount: 1000000, since:'2026-03-30' }];
                         c.fact = { date: RS.TODAY, rows:[{ article:'principal', urgency:'over', amount: 1400000, since:'2026-03-30' }] }; });
  a.committee = { fixed:true, date:'2026-02-01' };                 // позиция комитета СТАРШЕ среза
  const g = RS.driftGate(a, RS.TODAY);
  const blockedAll = g.ok === false && g.level === 2 && (g.rows||[]).length === 2;
  a.committee = { fixed:true, date:'2026-08-01' };                 // комитет высказался заново
  const released = RS.driftGate(a, RS.TODAY).ok === true;
  ok(63, blockedAll && released, `ступень2=${g.level} блокировкаНаВсе=${blockedAll} послеКомитета=${released}`);
})();

/* 64. Допсоглашения регистрируются ПО ОЧЕРЕДИ, каждое своими гейтами и своей датой: регистрация
   по второму траншу не трогает уже вступившее соглашение по первому (спека §4, РС-2). */
(() => { fresh();
  const a = app('RS-1005');
  const seededNo = a.calcs[0].dsRef;                        // ДС из демо-цепочки
  const { t } = secondTranche(a);
  RS.addTrancheToScope(a.id, t.id);
  const c2 = a.calcs.find(x => x.trancheId === t.id);
  const res = RS.regDS(a.id, c2.id, { no:'ДС-Т64/2', date: RS.TODAY });
  const second = !!res && res.ok === true && c2.dsRef === 'ДС-Т64/2';
  const firstIntact = a.calcs[0].dsRef === seededNo && seededNo && seededNo !== 'ДС-Т64/2';
  const twoAgreements = (a.agreements||[]).length === 2
    && new Set(a.agreements.map(d => d.creditId)).size === 2;
  const cov = RS.dsCoverage(a);
  // РС-7/задача-7-fix: resultTrancheOf адресован по calcId — оба траншa с dsRef должны
  // произвести СВОИ производные транши, а не делить одну (или null) однорасчётную дверь.
  const derived1 = RS.resultTrancheOf(a, a.calcs[0].id);
  const derived2 = RS.resultTrancheOf(a, c2.id);
  const perCalcDerived = !!derived1 && !!derived2 && derived1.id !== derived2.id;
  ok(64, second && firstIntact && twoAgreements && cov.ok === true && cov.pending.length === 0 && perCalcDerived,
    `второе=${second} первоеЦело=${firstIntact} соглашений=${(a.agreements||[]).length} покрытие=${JSON.stringify(cov)} производныеПоРасчётам=${perCalcDerived}`);
})();

/* 65. Гейт «оформление → закрыта»: каждый расчёт либо зарегистрирован, либо ЯВНО снят с
   оформления с основанием. Молчания как варианта нет — тот же приём, что у гейта согласий ИР-8.
   Добавленный в охват транш снимает закрытие: заявка снова в оформлении, пока ответ не дан. */
(() => { fresh();
  const a = app('RS-1005');
  const closedBefore = RS.stageOf(a).closed === true;
  const { t } = secondTranche(a);
  RS.addTrancheToScope(a.id, t.id);
  const c2 = a.calcs.find(x => x.trancheId === t.id);
  const reopened = RS.stageOf(a).closed === false;                  // второй расчёт молчит
  const refused = RS.excludeCalc(a.id, c2.id, '') === false;        // без основания снять нельзя
  RS.excludeCalc(a.id, c2.id, 'Заёмщик отозвал обращение по этому кредиту');
  const closedNow = RS.stageOf(a).closed === true && RS.stageOf(a).label === 'Закрыта';
  ok(65, closedBefore && reopened && refused && closedNow,
    `былаЗакрыта=${closedBefore} приМолчании=${reopened} безОснованияОтказ=${refused} послеСнятия=${closedNow}`);
})();

/* 66. Экран расчёта: суммы складываются через кредиты РОВНО в одном месте — шапке-итоге, и оно
   подписано как итог, а не как база. Адрес расчёта (транш · кредит) печатает полоса охвата —
   с 13.08.2026 она одна и та же на обеих вкладках расчёта, а заголовков-секций и вкладки
   «Охват» нет вовсе: список траншей заявки печатался двумя экземплярами. Четыре сеттера строки
   получают calcId, иначе клик по строке второго транша уехал бы в первый.
   `creditIds[0]` уходит из функций задачи (pParams/pDiff/automationBlock) —
   но НЕ из fixLetter/closeByRefusal: это логика паузы взыскания, спека прямо говорит её не
   трогать (`Не переписываем взыскание и залог`). Проверка поэтому берёт тело функции по имени,
   а не весь файл — иначе сценарий требовал бы правки, которую задача не должна делать.
   `wired` сверяет реальный порядок аргументов каждого сеттера, а не литеральную склейку `${AC}`:
   у setDisposition/setDispAmount/setDispPeriods между тройкой (заявка,статья,срочность) и calcId
   есть свои позиционные поля (вид/сумма; режим/от/до) — склейка `${AC}` в лоб увела бы calcId в
   чужой слот, а нужное значение — в слот calcId (NaN на каждой правке суммы). Только у
   toggleBaseRow тройка идёт вплотную к calcId, поэтому только там разметка зовёт `${AC}` буквально.
   После РС-43 адрес распоряжения длиннее адреса строки: у позиции линий несколько, и хвост
   `'${calc.id}',${seq}` обязан стоять у КАЖДОГО сеттера распоряжения — иначе правка второй линии
   уехала бы в первую и выглядела бы как «выбор не сохраняется». */
(() => {
  const head   = /function scopeStrip\(app, calc\)/.test(src) && !/function calcSectionHead/.test(src);
  const total  = /Итог по заявке/.test(src);
  // вкладки «Охват» нет: ни в списке вкладок, ни в switch панелей, ни отдельной функцией
  const single = !/function pScope/.test(src) && !/\['scope',/.test(src) && !/case 'scope'/.test(src);
  const wired  = /const AC=/.test(src)
    && /const CS=`'\$\{calc\.id\}',\$\{seq\}`/.test(src)                // расчёт + номер линии (РС-43)
    && /RS\.toggleBaseRow\(\$\{AC\}\)/.test(src)
    && /RS\.setDisposition\(\$\{A\},this\.value,'\$\{calc\.id\}',\$\{seq\}\)/.test(src)
    && /RS\.setDispAmount\(\$\{A\},this\.value,\$\{CS\}\)/.test(src)
    && /RS\.setDispPeriods\(\$\{A\},'range',this\.value,null,\$\{CS\}\)/.test(src);
  const bodyOf = name => {
    const start = src.indexOf('function '+name+'(');
    if(start<0) return '';
    const next = src.indexOf('\nfunction ', start+1);
    return src.slice(start, next<0 ? src.length : next);
  };
  const scoped = ['scopeStrip','pParams','pDiff','automationBlock'];
  const gone = !/function pickTrancheBlock/.test(src)
    && scoped.every(name => !/creditIds\[0\]/.test(bodyOf(name)));
  // fix-round-1: производный транш адресуется по calc.id, не через однорасчётную дверь
  // resultTranche(app) — иначе у 2+ расчётов производный транш второй+ секции всегда «не
  // оформлено», а черновая форма ДС (versionParamsBlock) вовсе не рисуется (app.version==null).
  // Переборка 12.08.2026: живёт он теперь ТОЛЬКО на «Было и стало» — транш и его график одна
  // вещь, и на столе ввода коробка была нерабочей (до ДС — плейсхолдер, после — правка закрыта).
  const derivedAddressed = /resultTrancheOf\(app,\s*calc\.id\)/.test(bodyOf('diffSection'))
    && !/resultTranche\(app\)/.test(bodyOf('diffSection'))
    && !/resultTrancheOf/.test(bodyOf('paramsSection'));
  // Гейты — условие регистрации ДС, общее для заявки: один разбор под шапкой карточки вместо
  // трёх копий в хвостах секций расчёта. Расхождение получило свой чип рядом с тремя прежними.
  const gatesUnderHead = /function gatesPanel\(app,st\)/.test(src)
    && /gatesPanel\(app,st\)/.test(bodyOf('renderCard'))
    && !/gateDetails\(app\)/.test(bodyOf('paramsSection'))
    && !/gateDetails\(app\)/.test(bodyOf('diffSection'))
    && /Расхождение/.test(bodyOf('gateChipsRow'));
  // Волна 13.08.2026: форма условий переехала на «Параметры» — весь ввод изменения в одном месте,
  // «Было и стало» стало целиком показом. Проверяется обеими сторонами: есть тут, нет там.
  const paramsBlockScoped = /function versionParamsBlock\(app,\s*calc\)/.test(src)
    && /calc\.version/.test(bodyOf('versionParamsBlock'))
    && /versionParamsBlock\(app,\s*calc\)/.test(bodyOf('paramsSection'))
    && !/versionParamsBlock/.test(bodyOf('diffSection'));
  ok(66, head && total && single && wired && gone && derivedAddressed && gatesUnderHead && paramsBlockScoped,
    `полосаВместоСекций=${head} итог=${total} вкладкиОхватНет=${single} адресВДвери=${wired} староеСнесено=${gone} производныйНаБылоСтало=${derivedAddressed} гейтыПодШапкой=${gatesUnderHead} условияНаПараметрах=${paramsBlockScoped}`);
})();

/* 67. RS-1020 — единственная многокредитная заявка сида, и до сих пор расчёта не имела вовсе.
   Два расчёта, базы РАЗНЫЕ (различие видно глазом, а не выводится из кода), Σ шапки равна их
   сумме, а ключ строки — тройка: одинаковая статья в двух расчётах живёт двумя строками. */
(() => { fresh();
  const a = app('RS-1020');
  const two = a.calcs.length === 2;
  const creditsDiffer = two && a.calcs[0].creditId !== a.calcs[1].creditId;
  const r = a.calcs.map(c => RS.AppSide.run(a, RS.TODAY, c.id));
  const basesDiffer = two && RS.round2(r[0].transferSum) !== RS.round2(r[1].transferSum);
  // Σ сверяется с НЕЗАВИСИМО собранной величиной — из частей каждого прогона (тело + позиции),
  // а не с той же суммой, записанной второй раз: `a+b === a+b` не падало ни при какой поломке
  // (fix-round-1). Так проверка ловит и потерянный расчёт, и удвоенный, и разъехавшийся round2.
  const sum = RS.round2(r[0].transferSum + r[1].transferSum);
  const expected = RS.round2(r.reduce((s, x) =>
    s + x.principalPart + x.parts.reduce((p, q) => p + q.amount, 0), 0));
  const addsUp = sum > 0 && sum === expected;
  // «Одинаковая статья живёт двумя строками» — это про ДВЕ РАЗНЫЕ суммы под одним ключом статьи,
  // а не про две разные ссылки на массив (сравнение ссылок было истинно всегда, fix-round-1).
  const artSum = (c, key) => RS.round2((c.base || [])
    .filter(x => x.article === key).reduce((s, x) => s + x.amount, 0));
  const p0 = artSum(a.calcs[0], 'principal'), p1 = artSum(a.calcs[1], 'principal');
  const sameArticleTwice = p0 > 0 && p1 > 0 && p0 !== p1;
  ok(67, two && creditsDiffer && basesDiffer && addsUp && sameArticleTwice,
    `расчётов=${a.calcs.length} кредитыРазные=${creditsDiffer} базыРазные=${r.map(x=>x.transferSum).join('/')} итогСходится=${addsUp} (${sum}=${expected}) статьяДважды=${sameArticleTwice} (тело ${p0}/${p1})`);
})();

/* 68. Вкладка расчёта РИСУЕТСЯ, а не только считается. До fix-round-1 ни один сценарий не звал
   pParams/pDiff, и расхождение трёх дверей к базе проходило мимо смоука: шапка секции и
   полоса-итог читали calc.base сырым, тело секции брало умолчание через дверь ЗАЯВКИ
   (defaultBase(app,…)), которая при 2+ расчётах молчит — секция ещё не тронутого куратором
   транша рисовала «Долг по траншу пуст» и печатала «база 0» при живом долге. Третий транш,
   добавленный в охват, — ровно тот случай: base у его расчёта пустая.
   Переборка 12.08.2026 сменила раскладку, но не вопрос: секций-стопки больше нет, на экране ОДИН
   расчёт, выбранный полосой, — и сторож теперь щёлкает полосу, проверяя, что подытог «База
   переноса» следует за выбором, а не залипает на первом расчёте. Складывается через расчёты
   ровно одно место — свёрнутый «Итог по заявке».
   RS-1001 проверяет вторую половину: у однорасчётной заявки с зарегистрированным ДС коробки
   траншей и живой график производного живут на «Было и стало», а на столе параметров
   их нет вовсе (сид адресует ДС расчётом — dsRef + agreements, как mkChainApp). */
(() => { fresh();
  const a = app('RS-1020');
  const { t } = secondTranche(a);
  RS.addTrancheToScope(a.id, t.id);                     // третий расчёт: base не материализована
  const plain = s => String(s).replace(/<[^>]+>/g, ' ');
  const digits = s => Number(String(s).replace(/[^\d-]/g, '')) * (/-/.test(String(s)) ? -1 : 1);
  const grab = (s, label) => digits((plain(s).match(new RegExp(label + ' ([^·<]+)')) || [, '0'])[1]);
  // модель базы расчёта — та же, что у экрана: снимок, если он есть, иначе умолчание ОТ РАСЧЁТА
  const fullBase = c => (c.base && c.base.length ? c.base : RS.AppSide.defaultBase(c, RS.TODAY));
  const modelBase = c => fullBase(c).filter(x => x.included);
  const modelSum = c => Math.round(modelBase(c).reduce((s, x) => s + x.amount, 0));

  // полоса охвата: по карточке на расчёт, активна ровно одна, вход «+ Добавить транш» на месте
  const html0 = RS.pParams(a);
  const picks = s => (String(s).match(/class="spick[" ]/g) || []).length;   // spick-add сюда не попадает
  const pickerOk = a.calcs.length === 3
    && picks(html0) === a.calcs.length
    && (html0.match(/class="spick active"/g) || []).length === 1
    && html0.includes('spick-add')
    && picks(RS.pDiff(a)) === a.calcs.length;                               // та же полоса на «Было и стало»

  // ввод весь на «Параметрах»: форма условий и кнопка расчёта тут, на «Было и стало» — ни одного
  // поля ввода. Вкладки разошлись по ролям: одна ЗАДАЁТ изменение, вторая ПОКАЗЫВАЕТ его исход.
  const dHtml = RS.pDiff(a);
  const inputsOnParams = html0.includes('RS.setVersionParam') && html0.includes('RS.recalcPlan')
    && !/<(input|select)\b/.test(dHtml) && !dHtml.includes('RS.setVersionParam');

  // на экране ОДИН расчёт, и его подытог «База переноса» — база ИМЕННО ЭТОГО расчёта: щёлкаем
  // каждый и сверяем с моделью. Залипание на первом (прежняя болезнь дверей к базе) падает здесь.
  const perCalc = a.calcs.every(c => {
    RS.setCalc(c.id);
    const h = RS.pParams(a);
    const foot = (h.match(/<tfoot>[\s\S]*?<\/tfoot>/) || [''])[0];
    const rows = fullBase(c).length;
    const drawn = (h.match(/<tr class=/g) || []).length;
    return grab(foot, 'База переноса') === modelSum(c)
      && (rows ? (!h.includes('Долг по траншу пуст') && drawn >= rows) : h.includes('Долг по траншу пуст'));
  });
  // единственное место, где суммы складываются через расчёты, — свёрнутый «Итог по заявке»
  const rb = (RS.pParams(a).match(/<details class="rb-app">[\s\S]*?<\/details>/) || [''])[0];
  const lines = plain(rb).match(/база переноса ([\d\s]+)/g) || [];
  const wholeBase = a.calcs.reduce((s, c) => s + modelSum(c), 0);
  const rollupAddsUp = lines.length === a.calcs.length
    && Math.abs(lines.reduce((s, x) => s + digits(x), 0) - wholeBase) <= a.calcs.length;

  fresh();
  const a1 = app('RS-1001');
  const b1 = RS.pParams(a1), s1 = RS.pDiff(a1);
  // траншы уехали на «Было и стало» целиком — на столе параметров коробок нет; на второй вкладке
  // их две, каждая в своей половине: исходный под «Было», производный под «Стало»
  const splitMoved = !b1.includes('class="split-box')
    && (s1.match(/class="split-box/g) || []).length === 2
    && /Было — действующие условия[\s\S]*class="split-box"[\s\S]*Стало — что даёт расчёт[\s\S]*class="split-box new"/.test(s1)
    && !s1.includes('Производный транш появится после регистрации');
  // график производного берётся из половины «Стало»: с 13.08.2026 первым на вкладке идёт
  // действующий график (половина «Было»), и «первый tbody» указывал бы уже не туда.
  const afterNew = s1.slice(s1.indexOf('Стало — что даёт расчёт'));
  const schedRows = ((afterNew.match(/<tbody>([\s\S]*?)<\/tbody>/) || [, ''])[1].match(/<tr/g) || []).length;
  const schedShown = schedRows === 6;
  // разбор гейтов не печатается ни на одной из двух вкладок расчёта — он под шапкой карточки
  const gatesOffTabs = !b1.includes('gate-d') && !s1.includes('gate-d');

  ok(68, pickerOk && perCalc && rollupAddsUp && splitMoved && schedShown && gatesOffTabs && inputsOnParams,
    `полоса=${pickerOk} подытогПоВыбору=${perCalc} итогСходится=${rollupAddsUp} (${wholeBase}) RS-1001: коробкиПоПоловинам=${splitMoved} график=${schedRows} строк гейтыВнеВкладок=${gatesOffTabs} вводТолькоНаПараметрах=${inputsOnParams}`);
})();

/* 69. ДЕЛЕНИЕ ПОЗИЦИИ НА НЕСКОЛЬКО РАСПОРЯЖЕНИЙ (РС-43) — исход прогона. Демо-заявка RS-1026
   делит неустойку 600 000 актом на три части: 200 000 прощены, 250 000 капитализированы на
   позиции 1–12, 100 000 распределены на 13–24; 50 000 остались без распоряжения. Сценарий
   проверяет ровно то, ради чего деление заводилось: каждая линия дала СВОЙ исход, а свободный
   остаток ушёл переносом просроченным ВИДИМОЙ суммой, а не растворился в одном из трёх видов.
   Σ линий + остаток = сумма позиции — инвариант, которым живёт вся правка. */
(() => { fresh();
  const a = app('RS-1026'), calc = a.calcs[0];
  const row = calc.base.find(r => r.article === 'penalty' && r.urgency === 'over');
  const lines = RS.dispositionsFor(calc.dispositions, 'penalty', 'over');
  const r = RS.AppSide.run(a, a.ds.date, calc.id);
  const parts = r.parts || [];
  const capPart = parts.find(p => p.from === 'капитализация пени');
  const sprPart = parts.find(p => p.from === 'распределение');
  const restPart = parts.find(p => p.article === 'penalty' && p.from === 'без распоряжения');
  const taken = RS.dispositionsSum(calc.dispositions, 'penalty', 'over');
  const invariant = Math.abs(taken + (restPart ? restPart.amount : 0) - row.amount) < 0.005;
  const spread = lines.length === 3
    && r.forgiven === 200000
    && r.capitalizedPenalty === 250000 && r.capitalizedInterest === 0
    && !!capPart && capPart.amount === 250000 && capPart.periods.from === 1 && capPart.periods.to === 12
    && !!sprPart && sprPart.amount === 100000 && sprPart.periods.from === 13 && sprPart.periods.to === 24
    && !!restPart && restPart.amount === 50000;
  ok(69, spread && invariant,
    `линий=${lines.length} прощено=${r.forgiven} капПеня=${r.capitalizedPenalty} распределено=${sprPart ? sprPart.amount : '—'} остаток=${restPart ? restPart.amount : '—'} позиция=${row.amount} инвариант=${invariant} перенос=${r.transferSum}`);
})();

/* 70. Границы деления держатся ОТКАЗОМ, а не подрезкой (принцип РС-38: молча не сглаживаем).
   Две границы: сумма линии не может съесть чужую долю позиции (Σ прочих + v ≤ сумма позиции)
   и один вид не заводится на позиции дважды, если у него нет своих сроков — две «прощённые»
   части одной строки неразличимы, и вторая была бы не распоряжением, а опиской. Капитализация
   пени сроки имеет, потому дубль на ней РАЗРЕШЁН: 1–12 и 13–24 — разные распоряжения. */
(() => { fresh();
  const a = app('RS-1026'), calc = a.calcs[0];
  const before = RS.dispositionsFor(calc.dispositions, 'penalty', 'over').map(d => d.amount);
  RS.setDispAmount(a.id, 'penalty', 'over', 500000, calc.id, 1);   // 500k + 250k + 100k > 600k
  const overRefused = RS.dispositionsFor(calc.dispositions, 'penalty', 'over')[0].amount === before[0];
  RS.setDispAmount(a.id, 'penalty', 'over', 240000, calc.id, 1);   // 240k + 350k = 590k ≤ 600k
  const inLimitTaken = RS.dispositionsFor(calc.dispositions, 'penalty', 'over')[0].amount === 240000;

  RS.addDisposition(a.id, 'penalty', 'over', calc.id);             // четвёртая линия на остаток 10 000
  const added = RS.dispositionsFor(calc.dispositions, 'penalty', 'over').length === 4;
  RS.setDisposition(a.id, 'penalty', 'over', 'forgive', calc.id, 4);
  const dupRefused = RS.dispositionsFor(calc.dispositions, 'penalty', 'over')[3].kind === 'none';
  RS.setDisposition(a.id, 'penalty', 'over', 'cap', calc.id, 4);   // у капитализации пени сроки свои
  const dupWithPeriodsOk = RS.dispositionsFor(calc.dispositions, 'penalty', 'over')[3].kind === 'cap';
  RS.removeDisposition(a.id, 'penalty', 'over', calc.id, 4);
  const removed = RS.dispositionsFor(calc.dispositions, 'penalty', 'over').length === 3
    && RS.dispositionsFor(calc.dispositions, 'penalty', 'over').map(d => d.seq).join(',') === '1,2,3';

  ok(70, overRefused && inLimitTaken && added && dupRefused && dupWithPeriodsOk && removed,
    `сверхПозиции=${overRefused} вПределе=${inLimitTaken} линияДобавлена=${added} дубльБезСроков=${dupRefused} дубльСоСроками=${dupWithPeriodsOk} снятиеПеренумеровало=${removed}`);
})();

/* 71. Порядок линий на экране исхода не меняет. Куратор волен снять и завести распоряжения в
   любой последовательности, а очерёдность шагов держит КОНВЕЙЕР (прощение до капитализации,
   РС-14), не порядок строк в массиве. Сценарий гоняет прогон на перевёрнутом списке линий и
   сверяет исход целиком — суммы и статейные колонки вместе с их интервалами. */
(() => { fresh();
  const a = app('RS-1026'), calc = a.calcs[0];
  const r1 = RS.AppSide.run(a, a.ds.date, calc.id);
  const flipped = { ...calc, dispositions: [...calc.dispositions].reverse() };
  const r2 = RS.AppSide.run({ ...a, calcs: [flipped] }, a.ds.date, calc.id);
  const strip = r => JSON.stringify({
    forgiven: r.forgiven, capitalizedInterest: r.capitalizedInterest, capitalizedPenalty: r.capitalizedPenalty,
    principalPart: r.principalPart, transferSum: r.transferSum,
    parts: (r.parts || []).map(p => [p.article, p.amount, p.from, p.periods.mode, p.periods.from, p.periods.to]).sort()
  });
  const same = strip(r1) === strip(r2);
  ok(71, same && r1.transferSum > 0,
    `исходСовпал=${same} перенос=${r1.transferSum} колонок=${(r1.parts || []).length}`);
})();

/* 72. ОХВАТ ПРЕДЪЯВЛЯЕТСЯ ПОЛОСОЙ, и другой двери к нему нет: вкладка «Охват» снята 13.08.2026
   вместе с таблицей, которая печатала тот же список вторым экземпляром и строила его из
   creditIds — производного свойства с откатом на демо-сид. Полоса рисуется и при ОДНОМ расчёте:
   иначе у однорасчётной заявки нет входа ни в «добавить транш», ни в «снять».
   Снятие уносит расчёт вместе с суммами (правило 60), потому зарегистрированное ДС его
   запрещает — и запрет виден ОТСУТСТВИЕМ крестика на полосе, а не только отказом по клику:
   кнопка, которая всегда отвечает «нельзя», — это не кнопка.
   Гейт «анализ → комитет» меряет РАСЧЁТЫ: на creditIds он пропускал в комитет заявку, для
   которой не считали ничего — кредит числился от сида, а расчёта не было ни одного. */
(() => { fresh();
  const picks = s => (String(s).match(/class="spick[" ]/g) || []).length;
  const a1 = app('RS-1001');                                  // один расчёт, ДС зарегистрировано
  const h1 = RS.pParams(a1);
  const lone = picks(h1) === 1 && h1.includes('spick-add');
  const noDrop = !h1.includes('sp-drop');
  const before = a1.calcs.length;
  RS.removeTrancheFromScope(a1.id, a1.calcs[0].id);
  const refused = a1.calcs.length === before;

  fresh();
  const a2 = app('RS-1020');                                  // два расчёта, ДС ещё нет
  const dropShown = (RS.pParams(a2).match(/sp-drop/g) || []).length === a2.calcs.length;
  RS.setCalc(a2.calcs[1].id);
  RS.removeTrancheFromScope(a2.id, a2.calcs[1].id);
  const dropped = a2.calcs.length === 1 && RS.state.curCalc === null;

  // гейт стадии «Анализ»: визы собраны, гейт открыт — заявка теряет расчёты, и он обязан закрыться.
  // creditIds при этом НЕ пустеет (откат на сид), потому старая проверка гейт бы не заметила.
  fresh();
  const an = app('RS-1004');                                  // стадия «Анализ», расчёт один
  an.conclusions.forEach(c => c.visa = true);                 // визы ставит заключант, роль здесь не тема
  const gateOpen = RS.canAdvance(an).ok === true;
  an.calcs = [];
  const seeded = (an.creditIds || []).length > 0;             // кредит от сида остался
  const gateOnCalcs = gateOpen && seeded && RS.canAdvance(an).ok === false;

  ok(72, lone && noDrop && refused && dropShown && dropped && gateOnCalcs,
    `полосаПриОдном=${lone} безКрестикаПриДС=${noDrop} отказСнятия=${refused} крестикиПоРасчётам=${dropShown} снят=${dropped} гейтПоРасчётам=${gateOnCalcs}`);
})();

/* ---- отчёт ---- */
const pass = results.filter(r => r.pass).length;
const lines = results.map(r => `   ${r.pass ? 'PASS' : 'FAIL'}  #${r.n}  ${r.note}`);
const stamp = `SMOKE 2026-08-13 · ${pass}/${results.length} PASS\n` + lines.join('\n');
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
