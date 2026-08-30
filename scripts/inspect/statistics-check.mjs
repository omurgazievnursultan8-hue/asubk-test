// Headless smoke для mockups/statistics/statistics.html (ИС-1…ИС-38, ADR-0145…0152 + 0176…0204).
// Блок S закрывает бывшие дефекты макета СС-Д1/Д2/Д3/Д6 (вопрос целиком, а не его половина),
// блок W — СС-Д8 (наборы фильтра, ДНФ без скобок по ADR-0180),
// блок X — волна 11 ч.2: погашение разведено на платёж и поступление (ADR-0183),
// блок Y — волна 12: три тонких объекта под ADR-0201 (объект снят · меры сняты · состав
// добран) и закрытый СС-Д13 (выбор из пустого набора — прочерк, а не ноль),
// блок Z — волна 13: у каждой записи реестра есть объект, который ею спрашивает —
// сирота «Дата залогового договора» молчала с волны 8, владелец заведён строкой (ТЗ #4),
// блок Э — волна 14: спрашивается дата ПРОГОНА, а не «сегодня» (ИС-36, ADR-0202) —
// хвост отказывает и называет дорогу, дыра внутри истории подставляет с возрастом (ИС-12),
// блок Ю — волна 15: закрытый СС-Д11 — охват ролей ОБЪЯВЛЕН реквизитом объекта, а не зашит
// именем разреза (ИС-37, ADR-0203): режется своим разрезом · общий · отказ с дорогой,
// блок Я — волна 17: календарь учётных периодов — ОДИН общий справочник ниже всех слоёв
// (ИС-38, ADR-0204): строка = период, в ней колонка-защёлка на слой со своим актором и
// своей датой; каскад идёт снизу вверх и стережётся справочником, а не вызывающим.
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
/* Дата ВОПРОСА — не «сегодня», а последний прогон (ИС-36, волна 14). До волны 14 смоук
   спрашивал TODAY, и каждый такой вопрос молча отвечал строками от 18.08: подстановка в
   хвосте была не видна ни одной проверке, потому что все числа сходились. TODAY остаётся
   датой ОПЕРАЦИЙ — прогона, пропуска, оформления выгрузки. */
const ASK = '2026-08-20';
/* Фильтр вопроса — ДНФ без скобок (ADR-0180): F(a, b) — два набора через ИЛИ,
   F([a, b]) — один набор из двух сравнений через И. Скобок в форме нет, поэтому
   и в конструкторе смоука их негде поставить. */
const F  = (...sets) => ({ sets: sets.map(x => ({ cmps: Array.isArray(x) ? x : [x] })) });
const cD = (id, op, extra) => Object.assign({ kind:'dim', id, op }, extra || {});
const cI = (id, op, extra) => Object.assign({ kind:'ind', id, op }, extra || {});

/* ---------- A. Реестры: что вообще можно объявить ---------- */
(() => {
  ST.seed();
  const st = ST.state;
  const badSrc = st.indicators.filter(i => ['шов','поле','агрегат'].indexOf(i.src) < 0);
  const formula = st.indicators.filter(i => 'formula' in i || 'expr' in i || 'выражение' in i);
  const badFn = st.indicators.filter(i => i.src === 'агрегат' && ST.aggFns().indexOf(i.fn) < 0);
  ok(1, st.objects.length === 10 && st.indicators.length >= 85 && badSrc.length === 0 &&
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
  /* Первый разрез объекта берётся вслепую, и у «Залогового договора» он ЕДИНСТВЕННЫЙ и
     с корзинами: дата без корзины — не вопрос, а недоговорённость (ADR-0176 §2), и движок
     обязан отказать. Поэтому корзина называется здесь, а не выключается сторож. */
  const each = ST.state.objects.map(o => {
    const d = ST.DIM(o.dims[0]);
    const q = {obj: o.id, dims: [o.dims[0]], inds: ['a-count'], date: ASK};
    if (d.buckets && d.buckets.length) q.buckets = {[o.dims[0]]: d.buckets[0]};
    const r = ST.statSlice(q);
    return {name: o.name, ok: r.ok, n: r.ok ? r.n : 0, g: r.ok ? r.groups.length : 0};
  });
  ok(6, each.every(x => x.ok && x.n > 0) && each.length === 10,
    `десять объектов одним движком: ${each.map(x => x.name + ' ' + x.n + '/' + x.g + ' групп').join(' · ')}`);

  const cr = ST.statSlice({obj:'obj-credit', dims:['d-branch'], inds:['a-count','a-sumdebt'], date: ASK});
  const bo = ST.statSlice({obj:'obj-borrower', dims:['d-ptype'], inds:['a-count','a-sumbcnt'], date: ASK});
  ok(7, cr.ok && bo.ok && cr.dims[0] !== bo.dims[0] && cr.inds[1] !== bo.inds[1] &&
       bo.groups.some(g => g.parts[0] === 'физическое лицо'),
    `непохожая пара на одном движке: кредит по подразделениям (${cr.n}) и заёмщик по типу лица (${bo.n}) — разные разрезы, разные показатели, разные множества`);

  const zero = ST.statRows({obj:'obj-borrower', date: ASK}).rows.find(r => r.ref === '45607195804119');
  ok(8, zero && zero.inds['m-bcnt'].v === 0,
    `заёмщик без действующих кредитов в срезе есть (договоров ${zero && zero.inds['m-bcnt'].v}) — при свёртке кредитов он исчез бы вовсе (ИС-19)`);
})();

/* ---------- C. Шестой объект — строкой реестра, а не релизом ---------- */
(() => {
  ST.seed();
  const before = ST.statSlice({obj:'obj-guarantee', dims:[], inds:['a-count'], date: ASK});
  const mi = ST.addIndicator({id:'m-gsec', name:'Обеспечиваемые требования', obj:'obj-guarantee',
    src:'шов', seam:'calcDebt', field:'principal', money:true, type:'сумма'});
  const ai = ST.addIndicator({id:'a-sumgsec', name:'Обеспечено требований, итого', obj:'obj-guarantee',
    src:'агрегат', fn:'sum', over:'m-gsec'});
  const add = ST.addObject({id:'obj-guarantee', name:'Поручительство', plural:'поручительства',
    owner:'Обеспечение', refName:'номер поручительства', born:{src:'поле', key:'gdate'},
    dims:['d-branch','d-curator','d-region','d-ptype'], inds:['m-gsec','a-count','a-sumgsec']});
  const run = ST.run('2026-08-20', {});
  const after = ST.statSlice({obj:'obj-guarantee', dims:['d-region'], inds:['a-count','a-sumgsec'], date:'2026-08-20'});
  ok(9, !before.ok && mi.ok && ai.ok && add.ok && run.ok && after.ok && after.n === 3 && after.groups.length === 3,
    `одиннадцатый объект заведён записью: до — «${before.why}», после — ${after.n} объектов в ${after.groups.length} группах, без единой правки движка (ИС-18)`);

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
  const last = st.runs.filter(r => r.kind !== 'пропуск').map(r => r.date).sort().slice(-1)[0];
  ok(11, planned === 6 && skipped.length === 1 && skipped[0].date === '2026-08-19' && !!skipped[0].reason &&
        last === '2026-08-20' && last < TODAY && st.q.date === last,
    `журнал: плановых прогонов ${planned}, пропуск ${skipped[0].date} — «${skipped[0].reason}». Пропуск лежит ВНУТРИ истории (после него был прогон ${last}), а сегодня ${TODAY} прогона ещё не было — умолчание вопроса стоит на ${st.q.date}, а не на «сегодня» (ИС-36)`);

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
  /* Обстановка волны 17: колонка СТАТИСТИКИ ставится только после нижних (ИС-38,
     ADR-0204 §3). Утверждение сторожа прежнее — у фиксации есть фамилия и она попадает
     в строку; добавилось лишь то, что до верхней колонки надо доехать снизу. */
  ST.closeLayer('2026-07', 'учёт', 'Осмонова Г., главный бухгалтер', '2026-08-05');
  ST.closeLayer('2026-07', 'классификация', 'Турдубаева А., администратор классификации', '2026-08-07');
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

  const s = ST.statSlice({obj:'obj-credit', dims:['d-branch'], inds:['a-count'], date: ASK});
  const r = ST.statRows({obj:'obj-credit', date: ASK});
  const q = ST.statSeries({obj:'obj-credit', inds:'a-sumdebt', dates:['2026-05-31','2026-06-30','2026-07-31','2026-08-18']});
  const full = [s, r, q].every(x => x.ok && x.passport && x.passport.asOf && x.passport.fixation && x.passport.scope && x.passport.filter);
  ok(19, full && ST.seams().length === 3,
    `все три шва (${ST.seams().join(' · ')}) отдают паспорт с датой расчёта, признаком фиксации и областью видимости — ИС-10`);

  /* ИС-12 после волны 14 — про дыру ВНУТРИ истории, а не про хвост: 19.08 пропущено,
     20.08 прогон был, значит дыра окончательна и лучшего ответа, чем 18.08, не будет. */
  const gap = ST.statSlice({obj:'obj-credit', dims:['d-branch'], inds:['a-count'], date:'2026-08-19'});
  const p = gap.passport;
  ok(20, p.asOf === '2026-08-18' && p.substituted === true && p.age === 1 &&
        has(p.skipped, '19.08.2026') && has(p.skipped, 'пропуск') &&
        s.passport.substituted === false && s.passport.age === 0,
    `дыра внутри истории отвечает подстановкой с названным возрастом: спрошено 19.08, отдано на ${p.asOf} · возраст ${p.age} дн. · почему: ${p.skipped}. Вопрос на дату прогона подстановки не требует вовсе (${s.passport.asOf}, возраст ${s.passport.age}) — ИС-12`);

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
  const all = ST.statSlice({obj:'obj-credit', dims:['d-branch'], inds:['a-count','a-sumdebt'], date: ASK});
  ST.setRole('Аналитик');
  const mine = ST.statSlice({obj:'obj-credit', dims:['d-branch'], inds:['a-count','a-sumdebt'], date: ASK});
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
    filter: F(cD('d-cur', '=', {value:'USD'}))}).total['a-sumdebt'];
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
  /* Здесь же видно вторую половину ИС-36: «сегодня» спрашивается не по праву «сегодня», а
     потому что прогон написал строки. До прогона вопрос на TODAY отказ, после — ответ. */
  const shut = ST.statSlice({obj:'obj-credit', dims:['d-segment'], inds:['a-count'], date: TODAY});
  ST.run(TODAY, {manual:true, reason:'разметка новым разрезом'});
  const now = ST.statSlice({obj:'obj-credit', dims:['d-segment'], inds:['a-count'], date: TODAY});
  ok(32, add.ok && add.since === TODAY && !past.ok && has(past.why, 'действует вперёд') &&
        !shut.ok && has(shut.why, 'ИС-36') && now.ok && now.groups.length > 1,
    `новый разрез действует вперёд: прошлое — «${past.why}»; сегодня — ${now.groups.length} групп, и спросить сегодня стало можно только ПОСЛЕ прогона (до него — «${shut.why.slice(0,60)}…»)`);
})();

/* ---------- J. Сходимость с реестром владельца и швы ---------- */
(() => {
  ST.seed();
  const r = ST.statRows({obj:'obj-credit', date: ASK});
  const reg = ST.registryList('obj-credit', r.passport.asOf);
  const same = r.rows.map(x => x.ref).sort().join('|') === reg.join('|');
  const extra = r.rows.filter(x => 'документы' in x || 'связи' in x || 'card' in x);
  ok(33, same && extra.length === 0,
    `детализация сходится со списком реестра «Кредиты» один в один (${reg.length} из ${reg.length}); карточек, документов и связей шов не отдаёт — ИС-14`);

  const clf = ST.callSeam('классификация', 'statSlice', {obj:'obj-credit', dims:[], inds:['a-count'], date: ASK});
  const noClf = ST.consumers().find(c => c.module === 'классификация').may.length;
  ok(34, !clf.ok && has(clf.why, 'ИС-5') && noClf === 0,
    `классификация статистику не читает ни в одной форме: «${clf.why}»`);

  const fourth = ST.callSeam('отчётность', 'statAll', {});
  const rep = ST.callSeam('отчётность', 'statSlice', {obj:'obj-credit', dims:['d-branch'], inds:['a-count'], date: ASK});
  ok(35, !fourth.ok && has(fourth.why, 'четвёртый не заводится') && rep.ok && !!rep.passport,
    `швов три, четвёртого нет: «${fourth.why}»; отчётность получает срез с паспортом`);

  const rowInd = ST.statSlice({obj:'obj-credit', dims:[], inds:['m-debt'], date: ASK});
  const ghost = ST.statSlice({obj:'obj-credit', dims:[], inds:['m-ghost'], date: ASK});
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
  /* Спрашивается дата ТОГО прогона, который показатель посчитал: на 20.08 записи ещё
     не было, и её отсутствие там — не дефект, а порядок слоёв (ИС-36 + ADR-0147 §4). */
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
        has(j, 'Прогоны') && has(j, 'Календарь учётных периодов') &&
        has(j, 'Простановка колонок: чужие действия и своё') &&
        ST.layers().every(L => has(j, '<th>' + L + '</th>')) &&
        has(x, 'Очередь заданий') && has(x, 'Чего на этом экране нет') &&
        has(g, 'Реестр объектов статистики') && has(g, 'Ссылки потребителей') && has(g, 'Чего здесь завести нельзя'),
    `четыре экрана рисуются без ошибок${errs.length ? ': ' + errs.join(' · ') : ''}; паспорт стоит НАД результатом, а календарь периодов показан ТРЕМЯ колонками (${ST.layers().join(' · ')}) — одна пилюля «зафиксирован/открыт» не отвечала, до какого слоя доехало закрытие и чья фамилия в каждой колонке (ИС-38). Чужое действие по-прежнему помечено как чужое`);

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
  const t = ST.statSlice({obj:'obj-credit', dims:['d-region'], inds:['a-count','a-sumdebt'], date: ASK});
  const top = t.ok ? t.groups.map(g => g.key).join(' · ') : '';
  const kids = t.ok ? t.groups.reduce((n,g) => n + g.children.length, 0) : 0;
  ok(47, t.ok && t.hier && t.hier.depth === 2 && kids > 0 &&
        t.groups.every(g => g.n === g.own + g.children.reduce((x,c) => x + c.n, 0)),
    `ответ — дерево всегда: ${t.groups.length} узлов верхнего уровня (${top}), ниже ${kids}; каждый узел считается по своим строкам (ADR-0176 §5, §6)`);

  const orphan = t.ok ? t.groups.find(g => g.key === 'Таласская') : null;
  const lvl1 = ST.statSlice({obj:'obj-credit', dims:['d-region'], inds:['a-count'], date: ASK, levels:{'d-region':1}});
  const sumTop = t.ok ? t.groups.reduce((x,g) => x + g.n, 0) : -1;
  ok(48, orphan && orphan.n === 1 && orphan.own === 1 && orphan.children.length === 0 &&
        lvl1.ok && lvl1.hier.depth === 1 && lvl1.n === t.n && sumTop === t.n,
    `объект без нижнего уровня остаётся у родителя и не исчезает: «Таласская» — своих ${orphan ? orphan.own : '—'}; уровень спрашивается вопросом (ИС-22)`);

  const bad = ST.statSlice({obj:'obj-credit', dims:['d-region'], inds:['a-count'], date: ASK, levels:{'d-region':3}});
  const noB = ST.statSlice({obj:'obj-credit', dims:['d-cdate'], inds:['a-count'], date: ASK});
  const yr  = ST.statSlice({obj:'obj-credit', dims:['d-cdate'], inds:['a-count'], date: ASK, buckets:{'d-cdate':'год'}});
  const qt  = ST.statSlice({obj:'obj-credit', dims:['d-cdate'], inds:['a-count'], date: ASK, buckets:{'d-cdate':'квартал'}});
  ok(49, !bad.ok && has(bad.why, 'ИС-22') && !noB.ok && has(noB.why, 'ИС-23') &&
        yr.ok && qt.ok && qt.groups.length > yr.groups.length && yr.n === qt.n,
    `корзина обязательна и берётся из объявленных: без корзины — отказ «${String(noB.why).slice(0, 48)}…»; год ${yr.groups.length} групп, квартал ${qt.groups.length}, строк одинаково ${yr.n} (ИС-23)`);

  const br = ST.statSlice({obj:'obj-credit', dims:['d-branch'], inds:['a-count'], date: ASK});
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
  const few = ST.statRows({obj:'obj-credit', date: ASK});
  const many = ST.statRows({obj:'obj-repay', date: ASK});
  const trunc = many.ok ? 0 : (many.rows || []).length;
  ok(52, few.ok && few.rows.length === 8 && !many.ok && many.overLimit &&
        many.n === 14 && trunc === 0 && has(many.why, String(many.n)) && has(many.why, 'ИС-22'),
    `ответ двоичен: 8 строк отдаются целиком, 14 — отказ, называющий ЧИСЛО (${many.n}) при пороге ${many.limit}; усечённого ответа нет (ADR-0178 §1, §4)`);

  const pagers = Object.keys(ST).filter(k => /page|offset|limitRows|truncate/i.test(k));
  const job = ST.exportJob({obj:'obj-repay', date: ASK});
  const p = job.ok ? job.job.passport : null;
  ok(53, pagers.length === 0 && job.ok && job.job.n === 14 && p && p.asOf && p.fixation && p.scope &&
        job.job.file && ST.exportsList().length === 1,
    `сверка целиком идёт заданием ${job.ok ? job.job.id : '—'}, паспорт едет ВНУТРИ файла (${p ? p.asOf : '—'} · ${p ? p.fixation : '—'}); страниц и усечения в швах нет (ADR-0178 §5)`);

  ST.setRole('Аналитик');
  const cur = ST.statRows({obj:'obj-repay', date: ASK});
  ST.setRole('Администратор статистики');
  ok(54, cur.ok && cur.rows.length < 14 && cur.rows.length <= ST.rowsLimit &&
        has(cur.passport.scope, 'доступным вам'),
    `порог считается ПОСЛЕ ролевых правил: аналитику видно ${cur.ok ? cur.rows.length : '—'} из 14 — список он получает, а не отказ из-за чужого множества (ADR-0178 §3)`);

  const w = ST.workList('obj-credit', ASK);
  ok(55, w.ok && has(w.note, 'сутки, а не расхождение') && w.list.length > 0,
    `второе действие числа названо отдельно от первого: «${String(w.note).slice(0, 70)}…» (ИС-14, врезка ADR-0152 §4)`);
})();

/* ---------- Q. Паспорт: ровно две формы (ИС-24) ---------- */
(() => {
  ST.seed();
  const r = ST.statSlice({obj:'obj-credit', dims:['d-branch'], inds:['a-count'], date: ASK});
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
  st.q.filter = F(cD('d-branch', '=', {value: vals[0]}));
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
  const free = ST.statSlice({obj:'obj-repay', dims:['d-fdate'], inds:['a-count'], date: ASK,
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
  const rows = ST.statRows({obj:'obj-credit', date: ASK}).rows;
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
  const fo1 = ST.statSlice({obj:'obj-credit', dims:['d-odays'], date: ASK,
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
  const sched = ST.statSlice({obj:'obj-credit', dims:[], date: ASK,
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
  const crows = ST.statRows({obj:'obj-credit', date: ASK}).rows;
  const brows = ST.statRows({obj:'obj-borrower', date: ASK}).rows;
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
  const agg = ST.statSlice({obj:'obj-borrower', dims:['d-ptype'], inds:['a-sumbtotal'], date: ASK});
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
  const sg = ST.statSlice({obj:'obj-borrower', dims:['d-subgroup'], inds:['a-count'], date: ASK});
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
  const byInn = ST.statSlice({obj:'obj-credit', dims:['d-binn'], inds:['a-count'], date: ASK});
  const all = ST.statSlice({obj:'obj-borrower', dims:[], inds:['a-count'], date: ASK});
  ok(76, !dist.ok && has(dist.why, 'ИС-30') && ST.aggFns().length === 5 &&
        byInn.ok && byInn.groups.length === 6 && all.ok && all.total['a-count'].v === 8,
    `счёт объектов другого уровня отбит и направлен: «${String(dist.why).slice(0, 62)}…»; в срезе кредитов заёмщиков видно ${byInn.groups.length}, а их ${all.total['a-count'].v} — двое без договоров, и правильный ответ даёт только сам объект (ADR-0186)`);

  /* Заёмщик без договоров ВООБЩЕ остаётся строкой среза: число договоров у него честный
     ноль, а суммы ОТСУТСТВУЮТ — «ноль» пришлось бы назвать в какой-то валюте. */
  const empty = brows.find(r => r.ref === '77105198711204');
  const inSlice = ST.statSlice({obj:'obj-borrower', dims:['d-bstate'], inds:['a-count','a-sumbtotal'], date: ASK});
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
  const zr = ST.statRows({obj:'obj-collateral', date: ASK});
  const cr = ST.statRows({obj:'obj-credit', date: ASK});
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
  const ctl = ST.statSlice({obj:'obj-collateral', dims:['d-cctl'], inds:['a-count'], date: ASK});
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

/* ---------- Z. Рождение строки: ИС-33, ADR-0197 (волна 9) ---------- */
(() => {
  ST.seed();
  const st = ST.state;
  const D = ['2026-05-31','2026-06-30','2026-07-31','2026-08-10','2026-08-18'];
  const cnt = (o, d) => st.rows.filter(r => r.obj === o && r.date === d).length;
  const line = o => D.map(d => cnt(o, d));
  const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

  /* Состав среза меняется во времени, потому что объекты РОЖДАЮТСЯ. До 27.08.2026 строки
     писались на все прошлые даты сразу: срез на 31.05 показывал 14 платежей, ни один из
     которых тогда не существовал (июнь–август), — и «платежей за июль» через разность
     двух дат выходило ноль. Смерть при этом состояние, а не исчезновение: однажды
     родившись, объект из состава уже не выпадает, и ряд не убывает нигде. */
  const rep9 = line('obj-repay'), cas = line('obj-case');
  const mes = line('obj-measure');
  const stable = ['obj-credit','obj-borrower','obj-collateral','obj-program']
    .every(o => line(o).every(n => n === cnt(o, D[0])));
  const monotone = st.objects.every(o => line(o.id).every((n, i, a) => i === 0 || n >= a[i-1]));
  ok(86, eq(rep9, [0,4,10,12,14]) && eq(cas, [2,2,2,3,3]) &&
        eq(mes, [3,3,3,5,5]) && stable && monotone,
    `состав среза идёт за рождением: погашения ${rep9.join('·')}, дела ${cas.join('·')}, меры ${mes.join('·')}; долгоживущие четыре объекта неизменны, и ни у одного объекта состав не убывает — смерть это состояние, а не пропажа строки (ИС-33)`);

  /* Пустой ответ и несосчитанная дата — РАЗНЫЕ вещи. Даты прогонов теперь берутся
     журналом, а не наличием строк: иначе 31.05 у погашений читалось бы как «прогона не
     было» и молча подменилось бы предыдущей датой, которой тоже нет (ИС-12, ИС-19). */
  const empty = ST.statSlice({obj:'obj-repay', dims:['d-repkind'], inds:['a-count','a-sumramount'],
    date:'2026-05-31'});
  const may = st.runs.find(r => r.date === '2026-05-31');
  const part = may && may.parts.find(p => p.obj === 'obj-repay');
  const noborn = st.runs.filter(r => r.parts).reduce((n, r) =>
    n + r.parts.reduce((k, p) => k + (p.noborn || 0), 0), 0);
  ok(87, empty.ok && empty.n === 0 && empty.groups.length === 0 &&
        empty.passport.asOf === '2026-05-31' && empty.passport.substituted === false &&
        part && part.n === 0 && part.unborn === 14 && noborn === 0,
    `«строк ноль» не «прогона не было»: срез от 31.05 отвечает пустотой на СВОЮ дату (подстановки нет), а прогон называет ненаступившее поимённо — ${part ? part.unborn : '—'} ещё не рождённых; записей с необъявленным рождением во всём мире ${noborn} (ИС-12, ИС-19, СС-Д6)`);

  /* ИС-17: период — разность двух накопленных итогов. Рождение внутри периода эту
     разность РАСЩЕПЛЯЕТ: в ней сидит и движение старых, и всё требование новорождённого.
     Ни одна половина сама по себе разности не равна — и потому «прирост» читать
     движением нельзя. Отсутствие строки при этом обязано быть отсутствием, а не нулём:
     нулём оно дало бы движение, которого не было, пустотой — потеряло бы поступление. */
  const at = d => ST.statRows({obj:'obj-case', date: d}).rows;
  const r31 = at('2026-07-31'), r10 = at('2026-08-10');
  const nb = r10.find(r => r.ref === 'ДВ-2026/07');
  const born31 = r31.some(r => r.ref === 'ДВ-2026/07');
  const sum = rs => Math.round(rs.reduce((n, r) => n + (r.inds['m-claim'] || {}).v, 0) * 100) / 100;
  const old31 = sum(r31), old10 = sum(r10.filter(r => r.ref !== 'ДВ-2026/07'));
  const delta = Math.round((sum(r10) - old31) * 100) / 100;
  const move  = Math.round((old10 - old31) * 100) / 100;
  const claim = nb ? Math.round(nb.inds['m-claim'].v * 100) / 100 : 0;
  ok(88, !born31 && nb && r31.length === 2 && r10.length === 3 &&
        Math.abs(delta - (move + claim)) < 0.01 && Math.abs(delta - claim) > 0.01 &&
        claim > 0 && move < 0,
    `рождение внутри периода расщепляет разность: итог вырос на ${delta} = движение двух прежних (${move}) + требование родившегося 01.08 (${claim}); на 31.07 его строки НЕТ ВОВСЕ — не нулевая, а отсутствующая, иначе «прирост» показал бы движение, которого не было (ИС-17, ИС-19, ИС-33)`);

  /* Рождение — объявленный реквизит, а не догадка движка: его не выводят из первого
     звена истории и не подставляют «датой первого прогона». Объект без него не
     заводится вовсе — иначе дефект вернулся бы следующей же строкой реестра. */
  const SRC = ['поле','история','шов'];
  const declared = st.objects.filter(o => o.born && SRC.indexOf(o.born.src) >= 0);
  const noBorn = ST.addObject({id:'obj-guarantee', name:'Поручительство', plural:'поручительства',
    owner:'Обеспечение', refName:'номер поручительства',
    dims:['d-branch','d-curator','d-region','d-ptype'], inds:['a-count']});
  const guess = /первое звено|первый прогон|Object\.values\(item\.h\)/.test(
    m[1].slice(m[1].indexOf('function bornOn'), m[1].indexOf('function readPath')));
  ok(89, declared.length === 10 && !noBorn.ok && has(noBorn.why, 'ИС-33') && !guess,
    `рождение объявлено, а не угадано: у всех ${declared.length} объектов born со ссылкой на реквизит владельца, объект без него не заводится — «${noBorn.why}» (ИС-18, ИС-33)`);

  /* ИС-14 на дате: тот же человек, открывший реестр владельца НА ТУ ЖЕ дату, обязан
     увидеть тот же состав. До волны 9 сходилось неверно — оба показывали все 14. */
  const same = D.every(d => ST.registryList('obj-repay', d, null).length === cnt('obj-repay', d));
  const pairs = D.map(d => ST.registryList('obj-repay', d, null).length + '/' + cnt('obj-repay', d));
  ok(90, same,
    `реестр владельца на дату и состав среза сходятся по всем пяти датам (${pairs.join(' · ')}) — и сходятся теперь на ВЕРНОМ числе, а не на общем итоге мира (ИС-14, ИС-33)`);
})();

/* ---------- N. Волна 10: дело и требование, дедуп-ключ, удельная величина ---------- */
(() => {
  ST.seed();
  const st = ST.state;
  const D = '2026-08-18';

  /* ИС-34. Сумма групп БОЛЬШЕ итога — и это не расхождение счёта, а устройство: один
     кредит стоит и в филиале заёмщика, и в филиале поручителя, но денег вдвое не
     становится. Проверяется по построению набора: солидарная пара разведена по филиалам. */
  const br = ST.statSlice({obj:'obj-claim', dims:['d-branch'], levels:{'d-branch':2},
    inds:['a-count','a-sumclsum'], date: D});
  const sumG = Math.round(br.groups.reduce((n, g) => n + ((g.values['a-sumclsum']||{}).v||0), 0)*100)/100;
  const tot  = Math.round((br.total['a-sumclsum']||{}).v*100)/100;
  const dd   = (br.total['a-sumclsum']||{}).dedup;
  ok(91, br.ok && dd && dd.by === 'd-clcred' && dd.keys === 3 && dd.dropped === 3 &&
        sumG > tot && Math.abs(sumG - tot) > 1,
    `дедуп-ключ: строк ${br.n}, кредитов ${dd && dd.keys}, схлопнуто ${dd && dd.dropped}; сумма филиалов ${sumG} БОЛЬШЕ итога ${tot} — один кредит честно стоит в двух филиалах, но денег вдвое не становится (ИС-34, ADR-0199)`);

  /* Молча расходиться нельзя: паспорт называет ключ поимённо и говорит, сколько строк
     схлопнулось. Без этой строки ответ читался бы как ошибка счёта (ИС-10). */
  const note = (br.passport.dedup || [])[0];
  ok(92, note && note.by === 'd-clcred' && note.rows === 6 && note.keys === 3 &&
        has(note.text, 'Кредит требования') && has(note.text, 'ИС-34'),
    `паспорт НАЗЫВАЕТ ключ, а не молчит: «${note ? note.text : '—'}»`);

  /* Тождество ИС-3/ИС-14 послаблено ровно там, где объявлен ключ, и НИГДЕ больше:
     у показателя без ключа сумма групп сходится с итогом до копейки, как прежде. */
  const cr = ST.statSlice({obj:'obj-credit', dims:['d-branch'], levels:{'d-branch':2},
    inds:['a-count','a-sumdebt'], date: D});
  /* Разновалютный итог сводится в сом ПОКАЗОМ и лежит в `v`; одновалютный несёт и `som`.
     Сверяются одни и те же части по одним и тем же курсам — потому равенство точное. */
  const som = c => c ? (c.som != null ? c.som : c.v) : 0;
  const sumC = cr.groups.reduce((n, g) => n + som(g.values['a-sumdebt']), 0);
  const totC = som(cr.total['a-sumdebt']);
  const keyless = st.indicators.filter(i => i.src !== 'агрегат' && !i.dedupBy).length;
  ok(93, cr.ok && Math.abs(sumC - totC) < 0.01 && !(cr.total['a-sumdebt']||{}).dedup && keyless > 60,
    `послабление точечное: у ${keyless} показателей без ключа сумма групп сходится с итогом до копейки (${Math.round(sumC*100)/100} = ${Math.round(totC*100)/100}) и отметки дедупа в ответе нет вовсе (ИС-3, ИС-14)`);

  /* ИС-21: фаза уехала с дела на требование, и отказ обязан НАЗВАТЬ ДОРОГУ, а не просто
     отвергнуть — иначе разрез читался бы как исчезнувший. */
  const ph = ST.statSlice({obj:'obj-case', dims:['d-phase'], inds:['a-count'], date: D});
  const phOk = ST.statSlice({obj:'obj-claim', dims:['d-phase'], inds:['a-count'], date: D});
  ok(94, !ph.ok && has(ph.why, 'Требование взыскания') && has(ph.why, 'ИС-21') &&
        phOk.ok && phOk.groups.length >= 2,
    `фаза спрашивается у того, у кого она одна: делу отказано и указана дорога — «${ph.why}»; у требования тот же разрез отвечает ${phOk.groups.length} фазами`);

  /* Ни одной производной величины в поле: «дней в фазе» считается из журнала фаз при
     чтении, а не лежит реквизитом, который кто-то обязан не забыть обновить (ADR-0001). */
  const W = vm.runInContext('WORLD', sandbox);
  const stored = Object.keys(W).reduce((n, o) => n + W[o].filter(x =>
    Object.keys(x.f).some(k => /phdays|daysin|срок/i.test(k))).length, 0);
  const claim = ST.statRows({obj:'obj-claim', date: D}).rows.find(r => r.ref === 'ТВ-2026/03-1');
  ok(95, stored === 0 && claim && claim.inds['m-clphdays'].v > 0,
    `производной величины полем не лежит нигде (${stored} записей): «дней в фазе» у ТВ-2026/03-1 — ${claim && claim.inds['m-clphdays'].v} дн. — свёрнуто из журнала фаз при чтении (ИС-1, ADR-0001)`);

  /* ИС-28 + ИС-31: у объекта О МНОГИХ шва одного кредита нет ни одного, а портфельный шов
     принадлежит ВЛАДЕЛЬЦУ МНОЖЕСТВА — здесь взысканию, потому что связь «дело × кредит ×
     роль» знает только оно. Второй названный случай правила после залога (#78). */
  const cInds = st.indicators.filter(i => i.obj === 'obj-case' && i.src === 'шов');
  const one = cInds.filter(i => i.seam === 'calcDebt' || i.seam === 'calcPortfolio');
  ok(96, cInds.length === 4 && one.length === 0 && cInds.every(i => i.seam === 'casePortfolio'),
    `портфельный шов дела принадлежит взысканию: ${cInds.length} шовных показателей, все идут casePortfolio, шов ОДНОГО кредита не читает ни один (${one.length}) — множество выбирает связь «дело × кредит × роль», и знает её только владелец (ИС-28, ИС-31)`);

  /* ИС-35: удельная величина показателем не заводится вовсе. Отказ обязан указать пару
     «срез + счёт» и предупредить о занижении знаменателя. */
  const per = ST.addIndicator({id:'m-perc', name:'Требований на куратора', obj:'obj-claim',
    src:'агрегат', fn:'avg', over:'m-clsum'});
  ok(97, !per.ok && has(per.why, 'ИС-30') && has(per.why, 'ИС-35') && has(per.why, 'занижает'),
    `удельная величина отбита и разложена на пару: «${per.why}»`);

  /* И занижение это не гипотеза: кураторов в мире трое, а в срезе мер их видно
     двое — у третьего мер нет, и в срез он не попадает ВОВСЕ. Знаменатель,
     снятый со среза, систематически меньше настоящего. */
  const curSlice = ST.statSlice({obj:'obj-measure', dims:['d-curator'], inds:['a-count'], date: D});
  const curAll = new Set();
  Object.keys(W).forEach(o => W[o].forEach(x => (x.h.curator || []).forEach(([d, v]) => {
    if (d <= D) curAll.add(v); })));
  ok(98, curSlice.ok && curSlice.groups.length === 2 && curAll.size === 3,
    `знаменатель со среза занижен систематически: кураторов в мире ${curAll.size}, а в срезе мер видно ${curSlice.groups.length} — у третьего мер нет, и «в среднем на куратора» со среза завысило бы нагрузку в полтора раза (ИС-35)`);

  /* СС-Д9 закрыт ПО ПОСТРОЕНИЮ, а не подгонкой чисел: «погашено всего» больше не
     самостоятельный ряд, а сумма платежей своего кредита. Сверка идёт по каждому
     договору в ЕГО валюте — без пересчёта в сом, потому что курс на две даты разный. */
  const A = '2026-06-30', B = '2026-08-18';
  const rowsAt = d => ST.statRows({obj:'obj-credit', date: d}).rows;
  const ca = rowsAt(A), cb = rowsAt(B);
  const bad = cb.filter(r => {
    const a0 = ca.find(x => x.ref === r.ref);
    const delta = Math.round(((r.inds['m-repaid'].v||0) - ((a0 && a0.inds['m-repaid'].v)||0))*100)/100;
    const pays = Math.round(W['obj-repay'].filter(p => p.f.credit === r.ref &&
      p.f.rdate > A && p.f.rdate <= B).reduce((n, p) => n + p.f.amount, 0)*100)/100;
    return Math.abs(delta - pays) > 0.005;
  });
  const orphan = W['obj-repay'].filter(p => !W['obj-credit'].some(c => c.id === p.f.credit));
  ok(99, bad.length === 0 && orphan.length === 0 && cb.length === 8,
    `СС-Д9 закрыт по построению: на всех ${cb.length} договорах приращение «погашено» за 30.06→18.08 равно сумме платежей ЭТОГО договора до копейки (расхождений ${bad.length}), и ни один платёж не висит без кредита (${orphan.length}) — два ряда одних денег стали одним (ИС-1, ИС-14)`);
})();

/* ---------- W. Волна 11: наборы фильтра, ДНФ без скобок (ADR-0180) ----------
   Закрывает СС-Д8: до неё фильтр был одноусловным — один разрез, одно значение.
   Проверяется не разметка редактора, а СЧЁТ: сколько строк остаётся, какой отказ
   выдаётся и что печатает паспорт. ------------------------------------------- */
(() => {
  ST.seed();
  const D = '2026-08-18';
  const sl = (f, obj) => ST.statSlice({obj: obj || 'obj-credit', dims:[], inds:['a-count'], date: D, filter: f});
  const n  = f => { const r = sl(f); return r.ok ? r.total['a-count'].v : -1; };

  /* Восемь кредитов: KGS — 6, просрочка свыше 100 дней — 4, пересечение — 3. */
  const A = cD('d-cur', '=', {value:'KGS'}), B = cI('m-odays', '>', {value:100});
  const nA = n(F(A)), nB = n(F(B)), nAnd = n(F([A, B])), nOr = n(F(A, B));
  ok(100, nA === 6 && nB === 4 && nAnd === 3 && nOr === 7 && nOr === nA + nB - nAnd,
    `ДНФ считает: набор из двух сравнений через И — ${nAnd} строк(и) из ${nA} и ${nB}; два набора через ИЛИ — ${nOr} = ${nA} + ${nB} − ${nAnd}. Скобок в форме нет, и глубины больше двух не бывает (ADR-0180 §1, СС-Д8)`);

  const opGt   = sl(F(cD('d-cur', '>', {value:'KGS'})));
  const opIn   = sl(F(cI('m-odays', '∈', {values:['0']})));
  const opBool = sl(F(cI('m-bblack', '>', {value:'да'})), 'obj-borrower');
  const opRng  = sl(F(cD('d-industry', 'в диапазоне', {from:'Торговля', to:'Услуги'})));
  ok(101, !opGt.ok && has(opGt.why, '= ≠ ∈ ∉') && has(opGt.why, 'ADR-0180 §4') &&
        !opIn.ok && !opBool.ok && has(opBool.why, 'доступны = ≠') && !opRng.ok,
    `оператор — от ТИПА значения, а не от вкуса: у перечисления «>» нет («${opGt.why.slice(0, 96)}…»), у числа нет «∈», у булева только «= ≠», «в диапазоне» — только у корзины (ADR-0180 §4)`);

  const byInd = sl(F(cI('m-odays', '>', {value:100})));
  const agg   = sl(F(cI('a-count', '>', {value:1})));
  const alien = sl(F(cI('m-odays', '>', {value:1})), 'obj-borrower');
  const bl    = sl(F(cI('m-bblack', '=', {value:'да'})), 'obj-borrower');
  const nbl   = sl(F(cI('m-bblack', '=', {value:'нет'})), 'obj-borrower');
  ok(102, byInd.ok && byInd.total['a-count'].v === 4 && !agg.ok && has(agg.why, 'мера СТРОКИ') &&
        !alien.ok && bl.ok && bl.total['a-count'].v === 1 && nbl.ok && nbl.total['a-count'].v === 7,
    `операнд — разрез ИЛИ мера строки: по «Дней просрочки > 100» осталось ${byInd.total['a-count'].v}, по булеву «В чёрном списке» — ${bl.total['a-count'].v} из ${bl.total['a-count'].v + nbl.total['a-count'].v} заёмщиков. Агрегат в фильтр не пускается: «${agg.why.slice(0, 72)}…» (ADR-0180 §3)`);

  const noCur = sl(F(cI('m-debt', '>', {value:100000})));
  const kgs   = sl(F(cI('m-debt', '>', {value:100000, cur:'KGS'})));
  const usd   = sl(F(cI('m-debt', '>', {value:100000, cur:'USD'})));
  ok(103, !noCur.ok && has(noCur.why, 'ADR-0184 §3') && kgs.ok && kgs.total['a-count'].v === 5 &&
        usd.ok && usd.total['a-count'].v === 1,
    `денежная константа НЕСЁТ валюту и сравнивается с частью той же валюты, без пересчёта: «> 100 000 сом» ловит ${kgs.total['a-count'].v} кредитов и НЕ ловит долларовый на 143 046,67 USD, «> 100 000 USD» ловит его одного. Без валюты — отказ: «${noCur.why.slice(0, 64)}…» (ADR-0184 §3)`);

  const empty  = sl({sets:[{cmps:[]}]});
  const noVals = sl(F(cD('d-cur', '∈', {values:[]})));
  const whole  = sl(F(cD('d-cur', '∈', {values:['KGS','USD','EUR']})));
  const part   = sl(F(cD('d-cur', '∈', {values:['KGS','USD']})));
  ok(104, !empty.ok && has(empty.why, 'набор 1 пуст') && !noVals.ok && has(noVals.why, 'пустым списком') &&
        !whole.ok && has(whole.why, 'весь домен') && part.ok && part.total['a-count'].v === 7,
    `три отказа §8 — все про сравнение, которое ничего не значит: пустой набор, «∈» с пустым списком и «∈» во весь домен («${whole.why.slice(0, 84)}…»); часть домена проходит и оставляет ${part.total['a-count'].v} из 8 (ADR-0180 §8)`);

  const two  = F([A, B], cD('d-region', '=', {value:'Чуйская'}));
  const pf   = sl(two).passport.filter;
  const bare = sl(null).passport.filter;
  ok(105, has(pf, 'набор 1') && has(pf, 'набор 2') && has(pf, 'либо') &&
        has(pf, 'Валюта договора = KGS и Дней просрочки > 100') && has(pf, 'Территория = Чуйская') &&
        !/\+\d|фильтр задан/i.test(pf) && has(bare, 'фильтра нет'),
    `паспорт печатает фильтр ЦЕЛИКОМ, всеми наборами и сравнениями: «${pf}»; пустой назван строкой: «${bare}». «Фильтр задан» и «+2 условия» — ответ без вопроса (ADR-0180 §6)`);

  const year = sl(F(cD('d-cdate', '∈', {values:['2025','2026'], bucket:'год'})));
  const qrt  = sl(F(cD('d-cdate', 'в диапазоне', {from:'2025 · I кв.', to:'2025 · III кв.', bucket:'квартал'})));
  const step = sl(F(cD('d-odays', 'в диапазоне', {from:'91–180 дн.', to:'181+ дн.', bucket:'ступени'})));
  const mon  = ST.operandValues('dim', 'd-cdate', 'месяц');
  ok(106, year.ok && year.total['a-count'].v === 4 && qrt.ok && qrt.total['a-count'].v === 3 &&
        step.ok && step.total['a-count'].v === 4 && has(qrt.passport.filter, '(квартал)') &&
        mon[0] === 'сентябрь 2021' && mon[mon.length - 1] === 'февраль 2026',
    `у разреза с корзинами правая часть — КОРЗИНА, а не сырая дата: год ∈ {2025, 2026} — ${year.total['a-count'].v}, квартал в диапазоне I…III кв. 2025 — ${qrt.total['a-count'].v}, ступени 91–180…181+ — ${step.total['a-count'].v}; корзина названа в паспорте, а список идёт порядком корзины, не алфавитом (${mon[0]} … ${mon[mon.length - 1]}) — ADR-0176 §3, ADR-0180 §4`);

  const bare14 = ST.statRows({obj:'obj-repay', date: D});
  const cut12  = ST.statRows({obj:'obj-repay', date: D,
    filter: F(cD('d-repkind', '∈', {values:['плановое','досрочное']}))});
  ST.state.role = 'Аналитик';
  const seen  = ST.operandValues('dim', 'd-curator');
  const мой   = sl(F(cD('d-curator', '∈', {values:['Бекова Н.']})));
  ST.state.role = 'Администратор статистики';
  const wide  = sl(F(cD('d-curator', '∈', {values:['Бекова Н.']})));
  ok(107, !bare14.ok && bare14.n === 14 && cut12.ok && cut12.rows.length === 12 &&
        seen.length === 1 && !мой.ok && has(мой.why, 'весь домен') &&
        wide.ok && wide.total['a-count'].v === 5,
    `порядок роль → фильтр → группировка → порог держится с обоих концов: фильтр снимает отказ порога (${bare14.n} строк погашений против порога ${ST.rowsLimit} → ${cut12.ok ? cut12.rows.length : '—'} после отбора), а «весь домен» меряется по УЖЕ урезанному ролью множеству — у аналитика кураторов видно ${seen.length}, и то же сравнение у него отказ, а у администратора оставляет ${wide.ok ? wide.total['a-count'].v : '—'} (ИС-13, ADR-0178 §3, ADR-0180 §7)`);

  const f    = F([A, B]);
  const rows = ST.statRows({obj:'obj-credit', date: D, filter: f});
  const reg  = ST.registryList('obj-credit', D, f);
  const job  = ST.exportJob({obj:'obj-repay', date: D,
    filter: F(cD('d-repkind', '∈', {values:['плановое','досрочное']}))});
  const live = {sets:[{cmps:[cD('d-cur', '=', {value:'KGS'})]}]};
  const job2 = ST.exportJob({obj:'obj-credit', date: D, filter: live});
  live.sets[0].cmps.push(B);
  ok(108, rows.ok && reg.join(' ') === rows.rows.map(r => r.ref).sort().join(' ') && reg.length === 3 &&
        job.ok && job.job.n === 12 && has(job.job.passport.filter, 'Вид погашения ∈ плановое, досрочное') &&
        job2.ok && job2.job.filter.sets[0].cmps.length === 1,
    `тот же фильтр даёт тот же состав в реестре ВЛАДЕЛЬЦА (${reg.join(' ')}) — сравнение одно, источника два (ИС-14, ИС-18); в задание выгрузки фильтр едет копией (${job.job.n} строк), и правка вопроса задним числом его не меняет`);

  const kgsF   = F(cD('d-cur', '=', {value:'KGS'}));
  const ser    = ST.statSeries({obj:'obj-credit', inds:'a-count',
    dates:['2026-07-31','2026-08-10','2026-08-18'], filter: kgsF});
  const fl     = ST.flowBetween({obj:'obj-credit', inds:'m-repaid', from:'2026-07-15', to:'2026-08-18', filter: kgsF});
  const serBad = ST.statSeries({obj:'obj-credit', inds:'a-count', dates:['2026-07-31','2026-08-18'],
    filter: F(cD('d-cur', '∈', {values:['KGS','USD','EUR']}))});
  ok(109, ser.ok && ser.points.every(p => p.value.v === 6) && has(ser.passport.filter, 'Валюта договора = KGS') &&
        fl.ok && Math.round(fl.value) === 825500 && has(fl.passport.filter, 'Валюта договора = KGS') &&
        !serBad.ok && has(serBad.why, 'весь домен'),
    `фильтр ОДИН на все швы: срез, ряд (${ser.points.map(p => p.value.v).join(' · ')}), строки, период (${Math.round(fl.value)} сом.) и реестр читают его одинаково и печатают в паспорт; отказ ряду выдаётся один на ряд, а не по точке (ADR-0180 §7)`);
})();

/* ---------- W2. Редактор наборов: форма собирает то же, что считает ядро ----------
   Выше проверялся СЧЁТ по готовому фильтру; здесь — что этот фильтр вообще можно НАБРАТЬ
   формой, что отказ доходит до человека текстом, а не пустотой, и что снятие идёт по
   одному сравнению, а не всё сразу. ------------------------------------------------- */
(() => {
  const el = () => ({ innerHTML:'', textContent:'', dataset:{},
    classList:{toggle(){}, add(){}, remove(){}}, appendChild(){}, remove(){} });
  const fields = {};
  const put = (id, v, sel) => { fields[id] = { value: v, selectedOptions: (sel || []).map(x => ({value:x})) }; };
  const nodes = {'#panel': el(), '#title': el(), '#foot': el(), '#asOf': el(), '#role': el()};
  const toasts = [];
  const wrap = Object.assign(el(), { appendChild(t){ toasts.push(t.textContent); } });
  sandbox.document = {
    querySelector: k => nodes[k] || fields[k.slice(1)] || el(),
    querySelectorAll: () => [],
    getElementById: id => (id === 'toastWrap' ? wrap : null),
    createElement: () => el()
  };
  const panel = () => nodes['#panel'].innerHTML;
  /* dropCmp правит фильтр НА МЕСТЕ, поэтому форма снимается сразу, а не ссылкой. */
  const shape = () => { const f = ST.state.q.filter;
    return f ? f.sets.map(x => x.cmps.length) : null; };

  ST.seed();
  ST.state.q.obj = 'obj-credit'; ST.state.q.date = '2026-08-18';
  ST.go('build');

  /* Первое сравнение — новым набором. */
  put('fOperand', 'dim:d-cur'); put('fOp', '='); put('fVal', 'KGS'); put('fSet', 'new');
  ST.addCmp();
  const one = shape();

  /* Второе — В ТОТ ЖЕ набор (И). */
  put('fOperand', 'ind:m-odays'); put('fOp', '>'); put('fNum', '100'); put('fSet', '0');
  ST.addCmp();
  const and2 = shape();

  /* Третье — новым набором (ИЛИ). */
  put('fOperand', 'dim:d-region'); put('fOp', '='); put('fVal', 'Чуйская'); put('fSet', 'new');
  ST.addCmp();
  const or2 = shape();
  const built = panel();

  /* Отказ должен ДОЙТИ ДО ЧЕЛОВЕКА текстом и НЕ ТРОНУТЬ уже набранное. */
  const before = JSON.stringify(ST.state.q.filter);
  toasts.length = 0;
  put('fOperand', 'dim:d-cur'); put('fOp', '∈'); put('fVals', '', ['KGS','USD','EUR']); put('fSet', 'new');
  ST.addCmp();
  const refused = toasts.join(' | ');
  const after = JSON.stringify(ST.state.q.filter);

  /* Снятие — по ОДНОМУ сравнению; опустевший набор уходит сам. */
  ST.dropCmp(1, 0);
  const dropped = shape();
  ST.clearFilter();
  const cleared = ST.state.q.filter;
  const bare = panel();

  ok(110, String(one) === '1' && String(and2) === '2' && String(or2) === '2,1' &&
        has(built, 'либо набор 2') && has(built, 'Валюта договора = KGS') &&
        /* «&gt;» — оператор в чипе экранирован: подпись рисуется текстом, не разметкой. */
        has(built, 'Дней просрочки &gt; 100') && has(built, 'Территория = Чуйская') &&
        has(built, 'в набор 1 (И)') && has(built, 'новым набором (ИЛИ)') &&
        has(refused, 'весь домен') && after === before &&
        String(dropped) === '2' && cleared === null && !has(bare, 'либо набор'),
    `редактор набирает ровно ту форму, которую считает ядро: три клика дали «${or2.length} набора, сравнений в них ${or2.join(' и ')}», и добавление спрашивает одно — «в набор 1 (И)» или «новым набором (ИЛИ)». Отказ ДОХОДИТ ТЕКСТОМ и не трогает набранное: «${refused.slice(0, 72)}…» — пустой экран вместо ответа отказом не считается. Снятие идёт по одному сравнению, опустевший набор уходит сам (ADR-0180 §1, §6, §8)`);
})();

/* ---------- X. Волна 11 ч.2: погашение — платёж и поступление (ADR-0183) ----------
   Погашение было самым тонким объектом реестра: два показателя на 14 записей. Правило
   ADR-0183 развело его на ДВА объекта, а не дописало мер: «сумма поступления», «возврат»
   и «нераспределённый остаток» — величины про МНОЖЕСТВО платежей, а не про платёж, и на
   сводном поступлении сложились бы дважды (ИС-28, ИС-21, ADR-0198). Проверяется не состав
   списком, а СЧЁТ: сходятся ли тождества ТЗ 14 на строке среза. ------------------- */
(() => {
  ST.seed();
  const st = ST.state;
  const D = '2026-08-18';
  const W = vm.runInContext('WORLD', sandbox);
  const rowsOf = o => st.rows.filter(r => r.obj === o && r.date === D);
  const v = (r, i) => (r.inds[i] ? r.inds[i].v : null);
  const r2 = x => Math.round(x * 100) / 100;
  const near = (a, b) => Math.abs(a - b) < 0.005;
  const at = (rr, ref) => rr.find(r => r.ref === ref);
  const rowInds = o => o.inds.map(ST.IND).filter(i => i.src !== 'агрегат');
  const pays = rowsOf('obj-repay'), rcs = rowsOf('obj-receipt');
  const P = ST.OBJ('obj-repay'), R = ST.OBJ('obj-receipt');
  /* Порядок статей — ADR-0087: расходы → комиссия → ОД → проценты → пеня. */
  const ART = ['m-palc','m-palf','m-palp','m-pali','m-paln'];

  const bad111 = pays.filter(r => !near(v(r,'m-ramount'), r2(ART.reduce((n, i) => n + v(r, i), 0))));
  const seam = rowInds(P).filter(i => i.src === 'шов');
  const compound = seam.filter(i => /_/.test(i.field || ''));
  const one = at(pays, 'ПГ-2026/1156');
  ok(111, pays.length === 14 && bad111.length === 0 && seam.length === 7 && compound.length === 0,
    `сумма платежа = Σ пяти статей на каждой из ${pays.length} строк, расхождений ${bad111.length}: ПГ-2026/1156 — ${ART.map(i => v(one, i)).join(' + ')} = ${v(one,'m-ramount')} (расходы → комиссия → ОД → проценты → пеня, ADR-0087). ОД своей формулы не имеет, он РАЗНОСТЬ; статьи и слои — две проекции одной суммы, ${seam.length} именованных клеток шва (5+2), а не 5×2 матрица, составных имён ${compound.length} (ADR-0183 §2, §3, ADR-0179 §3)`);

  const bad112 = pays.filter(r => !near(v(r,'m-ramount'), r2(v(r,'m-pjud') + v(r,'m-pfree'))));
  const two = at(pays, 'ПГ-2026/1178');
  const kgs = ST.statSlice({obj:'obj-repay', dims:['d-repkind'], date: D,
    inds:['a-sumpjud','a-sumpfree','a-sumramount'], filter: F(cD('d-cur','=',{value:'KGS'}))});
  const T = kgs.ok ? kgs.total : {};
  ok(112, bad112.length === 0 && v(two,'m-pjud') > 0 && v(two,'m-pfree') > 0 && kgs.ok &&
       near(r2(T['a-sumpjud'].v + T['a-sumpfree'].v), T['a-sumramount'].v),
    `тот же платёж разложен по СЛОЯМ, и слои сходятся к той же сумме, расхождений ${bad112.length}: ПГ-2026/1178 — ${v(two,'m-pjud')} судебный + ${v(two,'m-pfree')} свободный = ${v(two,'m-ramount')}, один платёж на двух слоях сразу (ADR-0043). Свод по KGS: ${T['a-sumpjud'].v} + ${T['a-sumpfree'].v} = ${T['a-sumramount'].v} — «Взыскано» так и осталось свёрткой платежей по слою, мерой оно не хранится (ADR-0030)`);

  const bad113 = rcs.filter(r => !near(v(r,'m-rsum'), r2(v(r,'m-rpaid') + v(r,'m-rret') + v(r,'m-runal'))));
  const pl = at(rcs, 'ПП-2026/0701'), ov = at(rcs, 'ПП-2026/0851');
  ok(113, rcs.length === 15 && bad113.length === 0 &&
       v(pl,'m-rret') === 180000 && v(pl,'m-rpaid') === 520000 && v(ov,'m-runal') === 4000,
    `инвариант поступления держится на каждой из ${rcs.length} строк, расхождений ${bad113.length}: сумма = Σ платежей + возврат + нераспределённое (ТЗ 14 §2.2). ПП-2026/0701 — ${v(pl,'m-rsum')} = ${v(pl,'m-rpaid')} + ${v(pl,'m-rret')} + ${v(pl,'m-runal')}: доля залогодателя ушла плательщику и погашением НЕ стала (§7.3). ПП-2026/0851 — переплата ${v(ov,'m-runal')} лежит нераспределённым остатком, а не лишним погашением (ADR-0073). Остаток — разность, отдельной формулы у него нет (ИС-1)`);

  const sv = at(rcs, 'ПП-2026/0733');
  const kids = pays.filter(r => r.dims['d-preceipt'] === 'ПП-2026/0733');
  const creds = [...new Set(kids.map(r => r.dims['d-pcredit']))];
  const brs = [...new Set(kids.map(r => String(r.dims['d-branch'])))];
  const borrowed = R.dims.filter(d => ['d-branch','d-curator','d-region','d-pcredit','d-cur'].indexOf(d) >= 0);
  ok(114, v(sv,'m-rpays') === 2 && kids.length === 2 && creds.length === 2 && brs.length === 2 &&
       borrowed.length === 0,
    `сводное поступление — не платёж: ПП-2026/0733 разнесено на ${v(sv,'m-rpays')} платежа по ${creds.length} разным кредитам (${creds.join(', ')}) в ${brs.length} подразделениях. Поэтому у поступления НЕТ разрезов, которые приходят от кредита — ни «Кредит», ни «Подразделение», ни «Куратор», ни «Территория» (их ${borrowed.length}): значение, оказавшееся многозначным, поднимает уровень, а не сплющивается в клетку (ИС-21, ADR-0198)`);

  const unres = ST.statRows({obj:'obj-receipt', date: D, filter: F(cI('m-rpays','=',{value:0}))});
  const refs = unres.ok ? unres.rows.map(r => r.ref).sort() : [];
  const boolDim = R.dims.map(ST.DIM).filter(d => /невыясн|опозн|разнес/i.test(d.name));
  ok(115, unres.ok && refs.length === 2 && refs.join(' ') === 'ПП-2026/0755 ПП-2026/0844' &&
       boolDim.length === 0 && has(unres.passport.filter, 'Платежей из поступления = 0'),
    `«невыясненное» — это ФИЛЬТР, а не разрез: ${refs.length} поступления (${refs.join(', ')}) отобраны сравнением по МЕРЕ СТРОКИ — операнд из ADR-0180 §2, а не из справочника. Второй записи реестра про то же значение нет (булевых разрезов про разнесение ${boolDim.length}, ADR-0185 §1), и сужение названо в паспорте: «${unres.passport.filter}»`);

  const fz = at(rcs, 'ПП-2026/0844');
  const track = st.rows.filter(r => r.ref === 'ПП-2026/0620').map(r => r.dims['d-rmatch']);
  const seq = track.filter((x, i) => x !== track[i - 1]);
  const hist = ['d-rmatch','d-rfrz'].map(ST.DIM).filter(d => d.src === 'история');
  ok(116, fz.dims['d-rmatch'] === 'расхождение' && fz.dims['d-rfrz'] === 'заморожено' &&
       hist.length === 2 && seq.join(' → ') === 'отозвано → восстановлено',
    `три оси ТЗ 14 §3.1 не схлопнуты в один «статус»: ПП-2026/0844 одновременно «${fz.dims['d-rmatch']}» по сопоставлению и «${fz.dims['d-rfrz']}» по заморозке — одним полем это не выразить. Обе оси читаются ИЗ ИСТОРИИ (их ${hist.length}), а не из поля: сопоставление ПП-2026/0620 идёт «${seq.join(' → ')}» и на каждую дату среза отдаёт своё значение (ИС-10, ИС-14)`);

  const role0 = st.role;
  ST.setRole('Аналитик');
  const aR = ST.statRows({obj:'obj-receipt', date: D});
  const aP = ST.statRows({obj:'obj-repay', date: D});
  ST.setRole(role0);
  ok(117, !aR.ok && has(aR.why, 'не спрашивается') && has(aR.why, 'многозначен') &&
       has(aR.why, 'Платёж') && aP.ok && aP.rows.length === 9,
    `СС-Д11 ЗАКРЫТ (волна 15): поступление отвечает ОТКАЗОМ с дорогой, а не пустым экраном — «${String(aR.why).slice(0, 96)}…». Куратор у сводного поступления на дату многозначен (см. #114), и объявленный охват объекта — «отказ», а не «режется d-curator»: показать 15 строк целиком нельзя (§9: объём чужой работы не выдаётся даже итогом), показать 0 — соврать. Дорога настоящая и уровнем ниже: платежей аналитику видно ${aP.rows.length} (ИС-37, ADR-0203)`);

  const byId = {}; (W['obj-receipt'] || []).forEach(r => byId[r.id] = r);
  const kin = W['obj-repay'] || [];
  const drift = kin.filter(p => !byId[p.f.receipt] || byId[p.f.receipt].f.rdate !== p.f.rdate);
  const noPay = (W['obj-receipt'] || []).filter(r => !kin.some(p => p.f.receipt === r.id));
  /* Волна 17: закрытые месяцы читаются из ОБЩЕГО календаря (ИС-38) — своего списка у
     статистики больше нет. Утверждение сторожа то же: невыясненное лежит в открытых. */
  const closedM = ST.closedMonths();
  const openM = noPay.every(r => closedM.indexOf(r.f.rdate.slice(0, 7)) < 0);
  ok(118, drift.length === 0 && noPay.length === 2 && openM && closedM.length === 2,
    `дата платежа НАСЛЕДУЕТСЯ от поступления, своей у него нет (ТЗ 14 §2.1): на ${kin.length} платежей расхождений и висячих ссылок ${drift.length} — рождение платежа приходит из родителя, а опознание рождает платёж, а не правит поле (§7.1, ИС-33, ADR-0197). Оба невыясненных (${noPay.map(r => r.id).join(', ')}) лежат в ОТКРЫТЫХ месяцах, закрыты ${closedM.join(', ')}: невыясненное не даёт закрыть период (§8.6, ADR-0075)`);

  const iPay = rowInds(P).length, aPay = P.inds.length - iPay;
  const iRc = rowInds(R).length, aRc = R.inds.length - iRc;
  const badAgg = st.indicators.filter(i => i.src === 'агрегат' && i.over &&
    ['перечисление','булево'].indexOf((ST.IND(i.over) || {}).type) >= 0);
  ok(119, P.dims.length === 8 && iPay === 8 && aPay === 9 &&
       R.dims.length === 5 && iRc === 6 && aRc === 8 && badAgg.length === 0,
    `состав по ADR-0183 — без недобора и без набора впрок: платёж — ${P.dims.length} разрезов, ${iPay} мер строки, ${aPay} агрегатов; поступление — ${R.dims.length} / ${iRc} / ${aRc}. Каждый разрез назван внешним потребителем: ФО-41 «Реестр погашений» — кредит, ФО-04 «Погашения за период» — дата, ТЗ 14 §3.1 — три оси, и они стоят у ПОСТУПЛЕНИЯ: своих осей платёж не имеет, он их наследует (ADR-0056). Агрегатов над перечислением и булевым ${badAgg.length} (ИС-29, ADR-0185 §1)`);

  const cur = ['KGS','USD','EUR'].map(c => {
    const rr = ST.statSlice({obj:'obj-receipt', dims:['d-rchan'], date: D,
      inds:['a-sumrpaid','a-sumrsum'], filter: F(cD('d-rcur','=',{value:c}))});
    const pp = ST.statSlice({obj:'obj-repay', dims:['d-repkind'], date: D,
      inds:['a-sumramount'], filter: F(cD('d-cur','=',{value:c}))});
    return {c, ok: rr.ok && pp.ok, paid: rr.ok ? rr.total['a-sumrpaid'].v : null,
            got: rr.ok ? rr.total['a-sumrsum'].v : null, pay: pp.ok ? pp.total['a-sumramount'].v : null};
  });
  ok(120, cur.every(x => x.ok && near(x.paid, x.pay)) && cur.some(x => !near(x.got, x.pay)),
    `«поступило» и «погашено» — разные вопросы, а не расхождение: по КАЖДОЙ валюте разнесённое поступлениями = сумме платежей (${cur.map(x => x.c + ' ' + x.paid + ' = ' + x.pay).join(' · ')}), а поступило больше (${cur.map(x => x.c + ' ' + x.got).join(' · ')}) — разницу держат возврат и нераспределённый остаток. Ни одна сумма не сложена дважды (ИС-28), и разновалютное к одному числу молча не сведено (ADR-0184 §3, СС-Д4)`);
})();

/* ---------- Y. Волна 12: три тонких объекта под правилом ADR-0201 ----------
   Тонкий объект — не «маленький», а НЕДОСПРОШЕННЫЙ: реестр обещает величину, которой у
   владельца нет, либо сплющивает в одну клетку то, что владелец различает. Волна 12 взяла
   три последних таких записи и развела их по трём разным ответам: «Задание кураторства»
   СНЯТО (владельца, отдающего множество, не нашлось), у «Кредитной программы» сняты обе
   меры строки (лимита не заводит никто, освоение принадлежит кредиту), «Мера взыскания»
   ДОБРАНА до состава, который различает ТЗ 13. Проверяется не список, а счёт. --------- */
(() => {
  ST.seed();
  const st = ST.state;
  const D = '2026-08-18';
  const W = vm.runInContext('WORLD', sandbox);
  const rowsOf = o => st.rows.filter(r => r.obj === o && r.date === D);
  const v = (r, i) => (r.inds[i] ? r.inds[i].v : null);
  const at = (rr, ref) => rr.find(r => r.ref === ref);
  const rowInds = o => o.inds.map(ST.IND).filter(i => i.src !== 'агрегат');
  const M = ST.OBJ('obj-measure'), PR = ST.OBJ('obj-program');
  const ms = rowsOf('obj-measure');

  /* Снятие объекта — такая же строка реестра, как и заведение (ИС-18): движка оно не
     касается, но след обязано оставить ОТКАЗОМ, а не пустотой (ИС-24). */
  const gone = ST.statSlice({obj:'obj-task', dims:['d-branch'], inds:['a-count'], date: D});
  const inWorld = Object.keys(W).indexOf('obj-task') >= 0;
  const dangling = [];
  st.objects.forEach(o => {
    o.dims.forEach(d => { if (!ST.DIM(d)) dangling.push(o.id + '/' + d); });
    o.inds.forEach(i => { if (!ST.IND(i)) dangling.push(o.id + '/' + i); });
  });
  const orphan = st.indicators.filter(i => i.src === 'агрегат' && i.fn !== 'count' && !ST.IND(i.over));
  ok(121, st.objects.length === 10 && !gone.ok && has(gone.why, 'нет в реестре объектов') &&
        has(gone.why, 'ИС-18') && !inWorld && dangling.length === 0 && orphan.length === 0,
    `«Задание кураторства» снято СТРОКОЙ реестра, а не релизом: объектов ${st.objects.length}, спрос отвечает отказом — «${gone.why}», а не пустым экраном (ИС-24). Источник снят, а не спрятан: записей в мире 0, висячих ссылок на снятые разрезы и меры ${dangling.length}, агрегатов над несуществующей мерой ${orphan.length}. Владельца, ОТДАЮЩЕГО множество, у заданий нет: кураторство отказывается от них дословно (ТЗ 16 §1.1), своего ТЗ и места в очереди у них нет, ФО-20 ещё спрашивается у заказчика. Вернётся строкой в день, когда владелец появится (ADR-0201 §1)`);

  /* Три оси результата ТЗ 13 §9.1 — независимы попарно и в обе стороны: ни одна не
     выводится из другой, иначе разрезов было бы не три, а один. */
  const AX = ['d-mresult','d-mrkind','d-mstage'];
  const dep = [];
  AX.forEach(a => AX.forEach(b => { if (a !== b &&
    !ms.some(x => ms.some(y => x !== y && x.dims[a] === y.dims[a] && x.dims[b] !== y.dims[b]))) dep.push(a + '→' + b); }));
  const hist = ['d-mdeliv','d-mstate'].filter(d => ST.DIM(d).src === 'история');
  const il = at(ms, 'МВ-2025/44'), rz = at(ms, 'МВ-2026/31');
  ok(122, dep.length === 0 && hist.length === 2 &&
        il.dims['d-mrkind'] === rz.dims['d-mrkind'] &&
        il.dims['d-mresult'] !== rz.dims['d-mresult'] && il.dims['d-mstage'] !== rz.dims['d-mstage'],
    `три оси ТЗ 13 §9.1 не схлопнуты в один «результат»: пар, где одна ось вывелась бы из другой, ${dep.length} из 6 — МВ-2025/44 и МВ-2026/31 стоят на одном виде результата «${il.dims['d-mrkind']}» при разных результате (${il.dims['d-mresult']} · ${rz.dims['d-mresult']}) и стадии (${il.dims['d-mstage']} · ${rz.dims['d-mstage']}). Доставка и состояние читаются ИЗ ИСТОРИИ (их ${hist.length}), а не полем: на каждую дату среза своё значение (ИС-10, ИС-14)`);

  /* Часы меры. Число дней полем не лежит нигде — оно ПРОИЗВОДНО от даты среза (ADR-0183 §4),
     и заводятся часы от НАПРАВЛЕНИЯ: невручение срок должника не отменяет (ТЗ 13 §9.2). */
  const days = ST.statSlice({obj:'obj-measure', dims:['d-mdeliv'], date: D,
    inds:['a-count','a-maxmdays','a-avgmdays']});
  const withSent = ms.filter(r => v(r, 'm-mdays') != null);
  const nod = days.ok ? days.groups.find(g => g.parts[0] === 'вручения не требует') : null;
  const und = at(ms, 'МВ-2026/27'), del = at(ms, 'МВ-2026/12');
  ok(123, days.ok && withSent.length === 2 && v(und, 'm-mdays') === 16 && v(del, 'm-mdays') === 159 &&
        und.dims['d-mdeliv'] === 'направлено, вручение не подтверждено' &&
        nod && nod.n === 3 && nod.values['a-maxmdays'] === null && nod.values['a-avgmdays'] === null &&
        days.total['a-maxmdays'].v === 159 && days.total['a-avgmdays'].v === 87.5,
    `срок течёт от НАПРАВЛЕНИЯ и невручением не отменяется (ТЗ 13 §9.2): у МВ-2026/27 на 18.08 — ${v(und, 'm-mdays')} дн. при «${und.dims['d-mdeliv']}», у вручённой МВ-2026/12 — ${v(del, 'm-mdays')} дн. У видов, которым вручать нечего, направления нет, и срока нет вовсе: мер со сроком ${withSent.length} из ${ms.length}, а в группе «вручения не требует» (${nod ? nod.n : '—'} меры) максимум и среднее — ПРОЧЕРК, а не ноль: выбор из пустого нулём не отвечают (ИС-19, СС-Д13 закрыт). Итог берёт тех, у кого срок есть: max ${days.total['a-maxmdays'].v} · avg ${days.total['a-avgmdays'].v} дн.`);

  /* Дедуп по кредиту (ТЗ 13 §12.1): один долг в итоге считается один раз, сколько бы мер
     на него ни завели. Сторно (И-3) со среза меру не убирает — её отсекает СУЖЕНИЕ. */
  const naive = ms.reduce((n, r) => n + v(r, 'm-mclaim'), 0);
  const all = ST.statSlice({obj:'obj-measure', dims:['d-mkind'], inds:['a-count','a-summclaim'], date: D});
  const reg = ST.statSlice({obj:'obj-measure', dims:['d-mkind'], inds:['a-count','a-summclaim'], date: D,
    filter: F(cD('d-mstate', '=', {value:'зарегистрирована'}))});
  const A = all.ok ? all.total['a-summclaim'] : {}, R = reg.ok ? reg.total['a-summclaim'] : {};
  const swing = A.v - R.v;
  ok(124, all.ok && reg.ok && naive === 8392000 && A.v === 7462000 && R.v === 4002000 &&
        A.dedup && A.dedup.by === 'd-mcred' && A.dedup.keys === 3 && A.dedup.dropped === 2 &&
        R.dedup.dropped === 1 && all.total['a-count'].v === 5 && reg.total['a-count'].v === 4 &&
        swing === 3460000,
    `сумма по мере в ИТОГЕ считается один раз на кредит (ТЗ 13 §12.1): ${ms.length} мер несут ${naive}, а итог ${A.v} — ключей ${A.dedup.keys}, снято ${A.dedup.dropped}; строка своей полной суммы при этом не теряет (ИС-34, ADR-0199). Сторнированная мера со среза НЕ исчезает (И-3), её отсекает сужение — и оно не вычитает 3 980 000, а МЕНЯЕТ представителя ключа: ${A.v} → ${R.v}, разница ${swing}. Мер в срезе ${all.total['a-count'].v}, после сужения ${reg.total['a-count'].v}`);

  /* «Освоено по программе» — величина про множество КРЕДИТОВ, разрезанное по программе.
     Полем программы она была бы вторым источником тех же денег (ИС-1, ИС-28). */
  const byProg = ST.statSlice({obj:'obj-credit', dims:['d-program'], inds:['a-count','a-sumissued'], date: D});
  const byBr = ST.statSlice({obj:'obj-credit', dims:['d-branch'], inds:['a-count','a-sumissued'], date: D});
  const cover = byProg.ok ? byProg.groups.reduce((n, g) => n + g.n, 0) : -1;
  const pf = Object.keys(W['obj-program'][0].f);
  const may = vm.runInContext('CONSUMERS', sandbox).find(c => c.module === 'программы');
  ok(125, byProg.ok && byBr.ok && byProg.groups.length === 5 && byProg.n === 8 && cover === 8 &&
        byProg.total['a-sumissued'].v === byBr.total['a-sumissued'].v &&
        pf.indexOf('limit') < 0 && pf.indexOf('issued') < 0 &&
        may && may.may.length === 1 && may.may[0] === 'statSlice',
    `«выдано по программе» собирается СРЕЗОМ КРЕДИТА по разрезу «Кредитная программа», а не полем программы (ADR-0201 §2): ${byProg.groups.length} групп на ${byProg.n} кредитов, ни один не потерян и не сосчитан дважды (${cover} из ${byProg.n}), а итог тот же, что по подразделениям (${byProg.total['a-sumissued'].v} = ${byBr.total['a-sumissued'].v}) — множество одно, вопроса два (ИС-28). Полей лимита и освоения у программы больше нет: лимита не заводит ни один владелец, знаменателя у «освоено N %» пока нет вовсе, и это ЗАЯВКА владельцу, а не выдуманное поле (ADR-0150 §3, ИС-1). Программа спрашивает статистику о кредитах: может ${may.may.join(', ')}`);

  /* Границы ADR-0183: правило запрещает и недобор, и набор впрок — но не малый состав.
     Объект без единой меры строки законен, если строки у него есть и их есть о чём считать. */
  const iM = rowInds(M).length, aM = M.inds.length - iM;
  const iP = rowInds(PR).length, aP = PR.inds.length - iP;
  const prRows = ST.statRows({obj:'obj-program', date: D});
  const bare = prRows.rows.every(r => r.ref && Object.keys(r.inds).length === 0);
  const cnt = ST.statSlice({obj:'obj-program', dims:['d-pstate'], inds:['a-count'], date: D});
  ok(126, PR.dims.length === 9 && iP === 0 && aP === 1 && prRows.rows.length === 5 && bare &&
        cnt.ok && cnt.total['a-count'].v === 5 && PR.dims.indexOf('d-curator') < 0 &&
        M.dims.length === 10 && iM === 2 && aM === 4,
    `состав по ADR-0183 «Границы»: программа — ${PR.dims.length} разрезов, ${iP} мер строки, ${aP} агрегат; мера взыскания — ${M.dims.length} / ${iM} / ${aM}. Объект БЕЗ ЕДИНОЙ меры строки законен: строк ${prRows.rows.length}, у каждой ref и разрезы, и «сколько программ» считается по СТРОКАМ (${cnt.total['a-count'].v}), а не по мере. Разреза «Куратор» у программы нет и быть не может: «ответственные сотрудники» — поле lookup (multi), многозначное на дату, и многозначность поднимает уровень, а не сплющивается в клетку (ИС-21, ADR-0201 §4)`);

  /* Идентификатор записи реестра — ИМЯ, а не подпись: двух записей под одним именем не
     бывает. Форма заведения занятый идентификатор отбивает (проверка #46), но саму
     ЗАГРУЗКУ реестра до волны 12 не сторожил никто — и волна завела «Дату начала действия
     программы» под уже занятым «d-pdate»: поиск отдавал первую запись, «Дата платежа»
     становилась недостижимой, а срез платежей по дате молча спрашивал корзину чужого
     разреза. Это СС-Д14: реестр обязан быть непротиворечив на входе, иначе всякий ответ
     под вопросом (ИС-18, ИС-24, ADR-0176 §7). */
  const dimsAll = vm.runInContext('DIMS', sandbox);
  const dup = arr => {
    const seen = {}, out = [];
    arr.forEach(id => { seen[id] = (seen[id] || 0) + 1; if (seen[id] === 2) out.push(id); });
    return out;
  };
  const dD = dup(dimsAll.map(d => d.id));
  const dI = dup(st.indicators.map(i => i.id));
  const dO = dup(st.objects.map(o => o.id));
  const pay = ST.DIM('d-pdate'), start = ST.DIM('d-pstart');
  const askPay = ST.statSlice({obj:'obj-repay', dims:['d-pdate'], inds:['a-count'], date: D});
  ok(127, dD.length === 0 && dI.length === 0 && dO.length === 0 &&
        pay && pay.name === 'Дата платежа' && pay.key === 'rdate' &&
        start && start.name === 'Дата начала действия программы' && start.key === 'pdate' &&
        !askPay.ok && has(askPay.why, 'Дата платежа') && has(askPay.why, 'месяц'),
    `идентификаторы реестра уникальны на ЗАГРУЗКЕ, а не только в форме заведения (СС-Д14): разрезов ${dimsAll.length}, показателей ${st.indicators.length}, объектов ${st.objects.length}, повторов ноль. Две даты — «${pay.name}» (${pay.key}) и «${start.name}» (${start.key}) — живут врозь, и отказ платежам называет ИХ корзины: «${askPay.why.slice(0, 60)}…» (ИС-18, ADR-0176 §7)`);
})();

/* ---------- Z. Волна 13: у каждой записи реестра есть спрашивающий ---------- */
(() => {
  ST.seed();
  const st = ST.state;
  const dimsAll = vm.runInContext('DIMS', sandbox);
  const usedD = new Set(), usedI = new Set();
  st.objects.forEach(o => { (o.dims || []).forEach(d => usedD.add(d)); (o.inds || []).forEach(i => usedI.add(i)); });
  const orphanD = dimsAll.filter(d => !usedD.has(d.id));
  const orphanI = st.indicators.filter(i => !usedI.has(i.id));
  const zd = ST.DIM('d-zdate');
  const owner = st.objects.filter(o => (o.dims || []).indexOf('d-zdate') >= 0);
  const zo = ST.OBJ('obj-zdeal');
  const ask = ST.statSlice({obj:'obj-zdeal', dims:['d-zdate'], inds:['a-count'],
    date: ASK, buckets:{'d-zdate':'год'}});
  const noBucket = ST.statSlice({obj:'obj-zdeal', dims:['d-zdate'], inds:['a-count'], date: ASK});
  ok(128, orphanD.length === 0 && orphanI.length === 0 &&
        owner.length === 1 && owner[0].id === 'obj-zdeal' &&
        zd.note === 'ТЗ #4' && zo && zo.owner === 'Залог' && zo.born.key === 'zdate' &&
        (zo.inds || []).length === 1 && ask.ok && ask.n === 5 && ask.groups.length === 5 &&
        !noBucket.ok,
    `у каждой записи реестра есть объект, который ею спрашивает: разрезов без объекта ${orphanD.length} из ${dimsAll.length}, показателей без объекта ${orphanI.length} из ${st.indicators.length}. Сирота была одна и молчала с волны 8 — «${zd.name}» (${zd.note}) сняли с предмета залога как многозначную после перезалога (ИС-21) и оставили без владельца множества, а §10.1 считала параметр исполненным. Владелец заведён СТРОКОЙ реестра (ИС-18): «${zo.name}», множество отдаёт ${zo.owner}, рождение — «${zo.born.key}», состав — один разрез и одно число, ни одной меры строки (ADR-0201 §3). Спрос отвечает: договоров ${ask.n} в ${ask.groups.length} годах; без корзины — отказ «${noBucket.why ? noBucket.why.slice(0, 48) : '—'}…» (ADR-0176 §2)`);
})();

/* ---------- Э. Волна 14: спрашивается дата прогона, а не «сегодня» ---------- */
(() => {
  ST.seed();
  const st = ST.state;
  const q = {obj:'obj-credit', dims:['d-branch'], inds:['a-count'], date: TODAY};
  const sl = ST.statSlice(q);
  const rw = ST.statRows({obj:'obj-credit', date: TODAY});
  const sr = ST.statSeries({obj:'obj-credit', inds:'a-sumdebt', dates:['2026-07-31', TODAY]});
  const fl = ST.flowBetween({obj:'obj-credit', inds:'m-repaid', from:'2026-07-15', to: TODAY});
  const shut = [sl, rw, sr, fl];
  /* Отказ обязан называть дверь, а не только запрет: «как сейчас» отвечает реестр
     владельца, и он действительно отвечает — иначе отказ был бы тупиком. */
  const door = ST.registryList('obj-credit', st.today, null);
  const was = ST.resolveAsOf(TODAY);
  ok(129, shut.every(x => x && x.ok === false) &&
        shut.every(x => has(x.why, 'ИС-36') && has(x.why, '20.08.2026')) &&
        has(sl.why, 'Кредиты') && door.length === 8 && was && was.asOf === '2026-08-20',
    `все четыре двери отказывают на «сегодня» одинаково: «${sl.why}». До волны 14 тот же вопрос отвечал ЧИСЛОМ — молча строками от ближайшего прогона (${was.asOf}), и расхождение с завтрашним ответом на тот же вопрос поймать было нечем: оба честны. Отказ называет дверь, и дверь отвечает: в реестре «Кредиты» на сегодня ${door.length}`);

  const ds = ST.askDates('obj-credit');
  const objs = st.objects.map(o => ({o, d: ST.askDates(o.id)}));
  const empty = objs.filter(x => !x.d.length);
  const future = objs.filter(x => x.d.length && x.d[x.d.length - 1] > st.today);
  ok(130, ds.length === 6 && ds.indexOf(TODAY) < 0 && ds[ds.length - 1] === '2026-08-20' &&
        st.q.date === ds[ds.length - 1] && empty.length === 0 && future.length === 0 &&
        !ST.dateGate(ds[ds.length - 1]) && !ST.dateGate('2026-08-19'),
    `спрашиваемые даты — это ЖУРНАЛ ПРОГОНОВ, а не константа файла: ${ds.length} дат у кредита, «сегодня» среди них нет, умолчание вопроса стоит на последней (${st.q.date}). Объектов без единой даты ${empty.length} из ${objs.length}, дат в будущем ${future.length}. Дыра внутри истории воротами НЕ отбивается (19.08 проходит) — её дело ИС-12, а не ИС-36`);

  ST.seed();
  ST.skip(TODAY, 'окно обслуживания СУБД');
  const after = ST.statSlice(q);
  const ran = ST.run(TODAY, {manual:true, reason:'перезапуск после окна обслуживания'});
  const now = ST.statSlice(q);
  ok(131, !after.ok && has(after.why, 'пропуск') && has(after.why, 'окно обслуживания СУБД') &&
        ran.ok && now.ok && now.passport.asOf === TODAY && now.passport.age === 0 &&
        now.passport.substituted === false,
    `«прогона не было» — это событие журнала, и отказ его называет: «${after.why.slice(0, 96)}…». Запрет не на «сегодня» как таковое: тот же вопрос после прогона отвечает на СВОЮ дату (${now.passport.asOf}, возраст ${now.passport.age}, подстановки нет) — спрашивается написанная строка, а не календарь`);
})();

/* ---------- Ю. Волна 15: охват объявлен объектом, а не зашит именем разреза ----------
   СС-Д11 звучал как «объект БЕЗ разреза охвата», и три волны подряд его так и читали.
   Волна 15 замерила и нашла четвёртый случай — противоположного рода: у ЗАЁМЩИКА разрез
   охвата ЕСТЬ, он просто зовётся иначе («d-lcurator»: ведущий куратор ВЫЧИСЛЯЕТСЯ, ТЗ 16
   §11). Зашитое в applyScope имя «d-curator» отдавало аналитику 0 строк из 8 при 3 своих,
   а паспорт печатал «по 0 объектам, доступным вам» — не пустой экран, а НЕВЕРНЫЙ ответ,
   заверенный как верный. Класс дефекта, значит, не «объект без разреза», а «охват прибит
   к имени разреза»: ИС-37, ADR-0203.                                                    */
(() => {
  ST.seed();
  const st = ST.state;
  const role0 = st.role;

  /* #132 — вход: реквизит обязателен у КАЖДОГО объекта, и состояний ровно три. Тот же
     урок, что дал #128 (сирота реестра) и СС-Д14: чинится класс, а не случай. */
  const bad = st.objects.filter(o => {
    const s = o.scope;
    if (!s) return true;
    const kinds = ['dim','open','denied'].filter(k => s[k] != null);
    if (kinds.length !== 1) return true;
    if (s.dim) return !ST.DIM(s.dim) || o.dims.indexOf(s.dim) < 0;
    if (s.denied) return !s.denied.why || !s.denied.road;
    return typeof s.open !== 'string' || !s.open;
  });
  const byKind = k => st.objects.filter(o => o.scope && o.scope[k] != null);
  const cut = byKind('dim'), open = byKind('open'), den = byKind('denied');
  const dims = new Set(cut.map(o => o.scope.dim));
  ok(132, bad.length === 0 && cut.length + open.length + den.length === st.objects.length &&
        cut.length === 7 && open.length === 1 && den.length === 2 && dims.size === 2,
    `охват — ОБЪЯВЛЕННЫЙ реквизит записи объекта, девятый после рождения (ИС-37): объектов без него или с двумя состояниями сразу ${bad.length} из ${st.objects.length}. Режутся разрезом ${cut.length}, объявлены общими ${open.length}, отвечают отказом ${den.length}. Разрезов охвата ДВА, а не один (${[...dims].join(', ')}) — и ровно в этом был СС-Д11: имя разреза принадлежит ОБЪЕКТУ, а зашитое в движок «d-curator» молча пустило под нож всех, кто назвал свой охват иначе. У отказа объявлены и причина, и дорога: отказ без дороги — половина ответа (§8.4)`);

  /* #133 — тот самый четвёртый случай, ради которого волна и случилась. */
  ST.setRole('Аналитик');
  const B = ST.OBJ('obj-borrower');
  const bAll = st.rows.filter(r => r.obj === 'obj-borrower' && r.date === ASK);
  const mine = bAll.filter(r => r.dims['d-lcurator'] === 'Бекова Н.');
  const bRows = ST.statRows({obj:'obj-borrower', date: ASK});
  const bReg = ST.registryList('obj-borrower', st.today, null);
  ok(133, B.scope.dim === 'd-lcurator' && bAll.length === 8 && mine.length === 3 &&
        bRows.ok && bRows.rows.length === 3 && bReg.length === 3 &&
        has(bRows.passport.scope, 'ведущий куратор') && bRows.passport.scoped === true,
    `заёмщик режется СВОИМ разрезом — и до волны 15 не резался вовсе: строк на ${ASK} — ${bAll.length}, из них ведущим куратором Бековой ${mine.length}, а охват показывал 0. Это не «пустой экран вместо отказа», а НЕВЕРНЫЙ ответ: паспорт заверял «по 0 объектам, доступным вам» там, где доступны ${mine.length}. Теперь и срез, и реестр владельца дают ${bRows.rows.length}, а паспорт называет разрез поимённо: «${bRows.passport.scope}»`);

  /* #134 — у охвата ОДИН читатель, тот же, что у разреза (ИС-18). registryList читал
     «item.h.curator» напрямую: второй читатель, не знающий ни швов, ни полей. Поэтому
     дорога, которую называет отказ, сама отвечала спрашивающему НОЛЬ. */
  const seam = ST.DIM('d-lcurator');
  const world = vm.runInContext('WORLD', sandbox);
  const noHist = (world['obj-borrower'] || []).filter(i => i.h && i.h.curator).length;
  const pairs = st.objects.filter(o => o.scope.dim).map(o => ({
    o, slice: (ST.statRows({obj:o.id, date: ASK}).rows || []).length,
    reg: ST.registryList(o.id, st.today, null).length}));
  const drift = pairs.filter(x => x.slice !== x.reg);
  ok(134, seam.src === 'шов' && seam.seam === 'leadCurator' && noHist === 0 &&
        drift.length === 0 && pairs.length === 7,
    `охват читается ТЕМ ЖЕ читателем, что разрез (ИС-18, ИС-37): у «${seam.name}» источник — ${seam.src} «${seam.seam}», истории «curator» у заёмщика нет ни в одной записи мира (${noHist} из ${(world['obj-borrower'] || []).length}), и прежний прямой доступ к item.h.curator не мог его увидеть в принципе. Срез и реестр владельца сходятся на всех ${pairs.length} режущихся объектах, расхождений ${drift.length} (ИС-14): дорога, которую называет отказ, теперь и правда отвечает`);

  /* #135 — «общий» и «не спрашивается» разводит УТЕЧКА, а не вкус (§9, ADR-0203 §3). */
  const prog = ST.statSlice({obj:'obj-program', dims:['d-pstate'], inds:['a-count'], date: ASK});
  const rcp = ST.statSlice({obj:'obj-receipt', dims:['d-rchan'], inds:['a-count'], date: ASK});
  const zd = ST.statSlice({obj:'obj-zdeal', dims:['d-zdate'], inds:['a-count'], date: ASK,
    buckets:{'d-zdate':'год'}});
  const rcpWork = ST.workList('obj-receipt');
  const zdWork = ST.workList('obj-zdeal');
  const progShort = ST.passportShort(prog.passport);
  ok(135, prog.ok && prog.n === 5 && prog.passport.scoped === false &&
        has(prog.passport.scope, 'программа общая') && has(progShort, 'всего 5') &&
        !rcp.ok && !zd.ok && !rcpWork.ok && !zdWork.ok &&
        has(rcp.why, 'Платёж') && has(zd.why, 'предмет залога'),
    `«общий» и «не спрашивается» — РАЗНЫЕ ответы, и разводит их утечка, а не вкус (§9). Программа общая: она не принадлежит куратору, состав программ — общее знание, и аналитик законно видит все ${prog.n}; паспорт это НАЗЫВАЕТ («${prog.passport.scope}»), а краткая форма говорит «всего», не «вам видно» — иначе одно и то же N читалось бы двумя разными утверждениями. Поступление и залоговый договор отказывают: отдать их целиком значит показать объём чужой работы даже итогом. Обе двери закрыты заодно — и срез, и «работать со списком»: иначе отказ обходился бы за один шаг`);

  /* #136 — ворота стоят в ОБЩЕЙ проверке вопроса, и все двери получают их даром (СС-130). */
  const doors = [
    ST.statSlice({obj:'obj-receipt', dims:['d-rchan'], inds:['a-count'], date: ASK}),
    ST.statRows({obj:'obj-receipt', date: ASK}),
    ST.statSeries({obj:'obj-receipt', inds:'a-sumrsum', dates:['2026-07-31', ASK]}),
    ST.exportJob({obj:'obj-receipt', date: ASK}),
    ST.workList('obj-receipt')];
  ST.setRole('Администратор статистики');
  const aSlice = ST.statSlice({obj:'obj-receipt', dims:['d-rchan'], inds:['a-count'], date: ASK});
  const aRows = ST.statRows({obj:'obj-receipt', date: ASK});
  const aWork = ST.workList('obj-receipt');
  ST.setRole(role0);
  ok(136, doors.every(d => d && d.ok === false && has(d.why, 'не спрашивается')) &&
        doors.every(d => has(d.why, 'ИС-37')) &&
        aSlice.ok && aSlice.n === 15 && aWork.ok && aWork.n === 15 &&
        !aRows.ok && !has(aRows.why, 'не спрашивается') && has(aRows.why, 'порог показа'),
    `ворота охвата стоят в ОБЩЕЙ проверке вопроса, рядом с воротами даты, и все ${doors.length} дверей получают их даром — срез, строки, ряд, выгрузка и список (СС-130): отказ у всех один и тот же, с причиной и дорогой. Роль без сужения проходит: администратору срез отдаёт ${aSlice.n} поступлений, список — ${aWork.n}. Строкам он отказывает — но ПО ДРУГОЙ причине и другими словами: «${String(aRows.why).slice(0, 60)}…» (ИС-22, порог показа). Два отказа на одной двери не сливаются в один: охват говорит «вам этого не спрашивают», порог — «столько списком не отдаётся». Запрет охвата — не на объект, а на пару «объект + роль»`);
})();

/* ---------- Я. Волна 17: календарь учётных периодов — общий справочник ----------
   Календарей было три, и решения не было ни у одного: учёт закрывал своё 5 июня,
   классификация — 7-го, статистика — той же ночью, и на вопрос «что было в мае» три
   системы отсчёта давали три ЗАКОННЫХ ответа. Волна 17 кладёт под все слои ОДИН
   справочник: строка — период, в ней колонка-защёлка на каждый слой со своим актором и
   своей датой, и колонка не ставится, пока пуста нижележащая. Каскад перестаёт быть
   процедурой в чьём-то коде и становится состоянием строки; справочник стережёт порядок,
   но сам не актор (ИС-38, ADR-0204, ИС-9).                                              */
(() => {
  ST.seed();
  const st = ST.state;
  const LAY = ST.layers();

  /* #137 — три колонки в ОДНОЙ строке, у каждой своя фамилия и своя дата. */
  const may = ST.calendar().find(p => p.month === '2026-05');
  const cols = LAY.map(L => may.latches[L]);
  const actors = new Set(cols.filter(Boolean).map(c => c.by));
  const dates  = new Set(cols.filter(Boolean).map(c => c.at));
  const asc = cols.every((c, i) => i === 0 || (c && cols[i - 1] && c.at > cols[i - 1].at));
  const openRows = ST.calendar().filter(p => Object.keys(p.latches).length === 0);
  ok(137, LAY.length === 3 && LAY[LAY.length - 1] === 'статистика' &&
        ST.calendar().length === 4 && cols.every(Boolean) &&
        actors.size === 3 && dates.size === 3 && asc &&
        openRows.length === 2 && st.closedPeriods === undefined && st.log.length === 0,
    `строка календаря несёт КОЛОНКУ НА СЛОЙ, а не одно поле «закрыт»: у мая проставлены все ${cols.length} — ${LAY.map((L, i) => L + ' ' + cols[i].by.split(',')[0] + ' ' + cols[i].at.slice(8, 10) + '.' + cols[i].at.slice(5, 7)).join(' · ')}. Фамилий ${actors.size}, дат ${dates.size}, и даты растут в порядке слоёв — одной общей колонкой «закрыт» этого не описать (ИС-9, ADR-0204 §1). Это СОСТОЯНИЕ, а не журнал: читается из строки справочника при пустом журнале действий (${st.log.length} записей). Открытых строк ${openRows.length} — пустая строка значит «месяц идёт» и от отсутствия строки отличается (ADR-0204, границы)`);

  /* #138 — верхняя колонка не ставится, пока пуста нижняя, и отказ НАЗЫВАЕТ слой. */
  const statFirst = ST.closePeriod('2026-07', 'Мамбетов Э., администратор статистики');
  const clsFirst  = ST.closeLayer('2026-07', 'классификация', 'Турдубаева А., администратор классификации');
  ok(138, !statFirst.ok && statFirst.blockedBy === 'учёт' &&
        has(statFirst.why, 'учёт') && has(statFirst.why, 'классификация') &&
        has(statFirst.why, 'ИС-38') && has(statFirst.why, 'ADR-0204') &&
        !clsFirst.ok && clsFirst.blockedBy === 'учёт' && !has(clsFirst.why, 'ADR-0204 §4') &&
        !ST.isClosed('2026-07-31') && ST.openPeriod('учёт') === '2026-07',
    `порядок стережёт САМ справочник, и отказ называет незакрытый слой поимённо: «${statFirst.why}». Не «нельзя» вообще — сказано, ЧЕГО ждать и от кого. Классификация через голову учёта тоже не проходит (${clsFirst.blockedBy}): правило одно на все слои и читается из места слоя в списке, а не из веток «если статистика». Пока каскад собирался процедурой в чьём-то коде, рассогласование слоёв было штатным состоянием, и «ещё не доехало» от «сломалось» не отличалось ничем (ADR-0204, отвергнутое)`);

  /* #139 — снизу вверх, и именно по одной: «все сразу» — не то же самое. */
  const a = ST.closeLayer('2026-07', 'учёт', 'Осмонова Г., главный бухгалтер', '2026-08-05');
  const mid = ST.closePeriod('2026-07', 'Мамбетов Э., администратор статистики');
  const b = ST.closeLayer('2026-07', 'классификация', 'Турдубаева А., администратор классификации', '2026-08-07');
  const c = ST.closePeriod('2026-07', 'Мамбетов Э., администратор статистики');
  const jul = ST.calendar().find(p => p.month === '2026-07');
  ok(139, a.ok && !mid.ok && mid.blockedBy === 'классификация' && !has(mid.why, '«учёт»') &&
        b.ok && c.ok && c.fixed > 0 && c.layer === 'статистика' &&
        ST.isClosed('2026-07-31') && ST.openPeriod() === '2026-08' &&
        jul.latches['учёт'].at === '2026-08-05' && jul.latches['классификация'].at === '2026-08-07' &&
        jul.latches['статистика'].by === 'Мамбетов Э., администратор статистики',
    `порядок именно СНИЗУ ВВЕРХ, а не «все сразу»: после учёта статистика всё ещё отказывает и называет уже другой слой («${mid.blockedBy}»), и только после него проходит — зафиксировано строк ${c.fixed}. Каскад виден строкой: до какого слоя доехало закрытие июля, видит любой участник, не спрашивая никого (ADR-0204 §3). Фиксация строк — эффект ВЕРХНЕГО СЛОЯ, а не справочника: календарь стережёт порядок и ничьих чисел не трогает (§6)`);

  /* #140 — справочник не актор: без фамилии не ставится ни одна колонка, и сам он не
     ставит ни одной даже тогда, когда модуль работает (ИС-9). */
  ST.seed();
  const noWho = LAY.map(L => ST.closeLayer('2026-07', L, ''));
  const before = LAY.map(L => ST.openPeriod(L)).join('|');
  ST.run(TODAY, {});
  ST.skip('2026-08-19', 'повторное окно обслуживания');
  const after = LAY.map(L => ST.openPeriod(L)).join('|');
  const latched = ST.calendar().reduce((n, p) => n + Object.keys(p.latches).length, 0);
  ok(140, noWho.every(r => !r.ok && has(r.why, 'ИС-9')) && noWho.length === 3 &&
        before === '2026-07|2026-07|2026-07' && after === before && latched === 6,
    `справочник — НЕ АКТОР (ИС-9, ADR-0204 §6): без фамилии отказывают все ${noWho.length} колонки («${noWho[0].why}»), и сам он не проставляет ни одной — после прогона и записанного пропуска календарь тот же (${after}), проставленных колонок по-прежнему ${latched}. Календарь стережёт порядок и записывает, КТО и КОГДА; закрывает человек. Иначе у фиксации не было бы фамилии, а у вопроса «кто закрыл май» — ответа`);

  /* #141 — календарь ОДИН: второго списка закрытых периодов у статистики нет, и все её
     читатели «закрытости» ходят в колонку статистики ТОЙ ЖЕ строки. */
  ST.seed();
  const st2 = ST.state;
  const own = Object.keys(st2).filter(k => k !== 'periods' && /closed|period/i.test(k));
  const may2 = ST.calendar().find(p => p.month === '2026-05');
  const saved = may2.latches['статистика'];
  delete may2.latches['статистика'];                 /* снимаем ОДНУ колонку в справочнике */
  const seen = {open: ST.openPeriod(), closed: ST.isClosed('2026-05-31'),
                fix: ST.fixationOfMonth('2026-05'),
                div: ST.divergence('2026-05', 'obj-credit', 'm-debt'),
                run: ST.run('2026-05-31', {}),
                lower: !!may2.latches['учёт'] && !!may2.latches['классификация']};
  may2.latches['статистика'] = saved;
  ok(141, own.length === 0 && seen.open === '2026-05' && seen.closed === false &&
        seen.fix === null && !seen.div.ok && seen.run.ok && seen.lower === true &&
        ST.isClosed('2026-05-31') === true && ST.openPeriod() === '2026-07' &&
        ST.latch('2026-05', 'учёт').by !== ST.latch('2026-05', 'статистика').by,
    `календарь ОДИН, и он общий: своих полей «закрытых периодов» у состояния статистики не осталось (${own.length}), а снятая ПРЯМО В СПРАВОЧНИКЕ колонка статистики мая мгновенно меняет ответ всех её читателей разом — открытый период, isClosed, фиксация строк, расхождение и даже запрет прогона за 31.05 (ИС-8). Колонки учёта и классификации при этом остаются на месте (${seen.lower}): слои в одной строке независимы, и «май закрыт» без имени слоя — вопрос без ответа. Вернули колонку — вернулись все ответы. Пока список был свой, он мог разъехаться с общим, и оба были бы честны (ADR-0204, контекст)`);

  /* #142 — границы: «строки нет» ≠ «строка пуста», а слой заводится СПИСКОМ. */
  ST.seed();
  const noRow = ST.closeLayer('2026-09', 'учёт', 'Осмонова Г., главный бухгалтер');
  const noLayer = ST.closeLayer('2026-07', 'отчётность', 'Кто-то И.');
  const emptyRow = ST.calendar().find(p => p.month === '2026-07');
  const twice = ST.closeLayer('2026-05', 'учёт', 'Осмонова Г., главный бухгалтер');
  ok(142, !noRow.ok && has(noRow.why, 'в справочнике нет') &&
        !noLayer.ok && has(noLayer.why, 'ИС-38') && !('отчётность' in emptyRow.latches) &&
        emptyRow && Object.keys(emptyRow.latches).length === 0 &&
        !twice.ok && has(twice.why, 'уже проставлена') && has(twice.why, 'ADR-0204 §4'),
    `границы справочника названы, а не подразумеваются: строки сентября нет вовсе — «${noRow.why.slice(0, 72)}…», и это ДРУГОЙ ответ, чем пустая строка июля (колонок ${Object.keys(emptyRow.latches).length}, месяц просто идёт). Слой заводится строкой списка, а не веткой кода: «отчётность» защёлки не имеет и иметь не будет — отчётность, анализ и задания ЧИТАЮТ состояние, а не участвуют в каскаде (ADR-0204, границы). Повторная простановка отбита и названа: перезакрытие идёт распоряжением и сверху вниз (§4), а не молчаливой перезаписью фамилии`);
})();

/* ---- отчёт ---- */
const pass = results.filter(r => r.pass).length;
const lines = results.map(r => `   ${r.pass ? 'PASS' : 'FAIL'}  #${r.n}  ${r.note}`);
const stamp = `SMOKE 2026-08-30 · ${pass}/${results.length} PASS\n` + lines.join('\n');
console.log(stamp);

const body = lines.map(l => '  ' + l).join('\n');
const injected = `  SMOKE 2026-08-30 · ${pass}/${results.length} PASS\n` + body;
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
