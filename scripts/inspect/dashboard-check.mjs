// Headless смоук для mockups/dashboard/dashboard.html — волна 1 макета модуля «Дашборд» (11.10.2026).
// Zero-dep: вытаскивает <script> из HTML и исполняет движок window.DB в node:vm (без DOM — render() и
// toast() становятся no-op). Проверяется не «код есть», а поведение по решениям канона
// mockups/dashboard/ASUBK-dashbord-logika.md (ДБ-1…ДБ-59, ИДБ-1…ИДБ-14):
//   A  рамка и главная: вкладки — системные роли, роль без раскладки — минимальная (ДБ-8, ДБ-38, ДБ-50);
//   B  плитка ссылается на отчёт и чисел не хранит: числа приходят от статистики через отчёт; «ждёт меня» — через очередь
//      модуля-владельца, тоже от статистики (ДБ-99, ДБ-10, ДБ-11);
//   C  время: «сегодня» по умолчанию, только календарные периоды, кэш ≤ 1 мин у «сегодня» (ДБ-12…ДБ-16, ДБ-52);
//   D  показ: 8 форматов, один объект ≤ 4 показателей, доля, сдвиг, план-факт, светофор, движение (ДБ-17…ДБ-24);
//   E  клик: «кто в этом числе» — полный список или отказ, строки сходятся с числом (ДБ-25, ДБ-26, ДБ-54);
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
  ok(4, lead.filter(k => !k.startsWith('s:')).length === 24 && lead.filter(k => k.startsWith('s:')).length === 4,
    `стартовая раскладка «Руководства» — 24 отвечающие плитки в четырёх секциях, эпизоды и движение клиентов ждут соседей (ДБ-40, ДБ-60…ДБ-65, ДБ-74): ${lead.length} элементов`);
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
  const r = DB.ask(T('lead-loans'), U('u1'), 'lead', {});
  ok(11, /на 14:15 · день не закрыт/.test(r.passport), `паспорт «сегодня»: ${r.passport}`);
  const keys = Object.keys(DB.PERIODS);
  ok(12, keys.join() === 'today,curMonth,prevMonth,curQuarter,prevQuarter,ytd,prevYear' && !keys.some(k => /\d+d|days|range|fixed/.test(k)),
    `периоды только календарные плюс «сегодня»; скользящих окон и фиксированных дат нет (ДБ-15): ${keys.join(', ')}`);
  const cm = DB.ask(Object.assign(withParams(T('acc-prev'), { period:'curMonth' }), { format:'number' }), U('u4'), 'acc', {});
  ok(13, /идёт 11-й день/.test(cm.passport), `текущий месяц не подменяется: подпись называет день (ДБ-16): ${cm.passport}`);
  DB.cachedAsk(T('lead-loans'), U('u1'), 'lead', {}); const h0 = DB.state.cacheHits;
  DB.cachedAsk(T('lead-loans'), U('u1'), 'lead', {}); const h1 = DB.state.cacheHits;
  DB.tick(2); const miss0 = DB.state.cacheMiss; DB.cachedAsk(T('lead-loans'), U('u1'), 'lead', {});
  ok(14, h1 === h0 + 1 && DB.state.cacheMiss === miss0 + 1,
    'ответ «сегодня» берётся из кэша не дольше минуты, потом статистика спрашивается заново (ДБ-52, ДБ-13)');
  const closed = Object.assign(withParams(T('lead-loans'), { date:'closedDay' }), { id:'closed-copy' });
  DB.cachedAsk(closed, U('u1'), 'lead', {}); DB.tick(5); const hc = DB.state.cacheHits; DB.cachedAsk(closed, U('u1'), 'lead', {});
  ok(15, DB.state.cacheHits === hc + 1, 'ответ на закрытый день живёт в кэше до следующего прогона; дата — значение параметра отчёта (ДБ-52, ДБ-107)');
  ok(16, DB.scopeKey(T('cur-loans'), U('u2'), 'cur') !== DB.scopeKey(T('cur-loans'), U('u5'), 'zal')
    && DB.scopeKey(T('lead-loans'), U('u1'), 'lead') !== DB.scopeKey(T('lead-loans'), U('u5'), 'zal'),
    'ключ кэша — «вопрос + охват»: разные охваты не смешиваются (ДБ-52)');
})();

/* ---------- D. Показ ---------- */
(() => {
  DB.seed(); asUser('u1');
  const f = Object.keys(DB.FORMAT_NAMES);
  ok(17, f.length === 8 && f.includes('heat') && f.includes('table') && !f.some(x => /pie|donut|круг/i.test(x + DB.FORMAT_NAMES[x])),
    `восемь форматов, есть тепловая карта и таблица, круговой нет (ДБ-17): ${f.join(', ')}`);
  ok(18, DB.SIZE.number === '1x1' && DB.SIZE.shift === '1x1' && ['series','slice','steps','move'].every(x => DB.SIZE[x] === '2x1') && DB.SIZE.heat === '2x2' && DB.SIZE.table === '2x2',
    'размер задаёт формат: число 1×1, ряд/разрез/ступени/движение 2×1, тепловая и таблица 2×2 (ДБ-33)');
  const d = Object.assign(DB.blankDraft('r-balreg'), { pick:{ cols:['loan.balance'], level:1 }, format:'slice' });
  const steps = DB.formatsFor(d).find(x => x.f === 'steps');
  ok(19, !steps.ok && /нет объявленного порядка/.test(steps.why) && DB.formatsFor(d).find(x => x.f === 'slice').ok,
    `ступени гаснут у разреза отчёта без порядка и называют причину: «${steps.why}»`);
  const two = DB.autocheck(Object.assign(DB.blankDraft('r-loans'), { title:'x', pick:{ cols:['loan.count','borrower.count'], level:0 } }));
  ok(20, !two.ok && two.checks.some(c => !c.ok && /один объект/.test(c.text)) && two.checks.some(c => !c.ok && /колонки из отчёта/.test(c.text)),
    'колонки двух объектов в одной плитке не проходят автопроверку: объект у отчёта один, колонка не из отчёта отвергнута (ДБ-18, ДБ-109)');
  const share = DB.ask(T('lead-odsh'), U('u1'), 'lead', {});
  ok(21, share.num > 0 && share.den > 0 && Math.abs(share.value - share.num / share.den * 100) < 1e-9 && share.unit === 'pct',
    `доля — показ двух показателей одного объекта, оба числа есть (ДБ-19): ${share.value.toFixed(2)} % = ${share.num} / ${share.den}`);
  const partT = withParams(T('acc-prev'), { period:'curMonth' }), part = DB.answer(DB.questionOf(partT), U('u4'), 'acc', {}), partA = DB.ask(partT, U('u4'), 'acc', {});
  const rcp = Object.assign(DB.blankDraft('r-receipts'), { pick:{ cols:['receipt.amount'], level:0 } });
  ok(22, part.shift && part.shift.none && /неполный период/.test(part.shift.none) && partA.state === 'broken' && /«Число \+ сдвиг»: неполный период/.test(partA.msg)
    && !DB.shiftsFor(withParams(rcp, { period:'curMonth' }))[0].ok
    && /неполный период/.test(DB.formatsFor(withParams(rcp, { period:'curMonth' })).find(x => x.f === 'shift').why) && DB.shiftsFor(withParams(rcp, { period:'prevMonth' }))[0].ok,
    'сдвиг у неполного периода погашен с причиной — неполный с полным не сравнивается; плитка, которой задали такой период в обход автопроверки, — сломана с той же причиной; у прошлого месяца есть (ДБ-21, ИДБ-11)');
  const sb = DB.shiftsFor(DB.blankDraft('r-loans')), sbp = DB.shiftsFor(withParams(DB.blankDraft('r-loans'), { date:'prevMonthEnd' }));
  ok(23, sb.length === 3 && sb.every(x => x.ok) && sbp.find(x => x.id === 'prevMonthEnd').ok === false,
    'у остатка ровно три базы сдвига: конец прошлого месяца, начало года, год назад; база, совпавшая с датой плитки, погашена (ДБ-21)');
  ok(24, Q('cur-plan1').share.join() === 'loan.paidPlanned,loan.plan' && DB.IND['loan.expected'] && Q('lead-paid').share[1] === 'loan.expected'
    && !Object.values(DB.IND).some(i => /цел|target/i.test(i.id + i.name)),
    'план-факт — «План» кредита и «Ожидалось по графику»; «целевого показателя» нет, цель — только лимит программы (ДБ-22, ДБ-23)');
  ok(25, share.tl === 'yellow' && /порог/.test(DB.tlText(T('lead-odsh'))), `светофор с напечатанным порогом: ${share.tl} · ${DB.tlText(T('lead-odsh'))} (ДБ-24)`);
  DB.STAND.overdueUp = true; const up = DB.ask(T('lead-odsh'), U('u1'), 'lead', {}); DB.STAND.overdueUp = false;
  ok(26, up.tl === 'red', `при росте просрочки светофор краснеет: ${up.value.toFixed(2)} % (ДБ-24)`);
  const mv = DB.ask(T('lead-bal'), U('u1'), 'lead', {}).move;
  ok(27, mv.converges && typeof mv.other === 'number' && mv.otherName && mv.start + mv.ti - mv.td + mv.other === mv.end,
    'движение сходится: конец = начало + обороты, строка «прочее» есть всегда (ДБ-17)');
})();

/* ---------- E. Клик и два действия ---------- */
(() => {
  DB.seed();
  const big = DB.statRows(T('lead-loans'), U('u1'), 'lead', {});
  ok(28, big.refused && big.count === 1248 && /сузьте/.test(big.msg), `выше порога — отказ с числом строк, не усечённый список (ДБ-54): ${big.msg}`);
  const r = DB.ask(T('cur-loans'), U('u2'), 'cur', {}); const sr = DB.statRows(T('cur-loans'), U('u2'), 'cur', {});
  ok(29, !sr.refused && sr.list.length === r.value && r.value === 47, `«кто в этом числе» — полный список, строк столько же, сколько в числе: ${sr.list.length} = ${r.value} (ИДБ-9)`);
  const od = DB.ask(T('cur-od'), U('u2'), 'cur', {}); const sro = DB.statRows(Object.assign({}, T('cur-od'), { format:'number' }), U('u2'), 'cur', {});
  ok(30, !sro.refused && sro.sum === od.move.end, `сумма строк сходится с числом плитки: ${sro.sum} = ${od.move.end}`);
  const b = DB.ask(T('cur-bucket'), U('u2'), 'cur', {}); const n181 = b.nodes.find(n => n.v === '181+');
  const s181 = DB.statRows(T('cur-bucket'), U('u2'), 'cur', {}, { d:'bucket', v:'181+' });
  ok(31, !s181.refused && s181.list.length === n181.value, `клик по ступени открывает строки этого узла: ${s181.list.length} = ${n181.value}`);
  const reg = DB.registryList(T('cur-loans'), U('u2'), 'cur', {});
  ok(32, reg.registry === 'Реестр кредитов' && reg.today === 47 && reg.slice === 47, '«Работать со списком» — реестр владельца на сегодня, с подписью «в реестре N, в срезе M» (ДБ-26)');
})();

/* ---------- F. Права, охват, фильтры ---------- */
(() => {
  DB.seed();
  const cat = DB.catalogFor(U('u10')); const ll = cat.find(x => x.t.id === 'lead-loans');
  ok(33, ll && /не открыт вашей роли/.test(ll.why), `недоступная плитка в каталоге не спрятана, а названа причиной (ДБ-3): ${ll && ll.why}`);
  const na = DB.ask(T('lead-loans'), U('u10'), 'rep', {});
  ok(34, na.state === 'noaccess' && na.value === undefined, 'плитка без права на её объект — «нет доступа», без числа (ИДБ-4)');
  const all = DB.ask(T('lead-loans'), U('u1'), 'lead', {}); const osh = DB.ask(T('lead-loans'), U('u1'), 'lead', { region:'Ошская' });
  ok(35, osh.value < all.value && /фильтр: Ошская/.test(osh.passport), `панель фильтров сужает и печатает фильтр: ${osh.value} из ${all.value} · ${osh.passport} (ДБ-27)`);
  const tk = DB.ask(T('tasks'), U('u1'), 'lead', { region:'Ошская' });
  ok(36, /без фильтра/.test(tk.passport) && tk.value === DB.ask(T('tasks'), U('u1'), 'lead', {}).value, 'к плитке без такого разреза фильтр неприменим — «без фильтра» (ДБ-27)');
  const narrowed = DB.ask(T('cur-loans'), U('u2'), 'cur', { region:'Ошская' });
  ok(37, narrowed.value === 0, 'фильтр не расширяет охват: кредитов Бековой в Ошской нет — 0 (ИДБ-12)');
  DB.USERS.push({ id:'c00', name:'Тестовый куратор', roles:['cur'], dept:'rp-chu' });
  const other = DB.ask(T('cur-loans'), U('c00'), 'cur', {});
  ok(38, other.value === DB.DATA.loan.filter(l => l.curator === 'c00' && !l.closed).length && other.value !== 47,
    `относительный параметр «я»: одна каталожная плитка «Мои кредиты» у каждого куратора своя — ${other.value} против 47 (ДБ-28)`);
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
    && DB.ask(per.tile, U('u2'), 'cur', {}).value === DB.ask(T('cur-loans'), U('u2'), 'cur', {}).value,
    'любой собирает личную плитку на доступном отчёте; публикует в каталог только администратор дашборда (ДБ-4, ДБ-29, ДБ-103)');
  asUser('u11');
  const ad = DB.saveTile(Object.assign(DB.blankDraft('r-balreg'), { title:'Остаток по областям', pick:{ cols:['loan.balance'], level:1 }, format:'slice' }), 'publish');
  ok(41, ad.tile && ad.tile.state === 'published' && ad.tile.owner === 'catalog', 'администратор публикует сразу после автопроверки — второго ключа нет (ДБ-30)');
  const bad = DB.saveTile(Object.assign(DB.blankDraft('r-spells'), { title:'x', params:{ curator:'*', period:'prevMonth' }, pick:{ cols:['spell.in'], level:0 } }), 'publish');
  ok(42, bad.error && bad.checks.some(c => !c.ok && /предпросмотр/.test(c.text)), 'плитка, отчёт которой не отвечает, не публикуется (ИДБ-14)');
  asUser('u2'); DB.propose(per.tile.id); asUser('u11');
  ok(43, DB.state.proposals.length === 1 && DB.moveToCatalog(per.tile.id) && T(per.tile.id).state === 'published' && T(per.tile.id).owner === 'catalog',
    'личная плитка уходит в каталог только через «Предложить» и перенос администратором (ДБ-31)');
  const e0 = DB.editTile('lead-loans', { inds:['loan.balance'] }), e1 = DB.editTile('lead-loans', { report:'r-portfolio' });
  const e2 = DB.editTile('lead-loans', { title:'Кредитов в портфеле' });
  ok(44, e0.error && /правятся в отчёте/.test(e0.error) && e1.error && /новая плитка/.test(e1.error) && e2.tile.version === 2 && T('lead-loans').report === 'r-loans' && !('inds' in T('lead-loans')),
    'правка подписи — новая версия у всех; другой отчёт — новая плитка; показатель плитка не правит — он в отчёте (ДБ-55, ДБ-113)');
  DB.state.overlays['u1|an'] = { order:[], hidden:[], added:['cat-byprog'] };
  const w = DB.withdrawTile('cat-byprog');
  ok(45, w.personal === 1 && w.screens === 1 && DB.composeLayout('u1', 'an').includes('x:cat-byprog'),
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
  DB.arrangeMove('lead', 'lead-borr', -1); asUser('u11'); DB.declaredEdit('lead', 'add', 'cat-byreg'); asUser('u1');
  const L = DB.composeLayout('u1', 'lead');
  ok(49, L[L.length - 1] === 'cat-byreg' && L.indexOf('lead-borr') < L.indexOf('lead-loans'),
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
  DB.STAND.statDown = true; const e = DB.ask(T('lead-loans'), U('u1'), 'lead', {}); DB.STAND.statDown = false;
  ok(53, e.state === 'error' && e.value === undefined, 'статистика не ответила — ни ноль, ни прошлое значение (ДБ-35)');
  DB.STAND.withdrawn['loan.risk'] = '11.10'; const br = DB.ask(T('lead-risk'), U('u1'), 'lead', {}); delete DB.STAND.withdrawn['loan.risk'];
  ok(54, br.state === 'broken', 'показатель выведен из реестра — плитка «сломана объявлением»');
  const rf = DB.ask(T('lead-spin'), U('u1'), 'lead', {});
  ok(55, rf.state === 'refusal' && /владелец — модуль «Ядро расчёта»/.test(rf.msg), `настоящий отказ шва назван поимённо: ${rf.msg}`);
  DB.STAND.nightRunFailed = true; const st1 = DB.ask(withParams(T('lead-loans'), { date:'closedDay' }), U('u1'), 'lead', {}); const st2 = DB.ask(T('lead-loans'), U('u1'), 'lead', {});
  DB.STAND.nightRunFailed = false; DB.STAND.queueLag = 25; const st3 = DB.ask(T('lead-loans'), U('u1'), 'lead', {}); DB.STAND.queueLag = 0;
  ok(56, st1.staleState && !st2.staleState && st3.staleState && st1.value !== undefined,
    'устаревшее число показывается с датой и пометкой: закрытый день — при сбое ночного прогона, «сегодня» — при очереди > 15 мин (ДБ-35)');
  DB.USERS.push({ id:'c01', name:'Новый куратор', roles:['cur'], dept:'risk' });
  const em = DB.ask(T('cur-loans'), U('c01'), 'cur', {}); DB.USERS.pop();
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
  const ex = DB.exportTile('lead-odsh', 'xlsx', 'lead');
  ok(61, ex.stamp.some(s => /^Паспорт: на 14:15/.test(s)) && ex.stamp.some(s => /НЕ ЯВЛЯЕТСЯ ОФИЦИАЛЬНЫМ ДОКУМЕНТОМ/.test(s)) && ex.stamp.some(s => /Выгрузил: Асанов/.test(s))
    && ex.csv.startsWith('# '), 'выгрузка всегда со штампом: паспорт, «не официальный документ», кто и когда (ДБ-36, ИДБ-10)');
  ok(62, DB.state.journal[0].action === 'выгрузил Excel' && DB.state.journal[0].who === 'u1', 'выгрузка записана в журнал поимённо (ДБ-51)');
  const tasksBefore = DB.DATA.task.length;
  const ot = T('lead-odsh'), sg = DB.signal('lead-odsh', 'lead');
  ok(63, Array.isArray(sg) && sg.length === 2 && sg.map(s => s.label).join('|') === '> 5 %|> 4 %' && DB.state.signals.length === 2
    && sg.every(s => s.owner === 'u1' && s.roleId === 'lead' && s.tile === 'lead-odsh' && s.report === ot.report && JSON.stringify(s.params) === JSON.stringify(ot.params) && s.params !== ot.params)
    && DB.state.notifs.length === 0 && sg[0].state === false && sg[1].state === true,
    '🔔 на «Доле просрочки» ставит два сигнала отчётности (> 5 %, > 4 %) на тот же отчёт с теми же значениями параметров; при постановке ничего не отправляется (ДБ-106)');
  DB.STAND.overdueUp = true; const sf = DB.nightCheck(); DB.STAND.overdueUp = false;
  ok(64, DB.DATA.task.length === tasksBefore && sf.length === 1 && DB.state.notifs.every(n => !('task' in n)) && DB.signal('lead-odsh', 'lead') === false && DB.state.signals.length === 0,
    'сигнал только информирует, даже сработав: заданий не прибавилось, поручений нет; повторное 🔔 снимает сигналы (ДБ-106, ИДБ-13)');
  DB.cachedAsk(T('lead-loans'), U('u1'), 'lead', {});
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
  const lr = DB.ask(T('lead-rs'), U('u1'), 'lead', {}); const ll = DB.ask(T('lead-rslate'), U('u1'), 'lead', {});
  ok(70, lr.state === 'ok' && lr.values[0] === inW.length && lr.values[1] === inW.filter(r => r.multi).length && lr.values[1] <= lr.values[0]
    && ll.value === inW.filter(r => r.late).length && ll.tl === 'red',
    `Руководство: обращений в работе / многократных ${lr.values.join(' / ')}, срок нарушен ${ll.value} — красный (ДБ-60)`);
  const mine = R.filter(r => r.curator === 'u2'); const cr = DB.ask(T('cur-rs'), U('u2'), 'cur', {});
  const cl = DB.ask(T('cur-rslate'), U('u2'), 'cur', {}); const cs = DB.ask(T('cur-rsstage'), U('u2'), 'cur', {});
  const co = DB.ask(T('cur-rsout'), U('u2'), 'cur', {});
  ok(71, cr.value === mine.filter(r => r.inWork).length && cr.value > 0 && cl.tl === 'red'
    && cs.state === 'ok' && cs.nodes.length === 9 && cs.nodes[0].v === 'регистрация обращения' && cs.nodes[8].v === 'закрыта' && cs.total.v === mine.length
    && co.state === 'ok' && co.total.v === mine.filter(r => r.outAt === -1).length,
    `Куратор: в работе ${cr.value}, срок нарушен ${cl.value}, девять стадий по порядку, исходы прошлого месяца ${co.total.v} — только «куратор = я» (ДБ-60)`);
  ok(72, R.filter(r => r.multi || (r.stage === 'закрыта' && /^одобрена/.test(r.outcome || ''))).every(r => DB.DATA.loan.find(l => l.id === r.loan).status === 'В реструктуризации')
    && new Set(R.map(r => r.loan)).size === R.length,
    'демо-числа не спорят: многократная и одобренная заявка — по кредиту «в реструктуризации», один кредит — одна заявка (урок «демо-числа противоречат»)');
  // ДБ-61: дело взыскания
  const rv = DB.ask(T('lead-recov'), U('u1'), 'lead', {});
  ok(73, Q('lead-recov').share.every(i => DB.IND[i].obj === 'case') && rv.state === 'ok' && Math.abs(rv.value - rv.num / rv.den * 100) < 1e-9 && rv.unit === 'pct',
    `возвратность по делам — доля двух показателей одного объекта «Дело»: ${rv.value.toFixed(1)} % = ${rv.num} / ${rv.den} (ДБ-61, ИДБ-8)`);
  const mixed = DB.autocheck(Object.assign(DB.blankDraft('r-cases'), { title:'x', pick:{ cols:['claim.recovered','case.base'], share:['claim.recovered','case.base'] } }));
  const mixedR = DB.rcheck(Object.assign(DB.blankReportDraft(), { title:'x', inds:['claim.recovered','case.base'], share:['claim.recovered','case.base'] }));
  const loansInCases = DB.DATA.case.flatMap(c => c.loans);
  ok(74, !mixed.ok && mixed.checks.some(c => !c.ok && /один объект/.test(c.text)) && mixed.checks.some(c => !c.ok && /доля — две колонки отчёта/.test(c.text))
    && !mixedR.ok && mixedR.checks.some(c => !c.ok && /один объект/.test(c.text)) && new Set(loansInCases).size === loansInCases.length,
    'возвратность «по требованиям» собрать нельзя — доля между объектами не проходит; каждый кредит в делах один раз, долг не считается дважды (ДБ-61)');
  const pc = DB.ask(T('prob-cases'), U('u3'), 'prob', {}); const pr = DB.ask(T('prob-recov'), U('u3'), 'prob', {});
  const lc = DB.ask(T('prob-cases'), U('u1'), 'lead', {});
  ok(75, pc.state === 'ok' && pc.values[1] > 0 && pc.values[1] <= pc.values[0] && pc.visible < lc.visible && pr.state === 'ok'
    && ['prob-court', 'prob-exp'].every(id => DB.ask(T(id), U('u3'), 'prob', {}).state === 'ok') && DB.composeLayout('u3', 'prob').includes('prob-recov'),
    `Проблемные кредиты: дел открыто / в карантине ${pc.values.join(' / ')}; дела видны через требования своего охвата (${pc.visible} из ${lc.visible}) (ДБ-61)`);
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
  const bk = DB.ask(T('lead-bucket'), U('u1'), 'lead', {});
  ok(78, open.length === bk.total.v && new Set(open.map(x => x.loan)).size === open.length,
    `у каждого кредита в просрочке ровно один тянущийся эпизод: ${open.length} = «Просрочка по сроку» ${bk.total.v} (урок «демо-числа противоречат»)`);
  DB.STAND.spells = false;
  // ДБ-63: объект имущества, роль «Специалист по имуществу»
  const ast = DB.USERS.find(u => u.roles.includes('ast'));
  ok(79, DB.ROLES.find(r => r.id === 'ast' && r.name === 'Специалист по имуществу' && r.scope === 'dept') && ast && DB.state.declared.ast
    && DB.composeLayout(ast.id, 'ast').filter(k => !k.startsWith('s:')).length === 8,
    `вкладка «Специалист по имуществу»: системная роль, охват «моё подразделение», 8 плиток (${ast && ast.name}) (ДБ-63, ДБ-38)`);
  const ai = DB.ask(T('ast-idle'), ast, 'ast', {}); const au = DB.ask(T('ast-unsold'), ast, 'ast', {});
  ok(80, ai.tl === 'yellow' && ai.value > 0 && Q('ast-idle').filter.some(c => c.f === 'daysOnBook' && c.v === 182) && Q('ast-unsold').filter.some(c => c.op === 'ge' && c.v === 3)
    && au.state === 'ok' && ['ast-count', 'ast-state', 'ast-kpod', 'ast-claim', 'ast-exp', 'ast-unsold'].every(id => ['ok', 'zero'].includes(DB.ask(T(id), ast, 'ast', {}).state)),
    `пороги «6 мес.» и «3 попытки» — фильтр вопроса, цвет — светофор автора: без попытки ${ai.value} (жёлтый), 3+ попыток ${au.value} (ДБ-63, ДБ-24)`);
  const la = DB.ask(T('lead-ast'), U('u1'), 'lead', {}); const sa = DB.ask(T('ast-count'), ast, 'ast', {});
  ok(81, la.values.join() === sa.values.join() && la.values[0] === 48,
    `Руководство «На балансе» и специалист «На учёте» сходятся: ${la.values[0]} объектов / ${DB.fmtVal(la.values[1], 'sum')} (урок «демо-числа противоречат»)`);
  DB.STAND.wave = 1;
  const w1 = DB.composeLayout('u1', 'lead');
  ok(82, !DB.roleHasLayout('ast') && !w1.includes('lead-ast') && !w1.includes('s:Имущество') && w1.includes('lead-rs') && w1.includes('lead-recov')
    && DB.composeLayout('u2', 'cur').includes('cur-rsstage') && /не объявлен/.test(DB.ask(T('ast-count'), ast, 'ast', {}).msg),
    'волна 1: заявка на реструктуризацию и дело уже отвечают; имущество — волна 2: у Руководства секции нет, специалист на минимальной (ДБ-63, ДБ-53)');
  DB.STAND.wave = 3;
  ok(83, DB.ask(T('lead-ast'), U('u3'), 'prob', {}).state === 'noaccess' && DB.ask(T('cur-rs'), U('u3'), 'prob', {}).state === 'noaccess',
    'имущество и реструктуризация закрыты ролям без права на эти объекты — «нет доступа» (ИДБ-4)');
  // ДБ-65: плитки заёмщика
  // строки закрытых договоров и погасивших клиентов живут всегда — сверяем с действующими
  const L = DB.DATA.loan.filter(l => !l.closed), Bs = DB.DATA.borrower.filter(b => DB.pstateAt(b, 0) === 'действующий');
  const leadOk = Bs.every(b => { const ls = L.filter(l => l.borrower === b.id); if (!ls.length) return false;
    const top = ls.reduce((a, l) => l.balance > a.balance ? l : a); return b.curator === top.curator && b.overCredits === ls.filter(l => l.overdueDays > 0).length; });
  const bo = DB.ask(T('lead-borod'), U('u1'), 'lead', {});
  ok(84, leadOk && Q('lead-borod').share.every(i => DB.IND[i].obj === 'borrower') && bo.state === 'ok' && bo.den === Bs.length && Bs.length === 903
    && bo.num === new Set(L.filter(l => l.overdueDays > 0).map(l => l.borrower)).size && bo.num <= DB.DATA.spell.filter(x => x.state === 'тянется').length,
    `Руководство: заёмщиков с просрочкой ${bo.num} из ${bo.den} · ${bo.value.toFixed(1)} % — клиенты, а не договоры; «есть просрочка» согласована с кредитами (ДБ-65)`);
  const cb = DB.ask(T('cur-borod'), U('u2'), 'cur', {}); const mineB = Bs.filter(b => b.curator === 'u2');
  const split = Bs.some(b => b.curator !== 'u2' && L.some(l => l.borrower === b.id && l.curator === 'u2'));
  ok(85, cb.state === 'ok' && cb.den === mineB.length && cb.num === mineB.filter(b => b.overCredits > 0).length && cb.den <= 47 && split,
    `Куратор: заёмщиков с просрочкой ${cb.num} из ${cb.den} — «я» у заёмщика — ведущий куратор; клиент, где Бекова ведёт младший кредит, в эту плитку не входит (ДБ-65)`);
  const np = DB.ask(T('cur-npay'), U('u2'), 'cur', {}); const lay = DB.composeLayout('u2', 'cur');
  ok(86, np.state === 'ok' && np.value === mineB.filter(b => b.npayDays <= 3).length && np.value > 0
    && lay.indexOf('cur-obl') === lay.indexOf('cur-npay') + 1 && lay.indexOf('tasks') === lay.indexOf('cur-obl') + 1 && lay.indexOf('cur-borod') === lay.indexOf('cur-loans') + 1
    && DB.composeLayout('u1', 'lead').indexOf('lead-borod') === DB.composeLayout('u1', 'lead').indexOf('lead-borr') + 1,
    `Куратор: заёмщиков с платежом в ближайшие 3 дня ${np.value} — один клиент один раз, по ближайшему платежу всего портфеля; плитки стоят на местах канона (ДБ-65)`);
  // ДБ-66: разрезы заёмщика — из реестра статистики, выборка
  const BD = ['bworst', 'bodays', 'subgroup', 'ptype', 'bindustry'];
  const bt = (dims, format) => Object.assign(DB.blankReportDraft(), { obj:'borrower', inds:['borrower.count'], dims, format, filter:[{ f:'pstate', op:'eq', v:'действующий' }] });
  const steps = BD.filter(d => DB.DIMS[d].ordered).map(d => DB.answer(bt([d], 'steps'), U('u1'), 'lead', {}));
  // плитка на отчёте с этим разрезом: «Ступени» на первом уровне строк
  const onDim = d => { DB.R('r-tmp-' + d, { title:'tmp', obj:'borrower', cols:['borrower.count'], dims:[d], filter:[{ f:'pstate', op:'eq', v:'действующий' }], params:{ date:{ name:'Дата' } } });
    return Object.assign(DB.blankDraft('r-tmp-' + d), { pick:{ cols:['borrower.count'], level:1 }, format:'steps' }); };
  const stepsOk = BD.filter(d => DB.DIMS[d].ordered).every(d => { const td = onDim(d); return DB.formatsFor(td).find(x => x.f === 'steps').ok && DB.ask(td, U('u1'), 'lead', {}).total.v === Bs.length; });
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
  const draft = o => Object.assign(DB.blankReportDraft(), o);   // вопрос собирает конструктор отчётности
  // ДБ-Д22: шкала категорий — классификатор владельца
  const cat = DB.ask(T('lead-cat'), U('u1'), 'lead', {});
  ok(90, DB.DIMS.category.values.join('|') === 'Низкий кредитный риск|Средний кредитный риск|Высокий кредитный риск|Потери|Убыток'
    && DB.DIMS.bworst.values === DB.DIMS.category.values && cat.nodes.map(n => n.short).join(' · ') === 'низкий · средний · высокий · потери · убыток'
    && cat.total.v === L.length,
    `категории — шкала классификатора: ${cat.nodes.map(n => n.short + ' ' + n.value).join(' · ')} (ДБ-Д22)`);
  // ДБ-68, ДБ-69: «действующие» по умолчанию, печатается, снимается
  const lb = DB.ask(T('lead-borr'), U('u1'), 'lead', {}), ll = DB.ask(T('lead-loans'), U('u1'), 'lead', {});
  const bAll = DB.answer(draft({ obj:'borrower', inds:['borrower.count'], filter:[] }), U('u1'), 'lead', {});
  const bPaid = DB.answer(draft({ obj:'borrower', inds:['borrower.count'], filter:[{ f:'pstate', op:'eq', v:'весь портфель погашен' }] }), U('u1'), 'lead', {});
  DB.rSet('obj', 'borrower'); const bd = DB.rdraft; const hintB = DB.reportHints(draft({ obj:'borrower', inds:['borrower.count'], filter:[] }));
  DB.newReportDraft();
  ok(91, lb.value === 903 && bAll.value === allB.length && allB.length > 903 && bPaid.value > 0 && bAll.value === lb.value + bPaid.value + allB.filter(b => DB.pstateAt(b, 0) === 'без договоров').length
    && ll.value === L.length && allL.length > L.length && DB.qualOf(T('lead-borr')) === 'действующие' && DB.qualOf(T('lead-loans')) === 'действующие'
    && bd.filter.length === 1 && bd.filter[0].f === 'pstate' && DB.blankReportDraft().filter[0].f === 'lact' && hintB.some(h => /складывает действующих и погасивших/.test(h)),
    `«Заёмщиков» ${lb.value} — действующие из ${allB.length} строк (погасивших ${bPaid.value}); «Кредитов» ${ll.value} из ${allL.length}; конструктор сам ставит фильтр, без него — подсказка (ДБ-68, ДБ-69)`);
  // ДБ-70, ДБ-80: фильтр числителя — один показатель, клик — строки с обоими фильтрами
  const bo = DB.ask(T('lead-borod'), U('u1'), 'lead', {}); const who = DB.statRows(T('lead-borod'), U('u1'), 'lead', {});
  ok(92, Q('lead-borod').inds.length === 1 && Q('lead-borod').share[0] === Q('lead-borod').share[1] && Q('lead-borod').numFilter.length === 1
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
  DB.newDraft(shRep.id); DB.dPct('ptype', ['юр']); DB.dTitle('Юрлица среди клиентов с просрочкой 91+'); const shT = DB.ask(DB.draft, U('u1'), 'lead', {});
  ok(93, c1 && c2 && p1 === p2 && p1 === Bs.filter(b => b.worstDays > 90).length && DB.condText(c1) === 'Худшая просрочка по портфелю ∈ 91–180, 181+'
    && DB.condText(c2) === 'Худшая просрочка по портфелю, дн. > 90' && sh.ok && DB.autocheck(DB.draft).ok && shRep.dims.join() === 'ptype' && shT.state === 'ok' && shT.den === p2
    && shT.num === Bs.filter(b => b.worstDays > 90 && b.ptype === 'юр').length,
    `конструктор собирает фильтр по значению: «${DB.condText(c1)}» = «${DB.condText(c2)}» = ${p1} клиентов; доля юрлиц среди них — разрез «Тип лица» в отчёте и ячейка «юр» на плитке: ${shT.num} из ${shT.den} (ДБ-Д23, ДБ-111)`);
  // ДБ-71, ДБ-74: движение клиентов — черновик до статистики
  const m0 = DB.ask(T('lead-bmove'), U('u1'), 'lead', {}); const off = !DB.tileAnswers(T('lead-bmove')) && !DB.composeLayout('u1', 'lead').includes('lead-bmove');
  DB.STAND.clientFlows = true;
  const mv = DB.ask(T('lead-bmove'), U('u1'), 'lead', {}).move; const lay = DB.composeLayout('u1', 'lead');
  const at = m => allB.filter(b => b.from <= m && DB.pstateAt(b, m) === 'действующий').length;
  ok(94, m0.state === 'refusal' && /даты погашения всего портфеля/.test(m0.msg) && off && mv.converges && mv.M === -1
    && mv.start === at(-2) && mv.end === at(-1) && mv.inc.map(x => x.name).join() === 'новые,вернулись' && mv.dec[0].name === 'погасили всё'
    && mv.inc[0].v === allB.filter(b => b.firstM === -1).length && mv.dec[0].v > 0 && lay.indexOf('lead-bmove') === lay.indexOf('lead-bodays') + 1,
    `«Клиенты за прошлый месяц» — черновик, пока статистика не отдаёт потоки; затем ${mv.start} → +${mv.ti} −${mv.td} прочее ${mv.other} → ${mv.end}, сходится (ДБ-71, ДБ-74, ДБ-53)`);
  DB.STAND.clientFlows = false;
  // ДБ-72, ДБ-73: «Область» — по регистрации, «Программа» не действует
  const osh = DB.ask(T('lead-borr'), U('u1'), 'lead', { region:'Ошская' }), pr = DB.ask(T('lead-borr'), U('u1'), 'lead', { program:'agro' });
  ok(95, osh.value === Bs.filter(b => b.region === 'Ошская').length && /фильтр: Ошская · по регистрации заёмщика/.test(osh.passport)
    && pr.value === 903 && /без фильтра/.test(pr.passport) && !/по регистрации/.test(DB.ask(T('lead-loans'), U('u1'), 'lead', { region:'Ошская' }).passport),
    `панель у заёмщика: «Ошская» режет по территории регистрации — ${osh.value} клиентов с подписью; «Программа» — без фильтра; у кредита подписи нет (ДБ-72, ДБ-73)`);
  // ДБ-74, ДБ-88: ступени худшей просрочки и совокупного долга в «Картине портфеля»
  const bk = DB.ask(T('lead-bodays'), U('u1'), 'lead', {}); const debt = DB.ask(T('lead-bdebt'), U('u1'), 'lead', {});
  const bal = DB.ask(T('lead-bal'), U('u1'), 'lead', {}).move.end;
  ok(96, bk.nodes.reduce((a, n) => a + n.value, 0) === bo.num && debt.table.rows.map(r => r.label).join('|') === 'до 1 млн|1–10 млн|10–50 млн|50+ млн'
    && debt.total[0] === 903 && Math.round(debt.total[1]) === Math.round(bal) && /⚑/.test(DB.reqOf(T('lead-bdebt')).length ? '⚑' : '')
    && ['lead-bodays', 'lead-bdebt'].every(id => DB.composeLayout('u1', 'lead').indexOf(id) > DB.composeLayout('u1', 'lead').indexOf('lead-spcure')),
    `ступени клиентов: худшая просрочка ${bk.nodes.map(n => n.value).join(' · ')} (= ${bo.num}); совокупный долг ${debt.table.rows.map(r => r.cells[0]).join(' · ')} — в порядке ступеней, деньги = остаток портфеля (ДБ-74, ДБ-82, ДБ-88)`);
  // ДБ-76: Проблемные кредиты видят заёмщика через свои требования
  const pdP = DB.ask(T('prob-dead'), U('u3'), 'prob', {}), pdL = DB.ask(T('prob-dead'), U('u1'), 'lead', {});
  const viaC = new Set(DB.DATA.claim.filter(c => c.dept === 'opk').map(c => c.loan));
  const seen = new Set(allL.filter(l => viaC.has(l.id)).map(l => l.borrower));
  ok(97, pdP.state === 'ok' && pdP.visible === seen.size && pdP.value > 0 && pdP.value < pdL.value
    && pdL.value === Bs.filter(b => b.pers !== 'действует').length && DB.composeLayout('u3', 'prob').includes('prob-dead'),
    `«Должник умер или ликвидирован»: отдел взыскания видит ${pdP.value} — клиентов своих требований (${pdP.visible}), Руководство — ${pdL.value} (ДБ-74, ДБ-76)`);
  // ДБ-75: подпись куратора
  ok(98, /клиенты, где вы ведущий куратор/.test(DB.qualOf(T('cur-borod'))) && /клиенты, где вы ведущий куратор/.test(DB.qualOf(T('cur-npay')))
    && !/ведущий/.test(DB.qualOf(T('cur-loans'))),
    `плитки куратора на заёмщике печатают «${DB.qualOf(T('cur-borod'))}», на кредите — нет (ДБ-75, ДБ-Д20)`);
  // ДБ-67: деньги заёмщика есть, итог — у кредита, подсказка
  const money = Object.values(DB.IND).filter(i => i.obj === 'borrower' && i.unit === 'sum');
  const byType = DB.answer(draft({ obj:'borrower', inds:['borrower.total'], dims:['ptype'], format:'slice', filter:[ACT] }), U('u1'), 'lead', {});
  const hint = DB.reportHints(draft({ obj:'borrower', inds:['borrower.total'], filter:[ACT] }));
  const layB = Object.values(DB.DECLARED_SEED).flat().filter(k => DB.tileById(k)).some(k => DB.questionOf(DB.tileById(k)).inds.some(i => DB.IND[i].obj === 'borrower' && DB.IND[i].unit === 'sum' && DB.tileById(k).format !== 'table'));
  ok(99, money.length >= 2 && Math.round(byType.total.v) === Math.round(bal) && hint.some(h => /Итог денег — у объекта «Кредит»/.test(h)) && !layB,
    `у заёмщика деньги портфеля (${money.map(i => i.name).join(', ')}): по типу лица ${byType.nodes.map(n => n.label.split(' ')[0] + ' ' + DB.fmtVal(n.value, 'sum')).join(' · ')}; без разреза — подсказка «итог у кредита» (ДБ-67)`);
  // ДБ-77, ДБ-78: форматы и сдвиг счёта клиентов
  const tb = o => Object.assign(DB.blankDraft('r-borrowers'), o);      // плитка на отчёте «Заёмщики» (действующие — в отчёте)
  const fc = DB.formatsFor(tb({}));
  const sPm = DB.ask(tb({ format:'shift', shift:'prevMonthEnd' }), U('u1'), 'lead', {});
  const sYs = DB.ask(tb({ format:'shift', shift:'yearStart' }), U('u1'), 'lead', {});
  ok(100, fc.find(x => x.f === 'move').ok && fc.find(x => x.f === 'shift').ok && DB.shiftsFor(tb({})).length === 3 && DB.shiftsFor(tb({})).every(x => x.ok)
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
  const rp = DB.ask(T('cat-brep'), U('u1'), 'lead', {}), hs = DB.ask(T('cat-bhist'), U('u1'), 'lead', {});
  const cat3 = DB.catalogFor(U('u1')).filter(x => ['cat-brep', 'cat-bhist', 'cat-brepsh'].includes(x.t.id));
  ok(103, rp.nodes.map(n => n.label).join() === '1,2,3+' && rp.total.v === 903 && hs.nodes.map(n => n.label).join() === 'без просрочек,1–30,31–90,91+'
    && hs.nodes.reduce((a, n) => a + n.value, 0) === 903 && hs.nodes[3].value >= Bs.filter(b => b.worstDays > 90).length
    && cat3.length === 3 && !Object.values(DB.DECLARED_SEED).flat().some(k => ['cat-brep', 'cat-bhist'].includes(k)),
    `в каталоге: по числу договоров ${rp.nodes.map(n => n.value).join(' · ')}, кредитная история ${hs.nodes.map(n => n.value).join(' · ')} — 91+ не меньше текущей просрочки 91+ (ДБ-83, ДБ-84, ДБ-88)`);
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
  const draft = o => Object.assign(DB.blankReportDraft(), o);   // вопрос собирает конструктор отчётности
  const PI = Object.values(DB.IND).filter(i => i.obj === 'program');
  ok(106, PI.length === 1 && PI[0].agg === 'count' && !Object.values(DB.IND).some(i => /лимит/i.test(i.name)) && DB.OBJ_DIMS.program.length === 9
    && !DB.TILES.some(t => DB.questionOf(t).inds.some(i => DB.IND[i].obj === 'program' && DB.IND[i].unit === 'sum')),
    `у программы один показатель «${PI[0].name}» и ${DB.OBJ_DIMS.program.length} разрезов реестра; денежных мер и лимита нет (ДБ-89, ДБ-90, ДБ-93, ДБ-Д26)`);
  const pr = DB.ask(T('lead-prog'), U('u1'), 'lead', {}), ll = DB.ask(T('lead-loans'), U('u1'), 'lead', {});
  const bal = DB.ask(T('lead-bal'), U('u1'), 'lead', {}).move.end, pis = DB.ask(T('lead-progis'), U('u1'), 'lead', {}), iss = DB.ask(T('lead-issued'), U('u1'), 'lead', {});
  ok(107, DB.IND[Q('lead-prog').inds[0]].obj === 'loan' && Q('lead-prog').dims[0] === 'program' && pr.total[0] === ll.value && Math.round(pr.total[1]) === Math.round(bal)
    && pr.table.rows.length === 6 && pis.total.v === iss.value && DB.composeLayout('u1', 'lead').indexOf('lead-progis') === DB.composeLayout('u1', 'lead').indexOf('lead-prog') + 1,
    `«Портфель по программам» — срез кредита: ${pr.table.rows.length} программ, ${pr.total[0]} кредитов = «Кредитов», остаток = итог портфеля; «выдано по программам» ${DB.fmtVal(pis.total.v, 'sum')} = «Выдано с начала года» (ДБ-91, ДБ-98)`);
  const mix = DB.rcheck(draft({ title:'смесь', inds:['loan.balance', 'loan.issued'], format:'table', dims:['program'] }));
  const tmix = DB.autocheck(Object.assign(DB.blankDraft('r-programs'), { title:'смесь', pick:{ cols:['loan.balance', 'loan.issued'], level:1 }, format:'table' }));
  DB.newReportDraft(); DB.rInd('loan.balance', true); DB.rInd('loan.issued', true); const kept = DB.rdraft.inds.slice(); DB.newReportDraft();
  DB.newDraft('r-programs'); DB.dCol('loan.issued', true); const keptT = DB.draft.pick.cols.slice();
  ok(108, !mix.ok && mix.checks.some(c => !c.ok && /одного рода/.test(c.text)) && kept.join() === 'loan.count,loan.balance'
    && !tmix.ok && tmix.checks.some(c => !c.ok && /одного рода/.test(c.text)) && keptT.join() === 'loan.count',
    'остаток и поток в одной плитке не собрать: автопроверка «показатели одного рода» у отчёта и у плитки, конструктор отчётности и сборка плитки не дают отметить (ДБ-92, ДБ-109)');
  const pa = DB.ask(T('cat-progn'), U('u1'), 'lead', {}), all = DB.answer(draft({ obj:'program', inds:['program.count'], filter:[] }), U('u1'), 'lead', {});
  DB.rSet('obj', 'program'); const pd = DB.rdraft; const hp = DB.reportHints(pd); DB.newReportDraft();
  ok(109, pa.value === 6 && all.value === 8 && DB.qualOf(T('cat-progn')) === 'действующие' && pd.filter[0].f === 'pgstate'
    && hp.some(h => /Денег у программы нет/.test(h)) && DB.reportHints(draft({ obj:'program', inds:['program.count'], filter:[] })).some(h => /действующие и закрытые программы/.test(h)),
    `«Программ действует» ${pa.value} из ${all.value} строк; конструктор ставит «действующие» и подсказывает, что деньги — у кредита (ДБ-94, ДБ-89)`);
  const pf = DB.ask(T('cat-progn'), U('u1'), 'lead', { program:'agro' }), rf = DB.ask(T('cat-progn'), U('u1'), 'lead', { region:'Ошская' });
  const tf = DB.ask(T('lead-prog'), U('u1'), 'lead', { program:'agro' });
  ok(110, pf.value === 1 && /фильтр: Агрокредит/.test(pf.passport) && rf.value === 6 && /без фильтра/.test(rf.passport) && tf.table.rows.length === 1,
    `панель «Программа» режет объект программы по самой программе (${pf.value}), «Область» — без фильтра; таблица по программам — одна строка (ДБ-95, ДБ-Д27)`);
  const sp = DB.ask(T('spec-pend'), U('u6'), 'spec', {});
  ok(111, sp.value === DB.DATA.program.filter(p => p.state === 'действует' && p.pendDays !== null && p.pendDays <= 90).length && sp.value === 1 && sp.tl === 'yellow'
    && DB.reqOf(T('spec-pend')).length === 1 && DB.composeLayout('u6', 'spec').includes('spec-pend'),
    `«Программы, истекающие в ближайшие 90 дней» у специалиста: ${sp.value}, жёлтый; дата окончания — заявка статистике ⚑ (ДБ-96, ДБ-98)`);
  const bs = DB.ask(T('cat-balsrc'), U('u1'), 'lead', {});
  ok(112, Math.round(bs.nodes.reduce((a, n) => a + n.value, 0)) === Math.round(bal) && bs.nodes.length === 3 && DB.reqOf(T('cat-balsrc')).length === 1
    && DB.OBJ_DIMS.loan.includes('lpsource') && DB.OBJ_DIMS.loan.includes('lpline'),
    `«Остаток по источникам финансирования» — разрез кредита через ключ программы: ${bs.nodes.map(n => n.label + ' ' + DB.fmtVal(n.value, 'sum')).join(' · ')} ⚑ (ДБ-97)`);
})();

/* ---------- O. Плитка — ссылка на отчёт ---------- */
(() => {
  DB.seed();
  const ll = T('lead-loans'), cl = T('cur-loans'), rep = DB.reportById(ll.report);
  const own = t => ['inds', 'dims', 'filter', 'numFilter', 'share', 'period', 'date'].some(k => k in t);
  const ACT_L = { f:'lact', op:'eq', v:'действующий' }, ACT_B = { f:'pstate', op:'eq', v:'действующий' }, ME = { f:'curator', op:'eq', v:'@me' };
  // прежний вопрос плитки — литералом, тем же движком
  const old = (filter, u, role) => DB.answer({ id:'old', format:'number', inds:['loan.count'], dims:[], filter }, U(u), role, {});
  const a1 = DB.ask(ll, U('u1'), 'lead', {}), a2 = DB.ask(cl, U('u2'), 'cur', {}), o1 = old([ACT_L], 'u1', 'lead'), o2 = old([ME, ACT_L], 'u2', 'cur');
  const same = (a, o) => a.state === 'ok' && a.value === o.value && a.visible === o.visible && a.passport === o.passport;
  ok(113, !own(ll) && !own(cl) && rep && cl.report === ll.report && DB.REPORTS.includes(rep) && rep.cols.join() === 'loan.count'
    && ll.params.curator === '*' && cl.params.curator === '@me' && Q('cur-loans').filter[1] !== rep.filter[0]
    && JSON.stringify(Q('lead-loans').filter) === JSON.stringify([ACT_L]) && JSON.stringify(Q('cur-loans').filter) === JSON.stringify([ME, ACT_L])
    && same(a1, o1) && same(a2, o2) && a1.tileId === 'lead-loans' && a2.tileId === 'cur-loans' && a2.value === 47 && a1.value > a2.value,
    `«Кредитов» и «Мои кредиты» — один отчёт «${rep && rep.title}», куратор = все / я; своего вопроса у плиток нет, числа прежние: ${a1.value} и ${a2.value} (ДБ-99, ДБ-100)`);
  const k2 = DB.scopeKey(cl, U('u2'), 'cur');
  ok(114, k2.startsWith('user:') && DB.scopeKey(ll, U('u1'), 'lead').startsWith('roles:'),
    `«я» в значении параметра остаётся относительным: ключ кэша «Моих кредитов» личный (${k2}), у «Кредитов» — по охвату ролей (ДБ-101, ДБ-113)`);
  // ДБ-111: доля с фильтром числителя — ячейка разреза «договоров с просрочкой» в «% от итога группы»
  const bd = DB.OBJ_DIMS.borrower.find(d => DB.DIMS[d].name === 'Договоров с просрочкой'), D = bd && DB.DIMS[bd];
  const bo = DB.ask(T('lead-borod'), U('u1'), 'lead', {});
  const sp = DB.answer({ id:'split', format:'steps', inds:['borrower.count'], dims:[bd], filter:[ACT_B] }, U('u1'), 'lead', {});
  const cell = v => (sp.nodes.find(n => n.v === v) || {}).value;
  DB.R('r-tmp-borr', { title:'Заёмщики по просрочке', obj:'borrower', cols:['borrower.count'], dims:[bd], filter:[ACT_B] });
  const pct = DB.ask({ id:'pct', format:'number', report:'r-tmp-borr', pick:{ pct:{ dim:bd, cells:['больше 0'] } } }, U('u1'), 'lead', {});
  DB.seed();
  ok(115, D && D.ordered && !D.at && D.req && D.values.join() === '0,больше 0' && sp.nodes.map(n => n.v).join() === '0,больше 0'
    && cell('больше 0') === bo.num && cell('0') + cell('больше 0') === bo.den && pct.num === bo.num && pct.den === bo.den && pct.value === bo.value
    && !DB.reportById('r-tmp-borr'),
    `разрез заёмщика «Договоров с просрочкой» (⚑ заявка статистике): 0 — ${cell('0')}, больше 0 — ${cell('больше 0')}; доля ячейки «больше 0» = прежний фильтр числителя «Заёмщиков с просрочкой» ${bo.num} из ${bo.den} (ДБ-111)`);
  // Руководство целиком на отчётах: у плитки ссылка, значения параметров и выбор — своего вопроса нет
  const leads = DB.TILES.filter(t => t.id.startsWith('lead-'));
  const noOwn = leads.every(t => t.report && DB.reportById(t.report) && !own(t) && Q(t.id) && Q(t.id).inds.every(i => DB.reportById(t.report).cols.includes(i)));
  const repIds = [...new Set(leads.map(t => t.report))];
  ok(116, leads.length === 26 && noOwn && repIds.every(id => DB.reportById(id)) && repIds.length === 17,
    `все ${leads.length} плиток Руководства ссылаются на отчёты (${repIds.length} шт.); ни у одной нет своих показателей, разрезов, фильтра, доли, даты и периода; все отчёты есть в каталоге (ДБ-99, ДБ-100)`);
  // «Заёмщиков с просрочкой» — ячейка «больше 0» разреза, «% от итога группы»; значение, числитель и знаменатель прежние
  const qb = Q('lead-borod'), bo2 = DB.ask(T('lead-borod'), U('u1'), 'lead', {});
  const ob = DB.answer({ id:'old-borod', format:'number', inds:['borrower.count'], share:['borrower.count', 'borrower.count'], filter:[ACT_B], numFilter:[{ f:'overCredits', op:'gt', v:0 }] }, U('u1'), 'lead', {});
  ok(117, qb.share.join() === 'borrower.count,borrower.count' && JSON.stringify(qb.numFilter) === JSON.stringify([{ f:'bover', op:'in', v:['больше 0'] }])
    && JSON.stringify(qb.filter) === JSON.stringify([ACT_B]) && qb.dims.length === 0 && T('lead-borod').pick.pct.dim === 'bover'
    && bo2.state === 'ok' && bo2.value === ob.value && bo2.num === ob.num && bo2.den === ob.den && bo2.num > 0 && DB.reqOf(T('lead-borod')).length === 1,
    `«Заёмщиков с просрочкой» — «% от итога группы» по ячейке «больше 0»: ${bo2.num} из ${bo2.den} = прежнему фильтру числителя «договоров с просрочкой > 0»; новый разрез — заявка статистике ⚑ (ДБ-111)`);
  // один отчёт кормит несколько плиток Руководства: колонки у плитки — выбор, а не свой вопрос
  const feed = {}; leads.forEach(t => { (feed[t.report] = feed[t.report] || []).push(t.id); });
  const port = feed['r-portfolio'] || [], prep = DB.reportById('r-portfolio');
  ok(118, Object.values(feed).some(a => a.length >= 2) && port.length === 5 && ['lead-bal', 'lead-od', 'lead-odsh', 'lead-risk', 'lead-odser'].every(id => port.includes(id))
    && prep.title === 'Портфель кредитов' && prep.cols.join() === 'loan.balance,loan.overdue,loan.risk,loan.restr,loan.coll,loan.noClaim181' && port.every(id => Q(id).filter.length === 0 && Q(id).dims.length === 0)
    && new Set(port.map(id => Q(id).inds.join())).size === 4,
    `отчёт «${prep.title}» кормит ${port.length} плиток Руководства (${port.join(', ')}) — остаток, просрочено, доля, риск, ряд; всего отчётов ${repIds.length} на ${leads.length} плиток (ДБ-114)`);
  // один отчёт — две роли, разные значения параметра: «Просрочка по сроку неплатежа» у Руководства (куратор — все) и у Куратора (куратор — я)
  const OD0 = { f:'overdueDays', op:'gt', v:0 };
  const oldBk = (filter, u, role) => DB.answer({ id:'old-bucket', format:'steps', inds:['loan.count'], dims:['bucket'], filter }, U(u), role, {});
  const bl = DB.ask(T('lead-bucket'), U('u1'), 'lead', {}), bc = DB.ask(T('cur-bucket'), U('u2'), 'cur', {}), ol = oldBk([OD0], 'u1', 'lead'), oc = oldBk([ME, OD0], 'u2', 'cur');
  const sameBk = (a, o) => a.state === 'ok' && JSON.stringify(a.nodes) === JSON.stringify(o.nodes) && JSON.stringify(a.total) === JSON.stringify(o.total) && a.visible === o.visible && a.passport === o.passport;
  const sumN = a => a.nodes.reduce((x, n) => x + n.value, 0);
  ok(119, T('lead-bucket').report === 'r-bucket' && T('cur-bucket').report === 'r-bucket' && !own(T('lead-bucket')) && !own(T('cur-bucket'))
    && T('lead-bucket').params.curator === '*' && T('cur-bucket').params.curator === '@me'
    && JSON.stringify(Q('lead-bucket').filter) === JSON.stringify([OD0]) && JSON.stringify(Q('cur-bucket').filter) === JSON.stringify([ME, OD0])
    && sameBk(bl, ol) && sameBk(bc, oc) && sumN(bc) > 0 && sumN(bc) < sumN(bl),
    `отчёт «${DB.reportById('r-bucket').title}» кормит плитку Руководства (куратор — все: ${sumN(bl)} кредитов) и плитку Куратора (куратор — я, «я» первым условием: ${sumN(bc)}); ступени совпадают с прежним литеральным вопросом (ДБ-100)`);
  // относительное значение — значение параметра отчёта: «сегодня + 3 дня» остаётся относительным
  const npT = T('cur-npay'), npR = DB.reportById(npT.report), npc = Q('cur-npay').filter.find(c => c.f === 'npayDays');
  const anp = DB.ask(npT, U('u2'), 'cur', {}), onp = DB.answer({ id:'old-npay', format:'number', inds:['borrower.count'], filter:[ME, ACT_B, { f:'npayDays', op:'le', v:'@today+3' }] }, U('u2'), 'cur', {});
  const allNp = DB.ask(withParams(npT, { npay:'*' }), U('u2'), 'cur', {});
  ok(120, npR.params.npay && npR.params.npay.dim === 'npayDays' && npR.params.npay.op === 'le' && npT.params.npay === '@today+3' && !own(npT)
    && npc && npc.op === 'le' && npc.v === '@today+3' && !Q('lead-borr').filter.some(c => c.f === 'npayDays') && !Q('cur-loans').filter.some(c => c.f === 'npayDays')
    && anp.state === 'ok' && anp.value === onp.value && anp.passport === onp.passport && anp.value > 0 && allNp.value > anp.value
    && DB.scopeKey(npT, U('u2'), 'cur').startsWith('user:') && /клиенты, где вы ведущий куратор · действующие/.test(DB.qualOf(npT)),
    `«Заёмщиков с платежом в ближайшие 3 дня»: отчёт «${npR.title}» объявляет параметр «${npR.params.npay.name}», плитка даёт значение ${npT.params.npay}; число прежнее ${anp.value}, без параметра — ${allNp.value} (ДБ-101)`);
  // «Доля повторных клиентов» — «% от итога группы» по ячейкам 2 и 3+ разреза «Договоров у клиента за всё время»; тот же отчёт, что у «Клиенты по числу договоров»
  const bsT = T('cat-brepsh'), brT = T('cat-brep'), qs = Q('cat-brepsh');
  const ars = DB.ask(bsT, U('u1'), 'lead', {}), brn = DB.ask(brT, U('u1'), 'lead', {});
  const ors = DB.answer({ id:'old-brepsh', format:'shift', shift:'yearStart', inds:['borrower.count'], share:['borrower.count', 'borrower.count'], filter:[ACT_B], numFilter:[{ f:'credits', op:'ge', v:2 }] }, U('u1'), 'lead', {});
  const rc = v => (brn.nodes.find(n => n.v === v) || {}).value;
  ok(121, bsT.report === brT.report && bsT.report === 'r-brep' && bsT.pick.pct.dim === 'bcredits' && bsT.pick.pct.cells.join() === '2,3+' && !own(bsT) && !own(brT)
    && qs.share.join() === 'borrower.count,borrower.count' && JSON.stringify(qs.numFilter) === JSON.stringify([{ f:'bcredits', op:'in', v:['2', '3+'] }])
    && qs.dims.length === 0 && JSON.stringify(qs.filter) === JSON.stringify([ACT_B]) && qs.shift === 'yearStart' && bsT.format === 'shift'
    && ars.state === 'ok' && ars.value === ors.value && ars.num === ors.num && ars.den === ors.den && JSON.stringify(ars.shift) === JSON.stringify(ors.shift) && ars.num > 0
    && rc('2') + rc('3+') === ars.num && rc('1') + rc('2') + rc('3+') === ars.den,
    `«Доля повторных клиентов» — ячейки 2 и 3+ из ${ars.den} клиентов: ${ars.num}, сдвиг с начала года прежний; отчёт «${DB.reportById(bsT.report).title}» общий с плиткой по числу договоров (ДБ-111, ДБ-114)`);
  // личная плитка Бековой — на личном отчёте её полки; Куратор и каталог целиком на отчётах
  const pa = T('p-u2-agro'), pr = DB.reportById(pa.report);
  const aa = DB.ask(pa, U('u2'), 'cur', {}), oa = DB.answer({ id:'old-agro', format:'number', inds:['loan.count'], filter:[ME, { f:'program', op:'eq', v:'agro' }, { f:'overdueDays', op:'gt', v:30 }] }, U('u2'), 'cur', {});
  const cc = DB.TILES.filter(t => /^(cur|cat)-/.test(t.id));
  const noOwnC = cc.every(t => t.report && DB.reportById(t.report) && !own(t) && Q(t.id) && Q(t.id).inds.every(i => DB.reportById(t.report).cols.includes(i)));
  const hold = pr && pr.title;
  pr && (pr.title = 'временно'); DB.seed();
  const pa2 = T('p-u2-agro');
  ok(122, pr && pr.shelf === 'personal' && pr.owner === 'u2' && pr.circle.owner === 'u2' && pa.owner === 'u2' && pa.state === 'personal' && !own(pa) && pa.params.curator === '@me'
    && aa.state === 'ok' && aa.value === oa.value && aa.value > 0 && aa.passport === oa.passport
    && cc.length === 29 && noOwnC && DB.REPORTS.filter(r => r.shelf === 'personal').length === 1
    && DB.reportById('r-u2-agro').title === hold && pa2.report === 'r-u2-agro' && pa2.state === 'personal' && DB.composeLayout('u2', 'cur').includes('p-u2-agro'),
    `«${pa.title}» ссылается на личный отчёт «${hold}» на полке Бековой (круг — она одна), значение «я» даёт плитка: ${aa.value} = прежнему вопросу; все ${cc.length} плиток Куратора и каталога на отчётах (${new Set(cc.map(t => t.report)).size} шт.), своего вопроса нет; отчёт переживает сброс стенда (ДБ-99, ДБ-103)`);
  // ни у одной плитки каталога нет своего вопроса: обзорная ссылается на отчёт, ссылочная — на очередь модуля-владельца
  DB.seed();
  const ov = DB.TILES.filter(t => t.kind !== 'link'), lk = DB.TILES.filter(t => t.kind === 'link'), qd = t => DB.queueById(t.queue);
  ok(123, DB.TILES.every(t => !own(t)) && ov.every(t => DB.reportById(t.report) && !t.queue && Q(t.id).inds.every(i => DB.reportById(t.report).cols.includes(i)))
    && lk.every(t => !t.report && qd(t) && qd(t).inds.length > 0 && Q(t.id).inds.join() === qd(t).inds.join() && Q(t.id).queue.module === qd(t).module && Q(t.id).queue.name === qd(t).name)
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
    && ['rep-sum', 'rep-ser'].every(id => DB.reportById(T(id).report).obj === 'oblig' && !own(T(id)) && T(id).kind === 'overview'),
    `«Просрочено обязательств», «Срок сдачи ≤ 7 дн.», «Сданные, где числа изменились» — обзорные на отчёте «${orp.title}», срок — параметр «${orp.params.due.name}» = ${obl[1].params.due}; числа прежние ${no.map(a => a.value).join(' / ')}; список — «${rg.registry}» модуля «${rg.owner}» (ДБ-108, ДБ-101)`);
  // отчёт со специалистом: параметр «Кредитный специалист», плитка Специалиста даёт «я», плитка Головного офиса на том же отчёте — без значения
  const SPEC = { f:'specialist', op:'eq', v:'@me' }, sp6 = U('u6'), spr = DB.reportById('r-apps');
  const sw = ['spec-work', 'spec-req', 'spec-status', 'spec-stage', 'spec-prog', 'spec-filed'].map(id => T(id));
  const aw = DB.ask(T('spec-work'), sp6, 'spec', {}), ow = DB.answer({ id:'old-sw', format:'number', inds:['app.inWork'], filter:[SPEC] }, sp6, 'spec', {});
  const ag = DB.ask(withParams(T('spec-work'), { specialist:'*' }), sp6, 'spec', {});
  const at = DB.ask(T('spec-stage'), sp6, 'spec', {}), ot = DB.answer({ id:'old-ss', format:'steps', inds:['app.inWork'], dims:['astage'], filter:[SPEC, { f:'status', op:'eq', v:'Новый' }] }, sp6, 'spec', {});
  ok(126, sw.every(t => t.kind === 'overview' && !own(t) && t.params.specialist === '@me' && DB.reportById(t.report).params.specialist.dim === 'specialist')
    && spr.params.specialist.name === 'Кредитный специалист' && T('spec-work').report === 'r-apps' && T('gof-max').report === 'r-apps' && !T('gof-max').params
    && !Q('gof-max').filter.some(c => c.f === 'specialist') && JSON.stringify(Q('spec-work').filter) === JSON.stringify([SPEC]) && JSON.stringify(Q('spec-stage').filter.map(c => c.f)) === '["specialist","status"]'
    && aw.state === 'ok' && aw.value === ow.value && aw.passport === ow.passport && aw.value > 0 && ag.value > aw.value
    && at.state === 'ok' && JSON.stringify(at.nodes) === JSON.stringify(ot.nodes) && JSON.stringify(at.total) === JSON.stringify(ot.total) && DB.scopeKey(T('spec-work'), sp6, 'spec').startsWith('user:'),
    `отчёт «${spr.title}»: плитка Специалиста даёт «я» (${aw.value} заявок в работе = прежнему вопросу), без значения — все ${ag.value}; плитка Головного офиса на нём же — без условия по специалисту; ступени «Новые заявки по стадии» прежние (ДБ-100)`);
})();

/* ---------- O (продолжение). Сигналы отчётности по порогам светофора ---------- */
(() => {
  DB.seed(); asUser('u1');
  const t = T('lead-odsh'), u1 = U('u1'), val = up => { DB.STAND.overdueUp = up; return DB.ask(t, u1, 'lead', {}).value; };
  const v0 = val(false), v1 = val(true); DB.STAND.overdueUp = false;
  const sg = DB.signalToggle('lead-odsh', 'lead'), msg = `${t.title} > 5 % — ${DB.fmtVal(v1, 'pct')} (было ${DB.fmtVal(v0, 'pct')})`;
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
  const fmt = (d, f) => DB.formatsFor(d).find(x => x.f === f);
  const bad = (a, re) => !a.ok && a.checks.some(c => !c.ok && re.test(c.text));
  // черновик на отчёте: формат — по уровню строк и разрезам отчёта
  const d0 = DB.newDraft('r-bucket'), f0n = fmt(d0, 'number'), f0s = fmt(d0, 'steps');
  DB.dLevel(1); const f1s = fmt(DB.draft, 'steps'), f1n = fmt(DB.draft, 'number'), auto1 = DB.draft.format;
  DB.dSet('format', 'steps'); const st = DB.draft.format; const lb = DB.ask(DB.draft, U('u1'), 'lead', {}), lt = DB.ask(T('lead-bucket'), U('u1'), 'lead', {});
  DB.dLevel(2); const lv2 = DB.draft.pick.level, h1 = fmt(DB.draft, 'heat');
  const dh = DB.newDraft('r-odmap'); DB.dLevel(2); const hh = fmt(dh, 'heat');
  const ah = DB.ask(dh, U('u1'), 'lead', {}), th = DB.ask(T('lead-heat'), U('u1'), 'lead', {});
  ok(130, !own(d0) && d0.report === 'r-bucket' && d0.pick.cols.join() === 'loan.count' && d0.params.curator === '*' && d0.params.date === 'today'
    && f0n.ok && !f0s.ok && f1s.ok && !f1n.ok && auto1 !== 'number' && st === 'steps' && lb.state === 'ok' && JSON.stringify(lb.nodes) === JSON.stringify(lt.nodes)
    && lv2 === 1 && !h1.ok && /два разреза/.test(h1.why) && hh.ok && dh.format === 'heat' && !own(dh) && ah.state === 'ok' && JSON.stringify(ah.heat) === JSON.stringify(th.heat),
    `черновик плитки на отчёте «${DB.reportById('r-bucket').title}» — ссылка, значения параметров и выбор, своего вопроса нет; итог — «Число» (ступени: «${f0s.why}»), первый разрез — «Ступени»; второго уровня у отчёта с одним разрезом нет; «${DB.reportById('r-odmap').title}» на втором уровне — «Тепловая карта»; числа — как у каталожных плиток (ДБ-100, ДБ-109)`);
  // официальный отчёт без параметра даты: дата зашита в отчёт, сдвиг и ряд погашены
  const rf = DB.reportById('r-form'), df = DB.newDraft('r-form'), fs = fmt(df, 'shift'), fr = fmt(df, 'series'), shf = DB.shiftsFor(df);
  DB.dSet('format', 'series'); DB.dSet('date', 'today'); DB.dParam('date', 'closedDay');
  const af = DB.ask(DB.draft, U('u1'), 'lead', {}), of = DB.answer({ id:'old-form', format:'number', inds:['loan.balance'], filter:[], date:'prevMonthEnd' }, U('u1'), 'lead', {});
  const forced = DB.answer(DB.questionOf(withParams(DB.draft, { date:'today' })), U('u1'), 'lead', {});   // вопрос даты не перекраивает; плитка с таким значением сломана — см. #150
  const acf = DB.autocheck(Object.assign({}, DB.draft, { title:'Форма', format:'shift' }));
  ok(131, rf.shelf === 'official' && Object.keys(rf.params).length === 0 && rf.asOf === 'prevMonthEnd' && Object.keys(df.params).length === 0
    && !fs.ok && !fr.ok && /не объявил дату/.test(fs.why) && /не объявил дату/.test(fr.why) && shf.length === 1 && !shf[0].ok && /не объявил дату/.test(shf[0].why)
    && DB.draft.format === 'number' && Object.keys(DB.draft.params).length === 0 && bad(acf, /не объявил дату/)
    && af.state === 'ok' && af.value === of.value && af.passport === of.passport && /^на 30\.09/.test(af.passport) && forced.value === af.value && forced.passport === af.passport,
    `официальный «${rf.title}» без параметра даты: сдвиг и ряд погашены («${fs.why}»), дату плитка не задаёт и не перекраивает; плитка показывает дату отчёта — ${af.passport} (ДБ-107)`);
  // автопроверка пригодности
  DB.newDraft('r-portfolio'); ['loan.overdue', 'loan.risk', 'loan.restr', 'loan.coll'].forEach(c => DB.dCol(c, true)); const kept4 = DB.draft.pick.cols.slice();
  const on = (rid, o) => DB.autocheck(Object.assign(DB.blankDraft(rid), { title:'x' }, o));
  const c5 = on('r-portfolio', { pick:{ cols:['loan.balance', 'loan.overdue', 'loan.risk', 'loan.restr', 'loan.coll'], level:0 } });
  const cm = on('r-portfolio', { pick:{ cols:['loan.balance', 'loan.issued'], level:0 } }), cf = on('r-bucket', { format:'steps' });
  const cpd = on('r-borover', { pick:{ cols:['borrower.count'], level:0, pct:{ dim:'region', cells:['Ошская'] } } });
  const cpc = on('r-borover', { pick:{ cols:['borrower.count'], level:0, pct:{ dim:'bover', cells:['нет такой'] } } });
  const cnt = DB.autocheck(Object.assign(DB.blankDraft('r-bucket'), { pick:{ cols:['loan.count'], level:1 }, format:'steps' }));
  const csh = on('r-portfolio', { params:{ curator:'*', date:'prevMonthEnd' }, format:'shift', shift:'prevMonthEnd' }), csy = on('r-portfolio', { params:{ curator:'*', date:'prevMonthEnd' }, format:'shift', shift:'yearStart' });
  const good = on('r-bucket', { pick:{ cols:['loan.count'], level:1 }, format:'steps' });
  const gpct = on('r-borover', { pick:{ cols:['borrower.count'], level:0, pct:{ dim:'bover', cells:['больше 0'] } } }), lbo = DB.ask(T('lead-borod'), U('u1'), 'lead', {});
  DB.reportById('r-bucket').state = 'archived'; const arch = on('r-bucket', {}); DB.reportById('r-bucket').state = 'active';
  asUser('u11'); const dg = DB.saveTile(Object.assign(DB.blankDraft('r-bucket'), { title:'Ступени', pick:{ cols:['loan.count'], level:1 }, format:'steps' }), 'draft').tile;
  const db = DB.saveTile(Object.assign(DB.blankDraft('r-bucket'), { title:'Ступени на итоге', format:'steps' }), 'draft').tile;
  const pg = DB.publishDraftId(dg.id), pb = DB.publishDraftId(db.id); asUser('u1');
  ok(132, pg === true && T(dg.id).state === 'published' && pb.error && bad(pb, /формат «Ступени»/) && T(db.id).state === 'draft' && kept4.length === 4 && !kept4.includes('loan.coll') && bad(c5, /от 1 до 4/) && bad(cm, /одного рода/) && bad(cm, /колонки из отчёта/) && bad(cf, /формат «Ступени»/)
    && bad(cpd, /% от итога группы/) && bad(cpc, /% от итога группы/) && bad(cnt, /подпись/) && bad(arch, /действует/) && bad(csh, /база совпадает/) && csy.ok
    && good.ok && good.preview.state === 'ok' && JSON.stringify(good.preview.nodes) === JSON.stringify(lt.nodes) && gpct.ok && gpct.preview.value === lbo.value && gpct.preview.num === lbo.num,
    'автопроверка плитки: пятая колонка, остаток с потоком, «Ступени» на итоге, «% от итога группы» не по разрезу отчёта или по несуществующей ячейке, база сдвига на дату плитки, без подписи, отчёт в архиве — отказ с причиной; годный черновик проходит, предпросмотр равен числам каталога; черновик каталога публикуется той же автопроверкой (ДБ-109, ДБ-30)');
  // «📌 на дашборд» → личная плитка: только ссылка, значения, выбор и показ; правка — версия, другой отчёт — новая плитка
  DB.seed(); asUser('u1');
  const pd = DB.pin('r-portfolio'), pinned = DB.draft === pd && pd.report === 'r-portfolio' && pd.title === DB.reportById('r-portfolio').title;
  DB.dCol('loan.overdue', true); DB.dCol('loan.balance', false); DB.dSet('format', 'move'); DB.dTitle('Просрочено — моя');
  const nt = (DB.saveDraft('personal') || {}).tile || {};
  const SHOW = ['id', 'kind', 'report', 'params', 'pick', 'format', 'shift', 'points', 'tl', 'title', 'owner', 'state', 'version', 'created'];
  const an = DB.ask(nt, U('u1'), 'lead', {}), ao = DB.ask(T('lead-od'), U('u1'), 'lead', {});
  const e1 = DB.editTile(nt.id, { params:{ curator:'*', date:'closedDay' } }), v1 = nt.version, ac = DB.ask(nt, U('u1'), 'lead', {});
  const e2 = DB.editTile(nt.id, { report:'r-loans' }), e3 = DB.editTile(nt.id, { filter:[] });
  ok(133, pinned && Object.keys(nt).length && Object.keys(nt).every(k => SHOW.includes(k)) && !own(nt) && nt.state === 'personal' && nt.owner === 'u1' && nt.report === 'r-portfolio'
    && nt.pick.cols.join() === 'loan.overdue' && an.state === 'ok' && JSON.stringify(an.move) === JSON.stringify(ao.move) && an.passport === ao.passport
    && e1.tile && v1 === 2 && /день закрыт/.test(ac.passport) && e2.error === 'Другой отчёт — это новая плитка' && e3.error && nt.version === 2 && nt.report === 'r-portfolio' && !own(nt),
    `«📌» из «${DB.reportById('r-portfolio').title}» → личная плитка «${nt.title}»: поля ${Object.keys(nt).join(', ')}; числа = «Просрочено» Руководства; правка значения даты — версия ${v1}; другой отчёт — «${e2.error}» (ДБ-103, ДБ-113)`);
  // плитка без отчёта и без очереди сломана, даже если несёт вопрос сама
  const bare = { id:'bare', title:'Без отчёта', kind:'overview', format:'number' };
  const oldq = { id:'old-q', title:'Свой вопрос', kind:'overview', format:'number', inds:['loan.count'], dims:[], filter:[] };
  const rb = DB.ask(bare, U('u1'), 'lead', {}), ro = DB.ask(oldq, U('u1'), 'lead', {}), ra = DB.answer(oldq, U('u1'), 'lead', {});
  const sr = DB.statRows(oldq, U('u1'), 'lead', {}), rg = DB.registryList(oldq, U('u1'), 'lead', {});
  const noRep = DB.ask(Object.assign({}, T('lead-loans'), { report:undefined }), U('u1'), 'lead', {});
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
  const rd = DB.rdraft, want = DB.answer(Object.assign({}, rd, { id:'draftq' }), U('u2'), 'cur', {});
  const n0 = DB.REPORTS.length, j0 = DB.state.journal.length;
  const blank = DB.saveAndPlace(Object.assign({}, rd, { title:'' }), 'cur');
  const sp = DB.rSaveAndPlace(), rep = sp.report, tl = sp.tile;
  const got = DB.ask(tl, U('u2'), 'cur', {}), q = DB.questionOf(tl);
  const feeds = DB.reportsFor(U('u2')).find(x => x.r.id === rep.id), seen1 = DB.reportsFor(U('u1')).some(x => x.r.id === rep.id);
  const jr = DB.state.journal.map(j => j.action);
  const cn = [rep.id, tl.id], nAfter = DB.REPORTS.length, drNull = DB.rdraft === null, onTab = DB.composeLayout('u2', 'cur').includes(tl.id), sk = DB.scopeKey(tl, U('u2'), 'cur'); DB.seed();
  ok(136, blank.error && blank.checks.some(c => !c.ok && /подпись/.test(c.text)) && nAfter === n0 + 1 && drNull && onTab
    && /^r-p-u2-\d+$/.test(rep.id) && rep.shelf === 'personal' && rep.owner === 'u2' && rep.circle.owner === 'u2' && Object.keys(rep.circle).join() === 'owner' && rep.state === 'active'
    && rep.cols.join() === 'loan.overdue' && rep.dims.join() === 'bucket' && JSON.stringify(rep.filter) === JSON.stringify([ACT_L]) && !rep.filter.some(c => String(c.v).startsWith('@'))
    && JSON.stringify(rep.params.curator) === JSON.stringify({ dim:'curator', op:'eq', name:'Куратор' }) && rep.params.date.name === 'Дата' && !rep.params.period
    && tl.state === 'personal' && tl.owner === 'u2' && tl.report === rep.id && tl.params.curator === '@me' && tl.params.date === 'today' && tl.pick.level === 1
    && feeds && feeds.feeds === 1 && !seen1 && got.state === 'ok' && JSON.stringify(got.nodes) === JSON.stringify(want.nodes) && got.total.v === want.total.v && got.passport === want.passport
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
  DB.newDraft(repB.id); DB.dPct('bover', ['больше 0']); DB.dTitle('Заёмщиков с просрочкой'); const dT = DB.draft, aT = DB.autocheck(dT);
  const mineB = DB.ask(dT, U('u1'), 'lead', {}), leadB = DB.ask(T('lead-borod'), U('u1'), 'lead', {});
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
  const prog = DB.ask(T('lead-prog'), u1, 'lead', {}).table.rows.map(r => ({ r, d: DB.drill('lead-prog', u1, 'lead', {}, { d:'program', v:r.v }) }));
  const per = prog.find(x => x.r.v === 'per'), agro = prog.find(x => x.r.v === 'agro');
  const bk = DB.ask(T('lead-bucket'), u1, 'lead', {}).nodes.map(n => ({ n, d: DB.drill('lead-bucket', u1, 'lead', {}, { d:'bucket', v:n.v }) }));
  const b1 = bk.find(x => x.n.v === '1–30');
  const tot = DB.drill('cur-loans', u2, 'cur', {}), ser = DB.drill('prob-recser', U('u3'), 'prob', {}, { m:-3 }), ser0 = DB.drill('prob-recser', U('u3'), 'prob', {}, { m:0 });
  const pts = DB.ask(T('prob-recser'), U('u3'), 'prob', {}).series.points, big = DB.drill('lead-loans', u1, 'lead', {});
  ok(140, prog.every(x => x.d.refused ? x.d.count === x.r.cells[0] : x.d.matches && x.d.list.length === x.r.cells[0] && x.d.sum === x.r.cells[0])
    && !per.d.refused && per.d.matches && per.d.nodeText === 'Переработка' && agro.d.refused && /сузьте/.test(agro.d.msg)
    && bk.every(x => !x.d.refused && x.d.matches && x.d.sum === x.n.value) && !b1.d.refused && b1.d.list.length === b1.n.value && b1.d.sum === b1.n.value && b1.d.nodeText === '1–30'
    && !tot.refused && tot.matches && tot.sum === 47 && big.refused && big.count === 1248
    && ser.matches && ser.sum === pts.find(p => p.m === -3).vals[0] && ser0.matches && ser0.sum === pts.find(p => p.m === 0).vals[0] && ser.nodeText === 'за июль',
    `провал отчёта по узлу: у «Портфель по программам» строка «Переработка» — ${per.d.list.length} объектов, сумма ${per.d.sum} = числу в строке; «Агрокредит» (${agro.d.count}) — отказ выше порога; ступень «1–30» «Просрочки по сроку» — ${b1.d.list.length} = ${b1.n.value}, все четыре ступени сходятся; точка ряда «Взыскано» за июль — ${ser.list.length} требований, сумма = столбцу (ДБ-105)`);

  // отчёт плитки: те же значения параметров и фильтр панели; ответ отчёта — первый уровень строк, без разрезов — итог
  const reg = { region:'Ошская' }, v = DB.reportView('cur-bucket', u2, 'cur', reg), vAll = DB.reportView('cur-bucket', u2, 'cur', {}), vChu = DB.reportView('cur-bucket', u2, 'cur', { region:'Чуйская' });
  const tileNodes = DB.ask(T('cur-bucket'), u2, 'cur', reg).nodes, rep = DB.reportById(T('cur-bucket').report);
  const vod = DB.reportView('lead-od', u1, 'lead', {}), vnp = DB.reportView('cur-npay', u2, 'cur', {}), vlk = DB.reportView('acc-unident', U('u4'), 'acc', {});
  const pv = (view, name) => (view.params.find(p => p.name === name) || {}).value;
  ok(141, pv(v, 'Куратор') === 'я' && pv(vAll, 'Куратор') === 'я' && pv(vod, 'Куратор') === 'все' && pv(v, 'Дата') === 'сегодня' && pv(vnp, 'Платёж не позднее') === 'сегодня + 3 дн.'
    && /Ошская/.test(v.panelText) && vAll.panelText === 'без фильтра' && v.answer.panelApplied.join() === 'region'
    && v.report.id === rep.id && v.report.title === rep.title && v.report.shelf === 'catalog' && v.report.shelfName === 'Общий отчёт каталога' && v.report.ownerName === U('u11').name
    && v.report.version === 1 && v.report.changed === null && v.filterText.join() === 'Дней просрочки > 0'
    && v.answer.state === 'ok' && v.answer.table.d === rep.dims[0] && v.answer.table.rows.length === tileNodes.length
    && v.answer.table.rows.every(r => r.cells[0] === tileNodes.find(n => n.v === r.v).value) && v.answer.total[0] === 0 && vAll.answer.total[0] > 0 && vChu.answer.total[0] === vAll.answer.total[0] && /Чуйская/.test(vChu.panelText)
    && !vod.answer.table && vod.answer.values.length === DB.reportById(T('lead-od').report).cols.length && vod.cols.length === vod.answer.values.length
    && vlk === null && DB.reportView('no-such-tile', u1, 'lead', {}) === null,
    `отчёт «${rep.title}» плитки Куратора: параметр «Куратор» — «${pv(v, 'Куратор')}», панель — «${v.panelText}», первый уровень ответа — разрез «${DB.DIMS[v.answer.table.d].name}» (${v.answer.table.rows.length} строк, как на плитке), панель сужает и не расширяет: в Ошской ${v.answer.total[0]}, в Чуйской ${vChu.answer.total[0]} из ${vAll.answer.total[0]}; без разрезов — итог (${vod.answer.values.length} колонок); у ссылочной плитки отчёта нет (ДБ-105, ДБ-102)`);

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
  asUser('u1'); const on = DB.signalToggle('lead-odsh', 'lead'), off = DB.signalToggle('lead-odsh', 'lead');
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
  const u1 = U('u1'), u2 = U('u2'), nar = U('c30'), BM = /Нельзя: отчёт «Просрочка по сроку неплатежа» не открыт вашему подразделению/;
  const forCur = () => Object.assign(DB.blankDraft('r-bucket'), { title:'Просрочка по срокам — кураторам', pick:{ cols:['loan.count'], level:1 }, format:'steps', forRoles:['cur'] });
  const text = ac => ac.checks.filter(c => /круг отчёта/.test(c.text));
  // круг сужен позже: плитка не прячется, а называет замок; другое подразделение видит числа; ключ кэша различает открытый и закрытый круг
  DB.seed(); asUser('c30');
  const nb0 = DB.cachedAsk(T('cur-bucket'), nar, 'cur', {}), lay0 = DB.composeLayout('c30', 'cur');
  DB.reportById('r-bucket').circle = { depts:['go'] };
  const nbKey = DB.cachedAsk(T('cur-bucket'), nar, 'cur', {});
  DB.standCircle(false); DB.standCircle(true);
  const nb1 = DB.cachedAsk(T('cur-bucket'), nar, 'cur', {}), lay1 = DB.composeLayout('c30', 'cur'), narrowed = DB.reportById('r-bucket').circle;
  const ch = DB.ask(T('cur-bucket'), u2, 'cur', {}), ld = DB.ask(T('lead-bucket'), u1, 'lead', {}), own = DB.ask(T('cur-loans'), nar, 'cur', {});
  const cat = DB.catalogFor(nar).find(x => x.t.id === 'cur-bucket'), catU2 = DB.catalogFor(u2).find(x => x.t.id === 'cur-bucket'), cs = DB.canSee(T('cur-bucket'), nar);
  const rv = DB.reportView('cur-bucket', nar, 'cur', {}), dr = DB.drill('cur-bucket', nar, 'cur', {}), rg = DB.registryList(T('cur-bucket'), nar, 'cur', {});
  DB.standCircle(false); const back = DB.ask(T('cur-bucket'), nar, 'cur', {});
  DB.USERS.push({ id:'c99', name:'Куратор без кредитов', roles:['cur'], dept:'rp-nar' });
  const none = DB.ask(T('cur-loans'), U('c99'), 'cur', {}), noneB = DB.ask(T('cur-bucket'), U('c99'), 'cur', {}); DB.USERS.pop();
  ok(145, nb0.state === 'ok' && nbKey.state === 'noaccess' && nb1.state === 'noaccess' && BM.test(nb1.msg) && nb1.value === undefined && !nb1.nodes
    && Object.keys(narrowed).join() === 'depts' && narrowed.depts.length === 11 && !narrowed.depts.includes('rp-nar') && narrowed.depts.includes('rp-chu')
    && lay0.includes('cur-bucket') && lay1.includes('cur-bucket') && lay1.join() === lay0.join()
    && ch.state === 'ok' && ch.visible > 0 && ld.state === 'ok' && own.state === 'ok'
    && cat && BM.test(cat.why) && catU2 && catU2.why === null && cs === cat.why
    && rv.noaccess && BM.test(rv.msg) && dr.refused && BM.test(dr.msg) && rg.today === 0 && BM.test(rg.msg)
    && back.state === 'ok' && none.state === 'zero' && none.value === 0 && none.visible > 0 && noneB.state === 'ok',
    `круг отчёта «Просрочка по сроку неплатежа» сужен без Нарынского РП: куратор Нарынского РП — «${nb1.msg}», плитка стоит в его раскладке и в каталоге называет ту же причину, отчёт, провал и реестр отказывают; Чуйское РП (${ch.visible} в охвате) и Руководство числа видят, свои кредиты куратору открыты; вернули круг — числа вернулись; куратор без кредитов — честный ноль, не ошибка (ДБ-104)`);

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
  const pn = DB.saveTile(Object.assign(DB.blankDraft('r-bucket'), { title:'моя ступень', pick:{ cols:['loan.count'], level:1 }, format:'steps', params:{ curator:'@me', date:'today' } }), 'personal');
  const acn = DB.autocheck(DB.blankDraft('r-bucket')), pool = DB.reportsFor(nar).some(x => x.r.id === 'r-bucket'); DB.standCircle(false);
  ok(147, p1.error && /^Нельзя: отчёт «Мои кредиты Агрокредит с просрочкой больше 30 дней» не открыт вашему подразделению — это личный отчёт Бекова А\. Т\.$/.test(p1.error)
    && nT === n0 && !lst && ac147.checks.some(c => !c.ok && /не открыт вам/.test(c.text)) && !ac147.ok
    && foreign.state === 'noaccess' && /это личный отчёт Бекова А\. Т\.\.?$/.test(foreign.msg) && !/\.\.$/.test(foreign.msg)
    && ac2own.checks.some(c => c.ok && /открыт вам/.test(c.text)) && p2.tile && p2.tile.state === 'personal' && p2.tile.owner === 'u2'
    && pn.error && BM.test(pn.error) && acn.checks.some(c => !c.ok && /не открыт вам/.test(c.text)) && !pool,
    `личная плитка — только на открытый вам отчёт: Руководству чужой личный отчёт Бековой не открыт — «${p1.error}», в списке отчётов его нет, автопроверка пишет «не открыт вам»; ей самой открыт; куратору Нарынского РП при суженном круге общий отчёт тоже закрыт (ДБ-104)`);

  // два замка: круг отчёта данных не открывает; сначала круг, потом права роли
  DB.seed(); DB.USERS.push({ id:'c97', name:'Имущество Нарын', roles:['ast'], dept:'rp-nar' }); const ast = U('c97');
  const dl = DB.ask(T('cur-bucket'), ast, 'ast', {}), dlCat = DB.catalogFor(ast).find(x => x.t.id === 'cur-bucket'), dl3 = DB.ask(T('cur-rs'), U('u3'), 'prob', {});
  DB.standCircle(true); const both = DB.ask(T('cur-bucket'), ast, 'ast', {}), bothCat = DB.catalogFor(ast).find(x => x.t.id === 'cur-bucket');
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
  const nums = r => r.nodes ? r.nodes.map(n => n.value).join() : String(r.value);
  const ownerOf = id => DB.reportById(id).owner;

  // правка фильтра отчёта: версия отчёта растёт, кэш обесценен сразу, обе плитки на отчёте (Руководство и Куратор) показывают новое число
  DB.seed(); asUser('u1');
  const lb0 = DB.cachedAsk(T('lead-bucket'), u1, 'lead', {}), cb0 = DB.cachedAsk(T('cur-bucket'), u2, 'cur', {});
  const ed = DB.standReport('filter'), rb = DB.reportById('r-bucket');
  const lb1 = DB.cachedAsk(T('lead-bucket'), u1, 'lead', {}), cb1 = DB.cachedAsk(T('cur-bucket'), u2, 'cur', {});
  const lbA = DB.answer(DB.questionOf(T('lead-bucket')), u1, 'lead', {}), cbA = DB.answer(DB.questionOf(T('cur-bucket')), u2, 'cur', {});
  const m1 = DB.reportChangedFor(T('lead-bucket'), 'u1'), m2 = DB.reportChangedFor(T('cur-bucket'), 'u2');
  const rv = DB.reportView('lead-bucket', u1, 'lead', {});
  const m1after = DB.reportChangedFor(T('lead-bucket'), 'u1'), m2after = DB.reportChangedFor(T('cur-bucket'), 'u2');
  const jr = DB.state.journal[0], noEdit = DB.reportEdit('r-none', { state:'archived' }, 'u11'), badEdit = DB.reportEdit('r-bucket', { colour:'red' }, 'u11');
  ok(149, ed.ok && rb.version === 2 && rb.filter[0].v === 30 && rb.changed.at === '11.10' && rb.changed.who === ownerOf('r-bucket') && rb.changed.what === 'фильтр'
    && ed.tiles.map(t => t.id).sort().join() === 'cur-bucket,lead-bucket'
    && nums(lb0) !== nums(lb1) && nums(cb0) !== nums(cb1) && nums(lb1) === nums(lbA) && nums(cb1) === nums(cbA) && lb1.nodes[0].value === 0
    && /^отчёт изменён 11\.10 \(Шамшиев\): фильтр$/.test(rv.report.changedText) && m1 && m1.what === 'фильтр' && m2 && m2.what === 'фильтр' && m1after === null && m2after && m2after.what === 'фильтр'
    && jr.action === 'правка отчёта' && jr.who === ownerOf('r-bucket') && /в\. 2 · фильтр · плиток на отчёте: 2/.test(jr.detail)
    && noEdit.error && badEdit.error && rb.version === 2,
    `правка фильтра отчёта «${rb.title}» (просрочка больше 30 дней) — версия ${rb.version}: «Руководство» и «Куратор» без перезапроса видят новое число (ступень «1–30 дней» ${lb0.nodes[0].value} → ${lb1.nodes[0].value}), кэш прежней версии не отвечает; отметка «${rv.report.changedText}» у Руководства снялась после открытия отчёта, у Куратора осталась; правка записана в журнал (ДБ-110, ДБ-113)`);

  // снята колонка отчёта: плитки с этой колонкой названы сломанными поимённо, соседи по отчёту отвечают; убран параметр, уровень строк
  DB.seed(); asUser('u1');
  const ec = DB.standReport('col'), P = 'В отчёте «Портфель кредитов» нет колонки «Сумма под риском (залог)».';
  const lr = DB.cachedAsk(T('lead-risk'), u1, 'lead', {}), cr = DB.cachedAsk(T('cur-risk'), u2, 'cur', {}), lod = DB.cachedAsk(T('lead-od'), u1, 'lead', {}), p181 = DB.cachedAsk(T('prob-181'), u3, 'prob', {});
  const brokenIds = ec.tiles.filter(t => DB.reportBroken(t)).map(t => t.id).sort().join();
  const last = DB.reportEdit('r-loans', { removeCol:'loan.count' }, 'u11'), lay = DB.composeLayout('u1', 'lead').includes('lead-risk');
  DB.arrangeHide('lead', 'lead-risk'); const layH = DB.composeLayout('u1', 'lead').includes('lead-risk');
  const ep = DB.reportEdit('r-loans', { removeParam:'curator' }, 'u11'), ll = DB.ask(T('lead-loans'), u1, 'lead', {}), cl = DB.ask(T('cur-loans'), u2, 'cur', {});
  const tp = DB.ask(Object.assign({}, T('lead-bucket'), { pick:{ level:2 } }), u1, 'lead', {}), pb = DB.ask(Object.assign({}, T('lead-bucket'), { pick:{ level:1 }, params:{ curator:'*', date:'today', npay:'7' } }), u1, 'lead', {});
  const ff = DB.ask(withParams(DB.newDraft('r-form'), { date:'today' }), u1, 'lead', {});
  ok(150, ec.ok && DB.reportById('r-portfolio').version === 2 && DB.reportById('r-portfolio').changed.what === 'колонки'
    && lr.state === 'broken' && lr.msg === P && cr.state === 'broken' && cr.msg === P && lod.state === 'ok' && lod.move && p181.state !== 'broken' && brokenIds === 'cur-risk,lead-risk'
    && last.error && /хотя бы одна/.test(last.error) && lay && !layH
    && ep.ok && ll.state === 'broken' && ll.msg === 'В отчёте «Кредиты» нет параметра «Куратор».' && cl.state === 'broken' && /нет параметра «Куратор»/.test(cl.msg)
    && tp.state === 'broken' && /нет уровня строк 2 — разрезов: 1/.test(tp.msg) && pb.state === 'broken' && /нет параметра «npay»/.test(pb.msg)
    && ff.state === 'broken' && /В отчёте «Форма: портфель на отчётную дату» нет параметра «Дата»/.test(ff.msg),
    `снята колонка «Сумма под риском (залог)» из отчёта «Портфель кредитов»: «${lr.msg}» — на плитке Руководства и Куратора; «Просрочено» и «Кредиты 181+ дн.» на том же отчёте отвечают; плитка остаётся в раскладке и скрывается кнопкой; убран параметр «Куратор» — «${ll.msg}»; уровня строк и параметра, которых отчёт не объявлял, плитка не ждёт (ДБ-110)`);

  // отчёт в архиве: плитки названы, новая плитка на нём не собирается; отчёт с плитками не удаляется, без плиток — удаляется; возврат — стенд и seed
  DB.seed(); asUser('u3');
  const before = DB.tilesOfReport('r-claims'), poolBefore = DB.reportsFor(u3).some(x => x.r.id === 'r-claims'), ea = DB.standReport('archive'), arch = DB.reportById('r-claims');
  const cl5 = before.map(t => DB.cachedAsk(t, u3, 'prob', {})), dl = DB.standReport('delete'), dl1 = DB.reportDelete('r-u2-agro');
  const pool = DB.reportsFor(u3).some(x => x.r.id === 'r-claims'), ax = DB.exportTile('prob-claims', 'pdf', 'prob'), logN = DB.state.exportLog.length;
  DB.R('r-tmp', { title:'Временный', obj:'loan', cols:['loan.count'], shelf:'personal', owner:'u1', circle:{ owner:'u1' } });
  const rows0 = DB.REPORTS.length, d2 = DB.reportDelete('r-tmp'), gone = !DB.reportById('r-tmp'), rows1 = DB.REPORTS.length;
  DB.R('r-tmp', { title:'Временный', obj:'loan', cols:['loan.count'], shelf:'personal', owner:'u1', circle:{ owner:'u1' } });
  DB.standReport('filter'); DB.reportView('lead-bucket', u1, 'lead', {});
  const rs = DB.standReport('reset'), rr = DB.reportById('r-claims'), rbk = DB.reportById('r-bucket');
  const back = before.map(t => DB.ask(t, u3, 'prob', {}).state), seenGone = !Object.keys(DB.state.seen).some(k => k.endsWith('|r-bucket')), tmpKept = !!DB.reportById('r-tmp');
  const stillThere = !!DB.reportById('r-claims');
  DB.seed();
  ok(151, before.length === 5 && ea.ok && arch.state === 'archived' && arch.changed.what === 'отправлен в архив' && arch.version === 2
    && cl5.every(r => r.state === 'broken' && r.msg === 'Отчёт «Требования» в архиве — плитка сломана.')
    && dl.refused && dl.msg === 'У отчёта 5 плиток — его можно только отправить в архив' && stillThere && dl1.refused && dl1.msg === 'У отчёта 1 плитка — его можно только отправить в архив'
    && poolBefore && !pool && ax.refused && logN === 0
    && d2.ok && gone && rows1 === rows0 - 1
    && rs.ok && rr.state === 'active' && rr.version === 1 && rr.changed === null && rbk.version === 1 && tmpKept && back.every(s => s !== 'broken') && seenGone
    && DB.reportById('r-claims').state === 'active' && !DB.reportById('r-tmp') && DB.state.exportLog.length === 0,
    `«Требования» ушли в архив: пять плиток пишут «${cl5[0].msg}», в списке отчётов для новой плитки его нет, выгрузка сломанной плитки отказывает; удалить — «${dl.msg}»; личный отчёт без плиток удаляется; кнопка «Вернуть отчёты как были» возвращает каталог, собранный на ходу отчёт остаётся, seed() стирает всё (ДБ-110)`);

  // вывод показателя из реестра ломает плитки, которые берут эту колонку, и называет отчёт; соседи по отчёту отвечают; пустой охват и отказ в провале не падают
  DB.seed(); asUser('u1');
  DB.standWithdraw('loan.risk', true);
  const wt = DB.tilesOfReport('r-portfolio'), wm = 'Показатель «Сумма под риском (залог)» выведен из реестра статистики 11.10 — отчёт «Портфель кредитов» сломан, плитка вместе с ним.';
  const wr = wt.map(t => ({ id:t.id, r:DB.cachedAsk(t, u1, 'lead', {}), why:DB.reportBroken(t) })), wBad = wr.filter(x => x.r.state === 'broken').map(x => x.id).sort().join();
  const wd = DB.drill('lead-risk', u1, 'lead', {}), wg = DB.registryList(T('lead-risk'), u1, 'lead', {}), wod = DB.cachedAsk(T('lead-od'), u1, 'lead', {}), wodA = DB.answer(DB.questionOf(T('lead-od')), u1, 'lead', {});
  const raw = DB.answer(DB.questionOf(T('lead-risk')), u1, 'lead', {}), other = DB.ask(T('lead-loans'), u1, 'lead', {});
  DB.standWithdraw('loan.risk', false);
  const wb = wt.map(t => DB.cachedAsk(t, u1, 'lead', {}).state);
  const nar = U('c30'), dTasks = DB.drill('tasks', nar, 'cur', {});
  DB.USERS.push({ id:'c96', name:'Куратор без кредитов', roles:['cur'], dept:'rp-nar' }); const dNone = DB.drill('cur-od', U('c96'), 'cur', {}), dNoneB = DB.drill('cur-bucket', U('c96'), 'cur', {}, { d:'bucket', v:'1–30' }); DB.USERS.pop();
  ok(152, wt.length === 11 && wBad === 'cur-risk,lead-risk' && wr.filter(x => x.r.state === 'broken').every(x => x.r.msg === wm && x.why === wm)
    && wd.refused && wd.msg === wm && wg.msg === wm && wod.state === 'ok' && wod.move && JSON.stringify(wod.move) === JSON.stringify(wodA.move) && wr.find(x => x.id === 'lead-od').why === null
    && raw.state === 'broken' && /отчёт с этим показателем сломан/.test(raw.msg) && other.state === 'ok' && wb.every(s => s !== 'broken')
    && dTasks.number === null && dTasks.matches === false && dNone.number === 0 && dNone.matches && dNoneB.number === 0 && dNoneB.matches,
    `показатель «Сумма под риском (залог)» выведен из реестра: плитки, которые берут эту колонку (${wBad}), пишут «${wm}»; провал и реестр читают ту же причину; «Просрочено» на том же отчёте отвечает; вернули — отвечают все; провал по пустому охвату (ссылочная плитка «Мои задания» у куратора без заданий, плитки у куратора без кредитов) не падает: у пустого охвата числа узла нет, у куратора без кредитов это ноль, и список ему равен (ДБ-112)`);

  // выгрузка плитки по правилам отчётности: штамп с отчётом, версией и значениями параметров словами, строка журнала выгрузок
  DB.seed(); asUser('u2');
  const x1 = DB.exportTile('cur-od', 'pdf', 'cur'); asUser('u1');
  const x2 = DB.exportTile('cat-plan', 'xlsx', 'lead'); DB.standReport('filter'); DB.cachedAsk(T('lead-bucket'), u1, 'lead', {});
  const x4 = DB.exportTile('lead-bucket', 'xlsx', 'lead'), L = DB.state.exportLog;
  const has = (ex, re) => ex.stamp.some(s => re.test(s));
  ok(153, has(x1, /^Отчёт: «Портфель кредитов», версия 1, владелец Шамшиев/) && has(x1, /^Значения параметров: Куратор — я; Дата — сегодня$/) && has(x1, /^Паспорт: на 14:15/)
    && has(x1, /НЕ ЯВЛЯЕТСЯ ОФИЦИАЛЬНЫМ ДОКУМЕНТОМ/) && has(x1, /^Выгрузил: Бекова/) && x1.stamp[0] === 'Плитка: Просрочено' && x1.stamp.length === 7
    && has(x2, /^Значения параметров: Куратор — все; Период — прошлый месяц$/) && has(x4, /версия 2/)
    && L.length === 3 && L[2].tile === 'cur-od' && L[2].report === 'r-portfolio' && L[2].version === 1 && L[2].who === 'u2' && L[2].kind === 'pdf' && L[2].params.curator === '@me'
    && L[0].report === 'r-bucket' && L[0].version === 2 && L[0].kind === 'xlsx' && DB.state.journal[0].action === 'выгрузил Excel',
    `выгрузка плитки «Просрочено» куратора: «${x1.stamp[1]}»; «${x1.stamp[2]}»; «не является официальным документом»; в журнале выгрузок отчётности ${L.length} строки — плитка, отчёт, версия, значения параметров, кто и когда; после правки отчёта штамп несёт версию 2 (ДБ-113)`);
  DB.seed();
})();

/* ---------- O (продолжение). Сторожа после ревью ---------- */
(() => {
  const u1 = U('u1'), u2 = U('u2'), fails = a => (a.checks || []).filter(c => !c.ok).map(c => c.text);
  // «похожий уже есть»: каждое «я» черновика — параметр отчёта, дата — того же рода (зашитая — та же); «взять его» несёт «я», дату и колонки
  DB.seed(); asUser('u2');
  DB.newReportDraft(); DB.rInd('loan.balance', true); DB.rInd('loan.count', false); DB.rCondDel('filter', 0); DB.rFilter('curator', '@me'); DB.rSet('date', 'closedDay');
  const rd = DB.rdraft, want = DB.answer(Object.assign({}, rd, { id:'q' }), u2, 'cur', {}), sim = DB.similarReport(rd, u2);
  const sToday = DB.similarReport(Object.assign({}, rd, { filter:[], date:'today' }), u2), sPme = DB.similarReport(Object.assign({}, rd, { filter:[], date:'prevMonthEnd' }), u2);
  const tk = DB.rTake(sim.r.id), got = DB.ask(tk, u2, 'cur', {});
  DB.newReportDraft(); DB.rSet('obj', 'claim'); const sc = DB.similarReport(DB.rdraft, U('u3')); DB.rFilter('dept', '@myDept'); const sd = DB.similarReport(DB.rdraft, U('u3'));
  ok(154, sim.r.id === 'r-portfolio' && sToday.r.id === 'r-portfolio' && sPme.r.id === 'r-form' && sc.r.id === 'r-claims' && sd === null
    && DB.draft === tk && tk.report === 'r-portfolio' && tk.params.curator === '@me' && tk.params.date === 'closedDay' && tk.pick.cols.join() === 'loan.balance'
    && DB.autocheck(tk).ok && got.value === want.value && got.passport === want.passport && got.value > 0,
    `«похожий»: черновик «куратор = я, вчера» находит «${sim.r.title}», а не официальную форму без куратора и с зашитой датой; форма — только черновику на ту же дату; «моё подразделение» у требований — параметра нет, похожего нет; «взять его» — плитка с «я», датой и колонками черновика, число ${got.value} = ответу черновика (ДБ-103, ДБ-101, ДБ-107)`);
  // «% от итога группы»: по разрезу строк — отказ; по разрезу глубже строк — доля внутри узла, провал сходится; таблица и разрез с историей — отказ
  DB.seed(); asUser('u1');
  const on = (rid, o) => DB.autocheck(Object.assign(DB.blankDraft(rid), { title:'x' }, o));
  const inRows = Object.assign(DB.blankDraft('r-odmap'), { id:'pv', title:'x', pick:{ cols:['loan.overdue'], level:1, pct:{ dim:'region', cells:['Ошская'] } }, format:'slice' });
  const deeper = Object.assign({}, inRows, { pick:{ cols:['loan.overdue'], level:1, pct:{ dim:'bucket', cells:['31–90'] } } });
  const aR = DB.autocheck(inRows), aD = DB.autocheck(deeper), bR = DB.ask(inRows, u1, 'lead', {}), dD = DB.drill(deeper, u1, 'lead', {}, { d:'region', v:'Ошская' });
  const aT = on('r-programs', { pick:{ cols:['loan.overdue', 'loan.balance'], level:1, share:['loan.overdue', 'loan.balance'] }, format:'table' });
  DB.R('r-lact', { title:'Кредиты по состоянию договора', obj:'loan', cols:['loan.count'], dims:['lact'], params:{ date:{ name:'Дата' } } });
  const aH = on('r-lact', { pick:{ cols:['loan.count'], level:0, pct:{ dim:'lact', cells:['действующий'] } }, format:'number' });
  const PR = /«% от итога группы» считается по разрезу, которого нет в строках — выберите итог или другой разрез/;
  ok(155, !aR.ok && fails(aR).some(t => PR.test(t)) && DB.formatsFor(inRows).every(x => !x.ok && PR.test(x.why)) && bR.state === 'broken' && PR.test(bR.msg)
    && aD.ok && aD.preview.state === 'ok' && !dD.refused && dD.matches && dD.number > 0
    && !aT.ok && fails(aT).some(t => /таблица показывает колонки как есть — доля в ней не считается/.test(t))
    && !aH.ok && fails(aH).some(t => /у разреза «Состояние договора» значение меняется со временем — «% от итога группы» по нему не считается/.test(t)),
    `«% от итога группы» по разрезу строк — «${bR.msg}»; по сроку внутри области — доля узла, провал «Ошская» сходится: ${dD.sum} = ${dD.number}; таблица с долей и доля по разрезу с историей — отказ с причиной (ДБ-111, ДБ-109)`);
  // правка плитки — той же автопроверкой; пустой выбор колонок — колонки отчёта; правка отчёта отнимает формат — плитка сломана с причиной; база сдвига — первая допустимая
  DB.seed(); asUser('u11');
  const qx = DB.questionOf(Object.assign({}, T('lead-odsh'), { pick:{ cols:[] } })), e0 = DB.editTile('lead-loans', { pick:{ cols:[] } }), a0 = DB.ask(T('lead-loans'), u1, 'lead', {});
  const eH = DB.editTile('lead-heat', { pick:{ level:1 } }), eD = DB.editTile('lead-risk', { params:{ curator:'*', date:'x' } }), eP = DB.editTile('lead-risk', { params:{ curator:'*', foo:'1' } });
  const heatOk = DB.ask(T('lead-heat'), u1, 'lead', {}).state === 'ok' && DB.ask(T('lead-risk'), u1, 'lead', {}).state === 'ok' && T('lead-heat').version === 1 && T('lead-risk').version === 1;
  asUser('u1'); DB.reportEdit('r-portfolio', { removeParam:'date' });
  const gone = ['lead-odsh', 'lead-bal', 'lead-odser'].map(id => DB.ask(T(id), u1, 'lead', {})), risk = DB.ask(T('lead-risk'), u1, 'lead', {}); DB.standReport('reset');
  DB.newReportDraft(); DB.rInd('loan.balance', true); DB.rInd('loan.count', false); DB.rSet('date', 'prevMonthEnd'); DB.rSet('format', 'shift'); DB.rTitle('Остаток к концу прошлого месяца');
  const rcOk = DB.rcheck(DB.rdraft).ok, sp = DB.rSaveAndPlace(), sa = sp.tile && DB.ask(sp.tile, u1, 'lead', {});
  ok(156, qx.inds.length === DB.reportById('r-portfolio').cols.length && e0.tile && !('cols' in T('lead-loans').pick) && a0.state === 'ok'
    && eH.error && fails(eH).some(t => /Тепловая карта.*нужны два разреза/.test(t)) && eD.error && fails(eD).some(t => /такой даты нет: «x»/.test(t)) && /нет параметра «foo»/.test(eP.error) && heatOk
    && gone.every(r => r.state === 'broken' && /плитке недоступен формат «(Число \+ сдвиг|Движение|Ряд)»: отчёт не объявил дату/.test(r.msg)) && risk.state === 'ok'
    && rcOk && !sp.error && sp.tile.shift === 'yearStart' && sa.state === 'ok' && sa.shift && sa.shift.label === 'к началу года',
    `правка «тепловая карта на одном разрезе», «дата x», чужой параметр — отказ с причиной, плитка не тронута; без колонок — все колонки отчёта; отчёт без даты — «${gone[0].msg}»; «Сохранить и поставить» с датой «конец прошлого месяца» и сдвигом ставит базу «к началу года» (ДБ-113, ДБ-110, ДБ-107, ДБ-109)`);
  // сигналы: снять можно у сломанной плитки и по одному; ночная проверка снимает сигналы изменённой и снятой плитки и пишет об этом строку
  DB.seed(); asUser('u1');
  const s0 = DB.signalToggle('lead-odsh', 'lead'); DB.reportEdit('r-portfolio', { removeParam:'date' }); const brk = DB.reportBroken(T('lead-odsh')), off = DB.signalToggle('lead-odsh', 'lead'), n0 = DB.state.signals.length;
  DB.standReport('reset'); asUser('u2'); const sC = DB.signalToggle('cur-odsh', 'cur'); asUser('u1'); const sL = DB.signalToggle('lead-odsh', 'lead');
  const rm = DB.signalRemove(sL[0].id), rmOther = DB.signalRemove(sC[0].id), n1 = DB.state.signals.length;
  asUser('u11'); DB.editTile('lead-odsh', { title:'Доля просрочки портфеля' }); asUser('u1'); const nc = DB.nightCheck(), n2 = DB.state.signals.length;
  asUser('u11'); DB.withdrawTile('cur-odsh'); asUser('u1'); const nc2 = DB.nightCheck();
  ok(157, s0[0].version === 1 && brk && off === false && n0 === 0 && rm && !rmOther && n1 === 3 && nc.length === 0 && nc.dropped.length === 1 && n2 === 2
    && nc.dropped[0].to === 'u1' && nc.dropped[0].text === 'Сигнал снят: плитка «Доля просрочки портфеля» изменена' && nc2.dropped.length === 1 && nc2.dropped[0].to === 'u2'
    && /плитка «Доля просрочки» снята$/.test(nc2.dropped[0].text) && DB.state.signals.length === 0 && DB.state.notifs.length === 2 && /DB\.signalOff\('\$\{s\.id\}'\)">Снять</.test(src),
    `сигнал помнит версию плитки; у сломанной плитки 🔔 снимает сигналы; «Снять» в «На что я подписан» — по одному и только свои; ночная проверка: «${nc.dropped[0] && nc.dropped[0].text}», «${nc2.dropped[0] && nc2.dropped[0].text}» (ДБ-106, ДБ-113)`);
  // seed() возвращает плитки и стенд целиком; в каталог — не плитку на личном отчёте; выгрузка движка помнит роль, окно выгрузки — отдельный ключ
  DB.seed(); asUser('u11');
  DB.editTile('lead-loans', { title:'Кредитов в портфеле', params:{ curator:'@me', date:'closedDay' } }); T('p-u2-agro').version = 7; DB.STAND.N = 5; DB.STAND.closedThrough = 0;
  const pub = DB.saveTile(Object.assign(DB.blankDraft('r-loans'), { title:'Новая' }), 'publish').tile; DB.seed();
  const clean = T('lead-loans').title === 'Кредитов' && T('lead-loans').version === 1 && T('lead-loans').params.curator === '*' && !('date' in T('lead-loans').params)
    && T('p-u2-agro').version === 1 && DB.STAND.N === 150 && DB.STAND.closedThrough === -2 && !DB.tileById(pub.id);
  asUser('u2'); DB.propose('p-u2-agro'); asUser('u11'); const mv = DB.moveToCatalog('p-u2-agro');
  const xs = DB.exportTile('lead-loans', 'pdf', 'sys'), xa = DB.exportTile('lead-loans', 'pdf', 'adm');
  ok(158, clean && mv.error === 'Не перенесено: отчёт «Мои кредиты Агрокредит с просрочкой больше 30 дней» личный — сначала откройте его кругу в отчётности'
    && T('p-u2-agro').state === 'personal' && T('p-u2-agro').owner === 'u2' && DB.state.proposals.length === 1
    && xs.refused && /не открыт вашей роли/.test(xs.msg) && !xa.refused && xa.stamp.length > 0 && typeof DB.openExport === 'function' && DB.exportTile.length === 3
    && /DB\.openExport\('\$\{t\.id\}','pdf'\)/.test(src) && !/DB\.exportTile\(/.test(src),
    `seed() возвращает подпись, значения параметров и версии плиток, снимает созданные на ходу и возвращает стенд; плитка на личном отчёте в каталог не переносится — «${mv.error}»; выгрузка движка спрашивает от роли (у «Системного администратора» — «${xs.msg}»), окно выгрузки — свой ключ (ДБ-113, ДБ-31, ДБ-104, ДБ-36)`);
  DB.seed();
})();

/* ---------- отчёт ---------- */
const fail = results.filter(r => !r.pass);
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'} #${r.n} ${r.note}`);
console.log(`\n${results.length - fail.length}/${results.length} PASS`);
process.exit(fail.length ? 1 : 0);
