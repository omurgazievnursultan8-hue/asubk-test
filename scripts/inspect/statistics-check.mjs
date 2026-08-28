// Headless smoke для mockups/statistics/statistics.html (ИС-1…ИС-25, ADR-0145…0152 + 0176…0180).
// Блок S закрывает бывшие дефекты макета СС-Д1/Д2/Д3/Д6 (вопрос целиком, а не его половина).
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
  ok(1, st.objects.length === 8 && st.indicators.length >= 85 && badSrc.length === 0 &&
       formula.length === 0 && badFn.length === 0,
    `объектов ${st.objects.length}, показателей ${st.indicators.length}; без объявленного источника ${badSrc.length}, с формулой ${formula.length}, с функцией вне списка ${badFn.length} — ИС-6, ИС-7`);

  const b = ST.OBJ('obj-borrower');
  ok(2, b && b.owner === 'Заёмщики' && b.inds.indexOf('m-bdebt') >= 0 &&
       ST.OBJ('obj-credit').inds.indexOf('m-bdebt') < 0,
    `заёмщик — самостоятельный объект со своими показателями, а не свёртка кредита (ИС-19)`);

  const shape = ST.ROW_SHAPE;
  ok(3, shape.length === 7 && shape.indexOf('som') < 0 && shape.indexOf('доля') < 0 &&
       shape.join(',') === 'obj,ref,date,dims,inds,fixed,by',
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
    `в сборщике строк (readDim/readInd/buildRow/doRun) слов предметной области нет${words.length ? ': ' + words.join(', ') : ''} — ИС-18`);

  ST.seed();
  const each = ST.state.objects.map(o => {
    const r = ST.statSlice({obj: o.id, dims: [o.dims[0]], inds: ['a-count'], date: TODAY});
    return {name: o.name, ok: r.ok, n: r.ok ? r.n : 0, g: r.ok ? r.groups.length : 0};
  });
  ok(6, each.every(x => x.ok && x.n > 0) && each.length === 8,
    `восемь объектов одним движком: ${each.map(x => x.name + ' ' + x.n + '/' + x.g + ' групп').join(' · ')}`);

  const cr = ST.statSlice({obj:'obj-credit', dims:['d-branch'], inds:['a-count','a-sumdebt'], date: TODAY});
  const bo = ST.statSlice({obj:'obj-borrower', dims:['d-ptype'], inds:['a-count','a-sumbcnt'], date: TODAY});
  ok(7, cr.ok && bo.ok && cr.dims[0] !== bo.dims[0] && cr.inds[1] !== bo.inds[1] &&
       bo.groups.some(g => g.parts[0] === 'физическое лицо'),
    `непохожая пара на одном движке: кредит по подразделениям (${cr.n}) и заёмщик по типу лица (${bo.n}) — разные разрезы, разные показатели, разные множества`);

  const zero = ST.statRows({obj:'obj-borrower', date: TODAY}).rows.find(r => r.ref === '45607195804119');
  ok(8, zero && zero.inds['m-bcnt'].v === 0,
    `заёмщик без действующих кредитов в срезе есть (договоров ${zero && zero.inds['m-bcnt'].v}) — при свёртке кредитов он исчез бы вовсе (ИС-19)`);
})();

/* ---------- C. Шестой объект — строкой реестра, а не релизом ---------- */
(() => {
  ST.seed();
  const before = ST.statSlice({obj:'obj-guarantee', dims:[], inds:['a-count'], date: TODAY});
  const mi = ST.addIndicator({id:'m-gsec', name:'Обеспечиваемые требования', obj:'obj-guarantee',
    src:'шов', seam:'calcDebt', field:'principal', money:true, type:'сумма'});
  const ai = ST.addIndicator({id:'a-sumgsec', name:'Обеспечено требований, итого', obj:'obj-guarantee',
    src:'агрегат', fn:'sum', over:'m-gsec'});
  const add = ST.addObject({id:'obj-guarantee', name:'Поручительство', plural:'поручительства',
    owner:'Обеспечение', refName:'номер поручительства',
    dims:['d-branch','d-curator','d-region','d-ptype'], inds:['m-gsec','a-count','a-sumgsec']});
  const run = ST.run('2026-08-20', {});
  const after = ST.statSlice({obj:'obj-guarantee', dims:['d-region'], inds:['a-count','a-sumgsec'], date:'2026-08-20'});
  ok(9, !before.ok && mi.ok && ai.ok && add.ok && run.ok && after.ok && after.n === 3 && after.groups.length === 3,
    `девятый объект заведён записью: до — «${before.why}», после — ${after.n} объектов в ${after.groups.length} группах, без единой правки движка (ИС-18)`);

  const bad = ST.addObject({id:'obj-ghost', name:'Призрак', dims:[], inds:[]});
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

  const s = ST.statSlice({obj:'obj-credit', dims:['d-branch'], inds:['a-count'], date: TODAY});
  const r = ST.statRows({obj:'obj-credit', date: TODAY});
  const q = ST.statSeries({obj:'obj-credit', inds:'a-sumdebt', dates:['2026-05-31','2026-06-30','2026-07-31','2026-08-18']});
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

  const may = ST.statSlice({obj:'obj-credit', dims:[], inds:['a-count'], date:'2026-05-31'});
  const d = ST.divergence('2026-05', 'obj-credit', 'm-debt');
  ok(22, may.passport.fixation === 'зафиксировано' && has(may.passport.divergence, 'корректировка') &&
        d.ok && d.shown && d.delta === 16320.17 && d.today > d.fixed,
    `май зафиксирован (${may.passport.fixedBy}); расхождение названо строкой: было ${d.fixed}, сегодняшний пересчёт дал бы ${d.today} — ИС-11`);
})();

/* ---------- G. Роли режут строки ДО группировки ---------- */
(() => {
  ST.seed();
  const all = ST.statSlice({obj:'obj-credit', dims:['d-branch'], inds:['a-count','a-sumdebt'], date: TODAY});
  ST.setRole('Аналитик');
  const mine = ST.statSlice({obj:'obj-credit', dims:['d-branch'], inds:['a-count','a-sumdebt'], date: TODAY});
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
  const cell = usd.inds['m-debt'];
  const stored = rows.some(r => Object.keys(r.inds).some(k => 'som' in r.inds[k] || 'share' in r.inds[k]));
  ok(27, cell.cur === 'USD' && cell.rate === 88.30 && cell.rateDate === '2026-08-18' && !stored,
    `сумма — в валюте договора с курсом и датой курса (${cell.v} ${cell.cur} × ${cell.rate} от ${cell.rateDate}); сомовый эквивалент не хранится — ИС-16, ИС-15`);

  const mixed = ST.statSlice({obj:'obj-credit', dims:[], inds:['a-sumdebt'], date:'2026-08-18'}).total['a-sumdebt'];
  const one = ST.statSlice({obj:'obj-credit', dims:[], inds:['a-sumdebt'], date:'2026-08-18',
    filter:{dim:'d-cur', value:'USD'}}).total['a-sumdebt'];
  ok(28, !!mixed.mixed && mixed.mixed.length === 3 && has(mixed.note, 'разновалютное') &&
        one.cur === 'USD' && !one.mixed,
    `разновалютный итог называет состав: «${mixed.note}»; однородный отдаётся в своей валюте (${one.cur})`);

  ok(29, ST.somOf(cell) === Math.round(cell.v * cell.rate * 100)/100 && ST.shareOf(1, 4) === 25 &&
        ST.pointsBetween(12.4, 15.9) === 3.5,
    `доля, дельта и сомовый эквивалент считаются при показе (${ST.shareOf(1,4)}% · ${ST.pointsBetween(12.4,15.9)} п.п.) и не хранятся — ИС-15`);

  const flow = ST.flowBetween({obj:'obj-credit', inds:'m-repaid', from:'2026-07-15', to:'2026-08-18'});
  const notFlow = ST.flowBetween({obj:'obj-credit', inds:'m-debt', from:'2026-07-15', to:'2026-08-18'});
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

  const add = ST.addDim({id:'d-segment', name:'Сегмент портфеля', obj:'obj-credit', src:'поле',
    key:'industry', perObject:'одно'});
  const past = ST.statSlice({obj:'obj-credit', dims:['d-segment'], inds:['a-count'], date:'2026-05-31'});
  ST.run(TODAY, {manual:true, reason:'разметка новым разрезом'});
  const now = ST.statSlice({obj:'obj-credit', dims:['d-segment'], inds:['a-count'], date: TODAY});
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

  const clf = ST.callSeam('классификация', 'statSlice', {obj:'obj-credit', dims:[], inds:['a-count'], date: TODAY});
  const noClf = ST.consumers().find(c => c.module === 'классификация').may.length;
  ok(34, !clf.ok && has(clf.why, 'ИС-5') && noClf === 0,
    `классификация статистику не читает ни в одной форме: «${clf.why}»`);

  const fourth = ST.callSeam('отчётность', 'statAll', {});
  const rep = ST.callSeam('отчётность', 'statSlice', {obj:'obj-credit', dims:['d-branch'], inds:['a-count'], date: TODAY});
  ok(35, !fourth.ok && has(fourth.why, 'четвёртый не заводится') && rep.ok && !!rep.passport,
    `швов три, четвёртого нет: «${fourth.why}»; отчётность получает срез с паспортом`);

  const rowInd = ST.statSlice({obj:'obj-credit', dims:[], inds:['m-debt'], date: TODAY});
  const ghost = ST.statSlice({obj:'obj-credit', dims:[], inds:['m-ghost'], date: TODAY});
  ok(36, !rowInd.ok && has(rowInd.why, 'statRows') && !ghost.ok && has(ghost.why, 'ИС-7'),
    `показатель среза — агрегат («${rowInd.why}»); показателя вне реестра не существует ни для кого («${ghost.why}»)`);
})();

/* ---------- K. Ни одной величины здесь не выводится ---------- */
(() => {
  ST.seed();
  ST.resetCoreCalls();
  const run = ST.run('2026-08-20', {});
  const calls = ST.coreCalls();
  const rows = ST.statRows({obj:'obj-credit', date:'2026-08-20'}).rows;
  const noAgg = rows.every(r => Object.keys(r.inds).every(k => ST.IND(k).src !== 'агрегат'));
  ok(37, run.ok && calls > 0 && noAgg,
    `прогон записал ${run.written} строк, обратившись к ядру ${calls} раз: ни одна величина по объекту здесь не выводится (ИС-1), хранимых агрегатов в строке нет (ИС-3)`);

  const slice = ST.statSlice({obj:'obj-credit', dims:['d-branch'], inds:['a-count','a-sumdebt'], date:'2026-08-20'});
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

  const good = ST.addIndicator({id:'m-idle', name:'Плата за неосвоенный остаток', obj:'obj-credit',
    src:'шов', seam:'calcAccrual', field:'interest', money:true, type:'сумма'});
  const agg = ST.addIndicator({id:'a-sumidle', name:'Плата, итого', obj:'obj-credit', src:'агрегат', fn:'sum', over:'m-idle'});
  ST.run(TODAY, {manual:true, reason:'заведён новый показатель'});
  const use = ST.statSlice({obj:'obj-credit', dims:['d-branch'], inds:['a-sumidle'], date: TODAY});
  ok(40, good.ok && agg.ok && use.ok && use.total['a-sumidle'].v > 0,
    `показатель заведён записью и сразу считается ближайшим прогоном — без правки кода (ADR-0150 §1)`);

  const busy = ST.retireIndicator('m-idle');
  ok(41, !busy.ok && has(busy.why, 'используется агрегатами'),
    `показатель под агрегатом не снимается: «${busy.why}»`);
})();

/* ---------- M. Сторож текста: инварианты и решения названы в файле ---------- */
(() => {
  const iss = Array.from({ length: 30 }, (_, i) => 'ИС-' + (i + 1)).filter(k => !new RegExp(k + '(\\D|$)').test(src));
  const adrs = ['ADR-0145','ADR-0146','ADR-0147','ADR-0148','ADR-0149','ADR-0150','ADR-0151','ADR-0152',
                'ADR-0176','ADR-0177','ADR-0178','ADR-0179','ADR-0180','ADR-0183','ADR-0184','ADR-0185','ADR-0186']
    .filter(a => !src.includes(a));
  ok(42, iss.length === 0 && adrs.length === 0,
    `в файле названы все 30 инвариантов и 17 решений${iss.length ? ' · нет: ' + iss.join(',') : ''}${adrs.length ? ' · нет: ' + adrs.join(',') : ''}`);

  const screens = ['Конструктор среза','Журнал срезов','Выгрузки','Реестры'].filter(s => !src.includes(s));
  ok(43, screens.length === 0 && !/ST\.editRow|правка строки среза\s*—\s*экран/i.test(src),
    `экранов четыре (конструктор · журнал · выгрузки · реестры), экрана правки строки среза нет — ИС-2`);
})();

/* ---------- N. Экраны рисуются (DOM-заглушка, четыре экрана × роли) ---------- */
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
  ['build','journal','exports','setup'].forEach(v => { const e = draw(() => ST.go(v)); if (e) errs.push(v + ': ' + e); });
  ST.go('build');
  const b = panel();
  ST.go('journal'); const j = panel();
  ST.go('exports'); const x = panel();
  ST.go('setup');   const g = panel();
  ok(44, errs.length === 0 &&
        has(b, 'Вопрос к статистике') && has(b, 'statSlice') && has(b, 'Дата расчёта') && has(b, 'Зеркальные плитки') &&
        has(j, 'Прогоны') && has(j, 'Периоды и фиксация') && has(j, 'Зеркало чужого действия') &&
        has(x, 'Очередь заданий') && has(x, 'Чего на этом экране нет') &&
        has(g, 'Реестр объектов статистики') && has(g, 'Ссылки потребителей') && has(g, 'Чего здесь завести нельзя'),
    `четыре экрана рисуются без ошибок${errs.length ? ': ' + errs.join(' · ') : ''}; паспорт стоит НАД результатом, зеркало закрытия периода помечено`);

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
  ok(46, has(modes[0].html, 'ряд по 4 датам, шаг месяц') && has(modes[0].html, 'смешанно') &&
        has(modes[1].html, 'Строки среза') && has(modes[1].html, 'Сходится с реестром') &&
        has(obs, 'Наблюдателю конструктор не открыт') && has(obs, 'Зеркальные плитки'),
    `ряд («смешанно» назван) и строки рисуются тем же экраном; наблюдателю конструктор закрыт текстом, готовые плитки с паспортом ему открыты`);
})();

/* ---------- O. Разрез несёт уровни и корзины (ADR-0176) ---------- */
(() => {
  ST.seed();
  const t = ST.statSlice({obj:'obj-credit', dims:['d-region'], inds:['a-count','a-sumdebt'], date: TODAY});
  const top = t.ok ? t.groups.map(g => g.key).join(' · ') : '';
  const kids = t.ok ? t.groups.reduce((n,g) => n + g.children.length, 0) : 0;
  ok(47, t.ok && t.hier && t.hier.depth === 2 && kids > 0 &&
        t.groups.every(g => g.n === g.own + g.children.reduce((x,c) => x + c.n, 0)),
    `ответ — дерево всегда: ${t.groups.length} узлов верхнего уровня (${top}), ниже ${kids}; каждый узел считается по своим строкам (ADR-0176 §5, §6)`);

  const orphan = t.ok ? t.groups.find(g => g.key === 'Таласская') : null;
  const lvl1 = ST.statSlice({obj:'obj-credit', dims:['d-region'], inds:['a-count'], date: TODAY, levels:{'d-region':1}});
  const sumTop = t.ok ? t.groups.reduce((x,g) => x + g.n, 0) : -1;
  ok(48, orphan && orphan.n === 1 && orphan.own === 1 && orphan.children.length === 0 &&
        lvl1.ok && lvl1.hier.depth === 1 && lvl1.n === t.n && sumTop === t.n,
    `объект без нижнего уровня остаётся у родителя и не исчезает: «Таласская» — своих ${orphan ? orphan.own : '—'}; уровень спрашивается вопросом (ИС-22)`);

  const bad = ST.statSlice({obj:'obj-credit', dims:['d-region'], inds:['a-count'], date: TODAY, levels:{'d-region':3}});
  const noB = ST.statSlice({obj:'obj-credit', dims:['d-cdate'], inds:['a-count'], date: TODAY});
  const yr  = ST.statSlice({obj:'obj-credit', dims:['d-cdate'], inds:['a-count'], date: TODAY, buckets:{'d-cdate':'год'}});
  const qt  = ST.statSlice({obj:'obj-credit', dims:['d-cdate'], inds:['a-count'], date: TODAY, buckets:{'d-cdate':'квартал'}});
  ok(49, !bad.ok && has(bad.why, 'ИС-22') && !noB.ok && has(noB.why, 'ИС-23') &&
        yr.ok && qt.ok && qt.groups.length > yr.groups.length && yr.n === qt.n,
    `корзина обязательна и берётся из объявленных: без корзины — отказ «${String(noB.why).slice(0, 48)}…»; год ${yr.groups.length} групп, квартал ${qt.groups.length}, строк одинаково ${yr.n} (ИС-23)`);

  const br = ST.statSlice({obj:'obj-credit', dims:['d-branch'], inds:['a-count'], date: TODAY});
  const divs = br.ok ? br.groups.map(g => g.key) : [];
  const dimBr = ST.state.dims.find(d => d.id === 'd-branch');
  ok(50, br.ok && dimBr.owner && dimBr.levels.length === 2 &&
        divs.every(k => /дивизион/i.test(k)) && br.groups.some(g => g.children.length > 0),
    `верхний уровень взят у владельца справочника («${dimBr.owner}»), второй копии оргструктуры здесь нет: ${divs.join(' · ')} (ADR-0176 §7)`);

  const many = ST.addDim({id:'d-rk', name:'Вид погашения', obj:'obj-credit', src:'поле', key:'kind', perObject:'много'});
  const mute = ST.addDim({id:'d-rk2', name:'Вид погашения', obj:'obj-credit', src:'поле', key:'kind'});
  ok(51, !many.ok && has(many.why, 'ИС-21') && !mute.ok &&
        ST.OBJ('obj-repay') && ST.OBJ('obj-repay').dims.indexOf('d-repkind') >= 0,
    `многозначный разрез не заводится — он объект: «${String(many.why).slice(0, 70)}…»; вид погашения живёт разрезом у погашения (ADR-0179 §1)`);
})();

/* ---------- P. statRows двоичен, сверка — выгрузкой (ADR-0178) ---------- */
(() => {
  ST.seed();
  const few = ST.statRows({obj:'obj-credit', date: TODAY});
  const many = ST.statRows({obj:'obj-repay', date: TODAY});
  const trunc = many.ok ? 0 : (many.rows || []).length;
  ok(52, few.ok && few.rows.length === 8 && !many.ok && many.overLimit &&
        many.n === 14 && trunc === 0 && has(many.why, String(many.n)) && has(many.why, 'ИС-22'),
    `ответ двоичен: 8 строк отдаются целиком, 14 — отказ, называющий ЧИСЛО (${many.n}) при пороге ${many.limit}; усечённого ответа нет (ADR-0178 §1, §4)`);

  const pagers = Object.keys(ST).filter(k => /page|offset|limitRows|truncate/i.test(k));
  const job = ST.exportJob({obj:'obj-repay', date: TODAY});
  const p = job.ok ? job.job.passport : null;
  ok(53, pagers.length === 0 && job.ok && job.job.n === 14 && p && p.asOf && p.fixation && p.scope &&
        job.job.file && ST.exportsList().length === 1,
    `сверка целиком идёт заданием ${job.ok ? job.job.id : '—'}, паспорт едет ВНУТРИ файла (${p ? p.asOf : '—'} · ${p ? p.fixation : '—'}); страниц и усечения в швах нет (ADR-0178 §5)`);

  ST.setRole('Аналитик');
  const cur = ST.statRows({obj:'obj-repay', date: TODAY});
  ST.setRole('Администратор статистики');
  ok(54, cur.ok && cur.rows.length < 14 && cur.rows.length <= ST.rowsLimit &&
        has(cur.passport.scope, 'доступным вам'),
    `порог считается ПОСЛЕ ролевых правил: аналитику видно ${cur.ok ? cur.rows.length : '—'} из 14 — список он получает, а не отказ из-за чужого множества (ADR-0178 §3)`);

  const w = ST.workList('obj-credit', TODAY);
  ok(55, w.ok && has(w.note, 'сутки, а не расхождение') && w.list.length > 0,
    `второе действие числа названо отдельно от первого: «${String(w.note).slice(0, 70)}…» (ИС-14, врезка ADR-0152 §4)`);
})();

/* ---------- Q. Паспорт: ровно две формы (ИС-24) ---------- */
(() => {
  ST.seed();
  const r = ST.statSlice({obj:'obj-credit', dims:['d-branch'], inds:['a-count'], date: TODAY});
  const sh = r.ok ? r.passport.short : '';
  ok(56, r.ok && ST.passportForms().length === 2 && typeof sh === 'string' &&
        /на \d\d\.\d\d/.test(sh) && has(sh, 'фикс') && sh.length < 60 &&
        ST.passportShort(r.passport) === sh,
    `форм паспорта ровно две, и краткую объявляет производитель: «${sh}» (ИС-24, врезка ADR-0152 §2)`);
})();

/* ---------- R. Обратный индекс ссылок (ADR-0177) ---------- */
(() => {
  ST.seed();
  const before = ST.refsTo('a-sumdebt').length;
  const anon = ST.publishRefs({uses:['a-sumdebt']});
  const pub = ST.publishRefs({consumer:'кураторство', edition:'карточка куратора, ред. 4',
    owner:'Кураторство', uses:['a-sumdebt']});
  const after = ST.refsTo('a-sumdebt').length;
  const re = ST.publishRefs({consumer:'кураторство', edition:'карточка куратора, ред. 4',
    owner:'Кураторство', uses:[]});
  ok(57, !anon.ok && has(anon.why, 'ADR-0177 §2') && pub.ok && after === before + 1 &&
        re.ok && ST.refsTo('a-sumdebt').length === before,
    `ссылку публикует ПОТРЕБИТЕЛЬ со своей редакцией, переиздание без ссылки её снимает: ${before} → ${after} → ${ST.refsTo('a-sumdebt').length} (ADR-0177 §2)`);

  const stop = ST.retireIndicator('a-sumdebt');
  const names = stop.breaks ? stop.breaks.map(x => x.consumer).join(' · ') : '';
  const go = ST.retireIndicator('a-sumdebt', true);
  ok(58, !stop.ok && stop.needsConfirm && stop.breaks.length >= 2 && has(stop.why, 'ИС-25') &&
        names.length > 0 && go.ok && go.broke.length >= 2 && !ST.IND('a-sumdebt'),
    `вывод не запрещён чужой публикацией, но назван поимённо: сломается у ${names} (ИС-25, ADR-0177 §4)`);

  const live = ST.setLive('m-debt', false);
  const agg = ST.setLive('a-sumbcnt', false);
  ok(59, !live.ok && has(live.why, 'ADR-0159') && agg.ok && ST.liveOf('a-sumbcnt').live === false &&
        ST.liveOf('m-debt').editable === false,
    `исчислимость налету правится только у агрегатов: у шва она производна от источника — «${String(live.why).slice(0, 60)}…»`);
})();

/* ---------- S. Вопрос целиком: даты ряда, фильтр, форма разреза, состав прогона ---------- */
(() => {
  ST.seed();
  const st = ST.state;
  const d4 = ST.seriesDates();
  st.q.series = {step:'квартал', points:4};
  const dq = ST.seriesDates();
  st.q.series = {step:'месяц', points:6};
  const d6 = ST.seriesDates();
  st.q.series = {step:'месяц', points:4};
  ok(60, d4.length === 4 && d4[3] === st.q.date && d6.length === 6 && dq.length === 4 &&
        dq[3] === st.q.date && dq[2] < d4[2] &&
        ST.statSeries({obj:'obj-credit', inds:'a-count', dates: dq}).ok,
    `даты ряда — часть вопроса, а не константа: шаг месяц ${d4.join(' · ')}; шаг квартал ${dq.join(' · ')}; точек 4 или ${d6.length} (СС-Д1)`);

  const vals = ST.filterValues('d-branch');
  const byBucket = ST.filterValues('d-cdate');
  st.q.filter = {dim:'d-branch', value: vals[0]};
  const nar = ST.statSlice({obj:'obj-credit', dims:['d-branch'], inds:['a-count'], date: st.q.date, filter: st.q.filter});
  st.q.filter = null;
  const all = ST.statSlice({obj:'obj-credit', dims:['d-branch'], inds:['a-count'], date: st.q.date});
  ok(61, vals.length > 0 && vals.some(v => v.indexOf(' / ') > 0) && nar.ok && nar.n < all.n &&
        has(nar.passport.filter, String(vals[0]).split(' / ').pop()) &&
        byBucket.length > 0 && byBucket.every(v => /^\d{4}$/.test(v)),
    `фильтр строится списком значений ИЗ СТРОК среза, а не чужим справочником (ИС-4): у подразделения ${vals.length} значений обоих уровней, у разреза-даты — корзины (${byBucket.join(' · ')}), а не сырые даты; сужение названо в паспорте: ${nar.ok ? nar.n : '—'} из ${all.n} (СС-Д2)`);

  ST.seed();
  const taken = ST.addDim({id:'d-industry', name:'Отрасль', obj:'obj-credit', src:'поле',
    key:'industry', perObject:'одно'});
  const noRef = ST.addDim({id:'d-fdate', name:'Дата погашения', obj:'obj-repay', src:'поле',
    key:'date', perObject:'одно', buckets:['год','месяц']});
  const withRef = ST.addDim({id:'d-div2', name:'Подразделение выдачи', obj:'obj-repay', src:'поле',
    key:'branch', perObject:'одно', ref:'org', owner:'Оргструктура (кадры)',
    levels:['дивизион','филиал']});
  const dd = ST.state.dims.find(d => d.id === 'd-div2');
  const fd = ST.state.dims.find(d => d.id === 'd-fdate');
  const free = ST.statSlice({obj:'obj-repay', dims:['d-fdate'], inds:['a-count'], date: TODAY,
    buckets:{'d-fdate':'неделя'}});
  ok(62, !taken.ok && noRef.ok && withRef.ok && dd && dd.owner === 'Оргструктура (кадры)' &&
        dd.levels.length === 2 && fd.buckets.length === 2 && !free.ok,
    `разрез заводится формой со всем, что требует модель: корзины списком (${fd ? fd.buckets.join(' · ') : '—'}, «неделя» мимо реестра не спрашивается) и ВЛАДЕЛЕЦ уровней («${dd ? dd.owner : '—'}»), а не напечатанная иерархия; занятый идентификатор — «${taken.why}» (ADR-0176 §7, ИС-23, СС-Д3)`);

  ST.seed();
  const r = ST.state.runs.filter(x => x.parts && x.parts.length).slice(-1)[0];
  const sum = r ? r.parts.reduce((n,p) => n + p.n, 0) : -1;
  const zero = r ? r.parts.filter(p => p.n === 0).length : -1;
  ok(63, r && r.parts.length === ST.state.objects.length && sum === r.written &&
        r.parts.every(p => 'name' in p && 'n' in p),
    `состав прогона поимённый: ${r ? r.parts.length : '—'} объектов, сумма по объектам ${sum} = строк ${r ? r.written : '—'}; объект с нулём виден строкой (их ${zero}), а не отсутствием (СС-Д6)`);
})();

/* ---------- T. Волна 6: полный состав показателей кредита ----------
   Реестр вырос с 37 записей до 85, и держат его не глаза, а тождества ядра:
   «остаток = просрочено + срочно» и «свод = сумма семи статей» (ТЗ 18 §5.1). */
(() => {
  ST.seed();
  const ART = ['m-coll','m-fee','m-debt','m-aint','m-int','m-apen','m-pen'];
  const OVR = ['m-ocoll','m-ofee','m-odebt','m-oaint','m-oint','m-oapen','m-open'];
  const rows = ST.statRows({obj:'obj-credit', date: TODAY}).rows;
  const val = (r, id) => (r.inds[id] ? r.inds[id].v : 0);
  const r2  = x => Math.round(x * 100) / 100;
  const bad = rows.filter(r =>
    Math.abs(val(r,'m-total') - r2(ART.reduce((a,i) => a + val(r,i), 0))) > 0.01 ||
    Math.abs(val(r,'m-over')  - r2(OVR.reduce((a,i) => a + val(r,i), 0))) > 0.01 ||
    Math.abs(val(r,'m-total') - (val(r,'m-over') + val(r,'m-curr')))      > 0.01);
  ok(64, rows.length === 8 && bad.length === 0,
    `на всех ${rows.length} строках держатся оба тождества ядра: свод = сумма семи статей и остаток = просрочено + срочно${bad.length ? ' · ломается: ' + bad.map(r => r.ref).join(', ') : ''} (ТЗ 18 §5.1)`);

  /* ФО-01 «Просроченная задолженность на 1-е число» (обязательна, Порядок №41 п. 12) —
     это срез по ступеням срока, а не набор показателей «просрочено 30–90» (ИС-23). */
  const fo1 = ST.statSlice({obj:'obj-credit', dims:['d-odays'], date: TODAY,
    inds:['a-count','a-sumtotal','a-sumover','a-sumcurr'], buckets:{'d-odays':'ступени'}});
  const keys = fo1.ok ? fo1.groups.map(g => g.key) : [];
  const lead = keys.map(k => parseInt(k, 10));
  const sorted = lead.every((n, i) => i === 0 || lead[i-1] <= n);
  const sumG = fo1.ok ? fo1.groups.reduce((a, g) => a + g.values['a-sumover'].v, 0) : -1;
  ok(65, fo1.ok && keys.length >= 3 && sorted && Math.abs(sumG - fo1.total['a-sumover'].v) < 0.01,
    `ФО-01 собирается срезом по ступеням срока: ${keys.join(' · ')} — по возрастанию, сумма групп сходится с итогом (ИС-14, ИС-23)`);

  const acc  = ST.flowBetween({obj:'obj-credit', inds:'m-accr', from:'2026-07-15', to:'2026-08-18'});
  const woff = ST.flowBetween({obj:'obj-credit', inds:'m-woff', from:'2026-07-15', to:'2026-08-18'});
  const stat = ST.flowBetween({obj:'obj-credit', inds:'m-total', from:'2026-07-15', to:'2026-08-18'});
  ok(66, acc.ok && woff.ok && !stat.ok && has(stat.why, 'ИС-17'),
    `за период спрашивается только нарастающее: начислено ${acc.ok ? acc.value : '—'}, списано ${woff.ok ? woff.value : '—'}; «Задолженность всего» отбита — «${String(stat.why).slice(0, 48)}…»`);

  /* Срез принимает ТОЛЬКО агрегаты (смоук #36) — значит строчный показатель без агрегата
     в портфельный вопрос не попадает вовсе. Пара обязательна, и её проверяют, а не помнят. */
  const cred = ST.OBJ('obj-credit');
  const base = cred.inds.filter(m => ST.IND(m).src !== 'агрегат');
  const covered = base.filter(m => ST.state.indicators.some(i => i.src === 'агрегат' && i.over === m));
  const seams = ['calcDebt','calcAccrual','calcAllocation','calcSchedule','calcForecast']
    .filter(sm => !base.some(m => ST.IND(m).seam === sm));
  ok(67, base.length === 31 && covered.length === base.length && seams.length === 0,
    `у кредита ${base.length} строчных показателей, и у каждого есть агрегат — иначе в срез он не попадёт (#36); пять швов ядра прочитаны, непрочитанных нет${seams.length ? ': ' + seams.join(', ') : ''}`);

  /* ИС-26: дата на срезе выражается числом дней от даты вопроса — среднюю дату
     сложить не из чего, а среднее число дней складывается. */
  const dated = ST.state.indicators.filter(i => i.type === 'дата');
  const sched = ST.statSlice({obj:'obj-credit', dims:[], date: TODAY,
    inds:['a-minndays','a-avgndays','a-maxfdays']});
  ok(68, dated.length === 0 && sched.ok && sched.total['a-avgndays'].v > 0 &&
        ST.IND('m-ndays').unit === 'дн.' && ST.IND('m-fdays').unit === 'дн.',
    `показателя типа «дата» в реестре нет ни одного: график отвечает днями — ближайший платёж минимум через ${sched.ok ? sched.total['a-minndays'].v : '—'} дн., в среднем ${sched.ok ? sched.total['a-avgndays'].v : '—'} дн. (ИС-26)`);
})();

/* ---------- U. Волна 7: полный состав показателей заёмщика ----------
   Заёмщик — не свёртка кредитов, но и не второй счётчик того же: его величины приходят
   ПОРТФЕЛЬНЫМ швом ядра (ADR-0174, ADR-0184), а держит их тождество «свод = сумма
   одиночных ответов», проверяемое по каждой валюте до копейки. */
(() => {
  ST.seed();
  const OWN = ['calcPortfolio','riskCategory','leadCurator'];
  const SINGLE = ['calcDebt','calcAccrual','calcAllocation','calcSchedule','calcForecast'];
  const bInds = ST.OBJ('obj-borrower').inds.map(i => ST.IND(i)).filter(i => i.src !== 'агрегат');
  const alien = bInds.filter(i => i.src === 'шов' && SINGLE.indexOf(i.seam) >= 0);
  const fields = bInds.filter(i => i.src === 'поле').map(i => i.key);
  ok(69, bInds.length === 20 && alien.length === 0 &&
        bInds.filter(i => i.src === 'шов').every(i => OWN.indexOf(i.seam) >= 0) &&
        bInds.filter(i => i.seam === 'calcPortfolio').length === 14,
    `у заёмщика ${bInds.length} строчных показателей, и ни один не берёт шов ОДНОГО кредита${alien.length ? ': ' + alien.map(i => i.id).join(', ') : ''}: величины портфеля спрашиваются портфельным вопросом (ИС-28, ADR-0184 §1); полем осталось только собственное — ${fields.join(', ')}`);

  /* Свод портфеля = сумма одиночных ответов, ПО КАЖДОЙ ВАЛЮТЕ и до копейки. Курса в
     проверке нет вовсе: сравниваются доллары с долларами (ADR-0174 §2, ADR-0184 §3). */
  const crows = ST.statRows({obj:'obj-credit', date: TODAY}).rows;
  const brows = ST.statRows({obj:'obj-borrower', date: TODAY}).rows;
  const single = {};
  crows.forEach(r => {
    const inn = r.dims['d-binn'], c = r.inds['m-total'];
    if(!inn || !c) return;
    single[inn] = single[inn] || {};
    single[inn][c.cur] = Math.round(((single[inn][c.cur] || 0) + c.v) * 100) / 100;
  });
  const broken = [];
  brows.forEach(r => {
    const parts = ST.partsOf(r.inds['m-btotal']);
    const want = single[r.ref] || {};
    Object.keys(want).forEach(cur => {
      const got = parts.find(x => x.cur === cur);
      if(!got || Math.abs(got.v - want[cur]) > 0.01) broken.push(r.ref + ' ' + cur);
    });
    if(parts.length !== Object.keys(want).length) broken.push(r.ref + ' состав');
    /* Тождество ядра «остаток = просрочено + срочно» держится и на строке заёмщика —
       по каждой валюте отдельно (ADR-0183 §3 применительно к портфелю). */
    const o = ST.partsOf(r.inds['m-bover']), c = ST.partsOf(r.inds['m-bcurr']);
    parts.forEach(t => {
      const op = (o.find(x => x.cur === t.cur) || {v:0}).v;
      const cp = (c.find(x => x.cur === t.cur) || {v:0}).v;
      if(Math.abs(t.v - (op + cp)) > 0.01) broken.push(r.ref + ' ' + t.cur + ' тождество');
    });
  });
  const checked = Object.keys(single).length;
  ok(70, brows.length === 8 && checked >= 5 && broken.length === 0,
    `свод портфеля равен сумме одиночных ответов по каждой валюте у всех ${checked} заёмщиков с договорами${broken.length ? ' · ломается: ' + broken.join(', ') : ''}, и на строке заёмщика держится остаток = просрочено + срочно (ADR-0174 §2)`);

  /* Разновалютный портфель молчит одним числом и говорит составом. Сомовый эквивалент
     считается при показе из тех же частей и в строке не лежит (ИС-15, ADR-0151 §2). */
  const mix = brows.find(r => r.dims['d-bcur'] === 'разновалютный');
  const mixCell = mix ? mix.inds['m-btotal'] : null;
  const mixParts = ST.partsOf(mixCell);
  const stored = brows.some(r => Object.keys(r.inds).some(k => 'som' in r.inds[k] || 'сом' in r.inds[k]));
  const agg = ST.statSlice({obj:'obj-borrower', dims:['d-ptype'], inds:['a-sumbtotal'], date: TODAY});
  const tot = agg.ok ? agg.total['a-sumbtotal'] : null;
  ok(71, mixCell && mixCell.v == null && mixParts.length === 2 && ST.somOf(mixCell) > 0 &&
        !stored && tot && tot.mixed && tot.mixed.length === 3 && tot.by &&
        has(tot.note, 'EUR') && has(tot.note, 'USD'),
    `разновалютный портфель (${mix ? mix.ref : '—'}) называет состав ${mixParts.map(x => x.v + ' ' + x.cur).join(' + ')} и молчит одним числом; в сом сводится при показе (≈ ${mixCell ? ST.somOf(mixCell) : '—'}), в строке эквивалента нет; итог называет состав поимённо: «${tot ? String(tot.note).slice(0, 64) : '—'}…»`);

  /* Число договоров — клетка шва, а не поле владельца: производная в поле есть второй
     источник (ADR-0001). Доказательство — оно меняется вслед за СТАТУСОМ договора. */
  const cnt = ST.IND('m-bcnt');
  const was = ST.statRows({obj:'obj-borrower', date:'2026-05-31'}).rows.find(r => r.ref === '45607195804119');
  const now = brows.find(r => r.ref === '45607195804119');
  const stale = ST.state.indicators.filter(i => i.src === 'поле' && i.key === 'contracts');
  ok(72, cnt.src === 'шов' && cnt.seam === 'calcPortfolio' && stale.length === 0 &&
        was && was.inds['m-bcnt'].v === 1 && now.inds['m-bcnt'].v === 0 &&
        now.inds['m-bclosed'].v === 1,
    `число договоров приходит швом и следует за статусом: у 45607195804119 на 31.05 — ${was ? was.inds['m-bcnt'].v : '—'} действующий, на 18.08 — ${now.inds['m-bcnt'].v} действующих и ${now.inds['m-bclosed'].v} закрытый; поля «contracts» в реестре нет (ADR-0184 §2)`);

  /* Типизированное правило агрегата (ADR-0185 §3, ИС-29) — по ВСЕМ восьми объектам:
     у числа и суммы агрегат обязателен, у перечисления и булева запрещён. */
  const NUM = ['число','сумма'], FLAT = ['перечисление','булево'];
  const need = [], forbid = [];
  ST.state.objects.forEach(o => o.inds.map(i => ST.IND(i)).filter(i => i && i.src !== 'агрегат')
    .forEach(i => {
      const aggs = ST.state.indicators.filter(a => a.src === 'агрегат' && a.over === i.id);
      if(NUM.indexOf(i.type) >= 0 && aggs.length === 0) need.push(i.id);
      if(FLAT.indexOf(i.type) >= 0 && aggs.length > 0) forbid.push(i.id);
    }));
  const flat = ST.state.indicators.filter(i => FLAT.indexOf(i.type) >= 0);
  ok(73, need.length === 0 && forbid.length === 0 && flat.length === 6,
    `правило агрегата типизировано и проверено на всех ${ST.state.objects.length} объектах: без пары ${need.length}, с лишней парой ${forbid.length}; ${flat.length} показателей-перечислений и булевых входят в срез разрезом либо сравнением, а не средним (ИС-29)`);

  /* Подгруппа — ОДИН разрез с двумя уровнями: группа есть первая цифра подгруппы, как в
     модуле-владельце. Второй записи «Группа» в реестре нет (ADR-0185 §1, ADR-0012). */
  const sg = ST.statSlice({obj:'obj-borrower', dims:['d-subgroup'], inds:['a-count'], date: TODAY});
  const dsg = ST.DIM('d-subgroup');
  const kids = sg.ok ? sg.groups.reduce((a, g) => a.concat(g.children.map(c => c.parts)), []) : [];
  const derived = kids.every(pr => pr[0] === pr[1].slice(0, 1));
  const twins = ST.state.dims.filter(d => d.field === 'subgroup');
  ok(74, sg.ok && dsg.levels.length === 2 && dsg.owner === 'Классификация' &&
        kids.length > 0 && derived && twins.length === 1 &&
        sg.groups.reduce((a, g) => a + g.n, 0) === 8,
    `группа выводится из подгруппы, а не заводится вторым разрезом: ${kids.map(k => k.join(' / ')).join(' · ')}; записей о подгруппе в реестре ${twins.length}, владелец — «${dsg.owner}» (ADR-0185 §1)`);

  /* Ведущий куратор ВЫЧИСЛЯЕТСЯ (куратор договора с наибольшим остатком ОД), а не
     назначается; «ведущего подразделения» хранимым полем не бывает (ТЗ 16 §3.2, §11). */
  const bd = ST.OBJ('obj-borrower').dims.map(d => ST.DIM(d));
  const kept = bd.filter(d => d.src === 'история' && ['curator','branch'].indexOf(d.key) >= 0);
  const lead = brows.find(r => r.ref === '22903197505433');
  const his = crows.filter(r => r.dims['d-binn'] === '22903197505433')
    .map(r => r.dims['d-curator'] + ' (' + r.inds['m-debt'].v + ')');
  ok(75, kept.length === 0 && ST.DIM('d-lcurator').seam === 'leadCurator' &&
        ST.DIM('d-lbranch').seam === 'leadCurator' && lead.dims['d-lcurator'] === 'Асанов А.' &&
        his.length === 2,
    `ведущий куратор вычислен, а не закреплён: у 22903197505433 договоры ведут ${his.join(' и ')}, ведущим стал ${lead.dims['d-lcurator']} — по наибольшему остатку ОД; разрезов «куратор/подразделение» с источником-историей у заёмщика ${kept.length} (ТЗ 16 §11, P18-R16)`);

  /* Счёт объектов другого уровня — вопрос ТОМУ объекту (ADR-0186, ИС-30). Срез кредитов
     по ИНН показывает шесть заёмщиков, а их восемь: двое без договоров в него не попадают
     вовсе — распределённый счёт ответил бы на другой вопрос, не заметив этого. */
  const dist = ST.addIndicator({id:'a-cdinn', name:'Заёмщиков в срезе', obj:'obj-credit',
    src:'агрегат', fn:'countDistinct', over:'m-total'});
  const byInn = ST.statSlice({obj:'obj-credit', dims:['d-binn'], inds:['a-count'], date: TODAY});
  const all = ST.statSlice({obj:'obj-borrower', dims:[], inds:['a-count'], date: TODAY});
  ok(76, !dist.ok && has(dist.why, 'ИС-30') && ST.aggFns().length === 5 &&
        byInn.ok && byInn.groups.length === 6 && all.ok && all.total['a-count'].v === 8,
    `счёт объектов другого уровня отбит и направлен: «${String(dist.why).slice(0, 62)}…»; в срезе кредитов заёмщиков видно ${byInn.groups.length}, а их ${all.total['a-count'].v} — двое без договоров, и правильный ответ даёт только сам объект (ADR-0186)`);

  /* Заёмщик без договоров ВООБЩЕ остаётся строкой среза: число договоров у него честный
     ноль, а суммы ОТСУТСТВУЮТ — «ноль» пришлось бы назвать в какой-то валюте. */
  const empty = brows.find(r => r.ref === '77105198711204');
  const inSlice = ST.statSlice({obj:'obj-borrower', dims:['d-bstate'], inds:['a-count','a-sumbtotal'], date: TODAY});
  const g = inSlice.ok ? inSlice.groups.find(x => x.key === 'без договоров') : null;
  ok(77, empty && empty.inds['m-bcnt'].v === 0 && !empty.inds['m-btotal'] &&
        !empty.inds['m-bodays'] && empty.dims['d-bstate'] === 'без договоров' &&
        g && g.n === 2 && g.values['a-sumbtotal'].v === 0,
    `заёмщик без договоров вовсе не исчезает и не подделывается нулём: строка есть, договоров ${empty.inds['m-bcnt'].v}, свода нет вовсе, состояние «${empty.dims['d-bstate']}» — таких ${g ? g.n : '—'} (ИС-19)`);
})();

/* ---------- V. Волна 8: полный состав показателей залога ----------
   Предмет залога обеспечивает МНОГО кредитов долями, и кредит обеспечен МНОГИМИ предметами.
   Шов одного кредита показателем предмета быть не может по той же причине, по какой им не
   стал шов одного кредита у заёмщика (ИС-28), но владелец у вопроса другой: множество
   выбирает junction ОТНЕСЕНИЕ_ЗАЛОГА, и долю в нём знает только залог (ИС-31, ADR-0190).
   Держит всё тождество «сумма требований по предметам = сумма под риском по кредитам». */
(() => {
  const CORE_SEAMS = ['calcDebt','calcAccrual','calcAllocation','calcSchedule','calcForecast'];
  const zr = ST.statRows({obj:'obj-collateral', date: TODAY});
  const cr = ST.statRows({obj:'obj-credit', date: TODAY});
  const zrows = zr.ok ? zr.rows : [];
  const crows = cr.ok ? cr.rows : [];
  const Z = ref => zrows.find(r => r.ref === ref);
  const C = ref => crows.find(r => r.ref === ref);

  /* Владелец портфельного шва — владелец МНОЖЕСТВА, а не всегда ядро (ИС-31). Ядро отвечает
     о ДОГОВОРЕ и правильно делает; сложить его ответы по долям вправе только залог. */
  const cinds = ST.OBJ('obj-collateral').inds.map(i => ST.IND(i)).filter(Boolean);
  const seamed = cinds.filter(i => i.src === 'шов');
  const single = seamed.filter(i => CORE_SEAMS.indexOf(i.seam) >= 0);
  const pledge = seamed.filter(i => i.seam === 'calcPledge');
  const covD = ['d-covstate','d-covreq'].map(d => ST.DIM(d));
  const covI = ST.OBJ('obj-credit').inds.map(i => ST.IND(i))
    .filter(i => i && i.seam === 'calcCoverage');
  ok(78, single.length === 0 && pledge.length === seamed.length && seamed.length === 9 &&
        covI.length === 3 && covD.every(d => d.seam === 'calcCoverage' && d.owner === 'Залог'),
    `владелец шва есть владелец МНОЖЕСТВА: у предмета ${seamed.length} шовных показателей и все идут calcPledge, шов ОДНОГО кредита не читает ни один (${single.length}); обеспеченность кредита приходит calcCoverage — швом залога, не ядра (ИС-31, ADR-0190 §1)`);

  /* Тождество волны: требование предмета взвешено его долей в обеспечении кредита, и потому
     сумма по предметам РАВНА сумме под риском обеспеченных кредитов — по каждой валюте до
     копейки. Прежняя запись (шов одного кредита) на этом тождестве и ломалась. */
  const acc = (rows, id) => { const by = {};
    rows.forEach(r => { const c = r.inds[id]; if(!c) return;
      (c.parts || [{cur: c.cur, value: c.v}]).forEach(p =>
        by[p.cur] = Math.round(((by[p.cur] || 0) + p.value) * 100) / 100); });
    return by; };
  const left  = acc(zrows, 'm-csec');
  const right = acc(crows.filter(r => r.inds['m-secured']), 'm-crisk');
  const curs = Object.keys(left);
  const tied = curs.length === Object.keys(right).length &&
               curs.every(c => Math.abs(left[c] - right[c]) < 0.01);
  const dbl = Z('ЗЛ-2022/18');
  const pair = ['КД-2022/065','КД-2023/210'].map(C).filter(Boolean);
  const naive = pair.reduce((a, r) => a + r.inds['m-crisk'].v, 0);
  ok(79, zrows.length === 7 && tied && curs.length > 0 && dbl && pair.length === 2 &&
        dbl.inds['m-csec'].v < naive,
    `требование предмета взвешено долей: сумма по ${zrows.length} предметам сходится с суммой под риском ${crows.filter(r => r.inds['m-secured']).length} обеспеченных кредитов до копейки (${curs.map(c => left[c] + ' ' + c).join(' + ')}); у предмета под двумя договорами она ${dbl ? dbl.inds['m-csec'].v : '—'} против ${naive} «в лоб» — прежняя запись считала бы второе (ADR-0190 §2)`);

  /* База обеспечения — сумма под риском, а не остаток ОД (ADR-0011): невыбранный лимит
     обеспечивать обязаны заранее. Один и тот же предмет с одной базой порог берёт, с
     другой — нет; это не оттенок формулировки, а разный исход гейта. */
  const line = C('КД-2026/007');
  const sec = line ? line.inds['m-secured'].v : 0;
  const risk = line ? line.inds['m-crisk'].v : 0;
  const od = line ? line.inds['m-debt'].v : 0;
  const byOd = od ? Math.round(sec / od * 1000) / 10 : 0;
  const byRisk = risk ? Math.round(sec / risk * 1000) / 10 : 0;
  ok(80, line && risk > od && byOd >= 120 && byRisk < 120 &&
        line.dims['d-covstate'] === 'ниже порога' && line.dims['d-covreq'] === '120 %',
    `база решает исход: обеспечение ${sec} против остатка ОД ${od} — ${byOd} % и порог взят, против суммы под риском ${risk} (те же плюс ${Math.round((risk - od) * 100) / 100} неосвоенных) — ${byRisk} %, и состояние «${line ? line.dims['d-covstate'] : '—'}» (ADR-0011)`);

  /* Предмет — ВЕЩЬ: у неё своя валюта оценки (ADR-0009) и своя дата принятия. Реквизитами
     договора вещь не режется — после перезалога договоров у неё много (ИС-21). Две оси
     состояния независимы (§3.1): «в залоге» при просроченном запрете — не противоречие. */
  const cd = ST.OBJ('obj-collateral').dims.map(d => ST.DIM(d));
  const dealD = cd.filter(d => d.id === 'd-cur' || d.id === 'd-zdate');
  const kind = ST.DIM('d-collkind');
  const z77 = Z('ЗЛ-2023/77');
  ok(81, dealD.length === 0 && cd.length === 11 && ST.DIM('d-ccur').key === 'cur' &&
        ST.DIM('d-ccur').owner === 'Залог' && ST.DIM('d-cadm').key === 'adm' &&
        kind.levels && kind.levels.length === 2 && kind.ref === 'collkind' &&
        z77 && z77.dims['d-czstate'] === 'в залоге' && z77.dims['d-cban'] === 'просрочен' &&
        z77.dims['d-collkind'][0] === 'движимый неликвидный',
    `у вещи своя валюта оценки и своя дата принятия: разрезов ДОГОВОРА («валюта договора», «дата залогового договора») у предмета ${dealD.length} из ${cd.length}; вид двухуровневый — класс ликвидности берётся справочником владельца; две оси состояния независимы: ЗЛ-2023/77 «${z77 ? z77.dims['d-czstate'] : '—'}» при запрете «${z77 ? z77.dims['d-cban'] : '—'}» (ADR-0009, §3.1, ИС-21)`);

  /* Отношение двух величин показателем не бывает (ИС-32): в срез входят числитель и
     знаменатель, индекс считается при чтении — как сомовый эквивалент (ИС-15). Иначе он
     стал бы третьей хранимой величиной, расходящейся с обеими своими частями. */
  const ratios = ST.state.indicators.filter(i => i.unit === '%' || i.type === 'доля' ||
    /обеспеченност|покрыти|индекс/i.test(i.name || ''));
  const w = C('КД-2024/117');
  const idx = w ? Math.round(w.inds['m-secured'].v / w.inds['m-crisk'].v * 1000) / 10 : 0;
  ok(82, ratios.length === 0 && w && w.inds['m-secured'] && w.inds['m-crisk'] &&
        idx >= 120 && w.dims['d-covstate'] === 'обеспечен' && w.dims['d-covreq'] === '120 %',
    `отношения показателем нет ни одного (${ratios.length} записей с единицей «%» или типом «доля»): в строке лежат числитель ${w ? w.inds['m-secured'].v : '—'} и знаменатель ${w ? w.inds['m-crisk'].v : '—'}, индекс ${idx} % считается при чтении, а требуемый порог назван разрезом (ИС-32, ИС-15)`);

  /* Предмет без отнесений — та же форма, что заёмщик без договоров (ИС-19): строка есть,
     число кредитов честный ноль, а ТРЕБОВАНИЯ отсутствуют вовсе — «ноль» пришлось бы
     назвать в какой-то валюте и по какому-то кредиту, а их нет. */
  const free = Z('ЗЛ-2025/60');
  const ctl = ST.statSlice({obj:'obj-collateral', dims:['d-cctl'], inds:['a-count'], date: TODAY});
  ok(83, free && free.inds['m-ccred'].v === 0 && free.inds['m-cdeals'].v === 0 &&
        !free.inds['m-csec'] && free.inds['m-calloc'].v === 0 &&
        free.inds['m-cfree'].v === free.inds['m-cpledge'].v &&
        free.dims['d-cctl'] === 'отнесений нет' && !free.dims['d-csolv'] &&
        ctl.ok && ctl.groups.length === 5,
    `предмет без отнесений остаётся строкой: кредитов ${free ? free.inds['m-ccred'].v : '—'}, требований нет ВОВСЕ, доступная залоговая равна всей залоговой (${free ? free.inds['m-cfree'].v : '—'}), группы платёжеспособности нет — резолвить не от кого; состояний контроля в срезе ${ctl.ok ? ctl.groups.length : '—'} (ИС-19)`);

  /* Периодичность обследования — матрица «группа платёжеспособности × движимое/недвижимое»
     (Р-3), а не свойство вида: одна и та же недвижимость смотрится раз в год у платящего
     и раз в квартал у третьей группы. Банкрот — по договору со спецадминистратором, и
     авто-просрочка ему не поднимается вовсе: срока нет, а не «срок нарушен». */
  const bank = zrows.filter(r => r.dims['d-cctl'] === 'по договору со спецадминистратором');
  const re = Z('ЗЛ-2024/41');
  const mv = Z('ЗЛ-2025/09');
  const grid = re && mv && re.inds['m-csurv'].v + re.inds['m-cnext'].v === 365 &&
               mv.inds['m-csurv'].v + mv.inds['m-cnext'].v === 90;
  ok(84, grid && bank.length === 3 && bank.every(r => !r.inds['m-cnext']) &&
        re.dims['d-csolv'][0] === '1' && mv.dims['d-csolv'][0] === '2' &&
        mv.dims['d-cctl'] === 'просрочен' && mv.inds['m-cnext'].v < 0,
    `срок контроля берётся матрицей «группа × движимое/недвижимое», а не видом: недвижимость группы 1 — 365 дн. (осталось ${re ? re.inds['m-cnext'].v : '—'}), движимое группы 2 — 90 дн. и просрочка ${mv ? mv.inds['m-cnext'].v : '—'}; у ${bank.length} предметов банкрота контроль «по договору со спецадминистратором», авто-просрочка не поднимается (Р-3)`);

  /* Перезалог (§4.1): предмет стоит под несколькими нашими договорами, каждый следующий —
     на ОСТАТОЧНУЮ залоговую стоимость. Инвариант junction: Σ долей ≤ залоговой, и она же
     раскладывается на отнесённое плюс доступное — на каждом предмете без исключения. */
  const over = zrows.filter(r => r.inds['m-calloc'].v > r.inds['m-cpledge'].v + 0.001);
  const closed = zrows.every(r => Math.abs(r.inds['m-cpledge'].v - r.inds['m-calloc'].v -
                                           r.inds['m-cfree'].v) < 0.01);
  const kf = dbl ? Math.round(dbl.inds['m-cval'].v * 0.7 * 100) / 100 : 0;
  ok(85, over.length === 0 && closed && dbl && dbl.inds['m-cdeals'].v === 2 &&
        dbl.inds['m-ccred'].v === 2 && dbl.inds['m-cpledge'].v === kf &&
        dbl.inds['m-cfree'].v > 0,
    `перезалог: ЗЛ-2022/18 стоит под ${dbl ? dbl.inds['m-cdeals'].v : '—'} договорами и ${dbl ? dbl.inds['m-ccred'].v : '—'} кредитами, отнесено ${dbl ? dbl.inds['m-calloc'].v : '—'} из залоговых ${dbl ? dbl.inds['m-cpledge'].v : '—'} (оценочные ${dbl ? dbl.inds['m-cval'].v : '—'} × 0,7), доступно ${dbl ? dbl.inds['m-cfree'].v : '—'}; Σ долей не превышает залоговую нигде (${over.length} нарушений), и на всех ${zrows.length} предметах залоговая = отнесённое + доступное (§4.1, Р-19)`);
})();

/* ---- отчёт ---- */
const pass = results.filter(r => r.pass).length;
const lines = results.map(r => `   ${r.pass ? 'PASS' : 'FAIL'}  #${r.n}  ${r.note}`);
const stamp = `SMOKE 2026-08-27 · ${pass}/${results.length} PASS\n` + lines.join('\n');
console.log(stamp);

const body = lines.map(l => '  ' + l).join('\n');
const injected = `  SMOKE 2026-08-27 · ${pass}/${results.length} PASS\n` + body;
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
