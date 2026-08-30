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
// Блок O (#47…#52) закрывает волну 7 — сверку с Порядком №41: ключ строки расписания стал
// парой «тип лица × категория риска» (АН-37), охват и порог — ведомые поля строки (АН-39),
// обе чужие величины читаются на конец отчётного периода (АН-38), признак «только при
// действующих кредитах» из строки убран как вторая дверь одного правила (АН-54).
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
  const curatorSch = AN.setSchedule('sc-fl-high', { grace: 10 });
  AN.setRole('Администратор');
  const adminSch = AN.setSchedule('sc-fl-high', { grace: 10 });
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
  ok(25, !b5.defect && !b5.due && has(b5.why, 'категории риска у заёмщика нет') &&
        has(b5.why, 'без действующих кредитов не применяется') &&
        !/needLoans/.test(m[1]) && AN.state.schedule.every(r => !('needLoans' in r)),
    `заёмщику без действующих кредитов расписание анализа ничего не вменяет — и это сказано словами: ` +
    `«${b5.why.slice(0, 64)}…». Причина ОДНА и приходит от соседа: категории риска у такого заёмщика ` +
    `нет вовсе, второго признака «только при действующих кредитах» в строке расписания не осталось (АН-54)`);

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

/* ---------- K. Раздел обзоров живой, но своего конструктора состава среза в модуле
               нет ни одной функцией — состав объявляет редакция шаблона (ИА-7, ADR-0154) ---------- */
(() => {
  AN.seed();
  const nr = AN.newReview({});                    /* роль по умолчанию — куратор: отказ по роли */
  const own = AN.tryOwnBuilder();
  const builders = Object.keys(AN).filter(k => /slice|builder|срез/i.test(k) && !/^try/.test(k));
  const tpls = AN.templates().map(t => t.code);

  /* Раздел ЖИВОЙ: под ролью отдела анализа обзор заводится по-настоящему. И состав его
     приходит от редакции шаблона — в самой записи обзора состава нет, только ссылка. */
  AN.setRole('Сотрудник отдела анализа');
  const mk = AN.newReview({ tpl: 'ШО-04', asOf: '2026-06-30',
    period: { from: '2026-01-01', to: '2026-06-30' }, by: 'область', inds: ['s-port', 's-over'] });
  const rec = mk.ok ? AN.REVIEW(mk.no) : {};
  const c = mk.ok ? AN.reviewCuts(mk.no) : {};
  const i = mk.ok ? AN.reviewInds(mk.no) : {};
  /* Состав, скопированный в запись, — это и был бы «свой конструктор», только тихий. */
  const copied = ['dims', 'cutsAvail', 'composition', 'coefs', 'values', 'snapshot']
    .filter(k => k in rec);

  ok(35, !nr.ok && has(nr.why, 'обзоров не заводит') &&
        !own.ok && has(own.why, 'ИА-7') && has(own.why, 'ADR-0154 §2') &&
        mk.ok && c.ok && i.ok && c.tpl === 'ШО-04' && c.ed === rec.tplEd &&
        c.cuts.indexOf('область') >= 0 && c.dropped.length > 0 && i.inds.length > 0 &&
        copied.length === 0 &&
        tpls.length === 3 && AN.state.templates === undefined && builders.length === 0,
    `раздел обзоров живой: под ролью отдела анализа завёлся ${mk.no} по шаблону «${c.tpl}», ред. ` +
    `${c.ed} — и состав объявила ОНА: разрезов ${c.cuts.length} (${c.cuts.join(', ')}), отпало ` +
    `${c.dropped.length}, показателей ${i.inds.length}. В записи обзора состава нет ни одним полем ` +
    `(${copied.length} скопированных). Своего конструктора состава среза в модуле нет ни одной ` +
    `функцией; список шаблонов (${tpls.join(', ')}) приходит от отчётности, своего поля шаблонов в ` +
    `состоянии нет; «свой конструктор» отказан со ссылкой на ИА-7 и ADR-0154 §2`);
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
  ['borrower', 'doc', 'methods', 'schedule', 'reviews', 'review'].forEach(v => {
    const e = draw(() => AN.go(v)); if (e) errs.push(v + ': ' + e);
  });
  AN.go('borrower'); const b = panel();
  AN.go('doc');      const d = panel();
  AN.go('methods');  const me = panel();
  AN.go('schedule'); const sc = panel();
  AN.go('reviews');  const rv = panel();
  AN.go('review');   const rd = panel();
  ok(36, errs.length === 0 &&
        has(b, 'Откуда это поле') && has(b, 'Чего на этой карточке сделать нельзя') &&
        has(d, 'Снимок основания') && has(d, 'Источник изменён после утверждения') &&
        has(me, 'Чего в реестре завести нельзя') && has(sc, 'Кто вправе спрашивать') &&
        has(rv, 'Обзоры портфеля · реестр') && has(rv, 'Обзоров в реестре нет') &&
        has(rv, 'Раздел при этом открыт и работает') && has(rv, 'Завести обзор') &&
        has(rd, 'Обзоров в журнале нет'),
    `шесть экранов рисуются без ошибок${errs.length ? ': ' + errs.join(' · ') : ''}; зеркало названо ` +
    `зеркалом, снимок стоит под заключением, а раздел обзоров ОТКРЫТ: на пустом журнале реестр ` +
    `говорит «Обзоров в реестре нет — ни одного, и сказано это словами… Раздел при этом открыт и ` +
    `работает» и тут же даёт форму заведения, а документ обзора — «Обзоров в журнале нет»`);

  AN.go('borrower');
  AN.pickSubj('b-5');
  const empty = panel();
  AN.pickSubj('b-3');
  const nodoc = panel();
  ok(37, has(empty, 'Анализа нет') && has(empty, 'категории риска у заёмщика нет') &&
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
  AN.state.schedule.push({ id: 'sc-org-mid-2', ptype: 'организация', risk: 'mid', freq: 'полугодие',
    grace: 10, limit: 50000000, basis: 'п. 11.2', since: '2026-03-01' });
  const later = AN.dueOf('b-1');
  AN.seed();
  AN.state.schedule.push({ id: 'sc-org-mid-3', ptype: 'организация', risk: 'mid', freq: 'полугодие',
    grace: 10, limit: 50000000, basis: 'п. 11.2', since: '2026-08-01' });
  const afterEnd = AN.dueOf('b-1');
  const onePicker = (m[1].match(/function onDate/g) || []).length === 1 &&
    /rowOn\(AN\.state\.schedule/.test(m[1]) && !/rows\.find\(r => r\.ptype/.test(m[1]);
  ok(41, later.row === 'sc-org-mid-2' && later.due === '2026-07-10' &&
        afterEnd.row === 'sc-org-mid' && afterEnd.due === '2026-08-14' && onePicker,
    `вторая строка того же типа, вступившая в силу 01.03.2026, действует (срок ${later.due}); вступившая ` +
    `01.08.2026 — уже после конца периода — не действует (${afterEnd.due}); выбор записи на дату сделан одной функцией (ИА-17)`);

  /* АН-Д4: тип лица для срока — на конец отчётного периода, как и для методики (ИА-4, ИА-17). */
  AN.seed();
  AN.SUBJ('b-2').ptype[1].since = '2026-08-01';          /* снялся с учёта ПОСЛЕ конца периода */
  const atEnd = AN.dueOf('b-2');
  const mf = AN.methodFor('b-2', '2026-06-30');
  AN.state.schedule.find(r => r.id === 'sc-ip-high').freq = 'год';
  const split = AN.dueOf('b-2');
  const mirror = AN.mirrorDefect('b-2');
  ok(42, atEnd.required && atEnd.row === 'sc-ip-high' && atEnd.ptype === 'индивидуальный предприниматель' &&
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
  AN.state.schedule.find(r => r.id === 'sc-ip-high').freq = 'год';
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

/* ---------- O. Волна 7: охват и порог приходят нормой, а не типом лица ---------- */
(() => {
  /* АН-37/АН-39: ОХВАТ. Низкого риска в таблице нет вовсе — и это ответ, а не пробел;
     высокий вменяет анализ безусловно, какой бы маленькой ни была задолженность. */
  AN.seed();
  const noLowRow = AN.state.schedule.every(r => r.risk !== 'low');
  AN.SUBJ('b-1').risk = [{ since: '2025-01-01', v: 'low' }];
  const low = AN.dueOf('b-1');
  AN.seed();
  AN.SUBJ('b-3').debt = [{ since: '2026-01-15', v: 1000 }];
  const highTiny = AN.dueOf('b-3');
  ok(47, noLowRow && !low.required && has(low.why, 'Низкий кредитный риск') &&
        has(low.why, 'плановый анализ финансово-хозяйственного состояния не проводится') &&
        highTiny.required && highTiny.limit === null && highTiny.basis === 'п. 6.5' &&
        highTiny.row === 'sc-fl-high',
    `охват ставит норма, а не тип лица: по низкому риску строки нет и отказ назван — «${low.why.slice(0, 62)}…»; ` +
    `по высокому анализ вменён при задолженности 1 000 сом, порога у строки нет вовсе (п. 6.5)`);

  /* АН-39: ПОРОГ — поле строки, и сравнение строгое: норма говорит «более», а не «не менее». */
  AN.seed(); AN.SUBJ('b-1').debt = [{ since: '2025-01-01', v: 32400000 }];
  const below = AN.dueOf('b-1');
  AN.seed(); AN.SUBJ('b-1').debt = [{ since: '2025-01-01', v: 50000000 }];
  const exact = AN.dueOf('b-1');
  AN.seed();
  const above = AN.dueOf('b-1');
  ok(48, !below.required && has(below.why, '32 400 000,00') && has(below.why, '50 000 000,00') &&
        has(below.why, 'не превышает порог') && has(below.why, 'п. 11.2') && below.row === 'sc-org-mid' &&
        !exact.required && above.required && above.debt === 81400000 && above.limit === 50000000,
    `порог сравнивается строго: 32 400 000 и ровно 50 000 000 анализ не вменяют, 81 400 000 — вменяет. ` +
    `Отказ называет обе величины и пункт: «${below.why.slice(0, 74)}…»`);

  /* АН-38: категория и сумма читаются НА КОНЕЦ ПЕРИОДА — той же датой, что тип лица и
     редакция методики. У b-1 задолженность падает ниже порога 15.07.2026, уже после конца
     периода: прочитанная «на сегодня», она сняла бы обязательство за 1П 2026. */
  AN.seed();
  const dToday = AN.debtOn('b-1', AN.state.today), dEnd = AN.debtOn('b-1', '2026-06-30');
  const keptByDate = AN.dueOf('b-1');
  AN.seed(); AN.SUBJ('b-1').risk.push({ since: '2026-08-01', v: 'high' });
  const afterEnd = AN.dueOf('b-1');
  AN.seed(); AN.SUBJ('b-1').risk.push({ since: '2026-05-01', v: 'high' });
  const beforeEnd = AN.dueOf('b-1');
  ok(49, dToday === 44900000 && dEnd === 81400000 && keptByDate.required && keptByDate.debt === dEnd &&
        AN.riskOn('b-1', AN.state.today) === 'high' && afterEnd.risk === 'mid' &&
        afterEnd.row === 'sc-org-mid' && beforeEnd.risk === 'high' && beforeEnd.row === 'sc-org-high' &&
        beforeEnd.limit === null,
    `обе чужие величины взяты на конец периода: задолженность на 30.06 — ${dEnd.toLocaleString('ru-RU')}, на сегодня — ` +
    `${dToday.toLocaleString('ru-RU')}, срок стоит на первой (АН-38). Категория, поднявшаяся 01.08 — уже после конца ` +
    `периода, — строку не меняет (${afterEnd.row}); поднявшаяся 01.05 — меняет (${beforeEnd.row})`);

  /* АН-37: порог и охват — ВЕДОМЫЕ поля. Ни числа, ни названия категории в логике срока нет,
     а администратор меняет обязательность записью — без правки кода. */
  AN.seed();
  const dueSrc = m[1].slice(m[1].indexOf('AN.dueOf = subjId =>'), m[1].indexOf('AN.mirrorDefect ='));
  const dataSrc = m[1].slice(m[1].indexOf('const SCHEDULE = ['), m[1].indexOf('];', m[1].indexOf('const SCHEDULE = [')));
  const nAll = (m[1].match(/50000000/g) || []).length;
  const nData = (dataSrc.match(/50000000/g) || []).length;
  const cleanLogic = !/50\s?000\s?000|Средний кредитный риск|Высокий кредитный риск/.test(dueSrc);
  AN.setRole('Администратор');
  const raised = AN.setSchedule('sc-org-mid', { limit: 90000000 });
  const afterRaise = AN.dueOf('b-1');
  const cleared = AN.setSchedule('sc-org-mid', { limit: '' });
  const afterClear = AN.dueOf('b-1');
  const bad = AN.setSchedule('sc-org-mid', { limit: 'полсотни' });
  ok(50, nAll === nData && nData === 4 && cleanLogic && raised.ok && !afterRaise.required &&
        has(afterRaise.why, '90 000 000,00') && cleared.ok && afterClear.required &&
        afterClear.limit === null && !bad.ok && has(bad.why, 'пустое поле означает'),
    `порог живёт в записи, а не в коде: число ${nData} раза встречается только в справочнике расписания, ` +
    `в логике срока нет ни его, ни названий категорий. Администратор поднял порог до 90 000 000 — анализ ` +
    `перестал вменяться; очистил поле — вменяется безусловно; «полсотни» отклонено словами (ИА-18)`);

  /* АН-23: величины нет — назван отказ, а не показан чужой срок как свой; дефект из
     неразрешённого срока не рождается (ИА-13). */
  AN.seed();
  AN.SUBJ('b-1').debt = [];
  const noDebt = AN.dueOf('b-1');
  const noDebtMirror = AN.mirrorDefect('b-1');
  const gate = AN.mirrorGate('b-1');
  ok(51, !noDebt.required && noDebt.unresolved && noDebt.row === 'sc-org-mid' &&
        has(noDebt.why, 'ядро не отдало') && has(noDebt.why, 'решает администратор расписания') &&
        !noDebtMirror.defect && noDebtMirror.unresolved && gate.pass,
    `суммы задолженности ядро не отдало — срок не определён и назван словами: «${noDebt.why.slice(0, 66)}…». ` +
    `Дефект из неразрешённого срока не рождается, и гейт заявки на нём не спотыкается`);

  /* Экран показывает то же, что состояние: пару, порог, основание и обе даты. */
  const el = () => ({ innerHTML: '', textContent: '', dataset: {}, value: '',
    classList: { toggle() {}, add() {}, remove() {} }, appendChild() {}, remove() {} });
  const nodes = { '#panel': el(), '#title': el(), '#foot': el(), '#role': el(), '#subj': el() };
  sandbox.document = { querySelector: k => nodes[k] || el(), querySelectorAll: () => [],
    getElementById: () => null, createElement: () => el() };
  const panel = () => nodes['#panel'].innerHTML;
  AN.seed();
  AN.go('schedule');
  const scr = panel();
  AN.SUBJ('b-1').debt = [{ since: '2025-01-01', v: 32400000 }];
  AN.go('schedule');
  const scrBelow = panel();
  ok(52, has(scr, 'Категория риска') && has(scr, 'Порог задолженности') && has(scr, 'Основание') &&
        has(scr, 'порога нет') && has(scr, 'п. 11.2') && has(scr, 'Пара на конец периода') &&
        has(scr, 'организация × Средний кредитный риск') && has(scr, 'строка «sc-org-mid»') &&
        has(scrBelow, 'не превышает порог'),
    `на экране расписания видно то же, что в состоянии: пара, порог (и «порога нет» словами), пункт ` +
    `основания и пара НА КОНЕЦ ПЕРИОДА рядом с парой на сегодня; отказ по порогу стоит в таблице ` +
    `обязательств текстом, а не прочерком`);
})();

/* ---------- P. Чужая сторона: реестры и редакции ---------- */
(() => {
  const REP = win.REP, STAT = win.STAT;
  AN.seed();

  /* Пригодность под обзор — признак ШАБЛОНА, а не наше суждение о нём. */
  const t = REP.templates();
  const codes = t.list.map(x => x.code);
  ok(53, codes.length === 3 && codes.indexOf('ШО-21') < 0 &&
        ['ШО-04', 'ШО-09', 'ШО-12'].every(c => codes.indexOf(c) >= 0) &&
        t.passport.owner === 'отчётность',
    `основанием обзора служат ${codes.length} шаблона — ${codes.join(', ')}; «ШО-21» у соседа есть, ` +
    `но в список не попал: он перечисляет договоры и разрезов не объявляет`);

  /* Состав объявляет редакция, действующая НА ДАТУ, а не шаблон вообще (ИА-7). */
  const early = REP.reportTemplate('ШО-04', '2026-03-31');
  const late = REP.reportTemplate('ШО-04', '2026-06-30');
  ok(54, early.ok && late.ok && early.ed !== late.ed &&
        early.dims.indexOf('куратор') >= 0 && late.dims.indexOf('куратор') < 0,
    `редакцию шаблона выбирает дата: на 31.03.2026 действует ред. ${early.ed} (разрезы ${early.dims.join(', ')}), ` +
    `на 30.06.2026 — ред. ${late.ed} (${late.dims.join(', ')}): «куратор» действующей редакцией уже не объявлен`);

  /* Реестр показателей отвечает на дату — и вся чужая сторона отрезана от состояния. */
  const inds = STAT.indsOn('2026-06-30').list.map(x => x.id);
  const alien = m[1].slice(m[1].indexOf('/* ==ЧУЖАЯ СТОРОНА== */'), m[1].indexOf('/* ==/ЧУЖАЯ СТОРОНА== */'));
  const alienRows = alien.split('\n').length;
  const touches = alien.indexOf('AN.state') >= 0;
  ok(55, inds.indexOf('s-grace') < 0 && inds.indexOf('s-restr') >= 0 && inds.length === 6 &&
        AN.state.templates === undefined && !touches && alien.length > 500,
    `на 30.06.2026 в реестре ${inds.length} показателей (${inds.join(', ')}): выведенного 31.03 «s-grace» ` +
    `в нём нет, введённый 01.06 «s-restr» есть. Поля шаблонов в состоянии модуля нет вовсе, а в чужой ` +
    `стороне (${alienRows} строк) обращения к состоянию не найдено ни одного`);
})();

/* ---------- Q. Швы статистики: паспорт, порог, снимок ---------- */
(() => {
  const STAT = win.STAT;
  AN.seed();
  const ANALYST = 'Сотрудник отдела анализа';
  const CURATOR = 'Ведущий куратор (Асанов А.)';
  const rub = n => Number(n).toLocaleString('ru-RU');

  /* Три шва, один вопрос: показатель, дата, разрез, значения разреза, роль. */
  const sl = STAT.statSlice({ ind: 's-port', dim: 'область', date: '2026-06-30', who: ANALYST });
  const se = STAT.statSeries({ ind: 's-port', dim: 'область', date: '2026-06-30', who: ANALYST });
  const rw = STAT.statRows({ ind: 's-port', date: '2026-06-30',
    values: { 'область': 'Чуйская' }, who: ANALYST });

  /* Тот же вопрос без даты — и это отказ СОСЕДА (seamFail), а не пустая таблица. */
  const noDate = [STAT.statSlice({ ind: 's-port', dim: 'область', who: ANALYST }),
                  STAT.statSeries({ ind: 's-port', dim: 'область', who: ANALYST }),
                  STAT.statRows({ ind: 's-port', who: ANALYST })];
  const full = p => p && p.seam && p.owner === 'статистика' && p.asOf === '2026-06-30' &&
    p.mode && Array.isArray(p.scope) && p.scope.length === 3 && typeof p.short === 'string';
  const carries = r => 'nodes' in r || 'points' in r || 'rows' in r;
  ok(56, sl.ok && se.ok && rw.ok && [sl, se, rw].every(r => full(r.passport)) &&
        noDate.every(r => !r.ok && r.seamFail === true && has(r.why, 'без даты не отвечает') &&
          !carries(r)),
    `паспорт полон на всех трёх швах (${[sl, se, rw].map(r => r.passport.seam).join(', ')}): ` +
    `владелец «${sl.passport.owner}», дата ${sl.passport.asOf}, режимы «${[sl, se, rw].map(r => r.passport.mode).join('», «')}», ` +
    `охват ${sl.passport.scope.length} подразделения; краткая форма — «${rw.passport.short}». ` +
    `Без даты все три ответили отказом соседа и ни одной строкой: «${noDate[2].why.slice(0, 58)}…»`);

  /* Итог родителя приходит посчитанным, а не сложением детей: разницу держит unalloc. */
  const chuy = sl.nodes.find(n => n.key === 'Чуйская');
  const kids = chuy.kids.reduce((s, k) => s + k.v, 0);
  const tops = sl.nodes.reduce((s, n) => s + n.v, 0);
  ok(57, chuy.v !== kids && chuy.v - kids === chuy.unalloc && chuy.unalloc > 0 &&
        sl.total !== tops && sl.total - tops === sl.unalloc && sl.unalloc > 0 &&
        chuy.kids.every(k => k.unalloc === 0) && has(sl.why, 'посчитанным отдельно'),
    `итог родителя не равен сумме детей: «Чуйская» ${rub(chuy.v)}, четверо детей дают ` +
    `${rub(kids)}, разница ${rub(chuy.v - kids)} — ровно unalloc узла. На верхнем уровне ` +
    `итог ${rub(sl.total)} против ${rub(tops)} по четырём областям, разница ${rub(sl.unalloc)}; ` +
    `у листьев нераспределённого нет (unalloc 0)`);

  /* Порог: узкий вопрос — список, широкий — отказ с числом, усечения нет. И видимость
     применена ВНУТРИ шва: под куратором наружу не ушло ни одной чужой строки. */
  const wide = STAT.statRows({ ind: 's-port', date: '2026-06-30', who: ANALYST });
  const mine = STAT.statRows({ ind: 's-port', date: '2026-06-30', who: CURATOR });
  const slCur = STAT.statSlice({ ind: 's-port', dim: 'область', date: '2026-06-30', who: CURATOR });
  const alienRows = mine.ok ? mine.rows.filter(r => r.dims['куратор'] !== 'Асанов А.') : [{ id: '?' }];
  const mixed = rw.ok ? rw.rows.filter(r => r.fixation === 'смешанно') : [];
  ok(58, rw.ok && rw.rows.length === 7 && rw.rows.every(r => r.fixation) &&
        !wide.ok && wide.overLimit === true && wide.n === 14 && wide.limit === 12 &&
        !('rows' in wide) && has(wide.why, '14 объектов') && has(wide.why, 'порог показа — 12') &&
        has(wide.why, 'усечённого') &&
        mixed.length === 1 && mixed[0].id === 'p-04' && mixed[0].late['s-restr'] === '2026-07-14' &&
        mine.ok && mine.rows.length === 4 && alienRows.length === 0 &&
        mine.passport.narrowed === true && mine.passport.scope.length === 1 &&
        !slCur.ok && slCur.seamFail === true && has(slCur.why, 'вам открыто 4'),
    `statRows двоичен: узкий вопрос («область = Чуйская») вернул ${rw.rows.length} строк, ` +
    `широкий — отказ, а не усечение: «${wide.why.slice(0, 62)}…». Смешанная фиксация у ` +
    `«${mixed[0].subj}» (${mixed[0].id}): ${mixed[0].fixNote}. Видимость сработала внутри шва — ` +
    `куратору ушло ${mine.rows.length} строк из 14, чужих 0, охват в паспорте сузился до ` +
    `«${mine.passport.scope.join(', ')}», а снимок ему не отдан вовсе: «${slCur.why.slice(0, 46)}…»`);
})();

/* ---------- R. Обзор: заведение, состав, отказы ---------- */
(() => {
  AN.seed();
  AN.setRole('Сотрудник отдела анализа');

  /* Основание обзора — только форма, объявленная отчётностью пригодной; редакция
     фиксируется НА ДАТУ среза, и в записи обзора нет ни одного числа (ИА-7, ИА-20). */
  const bad = AN.newReview({ tpl: 'ШО-21', asOf: '2026-06-30',
    period: { from: '2026-01-01', to: '2026-06-30' }, by: 'область', inds: ['s-port'] });
  const jun = AN.newReview({ tpl: 'ШО-04', asOf: '2026-06-30',
    period: { from: '2026-01-01', to: '2026-06-30' }, by: 'отрасль',
    cuts: { 'область': 'Чуйская' }, inds: ['s-port', 's-over'] });
  const apr = AN.newReview({ tpl: 'ШО-04', asOf: '2026-04-30',
    period: { from: '2026-04-01', to: '2026-04-30' }, by: 'область', inds: ['s-port'] });
  const rec = jun.ok ? AN.REVIEW('ОБ-1') : {};
  const numbers = ['values', 'rows', 'points', 'total', 'passport', 'scope', 'snapshot'].filter(k => k in rec);
  ok(59, !bad.ok && has(bad.why, 'ШО-21') && has(bad.why, 'разрезов не объявляет') &&
        has(bad.why, 'ADR-0154 §2') && jun.ok &&
        rec.no === 'ОБ-1' && rec.tpl === 'ШО-04' && rec.tplEd === 2 && rec.asOf === '2026-06-30' &&
        rec.by === 'отрасль' && rec.cuts['область'] === 'Чуйская' &&
        rec.inds.join(',') === 's-port,s-over' && rec.state === 'черновик' &&
        rec.author === 'Осмонова Г.' && rec.issue === null && rec.worklist === null &&
        numbers.length === 0 && apr.ok && AN.REVIEW('ОБ-2').tplEd === 1,
    `обзор ${rec.no} заведён по шаблону ${rec.tpl}, ред. ${rec.tplEd} (на 30.06.2026 действует она; ` +
    `у обзора ОБ-2 на 30.04.2026 зафиксирована ред. ${apr.ok ? AN.REVIEW('ОБ-2').tplEd : '?'}), ` +
    `разбивка «${rec.by}», закреплено «область = ${rec.cuts['область']}», показатели ` +
    `${rec.inds.join(', ')}; чисел в записи нет — полей values/rows/points/total/passport/scope/snapshot ` +
    `${numbers.length}. Попытка завести обзор по ШО-21 отклонена: «${bad.why.slice(0, 132)}…»`);

  /* Два «нельзя» по показателю — разными словами, и разрез, не объявленный редакцией. */
  const ret = AN.tryRetiredInd('ОБ-2', 's-grace');
  const und = AN.tryUndeclaredInd('ОБ-2', 's-npl');
  const inds = AN.reviewInds('ОБ-2');
  const dRet = inds.ok ? inds.dropped.find(d => d.ind === 's-grace') : null;
  const dUnd = inds.ok ? inds.dropped.find(d => d.ind === 's-npl') : null;
  const cut = AN.tryFreeCut('ОБ-1', 'куратор');
  const own = AN.tryOwnBuilder();
  ok(60, !ret.ok && !und.ok && !!ret.why && !!und.why && ret.why !== und.why &&
        has(ret.why, 'в реестре статистики на 30.04.2026 он не состоит') && has(ret.why, 'ИА-6') &&
        has(und.why, 'редакция 1 шаблона «ШО-04» его не объявляет') && has(und.why, 'ADR-0154 §2') &&
        !has(und.why, 'ИА-6') && !has(ret.why, 'обзор его не дополняет') &&
        !!dRet && !!dUnd && dRet.why === ret.why && dUnd.why === und.why &&
        inds.inds.map(i => i.id).join(',') === 's-port,s-over,s-cnt' &&
        !cut.ok && has(cut.why, 'Ведущий куратор') && has(cut.why, 'не объявляет') && has(cut.why, 'ИА-7') &&
        !own.ok && has(own.why, 'ИА-7'),
    `выведенный из реестра и необъявленный показатели отказывают РАЗНЫМИ словами. ` +
    `s-grace: «${ret.why.slice(0, 158)}…». s-npl: «${und.why.slice(0, 158)}…». ` +
    `Оба названы отдельно и в составе обзора (доступно ${inds.inds.length}, отпало ${inds.dropped.length}). ` +
    `Разрез «куратор» на ОБ-1: «${cut.why.slice(0, 72)}…»; свой конструктор состава по-прежнему ` +
    `отказан со ссылкой на ИА-7`);

  /* Границы участка — свойство ТЕКСТА: обзор не знает ни одного справочника соседа. */
  const region = m[1].slice(m[1].indexOf('/* ==ОБЗОР== */'), m[1].indexOf('/* ==/ОБЗОР== */'));
  const banned = ['TEMPLATES', 'STAT_INDS', 'PORTFOLIO', 'SNAPS', 'DIMS', 'OUT',
    'agg(', 'passportOf(', 'visible('].filter(w => region.includes(w));
  ok(61, region.length > 1000 && banned.length === 0 &&
        region.includes('STAT.') && region.includes('REP.') &&
        !m[1].includes('pendingInvariants'),
    `участок ==ОБЗОР== занимает ${region.length} знаков, запрещённых имён в нём ${banned.length} ` +
    `(TEMPLATES STAT_INDS PORTFOLIO SNAPS DIMS OUT agg( passportOf( visible( ); наружу он ходит ` +
    `только через REP. и STAT.; лесов запертого раздела не осталось — pendingInvariants ` +
    `нет ни в участке, ни во всём коде макета`);
})();

/* ---------- S. Живой черновик: числа спрашиваются заново ---------- */
(() => {
  const STAT = win.STAT;
  const rub = n => Number(n).toLocaleString('ru-RU');
  const ANALYST = 'Сотрудник отдела анализа';
  const CURATOR = 'Ведущий куратор (Асанов А.)';

  /* Обзор по ШО-09: разбивка «подразделение», закреплена отрасль. На эту пару у
     статистики снимок есть — все три шва отвечают, и у каждого ответа свой паспорт. */
  AN.seed();
  AN.setRole(ANALYST);
  const mk = AN.newReview({ tpl: 'ШО-09', asOf: '2026-06-30',
    period: { from: '2026-01-01', to: '2026-06-30' }, by: 'подразделение',
    cuts: { 'отрасль': 'переработка' }, inds: ['s-over'] });

  const before = JSON.stringify(AN.state);
  const d1 = AN.reviewData('ОБ-1');
  const d2 = AN.reviewData('ОБ-1');
  const after = JSON.stringify(AN.state);
  const one = d1.ok ? d1.inds[0] : {};
  const total = one.slice && one.slice.ok ? one.slice.data.total : null;
  const revJson = JSON.stringify(AN.state.reviews);
  const hidden = total != null && revJson.indexOf(String(total)) < 0 &&
    revJson.indexOf(rub(total)) < 0;
  const three = [one.slice, one.series, one.rows];
  const passports = three.every(a => a && a.ok && a.passport && a.passport.owner === 'статистика' &&
    a.passport.asOf === '2026-06-30' && typeof a.passport.short === 'string' && a.data);
  ok(62, mk.ok && d1.ok && before === after && JSON.stringify(d1) === JSON.stringify(d2) &&
        total === 96400000 && hidden && passports && d1.inds.length === 1 && d1.stored === false,
    `обзор ${d1.no} (${d1.tpl}, ред. ${d1.tplEd}) открыт дважды и не записал ни байта: снимок ` +
    `состояния (${before.length} знаков) до и после совпал побайтно, второй ответ равен первому. ` +
    `Итог ${rub(total)} сом пришёл швом statSlice — в записи обзора его нет ни числом, ни строкой; ` +
    `у всех трёх ответов паспорт стоит РЯДОМ с числами: «${one.slice.passport.short}» (ИА-20, ИА-8)`);

  /* Числа спрашиваются ЗАНОВО — это видно счётчиком у самой статистики. И отказ шва
     экран не роняет: под суженной ролью агрегаты отказывают словами, строки сужаются. */
  AN.seed();
  AN.setRole(ANALYST);
  AN.newReview({ tpl: 'ШО-09', asOf: '2026-06-30',
    period: { from: '2026-01-01', to: '2026-06-30' }, by: 'подразделение', inds: ['s-over'] });
  const seams = AN.reviewSeams();
  const nSeams = seams.filter(s => s.numbers).length;
  const a0 = STAT.asked().total;
  const r1 = AN.reviewData('ОБ-1');
  const a1 = STAT.asked().total;
  const r2 = AN.reviewData('ОБ-1');
  const a2 = STAT.asked().total;
  let threw = null, narrow = null;
  try { narrow = AN.reviewData('ОБ-1', CURATOR); } catch (e) { threw = e.message; }
  const ni = narrow && narrow.ok ? narrow.inds[0] : {};
  const wide = r1.ok ? r1.inds[0].rows : {};
  ok(63, nSeams === 3 && seams.every(s => s.owner && s.q) && a1 - a0 === nSeams && a2 - a1 === nSeams &&
        r1.ok && r2.ok && threw === null && narrow.ok && narrow.who === CURATOR &&
        !ni.slice.ok && ni.slice.kind === 'отказ соседа' && ni.slice.data === null &&
        has(ni.slice.why, 'статистика не считала') && !ni.series.ok &&
        ni.rows.ok && ni.rows.data.n === 4 && ni.rows.passport.narrowed === true &&
        narrow.refused.length === 2 && narrow.answered === 1 && narrow.asks === 3 &&
        !wide.ok && wide.kind === 'отказ по форме',
    `счётчик обращений у статистики: ${a0} → ${a1} → ${a2} (${nSeams} шва на показатель) — второй раз ` +
    `сосед спрошен ЗАНОВО, ответ не переиспользован. Под ролью «${CURATOR}» агрегаты отказали ` +
    `словами: «${ni.slice.why.slice(0, 52)}…», строки сузились до ${ni.rows.data.n} из 14 и пришли с ` +
    `паспортом «${ni.rows.passport.short}»; отказавших швов ${narrow.refused.length} из ${narrow.asks}, ` +
    `исключения не выброшено — ответ пригоден к показу. Отдел анализа на том же вопросе получил от ` +
    `statRows «${wide.kind}»: «${(wide.why || '').slice(0, 44)}…»`);
})();

/* ---------- T. Утверждение обзора: выпуск с получателем ---------- */
(() => {
  const REP = win.REP;
  const ANALYST = 'Сотрудник отдела анализа';
  /* Поля, которых в записи обзора не бывает ни до утверждения, ни после: величина,
     её паспорт, её охват и снимок. Утверждение приносит ДВА НОМЕРА, а не числа.   */
  const NUMFIELDS = ['values', 'rows', 'points', 'total', 'passport', 'scope', 'snapshot'];

  /* --- #64. Утверждение — это ВЫПУСК у соседа, а не запись у себя --------------- */
  AN.seed();
  AN.setRole(ANALYST);
  const mk = AN.newReview({ tpl: 'ШО-09', asOf: '2026-06-30',
    period: { from: '2026-01-01', to: '2026-06-30' }, by: 'подразделение',
    cuts: { 'отрасль': 'переработка' }, inds: ['s-over'] });
  AN.setReviewText(mk.no, 'Просрочка по переработке сосредоточена в двух подразделениях.');
  AN.setReviewVerdict(mk.no, 'требует внимания');
  const j0 = REP.journal();
  const ap = AN.approveReview(mk.no);
  const j1 = REP.journal();
  const iss = j1.issues.find(i => i.no === ap.issue);
  const wl = j1.worklists.find(w => w.no === ap.worklist);
  const rec = AN.REVIEW(mk.no);
  const numbers = NUMFIELDS.filter(k => k in rec);
  const landed = ['issue', 'worklist', 'approvedAt', 'approvedBy'].filter(k => rec[k] != null);
  ok(64,
      ap.ok && j0.issues.length === 0 && j0.worklists.length === 0 &&
      j1.issues.length === 1 && j1.worklists.length === 1 &&
      !!iss && iss.recipient.kind === 'обзор' && iss.recipient.ref === mk.no &&
      iss.final === true && iss.kind === 'окончательный' && iss.at === TODAY &&
      !!wl && wl.from === iss.no && wl.objects.length === 5 &&
      rec.state === 'утверждено' && rec.issue === ap.issue && rec.worklist === ap.worklist &&
      rec.approvedAt === TODAY && rec.approvedBy === 'Осмонова Г.' &&
      typeof rec.issue === 'string' && typeof rec.worklist === 'string' &&
      landed.length === 4 && numbers.length === 0,
    `утверждение обзора ${mk.no} = окончательный выпуск ${ap.issue} у отчётности: получатель ` +
    `«${iss.recipient.kind} ${iss.recipient.ref}», дата ${iss.at}, паспорт «${iss.passport.short}»; ` +
    `рабочий список ${ap.worklist} родился тем же выпуском (from ${wl.from}, объектов ` +
    `${wl.objects.length}) и пришёл в одном ответе с ним. В журнале соседа было ` +
    `${j0.issues.length} выпусков, стало ${j1.issues.length}. В запись обзора легли ровно ` +
    `${landed.length} поля — issue «${rec.issue}», worklist «${rec.worklist}», approvedAt ` +
    `${rec.approvedAt}, approvedBy «${rec.approvedBy}» — и состояние «${rec.state}»; ` +
    `полей ${NUMFIELDS.join('/')} по-прежнему ${numbers.length}`);

  /* --- #65. Два разных отказа + пустой против частично отказавшего -------------- */
  AN.seed();
  AN.setRole(ANALYST);
  const pre = AN.tryApproveOnPreliminary('ОБ-1');
  const own = AN.tryOwnSnapshot('ОБ-1');
  /* Пустой случай: ШО-12 в разрезе «область» с одной просрочкой. Снимка на эту пару у
     статистики нет, ряда нет, а строк 14 при пороге 12 — отказали все три шва.     */
  const em = AN.newReview({ tpl: 'ШО-12', asOf: '2026-06-30',
    period: { from: '2026-01-01', to: '2026-06-30' }, by: 'область', inds: ['s-over'] });
  AN.setReviewText(em.no, 'Суждение написано, но подтвердить его нечем.');
  AN.setReviewVerdict(em.no, 'требует внимания');
  const dEm = AN.reviewData(em.no);
  const emptyTry = AN.tryApproveEmpty(em.no);
  const emptyReal = AN.approveReview(em.no);
  /* Частичный случай: ШО-04 в разрезе «область» с двумя показателями — четыре отказа
     из шести обращений, и это НОРМА: обзор с ними утверждается.                    */
  const pt = AN.newReview({ tpl: 'ШО-04', asOf: '2026-06-30',
    period: { from: '2026-01-01', to: '2026-06-30' }, by: 'область', inds: ['s-port', 's-over'] });
  AN.setReviewText(pt.no, 'Портфель вырос по всем областям; просрочки в этом разрезе нет.');
  AN.setReviewVerdict(pt.no, 'требует внимания');
  const dPt = AN.reviewData(pt.no);
  const part = AN.approveReview(pt.no);
  const partRec = AN.REVIEW(pt.no);
  ok(65,
      !pre.ok && !own.ok && !!pre.why && !!own.why && pre.why !== own.why &&
      has(pre.why, 'ОКОНЧАТЕЛЬНОГО') && has(own.why, 'МОЛЧА') &&
      dEm.answered === 0 && dEm.asks === 3 && dEm.refused.length === 3 &&
      !emptyTry.ok && emptyTry.empty === true && !emptyReal.ok &&
      emptyTry.why === emptyReal.why && AN.REVIEW(em.no).state === 'черновик' &&
      AN.REVIEW(em.no).issue === null &&
      dPt.answered === 2 && dPt.asks === 6 && dPt.refused.length === 4 &&
      part.ok && partRec.state === 'утверждено' && !!partRec.issue &&
      NUMFIELDS.filter(k => k in partRec).length === 0,
    `два отказа названы РАЗНЫМИ словами. tryApproveOnPreliminary: «${pre.why.slice(0, 96)}…» ` +
    `tryOwnSnapshot: «${own.why.slice(0, 96)}…». Обзор ${em.no} (ШО-12, разрез «область», ` +
    `s-over): ответило ${dEm.answered} швов из ${dEm.asks} — утверждение отказано, и слова у ` +
    `пробы и у настоящей операции одни: «${emptyTry.why.slice(0, 88)}…»; документ остался ` +
    `«${AN.REVIEW(em.no).state}», выпуска не случилось. Обзор ${pt.no} (ШО-04, разрез ` +
    `«область», s-port + s-over) с ${dPt.refused.length} отказами из ${dPt.asks} обращений ` +
    `УТВЕРЖДЁН: выпуск ${part.issue}, рабочий список ${part.worklist}, ответило ` +
    `${dPt.answered} шва — отказы соседа остались частью документа, чисел в записи ` +
    `по-прежнему нет`);

  /* --- #66. Охват утверждённого обзора = охват выпуска и не правится ------------ */
  AN.seed();
  const sr = AN.seedReviews();
  const j2 = REP.journal();
  const appr = AN.state.reviews.filter(r => r.state === 'утверждено');
  const drafts = AN.state.reviews.filter(r => r.state === 'черновик');
  const r1 = AN.REVIEW('ОБ-1');
  const sc = AN.reviewScope('ОБ-1');
  const iss1 = j2.issues.find(i => i.no === r1.issue);
  const scDraft = AN.reviewScope(drafts[0].no);
  const chg = AN.tryChangeScope('ОБ-1');
  ok(66,
      sr.ok && appr.length === 2 && drafts.length === 1 &&
      sc.ok && !!iss1 && sc.issue === r1.issue &&
      sc.scope.join('|') === iss1.scope.join('|') &&
      sc.scope.length === 3 && !('scope' in r1) &&
      sc.recipient.kind === 'обзор' && sc.recipient.ref === 'ОБ-1' && sc.final === true &&
      !scDraft.ok && has(scDraft.why, 'свойство ВЫПУСКА') &&
      !chg.ok && has(chg.why, r1.issue) && has(chg.why, 'выпустить ЗАНОВО'),
    `затравка прогнана настоящими операциями: ${appr.length} обзора утверждены (выпуски ` +
    `${appr.map(r => r.issue).join(', ')}, списки ${appr.map(r => r.worklist).join(', ')}), ` +
    `${drafts.length} остался черновиком (${drafts[0].no}, выпуска нет). Охват обзора ОБ-1 — ` +
    `«${sc.scope.join(', ')}» — совпал с охватом выпуска ${iss1.no} («${iss1.scope.join(', ')}»), ` +
    `а поля scope в записи обзора нет вовсе: охват спрошен у выпуска, а не сохранён. У ` +
    `черновика ${drafts[0].no} охвата нет: «${scDraft.why.slice(0, 72)}…». Правка охвата ` +
    `отказана: «${chg.why.slice(0, 104)}…»`);
})();

/* ---------- U. Корректировка суждения и пометка источника ---------- */
(() => {
  const REP = win.REP;
  const ANALYST = 'Сотрудник отдела анализа';
  const NUMFIELDS = ['values', 'rows', 'points', 'total', 'passport', 'scope', 'snapshot'];

  /* --- #67. Корректировка правит СУЖДЕНИЕ и нового выпуска не делает ------------ */
  AN.seed();
  AN.setRole(ANALYST);
  const mk = AN.newReview({ tpl: 'ШО-09', asOf: '2026-06-30',
    period: { from: '2026-01-01', to: '2026-06-30' }, by: 'подразделение',
    cuts: { 'отрасль': 'переработка' }, inds: ['s-over'] });
  AN.setReviewText(mk.no, 'Просрочка по переработке сосредоточена в двух подразделениях.');
  AN.setReviewVerdict(mk.no, 'требует внимания');
  /* Черновику корректировка не нужна: он правится полем. */
  const onDraft = AN.correctReview(mk.no, { text: 'Иначе.', why: 'опечатка' });
  const ap = AN.approveReview(mk.no);
  const was = { text: AN.REVIEW(mk.no).text, verdict: AN.REVIEW(mk.no).verdict };
  const sc0 = AN.reviewScope(mk.no);
  const j0 = REP.journal();
  const noBasis = AN.correctReview(mk.no, { text: 'Три подразделения, а не два.' });
  const alien = AN.correctReview(mk.no, { text: 'Три.', why: 'ошибка чтения', total: 1 });
  const cr = AN.correctReview(mk.no, {
    text: 'Просрочка по переработке сосредоточена в трёх подразделениях: одно было пропущено при чтении строк.',
    verdict: 'требует решения руководства',
    why: 'при подготовке кредитного комитета выяснилось, что третье подразделение прочитано неверно' },
    ANALYST);
  const j1 = REP.journal();
  const rec = AN.REVIEW(mk.no);
  const sc1 = AN.reviewScope(mk.no);
  const cTxt = rec.corrections.find(c => c.field === 'текст');
  const cVer = rec.corrections.find(c => c.field === 'вывод');
  ok(67,
      ap.ok && !onDraft.ok && has(onDraft.why, 'черновик') && has(onDraft.why, 'setReviewText') &&
      !noBasis.ok && has(noBasis.why, 'без основания') && has(noBasis.why, 'ADR-0112') &&
      !alien.ok && has(alien.why, 'ТОЛЬКО суждение') && has(alien.why, 'total') &&
      has(alien.why, 'АН-60') && AN.REVIEW(mk.no).text !== 'Три.' &&
      cr.ok && rec.corrections.length === 2 && !!cTxt && !!cVer &&
      cTxt.was === was.text && cTxt.now === rec.text && rec.text !== was.text &&
      cVer.was === 'требует внимания' && cVer.now === 'требует решения руководства' &&
      rec.verdict === 'требует решения руководства' &&
      cTxt.at === TODAY && cTxt.by === 'Осмонова Г.' && has(cTxt.basis, 'кредитного комитета') &&
      cVer.basis === cTxt.basis &&
      j0.issues.length === 1 && j1.issues.length === 1 &&
      j0.worklists.length === 1 && j1.worklists.length === 1 &&
      rec.issue === ap.issue && rec.worklist === ap.worklist && rec.state === 'утверждено' &&
      sc1.ok && sc0.ok && sc1.scope.join('|') === sc0.scope.join('|') && sc1.issue === sc0.issue,
    `корректировка обзора ${mk.no} тронула ТОЛЬКО суждение. Было: «${was.text}» / вывод ` +
    `«${was.verdict}». Стало: «${rec.text.slice(0, 64)}…» / вывод «${rec.verdict}». Основание — ` +
    `«${cTxt.basis.slice(0, 62)}…», автор ${cTxt.by}, дата ${cTxt.at}; записей «было → стало» ` +
    `${rec.corrections.length}, прежнее суждение из документа не пропало. Выпусков в журнале ` +
    `соседа было ${j0.issues.length}, стало ${j1.issues.length} — нового не случилось: ссылки ` +
    `${rec.issue}/${rec.worklist} и охват «${sc1.scope.join(', ')}» те же. Без основания отказ: ` +
    `«${noBasis.why.slice(0, 74)}…»; лишнее поле отклонено: «${alien.why.slice(0, 74)}…»`);

  /* --- #68. Ни переиздания, ни правки чисел; пометка чисел не двигает ----------- */
  AN.seed();
  const sr = AN.seedReviews();
  AN.setRole(ANALYST);
  const r1 = AN.REVIEW('ОБ-1');
  const draft = AN.state.reviews.filter(r => r.state === 'черновик')[0];
  const re = AN.tryReissueReview('ОБ-1');
  const cn = AN.tryCorrectNumbers('ОБ-1');
  const mark0 = AN.reviewMark('ОБ-1');
  const markDraft = AN.reviewMark(draft.no);
  const d0 = JSON.stringify(AN.reviewData('ОБ-1'));
  const rec0 = JSON.stringify(r1);
  /* Пометку ставит СОСЕД на свой выпуск — и без причины она не ставится. */
  const noCause = REP.numbersMoved({ issue: r1.issue, ind: 's-port', at: '2026-08-25' });
  const mv = REP.numbersMoved({ issue: r1.issue, ind: 's-port', at: '2026-08-25',
    cause: 'подразделение подало исправленный отчёт за июнь уже после сдачи формы', by: 'Отчётность' });
  const mark1 = AN.reviewMark('ОБ-1');
  const d1 = JSON.stringify(AN.reviewData('ОБ-1'));
  const rec1 = JSON.stringify(AN.REVIEW('ОБ-1'));
  const numbers = NUMFIELDS.filter(k => k in AN.REVIEW('ОБ-1'));
  ok(68,
      sr.ok && !re.ok && !cn.ok && !!re.why && !!cn.why && re.why !== cn.why &&
      has(re.why, 'переиздания у обзора') && has(re.why, 'АН-52') && has(re.why, 'ИА-16') &&
      has(cn.why, 'ТОЛЬКО суждение') && has(cn.why, 'АН-60') && has(cn.why, 'ИА-20') &&
      has(cn.why, 'ADR-0157 §4') &&
      mark0.ok && mark0.marked === false && mark0.n === 0 && has(mark0.why, 'не двигался') &&
      !markDraft.ok && has(markDraft.why, 'помечается ВЫПУСК') &&
      !noCause.ok && has(noCause.why, 'без причины') &&
      mv.ok && mv.issue === r1.issue &&
      mark1.ok && mark1.marked === true && mark1.n === 1 && has(mark1.why, 's-port') &&
      has(mark1.why, 'исправленный отчёт') && has(mark1.why, 'не пересчитывается') &&
      d0 === d1 && rec0 === rec1 && numbers.length === 0,
    `у обзора нет ни переиздания, ни правки чисел, и отказы РАЗНЫЕ. tryReissueReview: ` +
    `«${re.why.slice(0, 104)}…» tryCorrectNumbers: «${cn.why.slice(0, 104)}…». До пометки: ` +
    `«${mark0.why.slice(0, 66)}…». Сосед пометил выпуск ${r1.issue} (пометка ${mv.mark}), и обзор ` +
    `её ВИДИТ словами: «${mark1.why.slice(0, 118)}…». Числа при этом не сдвинулись: живой ответ ` +
    `швов до и после пометки совпал побайтно (${d0.length} знаков), запись обзора не изменилась ` +
    `(${rec0.length} знаков), полей ${NUMFIELDS.join('/')} в ней по-прежнему ${numbers.length}`);
})();

/* ---------- V. Задача по обзору: рукой руководителя ---------- */
(() => {
  const HEAD = 'Руководитель подразделения';
  const ANALYST = 'Сотрудник отдела анализа';
  const CURATOR = 'Ведущий куратор (Асанов А.)';
  const WHAT = 'выйти на заёмщика и представить график погашения просрочки на кредитный комитет';

  /* --- #69. Поручение ставит РУКА руководителя, и обзор о нём не знает ---------- */
  AN.seed();
  const sr = AN.seedReviews();
  const draft = AN.state.reviews.filter(r => r.state === 'черновик')[0];
  const rec0 = JSON.stringify(AN.REVIEW('ОБ-1'));
  const keys0 = Object.keys(AN.REVIEW('ОБ-1')).join(', ');
  const spec = { obj: 'p-11', what: WHAT, due: '2026-09-30' };
  /* Обзор ОБ-1 ведёт ОТДЕЛ АНАЛИЗА (автор Осмонова Г.), а поручает по нему руководитель:
     авторства для поручения не требуется — чужое суждение он не переписывает.        */
  const byAnalyst = AN.taskFromReview('ОБ-1', spec, ANALYST);
  const byCurator = AN.taskFromReview('ОБ-1', spec, CURATOR);
  const onDraft = AN.taskFromReview(draft.no, spec, HEAD);
  const outside = AN.taskFromReview('ОБ-2', { obj: 'p-03', what: WHAT, due: '2026-09-30' }, HEAD);
  const noWhat = AN.taskFromReview('ОБ-1', { obj: 'p-11', due: '2026-09-30' }, HEAD);
  const noDue = AN.taskFromReview('ОБ-1', { obj: 'p-11', what: WHAT }, HEAD);
  const t = AN.taskFromReview('ОБ-1', spec, HEAD);
  const lst = AN.tasksOfReview('ОБ-1');
  const rec1 = JSON.stringify(AN.REVIEW('ОБ-1'));
  const keys1 = Object.keys(AN.REVIEW('ОБ-1')).join(', ');
  const noRef = keys0 === keys1 && rec0 === rec1 &&
    !/task|поруч|задач/i.test(rec1) && rec1.indexOf(t.no) < 0;
  ok(69,
      sr.ok && t.ok && t.task.by === 'Тентимишев К.' && t.task.review === 'ОБ-1' &&
      t.task.obj === 'p-11' && t.task.subj === 'ОсОО «Кемин Цемент»' && t.task.due === '2026-09-30' &&
      t.task.basis.issue === AN.REVIEW('ОБ-1').issue &&
      lst.ok && lst.n === 1 && lst.tasks[0].no === t.no && has(lst.why, 'СОБРАН') && noRef &&
      !byAnalyst.ok && !byCurator.ok && !!byAnalyst.why && !!byCurator.why &&
      byAnalyst.why !== byCurator.why &&
      has(byAnalyst.why, 'работой не распоряжается') && has(byAnalyst.why, 'ИА-11') &&
      has(byCurator.why, 'обзоров не ведёт вовсе') && has(byCurator.why, 'ИА-11') &&
      !onDraft.ok && has(onDraft.why, 'по черновику') && has(onDraft.why, 'не подписано') &&
      !outside.ok && has(outside.why, 'в рабочем списке') && has(outside.why, 'ИА-20') &&
      !noWhat.ok && has(noWhat.why, 'без существа') && !noDue.ok && has(noDue.why, 'без срока'),
    `поручение ${t.no} поставлено рукой: ${t.task.by} (роль «${HEAD}») — «${t.task.subj}» ` +
    `(${t.task.obj}, ${t.task.contract}), срок ${t.task.due}, основание — обзор ОБ-1 и выпуск ` +
    `${t.task.basis.issue}; через AN.tasksOfReview видно ${lst.n}. Обзор ОБ-1 ведёт Осмонова Г., ` +
    `поручил Тентимишев К. — авторства для этого не нужно. В ЗАПИСИ ОБЗОРА ссылок на задачи нет: ` +
    `состав полей до и после совпал побайтно (${rec0.length} знаков) и остался прежним — ` +
    `${keys1}. Отделу анализа отказ один: «${byAnalyst.why.slice(0, 78)}…», куратору другой: ` +
    `«${byCurator.why.slice(0, 78)}…». По черновику ${draft.no} нельзя: ` +
    `«${onDraft.why.slice(0, 52)}…»; объект p-03 вне списка ОБ-2: «${outside.why.slice(0, 62)}…»`);

  /* --- #70. «Поручить всем сразу» — отказ, и после него задач столько же ---------- */
  AN.setRole(HEAD);
  const nBefore = AN.state.tasks.length;
  const mass = AN.tryMassTasks('ОБ-1');
  const nAfter = AN.state.tasks.length;
  const still = AN.tasksOfReview('ОБ-1');
  ok(70,
      !mass.ok && !!mass.why && has(mass.why, 'ИА-11') && has(mass.why, 'ОБХОД') &&
      has(mass.why, 'обзор задач не порождает') && has(mass.why, 'ни одного из 14') &&
      has(mass.why, 'отвечает') && nBefore === 1 && nAfter === nBefore && still.n === nBefore,
    `массовая постановка отказана словами, а не отсутствием кнопки — и отказана ` +
    `руководителю, у которого право поручать есть: «${mass.why.slice(0, 210)}…». Задач по ` +
    `ОБ-1 было ${nBefore}, после попытки ${nAfter} (AN.tasksOfReview даёт ${still.n}) — ` +
    `рабочий список из 14 объектов ни одного поручения не породил`);
})();

/* ---------- W. Экран обзора: паспорт рядом с числом ---------- */
(() => {
  /* Браузера у прогона нет, и «увидеть» экран можно только одним способом: подсунуть
     поддельный DOM и прочитать разметку, которую он собрал (приём блока L). Проверяется
     ровно то, что экран обязан НЕ ПРОГЛОТИТЬ, — молчаливое проглатывание не падает. */
  const el = () => ({ innerHTML: '', textContent: '', dataset: {}, value: '',
    classList: { toggle() {}, add() {}, remove() {} }, appendChild() {}, remove() {} });
  const nodes = { '#panel': el(), '#title': el(), '#foot': el(), '#role': el(), '#subj': el() };
  sandbox.document = { querySelector: k => nodes[k] || el(), querySelectorAll: () => [],
    getElementById: () => null, createElement: () => el() };
  const panel = () => nodes['#panel'].innerHTML;
  const draw = fn => { try { fn(); return null; } catch (e) { return e.message; } };
  const ANALYST = 'Сотрудник отдела анализа';
  const count = (s, re) => (s.match(re) || []).length;

  /* ПУСТОЙ ЖУРНАЛ. seed() обзоров не заводит — витрина зовётся отдельно, — поэтому
     «обзоров нет» здесь настоящее состояние, а не подстроенное. */
  AN.seed();
  const errZero = draw(() => AN.go('review'));
  const zero = panel();

  /* ВИТРИНА. ОБ-1 — смешанный случай: часть швов ответила, часть отказала, и оба рода
     отказа в нём разные. Роль названа явно: под куратором сузился бы охват. */
  AN.seedReviews();
  AN.setRole(ANALYST);
  const errFull = draw(() => AN.go('review'));
  const full = panel();
  const d1 = AN.reviewData('ОБ-1', ANALYST);

  ok(71, errZero === null && errFull === null &&
        has(full, 'ОБ-1 · Обзор портфеля') && has(full, '«ШО-04», редакция 2') &&
        has(full, '01.01.2026 — 30.06.2026') && has(full, 'Дата среза') &&
        has(full, '<span class="pill info">область</span>') &&
        has(full, 'Портфель за первое полугодие вырос') &&
        has(full, 'требует внимания') && has(full, 'ответило 2 из 6') &&
        has(full, 'Источник не двигался') && has(full, 'не поручено ничего') &&
        has(zero, 'Обзоров в журнале нет') && has(zero, 'ИА-14') && zero.length > 800,
    `экран обзора рисуется целиком (${full.length} знаков разметки) и без исключения: ОБ-1, шаблон ` +
    `«ШО-04», редакция 2, период 01.01.2026 — 30.06.2026, дата среза 30.06.2026, разрез «область» ` +
    `пилюлей .pill info, суждение и вывод «требует внимания» — и честная шапка «ответило 2 из 6». ` +
    `Пометка источника и ноль поручений напечатаны СЛОВАМИ, а не пустым местом. На пустом журнале ` +
    `экран тоже рисуется (${zero.length} знаков) и говорит: «Обзоров в журнале нет — ни одного, и ` +
    `сказано это словами… журнал обзоров пуст, потому что обзоров ещё не заводили» (ИА-14)`);

  /* ОТКАЗ ШВА ПРОИЗНОСИТСЯ. Паспортов на экране ровно столько, сколько ответивших швов:
     на месте отказавших стоят слова, а не пустая таблица и не прочерк. */
  const overLimit = d1.refused.filter(x => x.kind === 'отказ по форме');
  const seamFail = d1.refused.filter(x => x.kind === 'отказ соседа');
  ok(72, d1.asks === 6 && d1.answered === 2 && overLimit.length === 2 && seamFail.length === 2 &&
        count(full, /— отказ по форме<\/b>/g) === 2 && count(full, /— отказ соседа<\/b>/g) === 2 &&
        count(full, /Паспорт ответа/g) === d1.answered &&
        has(full, '<div class="refusal form">') &&
        has(full, '14 объектов при пороге 12') &&
        has(full, 'в этом числе 14 объектов, порог показа — 12') &&
        has(full, 'снимка «s-over» в разрезе «область» на 30.06.2026 у статистики нет') &&
        has(full, 'статистика · на 30.06.2026 · снимок на дату · охват: весь портфель') &&
        has(full, 'статистика · на 30.06.2026 · ряд снимков · охват: весь портфель'),
    `из 6 обращений ответило 2 — и ровно 2 паспорта стоят в разметке: на месте четырёх отказавших ` +
    `швов стоят СЛОВА, а не пустая таблица. Роды отказа не слиты: «отказ по форме» дважды ` +
    `(«в этом числе 14 объектов, порог показа — 12: списком не отдаётся…», отдельным классом ` +
    `.refusal form и пилюлей «14 объектов при пороге 12») и «отказ соседа» дважды («снимка ` +
    `«s-over» в разрезе «область» на 30.06.2026 у статистики нет: срез считается её прогоном…»). ` +
    `Рядом с ответившими числами стоит краткий паспорт производителя: «статистика · на 30.06.2026 ` +
    `· снимок на дату · охват: весь портфель» и «… · ряд снимков · …» (ИА-8, ИА-19, ADR-0152 §2)`);

  /* ПРОИЗВОДНЫЕ СЧИТАЮТСЯ В МОМЕНТ ПОКАЗА. Снимок состояния берётся ВОКРУГ РИСОВАНИЯ:
     go() уже отрисовал экран, поэтому сравнивается чистое повторное рисование. */
  const before = JSON.stringify(AN.state);
  AN.render();
  const after = JSON.stringify(AN.state);
  const leaked = ['47,7', '+0,03', '+6,7', 'п.п.'].filter(x => before.includes(x));

  /* Смешанная фиксация ни в одном обзоре витрины не всплывает (p-04 живёт в отрасли
     «услуги»), поэтому обзор на неё заводится настоящей операцией — как и вся витрина. */
  const mk = AN.newReview({ tpl: 'ШО-09', asOf: '2026-06-30',
    period: { from: '2026-01-01', to: '2026-06-30' }, by: 'подразделение',
    cuts: { 'отрасль': 'услуги' }, inds: ['s-over'] });
  AN.pickReview(mk.no);
  const mixed = panel();

  ok(73, before === after && leaked.length === 0 && mk.ok &&
        has(full, '47,7 %') && has(full, 'Доля, % целого') &&
        has(full, 'Изменение доли, п.п.') && has(full, '+0,03 п.п.') && has(full, '+0,01 п.п.') &&
        has(full, '+6,7 %') && has(full, 'величина') &&
        has(full, 'Сумма узлов') && has(full, '1 266 200 000,00') &&
        has(mixed, '<span class="pill warn">смешанно</span>') &&
        has(mixed, 'Подтянулось позже снимка') && has(mixed, 'Сумма показанных строк') &&
        has(mixed, 'сумма ПОКАЗАННЫХ строк'),
    `производные посчитаны в момент показа и не осели нигде: доля Чуйской области в итоге — ` +
    `47,7 % (612 300 000 из 1 284 600 000), доля нераспределённого остатка сдвинулась на ` +
    `+0,01 и +0,03 п.п. между тремя снимками ряда, сама величина при этом выросла на +6,7 % ` +
    `с пометкой «величина» — три единицы названы врозь, «%» у доли и «п.п.» у её изменения. ` +
    `Снимок состояния до и после рисования совпал побайтно (${before.length} знаков), и ни ` +
    `«47,7», ни «+0,03», ни «+6,7», ни «п.п.» в нём не встречается ни разу. Сумма узлов ` +
    `1 266 200 000,00 показана рядом с нераспределённым остатком, а не вместо итога. На обзоре ` +
    `${mk.no} (отрасль «услуги») смешанная фиксация показана иначе закрытой и объяснена словами, ` +
    `а итог строк подписан как сумма ПОКАЗАННЫХ строк (ADR-0001, ИА-8, ИА-20)`);
})();

/* ---------- X. Реестр обзоров: раздел открыт ---------- */
(() => {
  /* Тот же приём, что в блоках L и W: браузера нет, экран виден только через
     поддельный DOM. Полей формы заведения здесь на пять больше — реестр обязан не
     только показывать обзоры, но и заводить их, и проверяется именно это.        */
  const el = () => ({ innerHTML: '', textContent: '', dataset: {}, value: '',
    classList: { toggle() {}, add() {}, remove() {} }, appendChild() {}, remove() {} });
  const nodes = { '#panel': el(), '#title': el(), '#foot': el(), '#role': el(), '#subj': el() };
  ['nrTpl', 'nrFrom', 'nrTo', 'nrAsOf', 'nrBy', 'nrCutDim', 'nrCutVal', 'nrInds']
    .forEach(k => { nodes['#' + k] = el(); });
  sandbox.document = { querySelector: k => nodes[k] || el(), querySelectorAll: () => [],
    getElementById: () => null, createElement: () => el() };
  const panel = () => nodes['#panel'].innerHTML;
  const draw = fn => { try { fn(); return null; } catch (e) { return e.message; } };
  const ANALYST = 'Сотрудник отдела анализа';

  /* --- #74. Раздел открыт в меню и работает экраном ---------------------------- */
  /* Заперт раздел или нет — свойство РАЗМЕТКИ, а не намерения: читается сама шапка. */
  const nav = src.slice(src.indexOf('<div class="nav">'), src.indexOf('</aside>'));
  const navReviews = (nav.match(/<button[^>]*data-v="reviews"[^>]*>[^<]*<\/button>/) || [''])[0];
  const navReview  = (nav.match(/<button[^>]*data-v="review"[^>]*>[^<]*<\/button>/) || [''])[0];
  const navOpen = !!navReviews && !/\blocked\b/.test(navReviews) && !nav.includes('Ждёт отчётность');

  AN.seed();
  AN.seedReviews();
  AN.setRole(ANALYST);
  const errReg = draw(() => AN.go('reviews'));
  const reg = panel();
  const list = AN.reviews();
  const issues = list.filter(r => r.issue).map(r => r.issue);
  const shown = list.every(r => reg.includes(r.no)) && issues.every(x => reg.includes(x));

  /* Заведение — прямо с экрана: заполняются поля формы и зовётся её же обработчик. */
  const before = AN.reviews().length;
  nodes['#nrTpl'].value = 'ШО-09';
  nodes['#nrFrom'].value = '2026-01-01';
  nodes['#nrTo'].value = '2026-06-30';
  nodes['#nrAsOf'].value = '2026-06-30';
  nodes['#nrBy'].value = 'подразделение';
  nodes['#nrCutDim'].value = 'отрасль';
  nodes['#nrCutVal'].value = 'услуги';
  nodes['#nrInds'].value = 's-over';
  const errNew = draw(() => AN.newReviewUI());
  const after = AN.reviews().length;
  const made = AN.reviews()[after - 1] || {};
  const errAgain = draw(() => AN.go('reviews'));
  const reg2 = panel();

  /* Переход в документ: номер ставится ОБРАБОТЧИКОМ, а не показом. */
  AN.openReview('ОБ-2');
  const jumped = AN.state.review === 'ОБ-2' && AN.state.view === 'review';

  ok(74, navOpen && !!navReview && errReg === null && errNew === null && errAgain === null &&
        shown && issues.length === 2 && before === 3 && after === 4 &&
        made.no === 'ОБ-4' && made.cuts['отрасль'] === 'услуги' && made.state === 'черновик' &&
        reg2.includes('ОБ-4') && has(reg, 'Раздел открыт и работает') &&
        has(reg, 'утверждено') && has(reg, 'черновик') && jumped,
    `раздел обзоров открыт: в шапке «${navReviews.replace(/<[^>]*>/g, '')}» без класса locked, ` +
    `раздела «Ждёт отчётность» в разметке нет вовсе, рядом стоит «${navReview.replace(/<[^>]*>/g, '')}». ` +
    `Реестр нарисовался (${reg.length} знаков) и показал все ${before} обзора витрины ` +
    `(${list.map(r => r.no + ' — ' + r.state).join(', ')}) с номерами выпусков ${issues.join(', ')}. ` +
    `Заведение прямо с экрана сработало: формой заведён ${made.no} (ШО-09, ред. ${made.tplEd}, ` +
    `разбивка «${made.by}», закреплено отрасль = ${made.cuts['отрасль']}) — обзоров стало ${after} ` +
    `вместо ${before}, и новая строка встала в реестр. Клик по строке ОБ-2 ушёл в документ: ` +
    `состояние view=«${AN.state.view}», review=«${AN.state.review}» — номер поставлен обработчиком`);

  /* --- #75. Пустой реестр объясняется словами, лесов больше нет ---------------- */
  AN.seed();                      /* seed() обзоров не заводит — витрина зовётся отдельно */
  const errZero = draw(() => AN.go('reviews'));
  const zero = panel();
  const said = (zero.match(/Обзоров в реестре нет[^<]*/) || [''])[0];
  ok(75, errZero === null && AN.reviews().length === 0 &&
        has(zero, 'Обзоров в реестре нет — ни одного, и сказано это словами') &&
        has(zero, 'ИА-14') && has(zero, 'Раздел при этом открыт и работает') &&
        zero.indexOf('<table') < 0 && has(zero, 'Завести обзор') &&
        typeof AN.pendingInvariants === 'undefined',
    `пустой реестр рисуется без исключения (${zero.length} знаков) и объясняется СЛОВАМИ, а не ` +
    `пустой таблицей: тегов <table> в разметке ноль, сказано «${said.slice(0, 96)}…» со ссылкой на ` +
    `ИА-14 и «Раздел при этом открыт и работает — завести обзор можно прямо отсюда, формой ниже». ` +
    `Лесов запертого раздела не осталось: pendingInvariants больше нет (typeof — ` +
    `${typeof AN.pendingInvariants})`);
})();

/* ================= БЛОК S. ПАКЕТ ПЕРЕДАЧИ СВЕРЕН С КОДОМ ==========================
   ЗАЧЕМ ЭТА ПРОВЕРКА ВООБЩЕ ЕСТЬ. Пометка проверки #35 в шапке HTML однажды была
   поправлена руками (коммит 59232bb) и разошлась с текстом заметки в скрипте — ближайший
   же прогон молча вернул её назад, и правка пропала. Причина классовая: заметка живёт в
   двух местах — в скрипте и в шапке, — а машина сверяла только скрипт. Блок SMOKE в шапке
   принадлежит смоуку и правится ТОЛЬКО прогоном; преамбула над ним принадлежит человеку —
   и вот её никто не сверял с кодом. Отсюда #76: она читает ПРЕАМБУЛУ (всё до строки SMOKE,
   чтобы не наткнуться на собственные заметки прогона) и требует, чтобы пакет передачи не
   утверждал того, что код уже опроверг.                                              */
(function packageMatchesCode() {
  const headEnd = src.search(/ {2}SMOKE[ _]/);
  const head = src.slice(0, headEnd > 0 ? headEnd : src.indexOf('-->'));

  /* 1. Утверждения, которые волна 9 сделала ложью. */
  const stale = ['живого экрана', 'Ждёт отчётность', 'раздела аналитических обзоров здесь нет',
    'экран отказа', 'постановка словами', 'mockNote'].filter(w => head.includes(w));

  /* 2. Оба экрана раздела названы в преамбуле поимённо — так же, как в меню. */
  const screens = ['Обзоры портфеля · реестр', 'Обзор портфеля (документ)'];
  const named = screens.filter(s => head.includes(s));

  /* 3. Четыре маркерных участка перечислены в преамбуле И существуют в файле парами. */
  const marks = ['ВЫЧИСЛИТЕЛЬ', 'ЧУЖАЯ СТОРОНА', 'ОБЗОР', 'ПРОИЗВОДНЫЕ'];
  const listed = marks.filter(w => head.includes('==' + w + '=='));
  const real = marks.filter(w => src.includes('/* ==' + w + '==') &&
                                 src.includes('/* ==/' + w + '=='));

  /* 4. Восемь карточек этапа 8 разведены по экранам в карте «экран → задача». */
  const cards = [23, 24, 25, 26, 27, 28, 29, 30].map(n => 'P21-R' + n);
  const routed = cards.filter(id => head.includes(id));

  ok(76, stale.length === 0 && named.length === 2 && listed.length === 4 &&
        real.length === 4 && routed.length === 8,
    `шапка сверена с кодом: устаревших утверждений в преамбуле ${stale.length} ` +
    `(искали «живого экрана», «Ждёт отчётность», «раздела аналитических обзоров здесь нет», ` +
    `«экран отказа», «постановка словами», mockNote${stale.length ? ' — нашли: ' + stale.join(', ') : ''}); ` +
    `оба экрана раздела названы поимённо (${named.join(' · ')}); четыре маркерных участка ` +
    `перечислены в преамбуле и все четыре стоят в файле парами маркеров ` +
    `(${real.join(', ')}); восемь карточек этапа 8 разведены по экранам в карте «экран → задача» ` +
    `(${routed.join(', ')}). Преамбула читается до строки SMOKE — блок прогона в сверку не ` +
    `попадает, его пишет сам смоук`);
})();

/* ---- отчёт ---- */
const pass = results.filter(r => r.pass).length;
const lines = results.map(r => `   ${r.pass ? 'PASS' : 'FAIL'}  #${r.n}  ${r.note}`);
console.log(`SMOKE 2026-08-30 · ${pass}/${results.length} PASS\n` + lines.join('\n'));

const body = lines.map(l => '  ' + l).join('\n');
const injected = `  SMOKE 2026-08-30 · ${pass}/${results.length} PASS\n` + body;
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
