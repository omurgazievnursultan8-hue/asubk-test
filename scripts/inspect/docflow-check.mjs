// Смоук макета «Документооборот» (mockups/docflow/docflow.html) — волна 1, на jsdom.
// Источник ожиданий — канон mockups/docflow/ASUBK-dokumentooborot-logika.md: §2 этапы и переходы,
// §3 нумерация, §4 исполнение, §5 отправка, §7 архив, §8 права и видимость, §9 журналы и показатели,
// §10.1 шов с «Заданиями», §12 инварианты ИД-1…ИД-20; сценарии приёмки С-1…С-32 раздела ТЗ 23.
// Каждая группа грузит свежий DOM (свежий seed) — состояние между группами не течёт.
// Запуск: node scripts/inspect/docflow-check.mjs        (выход 1 при любом провале)
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(resolve(HERE, '../../mockups/docflow/docflow.html'), 'utf8');

const ALL_ERRS = [];
function load() {
  const errs = []; const vc = new VirtualConsole();
  vc.on('jsdomError', e => { errs.push(String(e.message || e)); ALL_ERRS.push(String(e.message || e)); });
  const dom = new JSDOM(HTML, { runScripts: 'dangerously', virtualConsole: vc, url: 'http://localhost/', beforeParse(w) { w.print = () => {}; } });
  const w = dom.window, DF = w.DF;
  if (!DF) throw new Error('window.DF не экспортирован');
  const panel = () => w.document.getElementById('panel');
  const text = () => panel().textContent.replace(/\s+/g, ' ');
  return { w, DF, doc: w.document, errs, panel, text, X: DF.SEEDED };
}
let n = 0, fails = 0; const failed = [];
function ok(name, cond, detail) {
  n++; let v = cond;
  if (typeof v === 'function') { try { v = v(); } catch (e) { detail = 'исключение: ' + e.message; v = false; } }
  if (!v) { fails++; failed.push(name + (detail !== undefined ? ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
  console.log(`${v ? '  ✓' : '  ✗ FAIL'}  ${name}${!v && detail !== undefined ? '\n        факт: ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`);
}
function group(label, fn) {
  console.log('\n── ' + label);
  try { fn(load()); } catch (e) { n++; fails++; failed.push(label + ' — исключение: ' + e.message); console.log('  ✗ FAIL (исключение) ' + e.stack.split('\n').slice(0, 3).join(' | ')); }
}
const has = (s, sub) => String(s || '').toLowerCase().includes(String(sub).toLowerCase());
const keys = DF => new Set(DF.povods().map(p => p.key));
const lastLog = d => d.log[d.log.length - 1];
// исходящий черновик с маршрутом, доведённый до нужного этапа
function outDraft(DF, author, f) {
  const r = DF.create(author, 'out', f); if (!r.ok) throw new Error('create: ' + r.why);
  const a = DF.attach(r.id, author, 'project', 'proekt.docx'); if (!a.ok) throw new Error('attach: ' + a.why);
  return r.id;
}

/* ============================ A. каркас ============================= */
group('A. Каркас: загрузка, часы, шапка', ({ DF, errs }) => {
  ok('страница грузится без ошибок консоли, seed собран действиями движка', errs.length === 0 && DF.DOCS.length >= 20, errs);
  ok('«сегодня» заморожено: TODAY = 2026-10-15, часы стоят на нём', DF.TODAY === '2026-10-15' && DF.clock() === DF.TODAY);
  ok('в коде нет Date.now() и new Date() без аргумента', !/Date\.now\(\)|new Date\(\)/.test(HTML));
  const hdr = HTML.slice(0, HTML.indexOf('-->'));
  ok('шапка называет решения модуля ADR-0265…ADR-0272', ['0265', '0266', '0267', '0268', '0269', '0270', '0271', '0272'].every(x => hdr.includes('ADR-' + x)));
  ok('шапка называет демо-заполнение права подписи из-за неотвеченного ДО-ВЗ-4', /ДО-ВЗ-4/.test(hdr) && /демо/i.test(hdr));
  ok('шапка называет демо-номенклатуру (ДО-ВЗ-1) и рабочие дни без праздников', /ДО-ВЗ-1/.test(hdr) && /праздники не учтены/.test(hdr));
  ok('в файле ровно один тег script и нет внешних ресурсов', (HTML.match(/<script/g) || []).length === 1 && !/src=|href="http/.test(HTML));
});

/* ========================== B. сущности ============================= */
group('B. Сущности и справочники (§1)', ({ DF }) => {
  ok('видов три: входящий, исходящий, внутренний', Object.keys(DF.KINDS).join() === 'in,out,int');
  const cnt = k => DF.TYPES.filter(t => t.kind === k).length;
  ok('стартовый набор типов: 8 входящих, 15 исходящих, 6 внутренних', cnt('in') === 8 && cnt('out') === 15 && cnt('int') === 6, [cnt('in'), cnt('out'), cnt('int')]);
  ok('«Документ (из старой системы)» — только для перенесённых: черновик этого типа не создаётся',
    !DF.create('e7', 'in', { type: 't-in-legacy', subject: 'x' }).ok);
  ok('обязательная привязка задана типом: иск — кредит + фаза, заявление заёмщика — заёмщик',
    DF.typeOf('t-out-isk').links.join() === 'loan,phase' && DF.typeOf('t-in-zayav').links.join() === 'borrower');
  ok('способов отправки шесть; почта требует идентификатор, состав подтверждения — реквизит способа',
    Object.keys(DF.METHODS).length === 6 && DF.METHODS.post.track && DF.METHODS.post.proof && !DF.METHODS.email.proof);
  ok('справочник права подписи заполнен (демо) строками «сотрудник × типы × основание × срок»',
    DF.SIGN.length >= 4 && DF.SIGN.every(s => s.emp && s.types.length && s.basis && s.from && s.to));
  ok('ИД-12: у документа нет хранимого поля статуса исполнения',
    DF.DOCS.every(d => !Object.keys(d).some(k => /exec|status|executed|исполн/i.test(k))));
  ok('резолюция — отдельная запись: автор, текст, один ответственный, соисполнители, срок, родитель',
    DF.RES.length > 0 && DF.RES.every(r => r.author && r.text && typeof r.resp === 'string' && Array.isArray(r.co) && r.due && 'parent' in r));
});

/* ======================= C. этапы и маршрут ========================= */
group('C. Этапы и маршрут согласования (§2; С-12…С-14, С-16)', ({ DF }) => {
  ok('этапов шесть, «Отправлен» и «Исполнен» этапами не являются',
    Object.values(DF.STAGES).join('|') === 'Черновик|Согласование|Подпись|Зарегистрирован|В деле|Аннулирован');
  const id = outDraft(DF, 'e4', { type: 't-out-letter', subject: 'Проверка маршрута', addressees: [{ subj: 'b1' }], approvers: ['e6', 'e3', 'e2'], signer: 'e1' });
  ok('ИД-5: вид документа не меняется', !DF.update(id, 'e4', { kind: 'int' }).ok);
  ok('на согласование отправляет только автор', !DF.submit(id, 'e5').ok);
  ok('черновик → «Согласование» (согласующих трое)', DF.submit(id, 'e4').ok && DF.doc(id).stage === 'approval');
  ok('согласовать может только назначенный согласующий', !DF.approve(id, 'e11').ok);
  DF.approve(id, 'e6'); DF.approve(id, 'e3');
  ok('ИД-6: двое из трёх согласовали — документ ещё не в «Подписи»', DF.doc(id).stage === 'approval');
  ok('отказ без комментария не принимается', !DF.reject(id, 'e2', '  ').ok);
  ok('С-12: отказ третьего → «Черновик», комментарий в журнале', DF.reject(id, 'e2', 'Уточнить сумму').ok && DF.doc(id).stage === 'draft' && has(lastLog(DF.doc(id)).text, 'Уточнить сумму'));
  ok('С-12: у автора повод «доработать черновик»', keys(DF).has('doc-revise|' + id));
  const t3 = DF.TASKS.filter(t => t.key.startsWith('doc-approve|' + id));
  ok('С-16: согласование в карточке закрыло задание исходом «исполнено», а не «отпало»',
    t3.filter(t => t.key.endsWith('×e6')).every(t => t.outcome === 'исполнено') && DF.TASKS.every(t => !has(t.outcome, 'отпало')));
  ok('С-13: повторная отправка — круг 2 с тремя новыми шагами; исходы круга 1 сохранены',
    DF.submit(id, 'e4').ok && DF.doc(id).rounds.length === 2 && DF.doc(id).rounds[1].steps.every(s => !s.res) && DF.doc(id).rounds[0].steps.filter(s => s.res === 'ok').length === 2);
  ok('С-13: задание второго круга — повтор после прежнего (ключ тот же, закрытое не переоткрыто)',
    DF.TASKS.some(t => t.open && t.key === 'doc-approve|' + id + '×e6' && t.repeatOf));
  DF.approve(id, 'e6'); DF.approve(id, 'e3');
  ok('С-14: замена «проекта» после двух согласований → «Черновик», круг закрыт',
    DF.attach(id, 'e4', 'project', 'v2.docx', { replace: true }).ok && DF.doc(id).stage === 'draft' && /заменён/.test(DF.doc(id).rounds[1].closed.why));
  ok('версия проекта выросла, прежняя видна в истории; имя файла даёт система', (() => { const f = DF.doc(id).files.find(x => x.role === 'project');
    return f.ver === 2 && f.hist.length === 1 && /_проект_v2\.docx$/.test(DF.fileName(DF.doc(id), f)) && !/proekt|v2\.docx_/.test(DF.fileName(DF.doc(id), f)); })());
  const id2 = outDraft(DF, 'e4', { type: 't-out-letter', subject: 'Без согласующих', addressees: [{ subj: 'b1' }], signer: 'e2' });
  ok('согласующих нет — сразу в «Подпись»', DF.submit(id2, 'e4').ok && DF.doc(id2).stage === 'signing');
  ok('на согласование без файла «проект» и подписанта — отказ с перечнем',
    (() => { const r = DF.create('e4', 'out', { type: 't-out-letter', subject: 'x' }); const s = DF.submit(r.id, 'e4'); return !s.ok && has(s.why, 'подписант') && has(s.why, 'проект'); })());
  ok('черновик удаляется автором логически, след в журнале', (() => { const r = DF.del(id, 'e4'); return r.ok && DF.doc(id).deleted && DF.doc(id).log.some(l => l.act === 'Черновик удалён'); })());
});

/* ===================== D. регистрация и номера ====================== */
group('D. Регистрация и нумерация (§3; С-1…С-4, С-19)', ({ DF, X }) => {
  ok('С-1: входящий без привязки к заёмщику не регистрируется, текст называет привязку', (() => { const r = DF.register(X.i6, 'e7'); return !r.ok && has(r.why, 'заёмщик'); })());
  ok('регистрирует только роль «Регистратор»', !DF.register(X.i6, 'e4').ok);
  DF.update(X.i6, 'e7', { links: ['borrower:b2'] });
  const r2 = DF.register(X.i6, 'e7');
  ok('С-2: с привязкой — номер 4876 (следующий в году), дата регистрации — сегодня', r2.ok && DF.doc(X.i6).no.n === 4876 && DF.doc(X.i6).regDate === DF.TODAY, r2);
  ok('С-2: получателю — повод «рассмотреть входящий»', keys(DF).has('doc-review|' + X.i6 + '×e3'));
  ok('перенос: первый новый ВХ 2026 года = максимум прежней системы + 1 (4871), ИСХ — 2173, ряд ВН с 1',
    DF.noText(DF.doc(X.i1), false) === '4871' && DF.noText(DF.doc(X.o1), false) === '19-03-01/2173' && DF.noText(DF.doc(X.n1), false) === '19-01/ВН-1');
  ok('формат: ИСХ «<код отдела>/<n>» по отделу автора, ВН «<код>/ВН-<n>», на карточке с годом',
    DF.noText(DF.doc(X.o6)) === '19-04/2176 / 2026' && DF.noText(DF.doc(X.n2)) === '19-03-01/ВН-2 / 2026');
  const a = DF.create('e7', 'in', { type: 't-in-bank', subject: 'A', sender: { text: 'Банк А' }, receivedDate: DF.TODAY, recipients: ['e3'] });
  const b = DF.create('e8', 'in', { type: 't-in-bank', subject: 'B', sender: { text: 'Банк Б' }, receivedDate: DF.TODAY, recipients: ['e3'] });
  DF.attach(a.id, 'e7', 'scan', 'a.pdf'); DF.attach(b.id, 'e8', 'scan', 'b.pdf');
  DF.register(a.id, 'e7'); DF.register(b.id, 'e8');
  ok('С-3: два регистратора подряд — номера разные и подряд', DF.doc(b.id).no.n === DF.doc(a.id).no.n + 1);
  ok('ИД-1: «ряд, год, номер» уникален среди документов новой системы', (() => { const s = DF.DOCS.filter(d => d.no && !d.legacy).map(d => d.kind + d.no.year + '-' + d.no.n); return s.length === new Set(s).size; })());
  ok('перенесённые сохраняют номера с дублями: два ВХ «1203 / 2025»', DF.DOCS.filter(d => d.legacy && d.legacyNo === '1203').length === 2);
  ok('ИД-2: номера нет в черновике/согласовании/подписи и есть в остальных этапах',
    DF.DOCS.filter(d => !d.legacy && !d.deleted).every(d => ['draft', 'approval', 'signing'].includes(d.stage) ? !d.no : !!d.no));
  ok('исходящий без отметки «Подписано» не регистрируется', has(DF.register(X.o9, 'e7').why, 'Подписано'));
  ok('у подразделения автора нет кода отдела — регистрация недоступна', has(DF.register(X.n3, 'e7').why, 'кода отдела'));
  DF.setClock('2027-01-11');
  const c = DF.create('e7', 'in', { type: 't-in-bank', subject: 'Новый год', sender: { text: 'Банк' }, receivedDate: '2027-01-11', recipients: ['e3'] });
  DF.attach(c.id, 'e7', 'scan', 'c.pdf'); DF.register(c.id, 'e7');
  ok('С-4: первая регистрация нового года — ВХ = 1 / 2027 (по правилу, без ручного сброса)', DF.doc(c.id).no.n === 1 && DF.doc(c.id).no.year === 2027);
  ok('С-4: исходящий ряд нового года тоже с 1', DF.register(X.o7, 'e7').ok && DF.doc(X.o7).no.n === 1 && DF.doc(X.o7).no.year === 2027);
});

group('D2. Скан с номером, файлы после регистрации, исправление (С-19, С-22; ИД-4, ИД-8, ИД-15)', ({ DF, X }) => {
  const d = DF.doc(X.o6), a = d.addressees[0];
  ok('С-19: номер выдан, но без файла «подписанный» отправка недоступна', !!d.no && has(DF.markSent(X.o6, 'e7', a.id, { method: 'hand', date: DF.TODAY }).why, 'подписанный'));
  ok('ИД-8: после регистрации файл не заменяется', !DF.attach(X.o6, 'e6', 'appendix', 'x.pdf', { replace: true }).ok);
  ok('ИД-8: после регистрации файл не удаляется', !DF.removeFile(X.o6, 'e6', d.files[0].id).ok);
  ok('после регистрации регистратор добавляет скан «подписанный»; имя от номера', (() => { const r = DF.attach(X.o6, 'e7', 'signed', 'IMG_4411 Мамбетов.pdf'); return r.ok && DF.fileName(d, r.file) === 'ИСХ-2026-2176_подписанный.pdf'; })());
  ok('формат и размер проверяются: .exe и 25 МБ — отказ', !DF.attach(X.o6, 'e7', 'appendix', 'a.exe').ok && !DF.attach(X.o6, 'e7', 'appendix', 'a.pdf', { size: 25 * 1024 * 1024 }).ok);
  ok('теперь отправка отмечается', DF.markSent(X.o6, 'e7', a.id, { method: 'hand', date: DF.TODAY }).ok);
  const i3 = DF.doc(X.i3), rd = i3.regDate;
  ok('С-22: «Исправить» номер корреспондента — в журнале было/стало, кто, основание',
    DF.correct(X.i3, 'e7', 'corrNo', '15/07', 'Опечатка при вводе').ok && /было «б\/н», стало «15\/07»/.test(lastLog(i3).text) && has(lastLog(i3).text, 'Опечатка') && lastLog(i3).by === 'e7');
  ok('С-22: тип, вид, номер, дата регистрации не исправляются', ['type', 'kind', 'no', 'regDate'].every(f => !DF.correct(X.i3, 'e7', f, 'x', 'осн.').ok));
  ok('исправление без основания и не регистратором — отказ', !DF.correct(X.i3, 'e7', 'subject', 'x', '').ok && !DF.correct(X.i3, 'e3', 'subject', 'x', 'осн.').ok);
  ok('ИД-15: дата поступления не исправляется на дату позже регистрации', !DF.correct(X.i3, 'e7', 'receivedDate', '2026-10-10', 'осн.').ok);
  ok('ИД-4: дата регистрации не изменилась ни одним действием', i3.regDate === rd);
  ok('удаление привязки ниже обязательного набора — отказ', !DF.correct(X.i3, 'e7', 'links', [], 'осн.').ok);
  ok('ИД-3: зарегистрированный документ не удаляется никем', ['e7', 'e1', 'e3', 'e4'].every(u => !DF.del(X.i3, u).ok));
});

group('D3. Аннулирование (С-20, С-21; ИД-9)', ({ DF, X }) => {
  ok('С-20: отправленному адресату — аннулировать нельзя', has(DF.annul(X.o2, 'e7', 'ошибка').why, 'отправлено'));
  ok('без основания — отказ', !DF.annul(X.o6, 'e7', '').ok);
  const before = DF.TASKS.find(t => t.open && t.key === 'doc-dispatch|' + X.o6);
  ok('С-21: аннулирование неотправленного → «Аннулирован», номер остаётся', DF.annul(X.o6, 'e7', 'Ошибочный адресат').ok && DF.doc(X.o6).stage === 'annulled' && DF.noText(DF.doc(X.o6)) === '19-04/2176 / 2026');
  ok('аннулирование снимает открытые шаги: «отправить» закрыт исходом «снято»', before && before.outcome === 'снято' && has(before.note, 'аннулирован'));
  ok('мера, читающая документ, получает метку расхождения', DF.measureView(X.o6).discrepancy === true);
  const id = outDraft(DF, 'e4', { type: 't-out-letter', subject: 'Следующий', addressees: [{ subj: 'b1' }], signer: 'e2' });
  DF.submit(id, 'e4'); DF.sign(id, 'e2'); DF.register(id, 'e7');
  ok('С-21: следующий документ получает следующий номер (2178), занятый не возвращается', DF.doc(id).no.n === 2178);
  ok('ИД-9: ни у одного аннулированного нет отправки', DF.DOCS.filter(d => d.stage === 'annulled').every(d => d.addressees.every(a => !a.sentDate)));
});

/* ============================ E. исполнение ========================= */
group('E. Резолюции и каскад (§4.1–4.2; С-5…С-7; ИД-10, ИД-11)', ({ DF, X }) => {
  ok('резолюцию даёт получатель: не получатель — отказ', !DF.giveRes(X.i5, 'e4', { text: 't', resp: 'e4', due: '2026-10-20' }).ok);
  ok('у исходящего резолюций нет', !DF.giveRes(X.o2, 'e7', { text: 't', resp: 'e4', due: '2026-10-20' }).ok);
  ok('ИД-11: два ответственных — отказ; без ответственного — отказ',
    !DF.giveRes(X.i5, 'e3', { text: 't', resp: ['e4', 'e5'], due: '2026-10-20' }).ok && !DF.giveRes(X.i5, 'e3', { text: 't', due: '2026-10-20' }).ok);
  const r = DF.giveRes(X.i5, 'e3', { text: 'Разобраться', resp: 'e4', co: ['e5', 'e6'], due: '2026-10-20' });
  const ex = DF.povods().filter(p => p.key.startsWith('doc-execute|' + r.id));
  ok('С-5: ответственный и два соисполнителя — три шага «исполнить», срок у всех 20.10', r.ok && ex.length === 3 && ex.every(p => p.due === '2026-10-20'));
  ok('рассмотрение получателя закрыто резолюцией', !keys(DF).has('doc-review|' + X.i5 + '×e3'));
  ok('С-6: резолюция ниже со сроком 25.10 — отказ: позже срока родительской', has(DF.giveRes(X.i5, 'e4', { parent: r.id, text: 't', resp: 'e5', due: '2026-10-25' }).why, 'позже'));
  const c = DF.giveRes(X.i5, 'e4', { parent: r.id, text: 'Подготовить справку', resp: 'e5', due: '2026-10-19' });
  ok('каскад: резолюция ниже в срок принимается, её даёт исполнитель верхней', c.ok && DF.res(c.id).parent === r.id);
  ok('резолюцию ниже не исполнитель верхней не даёт', !DF.giveRes(X.i5, 'e11', { parent: r.id, text: 't', resp: 'e5', due: '2026-10-19' }).ok);
  ok('ИД-10: срок каждой резолюции ниже не позже срока родительской на момент выдачи', DF.RES.filter(x => x.parent).every(x => x.due <= x.parentDueAtIssue));
  ok('ИД-11: у каждой резолюции ровно один ответственный', DF.RES.every(x => typeof x.resp === 'string' && !x.co.includes(x.resp)));
  ok('отметить «Исполнено» может только ответственный', !DF.resDone(r.id, 'e5', 'готово').ok);
  ok('без текста результата — отказ', !DF.resDone(r.id, 'e4', '').ok);
  ok('С-7: ответственный исполнил, соисполнители нет — резолюция исполнена', DF.resDone(r.id, 'e4', 'Разобрались').ok && DF.resState(DF.res(r.id)).code === 'done');
  ok('С-7: сводка «поручений 1: исполнено 1»', DF.execText(DF.doc(X.i5)) === 'поручений 1: исполнено 1', DF.execText(DF.doc(X.i5)));
  ok('задания соисполнителей закрыты исходом «снято» с причиной «резолюция исполнена»',
    ['e5', 'e6'].every(e => DF.TASKS.some(t => t.key === 'doc-execute|' + r.id + '×' + e && t.outcome === 'снято' && has(t.note, 'резолюция исполнена'))));
  ok('резолюция ниже закрытой ветки снята', DF.resState(DF.res(c.id)).code === 'withdrawn');
  const d = DF.doc(X.i5); const base = { ...d };
  ok('срок по умолчанию: Обычно — 10 р.д. от регистрации', DF.defaultDue(base) === DF.addWork(d.regDate, 10));
  ok('Срочно — 3 р.д., Немедленно — 1 р.д.', DF.defaultDue({ ...base, urgency: 'urgent' }) === DF.addWork(d.regDate, 3) && DF.defaultDue({ ...base, urgency: 'immediate' }) === DF.addWork(d.regDate, 1));
  ok('просроченная резолюция видна в сводке входящего суда («просрочено 1»)', has(DF.execText(DF.doc(X.i2)), 'просрочено 1') && DF.execInfo(DF.doc(X.i2)).code === 'overdue');
});

group('E2. «Требует ответа» (§4.3; С-8…С-11)', ({ DF, X }) => {
  const r = DF.RES.find(x => x.doc === X.i3 && !x.parent);
  ok('С-8: у входящего «требует ответа» «Исполнено» недоступно', has(DF.resDone(r.id, 'e4', 'готово').why, 'требует ответа'));
  DF.approve(X.o5, 'e5');           // Жумабеков замещает Осмонова
  ok('замещающий согласует за согласующего, документ на подписи', DF.doc(X.o5).stage === 'signing' && DF.doc(X.o5).rounds[0].steps[1].by === 'e5');
  DF.sign(X.o5, 'e2'); DF.register(X.o5, 'e7');
  ok('С-9: ответ зарегистрирован, но не отправлен — поручение не погашено', DF.resState(r).code !== 'done' && has(DF.execText(DF.doc(X.i3)), 'не отправлен'));
  DF.attach(X.o5, 'e7', 'signed', 's.pdf');
  DF.markSent(X.o5, 'e7', DF.doc(X.o5).addressees[0].id, { method: 'hand', date: DF.TODAY });
  ok('С-10: ответ отправлен отправителю — поручение погашено, дата исполнения = дата отправки',
    DF.resState(r).code === 'done' && DF.resState(r).byReply && DF.execInfo(DF.doc(X.i3)).date === DF.TODAY);
  const i7 = DF.create('e7', 'in', { type: 't-in-letter', subject: 'Второе письмо', sender: { subj: 'b2' }, receivedDate: DF.TODAY, recipients: ['e3'], links: ['borrower:b2'] }).id;
  const i8 = DF.create('e7', 'in', { type: 't-in-letter', subject: 'Третье письмо', sender: { subj: 'b2' }, receivedDate: DF.TODAY, recipients: ['e3'], links: ['borrower:b2'] }).id;
  [i7, i8].forEach(id => { DF.attach(id, 'e7', 'scan', 's.pdf'); DF.register(id, 'e7'); DF.giveRes(id, 'e3', { text: 'Ответить', resp: 'e4', due: '2026-10-29' }); });
  const o = outDraft(DF, 'e4', { type: 't-out-letter', subject: 'Ответ на два письма', addressees: [{ subj: 'b2' }], basis: [i7, i8], signer: 'e2' });
  DF.submit(o, 'e4'); DF.sign(o, 'e2'); DF.register(o, 'e7'); DF.attach(o, 'e7', 'signed', 's.pdf');
  DF.markSent(o, 'e7', DF.doc(o).addressees[0].id, { method: 'email', date: DF.TODAY });
  ok('С-11: один исходящий отвечает на два входящих — оба исполнены', [i7, i8].every(id => DF.execInfo(DF.doc(id)).done));
  ok('ответ другому адресату поручение не гасит', (() => {
    const i9 = DF.create('e7', 'in', { type: 't-in-letter', subject: 'x', sender: { subj: 'b1' }, receivedDate: DF.TODAY, recipients: ['e3'], links: ['borrower:b1'] }).id;
    DF.attach(i9, 'e7', 'scan', 's.pdf'); DF.register(i9, 'e7');
    const o2 = outDraft(DF, 'e4', { type: 't-out-letter', subject: 'не тому', addressees: [{ subj: 'b2' }], basis: [i9], signer: 'e2' });
    DF.submit(o2, 'e4'); DF.sign(o2, 'e2'); DF.register(o2, 'e7'); DF.attach(o2, 'e7', 'signed', 's.pdf'); DF.markSent(o2, 'e7', DF.doc(o2).addressees[0].id, { method: 'email', date: DF.TODAY });
    return !DF.execInfo(DF.doc(i9)).done; })());
  ok('резолюция ниже у «требует ответа» закрывается отметкой исполнителя (каскад продления — по действующему сроку)',
    DF.resState(DF.res(X.r4c)).code === 'done' && DF.effDue(DF.res(X.r4)) === '2026-10-20');
});

group('E3. «На контроле», продление, ознакомление, отказ (§4.4–4.7)', ({ DF, X }) => {
  const r = DF.RES.find(x => x.doc === X.i2);
  ok('ответственный отметил «Исполнено» — резолюция ждёт контролёра, не закрыта', DF.resDone(r.id, 'e6', 'Жалоба подана').ok && DF.resState(r).code === 'control');
  ok('у контролёра шаг «подтвердить на контроле»', keys(DF).has('doc-control|' + r.id));
  ok('подтверждает только контролёр', !DF.ctrlConfirm(r.id, 'e6').ok);
  ok('контролёр вернул с комментарием — ответственный снова получает задание (повтор)',
    DF.ctrlReturn(r.id, 'e3', 'Приложите копию жалобы').ok && r.returns === 1 && DF.TASKS.some(t => t.open && t.key === 'doc-execute|' + r.id + '×e6' && t.repeatOf));
  DF.resDone(r.id, 'e6', 'Жалоба подана, копия приложена');
  ok('после подтверждения контролёра резолюция исполнена', DF.ctrlConfirm(r.id, 'e3').ok && DF.resState(r).code === 'done' && r.outcome.confirmedBy === 'e3');
  const rr = DF.giveRes(X.i5, 'e3', { text: 'Проверить', resp: 'e4', due: '2026-10-16' }).id;
  ok('продление утверждает автор резолюции; иной — отказ', !DF.extendFromTasks(rr, '2026-10-23', 'e4').ok && DF.extendFromTasks(rr, '2026-10-23', 'e3').ok);
  ok('каскад проверяется по действующему сроку с продлением', DF.giveRes(X.i5, 'e4', { parent: rr, text: 'Часть', resp: 'e5', due: '2026-10-22' }).ok);
  ok('«Отказать» с основанием закрывает ветку; показатель «отказано» растёт', (() => { const b = DF.indicators('2026-09-01', DF.TODAY).refused; DF.resRefuse(rr, 'e4', 'Просьба не основана на договоре');
    return DF.resState(DF.res(rr)).code === 'refused' && DF.indicators('2026-09-01', DF.TODAY).refused === b + 1; })());
  ok('лист ознакомления: ознакомлены 3/5, не ознакомившиеся названы', (() => { const a = DF.acqInfo(DF.doc(X.n1)); return a.count === 3 && a.total === 5 && a.missing.join() === 'e5,e6'; })());
  ok('ознакомиться может только получатель «на ознакомление»', !DF.acquaint(X.n1, 'e1').ok && DF.acquaint(X.n1, 'e5').ok && DF.acqInfo(DF.doc(X.n1)).count === 4);
  ok('сводка внутреннего — «ознакомлены 4/5»', has(DF.execText(DF.doc(X.n1)), 'ознакомлены 4/5'));
  ok('входящий «к сведению» закрывается отметкой получателя', DF.execInfo(DF.doc(X.i1)).done && DF.execText(DF.doc(X.i1)) === 'к сведению');
});

/* ========================= F. право подписи ========================= */
group('F. Право подписи и замещение (§8.2; С-17, С-18, С-32; ИД-7)', ({ DF, X }) => {
  ok('С-17: без права на «Исковое заявление» сотрудника нет в списке подписантов', !DF.signers('t-out-isk').includes('e2') && DF.signers('t-out-isk').includes('e6'));
  const id = outDraft(DF, 'e6', { type: 't-out-isk', subject: 'Иск', addressees: [{ subj: 'o1' }], links: ['loan:L2', 'phase:F2'], signer: 'e2' });
  ok('С-17: подписант без права — отказ движка', has(DF.submit(id, 'e6').why, 'права подписи'));
  ok('доверенность истекла 10.10 — в списке подписантов претензий её владельца нет', !DF.signers('t-out-pret').includes('e3') && DF.signers('t-out-pret', '2026-10-09').includes('e3'));
  DF.setClock('2026-10-09');
  const p = outDraft(DF, 'e4', { type: 't-out-pret', subject: 'Претензия', addressees: [{ subj: 'b2' }], links: ['loan:L2', 'phase:F1'], signer: 'e3' });
  DF.submit(p, 'e4'); DF.setClock('2026-10-13');
  const s = DF.sign(p, 'e3');
  ok('на дату подписи права нет — документ возвращён автору выбрать другого подписанта', !s.ok && s.returned && DF.doc(p).stage === 'draft' && keys(DF).has('doc-revise|' + p));
  DF.setClock(DF.TODAY);
  ok('подписывает только назначенный подписант', !DF.sign(X.o9, 'e6').ok);
  ok('С-18: замещающий по приказу с правом подписи подписывает «за кого»', DF.sign(X.o9, 'e2').ok && DF.doc(X.o9).signed.onBehalf === 'e1');
  const m = DF.create('e4', 'int', { type: 't-int-memo', subject: 'Записка', recipients: [{ emp: 'e3', mode: 'exec' }], signer: 'e3' });
  DF.attach(m.id, 'e4', 'project', 'm.docx'); DF.submit(m.id, 'e4');
  ok('замещение без признака «с правом подписи» права подписи не даёт', has(DF.sign(m.id, 'e5').why, 'не даёт права подписи'));
  ok('ИД-7: каждая отметка «Подписано» — от имеющего право на тип на дату (или замещающего с правом)',
    DF.DOCS.filter(d => d.signed).every(d => DF.hasSignRight(d.signed.onBehalf || d.signed.by, d.type, d.signed.at)));
  const ids = [1, 2, 3].map(k => { const i = outDraft(DF, 'e4', { type: 't-out-notice', subject: 'Уведомление ' + k, addressees: [{ subj: 'b1' }], links: ['loan:L1'], signer: 'e2' }); DF.submit(i, 'e4'); return i; });
  const b = DF.signBatch(ids, 'e2');
  ok('С-32: подпись пачкой одним действием — в журнале каждого документа своя запись', b.ok && ids.every(i => DF.doc(i).log.filter(l => l.act === 'Подписано').length === 1));
});

/* ============================ G. видимость ========================== */
group('G. Видимость и серверная проверка прав (§8; С-24, С-25; ИД-20)', ({ DF, X }) => {
  ok('С-24: не участник по прямой ссылке — отказ', !DF.openDoc(X.i3, 'e11').ok);
  ok('ИД-20: любое действие не видящего документ — отказ «нет доступа»', [
    () => DF.update(X.i6, 'e11', { subject: 'x' }), () => DF.attach(X.i3, 'e11', 'appendix', 'a.pdf'), () => DF.comment(X.i3, 'e11', 'x'),
    () => DF.giveRes(X.i3, 'e11', { text: 't', resp: 'e4' }), () => DF.annul(X.o6, 'e11', 'x'), () => DF.approve(X.o5, 'e11')].every(f => has(f().why, 'нет доступа')));
  ok('скрытая кнопка правом не считается: регистратор не согласует чужой маршрут', !DF.approve(X.o5, 'e7').ok);
  ok('С-25: руководитель открывает документ подчинённого', DF.openDoc(X.o9, 'e3').ok && !DF.participants(DF.doc(X.o9)).has('e3'));
  ok('замещающий видит то, что замещаемый, на срок замещения', DF.canSee(DF.doc(X.i5), 'e5') && !DF.canSee(DF.doc(X.i5), 'e5', '2026-10-01'));
  ok('канцелярия и руководство видят всё', DF.DOCS.every(d => DF.canSee(d, 'e7') && DF.canSee(d, 'e1')));
  ok('журнал не участника пуст', DF.journal('in', 'e11').length === 0 && DF.journal('out', 'e11').length === 0);
  ok('видимость объекта привязки документ не открывает: кредитный специалист не видит документы по кредиту', !DF.canSee(DF.doc(X.o2), 'e11'));
});

/* ============================ H. отправка =========================== */
group('H. Отправка и вручение (§5; ИД-14)', ({ DF, X }) => {
  const o = X.o6; DF.attach(o, 'e7', 'signed', 's.pdf'); const a = DF.doc(o).addressees[0].id;
  ok('дата отправки раньше регистрации — отказ', has(DF.markSent(o, 'e7', a, { method: 'hand', date: '2026-10-01' }).why, 'раньше'));
  ok('дата отправки позже сегодняшней — отказ', has(DF.markSent(o, 'e7', a, { method: 'hand', date: '2026-10-20' }).why, 'позже'));
  ok('почта без идентификатора — отказ', has(DF.markSent(o, 'e7', a, { method: 'post', date: DF.TODAY }).why, 'идентификатор'));
  ok('автор отмечает только e-mail', !DF.markSent(o, 'e6', a, { method: 'hand', date: DF.TODAY }).ok && DF.markSent(o, 'e6', a, { method: 'email', date: DF.TODAY }).ok);
  ok('отправка закончена — шаг «отправить» закрыт', !keys(DF).has('doc-dispatch|' + o) && DF.dispatchInfo(DF.doc(o)).done);
  const p = X.o2, a2 = DF.doc(p).addressees;
  ok('сводка «отправлено 2/2: вручено 1, возврат 1»', DF.execText(DF.doc(p)) === 'отправлено 2/2: вручено 1, возврат 1');
  ok('повторная отметка исхода — отказ', !DF.markDelivered(p, 'e7', a2[0].id, { outcome: 'delivered', date: DF.TODAY, proof: 'x.pdf' }).ok);
  const o8 = DF.doc(X.o8);
  ok('СЭД требует квитанцию для отметки вручения', has(DF.markDelivered(X.o8, 'e7', o8.addressees[0].id, { outcome: 'delivered', date: DF.TODAY }).why, 'квитанция'));
  ok('вручение раньше отправки — отказ', !DF.markDelivered(X.o8, 'e7', o8.addressees[0].id, { outcome: 'delivered', date: '2026-10-13', proof: 'k.pdf' }).ok);
  ok('подтверждение вручения получает имя от системы по адресату', DF.markDelivered(X.o8, 'e7', o8.addressees[0].id, { outcome: 'delivered', date: DF.TODAY, proof: 'kvit.pdf' }).ok
    && DF.fileName(o8, o8.files.find(f => f.role === 'proof')) === 'ИСХ-2026-2177_вручение_адресат-1.pdf');
  ok('ИД-14: везде вручение не раньше отправки, отправка не раньше регистрации',
    DF.DOCS.filter(d => !d.legacy).every(d => d.addressees.every(x => (!x.sentDate || x.sentDate >= d.regDate) && (!x.outcomeDate || x.outcomeDate >= x.sentDate))));
  const m = DF.measureView(X.o2);
  ok('мера взыскания читает номер, дату документа, отправку и вручение адресату-должнику', m.no === '19-03-01/2174 / 2026' && m.debtor === 'ОсОО «Ак-Жол Агро»'
    && m.sent.date === '2026-10-07' && m.delivered.date === '2026-10-12' && /_вручение_адресат-1\.jpg$/.test(m.delivered.proof));
  DF.correct(X.o2, 'e7', 'addressee', { addrId: a2[0].id, outcomeDate: '2026-10-13' }, 'Дата по уведомлению');
  ok('исправление даты вручения мера видит сразу (читает, а не копирует)', DF.measureView(X.o2).delivered.date === '2026-10-13');
});

/* ============================== I. архив ============================ */
group('I. Архив (§7; ИД-16)', ({ DF, X }) => {
  ok('документ с открытой резолюцией в дело не сдаётся', !DF.fileToCase(X.i3, 'e9').ok);
  ok('сдаёт архивариус или регистратор; иной — отказ', !DF.fileToCase(X.o2, 'e4').ok);
  ok('дело не из номенклатуры текущего года — отказ', has(DF.fileToCase(X.o2, 'e9', 'c25-03-15').why, 'текущего года'));
  ok('исполненный и отправленный — «В деле», дело по умолчанию из типа', DF.fileToCase(X.o2, 'e9').ok && DF.doc(X.o2).stage === 'filed' && DF.doc(X.o2).caseId === 'c-03-15');
  ok('ИД-16: у каждого документа «В деле» дело из номенклатуры года сдачи',
    DF.DOCS.filter(d => d.stage === 'filed' && !d.legacy).every(d => DF.CASES.find(c => c.id === d.caseId).year === +d.filedAt.slice(0, 4)));
  ok('после сдачи исправление реквизита доступно и из дела не возвращает', DF.correct(X.o2, 'e7', 'subject', 'Претензия (уточн.)', 'опечатка').ok && DF.doc(X.o2).stage === 'filed');
  ok('невозвращённый к сроку оригинал — шаг «вернуть оригинал» у получившего', DF.povods().some(p => p.kind === 'doc-return' && p.addr.emp === 'e4'));
  const iss = DF.ISSUES[0];
  ok('возврат оригинала снимает шаг', DF.returnOriginal(iss.id, 'e9').ok && !DF.povods().some(p => p.kind === 'doc-return'));
  ok('внутренний с неполным ознакомлением в дело не сдаётся', has(DF.fileToCase(X.n1, 'e9').why, 'ознакомлени'));
});

/* ======================== J. шов с «Заданиями» ====================== */
group('J. Шаги документа — задания (§10.1; С-31; ИД-18)', ({ DF, X }) => {
  const P = DF.povods();
  ok('ИД-18: каждый открытый шаг согласования присутствует в ответе на опрос', DF.DOCS.filter(d => d.stage === 'approval').every(d => d.rounds.slice(-1)[0].steps.filter(s => !s.res).every(s => P.some(p => p.key === 'doc-approve|' + d.id + '×' + s.emp))));
  ok('ИД-18: каждая неисполненная резолюция присутствует, закрытые — отсутствуют',
    DF.RES.every(r => ['done', 'refused', 'withdrawn'].includes(DF.resState(r).code) ? !P.some(p => p.key.startsWith('doc-execute|' + r.id + '×')) : P.some(p => p.key.startsWith('doc-execute|' + r.id + '×'))));
  ok('открытые задания совпадают с ответом на опрос один к одному', (() => { const a = DF.TASKS.filter(t => t.open).map(t => t.key).sort().join(); return a === P.map(p => p.key).sort().join(); })());
  ok('у перенесённых, аннулированных и удалённых шагов нет', !P.some(p => { const d = DF.doc(p.doc); return d.legacy || d.stage === 'annulled' || d.deleted; }));
  ok('«подписать» адресовано лично; регистрация, отправка, сдача в дело — очереди роли',
    P.filter(p => p.kind === 'doc-sign').every(p => p.addr.personal) && P.filter(p => ['doc-register', 'doc-dispatch'].includes(p.kind)).every(p => p.addr.role === 'registrar')
    && P.filter(p => p.kind === 'doc-file').every(p => p.addr.role === 'archivist'));
  ok('срок «исполнить резолюцию» — собственный срок резолюции с продлением', P.filter(p => p.kind === 'doc-execute').every(p => p.due === DF.effDue(DF.res(p.obj.split('×')[0]))));
  const t = DF.TASKS.find(x => x.open && x.key === 'doc-register|' + X.o7);
  ok('задание очереди взял регистратор Б (демо)', t && t.taken === 'e8');
  DF.register(X.o7, 'e7');
  ok('С-31: зарегистрировал регистратор А — «исполнено» с пометкой «выполнил другой»', t.outcome === 'исполнено' && has(t.note, 'выполнил другой'));
  ok('взять из очереди может только носитель роли', !DF.takeTask(DF.TASKS.find(x => x.open && x.addr.role === 'archivist').id, 'e4').ok);
  ok('исхода «отпало — ждёт разбора» нет ни у одного шага документа', DF.TASKS.every(x => !x.open ? ['исполнено', 'снято'].includes(x.outcome) : true));
  ok('подпись замещающего закрывает личное задание «исполнено» с пометкой «за кого»', DF.TASKS.some(x => x.kind === 'doc-sign' && x.outcome === 'исполнено' && has(x.note, 'за Токтосунов')));
});

/* ======================= K. журналы и поиск ========================= */
group('K. Журналы, поиск, группировка (§9.1)', ({ DF, X }) => {
  const L = DF.journal('in', 'e7');
  ok('журнал входящих: новые сверху', L.filter(d => d.regDate).every((d, i, a) => i === 0 || a[i - 1].regDate >= d.regDate));
  ok('поиск по старому номеру «1203» находит оба перенесённых', DF.journal('in', 'e7', { q: '1203' }).filter(d => d.legacy).length === 2);
  ok('поиск по номеру корреспондента', DF.journal('in', 'e7', { q: '2-1144/26' }).length === 1);
  ok('поиск по ИНН заёмщика (через привязку)', DF.journal('out', 'e7', { q: '01507201010045' }).some(d => d.id === X.o2));
  ok('поиск по номеру кредита «К-14»', DF.journal('in', 'e7', { q: 'К-14' }).some(d => d.id === X.i2));
  ok('поиск по адресату', DF.journal('out', 'e7', { q: 'Счётная палата' }).some(d => d.id === X.o8));
  ok('кавычка и SQL в поиске — без ошибки', Array.isArray(DF.journal('in', 'e7', { q: "' OR 1=1 --" })));
  ok('фильтр по типу = журнал по шаблону', DF.journal('out', 'e7', { type: 't-out-pret' }).every(d => d.type === 't-out-pret') && DF.journal('out', 'e7', { type: 't-out-pret' }).length >= 2);
  ok('фильтр по исполнению «просрочен»', DF.journal('in', 'e7', { exec: 'overdue' }).map(d => d.id).join() === X.i2);
  ok('группировка по типу: итоги групп сходятся с общим числом', ['type', 'stage', 'party', 'exec', 'dept', 'month'].every(g => DF.grouped(L, g).reduce((s, [, x]) => s + x.length, 0) === L.length));
  ok('«Мои» — где я участник, с моей ролью', DF.journal('mine', 'e4').every(d => DF.roleIn(d, 'e4').length > 0) && DF.journal('mine', 'e4').some(d => DF.roleIn(d, 'e4').includes('ответственный')));
  ok('С-28: бланк «Отчётности» → черновик с файлом «проект», адресатом и привязкой', (() => { const r = DF.fromBlank('ВП-311', 'e4'); const d = r.doc;
    return r.ok && d.files.some(f => f.role === 'project') && d.addressees[0].subj === 'b1' && d.links.some(l => l.k === 'phase') && DF.BLANKS[0].docId === d.id && !DF.fromBlank('ВП-311', 'e4').ok; })());
  ok('бланк служебной записки → черновик внутреннего', DF.fromBlank('ВП-312', 'e3').doc.kind === 'int');
});

/* ========================== L. показатели =========================== */
group('L. Показатели — предпросмотр шва в «Статистику» (§9.2)', ({ DF }) => {
  const r = DF.indicators('2026-09-01', '2026-10-15');
  ok('по видам за период: ВХ 5, ИСХ 4, ВН 2; аннулированные отдельной строкой (1)', r.in === 5 && r.out === 4 && r.int === 2 && r.annulled === 1, r);
  ok('в работе 6, из них с истёкшим сроком 1', r.inWork === 6 && r.overdue === 1, r);
  ok('исполнено 5; в срок 1 (из них с продлением 1); с опозданием 0; процент 100', r.executed === 5 && r.onTime === 1 && r.onTimeExt === 1 && r.late === 0 && r.pct === 100, r);
  ok('исходящий не попадает в «в срок / с опозданием»', r.onTime + r.late < r.executed);
});

/* ============================ M. перенос ============================ */
group('M. Перенесённые — только чтение; журнал и лента — дозапись (ИД-17, ИД-19)', ({ DF, X }) => {
  const L = DF.DOCS.find(d => d.legacy);
  ok('ИД-19: перенесённый не правится, файлы не добавляются, не аннулируется', [() => DF.update(L.id, 'e7', { subject: 'x' }), () => DF.attach(L.id, 'e7', 'appendix', 'a.pdf'),
    () => DF.annul(L.id, 'e7', 'x'), () => DF.correct(L.id, 'e7', 'subject', 'x', 'y'), () => DF.comment(L.id, 'e7', 'x')].every(f => has(f().why, 'только чтение')));
  const d = DF.doc(X.i3), snap = JSON.stringify(d.log);
  DF.comment(X.i3, 'e4', 'Принято, @Осмонов К.Ж.');
  ok('ИД-17: журнал документа только дописывается', JSON.stringify(d.log).startsWith(snap.slice(0, -1)) && d.log.length > JSON.parse(snap).length);
  ok('ИД-17: у ленты нет действий правки и удаления', !Object.keys(DF).some(k => /editComment|deleteComment|removeComment|editLog/.test(k)));
  ok('упоминание отмечено в комментарии', d.comments.slice(-1)[0].mentions.includes('e3'));
});

/* ========================= N. экраны (DOM) ========================== */
group('N. Экраны рендерятся без ошибок, без внутренних номеров и мусора (С-26, С-30)', ({ w, DF, errs, text, panel }) => {
  const FORBID = /(ИД-\d|ADR-\d|ДО-\d|ДО-ВЗ|ДО-ДС|ДО-Д\d|P\d+-R\d|ИЗ-\d|ЗН-\d|label\.)/;
  const DIRT = /undefined|NaN|\[object /;
  const bad = [];
  ['e7', 'e4', 'e3', 'e1', 'e9', 'e10', 'e11'].forEach(u => {
    DF.setUser(u);
    ['in', 'out', 'int', 'mine', 'archive', 'indicators', 'settings'].forEach(v => { DF.go(v); if (FORBID.test(text()) || DIRT.test(text())) bad.push(u + ':' + v + ':' + (text().match(FORBID) || text().match(DIRT))[0]); });
  });
  DF.setUser('e10'); ['types', 'sign', 'methods', 'depts', 'phrases', 'subst', 'tasks'].forEach(t => { DF.go('settings'); DF.setTab(t); if (FORBID.test(text()) || DIRT.test(text())) bad.push('set:' + t); });
  DF.setUser('e9'); ['cases', 'ready', 'issues'].forEach(t => { DF.go('archive'); DF.archTab(t); DF.openCase('c-03-15'); if (DIRT.test(text())) bad.push('arch:' + t); });
  ok('все журналы и разделы под семью пользователями: нет внутренних номеров, label.*, undefined/NaN', bad.length === 0, bad.join(', '));
  const badCard = [];
  DF.setUser('e7'); DF.go('in');
  DF.DOCS.filter(d => !d.deleted).forEach(d => ['req', 'files', 'route', 'res', 'send', 'acq', 'links', 'log', 'com'].forEach(t => {
    DF.openCard(d.id, t); const s = text(); if (FORBID.test(s) || DIRT.test(s)) badCard.push(d.id + ':' + t + ':' + (s.match(FORBID) || s.match(DIRT))[0]);
  }));
  ok('каждая карточка, каждая вкладка: без внутренних номеров и мусора', badCard.length === 0, badCard.slice(0, 5).join(', '));
  ok('ошибок консоли при обходе нет', errs.length === 0, errs);
  DF.setUser('e11'); DF.openCard(DF.SEEDED.i3);
  ok('С-24 на экране: не участник видит отказ, а не карточку', !!panel().querySelector('[data-testid="denied"]') && !panel().querySelector('[data-testid="doc-card"]'));
  DF.setUser('e7'); DF.openCard(DF.SEEDED.i6);
  const regBtn = panel().querySelector('[data-testid="act-register"]');
  ok('кнопка «Зарегистрировать» недоступна, причина названа (нет привязки к заёмщику)', regBtn && regBtn.disabled && has(regBtn.parentElement.textContent, 'заёмщик'));
  DF.setUser('e4'); DF.go('out'); DF.uiDraft('out');
  const r = DF.submitForm({ type: 't-out-letter', subject: '<script>alert(1)</script> «тест»', docDate: '', urgency: 'normal', purpose: 'exec', addrSubj: ['b1'], addrText: '', basis: [], approvers: [], signer: 'e2', links: [] });
  ok('форма создаёт черновик и открывает его карточку', r && r.ok && DF.S.view === 'doc' && DF.doc(r.id).subject.startsWith('<script>'));
  ok('С-26: <script> в теме показан текстом, не исполнен', !panel().querySelector('script') && text().includes('<script>alert(1)</script>'));
  DF.go('out'); DF.search('"'); ok('кавычка в строке поиска — экран без ошибок', errs.length === 0 && !!panel().querySelector('[data-testid="journal"]'));
  DF.search(''); DF.setF('group', 'type'); ok('группировка рисует строки групп с итогами', panel().querySelectorAll('tr.grp').length >= 3);
  DF.uiSaveSet(); ok('набор фильтров сохраняется и применяется', DF.S.saved.length === 1 && (DF.applySet(0), DF.S.f.group === 'type'));
  DF.uiPrint(); ok('печатная форма журнала открывается', has(w.document.getElementById('modal').textContent, 'Журнал регистрации'));
  DF.closeForm();
  DF.setUser('e7'); DF.openCard(DF.SEEDED.o6, 'send');
  const sendBtn = panel().querySelector('[data-testid^="act-sent-"]');
  ok('С-19 на экране: «Отметить отправку» недоступна, названа причина', sendBtn && sendBtn.disabled && has(sendBtn.parentElement.textContent, 'подписанный'));
  DF.uiAnnul(DF.SEEDED.o6); const fr = DF.submitForm({ text: '' });
  ok('форма аннулирования без основания не проходит, ошибка в форме', fr.ok === false && !!w.document.querySelector('[data-testid="form-err"]'));
  DF.closeForm();
});

console.log(`\nОШИБОК КОНСОЛИ (jsdom): ${ALL_ERRS.length}`);
ALL_ERRS.slice(0, 5).forEach(e => console.log('  ' + e));
console.log(`ИТОГ: ${n - fails}/${n} PASS`);
if (fails) { console.log('\nПровалы:'); failed.forEach(f => console.log('  ✗ ' + f)); }
process.exit(fails || ALL_ERRS.length ? 1 : 0);
