// Headless smoke для mockups/statistics/statistics.html (ИС-1…ИС-51, ADR-0145…0152 + 0176…0222).
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
// своей датой; каскад идёт снизу вверх и стережётся справочником, а не вызывающим,
// блок АА — волна 17 ч.2: перезакрытие периода (ИС-50, ADR-0204 §4, ADR-0157 §6) —
// переспросить (сброс сверху вниз, распоряжение обязательно) · переписать (строки
// расфиксированы и пишутся заново) · пометить (выпуски на прежних числах помечены,
// но НЕ переизданы: числа мёрзнут один раз, ИО-4, а переиздавать решает человек, ИО-34),
// блок АБ — волна 17 ч.3: разрез несёт ОБЪЕКТ ОПРЕДЕЛЕНИЯ (ИС-40, ADR-0206) — «область»
// заёмщика и «область выдачи кредита» суть две записи реестра, а не одна с оговоркой:
// имя уточняется объектом, справочник значений один, сложение законно только внутри
// объекта, а сверка разнообъектных срезов запрещена, а не подозрительна (закрыт хвост
// §15 п. 4 канона — тот, из-за которого срез кредитов фильтровался, а срез заёмщиков нет).
// блок АВ — волна 17 ч.4: реестр ОДИН, а запись ОБЪЯВЛЯЕТ породу — показатель или разрез
// (ИС-43, ADR-0209): кладовая одна и виды на неё ничего не хранят · обязательные реквизиты
// расписаны по породам и проверяются одной проверкой · чужой реквизит отбит по имени ·
// формулы нет ни у одной породы, и корзина не исключение · переезд породы сохраняет запись,
// идентификатор и историю · запись не удаляется, а прекращает действие с даты · схема
// витрины порождена реестром и растёт только ADD COLUMN · одна величина в двух ролях —
// две записи, связанные явно, с границами корзин в реестре, а не в настройке отчёта.
// блок волны 17 З-10 — датировка величины и доспрос защёлки (ИС-39 + ИС-46,
// ADR-0205 × ADR-0216) — признак «на дату»/«текущее» принадлежит ВЕЛИЧИНЕ, а не шву, и
// один шов отдаёт оба · паспорт несёт датировку четвёртым обязательным реквизитом и берёт
// ХУДШЕЕ по ответу, датируя основание агрегата, а не агрегат · `when` в сравнение строк не
// входит, поэтому правка объявления не переписывает витрину (ADR-0205 §5) · защёлка
// ПЕРЕСПРАШИВАЕТ соседей перед фиксацией, и дописанное с переписанным считаются порознь ·
// молчание на доспросе кончает закрытие до единой строки, а рубежа два и отказы у них
// разные · после защёлки дата отвечается ЧТЕНИЕМ, а не пересчётом · окончательность
// берётся у КОЛОНКИ СЛОЯ соседа в общем календаре, и три реквизита соседа (слой · умение
// отвечать на опрос · объявленная датировка) не выводятся друг из друга.
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
  /* Волна 17 ч.6: реестр ВЫРОС на 114 сомовых записей, и счёт здесь назван ПО ФАКТУ, а не
     смягчён до «не меньше 85». Неравенство пережило бы и потерю сотни записей молча —
     а именно потеря близнеца и есть та ошибка, которую этот сторож теперь ловит (ИС-44). */
  const own1 = st.indicators.filter(i => !i.somOf), twin1 = st.indicators.filter(i => i.somOf);
  ok(1, st.objects.length === 10 && st.indicators.length === 285 && own1.length === 171 &&
       twin1.length === 114 && twin1.every(t => !!ST.IND(t.somOf)) &&
       st.dims.length === 84 && ST.registry().length === 369 && badSrc.length === 0 &&
       formula.length === 0 && badFn.length === 0,
    `объектов ${st.objects.length}, показателей ${st.indicators.length} — ${own1.length} своих и ${twin1.length} сомовых сторон, и у каждой стороны валютная запись на месте; разрезов ${st.dims.length}, всего записей реестра ${ST.registry().length}. Счёт назван точным числом, а не «не меньше 85»: неравенство пережило бы молча потерю сотни записей, а потеря близнеца — это денежная величина, которую нельзя сложить по портфелю. Без объявленного источника ${badSrc.length}, с формулой ${formula.length} (сомовая сторона — не формула, а вторая колонка той же величины), с функцией вне списка ${badFn.length} — ИС-6, ИС-7, ИС-44`);

  const b = ST.OBJ('obj-borrower');
  ok(2, b && b.owner === 'Заёмщики' && b.inds.indexOf('m-bdebt') >= 0 &&
       ST.OBJ('obj-credit').inds.indexOf('m-bdebt') < 0,
    `заёмщик — самостоятельный объект со своими показателями, а не свёртка кредита (ИС-19)`);

  const shape = ST.ROW_SHAPE;
  /* Волна 17. Прежде #3 доказывал, что сомового эквивалента в строке НЕТ. Теперь он
     доказывает более сильное: форма строки по-прежнему закрыта семью полями — восьмого
     поля «som» рядом с `inds` не завелось, — а сомовая величина попала в строку
     единственной законной дорогой, КОЛОНКОЙ ВНУТРИ `inds`, под своим именем записи
     реестра. Разница принципиальна: поле формы — вещь вне реестра, которую нельзя ни
     назвать в отчёте, ни прекратить датой; колонка `inds` — обычная запись, живущая по
     общим правилам (ИС-15 в части долей, ИС-44, ADR-0214 §2). */
  const rows3 = ST.statRows({obj:'obj-credit', date:'2026-08-18'}).rows;
  const u3 = rows3.find(r => r.ref === 'КД-2025/043');
  const som3 = ST.somIdOf('m-debt');
  /* Волна 17 ч.8 добавила восьмое поле `srcs`, З-10 — девятое `when`, и «форма закрыта»
     давно перестала быть счётом полей: считать надо носителей ЗНАЧЕНИЙ, а их по-прежнему
     два. Ряды названы порознь, пересекаться не могут и вместе обязаны покрыть форму без
     остатка — иначе поле завелось бы вне всех рядов и запрет ИС-15 его бы не касался.
     КРИТЕРИЙ РАЗЛИЧЕНИЯ СМЕНИЛСЯ вместе с четвёртым рядом, и проверка это ловит именно
     как смену, а не как послабление: прежний критерий («ключи ряда значений — имена
     записей реестра, ключи ряда судьбы — ни одного») на `when` НЕ РАБОТАЕТ, потому что
     ключи `when` — тоже имена записей, и старый критерий отправил бы датировку в ряд
     значений. Новый критерий сильнее и тоже механический: ряд ЗНАЧЕНИЙ несёт величины,
     ряд ПРОИСХОЖДЕНИЯ — слова закрытого словаря из двух, ряд СУДЬБЫ имён записей не
     несёт вовсе (ИС-39, ИС-42, ADR-0205 §1, ADR-0208 §2). */
  const key = ST.ROW_KEY, vals = ST.ROW_VALUES, orig = ST.ROW_ORIGIN, fate = ST.ROW_FATE;
  const rows3f = key.concat(vals, orig, fate);
  const both = rows3f.filter((f, i) => rows3f.indexOf(f) !== i);
  const cover = rows3f.slice().sort().join(',') === shape.slice().sort().join(',');
  const valKeys = vals.reduce((a, f) => a.concat(Object.keys(u3[f] || {})), []);
  const origKeys = Object.keys(u3.when || {});
  const origVals = origKeys.map(k => u3.when[k]);
  const fateKeys = Object.keys(u3.srcs || {});
  ok(3, shape.length === 9 && shape.indexOf('som') < 0 && shape.indexOf('доля') < 0 &&
       shape.join(',') === 'obj,ref,date,dims,inds,when,srcs,fixed,by' &&
       vals.length === 2 && orig.length === 1 && both.length === 0 && cover &&
       valKeys.length > 0 && valKeys.every(k => !!ST.REC(k)) &&
       origKeys.length > 0 && origKeys.every(k => !!ST.REC(k)) &&
       ST.DATING.length === 2 && origVals.every(v => ST.DATING.indexOf(v) >= 0) &&
       fateKeys.length > 0 && fateKeys.every(k => !ST.REC(k)) &&
       som3 === 'm-debt-som' && !('som' in u3) && !('som' in u3.inds['m-debt']) &&
       u3.inds[som3] && u3.inds[som3].v > 0 && ST.IND(som3).unit === 'сом',
    `форма строки закрыта: ${shape.join(' · ')} — долей и дельт нет (ИС-15). Полей девять, но носителей ЗНАЧЕНИЙ по-прежнему два: рядов четыре и вместе они покрывают форму без остатка, не пересекаясь ни одним полем: АДРЕС (${key.join(' · ')}) · ЗНАЧЕНИЯ (${vals.join(' · ')}) · ПРОИСХОЖДЕНИЕ (${orig.join(' · ')}) · СУДЬБА (${fate.join(' · ')}). Прежний критерий различения на четвёртом ряду сломался и заменён: ключей в ряду значений ${valKeys.length} и каждый — запись реестра, но ключей в ряду ПРОИСХОЖДЕНИЯ ${origKeys.length} и каждый — тоже запись реестра, так что по именам эти ряды не разводятся. Разводит их словарь: значений в ряду происхождения ${origVals.length}, и все до одного — слова закрытого списка из двух (${ST.DATING.join(' · ')}), величины среди них нет ни одной (ИС-39, ADR-0205 §1). Ряд судьбы стоит особняком по-прежнему: ключей ${fateKeys.length} (${fateKeys.join(', ')}), и не запись реестра ни один — это имена СОСЕДЕЙ (ИС-42, ADR-0208 §2). Сомовая величина вошла в строку колонкой внутри inds под именем записи реестра «${ST.IND(som3).name}» (${(u3.inds[som3] || {}).v} ${ST.IND(som3).unit}), а не полем формы: поле нельзя назвать в отчёте и прекратить датой, запись — можно (ИС-44, ADR-0214 §2)`);

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
  /* Волна 17: состав объекта — только СВОИ разрезы. «Территория выдачи кредита»
     определена на кредите, и взять её в поручительство значило бы завести второй смысл
     под одним именем (ИС-40, ADR-0206 §3). Обстановка переписана, утверждение прежнее. */
  const alien = ST.addObject({id:'obj-guarantee', name:'Поручительство', plural:'поручительства',
    owner:'Обеспечение', refName:'номер поручительства', born:{src:'поле', key:'gdate'},
    dims:['d-branch','d-curator','d-region','d-ptype'], inds:['a-count']});
  const add = ST.addObject({id:'obj-guarantee', name:'Поручительство', plural:'поручительства',
    owner:'Обеспечение', refName:'номер поручительства', born:{src:'поле', key:'gdate'},
    scope:{dim:'d-gcurator'}, dims:[], inds:['a-count']});
  const own = [
    {id:'d-gbranch', obj:'obj-guarantee', name:'Подразделение поручительства', src:'история',
     key:'branch', perObject:'одно', dates:1, owner:'Оргструктура (кадры)', ref:'org',
     levels:[{name:'дивизион', src:'справочник'}, {name:'филиал', src:'история', key:'branch'}]},
    {id:'d-gcurator', obj:'obj-guarantee', name:'Куратор поручительства', src:'история',
     key:'curator', perObject:'одно', dates:1},
    {id:'d-gregion', obj:'obj-guarantee', name:'Территория поручительства', src:'поле',
     key:'region', perObject:'одно', dates:1, owner:'Справочник административного деления',
     levels:[{name:'область', src:'поле', key:'region'}, {name:'район', src:'поле', key:'district'}]},
    {id:'d-gptype', obj:'obj-guarantee', name:'Тип лица поручителя', src:'поле',
     key:'ptype', perObject:'одно', dates:1},
    /* Волна 17: у объекта с денежной величиной обязан быть СВОЙ разрез валюты — чужой не
       годится, складывать по разрезу законно только внутри его объекта (ИС-40, ИС-44). */
    {id:'d-gcur', obj:'obj-guarantee', name:'Валюта поручительства', src:'поле',
     key:'cur', perObject:'одно', dates:1}].map(spec => ST.addDim(spec));
  /* Порядок записей переставлен: разрезы заводятся ДО денежного показателя, потому что с
     волны 17 денежная величина обязана НАЗВАТЬ разрез, внутри которого складывается, а
     назвать можно только существующее. Прежний порядок (показатель → объект → разрезы)
     держался на том, что у денег было молчаливое умолчание «аддитивна» — оно и есть
     ловушка ИС-44. Дверь СПРАШИВАЕТ: без разреза свода та же запись отбита. */
  const mute = ST.addIndicator({dates:1, id:'m-gsec', name:'Требования, обеспеченные поручительством',
    obj:'obj-guarantee', src:'шов', seam:'calcDebt', field:'principal', money:true, type:'сумма'});
  const mi = ST.addIndicator({dates:1, id:'m-gsec', name:'Требования, обеспеченные поручительством', obj:'obj-guarantee',
    src:'шов', seam:'calcDebt', field:'principal', money:true, type:'сумма',
    round:'коп-2', roll:'формульный', rollBy:'d-gcur'});
  const ai = ST.addIndicator({dates:1, id:'a-sumgsec', name:'Обеспечено поручительствами, итого', obj:'obj-guarantee',
    src:'агрегат', fn:'sum', over:'m-gsec'});
  const gInds = ST.OBJ('obj-guarantee').inds;
  const run = ST.run(TODAY, {});
  const after = ST.statSlice({obj:'obj-guarantee', dims:['d-gregion'], inds:['a-count','a-sumgsec'], date: TODAY});
  const gRow = ST.statRows({obj:'obj-guarantee', date: TODAY}).rows[0];
  ok(9, !before.ok && mi.ok && ai.ok && !alien.ok && has(alien.why, 'ИС-40') && add.ok &&
        own.every(r => r.ok) && run.ok && after.ok && after.n === 3 && after.groups.length === 3 &&
        !mute.ok && has(mute.why, 'ИС-44') && has(mute.why, 'Валюта поручительства') &&
        mi.som === 'm-gsec-som' && ai.som === 'a-sumgsec-som' &&
        gInds.indexOf('m-gsec-som') >= 0 && gInds.indexOf('a-sumgsec-som') >= 0 &&
        !!ST.IND('a-sumgsec') && ST.IND('a-sumgsec').roll === 'формульный' &&
        ST.IND('a-sumgsec').rollBy === 'd-gcur' &&
        gRow && gRow.inds['m-gsec-som'] && gRow.inds['m-gsec-som'].v > 0,
    `одиннадцатый объект заведён записью: до — «${before.why}», после — ${after.n} объектов в ${(after.groups || []).length} группах, без единой правки движка (ИС-18). Состав собран из ${own.length} СВОИХ разрезов: чужие в него не берутся — «${String(alien.why).slice(0, 88)}…» (ИС-40, ADR-0206 §3), а справочник значений у своей записи тот же (ADR-0206 §5). Денежная запись заводится только с НАЗВАННЫМ разрезом свода — молчаливая отбита с адресом: «${String(mute.why).slice(0, 96)}…»; заведённая пришла ПАРОЙ (${mi.som} и ${ai.som} — второй унаследовал разрез свода «${(ST.IND('a-sumgsec') || {}).rollBy}» от того, что складывает), оба легли в состав объекта и посчитаны тем же прогоном (${((gRow || {inds:{}}).inds['m-gsec-som'] || {}).v} сом.)`);

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

  /* Обстановка волны 17 ч.8: ИС-20 СУЖЕНА, а не сломана. Прежнее «статистика период не
     запирает» было сказано про ПРОПУСК прогона, и про него остаётся верным — пропущенную
     ночь не починить ничем, и блокировка заморозила бы календарь навсегда. Неполная строка
     устроена иначе: она чинится дозаполнением, и пропустить её в окончательное значило бы
     сделать окончательность пустым словом (ADR-0208 §3). Обе беды выходят одной дверью,
     но в РАЗНЫХ полях, и путать их сторож не даёт. */
  const bl = ST.periodBlockers('2026-08');
  const mute = ST.run('2026-08-20', {silent:{'классификация':'не уложился в срок'}});
  const bl2 = ST.periodBlockers('2026-08');
  const b0 = Object.assign({nb:'—', n:0, reasons:[], objs:[], text:'—'}, bl2.blockers[0] || {});
  ok(17, bl.blockers.length === 0 && bl.warnings.length === 1 && has(bl.warnings[0], '19.08.2026') &&
        mute.ok && mute.partial > 0 && bl2.blockers.length === 1 &&
        b0.nb === 'классификация' && b0.n === mute.partial &&
        b0.reasons.join() === 'не уложился в срок' && b0.objs.length > 0 &&
        bl2.warnings.length === 1 && has(bl2.warnings[0], '19.08.2026'),
    `пропуск и неполнота выходят одной дверью, но в разных полях (ИС-20 сужена волной 17 ч.8, ИС-42). ПРОПУСК прогона — предупреждение и только: «${bl.warnings[0]}»; починить пропущенную ночь нечем, и блокировка остановила бы календарь навсегда. НЕПОЛНАЯ строка — блокировка: после ночи, в которой «классификация» не уложилась в срок, строк неполных ${mute.partial}, блокировка одна и она называет соседа (${b0.nb}), причину (${b0.reasons.join(' · ') || '—'}), число строк (${b0.n}) и объекты: «${b0.text}» — печатный перечень для разбора ночи, а не текст в логе (ADR-0208 §2, §3). Предупреждение о пропуске при этом никуда не делось (${bl2.warnings.length}): одна беда не подменяет другую`);
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
  /* Волна 17: множество кредитов разновалютное, и итог В ВАЛЮТЕ ДОГОВОРА по нему больше не
     число — он отказ с адресом (ИС-44, ADR-0214 §1). Сравнивать «своё» с «системным» надо
     на СОМОВОЙ записи реестра: она аддитивна всегда. Обстановка переписана, утверждение то
     же — и усилено: отбитая валютная сторона тоже спрашивается и её адрес проверяется. */
  const SOMD = ST.somIdOf('a-sumdebt');
  const all = ST.statSlice({obj:'obj-credit', dims:['d-branch'], inds:['a-count','a-sumdebt', SOMD], date: ASK});
  ST.setRole('Аналитик');
  const mine = ST.statSlice({obj:'obj-credit', dims:['d-branch'], inds:['a-count','a-sumdebt', SOMD], date: ASK});
  const list = ST.registryList('obj-credit', '2026-08-18');
  const refs = mine.groups.reduce((a, g) => a.concat(g.refs), []).sort();
  ok(23, mine.n < all.n && refs.join('|') === list.join('|') &&
        mine.groups.every(g => g.n === g.refs.length),
    `аналитик видит ${mine.n} из ${all.n}: множество урезано ДО группировки, чужого ref нет ни в одной группе — ИС-13`);

  ok(24, has(mine.passport.scope, 'Аналитик') && has(mine.passport.scope, 'Бекова Н.') &&
        !has(all.passport.scope, 'куратор'),
    `область видимости названа в паспорте: «${mine.passport.scope}»`);

  const totalAll = all.total[SOMD].v, totalMine = mine.total[SOMD].v;
  const refAll = all.total['a-sumdebt'], refMine = mine.total['a-sumdebt'];
  ok(25, totalMine < totalAll && refAll.refused && refMine.refused &&
        refAll.som === SOMD && refMine.som === SOMD,
    `итог аналитика (${Math.round(totalMine)}) — не итог системы (${Math.round(totalAll)}): закрытая сумма не добывается вычитанием двух доступных срезов. Складывается СОМОВАЯ запись «${ST.IND(SOMD).name}» (${ST.IND(SOMD).unit}), а итог в валюте договора по разновалютному множеству отбит и в системном срезе, и в урезанном — с адресом на неё (${refMine.som}), потому что урезание множества валют из него не убирает (ИС-44, ADR-0214 §1, §2)`);

  ST.setRole('Наблюдатель');
  ok(26, ST.canBuild() === false && ST.canAdmin() === false && ST.addIndicator({dates:1, id:'x'}).ok === false,
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
  /* Волна 17. Прежде #27 доказывал «эквивалент не хранится». Теперь он доказывает две
     вещи разом, и вторая сильнее первой: (1) ВАЛЮТНАЯ клетка сомовой стороны в себе
     по-прежнему не несёт — приложением к чужой клетке величина не живёт (ИС-40); (2) у
     сомовой величины СВОЯ клетка, и в ней лежит ОСНОВАНИЕ пересчёта — применённый курс
     и дата курса по каждой части. Без основания сомовая колонка была бы недоказуемой;
     с ним её перемножает сторож, не выходя из строки (ADR-0214 §4, §5). */
  const somCell = usd.inds[ST.somIdOf('m-debt')];
  const src27 = somCell && somCell.from && somCell.from[0];
  ok(27, cell.cur === 'USD' && cell.rate === 88.30 && cell.rateDate === '2026-08-18' && !stored &&
        somCell && somCell.cur === 'KGS' && somCell.v === Math.round(cell.v * cell.rate * 100)/100 &&
        src27 && src27.rate === 88.30 && src27.rateDate === '2026-08-18' && src27.cur === 'USD',
    `сумма — в валюте договора с курсом и датой курса (${cell.v} ${cell.cur} × ${cell.rate} от ${cell.rateDate}); сомовой стороны валютная клетка в себе не несёт (приложением к чужой клетке величина не живёт), а несёт её СОСЕДНЯЯ колонка — ${(somCell || {}).v} ${(somCell || {}).cur}, и рядом с числом лежит основание: ${(src27 || {}).value} ${(src27 || {}).cur} × ${(src27 || {}).rate} от ${(src27 || {}).rateDate}. Перемножить и сверить можно не выходя из строки — ИС-16, ИС-44, ADR-0214 §4, §5`);

  const mixed = ST.statSlice({obj:'obj-credit', dims:[], inds:['a-sumdebt'], date:'2026-08-18'}).total['a-sumdebt'];
  const one = ST.statSlice({obj:'obj-credit', dims:[], inds:['a-sumdebt'], date:'2026-08-18',
    filter: F(cD('d-cur', '=', {value:'USD'}))}).total['a-sumdebt'];
  const somAgg = ST.statSlice({obj:'obj-credit', dims:[], inds:[ST.somIdOf('a-sumdebt')],
    date:'2026-08-18'}).total[ST.somIdOf('a-sumdebt')];
  /* Волна 17. Прежде #28 доказывал, что разновалютный итог ЧИСЛО выдаёт, но состав при
     нём называет. Теперь он доказывает, что числа не выдаёт вовсе: число там было
     сомовой величиной под валютным именем, и читатель, взявший его и не прочитавший
     плашку, получал «сумму остатка ОД», которой ни в одном договоре нет. Отказ обязан
     назвать три вещи — причину, состав (ADR-0151 §4 в силе целиком) и АДРЕС, — а адрес
     обязан работать: тот же вопрос сомовой записью по ТОМУ ЖЕ множеству отвечает одним
     числом, и оно равно сумме сомовых колонок (ИС-44, ADR-0214 §1, §2). */
  ok(28, mixed.refused === true && mixed.v === undefined &&
        !!mixed.mixed && mixed.mixed.length === 3 && has(mixed.note, 'разновалютное') &&
        has(mixed.why, 'Валюта кредитного договора') && has(mixed.why, 'Сумма остатка ОД в сомах') &&
        mixed.som === 'a-sumdebt-som' &&
        one.cur === 'USD' && !one.refused && one.v > 0 &&
        somAgg && !somAgg.refused && somAgg.cur === 'KGS' && somAgg.v > 0,
    `свод валютной записи по разновалютному множеству — ОТКАЗ, а не правдоподобное число: «${String(mixed.why).slice(0, 150)}…». Состав назван (${mixed.note}), адрес назван и работает: «${ST.IND(mixed.som).name}» по тому же множеству отвечает одним числом ${somAgg.v} ${somAgg.cur}. Однородное множество валютная запись складывает по-прежнему и отвечает в своей валюте (${one.v} ${one.cur})`);

  /* Волна 17. Прежде #29 доказывал, что при показе считаются ТРИ вещи: доля, дельта и
     сомовый эквивалент. Сомовый ушёл из показа в реестр, и проверка ушла за ним, но
     доказывает теперь больше: (1) `ST.somOf` — умножения при показе — в модуле НЕТ
     вовсе, четвёртое место со своим округлением закрыто (ADR-0214 §3, §6); (2) сомовое
     число берётся из строки готовым, а не выводится показом; (3) доля и дельта остались
     ровно там, где были, и ИС-15 для них жив. */
  const somShown = typeof ST.somOf;
  ok(29, somShown === 'undefined' &&
        ST.somValue(usd, 'm-debt') === Math.round(cell.v * cell.rate * 100)/100 &&
        ST.shareOf(1, 4) === 25 && ST.pointsBetween(12.4, 15.9) === 3.5,
    `доля и дельта по-прежнему считаются при показе (${ST.shareOf(1,4)}% · ${ST.pointsBetween(12.4,15.9)} п.п.) и не хранятся — ИС-15. Сомовая величина показом больше НЕ считается: ST.somOf в модуле нет вовсе (${somShown}), показ берёт готовое число соседней колонки (${ST.somValue(usd, 'm-debt')}) — четвёртое место со своим округлением закрыто (ИС-44, ADR-0214 §3, §6)`);

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

  const add = ST.addDim({dates:1, id:'d-segment', name:'Сегмент портфеля', obj:'obj-credit', src:'поле',
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

  /* Волна 17: тождество «итог = группировка тех же строк» проверяется на записи, которая
     аддитивна по определению — на сомовой (ИС-44, ADR-0214 §2). У валютной складывать по
     разновалютному множеству нечего, и она честно отбита; тождество от этого не пропало,
     оно переехало на ту запись, где сложение законно. Утверждение прежнее. */
  const SD = ST.somIdOf('a-sumdebt');
  const slice = ST.statSlice({obj:'obj-credit', dims:['d-branch'], inds:['a-count','a-sumdebt', SD], date:'2026-08-20'});
  const sumOfGroups = slice.groups.reduce((s, g) => s + g.values[SD].v, 0);
  ok(38, Math.abs(sumOfGroups - slice.total[SD].v) < 0.01 &&
        slice.groups.reduce((s, g) => s + g.n, 0) === slice.n &&
        slice.total['a-sumdebt'].refused && slice.total['a-sumdebt'].som === SD,
    `итог — группировка тех же строк, а не отдельное число: сумма ${slice.groups.length} групп сходится с итогом до копейки (${Math.round(sumOfGroups*100)/100} = ${Math.round(slice.total[SD].v*100)/100} сом., ИС-3). Сложение идёт по сомовой записи; валютная по разновалютному множеству отбита с адресом на неё (ИС-44)`);
})();

/* ---------- L. Реестр показателей: что завести нельзя ---------- */
(() => {
  ST.seed();
  const f = ST.addIndicator({dates:1, id:'m-x', name:'Доля просрочки', obj:'obj-credit', src:'агрегат',
    fn:'sum', over:'m-debt', formula:'sum(overdue)/sum(debt)'});
  const der = ST.addIndicator({dates:1, id:'m-y', name:'Доля просрочки', obj:'obj-credit', src:'агрегат', fn:'sum', over:'m-debt'});
  const seam = ST.addIndicator({dates:1, id:'m-z', name:'Ожидаемые потери', obj:'obj-credit', src:'шов',
    seam:'calcExpectedLoss', field:'ecl', money:true});
  const fn = ST.addIndicator({dates:1, id:'m-w', name:'Медиана долга', obj:'obj-credit', src:'агрегат', fn:'median', over:'m-debt'});
  ok(39, !f.ok && has(f.why, 'ИС-6') && !der.ok && has(der.why, 'ИС-15') &&
        !seam.ok && has(seam.why, 'ADR-0150 §3') && !fn.ok && has(fn.why, 'вне закрытого списка'),
    `формула — «${f.why.slice(0, 60)}…»; доля — представление; несуществующий шов — задача ядру; функция вне списка — «${fn.why}»`);

  /* Волна 17: денежная строчная величина заводится, НАЗВАВ разрез своего свода — умолчания
     «аддитивна» у денег больше нет (ИС-44, ADR-0214 §1). Обстановка переписана, утверждение
     прежнее и усилено: заведение по-прежнему одна запись без правки кода, но записей теперь
     ДВЕ и вторую заводит не заказчик, а сборка — и обе считает тот же ближайший прогон. */
  const good = ST.addIndicator({dates:1, id:'m-idle', name:'Плата за неосвоенный остаток', obj:'obj-credit',
    src:'шов', seam:'calcAccrual', field:'interest', money:true, type:'сумма',
    round:'коп-2', roll:'формульный', rollBy:'d-cur'});
  const agg = ST.addIndicator({dates:1, id:'a-sumidle', name:'Плата, итого', obj:'obj-credit', src:'агрегат', fn:'sum', over:'m-idle'});
  ST.run(TODAY, {manual:true, reason:'заведён новый показатель'});
  /* Спрашивается дата ТОГО прогона, который показатель посчитал: на 20.08 записи ещё
     не было, и её отсутствие там — не дефект, а порядок слоёв (ИС-36 + ADR-0147 §4). */
  const use = ST.statSlice({obj:'obj-credit', dims:['d-branch'], inds:['a-sumidle', agg.som], date: TODAY});
  const idleRow = ST.statRows({obj:'obj-credit', date: TODAY}).rows[0];
  ok(40, good.ok && agg.ok && use.ok && use.total[agg.som].v > 0 &&
        good.som === 'm-idle-som' && agg.som === 'a-sumidle-som' &&
        ST.IND('a-sumidle-som').over === 'm-idle-som' &&
        idleRow.inds['m-idle-som'] && idleRow.inds['m-idle-som'].v > 0,
    `показатель заведён записью и сразу считается ближайшим прогоном — без правки кода (ADR-0150 §1): пришёл ПАРОЙ (${good.id || 'm-idle'} + ${good.som}, агрегат ${agg.som} над близнецом ${(ST.IND('a-sumidle-som') || {}).over}), сомовая колонка легла в строку тем же прогоном (${((idleRow || {inds:{}}).inds['m-idle-som'] || {}).v} сом.), а итог по разновалютному множеству — ${Math.round(((use.total || {})[agg.som] || {}).v)} сом.`);

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

  const many = ST.addDim({dates:1, id:'d-rk', name:'Вид погашения', obj:'obj-credit', src:'поле', key:'kind', perObject:'много'});
  const mute = ST.addDim({dates:1, id:'d-rk2', name:'Вид погашения', obj:'obj-credit', src:'поле', key:'kind'});
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
  /* Волна 17: вывод есть ДАТА ПРЕКРАЩЕНИЯ, а не вырезание записи из реестра (ИС-43,
     ADR-0209 §6). В строках, написанных до сегодня, колонка «a-sumdebt» ЗАПОЛНЕНА, и
     стёртая запись оставила бы в клетке число без имени — прочитать его было бы нечем.
     Обстановка переписана, утверждение прежнее и проверяется строже: спросить показатель
     начиная с сегодня больше нечем, потому что из состава объекта он ушёл. */
  const left = ST.IND('a-sumdebt');
  const asked = ST.statSlice({obj:'obj-credit', dims:['d-branch'], inds:['a-sumdebt'], date: TODAY});
  ok(58, !stop.ok && stop.needsConfirm && stop.breaks.length >= 2 && has(stop.why, 'ИС-25') &&
        names.length > 0 && go.ok && go.broke.length >= 2 &&
        left && left.until === ST.state.today && ST.actsOn('a-sumdebt', ST.state.today) === false &&
        ST.OBJ('obj-credit').inds.indexOf('a-sumdebt') < 0 && !asked.ok && ST.martCol('a-sumdebt'),
    `вывод не запрещён чужой публикацией, но назван поимённо: сломается у ${names} (ИС-25, ADR-0177 §4). Вывод — дата прекращения (${left && left.until}), а не вырезание: запись в реестре осталась, из состава объекта ушла, спросить её нечем («${String(asked.why).slice(0, 48)}…»), а колонка витрины НЕ убрана — в ней числа прошлых строк (ADR-0209 §6)`);

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
  const taken = ST.addDim({dates:1, id:'d-industry', name:'Отрасль', obj:'obj-credit', src:'поле',
    key:'industry', perObject:'одно'});
  const noRef = ST.addDim({dates:1, id:'d-fdate', name:'Дата погашения', obj:'obj-repay', src:'поле',
    key:'date', perObject:'одно', buckets:['год','месяц']});
  const withRef = ST.addDim({dates:1, id:'d-div2', name:'Подразделение выдачи', obj:'obj-repay', src:'поле',
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
  const SOV = ST.somIdOf('a-sumover');
  const fo1 = ST.statSlice({obj:'obj-credit', dims:['d-odays'], date: ASK,
    inds:['a-count','a-sumtotal','a-sumover','a-sumcurr', SOV], buckets:{'d-odays':'ступени'}});
  const keys = fo1.ok ? fo1.groups.map(g => g.key) : [];
  const lead = keys.map(k => parseInt(k, 10));
  const sorted = lead.every((n, i) => i === 0 || lead[i-1] <= n);
  /* Волна 17: ступень срока валюту не выбирает, поэтому группы разновалютные, и складывать
     по ним законно СОМОВУЮ запись (ИС-44, ADR-0214 §2). Тождество «сумма групп = итог» то
     же самое, просто спрошено у той записи, у которой сложение имеет смысл. */
  const sumG = fo1.ok ? fo1.groups.reduce((a, g) => a + g.values[SOV].v, 0) : -1;
  ok(65, fo1.ok && keys.length >= 3 && sorted && Math.abs(sumG - fo1.total[SOV].v) < 0.01 &&
        fo1.total['a-sumover'].refused && fo1.total['a-sumover'].som === SOV,
    `ФО-01 собирается срезом по ступеням срока: ${keys.join(' · ')} — по возрастанию, сумма групп сходится с итогом (${Math.round(sumG*100)/100} = ${Math.round(fo1.total[SOV].v*100)/100} сом., ИС-14, ИС-23). Ступень валюту не выбирает: просроченное в ВАЛЮТЕ ДОГОВОРА по такому множеству отбито с адресом на «${ST.IND(SOV).name}» (ИС-44)`);

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
  /* Волна 17: у кредита те же 31 своя строчная величина, и рядом с каждой денежной стоит
     сомовая — 27 близнецов, тоже полноправные строчные записи реестра, и правило «у каждой
     строчной есть агрегат» держится и на них (ИС-44, ADR-0214 §2). Утверждение прежнее и
     распространено на близнецов: ни одна сомовая запись не осталась невидимой для среза. */
  const orig = base.filter(m => !ST.IND(m).somOf);
  const twin = base.filter(m => ST.IND(m).somOf);
  const moneyOrig = orig.filter(m => ST.IND(m).money);
  ok(67, orig.length === 31 && twin.length === 27 && base.length === 58 &&
        covered.length === base.length && seams.length === 0 &&
        twin.length === moneyOrig.length &&
        twin.every(m => orig.indexOf(ST.IND(m).somOf) >= 0),
    `у кредита ${orig.length} строчных показателей, и у каждого есть агрегат — иначе в срез он не попадёт (#36); пять швов ядра прочитаны, непрочитанных нет${seams.length ? ': ' + seams.join(', ') : ''}. Рядом с каждой из ${moneyOrig.length} денежных стоит своя сомовая запись (${twin.length} близнецов, всего ${base.length} строчных), и агрегат есть у каждой из них тоже — сомовая сторона не «пометка на клетке», а такая же запись реестра (ИС-44, ADR-0214 §2)`);

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
  const bAll = ST.OBJ('obj-borrower').inds.map(i => ST.IND(i)).filter(i => i.src !== 'агрегат');
  /* Волна 17: близнец наследует шов origin'а, поэтому «чей шов» считается по СВОИМ записям,
     а не по паре — иначе один и тот же шов был бы посчитан дважды. Утверждение прежнее. */
  const bInds = bAll.filter(i => !i.somOf), bTwin = bAll.filter(i => i.somOf);
  const alien = bInds.filter(i => i.src === 'шов' && SINGLE.indexOf(i.seam) >= 0);
  const fields = bInds.filter(i => i.src === 'поле').map(i => i.key);
  ok(69, bInds.length === 20 && bTwin.length === 9 && alien.length === 0 &&
        bAll.filter(i => i.src === 'шов').every(i => OWN.indexOf(i.seam) >= 0) &&
        bInds.filter(i => i.seam === 'calcPortfolio').length === 14 &&
        bTwin.every(i => i.seam === ST.IND(i.somOf).seam),
    `у заёмщика ${bInds.length} строчных показателей, и ни один не берёт шов ОДНОГО кредита${alien.length ? ': ' + alien.map(i => i.id).join(', ') : ''}: величины портфеля спрашиваются портфельным вопросом (ИС-28, ADR-0184 §1); полем осталось только собственное — ${fields.join(', ')}. Сомовых близнецов ${bTwin.length}, и каждый читает ТОТ ЖЕ портфельный шов, что его валютная сторона: второго источника денег у заёмщика не завелось (ИС-44, ADR-0214 §2)`);

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
  /* Волна 17, ADR-0206 §4: сторож УСИЛЕН. Тождество сумм по «кредиту» и по «заёмщику»
     держится, пока фильтры применены к ОДНОМУ объекту, — и до волны 17 это условие нигде
     не было записано: «отфильтровать срез кредитов по области, а срез заёмщиков не
     отфильтровать» было ВЫРАЗИМО, потому что «область» в реестре лежала одной записью.
     Расхождение выглядело арифметической ошибкой, а было двумя разными фильтрами под одним
     именем. Теперь условие видно из ИМЁН разрезов и держится дверью, а не аккуратностью:
     чужой разрез не берётся ни в группировку, ни в фильтр. */
  const cReg = ST.DIM('d-region'), bReg = ST.DIM('d-bregion');
  const named = !!cReg && !!bReg && cReg.obj === 'obj-credit' && bReg.obj === 'obj-borrower' &&
        cReg.name !== bReg.name && has(cReg.name, 'кредита') && has(bReg.name, 'заёмщика');
  const crossG = ST.statSlice({obj:'obj-credit', dims:['d-bregion'], inds:['a-count'], date: ASK});
  const crossF = ST.statSlice({obj:'obj-credit', dims:['d-region'], inds:['a-count'], date: ASK,
    filter: F(cD('d-bregion', '=', {value:'Ошская'}))});
  /* Живой случай мира: у человека своя область — и кредит, выданный в ДРУГОЙ. */
  const lvl1 = v => [].concat(v)[0];
  const him  = brows.find(r => r.ref === '22903197505433');
  const hisC = crows.filter(r => r.dims['d-binn'] === '22903197505433');
  const hisR = hisC.map(r => lvl1(r.dims['d-region']));
  const ownR = him ? lvl1(him.dims['d-bregion']) : null;
  ok(70, brows.length === 8 && checked >= 5 && broken.length === 0 &&
        named && !crossG.ok && has(crossG.why, 'ИС-40') && !crossF.ok && has(crossF.why, 'ИС-40') &&
        ownR === 'Ошская' && hisR.indexOf('Ошская') >= 0 && hisR.indexOf('Чуйская') >= 0,
    `свод портфеля равен сумме одиночных ответов по каждой валюте у всех ${checked} заёмщиков с договорами${broken.length ? ' · ломается: ' + broken.join(', ') : ''}, и на строке заёмщика держится остаток = просрочено + срочно (ADR-0174 §2). Тождество держится, ПОКА фильтры применены к одному объекту, и с волны 17 это условие держит дверь, а не аккуратность: «${cReg.name}» и «${bReg.name}» — две записи реестра, и спросить кредиты чужой территорией нельзя ни группировкой, ни фильтром («${String(crossF.why).slice(0, 74)}…»). У заёмщика ${him.ref} область ${ownR}, а его кредиты выданы в ${hisR.join(' и ')} — на одном человеке значения РАСХОДЯТСЯ законно; пока обе трактовки лежали под именем «Территория», это расхождение выглядело арифметической ошибкой, и объяснять его было нечем: имя врало (ИС-40, ADR-0206 §4)`);

  /* Разновалютный портфель молчит одним числом и говорит составом (ADR-0184 §3). Волна 17
     добавила к этому вторую половину, которой не было: у той же строки есть СОМОВАЯ
     КОЛОНКА, и в ней — ОДНО число, собранное ядром из тех же частей, с применённым курсом
     и датой курса по каждой части рядом. Прежде здесь доказывалось, что эквивалент
     считается показом и в строке его нет; теперь доказывается, что он в строке ЕСТЬ, что
     он один, что он проверяем перемножением частей и что свод валютной записи по
     разновалютному множеству отказывает, а сомовой — отвечает (ИС-44, ADR-0214). */
  const mix = brows.find(r => r.dims['d-bcur'] === 'разновалютный');
  const mixCell = mix ? mix.inds['m-btotal'] : null;
  const mixParts = ST.partsOf(mixCell);
  const mixSom = mix ? mix.inds[ST.somIdOf('m-btotal')] : null;
  const byHand = mixParts.reduce((a, x) => a + x.v * x.rate, 0);
  const stored = brows.some(r => Object.keys(r.inds).some(k => 'som' in r.inds[k] || 'сом' in r.inds[k]));
  const agg = ST.statSlice({obj:'obj-borrower', dims:['d-ptype'],
    inds:['a-sumbtotal', ST.somIdOf('a-sumbtotal')], date: ASK});
  const tot = agg.ok ? agg.total['a-sumbtotal'] : null;
  const totSom = agg.ok ? agg.total[ST.somIdOf('a-sumbtotal')] : null;
  /* Отказ ПОКЛЕТОЧНЫЙ: одновалютные группы того же среза отвечают числом в своей валюте,
     а отказывает ровно та группа, которая разновалютна. Это не половина ответа, а ровно
     то, что объявлено реквизитом: аддитивна ВНУТРИ разреза (ADR-0214 §1). */
  const gAns = agg.ok ? agg.groups.filter(g => !g.values['a-sumbtotal'].refused) : [];
  const gRef = agg.ok ? agg.groups.filter(g =>  g.values['a-sumbtotal'].refused) : [];
  ok(71, mixCell && mixCell.v == null && mixParts.length === 2 && !stored &&
        mixSom && mixSom.cur === 'KGS' && mixSom.v === Math.round(byHand * 100)/100 &&
        mixSom.from && mixSom.from.length === 2 && mixSom.from.every(x => x.rate > 0 && x.rateDate) &&
        tot && tot.refused === true && tot.v === undefined && tot.mixed.length === 3 && tot.by &&
        has(tot.note, 'EUR') && has(tot.note, 'USD') && has(tot.why, 'в сомах') &&
        totSom && !totSom.refused && totSom.v > 0 && totSom.cur === 'KGS' &&
        gAns.length === 2 && gRef.length === 1 &&
        gAns.every(g => g.values['a-sumbtotal'].cur && g.values[ST.somIdOf('a-sumbtotal')].v > 0),
    `разновалютный портфель (${mix ? mix.ref : '—'}) называет состав ${mixParts.map(x => x.v + ' ' + x.cur).join(' + ')} и молчит одним числом — а сомовая колонка ТОЙ ЖЕ строки отвечает одним: ${(mixSom || {}).v} ${(mixSom || {}).cur}, и это ровно ${mixParts.map(x => x.v + '×' + x.rate).join(' + ')}, посчитанное ядром; курс и дата курса лежат рядом с числом, приложением к чужой клетке величина не живёт. Свод валютной записи по разновалютному множеству ОТКАЗАН («${String(tot.note)}»), сомовой — ${(totSom || {}).v} ${(totSom || {}).cur}. Отказ поклеточный: групп ${agg.groups.length}, ответили числом ${gAns.length} (${gAns.map(g => g.values['a-sumbtotal'].cur).join(', ')}), отказала ${gRef.length} — та, что разновалютна (ИС-44, ADR-0214 §1, §2, §4)`);

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
  const dist = ST.addIndicator({dates:1, id:'a-cdinn', name:'Заёмщиков в срезе', obj:'obj-credit',
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
  const seamedAll = cinds.filter(i => i.src === 'шов');
  /* Волна 17: сомовый близнец наследует шов, и «сколько шовных» считается по СВОИМ записям —
     иначе один шов был бы посчитан дважды. Владелец шва от появления близнеца не меняется. */
  const seamed = seamedAll.filter(i => !i.somOf), seamTwin = seamedAll.filter(i => i.somOf);
  const single = seamedAll.filter(i => CORE_SEAMS.indexOf(i.seam) >= 0);
  const pledge = seamedAll.filter(i => i.seam === 'calcPledge');
  const covD = ['d-covstate','d-covreq'].map(d => ST.DIM(d));
  const covI = ST.OBJ('obj-credit').inds.map(i => ST.IND(i))
    .filter(i => i && i.seam === 'calcCoverage' && !i.somOf);
  ok(78, single.length === 0 && pledge.length === seamedAll.length && seamed.length === 9 &&
        seamTwin.length === 4 && seamTwin.every(i => i.seam === 'calcPledge') &&
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
  /* Волна 17: состав среза читается СРЕЗОМ (ИС-45) — при разрежённом хранении строки
     ровно на эту дату есть только у изменившихся, а состав от этого не меняется. */
  const cnt = (o, d) => ST.rowsAsOf(o, d).length;
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
  const br = ST.statSlice({obj:'obj-claim', dims:['d-clbranch'], levels:{'d-clbranch':2},
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
  /* Волна 17: сомовая сторона больше не «пометка на клетке» (`cell.som`), а ОТДЕЛЬНАЯ ЗАПИСЬ
     реестра со своим именем — её и спрашивают именем, наравне с валютной (ИС-44, ADR-0214 §2).
     Складываются одни и те же строки по одним и тем же курсам, потому равенство точное. */
  const SB = ST.somIdOf('a-sumdebt');
  const cr = ST.statSlice({obj:'obj-credit', dims:['d-branch'], levels:{'d-branch':2},
    inds:['a-count','a-sumdebt', SB], date: D});
  const sumC = cr.groups.reduce((n, g) => n + g.values[SB].v, 0);
  const totC = cr.total[SB].v;
  const keyless = st.indicators.filter(i => i.src !== 'агрегат' && !i.dedupBy).length;
  ok(93, cr.ok && Math.abs(sumC - totC) < 0.01 && !(cr.total[SB]||{}).dedup && keyless > 60 &&
        !(cr.total['a-sumdebt']||{}).dedup,
    `послабление точечное: у ${keyless} показателей без ключа сумма групп сходится с итогом до копейки (${Math.round(sumC*100)/100} = ${Math.round(totC*100)/100} сом.) и отметки дедупа в ответе нет вовсе (ИС-3, ИС-14)`);

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
  const cAll = st.indicators.filter(i => i.obj === 'obj-case' && i.src === 'шов');
  const cInds = cAll.filter(i => !i.somOf);
  const one = cAll.filter(i => i.seam === 'calcDebt' || i.seam === 'calcPortfolio');
  ok(96, cInds.length === 4 && one.length === 0 && cAll.every(i => i.seam === 'casePortfolio') &&
        cAll.filter(i => i.somOf).length === 2,
    `портфельный шов дела принадлежит взысканию: ${cInds.length} шовных показателей, все идут casePortfolio, шов ОДНОГО кредита не читает ни один (${one.length}) — множество выбирает связь «дело × кредит × роль», и знает её только владелец (ИС-28, ИС-31)`);

  /* ИС-35: удельная величина показателем не заводится вовсе. Отказ обязан указать пару
     «срез + счёт» и предупредить о занижении знаменателя. */
  const per = ST.addIndicator({dates:1, id:'m-perc', name:'Требований на куратора', obj:'obj-claim',
    src:'агрегат', fn:'avg', over:'m-clsum'});
  ok(97, !per.ok && has(per.why, 'ИС-30') && has(per.why, 'ИС-35') && has(per.why, 'занижает'),
    `удельная величина отбита и разложена на пару: «${per.why}»`);

  /* И занижение это не гипотеза: кураторов в мире трое, а в срезе мер их видно
     двое — у третьего мер нет, и в срез он не попадает ВОВСЕ. Знаменатель,
     снятый со среза, систематически меньше настоящего. */
  const curSlice = ST.statSlice({obj:'obj-measure', dims:['d-mcurator'], inds:['a-count'], date: D});
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
        has(pf, 'Валюта кредитного договора = KGS и Дней просрочки > 100') &&
        has(pf, 'Территория выдачи кредита = Чуйская') &&
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
  ok(109, ser.ok && ser.points.every(p => p.value.v === 6) && has(ser.passport.filter, 'Валюта кредитного договора = KGS') &&
        fl.ok && Math.round(fl.value) === 825500 && has(fl.passport.filter, 'Валюта кредитного договора = KGS') &&
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
        has(built, 'либо набор 2') && has(built, 'Валюта кредитного договора = KGS') &&
        /* «&gt;» — оператор в чипе экранирован: подпись рисуется текстом, не разметкой. */
        has(built, 'Дней просрочки &gt; 100') && has(built, 'Территория выдачи кредита = Чуйская') &&
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
  const rowsOf = o => ST.rowsAsOf(o, D);
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
  /* Волна 17: близнец не заводит НОВОЙ клетки шва — он читает ту же, что его валютная
     сторона, и потому в счёт именованных клеток не идёт (ИС-44, ADR-0214 §2). */
  const seam = rowInds(P).filter(i => i.src === 'шов' && !i.somOf);
  const seamSom = rowInds(P).filter(i => i.src === 'шов' && i.somOf);
  const compound = seam.filter(i => /_/.test(i.field || ''));
  const one = at(pays, 'ПГ-2026/1156');
  ok(111, pays.length === 14 && bad111.length === 0 && seam.length === 7 && compound.length === 0 &&
        seamSom.length === 7 && seamSom.every(i => i.field === ST.IND(i.somOf).field),
    `сумма платежа = Σ пяти статей на каждой из ${pays.length} строк, расхождений ${bad111.length}: ПГ-2026/1156 — ${ART.map(i => v(one, i)).join(' + ')} = ${v(one,'m-ramount')} (расходы → комиссия → ОД → проценты → пеня, ADR-0087). ОД своей формулы не имеет, он РАЗНОСТЬ; статьи и слои — две проекции одной суммы, ${seam.length} именованных клеток шва (5+2), а не 5×2 матрица, составных имён ${compound.length} (ADR-0183 §2, §3, ADR-0179 §3)`);

  const bad112 = pays.filter(r => !near(v(r,'m-ramount'), r2(v(r,'m-pjud') + v(r,'m-pfree'))));
  const two = at(pays, 'ПГ-2026/1178');
  const kgs = ST.statSlice({obj:'obj-repay', dims:['d-repkind'], date: D,
    inds:['a-sumpjud','a-sumpfree','a-sumramount'], filter: F(cD('d-pcur','=',{value:'KGS'}))});
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
  const brs = [...new Set(kids.map(r => String(r.dims['d-pbranch'])))];
  const borrowed = R.dims.filter(d => ['d-branch','d-curator','d-region','d-cur',
    'd-pbranch','d-pcurator','d-pregion','d-pcur','d-pcredit'].indexOf(d) >= 0);
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
  /* Волна 17 З-12: закрытыми числятся и ЛЕГАСИ-месяцы — они пришли закрытыми (ИС-41,
     ADR-0207 §3). Утверждение сторожа о поступлениях они не касаются: считаются месяцы,
     которые закрыл человек, а легаси отбираются отметкой строки календаря, а не датой. */
  const closedM = ST.closedMonths().filter(m => !ST.isLegacyMonth(m));
  const openM = noPay.every(r => ST.closedMonths().indexOf(r.f.rdate.slice(0, 7)) < 0);
  ok(118, drift.length === 0 && noPay.length === 2 && openM && closedM.length === 2 &&
        ST.closedMonths().filter(m => ST.isLegacyMonth(m)).length === 6,
    `дата платежа НАСЛЕДУЕТСЯ от поступления, своей у него нет (ТЗ 14 §2.1): на ${kin.length} платежей расхождений и висячих ссылок ${drift.length} — рождение платежа приходит из родителя, а опознание рождает платёж, а не правит поле (§7.1, ИС-33, ADR-0197). Оба невыясненных (${noPay.map(r => r.id).join(', ')}) лежат в ОТКРЫТЫХ месяцах, закрыты ${closedM.join(', ')}: невыясненное не даёт закрыть период (§8.6, ADR-0075)`);

  /* Волна 17: состав считается по СВОИМ записям — сомовый близнец не «набор впрок», он
     вторая сторона той же величины и заводится сборкой, а не заказчиком (ИС-44, ADR-0214 §2).
     Утверждение о недоборе и наборе впрок прежнее, близнецы считаются отдельно. */
  const own = l => l.filter(i => !ST.IND(i).somOf);
  const iPay = own(rowInds(P).map(i => i.id)).length, aPay = own(P.inds).length - iPay;
  const iRc = own(rowInds(R).map(i => i.id)).length, aRc = own(R.inds).length - iRc;
  const somPay = P.inds.filter(i => ST.IND(i).somOf).length;
  const somRc = R.inds.filter(i => ST.IND(i).somOf).length;
  const badAgg = st.indicators.filter(i => i.src === 'агрегат' && i.over &&
    ['перечисление','булево'].indexOf((ST.IND(i.over) || {}).type) >= 0);
  ok(119, P.dims.length === 8 && iPay === 8 && aPay === 9 && somPay === 16 &&
       R.dims.length === 5 && iRc === 6 && aRc === 8 && somRc === 8 && badAgg.length === 0,
    `состав по ADR-0183 — без недобора и без набора впрок: платёж — ${P.dims.length} разрезов, ${iPay} мер строки, ${aPay} агрегатов; поступление — ${R.dims.length} / ${iRc} / ${aRc}. Каждый разрез назван внешним потребителем: ФО-41 «Реестр погашений» — кредит, ФО-04 «Погашения за период» — дата, ТЗ 14 §3.1 — три оси, и они стоят у ПОСТУПЛЕНИЯ: своих осей платёж не имеет, он их наследует (ADR-0056). Агрегатов над перечислением и булевым ${badAgg.length} (ИС-29, ADR-0185 §1)`);

  const cur = ['KGS','USD','EUR'].map(c => {
    const rr = ST.statSlice({obj:'obj-receipt', dims:['d-rchan'], date: D,
      inds:['a-sumrpaid','a-sumrsum'], filter: F(cD('d-rcur','=',{value:c}))});
    const pp = ST.statSlice({obj:'obj-repay', dims:['d-repkind'], date: D,
      inds:['a-sumramount'], filter: F(cD('d-pcur','=',{value:c}))});
    return {c, ok: rr.ok && pp.ok, paid: rr.ok ? rr.total['a-sumrpaid'].v : null,
            got: rr.ok ? rr.total['a-sumrsum'].v : null, pay: pp.ok ? pp.total['a-sumramount'].v : null};
  });
  /* Волна 17 ч.6. Прежде хвост довода — «разновалютное к одному числу молча не сведено» —
     держался тем, что все три вопроса заданы С ФИЛЬТРОМ по валюте: молчаливого сведения
     просто не просили. Теперь его просят прямо: тот же срез БЕЗ фильтра. Валютный
     показатель отвечает ОТКАЗОМ с адресом, сомовый — одним числом, и это число равно сумме
     трёх сомовых итогов по валютам: сомовая величина аддитивна, и проверяется это
     сложением, а не обещанием (ИС-44, ADR-0214 §1). */
  const CORE120 = vm.runInContext('CORE', sandbox);
  const somPaid = ST.somIdOf('a-sumrpaid');
  const perSom = ['KGS','USD','EUR'].map(c => ST.statSlice({obj:'obj-receipt', dims:['d-rchan'],
    date: D, inds:[somPaid], filter: F(cD('d-rcur','=',{value:c}))}).total[somPaid].v);
  const mix120 = ST.statSlice({obj:'obj-receipt', dims:['d-rchan'], date: D, inds:['a-sumrpaid', somPaid]});
  const refMix = mix120.total['a-sumrpaid'], somMix = mix120.total[somPaid];
  ok(120, cur.every(x => x.ok && near(x.paid, x.pay)) && cur.some(x => !near(x.got, x.pay)) &&
       mix120.ok && refMix.refused && refMix.som === somPaid && (refMix.mixed || []).length === 3 &&
       somMix.v > 0 && perSom.every(v => v > 0) &&
       near(somMix.v, CORE120.somRound(perSom.reduce((a, b) => a + b, 0), ST.roundOf(somPaid))),
    `«поступило» и «погашено» — разные вопросы, а не расхождение: по КАЖДОЙ валюте разнесённое поступлениями = сумме платежей (${cur.map(x => x.c + ' ' + x.paid + ' = ' + x.pay).join(' · ')}), а поступило больше (${cur.map(x => x.c + ' ' + x.got).join(' · ')}) — разницу держат возврат и нераспределённый остаток. Ни одна сумма не сложена дважды (ИС-28). Разновалютное к одному числу молча не сводится, и это проверено не фильтром, а вопросом без фильтра: «${ST.IND('a-sumrpaid').name}» по всему множеству отвечает ОТКАЗОМ и называет валюты, которые нечем сложить (${(refMix.mixed || []).join(' · ')}), и адрес — «${ST.IND(somPaid).name}»; сомовая величина по тому же множеству отвечает ОДНИМ числом ${somMix.v}, и оно ровно равно сумме трёх сомовых итогов по валютам (${perSom.join(' + ')}). Молчаливого сведения нет ни в ту сторону, ни в другую: там, где сложить нельзя, — отказ, а там, где можно, — число, и оно сходится (ИС-44, ADR-0184 §3, ADR-0214 §1, СС-Д4)`);
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
  const rowsOf = o => ST.rowsAsOf(o, D);
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
  /* Волна 17: у меры взыскания появился СВОЙ разрез валюты (d-mcur) — денежная величина
     обязана назвать разрез, внутри которого складывается, и чужой разрез для этого не
     годится (ИС-44, ADR-0214 §1, ИС-40). Состав считается по своим записям. */
  const noSom = l => l.filter(i => !ST.IND(i).somOf);
  const iM = noSom(rowInds(M).map(i => i.id)).length, aM = noSom(M.inds).length - iM;
  const iP = noSom(rowInds(PR).map(i => i.id)).length, aP = noSom(PR.inds).length - iP;
  const prRows = ST.statRows({obj:'obj-program', date: D});
  const bare = prRows.rows.every(r => r.ref && Object.keys(r.inds).length === 0);
  const cnt = ST.statSlice({obj:'obj-program', dims:['d-pstate'], inds:['a-count'], date: D});
  ok(126, PR.dims.length === 9 && iP === 0 && aP === 1 && prRows.rows.length === 5 && bare &&
        cnt.ok && cnt.total['a-count'].v === 5 && PR.dims.indexOf('d-curator') < 0 &&
        M.dims.length === 11 && iM === 2 && aM === 4 && ST.DIM('d-mcur').obj === 'obj-measure' &&
        M.inds.filter(i => ST.IND(i).somOf).length === 2,
    `состав по ADR-0183 «Границы»: программа — ${PR.dims.length} разрезов, ${iP} мер строки, ${aP} агрегат; мера взыскания — ${M.dims.length} / ${iM} / ${aM}. Объект БЕЗ ЕДИНОЙ меры строки законен: строк ${prRows.rows.length}, у каждой ref и разрезы, и «сколько программ» считается по СТРОКАМ (${cnt.total['a-count'].v}), а не по мере. Разреза «Куратор» у программы нет и быть не может: «ответственные сотрудники» — поле lookup (multi), многозначное на дату, и многозначность поднимает уровень, а не сплющивается в клетку (ИС-21, ADR-0201 §4)`);

  /* Идентификатор записи реестра — ИМЯ, а не подпись: двух записей под одним именем не
     бывает. Форма заведения занятый идентификатор отбивает (проверка #46), но саму
     ЗАГРУЗКУ реестра до волны 12 не сторожил никто — и волна завела «Дату начала действия
     программы» под уже занятым «d-pdate»: поиск отдавал первую запись, «Дата платежа»
     становилась недостижимой, а срез платежей по дате молча спрашивал корзину чужого
     разреза. Это СС-Д14: реестр обязан быть непротиворечив на входе, иначе всякий ответ
     под вопросом (ИС-18, ИС-24, ADR-0176 §7). */
  const dimsAll = vm.runInContext('REGISTRY.filter(r => r.kind === "разрез")', sandbox);
  const dup = arr => {
    const seen = {}, out = [];
    arr.forEach(id => { seen[id] = (seen[id] || 0) + 1; if (seen[id] === 2) out.push(id); });
    return out;
  };
  const dD = dup(dimsAll.map(d => d.id));
  const dI = dup(st.indicators.map(i => i.id));
  const dO = dup(st.objects.map(o => o.id));
  /* Волна 17: кладовая ОДНА (ИС-43, ADR-0209), и уникальность идентификатора спрашивается
     по ней целиком, а не по породам врозь: одинаковый id у показателя и разреза был бы тем
     же СС-Д14, только между породами. Обстановка переписана, утверждение прежнее. */
  const dR = dup(vm.runInContext('REGISTRY', sandbox).map(r => r.id));
  const pay = ST.DIM('d-pdate'), start = ST.DIM('d-pstart');
  const askPay = ST.statSlice({obj:'obj-repay', dims:['d-pdate'], inds:['a-count'], date: D});
  ok(127, dD.length === 0 && dI.length === 0 && dO.length === 0 && dR.length === 0 &&
        pay && pay.name === 'Дата платежа' && pay.key === 'rdate' &&
        start && start.name === 'Дата начала действия программы' && start.key === 'pdate' &&
        !askPay.ok && has(askPay.why, 'Дата платежа') && has(askPay.why, 'месяц'),
    `идентификаторы реестра уникальны на ЗАГРУЗКЕ, а не только в форме заведения (СС-Д14): разрезов ${dimsAll.length}, показателей ${st.indicators.length}, объектов ${st.objects.length}, повторов ноль. Две даты — «${pay.name}» (${pay.key}) и «${start.name}» (${start.key}) — живут врозь, и отказ платежам называет ИХ корзины: «${askPay.why.slice(0, 60)}…» (ИС-18, ADR-0176 §7)`);
})();

/* ---------- Z. Волна 13: у каждой записи реестра есть спрашивающий ---------- */
(() => {
  ST.seed();
  const st = ST.state;
  const dimsAll = vm.runInContext('REGISTRY.filter(r => r.kind === "разрез")', sandbox);
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
  /* Волна 17 З-12: у списка появилось ВТОРОЕ слагаемое — легаси-даты (ИС-41, ADR-0207 §5).
     В журнале прогонов их нет и быть не может: их писал выпуск миграции, и прогон их не
     видит. Утверждение сторожа от этого не ослабло, а разделилось: прогонные даты — из
     журнала, легаси — из строк, и лежат они СТРОГО по свою сторону запуска. */
  const dsRun = ds.filter(d => d >= ST.LAUNCH()), dsLeg = ds.filter(d => d < ST.LAUNCH());
  ok(130, ds.length === 12 && dsRun.length === 6 && dsLeg.length === 6 &&
        ds.indexOf(TODAY) < 0 && ds[ds.length - 1] === '2026-08-20' &&
        st.q.date === ds[ds.length - 1] && empty.length === 0 && future.length === 0 &&
        !ST.dateGate(ds[ds.length - 1]) && !ST.dateGate('2026-08-19'),
    `спрашиваемые даты — это ЖУРНАЛ ПРОГОНОВ, а не константа файла: ${dsRun.length} прогонных дат у кредита, «сегодня» среди них нет, умолчание вопроса стоит на последней (${st.q.date}). Объектов без единой даты ${empty.length} из ${objs.length}, дат в будущем ${future.length}. Дыра внутри истории воротами НЕ отбивается (19.08 проходит) — её дело ИС-12, а не ИС-36. Второе слагаемое списка — ${dsLeg.length} ЛЕГАСИ-дат (${dsLeg[0].slice(0,7)}…${dsLeg[dsLeg.length-1].slice(0,7)}), и они не из журнала: прогон их не писал и не видит, читаются они из строк — законно ровно потому, что легаси-строка окончательна по построению (ИС-41, ADR-0207 §5)`);

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
  /* Волна 17: у каждого режущегося объекта разрез охвата теперь СВОЙ и определён НА НЁМ
     же — «Куратор кредита» и «Куратор меры взыскания» суть разные признаки, и одно имя
     «Куратор» на семь объектов означало бы, что охват семи объектов сложим (ИС-40). */
  const alienScope = cut.filter(o => (ST.DIM(o.scope.dim) || {}).obj !== o.id);
  ok(132, bad.length === 0 && cut.length + open.length + den.length === st.objects.length &&
        cut.length === 7 && open.length === 1 && den.length === 2 && dims.size === 7 &&
        alienScope.length === 0 &&
    `охват — ОБЪЯВЛЕННЫЙ реквизит записи объекта, девятый после рождения (ИС-37): объектов без него или с двумя состояниями сразу ${bad.length} из ${st.objects.length}. Режутся разрезом ${cut.length}, объявлены общими ${open.length}, отвечают отказом ${den.length}. Разрезов охвата СЕМЬ — по одному на режущийся объект (${[...dims].join(', ')}), и каждый определён НА СВОЁМ объекте (чужих ${alienScope.length}). Ровно в этом был СС-Д11: имя разреза принадлежит ОБЪЕКТУ, а зашитое в движок «d-curator» молча пустило под нож всех, кто назвал свой охват иначе; одно имя «Куратор» на семь объектов вдобавок заявляло бы, что охваты семи объектов между собой складываются (ИС-40, ADR-0206 §3). У отказа объявлены и причина, и дорога: отказ без дороги — половина ответа (§8.4)`);

  /* #133 — тот самый четвёртый случай, ради которого волна и случилась. */
  ST.setRole('Аналитик');
  const B = ST.OBJ('obj-borrower');
  const bAll = ST.rowsAsOf('obj-borrower', ASK);
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
  /* Волна 17 З-12: в справочнике появились ЛЕГАСИ-строки — периоды до запуска, пришедшие
     закрытыми (ИС-41, ADR-0207 §3). Считаются они отдельно и отличаются ОТМЕТКОЙ строки,
     а не датой: «период загружен закрытым» и «период закрыл человек» — разные состояния,
     и календарь обязан их различать так же, как различает «строки нет» и «строка пуста». */
  const own137 = ST.calendar().filter(pr => !pr.legacy), leg137 = ST.calendar().filter(pr => pr.legacy);
  ok(137, LAY.length === 3 && LAY[LAY.length - 1] === 'статистика' &&
        own137.length === 4 && leg137.length === 6 &&
        leg137.every(pr => LAY.every(L => pr.latches[L] && pr.latches[L].legacy)) &&
        cols.every(Boolean) &&
        actors.size === 3 && dates.size === 3 && asc &&
        openRows.length === 2 && st.closedPeriods === undefined && st.log.length === 0,
    `строка календаря несёт КОЛОНКУ НА СЛОЙ, а не одно поле «закрыт»: у мая проставлены все ${cols.length} — ${LAY.map((L, i) => L + ' ' + cols[i].by.split(',')[0] + ' ' + cols[i].at.slice(8, 10) + '.' + cols[i].at.slice(5, 7)).join(' · ')}. Фамилий ${actors.size}, дат ${dates.size}, и даты растут в порядке слоёв — одной общей колонкой «закрыт» этого не описать (ИС-9, ADR-0204 §1). Это СОСТОЯНИЕ, а не журнал: читается из строки справочника при пустом журнале действий (${st.log.length} записей). Открытых строк ${openRows.length} — пустая строка значит «месяц идёт» и от отсутствия строки отличается (ADR-0204, границы). Рядом в том же справочнике ${leg137.length} ЛЕГАСИ-строк: колонки в них проставил ВЫПУСК МИГРАЦИИ и помечены отметкой — «пришёл закрытым» и «закрыл человек» одной колонкой не описать (ИС-41, ADR-0207 §3, §4)`);

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
  /* Колонки легаси проставлены не справочником и не человеком, а выпуском миграции, и в
     счёт «справочник не актор» не идут: он их и не ставил (ИС-41, ADR-0207 §3). */
  const latched = ST.calendar().filter(p => !p.legacy)
    .reduce((n, p) => n + Object.keys(p.latches).length, 0);
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

/* ---------- АА. Перезакрытие периода: переспросить · переписать · пометить (ИС-50) ----------
   Тихая перезапись закрытого периода расходится с уже сданным наружу, и расхождение
   обнаруживает ПОЛУЧАТЕЛЬ, а не мы (ADR-0204 §4, ADR-0157 §6). Поэтому распоряжение
   обязательно, сброс идёт сверху вниз, повторная простановка — снизу вверх, а выпуски
   метятся. Ключевая тонкость §4: классификация и статистика не открываются НИКОГДА —
   открывается учёт, верхние слои переспрашивают и защёлкиваются заново.                   */
(() => {
  const LAY = ST.layers();
  const WHO = 'Осмонова Г., главный бухгалтер';
  const CLS = 'Турдубаева А., администратор классификации';
  const STA = 'Мамбетов Э., администратор статистики';
  const ORD = {no:'РП-118 от 21.08.2026', basis:'акт сверки № 41 от 14.07.2026'};
  const mFixed = m => ST.state.rows.filter(r => r.date.slice(0, 7) === m && r.fixed).length;
  const why = r => String((r && r.why) || '(отказа нет)');
  const lastLog = () => ((ST.state.log[0] || {}).msg || '(журнал пуст)');

  /* #143 — распоряжение обязательно, и отказ говорит, ПОЧЕМУ оно обязательно. */
  ST.seed();
  const noOrder   = ST.reopenPeriod('2026-05', null, WHO);
  const noBasis   = ST.reopenPeriod('2026-05', {no: ORD.no}, WHO);
  const noWho     = ST.reopenPeriod('2026-05', ORD, '');
  const notClosed = ST.reopenPeriod('2026-08', ORD, WHO);
  const noRow     = ST.reopenPeriod('2026-09', ORD, WHO);
  const may143    = ST.calendar().find(p => p.month === '2026-05');
  ok(143, !noOrder.ok && has(noOrder.why, 'распоряжени') && has(noOrder.why, 'ИС-50') &&
        has(noOrder.why, 'ADR-0204 §4') && has(noOrder.why, 'ADR-0157 §6') &&
        !noBasis.ok && has(noBasis.why, 'основание') &&
        !noWho.ok && has(noWho.why, 'ИС-9') &&
        !notClosed.ok && has(notClosed.why, 'и так открыт') &&
        !noRow.ok && has(noRow.why, 'в справочнике нет') &&
        Object.keys(may143.latches).length === 3 && mFixed('2026-05') > 0 &&
        ST.state.log.length === 0 && !may143.reopens,
    `распоряжение — единственное, чем перезакрытие отличается от молчаливой правки, и без него дверь не открывается: «${why(noOrder).slice(0, 104)}…». Номер без основания тоже отбит («${why(noBasis).slice(0, 58)}…»): номер отвечает «чем разрешено», основание — «почему», и отвечать вторым придётся получателю сданного (ADR-0157 §6). Актор обязателен ровно как при простановке (ИС-9). Открытый август перезакрывать нечего, а строки сентября нет вовсе — это РАЗНЫЕ отказы. И ни один отказ ничего не сдвинул: колонок мая по-прежнему ${Object.keys(may143.latches).length}, строки зафиксированы, журнал пуст (${ST.state.log.length}) — «тихого» перезакрытия не бывает даже неудачного`);

  /* #144 — сброс СВЕРХУ ВНИЗ, и строки после него расфиксированы: «переписать» иначе слово. */
  ST.seed();
  const lower = ST.openLayer('2026-05', 'учёт', ORD, WHO);
  const mid   = ST.openLayer('2026-05', 'классификация', ORD, WHO);
  const fixedBefore = mFixed('2026-05');
  const re    = ST.reopenPeriod('2026-05', ORD, WHO);
  const may144 = ST.calendar().find(p => p.month === '2026-05');
  const fixedAfter = mFixed('2026-05');
  const shapeOk = ST.state.rows.every(r => 'fixed' in r);
  /* Волна 17: «пишет снова» доказывается НЕ числом написанных строк. При разрежённом
     хранении (ИС-45) повторный прогон по неизменившемуся миру не пишет ни одной строки —
     и это верно: переписать в то же самое значит не переписывать. Расфиксация видна в
     другом: прогон теперь РАССМАТРИВАЕТ эти строки и находит их неизменными (same),
     а не пропускает как зафиксированные (kept). Контрфакт исполняется, а не
     предполагается: метка ставится обратно руками, и тот же прогон уходит в kept. */
  const reRun = ST.run('2026-05-31', {});
  ST.state.rows.forEach(r => { if(r.date.slice(0, 7) === '2026-05')
    r.fixed = {period:'2026-05', at: TODAY, by: WHO}; });
  const keptRun = ST.run('2026-05-31', {});
  ST.state.rows.forEach(r => { if(r.date.slice(0, 7) === '2026-05') r.fixed = null; });
  ok(144, !lower.ok && lower.blockedBy === 'статистика' && has(lower.why, 'СВЕРХУ ВНИЗ') &&
        !mid.ok && mid.blockedBy === 'статистика' &&
        re.ok && re.opened === 'учёт' && re.reasked.join('|') === 'статистика|классификация' &&
        re.dropped.join('|') === 'статистика|классификация|учёт' &&
        Object.keys(may144.latches).length === 0 &&
        fixedBefore > 0 && fixedAfter === 0 && re.unfixed === fixedBefore && shapeOk &&
        ST.isClosed('2026-05-31') === false && ST.openPeriod('учёт') === '2026-05' &&
        reRun.ok && reRun.kept === 0 && reRun.same === fixedBefore && reRun.written === 0 &&
        keptRun.ok && keptRun.kept === fixedBefore && keptRun.same === 0 &&
        ST.state.log.some(l => has(l.msg, ORD.no) && has(l.msg, 'перезакрыт')),
    `сброс идёт СВЕРХУ ВНИЗ, и обратный порядок отбит поимённо: снять «учёт», не сняв «${lower.blockedBy}», нельзя — «${why(lower).slice(0, 96)}…». Иначе период оказался бы открыт для записи под уже проставленной верхней колонкой, и «закрыт» с «открыт» были бы верны одновременно, а верхний слой — подписан под числами, которых не видел (ADR-0204 §3 и §4). Перезакрытие сняло ${re.dropped.length} колонки в одном акте, но названы они по-разному: открылся «${re.opened}», а «${re.reasked.join('», «')}» переспрашивают — верхние слои не открываются НИКОГДА (§4). Строки расфиксированы (${fixedBefore} → ${fixedAfter}), поле fixed обнулено, а не удалено (форма строки закрыта, ИС-15), и прогон за 31.05 снова ДЕРЖИТ их в руках: рассмотрено ${reRun.same}, пропущено как зафиксированные ${reRun.kept}. Написано при этом ноль — мир не менялся, а переписать в то же самое значит не переписывать (ИС-45). Что дело именно в расфиксации, проверено контрфактом, а не обещано: вернули метку руками — и тот же прогон ушёл в kept целиком (${keptRun.kept} из ${fixedBefore}, рассмотрено ${keptRun.same}). Без расфиксации «переписать» осталось бы словом. Акт лёг в журнал с номером распоряжения — тихого перезакрытия не бывает (ИС-50)`);

  /* #145 — повторная простановка СНИЗУ ВВЕРХ тем же closeLayer, и колонка несёт распоряжение. */
  ST.seed();
  const keysFirst = Object.keys(ST.latch('2026-05', 'статистика')).join(',');
  const atFirst = ST.latch('2026-05', 'учёт').at;
  ST.reopenPeriod('2026-05', ORD, WHO);
  const topFirst = ST.closePeriod('2026-05', STA);
  const u1 = ST.closeLayer('2026-05', 'учёт', WHO, TODAY);
  const c1 = ST.closeLayer('2026-05', 'классификация', CLS, TODAY);
  const s1 = ST.closePeriod('2026-05', STA);
  const may145 = ST.calendar().find(p => p.month === '2026-05');
  const keysAgain = Object.keys(may145.latches['статистика']).join(',');
  ok(145, keysFirst === 'by,at' && keysAgain === 'by,at,order' &&
        !topFirst.ok && topFirst.blockedBy === 'учёт' &&
        u1.ok && c1.ok && s1.ok && s1.fixed > 0 &&
        LAY.every(L => may145.latches[L].order === ORD.no) &&
        may145.latches['учёт'].at === TODAY && atFirst !== TODAY &&
        ST.isClosed('2026-05-31') === true && ST.openPeriod() === '2026-07' &&
        ST.fixationOfMonth('2026-05').at === TODAY,
    `повторная простановка идёт СНИЗУ ВВЕРХ и той же дверью, что первая: через голову учёта статистика по-прежнему отказывает и называет слой («${topFirst.blockedBy}»), а пройдя по порядку — фиксирует строки заново (${s1.fixed}). Второго механизма закрытия не завелось: перезакрытие сняло защёлки и ушло, закрывают те же люди тем же действием. Колонка при ПЕРВОМ закрытии несла «${keysFirst}», при повторном несёт «${keysAgain}» (${may145.latches['учёт'].order}): дата простановки сменилась с ${atFirst} на ${TODAY}, и без номера распоряжения «май закрыт 21 августа» не отличить от опоздавшего первого закрытия — а это разные вещи, и у второго есть подписанное основание, которое получатель сданного вправе спросить (ADR-0204 §1, ИС-50, ADR-0157 §6)`);

  /* #146 — выпуск ПОМЕЧЕН, но не переиздан; выпуск на другой период не тронут. */
  ST.seed();
  const jMay = ST.exportJob({obj:'obj-credit', date:'2026-05-31', filter: null});
  const jAug = ST.exportJob({obj:'obj-repay', date: ASK, filter: null});
  const snap = ST.exportsList().map(j => ({id: j.id, n: j.n, file: j.file, state: j.state,
    by: j.by, at: j.at, p: JSON.stringify(j.passport)}));
  const re146 = ST.reopenPeriod('2026-05', ORD, WHO);
  const after = ST.exportsList();
  const eMay = after.find(j => j.id === jMay.job.id);
  const eAug = after.find(j => j.id === jAug.job.id);
  const mk = ((eMay && eMay.marks) || [])[0] || {};
  const untouched = after.length === snap.length && after.every(j => {
    const b = snap.find(x => x.id === j.id);
    return b && b.n === j.n && b.file === j.file && b.state === j.state && b.by === j.by &&
           b.at === j.at && b.p === JSON.stringify(j.passport);
  });
  ok(146, jMay.ok && jAug.ok && re146.ok &&
        re146.marked.length === 1 && re146.marked[0] === eMay.id &&
        (eMay.marks || []).length === 1 && mk.order === ORD.no &&
        mk.basis === ORD.basis && mk.period === '2026-05' &&
        mk.at === TODAY && has(mk.why, 'после сдачи') &&
        !(eAug.marks && eAug.marks.length) && untouched,
    `выпуск, собранный на числах перезакрытого мая, ПОМЕЧЕН — и только помечен: «${mk.why || '(пометки нет)'}». Ни номер (${eMay.id}), ни файл, ни число строк (${eMay.n}), ни паспорт не изменились (${untouched}) — числа мёрзнут ОДИН раз (ИО-4), и пересобрать сданное задним числом значило бы завести второй экземпляр того, что уже подписано. Переиздавать корректирующей выгрузкой или нет — решение человека (ИО-34, ADR-0157 §5): метка не отзывает сданное, она не даёт молча считать его верным. Выпуск за ${ASK.slice(8, 10)}.${ASK.slice(5, 7)} (открытый август) не тронут: метится только затронутый период, иначе шум там, где сравнивать не с чем (ADR-0157 §7)`);

  /* #147 — верхние слои не открываются НИКОГДА, и пометки накапливаются, а не заменяются. */
  ST.seed();
  const O2 = {no:'РП-204 от 21.08.2026', basis:'предписание внутреннего аудита № 7'};
  ST.exportJob({obj:'obj-credit', date:'2026-05-31', filter: null});
  const close5 = () => { ST.closeLayer('2026-05', 'учёт', WHO, TODAY);
                         ST.closeLayer('2026-05', 'классификация', CLS, TODAY);
                         return ST.closePeriod('2026-05', STA); };
  ST.reopenPeriod('2026-05', ORD, WHO); close5();
  const ord1 = ST.latch('2026-05', 'статистика').order;
  const re2 = ST.reopenPeriod('2026-05', O2, WHO); close5();
  const ord2 = ST.latch('2026-05', 'статистика').order;
  const marks = ST.exportsList()[0].marks || [];
  /* Поштучное снятие на июне: у ВЕРХНЕГО слоя снятие — переспрос, у нижнего — открытие. */
  const up = ST.openLayer('2026-06', 'статистика', O2, WHO);
  const upLog = lastLog();
  const cl = ST.openLayer('2026-06', 'классификация', O2, WHO);
  const clLog = lastLog();
  const bs = ST.openLayer('2026-06', 'учёт', O2, WHO);
  const bsLog = lastLog();
  ok(147, ord1 === ORD.no && re2.ok && ord2 === O2.no &&
        marks.length === 2 && marks[0].order === ORD.no && marks[1].order === O2.no &&
        up.ok && up.opened === false && has(upLog, 'переспрос') && !has(upLog, 'ОТКРЫТ') &&
        cl.ok && cl.opened === false && has(clLog, 'переспрос') && !has(clLog, 'ОТКРЫТ') &&
        bs.ok && bs.opened === true && has(bsLog, 'ОТКРЫТ') && has(bsLog, O2.no),
    `тонкость ADR-0204 §4 исполняется, а не пересказывается: снятие защёлки «статистика» и «классификация» открытием НЕ называется («${upLog.slice(0, 88)}…») — верхние слои не открываются никогда, они переспрашивают и защёлкиваются заново; открывается ровно один слой, нижний («${bsLog.slice(0, 60)}…»). Иначе через год «сняли защёлку классификации» прочтут как «открыли период классификации», и вернётся ровно тот вопрос, который ADR закрывал. Перезакрытие повторяемо: колонка несёт ПОСЛЕДНЕЕ распоряжение (${ord1} → ${ord2}), а у выпуска пометок ${marks.length} — вторая не затирает первую, потому что сданное расходилось дважды и по разным основаниям (ИС-50, ADR-0157 §5)`);
})();

/* ---------- АБ. Волна 17 ч.3: разрез несёт ОБЪЕКТ ОПРЕДЕЛЕНИЯ (ИС-40, ADR-0206) ----------
   Имя разреза называет признак и молчит о том, ЧЕЙ это признак. «Область» у заёмщика своя
   (регистрация субъекта), у кредита своя (область выдачи), и для человека из Оша, взявшего
   кредит в бишкекском филиале, это РАЗНЫЕ значения. Пока в реестре лежала одна запись
   «Территория», система обязана была выбрать трактовку молча — и выбирала разную в разных
   местах: срез кредитов, отфильтрованный «по области», расходился со срезом заёмщиков, и
   расхождение выглядело арифметической ошибкой. Объяснить его было нечем: ИМЯ ВРЁТ — ровно
   хвост §15 п. 4 канона. Лечится не подписью в отчёте и не параметром запроса, а восьмым
   реквизитом породы «разрез»: объект определения обязателен, имя уточняется им, а сложение
   по разрезу законно только внутри его объекта (ADR-0206 §2, §3).
   Проверяется здесь не наличие поля, а то, что на нём стоят ДВЕРИ: реестр, состав объекта,
   группировка и фильтр. Поле без дверей — обещание в примечании. */
(() => {
  ST.seed();
  const st = ST.state;
  const total0 = st.dims.length;

  /* #148 — реквизит обязателен, и дверь объясняет ПОЧЕМУ, а не отвечает «нельзя». */
  const noObj  = st.dims.filter(d => !d.obj);
  const ghost  = st.dims.filter(d => !ST.OBJ(d.obj));
  const anyObj = st.dims.filter(d => d.obj === '*' || d.obj === 'любой');
  const bare   = ST.addDim({dates:1, id:'d-t1', name:'Территория', src:'поле', key:'region', perObject:'одно'});
  const star   = ST.addDim({dates:1, id:'d-t2', obj:'*', name:'Территория чего-нибудь', src:'поле',
    key:'region', perObject:'одно'});
  const nowhere = ST.addDim({dates:1, id:'d-t3', obj:'obj-nope', name:'Территория ниоткуда', src:'поле',
    key:'region', perObject:'одно'});
  const good   = ST.addDim({dates:1, id:'d-t4', obj:'obj-credit', name:'Территория залоговой заявки',
    src:'поле', key:'region', perObject:'одно'});
  ok(148, noObj.length === 0 && ghost.length === 0 && anyObj.length === 0 &&
        !bare.ok && has(bare.why, 'имя врёт') && has(bare.why, 'ИС-40') &&
        !star.ok && has(star.why, 'признак всегда') &&
        !nowhere.ok && has(nowhere.why, 'ссылка на запись реестра') && good.ok,
    `объект определения — ВОСЬМОЙ реквизит породы «разрез», и он обязателен: записей без него 0 из ${total0}, с несуществующим объектом 0, с «любым объектом» 0. Дверь не пускает и НАЗЫВАЕТ причину: «${String(bare.why).slice(0, 96)}…» — это не «поле не заполнено», а объяснение, чем кончится незаполненное. «Любой объект» отбит отдельно: признак всегда чей-то, ничейного не бывает. Объект определения — ссылка на запись реестра, а не свободное имя (ИС-18): иначе разрез сослался бы на объект, которого нет, и отвечал бы неизвестно про что (ИС-40, ADR-0206 §2)`);

  /* #149 — одноимённых записей в реестре нет; правило одно на ОБЕ породы (ADR-0206 §6). */
  ST.seed();
  const nD = ST.state.dims.length, nI = ST.state.indicators.length;
  const pool = ST.state.dims.map(d => ({r:d, k:'разрез'}))
    .concat(ST.state.indicators.map(i => ({r:i, k:'показатель'})));
  const clash = [];
  pool.forEach((a, i) => pool.slice(i + 1).forEach(b => {
    if(a.r.name === b.r.name) clash.push({a, b, cross: a.r.obj !== b.r.obj, kinds: a.k !== b.k});
  }));
  const dimClash = clash.filter(c => c.a.k === 'разрез' && c.b.k === 'разрез');
  const indClash = clash.filter(c => c.a.k === 'показатель' && c.b.k === 'показатель');
  const bareName = ST.state.dims.filter(d =>
    ['Территория','Область','Подразделение','Куратор','Отрасль','Валюта договора'].indexOf(d.name) >= 0);
  const takenD = ST.addDim({dates:1, id:'d-t5', obj:'obj-collateral', name:'Территория заёмщика', src:'поле',
    key:'region', perObject:'одно'});
  const takenI = ST.addIndicator({dates:1, id:'m-t6', obj:'obj-case', name:'Территория заёмщика', src:'поле',
    key:'region', type:'перечисление'});
  const crossKind = ST.addDim({dates:1, id:'d-t7', obj:'obj-collateral', name:'Требования, обеспеченные залогом',
    src:'поле', key:'region', perObject:'одно'});
  const okName = ST.addDim({dates:1, id:'d-t8', obj:'obj-collateral', name:'Территория оценщика', src:'поле',
    key:'region', perObject:'одно'});
  ok(149, dimClash.length === 0 && indClash.length === 0 && bareName.length === 0 &&
        clash.length === 1 && clash[0].kinds && !clash[0].cross &&
        !takenD.ok && has(takenD.why, 'в реестре занято') && has(takenD.why, 'Заёмщик') &&
        !takenI.ok && has(takenI.why, 'в реестре занято') &&
        !crossKind.ok && has(crossKind.why, 'm-csec') && okName.ok,
    `одноимённых записей в реестре нет ни при каких объектах: среди ${nD} разрезов совпадений имён 0, среди ${nI} показателей 0, голых «Территория» · «Подразделение» · «Куратор» 0. Уцелела ровно одна пара имён — «${clash[0].a.r.name}» у разреза и показателя ОДНОГО объекта, читающих ОДНУ клетку шва: это одна величина в двух породах, а не две под одним именем (ADR-0185 §3, ADR-0209). Дверь отбивает занятое имя и называет ВЛАДЕЛЬЦА: «${String(takenD.why).slice(0, 80)}…»; правило одно на обе породы — показателю «Территория заёмщика» отказано так же (ADR-0206 §6), и разрезу под именем суммы тоже: два числа, которые нельзя сложить, — два имени, а не одно с оговоркой в примечании`);

  /* #150 — один справочник значений, РАЗНАЯ дорога до него (ADR-0206 §5, ADR-0176 §7). */
  ST.seed();
  const cR = ST.DIM('d-region'), bR = ST.DIM('d-bregion');
  const geo = ST.state.dims.filter(d => d.owner === 'Справочник административного деления');
  const forks = {};
  ST.state.dims.filter(d => d.owner && d.levels).forEach(d => {
    (forks[d.owner] = forks[d.owner] || new Set()).add(JSON.stringify(d.levels) + '|' + (d.ref || ''));
  });
  const twoHier = Object.keys(forks).filter(k => forks[k].size > 1);
  const sameRoad = (a, b) => a.src === b.src && a.key === b.key && a.obj === b.obj;
  const sameDict = cR.owner === bR.owner &&
        JSON.stringify(cR.levels) === JSON.stringify(bR.levels);
  const cSet = ST.statSlice({obj:'obj-credit',   dims:['d-region'],  inds:['a-count'], date: ASK});
  const bSet = ST.statSlice({obj:'obj-borrower', dims:['d-bregion'], inds:['a-count'], date: ASK});
  const cKeys = cSet.groups.map(g => g.key).sort().join('|');
  const bKeys = bSet.groups.map(g => g.key).sort().join('|');
  ok(150, cR.id !== bR.id && cR.name !== bR.name && cR.obj !== bR.obj && sameDict &&
        geo.length === 6 && twoHier.length === 0 && cKeys === bKeys && !sameRoad(cR, bR),
    `записей ${geo.length} — справочник ОДИН: у «${cR.name}» и «${bR.name}» совпадают владелец («${cR.owner}») и уровни (${cR.levels.map(l => l.name).join(' → ')}) знак в знак, а списки областей, добытые двумя РАЗНЫМИ дорогами, совпали: ${cKeys}. Второго экземпляра иерархии не заведено ни одного — у каждого владельца справочника ровно одна (расщеплённых ${twoHier.length}): иначе на «сколько районов в области» нашлось бы два ответа, и оба были бы честны (ADR-0176 §7). Объект определения меняет ДОРОГУ до значения, а не список значений (ADR-0206 §5) — потому дублируется запись реестра, а не справочник`);

  /* #151 — на одном человеке значения расходятся ЗАКОННО, и это читается из имён. */
  ST.seed();
  const bRows = ST.statRows({obj:'obj-borrower', date: ASK}).rows;
  const cRows = ST.statRows({obj:'obj-credit',   date: ASK}).rows;
  const lvl1  = v => [].concat(v)[0];
  const man   = bRows.find(r => r.ref === '22903197505433');
  const mine  = cRows.filter(r => r.dims['d-binn'] === '22903197505433');
  const mineR = mine.map(r => lvl1(r.dims['d-region']));
  const manR  = lvl1(man.dims['d-bregion']);
  const cGr = ST.statSlice({obj:'obj-credit',   dims:['d-region'],  inds:['a-count'], date: ASK});
  const bGr = ST.statSlice({obj:'obj-borrower', dims:['d-bregion'], inds:['a-count'], date: ASK});
  const cnt = (s, k) => ((s.groups.find(g => g.key === k) || {}).values || {})['a-count'].v;
  const shapeC = cGr.groups.map(g => g.key + ':' + g.values['a-count'].v).join(' · ');
  const shapeB = bGr.groups.map(g => g.key + ':' + g.values['a-count'].v).join(' · ');
  ok(151, manR === 'Ошская' && mine.length === 2 &&
        mineR.indexOf('Ошская') >= 0 && mineR.indexOf('Чуйская') >= 0 &&
        shapeC !== shapeB && cnt(cGr, 'Чуйская') === 4 && cnt(bGr, 'Чуйская') === 3 &&
        cnt(cGr, 'Ошская') === 2 && cnt(bGr, 'Ошская') === 3 &&
        cGr.total['a-count'].v === 8 && bGr.total['a-count'].v === 8,
    `случай, ради которого всё это и заведено, в мире ЕСТЬ: у заёмщика ${man.ref} область ${manR}, а его кредиты выданы в ${mineR.join(' и ')} — ${mine.map(r => r.ref).join(', ')}. Один человек лежит в группе «Ошская» среза заёмщиков, а его кредит — в группе «Чуйская» среза кредитов, и это не ошибка данных, а два разных признака. Группировки поэтому РАЗНЫЕ: кредиты ${shapeC}; заёмщики ${shapeB}. Различает их ИМЯ разреза — «${cR.name}» против «${bR.name}», — а не расхождение чисел: итог у обоих срезов 8, и совпадение это ровно ничего не доказывает (ИС-40, ADR-0206 §1)`);

  /* #152 — чужой разрез не берётся в состав объекта, и дверей на это ДВЕ. */
  ST.seed();
  const alienObj = ST.addObject({id:'obj-guarantee', name:'Поручительство', plural:'поручительства',
    owner:'Обеспечение', refName:'номер поручительства', born:{src:'поле', key:'gdate'},
    scope:{open:'обеспечение общее'}, dims:['d-bregion'], inds:['a-count']});
  const ownObj = ST.addObject({id:'obj-guarantee', name:'Поручительство', plural:'поручительства',
    owner:'Обеспечение', refName:'номер поручительства', born:{src:'поле', key:'gdate'},
    scope:{open:'обеспечение общее'}, dims:[], inds:['a-count']});
  const ownDim = ST.addDim({dates:1, id:'d-gregion2', obj:'obj-guarantee', name:'Территория поручительства',
    src:'поле', key:'region', perObject:'одно', owner:'Справочник административного деления',
    levels: JSON.parse(JSON.stringify(ST.DIM('d-region').levels))});
  const G = ST.OBJ('obj-guarantee');
  const alienIn = G.dims.filter(d => (ST.DIM(d) || {}).obj !== 'obj-guarantee');
  const orphan = ST.state.objects.filter(o =>
    o.dims.some(d => !ST.DIM(d) || ST.DIM(d).obj !== o.id));
  ok(152, !alienObj.ok && has(alienObj.why, 'Заёмщик') && has(alienObj.why, 'ИС-40') &&
        has(alienObj.why, 'Заведите свою запись') && ownObj.ok && ownDim.ok &&
        G.dims.length === 1 && G.dims[0] === 'd-gregion2' && alienIn.length === 0 &&
        orphan.length === 0,
    `разрез нельзя приложить к ЧУЖОМУ объекту, и отказ называет объект определения поимённо: «${String(alienObj.why).slice(0, 104)}…». Дверей на это две, и закрыты они заодно: состав объекта не берёт чужую запись, а заведение разреза не берёт чужой объект — иначе запрет обходился бы за один шаг (сперва завести объект без разрезов, потом дописать чужой). Свой разрез заводится СВОЕЙ записью и берёт тот же справочник значений; в реестре объектов чужих разрезов в составе 0 из ${ST.state.objects.length} (ИС-40, ADR-0206 §3, §5)`);

  /* #153 — сверка разнообъектных срезов: ЗАПРЕЩЁННАЯ операция, а не подозрительная. */
  ST.seed();
  const alienF = {sets:[{cmps:[{kind:'dim', id:'d-bregion', op:'=', value:'Ошская'}]}]};
  const doors = {
    'срез':     ST.statSlice({obj:'obj-credit', dims:['d-region'], inds:['a-count'], date: ASK, filter: alienF}),
    'строки':   ST.statRows({obj:'obj-credit', date: ASK, filter: alienF}),
    'ряд':      ST.statSeries({obj:'obj-credit', inds:'a-count', dates:[ASK], filter: alienF}),
    'период':   ST.flowBetween({obj:'obj-credit', inds:'m-repaid', from:'2026-07-15', to: ASK, filter: alienF}),
    'выгрузка': ST.exportJob({obj:'obj-credit', date: ASK, filter: alienF})
  };
  const shut = Object.keys(doors).filter(k => !doors[k].ok &&
    has(doors[k].why, 'ИС-40') && has(doors[k].why, 'Заёмщик'));
  const mute = Object.keys(doors).every(k => !doors[k].groups && !doors[k].total &&
    !doors[k].rows && doors[k].value == null);
  const byDim = ST.statSlice({obj:'obj-credit', dims:['d-bregion'], inds:['a-count'], date: ASK});
  const legal = ST.statSlice({obj:'obj-credit', dims:['d-region'], inds:['a-count'], date: ASK,
    filter: F(cD('d-region', '=', {value:'Чуйская'}))});
  ok(153, shut.length === 5 && mute && !byDim.ok && has(byDim.why, 'ADR-0206 §3') &&
        has(byDim.why, 'Территория выдачи кредита') && has(byDim.why, 'не сверяются') &&
        legal.ok && legal.total['a-count'].v === 4,
    `сравнение срезов по разнообъектным разрезам — операция ЗАПРЕЩЁННАЯ, а не подозрительная (ADR-0206 §4): чужой разрез отбивают все ${shut.length} дверей — ${shut.join(' · ')} — и отбивают ОДИНАКОВО, потому что ворота стоят в общей проверке вопроса, а не в каждой двери отдельно. Ни одна не возвращает при этом чисел (${mute}): сверять нечего в принципе, а не «результат помечен как сомнительный» — иначе кто-нибудь сверил бы и объяснил расхождение округлением. Группировка чужим разрезом отбита тем же правилом и называет дорогу — «…${String(byDim.why).slice(-92)}». Свой разрез в том же вопросе считается: Чуйская — ${legal.total['a-count'].v} кредита`);

  /* #154 — сложение по разрезу законно ТОЛЬКО внутри его объекта (ADR-0174 механически). */
  ST.seed();
  const sums = [];
  ST.state.dims.forEach(d => {
    const o = ST.OBJ(d.obj);
    if(!o || o.dims.indexOf(d.id) < 0) return;
    const s = ST.statSlice({obj:o.id, dims:[d.id], inds:['a-count'], date: ASK});
    if(!s.ok || !s.groups.length) return;
    const g = s.groups.reduce((n, x) => n + x.values['a-count'].v, 0);
    sums.push({dim:d.id, obj:o.id, ok: g === s.total['a-count'].v, n: s.total['a-count'].v});
  });
  const brokenSum = sums.filter(x => !x.ok);
  const foreign = ST.state.dims.filter(d => {
    const o = ST.OBJ(d.obj);
    return !o || o.dims.indexOf(d.id) < 0;
  });
  ok(154, sums.length >= 20 && brokenSum.length === 0 && foreign.length === 0,
    `требование ADR-0174 «свод равен сумме одиночных» проверяется теперь МЕХАНИЧЕСКИ, потому что есть по чему: сумма берётся по тому объекту, который назвал разрез. Проверено ${sums.length} пар «разрез + его объект» — расхождений ${brokenSum.length}${brokenSum.length ? ' (' + brokenSum.map(x => x.dim).join(', ') + ')' : ''}. Ни одного разреза, объявленного на объекте и в состав этого объекта не вошедшего, нет (${foreign.length}): объект определения и состав — одна и та же связь, прочитанная с двух сторон, и разъехаться им нечем. Сложение по разрезу законно только внутри его объекта — за границей объекта складывать было бы можно лишь потому, что имена совпали (ИС-40, ADR-0206 §3)`);
})();

/* ---------- АВ. Волна 17 ч.4: реестр ОДИН, запись объявляет ПОРОДУ (ИС-43, ADR-0209) -------
   Реквизиты записи прирастали по одному и в разных решениях: источник объявил ADR-0150,
   правило свода — ADR-0174, уровни и корзины — ADR-0176, дедуп-ключ — ADR-0199,
   исчислимость — ADR-0159, объект определения — ADR-0206. Ни одно из них не сказало, ЧЕМ
   запись является целиком, и обязательность реквизита оказалась свойством ДВЕРИ: что
   спрашивал `addDim`, то у разреза и было обязательным. Двери писались в разные волны, и
   одна успела спросить объект определения, а другая — нет; разница жила до дня, когда её
   заметили. ADR-0209 объявляет породу ОБЪЯВЛЕННЫМ реквизитом: пород ровно две, кладовая
   одна, список реквизитов закрыт с обеих сторон, проверка одна.
   Проверяется здесь не наличие полей, а то, что порода что-то РЕШАЕТ: чужой реквизит
   отбит по имени, формулы нет ни у одной породы, переезд сохраняет запись и историю,
   прекращение — дата, а не стирание, и схема витрины растёт только вперёд. */
(() => {
  ST.seed();
  const st = ST.state;
  const KINDS = vm.runInContext('KINDS', sandbox);
  const reg = ST.registry();

  /* #155 — кладовая ОДНА, а `st.dims`/`st.indicators` — виды, которые ничего не хранят. */
  const noKind = reg.filter(r => KINDS.indexOf(r.kind) < 0);
  const nInd = reg.filter(r => r.kind === 'показатель').length;
  const nDim = reg.filter(r => r.kind === 'разрез').length;
  const own  = Object.keys(st).filter(k => k === 'dims' || k === 'indicators');
  const dDesc = Object.getOwnPropertyDescriptor(st, 'dims');
  const iDesc = Object.getOwnPropertyDescriptor(st, 'indicators');
  const n0 = st.registry.length;
  st.dims.push({kind:'разрез', id:'d-ghost', name:'Призрак признака', obj:'obj-credit', src:'поле', key:'k'});
  st.indicators.push({kind:'показатель', id:'m-ghost', name:'Призрак числа', obj:'obj-credit'});
  const ghost = st.registry.length === n0 && !ST.REC('d-ghost') && !ST.REC('m-ghost');
  const third = ST.addRecord({dates:1, kind:'свод', id:'x-roll', name:'Свод портфеля', obj:'obj-credit',
    src:'поле', key:'k'});
  const bare  = ST.addRecord({dates:1, id:'x-none', name:'Запись без породы', obj:'obj-credit',
    src:'поле', key:'k'});
  ok(155, noKind.length === 0 && nInd + nDim === reg.length && own.length === 0 &&
        typeof dDesc.get === 'function' && dDesc.value === undefined &&
        typeof iDesc.get === 'function' && iDesc.value === undefined && ghost &&
        ST.IND('d-branch') === undefined && ST.DIM('m-odays') === undefined &&
        !third.ok && has(third.why, 'ИС-43') && has(third.why, 'третьей породы') &&
        !bare.ok && has(bare.why, 'ADR-0209'),
    `кладовая ОДНА: ${reg.length} записей, из них ${nInd} породы «показатель» и ${nDim} породы «разрез», без породы — ${noKind.length}. Складов больше нет: `+"`st.dims`"+` и `+"`st.indicators`"+` не поля состояния, а ВИДЫ (собственных полей с такими именами ${own.length}, у обоих есть геттер и нет значения) — положить запись «в разрезы» физически некуда, и брошенная в вид запись исчезает (реестр остался ${n0}, `+"`REC('d-ghost')`"+` пуст). До ADR-0209 порода была СЛЕДСТВИЕМ места хранения, и запись, попавшая не в тот массив, меняла породу молча. Теперь `+"`IND`"+` и `+"`DIM`"+` — чтение одного хранилища с проверкой ОБЪЯВЛЕННОЙ породы: разрез через дверь показателя не читается и наоборот. Третьей породы нет: «${String(third.why).slice(0, 84)}…» (ИС-43, ADR-0209, «Границы»)`);

  /* #156 — общие реквизиты (§1) есть у КАЖДОЙ записи обеих пород, а не у той, чья дверь их спросила. */
  ST.seed();
  const R2 = ST.registry();
  const need = ['id','kind','name','obj','since','access'];
  const gaps = need.map(k => ({k, n: R2.filter(r => !r[k]).length})).filter(x => x.n);
  const declared = ['until','note'].map(k => ({k, n: R2.filter(r => !(k in r)).length})).filter(x => x.n);
  const noHist = R2.filter(r => !Array.isArray(r.history) || !r.history.length ||
    r.history[0].what !== 'заведена');
  const bothOK = KINDS.every(k => R2.filter(r => r.kind === k)
    .every(r => r.since && r.access && ('until' in r) && ('note' in r)));
  const noName = ST.addIndicator({dates:1, id:'m-n1', obj:'obj-credit', src:'поле', key:'k',
    type:'сумма', unit:'сом'});
  const noObjI = ST.addIndicator({dates:1, id:'m-n2', name:'Проба без объекта', src:'поле', key:'k',
    type:'сумма', unit:'сом'});
  const noObjD = ST.addDim({dates:1, id:'d-n3', name:'Проба без объекта два', src:'поле', key:'k',
    perObject:'одно'});
  const born = ST.addIndicator({dates:1, id:'m-n4', name:'Проба даты заведения', obj:'obj-credit',
    src:'поле', key:'k', type:'сумма', unit:'сом'});
  const N4 = ST.IND('m-n4');
  ok(156, gaps.length === 0 && declared.length === 0 && noHist.length === 0 && bothOK &&
        !noName.ok && has(noName.why, 'наименование') &&
        !noObjI.ok && has(noObjI.why, 'ИС-18') && !noObjD.ok && has(noObjD.why, 'ИС-40') &&
        born.ok && N4.since === ST.state.today && N4.until === null &&
        ST.actsOn('m-n4', ST.state.today) === true && ST.actsOn('m-n4', '2026-07-01') === false,
    `семь общих реквизитов (§1) стоят у КАЖДОЙ из ${R2.length} записей обеих пород: пустых среди обязательных ${gaps.length}, необъявленных среди «может быть пусто» ${declared.length}, без истории ${noHist.length}. Пустой реквизит и отсутствующий — разные вещи: `+"`until: null`"+` значит «не прекращена», а отсутствие ключа значило бы, что вопроса не задавали. Именно этого у показателей до ADR-0209 не спрашивали вовсе — даты заведения; новая запись действует ВПЕРЁД (заведена ${N4.since}, на 01.07 не действует), и прошлое ею не размечается. Отказ общий, а довод у пород разный: показателю — «${String(noObjI.why).slice(0, 52)}…» (ИС-18), разрезу — «${String(noObjD.why).slice(0, 52)}…» (ИС-40). Обязательность стала свойством ПОРОДЫ, а не двери: раньше объект определения спрашивал `+"`addDim`"+`, а `+"`addIndicator`"+` — нет, и разница жила ровно потому, что двери писали в разные волны`);

  /* #157 — реквизиты породы «показатель» (§2): источник · свод · тип и единица · налету · дедуп. */
  ST.seed();
  const IND3 = ST.registry().filter(r => r.kind === 'показатель');
  const ROLLS = vm.runInContext('ROLLS', sandbox);
  const FLAT  = vm.runInContext('FLAT_TYPES', sandbox);
  const badSrc  = IND3.filter(r => ['шов','поле','агрегат'].indexOf(r.src) < 0);
  const badRoll = IND3.filter(r => ROLLS.indexOf(r.roll) < 0);
  const noType  = IND3.filter(r => !ST.typeOf(r.id));
  const noUnit  = IND3.filter(r => FLAT.indexOf(ST.typeOf(r.id)) < 0 && !ST.unitOf(r.id));
  const noSrc   = ST.addIndicator({dates:1, id:'m-i1', name:'Проба без источника', obj:'obj-credit',
    type:'сумма', unit:'сом'});
  const myRoll  = ST.addIndicator({dates:1, id:'m-i2', name:'Проба со своим сводом', obj:'obj-credit',
    src:'поле', key:'k', type:'сумма', unit:'сом', roll:'по-своему'});
  const mute    = ST.addIndicator({dates:1, id:'m-i3', name:'Проба без типа', obj:'obj-credit',
    src:'поле', key:'industry'});
  const noU     = ST.addIndicator({dates:1, id:'m-i4', name:'Проба без единицы', obj:'obj-credit',
    src:'поле', key:'k', type:'сумма'});
  const live    = ST.addIndicator({dates:1, id:'m-i5', name:'Проба исчислимости', obj:'obj-credit',
    src:'поле', key:'k', type:'сумма', unit:'сом', live:false});
  const dedup   = ST.addIndicator({dates:1, id:'a-i6', name:'Проба дедупа', obj:'obj-credit',
    src:'агрегат', fn:'sum', over:'m-odays', dedupBy:'d-branch'});
  const agg     = ST.addIndicator({dates:1, id:'a-i7', name:'Проба наследования', obj:'obj-credit',
    src:'агрегат', fn:'sum', over:'m-odays'});
  const A = ST.IND('a-i7');
  ok(157, badSrc.length === 0 && badRoll.length === 0 && noType.length === 0 && noUnit.length === 0 &&
        !noSrc.ok && has(noSrc.why, 'одним из трёх') &&
        !myRoll.ok && has(myRoll.why, 'правило свода') && has(myRoll.why, ROLLS.join(' · ')) &&
        !mute.ok && has(mute.why, 'не определён тип') && has(mute.why, 'ADR-0209 §2') &&
        !noU.ok && has(noU.why, 'не определена единица') &&
        !live.ok && has(live.why, 'исчислимость налету') &&
        !dedup.ok && has(dedup.why, 'СТРОЧНОГО') &&
        agg.ok && ST.typeOf('a-i7') === 'число' && ST.unitOf('a-i7') === 'дн.' &&
        A.roll === 'аддитивный' && A.live === true,
    `пять реквизитов породы «показатель» (§2) стоят у всех ${IND3.length} записей: источник вне закрытых трёх — ${badSrc.length}, правило свода вне трёх — ${badRoll.length}, без определённого типа — ${noType.length}, без единицы при неплоском типе — ${noUnit.length}. «Определён» здесь не значит «подставлен по умолчанию»: у шва и поля тип ОБЪЯВЛЕН, у агрегата НАСЛЕДУЕТСЯ от названной записи — «${A.name}» есть sum по «Дней просрочки», и потому тип ${ST.typeOf('a-i7')}, единица ${ST.unitOf('a-i7')}, свод ${A.roll}, налету ${A.live}. Молчание записи ответом не считается: без типа — отказ, без единицы — отказ («${String(noU.why).slice(0, 74)}…»), потому что число без единицы складывается с любым другим числом без единицы и сумма выйдет всегда. Своё правило свода — та же формула, только в поле правила: «${String(myRoll.why).slice(0, 60)}…» (ИС-43, ADR-0209 §2)`);

  /* #158 — реквизиты породы «разрез» (§3): справочник · уровни и корзины · порядок · объект. */
  ST.seed();
  const DIM4 = ST.registry().filter(r => r.kind === 'разрез');
  const ORDERS = vm.runInContext('ORDERS', sandbox);
  const badOrd  = DIM4.filter(r => ORDERS.indexOf(r.order) < 0);
  const noObj   = DIM4.filter(r => !ST.OBJ(r.obj));
  const refBare = DIM4.filter(r => r.ref && !r.owner);
  const lvlBare = DIM4.filter(r => r.levels && !r.owner && !r.ref);
  const spread  = ORDERS.map(o => o + ' — ' + DIM4.filter(d => d.order === o).length);
  const noWhose = ST.addDim({dates:1, id:'d-d1', name:'Проба ничья', src:'поле', key:'k', perObject:'одно'});
  const alpha   = ST.addDim({dates:1, id:'d-d2', name:'Проба по алфавиту', obj:'obj-credit', src:'поле',
    key:'k', perObject:'одно', order:'по алфавиту'});
  const empty   = ST.addDim({dates:1, id:'d-d3', name:'Проба пустого порядка', obj:'obj-credit', src:'поле',
    key:'k', perObject:'одно', order:'по объявленному порядку'});
  const noOwner = ST.addDim({dates:1, id:'d-d4', name:'Проба без владельца', obj:'obj-credit', src:'поле',
    key:'k', perObject:'одно', ref:'Справочник отраслей'});
  const noPer   = ST.addDim({dates:1, id:'d-d5', name:'Проба без кратности', obj:'obj-credit', src:'поле',
    key:'k'});
  const good    = ST.addDim({dates:1, id:'d-d6', name:'Проба годного разреза', obj:'obj-credit', src:'поле',
    key:'k', perObject:'одно'});
  ok(158, badOrd.length === 0 && noObj.length === 0 && refBare.length === 0 && lvlBare.length === 0 &&
        !noWhose.ok && has(noWhose.why, 'объект определения') &&
        !alpha.ok && has(alpha.why, 'порядок значений объявляется одним из трёх') &&
        !empty.ok && has(empty.why, 'объявлять нечего') &&
        !noOwner.ok && has(noOwner.why, 'владелец его — нет') &&
        !noPer.ok && has(noPer.why, 'ИС-21') &&
        good.ok && ST.DIM('d-d6').order === 'по значению',
    `четыре реквизита породы «разрез» (§3) стоят у всех ${DIM4.length} записей: порядок вне закрытых трёх — ${badOrd.length} (${spread.join(' · ')}), без существующего объекта определения — ${noObj.length}, справочник без владельца — ${refBare.length}, уровни без владельца — ${lvlBare.length}. Порядок не угадывается по данным, а ВЫВОДИТСЯ из объявленного: объявлены корзины или уровни — порядок объявленный, назван справочник — порядок его, не названо ничего — по значению (${ST.DIM('d-d6').order}). Список закрыт: «по алфавиту» и «как в отчёте» — не значения порядка, а разные ответы в разных отчётах; объявленный порядок при пустой записи отбит отдельно — «${String(empty.why).slice(0, 62)}…»: упорядочивают названный список, а не обещание упорядочить (ИС-43, ADR-0209 §3, ADR-0176 §7)`);

  /* #159 — реквизит ЧУЖОЙ породы — отказ по имени, а не необязательное поле. */
  ST.seed();
  const F_IND = vm.runInContext('F_IND', sandbox), F_DIM = vm.runInContext('F_DIM', sandbox);
  const R5 = ST.registry();
  const alienIn = R5.filter(r => (r.kind === 'показатель' ? F_DIM : F_IND).some(k => k in r));
  const unitOnDim = ST.addDim({dates:1, id:'d-a1', name:'Проба с единицей', obj:'obj-credit', src:'поле',
    key:'k', perObject:'одно', unit:'дн.'});
  const lvlOnInd  = ST.addIndicator({dates:1, id:'m-a2', name:'Проба с иерархией', obj:'obj-credit',
    src:'поле', key:'k', type:'сумма', unit:'сом',
    levels:[{name:'область', src:'поле', key:'region'}]});
  const perOnInd  = ST.addIndicator({dates:1, id:'m-a3', name:'Проба с кратностью', obj:'obj-credit',
    src:'поле', key:'k', type:'сумма', unit:'сом', perObject:'одно'});
  const dedOnDim  = ST.addDim({dates:1, id:'d-a4', name:'Проба с дедупом', obj:'obj-credit', src:'поле',
    key:'k', perObject:'одно', dedupBy:'d-branch'});
  const named = [unitOnDim, lvlOnInd, perOnInd, dedOnDim];
  ok(159, alienIn.length === 0 &&
        named.every(r => !r.ok && has(r.why, 'принадлежит породе') && has(r.why, 'ADR-0209')) &&
        has(unitOnDim.why, 'единица измерения') && has(unitOnDim.why, 'показатель') &&
        has(lvlOnInd.why, 'уровни (иерархия)') && has(lvlOnInd.why, 'разрез') &&
        has(perOnInd.why, 'значений на один объект') && has(dedOnDim.why, 'дедуп-ключ') &&
        F_IND.every(k => F_DIM.indexOf(k) < 0),
    `список реквизитов закрыт с ОБЕИХ сторон: ${F_IND.length} у показателя, ${F_DIM.length} у разреза, пересечения нет ни одного, и записей с чужим реквизитом в реестре 0 из ${R5.length}. Чужой реквизит — ОТКАЗ, а не пустое поле в форме: «${String(unitOnDim.why).slice(0, 96)}…». Отказ называет и реквизит по-русски, и породу-владельца, потому что запись с единицей измерения у признака — это запись, про которую не объявлено, чем она должна быть, и проверить в ней нечего не потому, что проверку забыли, а потому, что нечего. Все четыре подмены отбиты одинаково — единица у признака, иерархия у числа, кратность значений у числа, дедуп-ключ у признака (ИС-43, ADR-0209 §1–§3, «Отвергнуто»)`);

  /* #160 — формулы нет НИ У ОДНОЙ породы (§4); корзина исключением не является. */
  ST.seed();
  const FF = vm.runInContext('FORMULA_FIELDS', sandbox);
  const R6 = ST.registry();
  const withF = R6.filter(r => FF.some(k => k in r));
  const fInd  = ST.addIndicator({dates:1, id:'m-f1', name:'Доля просрочки в портфеле', obj:'obj-credit',
    src:'поле', key:'k', type:'сумма', unit:'сом', formula:'m-over / m-debt'});
  const fDim  = ST.addDim({dates:1, id:'d-f2', name:'Проба с выражением', obj:'obj-credit', src:'поле',
    key:'k', perObject:'одно', 'формула':'region == "Чуйская"'});
  const fBkt  = ST.addDim({dates:1, id:'d-f3', name:'Корзина по выражению', obj:'obj-credit', src:'шов',
    seam:'calcDebt', field:'daysOverdue', perObject:'одно', buckets:['ступени'], edges:[1,31],
    basis:'m-odays', expr:'days > 30'});
  const okBkt = ST.addDim({dates:1, id:'d-f4', name:'Корзина по границам', obj:'obj-credit', src:'шов',
    seam:'calcDebt', field:'daysOverdue', perObject:'одно', buckets:['ступени'],
    edges:[1,31,91], basis:'m-odays'});
  ok(160, withF.length === 0 && FF.length >= 4 &&
        [fInd, fDim, fBkt].every(r => !r.ok && has(r.why, 'ADR-0209 §4')) &&
        has(fInd.why, 'ни у показателя, ни у разреза') && has(fInd.why, 'ИС-6') &&
        okBkt.ok && ST.DIM('d-f4').edges.length === 3,
    `поля формулы нет ни у одной породы: ${R6.length} записей × ${FF.length} имён, под которыми выражение пробирается в реестр (${FF.join(', ')}), — совпадений 0. Отказ один на обе породы: «${String(fDim.why).slice(0, 88)}…». Разрез здесь не привилегирован — корзина ИСКЛЮЧЕНИЕМ НЕ ЯВЛЯЕТСЯ: она не выводит новой величины, она раскладывает существующую по объявленным ГРАНИЦАМ, и та же корзина без выражения заводится свободно (${okBkt.ok}, границ ${ST.DIM('d-f4').edges.length}). Разница не косметическая: границы — данные записи, выражение — вторая реализация правила, которая разойдётся с ядром молча и в свой срок (ИС-6, ИС-43, ADR-0150, ADR-0209 §4)`);

  /* #161 — переезд породы: та же запись, тот же идентификатор, история цела. */
  ST.seed();
  const b1 = {n: ST.state.registry.length, mart: ST.mart().length, log: ST.martLog().length};
  const noReq = ST.changeKind('d-industry', 'показатель');
  const same  = ST.changeKind('d-industry', 'разрез');
  const third2 = ST.changeKind('d-industry', 'свод', 'Э.', {});
  const tied  = ST.changeKind('m-odays', 'разрез', 'Э.', {perObject:'одно'});
  const was   = ST.registry().find(r => r.id === 'd-industry');
  const moved = ST.changeKind('d-industry', 'показатель', 'Мамбетов Э.', {type:'перечисление'});
  const now   = ST.REC('d-industry');
  const hist  = now.history[now.history.length - 1];
  const O = ST.OBJ('obj-credit');
  ok(161, !noReq.ok && has(noReq.why, 'порода не сменена') && has(noReq.why, 'не определён тип') &&
        !same.ok && has(same.why, 'переезжать некуда') &&
        !third2.ok && has(third2.why, 'третьей породы') &&
        !tied.ok && has(tied.why, 'ссылаются как на') && has(tied.why, 'корзины разрезов') &&
        moved.ok && moved.was === 'разрез' && moved.dropped.join() === 'order' &&
        now.id === 'd-industry' && now.name === was.name && now.since === was.since &&
        now.kind === 'показатель' && !('order' in now) &&
        now.history.length === was.history.length + 1 && hist.what === 'смена породы' &&
        hist.from === 'разрез' && hist.who === 'Мамбетов Э.' && hist.dropped.join() === 'order' &&
        !!ST.IND('d-industry') && ST.DIM('d-industry') === undefined &&
        O.inds.indexOf('d-industry') >= 0 && O.dims.indexOf('d-industry') < 0 &&
        ST.state.registry.length === b1.n && ST.mart().length === b1.mart &&
        ST.martLog().length === b1.log,
    `переезд породы — рядовая правка настройки, а не заведение новой записи: «${now.name}» ушла из разрезов в показатели, и при этом идентификатор тот же (${now.id}), имя то же, дата заведения та же (${now.since}), история ДОПИСАНА, а не начата заново (${was.history.length} → ${now.history.length}, последняя запись «${hist.what}: ${hist.from} → ${hist.kind}», кем — ${hist.who}). Реквизиты прежней породы сняты ПОИМЁННО (${moved.dropped.join(', ')}), недостающие спрошены — без них отказ, и отказ объясняет чем: «${String(noReq.why).slice(0, 70)}…». Состав объекта переставлен, реестр не вырос (${ST.state.registry.length}), схема витрины не тронута вовсе (${ST.mart().length} колонок, ${ST.martLog().length} строк журнала). Бесплатным переезд не бывает: на запись могли сослаться как на запись СВОЕЙ породы — «${String(tied.why).slice(0, 92)}…», и оборвалась бы такая ссылка молча, на первом прогоне (ИС-7, ИС-43, ADR-0209 §5)`);

  /* #162 — запись не удаляется, а ПРЕКРАЩАЕТ ДЕЙСТВИЕ с даты (§6). */
  ST.seed();
  const b2 = {n: ST.state.registry.length, mart: ST.mart().length, log: ST.martLog().length};
  const cells0 = ST.statRows({obj:'obj-borrower', date: ASK}).rows.filter(r => r.inds['m-bworst']).length;
  const gone = ST.retire('m-bworst', true, 'Мамбетов Э.');
  const G = ST.REC('m-bworst');
  /* Сторож обязан ПАДАТЬ, а не рушиться: стёртая запись — ровно тот случай, который он
     ловит, и на ней он должен дать отказ с доводом, а не TypeError без номера. */
  const gHist = (G && G.history[G.history.length - 1]) || {};
  const gName = G ? G.name : '(запись стёрта)', gUntil = G ? G.until : '(даты нет)';
  const cells1 = ST.statRows({obj:'obj-borrower', date: ASK}).rows.filter(r => r.inds['m-bworst']).length;
  const twice = ST.retire('m-bworst', true);
  ST.addIndicator({dates:1, id:'m-nb', name:'Проба основания корзин', obj:'obj-credit', src:'поле',
    key:'k', type:'число', unit:'дн.'});
  ST.addDim({dates:1, id:'d-nb', name:'Проба корзины над ним', obj:'obj-credit', src:'поле', key:'k',
    perObject:'одно', buckets:['ступени'], edges:[1,31,91], basis:'m-nb'});
  const basis = ST.retire('m-nb', true);
  const keyed = ST.retire('d-clcred', true);
  ok(162, gone.ok && gone.until === ST.state.today && G && G.until === ST.state.today &&
        ST.state.registry.length === b2.n + 2 && ST.mart().length === b2.mart + 2 &&
        gHist.what === 'прекращена' && gHist.who === 'Мамбетов Э.' && !!G &&
        ST.actsOn('m-bworst', ST.state.today) === false &&
        ST.actsOn('m-bworst', '2026-07-01') === true &&
        ST.OBJ('obj-borrower').inds.indexOf('m-bworst') < 0 &&
        !!ST.martCol('m-bworst') && cells0 === cells1 && cells1 > 0 &&
        !twice.ok && has(twice.why, 'вторая дата') &&
        !basis.ok && has(basis.why, 'основание корзин') &&
        !keyed.ok && has(keyed.why, 'дедуп-ключ показателей'),
    `запись из реестра НЕ ИСЧЕЗАЕТ: «${gName}» прекращена с ${gUntil}, но лежит на месте (реестр ${b2.n} → ${ST.state.registry.length} — вырос на две пробные записи, не убыл), колонка витрины цела, и в строках 18.08 её клетка как была заполнена в ${cells0} строках, так и осталась (${cells1}). Стерев запись, мы оставили бы в этих клетках ЧИСЛО БЕЗ ИМЕНИ — прочитать его было бы больше нечем (ИС-4, ADR-0147 §4). Прекращение действует ВПЕРЁД: на сегодня запись не действует, на 01.07 действует, из состава объекта ушла — спрашивать её начиная с сегодня нечем. Дата одна: «${String(twice.why).slice(0, 62)}…». Вывод не бесплатен и там, где на запись ссылаются ПОИМЁННО: основание корзин — «${String(basis.why).slice(0, 56)}…», дедуп-ключ — отказ по той же причине; а ссылки потребителей вывод не запрещают, а обязывают назвать поимённо (#58, ИС-25, ADR-0177 §4)`);

  /* #163 — схема витрины ПОРОЖДЕНА реестром: одна операция, обратного хода нет (§6). */
  ST.seed();
  const mart0 = ST.mart(), log0 = ST.martLog();
  const ops = [...new Set(log0.map(x => x.op))];
  const notNull = mart0.filter(c => c.nullable !== true);
  const orphan  = mart0.filter(c => !ST.REC(c.col));
  const uncol   = ST.state.registry.filter(r => !ST.martCol(r.id));
  const dupOf = arr => arr.filter((x, i) => arr.indexOf(x) !== i);
  const dupCol  = dupOf(mart0.map(c => c.col));
  const unlogged = mart0.filter(c => !log0.some(x => x.op === 'ADD COLUMN' && x.col === c.col));
  const addI = ST.addIndicator({dates:1, id:'m-m1', name:'Проба колонки числа', obj:'obj-credit',
    src:'поле', key:'k', type:'сумма', unit:'сом'});
  const addD = ST.addDim({dates:1, id:'d-m2', name:'Проба колонки признака', obj:'obj-credit',
    src:'поле', key:'k', perObject:'одно'});
  const tail = ST.martLog().slice(-2);
  const grew = ST.mart().length === mart0.length + 2 && ST.martLog().length === log0.length + 2;
  ST.changeKind('d-industry', 'показатель', 'Э.', {type:'перечисление'});
  ST.retire('m-bworst', true, 'Э.');
  const still = ST.mart().length === mart0.length + 2 && ST.martLog().length === log0.length + 2;
  const opsAll = [...new Set(ST.martLog().map(x => x.op))];
  ok(163, ops.length === 1 && ops[0] === 'ADD COLUMN' && notNull.length === 0 &&
        orphan.length === 0 && uncol.length === 0 && dupCol.length === 0 &&
        unlogged.length === 0 && mart0.length === log0.length &&
        addI.ok && addD.ok && addI.col === 'm-m1' && addD.col === 'd-m2' && grew &&
        tail.every(x => x.op === 'ADD COLUMN' && x.nullable === true && x.who && x.why) &&
        still && opsAll.length === 1 && ST.martCol('d-industry').kindAt === 'разрез' &&
        !!ST.martCol('m-bworst'),
    `схема витрины не рисуется отдельно, а ПОРОЖДАЕТСЯ реестром: колонок ${mart0.length} на ${mart0.length} записей, безымянных ${orphan.length}, бесколоночных ${uncol.length}, повторных ${dupCol.length}, незажурналенных ${unlogged.length}. Операция в журнале РОВНО ОДНА на весь модуль — ${opsAll.join(', ')}, и все ${mart0.length} колонок nullable (не nullable — ${notNull.length}). Nullable — не мягкость, а факт: строки, написанные до заведения записи, в этой колонке пусты, и заполнить их задним числом нечем. Новая запись любой породы добавляет колонку той же дверью, что и демо-мир (ADD COLUMN ${addI.col} и ${addD.col}, обе с автором и основанием) — обойди сторож этот путь, он перестал бы что-либо доказывать. Обратного хода нет: ни переезд породы, ни прекращение записи схемы не трогают (${ST.mart().length} колонок — ровно те же, что после двух заведений), колонка помнит породу МОМЕНТА заведения (${ST.martCol('d-industry').kindAt}) и принадлежит записи, а не породе (ИС-43, ADR-0209 §6)`);

  /* #164 — одна величина в двух ролях — ДВЕ записи, связанные явно (§5). */
  ST.seed();
  const I = ST.IND('m-odays'), D = ST.DIM('d-odays');
  const pairs = ST.registry().filter(r => r.basis);
  const tiedOK = pairs.every(d => d.kind === 'разрез' && !!ST.IND(d.basis) &&
    Array.isArray(d.edges) && d.edges.length &&
    d.edges.every((e, i) => !i || e > d.edges[i - 1]));
  const label45  = ST.bucketOf(45, 'ступени', D);
  const label200 = ST.bucketOf(200, 'ступени', D);
  const noEdges = ST.addDim({dates:1, id:'d-b1', name:'Проба основания без границ', obj:'obj-credit',
    src:'поле', key:'k', perObject:'одно', basis:'m-odays'});
  const noBasis = ST.addDim({dates:1, id:'d-b2', name:'Проба границ без основания', obj:'obj-credit',
    src:'поле', key:'k', perObject:'одно', edges:[1, 31, 91]});
  const wrongB  = ST.addDim({dates:1, id:'d-b3', name:'Проба основания не той породы', obj:'obj-credit',
    src:'поле', key:'k', perObject:'одно', basis:'d-branch', edges:[1, 31]});
  const backB   = ST.addDim({dates:1, id:'d-b4', name:'Проба границ задом наперёд', obj:'obj-credit',
    src:'поле', key:'k', perObject:'одно', buckets:['ступени'], edges:[91, 31, 1], basis:'m-odays'});
  ST.state.registry.find(r => r.id === 'd-odays').edges = [1, 61];
  const after = ST.bucketOf(45, 'ступени', ST.DIM('d-odays'));
  ok(164, I.id !== D.id && I.name !== D.name && I.kind !== D.kind && D.basis === I.id &&
        pairs.length === 2 && tiedOK &&
        !('unit' in D) && ST.unitOf('d-odays') === ST.unitOf('m-odays') &&
        label45 === '31–90 дн.' && label200 === '181+ дн.' && after === '1–60 дн.' &&
        !noEdges.ok && has(noEdges.why, 'не назвал границ') &&
        !noBasis.ok && has(noBasis.why, 'основанием') &&
        !wrongB.ok && has(wrongB.why, 'показателем реестра не объявлено') &&
        !backB.ok && has(backB.why, 'по возрастанию'),
    `одна величина в двух ролях — ДВЕ записи, связанные явно, а не одна с оговоркой: «${I.name}» (${I.id}, порода «${I.kind}», источник шва) и «${D.name}» (${D.id}, порода «${D.kind}»), и вторая НАЗЫВАЕТ первую своим основанием. Пар таких ${pairs.length}, и у каждой основание — существующий показатель, а границы возрастают. Границы живут В РЕЕСТРЕ, а не в настройке отчёта: правка записи меняет разметку («${label45}» → «${after}»), тогда как настройка отчёта называет лишь КОРЗИНУ. Иначе «просрочка 31–90» означала бы разное от отчёта к отчёту, и спорить было бы не с чем. Единицы корзина не носит своей — берёт у основания (${ST.unitOf('d-odays')}, собственного реквизита нет), потому что второй записи не за чем спорить, в чём измеряется чужая величина: ${label200} — это дни, названные один раз. Половина связи — отказ: основание без границ, границы без основания, основание чужой породы, границы задом наперёд (ИС-23, ИС-43, ADR-0209 §5)`);
})();

/* ---------- АГ. Одна дата — колонка, много дат — работа анализа (ИС-47, ADR-0220) ------ *
   Что кладётся в строку среза колонкой, решалось до сих пор по частным случаям: сомовый
   эквивалент разбирался отдельно, доли отдельно, курсовая разница отдельно, а «показатель
   изменения остатка» ловился списком подстрок в имени. Список — не критерий: «темп роста
   портфеля» и «миграция из категории в категорию» не содержат ни одного его слова, а
   «Прирост стоимости залога» содержит и при этом законен. ADR-0220 делает критерий
   механическим: запись ОБЪЯВЛЯЕТ, сколько дат среза нужно, чтобы величину вычислить, и
   проверяется это ДО заведения. Одна дата — колонка; две и больше — не колонка никогда,
   потому что строка принадлежит одной дате (ADR-0147), двухдатное число не принадлежит ни
   одной из них, а колонка вышла бы производной от СОСЕДНЕЙ строки, которой при разрежённом
   хранении может не быть (ADR-0215). Проверяется здесь не наличие поля, а то, что число
   что-то РЕШАЕТ: имя не решает ничего, отказ называет адрес, однодатные величины остаются
   в прежних рамках, и породой правило не обходится. */
(() => {
  ST.seed();

  /* #165 — реквизит объявлен у КАЖДОЙ записи, а вопрос задаётся ДО заведения. */
  const RAW = vm.runInContext('REGISTRY', sandbox);
  const F_COMMON = vm.runInContext('F_COMMON', sandbox);
  const reg165 = ST.registry();
  const notOne = reg165.filter(r => r.dates !== 1);
  const rawMany = RAW.filter(r => r.dates !== undefined && r.dates !== 1);
  const n165 = ST.state.registry.length;
  const mute = ST.addIndicator({id:'m-q1', name:'Проба немого вопроса', obj:'obj-credit',
    src:'поле', key:'k', type:'сумма', unit:'сом'});
  const zero = ST.addIndicator({id:'m-q2', name:'Проба нуля дат', obj:'obj-credit',
    src:'поле', key:'k', type:'сумма', unit:'сом', dates:0});
  const half = ST.addIndicator({id:'m-q3', name:'Проба полутора дат', obj:'obj-credit',
    src:'поле', key:'k', type:'сумма', unit:'сом', dates:1.5});
  const one  = ST.addIndicator({id:'m-q4', name:'Проба одной даты', obj:'obj-credit',
    src:'поле', key:'k', type:'сумма', unit:'сом', dates:1});
  ok(165, notOne.length === 0 && rawMany.length === 0 && F_COMMON.indexOf('dates') >= 0 &&
        !mute.ok && has(mute.why, 'не спрошено') && has(mute.why, 'ИС-47') &&
        !zero.ok && has(zero.why, 'целым и не меньше одного') &&
        !half.ok && has(half.why, 'целым и не меньше одного') &&
        one.ok && ST.REC('m-q4').dates === 1 &&
        ST.state.registry.length === n165 + 1 && !ST.REC('m-q1') && !ST.REC('m-q2'),
    `«сколько дат среза нужно, чтобы величину вычислить» — реквизит ОБЩИЙ обеим породам (он в списке общих: ${F_COMMON.join(', ')}), и объявлен он у каждой из ${reg165.length} записей реестра: требующих больше одной даты — ${notOne.length}, и в исходном литерале реестра таких же ${rawMany.length}. Правило проверяемо не только на новых записях: не объявляй его старые, оно держалось бы на слове, и первая же ревизия реестра не смогла бы ответить, законна ли колонка. Умолчания у вопроса нет: молчание — отказ («${String(mute.why).slice(0, 74)}…»), потому что подставленная дверью «одна» превратила бы заявку на изменение остатка в колонку остатка под именем изменения, и имя бы врало (ИС-40). Ответ обязан быть целым и не меньше одного — 0 и 1,5 отбиты. Проверка идёт ДО кладовой: три отказа реестра не тронули, вырос он ровно на одну законную запись (${n165} → ${ST.state.registry.length}), и записей «m-q1»/«m-q2» в нём нет — иначе отказ был бы уборкой уже написанного (ИС-47, ADR-0220 §1)`);

  /* #166 — критерий МЕХАНИЧЕСКИЙ: решает объявленное число, а не слово в имени. */
  ST.seed();
  const SHOWN = vm.runInContext('SHOWN', sandbox);
  /* Список, которым многодатность угадывалась до ADR-0220. Заявки нарочно переименованы
     так, что ни одно его слово в них не встречается: угадывай сторож по имени — он бы их
     пропустил, и все четыре стали бы колонками. */
  const OLD = ['доля','дельта','сомовый эквивалент','процент от','прирост'];
  /* Волна 17 ч.6: список подстрок не тот же, что был, — довод не должен утверждать
     обратного. Живой запрет читается ИЗ МОДУЛЯ, а не переписывается сюда руками. */
  const SHOWN166 = vm.runInContext('SHOWN', sandbox);
  const noWord = s => OLD.every(w => s.toLowerCase().indexOf(w) < 0) &&
                      SHOWN.every(w => s.toLowerCase().indexOf(w) < 0);
  const n166 = ST.state.registry.length;
  const asked = [
    {id:'m-w1', name:'Сдвиг остатка от точки к точке', dates:2, was:'изменение остатка за месяц'},
    {id:'m-w2', name:'Скорость набора портфеля', dates:2, was:'темп роста портфеля'},
    {id:'m-w3', name:'Переход кредита между категориями риска', dates:2, was:'миграция из категории в категорию'},
    {id:'m-w4', name:'Просрочка, сглаженная за 90 дней', dates:90, was:'скользящее среднее за 90 дней'}
  ].map(x => Object.assign({}, x, {r: ST.addIndicator({id:x.id, name:x.name, obj:'obj-credit',
    src:'поле', key:'k', type:'сумма', unit:'сом', dates:x.dates})}));
  /* Та же заявка с тем же именем, но объявленной одной датой, — законная запись. Это не
     дыра, а то же, чем стоит `perObject`: реестр СПРАШИВАЕТ там, где по данным проверить
     нельзя, и солгавший в ответе заводит запись, имя которой врёт (ИС-40). Зато видно, что
     решает ЧИСЛО: имя у обеих проб одно и то же. */
  const sameName = ST.addIndicator({id:'m-w5', name:'Скорость набора портфеля', obj:'obj-credit',
    src:'поле', key:'k', type:'сумма', unit:'сом', dates:1});
  ok(166, asked.every(x => !x.r.ok && has(x.r.why, 'ИС-47') && has(x.r.why, 'ADR-0220') &&
        !has(x.r.why, 'ИС-15') && noWord(x.name)) &&
        ST.state.registry.length === n166 + 1 && asked.every(x => !ST.REC(x.id)) &&
        sameName.ok && ST.REC('m-w5').dates === 1,
    `четыре заявки, названные ADR-0220 поимённо, отвергнуты ПО ЧИСЛУ ДАТ: ${asked.map(x => `«${x.name}» (${x.was}) — ${x.dates}`).join(' · ')}. Каждая переименована так, что ни одного слова из прежнего списка подстрок (${OLD.join(', ')} — волна 17 ч.6 изъяла из него «сомовый эквивалент», и в живом запрете осталось двое: ${SHOWN166.join(' · ')}) в ней нет: угадывай дверь по имени — все четыре прошли бы и стали колонками, а «темп» и «миграция» не попали бы в список и при самом длинном перечислении, потому что заявку пишет человек и словами своими. Отказ у всех четырёх один и тот же и на ИС-15 не ссылается ни разу — представление тут ни при чём. Обратное тоже верно: ТА ЖЕ заявка «Скорость набора портфеля» с объявленной ОДНОЙ датой заведена свободно (дат среза ${sameName.ok ? ST.REC('m-w5').dates : '—'}), то есть решает не имя, а объявленное число — ровно как у `+"`perObject`"+`: реестр спрашивает там, где по данным проверить нечем (ИС-47, ADR-0220 §1)`);

  /* #167 — отказ называет АДРЕС, а не «нельзя»; курсовая разница — тот же случай (§5). */
  ST.seed();
  const delta = ST.addIndicator({id:'m-a1', name:'Сдвиг остатка от точки к точке', obj:'obj-credit',
    src:'поле', key:'k', type:'сумма', unit:'сом', dates:2});
  const fx    = ST.addIndicator({id:'m-a2', name:'Курсовая разница между срезами', obj:'obj-credit',
    src:'поле', key:'k', type:'сумма', unit:'сом', dates:2});
  const shown = ST.addIndicator({id:'m-a3', name:'Доля просрочки в портфеле', obj:'obj-credit',
    src:'поле', key:'k', type:'сумма', unit:'сом', dates:1});
  const addr = w => has(w, 'ГРАФА ИЗМЕНЕНИЯ') && has(w, 'ADR-0218') &&
                    has(w, 'ОБЗОР АНАЛИЗА') && has(w, 'ADR-0155');
  ok(167, !delta.ok && addr(delta.why) && has(delta.why, 'ADR-0147') && has(delta.why, 'ADR-0215') &&
        !fx.ok && addr(fx.why) && has(fx.why, 'ADR-0151 §3') &&
        !shown.ok && has(shown.why, 'ИС-15') && !has(shown.why, 'ИС-47') && !addr(shown.why),
    `отказ не молчит и не говорит «нельзя» — он называет АДРЕС, потому что заявитель спрашивает про нужную ему величину, а не про устройство хранилища: одна пара дат внутри выпуска — графа изменения отчёта, она считается один раз и мёрзнет вместе с документом (ADR-0218); ряд по многим датам — обзор анализа, который читает готовые срезы и хранит снимок основания, а не колонку (ADR-0155). Тем же ответом отвечено курсовой разнице: она РАЗНОСТЬ ДВУХ СРЕЗОВ (ADR-0151 §3), а не отдельный расчёт, и разбирать её особым случаем больше не надо — «${String(fx.why).slice(0, 88)}…». Довод назван в самом отказе, и он двойной: строка принадлежит одной дате (ADR-0147), а колонка вышла бы производной от соседней строки, которой при разрежённом хранении может не быть (ADR-0215). Адрес у разных отказов РАЗНЫЙ: доле отвечено про показ, а не про даты («${String(shown.why).slice(0, 70)}…»), и ИС-47 в её отказе нет — иначе однодатную величину отправили бы в анализ ни за что (ИС-47, ADR-0220 §5, §6)`);

  /* #168 — две величины на одной дате — по-прежнему ОДНА дата (§2), и слово в имени
     больше не основание ни для отказа, ни для допуска. */
  ST.seed();
  const perUnit = ST.addIndicator({id:'m-p1', name:'Требований на куратора', obj:'obj-claim',
    src:'поле', key:'k', type:'число', unit:'шт.', dates:1});
  const share   = ST.addIndicator({id:'m-p2', name:'Доля просрочки в портфеле', obj:'obj-credit',
    src:'поле', key:'k', type:'сумма', unit:'сом', dates:1});
  const shareTwo= ST.addIndicator({id:'m-p3', name:'Доля просрочки в портфеле', obj:'obj-credit',
    src:'поле', key:'k', type:'сумма', unit:'сом', dates:2});
  const growth  = ST.addIndicator({id:'m-p4', name:'Прирост стоимости залога по оценке',
    obj:'obj-collateral', src:'поле', key:'k', type:'сумма', unit:'сом', dates:1});
  const OLD168 = ['доля','дельта','сомовый эквивалент','процент от','прирост'];
  ok(168, !perUnit.ok && has(perUnit.why, 'ИС-35') && has(perUnit.why, 'ADR-0200') &&
        !has(perUnit.why, 'ИС-47') &&
        !share.ok && has(share.why, 'ИС-15') && !has(share.why, 'ИС-47') &&
        !shareTwo.ok && has(shareTwo.why, 'ИС-47') && !has(shareTwo.why, 'ИС-15') &&
        growth.ok && ST.REC('m-p4').dates === 1 &&
        OLD168.some(w => 'Прирост стоимости залога по оценке'.toLowerCase().indexOf(w) >= 0),
    `две величины на одной дате — это по-прежнему ОДНА дата, и новое правило их рамок не трогает: удельная величина отбита как пара «срез + счёт» («${String(perUnit.why).slice(0, 62)}…», ИС-35, ADR-0200), доля — как представление (ИС-15), и ИС-47 не назван ни в одном из двух отказов. Ужесточи правило на них — и спор о хранении доли решался бы дважды и по-разному: ADR-0150 §4 говорит одно, число дат другое. Зато ТА ЖЕ доля, объявленная о ДВУХ датах, отбита уже по числу дат, а не по имени, и это не придирка: доля мая к апрелю не принадлежит ни маю, ни апрелю. Обратный случай — «Прирост стоимости залога по оценке»: слово «прирост» в имени есть, оно стояло в прежнем списке подстрок, а величина законна — поле объекта, читаемое НА ДАТУ, и запись заведена (дат среза ${ST.REC('m-p4').dates}). Под старой эвристикой её отвергли бы, и объяснить отказ было бы нечем (ИС-47, ADR-0220 §2)`);

  /* #169 — породой правило не обходится: третьей породы нет, а переезд проверяется тем же
     валидатором (ADR-0209 §5, ADR-0220, «Границы»). */
  ST.seed();
  const n169 = ST.state.registry.length;
  const third = ST.addRecord({kind:'свод', id:'x-t1', name:'Темп роста портфеля', obj:'obj-credit',
    src:'поле', key:'k', dates:2});
  const born = ST.addIndicator({id:'m-k1', name:'Стоимость залога по оценке', obj:'obj-collateral',
    src:'поле', key:'k', type:'сумма', unit:'сом', dates:1});
  const move2 = ST.changeKind('m-k1', 'разрез', 'Э.', {perObject:'одно', dates:2});
  /* Порода снимается СЛЕПКОМ: `REC` отдаёт живую запись, и прочитанная после переезда
     она рассказала бы про его исход, а не про отбитую попытку. */
  const stillKind = ST.REC('m-k1').kind;
  const move1 = ST.changeKind('m-k1', 'разрез', 'Э.', {perObject:'одно'});
  const after = ST.REC('m-k1');
  ok(169, !third.ok && has(third.why, 'третьей породы') && !ST.REC('x-t1') &&
        born.ok && stillKind === 'показатель' &&
        !move2.ok && has(move2.why, 'порода не сменена') && has(move2.why, 'ИС-47') &&
        move1.ok && after.kind === 'разрез' && after.dates === 1 &&
        ST.state.registry.length === n169 + 1,
    `правило не обходится ни породой, ни переездом. Свод и темп записями реестра не становятся НИ В КАКОЙ породе: третьей породы нет вовсе («${String(third.why).slice(0, 70)}…»), и завести многодатную величину «сбоку», объявив её чем-то третьим, физически нечем. Переезд породы — рядовая правка настройки, и потому он идёт через ТОТ ЖЕ валидатор: попытка сменить породу и заодно объявить две даты отбита («${String(move2.why).slice(0, 78)}…»), запись осталась породы «${stillKind}». Стой проверка только в двери заведения, обход стоил бы двух шагов: завести законную однодатную запись, а следом «уточнить» её при переезде — и колонка-дельта появилась бы в реестре с целой историей. Реквизит при законном переезде ПЕРЕЕЗЖАЕТ вместе с записью (порода «${after.kind}», дат среза ${after.dates}), а не спрашивается заново: потеряй он ответ — и запись осталась бы в реестре без ответа на вопрос, отказом на который она вообще заводилась (ИС-47, ИС-43, ADR-0220, ADR-0209 §5)`);
})();

/* ---------- АД. Волна 17 ч.6: сомовая величина — ЗАПИСЬ РЕЕСТРА (ИС-44, ADR-0214) ------ *
   До этой волны сомовая сторона денег была ПОКАЗОМ: `ST.somOf` умножал клетку на курс при
   рисовании, свод разновалютного множества молча складывал части через курс, поток и
   расхождение делали то же самое каждый по-своему. Числа получались правдоподобные, и
   потому спорить с ними было не о чем: «Сумма остатка ОД» значила то валюту договора, то
   сом — смотря кто и где спросил, — а курс, по которому вышло второе, нигде рядом не лежал.
   ADR-0214 разводит два показателя: сумма в валюте договора и сумма в сомах — РАЗНЫЕ
   величины с РАЗНЫМИ именами, и вторая — полноправная запись реестра, материализованная
   колонкой замороженной строки. Проверяется здесь пять вещей, и ни одна не про «красиво»:
   запись есть запись (имя, единица, свод, состав объекта, колонка витрины, паспорт);
   пересчёт живёт в ОДНОМ месте и принадлежит ядру, а правило округления объявлено один раз;
   каждая сомовая клетка КАЖДОЙ строки каждого прогона перемножается сторожем и сверяется —
   и сторож ловит подброшенный дефект; свод валютной записи по разновалютному множеству есть
   отказ с адресом, а по одновалютному — число; неаддитивность объявлена РЕКВИЗИТОМ, а не
   поведением движка. Границы: ИС-15 не отменён — доля и «процент от» остаются
   представлением; ИС-47 не тронут; поля формулы в реестре не завелось ни одного. */
(() => {
  /* `ST.seed()` пересобирает состояние ЦЕЛИКОМ и возвращает новое — ссылку на него в блоке
     перевязываем на каждом посеве, иначе сторож считал бы старый реестр и не заметил бы
     ничего из того, что делает дверь. */
  let st = ST.seed();
  const CORE = vm.runInContext('CORE', sandbox);
  const SHOWN = vm.runInContext('SHOWN', sandbox);
  const CODE = m[1];

  /* #170 — сомовая величина есть ЗАПИСЬ РЕЕСТРА, а не пометка на чужой клетке: своё имя,
     своя единица, своё правило свода, свой источник, место в составе объекта, колонка
     витрины и паспорт у ответа. Всё то, чего у «эквивалента при показе» не было. */
  const cur170 = ST.REC('m-debt'), som170 = ST.REC('m-debt-som');
  const cInds = ST.OBJ('obj-credit').inds;
  const nextTo = cInds.indexOf('m-debt-som') === cInds.indexOf('m-debt') + 1;
  const rows170 = ST.statRows({obj:'obj-credit', date: ASK});
  const cell170 = rows170.rows[0].inds['m-debt-som'];
  const sl170 = ST.callSeam('отчётность', 'statSlice',
    {obj:'obj-credit', dims:['d-branch'], inds:['a-sumdebt-som'], date: ASK});
  const col170 = ST.martCol('m-debt-som');
  const reg170 = ST.registry().filter(r => r.id === 'm-debt-som');
  ok(170, som170 && som170.kind === 'показатель' && som170.name === cur170.name + ' в сомах' &&
        som170.name !== cur170.name && som170.unit === 'сом' && cur170.unit !== 'сом' &&
        som170.roll === 'аддитивный' && !som170.rollBy && som170.somOf === 'm-debt' &&
        som170.dates === 1 && som170.src === cur170.src && som170.seam === cur170.seam &&
        st.registry.indexOf(som170) >= 0 && reg170.length === 1 &&
        ST.IND('m-debt-som') && ST.DIM('m-debt-som') === undefined &&
        cInds.indexOf('m-debt-som') >= 0 && nextTo &&
        cell170 && cell170.v > 0 && cell170.cur === 'KGS' &&
        sl170.ok && sl170.total['a-sumdebt-som'].v > 0 &&
        sl170.passport && sl170.passport.asOf && sl170.passport.fixation && sl170.passport.scope &&
        col170 && col170.nullable === true && col170.type === 'сумма' &&
        !('formula' in som170) && !('expr' in som170),
    `сомовая величина — ЗАПИСЬ РЕЕСТРА, а не пометка на чужой клетке. У неё СВОЁ имя, и оно отличается от валютного не оговоркой, а буквами: «${cur170.name}» (${cur170.unit}) и «${som170.name}» (${som170.unit}) — два числа, которые нельзя сложить между собой, не носят одного имени (ИС-40). Она лежит в ОДНОЙ кладовой с остальными (${st.registry.length} записей), читается дверью своей породы и не читается чужой, стоит в составе объекта СРАЗУ за своей валютной стороной (${cInds.indexOf('m-debt')} → ${cInds.indexOf('m-debt-som')}), названа именем в вопросе через шов и отвечает с паспортом (${sl170.passport.short}), а витрина завела ей колонку — ${col170.col}, nullable, порода «${col170.kindAt}». Всё перечисленное — ровно то, чего у «эквивалента при показе» не было ни одного: его нельзя было назвать в отчёте, поставить в состав, прекратить датой и спросить швом. Свод у неё «${som170.roll}» и другим не бывает — в этом весь смысл её отдельного имени; поля формулы у записи нет (ИС-44, ADR-0214 §2, ADR-0150 §1)`);

  /* #171 — пересчёт в ОДНОМ месте и принадлежит ЯДРУ; правило округления объявлено один
     раз. Довод механический: до волны 17 умножали на курс ЧЕТЫРЕ места, и каждое округляло
     само — ровно та копеечная разница между двумя отчётами об одном и том же, разбирать
     которую было нечем, потому что общего правила не было ни одного. */
  const coreFrom = CODE.indexOf('const CORE = {');
  const coreTo = CODE.indexOf('\n};', coreFrom);
  const mulAt = [];
  { const re = /\*\s*(?:p\.)?(?:rateOn\([^)]*\)\.)?rate\b/g; let x;
    while((x = re.exec(CODE))) mulAt.push(x.index); }
  const outside = mulAt.filter(i => i < coreFrom || i > coreTo);
  const toSomAt = CODE.indexOf('toSom(parts, rule){');
  const roundDecl = (CODE.match(/SOM_ROUNDING\s*:/g) || []).length;
  const roundUse = (CODE.match(/somRound\(/g) || []).length;
  /* Точность берётся ИЗ ОБЪЯВЛЕНИЯ, а не из литерала: доказывается не чтением кода, а
     подменой объявления — меняем `digits` и смотрим, изменилась ли арифметика ядра. */
  const R171 = CORE.SOM_ROUNDING, kept171 = R171.digits;
  R171.digits = 3;
  const byDecl171 = CORE.somRound(2.3455, R171.id);
  R171.digits = kept171;
  const backDecl171 = CORE.somRound(2.3455, R171.id);
  ok(171, typeof CORE.toSom === 'function' && typeof CORE.somRound === 'function' &&
        CORE.SOM_ROUNDING && CORE.SOM_ROUNDING.digits === 2 &&
        has(CORE.SOM_ROUNDING.text, 'одно на всю систему и на все отчёты') &&
        roundDecl === 1 && roundUse > 1 &&
        coreFrom > 0 && coreTo > coreFrom && mulAt.length === 2 && outside.length === 0 &&
        toSomAt > coreFrom && toSomAt < coreTo &&
        typeof ST.somOf === 'undefined' &&
        CORE.somRound(2.345, R171.id) === 2.35 && CORE.somRound(2.344, R171.id) === 2.34 &&
        /* Объявление ОДНО, и перечень объявленных есть производная от него, а не второй
           список: правил в системе не двое (ADR-0214 §6). */
        typeof CORE.rounding === 'function' && typeof CORE.roundings === 'function' &&
        CORE.roundings().length === 1 && CORE.roundings()[0] === R171 &&
        CORE.rounding(R171.id) === R171 && CORE.rounding('коп-3') === null &&
        CORE.rounding(undefined) === null &&
        /* Ядро округляет ПО НАЗВАННОМУ правилу: не названо или неизвестно — ответа нет
           вовсе, а не «как обычно». Молчаливое «как обычно» и вернуло бы правило в код. */
        CORE.somRound(2.345) === null && CORE.somRound(2.345, 'коп-3') === null &&
        byDecl171 === 2.346 && backDecl171 === 2.35 &&
        CORE.toSom([{cur:'USD', value:100, rate:88.3, rateDate:'2026-08-18'}], R171.id).value === 8830 &&
        CORE.toSom([{cur:'USD', value:100, rate:88.3, rateDate:'2026-08-18'}], R171.id).round === R171.id &&
        CORE.toSom([{cur:'USD', value:100, rate:88.3, rateDate:'2026-08-18'}]) === null &&
        CORE.toSom([{cur:'USD', value:100, rate:88.3, rateDate:'2026-08-18'}], 'коп-3') === null &&
        CORE.toSom([{cur:'USD', value:100, rate:null}], R171.id) === null,
    `пересчёт в сом живёт в ОДНОМ месте и принадлежит ЯДРУ: умножений на курс во всём файле ${mulAt.length}, и оба внутри `+"`CORE`"+` (вне ядра — ${outside.length}), величину из них производит одно — `+"`CORE.toSom`"+`. Правило округления ОБЪЯВЛЕНО и объявлено ровно один раз (${roundDecl} объявление, ${roundUse} обращения, объявленных правил ${CORE.roundings().length}): «${CORE.SOM_ROUNDING.text}». Ядро округляет ПО НАЗВАННОМУ правилу и только по нему: правило не названо — ответа нет (${CORE.somRound(2.345)}), названо неизвестное — ответа нет (${CORE.somRound(2.345, 'коп-3')}), и то же самое у пересчёта целиком. «Как обычно» вернуло бы правило в код, откуда его и вынимали. Точность берётся ИЗ ОБЪЯВЛЕНИЯ, а не из литерала, и это проверено подменой: с `+"`digits: 3`"+` то же ядро округляет 2.3455 до ${byDecl171}, с объявленными двумя — до ${backDecl171}; будь в коде «* 100 / 100», объявление было бы надписью. Довод не эстетический: до волны 17 на курс умножали ЧЕТЫРЕ места — показ (`+"`ST.somOf`"+`), агрегат, поток и расхождение, — и каждое округляло само. Три правила округления на одну величину дают копеечное расхождение между двумя отчётами об одном и том же, и разбирать его нечем: общего правила нет ни одного, а «правильного» из трёх не назовёт никто. Четвёртое место закрыто физически — `+"`ST.somOf`"+` в модуле больше не существует (${typeof ST.somOf}), витрина сомовое число не считает, а ЗАПИСЫВАЕТ. Курса нет — ответа нет: подставленная единица дала бы правдоподобное число, доллар по курсу «1» выглядит как сом (ИС-44, ADR-0214 §3, §6)`);

  /* #172 — сторож НА КАЖДОЙ ЗАПИСИ, а не на выбранном примере. Обходятся ВСЕ строки ВСЕХ
     прогонов по всем объектам: сомовая колонка обязана быть произведением валютной колонки
     ТОЙ ЖЕ строки на курс ТОЙ ЖЕ строки, с объявленным округлением. Ни одного взгляда за
     пределы строки: основание пересчёта заморожено в ней самой (ADR-0214 §4, §5). */
  const audit = () => {
    const bad = [];
    let seen = 0;
    ST.state.rows.forEach(r => {
      Object.keys(r.inds).forEach(id => {
        const rec = ST.IND(id);
        if(!rec || !rec.somOf) return;
        const c = r.inds[id], o = r.inds[rec.somOf];
        const why = (() => {
          if(!c || c.v == null) return 'сомовой клетки нет';
          if(!o) return 'валютной клетки нет';
          /* Состав клетки берётся ТЕМ ЖЕ нормализатором, что и у модуля (`ST.partsOf`):
             у одновалютной он из одной части, у портфельной — из скольких угодно, и
             своего понятия «состав» сторож не заводит (ADR-0184 §3). */
          const parts = ST.partsOf(o);
          if(!parts.length) return 'у валютной клетки нет состава';
          const basis = c.from || [];
          if(basis.length !== parts.length) return 'основание пересчёта не совпало с составом';
          for(let i = 0; i < parts.length; i++){
            const b = basis[i], p = parts[i];
            if(b.cur !== p.cur || b.value !== p.v || b.rate !== p.rate || b.rateDate !== p.rateDate)
              return 'основание пересчёта разошлось со строкой по части «' + p.cur + '»';
            if(!(b.rate > 0)) return 'курс не назван';
          }
          /* Правило округления берётся ИЗ ЗАПИСИ РЕЕСТРА, а не из кода сторожа, и
             ПРИМЕНЁННОЕ ядром обязано совпасть с объявленным: иначе сторож доказывал бы
             арифметику, молча соглашаясь с любой точностью (ADR-0214 §6). */
          const rule = ST.roundOf(id);
          if(!rule) return 'запись не назвала правила округления';
          if(c.round !== rule)
            return 'применённое правило «' + c.round + '» не равно объявленному «' + rule + '»';
          const byHand = CORE.somRound(parts.reduce((n, p) => n + p.v * p.rate, 0), rule);
          if(Math.abs(c.v - byHand) > 0.005)
            return 'число не равно произведению: ' + c.v + ' ≠ ' + byHand;
          return null;
        })();
        seen++;
        if(why) bad.push({ref: r.ref, date: r.date, id, why});
      });
    });
    return {bad, seen};
  };
  const a172 = audit();
  /* Волна 17 З-12: сверяются ПО-ПРЕЖНЕМУ все написанные строки — легаси в том числе, — но
     сомовых клеток в них НОЛЬ, и это не пропуск сторожа. Сомовый близнец заведён ADR-0214
     в ЭТОЙ системе; старая его не считала, и в форме легаси его нет вовсе. Пересчитай мы
     легаси-остаток сегодняшним курсом — число выглядело бы историческим, а было бы
     сегодняшним (ИС-41, ADR-0207 §2). */
  const own172 = ST.state.rows.filter(r => !ST.isLegacyRow(r));
  const leg172 = ST.state.rows.filter(r => ST.isLegacyRow(r));
  const legSom172 = leg172.reduce((n, r) => n + Object.keys(r.inds)
    .filter(id => ST.IND(id) && ST.IND(id).somOf).length, 0);
  const dates172 = Array.from(new Set(own172.map(r => r.date))).sort();
  const objs172 = Array.from(new Set(own172.map(r => r.obj)));
  /* Волна 17: перепись мира ужалась с 379 строк до 258 не потому, что что-то перестали
     считать, а потому, что копии вчерашнего дня больше не пишутся (ИС-45, ADR-0215):
     разрежённая запись оставила 245, и защёлка дописала 13 обратно плотным слепком на
     двух закрытиях (§4). Сверять при этом надо ВСЕ написанные строки: сторож, считающий
     сомовые клетки по фиксированному числу, при разрежении молча пропустил бы треть мира
     и остался бы зелёным. Строки слепка сверяются наравне с прогонными — иначе именно то,
     что уходит наружу, осталось бы непроверенным. */
  ok(172, a172.bad.length === 0 && a172.seen === 2127 && dates172.length === 6 && objs172.length === 10 &&
        own172.length === 258 && leg172.length === 34 && legSom172 === 0,
    `сверено НЕ на примере, а на каждой записи: ${a172.seen} сомовых клеток в ${own172.length} строках ${objs172.length} объектов за все ${dates172.length} прогонов (${dates172[0].slice(5)}…${dates172[dates172.length-1].slice(5)}), расхождений ${a172.bad.length}. Сверка идёт ВНУТРИ строки: сомовое число обязано равняться сумме частей валютной клетки той же строки, умноженных на курс той же строки, по правилу округления, НАЗВАННОМУ В ЗАПИСИ (и применённое ядром обязано совпасть с объявленным — оно лежит в клетке рядом с курсом), и основание пересчёта обязано совпасть с составом клетки часть в часть — валюта, число, курс, дата курса. Заглядывать в справочник курсов сторожу не нужно и НЕЛЬЗЯ: справочник живой, а строка заморожена, и сверка с живым курсом ловила бы переоценку вместо ошибки (ИС-44, ADR-0214 §4, §5). Легаси-строк рядом ${leg172.length}, и сомовых клеток в них ${legSom172}: старая система близнеца не считала, и в её форме его НЕТ КЛЮЧОМ — не ноль и не пересчёт сегодняшним курсом (ИС-41, ADR-0207 §2)`);

  /* #173 — тот же сторож на ПОДБРОШЕННОМ дефекте. Сторож, который не умеет провалиться,
     ничего не доказывает: проверяется, что он называет ИМЕННО испорченные строки и
     ИМЕННО их, а после восстановления снова чист. Два разных дефекта — подменённый курс
     в основании и подменённое число в колонке: первый ловится сверкой с составом строки,
     второй — арифметикой, и оба обязаны быть пойманы. */
  const clean0 = audit();
  const victims = ST.state.rows.filter(r => r.obj === 'obj-credit' && r.inds['m-debt-som']);
  const vRate = victims[0], vNum = victims[1];
  const fRate = vRate && (vRate.inds['m-debt-som'].from || [])[0];
  const keptRate = fRate ? fRate.rate : null;
  const keptNum = vNum ? vNum.inds['m-debt-som'].v : null;
  if(fRate) fRate.rate = keptRate + 7;
  if(vNum) vNum.inds['m-debt-som'].v = keptNum + 0.05;
  const a173 = audit();
  const named = a173.bad.map(b => b.ref).sort().join(', ');
  const wanted = [vRate, vNum].filter(Boolean).map(v => v.ref).sort().join(', ');
  if(fRate) fRate.rate = keptRate;
  if(vNum) vNum.inds['m-debt-som'].v = keptNum;
  const back = audit();
  ok(173, !!fRate && !!vNum && clean0.bad.length === 0 && a173.bad.length === 2 && named === wanted &&
        a173.bad.some(b => has(b.why, 'основание пересчёта разошлось')) &&
        a173.bad.some(b => has(b.why, 'не равно произведению')) &&
        back.bad.length === 0 && back.seen === clean0.seen,
    `сторож умеет ПРОВАЛИТЬСЯ, и потому его «чисто» что-то значит. Подброшены два разных дефекта в две разные строки: в «${(vRate || {}).ref}» подменён КУРС в основании пересчёта (${keptRate} → ${keptRate + 7}) — число осталось прежним и на глаз правдоподобным, — в «${(vNum || {}).ref}» подменено само сомовое ЧИСЛО на пять копеек. Сторож назвал ровно две строки (${named}) и ровно теми причинами, какими надо: первую — расхождением основания с составом строки, вторую — арифметикой. Пять копеек ловятся потому, что округление ОБЪЯВЛЕНО: не будь у системы одного правила, эта разница была бы неотличима от законной (ADR-0214 §6). После восстановления сторож снова чист (${back.seen} клеток, ${back.bad.length} расхождений) — значит ловит он дефект, а не собственную обстановку`);

  /* #174 — свод валютной записи по разновалютному множеству есть ОТКАЗ, называющий и
     причину, и АДРЕС; по одновалютному та же запись отвечает числом в его валюте; сомовая
     по тому же разновалютному множеству отвечает ОДНИМ числом (ADR-0214 §1). */
  st = ST.seed();
  const SD = ST.somIdOf('a-sumdebt');
  const mix = ST.statSlice({obj:'obj-credit', dims:[], inds:['a-sumdebt', SD], date: ASK});
  const one = ST.statSlice({obj:'obj-credit', dims:[], inds:['a-sumdebt', SD], date: ASK,
    filter: F(cD('d-cur','=',{value:'USD'}))});
  const byCur = ST.statSlice({obj:'obj-credit', dims:['d-cur'], inds:['a-sumdebt', SD], date: ASK});
  const ref174 = mix.total['a-sumdebt'];
  const sumSom = byCur.groups.reduce((n, g) => n + g.values[SD].v, 0);
  const answered = byCur.groups.filter(g => !g.values['a-sumdebt'].refused);
  ok(174, ref174.refused === true && ref174.v === undefined && ref174.cur === null &&
        has(ref174.why, 'множество разновалютное') && has(ref174.why, ST.IND(SD).name) &&
        ref174.som === SD && (ref174.mixed || []).length === 3 &&
        one.ok && one.total['a-sumdebt'].v > 0 && one.total['a-sumdebt'].cur === 'USD' &&
        !one.total['a-sumdebt'].refused &&
        mix.total[SD].v > 0 && mix.total[SD].cur === 'KGS' &&
        Math.abs(sumSom - mix.total[SD].v) < 0.01 &&
        byCur.groups.length === 3 && answered.length === 3 &&
        Math.abs(one.total[SD].v - CORE.somRound(one.total['a-sumdebt'].v * 88.3, ST.roundOf(SD))) < 0.01,
    `свод валютной записи по РАЗНОВАЛЮТНОМУ множеству — не число, а отказ, и отказ называет две вещи: причину («${(ref174.mixed||[]).join(' + ')}» — одно число здесь было бы суммой долларов с сомами) и АДРЕС — «${ST.IND(SD).name}» (${ref174.som}), аддитивную всегда. По ОДНОВАЛЮТНОМУ множеству та же запись отвечает числом в его валюте: ${one.total['a-sumdebt'].v} ${one.total['a-sumdebt'].cur} — запрета на сложение денег не вводилось, введён запрет складывать РАЗНОЕ. Сомовая запись по тому же разновалютному множеству отвечает ОДНИМ числом (${mix.total[SD].v} сом.), и оно ровно равно сумме по группам валют (${Math.round(sumSom*100)/100}), а на одновалютном множестве сходится с валютным ответом по курсу строки. Отказ ПОКЛЕТОЧНЫЙ, а не на весь ответ: сгруппируй по валюте — и все ${answered.length} группы из ${byCur.groups.length} отвечают числом (ИС-44, ADR-0214 §1, §2)`);

  /* #175 — курс и дата курса лежат В СТРОКЕ рядом с сомовым числом. Сторожу не нужно
     выходить из строки, чтобы перемножить и сверить, — и это относится не только к
     одновалютной клетке договора, но и к разновалютному портфелю заёмщика. */
  const rr = ST.statRows({obj:'obj-credit', date: ASK}).rows;
  const usd = rr.find(r => r.inds['m-debt'].cur === 'USD');
  const o175 = usd.inds['m-debt'], s175 = usd.inds['m-debt-som'];
  const pr = ST.statRows({obj:'obj-borrower', date: ASK}).rows
    .find(r => (r.inds['m-btotal'].parts || []).length > 1);
  const po = pr.inds['m-btotal'], ps = pr.inds['m-btotal-som'];
  const byRow = CORE.somRound((po.parts || []).reduce((n, p) => n + p.value * p.rate, 0), ST.roundOf('m-btotal-som'));
  ok(175, !!s175 && !!ps && o175.rate > 1 && o175.rateDate && o175.cur === 'USD' &&
        (s175.from || []).length === 1 && s175.from[0].rate === o175.rate &&
        s175.from[0].rateDate === o175.rateDate && s175.from[0].cur === 'USD' &&
        Math.abs(s175.v - CORE.somRound(o175.v * o175.rate, ST.roundOf('m-debt-som'))) < 0.005 &&
        po.v === null && (po.parts || []).length > 1 &&
        ps.from.length === po.parts.length && ps.from.every(x => x.rate > 0 && x.rateDate) &&
        Math.abs(ps.v - byRow) < 0.005 && ST.somValue(usd, 'm-debt') === s175.v,
    `курс и дата курса лежат В СТРОКЕ, рядом с сомовым числом: «${usd.ref}» — ${o175.v} ${o175.cur} × ${o175.rate} от ${(((s175 || {}).from || [])[0] || {}).rateDate} = ${(s175 || {}).v} сом. (основание в строке: ${((s175 || {}).from || []).length} част.), и перемножить это можно не выходя из строки, не открывая ни справочника курсов, ни другой строки. То же и там, где валюта не одна: портфель «${pr.ref}» в валютной колонке молчит одним числом (${po.v}) и говорит СОСТАВОМ — ${po.parts.map(p => p.value + ' ' + p.cur + ' × ' + p.rate).join(' + ')}, — а сомовая колонка отвечает одним числом ${(ps || {}).v}, и основание у него по каждой части своё и своё же лежит в строке. Заморожено ОСНОВАНИЕ, а не только результат: переоценка завтрашним курсом вчерашнюю строку не трогает, потому что сверять её не с чем, кроме неё самой (ИС-16, ИС-44, ADR-0214 §4, §5)`);

  /* #176 — имя сомовой записи ДРУГОЕ, и правило одноимённости (ИС-40) на близнецах не
     срабатывает вхолостую: 114 новых записей прошли ту же проверку имени, что и все
     остальные. Обратное тоже проверяется: занятое имя близнеца отбивает всю пару. */
  st = ST.seed();
  const twins = st.registry.filter(r => r.somOf);
  const sameName = twins.filter(t => t.name === (ST.REC(t.somOf) || {}).name);
  /* Одноимённость считается по всему реестру, а не по близнецам: 114 новых имён не должны
     были притупить ИС-40 нигде. У правила есть ровно одно законное исключение — разрез и
     показатель ОДНОГО объекта, идущие ОДНОЙ дорогой: это один и тот же факт, прочитанный
     двумя способами, и разными именами его звать было бы враньём (ADR-0206 §1). Сторож не
     запрещает исключение, а пересчитывает его: незаконных совпадений быть не должно, а
     законное — одно и то же самое, что и до волны. */
  const byName = {};
  st.registry.forEach(r => { (byName[r.name] = byName[r.name] || []).push(r); });
  const road176 = r => r.src + '·' + (r.seam || '') + '·' + (r.field || '') + '·' + (r.key || '');
  const shared = Object.keys(byName).filter(n => byName[n].length > 1).map(n => byName[n]);
  const dup = shared.filter(g => !(g.length === 2 && g[0].kind !== g[1].kind &&
    g[0].obj === g[1].obj && road176(g[0]) === road176(g[1])));
  const twinShared = shared.filter(g => g.some(r => r.somOf));
  const taken = ST.addIndicator({dates:1, id:'m-n1', name:'Сумма остатка ОД', obj:'obj-borrower',
    src:'поле', key:'k', type:'сумма', unit:'сом'});
  const decoy = ST.addIndicator({dates:1, id:'m-n2', name:'Плата за простой в сомах', obj:'obj-credit',
    src:'поле', key:'k', type:'сумма', unit:'сом'});
  const clash = ST.addIndicator({dates:1, id:'m-n3', name:'Плата за простой', obj:'obj-credit',
    src:'шов', seam:'calcAccrual', field:'interest', money:true, type:'сумма',
    round:'коп-2', roll:'формульный', rollBy:'d-cur'});
  ok(176, twins.length === 114 && sameName.length === 0 && dup.length === 0 &&
        shared.length === 1 && twinShared.length === 0 &&
        twins.every(t => /\sв сомах$/.test(t.name)) &&
        !taken.ok && has(taken.why, 'ИС-40') &&
        decoy.ok && !clash.ok && has(clash.why, 'сомовая запись к') && has(clash.why, 'ИС-40') &&
        has(clash.why, 'Валютная тоже не заведена') && !ST.REC('m-n3') && !ST.martCol('m-n3'),
    `имя у сомовой записи ДРУГОЕ, и это проверено на всех ${twins.length} близнецах: совпавших с валютным именем ${sameName.length}, незаконно одноимённых пар во всём реестре ${dup.length}, и ни один близнец не попал даже в законное совпадение (${twinShared.length}). Совпадение имён в реестре осталось единственное и прежнее — «${shared[0][0].name}» (${shared[0].map(r => r.id + ':' + r.kind).join(' и ')}): один факт объекта «${(ST.OBJ(shared[0][0].obj) || {}).name}», прочитанный дорогой ${road176(shared[0][0])} и как величина, и как признак, — звать его двумя именами значило бы утверждать, что это два факта. Правило ИС-40 при этом живо и не притупилось: занятое имя по-прежнему отбивается («${String(taken.why).slice(0, 60)}…»). Близнец не льгота: он идёт ЧЕРЕЗ ТУ ЖЕ проверку. Подложена запись «Плата за простой в сомах» — законная и заведённая; следом заводится денежная «Плата за простой», близнец которой назвался бы так же, — и отбита ВСЯ ПАРА: «${String(clash.why).slice(0, 96)}…», причём валютной записи в реестре тоже не осталось (${ST.REC('m-n3') ? 'осталась' : 'нет'}) и колонки витрины ей не завели (${ST.martCol('m-n3') ? 'завели' : 'нет'}). Иначе в реестре жила бы половина пары: денежная величина без сомовой стороны, о которой узнали бы на сведении двух отчётов (ИС-40, ИС-44, ADR-0206 §6, ADR-0214 §2)`);

  /* #177 — запрет ПРЕДСТАВЛЕНИЯ жив и сузился ровно на треть: было три причины, осталось
     две. ИС-15 не отменён — отменена ОДНА его строка (ADR-0214 отменил ADR-0151 §2,
     ADR-0150 §4 и ADR-0147 §6 в части эквивалента, и только в ней). */
  st = ST.seed();
  const share = ST.addIndicator({dates:1, id:'m-s1', name:'Доля просрочки в портфеле', obj:'obj-credit',
    src:'поле', key:'k', type:'число', unit:'%'});
  const pct = ST.addIndicator({dates:1, id:'m-s2', name:'Процент от лимита программы', obj:'obj-credit',
    src:'поле', key:'k', type:'число', unit:'%'});
  const somReq = ST.addIndicator({dates:1, id:'m-s3', name:'Сомовый эквивалент обеспечения', obj:'obj-credit',
    src:'шов', seam:'calcCoverage', field:'secured', money:true, type:'сумма',
    round:'коп-2', roll:'формульный', rollBy:'d-cur'});
  ok(177, SHOWN.length === 2 && SHOWN.indexOf('доля') >= 0 && SHOWN.indexOf('процент от') >= 0 &&
        SHOWN.indexOf('сомовый эквивалент') < 0 &&
        !share.ok && has(share.why, 'ИС-15') && !has(share.why, 'ИС-47') &&
        has(share.why, 'больше НЕТ') && has(share.why, 'ИС-44') && has(share.why, 'ADR-0214') &&
        !pct.ok && has(pct.why, 'ИС-15') && !has(pct.why, 'ИС-47') &&
        somReq.ok && somReq.som === 'm-s3-som' && ST.REC('m-s3') && ST.REC('m-s3-som'),
    `запрет представления ЖИВ и сузился ровно на треть: причин было три, осталось ${SHOWN.length} — ${SHOWN.join(' · ')}. Доля и «процент от» отбиты по-прежнему и по-прежнему на ИС-15 («${String(share.why).slice(0, 74)}…»), потому что они и вправду считаются при показе из двух чисел и хранить их значит хранить ответ на вопрос, которого никто не задавал. Отмену третьей причины отказ ПРОИЗНОСИТ ВСЛУХ, а не умалчивает: «${String(share.why).slice(-150)}» — тот, кому отказали в доле, узнаёт заодно, что за сомовым эквивалентом ходить больше никуда не надо. Третья причина ОТМЕНЕНА, а не забыта: заявка «${(ST.REC('m-s3') || {}).name || 'ОТБИТА: ' + somReq.why}» заведена обычным порядком и пришла парой с «${(ST.REC('m-s3-som') || {}).name || '— близнеца нет'}» — сомовая величина не представление, а величина, и запрещать её именем значило запрещать её существование (ИС-15 сужен, ИС-44 введён, ADR-0214 отменил ADR-0151 §2, ADR-0150 §4 и ADR-0147 §6 в части эквивалента)`);

  /* #178 — ИС-47 не тронут ни в одну сторону: сомовая запись объявляет дат среза одну и
     проверяется тем же правилом, многодатная заявка отбита по ЧИСЛУ ДАТ и без ИС-15,
     а представление отбито без ИС-47. Два правила стоят рядом и не подменяют друг друга. */
  st = ST.seed();
  const somDates = st.registry.filter(r => r.somOf && r.dates !== 1);
  const two = ST.addIndicator({dates:2, id:'m-d1', name:'Сомовый эквивалент за месяц', obj:'obj-credit',
    src:'шов', seam:'calcDebt', field:'principal', money:true, type:'сумма',
    roll:'формульный', rollBy:'d-cur'});
  const mute178 = ST.addIndicator({id:'m-d2', name:'Плата за обслуживание', obj:'obj-credit',
    src:'шов', seam:'calcAccrual', field:'interest', money:true, type:'сумма',
    roll:'формульный', rollBy:'d-cur'});
  ok(178, somDates.length === 0 &&
        !two.ok && has(two.why, 'ИС-47') && has(two.why, 'ADR-0220') && !has(two.why, 'ИС-15') &&
        has(two.why, 'ADR-0218') && has(two.why, 'ADR-0155') && !ST.REC('m-d1') &&
        !mute178.ok && has(mute178.why, 'ИС-47') && !ST.REC('m-d2'),
    `ИС-47 не тронут ни в одну сторону. Все ${st.registry.filter(r => r.somOf).length} сомовых записей объявляют дат среза ровно одну (нарушителей ${somDates.length}) — новое правило не завело себе исключения из старого. Многодатная заявка, названная «сомовым эквивалентом», отбита ПО ЧИСЛУ ДАТ и с прежним адресом («${String(two.why).slice(0, 70)}…»), ИС-15 в этом отказе не назван ни разу: имя больше не решает ничего, решает объявленное число. Умолчания у вопроса как не было, так и нет — молчание отбито («${String(mute178.why).slice(0, 62)}…»). Два правила стоят рядом и не подменяют друг друга: одно про то, СКОЛЬКО ДАТ нужно величине, второе про то, ВЫЧИСЛЯЕТСЯ ли она из двух чисел на одной дате (ИС-47, ИС-15, ADR-0220)`);

  /* #179 — неаддитивность ОБЪЯВЛЕНА РЕКВИЗИТОМ, а не поведением движка: свод формульный
     плюс НАЗВАННЫЙ обязательный разрез, и разрез этот — валюта СВОЕГО объекта. Проверяется
     и в реестре (у всех), и в двери (четырьмя отказами). */
  st = ST.seed();
  const moneyRows = st.registry.filter(r => r.kind === 'показатель' && r.money && !r.somOf && r.src !== 'агрегат');
  const badRoll = moneyRows.filter(r => r.roll !== 'формульный');
  const badBy = moneyRows.filter(r => { const d = ST.DIM(r.rollBy); return !d || d.obj !== r.obj; });
  const bare179 = ST.addIndicator({dates:1, id:'m-r1', name:'Комиссия за ведение счёта', obj:'obj-credit',
    src:'шов', seam:'calcAccrual', field:'interest', money:true, type:'сумма'});
  const ghost179 = ST.addIndicator({dates:1, id:'m-r2', name:'Комиссия за ведение счёта', obj:'obj-credit',
    src:'шов', seam:'calcAccrual', field:'interest', money:true, type:'сумма',
    roll:'формульный', rollBy:'d-nope'});
  const alien179 = ST.addIndicator({dates:1, id:'m-r3', name:'Комиссия за ведение счёта', obj:'obj-credit',
    src:'шов', seam:'calcAccrual', field:'interest', money:true, type:'сумма',
    roll:'формульный', rollBy:'d-bcur'});
  const idle179 = ST.addIndicator({dates:1, id:'m-r4', name:'Комиссия за ведение счёта', obj:'obj-credit',
    src:'поле', key:'k', type:'число', unit:'дн.', rollBy:'d-cur'});
  const good179 = ST.addIndicator({dates:1, id:'m-r5', name:'Комиссия за ведение счёта', obj:'obj-credit',
    src:'шов', seam:'calcAccrual', field:'interest', money:true, type:'сумма',
    round:'коп-2', roll:'формульный', rollBy:'d-cur'});
  ok(179, moneyRows.length === 57 && badRoll.length === 0 && badBy.length === 0 &&
        !bare179.ok && has(bare179.why, 'ИС-44') && has(bare179.why, 'Валюта кредитного договора') &&
        has(bare179.why, 'd-cur') &&
        !ghost179.ok && has(ghost179.why, 'd-nope') &&
        !alien179.ok && has(alien179.why, 'ИС-40') && has(alien179.why, 'obj-borrower') &&
        has(alien179.why, 'd-bcur') && has(alien179.why, 'obj-credit') && has(alien179.why, 'd-cur') &&
        !idle179.ok && has(idle179.why, 'ограничивать нечего') &&
        good179.ok && ST.REC('m-r5').roll === 'формульный' && ST.REC('m-r5').rollBy === 'd-cur',
    `неаддитивность объявлена РЕКВИЗИТОМ записи, а не поведением движка: у всех ${moneyRows.length} денежных строчных записей реестра свод «формульный» (нарушителей ${badRoll.length}) и назван обязательный разрез — валюта СВОЕГО объекта (нарушителей ${badBy.length}). Дверь СПРАШИВАЕТ и не догадывается: молчание отбито и адресовано — «${String(bare179.why).slice(0, 92)}…»; несуществующий разрез отбит («${String(ghost179.why).slice(0, 56)}…»); ЧУЖОЙ разрез валюты отбит отдельно, потому что складывать по признаку, которого в строке нет, нечем, — и отбит С АДРЕСОМ: назван и чужой объект (d-bcur на obj-borrower), и свой разрез валюты, который тут и нужен («${String(alien179.why).slice(-96)}»); и наоборот — разрез свода при неформульном своде тоже отбит: ограничивать сложение у аддитивной величины нечего. Правило проверяемо, а не декларативно: та же запись с названным разрезом заводится свободно (${good179.ok ? 'm-r5: свод «' + ST.REC('m-r5').roll + '», разрез «' + (ST.DIM(ST.REC('m-r5').rollBy) || {}).name + '»' : 'НЕ ЗАВЕЛАСЬ: ' + good179.why}). Умолчания «аддитивна» у денег нет и быть не может — оно и было ловушкой (ИС-44, ADR-0214 §1, ADR-0209 §2)`);

  /* #180 — близнец порождается МЕХАНИЧЕСКИ и в ОДНОМ месте: на сборке реестра и в двери
     заведения работает один и тот же порождатель, один валидатор, один `normRec` и одна
     дверь в схему витрины. Забытый близнец дал бы денежную величину, которую нельзя
     сложить по портфелю, и узналось бы об этом на сведении двух отчётов. */
  st = ST.seed();
  const allInd = st.registry.filter(r => r.kind === 'показатель');
  const noTwinRow = allInd.filter(r => r.money && !r.somOf && r.src !== 'агрегат' && !ST.REC(r.id + '-som'));
  const moneyAgg = allInd.filter(r => r.src === 'агрегат' && !r.somOf && r.fn !== 'count' &&
    ST.REC(r.over) && ST.REC(r.over).money && !ST.REC(r.over).somOf);
  const noTwinAgg = moneyAgg.filter(r => !ST.REC(r.id + '-som'));
  const overTwin = moneyAgg.filter(r => (ST.REC(r.id + '-som') || {}).over !== r.over + '-som');
  const declAt = (CODE.match(/declareTwin\(/g) || []).length;
  const shapeAt = (CODE.match(/function somTwinOf\(/g) || []).length;
  const shapeUse = (CODE.match(/somTwinOf\(/g) || []).length;
  const n180 = st.registry.length, mart180 = ST.mart().length;
  const door = ST.addIndicator({dates:1, id:'m-t9', name:'Госпошлина по требованию', obj:'obj-claim',
    src:'шов', seam:'claimDebt', field:'amount', money:true, type:'сумма',
    round:'коп-2', roll:'формульный', rollBy:'d-clcur'});
  const dTwin = ST.REC('m-t9-som');
  const cl = ST.OBJ('obj-claim').inds;
  const ops180 = ST.martLog().slice(-2).map(l => l.op);
  ok(180, noTwinRow.length === 0 && noTwinAgg.length === 0 && overTwin.length === 0 &&
        moneyAgg.length === 57 && shapeAt === 1 && shapeUse === 2 && declAt === 3 &&
        door.ok && door.som === 'm-t9-som' && door.somCol === 'm-t9-som' &&
        dTwin && dTwin.somOf === 'm-t9' && dTwin.unit === 'сом' && dTwin.roll === 'аддитивный' &&
        dTwin.since === ST.REC('m-t9').since && Array.isArray(dTwin.history) &&
        cl.indexOf('m-t9-som') === cl.indexOf('m-t9') + 1 &&
        st.registry.length === n180 + 2 && ST.mart().length === mart180 + 2 &&
        ops180.join(',') === 'ADD COLUMN,ADD COLUMN' && ST.martCol('m-t9-som').nullable === true,
    `близнец порождается МЕХАНИЧЕСКИ и в одном месте. На сборке реестра денежных строчных записей без сомовой стороны ${noTwinRow.length}, денежных агрегатов без неё ${noTwinAgg.length} из ${moneyAgg.length}, и у каждого такого агрегата близнец считает ИМЕННО близнеца (расхождений ${overTwin.length}) — иначе сомовый итог складывал бы валютные колонки. Устройство близнеца описано ровно один раз (${shapeAt} объявление `+"`somTwinOf`"+`, ${shapeUse} обращения), объявление неаддитивности и порождение — одна строка `+"`declareTwin`"+` на обе дороги в реестр (${declAt} обращения: сборка, дверь и само объявление). Дверь проверена делом: одна заявка «${(ST.REC('m-t9') || {}).name || 'ОТБИТА: ' + door.why}» положила в реестр ДВЕ записи (${n180} → ${st.registry.length}), близнец получил ту же дату заведения (${dTwin ? dTwin.since : 'близнеца нет'}), свою историю, место в составе объекта сразу за origin'ом (${cl.indexOf('m-t9')} → ${cl.indexOf('m-t9-som')}) и свою колонку витрины — обе операции журнала «${ops180.join(' · ')}», nullable, без единого UPDATE. Заводи близнеца отдельным вызовом — и первый же забытый дал бы денежную величину, которую нельзя сложить по портфелю, а узналось бы это на сведении двух отчётов (ИС-44, ADR-0214 §2, ADR-0209 §6)`);

  /* #181 — реестр ВЫРОС, и сторожа волны ч.4, считавшие его размер, обновлены ПО ФАКТУ, а
     не смягчены до неравенства. Заодно — три новых разреза валюты у объектов, у которых
     денежные величины были, а разреза свода назвать было нечем. */
  st = ST.seed();
  const nInd = st.registry.filter(r => r.kind === 'показатель').length;
  const nDim = st.registry.filter(r => r.kind === 'разрез').length;
  const ownInd = st.registry.filter(r => r.kind === 'показатель' && !r.somOf).length;
  const somInd = nInd - ownInd;
  const newDims = ['d-ocur','d-clcur','d-mcur'].map(ST.DIM);
  const martCols = ST.mart().length;
  const somCols = ST.mart().filter(c => (ST.IND(c.col) || {}).somOf).length;
  ok(181, st.registry.length === 369 && nInd === 285 && nDim === 84 &&
        ownInd === 171 && somInd === 114 && somInd === 57 * 2 &&
        newDims.every(d => d && /валют/i.test(d.name) && ST.OBJ(d.obj).dims.indexOf(d.id) >= 0) &&
        newDims.map(d => d.obj).join(',') === 'obj-case,obj-claim,obj-measure' &&
        martCols === st.registry.length && somCols === 114,
    `реестр вырос по факту, и число названо, а не смягчено: ${st.registry.length} записей — ${nInd} породы «показатель» (${ownInd} своих и ${somInd} сомовых близнецов: ${somInd / 2} строчных и столько же агрегатов) и ${nDim} породы «разрез». Схема витрины порождена реестром запись в запись (${martCols} колонок, из них сомовых ${somCols}). Трём объектам заведён СВОЙ разрез валюты — ${newDims.map(d => '«' + d.name + '» у ' + ST.OBJ(d.obj).name).join(', ')}: денежные величины у них были, а назвать разрез, внутри которого они складываются, было нечем, и чужой для этого не годится (ИС-40, ИС-44, ADR-0214 §1, ADR-0206 §3)`);

  /* #182 — ADR-0151 §3 оставлен в силе (ADR-0214 §7): период по СОМОВОЙ записи не
     считается, потому что разность двух сомовых снимков несёт курсовую разницу. Отказ
     называет адрес; период по валютной нарастающей считается и приводится к сому один раз. */
  st = ST.seed();
  const flowSom = ST.flowBetween({obj:'obj-credit', inds:'m-accr-som', from:'2026-07-15', to:'2026-08-18'});
  const flowCur = ST.flowBetween({obj:'obj-credit', inds:'m-accr', from:'2026-07-15', to:'2026-08-18'});
  const stock = ST.flowBetween({obj:'obj-credit', inds:'m-total', from:'2026-07-15', to:'2026-08-18'});
  const div = ST.divergence('2026-05', 'obj-credit', 'm-debt');
  ok(182, !flowSom.ok && has(flowSom.why, 'КУРСОВУЮ РАЗНИЦУ') && has(flowSom.why, 'Начислено процентов всего') &&
        has(flowSom.why, 'ADR-0151 §3') && has(flowSom.why, 'ADR-0214 §7') &&
        flowCur.ok && flowCur.value > 0 && flowCur.cur === 'KGS' &&
        !stock.ok && has(stock.why, 'ИС-17') &&
        div.ok && div.ind === 'm-debt-som' && div.inSom === true && div.delta === 16320.17,
    `решение, которое ADR-0214 НЕ отменял, стоит на месте: разность двух сомовых снимков — это движение ПЛЮС курсовая разница, и разделить их в этом числе уже нечем, поэтому период по сомовой записи не считается вовсе. Отказ называет адрес: «${String(flowSom.why).slice(0, 84)}…». Тот же период по валютной нарастающей считается (${flowCur.value} ${flowCur.cur}): разность берётся ВНУТРИ каждой валюты и приводится к сому один раз, курсом конца периода. Остаток за период по-прежнему не спрашивается вовсе (ИС-17). Расхождение зафиксированного с сегодняшним пересчётом тоже сводится сомовой записью, а не своим умножением на курс: «${(ST.IND(div.ind) || {}).name || 'ОТКАЗ: ' + div.why}», ${div.fixed} → ${div.today}, дельта ${div.delta} (ИС-11, ИС-44, ADR-0151 §3, ADR-0214 §7)`);

  /* #183 — ПРАВИЛО ОКРУГЛЕНИЯ ЕСТЬ РЕКВИЗИТ ЗАПИСИ РЕЕСТРА (ADR-0214 §6). Проверка #171
     «у ядра объявление одно» доказывает это ровно наполовину: она говорит, что двух правил
     в коде нет, и молчит о том, что САМА ЗАПИСЬ про своё округление ничего не сообщает.
     Читающий реестр берёт величину в состав отчёта и не видит, до чего она округлена, —
     а реестр и есть контракт (ADR-0150 §5). Не будучи закреплённым за записью, правило и
     оказывалось в трёх местах разным: два отчёта об одном и том же расходились на копейку,
     и разбирать расхождение было нечем. Здесь проверяется вторая половина — реквизит
     ОБЪЯВЛЕН, он ОДИН на весь реестр, и применённое ядром равно названному в записи. */
  st = ST.seed();
  const RULE = CORE.SOM_ROUNDING.id;
  const F183 = vm.runInContext('FIELDS[KIND.IND]', sandbox);
  const RU183 = vm.runInContext('FIELD_RU', sandbox);
  const money183 = st.registry.filter(r => r.kind === 'показатель' && r.money);
  const noRule183 = money183.filter(r => !ST.roundOf(r.id));
  const rules183 = Array.from(new Set(money183.map(r => ST.roundOf(r.id))));
  const own183 = money183.filter(r => r.round);
  const inh183 = money183.filter(r => !r.round);
  const alienRule183 = st.registry.filter(r => r.round && !r.money);
  /* Пара округляется ОДИНАКОВО: сомовая колонка есть произведение валютной на курс той же
     строки, и разные правила у двух сторон развели бы их на копейку внутри одной строки. */
  const pairBad183 = st.registry.filter(r => r.somOf && ST.roundOf(r.id) !== ST.roundOf(r.somOf));
  /* Свод, поток и расхождение НЕ заводят своего правила: они несут в ответе то, что
     объявлено записью, и наследование агрегата — чтение реквизита основания, а не догадка. */
  const aggUsd183 = ST.statSlice({obj:'obj-credit', dims:[], inds:['a-sumdebt'], date: ASK,
    filter: F(cD('d-cur','=',{value:'USD'}))}).total['a-sumdebt'];
  const flow183 = ST.flowBetween({obj:'obj-credit', inds:'m-accr', from:'2026-07-15', to:'2026-08-18'});
  const div183 = ST.divergence('2026-05', 'obj-credit', 'm-debt');
  /* ДВЕРЬ СПРАШИВАЕТ: молчание — отказ, неизвестное правило — отказ с перечислением
     объявленных, правило у неденежной записи — отказ, правило у разреза — чужая порода. */
  const mute183 = ST.addIndicator({dates:1, id:'m-q1', name:'Комиссия за выдачу', obj:'obj-credit',
    src:'шов', seam:'calcAccrual', field:'interest', money:true, type:'сумма',
    roll:'формульный', rollBy:'d-cur'});
  const ghost183 = ST.addIndicator({dates:1, id:'m-q2', name:'Комиссия за выдачу', obj:'obj-credit',
    src:'шов', seam:'calcAccrual', field:'interest', money:true, type:'сумма',
    round:'до рубля', roll:'формульный', rollBy:'d-cur'});
  const idle183 = ST.addIndicator({dates:1, id:'m-q3', name:'Дней до погашения', obj:'obj-credit',
    src:'поле', key:'k', type:'число', unit:'дн.', round: RULE});
  const dim183 = ST.addDim({dates:1, id:'d-q4', name:'Округление платежа', obj:'obj-credit',
    src:'поле', key:'k', perObject:'одно', round: RULE});
  const halfPair183 = ST.addIndicator({dates:1, id:'m-q6-som', name:'Ручная сомовая сторона',
    obj:'obj-credit', src:'шов', seam:'calcDebt', field:'principal', type:'сумма',
    unit:'сом', roll:'аддитивный', somOf:'m-debt'});
  const good183 = ST.addIndicator({dates:1, id:'m-q7', name:'Комиссия за выдачу', obj:'obj-credit',
    src:'шов', seam:'calcAccrual', field:'interest', money:true, type:'сумма',
    round: RULE, roll:'формульный', rollBy:'d-cur'});
  /* Что дверь оставила в реестре, снимается ДО пересева: `ST.seed()` пересобирает
     состояние целиком, и спрошенное после него ответило бы про другой реестр. */
  const left183 = {q1: !!ST.REC('m-q1'), q2: !!ST.REC('m-q2'), q3: !!ST.REC('m-q3'),
    q6: !!ST.REC('m-q6-som'), q7: ST.REC('m-q7'), q7som: ST.REC('m-q7-som')};
  /* Ядро применяет ТО правило, которое названо в записи, а не своё в обход неё. Доказано
     не чтением кода, а подменой: у одной записи правило заменено на необъявленное — её
     сомовая колонка из строки ИСЧЕЗАЕТ (округлять нечем, а «как обычно» здесь и есть
     запрещённое умолчание), у соседней записи той же строки колонка на месте и правило
     в ней прежнее. Бери ядро своё правило в обход записи — подмена не изменила бы ничего. */
  st = ST.seed();
  const row0183 = ST.statRows({obj:'obj-credit', date: ASK}).rows[0];
  const had183 = !!(row0183.inds['m-debt-som'] || {}).v;
  ST.REC('m-debt-som').round = 'до рубля';
  const run183 = ST.run(TODAY, {manual:true, reason:'подменено правило округления'});
  const row1183 = ST.statRows({obj:'obj-credit', date: TODAY}).rows[0];
  const gone183 = !row1183.inds['m-debt-som'];
  const kept183 = (row1183.inds['m-total-som'] || {}).round === RULE;
  ST.REC('m-debt-som').round = RULE;
  ok(183, F183.indexOf('round') >= 0 && RU183.round === 'правило округления' &&
        money183.length === 171 && noRule183.length === 0 &&
        rules183.length === 1 && rules183[0] === RULE &&
        own183.length === 114 && inh183.length === 57 &&
        inh183.every(r => r.src === 'агрегат' && ST.roundOf(r.over) === RULE) &&
        alienRule183.length === 0 && pairBad183.length === 0 &&
        aggUsd183.round === RULE && flow183.ok && flow183.round === RULE &&
        div183.ok && div183.round === RULE &&
        !mute183.ok && has(mute183.why, 'не названо правило округления') &&
        has(mute183.why, 'ADR-0214 §6') && has(mute183.why, RULE) && !left183.q1 &&
        !ghost183.ok && has(ghost183.why, 'не объявлено') && has(ghost183.why, RULE) &&
        !left183.q2 &&
        !idle183.ok && has(idle183.why, 'неденежной') && !left183.q3 &&
        !dim183.ok && has(dim183.why, 'правило округления') && has(dim183.why, 'ИС-43') &&
        !halfPair183.ok && has(halfPair183.why, 'не совпало с правилом') && !left183.q6 &&
        good183.ok && left183.q7 && left183.q7.round === RULE &&
        left183.q7som && left183.q7som.round === RULE &&
        had183 && run183.ok && gone183 && kept183,
    `правило округления — РЕКВИЗИТ ЗАПИСИ, а не свойство кода: «${RU183.round}» стоит в закрытом списке породы «показатель» (${F183.length} реквизитов) и несут его ВСЕ ${money183.length} денежных записей реестра — без правила ${noRule183.length}. Правило на весь реестр ОДНО и названо: ${rules183.join(' · ')}, ровно то, что объявлено ядром. Объявляют его сами ${own183.length} записей — валютные строки и их сомовые стороны; остальные ${inh183.length} суть денежные своды и НАСЛЕДУЮТ его от показателя-основания, как наследуют тип и единицу: «сумма сумм» округляется по правилу слагаемых, и второму правилу в своде взяться неоткуда. У неденежных записей реквизита нет ни одного (${alienRule183.length}) — до копейки округляют сумму, а не дни. У пары стороны округляются одинаково (расхождений ${pairBad183.length}): разные правила развели бы валютную и сомовую колонки одной строки на копейку. Применённое равно объявленному не только в строке (#172), но и там, где раньше округляли по-своему: свод несёт «${aggUsd183.round}», поток — «${flow183.round}», расхождение — «${div183.round}». Дверь СПРАШИВАЕТ и не подразумевает: молчание отбито («${String(mute183.why).slice(0, 88)}…»), неизвестное правило отбито с перечислением объявленных («${String(ghost183.why).slice(0, 96)}…»), правило у неденежной записи отбито, а у разреза отбито ещё и по породе — реквизит чужой. Ручная половина пары с необъявленным правилом отбита сверкой с origin'ом. Та же заявка с названным правилом заводится свободно (${left183.q7 ? 'm-q7 и m-q7-som, правило «' + left183.q7.round + '»' : 'НЕ ЗАВЕЛАСЬ: ' + good183.why}). И главное — ядро берёт правило ИЗ ЗАПИСИ, а не своё в обход неё: подменили правило у «Сумма остатка ОД в сомах» на необъявленное, прогнали заново — её колонка из строки ИСЧЕЗЛА (${gone183 ? 'да' : 'НЕТ'}), а у соседней записи той же строки осталась и с прежним правилом (${kept183 ? 'да' : 'НЕТ'}). Округляй ядро по своему литералу — подмена не изменила бы ничего, и «правило одно на всю систему» осталось бы надписью (ИС-44, ADR-0214 §6, ADR-0150 §5, ADR-0209 §2)`);
})();

/* ---------- АЕ. Волна 17 ч.7: РАЗРЕЖЁННАЯ ЗАПИСЬ (ИС-45, ADR-0215) ----------
   Атом хранения не тронут: строка объекта на дату (ADR-0147 §1). Меняется ПЛОТНОСТЬ.
   До этой волны прогон писал строку каждому живому объекту каждый день — и большинство
   этих строк были копией вчерашней. Копия вчерашнего дня ничего не удостоверяет: она
   не отвечает «на 20.08 было столько», она лишь повторяет вчерашнее теми же словами, —
   а место занимает наравне с настоящей и в журнале выглядит работой. Хуже того, она
   ЛЖЁТ обратной стороной: раз строка есть на каждый день, то отсутствие строки читалось
   как «объекта не было», и различить «не менялось» от «нет данных» стало нечем.
   ADR-0215 разводит три ответа вместо двух: НАПИСАНО НА ЭТУ ДАТУ · НЕ МЕНЯЛОСЬ С ТАКОЙ-ТО
   (строки нет, значение действует) · НЕТ ДАННЫХ (подстановка с возрастом, ИС-12).
   Закрытие периода материализует ПЛОТНЫЙ СЛЕПОК на дату закрытия (§4): наружу уходит
   month-end, и он обязан быть строкой, а не выводом читателя. Промежуточные дни закрытого
   месяца остаются разрежёнными (§5) — они не сдавались. Проверяется здесь семь вещей:
   разрежённость по факту с назван­ным числом · три ответа паспорта и то, что второй не
   красится тревогой · слепок защёлки и §5 · перезапись внутри открытого периода как
   событие журнала, без хранения перезаписанного (§6) · показатель, объявленный посреди
   открытого периода (§7) · фиксация — свойство ПЕРИОДА, а не набора строк · и одна
   дверь чтения на все швы. Границы: ИС-8 не тронут (в закрытое прогон не пишет),
   ИС-12 не тронут (подстановка остаётся подстановкой), ИС-36 не тронут. */
(() => {
  let st = ST.seed();
  const OBJS = st.objects.map(o => o.id);

  /* #184 — РАЗРЕЖЁННОСТЬ ПО ФАКТУ, и число названо, а не смягчено. Ключевое здесь не
     «стало меньше», а «состав не поредел»: по каждому прогонному дню каждого объекта
     as-of-чтение восстанавливает ПОЛНЫЙ плотный состав из разрежённой записи — 379
     строк-состояний из 258 хранимых. Просело бы восстановление хоть на одну строку —
     сумма разошлась бы, и «экономия» оказалась бы потерей (ИС-45, ADR-0215 §1). */
  const plan184 = st.runs.filter(r => r.kind === 'плановый');
  /* Слагаемых стало пять: волна 17 ч.9 (ИС-48) завела «пропущено» — объект, не попавший
     в кандидаты, прогоном НЕ ОБОЙДЁН, и это не то же, что «обошли и не изменилось».
     Плотный состав дня — это все живые записи, как ни разложи их прогон по колонкам,
     и сумма пяти обязана давать те же 379: потеряй `skip` — и разрежённость мерилась бы
     не тем, что не написано, а тем, что не посмотрено (ADR-0221 §1). */
  const would184 = plan184.reduce((n, r) => n + r.parts.reduce(
    (k, p) => k + p.n + (p.same || 0) + (p.have || 0) + (p.kept || 0) + (p.skip || 0), 0), 0);
  const skip184 = plan184.reduce((n, r) => n + r.parts.reduce((k, p) => k + (p.skip || 0), 0), 0);
  const runDates = plan184.map(r => r.date);
  let asOf184 = 0, at184 = 0, lost184 = 0;
  for (const d of runDates) for (const o of OBJS) {
    const A = ST.rowsAsOf(o, d).map(r => r.ref);
    const B = ST.rowsAt(o, d).map(r => r.ref);
    asOf184 += A.length; at184 += B.length;
    /* Написанное на дату обязано входить в состав НА эту дату: расхождение значило бы,
       что перенос вперёд теряет ссылку, которую сам же прогон только что написал. */
    if (B.some(x => A.indexOf(x) < 0)) lost184++;
  }
  /* Разрежённость мерится тем, что НАПИСАЛ ПРОГОН. Легаси-строки писал выпуск миграции,
     прогон их не видит (ИС-41, ADR-0207 §5), и в счёт «сколько копий вчерашнего дня не
     написано» они не идут: их и не было бы кому не написать. */
  const own184 = st.rows.filter(r => !ST.isLegacyRow(r));
  const leg184 = st.rows.filter(r => ST.isLegacyRow(r));
  const repay184 = {at: ST.rowsAt('obj-repay', ASK).length, asOf: ST.rowsAsOf('obj-repay', ASK).length};
  const cred184  = {at: ST.rowsAt('obj-credit', ASK).length, asOf: ST.rowsAsOf('obj-credit', ASK).length};
  const prog184  = {at: ST.rowsAt('obj-program', ASK).length, asOf: ST.rowsAsOf('obj-program', ASK).length};
  ok(184, own184.length === 258 && leg184.length === 34 && would184 === 379 && skip184 > 0 &&
        at184 === 258 && asOf184 === 379 && at184 === own184.length && lost184 === 0 &&
        repay184.at === 0 && repay184.asOf === 14 &&
        cred184.at === 8 && cred184.asOf === 8 &&
        prog184.at === 0 && prog184.asOf === 5,
    `строка появляется, КОГДА ЧТО-ТО ИЗМЕНИЛОСЬ, и число названо по факту: в мире хранится ${own184.length} прогонных строк вместо ${would184} — на ${would184 - own184.length} меньше, и это ровно те, что были копией вчерашнего дня. Состав при этом НЕ ПОРЕДЕЛ: по шести прогонным дням десяти объектов as-of-чтение восстанавливает ${asOf184} строк-состояний — те самые ${would184}, — тогда как физически на этих датах лежит ${at184}, и ни одна написанная на дату строка не выпала из состава на неё (${lost184}). Разрежённость видна поимённо: у «Погашения» на ${ASK} написано ${repay184.at} строк, а действует ${repay184.asOf}; у «Кредита» ${cred184.at} и ${cred184.asOf} — этот менялся; у «Кредитной программы» ${prog184.at} и ${prog184.asOf} — эта не менялась ни разу с мая. Пиши прогон копию каждый день — треть хранилища удостоверяла бы ровно ничего, а журнал показывал бы работу (ИС-45, ADR-0215 §1, ADR-0147 §1). Плотный состав считается по ПЯТИ колонкам паспорта, включая «пропущено» (${skip184} за шесть ночей): с волны 17 ч.9 прогон обходит кандидатов, и необойдённая запись — не написанная и не «без изменений», а не посмотренная вовсе (ИС-48, ADR-0221 §1). Рядом лежат ${leg184.length} ЛЕГАСИ-строк, и в этот счёт они не входят ни одной: их писал выпуск миграции, прогон их не видит, и «копией вчерашнего дня» они не бывают по построению (ИС-41, ADR-0207 §5)`);

  /* #185 — ТРИ ОТВЕТА, А НЕ ДВА. До ADR-0215 их было два — «строка есть» и «строки нет»,
     — и второй склеивал «не менялось» с «нет данных». Разница между ними не academic:
     первое значит «число действует, и оно вот это», второе — «числа на эту дату нет, вот
     соседнее и вот его возраст». Проверяется, что паспорт различает все три И что второй
     НЕ КРАСИТСЯ тревогой: «не менялось» — нормальный ответ, а не оговорка (ИС-45 §2). */
  const P = q => ST.statRows(q).passport;
  const p1 = P({obj:'obj-credit', date: ASK});                 /* написано на эту дату   */
  const p2 = P({obj:'obj-repay',  date: ASK});                 /* не менялось с такой-то */
  const p3 = P({obj:'obj-credit', date:'2026-08-19'});         /* нет данных: подстановка */
  const H185 = vm.runInContext('passportHtml', sandbox);
  const h1 = H185(p1), h2 = H185(p2), h3 = H185(p3);
  ok(185, p1.substituted === false && p1.age === 0 && p1.dense === 8 && p1.carried === 0 &&
        p1.density === null && !/class="pass warn"/.test(h1) && h1.indexOf('Плотность') < 0 &&
        p2.substituted === false && p2.age === 0 && p2.asOf === ASK &&
        p2.dense === 0 && p2.carried === 14 && p2.n === 14 &&
        has(p2.density, 'не менялось') && has(p2.density, 'действуют с 30.06.2026') &&
        has(p2.density, 'а не «нет данных»') && has(p2.density, 'ИС-45') &&
        !/class="pass warn"/.test(h2) && h2.indexOf('Плотность') >= 0 &&
        p3.substituted === true && p3.asOf === '2026-08-18' && p3.age === 1 &&
        has(p3.skipped, 'пропуск') && /class="pass warn"/.test(h3),
    `паспорт различает ТРИ ответа, а не два. Первый — написано на эту дату: «Кредит» на ${ASK}, строк ${p1.dense}, перенесённых ${p1.carried}, про плотность сказать нечего (${p1.density === null ? 'строки нет' : 'ЕСТЬ ЗАПИСЬ'}), и паспорт спокоен. Второй — НЕ МЕНЯЛОСЬ: «Погашение» на ту же дату отвечает ${p2.n} строками, из которых написано на эту дату ${p2.dense}, а перенесено ${p2.carried}, и паспорт говорит вслух: «${String(p2.density).slice(0, 96)}…». Он ТОЖЕ спокоен — «не менялось» есть полноценный ответ, и красить его тревогой значило бы объявить нормальную работу подозрительной. Третий — НЕТ ДАННЫХ: вопрос на 19.08 подставляет 18.08 с возрастом ${p3.age} и называет причину («${String(p3.skipped).slice(0, 52)}…»), и вот ТУТ паспорт помечен тревогой. Склей второй с третьим — «не менялось с 30.06» читалось бы как «данных нет», и первый же читатель принял бы действующее число за дыру (ИС-45, ИС-12, ADR-0215 §2)`);

  /* #186 — ПЛОТНЫЙ СЛЕПОК НА ЗАКРЫТИИ (§4) и разрежённая середина месяца (§5). Наружу
     уходит month-end: он обязан быть СТРОКОЙ, а не выводом читателя, — получатель числа
     не имеет нашего движка и восстановить перенос вперёд ему нечем. Промежуточные дни
     закрытого месяца не сдавались никому и остаются разрежёнными. Порядок внутри двери
     обязателен: сначала слепок, потом фиксация, — иначе материализованные строки легли бы
     в закрытый период НЕЗАФИКСИРОВАННЫМИ, а дописать их потом ИС-8 уже не даст. */
  ST.seed();
  const run186 = ST.run('2026-07-15');
  const sparseBefore = OBJS.filter(o => ST.rowsAt(o, '2026-07-31').length < ST.rowsAsOf(o, '2026-07-31').length);
  const cl1 = ST.closeLayer('2026-07', 'учёт', 'Осмонова Г., главный бухгалтер', '2026-08-05');
  const cl2 = ST.closeLayer('2026-07', 'классификация', 'Турдубаева А., администратор классификации', '2026-08-07');
  const cp186 = ST.closePeriod('2026-07', 'Мамбетов Э., администратор статистики');
  const sparseAfter = OBJS.filter(o => ST.rowsAt(o, '2026-07-31').length < ST.rowsAsOf(o, '2026-07-31').length);
  const sparseMid   = OBJS.filter(o => ST.rowsAt(o, '2026-07-15').length < ST.rowsAsOf(o, '2026-07-15').length);
  const july186 = ST.state.rows.filter(r => r.date >= '2026-07-01' && r.date <= '2026-07-31');
  const made186 = ST.state.rows.filter(r => r.by === 'защёлка' && r.date === '2026-07-31');
  const rec186  = ST.state.runs.filter(r => r.kind === 'защёлка').pop();
  const log186  = ST.state.log.filter(l => has(l.msg, 'слепок дописал'));
  ok(186, run186.ok && run186.written === 37 && run186.same === 21 && run186.born === 7 &&
        sparseBefore.length === 6 && cl1.ok && cl2.ok &&
        cp186.ok && cp186.fixed === 100 && cp186.dense === 19 &&
        sparseAfter.length === 0 && sparseMid.length === 6 &&
        july186.length === 100 && july186.every(r => r.fixed) &&
        made186.length === 19 && made186.every(r => r.fixed) &&
        rec186 && rec186.date === '2026-07-31' && rec186.written === 19 &&
        rec186.actor === 'Мамбетов Э., администратор статистики' &&
        has(rec186.reason, 'закрытие периода июль 2026') && rec186.parts.length === 10 &&
        log186.length === 1 && has(log186[0].msg, 'слепок дописал — ' + cp186.dense),
    `закрытие периода МАТЕРИАЛИЗУЕТ плотный слепок на своей дате. До закрытия на 31.07 разрежённых объектов было ${sparseBefore.length} (${sparseBefore.map(o => ST.OBJ(o).name).join(', ')}) — их состояние действовало, но строкой на month-end не лежало. Дверь закрытия сработала В ОДНОМ ПОРЯДКЕ — слепок, потом фиксация: защёлка дописала ${cp186.dense} строк, и зафиксировано затем ${cp186.fixed}, то есть весь месяц целиком (${july186.length} строк, незафиксированных ${july186.filter(r => !r.fixed).length}), включая все ${made186.length} материализованных. Разрежённых на 31.07 не осталось ни одного. А середина месяца ОСТАЛАСЬ разрежённой — на 15.07 их по-прежнему ${sparseMid.length}: наружу уходил month-end, промежуточные дни не сдавались никому, и уплотнять их значило бы платить местом за то, чего никто не спрашивал. Слепок — событие журнала со своей фамилией и причиной («${rec186.kind}», ${rec186.actor}, «${rec186.reason}»), а не побочный эффект: разница «строк в месяце» до и после закрытия иначе выглядела бы необъяснённой прибавкой. Ставь фиксацию перед слепком — дописанные строки легли бы в закрытый период незафиксированными, и починить их ИС-8 уже не дал бы (ИС-45, ИС-8, ADR-0215 §4, §5, ADR-0204 §3)`);

  /* #187 — ПЕРЕЗАПИСЬ ВНУТРИ ОТКРЫТОГО ПЕРИОДА (§6). Открытый период правится молча —
     это и есть смысл слова «открытый», — но молча НЕ ЗНАЧИТ бесследно: журнал называет
     объект, ссылку и ПОЛЯ, которые переписаны. Чего журнал НЕ хранит — так это самих
     перезаписанных значений: хранить их значит завести вторую историю рядом с первой,
     а история строки одна, и она в самой строке. Проверяется делом: курс доллара
     уточнён задним числом, прогон повторён, — и видно, что переписано, а не что было. */
  st = ST.seed();
  const RATES = vm.runInContext('RATES', sandbox);
  const cellOf187 = () => ((ST.rowsAt('obj-credit', ASK)
    .find(r => r.ref === 'КД-2025/043') || {inds:{}}).inds['m-total-som'] || {});
  const was187 = cellOf187().v;
  const nRows187 = st.rows.length;
  RATES.USD.push([ASK, 90.15]);
  const run187 = ST.run(ASK, {manual:true, reason:'курс доллара уточнён задним числом'});
  const rec187 = ST.state.runs[ST.state.runs.length - 1];
  const rw187 = rec187.parts.filter(p => p.rewrote.length);
  const e187 = ((rw187[0] || {}).rewrote || [])[0] || {ref:'—', fields:[]};
  const cell187 = cellOf187();
  const dup187 = ST.state.rows.filter(r => r.date === ASK)
    .reduce((a, r) => { const k = r.obj + '/' + r.ref; a[k] = (a[k] || 0) + 1; return a; }, {});
  const J187 = JSON.stringify(ST.state.runs);
  RATES.USD.pop();
  ok(187, run187.ok && run187.written === 6 && run187.same === 70 && run187.rewrote === 2 &&
        run187.born === 0 && run187.kept === 0 &&
        ST.state.rows.length === nRows187 + 4 &&
        rw187.length === 2 && rw187.map(p => p.obj).join(',') === 'obj-credit,obj-borrower' &&
        Object.keys(e187).sort().join('|') === 'fields|ref' && e187.ref === 'КД-2025/043' &&
        e187.fields.every(f => !!ST.REC(f)) && e187.fields.indexOf('m-total') >= 0 &&
        e187.fields.indexOf('m-total-som') >= 0 &&
        Object.keys(dup187).every(k => dup187[k] === 1) &&
        cell187.v !== was187 && (cell187.parts || []).every(p => p.rateDate === ASK) &&
        J187.indexOf(String(was187)) < 0 && J187.indexOf('88.3') < 0,
    `перезапись внутри ОТКРЫТОГО периода — событие журнала, а не тихая правка и не вторая история. Курс доллара уточнён задним числом на ${ASK}, прогон повторён вручную: строк написано ${run187.written}, из них ПЕРЕЗАПИСАНО на месте ${run187.rewrote} (${rw187.map(p => p.name).join(' и ')}) — физически строк прибавилось ${ST.state.rows.length - nRows187}, потому что перезапись копии не плодит (дублей на дату ${Object.keys(dup187).filter(k => dup187[k] > 1).length}), а ${run187.same} строк не изменились вовсе и не написаны. Журнал называет ССЫЛКУ и ПОЛЯ: «${e187.ref}», ${e187.fields.length} величин — ${e187.fields.slice(0, 3).map(f => '«' + (ST.REC(f) || {name: f}).name + '»').join(', ')} и далее, — и каждое имя разрешается реестром, а не печатается идентификатором. Чего в журнале НЕТ — так это перезаписанных значений: прежней суммы ${was187} в записях прогонов не найти (${J187.indexOf(String(was187)) < 0 ? 'нет' : 'ЕСТЬ'}), прежнего курса 88.3 тоже. Строка несёт НОВЫЙ курс (дата курса «${((cell187.parts || [])[0] || {}).rateDate}»), и история у неё одна — она сама. Храни журнал ещё и старые значения — рядом с историей строки завелась бы вторая, и на первом же расхождении спорили бы, которая из них история (ИС-45, ADR-0215 §6, ADR-0157 §6)`);

  /* #188 — ПОКАЗАТЕЛЬ, ОБЪЯВЛЕННЫЙ ПОСРЕДИ ОТКРЫТОГО ПЕРИОДА (§7). Разрежённость и
     заведение записи сходятся ровно здесь: у объекта, который «не менялся», строки на
     сегодня нет — а новая величина требует её написать. Заполняет её ПРОГОН, а не дверь
     реестра: дверь объявляет, движок считает, и правило «строка пишется на изменение»
     новую колонку изменением и считает. За закрытые периоды величина остаётся ПРОЧЕРКОМ:
     задним числом её не было, и рисовать там ноль значило бы придумать наблюдение. */
  ST.seed();
  const bare188 = ST.run(TODAY);
  const bp188 = ST.state.runs[ST.state.runs.length - 1].parts.find(p => p.obj === 'obj-program');
  ST.seed();
  const add188 = ST.addIndicator({dates:1, id:'m-w17', name:'Вид перечисления по программе',
    obj:'obj-program', src:'поле', key:'pkind', type:'перечисление', roll:'только-свод'});
  /* Волна 17 ч.9 добавила сюда ЗВЕНО, без которого §7 перестал бы работать молча. Прогон
     с ИС-48 обходит кандидатов, а кандидат — это одно из четырёх множеств (ADR-0221 §1), и
     заведение колонки не попадает ни в одно: соседи программы не называли (у неё вообще нет
     соседей), критической даты у неё нет, свой факт не менялся с мая. Пятое множество ради
     этого не заводится — заведение записи реестра САМО ставит живые записи объекта в очередь
     (ADR-0196), и очередь тут ровно на месте: работа поставлена явно тем, кто про неё знает. */
  const q188 = ST.queue().filter(q => q.obj === 'obj-program');
  const run188 = ST.run(TODAY);
  const qAfter188 = ST.queue().filter(q => q.obj === 'obj-program');
  const p188 = ST.state.runs[ST.state.runs.length - 1].parts.find(p => p.obj === 'obj-program');
  const now188 = ST.rowsAt('obj-program', TODAY);
  const old188 = ST.rowsAt('obj-program', '2026-05-31');
  const back188 = ST.statRows({obj:'obj-program', date:'2026-05-31'});
  ok(188, bare188.ok && bp188.n === 0 && bp188.same === 0 && bp188.skip === 5 &&
        add188.ok && add188.since === TODAY && ST.martCol('m-w17') &&
        q188.length === 5 && q188.every(q => q.why === 'досчёт') && qAfter188.length === 0 &&
        run188.ok && p188.n === 5 && p188.same === 0 && p188.born === 0 &&
        run188.written === bare188.written + 5 &&
        now188.length === 5 && now188.every(r => r.inds['m-w17'] !== undefined) &&
        old188.length === 5 && old188.every(r => r.inds['m-w17'] === undefined) &&
        back188.ok && back188.rows.every(r => r.inds['m-w17'] === undefined),
    `величина, объявленная ПОСРЕДИ открытого периода, заполняется ПРОГОНОМ, а не дверью реестра. Без неё «Кредитная программа» в прогоне за ${TODAY} не пишет ни строки, и с волны 17 ч.9 она даже не ОБХОДИТСЯ (написано ${bp188.n}, без изменений ${bp188.same}, пропущено ${bp188.skip}): пять программ не менялись с мая, соседей у программы нет вовсе, и в кандидаты она не попадает ни одним из четырёх путей (ADR-0221 §1). Заведение колонки чинит это не пятым множеством, а ОЧЕРЕДЬЮ: дверь реестра ставит ${q188.length} живых записей на досчёт, прогон их разбирает и очередь пустеет (${qAfter188.length}) — работу ставит тот, кто про неё знает (ADR-0196, ИС-48). Заводим «${add188.id}» с датой заведения ${add188.since} — и тот же прогон пишет по этому объекту ${p188.n} строк вместо ${bp188.n} (всего по миру ${run188.written} против ${bare188.written}): новая колонка ЕСТЬ изменение состояния строки, и правило §1 сработало на ней, не зная, что она новая. Все ${now188.length} строк на ${TODAY} величину несут. За май её нет ни в одной строке (${old188.filter(r => r.inds['m-w17'] !== undefined).length} из ${old188.length}), и срез за май отдаёт по ней прочерк, а не ноль: задним числом этой величины не существовало, и ноль там был бы придуманным наблюдением. Заполняй её дверь реестра — заведение показателя стало бы записью в историю, которой не было (ИС-45, ИС-33, ADR-0215 §7, ADR-0209 §4)`);

  /* #189 — ФИКСАЦИЯ ЕСТЬ СВОЙСТВО ПЕРИОДА, А НЕ НАБОРА СТРОК. Ловушка, которую открыл
     сам перенос вперёд: ответ на открытую дату состоит теперь ИЗ ЧУЖИХ строк, и часть
     из них лежит в закрытых периодах — зафиксированная. Считай фиксацию по строкам —
     и открытый август отвечал бы «смешанно», то есть «часть этих чисел уже не изменится»,
     а это неправда: не изменится ПРОШЛОЕ этих строк, но ответ дан на открытую дату и
     завтрашним прогоном перепишется весь. Фиксация читается по периоду ОТВЕТА — и право
     на это даёт не ADR-0215, а границы ADR-0216: «кто ответил · как датирована величина ·
     в каком состоянии период» суть ТРИ разных реквизита, и третий про период. При этом
     «смешанно» не выброшено: у РЯДА точки лежат в разных периодах, и там оно правда. */
  ST.seed();
  const a189 = ST.statRows({obj:'obj-repay', date: ASK});
  const carried189 = ST.rowsAsOf('obj-repay', ASK);
  const b189 = ST.statRows({obj:'obj-credit', date:'2026-05-31'});
  const ser189 = ST.statSeries({obj:'obj-credit', inds:'a-sumdebt',
    dates:['2026-05-31','2026-06-30','2026-07-31', ASK]});
  ok(189, a189.passport.fixation === 'не зафиксировано' && a189.passport.fixedBy === null &&
        a189.passport.carried === 14 && carried189.length === 14 &&
        carried189.filter(r => r.fixed).length === 3 &&
        b189.passport.fixation === 'зафиксировано' &&
        has(b189.passport.fixedBy, 'Мамбетов') && b189.passport.fixedAt === '2026-06-08' &&
        ser189.ok && ser189.passport.fixation === 'смешанно' &&
        ser189.points.map(p => p.fixation).join('|') ===
          'зафиксировано|зафиксировано|не зафиксировано|не зафиксировано',
    `фиксация — свойство ПЕРИОДА ОТВЕТА, а не набора строк, из которых ответ собран. Перенос вперёд создал ловушку: «Погашение» на ${ASK} отвечает ${a189.passport.carried} перенесёнными строками, и ${carried189.filter(r => r.fixed).length} из них лежат в закрытых периодах — зафиксированные. Считай фиксацию по строкам — паспорт сказал бы «смешанно», то есть «часть этих чисел уже не изменится», а август открыт, и завтрашний прогон перепишет ответ целиком. Паспорт отвечает «${a189.passport.fixation}» и фамилии не называет (${a189.passport.fixedBy === null ? 'null' : 'НАЗЫВАЕТ'}). Закрытый май отвечает «${b189.passport.fixation}» с фамилией и датой простановки: ${b189.passport.fixedBy}, ${b189.passport.fixedAt}. И «смешанно» не выброшено — у РЯДА точки лежат в РАЗНЫХ периодах, и там оно единственно верное: ${ser189.points.map(p => p.date.slice(5) + ' ' + (p.fixation === 'зафиксировано' ? '✔' : '—')).join(' · ')} → «${ser189.passport.fixation}». Оставь фиксацию строчной — и «это число уже не изменится» стояло бы над числом, которое изменится сегодня ночью (ИС-45, ИС-10, ИС-8, ADR-0215 §3, ADR-0204 §6)`);

  /* #190 — ОДНА ДВЕРЬ ЧТЕНИЯ НА ВСЕ ШВЫ. Разрежённость опасна ровно тем, что читать
     её можно двумя способами, и «по дате» — способ неправильный. Пока читатель один,
     ошибиться негде; но швов у модуля семь, и достаточно ОДНОМУ из них взять строки
     по дате, чтобы тот же вопрос получил два разных ответа — и оба «правильных».
     Проверяется, что все двери отвечают ОДНО про объект, у которого на спрошенную дату
     физически ноль строк, и что поток не принимает перенесённые строки за родившиеся. */
  ST.seed();
  const O190 = 'obj-program';
  const sl190  = ST.statSlice({obj:O190, dims:['d-pkind'], inds:['a-count'], date: ASK});
  const rw190  = ST.statRows({obj:O190, date: ASK});
  const ex190  = ST.exportJob({obj:O190, date: ASK});
  const wl190  = ST.workList(O190, ASK);
  const rg190  = ST.registryList(O190, ASK, null);
  /* Ответы дверей снимаются ЗАЩИЩЁННО: перерасти множество порог показа (ИС-22) или
     упрись выгрузка в отказ — сторож обязан провалиться с именем, а не упасть раньше
     собственной проверки. */
  const doors190 = [sl190.n, (rw190.rows || []).length, (ex190.job || {}).n,
    wl190.inSlice, rg190.length];
  /* Поток: база периода лежит на разрежённой дате, и два заёмщика приходят в неё
     переносом. Читай базу по дате — они бы «родились» внутри периода, и весь их
     нарастающий итог лёг бы в движение месяца (ИС-17, ADR-0151 §2). */
  const fl190 = ST.flowBetween({obj:'obj-borrower', inds:'m-brepaid', from:'2026-07-31', to: ASK});
  const baseAt190 = ST.rowsAt('obj-borrower', '2026-07-31').length;
  const baseAs190 = ST.rowsAsOf('obj-borrower', '2026-07-31').length;
  ok(190, ST.rowsAt(O190, ASK).length === 0 && ST.rowsAsOf(O190, ASK).length === 5 &&
        doors190.every(n => n === 5) && sl190.passport.dense === 0 && sl190.passport.carried === 5 &&
        sl190.passport.asOf === ASK && wl190.asOf === ASK &&
        ex190.ok && ex190.job.passport.carried === 5 &&
        fl190.ok && fl190.born.length === 0 && fl190.value === 462720 &&
        baseAt190 === 6 && baseAs190 === 8 && fl190.passport.n === 16 &&
        fl190.passport.dense === 6 && fl190.passport.carried === 10,
    `разрежённость читается ОДНОЙ дверью, иначе один и тот же вопрос получает два ответа, и оба «правильных». У «Кредитной программы» на ${ASK} строк физически ${ST.rowsAt(O190, ASK).length}, а действует ${ST.rowsAsOf(O190, ASK).length} — и все пять швов отвечают одинаково: срез ${sl190.n}, список ${(rw190.rows || []).length}, выгрузка ${(ex190.job || {}).n}, «работать со списком» ${wl190.inSlice}, реестр владельца ${rg190.length}. Паспорт при этом не скрывает, из чего ответ собран: написано на дату ${sl190.passport.dense}, перенесено ${sl190.passport.carried}, — и то же самое едет ВНУТРИ файла выгрузки (${((ex190.job || {}).passport || {}).carried}). Поток тоже читает базу переносом: движение «${ST.REC('m-brepaid').name}» с 31.07 по ${ASK} равно ${fl190.value}, родившихся внутри периода ${fl190.born.length}, — при том что на 31.07 строк ${baseAt190}, а заёмщиков ${baseAs190}: двое пришли в базу переносом. Читай поток базу по дате — эти двое «родились» бы внутри периода, и весь их нарастающий итог лёг бы в движение месяца как выдача, которой не было (ИС-45, ИС-14, ИС-17, ADR-0215 §1, ADR-0151 §2)`);

  /* #191 — ПОДПИСЬ ФИКСАЦИИ БЕРЁТСЯ У ЗАЩЁЛКИ ПЕРИОДА, А НЕ У ПЕРВОЙ ПОПАВШЕЙСЯ СТРОКИ.
     Вторая половина того же довода, что и #189, и ловушка в ней тоньше: слово
     «зафиксировано» уже считалось по периоду, а ФАМИЛИЯ и ДАТА — ещё по строкам ответа.
     Пока строка писалась каждой дате, разницы не было: строки ответа лежали в его же
     периоде. Разрежённость их развела — ответ на 15 июля собирается ИЮНЬСКИМИ строками,
     замороженными 09.07, — и под июльским числом стояла бы дата закрытия ИЮНЯ. Не
     мелочь: подпись отвечает на «кто за это отвечает», и назвать чужой месяц значит
     послать спорщика не к тому человеку и не за тот период (ИС-9, ADR-0216, границы). */
  ST.seed();
  ST.run('2026-07-15');
  ST.closeLayer('2026-07', 'учёт', 'Осмонова Г., главный бухгалтер', '2026-08-05');
  ST.closeLayer('2026-07', 'классификация', 'Турдубаева А., администратор классификации', '2026-08-07');
  ST.closePeriod('2026-07', 'Мамбетов Э., администратор статистики');
  const lt191 = ST.latch('2026-07') || {};
  /* «Кредитная программа» на 15.07 — ЧИСТЫЙ случай: своих строк ноль, все пять
     перенесены из июня, и других дат фиксации в ответе нет вовсе. */
  const pg191 = ST.statRows({obj:'obj-program', date:'2026-07-15'});
  const pgFix191 = [...new Set(ST.rowsAsOf('obj-program', '2026-07-15')
    .map(r => (r.fixed || {}).at))];
  /* Погашения на ту же дату — СМЕШАННЫЙ: четыре строки свои, четыре перенесены, и дат
     фиксации в ответе две. Ответ обязан назвать ОДНУ — ту, что у периода. */
  const rp191 = ST.statRows({obj:'obj-repay', date:'2026-07-15'});
  const rpFix191 = [...new Set(ST.rowsAsOf('obj-repay', '2026-07-15')
    .map(r => (r.fixed || {}).at))].sort();
  /* А в ОТКРЫТОМ периоде подписи нет вовсе, хотя зафиксированные строки в ответе есть:
     подписывать человека под числом, которое изменится сегодня ночью, нельзя. */
  const op191 = ST.statRows({obj:'obj-repay', date: ASK});
  const opFixed191 = ST.rowsAsOf('obj-repay', ASK).filter(r => r.fixed).length;
  ok(191, lt191.at === TODAY && pgFix191.length === 1 && pgFix191[0] === '2026-07-09' &&
        pg191.passport.fixation === 'зафиксировано' &&
        pg191.passport.fixedAt === lt191.at && pg191.passport.fixedBy === lt191.by &&
        pg191.passport.dense === 0 && pg191.passport.carried === 5 &&
        rpFix191.length === 2 && rp191.passport.fixedAt === lt191.at &&
        rp191.passport.dense === 4 && rp191.passport.carried === 4 &&
        op191.passport.fixation === 'не зафиксировано' &&
        op191.passport.fixedBy === null && op191.passport.fixedAt === null && opFixed191 === 8,
    `подпись фиксации — реквизит ПЕРИОДА ОТВЕТА, а не строк, которыми ответ собран. Июль закрыт ${lt191.by} ${lt191.at}. Ответ по «Кредитной программе» на 15.07 не имеет НИ ОДНОЙ своей строки (написано ${pg191.passport.dense}, перенесено ${pg191.passport.carried}), и все перенесённые заморожены ${pgFix191.join(', ')} — на закрытии ИЮНЯ. Паспорт подписывает его июльской защёлкой (${pg191.passport.fixedAt}), а не июньской: считай подпись по строкам — и под июльским числом стояла бы дата чужого месяца. У погашений на ту же дату случай смешанный: дат фиксации в ответе две (${rpFix191.join(' и ')}), своих строк ${rp191.passport.dense}, перенесённых ${rp191.passport.carried}, — ответ всё равно называет ОДНУ, июльскую. Обратная сторона: в ОТКРЫТОМ августе подписи нет вовсе (${String(op191.passport.fixedBy)}), хотя зафиксированных строк в ответе ${opFixed191} из ${op191.passport.n} — не изменится их ПРОШЛОЕ, а ответ дан на открытую дату и перепишется весь (ИС-9, ИС-45, ADR-0216 границы, ADR-0215 §2)`);

  /* #192 — ПЛОТНОСТЬ ЕСТЬ СВОЙСТВО ОДНОЙ ОТВЕЧЕННОЙ ДАТЫ, И У РЯДА ЕЁ НЕТ. Ряд — это
     много ответов, у каждого своя дата; сложить их плотности нельзя даже арифметически,
     потому что при переносе вперёд одна и та же строка входит в несколько точек сразу.
     Считай ряд одним мешком строк — и четыре точки по 14 платежей отчитались бы «строк
     40», то есть охватом втрое больше системного, и «не менялось — 25» там, где такого
     числа не существует. Цифра при этом выглядит измеренной, и в том вся опасность.
     Правило двойное: ПЛОТНОСТЬ уезжает в точки, каждая про свою дату; СОСТАВ остаётся у
     ряда, но считается множеством записей, а не суммой точек (ИС-45, ADR-0215 §2). */
  ST.seed();
  const ser192 = ST.statSeries({obj:'obj-repay', inds:'a-count',
    dates:['2026-06-30','2026-07-31','2026-08-10', ASK]});
  const pts192 = ser192.points || [];
  const sum192 = pts192.reduce((k, pt) => k + pt.n, 0);
  const last192 = pts192[pts192.length - 1] || {};
  const html192 = vm.runInContext('passportHtml', sandbox)(ser192.passport);
  ok(192, ser192.ok && ser192.passport.density === null && ser192.passport.dense === null &&
        ser192.passport.carried === null && !has(html192, 'Плотность') &&
        ser192.passport.n === 14 && has(ser192.passport.scope, ': 14') && sum192 === 40 &&
        pts192.map(pt => pt.dense + '/' + pt.carried).join(' ') === '4/0 7/3 4/8 0/14' &&
        pts192[0].density === null && has(last192.density, 'не менялось — 14') &&
        has(last192.density, 'действуют с 30.06.2026') &&
        ser192.passport.fixation === 'смешанно',
    `плотность у РЯДА не спрашивается: она про одну отвеченную дату, а у ряда их четыре. Точки говорят о себе сами — написано/перенесено ${pts192.map(pt => pt.dense + '/' + pt.carried).join(' · ')}: у 30.06 все четыре строки свои и строка «Плотность» у неё не печатается вовсе, к ${ASK} своих не осталось ни одной («${String(last192.density).slice(0, 52)}…»). Паспорт ряда её не печатает (${has(html192, 'Плотность') ? 'ЕСТЬ' : 'нет'}) и не выдумывает: dense ${String(ser192.passport.dense)}, carried ${String(ser192.passport.carried)}. А СОСТАВ у ряда есть, и он МНОЖЕСТВО, а не сумма: точки дают в сумме ${sum192} строк, потому что перенесённая строка входит в каждую точку, где действует, — но платежей в системе ${ser192.passport.n}, и охват называет именно их («${ser192.passport.scope}»). Сложи ряд одним мешком — и он отчитался бы охватом ${sum192} при системных ${ser192.passport.n}, и «не менялось» посчиталось бы по числу, которого нет (ИС-45, ИС-34, ADR-0215 §2)`);
})();

/* ---------- АЖ. Волна 17 ч.8: СТРОКА ПИШЕТСЯ ЧАСТИЧНО (ИС-42, ADR-0208) ----------
   Ночь конечна, а соседей пятеро. На десятках тысяч объектов отказ хотя бы одного шва —
   не авария, а рядовое событие, и до этой волны у прогона не было на него ответа вовсе.
   Из четырёх мыслимых ответов три плохи по-разному: не писать строку — потерять всю ночь
   из-за одного соседа; подставить ноль — он сложится в своде и не оставит следа
   (ADR-0175); подставить вчерашнее — строка перестанет быть снимком на дату и заведёт
   второй путь к числам, ровно устройство легаси-остатка (E2E-09). Остаётся четвёртый:
   писать тем, что получено, и ОБЪЯВИТЬ недостачу — не в логе, а в самой строке.
   Отсюда восьмое поле `srcs`: колонка источника на каждого спрошенного соседа. Оно не
   нарушает запрета волны 17 ч.6 на восьмое поле, потому что тот запрет был не про счёт
   полей: носителей ЗНАЧЕНИЙ в строке по-прежнему два (#3).
   Проверяется здесь восемь вещей: соседи объявлены списком и всякий шов чей-то · колонка
   ставится ДО ответа, и «не спрашивали» отличимо от «спросили и не получили» · отсутствующее
   остаётся отсутствующим, и сомовая сторона наследует молчание · свод считается и объявляет
   неполноту · дозаполнение — не перезапись · неполную строку нельзя защёлкнуть, а после
   дозаполнения защёлка проходит · затянувшееся молчание — повод с устойчивым ключом ·
   и граница: что молчание делает с разрежённостью (ИС-45).                              */
(() => {
  ST.seed();

  /* #193 — СОСЕД ОБЪЯВЛЕН СПИСКОМ, А НЕ ВЫВЕДЕН ИЗ ИМЕНИ ШВА. «calc*» — соглашение об
     именовании, а соглашение не сторож: `riskCategory` и `payAlloc` не начинаются с
     «calc» и принадлежат разным соседям, а `casePortfolio` и `calcPortfolio` похожи
     настолько, что разбор по имени рано или поздно склеил бы их. Отсюда список.
     Тотальность проверяется в ОБЕ стороны: всякий шов, который называет хоть одна запись
     реестра, принадлежит ровно одному соседу — иначе в ночь его молчания колонки не
     завелось бы вовсе; и всякий объявленный шов есть у ядра на самом деле — иначе
     объявление было бы надписью. Дверь реестра стережёт то же самое вперёд. */
  const nbs = ST.neighbours();
  const declared = nbs.reduce((a, n) => a.concat(n.seams), []);
  const usedSeams = [...new Set(ST.state.registry.filter(r => r.src === 'шов').map(r => r.seam))];
  const orphanSeam = usedSeams.filter(sm => !ST.nbOfSeam(sm));
  const twice = declared.filter((sm, i) => declared.indexOf(sm) !== i);
  const CORE193 = vm.runInContext('CORE', sandbox);
  const notReal = declared.filter(sm => typeof CORE193[sm] !== 'function');
  const noNb = ST.addIndicator({id:'m-x9', name:'Проба соседа', obj:'obj-credit', src:'шов',
    seam:'grow', field:'x', type:'число', unit:'ед.', dates:1});
  const badNb = ST.run('2026-08-20', {silent:{'ядро расчёта':'недоступен'}});
  const badWhy = ST.run('2026-08-20', {silent:{'ядро':'сеть моргнула'}});
  ok(193, nbs.length === 5 && orphanSeam.length === 0 && twice.length === 0 &&
        notReal.length === 0 && usedSeams.length === 15 &&
        !noNb.ok && has(noNb.why, 'ничьим не бывает') &&
        !badNb.ok && has(badNb.why, 'ИС-42') && has(badNb.why, 'объявленные:') &&
        !badWhy.ok && has(badWhy.why, 'причин четыре') &&
        ST.silenceReasons().length === 4 && ST.nbOfSeam('нетТакогоШва') === null,
    `сосед ОБЪЯВЛЕН списком, а не выведен из имени шва: соседей ${nbs.length} (${nbs.map(n => n.id + ' — ' + n.seams.length).join(' · ')}), «calc*» соглашением об именовании и осталось. Тотальность в обе стороны: швов реестр называет ${usedSeams.length}, ничьих ${orphanSeam.length}, двухозяйных ${twice.length}, объявленных, но у ядра не существующих ${notReal.length}. Дверь стережёт то же вперёд: шов ядра без соседа не заводится — «${String(noNb.why).slice(0, 64)}…». Молчание СПРАШИВАЕТСЯ, а не подразумевается: имя не из списка отбито («${String(badNb.why).slice(0, 52)}…»), причина не из словаря четырёх — тоже («${String(badWhy.why).slice(0, 52)}…»). Свободный текст здесь читался бы человеком и не читался бы поводом заданий (ИС-42, ADR-0208 §2)`);

  /* #194 — КОЛОНКА СТАВИТСЯ ДО ОТВЕТА И НЕЗАВИСИМО ОТ НЕГО. «Спросили и не получили» и
     «не спрашивали вовсе» — разные состояния, и различает их НАЛИЧИЕ колонки, а не её
     содержимое. Отсюда: у объекта, чей состав ни разу не трогает соседа, колонки этого
     соседа нет вовсе, и это ответ, а не пропуск. Дверь к соседям одна — заведи вторую,
     и молчание попало бы в колонку по одной дороге и не попало по другой: строка объявила
     бы себя полной, потеряв половину величин. Проверяется и по коду: чтение ядра внутри
     сборщика встречается ровно там, где стоит дверь. */
  const cols = o => { const r = ST.rowsAsOf(o, '2026-08-20')[0]; return Object.keys((r || {}).srcs || {}).sort(); };
  const cCred = cols('obj-credit'), cBorr = cols('obj-borrower'), cDeal = cols('obj-zdeal');
  const cCase = cols('obj-case'), cProg = cols('obj-program');
  const door = m[1].slice(m[1].indexOf('function readDim'), m[1].indexOf('ST.ROW_SHAPE'));
  const reads = (door.match(/CORE\.read\(/g) || []).length;
  const inAsk = (door.slice(door.indexOf('function askSeam'), door.indexOf('function readSrc'))
    .match(/CORE\.read\(/g) || []).length;
  ok(194, cCred.join() === 'классификация,ядро' && cBorr.join() === 'классификация,кураторство,ядро' &&
        cDeal.length === 0 && cProg.length === 0 && cCase.join() === 'взыскание' &&
        reads === inAsk && reads === 2,
    `колонка источника ставится ДО ответа и независимо от него: у кредита их ${cCred.length} (${cCred.join(' · ')}), у заёмщика ${cBorr.length} (${cBorr.join(' · ')}), у дела взыскания одна (${cCase.join()}), а у залогового договора и кредитной программы НЕТ НИ ОДНОЙ — их состав ни разу не трогает шва, и это ответ, а не пропуск. Проверь строка полноту по содержимому колонок — и «взыскание не спрашивали» стало бы неотличимо от «взыскание не ответило». Дверь к соседям одна: чтений ядра в сборщике ${reads}, и все ${inAsk} стоят внутри неё; заведи вторую — и молчание попало бы в колонку по одной дороге и не попало по другой (ИС-42, ADR-0208 §2, границы)`);

  /* #195 — ОТСУТСТВУЮЩЕЕ ОСТАЁТСЯ ОТСУТСТВУЮЩИМ. Ни нуля, ни вчерашнего, ни интерполяции
     (ADR-0175). Ноль сложился бы в своде и прошёл в отчёт, не оставив следа: отличить
     «взыскано ноль» от «взыскание промолчало» стало бы нечем. Вчерашнее выглядит полной
     строкой и заводит второй путь к числам — устройство E2E-09. Сомовая сторона (ИС-44)
     наследует молчание сама собой, потому что считается ИЗ величины, а не рядом с ней:
     нет основания — нет и сомовой колонки, и подставить ей ноль неоткуда. */
  ST.seed();
  const was195 = ST.rowsAsOf('obj-credit', '2026-08-18').find(r => r.ref === 'КД-2025/043');
  const mute195 = ST.run('2026-08-20', {silent:{'ядро':'недоступен'}});
  const now195 = ST.state.rows.filter(r => r.date === '2026-08-20' && r.obj === 'obj-credit')
    .find(r => r.ref === 'КД-2025/043');
  const riskD = (ST.state.registry.find(r => r.kind === 'разрез' && r.obj === 'obj-credit' &&
    r.seam === 'riskCategory') || {}).id;
  const zeros195 = Object.keys(now195.inds).filter(id => now195.inds[id] && now195.inds[id].v === 0);
  ok(195, mute195.ok && mute195.partial > 0 &&
        was195.inds['m-debt'] && was195.inds['m-debt-som'] &&
        now195.inds['m-debt'] === undefined && now195.inds['m-debt-som'] === undefined &&
        !('m-debt' in now195.inds) && !('m-debt-som' in now195.inds) &&
        riskD && now195.dims[riskD] !== undefined && now195.dims[riskD] === was195.dims[riskD] &&
        (now195.srcs['ядро'] || {}).ok === false && (now195.srcs['ядро'] || {}).reason === 'недоступен' &&
        (now195.srcs['классификация'] || {}).ok === true && zeros195.length === 0,
    `отсутствующее осталось отсутствующим: у КД-2025/043 на 18.08 остаток был (${(was195.inds['m-debt'] || {}).v}) и сомовая сторона была (${(was195.inds['m-debt-som'] || {}).v}), в ночь молчания ядра не стало НИ ОДНОЙ — не ноль, не вчерашнее, а отсутствие ключа. Нулей в строке ${zeros195.length}: ноль сложился бы в своде и прошёл в отчёт, не оставив следа, а вчерашнее выдало бы строку за снимок на дату и завело второй путь к числам (E2E-09). Сомовая величина наследует молчание сама собой: она считается ИЗ основания, а не рядом с ним, и подставить ей нечего (ИС-44). Величины ОТВЕТИВШЕГО соседа при этом легли на место: категория «${String(now195.dims[riskD])}» пришла классификацией, чья колонка ok. Неполных строк за ночь — ${mute195.partial} (ИС-42, ADR-0208 §1)`);

  /* #196 — СВОД ПО НЕПОЛНЫМ СТРОКАМ СЧИТАЕТСЯ И ОБЪЯВЛЯЕТ НЕПОЛНОТУ (§6). Не молчит и не
     отказывает: показывает то, что есть, и называет, сколько строк и кто не ответил.
     Это ровно то, чем ADR-0208 не отменяет ADR-0178: там правило ЧТЕНИЯ (ответ шва бывает
     полным или никаким), здесь правило ЗАПИСИ. Противоречия нет, пока неполнота объявлена
     в паспорте, а не выдана за целое. Паспорт несёт её в обеих формах — полной и краткой,
     и в разметке она красится тревогой, как и всё, что меняет цену ответа (ИС-10). */
  ST.seed();
  ST.run('2026-08-20', {silent:{'классификация':'не уложился в срок'}});
  const rr196 = ST.statRows({obj:'obj-credit', date:'2026-08-20'});
  const sl196 = ST.statSlice({obj:'obj-credit', date:'2026-08-20', inds:['a-count','a-sumdebt']});
  const p196 = rr196.passport.partial || {n:0, neighbours:[], text:'—'};
  const html196 = vm.runInContext('passportHtml', sandbox)(rr196.passport);
  ST.seed();
  const clean196 = ST.statRows({obj:'obj-credit', date:'2026-08-20'});
  const htmlC196 = vm.runInContext('passportHtml', sandbox)(clean196.passport);
  ok(196, rr196.ok && sl196.ok && rr196.passport.partial && p196.n === 8 &&
        p196.neighbours.join() === 'классификация' &&
        has(p196.text, 'не уложился в срок') && has(p196.text, 'ни нулём, ни вчерашним') &&
        has(rr196.passport.short, 'НЕПОЛНО 8') && has(html196, 'Полнота') &&
        sl196.passport.partial && sl196.passport.partial.n === 8 && sl196.total != null &&
        clean196.passport.partial === null && !has(clean196.passport.short, 'НЕПОЛНО') &&
        !has(htmlC196, 'Полнота'),
    `свод по неполным строкам СЧИТАЕТСЯ и объявляет неполноту, а не молчит и не отказывает: строк ${p196.n}, сосед назван («${String(p196.text).slice(0, 96)}…»), свод посчитан и число выдано. Паспорт несёт это в обеих формах — в полной строкой «Полнота» (${has(html196, 'Полнота') ? 'есть' : 'НЕТ'}) и в краткой («${rr196.passport.short}»), наравне с датой расчёта и признаком фиксации (ИС-10). На полном ответе ни того, ни другого не печатается вовсе (${String(clean196.passport.partial)}): признак появляется, когда есть о чём говорить. ADR-0178 этим не отменён — там правило ЧТЕНИЯ (ответ шва полный или никакой), здесь правило ЗАПИСИ, и часть за целое не выдана (ИС-42, ADR-0208 §6, границы)`);

  /* #197 — ДОЗАПОЛНЕНИЕ — НЕ ПЕРЕЗАПИСЬ. Было отсутствие, стало значение: событием
     журнала «переписано значение» это не является, и путать их нельзя — иначе разбор
     ночи утонул бы в перезаписях, которых не было. Различие механическое, а не на
     слово: дозаполнено то, что раньше не пришло ОТ МОЛЧАВШЕГО соседа и теперь пришло от
     ответившего; всё прочее — перезапись. Колонка источника при этом переворачивается. */
  ST.seed();
  const mute197 = ST.run('2026-08-20', {silent:{'ядро':'недоступен'}});
  const fill197 = ST.run('2026-08-20', {});
  const row197 = ST.state.rows.filter(r => r.date === '2026-08-20' && r.obj === 'obj-credit')
    .find(r => r.ref === 'КД-2025/043');
  const bl197 = ST.periodBlockers('2026-08').blockers.length;
  ok(197, mute197.ok && mute197.partial > 0 && mute197.filled === 0 && mute197.rewrote > 0 &&
        fill197.ok && fill197.filled > 0 && fill197.rewrote === 0 && fill197.partial === 0 &&
        (row197.srcs['ядро'] || {}).ok === true && (row197.srcs['ядро'] || {}).src === 'шов' &&
        !('reason' in (row197.srcs['ядро'] || {})) && row197.inds['m-debt'] &&
        row197.inds['m-debt-som'] && bl197 === 0,
    `дозаполнение — НЕ перезапись: ночь молчания дала переписанных величин ${mute197.rewrote} и дозаполненных ${mute197.filled} (значения пропали), повторный прогон той же даты — дозаполненных ${fill197.filled} и переписанных ${fill197.rewrote} (было отсутствие, стало значение). Различие механическое, а не на слово: дозаполнено то, что раньше не пришло от МОЛЧАВШЕГО соседа и теперь пришло от ответившего. Колонка перевернулась и причину за собой не потащила («не ответил» → «${(row197.srcs['ядро'] || {}).src}», reason ${'reason' in (row197.srcs['ядро'] || {}) ? 'ОСТАЛСЯ' : 'снят'}), остаток и его сомовая сторона вернулись, неполных строк за период ${bl197}. Считай дозаполнение перезаписью — и разбор ночи утонул бы в перезаписях, которых не было (ИС-42, ADR-0208 §4)`);

  /* #198 — НЕПОЛНУЮ СТРОКУ НЕЛЬЗЯ ЗАЩЁЛКНУТЬ ОКОНЧАТЕЛЬНО. Это ОТКАЗ, а не
     предупреждение: пропусти неполноту в окончательное — и «окончательно» перестанет
     что-либо значить, потому что окончательное число собрано из дыр, о которых никто
     больше не спросит. Отказ печатает ПЕРЕЧЕНЬ — кто молчал, по какой причине, сколько
     строк, по каким объектам, — и это готовый рабочий документ для разбора ночи, а не
     текст в логе. Обратная сторона обязательна: починка идёт ОБЫЧНЫМ прогоном, и после
     неё та же защёлка проходит той же дверью — иначе блокировка была бы тупиком. */
  ST.seed();
  ST.run('2026-07-31', {silent:{'классификация':'ответил ошибкой'}});
  const low198 = [ST.closeLayer('2026-07', 'учёт', 'Осмонова Г., главный бухгалтер', '2026-08-05'),
                  ST.closeLayer('2026-07', 'классификация', 'Турдубаева А., администратор классификации', '2026-08-07')];
  const no198 = ST.closePeriod('2026-07', 'Осмонова Г., главный бухгалтер');
  const fix198 = ST.fixationOfMonth('2026-07');
  const fill198 = ST.run('2026-07-31', {});
  const yes198 = ST.closePeriod('2026-07', 'Осмонова Г., главный бухгалтер');
  ok(198, low198.every(r => r.ok) && !no198.ok && no198.blockers && no198.blockers.length === 1 &&
        has(no198.why, 'строки неполны') && has(no198.why, 'ответил ошибкой') &&
        has(no198.why, 'Кредит — 8') && has(no198.why, 'ADR-0208 §4') && !fix198 &&
        fill198.ok && fill198.filled > 0 && yes198.ok && yes198.fixed > 0 &&
        ST.fixationOfMonth('2026-07'),
    `неполную строку нельзя защёлкнуть окончательно — и это ОТКАЗ, а не предупреждение: закрытие июля отбито, месяц остался незакрытым (${fix198 ? 'ЗАКРЫТ' : 'не закрыт'}). Запёрта при этом СВОЯ защёлка, а не чужой период: нижние слои общего календаря — учёт и классификация — закрылись независимо (${low198.filter(r => r.ok).length} из ${low198.length}), и в сводку препятствий кредитного модуля (ADR-0113) отсюда не ушло ничего — ИС-20 сужена ровно на один случай, а не отменена. Отказ печатает перечень для разбора ночи: «${String(((no198.blockers || [])[0] || {}).text)}» — кто молчал, почему, сколько строк, по каким объектам. Пропусти неполноту в окончательное — и «окончательно» перестало бы значить что-либо: числа собраны из дыр, о которых больше никто не спросит. Блокировка не тупик: дозаполнение идёт ОБЫЧНЫМ прогоном (дозаполнено ${fill198.filled}), и та же защёлка той же дверью проходит — зафиксировано строк ${yes198.fixed} (ИС-42, ИС-20 сужена, ADR-0208 §3, §4)`);

  /* #199 — ЗАТЯНУВШЕЕСЯ МОЛЧАНИЕ — ПОВОД МОДУЛЮ ЗАДАНИЙ (§7), А НЕ ТЕХНИЧЕСКАЯ ЗАМЕТКА.
     Считается по ЖУРНАЛУ ПРОГОНОВ, а не по строкам: сосед, молчавший по объектам, у
     которых в ту ночь ничего не менялось, строки не оставил вовсе (ИС-45), и по строкам
     его молчание выглядело бы короче, чем было. Подряд — значит подряд: ответившая ночь
     обнуляет счёт, потому что повод ею и закрывается. Ключ устойчив (вид + сосед) —
     иначе каждую ночь заводился бы новый повод об одном и том же.
     ГРАНИЦА: модуля заданий в макете нет, и повод здесь ОБЪЯВЛЕН, а не отдан. */
  ST.seed();
  const l0 = ST.silenceLeads();
  ST.run('2026-08-20', {silent:{'взыскание':'отказал по правам'}});
  ST.run('2026-08-20', {silent:{'взыскание':'отказал по правам'}});
  const l2 = ST.silenceLeads();
  ST.run('2026-08-20', {silent:{'взыскание':'недоступен','кураторство':'недоступен'}});
  const l3 = ST.silenceLeads();
  const k3 = Object.assign({nb:'—', key:'—', runs:0, reasons:[], text:'—'}, l3[0] || {});
  ST.run('2026-08-20', {});
  const l4 = ST.silenceLeads();
  ok(199, l0.length === 0 && l2.length === 0 && l3.length === 1 &&
        k3.nb === 'взыскание' && k3.key === 'сосед-молчит/взыскание/с-2026-08-20' && k3.runs === 3 &&
        k3.reasons.length === 2 && has(k3.text, '3 прогона подряд') && l4.length === 0 &&
        ST.silenceLeads(2).length === 0,
    `затянувшееся молчание — повод, а не заметка: после одной и двух ночей поводов ${l0.length} и ${l2.length}, после третьей — один, и он называет соседа, срок и причины («${k3.text}»). Причин у повода ${k3.reasons.length} (${k3.reasons.join(' · ')}): за три ночи сосед успел отказать по правам и стать недоступным, и повод несёт обе — действия у них разные. Ключ устойчив («${k3.key}»), иначе каждую ночь заводился бы новый повод об одном и том же (ADR-0211). Ответившая ночь счёт обнуляет (${l4.length}): повод ею и закрывается. Считается по ЖУРНАЛУ, а не по строкам — сосед, молчавший там, где ничего не менялось, строки не оставил вовсе (ИС-45). ГРАНИЦА: модуля заданий в макете нет, повод ОБЪЯВЛЕН, а не отдан (ИС-42, ADR-0208 §7)`);

  /* #200 — ЧТО МОЛЧАНИЕ ДЕЛАЕТ С РАЗРЕЖЁННОСТЬЮ (граница к ИС-45). Колонка источника в
     сравнение строк НЕ ВХОДИТ: разрежённость сравнивает СОСТОЯНИЕ, а не обстановку ночи
     (ровно как `fixed` и `by`, волна 17 ч.7). След молчание всё равно оставляет — потому
     что величины ПРОПАЛИ, а пропавшая величина есть настоящая перемена состояния.
     Отсюда следствие, которое надо назвать вслух: ночь молчания пишет строку, а
     дозаполнение возвращает её к прежним числам — и если за ту ночь у объекта не
     изменилось больше НИЧЕГО, строка останется равной предшественнице. В демо-мире таких
     нет (числа растут каждый день), но на статичном объекте случай достижим.
     Строка при этом ОСТАЁТСЯ: снять её значило бы завести прогону операцию удаления
     строки, которой у него нет и заводить которую ради плотности нельзя (ИС-2, #4).
     Ночь была, прогон её отработал, журнал о ней помнит — цена ей одна лишняя строка. */
  ST.seed();
  const before200 = ST.state.rows.length;
  ST.run('2026-08-20', {silent:{'кураторство':'недоступен'}});
  ST.run('2026-08-20', {});
  const rows200 = ST.state.rows.filter(r => r.date === '2026-08-20');
  const key200 = r => JSON.stringify([r.dims, r.inds]);
  const dup200 = rows200.filter(r => {
    const prevs = ST.state.rows.filter(x => x.obj === r.obj && x.ref === r.ref && x.date < r.date)
      .sort((a, b) => a.date < b.date ? -1 : 1);
    const prv = prevs[prevs.length - 1];
    return prv && key200(prv) === key200(r);
  });
  const diff200 = vm.runInContext('rowDiff', sandbox);
  const a200 = rows200[0];
  const b200 = JSON.parse(JSON.stringify(a200));
  b200.srcs = {'кураторство':{ok:false, why:'не ответил', reason:'недоступен'}};
  const editors200 = Object.keys(ST).filter(k => /^(drop|remove|delete)Row/.test(k));
  /* Счёт строк снимается ДО пересева: дальше начинается вторая половина проверки, и она
     заводит свой мир. */
  const grew200 = ST.state.rows.length === before200;
  /* Обратная сторона того же следствия: раз строка, которой молчание ничего не изменило,
     НЕ ПИШЕТСЯ, то и неполной журнал обязан считать НАПИСАННУЮ, а не собранную. Иначе
     прогон отчитывался бы о неполноте, которой в строках нет, и разошёлся бы с перечнем
     защёлки и с паспортом ответа — оба читают неполноту из строк (ИС-15). */
  ST.seed();
  /* Дата ВТОРАЯ, 21-е: именно на ней случай и виден. На 20-е у взыскания меняется всё, что
     молчит, — собранное и написанное совпадают, и мерка не различила бы правило от его
     нарушения. На 21-е три строки собираются неполными и не пишутся: у них не изменилось
     ничего, кроме колонки источника, а она в сравнение не входит (первая половина #200). */
  const mute200 = ST.run(TODAY, {silent:{'взыскание':'не уложился в срок'}});
  const stored200 = ST.state.rows.filter(r => r.date === TODAY && ST.isPartial(r)).length;
  const blk200 = ST.periodBlockers('2026-08').blockers.reduce((n, b) => n + b.n, 0);
  ok(200, grew200 && diff200(a200, b200).length === 0 &&
        dup200.length === 0 && editors200.length === 0 &&
        mute200.partial === stored200 && stored200 === blk200 && stored200 > 0,
    `колонка источника в сравнение строк НЕ входит: подмени её целиком — и разрежённость перемены не увидит (различий ${diff200(a200, b200).length}), потому что сравнивается СОСТОЯНИЕ, а не обстановка ночи, ровно как fixed и by. След молчание всё равно оставляет: величины ПРОПАЛИ, а пропажа есть настоящая перемена. Отсюда следствие, названное вслух: ночь молчания пишет строку, дозаполнение возвращает ей прежние числа, и если за ту ночь у объекта не изменилось больше ничего — строка останется РАВНОЙ предшественнице. В демо-мире таких ${dup200.length} (числа растут каждый день), на статичном объекте случай достижим. Строка при этом остаётся: операций снятия строки у прогона ${editors200.length}, и заводить её ради плотности нельзя (ИС-2). Цена молчания — одна лишняя строка, и она честнее удаления. Обратная сторона того же: неполной считается НАПИСАННАЯ строка, а не собранная — прогон отчитался о ${mute200.partial}, на дату лежит ${stored200} неполных, и столько же насчитала защёлка (${blk200}). Строка, которой молчание ничего не изменило, лежит в «без изменений», и её молчание помнит ЖУРНАЛ прогона, а не строка (ИС-42, ИС-45, ADR-0208 §4, §7, ADR-0215 §1)`);
})();

/* ================== ВОЛНА 17 ч.9 · ИС-48/ИС-49 — КОГО БЕРЁТ НОЧЬ (ADR-0221) ==========
   Легаси считал ночью ВЕСЬ портфель и складывал результат по кредиту; разработчики новой
   системы предложили обратное — трогать только тех, у кого критическая дата. Оба ответа не
   на тот вопрос: первый пишет копию вчерашнего дня (ADR-0215 её уже запретил), второй молча
   теряет всё, что изменилось от СОБЫТИЯ, — платёж, категорию, реструктуризацию, переезд в
   другую область. ADR-0221 разводит их третьим: внутри открытого периода прогон обходит
   КАНДИДАТОВ, на защёлке — ВСЕХ, а кандидаты берутся ОПРОСОМ соседей «кто изменился после T».
   Проверяется здесь восемь вещей: четыре множества и полный обход на защёлке · критическая
   дата как самостоятельное множество, не выводимое из опроса · `T` как реквизит ПАРЫ
   «прогон + сосед» · законная деградация и то, что «кандидатов не было» отличимо от «опрос
   не состоялся» · ответ соседа — КЛЮЧИ, а не значения (E2E-09) · очередь как явная постановка
   работы · неполные строки, возвращающиеся в очередь сами (ADR-0208 §5) · и дверь поводов,
   которой повод ОТДАЁТСЯ, а не объявляется (ADR-0210 §1, ADR-0211).                        */
(() => {
  /* #201 — ЧЕТЫРЕ МНОЖЕСТВА, И «ПРОПУЩЕНО» — ПЯТАЯ КОЛОНКА ПАСПОРТА. Ночь перестала быть
     пропорциональной портфелю: из 76 живых записей прогон за 21.08 берёт 37 и не трогает
     39. Кандидат при этом — не обещание изменения, а АДРЕС РАБОТЫ: из 37 обойдённых 34
     написаны, 3 оказались без изменений, и это законно — иначе «кандидат» значило бы
     «точно изменился», и первое же «посмотрели, не изменилось» выглядело бы ошибкой опроса.
     На защёлке обход полный и по своему доводу: слепок УДОСТОВЕРЯЕТ состояние, а не
     приращает его, и брать для него кандидатов значило бы сдать наружу month-end, собранный
     из тех, кого ночь случайно заметила (§3). Тем же доводом полон первый прогон мира
     (сравнивать не с чем) и повторный прогон за пройденную дату. */
  ST.seed();
  const c201 = ST.candidates(TODAY);
  const r201 = ST.run(TODAY);
  const j201 = ST.state.runs[ST.state.runs.length - 1];
  const first201 = ST.state.runs.find(r => r.kind === 'плановый');
  const again201 = ST.run(TODAY);
  ST.seed();
  ST.closeLayer('2026-07', 'учёт', 'Осмонова Г., главный бухгалтер', '2026-08-05');
  ST.closeLayer('2026-07', 'классификация', 'Турдубаева А., администратор классификации', '2026-08-07');
  const sparse201 = () => ST.state.objects.filter(o =>
    ST.rowsAt(o.id, '2026-07-31').length < ST.rowsAsOf(o.id, '2026-07-31').length).length;
  const wasSparse201 = sparse201();
  const close201 = ST.closePeriod('2026-07', 'Осмонова Г., главный бухгалтер');
  const latch201 = ST.state.runs[ST.state.runs.length - 1];
  ok(201, c201.ok && c201.full === false && c201.n === 37 && r201.cand.n === 37 &&
        r201.written === 34 && r201.same === 3 && r201.skip === 39 &&
        r201.written + r201.same + r201.skip === 76 &&
        Object.keys(j201.cand.by).length === 4 &&
        Object.keys(j201.cand.by).join(' · ') === 'опрос · критическая дата · свой факт · очередь' &&
        first201.cand.scan === 'полный' && has(first201.cand.why, 'первый прогон') &&
        again201.cand.scan === 'полный' && has(again201.cand.why, 'УДОСТОВЕРЯЕТ состояние') &&
        close201.ok && latch201.kind === 'защёлка' && latch201.cand.scan === 'полный' &&
        has(latch201.cand.why, 'ADR-0221 §3') && wasSparse201 === 6 && sparse201() === 0,
    `внутри открытого периода ночь берёт КАНДИДАТОВ, на защёлке — всех (ИС-48). За ${TODAY} кандидатов ${c201.n} из ${r201.written + r201.same + r201.skip} живых записей: написано ${r201.written}, без изменений ${r201.same}, НЕ ОБОЙДЕНО ${r201.skip}. «Пропущено» и «без изменений» — разные колонки паспорта, и слить их нельзя: первое значит «не смотрели вовсе», второе — «посмотрели, и состояние прежнее». Отсюда же и то, что кандидат — не обещание изменения, а адрес работы: ${r201.same} обойдённых записей ничего не изменили, и это не ошибка опроса. Источников в паспорте ровно четыре, поимённо (${Object.keys(j201.cand.by).join(' · ')}), и ни один не выводится из остальных (ADR-0221 §1). Полный обход объявляется своим доводом, а не умолчанием: первый прогон мира — «${String(first201.cand.why).slice(0, 44)}…», повторный прогон за пройденную дату — «${String(again201.cand.why).slice(0, 52)}…», защёлка — «${String(latch201.cand.why).slice(0, 46)}…». Защёлка это и делает: разрежённых объектов на 31.07 было ${wasSparse201}, после закрытия ${sparse201()} — слепок собран по всему охвату, а не по тем, кого ночь заметила (§3, ADR-0215 §4)`);

  /* #202 — КРИТИЧЕСКАЯ ДАТА — САМОСТОЯТЕЛЬНОЕ МНОЖЕСТВО, И ЭТО ПРОВЕРЯЕТСЯ ДЕЛОМ, А НЕ
     СЛОВОМ. Курс — факт ВРЕМЕНИ, а не соседа: у ядра ничего не менялось, оно и не назовёт
     никого, — а сомовая сторона десятка записей стала другой (ADR-0193). Поэтому опрос
     сравнивает значения соседа БЕЗ курса: войди курс в сравнение — множество 2 вывелось бы
     из множества 1, и «ни одно не выводится из остальных» стало бы неправдой на первом же
     дне. Проверка ставит курс задним числом (приём #187) и смотрит, кто приходит только
     критической датой и что ночь без неё потеряла бы. */
  ST.seed();
  const RATES202 = vm.runInContext('RATES', sandbox);
  const bare202 = ST.candidates(TODAY);
  RATES202.USD.push([TODAY, 91.10]);
  const c202 = ST.candidates(TODAY);
  const keys202 = a => a.map(x => x.obj + '|' + x.ref);
  const kd202 = keys202(c202.by['критическая дата']);
  const op202 = keys202(c202.by['опрос']);
  const only202 = kd202.filter(k => op202.indexOf(k) < 0);
  const run202 = ST.run(TODAY);
  RATES202.USD.pop();
  ST.seed();
  const flat202 = ST.run(TODAY);
  ok(202, bare202.by['критическая дата'].length === 0 && bare202.moved.length === 0 &&
        c202.moved.join() === 'USD' && kd202.length === 6 && only202.length === 4 &&
        has((c202.by['критическая дата'][0] || {}).why, 'курс USD менялся после') &&
        run202.written === flat202.written + 4 && flat202.written === 34 &&
        new Set(only202.map(k => k.split('|')[0])).size === 2,
    `критическая дата — СВОЁ множество, а не тень опроса (ADR-0193 × ADR-0221 §1). В обычную ночь курс не двигался, и множество пусто (${bare202.by['критическая дата'].length}, валют ${bare202.moved.length}); уточним курс доллара задним числом на ${TODAY} — и в кандидаты приходит ${kd202.length} записей с названной причиной («${String((c202.by['критическая дата'][0] || {}).why)}»). Ключевое здесь ${only202.length}: столько из них НЕ НАЗВАЛ НИ ОДИН сосед — у ядра и погашений по этим записям не изменилось ничего, изменилось ВРЕМЯ. Записи эти лежат в ${new Set(only202.map(k => k.split('|')[0])).size} объектах, и ночь без множества 2 прошла бы мимо них молча: написано ${run202.written} против ${flat202.written}, разница ${run202.written - flat202.written} — ровно те строки, чья сомовая сторона разошлась бы с курсом. Обратная сторона правила: курс из сравнения значений соседа ВЫЧЕРКНУТ (bareOf) — войди он туда, множество 2 выводилось бы из множества 1, и независимость четырёх множеств была бы словами (ИС-48)`);

  /* #203 — `T` — РЕКВИЗИТ ПАРЫ «ПРОГОН + СОСЕД» (§2), А НЕ ОДНА ДАТА НА ПРОГОН. Общее `T`
     дешевле в записи и дороже в последствиях: молчавший сосед потерял бы свои изменения
     НАВСЕГДА — следующая ночь спросила бы его с уже съеденной даты. Здесь это видно
     механически: ядро молчит, его `T` стоит, у остальных сдвигается, и окно опроса на
     следующую ночь у ядра ШИРЕ ровно на пропущенную ночь. */
  ST.seed();
  const before203 = ST.polls().reduce((a, p) => (a[p.nb] = p.T, a), {});
  const run203 = ST.run(TODAY, {silent:{'ядро':'недоступен'}});
  const after203 = ST.polls().reduce((a, p) => (a[p.nb] = p.T, a), {});
  const next203 = ST.candidates('2026-08-22').polls.reduce((a, p) => (a[p.nb] = p, a), {});
  const vz203 = ST.polls().find(p => p.nb === 'взыскание');
  ok(203, before203['ядро'] === ASK && after203['ядро'] === ASK &&
        after203['классификация'] === TODAY && after203['погашения'] === TODAY &&
        after203['кураторство'] === TODAY && vz203.T === null && vz203.asks === false &&
        next203['ядро'].from === ASK && next203['классификация'].from === TODAY &&
        next203['ядро'].to === '2026-08-22' && run203.ok,
    `момент «после чего спрашивать» — реквизит ПАРЫ «прогон + сосед», а не одна дата на прогон (ADR-0221 §2). Ядро в эту ночь промолчало — и его T остался на ${after203['ядро']}, тогда как у ответивших сдвинулся на ${after203['классификация']}. Следующая ночь спросит ядро за БОЛЬШИЙ интервал: окно ${next203['ядро'].from} → ${next203['ядро'].to} против ${next203['классификация'].from} → ${next203['классификация'].to} у остальных, и пропущенная ночь возвращается в опрос сама. Сдвинь общее T за всех — изменения молчавшего соседа не вернулись бы никогда: спрашивать их было бы уже не с чего. У соседа, который отвечать не умеет, T нет вовсе (${String(vz203.T)}) — и это не пропуск в данных, а другое состояние: спрашивать его не начинали (§5)`);

  /* #204 — ДЕГРАДАЦИЯ ЗАКОННА, И ПАСПОРТ РАЗЛИЧАЕТ ТРИ РАЗНЫЕ ВЕЩИ. «Сосед назвал ноль»,
     «сосед не ответил этой ночью» и «сосед не умеет отвечать никогда» — три состояния с
     тремя разными действиями, и слить их значило бы получить ночь, про которую нельзя
     сказать, была она полной или дырявой (ADR-0221, «Последствия»). Деградация стоит
     времени и НЕ порождает потерь: непонятливый сосед обходится полностью, как на защёлке. */
  ST.seed();
  const c204 = ST.candidates(TODAY);
  const p204 = c204.polls.reduce((a, p) => (a[p.nb] = p, a), {});
  const scan204 = c204.by['опрос'].filter(x => has(x.why, 'не умеет отвечать'));
  const objs204 = [...new Set(scan204.map(x => x.obj))];
  const mute204 = ST.candidates(TODAY, {'кураторство':'не уложился в срок'});
  const pm204 = mute204.polls.find(p => p.nb === 'кураторство');
  ok(204, p204['классификация'].ok === true && p204['классификация'].named === 0 &&
        p204['классификация'].degraded === false &&
        p204['взыскание'].ok === false && p204['взыскание'].degraded === true &&
        p204['взыскание'].asks === false && p204['взыскание'].scanned === 14 &&
        p204['взыскание'].named === 0 && has(p204['взыскание'].why, 'ADR-0221 §5') &&
        scan204.length === 14 && objs204.length === 3 &&
        pm204.degraded === true && pm204.asks === true &&
        has(pm204.why, 'не ответил в эту ночь: не уложился в срок') &&
        mute204.n >= c204.n,
    `«кандидатов не было» и «опрос не состоялся» — РАЗНЫЕ ответы, и паспорт прогона их разводит. Классификация ответила и не назвала никого (ok, названо ${p204['классификация'].named}) — ночь по ней полная. Взыскание отвечать на «кто изменился после T» не умеет вовсе, и это сказано словами («${String(p204['взыскание'].why).slice(0, 62)}…»): его ${p204['взыскание'].scanned} записей в ${objs204.length} объектах обойдены ПОЛНОСТЬЮ, как на защёлке. Законная деградация стоит времени и не порождает потерь — потерял бы её тот, кто счёл бы «не ответил» за «нечего пересчитывать». Третье состояние — «не ответил ЭТОЙ ночью» — отличается от второго причиной и действием: «${String(pm204.why).slice(0, 58)}…», сосед отвечать умеет (${pm204.asks ? 'умеет' : 'нет'}), и завтра его спросят за больший интервал, а не запишут в непонятливые (§5, ADR-0208 §2)`);

  /* #205 — ОТВЕТ СОСЕДА — СПИСОК КЛЮЧЕЙ, А НЕ ЗНАЧЕНИЙ (§6). Это ровно тот шов, на котором
     легаси нажил E2E-09: второй путь к числам. Опрос адресует работу, значения прогон
     по-прежнему берёт швами — и видно это на молчании: адрес есть, чисел нет, строка
     выходит неполной и честно называет молчавшего. Приди значения опросом — молчание шва
     осталось бы незамеченным, и строка вышла бы «полной» из второго источника. */
  ST.seed();
  const c205 = ST.candidates(TODAY, {'ядро':'недоступен'});
  const shape205 = [...new Set(c205.by['опрос'].map(x => Object.keys(x).sort().join(',')))];
  const flat205 = JSON.stringify(c205);
  /* «Значений нет» проверяется по СОСТАВУ реквизитов, а не по наличию цифр: ссылка сама
     бывает числом (ИНН, номер договора), и запрет цифр запретил бы половину ключей. */
  const nums205 = c205.by['опрос'].filter(x => Object.keys(x).some(k => typeof x[k] === 'number'));
  const run205 = ST.run(TODAY, {silent:{'ядро':'недоступен'}});
  const row205 = ST.state.rows.filter(r => r.date === TODAY && r.obj === 'obj-credit')
    .find(r => r.ref === 'КД-2025/043');
  ok(205, shape205.length === 1 && shape205[0] === 'obj,ref,why' && nums205.length === 0 &&
        flat205.indexOf('"v"') < 0 && flat205.indexOf('"parts"') < 0 && flat205.indexOf('"rate"') < 0 &&
        run205.ok && run205.partial > 0 && (row205.srcs['ядро'] || {}).ok === false &&
        row205.inds['m-debt'] === undefined,
    `ответ соседа — список КЛЮЧЕЙ, а не значений (ADR-0221 §6). В составе кандидатов у каждой позиции ровно три реквизита (${shape205[0]}) — объект, ссылка и повод; ни одной величины, ни одного значения в ответе нет — ни числового реквизита (${nums205.length}), ни клетки величины (поля «v», «parts», «rate» ${flat205.indexOf('"v"') < 0 && flat205.indexOf('"parts"') < 0 ? 'отсутствуют' : 'ЕСТЬ'}). Проверяется это не формой, а последствием: ядро назвало адреса и промолчало швом — строк неполных ${run205.partial}, у «КД-2025/043» задолженность не пришла вовсе (${String(row205.inds['m-debt'])}), а колонка источника называет молчавшего. Значения прогон берёт ШВАМИ, как и всегда, и второго пути к числам опрос не заводит: приди они списком изменившихся — молчание шва осталось бы незамеченным, а строка вышла бы «полной» из источника, которого в ADR-0152 §1 нет (E2E-09, ИС-42)`);

  /* #206 — ОЧЕРЕДЬ НЕ ОТМЕНЕНА ОПРОСОМ: очередь — способ ПОСТАВИТЬ работу, кандидаты —
     способ её НАЙТИ, и одно наполняет другое (ADR-0196 × ADR-0221, границы). Поводов у
     очереди три, и они закрыты: очередь без повода не разбирается никогда — снять её нечем
     и объяснить нечем. Закрывается запись ОТМЕТКОЙ, а не удалением: «работа была и сделана»
     обязано отличаться от «работы не было». */
  ST.seed();
  const bad206 = [ST.enqueue('obj-program', 'БК-2021', 'что-нибудь'),
                  ST.enqueue('obj-program', 'нет-такой', 'досчёт'),
                  ST.enqueue('нет-объекта', 'БК-2021', 'досчёт')];
  ST.setRole('Аналитик');
  const role206 = ST.enqueue('obj-program', 'БК-2021', 'досчёт');
  ST.setRole('Администратор статистики');
  const add206 = ST.enqueue('obj-program', 'БК-2021', 'распоряжение', 'пересчёт по просьбе владельца');
  const twice206 = ST.enqueue('obj-program', 'БК-2021', 'распоряжение', 'ещё раз');
  const c206 = ST.candidates(TODAY);
  const run206 = ST.run(TODAY);
  const done206 = ST.queue(true).find(q => q.ref === 'БК-2021');
  ok(206, bad206.every(r => !r.ok) && has(bad206[0].why, 'поводов очереди три') &&
        has(bad206[1].why, 'существующая запись, а не имя') && !role206.ok &&
        has(role206.why, 'администратор статистики') &&
        add206.ok && twice206.ok && ST.queueWhy().length === 3 && c206.n === 38 &&
        c206.by['очередь'].length === 1 && has(c206.by['очередь'][0].why, 'распоряжение') &&
        run206.written === 34 && run206.same === 4 && run206.skip === 38 &&
        ST.queue().length === 0 && ST.queue(true).length === 1 &&
        done206.done.how === 'обойдён прогоном',
    `очередь опросом НЕ отменена: одно ставит работу, другое её находит (ADR-0196 × ADR-0221 §1). Поставленная руками «БК-2021» приходит в кандидаты четвёртым множеством («${c206.by['очередь'][0].why}») — ${c206.n} против ${c206.n - 1} без неё, — и прогон её обходит, хотя ни один сосед её не называл и критической даты у неё нет. Написано при этом ${run206.written}, без изменений ${run206.same}: у программы и правда ничего не изменилось, и это законно — кандидат есть адрес работы, а не обещание перемены. Поводов у очереди три (${ST.queueWhy().join(' · ')}), список закрыт («${String(bad206[0].why).slice(0, 46)}…»), запись должна существовать («${String(bad206[1].why).slice(0, 44)}…»), а ставит работу администратор («${String(role206.why).slice(0, 44)}…»). Повтор той же постановки очередь не удваивает (записей ${ST.queue(true).length}), и закрывается она ОТМЕТКОЙ, а не удалением («${done206.done.how}»): сотри разобранное — и «работа была и сделана» перестало бы отличаться от «работы не было»`);

  /* #207 — НЕПОЛНАЯ СТРОКА ВОЗВРАЩАЕТСЯ В ОЧЕРЕДЬ САМА (ADR-0208 §5). До волны 17 ч.9 это
     держалось на честном слове: молчание было ЗАПИСАНО в строку и в журнал, но никто не
     обязывался прийти за дозаполнением — и в разрежённом мире прийти было НЕ ЗА ЧЕМ, потому
     что следующей ночью объект мог не попасть в кандидаты вовсе. Очередь снимает это:
     прогон, написавший неполную строку, тут же ставит её себе на дозаполнение, и она
     закрывается тем прогоном, который написал строку полной. */
  ST.seed();
  const mute207 = ST.run(TODAY, {silent:{'ядро':'недоступен'}});
  const q207 = ST.queue();
  const c207 = ST.candidates(TODAY);
  const fill207 = ST.run(TODAY, {});
  const done207 = ST.queue(true).filter(q => q.done);
  ok(207, mute207.partial > 0 && q207.length === mute207.partial &&
        q207.every(q => q.why === 'дозаполнение' && q.by === 'прогон' && has(q.note, 'молчали: ядро')) &&
        fill207.filled === mute207.partial && ST.queue().length === 0 &&
        done207.length === q207.length &&
        done207.every(q => q.done.how === 'строка написана полной'),
    `неполная строка возвращается в очередь САМА, и это не заметка, а поставленная работа (ADR-0208 §5). Ночь молчания ядра написала ${mute207.partial} неполных строк — и ровно столько записей встало в очередь на дозаполнение (${q207.length}), каждая с автором «${q207[0].by}» и назван­ным молчавшим («${q207[0].note}»). Следующий прогон их дозаполнил (${fill207.filled}) и очередь закрыл: открытых ${ST.queue().length}, закрытых ${done207.length} с отметкой «${done207[0].done.how}». Без очереди правило висело бы на честном слове: в разрежённом мире объект мог следующей ночью не попасть в кандидаты вовсе, и дозаполнять было бы некому — молчание осталось бы в строке навсегда, а период не закрылся бы (ИС-42, ADR-0221 §1)`);

  /* #208 — ПОВОД ОТДАЁТСЯ, А НЕ ОБЪЯВЛЯЕТСЯ. Волна 17 ч.7 завела правило «затянувшееся
     молчание — повод модулю заданий» и честно назвала границу: повод объявлен, отдать его
     нечем. Дверь закрывает границу по ADR-0211: отдаётся ПОЛНОЕ МНОЖЕСТВО на дату (сверка,
     а не приём — пропущенный опрос ничего не теряет), повторный опрос идемпотентен, а
     отпавший повод просто не приходит. Здесь же чинится ключ: ADR-0211 требует «вид +
     объект + ПЕРИОД», а ключ волны 17 ч.7 нёс только вид и соседа — и два разных молчания,
     разделённые ответившей ночью, слились бы в один незакрытый повод. */
  ST.seed();
  ST.run(ASK, {silent:{'кураторство':'недоступен'}});
  ST.run(ASK, {silent:{'кураторство':'недоступен'}});
  ST.run(ASK, {silent:{'кураторство':'недоступен'}});
  const a208 = ST.askLeads('задания', ASK);
  const b208 = ST.askLeads('задания', ASK);
  ST.run(ASK, {});
  const gone208 = ST.askLeads('задания', ASK);
  ST.run(TODAY, {silent:{'кураторство':'ответил ошибкой'}});
  ST.run(TODAY, {silent:{'кураторство':'ответил ошибкой'}});
  ST.run(TODAY, {silent:{'кураторство':'ответил ошибкой'}});
  const c208 = ST.askLeads('задания', TODAY);
  const alien208 = ST.askLeads('кредиты', TODAY);
  const future208 = ST.askLeads('задания', '2026-09-01');
  /* Шов спрашивает ЗАКОННЫЙ потребитель: спроси чужой — и отказ придёт не о том (модуля
     нет в списке), а проверить надо другое — что поводы швом не спрашиваются В ПРИНЦИПЕ. */
  const seam208 = ST.callSeam('кредиты', 'statLeads', {});
  const asks208 = ST.askLeads('кредиты', TODAY);
  ok(208, a208.ok && a208.full === true && a208.leads.length === 1 &&
        a208.kinds.join() === 'сосед молчит' &&
        JSON.stringify(a208.leads) === JSON.stringify(b208.leads) &&
        a208.leads[0].key === 'сосед-молчит/кураторство/с-' + ASK &&
        a208.leads[0].period === 'молчание с ' + ASK &&
        gone208.ok && gone208.leads.length === 0 && gone208.full === true &&
        c208.leads.length === 1 && c208.leads[0].key === 'сосед-молчит/кураторство/с-' + TODAY &&
        c208.leads[0].key !== a208.leads[0].key &&
        !alien208.ok && has(alien208.why, 'ADR-0210 §1') && !asks208.ok &&
        !future208.ok && has(future208.why, 'СОСТОЯНИЕ на дату') &&
        !seam208.ok && has(seam208.why, 'швов ДАННЫХ три') && has(seam208.why, 'ST.askLeads'),
    `повод ОТДАЁТСЯ дверью, а не объявляется в журнале (ADR-0210 §1, ADR-0211). Три ночи молчания кураторства — и на вопрос заданий статистика отдаёт множество из ${a208.leads.length} повода с видами, которые она вообще умеет заводить (${a208.kinds.join(' · ')}): «поводов нет» иначе не отличить от «этого вида сюда не завели». Отдаётся ПОЛНОЕ множество (сверка, а не приём): пропущенный опрос ничего не теряет, а повторный вопрос того же дня даёт тот же ответ до последнего ключа (идемпотентно). Отпавший повод не исчезает молча — ответившая ночь его закрывает, и в следующем полном множестве его просто нет (${gone208.leads.length}); своего «отменяю задание» статистика не шлёт, закрывает задание тот, кто его вёл. КЛЮЧ ПОЧИНЕН: ADR-0211 требует «вид + объект + период», а волна 17 ч.7 несла вид и соседа — теперь «${a208.leads[0].key}» и «${c208.leads[0].key}» суть РАЗНЫЕ поводы, потому что периодом им служит непрерывная полоса молчания. Слейся они, разбор первой полосы закрыл бы заодно вторую, которой никто не видел. Дверь при этом своя: чужой модуль отбит («${String(alien208.why).slice(0, 52)}…»), будущая дата отбита («${String(future208.why).slice(0, 46)}…»), а швом поводы не спрашиваются вовсе: тот же модуль «кредиты», законный потребитель швов, за поводами швом не проходит — отказ различает вопрос о ДАННЫХ и вопрос о работе и называет дверь («${String(seam208.why).slice(-62)}») (ИС-42, ADR-0208 §7, ADR-0152 §1)`);
})();

/* ================== ВОЛНА 17 З-10 · ИС-39 + ИС-46 — ДАТИРОВКА И ДОСПРОС ==============
   Два инварианта волны 16, стоящие на одном доводе: величина, привязанная ко времени,
   обязана СКАЗАТЬ, как именно она к нему привязана, и защёлка обязана спросить её в тот
   момент, когда за неё расписывается.
   `ИС-39` (ADR-0205): каждая величина несёт «на дату» или «текущее», признак у ВЕЛИЧИНЫ,
   а не у шва и не у ответа; худшее предположение выигрывает; недатированная принимается
   как «текущее». `ИС-46` (ADR-0216): защёлка ПЕРЕСПРАШИВАЕТ соседей перед фиксацией —
   дописывает недостающие строки и переписывает устаревшие, — а после защёлки дата внутри
   закрытого периода отвечается ЧТЕНИЕМ строки, а не пересчётом.
   Проверяется здесь семь вещей: признак принадлежит величине, и один шов отдаёт оба ·
   паспорт несёт датировку четвёртым обязательным реквизитом и берёт худшее по ответу ·
   `when` в сравнение строк НЕ входит (ADR-0205 §5) · доспрос переписывает устаревшее, и
   дописанное с переписанным считаются порознь · молчание на доспросе кончает закрытие до
   единой строки, а рубежа два и отказы у них разные · закрытая дата отвечается чтением ·
   окончательность берётся у КОЛОНКИ СЛОЯ соседа, и три реквизита соседа не выводятся
   друг из друга.                                                                        */
(() => {
  const J    = '2026-07-31';
  const WHO  = 'Осмонова Г., главный бухгалтер';
  const KLS  = 'Турдубаева А., администратор классификации';
  /* Нижние колонки календаря — предусловие закрытия, а не часть проверяемого (ИС-38,
     проверки #137…#141). Без них отказ придёт от календаря, и до доспроса дело не дойдёт. */
  const lower = () => { ST.closeLayer('2026-07', 'учёт', WHO, '2026-08-05');
                        ST.closeLayer('2026-07', 'классификация', KLS, '2026-08-07'); };
  const CORE  = vm.runInContext('CORE',  sandbox);
  const RATES = vm.runInContext('RATES', sandbox);

  /* #209 — ПРИЗНАК ПРИНАДЛЕЖИТ ВЕЛИЧИНЕ, А НЕ ШВУ. Пометить шов целиком дешевле на одну
     строку кода и неверно по существу: `calcPledge` одним вызовом отдаёт и залоговую
     стоимость (её версия на дату восстановима), и «дней с последнего обследования» (карточка
     предмета ПЕРЕЗАПИСЫВАЕТ дату обследования, и на майскую строку сегодня придёт августовский
     счёт дней). Пометь мы дверь — половина её величин получила бы чужой признак, и паспорт
     соврал бы уверенно: либо «всё на дату» поверх текущего счёта дней, либо «всё текущее»
     поверх честного остатка, после чего признак перестал бы что-либо значить.
     Словарь при этом ЗАКРЫТ (ADR-0205 §1) и проверяется счётом, а не на слово: третьего
     слова в `ST.DATING` не появится, и ни одно значение `when` за пределы словаря не выходит. */
  ST.seed();
  const REC209  = id => ST.registry().find(r => r.id === id);
  const row209  = ST.state.rows.find(r => r.obj === 'obj-collateral' && r.when);
  const pl209   = Object.keys(row209.when).filter(id => (REC209(id) || {}).seam === 'calcPledge');
  const now209  = pl209.filter(id => row209.when[id] === 'текущее').slice().sort();
  const asof209 = pl209.filter(id => row209.when[id] === 'на дату');
  const kinds209 = [...new Set(now209.map(id => (REC209(id) || {}).kind))].sort();
  const alien209 = ST.state.rows
    .reduce((a, r) => a.concat(Object.keys(r.when || {}).map(k => r.when[k])), [])
    .filter(v => ST.DATING.indexOf(v) < 0);
  const R209 = id => REC209(id) || {name:'—', seam:'—'};
  ok(209, pl209.length === 15 && asof209.length === 11 && now209.length === 4 &&
        now209.join() === 'd-cctl,m-cnext,m-creval,m-csurv' &&
        row209.when['m-cpledge'] === 'на дату' && row209.when['m-csurv'] === 'текущее' &&
        REC209('m-cpledge').seam === 'calcPledge' && REC209('m-csurv').seam === 'calcPledge' &&
        kinds209.join() === 'показатель,разрез' &&
        ST.DATING.length === 2 && ST.DATING.join() === 'на дату,текущее' &&
        alien209.length === 0 && ST.ROW_ORIGIN.join() === 'when',
    `признак «на дату»/«текущее» принадлежит ВЕЛИЧИНЕ, а не шву (ИС-39, ADR-0205 §1). Одна дверь «calcPledge» отдаёт в строку «${row209.ref}» ${pl209.length} записей реестра — и они расходятся по признаку внутри одного вызова: ${asof209.length} собраны на дату, ${now209.length} текущие (${now209.join(' · ')}). Рядом стоят «${R209('m-cpledge').name}» (${String(row209.when['m-cpledge'])}) и «${R209('m-csurv').name}» (${String(row209.when['m-csurv'])}) — обе из «calcPledge», и вторая честно текущая: карточка предмета перезаписывает дату обследования, поэтому на майскую строку сегодня придёт августовский счёт дней. Пометь мы дверь целиком — половина её величин получила бы чужой признак, и паспорт соврал бы уверенно. Текущими при этом оказываются ОБЕ породы (${kinds209.join(' и ')}): разрез стареет ровно так же, как показатель. Словарь закрыт и проверяется счётом: в «ST.DATING» ровно ${ST.DATING.length} слова (${ST.DATING.join(' · ')}), и по всей витрине нет ни одного значения «when» за их пределами (${alien209.length})`);

  /* #210 — ПАСПОРТ НЕСЁТ ДАТИРОВКУ ЧЕТВЁРТЫМ ОБЯЗАТЕЛЬНЫМ РЕКВИЗИТОМ И БЕРЁТ ХУДШЕЕ.
     Признак у величины, но ОТВЕТ собран из многих величин, и читателю нужен один вывод.
     Правило «худшая часть решает» (ADR-0205 §2) несимметрично намеренно: назови смесь
     «на дату» — и получатель поверит, что отчёт за май, пересобранный в августе, повторится
     числом в число; молчание шва о ретроспективе не есть доказательство ретроспективы.
     Датируется при этом ОСНОВАНИЕ агрегата, а не агрегат: своего происхождения у суммы нет
     вовсе (ИС-3), и в строке она не лежит. Разрез считается наравне с показателем — «вид
     обеспечения», переписанный в карточке, отравляет майский срез ровно так же, как
     переписанный счёт дней. */
  ST.seed();
  const D210 = '2026-05-31';
  const q210 = (dims, inds) => ST.statSlice({obj:'obj-collateral', date: D210, dims, inds});
  const cln210 = q210(['d-cbranch'],  ['a-sumcpledge']);
  const ind210 = q210(['d-cbranch'],  ['a-maxcsurv']);
  const dim210 = q210(['d-collkind'], ['a-sumcpledge']);
  const all210 = ST.statRows({obj:'obj-collateral', date: D210});
  /* Тот же довод, что и у #211: отказавший срез — состояние, ради которого проверка и
     написана, и отчёт о нём обязан печататься, а не падать. */
  const dt = s => (s.passport || {}).dating || {word:'—', n:'—', now:[], asof:[], names:[], text:'—'};
  const sh = s => String((s.passport || {}).short || '—');
  ok(210, cln210.ok && ind210.ok && dim210.ok && all210.ok &&
        ['dating','fixation','mode','short'].every(k => k in cln210.passport) &&
        dt(cln210).word === 'на дату' && dt(cln210).n === 2 && dt(cln210).now.length === 0 &&
        dt(cln210).asof.join() === 'd-cbranch,m-cpledge' &&
        has(dt(cln210).text, 'все величины ответа (2) собраны на дату') &&
        !has(sh(cln210), 'ТЕКУЩЕЕ') &&
        dt(ind210).word === 'смешанно' && dt(ind210).n === 2 &&
        dt(ind210).now.join() === 'm-csurv' && dt(ind210).now.indexOf('a-maxcsurv') < 0 &&
        dt(ind210).names.join() === '«Дней с последнего обследования»' &&
        has(sh(ind210), 'ТЕКУЩЕЕ 1') &&
        has(dt(ind210).text, 'взяты в сегодняшней редакции, а не на 31.05.2026') &&
        dim210.ok && dt(dim210).word === 'смешанно' && dt(dim210).now.join() === 'd-collkind' &&
        dt(all210).word === 'смешанно' && dt(all210).n === 27 && dt(all210).now.length === 12,
    `датировка — ЧЕТВЁРТЫЙ обязательный реквизит паспорта, и берёт он ХУДШЕЕ по ответу (ИС-39, ADR-0205 §2). Срез «${dt(cln210).asof.join(' × ')}» весь собран на дату — паспорт говорит «${dt(cln210).word}» (${dt(cln210).n} величины) и строку про текущее не печатает вовсе. Замени ОДИН показатель на «Дней с последнего обследования» — и ответ становится «${dt(ind210).word}» при тех же ${dt(ind210).n} величинах, с именем виновника (${dt(ind210).names.join(' · ')}) и краткой формой паспорта «${sh(ind210)}», где «ТЕКУЩЕЕ 1» встало рядом с датой и признаком фиксации. Правило несимметрично намеренно: назови смесь «на дату» — и получатель поверит, что майский отчёт, пересобранный в августе, повторится числом в число, а он разойдётся без всякой ошибки. Датируется ОСНОВАНИЕ агрегата, а не агрегат: в «now» стоит «${dt(ind210).now.join()}», а не «a-maxcsurv», — своего происхождения у суммы нет вовсе (ИС-3). РАЗРЕЗ СЧИТАЕТСЯ НАРАВНЕ: тот же чистый показатель под разрезом «${dt(dim210).now.join()}» даёт «${dt(dim210).word}» — переписанный в карточке вид обеспечения отравляет майский срез ровно так же, как счёт дней. Список строк спрашивает обо ВСЁМ, что в строке видно: ${dt(all210).n} величин, из них текущих ${dt(all210).now.length}`);

  /* #211 — `when` В СРАВНЕНИЕ СТРОК НЕ ВХОДИТ (ADR-0205 §5). Это не упущение, а механизм.
     Сосед, исправивший объявление своего шва, меняет ПРОИСХОЖДЕНИЕ будущих величин, а не
     состояние объекта: вчерашний остаток от этого другим не стал. Войди `when` в `rowDiff` —
     правка одного объявления переписала бы витрину целиком, ночь написала бы строку каждому
     объекту охвата, и в журнале это выглядело бы как изменение состояния портфеля, которого
     не было. Проверяется ровно так: объявление правится, и защёлка НЕ переписывает ни одной
     строки; а когда строку переписывают по НАСТОЯЩЕЙ причине, она уносит исправленный признак —
     старые строки держат тот, с которым были собраны. */
  ST.seed();
  const keep211 = CORE.DATING.calcDebt.slice();
  CORE.DATING.calcDebt = keep211.filter(f => f !== 'total');
  lower();
  const flat211 = ST.closePeriod('2026-07', WHO);
  const cred211 = ST.state.rows.filter(r => r.obj === 'obj-credit' && r.date === J);
  const held211 = cred211.filter(r => r.when['m-total'] === 'на дату');
  CORE.DATING.calcDebt = keep211;
  /* Та же правка объявления, но у защёлки есть НАСТОЯЩАЯ причина переписать: курс на 31.07
     уточнён задним числом, уже после последнего прогона (техника проверки #202). */
  ST.seed();
  lower();
  CORE.DATING.calcDebt = keep211.filter(f => f !== 'total');
  RATES.USD.push([J, 91.10]);
  const rew211  = ST.closePeriod('2026-07', WHO);
  const post211 = ST.state.rows.filter(r => r.obj === 'obj-credit' && r.date === J);
  const moved211 = post211.filter(r => r.by === 'защёлка');
  const still211 = post211.filter(r => r.by !== 'защёлка');
  RATES.USD.pop();
  CORE.DATING.calcDebt = keep211;
  /* Отчёт проверки читает СЛОМАННЫЙ мир тоже: пустой список переписанных — как раз то
     состояние, ради которого проверка написана, и падать на нём она не вправе. */
  const mv211 = moved211[0] || {ref:'—', when:{}};
  ok(211, flat211.ok && flat211.dense === 19 && flat211.refreshed === 0 &&
        cred211.length === 8 && held211.length === 8 &&
        rew211.ok && rew211.refreshed === 4 &&
        moved211.length === 1 && moved211[0].ref === 'КД-2025/043' &&
        moved211[0].when['m-total'] === 'текущее' &&
        still211.length === 7 && still211.every(r => r.when['m-total'] === 'на дату') &&
        CORE.DATING.calcDebt.length === keep211.length,
    `датировка в сравнение строк НЕ входит, и это механизм, а не упущение (ADR-0205 §5). Объявление шва «calcDebt» правится — «total» перестаёт быть «на дату», — и защёлка после этого дописывает ${flat211.dense} строк и не переписывает НИ ОДНОЙ (${flat211.refreshed}): все ${cred211.length} кредитных строк на 31.07 держат тот признак, с которым были собраны (${held211.length} из ${cred211.length} — «на дату»). Войди «when» в сравнение — правка ОДНОГО объявления переписала бы витрину целиком, и в журнале это выглядело бы как изменение состояния портфеля, которого не было: сосед сменил происхождение будущих величин, а вчерашний остаток от этого другим не стал. Обратное тоже держится: когда у защёлки появляется НАСТОЯЩАЯ причина переписать (курс на 31.07 уточнён задним числом), переписанная строка уносит ИСПРАВЛЕННЫЙ признак — «${mv211.ref}» вышла с «${String(mv211.when['m-total'])}», а ${still211.length} нетронутых остались с «на дату». Признак ведёт себя ровно как обещано: старые строки — свой, новые — исправленный, и никакая правка объявления не порождает записи`);

  /* #212 — ДОСПРОС ПЕРЕПИСЫВАЕТ УСТАРЕВШЕЕ, И ДОПИСАННОЕ С ПЕРЕПИСАННЫМ СЧИТАЮТСЯ ПОРОЗНЬ.
     До ADR-0216 §2 защёлка только ДОПОЛНЯЛА состав (ADR-0215 §4): чего не было — написать,
     что было — оставить. На разреженном хранении это значит, что в слепок попадала строка,
     собранная соседом три недели назад, — и она уходила наружу с подписью «окончательно».
     Величина, которую закрытие замораживает, обязана быть спрошена В МОМЕНТ замораживания.
     Считаются два числа порознь, потому что это разные события с разной ценой: полнота
     состава и свежесть величин, — и ночь, в которую доспрос ничего не изменил, обязана
     отличаться от ночи, в которую он переписал четыре строки. Общее `written` при этом
     остаётся суммой обоих: суточный итог по журналу складывается одним способом (#63). */
  ST.seed(); lower();
  const base212 = ST.closePeriod('2026-07', WHO);
  ST.seed(); lower();
  const snap212 = {};
  ST.state.rows.filter(r => r.date === J).forEach(r => { snap212[r.obj + '|' + r.ref] = JSON.stringify(r.inds); });
  RATES.USD.push([J, 91.10]);
  const r212 = ST.closePeriod('2026-07', WHO);
  const j212 = ST.state.runs[ST.state.runs.length - 1];
  const chg212 = ST.state.rows.filter(r => r.date === J)
    .filter(r => snap212[r.obj + '|' + r.ref] && snap212[r.obj + '|' + r.ref] !== JSON.stringify(r.inds));
  const kd212 = chg212.find(r => r.ref === 'КД-2025/043');
  const was212 = JSON.parse(snap212['obj-credit|КД-2025/043']);
  RATES.USD.pop();
  const kdw212 = (kd212 || {inds:{}});
  const cell212 = (id, o) => ((o || {})[id] || {}).v;
  ok(212, base212.ok && base212.dense === 19 && base212.refreshed === 0 &&
        r212.ok && r212.dense === 19 && r212.refreshed === 4 && r212.fixed === 63 &&
        j212.kind === 'защёлка' && j212.written === 23 &&
        j212.written === j212.repoll.made + j212.repoll.again &&
        j212.repoll.made === 19 && j212.repoll.again === 4 && j212.repoll.done === true &&
        j212.cand.scan === 'полный' &&
        chg212.length === 4 && kd212 &&
        cell212('m-total-som', was212) === 12920251.35 && cell212('m-total-som', kdw212.inds) === 13390613.18 &&
        j212.parts.filter(p => p.rewrote.length).length === 4,
    `защёлка ПЕРЕСПРАШИВАЕТ, а не только дополняет: величина, которую закрытие замораживает, спрошена в момент замораживания (ИС-46, ADR-0216 §2). Курс на 31.07 уточнён задним числом, уже после последнего прогона, — и доспрос дописал ${r212.dense} строк и ПЕРЕПИСАЛ ${r212.refreshed}, тогда как та же защёлка без уточнения переписывает ${base212.refreshed}. Числа при этом настоящие: у «${kdw212.ref}» сомовый итог ушёл с ${cell212('m-total-som', was212)} на ${cell212('m-total-som', kdw212.inds)} — почти полмиллиона сомов, которые до ADR-0216 §2 ушли бы наружу с подписью «окончательно», потому что прежняя защёлка писала только недостающее и трогать уже написанное не считала нужным. Дописанное и переписанное считаются ПОРОЗНЬ (${j212.repoll.made} против ${j212.repoll.again}): это разные события с разной ценой — полнота состава (ADR-0215 §4) против свежести величин (ADR-0216 §2), — и ночь, в которую доспрос ничего не изменил, обязана отличаться от ночи, в которую он переписал ${chg212.length} строки в ${j212.parts.filter(p => p.rewrote.length).length} объектах. Общее «written» остаётся их суммой (${j212.written} = ${j212.repoll.made} + ${j212.repoll.again}): суточный итог по журналу складывается одним способом (#63), а обход у записи по-прежнему «${j212.cand.scan}» (ADR-0221 §3)`);

  /* #213 — РУБЕЖА ДВА, И ОТКАЗЫ У НИХ РАЗНЫЕ. Молчание ВЧЕРАШНЕЙ ночи и молчание НА ДОСПРОСЕ
     похожи ровно настолько, чтобы их слить, и различаются всем остальным: первое чинится
     обычным прогоном и посылает к нему (ADR-0208 §4), второе прогоном не чинится вовсе —
     последний опрос есть ЧАСТЬ закрытия, и посылает он к соседу (ADR-0216 §2). Слей их — и
     один из двух отказов повёл бы человека не туда.
     Порядок «опрос прежде записи» здесь содержательный, а не стилистический: молчащий сосед
     кончает закрытие ДО единой строки. Напиши защёлка сперва, а спохватись потом — на дату
     слепка легли бы строки, собранные из молчания, и чинить их пришлось бы поверх уже
     написанного. Журнальная запись при этом делается ВСЁ РАВНО: опрос состоялся и кончился
     ничем, а «доспрос не отвечен» и «закрытия не пробовали» — разные ночи. */
  ST.seed();
  ST.run(J, {silent:{'ядро':'недоступен'}});
  lower();
  const y213 = ST.closePeriod('2026-07', WHO);
  ST.seed(); lower();
  const n213  = ST.state.rows.length;
  const at213 = ST.state.rows.filter(r => r.date === J).length;
  const runs213 = ST.state.runs.length;
  /* Дверь предпросмотра спрашивается ПЕРЕД закрытием и не оставляет за собой ничего. */
  const pre213 = ST.repoll('2026-07', {'ядро':'недоступен'});
  const d213 = ST.closePeriod('2026-07', WHO, {'ядро':'недоступен'});
  const j213 = ST.state.runs[ST.state.runs.length - 1];
  const mute213 = (pre213.mute || [])[0] || {nb:'—', name:'—'};
  ok(213, !y213.ok && has(y213.why, 'строки неполны') && has(y213.why, 'ADR-0208 §4') &&
        has(y213.why, 'Дозаполнение идёт обычным прогоном') && y213.blockers.length === 1 &&
        pre213.ok && (pre213.mute || []).length === 1 && mute213.nb === 'ядро' &&
        ST.state.runs.length === runs213 + 1 &&
        !d213.ok && d213.mute.length === 1 &&
        has(d213.why, 'на ДОСПРОСЕ не ответил сосед') &&
        has(d213.why, 'не вчерашнее и прогоном не чинится') &&
        has(d213.why, 'ИС-46, ADR-0216 §2') && has(d213.why, 'Строки не тронуты') &&
        ST.state.rows.length === n213 && ST.state.rows.filter(r => r.date === J).length === at213 &&
        ST.latch('2026-07') === null &&
        j213.kind === 'защёлка' && j213.written === 0 && j213.repoll.done === false &&
        j213.reason === 'доспрос перед закрытием периода июль 2026: не отвечено',
    `рубежа перед колонкой ДВА, и отказы у них разные (ИС-46 против ИС-42). Неполнота, оставленная ВЧЕРАШНЕЙ ночью, отбивается первым и посылает к прогону: «${String(y213.why).slice(0, 96)}…» — молчание чинится ответом, а не защёлкой (ADR-0208 §3, §4). Молчание НА ДОСПРОСЕ отбивается вторым и посылает к СОСЕДУ: «${String(d213.why).slice(0, 104)}…» — прогоном оно не чинится вовсе, потому что последний опрос есть ЧАСТЬ закрытия. Слей эти два отказа — и один из них повёл бы человека не туда. Опрос идёт ПРЕЖДЕ записи, и это видно механически: после отказа строк в мире ${ST.state.rows.length} (было ${n213}), на 31.07 — ${at213}, колонка «статистика» не проставлена (${String(ST.latch('2026-07'))}). Ни одна строка не тронута — молчащий сосед кончает закрытие ДО единой; напиши защёлка сперва, а спохватись потом — на дату слепка легли бы строки, собранные из молчания. Журнальная запись при этом делается ВСЁ РАВНО («${j213.reason}», написано ${j213.written}, доспрос не отвечен): опрос состоялся и кончился ничем, а «доспрос не отвечен» и «закрытия не пробовали» — разные ночи. Спросить об этом можно и ЗАРАНЕЕ: дверь предпросмотра называет молчащего («${mute213.name}») и не оставляет за собой ни строки, ни записи журнала — записей за обе двери ровно одна, от самого закрытия`);

  /* #214 — ПОСЛЕ ЗАЩЁЛКИ ДАТА ОТВЕЧАЕТСЯ ЧТЕНИЕМ, А НЕ ПЕРЕСЧЁТОМ (ADR-0216, решение).
     Это то самое, ради чего доспрос и заведён: пересчёт закрытого мая в августе возьмёт
     сегодняшние реквизиты (ИС-39) и даст ДРУГОЕ число, не нарушив ни одного правила, — и
     защёлка перестанет что-либо удостоверять. Проверяется миром, который изменился ПОСЛЕ
     закрытия: курс на 31.07 уточнён ещё раз, а ответ на 31.07 не двинулся ни на копейку.
     Состояние ответа при этом ВЫВОДИТСЯ из признака фиксации, а не хранится рядом с ним:
     два поля об одном и том же разъезжаются на первой же правке (ИС-15). */
  ST.seed(); lower();
  const cl214 = ST.closePeriod('2026-07', WHO);
  const q214  = () => ST.statSlice({obj:'obj-credit', date: J, dims:['d-branch'], inds:['a-sumdebt-som']});
  const was214 = q214();
  RATES.USD.push([J, 95.00]);
  const now214 = q214();
  const run214 = ST.run(J);
  RATES.USD.pop();
  const open214 = ST.statSlice({obj:'obj-credit', date: ASK, dims:['d-branch'], inds:['a-sumdebt-som']});
  const pp214 = s => (s.passport || {fixation:'—', mode:'—'});
  const sum214 = s => ((s.total || {})['a-sumdebt-som'] || {}).v;
  ok(214, cl214.ok && was214.ok && now214.ok &&
        JSON.stringify(was214.total) === JSON.stringify(now214.total) &&
        sum214(was214) === 31868889.63 &&
        pp214(was214).fixation === 'зафиксировано' &&
        pp214(was214).mode === 'запись фиксации, окончательно' &&
        open214.ok && pp214(open214).fixation === 'не зафиксировано' &&
        pp214(open214).mode === 'расчёт, предварительно' &&
        !run214.ok && has(run214.why, 'зафиксирован') && has(run214.why, 'ИС-8') &&
        ST.answerModes().length === 2 &&
        ST.answerModes().join(' · ') === 'расчёт, предварительно · запись фиксации, окончательно',
    `после защёлки дата внутри закрытого периода отвечается ЧТЕНИЕМ строки, а не пересчётом (ИС-46, ADR-0216). Июль закрыт, курс на 31.07 после этого уточнён ещё раз — и ответ на 31.07 не двинулся ни на копейку (${sum214(was214)} до и после). Пересчитать его нечем: прогон в закрытое отбит («${String(run214.why).slice(0, 62)}…», ИС-8), и второго пути к числу нет. Ровно ради этого доспрос и заведён: пересчёт закрытого мая в августе взял бы СЕГОДНЯШНИЕ реквизиты (ИС-39) и дал бы другое число, не нарушив ни одного правила, — а защёлка перестала бы что-либо удостоверять. Режим ответа паспорт называет словами, и слов ровно два (${ST.answerModes().join(' · ')}): на закрытую дату «${pp214(was214).mode}», на открытую — «${pp214(open214).mode}». Выводится он из признака фиксации («${pp214(was214).fixation}» против «${pp214(open214).fixation}»), а не хранится рядом с ним: два поля об одном и том же разъезжаются на первой же правке (ИС-15). Прежде это было неявным — читатель должен был сам догадаться, что «зафиксировано» значит «прочитано», а не «пересчитано»`);

  /* #215 — ОКОНЧАТЕЛЬНОСТЬ БЕРЁТСЯ У КОЛОНКИ СЛОЯ СОСЕДА, И ТРИ ЕГО РЕКВИЗИТА НЕ ВЫВОДЯТСЯ
     ДРУГ ИЗ ДРУГА. «Верхняя защёлка переспрашивает нижнюю» (ИС-46) — это про КАЛЕНДАРЬ:
     ответ соседа окончателен ровно тогда, когда проставлена колонка ЕГО слоя в общем
     справочнике (ИС-38), и защёлка это ПЕЧАТАЕТ, а не умалчивает. Кураторство слоя не имеет
     вовсе — и это не пробел, а ТРЕТИЙ случай: «окончательности не удостоверяю». Свести его к
     «не закрыт» значило бы обещать, что когда-нибудь он закроется.
     Реквизитов у соседа три, и ни один не выводится из остальных: `layer` (чем удостоверяет),
     `asks` (умеет ли отвечать на «кто изменился после T», ИС-49) и объявленная датировка его
     шва (ИС-39). Взыскание отвечать на опрос НЕ умеет, а колонку слоя имеет и ответ его
     окончателен; кураторство опрос понимает и слоя не имеет вовсе. Выведи одно из другого —
     и обход, деградировавший до полного, потянул бы за собой «предварительность», которой
     нет, либо наоборот. */
  ST.seed();
  const pre215 = ST.repoll('2026-07');
  lower();
  const post215 = ST.repoll('2026-07');
  const nb215 = post215.nbs.reduce((a, n) => (a[n.nb] = n, a), {});
  const cl215 = ST.closePeriod('2026-07', WHO);
  const pol215 = ST.polls().reduce((a, p) => (a[p.nb] = p, a), {});
  const N215 = id => nb215[id] || {layer:'—', final:'—', ok:'—', why:'—'};
  const P215 = id => pol215[id] || {asks:'—'};
  const core215 = pre215.nbs.find(n => n.nb === 'ядро') || {why:'—'};
  ok(215, pre215.ok && pre215.final === 0 && pre215.layerless === 1 &&
        pre215.nbs.every(n => n.final === false) &&
        has(core215.why, 'не проставлена: величины предварительные') &&
        post215.final === 4 && post215.layerless === 1 &&
        nb215['ядро'].layer === 'учёт' && nb215['ядро'].final === true &&
        has(nb215['ядро'].why, 'колонка «учёт» периода июль 2026 проставлена') &&
        has(nb215['ядро'].why, 'ADR-0204 §3, ADR-0216 §3') &&
        nb215['кураторство'].layer === null && nb215['кураторство'].final === false &&
        nb215['кураторство'].ok === true &&
        has(nb215['кураторство'].why, 'окончательности он не удостоверяет') &&
        nb215['взыскание'].layer === 'учёт' && nb215['взыскание'].final === true &&
        pol215['взыскание'].asks === false && pol215['кураторство'].asks === true &&
        Array.isArray(CORE.DATING.leadCurator) && CORE.DATING.leadCurator.length === 3 &&
        cl215.ok && JSON.stringify(cl215.repoll) === JSON.stringify(post215.nbs),
    `окончательность ответа соседа берётся у КОЛОНКИ ЕГО СЛОЯ в общем календаре, а не у величины (ИС-46 × ИС-38, ADR-0216 §3). Пока нижние колонки июля пусты, окончательным не считается ни один ответ (${pre215.final} из ${pre215.nbs.length}) — «${String(core215.why)}». Проставили «учёт» и «классификацию» — и окончательных стало ${post215.final}, каждый со своим основанием: «${String(N215('ядро').why).slice(0, 88)}…». Кураторство слоя не имеет ВОВСЕ (${String(N215('кураторство').layer)}), и это не пробел, а третий случай: «${String(N215('кураторство').why)}». Свести его к «не закрыт» значило бы обещать, что когда-нибудь он закроется, — а сосед отвечает и остаётся предварительным навсегда, и защёлка это ПЕЧАТАЕТ. РЕКВИЗИТА У СОСЕДА ТРИ, И НИ ОДИН НЕ ВЫВОДИТСЯ ИЗ ОСТАЛЬНЫХ: взыскание на опрос «кто изменился после T» отвечать не умеет (asks=${P215('взыскание').asks}, ИС-49), а колонку слоя имеет, и ответ его окончателен (${N215('взыскание').final}); кураторство опрос понимает (asks=${P215('кураторство').asks}) и слоя не имеет; датировку своего шва объявляют оба (leadCurator — ${(CORE.DATING.leadCurator || []).length} величины, ИС-39). Выведи одно из другого — и обход, деградировавший до полного, потянул бы за собой предварительность, которой нет. Дверь предпросмотра и само закрытие при этом отвечают ОДНИМ И ТЕМ ЖЕ составом: спросить «кого переспросит защёлка» можно ДО, а не выводить из последствий, которых может и не быть`);
})();

/* ===== блок волны 17 З-11: АДРЕСОВ РОВНО ДВА, И ТРЕТЬЕГО НЕТ (ИС-51, ADR-0222) ===== *
   Волна 16 завела дашборд и задания, рядом стоял анализ — и у четырёх модулей перед
   глазами оказалось ТРИ двери к одной и той же сумме долга: шов ядра (`ИЯ-17` прямо
   разрешает ему портфельный вопрос), `objectRows` (живые строки, из которых сумму можно
   сложить снаружи) и срез. Три дороги к одному числу — это `E2E-09` дословно.
   Правило: ЧИСЛО, ПРИВЯЗАННОЕ К ДАТЕ, — ТОЛЬКО У СТАТИСТИКИ; ЖИВОЙ РЕКВИЗИТ — ТОЛЬКО У
   `objectRows` ВЛАДЕЛЬЦА. Даже когда то же число умеет посчитать ядро: ядро ВЫВОДИТ,
   статистика ДАТИРУЕТ (ADR-0145). Шов ядра не отменён — у него сменился КРУГ ВЫЗЫВАЮЩИХ.
   Сторожа проверяют не список из трёх слов, а поведение: дверь `ST.where` называет адрес
   или отказывает с дорогой · восьмой шов отвечает только по объекту, чей владелец перечень
   ОБЪЯВИЛ · смешанный спрос идёт в оба адреса одной просьбой, и смешение НАЗВАНО в
   паспорте · близнецы «d-curator» и «к-curator» на одной строке расходятся, и оба ответа
   верны · круг спрашивающих и §5/§6 живой половины держатся тем же способом, что у среза. */
(() => {
  ST.seed();
  const CORE = vm.runInContext('CORE', sandbox);
  const CARD216 = vm.runInContext('CARD', sandbox);
  const W216 = ST.where('m-debt', 'obj-credit');
  const C216 = ST.where('к-curator', 'obj-credit');
  const S216 = ST.where('calcDebt', 'obj-credit');
  const S216b = ST.where('шов:calcDebt', 'obj-credit');
  const N216 = ST.where('сумма-долга-как-нибудь', 'obj-credit');
  const A216 = ST.addresses();
  /* #216 — ДВЕРЬ «У КОГО ЭТО СПРАШИВАТЬ» ОТВЕЧАЕТ ОДНИМ АДРЕСОМ НА ОДИН ВОПРОС.
     Адресов ровно два, и счёт назван ЧИСЛОМ: заведись третий — сторож упадёт, а не
     смягчится до «не меньше двух». Отказ у шва и отказ у ненайденной величины РАЗНЫЕ:
     первый называет дорогу к тому же числу, второй — к заведению записи реестра. */
  ok(216, A216.length === 2 && A216[0] === ST.ADDRESS.STAT && A216[1] === ST.ADDRESS.ROWS &&
        W216.ok && W216.address === ST.ADDRESS.STAT && W216.what === 'число на дату' &&
        has(W216.why, 'ядро выводит, статистика датирует') && has(W216.why, 'ADR-0145') &&
        C216.ok && C216.address === ST.ADDRESS.ROWS && C216.what === 'живой реквизит' &&
        C216.owner === 'Кредиты' && C216.twin === 'd-curator' &&
        has(C216.why, 'свойство КАРТОЧКИ, а не среза — у него нет даты вовсе') &&
        S216.ok === false && S216.seam === 'calcDebt' &&
        has(S216.why, 'потребителю НЕ АДРЕС') && has(S216.why, 'не отменён и не плох') &&
        has(S216.why, 'E2E-09') && has(S216.road, 'спрашивается СРЕЗОМ') &&
        S216b.ok === false && S216b.seam === 'calcDebt' &&
        N216.ok === false && !N216.seam && !N216.noCard &&
        has(N216.why, 'ни в реестре статистики, ни в объявленном перечне полей') &&
        has(N216.road, 'заводится ЗАПИСЬ РЕЕСТРА (ADR-0150 §6)') &&
        has(N216.road, 'а не обходной путь'),
    `адресов у потребителя РОВНО ДВА (${A216.length}), и дверь «у кого это спрашивать» отвечает одним на один вопрос: «m-debt» → ${String(W216.address)}, «к-curator» → ${String(C216.address)} у владельца «${String(C216.owner)}». Счёт назван числом, а не «не меньше двух»: третий адрес и есть та ошибка, которую волна чинит. ШОВ ЯДРА ОТКАЗАН, НО НЕ ОТМЕНЁН — «${String(S216.why).slice(0, 96)}…», и отказ ведёт по дороге: «${String(S216.road)}». Имя шва ловится по объявленному списку соседей, а не по виду строки, поэтому «шов:calcDebt» получает тот же ответ (${String(S216b.seam)}). ОТКАЗЫ У ШВА И У НЕНАЙДЕННОЙ ВЕЛИЧИНЫ РАЗНЫЕ, и это главное: у шва число ЕСТЬ, и дорога ведёт к тому же числу другим адресом, а у ненайденной его нет вовсе — «${String(N216.road).slice(0, 74)}…». Сказать в обоих случаях «нет данных» значило бы предложить потребителю выдумать обходной путь (ИС-51, ADR-0222 §1, §4, §5)`);

  /* #217 — ЖИВОЙ РЕКВИЗИТ СПРАШИВАЕТСЯ У ВЛАДЕЛЬЦА, И ПЕРЕЧЕНЬ ОБЪЯВЛЯЕТ ОН ЖЕ.
     Объект в v1 объявлен ОДИН, и это не заготовка: «отчётность в режиме „сейчас“ получает
     кредиты» (ADR-0181, п. 4 «Последствий»). У заёмщика живого адреса НЕТ — и отказ
     говорит ровно это, а не «пусто»: пустой список неотличим от «полей не осталось».
     Статистика тут ПОТРЕБИТЕЛЬ: шов стоит в ядре, своего перечисления объектов у неё нет. */
  const objs217 = Object.keys(CARD216);
  const b217 = CORE.objectRows('obj-borrower', {at: ST.state.today});
  const wb217 = ST.where('к-region', 'obj-borrower');
  const f217 = ST.cardFields('obj-credit');
  const ref217 = f217.filter(f => f.ref), hist217 = f217.filter(f => f.h);
  ST.resetObjectRowCalls();
  const own217 = ST.objectRows({obj:'obj-credit'});
  ok(217, objs217.length === 1 && objs217[0] === 'obj-credit' &&
        ST.cardOwner('obj-credit') === 'Кредиты' && ST.cardOwner('obj-borrower') === null &&
        f217.length === 13 && ref217.length === 1 && ref217[0].id === 'к-ref' &&
        hist217.length === 3 &&
        b217.ok === false && b217.noCard === true &&
        has(b217.why, 'владелец «Заёмщики» не объявил') &&
        has(b217.why, 'в v1 шов отвечает по объектам ядра') &&
        has(b217.why, 'второго пути к его полям заводить нельзя') &&
        wb217.ok === false && wb217.noCard === true && wb217.why === b217.why &&
        has(wb217.road, 'датированную сторону спросите срезом') &&
        own217.ok && own217.owner === 'Кредиты' && ST.objectRowCalls() === 1 &&
        own217.at === ST.state.today && own217.passport.fixation === 'не зафиксировано' &&
        own217.passport.dating === 'текущее' &&
        has(own217.passport.text, 'период НЕ ЗАФИКСИРОВАН, и это названо, а не пропущено'),
    `перечень полей карточки ОБЪЯВЛЯЕТ ВЛАДЕЛЕЦ, а не выводит статистика из своих разрезов, и объявлен он в v1 РОВНО ПО ОДНОМУ объекту — «${objs217.join(', ')}», владелец «${String(ST.cardOwner('obj-credit'))}», ${f217.length} реквизитов (${ref217.length} адресующий, ${hist217.length} историчных, которые карточка отдаёт СЕГОДНЯШНИМ значением). У заёмщика живого адреса НЕТ, и шов говорит именно это, а не «пусто»: «${String(b217.why).slice(0, 104)}…». Пустой список был бы неотличим от «полей не осталось», а выдуманный второй путь к ним — это второй вычислитель у каждого потребителя. Дверь «ST.where» отказывает ТЕМИ ЖЕ СЛОВАМИ (текст один на оба места, иначе запретов стало бы два) и называет дорогу: «${String(wb217.road)}». Сам шов стоит в ЯДРЕ: статистика ходит в него потребителем (обращений ${ST.objectRowCalls()}), своего перечисления объектов не заводит, и ответ его — «сейчас» на ${String(own217.at)}, где непроставленный период НАЗВАН, а не пропущен (ИС-51, ADR-0222 §2, ADR-0181 §2, §4)`);
})();

(() => {
  ST.seed();
  const WORLD218 = vm.runInContext('WORLD', sandbox);
  ST.closeLayer('2026-07', 'учёт', 'Осмонова Г., главный бухгалтер', '2026-08-05');
  ST.closeLayer('2026-07', 'классификация', 'Турдубаева А., администратор классификации', '2026-08-07');
  const cp218 = ST.closePeriod('2026-07', 'Осмонова Г., главный бухгалтер');
  /* Куратора в КАРТОЧКЕ меняют ПОСЛЕ фиксации июля — ровно так, как это бывает в жизни:
     кредит передали другому человеку в августе. Датированная сторона июля от этого не
     двигается (строка написана), а живая обязана показать нынешнего. */
  const cr218 = (WORLD218['obj-credit'] || []).find(x => x.id === 'КД-2024/117') || {h:{}};
  const keep218 = cr218.h.curator;
  cr218.h.curator = [['2025-01-01','Асанов А.'], ['2026-07-15','Бекова Н.'], ['2026-08-15','Садыков М.']];
  ST.resetCoreCalls(); ST.resetObjectRowCalls();
  const a218 = ST.consumerAsk({module:'отчётность', obj:'obj-credit', date:'2026-07-31',
    need:['d-curator', 'm-debt', 'к-curator']});
  const core218 = ST.coreCalls(), rows218 = ST.objectRowCalls();
  const r218 = (a218.rows || []).find(x => x.ref === 'КД-2024/117') || {cells:{}};
  const cell = id => r218.cells[id] || {};
  const p218 = a218.passport || {dating:{}};
  const one218 = ST.consumerAsk({module:'отчётность', obj:'obj-credit', date:'2026-07-31',
    need:['m-debt']});
  const tw218 = ST.twins('obj-credit');
  const paired218 = tw218.filter(t => t.twin), bare218 = tw218.filter(t => !t.twin);
  cr218.h.curator = keep218;

  /* #218 — ОДНА ПРОСЬБА, ДВЕ ПОЛОВИНЫ, И КАЖДАЯ ИДЁТ ПО СВОЕМУ АДРЕСУ.
     Датированная половина закрытого июля ЧИТАЕТСЯ (обращений к ядру ноль — ИС-46,
     ADR-0216 §4), живая берётся у владельца отдельным вызовом. Счётчики РАЗДЕЛЕНЫ
     нарочно: одним этого не показать. */
  ok(218, cp218.ok && a218.ok &&
        core218 === 0 && rows218 === 1 &&
        p218.fixation === 'зафиксировано' && p218.mode === 'запись фиксации, окончательно' &&
        p218.fixedBy === 'Осмонова Г., главный бухгалтер' &&
        cell('d-curator').address === ST.ADDRESS.STAT && cell('d-curator').v === 'Бекова Н.' &&
        cell('d-curator').when === 'на дату' &&
        cell('к-curator').address === ST.ADDRESS.ROWS && cell('к-curator').v === 'Садыков М.' &&
        cell('к-curator').when === 'текущее' &&
        cell('m-debt').address === ST.ADDRESS.STAT && cell('m-debt').when === 'на дату' &&
        (a218.routed || []).length === 3 &&
        (a218.routed || []).filter(x => x.address === ST.ADDRESS.STAT).length === 2 &&
        (a218.routed || []).filter(x => x.address === ST.ADDRESS.ROWS).length === 1,
    `спрос «куратор на 31.07 · долг на 31.07 · нынешний куратор» — ОДНА просьба, и разъезжается она по адресам ВЕЛИЧИН, а не по адресу вопроса: ${(a218.routed || []).filter(x => x.address === ST.ADDRESS.STAT).length} к статистике, ${(a218.routed || []).filter(x => x.address === ST.ADDRESS.ROWS).length} к владельцу. Июль ЗАФИКСИРОВАН (${String(p218.fixation)}, «${String(p218.mode)}», ${String(p218.fixedBy)}), и датированная половина ЧИТАЕТСЯ: обращений к ядру ${core218}. Живая половина стоит владельцу отдельного вызова (${rows218}) — счётчики разделены нарочно, одним этого не показать. На ОДНОЙ строке «КД-2024/117» куратор июля — ${String(cell('d-curator').v)} (${String(cell('d-curator').when)}), а куратор карточки — ${String(cell('к-curator').v)} (${String(cell('к-curator').when)}): кредит передали в августе, и ОБА ответа верны. Пересчитай кто-нибудь закрытый июль сегодня — он взял бы Садыкова и не нарушил ни одного правила (ИС-51 × ИС-39 × ИС-46, ADR-0222 §3)`);

  /* #219 — СМЕШИВАТЬ МОЖНО, СКРЫВАТЬ СМЕШЕНИЕ — НЕЛЬЗЯ.
     Паспорт печатает ОБА источника с ОБЕИМИ датами и берёт по датировке ХУДШЕЕ: одна
     живая величина делает ответ «смешанным» и называет виновника ПО ИМЕНИ. Спрос по
     одному адресу это же место печатает иначе — «адрес один», а не молчит. */
  const ad219 = p218.addresses || [];
  const st219 = ad219.find(u => u.address === ST.ADDRESS.STAT) || {};
  const lv219 = ad219.find(u => u.address === ST.ADDRESS.ROWS) || {};
  const d219 = p218.dating || {};
  const o219 = (one218.passport || {dating:{}});
  ok(219, p218.mixed === true && ad219.length === 2 &&
        st219.n === 2 && st219.asOf === '2026-07-31' &&
        lv219.n === 1 && lv219.owner === 'Кредиты' && lv219.at === ST.state.today &&
        has(p218.addressText, 'Строка СМЕШАННАЯ') &&
        has(p218.addressText, 'реквизиты от владельца «Кредиты» на 21.08.2026') &&
        has(p218.addressText, 'числа от статистики на 31.07.2026') &&
        has(p218.addressText, 'скрывать смешение — нет') &&
        d219.word === 'смешанно' && d219.n === 3 && (d219.now || []).length === 1 &&
        (d219.now || [])[0] === 'к-curator' && (d219.names || [])[0] === '«куратор»' &&
        has(d219.text, 'живой реквизит карточки на дату не отвечает вовсе') &&
        one218.ok && (one218.passport || {}).mixed === false &&
        has((one218.passport || {}).addressText, 'Адрес один, смешения нет') &&
        o219.dating.word === 'на дату',
    `паспорт печатает ОБА источника и ОБЕ даты: ${st219.n} величины от статистики на ${String(st219.asOf)} и ${lv219.n} реквизит от владельца «${String(lv219.owner)}» на ${String(lv219.at)} — «${String(p218.addressText).slice(-108)}». По ДАТИРОВКЕ берётся худшее: величин ${d219.n}, текущей ОДНА, и виновник назван по имени (${(d219.names || []).join(', ')}), отчего слово ответа — «${String(d219.word)}», хотя две величины из трёх лежат на 31.07 окончательно. Смешение законно — реквизиты от владельца, числа от статистики, — но СКРЫТОЕ оно превращает отчёт за июль, собранный в августе, в отчёт, который в сентябре соберётся иначе без всякой ошибки. Спрос по одному адресу это же место печатает ИНАЧЕ, а не молчит: «${String((one218.passport || {}).addressText).slice(-34)}», датировка «${String(o219.dating.word)}» (ИС-51, ADR-0222 §3, ИС-39, ADR-0205 §4)`);

  /* #220 — У ОДНОЙ ВЕЩИ ДВЕ СТОРОНЫ, И ЭТО НЕ ДВА АДРЕСА ОДНОГО ЧИСЛА.
     Имена почти совпадают, и соблазн вывести перечень полей из реестра разрезов велик.
     Пары ОБЪЯВЛЕНЫ реквизитом `twin` — объявлением, а не догадкой по имени: у двух полей
     пары нет вовсе, и у каждого своя причина (адресующий реквизит · второй уровень
     иерархии, а не своя запись). */
  const cur220 = tw218.find(t => t.card === 'к-curator') || {};
  const amt220 = tw218.find(t => t.card === 'к-amount') || {};
  ok(220, tw218.length === 13 && paired218.length === 11 && bare218.length === 2 &&
        bare218.map(t => t.card).join(' · ') === 'к-ref · к-district' &&
        paired218.every(t => !!t.twinName) &&
        paired218.filter(t => t.twinKind === 'разрез').length === 10 &&
        paired218.filter(t => t.twinKind === 'показатель').length === 1 &&
        cur220.twin === 'd-curator' && cur220.twinName === 'Куратор кредита' &&
        amt220.twin === 'm-amount' && amt220.twinKind === 'показатель' &&
        cell('d-curator').v !== cell('к-curator').v &&
        ST.where(cur220.twin, 'obj-credit').address === ST.ADDRESS.STAT &&
        ST.where(cur220.card, 'obj-credit').address === ST.ADDRESS.ROWS,
    `у одной вещи ДВЕ стороны — датированная и живая, — и адреса у них разные ПОТОМУ, ЧТО ВОПРОСЫ РАЗНЫЕ: «в каком множестве строка БЫЛА НА ДАТУ» против «что в карточке СЕЙЧАС». Пар объявлено ${paired218.length} из ${tw218.length} (${paired218.filter(t => t.twinKind === 'разрез').length} разрезов + ${paired218.filter(t => t.twinKind === 'показатель').length} показатель), и объявлены они РЕКВИЗИТОМ, а не догадкой по имени: «${String(cur220.card)}» ↔ «${String(cur220.twin)}» («${String(cur220.twinName)}»). Без пары ${bare218.length}, и у каждого своя причина: ${bare218.map(t => t.card).join(' · ')} — адресующий реквизит и ВТОРОЙ УРОВЕНЬ иерархии «Территория», а не своя запись реестра (ADR-0176 §1). Что это не два адреса одного числа, показано делом: на строке «КД-2024/117» стороны РАЗОШЛИСЬ (${String(cell('d-curator').v)} против ${String(cell('к-curator').v)}), и оба ответа верны. Выведи перечень полей из реестра разрезов — и «куратор» получил бы один адрес, а с ним и одно из двух значений молча (ИС-51, ADR-0222 §3, ADR-0181 §2)`);
})();

(() => {
  ST.seed();
  const st = ST.state;
  const CORE = vm.runInContext('CORE', sandbox);
  /* #221 — КРУГ СПРАШИВАЮЩИХ У ВОСЬМОГО ШВА ТОТ ЖЕ, ЧТО У СРЕЗА.
     Адрес — не пропуск: назвать дверь мало, надо иметь право в неё войти. Классификация
     не читает статистику ни в одной форме (ИС-5, слой ниже), программам открыт свод, но
     не построчный ответ, а незаявленный модуль не становится потребителем оттого, что
     дозвонился. Отказ спроса ДВОИЧНЫЙ: одна неадресуемая величина отменяет ответ целиком. */
  const cls221 = ST.consumerAsk({module:'классификация', obj:'obj-credit', date:'2026-08-20', need:['m-debt']});
  const prg221 = ST.consumerAsk({module:'программы', obj:'obj-credit', date:'2026-08-20', need:['m-debt']});
  const prgL221 = ST.consumerAsk({module:'программы', obj:'obj-credit', date:'2026-08-20', need:['к-curator']});
  const nob221 = ST.consumerAsk({module:'выдумка', obj:'obj-credit', date:'2026-08-20', need:['m-debt']});
  const bin221 = ST.consumerAsk({module:'отчётность', obj:'obj-credit', date:'2026-08-20', need:['m-debt', 'calcDebt']});
  const emp221 = ST.consumerAsk({module:'отчётность', obj:'obj-credit', date:'2026-08-20', need:[]});
  const oid221 = ST.consumerAsk({module:'отчётность', obj:'obj-nope', date:'2026-08-20', need:['m-debt']});
  ok(221, cls221.ok === false && has(cls221.why, 'ни в одной форме') && has(cls221.why, 'ИС-5') &&
        prg221.ok === false && has(prg221.why, 'построчный ответ статистики не открыт') &&
        has(prg221.why, 'ему объявлены statSlice') && has(prg221.road, 'спросите то же сводом') &&
        prgL221.ok === true && (prgL221.passport || {}).mixed === false &&
        nob221.ok === false && has(nob221.why, 'потребителем статистики не объявлен') &&
        has(nob221.why, 'не всякий, кто дозвонился') &&
        bin221.ok === false && bin221.id === 'calcDebt' && !bin221.rows &&
        emp221.ok === false && has(emp221.why, 'адрес есть у ВЕЛИЧИНЫ, а не у объекта') &&
        oid221.ok === false && has(oid221.why, 'нет в реестре объектов'),
    `адрес — НЕ ПРОПУСК: назвать дверь мало, надо иметь право в неё войти, и круг спрашивающих у восьмого шва тот же объявленный, что у среза. Классификация отбита слоем («${String(cls221.why).slice(0, 62)}…», ИС-5), программам открыт свод и НЕ открыт построчный ответ — «${String(prg221.why).slice(0, 70)}…», и отказ ведёт дорогой: «${String(prg221.road)}». При этом ЖИВУЮ половину те же программы получают (${prgL221.ok}): построчный ответ статистики и перечисление владельца — разные двери с разными правами, и права одной не выводятся из прав другой. Незаявленный модуль потребителем не становится оттого, что дозвонился. ОТКАЗ СПРОСА ДВОИЧНЫЙ: «m-debt + calcDebt» отменяется ЦЕЛИКОМ на «${String(bin221.id)}» (строк не отдано вовсе) — отдай шов адресуемую половину молча, и потребитель не узнал бы, что спросил не то, а поставил бы в отчёт неполное (ADR-0178 §1 в другом обличье). Спрос без состава не адресуется вовсе: «${String(emp221.why).slice(0, 56)}…» (ИС-51, ADR-0152 §3)`);

  /* #222 — §5 И §6 ADR-0181 ДЕРЖАТСЯ НА ЖИВОЙ ПОЛОВИНЕ ТЕМ ЖЕ СПОСОБОМ, ЧТО НА СРЕЗЕ.
     Область видимости считается ВНУТРИ шва, и скрытое называется ЧИСЛОМ: молча укоротить
     список нельзя — «обзвонили всех» перестанет быть проверяемым. Отказ по объёму
     ДВОИЧНЫЙ (ADR-0178 §1). Необъявленное поле не отдаётся никому и никогда. */
  ST.setRole('Аналитик');
  const an222 = CORE.objectRows('obj-credit', {at: st.today});
  ST.setRole('Администратор статистики');
  const ad222 = CORE.objectRows('obj-credit', {at: st.today});
  const lim222 = ST.rowsLimit;
  ST.rowsLimit = 3;
  const ov222 = CORE.objectRows('obj-credit', {at: st.today});
  ST.rowsLimit = lim222;
  const al222 = CORE.objectRows('obj-credit', {fields:['m-debt'], at: st.today});
  const nd222 = CORE.objectRows('obj-credit', {});
  const no222 = CORE.objectRows('obj-nope', {at: st.today});
  const pick222 = CORE.objectRows('obj-credit', {fields:['к-ref', 'к-status'], at: st.today});
  ok(222, an222.ok && an222.rows.length === 5 && an222.hidden === 3 &&
        has(an222.passport.scope, '3 объекта скрыто областью видимости') &&
        ad222.ok && ad222.rows.length === 8 && ad222.hidden === 0 &&
        has(ad222.passport.scope, 'не сузила ничего') &&
        an222.rows.length + an222.hidden === ad222.rows.length &&
        ov222.ok === false && ov222.overLimit === true && ov222.n === 8 && ov222.limit === 3 &&
        has(ov222.why, 'Половины списка не бывает') && has(ov222.why, 'ADR-0181 §6, ADR-0178 §1') &&
        al222.ok === false && (al222.alien || []).join('') === 'm-debt' &&
        has(al222.why, 'перечень объявляет ВЛАДЕЛЕЦ') &&
        nd222.ok === false && has(nd222.why, 'без даты снимка не отдаётся') &&
        no222.ok === false && has(no222.why, 'нет в реестре объектов') &&
        pick222.ok && pick222.fields.length === 2 &&
        Object.keys(pick222.rows[0].cells).length === 2 &&
        pick222.rows.every(r => r.cells['к-ref'].when === 'текущее'),
    `восьмой шов держит §5 и §6 ADR-0181 ТЕМ ЖЕ способом, что срез. Область видимости считается ВНУТРИ шва: аналитику видно ${an222.rows.length} кредитов, и скрытое НАЗВАНО ЧИСЛОМ — «${String(an222.passport.scope)}», — а администратору ${ad222.rows.length} и «${String(ad222.passport.scope)}». ${an222.rows.length} + ${an222.hidden} = ${ad222.rows.length}: молча укоротить список нельзя, иначе «обзвонили всех» перестаёт быть проверяемым, а сузившую роль не отличить от опустевшего мира. Отказ по ОБЪЁМУ двоичный: при пороге ${ov222.limit} и ${ov222.n} объектах не отдаётся ничего — «${String(ov222.why).slice(-72)}». НЕОБЪЯВЛЕННОЕ ПОЛЕ НЕ ОТДАЁТСЯ ВОВСЕ, даже когда имя его — настоящая запись реестра статистики (${(al222.alien || []).join(', ')}): перечень объявляет владелец, и «m-debt» у него не поле карточки, а число на дату по ДРУГОМУ адресу. Часы приходят снаружи, и ответ «сейчас» без даты снимка не отдаётся. Состав спрашивается ЧАСТЬЮ (${pick222.fields.length} из ${ST.cardFields('obj-credit').length}), и каждая клетка несёт своё «${String(pick222.rows[0].cells['к-ref'].when)}» — у карточки истории нет по построению (ИС-51, ИС-39, ADR-0181 §2, §5, §6)`);
})();

(() => {
  ST.seed();
  const st = ST.state;
  const load = ST.legacyLoad();
  const legRows = st.rows.filter(r => ST.isLegacyRow(r));
  const lr = ST.rowsAsOf('obj-credit', '2025-12-31')[0] || {};
  const shape = JSON.stringify(Object.keys(lr)) === JSON.stringify(ST.ROW_SHAPE);
  const whenVals = Array.from(new Set(Object.values(lr.when || {})));
  const srcKeys = Object.keys(lr.srcs || {});
  const legCal = ST.calendar().filter(pr => pr.legacy);
  const sl223 = ST.statSlice({obj:'obj-credit', dims:['d-branch'], inds:['a-count'], date:'2025-12-31'});

  /* #223 — ЛЕГАСИ-ИТОГ ПРИХОДИТ СТРОКОЙ, УЖЕ ОКОНЧАТЕЛЬНОЙ, И ФОРМА СТРОКИ НЕ ВЫРОСЛА.
     Соблазн был обратный: завести десятое поле «редакция формы» — и получить форму строки,
     которая растёт от каждого нового обстоятельства. Форма ЗАКРЫТА (ИС-15), а редакция
     уехала в ЗАПИСЬ ФИКСАЦИИ, куда и относится: это обстоятельство ФИКСАЦИИ, а не измерения
     (ADR-0175 §1). Проверяется тут не «поле лежит», а ровно это: девять полей, ни одним
     больше, и всё, что легаси добавило, лежит внутри девятого.
     Второе, что здесь ловится, — ДАТИРОВКА РАЗРЕЗОВ. У прогонной строки разрез бывает
     «текущим»: карточка жива, и её сегодняшнее значение можно спросить. У легаси-строки
     «текущего» не бывает ВОВСЕ — карточки, из которой его брать, больше нет, — и пометить
     разрез умолчанием «текущее» значило бы обещать поход туда, где никого нет (ИС-39). */
  ok(223, shape && Object.keys(lr).length === 9 &&
        lr.by === 'миграция, вып. 1' && lr.fixed && lr.fixed.edition === 'легаси' &&
        lr.fixed.period === '2025-12' && lr.fixed.at === '2026-04-28' &&
        lr.fixed.by === 'миграция, вып. 1' &&
        srcKeys.length === 1 && lr.srcs['ядро'].ok === true && lr.srcs['ядро'].src === 'легаси' &&
        whenVals.length === 1 && whenVals[0] === 'на дату' &&
        Object.keys(lr.when).length === 6 &&
        legRows.length === 34 && load.rows === 34 && load.launch === ST.LAUNCH() &&
        load.dates.length === 6 && load.dates.every(d => d < ST.LAUNCH()) &&
        legCal.length === 6 && st.months.every(m => !ST.isLegacyMonth(m)) &&
        st.months.length === 4 &&
        sl223.ok && sl223.passport.fixation === 'зафиксировано' &&
        sl223.passport.mode === 'запись фиксации, окончательно' &&
        sl223.passport.edition === 'легаси' && ST.FORMS().length === 2,
    `легаси-итог входит СТРОКОЙ, и строка приходит уже в состоянии окончательной фиксации: ${legRows.length} строк на ${load.dates.length} дат (${load.dates[0]}…${load.dates[load.dates.length-1]}), все РАНЬШЕ запуска ${ST.LAUNCH()}, актор — «${String(lr.by)}», основание — «${String(load.act)}». Форма строки при этом НЕ ВЫРОСЛА: полей по-прежнему ${Object.keys(lr).length}, и это тот же список ИС-15 — редакция формы лежит ВНУТРИ записи фиксации (${JSON.stringify(lr.fixed)}), потому что это обстоятельство фиксации, а не ещё одно измерение (ADR-0175 §1). Десятое поле было бы формой строки, растущей от каждого нового обстоятельства. Источник назван своим именем — «${String((lr.srcs['ядро']||{}).src)}», а не «шов»: шва за ту дату нет и не будет. Датировка всех ${Object.keys(lr.when).length} полей — «${String(whenVals[0])}», ВКЛЮЧАЯ РАЗРЕЗЫ: у легаси-разреза «текущего» значения не бывает вовсе, карточки, из которой его брать, больше нет, и умолчание «текущее» обещало бы поход туда, где никого нет (ИС-39). Ответ на легаси-дату ЧИТАЕТСЯ, а не считается: «${String(sl223.passport.mode)}». Легаси-месяцев ${legCal.length}, и в очереди закрытия периодов (${st.months.join(', ')}) их НЕТ ни одного — правило «периоды закрываются по порядку» осталось про то, что закрывает человек (ИС-41, ADR-0207 §1, §3)`);

  /* Отказ обязан отбиваться ДО единой правки состояния, и это не педантизм: журнал зовёт
     эти же четыре двери ПРЯМО НА ОТРИСОВКЕ — печатать переписанный текст отказа значило бы
     дать ему разойтись с настоящим на первой же правке формулировки, и разойтись молча.
     Мутирующий отказ превратил бы простой просмотр экрана в правку календаря. */
  const snap224 = JSON.stringify([ST.state.periods, ST.state.rows.length, ST.state.log.length]);
  const noClose = ST.closeLayer('2025-12', 'учёт', 'Осмонова Г., главный бухгалтер', '2026-01-05');
  const noOpen = ST.openLayer('2025-12', 'статистика', {no:'№ 9', basis:'проверка'}, 'Осмонова Г.');
  const noReopen = ST.reopenPeriod('2025-12', {no:'№ 9', basis:'проверка'}, 'Осмонова Г.');
  const noRun = ST.run('2025-12-31');
  const quiet224 = JSON.stringify([ST.state.periods, ST.state.rows.length, ST.state.log.length]) === snap224;
  const whys = [noClose.why, noOpen.why, noReopen.why, noRun.why];
  const distinct = Array.from(new Set(whys)).length;
  const yesClose = ST.closeLayer('2026-07', 'учёт', 'Осмонова Г., главный бухгалтер', '2026-08-05');

  /* #224 — ЛЕГАСИ-ПЕРИОД НЕ ОТКРЫВАЕТСЯ ВОВСЕ, И ЧЕТЫРЕ ДВЕРИ ОТКАЗЫВАЮТ ЧЕТЫРЬМЯ РАЗНЫМИ
     ФРАЗАМИ. Одна фраза на все четыре была бы дешевле и хуже: «нельзя» не отличает
     «закрывать нечего, оно пришло закрытым» от «открыть можно было бы, да пересчитать
     нечем» и от «прогон сюда просто не ходит». Человек, получивший общий отказ, идёт
     искать право, которого ему якобы не хватает, — и находит администратора, который
     ему это право выдаст. Здесь у каждого отказа СВОЙ довод и своя дорога, и дорога у
     трёх из четырёх одна: НОВЫЙ ВЫПУСК МИГРАЦИИ с записью в журнал, актор — человек.
     Перезакрытие (ADR-0216) сюда не тянется не потому, что запрещено, а потому, что
     НЕПРИМЕНИМО: оно обещает пересчёт, а пересчитывать легаси нечем — формы другие и
     соседей за ту дату не спросишь.
     И главное — рядом та же дверь на прогонном месяце работает: запрет про ЛЕГАСИ, а не
     про календарь вообще. */
  ok(224, noClose.ok === false && has(noClose.why, 'загружен УЖЕ ЗАКРЫТЫМ') &&
        has(noClose.why, 'закрывать нечего') && has(noClose.why, 'ADR-0207 §3') &&
        noOpen.ok === false && has(noOpen.why, 'НЕ ОТКРЫВАЕТСЯ ни распоряжением, ни правами') &&
        has(noOpen.why, 'пересчитать его нечем') && has(noOpen.why, 'НОВЫЙ ВЫПУСК МИГРАЦИИ') &&
        has(noOpen.why, 'ADR-0207 §4') &&
        noReopen.ok === false && has(noReopen.why, 'перезакрытие к нему неприменимо') &&
        has(noReopen.why, 'НОВЫЙ ВЫПУСК, а не открытие периода') &&
        noRun.ok === false && has(noRun.why, 'раньше запуска') &&
        has(noRun.why, 'не считает, не видит и не перепишет') &&
        quiet224 && distinct === 4 && whys.every(w => has(w, 'миграция, вып. 1')) &&
        [noClose, noOpen, noReopen].every(x => x.legacy && x.legacy.act === ST.legacyLoad().act) &&
        yesClose.ok === true && yesClose.month === '2026-07',
    `легаси-период НЕ ОТКРЫВАЕТСЯ — и отказов ${distinct} РАЗНЫХ на четыре двери, а не один общий. Закрытие: «${String(noClose.why).slice(0, 88)}…» — закрывать нечего. Открытие слоя: «${String(noOpen.why).slice(0, 96)}…» — не «нет прав», а НЕЧЕМ ПЕРЕСЧИТАТЬ. Перезакрытие: «${String(noReopen.why).slice(0, 74)}…» — распоряжение (ADR-0216) сюда не тянется, оно обещает пересчёт. Прогон: «${String(noRun.why).slice(0, 92)}…». Общий отказ «нельзя» отправил бы человека искать недостающее право — и он бы его нашёл; здесь у каждой двери свой довод, и дорога у трёх из четырёх одна: НОВЫЙ ВЫПУСК МИГРАЦИИ с журнальной записью, актор — человек, а не ночь. Каждый отказ называет выпуск и акт приёмки («${String(ST.legacyLoad().act)}»), потому что «кто это принёс» — первый вопрос получателя. Рядом ТА ЖЕ дверь на прогонном месяце работает (${String(yesClose.month)}: ok=${String(yesClose.ok)}): запрет — про легаси, а не про календарь. Все четыре отбивают ДО единой правки состояния (календарь, строки и журнал действий после четырёх отказов те же) — журнал зовёт эти двери прямо на отрисовке, чтобы печатать настоящий ответ, а не его переписанную копию (ИС-41, ADR-0207 §3, §4)`);
})();

(() => {
  ST.seed();
  const sec = ST.statSlice({obj:'obj-credit', dims:['d-branch'], inds:['a-sumsecured'], date:'2025-12-31'});
  const secTot = (sec.total || {})['a-sumsecured'] || {};
  const dbt = ST.statSlice({obj:'obj-credit', dims:['d-branch'], inds:['a-sumdebt'], date:'2025-12-31'});
  const dbtTot = (dbt.total || {})['a-sumdebt'] || {};
  const byCur = ST.statSlice({obj:'obj-credit', dims:['d-cur'], inds:['a-sumdebt'], date:'2025-12-31'});
  const gv = k => ((byCur.groups.find(g => g.key === k) || {values:{}}).values['a-sumdebt'] || {}).v;
  const rows225 = ST.statRows({obj:'obj-credit', date:'2025-12-31'});
  const now225 = ST.statSlice({obj:'obj-credit', dims:['d-branch'], inds:['a-count'], date:'2026-08-20'});
  ST.setRole('Аналитик');
  const an225 = ST.statSlice({obj:'obj-credit', dims:['d-branch'], inds:['a-count'], date:'2025-12-31'});
  ST.setRole('Администратор статистики');

  /* #225 — НЕСОБИРАВШЕЕСЯ ПРИШЛО ОТСУТСТВУЮЩИМ, НО СВОД ПО НЁМ ДАЁТ ПРАВДОПОДОБНЫЙ НОЛЬ.
     Это самое опасное место всей волны, и оно НЕ ЛЕЧИТСЯ ОТКАЗОМ. Свод суммы по пустому
     множеству — законный ноль (ИС-... сумма пустого множества равна нулю, и отменять это
     ради легаси нельзя: тогда сломается обычный ноль). Значит, число выйдет ПРАВДОПОДОБНЫМ:
     «обеспечения на 31.12.2025 — 0 сом» читается как факт, а не как отсутствие формы.
     Единственная защита — СЛОВО РЯДОМ С ЧИСЛОМ, и оно обязано ехать ТУДА ЖЕ, КУДА ЕДЕТ
     ЧИСЛО. Потому редакция формы попала и в КРАТКИЙ паспорт, под плитку (ADR-0205 §4):
     развёрнутый паспорт открывают не всегда, а плитку видят всегда.
     И проверяется тут же вторая половина: в НОРМЕ строка не длиннее ни на символ. Пометка,
     которая стоит везде, не значит ничего.
     Третье — недостача, названная ЧИСЛОМ, когда перечислять поимённо нельзя (список строк
     видит всю строку): «6 из 135» проверяемо, «часть величин» — нет (ADR-0181 §5).
     Четвёртое — дыра области видимости: форма легаси не собирала куратора, и аналитику
     на легаси-дате не видно НИ ОДНОЙ строки. Это НАЗВАНО, а не отдано пустотой: пустой
     ответ неотличим от «в тот день кредитов не было». */
  ok(225, sec.ok && sec.n === 6 && secTot.v === 0 && secTot.cur === 'KGS' &&
        has(sec.passport.editionNote, 'НЕ СОБИРАЛА') &&
        has(sec.passport.editionNote, '«Обеспечение по кредиту»') &&
        has(sec.passport.editionNote, 'ОТСУТСТВУЮЩИМ, а не нулём и не вчерашним') &&
        has(sec.passport.short, '· ФОРМА ЛЕГАСИ ·') &&
        now225.ok && now225.passport.editionNote === null &&
        !has(now225.passport.short, 'ФОРМА') && now225.passport.edition === 'действующая' &&
        dbtTot.refused === true && JSON.stringify(dbtTot.mixed) === '["KGS","USD"]' &&
        dbtTot.som === 'a-sumdebt-som' &&
        byCur.ok && byCur.groups.length === 2 && gv('KGS') === 9286000 && gv('USD') === 160000 &&
        rows225.ok && has(rows225.passport.editionNote, 'собирала 6 величин из 135') &&
        has(rows225.passport.editionNote, 'ОТСУТСТВУЮТ КЛЮЧОМ, а не лежат нулём') &&
        an225.ok && an225.n === 0 &&
        has(an225.passport.editionNote, 'не видно НИ ОДНОЙ') &&
        has(an225.passport.editionNote, 'форма легаси его не собирала') &&
        has(an225.passport.editionNote, 'исключение названо, а не скрыто'),
    `несобиравшееся пришло ОТСУТСТВУЮЩИМ — и свод по нему дал ${secTot.v} ${String(secTot.cur)}, число совершенно правдоподобное. Отказом это не лечится: сложить ничего — законно (ИС-19), и отменить это ради легаси значило бы сломать обычный ноль. Лечится словом, которое едет ТУДА ЖЕ, КУДА ЧИСЛО: «${String(sec.passport.editionNote).slice(-104)}», и та же пометка стоит в КРАТКОМ паспорте под плиткой — «${String(sec.passport.short)}», потому что развёрнутый открывают не всегда, а плитку видят всегда (ADR-0205 §4). В НОРМЕ строка не длиннее ни на символ: на прогонной дате пометки нет вовсе (${String(now225.passport.short)}), иначе пометка, стоящая везде, не значила бы ничего. ИС-44 легаси не отменило: разновалютный свод отказан и там (${JSON.stringify(dbtTot.mixed)}), а внутри разреза по валюте ответ есть — ${gv('KGS')} KGS и ${gv('USD')} USD. Там, где перечислить недостачу поимённо нельзя (список строк видит ВСЮ строку), она названа ЧИСЛОМ — «${String(rows225.passport.editionNote).slice(-96)}»: «6 из 135» проверяемо, «часть величин» — нет (ADR-0181 §5). И дыра области видимости НАЗВАНА, а не отдана пустотой: аналитику на легаси-дате видно ${an225.n} строк — «${String(an225.passport.editionNote).slice(0, 110)}…», потому что пустой ответ неотличим от «в тот день кредитов не было» (ИС-41, ADR-0207 §2, ADR-0175 §2)`);
})();

(() => {
  ST.seed();
  const ds = ST.askDates('obj-credit');
  const dsLeg = ds.filter(d => d < ST.LAUNCH()), dsRun = ds.filter(d => d >= ST.LAUNCH());
  const before = ST.rowsAsOf('obj-credit', '2026-03-31');
  const after = ST.rowsAsOf('obj-credit', '2026-05-31');
  const gone = after.filter(r => r.ref === 'КД-2021/044').length;
  const was = before.filter(r => r.ref === 'КД-2021/044').length;
  const gApril = ST.dateGate('2026-04-15', 'obj-credit');
  const gMay = ST.dateGate('2026-05-15', 'obj-credit');
  const gAug = ST.dateGate('2026-08-25', 'obj-credit');
  const gates = Array.from(new Set([gApril, gMay, gAug])).length;
  const inside = ST.statSlice({obj:'obj-credit', dims:['d-branch'], inds:['a-count'], date:'2026-02-14'});
  const early = ST.statSlice({obj:'obj-credit', dims:['d-branch'], inds:['a-count'], date:'2024-06-30'});

  /* #226 — ГРАНИЦА ЗАПУСКА НЕ ПЕРЕНОСИТ НИЧЕГО НИ В ОДНУ СТОРОНУ, И ВОРОТА РАЗЛИЧАЮТ ТРИ
     ПРИЧИНЫ. Молчаливый перенос — это не «немного неточно», это ВОСКРЕШЕНИЕ: КД-2021/044
     есть только в легаси-итогах, в сегодняшнем мире его нет вовсе, и подстановка «на дату»
     через границу дала бы его в июньском срезе живым договором. Проверяется именно это:
     после запуска его строк НОЛЬ, до запуска — одна.
     Внутри своей стороны подстановка работает как работала (ИС-12): 14.02 отвечает
     31.12.2025. Граница режет ЧЕРЕЗ СЕБЯ, а не вообще.
     И там, где старый отказ уже подходит, новый не заводится: до первой легаси-строки
     отвечает ИС-12 своими словами, а не «легаси» — запретов от волны не прибавилось. */
  ok(226, ds.length === 12 && dsLeg.length === 6 && dsRun.length === 6 &&
        dsLeg.every(d => d < ST.LAUNCH()) && dsRun.every(d => d >= ST.LAUNCH()) &&
        was === 1 && gone === 0 && before.length === 6 && after.length === 8 &&
        before.every(r => ST.isLegacyRow(r)) && after.every(r => !ST.isLegacyRow(r)) &&
        has(gApril, 'легаси-итога нет') && has(gApril, 'новых не будет') &&
        has(gApril, 'НОВЫЙ ВЫПУСК, а не ночь') &&
        has(gMay, 'через границу не переносится') && has(gMay, 'ADR-0207 §7') &&
        has(gAug, 'прогона не было') && !has(gAug, 'легаси') && gates === 3 &&
        inside.ok && inside.passport.asOf === '2025-12-31' &&
        inside.passport.substituted === true && inside.passport.edition === 'легаси' &&
        early.ok === false && has(early.why, 'подстановка запрещена (ИС-12)') &&
        !has(early.why, 'легаси'),
    `граница запуска ${ST.LAUNCH()} не переносит НИЧЕГО ни в одну сторону, и это не про точность, а про ВОСКРЕШЕНИЕ: КД-2021/044 живёт только в легаси-итогах, в сегодняшнем мире его нет — на 31.03 его строк ${was}, на 31.05 ${gone}. Подстановка «на дату» через границу подала бы его в майском срезе живым договором. Срез до запуска состоит из ${before.length} строк, и ВСЕ они легаси; после — ${after.length}, и НИ ОДНОЙ легаси. Даты спроса делятся тем же швом: ${dsLeg.length} легаси и ${dsRun.length} прогонных. Ворота различают ${gates} причины разными словами: «${String(gApril).slice(0, 62)}…» (легаси-хвост — новых не будет), «${String(gMay).slice(0, 74)}…» (дыра между последним итогом и первым прогоном), «${String(gAug).slice(0, 44)}…» (прежний ИС-36, про легаси в нём ни слова). ВНУТРИ своей стороны подстановка работает как работала: 14.02 отвечает ${String(inside.passport.asOf)} с пометкой замены. А там, где подходит СТАРЫЙ отказ, новый не заводится: до первой легаси-строки отвечает ИС-12 своими словами — «${String(early.why)}». Запретов от волны не прибавилось, прибавился один шов (ИС-41, ADR-0207 §7)`);

  const D = ['2025-09-30', '2025-12-31', '2026-06-30', '2026-07-31'];
  const som = ST.statSeries({obj:'obj-credit', inds:'a-sumdebt-som', dates:D});
  const cnt = ST.statSeries({obj:'obj-credit', inds:'a-count', dates:D});
  const flat = ST.statSeries({obj:'obj-credit', inds:'a-sumdebt-som', dates:['2025-09-30', '2025-12-31']});
  const brk = som.points.filter(pt => pt.editionBreak);
  const brkC = cnt.points.filter(pt => pt.editionBreak);

  /* #227 — РЯД ЧЕРЕЗ ЗАПУСК НАЗЫВАЕТ СОСТАВ, А ОТМЕТКА СТОИТ НА СТЫКЕ, А НЕ НА РЯДЕ.
     Ряд «Остаток ОД в сомах» через запуск — картинка обвала: 0, 0, 32 миллиона. На графике
     это читается как взрывной рост портфеля, а на деле сомового близнеца старая система не
     считала вовсе (ADR-0214 её не застал). Молчащий ряд выглядит однородным ровно там, где
     он однородным не является, — и потому состав НАЗЫВАЕТСЯ, как называется состав
     разновалютной клетки (ADR-0151 §4): не молчим, не отказываем, говорим, из чего собрано.
     Отметка стоит НА СТЫКЕ — на одной точке из четырёх, а не на всём ряде: несопоставима
     не «история», а конкретная пара соседних точек.
     Изменения между точками модуль НЕ СЧИТАЕТ: графа изменения живёт у отчётности (ИС-47),
     и посчитай он разницу сам — у числа завёлся бы второй производитель. Он отдаёт ПОМЕТКУ,
     чтобы графа могла её напечатать.
     Однородный ряд не обрастает ни словом: пометка, стоящая всегда, не значит ничего. */
  ok(227, som.ok && som.points.length === 4 &&
        som.points[0].value.v === 0 && som.points[1].value.v === 0 &&
        som.points[2].value.v === 32332260 &&
        som.points.map(pt => pt.edition).join('|') === 'легаси|легаси|действующая|действующая' &&
        brk.length === 1 && brk[0].date === '2026-06-30' &&
        has(brk[0].editionBreak, '«легаси» → «действующая»') &&
        has(brk[0].editionBreak, 'форма легаси не собирала «Остаток основного долга в сомах»') &&
        has(brk[0].editionBreak, 'несопоставимо') &&
        JSON.stringify(som.legacyMissing) === '["m-debt-som"]' &&
        JSON.stringify(som.passport.editions.list) === '["легаси","действующая"]' &&
        has(som.passport.editions.text, 'ЧЕРЕЗ ЗАПУСК 01.05.2026') &&
        has(som.passport.editions.text, 'вопрос к получателю, а не к статистике') &&
        som.points.every(pt => pt.delta === undefined) &&
        brkC.length === 1 && !has(brkC[0].editionBreak, 'не собирала') &&
        JSON.stringify(cnt.legacyMissing) === '[]' &&
        cnt.points[0].value.v === 6 && cnt.points[2].value.v === 8 &&
        flat.passport.editions === null &&
        flat.points.every(pt => !pt.editionBreak),
    `ряд «Остаток ОД в сомах» через запуск — это ${som.points.map(pt => pt.value.v).join(', ')}: на графике взрывной рост портфеля, на деле — сомового близнеца старая система не считала вовсе, ADR-0214 её не застал. Молчащий ряд выглядит однородным ровно там, где однородным не является, и потому состав НАЗВАН — «${String(som.passport.editions.text).slice(0, 96)}…», той же фигурой, какой называется состав разновалютной клетки (ADR-0151 §4). Отметка стоит НА СТЫКЕ, а не на ряде: ${brk.length} точка из ${som.points.length}, ${String(brk[0].date)} — «${String(brk[0].editionBreak).slice(0, 128)}…», и она НАЗЫВАЕТ недостающую величину (${som.legacyMissing.join(', ')}), потому что несопоставима не «история вообще», а конкретная пара соседей. У счёта записей недостачи нет (форма легаси считала ${cnt.points[0].value.v} против ${cnt.points[2].value.v}), и отметка там короче на хвост: она про РЕДАКЦИЮ, а не про недостачу. Разницу между точками модуль НЕ СЧИТАЕТ — графа изменения живёт у отчётности (ИС-47), посчитай он сам, у числа завёлся бы второй производитель; он отдаёт ПОМЕТКУ, чтобы графа её напечатала. Однородный ряд не оброс ни словом (отметок ${flat.points.filter(pt => pt.editionBreak).length}, состав не назван): пометка, стоящая всегда, не значит ничего (ИС-41, ADR-0207 §6)`);

  const st = ST.state;
  const legBefore = st.rows.filter(r => ST.isLegacyRow(r)).length;
  const cand = ST.candidates('2026-08-21', true);
  const candJSON = JSON.stringify(cand);
  const ghosts = ['КД-2019/017', 'КД-2021/044'].filter(ref => candJSON.indexOf(ref) >= 0);
  const run228 = ST.run('2026-08-21');
  /* Отказ у входа проверяется НЕ ПРОСТО ФАКТОМ, а причиной: «период зафиксирован» тоже
     вернул бы ok=false — и отправил бы человека за распоряжением о перезакрытии, то есть
     ровно по той дороге, которой для легаси не существует. Дверь обязана отбить по
     ГРАНИЦЕ ЗАПУСКА, до всякого разговора о фиксации (ADR-0207 §5, §7). */
  const runLeg = ST.run('2024-12-31');
  const legAfter = st.rows.filter(r => ST.isLegacyRow(r)).length;
  const touched = st.rows.filter(r => ST.isLegacyRow(r) && r.fixed.at !== ST.legacyLoad().at).length;

  /* #228 — ПРОГОН ЛЕГАСИ НЕ ВИДИТ, И НЕ ПОТОМУ, ЧТО ОТФИЛЬТРОВАН, А ПО ПОСТРОЕНИЮ.
     Фильтр «пропусти легаси» пришлось бы держать в каждом месте, где прогон трогает
     строки, и однажды одно место забыли бы. Здесь фильтра нет вовсе: очередь строится
     ПО МИРУ — по тому, что живёт в реестрах сегодня, — а не по написанным строкам.
     КД-2019/017 и КД-2021/044 в мире отсутствуют, значит в очередь им не попасть НИКАК:
     чтобы прогон их тронул, пришлось бы сначала завести их в реестр.
     Проверяется поимённо и по счёту: до прогона легаси-строк столько же, сколько после,
     и ни у одной не сдвинулась запись фиксации. Исправление легаси-итога — новый выпуск
     миграции с журнальной записью, актор — человек. Ночь чужую историю не переписывает. */
  ok(228, ghosts.length === 0 && cand.ok &&
        run228.ok && run228.written === 34 && run228.date === '2026-08-21' &&
        legBefore === 34 && legAfter === 34 && touched === 0 &&
        ST.queue().length === 0 &&
        runLeg.ok === false && has(runLeg.why, 'раньше запуска') &&
        has(runLeg.why, 'не считает, не видит и не перепишет') &&
        !has(runLeg.why, 'зафиксирован'),
    `прогон легаси НЕ ВИДИТ — и не потому, что отфильтрован, а по построению: очередь строится ПО МИРУ, по тому, что живёт в реестрах сегодня, а не по написанным строкам. КД-2019/017 и КД-2021/044 в сегодняшнем мире отсутствуют, и в кандидатах их ${ghosts.length}: чтобы прогон их тронул, пришлось бы сначала завести их в реестр. Фильтр «пропусти легаси» пришлось бы держать в КАЖДОМ месте, где прогон трогает строки, и однажды одно место забыли бы — вместо этого его нет нигде. Прогон за 21.08 написал ${run228.written} строк, легаси-строк было ${legBefore}, стало ${legAfter}, и ни у одной не сдвинулась запись фиксации (${touched}). В очередь перестроения легаси не попадает ни одной записью (${ST.queue().length}), а прогон за легаси-дату отказан У ВХОДА и ПО ГРАНИЦЕ, а не по фиксации: «${String(runLeg.why).slice(0, 96)}…» — отказ «период зафиксирован» тоже был бы ok=false, но позвал бы за распоряжением о перезакрытии, то есть по дороге, которой для легаси нет. Исправление легаси-итога — НОВЫЙ ВЫПУСК МИГРАЦИИ с журнальной записью, и актор там человек: ночь чужую историю не переписывает (ИС-41, ADR-0207 §5, границы)`);
})();

/* ---- отчёт ---- */
const pass = results.filter(r => r.pass).length;
const lines = results.map(r => `   ${r.pass ? 'PASS' : 'FAIL'}  #${r.n}  ${r.note}`);
const stamp = `SMOKE 2026-08-31 · ${pass}/${results.length} PASS\n` + lines.join('\n');
console.log(stamp);

const body = lines.map(l => '  ' + l).join('\n');
const injected = `  SMOKE 2026-08-31 · ${pass}/${results.length} PASS\n` + body;
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
