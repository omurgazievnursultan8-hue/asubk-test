// Headless smoke для mockups/restructuring/restructuring.html (спека §14, РС-1…РС-25).
// Zero-dep: извлекает <script> из HTML и исполняет чистый логический слой в node:vm
// (без DOM — init/рендер пропускается). Читает только window.RS плюс состояние, уже
// материализованное в демо-заявках RS-1001…RS-1007 при seed(); финансовое ядро
// (debtAt/run/PIPELINE/restructureApplied/balanceAt…) приватно (issues/02, задача 8) —
// там, где сценарий проверяет его устройство, а не результат на демо-данных, проверка
// идёт по исходному тексту файла, не через вызов. Функции, дёргающие render()
// (setRole/toggleBaseRow/setDisposition/setCalcTranche/recalcPlan/regDS…), из headless-
// контекста не зовутся — кроме мест, где их же guard-return отсекает путь до render()
// раньше, чем до document (см. #15).
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

/* 10. ИР-9/РС-16 — терминал по условию: «Закрыта» только когда пройдены все гейты оформления. */
(() => { fresh();
  const s5 = RS.stageOf(app('RS-1005'));
  const s1 = RS.stageOf(app('RS-1001'));
  const closedWhenAllOk = s5.idx === 6 && s5.closed === true;
  const stuckWhileGateFails = s1.idx === 5 && s1.closed === false;
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
  ok(13, a.cutoff.date !== a.ds.date && cutoffP === 5000000 && factP === 4066640 && cutoffP !== factP,
    `срез=${a.cutoff.date}/${cutoffP} факт=${a.ds.date}/${factP}`);
})();

/* 14. РС-7/РС-13 — семь статей долга, ровно две срочности. */
(() => { fresh();
  const base = RS.defaultBase(app('RS-1001'), RS.TODAY);
  const arts = new Set(base.map(r => r.article));
  const urg = new Set(base.map(r => r.urgency));
  const urgOk = [...urg].every(u => u === 'over' || u === 'cur');
  ok(14, base.length === 7 && arts.size === 7 && urgOk, `n=${base.length} arts=${arts.size} urg=${[...urg].join(',')}`);
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

/* 16. Распоряжения по статьям заведены реальной дверью; «по периодам» — задокументированный пробел. */
(() => { fresh();
  const a = app('RS-1001');
  const dCap = RS.dispositionFor(a.dispositions, 'accInterest', 'over');
  const dForgive = RS.dispositionFor(a.dispositions, 'fees', 'over');
  const wired = dCap && dCap.kind === 'cap' && dForgive && dForgive.kind === 'forgive';
  // periods: только два места кладут литерал null (дефолт), только два места читают
  // d.periods (внутри distribute, за проверкой d.periods истинности) — живого пути,
  // который положил бы туда не-null, в файле нет.
  const nullDefaults = (js.match(/periods\s*:\s*null/g) || []).length;
  const dotReads = (js.match(/\.periods\b/g) || []).length;
  ok(16, wired && nullDefaults === 2 && dotReads === 2,
    `wired=${wired} nullDefaults=${nullDefaults} dotReads=${dotReads}`);
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

/* 21. РС-19/ИР-10 — гейт пределов объясняется нормой, не выдуманной редакцией. */
(() => { fresh();
  const capNote = RS.normNote(RS.termCapFor(500000, RS.TODAY).rec);
  const floorNote = RS.normNote(RS.rateFloorFor(8, RS.TODAY).rec);
  const marker = 'пункт не подтверждён';
  ok(21, capNote.includes(marker) && floorNote.includes(marker), `cap="${capNote}" floor="${floorNote}"`);
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

/* ---- отчёт ---- */
const pass = results.filter(r => r.pass).length;
const lines = results.map(r => `   ${r.pass ? 'PASS' : 'FAIL'}  #${r.n}  ${r.note}`);
const stamp = `SMOKE 2026-08-07 · ${pass}/${results.length} PASS\n` + lines.join('\n');
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
