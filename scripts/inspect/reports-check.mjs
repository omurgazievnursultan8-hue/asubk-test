// Headless smoke для mockups/reports/reports.html (ИО-1…ИО-16, ADR-0156…0161).
// Zero-dep: вытаскивает <script> из HTML и исполняет логический слой в node:vm (без DOM —
// render() и toast() при отсутствии document становятся no-op, экраны не рисуются).
// Проверяется поведение: объявленность состава, пять отказов публикации, две ступени
// выпуска, снимок и расхождение со сданным, серии и номера, обязательства из правила,
// четыре шва внутрь и три наружу, названные отказы вместо отсутствующих кнопок.
// Блоки, которые правят состояние, начинаются с RP.seed() — состояние между ними не течёт.
//   node scripts/inspect/reports-check.mjs
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
const sandbox = { window: win, console, setTimeout: () => {}, clearTimeout: () => {} };
vm.createContext(sandbox);
vm.runInContext(m[1], sandbox, { filename: 'reports.inline.js' });
const RP = win.RP, SEAM = win.SEAM;
if (!RP) { console.error('window.RP не экспортирован'); process.exit(1); }

const results = [];
const ok = (n, cond, note = '') => results.push({ n, pass: !!cond, note });
const has = (s, part) => String(s || '').includes(part);
const R = { user:'Пользователь (Осмонова Г.)', auth:'Уполномоченный по отчётности (Тентимишев К.)',
            clerk:'Делопроизводитель (Абдырахманова С.)', head:'Руководитель подразделения (Асанов А.)',
            buh:'Главный бухгалтер (Бекова Н.)' };
const as = r => { RP.state.role = R[r]; };

/* ---------- A. Шаблоном состав делает публикация (ИО-1, ADR-0156 §2) ---------- */
(() => {
  RP.seed();
  as('auth');
  const authSees = RP.visibleTemplates();
  as('user');
  const userSees = RP.visibleTemplates();
  const tRef = RP.state.templates.find(t => t.id === 't-ref');   // asked:false, автор — Осмонова
  ok(1, authSees.indexOf('t-ref') === -1 && userSees.indexOf('t-ref') !== -1 && tRef.asked === false,
    `личный черновик «${tRef.name}» не виден даже уполномоченному, пока автор не попросил публикации — ИО-1`);

  as('user');
  const pub = RP.publish('t-osh');
  ok(2, !pub.ok && has(pub.why, 'публикует уполномоченный') && has(pub.why, 'ИО-1'),
    `пользователь опубликовать не может: «${pub.why.slice(0, 70)}…»`);

  as('auth');
  const st0 = RP.tplState('t-osh');
  const pub2 = RP.publish('t-osh');
  const st1 = RP.tplState('t-osh');
  ok(3, st0.state === 'черновик' && pub2.ok && st1.state === 'опубликован',
    `состояние шаблона СЧИТАЕТСЯ, а не хранится: «${st0.state}» → «${st1.state}» после публикации`);

  as('auth');
  const iss = RP.issue('t-avg', { params:{}, kind:'предварительный' });
  ok(4, !iss.ok && has(iss.why, 'только опубликованную редакцию'),
    `выпуск личного черновика отклонён: «${iss.why.slice(0, 60)}…»`);
})();

/* ---------- B. Пять отказов публикации, все на публикации (§4, ИО-7) ---------- */
(() => {
  RP.seed();
  as('auth');
  const ref = RP.publishChecks('t-ref');
  const sub = ref.find(c => c.check === 'подстановка');
  const bas = ref.find(c => c.check === 'основание');
  ok(5, sub && has(sub.why, 'в макете {{остаток_осн}}') && has(sub.why, 'такого поля не объявляет'),
    `подстановка не из перечня названа дословно: «${sub ? sub.why : '—'}»`);
  ok(6, bas && has(bas.why, 'сослаться на пункт нормы может только публикующий'),
    `норму называет публикующий, а не автор черновика: «${bas ? bas.why.slice(0, 70) : '—'}…»`);

  const npl = RP.publishChecks('t-npl');
  ok(7, npl.length === 1 && has(npl[0].why, 'выведен 12.08.2026') && has(npl[0].why, 'новая редакция'),
    `выведенный показатель ловится на публикации: «${npl[0].why}»`);

  const avg = RP.publishChecks('t-avg');
  ok(8, avg.length === 1 && has(avg[0].why, 'налету не берётся') && has(avg[0].why, 'ночным прогоном'),
    `неисчислимый налету показатель в режиме «сейчас» отклонён причиной владельца реестра — ADR-0159`);

  const osh = RP.publishChecks('t-osh');
  ok(9, osh.length === 0 && RP.publish('t-osh').ok,
    `чистый черновик проходит все пять проверок и становится шаблоном организации`);

  as('user');
  const bs = RP.setBasis('t-osh', { doc:'Порядок №41', point:'п. 12' });
  ok(10, !bs.ok && has(bs.why, 'как просьба, а не как основание'),
    `основание, вписанное не публикующим, остаётся просьбой: «${bs.why.slice(0, 70)}…»`);
})();

/* ---------- C. Своей формулы и своего запроса нет (ИО-2, ИО-3) ---------- */
(() => {
  const eng = m[1].slice(m[1].indexOf('==ДВИЖОК=='), m[1].indexOf('==/ДВИЖОК=='));
  const blank = m[1].slice(m[1].indexOf('==ДВИЖОК-БЛАНК=='), m[1].indexOf('==/ДВИЖОК-БЛАНК=='));
  const banned = ['OBJECTS', 'HIST', 'STATS[', 'FIELDS[', 'statValue', 'nearestSnapshot']
    .filter(w => eng.includes(w) || blank.includes(w));
  ok(11, banned.length === 0 && eng.length > 800,
    `в движке состава (${eng.length} симв.) и движке бланка (${blank.length}) нет ни базы, ни формулы: ` +
    `запрещённых имён ${banned.length} — ИО-2, ИО-3`);

  RP.seed();
  const q = RP.ownQuery(), f = RP.ownFormula();
  ok(12, !q.ok && has(q.why, 'обойти область видимости она не может физически') &&
        !f.ok && has(f.why, 'Вторая формула той же величины разошлась бы с первой'),
    `«свой запрос» и «своя формула» — названные отказы, а не отсутствующие кнопки`);
})();

/* ---------- D. Видимость применяется внутри шва (§13.2, §13.4) ---------- */
(() => {
  RP.seed();
  as('user');                                   // область видимости — только dep-prom
  const v = RP.viewer();
  const rows = SEAM.objectRows('credit', { dept:null }, v.scope.slice());
  const slice = SEAM.statSlice('s-portfolio', { dept:null }, null, v.scope.slice());
  as('auth');
  const all = SEAM.statSlice('s-portfolio', { dept:null }, null, RP.viewer().scope.slice());
  ok(13, rows.rows.length === 3 && rows.hidden === 5 && slice.value < all.value,
    `шов вернул ${rows.rows.length} строк и произнёс «скрыто ${rows.hidden}»; итог посчитан по видимым ` +
    `строкам (${slice.value} против ${all.value}) — иначе итог рассказал бы то, чего в строках нет, §13.2`);

  const sub = SEAM.statRows('credit', '2026-09-01', { dept:null }, RP.viewer().scope.slice());
  const none = SEAM.statRows('credit', '2026-01-01', { dept:null }, RP.viewer().scope.slice());
  ok(14, sub.substituted === '2026-08-01' && none.missing === true,
    `снимка на 01.09.2026 нет — подставлен ближайший на ${sub.substituted}; на 01.01.2026 снимка нет вовсе`);
})();

/* ---------- E. Две ступени выпуска: числа морозит получатель (ИО-4, ИО-8) ---------- */
(() => {
  RP.seed();
  as('auth');
  const prelim = RP.issue('t-overdue', { params:{ asOf:'2026-08-01', dept:'' }, kind:'предварительный' });
  const pr = RP.ISS(prelim.id);
  ok(15, prelim.ok && pr.snapshot === null && pr.recipient === null && pr.number === null &&
        pr.fileUntil === RP.state.today.slice(0,4) + '-11-22',
    `предварительный выпуск: снимка нет, получателя нет, номера нет, файл живёт ${RP.FILE_DAYS} дней ` +
    `и гаснет ${pr.fileUntil} — §5, ADR-0161 §7`);

  const noRec = RP.issue('t-overdue', { params:{ asOf:'2026-08-01', dept:'' }, kind:'окончательный' });
  ok(16, !noRec.ok && has(noRec.why, 'числа морозит получатель, а не кнопка'),
    `окончательный без получателя отклонён: «${noRec.why.slice(0, 70)}…» — ИО-4`);

  const strRec = RP.issue('t-overdue', { params:{ asOf:'2026-08-01', dept:'' },
    kind:'окончательный', recipient:'Минфин КР' });
  ok(17, !strRec.ok && has(strRec.why, 'станут в журнале двумя разными адресатами'),
    `получатель строкой отклонён ссылкой на справочник — ИО-5, ADR-0157 §3`);

  const docx = RP.issue('t-overdue', { params:{ asOf:'2026-08-01', dept:'' },
    kind:'окончательный', recipient:'a-mf', format:'docx' });
  ok(18, !docx.ok && has(docx.why, 'снимок в редактируемом формате — не снимок'),
    `docx получателю отклонён: наружу с получателем — только pdf, ИО-10, ADR-0161 §2`);

  const fin = RP.issue('t-overdue', { params:{ asOf:'2026-08-01', dept:'' },
    kind:'окончательный', recipient:'a-mf' });
  const f = RP.ISS(fin.id);
  ok(19, fin.ok && f.kind === 'окончательный' && f.snapshot && f.snapshot.totals.length === 2 &&
        f.passport.frozen === true && f.fileUntil === null && f.formats.join() === 'pdf',
    `окончательный выпуск: снимок с ${f.snapshot.totals.length} итогами заморожен, файл бессрочен, форматы — ${f.formats.join()}`);

  as('user');                                    // видит только dep-prom, шаблон требует полного охвата
  const cut = RP.issue('t-overdue', { params:{ asOf:'2026-08-01', dept:'' },
    kind:'окончательный', recipient:'a-mf' });
  const c = RP.ISS(cut.id);
  ok(20, cut.ok && c.kind === 'предварительный' && c.recipient === null &&
        has(c.note, 'полного охвата') && has(c.note, '§13.4'),
    `усечённый видимостью охват не запрещает выпуск — он делает его предварительным и запрещает ` +
    `называть получателя: «${c.note.slice(0, 80)}…» — ИО-8, §13.4`);

  const gone = RP.issue('t-npl', { params:{ asOf:'2026-01-01' }, kind:'предварительный' });
  ok(21, !gone.ok, `выпуск по неопубликованному/неисполнимому шаблону отклонён: «${gone.why.slice(0, 60)}…»`);
})();

/* ---------- F. Бланк: два замка, подстановки, серии и номера (§8, ИО-9) ---------- */
(() => {
  RP.seed();
  as('clerk');
  const before = RP.TPL('t-notice').series.next;
  const pre = RP.issue('t-notice', { params:{ obj:'kr-2' }, kind:'предварительный' });
  ok(22, pre.ok && RP.ISS(pre.id).number === null && RP.TPL('t-notice').series.next === before,
    `перепечатка предварительного бланка номера не сжигает: следующий по-прежнему ${before} — ИО-9, ADR-0161 §5`);

  const fin = RP.issue('t-notice', { params:{ obj:'kr-2' }, kind:'окончательный' });
  const f = RP.ISS(fin.id);
  ok(23, fin.ok && f.number === 'УВ-2026/037' && RP.TPL('t-notice').series.next === before + 1 &&
        f.snapshot && f.recipient && f.recipient.name === 'ОсОО «Нарын-Агро»' && f.recipient.viaObject,
    `номер ${f.number} потрачен ВМЕСТЕ со снимком; получатель бланка — контрагент объекта, ссылкой (ИО-5)`);

  const addr = RP.issue('t-notice', { params:{ obj:'kr-2' }, kind:'окончательный', recipient:'a-mf' });
  ok(24, !addr.ok && has(addr.why, 'контрагент объекта'),
    `бланку адресат из справочника не выбирается: «${addr.why.slice(0, 70)}…»`);

  const noNum = RP.issue('t-claim', { params:{ obj:'kr-6' }, kind:'окончательный' });
  const dup   = RP.issue('t-claim', { params:{ obj:'kr-6' }, kind:'окончательный', number:'ПР-2026/014' });
  const good  = RP.issue('t-claim', { params:{ obj:'kr-6' }, kind:'окончательный', number:'ПР-2026/015' });
  ok(25, !noNum.ok && has(noNum.why, 'журнал исходящих ведёт канцелярия') &&
        !dup.ok && has(dup.why, 'система номера не выдаёт, но дубль ловит') && good.ok,
    `ручная серия: номер вводит канцелярия, система его не выдаёт, но дубль ловит — ADR-0161 §6`);

  as('user');                                   // dep-prom; kr-4 — dep-admin
  const lock = RP.issue('t-notice', { params:{ obj:'kr-4' }, kind:'предварительный' });
  ok(26, !lock.ok && has(lock.why, 'два замка'),
    `бланк печатает тот, у кого шаблон в круге И объект видим: «${lock.why.slice(0, 80)}…» — §13.3`);

  RP.seed();
  as('auth');
  RP.state.templates.find(t => t.id === 't-ref').asked = true;
  const badSub = RP.publishChecks('t-ref').find(c => c.check === 'подстановка');
  ok(27, !!badSub, `у бланка своих полей нет: подстановка вне публичного перечня ловится тем же законом, что и колонка отчёта`);
})();

/* ---------- G. Журнал вечен, файл предварительного — расходник (ИО-11) ---------- */
(() => {
  RP.seed();
  const old = RP.state.issues.find(i => i.kind === 'предварительный');
  ok(28, old && old.fileAlive === false && old.fileDeadAt === '2026-07-09' && RP.state.issues.length === 4,
    `файл предварительного выпуска от 10.04.2026 погашен ${old.fileDeadAt}, строка журнала осталась — ADR-0161 §7`);

  const del = RP.deleteIssue(old.id);
  ok(29, !del.ok && has(del.why, 'стёртая строка отвечает на него неправдой') &&
        RP.state.issues.length === 4,
    `удаления выпуска нет: «${del.why.slice(0, 80)}…» — ИО-11`);
})();

/* ---------- H. Расхождение со сданным и обратный ход (§6, ADR-0157 §5) ---------- */
(() => {
  RP.seed();
  as('buh');
  const before = RP.whatWentOut('июль 2026');
  const re = RP.reopenPeriod('июль 2026', 'сторно платежа');
  const after = RP.whatWentOut('июль 2026');
  const marked = RP.state.issues.filter(i => i.diverged);
  const rc = RP.recompute(marked[0] ? marked[0].id : '—');
  ok(30, re.ok && re.marked === 1 && before.length === 1 && after[0].diverged === true &&
        rc && rc.changed && rc.diffs.length > 0,
    `открытие периода правит снимок статистики — и расхождение ЗАРАБОТАНО пересчётом: ` +
    `${rc.diffs.map(d => d.name + ' ' + d.was + '→' + d.now).join('; ')}`);

  const prelimMarked = RP.state.issues.filter(i => i.diverged && !i.snapshot);
  ok(31, prelimMarked.length === 0,
    `предварительные выпуски метки не получают — метить нечего: они и не морозили чисел`);

  const iss = marked[0].id;
  const corr = RP.corrective(iss);
  const prev = RP.ISS(iss), next = RP.ISS(corr.id);
  ok(32, corr.ok && next.correctionOf === iss && prev.correctedBy === corr.id &&
        prev.diverged === true && next.diverged === false && next.recipient.ref === prev.recipient.ref,
    `корректирующий выпуск ${corr.id} уточняет ${iss}, прежний не погашен: связь видна с обеих сторон — §6`);

  const again = RP.corrective(iss);
  ok(33, !again.ok && has(again.why, 'уже уточнён'), `повторное уточнение того же выпуска отклонено`);

  RP.seed();
  as('user');
  const noRight = RP.reopenPeriod('июль 2026', 'проба');
  ok(34, !noRight.ok && has(noRight.why, 'главный бухгалтер'),
    `закрытый период открывает главный бухгалтер — ADR-0089`);
})();

/* ---------- I. Обязательства порождаются правилом (§7, ИО-12, ИО-13) ---------- */
(() => {
  RP.seed();
  as('auth');
  const obl = RP.obligations();
  const may = obl.filter(o => o.period === 'май 2026');
  const jul = obl.filter(o => o.period === 'июль 2026');
  const late = jul.filter(o => o.state === 'просрочено');
  ok(35, obl.length === 9 && may.every(o => o.state === 'сдано') &&
        jul.find(o => o.dept === 'dep-admin').state === 'сдано с опозданием' &&
        late.length === 2 && late[0].late === 9,
    `девять обязательств выведены из правила «${RP.TPL('t-overdue').schedule.text}»: май сдан, ` +
    `по июлю один сдан с опозданием и ${late.length} просрочены на ${late[0].late} дней`);

  const closed = jul.find(o => o.dept === 'dep-admin');
  ok(36, closed.issue && RP.ISS(closed.issue).recipient !== null,
    `обязательство закрыл выпуск ${closed.issue} с названным получателем, а не отметка`);

  const mark = RP.markDelivered(late[0].id), task = RP.autoTask(late[0].id);
  const basis = RP.taskBasis(late[0].id);
  ok(37, !mark.ok && has(mark.why, 'сданное без выпуска — это несданное с отметкой') &&
        !task.ok && has(task.why, 'Модуль показывает, но не поручает') &&
        basis && has(basis.note, 'саму задачу заводит человек'),
    `«отметить сданным» и «поставить задачу» — названные отказы; наружу отдаётся ОСНОВАНИЕ задачи — ИО-12, ИО-13`);

  const prelimClose = RP.issue('t-overdue', { params:{ asOf:'2026-08-01', dept:'dep-prom' },
    kind:'предварительный' });
  const stillLate = RP.obligations().find(o => o.id === late[0].id);
  ok(38, prelimClose.ok && stillLate.state === 'просрочено',
    `предварительный выпуск обязательства не закрывает — оно осталось просроченным`);

  const fin = RP.issue('t-overdue', { params:{ asOf:'2026-08-01', dept:'dep-prom' },
    kind:'окончательный', recipient:'a-kab' });
  const now = RP.obligations().find(o => o.id === late[0].id);
  ok(39, fin.ok && now.state === 'сдано с опозданием' && now.issue === fin.id,
    `окончательный выпуск с получателем закрыл обязательство ${now.id.split('/').pop()} — ИО-12`);
})();

/* ---------- J. Круг и расписание правятся без новой редакции (§2.1) ---------- */
(() => {
  RP.seed();
  as('auth');
  const t = RP.TPL('t-portfolio');
  const eds = t.editions.length;
  const c = RP.setCircle('t-portfolio', ['dep-prom']);
  const s = RP.setSchedule('t-portfolio', { freq:'ежемесячно', dueDay:15, since:'2026-05-01',
    asOfRule:'первое число месяца, следующего за отчётным', text:'ежемесячно, к 15-му' });
  ok(40, c.ok && s.ok && t.editions.length === eds && has(c.note, 'круг — не часть вопроса'),
    `круг и расписание изменены, редакций по-прежнему ${t.editions.length}: они не меняют вопроса`);

  as('user');
  const c2 = RP.setCircle('t-portfolio', ['rep-osh']);
  ok(41, !c2.ok && has(c2.why, 'уполномоченный'), `круг ведёт уполномоченный, а не автор черновика`);
})();

/* ---------- K. Перечень полей и реестр показателей — швы, а не справочники (§16) ---------- */
(() => {
  RP.seed();
  as('auth');
  const r = RP.renameField('credit', 'days', 'days_overdue', 'Дней просрочки');
  const st = RP.tplState('t-overdue');
  const iss = RP.issue('t-overdue', { params:{ asOf:'2026-08-01', dept:'' }, kind:'предварительный' });
  ok(42, r.ok && r.broken.length === 3 && has(st.why, 'перечень изменил его владелец (ядро · кредиты)') &&
        st.state === 'неисполним' && !iss.ok && has(iss.why, 'шаблон неисполним'),
    `переименование поля в ядре сломало ${r.broken.length} шаблона (${r.broken.map(b => b.id).join(', ')} — ` +
    `и отчёт, и бланк: закон один) и НАЗВАЛО виновника — ADR-0158 §4`);

  RP.seed();
  as('auth');
  const w = RP.withdrawStat('s-overdue-sum');
  ok(43, w.ok && w.breaking.length === 2 && w.breaking.some(b => b.id === 't-overdue'),
    `владельцу реестра показан список ломающихся шаблонов до вывода показателя: ${w.breaking.map(b => b.id).join(', ')} — ADR-0159`);
})();

/* ---------- L. Три шва наружу и то, чего наружу нет (§12) ---------- */
(() => {
  RP.seed();
  as('clerk');
  RP.issue('t-notice', { params:{ obj:'kr-2' }, kind:'окончательный' });
  const card = RP.callSeamOut('карточка объекта (ядро)', 'reportIssues', 'kr-2');
  const rows = RP.callSeamOut('анализ', 'reportRows', 't-overdue');
  const draft = RP.callSeamOut('анализ', 'reportDraft', 't-avg');
  const wrong = RP.callSeamOut('задачи', 'reportTemplate', 't-overdue');
  const tpl = RP.reportTemplate('t-overdue');
  ok(44, card.ok && card.data.length === 1 && card.data[0].number === 'УВ-2026/037',
    `карточка объекта видит зеркалом, что по кредиту уходило наружу: ${card.data[0].number}`);
  ok(45, !rows.ok && has(rows.why, 'число без паспорта не показывается') &&
        !draft.ok && has(draft.why, 'читается как шаблон') &&
        !wrong.ok && has(wrong.why, 'шов «reportTemplate» не спрашивает'),
    `наружу нет ни строк ответа, ни черновиков; лишний шов лишнему потребителю не отдаётся`);
  ok(46, has(tpl.note, 'своего снимка не заводит') && RP.consumers().find(c => c.module === 'статистика').may.length === 0,
    `анализ ссылается на выпуск как на снимок основания — ИО-16, ADR-0157 §4`);
})();

/* ---------- M. Верстальщик бланка: подстановки есть текст макета (§8) ---------- */
(() => {
  RP.seed();
  as('clerk');
  const notice = RP.layoutOf('t-notice'), claim = RP.layoutOf('t-claim');
  const stored = win.RP.state.templates.find(t => t.id === 't-notice').editions[0];
  ok(47, notice.subs.join(',') === 'borrower,no,debt_main' && claim.subs.length === 4 &&
        stored.subs.join(',') === notice.subs.join(','),
    `список подстановок нигде не ведётся руками: он выведен разбором {{…}} в тексте макета — ` +
    `«${notice.subs.join(', ')}» у уведомления, ${claim.subs.length} у претензии (§8)`);

  const edit = RP.setLayout('t-notice', 'другой текст');
  ok(48, !edit.ok && has(edit.why, 'новая редакция'),
    `текст опубликованного макета не правится на месте: другой текст насовсем — это новая редакция`);

  as('auth');
  const ne = RP.newEdition('t-notice');
  const again = RP.newEdition('t-notice');
  const set = RP.setLayout('t-notice', 'УВЕДОМЛЕНИЕ\n\nКому: {{borrower}}\nДоговор {{no}}.');
  const after = RP.layoutOf('t-notice');
  ok(49, ne.ok && ne.n === 2 && !again.ok && has(again.why, 'черновая редакция') &&
        set.ok && after.subs.length === 2 && RP.pubEd('t-notice').n === 1,
    `новая редакция копируется с опубликованной и правится, прежняя продолжает печататься; ` +
    `подстановок стало ${after.subs.length} — список пересчитан по тексту, а не поправлен отдельно`);

  const stat = RP.insertToken('t-notice', 'stat', 's-overdue-sum');
  ok(50, !stat.ok && has(stat.why, 'МНОЖЕСТВЕ') && has(stat.why, 'бланк'),
    `показатель в бланк не вставляется: величина о множестве объектов в разговоре об одном ничего ` +
    `не значит — такой вопрос задаётся отчётом (§2.2)`);

  const fld = RP.insertToken('t-notice', 'field', 'days');
  ok(51, fld.ok && RP.layoutOf('t-notice').subs.indexOf('days') !== -1 &&
        has(RP.layoutOf('t-notice').text, '{{days}}'),
    `поле вставляется из публичного перечня ядра и сразу видно разбору: своих полей у бланка нет (ИО-2)`);

  const rep = RP.setLayout('t-overdue', 'текст');
  const dx = RP.docxNote();
  const bad = RP.layoutOf('t-ref');
  ok(52, !rep.ok && has(rep.why, 'колонки') && !dx.ok && has(dx.why, 'только pdf') &&
        bad.subs.indexOf('остаток_осн') !== -1,
    `у отчёта макета нет (состав — колонки и показатели); docx остаётся форматом черновика; ` +
    `подстановка «остаток_осн» в справке видна разбором как отсутствующая в перечне`);
})();

/* ---------- N. Рабочий список: замороженный состав без чисел (§9, ИО-14) ---------- */
(() => {
  RP.seed();
  as('auth');
  const iss = RP.state.issues.find(i => i.kind === 'окончательный' && i.kindTpl === 'отчёт');
  const noname = RP.makeWorklist(iss.id, '');
  const fromBlank = RP.makeWorklist(
    RP.state.issues.find(i => i.kindTpl === 'бланк') ? RP.state.issues.find(i => i.kindTpl === 'бланк').id : 'нет', 'x');
  const mk = RP.makeWorklist(iss.id, 'Обзвон по просрочке, июнь');
  const w = RP.WL(mk.id);
  const keys = Object.keys(w);
  ok(53, mk.ok && w.objects.length === iss.snapshot.rows.length &&
        keys.indexOf('rows') === -1 && keys.indexOf('totals') === -1 &&
        w.objects.every(id => typeof id === 'string'),
    `список отобран выпуском ${iss.id} и заморожен: ${w.objects.length} ссылок на объекты и ни одного числа (§9)`);
  ok(54, !noname.ok && has(noname.why, 'называется') && !fromBlank.ok,
    `безымянный список не заводится (его нельзя ни передать, ни спросить «чем кончилось»); ` +
    `из бланка об одном объекте отбирать нечего`);

  const before = RP.worklistRows(w.id);
  const live = before.rows.find(r => r && r.id === 'kr-2');
  const close = RP.demoCloseObject('kr-2');
  const after = RP.worklistRows(w.id);
  const gone = after.rows.find(r => r && r.id === 'kr-2');
  ok(55, live.debt_main === 5100000 && close.ok &&
        after.rows.length === before.rows.length && gone && gone.closed &&
        gone.debt_main === 0 && after.gone === before.gone + 1,
    `величины всегда текущие (шов спрашивается заново), а выбывший показан выбывшим: строка ` +
    `осталась на месте с отметкой «закрыт», а не исчезла — иначе список солгал бы о том, кого обзванивали`);

  const add = RP.addToWorklist(w.id, 'kr-1');
  const del = RP.deleteWorklist(w.id);
  const task = RP.worklistTask(w.id);
  ok(56, !add.ok && has(add.why, 'заморожен') && !del.ok && has(del.why, 'ЗАКРЫТИЕМ') &&
        !task.ok && has(task.why, 'нагрузку'),
    `состав не пополняется, список не стирается и никому ничего не поручает — ИО-14, ИО-13`);

  const by = RP.issueByWorklist('t-portfolio', w.id, {kind:'предварительный'});
  const rec = RP.state.issues.find(i => i.id === by.id);
  ok(57, by.ok && rec.params.worklist === w.id &&
        rec.params.ids.length === w.objects.length && RP.seamsIn().length === 4,
    `список — законный параметр отбора следующего выпуска: перечень объектов ушёл в разрез и ` +
    `спрошен тем же швом, пятого шва не понадобилось`);

  RP.handWorklist(w.id, 'dep-admin');
  as('head');
  const seenHead = RP.visibleWorklists().length;
  as('user');
  const seenUser = RP.visibleWorklists().length;
  as('auth');
  const cl = RP.closeWorklist(w.id, 'обзвон окончен');
  const hand2 = RP.handWorklist(w.id, 'dep-prom');
  const readable = RP.worklistRows(w.id);
  ok(58, seenHead === 1 && seenUser === 0 && cl.ok &&
        !hand2.ok && has(hand2.why, 'окончена') && readable.rows.length === w.objects.length,
    `переданный список видит круг подразделения, а не весь модуль; закрытый читается, но не ` +
    `передаётся и не пополняется — работа окончена (§9)`);
})();

/* ---------- O. Дашборд: плитка показывает объявленный отчёт (§10, ИО-15) ---------- */
(() => {
  RP.seed();
  as('auth');
  const declared = RP.declaredTiles();
  as('clerk');
  const clerkTiles = RP.dashTiles();
  as('auth');
  ok(59, declared.length === 2 && clerkTiles.length === 0 && !RP.dashPersonal(),
    `раскладка объявлена на роль, а не собирается с нуля: первый день не начинается с пустого экрана`);

  const draft = RP.addTile('t-avg', {});
  const blank = RP.addTile('t-notice', {});
  const ext = RP.addExternalTile('https://bi.example/kpi');
  ok(60, !draft.ok && has(draft.why, 'ОБЪЯВЛЕННЫЙ') && !blank.ok && has(blank.why, 'множестве') &&
        !ext.ok && has(ext.why, 'своего состава'),
    `плиткой не становятся ни личный черновик, ни бланк, ни внешний источник: плитка — способ ` +
    `показать объявленный отчёт, и клик раскрывает его целиком (ИО-1, §10)`);

  const tiles = RP.dashTiles().map(t => RP.tileData(t));
  const modes = tiles.map(t => t.passport.mode);
  const dp = RP.dashPassport();
  ok(61, tiles.every(t => t.passport && t.passport.seams.length) &&
        modes.indexOf('на дату') !== -1 && modes.indexOf('сейчас') !== -1 &&
        !dp.ok && has(dp.why, 'единой даты'),
    `паспорт у каждой плитки, а не один сверху: рядом стоят «${modes.join('» и «')}», и общий ` +
    `паспорт создавал бы вид единой даты, которого нет (ИО-15)`);

  const addOk = RP.addTile('t-portfolio', {dept:'dep-prom'});
  const personal = RP.dashTiles().length;
  const stillDeclared = RP.declaredTiles().length;
  const rst = RP.resetDash();
  ok(62, addOk.ok && personal === 3 && stillDeclared === 2 && RP.dashPersonal() === false &&
        rst.ok && RP.dashTiles().length === 2,
    `личная перекладка живёт поверх объявленной и не трогает её: «вернуть как объявлено» ` +
    `возвращает ${stillDeclared} плитки — иначе возвращать было бы не к чему`);

  RP.withdrawStat('s-overdue-sum');
  const broken = RP.dashTiles().map(t => RP.tileData(t)).filter(t => t.broken);
  ok(63, broken.length === 1 && has(broken[0].broken, 'выведен'),
    `неисполнимый отчёт плитка проговаривает словами, а не показывает пустое место: ${broken[0].broken}`);
})();

/* ---------- P. Вход в модуль — четыре шва и ни одного своего запроса ---------- */
(() => {
  RP.seed();
  const seams = RP.seamsIn();
  ok(64, seams.length === 4 && seams.filter(s => s.owner === 'статистика').length === 3 &&
        seams.find(s => s.id === 'objectRows').owner === 'ядро',
    `вход в модуль — ровно четыре шва: три у статистики (ADR-0152) и objectRows у ядра (ADR-0158)`);
})();

/* ---------- Q. Все экраны рисуются каждой ролью и говорят словами ---------- */
(() => {
  RP.seed();
  const VIEWS = win.VIEWS;
  const names = Object.keys(VIEWS);
  const bad = [];
  let total = 0;
  Object.keys(R).forEach(role => { as(role); names.forEach(v => {
    try { const html = VIEWS[v].fn(); total += html.length;
      if (typeof html !== 'string' || html.length < 200) bad.push(role + '/' + v); }
    catch (e) { bad.push(role + '/' + v + ': ' + e.message); } }); });
  ok(65, bad.length === 0 && names.length === 10,
    `десять экранов × пять ролей = ${names.length * 5} отрисовок без исключений (${Math.round(total / 1000)} КБ разметки)`);

  as('auth');
  const reg = VIEWS.registry.fn(), cal = VIEWS.calendar.fn(), jr = VIEWS.journal.fn();
  const bl = VIEWS.blank.fn(), wl = VIEWS.worklists.fn(), bo = VIEWS.bounds.fn();
  ok(66, has(reg, 'Чего вы здесь не видите') && has(cal, 'Две кнопки, которых в модуле нет') &&
        has(jr, 'что мы отдали наружу') && has(bl, 'список выведен разбором') &&
        has(wl, 'Поручений он не несёт') && has(bo, 'Чего в макете нет и почему'),
    `отказы и границы проговорены на самих экранах, а не спрятаны за отсутствием кнопки`);
})();

/* ---------- R. Волна 4: итоги уровней, лист выгрузки, выпуск заданием ---------- */
(() => {
  RP.seed(); as('auth');
  const fold = RP.foldLevelsSelf('t-npl');
  ok(67, !fold.ok && fold.parts === 3 && Math.abs(fold.sum - 83.3) < 0.05 && fold.real === 25 &&
        has(fold.why, 'ИО-17'),
    `итог уровня приходит швом, а не сложением: доли по ${fold.parts} подразделениям в сумме дают ` +
    `${fold.sum} %, а на всём охвате показатель равен ${fold.real} % — модуль складывать не вправе (ИО-17)`);

  const pv = RP.preview('t-overdue', { asOf: RP.state.sel.params.asOf, dept: null }).data;
  const lvl = pv.levels.map(l => l.name + (l.total ? '+итог' : ''));
  const inner = pv.groups.reduce((a, g) => a + g.children.length, 0);
  const cnt = pv.groups.reduce((a, g) => a + g.count, 0);
  ok(68, pv.levels.length === 2 && lvl[0] === 'подразделение+итог' && lvl[1] === 'состояние кредита' &&
        cnt === pv.rows.length && inner >= 4 &&
        pv.groups.every(g => g.children.every(c => c.rows && c.rows.length)),
    `разрезы печатаются уровнями: ${lvl.join(' → ')}; ${pv.groups.length} группы первого уровня, ` +
    `${inner} второго, строк в группах ${cnt} из ${pv.rows.length}`);

  ok(69, pv.groups.every(g => g.totals && g.totals.length === 2) &&
        pv.groups.every(g => g.children.every(c => c.totals === null)) &&
        pv.groups.every(g => g.totals.every(t => t.seam === 'statSlice (пакетно)')),
    `итоговая строка печатается только по объявленному уровню: у подразделения она есть и спрошена ` +
    `пакетным statSlice, у состояния кредита — нет, потому что редакция её не объявляла`);

  const sh = RP.sheetOf('t-overdue');
  ok(70, sh.orient === 'книжная' && sh.bands.join(' ') === 'заголовок шапка уровни итог подвал' &&
        sh.formats.join('·') === 'xlsx·pdf' &&
        pv.passport.sheet.bands.join(' ') === sh.bands.join(' ') &&
        pv.passport.levels[0] === 'подразделение (с итогом)' && pv.passport.rounding.length === 2,
    `лист выгрузки объявлен редакцией и попадает в паспорт: ${sh.orient}, полосы ` +
    `${sh.bands.join(' → ')}, форматы ${sh.formats.join(' · ')} (ИО-18)`);

  const badOrder = RP.setBands('t-avg', ['заголовок','шапка','итог','уровни','подвал']);
  const lost = RP.setBands('t-avg', ['заголовок','шапка','уровни','подвал']);
  ok(71, !badOrder.ok && has(badOrder.why, 'ОЧ-26') && !lost.ok && has(lost.why, 'итог'),
    `итог перед уровнями отклонён: ${badOrder.why.slice(0, 96)}…`);

  const onPub = RP.setSheet('t-overdue', { orient:'альбомная' });
  as('user');
  const byUser = RP.setSheet('t-avg', { orient:'альбомная' });
  as('auth');
  const onDraft = RP.setSheet('t-avg', { orient:'альбомная' });
  ok(72, !onPub.ok && has(onPub.why, 'НОВАЯ РЕДАКЦИЯ') && !byUser.ok && has(byUser.why, 'ИО-18') &&
        onDraft.ok && RP.sheetOf('t-avg').orient === 'альбомная',
    `лист правится там же, где состав: в черновике и уполномоченным; у опубликованной редакции — ` +
    `только новой редакцией, иначе сданное перепечаталось бы иначе (ИО-18, ИО-2)`);
})();

(() => {
  RP.seed(); as('auth');
  const prelim = RP.issue('t-overdue', { params:{ asOf: RP.state.sel.params.asOf, dept:null },
    kind:'предварительный' });
  const xlsx = RP.exportIssue(prelim.id, 'xlsx');
  const csv  = RP.exportIssue(prelim.id, 'csv');
  const fixSheet = RP.setSheetOnIssue(prelim.id, { orient:'альбомная' });
  ok(73, !fixSheet.ok && has(fixSheet.why, 'ИО-18') && has(fixSheet.why, 'редакцией'),
    `лист у выпуска не правится: печатное представление предъявлено вместе с числами — ` +
    `иначе один и тот же сданный отчёт у двух людей печатается по-разному (ИО-18)`);
  ok(74, xlsx.ok && !csv.ok && has(csv.why, 'не объявляет'),
    `перечень форматов — часть листа редакции, а не набор кнопок: xlsx отдан, csv отклонён ` +
    `(объявлено ${prelim.rec.formats.join(' · ')})`);

  const fin = RP.issue('t-overdue', { params:{ asOf: RP.state.sel.params.asOf, dept:null },
    kind:'окончательный', recipient: RP.addressees()[0].id });
  const finXlsx = RP.exportIssue(fin.id, 'xlsx');
  const snap = fin.rec.snapshot.totals;
  const now = RP.preview('t-overdue', { asOf: RP.state.sel.params.asOf, dept:null }).data.totals;
  const rc = RP.recompute(fin.id);
  const grp = RP.preview('t-npl', { asOf: RP.state.sel.params.asOf }).data.groups.map(g => g.totals[0]);
  const rounded = grp.filter(t => t.value !== t.shown);
  ok(75, snap.every((s, i) => s.value === now[i].shown && s.dp === 0) && !rc.changed &&
        rounded.length >= 1 && rounded.every(t => t.dp === 0 && t.shown === Math.round(t.value)),
    `в снимок ложится ПОКАЗАННАЯ величина, в объявленной разрядности: доля ` +
    `${String(rounded[0].value).replace('.', ',')} % печатается как ${rounded[0].shown} %, и ` +
    `расхождение сравнивает показанное с показанным, а не ловит шум ниже разрядности (ОЧ-32)`);
  ok(76, fin.kind === 'окончательный' && !finXlsx.ok && has(finXlsx.why, 'ИО-10'),
    `окончательный выпуск отдаётся только pdf, чем бы ни был объявлен лист: снимок в редактируемом ` +
    `формате — не снимок (ИО-10)`);
})();

(() => {
  RP.seed(); as('auth');
  const o = RP.order('t-overdue', { params:{ asOf: RP.state.sel.params.asOf, dept:null },
    kind:'предварительный' });
  /* Снимок состояния строки СРАЗУ после заказа: ISS отдаёт живую запись, и
     шаги задания её меняют — сравнивать надо с тем, что было при заказе.     */
  const at0 = JSON.parse(JSON.stringify(RP.ISS(o.id)));
  const s1 = RP.step(o.id);
  const s2 = RP.step(o.id);
  ok(77, o.ok && o.state === 'заказан' && at0.state === 'заказан' && at0.snapshot === null &&
        at0.passport.ordered === true && at0.passport.seams.length === 0 &&
        at0.passport.edition === 1 && s1.state === 'считается' && s2.state === 'готов' &&
        s2.done && RP.jobStates().join('→') === 'заказан→считается→готов→ошибка',
    `выпуск — заказ, а не нажатие: строка журнала и паспорт заведены в момент заказа (редакция, ` +
    `дата, охват известны), числа — в шаге «считается»; состояния ${RP.jobStates().join(' → ')}`);

  const bad = RP.order('t-overdue', { params:{ asOf:'2026-01-01', dept:null }, kind:'предварительный' });
  RP.step(bad.id);
  const err = RP.step(bad.id);
  const errRow = RP.ISS(bad.id);
  ok(78, bad.ok && !err.ok && err.state === 'ошибка' && has(err.why, 'ИО-6') &&
        errRow.state === 'ошибка' && errRow.snapshot === null && RP.ISS(bad.id) !== undefined,
    `задание кончается СОСТОЯНИЕМ, а не пустотой: снимка на 01.01.2026 нет — ошибка, строка ` +
    `в журнале осталась и говорит почему`);

  as('clerk');
  const t = RP.state.templates.find(x => x.id === 't-notice');
  const before = t.series.next;
  const ob = RP.order('t-notice', { params:{ obj: RP.objects()[0].id }, kind:'окончательный' });
  const atOrder = t.series.next;
  RP.step(ob.id); const done = RP.step(ob.id);
  ok(79, ob.ok && atOrder === before && t.series.next === before + 1 &&
        done.rec.number === t.series.prefix + String(before).padStart(3,'0'),
    `номер серии тратится вместе со снимком, а не при заказе: после заказа следующий остался ` +
    `${atOrder}, после «готов» стал ${t.series.next}, выпуску достался ${done.rec.number} (ИО-9)`);
})();

(() => {
  RP.seed(); as('auth');
  const colDate = RP.setColumnDate('t-overdue', 'debt_main', '2026-07-01');
  const rule = RP.ruleAsWorklist('крупные', 'остаток > 100 млн');
  ok(80, !colDate.ok && has(colDate.why, 'ИО-19') && has(colDate.why, '§19 п. 6') &&
        !rule.ok && has(rule.why, 'ИО-14') && has(rule.why, '§9'),
    `две привычки легаси названы отказом: дата состояния у ответа одна (ИО-19), а правило отбора — ` +
    `не рабочий список: список это замороженный состав, правило живёт параметром редакции (§9)`);

  const V = win.VIEWS;
  const b = V.builder.fn(), i = V.issue.fn(), bo = V.bounds.fn(), w = V.worklists.fn();
  RP.order('t-overdue', { params:{ asOf: RP.state.sel.params.asOf, dept:null }, kind:'предварительный' });
  const j = V.journal.fn(), i2 = V.issue.fn();
  ok(81, has(b, 'Итоги уровней и лист выгрузки') && has(i, 'Задания на выпуск') &&
        has(i, 'Итог по «') && has(i2, 'Шаг задания') && has(j, 'задание: заказан') &&
        has(bo, 'Отказы, вычитанные из легаси') && has(w, 'Правило отбора — '),
    `волна 4 проговорена на экранах: полосы и итоги уровней в конструкторе и предпросмотре, ` +
    `состояния задания в выпуске и журнале, отказы легаси на границах`);
})();

/* ---- отчёт ---- */
const pass = results.filter(r => r.pass).length;
const lines = results.map(r => `   ${r.pass ? 'PASS' : 'FAIL'}  #${r.n}  ${r.note}`);
console.log(`SMOKE 2026-08-24 · ${pass}/${results.length} PASS\n` + lines.join('\n'));

const body = lines.map(l => '  ' + l).join('\n');
const injected = `  SMOKE 2026-08-24 · ${pass}/${results.length} PASS\n` + body;
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
