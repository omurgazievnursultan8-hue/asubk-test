// Headless smoke для mockups/analysis/analysis.html (ИА-1…ИА-14, ADR-0153…0155).
// Zero-dep: вытаскивает <script> из HTML и исполняет логический слой в node:vm (без DOM —
// render() и toast() при отсутствии document становятся no-op, экраны не рисуются).
// Проверяется поведение: снимок, датированный выбор методики, вычислитель из данных,
// два механизма правки, срок → обязательство → дефект, швы и названные отказы.
// Блок M (#39…#44) закрывает починки волны 4 — дефекты АН-Д1…АН-Д5: одна дверь переиздания,
// снимок без вывода, датированный выбор строки расписания, тип лица на конец периода,
// справочник строк формы как объект ведения.
// Блок N (#45, #46) закрывает починку волны 6 — дефект АН-Д6: у «посчитать нельзя» две
// причины (незаполненная строка и нулевой знаменатель), текст у них один на экран и на отказ.
// Блоки, которые правят состояние, начинаются с AN.seed() — состояние между ними не течёт.
//   node scripts/inspect/analysis-check.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dir = dirname(fileURLToPath(import.meta.url));
const HTML  = resolve(__dir, '../../mockups/analysis/analysis.html');
const src   = readFileSync(HTML, 'utf8');

const m = src.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('<script> не найден в HTML'); process.exit(1); }
const win = {};
const sandbox = { window: win, console, setTimeout: () => {}, clearTimeout: () => {} };
vm.createContext(sandbox);
vm.runInContext(m[1], sandbox, { filename: 'analysis.inline.js' });
const AN = win.AN;
if (!AN) { console.error('window.AN не экспортирован'); process.exit(1); }

const results = [];
const ok = (n, cond, note = '') => results.push({ n, pass: !!cond, note });
const has = (s, part) => String(s || '').includes(part);
const TODAY = '2026-08-21';

/* ---------- A. Реестр методик: применимость и закрытая форма коэффициента ---------- */
(() => {
  AN.seed();
  const st = AN.state;
  const noPtype = st.methods.filter(x => !x.ptype);
  const coefs = st.methods.reduce((a, x) => a.concat(x.editions.reduce((b, e) => b.concat(e.coefs), [])), []);
  const badOp = coefs.filter(c => AN.ops().indexOf(c.op) < 0);
  const withFormula = coefs.filter(c => 'formula' in c || 'expr' in c || 'выражение' in c);
  const badLine = coefs.reduce((a, c) => a.concat(c.num, c.den || []), []).filter(id => !AN.LINE(id));
  ok(1, st.methods.length === 4 && noPtype.length === 0 && coefs.length >= 14 &&
       badOp.length === 0 && withFormula.length === 0 && badLine.length === 0,
    `методик ${st.methods.length}, все с применимостью по типу лица; коэффициентов ${coefs.length}, ` +
    `с операцией вне списка ${badOp.length}, с текстом формулы ${withFormula.length}, со строкой вне справочника ${badLine.length} — ИА-3`);

  AN.setRole('Сотрудник отдела анализа');
  const univ = AN.addMethod({ id: 'm-all', name: 'Универсальная', ptype: null, editions: [] });
  const dup  = AN.addMethod({ id: 'm-org2', name: 'Вторая для организаций', ptype: 'организация', editions: [] });
  ok(2, !univ.ok && has(univ.why, 'для всех') && !dup.ok && has(dup.why, 'редакция — механизм изменения'),
    `методика «для всех» и вторая методика на тот же тип лица не заводятся: «${univ.why.slice(0, 60)}…»`);
})();

/* ---------- B. Вычислитель собран из данных, а не из веток ---------- */
(() => {
  const engine = m[1].slice(m[1].indexOf('/* ==ВЫЧИСЛИТЕЛЬ=='), m[1].indexOf('/* ==/ВЫЧИСЛИТЕЛЬ== */'));
  const words = ['ликвидн', 'автоном', 'рентабельн', 'нагрузк', 'покрыти', 'капитал', 'выручк', 'k-cur', 'k-auto']
    .filter(w => new RegExp(w, 'i').test(engine));
  ok(3, words.length === 0 && engine.length > 500,
    `в вычислителе (${engine.length} симв.) названий коэффициентов нет${words.length ? ': ' + words.join(', ') : ''} — ИА-3`);

  AN.seed();
  AN.setRole('Сотрудник отдела анализа');
  const m4 = AN.METHOD('m-fl');
  const base = m4.editions[m4.editions.length - 1];
  const before = AN.liveRatios('ФА-9').rows.length;
  const add = AN.addEdition({ method: 'm-fl', n: base.n + 1, since: TODAY, note: 'пятый коэффициент записью',
    lines: base.lines.concat(['inc']).filter((x, i, a) => a.indexOf(x) === i),
    coefs: base.coefs.concat([{ id: 'k-new', name: 'Новый показатель', num: ['inc'], den: ['pay_fl'],
      op: 'ratio', fmt: 'ratio', thr: { cmp: '>=', v: 2 } }]) });
  const ed = AN.METHOD('m-fl').editions.slice(-1)[0];
  const after = AN.liveRatios('ФА-9').rows.length;
  ok(4, add.ok && ed.coefs.length === base.coefs.length + 1 && after === before,
    `коэффициент заведён записью, без единой правки кода (было ${base.coefs.length}, стало ${ed.coefs.length}); ` +
    `заключение за 1П 2026 считается прежней редакцией (${after} коэф.) — новая действует с ${TODAY} (ИА-4)`);
})();

/* ---------- C. Методика датирована: тип лица НА ДАТУ ОТЧЁТНОСТИ ---------- */
(() => {
  AN.seed();
  const y2025 = AN.methodFor('b-2', '2025-12-31');
  const h2026 = AN.methodFor('b-2', '2026-06-30');
  ok(5, y2025.ok && h2026.ok && y2025.method.id === 'm-ip' && h2026.method.id === 'm-fl' &&
       AN.typeOn('b-2', '2025-12-31') === 'индивидуальный предприниматель' &&
       AN.typeOn('b-2', TODAY) === 'физическое лицо',
    `снявшийся с учёта ИП: 2025 год считается «${y2025.method.name}», 1П 2026 — «${h2026.method.name}»; ` +
    `«сегодня» на выбор не влияет (ИА-4)`);

  const engine = m[1].slice(m[1].indexOf('function typeOn'), m[1].indexOf('/* ==/ВЫЧИСЛИТЕЛЬ== */'));
  ok(6, !/today|сегодня|Date\.now/.test(engine),
    `в выборе типа лица и редакции слова «сегодня» нет ни в каком виде: функция принимает дату отчётности`);

  const org = AN.methodFor('b-1', '2025-12-31');
  const org2 = AN.methodFor('b-1', '2026-06-30');
  ok(7, org.ed.n === 1 && org2.ed.n === 2 && org.method.id === org2.method.id,
    `редакция тоже датирована: 2025 год по ред. 1, 1П 2026 по ред. 2 (действует с 01.04.2026) — ИА-5`);
})();

/* ---------- D. Черновик против снимка (ИА-1, ИА-2) ---------- */
(() => {
  AN.seed();
  const d = AN.DOC('ФА-7');
  ok(8, d.state === 'утверждено' && d.snapshot && d.snapshot.at === '2026-07-20' &&
       d.snapshot.ratios.length === 5 && d.snapshot.edSnap.n === 2 && d.snapshot.lines.ta_cur === 48200000,
    `снимок появился из approve(), а не выписан литералом: ${d.snapshot.ratios.length} коэф., ` +
    `строки основания и редакция методики внутри (ADR-0153 §2)`);

  const before = JSON.stringify(AN.ratiosOf('ФА-7').rows);
  AN.REPORT('r-102').vals.ta_cur = 1;                    /* источник подменили под ногами */
  const after = JSON.stringify(AN.ratiosOf('ФА-7').rows);
  ok(9, before === after,
    `утверждённое не пересчитывается даже когда источник изменился в базе: снимок отвечает сам за себя (ИА-1)`);

  AN.seed();
  const draft = AN.ratiosOf('ФА-9');
  ok(10, draft.live === true && AN.DOC('ФА-9').snapshot === null &&
        AN.analysisVerdict('b-2').no === 'ФА-6',
    `черновик считается живьём и снимка не имеет; наружу шов отдаёт последнее утверждённое (ФА-6), а не черновик (ИА-2)`);

  const chg = AN.sourceChanged('ФА-7');
  const w = AN.wouldBe('ФА-7');
  const cur0 = AN.DOC('ФА-7').snapshot.ratios.find(x => x.id === 'k-cur');
  const cur1 = w.rows.find(x => x.id === 'k-cur');
  ok(11, chg.length === 1 && has(chg[0].text, 'версия 2') && w.report.ver === 2 && cur1.v !== cur0.v,
    `уточнённый баланс подан после утверждения: пометка есть, пересчёта нет; рядом показано, что дал бы ` +
    `пересчёт (${cur0.v} → ${cur1.v}) — и это не записывается в заключение`);
})();

/* ---------- E. Утверждение = единственная подпись ---------- */
(() => {
  AN.seed();
  const nd = AN.newAnalysis({ subj: 'b-1', report: 'r-101' });
  const noText = AN.approve(nd.doc.no);
  AN.setText(nd.doc.no, 'Отчётность за 2025 год принята, деятельность прибыльна.');
  const noVerdict = AN.approve(nd.doc.no);
  AN.setVerdict(nd.doc.no, 'удовлетворительное');
  const good = AN.approve(nd.doc.no);
  const twice = AN.approve(nd.doc.no);
  ok(12, !noText.ok && has(noText.why, 'без текста') && !noVerdict.ok && has(noVerdict.why, 'вывод не выбран') &&
        good.ok && !twice.ok && has(twice.why, 'второй подписи'),
    `без текста и без вывода не утверждается; утверждённое второй раз не подписывается — «${twice.why.slice(0, 48)}…» (§2.3)`);

  const dup = AN.newAnalysis({ subj: 'b-2', report: 'r-202' });
  ok(13, !dup.ok && has(dup.why, 'ФА-9') && has(dup.why, 'второй черновик'),
    `второй черновик за тот же период не заводится: «${dup.why.slice(0, 60)}…»`);

  AN.seed();
  AN.REPORT('r-202').vals.exp_fix = null;                /* строку основания стёрли */
  const bad = AN.setText('ФА-9', 'текст') && AN.setVerdict('ФА-9', 'удовлетворительное') && AN.approve('ФА-9');
  const rows = AN.liveRatios('ФА-9').rows.filter(r => r.v === null);
  ok(14, !bad.ok && has(bad.why, 'не посчитан коэффициент') && rows.length > 0 && rows[0].missing.length > 0,
    `с непосчитанным коэффициентом заключение не утверждается: «${bad.why.slice(0, 70)}…» — подпись стоит под полным основанием`);
})();

/* ---------- F. Два механизма правки (ADR-0112) ---------- */
(() => {
  AN.seed();
  const snapBefore = JSON.stringify(AN.DOC('ФА-7').snapshot);
  const noBasis = AN.correct('ФА-7', { field: 'текст', value: 'иначе' });
  const nums = AN.correct('ФА-7', { field: 'коэффициент', value: 1.2, basis: 'служебная записка' });
  const good = AN.correct('ФА-7', { field: 'текст', value: 'Уточнена формулировка по нагрузке.',
    basis: 'служебная записка № 12 от 21.08.2026' });
  const snapAfter = JSON.stringify(AN.DOC('ФА-7').snapshot);
  ok(15, !noBasis.ok && has(noBasis.why, 'без основания') && !nums.ok && has(nums.why, 'числа корректировкой не правятся') &&
        good.ok && snapBefore === snapAfter && AN.DOC('ФА-7').corrections.length === 1,
    `корректировка требует основания, чисел не трогает и снимок не пересчитывает: «${good.note.slice(0, 60)}…»`);

  AN.seed();
  const same = AN.reissue('ФА-8');                       /* у b-4 версия одна */
  const re = AN.reissue('ФА-7');                          /* у b-1 подана версия 2 */
  ok(16, !same.ok && has(same.why, 'основание то же самое') && re.ok &&
        re.doc.prev === 'ФА-7' && re.doc.reportVer === 2 && AN.DOC('ФА-7').state === 'утверждено',
    `переиздание — только когда изменились обстоятельства: ${re.doc.no} на версии 2, прежнее ФА-7 остаётся в истории`);

  const edit = AN.setText('ФА-7', 'правка напрямую');
  const del = AN.tryDelete('ФА-7');
  ok(17, !edit.ok && has(edit.why, 'ADR-0112') && !del.ok && has(del.why, 'остаётся в'),
    `утверждённое напрямую не правится и не удаляется — оба отказа названы словами, а не отсутствием кнопки`);
})();

/* ---------- G. Кто что ведёт (§13) ---------- */
(() => {
  AN.seed();
  const own = AN.mayLead('b-1');
  const alien = (AN.setRole('Ведущий куратор (Асанов А.)'), AN.mayLead('b-1'));
  const analyst = (AN.setRole('Сотрудник отдела анализа'), AN.mayLead('b-1'));
  ok(18, own.ok && !alien.ok && has(alien.why, 'Бекова Н.') && !analyst.ok && has(analyst.why, 'ведущий куратор'),
    `финанализ ведёт ведущий куратор своего заёмщика: чужому отказ с именем куратора, отделу анализа — отказ по роли`);

  AN.seed();
  const byCurator = AN.addEdition({ method: 'm-org', n: 3, since: TODAY, note: 'x', lines: ['ta_cur', 'li_short'],
    coefs: [{ id: 'k-x', name: 'X', num: ['ta_cur'], den: ['li_short'], op: 'ratio', fmt: 'ratio', thr: { cmp: '>=', v: 1 } }] });
  AN.setRole('Сотрудник отдела анализа');
  const back = AN.addEdition({ method: 'm-org', n: 3, since: '2026-01-01', note: 'задним числом',
    lines: ['ta_cur', 'li_short'], coefs: [{ id: 'k-x', name: 'X', num: ['ta_cur'], den: ['li_short'], op: 'ratio', fmt: 'ratio', thr: { cmp: '>=', v: 1 } }] });
  const expr = AN.addEdition({ method: 'm-org', n: 3, since: TODAY, note: 'выражение',
    lines: ['ta_cur', 'li_short'], coefs: [{ id: 'k-x', name: 'X', num: ['ta_cur'], den: ['li_short'], op: 'median', fmt: 'ratio', thr: { cmp: '>=', v: 1 } }] });
  ok(19, !byCurator.ok && has(byCurator.why, 'отдел анализа') && !back.ok && has(back.why, 'задним числом') &&
        !expr.ok && has(expr.why, 'закрытого списка'),
    `методику ведёт отдел анализа; задним числом не публикуется (ИА-5); операция — только из списка ${AN.ops().join(', ')}`);

  const used = AN.retireEdition('m-org', 2);
  const free = AN.retireEdition('m-ip', 1);
  ok(20, !used.ok && has(used.why, 'ФА-7') && has(used.why, 'ИА-5') && !free.ok && has(free.why, 'ФА-6'),
    `редакция со ссылкой из заключения не снимается: «${used.why.slice(0, 70)}…»`);

  AN.seed();
  const curatorSch = AN.setSchedule('sc-fl', { grace: 10 });
  AN.setRole('Администратор');
  const adminSch = AN.setSchedule('sc-fl', { grace: 10 });
  const due = AN.dueOf('b-3');
  ok(21, !curatorSch.ok && has(curatorSch.why, 'администратор') && adminSch.ok && due.due === '2026-07-10',
    `расписание правит администратор, и срок пересчитывается от него: отсрочка 10 дней → срок ${due.due} (§7)`);
})();

/* ---------- H. Срок → обязательство → дефект (ИА-12, ИА-13) ---------- */
(() => {
  AN.seed();
  const b1 = AN.mirrorDefect('b-1');
  const b3 = AN.mirrorDefect('b-3');
  const b2 = AN.mirrorDefect('b-2');
  const b5 = AN.mirrorDefect('b-5');
  ok(22, b1.due.period === '1П 2026' && b1.due.due === '2026-08-14' && !b1.defect && has(b1.why, 'закрыто фактом'),
    `срок = конец периода + отсрочка (30.06 + 45 дн = 14.08); обязательство закрыто ФАКТОМ — утверждённым ФА-7 (ИА-12)`);
  ok(23, b3.defect && b3.influence === 'на допуск' && b3.late === 7 && has(b3.basis, 'sc-fl'),
    `у заёмщика без заключения дефект «${b3.code}» с влиянием «${b3.influence}», просрочка ${b3.late} дн., основание — строка расписания`);
  ok(24, b2.defect && has(b2.why, 'ФА-9') && has(b2.why, 'черновиком'),
    `черновик обязательства не закрывает: «${b2.why.slice(-60)}»`);
  ok(25, !b5.defect && !b5.due && has(b5.why, 'действующих кредитов нет'),
    `заёмщику без действующих кредитов расписание анализа ничего не вменяет — и это сказано словами`);

  const mark = AN.tryMarkDone();
  const stateStr = JSON.stringify(AN.state);
  const fields = /"defect"|"дефект"\s*:/.test(stateStr);
  ok(26, !mark.ok && has(mark.why, 'ИА-12') && !fields,
    `отметки «выполнено» нет, поля дефекта в состоянии модуля нет: дефект считается, а не хранится (ИА-13, ADR-0135)`);

  const gate3 = AN.mirrorGate('b-3');
  const gate1 = AN.mirrorGate('b-1');
  ok(27, !gate3.pass && has(gate3.text, 'на комиссию нельзя') && gate3.appl === 'ЗЯ-2026/318 — на рассмотрении' && gate1.pass,
    `гейт заявки читает дефект «на допуск»: заявка ${gate3.appl} не проходит, у заёмщика с анализом — проходит`);
})();

/* ---------- I. Швы наружу (ИА-9…ИА-14) ---------- */
(() => {
  AN.seed();
  const seams = AN.seams();
  const ratios = AN.callSeam('заявка и комиссия', 'analysisRatios', 'b-1');
  const draft = AN.callSeam('заявка и комиссия', 'analysisDraft', 'b-1');
  ok(28, seams.length === 2 && seams.join(',') === 'analysisVerdict,analysisDone' &&
        !ratios.ok && has(ratios.why, 'ADR-0153 §6') && !draft.ok && has(draft.why, 'ИА-2'),
    `наружу два шва; коэффициентов и черновиков не отдаёт ни один: «${ratios.why.slice(0, 60)}…»`);

  const cls = AN.callSeam('классификация', 'analysisVerdict', 'b-1');
  const task = AN.callSeam('задачи', 'analysisVerdict', 'b-1');
  ok(29, !cls.ok && has(cls.why, 'ИА-10') && !task.ok && has(task.why, 'ИА-11'),
    `классификация анализ не читает ни в одной форме, задачу анализ не ставит — оба отказа названы: «${cls.why.slice(0, 55)}…»`);

  const appl = AN.callSeam('заявка и комиссия', 'analysisVerdict', 'b-1');
  const done = AN.callSeam('сопровождение', 'analysisDone', 'b-1', '1П 2026');
  ok(30, appl.ok && appl.answer.no === 'ФА-7' && appl.answer.changed === true &&
        !('ratios' in appl.answer) && done.ok && done.answer.done === true,
    `analysisVerdict отдаёт номер, дату, вывод и пометку об изменившемся источнике — без чисел; analysisDone отдаёт факт`);

  const none = AN.analysisVerdict('b-5');
  ok(31, none.ok && none.none === true && none.text === 'анализа нет',
    `отсутствие заключения — это ответ словами «анализа нет», а не пустое место (ИА-14)`);

  const refusals = [AN.tryWriteBorrowerField(), AN.tryCreateTask(), AN.tryClassify(), AN.trySetRatio(),
    AN.tryDeriveVerdict(), AN.tryPrint(), AN.tryCurrentRatio('b-1')];
  const marks = ['ИА-9', 'ИА-11', 'ИА-10', 'ИА-3', 'ADR-0122 §3', 'ADR-0145 §4', 'ADR-0153 §6'];
  const bad = refusals.filter((r, i) => r.ok || !has(r.why, marks[i]));
  ok(32, bad.length === 0,
    `семь отказов названы словами и сослались на решение (${marks.join(', ')}) — «кнопки нет» не считается объяснением`);
})();

/* ---------- J. Отчётность — реквизит заёмщика ---------- */
(() => {
  AN.seed();
  const future = AN.addReport({ subj: 'b-1', period: '2П 2026', basis: 'x', vals: {} });
  const noBasis = AN.addReport({ subj: 'b-1', period: '1П 2026', basis: '', vals: {} });
  const partial = AN.addReport({ subj: 'b-1', period: '1П 2026', basis: 'уточнение', vals: { ta_cur: 1 } });
  const full = AN.addReport({ subj: 'b-1', period: '1П 2026', basis: 'уточнённый баланс от 21.08.2026',
    vals: { ta_cur: 49000000, li_short: 41000000, eq: 59000000, bal: 186000000, rev: 97000000,
      profit: 7500000, ebitda: 22000000, debt_all: 94000000, cf_oper: 24500000, debt_serv: 19000000 } });
  ok(33, !future.ok && has(future.why, 'ещё не завершился') && !noBasis.ok && has(noBasis.why, 'основания') &&
        !partial.ok && has(partial.why, 'Краткосрочные обязательства') && full.ok && full.report.ver === 3,
    `версия требует завершённого периода, документа-основания и полной формы, объявленной методикой; новая версия — ${full.report.ver}-я`);

  const v1 = AN.REPORT('r-102');
  ok(34, v1 && v1.ver === 1 && AN.usedBy('r-102').join(',') === 'ФА-7' && AN.DOC('ФА-7').report === 'r-102',
    `прежние версии не затёрты: ФА-7 по-прежнему стоит на версии 1, хотя поданы версии 2 и 3 (§2.1)`);
})();

/* ---------- K. Раздел обзоров заперт (ADR-0154) ---------- */
(() => {
  AN.seed();
  const nr = AN.newReview({});
  const own = AN.tryOwnBuilder();
  const pend = AN.pendingInvariants();
  const builders = Object.keys(AN).filter(k => /slice|builder|срез/i.test(k) && !/^try/.test(k));
  ok(35, !nr.ok && has(nr.why, 'ADR-0154') && !own.ok && has(own.why, 'ИА-7') &&
        pend.map(p => p.id).join(',') === 'ИА-6,ИА-7,ИА-8' && AN.templates().length === 0 && builders.length === 0,
    `обзор не заводится и своего конструктора состава в модуле нет ни одной функцией; ИА-6…ИА-8 записаны и ждут отчётность`);
})();

/* ---------- L. Экраны рисуются ---------- */
(() => {
  const el = () => ({ innerHTML: '', textContent: '', dataset: {}, value: '',
    classList: { toggle() {}, add() {}, remove() {} }, appendChild() {}, remove() {} });
  const nodes = { '#panel': el(), '#title': el(), '#foot': el(), '#role': el(), '#subj': el() };
  sandbox.document = { querySelector: k => nodes[k] || el(), querySelectorAll: () => [],
    getElementById: () => null, createElement: () => el() };
  const panel = () => nodes['#panel'].innerHTML;
  const draw = fn => { try { fn(); return null; } catch (e) { return e.message; } };

  AN.seed();
  const errs = [];
  ['borrower', 'doc', 'methods', 'schedule', 'reviews'].forEach(v => {
    const e = draw(() => AN.go(v)); if (e) errs.push(v + ': ' + e);
  });
  AN.go('borrower'); const b = panel();
  AN.go('doc');      const d = panel();
  AN.go('methods');  const me = panel();
  AN.go('schedule'); const sc = panel();
  AN.go('reviews');  const rv = panel();
  ok(36, errs.length === 0 &&
        has(b, 'Откуда это поле') && has(b, 'Чего на этой карточке сделать нельзя') &&
        has(d, 'Снимок основания') && has(d, 'Источник изменён после утверждения') &&
        has(me, 'Чего в реестре завести нельзя') && has(sc, 'Кто вправе спрашивать') &&
        has(rv, 'Почему заперто'),
    `пять экранов рисуются без ошибок${errs.length ? ': ' + errs.join(' · ') : ''}; зеркало названо зеркалом, снимок стоит под заключением, обзоры показывают отказ, а не заглушку`);

  AN.go('borrower');
  AN.pickSubj('b-5');
  const empty = panel();
  AN.pickSubj('b-3');
  const nodoc = panel();
  ok(37, has(empty, 'Анализа нет') && has(empty, 'действующих кредитов нет') &&
        has(nodoc, 'дефект') && has(nodoc, 'Гейт заявки'),
    `заёмщик без кредитов: «анализа нет» и «расписание ничего не вменяет» — оба словами; у просрочившего на карточке виден чужой счёт и гейт заявки`);

  AN.setRole('Администратор');
  AN.go('schedule');
  const adm = panel();
  AN.setRole('Ведущий куратор (Бекова Н.)');
  AN.go('methods');
  const roMethods = panel();
  ok(38, has(adm, 'Сохранить') && has(roMethods, 'Методики ведёт отдел анализа'),
    `администратору расписание открыто на правку, куратору реестр методик — на чтение с названной причиной (§13)`);
})();

/* ---------- M. Починки волны 4: АН-Д1…АН-Д5 ---------- */
(() => {
  /* АН-Д1: у переиздания одно правило, какой бы дверью его ни завели (ИА-16). */
  AN.seed();
  const byButton = AN.newAnalysis({ subj: 'b-1', report: 'r-103' });   /* кнопка у версии отчётности */
  AN.seed();
  const byDoc = AN.reissue('ФА-7');                                     /* кнопка в самом документе */
  AN.seed();
  const sameBasis = AN.newAnalysis({ subj: 'b-1', report: 'r-102' });   /* то же основание */
  AN.seed();
  const otherPeriod = AN.newAnalysis({ subj: 'b-1', report: 'r-101' }); /* другой период — не переиздание */
  const noArg = !/spec\.prev/.test(m[1]);
  ok(39, byButton.ok && byButton.doc.prev === 'ФА-7' && byDoc.ok && byDoc.doc.prev === 'ФА-7' &&
        byButton.doc.reportVer === byDoc.doc.reportVer && !sameBasis.ok && has(sameBasis.why, 'основание то же самое') &&
        otherPeriod.ok && otherPeriod.doc.prev === null && noArg,
    `обе двери дают один результат: ${byButton.doc.no} на версии ${byButton.doc.reportVer}, связь «← ФА-7» ` +
    `проставлена машиной (аргумента prev в вызове больше нет); на прежней версии отказ, за другой период — не переиздание (ИА-16)`);

  /* АН-Д2: вывод в снимок не входит (ИА-15, ADR-0153 §1). */
  AN.seed();
  const snaps = AN.state.analyses.filter(a => a.snapshot).map(a => a.snapshot);
  const withVerdict = snaps.filter(s => 'verdict' in s);
  const was = AN.DOC('ФА-7').verdict;
  AN.correct('ФА-7', { field: 'вывод', value: 'неудовлетворительное', basis: 'служебная записка № 5 от 21.08.2026' });
  const c = AN.DOC('ФА-7').corrections[0];
  ok(40, snaps.length === 3 && withVerdict.length === 0 &&
        AN.DOC('ФА-7').verdict === 'неудовлетворительное' && AN.analysisVerdict('b-1').verdict === 'неудовлетворительное' &&
        c.was === was && !('verdict' in AN.DOC('ФА-7').snapshot),
    `ни в одном из ${snaps.length} снимков поля вывода нет: снимок — основание, а не суждение; ` +
    `после корректировки документ и шов отдают одно значение, а «было» хранит таблица корректировок (ИА-15)`);

  /* АН-Д3: действующая на дату строка выбирается тем же порядком, что и редакция (ИА-17). */
  AN.seed();
  AN.state.schedule.push({ id: 'sc-org-2', ptype: 'организация', freq: 'полугодие', grace: 10,
    needLoans: true, since: '2026-03-01' });
  const later = AN.dueOf('b-1');
  AN.seed();
  AN.state.schedule.push({ id: 'sc-org-3', ptype: 'организация', freq: 'полугодие', grace: 10,
    needLoans: true, since: '2026-08-01' });
  const afterEnd = AN.dueOf('b-1');
  const onePicker = (m[1].match(/function onDate/g) || []).length === 1 &&
    /rowOn\(AN\.state\.schedule/.test(m[1]) && !/rows\.find\(r => r\.ptype/.test(m[1]);
  ok(41, later.row === 'sc-org-2' && later.due === '2026-07-10' &&
        afterEnd.row === 'sc-org' && afterEnd.due === '2026-08-14' && onePicker,
    `вторая строка того же типа, вступившая в силу 01.03.2026, действует (срок ${later.due}); вступившая ` +
    `01.08.2026 — уже после конца периода — не действует (${afterEnd.due}); выбор записи на дату сделан одной функцией (ИА-17)`);

  /* АН-Д4: тип лица для срока — на конец отчётного периода, как и для методики (ИА-4, ИА-17). */
  AN.seed();
  AN.SUBJ('b-2').ptype[1].since = '2026-08-01';          /* снялся с учёта ПОСЛЕ конца периода */
  const atEnd = AN.dueOf('b-2');
  const mf = AN.methodFor('b-2', '2026-06-30');
  AN.state.schedule.find(r => r.id === 'sc-ip').freq = 'год';
  const split = AN.dueOf('b-2');
  const mirror = AN.mirrorDefect('b-2');
  ok(42, atEnd.required && atEnd.row === 'sc-ip' && atEnd.ptype === 'индивидуальный предприниматель' &&
        mf.method.id === 'm-ip' && !split.required && split.unresolved &&
        has(split.why, 'срок не определён') && has(split.why, 'решает администратор') &&
        !mirror.defect && mirror.unresolved,
    `тип лица берётся на конец периода — и для методики, и для срока: строка «${atEnd.row}», методика «${mf.method.name}». ` +
    `Разошлись периодичности — назван отказ, а не молча показан чужой срок; дефект из него не рождается`);

  /* АН-Д5: строку формы отчётности заводит отдел анализа записью (ИА-18). */
  AN.seed();
  const byCurator = AN.addLine({ id: 'stock_end', name: 'Товарные остатки', unit: 'сом' });
  AN.setRole('Сотрудник отдела анализа');
  const badId = AN.addLine({ id: 'Товарные остатки', name: 'x', unit: 'сом' });
  const noUnit = AN.addLine({ id: 'stock_end', name: 'Товарные остатки на конец периода', unit: '' });
  const added = AN.addLine({ id: 'stock_end', name: 'Товарные остатки на конец периода', unit: 'сом' });
  const dup = AN.addLine({ id: 'stock_end', name: 'ещё раз', unit: 'сом' });
  const base = AN.METHOD('m-org').editions.slice(-1)[0];
  const ed = AN.addEdition({ method: 'm-org', n: 3, since: TODAY, note: 'взята новая строка формы',
    lines: base.lines.concat(['stock_end']),
    coefs: base.coefs.concat([{ id: 'k-stock', name: 'Остатки к обязательствам', num: ['stock_end'],
      den: ['li_short'], op: 'ratio', fmt: 'ratio', thr: { cmp: '>=', v: 0.5 } }]) });
  const namedBy = AN.usedByLine('stock_end');
  const retireUsed = AN.retireLine('stock_end');
  AN.addLine({ id: 'tmp_x', name: 'Временная', unit: 'шт.' });
  const retireFree = AN.retireLine('tmp_x');
  const onGone = AN.addEdition({ method: 'm-ip', n: 2, since: TODAY, note: 'на снятой строке',
    lines: ['rev_ip', 'tmp_x'], coefs: [{ id: 'k-y', name: 'Y', num: ['tmp_x'], den: ['rev_ip'],
      op: 'ratio', fmt: 'ratio', thr: { cmp: '>=', v: 1 } }] });
  const unknown = AN.addEdition({ method: 'm-ip', n: 2, since: TODAY, note: 'на неизвестной строке',
    lines: ['rev_ip'], coefs: [{ id: 'k-z', name: 'Z', num: ['nope'], den: ['rev_ip'],
      op: 'ratio', fmt: 'ratio', thr: { cmp: '>=', v: 1 } }] });
  ok(43, !byCurator.ok && has(byCurator.why, 'отдел анализа') && !badId.ok && has(badId.why, 'латиница') &&
        !noUnit.ok && has(noUnit.why, 'единицы измерения') && added.ok && !dup.ok && has(dup.why, 'уже есть') &&
        ed.ok && namedBy.length === 1 && !retireUsed.ok && has(retireUsed.why, 'ИА-5') && retireFree.ok &&
        !onGone.ok && has(onGone.why, 'снята со справочника') && !unknown.ok && has(unknown.why, 'ИА-18'),
    `новый показатель отчётности заводится записью отделом анализа и берётся редакцией без правки кода; ` +
    `названная редакцией строка не снимается, снятая и неизвестная в редакцию не берутся (ИА-18)`);

  /* Починенное видно на экранах, а не только в состоянии. */
  const el = () => ({ innerHTML: '', textContent: '', dataset: {}, value: '',
    classList: { toggle() {}, add() {}, remove() {} }, appendChild() {}, remove() {} });
  const nodes = { '#panel': el(), '#title': el(), '#foot': el(), '#role': el(), '#subj': el() };
  sandbox.document = { querySelector: k => nodes[k] || el(), querySelectorAll: () => [],
    getElementById: () => null, createElement: () => el() };
  const panel = () => nodes['#panel'].innerHTML;

  AN.seed();
  AN.setRole('Сотрудник отдела анализа');
  AN.go('methods'); const meth = panel();
  AN.setRole('Ведущий куратор (Бекова Н.)');
  AN.go('borrower'); const bor = panel();
  const re2 = AN.newAnalysis({ subj: 'b-1', report: 'r-103' });
  AN.openDoc(re2.doc.no); const reDoc = panel();
  AN.openDoc('ФА-7');     const snapDoc = panel();
  AN.SUBJ('b-2').ptype[1].since = '2026-08-01';
  AN.state.schedule.find(r => r.id === 'sc-ip').freq = 'год';
  AN.go('schedule'); const sch = panel();
  ok(44, has(meth, 'Справочник строк формы отчётности') && has(meth, 'Завести строку') &&
        has(bor, 'одна операция') && has(reDoc, 'Переиздаёт') && has(reDoc, 'Связь') &&
        has(snapDoc, 'Вывода в снимке нет') && has(sch, 'срок не определён'),
    `на экранах видно то же, что в состоянии: справочник строк ведётся из реестра методик, у переиздания ` +
    `названа связь и названо, что дверь одна, у снимка объяснено отсутствие вывода, неразрешённый срок показан словами`);
})();

/* ---------- N. Волна 6: «посчитать нельзя» называет СВОЮ причину (АН-Д6, ИА-19) ---------- */
(() => {
  const el = () => ({ innerHTML: '', textContent: '', dataset: {}, value: '',
    classList: { toggle() {}, add() {}, remove() {} }, appendChild() {}, remove() {} });
  const nodes = { '#panel': el(), '#title': el(), '#foot': el(), '#role': el(), '#subj': el() };
  sandbox.document = { querySelector: k => nodes[k] || el(), querySelectorAll: () => [],
    getElementById: () => null, createElement: () => el() };
  const panel = () => nodes['#panel'].innerHTML;

  /* Беда первая: строки заполнены, а знаменатель сложился в ноль. Ноль — ДАННЫЕ, и полноту
     формы внесение версии пропускает: до вычислителя такая отчётность доходит законно. */
  AN.seed();
  const vals = Object.assign({}, AN.REPORT('r-102').vals, { rev: 0 });
  const filed = AN.addReport({ subj: 'b-1', period: '1П 2026', vals,
    basis: 'уточнение по выручке от 29.08.2026' });
  const zd = AN.newAnalysis({ subj: 'b-1', report: filed.report.id });
  const rows = AN.liveRatios(zd.doc.no).rows;
  const ros = rows.find(x => x.id === 'k-ros');
  const counted = rows.filter(x => x.v != null);
  AN.setText(zd.doc.no, 'Выручка за период равна нулю: рентабельность не считается.');
  AN.setVerdict(zd.doc.no, 'удовлетворительное');
  const noSignZero = AN.approve(zd.doc.no);
  AN.openDoc(zd.doc.no); const zeroScreen = panel();

  /* Беда вторая, и она другая: строки основания в отчётности нет вовсе. */
  AN.seed();
  AN.REPORT('r-103').vals.rev = null;
  const ed = AN.newAnalysis({ subj: 'b-1', report: 'r-103' });
  const emptyRow = AN.liveRatios(ed.doc.no).rows.find(x => x.id === 'k-ros');
  AN.setText(ed.doc.no, 'Строка основания не заполнена.');
  AN.setVerdict(ed.doc.no, 'удовлетворительное');
  const noSignEmpty = AN.approve(ed.doc.no);
  AN.openDoc(ed.doc.no); const emptyScreen = panel();

  /* Текст причины собран в ОДНОМ месте, и его читают обе двери — экран и отказ в подписи. */
  const oneText = (m[1].match(/знаменатель равен нулю/g) || []).length === 1 &&
    /nocalcWhy\(bad\[0\]\)/.test(m[1]) && /esc\(nocalcWhy\(r\)\)/.test(m[1]);

  ok(45, filed.ok && ros.v === null && ros.nocalc.code === 'zeroden' && ros.missing.length === 0 &&
        has(AN.nocalcWhy(ros), 'знаменатель равен нулю') && has(AN.nocalcWhy(ros), 'Выручка за период') &&
        counted.length === 4 && counted.find(x => x.id === 'k-auto').v === 0.3315 &&
        counted.find(x => x.id === 'k-dte').v === 4.2202 &&
        emptyRow.nocalc.code === 'empty' && emptyRow.missing.length === 1 &&
        has(AN.nocalcWhy(emptyRow), 'не заполнены строки') && oneText,
    `нулевой знаменатель и незаполненная строка — РАЗНЫЕ причины: «${AN.nocalcWhy(ros)}» против ` +
    `«${AN.nocalcWhy(emptyRow)}»; остальные четыре коэффициента посчитаны (автономия 0,3315, долг ` +
    `к прибыли 4,2202), ноль в отчётности остаётся данными, текст причины собран одним местом (ИА-19)`);

  ok(46, !noSignZero.ok && has(noSignZero.why, 'Рентабельность продаж') &&
        has(noSignZero.why, 'знаменатель равен нулю') &&
        !noSignEmpty.ok && has(noSignEmpty.why, 'не заполнены строки') &&
        has(zeroScreen, 'не посчитан') && has(zeroScreen, 'знаменатель равен нулю: «Выручка за период» = 0') &&
        has(emptyScreen, 'в отчётности не заполнены строки «Выручка за период»'),
    `подпись отклонена той же причиной, что показана на экране: «${noSignZero.why.slice(0, 78)}…»; ` +
    `в таблице коэффициентов причина стоит под пометкой «не посчитан», а не обрывается пустым списком`);
})();

/* ---- отчёт ---- */
const pass = results.filter(r => r.pass).length;
const lines = results.map(r => `   ${r.pass ? 'PASS' : 'FAIL'}  #${r.n}  ${r.note}`);
console.log(`SMOKE 2026-08-29 · ${pass}/${results.length} PASS\n` + lines.join('\n'));

const body = lines.map(l => '  ' + l).join('\n');
const injected = `  SMOKE 2026-08-29 · ${pass}/${results.length} PASS\n` + body;
if (src.includes('  SMOKE_PLACEHOLDER')) {
  writeFileSync(HTML, src.replace('  SMOKE_PLACEHOLDER', injected), 'utf8');
  console.log('\n→ результат вставлен в шапку analysis.html');
} else {
  const re = /( {2}SMOKE \d{4}-\d{2}-\d{2} · \d+\/\d+ PASS\n)[\s\S]*?(\n-->)/;
  if (re.test(src)) {
    writeFileSync(HTML, src.replace(re, injected + '$2'), 'utf8');
    console.log('\n→ результат обновлён в шапке analysis.html');
  }
}
process.exit(pass === results.length ? 0 : 1);
