// Headless смоук для mockups/dashboard/dashboard.html — волна 1 макета модуля «Дашборд» (11.10.2026).
// Zero-dep: вытаскивает <script> из HTML и исполняет движок window.DB в node:vm (без DOM — render() и
// toast() становятся no-op). Проверяется не «код есть», а поведение по решениям канона
// mockups/dashboard/ASUBK-dashbord-logika.md (ДБ-1…ДБ-59, ИДБ-1…ИДБ-14):
//   A  рамка и главная: вкладки — системные роли, роль без раскладки — минимальная (ДБ-8, ДБ-38, ДБ-50);
//   B  плитка — вопрос к статистике, чисел не хранит; «ждёт меня» — тоже от статистики (ДБ-1, ДБ-10, ДБ-11);
//   C  время: «сегодня» по умолчанию, только календарные периоды, кэш ≤ 1 мин у «сегодня» (ДБ-12…ДБ-16, ДБ-52);
//   D  показ: 8 форматов, один объект ≤ 4 показателей, доля, сдвиг, план-факт, светофор, движение (ДБ-17…ДБ-24);
//   E  клик: «кто в этом числе» — полный список или отказ, строки сходятся с числом (ДБ-25, ДБ-26, ДБ-54);
//   F  права у данных, панель фильтров и относительные параметры сужают и не расширяют (ДБ-3, ДБ-27, ДБ-28);
//   G  сборка: личные плитки, администратор, автопроверка, «предложить в каталог», версии, снятие (ДБ-4, ДБ-29…ДБ-31, ДБ-55);
//   H  раскладка: одна на роль, перекладка, свои экраны ≤ 5, секции (ДБ-5, ДБ-32, ДБ-34);
//   I  состояния: ошибка, сломана, отказ, устарело, пустой охват, ноль, волны (ДБ-35, ДБ-53);
//   J  наружу и сигналы: штамп выгрузки, подписка без поручений, журнал и счётчики (ДБ-36, ДБ-37, ДБ-51, ДБ-57);
//   K  сторож чистоты: в макете нет номеров решений и ADR, «сегодня» заморожено;
//   L  состав объектов 13.10.2026: заявка на реструктуризацию, дело взыскания, эпизод просрочки, объект имущества
//      — 17 объектов, плитки ролей, черновики эпизодов до готовности ядра, роль «Специалист по имуществу» (ДБ-60…ДБ-64);
//      плитки заёмщика: «с просрочкой» и «платёж в ближайшие 3 дня», «я» — ведущий куратор (ДБ-65);
//      разрезы заёмщика — выборка реестра статистики, свёрнутые по портфелю, «Ступени» доступны (ДБ-66).
//   M  волна 3, заёмщик: шкала категорий классификатора (ДБ-Д22); «действующие» по умолчанию у заёмщика и кредита
//      (ДБ-68, ДБ-69); доля с фильтром числителя (ДБ-70, ДБ-80); фильтр по значению в конструкторе (ДБ-Д23); движение
//      клиентов — черновик до статистики (ДБ-71); «Область» по регистрации (ДБ-72, ДБ-73); плитки клиентов в раскладках,
//      видимость через требования, подпись куратора (ДБ-74…ДБ-76); деньги, форматы, сдвиг, реестр (ДБ-67, ДБ-77…ДБ-79);
//      13 разрезов + 4 заявленных, ступени долга, договоров, истории, проверки карточки (ДБ-81…ДБ-84, ДБ-86, ДБ-88).
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
  ok(4, lead.filter(k => !k.startsWith('s:')).length === 23 && lead.filter(k => k.startsWith('s:')).length === 4,
    `стартовая раскладка «Руководства» — 23 отвечающие плитки в четырёх секциях, эпизоды и движение клиентов ждут соседей (ДБ-40, ДБ-60…ДБ-65, ДБ-74): ${lead.length} элементов`);
})();

/* ---------- B. Плитка — вопрос к статистике ---------- */
(() => {
  DB.seed();
  const numericKeys = ['value', 'values', 'number', 'cached', 'result'];
  ok(5, DB.TILES.every(t => numericKeys.every(k => !(k in t))),
    'ни одна плитка не хранит чисел — только вопрос (ИДБ-2)');
  ok(6, DB.TILES.every(t => t.inds.every(i => DB.IND[i] && DB.OBJECTS[DB.IND[i].obj]) && !('source' in t) && !('url' in t)),
    'каждый показатель плитки — запись реестра статистики; поля «источник: API / файл» у плитки нет (ДБ-10)');
  ok(7, DB.TILES.every(t => new Set(t.inds.map(i => DB.IND[i].obj)).size === 1 && t.inds.length <= 4),
    'каждая плитка — один объект и не больше четырёх показателей (ДБ-18, ИДБ-8)');
  const r = DB.ask(T('tasks'), U('u2'), 'cur', {});
  ok(8, r.value === DB.DATA.task.filter(x => x.assignee === 'u2').length && T('tasks').kind === 'link' && T('tasks').queue,
    `«Мои задания» — число от статистики (объект «Задание»), клик — очередь модуля (ДБ-11, ДБ-25): ${r.value}`);
  ok(9, DB.TILES.filter(t => t.kind !== 'link').every(t => !t.queue) && DB.TILES.filter(t => t.kind === 'link').every(t => t.queue && t.queue.module),
    'у ссылочной плитки есть очередь модуля, у обзорной — нет (ДБ-7, ДБ-25)');
})();

/* ---------- C. Время ---------- */
(() => {
  DB.seed();
  ok(10, DB.blankDraft().date === 'today', 'режим даты по умолчанию — «сегодня» (ДБ-12)');
  const r = DB.ask(T('lead-loans'), U('u1'), 'lead', {});
  ok(11, /на 14:15 · день не закрыт/.test(r.passport), `паспорт «сегодня»: ${r.passport}`);
  const keys = Object.keys(DB.PERIODS);
  ok(12, keys.join() === 'today,curMonth,prevMonth,curQuarter,prevQuarter,ytd,prevYear' && !keys.some(k => /\d+d|days|range|fixed/.test(k)),
    `периоды только календарные плюс «сегодня»; скользящих окон и фиксированных дат нет (ДБ-15): ${keys.join(', ')}`);
  const cm = DB.ask(Object.assign({}, T('acc-prev'), { period:'curMonth', format:'number' }), U('u4'), 'acc', {});
  ok(13, /идёт 11-й день/.test(cm.passport), `текущий месяц не подменяется: подпись называет день (ДБ-16): ${cm.passport}`);
  DB.cachedAsk(T('lead-loans'), U('u1'), 'lead', {}); const h0 = DB.state.cacheHits;
  DB.cachedAsk(T('lead-loans'), U('u1'), 'lead', {}); const h1 = DB.state.cacheHits;
  DB.tick(2); const miss0 = DB.state.cacheMiss; DB.cachedAsk(T('lead-loans'), U('u1'), 'lead', {});
  ok(14, h1 === h0 + 1 && DB.state.cacheMiss === miss0 + 1,
    'ответ «сегодня» берётся из кэша не дольше минуты, потом статистика спрашивается заново (ДБ-52, ДБ-13)');
  const closed = Object.assign({}, T('lead-loans'), { id:'closed-copy', date:'closedDay' });
  DB.cachedAsk(closed, U('u1'), 'lead', {}); DB.tick(5); const hc = DB.state.cacheHits; DB.cachedAsk(closed, U('u1'), 'lead', {});
  ok(15, DB.state.cacheHits === hc + 1, 'ответ на закрытый день живёт в кэше до следующего прогона (ДБ-52)');
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
  const d = Object.assign(DB.blankDraft(), { dims:['region'], format:'slice' });
  const steps = DB.formatsFor(d).find(x => x.f === 'steps');
  ok(19, !steps.ok && /нет объявленного порядка/.test(steps.why), `ступени гаснут у разреза без порядка и называют причину: «${steps.why}»`);
  const two = DB.autocheck(Object.assign(DB.blankDraft(), { title:'x', inds:['loan.count','borrower.count'] }));
  ok(20, !two.ok && two.checks.some(c => !c.ok && /один объект/.test(c.text)), 'показатели двух объектов в одной плитке не проходят автопроверку (ДБ-18)');
  const share = DB.ask(T('lead-odsh'), U('u1'), 'lead', {});
  ok(21, share.num > 0 && share.den > 0 && Math.abs(share.value - share.num / share.den * 100) < 1e-9 && share.unit === 'pct',
    `доля — показ двух показателей одного объекта, оба числа есть (ДБ-19): ${share.value.toFixed(2)} % = ${share.num} / ${share.den}`);
  const part = DB.ask(Object.assign({}, T('acc-prev'), { period:'curMonth' }), U('u4'), 'acc', {});
  ok(22, part.shift && part.shift.none && /неполный период/.test(part.shift.none) && !DB.shiftsFor(Object.assign(DB.blankDraft(), { inds:['receipt.amount'], period:'curMonth' }))[0].ok,
    'сдвиг у неполного периода погашен с причиной — неполный с полным не сравнивается (ДБ-21, ИДБ-11)');
  ok(23, DB.shiftsFor(DB.blankDraft()).length === 3, 'у остатка ровно три базы сдвига: конец прошлого месяца, начало года, год назад (ДБ-21)');
  ok(24, T('cur-plan1').share.join() === 'loan.paidPlanned,loan.plan' && DB.IND['loan.expected'] && T('lead-paid').share[1] === 'loan.expected'
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
  const d = Object.assign(DB.blankDraft(), { title:'Мои кредиты Промышленность', filter:[{ f:'curator', op:'eq', v:'@me' }, { f:'program', op:'eq', v:'prom' }] });
  const pub = DB.saveTile(d, 'publish'); const per = DB.saveTile(d, 'personal');
  ok(40, pub.error && /администратор/.test(pub.error) && per.tile && per.tile.state === 'personal' && per.tile.owner === 'u2',
    'любой собирает личную плитку; публикует в каталог только администратор дашборда (ДБ-4, ДБ-29)');
  asUser('u11');
  const ad = DB.saveTile(Object.assign(DB.blankDraft(), { title:'Кредиты по областям', dims:['region'], format:'slice' }), 'publish');
  ok(41, ad.tile && ad.tile.state === 'published', 'администратор публикует сразу после автопроверки — второго ключа нет (ДБ-30)');
  const bad = DB.saveTile(Object.assign(DB.blankDraft(), { title:'x', inds:['spell.in'], period:'prevMonth' }), 'publish');
  ok(42, bad.error && bad.checks.some(c => !c.ok && /предпросмотр/.test(c.text)), 'плитка, вопрос которой не отвечает, не публикуется (ИДБ-14)');
  asUser('u2'); DB.propose(per.tile.id); asUser('u11');
  ok(43, DB.state.proposals.length === 1 && DB.moveToCatalog(per.tile.id) && T(per.tile.id).state === 'published' && T(per.tile.id).owner === 'catalog',
    'личная плитка уходит в каталог только через «Предложить» и перенос администратором (ДБ-31)');
  const e1 = DB.editTile('lead-loans', { inds:['loan.balance'] }); const e2 = DB.editTile('lead-loans', { title:'Кредитов в портфеле' });
  ok(44, e1.error && /новая плитка/.test(e1.error) && e2.tile.version === 2, 'правка подписи — новая версия у всех; смена показателя — новая плитка (ДБ-55)');
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
  DB.STAND.nightRunFailed = true; const st1 = DB.ask(Object.assign({}, T('lead-loans'), { date:'closedDay' }), U('u1'), 'lead', {}); const st2 = DB.ask(T('lead-loans'), U('u1'), 'lead', {});
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
  DB.subscribe('lead-odsh', 'lead'); const n0 = DB.recheckLights().length;
  DB.STAND.overdueUp = true; const n1 = DB.recheckLights(); const n2 = DB.recheckLights().length; DB.STAND.overdueUp = false;
  ok(63, n0 === 0 && n1.length === 1 && n2 === 0 && /→ red/.test(n1[0].text), 'подписка: уведомление только при смене цвета, без повторов (ДБ-37, ДБ-57)');
  ok(64, DB.DATA.task.length === tasksBefore, 'подписка ничего не поручает — заданий не прибавилось (ИДБ-13)');
  DB.cachedAsk(T('lead-loans'), U('u1'), 'lead', {});
  ok(65, Object.keys(DB.state.usage).length === 0 || Object.keys(DB.state.usage).every(k => DB.tileById(k)), 'просмотры считаются по плитке, без имени смотрящего (ДБ-51)');
})();

/* ---------- K. Сторож чистоты ---------- */
(() => {
  const body = src.replace(/<!--[\s\S]*?-->/g, '');
  ok(66, !/\b(ДБ-\d|ИДБ-\d|ADR-\d|ИС-\d)/.test(body), 'в макете нет номеров решений и ADR — их место канон');
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
  ok(73, T('lead-recov').share.every(i => DB.IND[i].obj === 'case') && rv.state === 'ok' && Math.abs(rv.value - rv.num / rv.den * 100) < 1e-9 && rv.unit === 'pct',
    `возвратность по делам — доля двух показателей одного объекта «Дело»: ${rv.value.toFixed(1)} % = ${rv.num} / ${rv.den} (ДБ-61, ИДБ-8)`);
  const mixed = DB.autocheck(Object.assign(DB.blankDraft(), { title:'x', inds:['claim.recovered','case.base'], share:['claim.recovered','case.base'] }));
  const loansInCases = DB.DATA.case.flatMap(c => c.loans);
  ok(74, !mixed.ok && mixed.checks.some(c => !c.ok && /один объект/.test(c.text)) && new Set(loansInCases).size === loansInCases.length,
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
  ok(80, ai.tl === 'yellow' && ai.value > 0 && T('ast-idle').filter.some(c => c.f === 'daysOnBook' && c.v === 182) && T('ast-unsold').filter.some(c => c.op === 'ge' && c.v === 3)
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
  ok(84, leadOk && T('lead-borod').share.every(i => DB.IND[i].obj === 'borrower') && bo.state === 'ok' && bo.den === Bs.length && Bs.length === 903
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
  const bt = (dims, format) => Object.assign(DB.blankDraft(), { obj:'borrower', inds:['borrower.count'], dims, format, filter:[{ f:'pstate', op:'eq', v:'действующий' }] });
  const steps = BD.filter(d => DB.DIMS[d].ordered).map(d => DB.ask(bt([d], 'steps'), U('u1'), 'lead', {}));
  ok(87, BD.every(d => DB.OBJ_DIMS.borrower.includes(d)) && DB.OBJ_DIMS.borrower.length === 17
    && BD.filter(d => DB.DIMS[d].ordered).every(d => DB.formatsFor(bt([d], 'steps')).find(x => x.f === 'steps').ok)
    && steps.every(r => r.state === 'ok') && steps[0].nodes.reduce((a, n) => a + n.value, 0) === Bs.length,
    `у заёмщика 17 разрезов (13 из реестра статистики и 4 заявленных); «Ступени» больше не погашены — худшая категория, худшая просрочка, подгруппа: ${steps.map(r => r.nodes.length).join(' · ')} ступеней (ДБ-66, ДБ-Д21)`);
  const rank = c => DB.DIMS.category.values.indexOf(c);
  const worstOk = Bs.every(b => { const ls = L.filter(l => l.borrower === b.id);
    return b.worst === ls.reduce((a, l) => rank(l.category) > rank(a) ? l.category : a, ls[0].category) && b.worstDays === Math.max(...ls.map(l => l.overdueDays)); });
  const late = steps[1].nodes.reduce((a, n) => a + n.value, 0);
  ok(88, worstOk && late === new Set(L.filter(l => l.overdueDays > 0).map(l => l.borrower)).size && late === bo.num,
    `худшая категория и худшая просрочка свёрнуты по портфелю: клиент с тремя кредитами — одна строка по худшему; на ступенях просрочки ${late} клиентов — столько же, сколько «Заёмщиков с просрочкой» (ДБ-66)`);
  const heat = DB.ask(bt(['ptype', 'bindustry'], 'heat'), U('u1'), 'lead', {});
  const cells = heat.heat.cells.flat().reduce((a, v) => a + v, 0);
  const cur = DB.ask(bt(['ptype'], 'slice'), U('u2'), 'cur', {});
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
  const draft = o => Object.assign(DB.blankDraft(), o);
  // ДБ-Д22: шкала категорий — классификатор владельца
  const cat = DB.ask(T('lead-cat'), U('u1'), 'lead', {});
  ok(90, DB.DIMS.category.values.join('|') === 'Низкий кредитный риск|Средний кредитный риск|Высокий кредитный риск|Потери|Убыток'
    && DB.DIMS.bworst.values === DB.DIMS.category.values && cat.nodes.map(n => n.short).join(' · ') === 'низкий · средний · высокий · потери · убыток'
    && cat.total.v === L.length,
    `категории — шкала классификатора: ${cat.nodes.map(n => n.short + ' ' + n.value).join(' · ')} (ДБ-Д22)`);
  // ДБ-68, ДБ-69: «действующие» по умолчанию, печатается, снимается
  const lb = DB.ask(T('lead-borr'), U('u1'), 'lead', {}), ll = DB.ask(T('lead-loans'), U('u1'), 'lead', {});
  const bAll = DB.ask(draft({ obj:'borrower', inds:['borrower.count'], filter:[] }), U('u1'), 'lead', {});
  const bPaid = DB.ask(draft({ obj:'borrower', inds:['borrower.count'], filter:[{ f:'pstate', op:'eq', v:'весь портфель погашен' }] }), U('u1'), 'lead', {});
  DB.dSet('obj', 'borrower'); const bd = DB.draft; const hintB = DB.builderHints(draft({ obj:'borrower', inds:['borrower.count'], filter:[] }));
  DB.newDraft();
  ok(91, lb.value === 903 && bAll.value === allB.length && allB.length > 903 && bPaid.value > 0 && bAll.value === lb.value + bPaid.value + allB.filter(b => DB.pstateAt(b, 0) === 'без договоров').length
    && ll.value === L.length && allL.length > L.length && DB.qualOf(T('lead-borr')) === 'действующие' && DB.qualOf(T('lead-loans')) === 'действующие'
    && bd.filter.length === 1 && bd.filter[0].f === 'pstate' && DB.blankDraft().filter[0].f === 'lact' && hintB.some(h => /складывает действующих и погасивших/.test(h)),
    `«Заёмщиков» ${lb.value} — действующие из ${allB.length} строк (погасивших ${bPaid.value}); «Кредитов» ${ll.value} из ${allL.length}; конструктор сам ставит фильтр, без него — подсказка (ДБ-68, ДБ-69)`);
  // ДБ-70, ДБ-80: фильтр числителя — один показатель, клик — строки с обоими фильтрами
  const bo = DB.ask(T('lead-borod'), U('u1'), 'lead', {}); const who = DB.statRows(T('lead-borod'), U('u1'), 'lead', {});
  ok(92, T('lead-borod').inds.length === 1 && T('lead-borod').share[0] === T('lead-borod').share[1] && T('lead-borod').numFilter.length === 1
    && !Object.values(DB.IND).some(i => i.obj === 'borrower' && i.where) && bo.num === Bs.filter(b => b.overCredits > 0).length && bo.den === 903
    && who.refused && who.count === bo.num,
    `«Заёмщиков с просрочкой» ${bo.num} из ${bo.den} — Число объектов · фильтр «действующие» · фильтр числителя «договоров с просрочкой > 0»; своих счётов у заёмщика нет; клик — ${who.count} строк числителя (ДБ-70, ДБ-80)`);
  // ДБ-Д23: фильтр по значению в конструкторе — разрез и число строки
  DB.dSet('obj', 'borrower'); DB.dCond('filter', 'f', 'bodays'); DB.dCond('filter', 'op', 'in'); DB.dCond('filter', 'v', ['91–180', '181+']);
  const c1 = DB.dCondAdd('filter'); const p1 = DB.autocheck(DB.draft).preview.value;
  DB.dCondDel('filter', 1); DB.dCond('filter', 'f', 'worstDays'); DB.dCond('filter', 'op', 'gt'); DB.dCond('filter', 'v', '90');
  const c2 = DB.dCondAdd('filter'); const p2 = DB.autocheck(DB.draft).preview.value;
  DB.dNumShare(true); DB.dCond('num', 'f', 'ptype'); DB.dCond('num', 'v', ['юр']); DB.dCondAdd('num'); DB.dTitle('Юрлица среди клиентов с просрочкой 91+');
  const sh = DB.autocheck(DB.draft); DB.newDraft();
  ok(93, c1 && c2 && p1 === p2 && p1 === Bs.filter(b => b.worstDays > 90).length && DB.condText(c1) === 'Худшая просрочка по портфелю ∈ 91–180, 181+'
    && DB.condText(c2) === 'Худшая просрочка по портфелю, дн. > 90' && sh.ok && sh.preview.den === p2 && sh.preview.num === Bs.filter(b => b.worstDays > 90 && b.ptype === 'юр').length,
    `конструктор собирает фильтр по значению: «${DB.condText(c1)}» = «${DB.condText(c2)}» = ${p1} клиентов; доля юрлиц среди них — фильтр числителя ${sh.preview.num} из ${sh.preview.den} (ДБ-Д23, ДБ-70)`);
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
  const byType = DB.ask(draft({ obj:'borrower', inds:['borrower.total'], dims:['ptype'], format:'slice', filter:[ACT] }), U('u1'), 'lead', {});
  const hint = DB.builderHints(draft({ obj:'borrower', inds:['borrower.total'], filter:[ACT] }));
  const layB = Object.values(DB.DECLARED_SEED).flat().filter(k => DB.tileById(k)).some(k => DB.tileById(k).inds.some(i => DB.IND[i].obj === 'borrower' && DB.IND[i].unit === 'sum' && DB.tileById(k).format !== 'table'));
  ok(99, money.length >= 2 && Math.round(byType.total.v) === Math.round(bal) && hint.some(h => /Итог денег — у объекта «Кредит»/.test(h)) && !layB,
    `у заёмщика деньги портфеля (${money.map(i => i.name).join(', ')}): по типу лица ${byType.nodes.map(n => n.label.split(' ')[0] + ' ' + DB.fmtVal(n.value, 'sum')).join(' · ')}; без разреза — подсказка «итог у кредита» (ДБ-67)`);
  // ДБ-77, ДБ-78: форматы и сдвиг счёта клиентов
  const fc = DB.formatsFor(draft({ obj:'borrower', inds:['borrower.count'], filter:[ACT] }));
  const sPm = DB.ask(draft({ obj:'borrower', inds:['borrower.count'], filter:[ACT], format:'shift', shift:'prevMonthEnd' }), U('u1'), 'lead', {});
  const sYs = DB.ask(draft({ obj:'borrower', inds:['borrower.count'], filter:[ACT], format:'shift', shift:'yearStart' }), U('u1'), 'lead', {});
  ok(100, fc.find(x => x.f === 'move').ok && fc.find(x => x.f === 'shift').ok && DB.shiftsFor(draft({ obj:'borrower', inds:['borrower.count'] })).length === 3
    && sPm.shift.base === at(-1) && sYs.shift.base === at(-10) && sPm.shift.base !== sYs.shift.base,
    `сдвиг счёта клиентов — как у остатков, «действующий» на дату базы: к 30.09 ${sPm.shift.base}, к началу года ${sYs.shift.base}, сейчас ${sPm.value} (ДБ-77, ДБ-78)`);
  // ДБ-79: «Работать со списком» — реестр заёмщиков с фильтром плитки
  const reg = DB.registryList(T('prob-dead'), U('u3'), 'prob', {});
  ok(101, reg.registry === 'Реестр заёмщиков' && reg.today === pdP.value && reg.slice === pdP.value,
    `«Работать со списком» у заёмщика — ${reg.registry} с фильтром плитки: ${reg.today} (ДБ-79)`);
  // ДБ-81: 13 разрезов реестра + 4 заявленных
  const D = DB.OBJ_DIMS.borrower; const reqD = D.filter(d => DB.DIMS[d].req);
  ok(102, ['pstate', 'pers', 'bcur', 'bcohort', 'bblack'].every(d => D.includes(d)) && D.length - reqD.length === 13 && reqD.join() === 'bdebt,bcredits,bhist,bcontact'
    && DB.ask(draft({ obj:'borrower', inds:['borrower.count'], dims:['bcohort'], format:'steps', filter:[ACT] }), U('u1'), 'lead', {}).total.v === 903,
    `у заёмщика ${D.length - reqD.length} разрезов из реестра и ${reqD.length} заявленных (⚑): ${reqD.map(d => DB.DIMS[d].name).join(', ')} (ДБ-81…ДБ-84, ДБ-86)`);
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
  ok(105, DB.builderHints(draft({ obj:'loan', inds:['loan.paid'], filter:[{ f:'lact', op:'eq', v:'действующий' }] })).some(h => /отрезает договоры, закрытые в периоде/.test(h)),
    'у потока фильтр «действующие» отрезает договоры, закрытые в периоде, — конструктор предупреждает (вопрос владельцу)');
})();

/* ---------- отчёт ---------- */
const fail = results.filter(r => !r.pass);
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'} #${r.n} ${r.note}`);
console.log(`\n${results.length - fail.length}/${results.length} PASS`);
process.exit(fail.length ? 1 : 0);
