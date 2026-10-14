// Headless смоук для mockups/dashboard/dashboard.html — волна 1 макета модуля «Дашборд» (11.10.2026).
// Zero-dep: вытаскивает <script> из HTML и исполняет движок window.DB в node:vm (без DOM — render() и
// toast() становятся no-op). Проверяется не «код есть», а поведение по решениям канона
// mockups/dashboard/ASUBK-dashbord-logika.md (ДБ-1…ДБ-59, ИДБ-1…ИДБ-14):
//   A  рамка и главная: вкладки — системные роли, роль без раскладки — минимальная (ДБ-8, ДБ-38, ДБ-50);
//   B  плитка ссылается на отчёт и чисел не хранит: числа приходят от статистики через отчёт; «ждёт меня» — через очередь
//      модуля-владельца, тоже от статистики (ДБ-99, ДБ-10, ДБ-11);
//   C  время: «сегодня» по умолчанию, только календарные периоды, кэш ≤ 1 мин у «сегодня» (ДБ-12…ДБ-16, ДБ-52);
//   D  показ: одна основа плитки — главное число, сдвиг, второе число, мини-ряд; пять видов в полосе
//      (Ряд · Разрез · Карта · Движение · Таблица) (ДБ-17…ДБ-24);
//   E  клик: главное число — полоса, «☰» — кто в этом числе, полный список или отказ, строки сходятся с числом
//      (ДБ-25, ДБ-26, ДБ-54);
//   F  права у данных, панель фильтров и относительные параметры сужают и не расширяют (ДБ-3, ДБ-27, ДБ-28);
//   G  сборка: личные плитки, администратор, автопроверка, «предложить в каталог», версии, снятие (ДБ-4, ДБ-29…ДБ-31, ДБ-55);
//   H  раскладка: одна на роль, перекладка, свои экраны ≤ 5, секции (ДБ-5, ДБ-32, ДБ-34);
//   I  состояния: ошибка, сломана, отказ, устарело, пустой охват, ноль, волны (ДБ-35, ДБ-53);
//   J  наружу и сигналы: штамп выгрузки, 🔔 ставит сигналы отчётности без поручений, журнал и счётчики (ДБ-36, ДБ-37, ДБ-51, ДБ-106);
//   K  сторож чистоты: в макете нет номеров решений и ADR (с кириллицей, флаг u), «сегодня» заморожено;
//   L  состав объектов 13.10.2026: заявка на реструктуризацию, дело взыскания, эпизод просрочки, объект имущества
//      — 17 объектов, плитки ролей, черновики эпизодов до готовности ядра, роль «Специалист по имуществу» (ДБ-60…ДБ-64);
//      плитки заёмщика: «с просрочкой» и «платёж в ближайшие 3 дня», «я» — ведущий куратор (ДБ-65);
//      разрезы заёмщика — выборка реестра статистики, свёрнутые по портфелю, «Ступени» доступны (ДБ-66).
//   M  волна 3, заёмщик: шкала категорий классификатора (ДБ-Д22); «действующие» по умолчанию у заёмщика и кредита
//      (ДБ-68, ДБ-69); доля с фильтром числителя (ДБ-70, ДБ-80); фильтр по значению в конструкторе (ДБ-Д23); движение
//      клиентов — черновик до статистики (ДБ-71); «Область» по регистрации (ДБ-72, ДБ-73); плитки клиентов в раскладках,
//      видимость через требования, подпись куратора (ДБ-74…ДБ-76); деньги, форматы, сдвиг, реестр (ДБ-67, ДБ-77…ДБ-79);
//      13 разрезов + 5 заявленных, ступени долга, договоров, истории, проверки карточки (ДБ-81…ДБ-84, ДБ-86, ДБ-88).
//   N  кредитная программа: состав и состояние, мер и лимита нет, деньги — срез кредита по программе (ДБ-89…ДБ-98).
//   O  плитка — ссылка на отчёт: отчёты, значения параметров, выбор из ответа, конструктор отчётности над дашбордом, клик по
//      числу в отчёт, сигнал отчётности, круг отчёта, правка отчёта доходит до плитки (ДБ-99…ДБ-113); ссылочные роли — у очереди модуля-владельца;
//      сторожа: «похожий отчёт» с параметрами и датой черновика, отказы «% от итога группы», автопроверка правки, снятие сигналов, seed() без утечек.
//   P  одна основа и пять видов (волна 6, 14.10.2026): основа и второе число со светофором, гашение сдвига и ряда,
//      виды и их причины, разрезы отчёта и «на время просмотра», путь вглубь и «☰ N», полоса в сетке, память видов,
//      закрепление на своём экране, слияние раскладок (Руководство 14, …), конструктор плитки без форматов,
//      «📌 сохранить отчётом», разрезы очередей, «доля» в Таблице, штамп вида (ДБ-115…ДБ-129).
// Блоки, которые правят состояние, начинаются с DB.seed(). Выход 1 при любом FAIL.
//   node scripts/inspect/dashboard-check.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dir = dirname(fileURLToPath(import.meta.url));
const HTML  = resolve(__dir, '../../mockups/dashboard/dashboard.html');
const src   = readFileSync(HTML, 'utf8');
const m = src.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('<script> не найден в HTML'); process.exit(1); }
const win = {};
vm.runInContext(m[1], vm.createContext({ window: win, console, setTimeout: () => {}, clearTimeout: () => {} }), { filename: 'dashboard.inline.js' });
const DB = win.DB;
if (!DB) { console.error('window.DB не экспортирован'); process.exit(1); }

const results = [];
const ok = (n, cond, note = '') => results.push({ n, pass: !!cond, note });
const U = id => DB.USERS.find(u => u.id === id);
const T = id => DB.tileById(id);
const Q = id => DB.questionOf(DB.tileById(id));      // вопрос плитки — собранный из отчёта (у плитки без отчёта — её собственный)
// вопрос второго числа плитки на основе — тем же компилятором, что и основа
const Q2 = id => { const t = T(id), r = DB.reportById(t.report), s = t.second;
  return DB.compile(r, t.params, s.share ? { inds:s.share.slice(), share:s.share.slice() } : s.pct ? { inds:[s.col || r.cols[0]], pct:s.pct } : { inds:[s.col || s.of] }); };
const sum = a => a.reduce((x, y) => x + y, 0);
const withParams = (t, p) => Object.assign({}, t, { params:Object.assign({}, t.params, p) });
const asUser = id => { DB.state.userId = id; };

/* ---------- A. Рамка и главная ---------- */
(() => {
  DB.seed();
  const roleIds = DB.ROLES.map(r => r.id);
  ok(1, Object.keys(DB.state.declared).every(r => roleIds.includes(r)),
    'объявленные раскладки ведутся по системным ролям, своих «ролей экрана» нет (ДБ-38)');
  ok(2, DB.composeLayout('u11', 'adm').join() === 'tasks' && !DB.roleHasLayout('adm'),
    'роль без своей раскладки получает минимальную: «Мои задания» (ДБ-50, уточняет ДБ-8)');
  ok(3, DB.USERS.every(u => u.roles.some(r => DB.composeLayout(u.id, r).length > 0)),
    'у каждого пользователя главная не пуста — пустой главной нет (ДБ-8)');
  const lead = DB.composeLayout('u1', 'lead');
  ok(4, lead.filter(k => !k.startsWith('s:')).length === 12 && lead.filter(k => k.startsWith('s:')).length === 4 && DB.DECLARED_SEED.lead.filter(k => !k.startsWith('s:')).length === 14,
    `стартовая раскладка «Руководства» — 14 плиток в четырёх секциях, отвечают 12: эпизоды просрочки ждут ядра, движение клиентов — погашенный вид «Заёмщиков» (ДБ-40, ДБ-60…ДБ-65, ДБ-74): ${lead.length} элементов`);
})();

/* ---------- B. Плитка — ссылка на отчёт, числа от статистики ---------- */
(() => {
  DB.seed();
  const numericKeys = ['value', 'values', 'number', 'cached', 'result'];
  ok(5, DB.TILES.every(t => numericKeys.every(k => !(k in t))),
    'ни одна плитка не хранит чисел — только вопрос (ИДБ-2)');
  ok(6, DB.TILES.every(t => DB.questionOf(t).inds.every(i => DB.IND[i] && DB.OBJECTS[DB.IND[i].obj]) && !('source' in t) && !('url' in t)),
    'каждый показатель плитки — запись реестра статистики; поля «источник: API / файл» у плитки нет (ДБ-10)');
  ok(7, DB.TILES.every(t => { const q = DB.questionOf(t); return new Set(q.inds.map(i => DB.IND[i].obj)).size === 1 && q.inds.length <= 4; }),
    'каждая плитка — один объект и не больше четырёх показателей (ДБ-18, ИДБ-8)');
  const r = DB.ask(T('tasks'), U('u2'), 'cur', {});
  ok(8, r.value === DB.DATA.task.filter(x => x.assignee === 'u2').length && T('tasks').kind === 'link' && T('tasks').queue,
    `«Мои задания» — число от статистики (объект «Задание»), клик — очередь модуля (ДБ-11, ДБ-25): ${r.value}`);
  ok(9, DB.TILES.filter(t => t.kind !== 'link').every(t => !t.queue) && DB.TILES.filter(t => t.kind === 'link').every(t => DB.queueById(t.queue) && DB.queueOf(t).module && Q(t.id).queue.module === DB.queueOf(t).module),
    'у ссылочной плитки есть очередь модуля, у обзорной — нет (ДБ-7, ДБ-25)');
})();

/* ---------- C. Время ---------- */
(() => {
  DB.seed();
  const bs = DB.blankDraft('r-loans'), bf = DB.blankDraft('r-receipts');
  ok(10, bs.params.date === 'today' && !('period' in bs.params) && bf.params.period === 'curMonth' && !('date' in bf.params) && !('date' in bs) && !('period' in bf),
    'режим даты по умолчанию — «сегодня»; дата — значение параметра отчёта, у потока — период «текущий месяц» (ДБ-12, ДБ-107)');
  const r = DB.ask(T('lead-bal'), U('u1'), 'lead', {});
  ok(11, /на 14:15 · день не закрыт/.test(r.passport), `паспорт «сегодня»: ${r.passport}`);
  const keys = Object.keys(DB.PERIODS);
  ok(12, keys.join() === 'today,curMonth,prevMonth,curQuarter,prevQuarter,ytd,prevYear' && !keys.some(k => /\d+d|days|range|fixed/.test(k)),
    `периоды только календарные плюс «сегодня»; скользящих окон и фиксированных дат нет (ДБ-15): ${keys.join(', ')}`);
  const cm = DB.ask(withParams(T('acc-prev'), { period:'curMonth' }), U('u4'), 'acc', {});
  ok(13, /идёт 11-й день/.test(cm.passport), `текущий месяц не подменяется: подпись называет день (ДБ-16): ${cm.passport}`);
  DB.cachedAsk(T('lead-bal'), U('u1'), 'lead', {}); const h0 = DB.state.cacheHits;
  DB.cachedAsk(T('lead-bal'), U('u1'), 'lead', {}); const h1 = DB.state.cacheHits;
  DB.tick(2); const miss0 = DB.state.cacheMiss; DB.cachedAsk(T('lead-bal'), U('u1'), 'lead', {});
  ok(14, h1 === h0 + 1 && DB.state.cacheMiss === miss0 + 1,
    'ответ «сегодня» берётся из кэша не дольше минуты, потом статистика спрашивается заново (ДБ-52, ДБ-13)');
  const closed = Object.assign(withParams(T('lead-bal'), { date:'closedDay' }), { id:'closed-copy' });
  DB.cachedAsk(closed, U('u1'), 'lead', {}); DB.tick(5); const hc = DB.state.cacheHits; DB.cachedAsk(closed, U('u1'), 'lead', {});
  ok(15, DB.state.cacheHits === hc + 1, 'ответ на закрытый день живёт в кэше до следующего прогона; дата — значение параметра отчёта (ДБ-52, ДБ-107)');
  ok(16, DB.scopeKey(T('cur-bal'), U('u2'), 'cur') !== DB.scopeKey(T('cur-bal'), U('u5'), 'zal')
    && DB.scopeKey(T('lead-bal'), U('u1'), 'lead') !== DB.scopeKey(T('lead-bal'), U('u5'), 'zal'),
    'ключ кэша — «вопрос + охват»: разные охваты не смешиваются (ДБ-52)');
})();

/* ---------- D. Показ ---------- */
(() => {
  DB.seed(); asUser('u1');
  const f = DB.VIEW_KINDS;
  ok(17, f.join() === 'series,slice,map,move,table' && !('FORMAT_NAMES' in DB) && !f.some(x => /pie|donut|круг/i.test(x)) && DB.TILES.every(t => !('format' in t)),
    `пять видов вместо восьми форматов: ряд, разрез, карта, движение, таблица; круговой нет, формата у плитки нет (ДБ-118): ${f.join(', ')}`);
  ok(18, !('SIZE' in DB) && !/\.tile\.(w2|h2)|sizeClass|previewHTML/.test(src),
    'размер формат не задаёт: одна основа 1×1 у всех плиток и в предпросмотре конструктора, классов 2×1 и 2×2 нет (ДБ-115)');
  const d = Object.assign(DB.blankDraft('r-balreg'), { id:'d19' });
  const sl = DB.view(d, 'slice', { dim:'region' }, [], 'u1', 'lead', {}), st = DB.view(d, 'slice', { dim:'bucket' }, [], 'u1', 'lead', {});
  ok(19, !DB.DIMS.region.ordered && DB.DIMS.bucket.ordered && sl.format === 'slice' && st.format === 'steps' && sl.nodes.length > 0 && st.nodes.length > 0,
    `Разрез по разрезу без объявленного порядка — список с топом, по разрезу с порядком — ступени сам (ДБ-118): ${sl.format} · ${st.format}`);
  const two = DB.autocheck(Object.assign(DB.blankDraft('r-loans'), { title:'x', second:{ col:'borrower.count' } }));
  ok(20, !two.ok && two.checks.some(c => !c.ok && /один объект/.test(c.text)) && two.checks.some(c => !c.ok && /колонки из отчёта/.test(c.text)),
    'второе число другого объекта не проходит автопроверку: объект у отчёта один, колонка не из отчёта отвергнута (ДБ-18, ДБ-109, ДБ-116)');
  const bod = DB.base('lead-od', 'u1', 'lead'), share = Object.assign({ tl:bod.tl }, bod.second);   // доля — второе число «Просрочено»
  ok(21, share.num > 0 && share.den > 0 && Math.abs(share.value - share.num / share.den * 100) < 1e-9 && share.unit === 'pct',
    `доля — показ двух показателей одного объекта, оба числа есть (ДБ-19): ${share.value.toFixed(2)} % = ${share.num} / ${share.den}`);
  const partT = withParams(T('acc-prev'), { period:'curMonth' }), part = DB.answer(Object.assign(DB.questionOf(partT), { format:'shift' }), U('u4'), 'acc', {}), partA = DB.ask(partT, U('u4'), 'acc', {});
  const rcp = Object.assign(DB.blankDraft('r-receipts'), { main:{ col:'receipt.amount' } });
  ok(22, part.shift && part.shift.none && /неполный период/.test(part.shift.none) && partA.state === 'ok' && partA.shift && /неполный период/.test(partA.shift.none) && partA.value > 0
    && !DB.shiftsFor(withParams(rcp, { period:'curMonth' }))[0].ok
    && /неполный период/.test(DB.shiftsFor(withParams(rcp, { period:'curMonth' }))[0].why) && DB.shiftsFor(withParams(rcp, { period:'prevMonth' }))[0].ok
    && DB.shiftsFor(withParams(rcp, { period:'prevMonth' }))[0].id === 'period',
    'сдвиг у неполного периода погашен с причиной — неполный с полным не сравнивается; плитка с таким периодом отвечает, сдвиг на ней погашен с той же причиной; у прошлого месяца есть (ДБ-21, ИДБ-11)');
  const sb = DB.shiftsFor(DB.blankDraft('r-loans')), sbp = DB.shiftsFor(withParams(DB.blankDraft('r-loans'), { date:'prevMonthEnd' }));
  ok(23, sb.length === 3 && sb.every(x => x.ok) && sbp.find(x => x.id === 'prevMonthEnd').ok === false,
    'у остатка ровно три базы сдвига: конец прошлого месяца, начало года, год назад; база, совпавшая с датой плитки, погашена (ДБ-21)');
  ok(24, Q('cur-plan1').share.join() === 'loan.paidPlanned,loan.plan' && DB.IND['loan.expected'] && T('lead-paid').second.share[1] === 'loan.expected'
    && !Object.values(DB.IND).some(i => /цел|target/i.test(i.id + i.name)),
    'план-факт — «План» кредита и «Ожидалось по графику»; «целевого показателя» нет, цель — только лимит программы (ДБ-22, ДБ-23)');
  ok(25, share.tl === 'yellow' && /порог/.test(DB.tlText(T('lead-od'))), `светофор на втором числе с напечатанным порогом: ${share.tl} · ${DB.tlText(T('lead-od'))} (ДБ-24)`);
  DB.STAND.overdueUp = true; const upb = DB.base('lead-od', 'u1', 'lead'), up = Object.assign({ tl:upb.tl }, upb.second); DB.STAND.overdueUp = false;
  ok(26, up.tl === 'red', `при росте просрочки светофор краснеет: ${up.value.toFixed(2)} % (ДБ-24)`);
  const mv = DB.view('lead-bal', 'move', null, [], 'u1', 'lead', {}).move;
  ok(27, mv.converges && typeof mv.other === 'number' && mv.otherName && mv.start + mv.ti - mv.td + mv.other === mv.end,
    'движение (вид «Движение» в полосе) сходится: конец = начало + обороты, строка «прочее» есть всегда (ДБ-17, ДБ-118)');
})();

/* ---------- E. Клик и два действия ---------- */
(() => {
  DB.seed();
  const big = DB.statRows(T('lead-bal'), U('u1'), 'lead', {});
  ok(28, big.refused && big.count === 1248 && /сузьте/.test(big.msg), `выше порога — отказ с числом строк, не усечённый список (ДБ-54): ${big.msg}`);
  const r = DB.ask(T('cur-bal'), U('u2'), 'cur', {}).second; const sr = DB.statRows(T('cur-bal'), U('u2'), 'cur', {});
  ok(29, !sr.refused && sr.list.length === r.value && r.value === 47, `«кто в этом числе» — полный список, строк столько же, сколько в числе: ${sr.list.length} = ${r.value} (ИДБ-9)`);
  const od = DB.ask(T('cur-od'), U('u2'), 'cur', {}); const sro = DB.statRows(T('cur-od'), U('u2'), 'cur', {});
  ok(30, !sro.refused && sro.sum === od.value, `сумма строк сходится с главным числом плитки: ${sro.sum} = ${od.value} (ДБ-115)`);
  const n181 = { value:DB.at('cur-od', 'table(bucket;loan.count)', 'u2', 'cur', {}).find(x => x[0] === '181+')[1] };
  const s181 = DB.statRows(T('cur-od'), U('u2'), 'cur', {}, null, [{ dim:'bucket', v:'181+' }]);
  ok(31, !s181.refused && s181.list.length === n181.value, `клик по ступени открывает строки этого узла: ${s181.list.length} = ${n181.value}`);
  const reg = DB.registryList(T('cur-bal'), U('u2'), 'cur', {});
  ok(32, reg.registry === 'Реестр кредитов' && reg.today === 47 && reg.slice === 47, '«Работать со списком» — реестр владельца на сегодня, с подписью «в реестре N, в срезе M» (ДБ-26)');
})();

/* ---------- F. Права, охват, фильтры ---------- */
(() => {
  DB.seed();
  const cat = DB.catalogFor(U('u10')); const ll = cat.find(x => x.t.id === 'lead-bal');
  ok(33, ll && /не открыт вашей роли/.test(ll.why), `недоступная плитка в каталоге не спрятана, а названа причиной (ДБ-3): ${ll && ll.why}`);
  const na = DB.ask(T('lead-bal'), U('u10'), 'rep', {});
  ok(34, na.state === 'noaccess' && na.value === undefined, 'плитка без права на её объект — «нет доступа», без числа (ИДБ-4)');
  const all = DB.ask(T('lead-bal'), U('u1'), 'lead', {}); const osh = DB.ask(T('lead-bal'), U('u1'), 'lead', { region:'Ошская' });
  ok(35, osh.second.value < all.second.value && osh.value < all.value && /фильтр: Ошская/.test(osh.passport), `панель фильтров сужает и печатает фильтр: ${osh.second.value} кредитов из ${all.second.value} · ${osh.passport} (ДБ-27)`);
  const tk = DB.ask(T('tasks'), U('u1'), 'lead', { region:'Ошская' });
  ok(36, /без фильтра/.test(tk.passport) && tk.value === DB.ask(T('tasks'), U('u1'), 'lead', {}).value, 'к плитке без такого разреза фильтр неприменим — «без фильтра» (ДБ-27)');
  const narrowed = DB.ask(T('cur-bal'), U('u2'), 'cur', { region:'Ошская' });
  ok(37, narrowed.value === 0 && narrowed.second.value === 0, 'фильтр не расширяет охват: кредитов Бековой в Ошской нет — 0 (ИДБ-12)');
  DB.USERS.push({ id:'c00', name:'Тестовый куратор', roles:['cur'], dept:'rp-chu' });
  const other = DB.ask(T('cur-bal'), U('c00'), 'cur', {}).second;
  ok(38, other.value === DB.DATA.loan.filter(l => l.curator === 'c00' && !l.closed).length && other.value !== 47,
    `относительный параметр «я»: одна каталожная плитка «Остаток» у каждого куратора своя — ${other.value} против 47 (ДБ-28)`);
  DB.USERS.pop();
})();

/* ---------- G. Сборка плиток ---------- */
(() => {
  DB.seed();
  ok(39, !DB.catalogFor(U('u1')).some(x => x.t.id === 'p-u2-agro') && DB.catalogFor(U('u2')).some(x => x.t.id === 'p-u2-agro'),
    'личная плитка видна только автору (ДБ-4, ИДБ-5)');
  asUser('u2');
  const d = Object.assign(DB.blankDraft('r-loans'), { title:'Мои кредиты', params:{ curator:'@me', date:'today' } });
  const pub = DB.saveTile(d, 'publish'); const per = DB.saveTile(d, 'personal');
  ok(40, pub.error && /администратор/.test(pub.error) && per.tile && per.tile.state === 'personal' && per.tile.owner === 'u2' && per.tile.report === 'r-loans'
    && DB.ask(per.tile, U('u2'), 'cur', {}).value === DB.ask(T('cur-bal'), U('u2'), 'cur', {}).second.value,
    'любой собирает личную плитку на доступном отчёте; публикует в каталог только администратор дашборда (ДБ-4, ДБ-29, ДБ-103)');
  asUser('u11');
  const ad = DB.saveTile(Object.assign(DB.blankDraft('r-balreg'), { title:'Остаток по областям', main:{ col:'loan.balance' } }), 'publish');
  ok(41, ad.tile && ad.tile.state === 'published' && ad.tile.owner === 'catalog', 'администратор публикует сразу после автопроверки — второго ключа нет (ДБ-30)');
  const bad = DB.saveTile(Object.assign(DB.blankDraft('r-spells'), { title:'x', params:{ curator:'*', period:'prevMonth' }, main:{ col:'spell.in' } }), 'publish');
  ok(42, bad.error && bad.checks.some(c => !c.ok && /предпросмотр/.test(c.text)), 'плитка, отчёт которой не отвечает, не публикуется (ИДБ-14)');
  asUser('u2'); DB.propose(per.tile.id); asUser('u11');
  ok(43, DB.state.proposals.length === 1 && DB.moveToCatalog(per.tile.id) && T(per.tile.id).state === 'published' && T(per.tile.id).owner === 'catalog',
    'личная плитка уходит в каталог только через «Предложить» и перенос администратором (ДБ-31)');
  const e0 = DB.editTile('lead-bal', { inds:['loan.balance'] }), e1 = DB.editTile('lead-bal', { report:'r-loans' });
  const e2 = DB.editTile('lead-bal', { title:'Остаток портфеля' });
  ok(44, e0.error && /правятся в отчёте/.test(e0.error) && e1.error && /новая плитка/.test(e1.error) && e2.tile.version === 2 && T('lead-bal').report === 'r-portfolio' && !('inds' in T('lead-bal')),
    'правка подписи — новая версия у всех; другой отчёт — новая плитка; показатель плитка не правит — он в отчёте (ДБ-55, ДБ-113)');
  DB.state.overlays['u1|an'] = { order:[], hidden:[], added:['cat-spopen'] }; asUser('u1'); DB.screenAdd('sc1', 'cat-spopen'); asUser('u11');
  const w = DB.withdrawTile('cat-spopen');
  ok(45, w.personal === 1 && w.screens === 1 && DB.composeLayout('u1', 'an').includes('x:cat-spopen'),
    `снятие называет, где стоит плитка (личных: ${w.personal}, своих экранов: ${w.screens}); в личной раскладке — заглушка «снята»`);
  const w2 = DB.withdrawTile('lead-risk');
  ok(46, w2.roles.includes('lead') && !DB.composeLayout('u1', 'lead').includes('lead-risk'), 'снятая плитка исчезает из объявленной раскладки роли');
})();

/* ---------- H. Раскладка и экраны ---------- */
(() => {
  DB.seed(); asUser('u1');
  ok(47, DB.state.declared.an.join() === DB.state.declared.lead.join() && DB.state.declared.an !== DB.state.declared.lead,
    'Аналитик стартует с копии «Руководства», но раскладка у него своя (ДБ-50)');
  DB.arrangeHide('lead', 'lead-risk'); const hidden = !DB.composeLayout('u1', 'lead').includes('lead-risk');
  DB.resetDeclaredFor('lead'); const back = DB.composeLayout('u1', 'lead').includes('lead-risk');
  ok(48, hidden && back, '«Вернуть как объявлено» стирает личную перекладку целиком (ДБ-5)');
  DB.arrangeMove('lead', 'lead-borr', -1); asUser('u11'); DB.declaredEdit('lead', 'add', 'cat-rsmulti'); asUser('u1');
  const L = DB.composeLayout('u1', 'lead');
  ok(49, L[L.length - 1] === 'cat-rsmulti' && L.indexOf('lead-borr') < L.indexOf('lead-od'),
    'новая плитка роли встаёт в конец личной раскладки, перекладка сохраняется (ДБ-5)');
  let err = null; for (let i = 0; i < 6; i++) { const r = DB.createScreen('Экран ' + i); if (r.error) err = r.error; }
  ok(50, DB.screens('u1').length === 5 && /не больше пяти/.test(err), 'своих экранов не больше пяти (ДБ-32)');
  const sc = DB.screens('u1')[0];
  ok(51, sc.filter && sc.filter.region === 'Ошская', 'свой экран хранит сохранённый фильтр панели (ДБ-32)');
  ok(52, Object.values(DB.DECLARED_SEED).every(L => L[0].startsWith('s:')), 'раскладки ролей разбиты на секции (ДБ-34)');
})();

/* ---------- I. Состояния ---------- */
(() => {
  DB.seed();
  DB.STAND.statDown = true; const e = DB.ask(T('lead-bal'), U('u1'), 'lead', {}); DB.STAND.statDown = false;
  ok(53, e.state === 'error' && e.value === undefined, 'статистика не ответила — ни ноль, ни прошлое значение (ДБ-35)');
  DB.STAND.withdrawn['loan.risk'] = '11.10'; const br = DB.ask(T('lead-risk'), U('u1'), 'lead', {}); delete DB.STAND.withdrawn['loan.risk'];
  ok(54, br.state === 'broken', 'показатель выведен из реестра — плитка «сломана объявлением»');
  const rf = DB.ask(T('lead-spin'), U('u1'), 'lead', {});
  ok(55, rf.state === 'refusal' && /владелец — модуль «Ядро расчёта»/.test(rf.msg), `настоящий отказ шва назван поимённо: ${rf.msg}`);
  DB.STAND.nightRunFailed = true; const st1 = DB.ask(withParams(T('lead-bal'), { date:'closedDay' }), U('u1'), 'lead', {}); const st2 = DB.ask(T('lead-bal'), U('u1'), 'lead', {});
  DB.STAND.nightRunFailed = false; DB.STAND.queueLag = 25; const st3 = DB.ask(T('lead-bal'), U('u1'), 'lead', {}); DB.STAND.queueLag = 0;
  ok(56, st1.staleState && !st2.staleState && st3.staleState && st1.value !== undefined,
    'устаревшее число показывается с датой и пометкой: закрытый день — при сбое ночного прогона, «сегодня» — при очереди > 15 мин (ДБ-35)');
  DB.USERS.push({ id:'c01', name:'Новый куратор', roles:['cur'], dept:'risk' });
  const em = DB.ask(T('cur-bal'), U('c01'), 'cur', {}); DB.USERS.pop();
  ok(57, em.state === 'empty' && em.visible === 0, 'пустой охват — законный ответ «видно 0», не ошибка (ДБ-3)');
  ok(58, DB.ask(T('zal-ban'), U('u5'), 'zal', {}).state === 'zero', 'ноль — это ответ: «посчитали — нет»');
  DB.STAND.wave = 2;
  ok(59, !DB.roleHasLayout('rep') && !DB.tileAnswers(T('rep-od')) && !DB.composeLayout('u2', 'cur').includes('tasks') && DB.roleHasLayout('spec'),
    'волна 2: отчётность ещё на минимальной раскладке, неотвечающая плитка в раскладку не попадает (ДБ-53, ИДБ-14)');
  DB.STAND.wave = 1;
  ok(60, !DB.roleHasLayout('spec') && DB.roleHasLayout('lead') && /не объявлен/.test(DB.ask(T('spec-work'), U('u6'), 'spec', {}).msg),
    'волна 1: заявка не объявлена — роль на минимальной, отказ называет владельца (ДБ-53)');
  DB.STAND.wave = 3;
})();

/* ---------- J. Наружу и сигналы ---------- */
(() => {
  DB.seed(); asUser('u1');
  const ex = DB.exportTile('lead-od', 'xlsx', 'lead');
  ok(61, ex.stamp.some(s => /^Паспорт: на 14:15/.test(s)) && ex.stamp.some(s => /НЕ ЯВЛЯЕТСЯ ОФИЦИАЛЬНЫМ ДОКУМЕНТОМ/.test(s)) && ex.stamp.some(s => /Выгрузил: Асанов/.test(s))
    && ex.csv.startsWith('# '), 'выгрузка всегда со штампом: паспорт, «не официальный документ», кто и когда (ДБ-36, ИДБ-10)');
  ok(62, DB.state.journal[0].action === 'выгрузил Excel' && DB.state.journal[0].who === 'u1', 'выгрузка записана в журнал поимённо (ДБ-51)');
  const tasksBefore = DB.DATA.task.length;
  const ot = T('lead-od'), sg = DB.signal('lead-od', 'lead');
  ok(63, Array.isArray(sg) && sg.length === 2 && sg.map(s => s.label).join('|') === '> 5 %|> 4 %' && DB.state.signals.length === 2
    && sg.every(s => s.owner === 'u1' && s.roleId === 'lead' && s.tile === 'lead-od' && s.report === ot.report && JSON.stringify(s.params) === JSON.stringify(ot.params) && s.params !== ot.params)
    && DB.state.notifs.length === 0 && sg[0].state === false && sg[1].state === true,
    '🔔 на «Просрочено» ставит два сигнала отчётности по доле портфеля (> 5 %, > 4 %) на тот же отчёт с теми же значениями параметров; при постановке ничего не отправляется (ДБ-106)');
  DB.STAND.overdueUp = true; const sf = DB.nightCheck(); DB.STAND.overdueUp = false;
  ok(64, DB.DATA.task.length === tasksBefore && sf.length === 1 && DB.state.notifs.every(n => !('task' in n)) && DB.signal('lead-od', 'lead') === false && DB.state.signals.length === 0,
    'сигнал только информирует, даже сработав: заданий не прибавилось, поручений нет; повторное 🔔 снимает сигналы (ДБ-106, ИДБ-13)');
  DB.cachedAsk(T('lead-bal'), U('u1'), 'lead', {});
  ok(65, Object.keys(DB.state.usage).length === 0 || Object.keys(DB.state.usage).every(k => DB.tileById(k)), 'просмотры считаются по плитке, без имени смотрящего (ДБ-51)');
})();

/* ---------- K. Сторож чистоты ---------- */
(() => {
  const body = src.replace(/<!--[\s\S]*?-->/g, '');
  ok(66, !/(?<![\p{L}\d])(ДБ|ИДБ|ADR|ИС)-\d/u.test(body), 'в макете нет номеров решений и ADR — их место канон (ловит и кириллические коды ДБ/ИДБ/ИС)');
  ok(67, DB.TODAY.label === '11.10.2026 14:15' && !/new Date\(\)/.test(body), '«сегодня» заморожено константой');
})();

/* ---------- L. Состав объектов 13.10.2026 ---------- */
(() => {
  DB.seed();
  const O = DB.OBJECTS; const want = { rsapp:['Заявка на реструктуризацию','Реструктуризация',1], case:['Дело взыскания','Взыскание',1],
    spell:['Эпизод просрочки','Ядро расчёта',1], asset:['Объект имущества','Имущество',2] };
  ok(68, Object.keys(O).length === 17 && Object.entries(want).every(([k, [n, ow, w]]) => O[k] && O[k].name === n && O[k].owner === ow && O[k].wave === w)
    && O.spell.gate && !DB.STAND.spells,
    `в реестре 17 объектов; новые четыре — с владельцем и волной, эпизоды ждут ядра (ДБ-60…ДБ-64): ${Object.keys(O).length}`);
  ok(69, !Object.values(DB.IND).some(i => i.obj === 'loan' && /эпизод/i.test(i.name)) && Object.values(O).filter(o => /эпизод/i.test(o.name)).length === 1,
    'эпизоды просрочки — один объект, а не показатель кредита: прежний отказ «эпизоды у кредита» убран (ДБ-62)');
  // ДБ-60: заявка на реструктуризацию
  const R = DB.DATA.rsapp; const inW = R.filter(r => r.inWork);
  const lr = DB.ask(T('lead-rs'), U('u1'), 'lead', {}); const mu = DB.ask(T('cat-rsmulti'), U('u1'), 'lead', {});
  ok(70, lr.state === 'ok' && lr.value === inW.length && mu.state === 'ok' && mu.value === inW.filter(r => r.multi).length && mu.value <= lr.value
    && Math.abs(mu.second.value - mu.value / lr.value * 100) < 1e-9 && mu.second.den === lr.value
    && lr.second.value === inW.filter(r => r.late).length && lr.tl === 'red',
    `Руководство: обращений в работе ${lr.value}, срок нарушен ${lr.second.value} — красный на втором числе; из них многократных ${mu.value} (плитка каталога, ${DB.fmtVal(mu.second.value, 'pct')} обращений в работе) (ДБ-60)`);
  const mine = R.filter(r => r.curator === 'u2'); const cr = DB.ask(T('cur-rs'), U('u2'), 'cur', {});
  const cs = DB.at('cur-rs', 'table(rstage;rsapp.count)', 'u2', 'cur', {});
  const co = DB.ask(T('cur-rsout'), U('u2'), 'cur', {});
  ok(71, cr.value === mine.filter(r => r.inWork).length && cr.value > 0 && cr.second.value === mine.filter(r => r.late).length && cr.tl === 'red'
    && cs.length === 9 && cs[0][0] === 'регистрация обращения' && cs[8][0] === 'закрыта' && sum(cs.map(x => x[1])) === mine.length
    && co.state === 'ok' && co.value === mine.filter(r => r.outAt === -1).length,
    `Куратор: в работе ${cr.value}, срок нарушен ${cr.second.value} (красный на втором), девять стадий по порядку в Таблице, исходы прошлого месяца ${co.value} — только «куратор = я» (ДБ-60)`);
  ok(72, R.filter(r => r.multi || (r.stage === 'закрыта' && /^одобрена/.test(r.outcome || ''))).every(r => DB.DATA.loan.find(l => l.id === r.loan).status === 'В реструктуризации')
    && new Set(R.map(r => r.loan)).size === R.length,
    'демо-числа не спорят: многократная и одобренная заявка — по кредиту «в реструктуризации», один кредит — одна заявка (урок «демо-числа противоречат»)');
  // ДБ-61: дело взыскания
  const rv = DB.ask(T('lead-recov'), U('u1'), 'lead', {});
  ok(73, Q('lead-recov').share.every(i => DB.IND[i].obj === 'case') && rv.state === 'ok' && Math.abs(rv.value - rv.num / rv.den * 100) < 1e-9 && rv.unit === 'pct',
    `возвратность по делам — доля двух показателей одного объекта «Дело»: ${rv.value.toFixed(1)} % = ${rv.num} / ${rv.den} (ДБ-61, ИДБ-8)`);
  const mixed = DB.autocheck(Object.assign(DB.blankDraft('r-cases'), { title:'x', main:{ share:['claim.recovered','case.base'] } }));
  const mixedR = DB.rcheck(Object.assign(DB.blankReportDraft(), { title:'x', inds:['claim.recovered','case.base'], share:['claim.recovered','case.base'] }));
  const loansInCases = DB.DATA.case.flatMap(c => c.loans);
  ok(74, !mixed.ok && mixed.checks.some(c => !c.ok && /один объект/.test(c.text)) && mixed.checks.some(c => !c.ok && /доля — две колонки отчёта/.test(c.text))
    && !mixedR.ok && mixedR.checks.some(c => !c.ok && /один объект/.test(c.text)) && new Set(loansInCases).size === loansInCases.length,
    'возвратность «по требованиям» собрать нельзя — доля между объектами не проходит; каждый кредит в делах один раз, долг не считается дважды (ДБ-61)');
  const pc = DB.ask(T('prob-cases'), U('u3'), 'prob', {}); const pr = DB.ask(T('prob-recov'), U('u3'), 'prob', {});
  const lc = DB.ask(T('prob-cases'), U('u1'), 'lead', {});
  ok(75, pc.state === 'ok' && pc.second.value > 0 && pc.second.value <= pc.value && pc.visible < lc.visible && pr.state === 'ok'
    && ['prob-court', 'prob-exp'].every(id => DB.ask(T(id), U('u3'), 'prob', {}).state === 'ok') && DB.composeLayout('u3', 'prob').includes('prob-recov'),
    `Проблемные кредиты: дел открыто / в карантине ${pc.value} / ${pc.second.value}; дела видны через требования своего охвата (${pc.visible} из ${lc.visible}) (ДБ-61)`);
  ok(76, /без фильтра/.test(DB.ask(T('prob-cases'), U('u1'), 'lead', { dept:'opk' }).passport),
    'у дела нет подразделения — фильтр панели «Подразделение» к нему неприменим и печатается «без фильтра» (ДБ-61)');
  // ДБ-62: эпизод просрочки
  const spT = ['lead-spin', 'lead-spcure', 'cur-spin'];
  const notIn = spT.every(id => !DB.tileAnswers(T(id))) && !DB.composeLayout('u1', 'lead').includes('lead-spin') && !DB.composeLayout('u2', 'cur').includes('cur-spin')
    && DB.catalogFor(U('u1')).filter(x => spT.includes(x.t.id)).every(x => !x.ready) && DB.ask(T('lead-spcure'), U('u1'), 'lead', {}).state === 'refusal';
  DB.STAND.spells = true;
  const inNow = spT.every(id => DB.tileAnswers(T(id))) && DB.composeLayout('u1', 'lead').includes('lead-spin') && DB.composeLayout('u1', 'lead').includes('lead-spcure')
    && DB.composeLayout('u2', 'cur').includes('cur-spin');
  const si = DB.ask(T('lead-spin'), U('u1'), 'lead', {}); const sc = DB.ask(T('lead-spcure'), U('u1'), 'lead', {}); const cs2 = DB.ask(T('cur-spin'), U('u2'), 'cur', {});
  ok(77, notIn && inNow && si.state === 'ok' && si.shift && !si.shift.none && sc.value > 0 && cs2.value > 0 && /идёт 11-й день/.test(cs2.passport),
    `эпизоды — черновики, пока ядро не отдаёт перечень; переключатель стенда — и плитки встают: вышли ${si.value}, вылечены ${sc.value}, у куратора за октябрь ${cs2.value} (ДБ-62, ДБ-53, ИДБ-14)`);
  const open = DB.DATA.spell.filter(x => x.state === 'тянется');
  const bk = sum(DB.at('lead-od', 'table(bucket;loan.count)', 'u1', 'lead', {}).map(x => x[1]));
  ok(78, open.length === bk && new Set(open.map(x => x.loan)).size === open.length,
    `у каждого кредита в просрочке ровно один тянущийся эпизод: ${open.length} = просроченных кредитов по срокам в Таблице «Просрочено» ${bk} (урок «демо-числа противоречат»)`);
  DB.STAND.spells = false;
  // ДБ-63: объект имущества, роль «Специалист по имуществу»
  const ast = DB.USERS.find(u => u.roles.includes('ast'));
  ok(79, DB.ROLES.find(r => r.id === 'ast' && r.name === 'Специалист по имуществу' && r.scope === 'dept') && ast && DB.state.declared.ast
    && DB.composeLayout(ast.id, 'ast').filter(k => !k.startsWith('s:')).length === 7,
    `вкладка «Специалист по имуществу»: системная роль, охват «моё подразделение», 7 плиток (${ast && ast.name}) (ДБ-63, ДБ-38)`);
  const ai = DB.ask(T('ast-idle'), ast, 'ast', {}); const au = DB.ask(T('ast-unsold'), ast, 'ast', {});
  ok(80, ai.tl === 'yellow' && ai.value > 0 && Q('ast-idle').filter.some(c => c.f === 'daysOnBook' && c.v === 182) && Q('ast-unsold').filter.some(c => c.op === 'ge' && c.v === 3)
    && au.state === 'ok' && ['ast-count', 'ast-kpod', 'ast-claim', 'ast-exp', 'ast-unsold'].every(id => ['ok', 'zero'].includes(DB.ask(T(id), ast, 'ast', {}).state)),
    `пороги «6 мес.» и «3 попытки» — фильтр вопроса, цвет — светофор автора: без попытки ${ai.value} (жёлтый), 3+ попыток ${au.value} (ДБ-63, ДБ-24)`);
  const la = DB.ask(T('lead-ast'), U('u1'), 'lead', {}); const sa = DB.ask(T('ast-count'), ast, 'ast', {});
  ok(81, la.second.value === sa.second.value && la.value === sa.value && sa.second.value === 48,
    `Руководство «На балансе» (стоимость · объектов) и специалист «На учёте» (стоимость · объектов) сходятся: ${sa.second.value} объектов / ${DB.fmtVal(la.value, 'sum')} (урок «демо-числа противоречат»)`);
  DB.STAND.wave = 1;
  const w1 = DB.composeLayout('u1', 'lead');
  ok(82, !DB.roleHasLayout('ast') && !w1.includes('lead-ast') && !w1.includes('s:Имущество') && w1.includes('lead-rs') && w1.includes('lead-recov')
    && DB.composeLayout('u2', 'cur').includes('cur-rs') && /не объявлен/.test(DB.ask(T('ast-count'), ast, 'ast', {}).msg),
    'волна 1: заявка на реструктуризацию и дело уже отвечают; имущество — волна 2: у Руководства секции нет, специалист на минимальной (ДБ-63, ДБ-53)');
  DB.STAND.wave = 3;
  ok(83, DB.ask(T('lead-ast'), U('u3'), 'prob', {}).state === 'noaccess' && DB.ask(T('cur-rs'), U('u3'), 'prob', {}).state === 'noaccess',
    'имущество и реструктуризация закрыты ролям без права на эти объекты — «нет доступа» (ИДБ-4)');
  // ДБ-65: плитки заёмщика
  // строки закрытых договоров и погасивших клиентов живут всегда — сверяем с действующими
  const L = DB.DATA.loan.filter(l => !l.closed), Bs = DB.DATA.borrower.filter(b => DB.pstateAt(b, 0) === 'действующий');
  const leadOk = Bs.every(b => { const ls = L.filter(l => l.borrower === b.id); if (!ls.length) return false;
    const top = ls.reduce((a, l) => l.balance > a.balance ? l : a); return b.curator === top.curator && b.overCredits === ls.filter(l => l.overdueDays > 0).length; });
  const lb84 = DB.ask(T('lead-borr'), U('u1'), 'lead', {}), bo = Object.assign({ state:lb84.state }, lb84.second);
  ok(84, leadOk && Q2('lead-borr').share.every(i => DB.IND[i].obj === 'borrower') && bo.state === 'ok' && bo.den === Bs.length && Bs.length === 903
    && bo.num === new Set(L.filter(l => l.overdueDays > 0).map(l => l.borrower)).size && bo.num <= DB.DATA.spell.filter(x => x.state === 'тянется').length,
    `Руководство: заёмщиков с просрочкой ${bo.num} из ${bo.den} · ${bo.value.toFixed(1)} % — клиенты, а не договоры; «есть просрочка» согласована с кредитами (ДБ-65)`);
  const cb = DB.ask(T('cur-borod'), U('u2'), 'cur', {}); const mineB = Bs.filter(b => b.curator === 'u2');
  const split = Bs.some(b => b.curator !== 'u2' && L.some(l => l.borrower === b.id && l.curator === 'u2'));
  ok(85, cb.state === 'ok' && cb.den === mineB.length && cb.num === mineB.filter(b => b.overCredits > 0).length && cb.den <= 47 && split,
    `Куратор: заёмщиков с просрочкой ${cb.num} из ${cb.den} — «я» у заёмщика — ведущий куратор; клиент, где Бекова ведёт младший кредит, в эту плитку не входит (ДБ-65)`);
  const np = DB.ask(T('cur-npay'), U('u2'), 'cur', {}); const lay = DB.composeLayout('u2', 'cur');
  ok(86, np.state === 'ok' && np.value === mineB.filter(b => b.npayDays <= 3).length && np.value > 0
    && lay.indexOf('cur-obl') === lay.indexOf('cur-npay') + 1 && lay.indexOf('tasks') === lay.indexOf('cur-obl') + 1 && lay.indexOf('cur-borod') === lay.indexOf('cur-od') + 1
    && DB.composeLayout('u1', 'lead').indexOf('lead-borr') === DB.composeLayout('u1', 'lead').indexOf('lead-od') + 1,
    `Куратор: заёмщиков с платежом в ближайшие 3 дня ${np.value} — один клиент один раз, по ближайшему платежу всего портфеля; плитки стоят на местах канона (ДБ-65)`);
  // ДБ-66: разрезы заёмщика — из реестра статистики, выборка
  const BD = ['bworst', 'bodays', 'subgroup', 'ptype', 'bindustry'];
  const bt = (dims, format) => Object.assign(DB.blankReportDraft(), { obj:'borrower', inds:['borrower.count'], dims, format, filter:[{ f:'pstate', op:'eq', v:'действующий' }] });
  const steps = BD.filter(d => DB.DIMS[d].ordered).map(d => DB.answer(bt([d], 'steps'), U('u1'), 'lead', {}));
  // плитка на отчёте с этим разрезом: Разрез по нему рисуется ступенями
  const onDim = d => { DB.R('r-tmp-' + d, { title:'tmp', obj:'borrower', cols:['borrower.count'], dims:[d], filter:[{ f:'pstate', op:'eq', v:'действующий' }], params:{ date:{ name:'Дата' } } });
    return Object.assign(DB.blankDraft('r-tmp-' + d), { id:'tmp-' + d }); };
  const stepsOk = BD.filter(d => DB.DIMS[d].ordered).every(d => { const v = DB.view(onDim(d), 'slice', null, [], 'u1', 'lead', {}); return v.format === 'steps' && v.sel.dim === d && v.total.v === Bs.length; });
  for (let i = DB.REPORTS.length - 1; i >= 0; i--) if (DB.REPORTS[i].id.startsWith('r-tmp-')) DB.REPORTS.splice(i, 1);
  ok(87, BD.every(d => DB.OBJ_DIMS.borrower.includes(d)) && DB.OBJ_DIMS.borrower.length === 18 && stepsOk
    && steps.every(r => r.state === 'ok') && steps[0].nodes.reduce((a, n) => a + n.value, 0) === Bs.length,
    `у заёмщика 18 разрезов (13 из реестра статистики и 5 заявленных); «Ступени» больше не погашены — худшая категория, худшая просрочка, подгруппа: ${steps.map(r => r.nodes.length).join(' · ')} ступеней (ДБ-66, ДБ-Д21, ДБ-111)`);
  const rank = c => DB.DIMS.category.values.indexOf(c);
  const worstOk = Bs.every(b => { const ls = L.filter(l => l.borrower === b.id);
    return b.worst === ls.reduce((a, l) => rank(l.category) > rank(a) ? l.category : a, ls[0].category) && b.worstDays === Math.max(...ls.map(l => l.overdueDays)); });
  const late = steps[1].nodes.reduce((a, n) => a + n.value, 0);
  ok(88, worstOk && late === new Set(L.filter(l => l.overdueDays > 0).map(l => l.borrower)).size && late === bo.num,
    `худшая категория и худшая просрочка свёрнуты по портфелю: клиент с тремя кредитами — одна строка по худшему; на ступенях просрочки ${late} клиентов — столько же, сколько «Заёмщиков с просрочкой» (ДБ-66)`);
  const heat = DB.answer(bt(['ptype', 'bindustry'], 'heat'), U('u1'), 'lead', {});
  const cells = heat.heat.cells.flat().reduce((a, v) => a + v, 0);
  const cur = DB.answer(bt(['ptype'], 'slice'), U('u2'), 'cur', {});
  ok(89, heat.state === 'ok' && cells === Bs.length && heat.heat.rows.length === 3
    && cur.nodes.reduce((a, n) => a + n.value, 0) === Bs.filter(b => b.dept === 'rp-chu').length && DB.DATA.borrower.length > Bs.length,
    `тип лица × отрасль: ${heat.heat.rows.length}×${heat.heat.cols.length}, в ячейках ${cells} — все заёмщики; у куратора разрез режется охватом подразделения (ДБ-66, ИДБ-12)`);
})();

/* ---------- M. Волна 3: заёмщик — показатели, разрезы, фильтры, форматы ---------- */
(() => {
  DB.seed();
  const ACT = { f:'pstate', op:'eq', v:'действующий' };
  const allB = DB.DATA.borrower, Bs = allB.filter(b => DB.pstateAt(b, 0) === 'действующий');
  const allL = DB.DATA.loan, L = allL.filter(l => !l.closed);
  const draft = o => Object.assign(DB.blankReportDraft(), { format:'number' }, o);   // вопрос собирает конструктор отчётности; формат ответа — внутренний, у черновика его нет
  // ДБ-Д22: шкала категорий — классификатор владельца
  const cat = DB.view('lead-bal', 'slice', { dim:'category' }, [], 'u1', 'lead', {}), catN = DB.at('lead-bal', 'table(category;loan.count)', 'u1', 'lead', {});
  ok(90, DB.DIMS.category.values.join('|') === 'Низкий кредитный риск|Средний кредитный риск|Высокий кредитный риск|Потери|Убыток'
    && DB.DIMS.bworst.values === DB.DIMS.category.values && cat.nodes.map(n => n.short).join(' · ') === 'низкий · средний · высокий · потери · убыток'
    && sum(catN.map(x => x[1])) === L.length && DB.at('lead-bal', 'second', 'u1', 'lead', {}) === L.length && Math.abs(cat.total.v - DB.at('lead-bal', 'main', 'u1', 'lead', {})) < 1,
    `категории — шкала классификатора: ${cat.nodes.map(n => n.short + ' ' + DB.fmtVal(n.value, 'sum')).join(' · ')} (деньги; счёт — в Таблице: ${catN.map(x => x[1]).join(' · ')}) (ДБ-Д22)`);
  // ДБ-68, ДБ-69: «действующие» по умолчанию, печатается, снимается
  const lb = DB.ask(T('lead-borr'), U('u1'), 'lead', {}), ll = { value:DB.ask(T('lead-bal'), U('u1'), 'lead', {}).second.value };
  const bAll = DB.answer(draft({ obj:'borrower', inds:['borrower.count'], filter:[] }), U('u1'), 'lead', {});
  const bPaid = DB.answer(draft({ obj:'borrower', inds:['borrower.count'], filter:[{ f:'pstate', op:'eq', v:'весь портфель погашен' }] }), U('u1'), 'lead', {});
  DB.rSet('obj', 'borrower'); const bd = DB.rdraft; const hintB = DB.reportHints(draft({ obj:'borrower', inds:['borrower.count'], filter:[] }));
  DB.newReportDraft();
  ok(91, lb.value === 903 && bAll.value === allB.length && allB.length > 903 && bPaid.value > 0 && bAll.value === lb.value + bPaid.value + allB.filter(b => DB.pstateAt(b, 0) === 'без договоров').length
    && ll.value === L.length && allL.length > L.length && DB.qualOf(T('lead-borr')) === 'действующие' && DB.qualOf(T('lead-bal')) === 'действующие'
    && bd.filter.length === 1 && bd.filter[0].f === 'pstate' && DB.blankReportDraft().filter[0].f === 'lact' && hintB.some(h => /складывает действующих и погасивших/.test(h)),
    `«Заёмщиков» ${lb.value} — действующие из ${allB.length} строк (погасивших ${bPaid.value}); «Кредитов» ${ll.value} из ${allL.length}; конструктор сам ставит фильтр, без него — подсказка (ДБ-68, ДБ-69)`);
  // ДБ-70, ДБ-80: фильтр числителя — один показатель, клик — строки с обоими фильтрами
  const bo = Object.assign({}, DB.ask(T('lead-borr'), U('u1'), 'lead', {}).second); const who = DB.statRows(T('lead-borr'), U('u1'), 'lead', {}, null, [{ dim:'bover', v:'больше 0' }]);
  ok(92, Q2('lead-borr').inds.length === 1 && Q2('lead-borr').share[0] === Q2('lead-borr').share[1] && Q2('lead-borr').numFilter.length === 1
    && !Object.values(DB.IND).some(i => i.obj === 'borrower' && i.where) && bo.num === Bs.filter(b => b.overCredits > 0).length && bo.den === 903
    && who.refused && who.count === bo.num,
    `«Заёмщиков с просрочкой» ${bo.num} из ${bo.den} — Число объектов · фильтр «действующие» · фильтр числителя «договоров с просрочкой > 0»; своих счётов у заёмщика нет; клик — ${who.count} строк числителя (ДБ-70, ДБ-80)`);
  // ДБ-Д23: фильтр по значению в конструкторе — разрез и число строки
  DB.rSet('obj', 'borrower'); DB.rCond('filter', 'f', 'bodays'); DB.rCond('filter', 'op', 'in'); DB.rCond('filter', 'v', ['91–180', '181+']);
  const c1 = DB.rCondAdd('filter'); const p1 = DB.rcheck(DB.rdraft).preview.value;
  DB.rCondDel('filter', 1); DB.rCond('filter', 'f', 'worstDays'); DB.rCond('filter', 'op', 'gt'); DB.rCond('filter', 'v', '90');
  const c2 = DB.rCondAdd('filter'); const p2 = DB.rcheck(DB.rdraft).preview.value;
  // доля юрлиц среди них: разрез «Тип лица» в отчёте, на плитке — «% от итога группы» по ячейке «юр»
  DB.rDim('ptype', true); DB.rTitle('Клиенты с просрочкой 91+ по типу лица'); const sh = DB.rcheck(DB.rdraft); const shRep = DB.buildReport(DB.rdraft); DB.newReportDraft();
  DB.newDraft(shRep.id); DB.dMain('pct', 'borrower.count', 'ptype', ['юр']); DB.dTitle('Юрлица среди клиентов с просрочкой 91+'); const shT = DB.ask(DB.draft, U('u1'), 'lead', {});
  ok(93, c1 && c2 && p1 === p2 && p1 === Bs.filter(b => b.worstDays > 90).length && DB.condText(c1) === 'Худшая просрочка по портфелю ∈ 91–180, 181+'
    && DB.condText(c2) === 'Худшая просрочка по портфелю, дн. > 90' && sh.ok && DB.autocheck(DB.draft).ok && shRep.dims.join() === 'ptype' && shT.state === 'ok' && shT.den === p2
    && shT.num === Bs.filter(b => b.worstDays > 90 && b.ptype === 'юр').length,
    `конструктор собирает фильтр по значению: «${DB.condText(c1)}» = «${DB.condText(c2)}» = ${p1} клиентов; доля юрлиц среди них — разрез «Тип лица» в отчёте и ячейка «юр» на плитке: ${shT.num} из ${shT.den} (ДБ-Д23, ДБ-111)`);
  // ДБ-71, ДБ-74: движение клиентов — черновик до статистики
  const vm0 = DB.views('lead-borr', 'u1', 'lead').find(x => x.kind === 'move'), m0 = DB.view('lead-borr', 'move', { month:-1 }, [], 'u1', 'lead', {});
  const off = DB.tileAnswers(T('lead-borr')) && DB.composeLayout('u1', 'lead').includes('lead-borr') && DB.ask(T('lead-borr'), U('u1'), 'lead', {}).state === 'ok';
  DB.STAND.clientFlows = true;
  const mv = DB.view('lead-borr', 'move', { month:-1 }, [], 'u1', 'lead', {}).move, vm1 = DB.views('lead-borr', 'u1', 'lead').find(x => x.kind === 'move'), lay = DB.composeLayout('u1', 'lead');
  const at = m => allB.filter(b => b.from <= m && DB.pstateAt(b, m) === 'действующий').length;
  ok(94, !vm0.ok && /даты погашения всего портфеля/.test(vm0.why) && m0.state === 'off' && off && vm1.ok && mv.converges && mv.M === -1
    && mv.start === at(-2) && mv.end === at(-1) && mv.inc.map(x => x.name).join() === 'новые,вернулись' && mv.dec[0].name === 'погасили всё'
    && mv.inc[0].v === allB.filter(b => b.firstM === -1).length && mv.dec[0].v > 0 && lay.includes('lead-borr'),
    `у «Заёмщиков» вид Движение за прошлый месяц погашен, пока статистика не отдаёт потоки (плитка в раскладке отвечает); затем ${mv.start} → +${mv.ti} −${mv.td} прочее ${mv.other} → ${mv.end}, сходится (ДБ-71, ДБ-74, ДБ-53)`);
  DB.STAND.clientFlows = false;
  // ДБ-72, ДБ-73: «Область» — по регистрации, «Программа» не действует
  const osh = DB.ask(T('lead-borr'), U('u1'), 'lead', { region:'Ошская' }), pr = DB.ask(T('lead-borr'), U('u1'), 'lead', { program:'agro' });
  ok(95, osh.value === Bs.filter(b => b.region === 'Ошская').length && /фильтр: Ошская · по регистрации заёмщика/.test(osh.passport)
    && pr.value === 903 && /без фильтра/.test(pr.passport) && !/по регистрации/.test(DB.ask(T('lead-bal'), U('u1'), 'lead', { region:'Ошская' }).passport),
    `панель у заёмщика: «Ошская» режет по территории регистрации — ${osh.value} клиентов с подписью; «Программа» — без фильтра; у кредита подписи нет (ДБ-72, ДБ-73)`);
  // ДБ-74, ДБ-88: ступени худшей просрочки и совокупного долга в «Картине портфеля»
  const bk = DB.view('lead-borr', 'slice', { dim:'bodays' }, [], 'u1', 'lead', {}); const debt = DB.view('lead-borr', 'table', { dim:'bdebt', cols:['borrower.count', 'borrower.total'] }, [], 'u1', 'lead', {});
  const bal = DB.ask(T('lead-bal'), U('u1'), 'lead', {}).value;
  ok(96, sum(bk.nodes.map(n => n.value)) === bo.num && bk.total.v === 903 && debt.table.rows.map(r => r.label).join('|') === 'до 1 млн|1–10 млн|10–50 млн|50+ млн'
    && debt.total[0] === 903 && Math.round(debt.total[1]) === Math.round(bal) && !!DB.DIMS.bdebt.req
    && DB.views('lead-borr', 'u1', 'lead').filter(v => ['slice', 'table'].includes(v.kind)).every(v => v.ok),
    `ступени клиентов в видах «Заёмщиков»: худшая просрочка ${bk.nodes.map(n => n.value).join(' · ')} (= ${bo.num}, итог вида — все ${bk.total.v}); совокупный долг ${debt.table.rows.map(r => r.cells[0]).join(' · ')} — в порядке ступеней, деньги = остаток портфеля (ДБ-74, ДБ-82, ДБ-88)`);
  // ДБ-76: Проблемные кредиты видят заёмщика через свои требования
  const pdP = DB.ask(T('prob-dead'), U('u3'), 'prob', {}), pdL = DB.ask(T('prob-dead'), U('u1'), 'lead', {});
  const viaC = new Set(DB.DATA.claim.filter(c => c.dept === 'opk').map(c => c.loan));
  const seen = new Set(allL.filter(l => viaC.has(l.id)).map(l => l.borrower));
  ok(97, pdP.state === 'ok' && pdP.visible === seen.size && pdP.value > 0 && pdP.value < pdL.value
    && pdL.value === Bs.filter(b => b.pers !== 'действует').length && DB.composeLayout('u3', 'prob').includes('prob-dead'),
    `«Должник умер или ликвидирован»: отдел взыскания видит ${pdP.value} — клиентов своих требований (${pdP.visible}), Руководство — ${pdL.value} (ДБ-74, ДБ-76)`);
  // ДБ-75: подпись куратора
  ok(98, /клиенты, где вы ведущий куратор/.test(DB.qualOf(T('cur-borod'))) && /клиенты, где вы ведущий куратор/.test(DB.qualOf(T('cur-npay')))
    && !/ведущий/.test(DB.qualOf(T('cur-bal'))),
    `плитки куратора на заёмщике печатают «${DB.qualOf(T('cur-borod'))}», на кредите — нет (ДБ-75, ДБ-Д20)`);
  // ДБ-67: деньги заёмщика есть, итог — у кредита, подсказка
  const money = Object.values(DB.IND).filter(i => i.obj === 'borrower' && i.unit === 'sum');
  const byType = DB.answer(draft({ obj:'borrower', inds:['borrower.total'], dims:['ptype'], format:'slice', filter:[ACT] }), U('u1'), 'lead', {});
  const hint = DB.reportHints(draft({ obj:'borrower', inds:['borrower.total'], filter:[ACT] }));
  const layB = Object.values(DB.DECLARED_SEED).flat().filter(k => DB.tileById(k)).some(k => DB.questionOf(DB.tileById(k)).inds.some(i => DB.IND[i].obj === 'borrower' && DB.IND[i].unit === 'sum'));
  ok(99, money.length >= 2 && Math.round(byType.total.v) === Math.round(bal) && hint.some(h => /Итог денег — у объекта «Кредит»/.test(h)) && !layB,
    `у заёмщика деньги портфеля (${money.map(i => i.name).join(', ')}): по типу лица ${byType.nodes.map(n => n.label.split(' ')[0] + ' ' + DB.fmtVal(n.value, 'sum')).join(' · ')}; без разреза — подсказка «итог у кредита» (ДБ-67)`);
  // ДБ-77, ДБ-78: форматы и сдвиг счёта клиентов
  const tb = o => Object.assign(DB.blankDraft('r-borrowers'), o);      // плитка на отчёте «Заёмщики» (действующие — в отчёте)
  const fm = DB.views(tb({ id:'tb100' }), 'u1', 'lead').find(x => x.kind === 'move');
  const sPm = DB.ask(tb({ shift:'prevMonthEnd' }), U('u1'), 'lead', {});
  const sYs = DB.ask(tb({ shift:'yearStart' }), U('u1'), 'lead', {});
  ok(100, !fm.ok && /даты погашения всего портфеля/.test(fm.why) && DB.shiftsFor(tb({})).length === 3 && DB.shiftsFor(tb({})).every(x => x.ok)
    && sPm.shift.base === at(-1) && sYs.shift.base === at(-10) && sPm.shift.base !== sYs.shift.base && sPm.value === 903,
    `сдвиг счёта клиентов — как у остатков, «действующий» на дату базы: к 30.09 ${sPm.shift.base}, к началу года ${sYs.shift.base}, сейчас ${sPm.value} (ДБ-77, ДБ-78)`);
  // ДБ-79: «Работать со списком» — реестр заёмщиков с фильтром плитки
  const reg = DB.registryList(T('prob-dead'), U('u3'), 'prob', {});
  ok(101, reg.registry === 'Реестр заёмщиков' && reg.today === pdP.value && reg.slice === pdP.value,
    `«Работать со списком» у заёмщика — ${reg.registry} с фильтром плитки: ${reg.today} (ДБ-79)`);
  // ДБ-81: 13 разрезов реестра + 4 заявленных
  const D = DB.OBJ_DIMS.borrower; const reqD = D.filter(d => DB.DIMS[d].req);
  ok(102, ['pstate', 'pers', 'bcur', 'bcohort', 'bblack'].every(d => D.includes(d)) && D.length - reqD.length === 13 && reqD.join() === 'bdebt,bcredits,bover,bhist,bcontact'
    && DB.answer(draft({ obj:'borrower', inds:['borrower.count'], dims:['bcohort'], format:'steps', filter:[ACT] }), U('u1'), 'lead', {}).total.v === 903,
    `у заёмщика ${D.length - reqD.length} разрезов из реестра и ${reqD.length} заявленных (⚑): ${reqD.map(d => DB.DIMS[d].name).join(', ')} (ДБ-81…ДБ-84, ДБ-86, ДБ-111)`);
  // ДБ-83, ДБ-84, ДБ-88: повторные клиенты и кредитная история — в каталоге, не в раскладке
  const rp = DB.view('lead-borr', 'slice', { dim:'bcredits' }, [], 'u1', 'lead', {}), hs = DB.view('lead-borr', 'slice', { dim:'bhist' }, [], 'u1', 'lead', {});
  const cat3 = DB.catalogFor(U('u1')).filter(x => ['cat-brep', 'cat-bhist', 'cat-brepsh'].includes(x.t.id));
  ok(103, rp.nodes.map(n => n.label).join() === '1,2,3+' && rp.total.v === 903 && hs.nodes.map(n => n.label).join() === 'без просрочек,1–30,31–90,91+'
    && hs.nodes.reduce((a, n) => a + n.value, 0) === 903 && hs.nodes[3].value >= Bs.filter(b => b.worstDays > 90).length
    && cat3.length === 1 && cat3[0].t.id === 'cat-brepsh' && !Object.values(DB.DECLARED_SEED).flat().includes('cat-brepsh'),
    `разрезы «Заёмщиков» (в каталоге осталась одна плитка клиентов): по числу договоров ${rp.nodes.map(n => n.value).join(' · ')}, кредитная история ${hs.nodes.map(n => n.value).join(' · ')} — 91+ не меньше текущей просрочки 91+ (ДБ-83, ДБ-84, ДБ-88)`);
  // ДБ-86: две проверки карточки — плитки куратора и взыскания, заявка соседу
  const co = DB.ask(T('cur-obl'), U('u2'), 'cur', {}), nc = DB.ask(T('prob-nocon'), U('u3'), 'prob', {});
  ok(104, co.value === Bs.filter(b => b.curator === 'u2' && b.oblExpired > 0).length && co.value > 0 && nc.value > 0
    && DB.reqOf(T('cur-obl')).length === 1 && DB.reqOf(T('prob-nocon')).length === 1 && DB.composeLayout('u3', 'prob').includes('prob-nocon'),
    `проверки карточки в статистике (⚑ заявка): у куратора клиентов с просроченным обязательством Порядка ${co.value}, у взыскания должников без канала связи ${nc.value} (ДБ-86)`);
  // фильтр «действующие» у потока режет закрытые в периоде — подсказка
  ok(105, DB.reportHints(draft({ obj:'loan', inds:['loan.paid'], filter:[{ f:'lact', op:'eq', v:'действующий' }] })).some(h => /отрезает договоры, закрытые в периоде/.test(h)),
    'у потока фильтр «действующие» отрезает договоры, закрытые в периоде, — конструктор предупреждает (вопрос владельцу)');
})();

/* ---------- N. Кредитная программа ---------- */
(() => {
  DB.seed();
  const draft = o => Object.assign(DB.blankReportDraft(), { format:'number' }, o);   // вопрос собирает конструктор отчётности; формат ответа — внутренний, у черновика его нет
  const PI = Object.values(DB.IND).filter(i => i.obj === 'program');
  ok(106, PI.length === 1 && PI[0].agg === 'count' && !Object.values(DB.IND).some(i => /лимит/i.test(i.name)) && DB.OBJ_DIMS.program.length === 9
    && !DB.TILES.some(t => DB.questionOf(t).inds.some(i => DB.IND[i].obj === 'program' && DB.IND[i].unit === 'sum')),
    `у программы один показатель «${PI[0].name}» и ${DB.OBJ_DIMS.program.length} разрезов реестра; денежных мер и лимита нет (ДБ-89, ДБ-90, ДБ-93, ДБ-Д26)`);
  const PT = 'table(program;loan.count,loan.balance,loan.overdue)', prRows = DB.at('lead-bal', PT, 'u1', 'lead', {}), prTot = DB.at('lead-bal', PT + '.total', 'u1', 'lead', {}), ll = { value:DB.ask(T('lead-bal'), U('u1'), 'lead', {}).second.value };
  const bal = DB.ask(T('lead-bal'), U('u1'), 'lead', {}).value, pis = DB.view('lead-issued', 'slice', { dim:'program' }, [], 'u1', 'lead', {}), iss = DB.ask(T('lead-issued'), U('u1'), 'lead', {});
  ok(107, DB.IND[T('lead-bal').views.table.cols[0]].obj === 'loan' && T('lead-bal').views.table.dim === 'program' && prTot[0] === ll.value && Math.round(prTot[1]) === Math.round(bal)
    && prRows.length === 6 && pis.total.v === iss.value && T('lead-issued').views.slice.dim === 'program',
    `Таблица «Остатка» по программам — срез кредита: ${prRows.length} программ, ${prTot[0]} кредитов = второе число, остаток = главное; Разрез «Выдано» по программам ${DB.fmtVal(pis.total.v, 'sum')} = «Выдано с начала года» (ДБ-91, ДБ-98)`);
  const mix = DB.rcheck(draft({ title:'смесь', inds:['loan.balance', 'loan.issued'], format:'table', dims:['program'] }));
  const tmix = DB.autocheck(Object.assign(DB.blankDraft('r-programs'), { title:'смесь', second:{ col:'loan.issued' } }));
  DB.newReportDraft(); DB.rInd('loan.balance', true); DB.rInd('loan.issued', true); const kept = DB.rdraft.inds.slice(); DB.newReportDraft();
  DB.R('r-tmp-mix', { title:'tmp', obj:'loan', cols:['loan.count', 'loan.issued'], filter:[], params:{ date:{ name:'Дата' } } });
  DB.newDraft('r-tmp-mix'); DB.dSecond('col', 'loan.issued'); const keptT = [DB.draft.main.col, DB.draft.second];
  DB.REPORTS.splice(DB.REPORTS.findIndex(r => r.id === 'r-tmp-mix'), 1); DB.newDraft('r-programs');
  ok(108, !mix.ok && mix.checks.some(c => !c.ok && /одного рода/.test(c.text)) && kept.join() === 'loan.count,loan.balance'
    && !tmix.ok && tmix.checks.some(c => !c.ok && /одного рода/.test(c.text)) && keptT[0] === 'loan.count' && keptT[1] === null,
    'остаток и поток в одной плитке не собрать: автопроверка «показатели одного рода» у отчёта и у плитки, конструктор отчётности и сборка плитки не дают отметить (ДБ-92, ДБ-109)');
  const pa = DB.ask(T('cat-progn'), U('u1'), 'lead', {}), all = DB.answer(draft({ obj:'program', inds:['program.count'], filter:[] }), U('u1'), 'lead', {});
  DB.rSet('obj', 'program'); const pd = DB.rdraft; const hp = DB.reportHints(pd); DB.newReportDraft();
  ok(109, pa.value === 6 && all.value === 8 && DB.qualOf(T('cat-progn')) === 'действующие' && pd.filter[0].f === 'pgstate'
    && hp.some(h => /Денег у программы нет/.test(h)) && DB.reportHints(draft({ obj:'program', inds:['program.count'], filter:[] })).some(h => /действующие и закрытые программы/.test(h)),
    `«Программ действует» ${pa.value} из ${all.value} строк; конструктор ставит «действующие» и подсказывает, что деньги — у кредита (ДБ-94, ДБ-89)`);
  const pf = DB.ask(T('cat-progn'), U('u1'), 'lead', { program:'agro' }), rf = DB.ask(T('cat-progn'), U('u1'), 'lead', { region:'Ошская' });
  const tcols = ['loan.count', 'loan.balance', 'loan.overdue'], tf = DB.view('lead-bal', 'table', { dim:'program', cols:tcols }, [], 'u1', 'lead', { program:'agro' });
  const ta = DB.at('lead-bal', 'table(program;loan.count,loan.balance,loan.overdue)', 'u1', 'lead', {}).find(x => x[0] === 'agro');
  ok(110, pf.value === 1 && /фильтр: Агрокредит/.test(pf.passport) && rf.value === 6 && /без фильтра/.test(rf.passport)
    && tf.sel.dim !== 'program' && tf.table.d !== 'program' && tf.total.join() === ta[1].join(),
    `панель «Программа» режет объект программы по самой программе (${pf.value}), «Область» — без фильтра; таблица с программой из панели — по свободному разрезу «${DB.DIMS[tf.table.d].name}», итог = строке «Агрокредит» (ДБ-95, ДБ-126, ДБ-Д27)`);
  const sp = DB.ask(T('spec-pend'), U('u6'), 'spec', {});
  ok(111, sp.value === DB.DATA.program.filter(p => p.state === 'действует' && p.pendDays !== null && p.pendDays <= 90).length && sp.value === 1 && sp.tl === 'yellow'
    && DB.reqOf(T('spec-pend')).length === 1 && DB.composeLayout('u6', 'spec').includes('spec-pend'),
    `«Программы, истекающие в ближайшие 90 дней» у специалиста: ${sp.value}, жёлтый; дата окончания — заявка статистике ⚑ (ДБ-96, ДБ-98)`);
  const bs = DB.view('lead-bal', 'slice', { dim:'lpsource' }, [], 'u1', 'lead', {});
  ok(112, Math.round(bs.nodes.reduce((a, n) => a + n.value, 0)) === Math.round(bal) && bs.nodes.length === 3 && !!DB.DIMS.lpsource.req
    && DB.OBJ_DIMS.loan.includes('lpsource') && DB.OBJ_DIMS.loan.includes('lpline'),
    `Разрез «Остатка» по источникам финансирования — разрез кредита через ключ программы: ${bs.nodes.map(n => n.label + ' ' + DB.fmtVal(n.value, 'sum')).join(' · ')} ⚑ (ДБ-97)`);
})();

/* ---------- O. Плитка — ссылка на отчёт ---------- */
(() => {
  DB.seed();
  const ll = T('lead-bal'), cl = T('cur-bal'), rep = DB.reportById(ll.report);
  const own = t => ['inds', 'dims', 'filter', 'numFilter', 'share', 'period', 'date'].some(k => k in t);
  const ACT_L = { f:'lact', op:'eq', v:'действующий' }, ACT_B = { f:'pstate', op:'eq', v:'действующий' }, ME = { f:'curator', op:'eq', v:'@me' };
  // прежний вопрос плитки — литералом, тем же движком
  const old = (filter, u, role) => DB.answer({ id:'old', format:'number', inds:['loan.count'], dims:[], filter }, U(u), role, {});
  const a1 = DB.ask(ll, U('u1'), 'lead', {}), a2 = DB.ask(cl, U('u2'), 'cur', {}), o1 = old([ACT_L], 'u1', 'lead'), o2 = old([ME, ACT_L], 'u2', 'cur');
  const same = (a, o) => a.state === 'ok' && a.second.value === o.value && a.visible === o.visible;
  ok(113, !own(ll) && !own(cl) && rep && cl.report === ll.report && DB.REPORTS.includes(rep) && rep.cols.includes('loan.count') && ll.second.col === 'loan.count' && cl.second.col === 'loan.count'
    && ll.params.curator === '*' && cl.params.curator === '@me' && Q('cur-bal').filter[1] !== rep.filter[0]
    && JSON.stringify(Q('lead-bal').filter) === JSON.stringify([ACT_L]) && JSON.stringify(Q('cur-bal').filter) === JSON.stringify([ME, ACT_L])
    && same(a1, o1) && same(a2, o2) && a1.tileId === 'lead-bal' && a2.tileId === 'cur-bal' && a2.second.value === 47 && a1.second.value > a2.second.value,
    `«Остаток» Руководства и Куратора — один отчёт «${rep && rep.title}», куратор = все / я; своего вопроса у плиток нет, число кредитов во втором числе прежнее: ${a1.second.value} и ${a2.second.value} (ДБ-99, ДБ-100)`);
  const k2 = DB.scopeKey(cl, U('u2'), 'cur');
  ok(114, k2.startsWith('user:') && DB.scopeKey(ll, U('u1'), 'lead').startsWith('roles:'),
    `«я» в значении параметра остаётся относительным: ключ кэша «Остатка» куратора личный (${k2}), у Руководства — по охвату ролей (ДБ-101, ДБ-113)`);
  // ДБ-111: доля с фильтром числителя — ячейка разреза «договоров с просрочкой» в «% от итога группы»
  const bd = DB.OBJ_DIMS.borrower.find(d => DB.DIMS[d].name === 'Договоров с просрочкой'), D = bd && DB.DIMS[bd];
  const bo = Object.assign({}, DB.ask(T('lead-borr'), U('u1'), 'lead', {}).second);
  const sp = DB.answer({ id:'split', format:'steps', inds:['borrower.count'], dims:[bd], filter:[ACT_B] }, U('u1'), 'lead', {});
  const cell = v => (sp.nodes.find(n => n.v === v) || {}).value;
  DB.R('r-tmp-borr', { title:'Заёмщики по просрочке', obj:'borrower', cols:['borrower.count'], dims:[bd], filter:[ACT_B] });
  const pct = DB.ask({ id:'pct', report:'r-tmp-borr', params:{}, main:{ pct:{ dim:bd, cells:['больше 0'] } } }, U('u1'), 'lead', {});
  DB.seed();
  ok(115, D && D.ordered && !D.at && D.req && D.values.join() === '0,больше 0' && sp.nodes.map(n => n.v).join() === '0,больше 0'
    && cell('больше 0') === bo.num && cell('0') + cell('больше 0') === bo.den && pct.num === bo.num && pct.den === bo.den && pct.value === bo.value
    && !DB.reportById('r-tmp-borr'),
    `разрез заёмщика «Договоров с просрочкой» (⚑ заявка статистике): 0 — ${cell('0')}, больше 0 — ${cell('больше 0')}; доля ячейки «больше 0» = прежний фильтр числителя «Заёмщиков с просрочкой» ${bo.num} из ${bo.den} (ДБ-111)`);
  // Руководство целиком на отчётах: у плитки ссылка, значения параметров и выбор — своего вопроса нет
  const leads = DB.TILES.filter(t => t.id.startsWith('lead-'));
  const noOwn = leads.every(t => t.report && DB.reportById(t.report) && !own(t) && Q(t.id) && Q(t.id).inds.every(i => DB.reportById(t.report).cols.includes(i))
    && (!t.second || Q2(t.id).inds.every(i => DB.reportById(t.report).cols.includes(i))));
  const repIds = [...new Set(leads.map(t => t.report))];
  ok(116, leads.length === 13 && noOwn && repIds.every(id => DB.reportById(id)) && repIds.length === 8,
    `все ${leads.length} плиток Руководства ссылаются на отчёты (${repIds.length} шт.); ни у одной нет своих показателей, разрезов, фильтра, доли, даты и периода; все отчёты есть в каталоге (ДБ-99, ДБ-100)`);
  // «Заёмщиков с просрочкой» — ячейка «больше 0» разреза, «% от итога группы»; значение, числитель и знаменатель прежние
  const qb = Q2('lead-borr'), bo2 = Object.assign({ state:DB.ask(T('lead-borr'), U('u1'), 'lead', {}).state }, DB.ask(T('lead-borr'), U('u1'), 'lead', {}).second);
  const ob = DB.answer({ id:'old-borod', format:'number', inds:['borrower.count'], share:['borrower.count', 'borrower.count'], filter:[ACT_B], numFilter:[{ f:'overCredits', op:'gt', v:0 }] }, U('u1'), 'lead', {});
  ok(117, qb.share.join() === 'borrower.count,borrower.count' && JSON.stringify(qb.numFilter) === JSON.stringify([{ f:'bover', op:'in', v:['больше 0'] }])
    && JSON.stringify(qb.filter) === JSON.stringify([ACT_B]) && qb.dims.length === 0 && T('lead-borr').second.pct.dim === 'bover' && T('cur-borod').main.pct.dim === 'bover'
    && bo2.state === 'ok' && bo2.value === ob.value && bo2.num === ob.num && bo2.den === ob.den && bo2.num > 0 && !!DB.DIMS.bover.req && DB.reqOf(T('cur-borod')).length === 1,
    `«Заёмщиков с просрочкой» (второе число «Заёмщиков» и главное у Куратора) — «% от итога группы» по ячейке «больше 0»: ${bo2.num} из ${bo2.den} = прежнему фильтру числителя «договоров с просрочкой > 0»; новый разрез — заявка статистике ⚑ (ДБ-111)`);
  // один отчёт кормит несколько плиток Руководства: колонки у плитки — выбор, а не свой вопрос
  const feed = {}; leads.forEach(t => { (feed[t.report] = feed[t.report] || []).push(t.id); });
  const port = feed['r-portfolio'] || [], prep = DB.reportById('r-portfolio');
  ok(118, Object.values(feed).some(a => a.length >= 2) && port.length === 3 && ['lead-bal', 'lead-od', 'lead-risk'].every(id => port.includes(id))
    && prep.title === 'Портфель кредитов' && prep.cols.join() === 'loan.balance,loan.count,loan.overdue,loan.risk,loan.restr,loan.coll,loan.noClaim181'
    && prep.dims.join() === 'bucket,category,program,region,lpsource' && port.every(id => Q(id).filter.length === 1 && Q(id).filter[0].f === 'lact' && Q(id).dims.length === 0)
    && new Set(port.map(id => Q(id).inds.join())).size === 3,
    `отчёт «${prep.title}» кормит ${port.length} плитки Руководства (${port.join(', ')}) — остаток, просрочено, риск; доля и ряд — второе число и Ряд «Просрочено»; отчёт — действующие кредиты со счётом и пятью разрезами; всего отчётов ${repIds.length} на ${leads.length} плиток (ДБ-114, ДБ-126)`);
  // один отчёт — две роли, разные значения параметра: «Просрочка по сроку неплатежа» у Руководства (куратор — все) и у Куратора (куратор — я)
  const OD0 = { f:'overdueDays', op:'gt', v:0 };
  const oldBk = (filter, u, role) => DB.answer({ id:'old-bucket', format:'steps', inds:['loan.count'], dims:['bucket'], filter }, U(u), role, {});
  const BK = 'table(bucket;loan.count)', bl = DB.at('lead-od', BK, 'u1', 'lead', {}), bc = DB.at('cur-od', BK, 'u2', 'cur', {}), ol = oldBk([OD0], 'u1', 'lead'), oc = oldBk([ME, OD0], 'u2', 'cur');
  const sameBk = (a, o) => Array.isArray(a) && o.state === 'ok' && JSON.stringify(a) === JSON.stringify(o.nodes.map(n => [n.v, n.value]));
  const sumN = a => a.reduce((x, n) => x + n[1], 0);
  ok(119, T('lead-od').report === 'r-portfolio' && T('cur-od').report === 'r-portfolio' && !own(T('lead-od')) && !own(T('cur-od'))
    && T('lead-od').params.curator === '*' && T('cur-od').params.curator === '@me'
    && JSON.stringify(Q('lead-od').filter) === JSON.stringify([ACT_L]) && JSON.stringify(Q('cur-od').filter) === JSON.stringify([ME, ACT_L])
    && sameBk(bl, ol) && sameBk(bc, oc) && sumN(bc) > 0 && sumN(bc) < sumN(bl),
    `отчёт «${DB.reportById('r-portfolio').title}» кормит «Просрочено» Руководства (куратор — все: ${sumN(bl)} просроченных кредитов по срокам) и Куратора (куратор — я, «я» первым условием: ${sumN(bc)}); счёт по срокам в Таблице совпадает с прежним литеральным вопросом (ДБ-100)`);
  // относительное значение — значение параметра отчёта: «сегодня + 3 дня» остаётся относительным
  const npT = T('cur-npay'), npR = DB.reportById(npT.report), npc = Q('cur-npay').filter.find(c => c.f === 'npayDays');
  const anp = DB.ask(npT, U('u2'), 'cur', {}), onp = DB.answer({ id:'old-npay', format:'number', inds:['borrower.count'], filter:[ME, ACT_B, { f:'npayDays', op:'le', v:'@today+3' }] }, U('u2'), 'cur', {});
  const allNp = DB.ask(withParams(npT, { npay:'*' }), U('u2'), 'cur', {});
  ok(120, npR.params.npay && npR.params.npay.dim === 'npayDays' && npR.params.npay.op === 'le' && npT.params.npay === '@today+3' && !own(npT)
    && npc && npc.op === 'le' && npc.v === '@today+3' && !Q('lead-borr').filter.some(c => c.f === 'npayDays') && !Q('cur-bal').filter.some(c => c.f === 'npayDays')
    && anp.state === 'ok' && anp.value === onp.value && anp.passport === onp.passport && anp.value > 0 && allNp.value > anp.value
    && DB.scopeKey(npT, U('u2'), 'cur').startsWith('user:') && /клиенты, где вы ведущий куратор · действующие/.test(DB.qualOf(npT)),
    `«Заёмщиков с платежом в ближайшие 3 дня»: отчёт «${npR.title}» объявляет параметр «${npR.params.npay.name}», плитка даёт значение ${npT.params.npay}; число прежнее ${anp.value}, без параметра — ${allNp.value} (ДБ-101)`);
  // «Доля повторных клиентов» — «% от итога группы» по ячейкам 2 и 3+ разреза «Договоров у клиента за всё время»; тот же отчёт, что у «Клиенты по числу договоров»
  const bsT = T('cat-brepsh'), brT = T('lead-borr'), qs = Q('cat-brepsh');
  const ars = DB.ask(bsT, U('u1'), 'lead', {}), brn = DB.view('lead-borr', 'slice', { dim:'bcredits' }, [], 'u1', 'lead', {});
  const ors = DB.answer({ id:'old-brepsh', format:'shift', shift:'yearStart', inds:['borrower.count'], share:['borrower.count', 'borrower.count'], filter:[ACT_B], numFilter:[{ f:'credits', op:'ge', v:2 }] }, U('u1'), 'lead', {});
  const rc = v => (brn.nodes.find(n => n.v === v) || {}).value;
  ok(121, bsT.report === brT.report && bsT.report === 'r-borrowers' && bsT.main.pct.dim === 'bcredits' && bsT.main.pct.cells.join() === '2,3+' && !own(bsT) && !own(brT)
    && qs.share.join() === 'borrower.count,borrower.count' && JSON.stringify(qs.numFilter) === JSON.stringify([{ f:'bcredits', op:'in', v:['2', '3+'] }])
    && qs.dims.length === 0 && JSON.stringify(qs.filter) === JSON.stringify([ACT_B]) && bsT.shift === 'yearStart'
    && ars.state === 'ok' && ars.value === ors.value && ars.num === ors.num && ars.den === ors.den && JSON.stringify(ars.shift) === JSON.stringify(ors.shift) && ars.num > 0
    && rc('2') + rc('3+') === ars.num && rc('1') + rc('2') + rc('3+') === ars.den,
    `«Доля повторных клиентов» — ячейки 2 и 3+ из ${ars.den} клиентов: ${ars.num}, сдвиг с начала года прежний; отчёт «${DB.reportById(bsT.report).title}» общий с Разрезом «Заёмщиков» по числу договоров (ДБ-111, ДБ-114)`);
  // личная плитка Бековой — на личном отчёте её полки; Куратор и каталог целиком на отчётах
  const pa = T('p-u2-agro'), pr = DB.reportById(pa.report);
  const aa = DB.ask(pa, U('u2'), 'cur', {}), oa = DB.answer({ id:'old-agro', format:'number', inds:['loan.count'], filter:[ME, { f:'program', op:'eq', v:'agro' }, { f:'overdueDays', op:'gt', v:30 }] }, U('u2'), 'cur', {});
  const cc = DB.TILES.filter(t => /^(cur|cat)-/.test(t.id));
  const noOwnC = cc.every(t => t.report && DB.reportById(t.report) && !own(t) && Q(t.id) && Q(t.id).inds.every(i => DB.reportById(t.report).cols.includes(i))
    && (!t.second || Q2(t.id).inds.every(i => DB.reportById(t.report).cols.includes(i))));
  const hold = pr && pr.title;
  pr && (pr.title = 'временно'); DB.seed();
  const pa2 = T('p-u2-agro');
  ok(122, pr && pr.shelf === 'personal' && pr.owner === 'u2' && pr.circle.owner === 'u2' && pa.owner === 'u2' && pa.state === 'personal' && !own(pa) && pa.params.curator === '@me'
    && aa.state === 'ok' && aa.value === oa.value && aa.value > 0 && aa.passport === oa.passport
    && cc.length === 17 && noOwnC && DB.REPORTS.filter(r => r.shelf === 'personal').length === 1
    && DB.reportById('r-u2-agro').title === hold && pa2.report === 'r-u2-agro' && pa2.state === 'personal' && DB.composeLayout('u2', 'cur').includes('p-u2-agro'),
    `«${pa.title}» ссылается на личный отчёт «${hold}» на полке Бековой (круг — она одна), значение «я» даёт плитка: ${aa.value} = прежнему вопросу; все ${cc.length} плиток Куратора и каталога на отчётах (${new Set(cc.map(t => t.report)).size} шт.), своего вопроса нет; отчёт переживает сброс стенда (ДБ-99, ДБ-103)`);
  // ни у одной плитки каталога нет своего вопроса: обзорная ссылается на отчёт, ссылочная — на очередь модуля-владельца
  DB.seed();
  const ov = DB.TILES.filter(t => t.kind !== 'link'), lk = DB.TILES.filter(t => t.kind === 'link'), qd = t => DB.queueById(t.queue);
  ok(123, DB.TILES.every(t => !own(t)) && ov.every(t => DB.reportById(t.report) && !t.queue && Q(t.id).inds.every(i => DB.reportById(t.report).cols.includes(i)))
    && lk.every(t => !t.report && qd(t) && qd(t).inds.length > 0 && Q(t.id).inds.join() === t.main.col && qd(t).inds.includes(t.main.col) && (!t.second || qd(t).inds.includes(t.second.col)) && Q(t.id).queue.module === qd(t).module && Q(t.id).queue.name === qd(t).name)
    && new Set(DB.QUEUES.map(x => x.id)).size === DB.QUEUES.length && lk.length === 19 && DB.QUEUES.length === 19 && ov.length + lk.length === DB.TILES.length,
    `у всех ${DB.TILES.length} плиток каталога своего вопроса нет: ${ov.length} обзорных ссылаются на отчёты (${new Set(ov.map(t => t.report)).size} шт.), ${lk.length} ссылочных — на очереди модулей-владельцев (${DB.QUEUES.length} объявлений) (ДБ-99, ДБ-108)`);
  // «Срок истекает ≤ 7 дн.»: относительное условие срока — в объявлении очереди модуля «Комиссия», у плитки его нет
  const sT = T('com-soon'), sD = qd(sT), sF = Q('com-soon').filter.find(c => c.f === 'deadlineIn');
  const as = DB.ask(sT, U('u7'), 'com', {}), os = DB.answer({ id:'old-soon', format:'number', inds:['comm.soon'], filter:[{ f:'deadlineIn', op:'le', v:'@today+7' }] }, U('u7'), 'com', {});
  const rT = T('spec-ready'), ar = DB.ask(rT, U('u6'), 'spec', {}), or = DB.answer({ id:'old-ready', format:'number', inds:['app.ready'], filter:[{ f:'specialist', op:'eq', v:'@me' }] }, U('u6'), 'spec', {});
  ok(124, sT.kind === 'link' && !own(sT) && sD.module === 'Комиссия' && sD.name === 'Срок истекает' && sD.filter.length === 1 && sD.filter[0].f === 'deadlineIn'
    && sF && sF.op === 'le' && sF.v === '@today+7' && Q('com-soon').filter[0] !== sD.filter[0] && Q('com-soon').queue.module === sD.module && Q('com-soon').queue.name === sD.name
    && as.state === os.state && as.value === os.value && as.passport === os.passport && as.value > 0 && DB.scopeKey(sT, U('u7'), 'com').startsWith('user:')
    && !own(rT) && qd(rT).filter.length === 1 && qd(rT).filter[0].v === '@me' && ar.value === or.value && ar.value > 0,
    `ссылочная плитка берёт вопрос у очереди «${sD.name}» модуля «${sD.module}»: срок ≤ @today+7 — в объявлении, у плитки условий нет; число прежнее ${as.value}; «Готовы к отправке» — «мои» тоже в очереди: ${ar.value} (ДБ-108)`);
  // обязательства — обычные обзорные плитки на отчёте «Обязательства по сдаче»; «срок ≤ 7 дн.» — значение параметра отчёта
  const ou = U('u10'), obl = ['rep-od', 'rep-soon', 'rep-chg'].map(id => T(id)), orp = DB.reportById('r-oblig');
  const lit = (inds, filter) => DB.answer({ id:'old-obl', format:'number', inds, filter }, ou, 'rep', {});
  const oo = [lit(['oblig.overdue'], []), lit(['oblig.soon'], [{ f:'dueIn', op:'le', v:'@today+7' }]), lit(['oblig.changed'], [])];
  const no = obl.map(t => DB.ask(t, ou, 'rep', {})), rg = DB.registryList(obl[0], ou, 'rep', {}), wh = DB.statRows(obl[0], ou, 'rep', {});
  ok(125, obl.every(t => t.kind === 'overview' && !t.queue && !own(t) && t.report === 'r-oblig') && orp.title === 'Обязательства по сдаче' && orp.obj === 'oblig'
    && orp.cols.join() === 'oblig.overdue,oblig.soon,oblig.changed' && orp.params.due.dim === 'dueIn' && orp.params.due.op === 'le' && !Object.values(orp.params).some(p => p.dim === 'dept')
    && obl[1].params.due === '@today+7' && !(obl[0].params || {}).due && Q('rep-soon').filter.length === 1 && Q('rep-soon').filter[0].v === '@today+7' && Q('rep-od').filter.length === 0 && Q('rep-chg').filter.length === 0
    && no.every((a, i) => a.state === oo[i].state && a.value === oo[i].value && a.passport === oo[i].passport) && no.some(a => a.value > 0)
    && rg.registry === 'Реестр обязательств' && rg.owner === 'Отчётность' && !wh.refused && wh.list.length === no[0].value
    && DB.reportById(T('rep-sum').report).obj === 'oblig' && !own(T('rep-sum')) && T('rep-sum').kind === 'overview' && T('rep-sum').second.share.join() === 'oblig.onTime,oblig.submitted' && T('rep-sum').views.series.of === 'second'
    && !DB.tileById('rep-ser'),
    `«Просрочено обязательств», «Срок сдачи ≤ 7 дн.», «Сданные, где числа изменились» — обзорные на отчёте «${orp.title}», срок — параметр «${orp.params.due.name}» = ${obl[1].params.due}; числа прежние ${no.map(a => a.value).join(' / ')}; список — «${rg.registry}» модуля «${rg.owner}» (ДБ-108, ДБ-101)`);
  // отчёт со специалистом: параметр «Кредитный специалист», плитка Специалиста даёт «я», плитка Головного офиса на том же отчёте — без значения
  const SPEC = { f:'specialist', op:'eq', v:'@me' }, sp6 = U('u6'), spr = DB.reportById('r-apps');
  const sw = ['spec-work', 'spec-stage', 'spec-filed'].map(id => T(id));
  const aw = DB.ask(T('spec-work'), sp6, 'spec', {}), ow = DB.answer({ id:'old-sw', format:'number', inds:['app.inWork'], filter:[SPEC] }, sp6, 'spec', {});
  const ag = DB.ask(withParams(T('spec-work'), { specialist:'*' }), sp6, 'spec', {});
  const at = { state:DB.ask(T('spec-stage'), sp6, 'spec', {}).state, nodes:DB.at('spec-stage', 'slice(astage)', 'u6', 'spec', {}), total:DB.at('spec-stage', 'slice(astage).total', 'u6', 'spec', {}) }, ot = DB.answer({ id:'old-ss', format:'steps', inds:['app.inWork'], dims:['astage'], filter:[SPEC, { f:'status', op:'eq', v:'Новый' }] }, sp6, 'spec', {});
  ok(126, sw.every(t => t.kind === 'overview' && !own(t) && t.params.specialist === '@me' && DB.reportById(t.report).params.specialist.dim === 'specialist')
    && spr.params.specialist.name === 'Кредитный специалист' && T('spec-work').report === 'r-apps' && T('gof-compl').report === 'r-apps' && !Object.keys(T('gof-compl').params).length
    && !Q('gof-compl').filter.some(c => c.f === 'specialist') && JSON.stringify(Q('spec-work').filter) === JSON.stringify([SPEC]) && JSON.stringify(Q('spec-stage').filter.map(c => c.f)) === '["specialist","status"]'
    && aw.state === 'ok' && aw.value === ow.value && aw.passport === ow.passport && aw.value > 0 && ag.value > aw.value
    && at.state === 'ok' && JSON.stringify(at.nodes) === JSON.stringify(ot.nodes.map(n => [n.v, n.value])) && at.total === ot.total.v && DB.scopeKey(T('spec-work'), sp6, 'spec').startsWith('user:'),
    `отчёт «${spr.title}»: плитка Специалиста даёт «я» (${aw.value} заявок в работе = прежнему вопросу), без значения — все ${ag.value}; плитка Головного офиса на нём же — без условия по специалисту; ступени «Новые заявки по стадии» прежние (ДБ-100)`);
})();

/* ---------- O (продолжение). Сигналы отчётности по порогам светофора ---------- */
(() => {
  DB.seed(); asUser('u1');
  const t = T('lead-od'), u1 = U('u1'), val = up => { DB.STAND.overdueUp = up; return DB.ask(t, u1, 'lead', {}).second.value; };
  const v0 = val(false), v1 = val(true); DB.STAND.overdueUp = false;
  const sg = DB.signalToggle('lead-od', 'lead'), msg = `${t.title} > 5 % — ${DB.fmtVal(v1, 'pct')} (было ${DB.fmtVal(v0, 'pct')})`;
  const calm = DB.nightCheck();
  DB.STAND.overdueUp = true; const f1 = DB.nightCheck(), f2 = DB.nightCheck();
  ok(127, v0 > 4 && v0 < 5 && v1 > 5 && calm.length === 0 && f1.length === 1 && f1[0].signal === sg[0].id && f1[0].to === 'u1' && f1[0].text === msg && /было/.test(f1[0].text)
    && f2.length === 0 && DB.state.notifs.length === 1 && DB.state.notifs[0] === f1[0],
    `переход: доля ${DB.fmtVal(v0, 'pct')} → ${DB.fmtVal(v1, 'pct')}, порог > 4 % уже был взят при постановке, > 5 % пересечён — одно сообщение «${f1[0] && f1[0].text}»; без перехода и при повторной проверке тихо (ДБ-106)`);
  DB.STAND.overdueUp = false; const g1 = DB.nightCheck(), nG = DB.state.notifs.length; DB.STAND.overdueUp = true; const g2 = DB.nightCheck(), g3 = DB.nightCheck();
  ok(128, g1.length === 0 && nG === 1 && g2.length === 1 && g2[0].signal === sg[0].id && g3.length === 0 && DB.state.notifs.length === 2,
    'возврат в зелёную зону не уведомляет; новый переход через порог снова даёт ровно одно сообщение (ДБ-106)');
  DB.STAND.overdueUp = false; DB.nightCheck(); DB.STAND.overdueUp = true; DB.STAND.nightRunFailed = true;
  const sk = DB.nightCheck(), pend = DB.state.signals[0].state, nN = DB.state.notifs.length; DB.STAND.nightRunFailed = false;
  const late = DB.nightCheck(), nb = DB.signalToggle('lead-bal', 'lead'), nr = DB.signalToggle('spec-ready', 'spec');
  ok(129, sk.skipped && /ночной снимок не прошёл/.test(sk.skipped) && pend === false && nN === 2 && late.length === 1 && DB.state.notifs.length === 3
    && nb.error && /нет порогов/.test(nb.error) && nr.error && DB.state.signals.length === 2,
    'ночной снимок не прошёл — сигналы не проверялись, переход не потерян (сработал на следующей проверке); у плитки без порогов (или с одним «зелёным») 🔔 отказывает (ДБ-106)');
  DB.STAND.overdueUp = false;
})();

/* ---------- O (продолжение). Сборка плитки на отчёте ---------- */
(() => {
  DB.seed(); asUser('u1');
  const own = t => ['inds', 'dims', 'filter', 'numFilter', 'share', 'period', 'date', 'obj'].some(k => k in t);
  const bad = (a, re) => !a.ok && a.checks.some(c => !c.ok && re.test(c.text));
  const asT = (d, id) => Object.assign({ id }, d);       // черновик как плитка для видов
  // черновик на отчёте: главное — первая колонка, второго нет, умолчания видов — первые разрезы отчёта
  const d0 = DB.newDraft('r-bucket'), lt = DB.at('lead-od', 'table(bucket;loan.count)', 'u1', 'lead', {});
  const v0 = DB.view(asT(d0, 'd0'), 'slice', null, [], 'u1', 'lead', {}), vs0 = DB.views(asT(d0, 'd0'), 'u1', 'lead');
  const dh = DB.newDraft('r-odmap'), ah = DB.view(asT(dh, 'dh'), 'map', null, [], 'u1', 'lead', {}), th = DB.at('lead-od', 'map(region,bucket)', 'u1', 'lead', {});
  ok(130, !own(d0) && Object.keys(d0).join() === 'report,params,main,second,shift,tl,views,title' && d0.report === 'r-bucket' && d0.main.col === 'loan.count'
    && d0.second === null && d0.shift === null && d0.tl === null && d0.params.curator === '*' && d0.params.date === 'today'
    && d0.views.slice.dim === 'bucket' && d0.views.table.dim === 'bucket' && d0.views.table.cols.join() === 'loan.count' && !d0.views.map && d0.views.series.points === 12
    && v0.format === 'steps' && JSON.stringify(v0.nodes.map(n => [n.v, n.value])) === JSON.stringify(lt) && vs0.every(v => v.ok || v.kind === 'move')
    && dh.views.map.dims.join() === 'region,bucket' && !own(dh) && ah.state === 'ok' && JSON.stringify(ah.heat.cells) === JSON.stringify(th),
    `черновик плитки на отчёте «${DB.reportById('r-bucket').title}» — ссылка, значения параметров, главное «Кредитов», второго нет; умолчания видов — разрезы отчёта: Разрез по срокам ступенями = Таблица «Просрочено»; «${DB.reportById('r-odmap').title}» — Карта «область × срок» = Карта «Просрочено» (ДБ-127, ДБ-100)`);
  // официальный отчёт без параметра даты: дата зашита в отчёт, сдвиг и ряд погашены
  const rf = DB.reportById('r-form'), df = DB.newDraft('r-form'), shf = DB.shiftsFor(df), vf = DB.views(asT(df, 'df'), 'u1', 'lead');
  const fr = vf.find(v => v.kind === 'series'); DB.dParam('date', 'closedDay');
  const af = DB.ask(DB.draft, U('u1'), 'lead', {}), of = DB.answer({ id:'old-form', format:'number', inds:['loan.balance'], filter:[], date:'prevMonthEnd' }, U('u1'), 'lead', {});
  const forced = DB.answer(DB.questionOf(withParams(DB.draft, { date:'today' })), U('u1'), 'lead', {});   // вопрос даты не перекраивает; плитка с таким значением сломана — см. #150
  const acf = DB.autocheck(Object.assign({}, DB.draft, { title:'Форма', shift:'yearStart' })), acg = DB.autocheck(Object.assign({}, DB.draft, { title:'Форма' }));
  ok(131, rf.shelf === 'official' && Object.keys(rf.params).length === 0 && rf.asOf === 'prevMonthEnd' && Object.keys(df.params).length === 0
    && !fr.ok && /не объявил дату/.test(fr.why) && shf.length === 1 && !shf[0].ok && /не объявил дату/.test(shf[0].why)
    && Object.keys(DB.draft.params).length === 0 && bad(acf, /не объявил дату/) && acg.ok && !af.shift.base && /не объявил дату/.test(af.shift.none)
    && af.state === 'ok' && af.value === of.value && af.passport === of.passport && /^на 30\.09/.test(af.passport) && forced.value === af.value && forced.passport === af.passport,
    `официальный «${rf.title}» без параметра даты: сдвиг и Ряд погашены («${fr.why}»), заданная база сдвига не проходит, дату плитка не задаёт и не перекраивает; плитка показывает дату отчёта — ${af.passport} (ДБ-107, ДБ-119)`);
  // автопроверка пригодности
  const on = (rid, o) => DB.autocheck(Object.assign(DB.blankDraft(rid), { title:'x' }, o));
  const c5 = on('r-portfolio', { views:{ table:{ dim:'bucket', cols:['loan.balance', 'loan.count', 'loan.overdue', 'loan.risk', 'loan.restr'] } } });
  const cm = on('r-portfolio', { second:{ col:'loan.issued' } }), ctm = on('r-portfolio', { views:{ table:{ dim:'bucket', cols:['loan.balance', 'loan.issued'] } } });
  const cf = on('r-bucket', { views:{ map:{ dims:['bucket'] } } }), cf2 = on('r-bucket', { views:{ map:{ dims:['bucket', 'bucket'] } } });
  const cpd = on('r-borover', { main:{ pct:{ dim:'region', cells:['Ошская'] } } });
  const cpc = on('r-borover', { main:{ pct:{ dim:'bover', cells:['нет такой'] } } });
  const cnt = DB.autocheck(DB.blankDraft('r-bucket'));
  const csh = on('r-portfolio', { params:{ curator:'*', date:'prevMonthEnd' }, shift:'prevMonthEnd' }), csy = on('r-portfolio', { params:{ curator:'*', date:'prevMonthEnd' }, shift:'yearStart' });
  const good = on('r-bucket', {}), gv = DB.view(asT(Object.assign(DB.blankDraft('r-bucket'), { title:'x' }), 'good'), 'slice', null, [], 'u1', 'lead', {});
  const gpct = on('r-borover', { main:{ pct:{ dim:'bover', cells:['больше 0'] } } }), lbo = DB.ask(T('lead-borr'), U('u1'), 'lead', {}).second;
  DB.reportById('r-bucket').state = 'archived'; const arch = on('r-bucket', {}); DB.reportById('r-bucket').state = 'active';
  asUser('u11'); const dg = DB.saveTile(Object.assign(DB.blankDraft('r-bucket'), { title:'Ступени' }), 'draft').tile;
  const db = DB.saveTile(Object.assign(DB.blankDraft('r-bucket'), { title:'Карта из одного разреза', views:{ map:{ dims:['bucket'] } } }), 'draft').tile;
  const pg = DB.publishDraftId(dg.id), pb = DB.publishDraftId(db.id); asUser('u1');
  ok(132, pg === true && T(dg.id).state === 'published' && pb.error && bad(pb, /два разных разреза/) && T(db.id).state === 'draft' && bad(c5, /до четырёх колонок/)
    && bad(cm, /одного рода/) && bad(cm, /колонки из отчёта/) && bad(ctm, /одного рода с главным/) && bad(cf, /два разных разреза/) && bad(cf2, /два разных разреза/)
    && bad(cpd, /% от итога группы/) && bad(cpc, /% от итога группы/) && bad(cnt, /подпись/) && bad(arch, /действует/) && bad(csh, /база совпадает/) && csy.ok
    && good.ok && good.preview.state === 'ok' && good.preview.value === sum(lt.map(x => x[1])) && JSON.stringify(gv.nodes.map(n => [n.v, n.value])) === JSON.stringify(lt)
    && gpct.ok && gpct.preview.value === lbo.value && gpct.preview.num === lbo.num,
    'автопроверка плитки: пятая колонка Таблицы, второе число и колонка Таблицы другого рода, Карта из одного разреза, «% от итога группы» не по разрезу отчёта или по несуществующей ячейке, база сдвига на дату плитки, без подписи, отчёт в архиве — отказ с причиной; годный черновик проходит, предпросмотр — основа, равная числам каталога; черновик каталога публикуется той же автопроверкой (ДБ-109, ДБ-30, ДБ-127)');
  // «📌 на дашборд» → личная плитка: ссылка, значения, главное и второе число, светофор, умолчания видов; правка — версия, другой отчёт — новая плитка
  DB.seed(); asUser('u1');
  const pd = DB.pin('r-portfolio'), pinned = DB.draft === pd && pd.report === 'r-portfolio' && pd.title === DB.reportById('r-portfolio').title
    && pd.main.col === 'loan.balance' && pd.second.col === 'loan.count' && pd.second.label === 'кредитов';
  DB.dMain('col', 'loan.overdue'); DB.dSecond('share', 'loan.overdue', 'loan.balance'); DB.dSecond('label', 'портфеля');
  DB.dTl('on', 'second'); DB.dTl('red', '>', '5'); DB.dTl('yellow', null, '4'); DB.dView('slice', 'dim', 'bucket'); DB.dTitle('Просрочено — моя');
  const nt = (DB.saveDraft('personal') || {}).tile || {};
  const SHOW = ['id', 'kind', 'report', 'params', 'main', 'second', 'shift', 'tl', 'views', 'title', 'owner', 'state', 'version', 'created'];
  const an = DB.ask(nt, U('u1'), 'lead', {}), lo = DB.ask(T('lead-od'), U('u1'), 'lead', {});
  const mn = DB.view(nt.id, 'move', null, [], 'u1', 'lead', {}), mo = DB.view('lead-od', 'move', null, [], 'u1', 'lead', {});
  const e1 = DB.editTile(nt.id, { params:{ curator:'*', date:'closedDay' } }), v1 = nt.version, ac = DB.ask(nt, U('u1'), 'lead', {});
  const e2 = DB.editTile(nt.id, { report:'r-loans' }), e3 = DB.editTile(nt.id, { filter:[] });
  ok(133, pinned && Object.keys(nt).length && Object.keys(nt).every(k => SHOW.includes(k)) && !own(nt) && nt.state === 'personal' && nt.owner === 'u1' && nt.report === 'r-portfolio'
    && nt.main.col === 'loan.overdue' && nt.second.share.join() === 'loan.overdue,loan.balance' && nt.tl.on === 'second' && nt.views.slice.dim === 'bucket'
    && an.state === 'ok' && an.value === lo.value && an.second.value === lo.second.value && an.tl === lo.tl && JSON.stringify(mn.move) === JSON.stringify(mo.move) && an.passport === lo.passport
    && e1.tile && v1 === 2 && /день закрыт/.test(ac.passport) && e2.error === 'Другой отчёт — это новая плитка' && e3.error && nt.version === 2 && nt.report === 'r-portfolio' && !own(nt),
    `«📌» из «${DB.reportById('r-portfolio').title}» → личная плитка «${nt.title}»: поля ${Object.keys(nt).join(', ')}; главное, доля и светофор = «Просрочено» Руководства, Движение то же; правка значения даты — версия ${v1}; другой отчёт — «${e2.error}» (ДБ-103, ДБ-113, ДБ-116)`);
  // плитка без отчёта и без очереди сломана, даже если несёт вопрос сама
  const bare = { id:'bare', title:'Без отчёта', kind:'overview' };
  const oldq = { id:'old-q', title:'Свой вопрос', kind:'overview', inds:['loan.count'], dims:[], filter:[] };
  const rb = DB.ask(bare, U('u1'), 'lead', {}), ro = DB.ask(oldq, U('u1'), 'lead', {}), ra = DB.answer(Object.assign({ format:'number' }, oldq), U('u1'), 'lead', {});
  const sr = DB.statRows(oldq, U('u1'), 'lead', {}), rg = DB.registryList(oldq, U('u1'), 'lead', {});
  const noRep = DB.ask(Object.assign({}, T('lead-bal'), { report:undefined }), U('u1'), 'lead', {});
  ok(134, DB.questionOf(bare) === null && DB.questionOf(oldq) === null && rb.state === 'broken' && ro.state === 'broken' && /не ссылается на отчёт/.test(rb.msg) && /не ссылается на отчёт/.test(ro.msg)
    && ro.value === undefined && ra.state === 'ok' && ra.value > 0 && sr.refused && /не ссылается на отчёт/.test(rg.msg) && DB.tileAnswers(oldq) && DB.reqOf(oldq).length === 0 && DB.qualOf(oldq) === ''
    && noRep.state === 'broken' && /не ссылается на отчёт/.test(noRep.msg),
    `плитка без отчёта и без очереди — «${rb.msg}», даже если несёт вопрос сама; тот же вопрос отвечает только из конструктора отчётности (ДБ-99)`);
  // доступные отчёты: круг отчёта и право роли; поиск по названию и составу
  const u1 = U('u1'), u2 = U('u2'), u10 = U('u10'), has = (l, id) => l.some(x => x.r.id === id);
  const srok = DB.reportsFor(u1, 'срок'), all1 = DB.reportsFor(u1), all2 = DB.reportsFor(u2), all10 = DB.reportsFor(u10), port = all1.find(x => x.r.id === 'r-portfolio');
  const byCol = DB.reportsFor(u1, 'ОСТАТОК ЗАДОЛЖЕННОСТИ'), byDim = DB.reportsFor(u1, 'область'), byObj = DB.reportsFor(u10, 'обязательство');
  DB.reportById('r-loans').state = 'archived'; const arch2 = has(DB.reportsFor(u1), 'r-loans'); DB.reportById('r-loans').state = 'active';
  const p1 = DB.saveTile(Object.assign(DB.blankDraft('r-u2-agro'), { title:'чужой' }), 'personal');
  asUser('u2'); const p2 = DB.saveTile(Object.assign(DB.blankDraft('r-u2-agro'), { title:'моё', params:{ curator:'@me', date:'today' } }), 'personal'); asUser('u1');
  ok(135, has(srok, 'r-bucket') && srok.find(x => x.r.id === 'r-bucket').r.title === 'Просрочка по сроку неплатежа' && has(all2, 'r-u2-agro') && !has(all1, 'r-u2-agro')
    && port.feeds === DB.TILES.filter(t => t.report === 'r-portfolio').length && port.feeds >= 5 && has(byCol, 'r-portfolio') && has(byCol, 'r-balreg') && !has(byCol, 'r-loans')
    && has(byDim, 'r-odmap') && has(byDim, 'r-balreg') && all10.length === 3 && all10.every(x => x.r.obj === 'oblig') && byObj.length === all10.length && !arch2 && has(all1, 'r-form')
    && p1.error && /не открыт/.test(p1.error) && p2.tile && p2.tile.state === 'personal' && p2.tile.owner === 'u2',
    `доступные отчёты: «срок» находит «Просрочка по сроку неплатежа» (всего ${srok.length}); поиск по колонке, разрезу, объекту; личный отчёт Бековой виден ей и не виден Руководству, личная плитка на нём — только у неё; Отчётности открыты ${all10.length} отчёта по обязательствам; «${port.r.title}» кормит ${port.feeds} плиток (ДБ-103, ДБ-104)`);
})();

/* ---------- O (продолжение). Конструктор отчётности: сборка, «похожий уже есть», «действующие» ---------- */
(() => {
  const ACT_L = { f:'lact', op:'eq', v:'действующий' }, ACT_B = { f:'pstate', op:'eq', v:'действующий' }, ME = { f:'curator', op:'eq', v:'@me' };
  const hasHint = (d, re) => DB.reportHints(d).some(h => re.test(h));
  // «Сохранить и поставить»: личный отчёт на полке автора + личная плитка на нём; «я» — параметр отчёта, значение у плитки
  DB.seed(); asUser('u2');
  DB.newReportDraft(); DB.rInd('loan.overdue', true); DB.rInd('loan.count', false); DB.rDim('bucket', true); DB.rFilter('curator', '@me'); DB.rTitle('Моя просрочка по срокам');
  const rd = DB.rdraft, want = DB.answer(Object.assign({}, rd, { id:'draftq', format:'steps' }), U('u2'), 'cur', {});
  const n0 = DB.REPORTS.length, j0 = DB.state.journal.length;
  const blank = DB.saveAndPlace(Object.assign({}, rd, { title:'' }), 'cur');
  const sp = DB.rSaveAndPlace(), rep = sp.report, tl = sp.tile;
  const got = DB.view(tl.id, 'slice', null, [], 'u2', 'cur', {}), base = DB.ask(tl, U('u2'), 'cur', {}), q = DB.questionOf(tl);
  const feeds = DB.reportsFor(U('u2')).find(x => x.r.id === rep.id), seen1 = DB.reportsFor(U('u1')).some(x => x.r.id === rep.id);
  const jr = DB.state.journal.map(j => j.action);
  const cn = [rep.id, tl.id], nAfter = DB.REPORTS.length, drNull = DB.rdraft === null, onTab = DB.composeLayout('u2', 'cur').includes(tl.id), sk = DB.scopeKey(tl, U('u2'), 'cur'); DB.seed();
  ok(136, blank.error && blank.checks.some(c => !c.ok && /подпись/.test(c.text)) && nAfter === n0 + 1 && drNull && onTab
    && /^r-p-u2-\d+$/.test(rep.id) && rep.shelf === 'personal' && rep.owner === 'u2' && rep.circle.owner === 'u2' && Object.keys(rep.circle).join() === 'owner' && rep.state === 'active'
    && rep.cols.join() === 'loan.overdue' && rep.dims.join() === 'bucket' && JSON.stringify(rep.filter) === JSON.stringify([ACT_L]) && !rep.filter.some(c => String(c.v).startsWith('@'))
    && JSON.stringify(rep.params.curator) === JSON.stringify({ dim:'curator', op:'eq', name:'Куратор' }) && rep.params.date.name === 'Дата' && !rep.params.period
    && tl.state === 'personal' && tl.owner === 'u2' && tl.report === rep.id && tl.params.curator === '@me' && tl.params.date === 'today' && tl.main.col === 'loan.overdue' && tl.second === null && tl.views.slice.dim === 'bucket' && !('pick' in tl) && !('format' in tl)
    && feeds && feeds.feeds === 1 && !seen1 && got.state === 'ok' && JSON.stringify(got.nodes.map(n => [n.v, n.value])) === JSON.stringify(want.nodes.map(n => [n.v, n.value])) && got.total.v === want.total.v && base.value === want.total.v && base.passport === want.passport
    && q.filter.some(c => c.f === 'curator' && c.v === '@me') && sk.startsWith('user:')
    && jr.includes('собрал личный отчёт') && jr.includes('собрал личную плитку') && jr.length === j0 + 2
    && !DB.reportById(cn[0]) && !DB.tileById(cn[1]) && !!DB.reportById('r-u2-agro') && DB.composeLayout('u2', 'cur').includes('p-u2-agro'),
    `«Сохранить и поставить»: личный отчёт ${rep.id} на полке Бековой (круг — она, куратор — параметр отчёта, в фильтре «я» нет) и личная плитка со значением «я»; числа плитки равны ответу черновика: ${got.total.v} при ${got.nodes.length} ступенях; без подписи — отказ, ничего не создано; seed() убирает созданное (ДБ-103, ДБ-101)`);
  // «похожий уже есть»: тот же объект, разрезы по порядку, постоянный фильтр без относительных значений; чужие личные отчёты не видны
  DB.seed(); asUser('u1');
  DB.newReportDraft(); DB.rDim('bucket', true); DB.rCondDel('filter', 0); DB.rCond('filter', 'f', 'overdueDays'); DB.rCond('filter', 'op', 'gt'); DB.rCond('filter', 'v', '0'); DB.rCondAdd('filter');
  const dB = DB.rdraft, s1 = DB.similarReport(dB, U('u1')), s2 = DB.similarReport(Object.assign({}, dB, { filter:[...dB.filter, ME] }), U('u1'));
  const s3 = DB.similarReport(Object.assign({}, dB, { filter:[...dB.filter, { f:'region', op:'eq', v:'Ошская' }] }), U('u1')), s4 = DB.similarReport(Object.assign({}, dB, { inds:['loan.balance'] }), U('u1'));
  const dM = Object.assign({}, dB, { inds:['loan.overdue'], dims:['region', 'bucket'] }), dR = Object.assign({}, dM, { dims:['bucket', 'region'] });
  const s5 = DB.similarReport(dM, U('u1')), s6 = DB.similarReport(dR, U('u1'));
  DB.newReportDraft(); DB.rInd('loan.overdue', true); DB.rInd('loan.count', false); DB.rDim('bucket', true); DB.rFilter('curator', '@me'); DB.rTitle('Моя просрочка по срокам');
  const dU = DB.rdraft; asUser('u2'); const pre = DB.similarReport(dU, U('u2')), mine = DB.saveAndPlace(dU, 'cur'); const s7 = DB.similarReport(dU, U('u2')); asUser('u1');
  const s8 = DB.similarReport(dU, U('u1')), v1 = DB.reportsFor(U('u1')).some(x => x.r.id === mine.report.id);
  ok(137, s1 && s1.r.id === 'r-bucket' && s2 && s2.r.id === 'r-bucket' && !s3 && !s4 && s5 && s5.r.id === 'r-odmap' && !s6
    && !pre && s7 && s7.r.id === mine.report.id && s8 === null && !v1,
    `«похожий уже есть»: вопрос отчёта «${s1 && s1.r.title}» находит его же (относительное значение не в счёт); лишнее условие, другой показатель, другой порядок разрезов — не похоже; личный отчёт Бековой находит она и не находит Руководство (ДБ-103)`);
  // «действующие» по умолчанию: остаткам и счёту — да, потокам — нет; правленый фильтр не трогается
  DB.seed(); asUser('u1');
  DB.newReportDraft(); const d0 = DB.rdraft, f0 = JSON.stringify(d0.filter) === JSON.stringify([ACT_L]);
  DB.rInd('loan.issued', true); const d1 = DB.rdraft, f1 = d1.filter.length === 0, h1 = DB.reportHints(d1).length;
  DB.rInd('loan.count', true); const f2 = JSON.stringify(DB.rdraft.filter) === JSON.stringify([ACT_L]) && DB.rdraft.inds.join() === 'loan.count';
  DB.rInd('loan.balance', true); DB.rInd('loan.issued', true); const kept = DB.rdraft.inds.slice();
  DB.newReportDraft(); DB.rInd('loan.issued', true); DB.rCond('filter', 'f', 'lact'); DB.rCond('filter', 'v', 'действующий'); DB.rCondAdd('filter');
  const hf = DB.reportHints(DB.rdraft);
  DB.newReportDraft(); DB.rCondDel('filter', 0); DB.rCond('filter', 'f', 'overdueDays'); DB.rCond('filter', 'op', 'gt'); DB.rCond('filter', 'v', '30'); DB.rCondAdd('filter');
  const edited = JSON.stringify(DB.rdraft.filter); DB.rInd('loan.issued', true); const e1 = JSON.stringify(DB.rdraft.filter) === edited; DB.rInd('loan.count', true); const e2 = JSON.stringify(DB.rdraft.filter) === edited;
  DB.newReportDraft(); DB.rCondDel('filter', 0); const noAct = DB.reportHints(DB.rdraft);
  DB.rSet('obj', 'borrower'); const fb = JSON.stringify(DB.rdraft.filter) === JSON.stringify([ACT_B]); DB.rSet('obj', 'program'); const fp = DB.rdraft.filter.map(c => c.f).join();
  DB.rSet('obj', 'claim'); const fc = DB.rdraft.filter.length; DB.newReportDraft();
  ok(138, f0 && f1 && h1 === 0 && f2 && kept.join() === 'loan.count,loan.balance'
    && hf.some(h => /отрезает договоры, закрытые в периоде/.test(h)) && hf.some(h => /последний платёж/.test(h))
    && e1 && e2 && noAct.some(h => /действующие и закрытые договоры/.test(h)) && fb && fp === 'pgstate' && fc === 0
    && hasHint({ obj:'borrower', inds:['borrower.count'], filter:[] }, /складывает действующих и погасивших/) && !hasHint({ obj:'borrower', inds:['borrower.count'], filter:[ACT_B] }, /складывает/),
    '«действующие» по умолчанию у кредита, заёмщика и программы: у остатка и счёта фильтр стоит, при смене на поток («Выдано») снимается и возвращается обратно; поток с «действующими» — предупреждение про последний платёж; правленый фильтр смена рода не трогает; смесь остатка и потока из двух показателей не отмечается (ДБ-111)');
  // фильтра числителя в конструкторе нет: «Заёмщиков с просрочкой» — заёмщики + разрез «Договоров с просрочкой» в отчёте и ячейка «больше 0» на плитке
  DB.seed(); asUser('u1');
  DB.rSet('obj', 'borrower'); DB.rDim('bover', true); DB.rTitle('Заёмщики по договорам с просрочкой (личный)');
  const rB = DB.rdraft, cB = DB.rcheck(rB), repB = DB.buildReport(rB);
  DB.newDraft(repB.id); DB.dMain('pct', 'borrower.count', 'bover', ['больше 0']); DB.dTitle('Заёмщиков с просрочкой'); const dT = DB.draft, aT = DB.autocheck(dT);
  const mineB = DB.ask(dT, U('u1'), 'lead', {}), leadB = DB.ask(T('lead-borr'), U('u1'), 'lead', {}).second;
  const rc = DB.rcheck(Object.assign({}, rB, { share:[rB.inds[0], rB.inds[0]] }));
  ok(139, cB.ok && JSON.stringify(repB.filter) === JSON.stringify([ACT_B]) && repB.dims.join() === 'bover' && repB.cols.join() === 'borrower.count' && aT.ok
    && mineB.state === 'ok' && mineB.value === leadB.value && mineB.num === leadB.num && mineB.den === leadB.den && mineB.num > 0
    && typeof DB.rNumShare === 'undefined' && typeof DB.builderHints === 'undefined' && !('numFilter' in rB) && !('numFilter' in DB.blankReportDraft())
    && !cB.checks.some(c => /числител/.test(c.text)) && !rc.ok && rc.checks.some(c => !c.ok && /два показателя/.test(c.text))
    && ['buildReport', 'similarReport', 'saveAndPlace', 'reportHints', 'rTitle', 'rSaveAndPlace'].every(k => typeof DB[k] === 'function'),
    `у конструктора нет фильтра числителя: «Заёмщиков с просрочкой» — заёмщики с разрезом «Договоров с просрочкой» в отчёте и «% от итога группы» по ячейке «больше 0» на плитке: ${mineB.num} из ${mineB.den}, как у плитки Руководства; доля из одного показателя не проходит автопроверку (ДБ-111)`);
})();

/* ---------- O (продолжение). Клик и отчёт ---------- */
(() => {
  DB.seed(); asUser('u1');
  const u1 = U('u1'), u2 = U('u2');
  // число, ступень, строка таблицы, точка ряда — провал отчёта по узлу: сумма списка равна числу узла, выше порога — отказ
  // счёт строк узла — колонка «Кредитов» Таблицы; число узла на плитке теперь деньги (остаток, просрочено), список строк — те же кредиты
  const prog = DB.at('lead-bal', 'table(program;loan.count,loan.balance,loan.overdue)', 'u1', 'lead', {}).map(([v, c]) => ({ r:{ v, cells:c }, d: DB.drill('lead-bal', u1, 'lead', {}, { d:'program', v }) }));
  const per = prog.find(x => x.r.v === 'per'), agro = prog.find(x => x.r.v === 'agro');
  const bk = DB.at('lead-od', 'table(bucket;loan.count)', 'u1', 'lead', {}).map(([v, c]) => ({ n:{ v, value:c }, d: DB.drill('lead-od', u1, 'lead', {}, { d:'bucket', v }) }));
  const b1 = bk.find(x => x.n.v === '1–30');
  const tot = DB.drill('cur-bal', u2, 'cur', {}), ser = DB.drill('prob-rec', U('u3'), 'prob', {}, { m:-3 }), ser0 = DB.drill('prob-rec', U('u3'), 'prob', {}, { m:-1 });
  const pts = DB.view('prob-rec', 'series', { points:12, of:'main' }, [], 'u3', 'prob', {}).series.points, big = DB.drill('lead-bal', u1, 'lead', {});
  ok(140, prog.every(x => x.d.refused ? x.d.count === x.r.cells[0] : x.d.matches && x.d.list.length === x.r.cells[0] && Math.round(x.d.sum) === Math.round(x.r.cells[1]))
    && !per.d.refused && per.d.matches && per.d.nodeText === 'Переработка' && agro.d.refused && /сузьте/.test(agro.d.msg)
    && bk.every(x => !x.d.refused && x.d.matches && x.d.list.length === x.n.value) && !b1.d.refused && b1.d.list.length === b1.n.value && b1.d.nodeText === '1–30'
    && !tot.refused && tot.matches && tot.list.length === 47 && Math.round(tot.sum) === Math.round(DB.at('cur-bal', 'main', 'u2', 'cur', {})) && big.refused && big.count === 1248
    && ser.matches && ser.sum === pts.find(p => p.m === -3).vals[0] && ser0.matches && ser0.sum === pts.find(p => p.m === -1).vals[0] && pts.at(-1).m === -1 && ser.nodeText === 'за июль',
    `провал отчёта по узлу: у Таблицы «Остатка» по программам строка «Переработка» — ${per.d.list.length} кредитов = «Кредитов» в строке, сумма ${per.d.sum} = остатку в строке; «Агрокредит» (${agro.d.count}) — отказ выше порога; ступень «1–30» Таблицы «Просрочено» по срокам — ${b1.d.list.length} = ${b1.n.value}, все четыре ступени сходятся; число узла на плитке — деньги, строк в списке — счёт кредитов (было: число узла = счёт); точка ряда «Взыскано» за июль — ${ser.list.length} требований, сумма = столбцу (ДБ-105)`);

  // отчёт плитки: те же значения параметров и фильтр панели; ответ отчёта — первый уровень строк, без разрезов — итог
  const reg = { region:'Ошская' }, v = DB.reportView('cur-od', u2, 'cur', reg), vAll = DB.reportView('cur-od', u2, 'cur', {}), vChu = DB.reportView('cur-od', u2, 'cur', { region:'Чуйская' });
  const tileNodes = DB.at('cur-od', 'table(bucket;loan.count)', 'u2', 'cur', reg), rep = DB.reportById(T('cur-od').report), ci = rep.cols.indexOf('loan.count');
  const vod = DB.reportView('lead-od', u1, 'lead', {}), vll = DB.reportView('lead-recov', u1, 'lead', {}), vnp = DB.reportView('cur-npay', u2, 'cur', {}), vlk = DB.reportView('acc-unident', U('u4'), 'acc', {});
  const pv = (view, name) => (view.params.find(p => p.name === name) || {}).value;
  ok(141, pv(v, 'Куратор') === 'я' && pv(vAll, 'Куратор') === 'я' && pv(vod, 'Куратор') === 'все' && pv(v, 'Дата') === 'сегодня' && pv(vnp, 'Платёж не позднее') === 'сегодня + 3 дн.'
    && /Ошская/.test(v.panelText) && vAll.panelText === 'без фильтра' && v.answer.panelApplied.join() === 'region'
    && v.report.id === rep.id && v.report.title === rep.title && v.report.shelf === 'catalog' && v.report.shelfName === 'Общий отчёт каталога' && v.report.ownerName === U('u11').name
    && v.report.version === 1 && v.report.changed === null && v.filterText.join() === 'Состояние договора = действующий'
    && v.answer.state === 'ok' && v.answer.table.d === rep.dims[0] && v.answer.table.rows.length === tileNodes.length
    && v.answer.table.rows.every(r => r.cells[ci] === tileNodes.find(n => n[0] === r.v)[1]) && v.answer.total[ci] === 0 && vAll.answer.total[ci] > 0 && vChu.answer.total[ci] === vAll.answer.total[ci] && /Чуйская/.test(vChu.panelText)
    && vod.answer.table.d === 'bucket' && vod.answer.table.rows[0].cells.length === DB.reportById(T('lead-od').report).cols.length && vod.cols.length === vod.answer.table.rows[0].cells.length
    && !vll.answer.table && vll.answer.values.length === DB.reportById(T('lead-recov').report).cols.length && vll.cols.length === vll.answer.values.length
    && vlk === null && DB.reportView('no-such-tile', u1, 'lead', {}) === null,
    `отчёт «${rep.title}» плитки «Просрочено» Куратора: параметр «Куратор» — «${pv(v, 'Куратор')}», панель — «${v.panelText}», первый уровень ответа — разрез «${DB.DIMS[v.answer.table.d].name}» (${v.answer.table.rows.length} строк, как на плитке), панель сужает и не расширяет: в Ошской ${v.answer.total[ci]}, в Чуйской ${vChu.answer.total[ci]} из ${vAll.answer.total[ci]} кредитов; без разрезов (отчёт «Дела взыскания») — итог (${vll.answer.values.length} колонок); у ссылочной плитки отчёта нет (ДБ-105, ДБ-102)`);

  // открытие отчёта фиксирует просмотренную версию: отметка «изменён» живёт до открытия
  DB.seed(); asUser('u1');
  const t = T('lead-od'), r = DB.reportById(t.report), none = DB.reportChangedFor(t, 'u1');
  r.changed = { at:'14.10', who:'u1', what:'фильтр' }; r.version++;
  const before = DB.reportChangedFor(t, 'u1'), other = DB.reportChangedFor(t, 'u3'), sibling = DB.reportChangedFor(T('cur-od'), 'u1');
  const view = DB.reportView('lead-od', u1, 'lead', {});
  const after = DB.reportChangedFor(t, 'u1'), siblingAfter = DB.reportChangedFor(T('cur-od'), 'u1'), stillOther = DB.reportChangedFor(t, 'u3'), seenV = DB.state.seen['u1|' + r.id];
  r.changed = { at:'15.10', who:'u1', what:'колонки' }; r.version++;
  const again = DB.reportChangedFor(t, 'u1');
  ok(142, none === null && before && before.what === 'фильтр' && other && other.what === 'фильтр' && sibling && sibling.what === 'фильтр'
    && /отчёт изменён 14\.10 \(Асанов\): фильтр/.test(view.report.changedText) && view.report.version === 2
    && after === null && siblingAfter === null && stillOther && stillOther.what === 'фильтр' && seenV === 2
    && again && again.what === 'колонки' && DB.reportChangedFor(T('acc-unident'), 'u4') === null && DB.reportChangedFor(null, 'u1') === null,
    'отметка «отчёт изменён 14.10 (Асанов): фильтр» стоит у каждой плитки на этом отчёте, пока смотрящий не открыл его: открыл — снялась у него и у плиток-соседей на том же отчёте, у других смотрящих осталась; новая правка отчёта вешает отметку снова (ДБ-110)');
  DB.seed();

  // сигнал ставится на отчёт: у ссылочной плитки отчёта нет; подпись строки есть у каждого вида объекта
  asUser('u5');
  const links = DB.TILES.filter(x => x.kind === 'link'), lr = links.map(x => DB.signalToggle(x.id, 'zal')), lowcov = DB.signalToggle('zal-lowcov', 'zal');
  const kinds = Object.keys(DB.DATA), labels = kinds.map(k => { try { return DB.rowLabel(k, DB.DATA[k][0]); } catch (e) { return null; } });
  const brokenTile = Object.assign({}, T('lead-od'), { id:'broken', report:'r-none' }), bd = DB.drill(brokenTile, u1, 'lead', {});
  asUser('u1'); const on = DB.signalToggle('lead-od', 'lead'), off = DB.signalToggle('lead-od', 'lead');
  ok(143, links.length > 10 && lr.every(x => x && x.error && /нет отчёта — сигнал ставится на отчёт/.test(x.error)) && lowcov.error && DB.state.signals.length === 0
    && Array.isArray(on) && on.length === 2 && off === false && DB.state.signals.length === 0
    && kinds.length === 17 && labels.every(x => typeof x === 'string' && x.length > 0) && DB.rowLabel('program', DB.DATA.program[0]).startsWith('Агрокредит')
    && bd.refused && /сломана/.test(bd.msg) && !/\.\.$/.test(bd.msg),
    `у плитки очереди сигнала нет (${links.length} плиток, в том числе с порогами светофора) — «${lowcov.error}»; у плитки с отчётом по-прежнему по сигналу на порог; подпись строки читается у всех ${kinds.length} видов объектов, не падая на чужих полях (ДБ-106, ДБ-105)`);
  DB.seed();

  // «Собрать новый отчёт» на экране «+ Плитка»: ящик конструктора отчётности открывается поверх страницы; черновик отчёта один,
  // повторное открытие его не стирает, «начать заново» стирает, «сохранить и поставить» закрывает
  asUser('u1');
  const rcNone = DB.rdraft, rcFirst = DB.openRC(), rcObj = rcFirst && rcFirst.obj;
  DB.rSet('obj', 'borrower'); DB.rDim('bover', true); DB.rTitle('Заёмщики по договорам с просрочкой (мой)');
  const rcAgain = DB.openRC(), rcSame = DB.rdraft === rcAgain && rcAgain.obj === 'borrower' && rcAgain.dims.join() === 'bover';
  const rcSim = DB.similarReport(DB.rdraft, u1), rcFresh = DB.newReportDraft(), rcKept = DB.rdraft === rcFresh && rcFresh.dims.length === 0 && rcFresh.obj === 'loan';
  DB.rSet('obj', 'borrower'); DB.rDim('bover', true); DB.rTitle('Заёмщики по договорам с просрочкой (мой)');
  const rcPlaced = DB.rSaveAndPlace();
  ok(144, rcNone === null && rcFirst && rcObj === 'loan' && rcSame && rcSim && rcSim.r.id === 'r-borover' && rcKept
    && rcPlaced && !rcPlaced.error && rcPlaced.report.shelf === 'personal' && DB.rdraft === null,
    `«Собрать новый отчёт» открывает конструктор отчётности: черновик один (${rcObj}), повторное открытие его не стирает, «начать заново» стирает; черновик «заёмщики × договоров с просрочкой» узнаёт «${rcSim && rcSim.r.title}»; «сохранить и поставить» собирает личный отчёт и закрывает черновик`);
  DB.seed();
})();

/* ---------- O (продолжение). Два замка: круг отчёта и область видимости ---------- */
(() => {
  const u1 = U('u1'), u2 = U('u2'), nar = U('c30'), BM = /Нельзя: отчёт «Портфель кредитов» не открыт вашему подразделению/;
  const forCur = () => Object.assign(DB.blankDraft('r-portfolio'), { title:'Просрочка по срокам — кураторам', main:{ col:'loan.count' }, forRoles:['cur'] });
  const text = ac => ac.checks.filter(c => /круг отчёта/.test(c.text));
  // круг сужен позже: плитка не прячется, а называет замок; другое подразделение видит числа; ключ кэша различает открытый и закрытый круг
  DB.seed(); asUser('c30');
  const nb0 = DB.cachedAsk(T('cur-od'), nar, 'cur', {}), lay0 = DB.composeLayout('c30', 'cur');
  DB.reportById('r-portfolio').circle = { depts:['go'] };
  const nbKey = DB.cachedAsk(T('cur-od'), nar, 'cur', {});
  DB.standCircle(false); DB.standCircle(true);
  const nb1 = DB.cachedAsk(T('cur-od'), nar, 'cur', {}), lay1 = DB.composeLayout('c30', 'cur'), narrowed = DB.reportById('r-portfolio').circle;
  const ch = DB.ask(T('cur-od'), u2, 'cur', {}), ld = DB.ask(T('lead-od'), u1, 'lead', {}), own = DB.ask(T('cur-borod'), nar, 'cur', {});
  const cat = DB.catalogFor(nar).find(x => x.t.id === 'cur-od'), catU2 = DB.catalogFor(u2).find(x => x.t.id === 'cur-od'), cs = DB.canSee(T('cur-od'), nar);
  const rv = DB.reportView('cur-od', nar, 'cur', {}), dr = DB.drill('cur-od', nar, 'cur', {}), rg = DB.registryList(T('cur-od'), nar, 'cur', {});
  const lock4 = ['cur-bal', 'cur-od', 'cur-risk', 'cur-rc'].map(id => DB.cachedAsk(T(id), nar, 'cur', {}));
  DB.standCircle(false); const back = DB.ask(T('cur-od'), nar, 'cur', {});
  DB.USERS.push({ id:'c99', name:'Куратор без кредитов', roles:['cur'], dept:'rp-nar' });
  const none = DB.ask(T('cur-bal'), U('c99'), 'cur', {}), noneB = DB.ask(T('cur-od'), U('c99'), 'cur', {}); DB.USERS.pop();
  ok(145, nb0.state === 'ok' && nbKey.state === 'noaccess' && nb1.state === 'noaccess' && BM.test(nb1.msg) && nb1.value === undefined && !nb1.nodes
    && Object.keys(narrowed).join() === 'depts' && narrowed.depts.length === 11 && !narrowed.depts.includes('rp-nar') && narrowed.depts.includes('rp-chu')
    && lay0.includes('cur-od') && lay1.includes('cur-od') && lay1.join() === lay0.join() && lock4.every(r => r.state === 'noaccess' && BM.test(r.msg))
    && ch.state === 'ok' && ch.visible > 0 && ld.state === 'ok' && own.state === 'ok'
    && cat && BM.test(cat.why) && catU2 && catU2.why === null && cs === cat.why
    && rv.noaccess && BM.test(rv.msg) && dr.refused && BM.test(dr.msg) && rg.today === 0 && BM.test(rg.msg)
    && back.state === 'ok' && none.state === 'zero' && none.value === 0 && none.visible > 0 && (noneB.state === 'ok' || noneB.state === 'zero') && noneB.value === 0,
    `круг отчёта «Портфель кредитов» сужен без Нарынского РП: куратор Нарынского РП — «${nb1.msg}» на всех четырёх плитках отчёта (Остаток, Просрочено, Сумма под риском, В реструктуризации), плитка стоит в его раскладке и в каталоге называет ту же причину, отчёт, провал и реестр отказывают; Чуйское РП (${ch.visible} в охвате) и Руководство числа видят, плитка другого отчёта («Заёмщиков с просрочкой») куратору открыта; вернули круг — числа вернулись; куратор без кредитов — честный ноль, не ошибка (ДБ-104)`);

  // автопроверка публикации: круг покрывает всех держателей ролей, в раскладках которых плитка стоит (или встанет)
  DB.seed(); asUser('u11');
  const ac0 = DB.autocheck(forCur()), ac0n = DB.autocheck(Object.assign(forCur(), { forRoles:[] }));
  DB.standCircle(true);
  const ac1 = DB.autocheck(forCur()), ac1n = DB.autocheck(Object.assign(forCur(), { forRoles:[] })), ac1l = DB.autocheck(Object.assign(forCur(), { forRoles:['lead'] }));
  const refused = DB.saveTile(forCur(), 'publish'), dtl = DB.saveTile(forCur(), 'draft'), dt = dtl.tile, dtSt = dt.state + ':' + dt.forRoles.join(), pub1 = DB.publishDraftId(dt.id), st1 = DB.tileById(dt.id).state;
  DB.USERS.push({ id:'c98', name:'Второй куратор', roles:['cur'], dept:'rp-nar' }); const ac2 = DB.autocheck(forCur()); DB.USERS.pop();
  DB.standCircle(false);
  const pub2 = DB.publishDraftId(dt.id), add2 = DB.declaredEdit('cur', 'add', dt.id), inCur = DB.state.declared.cur.includes(dt.id);
  DB.standCircle(true);
  const t2 = DB.saveTile(Object.assign(forCur(), { forRoles:[], title:'Ещё одна' }), 'publish').tile;
  const addLead = DB.declaredEdit('lead', 'add', t2.id), add3 = DB.declaredEdit('cur', 'add', t2.id);
  ok(146, ac0.ok && ac0n.ok && /открыт всем держателям ролей: Куратор кредита/.test(text(ac0)[0].text) && /круг отчёта: все/.test(text(ac0n)[0].text)
    && !ac1.ok && text(ac1).length === 1 && /^круг отчёта не покрывает 1 держателя роли «Куратор кредита»: Нарынское РП$/.test(text(ac1)[0].text) && ac1.checks.filter(c => !c.ok).length === 1
    && ac1n.ok && /круг отчёта: подразделений: 11/.test(text(ac1n)[0].text) && ac1l.ok
    && refused.error && refused.checks.some(c => !c.ok && /Нарынское РП/.test(c.text)) && dtSt === 'draft:cur'
    && pub1.error && pub1.checks.some(c => !c.ok && /круг отчёта не покрывает 1 держателя роли «Куратор кредита»: Нарынское РП/.test(c.text)) && st1 === 'draft'
    && /не покрывает 2 держателей роли «Куратор кредита»: Нарынское РП$/.test(text(ac2)[0].text)
    && pub2 === true && DB.tileById(dt.id).state === 'published' && !('forRoles' in DB.tileById(dt.id)) && add2 === true && inCur
    && addLead === true && add3.error && /не покрывает 1 держателя роли «Куратор кредита»: Нарынское РП/.test(add3.error) && !DB.state.declared.cur.includes(t2.id),
    `автопроверка публикации: при полном круге «${text(ac0)[0].text}»; круг без Нарынского РП — «${text(ac1)[0].text}» (при двух кураторах — «${text(ac2)[0].text}»); публикация и «Добавить» в раскладку роли отказывают, роль «Руководство» (Головной офис в круге) проходит, новая плитка без выбранных ролей — «${text(ac1n)[0].text}»; круг вернули — публикация и добавление проходят (ДБ-104)`);

  // личная плитка — только на открытый вам отчёт: чужой личный отчёт и суженный круг
  DB.seed(); asUser('u1');
  const n0 = DB.TILES.length, d147 = Object.assign(DB.blankDraft('r-u2-agro'), { title:'чужой' });
  const p1 = DB.saveTile(d147, 'personal'), nT = DB.TILES.length, ac147 = DB.autocheck(d147), lst = DB.reportsFor(u1).some(x => x.r.id === 'r-u2-agro'), foreign = DB.ask(T('p-u2-agro'), u1, 'lead', {});
  asUser('u2'); const ac2own = DB.autocheck(Object.assign(DB.blankDraft('r-u2-agro'), { title:'моё', params:{ curator:'@me', date:'today' } }));
  const p2 = DB.saveTile(Object.assign(DB.blankDraft('r-u2-agro'), { title:'моё', params:{ curator:'@me', date:'today' } }), 'personal');
  DB.standCircle(true); asUser('c30');
  const pn = DB.saveTile(Object.assign(DB.blankDraft('r-portfolio'), { title:'моя ступень', main:{ col:'loan.count' }, params:{ curator:'@me', date:'today' } }), 'personal');
  const acn = DB.autocheck(DB.blankDraft('r-portfolio')), pool = DB.reportsFor(nar).some(x => x.r.id === 'r-portfolio'); DB.standCircle(false);
  ok(147, p1.error && /^Нельзя: отчёт «Мои кредиты Агрокредит с просрочкой больше 30 дней» не открыт вашему подразделению — это личный отчёт Бекова А\. Т\.$/.test(p1.error)
    && nT === n0 && !lst && ac147.checks.some(c => !c.ok && /не открыт вам/.test(c.text)) && !ac147.ok
    && foreign.state === 'noaccess' && /это личный отчёт Бекова А\. Т\.\.?$/.test(foreign.msg) && !/\.\.$/.test(foreign.msg)
    && ac2own.checks.some(c => c.ok && /открыт вам/.test(c.text)) && p2.tile && p2.tile.state === 'personal' && p2.tile.owner === 'u2'
    && pn.error && BM.test(pn.error) && acn.checks.some(c => !c.ok && /не открыт вам/.test(c.text)) && !pool,
    `личная плитка — только на открытый вам отчёт: Руководству чужой личный отчёт Бековой не открыт — «${p1.error}», в списке отчётов его нет, автопроверка пишет «не открыт вам»; ей самой открыт; куратору Нарынского РП при суженном круге общий отчёт тоже закрыт (ДБ-104)`);

  // два замка: круг отчёта данных не открывает; сначала круг, потом права роли
  DB.seed(); DB.USERS.push({ id:'c97', name:'Имущество Нарын', roles:['ast'], dept:'rp-nar' }); const ast = U('c97');
  const dl = DB.ask(T('cur-od'), ast, 'ast', {}), dlCat = DB.catalogFor(ast).find(x => x.t.id === 'cur-od'), dl3 = DB.ask(T('cur-rs'), U('u3'), 'prob', {});
  DB.standCircle(true); const both = DB.ask(T('cur-od'), ast, 'ast', {}), bothCat = DB.catalogFor(ast).find(x => x.t.id === 'cur-od');
  DB.standCircle(false); DB.USERS.pop();
  ok(148, dl.state === 'noaccess' && /Нельзя: объект «Кредит» не открыт вашей роли/.test(dl.msg) && !/подразделению/.test(dl.msg) && dl.value === undefined && !dl.rows
    && dlCat && /объект «Кредит» не открыт вашей роли/.test(dlCat.why) && dl3.state === 'noaccess' && /не открыт вашей роли/.test(dl3.msg)
    && both.state === 'noaccess' && BM.test(both.msg) && !/объект/.test(both.msg) && BM.test(bothCat.why),
    `два замка: при полном круге роль без права на «Кредит» всё равно получает «${dl.msg}» — круг данных не открывает; при суженном круге человек видит один замок, первым — круг: «${both.msg}» (ДБ-104)`);
  DB.seed();
})();

/* ---------- O (продолжение). Правка отчёта доходит до плитки ---------- */
(() => {
  const u1 = U('u1'), u2 = U('u2'), u3 = U('u3');
  const nums = r => String(r.value !== undefined ? r.value : r.values[0]);
  const ownerOf = id => DB.reportById(id).owner;

  // правка фильтра отчёта: версия отчёта растёт, кэш обесценен сразу, обе плитки на отчёте (Руководство и Куратор) показывают новое число
  DB.seed(); asUser('u1');
  const BKT = 'table(bucket;loan.count)', lb0 = DB.cachedAsk(T('lead-od'), u1, 'lead', {}), cb0 = DB.cachedAsk(T('cur-od'), u2, 'cur', {}), bk0 = DB.at('lead-od', BKT, 'u1', 'lead', {});
  const ed = DB.standReport('filter'), rb = DB.reportById('r-portfolio');
  const lb1 = DB.cachedAsk(T('lead-od'), u1, 'lead', {}), cb1 = DB.cachedAsk(T('cur-od'), u2, 'cur', {}), bk1 = DB.at('lead-od', BKT, 'u1', 'lead', {});
  const lbA = DB.answer(DB.questionOf(T('lead-od')), u1, 'lead', {}), cbA = DB.answer(DB.questionOf(T('cur-od')), u2, 'cur', {});
  const m1 = DB.reportChangedFor(T('lead-od'), 'u1'), m2 = DB.reportChangedFor(T('cur-od'), 'u2');
  const rv = DB.reportView('lead-od', u1, 'lead', {});
  const m1after = DB.reportChangedFor(T('lead-od'), 'u1'), m2after = DB.reportChangedFor(T('cur-od'), 'u2');
  const jr = DB.state.journal[0], noEdit = DB.reportEdit('r-none', { state:'archived' }, 'u11'), badEdit = DB.reportEdit('r-portfolio', { colour:'red' }, 'u11');
  const onRep = DB.tilesOfReport('r-portfolio').map(t => t.id).sort().join();
  ok(149, ed.ok && rb.version === 2 && rb.filter.length === 2 && rb.filter[1].f === 'overdueDays' && rb.filter[1].v === 30 && rb.changed.at === '11.10' && rb.changed.who === ownerOf('r-portfolio') && rb.changed.what === 'фильтр'
    && ed.tiles.map(t => t.id).sort().join() === onRep && ['cur-bal', 'cur-od', 'cur-risk', 'cur-rc', 'lead-bal', 'lead-od', 'lead-risk'].every(id => ed.tiles.some(t => t.id === id))
    && nums(lb0) !== nums(lb1) && nums(cb0) !== nums(cb1) && nums(lb1) === nums(lbA) && nums(cb1) === nums(cbA) && bk0[0][1] > 0 && bk1[0][1] === 0 && bk1[0][0] === '1–30'
    && /^отчёт изменён 11\.10 \(Шамшиев\): фильтр$/.test(rv.report.changedText) && m1 && m1.what === 'фильтр' && m2 && m2.what === 'фильтр' && m1after === null && m2after && m2after.what === 'фильтр'
    && jr.action === 'правка отчёта' && jr.who === ownerOf('r-portfolio') && new RegExp('в\\. 2 · фильтр · плиток на отчёте: ' + ed.tiles.length).test(jr.detail)
    && noEdit.error && badEdit.error && rb.version === 2,
    `правка фильтра отчёта «${rb.title}» (действующие, просрочка больше 30 дней) — версия ${rb.version}: ${ed.tiles.length} плиток на отчёте, «Руководство» и «Куратор» без перезапроса видят новое число (Таблица «Просрочено», срок «1–30 дней» ${bk0[0][1]} → ${bk1[0][1]} кредитов), кэш прежней версии не отвечает; отметка «${rv.report.changedText}» у Руководства снялась после открытия отчёта, у Куратора осталась; правка записана в журнал (ДБ-110, ДБ-113)`);

  // снята колонка отчёта: плитки с этой колонкой названы сломанными поимённо, соседи по отчёту отвечают; убран параметр, уровень строк
  DB.seed(); asUser('u1');
  const ec = DB.standReport('col'), verC = DB.reportById('r-portfolio').version, whatC = DB.reportById('r-portfolio').changed.what, P = 'В отчёте «Портфель кредитов» нет колонки «Сумма под риском (залог)».';
  const lr = DB.cachedAsk(T('lead-risk'), u1, 'lead', {}), cr = DB.cachedAsk(T('cur-risk'), u2, 'cur', {}), lod = DB.cachedAsk(T('lead-od'), u1, 'lead', {}), p181 = DB.cachedAsk(T('prob-181'), u3, 'prob', {});
  const brokenIds = ec.tiles.filter(t => DB.reportBroken(t)).map(t => t.id).sort().join();
  const last = DB.reportEdit('r-loans', { removeCol:'loan.count' }, 'u11'), lay = DB.composeLayout('u1', 'lead').includes('lead-risk');
  DB.arrangeHide('lead', 'lead-risk'); const layH = DB.composeLayout('u1', 'lead').includes('lead-risk');
  const ep = DB.reportEdit('r-portfolio', { removeParam:'curator' }, 'u11'), ll = DB.ask(T('lead-bal'), u1, 'lead', {}), cl = DB.ask(T('cur-bal'), u2, 'cur', {});
  const drb = o => Object.assign(DB.blankDraft('r-bucket'), { title:'x' }, o);
  const tp = DB.ask(drb({ main:{ pct:{ dim:'region', cells:['Ошская'] } } }), u1, 'lead', {}), pb = DB.ask(drb({ params:{ curator:'*', date:'today', npay:'7' } }), u1, 'lead', {});
  const ts = DB.ask(drb({ second:{ col:'loan.balance' } }), u1, 'lead', {}), tv = DB.ask(drb({ views:{ slice:{ dim:'region' } } }), u1, 'lead', {});
  const ff = DB.ask(withParams(DB.newDraft('r-form'), { date:'today' }), u1, 'lead', {});
  ok(150, ec.ok && verC === 2 && whatC === 'колонки'
    && lr.state === 'broken' && lr.msg === P && cr.state === 'broken' && cr.msg === P && lod.state === 'ok' && lod.value > 0 && lod.second.value > 0 && p181.state !== 'broken' && brokenIds === 'cur-risk,lead-risk'
    && last.error && /хотя бы одна/.test(last.error) && lay && !layH
    && ep.ok && ll.state === 'broken' && ll.msg === 'В отчёте «Портфель кредитов» нет параметра «Куратор».' && cl.state === 'broken' && /нет параметра «Куратор»/.test(cl.msg)
    && tp.state === 'broken' && /нет разреза «Область»/.test(tp.msg) && ts.state === 'broken' && /нет колонки «Остаток задолженности»/.test(ts.msg) && tv.state === 'ok'
    && pb.state === 'broken' && /нет параметра «npay»/.test(pb.msg)
    && ff.state === 'broken' && /В отчёте «Форма: портфель на отчётную дату» нет параметра «Дата»/.test(ff.msg),
    `снята колонка «Сумма под риском (залог)» из отчёта «Портфель кредитов»: «${lr.msg}» — на плитке Руководства и Куратора; «Просрочено» и «Кредиты 181+ дн.» на том же отчёте отвечают; плитка остаётся в раскладке и скрывается кнопкой; убран параметр «Куратор» — «${ll.msg}»; разреза доли, колонки второго числа и параметра, которых отчёт не объявлял, плитка не ждёт, а разрез умолчания вида плитку не ломает (ДБ-110, ДБ-126)`);

  // отчёт в архиве: плитки названы, новая плитка на нём не собирается; отчёт с плитками не удаляется, без плиток — удаляется; возврат — стенд и seed
  DB.seed(); asUser('u3');
  const before = DB.tilesOfReport('r-claims'), poolBefore = DB.reportsFor(u3).some(x => x.r.id === 'r-claims'), ea = DB.standReport('archive'), arch = DB.reportById('r-claims');
  const cl5 = before.map(t => DB.cachedAsk(t, u3, 'prob', {})), dl = DB.standReport('delete'), dl1 = DB.reportDelete('r-u2-agro');
  const pool = DB.reportsFor(u3).some(x => x.r.id === 'r-claims'), ax = DB.exportTile('prob-claims', 'pdf', 'prob'), logN = DB.state.exportLog.length;
  DB.R('r-tmp', { title:'Временный', obj:'loan', cols:['loan.count'], shelf:'personal', owner:'u1', circle:{ owner:'u1' } });
  const rows0 = DB.REPORTS.length, d2 = DB.reportDelete('r-tmp'), gone = !DB.reportById('r-tmp'), rows1 = DB.REPORTS.length;
  DB.R('r-tmp', { title:'Временный', obj:'loan', cols:['loan.count'], shelf:'personal', owner:'u1', circle:{ owner:'u1' } });
  DB.standReport('filter'); DB.reportView('lead-od', u1, 'lead', {});
  const rs = DB.standReport('reset'), rr = DB.reportById('r-claims'), rbk = DB.reportById('r-portfolio');
  const back = before.map(t => DB.ask(t, u3, 'prob', {}).state), seenGone = !Object.keys(DB.state.seen).some(k => k.endsWith('|r-portfolio')), tmpKept = !!DB.reportById('r-tmp');
  const stillThere = !!DB.reportById('r-claims');
  DB.seed();
  ok(151, before.length === 4 && ea.ok && arch.state === 'archived' && arch.changed.what === 'отправлен в архив' && arch.version === 2
    && cl5.every(r => r.state === 'broken' && r.msg === 'Отчёт «Требования» в архиве — плитка сломана.')
    && dl.refused && dl.msg === 'У отчёта 4 плитки — его можно только отправить в архив' && stillThere && dl1.refused && dl1.msg === 'У отчёта 1 плитка — его можно только отправить в архив'
    && poolBefore && !pool && ax.refused && logN === 0
    && d2.ok && gone && rows1 === rows0 - 1
    && rs.ok && rr.state === 'active' && rr.version === 1 && rr.changed === null && rbk.version === 1 && tmpKept && back.every(s => s !== 'broken') && seenGone
    && DB.reportById('r-claims').state === 'active' && !DB.reportById('r-tmp') && DB.state.exportLog.length === 0,
    `«Требования» ушли в архив: четыре плитки пишут «${cl5[0].msg}», в списке отчётов для новой плитки его нет, выгрузка сломанной плитки отказывает; удалить — «${dl.msg}»; личный отчёт без плиток удаляется; кнопка «Вернуть отчёты как были» возвращает каталог, собранный на ходу отчёт остаётся, seed() стирает всё (ДБ-110)`);

  // вывод показателя из реестра ломает плитки, которые берут эту колонку, и называет отчёт; соседи по отчёту отвечают; пустой охват и отказ в провале не падают
  DB.seed(); asUser('u1');
  DB.standWithdraw('loan.risk', true);
  const wt = DB.tilesOfReport('r-portfolio'), wm = 'Показатель «Сумма под риском (залог)» выведен из реестра статистики 11.10 — отчёт «Портфель кредитов» сломан, плитка вместе с ним.';
  const wr = wt.map(t => ({ id:t.id, r:DB.cachedAsk(t, u1, 'lead', {}), why:DB.reportBroken(t) })), wBad = wr.filter(x => x.r.state === 'broken').map(x => x.id).sort().join();
  const wd = DB.drill('lead-risk', u1, 'lead', {}), wg = DB.registryList(T('lead-risk'), u1, 'lead', {}), wod = DB.cachedAsk(T('lead-od'), u1, 'lead', {}), wodA = DB.answer(DB.questionOf(T('lead-od')), u1, 'lead', {});
  const raw = DB.answer(DB.questionOf(T('lead-risk')), u1, 'lead', {}), other = DB.ask(T('lead-bal'), u1, 'lead', {});
  DB.standWithdraw('loan.risk', false);
  const wb = wt.map(t => DB.cachedAsk(t, u1, 'lead', {}).state);
  const nar = U('c30'), dTasks = DB.drill('tasks', nar, 'cur', {});
  DB.USERS.push({ id:'c96', name:'Куратор без кредитов', roles:['cur'], dept:'rp-nar' }); const dNone = DB.drill('cur-od', U('c96'), 'cur', {}), dNoneB = DB.drill('cur-od', U('c96'), 'cur', {}, { d:'bucket', v:'1–30' }); DB.USERS.pop();
  ok(152, wt.length === 8 && wBad === 'cur-risk,lead-risk' && wr.filter(x => x.r.state === 'broken').every(x => x.r.msg === wm && x.why === wm)
    && wd.refused && wd.msg === wm && wg.msg === wm && wod.state === 'ok' && wod.value === wodA.value && wod.second.value > 0 && wr.find(x => x.id === 'lead-od').why === null
    && raw.state === 'broken' && /отчёт с этим показателем сломан/.test(raw.msg) && other.state === 'ok' && wb.every(s => s !== 'broken')
    && dTasks.number === null && dTasks.matches === false && dNone.number === 0 && dNone.matches && dNoneB.number === 0 && dNoneB.matches,
    `показатель «Сумма под риском (залог)» выведен из реестра: плитки, которые берут эту колонку (${wBad}), пишут «${wm}»; провал и реестр читают ту же причину; «Просрочено» на том же отчёте отвечает; вернули — отвечают все; провал по пустому охвату (ссылочная плитка «Мои задания» у куратора без заданий, плитки у куратора без кредитов) не падает: у пустого охвата числа узла нет, у куратора без кредитов это ноль, и список ему равен (ДБ-112)`);

  // выгрузка плитки по правилам отчётности: штамп с отчётом, версией и значениями параметров словами, строка журнала выгрузок
  DB.seed(); asUser('u2');
  const x1 = DB.exportTile('cur-od', 'pdf', 'cur'); asUser('u1');
  const x2 = DB.exportTile('cat-plan', 'xlsx', 'lead'); DB.standReport('filter'); DB.cachedAsk(T('lead-od'), u1, 'lead', {});
  const x4 = DB.exportTile('lead-od', 'xlsx', 'lead'), L = DB.state.exportLog;
  const has = (ex, re) => ex.stamp.some(s => re.test(s));
  ok(153, has(x1, /^Отчёт: «Портфель кредитов», версия 1, владелец Шамшиев/) && has(x1, /^Значения параметров: Куратор — я; Дата — сегодня$/) && has(x1, /^Паспорт: на 14:15/)
    && has(x1, /НЕ ЯВЛЯЕТСЯ ОФИЦИАЛЬНЫМ ДОКУМЕНТОМ/) && has(x1, /^Выгрузил: Бекова/) && x1.stamp[0] === 'Плитка: Просрочено' && x1.stamp.length === 7
    && has(x2, /^Значения параметров: Куратор — все; Период — прошлый месяц$/) && has(x4, /версия 2/)
    && L.length === 3 && L[2].tile === 'cur-od' && L[2].report === 'r-portfolio' && L[2].version === 1 && L[2].who === 'u2' && L[2].kind === 'pdf' && L[2].params.curator === '@me'
    && L[0].report === 'r-portfolio' && L[0].version === 2 && L[0].kind === 'xlsx' && DB.state.journal[0].action === 'выгрузил Excel',
    `выгрузка плитки «Просрочено» куратора: «${x1.stamp[1]}»; «${x1.stamp[2]}»; «не является официальным документом»; в журнале выгрузок отчётности ${L.length} строки — плитка, отчёт, версия, значения параметров, кто и когда; после правки отчёта штамп несёт версию 2 (ДБ-113)`);
  DB.seed();
})();

/* ---------- O (продолжение). Сторожа после ревью ---------- */
(() => {
  const u1 = U('u1'), u2 = U('u2'), fails = a => (a.checks || []).filter(c => !c.ok).map(c => c.text);
  // «похожий уже есть»: каждое «я» черновика — параметр отчёта, дата — того же рода (зашитая — та же); «взять его» несёт «я», дату и колонки
  DB.seed(); asUser('u2');
  DB.newReportDraft(); DB.rFilter('curator', '@me'); DB.rSet('date', 'closedDay');
  const rd = DB.rdraft, want = DB.answer(Object.assign({}, rd, { id:'q', format:'number' }), u2, 'cur', {}), sim = DB.similarReport(rd, u2);
  const sToday = DB.similarReport(Object.assign({}, rd, { date:'today' }), u2), sPme = DB.similarReport(Object.assign({}, rd, { inds:['loan.balance'], filter:[], date:'prevMonthEnd' }), u2);
  const tk = DB.rTake(sim.r.id), got = DB.ask(tk, u2, 'cur', {});
  DB.newReportDraft(); DB.rSet('obj', 'claim'); DB.rdraft.dims = ['phase', 'leadDept']; const sc = DB.similarReport(DB.rdraft, U('u3')); DB.rFilter('dept', '@myDept'); const sd = DB.similarReport(DB.rdraft, U('u3'));
  ok(154, sim.r.id === 'r-loans' && sToday.r.id === 'r-loans' && sPme.r.id === 'r-form' && DB.similarReport(Object.assign({}, rd, { inds:['loan.balance'] }), u2) === null && sc.r.id === 'r-claims' && sd === null
    && DB.draft === tk && tk.report === 'r-loans' && tk.params.curator === '@me' && tk.params.date === 'closedDay' && tk.main.col === 'loan.count' && tk.second === null
    && DB.autocheck(tk).ok && got.value === want.value && got.passport === want.passport && got.value > 0,
    `«похожий»: черновик «действующие, куратор = я, вчера» находит «${sim.r.title}», а не официальную форму без куратора и с зашитой датой; форма — только черновику на ту же дату; «моё подразделение» у требований — параметра нет, похожего нет; «взять его» — плитка с «я», датой и главным числом черновика, число ${got.value} = ответу черновика (ДБ-103, ДБ-101, ДБ-107); «Портфель кредитов» с разрезами итогу без разрезов не похож — разрезы сравниваются как есть (ДБ-126)`);
  // «% от итога группы»: Разрез по своему разрезу — доли ячеек; по разрезу глубже — доля внутри узла, провал сходится; доля в Таблице — колонки как есть; разрез с историей — отказ
  DB.seed(); asUser('u1');
  const on = (rid, o) => DB.autocheck(Object.assign(DB.blankDraft(rid), { title:'x' }, o));
  const inRows = Object.assign(DB.blankDraft('r-odmap'), { id:'pv', title:'x', main:{ col:'loan.overdue', pct:{ dim:'region', cells:['Ошская'] } } });
  const deeper = Object.assign({}, inRows, { id:'pv2', main:{ col:'loan.overdue', pct:{ dim:'bucket', cells:['31–90'] } } });
  const near = (a, b) => typeof a === 'number' && Math.abs(a - b) < 1e-6;
  const aR = DB.autocheck(inRows), aD = DB.autocheck(deeper), bR = DB.ask(inRows, u1, 'lead', {}), vR = DB.view(inRows, 'slice', { dim:'region' }, [], 'u1', 'lead', {});
  const dD = DB.drill(deeper, u1, 'lead', {}, { d:'region', v:'Ошская' }), oshR = vR.nodes.find(n => n.v === 'Ошская');
  const shD = Object.assign(DB.blankDraft('r-programs'), { id:'shd', title:'x', main:{ share:['loan.overdue', 'loan.balance'] } }); delete shD.views.table;
  const aT = DB.autocheck(shD), vT = DB.view(shD, 'table', null, [], 'u1', 'lead', {});
  DB.R('r-lact', { title:'Кредиты по состоянию договора', obj:'loan', cols:['loan.count'], dims:['lact'], params:{ date:{ name:'Дата' } } });
  const aH = on('r-lact', { main:{ pct:{ dim:'lact', cells:['действующий'] } } });
  ok(155, aR.ok && bR.state === 'ok' && near(bR.value, bR.num / bR.den * 100) && vR.state === 'ok' && vR.shares && oshR.cell && near(oshR.share, oshR.value / vR.total.v * 100)
    && vR.nodes.filter(n => n.cell).length === 1 && near(oshR.value, bR.num)
    && aD.ok && aD.preview.state === 'ok' && !dD.refused && dD.matches && dD.number > 0
    && aT.ok && vT.state === 'ok' && vT.sel.cols.join() === 'loan.overdue,loan.balance' && vT.table.rows.every(r => r.cells.length === 2) && !vT.share
    && !aH.ok && fails(aH).some(t => /у разреза «Состояние договора» значение меняется со временем — «% от итога группы» по нему не считается/.test(t)),
    `«% от итога группы» по области: на плитке ${bR.num} из ${bR.den}, Разрез по области — доли ячеек, «Ошская» отмечена; по сроку внутри области — доля узла, провал «Ошская» сходится: ${dD.sum} = ${dD.number}; у доли Таблица показывает колонки как есть; доля по разрезу с историей — отказ с причиной (ДБ-111, ДБ-109, ДБ-118)`);
  // правка плитки — той же автопроверкой; без главного числа — отказ; отчёт без даты гасит сдвиг, Ряд и Движение с причиной; база сдвига — первая допустимая
  DB.seed(); asUser('u11');
  // правка идёт на личных плитках, собранных в конструкторе
  asUser('u1'); const mk = (rid, o) => DB.saveTile(Object.assign(DB.blankDraft(rid), { title:'проба' }, o), 'personal').tile;
  const pcnt = mk('r-loans', {}), pheat = mk('r-odmap', {}); asUser('u11');
  const qx = DB.questionOf(Object.assign(DB.blankDraft('r-portfolio'), { main:null })), e0 = DB.editTile(pcnt.id, { main:null }), a0 = DB.ask(T(pcnt.id), u1, 'lead', {});
  const eH = DB.editTile(pheat.id, { views:{ map:{ dims:['region'] } } }), eD = DB.editTile('lead-risk', { params:{ curator:'*', date:'x' } }), eP = DB.editTile('lead-risk', { params:{ curator:'*', foo:'1' } });
  const heatOk = DB.ask(T(pheat.id), u1, 'lead', {}).state === 'ok' && DB.ask(T('lead-risk'), u1, 'lead', {}).state === 'ok' && T(pheat.id).version === 1 && T('lead-risk').version === 1;
  asUser('u1'); DB.reportEdit('r-portfolio', { removeParam:'date' });
  const gone = ['lead-od', 'lead-bal'].map(id => ({ b:DB.base(id, 'u1', 'lead', {}), v:DB.views(id, 'u1', 'lead') })), risk = DB.ask(T('lead-risk'), u1, 'lead', {});
  const nb = DB.base('lead-bal', u1, 'lead', {}), nv = DB.views('lead-bal', u1, 'lead'), nvw = k => nv.find(x => x.kind === k); DB.standReport('reset');
  DB.newReportDraft(); DB.rInd('loan.balance', true); DB.rInd('loan.count', false); DB.rSet('date', 'prevMonthEnd'); DB.rSet('format', 'shift'); DB.rTitle('Остаток к концу прошлого месяца');
  const noFmt = !('format' in DB.rdraft) && !('shift' in DB.rdraft), rcOk = DB.rcheck(DB.rdraft).ok, sp = DB.rSaveAndPlace(), sa = sp.tile && DB.ask(sp.tile, u1, 'lead', {});
  ok(156, qx === null && e0.error && /нет главного числа/.test(e0.error) && T(pcnt.id).main.col === 'loan.count' && T(pcnt.id).version === 1 && a0.state === 'ok'
    && eH.error && fails(eH).some(t => /карта — два разных разреза/.test(t)) && T(pheat.id).views.map.dims.join() === 'region,bucket' && eD.error && fails(eD).some(t => /такой даты нет: «x»/.test(t)) && /нет параметра «foo»/.test(eP.error) && heatOk
    && gone.every(g => g.b.state === 'ok' && g.b.value > 0 && /не объявил дату/.test(g.b.shift.none)
      && ['series', 'move'].every(k => { const x = g.v.find(y => y.kind === k); return x && !x.ok && /не объявил дату/.test(x.why); })) && risk.state === 'ok'
    && nb.state === 'ok' && nb.value > 0 && /не объявил дату/.test(nb.shift.none) && !nvw('series').ok && /не объявил дату/.test(nvw('series').why) && !nvw('move').ok && /не объявил дату/.test(nvw('move').why) && nvw('slice').ok
    && noFmt && rcOk && !sp.error && sp.tile.shift === 'yearStart' && sa.state === 'ok' && sa.shift && sa.shift.label === 'к началу года',
    `правка «Карта на одном разрезе», «дата x», чужой параметр, плитка без главного числа — отказ с причиной, плитка не тронута; отчёт без даты — у «Просрочено» и «Остатка» число остаётся, сдвиг, Ряд и Движение гаснут с причиной «${gone[0].v.find(y => y.kind === 'move').why}» (ДБ-115, ДБ-119); конструктор отчётности формата не принимает; «Сохранить и поставить» с датой «конец прошлого месяца» ставит базу сдвига «к началу года» (ДБ-113, ДБ-110, ДБ-107, ДБ-109, ДБ-115)`);
  // сигналы: снять можно у сломанной плитки и по одному; ночная проверка снимает сигналы изменённой и снятой плитки и пишет об этом строку
  DB.seed(); asUser('u1');
  const s0 = DB.signalToggle('lead-od', 'lead'); DB.reportEdit('r-portfolio', { removeParam:'curator' }); const brk = DB.reportBroken(T('lead-od')), off = DB.signalToggle('lead-od', 'lead'), n0 = DB.state.signals.length;
  DB.standReport('reset'); asUser('u2'); const sC = DB.signalToggle('cur-od', 'cur'); asUser('u1'); const sL = DB.signalToggle('lead-od', 'lead');
  const rm = DB.signalRemove(sL[0].id), rmOther = DB.signalRemove(sC[0].id), n1 = DB.state.signals.length;
  asUser('u11'); DB.editTile('lead-od', { title:'Просрочено в портфеле' }); asUser('u1'); const nc = DB.nightCheck(), n2 = DB.state.signals.length;
  asUser('u11'); DB.withdrawTile('cur-od'); asUser('u1'); const nc2 = DB.nightCheck();
  ok(157, s0[0].version === 1 && brk && off === false && n0 === 0 && rm && !rmOther && n1 === 3 && nc.length === 0 && nc.dropped.length === 1 && n2 === 2
    && nc.dropped[0].to === 'u1' && nc.dropped[0].text === 'Сигнал снят: плитка «Просрочено в портфеле» изменена' && nc2.dropped.length === 1 && nc2.dropped[0].to === 'u2'
    && /плитка «Просрочено» снята$/.test(nc2.dropped[0].text) && DB.state.signals.length === 0 && DB.state.notifs.length === 2 && /DB\.signalOff\('\$\{s\.id\}'\)">Снять</.test(src),
    `сигнал помнит версию плитки; у сломанной плитки 🔔 снимает сигналы; «Снять» в «На что я подписан» — по одному и только свои; ночная проверка: «${nc.dropped[0] && nc.dropped[0].text}», «${nc2.dropped[0] && nc2.dropped[0].text}» (ДБ-106, ДБ-113)`);
  // seed() возвращает плитки и стенд целиком; в каталог — не плитку на личном отчёте; выгрузка движка помнит роль, окно выгрузки — отдельный ключ
  DB.seed(); asUser('u11');
  DB.editTile('lead-bal', { title:'Остаток в портфеле', params:{ curator:'@me', date:'closedDay' } }); T('p-u2-agro').version = 7; DB.STAND.N = 5; DB.STAND.closedThrough = 0;
  const pub = DB.saveTile(Object.assign(DB.blankDraft('r-loans'), { title:'Новая' }), 'publish').tile; DB.seed();
  const clean = T('lead-bal').title === 'Остаток задолженности' && T('lead-bal').version === 1 && T('lead-bal').params.curator === '*' && !('date' in T('lead-bal').params)
    && T('p-u2-agro').version === 1 && DB.STAND.N === 150 && DB.STAND.closedThrough === -2 && !DB.tileById(pub.id);
  asUser('u2'); DB.propose('p-u2-agro'); asUser('u11'); const mv = DB.moveToCatalog('p-u2-agro');
  const xs = DB.exportTile('lead-bal', 'pdf', 'sys'), xa = DB.exportTile('lead-bal', 'pdf', 'adm');
  ok(158, clean && mv.error === 'Не перенесено: отчёт «Мои кредиты Агрокредит с просрочкой больше 30 дней» личный — сначала откройте его кругу в отчётности'
    && T('p-u2-agro').state === 'personal' && T('p-u2-agro').owner === 'u2' && DB.state.proposals.length === 1
    && xs.refused && /не открыт вашей роли/.test(xs.msg) && !xa.refused && xa.stamp.length > 0 && typeof DB.openExport === 'function' && DB.exportTile.length === 3
    && /DB\.openExport\('\$\{t\.id\}','pdf'\)/.test(src) && !/DB\.exportTile\(/.test(src),
    `seed() возвращает подпись, значения параметров и версии плиток, снимает созданные на ходу и возвращает стенд; плитка на личном отчёте в каталог не переносится — «${mv.error}»; выгрузка движка спрашивает от роли (у «Системного администратора» — «${xs.msg}»), окно выгрузки — свой ключ (ДБ-113, ДБ-31, ДБ-104, ДБ-36)`);
  DB.seed();
})();

/* ---------- P. Одна основа плитки и пять видов в полосе ---------- */
(() => {
  DB.seed(); asUser('u1');
  const u1 = U('u1'), near = (a, b) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 0.5;
  const at = (id, x, uid = 'u1', role = 'lead', panel = {}) => DB.at(id, x, uid, role, panel);
  const mk = (id, o) => DB.TILES.push(Object.assign({ id, title:id, kind:'overview', state:'published', owner:'catalog', version:1, second:null, tl:null, views:{} }, o));
  const vw = (id, uid = 'u1', role = 'lead', path) => Object.fromEntries(DB.views(id, uid, role, path).map(x => [x.kind, x]));
  // основа: главное число, сдвиг по главному, мини-ряд — 12 концов месяцев, последняя точка на дату отчёта
  const b = DB.base('lead-od', 'u1', 'lead'), mini = DB.mini('lead-od', 'u1', 'lead'), ak = DB.ask(T('lead-od'), u1, 'lead', {});
  mk('p-pme', { report:'r-portfolio', params:{ curator:'*', date:'prevMonthEnd' }, main:{ col:'loan.overdue' } });
  const bp = DB.base('p-pme', 'u1', 'lead'), mp = DB.mini('p-pme', 'u1', 'lead');
  ok(159, b.state === 'ok' && b.value === ak.value && b.value === at('lead-od', 'main') && near(b.shift.delta, b.value - b.shift.base) && !('rows' in b)
    && mini.vals.length === 12 && mini.vals[11] === b.value && near(mini.vals[10], b.shift.base) && mini.months[11] === 0
    && mp.vals.length === 12 && mp.months[11] === -1 && near(mp.vals[11], bp.value) && near(bp.value, b.shift.base),
    `основа «Просрочено»: главное ${DB.fmtVal(b.value, 'sum')}, сдвиг по главному ${DB.fmtVal(b.shift.delta, 'sum')} ${b.shift.label}; мини-ряд — 12 концов месяцев до даты отчёта (на «конец прошлого месяца» — до сентября) (ДБ-115)`);
  // сравнения нет — причина; у неполного периода плана — прогресс к плану
  mk('p-plan', { report:'r-issued', params:{ curator:'*', period:'curMonth' }, main:{ col:'loan.paidPlanned' } });
  mk('p-iss', { report:'r-issued', params:{ curator:'*', period:'curMonth' }, main:{ col:'loan.issued' } });
  mk('p-co', { report:'r-rsapps', params:{ curator:'*' }, main:{ col:'rsapp.late' } });
  mk('p-form', { report:'r-form', params:{}, main:{ col:'loan.balance' } });
  const pl = DB.base('p-plan', 'u1', 'lead'), is = DB.base('p-iss', 'u1', 'lead'), co = DB.base('p-co', 'u1', 'lead'), fo = DB.base('p-form', 'u1', 'lead'), pp = pl.shift.plan;
  ok(160, pl.state === 'ok' && /неполный период/.test(pl.shift.none) && pp.label === 'по плану' && pp.num === pl.value && near(pp.value, pp.num / pp.den * 100)
    && is.state === 'ok' && /неполный период/.test(is.shift.none) && !is.shift.plan
    && co.state === 'ok' && co.shift.none === 'показатель без истории' && DB.mini('p-co', 'u1', 'lead').off === 'показатель без истории'
    && fo.state === 'ok' && /не объявил дату/.test(fo.shift.none) && /не объявил дату/.test(DB.mini('p-form', 'u1', 'lead').off),
    `сдвига нет — причина вместо числа: неполный месяц «${pl.shift.none}» (у «Погашено по графику» — ${DB.fmtVal(pp.value, 'pct')} плана), без истории, отчёт без даты (ДБ-115)`);
  // второе число того же объекта на ту же дату; светофор висит на числе tl.on
  const bl = DB.base('lead-bal', 'u1', 'lead'), lsh = DB.base('lead-recov', 'u1', 'lead');
  DB.STAND.overdueUp = true; const up = DB.base('lead-od', 'u1', 'lead'); DB.STAND.overdueUp = false;
  DB.standWithdraw('loan.count', true); const wd = DB.base('lead-bal', 'u1', 'lead'), wdb = DB.reportBroken(T('lead-bal')); DB.standWithdraw('loan.count', false);
  ok(161, b.second.unit === 'pct' && b.second.label === 'портфеля' && b.second.num === b.value && b.second.den === bl.value && near(b.second.value, b.second.num / b.second.den * 100)
    && b.tl === 'yellow' && up.tl === 'red' && up.second.value > 5 && DB.tlText(T('lead-od')) === 'порог: красный > 5 %, жёлтый > 4 %'
    && bl.second.value === 1248 && bl.second.value === at('lead-bal', 'second') && bl.second.label === 'кредитов' && bl.tl === null
    && lsh.second.of && lsh.second.value === lsh.num && lsh.second.den === lsh.den
    && wd.state === 'ok' && wd.value === bl.value && wd.second.value === null && /выведен из реестра статистики/.test(wd.second.none) && wdb === null,
    `второе число: «Просрочено» ${DB.fmtVal(b.second.value, 'pct')} ${b.second.label}, светофор по второму — ${b.tl}, при росте — ${up.tl}; у доли главным второе — «${lsh.num} из ${lsh.den}»; выведенное второе — «—» с причиной, плитка отвечает (ДБ-116)`);
  // пять видов: доступность и причина; Движение с разрезом с историей в пути гаснет
  const vod = vw('lead-od'), vsh = vw('cat-brepsh'), vco = vw('p-co'), vfo = vw('p-form'), vtk = vw('tasks', 'u2', 'cur'), vno = vw('acc-unident', 'u2', 'cur');
  const pAt = vw('lead-bal', 'u1', 'lead', [{ dim:'lact', v:'действующий' }]).move, mvO = at('lead-bal', 'move(0)>region=Ошская');
  ok(162, Object.values(vod).every(x => x.ok && x.why === null) && Object.keys(vod).join() === 'series,slice,map,move,table'
    && !vsh.move.ok && vsh.move.why === 'у доли оборотов нет' && !vco.series.ok && vco.series.why === 'показатель без истории' && vco.slice.ok
    && !vfo.series.ok && /не объявил дату/.test(vfo.series.why) && !vfo.move.ok && /не объявил дату/.test(vfo.move.why) && vfo.slice.ok
    && !vtk.slice.ok && vtk.slice.why === 'очередь модуля не объявила разрезов' && !vtk.table.ok && !vtk.map.ok && DB.dimsFor('tasks').length === 0
    && Object.values(vno).every(x => !x.ok && /не открыт вашей роли/.test(x.why))
    && !pAt.ok && /обороты с ним не сходятся/.test(pAt.why) && at('lead-bal', 'move(0)>lact=действующий') === 'state:off' && mvO.end === at('lead-bal', 'main>region=Ошская'),
    `пять видов «Просрочено» доступны; погашенные называют причину: доля — «${vsh.move.why}», «${vco.series.why}», «${vfo.series.why}», у ссылочной — «${vtk.slice.why}», путь с разрезом с историей — «${pAt.why}» (ДБ-118, ДБ-119)`);
  // разрезы и колонки полосы: объявленные отчётом сверху, остальные — «на время просмотра»; панель и путь их убирают
  const rp = JSON.parse(JSON.stringify(DB.reportById('r-portfolio'))), dl = DB.dimsFor('lead-od'), cl = DB.colsFor('lead-od').filter(x => !x.share);   // «доля» — вычисляемая колонка, не показатель реестра: проверяется в блоке P ниже
  const dp = DB.dimsFor('lead-od', [{ dim:'bucket', v:'181+' }], { region:'Ошская' }).map(x => x.dim);
  const tv = DB.view('lead-od', 'slice', { dim:'dept' }, [], 'u1', 'lead', {}), rv = DB.view('lead-od', 'slice', { dim:'program' }, [], 'u1', 'lead', {});
  const tt = DB.view('lead-od', 'table', { dim:'program', cols:['loan.overdue', 'loan.lowCov'] }, [], 'u1', 'lead', {});
  DB.standReport('col'); const tr = DB.view('lead-od', 'table', { dim:'program', cols:['loan.overdue', 'loan.risk'] }, [], 'u1', 'lead', {}), trb = DB.reportBroken(T('lead-od')); DB.standReport('reset');
  ok(163, dl.slice(0, 5).map(x => x.dim).join() === rp.dims.join() && dl.slice(0, 5).every(x => !x.temp) && dl.slice(5).every(x => x.temp) && dl.length === DB.OBJ_DIMS.loan.length
    && dp[0] === 'category' && !dp.includes('bucket') && !dp.includes('region')
    && cl.slice(0, rp.cols.length).map(x => x.id).join() === rp.cols.join() && cl.slice(rp.cols.length).every(x => x.temp) && cl.some(x => x.temp) && cl.every(x => DB.IND[x.id].kind === 'stock')
    && tv.temp && /на время просмотра/.test(tv.passport) && !rv.temp && !/на время просмотра/.test(rv.passport) && tt.temp && tt.state === 'ok' && tr.temp && tr.state === 'ok' && trb === null,
    `разрезы полосы: ${dl.slice(0, 5).map(x => x.dim).join(', ')} из отчёта, ещё ${dl.length - 5} — на время просмотра; колонки Таблицы — того же рода; колонка, снятая с отчёта, делает вид временным, плитку не ломает (ДБ-126, ДБ-128)`);
  // путь крошек — условия «=»; число узла = сумме его списка; панель сужает; глубже — следующий разрез, дальше некуда — список
  const pnl = { region:'Ошская' }, path = [{ dim:'bucket', v:'181+' }];
  const sv = DB.view('lead-od', 'slice', { dim:'program' }, path, 'u1', 'lead', pnl), dr = sv.nodes.map(n => DB.drill('lead-od', u1, 'lead', pnl, { d:'program', v:n.v }, path));
  const whole = DB.drill('lead-od', u1, 'lead', pnl, undefined, path), rg = DB.registryList(T('lead-od'), u1, 'lead', pnl, path);
  const deep = DB.OBJ_DIMS.loan.filter(d => !['region', 'lpline'].includes(d)).map(d => ({ dim:d, v:'—' })), dv = DB.view('lead-od', 'slice', null, deep, 'u1', 'lead', pnl);
  ok(164, sv.nodes.length > 1 && dr.every((d, i) => d.matches && d.sum === sv.nodes[i].value) && near(sv.total.v, at('lead-od', 'main>bucket=181+', 'u1', 'lead', pnl))
    && whole.matches && whole.sum === sv.total.v && whole.path.length === 1 && rg.today === whole.list.length && rg.slice === whole.list.length
    && at('lead-od', 'main>bucket=181+', 'u1', 'lead', pnl) < at('lead-od', 'main>bucket=181+') && sv.next === 'category' && dv.sel.dim === 'lpline' && dv.next === null,
    `путь «181+» и панель «Ошская»: узлы ${sv.nodes.map(n => n.v).join(', ')} сходятся со списками, сумма ${DB.fmtVal(whole.sum, 'sum')} = числу пути; в реестре ${rg.today}; глубже — «${sv.next}», разрезы кончились — список (ДБ-123, ДБ-129)`);
  // выбор вида: выбор человека ?? его память ?? умолчание автора ?? первые разрезы отчёта
  DB.state.viewMem['u1|lead-od'] = { slice:{ dim:'program' }, series:{ points:24 } };
  const sMem = DB.view('lead-od', 'slice', null, [], 'u1', 'lead', {}).sel.dim, sSel = DB.view('lead-od', 'slice', { dim:'region' }, [], 'u1', 'lead', {}).sel.dim, serMem = DB.view('lead-od', 'series', null, [], 'u1', 'lead', {}).sel;
  DB.state.viewMem = {};
  const sDef = DB.view('lead-od', 'slice', null, [], 'u1', 'lead', {}).sel.dim, serDef = DB.view('lead-od', 'series', null, [], 'u1', 'lead', {}).sel, mDef = DB.view('lead-od', 'map', null, [], 'u1', 'lead', {}).sel.dims.join();
  const cMap = DB.view('cur-od', 'map', null, [], 'u2', 'cur', {}).sel.dims.join(), cTab = DB.view('cur-od', 'table', null, [], 'u2', 'cur', {}).sel, bad = DB.view('lead-od', 'slice', { dim:'нет такого' }, [], 'u1', 'lead', {}).sel.dim;
  ok(165, sDef === 'bucket' && sMem === 'program' && sSel === 'region' && serDef.points === 12 && serDef.of === 'second' && serMem.points === 24 && serMem.of === 'second' && mDef === 'region,bucket'
    && cMap === 'bucket,category' && cTab.dim === 'bucket' && cTab.cols.join() === 'loan.overdue' && bad === 'bucket',
    `умолчания вида: автор — «${sDef}», память человека — «${sMem}», его выбор — «${sSel}»; без умолчания автора — первые разрезы отчёта (${cMap}), Таблица — главное число (ДБ-127)`);
  // выражения DB.at: число, узлы [[v, значение]] и итог, ячейки карты, ряд, движение, строки Таблицы
  const sl = at('lead-od', 'slice(bucket)'), hm = at('lead-od', 'map(region,bucket)'), s12 = at('lead-od', 'series(12,second)'), s6 = at('lead-od', 'series(6)'), mv = at('lead-bal', 'move(0)');
  const tb = at('lead-bal', 'table(program;loan.count,loan.balance,loan.overdue)'), t1 = at('lead-bal', 'table(category;loan.count)'), sum = a => a.reduce((x, y) => x + y, 0);
  let unk = ''; try { at('lead-od', 'pie(bucket)'); } catch (e) { unk = e.message; }
  ok(166, typeof at('lead-od', 'main') === 'number' && sl.every(p => p.length === 2 && typeof p[1] === 'number') && near(sum(sl.map(p => p[1])), at('lead-od', 'slice(bucket).total')) && near(at('lead-od', 'slice(bucket).total'), b.value)
    && hm.length === 7 && near(sum(hm.flat()), b.value) && s12.length === 12 && s12[11][0] === b.second.value && s6.length === 6 && s6[5][0] === b.value
    && mv.end === bl.value && near(mv.start + sum(mv.inc.map(x => x.v)) - sum(mv.dec.map(x => x.v)) + mv.other, mv.end)
    && tb.length === 6 && tb.every(r => r[1].length === 3) && near(sum(tb.map(r => r[1][1])), bl.value) && t1.every(r => typeof r[1] === 'number') && at('lead-bal', 'table(category;loan.count).total') === bl.second.value
    && at('lead-od', 'shift') === b.shift.delta && at('lead-od', 'tl') === 'yellow' && at('lead-od', 'second.den') === bl.value && at('lead-bal', 'second.num') === null && /нет такого выражения/.test(unk),
    'DB.at: главное, второе и его доли, сдвиг, светофор; Разрез — [[значение, число]] и .total; Карта — ячейки; Ряд(N, второе); Движение — {start, end, inc, dec, other}; Таблица — строки, у одной колонки — число (ДБ-115, ДБ-118)');
  // «% от итога группы» в своём разрезе — знаменатель по ячейкам и их доли; провал по своему узлу — строки знаменателя
  mk('p-pct', { report:'r-borover', params:{ curator:'*' }, main:{ pct:{ dim:'bover', cells:['больше 0'] } }, tl:{ red:['>', 20], on:'main' }, views:{ slice:{ dim:'bover' } } });
  const pb = DB.base('p-pct', 'u1', 'lead'), po = DB.view('p-pct', 'slice', null, [], 'u1', 'lead', {}), pr = DB.view('p-pct', 'slice', { dim:'bregion' }, [], 'u1', 'lead', {});
  const pd = DB.drill('p-pct', u1, 'lead', {}, { d:'bover', v:'больше 0' }, [{ dim:'bregion', v:'Нарынская' }]), pdn = at('p-pct', 'slice(bover)>bregion=Нарынская').find(x => x[0] === 'больше 0')[1];
  ok(167, pb.unit === 'pct' && pb.second.of && pb.second.value === pb.num && pb.tl === 'red' && po.shares && po.total.v === pb.den && po.nodes.find(n => n.cell).value === pb.num && near(po.nodes.find(n => n.cell).share, pb.value)
    && !pr.shares && pr.temp && pr.nodes.every(n => n.value <= 100) && pd.matches && pd.sum === pdn && pdn > 0,
    `«% от итога группы» по своему разрезу: ${po.nodes.map(n => n.v + ' ' + n.value).join(' · ')} из ${po.total.v}, доли ячеек; провал по ячейке в пути «Нарынская» — ${pd.sum} строк знаменателя (ДБ-126, ДБ-123)`);
  // сигналы — по числу tl.on: пороги в процентах второго числа при главном в сомах
  DB.seed(); asUser('u1');
  const sg = DB.signalToggle('lead-od', 'lead'), nb = DB.signalToggle('lead-bal', 'lead'), last = Array.isArray(sg) ? sg.map(s => s.last) : [], st0 = Array.isArray(sg) ? sg.map(s => s.state).join() : '';
  DB.STAND.overdueUp = true; const fired = DB.nightCheck(); DB.STAND.overdueUp = false;
  ok(168, Array.isArray(sg) && sg.map(s => s.label).join() === '> 5 %,> 4 %' && last.every(v => v === b.second.value) && st0 === 'false,true' && sg.every(s => s.state === true)
    && fired.length === 1 && /^Просрочено > 5 % — 5,\d %/.test(fired[0].text) && nb.error && /нет порогов/.test(nb.error),
    `🔔 «Просрочено» ставит сигналы на долю портфеля (${sg.map(s => s.label).join(', ')}), при постановке ${DB.fmtVal(last[0], 'pct')}; ночная проверка — «${fired[0] && fired[0].text}» (ДБ-116, ДБ-106)`);
  // один компилятор, переходника нет, ответ плитку не меняет, ломает только главное, второе и разрез доли, кэш вида — свой ключ
  DB.TILES.push({ id:'p-share', title:'Доля просрочки', kind:'overview', state:'published', owner:'catalog', version:1, report:'r-portfolio', params:{ curator:'*' },
    main:{ share:['loan.overdue', 'loan.balance'] }, second:null, shift:'prevMonthEnd', tl:{ red:['>', 5], yellow:['>', 4] }, views:{} });
  const lo = T('p-share'), before = JSON.stringify(lo), qn = DB.questionOf(T('lead-od')), la = DB.ask(lo, u1, 'lead', {}), lq = DB.questionOf(lo);
  const v1 = DB.view('lead-od', 'slice', { dim:'program' }, [], 'u1', 'lead', {}), v2 = DB.view('lead-od', 'slice', { dim:'program' }, [], 'u1', 'lead', {}), v3 = DB.view('lead-od', 'slice', { dim:'region' }, [], 'u1', 'lead', {});
  DB.mini('lead-od', 'u1', 'lead'); const keys = [...DB.state.cache.keys()];
  DB.reportEdit('r-portfolio', { removeCol:'loan.count' }, DB.reportById('r-portfolio').owner);
  const rbB = DB.reportBroken(T('lead-bal')), rbO = DB.reportBroken(T('lead-od')), bbS = DB.base('lead-bal', 'u1', 'lead').state; DB.seed();
  ok(169, JSON.stringify(lo) === before && !('legacyToTile' in DB) && !('tileModel' in DB) && lq.share.join() === 'loan.overdue,loan.balance' && !('tl' in lq) && !('shift' in lq)
    && la.unit === 'pct' && la.second.of && la.second.value === la.num && qn.format === 'number' && qn.inds.join() === 'loan.overdue' && !('tl' in qn) && !('shift' in qn) && qn.filter.some(c => c.f === 'lact')
    && la.format === 'shift' && la.tl === 'yellow' && v1 === v2 && v1 !== v3 && keys.filter(k => /view§slice§/.test(k)).length === 2 && keys.some(k => /§mini$/.test(k))
    && /нет колонки «Кредитов»/.test(rbB) && rbO === null && bbS === 'broken',
    'вопрос собирает один компилятор: светофор и сдвиг в вопрос не идут; переходника старой формы нет, плитка-доля на основе отвечает «num из den» и не меняется; вид и мини-ряд — свои ключи кэша; плитку ломают главное и второе число, не колонка вида (ДБ-115, ДБ-116, ДБ-128)');
  // основа плитки в HTML: главное, сдвиг, второе число и светофор на нём, мини-ряд, пять кнопок видов на каждой плитке каждой раскладки
  DB.seed(); asUser('u1');
  const kindsOf = h => [...h.matchAll(/<button class="vb([^"]*)"([^>]*)>([^<]+)<\/button>/g)].map(x => ({ name:x[3], off:/\boff\b/.test(x[1]), tip:(x[2].match(/data-tip="([^"]*)"/) || [])[1] || '' }));
  const hod = DB.tileHTML('lead-od', 'u1', 'lead'), hln = DB.tileHTML('lead-risk', 'u1', 'lead'), htk = DB.tileHTML('tasks', 'u1', 'lead'), hbk = DB.tileHTML('lead-od', 'u1', 'lead', { region:'Ошская' });
  const ko = kindsOf(hod), kl = kindsOf(hln), kt = kindsOf(htk), NAMES = 'Ряд,Разрез,Карта,Движение,Таблица';
  const sweep = DB.ROLES.flatMap(r => { const u = DB.USERS.find(x => x.roles.includes(r.id)); return u ? DB.composeLayout(u.id, r.id).filter(k => !/^[sx]:/.test(k)).map(k => ({ k, h:DB.tileHTML(k, u.id, r.id) })) : []; });
  const bare = sweep.filter(x => kindsOf(x.h).map(v => v.name).join() !== NAMES || kindsOf(x.h).some(v => v.off && !v.tip) || /class="tile[^"]*\b(w2|h2)\b/.test(x.h) || /Развернуть|⤢/.test(x.h));
  ok(170, ko.map(v => v.name).join() === NAMES && ko.every(v => !v.off) && /class="sub second"><span class="dot" style="background:var\(--st-warn\)"><\/span><span><b>[\d,]+\s%<\/b> портфеля<\/span>/.test(hod)
    && /tl-note muted">жёлтый · порог: красный &gt;\s5\s%/.test(hod) && /class="tile tl-yellow"/.test(hod) && /sub shift up-bad">▲ [\d,]+ млн к 30\.09/.test(hod) && (hod.match(/<rect /g) || []).length === 12
    && /<div class="mini" onclick="event\.stopPropagation\(\);DB\.openView\('lead-od','series'\)">/.test(hod) && /<div class="vbar"><button class="vb" onclick="event\.stopPropagation\(\);DB\.openView\('lead-od','series'\)">Ряд/.test(hod)
    && kl.find(v => v.name === 'Движение').off && /потоки/.test(kl.find(v => v.name === 'Движение').tip) && kl.filter(v => v.off).length === 1
    && /class="mini off" data-tip="показатель без истории"/.test(htk) && kt.map(v => v.name).join() === NAMES && kt.every(v => v.off && v.tip) && !/<svg/.test(htk)
    && sweep.length > 100 && bare.length === 0 && kindsOf(hbk).map(v => v.name).join() === NAMES,
    `плитка «Просрочено»: «${(hod.match(/<div class="big">([^<]+)</) || [])[1]}», сдвиг, «${((hod.match(/<span><b>([^<]+)<\/b> ([^<]+)<\/span>/) || []).slice(1)).join(' ')}» со светофором на втором, мини-ряд из 12 точек, пять кнопок «${NAMES.replace(/,/g, ' · ')}»; у «Суммы под риском» «Движение» погашено с причиной; у «Мои задания» все пять погашены, ряда нет; ${sweep.length} плиток всех раскладок без размеров и «Развернуть» (ДБ-115, ДБ-116, ДБ-118, ДБ-119)`);
  // раскрытие: в ряду одна плитка, в разных рядах по одной, не хранится; в странице нет «Развернуть», ⤢, размеров плиток главной и фильтра форматов
  DB.openView('lead-od', 'map'); DB.openView('lead-issued', 'table'); const one = Object.keys(DB.state.open).sort().join() + ':' + DB.state.open['lead-issued'].kind;
  DB.closeView('lead-issued'); DB.closeView('lead-od'); const none = Object.keys(DB.state.open).length; DB.openView('lead-od', 'series'); DB.seed();
  const cat = src.slice(src.indexOf('function renderCatalog('), src.indexOf('/* ---------- «+ Плитка»')), reg = src.slice(src.indexOf('function renderRegistry('), src.indexOf('function renderLayouts('));
  ok(171, one === 'lead-issued,lead-od:table' && none === 0 && Object.keys(DB.state.open).length === 0 && !/Развернуть|⤢|DB\.expand|catFormat|openExpand/.test(src)
    && !/FORMAT_NAMES|SIZE\[/.test(cat) && /Основа/.test(cat) && /Основа/.test(reg) && !/FORMAT_NAMES/.test(reg),
    'раскрыто по одной плитке в ряду, ✕ закрывает, seed() сбрасывает; в странице нет «Развернуть», ⤢, DB.expand и фильтра форматов; каталог и реестр показывают «Основа» вместо формата и размера (ДБ-117, ДБ-118)');
  DB.seed();
})();

/* ---------- P (продолжение). Полоса: место в сетке, выбор, путь, «☰ N» ---------- */
(() => {
  DB.seed(); asUser('u1'); DB.setTab('role', 'lead');
  const u1 = U('u1'), near = (a, b) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 0.5, sum = a => a.reduce((x, y) => x + y, 0);
  const at = (id, x) => DB.at(id, x, 'u1', 'lead', {}), V = (id, kind, o, sel) => DB.view(id, kind, sel, o ? o.path : [], 'u1', 'lead', {});
  const open = () => Object.keys(DB.state.open).sort().join(), tab = html => html.replace(/<svg[\s\S]*?<\/svg>/g, '');
  // место полосы: после последней плитки ряда сетки; секция — на всю строку, заглушка — ячейка, свёрнутая секция не рисуется
  const L = ['s:A', 't1', 't2', 't3', 't4', 't5', 't6', 's:B', 't7', 't8', 'x:t9', 't10', 't11'];
  const sl = (cols, ks, col, ren) => ks.map(k => DB.stripSlot(L, k, cols, col || {}, ren)).join();
  ok(172, sl(4, ['t1', 't4', 't5', 't6', 't7', 'x:t9', 't10', 't11', 's:A']) === '4,4,6,6,11,11,11,12,-1'
    && sl(2, ['t1', 't2', 't3', 't5', 't7', 'x:t9', 't10', 't11']) === '2,2,4,6,9,11,11,12'
    && sl(1, ['t1', 't6', 't7', 'x:t9', 't11']) === '1,6,8,10,12'
    && [['t4', 4, 3], ['x:t9', 4, 2], ['x:t9', 2, 0], ['t10', 2, 1], ['t7', 1, 0]].every(([k, c, col]) => DB.stripPlace(L, k, c).col === col)
    && DB.stripPlace(L, 't11', 4).row === 3 && DB.stripPlace(L, 't11', 4).cols === 4,
    'полоса идёт после последней плитки ряда сетки: в 4, 2 и 1 колонку, секция занимает строку, заглушка «x:» — ячейку; колонка плитки в ряду — для стрелки (ДБ-117, ДБ-129)');
  ok(173, DB.stripSlot(L, 't7', 4, { 's:B':true }) === -1 && DB.stripSlot(L, 't11', 4, { 's:B':true }) === -1 && DB.stripSlot(L, 't6', 4, { 's:B':true }) === 6
    && DB.stripSlot(L, 't1', 4, { 's:A':true }) === -1 && DB.stripSlot(L, 't7', 4, { 's:A':true }) === 11
    && DB.stripSlot(['s:A', 'a', 'b', 's:B', 'c', 'd', 's:C', 'e'], 'a', 4, { 's:B':true }) === 2 && DB.stripSlot(['s:A', 'a', 'b', 's:B', 'c', 'd', 's:C', 'e'], 'e', 4, { 's:B':true }) === 7
    && DB.stripSlot(L, 't1', 4, {}, k => k !== 't3') === 5 && DB.stripSlot(L, 't3', 4, {}, k => k !== 't3') === -1 && DB.stripSlot(L, 'нет', 4) === -1 && DB.stripSlot([], 't1', 4) === -1,
    'плитки свёрнутой секции и не нарисованные ключи в ряд не считаются и сами полосу не получают; пустая раскладка и чужой ключ — места нет (ДБ-117)');
  // один раскрытый вид на ряд, в разных рядах — по одному; вид меняется кнопкой, путь остаётся
  const lay = DB.composeLayout('u1', 'lead'), row = k => DB.stripSlot(lay, k, 4);
  DB.openView('lead-od', 'slice'); DB.openView('lead-issued', 'table'); const two = open();
  DB.openView('lead-risk', 'map'); const same = open();
  DB.openView('lead-claims', 'series'); const three = open();
  DB.openView('lead-risk', 'table'); const kind2 = DB.state.open['lead-risk'].kind;
  DB.deeper('lead-risk', 'bucket', '181+'); DB.openView('lead-risk', 'slice'); const kept = DB.state.open['lead-risk'].path.length;
  DB.closeView('lead-issued'); const closed = open();
  ok(174, row('lead-od') === row('lead-risk') && row('lead-od') === row('lead-bal') && row('lead-od') !== row('lead-issued') && row('lead-claims') !== row('lead-od') && row('lead-claims') !== row('lead-issued')
    && two === 'lead-issued,lead-od' && same === 'lead-issued,lead-risk' && three === 'lead-claims,lead-issued,lead-risk' && kind2 === 'table' && kept === 1 && closed === 'lead-claims,lead-risk'
    && DB.state.open['lead-claims'].path.length === 0 && DB.openView('lead-claims', 'нет') === null,
    `одна полоса на ряд: «Просрочено» и «Сумма под риском» в одном ряду — вторая заменила первую; плитки в разных рядах держат по полосе (${three}); кнопка вида меняет вид, путь остаётся (ДБ-117)`);
  // вглубь: путь, следующий разрез, шаг назад по крошке
  DB.seed(); asUser('u1'); DB.setTab('role', 'lead'); DB.openView('lead-od', 'slice'); const o = DB.state.open['lead-od'];
  const v0 = V('lead-od', 'slice', o, o.sel), n181 = v0.nodes.find(n => n.v === '181+'), free0 = DB.dimsFor('lead-od', [], {}).map(x => x.dim);
  const d1 = DB.deeper('lead-od', 'bucket', '181+'), v1 = V('lead-od', 'slice', o, o.sel), free1 = DB.dimsFor('lead-od', o.path, {}).map(x => x.dim);
  const pick = v1.nodes.find(n => n.value), d2 = DB.deeper('lead-od', 'category', pick.v), v2 = V('lead-od', 'slice', o, o.sel);
  const dup = DB.deeper('lead-od', 'bucket', '1–30'), still = JSON.stringify(o.path), x1 = DB.crumb('lead-od', 1), at1 = JSON.stringify(o.path) + o.sel.dim, x0 = DB.crumb('lead-od', 0);
  ok(175, d1.ok && d1.next === 'category' && JSON.stringify(d1.path) === '[{"dim":"bucket","v":"181+"}]' && free1.join() === free0.filter(d => d !== 'bucket').join()
    && v1.sel.dim === 'category' && near(v1.total.v, n181.value) && near(sum(v1.nodes.map(n => n.value)), n181.value) && near(at('lead-od', 'slice(category).total>bucket=181+'), n181.value)
    && d2.ok && d2.path.length === 2 && v2.sel.dim === free1.filter(d => d !== 'category')[0] && near(v2.total.v, pick.value)
    && dup.error && /уже в пути/.test(dup.error) && /category/.test(still) && at1 === '[{"dim":"bucket","v":"181+"}]category' && x1.ok && o.path.length === 0 && o.sel.dim === 'bucket' && x0.ok,
    `клик по строке «181+» — путь [срок = 181+], число сходится (${DB.fmtVal(n181.value, 'sum')}), следующий разрез «${DB.DIMS[d1.next].name}» предложен первым; повторный срок отказан, крошка 1 и 0 возвращают путь и выбор (ДБ-123)`);
  // «☰ N» совпадает с длиной списка, число узла — с суммой списка при любом пути
  const scan = (id, kind, sel, path) => { const r = DB.view(id, kind, sel, path, 'u1', 'lead', {}), out = [];
    if (r.nodes) r.nodes.forEach(n => out.push([{ d:r.sel.dim, v:n.v }, n.cnt, n.value]));
    if (r.table) r.table.rows.forEach(w => out.push([{ d:r.table.d, v:w.v }, w.cnt, null]));
    if (r.heat) r.heat.rows.forEach((a, i) => r.heat.cols.forEach((b, j) => out.push([{ d:r.heat.d1, v:a, d2:r.heat.d2, v2:b }, r.heat.cnt[i][j], r.heat.cells[i][j]])));
    if (r.cnt !== undefined) out.push([null, r.cnt, kind === 'slice' ? r.total.v : null]);
    return out.slice(0, 7).concat(out.slice(-1)).map(([nd, c, val]) => { const dr = DB.drill(id, u1, 'lead', {}, nd, path); return { refused:!!dr.refused, same:dr.refused ? dr.count === c : dr.list.length === c, num:dr.refused || val === null || dr.number === null || (dr.matches && near(dr.sum, val)) }; }); };
  const P1 = [{ dim:'bucket', v:'181+' }], P2 = P1.concat([{ dim:'region', v:'Чуйская' }]);
  const all = [[], P1, P2].flatMap(p => [scan('lead-od', 'slice', { dim:'region' }, p), scan('lead-od', 'slice', { dim:'bucket' }, p.filter(x => x.dim !== 'bucket')),
    scan('lead-od', 'map', { dims:['region', 'category'] }, p.filter(x => x.dim !== 'region')), scan('lead-od', 'table', { dim:'program' }, p), ]).flat().concat(scan('lead-claims', 'slice', null, []), scan('lead-claims', 'table', null, []));
  DB.openView('lead-od', 'slice'); DB.deeper('lead-od', 'bucket', '181+'); const hs = tab(DB.stripHTML('lead-od', 'u1', 'lead'));
  const btn = [...hs.matchAll(/DB\.whoAt\('lead-od','([^']+)','([^']+)'\)">☰ ([\d\s]+)</g)].map(x => [x[1], x[2], +x[3].replace(/\s/g, '')]);
  const byBtn = btn.map(([d, v, n]) => { const dr = DB.drill('lead-od', u1, 'lead', {}, { d, v }, [{ dim:'bucket', v:'181+' }]); return dr.refused || dr.list.length === n; });
  ok(176, all.length > 70 && all.every(x => x.same) && all.every(x => x.num) && all.filter(x => x.refused).length < all.length / 3
    && btn.length >= 3 && byBtn.every(Boolean) && /DB\.whoAt\('lead-od'\)">☰ [\d\s]+ Кто в этом числе/.test(hs),
    `«☰ N» у строки, ступени, ячейки и таблицы равно длине списка этого узла, число узла — сумме списка, на корне и на пути в один и два шага (проверено узлов: ${all.length}, отказов выше порога ${all.filter(x => x.refused).length}); в HTML полосы то же число на кнопке (ДБ-123, ДБ-105)`);
  // разрез на время просмотра, заявка соседу, управление каждого вида
  DB.seed(); asUser('u1'); DB.setTab('role', 'lead'); DB.openView('lead-od', 'slice');
  const sTemp = DB.viewSet('lead-od', 'dim', 'dept'), rt = V('lead-od', 'slice', DB.state.open['lead-od'], DB.state.open['lead-od'].sel), ht = tab(DB.stripHTML('lead-od', 'u1', 'lead'));
  const sReq = DB.viewSet('lead-od', 'dim', 'lpline'), hq = tab(DB.stripHTML('lead-od', 'u1', 'lead')), sBad = DB.viewSet('lead-od', 'dim', 'нет');
  const own = DB.viewSet('lead-od', 'dim', 'region'), ro = V('lead-od', 'slice', DB.state.open['lead-od'], DB.state.open['lead-od'].sel);
  DB.openView('lead-od', 'series'); const hSer = tab(DB.stripHTML('lead-od', 'u1', 'lead')), pts = DB.viewSet('lead-od', 'points', '24'), r24 = V('lead-od', 'series', DB.state.open['lead-od'], DB.state.open['lead-od'].sel);
  const ofS = DB.viewSet('lead-od', 'of', 'second'), rs2 = V('lead-od', 'series', DB.state.open['lead-od'], DB.state.open['lead-od'].sel), ptsBad = DB.viewSet('lead-od', 'points', '7');
  DB.openView('lead-od', 'move'); const hMv = tab(DB.stripHTML('lead-od', 'u1', 'lead')), mv = DB.viewSet('lead-od', 'month', '-1'), rmv = V('lead-od', 'move', DB.state.open['lead-od'], DB.state.open['lead-od'].sel);
  DB.openView('lead-od', 'map'); const hMap = tab(DB.stripHTML('lead-od', 'u1', 'lead')), dm = DB.viewSet('lead-od', 'dims', ['program', 'region']), rm = V('lead-od', 'map', DB.state.open['lead-od'], DB.state.open['lead-od'].sel);
  const swap = DB.viewSet('lead-od', 'dims', ['region', 'region']), rsw = V('lead-od', 'map', DB.state.open['lead-od'], DB.state.open['lead-od'].sel);
  DB.openView('lead-od', 'table'); const hTb = tab(DB.stripHTML('lead-od', 'u1', 'lead')), c5 = DB.viewSet('lead-od', 'cols', ['loan.balance', 'loan.count', 'loan.overdue', 'loan.risk', 'loan.restr']), cMix = DB.viewSet('lead-od', 'cols', ['loan.balance', 'loan.issued']);
  const c2 = DB.viewSet('lead-od', 'cols', ['loan.overdue', 'loan.balance']), rtb = V('lead-od', 'table', DB.state.open['lead-od'], DB.state.open['lead-od'].sel), c0 = DB.viewSet('lead-od', 'cols', []);
  ok(177, sTemp.ok && rt.temp && / · разрез на время просмотра$/.test(rt.passport) && /<optgroup label="Разрезы отчёта">[\s\S]*<optgroup label="Остальные — на время просмотра">[\s\S]*<option value="dept" selected>Подразделение/.test(ht) && /разрез на время просмотра/.test(ht)
    && sReq.ok && /<option value="lpline" selected>⚑ Линия/.test(hq) && /class="ctl">[\s\S]*class="req"/.test(hq) && sBad.error && own.ok && !ro.temp && !/разрез на время просмотра/.test(ro.passport),
    'выбор разреза: сверху разрезы отчёта, ниже остальные «на время просмотра» с паспортом; заявка соседу помечена ⚑ в списке и у выбранного; чужого разреза нет (ДБ-126)');
  ok(178, /Точек[\s\S]*class="on"[^>]*>12<[\s\S]*Число[\s\S]*главное[\s\S]*второе/.test(hSer) && pts.ok && r24.series.points.length === 24 && ofS.ok && rs2.series.points.at(-1).vals[0] === DB.base('lead-od', 'u1', 'lead').second.value && ptsBad.error
    && /Месяц[\s\S]*class="on"[^>]*>текущий<[\s\S]*прошлый/.test(hMv) && mv.ok && rmv.move.start !== undefined && rmv.sel.month === -1
    && (hMap.match(/DB\.viewPick\('lead-od','dims',this\)/g) || []).length === 2 && dm.ok && rm.heat.d1 === 'program' && rm.heat.d2 === 'region' && swap.ok && rsw.heat.d1 !== rsw.heat.d2
    && /Колонки:[\s\S]*type="checkbox" value="loan\.count" checked/.test(hTb) && c5.error && /Не больше четырёх/.test(c5.error) && cMix.error && /Остаток и поток/.test(cMix.error) && c2.ok && rtb.table.cols.map(c => c.id).join() === 'loan.balance,loan.overdue' && c0.error,
    'управление видом: Ряд — 6/12/24 и главное/второе, Движение — текущий/прошлый месяц, Карта — два разреза (одинаковые меняются местами), Таблица — разрез и до четырёх колонок одного рода, остальное отказано с причиной (ДБ-118, ДБ-128)');
  // некуда глубже — клик открывает список; пока есть куда — ведёт глубже; панель фильтров и путь — в паспорте и в «Работать со списком»
  DB.seed(); asUser('u1'); DB.setTab('role', 'lead'); DB.openView('lead-claims', 'slice'); const oc = DB.state.open['lead-claims'];
  const hc0 = tab(DB.stripHTML('lead-claims', 'u1', 'lead')); DB.deeper('lead-claims', 'phase', 'Досудебная');
  const rc1 = V('lead-claims', 'slice', oc, oc.sel), dl = rc1.nodes.find(n => n.cnt > 0), dd = DB.deeper('lead-claims', 'leadDept', dl.v), rc2 = V('lead-claims', 'slice', oc, oc.sel);
  const hc2 = tab(DB.stripHTML('lead-claims', 'u1', 'lead')), leaf = rc2.nodes.find(n => n.cnt > 0), wl = DB.whoAt('lead-claims', rc2.sel.dim, leaf.v);
  const lone = DB.deeper('lead-claims', 'region', leaf.v), vl = Object.fromEntries(DB.views('lead-claims', 'u1', 'lead', DB.state.open['lead-claims'].path).map(x => [x.kind, x])), lk0 = DB.state.open['lead-claims'].kind;
  DB.openView('tasks', 'slice'); const vt = DB.view('tasks', 'slice', null, [], 'u1', 'lead', {});
  ok(179, /class="step"[^>]*onclick="event\.stopPropagation\(\);DB\.deeper\('lead-claims','phase'/.test(hc0) && !/class="step"[^>]*onclick="event\.stopPropagation\(\);DB\.whoAt/.test(hc0) && rc1.sel.dim === 'leadDept' && rc1.next === 'region' && dd.ok && rc2.next === null && rc2.sel.dim === 'region'
    && /class="bar-row[^"]*"[^>]*onclick="event\.stopPropagation\(\);DB\.whoAt\('lead-claims','region'/.test(hc2) && !/DB\.deeper\(/.test(hc2) && !wl.refused && wl.list.length === leaf.cnt && wl.path.length === 2 && wl.matches
    && lone.ok && lone.next === null && !vl.slice.ok && /разрезы объекта кончились/.test(vl.slice.why) && !vl.map.ok && lk0 !== 'slice' && vt.state === 'off' && /не объявила разрезов/.test(vt.msg),
    `когда разрезы кончились (путь «${[dl.v, leaf.v].join(' › ')}» после «Досудебная»), клик по строке открывает список с путём (${wl.list.length} стр.), а не ведёт глубже; после последнего шага вид, которому разрезов не хватает, погашен и полоса переходит на доступный; у ссылочной плитки без разрезов вид погашен (ДБ-123)`);
  // паспорт и крошки полосы, панель фильтров, «Работать со списком» с путём
  DB.seed(); asUser('u1'); DB.setTab('role', 'lead'); DB.state.panel = { region:'Ошская' }; DB.openView('lead-od', 'slice'); DB.deeper('lead-od', 'bucket', '181+');
  const po = DB.state.open['lead-od'], hp = tab(DB.stripHTML('lead-od', 'u1', 'lead')), rp = DB.view('lead-od', 'slice', po.sel, po.path, 'u1', 'lead', { region:'Ошская' });
  const fx = DB.viewSet('lead-od', 'dim', 'region'), wlp = DB.whoAt('lead-od', 'category', rp.nodes.find(n => n.cnt).v), rg = DB.registryAt('lead-od'), dr0 = DB.drill('lead-od', u1, 'lead', { region:'Ошская' }, null, po.path);
  const arrows = [0, 3].map(i => { DB.state.open = {}; DB.openView(['lead-bal', 'lead-od', 'lead-borr', 'lead-risk'][i], 'slice'); return (DB.stripHTML(['lead-bal', 'lead-od', 'lead-borr', 'lead-risk'][i], 'u1', 'lead').match(/class="strip-arrow" style="left:([^"]+)"/) || [])[1]; });
  ok(180, /<div class="crumbs"><button class="linky"[^>]*onclick="DB\.crumb\('lead-od',0\)">Просрочено<\/button> <span class="sep">›<\/span> <b>181\+<\/b><\/div>/.test(hp)
    && /class="passport">[^<]*фильтр: Ошская[^<]* · путь: 181\+</.test(hp) && fx.error && /фильтром панели/.test(fx.error) && !DB.dimsFor('lead-od', po.path, { region:'Ошская' }).some(x => x.dim === 'region')
    && !wlp.refused && wlp.path.length === 1 && rg.slice === dr0.list.length && rg.today >= rg.slice && /v\.visible|видно/.test(rp.passport) && /фильтр: Ошская/.test(rp.passport)
    && /\* 0\.5 \+ 0px/.test(arrows[0]) && /\* 3\.5 \+ 36px/.test(arrows[1]) && /strip-f">[\s\S]*DB\.registryAt\('lead-od'\)">Работать со списком/.test(hp),
    `крошки «Просрочено › 181+» ведут назад, паспорт полосы — «…фильтр: Ошская · путь: 181+», разрез из панели в полосе не предлагается; «Работать со списком» несёт путь (${rg.slice} в срезе из ${rg.today} в реестре); стрелка стоит под колонкой своей плитки (ДБ-129, ДБ-117)`);
  DB.seed();
})();

/* ---------- P (продолжение). Клик по числу, память видов, раскрытие не хранится, закрепление на своём экране ---------- */
(() => {
  DB.seed(); asUser('u1'); DB.setTab('role', 'lead');
  const V = (id, kind, uid = 'u1', role = 'lead') => DB.view(id, kind, DB.state.open[id] ? DB.state.open[id].sel : null, [], uid, role, {});
  const open = () => Object.keys(DB.state.open).sort().join(), kinds = () => Object.keys(DB.state.open).sort().map(k => DB.state.open[k].kind).join();
  const mem = k => JSON.parse(JSON.stringify(DB.state.viewMem[k] || null)), same = (a, b) => JSON.stringify(a) === JSON.stringify(b), tab = html => html.replace(/<svg[\s\S]*?<\/svg>/g, '');
  // память: на человека и плитку — последний вид и выбор в каждом из пяти видов; путь и раскрытие не пишутся
  DB.openView('lead-od', 'slice'); DB.viewSet('lead-od', 'dim', 'program'); DB.viewSet('lead-od', 'top', '5');
  DB.openView('lead-od', 'series'); DB.viewSet('lead-od', 'points', '24'); DB.viewSet('lead-od', 'of', 'main');
  DB.openView('lead-od', 'move'); DB.viewSet('lead-od', 'month', '-1');
  DB.openView('lead-od', 'map'); DB.viewSet('lead-od', 'dims', ['program', 'region']);
  DB.openView('lead-od', 'table'); DB.viewSet('lead-od', 'dim', 'region'); DB.viewSet('lead-od', 'cols', ['loan.overdue', 'loan.balance']); DB.deeper('lead-od', 'region', 'Ошская');
  const m1 = mem('u1|lead-od'); DB.closeView('lead-od'); const kept = same(mem('u1|lead-od'), m1); DB.openView('lead-od', 'slice'); const back = V('lead-od', 'slice').sel;
  DB.switchUser('u2'); DB.setTab('role', 'cur'); DB.openView('cur-od', 'slice'); DB.viewSet('cur-od', 'dim', 'category');
  const d1 = DB.view('lead-od', 'slice', null, [], 'u1', 'lead', {}).sel.dim, d2 = DB.view('lead-od', 'slice', null, [], 'u2', 'lead', {}).sel.dim;
  ok(181, same(m1, { last:'table', slice:{ dim:'program', top:5 }, series:{ points:24, of:'main' }, move:{ month:-1 }, map:{ dims:['program', 'region'] }, table:{ dim:'region', cols:['loan.balance', 'loan.overdue'] } })
    && kept && back.dim === 'program' && back.top === 5 && mem('u2|cur-od').slice.dim === 'category' && same(mem('u1|lead-od').slice, m1.slice) && !mem('u1|cur-od') && !mem('u2|lead-od') && d1 === 'program' && d2 === 'bucket',
    'память видов на человека и плитку: последний вид и выбор в каждом из пяти видов (разрез и топ, точки и число, месяц, пара разрезов, разрез и колонки); путь и раскрытие не пишутся; переживает закрытие; выбор Бекова не меняет память Шамшиева (ДБ-121)');
  // клик по главному числу: последний вид человека, у новой плитки — Разрез; раскрытая закрывается; мини-ряд — Ряд
  DB.seed(); asUser('u1'); DB.setTab('role', 'lead');
  const c0 = DB.clickOf('lead-od', 'u1', 'lead', {}), r1 = DB.primary('lead-od'), k1 = kinds(); DB.openView('lead-od', 'map'); const r2 = DB.primary('lead-od'), shut = open() === '';
  const r3 = DB.primary('lead-od'), k3 = kinds(), hod = DB.tileHTML('lead-od', 'u1', 'lead'); DB.primary('lead-od');
  DB.openView('lead-od', 'series'); const k4 = kinds(), l4 = mem('u1|lead-od').last; DB.primary('lead-od'); const r5 = DB.primary('lead-od'), k5 = kinds();
  ok(182, c0.act === 'view' && c0.kind === 'slice' && r1.act === 'view' && k1 === 'slice' && r2.act === 'close' && shut && r3.kind === 'map' && k3 === 'map'
    && /^<div class="tile[^"]*" data-key="lead-od"[^>]* onclick="DB\.primary\('lead-od'\)">/.test(hod) && /<div class="mini" onclick="event\.stopPropagation\(\);DB\.openView\('lead-od','series'\)">/.test(hod)
    && k4 === 'series' && l4 === 'series' && r5.kind === 'series' && k5 === 'series' && /items\.push\(\['Работать со списком', `DB\.registry\(/.test(src),
    'главное число: Разрез у новой плитки, потом последний вид человека; ещё раз по числу — полоса закрывается; мини-ряд открывает Ряд и запоминается; «Работать со списком» осталась в «⋯» (ДБ-124)');
  // вид погашен — Разрез, а если и он — первый доступный; ссылочная — очередь; ничего не отвечает — список
  DB.state.viewMem['u1|lead-risk'] = { last:'move' }; const fb = DB.clickOf('lead-risk', 'u1', 'lead', {});
  const rcv = DB.OBJ_DIMS.receipt; DB.OBJ_DIMS.receipt = []; DB.state.cache.clear();
  const g0 = DB.clickOf('acc-unalloc', 'u4', 'acc', {}), gv = DB.views('acc-unalloc', 'u4', 'acc', [], {}).filter(v => v.ok).map(v => v.kind).join();
  DB.state.viewMem['u4|acc-unalloc'] = { last:'move' }; const g1 = DB.clickOf('acc-unalloc', 'u4', 'acc', {}); DB.state.viewMem['u4|acc-unalloc'] = { last:'table' }; const g2 = DB.clickOf('acc-unalloc', 'u4', 'acc', {});
  DB.OBJ_DIMS.receipt = rcv; DB.state.cache.clear(); DB.state.open = {};
  const lk = DB.primary('zal-lowcov'), lo = open(), hz = DB.tileHTML('zal-lowcov', 'u1', 'lead'); DB.openView('zal-lowcov', 'series'); const lk2 = DB.clickOf('zal-lowcov', 'u1', 'lead', {}); DB.state.open = {};
  DB.stand('statDown', true); const ls = DB.clickOf('lead-od', 'u1', 'lead', {}), lp = DB.primary('lead-od'); DB.stand('statDown', false);
  ok(183, fb.kind === 'slice' && gv === 'series,move' && g0.kind === 'series' && g1.kind === 'move' && g2.kind === 'series'
    && lk.act === 'queue' && lk2.act === 'queue' && lo === '' && /onclick="DB\.primary\('zal-lowcov'\)"/.test(hz) && /DB\.openView\('zal-lowcov','series'\)">Ряд/.test(hz)
    && /class="mini off" data-tip="[^"]+" onclick="event\.stopPropagation\(\)"/.test(DB.tileHTML('tasks', 'u1', 'lead')) && ls.act === 'list' && lp.act === 'list' && open() === '',
    'вид из памяти погашен — Разрез; Разреза нет (у объекта нет разрезов) — первый доступный вид (' + g0.kind + '); у ссылочной клик по числу — очередь, виды открываются кнопками; плитка не отвечает — список (ДБ-124, ДБ-120)');
  // раскрытие не хранится: сброс при смене пользователя, вкладки, «Наступило утро» и seed(); память остаётся
  DB.seed(); asUser('u1'); DB.setTab('role', 'lead'); DB.openView('lead-od', 'map'); DB.viewSet('lead-od', 'dims', ['program', 'region']); DB.openView('lead-issued', 'table');
  const o0 = open(); DB.switchUser('u2'); const oSw = open(), mSw = mem('u1|lead-od'); DB.switchUser('u1'); DB.setTab('role', 'lead');
  DB.openView('lead-od', 'map'); DB.setTab('role', 'lead'); const oTab = open(); DB.openView('lead-od', 'map'); DB.openView('lead-issued', 'table');
  const mb = JSON.stringify(DB.state.viewMem); DB.morning(); const oMorn = open(), mKept = JSON.stringify(DB.state.viewMem) === mb;
  const pm = DB.primary('lead-od'), dm = V('lead-od', 'map').sel.dims.join(); DB.seed();
  ok(184, o0 === 'lead-issued,lead-od' && oSw === '' && mSw.map.dims.join() === 'program,region' && oTab === '' && oMorn === '' && mKept && pm.kind === 'map' && dm === 'program,region'
    && open() === '' && Object.keys(DB.state.viewMem).length === 0 && !/Date/.test(DB.morning.toString()) && /<button class="btn" onclick="DB\.morning\(\)">Наступило утро<\/button>/.test(src),
    'раскрытое не помнится: смена пользователя, вкладки, «Наступило утро» и seed() закрывают всё; выбор в видах остаётся (кроме seed), после утра клик по числу открывает прежний вид с прежней парой разрезов (ДБ-121)');
  // закреплено на своём экране: посев «Совещание по Ошу», переживает «утро» и повторный вход, открепление
  DB.seed(); asUser('u1'); DB.setTab('screen', 'sc1');
  const sc = DB.screens('u1')[0], po = DB.state.open['lead-od'], kp = kinds(), rm = DB.view('lead-od', 'map', po && po.sel, [], 'u1', null, { region:'Ошская' });
  const hp = tab(DB.stripHTML('lead-od', 'u1', null));
  DB.morning(); const pm1 = open() + ':' + kinds(); ['lead-risk', 'lead-borr', 'lead-issued'].forEach(k => DB.screenAdd('sc1', k));   // второй ряд экрана
  DB.openView('lead-issued', 'table'); const pt = DB.pinOpen('lead-issued'), pk = sc.pinned['lead-issued'];
  DB.switchUser('u2'); DB.switchUser('u1'); DB.setTab('screen', 'sc1'); const pr = open() + ':' + kinds();
  const un = DB.pinOpen('lead-issued'); DB.morning(); const po1 = open(); DB.openView('lead-od', 'map'); DB.pinOpen('lead-od'); DB.morning(); const po2 = open();
  ok(185, sc.items.includes('lead-od') && sc.items.includes('lead-bal') && sc.filter.region === 'Ошская' && kp === 'map' && po.sel.dims.join() === 'program,bucket' && rm.heat.d1 === 'program' && rm.heat.d2 === 'bucket'
    && /class="pin on" aria-label="Открепить"[^>]*onclick="DB\.pinOpen\('lead-od'\)">📍/.test(hp) && pm1 === 'lead-od:map' && pt.pinned && same(Object.keys(pk), ['kind', 'sel']) && pk.kind === 'table' && !('path' in pk.sel)
    && pr === 'lead-issued,lead-od:table,map' && un.pinned === false && po1 === 'lead-od' && po2 === '' && same(sc.pinned, {}) && same(DB.createScreen('Новый').pinned, {}),
    'экран «Совещание по Ошу»: «Просрочено» стоит раскрытой Картой «программа × срок» (область — фильтр экрана); закрепление переживает «утро» и повторный вход, «Открепить» снимает; закрепляются вид и выбор, путь — нет (ДБ-122)');
  // на раскладке роли закрепить нельзя: отказ с причиной, кнопки в полосе нет; закрепляют раскрытую
  DB.seed(); asUser('u1'); DB.setTab('role', 'lead'); DB.openView('lead-od', 'slice');
  const rr = DB.pinOpen('lead-od'), hr = DB.stripHTML('lead-od', 'u1', 'lead'); DB.setTab('screen', 'sc1'); DB.closeView('lead-od'); const nr = DB.pinOpen('lead-od');
  ok(186, rr.error === 'Закрепить раскрытой можно только на своём экране' && !/class="pin/.test(hr) && !rr.ok && same(DB.screens('u1')[0].pinned, { 'lead-od':{ kind:'map', sel:{ dims:['program', 'bucket'] } } })
    && nr.error === 'Полоса не открыта' && !!DB.screens('u1')[0].pinned['lead-od'],
    'на вкладке роли закрепить раскрытой нельзя («Закрепить раскрытой можно только на своём экране»), кнопки 📍 в полосе нет; закрыть закреплённую — не открепить (ДБ-122)');
  DB.seed();
})();

/* ---------- P (продолжение). Слияние плиток Руководства, Куратора и каталога ---------- */
(() => {
  DB.seed(); asUser('u1');
  const near = (a, b) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 0.5, sum = a => a.reduce((x, y) => x + y, 0);
  const at = (id, x, uid = 'u1', role = 'lead', panel = {}) => DB.at(id, x, uid, role, panel);
  const tl = L => L.filter(k => !/^s:/.test(k)), sc = L => L.filter(k => /^s:/.test(k)), wait = ['lead-spin', 'lead-spcure'];
  const LEAD = ['s:Картина портфеля', 'lead-bal', 'lead-od', 'lead-borr', 'lead-risk', 'lead-spin', 'lead-spcure', 's:Деньги и план', 'lead-issued', 'lead-paid',
    's:Взыскание и реструктуризация', 'lead-claims', 'lead-recov', 'lead-rs', 'tasks', 's:Имущество', 'lead-ast', 'lead-astod'];
  const CUR = ['s:Мой портфель', 'cur-bal', 'cur-od', 'cur-borod', 'cur-risk', 'cur-rc', 'cur-spin', 's:Мои реструктуризации', 'cur-rs', 'cur-rsout',
    's:Мой план и работа', 'cur-plan0', 'cur-plan1', 'cur-npay', 'cur-obl', 'tasks'];
  const REMOVED = ['lead-loans', 'lead-borod', 'lead-odsh', 'lead-bucket', 'lead-cat', 'lead-prog', 'lead-progis', 'lead-odser', 'lead-heat', 'lead-bodays', 'lead-bmove', 'lead-bdebt', 'lead-rslate',
    'cur-loans', 'cur-odsh', 'cur-bucket', 'cur-cat', 'cur-rslate', 'cur-rsstage', 'cat-spser', 'cat-byprog', 'cat-byreg', 'cat-brep', 'cat-bhist', 'cat-progsrc', 'cat-balsrc'];
  // раскладки: 14 плиток в четырёх секциях у Руководства, 13 в трёх у Куратора; Аналитик — копия Руководства; эпизоды просрочки ждут ядра
  const lay0 = DB.composeLayout('u1', 'lead'), cur0 = DB.composeLayout('u2', 'cur');
  DB.STAND.spells = true; const lay1 = DB.composeLayout('u1', 'lead'), cur1 = DB.composeLayout('u2', 'cur'); DB.STAND.spells = false;
  const dcl = DB.state.declared, ov = DB.state.overlays['u2|cur'], sc1 = DB.screens('u1')[0];
  ok(187, DB.DECLARED_SEED.lead.join('|') === LEAD.join('|') && tl(LEAD).length === 14 && sc(LEAD).length === 4 && DB.DECLARED_SEED.cur.join('|') === CUR.join('|') && tl(CUR).length === 13 && sc(CUR).length === 3
    && dcl.lead.join('|') === LEAD.join('|') && dcl.cur.join('|') === CUR.join('|') && dcl.an.join('|') === LEAD.join('|') && dcl.an !== dcl.lead
    && lay0.join('|') === LEAD.filter(k => !wait.includes(k)).join('|') && tl(lay0).length === 12 && lay1.join('|') === LEAD.join('|')
    && cur0.join('|') === CUR.filter(k => k !== 'cur-spin').concat('p-u2-agro').join('|') && tl(cur0).length === 13 && cur1.join('|') === CUR.concat('p-u2-agro').join('|')
    && ov && ov.added.join() === 'p-u2-agro' && sc1.items.join() === 'lead-od,lead-bal' && sc1.pinned['lead-od'].kind === 'map' && sc1.pinned['lead-od'].sel.dims.join() === 'program,bucket',
    `раскладки после слияния: Руководство — 14 плиток в четырёх секциях (отвечают 12: эпизоды просрочки ждут ядро, со стендом «эпизоды» — все 14), Куратор — 13 в трёх, Аналитик — копия Руководства; у Бековой личная плитка в конце; «Совещание по Ошу» — «Просрочено» и «Остаток», «Просрочено» закреплено Картой «программа × срок»`);
  // снятые плитки нигде не остались: ни в плитках, ни в раскладках ролей, личных раскладках и экранах, ни в тексте страницы
  const inLay = [...Object.values(dcl).flat(), ...Object.values(DB.DECLARED_SEED).flat(), ...Object.values(DB.state.overlays).flatMap(o => [...o.order, ...o.hidden, ...o.added]),
    ...Object.values(DB.state.screens).flat().flatMap(s => [...s.items, ...Object.keys(s.pinned)])];
  const left = REMOVED.filter(id => DB.tileById(id) || DB.TILES.some(t => t.id === id) || inLay.includes(id) || new RegExp('[\'"`]' + id + '[\'"`]').test(src));
  ok(188, REMOVED.length === 26 && new Set(REMOVED).size === 26 && left.length === 0 && ['cat-rsmulti', 'p-u2-agro'].every(id => DB.tileById(id)) && !DB.catalogFor(U('u1')).some(x => REMOVED.includes(x.t.id)),
    `26 снятых плиток (${REMOVED.slice(0, 4).join(', ')}…) нет ни в списке плиток, ни в раскладках ролей и личных, ни на экранах, ни в тексте страницы; остались: «Многократных обращений» в каталоге, личная плитка Бековой`);
  // числа без намеренных изменений равны прежним: литералы из снимка до слияния, по умолчанию стенда
  const LIT = {
  'u1|lead': [
    ['lead-bal', 'second', 1248],
    ['lead-borr', 'main', 903],
    ['lead-borr', 'second', 29.900332],
    ['lead-borr', 'second.num', 270],
    ['lead-borr', 'second.den', 903],
    ['lead-od', 'second', 4.636944],
    ['lead-od', 'main', 178778855],
    ['lead-od', 'second.den', 3855532121],
    ['lead-risk', 'main', 868835772],
    ['lead-od', 'table(bucket;loan.count)', [['1–30',99],['31–90',80],['91–180',56],['181+',52]]],
    ['lead-bal', 'table(category;loan.count)', [['Низкий кредитный риск',877],['Средний кредитный риск',183],['Высокий кредитный риск',80],['Потери',56],['Убыток',52]]],
    ['lead-borr', 'slice(bodays)', [['1–30',93],['31–90',72],['91–180',53],['181+',52]]],
    ['lead-borr', 'table(bdebt;borrower.count,borrower.total)', [['до 1 млн',[131,90100189]],['1–10 млн',[704,2922166888]],['10–50 млн',[68,843265044]],['50+ млн',[0,0]]]],
    ['lead-issued', 'main', 351146923],
    ['lead-paid', 'second', 86.644359],
    ['lead-paid', 'main', 104713529],
    ['lead-paid', 'second.den', 120854410],
    ['lead-bal', 'table(program;loan.count,loan.balance,loan.overdue)', [['agro',[511,1379098972,60990206]],['prom',[281,1239191506,70466823]],['mb',[190,516169651,20088043]],['per',[112,299018958,6915126]],['tur',[86,225426086,11454344]],['eko',[68,196626948,8864313]]]],
    ['lead-issued', 'slice(program)', [['prom',126624871],['agro',88931005],['per',57411538],['mb',45355176],['tur',17044068],['eko',15780265]]],
    ['lead-claims', 'main', 88],
    ['lead-recov', 'main', 14.554703],
    ['lead-recov', 'second.num', 28395951],
    ['lead-recov', 'second.den', 195098119],
    ['lead-rs', 'main', 14],
    ['cat-rsmulti', 'main', 4],
    ['lead-rs', 'second', 4],
    ['lead-ast', 'second', 48],
    ['lead-ast', 'main', 179045964],
    ['lead-astod', 'main', 1081759]
  ],
  'u2|cur': [
    ['cur-bal', 'second', 47],
    ['cur-borod', 'main', 35.897436],
    ['cur-borod', 'second.num', 14],
    ['cur-borod', 'second.den', 39],
    ['cur-risk', 'main', 40013091],
    ['cur-rc', 'main', 1],
    ['cur-rc', 'second', 5],
    ['cur-od', 'second', 5.666567],
    ['cur-od', 'main', 8722292],
    ['cur-od', 'second.den', 153925508],
    ['cur-od', 'table(bucket;loan.count)', [['1–30',5],['31–90',3],['91–180',1],['181+',4]]],
    ['cur-bal', 'table(category;loan.count)', [['Низкий кредитный риск',33],['Средний кредитный риск',6],['Высокий кредитный риск',3],['Потери',1],['Убыток',4]]],
    ['cur-rs', 'main', 2],
    ['cur-rs', 'second', 1],
    ['cur-rs', 'table(rstage;rsapp.count)', [['регистрация обращения',0],['анализ',1],['комитет Холдинга',0],['письмо направлено',0],['заключение уполномоченного органа',1],['проект решения КМ и согласование комитета ЖК',0],['постановление КМ',0],['оформление',0],['закрыта',2]]],
    ['cur-rs', 'table(rstage;rsapp.count).total', 4],
    ['cur-rsout', 'slice(routcome)', [['одобрена',1],['одобрена с изменёнными условиями',0],['отказ',0],['отпала',0],['возвращена без рассмотрения',0]]],
    ['cur-rsout', 'main', 1],
    ['cur-plan0', 'main', 84.340601],
    ['cur-plan0', 'second.num', 1043036],
    ['cur-plan0', 'second.den', 1236695],
    ['cur-plan1', 'main', 83.913041],
    ['cur-plan1', 'second.num', 2974938],
    ['cur-plan1', 'second.den', 3545263],
    ['cur-plan1', 'shift', -0.210501],
    ['cur-npay', 'main', 8],
    ['cur-obl', 'main', 6],
    ['p-u2-agro', 'main', 1]
  ],
  'u1|-': [
    ['lead-bal', 'slice(program)', [['agro',1379098972],['prom',1239191506],['mb',516169651],['per',299018958],['tur',225426086],['eko',196626948]]],
    ['lead-bal', 'main', 3855532121],
    ['lead-bal', 'slice(region)', [['Чуйская',1256211373],['Ошская',763967157],['Джалал-Абадская',574929431],['Иссык-Кульская',491138054],['Нарынская',287321654],['Баткенская',270683941],['Таласская',211280511]]],
    ['lead-borr', 'slice(bcredits)', [['1',468],['2',284],['3+',151]]],
    ['cat-brepsh', 'main', 48.172757],
    ['cat-brepsh', 'second.num', 435],
    ['cat-brepsh', 'second.den', 903],
    ['cat-brepsh', 'shift', 1.601621],
    ['lead-borr', 'slice(bhist)', [['без просрочек',428],['1–30',107],['31–90',152],['91+',216]]],
    ['cat-progn', 'main', 6],
    ['cat-progn', 'slice(pgsource)', [['Республиканский бюджет',3],['ФРР',2],['Донор',1]]],
    ['lead-bal', 'slice(lpsource)', [['Республиканский бюджет',1951988105],['ФРР',1678117930],['Донор',225426086]]],
    ['cat-plan', 'main', 87.759474],
    ['cat-plan', 'second.num', 87615586],
    ['cat-plan', 'second.den', 99836043],
    ['cat-plan', 'shift', 0.20506]
  ]
  };
  const eqv = (a, b) => typeof b === 'number' ? typeof a === 'number' && Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b)) : Array.isArray(b) ? Array.isArray(a) && a.length === b.length && b.every((y, i) => eqv(a[i], y)) : a === b;
  const srt = x => Array.isArray(x) && x.length && Array.isArray(x[0]) && typeof x[0][0] === 'string' ? [...x].sort((p, q) => p[0] < q[0] ? -1 : p[0] > q[0] ? 1 : 0) : x;
  const miss = []; let nLit = 0;
  for (const [sel, rows] of Object.entries(LIT)) { const [uid, rl] = sel.split('|');
    for (const [id, ex, want] of rows) { nLit++; let got; try { got = at(id, ex, uid, rl === '-' ? null : rl); } catch (e) { got = 'ERR ' + e.message; }
      if (!eqv(srt(got), srt(want))) miss.push(`${sel} ${id} ${ex} → ${JSON.stringify(got).slice(0, 60)}`); } }
  ok(189, nLit === 73 && miss.length === 0,
    `${nLit} чисел новых плиток (Руководство, Куратор, каталог) равны прежним значениям до слияния: главное, второе и его числитель со знаменателем, узлы Разрезов и Таблиц, итоги${miss.length ? '; расходятся: ' + miss.join('; ') : ''}`);
  // намеренные изменения — с новыми числами
  const BT = 'table(bucket;loan.count).total', bd = DB.base('lead-od', 'u1', 'lead'), cd = DB.base('cur-od', 'u2', 'cur'), pd = DB.base('lead-paid', 'u1', 'lead');
  ok(190, at('lead-od', BT) === 1248 && at('lead-od', BT) === at('lead-bal', 'second') && at('cur-od', BT, 'u2', 'cur') === 47 && at('cur-od', BT, 'u2', 'cur') === at('cur-bal', 'second', 'u2', 'cur')
    && at('lead-borr', 'slice(bodays).total') === 903 && at('lead-borr', 'slice(bodays).total') === at('lead-borr', 'main'),
    'итог по срокам в Таблице «Просрочено» — все действующие кредиты по фильтру отчёта, а не только просроченные: Руководство 287 → 1 248 (= «кредитов» в «Остатке»), Куратор 13 → 47; итог по ступеням «Заёмщиков» 270 → 903 (все действующие клиенты)');
  const MON = {
    lead_od: [['1–30', 24782736], ['31–90', 39520248], ['91–180', 45783384], ['181+', 68692487]],
    lead_cat: [['Низкий кредитный риск', 2755257271], ['Средний кредитный риск', 523521039], ['Высокий кредитный риск', 232472012], ['Потери', 163512090], ['Убыток', 180769709]],
    cur_od: [['1–30', 1778579], ['31–90', 894030], ['91–180', 1103518], ['181+', 4946165]],
    cur_cat: [['Низкий кредитный риск', 108753277], ['Средний кредитный риск', 22955865], ['Высокий кредитный риск', 5259004], ['Потери', 3941137], ['Убыток', 13016225]],
    cur_rs: [['регистрация обращения', 0], ['анализ', 1], ['комитет Холдинга', 0], ['письмо направлено', 0], ['заключение уполномоченного органа', 1], ['проект решения КМ и согласование комитета ЖК', 0], ['постановление КМ', 0], ['оформление', 0], ['закрыта', 0]] };
  const rLO = at('lead-od', 'slice(bucket)'), rLC = at('lead-bal', 'slice(category)'), rCO = at('cur-od', 'slice(bucket)', 'u2', 'cur'), rCC = at('cur-bal', 'slice(category)', 'u2', 'cur'), rCR = at('cur-rs', 'slice(rstage)', 'u2', 'cur');
  ok(191, eqv(rLO, MON.lead_od) && sum(rLO.map(x => x[1])) === at('lead-od', 'main') && eqv(rLC, MON.lead_cat) && sum(rLC.map(x => x[1])) === at('lead-bal', 'main')
    && eqv(rCO, MON.cur_od) && sum(rCO.map(x => x[1])) === at('cur-od', 'main', 'u2', 'cur') && eqv(rCC, MON.cur_cat) && sum(rCC.map(x => x[1])) === at('cur-bal', 'main', 'u2', 'cur')
    && eqv(rCR, MON.cur_rs) && sum(rCR.map(x => x[1])) === at('cur-rs', 'main', 'u2', 'cur') && at('cur-rs', 'table(rstage;rsapp.count).total', 'u2', 'cur') === 4,
    'Разрезы «Просрочено» по сроку, «Остатка» по категории и обращений по стадии считают главное число плитки: в сомах (было — счёт кредитов), сумма узлов = главному; обращения по стадиям — только в работе (1 + 1 = 2), все четыре — в Таблице; счёт — в Таблицах «Просрочено» и «Остатка»');
  const sh = (b, base) => near(b.shift.delta, b.value - base);
  ok(192, at('lead-od', 'shift') === 7405971 && bd.shift.delta === 7405971 && sh(bd, 171372884) && bd.shift.label === 'к 30.09' && at('cur-od', 'shift', 'u2', 'cur') === 217667 && sh(cd, 8504625)
    && at('lead-paid', 'shift') === 60501 && sh(pd, 104653028) && pd.shift.label === 'к августу' && !('pp' in bd.shift),
    'сдвиг «Просрочено» и «Поступило» — по главному числу в сомах (было — п.п. доли: 0,116 → 7,4 млн, −0,522 → 60 501, у Куратора 0,114 → 217 667); доля — во втором числе без собственного сдвига');
  const m0 = at('lead-borr', 'move(-1)'); DB.STAND.clientFlows = true; const m1 = at('lead-borr', 'move(-1)'); DB.STAND.clientFlows = false;
  ok(193, m0 === 'state:off' && DB.composeLayout('u1', 'lead').includes('lead-borr') && DB.ask(T('lead-borr'), U('u1'), 'lead', {}).state === 'ok'
    && m1.start === 914 && m1.end === 907 && sum(m1.inc.map(x => x.v)) === 4 && sum(m1.dec.map(x => x.v)) === 10 && m1.other === -1 && m1.start + 4 - 10 + m1.other === m1.end,
    'вид Движение у «Заёмщиков» погашен, пока статистика не отдаёт потоки клиентов — плитка в раскладке отвечает (раньше отдельная плитка движения уходила в отказ и в раскладку не вставала); с потоками: 914 + 4 − 10 − 1 = 907');
  // отчёты после слияния: колонки и разрезы, на которых стоят виды новых плиток; числа соседей по отчёту не сдвинулись (проверено выше по литералам)
  const R = id => DB.reportById(id);
  ok(194, R('r-borrowers').cols.join() === 'borrower.count,borrower.total' && ['bover', 'bodays', 'bdebt', 'bcredits', 'bhist'].every(d => R('r-borrowers').dims.includes(d))
    && ['rsapp.inWork', 'rsapp.late', 'rsapp.multi', 'rsapp.count'].every(c => R('r-rsapps').cols.includes(c)) && R('r-rsapps').dims.includes('rstage')
    && R('r-issued').dims.includes('program') && R('r-prog').dims.includes('pgsource')
    && ['lead-borr', 'cur-borod', 'cat-brepsh', 'lead-rs', 'cur-rs', 'cat-rsmulti', 'lead-issued', 'cat-plan', 'cat-progn'].every(id => !DB.reportBroken(T(id)) && DB.ask(T(id), U('u1'), 'lead', {}).state !== 'broken'),
    'отчёты слияния: «Заёмщики» с пятью разрезами и двумя колонками, «Обращения о реструктуризации» с четырьмя колонками и стадией, «Выдано» с программой, «Программы» с источником; плитки на них не сломаны');
  DB.seed();
})();

/* ---------- P (продолжение). Слияние плиток остальных ролей и ссылочных ---------- */
(() => {
  DB.seed(); asUser('u1');
  const near = (a, b) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 0.5, sum = a => a.reduce((x, y) => x + y, 0);
  const at = (id, x, uid = 'u1', role = 'lead', panel = {}) => DB.at(id, x, uid, role, panel);
  const tl = L => L.filter(k => !/^s:/.test(k)), sc = L => L.filter(k => /^s:/.test(k));
  const RU = { prob:'u3', acc:'u4', zal:'u5', spec:'u6', com:'u7', gof:'u8', otd:'u9', rep:'u10', ast:'u12' };
  const LAY = {
    prob: ['s:Требования', 'prob-claims', 'prob-181', 'prob-since', 's:Результат', 'prob-rec', 'prob-real', 'prob-meas', 'tasks', 's:Дела', 'prob-recov', 'prob-cases', 'prob-court', 'prob-exp', 'prob-dead', 'prob-nocon'],
    acc: ['s:Что мешает закрыть период', 'acc-unident', 'acc-await', 'acc-unm', 's:Деньги', 'acc-today', 'acc-prev', 'acc-refund', 'acc-rev', 'acc-unalloc', 'acc-pkind'],
    zal: ['s:Портфель обеспечения', 'zal-value', 's:Что требует действия', 'zal-lowcov', 'zal-reval', 'zal-ins', 'zal-ban', 'zal-reg', 'zal-sale', 'tasks'],
    spec: ['s:Мои заявки', 'spec-work', 'spec-ready', 'spec-neg', 'tasks', 'spec-stage', 's:Итоги', 'spec-dec', 'spec-pend', 'spec-filed'],
    com: ['s:Мой голос и сроки', 'com-vote', 'com-late', 'com-soon', 'com-noscan', 's:Обзор', 'com-pend', 'com-max', 'com-dec'],
    gof: ['s:Подтверждение комплектов', 'gof-wait', 'gof-compl', 'gof-conf', 'tasks'],
    otd: ['s:Наша очередь', 'otd-pend', 'otd-neg', 'tasks', 's:Итоги', 'otd-rev', 'otd-verd'],
    rep: ['s:Сдача', 'rep-od', 'rep-soon', 'rep-chg', 'tasks', 's:Итоги', 'rep-sum'],
    ast: ['s:Имущество на балансе', 'ast-count', 'ast-idle', 'ast-unsold', 'ast-kpod', 'ast-claim', 'ast-exp', 'tasks']
  };
  const CNT = { prob:[13, 3], acc:[9, 2], zal:[8, 2], spec:[8, 2], com:[7, 2], gof:[4, 1], otd:[5, 2], rep:[5, 2], ast:[7, 1] };
  const REMOVED = ['prob-amount', 'prob-phase', 'prob-lead', 'prob-recser', 'acc-ser', 'acc-src', 'zal-count', 'zal-kind', 'spec-req', 'spec-status', 'spec-prog', 'com-sum', 'com-by', 'com-ser',
    'gof-max', 'gof-rp', 'otd-max', 'rep-ser', 'ast-state'];
  // раскладки девяти ролей: число плиток и секций по канону, порядок, личной перекладки нет; «Мои задания» — в семи из девяти
  const rl = Object.keys(LAY), dcl = DB.state.declared;
  const goodLay = rl.every(r => DB.DECLARED_SEED[r].join('|') === LAY[r].join('|') && dcl[r].join('|') === LAY[r].join('|') && tl(LAY[r]).length === CNT[r][0] && sc(LAY[r]).length === CNT[r][1]
    && DB.composeLayout(RU[r], r).join('|') === LAY[r].join('|') && DB.roleHasLayout(r));
  ok(195, goodLay && sum(rl.map(r => tl(LAY[r]).length)) === 66 && sum(rl.map(r => sc(LAY[r]).length)) === 17 && rl.filter(r => LAY[r].includes('tasks')).join() === 'prob,zal,spec,gof,otd,rep,ast'
    && rl.every(r => tl(LAY[r]).every(k => DB.tileById(k) && DB.tileAnswers(DB.tileById(k)))),
    `раскладки девяти ролей по канону: Проблемные 13 плиток в трёх секциях, Бухгалтерия 9 в двух, Залог 8 в двух, Кредитный специалист 8 в двух, Комиссия 7 в двух, Головной офис 4 в одной, Отдел 5 в двух, Отчётность 5 в двух, Имущество 7 в одной — всего 66 в 17 секциях, порядок как в каноне; «Мои задания» стоит в семи (в Бухгалтерии и Комиссии его нет)`);
  // снятые плитки нигде не остались: ни в плитках, ни в раскладках, личных раскладках и экранах, ни в тексте страницы; все плитки каталога — на основе
  const inLay = [...Object.values(dcl).flat(), ...Object.values(DB.DECLARED_SEED).flat(), ...Object.values(DB.state.overlays).flatMap(o => [...o.order, ...o.hidden, ...o.added]),
    ...Object.values(DB.state.screens).flat().flatMap(s => [...s.items, ...Object.keys(s.pinned)])];
  const left = REMOVED.filter(id => DB.tileById(id) || DB.TILES.some(t => t.id === id) || inLay.includes(id) || new RegExp('[\'"`]' + id + '[\'"`]').test(src));
  ok(196, REMOVED.length === 19 && new Set(REMOVED).size === 19 && left.length === 0 && !DB.catalogFor(U('u1')).some(x => REMOVED.includes(x.t.id))
    && DB.TILES.length === 91 && DB.TILES.every(t => t.main && !('pick' in t) && !('format' in t) && !('top' in t) && !('points' in t)),
    `19 снятых плиток (${REMOVED.slice(0, 4).join(', ')}…) нет ни в списке плиток, ни в раскладках, личных перекладках и экранах, ни в тексте страницы; плиток в каталоге ${DB.TILES.length} (было 135), у каждой главное число и умолчания видов, прежних «выбор из ответа» и «формат» нет ни у одной`);
  // числа без намеренных изменений равны прежним: литералы из снимка до слияния, по умолчанию стенда, по одному пользователю на роль
  // Ряд плитки за прошлый месяц кончается её периодом: прежние 11 точек те же, неполный текущий месяц ушёл, слева — месяц годом раньше
  const prevEnd = (first, old) => [first, ...old.slice(0, -1)];
  const LIT = {
  'u3|prob': [
    ['prob-claims', 'main', 53],
    ['prob-claims', 'second', 102989348],
    ['prob-181', 'main', 8],
    ['prob-181', 'tl', 'red'],
    ['prob-since', 'main', 218],
    ['prob-claims', 'slice(phase)', [['Досудебная',28],['Судебная',9],['Исполнение',11],['Банкротство',4],['Урегулирование',1]]],
    ['prob-claims', 'slice(leadDept)', [['opk',35],['rp-chu',8],['rp-tal',4],['rp-osh',3],['rp-bat',1],['rp-nar',1],['rp-ik',1]]],
    ['prob-rec', 'main', 1699839],
    ['prob-rec', 'shift', 27645],
    ['prob-real', 'main', 4],
    ['prob-rec', 'series(12)', prevEnd([447664], [[558828],[627250],[740471],[888860],[1089736],[1076549],[1427879],[1557582],[1542647],[1672194],[1699839],[619565]])],
    ['prob-meas', 'slice(mkind)', [['Претензия',21],['Исполнительный лист',10],['Арест имущества',8],['Иск',7],['Торги',6],['Мировое соглашение',3],['Заявление о банкротстве',2]]],
    ['prob-meas', 'main', 57],
    ['tasks', 'main', 4],
    ['prob-recov', 'main', 16.650442],
    ['prob-recov', 'second.num', 19511308],
    ['prob-recov', 'second.den', 117181923],
    ['prob-cases', 'main', 54],
    ['prob-cases', 'second', 3],
    ['prob-court', 'main', 27447480],
    ['prob-exp', 'main', 6648555],
    ['prob-dead', 'main', 4],
    ['prob-nocon', 'main', 6]
  ],
  'u4|acc': [
    ['acc-unident', 'main', 1],
    ['acc-unident', 'second', 507717],
    ['acc-unident', 'tl', 'yellow'],
    ['acc-await', 'main', 1],
    ['acc-unm', 'main', 16],
    ['acc-today', 'main', 18355181],
    ['acc-prev', 'main', 142890222],
    ['acc-prev', 'shift', 17929534],
    ['acc-refund', 'main', 3108293],
    ['acc-rev', 'main', 1],
    ['acc-unalloc', 'move(0)', [12032988,13057964,[7834778],[4570287],-2239515]],
    ['acc-prev', 'series(12)', prevEnd([139248882], [[136776387],[134792788],[97903433],[116176437],[136663065],[118347844],[124427349],[127567481],[125885127],[124960688],[142890222],[150065611]])],
    ['acc-pkind', 'slice(pkind)', [['по графику',11416013],['по решению суда',2917184],['досрочно',1422685],['имуществом',733317]]],
    ['acc-pkind', 'main', 16489199],
    ['acc-prev', 'slice(source)', [['Импорт ЦК',91327238],['Шлюз',38792376],['Вручную',12770608]]]
  ],
  'u5|zal': [
    ['zal-value', 'second', 404],
    ['zal-value', 'move(0)', [2023995601,2028385418,[13706737,2459447],[1184794,5730001],-4861572]],
    ['zal-value', 'slice(ckind)', [['Недвижимость',1187347462],['Оборудование',361511165],['Транспорт',334487558],['Товары в обороте',145039233]]],
    ['zal-value', 'main', 2028385418],
    ['zal-lowcov', 'main', 49],
    ['zal-lowcov', 'tl', 'red'],
    ['zal-reval', 'main', 5],
    ['zal-ins', 'main', 4],
    ['zal-ban', 'main', 0],
    ['zal-reg', 'main', 0],
    ['zal-sale', 'main', 1]
  ],
  'u6|spec': [
    ['spec-work', 'main', 24],
    ['spec-work', 'second', 147670017],
    ['spec-ready', 'main', 4],
    ['spec-ready', 'tl', 'green'],
    ['spec-neg', 'main', 1],
    ['spec-neg', 'tl', 'red'],
    ['spec-work', 'slice(astatus)', [['Новый',8],['Требуется доп. информация',5],['На рассмотрении',8],['Ожидает решения/программы',2],['На оформлении',1]]],
    ['spec-stage', 'slice(astage)', [['1 Комплектация',5],['2 Подтверждение ГО',2],['3 Заключения отделов',1]]],
    ['spec-stage', 'main', 8],
    ['spec-dec', 'slice(decision)', [['Одобрено',18],['Доп. информация',5],['Отклонено',4]]],
    ['spec-dec', 'main', 27],
    ['spec-work', 'slice(program)', [['prom',8],['agro',8],['none',4],['tur',2],['mb',1],['per',1]]],
    ['spec-pend', 'main', 1],
    ['spec-pend', 'tl', 'yellow'],
    ['spec-filed', 'series(12)', prevEnd([2], [[3],[2],[1],[1],[1],[0],[5],[3],[2],[2],[2],[0]])]
  ],
  'u7|com': [
    ['com-vote', 'main', 5],
    ['com-late', 'main', 1],
    ['com-late', 'tl', 'red'],
    ['com-soon', 'main', 6],
    ['com-soon', 'tl', 'yellow'],
    ['com-noscan', 'main', 3],
    ['com-pend', 'main', 18],
    ['com-pend', 'second', 119834325],
    ['com-max', 'main', 27],
    ['com-pend', 'slice(commission)', [['Кредитный комитет',10],['Комиссия по реструктуризации',4],['Комиссия по программам',4]]],
    ['com-dec', 'slice(decision)', [['Одобрено',18],['Доп. информация',5],['Отклонено',4]]],
    ['com-dec', 'main', 27],
    ['com-dec', 'series(12)', prevEnd([25], [[35],[31],[28],[32],[24],[30],[33],[28],[31],[29],[27],[13]])]
  ],
  'u8|gof': [
    ['gof-wait', 'main', 13],
    ['gof-wait', 'second', 8],
    ['gof-wait', 'tl', 'yellow'],
    ['gof-compl', 'main', 34],
    ['gof-conf', 'main', 22],
    ['gof-conf', 'shift', 16],
    ['gof-wait', 'slice(region)', [['Чуйская',5],['Ошская',3],['Иссык-Кульская',2],['Джалал-Абадская',1],['Таласская',1],['Баткенская',1],['Нарынская',0]]]
  ],
  'u9|otd': [
    ['otd-pend', 'main', 4],
    ['otd-pend', 'second', 12],
    ['otd-pend', 'tl', 'yellow'],
    ['otd-neg', 'main', 1],
    ['otd-neg', 'tl', 'red'],
    ['otd-rev', 'main', 0],
    ['otd-verd', 'slice(verdict)', [['Положительное',20],['С условиями',4],['Отрицательное',2]]],
    ['otd-verd', 'main', 26]
  ],
  'u10|rep': [
    ['rep-od', 'main', 1],
    ['rep-od', 'tl', 'red'],
    ['rep-soon', 'main', 4],
    ['rep-soon', 'tl', 'yellow'],
    ['rep-chg', 'main', 0],
    ['rep-sum', 'slice(ostate)', [['сдано в срок',4],['сдано с опозданием',2],['просрочено',0]]],
    ['rep-sum', 'main', 6],
    ['rep-sum', 'series(12,second)', prevEnd([null], [[null],[null],[80],[75],[100],[100],[100],[85.714286],[85.714286],[60],[66.666667],[null]])]
  ],
  'u12|ast': [
    ['ast-count', 'second', 48],
    ['ast-count', 'main', 179045964],
    ['ast-count', 'table(imstate;asset.count)', [['принят, ждёт регистрации',4],['на учёте',30],['выставлен на продажу',8],['продан',6],['снят с учёта',0],['разделён',0],['принятие не состоялось',0]]],
    ['ast-idle', 'main', 3],
    ['ast-idle', 'tl', 'yellow'],
    ['ast-unsold', 'main', 5],
    ['ast-kpod', 'main', 1081759],
    ['ast-claim', 'main', 1045208],
    ['ast-exp', 'main', 2119518]
  ],
  };
  const eqv = (a, b) => typeof b === 'number' ? typeof a === 'number' && Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b)) : Array.isArray(b) ? Array.isArray(a) && a.length === b.length && b.every((y, i) => eqv(a[i], y)) : a === b;
  const srt = x => Array.isArray(x) && x.length && Array.isArray(x[0]) && typeof x[0][0] === 'string' ? [...x].sort((p, q) => p[0] < q[0] ? -1 : p[0] > q[0] ? 1 : 0) : x;
  const miss = []; let nLit = 0;
  for (const [sel, rows] of Object.entries(LIT)) { const [uid, rl2] = sel.split('|');
    for (const [id, ex, want] of rows) { nLit++; let got; try { got = at(id, ex, uid, rl2); } catch (e) { got = 'ERR ' + e.message; }
      if (/^move\(/.test(ex) && got && typeof got === 'object') got = [got.start, got.end, got.inc.map(x => x.v), got.dec.map(x => x.v), got.other];
      if (!eqv(srt(got), srt(want))) miss.push(`${sel} ${id} ${ex} → ${JSON.stringify(got).slice(0, 60)}`); } }
  ok(197, nLit === 109 && miss.length === 0,
    `${nLit} чисел новых плиток девяти ролей равны прежним значениям до слияния: главное, второе и его числитель со знаменателем, светофор, сдвиг, узлы Разрезов и Таблиц, Ряды, Движение${miss.length ? '; расходятся: ' + miss.join('; ') : ''}`);
  // намеренное изменение — с новыми числами: Разрез «На учёте» по состоянию — стоимость в сомах, счёт — в Таблице и втором числе
  const rI = at('ast-count', 'slice(imstate)', 'u12', 'ast'), mI = at('ast-count', 'main', 'u12', 'ast');
  ok(198, eqv(rI, [['принят, ждёт регистрации', 9777857], ['на учёте', 122325883], ['выставлен на продажу', 21777885], ['продан', 25164339], ['снят с учёта', 0], ['разделён', 0], ['принятие не состоялось', 0]])
    && sum(rI.map(x => x[1])) === mI && at('ast-count', 'slice(imstate).total', 'u12', 'ast') === mI && at('ast-count', 'second', 'u12', 'ast') === 48
    && sum(at('ast-count', 'table(imstate;asset.count)', 'u12', 'ast').map(x => x[1])) === 48,
    'Разрез «На учёте» по состоянию считает главное число плитки: учётная стоимость в сомах (9,8 · 122,3 · 21,8 · 25,2 млн, сумма = 179 млн), а не счёт объектов 4 · 30 · 8 · 6; счёт остался в Таблице «по состоянию · объектов» и во втором числе: 48');
  // отчёты после слияния: колонки и разрезы, на которых стоят виды новых плиток; плитки на правленых отчётах
  const R = id => DB.reportById(id), ids = r => DB.tilesOfReport(r).map(t => t.id).join();
  const RS = ['r-claims', 'r-assets', 'r-receipts', 'r-coll', 'r-apps', 'r-commwait', 'r-oblsum'], ORPH = ['r-claimphase', 'r-claimlead', 'r-rcsrc', 'r-collkind', 'r-appstat', 'r-appprog', 'r-appreg', 'r-commby', 'r-commser', 'r-concl', 'r-oblser', 'r-astate'];
  ok(199, R('r-claims').dims.join() === 'phase,leadDept' && R('r-assets').dims.join() === 'imstate' && R('r-receipts').dims.join() === 'source' && R('r-coll').cols.join() === 'coll.value,coll.count' && R('r-coll').dims.join() === 'ckind'
    && R('r-apps').dims.join() === 'astatus,program' && R('r-commwait').dims.join() === 'commission' && R('r-oblsum').cols.join() === 'oblig.submitted,oblig.onTime' && R('r-oblsum').dims.join() === 'ostate'
    && ids('r-claims') === 'lead-claims,prob-claims,prob-since,prob-real' && ids('r-assets') === 'lead-ast,lead-astod,ast-count,ast-kpod,ast-claim' && ids('r-receipts') === 'acc-today,acc-prev,acc-refund,acc-rev'
    && ids('r-coll') === 'zal-value' && ids('r-apps') === 'spec-work,gof-compl' && ids('r-commwait') === 'com-pend,com-max' && ids('r-oblsum') === 'rep-sum'
    && RS.every(r => DB.tilesOfReport(r).every(t => !DB.reportBroken(t) && DB.ask(t, U(t.id.startsWith('lead') ? 'u1' : RU[t.id.split('-')[0]]), t.id.startsWith('lead') ? 'lead' : t.id.split('-')[0], {}).state !== 'broken'))
    && ORPH.every(r => R(r) && DB.tilesOfReport(r).length === 0),
    'отчёты слияния: «Требования» с фазой и подразделением, «Имущество» с состоянием, «Поступления» с источником, «Предметы залога» со стоимостью первой и видом, «Заявки» со статусом и программой, «Комиссия» с комиссиями, «Итог сдачи» с долей «в срок»; плитки на них не сломаны (на «Требованиях» четыре вместо пяти); 12 отчётов бывших плиток остаются в каталоге без плиток');
  // ссылочные плитки: второе число — показатель очереди, светофор на нём; очереди объявили показатель и разрез
  const qw = DB.queueById('q-waitgo'), qc = DB.queueById('q-conclpend'), qt = DB.queueById('q-tasks'), u8 = U('u8'), u9 = U('u9');
  const gw = DB.base('gof-wait', 'u8', 'gof'), op = DB.base('otd-pend', 'u9', 'otd');
  const wMax = DB.answer(DB.compile(R('r-apps'), {}, { inds:['app.waitGoMax'] }), u8, 'gof', {}).value;
  const gOnMain = DB.ask(Object.assign({}, T('gof-wait'), { tl:{ yellow:['>', 10], green:false, on:'main' } }), u8, 'gof', {}).tl, gOnSecond = DB.ask(Object.assign({}, T('gof-wait'), { tl:{ yellow:['>', 10], green:false, on:'second' } }), u8, 'gof', {}).tl;
  const oOnMain = DB.ask(Object.assign({}, T('otd-pend'), { tl:{ yellow:['>', 10], green:false, on:'main' } }), u9, 'otd', {}).tl;
  const au = DB.base('acc-unident', 'u4', 'acc');
  ok(200, qw.inds.join() === 'app.waitGo,app.waitGoMax' && qw.dims.join() === 'region' && qc.inds.join() === 'concl.pending,concl.waitMax' && qc.dims.length === 0 && qt.inds.join() === 'task.mine,task.overdue'
    && T('gof-wait').kind === 'link' && T('gof-wait').queue === 'q-waitgo' && !T('gof-wait').report && T('gof-wait').second.col === 'app.waitGoMax' && T('gof-wait').tl.on === 'second'
    && T('otd-pend').kind === 'link' && T('otd-pend').queue === 'q-conclpend' && T('otd-pend').second.col === 'concl.waitMax' && T('otd-pend').tl.on === 'second'
    && gw.value === 13 && gw.second.value === 8 && gw.second.value === wMax && gw.second.unit === 'days' && gw.tl === 'yellow' && gOnMain === 'yellow' && gOnSecond === null
    && op.value === 4 && op.second.value === 12 && op.second.value === DB.answer(DB.compile(R('r-concl'), {}, { inds:['concl.waitMax'] }), u9, 'otd', {}).value && op.tl === 'yellow' && oOnMain === null
    && au.second.value === 507717 && au.second.unit === 'sum' && au.tl === 'yellow' && DB.base('tasks', 'u3', 'prob').second.label === 'просрочено' && T('tasks').second.col === 'task.overdue' && T('tasks').kind === 'link' && T('tasks').queue === 'q-tasks',
    `ссылочная плитка берёт второе число у очереди: «Ждут подтверждения комплекта» — ${gw.value} и наибольшее ожидание ${gw.second.value} дн. (= прежней «Наибольшее ожидание»), светофор жёлтый (> 7) стоит на втором; «Ждут нашего заключения» — ${op.value} и ${op.second.value} дн., жёлтый (> 10) на втором, по главному ${oOnMain === null ? 'не загорелся бы' : 'загорелся'}; «Невыясненные поступления» — сумма ${au.second.value}; у «Мои задания» второе — «просрочено» (блок P ниже)`);
  // клик по числу ссылочной плитки — очередь; виды погашены, кроме разрезов, объявленных очередью: Разрез и Таблица «Ждут подтверждения» по областям
  const links = DB.TILES.filter(t => t.kind === 'link'), vw = (id, uid, role, path, panel) => Object.fromEntries(DB.views(id, uid, role, path, panel).map(x => [x.kind, x]));
  const gv = vw('gof-wait', 'u8', 'gof'), gr = DB.view('gof-wait', 'slice', null, [], 'u8', 'gof', {}), gt = DB.view('gof-wait', 'table', null, [], 'u8', 'gof', {}), gp = vw('gof-wait', 'u8', 'gof', [], { region:'Ошская' });
  const oth = links.filter(t => t.id !== 'gof-wait' && ['tasks', 'otd-pend', 'otd-neg'].includes(t.id));   // очереди без объявленных разрезов; остальные — блок P ниже
  const who = id => id === 'tasks' ? ['u3', 'prob'] : [RU[id.split('-')[0]], id.split('-')[0]];
  ok(201, links.length === 19 && links.every(t => DB.clickOf(t.id, 'u1', 'lead', {}).act === 'queue')
    && gv.slice.ok && gv.table.ok && !gv.series.ok && !gv.move.ok && !gv.map.ok && /свободных 1/.test(gv.map.why) && gr.sel.dim === 'region' && gr.total.v === 13 && sum(gr.nodes.map(n => n.value)) === 13
    && gt.table.d === 'region' && gt.table.rows.length === 7 && !gp.slice.ok && !gp.table.ok && gp.slice.why === 'разрез очереди зафиксирован фильтром панели'
    && oth.every(t => { const [uid, role] = who(t.id); const v = vw(t.id, uid, role); return ['slice', 'table', 'map', 'move'].every(k => !v[k].ok && v[k].why) && v.slice.why === 'очередь модуля не объявила разрезов' && v.series.ok === (t.id === 'zal-lowcov') && (v.series.ok || v.series.why === 'показатель без истории'); }) && DB.dimsFor('otd-pend').length === 0 && DB.dimsFor('otd-neg').length === 0 && DB.dimsFor('tasks').length === 0 && DB.dimsFor('gof-wait').map(d => d.dim).join() === 'region',
    'клик по числу любой из 19 ссылочных плиток открывает очередь; видов у них нет, кроме разрезов, которые объявила очередь: у «Ждут подтверждения комплекта» Разрез и Таблица по областям (13 = 5 + 3 + 2 + 1 + 1 + 1 + 0), Карта, Ряд и Движение погашены с причиной; фильтр панели «Область» разрез зафиксировал — вид погашен с причиной; у «Мои задания» и двух очередей отдела («Ждут нашего заключения», «Наше отрицательное») очередь разрезов не объявила: Разреза, Таблицы, Карты и Движения нет, причина названа, Ряда нет (показатель без истории); у очередей с разрезами — блок P ниже');
  // умолчания видов объединённых плиток
  const vsel = (id, kind, uid, role, sel) => DB.view(id, kind, sel || null, [], uid, role, {}).sel;
  ok(202, vsel('prob-claims', 'slice', 'u3', 'prob').dim === 'phase' && vsel('prob-claims', 'map', 'u3', 'prob').dims.join() === 'leadDept,phase' && DB.dimsFor('prob-claims').map(d => d.dim + (d.temp ? '*' : '')).join() === 'phase,leadDept,region*'
    && vsel('spec-work', 'slice', 'u6', 'spec').dim === 'astatus' && DB.dimsFor('spec-work').slice(0, 2).every(d => !d.temp) && DB.dimsFor('spec-work').slice(0, 2).map(d => d.dim).join() === 'astatus,program'
    && vsel('zal-value', 'slice', 'u5', 'zal').dim === 'ckind' && at('zal-value', 'move(0)', 'u5', 'zal').end === at('zal-value', 'main', 'u5', 'zal')
    && vsel('acc-prev', 'series', 'u4', 'acc').of === 'main' && vsel('acc-prev', 'slice', 'u4', 'acc').dim === 'source' && vsel('com-pend', 'slice', 'u7', 'com').dim === 'commission' && vsel('com-dec', 'slice', 'u7', 'com').dim === 'decision'
    && vsel('rep-sum', 'series', 'u10', 'rep').of === 'second' && vsel('rep-sum', 'slice', 'u10', 'rep').dim === 'ostate' && vsel('ast-count', 'slice', 'u12', 'ast').top === 4 && vsel('prob-rec', 'series', 'u3', 'prob').points === 12
    && at('prob-claims', 'map(leadDept,phase).total', 'u3', 'prob') === 53 && at('rep-sum', 'second.num', 'u10', 'rep') === 4 && at('rep-sum', 'second.den', 'u10', 'rep') === 6 && near(at('rep-sum', 'second', 'u10', 'rep'), 66.67),
    'умолчания видов объединённых плиток: «Требований» — Разрез по фазам и Карта подразделение × фаза (53), «Заявок в работе» — Разрез по статусу и по программам (оба объявлены отчётом), «Залоговая стоимость» — Разрез по видам и Движение, «Поступило» — Ряд и Разрез по источнику, «Итог сдачи» — Ряд доли «в срок» и Разрез по состоянию (4 из 6), «На учёте» — Разрез по состоянию, топ 4');
  DB.seed();
})();

/* ---------- P (продолжение). Конструктор на модели основы: черновик, автопроверка, правка, «📌 сохранить отчётом» ---------- */
(() => {
  DB.seed(); asUser('u1');
  const u1 = U('u1'), near = (a, b) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-6;
  const bad = (a, re) => !a.ok && a.checks.some(c => !c.ok && re.test(c.text)), on = (rid, o) => DB.autocheck(Object.assign(DB.blankDraft(rid), { title:'x' }, o));
  const at0 = (id, x, uid = 'u1', role = 'lead') => DB.at(id, x, uid, role, {});
  const asT = (d, id) => Object.assign({ id }, d), KEYS = 'report,params,main,second,shift,tl,views,title';
  const noOld = () => DB.TILES.every(t => !['pick', 'format', 'level', 'top', 'points', 'mvMonth'].some(k => k in t));
  // черновик: главное — первая колонка, второго нет, умолчания видов — первые разрезы отчёта, колонки Таблицы — того же рода
  const dp = DB.blankDraft('r-portfolio'), dr = DB.blankDraft('r-receipts'), dn = DB.blankDraft('r-loans'), pin = DB.pinFromReport('r-portfolio');
  ok(203, Object.keys(dp).join() === KEYS && dp.main.col === 'loan.balance' && dp.second === null && dp.shift === null && dp.tl === null && dp.title === ''
    && dp.views.slice.dim === 'bucket' && dp.views.slice.top === 3 && dp.views.map.dims.join() === 'bucket,category' && dp.views.table.dim === 'bucket'
    && dp.views.table.cols.join() === 'loan.balance,loan.count,loan.overdue,loan.risk' && dp.views.series.points === 12 && dp.views.series.of === 'main' && dp.views.move.month === 0
    && dr.params.period === 'curMonth' && dr.main.col === 'receipt.amount' && dr.views.table.cols.length === 3 && dr.views.table.cols.every(i => DB.IND[i].kind !== 'stock')
    && !('dim' in dn.views.slice) && !dn.views.map && dn.views.table.cols.join() === 'loan.count'
    && Object.keys(pin).join() === KEYS && pin.main.col === 'loan.balance' && pin.second.col === 'loan.count' && pin.second.label === 'кредитов' && pin.title === 'Портфель кредитов',
    `черновик плитки — ${KEYS}: главное — первая колонка отчёта, второго нет, умолчания видов — первые разрезы отчёта (Разрез «по сроку», Карта «срок × категория»), Таблица — до четырёх колонок того же рода; «📌 на дашборд» берёт второй колонкой «Кредитов» (ДБ-116, ДБ-127)`);
  // автопроверка: ошибки
  const e = {
    obj:on('r-loans', { second:{ col:'borrower.count' } }), same:on('r-portfolio', { second:{ col:'loan.balance' } }), sameOf:on('r-portfolio', { second:{ of:'loan.balance' } }),
    ofShare:on('r-portfolio', { main:{ share:['loan.overdue', 'loan.balance'] }, second:{ of:'loan.count' } }),
    tlMiss:on('r-portfolio', { tl:{ red:['>', 5], green:true, on:'second' } }), tlOp:on('r-portfolio', { tl:{ red:['=', 5], on:'main' } }), tlOn:on('r-portfolio', { tl:{ red:['>', 5], on:'third' } }),
    map1:on('r-portfolio', { views:{ map:{ dims:['bucket'] } } }), t5:on('r-portfolio', { views:{ table:{ dim:'bucket', cols:['loan.balance', 'loan.count', 'loan.overdue', 'loan.risk', 'loan.restr'] } } }),
    tMix:on('r-portfolio', { views:{ table:{ dim:'bucket', cols:['loan.balance', 'loan.issued'] } } }), pts:on('r-portfolio', { views:{ series:{ points:7 } } }),
    mon:on('r-portfolio', { views:{ move:{ month:2 } } }), noDim:on('r-portfolio', { views:{ slice:{ dim:'nosuch' } } }), alien:on('r-portfolio', { views:{ slice:{ dim:'bworst' } } }),
    serSec:on('r-portfolio', { views:{ series:{ points:12, of:'second' } } }), noMain:on('r-portfolio', { main:null }), kind:on('r-portfolio', { views:{ chart:{} } }) };
  ok(204, bad(e.obj, /один объект/) && bad(e.same, /не повторяет главное/) && bad(e.sameOf, /не повторяет главное/) && bad(e.ofShare, /«из N» — у главного числа-колонки/)
    && bad(e.tlMiss, /второго числа у плитки нет/) && bad(e.tlOp, /пороги светофора/) && bad(e.tlOn, /на главном или на втором/)
    && bad(e.map1, /два разных разреза/) && bad(e.t5, /до четырёх колонок/) && bad(e.tMix, /одного рода с главным/) && bad(e.pts, /6, 12 или 24/) && bad(e.mon, /текущий или прошлый/)
    && bad(e.noDim, /нет «nosuch»/) && bad(e.alien, /нет «bworst»/) && bad(e.serSec, /ряд по второму числу/) && bad(e.noMain, /главное число/) && bad(e.kind, /таких видов нет/)
    && Object.values(e).every(a => a.checks.filter(c => !c.ok).length >= 1),
    'автопроверка плитки: второе число другого объекта, повторяющее главное, «из N» у доли; светофор на втором без второго, с порогом не «больше/меньше», на третьем числе; Карта из одного разреза; Таблица больше четырёх колонок или разного рода; 7 точек ряда, месяц движения не из списка; разрез вида, которого нет или чужого объекта; ряд по второму без второго; без главного; вид, которого нет — отказ с причиной (ДБ-116, ДБ-127, ДБ-128)');
  // автопроверка: допускает умолчание вида, которому нечего показать (вид погашен), разрез и колонку объекта не из отчёта
  const gf = on('r-form', {}), vf = DB.views(asT(Object.assign(DB.blankDraft('r-form'), { title:'x' }), 'gf'), 'u1', 'lead');
  const gm = on('r-borrowers', { views:{ move:{ month:-1 } } }), vm0 = DB.views(asT(Object.assign(DB.blankDraft('r-borrowers'), { title:'x', views:{ move:{ month:-1 } } }), 'gm'), 'u1', 'lead');
  const gt = on('r-bucket', { views:{ slice:{ dim:'region', top:5 }, table:{ dim:'bucket', cols:['loan.count', 'loan.balance'] } } });
  const gtv = DB.view(asT(Object.assign(DB.blankDraft('r-bucket'), { title:'x', views:{ slice:{ dim:'region', top:5 } } }), 'gt'), 'slice', null, [], 'u1', 'lead', {});
  ok(205, gf.ok && !vf.find(v => v.kind === 'series').ok && gm.ok && !vm0.find(v => v.kind === 'move').ok && gt.ok && gtv.sel.dim === 'region' && gtv.sel.top === 5 && gtv.temp,
    `умолчание вида, которому нечего показать, допустимо — вид погашен («${vf.find(v => v.kind === 'series').why}», «${vm0.find(v => v.kind === 'move').why}»); разрез и колонка объекта не из отчёта — на время просмотра (ДБ-119, ДБ-126, ДБ-128)`);
  // правка плитки: TILE_EDIT, версия, та же автопроверка; поля старой формы отвергаются
  asUser('u11');
  const ed1 = DB.editTile('lead-od', { views:Object.assign({}, T('lead-od').views, { slice:{ dim:'region', top:5 } }) }), vv1 = T('lead-od').version;
  const sl1 = DB.view('lead-od', 'slice', null, [], 'u1', 'lead', {}).sel;
  const ed2 = DB.editTile('lead-od', { second:{ col:'loan.count', label:'кредитов' }, tl:{ red:['>', 1000], green:true, on:'second' } }), vv2 = T('lead-od').version, b2 = DB.base('lead-od', 'u1', 'lead');
  const ePick = DB.editTile('lead-od', { pick:{ cols:[] } }), eFmt = DB.editTile('lead-od', { format:'table' }), eSame = DB.editTile('lead-od', { second:{ col:'loan.overdue' } });
  const eTl = DB.editTile('lead-od', { second:null }), vv3 = T('lead-od').version; asUser('u1');
  ok(206, DB.TILE_EDIT.join() === 'params,main,second,shift,tl,title,views' && ed1.tile && vv1 === 2 && sl1.dim === 'region' && sl1.top === 5
    && ed2.tile && vv2 === 3 && b2.second.label === 'кредитов' && b2.second.unit !== 'pct' && b2.tl === 'red'
    && ePick.error && /правятся в отчёте/.test(ePick.error) && eFmt.error && eSame.error && eSame.checks.some(c => !c.ok && /не повторяет главное/.test(c.text))
    && eTl.error && eTl.checks.some(c => !c.ok && /второго числа у плитки нет/.test(c.text)) && vv3 === 3 && T('lead-od').second.col === 'loan.count' && noOld(),
    `правка плитки — ${DB.TILE_EDIT.join(', ')}: умолчание Разреза — версия ${vv1}, второе число и светофор на нём — версия ${vv2}; «pick», «format», второе = главному, снятие второго под светофором — отказ, версия та же (ДБ-113, ДБ-116, ДБ-127)`);
  // «Сохранить и поставить» и «взять его»: главное — первый показатель, второе — второй того же рода или доля, умолчания видов — разрезы отчёта
  DB.seed(); asUser('u1');
  const rd = Object.assign(DB.blankReportDraft(), { title:'Просрочка по областям и срокам', inds:['loan.overdue', 'loan.balance'], dims:['region', 'bucket'] });
  const sp = DB.saveAndPlace(rd, 'lead'), tp = sp.tile, bp = DB.base(tp.id, 'u1', 'lead'), lo = DB.base('lead-od', 'u1', 'lead');
  const sh = DB.saveAndPlace(Object.assign({}, rd, { title:'Доля просрочки по областям', share:['loan.overdue', 'loan.balance'] }), 'lead').tile, bs = DB.base(sh.id, 'u1', 'lead');
  DB.newReportDraft(); DB.rDim('bucket', true); DB.rCondDel('filter', 0); DB.rCond('filter', 'f', 'overdueDays'); DB.rCond('filter', 'op', 'gt'); DB.rCond('filter', 'v', '0'); DB.rCondAdd('filter');
  const tk = DB.rTake('r-bucket');
  ok(207, sp.report && tp.main.col === 'loan.overdue' && tp.second.col === 'loan.balance' && tp.second.label === 'остаток задолженности' && tp.views.slice.dim === 'region'
    && tp.views.map.dims.join() === 'region,bucket' && tp.views.table.cols.join() === 'loan.overdue,loan.balance' && tp.shift === null && tp.tl === null && Object.keys(tp).every(k => KEYS.includes(k) || ['id', 'kind', 'owner', 'state', 'version', 'created'].includes(k))
    && bp.state === 'ok' && near(bp.value, lo.value) && sh.second.share.join() === 'loan.overdue,loan.balance' && /от «Остаток задолженности»/.test(sh.second.label) && near(bs.second.value, lo.second.value)
    && tk && tk.main.col === 'loan.count' && tk.second === null && tk.views.slice.dim === 'bucket' && noOld(),
    `«Сохранить и поставить»: главное «Просрочено» = ${DB.fmtVal(bp.value, 'sum')} как у Руководства, второе — «${tp.second.label}» или доля «${sh.second.label}» = ${DB.fmtVal(bs.second.value, 'pct')}; умолчания видов — разрезы отчёта; «взять его» — главное «Кредитов» на «${DB.reportById('r-bucket').title}» (ДБ-103, ДБ-116, ДБ-127)`);
  // «📌 сохранить отчётом»: путь — постоянное условие, разрез вида на время просмотра — разрез отчёта; плитка на новом отчёте отвечает числом узла полосы
  DB.seed(); asUser('u1');
  DB.openView('lead-od', 'slice'); DB.viewSet('lead-od', 'dim', 'region'); const osh = at0('lead-od', 'slice(region)').find(x => x[0] === 'Ошская')[1];
  DB.deeper('lead-od', 'region', 'Ошская'); DB.viewSet('lead-od', 'dim', 'dept'); const sv = DB.view('lead-od', 'slice', DB.state.open['lead-od'].sel, DB.state.open['lead-od'].path, 'u1', 'lead', {});
  const html = DB.stripHTML('lead-od', 'u1', 'lead'), rds = DB.saveAsReport('lead-od'), simS = DB.similarReport(rds, u1);
  const placed = DB.rSaveAndPlace(), nr = placed.report, nt = placed.tile, nb = DB.base(nt.id, 'u1', 'lead'), nv = DB.view(nt.id, 'slice', null, [], 'u1', 'lead', {});
  ok(208, sv.temp && near(sv.total.v, osh) && /DB\.saveAsReport\('lead-od'\)">📌 сохранить отчётом/.test(html) && rds && rds.obj === 'loan'
    && rds.inds.join() === 'loan.overdue,loan.balance' && rds.dims.join() === 'dept' && JSON.stringify(rds.filter) === JSON.stringify([{ f:'lact', op:'eq', v:'действующий' }, { f:'region', op:'eq', v:'Ошская' }])
    && rds.date === 'today' && rds.share === null && /Ошская/.test(rds.title) && simS === null
    && nr.shelf === 'personal' && nr.owner === 'u1' && nr.dims.join() === 'dept' && nr.filter.some(c => c.f === 'region' && c.v === 'Ошская') && nt.state === 'personal' && nt.owner === 'u1'
    && DB.composeLayout('u1', 'lead').includes(nt.id) && nb.state === 'ok' && near(nb.value, osh) && nv.sel.dim === 'dept' && !nv.temp && near(nv.total.v, osh) && DB.rdraft === null,
    `«📌 сохранить отчётом» из полосы «Просрочено › Ошская» по подразделению (на время просмотра): отчёт «${nr.title}» — разрез «подразделение», «область = Ошская» постоянным условием; личная плитка на нём отвечает ${DB.fmtVal(nb.value, 'sum')} = узлу «Ошская» полосы (ДБ-126)`);
  // «я» плитки уходит параметром отчёта, Таблица полосы — колонками отчёта; похожий отчёт называется
  DB.seed(); asUser('u2');
  DB.openView('cur-od', 'table'); DB.viewSet('cur-od', 'dim', 'bucket'); DB.viewSet('cur-od', 'cols', ['loan.count', 'loan.overdue']);
  const cn = at0('cur-od', 'table(bucket;loan.count,loan.overdue).total', 'u2', 'cur'), rdc = DB.saveAsReport('cur-od'), simC = DB.similarReport(rdc, U('u2'));
  const pc = DB.rSaveAndPlace(), bc = DB.base(pc.tile.id, 'u2', 'cur'), cb = DB.base('cur-od', 'u2', 'cur');
  DB.seed(); asUser('u1'); DB.openView('lead-borr', 'slice'); DB.viewSet('lead-borr', 'dim', 'bover'); const rdb = DB.saveAsReport('lead-borr'), simB = DB.similarReport(rdb, u1);
  const lk = DB.saveAsReport('tasks');
  ok(209, rdc.inds.join() === 'loan.overdue,loan.balance,loan.count' && rdc.dims.join() === 'bucket' && rdc.filter.some(c => c.f === 'curator' && c.v === '@me')
    && pc.report.params.curator && pc.report.params.curator.dim === 'curator' && pc.tile.params.curator === '@me' && !pc.report.filter.some(c => String(c.v).startsWith('@'))
    && bc.state === 'ok' && near(bc.value, cb.value) && near(bc.value, cn[1]) && simC === null
    && simB && simB.r.id === 'r-borover' && rdb.dims.join() === 'bover' && lk.error,
    `«я» куратора — параметр нового отчёта, значение у плитки (${DB.fmtVal(bc.value, 'sum')} = «Просрочено» куратора); колонки Таблицы полосы — колонки отчёта: ${rdc.inds.join(', ')}; полоса «Заёмщиков» по «Договоров с просрочкой» узнаёт «${simB && simB.r.title}» — «похожий уже есть»; у ссылочной плитки — отказ (ДБ-126, ДБ-103, ДБ-128)`);
  // конструктор: обработчики новой модели; сдвиг подгоняется под дату; старых обработчиков и полей нет нигде
  DB.seed(); asUser('u1');
  DB.newDraft('r-portfolio'); const s0 = DB.dShift('prevMonthEnd'); DB.dParam('date', 'prevMonthEnd'); const s1 = DB.draft.shift, sOff = DB.dShift('prevMonthEnd'), s2 = DB.draft.shift;
  DB.dMain('col', 'loan.overdue'); DB.dSecond('pct', 'loan.count', 'bucket', ['181+', 'нет такой']); const pc2 = DB.draft.second;
  DB.dSecond('of', 'loan.balance'); DB.dTl('on', 'second'); DB.dTl('red', '>', '100'); const tl2 = DB.draft.tl; DB.dView('series', 'of', 'second'); DB.dView('map', 'dims', ['region', 'program']);
  DB.dTitle('проба'); const acx = DB.autocheck(DB.draft), saved = DB.saveDraft('personal').tile;
  const ed = DB.editTile(saved.id, { title:'проба 2' }), script = src.match(/<script>([\s\S]*?)<\/script>/)[1];
  ok(210, s0 === 'prevMonthEnd' && s1 === 'yearStart' && sOff === undefined && s2 === 'yearStart' && pc2.pct.dim === 'bucket' && pc2.pct.cells.join() === '181+' && pc2.label === 'от итога группы'
    && tl2.on === 'second' && tl2.red.join() === '>,100' && acx.ok && saved && saved.second.of === 'loan.balance' && saved.views.map.dims.join() === 'region,program' && saved.views.series.of === 'second'
    && ed.tile && noOld() && !['legacyToTile', 'tileModel', 'formatsFor', 'FORMAT_NAMES', 'SIZE', 'dCol', 'dLevel', 'dTop', 'dShare', 'dPct', 'dSet'].some(k => k in DB)
    && ['dMain', 'dSecond', 'dShift', 'dTl', 'dView', 'dTitle', 'dParam', 'saveAsReport'].every(k => typeof DB[k] === 'function')
    && !/\b(t|tile|d|nx|x|rd)\.(format|level|top|points|mvMonth|pick)\b/.test(script) && !/legacyToTile|tileModel|pickCols|fitFormat|formatsFor|cleanPick|previewHTML|sizeClass|formatsOfQ/.test(script),
    'конструктор: база сдвига, совпавшая с датой, сменяется первой допустимой; «% от итога группы» берёт только ячейки разреза; «из N», светофор на втором, умолчания Ряда и Карты сохраняются в плитку; ни у одной плитки нет pick/format/level/top/points/mvMonth — после saveTile, editTile, saveAndPlace; переходника и старых обработчиков нет, шлюз чист (ДБ-115, ДБ-116, ДБ-127)');
  DB.seed();
})();

/* ---------- P (продолжение). Виды ссылочных плиток, «Мои задания», «доля» в Таблице, выгрузка вида со штампом ---------- */
(() => {
  DB.seed(); asUser('u1'); DB.setTab('role', 'lead');
  const near = (a, b) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-6;
  const RU = { acc:'u4', zal:'u5', spec:'u6', com:'u7', gof:'u8', otd:'u9' }, who = id => id === 'tasks' ? ['u3', 'prob'] : [RU[id.split('-')[0]], id.split('-')[0]];
  const vw = (id, uid, role, path, panel) => Object.fromEntries(DB.views(id, uid, role, path, panel).map(x => [x.kind, x]));
  const at = (id, x, uid = 'u1', role = 'lead', panel = {}) => DB.at(id, x, uid, role, panel);
  // очереди объявили разрезы там, где у объекта они есть; три очереди без разрезов остались погашенными
  const QDIMS = { 'q-unident':'rwait,source', 'q-await':'rwait,source', 'q-unm':'rwait,source', 'q-lowcov':'program,category,region', 'q-reval':'ckind,region', 'q-ins':'ckind,region', 'q-ban':'ckind,region', 'q-reg':'ckind,region', 'q-sale':'ckind,region',
    'q-ready':'program', 'q-neg':'program', 'q-waitgo':'region', 'q-vote':'commission', 'q-late':'commission', 'q-soon':'commission', 'q-noscan':'commission,decision', 'q-tasks':'', 'q-conclpend':'', 'q-conclneg':'' };
  const inObj = DB.QUEUES.every(q => q.dims.every(d => DB.DIMS[d] && (DB.OBJ_DIMS[DB.IND[q.inds[0]].obj].includes(d) || DB.DIMS[d].queueOnly)));
  ok(211, DB.QUEUES.length === 19 && Object.entries(QDIMS).every(([id, d]) => DB.queueById(id).dims.join() === d) && inObj
    && DB.QUEUES.filter(q => !q.dims.length).map(q => q.id).join() === 'q-tasks,q-conclpend,q-conclneg'
    && DB.DIMS.rwait.ordered && DB.DIMS.rwait.values.join() === 'до 3 дн.,4–10,11+' && !!DB.DIMS.rwait.req && DB.DIMS.rwait.queueOnly === true && DB.OBJ_DIMS.receipt.join() === 'source' && DB.DIMS.rwait.queueOnly && DB.QUEUES.filter(q => q.dims.includes('rwait')).length === 3 && !DB.dimsFor('acc-today').some(d => d.dim === 'rwait') && !DB.dimsFor('acc-unalloc').some(d => d.dim === 'rwait'),
    'очереди объявили разрезы у объекта: поступления — срок ожидания и источник, залог — вид и область, обеспеченность — программа, категория, область, заявки — программа, комиссия — комиссия (скан протокола — ещё решение), ждут подтверждения ГО — область как была; «Мои задания», «Ждут нашего заключения», «Наше отрицательное» разрезов не объявили — у них и дальше погашены; срок ожидания — разрез с порядком и заявкой статистике, только у очередей: у отчётных плиток по поступлениям его нет, там часть строк (уже распределённые) без срока (ДБ-120)');
  // поле «срок ожидания» поступлений — своим генератором после прежних: прежние числа очередей на месте
  const rc = DB.DATA.receipt, nonAl = rc.filter(r => r.state !== 'распределено'), wd = r => r.at === 0 ? 11 - r.day : 11 - r.day + 30;
  const unm = DB.view('acc-unm', 'slice', null, [], 'u4', 'acc', {}), uni = DB.view('acc-unident', 'slice', null, [], 'u4', 'acc', {}), awt = DB.view('acc-await', 'slice', null, [], 'u4', 'acc', {});
  ok(212, rc.length === 5200 && nonAl.length === 18 && nonAl.every(r => r.waitDays === wd(r)) && rc.filter(r => r.state === 'распределено').every(r => r.waitDays === null) && DB.DATA.task.length === 40
    && DB.base('acc-unident', 'u4', 'acc').value === 1 && DB.base('acc-unident', 'u4', 'acc').second.value === 507717 && DB.base('acc-await', 'u4', 'acc').value === 1 && DB.base('acc-unm', 'u4', 'acc').value === 16
    && unm.format === 'steps' && unm.sel.dim === 'rwait' && unm.nodes.map(n => n.value).join() === '7,8,1' && uni.nodes.map(n => n.value).join() === '0,1,0' && awt.nodes.map(n => n.value).join() === '1,0,0',
    `срок ожидания поступления — дни от даты поступления, пока оно не распределено (18 строк, остальные пустые; случайных чисел нет, прежние данные не сдвинулись): «Незакрыжено» 16 = ${unm.nodes.map(n => n.label + ' ' + n.value).join(' · ')}, «Невыясненные» 1 — ${uni.nodes.find(n => n.value).label}, «Ожидают подтверждения» 1 — до 3 дн.; числа очередей прежние: 1 · 507 717 · 1 · 16 (ДБ-120)`);
  // виды ссылочных плиток по объявленным разрезам: Разрез = числу, Таблица и Карта по числу разрезов, клик по числу — очередь
  const links = DB.TILES.filter(t => t.kind === 'link'), nd = t => DB.queueById(t.queue).dims.length;
  const lk = links.map(t => { const [uid, role] = who(t.id), v = vw(t.id, uid, role), b = DB.base(t.id, uid, role), n = nd(t), s = n ? DB.view(t.id, 'slice', null, [], uid, role, {}) : null, dl = DB.dimsFor(t.id);
    const good = n ? v.slice.ok && v.table.ok && v.map.ok === (n >= 2) && s.total.v === b.value && sum(s.nodes.map(x => x.value)) === b.value && dl.map(d => d.dim).join() === DB.queueById(t.queue).dims.join() && dl.every(d => !d.temp)
      : !v.slice.ok && !v.table.ok && !v.map.ok && v.slice.why === 'очередь модуля не объявила разрезов' && dl.length === 0;
    return { id:t.id, n, good:good && !v.move.ok && v.series.ok === (t.id === 'zal-lowcov') && DB.clickOf(t.id, 'u1', 'lead', {}).act === 'queue' }; });
  const pz = vw('zal-reval', 'u5', 'zal', [], { region:'Ошская' });
  const au = DB.view('acc-unident', 'table', null, [], 'u4', 'acc', {});
  asUser('u4'); DB.setTab('role', 'acc'); DB.openView('acc-unident', 'slice'); const hs = DB.stripHTML('acc-unident', 'u4', 'acc'); DB.state.open = {}; asUser('u1'); DB.setTab('role', 'lead');
  ok(213, links.length === 19 && lk.every(x => x.good) && lk.filter(x => x.n).length === 16 && lk.filter(x => !x.n).map(x => x.id).join() === 'tasks,otd-pend,otd-neg'
    && !pz.map.ok && pz.slice.ok && DB.dimsFor('zal-reval', [], { region:'Ошская' }).map(d => d.dim).join() === 'ckind' && /свободных 1/.test(pz.map.why)
    && au.table.cols.map(c => c.name).join() === 'Невыясненные поступления,Сумма невыясненных' && au.table.d === 'rwait' && au.total.join() === '1,507717' && at('acc-unident', 'table(rwait;receipt.unident,receipt.unidentSum).total', 'u4', 'acc').join() === '1,507717'
    && at('acc-unm', 'slice(rwait).total>source=Импорт ЦК', 'u4', 'acc') === at('acc-unm', 'main>source=Импорт ЦК', 'u4', 'acc') && DB.reqOf(T('acc-unident')).length === 0
    && /<option value="rwait" selected>⚑ Срок ожидания/.test(hs) && /class="ctl">[\s\S]*class="req"/.test(hs),
    `у 16 ссылочных плиток из 19 открывается Разрез (по первому объявленному разрезу) и Таблица, Карта — где разрезов два; сумма Разреза = числу плитки (например «Незакрыжено» ${unm.total.v} = 7 + 8 + 1), путь «источник» несёт число; клик по числу любой из 19 — очередь; у «Мои задания» и двух очередей отдела виды погашены с причиной; фильтр панели «Область» фиксирует разрез, остаётся «вид залога»; ⚑ у срока ожидания — в полосе, не на плитке (ДБ-120, ДБ-129)`);
  // «Мои задания»: второе число «просрочено» со светофором; «в очередях моих ролей» у объекта без разрезов выразить нечем
  const od = u => DB.DATA.task.filter(x => x.assignee === u.id && x.dueIn < 0).length, bs = DB.USERS.map(u => [u, DB.base('tasks', u.id, u.roles[0])]);
  const MAIN = { u1:2, u2:5, u3:4, u5:6, u6:4, u8:2, u9:3, u10:4, u11:1, u12:3 };
  const t2 = DB.base('tasks', 'u2', 'cur'), t6 = DB.base('tasks', 'u6', 'spec'), h2 = DB.tileHTML('tasks', 'u2', 'cur'), h6 = DB.tileHTML('tasks', 'u6', 'spec'), vt = vw('tasks', 'u2', 'cur'), dr = DB.drill('tasks', U('u2'), 'cur', {});
  const orow = DB.DATA.task.find(x => x.dueIn < 0), hrow = DB.DATA.task.find(x => x.hot && x.dueIn >= 0);
  ok(214, bs.every(([u, b]) => u.id === 'c30' ? b.state === 'empty' : b.value === DB.DATA.task.filter(x => x.assignee === u.id).length && b.second.value === od(u) && b.tl === (od(u) > 0 ? 'red' : null))
    && Object.entries(MAIN).every(([id, n]) => DB.base('tasks', id, U(id).roles[0]).value === n)
    && t2.value === 5 && t2.second.value === 2 && t2.second.label === 'просрочено' && t2.second.unit === 'pcs' && t2.tl === 'red' && t6.second.value === 0 && t6.tl === null
    && at('tasks', 'second', 'u2', 'cur') === 2 && at('tasks', 'tl', 'u2', 'cur') === 'red' && at('tasks', 'main', 'u2', 'cur') === 5
    && T('tasks').second.col === 'task.overdue' && T('tasks').tl.on === 'second' && DB.queueById('q-tasks').inds.join() === 'task.mine,task.overdue' && DB.IND['task.overdue'].currentOnly && T('tasks').kind === 'link'
    && /class="tile tl-red"/.test(h2) && /<b>2<\/b> просрочено/.test(h2) && /class="dot"/.test(h2) && !/tl-red/.test(h6) && /<b>0<\/b> просрочено/.test(h6)
    && DB.clickOf('tasks', 'u2', 'cur', {}).act === 'queue' && dr.sum === 5 && dr.matches && !vt.table.ok && !vt.slice.ok && vt.table.why === 'очередь модуля не объявила разрезов'
    && DB.rowLabel('task', orow) === 'просрочено' && DB.rowLabel('task', hrow) === 'горит',
    `«Мои задания» куратора: ${t2.value} · ${t2.second.label} ${t2.second.value} (красный на втором, порог > 0), у специалиста без просроченных — 0 без светофора; главные числа прежние (2 · 5 · 4 · 6 · 4 · 2 · 3 · 4 · 1 · 3), клик — очередь; «в очередях моих ролей» колонкой Таблицы не выражается: у объекта «Задание» нет разрезов и видимость «только своё» — дефект остаётся за заданиями (ДБ-Д32, ДБ-116)`);
  // Таблица: колонка «доля» — числитель к знаменателю по строке, в итоге — второе число плитки; входит в четыре колонки
  const tb = DB.view('lead-od', 'table', null, [], 'u1', 'lead', {}), sec = DB.base('lead-od', 'u1', 'lead').second, cs = DB.colsFor('lead-od'), pth = [{ dim:'region', v:'Ошская' }];
  const tp = DB.view('lead-od', 'table', { dim:'program', cols:['share'] }, pth, 'u1', 'lead', {}), spv = at('lead-od', 'second>region=Ошская');
  DB.openView('lead-od', 'table'); const hh = DB.stripHTML('lead-od', 'u1', 'lead'), rds = DB.saveAsReport('lead-od');
  const eFive = DB.viewSet('lead-od', 'cols', ['loan.count', 'loan.balance', 'loan.overdue', 'loan.risk', 'share']), eTwo = DB.viewSet('lead-od', 'cols', ['loan.count', 'share']);
  const t2c = DB.view('lead-od', 'table', DB.state.open['lead-od'].sel, [], 'u1', 'lead', {}); DB.state.open = {}; DB.state.viewMem = {};
  DB.openView('lead-bal', 'table'); const eNo = DB.viewSet('lead-bal', 'cols', ['loan.count', 'share']); DB.state.open = {}; DB.state.viewMem = {};
  ok(215, tb.table.cols.map(c => c.name).join() === 'Кредитов,Остаток задолженности,Просрочено,доля портфеля' && tb.table.cols[3].unit === 'pct' && T('lead-od').views.table.cols.join() === 'loan.count,loan.balance,loan.overdue,share'
    && tb.table.rows.length === 6 && tb.table.rows.every(r => near(r.cells[3], r.cells[2] / r.cells[1] * 100)) && near(tb.total[3], sec.value) && near(tb.total[3], tb.total[2] / tb.total[1] * 100)
    && near(tb.total[3], at('lead-od', 'second')) && at('lead-od', 'table(program;loan.count,loan.balance,loan.overdue).total').join() === tb.total.slice(0, 3).join() && tb.total[2] === at('lead-od', 'main')
    && cs.slice(0, 8).map(c => c.id).join() === 'loan.balance,loan.count,loan.overdue,loan.risk,loan.restr,loan.coll,loan.noClaim181,share' && cs.find(c => c.id === 'share').name === 'доля портфеля' && !cs.find(c => c.id === 'share').temp
    && !DB.colsFor('lead-bal').some(c => c.id === 'share') && DB.colsFor('lead-recov').find(c => c.id === 'share').name === 'доля' && DB.colsFor('lead-paid').find(c => c.id === 'share').name === 'доля к графику'
    && tp.table.cols.length === 1 && tp.table.cols[0].id === 'share' && near(tp.total[0], spv) && tp.table.rows.every(r => r.cells.length === 1 && r.cells[0] !== undefined) && near(at('lead-od', 'table(program;share).total>region=Ошская'), spv) && spv !== sec.value
    && eFive.error === 'Не больше четырёх колонок' && eTwo.ok && t2c.table.cols.map(c => c.name).join() === 'Кредитов,доля портфеля' && eNo.error && /нет доли/.test(eNo.error)
    && /value="share" checked[^>]*> доля портфеля<\/label>/.test(hh) && /<th>доля портфеля<\/th>/.test(hh) && (hh.match(/type="checkbox" value="[^"]+" checked/g) || []).length === 4 && /value="loan\.risk"\s+disabled/.test(hh)
    && rds && !rds.error && rds.inds.join() === 'loan.overdue,loan.balance,loan.count',
    `у «Просрочено» Таблица по программам: кредитов · остаток · просрочено · ${tb.table.cols[3].name} — по строке просрочено / остаток (Агрокредит ${DB.fmtVal(tb.table.rows[0].cells[3], 'pct')}), в итоге ${DB.fmtVal(tb.total[3], 'pct')} = второе число плитки; колонка в четырёх: пятая — отказ, «доля» отдельно от других колонок работает, на пути «Ошская» итог ${DB.fmtVal(spv, 'pct')} = второму числу на том же пути; у плиток с долей (кроме «Остатка») она в списке колонок, у «Остатка» — отказ; «📌 сохранить отчётом» берёт числитель и знаменатель, а не колонку «доля» (ДБ-127, ДБ-128)`);
  // выгрузка из полосы: вид, путь и пометка «на время просмотра» в штампе; строка журнала несёт вид и путь; с плитки — основа
  DB.seed(); asUser('u1'); DB.setTab('role', 'lead');
  DB.openView('lead-od', 'slice'); DB.viewSet('lead-od', 'dim', 'region'); DB.deeper('lead-od', 'region', 'Ошская'); DB.deeper('lead-od', 'bucket', '181+'); DB.viewSet('lead-od', 'dim', 'dept');
  const x1 = DB.exportTile('lead-od', 'xlsx', 'lead', DB.state.open['lead-od']), L1 = DB.state.exportLog[0], tot1 = DB.fmtVal(at('lead-od', 'slice(dept).total>region=Ошская>bucket=181+'), 'sum');
  DB.viewSet('lead-od', 'dim', 'category'); const x2 = DB.exportTile('lead-od', 'pdf', 'lead', DB.state.open['lead-od']);
  DB.crumb('lead-od', 0); DB.viewSet('lead-od', 'dim', 'bucket'); const x3 = DB.exportTile('lead-od', 'xlsx', 'lead', DB.state.open['lead-od']);
  DB.state.open = {}; DB.state.viewMem = {}; DB.openView('lead-od', 'table'); const x4 = DB.exportTile('lead-od', 'xlsx', 'lead', DB.state.open['lead-od']), hf = DB.stripHTML('lead-od', 'u1', 'lead');
  const xb = DB.exportTile('lead-od', 'xlsx', 'lead'), Lb = DB.state.exportLog[0], oa = DB.openExport('lead-od', 'xlsx', true), ob = DB.openExport('lead-od', 'xlsx');
  asUser('u4'); DB.setTab('role', 'acc'); DB.openView('acc-unm', 'slice'); const x5 = DB.exportTile('acc-unm', 'xlsx', 'acc', DB.state.open['acc-unm']);
  asUser('u3'); const x6 = DB.exportTile('tasks', 'xlsx', 'prob', { kind:'slice', sel:{}, path:[] });
  const has = (x, re) => x.stamp.some(s => re.test(s));
  ok(216, x1.stamp.length === 10 && x1.stamp[3] === 'Вид: Разрез по «Подразделение»' && x1.stamp[4] === 'Путь: Ошская › 181+' && x1.stamp[5] === 'Разрез на время просмотра' && x1.stamp[0] === 'Плитка: Просрочено'
    && has(x1, /^Отчёт: «Портфель кредитов», версия 1/) && has(x1, /^Паспорт: на 14:15 · день не закрыт · сом, курс 11\.10 · видно 2\s149$/) && has(x1, /НЕ ЯВЛЯЕТСЯ ОФИЦИАЛЬНЫМ ДОКУМЕНТОМ/) && has(x1, /^Выгрузил: Асанов/)
    && x1.rows.length === 2 && x1.rows[x1.rows.length - 1].join() === 'итог,' + tot1 && /^# Вид: Разрез по «Подразделение»$/m.test(x1.csv) && /^# Путь: Ошская › 181\+$/m.test(x1.csv)
    && L1.view.kind === 'slice' && L1.view.sel.dim === 'dept' && L1.view.temp === true && JSON.stringify(L1.path) === '[{"dim":"region","v":"Ошская"},{"dim":"bucket","v":"181+"}]' && L1.tile === 'lead-od' && L1.report === 'r-portfolio' && L1.version === 1 && L1.kind === 'xlsx'
    && x2.stamp.length === 9 && x2.stamp[3] === 'Вид: Разрез по «Категория классификации»' && !has(x2, /на время просмотра/) && DB.state.exportLog.filter(l => l.kind === 'pdf').length === 1
    && x3.stamp.length === 8 && x3.stamp[3] === 'Вид: Разрез по «Срок просрочки»' && !has(x3, /^Путь:/) && JSON.stringify(DB.state.exportLog[2].path) === '[]'
    && x4.stamp[3] === 'Вид: Таблица по «Программа»: Кредитов · Остаток задолженности · Просрочено · доля портфеля' && x4.rows[0].join() === 'Программа,Кредитов,Остаток задолженности,Просрочено,доля портфеля' && x4.rows[x4.rows.length - 1][4] === DB.fmtVal(sec.value, 'pct')
    && /DB\.openExport\('lead-od','xlsx',true\)">⤓ Выгрузить<\/button>/.test(hf)
    && xb.stamp.length === 7 && !has(xb, /^(Вид|Путь):/) && Lb.view === null && Lb.path.length === 0 && xb.rows.length === 3 && xb.rows[0][0] === 'Просрочено' && xb.rows[1][0] === 'портфеля' && /^сдвиг к 30\.09$/.test(xb.rows[2][0]) && xb.view === null
    && oa.view === 'table' && ob.view === null && x5.stamp[1] === 'Вид: Разрез по «Срок ожидания»' && !has(x5, /^Отчёт:/) && !has(x5, /на время просмотра/) && x5.rows.length === 4 && x5.rows[3].join() === 'итог,16'
    && x6.refused && /не объявила разрезов/.test(x6.msg) && DB.exportTile.length === 3,
    `выгрузка из открытой полосы «Просрочено › Ошская › 181+» по подразделению: «${x1.stamp[3]}», «${x1.stamp[4]}», «${x1.stamp[5]}» — штамп из десяти строк, итог ${tot1} = числу узла; разрез отчёта — без пометки; Таблица — «${x4.stamp[3].slice(5, 28)}…» с колонкой «доля»; журнал выгрузок несёт вид и путь (у выгрузки с плитки — пусто, штамп из семи строк: главное, второе число, сдвиг); у ссылочной — без строки «Отчёт», погашенный вид не выгружается (ДБ-129, ДБ-113)`);
  DB.seed();
})();

/* ---------- P (продолжение). Правки после ревью: Ряд второго числа, конец ряда, Движение прошлого месяца, панель, ссылочные, сохранение отчётом, разрезы с историей ---------- */
(() => {
  const near = (a, b, e = 0.5) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < e;
  const at = (id, x, uid = 'u1', role = 'lead', panel = {}) => DB.at(id, x, uid, role, panel), u1 = U('u1');
  const mk = (id, o) => DB.TILES.push(Object.assign({ id, title:id, kind:'overview', state:'published', owner:'catalog', version:1, second:null, tl:null, views:{} }, o));
  // Ряд по второму числу: точка и «☰ N» ведут в строки второго числа, не главного; сумма списка = числу точки
  DB.seed(); asUser('u10'); DB.setTab('role', 'rep'); const u10 = U('u10');
  const rs = DB.view('rep-sum', 'series', null, [], 'u10', 'rep', {}), rm = DB.view('rep-sum', 'series', { of:'main' }, [], 'u10', 'rep', {});
  const s2 = DB.drill('rep-sum', u10, 'rep', {}, { m:-2, of:'second' }), s1 = DB.drill('rep-sum', u10, 'rep', {}, { m:-2 }), fm = DB.drill('rep-sum', u10, 'rep', {}, null);
  DB.openView('rep-sum', 'series'); const wm = DB.whoMonthAt('rep-sum', -2), wf = DB.whoAt('rep-sum');
  asUser('u1'); const PP = [{ dim:'program', v:'per' }], lv = DB.view('lead-bal', 'series', { of:'second' }, PP, 'u1', 'lead', {});
  const l2 = DB.drill('lead-bal', u1, 'lead', {}, { m:-2, of:'second' }, PP), l1 = DB.drill('lead-bal', u1, 'lead', {}, { m:-2 }, PP);
  ok(217, rs.sel.of === 'second' && !s2.refused && s2.matches && s2.list.length > 0 && s2.list.every(x => x.r.state === 'сдано в срок') && s1.matches && s2.list.length < s1.list.length
    && near(rs.series.points.find(p => p.m === -2).vals[0], s2.sum / s1.sum * 100, 1e-6) && /^второе число — «Сдано в срок» · за /.test(s2.nodeText)
    && wm.node.of === 'second' && wm.list.length === s2.list.length && wf.node.of === 'second' && wf.list.length === rs.cnt && fm.list.length === rm.cnt && rs.cnt < rm.cnt
    && l2.matches && l2.unit === 'pcs' && l2.sum === lv.series.points.find(p => p.m === -2).vals[0] && l2.list.length === l2.sum && lv.cnt === l2.list.length && l1.unit === 'sum' && l1.matches,
    `Ряд «второе» у «Итога сдачи»: точка августа ведёт в «сдано в срок» (${s2.list.length} из ${s1.list.length} сданных), «☰ ${rs.cnt}» — строки второго числа (у главного ${rm.cnt}); у «Остатка» по «Переработке» Ряд «второе» — кредиты (${l2.sum} шт. = точке), а не деньги (ДБ-123, ДБ-116)`);
  // второе число без истории: Ряд «второе» погашен с причиной, выбор и умолчание автора отказаны
  DB.seed(); asUser('u2'); DB.setTab('role', 'cur'); DB.openView('cur-rs', 'series');
  const eOf = DB.viewSet('cur-rs', 'of', 'second'), hr = DB.stripHTML('cur-rs', 'u2', 'cur'), vr = DB.view('cur-rs', 'series', { of:'second' }, [], 'u2', 'cur', {}), mr = DB.view('cur-rs', 'series', { of:'main' }, [], 'u2', 'cur', {});
  asUser('u1'); const ed = DB.editTile('lead-rs', { views:{ series:{ points:12, of:'second' } } });
  DB.newDraft('r-rsapps'); DB.dSecond('col', 'rsapp.late'); DB.dView('series', 'of', 'second'); DB.dTitle('проба'); const ac = DB.autocheck(DB.draft);
  ok(218, eOf.error && /второму числу недоступен: показатель без истории/.test(eOf.error) && DB.state.open['cur-rs'].sel.of === undefined && vr.sel.of === 'main' && JSON.stringify(vr.series) === JSON.stringify(mr.series)
    && vr.series.points.at(-1).vals[0] === DB.base('cur-rs', 'u2', 'cur').value && /<button class="off" aria-disabled="true" data-tip="Ряд по второму числу недоступен: показатель без истории">второе<\/button>/.test(hr)
    && ed.error && (ed.checks || []).some(c => !c.ok && /ряд по второму числу: показатель без истории/.test(c.text)) && T('lead-rs').version === 1
    && !ac.ok && ac.checks.some(c => !c.ok && /ряд по второму числу: показатель без истории/.test(c.text)),
    '«срок нарушен» без истории: Ряд «второе» у «Обращений в работе» погашен с причиной при наведении, выбор отказан, ряд не рисует нули — остаётся по главному; умолчание автора «ряд по второму» — отказ автопроверки и правки (ДБ-119, ДБ-129)');
  // Ряд кончается там, где мини-ряд: у плитки за прошлый месяц — её периодом, у остатка на конец прошлого месяца — сентябрём
  DB.seed(); asUser('u4'); DB.setTab('role', 'acc');
  const ap = DB.view('acc-prev', 'series', null, [], 'u4', 'acc', {}), a24 = DB.view('acc-prev', 'series', { points:24 }, [], 'u4', 'acc', {}), am = DB.mini('acc-prev', 'u4', 'acc'), ab = DB.base('acc-prev', 'u4', 'acc');
  DB.openView('acc-prev', 'series'); const ha = DB.stripHTML('acc-prev', 'u4', 'acc');
  asUser('u1'); DB.setTab('role', 'lead'); mk('p-ser', { report:'r-portfolio', params:{ curator:'*', date:'prevMonthEnd' }, main:{ col:'loan.overdue' } });
  const pv = DB.view('p-ser', 'series', null, [], 'u1', 'lead', {}), pm = DB.mini('p-ser', 'u1', 'lead'), lo = DB.view('lead-od', 'series', { of:'main' }, [], 'u1', 'lead', {});
  DB.openView('lead-od', 'series'); const hl = DB.stripHTML('lead-od', 'u1', 'lead');
  ok(219, ap.series.points.length === 12 && ap.series.points.at(-1).m === -1 && am.months.at(-1) === -1 && JSON.stringify(ap.series.points.map(p => p.vals[0])) === JSON.stringify(am.vals) && ap.series.points.at(-1).vals[0] === ab.value
    && a24.series.points.length === 24 && a24.series.points.at(-1).m === -1 && pv.series.points.at(-1).m === -1 && pm.months.at(-1) === -1 && near(pv.series.points.at(-1).vals[0], DB.base('p-ser', 'u1', 'lead').value)
    && lo.series.points.at(-1).m === 0 && /class="ser-cap">[^<]+ — последняя точка = последний месяц периода</.test(ha) && /class="ser-cap">[^<]+ — последняя точка = дата среза</.test(hl)
    && /<div class="ser-ax"><span style="left:[\d.]+%">/.test(hl) && !/<text /.test(hl + ha),
    `Ряд «Поступило · прошлый месяц» кончается сентябрём, как мини-ряд (12 и 24 точки, последняя = главному ${DB.fmtVal(ab.value, 'sum')}); остаток на конец прошлого месяца — тоже сентябрём; подпись «последняя точка = последний месяц периода» у потока и «= дата среза» у остатка, подписи осей — текстом страницы, не растянутым рисунком (ДБ-115, ДБ-118)`);
  // Движение прошлого месяца: «☰ N» и список — на конец того месяца, сходятся с концом движения
  DB.seed(); asUser('u2'); DB.setTab('role', 'cur'); DB.openView('cur-bal', 'move'); DB.viewSet('cur-bal', 'month', '-1');
  const mo = DB.state.open['cur-bal'], mv = DB.view('cur-bal', 'move', mo.sel, mo.path, 'u2', 'cur', {}), w1 = DB.whoAt('cur-bal'), hm = DB.stripHTML('cur-bal', 'u2', 'cur');
  DB.viewSet('cur-bal', 'month', '0'); const mv0 = DB.view('cur-bal', 'move', DB.state.open['cur-bal'].sel, [], 'u2', 'cur', {}), w0 = DB.whoAt('cur-bal');
  asUser('u1'); DB.setTab('role', 'lead'); DB.openView('lead-od', 'move'); const ho = DB.stripHTML('lead-od', 'u1', 'lead');
  ok(220, mv.sel.month === -1 && w1.node.m === -1 && !w1.refused && w1.matches && near(w1.sum, mv.move.end) && w1.list.length === mv.cnt && w1.nodeText === 'на конец 30.09'
    && w0.node === null && w0.matches && near(w0.sum, mv0.move.end) && mv.move.end !== mv0.move.end && new RegExp('☰ ' + mv.cnt + ' Кто в этом числе').test(hm)
    && /<span>прочее<\/span><span class="muted"><\/span>/.test(ho) && !/прочее<\/span><span class="muted">прочее/.test(ho) && /<span>прочее<\/span><span class="muted">курсовая переоценка/.test(hm),
    `Движение «Остатка» куратора за прошлый месяц: «☰ ${mv.cnt}» и список — на конец 30.09, сумма списка = концу движения (${DB.fmtVal(mv.move.end, 'sum')}), за текущий — на сегодня; строка «прочее» печатает название один раз (ДБ-118, ДБ-123)`);
  // разрез, зафиксированный панелью, в открытой полосе не остаётся: вид — по свободному разрезу, глубже можно; панель сняли — выбор вернулся
  DB.seed(); asUser('u1'); DB.setTab('role', 'lead'); DB.openView('lead-od', 'map'); DB.viewSet('lead-od', 'dims', ['region', 'bucket']); DB.openView('lead-od', 'slice'); DB.viewSet('lead-od', 'dim', 'region');
  const po = DB.state.open['lead-od']; DB.setPanel('region', 'Ошская'); const sd = po.sel.dim;
  const rp = DB.view('lead-od', 'slice', po.sel, po.path, 'u1', 'lead', DB.state.panel), mp = DB.view('lead-od', 'map', po.sel, po.path, 'u1', 'lead', DB.state.panel), hp = DB.stripHTML('lead-od', 'u1', 'lead');
  const osh = DB.base('lead-od', 'u1', 'lead', { region:'Ошская' }).value; DB.clearPanel(); const rc = DB.view('lead-od', 'slice', po.sel, po.path, 'u1', 'lead', {});
  DB.setPanel('region', 'Ошская'); const dp = DB.deeper('lead-od', rp.sel.dim, rp.nodes.find(n => n.value).v);
  ok(221, sd === 'region' && rp.sel.dim === 'bucket' && near(rp.total.v, osh) && near(sum(rp.nodes.map(n => n.value)), osh) && !mp.sel.dims.includes('region') && mp.sel.dims.length === 2 && near(mp.total.v, osh)
    && !/<option value="region"/.test(hp) && rc.sel.dim === 'region' && rc.nodes.some(n => n.v === 'Таласская' && n.value > 0) && dp.ok && dp.path[0].dim === 'bucket'
    && DB.view('lead-od', 'slice', { dim:'region' }, [], 'u1', 'lead', { region:'Ошская' }).sel.dim !== 'region',
    `«Просрочено» открыто Разрезом по области, затем панель «Область = Ошская»: полоса режет по сроку (итог ${DB.fmtVal(osh, 'sum')}), Карта — без области, глубже можно; панель сняли — снова по области (ДБ-126, ДБ-129)`);
  // правка ссылочной плитки: числа — показатели очереди, разрезы и колонки видов — объявленные очередью, значения из закрытых списков
  DB.seed(); asUser('u1');
  const E = p => DB.editTile('acc-unident', p), bad = (r, re) => !!r.error && (re.test(r.error) || (r.checks || []).some(c => !c.ok && re.test(c.text)));
  const e1 = E({ main:{ col:'loan.balance' } }), e2 = E({ views:{ slice:{ dim:'region' } } }), e3 = E({ views:{ table:{ dim:'rwait', cols:['loan.count'] } } }), e4 = E({ second:{ col:'receipt.unident', label:'x' } });
  const e5 = E({ views:{ series:{ points:12, of:'second' } } }), e6 = E({ tl:{ red:['>', 'x'], on:'main' } }), v1 = T('acc-unident').version;
  const good = E({ views:{ slice:{ dim:'source' }, table:{ dim:'rwait', cols:['receipt.unidentSum'] } } });
  mk('p-alien', { kind:'link', queue:'q-unident', params:{}, main:{ col:'loan.balance' } }); const ba = DB.base('p-alien', 'u4', 'acc');
  ok(222, bad(e1, /не объявила показатель «Остаток задолженности»/) && bad(e2, /разрезы очереди «Невыясненные поступления»: нет «region»/) && bad(e3, /таблица/) && bad(e4, /не повторяет главное/)
    && bad(e5, /без истории/) && bad(e6, /пороги светофора/) && v1 === 1 && good.tile && T('acc-unident').version === 2 && T('acc-unident').views.slice.dim === 'source'
    && DB.view('acc-unident', 'slice', null, [], 'u4', 'acc', {}).sel.dim === 'source' && ba.state === 'broken' && /не объявила показатель/.test(ba.msg),
    'правка ссылочной «Невыясненные поступления»: чужой показатель, разрез «Область» не из очереди, колонка кредита, второе = главному, ряд второго без истории, порог не числом — отказ; разрез «срок ожидания» → «источник» проходит; ссылочная с чужим главным — сломана (ДБ-120, ДБ-109)');
  // «📌 сохранить отчётом»: главное «% от итога группы» и доля переходят в отчёт, плитка на нём отвечает числом полосы
  DB.seed(); asUser('u2'); DB.setTab('role', 'cur'); DB.openView('cur-borod', 'slice');
  const rb = DB.saveAsReport('cur-borod'), pb = DB.rSaveAndPlace(), bb = DB.base(pb.tile.id, 'u2', 'cur'), cb = DB.base('cur-borod', 'u2', 'cur');
  DB.seed(); asUser('u2'); DB.setTab('role', 'cur'); DB.openView('cur-borod', 'map'); DB.viewSet('cur-borod', 'dims', ['bodays', 'bdebt']); const rmp = DB.saveAsReport('cur-borod');
  DB.seed(); asUser('u1'); DB.setTab('role', 'lead'); DB.openView('lead-recov', 'slice');
  const ro = DB.state.open['lead-recov'], rv = DB.view('lead-recov', 'slice', ro.sel, [], 'u1', 'lead', {}), nd = rv.nodes.find(n => n.den); DB.deeper('lead-recov', rv.sel.dim, nd.v);
  const rr = DB.saveAsReport('lead-recov'), pr = DB.rSaveAndPlace(), br = DB.base(pr.tile.id, 'u1', 'lead');
  ok(223, rb.main.pct.dim === 'bover' && rb.dims.includes('bover') && rb.share === null && pb.tile.main.pct.cells.join() === 'больше 0' && pb.tile.second === null
    && bb.state === 'ok' && near(bb.value, cb.value, 1e-9) && bb.num === cb.num && bb.den === cb.den && rmp.error && /не больше двух разрезов/.test(rmp.error)
    && rr.main.share.join() === 'case.paid,case.base' && pr.tile.main.share.join() === 'case.paid,case.base' && pr.tile.second === null && near(br.value, nd.value, 1e-9)
    && near(br.value, at('lead-recov', 'main>' + rv.sel.dim + '=' + nd.v), 1e-9),
    `полоса «Заёмщиков с просрочкой» → отчёт → плитка: главное — тот же «% от итога группы» (${DB.fmtVal(bb.value, 'pct')} = ${bb.num} из ${bb.den}), разрез доли остаётся разрезом отчёта, Карта без него — отказ; «Возвратность по делам › ${nd.v}» → плитка-доля ${DB.fmtVal(br.value, 'pct')} = узлу полосы (ДБ-126, ДБ-116)`);
  // разрез с историей на плитке не на сегодня: узлы — состояние на дату плитки, «☰ N» = длине списка, число узла = сумме списка
  DB.seed(); asUser('u1');
  DB.R('r-p-at', { title:'проба', obj:'borrower', cols:['borrower.count'], dims:['pstate'], filter:[], params:{ date:{ name:'Дата' } } });
  mk('p-at-pme', { report:'r-p-at', params:{ date:'prevMonthEnd' }, main:{ col:'borrower.count' } }); mk('p-at-now', { report:'r-p-at', params:{ date:'today' }, main:{ col:'borrower.count' } });
  mk('p-at-flow', { report:'r-issued', params:{ curator:'*', period:'prevMonth' }, main:{ col:'loan.paid' } });
  const PB = [{ dim:'bregion', v:'Баткенская' }], vp = DB.view('p-at-pme', 'slice', { dim:'pstate' }, PB, 'u1', 'lead', {}), vn = DB.view('p-at-now', 'slice', { dim:'pstate' }, PB, 'u1', 'lead', {});
  const dr = vp.nodes.filter(n => n.cnt).map(n => ({ n, d:DB.drill('p-at-pme', u1, 'lead', {}, { d:'pstate', v:n.v }, PB) }));
  const vf = DB.view('p-at-flow', 'slice', { dim:'lact' }, [], 'u1', 'lead', {}), fc = vf.nodes.find(n => n.v === 'закрыт'), df = DB.drill('p-at-flow', u1, 'lead', {}, { d:'lact', v:'закрыт' });
  ok(224, dr.length === 3 && dr.every(x => !x.d.refused && x.d.list.length === x.n.cnt && x.d.matches && x.d.sum === x.n.value) && dr.some(x => x.d.list.some(y => DB.pstateAt(y.r, 0) !== x.n.v))
    && vp.total.v === sum(vp.nodes.map(n => n.value)) && vp.total.v === at('p-at-pme', 'main>bregion=Баткенская') && JSON.stringify(vp.nodes.map(n => n.value)) !== JSON.stringify(vn.nodes.map(n => n.value))
    && fc.cnt > 0 && !df.refused && df.list.length === fc.cnt && df.matches && near(df.sum, fc.value),
    `«Состояние портфеля» на конец прошлого месяца (Баткенская): узлы ${vp.nodes.map(n => n.value).join(' · ')} — состояние на 30.09, а не сегодня (${vn.nodes.map(n => n.value).join(' · ')}); у каждого узла «☰ N» = списку и число = сумме списка; у потока за прошлый месяц «Состояние договора» — на конец периода (ДБ-123, ДБ-126)`);
  // широкая таблица и карта — прокрутка с тенью и подсказкой; название плитки — в две строки, полное — в подсказке
  DB.seed(); asUser('u1'); DB.setTab('role', 'lead'); DB.openView('lead-od', 'table'); const ht = DB.stripHTML('lead-od', 'u1', 'lead');
  DB.openView('lead-od', 'map'); const hh = DB.stripHTML('lead-od', 'u1', 'lead'), tr = DB.tileHTML('lead-rs', 'u1', 'lead'), tk = DB.tileHTML('tasks', 'u1', 'lead');
  ok(225, /<div class="hscroll"><div class="hs-in" onscroll="DB\.scrollEnd\(this\)"><table class="tbl">[\s\S]*<\/table><\/div><\/div><div class="hs-hint">↔ таблица прокручивается<\/div>/.test(ht)
    && /<div class="hscroll"><div class="hs-in"[^>]*><table class="heat">[\s\S]*<div class="hs-hint">↔ карта прокручивается<\/div>/.test(hh)
    && /<button class="t-link"[^>]*><span class="tt" data-full="Обращений о реструктуризации в работе">Обращений о реструктуризации в работе&nbsp;<span class="ar">↗<\/span><\/span><\/button>/.test(tr)
    && /<span class="tt" data-full="Мои задания">Мои задания<\/span>/.test(tk) && typeof DB.scrollEnd === 'function',
    'Таблица и Карта в полосе прокручиваются вбок с тенью у края и подсказкой «↔ … прокручивается»; название плитки — не длиннее двух строк с многоточием, полное — в подсказке, «↗» сразу за названием (ДБ-117, ДБ-129)');
  DB.seed();
})();

/* ---------- отчёт ---------- */
const fail = results.filter(r => !r.pass);
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'} #${r.n} ${r.note}`);
console.log(`\n${results.length - fail.length}/${results.length} PASS`);
process.exit(fail.length ? 1 : 0);
