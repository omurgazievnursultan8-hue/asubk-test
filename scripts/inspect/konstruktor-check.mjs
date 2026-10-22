// Headless smoke для экрана «Конструктор: личный черновик состава» — волной 24 влит
// в mockups/reports/reports.html (data-v="draft", fn:scDraft); был отдельным файлом
// konstruktor.html (волна 20), теперь одна страница. Zero-dep: вытаскивает <script> из
// HTML и исполняет логический слой в node:vm без DOM (render() при отсутствии document — no-op).
// Проверяется то, что дев-команда прочитает со страницы: область видимости в паспорте,
// отказы словами (объект без живых строк, выведенный и неисчислимый показатель, необъявленный
// разрез), число узла по строкам узла, корзина при чтении, подстановка даты, фиксация,
// личность черновика, предварительный выпуск, замороженный рабочий список, просьба о публикации.
// Волна 21 (E): два новых основных объекта — предмет залога и требование взыскания — со своими
// полями, показателями и разрезами из реестра статистики; дедуп солидарных сумм (ИС-34).
// Волна 22 (F): одна колонка — одна величина: строка объекта печатает меру под колонкой своего
// агрегата (`over`), поле-уровень не повторяет, идентификатор и признаки — в первой колонке.
// Волна 24: логика конструктора влита в общий <script> reports.html внутри своей IIFE
// (window.KB/S/scAnswer, act переименован в kbAct — не путать с window.act самого reports.html).
// G: шаг «фильтры» — редактор наборов: в наборе условия «и», наборы между собой «или»; «топ N» строкой после наборов.
// H: зеркало реестра статистики (читается из mockups/statistics/statistics.html): все показатели и разрезы объекта, значения стенда, группы и поиск; заготовка «Заявки по программам и статусам».
// I: волна 61 — экран «Конструктор» на рамке экрана показа (КН-1…КН-17), по образцу прежних строк: рамка и шапка в две строки, панель «Настройки · Паспорт» с пятью разделами, стартовый экран, полоса,
//   чьими глазами смотрит (роль «пользователь» — Осмонова, видно 47 / скрыто 3; ОЧ-Д9 закрыт: заявки конструктора = заявки экрана показа той же роли), сохранение личным отчётом на витрине, «С готового отчёта»,
//   выгрузка строкой «Журнала выпусков», формулы, раскладки и график, стопки и «Колонки ▾», «Время», «Отбор», лист с итогами групп, «показано не так», вкладка «Паспорт» и сканер служебных слов в видимых текстах.
//   Проверки #3, #24–#27, #30 переписаны под рамку (лист читается разметкой VIEWS.draft.fn() при S().started = true); новые — #33 и дальше, каждая — одна строка вывода;
//   #57 — правка по ревью волны: «сохранён» сверяется и с записью, отчёт по имуществу с витрины, «один раз» о показанных колонках, живой расчёт и роль, вход извне с чистого экрана.
//   node scripts/inspect/konstruktor-check.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dir = dirname(fileURLToPath(import.meta.url));
const HTML  = resolve(__dir, '../../mockups/reports/reports.html');
const src   = readFileSync(HTML, 'utf8');

const m = src.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('<script> не найден в HTML'); process.exit(1); }
const win = {};
const sandbox = { window: win, console, setTimeout: () => {}, clearTimeout: () => {}, prompt: () => '' };
vm.createContext(sandbox);
vm.runInContext(m[1], sandbox, { filename: 'konstruktor-in-reports.inline.js' });
const KB = win.KB, S = win.S;
if (!KB) { console.error('window.KB не экспортирован'); process.exit(1); }
/* Чьими глазами смотрит конструктор — по «Роль ▾» экрана показа (RP.viewer()). Числа #1–#32 написаны под Осмонову
   (пользователь: видно 47, скрыто 3); роль по умолчанию у RP — уполномоченный (50/0), поэтому ставим явно. */
const roleTitle = id => vm.runInContext('ROLES.find(r => r.id === ' + JSON.stringify(id) + ').title', sandbox);
const asRole = id => { win.RP.state.role = roleTitle(id); KB.seed(); };
win.RP.state.role = roleTitle('user');

const results = [];
const ok = (n, cond, note = '') => results.push({ n, pass: !!cond, note });
const has = (s, part) => String(s || '').includes(part);
const ME = 'Осмонова Г.', AUTH = 'Тентимишев К.';

/* ---------- A. Область видимости — в паспорте, а не в фильтре (ИО-6, ADR-0152) ---------- */
(() => {
  KB.seed();
  const a = KB.answer();
  ok(1, a.ok && a.root.count === 47 && a.hidden === 3 && has(a.passport.scopeText, 'промышленности') && has(a.passport.short, 'вам видно 47'),
    `на 31.08 вам видно ${a.root.count}, скрыто областью видимости ${a.hidden}; краткий паспорт: «${a.passport.short}»`);
  KB.setAsOf('2026-07-31');
  const b = KB.answer();
  ok(2, b.root.count === 45 && b.passport.fixed === 'зафиксировано' && a.passport.fixed === 'не зафиксировано',
    `снимок — это и СОСТАВ: на 31.07 видно ${b.root.count} (два договора рождены в августе); 31.07 — «${b.passport.fixed}», 31.08 — «${a.passport.fixed}»`);
  const r = KB.setAsOf('2026-09-05');
  const c = KB.answer();
  S().started = true;
  const scr = win.scAnswer ? win.scAnswer() : '', sheet = (scr.match(/<div class="pv-sheet">[\s\S]*$/) || [''])[0];
  ok(3, r.ok && r.gap && !c.ok && !c.root && c.gap.reason === 'пропуск прогона' && c.gap.before === '2026-08-31' &&
        has(c.why, 'на 05.09.2026 снимка нет') &&
        has(sheet, '<div class="pv-sheet"><div class="banner warn nosnap"') && has(sheet, '<b>Снимка на 05.09.2026 нет — чисел нет.</b> Причина: пропуск прогона.') &&
        has(sheet, 'onclick="KB.ui.asOf(\'2026-08-31\')">‹ 31.08.2026</button>') && !has(sheet, '<table') && !has(sheet, 'class="pv-tb"') &&
        has(scr, 'снимка нет</div>'),
    `дата без снимка чисел не даёт: «${c.why}»; на месте листа — плашка «Снимка на 05.09.2026 нет — чисел нет.» с кнопкой ближайшего снимка раньше — ${c.gap.before}, ` +
    `таблицы и панели над листом нет, шапка — «снимка нет»; соседний не подставляется (ИО-26, ПВ-8)`);
})();

/* ---------- B. Режим — часть вопроса; отказы словами (ИО-30, ADR-0159) ---------- */
(() => {
  KB.seed();
  const r = KB.setMode('сейчас');
  const st = KB.answer();
  ok(4, r.ok && st.stale === true && !st.ok && has(st.why, 'посчитать'),
    `«сейчас» считается по кнопке: до compute() ответа нет — «${st.why.slice(0, 60)}…»`);
  const live = KB.compute();
  const lateNode = k => live.root.children.find(n => n.key === k);
  ok(5, live.ok && live.root.count === 47 && has(live.passport.short, 'живое') && live.passport.seams[0] === 'objectRows' && lateNode('0 дней').count === 28,
    `живой ответ отвечает objectRows ядра; числа другие, чем в снимке (0 дней: 28 против 26 — двое погасили после 31.08)`);
  const t = KB.toggleStat('s-avg-late');
  ok(6, !t.ok && has(t.why, 'налету не берётся'),
    `неисчислимый показатель в «сейчас» отказан причиной: «${t.why.slice(0, 50)}…»`);
  const cp = KB.addCut('purpose');
  const back = KB.setMode('на дату');
  ok(7, cp.ok && back.ok && back.dropped.length === 1 && back.dropped[0].kind === 'разрез' && back.dropped[0].name === 'целевое назначение' &&
        !KB.cutAvail('purpose').ok && has(KB.cutAvail('purpose').why, 'прогон') && KB.cutAvail('program').ok,
    `необъявленный разрез «целевое назначение» (поле перечня ядра, записи в реестре разрезов нет) доступен в «сейчас» и снят С ПОМЕТКОЙ ` +
    `при возврате в «на дату»: «${((back.dropped[0] || {}).why || '').slice(0, 60)}…»; «кредитная программа» объявлена реестром (d-program) и на дату доступна`);
  KB.seed();
  const sw = KB.setObject('borrower'); KB.setObject('credit'); KB.setMode('сейчас');
  const sw2 = KB.setObject('borrower');
  ok(8, !sw.switched && sw2.switched && S().mode === 'на дату' && sw2.rule === 'ИО-30',
    `заёмщик в режиме «сейчас» переключает режим и объясняет: «${sw2.why.slice(0, 70)}…»`);
  const md = KB.setMode('сейчас');
  ok(9, !md.ok && has(md.why, 'objectRows'),
    `и прямой запрос «сейчас» для заёмщика отказан причиной, а не погашенной кнопкой`);
})();

/* ---------- C. Реестр и дерево: показатель без формулы, узел по строкам узла (ИО-2, ИО-17) ---------- */
(() => {
  KB.seed();
  const w = KB.toggleStat('s-npl');
  ok(10, !w.ok && has(w.why, 'выведен 12.08'),
    `выведенный показатель не добавляется: «${w.why.slice(0, 50)}…»`);
  KB.toggleStat('s-avg-late');
  const a = KB.answer();
  const kids = a.root.children;
  const sumKids = kids.reduce((s, n) => s + (n.values['s-avg-late'] || 0), 0);
  const rootAvg = a.root.values['s-avg-late'];
  ok(11, kids.length === 5 && Math.abs(rootAvg - 136.476) < 0.01 && Math.abs(sumKids - rootAvg) > 100 && kids.reduce((s, n) => s + n.count, 0) === a.root.count,
    `число узла — по строкам узла: средняя по корню ${rootAvg.toFixed(1)} дн., сумма средних детей ${sumKids.toFixed(1)} — складывать нельзя; счёт строк при этом сходится (47)`);
  const labels = kids.map(n => n.key);
  const leafRows = n => n.rows ? n.rows : (n.children || []).flatMap(leafRows);
  const raw = leafRows(kids.find(n => n.key === '31–90 дней')).map(r => r.days);
  ok(12, labels.join('|') === '0 дней|1–30 дней|31–90 дней|91–180 дней|181+ дней' && raw.every(d => d >= 31 && d <= 90) && raw.some(d => d !== 31),
    `корзина применена при чтении: пять ступеней в объявленном порядке, строки узла «31–90» хранят дни как есть (${raw.join(', ')})`);
})();

/* ---------- D. Действия: черновик личный, выпуск предварительный, список заморожен (ИО-1, ИО-4, ИО-14) ---------- */
(() => {
  KB.seed();
  const e = KB.saveDraft('');
  const d = KB.saveDraft('Просрочка по ступеням');
  ok(13, !e.ok && d.ok && KB.draftsOf(ME).length === 1 && KB.draftsOf(AUTH).length === 0,
    `черновик без имени отказан; сохранённый виден автору (${KB.draftsOf(ME).length}) и не виден уполномоченному (${KB.draftsOf(AUTH).length})`);
  const x = KB.exportIssue('xlsx');
  const f = KB.finalIssue();
  ok(14, x.ok && x.issue.kind === 'предварительный' && x.issue.personal && has(x.issue.passport.short, 'вам видно 47') && !f.ok && has(f.why, 'ПОЛУЧАТЕЛЬ'),
    `выгрузка = предварительный личный выпуск ${x.id} с паспортом в файле; окончательный отказан: «${f.why.slice(0, 60)}…»`);
  const w0 = KB.makeWorklist('Долг 181+');
  KB.setDrill(true); KB.addFilter('days', '>', 180);
  const w1 = KB.makeWorklist('Долг 181+');
  KB.setFilter(0, { value: '90' });
  const rowsNow = KB.rowsShown().length;
  const wl = S().worklists[0];
  ok(15, !w0.ok && has(w0.why, 'строки объектов') && w1.ok && w1.count === 5 && wl.count === 5 && rowsNow === 10 && wl.issue === w1.issue && S().issues.some(i => i.id === w1.issue),
    `список без строк отказан; «${wl.name}» заморожен на ${wl.count} объектах через выпуск ${wl.issue}, хотя экран уже показывает ${rowsNow} — состав под ногами не меняется`);
  const p1 = KB.askPublish(), p2 = KB.askPublish();
  const bs = KB.setBasis(), db = KB.pinToDashboard(), pb = KB.publish();
  ok(16, p1.ok && !p2.ok && S().asked.to === AUTH && !bs.ok && has(bs.why, 'утверждающий') && db.ok && has(db.note, 'раскладка — в модуле дашборда') && !pb.ok && has(pb.why, AUTH),
    `просьба о публикации уходит ${AUTH}; норму и публикацию черновику отказывают словами, а «📌 на дашборд» сохранённого черновика — только ссылка: раскладку ведёт модуль дашборда`);
})();

/* ---------- E. Волна 21: предмет залога и требование — свои поля, показатели, разрезы (ИО-2, ИО-30, ИС-34, ИС-40) ---------- */
(() => {
  KB.seed();
  const r = KB.setObject('collateral');
  const a = KB.answer();
  const st = KB.statsAvail(), cu = KB.cutsAvail(), fl = KB.fields();
  /* Палитра — зеркало реестра по obj-collateral: 11 агрегатов и a-count, 10 разрезов реестра и свой «валюта оценки» (ОЧ-Д3). */
  ok(17, r.ok && !r.switched && a.ok && a.root.count === 41 && a.hidden === 3 && has(a.passport.short, 'вам видно 41') &&
        st.length === 12 && st.every(x => x.object === 'collateral' && x.ok) && cu.length === 10 && cu.every(x => x.object === 'collateral' && x.ok) &&
        !cu.some(x => x.id === 'dept' || x.reg === 'd-branch') &&
        S().cuts[0].id === 'c-dept' && fl.owner === 'залог · предметы' && fl.fields.length === 23,
    `предмет залога: перечень объявил «${fl.owner}» (${fl.fields.length} полей), палитра — ${st.length} показателей и ${cu.length + 1} разрезов, и все СВОИ ` +
    `(ИС-40: «подразделение» кредита к предмету не прикладывается); вам видно ${a.root.count}, скрыто ${a.hidden}`);

  const md = KB.setMode('сейчас');
  KB.setObject('credit'); KB.setMode('сейчас');
  const sw = KB.setObject('collateral');
  ok(18, !md.ok && has(md.why, 'objectRows') && sw.switched && S().mode === 'на дату' && sw.rule === 'ИО-30',
    `у предмета залога живых строк в v1 нет: «сейчас» отказан причиной, а выбор объекта в «сейчас» переключает режим и объясняет (ИО-30)`);

  KB.seed(); KB.setObject('collateral');
  S().stats = ['s-c-count', 's-c-pledge', 's-c-sec'];
  S().cuts = [{id:'c-kind', bucket:'класс ликвидности', total:true}];
  const byClass = KB.answer();
  const cls = byClass.root.children;
  const leafRows = n => n.rows ? n.rows : (n.children || []).flatMap(leafRows);
  const hi = leafRows(cls.find(n => n.key === 'высоколиквидный')).map(x => x.kind);
  KB.setBucket('c-kind', 'вид');
  const byKind = KB.answer();
  ok(19, cls.map(n => n.key).join('|') === 'высоколиквидный|средней ликвидности|низколиквидный' && byKind.root.children.length === 6 &&
        cls.reduce((s, n) => s + n.count, 0) === 41 && byKind.root.children.reduce((s, n) => s + n.count, 0) === 41 &&
        hi.every(k => k === 'депозит' || k === 'недвижимость'),
    `«вид обеспечения» двухуровневый: корзина «класс ликвидности» даёт ${cls.length} узла справочником владельца (ADR-0176 §7), «вид» — ` +
    `${byKind.root.children.length}; строки узла «высоколиквидный» хранят вид как есть (${[...new Set(hi)].join(', ')})`);

  const sumKidsSec = cls.reduce((s, n) => s + n.values['s-c-sec'], 0), rootSec = byClass.root.values['s-c-sec'];
  const sumKidsPl = cls.reduce((s, n) => s + n.values['s-c-pledge'], 0), rootPl = byClass.root.values['s-c-pledge'];
  ok(20, rootSec < sumKidsSec && rootPl === sumKidsPl && rootSec === 131883000,
    `«обеспечено залогом» дедупится по кредиту: итог ${Math.round(rootSec / 1e6)} млн меньше суммы классов ${Math.round(sumKidsSec / 1e6)} млн — один кредит ` +
    `под двумя предметами есть один долг (ИС-34); аддитивная «залоговая стоимость» сходится копейка в копейку`);

  KB.seed();
  const q = KB.setObject('claim');
  const b = KB.answer();
  S().stats = ['s-q-count', 's-q-sum', 's-q-avgph'];
  S().cuts = [{id:'q-role', bucket:null, total:true}];
  const byRole = KB.answer();
  const roles = byRole.root.children;
  const nOf = k => (roles.find(n => n.key === k) || {count:0}).count;
  const sumKids = roles.reduce((s, n) => s + n.values['s-q-sum'], 0), root = byRole.root.values['s-q-sum'];
  ok(21, q.ok && b.ok && b.root.count === 28 && b.hidden === 4 && KB.fields().owner === 'взыскание · требования' &&
        roles.map(n => n.key).join('|') === 'заёмщик|поручитель|залогодатель' && nOf('заёмщик') === 21 && nOf('поручитель') === 6 && nOf('залогодатель') === 1 &&
        root === roles[0].values['s-q-sum'] && sumKids > root * 1.5 &&
        byRole.passport.dedup.length === 1 && has(byRole.passport.dedup[0], 'кредит требования'),
    `требование = дело × кредит × роль: ${b.root.count} требований (${nOf('заёмщик')} к заёмщику, ${nOf('поручитель')} к поручителю, ${nOf('залогодатель')} к залогодателю), ` +
    `скрыто ${b.hidden}; сумма солидарна — итог ${Math.round(root / 1e6)} млн равен узлу «заёмщик», а сумма ролей ${Math.round(sumKids / 1e6)} млн больше: ` +
    `паспорт называет дедуп-ключ «кредит требования» (ИС-34, ADR-0199)`);

  S().cuts = [{id:'q-phase', bucket:null, total:false}];
  const byPhase = KB.answer();
  const ph = byPhase.root.children;
  const avgKids = ph.reduce((s, n) => s + n.values['s-q-avgph'], 0), avgRoot = byPhase.root.values['s-q-avgph'];
  KB.setAsOf('2026-07-31');
  const july = KB.answer();
  ok(22, ph.map(n => n.key).join('|') === 'Претензия|Иск|Решение суда|На исполнении' && ph.reduce((s, n) => s + n.count, 0) === 28 &&
        avgKids > avgRoot * 2 && july.root.count === 21 && july.root.count < byPhase.root.count,
    `фазы стоят порядком закрытого словаря владельца, не алфавитом; «средний срок в фазе» узла — по строкам узла (сумма средних ${avgKids.toFixed(0)} против ` +
    `${avgRoot.toFixed(0)} по корню); снимок — это и состав: на 31.07 требований ${july.root.count}, на 31.08 — ${byPhase.root.count} (семь открыты в августе)`);

  KB.seed(); KB.setObject('collateral');
  S().stats = ['s-c-count', 's-c-avgsurv', 's-c-maxsurv'];
  S().cuts = [{id:'c-ctl', bucket:null, total:false}];
  const byCtl = KB.answer();
  const none = byCtl.root.children.find(n => n.key === 'не обследован');
  const f = KB.addFilter('surv', '>', 180);
  KB.setDrill(true);
  const rows = KB.rowsShown();
  const ctlSet = [...new Set(rows.map(x => x.ctl))];
  ok(23, byCtl.root.children.map(n => n.key).join('|') === 'в срок|контроль просрочен|не обследован' && none && none.count === 5 &&
        none.values['s-c-avgsurv'] === null && none.values['s-c-maxsurv'] === null && byCtl.root.values['s-c-avgsurv'] > 0 &&
        f.ok && rows.length === 18 && ctlSet.length === 1 && ctlSet[0] === 'контроль просрочен',
    `«состояние контроля» приходит швом calcPledge: у ${none.count} необследованных срок — прочерк, не ноль (средняя по корню считается по ${41 - none.count} строкам); ` +
    `фильтр «дней с обследования > 180» и разрез «контроль просрочен» читают одну клетку — ${rows.length} строк, все в одном узле`);
})();

/* ---------- F. Волна 22: одна колонка — одна величина; строка не повторяет дерево (ADR-0185 §3) ---------- */
(() => {
  const scAnswer = win.scAnswer;
  const count = (h, re) => (h.match(re) || []).length;
  KB.seed(); KB.setObject('collateral');
  S().stats = ['s-c-count', 's-c-pledge', 's-c-avgsurv'];
  S().cuts = [{id:'c-kind', bucket:'класс ликвидности', total:true}];
  KB.setDrill(true); KB.toggleField('zstate');        // поля умолчания: no, kind, pledger, pledge, surv; + залоговый статус
  const pl = KB.rowPlan();
  S().started = true;
  const html = scAnswer();
  const rows = KB.rowsShown();
  const r0 = rows[0];
  const objRows = html.match(/<tr class="obj">[\s\S]*?<\/tr>/g) || [];
  const cellsOf = tr => (tr.match(/<td[^>]*>[\s\S]*?<\/td>/g) || []);
  const first = cellsOf(objRows[0]);
  const thead = (html.match(/<thead>[\s\S]*?<\/thead>/) || [''])[0];
  /* Одна колонка — одна величина: подписей «узел — сумма · строка — …» в шапке нет; поле, чья мера стоит под колонкой агрегата, названо в title
     клетки; у колонки без меры строки клетка пустая; в первой колонке — идентификатор, признак чипом, «·» между полями. */
  ok(24, pl.under['s-c-pledge'] === 'pledge' && pl.under['s-c-avgsurv'] === 'surv' && pl.ident.join() === 'no,pledger' && pl.chips.join() === 'zstate' &&
        pl.skipped.join() === 'kind' && pl.extra.length === 0 && objRows.length === rows.length && first.length === 4 &&
        has(first[0], r0.no) && has(first[0], r0.pledger) && has(first[0], 'class="chip"') && has(first[0], r0.zstate) && !has(first[0], r0.kind) &&
        has(first[0], '<span class="sep">·</span>') && has(first[0], 'title="Номер предмета"') && has(first[0], 'title="Залогодатель"') && has(first[0], 'title="Залоговый статус"') &&
        first[1] === '<td class="num st"></td>' &&
        has(first[2], String(r0.pledge).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')) && has(first[2], 'title="Залоговая стоимость"') &&
        has(first[3], String(r0.surv)) && has(first[3], 'title="Дней с последнего обследования"') &&
        has(thead, 'строка — номер предмета · залогодатель · залоговый статус') && !has(html, 'узел — сумма') && !has(html, 'узел — среднее') &&
        has(html, 'стоит уровнем'),
    `план строки: «залоговая стоимость» и «дней с обследования» встали ПОД колонками своих агрегатов (over реестра) — имя поля в title клетки, у «Предметов залога» клетка пустая; ` +
    `«вид обеспечения» не печатается — стоит уровнем («Колонки ▾»: серое); номер и залогодатель — идентификатор, залоговый статус — чип; ${objRows.length} строк × ${first.length} ячеек, лишних колонок нет`);

  KB.seed(); KB.setDrill(true); S().started = true;   // кредит: no, borrower, debt_main, days; уровни — срок неплатежа (days), состояние
  const p1 = KB.rowPlan(), h1 = scAnswer();
  KB.toggleStat('s-avg-late'); KB.toggleStat('s-portfolio');
  const p2 = KB.rowPlan(), h2 = scAnswer();
  const a2 = KB.answer();
  ok(25, p1.extra.join() === 'debt_main' && p1.skipped.join() === 'days' && count(h1, /только строки/g) === 1 && p1.under['s-overdue-sum'] === 'overdue' &&
        has(h1, 'Остаток основного долга<span class="th-sub">сом · только строки</span>') && has(h1, 'title="Просроченная задолженность"') &&
        p2.extra.length === 0 && p2.under['s-avg-late'] === 'days' && p2.under['s-portfolio'] === 'debt_main' && count(h2, /только строки/g) === 0 &&
        has(h2, 'title="Остаток основного долга"') &&
        a2.passport.shown.drill.some(x => has(x, 'Остаток основного долга — под своим агрегатом')) && !a2.passport.shown.drill.some(x => has(x, 'своей колонкой')),
    `мера без агрегата — своя колонка «только строки» («остаток» у кредита); «дней просрочки» стоит уровнем «срок неплатежа» и не повторяется; ` +
    `включили «Остаток, всего» — остаток ушёл под свой агрегат, колонок «только строки» 0, паспорт называет размещение`);
})();

/* ---------- G. Фильтры — редактор наборов: «или» из «и», «топ N» строкой после (ПВ-Д1, §3 п. 12, ОГ-9, ИО-17) ---------- */
(() => {
  const count = (h, re) => (h.match(re) || []).length;
  KB.seed(); KB.setDrill(true);
  const all = KB.rowsShown();
  const A = r => r.days > 90, B = r => r.debt_main > 5000000, C = r => r.status === 'на взыскании';
  const nA = all.filter(A).length, nB = all.filter(B).length, nAnd = all.filter(r => A(r) && B(r)).length;
  const nOr = all.filter(r => A(r) || B(r)).length, nBC = all.filter(r => B(r) || C(r)).length, nOpen = all.filter(r => r.status !== 'закрыт').length;
  const nOrOpen = all.filter(r => (A(r) || B(r)) && r.status !== 'закрыт').length;
  KB.addFilter('days', '>', 90);
  const one = KB.answer();
  const s1 = KB.addSet(), s2 = KB.addSet();
  S().started = true; const hEmpty = win.VIEWS.draft.fn();     // второй набор пуст: «＋ условие» в нём, «＋ или» серым с причиной
  const f2 = KB.addFilter('debt_main', '>', 5000000, s1.set);
  const or = KB.answer(), rowsOr = KB.rowsShown();
  const html = win.VIEWS.draft.fn();
  KB.setActive(true); const chip = KB.answer(); KB.setActive(false);
  KB.addSet(); KB.addFilter('status', 'равно', 'на взыскании', 2);
  KB.removeFilter(0);                                   // последнее условие набора 1: набор уходит, номера сдвигаются
  const ren = S().filters.map(f => f.set).join(), sets2 = S().sets, after = KB.answer();
  KB.removeFilter(1);                                   // и набора «на взыскании» — остаётся один набор
  const last = KB.answer();
  ok(26, one.root.count === nA && one.passport.shown.filters.join() === 'Дней просрочки > 90' &&
        s1.ok && s1.set === 1 && !s2.ok && has(s2.why, 'пустой набор') && f2.ok &&
        or.root.count === nOr && nOr > nA && nOr > nB && nAnd > 0 && rowsOr.length === nOr && rowsOr.every(r => A(r) || B(r)) &&
        or.passport.shown.filters.length === 1 && or.passport.shown.filters[0] === '(Дней просрочки > 90) или (Остаток основного долга > 5000000)' &&
        has(html, '<b>Набор 1</b>') && has(html, '<b>Набор 2</b>') && has(html, '<div class="kor">или</div>') && count(html, /<div class="kor">или<\/div>/g) === 1 &&
        has(html, '＋ или — новый набор</button>') && count(html, />＋ и<\/button>/g) === 2 &&
        has(hEmpty, '＋ условие</button>') && has(hEmpty, 'disabled title="Пустой набор уже есть') &&
        !has(html, 'Порядок:') && !has(html, 'охват роли') && !has(html, 'Порядок отбора') &&
        chip.root.count === nOrOpen && nOrOpen < nOpen && chip.passport.shown.filters.indexOf('действующие (закрытые не входят)') === 1 &&
        ren === '0,1' && sets2 === 2 && after.root.count === nBC &&
        after.passport.shown.filters[0] === '(Остаток основного долга > 5000000) или (Состояние равно на взыскании)' &&
        last.root.count === nB && S().sets === 1 && last.passport.shown.filters.join() === 'Остаток основного долга > 5000000',
    `отбор на экране — карточки «Набор 1», «Набор 2» с «или» между ними, «＋ и» в каждой, «＋ или — новый набор» полной ширины (в пустом наборе — «＋ условие», «＋ или» серым), ` +
    `абзаца «Порядок: охват роли → …» нет; ` +
    `набор 1 «дней просрочки > 90» — ${nA} кредитов, набор 2 «остаток > 5 млн» — ${nB}, вместе ${nAnd}; «или» наборов дал ${or.root.count} = ` +
    `${nA} + ${nB} − ${nAnd}, посчитано отдельно по строкам среза; второй пустой набор подряд отказан словами («${s2.why}»); паспорт: «${or.passport.shown.filters[0]}»; ` +
    `чип «действующие» — «и» поверх наборов, не третий набор: ${chip.root.count}, а не ${nOpen}; снято последнее условие набора 1 — набор ушёл, ` +
    `остальные сдвинулись в наборы 1 и 2, ответ ${after.root.count}; снят и набор «на взыскании» — один набор, ${last.root.count}`);
})();
(() => {
  KB.seed(); const V = KB.answer().root.count;                     // видимые роли — от них шапка считает «в отборе N из M»
  KB.setDrill(true); KB.toggleStat('s-portfolio');   // остаток ставит «действующие» сам (ОД-7): чип — «и» поверх отбора
  KB.addFilter('days', '>', 0); KB.addSet(); KB.addFilter('debt_main', '>', 5000000, 1);
  const a0 = KB.answer(), base = KB.rowsShown(), M = base.length;
  const ids = rs => rs.map(r => r.id).sort().join(), sum = (rs, f) => rs.reduce((s, r) => s + r[f], 0);
  const sp = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const desc = base.slice().sort((x, y) => y.debt_main - x.debt_main), asc = base.slice().sort((x, y) => x.debt_main - y.debt_main);
  const t = KB.setTop(5, 'debt_main', 'первые');
  S().started = true;
  const a = KB.answer(), top = KB.rowsShown(), scr = win.scAnswer(), html = win.VIEWS.draft.fn();
  KB.ui.tab('паспорт'); const pass = win.VIEWS.draft.fn(); KB.ui.tab('настройки');
  const d = KB.saveDraft('Пять крупнейших');
  KB.setTop(5, 'debt_main', 'последние');
  const b = KB.answer(), low = KB.rowsShown();
  const bad = KB.setTop(5, 'borrower', 'первые'), keptDir = S().top.dir;
  const clr = KB.setTop(0), topGone = S().top, c = KB.answer();
  KB.openDraft(d.id); const back = KB.answer(), topBack = S().top, setsBack = S().sets;
  const half = KB.setTop(0.5), halfTop = S().top; KB.openDraft(d.id);
  const nFl = S().filters.length, badNum = KB.addFilter('days', '>', 'девяносто'), badSet = KB.setFilter(0, { value:'много' });
  ok(27, t.ok && a.root.count === 5 && top.length === 5 && ids(top) === ids(desc.slice(0, 5)) &&
        half.ok && halfTop === null && !badNum.ok && has(badNum.why, 'числом не читается') && S().filters.length === nFl &&
        !badSet.ok && S().filters[0].value === '0' &&
        a.root.values['s-portfolio'] === sum(top, 'debt_main') && a.root.values['s-portfolio'] === sum(desc.slice(0, 5), 'debt_main') &&
        a.root.values['s-overdue-sum'] === sum(top, 'overdue') && a.passport.seams.indexOf('statRows') !== -1 &&
        a.passport.topOf.n === 5 && a.passport.topOf.from === M && a.passport.visible === M && a.passport.hidden === a0.passport.hidden &&
        has(a.passport.shown.top, 'топ 5 по «Остаток основного долга»') && has(a.passport.shown.top, 'в отборе 5 из ' + M) &&
        has(a.passport.short, 'вам видно ' + M + ' · в отборе 5 из ' + M) &&
        has(scr, 'в отборе 5 из ' + V) && has(html, 'отобрано 5 из ' + V + '</span>') && has(pass, 'в отборе 5 из ' + V) &&
        has(html, '<option value="5" selected>5</option>') && has(html, '<select id="kbTopBy"') && has(html, '<option value="debt_main" selected>') &&
        b.root.count === 5 && ids(low) === ids(asc.slice(0, 5)) && b.root.values['s-portfolio'] === sum(asc.slice(0, 5), 'debt_main') &&
        has(b.passport.shown.top, 'последние 5 по «Остаток основного долга»') &&
        !bad.ok && has(bad.why, '«Заёмщик» — текст') && keptDir === 'последние' &&
        clr.ok && topGone === null && c.root.count === M && c.passport.shown.top === null && !has(c.passport.short, 'в отборе') &&
        back.root.count === 5 && topBack && topBack.n === 5 && topBack.dir === 'первые' && setsBack === 2 && ids(KB.rowsShown()) === ids(top),
    `после наборов и чипа видно ${M}; «топ 5 по остатку» — 5 крупнейших из них (наибольший ${sp(desc[0].debt_main)}), итог «остатка» по отобранным ` +
    `${sp(a.root.values['s-portfolio'])} пришёл от статистики списком отобранных строк и равен сумме этих пяти, посчитанной отдельно; ` +
    `паспорт ответа: «${a.passport.shown.top}»; на экране — шапка, сводка раздела «Отбор» и вкладка «Паспорт» пишут «в отборе 5 из ${V}» (от видимых роли); ` +
    `«последние 5» — пять наименьших (от ${sp(asc[0].debt_main)}); по «заёмщику» отказано словами; ` +
    `«топ 0» снимает строку; черновик хранит наборы и «топ N»`);
})();

/* ---------- H. Зеркало реестра статистики: все показатели и разрезы объекта (ОЧ-Д3, §3 п. 2; ПВ-15) ---------- */
(() => {
  /* Реестр — из самого макета статистики: его <script> исполняется в своей песочнице, наружу — только REGISTRY. */
  const stSrc = readFileSync(resolve(__dir, '../../mockups/statistics/statistics.html'), 'utf8');
  const sb2 = { window: {}, console, document: undefined, setTimeout: () => {}, clearTimeout: () => {} };
  vm.createContext(sb2);
  vm.runInContext(stSrc.match(/<script>([\s\S]*)<\/script>/)[1] + '\n;globalThis.__REG = REGISTRY;', sb2, { filename: 'statistics.inline.js' });
  const REG = sb2.__REG || [];
  const OBJ = { credit:'obj-credit', borrower:'obj-borrower', collateral:'obj-collateral', claim:'obj-claim', app:'obj-app' };
  const FN = { sum:'сумма', count:'количество', avg:'среднее', max:'максимум', min:'минимум' };
  const same = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
  const lines = [], bad = [], nulls = [];
  Object.keys(OBJ).forEach(o => {
    const R = REG.filter(r => r.obj === OBJ[o] || (r.obj === '*' && r.id === 'a-count'));
    const rAgg = R.filter(r => r.kind === 'показатель' && r.src === 'агрегат'), rMeas = R.filter(r => r.kind === 'показатель' && r.src !== 'агрегат');
    const rCut = R.filter(r => r.kind === 'разрез');
    KB.seed(); KB.setObject(o); S().cuts = [];
    const st = KB.statsAvail(), fl = KB.fields().fields, cu = KB.cutsAvail();
    const sReg = st.map(x => x.reg).filter(Boolean), fReg = fl.map(x => x.reg).filter(Boolean), cReg = cu.map(x => x.reg).filter(Boolean);
    st.concat(cu).filter(x => x.reg === null).forEach(x => nulls.push(x.id));
    const ok1 = same(sReg, rAgg.map(r => r.id)) && new Set(sReg).size === sReg.length;
    const ok2 = rMeas.every(r => fReg.indexOf(r.id) !== -1);
    const ok3 = same(cReg, rCut.map(r => r.id)) && new Set(cReg).size === cReg.length;
    /* агрегат стоит над той же мерой и той же функцией, что в реестре; корзины разреза — как объявил реестр */
    const ok4 = rAgg.filter(r => r.over).every(r => { const s = st.find(x => x.reg === r.id), f = s && fl.find(x => x.id === s.over);
      return s && f && f.reg === r.over && (s.agg.split(' ·')[0] === FN[r.fn]); });
    const ok5 = rCut.filter(r => r.buckets).every(r => { const c = cu.find(x => x.reg === r.id); return c && c.buckets && same(Object.keys(c.buckets), r.buckets); });
    if (!(ok1 && ok2 && ok3 && ok4 && ok5)) bad.push(o + ':' + [ok1, ok2, ok3, ok4, ok5].map(Number).join(''));
    lines.push(`${win.KB.fields().name} — агрегатов ${sReg.length}/${rAgg.length}, мер ${rMeas.filter(r => fReg.indexOf(r.id) !== -1).length}/${rMeas.length}, разрезов ${cReg.length}/${rCut.length}`);
  });
  ok(28, REG.length > 300 && !bad.length && nulls.sort().join() === 'c-cur,purpose,s-npl,s-overdue-cnt',
    `конструктор = реестр статистики по объекту (конструктор/реестр): ${lines.join('; ')}; у агрегата та же мера и та же функция, ` +
    `корзины разреза — как в реестре; без пары в реестре (reg:null) — ${nulls.join(', ')}${bad.length ? '; расхождения: ' + bad.join(' ') : ''}`);

  /* Значения стенда на 31.08: корень = суммы по строкам ответа; статьи сходятся в свод. */
  const ART = ['collection', 'charges', 'debt_main', 'accInterest', 'interest', 'accPenalty', 'penalty'];
  const OVR = ['over_collection', 'over_charges', 'over_principal', 'over_accInterest', 'over_interest', 'over_accPenalty', 'over_penalty'];
  const A_ART = ['a-sumcoll', 'a-sumfee', 's-portfolio', 'a-sumaint', 'a-sumint', 'a-sumapen', 'a-sumpen'];
  const A_OVR = ['a-sumocoll', 'a-sumofee', 'a-sumodebt', 'a-sumoaint', 'a-sumoint', 'a-sumoapen', 'a-sumopen'];
  const sum = (rs, f) => rs.reduce((s, r) => s + (r[f] || 0), 0);
  const sp = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  KB.seed(); KB.setDrill(true);
  /* Средняя по сроку — по строкам, где срок есть: спорный — у спорных, просрочка заёмщика — у просроченных. */
  const avgPos = (rs, f) => { const l = rs.filter(r => r[f] > 0); return l.length ? sum(l, f) / l.length : null; };
  S().stats = ['a-sumtotal', 's-overdue-sum', 'a-sumcurr', 'a-maxodays', 'a-sumissued', 'a-avgddays'].concat(A_ART, A_OVR); S().cuts = [];
  const a = KB.answer(), rows = KB.rowsShown(), v = a.root.values;
  const rowsOk = rows.every(r => r.total === ART.reduce((s, f) => s + r[f], 0) && r.overdue === OVR.reduce((s, f) => s + r[f], 0) &&
    r.current === r.total - r.overdue && r.current >= 0 && OVR.every((f, i) => r[f] >= 0 && r[f] <= r[ART[i]]) &&
    ['flowIssued', 'flowRepaid', 'flowInterest', 'flowPenalty', 'flowFees', 'flowRecovery', 'flowWrittenOff', 'fx'].every(f => r[f] >= 0) &&
    r.days >= 0 && r.disputedDays >= 0 && r.flowIssued === r.sum);
  const vArt = A_ART.reduce((s, id) => s + v[id], 0), vOvr = A_OVR.reduce((s, id) => s + v[id], 0);
  KB.setAsOf('2026-07-31'); const j = KB.answer(), jr = KB.rowsShown();
  KB.seed(); KB.setObject('borrower'); KB.setDrill(true); S().stats = ['a-sumbtotal', 'a-sumbover', 's-b-count', 'a-avgbtenure', 'a-avgbodays']; S().cuts = [];
  const b = KB.answer(), br = KB.rowsShown();
  KB.seed(); KB.setObject('collateral'); KB.setDrill(true); S().stats = ['a-sumcdeals', 'a-mincnext', 'a-avgcreval']; S().cuts = [];
  const z = KB.answer(), zr = KB.rowsShown();
  ok(29, a.ok && rows.length === 47 && rowsOk && v['a-sumtotal'] === sum(rows, 'total') && v['a-sumodebt'] === sum(rows, 'over_principal') &&
        v['a-maxodays'] === Math.max(...rows.map(r => r.days)) && v['a-sumissued'] === sum(rows, 'sum') &&
        v['a-avgddays'] > 0 && Math.abs(v['a-avgddays'] - avgPos(rows, 'disputedDays')) < 1e-9 &&
        vArt === v['a-sumtotal'] && vOvr === v['s-overdue-sum'] && v['a-sumcurr'] === v['a-sumtotal'] - v['s-overdue-sum'] &&
        j.ok && jr.length === 45 && j.root.values['a-sumtotal'] === sum(jr, 'total') && j.root.values['a-sumtotal'] !== v['a-sumtotal'] &&
        b.ok && b.root.values['a-sumbtotal'] === sum(br, 'btotal') && b.root.values['a-sumbtotal'] === v['a-sumtotal'] &&
        b.root.values['a-sumbover'] === v['s-overdue-sum'] && b.root.values['s-b-count'] === br.length &&
        Math.abs(b.root.values['a-avgbtenure'] - sum(br, 'btenure') / br.length) < 1e-9 &&
        Math.abs(b.root.values['a-avgbodays'] - avgPos(br, 'worst')) < 1e-9 &&
        z.ok && z.root.values['a-sumcdeals'] === sum(zr, 'deals') && z.root.values['a-mincnext'] === Math.min(...zr.map(r => r.next)) &&
        Math.abs(z.root.values['a-avgcreval'] - sum(zr, 'reval') / zr.length) < 1e-9,
    `на 31.08 по ${rows.length} кредитам: задолженность всего ${sp(v['a-sumtotal'])} = семь статей остатка (${sp(vArt)}); просрочено по семи ` +
    `статьям ${sp(vOvr)} = «Сумма просроченной задолженности» ${sp(v['s-overdue-sum'])}, из них ОД ${sp(v['a-sumodebt'])}; срочно ${sp(v['a-sumcurr'])}; ` +
    `худшая просрочка ${v['a-maxodays']} дн.; средний спорный срок ${Math.round(v['a-avgddays'])} дн. — по спорным; каждая строка сходится сама; на 31.07 — ${jr.length} кредитов, ${sp(j.root.values['a-sumtotal'])}; ` +
    `заёмщики (${br.length}) — портфель тех же договоров: ${sp(b.root.values['a-sumbtotal'])}, просрочено ${sp(b.root.values['a-sumbover'])}; ` +
    `залог: договоров ${z.root.values['a-sumcdeals']}, до планового обследования наименьшее ${z.root.values['a-mincnext']} дн. (наибольшая ` +
    `просрочка контроля), с переоценки в среднем ${z.root.values['a-avgcreval'].toFixed(1).replace('.', ',')} дн. — всё равно счёту по строкам ответа`);

  /* Списки «＋ Показатель» и «＋ Разрез» в «Составе» (КН-8) — весь реестр объекта группами с числом в группе и поиском; выбранное с ✓, недоступное серым с причиной.
     Поиск живёт в самом списке (RP.pvPickQ прячет пункты и пересчитывает число в группе) и в вопрос не входит. */
  const count = (h, re) => (h.match(re) || []).length;
  S().started = true;
  const pickOf = (h, label) => { const i = h.indexOf('<summary class="btn btn-secondary btn-sm">' + label + '</summary>'); return h.slice(i, h.indexOf('</details>', i)); };
  const itemsOf = p => count(p, /<button class="mi(?: on| off)?"/g);
  const grpsOf = p => (p.match(/<div class="pick-g">[^<]*<span class="n">\d+<\/span><\/div>/g) || []).map(x => x.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  /* Список без браузера: разметку списка разбираем в пункты и группы с теми же полями, что читает RP.pvPickQ. */
  const fakeMenu = p => { const groups = (p.match(/<div class="pick-grp">[\s\S]*?(?=<div class="pick-grp">|<div class="pick-none")/g) || []).map(g => {
      const cnt = { textContent: (g.match(/<span class="n">(\d+)<\/span>/) || [])[1] };
      const btns = (g.match(/<button class="mi[^"]*"[^>]*data-t="[^"]*"/g) || []).map(b => ({ hidden: false, dataset: { t: b.match(/data-t="([^"]*)"/)[1] } }));
      return { hidden: false, cnt, btns, querySelectorAll: () => btns, querySelector: () => cnt }; });
    const none = { hidden: true };
    return { groups, none, querySelectorAll: () => groups, querySelector: sel => sel === '.pick-none' ? none : null }; };
  const find = (p, q) => { const m = fakeMenu(p); win.RP.pvPickQ({ value: q, parentNode: m });
    return { shown: [].concat(...m.groups.map(g => g.btns.filter(b => !b.hidden).map(b => b.dataset.t))), groups: m.groups.filter(g => !g.hidden), none: !m.none.hidden }; };
  KB.seed(); S().started = true;
  const hp = win.VIEWS.draft.fn(), ps = pickOf(hp, '＋ Показатель'), pc = pickOf(hp, '＋ Разрез');
  const f1 = find(ps, 'пен'), fAll = find(ps, ''), fNo = find(ps, 'ничего-такого');
  const penAll = fAll.shown.filter(t => t.indexOf('пен') !== -1);
  KB.search('пен');
  const sel = ['Сумма просроченной задолженности', 'Кредитов с просрочкой'];
  const keep = KB.answer().ok && KB.saveDraft('С поиском').ok && !('q' in S().drafts[0].comp) && S().stats.join() === 's-overdue-sum,s-overdue-cnt';
  const f2 = find(pc, 'фактор'), cAll = find(pc, '');
  KB.setObject('claim'); const qGone = S().q === '' && S().qCut === '';
  ok(30, itemsOf(ps) === 42 && grpsOf(ps).length === 9 && count(ps, /<button class="mi on"/g) === 2 && count(ps, /<button class="mi off" disabled/g) === 1 &&
        has(ps, '<div class="pick-g">статьи — остаток <span class="n">7</span></div>') && has(ps, '<div class="pick-g">статьи — просрочено <span class="n">7</span></div>') &&
        has(ps, '<div class="pick-g">свод <span class="n">3</span></div>') && has(ps, '<div class="pick-g">неплатёж <span class="n">6</span></div>') &&
        has(ps, '<div class="pick-g">потоки <span class="n">9</span></div>') && has(ps, '<div class="pick-g">обеспечение <span class="n">3</span></div>') &&
        has(ps, 'placeholder="поиск" oninput="RP.pvPickQ(this)"') && has(ps, '✓ Сумма просроченной задолженности') && has(ps, '✓ Кредитов с просрочкой') &&
        has(ps, 'data-t="доля проблемных кредитов" title="выведен 12.08') && has(ps, '<small>выведен 12.08') && has(ps, 'class="pick-none" hidden') &&
        f1.shown.length === penAll.length && penAll.length > 0 && f1.shown.every(t => /пен/i.test(t)) && f1.groups.every(g => g.btns.some(b => !b.hidden)) &&
        f1.groups.reduce((n, g) => n + Number(g.cnt.textContent), 0) === f1.shown.length && f1.groups.length < 9 && !f1.none && fNo.none && fAll.shown.length === 42 &&
        keep &&
        itemsOf(pc) === 27 && grpsOf(pc).join('|') === 'поля объекта 11|состояние на дату 3|расчёт владельца 4|через связанный объект 1|признаки риска 8' &&
        count(pc, /<button class="mi on"/g) === 2 && count(pc, /<button class="mi off" disabled/g) === 1 && has(pc, '✓ состояние кредита') && has(pc, '✓ срок неплатежа') &&
        has(pc, 'data-t="целевое назначение" title="в реестре статистики не объявлен') &&
        f2.shown.length === 8 && f2.shown.every(t => t.indexOf('фактор риска') === 0) && f2.groups.length === 1 && Number(f2.groups[0].cnt.textContent) === 8 && cAll.shown.length === 27 &&
        !has(hp, '<h3>Показатели') && !has(hp, 'pal-g') && !has(hp, 'id="addCut"') && qGone,
    `кредит: «＋ Показатель» — ${itemsOf(ps)} пунктов в ${grpsOf(ps).length} группах реестра с числом в группе (${grpsOf(ps).join(', ')}), выбранные с ✓ (2), «доля проблемных кредитов» серым с причиной «выведен 12.08 …»; ` +
    `поиск «пен» оставил ${f1.shown.length} из ${fAll.shown.length} в ${f1.groups.length} группах, число в группе пересчитано; «＋ Разрез» — ${itemsOf(pc)} в ${grpsOf(pc).length} группах (${grpsOf(pc).join(', ')}), ` +
    `два с ✓, «целевое назначение» серым с причиной; поиск «фактор» — ${f2.shown.length} признаков риска одной группой; поиск в вопрос не входит (черновик без него), смена объекта его сбрасывает`);

  /* ПВ-15: общий стартовый отчёт «Заявки по программам и статусам». */
  KB.seed();
  const p = KB.startFrom('p-apps'); KB.setDrill(true);
  const q = KB.answer(), qr = KB.rowsShown(), qv = q.root.values;
  const nodes = []; const walk = n => { nodes.push(n); (n.children || []).forEach(walk); }; walk(q.root);
  const prog = q.root.children.map(n => n.key).join('|');
  const stOk = q.root.children.every(n => { const ks = n.children.map(c => c.key), d = ['на рассмотрении', 'требуется доп. информация', 'одобрена', 'оформлена', 'отклонена'];
    return ks.every((k, i) => i === 0 || d.indexOf(ks[i - 1]) < d.indexOf(k)); });
  const live = KB.setMode('сейчас');
  KB.setAsOf('2026-07-31'); const qj = KB.answer();
  ok(31, p.ok && S().object === 'app' && S().cuts.map(c => c.id).join() === 'd-aprogram,d-astatus' && S().stats.length === 4 && S().active === null &&
        q.ok && q.root.count === 19 && q.hidden === 5 && qr.length === 19 && qv['s-app-count'] === 19 &&
        qv['a-sumaamount'] === sum(qr, 'amount') && qv['a-sumaapproved'] === sum(qr, 'approved') &&
        nodes.every(n => n.values['a-sumaamount'] >= n.values['a-sumaapproved']) && qv['a-maxadays'] === Math.max(...qr.map(r => r.days)) &&
        prog === 'Промышленность|Агропереработка|Экспорт|Малый бизнес' && stOk && !live.ok && has(live.why, 'objectRows') &&
        qj.ok && qj.root.count === 19 && qj.hidden === 3,
    `«${S().name}»: заявка, уровни программа → статус (порядок справочников), четыре показателя; на 31.08 заявок ${q.root.count} ` +
    `(скрыто ${q.hidden}), запрошено ${sp(qv['a-sumaamount'])} ≥ одобрено ${sp(qv['a-sumaapproved'])} в каждом узле, наибольший срок ` +
    `рассмотрения ${qv['a-maxadays']} дн. = максимум по строкам; «сейчас» заявке недоступен; доля «одобрено / запрошено» — встроенным ` +
    `расчётом при показе, у конструктора формул нет`);
})();

/* ОЧ-Д7: категория риска — пять подписей классификатора из реестра статистики, в его порядке; у кредита — по ступени
   дней просрочки (допущение стенда), у заёмщика — худшая из категорий его кредитов на ту же дату. */
(() => {
  const stSrc = readFileSync(resolve(__dir, '../../mockups/statistics/statistics.html'), 'utf8');
  const sb3 = { window: {}, console, document: undefined, setTimeout: () => {}, clearTimeout: () => {} };
  vm.createContext(sb3);
  vm.runInContext(stSrc.match(/<script>([\s\S]*)<\/script>/)[1] + '\n;globalThis.__RISK = REF.risk;', sb3, { filename: 'statistics.inline.js' });
  const vals = sb3.__RISK.versions[0].values;
  const reg = Object.keys(vals).sort((a, b) => vals[a].ord - vals[b].ord).map(k => vals[k].lbl);
  const dictOf = name => { const x = src.match(new RegExp('\\n  ' + name + ': \\[([^\\]]*)\\]')); return x ? x[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')) : []; };
  const same = (a, b) => a.join('|') === b.join('|');
  const band = d => d === 0 ? 0 : d <= 30 ? 1 : d <= 90 ? 2 : d <= 180 ? 3 : 4;
  KB.seed(); KB.setDrill(true); S().stats = ['s-count']; S().cuts = [{ id:'d-category', bucket:null, total:true }];
  const c = KB.answer(), cr = KB.rowsShown();
  const crOk = cr.length === 47 && cr.every(r => r.category === reg[band(r.days)]);
  const cKeys = c.root.children.map(n => n.key);
  KB.seed(); KB.setObject('borrower'); KB.setDrill(true); S().stats = ['s-b-count']; S().cuts = [{ id:'b-risk', bucket:null, total:true }];
  const b = KB.answer(), br = KB.rowsShown();
  const worst = id => reg[Math.max(...cr.filter(x => x.borrowerId === id).map(x => reg.indexOf(x.category)))];
  const brOk = br.length === 16 && br.every(r => r.risk === worst(r.id));
  const bKeys = b.root.children.map(n => n.key);
  const ordered = ks => ks.every(k => reg.indexOf(k) !== -1) && ks.every((k, i) => i === 0 || reg.indexOf(ks[i - 1]) < reg.indexOf(k));
  ok(32, reg.length === 5 && same(dictOf('risk'), reg) && same(dictOf('category'), reg) && c.ok && same(cKeys, reg) && crOk &&
        b.ok && brOk && ordered(bKeys) && bKeys.length >= 2,
    `категория риска = классификатор реестра статистики: ${reg.join(' · ')}; кредиты (${cr.length}) на 31.08 — по ступени дней ` +
    `0 · 1–30 · 31–90 · 91–180 · 181+, дерево кредита — все пять узлов в порядке реестра; заёмщики (${br.length}) — худшая категория ` +
    `их кредитов: ${b.root.children.map(n => n.key + ' ' + n.count).join(', ')}`);
})();

/* ---------- I. Волна 61: экран «Конструктор» на рамке экрана показа (КН-1…КН-17) ---------- */
/* Экран читаем разметкой VIEWS.draft.fn(): с S().started — рамка (полоса, лист, панель), без него — стартовый экран.
   Роль по умолчанию — пользователь (Осмонова: видно 47, скрыто 3); fresh(роль) сбрасывает и витрину, и состав конструктора.
   chk(№, {условие: истина…}, текст) — одна проверка, у упавшей в строку вывода попадают названия несошедшихся условий. */
(() => {
  const RP = win.RP, scr = () => win.VIEWS.draft.fn();
  const fresh = (role = 'user') => { RP.seed(); RP.state.role = roleTitle(role); KB.seed(); S().started = true; };
  const chk = (n, conds, note) => { const bad = Object.keys(conds).filter(k => !conds[k]); ok(n, !bad.length, note + (bad.length ? ' — НЕ СОШЛОСЬ: ' + bad.join('; ') : '')); };
  const grab = (h, re) => (h.match(re) || [''])[0];
  const count = (h, re) => (h.match(re) || []).length;
  const sp = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const text = h => h.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&gt;/g, '>').replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  const noThrow = f => { try { return f(); } catch (e) { return { ok: false, thrown: String(e) }; } };
  const barOf = h => grab(h, /<div class="pv-bar">[\s\S]*?<\/div><div class="pv-body/);
  const headOf = h => grab(h, /<div class="pv-head">[\s\S]*?<\/div><\/div>/);
  const sideOf = h => grab(h, /<aside[\s\S]*<\/aside>/);
  const secOf = (h, k) => grab(h, new RegExp('<details class="pv-sec" data-sec="' + k + '"[\\s\\S]*?</details></div>'));
  const sumOf = (h, k) => grab(secOf(h, k), /<span class="s">([^<]*)<\/span>/).replace(/<[^>]+>/g, '');
  const l1Of = h => grab(headOf(h), /<div class="l1">[\s\S]*?<\/div>/);
  const l2Of = h => grab(headOf(h), /<div class="l2">[\s\S]*?<\/div>/);
  const stripPick = h => h.replace(/<div class="pick-l">[\s\S]*?<div class="pick-none" hidden>[^<]*<\/div><\/div>/g, '<PICK/>');

  /* --- КН-1, КН-4, КН-6: рамка экрана показа и шапка в две строки --- */
  fresh();
  const h1 = scr(), hd = headOf(h1), l1 = l1Of(h1), l2 = l2Of(h1);
  chk(33, {
    'рамка: полоса, тело, центр, шапка, лист': h1.startsWith('<div class="pv kb"><div class="pv-bar">') && has(h1, '<div class="pv-body"><div class="pv-center"><div class="pv-head">') && has(h1, '<div class="pv-sheet">'),
    'под листом ничего, справа панель': has(h1, '</table></div></div></div><aside class="sp pv-side kb-side" id="kbSide">') && h1.endsWith('</aside></div></div>'),
    'шапка — две строки': count(hd, /class="l[12]"/g) === 2,
    'первая строка': has(l1, '<span class="nb">Черновик — не выпуск</span>') && has(l1, '<b>Просрочка по ступеням</b>') && has(l1, 'личный, не сохранён') && has(l1, 'кредит') &&
      has(l1, '<span class="when">на 31.08.2026 (5 дней назад)</span>') && has(l1, 'не зафиксировано'),
    'вторая строка: охват, отбор, область, «смотрит», «паспорт →»': has(l2, 'охват: видно 47 кредитов, скрыто 3') && has(l2, 'без отбора') && has(l2, 'область видимости: Отраслевой департамент промышленности') &&
      has(l2, 'смотрит Осмонова Г.') && has(l2, '<a href="#" class="lnk" onclick="KB.ui.show(\'паспорт\');return false">паспорт →</a>'),
    'фишки «Осмонова Г. · пользователь» нет, старых заголовков карточек нет': !has(h1, 'Осмонова Г. · пользователь') && !has(h1, 'pv-cap') && count(h1, /<h3>/g) === 0
  }, `рамка экрана показа: полоса, лист в центре, панель справа, под листом ничего; шапка — две строки: первая «${text(l1).trim()}», вторая «${text(l2).trim()}»; фишки «Осмонова Г. · пользователь» нет`);

  /* --- КН-5: панель — вкладки «Настройки · Паспорт», пять разделов, открыт один «Состав», раскрываются независимо --- */
  const side = sideOf(h1);
  const tabs = (side.match(/<button role="tab" data-tab="[^"]*"[^>]*>[^<]*<\/button>/g) || []).map(x => text(x).trim());
  const secs = h => (stripPick(sideOf(h)).match(/<details class="pv-sec"[^>]*>\s*<summary><span class="t">[^<]*<\/span>/g) || [])
    .map(x => ({ k: x.match(/data-sec="([^"]*)"/)[1], t: x.match(/<span class="t">([^<]*)/)[1], open: /\sopen>/.test(x) }));
  const s0 = secs(h1), sums = ['очём', 'состав', 'раскладка', 'время', 'отбор'].map(k => sumOf(h1, k));
  KB.ui.sec('очём', true); const s1 = secs(scr()); KB.ui.sec('состав', false); const s2 = secs(scr());
  KB.ui.sec('очём', false); KB.ui.sec('состав', true);
  KB.toggleStat('s-count'); const sum3 = sumOf(scr(), 'состав'); KB.toggleStat('s-count');
  KB.ui.panel(false); const hHide = scr(); KB.ui.panel(true);
  chk(34, {
    'две вкладки': tabs.join('|') === 'Настройки|Паспорт',
    'пять разделов по порядку': s0.map(x => x.t).join('|') === 'О чём|Состав|Раскладка|Время|Отбор',
    'при входе открыт только «Состав»': s0.filter(x => x.open).map(x => x.k).join() === 'состав',
    'раскрываются независимо': s1.filter(x => x.open).map(x => x.k).join() === 'очём,состав' && s2.filter(x => x.open).map(x => x.k).join() === 'очём',
    'свёрнутый повторяет выбранное': sums.join('|') === 'кредит|срок неплатежа → состояние кредита · 2 показателя|показатели в колонках|на 31.08.2026|без отбора' &&
      sum3 === 'срок неплатежа → состояние кредита · 3 показателя',
    'скрытая панель — язычок со сводкой': has(hHide, 'class="pv-body noside"') && has(hHide, '⚙ Настройки') && has(hHide, 'срок неплатежа → состояние кредита · 2 показателя')
  }, `панель: вкладки «${tabs.join(' · ')}»; разделы «${s0.map(x => x.t).join(' · ')}», при входе открыт «${s0.filter(x => x.open).map(x => x.t).join(', ')}»; раскрываются независимо; свёрнутый повторяет выбранное: ` +
    `«${sums.join('» · «')}»; скрытая панель — язычок «⚙ Настройки» со сводкой`);

  /* --- КН-3: полоса --- */
  fresh();
  const b1 = barOf(scr()), restartN = count(b1, /KB\.ui\.preset\(/g), offs = count(b1, /<span class="mi off" title="Сначала сохраните отчёт\.">/g);
  const sv0 = KB.saveDraft('Полоса'), b2 = barOf(scr()), tx1 = text(scr());
  chk(35, {
    'слева поле «Черновик» с именем': has(b1, '<label class="pv-f kb-name"><span>Черновик</span><input id="kbName" value="Просрочка по ступеням"'),
    '«Начать заново ▾»: с нуля, заготовки, «С готового отчёта…»': has(b1, 'Начать заново ▾') && has(b1, 'С нуля') && restartN === KB.presets().length && has(b1, 'С готового отчёта…'),
    'справа «Выгрузить ▾»: xlsx, pdf': has(b1, 'Выгрузить ▾') && has(b1, "KB.ui.export('xlsx')") && has(b1, "KB.ui.export('pdf')"),
    '«В рабочий список», «⋯», «Сохранить» по порядку': has(b1, 'В рабочий список') && has(b1, '<summary class="btn btn-secondary btn-sm" title="ещё действия">⋯</summary>') &&
      has(b1, '<button class="btn btn-primary btn-sm" id="kbSave" onclick="KB.ui.save()">Сохранить</button>') && b1.indexOf('Выгрузить ▾') < b1.indexOf('⋯') && b1.indexOf('⋯') < b1.indexOf('id="kbSave"'),
    'без сохранения три пункта «⋯» серые': offs === 3 && has(b1, '📌 На дашборд…') && has(b1, 'Открыть кругу…') && has(b1, 'Отдать на утверждение…') && !has(b1, 'KB.ui.pin()'),
    'после сохранения пункты живые': sv0.ok && has(b2, 'KB.ui.pin()') && has(b2, 'KB.ui.circle()') && has(b2, 'KB.ui.ask()') && !has(b2, 'Сначала сохраните отчёт.'),
    'отказов «выпустить окончательно» и «утвердить» на экране нет': !/выпустить окончательно/i.test(tx1) && !/Утвердить/.test(tx1) && !/окончательн/i.test(tx1)
  }, `полоса: слева «Черновик [имя]» и «Начать заново ▾» (с нуля, ${restartN} заготовок, «С готового отчёта…»), справа «Выгрузить ▾» (xlsx, pdf) · «В рабочий список» · «⋯» · «Сохранить» — главная; ` +
    `без сохранения три пункта «⋯» серые «Сначала сохраните отчёт.» (${offs}), после — живые (📌, «Открыть кругу…», «Отдать на утверждение…»); отказов «выпустить окончательно» и «утвердить» на экране нет`);

  /* --- КН-14: причина отказа — у своего пункта полосы --- */
  fresh(); KB.setAsOf('2026-09-05'); const bGap = barOf(scr());
  fresh(); KB.setMode('сейчас'); const bNow = barOf(scr());
  fresh(); KB.startBlank('credit'); const bNone = barOf(scr());
  fresh(); const bNoRows = barOf(scr());
  KB.setDrill(true); const bRows = barOf(scr()); KB.ui.worklist(); const wlMade = S().worklists.length;
  chk(36, {
    'нет снимка — «На 05.09.2026 чисел нет.» у пунктов': has(bGap, 'class="pv-dd off"') && count(bGap, /title="На 05\.09\.2026 чисел нет\."/g) >= 3,
    '«сейчас» без расчёта — «Сначала «Посчитать».»': has(bNow, '<div class="mi-note">Сначала «Посчитать».</div>'),
    'нет показателя — «Добавьте показатель.»': has(bNone, '<div class="mi-note">Добавьте показатель.</div>') && count(bNone, /<span class="mi off" title="Добавьте показатель\.">/g) === 2,
    '«В рабочий список» без строк — причина': has(bNoRows, 'kb-wl off') && has(bNoRows, '<div class="mi-note">Нужны строки объектов: в «Составе» — «печатать строки».</div>'),
    'со строками — название и кнопка, список заведён': has(bRows, 'id="kbWlName"') && has(bRows, 'KB.ui.worklist()') && !has(bRows, 'kb-wl off') && wlMade === 1
  }, `причина — у своего пункта, серым: нет снимка — «На 05.09.2026 чисел нет.», «сейчас» без расчёта — «Сначала «Посчитать».», нет показателя — «Добавьте показатель.»; «В рабочий список» без строк объектов — ` +
    `«Нужны строки объектов: в «Составе» — «печатать строки».»; со строками — название списка и кнопка, список заведён (${wlMade}) в данных конструктора`);

  /* --- КН-2: стартовый экран «Новый отчёт» --- */
  const OBJS = ['credit', 'borrower', 'collateral', 'claim', 'asset', 'offer', 'app'];
  const regCount = OBJS.map(o => { KB.seed(); KB.setObject(o); return { o, name: KB.fields().name, ns: KB.statsAvail().length, nc: KB.cutsAvail().length + S().cuts.length }; });
  fresh(); S().started = false;
  const st1 = scr(), objsOf = h => [...h.matchAll(/<button class="kb-obj( on)?" onclick="KB\.ui\.startObj\('(\w+)'\)"><b>([^<]*)<\/b><small>(\d+) [а-я]+ · (\d+) [а-я]+<\/small><\/button>/g)]
    .map(m => ({ on: !!m[1], o: m[2], name: m[3], ns: +m[4], nc: +m[5] }));
  const so = objsOf(st1), credPre = KB.presets().filter(p => p.object === 'credit');
  KB.ui.startObj('claim'); const stClaim = scr(); KB.ui.startObj('credit');
  KB.ui.startFind({ value: 'просроч' }); const stFound = scr(), rr = KB.readyReports('просроч');
  KB.ui.startFind({ value: 'нет-такого-отчёта' }); const stNone = scr(); KB.ui.startFind({ value: '' });
  fresh(); S().started = false; KB.startBlank('credit'); S().started = false; const stClean = scr();
  const grpN = (h, g) => +((grab(h, new RegExp('<div class="kb-fg">' + g + ' <span>\\d+</span>')).match(/\d+(?=<\/span>)/) || [0])[0]);
  chk(37, {
    'экран без шапки, панели и листа': has(st1, '<div class="pv kb kb-home">') && has(st1, '<div class="kb-start"><h2>Новый отчёт</h2>') && !has(st1, 'pv-head') && !has(st1, 'id="kbSide"') && !has(st1, 'pv-body'),
    'в полосе пустое имя и «Сохранить» недоступна': has(st1, '<input id="kbName" value="" placeholder="новый отчёт"') && has(st1, '<button class="btn btn-primary btn-sm" id="kbSave" disabled>Сохранить</button>'),
    'семь объектов, выбран кредит': so.length === 7 && so.map(x => x.o).join() === OBJS.join() && so.filter(x => x.on).map(x => x.o).join() === 'credit',
    'числа показателей и разрезов как в реестре': so.every((x, i) => x.ns === regCount[i].ns && x.nc === regCount[i].nc && x.name.toLowerCase() === regCount[i].name.toLowerCase()),
    '«Собрать с нуля» главная': has(st1, '<button class="btn btn-primary btn-sm" onclick="KB.ui.blank()">Собрать с нуля</button>'),
    'заготовки выбранного объекта': credPre.length === 2 && credPre.every(p => has(st1, "KB.ui.preset('" + p.id + "')") && has(st1, '>' + p.name + '</button>')) && !has(st1, "KB.ui.preset('p-pledge')"),
    'у объекта без заготовок — слова': has(stClaim, 'у этого объекта заготовок нет'),
    'поле поиска «С готового отчёта»': has(st1, '<span class="k">С готового отчёта</span>') && has(st1, 'id="kbStartQ"') && has(st1, 'placeholder="найти отчёт: название, код формы, показатель"'),
    'найденные — группами мои · общие · официальные': rr.mine.length > 0 && rr.shared.length > 0 && rr.official.length > 0 && grpN(stFound, 'Мои') === rr.mine.length &&
      grpN(stFound, 'Общие') === rr.shared.length && grpN(stFound, 'Официальные') === rr.official.length &&
      count(stFound, /class="kb-fr"/g) === Math.min(6, rr.mine.length) + Math.min(6, rr.shared.length) + Math.min(6, rr.official.length) &&
      has(stFound, "KB.ui.fromReport('" + rr.official[0].id + "')"),
    'без совпадений — «Ничего не найдено.»': has(stNone, '<div class="kb-fnone">Ничего не найдено.</div>'),
    'строка «Не сохранён с прошлого раза … продолжить … отбросить»': has(st1, '<div class="kb-cont">Не сохранён с прошлого раза: <a href="#" class="lnk" onclick="KB.ui.cont();return false"><b>«Просрочка по ступеням»</b> — продолжить</a>') &&
      has(st1, '04.09, 17:40') && has(st1, 'KB.ui.discard()') && has(st1, '>отбросить</a>'),
    'у чистого черновика строки нет': !has(stClean, 'kb-cont')
  }, `стартовый экран на месте листа: «О чём отчёт» — 7 карточек с числом показателей и разрезов реестра (кредит ${regCount[0].ns}·${regCount[0].nc}, заёмщик ${regCount[1].ns}·${regCount[1].nc}, ` +
    `предмет залога ${regCount[2].ns}·${regCount[2].nc}, требование ${regCount[3].ns}·${regCount[3].nc}, имущество ${regCount[4].ns}·${regCount[4].nc}, предложение ${regCount[5].ns}·${regCount[5].nc}, ` +
    `заявка ${regCount[6].ns}·${regCount[6].nc}); «Собрать с нуля», заготовки выбранного объекта (кредит — ${credPre.length}); поиск «С готового отчёта» («просроч»: мои ${rr.mine.length} · общие ${rr.shared.length} · ` +
    `официальные ${rr.official.length}); внизу «Не сохранён с прошлого раза … продолжить · 04.09, 17:40 · отбросить»`);

  /* --- КН-2: «Собрать с нуля», «Собрать отчёт» на витрине, «продолжить», «отбросить» --- */
  fresh(); S().started = false; KB.ui.startName({ value: 'Свой отчёт' }); KB.ui.blank('credit');
  const hBlank = scr(), blank = { started: S().started, stats: S().stats.length, cuts: S().cuts.length, name: S().name };
  fresh(); KB.startBlank('claim'); const blObj = S().object;
  fresh(); RP.state.view = 'x'; RP.kbNew(); const hNew = scr(), kn = { started: S().started, view: RP.state.view };
  KB.ui.cont(); const cont = { started: S().started, stats: S().stats.join() };
  fresh(); KB.toggleStat('s-count'); KB.ui.toStart(); const toS = { started: S().started, at: S().at, cont: has(scr(), 'KB.ui.cont()') };
  KB.ui.discard(); const dis = { started: S().started, stats: S().stats.length, hash: S().savedHash, cont: has(scr(), 'kb-cont') };
  fresh(); KB.saveDraft('Сохранённый'); KB.moveStat('s-overdue-sum', 1); KB.ui.toStart(); const hDirty = scr(); KB.ui.discard();
  const disSaved = { started: S().started, stats: S().stats.join(), same: S().savedHash === KB.savedKey(), cont: has(scr(), 'kb-cont') };
  chk(38, {
    '«Собрать с нуля»: рамка без показателей и разрезов, имя из поля': blank.started === true && blank.stats === 0 && blank.cuts === 0 && blank.name === 'Свой отчёт' && has(hBlank, 'class="pv kb"') && has(hBlank, '<b>Свой отчёт</b>'),
    'объект с нуля — выбранный': blObj === 'claim',
    'на месте листа «Добавьте показатель.» с кнопкой': has(hBlank, '<div class="pv-none"><b>Добавьте показатель.</b>') && has(hBlank, "KB.ui.sec('состав',true);KB.ui.show('настройки')\">＋ Показатель</button>") &&
      has(hBlank, 'без разрезов · 0 показателей') && !has(hBlank, '<table'),
    'RP.kbNew — стартовый экран': kn.started === false && kn.view === 'draft' && has(hNew, 'class="kb-start"') && !has(hNew, 'pv-head'),
    '«продолжить» возвращает рамку': cont.started === true && cont.stats === 's-overdue-sum,s-overdue-cnt',
    '«С готового отчёта…» уходит на стартовый экран, время правки в строке': toS.started === false && toS.at === '2026-09-05 14:32' && toS.cont,
    '«отбросить» у нового — очищено': dis.started === false && dis.stats === 0 && dis.hash === null && !dis.cont,
    '«отбросить» у сохранённого с правкой — вернулась запись': has(hDirty, '«Сохранённый»') && has(hDirty, 'kb-cont') && disSaved.started === false &&
      disSaved.stats === 's-overdue-sum,s-overdue-cnt' && disSaved.same && !disSaved.cont
  }, `«Собрать с нуля» — сразу рамка без показателей и разрезов, имя из поля стартового экрана, на месте листа «Добавьте показатель.» с кнопкой «＋ Показатель» (открывает «Состав»); «Собрать отчёт» на витрине ` +
    `(RP.kbNew) — стартовый экран на экране «draft»; «продолжить» — рамка с тем же составом; «Начать заново → С готового отчёта…» уходит на стартовый экран, несохранённое остаётся строкой с временем; ` +
    `«отбросить»: у нового — очищено, у сохранённого с правкой — вернулась запись витрины`);

  /* --- КН-6: чьими глазами — по «Роль ▾»; закрывает ОЧ-Д9 (охват конструктора = охват экрана показа той же роли) --- */
  const byRole = {};
  ['user', 'auth', 'head'].forEach(r => {
    fresh(r); const a = KB.answer(), l2r = l2Of(scr());
    KB.startFrom('p-apps'); const q = KB.answer();
    const sh = RP.show('t-sh-apps', { asOf: '2026-08-31' }, null).data;
    byRole[r] = { seen: a.root.count, hid: a.hidden, l2: l2r, apps: q.root.count, appsHid: q.hidden, shRows: sh.rows.length, shHid: sh.hidden, me: KB.me() };
  });
  const U = byRole.user, A = byRole.auth, Hd = byRole.head;
  chk(39, {
    'пользователь: видно 47, скрыто 3, «смотрит Осмонова Г.»': U.seen === 47 && U.hid === 3 && has(U.l2, 'охват: видно 47 кредитов, скрыто 3') && has(U.l2, 'смотрит Осмонова Г.') &&
      has(U.l2, 'область видимости: Отраслевой департамент промышленности') && U.me.who === 'Осмонова Г.',
    'уполномоченный: 50 и 0, три подразделения': A.seen === 50 && A.hid === 0 && has(A.l2, 'охват: видно 50 кредитов') && !has(A.l2, 'скрыто') && has(A.l2, 'смотрит Тентимишев К.') &&
      has(A.l2, 'область видимости: 3 подразделения') && has(A.l2, 'title="Департамент администрирования кредитов, Отраслевой департамент промышленности, Региональное представительство «Ош»"') &&
      A.me.who === 'Тентимишев К.' && A.me.scope.length === 3,
    'руководитель: 1 и 49': Hd.seen === 1 && Hd.hid === 49 && has(Hd.l2, 'охват: видно 1 кредит, скрыто 49') && has(Hd.l2, 'смотрит Асанов А.') &&
      has(Hd.l2, 'область видимости: Департамент администрирования кредитов') && Hd.me.who === 'Асанов А.' && Hd.me.scope.join() === 'dep-admin',
    'заявки на 31.08: 19 / 24 / 2': U.apps === 19 && U.appsHid === 5 && A.apps === 24 && A.appsHid === 0 && Hd.apps === 2 && Hd.appsHid === 22,
    'заявки в конструкторе = заявки на экране показа той же роли (число и скрытые)': ['user', 'auth', 'head'].every(r => byRole[r].apps === byRole[r].shRows && byRole[r].appsHid === byRole[r].shHid)
  }, `роль берётся по «Роль ▾»: пользователь — видно 47, скрыто 3, уполномоченный — 50 и 0 (три подразделения), руководитель — 1 и 49; заявки на 31.08 в конструкторе = на экране показа той же роли: ` +
    `пользователь ${U.apps}/${U.shRows} (скрыто ${U.appsHid}/${U.shHid}), уполномоченный ${A.apps}/${A.shRows}, руководитель ${Hd.apps}/${Hd.shRows} — у уполномоченного 24, а не 19 (ОЧ-Д9 закрыт)`);

  /* --- КН-7: «Сохранить» — личный отчёт на витрине «Мои · Своё», виден владельцу, открывается на показе --- */
  fresh(); const n0 = RP.state.templates.length, sv = KB.saveDraft('Моя просрочка'), tid = sv.tid, rec = RP.TPL(tid) || {};
  const mineIds = () => RP.shelves('').mine.map(x => x.id), shelfRow = RP.shelves('').mine.find(x => x.id === tid) || {};
  const others = ['auth', 'head', 'clerk', 'buh'].map(r => { RP.state.role = roleTitle(r);
    return { r, see: RP.maySee(tid), mine: mineIds().indexOf(tid) !== -1, shared: RP.shelves('').shared.some(x => x.id === tid), vis: RP.visibleTemplates().indexOf(tid) !== -1 }; });
  RP.state.role = roleTitle('user');
  const showMine = noThrow(() => RP.show(tid, { asOf: '2026-08-31' }, null));
  const sv2 = KB.saveDraft('Моя просрочка'), n1 = RP.state.templates.length, sv3 = KB.saveDraft('Новое имя');
  chk(40, {
    'запись заведена на витрине': sv.ok && /^t-kb-\d+$/.test(tid) && n0 + 1 === n1 && rec.kind === 'отчёт' && rec.owner === 'Осмонова Г.' && RP.levelOf(tid) === 'личный',
    'состав конструктора — в поле kb, редакция — для показа': rec.kb && rec.kb.comp.stats.join() === 's-overdue-sum,s-overdue-cnt' && rec.kb.view.layout === 'показатели в колонках' &&
      rec.editions.length === 1 && rec.editions[0].state === 'черновик' && rec.editions[0].object === 'credit' && rec.editions[0].stats.join() === 's-overdue-sum,s-overdue-cnt',
    'на полке «Мои» у владельца': shelfRow.name === 'Моя просрочка' && KB.readyReports('').mine.some(x => x.id === tid && x.own === true),
    'другим ролям не видна': others.every(o => !o.see && !o.mine && !o.shared && !o.vis),
    'список черновиков автора — как был': KB.draftsOf('Осмонова Г.').length === 3,
    'на показе открывается без исключений': showMine.ok === true && !showMine.thrown && showMine.kind === 'отчёт' && showMine.data.totals.some(x => x.id === 's-overdue-sum'),
    'повторное «Сохранить» и смена имени — та же запись': sv2.tid === tid && sv3.tid === tid && RP.state.templates.length === n1 && RP.TPL(tid).name === 'Новое имя' &&
      RP.shelves('').mine.some(x => x.id === tid && x.name === 'Новое имя')
  }, `«Сохранить» заводит запись ${tid} в RP.state.templates (владелец Осмонова Г., «личный», состав конструктора — в поле kb), на полке «Мои» у владельца; уполномоченный, руководитель, делопроизводитель, ` +
    `бухгалтер её не видят (${others.map(o => o.r + ': ' + (o.see ? 'видит' : 'нет')).join(', ')}); на показе открывается без исключений (итоги: ${(showMine.data ? showMine.data.totals : []).map(x => x.id).join(', ')}); ` +
    `повторное «Сохранить» и смена имени — та же запись (из конструктора записей: ${RP.state.templates.length - n0})`);

  /* --- КН-7, КН-14: чего показ не знает — строкой «на показе не будет: …»; запись показ открывает для всех объектов, что он считает --- */
  fresh(); const svLost = KB.saveDraft('Со срезом'), noteLost = (S().notices || []).filter(n => /^на показе не будет/.test(n.text)), hLost = scr(), ed = RP.TPL(svLost.tid).editions[0];
  const shows = ['p-late', 'p-pledge', 'p-apps'].map(p => { fresh(); KB.startFrom(p); const r = KB.saveDraft('Заготовка ' + p), t = RP.TPL(r.tid);
    const o = noThrow(() => RP.show(r.tid, { asOf: '2026-08-31' }, null)); return { p, obj: t.editions[0].object, ok: o.ok === true && !o.thrown }; });
  fresh(); KB.addFilter('days', '>', 90); KB.setActive(true); const svSel = KB.saveDraft('С отбором');
  chk(41, {
    'разрез «срок неплатежа» назван, в запись показа не идёт': svLost.ok && svLost.lost.join() === 'разрез «срок неплатежа»' && ed.cuts.join() === 'status' &&
      RP.TPL(svLost.tid).kb.comp.cuts.map(c => c.id).join() === 'late,status',
    'строка «на показе не будет: …» в журнале экрана': noteLost.length === 1 && noteLost[0].kind === 'info' && noteLost[0].text === 'на показе не будет: разрез «срок неплатежа»',
    'и над листом': has(hLost, '<div class="pv-msg info"') && has(hLost, '<b>На показе не будет.</b> Разрез «срок неплатежа».'),
    'отбор конструктора тоже назван': svSel.lost.some(x => /^отбор: /.test(x) && has(x, 'условия отбора') && has(x, '«действующие»')),
    'заготовки кредит · предмет залога · заявка показ открывает': shows.map(x => x.obj).join() === 'credit,obj-collateral,obj-app' && shows.every(x => x.ok)
  }, `то, чего показ не знает, в запись не идёт и называется: «${noteLost[0] ? noteLost[0].text : ''}» (в записи показа — разрез «${ed.cuts.join()}», в составе конструктора — оба уровня); отбор конструктора тоже назван ` +
    `(«${svSel.lost.join('; ')}»); заготовки кредит · предмет залога · заявка, сохранённые отчётом, показ открывает без исключений`);

  /* --- КН-16: «С готового отчёта» — свой личный открывается сам, чужой, общий и официальный — копией; «Править» на витрине --- */
  fresh(); const own = KB.saveDraft('Мой отчёт'), ownTid = own.tid; KB.setView({ chart: true }); KB.saveDraft('Мой отчёт'); KB.startBlank('credit');
  const rOwn = KB.startFromReport(ownTid), hOwn = scr(), ownState = { saved: S().saved, name: S().name, stats: S().stats.join(), chart: S().view.chart, started: S().started };
  KB.startBlank('credit'); const rAlien = KB.startFromReport('t-avg'), alien = { saved: S().saved, name: S().name };
  KB.startBlank('credit'); const rOff = KB.startFromReport('t-overdue'), off = { saved: S().saved, name: S().name };
  KB.startBlank('credit'); const rShared = KB.startFromReport('t-sh-planfact'), shared = { name: S().name, notes: (S().notices || []).map(n => n.text) }, hShared = scr();
  const rBad = KB.startFromReport('t-нет-такого');
  RP.state.role = roleTitle('auth'); const rForeign = KB.startFromReport(ownTid), foreignSees = KB.readyReports('').mine.length; RP.state.role = roleTitle('user');
  KB.startBlank('credit'); RP.state.view = 'x'; RP.uiOpenPersonal(ownTid); const open1 = { view: RP.state.view, saved: S().saved, started: S().started, stats: S().stats.join() };
  RP.state.view = 'x'; RP.uiOpenPersonal('t-avg'); const open2 = RP.state.view;
  chk(42, {
    'свой, собранный здесь, открывается сам — в ту же запись': rOwn.ok && rOwn.own === true && ownState.saved === ownTid && ownState.name === 'Мой отчёт' && ownState.started === true &&
      ownState.stats === 's-overdue-sum,s-overdue-cnt' && ownState.chart === true && has(hOwn, 'личный, сохранён'),
    'чужой личный — копией без записи': rAlien.ok && rAlien.own === false && alien.saved === null && alien.name === 'Копия «Средняя просрочка по департаментам»',
    'официальный — копией': rOff.ok && rOff.own === false && off.saved === null && off.name === 'Копия «Просроченная задолженность по состоянию на 1-е число»' && rOff.lost.length === 0,
    'общий с непринятым — три строки «Не принято: …»': rShared.ok && rShared.own === false && rShared.lost.length === 3 && shared.name === 'Копия «План и факт выдачи»' &&
      shared.notes.join('|') === 'Не принято: показатель «План выдачи» — в реестре конструктора его нет|Не принято: показатель «Выдано с начала года» — в реестре конструктора его нет|Не принято: своя формула «Исполнение плана»',
    'строки «Не принято» над листом, шапка «не сохранён»': count(hShared, /<div class="pv-msg warn"/g) === 3 && has(hShared, '<b>Не принято.</b> Показатель «План выдачи» — в реестре конструктора его нет.') && has(hShared, '<b>Не принято.</b> Своя формула «Исполнение плана».') && has(hShared, 'личный, не сохранён'),
    'несуществующий и чужой личный не открыть': !rBad.ok && has(rBad.why, 'вам не видно') && !rForeign.ok && foreignSees === 0,
    '«Править» у записи из конструктора открывает конструктор': open1.view === 'draft' && open1.saved === ownTid && open1.started === true && open1.stats === 's-overdue-sum,s-overdue-cnt',
    'у записи без состава конструктора — карточка': open2 === 'builder'
  }, `«С готового отчёта»: свой личный, собранный здесь, открывается сам (сохранение — в ту же запись ${ownTid}, вид с графиком вернулся, шапка «личный, сохранён»); чужой личный и официальный — копией «Копия «…»» без записи, ` +
    `общий «План и факт выдачи» — копия с тремя строками «Не принято: …» над листом; чужой личный и несуществующий не открыть («${rBad.why}»); «Править» на витрине у записи из конструктора открывает конструктор, ` +
    `у записи без состава конструктора — карточку (${open2})`);

  /* --- КН-7: «личный, сохранён» ↔ «не сохранён» по составу и виду; после «Открыть кругу…» следующее «Сохранить» — новая личная --- */
  const savedWord = () => has(l1Of(scr()), 'личный, сохранён') ? 'сохранён' : has(l1Of(scr()), 'личный, не сохранён') ? 'не сохранён' : '?';
  fresh(); const w0 = savedWord(); const svA = KB.saveDraft('Слово'); const w1 = savedWord();
  KB.moveStat('s-overdue-sum', 1); const w2 = savedWord(); KB.moveStat('s-overdue-sum', -1); const w3 = savedWord();
  KB.setView({ layout: 'показатели в строках' }); const w4 = savedWord(); KB.setView({ layout: 'показатели в колонках' }); const w5 = savedWord();
  KB.setView({ chart: true }); const w6 = savedWord(); KB.saveDraft('Слово'); const w7 = savedWord();
  KB.ui.ask(); const barAsked = barOf(scr()), askedRec = RP.TPL(svA.tid).asked;
  KB.ui.circle(true); const afterCircle = { saved: S().saved, word: savedWord(), level: RP.levelOf(svA.tid) };
  const svB = KB.saveDraft('Слово'), nowShared = KB.readyReports('');
  chk(43, {
    'не сохранён → сохранён → правка состава → вернули → правка вида → вернули → график → сохранили': [w0, w1, w2, w3, w4, w5, w6, w7].join() === 'не сохранён,сохранён,не сохранён,сохранён,не сохранён,сохранён,не сохранён,сохранён',
    '«Отдать на утверждение…» — пункт серый «Отдан на утверждение»': !!askedRec && has(barAsked, 'Отдан на утверждение') && !has(barAsked, 'KB.ui.ask()'),
    '«Открыть кругу…» — запись общая, конструктор отвязан': afterCircle.saved === null && afterCircle.word === 'не сохранён' && afterCircle.level === 'общий',
    'следующее «Сохранить» — новая личная, а не правка общей': svB.ok && svB.tid !== svA.tid && RP.levelOf(svB.tid) === 'личный' && nowShared.shared.some(x => x.id === svA.tid) &&
      nowShared.mine.some(x => x.id === svB.tid && x.own) && !nowShared.mine.some(x => x.id === svA.tid)
  }, `шапка «личный, сохранён» ↔ «не сохранён»: ${[w0, w1, w2, w3, w4, w5, w6, w7].join(' → ')} (до сохранения · сохранили · сдвинули показатель · вернули · раскладка · вернули · график · сохранили); ` +
    `«Отдать на утверждение…» — пункт серый; «Открыть кругу…» делает запись общей (${afterCircle.level}), следующее «Сохранить» — новая личная ${svB.tid}, а не правка общей ${svA.tid}`);

  /* --- КН-17: «Выгрузить» — предварительный выпуск строкой общего «Журнала выпусков» --- */
  fresh(); const i0 = RP.state.issues.length, wl0 = RP.state.worklists.length, ex = KB.exportIssue('xlsx'), iss = RP.state.issues.find(x => x.id === ex.rp) || {};
  const exBad = KB.exportIssue('docx'); KB.ui.export('pdf'); const i1 = RP.state.issues.length;
  RP.state.view = 'journal'; const jr = win.VIEWS.journal.fn(); RP.selIssue(ex.rp); const jr2 = win.VIEWS.journal.fn();
  fresh(); KB.setDrill(true); const kl0 = S().worklists.length; KB.ui.worklist(); const wl1 = [S().worklists.length - kl0, RP.state.worklists.length];
  chk(44, {
    'выгрузка — строка в журнале выпусков, предварительная': ex.ok && /^В-Л-\d+$/.test(ex.id) && /^ВП-\d+$/.test(ex.rp) && i1 === i0 + 2 && iss.kind === 'предварительный' && iss.from === 'конструктор' &&
      iss.by === 'Осмонова Г.' && iss.recipient === null && iss.tplName === 'Просрочка по ступеням' && iss.state === 'готов' && iss.fileAlive === true,
    'паспорт строки: метка, снимок, скрытое': iss.params.asOf === '2026-08-31' && iss.passport.label === 'НЕ ОФИЦИАЛЬНЫЙ ДОКУМЕНТ' && iss.passport.hidden === 3 && ex.issue.kind === 'предварительный' && ex.issue.personal === true,
    'формат вне списка отказан': !exBad.ok && has(exBad.why, 'не положен'),
    'журнал показывает строку': has(jr, '<b class="mono">' + ex.rp + '</b>') && has(jr, 'Просрочка по ступеням<div class="small">ред. — · отчёт</div>') && has(jr, '<span class="pill info">предварительный</span>') &&
      has(jr, 'скрыто видимостью: 3 объекта') && has(jr, "RP.selIssue('" + ex.rp + "')"),
    '«Паспорт» строки открывается': has(jr2, '<h3>Паспорт выпуска ' + ex.rp + '</h3>') && has(jr2, 'НЕ ОФИЦИАЛЬНЫЙ ДОКУМЕНТ'),
    'в паспорте строки «источник» — словами, без имён запросов и слова «швы»': has(jr2, '<span class="k">источник</span>статистика, снимок 31.08.2026') &&
      !/statRows|statSlice|statSeries|objectRows|спрошенные|(^|[^а-яё])швы?([^а-яё]|$)/i.test(jr2.replace(/<[^>]+>/g, ' ')),
    'рабочий список — в данных конструктора, на «Рабочие списки» не попадает': wl1[0] === 1 && wl1[1] === wl0
  }, `выгрузка из конструктора — предварительный выпуск ${ex.rp} строкой общего «Журнала выпусков» (источник «конструктор», «${iss.by}», получателя нет, «${(iss.passport || {}).label}», скрыто ${(iss.passport || {}).hidden}), журнал её показывает, ` +
    `«Паспорт» открывается; формат вне списка отказан; рабочий список заводится в данных конструктора (${wl1[0]}), а на экран «Рабочие списки» не попадает (${wl1[1]} = ${wl0})`);

  /* --- КН-10: своя формула — на каждом узле заново из его величин, на группе это не сумма --- */
  const FRM = { name: 'Доля просрочки', a: 's-overdue-sum', op: '÷', b: 's-portfolio', k: 100, unit: '%', dp: 1 };
  const EXPR = '«Сумма просроченной задолженности» ÷ «Остаток основного долга, всего» × 100', dec1 = x => x.toFixed(1).replace('.', ',');
  fresh(); KB.toggleStat('s-portfolio'); const fa = KB.addFormula(FRM), fans = KB.answer(), fid = fa.id;
  const nodesOf = n => [n].concat(...(n.children || []).map(nodesOf));
  const allNodes = nodesOf(fans.root), ratio = n => n.values['s-overdue-sum'] / n.values['s-portfolio'] * 100;
  const kidsF = fans.root.children.map(n => n.f[fid]), sumKidsF = kidsF.reduce((s, x) => s + x, 0);
  const hF = scr(), theadF = grab(hF, /<thead>[\s\S]*?<\/thead>/), tfootF = grab(hF, /<tfoot>[\s\S]*?<\/tfoot>/), gtotF = grab(hF, /<tr class="gtot g1">[\s\S]*?<\/tr>/);
  KB.ui.tab('паспорт'); const hFP = scr(); KB.ui.tab('настройки');
  const fb = KB.addFormula({ name: 'Разница', a: 's-portfolio', op: '−', b: 's-overdue-sum', unit: 'сом', dp: 0 }), order0 = S().formulas.map(f => f.id).join();
  KB.moveFormula(fb.id, -1); const order1 = S().formulas.map(f => f.id).join(); KB.ui.pvDrag = 'formula:' + fid; KB.ui.pvDrop('formula:' + fb.id); const order2 = S().formulas.map(f => f.id).join();
  const rowsF = grab(scr(), /<div class="pv-lbl">Показатели[\s\S]*?<div class="btn-row tight">/);
  const fSet = KB.setFormula(fb.id, { name: 'Разница', a: 's-portfolio', op: '−', b: 's-overdue-sum', unit: 'сом', dp: 2 }), dpSet = (S().formulas.find(f => f.id === fb.id) || {}).dp, fDel = KB.removeFormula(fb.id);
  chk(45, {
    'формула добавлена, показатели состава не тронуты': fa.ok && fid === 'ф-1' && fans.stats.join() === S().stats.join() && fans.formulas.length === 1 && fans.formulas[0].expr === EXPR,
    'на каждом узле — по его собственным величинам': allNodes.every(n => Math.abs(n.f[fid] - ratio(n)) < 1e-9) && allNodes.length > fans.root.children.length + 1,
    'на группе — не сумма долей детей': Math.abs(sumKidsF - fans.root.f[fid]) > 1 && fans.root.f[fid] < Math.max(...kidsF),
    'колонка «ƒ» с выражением в подсказке': has(theadF, 'Доля просрочки <span class="own" title="' + EXPR + '">ƒ</span><span class="th-sub">%</span>'),
    'число группы в «Итого по …» и итог отчёта с запятой': has(gtotF, '<td class="num st"><b>0,0</b></td></tr>') && has(tfootF, '<td class="num st">' + dec1(fans.root.f[fid]) + '</td></tr>'),
    'паспорт — «ƒ имя = выражение», в ответе и во вкладке': fans.passport.shown.formulas[0] === 'ƒ Доля просрочки = ' + EXPR && has(hFP, '<span class="k">показанный состав</span>') && has(hFP, 'ƒ Доля просрочки = ' + EXPR),
    'порядок: ↑ и перетаскивание': fb.ok && order0 === 'ф-1,ф-2' && order1 === 'ф-2,ф-1' && order2 === 'ф-1,ф-2' && has(rowsF, 'formula:' + fid) && has(rowsF, 'Доля просрочки'),
    'правка и удаление': fSet.ok && dpSet === 2 && fDel.ok && S().formulas.length === 1
  }, `формула «Доля просрочки» = просрочено ÷ остаток × 100 считается на каждом узле заново из его величин: корень ${dec1(fans.root.f[fid])}, группы ${kidsF.map(dec1).join(' / ')} — не сумма (сумма долей групп ${dec1(sumKidsF)}); ` +
    `колонка «ƒ» с выражением в подсказке, число группы в «Итого по …», итог отчёта; паспорт — «ƒ имя = выражение»; порядок формул (↑ и перетаскивание), правка и удаление работают`);

  /* --- КН-10: проверки формулы с причинами --- */
  fresh(); const bad = [
    KB.addFormula({ name: '', a: 's-overdue-sum', op: '÷', b: 's-portfolio' }), KB.addFormula({ name: 'x', a: 's-overdue-sum', op: '÷' }),
    KB.addFormula({ name: 'x', a: 's-overdue-sum', op: '÷', b: 0 }), KB.addFormula(Object.assign({}, FRM, { name: 'Доля' })), KB.addFormula(Object.assign({}, FRM, { name: 'Доля' })),
    KB.addFormula({ name: 'y', a: 's-npl', op: '÷', b: 's-portfolio' })];
  const whys = bad.map(r => r.why || ''), chkBad = KB.formulaCheck({ name: '', a: 's-overdue-sum', op: '÷', b: 's-portfolio' }), chkOk = KB.formulaCheck(Object.assign({}, FRM, { name: 'Другая' }));
  KB.ui.formEdit(null); KB.ui.formSave(); const hErr = scr(), formUi = grab(hErr, /<div class="pv-form kb-form">[\s\S]*?<\/div><\/div><\/div>/) || grab(hErr, /<div class="pv-form kb-form">[\s\S]*?Отмена<\/button>/);
  KB.ui.formCancel(); const formGone = S().ui.form === null;
  KB.ui.formEdit(null); KB.ui.formVal('name', 'Через экран'); KB.ui.formSave(); const viaUi = S().formulas.map(f => f.name).join('|'), formClosed = S().ui.form === null;
  chk(46, {
    'нет имени': whys[0] === 'у формулы должно быть имя: колонку без имени не прочесть',
    'пустой второй операнд': whys[1] === 'не выбран второй показатель или число',
    'деление на ноль': whys[2] === 'делить на ноль нельзя: второй операнд равен нулю',
    'повтор имени': bad[3].ok && has(whys[4], 'формула «Доля» уже есть'),
    'выведенный показатель': has(whys[5], 'выведен 12.08'),
    'KB.formulaCheck без записи': !chkBad.ok && has(chkBad.why, 'должно быть имя') && chkOk.ok,
    'редактор показывает причину у своего поля': has(formUi, 'id="kbFormErr">У формулы должно быть имя') && has(formUi, 'onclick="KB.ui.formSave()">Добавить</button>') && has(formUi, 'onclick="KB.ui.formCancel()">Отмена</button>') && formGone,
    'через экран формула добавляется, редактор закрывается': viaUi === 'Доля|Через экран' && formClosed
  }, `проверки формулы называют причину: «${whys[0]}», «${whys[1]}», «${whys[2]}», «${whys[4]}», «${whys[5].slice(0, 40)}…»; в редакторе причина стоит у поля (kbFormErr), «Отмена» закрывает, «Добавить» с именем добавляет`);

  /* --- КН-10: «сейчас» снимает формулу над неисчислимым; без показателей лист считается --- */
  fresh(); KB.toggleStat('s-avg-late'); KB.addFormula({ name: 'Средняя доля', a: 's-avg-late', op: '÷', b: 's-overdue-cnt', unit: '', dp: 1 }); KB.addFormula(Object.assign({}, FRM));
  const toNow = KB.setMode('сейчас'), fAfterNow = S().formulas.map(f => f.name).join('|'), hNow = scr();
  fresh(); S().stats = []; KB.addFormula(FRM); const onlyF = KB.answer(), hOnlyF = scr();
  fresh(); S().stats = []; const hNoStat = scr();
  chk(47, {
    '«сейчас» снимает и показатель, и формулу над ним': toNow.ok && toNow.dropped.length === 2 && toNow.dropped.some(d => d.kind === 'показатель' && d.name === 'Средняя просрочка') &&
      toNow.dropped.some(d => d.kind === 'формула' && d.name === 'Средняя доля') && fAfterNow === 'Доля просрочки',
    'строки «показано не так» над листом': has(hNow, '<b>Формула «Средняя доля» снята из состава.</b>') && has(hNow, '<b>Показатель «Средняя просрочка» снят из состава.</b>'),
    'формула без показателей — лист считается': onlyF.ok && onlyF.stats.length === 0 && onlyF.formulas.length === 1 && has(hOnlyF, '<span class="own" title="' + EXPR + '">ƒ</span>') &&
      !has(hOnlyF, 'Добавьте показатель') && has(hOnlyF, '<tfoot><tr class="grand">'),
    'ни показателей, ни формул — «Добавьте показатель.» на месте листа': has(hNoStat, '<div class="pv-none"><b>Добавьте показатель.</b>') && !has(hNoStat, '<table')
  }, `в «сейчас» формула над «Средней просрочкой» снимается вместе с показателем и называется строками «показано не так»; формула без единого показателя лист считает (операнды спрашиваются у статистики, колонок показателей нет); ` +
    `без показателей и формул на месте листа «Добавьте показатель.»`);

  /* --- КН-10: раскладка — три на выбор, «разрез в колонках» только при двух разрезах; график над таблицей --- */
  const laySec = h => grab(h, /<details class="pv-sec" data-sec="раскладка"[\s\S]*?<\/details>/), tblOf = h => grab(h, /<table[\s\S]*?<\/table>/);
  fresh(); const lays = KB.layouts(), hDef = scr(), secDef = laySec(hDef), keyDef = KB.savedKey();
  const rRot = KB.setView({ layout: 'показатели в строках' }), hRot = scr(), tRot = tblOf(hRot), secRot = laySec(hRot), keyRot = KB.savedKey();
  const rPiv = KB.setView({ layout: 'разрез в колонках' }), hPiv = scr(), tPiv = tblOf(hPiv), capPiv = grab(hPiv, /<div class="pv-cap kb-cap">[\s\S]*?<\/div>/);
  const rBadLay = KB.setView({ layout: 'нет такой' });
  fresh(); S().cuts = S().cuts.slice(0, 1); const rOne = KB.setView({ layout: 'разрез в колонках' }), secOne = laySec(scr());
  fresh(); const rCh = KB.setView({ chart: true }), hCh = scr(), chartBox = grab(hCh, /<div class="pv-chart">[\s\S]*?<\/svg>/), secCh = laySec(hCh);
  KB.ui.chart(false); const hNoCh = scr();
  chk(48, {
    'раскладок три, по умолчанию «показатели в колонках»': lays.join('|') === 'показатели в колонках|показатели в строках|разрез в колонках' && count(secDef, /<button class="pv-lay/g) === 3 &&
      has(secDef, '<button class="pv-lay on" aria-pressed="true" onclick="KB.ui.layout(\'показатели в колонках\')">') && has(secDef, '<span class="s">показатели в колонках</span>'),
    '«график над таблицей» — флажок, по умолчанию снят': has(secDef, '<label class="pv-chk kb-chart"><input type="checkbox" onchange="KB.ui.chart(this.checked)"><span><b>График над таблицей</b></span></label>') && !has(hDef, 'class="pv-chart"'),
    '«показатели в строках»: показатели строками, разрез — колонками, «Итого по отчёту» последней': rRot.ok && has(tRot, '<table class="cgrid pvt rot">') && has(tRot, '<th class="key last" style="left:0">Показатель</th>') &&
      has(tRot, '<th class="num" title="срок неплатежа">1–30 дней</th>') && has(tRot, '<th class="num grand">Итого по отчёту</th>') &&
      has(tRot, 'Сумма просроченной задолженности <span class="small">сом</span></td>') && has(tRot, '<td class="num st grand">19 360 300</td>') && has(tRot, '<td class="num st grand">21</td>') && has(secRot, '<span class="s">показатели в строках</span>'),
    '«разрез в колонках»: подпись и выбор показателя для клеток, «Итого»': rPiv.ok && has(capPiv, '<select class="kb-pvsel" onchange="KB.ui.pivot(this.value)" title="что в клетках">') && has(capPiv, '<b>срок неплатежа × состояние кредита</b>') &&
      has(tPiv, '<th class="num">действующий</th>') && has(tPiv, '<th class="num grand">Итого</th>') && has(tPiv, '<tfoot><tr class="grand"><td class="key last"') && has(tPiv, '<td class="num st">2 272 500</td>') && has(tPiv, '<span class="muted">—</span>'),
    'раскладка не из списка — отказ': !rBadLay.ok && !!rBadLay.why,
    'при одном разрезе «разрез в колонках» отказан с причиной у кнопки': !rOne.ok && rOne.why === 'нужны два разреза: строки — первый, колонки — второй' &&
      has(secOne, '<button class="pv-lay off" aria-disabled="true" title="Нужны два разреза: строки — первый, колонки — второй">') && has(secOne, '<small>нужны два разреза</small>'),
    'раскладка входит в «сохранён / не сохранён»': keyDef !== keyRot,
    'график: столбики над таблицей, подпись, флажок, «× убрать»': rCh.ok && has(chartBox, '<div class="small">Сумма просроченной задолженности по разрезу «срок неплатежа»</div>') && has(chartBox, '<svg class="chart"') &&
      has(chartBox, 'onclick="KB.ui.chart(false)">✕</button>') && has(secCh, '<input type="checkbox" checked onchange="KB.ui.chart(this.checked)">') && has(secCh, '<span class="s">показатели в колонках · график</span>') && !has(hNoCh, 'class="pv-chart"')
  }, `раскладка: три на выбор (${lays.join(' · ')}); «показатели в строках» — таблица rot с «Итого по отчёту» последней колонкой (19 360 300 / 21); «разрез в колонках» — сводка «срок неплатежа × состояние кредита» с выбором показателя для клеток; ` +
    `при одном разрезе — серая кнопка с причиной «нужны два разреза»; «график над таблицей» рисует столбики над листом и убирается «✕»; раскладка меняет «сохранён / не сохранён»`);

  /* --- КН-8: стопки «Разрезы — уровни сверху вниз» и «Показатели — колонки слева направо» --- */
  fresh(); const hSt = scr(), stk = grab(hSt, /<div class="pv-lbl">Разрезы — уровни[\s\S]*?<details class="pv-pick"/), stkS = grab(hSt, /<div class="pv-lbl">Показатели — колонки[\s\S]*?<div class="btn-row tight">/);
  const rows = h => h.split('<div class="pv-stk"').slice(1), cutRows = rows(stk), statRows = rows(stkS);
  const bndUp = KB.moveStat('s-overdue-sum', -1), bndDn = KB.moveStat('s-overdue-cnt', 1), bndCut = KB.moveCut('late', -1);
  KB.ui.pvDrag = 'stat:s-overdue-sum'; KB.ui.pvDrop('stat:s-overdue-cnt'); const ordStat = S().stats.join();
  KB.ui.pvDrag = 'cut:late'; KB.ui.pvDrop('stat:s-overdue-sum'); const ordCross = S().cuts.map(c => c.id).join() + '|' + S().stats.join();
  KB.ui.pvDrag = 'cut:late'; KB.ui.pvDrop('cut:status'); const ordCut = S().cuts.map(c => c.id).join();
  fresh(); KB.toggleTotal('status'); const totOn = S().cuts.map(c => !!c.total).join(), sigOn = count(grab(scr(), /<div class="pv-lbl">Разрезы — уровни[\s\S]*?<details class="pv-pick"/), /class="lnk sig on"/g);
  KB.toggleTotal('status'); const totOff = S().cuts.map(c => !!c.total).join();
  chk(49, {
    'у уровня номер, ручка, имя; у показателя — ручка, имя, единица': cutRows.length === 2 && statRows.length === 2 && cutRows.every((r, i) => has(r, '<span class="lvl">' + (i + 1) + '</span><span class="hd" title="перетащите">⋮⋮</span>')) &&
      statRows.every(r => !has(r, 'class="lvl"') && has(r, '<span class="hd" title="перетащите">⋮⋮</span>')) && has(statRows[0], '<span class="small">сом</span>') && has(statRows[1], '<span class="small">ед.</span>'),
    'у уровня «корзина ▾» и «Σ»': has(cutRows[0], '<details ontoggle="KB.ui.ddPlace(this)" class="pv-dd kb-b"><summary class="btn btn-secondary btn-sm" title="корзина: ступени"><span class="bk">ступени</span> ▾</summary>') &&
      has(cutRows[0], '<button class="lnk sig on" title="итог уровня печатается — щёлкните, чтобы убрать"') && has(cutRows[1], '<button class="lnk sig" title="печатать итог уровня"') && !has(cutRows[1], 'class="pv-dd kb-b"'),
    '↑ ↓ ✕: на краю — пустое место, а не кнопка': has(cutRows[0], '<span class="lnk ph">↑</span><button class="lnk" title="ниже"') && has(cutRows[1], '<button class="lnk" title="выше"') && has(cutRows[1], '<span class="lnk ph">↓</span>') &&
      has(statRows[0], '<span class="lnk ph">↑</span>') && has(statRows[1], '<span class="lnk ph">↓</span>') && count(stk + stkS, /title="убрать"/g) === 4,
    'на краю «двигать некуда»': !bndUp.ok && bndUp.why === 'двигать некуда' && !bndDn.ok && !bndCut.ok,
    'перетаскивание: показатель на показатель — порядок меняется': ordStat === 's-overdue-cnt,s-overdue-sum',
    'перетаскивание разреза на показатель — ничего': ordCross === 'late,status|s-overdue-cnt,s-overdue-sum',
    'перетаскивание разрез на разрез — порядок меняется': ordCut === 'status,late',
    '«Σ» включает и выключает итог уровня': totOn === 'true,true' && sigOn === 2 && totOff === 'true,false'
  }, `стопки в «Составе»: у разреза номер уровня, ручка «⋮⋮», «корзина ▾», «Σ», «↑ ↓ ✕» (на краю — пустое место); у показателя — ручка, единица, «↑ ↓ ✕»; перетаскивание меняет порядок внутри стопки, разрез на показатель — ничего; ` +
    `на краю «двигать некуда»; «Σ» включает и выключает итог уровня`);

  /* --- КН-9: «Колонки ▾» — только когда печатаются строки; поля сгруппированы, занятое уровнем или показателем — серым с причиной --- */
  fresh(); KB.setDrill(true); const hDr = scr(), tbDr = grab(hDr, /<div class="pv-tb">[\s\S]*?<div class="pv-tw"/), dd = grab(tbDr, /<details ontoggle="KB.ui.colsOpen[\s\S]*?<\/details>/);
  const disF = [...dd.matchAll(/<label class="mi( off)? pv-chk1"><input type="checkbox"( checked)? disabled><span class="t">([^<]*)<\/span><small>([^<]*)<\/small><\/label>/g)].map(m => ({ off: !!m[1], on: !!m[2], t: m[3], why: m[4] }));
  KB.toggleField('dept'); const hDept = scr(); KB.toggleField('dept');
  KB.setDrill(false); const btnOff = grab(scr(), /<button class="btn btn-secondary btn-sm off" aria-disabled="true" title="[^"]*">Колонки ▾<\/button>/);
  chk(50, {
    'при строках — выпадающий список «Колонки ▾» справа в строке над листом': has(tbDr, '<span class="pv-gap"></span><details ontoggle="KB.ui.colsOpen(this.open)" class="pv-dd cols"><summary class="btn btn-secondary btn-sm">Колонки ▾</summary>'),
    'две группы: «Идентификатор и признаки» и «Величины»': has(dd, '<div class="mi-g">Идентификатор и признаки</div>') && has(dd, '<div class="mi-g">Величины</div>') && dd.indexOf('Идентификатор и признаки') < dd.indexOf('Величины'),
    'номер договора и заёмщик включены по умолчанию': has(dd, '<input type="checkbox" checked onchange="kbAct(KB.toggleField(\'no\'))"><span class="t">Номер договора</span>') && has(dd, '<input type="checkbox" checked onchange="kbAct(KB.toggleField(\'borrower\'))"><span class="t">Заёмщик</span>'),
    'поле, ставшее уровнем, — серое «стоит уровнем»': disF.some(x => x.off && !x.on && x.t === 'Состояние' && x.why === 'стоит уровнем') && disF.some(x => x.off && x.on && x.t === 'Дней просрочки' && x.why === 'стоит уровнем'),
    'величина под итогом показателя — включена, недоступна, «под «…»»': disF.some(x => !x.off && x.on && x.t === 'Просроченная задолженность' && x.why === 'под «Сумма просроченной задолженности»'),
    'включённое поле появляется колонкой листа': has(hDept, 'строка — номер договора · заёмщик · подразделение') && has(hDept, '<span class="chip" title="Подразделение">Отраслевой департамент промышленности</span>') && !has(tbDr, 'title="Подразделение"'),
    'без строк — серая кнопка с причиной': has(btnOff, 'title="строки не печатаются — включите «печатать строки» в «Составе»"')
  }, `«Колонки ▾» есть, только когда печатаются строки (иначе серая кнопка «строки не печатаются — включите «печатать строки» в «Составе»»); внутри две группы «Идентификатор и признаки» и «Величины»; ` +
    `поле, ставшее уровнем, серое «стоит уровнем» (${disF.filter(x => x.why === 'стоит уровнем').map(x => x.t).join(', ')}), величина под итогом — включена и недоступна «под «Сумма просроченной задолженности»»; включённое поле появляется колонкой листа`);

  /* --- КН-11: «Время» — на дату или сейчас; недоступное — серым с причиной; «сейчас» считается по кнопке --- */
  const timeSec = h => grab(h, /<details class="pv-sec" data-sec="время"[\s\S]*?<\/details>/);
  fresh(); const tDef = timeSec(scr());
  KB.setObject('collateral'); S().started = true; const tCol = timeSec(scr()), rNowCol = KB.setMode('сейчас'), modeCol = S().mode;
  fresh(); const rNow = KB.setMode('сейчас'), hNow0 = scr(), shNow0 = grab(hNow0, /<div class="pv-sheet">[\s\S]*?<\/div><\/div>/), tNow = timeSec(hNow0);
  KB.ui.calc(); const hNow1 = scr(), tbNow1 = grab(hNow1, /<div class="pv-tb">[\s\S]*?<div class="pv-tw"/);
  fresh(); KB.setAsOf('2026-09-05'); const hGapT = scr(), tGap = timeSec(hGapT);
  const rFut = KB.setAsOf('2026-12-31'), asOfFut = S().asOf, rEarly = KB.setAsOf('2026-01-01'), asOfEarly = S().asOf;
  chk(51, {
    'два режима рядом: «на дату» (выбран), «сейчас»': has(tDef, '<div class="seg kb-tseg"><button class="on" onclick="KB.ui.mode(\'на дату\')">на дату</button><button class="" onclick="KB.ui.mode(\'сейчас\')">сейчас</button></div>') && has(tDef, '<span class="s">на 31.08.2026</span>'),
    'дата снимка — список с «зафиксировано / не зафиксировано» и «Другая дата»': has(tDef, '<option value="2026-07-31">31.07.2026 · зафиксировано</option>') && has(tDef, '<option value="2026-08-31" selected>31.08.2026 · не зафиксировано</option>') &&
      has(tDef, '<label class="pv-f"><span>Другая дата</span><input type="date" min="2026-07-31" max="2026-09-05" value="" onchange="if(this.value) KB.ui.asOf(this.value)"></label>'),
    'дата без снимка — в поле «Другая дата», в списке «—»': has(tGap, '<option value="" selected disabled>—</option>') && has(tGap, '<input type="date" min="2026-07-31" max="2026-09-05" value="2026-09-05"') && has(tGap, '<span class="s">на 05.09.2026</span>'),
    'дата позже сегодня и раньше первого снимка — отказ словами, прежняя дата остаётся': !rFut.ok && has(rFut.why, 'ещё не наступила') && asOfFut === '2026-09-05' &&
      !rEarly.ok && has(rEarly.why, 'снимков раньше') && asOfEarly === '2026-09-05',
    'у предмета залога «сейчас» серое, причина словами тут же': has(tCol, '<button class="" disabled title="Объекту «предмет залога» режим «сейчас» недоступен: живые строки есть только у объекта «кредит»" onclick="KB.ui.mode(\'сейчас\')">сейчас</button>') &&
      has(tCol, '<div class="small">Объекту «предмет залога» режим «сейчас» недоступен: живые строки есть только у объекта «кредит».</div>') && !rNowCol.ok && modeCol !== 'сейчас',
    '«сейчас» до расчёта: «Числа не запрошены.» и «Посчитать на сейчас»': rNow.ok && has(shNow0, '<div class="pv-none"><b>Числа не запрошены.</b> Режим — <em>сейчас</em>') &&
      has(shNow0, '<button class="btn btn-primary btn-sm" onclick="KB.ui.calc()">Посчитать на сейчас</button>') && !has(shNow0, '<table') && has(tNow, '<span class="s">сейчас</span>') &&
      has(hNow0, '<span class="when">сейчас · 05.09.2026 14:32</span>') && has(hNow0, 'не зафиксировано'),
    'после «Посчитать»: лист, «посчитано 05.09.2026 14:32», «Посчитать» второстепенная': has(hNow1, '<table') && has(tbNow1, '<span class="small">посчитано 05.09.2026 14:32</span><button class="btn btn-secondary btn-sm" onclick="KB.ui.calc()">Посчитать</button>') &&
      !has(hNow1, 'Посчитать на сейчас') && has(hNow1, 'охват: видно 47 кредитов, скрыто 3'),
    'нет снимка на дату — банер, а не нули': has(hGapT, '<b>Снимка на 05.09.2026 нет — чисел нет.</b> Причина: пропуск прогона.') && !has(hGapT, '<table')
  }, `«Время»: «на дату» и «сейчас» рядом, дата снимка со словами «зафиксировано / не зафиксировано» и «Другая дата»; у предмета залога «сейчас» серое с причиной тут же («живые строки есть только у объекта «кредит»»); ` +
    `у кредита «сейчас» до расчёта — «Числа не запрошены.» и «Посчитать на сейчас», после — лист и «посчитано 05.09.2026 14:32»; дата без снимка — банер «Снимка на 05.09.2026 нет — чисел нет.»`);

  /* --- КН-12: «Отбор» — «только действующие» одной кнопкой, наборы «или», «Топ N»; в сводке — сколько отобрано --- */
  const fltSec = h => grab(h, /<details class="pv-sec" data-sec="отбор"[\s\S]*?<\/details><\/div>/);
  fresh(); const fl0 = fltSec(scr()), l2F0 = l2Of(scr());
  KB.ui.active(true); const hA = scr(), fl1 = fltSec(hA), l2F1 = l2Of(hA), rootA = KB.answer().root.count;
  KB.ui.active(false); const fl2 = fltSec(scr());
  fresh(); KB.ui.condAdd(0); const hC = scr(), flC = fltSec(hC); KB.ui.setAdd(); const flC2 = fltSec(scr());
  chk(52, {
    'без отбора: «без отбора» в сводке и шапке': has(fl0, '<span class="s">без отбора</span>') && has(l2F0, 'без отбора') && !has(l2F0, 'в отборе'),
    '«＋ только действующие» — не заливка, со словами в подсказке': has(fl0, '<button class="lnk" title="Складывает действующих и погасивших: строки закрытых договоров остаются в срезе" onclick="KB.ui.active(true)">＋ только действующие</button>'),
    'включённый — залитая кнопка «действующие ✕» с составом в подсказке': has(fl1, '<button class="btn btn-sm btn-primary" title="Строки, у которых «Состояние» — действующий, просроченный, на взыскании; строки со значением «закрыт» в расчёт не идут" onclick="KB.ui.active(false)">действующие ✕</button>'),
    'сводка и шапка: «отобрано 45 из 47» / «в отборе 45 из 47»': rootA === 45 && has(fl1, '<span class="s">отобрано 45 из 47</span>') && has(l2F1, 'отбор: действующие · в отборе 45 из 47'),
    '«✕» возвращает «без отбора»': has(fl2, '<span class="s">без отбора</span>') && has(fl2, 'KB.ui.active(true)'),
    'набор называется «Набор 1», «＋ условие», «＋ или — новый набор»': has(fl0, '<div class="kset"><div class="hd"><b>Набор 1</b></div><div class="btn-row tight"><button class="btn btn-sm btn-secondary" onclick="KB.ui.condAdd(0)">＋ условие</button>') &&
      has(fl0, '＋ или — новый набор</button>') && has(fl0, 'disabled title="Пустой набор уже есть (набор 1) — сначала условие в него"'),
    'условие — поле ▾, знак, значение; второй набор — «или»': has(flC, '<div class="kb-cnd"><details class="pv-pick"') && has(flC, '<summary class="btn btn-secondary btn-sm">Номер договора ▾</summary>') && has(flC2, '<b>Набор 2</b>'),
    '«Топ N»: сколько, первые/последние, по чему': has(fl0, '<span class="k">«Топ N»</span>') && has(fl0, '<option value="">без «топ N»</option><option value="3">3</option><option value="5">5</option><option value="10">10</option>') &&
      has(fl0, '<option value="первые" selected>первые</option><option value="последние">последние</option>') && has(fl0, '<option value="overdue" selected>Просроченная задолженность</option>')
  }, `«Отбор»: «＋ только действующие» одной кнопкой (включённая — «действующие ✕» с составом в подсказке, сводка «отобрано 45 из 47», шапка «в отборе 45 из 47», «✕» возвращает «без отбора»); ` +
    `наборы «Набор 1 / Набор 2» с «＋ условие», «＋ или — новый набор» (пока набор пуст — серая с причиной); «Топ N» — сколько, первые или последние, по какому показателю`);

  /* --- КН-13: лист — итог группы строкой под ней, а над ней пусто; свёрнутая группа несёт числа в своей строке; «Показать до уровня» --- */
  const bodyOf = h => grab(h, /<tbody>[\s\S]*?<\/tbody>/);
  fresh(); const hS0 = scr(), bS0 = bodyOf(hS0), tfS0 = grab(hS0, /<tfoot>[\s\S]*?<\/tfoot>/);
  const g1open = bS0.split('<tr class="grp g1 fo open"').slice(1).map(x => x.split('<tr class="gtot g1">')[0]), gt1 = [...bS0.matchAll(/<tr class="gtot g1"><td class="key last" style="padding-left:24px">Итого по «([^»]*)»<\/td><td class="num st"><b>([^<]*)<\/b><\/td><td class="num st"><b>([^<]*)<\/b><\/td><\/tr>/g)];
  const ans0 = KB.answer(), byKey = Object.fromEntries(ans0.root.children.map(n => [n.key, n]));
  KB.ui.fold('1–30 дней'); const bFold = bodyOf(scr()), foldRow = grab(bFold, /<tr class="grp g1 fo" data-k="1–30 дней"[\s\S]*?<\/tr>/);
  KB.ui.depth(1); const bD1 = bodyOf(scr()); KB.ui.depth(2); const bD2 = bodyOf(scr());
  fresh(); KB.toggleTotal('late'); const bSigOff = bodyOf(scr());
  fresh(); KB.toggleTotal('status'); const bSigG2 = bodyOf(scr());
  fresh(); KB.setDrill(true); const lvD = grab(scr(), /<span class="pv-lv small">[\s\S]*?<\/span>/); KB.ui.find('КД-2024-031'); const hFind = scr(), findBox = grab(hFind, /<span class="pv-find">[\s\S]*?<\/span><\/span>/), hits = count(hFind, /<tr class="obj hit/g);
  const hitTxt = (findBox.match(/(\d+) из (\d+)/) || []);
  chk(53, {
    'над раскрытой группой пусто, под ней «Итого по «…»» с теми же числами': g1open.length === 5 && g1open.every(x => has(x.split('</tr>')[0], '<td class="num st"></td><td class="num st"></td>')) && gt1.length === 5 &&
      gt1.every(m => byKey[m[1]] && m[2] === sp(byKey[m[1]].values['s-overdue-sum']) && m[3] === String(byKey[m[1]].values['s-overdue-cnt'])),
    'у уровня 2 числа в своих строках, итога уровня 2 нет': has(bS0, '<tr class="grp g2" data-k="1–30 дней › просроченный"><td class="key last gname" style="padding-left:26px"><span class="caret"></span> <b>просроченный</b> <span class="cnt">6 кредитов</span></td><td class="num st">2 272 500</td><td class="num st">6</td></tr>') && !has(bS0, 'class="gtot g2"'),
    'итог отчёта — последняя строка «Итого по отчёту 47 кредитов»': has(tfS0, '<tfoot><tr class="grand"><td class="key last">Итого по отчёту <span class="cnt">47 кредитов</span></td><td class="num st">19 360 300</td><td class="num st">21</td></tr></tfoot>'),
    'свёрнутая группа: числа в своей строке, итога под ней нет': !has(foldRow, ' open') && has(foldRow, '<span class="caret">▸</span> <b>1–30 дней</b>') && has(foldRow, '<td class="num st">2 272 500</td><td class="num st">6</td>') && !has(bFold, 'Итого по «1–30 дней»') && has(bFold, 'Итого по «0 дней»'),
    '«до уровня 1» сворачивает все, «до уровня 2» раскрывает': count(bD1, /<tr class="grp g1 fo"/g) === 5 && !has(bD1, 'class="gtot') && !has(bD1, 'class="grp g2"') && count(bD2, /<tr class="gtot g1"/g) === 5 && count(bD2, /<tr class="grp g1 fo open"/g) === 5,
    '«Σ» снят на первом уровне — итога под группой нет, числа в её строке': !has(bSigOff, 'class="gtot g1"') && has(bSigOff, '<b>1–30 дней</b> <span class="cnt">6 кредитов</span></td><td class="num st">2 272 500</td><td class="num st">6</td>'),
    '«Σ» включён на втором — «Итого» под его группой': has(bSigG2, 'class="gtot g2"'),
    '«Показать до уровня»: номера уровней и «строки» при строках': has(lvD, 'Показать до уровня: <button class="lnk" title="уровень: срок неплатежа" onclick="KB.ui.depth(1)">1</button> · <button class="lnk" title="уровень: состояние кредита" onclick="KB.ui.depth(2)">2</button> · <button class="lnk on" title="строки объектов" onclick="KB.ui.depth(\'строки\')">строки</button>'),
    'поиск по листу: найденное подсвечено, считается «1 из N»': hits >= 1 && hitTxt[1] === '1' && +hitTxt[2] === hits && count(hFind, /<mark>/g) === hits && has(hFind, 'class="obj hit cur"')
  }, `лист: итог раскрытой группы — строкой «Итого по «…»» под ней (над ней пусто), числа группы сходятся с ответом ядра (${gt1.map(m => m[1] + ' ' + m[2] + '/' + m[3]).join('; ')}); свёрнутая группа несёт числа в своей строке; ` +
    `итог отчёта — «Итого по отчёту 47 кредитов»; «Показать до уровня» (1 · 2 · строки) сворачивает и раскрывает; «Σ» снимает и ставит итог уровня; поиск «КД-2024-031» подсвечивает ${hits} строку «${hitTxt[0]}»`);

  /* --- КН-14: «показано не так» — строки над листом называют, что снято и что не принято --- */
  const msgsOf = h => grab(h, /<div class="pv-msgs">[\s\S]*?<\/div><\/div>(?=<div class="pv-chart|<div class="pv-sheet")/);
  fresh(); KB.setActive(true); KB.addFilter('days', '>', 90); KB.setObject('collateral'); S().started = true; const mObj = msgsOf(scr());
  fresh(); KB.setActive(true); const rDash = KB.fromDashboard({ object: 'credit', stats: ['s-overdue-sum', 's-npl'], cuts: ['late'], filters: [], path: 'Главная › Просрочка › 31–90 дней' });
  const mDash = msgsOf(scr()), dashSt = { name: S().name, started: S().started, stats: S().stats.join(), cuts: S().cuts.map(c => c.id).join(), saved: S().saved };
  fresh(); const keepSt = S().stats.join(), rDashBad = KB.fromDashboard({ object: 'credit', stats: ['s-npl'], cuts: [], path: 'x' }), keptAfter = S().stats.join(), rDashNo = KB.fromDashboard({ object: 'нет', stats: [] });
  fresh(); KB.setMode('сейчас'); KB.ui.calc(); const hCalc = scr(); KB.toggleStat('s-overdue-cnt'); const hStale = scr();
  chk(54, {
    'смена объекта: «Снято при смене объекта.» — показатели, разрезы, отбор': has(mObj, '<div class="pv-msg warn"') && has(mObj, '<b>Снято при смене объекта.</b> Показатели «Сумма просроченной задолженности», «Кредитов с просрочкой»; разрезы «срок неплатежа», «состояние кредита»; отбор.</span>'),
    'строка раскрывается щелчком — «щёлкните — причина целиком»': has(mObj, "onclick=\"this.classList.toggle('open')\" title=\"щёлкните — причина целиком\""),
    'с дашборда: «Черновик с дашборда «путь» — не сохранён.»': rDash.ok && has(mDash, '<div class="pv-msg info"') && has(mDash, '<b>Черновик с дашборда «Главная › Просрочка › 31–90 дней» — не сохранён.</b>'),
    'с дашборда: выведенный показатель назван, остальное принято': rDash.lost.length === 1 && has(mDash, '<div class="pv-msg warn"') && has(mDash, 'Не принято: выведен 12.08') && dashSt.stats === 's-overdue-sum' && dashSt.cuts === 'late' &&
      dashSt.name === 'Главная › Просрочка › 31–90 дней' && dashSt.started === true && dashSt.saved === null,
    'с дашборда без показателя — отказ, черновик на месте': !rDashBad.ok && has(rDashBad.why, 'черновик дашборда без показателя') && keptAfter === keepSt && !rDashNo.ok && has(rDashNo.why, 'никто не объявил'),
    'после «Посчитать» в «сейчас» правка состава не оставляет прежних чисел: снова «Числа не запрошены.»': has(hCalc, '<table') && has(hStale, '<b>Числа не запрошены.</b>') && !has(hStale, '<table') && !has(hStale, 'Показан прежний расчёт')
  }, `«показано не так»: смена объекта — «Снято при смене объекта.» с показателями, разрезами и «отбор»; черновик с дашборда — «Черновик с дашборда «…» — не сохранён.» и «Не принято: выведен 12.08…» над листом, ` +
    `без показателя — отказ и прежний черновик на месте; правка состава в «сейчас» после расчёта сбрасывает числа (прежний расчёт не показывается — строка «Показан прежний расчёт.» в рамке недостижима)`);

  /* --- КН-15: вкладка «Паспорт» — шесть строк словами; источник — «статистика, снимок …» --- */
  const passRows = h => [...sideOf(h).matchAll(/<div class="row"><span class="k">([^<]*)<\/span>([\s\S]*?)<\/div>/g)].map(m => [m[1], m[2].replace(/<[^>]+>/g, '')]);
  const passTab = () => { KB.ui.tab('паспорт'); const h = scr(); KB.ui.tab('настройки'); return h; };
  fresh(); const pD = passTab(), rowsD = passRows(pD);
  fresh(); KB.setDrill(true); KB.setActive(true); KB.addFormula({ name: 'Доля', a: 's-overdue-sum', op: '÷', b: 's-overdue-cnt', unit: '', dp: 1 }); const rowsF2 = passRows(passTab());
  fresh(); KB.setMode('сейчас'); const rowsNow = passRows(passTab());
  fresh(); KB.setAsOf('2026-09-05'); const rowsGap = passRows(passTab());
  fresh(); KB.setObject('claim'); S().started = true; S().stats = ['s-q-count', 's-q-sum']; S().cuts = [{ id: 'q-role', bucket: null, total: true }]; const rowsQ = passRows(passTab());
  asRole('auth'); S().started = true; const rowsA = passRows(passTab()); asRole('user');
  const val = (rs, k) => (rs.find(r => r[0] === k) || [0, ''])[1];
  chk(55, {
    'вкладка «Паспорт» выбрана, строки — в рамке паспорта': has(sideOf(pD), '<button role="tab" data-tab="паспорт" aria-selected="true" class="on" onclick="KB.ui.tab(\'паспорт\')">Паспорт</button>') && has(pD, '<div class="sp-pane pv-pass"><div class="snap prelim">'),
    'строки по порядку: область видимости · показанный состав · уровни · строки объектов · отбор · источник': rowsD.map(r => r[0]).join(' · ') === 'область видимости · показанный состав · уровни · строки объектов · отбор · источник',
    'область видимости: подразделение и «видно 47 кредитов, скрыто 3»': val(rowsD, 'область видимости') === 'Отраслевой департамент промышленности · видно 47 кредитов, скрыто 3',
    'у уполномоченного — три подразделения и «видно 50, скрыто 0»': val(rowsA, 'область видимости') === 'Департамент администрирования кредитов, Отраслевой департамент промышленности, Региональное представительство «Ош» · видно 50 кредитов, скрыто 0',
    'показанный состав — показатели, формула «ƒ имя = выражение»': val(rowsD, 'показанный состав') === 'Сумма просроченной задолженности; Кредитов с просрочкой' && val(rowsF2, 'показанный состав') === 'Сумма просроченной задолженности; Кредитов с просрочкой; ƒ Доля = «Сумма просроченной задолженности» ÷ «Кредитов с просрочкой»',
    'уровни — «срок неплатежа · корзина «ступени» · с итогом → состояние кредита»': val(rowsD, 'уровни') === 'срок неплатежа · корзина «ступени» · с итогом → состояние кредита',
    'строки объектов — «только итоги групп» или перечень колонок с причинами': val(rowsD, 'строки объектов') === 'только итоги групп' &&
      has(val(rowsF2, 'строки объектов'), 'печатать строки: Номер договора, Заёмщик') && has(val(rowsF2, 'строки объектов'), 'Просроченная задолженность — под «Сумма просроченной задолженности»') && has(val(rowsF2, 'строки объектов'), 'стоят уровнем, в строке не повторяются: Дней просрочки'),
    'отбор — «без отбора» или «действующие (закрытые не входят) · в отборе 45 из 47»': val(rowsD, 'отбор') === 'без отбора' && val(rowsF2, 'отбор') === 'действующие (закрытые не входят) · в отборе 45 из 47',
    'источник — словами: «статистика, снимок 31.08.2026 · не зафиксировано»': val(rowsD, 'источник') === 'статистика, снимок 31.08.2026 · не зафиксировано',
    'нет снимка — «статистика: снимка на 05.09.2026 нет — чисел нет», охвата нет': val(rowsGap, 'источник') === 'статистика: снимка на 05.09.2026 нет — чисел нет' && val(rowsGap, 'область видимости') === 'Отраслевой департамент промышленности',
    '«сейчас» — «ядро, живой запрос — по кнопке «Посчитать»»': val(rowsNow, 'источник') === 'ядро, живой запрос — по кнопке «Посчитать»',
    'итог «один раз» — строкой «один раз» только там, где ключ есть': has(val(rowsQ, 'один раз'), 'Сумма требований, итого — каждый кредит требования один раз') && !rowsD.some(r => r[0] === 'один раз'),
    'вкладка «Паспорт» не печатает названий запросов и идентификаторов': !/statRows|statSlice|objectRows|\bs-[a-z]/.test(text(sideOf(pD)) + text(sideOf(passTab())))
  }, `вкладка «Паспорт»: ${rowsD.map(r => r[0]).join(' · ')}; видимость «${val(rowsD, 'область видимости')}», источник «${val(rowsD, 'источник')}» (на «сейчас» — «${val(rowsNow, 'источник')}», без снимка — «${val(rowsGap, 'источник')}»); ` +
    `у требования взыскания добавляется строка «один раз»; формула — «ƒ имя = выражение»; отбор — «в отборе N из 47»`);

  /* --- КН-14, КН-15: тексты экрана — слова пользователя, не номера решений, не имена запросов и не коды --- */
  /* Видимое = текст разметки + подсказки (title), подписи (aria-label) и подсказки полей (placeholder); обработчики и id — не видны. */
  const seen = h => text(h) + ' ' + [...h.matchAll(/\s(?:title|placeholder|aria-label|alt)="([^"]*)"/g)].map(m => m[1]).join(' ');
  /* Причины отказа идут на экран тостом через kbPlain: берём её из исходника страницы как есть. */
  const plainSrc = (src.match(/const kbPlain = t => [\s\S]*?;\n(?=const kbAns)/) || [''])[0].replace(/^const kbPlain = /, '').replace(/;\s*$/, '');
  const plain = plainSrc ? vm.runInContext('(' + plainSrc + ')', sandbox) : (x => x);
  const FORB = [['номер решения «КН-»', /КН-\d/], ['номер «ПВ-»', /ПВ-\d/], ['номер «ОЧ-»', /ОЧ-/], ['номер «ИО-»', /ИО-\d/], ['«ADR-»', /ADR-/],
    ['имя запроса statRows', /statRows/], ['имя запроса statSlice', /statSlice/], ['имя запроса objectRows', /objectRows/],
    ['«шов/швы»', /(^|[^а-яё])(шов|шва|шву|швом|шве|швы|швов|швам|швами|швах)(?![а-яё])/i], ['«живое ядро»', /живое ядро/i],
    ['код показателя/разреза вида s-…', /(^|[^A-Za-z0-9_-])[sacdpt]-[a-z][a-z0-9]*(-[a-z0-9]+)*/]];
  const pages = [];
  const page = (label, h) => pages.push([label, seen(h)]);
  /* стартовый экран: пустой, с найденным, со строкой «продолжить» */
  fresh(); S().started = false; page('старт', scr()); KB.ui.startFind({ value: 'просроч' }); page('старт · найденное', scr()); KB.ui.startFind({ value: '' });
  KB.ui.startObj('claim'); page('старт · объект без заготовок', scr()); KB.ui.startObj('credit'); KB.ui.toStart(); page('старт · «продолжить»', scr());
  /* рамка: все семь объектов, по умолчанию и со строками */
  ['credit', 'borrower', 'collateral', 'claim', 'asset', 'offer', 'app'].forEach(o => { fresh(); KB.setObject(o); S().started = true; page('рамка · ' + o, scr());
    KB.ui.tab('паспорт'); page('паспорт · ' + o, scr()); KB.ui.tab('настройки'); });
  /* рамка кредита: строки и «Колонки ▾», формула, редактор, отбор, раскладки, график */
  fresh(); KB.setDrill(true); KB.setActive(true); KB.addFilter('days', '>', 90); page('кредит · строки · отбор', scr());
  KB.ui.formEdit(null); KB.ui.formSave(); page('кредит · редактор формулы с ошибкой', scr()); KB.ui.formCancel();
  fresh(); KB.addFormula({ name: 'Доля', a: 's-overdue-sum', op: '÷', b: 's-overdue-cnt', unit: '', dp: 1 }); KB.setView({ layout: 'показатели в строках' }); page('кредит · формула · строки показателей', scr());
  KB.setView({ layout: 'разрез в колонках' }); page('кредит · сводка', scr()); KB.setView({ layout: 'показатели в колонках', chart: true }); page('кредит · график', scr());
  fresh(); S().cuts = S().cuts.slice(0, 1); KB.setView({ layout: 'разрез в колонках' }); page('кредит · один разрез', scr());
  fresh(); KB.setAsOf('2026-09-05'); page('кредит · нет снимка', scr()); KB.ui.tab('паспорт'); page('паспорт · нет снимка', scr()); KB.ui.tab('настройки');
  fresh(); KB.setMode('сейчас'); page('сейчас · до расчёта', scr()); KB.ui.calc(); page('сейчас · после расчёта', scr()); KB.toggleStat('s-overdue-cnt'); page('сейчас · состав изменён', scr());
  KB.ui.tab('паспорт'); page('паспорт · сейчас', scr()); KB.ui.tab('настройки');
  fresh(); KB.setObject('collateral'); KB.ui.mode('сейчас'); page('залог · «сейчас» отказано', scr());
  /* строки над листом: сняли при смене объекта, с дашборда, с готового отчёта, «на показе не будет» */
  fresh(); KB.setActive(true); KB.setObject('app'); page('смена объекта', scr());
  fresh(); KB.fromDashboard({ object: 'credit', stats: ['s-overdue-sum', 's-npl'], cuts: ['late'], filters: [], path: 'Главная › Просрочка' }); page('с дашборда', scr());
  fresh(); KB.startFromReport('t-sh-planfact'); page('с готового отчёта · общий', scr());
  fresh(); KB.startFromReport('t-avg'); page('с готового отчёта · чужой', scr());
  fresh(); KB.saveDraft('Со срезом'); page('после сохранения', scr()); KB.ui.ask(); page('отдан на утверждение', scr()); KB.ui.circle(true); page('открыт кругу', scr());
  fresh(); KB.setDrill(true); KB.ui.worklist(); KB.ui.export('pdf'); page('после выгрузки и рабочего списка', scr());
  ['auth', 'head'].forEach(r => { asRole(r); S().started = true; page('роль · ' + r, scr()); }); asRole('user'); S().started = true;
  /* причины отказов — как они доходят до тоста */
  fresh(); const refusals = [];
  KB.setObject('collateral'); refusals.push(KB.setMode('сейчас')); KB.seed(); S().started = true;
  refusals.push(KB.addFormula({ name: '', a: 's-overdue-sum', op: '÷', b: 's-portfolio' }), KB.addFormula({ name: 'x', a: 's-overdue-sum', op: '÷', b: 0 }), KB.addFormula({ name: 'y', a: 's-npl', op: '÷', b: 's-portfolio' }),
    KB.toggleStat('s-npl'), KB.addCut('нет-такого'), KB.setView({ layout: 'нет' }), KB.exportIssue('docx'), KB.startFromReport('t-нет-такого'), KB.fromDashboard({ object: 'нет', stats: [] }),
    KB.moveStat('s-overdue-sum', -1), KB.setBucket('late', 'нет-такой'), KB.setAsOf('2026-09-05'), KB.pinToDashboard(), KB.askPublish(), KB.askPublish(), KB.makeWorklist('x'), KB.startBlank('credit') && KB.exportIssue('xlsx'));
  refusals.filter(r => r && r.ok === false && r.why).forEach((r, i) => pages.push(['отказ ' + (i + 1), plain(r.why)]));
  const badTxt = []; pages.forEach(([label, t]) => FORB.forEach(([name, re]) => { const m = t.match(re); if (m) badTxt.push(label + ': ' + name + ' → «' + t.slice(Math.max(0, m.index - 30), m.index + 60).trim() + '»'); }));
  const nRef = pages.filter(p => /^отказ/.test(p[0])).length;
  chk(56, { ['просмотрены рамка, стартовый экран и причины отказов (kbPlain взята из страницы; страниц ' + pages.length + ', отказов ' + nRef + ', kbPlain ' + plainSrc.length + ' знаков)']: pages.length >= 50 && nRef >= 10 && plainSrc.length > 0 && pages.filter(p => !/^отказ/.test(p[0])).every(p => p[1].length > 100),
    ['в видимом тексте нет служебного (' + pages.length + ' страниц и отказов): ' + (badTxt.length ? badTxt.slice(0, 6).join(' | ') : 'чисто')]: badTxt.length === 0 },
    `просмотрено ${pages.length} видимых текстов (стартовый экран с найденным и «продолжить», рамка и паспорт всех семи объектов, строки, формулы, сводка, график, «сейчас», нет снимка, строки над листом, роли, причины отказов через kbPlain); ` +
    `нет номеров «КН-», «ПВ-», «ОЧ-», «ИО-», «ADR-», имён запросов statRows · statSlice · objectRows, слов «шов/швы», «живое ядро», кодов показателей вида s-…`);

  /* --- правка по ревью волны 61: «сохранён» — пока запись своя и личная; отчёт по имуществу с витрины; «один раз» — о показанных
     колонках; живой расчёт годен только для той же области видимости; вход извне — с чистого экрана --- */
  fresh(); const rv = KB.saveDraft('Ревью волны'), hv1 = scr(); RP.openToCircle(rv.tid, {force:true}); const hv2 = scr();
  S().started = false; const hv3 = scr(); S().started = true;
  fresh(); KB.startBlank('asset'); KB.toggleStat(KB.statsAvail().filter(x => x.ok)[0].id); const ra = KB.saveDraft('Имущество ревью'); RP.openToCircle(ra.tid, {force:true});
  const rAsset = KB.startFromReport(ra.tid), objAsset = S().object;
  fresh(); KB.startBlank('claim'); KB.toggleStat('s-q-count'); KB.addFormula({name:'Средняя на требование', a:'s-q-sum', op:'÷', b:'s-q-count', unit:'сом', dp:0});
  const aOp = KB.answer(); KB.ui.tab('паспорт'); const hOp = scr(); KB.ui.tab('настройки');
  fresh('auth'); KB.setMode('сейчас'); KB.compute(); const liveAuth = KB.answer().ok; RP.state.role = roleTitle('user'); const aRole = KB.answer();
  fresh(); const rEdit = KB.saveDraft('Своё ревью'); S().ui.find = 'Ош'; S().ui.fold = {'x': true}; RP.uiOpenPersonal(rEdit.tid);
  chk(57, {
    '«Открыть кругу» — запись уже не личная: шапка «не сохранён», на стартовом экране «продолжить»': has(hv1, 'личный, сохранён') && !has(hv2, 'личный, сохранён') && has(hv2, 'личный, не сохранён') && has(hv3, 'продолжить'),
    'общий отчёт по имуществу открывается копией': rAsset.ok && !rAsset.own && objAsset === 'asset',
    '«один раз» — только о колонках листа: операнд формулы с дедупом не назван': aOp.ok && !(aOp.passport.dedup || []).length && !has(hOp, '<span class="k">один раз</span>'),
    'живой расчёт другой роли не показывается — нужно «Посчитать»': liveAuth && !aRole.ok && aRole.stale === true,
    '«Править» на витрине — конструктор с чистого экрана': RP.state.view === 'draft' && S().saved === rEdit.tid && !S().ui.find && !Object.keys(S().ui.fold || {}).length
  }, `по ревью: шапка «сохранён» сверяется и с записью (после «Открыть кругу» — «не сохранён», стартовый экран предлагает «продолжить»); общий отчёт по имуществу и предложениям открывается копией; ` +
    `«один раз» в паспорте — только о показанных колонках; живой расчёт годен для той же области видимости; «Править» и черновик с дашборда входят с чистого экрана`);
})();

/* ---------- отчёт ---------- */
const pass = results.filter(r => r.pass).length;
const body = results.map(r => `  ${r.pass ? 'PASS' : 'FAIL'}  #${String(r.n).padStart(2)}  ${r.note}`).join('\n');
console.log(`Конструктор (в reports.html) smoke: ${pass}/${results.length} PASS\n` + body);

const injected = `  SMOKE ${new Date().toISOString().slice(0, 10)} · ${pass}/${results.length} PASS\n` + body;
if (src.includes('  SMOKE_PLACEHOLDER')) {
  writeFileSync(HTML, src.replace('  SMOKE_PLACEHOLDER', injected), 'utf8');
  console.log('\n→ результат вставлен в шапку reports.html');
} else {
  const re = /( {2}SMOKE \d{4}-\d{2}-\d{2} · \d+\/\d+ PASS\n)[\s\S]*?(\n-->)/;
  if (re.test(src)) {
    writeFileSync(HTML, src.replace(re, injected + '$2'), 'utf8');
    console.log('\n→ результат обновлён в шапке reports.html');
  }
}
process.exit(pass === results.length ? 0 : 1);
