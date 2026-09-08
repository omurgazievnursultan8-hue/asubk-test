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
// Блок T (#77…#84) закрывает волну 10 — ИА-21…ИА-24: признак закрытости периода на лице
// документа из одного справочника (обе формы), заключение группового заёмщика одно на
// группу с повторяющимся блоком членов, свой контур доступа анализ не заводит — обзор
// читает контур шаблона, финанализ — контур заёмщика, черновик обеих форм — контур в
// одного автора.
// Блок U (#85…#89) закрывает волну 15 — дефект АН-Д9 и ИА-26: ключ заключения стал тройкой
// «заёмщик × период × повод», переиздание идёт внутри повода, шов analysisDone принимает
// повод третьим аргументом и без него отказывает, расписание вменяет только плановый повод,
// а виды повода ведёт отдел анализа записью — как строки формы (ADR-0233).
// Блок V (#90…#95) закрывает волну 15 — ИА-27: коэффициент объявляется КОДОМ ФОРМЫ РАСЧЁТА
// и её параметрами, а не выражением (ADR-0234). Каталог из шести форм — код разработчика
// (имя, поимённые параметры, своё слово отказа), объявление разбирается без единого поля
// свободного текста, четыре беды объявления названы четырьмя разными отказами, знак живёт
// в коде строки, а «сравнивать не с чем» — третья, СВОЯ причина «посчитать нельзя».
// Блок W (#96…#102) закрывает волну 15 — ИА-28: отчётность есть реквизит СУБЪЕКТА, а источник
// назван у КАЖДОЙ СТРОКИ, а не у версии целиком (ADR-0235). Разбор файла — способ заполнить
// версию, а не второй способ её внести; неразобранная строка называется поимённо; внешний
// источник объявлен перечнем, но дверью не является, и говорится это прямо; субъект без роли
// заёмщика отчётность ведёт, а анализа не получает — и швы отвечают о нём своим ответом,
// отличным от «анализа нет».
// Блок X (#103…#109) закрывает волну 15 — ИА-29: у запроса финансового пакета есть
// УСТАНОВЛЕННАЯ ДАТА, от которой норма считает 60 и 90 дней (п. 11.2, п. 11.3), и заведён
// запрос здесь, потому что состав пакета объявляет редакция методики (ADR-0236). Наружу
// уходит ФАКТ — даты и посчитанное число дней, без слов суждения и без порогов; классификации
// открыт факт и по-прежнему закрыто суждение (ИА-10); «анализа нет» получило три различимые
// причины взамен одного текста (ИА-14); дефекта по запросу модуль не считает.
// Блок Y (#110…#115) закрывает волну 15 — АН-83 и АН-85: динамика коэффициента ПОКАЗЫВАЕТСЯ,
// а не хранится. Ряд собирается из снимков прежних утверждённых заключений в момент показа
// (ADR-0001, ИА-22), упорядочен по КОНЦУ ПЕРИОДА, а не по дате подписи, живёт внутри одного
// повода и сравнивает только посчитанное одной методикой одной редакции — несопоставимость
// называется словами и своим кодом (method / edition / nocalc), а не прячется. Поля под ряд
// в заключении нет, и попытка его завести отказана по имени; строка ТЗ про AI-прогноз
// отвечена видом изменения во времени, а предсказание отказано по имени (АН-85).
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
  const catalogue = AN.forms().map(f => f.id);
  const badForm = coefs.filter(c => catalogue.indexOf(c.form) < 0);
  const withFormula = coefs.filter(c => 'formula' in c || 'expr' in c || 'выражение' in c);
  const badLine = coefs.reduce((a, c) => a.concat(AN.linesOf(c)), []).filter(id => !AN.LINE(id));
  ok(1, st.methods.length === 4 && noPtype.length === 0 && coefs.length >= 14 &&
       badForm.length === 0 && withFormula.length === 0 && badLine.length === 0,
    `методик ${st.methods.length}, все с применимостью по типу лица; коэффициентов ${coefs.length}, ` +
    `с формой вне каталога (${catalogue.join(', ')}) ${badForm.length}, с текстом формулы ${withFormula.length}, ` +
    `со строкой вне справочника ${badLine.length} — ИА-3, ИА-27`);

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
    coefs: base.coefs.concat([{ id: 'k-new', name: 'Новый показатель', form: 'ratio',
      p: { num: ['inc'], den: ['pay_fl'] }, fmt: 'ratio', thr: { cmp: '>=', v: 2 } }]) });
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
  const nd = AN.newAnalysis({ subj: 'b-1', report: 'r-101', occasion: 'plan' });
  const noText = AN.approve(nd.doc.no);
  AN.setText(nd.doc.no, 'Отчётность за 2025 год принята, деятельность прибыльна.');
  const noVerdict = AN.approve(nd.doc.no);
  AN.setVerdict(nd.doc.no, 'удовлетворительное');
  const good = AN.approve(nd.doc.no);
  const twice = AN.approve(nd.doc.no);
  ok(12, !noText.ok && has(noText.why, 'без текста') && !noVerdict.ok && has(noVerdict.why, 'вывод не выбран') &&
        good.ok && !twice.ok && has(twice.why, 'второй подписи'),
    `без текста и без вывода не утверждается; утверждённое второй раз не подписывается — «${twice.why.slice(0, 48)}…» (§2.3)`);

  const dup = AN.newAnalysis({ subj: 'b-2', report: 'r-202', occasion: 'plan' });
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
    coefs: [{ id: 'k-x', name: 'X', form: 'ratio', p: { num: ['ta_cur'], den: ['li_short'] }, fmt: 'ratio', thr: { cmp: '>=', v: 1 } }] });
  AN.setRole('Сотрудник отдела анализа');
  const back = AN.addEdition({ method: 'm-org', n: 3, since: '2026-01-01', note: 'задним числом',
    lines: ['ta_cur', 'li_short'], coefs: [{ id: 'k-x', name: 'X', form: 'ratio', p: { num: ['ta_cur'], den: ['li_short'] }, fmt: 'ratio', thr: { cmp: '>=', v: 1 } }] });
  const expr = AN.addEdition({ method: 'm-org', n: 3, since: TODAY, note: 'выражение',
    lines: ['ta_cur', 'li_short'], coefs: [{ id: 'k-x', name: 'X', form: 'median', p: { num: ['ta_cur'], den: ['li_short'] }, fmt: 'ratio', thr: { cmp: '>=', v: 1 } }] });
  ok(19, !byCurator.ok && has(byCurator.why, 'отдел анализа') && !back.ok && has(back.why, 'задним числом') &&
        !expr.ok && has(expr.why, 'в каталоге нет') && has(expr.why, 'граница ответственности'),
    `методику ведёт отдел анализа; задним числом не публикуется (ИА-5); форма расчёта — только из ` +
    `каталога ${AN.forms().map(f => f.id).join(', ')} (ИА-27)`);

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
  const evad = AN.callSeam('классификация', 'docsEvading', 'b-5', '1П 2026');
  ok(28, seams.length === 3 && seams.join(',') === 'analysisVerdict,analysisDone,docsRequested' &&
        !ratios.ok && has(ratios.why, 'ADR-0153 §6') && !draft.ok && has(draft.why, 'ИА-2') &&
        !evad.ok && has(evad.why, 'это СУЖДЕНИЕ') && has(evad.why, 'решения комитета'),
    `наружу три шва; коэффициентов и черновиков не отдаёт ни один: «${ratios.why.slice(0, 60)}…». ` +
    `Третий шов — факт, а не суждение, и готового признака «уклоняется» рядом с ним нет: ` +
    `«${evad.why.slice(0, 64)}…»`);

  const cls = AN.callSeam('классификация', 'analysisVerdict', 'b-1');
  const task = AN.callSeam('задачи', 'analysisVerdict', 'b-1');
  ok(29, !cls.ok && has(cls.why, 'ИА-10') && !task.ok && has(task.why, 'ИА-11'),
    `классификация анализ не читает ни в одной форме, задачу анализ не ставит — оба отказа названы: «${cls.why.slice(0, 55)}…»`);

  const appl = AN.callSeam('заявка и комиссия', 'analysisVerdict', 'b-1');
  const done = AN.callSeam('сопровождение', 'analysisDone', 'b-1', '1П 2026', 'plan');
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
  const byButton = AN.newAnalysis({ subj: 'b-1', report: 'r-103', occasion: 'plan' });   /* кнопка у версии отчётности */
  AN.seed();
  const byDoc = AN.reissue('ФА-7');                                     /* кнопка в самом документе */
  AN.seed();
  const sameBasis = AN.newAnalysis({ subj: 'b-1', report: 'r-102', occasion: 'plan' });   /* то же основание */
  AN.seed();
  const otherPeriod = AN.newAnalysis({ subj: 'b-1', report: 'r-101', occasion: 'plan' }); /* другой период — не переиздание */
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
  ok(40, snaps.length === 5 && withVerdict.length === 0 &&
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
    coefs: base.coefs.concat([{ id: 'k-stock', name: 'Остатки к обязательствам', form: 'ratio',
      p: { num: ['stock_end'], den: ['li_short'] }, fmt: 'ratio', thr: { cmp: '>=', v: 0.5 } }]) });
  const namedBy = AN.usedByLine('stock_end');
  const retireUsed = AN.retireLine('stock_end');
  AN.addLine({ id: 'tmp_x', name: 'Временная', unit: 'шт.' });
  const retireFree = AN.retireLine('tmp_x');
  const onGone = AN.addEdition({ method: 'm-ip', n: 2, since: TODAY, note: 'на снятой строке',
    lines: ['rev_ip', 'tmp_x'], coefs: [{ id: 'k-y', name: 'Y', form: 'ratio',
      p: { num: ['tmp_x'], den: ['rev_ip'] }, fmt: 'ratio', thr: { cmp: '>=', v: 1 } }] });
  const unknown = AN.addEdition({ method: 'm-ip', n: 2, since: TODAY, note: 'на неизвестной строке',
    lines: ['rev_ip'], coefs: [{ id: 'k-z', name: 'Z', form: 'ratio',
      p: { num: ['nope'], den: ['rev_ip'] }, fmt: 'ratio', thr: { cmp: '>=', v: 1 } }] });
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
  const re2 = AN.newAnalysis({ subj: 'b-1', report: 'r-103', occasion: 'plan' });
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
  const zd = AN.newAnalysis({ subj: 'b-1', report: filed.report.id, occasion: 'plan' });
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
  const ed = AN.newAnalysis({ subj: 'b-1', report: 'r-103', occasion: 'plan' });
  const emptyRow = AN.liveRatios(ed.doc.no).rows.find(x => x.id === 'k-ros');
  AN.setText(ed.doc.no, 'Строка основания не заполнена.');
  AN.setVerdict(ed.doc.no, 'удовлетворительное');
  const noSignEmpty = AN.approve(ed.doc.no);
  AN.openDoc(ed.doc.no); const emptyScreen = panel();

  /* Текст причины собран в ОДНОМ месте, и его читают обе двери — экран и отказ в подписи. */
  const oneText = (m[1].match(/целое равно нулю/g) || []).length === 1 &&
    /nocalcWhy\(bad\[0\]\)/.test(m[1]) && /esc\(nocalcWhy\(r\)\)/.test(m[1]);

  ok(45, filed.ok && ros.v === null && ros.nocalc.code === 'zeroden' && ros.missing.length === 0 &&
        has(AN.nocalcWhy(ros), 'целое равно нулю') && has(AN.nocalcWhy(ros), 'Выручка за период') &&
        counted.length === 4 && counted.find(x => x.id === 'k-auto').v === 0.3315 &&
        counted.find(x => x.id === 'k-dte').v === 4.2202 &&
        emptyRow.nocalc.code === 'empty' && emptyRow.missing.length === 1 &&
        has(AN.nocalcWhy(emptyRow), 'не заполнены строки') && oneText,
    `нулевой делитель и незаполненная строка — РАЗНЫЕ причины: «${AN.nocalcWhy(ros)}» против ` +
    `«${AN.nocalcWhy(emptyRow)}»; делитель назван ТЕМ СЛОВОМ, которым его зовёт форма расчёта («доля» ` +
    `делит на целое, а не на знаменатель — ИА-27). Остальные четыре коэффициента посчитаны (автономия ` +
    `0,3315, долг к прибыли 4,2202), ноль в отчётности остаётся данными, текст причины собран одним ` +
    `местом (ИА-19)`);

  ok(46, !noSignZero.ok && has(noSignZero.why, 'Рентабельность продаж') &&
        has(noSignZero.why, 'целое равно нулю') &&
        !noSignEmpty.ok && has(noSignEmpty.why, 'не заполнены строки') &&
        has(zeroScreen, 'не посчитан') && has(zeroScreen, 'целое равно нулю: «Выручка за период» = 0') &&
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

/* ================= БЛОК T. ВОЛНА 10 — ИА-21…ИА-24 ==========================
   Четыре инварианта §11 ASUBK-analiz-logika.md, реализация вслед за канонной формулировкой:
   ИА-21 — признак закрытости периода печатается на лице документа (ADR-0219 п.6), а не в
   паспорте мелким шрифтом, и один общий справочник закрытых периодов кормит обе формы;
   ИА-22 закрыт правкой уже существующей строки (см. why-блок seriesTable) — числами здесь
   не дублируется; ИА-23 — у группового заёмщика заключение одно, члены входят повторяющимся
   блоком; ИА-24 — своего контура доступа анализ не заводит: обзор читает контур ШАБЛОНА,
   финанализ — контур ЗАЁМЩИКА, черновик обеих форм — контур в одного автора.            */
(() => {
  const el = () => ({ innerHTML: '', textContent: '', dataset: {}, value: '',
    classList: { toggle() {}, add() {}, remove() {} }, appendChild() {}, remove() {} });
  const nodes = { '#panel': el(), '#title': el(), '#foot': el(), '#role': el(), '#subj': el() };
  sandbox.document = { querySelector: k => nodes[k] || el(), querySelectorAll: () => [],
    getElementById: () => null, createElement: () => el() };
  const panel = () => nodes['#panel'].innerHTML;
  const ANALYST = 'Сотрудник отдела анализа';

  /* ---- ИА-21: признак на лице документа, у обеих форм, из одного справочника ---- */
  AN.seed();
  AN.openDoc('ФА-6');                 /* r-201, at 31.12.2025 — дата в CLOSED_ASOF */
  const closedDoc = panel();
  AN.openDoc('ФА-7');                 /* r-102, at 30.06.2026 — не в CLOSED_ASOF */
  const openDoc = panel();
  ok(77, has(closedDoc, 'banner ok') && has(closedDoc, 'зафиксированные данные') &&
        has(closedDoc, 'период закрыт') && has(closedDoc, '31.12.2025') &&
        has(openDoc, 'banner warn') && has(openDoc, 'предварительные данные') &&
        has(openDoc, 'период не закрыт') && has(openDoc, '30.06.2026') &&
        !has(closedDoc, 'предварительные данные') && !has(openDoc, 'зафиксированные данные'),
    `признак закрытости периода стоит на лице документа, не в паспорте мелким шрифтом ` +
    `(ADR-0219 п.6, ИА-21): ФА-6 (отчётность на 31.12.2025 — дата в справочнике закрытых) ` +
    `несёт баннер «зафиксированные данные»/«период закрыт», ФА-7 (30.06.2026, период ещё ` +
    `открыт) — «предварительные данные»/«период не закрыт»; слова не перепутаны местами`);

  AN.seedReviews();
  AN.state.review = 'ОБ-1'; AN.go('review');   /* ШО-04, asOf 30.06.2026 — открытый период */
  const openReview = panel();
  ok(78, has(openReview, 'banner warn') && has(openReview, 'предварительные данные') &&
        has(openReview, 'период не закрыт') && has(openReview, '30.06.2026'),
    `обзор ОБ-1 (срез 30.06.2026, период открыт) несёт тот же баннер, что и финанализ: ` +
    `«предварительные данные»/«период не закрыт» — закрытость периода спрашивает один общий ` +
    `справочник (ADR-0204), а не свой признак у каждой формы (ИА-21)`);

  AN.setRole(ANALYST);
  const mkClosed = AN.newReview({tpl:'ШО-12', asOf:'2026-03-31',
    period:{from:'2026-01-01', to:'2026-03-31'}, by:'область', cuts:{}, inds:['s-port']});
  AN.state.review = mkClosed.no; AN.go('review');
  const closedReview = panel();
  ok(79, mkClosed.ok && has(closedReview, 'banner ok') && has(closedReview, 'зафиксированные данные') &&
        has(closedReview, 'период закрыт') && has(closedReview, '31.03.2026'),
    `все три обзора витрины заведены на открытый срез 30.06.2026 — отдельным обзором ` +
    `${mkClosed.no} (ШО-12, срез 31.03.2026, дата в справочнике закрытых) проверена и вторая ` +
    `ветка: баннер «зафиксированные данные»/«период закрыт», а не переиспользованный текст ` +
    `открытого случая (ИА-21)`);

  /* ---- ИА-23: у группового заёмщика заключение одно, члены — блоком ---- */
  AN.seed();
  AN.openDoc('ФА-8');                 /* b-4, «Группа «Достук»», r-401 c memberRows */
  const grp = panel();
  ok(80, has(grp, 'Члены группы') && has(grp, '— 7, повторяющийся блок (ИА-23)') &&
        has(grp, '<th>Член</th><th class="num">Доход</th><th class="num">Платёж к доходу (по члену)</th>') &&
        has(grp, '<td>Асанов Т.</td><td class="num">32 000,00</td><td class="num">37,5 %</td>' +
          '<td class="num">10 200 000,00</td>') &&
        has(grp, '<td>Уметов Б.</td><td class="num">24 000,00</td><td class="num">39,6 %</td>' +
          '<td class="num">6 900 000,00</td>') &&
        has(grp, '<tr class="hl"><td>Итого по членам</td><td class="num">186 000,00</td>' +
          '<td class="num"><span class="muted">—</span></td><td class="num">61 200 000,00</td></tr>') &&
        has(grp, '186 000,00 и 74 000,00 сом') && has(grp, '§15а канона, ИА-23'),
    `заключение ФА-8 (заёмщик «Группа «Достук»», b-4) одно на группу, и в нём — повторяющийся ` +
    `блок на 7 членов (Асанов Т. … Уметов Б.), доход и платёж по члену складываются РОВНО в ` +
    `групповые строки формы (186 000,00 / 74 000,00 сом), транш членов — РОВНО в долг группы ` +
    `(61 200 000,00 сом = задолженность b-4): договор один, повторного заведения по членам нет ` +
    `(§15а канона, ИА-23)`);

  /* ---- ИА-24: обзор читает контур ШАБЛОНА, финанализ — контур ЗАЁМЩИКА, черновик — автора ---- */
  AN.seedReviews();                   /* ИА-23 выше звало AN.seed() заново — журнал обзоров опустел */
  const BEKOVA = 'Ведущий куратор (Бекова Н.)', ASANOV = 'Ведущий куратор (Асанов А.)',
    RUKOVOD = 'Руководитель подразделения', ADMIN = 'Администратор';
  const openReviewAs = (role, no) => { AN.setRole(role); AN.state.review = no; AN.go('review');
    return panel(); };
  const r2Bekova = openReviewAs(BEKOVA, 'ОБ-2');     /* ШО-09: контур — Отраслевой + Администрирование */
  const r2Asanov = openReviewAs(ASANOV, 'ОБ-2');     /* Асанов — «Представительство в г. Ош», вне контура */
  const r2Admin  = openReviewAs(ADMIN,  'ОБ-2');     /* у администратора департамента нет вовсе */
  const r2Analyst = openReviewAs(ANALYST, 'ОБ-2');   /* ведёт обзор — сужать себе контур нелепо */
  const r2Rukovod = openReviewAs(RUKOVOD, 'ОБ-2');   /* тоже ведёт обзор (mayReview) */
  ok(81, !has(r2Bekova, 'не открыт</b>') && has(r2Bekova, 'ответило') &&
        has(r2Asanov, 'обзор «ОБ-2» не открыт</b>') &&
        has(r2Asanov, 'шаблон «ШО-09» адресован подразделениям: Отраслевой департамент, ' +
          'Администрирование кредитов; роль «Ведущий куратор (Асанов А.)» ' +
          '(«Представительство в г. Ош») в этот контур не входит (ИА-24)') &&
        has(r2Admin, 'обзор «ОБ-2» не открыт</b>') &&
        has(r2Admin, 'роль «Администратор» в этот контур не входит (ИА-24)') &&
        !has(r2Analyst, 'не открыт</b>') && !has(r2Rukovod, 'не открыт</b>'),
    `обзор ОБ-2 ведётся по шаблону ШО-09, контур которого — Отраслевой департамент и ` +
    `Администрирование кредитов (REP.templateCircle, объявлено у шаблона, а не выведено ` +
    `по портфелю). Бекова Н. (Отраслевой департамент) документ читает; Асанов А. ` +
    `(Представительство в г. Ош) получает НАЗВАННЫЙ отказ с перечислением контура и своего ` +
    `подразделения; Администратор — тоже отказ, но без парентезы (своего департамента у роли ` +
    `нет); отдел анализа и руководитель подразделения — обзор ВЕДУТ (mayReview) и читают его ` +
    `весь, любым шаблоном, без сужения (ИА-24)`);

  const r3Rukovod = openReviewAs(RUKOVOD, 'ОБ-3');   /* ОБ-3 — черновик, автор Осмонова Г. */
  const r3Analyst = openReviewAs(ANALYST, 'ОБ-3');
  ok(82, has(r3Rukovod, 'обзор «ОБ-3» не открыт</b>') &&
        has(r3Rukovod, 'обзор «ОБ-3» — черновик: пока суждение не подписано, документ виден ' +
          'только тому, кто его ведёт — Осмонова Г.; роль «Руководитель подразделения» ' +
          '(«Тентимишев К.») к их числу не относится (ИА-24)') &&
        !has(r3Analyst, 'не открыт</b>') && has(r3Analyst, 'черновик'),
    `обзор ОБ-3 (ШО-12) — черновик, автор Осмонова Г.: руководитель подразделения, который ` +
    `обзоры В ЦЕЛОМ ведёт наравне с отделом анализа (mayReview), к ЭТОМУ конкретному черновику ` +
    `допуска не имеет — черновик виден только автору, контур шаблона тут ни при чём; сама ` +
    `Осмонова Г. документ открывает`);

  const docAs = (role, no) => { AN.setRole(role); AN.openDoc(no); return panel(); };
  const d6Bekova = docAs(BEKOVA, 'ФА-6');            /* b-2, куратор Бекова Н., утверждено */
  const d6Asanov = docAs(ASANOV, 'ФА-6');
  const d6Analyst = docAs(ANALYST, 'ФА-6');
  ok(83, !has(d6Bekova, 'не открыто</b>') && has(d6Bekova, 'Мамытов Т.А.') &&
        has(d6Asanov, 'заключение «ФА-6» не открыто</b>') &&
        has(d6Asanov, 'финанализ заёмщика «Мамытов Т.А.» видно тем же, кому видно самого ' +
          'заёмщика: ведущий куратор — Бекова Н.; роль «Ведущий куратор (Асанов А.)» ' +
          '(«Асанов А.») в их число не входит (ИА-24)') &&
        !has(d6Analyst, 'не открыто</b>'),
    `финанализ ФА-6 (заёмщик «Мамытов Т.А.», куратор Бекова Н., утверждено) своего контура ` +
    `не заводит: видно его тем же, кому видно самого заёмщика (subjVisible — то же правило, ` +
    `что уже применяет visible() к строкам портфеля, только к заёмщику напрямую). Бекова Н. ` +
    `читает, Асанов А. получает НАЗВАННЫЙ отказ со ссылкой на ведущего куратора, отдел ` +
    `анализа — вне контура curator-видимости и потому читает всегда (ИА-24)`);

  const d9Bekova = docAs(BEKOVA, 'ФА-9');            /* b-2, черновик, ведёт Бекова Н. */
  const d9Analyst = docAs(ANALYST, 'ФА-9');
  ok(84, !has(d9Bekova, 'не открыто</b>') && has(d9Bekova, 'ФА-9') &&
        has(d9Analyst, 'заключение «ФА-9» не открыто</b>') &&
        has(d9Analyst, 'заключение «ФА-9» — черновик: пока суждение не подписано, документ ' +
          'виден только тому, кто его ведёт — Бекова Н.; роль «Сотрудник отдела анализа» ' +
          '(«Осмонова Г.») к их числу не относится (ИА-24)'),
    `финанализ ФА-9 (черновик, ведёт Бекова Н.) сужен ещё дальше, чем subjVisible позволил ` +
    `бы: пока суждение не подписано, документ виден ТОЛЬКО тому, кто его ведёт — не всему ` +
    `кругу видимости заёмщика и не отделу анализа, который для утверждённых форм всегда в ` +
    `контуре; черновик — граница в одного автора (ИА-24)`);
})();

/* ================= БЛОК U. ВОЛНА 15 — ПОВОД В КЛЮЧЕ (ИА-26) ================
   ADR-0233: ключ заключения — тройка «заёмщик × период × повод»; переиздание идёт ВНУТРИ
   повода, шов analysisDone принимает повод третьим аргументом, расписание вменяет только
   плановый, а виды повода ведёт отдел анализа записью — как строки формы (ИА-18).
   Дефект АН-Д9 был двойной: работа вставала (второй документ за период считался
   переизданием и требовал новой версии основания) и обязательство закрывалось не тем
   (анализ по заявке молча закрывал плановое п. 6.5). Здесь проверены обе половины.    */
(() => {
  const ANALYST = 'Сотрудник отдела анализа';

  AN.seed();
  const noOcc  = AN.newAnalysis({ subj: 'b-1', report: 'r-103' });
  const badOcc = AN.newAnalysis({ subj: 'b-1', report: 'r-103', occasion: 'выдумка' });
  const good   = AN.newAnalysis({ subj: 'b-1', report: 'r-103', occasion: 'plan' });
  ok(85, !noOcc.ok && has(noOcc.why, 'повод не назван') && has(noOcc.why, 'тройка') &&
        !badOcc.ok && has(badOcc.why, 'в справочнике нет') &&
        good.ok && good.doc.occasion === 'plan' &&
        AN.state.analyses.every(a => !!a.occasion),
    `повод обязателен и по умолчанию его нет: без повода отказ («${noOcc.why.slice(0, 52)}…»), ` +
    `с поводом вне справочника — тоже; у всех ${AN.state.analyses.length} заключений повод ` +
    `заполнен, потому что подстановка «планового, если не сказано иное» и была бы дефектом ` +
    `АН-Д9, спрятанным в макет (ADR-0233 §1)`);

  /* Первая половина АН-Д9: работа больше не встаёт. Тот же период, ТА ЖЕ версия основания —
     по тому же поводу отказ, по другому поводу документ заводится и цепочкой не становится. */
  AN.seed();
  const sameOcc  = AN.newAnalysis({ subj: 'b-1', report: 'r-102', occasion: 'plan' });
  const otherOcc = AN.newAnalysis({ subj: 'b-1', report: 'r-102', occasion: 'appl' });
  const re = AN.reissue('ФА-7');
  ok(86, !sameOcc.ok && has(sameOcc.why, 'основание то же самое') &&
        otherOcc.ok && otherOcc.doc.report === 'r-102' && otherOcc.doc.prev === null &&
        has(otherOcc.note, 'другой повод') && re.ok && re.doc.occasion === 'plan' &&
        re.doc.prev === 'ФА-7' && re.doc.reportVer === 2,
    `за 1П 2026 у b-1 подписано плановое ФА-7 на версии 1: по тому же поводу на той же версии ` +
    `новое не заводится («${sameOcc.why.slice(0, 46)}…»), а по поводу «по заявке» — ` +
    `${otherOcc.doc.no} заводится на ТОЙ ЖЕ версии и связи с ФА-7 не получает: другой повод — ` +
    `другой вопрос, а не переиздание. Переиздание же идёт внутри повода: reissue('ФА-7') дал ` +
    `${re.doc.no}, повод «${AN.occName(re.doc.occasion)}», версия ${re.doc.reportVer}, связь «← ФА-7» (ADR-0233 §4)`);

  /* Шов: повод третьим аргументом, вопрос без повода не задаётся (ADR-0233 §5). */
  AN.seed();
  const noOccQ = AN.callSeam('сопровождение', 'analysisDone', 'b-1', '1П 2026');
  const planQ  = AN.callSeam('сопровождение', 'analysisDone', 'b-1', '1П 2026', 'plan');
  const applQ  = AN.callSeam('сопровождение', 'analysisDone', 'b-1', '1П 2026', 'appl');
  ok(87, !noOccQ.ok && has(noOccQ.why, 'вопрос без повода') &&
        planQ.ok && planQ.answer.done === true && planQ.answer.no === 'ФА-7' &&
        planQ.answer.occasion === 'plan' &&
        applQ.ok && applQ.answer.done === false && has(applQ.answer.why, 'ФА-7') &&
        has(applQ.answer.why, 'не закрывается'),
    `analysisDone принимает повод третьим аргументом: без повода — ОТКАЗ, а не «да» наугад ` +
    `(«${noOccQ.why.slice(0, 48)}…»); по плановому — done:true, ФА-7; по поводу «по заявке» — ` +
    `done:false, и молчания нет: ответ называет ФА-7 и говорит, что обязательство своего ` +
    `повода им не закрывается`);

  /* Вторая половина АН-Д9: заключение по заявке не закрывает плановое обязательство. */
  AN.seed();
  const before = AN.mirrorDefect('b-2');
  const appl = AN.newAnalysis({ subj: 'b-2', report: 'r-202', occasion: 'appl' });
  AN.setText(appl.doc.no, 'Заявка на пополнение оборотных средств: доход подтверждён, ' +
    'свободный остаток положителен.');
  AN.setVerdict(appl.doc.no, 'удовлетворительное');
  const signed = AN.approve(appl.doc.no);
  const after = AN.mirrorDefect('b-2');
  const seen = AN.analysisVerdict('b-2');
  ok(88, before.defect && signed.ok && after.defect &&
        has(after.why, appl.doc.no) && has(after.why, 'по другому поводу') &&
        seen.no === appl.doc.no,
    `дефект АН-Д9 закрыт на своём же сценарии: у b-2 плановый анализ за 1П 2026 просрочен, ` +
    `подписан ${appl.doc.no} ПО ЗАЯВКЕ на той же отчётности — и дефект остался, а причина ` +
    `названа словами: «${after.why.slice(-72)}». Швы при этом расходятся честно: ` +
    `analysisVerdict отдаёт наружу ${seen.no} (последнее утверждённое, любого повода), ` +
    `analysisDone по плановому поводу — по-прежнему «не проведено»`);

  /* Виды повода — объект ведения отдела анализа, а не перечисление в коде (ИА-26, ИА-18). */
  AN.seed();
  const asCurator = AN.addOccasion({ id: 'claim', name: 'по взысканию', note: 'при передаче долга' });
  const usedDraft = AN.newAnalysis({ subj: 'b-1', report: 'r-102', occasion: 'appl' });
  AN.setRole(ANALYST);
  const added = AN.addOccasion({ id: 'claim', name: 'по обращению взыскания',
    note: 'при передаче долга во взыскание — оценка состояния на дату передачи' });
  const noNote = AN.addOccasion({ id: 'misc', name: 'прочее', note: '' });
  const retirePlan = AN.retireOccasion('plan');
  const retireUsed = AN.retireOccasion('appl');
  const retireFree = AN.retireOccasion('claim');
  ok(89, !asCurator.ok && added.ok && !noNote.ok && has(noNote.why, 'без объяснения') &&
        !retirePlan.ok && has(retirePlan.why, 'не снимается') &&
        !retireUsed.ok && has(retireUsed.why, usedDraft.doc.no) && has(retireUsed.why, 'ИА-5') &&
        retireFree.ok && AN.state.occasions.length === 4,
    `справочник поводов ведёт отдел анализа записью: куратору отказ по роли, аналитик заводит ` +
    `«по обращению взыскания» без правки кода, повод без объяснения не заводится («${noNote.why.slice(0, 44)}…»). ` +
    `Снятие — по правилу ИА-5 и строже: плановый не снимается вовсе (его вменяет расписание), ` +
    `«по заявке» не снять, пока на нём стоит ${usedDraft.doc.no}, а неиспользованный снимается`);
})();

/* ---------------------------------------------------------------------------------------
   V. ВОЛНА 15, ИА-27 / ADR-0234 — КАТАЛОГ ФОРМ РАСЧЁТА (#90…#95).
   Развилка волны 14 звучала так: чем объявляется коэффициент — выражением или кодом формы?
   Выражение потребовало бы интерпретатора, а с ним уехала бы ответственность: считает отдел
   анализа, отвечает разработчик. Закрыта отказом, а не отсутствием поля. Здесь проверено,
   что каталог — это КОД (шесть форм, у каждой имя, поимённые параметры и своё слово отказа),
   что объявление разбирается на форму и параметры без единого поля свободного текста, что
   отказы трёх разных бед звучат по-разному, и что новые формы СЧИТАЮТ — на отчётности,
   внесённой обычными операциями, а не на подложенном литерале.                          */
(() => {
  const ANALYST = 'Сотрудник отдела анализа';
  const LEAD    = 'Ведущий куратор (Бекова Н.)';
  const el = () => ({ innerHTML: '', textContent: '', dataset: {}, value: '',
    classList: { toggle() {}, add() {}, remove() {} }, appendChild() {}, remove() {} });
  const nodes = { '#panel': el(), '#title': el(), '#foot': el(), '#role': el(), '#subj': el() };
  sandbox.document = { querySelector: k => nodes[k] || el(), querySelectorAll: () => [],
    getElementById: () => null, createElement: () => el() };
  const panel = () => nodes['#panel'].innerHTML;

  /* Каталог отдаётся наружу целиком, и у каждой формы есть всё, чем она отличается от
     выражения: имя для человека, параметры с родом и правило отказа своими словами.   */
  AN.seed();
  const cat = AN.forms();
  const lame = cat.filter(f => !f.params.length || f.params.some(p => !p.name || !p.kindName));
  const coefs = AN.state.methods.reduce((a, m) =>
    a.concat((m.editions || []).reduce((b, e) => b.concat(e.coefs || []), [])), []);
  const parsed = coefs.filter(c => cat.some(f => f.id === c.form) && AN.linesOf(c).length > 0);
  const asText = coefs.filter(c => Object.keys(c).some(k => /formula|expr|выражени/i.test(k)));
  const diff = cat.find(f => f.id === 'diff'), growth = cat.find(f => f.id === 'growth');
  ok(90, cat.length === 6 && lame.length === 0 && parsed.length === coefs.length &&
        asText.length === 0 && !!diff && growth.needsPrev === true &&
        cat.filter(f => f.denom).length === 5 && AN.state.forms === undefined,
    `каталог форм расчёта — код, и это видно снаружи: ${cat.length} форм ` +
    `(${cat.map(f => f.name).join(', ')}), у каждой поимённые параметры со своим родом ` +
    `(«${cat[0].params[0].name}» — ${cat[0].params[0].kindName}) и своё слово отказа у ${cat.filter(f => f.denom).length} из ` +
    `${cat.length} («${cat[0].denom}», «${cat[2].denom}»); у «темпа» отдельный признак «нужен ` +
    `прошлый период». Все ${coefs.length} коэффициентов посеянных методик разобраны на форму и ` +
    `параметры, поля со свободной формулой нет ни у одного, а в состоянии каталога нет вовсе: ` +
    `он не объект ведения отдела анализа (ADR-0234 §4)`);

  /* Четыре отказа при публикации, и все ЧЕТЫРЕ разные: текст выражения, форма вне каталога,
     пропущенный параметр формы, параметр не того рода. Смешать их значило бы послать
     человека править не то место.                                                      */
  AN.seed();
  AN.setRole(ANALYST);
  const base = AN.METHOD('m-org').editions.slice(-1)[0];
  const mk = cs => AN.addEdition({ method: 'm-org', n: base.n + 1, since: AN.state.today,
    note: 'проверка объявления', lines: base.lines.slice(), coefs: cs });
  const byExpr = mk([{ id: 'k-e', name: 'Своя формула', formula: '(ta_cur - 1230) / li_short',
    fmt: 'ratio', thr: { cmp: '>=', v: 1 } }]);
  const byUnknown = mk([{ id: 'k-m', name: 'Медиана по строкам', form: 'median',
    p: { num: ['ta_cur'], den: ['li_short'] }, fmt: 'ratio', thr: { cmp: '>=', v: 1 } }]);
  const noParam = mk([{ id: 'k-t', name: 'Оборачиваемость запасов', form: 'turn',
    p: { flow: 'rev', open: 'ta_cur' }, fmt: 'ratio', thr: { cmp: '>=', v: 1 } }]);
  const badKind = mk([{ id: 'k-s', name: 'Рентабельность группой строк', form: 'share',
    p: { part: ['profit'], whole: 'rev' }, fmt: 'pct', thr: { cmp: '>=', v: 5 } }]);
  const whys = [byExpr.why, byUnknown.why, noParam.why, badKind.why];
  ok(91, !byExpr.ok && !byUnknown.ok && !noParam.ok && !badKind.ok &&
        has(byExpr.why, 'выражение здесь не заводится ни одним полем') &&
        has(byExpr.why, 'язык требует интерпретатора') &&
        has(byUnknown.why, 'формы расчёта «median» в каталоге нет') &&
        has(byUnknown.why, 'граница ответственности проходит по границе каталога') &&
        has(noParam.why, 'не задан параметр формы') && has(noParam.why, 'остаток на конец') &&
        has(badKind.why, 'строка части (строка)') &&
        new Set(whys).size === 4 && AN.METHOD('m-org').editions.length === base.n,
    `объявление проверяется ДО публикации, и четыре беды названы четырьмя разными текстами: ` +
    `свободная формула — «${byExpr.why.slice(0, 58)}…»; форма вне каталога — «формы расчёта ` +
    `«median» в каталоге нет», с перечнем каталога и границей ответственности; пропущенный ` +
    `параметр — «${noParam.why.slice(0, 72)}…»; параметр не того рода (группа строк вместо ` +
    `строки) — «строка части (строка)». Ни одна из четырёх редакций не опубликована`);

  /* Считают ли новые формы. Отчётность за 2П 2026 вносится ОПЕРАЦИЕЙ куратора после того,
     как период закрылся, — литерала в фикстуре нет, и редакция публикуется датой.      */
  AN.seed();
  AN.setRole(ANALYST);
  const l1 = AN.addLine({ id: 'stock_open',  name: 'Товарные запасы на начало периода', unit: 'сом' });
  const l2 = AN.addLine({ id: 'stock_close', name: 'Товарные запасы на конец периода',  unit: 'сом' });
  const l3 = AN.addLine({ id: 'pay_month',   name: 'Платёж по графику за месяц',        unit: 'сом' });
  const prevEd = AN.METHOD('m-org').editions.slice(-1)[0];
  const pub = AN.addEdition({ method: 'm-org', n: prevEd.n + 1, since: AN.state.today,
    note: 'взяты формы каталога: разность со знаком, оборачиваемость, покрытие долга, темп',
    lines: prevEd.lines.concat(['stock_open', 'stock_close', 'pay_month']),
    coefs: prevEd.coefs.concat([
      { id: 'k-wc',   name: 'Чистый оборотный капитал к балансу', form: 'ratio',
        p: { num: ['ta_cur', '-li_short'], den: ['bal'] }, fmt: 'ratio', thr: { cmp: '>=', v: 0.05 } },
      { id: 'k-turn', name: 'Оборачиваемость запасов', form: 'turn',
        p: { flow: 'rev', open: 'stock_open', close: 'stock_close' }, fmt: 'ratio', thr: { cmp: '>=', v: 2 } },
      { id: 'k-cov',  name: 'Покрытие месячного платежа потоком', form: 'dscr',
        p: { flow: 'cf_oper', debt: 'pay_month', months: 6 }, fmt: 'ratio', thr: { cmp: '>=', v: 1.2 } },
      { id: 'k-gr',   name: 'Темп выручки к прошлому периоду', form: 'growth',
        p: { line: 'rev', back: 1 }, fmt: 'pct', thr: { cmp: '>=', v: 0 } }
    ]) });
  const wc = pub.ok ? AN.METHOD('m-org').editions.slice(-1)[0].coefs.find(c => c.id === 'k-wc') : null;
  ok(92, l1.ok && l2.ok && l3.ok && pub.ok && !!wc &&
        AN.linesOf(wc).join(',') === 'ta_cur,li_short,bal' &&
        wc.p.num[1] === '-li_short' && !('formula' in wc) &&
        AN.linesOf(AN.METHOD('m-fl').editions[0].coefs.find(c => c.id === 'k-free')).length === 3,
    `знак — часть кода строки в параметре, а не операция и не выражение: «Чистый оборотный ` +
    `капитал к балансу» объявлен формой ratio с числителем ['ta_cur','-li_short'] и ` +
    `знаменателем ['bal'] — «(1200 − 1230) ÷ 1700» записано БЕЗ языка выражений, а строки ` +
    `коэффициент отдаёт разобранными (${AN.linesOf(wc).join(', ')}). Тем же приёмом живёт ` +
    `«Свободный остаток» физлица на шестой форме «разность групп строк» (АН-86)`);

  /* Год прошёл: период 2П 2026 закрылся, куратор вносит отчётность, аналитик её читает. */
  AN.state.today = '2027-01-15';
  AN.setRole(LEAD);
  const rep = AN.addReport({ subj: 'b-1', period: '2П 2026',
    basis: 'баланс и ОПиУ за 2026 год от 15.01.2027',
    vals: { ta_cur: 52000000, li_short: 41000000, eq: 64000000, bal: 190000000, rev: 105800000,
      profit: 8100000, ebitda: 23400000, debt_all: 97000000, cf_oper: 26400000, debt_serv: 19800000,
      stock_open: 18000000, stock_close: 22000000, pay_month: 1650000 } });
  const doc = AN.newAnalysis({ subj: 'b-1', report: rep.ok ? rep.report.id : 'x', occasion: 'plan' });
  const rows = doc.ok ? AN.liveRatios(doc.doc.no).rows : [];
  const val = id => (rows.find(r => r.id === id) || {}).v;
  ok(93, rep.ok && doc.ok && doc.doc.ed === prevEd.n + 1 &&
        val('k-wc') === 0.0579 && val('k-turn') === 5.29 && val('k-cov') === 2.6667 &&
        val('k-gr') === 9.751 && rows.every(r => r.v != null),
    `четыре формы каталога посчитали на живой отчётности, внесённой операциями: разность со ` +
    `знаком (52 000 000 − 41 000 000) ÷ 190 000 000 = ${val('k-wc')}; оборачиваемость ` +
    `105 800 000 ÷ ((18 000 000 + 22 000 000) ÷ 2) = ${val('k-turn')}; покрытие долга ` +
    `(26 400 000 ÷ 6) ÷ 1 650 000 = ${val('k-cov')}; темп к 1П 2026 (96 400 000) = ` +
    `${val('k-gr')} %. Прошлый период «темп» спросил у РЕЕСТРА отчётности, а не у своей ` +
    `записи: какая версия там стояла — вопрос датированный (ИА-4)`);

  /* Третья беда «посчитать нельзя» — СВОЯ: строки заполнены, а сравнивать не с чем. */
  const rep5 = AN.addReport({ subj: 'b-5', period: '2П 2026',
    basis: 'баланс и ОПиУ за 2026 год от 15.01.2027',
    vals: { ta_cur: 12400000, li_short: 9800000, eq: 18300000, bal: 46000000, rev: 31200000,
      profit: 1900000, ebitda: 5400000, debt_all: 12000000, cf_oper: 6600000, debt_serv: 4100000,
      stock_open: 4000000, stock_close: 5200000, pay_month: 340000 } });
  const doc5 = AN.newAnalysis({ subj: 'b-5', report: rep5.ok ? rep5.report.id : 'x', occasion: 'plan' });
  const rows5 = doc5.ok ? AN.liveRatios(doc5.doc.no).rows : [];
  const gr5 = rows5.find(r => r.id === 'k-gr') || {};
  const why5 = AN.nocalcWhy(gr5);
  AN.setText(doc5.doc.no, 'Первый анализ заёмщика: показатели в норме, сравнение с прошлым ' +
    'периодом невозможно — отчётность за него не вносилась.');
  AN.setVerdict(doc5.doc.no, 'удовлетворительное');
  const sign5 = AN.approve(doc5.doc.no);
  ok(94, rep5.ok && doc5.ok && gr5.v === null && gr5.nocalc.code === 'noprev' &&
        gr5.nocalc.lines.join(',') === 'rev' && gr5.missing.length === 0 &&
        has(why5, 'сравнивать не с чем') && has(why5, 'период «1П 2026»') &&
        has(why5, '«Выручка за период»') && !has(why5, 'не заполнены') &&
        rows5.filter(r => r.v == null).length === 1 &&
        !sign5.ok && has(sign5.why, 'Темп выручки к прошлому периоду') && has(sign5.why, why5),
    `у «Тянь-Шань Логистик» отчётность за 2П 2026 первая, и «темп» честно не считается третьей ` +
    `причиной: код noprev, строк незаполненных ноль — «${why5}». Сливать её с «не заполнена ` +
    `строка» было бы неправдой: человека послали бы вносить то, что он уже внёс, а лечится это ` +
    `отчётностью за ПРОШЛЫЙ период. Подпись отказана тем же текстом (ИА-16, ИА-19): остальные ` +
    `${rows5.length - 1} коэффициентов посчитаны, но заключение с непосчитанным не утверждается`);

  /* Экран «Реестр методик»: каталог показан таблицей, коэффициент — разобранным. */
  AN.seed();
  AN.setRole(ANALYST);
  AN.go('methods');
  const p = panel();
  ok(95, has(p, 'Каталог форм расчёта') && has(p, 'владелец: разработчик (код, тест, релиз)') &&
        has(p, '<b>Граница ответственности проходит по границе этой таблицы.</b>') &&
        has(p, 'разность групп строк') && has(p, 'нужен прошлый период') &&
        has(p, 'делителя нет — отказать нечем') && has(p, 'знаменатель равен нулю') &&
        has(p, '<th>Форма расчёта</th>') && has(p, '<th>Параметры формы</th>') &&
        !has(p, '<th>Формула</th>') &&
        has(p, 'строки числителя:') && has(p, 'строки уменьшаемого:') &&
        has(p, 'Свободный остаток') && has(p, 'Завести свою форму расчёта') &&
        has(p, 'заявка на седьмую форму — обычная задача разработки'),
    `на «Реестре методик» каталог форм стоит СВОЕЙ таблицей — код, имя, параметры с родом, слово ` +
    `отказа и кто ею считает, — и владелец назван: разработчик, «граница ответственности ` +
    `проходит по границе этой таблицы». Коэффициент в редакции показан разобранным: колонки ` +
    `«Форма расчёта» и «Параметры формы» вместо прежней «Формулы», параметр — строкой со своим ` +
    `именем («строки числителя: …»). Кнопка «Завести свою форму расчёта» отказывает словами, ` +
    `а неполнота каталога названа не провалом: «заявка на седьмую форму — обычная задача разработки»`);
})();

/* ================= БЛОК W. ВОЛНА 15 — ОТЧЁТНОСТЬ У СУБЪЕКТА (ИА-28) ========
   Вторая развилка волны 15: чей реквизит отчётность и чем отвечать на «откуда это число».
   Отвечено так: отчётность — реквизит СУБЪЕКТА (лица), а не роли заёмщика и не документа
   анализа; финанализ при этом ведётся только по роли заёмщика, и это ЗАПРЕТ, снимаемый
   решением, а не отсутствие модели. Источник же назван у КАЖДОЙ СТРОКИ, а не у версии
   целиком: версия смешана по природе — файл разобран, две строки поправлены рукой.
   Здесь проверено, что источник живёт у строки и переезжает в снимок, что разбор файла —
   способ ЗАПОЛНИТЬ версию, а не второй способ её внести, что неразобранная строка названа
   ПОИМЁННО, что внешний источник отказан своими словами (объявлен, но не подключён), и что
   субъект без роли заёмщика отчётность ведёт, а анализа не получает (ADR-0235).        */
(() => {
  const LEAD = 'Ведущий куратор (Бекова Н.)';
  const el = () => ({ innerHTML: '', textContent: '', dataset: {}, value: '',
    classList: { toggle() {}, add() {}, remove() {} }, appendChild() {}, remove() {} });
  const nodes = { '#panel': el(), '#title': el(), '#foot': el(), '#role': el(), '#subj': el() };
  sandbox.document = { querySelector: k => nodes[k] || el(), querySelectorAll: () => [],
    getElementById: () => null, createElement: () => el() };
  const panel = () => nodes['#panel'].innerHTML;

  /* Источник — реквизит СТРОКИ. Поля «источник версии» нет ни у одной записи, а молчание
     о строке читается одним значением по умолчанию, а не пустотой.                     */
  AN.seed();
  const mixed = AN.state.reports.find(r => r.id === 'r-103');
  const silent = AN.state.reports.find(r => r.id === 'r-102');
  const byHand = Object.keys(mixed.vals).filter(id => AN.srcOf('r-103', id) === 'руками');
  const byFile = Object.keys(mixed.vals).filter(id => AN.srcOf('r-103', id) === 'из файла');
  const versionField = AN.state.reports.filter(r =>
    ['source', 'srcKind', 'srcName', 'origin'].some(k => k in r) || typeof r.src === 'string');
  const silentAll = Object.keys(silent.vals).every(id => AN.srcOf('r-102', id) === 'руками');
  ok(96, AN.sources().join(' · ') === 'руками · из файла · из внешнего источника' &&
        byHand.join(',') === 'li_short,debt_all' && byFile.length === 8 &&
        versionField.length === 0 && silentAll &&
        AN.srcOf('r-103', 'li_short') === 'руками' && AN.srcOf('r-103', 'ta_cur') === 'из файла',
    `источник назван у СТРОКИ, а не у версии: в уточнённом балансе b-1 из ${byFile.length + byHand.length} ` +
    `строк ${byFile.length} разобраны из файла, а ${byHand.map(id => '«' + AN.LINE(id).name + '»').join(' и ')} ` +
    `поправлены рукой после доначисления обязательств — ответить на «откуда это число» одним ` +
    `значением на всю версию тут нечем. Поля «источник версии» нет ни у одной из ` +
    `${AN.state.reports.length} записей (искали source/srcKind/srcName/origin и src строкой), ` +
    `а версия, об источнике молчащая, читается целиком как «руками»: умолчание названо, а не пусто`);

  /* Разбор файла — способ ЗАПОЛНИТЬ версию, а не второй способ её внести: заканчивается тем
     же addReport, и правка рукой поверх разбора — обычный ход, а не исключение.        */
  AN.setRole(LEAD);
  const last = AN.reportsOf('b-1').slice(-1)[0];
  const file = Object.keys(last.vals).map(id => ({ code: id, value: last.vals[id] }));
  const hand = { li_short: 44800000, debt_all: 97300000 };
  const up = AN.uploadReport({ subj: 'b-1', period: '1П 2026', file, hand,
    basis: 'файл выгрузки из учётной системы от 12.08.2026, две строки поправлены рукой' });
  const nid = up.ok ? up.report.id : 'x';
  ok(97, up.ok && up.report.ver === 3 && up.report.vals.li_short === 44800000 &&
        AN.srcOf(nid, 'li_short') === 'руками' && AN.srcOf(nid, 'debt_all') === 'руками' &&
        AN.srcOf(nid, 'ta_cur') === 'из файла' &&
        has(up.note, 'разобрано из файла строк: 8') && has(up.note, 'поправлено рукой: 2') &&
        has(up.note, 'версия смешанная') &&
        AN.srcOf('r-103', 'li_short') === 'руками' && AN.reportsOf('b-1').length === 4,
    `версия ${up.report.ver} заполнена РАЗБОРОМ ФАЙЛА и заканчивается тем же addReport: ` +
    `«${up.note}». Две строки поправлены рукой поверх разбора — у них источник стал «руками», ` +
    `у остальных восьми остался «из файла», и смешанной версия оказалась честно, а не по ` +
    `недосмотру. Прежние версии не тронуты: их ${AN.reportsOf('b-1').length - 1}, и источник ` +
    `строки в r-103 прежний`);

  /* Строка файла, коду справочника не отвечающая, называется ПОИМЁННО и версию не создаёт. */
  const nBefore = AN.state.reports.length;
  const bad = AN.uploadReport({ subj: 'b-1', period: '1П 2026', basis: 'файл выгрузки от 12.08.2026',
    file: file.concat([{ code: 'stroka_1230', name: 'Резервы предстоящих расходов', value: 1400000 }]) });
  const empty = AN.uploadReport({ subj: 'b-1', period: '1П 2026', file: [], basis: 'пустой файл' });
  ok(98, !bad.ok && !empty.ok && bad.why !== empty.why &&
        has(bad.why, '«Резервы предстоящих расходов» (код stroka_1230)') &&
        has(bad.why, 'по кодам справочника строк (ИА-18)') &&
        has(bad.why, 'неотличима от строки, которой в отчётности не было') &&
        has(empty.why, 'файл пуст') && AN.state.reports.length === nBefore,
    `строка файла вне справочника названа ПОИМЁННО и версию не создаёт: «${bad.why.slice(0, 96)}…». ` +
    `Молча пропустить её нельзя — пропущенная строка отчётности неотличима от строки, которой в ` +
    `отчётности не было (ИА-14), а тихий пропуск дал бы неполную версию под видом полной. Пустой ` +
    `файл отказан СВОИМ текстом («${empty.why}»), а не тем же: разбирать нечего — не то же, что ` +
    `разобрано не всё. Записей отчётности как было ${nBefore}, так и осталось`);

  /* Внешний источник ОБЪЯВЛЕН перечнем, но дверью не является, и говорится это прямо. */
  const srcExt = {}; srcExt[file[0].code] = 'из внешнего источника';
  const srcBad = {}; srcBad[file[0].code] = 'из системы бухгалтерии';
  const vals = file.reduce((o, x) => { o[x.code] = x.value; return o; }, {});
  const ext = AN.addReport({ subj: 'b-1', period: '1П 2026', vals, src: srcExt,
    basis: 'данные ГНС от 12.08.2026' });
  const alien = AN.addReport({ subj: 'b-1', period: '1П 2026', vals, src: srcBad,
    basis: 'выгрузка от 12.08.2026' });
  ok(99, !ext.ok && !alien.ok && ext.why !== alien.why &&
        has(ext.why, 'в v1 не подключается') && has(ext.why, 'ГНС, Соцфонду и межведомственному обмену') &&
        has(ext.why, 'вносится руками или разбором файла') &&
        has(alien.why, 'такого в перечне нет') && has(alien.why, 'Источников три') &&
        AN.state.reports.length === nBefore,
    `два разных промаха с источником — два разных отказа. «Из внешнего источника» перечнем ` +
    `ОБЪЯВЛЕН, но дверью не является, и модуль говорит это прямо: «${ext.why.slice(0, 88)}…» — ` +
    `объявленное значение перечня не выдаётся за работающий обмен. Значение вне перечня — не ` +
    `описка, а чужая модель, и текст у него свой: «${alien.why.slice(0, 74)}…». Ни одна из двух ` +
    `версий не записана`);

  /* Снимок несёт источник ПОСТРОЧНО: «откуда это число» отвечается и через год. */
  const doc = AN.newAnalysis({ subj: 'b-1', report: 'r-103', occasion: 'plan' });
  if (doc.ok) {
    AN.setText(doc.doc.no, 'Уточнённый баланс: обязательства доначислены, ликвидность ниже порога ' +
      'методики. Основание — версия 2, две строки в ней поправлены рукой после сверки.');
    AN.setVerdict(doc.doc.no, 'удовлетворительное с оговорками');
    AN.approve(doc.doc.no);
  }
  const snap = doc.ok ? AN.DOC(doc.doc.no).snapshot : null;
  ok(100, doc.ok && !!snap && snap.lineSrc &&
        snap.lineSrc.li_short === 'руками' && snap.lineSrc.ta_cur === 'из файла' &&
        Object.keys(snap.lineSrc).length === Object.keys(snap.lines).length &&
        snap.lineSrc !== mixed.src && !('src' in snap) && !('source' in snap),
    `снимок утверждённого заключения несёт источник ПОСТРОЧНО, а не ссылку на живую запись: ` +
    `${Object.keys(snap.lineSrc).length} строк, и у каждой своё («${snap.lineSrc.ta_cur}» у ` +
    `оборотных активов, «${snap.lineSrc.li_short}» у краткосрочных обязательств). Через год на ` +
    `«откуда это число» ответит сам документ (ADR-0153, ИА-1), и ответ не поедет, даже если ` +
    `реестр отчётности перепишут: карта в снимке своя, а не та же самая. Поля «источник» на ` +
    `снимке целиком нет — источник у строки, а не у версии`);

  /* Роль в выборе методики не участвует (ИА-4), но АНАЛИЗ ведётся по роли заёмщика. */
  AN.seed();
  AN.setRole(LEAD);
  const guarantor = AN.rolesOf('s-6');
  const repsBefore = AN.reportsOf('s-6').length;
  const add6 = AN.addReport({ subj: 's-6', period: '1П 2026',
    basis: 'уточнённый баланс за 1 полугодие 2026 от 14.08.2026 (к переоценке обеспечения)',
    vals: { ta_cur: 19700000, li_short: 15100000, eq: 30700000, bal: 72000000, rev: 44100000,
      profit: 3200000, ebitda: 8900000, debt_all: 26800000, cf_oper: 9700000, debt_serv: 6400000 } });
  const nDocs = AN.state.analyses.length;
  const noAn = AN.newAnalysis({ subj: 's-6', report: 'r-601', occasion: 'plan' });
  const okAn = AN.newAnalysis({ subj: 'b-1', report: 'r-103', occasion: 'plan' });
  /* Шов о поручителе отвечает СВОИМ ответом: «анализа нет» пообещало бы документ, которого
     по этому субъекту не будет никогда (ср. b-5 — заёмщик без заключений).            */
  const vg = AN.analysisVerdict('s-6'), vb = AN.analysisVerdict('b-5');
  const dg = AN.analysisDone('s-6', '1П 2026', 'plan');
  ok(101, guarantor.join(', ') === 'поручитель, залогодатель' && !AN.hasRole('s-6', 'заёмщик') &&
        repsBefore === 1 && add6.ok && add6.report.ver === 2 && AN.reportsOf('s-6').length === 2 &&
        !noAn.ok && has(noAn.why, 'финанализ ведётся по роли ЗАЁМЩИКА') &&
        has(noAn.why, 'Отчётность у него ведётся — она реквизит лица') &&
        has(noAn.why, 'запрет, снимаемый решением, а не отсутствие модели') &&
        vg.none === true && vg.notBorrower === true && vb.none === true && !vb.notBorrower &&
        vg.text !== vb.text && vb.text === 'анализа нет' &&
        has(vg.text, 'анализ не ведётся') && has(vg.text, 'заключения не будет и позже') &&
        dg.ok && dg.done === false && dg.notBorrower === true &&
        has(dg.why, 'обязательства нет и не будет') && has(dg.why, 'Это не «срок ещё не наступил»') &&
        okAn.ok && AN.state.analyses.length === nDocs + 1,
    `у «Кен-Сай Строй» роли ${guarantor.join(' и ')}, роли заёмщика нет — и это РАЗВОДИТ два ` +
    `вопроса. Отчётность у него ведётся обычной операцией (версия ${add6.report.ver} внесена, ` +
    `версий стало ${AN.reportsOf('s-6').length}): она реквизит ЛИЦА, а не роли, и переносить её ` +
    `куда-то, когда поручитель однажды станет заёмщиком, не понадобится. Финанализ же не ` +
    `заводится, и отказ звучит своими словами: «${noAn.why.slice(0, 70)}…» — запрет, снимаемый ` +
    `решением, а не отсутствие модели. По заёмщику та же операция проходит. Наружу шов отвечает ` +
    `тем же различением: поручителю — «${vg.text.slice(0, 52)}…», а заёмщику b-5 без заключений — ` +
    `«${vb.text}»; обязательство по нему не «ещё не наступило», а «${dg.why.slice(0, 44)}…»`);

  /* Экраны: роль видна в шапке субъекта, источник — колонкой, расписание вменяет заёмщику. */
  AN.pickSubj('s-6'); AN.go('borrower'); const g = panel();
  AN.pickSubj('b-1'); AN.go('borrower'); const b = panel();
  AN.go('schedule');  const sch = panel();
  const oblig = sch.split('Позвать шов')[0];   /* до площадки швов — таблица обязательств */
  AN.openDoc('ФА-7'); const d = panel();
  ok(102, has(g, 'вкладка «Финансы» карточки субъекта') &&
        has(g, '<b>У этого субъекта роли заёмщика нет</b>') &&
        has(g, 'Отчётность ведётся: она реквизит лица') &&
        has(g, 'запрет, снимаемый решением') && has(g, 'Шапка субъекта') &&
        has(g, 'из файла — 10') && !has(g, 'Финансовые анализы</h2><table') &&
        has(b, 'вкладка «Финансы» карточки заёмщика') && has(b, '<th>Источники строк</th>') &&
        has(b, 'из файла — 8, руками — 2') && has(b, 'Отчётность — реквизит <b>субъекта</b>') &&
        has(d, '<th>Источник строки</th>') &&
        !has(oblig, 'Кен-Сай Строй') && has(oblig, 'Ак-Жол Агро') && has(sch, 'Кен-Сай Строй'),
    `экраны показывают ровно то же разделение. Карточка поручителя — «вкладка «Финансы» ` +
    `карточки СУБЪЕКТА», с шапкой ролей и баннером «${'У этого субъекта роли заёмщика нет'}»: ` +
    `отчётность стоит таблицей (сводка «из файла — 10»), анализа нет. Карточка заёмщика — та же ` +
    `вкладка «карточки заёмщика», колонка «Источники строк» со сводкой смешанной версии ` +
    `(«из файла — 8, руками — 2»), считаемой В МОМЕНТ ПОКАЗА, а не хранимой (ADR-0001). В снимке ` +
    `утверждённого заключения источник стоит СВОЕЙ колонкой. В таблице обязательств поручителя ` +
    `нет вовсе — не «строкой с прочерком», а отсутствием строки: обязательство вменяется роли ` +
    `заёмщика. В площадке швов ниже он есть, и это не противоречие: спросить о нём можно, и шов ` +
    `отвечает названным «анализ не ведётся», а не молчанием`);
})();

/* ================= БЛОК X. ВОЛНА 15 — ЗАПРОС ПАКЕТА (ИА-29) ================
   Третья развилка волны 15: норма считает 60 и 90 дней «от установленной даты» (п. 11.2,
   п. 11.3), а такой даты не было ни в одном модуле — куратор считал их по своей переписке.
   Запрос заведён ЗДЕСЬ, потому что состав пакета объявляет редакция методики, а методики
   ведёт анализ; наружу же он уходит ФАКТОМ — датами и числом дней, без слов «уклонение»
   и без предложения категории. Здесь проверено, что запрос — сущность со своими правилами,
   что дни просрочки считаются, а не лежат, что порогов 60 и 90 в модуле нет ни одного,
   что третий шов открыт классификации, а суждение ей по-прежнему закрыто, и что «анализа
   нет» получило различимые причины взамен одного текста (ADR-0236).                    */
(() => {
  const LEAD    = 'Ведущий куратор (Бекова Н.)';
  const ANALYST = 'Сотрудник отдела анализа';
  const el = () => ({ innerHTML: '', textContent: '', dataset: {}, value: '',
    classList: { toggle() {}, add() {}, remove() {} }, appendChild() {}, remove() {} });
  const nodes = { '#panel': el(), '#title': el(), '#foot': el(), '#role': el(), '#subj': el() };
  sandbox.document = { querySelector: k => nodes[k] || el(), querySelectorAll: () => [],
    getElementById: () => null, createElement: () => el() };
  const panel = () => nodes['#panel'].innerHTML;

  /* Запрос несёт установленную дату, состав берёт у редакции методики, а дни просрочки
     СЧИТАЕТ в момент вопроса — полем они не лежат (ADR-0001).                          */
  AN.seed();
  const open5 = AN.openRequest('b-5', '1П 2026');
  const closed1 = AN.lastRequest('b-1', '1П 2026');
  const part2 = AN.lastRequest('b-2', '1П 2026');
  const none3 = AN.lastRequest('b-3', '1П 2026');
  const stored = AN.state.requests.filter(q =>
    ['overdue', 'overdueDays', 'days', 'late', 'evading'].some(k => k in q));
  const thresholds = /60|90/.test(JSON.stringify(AN.state.requests));
  const wasOver = AN.overdueDays(open5);
  AN.state.today = '2026-09-01';
  const nowOver = AN.overdueDays(open5);
  AN.state.today = '2026-08-21';
  ok(103, !!open5 && open5.due === '2026-07-10' && open5.got === null &&
        !!closed1 && closed1.got === '2026-07-10' && closed1.full === true &&
        !!part2 && part2.got === '2026-07-18' && part2.full === false &&
        !none3 && stored.length === 0 && !thresholds &&
        wasOver === 42 && nowOver === 53 && AN.overdueDays(closed1) === 0,
    `запрос пакета — сущность со своими реквизитами: заёмщик, период, дата запроса, ` +
    `УСТАНОВЛЕННАЯ ДАТА (${closed1.due} у закрытого, ${open5.due} у незакрытого), редакция ` +
    `методики, дата получения и отдельная отметка полноты — у b-2 пакет получен ` +
    `${part2.got}, но НЕ полностью, и «пришло» от «пришло всё» отличено. Дней просрочки в ` +
    `записи нет ни у одного запроса: они считаются в момент вопроса (${wasOver} дн. на ` +
    `21.08.2026, ${nowOver} дн. на 01.09.2026) — пролежав сутки, поле стало бы неправдой ` +
    `(ADR-0001). Порогов 60 и 90 в состоянии модуля нет вовсе: их держат правила ` +
    `классификации, а мы отдаём число (ADR-0236 §4)`);

  /* Правила заведения: срок обязателен, задним числом не ставится, второго незакрытого
     запроса по паре не бывает, состав берётся у редакции методики на конец периода.   */
  AN.setRole(LEAD);
  const noDue = AN.requestDocs({ subj: 'b-1', period: '2П 2026', due: null });
  const past  = AN.requestDocs({ subj: 'b-1', period: '2П 2026', due: '2026-08-10' });
  const alien = AN.requestDocs({ subj: 'b-3', period: '1П 2026', due: '2026-09-05' });
  const guar  = AN.requestDocs({ subj: 's-6', period: '1П 2026', due: '2026-09-05' });
  const dbl   = AN.requestDocs({ subj: 'b-5', period: '1П 2026', due: '2026-09-05' });
  const good  = AN.requestDocs({ subj: 'b-1', period: '1П 2026', due: '2026-09-05' });
  const whys = [noDue.why, past.why, alien.why, guar.why, dbl.why];
  ok(104, !noDue.ok && !past.ok && !alien.ok && !guar.ok && !dbl.ok && good.ok &&
        new Set(whys).size === 5 &&
        has(noDue.why, 'без УСТАНОВЛЕННОЙ ДАТЫ не отправляется') && has(noDue.why, 'п. 11.2') &&
        has(past.why, 'не позже даты запроса') &&
        has(alien.why, 'чужого заёмщика вести нельзя') &&
        has(guar.why, 'пакет запрашивается для финанализа') &&
        has(dbl.why, 'уже есть незакрытый запрос ЗП-13') &&
        has(dbl.why, 'от какой считать 60 дней') &&
        good.request.ed === 2 && good.request.at === '2026-08-21' &&
        has(good.note, 'состав пакета — форма редакции 2') &&
        has(good.note, 'запрос без состава был бы пустой бумагой'),
    `пять разных промахов при запросе — пять разных отказов: без установленной даты («${
      noDue.why.slice(0, 48)}…» — без неё запрос не даёт того единственного, ради чего ` +
    `заводится), со сроком в прошлом, по чужому заёмщику, по субъекту без роли заёмщика и ` +
    `второй незакрытый по той же паре («две установленные даты на один пакет» — вопрос «от ` +
    `какой считать 60 дней» стал бы без ответа). Законный запрос состав пакета берёт У ` +
    `РЕДАКЦИИ МЕТОДИКИ на конец периода: «${good.note.slice(0, 60)}…»`);

  /* Получение — факт с датой; полнота — своя отметка; вторая дата получения не ставится. */
  const early = AN.receiveDocs({ id: 'ЗП-13', at: '2026-06-01' });
  const part  = AN.receiveDocs({ id: 'ЗП-13', at: '2026-08-20', full: false });
  const again = AN.receiveDocs({ id: 'ЗП-13', at: '2026-08-21' });
  const q13 = AN.state.requests.find(q => q.id === 'ЗП-13');
  ok(105, !early.ok && has(early.why, 'ответ до вопроса не приходит') &&
        part.ok && q13.got === '2026-08-20' && q13.full === false &&
        has(part.note, 'получен НЕ полностью') && AN.overdueDays(q13) === 0 &&
        !again.ok && has(again.why, 'уже закрыт получением') &&
        has(again.why, 'уточнение состава ведётся новым запросом'),
    `получение — ФАКТ с датой: ответ раньше вопроса отказан («${early.why.slice(0, 44)}…»), ` +
    `полученный не полностью пакет закрывает срок (дней после срока стало ${AN.overdueDays(q13)}), ` +
    `но отметку полноты держит СВОЮ — слепить «пришло» и «пришло всё» в один признак значило ` +
    `бы потерять неполный пакет. Второй даты получения у запроса нет: «${again.why.slice(0, 52)}…»`);

  /* Шов отдаёт ФАКТ. Ни одного слова суждения, ни порога, ни категории. */
  AN.seed();
  const dq5 = AN.docsRequested('b-5', '1П 2026');
  const dq3 = AN.docsRequested('b-3', '1П 2026');
  const dq1 = AN.docsRequested('b-1', '1П 2026');
  const dq6 = AN.docsRequested('s-6', '1П 2026');
  const noPer = AN.docsRequested('b-5', null);
  const words = /уклон|задержк|риск|нарушен|категор|60|90|плохо|недобросовест/i;
  const dirty = [dq5, dq3, dq1, dq6].filter(a => words.test(JSON.stringify(a)));
  ok(106, dq5.ok && dq5.requested === true && dq5.overdueDays === 42 && dq5.got === null &&
        dq3.ok && dq3.requested === false && dq3.overdueDays === 0 &&
        dq1.ok && dq1.got === '2026-07-10' && dq1.full === true && dq1.overdueDays === 0 &&
        dq6.ok && dq6.notBorrower === true && dirty.length === 0 &&
        !noPer.ok && has(noPer.why, 'вопрос без периода шву не задаётся') &&
        !('verdict' in dq5) && !('ratios' in dq5) && !('category' in dq5),
    `шов docsRequested отдаёт ФАКТ: у b-5 пакет запрошен ${dq5.at}, срок ${dq5.due}, ответа нет ` +
    `${dq5.overdueDays} дн.; у b-3 не запрашивался вовсе; у b-1 получен ${dq1.got} полностью. ` +
    `Слов суждения в ответе нет ни одного (искали «уклонение», «задержка», «риск», «категория»), ` +
    `порогов 60 и 90 — тоже: сравнивает с ними тот, кто ставит категорию, и делает это не ` +
    `автоматом. Вывода и коэффициентов шов не отдаёт. Вопрос без периода отказан: «пакет ` +
    `запрашивается ЗА ПЕРИОД», и «запрашивали ли вообще» — вопрос без ответа`);

  /* ИА-10 цел ПО СУЩЕСТВУ: классификации открыт факт и закрыто суждение. */
  const clsFact = AN.callSeam('классификация', 'docsRequested', 'b-5', '1П 2026');
  const clsVerd = AN.callSeam('классификация', 'analysisVerdict', 'b-5');
  const clsDone = AN.callSeam('классификация', 'analysisDone', 'b-5', '1П 2026', 'plan');
  const evading = AN.callSeam('классификация', 'docsEvading', 'b-5', '1П 2026');
  const defect  = AN.tryRequestDefect();
  ok(107, clsFact.ok && clsFact.answer.overdueDays === 42 &&
        !clsVerd.ok && has(clsVerd.why, 'ФАКТ, а не суждение') && has(clsVerd.why, 'ИА-10') &&
        !clsDone.ok && clsDone.why === clsVerd.why &&
        !evading.ok && has(evading.why, 'это СУЖДЕНИЕ') && has(evading.why, 'решения комитета') &&
        !defect.ok && has(defect.why, 'дефекта по запросу пакета анализ не считает') &&
        has(defect.why, 'обязательство вменяется РАСПИСАНИЕМ'),
    `классификации открыт ФАКТ и закрыто СУЖДЕНИЕ — на этом различении ИА-10 и держится: ` +
    `docsRequested она получает (${clsFact.answer.overdueDays} дн. после срока), а ` +
    `analysisVerdict и analysisDone — нет, обоим один отказ: «${clsVerd.why.slice(0, 58)}…». ` +
    `Готового признака «уклоняется» рядом с фактом не заведено: «${evading.why.slice(0, 56)}…». ` +
    `И дефекта по запросу модуль не считает — обязательство вменяет расписание, а запрос делает ` +
    `куратор своим решением (ADR-0236 §6)`);

  /* ИА-14 переписан: «заключения нет» получило РАЗЛИЧИМЫЕ причины. */
  const w5 = AN.whyNoDoc('b-5', '1П 2026');
  const w3 = AN.whyNoDoc('b-3', '1П 2026');
  const w1 = AN.whyNoDoc('b-1', '2П 2026');
  const done5 = AN.analysisDone('b-5', '1П 2026', 'plan');
  const done3 = AN.analysisDone('b-3', '1П 2026', 'plan');
  ok(108, w5.code === 'noanswer' && w3.code === 'norequest' && w1.code === 'norequest' &&
        new Set([w5.text, w3.text, w1.text]).size === 3 &&
        has(w5.text, 'пакет запрошен 25.06.2026, срок 10.07.2026, не получен') &&
        has(w5.text, '42 дн. после срока') && has(w3.text, 'не запрашивался') &&
        done5.done === false && done5.docs === 'noanswer' && done5.why === w5.text &&
        done3.done === false && done3.docs === 'norequest' && done3.why === w3.text,
    `«анализа нет» больше не один текст на две беды: у b-5 «${w5.text}», у b-3 «${w3.text}». ` +
    `Лечатся они РАЗНЫМИ людьми — первую заёмщик ответом, вторую куратор запросом, — и один ` +
    `текст послал бы одного из двоих не туда (ИА-14, ADR-0236 §5). Причина уходит и в шов: ` +
    `analysisDone отдаёт код «${done5.docs}» и тот же текст, что печатается на экране, — ` +
    `собран он одним местом, а не выписан дважды (ИА-19)`);

  /* Экраны: блок запросов на карточке, причина в зеркале, третий шов в площадке. */
  AN.seed();
  AN.setRole(LEAD);
  AN.pickSubj('b-5'); AN.go('borrower'); const b5 = panel();
  AN.pickSubj('b-1'); AN.go('borrower'); const b1 = panel();
  AN.setRole(ANALYST);
  AN.pickSubj('b-3'); AN.go('borrower'); const b3 = panel();
  AN.go('schedule'); const sch = panel();
  ok(109, has(b5, 'Запросы финансового пакета') && has(b5, '<th>Установленная дата</th>') &&
        has(b5, '<th class="num">Дней после срока</th>') && has(b5, '<b>42</b>') &&
        has(b5, 'ответа нет') && has(b5, 'Отметить получение') &&
        has(b5, 'пакет запрошен 25.06.2026, срок 10.07.2026, не получен — 42 дн. после срока') &&
        has(b1, 'полный') && has(b1, 'Запросить без срока') &&
        has(b1, 'Посчитать дефект по запросу') &&
        has(b3, 'Пакет по этому заёмщику не запрашивался') &&
        has(b3, 'пакет за «1П 2026» не запрашивался') && !has(b3, 'Запросить пакет</button>') &&
        has(sch, 'docsRequested') && has(sch, 'наружу их три') &&
        has(sch, '<option>docsEvading</option>') &&
        has(sch, 'первый, который отдаёт НЕ СУЖДЕНИЕ'),
    `на карточке заёмщика стоит блок запросов: установленная дата своей колонкой, дни после ` +
    `срока — считанным числом (42 у b-5), полнота отдельной отметкой. Причина «анализа нет» ` +
    `печатается В ЗЕРКАЛЕ шапки теми же словами, что уходят в шов: у b-5 «не получен — 42 дн. ` +
    `после срока», у b-3 «не запрашивался». Кнопки запроса аналитику не показаны — запрашивает ` +
    `ведущий куратор, — а «Посчитать дефект по запросу» стоит рядом и отказывает словами. В ` +
    `площадке швов их три, и рядом с ними стоит несуществующий «docsEvading»: спросив его, ` +
    `человек читает, почему признака «уклоняется» здесь нет и не будет`);
})();

/* ============ БЛОК Y. ВОЛНА 15 — ДИНАМИКА КОЭФФИЦИЕНТА (АН-83, АН-85) ==========
   Четвёртая развилка волны 15, и она о ПОКАЗЕ: величина, которой нужны две и более даты,
   объявлена работой этого модуля ещё инвариантом ИА-22, но исполнялась только в разделе
   обзоров — у финанализа ряда не было вовсе. Здесь проверено, что ряд СОБИРАЕТСЯ, а не
   лежит: ни одного его числа в записи заключения нет, порядок берётся по концу периода, а
   не по дате подписи, ряд строится внутри повода и сравнивает только посчитанное одной
   редакцией методики, а несопоставимая точка называется словами вместо молчаливого
   пропуска. Ею же отвечена строка ТЗ «использование AI для прогнозирования»: отвечена
   ВИДОМ ИЗМЕНЕНИЯ, а предсказание отказано по имени (АН-85).                          */
(() => {
  const LEAD = 'Ведущий куратор (Бекова Н.)';
  const el = () => ({ innerHTML: '', textContent: '', dataset: {}, value: '',
    classList: { toggle() {}, add() {}, remove() {} }, appendChild() {}, remove() {} });
  const nodes = { '#panel': el(), '#title': el(), '#foot': el(), '#role': el(), '#subj': el() };
  sandbox.document = { querySelector: k => nodes[k] || el(), querySelectorAll: () => [],
    getElementById: () => null, createElement: () => el() };
  const panel = () => nodes['#panel'].innerHTML;

  /* Ряд СЧИТАЕТСЯ и в записи не лежит: ни одного поля под него — ни в заключении, ни в снимке. */
  AN.seed();
  const t = AN.trend('ФА-11', 'k-free');
  const pti = AN.trend('ФА-11', 'k-pti');
  const keys = ['trend', 'series', 'dynamics', 'points', 'prevV', 'delta'];
  const inDoc = AN.state.analyses.filter(a => keys.some(k => k in a));
  const inSnap = AN.state.analyses.filter(a => a.snapshot && keys.some(k => k in a.snapshot));
  const store = AN.tryStoreTrend();
  ok(110, t.ok && t.points.length === 2 && t.apart.length === 0 &&
        t.points[0].period === '2025 год' && t.points[0].v === 7000 && t.points[0].delta === null &&
        t.points[1].period === '1П 2026' && t.points[1].v === 17000 && t.points[1].cur === true &&
        t.points[1].delta.v === 10000 && has(t.points[1].delta.text, '+10 000,00 сом') &&
        pti.points[1].delta.text === '−5,49 п.п.' &&
        inDoc.length === 0 && inSnap.length === 0 &&
        !store.ok && has(store.why, 'ряда значений в заключении не хранится') &&
        has(store.why, 'разошёлся бы с первым'),
    `динамика СОБИРАЕТСЯ в момент вопроса: свободный остаток у b-7 — 7 000,00 за «2025 год» ` +
    `(ФА-10) и 17 000,00 за «1П 2026» (ФА-11), изменение «${t.points[1].delta.text}» посчитано ` +
    `здесь же. Полей под ряд нет ни у одного заключения и ни у одного снимка (искали trend, ` +
    `series, dynamics, points, delta) — каждое число уже лежит в снимке СВОЕГО документа, и ` +
    `второй экземпляр разошёлся бы с первым после первого же переиздания (ADR-0001, довод ` +
    `ИА-20). Изменение ДОЛИ показано в пунктах: платёж к доходу «${pti.points[1].delta.text}», ` +
    `а не «в процентах от процента» (ADR-0150 §4)`);

  /* Порядок — по КОНЦУ ПЕРИОДА, а не по дате подписи. Доказано операцией: заключение за
     прошлый год подписывается СЕГОДНЯ, позже, чем текущее, — и встаёт в ряд прошлым годом. */
  AN.seed();
  AN.setRole(LEAD);
  const late = AN.newAnalysis({ subj: 'b-1', report: 'r-101', occasion: 'plan' });
  AN.setText(late.doc.no, 'Годовое заключение подписано с опозданием.');
  AN.setVerdict(late.doc.no, 'удовлетворительное');
  const okLate = AN.approve(late.doc.no);
  const cur = AN.trend('ФА-7', 'k-cur');
  const lateAt = AN.DOC(late.doc.no).approvedAt, curAt = AN.DOC('ФА-7').approvedAt;
  ok(111, okLate.ok && lateAt > curAt &&
        cur.ok && cur.points.length === 1 && cur.points[0].cur === true &&
        cur.apart.length === 1 && cur.apart[0].period === '2025 год' &&
        cur.apart[0].code === 'edition' && has(cur.apart[0].why, 'считано по редакции 1') &&
        has(cur.apart[0].why, 'бывает другой величиной') && has(cur.apart[0].why, 'ИА-5'),
    `${late.doc.no} за «2025 год» подписано ${lateAt} — ПОЗЖЕ, чем ФА-7 за «1П 2026» (${curAt}), — ` +
    `и всё равно стоит в ряду прошлым годом: порядок берётся у КОНЦА ПЕРИОДА, потому что дата ` +
    `подписи говорит, когда работали, а период — про что считали. В ряд эта точка не встала по ` +
    `другой причине и причина названа: «${cur.apart[0].why.slice(0, 62)}…» — у редакции 1 порог ` +
    `текущей ликвидности 1,0, у редакции 2 он 1,2, и одно имя двух величин одной не делает`);

  /* Ряд строится ВНУТРИ ПОВОДА, а переиздание вытесняет прежнюю точку, а не удваивает её. */
  AN.seed();
  AN.setRole(LEAD);
  const appl = AN.newAnalysis({ subj: 'b-7', report: 'r-701', occasion: 'appl' });
  AN.setText(appl.doc.no, 'Заключение по заявке на неполном пакете.');
  AN.setVerdict(appl.doc.no, 'удовлетворительное');
  AN.approve(appl.doc.no);
  const stillTwo = AN.trend('ФА-11', 'k-free');
  const re = AN.reissue({ doc: 'ФА-10', report: 'r-701' });
  const byAppl = AN.trend(appl.doc.no, 'k-free');
  ok(112, stillTwo.points.length === 2 && stillTwo.apart.length === 0 &&
        stillTwo.points[0].no === 'ФА-10' && !re.ok &&
        byAppl.ok && byAppl.points.length === 1 && byAppl.points[0].cur === true &&
        byAppl.apart.length === 0,
    `заключение по заявке за «2025 год» (${appl.doc.no}) в ПЛАНОВЫЙ ряд не вошло: точек ` +
    `по-прежнему две, и обе плановые. Ключ документа тройной, повод в нём не декорация ` +
    `(ADR-0233), а заключение по заявке часто считано на неполном пакете — точкой планового ` +
    `ряда оно сравнивало бы разное. Симметрично: у ряда по заявке прошлых точек нет ни одной, ` +
    `и это не «нет данных», а «ряд по этому поводу начался сейчас»`);

  /* Другая МЕТОДИКА — не другая редакция: причина своя, и говорится она своими словами. */
  AN.seed();
  AN.setRole(LEAD);
  AN.setText('ФА-9', 'Черновик за 1П 2026.');
  const draftTrend = AN.trend('ФА-9', 'k-pti');
  const noCoef = AN.trend('ФА-9', 'k-cov');
  ok(113, draftTrend.ok && draftTrend.live === true &&
        draftTrend.points.length === 1 && draftTrend.points[0].cur === true &&
        draftTrend.points[0].live === true &&
        draftTrend.apart.length === 1 && draftTrend.apart[0].code === 'method' &&
        has(draftTrend.apart[0].why, 'считано другой МЕТОДИКОЙ') &&
        has(draftTrend.apart[0].why, 'Оценка индивидуального предпринимателя') &&
        has(draftTrend.apart[0].why, 'ИА-4') &&
        !noCoef.ok && has(noCoef.why, 'в редакции методики этого заключения нет'),
    `у b-2 прошлое заключение считано методикой ИП (лицо снялось с учёта 10.02.2026), текущее — ` +
    `методикой физлица, и точка в ряд не встала со СВОЕЙ причиной: «${
      draftTrend.apart[0].why.slice(0, 58)}…». Причина отличена от «другой редакции» ` +
    `(code «${draftTrend.apart[0].code}» против «edition»): методику меняет тип лица на дату ` +
    `отчётности (ИА-4), а редакцию — отдел анализа записью. Текущая точка черновика названа ` +
    `живым расчётом, а не снимком (ИА-2). Чужой коэффициент шву не задаётся: «${
      noCoef.why.slice(0, 46)}…»`);

  /* Прогноз: строка ТЗ отвечена динамикой, предсказание отказано ПО ИМЕНИ (АН-85). */
  const fc = AN.tryForecast();
  const src = readFileSync(HTML, 'utf8');
  const words = /прогнозируем|предсказ[аы]|балл заёмщика|скоринг/i.test(
    JSON.stringify(AN.state.analyses) + JSON.stringify(AN.state.methods));
  ok(114, !fc.ok && has(fc.why, 'прогноза значений модуль не считает') &&
        has(fc.why, 'ВИДОМ ИЗМЕНЕНИЯ ВО ВРЕМЕНИ') && has(fc.why, 'суждение под подписью') &&
        has(fc.why, 'Балльной модели и весов') && !words &&
        src.indexOf('AN.forecast =') < 0 && src.indexOf('AN.score =') < 0,
    `строка ТЗ §3.2 «использование AI для прогнозирования» отвечена ВИДОМ ИЗМЕНЕНИЯ ВО ВРЕМЕНИ, ` +
    `а предсказание отказано по имени: «${fc.why.slice(0, 64)}…». Функции forecast/score в файле ` +
    `нет ни одной, полей под баллы и веса в методиках и заключениях — тоже: зарезервированное ` +
    `поле заполняют, а подписать предсказанное число некому — вывод есть суждение под подписью ` +
    `человека (АН-85)`);

  /* Экран: карточка динамики стоит рядом с коэффициентами и печатает ряд, причину и отказы. */
  AN.seed();
  AN.setRole(LEAD);
  AN.pickSubj('b-7'); AN.openDoc('ФА-11'); const p11 = panel();
  AN.pickSubj('b-1'); AN.openDoc('ФА-7');  const p7  = panel();
  ok(115, has(p11, 'Динамика <span class="small">— показывается, не хранится') &&
        has(p11, '<th class="num">Изменение</th>') && has(p11, '+10 000,00 сом') &&
        has(p11, '−5,49 п.п.') && has(p11, 'ФА-10, утверждено 25.02.2026') &&
        has(p11, 'этот документ') && has(p11, 'упорядочен по концу периода, а не по дате подписи') &&
        has(p11, 'Сохранить ряд в заключении') && has(p11, 'Показать прогноз (AI)') &&
        has(p7, 'Сравнивать не с чем') && has(p7, 'ряд из одной точки не динамика') &&
        has(p7, 'прежних утверждённых заключений по поводу «плановый» за более ранние периоды нет'),
    `карточка «Динамика» стоит РЯДОМ с коэффициентами: у ФА-11 ряд из двух точек с изменением ` +
    `(+10 000,00 сом и −5,49 п.п.), прошлая точка подписана своей датой, текущая помечена «этот ` +
    `документ». У ФА-7 прошлых сопоставимых точек нет, и на месте ряда стоят СЛОВА, а не пустая ` +
    `таблица. Рядом — две кнопки, обе отказывающие: сохранить ряд в заключении и показать прогноз`);
})();

/* ---- отчёт ---- */
const pass = results.filter(r => r.pass).length;
const lines = results.map(r => `   ${r.pass ? 'PASS' : 'FAIL'}  #${r.n}  ${r.note}`);
console.log(`SMOKE 2026-09-08 · ${pass}/${results.length} PASS\n` + lines.join('\n'));

const body = lines.map(l => '  ' + l).join('\n');
const injected = `  SMOKE 2026-09-08 · ${pass}/${results.length} PASS\n` + body;
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
