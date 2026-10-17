// Headless smoke для mockups/reports/reports.html (ИО-1…ИО-26, ADR-0156…0163).
// Zero-dep: вытаскивает <script> из HTML и исполняет логический слой в node:vm (без DOM —
// render() и toast() при отсутствии document становятся no-op, экраны не рисуются).
// Проверяется поведение: объявленность состава, пять отказов публикации, две ступени
// выпуска, снимок и расхождение со сданным, серии и номера, обязательства из правила,
// четыре шва внутрь и три наружу, названные отказы вместо отсутствующих кнопок,
// витрина потребителя и справочник форм (обязательная форма без шаблона — строка без кнопки).
// Волна 36 (блок FF, #200–#210): колонки-даты официальной формы и их замки на сдаче, режим
// времени и фильтр в виде и отчёте, заметки к строке и ячейке, линия динамики.
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
const SC_TABS = ['мои', 'общие', 'отчёт', 'бланк'];
const showTab = t => { RP.state.sel.scTab = t; return win.VIEWS.showcase.fn(); };
const showAll = () => SC_TABS.map(showTab).join('\n');
/* Витрина печатает документ основания без редакции — она одна на все строки. */
const docShort = d => String(d).replace(/\s*\(ред\.[^)]*\)/, '');

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
  ok(2, !pub.ok && has(pub.why, 'утверждает уполномоченный') && has(pub.why, 'ИО-1'),
    `пользователь опубликовать не может: «${pub.why.slice(0, 70)}…»`);

  as('auth');
  const st0 = RP.tplState('t-osh');
  const pub2 = RP.publish('t-osh');
  const st1 = RP.tplState('t-osh');
  ok(3, st0.state === 'черновик' && pub2.ok && st1.state === 'утверждён',
    `состояние шаблона СЧИТАЕТСЯ, а не хранится: «${st0.state}» → «${st1.state}» после публикации`);

  as('auth');
  const iss = RP.issue('t-avg', { params:{}, kind:'предварительный' });
  ok(4, !iss.ok && has(iss.why, 'только утверждённую редакцию'),
    `выпуск личного черновика отклонён: «${iss.why.slice(0, 60)}…»`);
})();

/* ---------- B. Пять отказов публикации, все на публикации (§4, ИО-7) ---------- */
(() => {
  RP.seed();
  as('auth');
  const ref = RP.publishChecks('t-ref');
  const sub = ref.find(c => c.check === 'подстановка');
  const bas = ref.find(c => c.check === 'основание');
  ok(5, sub && has(sub.why, 'в макете ${Кредит.ОстатокОсн}') && has(sub.why, 'такого поля не объявляет'),
    `подстановка не из перечня названа дословно: «${sub ? sub.why : '—'}»`);
  ok(6, bas && has(bas.why, 'сослаться на пункт нормы может только утверждающий'),
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
        !f.ok && has(f.why, 'в официальный') && has(f.why, 'заводится показателем'),
    `«свой запрос» — названный отказ; «своя формула» — названная граница: в официальный не входит (ADR-0281)`);
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

/* ---------- F. Бланк: два замка, подстановки, номер у документооборота ---------- */
(() => {
  RP.seed();
  as('clerk');
  const docs0 = RP.state.docs.length;
  const pre = RP.issue('t-notice', { params:{ obj:'kr-2' }, kind:'предварительный' });
  ok(22, pre.ok && RP.ISS(pre.id).number === null && RP.ISS(pre.id).doc === null &&
        RP.state.docs.length === docs0 && RP.state.templates.every(t => t.series === undefined),
    `серий исходящих у бланков нет, а предварительный выпуск документа не заводит вовсе — ` +
    `перепечатывай сколько нужно`);

  const fin = RP.issue('t-notice', { params:{ obj:'kr-2' }, kind:'окончательный' });
  const f = RP.ISS(fin.id), d = RP.DOC(f.doc);
  ok(23, fin.ok && f.number === null && d && d.kind === 'черновик исходящего' && d.number === null &&
        d.issue === f.id && d.type === 'Уведомление' && d.to === 'ОсОО «Нарын-Агро»' &&
        has(fin.note, 'номер выдаст журнал документооборота') &&
        f.snapshot && f.recipient && f.recipient.name === 'ОсОО «Нарын-Агро»' &&
        f.recipient.ref === 'su-2' && f.recipient.role === 'заёмщик' && f.recipient.viaObject === 'kr-2',
    `окончательный выпуск бланка с внешним получателем стал черновиком исходящего ${d.id} ` +
    `(«${d.type}», ${d.attach}); номера у снимка нет; получатель — ССЫЛКА на лицо ` +
    `(${f.recipient.ref}, роль «${f.recipient.role}»), объект — только дорога к нему`);

  const addr = RP.issue('t-notice', { params:{ obj:'kr-2' }, kind:'окончательный', recipient:'a-mf' });
  ok(24, !addr.ok && has(addr.why, 'справочника адресатов сдачи') &&
        has(addr.why, 'подразделение своего объекта'),
    `бланку адресат сдачи не выбирается: получателя объявляет РЕДАКЦИЯ одним из четырёх видов — ` +
    `«${addr.why.slice(0, 70)}…» (ИО-5, ADR-0168 §1)`);

  const hand = RP.issue('t-claim', { params:{ obj:'kr-6' }, kind:'окончательный', number:'ПР-2026/015' });
  const good = RP.issue('t-claim', { params:{ obj:'kr-6' }, kind:'окончательный' });
  const gd = RP.DOC(RP.ISS(good.id).doc);
  const reg = RP.registerDoc(gd.id), again = RP.registerDoc(gd.id);
  ok(25, !hand.ok && has(hand.why, 'здесь не вводится') && good.ok && reg.ok &&
        RP.DOC(gd.id).number === reg.number && RP.DOC(gd.id).kind === 'исходящий' &&
        RP.issueNumber(good.id) === reg.number && !again.ok,
    `ручной серии нет: номер рукой не вводится, его ставит документооборот при регистрации после ` +
    `подписи (${reg.number}) — выпуск видит его через ссылку на документ`);

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
  /* Закрывает выпуск ОБЪЯВЛЕННОМУ получателю (ADR-0306): сданное Комитету —
     выпуск, но срок перед Минфином он не закрывает.                         */
  as('user');
  const other = RP.issue('t-overdue', { params:{ asOf:'2026-08-01', dept:'dep-prom' },
    kind:'окончательный', recipient:'a-kab' });
  const mid = RP.obligations().find(o => o.id === late[0].id);
  const fin = RP.issue('t-overdue', { params:{ asOf:'2026-08-01', dept:'dep-prom' },
    kind:'окончательный', recipient:'a-mf' });
  as('auth');
  const now = RP.obligations().find(o => o.id === late[0].id);
  ok(39, other.ok && mid.state === 'просрочено' && mid.stray.length === 1 &&
        fin.ok && now.state === 'сдано с опозданием' && now.issue === fin.id && now.toKind === 'адресат сдачи',
    `выпуск Комитету срок не закрыл (${mid.state}, «выпущено другому получателю»), выпуск Минфину закрыл ` +
    `обязательство ${now.id.split('/').slice(2).join('/')} — ИО-12, ADR-0306`);
})();

/* ---------- J. Круг и расписание правятся без новой редакции (§2.1) ---------- */
(() => {
  RP.seed();
  as('auth');
  const t = RP.TPL('t-portfolio');
  const eds = t.editions.length;
  const c = RP.setCircle('t-portfolio', ['dep-prom']);
  const s = RP.setSchedule('t-portfolio', { freq:'ежемесячно', dueDay:15, since:'2026-05-01',
    asOfRule:'первое число месяца, следующего за отчётным', text:'ежемесячно, к 15-му',
    recipients:[{ kind:'адресат сдачи', ref:'a-mf' }] });
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
  ok(42, r.ok && r.broken.length === 10 && r.broken.some(b => b.id === 't-pay04') && has(st.why, 'перечень изменил его владелец (ядро · кредиты)') &&
        st.state === 'неисполним' && !iss.ok && has(iss.why, 'неисполним'),
    `переименование поля в ядре сломало ${r.broken.length} шаблона (${r.broken.map(b => b.id).join(', ')} — ` +
    `и отчёт, и бланк: закон один) и НАЗВАЛО виновника — ADR-0158 §4`);

  RP.seed();
  as('auth');
  const w = RP.withdrawStat('s-overdue-sum');
  ok(43, w.ok && w.breaking.length === 4 && w.breaking.some(b => b.id === 't-pay04') && w.breaking.some(b => b.id === 't-overdue') &&
        w.breaking.some(b => b.id === 't-sh-plan'),
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
  const dRow = card.data[0];
  RP.registerDoc(dRow.doc);
  const card2 = RP.callSeamOut('карточка объекта (ядро)', 'reportIssues', 'kr-2');
  ok(44, card.ok && card.data.length === 1 && dRow.doc && dRow.number === null &&
        has(card2.data[0].number, 'Исх-'),
    `карточка объекта видит зеркалом, что по кредиту уходило наружу: выпуск и документ ${dRow.doc}; ` +
    `номер (${card2.data[0].number}) появляется, когда документооборот его зарегистрирует`);
  ok(45, !rows.ok && has(rows.why, 'число без паспорта не показывается') &&
        !draft.ok && has(draft.why, 'читается как отчёт') &&
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
    `список подстановок нигде не ведётся руками: он выведен разбором \${…} в тексте макета — ` +
    `«${notice.subs.join(', ')}» у уведомления, ${claim.subs.length} у претензии (§8)`);

  const edit = RP.setLayout('t-notice', 'другой текст');
  ok(48, !edit.ok && has(edit.why, 'новая редакция'),
    `текст опубликованного макета не правится на месте: другой текст насовсем — это новая редакция`);

  as('auth');
  const ne = RP.newEdition('t-notice');
  const again = RP.newEdition('t-notice');
  const set = RP.setLayout('t-notice', 'УВЕДОМЛЕНИЕ\n\nКому: ${Заёмщик.ФИО | дат.}\nДоговор ${Кредит.Номер}.');
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
        has(RP.layoutOf('t-notice').text, '${Кредит.ДнейПросрочки}'),
    `поле вставляется из публичного перечня ядра и сразу видно разбору: своих полей у бланка нет (ИО-2)`);

  const rep = RP.setLayout('t-overdue', 'текст');
  const dx = RP.docxNote();
  const bad = RP.layoutOf('t-ref');
  ok(52, !rep.ok && has(rep.why, 'колонки') && !dx.ok && has(dx.why, 'только pdf') &&
        bad.subs.indexOf('Кредит.ОстатокОсн') !== -1,
    `у отчёта макета нет (состав — колонки и показатели); docx остаётся форматом черновика; ` +
    `поле \${Кредит.ОстатокОсн} в справке видно разбором как отсутствующее в перечне`);
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

/* ---------- P. Вход в модуль — четыре шва и ни одного своего запроса ---------- */
(() => {
  RP.seed();
  const seams = RP.seamsIn();
  ok(59, seams.length === 4 && seams.filter(s => s.owner === 'статистика').length === 3 &&
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
  ok(60, bad.length === 0 && names.length === 12,
    `двенадцать экранов × все роли = ${names.length * 5} отрисовок без исключений (${Math.round(total / 1000)} КБ разметки)`);

  as('auth');
  const reg = VIEWS.registry.fn(), cal = VIEWS.calendar.fn(), jr = VIEWS.journal.fn();
  const bl = VIEWS.blank.fn(), wl = VIEWS.worklists.fn(), bo = VIEWS.bounds.fn();
  ok(61, has(reg, 'Не видно этой роли') && has(cal, 'Три кнопки, которых в модуле нет') &&
        has(jr, 'что мы отдали наружу') && has(bl, 'Проверка документом') &&
        has(wl, 'Завести список правилом') && has(bo, 'Чего в макете нет'),
    `отказы и границы проговорены на самих экранах, а не спрятаны за отсутствием кнопки`);
})();

/* ---------- R. Волна 4: итоги уровней, лист выгрузки, выпуск заданием ---------- */
(() => {
  RP.seed(); as('auth');
  const fold = RP.foldLevelsSelf('t-npl');
  ok(62, !fold.ok && fold.parts === 3 && Math.abs(fold.sum - 83.3) < 0.05 && fold.real === 25 &&
        has(fold.why, 'ИО-17') && has(fold.why, 'ИС-24'),
    `число уровня приходит узлом дерева, а не сложением: доли по ${fold.parts} подразделениям в сумме ` +
    `дают ${fold.sum} %, а корень того же дерева равен ${fold.real} % — складывать детей нельзя (ИО-17, ИС-24)`);

  const pv = RP.preview('t-overdue', { asOf: RP.state.sel.params.asOf, dept: null }).data;
  const lvl = pv.levels.map(l => l.name + (l.total ? '+итог' : ''));
  const inner = pv.groups.reduce((a, g) => a + g.children.length, 0);
  const cnt = pv.groups.reduce((a, g) => a + g.count, 0);
  ok(63, pv.levels.length === 2 && lvl[0] === 'подразделение+итог' && lvl[1] === 'состояние кредита' &&
        cnt === pv.rows.length && inner >= 4 &&
        pv.groups.every(g => g.children.every(c => c.rows && c.rows.length)),
    `разрезы печатаются уровнями: ${lvl.join(' → ')}; ${pv.groups.length} группы первого уровня, ` +
    `${inner} второго, строк в группах ${cnt} из ${pv.rows.length}`);

  ok(64, pv.groups.every(g => g.totals && g.totals.length === 2) &&
        pv.groups.every(g => g.children.every(c => c.totals === null)) &&
        pv.groups.every(g => g.totals.every(t => t.seam === 'statSlice (дерево)')),
    `итоговая строка печатается только по объявленному уровню: у подразделения она есть и пришла ` +
    `узлом дерева statSlice, у состояния кредита — нет, потому что редакция её не объявляла`);

  const sh = RP.sheetOf('t-overdue');
  ok(65, sh.orient === 'книжная' && sh.bands.join(' ') === 'заголовок шапка уровни итог подвал' &&
        sh.formats.join('·') === 'xlsx·pdf' &&
        pv.passport.sheet.bands.join(' ') === sh.bands.join(' ') &&
        pv.passport.levels[0] === 'подразделение (с итогом)' && pv.passport.rounding.length === 2,
    `лист выгрузки объявлен редакцией и попадает в паспорт: ${sh.orient}, полосы ` +
    `${sh.bands.join(' → ')}, форматы ${sh.formats.join(' · ')} (ИО-18)`);

  const badOrder = RP.setBands('t-avg', ['заголовок','шапка','итог','уровни','подвал']);
  const lost = RP.setBands('t-avg', ['заголовок','шапка','уровни','подвал']);
  ok(66, !badOrder.ok && has(badOrder.why, 'ОЧ-26') && !lost.ok && has(lost.why, 'итог'),
    `итог перед уровнями отклонён: ${badOrder.why.slice(0, 96)}…`);

  const onPub = RP.setSheet('t-overdue', { orient:'альбомная' });
  as('user');
  const byUser = RP.setSheet('t-avg', { orient:'альбомная' });
  as('auth');
  const onDraft = RP.setSheet('t-avg', { orient:'альбомная' });
  ok(67, !onPub.ok && has(onPub.why, 'НОВАЯ РЕДАКЦИЯ') && !byUser.ok && has(byUser.why, 'ИО-18') &&
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
  ok(68, !fixSheet.ok && has(fixSheet.why, 'ИО-18') && has(fixSheet.why, 'редакцией'),
    `лист у выпуска не правится: печатное представление предъявлено вместе с числами — ` +
    `иначе один и тот же сданный отчёт у двух людей печатается по-разному (ИО-18)`);
  ok(69, xlsx.ok && !csv.ok && has(csv.why, 'не объявляет'),
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
  ok(70, snap.every((s, i) => s.value === now[i].shown && s.dp === 0) && !rc.changed &&
        rounded.length >= 1 && rounded.every(t => t.dp === 0 && t.shown === Math.round(t.value)),
    `в снимок ложится ПОКАЗАННАЯ величина, в объявленной разрядности: доля ` +
    `${String(rounded[0].value).replace('.', ',')} % печатается как ${rounded[0].shown} %, и ` +
    `расхождение сравнивает показанное с показанным, а не ловит шум ниже разрядности (ОЧ-32)`);
  ok(71, fin.kind === 'окончательный' && !finXlsx.ok && has(finXlsx.why, 'ИО-10'),
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
  ok(72, o.ok && o.state === 'заказан' && at0.state === 'заказан' && at0.snapshot === null &&
        at0.passport.ordered === true && at0.passport.seams.length === 0 &&
        at0.passport.edition === 1 && s1.state === 'считается' && s2.state === 'готов' &&
        s2.done && RP.jobStates().join('→') === 'заказан→считается→готов→ошибка',
    `выпуск — заказ, а не нажатие: строка журнала и паспорт заведены в момент заказа (редакция, ` +
    `дата, охват известны), числа — в шаге «считается»; состояния ${RP.jobStates().join(' → ')}`);

  const bad = RP.order('t-overdue', { params:{ asOf:'2025-12-01', dept:null }, kind:'предварительный' });
  RP.step(bad.id);
  const err = RP.step(bad.id);
  const errRow = RP.ISS(bad.id);
  ok(73, bad.ok && !err.ok && err.state === 'ошибка' && has(err.why, 'ИО-6') &&
        errRow.state === 'ошибка' && errRow.snapshot === null && RP.ISS(bad.id) !== undefined,
    `задание кончается СОСТОЯНИЕМ, а не пустотой: снимка на 01.12.2025 нет — ошибка, строка ` +
    `в журнале осталась и говорит почему`);

  as('clerk');
  const before = RP.state.docs.length;
  const ob = RP.order('t-notice', { params:{ obj: RP.objects()[0].id }, kind:'окончательный' });
  const atOrder = RP.state.docs.length;
  RP.step(ob.id); const done = RP.step(ob.id);
  ok(74, ob.ok && atOrder === before && RP.state.docs.length === before + 1 &&
        done.rec.doc && done.rec.number === null && RP.DOC(done.rec.doc).issue === ob.id,
    `черновик исходящего заводится вместе со снимком, а не при заказе: после заказа документов ` +
    `${atOrder}, после «готов» — ${RP.state.docs.length}; документ ссылается на выпуск ${ob.id}`);
})();

(() => {
  RP.seed(); as('auth');
  const colDate = RP.setColumnDate('t-overdue', 'debt_main', '2026-07-01');
  const rule = RP.ruleAsWorklist('крупные', 'остаток > 100 млн');
  ok(75, !colDate.ok && has(colDate.why, 'ИО-19') && has(colDate.why, '§19 п. 6') &&
        !rule.ok && has(rule.why, 'ИО-14') && has(rule.why, '§9'),
    `две привычки легаси названы отказом: дата состояния у ответа одна (ИО-19), а правило отбора — ` +
    `не рабочий список: список это замороженный состав, правило живёт параметром редакции (§9)`);

  const V = win.VIEWS;
  const b = V.builder.fn(), i = V.issue.fn(), bo = V.bounds.fn(), w = V.worklists.fn();
  RP.order('t-overdue', { params:{ asOf: RP.state.sel.params.asOf, dept:null }, kind:'предварительный' });
  const j = V.journal.fn(), i2 = V.issue.fn();
  ok(76, has(b, 'Итоги уровней и лист выгрузки') && has(i, 'Задания на выпуск') &&
        has(i, 'Итог по «') && has(i2, 'Шаг задания') && has(j, 'задание: заказан') &&
        has(bo, 'Отказы, вычитанные из легаси') && has(w, 'Завести список правилом'),
    `волна 4 проговорена на экранах: полосы и итоги уровней в конструкторе и предпросмотре, ` +
    `состояния задания в выпуске и журнале, отказы легаси на границах`);
})();

/* ---------- W. Экран крутится без границ, замок — на сдаче (ОГ-Д2) ---------- */
const DEV = 'изменено — не утверждённый состав';
(() => {
  RP.seed(); as('auth');
  const asOf = RP.state.sel.params.asOf;
  const c = RP.choices('t-overdue');
  const d0 = RP.show('t-overdue', { asOf, dept:null }, null);
  ok(77, c.cuts.join() === 'dept,status,borrower' && c.stats.indexOf('s-npl') === -1 &&
        c.stats.indexOf('s-avg-late') !== -1 && c.base.cuts.join() === 'dept,status' &&
        d0.ok && d0.deviated === false && d0.head.label === 'не выпуск' && d0.head.kind === 'показ' &&
        d0.head.composition.cuts.join(' → ') === 'подразделение → состояние кредита' &&
        RP.bounds === undefined && RP.setFree === undefined,
    `перечня допустимых отклонений нет: показу официального отчёта доступно всё, что доступно ` +
    `отчёту, — разрезы ${c.cutNames.join(' · ')}, ${c.stats.length} живых показателей реестра; ` +
    `утверждённый состав «${d0.head.composition.cuts.join(' → ')}» — точка возврата`);

  const hid = RP.show('t-overdue', { asOf, dept:null }, { cuts:['dept'] });
  ok(78, hid.ok && hid.deviated === true && hid.data.groups.length === 3 &&
        hid.data.groups[0].children === null && hid.head.deviatedLabel === DEV &&
        hid.head.composition.cuts.join() === 'подразделение',
    `снятый разрез — тот же отчёт, накрученный: один уровень (${hid.data.groups.length} группы), ` +
    `шапка показа печатает «${hid.head.deviatedLabel}»`);

  const hidDept = RP.show('t-overdue', { asOf, dept:null }, { cuts:['status'] });
  ok(79, hidDept.ok && hidDept.deviated === true &&
        hidDept.head.composition.cuts.join() === 'состояние кредита',
    `«жёстких» уровней больше нет: и подразделение снимается с экрана — замок стоит на сдаче, а не на показе`);

  const addB = RP.show('t-overdue', { asOf, dept:null }, { cuts:['dept','status','borrower'] });
  const l3 = addB.ok && addB.data.groups[0].children && addB.data.groups[0].children[0].children;
  ok(80, addB.ok && addB.deviated === true && !!l3 && l3.length >= 1 &&
        addB.head.composition.cuts.join(' → ') === 'подразделение → состояние кредита → заёмщик',
    `разрез, которого в составе нет, добавляется на экране без личного черновика: ` +
    `${addB.head.composition.cuts.join(' → ')}`);

  const addS = RP.show('t-overdue', { asOf, dept:null },
    { stats:['s-overdue-sum','s-overdue-cnt','s-portfolio','s-avg-late'] });
  ok(81, addS.ok && addS.deviated === true && addS.data.totals.length === 4 &&
        addS.data.totals[3].id === 's-avg-late' && d0.data.totals.length === 2,
    `любой показатель реестра — на экране: было ${d0.data.totals.length}, стало ` +
    `${addS.data.totals.length}, включая «${addS.data.totals[3].name}», которого редакция не называла`);

  const hidS = RP.show('t-overdue', { asOf, dept:null }, { stats:['s-overdue-sum'] });
  ok(82, hidS.ok && hidS.deviated === true && hidS.data.totals.length === 1,
    `показатель утверждённого состава прячется на экране — показ ничего не тратит`);

  const moon = RP.show('t-overdue', { asOf, dept:null }, { cuts:['dept','moon'] });
  const npl = RP.show('t-overdue', { asOf, dept:null }, { stats:['s-overdue-sum','s-npl'] });
  ok(83, !moon.ok && has(moon.why, 'не разрезает') && !npl.ok && has(npl.why, 'выведен'),
    `отказывает только то, чего нет вовсе: «${moon.why.slice(0, 50)}…», «${npl.why.slice(0, 50)}…»`);
})();

(() => {
  RP.seed(); as('auth');
  const slow = RP.show('t-portfolio', {}, { stats:['s-portfolio','s-avg-late'] });
  ok(84, !slow.ok && has(slow.why, 'налету не берётся'),
    `в режиме «сейчас» отказ — свойство показателя, а не граница редакции: «${slow.why.slice(0, 70)}…»`);

  const mv = RP.show('t-portfolio', {}, { cuts:['status','dept'] });
  ok(85, mv.ok && mv.deviated === true &&
        mv.head.composition.cuts.join(' → ') === 'состояние кредита → подразделение',
    `уровни переставляются: ${mv.head.composition.cuts.join(' → ')} — и показ честно назван накрученным`);

  const noRows = RP.show('t-portfolio', {}, { drill:false });
  const seams = noRows.ok ? noRows.data.passport.seams : [];
  ok(86, noRows.ok && noRows.deviated === true && noRows.data.rows.length === 0 &&
        seams.indexOf('objectRows') === -1 && seams.indexOf('statRows') === -1 &&
        seams.indexOf('statSlice (дерево)') !== -1 &&
        noRows.data.groups[0].count > 0 && noRows.data.passport.shown.drill === false,
    `снятые строки объектов — другой шов, а не спрятанные строки: statRows/objectRows не спрошены ` +
    `вовсе, ответ собран деревом (${seams.join(' · ')})`);

  const noDrill = RP.show('t-overdue', { asOf: RP.state.sel.params.asOf, dept:null }, { drill:false });
  ok(87, noDrill.ok && noDrill.deviated === true && noDrill.data.rows.length === 0,
    `и у официального строки снимаются без объявления — показ свободен целиком`);
})();

(() => {
  RP.seed(); as('auth');
  const asOf = RP.state.sel.params.asOf;
  const lay = RP.show('t-overdue', { asOf, dept:null }, { layout:'показатели в строках' });
  const o = RP.order('t-overdue', { params:{ asOf, dept:null }, kind:'предварительный',
    twist:{ layout:'показатели в строках' } });
  RP.step(o.id); RP.step(o.id);
  const rec = RP.ISS(o.id);
  ok(88, lay.ok && lay.deviated === false && lay.head.composition.layout === 'показатели в строках' &&
        rec.deviated === false && rec.passport.shown.layout === 'показатели в колонках' &&
        RP.layouts().length === 2,
    `раскладка свободна и накруткой не считается — клетки те же, вопрос тот же; в выпуск она ` +
    `не уходит вовсе: лист принадлежит редакции`);
})();

(() => {
  RP.seed(); as('auth');
  const sv = RP.saveView('t-overdue', 'моя просрочка', { cuts:['dept'] });
  const dup = RP.saveView('t-overdue', 'моя просрочка', { cuts:['dept'] });
  const mine = RP.myViews('t-overdue');
  ok(89, sv.ok && has(sv.note, 'передают не его, а выпуск') && mine.length === 1 &&
        mine[0].owner === 'Тентимишев К.' && !dup.ok && has(dup.why, 'уже есть'),
    `сохранённая накрутка — ВИД: имя, владелец, список, удаление; безымянных и одноимённых видов не бывает`);

  const sh = RP.shareView(sv.id, 'Асанов А.');
  const pu = RP.publishView(sv.id);
  ok(90, !sh.ok && has(sh.why, 'передают ВЫПУСК') && has(sh.why, 'личный → общий') &&
        !pu.ok && has(pu.why, 'открывают его кругу'),
    `вид личный: чтобы поделиться, из вида делают свой отчёт, и он идёт путём личный → общий; ` +
    `передают выпуск, у которого есть паспорт`);

  const wide = RP.saveView('t-overdue', 'с заёмщиком', { cuts:['dept','status','borrower'] });
  ok(91, wide.ok && RP.myViews('t-overdue').length === 2,
    `вид держит любую накрутку, в том числе разрез, которого нет в составе: границ, которые он ` +
    `мог бы перейти, больше нет`);

  as('head');
  const alien = RP.applyView(sv.id);
  ok(92, !alien.ok && has(alien.why, 'принадлежит Тентимишев К.') && has(alien.why, 'вид личный'),
    `чужим способом смотреть не пользуются: «${alien.why.slice(0, 70)}…»`);
})();

(() => {
  RP.seed(); as('auth');
  const sv = RP.saveView('t-overdue', 'моя просрочка',
    { cuts:['dept'], stats:['s-overdue-sum','s-overdue-cnt','s-portfolio'] });
  RP.withdrawStat('s-portfolio');
  const ap = RP.applyView(sv.id);
  const gone = ap.dropped.filter(x => has(x, 'больше недоступен в отчёте — убран из вашего вида'));
  ok(93, ap.ok && gone.length === 1 && has(gone[0], 'Остаток основного долга') &&
        ap.twist.stats.join() === 's-overdue-sum,s-overdue-cnt' && ap.twist.cuts.join() === 'dept' &&
        has(ap.note, 'остальное работает'),
    `вид связан с оригиналом: ставшее невозможным отваливается С ПОМЕТКОЙ — «${gone[0]}», ` +
    `остальное работает`);
})();

(() => {
  RP.seed(); as('auth');
  const b = win.VIEWS.builder.fn();
  ok(94, has(b, 'перечня допустимых отклонений нет') && !has(b, 'Допустимые отклонения') &&
        !has(b, 'Разрешить экрану выведенный показатель'),
    `в редакции нечего объявлять про экран: карточка «Показ» говорит, что границ нет и где стоит замок`);
})();

(() => {
  RP.seed(); as('auth');
  const asOf = RP.state.sel.params.asOf;
  const o = RP.order('t-overdue', { params:{ asOf, dept:null }, kind:'предварительный',
    twist:{ cuts:['dept'] } });
  RP.step(o.id); const done = RP.step(o.id);
  const rec = RP.ISS(o.id);
  const ex = RP.exportShown('t-overdue', { asOf, dept:null }, { cuts:['dept'] }, 'xlsx');
  const fin = RP.order('t-overdue', { params:{ asOf, dept:null }, kind:'окончательный',
    recipient:'a-mf', twist:{ cuts:['dept'] } });
  ok(95, o.ok && done.done && rec.deviated === true && rec.passport.deviated === true &&
        rec.passport.shown.cuts.join() === 'подразделение' &&
        rec.passport.shown.stats.length === 2 && rec.kind === 'предварительный' &&
        ex.ok && ex.label === 'НЕ ОФИЦИАЛЬНЫЙ ДОКУМЕНТ · ' + DEV,
    `выгрузка накрутки хранит показанный состав целиком, и файл сам говорит, что он такое: ` +
    `«${ex.label}»`);
  ok(96, !fin.ok && has(fin.why, DEV) && has(fin.why, 'сдаётся только утверждённый состав') &&
        has(fin.why, 'вернуть утверждённый'),
    `накрученное выгружается, но не сдаётся: «${fin.why.slice(0, 90)}…»`);
})();

(() => {
  RP.seed(); as('auth');
  const bl = RP.show('t-notice', { obj: RP.objects()[0].id }, { cuts:['dept'] });
  RP.newEdition('t-portfolio');
  const dr = RP.state.templates.find(t => t.id === 't-portfolio')
    .editions.find(e => e.state === 'черновик');
  dr.free = { cuts:['moon'], stats:['s-npl'], drill:false };
  const ch = RP.publishChecks('t-portfolio');
  ok(97, !bl.ok && has(bl.why, 'бланк не крутится') && ch.length === 0,
    `у бланка крутить нечего — он об одном объекте; а у отчёта утверждение больше не проверяет ` +
    `«допустимых отклонений»: их не объявляют`);

  RP.seed(); as('user');
  const my = RP.show('t-portfolio', {}, { cuts:['dept','status','borrower'] });
  ok(98, my.ok && my.deviated === true && my.head.scope.join() === 'Отраслевой департамент промышленности' &&
        my.data.hidden > 0 && my.data.rows.every(r => r.dept === 'dep-prom'),
    `свобода экрана видимости не расширяет: ${my.data.hidden} строк остались скрыты областью видимости`);

  RP.seed(); as('auth');
  const V = win.VIEWS;
  const i0 = V.issue.fn();
  RP.state.sel.tpl = 't-overdue'; RP.state.sel.twist = { cuts:['dept'], stats:['s-overdue-sum','s-overdue-cnt'],
    drill:true, layout:'показатели в колонках' };
  const i1 = V.issue.fn();
  ok(99, has(i0, 'Как смотреть — всё, что доступно отчёту') && has(i0, 'НЕ ВЫПУСК') &&
        has(i0, 'Мой вид') && !has(i0, 'жёстко') && !has(i0, DEV) &&
        has(i1, DEV) && has(i1, 'Вернуть утверждённый') && has(i1, 'devmark'),
    `экран показа без границ: пока состав утверждённый — пометки нет; накрутили — в шапке ` +
    `«${DEV}» и кнопка «вернуть утверждённый»`);
})();

/* ---------- S. Витрина, справочник форм, право сдачи (волна 6) ----------
   ОЧ-41…ОЧ-49, ИО-23…ИО-26, ADR-0163. Витрина — вход потребителя; реестр
   шаблонов остаётся столом уполномоченного и здесь не проверяется.        */
(() => {
  RP.seed(); as('auth');
  const sc = RP.showcase();
  const all = sc.must.concat(sc.rest);
  const drafts = RP.state.templates.filter(t => !t.editions.some(e => e.state === 'утверждена'));
  ok(100, sc.must.length > 0 && sc.rest.length > 0 && drafts.length > 0 &&
        all.filter(r => r.kind === 'шаблон').length === RP.state.templates.length - drafts.length &&
        !all.some(r => drafts.some(d => d.id === r.id)),
    `витрина — вход потребителя: ${all.length} строк, из них ${all.filter(r => r.kind === 'шаблон').length} ` +
    `опубликованных шаблонов; ${drafts.length} личных черновиков не показано вовсе — спросить можно ` +
    `только объявленное (ОЧ-41, ИО-1)`);

  ok(101, sc.must.every(r => r.obligatory) && sc.rest.every(r => !r.obligatory) &&
        sc.rest.every(r => r.kind === 'шаблон'),
    `группы — по обязательности, а не по объекту: обязательных ${sc.must.length}, остальных ` +
    `${sc.rest.length}; незаведённых НЕобязательных форм в витрине нет вовсе — каталог остаётся ` +
    `предложением, а не договорённостью (ОЧ-42, ADR-0163 §4)`);

  const gaps = RP.formGaps();
  const norms = sc.must.filter(r => r.kind === 'норма');
  const forms = RP.forms();
  ok(102, forms.length === 16 && forms.filter(f => f.obligatory).length === 12 &&
        gaps.length === 2 && gaps.filter(g => g.nowhere).length === 0 &&
        norms.length === gaps.length &&
        norms.every(r => r.state === 'не заведён' && !r.obligation && !r.schedule) &&
        has(norms[0].why, 'выпуск предъявляет редакцию, а редакции нет'),
    `обязательная форма без шаблона видна как НЕИСПОЛНЯЕМАЯ НОРМА: обязательных ` +
    `${forms.filter(f => f.obligatory).length}, шаблон заведён у ${forms.filter(f => f.obligatory).length - gaps.length}, ` +
    `${gaps.length} строк без кнопки, из них ${gaps.filter(g => g.nowhere).length} не заведено нигде — ` +
    `срок по норме идёт независимо от того, завели мы шаблон (ИО-23, ОЧ-40)`);

  const V = win.VIEWS;
  const showH = showAll();
  ok(103, !has(showH, "RP.openForm('" + norms[0].id) &&
        has(showH, 'Завести — ' + RP.formsOwner()) &&
        norms.every(r => r.goTo === RP.formsOwner()) &&
        has(showH, 'не заведён · Завести') && has(showH, 'срока нет') &&
        norms.every(r => has(showH, r.basis.point) && has(showH, docShort(r.basis.doc))),
    `у неисполняемой нормы нет кнопки, но названы основание и тот, к кому идти: «${RP.formsOwner()}» — ` +
    `справочник ведёт тот же, кто публикует редакции; срока у неё нет — он живёт расписанием ` +
    `шаблона (ADR-0163 §5, §7)`);

  const oblBefore = RP.obligations().length;
  ok(104, oblBefore === 12 && !RP.obligations().some(o => gaps.some(g => g.id === o.tpl)) &&
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
  ok(105, !dup.ok && has(dup.why, RP.TPL('t-overdue').name) && has(dup.why, 'ИО-24') &&
        has(dup.why, 'ОЧ-39') && has(dup.why, 'кладётся параметром редакции'),
    `одна форма — не более одного шаблона, и отказ НАЗЫВАЕТ первый вслух: «${dup.why.slice(0, 70)}…» ` +
    `— защита от легаси-копирования устройством, а не дисциплиной (ИО-24)`);
  ok(106, !alien.ok && has(alien.why, 'вид объявляет форма, отчёт или бланк её реализует') &&
        !noform.ok && has(noform.why, 'согласованным перечнем'),
    `вид объявляет форма, а не шаблон; справочник наполняется согласованным перечнем, а не всеми ` +
    `строками каталога — «${noform.why.slice(0, 60)}…»`);

  const rel = RP.linkForm('t-avg', 'ФО-26');
  ok(107, !rel.ok && RP.formTpl('ФО-26').id === 't-portfolio' &&
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
  ok(108, !alien.ok && has(alien.why, 'окончательно выпускает тот, за кем обязательство') &&
        has(alien.why, 'Осмонова Г.') && has(alien.why, 'закрывает срок') && !has(alien.why, 'серии') &&
        has(alien.why, 'смотреть волен всякий в круге'),
    `чужой разрез окончательно не сдаётся: «${alien.why.slice(0, 74)}…» — посмотреть и выгрузить ` +
    `предварительно вправе всякий в круге`);
  ok(109, whole.ok && whole.whole === true && free.ok && free.free === true &&
        has(free.note, 'обязательства нет'),
    `свод по всему кругу сдаёт тот, кто ведёт шаблон (обязательство перед получателем его); ` +
    `где обязательства нет вовсе — окончательно выпускает всякий в круге`);

  const ord = RP.order('t-overdue', { params:{ asOf:'2026-08-01', dept:'dep-prom' },
    kind:'окончательный', recipient:'a-kab' });
  as('user');
  const mine = RP.finalRight('t-overdue', ['dep-prom']);
  const ordMine = RP.order('t-overdue', { params:{ asOf:'2026-08-01', dept:'dep-prom' },
    kind:'окончательный', recipient:'a-kab' });
  ok(110, !ord.ok && has(ord.why, 'за кем обязательство') && mine.ok && has(mine.note, 'обязательство за вами') &&
        ordMine.ok,
    `правило одно на показ и на выпуск: уполномоченному заказ окончательного по чужому разрезу ` +
    `отклонён тем же текстом, а Осмоновой Г. — принят (ИО-25, §13.6)`);

  as('auth');
  const subs = RP.whoSubmits('t-overdue');
  ok(111, subs.length === 3 && subs.every(s => s.who && s.who !== '—') &&
        RP.whoSubmits('t-portfolio') === null,
    `«за кем» названо подразделением, а не ролью: ${subs.map(s => s.who).join('; ')} — иначе сдача ` +
    `встала бы на отпуске; у шаблона без расписания сдающего нет вовсе`);

  as('head');
  const scr = win.VIEWS.issue.fn();
  ok(112, has(scr, 'Сдача — окончательный выпуск') &&
        (has(scr, 'окончательно выпускает тот, за кем обязательство') ||
         has(scr, 'обязательство за вами')),
    `экран выпуска проговаривает право словами, а не гасит кнопку молча: рядом со ступенью стоит ` +
    `либо «обязательство за вами», либо имя того, с кого спросят`);
})();

(() => {
  RP.seed(); as('auth');
  const def = RP.defaultAsOf();
  ok(113, RP.state.sel.params.asOf === def && RP.hasSnapshot(def) &&
        !RP.hasSnapshot('2026-09-01') && def === '2026-08-01',
    `экран открывается на периоде, у которого СНИМОК ЕСТЬ (${def}): иначе умолчание показывало бы ` +
    `числа, которыми нельзя отчитаться, и разница «посмотрел / сдал» размылась бы (ИО-26)`);

  RP.state.sel.params.asOf = '2026-09-01';
  const warn = win.VIEWS.issue.fn();
  ok(114, has(warn, 'За этот период снимка нет') && has(warn, 'ближайшему более раннему') &&
        has(warn, 'обязательство берётся на объявленном периоде'),
    `период без снимка назван вслух: молчаливая подстановка соседней даты — это ответ на другой ` +
    `вопрос под именем заказанного (ИО-26, ОЧ-44)`);

  RP.seed(); as('auth');
  RP.selTpl('t-portfolio');
  const gate = win.VIEWS.issue.fn();
  RP.askLive();
  const live = win.VIEWS.issue.fn();
  ok(115, has(gate, 'Числа не запрошены') && has(gate, 'Посчитать на сейчас') &&
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
  ok(116, ex.ok && RP.state.issues.length === before + 1 && rec.kind === 'предварительный' &&
        rec.passport && has(ex.note, 'выгрузка — это выпуск') && has(ex.note, 'строка остаётся'),
    `выгрузка — не соседняя кнопка, а предварительный выпуск: строка ${ex.id} в журнале, паспорт и ` +
    `показанный состав целиком; файл гаснет через ${RP.FILE_DAYS} дней, строка остаётся (ОЧ-49, ИО-11)`);

  const noName = RP.worklistShown('t-overdue', { asOf: RP.defaultAsOf(), dept:'' }, null, '  ');
  const wl = RP.worklistShown('t-overdue', { asOf: RP.defaultAsOf(), dept:'' }, null,
    'обзвон по просрочке, август');
  ok(117, !noName.ok && has(noName.why, 'список называется при создании') && wl.ok &&
        RP.ISS(wl.issue).kind === 'предварительный' && has(wl.note, 'заморожен паспортом'),
    `рабочий список тоже идёт через выпуск: список по определению замороженный состав, а морозить ` +
    `нечего, пока у ответа нет паспорта — ${wl.id} отобран выпуском ${wl.issue} (ИО-14, ОЧ-49)`);

  const sc = win.VIEWS.issue.fn();
  ok(118, has(sc, 'Что делают с показанным') && has(sc, 'Завести рабочий список') &&
        has(sc, 'из провала') && has(sc, '📌 на дашборд') && has(sc, 'Сохранить вид'),
    `дороги с показанного названы на экране: выгрузить, сдать, сохранить видом, завести рабочий ` +
    `список (из провала или выгрузкой) и «📌 на дашборд» — ссылка, а не своя плитка`);
})();

(() => {
  RP.seed(); as('user');
  const sc = RP.showcase();
  const claim = sc.must.concat(sc.rest).find(r => r.id === 't-claim');
  const last = sc.must[sc.must.length - 1];
  const shut = sc.must.filter(r => !r.access.ok);
  ok(119, claim && claim.access.ok === false && shut.indexOf(last) !== -1 &&
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
  ok(120, stayed === 'showcase' && RP.state.view === 'issue' &&
        has(showTab('бланк'), 'Где печатается'),
    `бланк в витрине — не формирование, а «где печатается»: своего перечня объектов витрина не ` +
    `держит (на трёх записях выпадашка работает, на живых двенадцати тысячах — нет), объект ` +
    `называет карточка или рабочий список (ОЧ-43)`);

  RP.seed(); as('auth');
  const v = RP.saveView('t-overdue', 'моя просрочка', null);
  RP.openViewOf(v.id);
  ok(121, v.ok && RP.state.view === 'issue' && RP.state.sel.view === v.id &&
        RP.state.sel.tpl === 't-overdue' && has(win.VIEWS.showcase.fn(), 'Открыть видом'),
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
        if (!has(html, 'class="tabs') || !(has(html, '<table') || has(html, 'banner')))
          bad.push(role + '/' + t + ': ' + html.length); }
      catch (e) { bad.push(role + '/' + t + ': ' + e.message); } }); });
  as('auth');
  const sh = showAll();
  const marks = (sh.match(/(?:ADR-\d|ОЧ-\d|ИО-\d|ФО-\d\d\s*§|§\s*\d)/g) || []);
  ok(122, bad.length === 0 && marks.length === 0 && !has(sh, 'page-lead') &&
        !has(sh, 'class="facts"'),
    `каждая вкладка рисуется каждой ролью и несёт только рабочее: ни одной ссылки на решение ` +
    `или инвариант, ни вводного абзаца, ни карточки примечаний — экран для потребителя, ` +
    `а доводы живут в каноне`);

  RP.state.sel.scTab = '';
  const first = V.showcase.fn();
  const blanks = RP.showcase().must.concat(RP.showcase().rest).filter(r => r.tplKind === 'бланк');
  ok(123, has(first, '>Мои<') && has(first, '>Общие<') && has(first, '>Официальные<') &&
        has(first, 'Отчёты') && has(first, 'Бланки') &&
        (first.match(/class="on"/g) || []).length === 2 && !has(first, 'Где печатается') &&
        blanks.length > 0 && blanks.every(r => !has(first, "openForm('" + r.id)) &&
        has(showTab('отчёт'), 'Обязательные') && has(showTab('отчёт'), 'По запросу') &&
        has(V.issue.fn(), 'Что делают с показанным') && Object.keys(V)[0] === 'showcase',
    `витрина первым экраном модуля и разложена на три полки — Мои · Общие · Официальные; ` +
    `у официальных вид формы — второй корешок, ${blanks.length} бланков в ленту отчётов не ` +
    `подмешаны, обязательность делит уже внутри вкладки`);

  const rep = showTab('отчёт'), bl = showTab('бланк');
  const tables = s => (String(s).match(/<table/g) || []).length;
  const sects = s => (String(s).match(/class="sect"/g) || []).length;
  ok(151, tables(rep) === 1 && sects(rep) === 2 && tables(bl) === 1 && sects(bl) === 2 &&
        has(bl, 'По запросу <span class="n">· 2</span>') && has(bl, 'Кредитный договор') &&
        has(bl, 'по форме банка-агента') &&
        !has(bl, 'Под отбор не попало') && has(rep, 'Обязательные <span class="n">· 1</span>'),
    `обязательность делит строки ВНУТРИ одной таблицы: одна шапка и разделители групп; у бланков ` +
    `«по запросу» — кредитный договор и форма банка-агента, необязательные по норме, но печатаемые каждый день`);
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

  ok(124, groups.length === 4 &&
        titles.join(' · ') === 'Смотреть и сдавать · Настраивать · След · Границы' &&
        groups.every(g => g.hint.trim().length > 10),
    `навигация разложена на три стола заказчика плюс служебный: ${titles.join(' · ')}; ` +
    `у каждого подписано, чей это стол`);

  const flat = groups.flatMap(g => g.items);
  const uniq = [...new Set(flat)];
  const missing = Object.keys(V).filter(v => flat.indexOf(v) === -1);
  ok(125, flat.length === 12 && uniq.length === 12 && missing.length === 0 &&
        groups.map(g => g.items.length).join('/') === '5/4/1/2' && flat.indexOf('dash') === -1 &&
        groups[0].items.indexOf('subs') !== -1,
    `перегруппировка ничего не потеряла и не задвоила: все 12 экранов ровно по разу, ` +
    `раскладка 5 / 4 / 1 / 2 — «Подписки и сигналы» на столе «Смотреть и сдавать»; экрана «Дашборд» в модуле нет`);

  // Стол «Настраивать» — не право: пользователь собирает там личные черновики (§17).
  const nastr = groups[1].items;
  as('user');
  let drew = true;
  try { nastr.forEach(v => { if (V[v].fn().length < 200) drew = false; }); } catch (e) { drew = false; }
  ok(126, nastr.join(',') === 'registry,draft,builder,blank' && drew &&
        !has(nav, 'locked') && !/data-role|hidden/.test(nav),
    `стол «Настраивать» пользователю НЕ заперт: все четыре его экрана рисуются ролью Осмоновой Г. — ` +
    `иначе личный черновик собирать негде (§17); скрытых по роли пунктов в навигации нет`);

  as('auth');
  ok(127, groups[0].items[0] === 'showcase' && groups[0].items[1] === 'issue' &&
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

  ok(128, keys.every(k => ['freq','dueDay','dueMonth','since','asOfRule','text','recipients'].indexOf(k) !== -1) &&
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
  ok(129, withSch.length === 1 && withSch[0].id === 't-recon' &&
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
  ok(130, obl.length === 3 && obl.every(o => o.asOf === '2026-01-01' && o.due === '2026-09-01') &&
        obl.every(o => o.period === 'состояние на 01.01.2026') &&
        obl.every(o => o.state === 'ожидается') && obl.every(o => o.cover),
    `у бланка с календарным сроком обязательство ЕСТЬ и порождается тем же правилом: ${obl.length} ` +
    `строки на состояние 01.01.2026 со сроком до 01.09.2026 — «${RP.TPL('t-recon').schedule.asOfRule}»`);

  /* Знаменатель — снимок, а не живой перечень: kr-5 закрыт 14.08.2026, но на 1
     января действовал (акт с ним обязаны), kr-7 выдан в 2026 и в знаменатель
     не попал, хотя в живом перечне подразделения стоит.                       */
  const live = RP.objects().filter(o => o.dept === 'dep-prom');
  const needProm = prom.cover.missing.map(m => m.id).sort().join(',');
  ok(131, prom.cover.need === 2 && needProm === 'kr-1,kr-2' && live.length === 3 &&
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
  ok(132, show.ok && show.data.passport.seams.join() === 'statRows' &&
        show.data.passport.asOf === '2026-01-01' && jan.value === 9600000 &&
        now.value === 7400000 && RP.show('t-notice', { obj:'kr-1' }).data.passport.seams.join() === 'objectRows',
    `бланк «на дату» читает снимок статистики, а не живое ядро: остаток в акте на 01.01.2026 — ` +
    `${jan.value / 1000000} млн, в уведомлении «сейчас» — ${now.value / 1000000} млн; швы разные ` +
    `(statRows против objectRows), закон общий`);

  const noDate = RP.order('t-recon', { params:{ obj:'kr-1' }, kind:'окончательный' });
  const early = RP.order('t-recon', { params:{ obj:'kr-7', asOf:'2026-01-01' }, kind:'окончательный' });
  ok(133, !noDate.ok && has(noDate.why, 'без даты состояния печатать нечего') &&
        !early.ok && has(early.why, 'заведён позже даты состояния'),
    `два отказа названы словами: бланк «на дату» без даты состояния не печатается, а объект, ` +
    `которого на эту дату ещё не было, в акт не попадает вовсе — «${early.why.slice(0, 52)}…»`);

  const one = RP.issue('t-recon', { params:{ obj:'kr-1', asOf:'2026-01-01' }, kind:'окончательный' });
  const half = RP.obligations().find(o => o.id === prom.id);
  const two = RP.issue('t-recon', { params:{ obj:'kr-2', asOf:'2026-01-01' }, kind:'окончательный' });
  const full = RP.obligations().find(o => o.id === prom.id);
  ok(134, one.ok && half.cover.got === 1 && half.state === 'ожидается' &&
        half.cover.missing[0].id === 'kr-2' && two.ok && full.cover.got === 2 &&
        full.state === 'сдано' && full.issues.length === 2 &&
        RP.ISS(one.id).recipient.viaObject && RP.DOC(RP.ISS(one.id).doc).type === 'Акт сверки' &&
        RP.DOC(RP.ISS(one.id).doc).kind === 'черновик исходящего',
    `обязательство с полным охватом закрывает не бумага, а ВСЕ бумаги: после первого акта ` +
    `${half.cover.got} из ${half.cover.need} и «${half.state}» с поимённым остатком, после второго — ` +
    `«${full.state}»; получатель у каждого свой заёмщик, у каждого акта — свой черновик исходящего`);

  const signed = RP.markSigned(prom.id);
  ok(135, !signed.ok && has(signed.why, 'событие контрагента, а не выпуск') &&
        has(signed.why, 'ОЧ-59') && has(RP.markDelivered(prom.id).why, 'ИО-12'),
    `«отметить подписанным» — такой же названный отказ, как «отметить сданным»: обязательство ` +
    `меряется тем, что модуль ПРОИЗВОДИТ, а подпись заёмщика ведёт сопровождение на объекте (ОЧ-59)`);

  /* Подставленный снимок мягко валит акт в предварительный: на подпись бумага
     с чужой датой состояния не уходит.                                       */
  const sub = RP.issue('t-recon', { params:{ obj:'kr-1', asOf:'2026-08-10' }, kind:'окончательный' });
  const rec = RP.ISS(sub.id);
  ok(136, sub.ok && rec.kind === 'предварительный' && rec.recipient === null &&
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
  ok(137, g.ok && rec.recipient.ref === 'su-8' && rec.recipient.role === 'поручитель' &&
        rec.recipient.viaObject === 'kr-6' && sub.indexOf('borrower') !== -1,
    `подстановка — не получатель: в теле требования печатается {{borrower}} («ОсОО «Ош-Текстиль»», ` +
    `о ком речь), а бумага уходит ${rec.recipient.name} — ${rec.recipient.ref}, роль ` +
    `«${rec.recipient.role}» (ADR-0167 §3)`);

  const none = RP.issue('t-guar', { params:{ obj:'kr-1' }, kind:'окончательный' });
  ok(138, !none.ok && has(none.why, 'такого лица нет: получателя назвать некем') &&
        has(none.why, 'Роль объявляет редакция'),
    `роли нет — отказ по имени, а не пустая строка в бумаге: «${none.why.slice(0, 80)}…» (ИО-28)`);

  RP.seed(); as('auth');
  const t = RP.TPL('t-recon'); const ed = t.editions[t.editions.length - 1];
  const keep = ed.addressee; ed.addressee = null; ed.state = 'черновик';
  const bad = RP.publishChecks('t-recon').find(c => c.check === 'адресат бланка');
  ed.addressee = keep;
  ok(139, !!bad && has(bad.why, 'вид адресата — часть вопроса, а не настройка минуты'),
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
  ok(140, byObj.ok && byObj.data.length === 1 && bySubj.ok && bySubj.key === 'лицо' &&
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
  ok(141, adm.cover.need === 3 && adm.cover.needSubj === 2 &&
        prom.cover.need === 2 && prom.cover.needSubj === 2 && guarHasNoSchedule,
    `знаменатель нормы и знаменатель охвата — разные величины, и это сказано вслух: у ` +
    `администрирования ${adm.cover.need} договора, но ${adm.cover.needSubj} лица (КД-2025/088 и ` +
    `КД-2024/259 — один заёмщик). Счёт по договорам строже, раньше нормы не закроется (ОЧ-61, ` +
    `ADR-0167 §4); требование поручителю расписания не несёт и обязательства не порождает (ADR-0164)`);

  const cal = win.VIEWS.calendar.fn();
  ok(142, has(cal, 'норма считает лиц (п. 9), охват считает договоры') &&
        has(cal, 'лиц: 0 из 2') && has(cal, 'договоров'),
    `расхождение печатается в клетке охвата, а не прячется: «2 из 3 договоров · лиц: 0 из 2»`);
})();

/* ---------- AA. Бумага внутрь организации (волна 12, ADR-0168) ---------- */
(() => {
  RP.seed(); as('clerk');
  const m = RP.issue('t-memo-dpo', { params:{ obj:'kr-2' }, kind:'окончательный' });
  const rec = RP.ISS(m.id);
  const legal = RP.orgUnits().find(u => u.id === 'dep-legal');
  ok(143, m.ok && rec.recipient.kind === 'подразделение' && rec.recipient.ref === 'dep-legal' &&
        rec.recipient.name === 'Департамент правового обеспечения' && rec.recipient.role === null &&
        rec.recipient.viaObject === 'kr-2' && rec.number === null &&
        RP.DOC(rec.doc).kind === 'черновик внутреннего документа' && rec.snapshot &&
        legal && legal.credits === false && RP.depts().every(d => d.id !== 'dep-legal'),
    `получатель бывает не лицом: служебная записка ушла ПОДРАЗДЕЛЕНИЮ ссылкой (${rec.recipient.ref}), ` +
    `числа заморожены, в документообороте — черновик внутреннего документа, а не исходящего: ` +
    `«внутрь» не значит «не выпуск». ДПО кредитов не ведёт и в область видимости не входит`);

  /* Одна редакция — разные адресаты: получатель вычисляется от объекта.
     Выпустить её в макете некому: круг записки — ДПО, а роли ДПО нет (ОЧ-63). */
  const b1 = RP.blankRecipient('t-memo-back', 'kr-2');
  const b2 = RP.blankRecipient('t-memo-back', 'kr-6');
  const noPrint = RP.issue('t-memo-back', { params:{ obj:'kr-2' }, kind:'окончательный' });
  ok(144, b1.ok && b2.ok && b1.text === b2.text && b1.rec.ref === 'dep-prom' &&
        b2.rec.ref === 'rep-osh' && b1.rec.byObject && b2.rec.byObject &&
        !noPrint.ok && has(noPrint.why, 'не в круге подразделения'),
    `«подразделение объекта» — адресат разный у каждой бумаги при ОДНОЙ редакции («${b1.text}»): ` +
    `по ${b1.rec.viaNo} это «${b1.rec.name}», по ${b2.rec.viaNo} — «${b2.rec.name}» (ADR-0168 §2). ` +
    `Кто её печатает — вопрос к заказчику: круг у записки ДПО, а такой роли в макете нет (ОЧ-63)`);

  const ch = RP.issue('t-memo-chair', { params:{ obj:'kr-4' }, kind:'окончательный' });
  const rc = RP.ISS(ch.id);
  ok(145, ch.ok && rc.recipient.kind === 'должность' && rc.recipient.ref === 'p-chair' &&
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
  ed.addressee = keep; ed.state = 'утверждена';
  ok(146, !!noUnit && has(noUnit.why, 'в оргструктуре нет') && has(noUnit.why, 'не пополняет') &&
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
  ok(147, p1.ok && r1.recipient.ref === 'su-7' && r1.recipient.role === 'залогодатель' &&
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
  ok(148, bySubj.ok && bySubj.data.length === 1 && bySubj.data[0].tpl === 'Уведомление о наступающем платеже' &&
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
  ok(149, back && back.access.ok === false && five.every(f => !!RP.formTpl(f)) &&
        gaps.length === 2 && gaps.indexOf('ФО-35') !== -1 && gaps.indexOf('ФО-38') !== -1 &&
        RP.formGaps().every(g => !g.nowhere),
    `пять незаведённых обязательных бланков внесены — норм без шаблона осталось ${gaps.length} ` +
    `(${gaps.join(', ')}), и обе заведены в легаси; возврат материалов пишет ДПО, а такой роли в ` +
    `макете нет — строка приглушена, а не спрятана (ОЧ-63, §14.1)`);
})();

/* ---- U. Корешок несёт срочность: красный счётчик на вкладке (ОЧ-75) ---- */
(() => {
  RP.seed(); as('clerk');
  const before = win.VIEWS.showcase.fn();
  RP.state.today = '2026-09-05';                 /* срок акта сверки — 01.09 */
  const after = win.VIEWS.showcase.fn();
  const late = RP.showcase().must.concat(RP.showcase().rest)
    .filter(r => r.obligation && r.obligation.state === 'просрочено');
  ok(150, !has(before, 'class="burn"') && late.length > 0 &&
        has(after, '<span class="burn">' + late.length + '</span>') &&
        late.every(r => r.tplKind === 'бланк') &&
        after.indexOf('class="burn"') > after.indexOf("scTab','бланк'"),
    `красное число стоит на корешке той вкладки, где горит: пока ничего не просрочено — его нет ` +
    `вовсе, после 01.09 у «Бланков» появляется ${late.length}; открывать вкладку ради проверки ` +
    `не надо, а «ожидается» в красное не красится — иначе на 41 форме гореть будет всё`);
})();

/* ---- V. В строке витрины остаётся только то, что различает формы (ОЧ-76) ---- */
(() => {
  RP.seed(); as('clerk');
  const bl = showTab('бланк');
  const docs = (bl.match(/Порядок №41/g) || []).length;
  const wasLate = has(bl, 'class="late"');
  RP.state.today = '2026-09-05';                 /* срок акта сверки — 01.09 */
  const bl2 = showTab('бланк');
  ok(152, docs === 1 && has(bl, 'class="th-sub">Порядок №41') &&
        !has(bl, 'ред. 06.07.2026') && !has(bl, ' · бланк') &&
        !wasLate && (bl2.match(/class="late"/g) || []).length === 1 &&
        has(bl2, 'class="burn"'),
    `строка не повторяет то, что одинаково у всех: документ основания назван один раз в шапке ` +
    `столбца (в теле его нет), редакции в строке нет вовсе — она одна на витрину, вид формы стал ` +
    `корешком вкладки; просроченная строка помечена полосой на срезе, и полоса со счётчиком ` +
    `корешка появляются вместе`);
})();

/* ---- X. Дашборд — свой модуль: в отчётности только «📌 на дашборд» (ОГ-28, ОД-1) ---- */
(() => {
  RP.seed(); as('auth');
  const gone = ['addTile','addExternalTile','dashPassport','dashTiles','resetDash','dashPersonal',
    'tileData','declaredTiles','removeTile'].filter(k => RP[k] !== undefined);
  const V = win.VIEWS;
  ok(153, gone.length === 0 && V.dash === undefined && !has(src, 'data-v="dash"') &&
        !has(src, 'function scDash') && !has(src, 'DASH_ROLE') && !has(src, 'KB.toDashboard'),
    `экрана «Дашборд» в модуле нет: ни пункта меню, ни раскладки плиток, ни паспорта дашборда — ` +
    `раскладки, виды показа и светофор живут в модуле дашборда`);

  const asOf = RP.state.sel.params.asOf;
  const pin = RP.pinToDashboard('t-overdue', null, { asOf, dept:'' });
  const sv = RP.saveView('t-overdue', 'просрочка по департаментам', { cuts:['dept'] });
  const pinV = RP.pinToDashboard('t-overdue', sv.id, { asOf });
  const pinB = RP.pinToDashboard('t-notice', null, {});
  RP.state.sel.tpl = 't-overdue';
  const scr = V.issue.fn();
  ok(154, pin.ok && pin.ref.tpl === 't-overdue' && pin.ref.view === null &&
        has(pin.note, 'плитка ссылается на этот отчёт') && has(pin.note, 'раскладка — в модуле дашборда') &&
        pinV.ok && pinV.ref.view === sv.id && has(pinV.note, 'этот вид') &&
        !pinB.ok && has(pinB.why, 'отчёт или вид') && has(scr, '📌 на дашборд'),
    `«📌 на дашборд» — у экрана показа и у вида — только ссылка: «${pin.note}»; бланк на ` +
    `дашборд не ставится — он об одном объекте`);
})();

/* ---- Y. Провал из числа → рабочий список с отметками (ОГ-Д4) ---- */
(() => {
  RP.seed(); as('auth');
  const p = { asOf:'2026-08-01', dept:null };
  const tot = RP.show('t-overdue', p, null).data.totals.find(x => x.id === 's-overdue-sum');
  const d = RP.drill('t-overdue', p, null, { path:[], stat:'s-overdue-sum' });
  const all = RP.show('t-overdue', p, null).data.rows.length;
  ok(155, d.ok && d.cell === tot.value && d.sum === d.cell && d.equal === true &&
        d.items.length === 2 && d.items.length < all && d.items.every(x => x.part > 0) &&
        d.asOf === '2026-08-01',
    `провал из итога «${d.statName}» = ${d.cell}: ${d.items.length} кредита с ненулевым вкладом ` +
    `из ${all} строк отчёта, сумма списка ${d.sum} равна числу — та же дата, тот же снимок`);

  const nd = RP.drill('t-overdue', p, null, { path:[{ by:'dept', key:'rep-osh' }], stat:'s-overdue-cnt' });
  const grp = RP.show('t-overdue', p, null).data.groups.find(g => g.key === 'rep-osh');
  const cellCnt = grp.totals.find(x => x.id === 's-overdue-cnt').value;
  const avg = RP.drill('t-overdue', p, { stats:['s-overdue-sum','s-overdue-cnt','s-avg-late'] },
    { path:[{ by:'dept', key:'dep-prom' }], stat:'s-avg-late' });
  const hidden = RP.drill('t-overdue', p, null, { path:[], stat:'s-portfolio' });
  ok(156, nd.ok && nd.cell === cellCnt && nd.sum === cellCnt && nd.node === 'Региональное представительство «Ош»' &&
        avg.ok && avg.additive === false && avg.sum === null && avg.items.length === 3 &&
        !hidden.ok && has(hidden.why, 'в показе нет'),
    `провал из подытога уровня даёт объекты узла (${nd.node}: ${nd.items.length}); у средней ` +
    `суммы нет — список объектов узла; в число, которого не видно, не проваливаются`);

  const node = { path:[], stat:'s-overdue-sum' };
  const noName = RP.worklistFromDrill('t-overdue', p, null, node, '');
  const wl = RP.worklistFromDrill('t-overdue', p, null, node, 'Обзвон по просрочке, август');
  const w = RP.WL(wl.id);
  ok(157, !noName.ok && wl.ok && w.from === 'провал' && w.objects.length === d.items.length &&
        w.objects.every(id => d.items.some(x => x.id === id)) && has(w.fromName, 'на 01.08.2026') &&
        RP.worklistProgress(wl.id).done === 0 && RP.worklistProgress(wl.id).total === 2,
    `рабочий список заводится из провала: ${w.objects.length} объекта провала, состав заморожен; ` +
    `безымянного списка нет; прогресс начинается с «0 из ${w.objects.length}»`);

  const m1 = RP.markWorked(wl.id, w.objects[0], 'дозвонились, обещал до 05.09');
  const alien = RP.markWorked(wl.id, 'kr-1', '');
  const pr = RP.worklistProgress(wl.id);
  const mk = RP.WL(wl.id).marks[w.objects[0]];
  const scr = win.VIEWS.worklists.fn();
  RP.closeWorklist(wl.id, 'обзвон окончен');
  const late = RP.markWorked(wl.id, w.objects[1], '');
  ok(158, m1.ok && has(m1.note, '1 из 2') && pr.done === 1 && pr.total === 2 &&
        mk.by === 'Тентимишев К.' && mk.at === RP.state.today && has(mk.comment, 'обещал') &&
        !alien.ok && has(alien.why, 'заморожен') && !late.ok && has(late.why, 'закрыт') &&
        has(scr, '1 из 2') && has(scr, '✓ отработан') && has(scr, 'провалом'),
    `отметка «отработан» — с автором, датой и комментарием; над списком «${pr.done} из ${pr.total}»; ` +
    `чужой объект не отмечается, закрытый список отметок не принимает`);

  RP.seed(); as('auth');
  RP.state.sel.tpl = 't-overdue';
  const scr2 = win.VIEWS.issue.fn();
  const links = (scr2.match(/class="drill"/g) || []).length;
  RP.uiDrill(0);
  const withPanel = win.VIEWS.issue.fn();
  ok(159, links >= 4 && RP.state.sel.drillRes && RP.state.sel.drillRes.ok &&
        has(withPanel, 'Провал:') && has(withPanel, 'равна числу') &&
        has(withPanel, 'Завести рабочий список'),
    `на экране каждое число итога — ссылка (${links}); щелчок открывает провал с суммой списка ` +
    `и кнопкой «Завести рабочий список» прямо в нём`);
})();

/* ---- Z. Витрина: три полки, поиск по составу, «похожий уже есть» (ОГ-Д5) ---- */
(() => {
  RP.seed(); as('user');
  const sh = RP.shelves('');
  const mineIds = sh.mine.map(r => r.id).sort().join();
  const shIds = sh.shared.map(r => r.id).join();
  RP.state.sel.scTab = '';
  const first = win.VIEWS.showcase.fn();
  ok(160, mineIds === 't-avg,t-npl,t-osh' && shIds === 't-sh-plan,t-sh-big' &&
        sh.shared[0].users >= sh.shared[1].users && has(first, 'Открыть кругу') &&
        has(first, 'class="on"') && has(first, 'личный отчёт'),
    `полки: «Мои» — ${sh.mine.length} личных отчёта автора, «Общие» — ${sh.shared.length} ` +
    `(в т. ч. открытый Осмоновой поимённо), популярные сверху; витрина открывается на «Моих»`);

  as('head');
  const headSh = RP.shelves('').shared.map(r => r.id).join();
  as('user');
  const shTab = showTab('общие');
  RP.TPL('t-sh-big').share.people = [];          /* владелец убрал Осмонову из круга */
  const userSh = RP.shelves('').shared.map(r => r.id).join();
  ok(161, headSh === 't-sh-plan,t-sh-big' && userSh === 't-sh-plan' &&
        has(shTab, 'общий, не официальный') && has(shTab, 'соавторы: Асанов А.') && has(shTab, 'версия 3'),
    `круг общего называет владелец — подразделения и/или люди: «Крупные кредиты» Осмонова видела ` +
    `поимённо, вне своего подразделения, и перестала видеть, когда владелец убрал её из круга; ` +
    `строка несёт владельца, соавторов и версию`);

  as('auth');
  const byName = RP.shelves('правления').shared.map(r => r.id);
  as('head');
  const byCompo = RP.shelves('заёмщик').shared.map(r => r.id);
  const byStat = RP.shelves('остаток основного').shared.map(r => r.id).sort().join();
  RP.state.sel.scQ = 'сумма просроченной';
  const off = showTab('отчёт');
  RP.state.sel.scQ = '';
  ok(162, byName.join() === 't-sh-big' && byCompo.length === 2 && byStat === 't-sh-big,t-sh-plan' &&
        has(off, 'Просроченная задолженность') && !has(off, 'Портфель — оперативный срез'),
    `поиск ищет и по составу: «заёмщик» находит ${byCompo.length} отчёта по реквизиту, ` +
    `«сумма просроченной» — официальную форму по показателю, а «Портфель» отсеян`);

  as('user');
  const sim = RP.similarTo('t-osh');
  const tryOpen = RP.openToCircle('t-osh');
  const alien = RP.openToCircle('t-sh-big');
  const before = RP.levelOf('t-osh');
  const forced = RP.openToCircle('t-osh', { force:true });
  const t = RP.TPL('t-osh');
  ok(163, sim.length >= 1 && sim[0].id === 't-sh-plan' && !tryOpen.ok && tryOpen.hint &&
        has(tryOpen.why, 'похожий уже есть') && has(tryOpen.why, 'свой вид') &&
        !alien.ok && has(alien.why, 'автор') && before === 'личный' &&
        forced.ok && RP.levelOf('t-osh') === 'общий' && t.circle.join() === 'dep-prom' &&
        RP.shelves('').shared.some(r => r.id === 't-osh'),
    `при открытии кругу — подсказка «${tryOpen.why.slice(0, 60)}…»; подсказка, а не запрет: ` +
    `«всё равно открыть» делает отчёт общим, и он переезжает на полку «Общие»`);

  RP.seed(); as('user');
  RP.state.sel.scTab = 'мои';
  RP.uiOpenToCircle('t-osh');
  const hintScr = win.VIEWS.showcase.fn();
  const sp = RP.order('t-sh-plan', { params:{ asOf:'2026-08-01' }, kind:'предварительный' });
  const sf = RP.order('t-sh-plan', { params:{ asOf:'2026-08-01' }, kind:'окончательный', recipient:'a-mf' });
  ok(164, has(hintScr, 'Похожий уже есть') && has(hintScr, 'Свой вид поверх него') &&
        has(hintScr, 'Всё равно открыть кругу') && sp.ok && !sf.ok && has(sf.why, 'не официальный'),
    `на витрине подсказка — тремя кнопками: открыть похожий, свой вид поверх него, всё равно ` +
    `открыть; общий отчёт выгружается, но не сдаётся — «${sf.why.slice(0, 60)}…»`);
})();

/* ---- BB. Бланки: ${…} русскими именами, верстальщик «скачать → загрузить → проверить» ---- */
(() => {
  RP.seed(); as('clerk');
  const bad = RP.parseLayout('Кому: ${Заёмщик.ФИО | вин}\nДоговор {{no}}\n${Повтор: каждый Платёж}\n' +
    '${Если: сумма > 1000}\n${Конец условия}', 'credit');
  const why = n => (bad.errors.find(e => e.line === n) || {}).why || '';
  const legacy = RP.state.templates.filter(t => t.editions.some(e => /\{\{/.test(e.layoutText || '')));
  const good = RP.checkLayout('t-contract');
  ok(165, has(why(1), 'вид значения «вин» неизвестен') && has(why(2), 'запись {{no}} не принимается') &&
        has(why(4), 'не из списка') && has(why(5), 'без начала условия') &&
        bad.errors.some(e => has(e.why, 'повтор не закрыт')) && legacy.length === 0 &&
        good.errors.length === 0 && good.fields.join() === 'no,issued,borrower,sum,guarantor' &&
        good.conds.join() === 'есть Поручитель',
    `синтаксис один — \${…} русским именем: ${bad.errors.length} ошибки с местом (вид значения не из ` +
    `набора, старая запись {{…}}, условие не из списка, незакрытый повтор); ни в одном бланке {{…}} не осталось`);

  const dl = RP.downloadLayout('t-notice');
  const up = RP.uploadLayout('t-notice', 'УВЕДОМЛЕНИЕ\nКому: {{borrower}}\nДоговор ${Кредит.Номер}');
  const t = RP.TPL('t-notice');
  const send1 = RP.sendForApproval('t-notice');
  const up2 = RP.uploadLayout('t-notice', 'УВЕДОМЛЕНИЕ\nКому: ${Заёмщик.ФИО | дат.}\nДоговор ${Кредит.Номер}');
  const send2 = RP.sendForApproval('t-notice');
  ok(166, dl.ok && has(dl.note, 'Word или LibreOffice') && up.ok && up.errors === 1 &&
        has(up.note, 'работа сохранена') && RP.draftEd('t-notice').n === 2 && RP.pubEd('t-notice').n === 1 &&
        !send1.ok && has(send1.why, 'стр. 2') && up2.ok && up2.errors === 0 && send2.ok && t.asked === true,
    `файл ходит «скачать → поправить → загрузить»: загрузка с ошибкой легла черновиком ред. 2 ` +
    `(прежняя печатается), ошибка закрыла только отправку на утверждение — «${send1.why.slice(0, 60)}…»`);

  const pal = RP.palette('t-contract', '', 'kr-6');
  const roles = pal.map(g => g.role);
  const guar = pal.find(g => g.role === 'Поручитель').items[0];
  const found = RP.palette('t-contract', 'сумма', 'kr-6');
  const cp = RP.copyToken('Кредит.Сумма', 'число и прописью');
  ok(167, roles.join() === 'Кредит,Заёмщик,Поручитель,Платёж — в повторе,Строка графика — в повторе' && guar.ru === 'Поручитель.ФИО' &&
        guar.example === 'Асанов Т. К.' && found.every(g => g.items.every(x => has(x.ru.toLowerCase() + x.name.toLowerCase(), 'сумма'))) &&
        found.length === 3 && cp.ok && cp.token === '${Кредит.Сумма | число и прописью}',
    `палитра полей — по ролям (${roles.join(' · ')}), с примером значения на живом объекте ` +
    `(«${guar.example}») и поиском; «копировать» отдаёт готовую метку ${cp.token}`);

  RP.state.view = 'blank'; RP.state.sel.blank = 't-contract';
  RP.state.sel.blankObj = 'kr-6'; RP.state.sel.blankVals = true;
  const withG = win.VIEWS.blank.fn();
  RP.state.sel.blankObj = 'kr-2';
  const noG = win.VIEWS.blank.fn();
  RP.state.sel.blankVals = false;
  const names = win.VIEWS.blank.fn();
  RP.state.sel.blank = 't-recon'; RP.state.sel.blankVals = true; RP.state.sel.blankObj = 'kr-2';
  const recon = win.VIEWS.blank.fn();
  ok(168, has(withG, 'выполнено, раздел войдёт') && has(withG, '>Асанова Т. К.</span>') &&
        has(withG, 'шесть миллионов двести тысяч') && has(withG, '«01» июля 2025 г.') && has(withG, 'lcheck sample') &&
        has(noG, 'не выполнено, раздела не будет') && has(names, '${Поручитель.ФИО | род.}') &&
        !has(names, 'lcheck sample') && has(recon, 'повтор · каждый платёж · строк 4') &&
        has(recon, 'Ошибок нет'),
    `проверка — документ: поля подсвечены, вид значения применён («Асанова Т. К.», сумма прописью, ` +
    `дата словами), условие о поручителе выполнено у КД-2025/126 и не выполнено у КД-2024/203, ` +
    `повтор акта сверки дал 4 строки платежей; на примерах — «ОБРАЗЕЦ», переключатель «имена / значения»`);

  RP.seed(); as('clerk');
  const c = RP.issue('t-contract', { params:{ obj:'kr-6' }, kind:'окончательный' });
  const n = RP.issue('t-notice', { params:{ obj:'kr-6' }, kind:'окончательный' });
  as('auth'); RP.state.sel.regTab = 'бланк';
  const reg = win.VIEWS.registry.fn();
  ok(169, c.ok && c.rec.number === 'КД-2025/126' && c.rec.doc === null && has(c.note, 'реквизит кредита') &&
        n.ok && n.rec.number === null && RP.DOC(n.rec.doc).kind === 'черновик исходящего' &&
        has(reg, 'реквизит кредита — номер договора') && has(reg, 'номер при регистрации после подписи') &&
        !has(src, 'series') && !/серия «|ручная серия|Серия и номер/.test(src),
    `у договора номер — реквизит кредита (${c.rec.number}), в журналы документооборота он не идёт; ` +
    `у уведомления — черновик исходящего без номера; серий исходящих в макете нет`);

  RP.seed(); as('auth');
  RP.newEdition('t-claim');
  RP.state.templates.find(x => x.id === 't-claim').editions.find(e => e.state === 'черновик')
    .layoutText = 'ПРЕТЕНЗИЯ\nКому: ${Заёмщик.ФИО | вин}\n${Если: есть Поручитель}\nтекст';
  const ch = RP.publishChecks('t-claim').filter(x => x.check === 'проверка макета');
  ok(170, ch.length === 2 && ch.some(x => has(x.why, 'стр. 2')) && ch.some(x => has(x.why, 'условие не закрыто')) &&
        !RP.publish('t-claim').ok,
    `утверждение повторяет проверку документом: ошибка с местом («${ch[0].why.slice(0, 50)}…») ` +
    `не пускает редакцию в печать`);
})();

/* ---- CC. Получатель сдачи — «вид + значение»; повтор в режиме бланка (ADR-0305, волна 34) ---- */
(() => {
  RP.seed(); as('auth');
  const P = { params:{ asOf:'2026-08-01', dept:'' }, kind:'окончательный' };
  const out = RP.issue('t-overdue', { ...P, recipient:'a-mf' });
  const unit = RP.issue('t-overdue', { ...P, recipient:'unit:dep-legal' });
  const post = RP.issue('t-overdue', { ...P, recipient:'post:p-chair' });
  const d = r => r.ok && r.rec.doc ? RP.DOC(r.rec.doc) : {};
  ok(171, out.ok && d(out).kind === 'черновик исходящего' && out.rec.recipient.kind === 'адресат сдачи' &&
        unit.ok && d(unit).kind === 'черновик внутреннего документа' && unit.rec.recipient.kind === 'подразделение' &&
        d(unit).to === 'Департамент правового обеспечения' &&
        post.ok && d(post).kind === 'черновик внутреннего документа' && post.rec.recipient.name === 'Председатель Правления',
    `документ сдачи решает ВИД получателя: Минфину — ${d(out).kind}, ДПО — ${d(unit).kind}, ` +
    `председателю правления — ${d(post).kind}; признака «внешний / внутренний» у адресата нет (ОГ-Д8, ADR-0305 п. 2)`);

  const asAddr = RP.issue('t-overdue', { ...P, recipient:'dep-legal' });
  const reg = RP.registerDoc(unit.rec.doc);
  const addrs = RP.addressees();
  RP.state.view = 'issue'; RP.state.sel.tpl = 't-overdue'; RP.state.sel.kind = 'окончательный';
  RP.state.sel.recipient = 'unit:dep-legal';
  const scr = win.VIEWS.issue ? win.VIEWS.issue.fn() : '';
  ok(172, !asAddr.ok && has(asAddr.why, 'справочник адресатов держит только внешние') &&
        addrs.every(a => !/^(dep|rep)-/.test(a.id)) && reg.ok && /^ВН-/.test(reg.number) &&
        (!scr || (has(scr, 'Адресат сдачи — внешняя организация') && has(scr, 'Подразделение (оргструктура)') &&
                  has(scr, 'черновиком внутреннего документа'))),
    `подразделение адресатом сдачи не называется — «${asAddr.why.slice(0, 70)}…»; справочник адресатов — только ` +
    `внешние (${addrs.length}); внутренняя сдача регистрируется журналом внутренних (${reg.number})`);

  RP.seed(); as('auth');
  const at = RP.show('t-recon', { obj:'kr-2', asOf:'2026-01-01' }, null);
  const rp = at.data && at.data.repeats ? at.data.repeats[0] : { rows:[] };
  const live = SEAM.objectRows('payment', { of:'kr-2' }, RP.viewer().scope.slice()).rows;
  const pm3 = rp.rows.find(x => x.id === 'pm-3') || {};
  ok(173, rp.seam === 'statRows' && rp.asOf === '2026-01-01' && rp.rows.length === 4 && pm3.amount === 500000 &&
        !rp.rows.some(x => x.id === 'pm-8') && live.length === 5 && live.find(x => x.id === 'pm-3').amount === 550000 &&
        at.data.passport.repeats[0].seam === 'statRows',
    `акт сверки на 01.01.2026 — тело из того же снимка, что шапка: ${rp.rows.length} строки statRows, pm-3 — ` +
    `${pm3.amount} (исправлен 10.02 на 550 000 — в акт не попадает), pm-8 от 15.03.2026 в снимке нет; ` +
    `живое ядро даёт ${live.length} строк (ОГ-Д9, ADR-0305 п. 3)`);

  as('user');                                    // за обязательством по dep-prom — Осмонова Г.
  const fin = RP.issue('t-recon', { params:{ obj:'kr-2', asOf:'2026-01-01' }, kind:'окончательный' });
  const snapRep = fin.ok && fin.rec.snapshot && fin.rec.snapshot.repeats ? fin.rec.snapshot.repeats[0] : null;
  const now = RP.show('t-notice', { obj:'kr-2' }, null);
  ok(174, fin.ok && snapRep && snapRep.seam === 'statRows' && snapRep.rows.length === 4 &&
        now.data && now.data.repeats.length === 0 && now.data.passport.seams.join() === 'objectRows',
    `в снимок выпуска ложится тело повтора тем же швом (${snapRep ? snapRep.seam + ', строк ' + snapRep.rows.length : '—'}); ` +
    `бланк «сейчас» без повтора спрашивает только objectRows`);

  const txt = 'АКТ\n${Повтор: каждая СтрокаГрафика}\n${СтрокаГрафика.Дата} ${СтрокаГрафика.Сумма}\n${Конец повтора}';
  const onDate = RP.parseLayout(txt, 'credit', 'на дату');
  const nowP = RP.parseLayout(txt, 'credit', 'сейчас');
  as('auth'); RP.newEdition('t-recon');
  RP.state.templates.find(x => x.id === 't-recon').editions.find(e => e.state === 'черновик').layoutText = txt;
  const chk = RP.publishChecks('t-recon').filter(x => x.check === 'проверка макета');
  const pal = RP.palette('t-recon', '', 'kr-2').map(g => g.role);
  ok(175, onDate.errors.length === 1 && has(onDate.errors[0].why, 'строки графика на дату не хранятся') &&
        nowP.errors.length === 0 && chk.length === 1 && !RP.publish('t-recon').ok &&
        pal.indexOf('Платёж — в повторе') !== -1 && pal.indexOf('Строка графика — в повторе') === -1,
    `повтор по строке графика у бланка «на дату» — ошибка проверки макета: «${(onDate.errors[0] || {}).why}»; ` +
    `у бланка «сейчас» тот же текст чист; палитра бланка «на дату» строк графика не предлагает (ADR-0305 п. 4)`);

  const sch = SEAM.statRows('schedule', '2026-01-01', { of:'kr-2' }, RP.viewer().scope.slice());
  ok(176, !/cut\.before/.test(src) && sch.rows.length === 0 && has(sch.refused, 'на дату статистика не хранит'),
    `отбора живых платежей датой больше нет: повтор «на дату» читает строки статистики, а не режет живой ` +
    `ответ; строк графика на дату статистика не отдаёт — «${sch.refused}»`);
})();

/* ---- DD. Пачка, утверждение по сравнению, PDF-форма (ИО-38, ADR-0225, ADR-0297, волна 34) ---- */
(() => {
  RP.seed(); as('auth');
  const n0 = RP.state.issues.length;
  const b = RP.batch('t-guar', { objs:['kr-1', 'kr-2', 'kr-3', 'kr-6'], kind:'окончательный' });
  const pick = RP.journalPick(b.trail);
  ok(177, b.ok && b.issued.length === 1 && b.refused.length === 3 && b.refused.every(x => /^КД-/.test(x.no) && has(x.why, 'поручитель')) &&
        b.docs.length === 1 && RP.state.issues.length === n0 + 1 && pick.indexOf(b.issued[0]) !== -1 &&
        !('batches' in RP.state) && has(b.note, 'след пачки — отбор журнала'),
    `пачка — способ заказа: 4 кредита дали ${b.issued.length} обычный выпуск с черновиком документооборота, ` +
    `не вышли поимённо ${b.refused.map(x => x.no).join(', ')} (нет лица в роли «поручитель»); своей записи у пачки нет — ` +
    `её след в журнале отбором (ИО-38)`);

  RP.seed(); as('user');
  RP.state.worklists.push({ id:'РС-9', name:'обзвон', from:'провал', at:'2026-10-17', by:'Осмонова Г.', dept:null,
    state:'открыт', objects:['kr-1', 'kr-2', 'kr-3', 'kr-6'], marks:{} });
  const bu = RP.batch('t-notice', { worklist:'РС-9', kind:'предварительный' });
  const brep = RP.batch('t-overdue', { objs:['kr-1'] });
  const bnone = RP.batch('t-notice', {});
  ok(178, bu.ok && bu.issued.length === 2 && bu.hidden === 2 && has(bu.note, 'вне области видимости — 2') &&
        bu.docs.length === 0 && !brep.ok && has(brep.why, 'пачкой заказываются бланки') && !bnone.ok,
    `прав пачка не добавляет: по списку из 4 вышло ${bu.issued.length}, невидимые названы числом (${bu.hidden}); ` +
    `предварительная пачка документов не заводит; отчёт пачкой не заказывается`);

  RP.seed(); as('clerk');
  RP.uploadLayout('t-notice', 'УВЕДОМЛЕНИЕ\nКому: ${Заёмщик.ФИО | дат.}\nДоговор ${Кредит.Номер}\n${Если: есть Поручитель}\nПоручитель: ${Поручитель.ФИО}\n${Конец условия}');
  const cmp = RP.compareEditions('t-notice');
  RP.state.view = 'blank'; RP.state.sel.blank = 't-notice';
  const scr = win.VIEWS.blank.fn();
  ok(179, cmp.ok && cmp.was === 1 && cmp.now === 2 && cmp.changed > 0 && cmp.lines.some(x => x.op === '+') &&
        cmp.conds.added.join() === 'есть Поручитель' && cmp.fields.added.indexOf('Поручитель.ФИО') !== -1 &&
        cmp.paper.length > 0 && cmp.paper[0].before !== cmp.paper[0].after &&
        has(scr, 'Сравнение: ред. 1 → ред. 2') && has(scr, 'Бумага «до и после»'),
    `утверждение по сравнению: ред. 1 → 2 — изменённых строк ${cmp.changed}, условия +${cmp.conds.added.join()}, ` +
    `поля +${cmp.fields.added.join(', ')}; бумага «до и после» на тех же примерах (ADR-0297 п. 13)`);

  RP.seed(); as('clerk');
  const f2 = RP.pdfFill('t-bankform', 'kr-2'), f6 = RP.pdfFill('t-bankform', 'kr-6');
  const fin = RP.issue('t-bankform', { params:{ obj:'kr-2' }, kind:'окончательный' });
  ok(180, f2.ok && f2.continuation === 2 && f2.inForm === 3 && f2.pages === 2 && f2.baked &&
        f2.fields.find(x => x.name === 'chkGuarantee').value === '☐' && f6.fields.find(x => x.name === 'chkGuarantee').value === '☒' &&
        f2.fields.find(x => x.name === 'BankNote').how === 'оставлено пустым' &&
        has(f2.fields.find(x => x.name === 'DebtAmount').value, 'пять миллионов сто тысяч') &&
        fin.ok && fin.rec.pdf && fin.rec.pdf.pages === 2 && fin.rec.pdf.continuation === 2 &&
        RP.state.issues.filter(i => i.tpl === 't-bankform').length === 1,
    `PDF-форма заполняется своим кодом: поля запечены, флажок — условием (☐ у КД-2024/203, ☒ у КД-2025/126), ` +
    `«оставить пустым» — явный выбор; 5 платежей — 3 в форме и 2 на листе продолжения того же PDF: один выпуск (ADR-0297 п. 7–8)`);

  const t = RP.TPL('t-bankform');
  t.editions[0].pdfForm.overflow = 'отказать';
  const refuse = RP.issue('t-bankform', { params:{ obj:'kr-2' }, kind:'предварительный' });
  t.editions[0].pdfForm.overflow = 'лист продолжения';
  const up = RP.uploadPdfForm('t-bankform', 'bank-agent-confirm-v2.pdf', ['BorrowerName','ContractNo','DebtSum','chkGuarantee','BankNote','PayRow1']);
  const send = RP.sendForApproval('t-bankform');
  as('auth'); const pc = RP.publishChecks('t-bankform').filter(x => x.check === 'проверка макета');
  const cmp2 = RP.compareEditions('t-bankform');
  ok(181, !refuse.ok && has(refuse.why, 'лист продолжения эта форма не принимает') &&
        up.ok && up.carried === 5 && up.lost.join() === 'DebtAmount' && up.fresh.join() === 'DebtSum' &&
        !send.ok && has(send.why, 'сопоставление формы') && pc.length === 2 && !RP.publish('t-bankform').ok &&
        cmp2.pdf && cmp2.mapping.removed.some(x => has(x, 'DebtAmount')) && cmp2.mapping.added.some(x => has(x, 'DebtSum')),
    `форма с признаком «отказать» отклоняет переполнение с причиной; новая версия формы перенесла сопоставление ` +
    `по именам (${up.carried} из 6), не совпавшее — ошибка проверки, утверждение закрыто; сравнение показывает ` +
    `изменения сопоставления (ADR-0297 п. 6, 13)`);

  RP.seed(); as('clerk');
  RP.state.view = 'blank'; RP.state.sel.blank = 't-bankform'; RP.state.sel.blankObj = 'kr-2';
  const pscr = win.VIEWS.blank.fn();
  ok(182, has(pscr, 'мимо движка') && has(pscr, 'Страница формы') && has(pscr, 'на листе продолжения') &&
        has(pscr, 'оставить пустым') && !has(pscr, 'Проверка документом'),
    `экран PDF-формы — картинка страницы с полями, сопоставление и заполнение на примере, а не проверка docx`);
})();

/* ---- EE. Своя формула по уровням и вид отличиями (ИО-46, ИО-43, ОГ-Д3, волна 34) ---- */
(() => {
  RP.seed(); as('buh');
  const F = { name:'Доля просрочки', a:'s-overdue-sum', op:'÷', b:'s-portfolio', k:100, unit:'%', dp:1 };
  const add = RP.addFormula('t-sh-plan', F);
  const r = RP.show('t-sh-plan', { asOf:'2026-08-01', dept:'' }, null);
  const tot = r.data.totals.find(x => x.own);
  const lv = r.data.groups.map(g => ({ g, f: g.totals.find(x => x.own),
    a: g.totals.find(x => x.id === 's-overdue-sum').value, b: g.totals.find(x => x.id === 's-portfolio').value }));
  const avg = lv.reduce((s, x) => s + x.f.value, 0) / lv.length, sum = lv.reduce((s, x) => s + x.f.value, 0);
  ok(183, add.ok && tot && tot.shown === 16.1 && lv.length === 3 &&
        lv.every(x => Math.abs(x.f.value - (x.b ? x.a / x.b * 100 : 0)) < 1e-9) &&
        Math.abs(avg - tot.value) > 1 && Math.abs(sum - tot.value) > 1 &&
        has(r.data.passport.formulas[0], 'своя формула') && RP.TPL('t-sh-plan').editions.slice(-1)[0].changed.indexOf('своя формула') !== -1,
    `своя формула считается на каждом уровне заново из величин уровня: итог ${tot && tot.shown} % = ` +
    `10,3 млн ÷ 64,1 млн, а не среднее уровней (${avg.toFixed(1)}) и не их сумма (${sum.toFixed(1)}); помечена и в паспорте (ИО-46)`);

  as('auth');
  const off = RP.addFormula('t-overdue', F);
  const sh = RP.show('t-overdue', { asOf:'2026-08-01', dept:'' }, { formulas:[ Object.assign({ id:'ф-9' }, F) ] });
  const fin = RP.issue('t-overdue', { params:{ asOf:'2026-08-01', dept:'' }, kind:'окончательный', recipient:'a-mf',
    twist:{ formulas:[ Object.assign({ id:'ф-9' }, F) ] } });
  RP.newEdition('t-overdue');
  RP.state.templates.find(x => x.id === 't-overdue').editions.find(e => e.state === 'черновик').formulas = [ Object.assign({ id:'ф-8' }, F) ];
  const pc = RP.publishChecks('t-overdue').filter(x => x.check === 'своя формула');
  const bad = RP.show('t-overdue', { asOf:'2026-08-01', dept:'' }, { formulas:[ { id:'ф-7', name:'x', a:'s-overdue-sum', op:'^', b:'s-portfolio' } ] });
  ok(184, !off.ok && has(off.why, 'в официальный отчёт не входит') && sh.ok && sh.deviated &&
        sh.data.totals.some(x => x.own) && (!fin.ok || fin.rec.kind === 'предварительный') &&
        pc.length === 1 && !RP.publish('t-overdue').ok && !bad.ok && has(bad.why, 'не из списка'),
    `в официальный отчёт своя формула не входит: в редакцию — отказ с путём «показатель реестра или производная ` +
    `колонка», на экране — накрутка «изменено», в сдачу не идёт; действия — только + − × ÷`);

  RP.seed(); as('auth');
  const sv = RP.saveView('t-overdue', 'без состояния', { cuts:['dept'] });
  const vw = RP.state.views.find(x => x.id === sv.id);
  const d = RP.viewDiff(sv.id);
  RP.newEdition('t-overdue');
  const dr = RP.state.templates.find(x => x.id === 't-overdue').editions.find(e => e.state === 'черновик');
  dr.stats = dr.stats.concat(['s-portfolio']); dr.dp = Object.assign({}, dr.dp, { 's-portfolio':0 });
  const pub = RP.publish('t-overdue');
  const ap = RP.applyView(sv.id);
  ok(185, sv.ok && !('twist' in vw) && d.dropCuts.join() === 'status' && d.addCuts.length === 0 &&
        d.addStats.length === 0 && d.dropStats.length === 0 && pub.ok &&
        ap.ok && ap.twist.stats.indexOf('s-portfolio') !== -1 && ap.twist.cuts.join() === 'dept' && ap.dropped.length === 0,
    `вид хранит только отличия (${JSON.stringify(d)}) и связан с оригиналом: владелец добавил показатель — ` +
    `он пришёл в вид сам, снятый разрез остался снятым (ИО-43)`);

  RP.seed(); as('auth');
  const tw = { cuts:['dept','status'], formulas:[ Object.assign({ id:'ф-5' }, F) ] };
  const sv2 = RP.saveView('t-overdue', 'с долей', tw);
  RP.withdrawStat('s-portfolio');
  const ap2 = RP.applyView(sv2.id);
  ok(186, sv2.ok && RP.viewDiff(sv2.id).addFormulas.length === 1 && ap2.ok &&
        ap2.dropped.some(x => has(x, 'своя формула «Доля просрочки» больше не считается')) && ap2.twist.formulas.length === 0,
    `своя формула живёт в виде отличием; показатель под ней выведен — формула отваливается с пометкой, остальное работает`);
})();

/* ---- DD. Обязательство несёт получателя из расписания (ADR-0306, ОГ-Д10, волна 35) ---- */
(() => {
  RP.seed(); as('auth');
  const P = { params:{ asOf:'2026-08-01', dept:'' }, kind:'окончательный' };
  const before = RP.obligations().filter(o => o.tpl === 't-overdue' && o.asOf === '2026-08-01' && o.state === 'просрочено');
  const legal = RP.issue('t-overdue', { ...P, recipient:'unit:dep-legal' });
  const after = before.map(o => RP.obligations().find(x => x.id === o.id));
  const seam = RP.reportObligations(before[0].dept).find(x => x.key === before[0].id);
  ok(187, before.length === 2 && legal.ok && after.every(o => o.state === 'просрочено' && o.stray.length === 1 &&
        o.stray[0].kind === 'подразделение') &&
        seam && /\/a-mf$/.test(seam.key) && seam.to === 'Министерство финансов Кыргызской Республики' &&
        seam.state === 'просрочено' && seam.stray.length === 1,
    `сдача формы в ДПО (служебная записка) больше не закрывает обязательство перед Минфином: ` +
    `${after.length} июльских остались «просрочено» с пометкой «выпущено другому получателю»; ключ шва — ${seam && seam.key} (ОГ-Д10)`);

  const no = RP.setSchedule('t-overdue', Object.assign({}, RP.TPL('t-overdue').schedule, { recipients:[] }));
  const subjBad = RP.setSchedule('t-overdue', Object.assign({}, RP.TPL('t-overdue').schedule,
    { recipients:[{ kind:'субъект объекта', role:'заёмщик' }] }));
  const asAddr = RP.setSchedule('t-overdue', Object.assign({}, RP.TPL('t-overdue').schedule,
    { recipients:[{ kind:'адресат сдачи', ref:'dep-legal' }] }));
  ok(188, !no.ok && has(no.why, 'расписание объявляет получателя') &&
        !subjBad.ok && has(subjBad.why, 'у бланка с полнотой по объектам') &&
        !asAddr.ok && has(asAddr.why, 'справочник адресатов держит только внешние') &&
        RP.scheduleRecipients('t-recon')[0].kind === 'субъект объекта',
    `расписание без получателя не принимается; «субъект объекта» — только у бланка с полнотой по объектам; ` +
    `подразделение адресатом сдачи не объявляется (ADR-0306 п. 1–2)`);

  RP.seed(); as('auth');
  const n0 = RP.obligations().filter(o => o.tpl === 't-overdue').length;
  const two = RP.setSchedule('t-overdue', Object.assign({}, RP.TPL('t-overdue').schedule,
    { recipients:[{ kind:'адресат сдачи', ref:'a-mf' }, { kind:'подразделение', ref:'dep-legal' }] }));
  const all = RP.obligations().filter(o => o.tpl === 't-overdue');
  const may = all.filter(o => o.period === 'май 2026');
  RP.issue('t-overdue', { params:{ asOf:'2026-06-01', dept:'' }, kind:'окончательный', recipient:'unit:dep-legal', at:'2026-06-20' });
  const may2 = RP.obligations().filter(o => o.tpl === 't-overdue' && o.period === 'май 2026');
  const byTo = to => may2.filter(o => o.to === to);
  ok(189, two.ok && all.length === 2 * n0 &&
        may.filter(o => o.to === 'a-mf').every(o => o.state === 'сдано') &&
        may.filter(o => o.to === 'unit:dep-legal').every(o => o.state === 'просрочено') &&
        byTo('unit:dep-legal').every(o => o.state === 'сдано с опозданием') && byTo('a-mf').every(o => o.state === 'сдано') &&
        byTo('a-mf').every(o => o.stray.length === 0),
    `два получателя к одному сроку — два обязательства (${n0} → ${all.length}): майская сдача Минфину ` +
    `закрыла своё, перед ДПО срок висел, пока не ушла служебная записка 20.06 (ADR-0306 п. 4)`);
})();

/* ---- EE. Гибкость показа: режимы времени, фильтр, график, подписки, заметки (ОГ-Д6, волна 35) ---- */
(() => {
  RP.seed(); as('auth');
  const P = { asOf:'2026-08-01', dept:'' };
  const cmp = RP.timeAnswer('t-overdue', { mode:'сравнение', a:'2026-06-01', b:'2026-08-01' }, P);
  const mid = RP.timeAnswer('t-overdue', { mode:'сравнение', a:'2026-06-15', b:'2026-08-01' }, P);
  const sum = cmp.ok && cmp.rows.find(r => r.id === 's-overdue-sum');
  ok(190, cmp.ok && sum.a === 5400000 && sum.b === 10300000 && sum.abs === 4900000 && sum.pct === 90.7 &&
        cmp.passport.dates.join() === '2026-06-01,2026-08-01' && !cmp.issuable.ok && has(cmp.issuable.why, 'колонок-дат нет') &&
        !mid.ok && has(mid.why, 'ближайшие 01.06.2026 и 01.07.2026'),
    `сравнение двух дат: просрочка 5 400 000 → 10 300 000 (+90,7 %), паспорт перечисляет обе даты; дата внутри ` +
    `закрытого месяца — честный отказ с ближайшими снимками; сдать сравнение нельзя — колонок-дат в форме нет (ОГ-6, ОГ-35)`);

  const dyn = RP.timeAnswer('t-overdue', { mode:'динамика', from:'2026-01-01', to:'2026-08-01' }, P);
  const long = RP.timeAnswer('t-overdue', { mode:'динамика', from:'2023-01-01', to:'2026-08-01' }, P);
  const q = RP.timeAnswer('t-overdue', { mode:'динамика', from:'2023-01-01', to:'2026-08-01', step:'квартал' }, P);
  const pts = dyn.ok ? dyn.tracks[0].points : [];
  ok(191, dyn.ok && pts.length === 8 && pts[6].value === 10800000 && pts[1].gap === 'снимка нет' &&
        dyn.passport.seam === 'statSeries' && !long.ok && has(long.why, 'длиннее 36') && q.ok && q.dates.length === 15,
    `динамика — ряд statSeries по месяцам (8 точек, июль — 10 800 000, без снимка — «снимка нет», а не ноль); ` +
    `44 месяца — отказ «длиннее 36», по кварталам — ${q.ok ? q.dates.length : '?'} точек (ОГ-6)`);

  const stock = RP.timeAnswer('t-overdue', { mode:'за период', from:'2026-01-01', to:'2026-08-01' }, P);
  const turn = RP.timeAnswer('t-overdue', { mode:'за период', from:'2026-01-01', to:'2026-08-01', turnover:true }, P);
  ok(192, !stock.ok && has(stock.why, 'остаток: за период он не складывается') &&
        turn.ok && turn.rows[0].value === 400000 && turn.lines.map(l => l.id).join() === 'pm-8' &&
        turn.passport.seam === 'statRows (платёж)',
    `«за период» — обороты событий: остаток за период не складывается (отказ с путём «сравнение»), платежи ` +
    `01.01–01.08.2026 — 400 000 сом из снимка статистики (pm-8)`);

  const orF = { groups:[[{ field:'days', op:'больше', value:30 }], [{ field:'dept', op:'равно', value:'rep-osh' }]] };
  const or = RP.filterAnswer('t-overdue', P, orF);
  ok(193, or.ok && or.matched === 2 && or.from === 8 && or.data.rows.map(r => r.no).sort().join() === 'КД-2025/014,КД-2025/126' &&
        or.data.totals.find(x => x.id === 's-overdue-sum').value === 5000000 &&
        has(or.data.passport.filter, 'ИЛИ Подразделение равно Региональное представительство «Ош»') &&
        or.executedBy === 'статистика (группы)',
    `группы «ИЛИ» из «И»: «${or.filter}» — отобрано ${or.matched} из ${or.from}; итог после отбора пришёл швом ` +
    `(5 000 000), фильтр напечатан в паспорте (ОГ-9, ADR-0289)`);

  const top = RP.filterAnswer('t-overdue', P, { top:{ n:3, by:'debt_main' } });
  const badOp = RP.filterAnswer('t-overdue', P, { groups:[[{ field:'borrower', op:'больше', value:3 }]] });
  const nest = RP.filterAnswer('t-overdue', P, { groups:[[[{ field:'days', op:'больше', value:3 }]]] });
  const frm = RP.filterAnswer('t-overdue', P, { formula:{ id:'ф-ф', name:'Доля просрочки', a:'s-overdue-sum', op:'÷',
    b:'s-portfolio', k:100, cmp:'больше', value:50 } });
  ok(194, top.ok && top.data.rows.map(r => r.debt_main).join() === '31900000,9900000,7400000' &&
        !badOp.ok && has(badOp.why, 'оператор «больше» не применяется') && !nest.ok && has(nest.why, 'произвольных скобок нет') &&
        frm.ok && frm.matched === 2,
    `топ-3 по остатку досчитан на строках; к строке «больше» не применяется — операторы по типу величины; ` +
    `скобок в скобках нет; условие по своей формуле сравнило два показателя у ${frm.ok ? frm.matched : '?'} строк`);

  const ch = RP.chartOf('t-overdue', P, null);
  const shown = RP.show('t-overdue', P, null);
  ok(195, ch.ok && ch.by === 'подразделение' && ch.bars.length === shown.data.groups.length &&
        ch.bars.every(b => b.value === statOf(shown, b.key)),
    `график рядом с таблицей рисуется по тем же клеткам: ${ch.bars.length} столбца по подразделениям, значения ` +
    `совпадают с уровнями таблицы (ОГ-10)`);
  function statOf(r, key){ const g = r.data.groups.find(x => x.key === key);
    const t = (g.totals || []).find(x => x.id === 's-overdue-sum'); return t ? t.value : (g.rows || []).reduce((a, x) => a + (x.days > 0 ? x.debt_main : 0), 0); }

  RP.seed(); as('user');
  const sub = RP.subscribe('t-overdue', { freq:'ежемесячно' });
  const file = RP.subscribe('t-overdue', { freq:'ежемесячно', mail:'файл' });
  as('auth');
  const sub2 = RP.subscribe('t-overdue', { freq:'ежемесячно' });
  const night = RP.nightRun('2026-07-01');
  const all = RP.state.notices;
  const mine = all.find(n => n.to === 'Осмонова Г.'), his = all.find(n => n.to === 'Тентимишев К.');
  ok(196, sub.ok && !file.ok && has(file.why, 'на почту уходит только ссылка') && sub2.ok && night.ok &&
        mine && mine.scope.join() === 'Отраслевой департамент промышленности' && has(mine.text, '5 600 000') &&
        his && his.scope.length === 3 && has(his.text, '10 800 000') && has(mine.mail, 'без чисел'),
    `подписка считается с правами подписчика: Осмоновой — по своему подразделению (5 600 000), уполномоченному — ` +
    `по всем (10 800 000); на почту — ссылка без чисел, файла нет (ОГ-18, ADR-0287)`);

  RP.seed(); as('auth');
  const sig = RP.addSignal('t-overdue', { stat:'s-overdue-sum', cmp:'больше', value:10000000 });
  const task = RP.addSignal('t-overdue', { stat:'s-overdue-sum', cmp:'больше', value:1, task:true });
  const runs = ['2026-06-01', '2026-07-01', '2026-08-01'].map(d => RP.nightRun(d).fired.length);
  const hist = RP.mySubs().find(x => x.id === sig.id).history.map(x => x.met);
  ok(197, sig.ok && runs.join() === '0,1,0' && hist.join() === 'false,true,true' &&
        !task.ok && has(task.why, '«посмотри», а не «сделай»') && RP.notices().filter(n => n.kind === 'сигнал').length === 1,
    `сигнал «просрочка больше 10 млн» пришёл один раз — на переходе 01.07 (история ${hist.join(' → ')}), ` +
    `01.08 условие всё ещё выполняется, но повтора нет; задачу сигнал не ставит (ОГ-19, ИО-13)`);

  RP.seed(); as('user');
  const own = RP.addNote('t-avg', { asOf:'2026-07-01', text:'личная пометка' });
  const pub = RP.addNote('t-overdue', { asOf:'2026-07-01', text:'kr-2 вышел на просрочку' });
  const noDate = RP.addNote('t-overdue', { text:'без даты' });
  const concl = RP.addNote('t-overdue', { asOf:'2026-07-01', text:'вывод', conclusion:true });
  const replyOwn = RP.replyNote(own.id, 'сам себе');
  as('auth');
  const seenAug = RP.notesFor('t-overdue', '2026-08-01'), seenJul = RP.notesFor('t-overdue', '2026-07-01');
  const hidden = RP.notesFor('t-avg', '2026-07-01');
  const rep = RP.replyNote(pub.id, 'проверим');
  ok(198, own.ok && pub.ok && !noDate.ok && has(noDate.why, 'привязана к дате данных') &&
        !concl.ok && has(concl.why, 'аналитический обзор') && !replyOwn.ok &&
        seenAug.length === 1 && seenAug[0].past && has(seenAug[0].label, 'к прошлой дате') && !seenJul[0].past &&
        hidden.length === 0 && rep.ok && RP.notesFor('t-overdue', '2026-07-01')[0].replies.length === 1,
    `заметка привязана к дате данных: на 01.08 видна «к прошлой дате», на 01.07 — «к данным»; личную видит только ` +
    `автор, в официальном отвечают; заметка — не вывод (ОГ-31, ADR-0153)`);

  RP.seed(); as('auth');
  RP.subscribe('t-overdue', { freq:'ежемесячно' }); RP.addSignal('t-overdue', { stat:'s-overdue-sum', cmp:'больше', value:10000000 });
  RP.nightRun('2026-07-01');
  const subsScr = win.VIEWS.subs.fn();
  RP.state.view = 'issue'; RP.state.sel.tpl = 't-overdue'; RP.state.sel.time = 'динамика'; RP.state.sel.filter = 'или'; RP.state.sel.chart = true;
  const iss = win.VIEWS.issue.fn();
  ok(199, has(subsScr, 'Мои подписки и условия') && has(subsScr, 'стало выполняться на 01.07.2026') &&
        has(subsScr, 'на почту: ссылка') && has(iss, 'Время, фильтр, график, заметки') && has(iss, 'динамика по месяцам') &&
        has(iss, 'Фильтр в паспорте') && has(iss, '<svg class="chart line"'),
    `экраны: «Подписки и сигналы» — подписки, условия, история и уведомления; на показе — режимы времени, фильтр ` +
    `с паспортом, график рядом с таблицей, заметки`);
})();

/* ---- FF. Остаток гибкости: колонки-даты официальной формы, режим и фильтр в виде и отчёте,
        заметки к строке и ячейке, линия динамики (ОГ-Д6, ОГ-35, ADR-0282 п. 4, волна 36) ---- */
(() => {
  RP.seed(); as('auth');
  const fc = RP.formColumns('t-pay04', '2026-08-01');
  const cell = (rid, cid) => fc.rows.find(r => r.id === rid).cells.find(c => c.col === cid);
  const jan = RP.show('t-pay04', { asOf:'2026-01-01', dept:'' }, null).data.totals.find(x => x.id === 's-portfolio');
  const now = RP.show('t-pay04', { asOf:'2026-08-01', dept:'' }, null).data.totals.find(x => x.id === 's-portfolio');
  const pays = SEAM.statRows('payment', '2026-08-01', {}, RP.viewer().scope).rows;
  const ytd = pays.filter(p => p.date >= '2026-01-01' && p.date < '2026-08-01').reduce((a, p) => a + p.amount, 0);
  ok(200, fc.ok && fc.cols.length === 5 && fc.dates.length === 5 &&
        has(fc.dates.join(), 'На начало года — на 01.01.2026') && has(fc.dates.join(), '01.01.2025 — 31.07.2025') &&
        cell('s-portfolio', 'c-now').value === now.shown && cell('s-portfolio', 'c-y0').value === jan.shown &&
        cell('pay-sum', 'c-ytd').value === ytd && ytd === 400000 && cell('pay-sum', 'c-ly').value === 2400000 &&
        cell('pay-cnt', 'c-ly').value === 3 && cell('pay-sum', 'c-m').value === 0 &&
        cell('s-portfolio', 'c-m').value === null && has(cell('s-portfolio', 'c-m').gap, 'не складывается') &&
        cell('pay-sum', 'c-now').value === null && has(cell('pay-sum', 'c-now').gap, 'за период'),
    `колонки-даты формы объявлены от отчётной даты: на 01.08.2026 — 5 колонок; остаток на 01.01 = показу на 01.01 ` +
    `(${jan.shown}), поток с начала года = событиям платежа (${ytd}), прошлый год — ${cell('pay-sum', 'c-ly').value}; ` +
    `остаток за период и поток на дату — пустая клетка с причиной, а не ноль (ОГ-35, ADR-0282 п. 3–4)`);

  const pre = RP.issue('t-pay04', { params:{ asOf:'2026-08-01', dept:'' }, kind:'предварительный' });
  const preRec = RP.ISS ? RP.ISS(pre.id) : RP.state.issues.find(i => i.id === pre.id);
  const fin = RP.issue('t-pay04', { params:{ asOf:'2026-08-01', dept:'' }, kind:'окончательный', recipient:'a-mf' });
  ok(201, pre.ok && preRec.passport.dates.length === 5 && has(preRec.passport.seams.join(), 'statRows (платёж)') &&
        !fin.ok && has(fin.why, 'закрыты все периоды формы') && has(fin.why, 'январь 2025') && has(fin.why, 'июль 2025') &&
        has(fin.why, '«С начала года — прошлый год»') && !has(fin.why, '2026'),
    `паспорт выпуска перечисляет каждую дату формы (${preRec.passport.dates.length}); окончательная сдача отказана ` +
    `поимённо — не закрыты месяцы прошлого года колонки «аналогичный период»: «${fin.why.slice(0, 90)}…» (ОГ-35)`);

  ['январь','февраль','март','апрель','май','июнь','июль'].forEach(m => { RP.state.periods[m + ' 2025'] = { state:'закрыт' }; });
  const fin2 = RP.issue('t-pay04', { params:{ asOf:'2026-08-01', dept:'' }, kind:'окончательный', recipient:'a-mf' });
  const rec2 = RP.state.issues.find(i => i.id === fin2.id);
  as('buh'); RP.reopenPeriod('июль 2026', 'правка платежа задним числом'); as('auth');
  const fin3 = RP.issue('t-pay04', { params:{ asOf:'2026-08-01', dept:'' }, kind:'окончательный', recipient:'a-mf' });
  ok(202, fin2.ok && fin2.kind === 'окончательный' && rec2.snapshot.timeTable && rec2.snapshot.timeTable.cols.length === 5 &&
        rec2.snapshot.timeTable.rows.find(r => r.id === 'pay-sum').cells.find(c => c.col === 'c-ly').value === 2400000 &&
        rec2.passport.frozen && !fin3.ok && has(fin3.why, 'июль 2026 (колонка «На отчётную дату»)') &&
        has(fin3.why, '«С начала года»'),
    `все периоды закрыты — форма сдаётся окончательно, снимок морозит все 5 колонок; открыт заново июль 2026 — ` +
    `отказ называет каждую колонку, которой он касается (ОГ-35, ИО-33)`);

  RP.seed(); as('auth');
  const scr = RP.timeAnswer('t-pay04', { mode:'сравнение', a:'2026-06-01', b:'2026-08-01' }, { asOf:'2026-08-01', dept:'' });
  const old = RP.timeAnswer('t-overdue', { mode:'сравнение', a:'2026-06-01', b:'2026-08-01' }, { asOf:'2026-08-01', dept:'' });
  ok(203, scr.ok && !scr.issuable.ok && has(scr.issuable.why, 'в сдачу идёт не режим экрана, а колонки-даты формы на 01.08.2026') &&
        has(scr.issuable.why, 'январь 2025') && !old.issuable.ok && has(old.issuable.why, 'колонок-дат нет'),
    `сдача в режимах времени: у формы с колонками-датами сдаётся не режим экрана, а её объявленные даты от отчётной; ` +
    `у формы без них — по-прежнему «колонок-дат нет» (ОГ-35, ИО-21)`);

  as('user');
  const badOf = RP.setTimeCols('t-osh', [{ id:'a', kind:'аналогичный период', of:'x', name:'Год назад' }]);
  const badAt = RP.setTimeCols('t-osh', [{ id:'a', kind:'на дату', at:'середина месяца', name:'Середина' }]);
  const nowMode = RP.setTimeCols('t-avg', [{ id:'a', kind:'на дату', at:'отчётная дата', name:'Сейчас' }]);
  const good = RP.setTimeCols('t-osh', [{ id:'d', kind:'на дату', at:'отчётная дата', name:'На отчётную дату' },
    { id:'q', kind:'на дату', at:'начало квартала', name:'На начало квартала' }]);
  as('auth');
  const noDraft = RP.setTimeCols('t-overdue', [{ id:'d', kind:'на дату', at:'отчётная дата', name:'На дату' }]);
  const checksGood = RP.publishChecks('t-osh').filter(c => c.check === 'колонки-даты');
  RP.TPL('t-osh').editions[0].timeCols.push({ id:'z', kind:'аналогичный период', of:'z2', name:'Z' });
  const checksBad = RP.publishChecks('t-osh').filter(c => c.check === 'колонки-даты');
  ok(204, !badOf.ok && has(badOf.why, 'аналогичный период какой колонки') && !badAt.ok && has(badAt.why, 'не из набора') &&
        !nowMode.ok && has(nowMode.why, '«на дату»') && good.ok && !noDraft.ok && has(noDraft.why, 'черновая редакция') &&
        checksGood.length === 0 && checksBad.length === 1,
    `колонки-даты объявляет черновая редакция из закрытого набора; «аналогичный» — от колонки формы; у «сейчас» ` +
    `колонок нет; проверка утверждения ловит вписанное мимо (ОГ-35, ИО-21)`);

  RP.seed(); as('auth');
  const dyn = { mode:'динамика', from:'2026-01-01', to:'2026-08-01', step:'месяц' };
  const orF = { groups:[[{ field:'days', op:'больше', value:30 }], [{ field:'dept', op:'равно', value:'rep-osh' }]] };
  const v1 = RP.saveView('t-overdue', 'динамика и Ош', null, { time: dyn, filter: orF });
  const badF = RP.saveView('t-overdue', 'кривой', null, { filter:{ groups:[[{ field:'borrower', op:'больше', value:3 }]] } });
  const badT = RP.saveView('t-overdue', 'длинный', null, { time:{ mode:'динамика', from:'2023-01-01', to:'2026-08-01' } });
  const fx = RP.flexOf('t-overdue', v1.id), ap = RP.applyView(v1.id), plain = RP.flexOf('t-overdue', null);
  ok(205, v1.ok && RP.viewDiff(v1.id).time.mode === 'динамика' && RP.viewDiff(v1.id).filter.groups.length === 2 &&
        fx.time.from === 'вид «динамика и Ош»' && has(fx.time.text, 'динамика 01.01.2026 — 01.08.2026') &&
        has(fx.filter.text, 'ИЛИ') && ap.ok && ap.flex.time.spec.mode === 'динамика' && !plain.time && !plain.filter &&
        !badF.ok && has(badF.why, 'фильтр:') && !badT.ok && has(badT.why, 'длиннее 36'),
    `вид хранит режим времени и фильтр отличием от отчёта: «${fx.time.text}», «${fx.filter.text}»; без вида экран ` +
    `их не наследует; негодный фильтр и ряд длиннее 36 не сохраняются (ADR-0282, ADR-0281)`);

  as('buh');
  const shr = RP.setReportFlex('t-sh-plan', { time:{ mode:'сравнение', a:'2026-06-01', b:'2026-08-01' }, filter: orF });
  const shEd = RP.TPL('t-sh-plan').editions[0];
  const vSame = RP.saveView('t-sh-plan', 'как отчёт', null, { filter: orF });
  const vOwn = RP.saveView('t-sh-plan', 'топ-3', null, { filter:{ top:{ n:3, by:'debt_main' } } });
  const fxR = RP.flexOf('t-sh-plan', vSame.id), fxV = RP.flexOf('t-sh-plan', vOwn.id);
  as('user');
  const own = RP.setReportFlex('t-osh', { filter:{ top:{ n:3, by:'debt_main' } } });
  const foreign = RP.setReportFlex('t-sh-plan', { filter: orF });
  as('auth');
  const offic = RP.setReportFlex('t-overdue', { filter: orF });
  ok(206, shr.ok && has(shEd.changed, 'режим и фильтр') && vSame.ok && RP.viewDiff(vSame.id).filter === undefined &&
        fxR.filter.from === 'отчёт' && fxR.time.from === 'отчёт' && fxV.filter.from === 'вид «топ-3»' && has(fxV.filter.text, 'топ 3') &&
        own.ok && RP.flexOf('t-osh').filter.from === 'отчёт' && !foreign.ok && has(foreign.why, 'владелец и соавторы') &&
        !offic.ok && has(offic.why, 'колонки-даты'),
    `личный и общий отчёт хранят режим и фильтр своим умолчанием (общий — версией «изменён»); вид поверх хранит ` +
    `только отличие; в официальном режим — колонки-даты, отбор — параметры, свой режим — в виде`);

  RP.seed(); as('auth');
  const v2 = RP.saveView('t-overdue', 'просрочка 30+', null, { filter:{ groups:[[{ field:'days', op:'больше', value:30 }]] } });
  RP.renameField('credit', 'days', 'days_overdue', 'Дней просрочки');
  const fx2 = RP.flexOf('t-overdue', v2.id);
  ok(207, v2.ok && !fx2.filter && has(fx2.dropped, 'больше не годится') && has(fx2.dropped, 'снят'),
    `фильтр вида сверяется с отчётом при каждом показе: поле ушло из перечня — фильтр отваливается с пометкой, ` +
    `а не ломает вид (ИО-43)`);

  RP.seed(); as('user');
  const rowN = RP.addNote('t-overdue', { asOf:'2026-08-01', target:{ kind:'строка', row:'kr-2' }, text:'на контроле' });
  const cellN = RP.addNote('t-overdue', { asOf:'2026-08-01', target:{ kind:'ячейка', row:'kr-2', col:'debt_main' }, text:'сверить остаток' });
  const badCol = RP.addNote('t-overdue', { asOf:'2026-08-01', target:{ kind:'ячейка', row:'kr-2', col:'sum' }, text:'x' });
  const badRow = RP.addNote('t-overdue', { asOf:'2026-08-01', target:{ kind:'строка', row:'pm-3' }, text:'x' });
  as('head');
  const hidden = RP.addNote('t-overdue', { asOf:'2026-08-01', target:{ kind:'строка', row:'kr-2' }, text:'x' });
  as('auth');
  const seen = RP.notesFor('t-overdue', '2026-08-01');
  ok(208, rowN.ok && cellN.ok && !badCol.ok && has(badCol.why, 'ячейка — строка × колонка') && !badRow.ok &&
        has(badRow.why, 'объект ответа') && !hidden.ok && has(hidden.why, 'не виден') && seen.length === 2 &&
        seen.some(n => /^к строке /.test(n.at)) && seen.some(n => /^к ячейке .* · Остаток/.test(n.at)),
    `заметка ставится на строку (объект ответа) и ячейку (объект × колонка состава): ${seen.map(n => n.at).join('; ')}; ` +
    `к чужой колонке и невидимому объекту — отказ (ОГ-31)`);

  const ln = RP.chartOf('t-overdue', { asOf:'2026-08-01', dept:'' }, null, { kind:'линия', time:{ from:'2026-01-01', to:'2026-08-01' } });
  const tbl = RP.timeAnswer('t-overdue', dyn, { asOf:'2026-08-01', dept:'' });
  const pie = RP.chartOf('t-overdue', { asOf:'2026-08-01', dept:'' }, null, { kind:'круг' });
  ok(209, ln.ok && ln.kind === 'линия' && ln.segments.length === 2 && ln.segments[0].length === 1 && ln.segments[1].length === 3 &&
        ln.gaps.length === 4 && JSON.stringify(ln.points.map(p => p.value)) === JSON.stringify(tbl.tracks[0].points.map(p => p.value)) &&
        ln.passport.seam === 'statSeries' && !pie.ok && has(pie.why, 'графиков два'),
    `линия динамики — тот же ряд statSeries, что таблица (8 точек); 4 месяца без снимка рвут линию на 2 отрезка, ` +
    `а не падают в ноль (ОГ-10, ОГ-6)`);

  RP.seed(); as('auth');
  RP.addNote('t-overdue', { asOf:'2026-08-01', target:{ kind:'строка', row:'kr-2' }, text:'на контроле' });
  RP.addNote('t-overdue', { asOf:'2026-08-01', target:{ kind:'ячейка', row:'kr-6', col:'debt_main' }, text:'сверить остаток' });
  const vv = RP.saveView('t-overdue', 'моя динамика', null, { time: dyn });
  RP.state.view = 'issue'; RP.state.sel.tpl = 't-overdue'; RP.state.sel.params = { asOf:'2026-08-01', dept:'' };
  RP.useView(vv.id); RP.state.sel.chart = true;
  const s1 = win.VIEWS.issue.fn();
  RP.state.sel.view = null; RP.state.sel.twist = null; RP.state.sel.chart = false; RP.state.sel.tpl = 't-pay04';
  const s2 = win.VIEWS.issue.fn();
  ok(210, has(s1, 'class="noted"') && has(s1, 'заметка к ячейке') && has(s1, 'Режим времени из вида «моя динамика»') &&
        has(s1, '<svg class="chart line"') && has(s1, 'Заметка к строке') && has(s1, 'к ячейке') &&
        has(s2, 'Колонки-даты формы — от отчётной даты 01.08.2026') && has(s2, 'С начала года — прошлый год') &&
        has(s2, '2 400 000') && has(s2, 'колонки-даты') && has(s2, 'не закрыты январь 2025'),
    `экраны: на показе — значок заметки у строки и ячейки, режим из вида, линия динамики; у формы с колонками-датами — ` +
    `таблица «строки × даты», даты в паспорте и названный отказ окончательной сдачи`);
})();

/* ---- отчёт ---- */
const pass = results.filter(r => r.pass).length;
const lines = results.map(r => `   ${r.pass ? 'PASS' : 'FAIL'}  #${r.n}  ${r.note}`);
console.log(`SMOKE 2026-10-17 · ${pass}/${results.length} PASS\n` + lines.join('\n'));

const body = lines.map(l => '  ' + l).join('\n');
const injected = `  SMOKE 2026-10-17 · ${pass}/${results.length} PASS\n` + body;
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
