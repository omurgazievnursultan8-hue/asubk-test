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
  const scr = win.scAnswer ? win.scAnswer() : '';
  ok(3, r.ok && r.gap && !c.ok && !c.root && c.gap.reason === 'пропуск прогона' && c.gap.before === '2026-08-31' &&
        has(c.why, 'на 05.09.2026 снимка нет') && has(scr, 'чисел нет') && has(scr, 'KB.ui.asOf(\'2026-08-31\')'),
    `дата без снимка чисел не даёт: «${c.why}», ближайший снимок раньше — ${c.gap.before} кнопкой; соседний не подставляется (ИО-26, ПВ-8)`);
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
  const html = scAnswer();
  const rows = KB.rowsShown();
  const r0 = rows[0];
  const objRows = html.match(/<tr class="obj">[\s\S]*?<\/tr>/g) || [];
  const cellsOf = tr => (tr.match(/<td[^>]*>[\s\S]*?<\/td>/g) || []);
  const first = cellsOf(objRows[0]);
  ok(24, pl.under['s-c-pledge'] === 'pledge' && pl.under['s-c-avgsurv'] === 'surv' && pl.ident.join() === 'no,pledger' && pl.chips.join() === 'zstate' &&
        pl.skipped.join() === 'kind' && pl.extra.length === 0 && objRows.length === rows.length && first.length === 4 &&
        has(first[0], r0.no) && has(first[0], r0.pledger) && has(first[0], 'class="chip"') && has(first[0], r0.zstate) && !has(first[0], r0.kind) &&
        has(first[1], '·') && has(first[2], String(r0.pledge).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')) && has(first[3], String(r0.surv)) &&
        has(html, 'узел — сумма · строка — залоговая стоимость') && has(html, 'узел — среднее · строка — дней с последнего обследования') &&
        has(html, 'стоит уровнем'),
    `план строки: «залоговая стоимость» и «дней с обследования» встали ПОД колонками своих агрегатов (over реестра), «вид обеспечения» ` +
    `не печатается — стоит уровнем; номер и залогодатель — идентификатор, залоговый статус — чип; ${objRows.length} строк × ${first.length} ячеек, лишних колонок нет`);

  KB.seed(); KB.setDrill(true);                       // кредит: no, borrower, debt_main, days; уровни — срок неплатежа (days), состояние
  const p1 = KB.rowPlan(), h1 = scAnswer();
  KB.toggleStat('s-avg-late'); KB.toggleStat('s-portfolio');
  const p2 = KB.rowPlan(), h2 = scAnswer();
  const a2 = KB.answer();
  ok(25, p1.extra.join() === 'debt_main' && p1.skipped.join() === 'days' && count(h1, /только строки/g) === 1 && p1.under['s-overdue-sum'] === 'overdue' &&
        p2.extra.length === 0 && p2.under['s-avg-late'] === 'days' && p2.under['s-portfolio'] === 'debt_main' && count(h2, /только строки/g) === 0 &&
        a2.passport.shown.drill.some(x => has(x, 'Остаток основного долга — под своим агрегатом')) && !a2.passport.shown.drill.some(x => has(x, 'своей колонкой')),
    `мера без агрегата — своя колонка «только строки» («остаток» у кредита); «дней просрочки» стоит уровнем «срок неплатежа» и не повторяется; ` +
    `включили «Остаток, всего» — остаток ушёл под свой агрегат, колонок «только строки» 0, паспорт называет размещение`);
})();

/* ---------- G. Фильтры — редактор наборов: «или» из «и», «топ N» строкой после (ПВ-Д1, §3 п. 12, ОГ-9, ИО-17) ---------- */
(() => {
  KB.seed(); KB.setDrill(true);
  const all = KB.rowsShown();
  const A = r => r.days > 90, B = r => r.debt_main > 5000000, C = r => r.status === 'на взыскании';
  const nA = all.filter(A).length, nB = all.filter(B).length, nAnd = all.filter(r => A(r) && B(r)).length;
  const nOr = all.filter(r => A(r) || B(r)).length, nBC = all.filter(r => B(r) || C(r)).length, nOpen = all.filter(r => r.status !== 'закрыт').length;
  const nOrOpen = all.filter(r => (A(r) || B(r)) && r.status !== 'закрыт').length;
  KB.addFilter('days', '>', 90);
  const one = KB.answer();
  const s1 = KB.addSet(), s2 = KB.addSet();
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
        has(html, 'Набор 2') && has(html, '<div class="kor">или</div>') && has(html, '+ или — новый набор') && has(html, '+ и — условие') &&
        has(html, 'Порядок: охват роли → фильтры (наборы «или» из «и») → «топ N» → разрезы и итоги по отобранному.') &&
        chip.root.count === nOrOpen && nOrOpen < nOpen && chip.passport.shown.filters.indexOf('действующие (закрытые не входят)') === 1 &&
        ren === '0,1' && sets2 === 2 && after.root.count === nBC &&
        after.passport.shown.filters[0] === '(Остаток основного долга > 5000000) или (Состояние равно на взыскании)' &&
        last.root.count === nB && S().sets === 1 && last.passport.shown.filters.join() === 'Остаток основного долга > 5000000',
    `набор 1 «дней просрочки > 90» — ${nA} кредитов, набор 2 «остаток > 5 млн» — ${nB}, вместе ${nAnd}; «или» наборов дал ${or.root.count} = ` +
    `${nA} + ${nB} − ${nAnd}, посчитано отдельно по строкам среза; второй пустой набор подряд отказан словами («${s2.why}»); паспорт: «${or.passport.shown.filters[0]}»; ` +
    `чип «действующие» — «и» поверх наборов, не третий набор: ${chip.root.count}, а не ${nOpen}; снято последнее условие набора 1 — набор ушёл, ` +
    `остальные сдвинулись в наборы 1 и 2, ответ ${after.root.count}; снят и набор «на взыскании» — один набор, ${last.root.count}`);
})();
(() => {
  KB.seed(); KB.setDrill(true); KB.toggleStat('s-portfolio');   // остаток ставит «действующие» сам (ОД-7): чип — «и» поверх отбора
  KB.addFilter('days', '>', 0); KB.addSet(); KB.addFilter('debt_main', '>', 5000000, 1);
  const a0 = KB.answer(), base = KB.rowsShown(), M = base.length;
  const ids = rs => rs.map(r => r.id).sort().join(), sum = (rs, f) => rs.reduce((s, r) => s + r[f], 0);
  const sp = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const desc = base.slice().sort((x, y) => y.debt_main - x.debt_main), asc = base.slice().sort((x, y) => x.debt_main - y.debt_main);
  const t = KB.setTop(5, 'debt_main', 'первые');
  const a = KB.answer(), top = KB.rowsShown(), scr = win.scAnswer(), html = win.VIEWS.draft.fn();
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
        has(a.passport.short, 'вам видно ' + M + ' · в отборе 5 из ' + M) && has(scr, 'в отборе 5 из ' + M) &&
        has(html, '<option value="5" selected>5</option>') &&
        b.root.count === 5 && ids(low) === ids(asc.slice(0, 5)) && b.root.values['s-portfolio'] === sum(asc.slice(0, 5), 'debt_main') &&
        has(b.passport.shown.top, 'последние 5 по «Остаток основного долга»') &&
        !bad.ok && has(bad.why, '«Заёмщик» — текст') && keptDir === 'последние' &&
        clr.ok && topGone === null && c.root.count === M && c.passport.shown.top === null && !has(c.passport.short, 'в отборе') &&
        back.root.count === 5 && topBack && topBack.n === 5 && topBack.dir === 'первые' && setsBack === 2 && ids(KB.rowsShown()) === ids(top),
    `после наборов и чипа видно ${M}; «топ 5 по остатку» — 5 крупнейших из них (наибольший ${sp(desc[0].debt_main)}), итог «остатка» по отобранным ` +
    `${sp(a.root.values['s-portfolio'])} пришёл от статистики списком отобранных строк и равен сумме этих пяти, посчитанной отдельно; ` +
    `паспорт: «${a.passport.shown.top}»; «последние 5» — пять наименьших (от ${sp(asc[0].debt_main)}); по «заёмщику» отказано словами; ` +
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

  /* Блок «Показатели» — группами реестра и поиском; разрезы — группами по источнику и поиском. */
  const card = (h, from, to) => { const i = h.indexOf(from); return h.slice(i, h.indexOf(to, i)); };
  const names = h => (h.match(/<span class="t">[^<]*/g) || []).map(x => x.replace('<span class="t">', ''));
  KB.seed();
  const h0 = card(win.VIEWS.draft.fn(), '<h3>Показатели', '<h3>Разрезы');
  const all0 = names(h0).length, grp0 = (h0.match(/<details class="pal-d"/g) || []).length, open0 = (h0.match(/<details class="pal-d" open>/g) || []).length;
  KB.search('пен');
  const h1 = card(win.VIEWS.draft.fn(), '<h3>Показатели', '<h3>Разрезы'), n1 = names(h1);
  const sel = ['Сумма просроченной задолженности', 'Кредитов с просрочкой'];
  const keep = KB.answer().ok && KB.saveDraft('С поиском').ok && !('q' in S().drafts[0].comp) && S().stats.join() === 's-overdue-sum,s-overdue-cnt';
  KB.search('фактор', 'разрез');
  const c1 = card(win.VIEWS.draft.fn(), '<select id="addCut">', '</select>');
  const opts = (c1.match(/<option [^>]*>[^<]*/g) || []).map(x => x.replace(/<option [^>]*>/, ''));
  KB.setObject('claim'); const qGone = S().q === '' && S().qCut === '';
  ok(30, all0 === 42 && grp0 === 9 && open0 === 2 && has(h0, '<summary class="pal-g">статьи — остаток · 7</summary>') &&
        has(h0, '<summary class="pal-g">статьи — просрочено · 7</summary>') && has(h0, '<summary class="pal-g">свод · 3 · выбрано 1</summary>') &&
        has(h0, 'placeholder="поиск показателя по названию"') &&
        n1.length === 7 && n1.every(x => /пен/i.test(x) || sel.indexOf(x) !== -1) && sel.every(x => n1.indexOf(x) !== -1) &&
        has(h1, '<summary class="pal-g">статьи — остаток · 2 из 7</summary>') && keep &&
        opts.length === 8 && opts.every(x => x.indexOf('фактор риска') === 0) && has(c1, '<optgroup label="признаки риска · 8">') &&
        (c1.match(/<optgroup/g) || []).length === 1 && qGone,
    `кредит: показателей ${all0}, групп реестра ${grp0}, раскрыты ${open0} — где выбранное («статьи — остаток · 7», «свод · 3 · выбрано 1»); ` +
    `поиск «пен» оставил ${n1.length}: ${n1.join(', ')} — найденные и два выбранных; поиск в вопрос не входит (черновик без него); ` +
    `разрезы — группами по источнику значения, поиск «фактор» — ${opts.length} признаков риска одной группой; смена объекта поиск сбрасывает`);

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
