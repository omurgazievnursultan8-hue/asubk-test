// Headless smoke для mockups/reports/reports.html (ИО-1…ИО-26, ADR-0156…0163).
// Zero-dep: вытаскивает <script> из HTML и исполняет логический слой в node:vm (без DOM —
// render() и toast() при отсутствии document становятся no-op, экраны не рисуются).
// Проверяется поведение: объявленность состава, пять отказов публикации, две ступени
// выпуска, снимок и расхождение со сданным, серии и номера, обязательства из правила,
// четыре шва внутрь и три наружу, названные отказы вместо отсутствующих кнопок,
// витрина потребителя и справочник форм (обязательная форма без шаблона — строка без кнопки).
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
/* Витрина разложена по вкладкам «виды · отчёт · бланк»: проверка, которой нужна
   вся витрина, а не открытая вкладка, склеивает их сама.                     */
const SC_TABS = ['виды', 'отчёт', 'бланк'];
const showTab = t => { RP.state.sel.scTab = t; return win.VIEWS.showcase.fn(); };
const showAll = () => SC_TABS.map(showTab).join('\n');

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
  const bs = RP.setBasis('t-osh', { doc:'Порядок №41', point:'12' });
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
  const slice = SEAM.statSlice('s-portfolio', null, { dept:null }, null, v.scope.slice());
  as('auth');
  const all = SEAM.statSlice('s-portfolio', null, { dept:null }, null, RP.viewer().scope.slice());
  ok(13, rows.rows.length === 3 && rows.hidden === 5 && slice.value < all.value,
    `шов вернул ${rows.rows.length} строк и произнёс «скрыто ${rows.hidden}»; итог посчитан по видимым ` +
    `строкам (${slice.value} против ${all.value}) — иначе итог рассказал бы то, чего в строках нет, §13.2`);

  const sub = SEAM.statRows('credit', '2026-09-01', { dept:null }, RP.viewer().scope.slice());
  const none = SEAM.statRows('credit', '2025-12-01', { dept:null }, RP.viewer().scope.slice());
  ok(14, sub.substituted === '2026-08-01' && none.missing === true,
    `снимка на 01.09.2026 нет — подставлен ближайший на ${sub.substituted}; на 01.12.2025 снимка нет вовсе`);
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
        f.snapshot && f.recipient && f.recipient.name === 'ОсОО «Нарын-Агро»' &&
        f.recipient.ref === 'su-2' && f.recipient.role === 'заёмщик' && f.recipient.viaObject === 'kr-2',
    `номер ${f.number} потрачен ВМЕСТЕ со снимком; получатель бланка — ССЫЛКА на лицо ` +
    `(${f.recipient.ref}, роль «${f.recipient.role}»), объект — только дорога к нему (ИО-5, ИО-28)`);

  const addr = RP.issue('t-notice', { params:{ obj:'kr-2' }, kind:'окончательный', recipient:'a-mf' });
  ok(24, !addr.ok && has(addr.why, 'справочника адресатов сдачи') &&
        has(addr.why, 'подразделение своего объекта'),
    `бланку адресат сдачи не выбирается: получателя объявляет РЕДАКЦИЯ одним из четырёх видов — ` +
    `«${addr.why.slice(0, 70)}…» (ИО-5, ADR-0168 §1)`);

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
  const all = RP.obligations();
  const obl = all.filter(o => o.tpl === 't-overdue');
  const may = obl.filter(o => o.period === 'май 2026');
  const jul = obl.filter(o => o.period === 'июль 2026');
  const late = jul.filter(o => o.state === 'просрочено');
  ok(35, obl.length === 9 && all.length === 12 && may.every(o => o.state === 'сдано') &&
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

  /* Сдаёт разрез тот, за кем обязательство: уполномоченный его показывает, а
     окончательно выпускает Осмонова Г. — ИО-25, проверка 106.               */
  as('user');
  const fin = RP.issue('t-overdue', { params:{ asOf:'2026-08-01', dept:'dep-prom' },
    kind:'окончательный', recipient:'a-kab' });
  as('auth');
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
  ok(42, r.ok && r.broken.length === 9 && has(st.why, 'перечень изменил его владелец (ядро · кредиты)') &&
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
  ok(65, bad.length === 0 && names.length === 11,
    `одиннадцать экранов × пять ролей = ${names.length * 5} отрисовок без исключений (${Math.round(total / 1000)} КБ разметки)`);

  as('auth');
  const reg = VIEWS.registry.fn(), cal = VIEWS.calendar.fn(), jr = VIEWS.journal.fn();
  const bl = VIEWS.blank.fn(), wl = VIEWS.worklists.fn(), bo = VIEWS.bounds.fn();
  ok(66, has(reg, 'Чего вы здесь не видите') && has(cal, 'Три кнопки, которых в модуле нет') &&
        has(jr, 'что мы отдали наружу') && has(bl, 'список выведен разбором') &&
        has(wl, 'Поручений он не несёт') && has(bo, 'Чего в макете нет и почему'),
    `отказы и границы проговорены на самих экранах, а не спрятаны за отсутствием кнопки`);
})();

/* ---------- R. Волна 4: итоги уровней, лист выгрузки, выпуск заданием ---------- */
(() => {
  RP.seed(); as('auth');
  const fold = RP.foldLevelsSelf('t-npl');
  ok(67, !fold.ok && fold.parts === 3 && Math.abs(fold.sum - 83.3) < 0.05 && fold.real === 25 &&
        has(fold.why, 'ИО-17') && has(fold.why, 'ИС-24'),
    `число уровня приходит узлом дерева, а не сложением: доли по ${fold.parts} подразделениям в сумме ` +
    `дают ${fold.sum} %, а корень того же дерева равен ${fold.real} % — складывать детей нельзя (ИО-17, ИС-24)`);

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
        pv.groups.every(g => g.totals.every(t => t.seam === 'statSlice (дерево)')),
    `итоговая строка печатается только по объявленному уровню: у подразделения она есть и пришла ` +
    `узлом дерева statSlice, у состояния кредита — нет, потому что редакция её не объявляла`);

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

  const bad = RP.order('t-overdue', { params:{ asOf:'2025-12-01', dept:null }, kind:'предварительный' });
  RP.step(bad.id);
  const err = RP.step(bad.id);
  const errRow = RP.ISS(bad.id);
  ok(78, bad.ok && !err.ok && err.state === 'ошибка' && has(err.why, 'ИО-6') &&
        errRow.state === 'ошибка' && errRow.snapshot === null && RP.ISS(bad.id) !== undefined,
    `задание кончается СОСТОЯНИЕМ, а не пустотой: снимка на 01.12.2025 нет — ошибка, строка ` +
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

/* ---------- W. Экран крутится в границах редакции (ИО-20…ИО-22, ADR-0162) ---------- */
(() => {
  RP.seed(); as('auth');
  const asOf = RP.state.sel.params.asOf;
  const b = RP.bounds('t-overdue');
  const d0 = RP.show('t-overdue', { asOf, dept:null }, null);
  ok(82, b.cuts.join() === 'status' && b.stats.join() === 's-portfolio' && b.drill === false &&
        b.base.cuts.join() === 'dept,status' && d0.ok && d0.deviated === false &&
        d0.head.label === 'не выпуск' && d0.head.kind === 'показ' &&
        d0.head.composition.cuts.join(' → ') === 'подразделение → состояние кредита',
    `редакция объявляет ДВА списка: состав по умолчанию (${d0.head.composition.cuts.join(' → ')}) ` +
    `и перечень допустимых отклонений (разрезы: ${b.cutNames.join('; ')}; показатели: ` +
    `${b.statNames.join('; ')}); показ несёт шапку с меткой «${d0.head.label}» (ИО-20, ADR-0162 §1, §5)`);

  const hid = RP.show('t-overdue', { asOf, dept:null }, { cuts:['dept'] });
  ok(83, hid.ok && hid.deviated === true && hid.data.groups.length === 3 &&
        hid.data.groups[0].children === null &&
        hid.head.composition.cuts.join() === 'подразделение' && hid.head.deviated === true,
    `внутри границ это ТОТ ЖЕ отчёт: разрешённый разрез «состояние кредита» снят — остался один ` +
    `уровень (${hid.data.groups.length} группы), шапка честно говорит «состав накручен»`);

  const hidHard = RP.show('t-overdue', { asOf, dept:null }, { cuts:['status'] });
  ok(84, !hidHard.ok && has(hidHard.why, 'подразделение') && has(hidHard.why, 'ИО-20') &&
        has(hidHard.why, 'отклонением не назван'),
    `жёсткий уровень не снимается: «${hidHard.why.slice(0, 80)}…»`);

  const addOut = RP.show('t-overdue', { asOf, dept:null }, { cuts:['dept','status','borrower'] });
  ok(85, !addOut.ok && has(addOut.why, 'ЛИЧНЫМ ЧЕРНОВИКОМ') && has(addOut.why, 'ИО-20'),
    `выход за границу — не показ, а личный черновик: разрез «заёмщик» редакция отклонением не ` +
    `объявляла, и модуль называет это словом, а не гасит кнопку (ИО-20, ADR-0162 §2)`);

  const addS = RP.show('t-overdue', { asOf, dept:null },
    { stats:['s-overdue-sum','s-overdue-cnt','s-portfolio'] });
  ok(86, addS.ok && addS.deviated === true && addS.data.totals.length === 3 &&
        addS.data.totals[2].id === 's-portfolio' && d0.data.totals.length === 2,
    `разрешённый показатель добавляется экраном без новой редакции: было ${d0.data.totals.length}, ` +
    `стало ${addS.data.totals.length} — «${addS.data.totals[2].name}» объявлен допустимым отклонением`);

  const hidS = RP.show('t-overdue', { asOf, dept:null }, { stats:['s-overdue-sum'] });
  ok(87, !hidS.ok && has(hidS.why, 'Кредитов с просрочкой') && has(hidS.why, 'объявлен составом'),
    `жёсткий показатель не прячется: «${hidS.why.slice(0, 80)}…»`);
})();

(() => {
  RP.seed(); as('auth');
  const mv = RP.show('t-portfolio', {}, { cuts:['status','dept'] });
  ok(88, !mv.ok && has(mv.why, 'жёсткие уровни переставлены') && has(mv.why, 'ИО-20'),
    `порядок жёстких уровней принадлежит редакции: «${mv.why.slice(0, 80)}…»`);

  const add = RP.show('t-portfolio', {}, { cuts:['dept','status','borrower'] });
  const l3 = add.ok && add.data.groups[0].children && add.data.groups[0].children[0].children;
  ok(89, add.ok && add.deviated === true && !!l3 && l3.length >= 1 &&
        add.head.composition.cuts.join(' → ') === 'подразделение → состояние кредита → заёмщик',
    `объявленное отклонение углубляет разрез: третьим уровнем встал «заёмщик» — ` +
    `${add.head.composition.cuts.join(' → ')}`);

  const noRows = RP.show('t-portfolio', {}, { drill:false });
  const seams = noRows.ok ? noRows.data.passport.seams : [];
  ok(90, noRows.ok && noRows.deviated === true && noRows.data.rows.length === 0 &&
        seams.indexOf('objectRows') === -1 && seams.indexOf('statRows') === -1 &&
        seams.indexOf('statSlice (дерево)') !== -1 &&
        noRows.data.groups[0].count > 0 && noRows.data.passport.shown.drill === false,
    `снятое углубление — ДРУГОЙ ШОВ, а не спрятанные строки: статRows/objectRows не спрошены ` +
    `вовсе, ответ собран деревом statSlice (${seams.join(' · ')}) — потому оно и объявляется ` +
    `редакцией (ADR-0162 §8)`);

  const noDrill = RP.show('t-overdue', { asOf: RP.state.sel.params.asOf, dept:null }, { drill:false });
  ok(91, !noDrill.ok && has(noDrill.why, 'другой шов') && has(noDrill.why, 'ADR-0162 §8'),
    `там, где углубление отклонением не объявлено, его не снять: «${noDrill.why.slice(0, 80)}…»`);
})();

(() => {
  RP.seed(); as('auth');
  const asOf = RP.state.sel.params.asOf;
  const lay = RP.show('t-overdue', { asOf, dept:null }, { layout:'показатели в строках' });
  const o = RP.order('t-overdue', { params:{ asOf, dept:null }, kind:'предварительный',
    twist:{ layout:'показатели в строках' } });
  RP.step(o.id); RP.step(o.id);
  const rec = RP.ISS(o.id);
  ok(92, lay.ok && lay.deviated === false && lay.head.composition.layout === 'показатели в строках' &&
        rec.deviated === false && rec.passport.shown.layout === 'показатели в колонках' &&
        RP.layouts().length === 2,
    `раскладка свободна и отклонением не считается — клетки те же, вопрос тот же; в выпуск она ` +
    `не уходит вовсе: лист принадлежит редакции (ИО-18, ADR-0162 §8)`);
})();

(() => {
  RP.seed(); as('auth');
  const sv = RP.saveView('t-overdue', 'моя просрочка', { cuts:['dept'] });
  const dup = RP.saveView('t-overdue', 'моя просрочка', { cuts:['dept'] });
  const mine = RP.myViews('t-overdue');
  ok(93, sv.ok && has(sv.note, 'передают не его, а выпуск') && mine.length === 1 &&
        mine[0].owner === 'Тентимишев К.' && !dup.ok && has(dup.why, 'уже есть'),
    `сохранённая накрутка — ВИД, восьмая сущность: имя, владелец, список, удаление; ` +
    `безымянных и одноимённых видов не бывает (ADR-0162 §3)`);

  const sh = RP.shareView(sv.id, 'Асанов А.');
  const pu = RP.publishView(sv.id);
  ok(94, !sh.ok && has(sh.why, 'передают ВЫПУСК') && has(sh.why, 'ADR-0156') &&
        !pu.ok && has(pu.why, 'нужна новая редакция') && has(pu.why, 'ИО-1'),
    `вид личный и на публикацию не идёт никогда: общим состав становится ровно одним способом — ` +
    `публикацией редакции; передают выпуск, у которого есть паспорт (ADR-0162 §3)`);

  const bad = RP.saveView('t-overdue', 'за границей', { cuts:['dept','status','borrower'] });
  ok(95, !bad.ok && has(bad.why, 'ЛИЧНЫМ ЧЕРНОВИКОМ'),
    `вид не расширяет границ: он живёт ПОВЕРХ чужой опубликованной редакции, а не вместо неё`);

  as('head');
  const alien = RP.applyView(sv.id);
  ok(96, !alien.ok && has(alien.why, 'принадлежит Тентимишев К.') && has(alien.why, 'вид личный'),
    `чужим способом смотреть не пользуются: «${alien.why.slice(0, 70)}…»`);
})();

(() => {
  RP.seed(); as('auth');
  const sv = RP.saveView('t-overdue', 'моя просрочка',
    { cuts:['dept'], stats:['s-overdue-sum','s-overdue-cnt','s-portfolio'] });
  const ne = RP.newEdition('t-overdue');
  const sf = RP.setFree('t-overdue', { cuts:[], stats:[], drill:false });
  const pb = RP.publish('t-overdue');
  const ap = RP.applyView(sv.id);
  const back = ap.dropped.filter(x => has(x, 'вернулся в показ'));
  const gone = ap.dropped.filter(x => has(x, 'отвалился'));
  ok(97, ne.ok && sf.ok && pb.ok && ap.ok && ap.ed === 2 && back.length === 1 &&
        has(back[0], 'состояние кредита') && ap.twist.cuts.join() === 'dept,status',
    `вид переживает правку редакции, но не отменяет её: уровень «состояние кредита» редакция 2 ` +
    `объявила составом — вернулся в показ, и притом В ОБЪЯВЛЕННОМ ПОРЯДКЕ (ADR-0162 §4)`);
  ok(98, gone.length === 1 && has(gone[0], 'Остаток основного долга') && ap.deviated === false &&
        has(ap.note, 'остальное работает') && RP.myViews('t-overdue').length === 1,
    `ставшая недопустимой часть отваливается С ПОМЕТКОЙ, остальное работает: ни молчаливой ` +
    `подмены, ни блокировки всего вида из-за чужой правки соседнего столбца`);
})();

(() => {
  RP.seed(); as('user');
  const f1 = RP.setFree('t-overdue', { cuts:['status'] });
  as('auth');
  const f2 = RP.setFree('t-overdue', { cuts:['status'] });
  RP.newEdition('t-overdue');
  const f3 = RP.setFree('t-overdue', { stats:['s-npl'] });
  const f4 = RP.setFree('t-overdue', { cuts:['moon'] });
  ok(99, !f1.ok && has(f1.why, 'уполномоченный') && !f2.ok && has(f2.why, 'НОВАЯ РЕДАКЦИЯ') &&
        has(f2.why, 'задним числом') && !f3.ok && has(f3.why, 'выведен') &&
        !f4.ok && has(f4.why, 'отчётность не разрезает'),
    `границы крутилки — часть СОСТАВА, а не настройка экрана: объявляет уполномоченный, живут ` +
    `в редакции и задним числом не расширяются, иначе вчерашний показ и сегодняшний спорят ` +
    `о том, что было можно (ИО-20)`);
})();

(() => {
  RP.seed(); as('auth');
  const asOf = RP.state.sel.params.asOf;
  const o = RP.order('t-overdue', { params:{ asOf, dept:null }, kind:'предварительный',
    twist:{ cuts:['dept'] } });
  RP.step(o.id); const done = RP.step(o.id);
  const rec = RP.ISS(o.id);
  const fin = RP.order('t-overdue', { params:{ asOf, dept:null }, kind:'окончательный',
    recipient:'a-mf', twist:{ cuts:['dept'] } });
  ok(100, o.ok && done.done && rec.deviated === true && rec.passport.deviated === true &&
        rec.passport.shown.cuts.join() === 'подразделение' &&
        rec.passport.shown.stats.length === 2 && rec.passport.shown.drill === true &&
        rec.kind === 'предварительный',
    `паспорт хранит ПОКАЗАННЫЙ СОСТАВ ЦЕЛИКОМ, а не дельту и не флаг: разрезы ` +
    `«${rec.passport.shown.cuts.join('; ')}», показателей ${rec.passport.shown.stats.length} — ` +
    `снимок восстанавливается из паспорта, не вычитая одно из другого (ИО-22)`);
  ok(101, !fin.ok && has(fin.why, 'ИО-21') && has(fin.why, 'только составом по умолчанию') &&
        has(fin.why, 'получатель сравнивает присланное с прошлым разом'),
    `накрученное выпускается, но НИКОГДА окончательным: «${fin.why.slice(0, 80)}…»`);
})();

(() => {
  RP.seed(); as('auth');
  const bl = RP.show('t-notice', { obj: RP.objects()[0].id }, { cuts:['dept'] });
  RP.newEdition('t-portfolio');
  const dr = RP.state.templates.find(t => t.id === 't-portfolio')
    .editions.find(e => e.state === 'черновик');
  dr.free = { cuts:['moon'], stats:['s-npl','s-avg-late'], drill:false };
  const ch = RP.publishChecks('t-portfolio').filter(c => c.check === 'допустимое отклонение');
  const pb = RP.publish('t-portfolio');
  ok(102, !bl.ok && has(bl.why, 'бланк не крутится') && ch.length === 3 && !pb.ok &&
        ch.some(c => has(c.why, 'не разрезает')) && ch.some(c => has(c.why, 'выведен')) &&
        ch.some(c => has(c.why, 'пообещать невыполнимое')),
    `перечень отклонений — подмножество доступного, а не список пожеланий: публикация ловит ` +
    `${ch.length} невозможных отклонения ШЕСТОЙ проверкой; у бланка крутить нечего — он говорит ` +
    `об одном объекте (§2.2, ADR-0162 §1)`);

  RP.seed(); as('user');
  const my = RP.show('t-portfolio', {}, { cuts:['dept','status','borrower'] });
  ok(103, my.ok && my.deviated === true && my.head.scope.join() === 'Отраслевой департамент промышленности' &&
        my.data.hidden > 0 && my.data.rows.every(r => r.dept === 'dep-prom'),
    `крутить вправе всякий, кто вправе смотреть: отдельного права нет, а свобода экрана видимости ` +
    `не расширяет — ${my.data.hidden} строк остались скрыты областью видимости (ADR-0162 §9, ADR-0152 §3)`);

  RP.seed(); as('auth');
  const V = win.VIEWS;
  const i = V.issue.fn(), b = V.builder.fn();
  ok(104, has(i, 'Как смотреть — в границах, объявленных редакцией') && has(i, 'НЕ ВЫПУСК') &&
        has(i, 'Личный вид') && has(i, 'жёстко') && has(b, 'Допустимые отклонения (§3 п. 9)') &&
        has(b, 'Шесть проверок публикации'),
    `волна 5 проговорена на экранах: крутилка с жёсткими элементами и шапка показа в выпуске, ` +
    `перечень допустимых отклонений и шестая проверка в конструкторе`);
})();

/* ---------- S. Витрина, справочник форм, право сдачи (волна 6) ----------
   ОЧ-41…ОЧ-49, ИО-23…ИО-26, ADR-0163. Витрина — вход потребителя; реестр
   шаблонов остаётся столом уполномоченного и здесь не проверяется.        */
(() => {
  RP.seed(); as('auth');
  const sc = RP.showcase();
  const all = sc.must.concat(sc.rest);
  const drafts = RP.state.templates.filter(t => !t.editions.some(e => e.state === 'опубликована'));
  ok(105, sc.must.length > 0 && sc.rest.length > 0 && drafts.length > 0 &&
        all.filter(r => r.kind === 'шаблон').length === RP.state.templates.length - drafts.length &&
        !all.some(r => drafts.some(d => d.id === r.id)),
    `витрина — вход потребителя: ${all.length} строк, из них ${all.filter(r => r.kind === 'шаблон').length} ` +
    `опубликованных шаблонов; ${drafts.length} личных черновиков не показано вовсе — спросить можно ` +
    `только объявленное (ОЧ-41, ИО-1)`);

  ok(106, sc.must.every(r => r.obligatory) && sc.rest.every(r => !r.obligatory) &&
        sc.rest.every(r => r.kind === 'шаблон'),
    `группы — по обязательности, а не по объекту: обязательных ${sc.must.length}, остальных ` +
    `${sc.rest.length}; незаведённых НЕобязательных форм в витрине нет вовсе — каталог остаётся ` +
    `предложением, а не договорённостью (ОЧ-42, ADR-0163 §4)`);

  const gaps = RP.formGaps();
  const norms = sc.must.filter(r => r.kind === 'норма');
  const forms = RP.forms();
  ok(107, forms.length === 14 && forms.filter(f => f.obligatory).length === 12 &&
        gaps.length === 2 && gaps.filter(g => g.nowhere).length === 0 &&
        norms.length === gaps.length &&
        norms.every(r => r.state === 'шаблон не заведён' && !r.obligation && !r.schedule) &&
        has(norms[0].why, 'выпуск предъявляет редакцию, а редакции нет'),
    `обязательная форма без шаблона видна как НЕИСПОЛНЯЕМАЯ НОРМА: обязательных ` +
    `${forms.filter(f => f.obligatory).length}, шаблон заведён у ${forms.filter(f => f.obligatory).length - gaps.length}, ` +
    `${gaps.length} строк без кнопки, из них ${gaps.filter(g => g.nowhere).length} не заведено нигде — ` +
    `срок по норме идёт независимо от того, завели мы шаблон (ИО-23, ОЧ-40)`);

  const V = win.VIEWS;
  const showH = showAll();
  ok(108, !has(showH, "RP.openForm('" + norms[0].id) &&
        has(showH, 'Завести — ' + RP.formsOwner()) &&
        norms.every(r => r.goTo === RP.formsOwner()) &&
        has(showH, 'шаблон не заведён') && has(showH, 'срока нет') &&
        norms.every(r => has(showH, r.basis)),
    `у неисполняемой нормы нет кнопки, но названы основание и тот, к кому идти: «${RP.formsOwner()}» — ` +
    `справочник ведёт тот же, кто публикует редакции; срока у неё нет — он живёт расписанием ` +
    `шаблона (ADR-0163 §5, §7)`);

  const oblBefore = RP.obligations().length;
  ok(109, oblBefore === 12 && !RP.obligations().some(o => gaps.some(g => g.id === o.tpl)) &&
        !has(V.calendar.fn(), gaps[0].name),
    `неисполняемая норма обязательств НЕ порождает: их по-прежнему ${oblBefore} и все от шаблонов; ` +
    `в календарь сдачи такая строка не попадает — срок объявляется расписанием, а расписание живёт ` +
    `на шаблоне (ADR-0163 §6)`);
})();

(() => {
  RP.seed(); as('auth');
  const dup = RP.linkForm('t-portfolio', 'ФО-01');
  const alien = RP.linkForm('t-notice', 'ФО-26');
  const noform = RP.linkForm('t-portfolio', 'ФО-99');
  ok(110, !dup.ok && has(dup.why, RP.TPL('t-overdue').name) && has(dup.why, 'ИО-24') &&
        has(dup.why, 'ОЧ-39') && has(dup.why, 'кладётся параметром редакции'),
    `одна форма — не более одного шаблона, и отказ НАЗЫВАЕТ первый вслух: «${dup.why.slice(0, 70)}…» ` +
    `— защита от легаси-копирования устройством, а не дисциплиной (ИО-24)`);
  ok(111, !alien.ok && has(alien.why, 'вид объявляет форма, шаблон её реализует') &&
        !noform.ok && has(noform.why, 'согласованным перечнем'),
    `вид объявляет форма, а не шаблон; справочник наполняется согласованным перечнем, а не всеми ` +
    `строками каталога — «${noform.why.slice(0, 60)}…»`);

  const rel = RP.linkForm('t-avg', 'ФО-26');
  ok(112, !rel.ok && RP.formTpl('ФО-26').id === 't-portfolio' &&
        RP.formOf('t-overdue').id === 'ФО-01' && RP.formOf('t-avg') === null,
    `связь объявляется НА ШАБЛОНЕ и второго источника правды нет: «какую форму я реализую» ` +
    `спрашивается у шаблона, форма о том, чего у неё нет, не знает`);
})();

(() => {
  RP.seed(); as('auth');
  /* Право окончательного выпуска — то же обязательство, прочитанное с другого
     конца: отдельного права на роли не заводится (ОЧ-45).                   */
  const alien = RP.finalRight('t-overdue', ['dep-prom']);
  const whole = RP.finalRight('t-overdue', null);
  const free  = RP.finalRight('t-portfolio', null);
  ok(113, !alien.ok && has(alien.why, 'окончательно выпускает тот, за кем обязательство') &&
        has(alien.why, 'Осмонова Г.') && has(alien.why, 'ИО-25') &&
        has(alien.why, 'смотреть волен всякий в круге'),
    `чужой разрез окончательно не сдаётся: «${alien.why.slice(0, 74)}…» — посмотреть и выгрузить ` +
    `предварительно вправе всякий в круге`);
  ok(114, whole.ok && whole.whole === true && free.ok && free.free === true &&
        has(free.note, 'обязательства у шаблона нет'),
    `свод по всему кругу сдаёт тот, кто ведёт шаблон (обязательство перед получателем его); ` +
    `где обязательства нет вовсе — окончательно выпускает всякий в круге`);

  const ord = RP.order('t-overdue', { params:{ asOf:'2026-08-01', dept:'dep-prom' },
    kind:'окончательный', recipient:'a-kab' });
  as('user');
  const mine = RP.finalRight('t-overdue', ['dep-prom']);
  const ordMine = RP.order('t-overdue', { params:{ asOf:'2026-08-01', dept:'dep-prom' },
    kind:'окончательный', recipient:'a-kab' });
  ok(115, !ord.ok && has(ord.why, 'ИО-25') && mine.ok && has(mine.note, 'обязательство за вами') &&
        ordMine.ok,
    `правило одно на показ и на выпуск: уполномоченному заказ окончательного по чужому разрезу ` +
    `отклонён тем же текстом, а Осмоновой Г. — принят (ИО-25, §13.6)`);

  as('auth');
  const subs = RP.whoSubmits('t-overdue');
  ok(116, subs.length === 3 && subs.every(s => s.who && s.who !== '—') &&
        RP.whoSubmits('t-portfolio') === null,
    `«за кем» названо подразделением, а не ролью: ${subs.map(s => s.who).join('; ')} — иначе сдача ` +
    `встала бы на отпуске; у шаблона без расписания сдающего нет вовсе`);

  as('head');
  const scr = win.VIEWS.issue.fn();
  ok(117, has(scr, 'Ступень выпуска') &&
        (has(scr, 'окончательно выпускает тот, за кем обязательство') ||
         has(scr, 'обязательство за вами')),
    `экран выпуска проговаривает право словами, а не гасит кнопку молча: рядом со ступенью стоит ` +
    `либо «обязательство за вами», либо имя того, с кого спросят`);
})();

(() => {
  RP.seed(); as('auth');
  const def = RP.defaultAsOf();
  ok(118, RP.state.sel.params.asOf === def && RP.hasSnapshot(def) &&
        !RP.hasSnapshot('2026-09-01') && def === '2026-08-01',
    `экран открывается на периоде, у которого СНИМОК ЕСТЬ (${def}): иначе умолчание показывало бы ` +
    `числа, которыми нельзя отчитаться, и разница «посмотрел / сдал» размылась бы (ИО-26)`);

  RP.state.sel.params.asOf = '2026-09-01';
  const warn = win.VIEWS.issue.fn();
  ok(119, has(warn, 'За этот период снимка нет') && has(warn, 'ближайшему более раннему') &&
        has(warn, 'ИО-26'),
    `период без снимка назван вслух: молчаливая подстановка соседней даты — это ответ на другой ` +
    `вопрос под именем заказанного (ИО-26, ОЧ-44)`);

  RP.seed(); as('auth');
  RP.selTpl('t-portfolio');
  const gate = win.VIEWS.issue.fn();
  RP.askLive();
  const live = win.VIEWS.issue.fn();
  ok(120, has(gate, 'Числа не запрошены') && has(gate, 'Посчитать на сейчас') &&
        !has(gate, 'sheet-h') && has(live, 'sheet-h') && !has(live, 'Числа не запрошены') &&
        !has(win.VIEWS.issue.fn(), 'Числа не запрошены'),
    `момент показа ВЫВЕДЕН из режима времени, а не назначен: «на дату» считается сразу, «сейчас» — ` +
    `по кнопке, потому что это живой запрос к ядру, а не готовые строки прогона (ОЧ-44)`);
})();

(() => {
  RP.seed(); as('auth');
  const before = RP.state.issues.length;
  const ex = RP.exportShown('t-overdue', { asOf: RP.defaultAsOf(), dept:'' }, null, 'xlsx');
  const rec = RP.ISS(ex.id);
  ok(121, ex.ok && RP.state.issues.length === before + 1 && rec.kind === 'предварительный' &&
        rec.passport && has(ex.note, 'выгрузка — это выпуск') && has(ex.note, 'строка остаётся'),
    `выгрузка — не соседняя кнопка, а предварительный выпуск: строка ${ex.id} в журнале, паспорт и ` +
    `показанный состав целиком; файл гаснет через ${RP.FILE_DAYS} дней, строка остаётся (ОЧ-49, ИО-11)`);

  const noName = RP.worklistShown('t-overdue', { asOf: RP.defaultAsOf(), dept:'' }, null, '  ');
  const wl = RP.worklistShown('t-overdue', { asOf: RP.defaultAsOf(), dept:'' }, null,
    'обзвон по просрочке, август');
  ok(122, !noName.ok && has(noName.why, 'список называется при создании') && wl.ok &&
        RP.ISS(wl.issue).kind === 'предварительный' && has(wl.note, 'заморожен паспортом'),
    `рабочий список тоже идёт через выпуск: список по определению замороженный состав, а морозить ` +
    `нечего, пока у ответа нет паспорта — ${wl.id} отобран выпуском ${wl.issue} (ИО-14, ОЧ-49)`);

  const sc = win.VIEWS.issue.fn();
  ok(123, has(sc, 'Что делают с показанным — четыре дороги') &&
        has(sc, 'Завести рабочий список') && has(sc, 'вид ничего не морозит'),
    `четыре дороги названы на экране: выгрузить, выпустить окончательно, сохранить видом, завести ` +
    `рабочий список — и три из них выпуск; бесследно уходит только вид`);
})();

(() => {
  RP.seed(); as('user');
  const sc = RP.showcase();
  const claim = sc.must.concat(sc.rest).find(r => r.id === 't-claim');
  const last = sc.must[sc.must.length - 1];
  const shut = sc.must.filter(r => !r.access.ok);
  ok(124, claim && claim.access.ok === false && shut.indexOf(last) !== -1 &&
        has(claim.access.why, 'не в круге подразделения') && claim.access.who &&
        shut.length === 7 && shut.every(r => sc.must.indexOf(r) >= sc.must.length - shut.length),
    `недоступное по кругу не прячется, а приглушается В КОНЦЕ с причиной и с тем, у кого доступ: ` +
    `${shut.length} строки («${shut.map(r => r.name).join('», «')}») — круг «${claim.access.who}» ` +
    `(§13.1, ОЧ-42)`);

  RP.seed(); as('auth');
  RP.state.view = 'showcase';
  RP.openForm('t-notice');                      /* бланк — тупик, а не формирование */
  const stayed = RP.state.view;
  RP.openForm('t-overdue');
  ok(125, stayed === 'showcase' && RP.state.view === 'issue' &&
        has(showTab('бланк'), 'Где печатается'),
    `бланк в витрине — не формирование, а «где печатается»: своего перечня объектов витрина не ` +
    `держит (на трёх записях выпадашка работает, на живых двенадцати тысячах — нет), объект ` +
    `называет карточка или рабочий список (ОЧ-43)`);

  RP.seed(); as('auth');
  const v = RP.saveView('t-overdue', 'моя просрочка', null);
  RP.openViewOf(v.id);
  ok(126, v.ok && RP.state.view === 'issue' && RP.state.sel.view === v.id &&
        RP.state.sel.tpl === 't-overdue' && has(win.VIEWS.showcase.fn(), 'Мои виды'),
    `вид стоит в витрине отдельной строкой и открывается ОДНИМ прогоном: автоподстановка последнего ` +
    `вида отклонена — двое сказали бы «открыл отчёт по просрочке» и увидели разные таблицы (ОЧ-48)`);
})();

(() => {
  RP.seed();
  const V = win.VIEWS;
  const bad = [];
  Object.keys(R).forEach(role => { as(role);
    SC_TABS.forEach(t => {
      try { const html = showTab(t);
        /* у каждой вкладки обязаны быть корешки и тело — таблица либо названный
           пустой ответ; молча пустая вкладка считается поломкой.             */
        if (!has(html, 'class="tabs"') || !(has(html, '<table') || has(html, 'banner')))
          bad.push(role + '/' + t + ': ' + html.length); }
      catch (e) { bad.push(role + '/' + t + ': ' + e.message); } }); });
  as('auth');
  const sh = showAll();
  const marks = (sh.match(/(?:ADR-\d|ОЧ-\d|ИО-\d|ФО-\d\d\s*§|§\s*\d)/g) || []);
  ok(127, bad.length === 0 && marks.length === 0 && !has(sh, 'page-lead') &&
        !has(sh, 'class="facts"'),
    `каждая вкладка рисуется каждой ролью и несёт только рабочее: ни одной ссылки на решение ` +
    `или инвариант, ни вводного абзаца, ни карточки примечаний — экран для потребителя, ` +
    `а доводы живут в каноне`);

  RP.state.sel.scTab = '';
  const first = V.showcase.fn();
  const blanks = RP.showcase().must.concat(RP.showcase().rest).filter(r => r.tplKind === 'бланк');
  ok(128, has(first, 'Мои виды') && has(first, 'Отчёты') && has(first, 'Бланки') &&
        has(first, 'class="on"') && !has(first, 'Где печатается') && blanks.length > 0 &&
        blanks.every(r => !has(first, "openForm('" + r.id)) &&
        has(showTab('отчёт'), 'Обязательные') && has(showTab('отчёт'), 'По запросу') &&
        has(V.issue.fn(), 'четыре дороги') && Object.keys(V)[0] === 'showcase',
    `витрина первым экраном модуля и разложена по ВИДУ ФОРМЫ: три корешка со счётчиками, ` +
    `открыта ровно одна вкладка, ${blanks.length} бланков в ленту отчётов не подмешаны; ` +
    `обязательность делит уже внутри вкладки, четыре дороги — с показанного`);

  const rep = showTab('отчёт'), bl = showTab('бланк');
  const tables = s => (String(s).match(/<table/g) || []).length;
  const sects = s => (String(s).match(/class="sect"/g) || []).length;
  ok(156, tables(rep) === 1 && sects(rep) === 2 && tables(bl) === 1 && sects(bl) === 1 &&
        !has(bl, 'По запросу') && !has(bl, 'Под отбор не попало') &&
        has(rep, 'Обязательные <span class="n">· 1</span>'),
    `обязательность делит строки ВНУТРИ одной таблицы: на «Отчётах» одна шапка и два ` +
    `разделителя, на «Бланках» — один, потому что бланков «по запросу» не существует и ` +
    `пустой группы нет в разметке вовсе (а не «0 строк» с выдуманной причиной отбора)`);
})();

/* ---------- T. Три стола в навигации — раскладка, а не права (ОЧ-55) ---------- */
(() => {
  RP.seed();
  const V = win.VIEWS;
  const nav = (src.match(/<div class="nav">([\s\S]*?)<div class="sidebar-foot"/) || [])[1] || '';
  const groups = nav.split(/<div class="nav-sec">/).slice(1).map(ch => ({
    title: (ch.match(/^([^<]*)/) || [])[1].trim(),
    hint:  (ch.match(/<small>([^<]*)<\/small>/) || [])[1] || '',
    items: [...ch.matchAll(/data-v="([a-z]+)"/g)].map(m => m[1]) }));
  const titles = groups.map(g => g.title);

  ok(129, groups.length === 4 &&
        titles.join(' · ') === 'Смотреть и сдавать · Настраивать · След · Границы' &&
        groups.every(g => g.hint.trim().length > 10),
    `навигация разложена на три стола заказчика плюс служебный: ${titles.join(' · ')}; ` +
    `у каждого подписано, чей это стол`);

  const flat = groups.flatMap(g => g.items);
  const uniq = [...new Set(flat)];
  const missing = Object.keys(V).filter(v => flat.indexOf(v) === -1);
  ok(130, flat.length === 11 && uniq.length === 11 && missing.length === 0 &&
        groups.map(g => g.items.length).join('/') === '5/3/1/2',
    `перегруппировка ничего не потеряла и не задвоила: все 11 экранов ровно по разу, ` +
    `раскладка 5 / 3 / 1 / 2`);

  // Стол «Настраивать» — не право: пользователь собирает там личные черновики (§17).
  const nastr = groups[1].items;
  as('user');
  let drew = true;
  try { nastr.forEach(v => { if (V[v].fn().length < 200) drew = false; }); } catch (e) { drew = false; }
  ok(131, nastr.join(',') === 'registry,builder,blank' && drew &&
        !has(nav, 'locked') && !/data-role|hidden/.test(nav),
    `стол «Настраивать» пользователю НЕ заперт: все три его экрана рисуются ролью Осмоновой Г. — ` +
    `иначе личный черновик собирать негде (§17); скрытых по роли пунктов в навигации нет`);

  as('auth');
  ok(132, groups[0].items[0] === 'showcase' && groups[0].items[1] === 'issue' &&
        groups[2].items.join(',') === 'journal' &&
        has(nav, '>Показ и выпуск<') && V.issue.title === 'Показ и выпуск отчёта',
    `порядок столов говорит сам: витрина первым пунктом первого стола, за ней показ и выпуск; ` +
    `журнал вынесен в «След» — он ни настройка, ни потребление, а то, что предъявлено`);
})();

/* ---------- U. Расписание календарное; срок бланка чужой (ОЧ-56, ADR-0164) ---------- */
(() => {
  RP.seed();
  const T = RP.state.templates;
  const sched = T.filter(t => t.schedule);
  const keys = [...new Set(sched.flatMap(t => Object.keys(t.schedule)))].sort();
  const eventish = sched.filter(t => /рабочих дн|со дня|с момента|до даты платежа/.test(
    (t.schedule.text || '') + ' ' + (t.schedule.asOfRule || '')));

  ok(133, keys.every(k => ['freq','dueDay','dueMonth','since','asOfRule','text'].indexOf(k) !== -1) &&
        sched.every(t => typeof t.schedule.freq === 'string' && typeof t.schedule.dueDay === 'number') &&
        sched.every(t => t.schedule.freq !== 'ежегодно' || typeof t.schedule.dueMonth === 'number') &&
        eventish.length === 0,
    `расписание записано календарным правилом и только им: поля ${keys.join(', ')}; ` +
    `ни одного якоря «от события» (${eventish.length} шаблонов со сроком в рабочих днях от даты)`);

  /* Правило различает ПРИРОДУ СРОКА, а не вид формы (ADR-0164 §3): бланк с
     календарным сроком расписание несёт, бланк со сроком от события — нет.   */
  const blanks = T.filter(t => t.kind === 'бланк');
  const withSch = blanks.filter(t => t.schedule);
  const recon = RP.TPL('t-recon');
  ok(134, withSch.length === 1 && withSch[0].id === 't-recon' &&
        recon.schedule.freq === 'ежегодно' && eventish.length === 0 &&
        blanks.filter(t => !t.schedule).length === blanks.length - 1 &&
        sched.some(t => t.kind === 'отчёт') && sched.some(t => t.kind === 'бланк'),
    `расписание живёт по природе срока, а не по виду формы: из ${blanks.length} бланков его несёт ` +
    `ровно один — акт сверки («${recon.schedule.text.slice(0, 46)}…»), у остальных срок ` +
    `отсчитывается от события объекта и принадлежит взысканию и сопровождению (ADR-0164 §3)`);
})();

/* ---------- V. Полный охват меряется объектами; подпись — не выпуск (ИО-27, ОЧ-59) ---------- */
(() => {
  RP.seed();
  as('auth');
  const obl = RP.obligations().filter(o => o.tpl === 't-recon');
  const prom = obl.find(o => o.dept === 'dep-prom');
  const admin = obl.find(o => o.dept === 'dep-admin');
  ok(135, obl.length === 3 && obl.every(o => o.asOf === '2026-01-01' && o.due === '2026-09-01') &&
        obl.every(o => o.period === 'состояние на 01.01.2026') &&
        obl.every(o => o.state === 'ожидается') && obl.every(o => o.cover),
    `у бланка с календарным сроком обязательство ЕСТЬ и порождается тем же правилом: ${obl.length} ` +
    `строки на состояние 01.01.2026 со сроком до 01.09.2026 — «${RP.TPL('t-recon').schedule.asOfRule}»`);

  /* Знаменатель — снимок, а не живой перечень: kr-5 закрыт 14.08.2026, но на 1
     января действовал (акт с ним обязаны), kr-7 выдан в 2026 и в знаменатель
     не попал, хотя в живом перечне подразделения стоит.                       */
  const live = RP.objects().filter(o => o.dept === 'dep-prom');
  const needProm = prom.cover.missing.map(m => m.id).sort().join(',');
  ok(136, prom.cover.need === 2 && needProm === 'kr-1,kr-2' && live.length === 3 &&
        admin.cover.need === 3 && admin.cover.missing.some(m => m.id === 'kr-5') &&
        RP.objects().find(o => o.id === 'kr-5').status === 'закрыт',
    `знаменатель полноты берётся из снимка на дату состояния: у «Пром» ${prom.cover.need} из ` +
    `${live.length} живых (kr-7 выдан позже 1 января), у администрирования ${admin.cover.need} — ` +
    `вместе с kr-5, закрытым 14.08.2026, но действовавшим на дату сверки (ИО-27)`);

  /* Акт печатается по состоянию НА ДАТУ — из шва статистики, а не из ядра:
     иначе акт на 1 января нёс бы сегодняшние числа.                          */
  as('user');
  const show = RP.show('t-recon', { obj:'kr-1', asOf:'2026-01-01' });
  const jan = show.data.subs.find(s => s.id === 'debt_main');
  const now = RP.show('t-notice', { obj:'kr-1' }).data.subs.find(s => s.id === 'debt_main');
  ok(137, show.ok && show.data.passport.seams.join() === 'statRows' &&
        show.data.passport.asOf === '2026-01-01' && jan.value === 9600000 &&
        now.value === 7400000 && RP.show('t-notice', { obj:'kr-1' }).data.passport.seams.join() === 'objectRows',
    `бланк «на дату» читает снимок статистики, а не живое ядро: остаток в акте на 01.01.2026 — ` +
    `${jan.value / 1000000} млн, в уведомлении «сейчас» — ${now.value / 1000000} млн; швы разные ` +
    `(statRows против objectRows), закон общий`);

  const noDate = RP.order('t-recon', { params:{ obj:'kr-1' }, kind:'окончательный' });
  const early = RP.order('t-recon', { params:{ obj:'kr-7', asOf:'2026-01-01' }, kind:'окончательный' });
  ok(138, !noDate.ok && has(noDate.why, 'без даты состояния печатать нечего') &&
        !early.ok && has(early.why, 'заведён позже даты состояния'),
    `два отказа названы словами: бланк «на дату» без даты состояния не печатается, а объект, ` +
    `которого на эту дату ещё не было, в акт не попадает вовсе — «${early.why.slice(0, 52)}…»`);

  const one = RP.issue('t-recon', { params:{ obj:'kr-1', asOf:'2026-01-01' }, kind:'окончательный' });
  const half = RP.obligations().find(o => o.id === prom.id);
  const two = RP.issue('t-recon', { params:{ obj:'kr-2', asOf:'2026-01-01' }, kind:'окончательный' });
  const full = RP.obligations().find(o => o.id === prom.id);
  ok(139, one.ok && half.cover.got === 1 && half.state === 'ожидается' &&
        half.cover.missing[0].id === 'kr-2' && two.ok && full.cover.got === 2 &&
        full.state === 'сдано' && full.issues.length === 2 &&
        RP.ISS(one.id).recipient.viaObject && RP.ISS(one.id).number === 'АС-2026/001',
    `обязательство с полным охватом закрывает не бумага, а ВСЕ бумаги: после первого акта ` +
    `${half.cover.got} из ${half.cover.need} и «${half.state}» с поимённым остатком, после второго — ` +
    `«${full.state}»; получатель у каждого свой заёмщик, номер из серии (§13.4, ИО-27)`);

  const signed = RP.markSigned(prom.id);
  ok(140, !signed.ok && has(signed.why, 'событие контрагента, а не выпуск') &&
        has(signed.why, 'ОЧ-59') && has(RP.markDelivered(prom.id).why, 'ИО-12'),
    `«отметить подписанным» — такой же названный отказ, как «отметить сданным»: обязательство ` +
    `меряется тем, что модуль ПРОИЗВОДИТ, а подпись заёмщика ведёт сопровождение на объекте (ОЧ-59)`);

  /* Подставленный снимок мягко валит акт в предварительный: на подпись бумага
     с чужой датой состояния не уходит.                                       */
  const sub = RP.issue('t-recon', { params:{ obj:'kr-1', asOf:'2026-08-10' }, kind:'окончательный' });
  const rec = RP.ISS(sub.id);
  ok(141, sub.ok && rec.kind === 'предварительный' && rec.recipient === null &&
        rec.number === null && has(rec.note, 'полного охвата') &&
        has(rec.note, 'подставлен ближайший на 01.08.2026'),
    `акт по подставленной дате окончательным не бывает: снимка на 10.08.2026 нет, подставлен ` +
    `ближайший — выпуск остался предварительным, без получателя и без номера (ADR-0152 §5, ИО-8)`);
})();

/* ---------- Z. Получатель бланка — лицо в объявленной роли (волна 11, ADR-0167) ---------- */
(() => {
  RP.seed();
  as('clerk');
  const g = RP.issue('t-guar', { params:{ obj:'kr-6' }, kind:'окончательный' });
  const rec = RP.ISS(g.id);
  const sub = RP.layoutOf('t-guar').subs;
  ok(142, g.ok && rec.recipient.ref === 'su-8' && rec.recipient.role === 'поручитель' &&
        rec.recipient.viaObject === 'kr-6' && sub.indexOf('borrower') !== -1,
    `подстановка — не получатель: в теле требования печатается {{borrower}} («ОсОО «Ош-Текстиль»», ` +
    `о ком речь), а бумага уходит ${rec.recipient.name} — ${rec.recipient.ref}, роль ` +
    `«${rec.recipient.role}» (ADR-0167 §3)`);

  const none = RP.issue('t-guar', { params:{ obj:'kr-1' }, kind:'окончательный' });
  ok(143, !none.ok && has(none.why, 'такого лица нет: получателя назвать некем') &&
        has(none.why, 'Роль объявляет редакция'),
    `роли нет — отказ по имени, а не пустая строка в бумаге: «${none.why.slice(0, 80)}…» (ИО-28)`);

  RP.seed(); as('auth');
  const t = RP.TPL('t-recon'); const ed = t.editions[t.editions.length - 1];
  const keep = ed.addressee; ed.addressee = null; ed.state = 'черновик';
  const bad = RP.publishChecks('t-recon').find(c => c.check === 'адресат бланка');
  ed.addressee = keep;
  ok(144, !!bad && has(bad.why, 'вид адресата — часть вопроса, а не настройка минуты'),
    `бланк без объявленного адресата не публикуется: и вид, и значение — свойство редакции, и ` +
    `проверка стоит там же, где остальные (ИО-28, ADR-0167 §2, ADR-0168 §1)`);
})();

(() => {
  RP.seed(); as('clerk');
  /* у su-4 два договора — kr-4 и kr-8: лицо одно, бумаг две */
  RP.issue('t-notice', { params:{ obj:'kr-4' }, kind:'окончательный' });
  RP.issue('t-notice', { params:{ obj:'kr-8' }, kind:'окончательный' });
  const byObj  = RP.callSeamOut('карточка объекта (ядро)', 'reportIssues', 'kr-4');
  const bySubj = RP.callSeamOut('классификация', 'reportIssues', { subject:'su-4' });
  const wrongKey = RP.callSeamOut('карточка объекта (ядро)', 'reportIssues', { subject:'su-4' });
  ok(145, byObj.ok && byObj.data.length === 1 && bySubj.ok && bySubj.key === 'лицо' &&
        bySubj.data.length === 2 && bySubj.data.every(r => r.toRef === 'su-4') &&
        !wrongKey.ok && has(wrongKey.why, 'ключом «лицо»'),
    `тот же шов, второй ключ: по договору ${byObj.data.length} бумага, по ЛИЦУ ${bySubj.data.length} — ` +
    `у заёмщика договоров несколько, а уклоняется он один (п. 11 п.п. 2); карточке объекта ключ ` +
    `«лицо» не отдаётся — вопрос не её (ADR-0167 §5)`);
})();

(() => {
  RP.seed(); as('auth');
  const adm  = RP.obligations().find(o => o.tpl === 't-recon' && o.dept === 'dep-admin');
  const prom = RP.obligations().find(o => o.tpl === 't-recon' && o.dept === 'dep-prom');
  const guarHasNoSchedule = !RP.TPL('t-guar').schedule &&
        !RP.obligations().some(o => o.tpl === 't-guar');
  ok(146, adm.cover.need === 3 && adm.cover.needSubj === 2 &&
        prom.cover.need === 2 && prom.cover.needSubj === 2 && guarHasNoSchedule,
    `знаменатель нормы и знаменатель охвата — разные величины, и это сказано вслух: у ` +
    `администрирования ${adm.cover.need} договора, но ${adm.cover.needSubj} лица (КД-2025/088 и ` +
    `КД-2024/259 — один заёмщик). Счёт по договорам строже, раньше нормы не закроется (ОЧ-61, ` +
    `ADR-0167 §4); требование поручителю расписания не несёт и обязательства не порождает (ADR-0164)`);

  const cal = win.VIEWS.calendar.fn();
  ok(147, has(cal, 'норма считает лиц (п. 9), охват считает договоры') &&
        has(cal, 'лиц: 0 из 2') && has(cal, 'договоров'),
    `расхождение печатается в клетке охвата, а не прячется: «2 из 3 договоров · лиц: 0 из 2»`);
})();

/* ---------- AA. Бумага внутрь организации (волна 12, ADR-0168) ---------- */
(() => {
  RP.seed(); as('clerk');
  const m = RP.issue('t-memo-dpo', { params:{ obj:'kr-2' }, kind:'окончательный' });
  const rec = RP.ISS(m.id);
  const legal = RP.orgUnits().find(u => u.id === 'dep-legal');
  ok(148, m.ok && rec.recipient.kind === 'подразделение' && rec.recipient.ref === 'dep-legal' &&
        rec.recipient.name === 'Департамент правового обеспечения' && rec.recipient.role === null &&
        rec.recipient.viaObject === 'kr-2' && rec.number === 'СЗ-2026/001' && rec.snapshot &&
        legal && legal.credits === false && RP.depts().every(d => d.id !== 'dep-legal'),
    `получатель бывает не лицом: служебная записка ушла ПОДРАЗДЕЛЕНИЮ ссылкой (${rec.recipient.ref}), ` +
    `номер ${rec.number} потрачен и числа заморожены — «внутрь» не значит «не выпуск» (ADR-0157 §1, ` +
    `ADR-0168 §1). ДПО кредитов не ведёт и в область видимости не входит (ИО-29)`);

  /* Одна редакция — разные адресаты: получатель вычисляется от объекта.
     Выпустить её в макете некому: круг записки — ДПО, а роли ДПО нет (ОЧ-63). */
  const b1 = RP.blankRecipient('t-memo-back', 'kr-2');
  const b2 = RP.blankRecipient('t-memo-back', 'kr-6');
  const noPrint = RP.issue('t-memo-back', { params:{ obj:'kr-2' }, kind:'окончательный' });
  ok(149, b1.ok && b2.ok && b1.text === b2.text && b1.rec.ref === 'dep-prom' &&
        b2.rec.ref === 'rep-osh' && b1.rec.byObject && b2.rec.byObject &&
        !noPrint.ok && has(noPrint.why, 'не в круге подразделения'),
    `«подразделение объекта» — адресат разный у каждой бумаги при ОДНОЙ редакции («${b1.text}»): ` +
    `по ${b1.rec.viaNo} это «${b1.rec.name}», по ${b2.rec.viaNo} — «${b2.rec.name}» (ADR-0168 §2). ` +
    `Кто её печатает — вопрос к заказчику: круг у записки ДПО, а такой роли в макете нет (ОЧ-63)`);

  const ch = RP.issue('t-memo-chair', { params:{ obj:'kr-4' }, kind:'окончательный' });
  const rc = RP.ISS(ch.id);
  ok(150, ch.ok && rc.recipient.kind === 'должность' && rc.recipient.ref === 'p-chair' &&
        rc.recipient.name === 'Председатель Правления',
    `получатель — ДОЛЖНОСТЬ, а не человек: председатель сменится, адресат останется; имени того, ` +
    `кто её занимал, отчётность не хранит — это вопрос оргструктуры (ADR-0168 §3)`);
})();

(() => {
  RP.seed(); as('auth');
  const t = RP.TPL('t-memo-dpo'); const ed = t.editions[t.editions.length - 1];
  const keep = ed.addressee; ed.state = 'черновик';
  ed.addressee = {kind:'подразделение', unit:'dep-hr'};
  const noUnit = RP.publishChecks('t-memo-dpo').find(c => c.check === 'адресат бланка');
  ed.addressee = {kind:'канцелярия'};
  const noKind = RP.publishChecks('t-memo-dpo').find(c => c.check === 'адресат бланка');
  ed.addressee = keep; ed.state = 'опубликована';
  ok(151, !!noUnit && has(noUnit.why, 'в оргструктуре нет') && has(noUnit.why, 'не пополняет') &&
        !!noKind && has(noKind.why, 'вида получателя «канцелярия» не бывает'),
    `проверяются оба: ВИД объявляет редакция, ЗНАЧЕНИЕ ведёт сосед — подразделения «dep-hr» в ` +
    `оргструктуре нет, вида «канцелярия» не бывает (ИО-2, ИО-29, ADR-0168 §1)`);
})();

(() => {
  RP.seed(); as('clerk');
  /* Залогодатель бывает третьим лицом: у КД-2025/126 заложило имущество КФХ
     «Жайыл», а должник — «Ош-Текстиль»; у КД-2024/203 обе роли на одном лице. */
  const p1 = RP.issue('t-pledge', { params:{ obj:'kr-6' }, kind:'окончательный' });
  const p2 = RP.issue('t-pledge', { params:{ obj:'kr-2' }, kind:'окончательный' });
  const none = RP.issue('t-pledge', { params:{ obj:'kr-1' }, kind:'окончательный' });
  const r1 = RP.ISS(p1.id), r2 = RP.ISS(p2.id);
  ok(152, p1.ok && r1.recipient.ref === 'su-7' && r1.recipient.role === 'залогодатель' &&
        p2.ok && r2.recipient.ref === 'su-2' && r2.recipient.role === 'залогодатель' &&
        !none.ok && has(none.why, 'роли «залогодатель»'),
    `третья роль ядра работает как первые две: извещение по ${r1.recipient.viaNo} ушло ` +
    `${r1.recipient.name} (не заёмщику), по ${r2.recipient.viaNo} — тому же лицу в двух ролях; ` +
    `у КД-2024/117 залогодателя нет — отказ по имени роли (ADR-0167 §2)`);
})();

(() => {
  RP.seed(); as('clerk');
  RP.issue('t-notice',   { params:{ obj:'kr-4' }, kind:'окончательный' });
  RP.issue('t-memo-dpo', { params:{ obj:'kr-4' }, kind:'окончательный' });
  const bySubj = RP.callSeamOut('классификация', 'reportIssues', { subject:'su-4' });
  const byObj  = RP.callSeamOut('карточка объекта (ядро)', 'reportIssues', 'kr-4');
  ok(153, bySubj.ok && bySubj.data.length === 1 && bySubj.data[0].tpl === 'Уведомление о наступающем платеже' &&
        byObj.ok && byObj.data.length === 2 &&
        byObj.data.some(r => r.toKind === 'подразделение'),
    `ключ «лицо» отбирает по ВИДУ получателя: по договору бумаг ${byObj.data.length}, а лицу ` +
    `предъявлена ${bySubj.data.length} — служебная записка ушла подразделению и в историю лица ` +
    `не попадает (ADR-0168 §4)`);
})();

(() => {
  RP.seed(); as('head');
  const sc = RP.showcase();
  const back = sc.must.concat(sc.rest).find(r => r.id === 't-memo-back');
  const gaps = RP.formGaps().map(g => g.id);
  const five = ['ФО-31','ФО-33','ФО-36','ФО-37','ФО-39'];
  ok(154, back && back.access.ok === false && five.every(f => !!RP.formTpl(f)) &&
        gaps.length === 2 && gaps.indexOf('ФО-35') !== -1 && gaps.indexOf('ФО-38') !== -1 &&
        RP.formGaps().every(g => !g.nowhere),
    `пять незаведённых обязательных бланков внесены — норм без шаблона осталось ${gaps.length} ` +
    `(${gaps.join(', ')}), и обе заведены в легаси; возврат материалов пишет ДПО, а такой роли в ` +
    `макете нет — строка приглушена, а не спрятана (ОЧ-63, §14.1)`);
})();

/* ---- U. Корешок несёт срочность: красный счётчик на вкладке (ОЧ-71) ---- */
(() => {
  RP.seed(); as('clerk');
  const before = win.VIEWS.showcase.fn();
  RP.state.today = '2026-09-05';                 /* срок акта сверки — 01.09 */
  const after = win.VIEWS.showcase.fn();
  const late = RP.showcase().must.concat(RP.showcase().rest)
    .filter(r => r.obligation && r.obligation.state === 'просрочено');
  ok(155, !has(before, 'class="burn"') && late.length > 0 &&
        has(after, '<span class="burn">' + late.length + '</span>') &&
        late.every(r => r.tplKind === 'бланк') &&
        after.indexOf('class="burn"') > after.indexOf("scTab','бланк'"),
    `красное число стоит на корешке той вкладки, где горит: пока ничего не просрочено — его нет ` +
    `вовсе, после 01.09 у «Бланков» появляется ${late.length}; открывать вкладку ради проверки ` +
    `не надо, а «ожидается» в красное не красится — иначе на 41 форме гореть будет всё`);
})();

/* ---- отчёт ---- */
const pass = results.filter(r => r.pass).length;
const lines = results.map(r => `   ${r.pass ? 'PASS' : 'FAIL'}  #${r.n}  ${r.note}`);
console.log(`SMOKE 2026-08-26 · ${pass}/${results.length} PASS\n` + lines.join('\n'));

const body = lines.map(l => '  ' + l).join('\n');
const injected = `  SMOKE 2026-08-26 · ${pass}/${results.length} PASS\n` + body;
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
