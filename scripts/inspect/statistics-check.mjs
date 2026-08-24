// Headless smoke для mockups/statistics/statistics.html (ИС-1…ИС-20, ADR-0145…0152).
// Zero-dep: вытаскивает <script> из HTML и исполняет логический слой в node:vm (без DOM —
// render() и toast() при отсутствии document становятся no-op, экраны не рисуются).
// Проверяется поведение движка, прогона, защёлки, швов, паспорта и реестров, а не разметка.
// Блоки, которые правят состояние, начинаются с ST.seed() — состояние между ними не течёт.
//   node scripts/inspect/statistics-check.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dir = dirname(fileURLToPath(import.meta.url));
const HTML  = resolve(__dir, '../../mockups/statistics/statistics.html');
const src   = readFileSync(HTML, 'utf8');

const m = src.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('<script> не найден в HTML'); process.exit(1); }
const win = {};
const sandbox = { window: win, console, setTimeout: () => {}, clearTimeout: () => {} };
vm.createContext(sandbox);
vm.runInContext(m[1], sandbox, { filename: 'statistics.inline.js' });
const ST = win.ST;
if (!ST) { console.error('window.ST не экспортирован'); process.exit(1); }

const results = [];
const ok = (n, cond, note = '') => results.push({ n, pass: !!cond, note });
const has = (s, part) => String(s || '').includes(part);
const TODAY = '2026-08-21';

/* ---------- A. Реестры: что вообще можно объявить ---------- */
(() => {
  ST.seed();
  const st = ST.state;
  const badSrc = st.indicators.filter(i => ['шов','поле','агрегат'].indexOf(i.src) < 0);
  const formula = st.indicators.filter(i => 'formula' in i || 'expr' in i || 'выражение' in i);
  const badFn = st.indicators.filter(i => i.src === 'агрегат' && ST.aggFns().indexOf(i.fn) < 0);
  ok(1, st.objects.length === 5 && st.indicators.length >= 25 && badSrc.length === 0 &&
       formula.length === 0 && badFn.length === 0,
    `объектов ${st.objects.length}, показателей ${st.indicators.length}; без объявленного источника ${badSrc.length}, с формулой ${formula.length}, с функцией вне списка ${badFn.length} — ИС-6, ИС-7`);

  const b = ST.OBJ('obj-borrower');
  ok(2, b && b.owner === 'Заёмщики' && b.meas.indexOf('m-bdebt') >= 0 &&
       ST.OBJ('obj-credit').meas.indexOf('m-bdebt') < 0,
    `заёмщик — самостоятельный объект со своими мерами, а не свёртка кредита (ИС-19)`);

  const shape = ST.ROW_SHAPE;
  ok(3, shape.length === 7 && shape.indexOf('som') < 0 && shape.indexOf('доля') < 0 &&
       shape.join(',') === 'obj,ref,date,dims,meas,fixed,by',
    `форма строки закрыта: ${shape.join(' · ')} — ни сомового эквивалента, ни долей, ни дельт (ИС-15)`);

  const edit = ST.tryEditRow();
  const editors = Object.keys(ST).filter(k => /^(edit|update|setRow|patch)/.test(k) && k !== 'tryEditRow');
  ok(4, !edit.ok && has(edit.why, 'ИС-2') && editors.length === 0,
    `правки строки нет ни операцией, ни экраном: «${edit.why}»`);
})();

/* ---------- B. Движок собран из данных ---------- */
(() => {
  const cut = (a, b) => m[1].slice(m[1].indexOf(a), m[1].indexOf(b));
  const builder = cut('function readDim', 'ST.ROW_SHAPE') + cut('function doRun', 'function fixMonth');
  const words = ['кредит','заём','заем','залог','взыскан','поручит','куратор','филиал','просрочк']
    .filter(w => new RegExp(w, 'i').test(builder));
  ok(5, words.length === 0,
    `в сборщике строк (readDim/readMeas/buildRow/doRun) слов предметной области нет${words.length ? ': ' + words.join(', ') : ''} — ИС-18`);

  ST.seed();
  const each = ST.state.objects.map(o => {
    const r = ST.statSlice({obj: o.id, dims: [o.dims[0]], meas: ['a-count'], date: TODAY});
    return {name: o.name, ok: r.ok, n: r.ok ? r.n : 0, g: r.ok ? r.groups.length : 0};
  });
  ok(6, each.every(x => x.ok && x.n > 0),
    `пять объектов одним движком: ${each.map(x => x.name + ' ' + x.n + '/' + x.g + ' групп').join(' · ')}`);

  const cr = ST.statSlice({obj:'obj-credit', dims:['d-branch'], meas:['a-count','a-sumdebt'], date: TODAY});
  const bo = ST.statSlice({obj:'obj-borrower', dims:['d-ptype'], meas:['a-count','a-sumbcnt'], date: TODAY});
  ok(7, cr.ok && bo.ok && cr.dims[0] !== bo.dims[0] && cr.meas[1] !== bo.meas[1] &&
       bo.groups.some(g => g.parts[0] === 'физическое лицо'),
    `непохожая пара на одном движке: кредит по подразделениям (${cr.n}) и заёмщик по типу лица (${bo.n}) — разные разрезы, разные меры, разные множества`);

  const zero = ST.statRows({obj:'obj-borrower', date: TODAY}).rows.find(r => r.ref === '45607195804119');
  ok(8, zero && zero.meas['m-bcnt'].v === 0,
    `заёмщик без действующих кредитов в срезе есть (договоров ${zero && zero.meas['m-bcnt'].v}) — при свёртке кредитов он исчез бы вовсе (ИС-19)`);
})();

/* ---------- C. Шестой объект — строкой реестра, а не релизом ---------- */
(() => {
  ST.seed();
  const before = ST.statSlice({obj:'obj-guarantee', dims:[], meas:['a-count'], date: TODAY});
  const mi = ST.addIndicator({id:'m-gsec', name:'Обеспечиваемые требования', obj:'obj-guarantee',
    src:'шов', seam:'calcDebt', field:'principal', money:true, type:'сумма'});
  const ai = ST.addIndicator({id:'a-sumgsec', name:'Обеспечено требований, итого', obj:'obj-guarantee',
    src:'агрегат', fn:'sum', over:'m-gsec'});
  const add = ST.addObject({id:'obj-guarantee', name:'Поручительство', plural:'поручительства',
    owner:'Обеспечение', refName:'номер поручительства',
    dims:['d-branch','d-curator','d-region','d-ptype'], meas:['m-gsec','a-count','a-sumgsec']});
  const run = ST.run('2026-08-20', {});
  const after = ST.statSlice({obj:'obj-guarantee', dims:['d-region'], meas:['a-count','a-sumgsec'], date:'2026-08-20'});
  ok(9, !before.ok && mi.ok && ai.ok && add.ok && run.ok && after.ok && after.n === 3 && after.groups.length === 3,
    `шестой объект заведён записью: до — «${before.why}», после — ${after.n} объектов в ${after.groups.length} группах, без единой правки движка (ИС-18)`);

  const bad = ST.addObject({id:'obj-ghost', name:'Призрак', dims:[], meas:[]});
  ok(10, !bad.ok && has(bad.why, 'владелец не отдаёт'),
    `объект без множества владельца не заводится: «${bad.why}» — статистика объектов не заводит, она их считает`);
})();

/* ---------- D. Прогон, пропуск, внеплановый пересчёт ---------- */
(() => {
  ST.seed();
  const st = ST.state;
  const planned = st.runs.filter(r => r.kind === 'плановый').length;
  const skipped = st.runs.filter(r => r.kind === 'пропуск');
  ok(11, planned === 5 && skipped.length === 1 && skipped[0].date === '2026-08-19' && !!skipped[0].reason,
    `журнал: плановых прогонов ${planned}, пропуск ${skipped[0].date} — «${skipped[0].reason}»`);

  const future = ST.run('2026-09-01', {});
  const noReason = ST.run(TODAY, {manual: true});
  const good = ST.run(TODAY, {manual: true, reason: 'перезалив курса за 18.08'});
  const rec = ST.state.runs.slice(-1)[0];
  ok(12, !future.ok && !noReason.ok && has(noReason.why, 'без причины') && good.ok &&
        rec.kind === 'внеплановый' && !!rec.actor && rec.reason === 'перезалив курса за 18.08',
    `внеплановый пересчёт — с актором и причиной: «${noReason.why}»; записан как ${rec.kind}, ${rec.actor}`);

  ST.seed();
  const noWhy = ST.skip(TODAY, '');
  const sk = ST.skip(TODAY, 'окно обслуживания СУБД');
  ok(13, !noWhy.ok && has(noWhy.why, 'причины') && sk.ok,
    `пропуск без причины не записывается: «${noWhy.why}»`);
})();

/* ---------- E. Защёлка одна, и у неё есть фамилия ---------- */
(() => {
  ST.seed();
  const closed = ST.run('2026-06-30', {});
  ok(14, !closed.ok && has(closed.why, 'ИС-8') && has(closed.why, 'ADR-0089'),
    `в зафиксированный период не пишет никто: «${closed.why}»`);

  const noActor = ST.closePeriod('2026-07', '');
  const outOfOrder = ST.closePeriod('2026-08', 'Осмонова Г.');
  const done = ST.closePeriod('2026-07', 'Осмонова Г., главный бухгалтер');
  const f = ST.fixationOfMonth('2026-07');
  ok(15, !noActor.ok && has(noActor.why, 'ИС-9') && !outOfOrder.ok && done.ok && f &&
        f.by === 'Осмонова Г., главный бухгалтер' && done.fixed > 0,
    `фиксация без актора невозможна («${noActor.why}»); закрытие июля человеком зафиксировало строк — ${done.fixed}`);

  const notEnded = ST.closePeriod('2026-08', 'Осмонова Г.');
  ok(16, !notEnded.ok && has(notEnded.why, 'ещё не завершён'),
    `незавершённый период не закрывается: «${notEnded.why}» — своего «периода статистики» нет (ИС-9)`);

  const bl = ST.periodBlockers('2026-08');
  ok(17, bl.blockers.length === 0 && bl.warnings.length === 1 && has(bl.warnings[0], '19.08.2026'),
    `статистика период не запирает: блокировок ${bl.blockers.length}, предупреждение — «${bl.warnings[0]}» (ИС-20)`);
})();

/* ---------- F. Паспорт ответа ---------- */
(() => {
  ST.seed();
  const bad = ST.emit({x: 1}, {asOf: null, fixation: null, scope: null});
  ok(18, !bad.ok && has(bad.why, 'ИС-10') && has(bad.why, 'дата расчёта'),
    `ответа без паспорта не бывает: «${bad.why}»`);

  const s = ST.statSlice({obj:'obj-credit', dims:['d-branch'], meas:['a-count'], date: TODAY});
  const r = ST.statRows({obj:'obj-credit', date: TODAY});
  const q = ST.statSeries({obj:'obj-credit', meas:'a-sumdebt', dates:['2026-05-31','2026-06-30','2026-07-31','2026-08-18']});
  const full = [s, r, q].every(x => x.ok && x.passport && x.passport.asOf && x.passport.fixation && x.passport.scope && x.passport.filter);
  ok(19, full && ST.seams().length === 3,
    `все три шва (${ST.seams().join(' · ')}) отдают паспорт с датой расчёта, признаком фиксации и областью видимости — ИС-10`);

  const p = s.passport;
  ok(20, p.asOf === '2026-08-18' && p.substituted === true && p.age === 3 &&
        has(p.skipped, '19.08.2026') && has(p.skipped, 'пропуск'),
    `спрошено 21.08, отдано на ${p.asOf} · возраст ${p.age} дн. · почему: ${p.skipped} — ИС-12`);

  ok(21, q.passport.fixation === 'смешанно' && q.points[0].fixation === 'зафиксировано' &&
        q.points[3].fixation === 'не зафиксировано',
    `ряд честно называется смешанным: ${q.points.map(x => x.date.slice(0,7) + ' ' + x.fixation).join(' · ')} — ИС-10`);

  const may = ST.statSlice({obj:'obj-credit', dims:[], meas:['a-count'], date:'2026-05-31'});
  const d = ST.divergence('2026-05', 'obj-credit', 'm-debt');
  ok(22, may.passport.fixation === 'зафиксировано' && has(may.passport.divergence, 'корректировка') &&
        d.ok && d.shown && d.delta === 16320.17 && d.today > d.fixed,
    `май зафиксирован (${may.passport.fixedBy}); расхождение названо строкой: было ${d.fixed}, сегодняшний пересчёт дал бы ${d.today} — ИС-11`);
})();

/* ---------- G. Роли режут строки ДО группировки ---------- */
(() => {
  ST.seed();
  const all = ST.statSlice({obj:'obj-credit', dims:['d-branch'], meas:['a-count','a-sumdebt'], date: TODAY});
  ST.setRole('Аналитик');
  const mine = ST.statSlice({obj:'obj-credit', dims:['d-branch'], meas:['a-count','a-sumdebt'], date: TODAY});
  const list = ST.registryList('obj-credit', '2026-08-18');
  const refs = mine.groups.reduce((a, g) => a.concat(g.refs), []).sort();
  ok(23, mine.n < all.n && refs.join('|') === list.join('|') &&
        mine.groups.every(g => g.n === g.refs.length),
    `аналитик видит ${mine.n} из ${all.n}: множество урезано ДО группировки, чужого ref нет ни в одной группе — ИС-13`);

  ok(24, has(mine.passport.scope, 'Аналитик') && has(mine.passport.scope, 'Бекова Н.') &&
        !has(all.passport.scope, 'куратор'),
    `область видимости названа в паспорте: «${mine.passport.scope}»`);

  const totalAll = all.total['a-sumdebt'].v, totalMine = mine.total['a-sumdebt'].v;
  ok(25, totalMine < totalAll,
    `итог аналитика (${Math.round(totalMine)}) — не итог системы (${Math.round(totalAll)}): закрытая сумма не добывается вычитанием двух доступных срезов`);

  ST.setRole('Наблюдатель');
  ok(26, ST.canBuild() === false && ST.canAdmin() === false && ST.addIndicator({id:'x'}).ok === false,
    `наблюдателю конструктор и реестры закрыты — отказ по праву доступа, а не пропавшая кнопка`);
  ST.setRole('Администратор статистики');
})();

/* ---------- H. Валюта, потоки, представление ---------- */
(() => {
  ST.seed();
  const rows = ST.statRows({obj:'obj-credit', date:'2026-08-18'}).rows;
  const usd = rows.find(r => r.ref === 'КД-2025/043');
  const cell = usd.meas['m-debt'];
  const stored = rows.some(r => Object.keys(r.meas).some(k => 'som' in r.meas[k] || 'share' in r.meas[k]));
  ok(27, cell.cur === 'USD' && cell.rate === 88.30 && cell.rateDate === '2026-08-18' && !stored,
    `сумма — в валюте договора с курсом и датой курса (${cell.v} ${cell.cur} × ${cell.rate} от ${cell.rateDate}); сомовый эквивалент не хранится — ИС-16, ИС-15`);

  const mixed = ST.statSlice({obj:'obj-credit', dims:[], meas:['a-sumdebt'], date:'2026-08-18'}).total['a-sumdebt'];
  const one = ST.statSlice({obj:'obj-credit', dims:[], meas:['a-sumdebt'], date:'2026-08-18',
    filter:{dim:'d-cur', value:'USD'}}).total['a-sumdebt'];
  ok(28, !!mixed.mixed && mixed.mixed.length === 3 && has(mixed.note, 'разновалютное') &&
        one.cur === 'USD' && !one.mixed,
    `разновалютный итог называет состав: «${mixed.note}»; однородный отдаётся в своей валюте (${one.cur})`);

  ok(29, ST.somOf(cell) === Math.round(cell.v * cell.rate * 100)/100 && ST.shareOf(1, 4) === 25 &&
        ST.pointsBetween(12.4, 15.9) === 3.5,
    `доля, дельта и сомовый эквивалент считаются при показе (${ST.shareOf(1,4)}% · ${ST.pointsBetween(12.4,15.9)} п.п.) и не хранятся — ИС-15`);

  const flow = ST.flowBetween({obj:'obj-credit', meas:'m-repaid', from:'2026-07-15', to:'2026-08-18'});
  const notFlow = ST.flowBetween({obj:'obj-credit', meas:'m-debt', from:'2026-07-15', to:'2026-08-18'});
  ok(30, flow.ok && flow.baseDate === '2026-06-30' && has(flow.passport.baseNote, 'вместо 15.07.2026') &&
        flow.value > 0 && !notFlow.ok && has(notFlow.why, 'ИС-17'),
    `период — разность двух нарастающих итогов; база названа: «${flow.passport.baseNote}», за интервал погашено ${Math.round(flow.value)} сом. Не поток разностью не считается: «${notFlow.why}»`);
})();

/* ---------- I. Разрез лежит в строке и действует вперёд ---------- */
(() => {
  ST.seed();
  const may = ST.statRows({obj:'obj-credit', date:'2026-05-31'}).rows.find(r => r.ref === 'КД-2024/117');
  const aug = ST.statRows({obj:'obj-credit', date:'2026-08-18'}).rows.find(r => r.ref === 'КД-2024/117');
  ok(31, may.dims['d-curator'] === 'Асанов А.' && aug.dims['d-curator'] === 'Бекова Н.' &&
        may.dims['d-category'] === 'Низкий кредитный риск' && aug.dims['d-category'] === 'Средний кредитный риск',
    `смена куратора 15.07 майскую строку не переписала: май — ${may.dims['d-curator']}, август — ${aug.dims['d-curator']} — ИС-4`);

  const add = ST.addDim({id:'d-segment', name:'Сегмент портфеля', obj:'obj-credit', src:'поле', key:'industry'});
  const past = ST.statSlice({obj:'obj-credit', dims:['d-segment'], meas:['a-count'], date:'2026-05-31'});
  ST.run(TODAY, {manual:true, reason:'разметка новым разрезом'});
  const now = ST.statSlice({obj:'obj-credit', dims:['d-segment'], meas:['a-count'], date: TODAY});
  ok(32, add.ok && add.since === TODAY && !past.ok && has(past.why, 'действует вперёд') && now.ok && now.groups.length > 1,
    `новый разрез действует вперёд: прошлое — «${past.why}»; сегодня — ${now.groups.length} групп`);
})();

/* ---------- J. Сходимость с реестром владельца и швы ---------- */
(() => {
  ST.seed();
  const r = ST.statRows({obj:'obj-credit', date: TODAY});
  const reg = ST.registryList('obj-credit', r.passport.asOf);
  const same = r.rows.map(x => x.ref).sort().join('|') === reg.join('|');
  const extra = r.rows.filter(x => 'документы' in x || 'связи' in x || 'card' in x);
  ok(33, same && extra.length === 0,
    `детализация сходится со списком реестра «Кредиты» один в один (${reg.length} из ${reg.length}); карточек, документов и связей шов не отдаёт — ИС-14`);

  const clf = ST.callSeam('классификация', 'statSlice', {obj:'obj-credit', dims:[], meas:['a-count'], date: TODAY});
  const noClf = ST.consumers().find(c => c.module === 'классификация').may.length;
  ok(34, !clf.ok && has(clf.why, 'ИС-5') && noClf === 0,
    `классификация статистику не читает ни в одной форме: «${clf.why}»`);

  const fourth = ST.callSeam('отчётность', 'statAll', {});
  const rep = ST.callSeam('отчётность', 'statSlice', {obj:'obj-credit', dims:['d-branch'], meas:['a-count'], date: TODAY});
  ok(35, !fourth.ok && has(fourth.why, 'четвёртый не заводится') && rep.ok && !!rep.passport,
    `швов три, четвёртого нет: «${fourth.why}»; отчётность получает срез с паспортом`);

  const rowMeas = ST.statSlice({obj:'obj-credit', dims:[], meas:['m-debt'], date: TODAY});
  const ghost = ST.statSlice({obj:'obj-credit', dims:[], meas:['m-ghost'], date: TODAY});
  ok(36, !rowMeas.ok && has(rowMeas.why, 'statRows') && !ghost.ok && has(ghost.why, 'ИС-7'),
    `мера среза — агрегат («${rowMeas.why}»); показателя вне реестра не существует ни для кого («${ghost.why}»)`);
})();

/* ---------- K. Ни одной величины здесь не выводится ---------- */
(() => {
  ST.seed();
  ST.resetCoreCalls();
  const run = ST.run('2026-08-20', {});
  const calls = ST.coreCalls();
  const rows = ST.statRows({obj:'obj-credit', date:'2026-08-20'}).rows;
  const noAgg = rows.every(r => Object.keys(r.meas).every(k => ST.IND(k).src !== 'агрегат'));
  ok(37, run.ok && calls > 0 && noAgg,
    `прогон записал ${run.written} строк, обратившись к ядру ${calls} раз: ни одна величина по объекту здесь не выводится (ИС-1), хранимых агрегатов в строке нет (ИС-3)`);

  const slice = ST.statSlice({obj:'obj-credit', dims:['d-branch'], meas:['a-count','a-sumdebt'], date:'2026-08-20'});
  const sumOfGroups = slice.groups.reduce((s, g) => s + g.values['a-sumdebt'].v, 0);
  ok(38, Math.abs(sumOfGroups - slice.total['a-sumdebt'].v) < 0.01 &&
        slice.groups.reduce((s, g) => s + g.n, 0) === slice.n,
    `итог — группировка тех же строк, а не отдельное число: сумма групп сходится с итогом до копейки (ИС-3)`);
})();

/* ---------- L. Реестр показателей: что завести нельзя ---------- */
(() => {
  ST.seed();
  const f = ST.addIndicator({id:'m-x', name:'Доля просрочки', obj:'obj-credit', src:'агрегат',
    fn:'sum', over:'m-debt', formula:'sum(overdue)/sum(debt)'});
  const der = ST.addIndicator({id:'m-y', name:'Доля просрочки', obj:'obj-credit', src:'агрегат', fn:'sum', over:'m-debt'});
  const seam = ST.addIndicator({id:'m-z', name:'Ожидаемые потери', obj:'obj-credit', src:'шов',
    seam:'calcExpectedLoss', field:'ecl', money:true});
  const fn = ST.addIndicator({id:'m-w', name:'Медиана долга', obj:'obj-credit', src:'агрегат', fn:'median', over:'m-debt'});
  ok(39, !f.ok && has(f.why, 'ИС-6') && !der.ok && has(der.why, 'ИС-15') &&
        !seam.ok && has(seam.why, 'ADR-0150 §3') && !fn.ok && has(fn.why, 'вне закрытого списка'),
    `формула — «${f.why.slice(0, 60)}…»; доля — представление; несуществующий шов — задача ядру; функция вне списка — «${fn.why}»`);

  const good = ST.addIndicator({id:'m-fee', name:'Плата за неосвоенный остаток', obj:'obj-credit',
    src:'шов', seam:'calcAccrual', field:'interest', money:true, type:'сумма'});
  const agg = ST.addIndicator({id:'a-sumfee', name:'Плата, итого', obj:'obj-credit', src:'агрегат', fn:'sum', over:'m-fee'});
  ST.run(TODAY, {manual:true, reason:'заведён новый показатель'});
  const use = ST.statSlice({obj:'obj-credit', dims:['d-branch'], meas:['a-sumfee'], date: TODAY});
  ok(40, good.ok && agg.ok && use.ok && use.total['a-sumfee'].v > 0,
    `показатель заведён записью и сразу считается ближайшим прогоном — без правки кода (ADR-0150 §1)`);

  const busy = ST.retireIndicator('m-fee');
  ok(41, !busy.ok && has(busy.why, 'используется агрегатами'),
    `показатель под агрегатом не снимается: «${busy.why}»`);
})();

/* ---------- M. Сторож текста: инварианты и решения названы в файле ---------- */
(() => {
  const iss = Array.from({ length: 20 }, (_, i) => 'ИС-' + (i + 1)).filter(k => !new RegExp(k + '(\\D|$)').test(src));
  const adrs = ['ADR-0145','ADR-0146','ADR-0147','ADR-0148','ADR-0149','ADR-0150','ADR-0151','ADR-0152']
    .filter(a => !src.includes(a));
  ok(42, iss.length === 0 && adrs.length === 0,
    `в файле названы все 20 инвариантов и 8 решений волны${iss.length ? ' · нет: ' + iss.join(',') : ''}${adrs.length ? ' · нет: ' + adrs.join(',') : ''}`);

  const screens = ['Конструктор среза','Журнал срезов','Реестры'].filter(s => !src.includes(s));
  ok(43, screens.length === 0 && !/ST\.editRow|правка строки среза\s*—\s*экран/i.test(src),
    `экранов три (конструктор · журнал · реестры), экрана правки строки среза нет — ИС-2`);
})();

/* ---------- N. Экраны рисуются (DOM-заглушка, три экрана × роли) ---------- */
(() => {
  const el = () => ({ innerHTML:'', textContent:'', dataset:{},
    classList:{toggle(){}, add(){}, remove(){}}, appendChild(){}, remove(){} });
  const nodes = {'#panel': el(), '#title': el(), '#foot': el(), '#asOf': el(), '#role': el()};
  sandbox.document = { querySelector: k => nodes[k] || el(), querySelectorAll: () => [],
    getElementById: () => null, createElement: () => el() };
  const panel = () => nodes['#panel'].innerHTML;
  const draw = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };

  ST.seed();
  const errs = [];
  ['build','journal','setup'].forEach(v => { const e = draw(() => ST.go(v)); if (e) errs.push(v + ': ' + e); });
  ST.go('build');
  const b = panel();
  ST.go('journal'); const j = panel();
  ST.go('setup');   const g = panel();
  ok(44, errs.length === 0 &&
        has(b, 'Вопрос к статистике') && has(b, 'statSlice') && has(b, 'Дата расчёта') && has(b, 'Зеркальные плитки') &&
        has(j, 'Прогоны') && has(j, 'Периоды и фиксация') && has(j, 'Зеркало чужого действия') &&
        has(g, 'Реестр объектов статистики') && has(g, 'Чего здесь завести нельзя'),
    `три экрана рисуются без ошибок${errs.length ? ': ' + errs.join(' · ') : ''}; паспорт стоит НАД результатом, зеркало закрытия периода помечено`);

  ST.go('build');
  const s0 = ST.statSlice(ST.state.q);
  const e1 = draw(() => ST.drillTo(s0.groups[0].key));
  const d = panel();
  ok(45, !e1 && has(d, 'Кто именно в числе') && has(d, 'Сходится с реестром') && has(d, 'закрыть детализацию'),
    `детализация открывается из ячейки среза и сходится со списком реестра прямо на экране (ИС-14)`);

  const modes = ['series','rows'].map(mm => { ST.setMode(mm); return {mm, html: panel()}; });
  ST.setMode('slice');
  ST.setRole('Наблюдатель');
  const obs = panel();
  ST.setRole('Администратор статистики');
  ok(46, has(modes[0].html, 'ряд по четырём датам') && has(modes[0].html, 'смешанно') &&
        has(modes[1].html, 'Строки среза') && has(modes[1].html, 'Сходится с реестром') &&
        has(obs, 'Наблюдателю конструктор не открыт') && has(obs, 'Зеркальные плитки'),
    `ряд («смешанно» назван) и строки рисуются тем же экраном; наблюдателю конструктор закрыт текстом, готовые плитки с паспортом ему открыты`);
})();

/* ---- отчёт ---- */
const pass = results.filter(r => r.pass).length;
const lines = results.map(r => `   ${r.pass ? 'PASS' : 'FAIL'}  #${r.n}  ${r.note}`);
const stamp = `SMOKE 2026-08-21 · ${pass}/${results.length} PASS\n` + lines.join('\n');
console.log(stamp);

const body = lines.map(l => '  ' + l).join('\n');
const injected = `  SMOKE 2026-08-21 · ${pass}/${results.length} PASS\n` + body;
if (src.includes('  SMOKE_PLACEHOLDER')) {
  writeFileSync(HTML, src.replace('  SMOKE_PLACEHOLDER', injected), 'utf8');
  console.log('\n→ результат вставлен в шапку statistics.html');
} else {
  const re = /( {2}SMOKE \d{4}-\d{2}-\d{2} · \d+\/\d+ PASS\n)[\s\S]*?(\n-->)/;
  if (re.test(src)) {
    writeFileSync(HTML, src.replace(re, injected + '$2'), 'utf8');
    console.log('\n→ результат обновлён в шапке statistics.html');
  }
}

process.exit(pass === results.length ? 0 : 1);
