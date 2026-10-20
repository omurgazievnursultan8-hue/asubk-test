// Headless smoke для mockups/reports/reports.html (ИО-1…ИО-26, ADR-0156…0163).
// Zero-dep: вытаскивает <script> из HTML и исполняет логический слой в node:vm (без DOM —
// render() и toast() при отсутствии document становятся no-op, экраны не рисуются).
// Проверяется поведение: объявленность состава, пять отказов публикации, две ступени
// выпуска, снимок и расхождение со сданным, серии и номера, обязательства из правила,
// четыре шва внутрь и три наружу, названные отказы вместо отсутствующих кнопок,
// витрина потребителя и справочник форм (обязательная форма без шаблона — строка без кнопки).
// Волна 36 (блок FF, #200–#210): колонки-даты официальной формы и их замки на сдаче, режим
// времени и фильтр в виде и отчёте, заметки к строке и ячейке, линия динамики.
// Волна 37 (блок GG, #211–#218): месяцы до запуска закрыты переносом «из легаси» (ОГ-Д11,
// ADR-0307): календарь, сдача ФО-04, источник в паспорте и сноске, «в легаси не собиралось»,
// не перенесённый месяц, нет действия «открыть».
// Волна 38 (блок HH, #219–#227): месяц из легаси без итога (ОГ-Д12, ADR-0309) — пустые клетки
// остатков, сдача законна, ИО-8 не срабатывает, остаток не восстанавливается, декабрь 2025 без итога
// не перенесён; правка периода из легаси новой версией миграции с меткой выпусков (ADR-0307 п. 6).
// Волна 39 (блок II, #228–#233): итог месяцу из легаси без итога даёт новая версия миграции (ОГ-Д13,
// ADR-0311) — целиком, строкой журнала «было: нет → стало»; сданная пустота метится, не переиздаётся.
// Волна 40 (блок JJ, #234–#239): итоги концов месяцев 2025 г. в данных стенда — колонка-остаток на конец
// месяца из легаси находит снимок, выпуск не предварительный; шов платежей внутри 2025 г. отвечает событиями.
// Волна 41 (блок KK, #240–#246): хвост ОГ-Д6 — снимки своих месяцев 01.02…01.05.2026; смена методики показателя
// между датами колонок, сравнения и динамики (ADR-0285 п. 2, 4); подписка на вид; сигнал по фильтру и «в любой строке».
// Волна 42 (блок LL, #247–#252): майский взнос КД-2024/203 (pm-9) и сверка «остаток ↔ события» по снимкам; смена
// методики официальной формы после утверждения — уведомление, «ожидает решения», отказ окончательной сдачи на даты
// новой версии, подтверждение новой редакцией (ADR-0285 п. 3).
// Волна 43 (блок MM, #253–#268): входящие от дашборда (ADR-0314) — провал объясняет число в любом режиме: колонки, подпись
// и вес из записи объекта, «Изменение» объектами на двух датах, «в числе | вся группа», поиск, рабочий список и выгрузка
// показанного, контекст карточки; «крупнейшие» и ряд по разрезу «период начала» — ответ reportAnswer; соавтор-роль, снятие
// роли с владельца, принятие в каталог копией.
// Волна 44 (блок NN, #269–#276): потоки Движения из записи объекта (ADR-0313, ADR-0315) — разность двух строк у каждого
// объекта узла, «прочее» остатком, «нет ответа источника», строки в ответе = в окне, клик по строке; признак «нет объектов».
// Волна 45 (блок OO, #277–#298): добор старых решений волн 27 и 31 и хвосты волн 42–43 (ADR-0316) — относительные значения,
// итоги шире зоны, журнал просмотров, тяжёлый показ в фоне, валюта, жизнь общего, сводная, план и перечень номеров,
// «Обязательство» строками, пакет и отвалившееся, круг, сигнал и выгрузка с плитки, кто утверждает, PDF + XLSX; события
// месяцу без событий; личный отчёт на экране показа; «действующие», заготовки и реестр имущества в конструкторе.
// Волна 46 (#299): служебных экранов нет (ГМ-1, ГМ-2) — «Швы и соседи» и «Границы макета» убраны, меню — три стола;
// #60, #61, #76, #124, #125 переписаны на десять экранов; отказы легаси — кнопками на рабочих экранах.
// Волна 47 (блок QQ, #300–#307): справка по заёмщику ФО-52 (ADR-0319) — бланк объекта «заёмщик», разделы соседей
// повторами, нулевая статья не печатается, пустой раздел — «нет»; получатель «заказавший» только у рабочей бумаги;
// молчание соседа — пометка и неполнота, молчание заёмщика — отказ; объект бланка сверяется с видом; #102, #151 — форм 17.
// Волна 48 (блок RR, #308–#316): страница «Отчётность» — каталог (ВТ-1…ВТ-14): четыре полки одним рядом, «Мои» —
// своё · избранное · недавние, одна шапка строки, поиск по всем полкам, «⋯», «Недоступно» свёрнутой группой; очередь
// каталога — в реестре; #103, #121, #123, #152, #160, #161, #268, #279, #283, #296, #298 — на новую витрину.
// Волна 49 (блок SS, #317–#328): входящие от дашборда (ОД-38…ОД-51, ADR-0321) — вторая семья относительных значений
// от даты вопроса, ответ через дату запуска строками переноса, дата ответа называет строку и месяц, «Сравнение» с пятью
// базами, адрес витрины с запросом, «📌» с проверкой и умолчаниями, черновик дашборда в конструкторе, «отвечает»,
// публикация своей плитки в каталог; #314 — «📌» на выведенный показатель теперь отказ.
// Волна 50 (блок TT, #329–#335): входящие от дашборда по ADR-0320 (ОД-52…ОД-59, ADR-0323) — перешедший стоит в старом
// узле остатком на базу без потоков, сумма узлов равна итогу в каждой строке Движения, переход охвата тем же правилом;
// «срок близко» — признак обязательства по одной N модуля, правка N — уполномоченным с журналом; порог фильтра не даёт
// «нет объектов»; экран «Календарь сдачи».
// Волна 51 (блок UU, #336–#339): входящие от ядра по ADR-0322 (ОД-60…ОД-65, ADR-0324) — курсовая разница — поток
// Движения, у «Остатка основного долга» четыре потока по телу; ненулевое «прочее» — расхождение с потоками; пустой
// поток — «нет ответа источника» с названной колонкой; Движение в сомах, пересчёт валюты — только итоги.
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
  /* 01.12.2024 — конец ноября 2024 г., глубже переноса: снимка нет вовсе (волна 40 засеяла 2025 г.). */
  const none = SEAM.statRows('credit', '2024-12-01', { dept:null }, RP.viewer().scope.slice());
  ok(14, sub.substituted === '2026-08-01' && none.missing === true,
    `снимка на 01.09.2026 нет — подставлен ближайший на ${sub.substituted}; на 01.12.2024 (глубже переноса) снимка нет вовсе`);
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
  ok(60, bad.length === 0 && names.length === 10,
    `десять экранов × все роли = ${names.length * 5} отрисовок без исключений (${Math.round(total / 1000)} КБ разметки)`);

  as('auth');
  const reg = VIEWS.registry.fn(), cal = VIEWS.calendar.fn(), jr = VIEWS.journal.fn();
  const bl = VIEWS.blank.fn(), wl = VIEWS.worklists.fn();
  ok(61, has(reg, 'Не видно этой роли') && has(cal, 'Три кнопки, которых в модуле нет') &&
        has(jr, 'что мы отдали наружу') && has(bl, 'Проверка документом') &&
        has(wl, 'Завести список правилом'),
    `отказы проговорены на самих экранах, а не спрятаны за отсутствием кнопки`);
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

  const bad = RP.order('t-overdue', { params:{ asOf:'2024-12-01', dept:null }, kind:'предварительный' });
  RP.step(bad.id);
  const err = RP.step(bad.id);
  const errRow = RP.ISS(bad.id);
  ok(73, bad.ok && !err.ok && err.state === 'ошибка' && has(err.why, 'ИО-6') &&
        errRow.state === 'ошибка' && errRow.snapshot === null && RP.ISS(bad.id) !== undefined,
    `задание кончается СОСТОЯНИЕМ, а не пустотой: снимка на 01.12.2024 нет — ошибка, строка ` +
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
  const b = V.builder.fn(), i = V.issue.fn(), w = V.worklists.fn();
  RP.order('t-overdue', { params:{ asOf: RP.state.sel.params.asOf, dept:null }, kind:'предварительный' });
  const j = V.journal.fn(), i2 = V.issue.fn();
  ok(76, has(b, 'Итоги уровней и лист выгрузки') && has(i, 'Задания на выпуск') &&
        has(i, 'Итог по «') && has(i2, 'Шаг задания') && has(j, 'задание: заказан') &&
        has(b, 'Сложить итоги уровней самим') && has(w, 'Завести список правилом'),
    `волна 4 проговорена на экранах: полосы и итоги уровней в конструкторе и предпросмотре, ` +
    `состояния задания в выпуске и журнале, отказы легаси там, где их просят`);
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
  ok(102, forms.length === 17 && forms.filter(f => f.obligatory).length === 12 &&
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
        has(showH, 'не заведена') && has(showH, 'Недоступно') && !has(showH, 'ред. 06.07.2026') &&
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
        RP.state.sel.tpl === 't-overdue' && has(showTab('мои'), "RP.openViewOf('" + v.id + "')") &&
        has(showTab('мои'), 'вид поверх «Просроченная задолженность'),
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
  ok(123, has(first, '>Мои<') && has(first, '>Общие<') && has(first, '>Официальные<') && has(first, '>Бланки<') &&
        !has(first, 'tabs sub') && (first.match(/class="on"/g) || []).length === 1 && !has(first, 'Где печатается') &&
        blanks.length > 0 && blanks.every(r => !has(first, "openForm('" + r.id)) &&
        has(showTab('отчёт'), 'Обязательные') && has(showTab('отчёт'), 'По запросу') &&
        has(V.issue.fn(), 'Что делают с показанным') && Object.keys(V)[0] === 'showcase',
    `витрина первым экраном модуля и разложена на четыре полки одним рядом — Мои · Общие · Официальные · Бланки; ` +
    `второго ряда вкладок нет, ${blanks.length} бланков в ленту отчётов не подмешаны, обязательность делит внутри полки`);

  const rep = showTab('отчёт'), bl = showTab('бланк');
  const tables = s => (String(s).match(/<table/g) || []).length;
  const sects = s => (String(s).match(/class="sect"/g) || []).length;
  ok(151, tables(rep) === 1 && sects(rep) === 2 && tables(bl) === 1 && sects(bl) === 2 &&
        has(bl, 'По запросу <span class="n">· 3</span>') && has(bl, 'Кредитный договор') && has(bl, 'Справка по заёмщику') &&
        has(bl, 'по форме банка-агента') &&
        !has(bl, 'Под отбор не попало') && has(rep, 'Обязательные <span class="n">· 1</span>'),
    `обязательность делит строки ВНУТРИ одной таблицы: одна шапка и разделители групп; у бланков ` +
    `«по запросу» — кредитный договор, форма банка-агента и справка по заёмщику, необязательные по норме, но печатаемые каждый день`);
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

  ok(124, groups.length === 3 &&
        titles.join(' · ') === 'Смотреть и сдавать · Настраивать · След' &&
        groups.every(g => g.hint.trim().length > 10),
    `навигация разложена на три стола заказчика: ${titles.join(' · ')}; ` +
    `у каждого подписано, чей это стол`);

  const flat = groups.flatMap(g => g.items);
  const uniq = [...new Set(flat)];
  const missing = Object.keys(V).filter(v => flat.indexOf(v) === -1);
  ok(125, flat.length === 10 && uniq.length === 10 && missing.length === 0 &&
        groups.map(g => g.items.length).join('/') === '5/4/1' && flat.indexOf('dash') === -1 &&
        groups[0].items.indexOf('subs') !== -1,
    `перегруппировка ничего не потеряла и не задвоила: все 10 экранов ровно по разу, ` +
    `раскладка 5 / 4 / 1 — «Подписки и сигналы» на столе «Смотреть и сдавать»; экрана «Дашборд» в модуле нет`);

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
  /* Документ основания печатается только у неисполняемой нормы — в группе «Недоступно». */
  const docs = (bl.slice(0, bl.indexOf('Недоступно')).match(/Порядок №41/g) || []).length;
  const wasLate = has(bl, 'class="late"');
  RP.state.today = '2026-09-05';                 /* срок акта сверки — 01.09 */
  const bl2 = showTab('бланк');
  ok(152, docs === 0 && !has(bl, '>Основание<') &&
        !has(bl, 'ред. 06.07.2026') && !has(bl, ' · бланк') &&
        !wasLate && (bl2.match(/class="late"/g) || []).length === 1 &&
        has(bl2, 'class="burn"'),
    `строка не повторяет то, что одинаково у всех: основания в строке нет — оно в паспорте отчёта, ` +
    `редакции нет вовсе, вид формы — полка; просроченная строка помечена полосой на срезе, и полоса со счётчиком ` +
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
  /* Волна 43 (ОД-20): безымянного списка по-прежнему нет — имя по умолчанию путь узла. */
  ok(157, noName.ok && RP.WL(noName.id).name === 'Просроченная задолженность по состоянию на 1-е число · Сумма просроченной задолженности · итог · на 01.08.2026' &&
        wl.ok && w.from === 'провал' && w.objects.length === d.items.length &&
        w.objects.every(id => d.items.some(x => x.id === id)) && has(w.fromName, 'на 01.08.2026') &&
        RP.worklistProgress(wl.id).done === 0 && RP.worklistProgress(wl.id).total === 2,
    `рабочий список заводится из провала: ${w.objects.length} объекта провала, состав заморожен; ` +
    `безымянного списка нет — имя по умолчанию путь узла «${RP.WL(noName.id).name}»; прогресс начинается с «0 из ${w.objects.length}»`);

  const m1 = RP.markWorked(wl.id, w.objects[0], 'дозвонились, обещал до 05.09');
  const alien = RP.markWorked(wl.id, 'kr-1', '');
  const pr = RP.worklistProgress(wl.id);
  const mk = RP.WL(wl.id).marks[w.objects[0]];
  RP.state.sel.wl = wl.id;
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
  ok(160, mineIds === 't-avg,t-npl,t-osh,ВД-1' && shIds === 't-sh-plan,t-sh-big' &&
        sh.shared[0].users >= sh.shared[1].users && has(first, 'Открыть кругу') &&
        has(first, 'class="on"') && has(first, '>личный'),
    `полки: «Мои» — ${sh.mine.length} (личные отчёты автора и его вид), «Общие» — ${sh.shared.length} ` +
    `(в т. ч. открытый Осмоновой поимённо), популярные сверху; витрина открывается на «Моих»`);

  as('head');
  const headSh = RP.shelves('').shared.map(r => r.id).join();
  as('user');
  const shTab = showTab('общие');
  RP.TPL('t-sh-big').share.people = [];          /* владелец убрал Осмонову из круга */
  const userSh = RP.shelves('').shared.map(r => r.id).join();
  ok(161, headSh === 't-sh-plan,t-sh-big' && userSh === 't-sh-plan' &&
        has(shTab, 'Бекова Н. · пользуются 9') && has(shTab, 'соавторы: Асанов А.') && has(shTab, 'версия 3'),
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
        !rp.rows.some(x => x.id === 'pm-8') && live.length === 6 && live.find(x => x.id === 'pm-3').amount === 550000 &&
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
  ok(180, f2.ok && f2.continuation === 3 && f2.inForm === 3 && f2.pages === 2 && f2.baked &&
        f2.fields.find(x => x.name === 'chkGuarantee').value === '☐' && f6.fields.find(x => x.name === 'chkGuarantee').value === '☒' &&
        f2.fields.find(x => x.name === 'BankNote').how === 'оставлено пустым' &&
        has(f2.fields.find(x => x.name === 'DebtAmount').value, 'пять миллионов сто тысяч') &&
        fin.ok && fin.rec.pdf && fin.rec.pdf.pages === 2 && fin.rec.pdf.continuation === 3 &&
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
  /* Волна 41: у своих месяцев 2026 г. снимки на каждое 1-е число до 01.08 — пробел ряда ищется за его концом
     (01.09, 01.10.2026 — «снимка нет») и в июле 2025 (без итога — «в легаси не собиралось»). */
  const fut = RP.timeAnswer('t-overdue', { mode:'динамика', from:'2026-07-01', to:'2026-10-01' }, P);
  const leg = RP.timeAnswer('t-overdue', { mode:'динамика', from:'2025-06-01', to:'2025-10-01' }, P);
  const fp = fut.ok ? fut.tracks[0].points : [], lp = leg.ok ? leg.tracks[0].points : [];
  ok(191, dyn.ok && pts.length === 8 && pts[6].value === 10800000 && pts.every(p => p.value != null) &&
        fp.length === 4 && fp[2].gap === 'снимка нет' && fp[2].value === null && fp[3].gap === 'снимка нет' &&
        lp.length === 5 && lp[2].value === null && lp[2].gap === 'в легаси не собиралось' && lp[3].value === 7300000 &&
        dyn.passport.seam === 'statSeries' && !long.ok && has(long.why, 'длиннее 36') && q.ok && q.dates.length === 15,
    `динамика — ряд statSeries по месяцам (8 точек, июль — 10 800 000; без снимка — «снимка нет», конец июля 2025 — «в легаси не собиралось», а не ноль); ` +
    `44 месяца — отказ «длиннее 36», по кварталам — ${q.ok ? q.dates.length : '?'} точек (ОГ-6)`);

  const stock = RP.timeAnswer('t-overdue', { mode:'за период', from:'2026-01-01', to:'2026-08-01' }, P);
  const turn = RP.timeAnswer('t-overdue', { mode:'за период', from:'2026-01-01', to:'2026-08-01', turnover:true }, P);
  ok(192, !stock.ok && has(stock.why, 'остаток: за период он не складывается') &&
        turn.ok && turn.rows[0].value === 900000 && turn.lines.map(l => l.id).join() === 'pm-8,pm-9' &&
        turn.passport.seam === 'statRows (платёж)',
    `«за период» — обороты событий: остаток за период не складывается (отказ с путём «сравнение»), платежи ` +
    `01.01–01.08.2026 — 900 000 сом из снимка статистики (pm-8, pm-9)`);

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
        cell('pay-sum', 'c-ytd').value === ytd && ytd === 900000 && cell('pay-sum', 'c-ly').value === 2400000 &&
        cell('pay-cnt', 'c-ly').value === 3 && cell('pay-sum', 'c-m').value === 0 &&
        cell('s-portfolio', 'c-m').value === null && has(cell('s-portfolio', 'c-m').gap, 'не складывается') &&
        cell('pay-sum', 'c-now').value === null && has(cell('pay-sum', 'c-now').gap, 'за период'),
    `колонки-даты формы объявлены от отчётной даты: на 01.08.2026 — 5 колонок; остаток на 01.01 = показу на 01.01 ` +
    `(${jan.shown}), поток с начала года = событиям платежа (${ytd}), прошлый год — ${cell('pay-sum', 'c-ly').value}; ` +
    `остаток за период и поток на дату — пустая клетка с причиной, а не ноль (ОГ-35, ADR-0282 п. 3–4)`);

  /* Волна 37: месяцы 2025 г. закрыты переносом «из легаси» (ADR-0307) — чтобы
     показать отказ поимённо, стенд «теряет» два месяца, которых перенос не дал. */
  const pre = RP.issue('t-pay04', { params:{ asOf:'2026-08-01', dept:'' }, kind:'предварительный' });
  const preRec = RP.ISS ? RP.ISS(pre.id) : RP.state.issues.find(i => i.id === pre.id);
  delete RP.state.periods['январь 2025']; delete RP.state.periods['июль 2025'];
  const fin = RP.issue('t-pay04', { params:{ asOf:'2026-08-01', dept:'' }, kind:'окончательный', recipient:'a-mf' });
  ok(201, pre.ok && preRec.passport.dates.length === 5 && has(preRec.passport.seams.join(), 'statRows (платёж)') &&
        !fin.ok && has(fin.why, 'закрыты все периоды формы') && has(fin.why, 'январь 2025') && has(fin.why, 'июль 2025') &&
        has(fin.why, '«С начала года — прошлый год»') && !has(fin.why, '2026'),
    `паспорт выпуска перечисляет каждую дату формы (${preRec.passport.dates.length}); окончательная сдача отказана ` +
    `поимённо, если месяц прошлого года колонки «аналогичный период» не закрыт: «${fin.why.slice(0, 90)}…» (ОГ-35)`);

  RP.seed(); as('auth');
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
  ok(203, scr.ok && scr.issuable.ok && has(scr.issuable.why, 'в сдачу идёт не режим экрана, а колонки-даты формы на 01.08.2026') &&
        has(scr.issuable.why, 'С начала года — прошлый год') && !old.issuable.ok && has(old.issuable.why, 'колонок-дат нет'),
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

  /* Волна 41: середина 2026 г. без пробелов — разрыв линии показывается на июле 2025 г. (без итога). */
  const lnT = { from:'2025-06-01', to:'2026-01-01' };
  const ln = RP.chartOf('t-overdue', { asOf:'2026-08-01', dept:'' }, null, { kind:'линия', time: lnT });
  const tbl = RP.timeAnswer('t-overdue', Object.assign({ mode:'динамика' }, lnT), { asOf:'2026-08-01', dept:'' });
  const pie = RP.chartOf('t-overdue', { asOf:'2026-08-01', dept:'' }, null, { kind:'круг' });
  ok(209, ln.ok && ln.kind === 'линия' && ln.segments.length === 2 && ln.segments[0].length === 2 && ln.segments[1].length === 5 &&
        ln.gaps.length === 1 && ln.gaps[0] === '2025-08-01' && JSON.stringify(ln.points.map(p => p.value)) === JSON.stringify(tbl.tracks[0].points.map(p => p.value)) &&
        ln.passport.seam === 'statSeries' && !pie.ok && has(pie.why, 'графиков два'),
    `линия динамики — тот же ряд statSeries, что таблица (8 точек); конец июля 2025 без итога рвёт линию на 2 отрезка, ` +
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
        has(s2, '2 400 000') && has(s2, 'колонки-даты') && !has(s2, 'Не закрыты:'),
    `экраны: на показе — значок заметки у строки и ячейки, режим из вида, линия динамики; у формы с колонками-датами — ` +
    `таблица «строки × даты», даты в паспорте; все месяцы колонок закрыты — строки «не закрыты» нет`);
})();

/* ---- GG. Месяц до запуска закрыт переносом «из легаси» (ОГ-Д11, ADR-0307, ИО-59, волна 37) ---- */
(() => {
  RP.seed(); as('auth');
  const P = RP.periods();
  const lg = Object.keys(P).filter(m => P[m].origin === 'легаси');
  const m25 = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'].map(m => m + ' 2025');
  ok(211, lg.length === 13 && lg[0] === 'декабрь 2024' && lg[12] === 'декабрь 2025' && m25.every(m => lg.indexOf(m) !== -1) &&
        lg.every(m => P[m].state === 'закрыт' && P[m].release === 'М-1' && P[m].by === 'Бекова Н.' &&
          P[m].latches['учёт'] === 'закрыт' && P[m].latches['классификация'] === 'закрыт' && P[m].latches['статистика'] === 'закрыт') &&
        !P['ноябрь 2024'] && P['январь 2026'].state === 'закрыт' && !P['январь 2026'].origin &&
        SEAM.periodSource('май 2025').origin === 'легаси' && SEAM.periodSource('май 2025').events === true &&
        SEAM.periodSource('январь 2026') === null,
    `месяцы до запуска (${lg[0]} … ${lg[12]}, ${lg.length}) закрыты выпуском миграции М-1 один раз во всех колонках-защёлках ` +
    `календаря (учёт · классификация · статистика), origin «легаси», актор — утвердивший выпуск; с января 2026 г. — свои ` +
    `(ADR-0307 п. 1, 3)`);

  const run = RP.issue('t-pay04', { params:{ asOf:'2026-08-01' }, kind:'окончательный', recipient:'a-mf' });
  const rec = RP.state.issues.find(i => i.id === run.id);
  const tt = rec && rec.snapshot && rec.snapshot.timeTable;
  ok(212, run.ok && run.kind === 'окончательный' && rec.passport.frozen && tt && tt.cols.length === 5 &&
        tt.rows.find(r => r.id === 'pay-sum').cells.find(c => c.col === 'c-ly').value === 2400000 &&
        tt.rows.find(r => r.id === 's-portfolio').cells.find(c => c.col === 'c-y0').value === 77000000,
    `прогон RP.issue('t-pay04', {params:{asOf:'2026-08-01'}, kind:'окончательный', recipient:'a-mf'}), отказывавший в волне 36 ` +
    `«не закрыты январь 2025 … июль 2025», проходит: ${run.id}, снимок морозит 5 колонок, прошлый год — 2 400 000 (ОГ-35 без исключений)`);

  const ps = rec.passport.sources || [];
  const fc = RP.formColumns('t-pay04', '2026-08-01');
  const col = id => fc.cols.find(c => c.id === id);
  ok(213, ps.length === 2 && has(ps[0], '«На начало года»: из легаси — перенос, выпуск миграции М-1 от 30.12.2025') &&
        has(ps[1], '«С начала года — прошлый год»: из легаси') && !ps.some(x => has(x, '«С начала года»:')) &&
        col('c-ly').legacy.length === 7 && col('c-ytd').source === null && col('c-now').source === null &&
        has(col('c-y0').source, 'утвердил Бекова Н.'),
    `паспорт у колонки, касающейся месяцев до запуска, печатает источник: ${ps.map(x => x.split(':')[0]).join(', ')}; ` +
    `у своих колонок — нет; у клетки отдельной пометки нет — источник свойство месяца (ADR-0307 п. 5)`);

  const cAvg = fc.rows.find(r => r.id === 's-avg-late').cells;
  const jan = RP.show('t-pay04', { asOf:'2026-01-01', dept:'' }, null).data.totals.find(x => x.id === 's-avg-late');
  ok(214, cAvg.find(c => c.col === 'c-y0').value === null && cAvg.find(c => c.col === 'c-y0').gap === 'в легаси не собиралось' &&
        cAvg.find(c => c.col === 'c-now').value !== null && (rec.passport.legacyGaps || []).length === 1 &&
        has(rec.passport.legacyGaps[0], 'Средняя просрочка × «На начало года» — в легаси не собиралось') &&
        rec.kind === 'окончательный' && !RP.show('t-pay04', { asOf:'2026-08-01', dept:'' }, null).data.soft.some(x => has(x, 'легаси')) &&
        jan.value == null && jan.shown == null,
    `месяц перенесён, а величины в легаси не собирали — клетка пустая «в легаси не собиралось», а не ноль; паспорт ` +
    `перечисляет такую клетку, сдаче она не мешает; показ на 01.01.2026 тоже не печатает ноль (ADR-0307 п. 7)`);

  delete RP.state.periods['март 2025'];
  const lost = RP.issue('t-pay04', { params:{ asOf:'2026-08-01' }, kind:'окончательный', recipient:'a-mf' });
  const lostPre = RP.issue('t-pay04', { params:{ asOf:'2026-08-01' }, kind:'предварительный' });
  RP.seed(); as('auth');
  const y25 = RP.formColumns('t-pay04', '2026-01-01');
  const ly25 = y25.cols.find(c => c.id === 'c-ly');
  ok(215, !lost.ok && has(lost.why, 'март 2025 — до запуска системы, переносом не закрыт (колонка «С начала года — прошлый год»)') &&
        lostPre.ok && has(y25.why, 'январь 2024') && has(y25.why, 'переносом не закрыт') &&
        has(ly25.source, 'состав: из легаси (декабрь 2024)') && has(ly25.source, 'до запуска, переносом не закрыты — январь 2024 — ноябрь 2024'),
    `месяц, который перенос не дал, закрытым не объявлен: окончательная сдача отказывает поимённо — «${lost.why.slice(lost.why.indexOf('март'), lost.why.indexOf('март') + 60)}…», ` +
    `предварительный выпуск законен; колонка поперёк границы переноса печатает состав (ADR-0307 п. 5, 7)`);

  as('buh');
  const rLeg = RP.reopenPeriod('май 2025', 'правка'), rDec = RP.reopenPeriod('декабрь 2025', 'правка');
  const aLeg = RP.periodActions('май 2025'), aOwn = RP.periodActions('июль 2026');
  const night = RP.nightRun('2026-01-01');
  as('auth');
  ok(216, !rLeg.ok && has(rLeg.why, 'действия «открыть» у него нет') && has(rLeg.why, 'ADR-0207 п. 4') &&
        !rDec.ok && RP.periods()['декабрь 2025'].state === 'закрыт' && aLeg.actions.length === 0 && aLeg.origin === 'легаси' &&
        aOwn.actions.join() === 'открыть заново' && !night.ok && has(night.why, 'загружен переносом из легаси'),
    `период из легаси не переоткрывается даже главным бухгалтером: действий у него нет, у своего — «открыть заново»; ` +
    `своего прогона по снимку переноса нет (ADR-0207 п. 4, ADR-0307 п. 4, 6)`);

  vm.runInContext("LEGACY.months['май 2025'].events = false", sandbox);
  const nf = RP.formColumns('t-pay04', '2026-08-01');
  const nfFin = RP.issue('t-pay04', { params:{ asOf:'2026-08-01' }, kind:'окончательный', recipient:'a-mf' });
  vm.runInContext("LEGACY.months['май 2025'].events = true", sandbox);
  const lyPay = nf.rows.find(r => r.id === 'pay-sum').cells.find(c => c.col === 'c-ly');
  ok(217, lyPay.value === null && lyPay.gap === 'события в легаси не перенесены (май 2025)' &&
        nf.rows.find(r => r.id === 'pay-sum').cells.find(c => c.col === 'c-ytd').value === 900000 && nfFin.ok,
    `поток за месяц без перенесённых событий — пустая клетка «${lyPay.gap}», а не «платежей не было»; месяц закрыт — ` +
    `сдаче не мешает (ADR-0307 п. 7)`);

  RP.state.view = 'issue'; RP.state.sel.tpl = 't-pay04'; RP.state.sel.params = { asOf:'2026-08-01', dept:'' };
  RP.state.sel.view = null; RP.state.sel.twist = null; RP.state.sel.chart = false; RP.state.sel.time = null;
  const s1 = win.VIEWS.issue.fn(), jr = win.VIEWS.journal.fn(), sb = win.VIEWS.subs.fn();
  ok(218, has(s1, '<sup class="fn">1</sup>') && has(s1, '<sup class="fn">2</sup>') &&
        has(s1, '«На начало года»: из легаси — перенос, выпуск миграции М-1') && has(s1, 'в легаси не собиралось') &&
        has(s1, 'источник колонок') && has(s1, 'нет в легаси') &&
        has(jr, 'Учётные периоды') && has(jr, 'декабрь 2024 — декабрь 2025') && has(jr, 'открыть нельзя') &&
        (jr.match(/открыть заново — главный бухгалтер/g) || []).length === 7 &&
        !has(sb, "RP.doNight('2026-01-01')") && has(sb, "RP.doNight('2026-08-01')"),
    `экраны: форма — сноска у колонки «из легаси» и пустая клетка с причиной, паспорт — источник колонок; журнал — ` +
    `строка периодов из легаси без кнопки «открыть»; подписки — нет ночного прогона по снимку переноса`);
})();

/* ---- HH. Месяц из легаси без итога (ОГ-Д12, ADR-0309) и правка периода из легаси новой версией
        миграции (ADR-0307 п. 6), волна 38 ---- */
(() => {
  RP.seed(); as('auth');
  const P = RP.periods(), jul = SEAM.periodSource('июль 2025');
  const cr = SEAM.statRows('credit', '2025-08-01', {}, RP.viewer().scope);
  const pm = SEAM.statRows('payment', '2026-08-01', {}, RP.viewer().scope);
  const sl = SEAM.statSlice('s-portfolio', null, {}, '2025-08-01', RP.viewer().scope);
  ok(219, P['июль 2025'].state === 'закрыт' && P['июль 2025'].origin === 'легаси' && jul.totals === false &&
        jul.events === true && SEAM.periodSource('июнь 2025').totals === true && !RP.hasSnapshot('2025-08-01') &&
        cr.missing && cr.never && cr.substituted === null && has(cr.why, 'в легаси не собиралось') &&
        pm.rows.some(r => r.id === 'pm-5' && r.date === '2025-07-12') && sl.value === null && sl.never && sl.why === 'в легаси не собиралось',
    `июль 2025 г. перенесён одними событиями, без итога, и закрыт переносом, как остальные месяцы; шов на его конец ` +
    `отвечает «нет навсегда» с признаком «из легаси» («${cr.why}»); событие июля (pm-5) перенесено (ADR-0309 п. 1–2)`);

  const fc = RP.formColumns('t-port-ly', '2026-08-01');
  const cell = (rid, cid) => fc.rows.find(r => r.id === rid).cells.find(c => c.col === cid);
  const julPays = pm.rows.filter(p => p.date >= '2025-07-01' && p.date < '2025-08-01');
  ok(220, fc.ok && fc.why === null && cell('s-portfolio', 'c-nly').value === null &&
        cell('s-portfolio', 'c-nly').gap === 'в легаси не собиралось' && cell('s-overdue-cnt', 'c-nly').gap === 'в легаси не собиралось' &&
        cell('s-portfolio', 'c-now').value === 64100000 && cell('pay-sum', 'c-mly').value === 1200000 &&
        julPays.reduce((a, p) => a + p.amount, 0) === 1200000 && cell('pay-cnt', 'c-mly').value === 1 &&
        fc.legacyGaps.length === 2 && fc.legacyGaps.every(g => has(g, '× «На отчётную дату — прошлый год» — в легаси не собиралось: итог месяца не перенесён (июль 2025)')) &&
        fc.gaps.length === 0,
    `форма «Портфель к прошлому году» на 01.08.2026: остатки на 01.08.2025 — пустые клетки «в легаси не собиралось», ` +
    `паспорт перечисляет ${fc.legacyGaps.length}; поток за июль 2025 — из перенесённых событий (${cell('pay-sum', 'c-mly').value}, ` +
    `платежей ${cell('pay-cnt', 'c-mly').value}) (ADR-0309 п. 1)`);

  const fin = RP.issue('t-port-ly', { params:{ asOf:'2026-08-01' }, kind:'окончательный', recipient:'a-mf' });
  const rec = RP.state.issues.find(i => i.id === fin.id);
  /* «ещё нет»: системный месяц без снимка (июнь 2026 — снимка на 01.07.2026 в стенде на время проверки нет)
     по-прежнему делает выпуск предварительным; колонка месяца из легаси без итога — нет. */
  vm.runInContext("delete HIST['2026-07-01']; HIST_DATES.splice(HIST_DATES.indexOf('2026-07-01'), 1)", sandbox);
  RP.TPL('t-port-ly').editions[0].timeCols.push({ id:'c-ms', kind:'на дату', at:'начало месяца', name:'На начало месяца' });
  const soft = RP.show('t-port-ly', { asOf:'2026-08-01', dept:'' }, null).data.soft;
  const pre = RP.issue('t-port-ly', { params:{ asOf:'2026-08-01' }, kind:'окончательный', recipient:'a-mf' });
  const preRec = RP.state.issues.find(i => i.id === pre.id);
  vm.runInContext("HIST['2026-07-01'] = clone(HIST0['2026-07-01']); HIST_DATES.push('2026-07-01'); HIST_DATES.sort()", sandbox);
  RP.seed(); as('auth');
  ok(221, fin.ok && rec.kind === 'окончательный' && rec.passport.frozen && rec.passport.legacyGaps.length === 2 &&
        rec.snapshot.timeTable.rows.find(r => r.id === 's-portfolio').cells.find(c => c.col === 'c-nly').value === null &&
        pre.ok && preRec.kind === 'предварительный' && has(preRec.note, 'снимка на 01.07.2026 нет') && has(preRec.note, 'ИО-8') &&
        soft.length === 1 && !soft.some(x => has(x, 'прошлый год')) && RP.hasSnapshot('2026-07-01'),
    `окончательная сдача проходит (${fin.id}): пустота морозится с причиной; ИО-8 у месяца из легаси не срабатывает, ` +
    `а у системного месяца без снимка — по-прежнему: «${preRec.note.slice(0, 80)}…» (ADR-0309 п. 2)`);

  /* Восстановления нет: итоги концов июня и августа 2025 г. в стенде есть (волна 40), а конец июля
     не подставляется соседним снимком и не выводится из него и событий; ноль не ставится. */
  const nb = SEAM.statSlice('s-portfolio', null, {}, '2025-08-01', RP.viewer().scope);
  const nbRows = SEAM.statRows('credit', '2025-08-01', {}, RP.viewer().scope);
  const nbCell = RP.formColumns('t-port-ly', '2026-08-01').rows.find(r => r.id === 's-portfolio').cells.find(c => c.col === 'c-nly');
  ok(222, nb.value === null && nb.never && nbRows.substituted === null && nbRows.rows.length === 0 &&
        nbCell.value === null && nbCell.gap === 'в легаси не собиралось' &&
        RP.hasSnapshot('2025-07-01') && RP.hasSnapshot('2025-09-01') && !RP.hasSnapshot('2025-08-01'),
    `остаток на конец месяца без итога не восстанавливается: соседние итоги на 01.07.2025 и 01.09.2025 есть, а конец июля — пусто ` +
    `«в легаси не собиралось», не подстановка соседнего снимка, не итог плюс события и не ноль (ADR-0309 п. 3)`);

  const comp = RP.legacyComposition(); comp.months['декабрь 2025'].totals = false;
  const cal = RP.migrationCalendar(comp);
  const keep = RP.state.periods;
  RP.state.periods = Object.assign(cal.periods, Object.keys(keep).filter(m => !keep[m].origin)
    .reduce((a, m) => Object.assign(a, { [m]: keep[m] }), {}));
  const decFin = RP.issue('t-pay04', { params:{ asOf:'2026-08-01' }, kind:'окончательный', recipient:'a-mf' });
  const decPre = RP.issue('t-pay04', { params:{ asOf:'2026-08-01' }, kind:'предварительный' });
  RP.seed(); as('auth');
  ok(223, !cal.periods['декабрь 2025'] && cal.periods['ноябрь 2025'] && cal.notMigrated.length === 1 &&
        cal.notMigrated[0].month === 'декабрь 2025' && has(cal.notMigrated[0].why, 'входящий остаток') &&
        !decFin.ok && has(decFin.why, 'декабрь 2025 — до запуска системы, переносом не закрыт (колонка «На начало года»)') &&
        decPre.ok && RP.periods()['декабрь 2025'].state === 'закрыт' && RP.legacyComposition().months['декабрь 2025'].totals === true &&
        RP.migrationCalendar().notMigrated.length === 0,
    `перенос без итога декабря 2025 (состав на копии): месяц перед запуском не перенесён и закрытым не объявлен — ` +
    `«${cal.notMigrated[0].why.slice(0, 60)}…»; ФО-04 на 01.08.2026 отказывает поимённо, предварительный законен; ` +
    `данные стенда не тронуты (ADR-0309 п. 4)`);

  const f4 = RP.issue('t-pay04', { params:{ asOf:'2026-08-01' }, kind:'окончательный', recipient:'a-mf' });
  const fOv = RP.issue('t-overdue', { params:{ asOf:'2026-08-01', dept:'' }, kind:'окончательный', recipient:'a-mf' });
  const fPre = RP.issue('t-pay04', { params:{ asOf:'2026-08-01' }, kind:'предварительный' });
  const fLy = RP.issue('t-port-ly', { params:{ asOf:'2026-08-01' }, kind:'окончательный', recipient:'a-mf' });
  const n0 = RP.state.issues.length;
  const noRole = RP.migrationRevision({ period:'декабрь 2025', why:'x', totals:{ 'kr-6':{ debt_main:6300000 } } });
  as('buh');
  const noWhy = RP.migrationRevision({ period:'декабрь 2025', totals:{ 'kr-6':{ debt_main:6300000 } } });
  const own = RP.migrationRevision({ period:'июль 2026', why:'x', totals:{ 'kr-6':{ debt_main:1 } } });
  const lostM = RP.migrationRevision({ period:'ноябрь 2024', why:'x', totals:{ 'kr-6':{ debt_main:1 } } });
  const addT = RP.migrationRevision({ period:'июль 2025', why:'x', totals:{ 'kr-1':{ debt_main:1 } } });
  const was01 = SEAM.statSlice('s-portfolio', null, {}, '2026-01-01', RP.viewer().scope).value;
  const rev = RP.migrationRevision({ period:'декабрь 2025', why:'перенос М-1 взял остаток КД-2025/126 до последней проводки декабря',
    totals:{ 'kr-6':{ debt_main:6300000 } } });
  const now01 = SEAM.statSlice('s-portfolio', null, {}, '2026-01-01', RP.viewer().scope).value;
  const same = RP.migrationRevision({ period:'декабрь 2025', why:'повтор', totals:{ 'kr-6':{ debt_main:6300000 } } });
  const log = RP.rewriteLog();
  ok(224, !noRole.ok && has(noRole.why, 'утверждает человек') && !noWhy.ok && has(noWhy.why, 'без основания') &&
        !own.ok && has(own.why, 'открытием периода') && !lostM.ok && has(lostM.why, 'перенос не дал') &&
        !addT.ok && has(addT.why, 'дополняется целиком: не хватает строк') && !same.ok && has(same.why, 'версия без замен') &&
        rev.ok && rev.release === 'М-2' && log.length === 1 && log[0].by === 'Бекова Н.' && log[0].release === 'М-2' &&
        log[0].was === 6100000 && log[0].now === 6300000 && has(log[0].what, 'итог на 01.01.2026 · КД-2025/126') &&
        was01 === 77000000 && now01 === 77200000 && RP.migrations().length === 2 && RP.migrations()[1].of === 'М-1',
    `правка периода из легаси — новая версия миграции ${rev.release}: утверждает человек (${log[0].by}), основание обязательно, ` +
    `строка журнала перезаписи «было → стало» (${log[0].was} → ${log[0].now}); итог на 01.01.2026 ${was01} → ${now01}; ` +
    `свой период, не перенесённый месяц, частичный итог месяцу без итога и версия без замен — отказы (ADR-0307 п. 6, ADR-0311 п. 4)`);

  const I = id => RP.state.issues.find(i => i.id === id);
  const rc = RP.recompute(f4.id);
  const lyBefore = I(fLy.id).diverged, n1 = RP.state.issues.length;
  const evRev = RP.migrationRevision({ period:'июль 2025', why:'событие pm-5 перенесено с ошибкой суммы',
    events:{ 'pm-5':{ amount:1150000 } } });
  ok(225, rev.marked.join() === f4.id && I(f4.id).diverged && has(I(f4.id).divergedWhy, 'числа изменились после сдачи: новая версия миграции М-2') &&
        rc.diffs.length === 1 && rc.diffs[0].name === 'Остаток основного долга, всего × «На начало года»' &&
        !I(fOv.id).diverged && !I(fPre.id).diverged && !lyBefore && n1 === n0 && RP.state.issues.length === n0 &&
        I(f4.id).kind === 'окончательный' && !I(f4.id).correctedBy &&
        evRev.ok && evRev.release === 'М-3' && evRev.marked.indexOf(fLy.id) !== -1 && evRev.marked.indexOf(f4.id) !== -1 &&
        has(I(fLy.id).divergedWhy, 'М-3 (июль 2025)') && has(I(f4.id).divergedWhy, '; затем новая версия миграции М-3'),
    `выпуски на прежних числах метятся «числа изменились после сдачи», как при перезакрытии (ИО-34): ${f4.id} — через ` +
    `колонку «На начало года»; выпуск без этой колонки и предварительный не метятся; новых выпусков нет — не ` +
    `переиздаются; правка события июля 2025 (месяц без итога) — версия ${evRev.release}, метит ${evRev.marked.join(', ')}, ` +
    `причины у выпуска копятся`);

  const act = RP.periodActions('декабрь 2025'), re = RP.reopenPeriod('декабрь 2025', 'правка');
  RP.state.view = 'journal'; const jr = win.VIEWS.journal.fn();
  as('auth');
  ok(226, act.actions.length === 0 && act.origin === 'легаси' && act.release === 'М-2' && !re.ok &&
        has(re.why, 'действия «открыть» у него нет') && RP.periods()['декабрь 2025'].state === 'закрыт' &&
        RP.periods()['июль 2025'].revisions.join() === 'М-3' &&
        has(jr, 'Журнал перезаписи') && has(jr, 'итог на 01.01.2026 · КД-2025/126 · остаток основного долга') &&
        has(jr, '6 100 000 → 6 300 000') && has(jr, 'числа изменились после сдачи: новая версия миграции М-2') &&
        has(jr, 'декабрь 2025 — правка версией М-2') && has(jr, 'Новая версия миграции') && !has(jr, 'RP.reopenPeriod(\'декабрь 2025'),
    `после правки период по-прежнему закрыт из легаси и действия «открыть» у него нет; журнал выпусков печатает ` +
    `журнал перезаписи, версию у периода и метку у выпуска (ADR-0207 п. 4, ADR-0307 п. 6)`);

  RP.seed(); as('auth');
  RP.state.view = 'issue'; RP.state.sel.tpl = 't-port-ly'; RP.state.sel.params = { asOf:'2026-08-01', dept:'' };
  RP.state.sel.view = null; RP.state.sel.twist = null; RP.state.sel.chart = false; RP.state.sel.time = null;
  const s1 = win.VIEWS.issue.fn();
  const sc = win.VIEWS.showcase.fn();
  ok(227, has(s1, 'На отчётную дату — прошлый год') && (s1.match(/>в легаси не собиралось</g) || []).length === 2 &&
        has(s1, 'итог месяца не перенесён (июль 2025)') && has(s1, 'нет в легаси') && has(s1, '1 200 000') &&
        !has(s1, 'Не закрыты:') && has(sc, 'Портфель к прошлому году'),
    `экраны: форма «Портфель к прошлому году» — две пустые клетки «в легаси не собиралось» и поток июля 2025 из ` +
    `событий, паспорт называет клетки; форма стоит в витрине`);
})();

/* ---- II. Итог месяцу из легаси без итога — новой версией миграции (ОГ-Д13, ADR-0311), волна 39 ---- */
(() => {
  RP.seed(); as('auth');
  const I = id => RP.state.issues.find(i => i.id === id);
  const fLy = RP.issue('t-port-ly', { params:{ asOf:'2026-08-01' }, kind:'окончательный', recipient:'a-mf' });
  const f4  = RP.issue('t-pay04', { params:{ asOf:'2026-08-01' }, kind:'окончательный', recipient:'a-mf' });
  const fPre = RP.issue('t-port-ly', { params:{ asOf:'2026-08-01' }, kind:'предварительный' });
  const n0 = RP.state.issues.length;
  const arch = vm.runInContext("clone(LEGACY_ARCHIVE['июль 2025'])", sandbox);
  const why = 'найден архив сальдо за июль 2025 г.';
  const noRole = RP.migrationRevision({ period:'июль 2025', why, totals: arch });
  as('buh');
  const part = Object.assign({}, arch); delete part['kr-4']; delete part['kr-6'];
  const partial = RP.migrationRevision({ period:'июль 2025', why, totals: part });
  const extra = RP.migrationRevision({ period:'июль 2025', why, totals: Object.assign({ 'kr-7':{ debt_main:1, days:0, status:'действует' } }, arch) });
  const noField = RP.migrationRevision({ period:'июль 2025', why, totals: Object.assign({}, arch, { 'kr-3':{ debt_main:2700000 } }) });
  const untouched = !RP.hasSnapshot('2025-08-01') && RP.rewriteLog().length === 0 && RP.migrations().length === 1 &&
    SEAM.periodSource('июль 2025').totals === false;
  ok(228, !noRole.ok && has(noRole.why, 'утверждает человек') &&
        !partial.ok && has(partial.why, 'дополняется целиком: не хватает строк КД-2025/088, КД-2025/126') &&
        !extra.ok && has(extra.why, 'КД-2026/007') && has(extra.why, 'не действовал') &&
        !noField.ok && has(noField.why, 'КД-2025/014') && has(noField.why, 'дней просрочки') && untouched,
    `итог дополняется только целиком и только человеком: частичный — «${partial.why.slice(0, 90)}…»; строка договора, ` +
    `которого тогда не было, и строка без величины — отказ; стенд не тронут (ADR-0311 п. 4)`);

  const rev = RP.migrationRevision({ period:'июль 2025', why, totals: arch });
  const ps = SEAM.periodSource('июль 2025'), log = RP.rewriteLog();
  const cr = SEAM.statRows('credit', '2025-08-01', {}, RP.viewer().scope);
  const sl = SEAM.statSlice('s-portfolio', null, {}, '2025-08-01', RP.viewer().scope);
  const sum = Object.values(arch).reduce((a, r) => a + r.debt_main, 0);
  const act = RP.periodActions('июль 2025');
  ok(229, rev.ok && rev.release === 'М-2' && rev.added === 7 && log.length === 7 && log.every(w => w.was === null && w.release === 'М-2' &&
        w.by === 'Бекова Н.' && w.why === why) && has(log[0].what, 'итог на 01.08.2025 · КД-2024/117 · строка итога добавлена') &&
        log[0].now === '10 800 000 · 0 дн. · действует' &&
        ps.totals === true && ps.totalsBy === 'М-2' && RP.hasSnapshot('2025-08-01') &&
        !cr.missing && !cr.never && cr.rows.length === 7 && sl.value === sum && sum === 85900000 && !sl.never &&
        act.actions.length === 0 && act.origin === 'легаси' && RP.periods()['июль 2025'].state === 'закрыт',
    `новая версия миграции ${rev.release} дала итог июлю 2025 г.: ${log.length} строк журнала «было: нет → стало», ` +
    `шов на 01.08.2025 отдаёт ${cr.rows.length} строк, портфель ${sl.value}; месяц по-прежнему закрыт из легаси, «открыть» нет ` +
    `(ADR-0311 п. 1–2)`);

  const rc = RP.recompute(fLy.id);
  ok(230, rev.marked.join() === fLy.id && I(fLy.id).diverged &&
        has(I(fLy.id).divergedWhy, 'числа изменились после сдачи: новая версия миграции М-2 (июль 2025: итог дополнен)') &&
        rc.diffs.length === 2 && rc.diffs.every(d => d.was === null && d.now != null) &&
        rc.diffs.some(d => d.name === 'Остаток основного долга, всего × «На отчётную дату — прошлый год»' && d.now === 85900000) &&
        !I(f4.id).diverged && !I(fPre.id).diverged && RP.state.issues.length === n0 && I(fLy.id).kind === 'окончательный' &&
        I(fLy.id).snapshot.timeTable.rows.find(r => r.id === 's-portfolio').cells.find(c => c.col === 'c-nly').value === null,
    `сданная пустота стала расхождением: ${fLy.id} помечен «${I(fLy.id).divergedWhy}», клеток изменилось ${rc.diffs.length} ` +
    `(было пусто → число); ФО-04 (поток июля не менялся) и предварительный выпуск не помечены; сданный снимок не ` +
    `переписан, новых выпусков нет (ИО-34, ADR-0311 п. 3)`);

  as('auth');
  const fc = RP.formColumns('t-port-ly', '2026-08-01');
  const cell = (rid, cid) => fc.rows.find(r => r.id === rid).cells.find(c => c.col === cid);
  const col = fc.cols.find(c => c.id === 'c-nly');
  const soft = RP.show('t-port-ly', { asOf:'2026-08-01', dept:'' }, null).data.soft;
  const cor = RP.corrective(fLy.id), corRec = I(cor.id);
  ok(231, fc.ok && cell('s-portfolio', 'c-nly').value === 85900000 && cell('s-overdue-cnt', 'c-nly').value === 1 &&
        !cell('s-portfolio', 'c-nly').gap && fc.legacyGaps.length === 0 && cell('pay-sum', 'c-mly').value === 1200000 &&
        has(col.source, 'новые версии: июль 2025 — М-2 (итог дополнен)') && soft.length === 0 &&
        cor.ok && corRec.kind === 'окончательный' && corRec.correctionOf === fLy.id && !corRec.passport.legacyGaps &&
        corRec.snapshot.timeTable.rows.find(r => r.id === 's-portfolio').cells.find(c => c.col === 'c-nly').value === 85900000,
    `форма на 01.08.2026: «На отчётную дату — прошлый год» — ${cell('s-portfolio', 'c-nly').value} и просроченных ` +
    `${cell('s-overdue-cnt', 'c-nly').value}, пустых клеток нет; паспорт колонки называет версию; уточнение — корректирующим ` +
    `выпуском ${cor.id} по решению человека (ADR-0311 п. 3)`);

  as('buh');
  const again = RP.migrationRevision({ period:'июль 2025', why:'повтор', totals: arch });
  const fix = RP.migrationRevision({ period:'июль 2025', why:'в архиве опечатка по КД-2025/014',
    totals:{ 'kr-3':{ debt_main:2750000 } } });
  RP.state.view = 'journal'; const jr = win.VIEWS.journal.fn();
  RP.state.view = 'issue'; RP.state.sel.tpl = 't-port-ly'; RP.state.sel.params = { asOf:'2026-08-01', dept:'' };
  RP.state.sel.view = null; RP.state.sel.twist = null; RP.state.sel.chart = false; RP.state.sel.time = null;
  const s1 = win.VIEWS.issue.fn();
  ok(232, !again.ok && has(again.why, 'версия без замен') && fix.ok && fix.release === 'М-3' && fix.added === 0 &&
        RP.rewriteLog().length === 8 && RP.rewriteLog()[7].was === 2700000 && RP.rewriteLog()[7].now === 2750000 &&
        has(jr, 'итог июля 2025 по найденному архиву сальдо') && has(jr, 'нет (итог не перенесён) → 10 800 000 · 0 дн. · действует') &&
        has(jr, 'июль 2025 — правка версией М-2 (итог дополнен), М-3') &&
        has(s1, '85 950 000') && !has(s1, '>в легаси не собиралось<') && !has(s1, 'итог месяца не перенесён'),
    `после дополнения месяц правится как любой перенесённый (${fix.release}: замена, а не дополнение), повтор архива — ` +
    `«версия без замен»; журнал выпусков печатает добавленные строки и кнопку демо, форма — числа вместо пустых клеток`);

  RP.seed(); as('auth');
  const back = RP.formColumns('t-port-ly', '2026-08-01');
  ok(233, !RP.hasSnapshot('2025-08-01') && SEAM.periodSource('июль 2025').totals === false && !SEAM.periodSource('июль 2025').totalsBy &&
        back.legacyGaps.length === 2 && RP.rewriteLog().length === 0 && !/модель пока не решила/.test(m[1]),
    `затравка возвращает стенд: снимка на 01.08.2025 нет, июль 2025 снова без итога, пустых клеток ${back.legacyGaps.length}; ` +
    `заглушки «модель пока не решила» в макете нет`);
})();

/* ---- JJ. Итоги концов месяцев 2025 г. в данных стенда (пробел волны 37), волна 40 ---- */
(() => {
  RP.seed(); as('auth');
  const ev = c => vm.runInContext(c, sandbox);
  const H = ev('HIST'), D = ev('HIST_DATES.slice()'), ARCH = ev("clone(LEGACY_ARCHIVE['июль 2025'])");
  const P = RP.periods(), lm = Object.keys(P).filter(m => P[m].origin === 'легаси');
  const endOf = m => ev(`firstOfNext(monthIso(${JSON.stringify(m)}))`);
  const withTot = lm.filter(m => SEAM.periodSource(m).totals);
  const credits = RP.objects();
  const setOk = d => Object.keys(H[d]).sort().join() === credits.filter(o => o.issued < d && (!o.closed || o.closed >= d))
    .map(o => o.id).sort().join();
  const d25 = D.filter(d => d < '2026-01-01');
  ok(234, lm.length === 13 && withTot.length === 12 && withTot.every(m => RP.hasSnapshot(endOf(m))) &&
        !RP.hasSnapshot(endOf('июль 2025')) && d25.length === 11 && d25.every(setOk) && setOk('2026-01-01') &&
        D.join() === D.slice().sort().join() && !RP.hasSnapshot('2024-12-01'),
    `у каждого из ${withTot.length} месяцев из легаси с итогом есть снимок на конец (2025 г. — ${d25.length} дат), у июля ` +
    `2025 (без итога) — нет; состав каждого снимка — договоры, выданные раньше конца месяца`);

  const dm = (d, id) => (H[d][id] || {}).debt_main;
  const mono = ['kr-1', 'kr-2', 'kr-3', 'kr-4', 'kr-5', 'kr-6', 'kr-8'].every(id => {
    const v = D.filter(d => d <= '2026-01-01' && H[d][id]).map(d => dm(d, id));
    return v.every((x, i) => i === 0 || x <= v[i - 1]); });
  ok(235, dm('2025-03-01', 'kr-2') - dm('2025-04-01', 'kr-2') === 600000 &&
        dm('2025-06-01', 'kr-2') - dm('2025-07-01', 'kr-2') === 600000 &&
        dm('2025-09-01', 'kr-2') - dm('2025-10-01', 'kr-2') === 500000 && dm('2025-12-01', 'kr-2') === dm('2026-01-01', 'kr-2') &&
        dm('2025-07-01', 'kr-1') - dm('2025-09-01', 'kr-1') === 1200000 && dm('2025-12-01', 'kr-1') - dm('2026-01-01', 'kr-1') === 1200000 &&
        ARCH['kr-2'].debt_main === dm('2025-07-01', 'kr-2') && ARCH['kr-1'].debt_main === dm('2025-09-01', 'kr-1') &&
        H['2025-09-01']['kr-2'].days === 49 && H['2025-10-01']['kr-2'].days === 0 && mono,
    `итоги сведены с событиями переноса: КД-2024/203 гасится pm-1, pm-2 и pm-3 (500 000 — сумма, как её знал перенос), ` +
    `пропуск декабря не меняет остаток; КД-2024/117 — pm-5 и pm-6; найденный архив июля ложится между июнем и августом; ` +
    `остатки 2025 г. не растут`);

  const asOfs = ['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01'];
  const nly = asOfs.map(d => RP.formColumns('t-port-ly', d)).map(fc => fc.rows.find(r => r.id === 's-portfolio').cells.find(c => c.col === 'c-nly'));
  const fc7 = RP.formColumns('t-port-ly', '2026-07-01');
  const fin7 = RP.issue('t-port-ly', { params:{ asOf:'2026-07-01' }, kind:'окончательный', recipient:'a-mf' });
  const rec7 = RP.state.issues.find(i => i.id === fin7.id);
  ok(236, nly.every(c => typeof c.value === 'number' && !c.gap) && nly[6].value === 83350000 && nly[5].value === 86550000 &&
        nly[0].value === 43300000 && fc7.gaps.length === 0 && fc7.legacyGaps.length === 0 &&
        has(fc7.cols.find(c => c.id === 'c-nly').source, 'из легаси') &&
        fin7.ok && rec7.kind === 'окончательный' && !has(rec7.note, 'ИО-8'),
    `«Портфель к прошлому году»: колонка «На отчётную дату — прошлый год» на 01.01…01.07.2026 даёт числа ` +
    `(${nly.map(c => c.value).join(', ')}); выпуск на 01.07.2026 — окончательный, а не предварительный «снимка на 01.07.2025 нет»`);

  const fc8 = RP.formColumns('t-port-ly', '2026-08-01');
  /* Свой месяц без снимка: снимок 01.03.2026 (волна 41) на время проверки убирается. */
  vm.runInContext("delete HIST['2026-03-01']; HIST_DATES.splice(HIST_DATES.indexOf('2026-03-01'), 1)", sandbox);
  const soft3 = RP.show('t-port-ly', { asOf:'2026-03-01', dept:'' }, null).data.soft;
  RP.seed(); as('auth');
  ok(237, fc8.legacyGaps.length === 2 && fc8.rows.find(r => r.id === 's-portfolio').cells.find(c => c.col === 'c-nly').gap === 'в легаси не собиралось' &&
        soft3.some(x => has(x, 'колонка «На отчётную дату»: снимка на 01.03.2026 нет')) && !soft3.some(x => has(x, 'прошлый год')),
    `границы не сдвинулись: конец июля 2025 (без итога) — по-прежнему пустота «в легаси не собиралось»; свой месяц без ` +
    `снимка (01.03.2026) по-прежнему делает выпуск предварительным, колонка прошлого года — нет (ИО-8)`);

  const p8 = SEAM.statRows('payment', '2025-08-01', {}, RP.viewer().scope);
  const p10 = SEAM.statRows('payment', '2025-10-01', {}, RP.viewer().scope);
  const c8 = SEAM.statRows('credit', '2025-08-01', {}, RP.viewer().scope);
  ok(238, !p8.missing && p8.substituted === null && p8.rows.some(r => r.id === 'pm-5') && has(p8.passport.depth, 'события переноса') &&
        !p10.missing && p10.rows.find(r => r.id === 'pm-3').amount === 500000 && p10.substituted === null &&
        c8.missing && c8.never,
    `шов платежей на дату внутри 2025 г. отвечает событиями переноса, а не «снимка нет»: на 01.08.2025 — ${p8.rows.length} ` +
    `платежа, включая июльский pm-5, без подстановки; pm-3 на 01.10.2025 — 500 000, как его знал перенос; итог на ` +
    `01.08.2025 — по-прежнему «нет»`);

  RP.state.view = 'issue'; RP.state.sel.tpl = 't-port-ly'; RP.state.sel.params = { asOf:'2026-07-01', dept:'' };
  RP.state.sel.view = null; RP.state.sel.twist = null; RP.state.sel.chart = false; RP.state.sel.time = null;
  const s7 = win.VIEWS.issue.fn();
  ok(239, has(s7, '83 350 000') && !has(s7, 'снимка на 01.07.2025 нет') && !has(s7, '>в легаси не собиралось<'),
    `экран формы на 01.07.2026: в колонке прошлого года — 83 350 000, без «снимка нет»`);
})();

/* ---- KK. Хвост ОГ-Д6: снимки своих месяцев 2026 г., методика между датами, подписка на вид,
        сигнал по фильтру и «в любой строке» (ADR-0285, ADR-0287), волна 41 ---- */
(() => {
  RP.seed(); as('auth');
  const ev = c => vm.runInContext(c, sandbox);
  const H = ev('HIST'), sc = RP.viewer().scope;
  const own = ['2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01'];
  const pf = d => SEAM.statSlice('s-portfolio', null, {}, d, sc).value;
  const f4 = RP.formColumns('t-pay04', '2026-03-01'), ly3 = RP.formColumns('t-port-ly', '2026-03-01');
  const fin3 = RP.issue('t-port-ly', { params:{ asOf:'2026-03-01' }, kind:'окончательный', recipient:'a-mf' });
  const rec3 = RP.state.issues.find(i => i.id === fin3.id);
  ok(240, own.every(d => RP.hasSnapshot(d)) && !H['2026-02-01']['kr-7'] && H['2026-03-01']['kr-7'].debt_main === 2500000 &&
        H['2026-03-01']['kr-2'].debt_main - H['2026-04-01']['kr-2'].debt_main === 400000 &&
        H['2026-05-01']['kr-6'].days === 1 && H['2026-06-01']['kr-6'].days === 32 &&
        own.every((d, i) => ['kr-1', 'kr-3', 'kr-4', 'kr-5', 'kr-8'].every(id => H[d][id].debt_main <= H[i ? own[i - 1] : '2026-01-01'][id].debt_main &&
          H[d][id].debt_main >= H['2026-06-01'][id].debt_main)) &&
        pf('2026-03-01') === 76150000 && f4.rows.find(r => r.id === 's-portfolio').cells.find(c => c.col === 'c-now').value === 76150000 &&
        ly3.gaps.length === 0 && fin3.ok && rec3.kind === 'окончательный' &&
        RP.periodActions('февраль 2026').actions.indexOf('открыть заново') !== -1,
    `снимки своих месяцев 01.02…01.05.2026: портфель ${own.map(pf).join(' · ')}; КД-2026/007 входит с 01.03, КД-2024/203 ` +
    `гасит pm-8 (400 000) в марте; колонка «На отчётную дату» на 01.03.2026 — число, выпуск окончательный`);

  const fc7 = RP.formColumns('t-port-ly', '2026-07-01');
  const cnt = fc7.rows.find(r => r.id === 's-overdue-cnt'), port = fc7.rows.find(r => r.id === 's-portfolio');
  const fin7 = RP.issue('t-port-ly', { params:{ asOf:'2026-07-01' }, kind:'окончательный', recipient:'a-mf' });
  const rec7 = RP.state.issues.find(i => i.id === fin7.id);
  const fc8 = RP.formColumns('t-port-ly', '2026-08-01');
  ok(241, has(cnt.method, 'методика изменилась между датами — сравнение некорректно: версия 2 с 01.01.2026') &&
        has(cnt.method, '«На отчётную дату» — версия 2') && has(cnt.method, '«На отчётную дату — прошлый год» — версия 1') &&
        !port.method && fc7.methods.length === 1 && has(fc7.methods[0], 'Кредитов с просрочкой: методика изменилась') &&
        fin7.ok && rec7.passport.methods.length === 1 &&
        rec7.snapshot.timeTable.rows.find(r => r.id === 's-overdue-cnt').cells.find(c => c.col === 'c-nly').ver === 1 &&
        rec7.snapshot.timeTable.rows.find(r => r.id === 's-overdue-cnt').cells.find(c => c.col === 'c-now').ver === 2 &&
        fc8.methods.length === 0,
    `смена методики между датами колонок помечена у строки и в паспорте; выпуск хранит версию каждой клетки ` +
    `(прошлый год — 1, отчётная дата — 2); на 01.08.2026 клетка прошлого года пуста — пометки нет (ADR-0285 п. 2, 4)`);

  const P7 = { asOf:'2026-07-01', dept:'' };
  const cx = RP.timeAnswer('t-port-ly', { mode:'сравнение', a:'2025-07-01', b:'2026-07-01' }, P7);
  const cin = RP.timeAnswer('t-port-ly', { mode:'сравнение', a:'2026-06-01', b:'2026-08-01' }, P7);
  const dx = RP.timeAnswer('t-port-ly', { mode:'динамика', from:'2025-11-01', to:'2026-02-01' }, P7);
  ok(242, cx.ok && has(cx.rows.find(r => r.id === 's-overdue-cnt').method, 'сравнение некорректно') &&
        cx.rows.find(r => r.id === 's-portfolio').method === null && cin.ok && cin.rows.every(r => !r.method) &&
        dx.ok && has(dx.tracks.find(x => x.id === 's-overdue-cnt').method, 'версия 2 с 01.01.2026') &&
        !dx.tracks.find(x => x.id === 's-portfolio').method,
    `сравнение 01.07.2025 → 01.07.2026 и динамика через 01.01.2026 помечают «Кредитов с просрочкой»; внутри одной ` +
    `версии и у показателя без версий пометки нет (ADR-0285 п. 2)`);

  const vw = RP.saveView('t-overdue', 'крупные', { cuts:['dept'] }, { filter:{ groups:[[{ field:'debt_main', op:'больше', value:5000000 }]] } });
  as('user'); const alien = RP.subscribe('t-overdue', { freq:'ежемесячно', view: vw.id }); as('auth');
  const sub = RP.subscribe('t-overdue', { freq:'ежемесячно', view: vw.id });
  RP.nightRun('2026-07-01');
  const n7 = RP.notices().find(n => n.kind === 'подписка' && n.at === '2026-07-01');
  RP.deleteView(vw.id);
  RP.nightRun('2026-08-01'); RP.nightRun('2026-08-01');
  const broken = RP.notices().filter(n => n.kind === 'подписка' && has(n.text, 'подписка на вид не посчитана'));
  ok(243, vw.ok && !alien.ok && has(alien.why, 'подписываются на свой вид') && sub.ok &&
        has(n7.text, '· вид «крупные» на 01.07.2026') && has(n7.text, 'Сумма просроченной задолженности — 10 800 000') &&
        has(n7.text, 'фильтр: Остаток основного долга больше') && has(n7.mail, 'без чисел') &&
        broken.length === 1 && has(broken[0].text, 'вида нет'),
    `подписка на свой вид считает отчёт видом и его фильтром: «${n7.text.slice(0, 110)}…»; чужой вид — отказ; вид ` +
    `удалён — одно уведомление «не посчитана», а не молчание и не повтор (ADR-0287 п. 1)`);

  RP.seed(); as('auth');
  const each = RP.addSignal('t-overdue', { stat:'s-overdue-sum', cmp:'больше', value:5000000, each:'dept' });
  const badEach = RP.addSignal('t-overdue', { stat:'s-overdue-sum', cmp:'больше', value:1, each:'moon' });
  const badF = RP.addSignal('t-overdue', { stat:'s-overdue-sum', cmp:'больше', value:1, filter:{ groups:[[{ field:'moon', op:'больше', value:1 }]] } });
  const runs = ['2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01'].map(d => RP.nightRun(d).fired.length);
  const sn = RP.notices().filter(n => n.kind === 'сигнал');
  const hs = RP.mySubs().find(x => x.id === each.id).history;
  ok(244, each.ok && !badEach.ok && has(badEach.why, 'по разрезу отчёта') && !badF.ok && has(badF.why, 'фильтр условия') &&
        runs.join() === '0,1,0,1,0' && sn.length === 2 &&
        has(sn[0].text, 'стало выполняться на 01.05.2026: Региональное представительство «Ош» — 5 550 000 (было 0)') &&
        has(sn[1].text, 'на 01.07.2026: Отраслевой департамент промышленности — 5 600 000 (было 0)') &&
        hs[1].rows.join() === 'rep-osh' && hs[3].rows.length === 2 && hs[4].rows.join() === 'dep-prom',
    `сигнал «в любой строке» разреза «подразделение»: Ош — на 01.05.2026, промышленность — на 01.07.2026, с прежним значением строки «(было 0)»; ` +
    `по каждой строке один раз, на переходе (сработало по прогонам ${runs.join(', ')}) (ADR-0287 п. 2)`);

  const vw2 = RP.saveView('t-overdue', 'крупные', null, { filter:{ groups:[[{ field:'debt_main', op:'больше', value:5000000 }]] } });
  const sv = RP.addSignal('t-overdue', { stat:'s-overdue-cnt', cmp:'больше', value:0, view: vw2.id });
  const both = RP.addSignal('t-overdue', { stat:'s-overdue-cnt', cmp:'больше', value:0, view: vw2.id, filter:{ top:{ n:1, by:'debt_main' } } });
  const before = RP.notices().length;
  RP.nightRun('2026-05-01'); RP.nightRun('2026-06-01');
  const sv5 = RP.notices().slice(before).filter(n => n.sub === sv.id);
  RP.deleteView(vw2.id); RP.nightRun('2026-07-01'); RP.nightRun('2026-08-01');
  const svAll = RP.notices().filter(n => n.sub === sv.id);
  ok(245, sv.ok && !both.ok && has(both.why, 'либо свой, либо вида') && sv5.length === 1 &&
        has(sv5[0].text, '(фильтр вида «крупные»: Остаток основного долга больше') && has(sv5[0].text, 'на 01.05.2026 (1)') &&
        svAll.length === 2 && has(svAll[1].text, 'условие больше не проверяется — вида больше нет'),
    `сигнал по фильтру своего вида: сработал на 01.05.2026 (1 крупный договор с просрочкой); вид удалён — одно ` +
    `уведомление «больше не проверяется», дальше тишина без ложных срабатываний`);

  RP.seed(); as('auth');
  RP.state.view = 'issue'; RP.state.sel.tpl = 't-port-ly'; RP.state.sel.params = { asOf:'2026-07-01', dept:'' };
  RP.state.sel.view = null; RP.state.sel.twist = null; RP.state.sel.chart = false; RP.state.sel.time = null;
  const s7 = win.VIEWS.issue.fn();
  RP.addSignal('t-overdue', { stat:'s-overdue-sum', cmp:'больше', value:5000000, each:'dept' }); RP.nightRun('2026-05-01');
  const subsScr = win.VIEWS.subs.fn();
  ok(246, has(s7, '<sup class="fn">м</sup>') && has(s7, 'методика изменилась между датами') && has(s7, '>методика<') &&
        has(subsScr, 'Региональное представительство «Ош» — 5 550 000'),
    `экраны: форма на 01.07.2026 — пометка «м» у строки и сноска о смене методики, паспорт — строка «методика»; ` +
    `подписки — уведомление сигнала по строке`);
})();

/* ---- LL. Майский взнос и сверка «остаток ↔ события»; смена методики после утверждения формы
        (ADR-0285 п. 3), волна 42 ---- */
(() => {
  RP.seed(); as('auth');
  const ev = c => vm.runInContext(c, sandbox);
  const H = ev('HIST'), D = ev('HIST_DATES.slice()'), O = ev('OBJECTS');
  const pays = O.filter(o => o.type === 'payment' && o.kind === 'основной долг');
  /* Сверка: изменение остатка между соседними снимками против основных платежей между ними
     (сумма — как её знал поздний снимок). ДОПУЩЕНИЕ СТЕНДА (подтверждено владельцем 17.10.2026):
     погашения по графику событиями не заводятся — снижение остатка без события законно; сверка
     сторожит, что роста без события нет и что договоры, ведомые событиями, сходятся. */
  const gaps = [];
  for (let i = 1; i < D.length; i++) { const a = D[i - 1], b = D[i];
    Object.keys(H[b]).forEach(id => { if (!H[a][id]) return;
      const delta = H[a][id].debt_main - H[b][id].debt_main;
      const evs = pays.filter(p => p.credit === id && p.date >= a && p.date < b)
        .reduce((x, p) => x + (p.was && b < p.was.until ? p.was.amount : p.amount), 0);
      if (delta !== evs) gaps.push({ id, a, b, delta, evs }); }); }
  const kr2 = gaps.filter(g => g.id === 'kr-2'), kr1 = gaps.filter(g => g.id === 'kr-1');
  const f6 = RP.formColumns('t-pay04', '2026-06-01');
  const may = f6.rows.find(r => r.id === 'pay-sum').cells.find(c => c.col === 'c-m');
  ok(247, kr2.length === 2 && kr2.every(g => g.a >= '2026-06-01') && kr1.every(g => g.a >= '2026-01-01') &&
        !gaps.some(g => g.a === '2026-05-01' && g.id === 'kr-2') && gaps.every(g => g.delta > 0 && g.evs === 0) &&
        may.value === 500000 && f6.rows.find(r => r.id === 'pay-cnt').cells.find(c => c.col === 'c-m').value === 1,
    `майский взнос КД-2024/203 (pm-9, 500 000) закрыл разрыв 01.05 → 01.06.2026: поток за май — ${may.value}; сверка ` +
    `«остаток ↔ события»: КД-2024/203 сходится по 01.06.2026, КД-2024/117 — весь 2025 г.; остальные ${gaps.length} ` +
    `снижений остатка — погашения по графику без событий (допущение стенда), роста без события нет`);

  const pend = RP.methodPending('t-pay04'), auth = RP.notices().filter(n => n.kind === 'методика');
  as('user'); const userN = RP.notices().filter(n => n.kind === 'методика'); as('auth');
  ok(248, pend.length === 1 && pend[0].stat === 's-avg-late' && pend[0].n === 2 && pend[0].declared === '2026-08-22' &&
        RP.methodPending('t-port-ly').length === 0 && RP.methodPending('t-overdue').length === 0 &&
        auth.length === 1 && has(auth[0].text, '«Погашения и портфель за период»: показатель формы изменился — «Средняя просрочка» изменён 22.08.2026: версия 2 с 01.09.2026') &&
        has(auth[0].text, 'Подтвердите новую редакцию') && userN.length === 0,
    `версия «Средней просрочки», объявленная 22.08.2026 после утверждения формы (20.08), ставит форму в «ожидает ` +
    `решения»; уполномоченный получает уведомление, пользователь — нет; версия «Кредитов с просрочкой» с запуска ` +
    `(раньше утверждения) решения не ждёт (ADR-0285 п. 3)`);

  const f8 = RP.issue('t-pay04', { params:{ asOf:'2026-08-01' }, kind:'окончательный', recipient:'a-mf' });
  const rec8 = RP.state.issues.find(i => i.id === f8.id);
  /* Даты новой версии: снимок 01.10.2026 (состояние на 30.09) и закрытые август, сентябрь — на время проверки. */
  ev("HIST['2026-10-01'] = clone(HIST['2026-08-01']); HIST_DATES.push('2026-10-01')");
  RP.state.periods['август 2026'] = { state:'закрыт' }; RP.state.periods['сентябрь 2026'] = { state:'закрыт' };
  const f9 = RP.issue('t-pay04', { params:{ asOf:'2026-10-01' }, kind:'окончательный', recipient:'a-mf' });
  const p9 = RP.issue('t-pay04', { params:{ asOf:'2026-10-01' }, kind:'предварительный' });
  const recP9 = RP.state.issues.find(i => i.id === p9.id);
  ok(249, f8.ok && rec8.kind === 'окончательный' && !rec8.passport.awaiting &&
        !f9.ok && has(f9.why, 'форма ожидает решения по методике: «Средняя просрочка» изменён 22.08.2026: версия 2 с 01.09.2026') &&
        p9.ok && recP9.passport.awaiting.length === 1,
    `окончательная сдача на 01.08.2026 (все даты — прежней версии) проходит без пометки; на 01.10.2026 — отказ ` +
    `«${String(f9.why).slice(0, 70)}…»; предварительный выпуск законен и несёт пометку в паспорте (ADR-0285 п. 3)`);

  as('user'); const noRole = RP.confirmMethod('t-pay04'); as('auth');
  const conf = RP.confirmMethod('t-pay04');
  const t4 = RP.TPL('t-pay04'), ed2 = t4.editions.find(e => e.n === 2);
  const g9 = RP.issue('t-pay04', { params:{ asOf:'2026-10-01' }, kind:'окончательный', recipient:'a-mf' });
  const rec9 = RP.state.issues.find(i => i.id === g9.id);
  const again = RP.confirmMethod('t-pay04');
  ok(250, !noRole.ok && has(noRole.why, 'утверждает уполномоченный') && conf.ok && conf.edition === 2 &&
        ed2.state === 'утверждена' && JSON.stringify(ed2.stats) === JSON.stringify(t4.editions[0].stats) &&
        has(ed2.changed, '«Средняя просрочка» версия 2 с 01.09.2026') && RP.methodPending('t-pay04').length === 0 &&
        RP.notices().filter(n => n.kind === 'методика').length === 0 && g9.ok && rec9.ed === 2 && !rec9.passport.awaiting &&
        RP.state.issues.find(i => i.id === f8.id).ed === 1 && RP.state.issues.find(i => i.id === f8.id).kind === 'окончательный' &&
        !again.ok && has(again.why, 'не ждёт'),
    `решение — новая редакция ${conf.edition} того же состава (утвердил уполномоченный): ожидание снято, ` +
    `уведомления нет, сдача на 01.10.2026 проходит по ред. 2; сданное по ред. 1 не тронуто (ADR-0285 п. 3–4)`);
  ev("delete HIST['2026-10-01']; HIST_DATES.pop()");

  RP.seed(); as('auth');
  RP.state.view = 'issue'; RP.state.sel.tpl = 't-pay04'; RP.state.sel.params = { asOf:'2026-08-01', dept:'' };
  RP.state.sel.view = null; RP.state.sel.twist = null; RP.state.sel.chart = false; RP.state.sel.time = null;
  const s8 = win.VIEWS.issue.fn(), sub = win.VIEWS.subs.fn();
  as('user'); const s8u = win.VIEWS.issue.fn(); as('auth');
  ok(251, has(s8, 'Ожидает решения по методике.') && has(s8, 'RP.doConfirmMethod(\'t-pay04\')') &&
        has(s8u, 'Ожидает решения по методике.') && !has(s8u, 'RP.doConfirmMethod') &&
        has(sub, 'показатель формы изменился'),
    `экраны: у формы — плашка «ожидает решения по методике», кнопка «Подтвердить новую редакцию» — только ` +
    `уполномоченному; уведомление — на экране подписок`);

  RP.seed(); as('auth');
  const fc7 = RP.formColumns('t-port-ly', '2026-07-01');
  ok(252, fc7.methods.length === 1 && RP.methodPending('t-port-ly').length === 0 &&
        RP.formColumns('t-pay04', '2026-08-01').methods.length === 0,
    `пометки волны 41 не сдвинулись: «Кредитов с просрочкой» в «Портфеле к прошлому году» на 01.07.2026 — как было; ` +
    `у «Средней просрочки» до 01.09.2026 версия одна — пометки сравнения нет`);
})();

/* ---- MM. Входящие от дашборда, волна 43: провал объясняет число в любом режиме, «крупнейшие» и
        ряд по разрезу — ответ отчёта, соавтор-роль и принятие в каталог (ОД-15…ОД-28, ADR-0314) ---- */
(() => {
  RP.seed(); as('auth');
  const p = { asOf:'2026-08-01', dept:null }, tot = { path:[], stat:'s-overdue-sum' };
  const d = RP.drill('t-overdue', p, null, tot);
  const c = RP.drill('t-overdue', p, null, { path:[], stat:'s-overdue-cnt' });
  ok(253, d.ok && JSON.stringify(d.colNames) === JSON.stringify(['Заёмщик', 'Подразделение', 'Дней просрочки', 'Состояние']) &&
        d.items[0].label === 'КД-2024/203 от 20.06.2024' && d.items[0].part === 5300000 && d.items[0].share === 51.5 &&
        d.items[1].share === 48.5 && d.items[1].cut80 === true && !d.items[0].cut80 &&
        c.ok && c.count && c.weightName === 'Остаток основного долга' && c.items.map(x => x.weight).join() === '5300000,5000000',
    `ОД-15/16: колонки провала — из записи объекта (подпись «${d.items[0].label}», ${d.colNames.join(' · ')}); деньги — по ` +
    `вкладу (${d.items.map(x => x.share).join(' % · ')} %), черта «80 % числа» на второй строке; счёт — по весу «${c.weightName}»`);

  const r1 = RP.setDrillCols('credit', ['sum']);
  const withSum = RP.drill('t-overdue', p, null, tot), otherRep = RP.drill('t-sh-plan', p, null, tot);
  const bad = RP.setDrillCols('credit', ['curator']);
  as('user'); const u = RP.drill('t-overdue', p, null, tot); as('auth');
  ok(254, r1.ok && withSum.cols.indexOf('sum') !== -1 && otherRep.ok && otherRep.cols.indexOf('sum') !== -1 &&
        u.cols.indexOf('sum') === -1 && !bad.ok && has(bad.why, 'в перечне объекта нет'),
    `ОД-15: «Колонки ▾» помнится у человека на объект — «Сумма договора» у уполномоченного в двух отчётах, у ` +
    `пользователя нет; поле вне перечня объекта не добавляется`);

  const ch = RP.drillChange('t-overdue', {}, null, tot, { a:'2026-06-01', b:'2026-08-01' });
  const cmp = RP.timeAnswer('t-overdue', { mode:'сравнение', a:'2026-06-01', b:'2026-08-01' }, {});
  const prom = RP.drillChange('t-overdue', {}, null, { path:[{ by:'dept', key:'dep-prom' }], stat:'s-overdue-sum' }, { a:'2025-09-01', b:'2025-10-01' });
  const port = RP.drillChange('t-overdue', {}, null, { path:[], stat:'s-portfolio' }, { a:'2026-02-01', b:'2026-03-01' });
  const avg = RP.drillChange('t-overdue', {}, { stats:['s-overdue-sum', 's-avg-late'] }, { path:[], stat:'s-avg-late' }, { a:'2026-06-01', b:'2026-08-01' });
  const hw = id => (ch.items.find(x => x.id === id) || {});
  ok(255, ch.ok && ch.baseCell === 5400000 && ch.cell === 10300000 && ch.change === 4900000 && ch.sumDiff === ch.change &&
        ch.change === cmp.rows.find(r => r.id === 's-overdue-sum').abs &&
        hw('kr-2').how === 'пришёл' && hw('kr-2').diff === 5300000 && hw('kr-6').how === 'снизилось' && hw('kr-6').diff === -400000 &&
        prom.ok && prom.items.length === 1 && prom.items[0].how === 'ушёл: просрочка погашена' && prom.sumDiff === prom.change && prom.change === -7300000 &&
        port.ok && port.sumDiff === port.change && port.items.find(x => x.id === 'kr-7').how === 'пришёл' &&
        !avg.ok && has(avg.why, 'не складывается'),
    `ОД-17: провал «Изменения» 01.06 → 01.08.2026 — объекты на двух датах: ${ch.items.map(x => x.label.split(' ')[0]+' '+x.how+' '+x.diff).join('; ')}; ` +
    `сумма разниц ${ch.sumDiff} = изменению узла и колонке «Изменение» сравнения; уход — по причине записи объекта; у средней — отказ`);

  const st = RP.drillChange('t-overdue', {}, { cuts:['status'] }, { path:[{ by:'status', key:'просрочен' }], stat:'s-portfolio' },
    { a:'2026-06-01', b:'2026-08-01' });
  const byDept = RP.reportAnswer({ tpl:'t-overdue', form:'ответ', params:{}, dates:['2026-06-01', '2026-08-01'], by:['dept'], stats:['s-overdue-sum'] });
  const gv = (i, k) => ((byDept.answers[i].stats[0].groups || []).find(g => g.key === k) || { value:0 }).value;
  const promCh = RP.drillChange('t-overdue', {}, null, { path:[{ by:'dept', key:'dep-prom' }], stat:'s-overdue-sum' }, { a:'2026-06-01', b:'2026-08-01' });
  ok(256, st.ok && st.items.find(x => x.id === 'kr-2').how === 'перешёл из «действует»' && st.sumDiff === st.change &&
        byDept.ok && promCh.change === gv(1, 'dep-prom') - gv(0, 'dep-prom') && promCh.sumDiff === promCh.change,
    `ОД-17, ОД-9: узел по значению разреза на свою дату — КД-2024/203 «перешёл из «действует»» в «просрочен»; строка ` +
    `разреза «промышленность» в сравнении (${gv(0, 'dep-prom')} → ${gv(1, 'dep-prom')}) сходится с суммой разниц её провала`);

  const tw = { formulas:[{ id:'ф-1', name:'Доля просрочки в портфеле', a:'s-overdue-sum', op:'÷', b:'s-portfolio', k:100, unit:'%', dp:1 }] };
  const sn = RP.drill('t-overdue', p, tw, { path:[], formula:'ф-1' });
  const sg = RP.drill('t-overdue', p, tw, { path:[], formula:'ф-1' }, { side:'группа' });
  const tw2 = { formulas:[{ id:'ф-2', name:'Разница', a:'s-portfolio', op:'−', b:'s-overdue-sum', k:1, unit:'сом', dp:0 }] };
  const minus = RP.drill('t-overdue', p, tw2, { path:[], formula:'ф-2' });
  ok(257, sn.ok && sn.share === 16.1 && sn.num === 10300000 && sn.den === 64100000 && sn.sum === sn.num && sn.items.length === 2 &&
        sg.ok && sg.sum === sg.den && sg.items.length === 8 && sg.inNum === 2 && sg.items.filter(x => x.inNum).length === 2 &&
        !minus.ok && has(minus.why, 'a ÷ b'),
    `ОД-18: доля ${String(sn.share).replace('.', ',')} % = ${sn.num} ÷ ${sn.den}; «в числе» — ${sn.items.length} объекта, сумма = числителю; ` +
    `«вся группа» — ${sg.items.length}, сумма = знаменателю, «в числе» помечены ${sg.inNum}; у формулы не-доли провала нет`);

  const q = RP.drill('t-overdue', p, null, tot, { q:'ош-текстиль' });
  ok(258, q.ok && q.shown.length === 1 && q.items.length === 2 && q.sumShown === 5000000 && q.sum === 10300000 && q.equal === true &&
        q.shownText === 'показано 1 из 2 · сумма показанных 5 000 000 из 10 300 000',
    `ОД-19: поиск сужает показ, а не итог — «${q.shownText}»; сумма списка по-прежнему равна числу`);

  const w1 = RP.worklistFromDrill('t-overdue', p, null, tot, '', { q:'ош-текстиль' });
  const w2 = RP.worklistFromDrill('t-overdue', {}, null, tot, '', { a:'2026-06-01', b:'2026-08-01' });
  const fromTile = RP.reportAnswer({ tpl:'t-overdue', form:'провал', params:p, node:tot, from:'Главная', tilePath:'Главная · Просрочено' });
  const w3 = RP.worklistFromDrill('t-overdue', p, null, tot, '', { from:'Главная', tilePath:'Главная · Просрочено' });
  const W1 = RP.WL(w1.id), W2 = RP.WL(w2.id), W3 = RP.WL(w3.id);
  ok(259, w1.ok && JSON.stringify(W1.objects) === '["kr-6"]' && has(W1.fromName, 'поиск «ош-текстиль»') &&
        has(W1.name, 'на 01.08.2026') && W2.objects.length === 2 && W2.moves['kr-2'] === 'пришёл' && has(W2.name, '01.06.2026 → 01.08.2026') &&
        fromTile.ok && fromTile.version && W3.name === 'Главная · Просрочено' && has(W3.fromName, 'плитка «Главная»'),
    `ОД-20: рабочий список — показанный состав (поиском — 1 объект), в «Изменении» — с переходом; имя по умолчанию — путь ` +
    `узла, у вопроса от плитки — её путь «${W3.name}»; список у отчётности`);

  const before = RP.state.issues.length;
  const ex = RP.exportDrill('t-overdue', p, null, tot, { q:'ош-текстиль' });
  const rec = RP.state.issues.find(i => i.id === ex.id);
  const ev = c2 => vm.runInContext(c2, sandbox);
  ev('ROWS_MAX.statRows = 1');
  const big = RP.drill('t-overdue', p, null, tot), bigEx = RP.exportDrill('t-overdue', p, null, tot), job = RP.statExportJob('t-overdue', p, null, tot);
  ev('ROWS_MAX.statRows = 5000');
  ok(260, ex.ok && ex.fmt === 'xlsx' && RP.state.issues.length === before + 1 && rec.kind === 'предварительный' &&
        rec.passport.drill.shown === 1 && rec.passport.drill.of === 2 && rec.passport.drill.q === 'ош-текстиль' &&
        has(rec.passport.label, 'НЕ ОФИЦИАЛЬНЫЙ ДОКУМЕНТ') &&
        !big.ok && big.refused && !bigEx.ok && bigEx.offer === 'задание статистики на выгрузку списка' &&
        job.ok && RP.state.statJobs.length === 1 && RP.state.issues.length === before + 1,
    `ОД-21: выгрузка показанного списка — предварительный выпуск ${ex.id} (xlsx, метка, строка журнала, паспорт «показано 1 из 2»); ` +
    `выше порога statRows — отказ соседа и задание статистики ${job.id}, своего выпуска нет`);

  const cx = RP.cardContext(d, 0), cx2 = RP.cardContext(d, 1);
  const tileD = RP.drill('t-overdue', p, null, tot, { from:'Главная' });
  RP.state.view = 'issue'; RP.state.sel.tpl = 't-overdue'; RP.state.sel.params = { asOf:'2026-08-01', dept:'' };
  RP.state.sel.drillNode = tot; RP.state.sel.drillRes = d; RP.state.sel.drillCard = 0;
  const scr = win.VIEWS.issue.fn();
  ok(261, cx.pos === 1 && cx.of === 2 && cx.prev === null && cx.next === 'kr-6' && cx.back === '← к отчёту' &&
        cx.value.part === 5300000 && cx.value.share === 51.5 && cx2.prev === 'kr-2' && RP.cardContext(tileD, 0).back === '← к дашборду' &&
        has(scr, '1 из 2') && has(scr, 'В карточке — состояние сейчас') && has(scr, '← к отчёту'),
    `ОД-22: контекст карточки — отчёт, узел, вклад ${cx.value.part} (${cx.value.share} %), «${cx.pos} из ${cx.of}», соседи, ` +
    `возврат «к отчёту» или «к дашборду»; плашку рисует карточка`);

  const top = RP.topAnswer('t-overdue', p, 's-portfolio', 3), topc = RP.topAnswer('t-overdue', p, 's-overdue-cnt', 1);
  const topAvg = RP.topAnswer('t-overdue', p, 's-avg-late', 3);
  const rest = top.rows.find(r => r.key === 'остальные');
  const restD = RP.drill('t-overdue', Object.assign({}, p, { ids: rest.ids }), { stats:['s-portfolio'] }, { path:[], stat:'s-portfolio' });
  ok(262, top.ok && top.rows.length === 4 && top.rows[0].name === 'КД-2025/088 от 15.04.2025' && rest.name === 'остальные 5' &&
        top.total === top.value && top.value === 64100000 && topc.ok && topc.rows[0].key === 'kr-2' && topc.by === 'по весу' &&
        !topAvg.ok && has(topAvg.why, 'складывающегося') && restD.ok && restD.items.length === 5 && restD.sum === rest.value,
    `ОД-23: «крупнейшие 3» — ${top.rows.map(r => r.name.split(' ')[0]+' '+r.value).join('; ')}; итог ${top.total} = итогу; ` +
    `у счёта — по весу; у средней — отказ; провал «остальных» — их ${restD.items.length} объектов, сумма ${restD.sum}`);

  const ends = RP.monthEnds('2026-08-01', 24);
  const co = RP.reportAnswer({ tpl:'t-overdue', form:'ответ', params:p, dates: ends, by:['start'], stats:['s-overdue-cnt'] });
  const at = d2 => co.answers.find(a => a.asOf === d2);
  const g8 = at('2026-08-01').stats[0].groups, sum8 = g8.reduce((s2, g) => s2 + g.value, 0);
  ok(263, ends.length === 24 && ends[0] === '2024-09-01' && co.ok && co.answers.filter(a => a.gap === 'снимка нет').length === 4 &&
        at('2025-08-01').gap === 'в легаси не собиралось' && g8.find(g => g.key === 'II кв. 2024').value === 1 &&
        g8.find(g => g.key === 'III кв. 2025').value === 1 && sum8 === at('2026-08-01').stats[0].value &&
        has(co.passport.text, 'по разрезу «период начала»'),
    `ОД-24: ряд по разрезу «период начала» на 24 концах месяца — дерево на каждую дату; 4 даты «снимка нет», конец июля ` +
    `2025 г. «в легаси не собиралось», без подстановки; на 01.08.2026 сумма когорт = итогу (${sum8})`);

  const win1 = RP.show('t-overdue', p, null).data.totals.find(x => x.id === 's-overdue-sum').value;
  const ans = RP.reportAnswer({ tpl:'t-overdue', form:'ответ', params:p });
  const mv = RP.reportAnswer({ tpl:'t-overdue', form:'объекты на двух датах', params:{}, node:{ path:[], stat:'s-portfolio' }, a:'2026-06-01', b:'2026-08-01' });
  as('clerk'); const alien = RP.reportAnswer({ tpl:'t-avg', form:'ответ', params:p }); as('auth');
  const viaSeam = RP.callSeamOut('дашборд', 'reportAnswer', { tpl:'t-overdue', form:'ответ', params:p });
  ok(264, ans.ok && viaSeam.ok && viaSeam.answers[0].stats[0].value === ans.answers[0].stats[0].value && ans.answers[0].stats.find(x => x.id === 's-overdue-sum').value === win1 && mv.ok && mv.items.length === 8 &&
        mv.items.every(x => x.row && x.row.status) && mv.sumDiff === mv.change && !alien.ok && has(alien.why, 'с правами спрашивающего'),
    `ОД-2, ОД-25: reportAnswer «ответ» = окну отчёта (${win1}); «объекты на двух датах» — все ${mv.items.length} объектов с ` +
    `переходом и значением разреза на обе даты, Переходам новой формы не нужно; дашборд спрашивает тем же швом; чужой отчёт — отказ по правам`);

  RP.seed(); as('buh');
  const sc = RP.setCoauthors('t-sh-plan', ['роль:Администратор дашборда']);
  as('user'); const before2 = RP.mayEditShared('t-sh-plan');
  RP.grantRole('Администратор дашборда', 'Осмонова Г.', '2026-08-24'); const granted = RP.mayEditShared('t-sh-plan');
  RP.revokeRole('Администратор дашборда', 'Осмонова Г.'); const after2 = RP.mayEditShared('t-sh-plan');
  as('head'); const headEd = RP.mayEditShared('t-sh-plan');
  ok(265, sc.ok && has(sc.note, 'роль «Администратор дашборда» (Бекова Н., Асанов А.)') && !before2 && granted && !after2 && headEd,
    `ОД-26: соавтор — роль: держатели читаются на момент правки — Осмонова правит, пока держит роль, и перестаёт сразу ` +
    `после снятия; Асанов правит как держатель`);

  const rv = RP.revokeRole('Администратор дашборда', 'Бекова Н.');
  const t1 = RP.TPL('t-sh-plan'), big2 = RP.TPL('t-sh-big');
  as('auth'); const sh2 = RP.shelves('').shared.find(r => r.id === 't-sh-plan');
  ok(266, rv.ok && t1.owner === 'Асанов А.' && rv.moved.length === 1 && rv.moved[0].by === 'старший держатель роли' &&
        big2.owner === 'Асанов А.' && t1.editions.length === 1 && has(sh2.ownerNote, 'прежде — Бекова Н. (снята роль'),
    `ОД-27: снятие роли с владельца отчёта с соавтором-ролью — уход владельца: «${t1.name}» → ${t1.owner} (старший ` +
    `держатель); версии не порождает, полка называет прежнего владельца`);

  RP.seed(); as('user');
  const prp = RP.proposeToCatalog('t-avg'), again = RP.proposeToCatalog('t-avg');
  as('clerk'); const clerkSees = RP.maySee('t-avg');
  as('head'); const headSees = RP.maySee('t-avg');
  const hint = RP.acceptToCatalog(prp.id), acc = RP.acceptToCatalog(prp.id, { force:true });
  const cp = RP.TPL(acc.id), src = RP.TPL('t-avg');
  as('user'); const authorSees = RP.maySee(acc.id), authorEdit = RP.mayEditShared(acc.id), cpLevel = RP.levelOf(acc.id);
  RP.seed(); as('user'); const prp2 = RP.proposeToCatalog('t-avg'); as('buh');
  const onto = RP.acceptToCatalog(prp2.id, { onto:'t-pay04' });
  ok(267, prp.ok && !again.ok && !clerkSees && headSees && !hint.ok && hint.hint && hint.similar[0].id === 't-pay04' &&
        acc.ok && cpLevel === 'общий' && cp.owner === 'Асанов А.' && JSON.stringify(cp.coauthors) === '["роль:Администратор дашборда"]' &&
        cp.share.people.indexOf('Осмонова Г.') !== -1 && has(cp.editions[0].changed, 'из личного отчёта Осмонова Г.') &&
        RP.levelOf('t-avg') === 'личный' && src.owner === 'Осмонова Г.' && authorSees && !authorEdit &&
        onto.ok && RP.state.templates.filter(t => t.id.indexOf('t-cat-') === 0).length === 0,
    `ОД-28: предложение открывает личный отчёт держателям роли (делопроизводителю — нет); «похожий уже есть» — ` +
    `«${hint.similar[0].name}»; принятие — копия ${acc.id}: владелец ${cp.owner}, соавтор — роль, автор в круге; личный ` +
    `остаётся у автора; «принять на найденный» копии не делает`);

  RP.seed(); as('auth');
  RP.state.view = 'issue'; RP.state.sel.tpl = 't-overdue'; RP.state.sel.params = { asOf:'2026-08-01', dept:'' };
  RP.state.sel.view = null; RP.state.sel.twist = { stats:['s-portfolio', 's-overdue-sum'] }; RP.state.sel.chart = false; RP.state.sel.time = 'сравнение'; RP.state.sel.top = true;
  const s1 = win.VIEWS.issue.fn();
  const iChg = ev('DRILL_NODES').findIndex(n => n.a && n.stat === 's-overdue-sum' && !n.path.length);
  RP.uiDrill(iChg); const s2 = win.VIEWS.issue.fn();
  RP.state.sel.time = 'динамика'; RP.state.sel.dynBy = true; RP.state.sel.top = false; RP.state.sel.drillRes = null;
  const s3 = win.VIEWS.issue.fn();
  as('user'); RP.proposeToCatalog('t-avg'); as('buh'); RP.state.view = 'registry';
  const s4 = win.VIEWS.registry.fn();
  const clean = [s1, s2, s3, s4].every(x => !/ОД-\d|ADR-031\d|ИО-6[01]/.test(x.replace(/<!--[\s\S]*?-->/g, '')));
  ok(268, iChg !== -1 && has(s1, 'Крупнейшие 3 — «') && has(s1, 'остальные 5') && has(s2, 'Изменение: ') && has(s2, 'равна изменению') &&
        has(s2, 'Как изменился') && has(s2, 'Колонки ▾') && has(s2, 'показано 2 из 2') && has(s2, 'Выгрузить список · xlsx') &&
        has(s3, 'По периоду начала') && has(s3, 'выданы в II кв. 2024') && has(s4, 'Предложены в каталог дашборда') &&
        has(s4, 'Принять — копия в общий') && clean,
    `экраны: «Крупнейшие 3» и ссылки «Изменения» у сравнения; панель провала «Изменения» с переходами, поиском, «Колонки ▾» ` +
    `и выгрузкой; динамика по периоду начала; очередь «Предложены в каталог» у держателя роли — в реестре; номеров решений в интерфейсе нет`);
})();

/* ---- NN. Входящие от дашборда, волна 44: потоки Движения записи объекта, «прочее» остатком,
        «нет ответа источника», признак «нет объектов» в ответе (ОД-29…ОД-36, ADR-0315, ИО-62) ---- */
(() => {
  RP.seed(); as('auth');
  const ev = c2 => vm.runInContext(c2, sandbox);
  const tot = { path:[], stat:'s-portfolio' }, AB = { a:'2026-06-01', b:'2026-08-01' };
  const rowOf = (d, k) => d.movement.rows.find(r => r.key === k) || {};
  const sumRows = d => d.movement.rows.reduce((s2, r) => s2 + r.value, 0);
  const objSum = (d, r) => d.items.filter(x => (x.mv || []).indexOf(r.key) !== -1).reduce((s2, x) => s2 +
    (r.kind === 'поток' ? x.flows[r.key.slice(2)] : r.kind === 'прочее' ? x.other : r.kind === 'нет ответа' ? x.noans : x.move), 0);
  const meta = SEAM.objectMeta('credit');
  const pf = RP.drillChange('t-overdue', {}, null, tot, AB);
  const kr6 = pf.items.find(x => x.id === 'kr-6');
  ok(269, meta.flows['s-portfolio'].map(f => f.name+(f.sign > 0 ? '+' : '−')).join(' ') === 'выдано+ погашено− списано− курсовая разница+' &&
        pf.ok && pf.movement.flows && pf.change === -6000000 && rowOf(pf, 'f:issued').value === 0 && rowOf(pf, 'f:repaid').value === -5750000 &&
        rowOf(pf, 'f:repaid').n === 7 && rowOf(pf, 'f:woff').value === 0 && rowOf(pf, 'f:fx').value === -250000 && rowOf(pf, 'f:fx').n === 1 &&
        rowOf(pf, 'other').value === 0 && rowOf(pf, 'other').n === 0 &&
        kr6.flows.repaid === -150000 && kr6.flows.fx === -250000 && kr6.other === 0 && pf.movement.base + sumRows(pf) === pf.movement.end && pf.movement.equal &&
        pf.movement.rows.every(r => objSum(pf, r) === r.value),
    `ОД-29, ОД-60: «Остаток, всего» 01.06 → 01.08.2026 — потоками записи объекта: ${pf.movement.chain}; «курсовая разница» ` +
    `−250 000 — КД-2025/126, «прочее» 0; сумма объектов каждой строки = строке; «списано 0» печатается`);

  const fe = RP.drillChange('t-overdue', {}, null, tot, { a:'2026-02-01', b:'2026-03-01' });
  const st = RP.drillChange('t-overdue', {}, { cuts:['status'] }, { path:[{ by:'status', key:'просрочен' }], stat:'s-portfolio' }, AB);
  const kr2 = st.items.find(x => x.id === 'kr-2'), inRow = rowOf(st, 'm:пришли из «действует»');
  const yr = RP.drillChange('t-overdue', {}, null, tot, { a:'2025-01-01', b:'2026-08-01' });
  ok(270, fe.ok && rowOf(fe, 'f:issued').value === 2500000 && rowOf(fe, 'f:issued').ids.join() === 'kr-7' &&
        fe.items.find(x => x.id === 'kr-7').how === 'пришёл' && !fe.movement.rows.some(r => r.kind === 'переход') && fe.movement.equal &&
        st.ok && inRow.value === 5900000 && kr2.move === 5900000 && kr2.flows.repaid === -600000 && kr2.diff === 5300000 &&
        rowOf(st, 'f:repaid').value === -750000 && st.movement.equal && st.sumDiff === st.change &&
        yr.ok && rowOf(yr, 'f:issued').value === 56700000 && rowOf(yr, 'f:issued').n === 4 && yr.movement.equal,
    `ОД-30: правило — к каждому объекту узла на любой из дат: КД-2026/007 без строки на 01.02 — «выдано» +2 500 000, а не ` +
    `«пришёл»; в узле «просрочен» КД-2024/203 — строкой «пришли из «действует»» +5 900 000 (остаток на базу), его ` +
    `«погашено» −600 000 — в этом узле: ${st.movement.chain}; 01.01.2025 → 01.08.2026 — «выдано» 4 кредитам 56 700 000`);

  ev("delete HIST['2026-08-01']['kr-1'].i_repaid_od_som");
  const na = RP.drillChange('t-overdue', {}, null, tot, AB);
  const kr1 = na.items.find(x => x.id === 'kr-1');
  RP.seed(); as('auth');
  const back = RP.drillChange('t-overdue', {}, null, tot, AB);
  ok(271, na.ok && rowOf(na, 'noans').value === -700000 && rowOf(na, 'noans').ids.join() === 'kr-1' && kr1.noans === -700000 &&
        kr1.flows.repaid === 0 && kr1.other === 0 && rowOf(na, 'f:repaid').value === -5050000 && na.movement.equal &&
        !back.movement.rows.some(r => r.key === 'noans'),
    `ОД-31: источник не ответил колонкой у КД-2024/117 — «нет ответа источника» −700 000 всей разницей, потоки и «прочее» ` +
    `по нему не считаются, «погашено» −5 050 000; строка «нет ответа» — только при сбое`);

  const mo = RP.drillChange('t-overdue', {}, null, tot, Object.assign({ mv:'f:fx' }, AB));
  const m0 = RP.drillChange('t-overdue', {}, null, tot, Object.assign({ mv:'other' }, AB));
  const mr = RP.drillChange('t-overdue', {}, null, tot, Object.assign({ mv:'f:repaid', q:'ош' }, AB));
  const wl = RP.worklistFromDrill('t-overdue', {}, null, tot, '', Object.assign({ mv:'f:fx' }, AB));
  const wlo = wl.ok ? RP.state.worklists.find(w => w.id === wl.id) : null;
  ok(272, mo.ok && mo.shown.length === 1 && mo.shown[0].id === 'kr-6' && mo.sumShown === -250000 &&
        mo.shownText === 'строка «курсовая разница»: показано 1 из 7 · сумма показанных -250 000 = строке -250 000' &&
        m0.ok && m0.shown.length === 0 &&
        mr.ok && mr.shown.length === 2 && mr.shown.every(x => has(x.cells.dept, 'Ош')) && mr.sumShown === mr.shown.reduce((s2, x) => s2 + x.flows.repaid, 0) && mr.sumShown !== mr.sumDiff &&
        wl.ok && wlo.objects.join() === 'kr-6' && has(wlo.name, '· курсовая разница'),
    `ОД-32, ОД-33: строка Движения — со своим списком: клик по строке — ${mo.shownText}; «прочее» 0 — список пуст; поиск ` +
    `внутри строки сужает и её; рабочий список из строки — один объект, имя по пути с именем строки`);

  const k2 = pf.items.find(x => x.id === 'kr-2');
  ok(273, k2 && k2.how === 'снизилось' && k2.flows.repaid === -600000 && k2.other === 0 && k2.diff === -600000 &&
        k2.mv.join() === 'f:repaid',
    `ОД-34: частичное погашение — объект обеих дат: КД-2024/203 остаётся в узле, «погашено» −600 000 = разнице, «прочее» 0 — ` +
    `тот же случай, что частичное распределение поступления; особого правила нет`);

  const seam = RP.reportAnswer({ tpl:'t-overdue', form:'объекты на двух датах', params:{}, node: tot, a: AB.a, b: AB.b });
  const viaD = RP.callSeamOut('дашборд', 'reportAnswer', { tpl:'t-overdue', form:'объекты на двух датах', params:{}, node: tot, a: AB.a, b: AB.b });
  const od = RP.drillChange('t-overdue', {}, null, { path:[], stat:'s-overdue-sum' }, AB);
  ok(274, seam.ok && viaD.ok && JSON.stringify(seam.movement) === JSON.stringify(pf.movement) && JSON.stringify(viaD.movement) === JSON.stringify(pf.movement) &&
        od.ok && !od.movement.flows && !od.movement.rows.some(r => r.kind === 'прочее') && od.movement.rows.map(r => r.name).join(' · ') === 'пришёл · снизилось' &&
        od.movement.equal,
    `ИО-57, ИО-62: строки Движения в ответе reportAnswer (и у дашборда тем же швом) = строкам окна отчёта; у «Суммы просрочки» ` +
    `потоков запись не объявляет — строки переходов «${od.movement.rows.map(r => r.name).join(' · ')}», без «прочего»`);

  const leg = RP.reportAnswer({ tpl:'t-overdue', form:'ответ', params:{ asOf:'2026-08-01', dept:'dep-legal' } });
  const zero = RP.reportAnswer({ tpl:'t-overdue', form:'ответ', params:{ asOf:'2026-01-01' } });
  const winLeg = RP.show('t-overdue', { asOf:'2026-08-01', dept:'dep-legal' }, null);
  as('user'); const osh = RP.reportAnswer({ tpl:'t-overdue', form:'ответ', params:{ asOf:'2026-08-01', dept:'rep-osh' } }); as('auth');
  const z = zero.ok ? zero.answers[0].stats.find(x => x.id === 's-overdue-sum') : {};
  ok(275, leg.ok && leg.answers[0].empty && leg.answers[0].empty.cause === 'параметр' && has(leg.answers[0].empty.why, 'Департамент правового обеспечения') &&
        leg.answers[0].stats.find(x => x.id === 's-overdue-sum').value === 0 &&
        zero.ok && z.value === 0 && zero.answers[0].empty === null &&
        osh.ok && osh.answers[0].empty && osh.answers[0].empty.cause === 'охват' && osh.answers[0].empty.hidden === 2 &&
        winLeg.ok && winLeg.data.empty && winLeg.data.empty.cause === 'параметр',
    `ОД-36: «нет объектов» — признак ответа: «${leg.answers[0].empty.why}» (число 0 остаётся); законный ноль — просрочка на ` +
    `01.01.2026 = 0 при 7 кредитах, без признака; пользователю «Ош» — «охват», скрыто ${osh.answers[0].empty.hidden}; окно отчёта — тот же признак`);

  RP.seed(); as('auth');
  RP.state.view = 'issue'; RP.state.sel.tpl = 't-overdue'; RP.state.sel.params = { asOf:'2026-08-01', dept:'dep-legal' };
  RP.state.sel.view = null; RP.state.sel.twist = null; RP.state.sel.time = null; RP.state.sel.top = false; RP.state.sel.drillRes = null;
  const e1 = win.VIEWS.issue.fn();
  RP.state.sel.tpl = 't-sh-plan'; RP.state.sel.params = { asOf:'2026-08-01', dept:'' }; RP.state.sel.time = 'сравнение';
  win.VIEWS.issue.fn();
  const iPf = ev('DRILL_NODES').findIndex(n => n.a && n.stat === 's-portfolio' && !n.path.length);
  RP.uiDrill(iPf); const e2 = win.VIEWS.issue.fn();
  const iFx = RP.state.sel.drillRes.movement.rows.findIndex(r => r.key === 'f:fx');
  RP.uiDrillMvAt(iFx); const e3 = win.VIEWS.issue.fn();
  RP.uiDrillMv(null); const e4 = win.VIEWS.issue.fn();
  const clean = [e1, e2, e3].every(x => !/ОД-\d|ADR-03[12]\d|ИО-6[0-2]/.test(x.replace(/<!--[\s\S]*?-->/g, '')));
  ok(276, has(e1, 'Нет объектов.') && has(e1, 'Департамент правового обеспечения') && iPf !== -1 &&
        has(e2, 'Как сложилось изменение — потоки записи объекта') && has(e2, 'потоки объяснили всё') && has(e2, '<th class="num">Погашено</th>') &&
        has(e2, '<th class="num">Курсовая разница</th>') && has(e2, '<th class="num">Прочее</th>') &&
        has(e2, '70 100 000 + 0 − 5 750 000 + 0 − 250 000 + 0 = 64 100 000') &&
        has(e3, 'строка «курсовая разница»: показано 1 из 7') && has(e3, 'class="mvsel"') && has(e3, 'все объекты') && !has(e4, 'class="mvsel"') && clean,
    `экраны: плашка «Нет объектов» над итогами при подразделении без кредитов; провал «Изменения» «Остатка» — строки Движения ` +
    `с цепочкой, колонки «Погашено», «Курсовая разница» и «Прочее» у объектов; клик по строке сужает список; номеров решений в интерфейсе нет`);
})();

/* ---------- OO. Добор старых решений и хвосты волн 42–43 (волна 45, ADR-0316) ----------
   Решения волн 27 и 31, которые макет не собирал: относительные значения, итоги шире зоны,
   журнал просмотров, тяжёлый показ в фоне, валюта, жизнь общего, сводная, план и перечень,
   «Обязательство» строками, пакет и отвалившееся, круг, сигнал и выгрузка с плитки, кто
   утверждает, сдача PDF + XLSX; события месяцу без событий; личный отчёт на экране показа;
   «действующие», заготовки и реестр имущества в конструкторе; оболочка вместо холста.     */
(() => {
  const ev = c => vm.runInContext(c, sandbox);
  const KB = win.KB;

  RP.seed(); as('auth');
  const sa = RP.show('t-overdue', { asOf:'@конец прошлого месяца', dept:'@моё подразделение' });
  as('user'); const su = RP.show('t-overdue', { asOf:'@конец прошлого месяца', dept:'@моё подразделение' });
  const bad = RP.show('t-overdue', { asOf:'@позавчера' });
  as('auth'); const iq = RP.issue('t-overdue', { params:{ asOf:'@конец прошлого квартала', dept:'@моё подразделение' }, kind:'предварительный' });
  const iRec = RP.ISS(iq.id), pq = RP.relPeriod('прошлый квартал'), py = RP.relPeriod('текущий год');
  const ra = RP.reportAnswer({ tpl:'t-overdue', form:'ответ', params:{ asOf:'@конец прошлого месяца' } });
  ok(277, sa.ok && sa.head.asOf === '2026-08-01' && has(sa.head.relative.join(), 'моё подразделение = Департамент администрирования кредитов') &&
        su.ok && has(su.head.relative.join(), 'моё подразделение = Отраслевой департамент промышленности') &&
        !bad.ok && has(bad.why, 'в наборе нет') && iq.ok && iRec.params.asOf === '2026-07-01' && iRec.params.dept === 'dep-admin' &&
        has(iRec.passport.relative.join(), 'конец прошлого квартала = 01.07.2026') && pq.from === '2026-04-01' && pq.to === '2026-07-01' &&
        py.from === '2026-01-01' && py.to === '2026-08-24' && ra.ok && ra.dates[0] === '2026-08-01' && has(ra.relative.join(), '01.08.2026'),
    `ОД-3, ОД-35: относительные значения закрытым набором — «моё подразделение» подставляется по смотрящему (уполномоченному — ` +
    `администрирование, пользователю — промышленность), паспорт печатает конкретное; значение вне набора — отказ; выпуск ` +
    `фиксирует 01.07.2026 и dep-admin; «прошлый квартал» — 01.04–01.07.2026, «текущий год» — с 01.01 по сегодня`);

  RP.seed(); as('head');
  const w = RP.wideTotals('t-overdue', { asOf:'2026-08-01' });
  const prom = w.rows.find(r => r.dept === 'dep-prom'), osh = w.rows.find(r => r.dept === 'rep-osh');
  const wRows = RP.wideTotals('t-overdue', { asOf:'2026-08-01' }, { rows:true }), wBy = RP.wideTotals('t-overdue', { asOf:'2026-08-01' }, { by:'status' });
  as('auth'); const all = RP.show('t-overdue', { asOf:'2026-08-01' });
  const allSum = all.data.totals.find(x => x.id === 's-overdue-sum').value;
  as('user'); const wu = RP.wideTotals('t-overdue', { asOf:'2026-08-01' });
  ok(278, w.ok && w.n === 3 && prom.count === 3 && prom.values[0].value === 5300000 && osh.hidden && has(osh.why, 'меньше 3') &&
        w.fund.values[0].value === allSum && allSum === 10300000 && !wRows.ok && has(wRows.why, 'только итоги') &&
        !wBy.ok && has(wBy.why, 'мельче') && !wu.ok && has(wu.why, 'по умолчанию строго'),
    `ОГ-7: руководителю (зона — администрирование) шире зоны видны только итоги — промышленность 3 объекта, просрочка 5 300 000; ` +
    `«Ош» (2 объекта) — «скрыто»; фонд в целом ${allSum} = итогу уполномоченного; строки, провал и уровень мельче подразделения — ` +
    `отказ; пользователю без права — «по умолчанию строго»`);

  RP.seed(); as('user');
  RP.show('t-overdue', { asOf:'2026-08-01' }); RP.show('t-overdue', { asOf:'2026-08-01' });
  RP.show('t-overdue', { asOf:'2026-08-01' }, { drill:false });
  const dr = RP.drill('t-overdue', { asOf:'2026-08-01' }, null, { path:[], stat:'s-overdue-sum' });
  const vlU = RP.viewLog(), rec = RP.recentReports();
  as('auth'); const vlA = RP.viewLog();
  const today = vlA.ok ? vlA.rows.filter(r => r.at === RP.state.today) : [];
  const shows = today.filter(r => r.what === 'показ со строками' && r.who === 'Осмонова Г.');
  ok(279, dr.ok && !vlU.ok && has(vlU.why, 'Недавние') && rec[0].tpl === 't-overdue' && rec[0].at === RP.state.today &&
        rec.filter(r => r.tpl === 't-overdue').length === 1 &&
        vlA.ok && shows.length === 1 && shows[0].times === 2 && shows[0].rows === 3 && today.some(r => r.what === 'провал' && r.rows === dr.items.length) &&
        today.length === 2 && vlA.rows.length === 5 &&
        vlA.rows.filter(r => r.at !== RP.state.today).map(r => r.tpl + '@' + r.at).join() ===
          't-overdue@2026-08-23,t-pay04@2026-08-21,t-osh@2026-08-18',
    `ОГ-33: журнал просмотров пишет показ со строками (3 строки, два показа подряд — одна запись «×2») и провал (${dr.items.length}); ` +
    `показ одних итогов не пишется; пользователю журнал закрыт — у него «Недавние отчёты»; уполномоченный читает`);

  RP.seed(); as('auth');
  const heavySpec = { mode:'динамика', from:'2023-09-01', to:'2026-08-01', step:'месяц' };
  const e1 = RP.estimate('t-overdue', heavySpec, { dept:'' }, { cuts:['dept', 'status'] });
  const e2 = RP.estimate('t-overdue', { mode:'динамика', from:'2026-01-01', to:'2026-08-01', step:'месяц' }, { dept:'' });
  const e3 = RP.estimate('t-portfolio', null, { dept:'' }), e4 = RP.estimate('t-portfolio', null, { dept:'dep-prom' });
  const hv = RP.runShow('t-overdue', heavySpec, { asOf:'2026-08-01', dept:'' }, { cuts:['dept', 'status'] });
  const lt = RP.runShow('t-overdue', { mode:'динамика', from:'2026-01-01', to:'2026-08-01', step:'месяц' }, { asOf:'2026-08-01', dept:'' });
  const jobs = RP.myJobs(), nj = RP.notices().filter(n => n.kind === 'задание');
  ok(280, e1.sec === 28 && e1.heavy && e2.sec === 7 && !e2.heavy && e3.heavy && !e4.heavy && hv.ok && hv.background && jobs.length === 1 &&
        jobs[0].until === '2026-08-31' && nj.length === 1 && has(nj[0].text, '«Мои задания»') && lt.ok && lt.onScreen && lt.answer.ok,
    `ОГ-17: оценка у статистики — динамика 36 месяцев по двум разрезам ${e1.sec} с — фоновое задание ${hv.job} с уведомлением, ` +
    `результат в «Моих заданиях» до 31.08.2026; 8 месяцев без разрезов — ${e2.sec} с, на экране; «сейчас» по всему портфелю — в фоне, ` +
    `по одному подразделению — на экране`);

  RP.seed(); as('auth');
  const c8 = RP.currencyAnswer('t-overdue', { asOf:'2026-08-01' }, { stat:'s-portfolio', show:'USD' });
  const c7 = RP.currencyAnswer('t-overdue', { asOf:'2026-07-01' }, { stat:'s-portfolio' });
  const c6 = RP.currencyAnswer('t-overdue', { asOf:'2026-06-01' }, { stat:'s-portfolio' });
  const mix = RP.currencyAnswer('t-overdue', { asOf:'2026-08-01' }, { origTotal:true });
  const usd = g => g.groups.find(x => x.cur === 'USD');
  ok(281, c8.ok && c8.total === 64100000 && c8.groups.reduce((a, g) => a + g.som, 0) === c8.total && usd(c8).som === 5000000 &&
        usd(c6).orig === 61538.46 && usd(c7).orig === 61538.46 && c8.shown.value === Math.round(64100000 / 83.66 * 100) / 100 &&
        has(c8.shown.note, 'отображение') && !mix.ok && has(mix.why, 'однородной группе') && has(c8.fx, 'своей строкой') &&
        has(c8.fx, 'не пересчитываются'),
    `ОГ-26, ОД-64: итог «Остатка» на 01.08.2026 — 64 100 000 сом = сом 59 100 000 + USD-группа 5 000 000; КД-2025/126 в долларах — ` +
    `61 538,46 USD и на 01.06, и на 01.07 (снижение в сомах на 200 000 — строка «курсовая разница» Движения); пересчёт итога в USD — ` +
    `отображение (${c8.shown.value}); сумма в исходной валюте по смешанной группе — отказ`);

  RP.seed(); as('head');
  const cand = RP.archiveCandidates();
  RP.subscribe('t-sh-big', { freq:'ежемесячно' });
  const del1 = RP.deleteReport('t-sh-big');
  const arc = RP.toArchive('t-sh-big'), shelfArc = RP.shelves('').shared.map(r => r.id);
  const back = RP.fromArchive('t-sh-big');
  const tr = RP.transferOwner('t-sh-big', 'Бекова Н.'), tr2 = RP.transferOwner('t-sh-big', 'Осмонова Г.');
  as('auth'); const delOff = RP.deleteReport('t-overdue');
  as('user'); const delFree = RP.deleteReport('t-npl');
  ok(282, cand.length === 1 && cand[0].id === 't-sh-big' && cand[0].days === 194 && !del1.ok && has(del1.why, 'подписка') &&
        arc.ok && shelfArc.indexOf('t-sh-big') === -1 && back.ok && tr.ok && RP.TPL('t-sh-big').owner === 'Бекова Н.' && !tr2.ok &&
        has(RP.TPL('t-sh-big').ownerLog.slice(-1)[0].why, 'передан владельцем') && !delOff.ok && has(delOff.why, 'выводится из обращения') &&
        delFree.ok && !RP.TPL('t-npl'),
    `ОГ-23: неоткрываемый 194 дня общий отчёт предложен в архив; удалить с подпиской нельзя — зависимые названы; архив убирает с полки ` +
    `«Общие», возврат — владелец; передача владения — след «передан владельцем», дальше передаёт уже новый владелец; официальный не ` +
    `удаляется; личный без зависимых удаляется`);

  RP.seed(); as('user');
  const pin = RP.pinToDashboard('t-osh', null, {}, 'Главная');
  const tiles = RP.tilesOf('t-osh'), delPin = RP.deleteReport('t-osh');
  RP.state.sel.scTab = 'мои'; const shelf = win.VIEWS.showcase.fn();
  ok(283, pin.ok && tiles.length === 1 && tiles[0].dash === 'Главная' && RP.levelOf('t-osh') === 'личный' && !delPin.ok &&
        has(delPin.why, 'плитка на дашборде «Главная»') && has(shelf, 'на плитке: Главная') && has(shelf, 'Собрать отчёт'),
    `ОД-4: отчёт, поставленный на плитку, остаётся обычным личным на полке «Мои» с отметкой «на плитке: Главная»; удалить его, ` +
    `пока плитка ссылается, нельзя`);

  RP.seed(); as('auth');
  const pv = RP.pivot('t-overdue', { asOf:'2026-08-01' }, { rows:'dept', cols:'status', stat:'s-overdue-sum' });
  const rowOk = pv.rows.every(r => r.cells.reduce((a, x) => a + (x || 0), 0) === r.total);
  const colOk = pv.colTotals.reduce((a, x) => a + (x || 0), 0) === pv.total;
  const seven = RP.show('t-overdue', { asOf:'2026-08-01' }, { cuts:['dept', 'status', 'borrower', 'x1', 'x2', 'x3', 'x4'] });
  ev("(() => { const C = CUT_NAMES; ['x1','x2','x3','x4'].forEach(k => { C[k] = k; }); })()");
  const sevenOk = RP.show('t-overdue', { asOf:'2026-08-01' }, { cuts:['dept', 'status', 'borrower', 'x1', 'x2', 'x3', 'x4'] });
  ev("(() => { ['x1','x2','x3','x4'].forEach(k => { delete CUT_NAMES[k]; }); })()");
  KB.seed(); KB.setObject('collateral'); ['c-curator', 'c-region', 'c-cur', 'c-adm', 'c-zstate'].forEach(c => KB.addCut(c));
  const kb7 = KB.addCut('c-ban');
  ok(284, pv.ok && pv.total === 10300000 && rowOk && colOk && pv.cols.join() === 'действует,просрочен' && !seven.ok &&
        !sevenOk.ok && has(sevenOk.why, 'до 6 уровней') && KB.state.cuts.length === 6 && !kb7.ok && has(kb7.why, 'до 6 уровней'),
    `ОГ-10: разрез в колонках — подразделение × состояние, клетки складываются в итог строки, итоги колонок — в общий ${pv.total}; ` +
    `седьмой уровень группировки — отказ и на показе, и в конструкторе`);
  KB.seed();

  RP.seed(); as('auth');
  const pf = RP.planFact(null, { asOf:'2026-08-01' }), pfProm = pf.rows.find(r => r.dept === 'dep-prom');
  as('user');
  const nums = RP.worklistFromNumbers('Обзвон по письму Минфина', ['КД-2024/203', 'КД-2025/126', 'КД-2024/117', 'КД-2023/999', 'КД-2022/045']);
  const wlN = RP.state.worklists.find(x => x.id === nums.id);
  const noName = RP.worklistFromNumbers('', ['КД-2024/203']);
  ok(285, pf.ok && pf.plan.kind === 'план' && pfProm.plan === 6000000 && pfProm.fact === 2500000 && pfProm.pct === 41.7 &&
        nums.ok && nums.found === 2 && nums.notFound.join() === 'КД-2023/999,КД-2022/045' && nums.hidden === 1 &&
        wlN.objects.join() === 'kr-1,kr-2' && has(nums.note, 'не найдены') && !noName.ok,
    `ОГ-32: план — показатель рода «план» из справочника «Плановые показатели»: промышленность — план 6 000 000, выдано 2 500 000, ` +
    `41,7 %; список из перечня 5 номеров — найдено 2, не найдены поимённо КД-2023/999, КД-2022/045, вне видимости — 1 числом`);

  RP.seed(); as('auth');
  const ot = RP.obligationTiles(), ob = RP.obligations(), orow = RP.obligationRows();
  ok(286, ot.late === ob.filter(o => o.state === 'просрочено').length && ot.total === ob.length &&
        ot.done === ob.filter(o => /^сдано/.test(o.state)).length && orow.length === ob.length &&
        ['form', 'dept', 'who', 'due', 'state', 'submitted', 'diverged', 'recipient'].every(k => k in orow[0]),
    `ОД-6: «Обязательство» — строки объекта с восемью реквизитами (форма · подразделение · исполнитель · срок · состояние · дата ` +
    `сдачи · «числа изменились» · получатель); плитки — счёт строк: просрочено ${ot.late}, сдано ${ot.done} из ${ot.total}`);

  RP.seed(); as('auth');
  const pk = RP.reportAnswer({ batch:[{ tpl:'t-overdue', form:'ответ', params:{ asOf:'2026-08-01' } },
    { tpl:'t-pay04', form:'ответ', params:{ asOf:'@конец прошлого месяца', dept:'@моё подразделение' } }] });
  const drp = RP.reportAnswer({ tpl:'t-overdue', form:'ответ', params:{ asOf:'2026-08-01' }, stats:['s-overdue-sum', 's-npl', 's-zzz'] });
  ok(287, pk.ok && pk.form === 'пакет' && pk.answers.length === 2 && pk.answers.every(a => a.ok) &&
        pk.answers[0].answers[0].stats[0].value === 10300000 && has(pk.answers[1].relative.join(), 'моё подразделение') &&
        drp.ok && drp.dropped.length === 2 && has(drp.dropped[0].why, 'выведен 12.08.2026') && drp.answers[0].stats.length === 1 &&
        drp.version.n === 1,
    `ОД-8, ОД-13: пакет вопросов экрана одним вызовом — два ответа, каждый за себя; ставшее невозможным снято из вопроса с ` +
    `пометкой («Доля проблемных кредитов» выведена, неизвестный показатель), ответ несёт версию отчёта`);

  RP.seed(); as('auth');
  const cc = RP.circleCovers('t-sh-plan', ['Куратор кредитов']), cd = RP.circleCovers('t-sh-plan', ['Администратор дашборда']);
  const cv = RP.reportAnswer({ tpl:'t-sh-plan', form:'ответ', params:{ asOf:'2026-08-01' }, covers:['Куратор кредитов'] });
  ok(288, cc.ok && !cc.covers && cc.missing.length === 1 && cc.missing[0].who === 'Мамытов Э.' &&
        has(cc.text, 'не покрывает 1 держателя роли «Куратор кредитов»: Мамытов Э. (Региональное представительство «Ош»)') &&
        cd.covers && cv.ok && cv.circle && !cv.circle.covers,
    `ОД-12: круг общего отчёта (промышленность и администрирование) не покрывает куратора из «Ош» — ответ поимённый; ` +
    `держателей «Администратор дашборда» покрывает; тот же ответ — ключом шва reportAnswer`);

  RP.seed(); as('user');
  const sg = RP.signalFromTile({ tpl:'t-overdue', stat:'s-overdue-sum', cmp:'больше', value:5000000, params:{ dept:'dep-prom' }, tile:'Главная · Просрочено' });
  const mine = RP.mySubs().filter(s => s.fromTile);
  const sgTask = RP.signalFromTile({ tpl:'t-overdue', stat:'s-overdue-sum', cmp:'равно', value:1 });
  const xp = RP.exportFromTile({ tpl:'t-overdue', params:{ asOf:'2026-08-01' }, tile:'Просрочено', dash:'Главная' });
  const xi = RP.ISS(xp.id);
  ok(289, sg.ok && mine.length === 1 && mine[0].fromTile === 'Главная · Просрочено' && mine[0].kind === 'сигнал' && !sgTask.ok &&
        xp.ok && xi.kind === 'предварительный' && xi.passport.label === 'НЕ ОФИЦИАЛЬНЫЙ ДОКУМЕНТ' &&
        has(xi.passport.source, 'плитка «Просрочено» дашборда «Главная»') && RP.state.issues.some(i => i.id === xp.id),
    `ОД-11, ОД-14: сигнал с плитки — обычный сигнал на тот же отчёт с тем же порогом, виден в «на что я подписан» с пометкой плитки; ` +
    `выгрузка с плитки — предварительный выпуск ${xp.id}: паспорт с источником-плиткой, «НЕ ОФИЦИАЛЬНЫЙ ДОКУМЕНТ», строка журнала`);

  RP.seed(); as('auth');
  const ap1 = RP.approverOf('t-overdue'), ap2 = RP.approverOf('t-sh-big'), ap3 = RP.approverOf('t-sh-plan');
  RP.state.view = 'builder'; RP.state.sel.draft = 't-overdue'; const bld = win.VIEWS.builder.fn();
  ok(290, ap1.who === 'уполномоченный фонда' && ap1.why === 'получатель внешний' &&
        ap2.who === 'уполномоченный подразделения «Департамент администрирования кредитов»' && ap3.why === 'круг — несколько подразделений' &&
        has(bld, 'Кто утверждает') && has(bld, 'уполномоченный фонда'),
    `ОГ-30: кто утверждает — выводится из круга и получателей: «${RP.TPL('t-overdue').name}» с внешним получателем — уполномоченный фонда; ` +
    `общий отчёт одного подразделения — уполномоченный подразделения; экран редакции это печатает`);

  RP.seed(); as('auth');
  const fx = RP.issue('t-overdue', { params:{ asOf:'2026-08-01', dept:'' }, kind:'окончательный', recipient:'a-me' });
  const fi = RP.ISS(fx.id);
  const exX = RP.exportIssue(fx.id, 'xlsx'), exC = RP.exportIssue(fx.id, 'csv');
  const fix = {}; fix[fi.snapshot.totals[0].id] = fi.snapshot.totals[0].value + 1000;
  const chk1 = RP.checkFile(fx.id, 'xlsx', fix), chk2 = RP.checkFile(fx.id, 'xlsx', {});
  const mf = RP.ISS(RP.state.issues[0].id), exMf = RP.exportIssue(mf.id, 'xlsx');
  ok(291, fx.ok && fi.formats.join() === 'pdf,xlsx' && fi.checksums.pdf && fi.checksums.xlsx && fi.checksums.pdf !== fi.checksums.xlsx &&
        exX.ok && !exC.ok && !chk1.match && has(chk1.note, '10 300 000 → 10 301 000') && chk2.match &&
        mf.formats.join() === 'pdf' && !exMf.ok,
    `ОГ-15: сдача Минэкономики («требует xlsx») — PDF и XLSX из тех же замороженных чисел, у каждого контрольная сумма; csv при ` +
    `сдаче не выдаётся; исправленную в Excel цифру сверка показывает; Минфину — только PDF`);

  RP.seed(); as('auth');
  const pl = RP.issue('t-port-ly', { params:{ asOf:'2026-01-01' }, kind:'окончательный', recipient:'a-mf' });
  const plI = RP.ISS(pl.id), cellOf = (tt, r, c) => tt.rows[r].cells[c];
  const gap0 = cellOf(plI.snapshot.timeTable, 2, 3);
  const per0 = RP.timeAnswer('t-pay04', { mode:'за период', from:'2024-12-01', to:'2025-01-01', turnover:true }, {});
  const ps0 = SEAM.periodSource('декабрь 2024');
  as('buh');
  const evAdd = ev("clone(LEGACY_EVENTS_ARCHIVE['декабрь 2024'])");
  const rDup = RP.migrationRevision({ period:'декабрь 2024', why:'x', events:{ 'pm-1':{ credit:'kr-5', date:'2024-12-05', amount:400000 } } });
  const rOut = RP.migrationRevision({ period:'декабрь 2024', why:'x', events:{ 'pm-11':{ credit:'kr-5', date:'2025-01-05', amount:400000 } } });
  const rNo = RP.migrationRevision({ period:'декабрь 2024', why:'x', events:{ 'pm-11':{ credit:'kr-7', date:'2024-12-05', amount:400000 } } });
  const mr = RP.migrationRevision({ period:'декабрь 2024', why:'найден архив платёжных поручений', events: evAdd });
  const rw = RP.rewriteLog().slice(-1)[0];
  as('auth');
  const per1 = RP.timeAnswer('t-pay04', { mode:'за период', from:'2024-12-01', to:'2025-01-01', turnover:true }, {});
  const sh1 = RP.show('t-port-ly', { asOf:'2026-01-01' });
  const again = (() => { as('buh'); const r = RP.migrationRevision({ period:'декабрь 2024', why:'повтор', events: evAdd }); as('auth'); return r; })();
  const rc = RP.recompute(pl.id);
  RP.seed(); const ps2 = SEAM.periodSource('декабрь 2024');
  ok(292, ps0.events === false && pl.ok && gap0.value === null && gap0.gap === 'события в легаси не перенесены (декабрь 2024)' &&
        per0.rows[0].value === null && has(per0.rows[0].gap, 'декабрь 2024') && !rDup.ok && has(rDup.why, 'уже есть') &&
        !rOut.ok && !rNo.ok && has(rNo.why, 'ещё не было') && mr.ok && mr.addedEvents === 1 && mr.marked.indexOf(pl.id) !== -1 &&
        rw.was === null && rw.wasText === 'нет (события не перенесены)' && has(rw.what, 'pm-10') &&
        per1.rows[0].value === 400000 && sh1.data.timeTable.rows[2].cells[3].value === 400000 &&
        has(plI.divergedWhy, 'события дополнены') && rc.diffs.length === 2 && !again.ok && ps2.events === false,
    `ADR-0311 п. 5: декабрь 2024 г. перенесён без событий — поток «за отчётный месяц — прошлый год» формы «Портфель к прошлому году» ` +
    `на 01.01.2026 пуст «события в легаси не перенесены», сдача законна; версия ${mr.release} даёт событие pm-10 (400 000) — строкой ` +
    `журнала «было: нет → стало», клетка и «за период» получают число, сданный ${pl.id} метится; дубль, чужой месяц и договор, которого ` +
    `не было, — отказ; затравка возвращает стенд`);

  RP.seed(); as('user');
  RP.setReportFlex('t-osh', { time:{ mode:'сравнение', a:'2026-06-01', b:'2026-08-01' }, filter:null });
  RP.uiShowPersonal && (RP.state.view = 'issue');
  RP.state.sel.tpl = 't-osh'; RP.state.sel.time = null; RP.state.sel.params = { asOf:'2026-08-01', dept:'' };
  const scr = win.VIEWS.issue.fn();
  ok(293, has(scr, '· личный') && has(scr, 'Режим времени из отчёта') && has(scr, 'сравнение 01.06.2026 → 01.08.2026'),
    `хвост волны 42: личный отчёт автора показывается на экране «Показ и выпуск» тем же окном, режим и фильтр — его умолчанием ` +
    `(«Режим времени из отчёта: сравнение 01.06.2026 → 01.08.2026»)`);

  KB.seed();
  const a0 = KB.answer(), hint0 = a0.passport.shown.hint, act0 = KB.state.active;
  KB.toggleStat('s-portfolio'); const a1 = KB.answer();
  KB.setActive(false); const a2 = KB.answer();
  KB.seed(); KB.toggleStat('s-avg-late'); const actAvg = KB.state.active;
  ok(294, act0 === null && has(hint0, 'складывает действующих и погасивших') && KB.state && a1.root.count === 45 && a0.root.count === 47 &&
        a1.passport.shown.filters.indexOf('действующие (закрытые не входят)') !== -1 && a2.root.count === 47 &&
        has(a2.passport.shown.hint, 'действующих и погасивших') && actAvg === null,
    `ОД-7: конструктор ставит «действующие» сам при первом остатке («Остаток основного долга») — видимым чипом, 45 строк вместо 47 ` +
    `(два закрытых договора); паспорт печатает; автор снимает — 47 и подсказка «складывает действующих и погасивших»; средняя чип не ставит`);

  KB.seed();
  const st = KB.startFrom('p-assets'), aa = KB.answer();
  KB.setObject('offer'); const ao = KB.answer(); KB.seed();
  const noPre = KB.startFrom('zzz');
  ok(295, st.ok && aa.ok && KB.presets().length === 4 && aa.root.count === 8 && aa.root.values['s-a-book'] === 22460000 &&
        aa.root.children.map(n => n.key).join() === 'на продаже,продано' && ao.ok && ao.root.count === 5 && !noPre.ok,
    `ОГ-27, входящие имущества: «начать с готового» — четыре заготовки; «Реестр имущества на дату» на 31.08.2026 — 8 объектов ` +
    `имущества, учётная стоимость 22 460 000, по состоянию «на продаже · продано»; второй объект — предложения имущества (5)`);

  RP.seed(); as('user');
  RP.state.sel.scTab = 'мои'; const vit = win.VIEWS.showcase.fn();
  const shell = src.slice(0, src.indexOf('<script>'));
  ok(296, has(vit, 'Собрать отчёт') && has(vit, "RP.go('draft')") && has(shell, 'data-v="draft"') &&
        has(shell, '<div class="brand">АСУБК') && !has(shell, 'ГФХ'),
    `ОГ-Д1: оболочка «Формирования» — экран «Конструктор» внутри общей оболочки АСУБК (топбар, меню трёх столов, одна палитра); ` +
    `с витрины в него ведёт «Собрать отчёт»`);

  RP.seed(); as('buh');
  const h8 = RP.highlight('t-sh-plan', { asOf:'2026-08-01' }), h6 = RP.highlight('t-sh-plan', { asOf:'2026-06-01' });
  const ho = RP.highlight('t-overdue', { asOf:'2026-08-01' });
  const thOwn = RP.setThresholds('t-sh-plan', 's-overdue-cnt', { warn:1, bad:3 });
  as('user'); const thAlien = RP.setThresholds('t-sh-plan', 's-overdue-sum', { warn:1, bad:2 }), thMine = RP.setThresholds('t-osh', 's-overdue-sum', { warn:1, bad:2 });
  as('auth'); const thOff = RP.setThresholds('t-overdue', 's-overdue-sum', { warn:1, bad:2 }), thBad = RP.setThresholds('t-sh-plan', 's-overdue-sum', { warn:5, bad:2 });
  ok(297, h8.ok && h8.by === 'автор' && h8.items[0].state === 'плохо' && h8.items[0].value === 10300000 && h6.items[0].state === 'внимание' &&
        ho.by === 'форма' && ho.items[0].state === 'внимание' && ho.items[0].value === 2 && thOwn.ok && has(RP.TPL('t-sh-plan').editions.slice(-1)[0].changed, 'порог') &&
        !thAlien.ok && thMine.ok && !thOff.ok && has(thOff.why, 'задаёт форма') && !thBad.ok,
    `ОГ-10а: подсветка по порогам — в общем отчёте задана автором («Сумма просрочки» 10 300 000 — «плохо», на 01.06 5 400 000 — ` +
    `«внимание»), правка порога — версия общего; чужой не правит; в официальном — формой («Кредитов с просрочкой» 2 — «внимание»), ` +
    `помимо редакции порог не ставится`);

  RP.seed(); as('head');
  Object.assign(RP.state.sel, { tpl:'t-overdue', params:{ asOf:'2026-08-01', dept:'' }, wide:true, usd:true, pivot:true, rel:'dept' });
  const s1 = win.VIEWS.issue.fn();
  as('auth'); RP.doHeavy('t-overdue'); const s2 = win.VIEWS.subs.fn();
  as('buh'); RP.doMigrationEvents(); as('auth'); const s3 = win.VIEWS.journal.fn();
  as('user'); RP.doNumbers(); const s4 = win.VIEWS.worklists.fn();
  as('head'); RP.state.sel.scTab = 'общие'; const s5 = win.VIEWS.showcase.fn();
  const from = (x, h) => x.indexOf(h) === -1 ? '' : x.slice(x.indexOf(h));
  const mineOO = [from(s1, 'Значения параметров'), from(s2, 'Мои задания'), from(s3, 'События месяцу без событий'),
    from(s4, 'Список из внешнего перечня'), from(s5, '>Название<')];
  const cleanOO = mineOO.every(x => x.length > 100 && !/О[ГД]-\d|ADR-\d|ИО-\d/.test(x));
  ok(298, has(s1, 'Подставлено по вам') && has(s1, 'по валюте договора') && has(s1, 'Итоги шире зоны — только итоги') &&
        has(s1, 'скрыто: в группе меньше 3 объектов') && has(s1, 'План выдачи и факт') && has(s1, 'подразделение × состояние кредита') &&
        has(s2, 'Мои задания') && has(s2, 'МЗ-1') && has(s3, 'Журнал просмотров') && has(s3, 'нет (события не перенесены)') &&
        has(s4, 'внешнего перечня') && has(s5, 'предлагается в архив') && has(s1, 'Подсветка по порогам (задана формой)') && cleanOO,
    `экраны: на показе — значения по смотрящему, валюта договора, сводная, итоги шире зоны, план и факт; «Мои задания»; журнал ` +
    `просмотров и события декабря 2024; список из перечня; архив общего; номеров решений в новых карточках нет`);
})();

/* ---------- PP. Волна 46: служебных экранов нет (ГМ-1, ГМ-2) ---------- */
(() => {
  RP.seed(); as('auth');
  const V = win.VIEWS;
  const keys = Object.keys(V);
  const gone = ['Швы и соседи', 'Границы макета', 'data-v="seams"', 'data-v="bounds"'].filter(x => has(src, x));
  const seamFns = ['seamsIn', 'consumers', 'noSeamOut', 'callSeamOut', 'ownQuery', 'ownFormula']
    .filter(f => typeof RP[f] !== 'function');
  const b = V.builder.fn(), w = V.worklists.fn(), j = V.journal.fn();
  const ready = RP.state.issues.some(i => i.state === 'готов');
  ok(299, keys.length === 10 && keys.indexOf('seams') === -1 && keys.indexOf('bounds') === -1 && gone.length === 0 &&
        seamFns.length === 0 && has(b, 'RP.doFold(') && has(b, 'RP.doBands(') && has(b, 'RP.doColDate(') &&
        has(w, 'RP.doRuleList()') && ready && has(j, 'RP.doSheetIssue('),
    `служебных экранов нет: меню и экраны — только приложения (${keys.length}); швы живут в коде модуля ` +
    `(${6 - seamFns.length} из 6 функций), отказы легаси — кнопками на рабочих экранах: сложить итоги, итог перед ` +
    `уровнями, столбец на свою дату — в редакции; правило списком — в рабочих списках; лист у сданного — в журнале`);
})();

/* ---------- QQ. Волна 47: справка по заёмщику ФО-52 (СПЗ-1…СПЗ-15, ADR-0319) ---------- */
(() => {
  RP.seed(); as('auth');
  const V = win.VIEWS;
  const docOf = (obj, down) => { RP.state.down = down || []; RP.state.sel.blank = 't-zspr'; RP.state.sel.blankObj = obj;
    RP.state.sel.blankVals = true; const h = V.blank.fn(); const i = h.indexOf('<div class="lcheck sample">');
    RP.state.down = []; return h.slice(i, h.indexOf('<div class="legend', i)); };
  const txt = h => String(h).replace(/<[^>]+>/g, '');
  const t = RP.TPL('t-zspr'), ed = t.editions[0];
  const p = RP.parseLayout(ed.layoutText, 'borrower', 'сейчас');
  const fl = SEAM.fieldList('borrower');
  const fBor = RP.reportForms('su-2').items.map(x => x.id), fCr = RP.reportForms('kr-2').items.map(x => x.id);
  ok(300, t.workPaper && t.form === 'ФО-52' && ed.object === 'borrower' && ed.mode === 'сейчас' &&
        fl.owner === 'заёмщики' && fl.fields.every(f => f.ru && f.ru.indexOf('Заёмщик.') === 0) &&
        p.errors.length === 0 && p.repeats.length === 6 && p.conds.length === 3 &&
        fBor.join() === 't-zspr' && fCr.length > 0 && fCr.indexOf('t-zspr') === -1 &&
        fCr.every(id => RP.TPL(id).editions.every(e => e.object === 'credit')),
    `справка — бланк объекта «заёмщик», рабочая бумага, «сейчас»: перечень полей объявляет модуль заёмщиков ` +
    `(${fl.fields.length} полей), разделы соседей — ${p.repeats.length} повторов, макет без ошибок; карточка заёмщика ` +
    `печатает только справку, карточка кредита — свои бланки (${fCr.length}), без справки`);

  const d6 = txt(docOf('su-6')), d4 = docOf('su-4');
  const peni4 = (txt(d4).match(/Пени:/g) || []).length;
  ok(301, has(d6, 'СВОДКА') && has(d6, 'КД-2025/126') && has(d6, 'срочно 3 970 000') && has(d6, 'Пени: 46 800') &&
        has(d6, 'Асанов Т. К., ИНН 20107198200419') && has(d6, 'повторная претензия') && has(d6, 'срок вышел: да') &&
        has(d6, 'колонтитул каждого листа') && has(d6, 'ИНН 03011200710093 · данные на') &&
        has(d6, 'сформировал: Тентимишев К., Департамент администрирования кредитов') && /стр\. 1 из \d/.test(d6) &&
        has(txt(d4), 'КД-2025/088') && has(txt(d4), 'КД-2024/259') && peni4 === 1 && has(txt(d4), 'Пени: 900') &&
        has(d6, 'Под риском: 4 900 000 сом') && has(d6, 'Обеспеченность: 133 % — худший, КД-2025/126') &&
        has(txt(d4), 'Под риском: 40 900 000 сом') && has(txt(d4), 'Обеспеченность: 127 % — худший, КД-2025/088'),
    `состав один: сводка, реквизиты, связи, кредиты со статьями остатка, обеспечение, взыскание, обязательства; ` +
    `колонтитул — объект, ИНН, кто сформировал, «стр. N из M»; у двух кредитов «Тянь-Шань Строя» строка пеней одна — ` +
    `нулевая статья не печатается (${peni4})`);

  const d5 = docOf('su-5'), d3 = docOf('su-3');
  ok(302, has(txt(d5), 'каждый действующий кредит · строк 0') && has(d5, '<span class="tx">нет <span') &&
        has(txt(d5), 'есть ПогашенныеКредиты — выполнено') &&
        has(txt(d5), 'Погашено кредитов: 1 на сумму 20 000 000 сом, последний закрыт 14.08.2026') &&
        has(txt(d5), 'Обеспеченность: нет действующих кредитов') && has(txt(d5), 'Куратор: не назначен') &&
        has(txt(d3), 'Заёмщик.ВидЛица = физлицо или ИП — выполнено') && has(txt(d3), 'Заёмщик.ВидЛица = юрлицо — не выполнено') &&
        has(txt(d3), 'ИП, документ: паспорт'),
    `пустой раздел — «нет», погашенные — одной строкой, куратора нет — «не назначен», а не пусто; реквизиты — ` +
    `условием по виду лица: у ИП паспорт, у юрлица ОПФ и руководитель`);

  const r1 = RP.issue('t-zspr', {params:{obj:'su-6'}, kind:'окончательный'});
  const rec = r1.rec || {};
  RP.TPL('t-ref').editions[0].addressee = {kind:'заказавший'};
  const pc = RP.publishChecks('t-ref').filter(x => x.check === 'адресат бланка');
  const br = RP.blankRecipient('t-zspr', 'su-6');
  ok(303, r1.ok && rec.kind === 'окончательный' && rec.recipient.kind === 'заказавший' &&
        rec.recipient.name === 'Тентимишев К.' && rec.recipient.unit === 'dep-admin' && rec.recipient.viaName === 'ОсОО «Ош-Текстиль»' &&
        rec.number === null && rec.doc === null && rec.passport.frozen && rec.formats.join() === 'pdf' &&
        RP.state.docs.every(x => x.issue !== rec.id) && pc.length === 1 && has(pc[0].why, 'только у рабочей') &&
        br.ok && has(br.text, 'заказавший'),
    `получатель — заказавший, пятый вид: ${rec.recipient && rec.recipient.name} (${rec.recipient && rec.recipient.unitName}); ` +
    `окончательная справка заморожена, номера и черновика документооборота нет; у бланка, уходящего документом, ` +
    `«заказавший» публикация отклоняет`);

  RP.state.down = ['залог'];
  const r2 = RP.issue('t-zspr', {params:{obj:'su-4'}, kind:'окончательный'});
  RP.state.down = ['заёмщики'];
  const r3 = RP.issue('t-zspr', {params:{obj:'su-4'}, kind:'предварительный'});
  RP.state.down = [];
  const dDown = docOf('su-6', ['залог', 'субъекты']);
  const j = V.journal.fn();
  ok(304, r2.ok && (r2.rec.passport.partial || []).length === 1 && has(r2.rec.passport.partial[0], 'модуль «залог» не ответил') &&
        !r3.ok && has(r3.why, 'модуль «заёмщики» не ответил') && has(r3.why, 'печатать не о ком') &&
        has(txt(dDown), 'Справка по заёмщику неполная') && has(txt(dDown), 'каждый предмет залога · ответа нет') &&
        (txt(dDown).match(/Сведения не получены: модуль «субъекты»/g) || []).length === 3 &&
        has(txt(dDown), 'обеспеченность сведения не получены') && has(j, 'неполная:') &&
        RP.downBanner() === '' && (RP.state.down = ['залог'], has(RP.downBanner(), 'не отвечает модуль «залог»')) &&
        (RP.state.down = [], true),
    `сосед промолчал — раздел печатается пометкой «сведения не получены», на листе 1 «справка неполная», в паспорте и ` +
    `журнале — неполнота; выпуск не валится. Без ответа самого заёмщика — отказ: печатать не о ком`);

  const bad1 = RP.issue('t-notice', {params:{obj:'su-2'}, kind:'предварительный'});
  const b = RP.batch('t-zspr', {objs:['su-4', 'su-6', 'kr-2']});
  ok(305, !bad1.ok && has(bad1.why, 'бланк объекта «кредит»') && b.ok && b.issued.length === 2 &&
        b.refused.length === 1 && b.refused[0].no === 'КД-2024/203' && has(b.refused[0].why, 'бланк объекта «заёмщик»'),
    `объект бланка сверяется с видом: уведомление о платеже с заёмщика не печатается; пачка справок по перечню ` +
    `заёмщиков — ${b.issued.length} выпуска, кредит в перечне назван отказом поимённо`);

  const e1 = RP.parseLayout('${Повтор: каждый Платёж}\n${Платёж.Сумма}\n${Конец повтора}', 'borrower', 'сейчас').errors;
  const e2 = RP.parseLayout('${Если: есть Поручитель}\nтекст\n${Конец условия}', 'borrower', 'сейчас').errors;
  const e3 = RP.parseLayout('${Повтор: каждый ДействующийКредит}\n${Кредит.Номер}\n${Конец повтора}', 'credit', 'сейчас').errors;
  const e4 = RP.parseLayout('${Повтор: каждый ДействующийКредит}\n${Повтор: каждое Требование}\n${Конец повтора}\n${Конец повтора}', 'borrower', 'сейчас').errors;
  ok(306, e1.length === 1 && has(e1[0].why, 'бывает у бланка объекта «кредит»') &&
        e2.length === 1 && has(e2[0].why, 'об объекте «кредит»') &&
        e3.length === 1 && has(e3[0].why, 'бывает у бланка объекта «заёмщик»') &&
        e4.some(e => has(e.why, 'повтор внутри повтора')),
    `повтор и условие говорят о своём объекте: платёж — у бланка кредита, разделы справки — у бланка заёмщика; ` +
    `вложенного повтора по-прежнему нет`);

  RP.state.sel.blank = 't-zspr'; RP.state.sel.blankObj = 'su-6'; RP.state.sel.obj = 'kr-2';
  const s1 = V.blank.fn();
  RP.state.sel.blank = 't-recon';
  const s2 = V.blank.fn();
  ok(307, has(s1, 'Заёмщик (объект бланка)') && has(s1, 'Если модуль не ответит') && has(s1, 'RP.setDown(') &&
        (s1.match(/RP\.state\.sel\.blankObj='su-/g) || []).length === 4 && has(s1, 'заказавший — сотрудник, напечатавший бумагу') &&
        has(s1, '<details class="pal-d"') && has(s1, 'ПредметЗалога.Стоимость') && has(s1, 'рабочая бумага — без номера') &&
        !has(s2, 'Если модуль не ответит') && has(s2, 'Кредит (объект бланка)'),
    `экран верстальщика: четыре трудных заёмщика, переключатель «если модуль не ответит», объект печати — заёмщик, ` +
    `получатель — заказавший; группы повтора в палитре свёрнуты; у бланка «на дату» переключателя нет`);
})();

/* ---------- RR. Волна 48: страница «Отчётность» — каталог «где мой отчёт» (ВТ-1…ВТ-14) ---------- */
(() => {
  const groupsOf = h => [...String(h).matchAll(/<tr class="sect[^"]*"[^>]*><td colspan="5">(?:<span class="caret">▸<\/span> )?([^<]*) <span class="n">· (\d+)/g)]
    .map(m => m[1] + ' ' + m[2]);
  const thead = h => (String(h).match(/<thead>[\s\S]*?<\/thead>/) || [''])[0];
  const tabN = (h, name) => { const m = String(h).match(new RegExp('>' + name + '<span class="n">(\\d+)</span>')); return m ? +m[1] : -1; };

  RP.seed(); as('user');
  const off = showTab('отчёт'), bl = showTab('бланк');
  RP.state.sel.scTab = '';
  const first = win.VIEWS.showcase.fn();
  ok(308, (first.match(/<div class="tabs[^"]*">/g) || []).length === 1 && !has(first, 'tabs sub') &&
        ['Мои', 'Общие', 'Официальные', 'Бланки'].every(n => tabN(first, n) >= 0) &&
        !has(off, 'Где печатается') && has(off, 'Просроченная задолженность') &&
        has(bl, 'Где печатается') && !has(bl, 'Портфель — оперативный срез') &&
        has(first, '>Официальные<span class="n">4</span><span class="burn">1</span>'),
    `ВТ-2: четыре полки одним рядом — Мои ${tabN(first, 'Мои')} · Общие ${tabN(first, 'Общие')} · Официальные ` +
    `${tabN(first, 'Официальные')} · Бланки ${tabN(first, 'Бланки')}; второго ряда вкладок нет; «Официальные» — только отчёты, ` +
    `бланки — своя полка; красный счётчик — у официальной просрочки`);

  const mine = showTab('мои');
  const favNo = RP.toggleFav('t-notice'), favOwn = RP.toggleFav('t-osh'), favAdd = RP.toggleFav('t-portfolio');
  const mine2 = showTab('мои');
  const favDel = RP.toggleFav('t-portfolio');
  RP.show('t-portfolio', { asOf:'2026-08-01', dept:'' });
  const vRow = (h => { const i = h.indexOf('Портфель — мой отдел'); return h.slice(i, h.indexOf('</tr>', i)); })(showTab('мои'));
  const recent = mine.slice(mine.indexOf('Недавние'));
  ok(309, groupsOf(mine).join(' | ') === 'Своё 4 | Избранное 2 | Недавние 1' &&
        has(recent, 'Погашения и портфель за период') && !has(recent, 'Просроченная задолженность') &&
        has(mine, 'личный <span class="bell"') && has(mine, 'вид поверх «Портфель — оперативный срез»') &&
        !favNo.ok && has(favNo.why, 'бланк') && !favOwn.ok && has(favOwn.why, 'полке «Мои»') &&
        favAdd.ok && groupsOf(mine2).join(' | ') === 'Своё 4 | Избранное 3 | Недавние 1' && favDel.ok && !favDel.on &&
        RP.myFavs().length === 2 && has(vRow, 'сохранён 19.08.2026'),
    `ВТ-3, ВТ-5: «Мои» Осмоновой — ${groupsOf(mine).join(' · ')}; недавняя «Просроченная задолженность» не повторена — она в ` +
    `избранном; подписка — 🔔 у строки; ★ у бланка и своего отчёта — отказ; звезда ставится и снимается`);

  as('auth'); RP.state.sel.scTab = '';
  const authFirst = win.VIEWS.showcase.fn();
  RP.show('t-portfolio', { asOf:'2026-08-01', dept:'' });
  const authAfter = win.VIEWS.showcase.fn();
  ok(310, has(authFirst, 'class="on" onclick="RP.scTabClick(\'отчёт\')"') && tabN(authFirst, 'Мои') === 0 &&
        has(authAfter, 'class="on" onclick="RP.scTabClick(\'мои\')"') && has(authAfter, 'Недавние'),
    `ВТ-4: при входе — «Мои», если там есть строки, иначе «Официальные»: у Тентимишева своего нет — «Официальные»; ` +
    `открыл отчёт — он в «Недавних», и витрина открывается на «Моих»`);

  as('user');
  const heads = ['мои', 'общие', 'отчёт', 'бланк'].map(t => thead(showTab(t)));
  const ovAt = off.indexOf('Просроченная задолженность');
  const ovRow = off.slice(ovAt, off.indexOf('</tr>', ovAt));
  const sh = showTab('общие');
  ok(311, heads.every(h => h === heads[0]) && has(heads[0], '>Название<') && has(heads[0], '>Состояние<') &&
        has(heads[0], '>Последнее<') && !has(heads[0], 'Основание') &&
        has(ovRow, 'просрочено') && has(ovRow, 'срок 15.08.2026 · сдаёт: Осмонова Г.') && has(ovRow, 'ВП-103') &&
        has(sh, 'пользуются 9') && !has(off, '<span class="code">t-') && has(off, 'Портфель к прошлому году'),
    `ВТ-6, ВТ-14: одна шапка на всех полках — ★ · Название · Состояние · Последнее; основания в строке нет; у официального — ` +
    `плашка и «срок · сдаёт» одной строкой, последний окончательный выпуск; у общего — владелец и число пользующихся; ` +
    `технического кода «t-…» у формы без кода нет`);

  RP.state.sel.scTab = 'мои'; RP.scSearch('просрочка');
  const found = win.VIEWS.showcase.fn();
  const fg = groupsOf(found);
  const tabsOk = fg.every(g => { const nm = g.replace(/ \d+$/, ''), n = +g.match(/\d+$/)[0];
    return nm === 'Недоступно' || tabN(found, nm) === n; });
  RP.scTabClick('общие'); const picked = win.VIEWS.showcase.fn();
  RP.scSearch('п. 16'); const byBasis = win.VIEWS.showcase.fn();
  RP.scSearch('Бекова'); const byOwner = win.VIEWS.showcase.fn();
  RP.scSearch(''); const back = win.VIEWS.showcase.fn();
  ok(312, fg.length >= 3 && fg[0].indexOf('Мои') === 0 && tabsOk && has(found, 'Сбросить') &&
        groupsOf(picked).length === 1 && groupsOf(picked)[0].indexOf('Общие') === 0 &&
        has(byBasis, 'Повторная претензия') && has(byBasis, 'Требование поручителю') &&
        has(byOwner, 'Просрочка по подразделениям') && groupsOf(back)[0] === 'Своё 4',
    `ВТ-7, ВТ-8: «просрочка» ищется на всех полках сразу — ${fg.join(' · ')}; корешки несут число найденного, щелчок ` +
    `по корешку оставляет одну группу; находит и по основанию («п. 16» — претензии и требование), и по владельцу; ` +
    `стёртый запрос возвращает полки`);

  RP.seed(); as('user'); RP.proposeToCatalog('t-avg'); as('buh');
  const buhAll = showAll(), reg = win.VIEWS.registry.fn();
  as('head');
  const hs = showTab('общие');
  const arch = RP.toArchive('t-sh-big');
  const hs2 = showTab('общие');
  ok(313, !has(buhAll, 'Предложены в каталог') && has(reg, 'Предложены в каталог дашборда') && has(reg, 'Принять — копия в общий') &&
        has(hs, 'не открывали 194 дн. — предлагается в архив') && has(hs, "RP.doArchive('t-sh-big')") &&
        !has(hs, 'Мои общие отчёты') && arch.ok && groupsOf(hs2).join() === 'Архив 1' &&
        has(hs2, "RP.doUnarchive('t-sh-big')") && has(hs2, 'class="fold"'),
    `ВТ-9: очередь «Предложены в каталог» — в реестре, не на витрине; передача и архив общего — в меню строки владельца, ` +
    `подсказка «не открывали 194 дн.» — в строке; архивный — свёрнутой группой «Архив» с «Вернуть»`);

  RP.seed(); as('user');
  const m1 = showTab('мои');
  const rowOf = (h, nm) => { const i = h.indexOf(nm); return i === -1 ? '' : h.slice(h.lastIndexOf('<tr', i), h.indexOf('</tr>', i)); };
  const npl = rowOf(m1, 'Доля проблемных кредитов'), ovr = rowOf(m1, 'Просроченная задолженность');
  const mains = [...m1.matchAll(/<td class="act">(<button[^>]*>[^<]*<\/button>)/g)].length;
  const rows = (m1.match(/<td class="star">/g) || []).length;
  RP.uiSub('t-npl');
  const subOn = RP.mySubs().some(x => x.tpl === 't-npl') && has(rowOf(showTab('мои'), 'Доля проблемных кредитов'), 'class="bell"');
  RP.uiSub('t-npl'); const subOff = !RP.mySubs().some(x => x.tpl === 't-npl');
  /* «📌» из меню: «Доля проблемных кредитов» выведена — плитке нечего показать (ОД-47); свой рабочий отчёт ставится. */
  RP.uiPin('t-npl'); RP.uiPin('t-osh');
  const pinned = RP.tilesOf('t-npl').length === 0 && RP.tilesOf('t-osh').length === 1;
  ok(314, mains === rows && has(npl, 'Открыть кругу') && has(npl, 'Предложить в каталог') && has(npl, 'Удалить') &&
        has(npl, 'Подписаться') && has(npl, '📌 На дашборд') && has(npl, 'class="more"') &&
        has(ovr, 'Подписаться') && !has(ovr, 'Удалить') && !has(ovr, 'Открыть кругу') && subOn && subOff && pinned,
    `ВТ-10: в каждой строке одна кнопка («Открыть» / «Где печатается»), остальное — в «⋯» по уровню: у личного — круг, ` +
    `каталог, подписка, дашборд, удалить; у официального — только подписка и дашборд; подписка из меню ставится и снимается`);

  RP.seed(); as('user');
  const ub = showTab('бланк');
  const gone = ub.slice(ub.indexOf('Недоступно'));
  as('buh'); const ar = RP.toArchive('t-sh-plan'); as('user');
  const um = showTab('мои');
  as('buh'); RP.state.sel.scQ = 'просрочка'; const bs = win.VIEWS.showcase.fn(); RP.state.sel.scQ = '';
  RP.seed(); as('buh'); const del = RP.deleteReport('t-sh-plan'); as('user');
  const ud = showTab('мои'), unFav = RP.toggleFav('t-sh-plan');
  ok(315, has(ub, '<tbody class="fold">') && has(gone, 'Первичная претензия') && has(gone, 'доступ у:') &&
        !has(ub.slice(0, ub.indexOf('Недоступно')), 'доступ у:') && /Недоступно <span class="n">· \d+ \(/.test(ub) &&
        ar.ok && groupsOf(um).join(' | ') === 'Своё 4 | Избранное 1 | Недавние 1 | Недоступно 1' &&
        has(um, 'в архиве у владельца (Бекова Н.)') && !has(bs, 'Вернуть') &&
        del.ok && has(ud, 'Просрочка по подразделениям — к планёрке') && has(ud, 'отчёт удалён владельцем') &&
        has(ud, "RP.uiFav('t-sh-plan')") && unFav.ok && RP.myFavs().length === 1,
    `ВТ-11: то, что нельзя открыть, — свёрнутой группой «Недоступно» в конце полки с причиной и тем, у кого доступ; ` +
    `избранное, ушедшее в архив или удалённое, не пропадает молча — оно там же с причиной и снимается звездой; архивное ` +
    `в найденном не стоит`);

  RP.seed();
  const bad = [];
  Object.keys(R).forEach(role => { as(role); SC_TABS.forEach(t => { const h = showTab(t);
    if (!has(h, 'Собрать отчёт') || /Мои отчёты: показать|Недавние отчёты|Мои общие отчёты|Собрать в конструкторе/.test(h)) bad.push(role + '/' + t); }); });
  as('auth');
  const ab = showTab('бланк');
  const codes = [...ab.slice(0, ab.indexOf('По запросу')).matchAll(/<span class="code">(ФО-\d+)/g)].map(m => m[1]);
  const shared = RP.shelves('').shared;
  ok(316, bad.length === 0 && codes.length > 3 && codes.join() === codes.slice().sort().join() &&
        shared.every((r, i) => !i || shared[i - 1].users >= r.users),
    `ВТ-12, ВТ-13: «Собрать отчёт» стоит на каждой полке у каждой роли, карточек-пояснений нет; обязательные бланки — по коду ` +
    `(${codes.slice(0, 3).join(', ')}…), общие — по числу пользующихся`);
})();

/* ---------- SS. Волна 49: входящие от дашборда — база сравнения и своя плитка (ОД-38…ОД-51) ---------- */
(() => {
  const ev = c => vm.runInContext(c, sandbox);
  const KB = win.KB;
  const strip = h => String(h).replace(/<!--[\s\S]*?-->/g, '');
  const BASES = ['начало месяца', 'начало квартала', 'начало полугодия', 'начало года', 'год назад'];
  const at = D => BASES.map(b => RP.anchorDate(b, D)).join(' ');

  RP.seed(); as('auth');
  const q = RP.reportAnswer({ tpl:'t-overdue', form:'ответ', params:{ asOf:'@конец прошлого месяца' },
    dates:['@конец прошлого месяца', '@начало квартала', '@начало года'], stats:['s-portfolio'] });
  /* Дата вопроса — уже подставленная: на 01.07 лежит июнь, начало квартала — 01.04. */
  const q2 = RP.reportAnswer({ tpl:'t-overdue', form:'ответ', params:{ asOf:'@начало квартала' },
    dates:['@начало квартала', '@начало квартала'], stats:['s-portfolio'] });
  /* Первая дата конкретная — она и есть дата вопроса, а не дата параметра. */
  const q3 = RP.reportAnswer({ tpl:'t-overdue', form:'ответ', params:{ asOf:'2026-08-01' },
    dates:['2026-03-01', '@год назад', '@начало года'], stats:['s-portfolio'] });
  const pq = RP.resolveParams({ asOf:'@начало полугодия' });
  ok(317, at('2026-10-01') === '2026-09-01 2026-07-01 2026-07-01 2026-01-01 2025-10-01' &&
        at('2026-10-18') === '2026-10-01 2026-10-01 2026-07-01 2026-01-01 2025-10-01' &&
        at('2026-01-01') === '2025-12-01 2025-10-01 2025-07-01 2025-01-01 2025-01-01' &&
        pq.ok && pq.params.asOf === '2026-07-01' && has(pq.rel[0], '(от 24.08.2026)') &&
        q.ok && q.dates.join() === '2026-08-01,2026-07-01,2026-01-01' &&
        q.relative.some(x => has(x, 'начало квартала = 01.07.2026 (от 01.08.2026)')) &&
        q2.ok && q2.dates.join() === '2026-04-01,2026-04-01' && q2.relative.some(x => has(x, '(от 01.07.2026)')) &&
        q3.ok && q3.dates.join() === '2026-03-01,2025-03-01,2026-01-01',
    `ОД-38, ОД-39: вторая семья — начало месяца · квартала · полугодия · года и «год назад» от даты вопроса; ` +
    `период — по дню строки: на 01.10 — сентябрь (начало месяца 01.09, квартала 01.07), на 18.10 — октябрь (01.10 и 01.10); ` +
    `без даты вопроса — от сегодня; в ответе даты — от уже подставленной даты параметра`);

  as('user');
  const cols = RP.setTimeCols('t-osh', [{ id:'d', kind:'на дату', at:'отчётная дата', name:'На отчётную дату' },
    { id:'h', kind:'на дату', at:'начало полугодия', name:'На начало полугодия' },
    { id:'y', kind:'аналогичный период', of:'d', name:'Год назад' }]);
  const tt = D => ((RP.show('t-osh', { asOf:D, dept:'' }).data || {}).timeTable || { cols:[] }).cols.map(c => c.at).join(' ');
  const t8 = tt('2026-08-01'), t6 = tt('2026-06-01');
  ok(318, cols.ok && t8 === '2026-08-01 2026-07-01 2025-08-01' && t6 === '2026-06-01 2026-01-01 2025-06-01',
    `ОД-40, ОД-41: колонка-дата «начало полугодия» законна (на 01.08 — 01.07, на 01.06 — 01.01); «аналогичный период» ` +
    `на дату — по «год назад»: последний конец месяца не позже даты минус год (${t8})`);

  RP.seed(); as('auth');
  const tot = { path:[], stat:'s-portfolio' };
  const ans = RP.reportAnswer({ tpl:'t-overdue', form:'ответ', params:{}, dates:['2026-08-01', '2026-01-01', '2025-06-01'], stats:['s-portfolio'] });
  const v = ans.ok ? ans.answers.map(a => a.stats[0].value).join(' ') : '';
  const two = RP.reportAnswer({ tpl:'t-overdue', form:'объекты на двух датах', params:{}, node: tot, a:'2025-06-01', b:'2026-08-01' });
  const fall = RP.reportAnswer({ tpl:'t-overdue', form:'провал', params:{ asOf:'2025-10-01' },
    twist:{ stats:['s-portfolio', 's-overdue-sum'] }, node: tot });
  ok(319, v === '64100000 77000000 86550000' && two.ok && two.movement.equal && two.items.length > 0 &&
        two.sources.join() === 'из легаси,свой' && has(two.formNote, 'редакции формы разные') &&
        has(two.movement.chain, '= 64 100 000') && fall.ok && fall.items.length > 0 &&
        has(ans.formNote, 'из легаси — 01.01.2026, 01.06.2025; свои — 01.08.2026'),
    `ОД-42: ответ, провал и «объекты на двух датах» через дату запуска отвечаются строками переноса; Движение сходится ` +
    `(${two.movement && two.movement.chain}); даты по разные стороны запуска — «редакции формы разные»`);

  const gone = RP.reportAnswer({ tpl:'t-overdue', form:'ответ', params:{}, dates:['2025-08-01'], stats:['s-portfolio'] });
  const twoGone = RP.reportAnswer({ tpl:'t-overdue', form:'объекты на двух датах', params:{}, node: tot, a:'@год назад', b:'2026-08-01' });
  /* Строка переноса без колонки-источника «выдано»: в легаси её не собирали. */
  const kept = ev("HIST['2025-10-01']['kr-1'].i_issued_som");
  ev("delete HIST['2025-10-01']['kr-1'].i_issued_som");
  const pre = RP.reportAnswer({ tpl:'t-overdue', form:'объекты на двух датах', params:{}, node: tot, a:'2025-10-01', b:'2026-08-01' });
  ev("HIST['2025-10-01']['kr-1'].i_issued_som = " + kept);
  const preRow = pre.ok ? pre.movement.rows.find(r => r.kind === 'до запуска') : null;
  ok(320, gone.ok && gone.answers[0].gap === 'в легаси не собиралось' && !twoGone.ok && has(twoGone.why, 'в легаси не собиралось') &&
        pre.ok && pre.movement.equal && preRow && preRow.name === 'до запуска не перенесено' && preRow.ids.join() === 'kr-1' &&
        !pre.movement.rows.some(r => r.kind === 'нет ответа'),
    `ОД-43: чего перенос не дал — пусто с причиной: итога июля 2025 нет — «в легаси не собиралось», и «год назад» от 01.08.2026 ` +
    `отказывается тем же; строка переноса без колонки-источника — «до запуска не перенесено» (${preRow && preRow.value}), а не «нет ответа источника»`);

  const di = ans.ok ? ans.dateInfo.map(x => x.text) : [];
  const sep = RP.dateInfo('2026-09-01');
  ok(321, di[0] === 'на 01.08.2026 (начало дня) — строка 31.07.2026 · июль 2026 закрыт' &&
        di[1] === 'на 01.01.2026 (начало дня) — строка 31.12.2025 · декабрь 2025 — из легаси' &&
        sep.state === 'не закрыт' && sep.month === 'август 2026' && ans.passport.dateInfo.length === 3 &&
        ans.answers[1].info.source === 'из легаси',
    `ОД-44: каждая дата ответа называет строку, месяц и его состояние — закрыт · не закрыт · из легаси; то же — в паспорте`);

  RP.seed(); as('auth');
  const cb = RP.cmpBases({ asOf:'2026-08-01' }), cbNow = RP.cmpBases({});
  RP.state.view = 'issue'; RP.state.sel.tpl = 't-overdue'; RP.state.sel.params = { asOf:'2026-08-01', dept:'' };
  RP.state.sel.view = null; RP.state.sel.twist = null; RP.state.sel.chart = false; RP.state.sel.top = false;
  RP.state.sel.time = 'сравнение'; RP.state.sel.cmpBase = 'начало года';
  const sY = win.VIEWS.issue.fn();
  RP.state.sel.cmpBase = 'год назад'; const s12 = win.VIEWS.issue.fn();
  RP.state.sel.cmpBase = null; const sOwn = win.VIEWS.issue.fn();
  RP.state.sel.time = null;
  ok(322, cb.map(b => b.label + ':' + b.a).join(' ') ===
          'за месяц:2026-07-01 за квартал:2026-07-01 за полугодие:2026-07-01 за год:2026-01-01 за 12 месяцев:2025-08-01' &&
        has(sY, 'за год<small>на 01.01.2026</small>') && has(sY, 'сравнение: 01.01.2026 → 01.08.2026') &&
        has(sY, 'База — из легаси; редакции формы разные') && has(s12, 'в легаси не собиралось') &&
        has(sOwn, 'свои даты') && has(sOwn, 'сравнение: 01.06.2026 → 01.08.2026') && cbNow.length === 0,
    `ОД-45: «Сравнение» в окне отчёта — пять баз с датой под кнопкой; база «за год» — 01.01.2026 из легаси с пометкой; ` +
    `«за 12 месяцев» на 01.08.2025 — «в легаси не собиралось»; «свои даты» — прежние`);

  RP.seed(); as('user');
  const addr = RP.showcaseAddress('просрочка');
  const op = RP.openAddress(addr), scQ = win.VIEWS.showcase.fn();
  const op2 = RP.openAddress('#otchetnost?q=' + encodeURIComponent('ипотека марсиан')), sc0 = win.VIEWS.showcase.fn();
  const bad = RP.openAddress('#dashboard?q=x');
  ok(323, addr === '#otchetnost?q=%D0%BF%D1%80%D0%BE%D1%81%D1%80%D0%BE%D1%87%D0%BA%D0%B0' && op.ok && op.q === 'просрочка' &&
        RP.state.view === 'showcase' && has(scQ, 'value="просрочка"') && has(scQ, 'Сбросить') && !has(scQ, 'Ничего не найдено') &&
        op2.ok && has(sc0, 'Ничего не найдено по «ипотека марсиан»') && has(sc0, 'Нужного отчёта нет — соберите его') &&
        !bad.ok && RP.showcaseAddress('') === '#otchetnost',
    `ОД-46: адрес витрины принимает запрос — витрина открывается с ним в поиске по всем полкам; ничего не найдено — ` +
    `«Ничего не найдено» и «Собрать отчёт»; чужой адрес — отказ`);

  RP.seed(); as('auth');
  const pOv = RP.pinToDashboard('t-overdue', null, { asOf:'2026-08-24' }, 'Главная');
  const pPay = RP.pinToDashboard('t-pay04', null, {}, 'Главная');
  const pAvg = RP.pinToDashboard('t-avg', null, {}, 'Главная');
  const pNpl = RP.pinToDashboard('t-npl', null, {}, 'Главная');
  const pBl = RP.pinToDashboard('t-notice', null, {}, 'Главная');
  as('head');
  const hid = RP.TPL('t-osh'), pHid = RP.pinToDashboard('t-osh', null, {}, 'Главная');
  as('user');
  const pView = RP.pinToDashboard('t-portfolio', 'ВД-1', {}, 'Главная');
  ok(324, pOv.ok && pOv.tile.main === 's-overdue-sum' && pOv.tile.second === 's-overdue-cnt' &&
        pPay.ok && pPay.tile.main === 's-portfolio' && pPay.tile.second === 's-overdue-sum' &&
        pAvg.ok && pAvg.tile.second === null && !pNpl.ok && has(pNpl.why, 'плитке нечего показать') &&
        !pBl.ok && has(pBl.why, 'бланк') && hid && !pHid.ok && has(pHid.why, 'не видно') &&
        pView.ok && pView.tile.label === 'Портфель — мой отдел',
    `ОД-47: «📌» проверяет бланк, видимость и числовую колонку — ответ не проверяет (плитка на 24.08 без снимка стоит); ` +
    `главное число — первая колонка, второе — следующая того же сорта, иначе нет; подпись — имя отчёта или вида`);

  RP.seed(); as('auth');
  RP.state.view = 'issue'; RP.state.sel.tpl = 't-overdue'; RP.state.sel.params = { asOf:'2026-08-01', dept:'' };
  RP.state.sel.view = null; RP.state.sel.twist = null; RP.state.sel.time = null; RP.state.sel.rel = 'date';
  RP.doPin();
  const tScr = RP.tilesOf('t-overdue').slice(-1)[0] || {};
  const iss = win.VIEWS.issue.fn();
  RP.state.sel.rel = null;
  RP.go('showcase'); const after = win.VIEWS.showcase.fn();
  RP.uiPin('t-portfolio'); const tMenu = RP.tilesOf('t-portfolio').slice(-1)[0] || {};
  const scPin = win.VIEWS.showcase.fn();
  ok(325, tScr.params && tScr.params.asOf === '@конец прошлого месяца' && tScr.main === 's-overdue-sum' &&
        has(iss, 'Плитка на главной') && has(iss, 'Настроить ↗') && !has(after, 'Плитка на главной') &&
        tMenu.params && Object.keys(tMenu.params).length === 0 && has(scPin, 'Плитка на главной · '),
    `ОД-48, ОД-Д1: из окна отчёта плитка берёт значения как на экране — относительное остаётся относительным ` +
    `(«@конец прошлого месяца», а не 01.08.2026); из «⋯» витрины — умолчания; плашка «Плитка на главной · Настроить ↗» ` +
    `гаснет при переходе`);

  RP.seed(); as('auth');
  const fd = RP.openDraftFromDashboard({ object:'credit', stats:['s-overdue-sum', 's-npl'], cuts:['dept', 'late'],
    filters:[{ field:'dept', op:'равно', value:'rep-osh' }], path:'Просрочка › Ош' });
  const st = win.S();
  const dr = win.VIEWS.draft.fn();
  const fdBad = RP.openDraftFromDashboard({ object:'луна', stats:[] });
  /* Отказ без показателя не трогает открытый черновик. */
  const fdNo = RP.openDraftFromDashboard({ object:'credit', stats:['нет-такого'], cuts:[] });
  const draftKept = win.S().stats.join() === 's-overdue-sum' && win.S().cuts.length === 2 && win.S().fromDash.path === 'Просрочка › Ош';
  KB.saveDraft('Просрочка Ош'); const dr2 = win.VIEWS.draft.fn();
  ok(326, fd.ok && RP.state.view === 'draft' && st.object === 'credit' && st.stats.join() === 's-overdue-sum' &&
        st.cuts.map(c => c.id).join() === 'dept,late' && st.filters.length === 1 && fd.lost.length === 1 &&
        has(dr, 'Черновик с дашборда') && has(dr, 'Просрочка › Ош') && has(dr, 'Не принято: выведен') &&
        !/ADR-\d|ИО-\d/.test(strip(dr).match(/Черновик с дашборда[\s\S]*?<\/div><\/div>/)[0]) &&
        !fdBad.ok && !fdNo.ok && draftKept && !has(dr2, 'Черновик с дашборда'),
    `ОД-49: черновик полосы дашборда открывается в конструкторе отчётности — объект, показатель, разрезы, фильтр по пути; ` +
    `не принятое названо; после «Сохранить черновик» плашка уходит`);

  RP.seed(); as('auth');
  const r1 = RP.reportAnswer({ tpl:'t-overdue', form:'ответ', params:{}, dates:['2026-08-01'], stats:['s-portfolio'] });
  const r2 = RP.reportAnswer({ tpl:'t-overdue', form:'ответ', params:{}, dates:['2025-08-01'], stats:['s-portfolio'] });
  const r3 = RP.reportAnswer({ tpl:'t-overdue', form:'ответ', params:{}, dates:['2026-08-24'], stats:['s-portfolio'] });
  const r4 = RP.reportAnswer({ tpl:'t-npl', form:'ответ', params:{}, dates:['2026-08-01'], stats:['s-npl'] });
  const r5 = RP.reportAnswer({ tpl:'t-overdue', form:'ответ', params:{}, dates:['@послезавтра'], stats:['s-portfolio'] });
  ok(327, r1.responds.yes && r1.responds.why === null && r2.responds.yes && has(r2.responds.why, 'в легаси не собиралось') &&
        !r3.responds.yes && has(r3.responds.why, 'снимка нет') && !r4.responds.yes && has(r4.responds.why, 'снят') &&
        !r5.ok && !r5.responds.yes && has(r5.responds.why, 'послезавтра'),
    `ОД-50: «отвечает» — по дате вопроса: число или пусто по закону — да; снимка нет, показатель снят, значение вне набора — ` +
    `нет с причиной; отказ несёт признак тоже`);

  RP.seed(); as('buh');
  const avg = RP.state.templates.find(t => t.id === 't-avg');
  RP.state.templates.push(Object.assign(JSON.parse(JSON.stringify(avg)), { id:'t-bek', owner:'Бекова Н.', name:'Мой срез просрочки' }));
  RP.pinToDashboard('t-bek', null, {}, 'Главная');
  const noRole = RP.publishTileToCatalog('t-bek', []);
  const hint = RP.publishTileToCatalog('t-bek', ['Куратор кредитов']);
  const pub = RP.publishTileToCatalog('t-bek', ['Куратор кредитов'], { force:true });
  const copy = pub.ok ? RP.TPL(pub.id) : null;
  const onShared = RP.publishTileToCatalog('t-sh-plan', ['Куратор кредитов']);
  as('user'); const notHolder = RP.publishTileToCatalog('t-avg', ['Куратор кредитов']);
  ok(328, !noRole.ok && hint.hint && pub.ok && copy && copy.level === 'общий' && copy.owner === 'Бекова Н.' &&
        copy.circle.join() === 'dep-prom,dep-admin,rep-osh' && RP.tilesOf(pub.id).length === 1 && RP.tilesOf('t-bek').length === 0 &&
        RP.TPL('t-bek').owner === 'Бекова Н.' && onShared.ok && onShared.onto === 't-sh-plan' && !notHolder.ok,
    `ОД-51: держатель роли каталога публикует свою плитку — личный отчёт копируется в общий, как при «Принять», без очереди; ` +
    `круг — подразделения держателей ролей плитки; похожий — подсказка; на общем копии нет; не держатель — предлагает`);
})();

/* ---- TT. Входящие от дашборда по ADR-0320, волна 50: перешедший — остатком на базу, потоки в узле на
        сегодня; «срок близко» — признак обязательства по одной N модуля; «нет объектов» — только от
        параметров по значению (ОД-52…ОД-59, ADR-0323) ---- */
(() => {
  RP.seed(); as('auth');
  const ev = c2 => vm.runInContext(c2, sandbox);
  const AB = { a:'2026-06-01', b:'2026-08-01' }, tot = { path:[], stat:'s-portfolio' };
  const rowOf = (d, k) => d.movement.rows.find(r => r.key === k) || { value:0, ids:[] };
  const byKind = d => { const s = {}; d.movement.rows.forEach(r => { const k = r.kind === 'переход' ? 'переход' : r.key;
    s[k] = (s[k] || 0) + r.value; }); return s; };
  const sumNodes = (cut, keys) => { const s = {}; keys.forEach(key => {
    const d = RP.drillChange('t-overdue', {}, { cuts:[cut] }, { path:[{ by:cut, key }], stat:'s-portfolio' }, AB);
    Object.entries(byKind(d)).forEach(([k, v]) => { s[k] = (s[k] || 0) + v; }); }); return s; };
  const node = (cut, key) => RP.drillChange('t-overdue', {}, { cuts:[cut] }, { path:[{ by:cut, key }], stat:'s-portfolio' }, AB);

  const act = node('status', 'действует'), od = node('status', 'просрочен');
  const k2a = act.items.find(x => x.id === 'kr-2'), k2o = od.items.find(x => x.id === 'kr-2');
  const out = rowOf(act, 'm:ушли в «просрочен»'), inn = rowOf(od, 'm:пришли из «действует»');
  ok(329, act.ok && od.ok && out.value === -5900000 && out.ids.join() === 'kr-2' && k2a.move === -5900000 &&
        Object.values(k2a.flows).every(v => v === 0) && k2a.other === 0 && inn.value === 5900000 && k2o.flows.repaid === -600000 &&
        rowOf(act, 'f:repaid').ids.indexOf('kr-2') === -1 && rowOf(od, 'f:repaid').ids.indexOf('kr-2') !== -1 &&
        act.movement.equal && od.movement.equal,
    `ОД-52: КД-2024/203 перешёл из «действует» в «просрочен» — в старом узле «ушли в «просрочен»» ${out.value} (остаток на ` +
    `базу), без потоков; в новом — «пришли из «действует»» +${inn.value} и его «погашено» −600 000: ${act.movement.chain}`);

  const STATUS = ['действует', 'просрочен', 'закрыт', 'реструктурирован', 'списан'];
  const sameRows = (S, T) => ['f:issued', 'f:repaid', 'f:woff', 'other'].every(k => (S[k] || 0) === (T[k] || 0)) && (S['переход'] || 0) === 0;
  const all = RP.drillChange('t-overdue', {}, null, tot, AB), T = byKind(all), S = sumNodes('status', STATUS);
  /* КД-2023/311 закрыт к 01.08 с нулевым остатком — в узле «закрыт» он есть, хоть и нулём. */
  ev("HIST['2026-08-01']['kr-5'].was = Object.assign({}, HIST['2026-08-01']['kr-5']); Object.assign(HIST['2026-08-01']['kr-5'], {debt_main: 0, status: 'закрыт'})");
  const T0 = byKind(RP.drillChange('t-overdue', {}, null, tot, AB)), S0 = sumNodes('status', STATUS), cl = node('status', 'закрыт');
  ev("HIST['2026-08-01']['kr-5'] = HIST['2026-08-01']['kr-5'].was");
  ok(330, sameRows(S, T) && S['f:repaid'] === -5750000 && sameRows(S0, T0) && rowOf(cl, 'm:пришли из «действует»').value === 1400000,
    `ОД-54: сумма узлов статуса в каждой строке Движения равна итогу — «погашено» ${S['f:repaid']} (было −6 350 000: ` +
    `поток перешедшего — дважды), «прочее» ${S.other}; переходы гасятся; КД-2023/311, закрытый с нулём, приходит в ` +
    `«закрыт» строкой «пришли из «действует»» +1 400 000 — «прочее» узлов ${S0.other} = итогу ${T0.other}`);

  /* КД-2024/117 передан: на 01.06 числился за администрированием, сейчас — промышленность. */
  ev("HIST['2026-06-01']['kr-1'].dept = 'dep-admin'");
  as('user'); const u = RP.drillChange('t-overdue', {}, null, tot, AB);
  as('head'); const h = RP.drillChange('t-overdue', {}, null, tot, AB);
  as('auth'); const D = sumNodes('dept', ['dep-admin', 'dep-prom', 'rep-osh']), adm = node('dept', 'dep-admin'), prm = node('dept', 'dep-prom');
  const k1u = u.items.find(x => x.id === 'kr-1'), k1h = h.items.find(x => x.id === 'kr-1');
  ev("delete HIST['2026-06-01']['kr-1'].dept");
  ok(331, rowOf(u, 'm:пришли в охват').value === 8100000 && k1u.how === 'пришёл в охват' && k1u.flows.repaid === -700000 &&
        k1u.other === 0 && rowOf(h, 'm:ушли из охвата').value === -8100000 && Object.values(k1h.flows).every(v => v === 0) &&
        rowOf(h, 'f:repaid').value === rowOf(adm, 'f:repaid').value && rowOf(u, 'f:repaid').value === rowOf(prm, 'f:repaid').value &&
        u.movement.equal && h.movement.equal && D['f:repaid'] === -5750000 && (D['переход'] || 0) === 0,
    `ОД-53: КД-2024/117 передан из администрирования в промышленность — у Осмоновой «пришли в охват» ` +
    `+${rowOf(u, 'm:пришли в охват').value} и его «погашено» −700 000, у Асанова «ушли из охвата» ${rowOf(h, 'm:ушли из охвата').value} ` +
    `без потоков; узлы «Подразделение» в сумме — итог, переходы гасятся`);

  const t7 = RP.obligationTiles();
  RP.state.remind = 8; const t8 = RP.obligationTiles(), seam = RP.reportObligations('dep-prom');
  RP.state.remind = 30; const t30 = RP.obligationTiles(), late30 = RP.obligations().filter(o => o.state === 'просрочено');
  RP.state.remind = 7;
  ok(332, t7.soon === 0 && t7.remind === 7 && t8.soon === 3 && t30.soon === 3 && t30.late === 2 && late30.every(o => !o.soon) &&
        seam.filter(x => x.soon).map(x => x.tpl).join() === 'Акт сверки задолженности' &&
        RP.obligationRows().filter(r => r.soon).length === 0,
    `ОД-55, ОД-56: «срок близко» — признак строки обязательства: при N = 7 близких ${t7.soon} (акт сверки — через 8 дней), ` +
    `при N = 8 — ${t8.soon} (день срока включительно); просроченные (${t30.late}) не «близки» и при N = 30; шов заданиям — тот же признак`);

  as('user'); const byUser = RP.setRemindDays(8);
  as('auth'); const neg = RP.setRemindDays(-1), frac = RP.setRemindDays(2.5), blank = RP.setRemindDays(''), same = RP.setRemindDays(7),
    set = RP.setRemindDays('8');
  const lg = RP.state.remindLog.slice(-1)[0], after = RP.obligationTiles();
  ok(333, !byUser.ok && has(byUser.why, 'уполномоченный') && !neg.ok && !frac.ok && !blank.ok && !same.ok && set.ok && after.soon === 3 &&
        RP.state.remindLog.length === 1 && lg.from === 7 && lg.to === 8 && lg.by === 'Тентимишев К.' && lg.at === RP.state.today &&
        RP.state.log[0].msg.indexOf('7 → 8') !== -1,
    `ОД-57, ОД-58: N правит только уполномоченный («${byUser.why}»); −1, 2,5 и пустое поле — отказ; 7 → 8 — запись журнала ` +
    `«${lg.by}, ${lg.at}: ${lg.from} → ${lg.to}», плитка «близко» — ${after.soon}`);

  RP.seed(); as('auth');
  const P = { asOf:'2026-08-01' }, thr = { groups:[[{ field:'days', op:'больше', value:100000 }]] };
  const f0 = RP.filterAnswer('t-overdue', P, thr), f1 = RP.filterAnswer('t-overdue', Object.assign({}, P, { dept:'dep-legal' }), thr);
  const pv = RP.show('t-overdue', Object.assign({}, P, { dept:'dep-legal' }));
  ok(334, f0.ok && f0.matched === 0 && f0.data.empty === null && f0.data.totals.every(t => t.value === 0) &&
        pv.data.empty && pv.data.empty.cause === 'параметр' && f1.data.empty && f1.data.empty.cause === 'параметр' &&
        has(f1.data.empty.why, 'Департамент правового обеспечения') && !has(f1.data.empty.why, 'по списку'),
    `ОД-59: фильтр «Дней просрочки больше 100 000» не отобрал никого — число 0 без признака (было «объекты = 1 по списку»); ` +
    `под параметром «подразделение = ДПО» — «${pv.data.empty && pv.data.empty.why}», и с фильтром тоже`);

  RP.state.view = 'calendar'; const cA = win.VIEWS.calendar.fn();
  RP.setRemindDays(8); const cA8 = win.VIEWS.calendar.fn();
  as('user'); const cU = win.VIEWS.calendar.fn();
  const clean = [cA, cA8, cU].every(x => !/ОД-\d|ADR-0\d|ИО-6\d/.test(x.replace(/<!--[\s\S]*?-->/g, '')));
  ok(335, has(cA, 'Напоминать за N к.д. до срока') && has(cA, 'type="number"') && has(cA, 'Сейчас таких: 0') &&
        !has(cA, 'срок близко</span>') && has(cA8, 'срок близко</span>') && has(cA8, 'через 8 дней') && has(cA8, 'Сейчас таких: 3') &&
        has(cA8, 'Изменено 24.08.2026 · Тентимишев К.: 7 → 8 к.д.') && !has(cU, 'type="number"') &&
        has(cU, 'правит уполномоченный по отчётности') && clean,
    `экран «Календарь сдачи»: настройка «Напоминать за N к.д. до срока» у уполномоченного, у пользователя — значением; ` +
    `при N = 8 у акта сверки — «срок близко · через 8 дней», строка изменения; номеров решений в интерфейсе нет`);
})();

/* ---- UU. Входящие от ядра по ADR-0322, волна 51: курсовая разница — поток Движения, «Остаток основного долга» —
        четыре потока по телу, ненулевое «прочее» — расхождение, пустой поток — с колонкой, Движение в сомах
        (ОД-60…ОД-65, ADR-0324) ---- */
(() => {
  RP.seed(); as('auth');
  const ev = c2 => vm.runInContext(c2, sandbox);
  const tot = { path:[], stat:'s-portfolio' }, AB = { a:'2026-06-01', b:'2026-08-01' };
  const rowOf = (d, k) => d.movement.rows.find(r => r.key === k) || {};
  const STATUS = ['действует', 'просрочен', 'закрыт', 'реструктурирован', 'списан'];
  const node = key => RP.drillChange('t-overdue', {}, { cuts:['status'] }, { path:[{ by:'status', key }], stat:'s-portfolio' }, AB);
  const fl = SEAM.objectMeta('credit').flows['s-portfolio'];
  const pf = RP.drillChange('t-overdue', {}, null, tot, AB), pr = node('просрочен');
  const fxNodes = STATUS.reduce((s2, k) => s2 + (rowOf(node(k), 'f:fx').value || 0), 0);
  const kr1 = pf.items.find(x => x.id === 'kr-1');
  ok(336, fl.length === 4 && fl[3].name === 'курсовая разница' && fl[3].src === 'i_fx_od_som' && fl[3].sign === 1 &&
        rowOf(pf, 'f:fx').value === -250000 && rowOf(pf, 'f:fx').ids.join() === 'kr-6' && rowOf(pf, 'other').value === 0 &&
        rowOf(pr, 'f:fx').value === -250000 && rowOf(pr, 'other').value === 0 && pr.movement.equal && fxNodes === -250000 &&
        kr1.flows.fx === 0 && pf.movement.equal,
    `ОД-60, ОД-61: запись кредита объявляет у «Остатка основного долга» четыре потока — ${fl.map(f => f.name).join(' · ')}; ` +
    `КД-2025/126 (USD) 01.06 → 01.08.2026 — «курсовая разница» −250 000, «прочее» 0; в узле «просрочен» то же: ` +
    `${pr.movement.chain}; сумма узлов статуса по курсовой = итогу; у кредита в сомах курсовая — 0`);

  const saved = ev("JSON.stringify(HIST['2026-08-01']['kr-6'])");
  ev("HIST['2026-08-01']['kr-6'].i_fx_od_som = -200000");
  const bad = RP.drillChange('t-overdue', {}, null, tot, AB), k6 = bad.items.find(x => x.id === 'kr-6');
  RP.state.view = 'issue'; RP.state.sel.tpl = 't-overdue'; RP.state.sel.params = { asOf:'2026-08-01', dept:'' };
  RP.state.sel.view = null; RP.state.sel.twist = null; RP.state.sel.time = null; RP.state.sel.top = false;
  RP.state.sel.drillRes = bad; RP.state.sel.drillMv = null; RP.state.sel.drillQ = ''; RP.state.sel.drillCard = null;
  const eb = win.VIEWS.issue.fn();
  ev("HIST['2026-08-01']['kr-6'] = JSON.parse(" + JSON.stringify(saved) + ")");
  ok(337, rowOf(bad, 'other').value === -50000 && rowOf(bad, 'other').ids.join() === 'kr-6' && k6.otherOff && bad.movement.equal &&
        has(eb, 'не сходится с потоками') && has(eb, 'расхождение у источника') && has(eb, 'не сходится с потоками записи') &&
        RP.drillChange('t-overdue', {}, null, tot, AB).items.every(x => !x.otherOff),
    `ОД-62: источник отдал курсовую −200 000 вместо −250 000 — «прочее» −50 000 у КД-2025/126 печатается, строка помечена ` +
    `«не сходится с потоками · у остатка, замкнутого потоками, здесь 0 — расхождение у источника», объект — «не сходится с ` +
    `потоками записи»; цепочка сходится; на данных стенда меток нет`);

  ev("HIST['2026-08-01']['kr-6'].i_fx_od_som = null");
  const na = RP.drillChange('t-overdue', {}, null, tot, AB), n6 = na.items.find(x => x.id === 'kr-6');
  RP.state.sel.drillRes = na; const en = win.VIEWS.issue.fn();
  ev("HIST['2026-08-01']['kr-6'] = JSON.parse(" + JSON.stringify(saved) + ")");
  /* Строка переноса без колонки-источника — «до запуска не перенесено», а не «пусто: …». */
  const kept = ev("HIST['2025-10-01']['kr-1'].i_issued_som");
  ev("delete HIST['2025-10-01']['kr-1'].i_issued_som");
  const pre = RP.drillChange('t-overdue', {}, null, tot, { a:'2025-10-01', b:'2026-08-01' }), p1 = pre.items.find(x => x.id === 'kr-1');
  ev("HIST['2025-10-01']['kr-1'].i_issued_som = " + kept);
  ok(338, rowOf(na, 'noans').value === -400000 && rowOf(na, 'noans').ids.join() === 'kr-6' && n6.empty.join() === 'пусто: курсовая разница' &&
        n6.other === 0 && !n6.otherOff && rowOf(na, 'f:fx').value === 0 && na.movement.equal &&
        has(en, 'нет ответа источника (пусто: курсовая разница)') && !has(en, 'потоки объяснили всё') &&
        p1 && p1.prel && !p1.empty.length && !p1.noans,
    `ОД-63: курсов по датам нет — курсовая разница КД-2025/126 пуста; его разница −400 000 — «нет ответа источника», ` +
    `не «прочее» и не ноль; у объекта названа колонка — «${n6.empty.join()}»`);

  const c8 = RP.currencyAnswer('t-overdue', { asOf:'2026-08-01' }, { stat:'s-portfolio', show:'USD' });
  RP.state.sel.drillRes = null; RP.state.sel.usd = true; const eu = win.VIEWS.issue.fn(); RP.state.sel.usd = false;
  const clean = [eb, en, eu].every(x => !/ОД-\d|ADR-03\d\d|ИО-6\d/.test(x.replace(/<!--[\s\S]*?-->/g, '')));
  ok(339, c8.ok && has(c8.fx, 'своей строкой') && has(c8.fx, 'в сомах') && has(c8.fx, 'не пересчитываются') && pf.unit === 'сом' &&
        has(eu, 'строки Движения не пересчитываются') && clean,
    `ОД-64: пересчёт в USD — только итог (${c8.shown.value} USD по курсу 83,66), подсказка: «${c8.fx}»; Движение — в сомах; ` +
    `номеров решений в интерфейсе нет`);
})();

/* ---- отчёт ---- */
const pass = results.filter(r => r.pass).length;
const lines = results.map(r => `   ${r.pass ? 'PASS' : 'FAIL'}  #${r.n}  ${r.note}`);
console.log(`SMOKE 2026-10-20 · ${pass}/${results.length} PASS\n` + lines.join('\n'));

const body = lines.map(l => '  ' + l).join('\n');
const injected = `  SMOKE 2026-10-20 · ${pass}/${results.length} PASS\n` + body;
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
