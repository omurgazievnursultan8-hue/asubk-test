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
//   K  сторож чистоты: в макете нет номеров решений и ADR, «сегодня» заморожено.
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
  ok(4, lead.filter(k => !k.startsWith('s:')).length === 15 && lead.filter(k => k.startsWith('s:')).length === 3,
    `стартовая раскладка «Руководства» — 15 плиток в трёх секциях (ДБ-40): ${lead.length} элементов`);
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
  ok(38, other.value === DB.DATA.loan.filter(l => l.curator === 'c00').length && other.value !== 47,
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
  const bad = DB.saveTile(Object.assign(DB.blankDraft(), { title:'x', inds:['loan.episodes'] }), 'publish');
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
  const rf = DB.ask(T('cat-episodes'), U('u1'), 'lead', {});
  ok(55, rf.state === 'refusal' && /владелец/.test(rf.msg), `настоящий отказ шва назван поимённо: ${rf.msg}`);
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

/* ---------- отчёт ---------- */
const fail = results.filter(r => !r.pass);
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'} #${r.n} ${r.note}`);
console.log(`\n${results.length - fail.length}/${results.length} PASS`);
process.exit(fail.length ? 1 : 0);
