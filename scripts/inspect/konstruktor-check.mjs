// Headless smoke для mockups/reports/konstruktor.html — упрощённая страница пользователя
// «Конструктор: личный черновик состава» (волна 20). Zero-dep: вытаскивает <script> из HTML и
// исполняет логический слой в node:vm без DOM (render() при отсутствии document — no-op).
// Проверяется то, что дев-команда прочитает со страницы: область видимости в паспорте,
// отказы словами (объект без живых строк, выведенный и неисчислимый показатель, необъявленный
// разрез), число узла по строкам узла, корзина при чтении, подстановка даты, фиксация,
// личность черновика, предварительный выпуск, замороженный рабочий список, просьба о публикации.
//   node scripts/inspect/konstruktor-check.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dir = dirname(fileURLToPath(import.meta.url));
const HTML  = resolve(__dir, '../../mockups/reports/konstruktor.html');
const src   = readFileSync(HTML, 'utf8');

const m = src.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('<script> не найден в HTML'); process.exit(1); }
const win = {};
const sandbox = { window: win, console, setTimeout: () => {}, clearTimeout: () => {}, prompt: () => '' };
vm.createContext(sandbox);
vm.runInContext(m[1], sandbox, { filename: 'konstruktor.inline.js' });
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
  ok(3, r.ok && c.substituted === '2026-08-31' && c.passport.asked === '2026-09-05' && S().notices.some(n => has(n.text, 'снимка нет')),
    `дата без снимка подставляется ВСЛУХ: спрошено ${c.passport.asked}, показано ${c.substituted}, баннер называет подстановку (ИО-26)`);
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
  const cp = KB.addCut('program');
  const back = KB.setMode('на дату');
  ok(7, cp.ok && back.ok && back.dropped.length === 1 && back.dropped[0].kind === 'разрез' && !KB.cutAvail('program').ok && has(KB.cutAvail('program').why, 'прогон'),
    `необъявленный разрез «кредитная программа» доступен в «сейчас» и снят С ПОМЕТКОЙ при возврате в «на дату»: «${back.dropped[0].why.slice(0, 60)}…»`);
  KB.seed();
  const sw = KB.setObject('borrower'); KB.setObject('credit'); KB.setMode('сейчас');
  const sw2 = KB.setObject('borrower');
  ok(8, !sw.switched && sw2.switched && S().mode === 'на дату' && has(sw2.why, 'ИО-30'),
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
  const bs = KB.setBasis(), db = KB.toDashboard(), pb = KB.publish();
  ok(16, p1.ok && !p2.ok && S().asked.to === AUTH && !bs.ok && has(bs.why, 'публикующий') && !db.ok && has(db.why, 'объявленный') && !pb.ok && has(pb.why, AUTH),
    `просьба о публикации уходит ${AUTH}; норму, дашборд и публикацию черновику отказывают словами`);
})();

/* ---------- отчёт ---------- */
const pass = results.filter(r => r.pass).length;
const body = results.map(r => `  ${r.pass ? 'PASS' : 'FAIL'}  #${String(r.n).padStart(2)}  ${r.note}`).join('\n');
console.log(`konstruktor.html smoke: ${pass}/${results.length} PASS\n` + body);

const injected = `  SMOKE ${new Date().toISOString().slice(0, 10)} · ${pass}/${results.length} PASS\n` + body;
if (src.includes('  SMOKE_PLACEHOLDER')) {
  writeFileSync(HTML, src.replace('  SMOKE_PLACEHOLDER', injected), 'utf8');
  console.log('\n→ результат вставлен в шапку konstruktor.html');
} else {
  const re = /( {2}SMOKE \d{4}-\d{2}-\d{2} · \d+\/\d+ PASS\n)[\s\S]*?(\n-->)/;
  if (re.test(src)) {
    writeFileSync(HTML, src.replace(re, injected + '$2'), 'utf8');
    console.log('\n→ результат обновлён в шапке konstruktor.html');
  }
}
process.exit(pass === results.length ? 0 : 1);
