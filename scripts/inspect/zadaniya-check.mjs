// Headless смоук для mockups/zadaniya/zadaniya.html — волна 1+2+3+4 модуля «Задания» (шестой модуль).
// Zero-dep: вытаскивает <script> из HTML и исполняет логический слой в node:vm (без DOM —
// render() и toast() при отсутствии document становятся no-op, экраны не рисуются).
// Приёмка волны 1 (ADR-0231, ИЗ-17) — не «код есть», а РАБОТАЮЩИЙ самоопрос:
//   A  непустой первый прогон (3 повода из 3 демо-заданий, заведённых до первого опроса);
//   B  идемпотентный повтор (второй прогон в ту же дату: new=0, matched=3, gone=0);
//   C  воспроизведённая заморозка при недоступном источнике («заморожен» на каждый повод,
//      answer='таймаут', complete=false) и разморозка следующим успешным прогоном.
// Дальше — структурные инварианты волны:
//   D  три реестра (ИЗ-8): вид повода / действие / правило, ровно 6 своих видов (ИЗ-16 п.10);
//   E  журнал — только дозапись, состояние выводится чтением последней записи, не хранится
//      полем (ИЗ-6 п.11 / ADR-0136 §5);
//   F  исход выводится перекрёстно, не раньше срока (ИЗ-6);
//   G  свободное поручение без контролёра запрещено (ИЗ-7 п.13) — независимая ось подтверждения;
//   H  оба рода ручного задания (ИЗ-5 п.5): свободное поручение и правило в ручном режиме;
//   I  жёсткий стопор рекурсии, один шаг (ИЗ-16 п.11);
//   J  рубильник вида повода (ИЗ-13 п.12): не введён в действие — поводов не порождает,
//      но факт неактивности сам становится поводом («вид повода не введён в действие»);
//   K  уведомления — закрытый список из девяти состояний (ИЗ-14 п.1);
//   L  сторож чистоты: в макете нет ссылок на ADR/ИЗ/волны (их место — канон и ТЗ),
//      «сегодня» заморожено константой.
// Волна 2 (ADR-0231 п.4-5, ADR-0228 ИЗ-8) — первый настоящий сосед, Оргструктура, подключён
// вторым источником в SOURCES, движок сверки не менялся:
//   M  #33-40 — полнота множества у нового соседа, порог свёртки первого подключения (2), три
//      обычных вида поштучно, пустые виды без ошибки, ИЗ-13 ключ на реальных видах объекта
//      (unit/employee/territory, не только task), ИЗ-13 clamp базы срока на backdated-состоянии,
//      Заёмщик/КЗ-13 подтверждённо отсутствует как источник, независимая заморозка по источнику.
// Волна 3 (02.09.2026) — второй настоящий сосед, Статистика (ST.askLeads), третьим источником в
// SOURCES, движок сверки снова не менялся, кроме одной новой ветки в computeExpectedForKind:
//   N  #41-45 — непустой первый прогон, идемпотентный повтор, ИЗ-13 ключ взят ЦЕЛИКОМ у соседа
//      (не пересобран), вид объекта «module» на реальном соседе «взыскание», независимая
//      заморозка третьего источника (не гасит self/orgstruct), закрытие повода штатной сверкой
//      (не заморозкой) когда сосед отвечает пустым, но полным множеством.
// Волна 4 (02.09.2026) — третий настоящий сосед, Отчётность (RP.obligations), четвёртым источником
// в SOURCES, движок сверки снова не менялся, кроме одной новой ветки в computeExpectedForKind:
//   O  #46-53 — непустой первый прогон (только state==='просрочено' из всей формы), намеренно
//      низкий порог свёртки (3 просроченных > 2 сворачиваются в вал-таск), идемпотентный повтор,
//      ИЗ-13 ключ взят ЦЕЛИКОМ у соседа (o.id), ИЗ-13 clamp базы срока на предельно старом due,
//      фильтр не пропускает НЕ-просроченные строки соседа, независимая заморозка четвёртого
//      источника (не гасит self/orgstruct/statistics), адресация жёстко на E4 (RESPONSIBLE[dep]
//      соседа — ростер имён, несовместимый с EMP id — исследовано и задокументировано, не угадано).
// Решения ЗН-1…ЗН-10 канона (§14 «Макет против модели»), 10.10.2026:
//   P  #54-75 — адресат формулой правила (кураторство → замещение → запасной → администратор и
//      повод «адресат не найден»), переадресация непринятого и пятое основание видимости,
//      продление (запрос/утверждение, установленный срок, повод «запрос без ответа», «срок истёк»
//      на каждый установленный срок), двенадцать уведомлений, отметка о ходе и ссылка на
//      подтверждение, переназначение без условий, повтор повода и «повод возвращается», реквизит
//      суммы и строки статистике, вал как контейнер ключей, поглощение периодом.
//   Поменялись по канону: #11 (девять своих видов), #13 (восемь авто + одно ручное), #28
//   (двенадцать уведомлений), #47 (вал адресован запасному адресату, не хардкоду).
// Блоки, которые правят состояние, начинаются с ZD.seed() — состояние между ними не течёт.
// Отчёт печатается в консоль, макет не правится; выход 1 при любом FAIL.
//   node scripts/inspect/zadaniya-check.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dir = dirname(fileURLToPath(import.meta.url));
const HTML  = resolve(__dir, '../../mockups/zadaniya/zadaniya.html');
const src   = readFileSync(HTML, 'utf8');

const m = src.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('<script> не найден в HTML'); process.exit(1); }
const win = {};
const sandbox = { window: win, console, setTimeout: () => {}, clearTimeout: () => {} };
vm.createContext(sandbox);
vm.runInContext(m[1], sandbox, { filename: 'zadaniya.inline.js' });
const ZD = win.ZD;
if (!ZD) { console.error('window.ZD не экспортирован'); process.exit(1); }

const results = [];
const ok = (n, cond, note = '') => results.push({ n, pass: !!cond, note });
ZD.seed();
const TODAY = ZD.state.today;

/* ---------- A. Первый прогон самоопроса непустой ---------- */
(() => {
  ZD.seed();
  const before = ZD.state.povods.length;
  const r = ZD.runPoll();
  ok(1, before === 0 && r.complete === true && r.sources.length === 4 &&
       r.sources.every(s => s.answer === 'множество'),
    `прогон ${r.id} на дату ${r.date}: все четыре источника волны 1-4 (self, orgstruct, statistics, reports) ответили «множество» (ИЗ-12 п.5)`);
  ok(2, r.sources[0].new === 3 && r.sources[0].matched === 0 && r.sources[0].gone === 0,
    `первый прогон непустой на собственных видах (source[0]=self): 3 новых повода из 3 демо-заданий, ` +
    `заведённых ДО опроса (ИЗ-17 приёмка)`);
  const keys = ZD.state.povods.filter(p => ZD.SELF_KINDS.includes(p.kind)).map(p => p.key).sort();
  ok(3, keys.join('|') === ['pk-await-long|task:T3|','pk-overdue|task:T1|','pk-rejected|task:T7|'].sort().join('|'),
    `три ключа тройкой «вид · объект · период» (ИЗ-13 п.9) среди собственных видов ` +
    `(org-поводы того же прогона проверяются отдельно, #33+): ${keys.join(', ')}`);
  const issued = ZD.state.tasks.filter(t => t.originKind && ZD.SELF_KINDS.includes(t.originKind));
  ok(4, issued.length === 3 && issued.every(t => t.ruleId && t.ruleEdition === 1),
    `на каждый новый повод СВОЕГО вида правило в авто-режиме выдало задание с редакцией правила (ИЗ-9 п.7): ` +
    `${issued.map(t=>t.id+':'+t.originKind).join(', ')}`);
})();

/* ---------- B. Идемпотентный повтор ---------- */
(() => {
  ZD.seed();
  ZD.runPoll();
  const totalBefore = ZD.state.tasks.length;
  const r2 = ZD.runPoll();
  ok(5, r2.sources[0].new === 0 && r2.sources[0].matched === 3 && r2.sources[0].gone === 0,
    `повторный прогон той же датой: new=0, matched=3, gone=0 — полная сверка множества идемпотентна (ИЗ-3 п.2)`);
  ok(6, ZD.state.tasks.length === totalBefore,
    `повторный прогон не выдал второе задание поверх открытого — иначе ключ «повод × действие» ` +
    `перестал бы держать ≤1 открытое задание на пару (ИЗ-5 п.5)`);
})();

/* ---------- C. Заморозка при недоступном источнике и разморозка ---------- */
(() => {
  ZD.seed();
  ZD.runPoll();
  const appearedBefore = ZD.state.povods.filter(p => p.status === 'appeared').length;
  const rf = ZD.runPoll({ down: true });
  ok(7, rf.complete === false && rf.sources[0].answer === 'таймаут',
    `прогон с недоступным источником объявлен НЕполным в журнале прогонов, а не тихо пропущен (ИЗ-12 п.7)`);
  const frozen = ZD.state.povods.filter(p => p.status === 'frozen');
  ok(8, frozen.length === appearedBefore &&
       frozen.every(p => p.journal[p.journal.length-1].ev === 'заморожен'),
    `молчание соседа не есть пустота: все ${frozen.length} повода заморожены, не отпали ` +
    `(«состояние не подтверждено», ИЗ-12 п.6), в журнал повода вписано «заморожен»`);
  const rr = ZD.runPoll({ down: false });
  ok(9, rr.complete === true && rr.sources[0].new === 0 && rr.sources[0].gone === 0,
    `следующий успешный прогон воспроизводится: заморозка снимается, ни один повод не потерян и ` +
    `не пересчитан как «новый» (сравнить с A/B — тот же результат при том же входе)`);
  const thawed = ZD.state.povods.filter(p => p.status === 'appeared');
  ok(10, thawed.length === appearedBefore &&
        thawed.every(p => p.journal[p.journal.length-1].ev === 'разморожен'),
    `разморозка — отдельная запись журнала «разморожен», не молчаливый откат статуса`);
})();

/* ---------- D. Три реестра (ИЗ-8), ровно 6 своих видов повода (ИЗ-16 п.10) ---------- */
(() => {
  ZD.seed();
  ok(11, ZD.SELF_KINDS.length === 9 &&
        ZD.SELF_KINDS.join(',') === ['pk-overdue','pk-rejected','pk-await-long','pk-lapsed-review','pk-neighbor-silent','pk-kind-inactive',
          'pk-addr-missing','pk-ext-pending','pk-returning'].join(','),
    `девять собственных видов повода, порядок как в каноне §4: ${ZD.SELF_KINDS.join(' · ')}`);
  const kindsOk = ZD.SELF_KINDS.every(id => {
    const k = ZD.kindOf(id);
    return k && k.objectType && Array.isArray(k.traits) && typeof k.rollup === 'number' && 'sensitive' in k;
  });
  const actionsOk = ZD.SELF_KINDS.every(id => ZD.actionOf(ZD.ruleForKind(id).action));
  const rulesOk = ZD.SELF_KINDS.every(id => {
    const r = ZD.ruleForKind(id);
    return r && ['авто','ручной'].includes(r.mode) && r.author && Array.isArray(r.editions) && r.editions.length >= 1;
  });
  ok(12, kindsOk && actionsOk && rulesOk,
    `три реестра держат разные вещи (ИЗ-8 п.1-3): вид повода — владелец/объект/признаки/порог/чувствительность, ` +
    `действие — формулировку и важность, правило — режим/автора/срок/редакции; уровня «шаблон» нет`);
  const modes = ZD.SELF_KINDS.map(id => ZD.ruleForKind(id).mode);
  ok(13, modes.filter(x=>x==='авто').length === 8 && modes.filter(x=>x==='ручной').length === 1 &&
        ZD.ruleForKind('pk-kind-inactive').mode === 'ручной',
    `восемь правил авто-режима, одно ручное («вид повода не введён в действие») — демонстрирует ручной триггер`);
})();

/* ---------- E. Журнал append-only, состояние выводится, не хранится полем ---------- */
(() => {
  ZD.seed();
  const t = ZD.state.tasks[0];
  const jLenBefore = t.journal.length;
  ok(14, !('state' in t) && !('status' in t),
    `у задания нет поля-состояния — состояние читается функцией по последней записи журнала (ADR-0136 §5)`);
  ZD.claim(t.id);
  ok(15, t.journal.length === jLenBefore + 1 && t.journal[jLenBefore].ev !== undefined,
    `переход дописал журнал, не переписал прежнюю запись — журнал только растёт`);
  const beforeLast = JSON.stringify(t.journal[0]);
  ok(16, JSON.stringify(t.journal[0]) === beforeLast,
    `более ранняя запись журнала не изменилась переходом — задним числом журнал не переписывается`);
})();

/* ---------- F. Исход выводится перекрёстно, не раньше срока ---------- */
(() => {
  ZD.seed();
  const t = ZD.state.tasks.find(x => ZD.deriveState(x).indexOf('отказано') === -1 && ZD.deriveState(x) !== 'ожидает приёмки');
  ok(17, ZD.outcomeOf(t) === null,
    `у незакрытого задания исхода нет — исход не поле, а вывод только из терминальной записи (ИЗ-6)`);
  const rejected = ZD.state.tasks.find(x => ZD.deriveState(x) === 'отказано');
  ZD.releaseTask(rejected.id, 'решение автора — демо');
  const o = ZD.outcomeOf(rejected);
  ok(18, o && o.outcome === 'снято' && ZD.isTerminal(rejected),
    `«снято» — исход, доступный только после предварительного «отказано» (releaseTask отбит бы иначе)`);
})();

/* ---------- G. Свободное поручение без контролёра запрещено (ИЗ-7 п.13) ---------- */
(() => {
  ZD.seed();
  let threw = false, msg = '';
  try { ZD.createFreeTask({ label:'демо без контролёра', assignee:'E1', author:'E4', dueDate:'2026-09-10' }); }
  catch (e) { threw = true; msg = e.message; }
  ok(19, threw && /контролёр/.test(msg),
    `свободное поручение обязано иметь контролёра — единственную независимую ось подтверждения ` +
    `у работы без собственного повода: «${msg}»`);
  const t = ZD.createFreeTask({ label:'демо с контролёром', assignee:'E1', controller:'E4', author:'E4', dueDate:'2026-09-10' });
  ok(20, !!t && t.controller === 'E4',
    `с контролёром свободное поручение заводится штатно`);
})();

/* ---------- H. Оба рода ручного задания (ИЗ-5 п.5) ---------- */
(() => {
  ZD.seed();
  const free = ZD.state.tasks.filter(t => t.kind === 'free');
  ok(21, free.length === 4 && free.every(t => t.controller),
    `первый род — свободное поручение без повода и ключа, с обязательным контролёром: ` +
    `${free.length} демо-задания заведены до первого опроса`);
  ZD.deactivateKind('pk-rejected');
  const r = ZD.runPoll();
  const manualPovod = ZD.state.povods.find(p => p.kind === 'pk-kind-inactive' && p.status !== 'gone');
  ok(22, !!manualPovod && ZD.ruleForKind('pk-kind-inactive').mode === 'ручной',
    `второй род — правило существует и режим ручной; повод «вид не введён в действие» появился, ` +
    `но задание сам опрос не выдал (mode!=='авто' в handleNewForKind)`);
  const beforeManual = ZD.state.tasks.filter(t => t.originKind === 'pk-kind-inactive').length;
  const out = ZD.issueManual('pk-kind-inactive');
  const afterManual = ZD.state.tasks.filter(t => t.originKind === 'pk-kind-inactive').length;
  ok(23, beforeManual === 0 && Array.isArray(out) && out.length === 1 && afterManual === 1,
    `человек нажимает «поручить вручную» — задание рождается по тому же правилу, тем же путём issueRuleTask, ` +
    `что и авто-режим (единый механизм, ИЗ-8 п.3)`);
})();

/* ---------- I. Жёсткий стопор рекурсии, один шаг (ИЗ-16 п.11) ---------- */
(() => {
  ZD.seed();
  ZD.runPoll();
  const born = ZD.state.tasks.find(t => t.originKind === 'pk-overdue');
  born.dueDate = '2026-08-01'; // искусственно просрочили задание, рождённое поводом «просрочено»
  const before = ZD.state.povods.length;
  const r2 = ZD.runPoll();
  const recursed = ZD.state.povods.some(p => p.key.indexOf(born.id) !== -1);
  ok(24, !recursed && r2.sources[0].new === 0 && r2.sources[0].matched === 3,
    `просроченное задание, рождённое поводом «просрочено», НЕ породило второй повод «просрочено» ` +
    `на себя — originKind===kindId стопорит рекурсию за один шаг, а не настраиваемой глубиной`);
})();

/* ---------- J. Рубильник вида повода (ИЗ-13 п.12) ---------- */
(() => {
  ZD.seed();
  ZD.deactivateKind('pk-rejected');
  ok(25, ZD.kindOf('pk-rejected').activatedAt === null,
    `деактивация обнулила дату ввода в действие — реквизит-рубильник (ИЗ-13 п.12)`);
  const r = ZD.runPoll();
  const ownPovod = ZD.state.povods.some(p => p.kind === 'pk-rejected' && p.status !== 'gone');
  const metaPovod = ZD.state.povods.some(p => p.kind === 'pk-kind-inactive' && p.objectId === 'pk-rejected');
  ok(26, !ownPovod && metaPovod,
    `не введённый в действие вид не породил СВОЙ повод (T7 остался без «задание отклонено»), но факт ` +
    `неактивности сам стал поводом «вид повода не введён в действие» — оба положения ИЗ-13 п.12 в одном прогоне`);
  ZD.activateKind('pk-rejected');
  const r2 = ZD.runPoll();
  const revived = ZD.state.povods.some(p => p.kind === 'pk-rejected' && p.status !== 'gone');
  ok(27, revived,
    `после «ввести в действие» вид снова порождает поводы — рубильник обратим`);
})();

/* ---------- K. Уведомления: закрытый список из девяти состояний (ИЗ-14 п.1) ---------- */
(() => {
  ZD.seed();
  const CLOSED = ['повод-появился','поручено','принято','срок-близко','срок-истёк','эскалация','возвращено','повод-отпал','закрыто',
    'переадресовано','запрошено-продление','решение-по-продлению'];
  ok(28, ZD.NOTIF_KINDS.length === 12 && ZD.NOTIF_KINDS.join(',') === CLOSED.join(','),
    `двенадцать видов, ни одного информационного («кредит выдан») — список закрыт буквально (канон §6, ИЗ-21)`);
  ZD.seed();
  const beforeN = ZD.state.notifications.length;
  ZD.runPoll();
  const afterN = ZD.state.notifications.length;
  ok(29, afterN > beforeN && ZD.state.notifications.every(n => CLOSED.includes(n.kind)),
    `самоопрос породил уведомления, и каждое — из закрытого списка (движок бросил бы на восьмом глаголе)`);
})();

/* ---------- L. Сторож чистоты макета, «сегодня» заморожено ---------- */
(() => {
  const noComm = m[1];
  const refs = src.match(/ADR-\d{4}|ИЗ-\d+|ИО-\d+|ЗН-\d+|[Вв]олн[аеыуой][ -]*\d/g) || [];
  ok(30, refs.length === 0,
    `макет чистый: ни ADR-, ни ИЗ-/ИО-/ЗН-номеров, ни истории волн — пояснения живут в ` +
    `ASUBK-zadaniya-logika.md и журнале волн${refs.length?' · найдено: '+[...new Set(refs)].join(', '):''}`);
  const frozen = /today:\s*'2026-09-02'/.test(noComm) &&
                 !/Date\.now\(\)/.test(noComm) && !/new Date\(\s*\)/.test(noComm);
  ok(31, frozen,
    `«сегодня» заморожено константой '2026-09-02' в состоянии, системных часов в движке нет — ` +
    `прогон воспроизводится между запусками смоука`);
  const scriptOpenCount = (src.match(/<script>/g) || []).length;
  const scriptCloseCount = (src.match(/<\/script>/g) || []).length;
  ok(32, scriptOpenCount === 1 && scriptCloseCount === 1,
    `ровно один открывающий и один закрывающий тег script во всём файле, включая шапку и уже вписанный ` +
    `отчёт — наивный извлекатель регэкспом (этот смоук и его аналог для kuratorstvo) иначе режет не с того места`);
})();

/* ---------- M. Волна 2 — Оргструктура подключена первым настоящим соседом ---------- */
(() => {
  ZD.seed();
  const r = ZD.runPoll();
  const orgSrc = r.sources.find(s => s.name.indexOf('Оргструктура') !== -1);
  ok(33, !!orgSrc && orgSrc.answer === 'множество' && orgSrc.new === 6,
    `первое подключение Оргструктуры: полное множество за все шесть видов сразу, 6 новых поводов ` +
    `(3 headVacant + 1 acting-expiring + 1 no-staff + 1 orphan-terr; invariant/liq-blocked пусты на ` +
    `этих демо-данных — #36)`);
})();

(() => {
  ZD.seed();
  const r = ZD.runPoll();
  const orgSrc = r.sources.find(s => s.name.indexOf('Оргструктура') !== -1);
  const headPovods = ZD.state.povods.filter(p => p.kind === 'pk-org-head-vacant');
  const rollupTask = ZD.state.tasks.find(t => t.originKind === 'pk-org-head-vacant' && !t.povodKey && Array.isArray(t.rollupKeys));
  const noIndividual = !ZD.state.tasks.some(t => t.originKind === 'pk-org-head-vacant' && t.povodKey);
  ok(34, orgSrc.rollup.includes('pk-org-head-vacant') && headPovods.length === 3 &&
       !!rollupTask && rollupTask.rollupKeys.length === 3 && noIndividual,
    `первое подключение — намеренно низкий порог свёртки 2 (ADR-0231 п.5, ИЗ-12 п.8): 3 вакансии ` +
    `руководителя выше порога свернулись в один вал-таск ${rollupTask ? rollupTask.id : '?'}, ни одного ` +
    `поштучного задания на эти три повода не выдано`);
})();

(() => {
  ZD.seed();
  ZD.runPoll();
  const kinds = ['pk-org-acting-expiring','pk-org-no-staff','pk-org-orphan-terr'];
  const okEach = kinds.every(k => {
    const povods = ZD.state.povods.filter(p => p.kind === k);
    const tasks = ZD.state.tasks.filter(t => t.originKind === k && t.povodKey);
    return povods.length === 1 && tasks.length === 1;
  });
  ok(35, okEach,
    `три остальных непустых вида Оргструктуры (acting-expiring/no-staff/orphan-terr) — по 1 строке, ` +
    `ниже порога свёртки 2 — выдают задания поштучно как обычно, без свёртки`);
})();

(() => {
  ZD.seed();
  let threw = false;
  try { ZD.runPoll(); } catch (e) { threw = true; }
  const invPovods = ZD.state.povods.filter(p => p.kind === 'pk-org-invariant');
  const liqPovods = ZD.state.povods.filter(p => p.kind === 'pk-org-liq-blocked');
  ok(36, !threw && invPovods.length === 0 && liqPovods.length === 0,
    `пустые списки соседа (invariant/liq-blocked на этих демо-данных) дают ноль поводов без ошибки — ` +
    `полное множество допускает пустой ответ по виду, это не молчание источника (ИЗ-3)`);
})();

(() => {
  ZD.seed();
  ZD.runPoll();
  const orgPovods = ZD.state.povods.filter(p => /^pk-org-/.test(p.kind));
  const shapeOk = orgPovods.length > 0 &&
    orgPovods.every(p => /^pk-org-[a-z-]+\|(unit|employee|territory):.+\|$/.test(p.key));
  ok(37, shapeOk,
    `ключ шва на реальных видах объекта Оргструктуры держит ту же тройку «вид повода · (вид объекта+id) · ` +
    `период» (ИЗ-13 п.9), объект — не «task», как у собственных видов, а unit/employee/territory: ` +
    `${orgPovods.slice(0,2).map(p=>p.key).join(' · ')}`);
})();

(() => {
  ZD.seed();
  ZD.runPoll();
  const headPovods = ZD.state.povods.filter(p => p.kind === 'pk-org-head-vacant');
  const clamped = headPovods.length === 3 && headPovods.every(p => p.stateDate === '2026-09-02');
  const traitsHonest = headPovods.some(p => p.traits && typeof p.traits.дней_вакансии === 'number' && p.traits.дней_вакансии > 0);
  ok(38, clamped && traitsHonest,
    `демо-строка headVacant датирована у соседа 20.07.2026 (задолго до подключения), но povod.stateDate ` +
    `прижат к дате ввода вида в действие 02.09.2026 (ИЗ-13 п.9 — база срока = max(дата состояния у соседа, ` +
    `дата активации), защита от вала backdated-состояний на первом подключении); признак «дней_вакансии» ` +
    `тем не менее честно хранит реальную давность у соседа`);
})();

(() => {
  ZD.seed();
  const r = ZD.runPoll();
  const names = r.sources.map(s => s.name);
  ok(39, r.sources.length === 4 && !names.some(n => /заёмщик|КЗ-13/i.test(n)),
    `Заёмщик/КЗ-13 не участвует ни в одном прогоне как источник опроса — односторонний поток в обратную ` +
    `сторону (ADR-0229 «Последствия»): КЗ-13 остаётся витриной, датированные строки приходят ИЗ заданий, ` +
    `не наоборот (не подключался — граница задокументирована в журнале волны 2, не решена кодом; ` +
    `${r.sources.length} источника волны 1-4 — self/orgstruct/statistics/reports)`);
})();

(() => {
  ZD.seed();
  ZD.runPoll();
  const selfAppearedBefore = ZD.state.povods.filter(p => ZD.SELF_KINDS.includes(p.kind) && p.status === 'appeared').length;
  const orgAppearedBefore = ZD.state.povods.filter(p => /^pk-org-/.test(p.kind) && p.status === 'appeared').length;
  const r = ZD.runPoll({ downSources: ['orgstruct'] });
  const orgSrc = r.sources.find(s => s.name.indexOf('Оргструктура') !== -1);
  const selfSrc = r.sources.find(s => s.name.indexOf('самоопрос') !== -1);
  const selfStillAppeared = ZD.state.povods.filter(p => ZD.SELF_KINDS.includes(p.kind) && p.status === 'appeared').length;
  const orgFrozen = ZD.state.povods.filter(p => /^pk-org-/.test(p.kind) && p.status === 'frozen').length;
  ok(40, r.complete === false && orgSrc.answer === 'таймаут' && selfSrc.answer === 'множество' &&
       selfStillAppeared === selfAppearedBefore && orgAppearedBefore > 0 && orgFrozen === orgAppearedBefore,
    `независимая заморозка по отдельному источнику (opts.downSources, волна 2): молчит только Оргструктура — ` +
    `её ${orgFrozen} повода замерзают, self остаётся цел (${selfStillAppeared} appeared без изменений) — ` +
    `источники не гасят друг друга, недоступность соседа не есть недоступность модуля`);
})();

/* ---------- Волна 3 (02.09.2026) — третий источник, Статистика (ST.askLeads) ---------- */
(() => {
  ZD.seed();
  const before = ZD.state.povods.filter(p => p.kind === 'pk-stat-neighbor-silent').length;
  const r = ZD.runPoll();
  const statSrc = r.sources.find(s => s.name.indexOf('Статистика') !== -1);
  const statPovods = ZD.state.povods.filter(p => p.kind === 'pk-stat-neighbor-silent');
  const task = ZD.state.tasks.find(t => t.originKind === 'pk-stat-neighbor-silent');
  ok(41, before === 0 && statSrc && statSrc.answer === 'множество' && statSrc.new === 1 &&
       statPovods.length === 1 && !!task && task.action === 'act-stat-silent',
    `первый прогон от Статистики непустой (демо-повод взыскания): источник «${statSrc && statSrc.name}» ` +
    `ответил «множество», 1 новый повод «${statPovods[0] && statPovods[0].key}», правило в авто-режиме ` +
    `сразу выдало задание ${task && task.id} (подключение — записью реестра, ADR-0231 п.4)`);
})();

(() => {
  ZD.seed();
  ZD.runPoll();
  const tasksBefore = ZD.state.tasks.length;
  const r2 = ZD.runPoll();
  const statSrc = r2.sources.find(s => s.name.indexOf('Статистика') !== -1);
  ok(42, statSrc.new === 0 && statSrc.matched === 1 && statSrc.gone === 0 && ZD.state.tasks.length === tasksBefore,
    `повторный прогон той же датой на источнике Статистики: new=0, matched=1, gone=0, второе задание ` +
    `поверх открытого не выдано — полная сверка идемпотентна и здесь (ИЗ-3 п.2), тем же движком, что у self/orgstruct`);
})();

(() => {
  ZD.seed();
  ZD.runPoll();
  const p = ZD.state.povods.find(p => p.kind === 'pk-stat-neighbor-silent');
  const keyIsNeighbours = p && p.key === 'сосед-молчит/взыскание/с-2026-08-20';
  ok(43, keyIsNeighbours && p.objectType === 'module' && p.objectId === 'взыскание' &&
       p.traits.прогонов_подряд === 3 && /отказал по правам/.test(p.traits.причины) && /недоступен/.test(p.traits.причины),
    `ключ шва — целиком тот, что отдаёт сосед («${p && p.key}»), не пересобран в свою тройку ` +
    `«kindId|type:id|» (ИЗ-13 п.9 — не переизобретать период); вид объекта — «module» на реальном соседе ` +
    `«взыскание», не «task», как у собственных видов`);
})();

(() => {
  ZD.seed();
  ZD.runPoll();
  const selfAppearedBefore = ZD.state.povods.filter(p => ZD.SELF_KINDS.includes(p.kind) && p.status === 'appeared').length;
  const orgAppearedBefore = ZD.state.povods.filter(p => /^pk-org-/.test(p.kind) && p.status === 'appeared').length;
  const r = ZD.runPoll({ downSources: ['statistics'] });
  const statSrc = r.sources.find(s => s.name.indexOf('Статистика') !== -1);
  const selfSrc = r.sources.find(s => s.name.indexOf('самоопрос') !== -1);
  const orgSrc = r.sources.find(s => s.name.indexOf('Оргструктура') !== -1);
  const selfStillAppeared = ZD.state.povods.filter(p => ZD.SELF_KINDS.includes(p.kind) && p.status === 'appeared').length;
  const orgStillAppeared = ZD.state.povods.filter(p => /^pk-org-/.test(p.kind) && p.status === 'appeared').length;
  const statFrozen = ZD.state.povods.filter(p => p.kind === 'pk-stat-neighbor-silent' && p.status === 'frozen').length;
  ok(44, r.complete === false && statSrc.answer === 'таймаут' && selfSrc.answer === 'множество' && orgSrc.answer === 'множество' &&
       selfStillAppeared === selfAppearedBefore && orgStillAppeared === orgAppearedBefore && statFrozen === 1,
    `независимая заморозка третьего источника: молчит только Статистика — её 1 повод замерзает, ` +
    `self (${selfStillAppeared}) и Оргструктура (${orgStillAppeared}) остаются целы без изменений — ` +
    `три источника не гасят друг друга (ИЗ-12 п.6)`);
})();

(() => {
  ZD.seed();
  ZD.runPoll();
  const task = ZD.state.tasks.find(t => t.originKind === 'pk-stat-neighbor-silent');
  const povodKeyBefore = task.povodKey;
  ZD.toggleStatCleared(true);
  const r2 = ZD.runPoll();
  const statSrc = r2.sources.find(s => s.name.indexOf('Статистика') !== -1);
  const p = ZD.povodByKey(povodKeyBefore);
  const taskAfter = ZD.taskOf(task.id);
  ok(45, statSrc.answer === 'множество' && statSrc.gone === 1 && p.status === 'gone' &&
       p.journal[p.journal.length - 1].ev === 'отпал' &&
       !ZD.isTerminal(taskAfter) && ZD.lastEv(taskAfter) === 'отпало',
    `когда сосед перестаёт молчать (streak обнуляется у Статистики — полное, но ПУСТОЕ множество, ` +
    `не таймаут), повод отпадает штатной сверкой ИЗ-3, а не заморозкой: журнал повода — «отпал»; ` +
    `открытое на него задание не тихо закрыто, а помечено «отпало» — тем же путём, что и любое ` +
    `непринятое задание с отпавшим поводом (handleGoneForKind), и само становится кандидатом на ` +
    `собственный повод «отпавшее задание требует разбора» (pk-lapsed-review) при следующем самоопросе`);
})();

/* ---------- Волна 4 (02.09.2026) — четвёртый источник, Отчётность (RP.obligations) ---------- */
(() => {
  ZD.seed();
  const before = ZD.state.povods.filter(p => p.kind === 'pk-rep-obligation-overdue').length;
  const r = ZD.runPoll();
  const repSrc = r.sources.find(s => s.name.indexOf('Отчётность') !== -1);
  const repPovods = ZD.state.povods.filter(p => p.kind === 'pk-rep-obligation-overdue');
  ok(46, before === 0 && repSrc && repSrc.answer === 'множество' && repSrc.new === 3 &&
       repPovods.length === 3,
    `первый прогон от Отчётности непустой: источник «${repSrc && repSrc.name}» ответил «множество», ` +
    `3 новых повода (только state==='просрочено' из всей формы RP.obligations() — ` +
    `кандидатная фраза ADR-0210 «срок сдачи формы истекает/истёк»); подключение — записью реестра, ` +
    `четвёртым в SOURCES (ADR-0231 п.4)`);
})();

(() => {
  ZD.seed();
  const r = ZD.runPoll();
  const repSrc = r.sources.find(s => s.name.indexOf('Отчётность') !== -1);
  const rollupTask = ZD.state.tasks.find(t => t.originKind === 'pk-rep-obligation-overdue');
  ok(47, repSrc.rollup.indexOf('pk-rep-obligation-overdue') !== -1 &&
       !!rollupTask && Array.isArray(rollupTask.rollupKeys) && rollupTask.rollupKeys.length === 3 &&
       rollupTask.addr && rollupTask.addr.via === 'запасной' && rollupTask.addr.responsible === 'E2' && rollupTask.assignee === 'E5',
    `первое подключение — намеренно низкий порог свёртки 2 (ADR-0231 п.5, ИЗ-12 п.8): 3 просроченных ` +
    `обязательства (dep-admin/dep-prom/rep-osh за один и тот же период) выше порога свернулись в один ` +
    `вал-таск ${rollupTask && rollupTask.id}, ни одного поштучного задания на эти три повода не выдано; ` +
    `у ключей разные кураторы (E1/E3/нет) — вал ушёл запасному адресату (руководитель «Сопровождения» E2, ` +
    `в отпуске → действует E5), а не хардкоду E4`);
})();

(() => {
  ZD.seed();
  ZD.runPoll();
  const tasksBefore = ZD.state.tasks.length;
  const r2 = ZD.runPoll();
  const repSrc = r2.sources.find(s => s.name.indexOf('Отчётность') !== -1);
  ok(48, repSrc.new === 0 && repSrc.matched === 3 && repSrc.gone === 0 && ZD.state.tasks.length === tasksBefore,
    `повторный прогон той же датой на источнике Отчётности: new=0, matched=3, gone=0, второй вал-таск ` +
    `поверх открытого не выдан — полная сверка идемпотентна и здесь (ИЗ-3 п.2), тем же движком, что у ` +
    `self/orgstruct/statistics`);
})();

(() => {
  ZD.seed();
  ZD.runPoll();
  const keys = ZD.state.povods.filter(p => p.kind === 'pk-rep-obligation-overdue').map(p => p.key).sort();
  const expected = ['t-overdue/2026-07-01/dep-admin','t-overdue/2026-07-01/dep-prom','t-overdue/2026-07-01/rep-osh'].sort();
  const p = ZD.povodByKey('t-overdue/2026-07-01/dep-admin');
  ok(49, keys.join('|') === expected.join('|') && p && p.objectType === 'obligation' && p.objectId === 'dep-admin',
    `ключ шва — целиком тот, что отдаёт сосед (o.id из RP.obligations(), «${keys.join(', ')}»), тем же ` +
    `приёмом, что у Статистики в волне 3 — не пересобран в свою тройку «kindId|type:id|» (ИЗ-13 п.9, ` +
    `у Отчётности тоже ровно один вид повода на дверь); вид объекта — «obligation», объект — подразделение ` +
    `(dept), не «task», как у собственных видов`);
})();

(() => {
  ZD.seed();
  ZD.runPoll();
  const repPovods = ZD.state.povods.filter(p => p.kind === 'pk-rep-obligation-overdue');
  const clamped = repPovods.length === 3 && repPovods.every(p => p.stateDate === '2026-09-02');
  const traitsHonest = repPovods.every(p => p.traits && typeof p.traits.дней_просрочки === 'number' && p.traits.дней_просрочки > 40);
  ok(50, clamped && traitsHonest,
    `демо-строки обязательства датированы у соседа due=2026-07-15 (~7 недель до подключения 02.09.2026), но ` +
    `povod.stateDate прижат к дате ввода вида в действие 02.09.2026 (ИЗ-13 п.9 — база срока = max(due у ` +
    `соседа, дата активации), тот же clamp, что у Оргструктуры/Статистики #38/#38); признак «дней_просрочки» ` +
    `тем не менее честно хранит реальную давность у соседа (${repPovods[0] && repPovods[0].traits.дней_просрочки} дн.)`);
})();

(() => {
  ZD.seed();
  ZD.runPoll();
  const periods = ZD.state.povods.filter(p => p.kind === 'pk-rep-obligation-overdue').map(p => p.traits.период);
  ok(51, periods.length === 3 && periods.every(pd => pd === 'июнь 2026'),
    `фильтр по state==='просрочено' действительно отсёк НЕ-povod-worthy строки соседа (RP.obligations() ` +
    `отдаёт 5 строк одного шаблона: 3 «просрочено» за июнь + 1 «сдано» за июль + 1 «ожидается» за август) — ` +
    `поводов ровно 3, все с периодом «июнь 2026», ни одна строка «сдано»/«ожидается» повода не породила`);
})();

(() => {
  ZD.seed();
  ZD.runPoll();
  const selfAppearedBefore = ZD.state.povods.filter(p => ZD.SELF_KINDS.includes(p.kind) && p.status === 'appeared').length;
  const orgAppearedBefore = ZD.state.povods.filter(p => /^pk-org-/.test(p.kind) && p.status === 'appeared').length;
  const statAppearedBefore = ZD.state.povods.filter(p => p.kind === 'pk-stat-neighbor-silent' && p.status === 'appeared').length;
  const r = ZD.runPoll({ downSources: ['reports'] });
  const repSrc = r.sources.find(s => s.name.indexOf('Отчётность') !== -1);
  const selfSrc = r.sources.find(s => s.name.indexOf('самоопрос') !== -1);
  const orgSrc = r.sources.find(s => s.name.indexOf('Оргструктура') !== -1);
  const statSrc = r.sources.find(s => s.name.indexOf('Статистика') !== -1);
  const selfStillAppeared = ZD.state.povods.filter(p => ZD.SELF_KINDS.includes(p.kind) && p.status === 'appeared').length;
  const orgStillAppeared = ZD.state.povods.filter(p => /^pk-org-/.test(p.kind) && p.status === 'appeared').length;
  const statStillAppeared = ZD.state.povods.filter(p => p.kind === 'pk-stat-neighbor-silent' && p.status === 'appeared').length;
  const repFrozen = ZD.state.povods.filter(p => p.kind === 'pk-rep-obligation-overdue' && p.status === 'frozen').length;
  ok(52, r.complete === false && repSrc.answer === 'таймаут' &&
       selfSrc.answer === 'множество' && orgSrc.answer === 'множество' && statSrc.answer === 'множество' &&
       selfStillAppeared === selfAppearedBefore && orgStillAppeared === orgAppearedBefore &&
       statStillAppeared === statAppearedBefore && repFrozen === 3,
    `независимая заморозка четвёртого источника: молчит только Отчётность — её ${repFrozen} повода замерзают, ` +
    `self (${selfStillAppeared}), Оргструктура (${orgStillAppeared}) и Статистика (${statStillAppeared}) ` +
    `остаются целы без изменений — четыре источника не гасят друг друга (ИЗ-12 п.6)`);
})();

(() => {
  ZD.seed();
  const r = ZD.runPoll();
  ok(53, r.sources.length === 4 && r.sources[3].name.indexOf('Отчётность') !== -1,
    `сторож структуры источников волны 4: SOURCES держит ровно 4 записи, четвёртая — Отчётность ` +
    `(RP.obligations), подключённая тем же приёмом реестра, что Оргструктура и Статистика — движок ` +
    `runPoll()/computeExpectedForKind не переписан целиком, только дополнена одна ветка сверки (ADR-0228 ИЗ-8)`);
})();

/* ---------- P. Решения ЗН-1…ЗН-10 (канон §14) ---------- */
const at = d => { ZD.state.today = d; };
const taskByKey = re => ZD.state.tasks.find(t => t.povodKey && re.test(t.povodKey));
const notes = (kind, taskId) => ZD.state.notifications.filter(n => n.kind === kind && (!taskId || n.taskId === taskId));
const throws = fn => { try { fn(); return ''; } catch (e) { return e.message || 'ошибка'; } };

/* ЗН-1 — адресат формулой правила */
(() => {
  ZD.seed();
  ZD.runPoll();
  const bat = taskByKey(/Баткенская/);
  const stat = ZD.state.tasks.find(t => t.originKind === 'pk-stat-neighbor-silent');
  ok(54, bat && bat.addr.by === 'кураторство' && bat.addr.responsible === 'E2' && bat.addr.subst === true &&
       bat.assignee === 'E5' && stat && stat.assignee === 'E1' && stat.addr.responsible === 'E1',
    `адресат — формула правила: «Баткенская» → роль «куратор подразделения» → ответственный E2, в отпуске → ` +
    `действует E5 (замещение на дату); сосед-модуль «взыскание» → куратор модуля E1, а не руководитель ` +
    `одноимённого отдела «Взыскание» E5 и не администратор E4 — омоним не смешан`);
})();

(() => {
  ZD.seed();
  ZD.runPoll();
  const orphan = taskByKey(/^pk-org-orphan-terr/);
  ok(55, orphan && orphan.addr.via === 'запасной' && orphan.addr.responsible === 'E2' && orphan.assignee === 'E5' &&
       !ZD.state.povods.some(p => p.kind === 'pk-addr-missing'),
    `объект без закрепления (unit-talas-obl) → запасной адресат: руководитель подразделения-владельца вида ` +
    `(«Сопровождение», E2 → действует E5); цепочка не дошла до администратора — повода «адресат не найден» нет`);
})();

(() => {
  ZD.seed();
  ZD.runPoll();
  at('2026-09-04');
  ZD.runPoll();
  const zalog = ZD.state.tasks.find(t => t.originKind === 'pk-stat-neighbor-silent' && /залог/.test(t.povodKey));
  const sameRun = ZD.state.povods.some(p => p.kind === 'pk-addr-missing');
  const r = ZD.runPoll();
  const pv = ZD.state.povods.find(p => p.kind === 'pk-addr-missing' && zalog && p.objectId === zalog.id);
  const fix = ZD.state.tasks.find(t => t.originKind === 'pk-addr-missing' && pv && t.povodKey === pv.key);
  ok(56, zalog && zalog.assignee === 'E4' && zalog.addr.via === 'администратор' && zalog.addr.responsible === null &&
       !sameRun && !!pv && pv.traits.роль === 'куратор модуля-соседа' && !!fix && fix.assignee === 'E4',
    `конец цепочки: у модуля «залог» нет куратора, у подразделения-владельца «Аналитика» нет руководителя → ` +
    `задание ${zalog && zalog.id} администратору E4, и на следующем самоопросе это само стало поводом ` +
    `«адресат не найден» (${pv && pv.key}) с заданием ${fix && fix.id} — хардкод больше не тихий`);
})();

/* ЗН-2 — переадресация непринятого, пятое основание видимости */
(() => {
  ZD.seed();
  ZD.runPoll();
  const bat = taskByKey(/Баткенская/);
  const e2SeesByCuration = ZD.visibleTo(bat, 'E2') && !ZD.chiefChainIncludes(bat.assignee, 'E2') &&
    bat.author !== 'E2' && bat.controller !== 'E2';
  at('2026-09-04');
  ZD.runPoll();
  const ev = bat.journal.filter(e => e.ev === 'переадресовано');
  ok(57, e2SeesByCuration && ev.length === 1 && ev[0].from === 'E5' && ev[0].to === 'E1' && bat.assignee === 'E1' &&
       ZD.lastEv(bat) === 'поручено' && notes('переадресовано', bat.id).some(n => n.to === 'E5') &&
       ZD.visibleTo(bat, 'E1') && ZD.responsibleNow(bat) === 'E1' && bat.addr.responsible === 'E1',
    `02.09 задание видит ответственный по кураторству E2 — не исполнитель, не автор, не руководитель по ` +
    `цепочке (пятое основание); 04.09 закрепление «Баткенской» перешло к E1 — непринятое задание ` +
    `переадресовано E5 → E1 событием «переадресовано», снова «поручено», прежнему ушло уведомление, снимок адресата обновлён`);
})();

(() => {
  ZD.seed();
  ZD.runPoll();
  const bat = taskByKey(/Баткенская/);
  ZD.claim(bat.id, 'приказ №12 о продлении и.о.');
  at('2026-09-04');
  ZD.runPoll();
  ok(58, bat.assignee === 'E5' && !bat.journal.some(e => e.ev === 'переадресовано') && ZD.lastEv(bat) !== 'поручено',
    `то же закрепление сменилось, но задание уже взято в работу — остаётся у исполнителя E5, переадресации нет ` +
    `(состояние «${ZD.deriveState(bat)}»)`);
})();

/* ЗН-3 — продление: запрос и утверждение, установленный срок */
(() => {
  ZD.seed();
  const t = ZD.state.tasks.find(x => x.label.indexOf('скан согласия') !== -1); // E1, контролёр E4, срок 10.09
  const notExec = throws(() => ZD.requestExtension(t.id, 'E2', '2026-09-17', 'жду документ'));
  ZD.requestExtension(t.id, 'E1', '2026-09-17', 'заёмщик в командировке');
  const dueWhilePending = ZD.dueOf(t);
  const wrongApprover = throws(() => ZD.decideExtension(t.id, 'E2', true));
  ZD.decideExtension(t.id, 'E4', true);
  ok(59, notExec && wrongApprover && dueWhilePending === '2026-09-10' && ZD.dueOf(t) === '2026-09-17' &&
       t.dueDate === '2026-09-10' && ZD.extensionsOf(t) === 1 && ZD.lastEv(t) === 'поручено' &&
       notes('запрошено-продление', t.id).some(n => n.to === 'E4') && notes('решение-по-продлению', t.id).some(n => n.to === 'E1'),
    `запрашивает только исполнитель («${notExec}»); пока запрос без решения, срок прежний (10.09); решает ` +
    `контролёр, а не любой («${wrongApprover}»); утверждено — установленный срок 17.09, первоначальный 10.09 ` +
    `сохранён, продлений 1, состояние не сдвинулось`);
})();

(() => {
  ZD.seed();
  const t = ZD.state.tasks.find(x => x.label.indexOf('скан согласия') !== -1);
  ZD.requestExtension(t.id, 'E1', '2026-09-17', 'заёмщик в командировке');
  ZD.runPoll();
  const early = ZD.state.povods.some(p => p.kind === 'pk-ext-pending');
  at('2026-09-04');
  ZD.runPoll();
  const pv = ZD.state.povods.find(p => p.kind === 'pk-ext-pending' && p.objectId === t.id);
  const fix = ZD.state.tasks.find(x => x.originKind === 'pk-ext-pending' && pv && x.povodKey === pv.key);
  ok(60, !early && !!pv && pv.traits.давность_раб_дней === 2 && !!fix && fix.assignee === 'E4',
    `запрос продления без решения дольше 1 р.д. (02.09 → 04.09) стал собственным поводом «запрос продления ` +
    `без ответа» с заданием утверждающему E4; в день запроса повода не было`);
})();

(() => {
  ZD.seed();
  const t = ZD.state.tasks.find(x => x.label.indexOf('Сверить остаток') !== -1); // E1, срок 25.08 — истёк
  ZD.runPoll();
  const first = notes('срок-истёк', t.id).length;
  ZD.requestExtension(t.id, 'E1', '2026-09-03', 'ждём выписку банка');
  ZD.decideExtension(t.id, 'E4', true);
  at('2026-09-04');
  ZD.runPoll();
  ZD.runPoll();
  const all = notes('срок-истёк', t.id);
  ok(61, first === 1 && all.length === 2 && all[0].due === '2026-08-25' && all[1].due === '2026-09-03',
    `«срок истёк» — однократно на каждый установленный срок: по 25.08 и по продлённому 03.09, повторный ` +
    `прогон третьего не дал`);
})();

/* ЗН-4 — двенадцать уведомлений */
(() => {
  ZD.seed();
  const outside = throws(() => ZD.notify(ZD.state.tasks[0], 'кредит-выдан'));
  ZD.runPoll();
  const t = ZD.state.tasks.find(x => x.label.indexOf('скан согласия') !== -1);
  ZD.requestExtension(t.id, 'E1', '2026-09-17', 'основание');
  ZD.decideExtension(t.id, 'E4', false, 'срок держим');
  at('2026-09-04');
  ZD.runPoll();
  const kinds = new Set(ZD.state.notifications.map(n => n.kind));
  const fresh = ['переадресовано','запрошено-продление','решение-по-продлению'];
  ok(62, /вне закрытого списка/.test(outside) && fresh.every(k => kinds.has(k)) &&
       ZD.state.notifications.every(n => ZD.NOTIF_KINDS.includes(n.kind)),
    `три новых вида реально отправляются движком (переадресация по смене закрепления, запрос и решение ` +
    `по продлению), всё остальное — из того же закрытого списка; вне списка — ошибка («${outside}»)`);
})();

/* ЗН-5 — отметка о ходе, ссылка на подтверждение */
(() => {
  ZD.seed();
  const t = ZD.state.tasks.find(x => x.label.indexOf('скан согласия') !== -1);
  const st = ZD.deriveState(t), nBefore = ZD.state.notifications.length, jBefore = t.journal.length;
  ZD.addProgress(t.id, 'E1', 'запросил скан у заёмщика', { link: 'письмо исх-118' });
  ZD.addProgress(t.id, 'E4', 'проверил запрос — адрес верный');
  const firstNote = JSON.stringify(t.journal[jBefore]);
  ZD.addProgress(t.id, 'E1', 'исх-119, а не исх-118', { fixes: jBefore });
  const outsider = throws(() => ZD.addProgress(t.id, 'E5', 'чужая отметка'));
  const badFix = throws(() => ZD.addProgress(t.id, 'E1', 'правлю поручение', { fixes: 0 }));
  ok(63, ZD.deriveState(t) === st && ZD.state.notifications.length === nBefore && t.journal.length === jBefore + 3 &&
       JSON.stringify(t.journal[jBefore]) === firstNote && t.journal[jBefore + 2].fixes === jBefore &&
       !!outsider && !!badFix,
    `три отметки (исполнитель и контролёр): состояние «${st}» не сдвинулось, уведомлений ноль; исправление — ` +
    `новая отметка со ссылкой на прежнюю, прежняя не тронута; не участнику — отказ, «исправить» ` +
    `не-отметку — отказ`);
})();

(() => {
  ZD.seed();
  ZD.runPoll();
  const bat = taskByKey(/Баткенская/);
  const noProof = throws(() => ZD.claim(bat.id));
  const stillOpen = ZD.lastEv(bat) === 'поручено';
  ZD.claim(bat.id, 'приказ №12');
  const e = bat.journal[bat.journal.length - 1];
  ok(64, /подтвержден/.test(noProof) && stillOpen && e.ev === 'заявлено' && e.proof === 'приказ №12',
    `действие «Продлить или закрыть исполнение обязанностей» требует ссылку на подтверждение: без неё ` +
    `сдача отбита («${noProof}»), со ссылкой — реквизит записи «заявлено»`);
})();

/* ЗН-6 — переназначение без условий */
(() => {
  ZD.seed();
  const t = ZD.state.tasks.find(x => x.label.indexOf('скан согласия') !== -1); // E1, автор E4, руководитель E2
  const dueBefore = ZD.dueOf(t);
  const stranger = throws(() => ZD.reassignTask(t.id, 'E3', 'E3', 'возьму'));
  const self = throws(() => ZD.reassignTask(t.id, 'E3', 'E1', 'отдаю'));
  const noReason = throws(() => ZD.reassignTask(t.id, 'E3', 'E2', ''));
  ZD.reassignTask(t.id, 'E3', 'E2', 'Есенова на выездной проверке');
  const ev = t.journal[t.journal.length - 1];
  const claimed = ZD.state.tasks.find(x => ZD.deriveState(x) === 'ожидает приёмки');
  ZD.reassignTask(claimed.id, 'E1', 'E4', 'перераспределение участков');
  const closed = ZD.createFreeTask({ label: 'x', assignee: 'E1', controller: 'E4', author: 'E4', dueDate: '2026-09-10' });
  ZD.claim(closed.id); ZD.acceptDecision(closed.id, true);
  const terminal = throws(() => ZD.reassignTask(closed.id, 'E3', 'E4', 'поздно'));
  ok(65, stranger && self && noReason && terminal && t.assignee === 'E3' && ev.ev === 'переназначено' &&
       ev.by === 'E2' && ZD.lastEv(t) === 'поручено' && ZD.dueOf(t) === dueBefore &&
       notes('переадресовано', t.id).some(n => n.to === 'E1') && claimed.assignee === 'E1' && ZD.lastEv(claimed) === 'поручено',
    `руководитель исполнителя E2 переназначил «поручено» без отказа, с основанием; срок не обнулён; ` +
    `автор переназначил даже «ожидает приёмки»; отбиты: посторонний, сам исполнитель, без основания, закрытое`);
})();

/* ЗН-7 — повтор повода */
(() => {
  ZD.seed();
  ZD.runPoll();
  const first = ZD.state.tasks.find(t => t.originKind === 'pk-stat-neighbor-silent');
  ZD.toggleStatCleared(true); ZD.runPoll();
  ZD.disposeLapsed(first.id, 'исполнено', 'сосед ответил');
  const outcome = JSON.stringify(ZD.outcomeOf(first));
  ZD.toggleStatCleared(false); ZD.runPoll();
  const again = ZD.state.tasks.filter(t => t.povodKey === first.povodKey);
  const second = again[again.length - 1];
  ok(66, again.length === 2 && second !== first && second.repeatOf === first.id && second.repeatCount === 1 &&
       ZD.isTerminal(first) && JSON.stringify(ZD.outcomeOf(first)) === outcome,
    `ключ «${first.povodKey}» вернулся после закрытия ${first.id}: закрытое не переоткрыто (исход тот же), ` +
    `рождено ${second && second.id} «повтор после ${second && second.repeatOf}», повторов по ключу: ${second && second.repeatCount}`);
})();

(() => {
  ZD.seed();
  ZD.runPoll();
  const key = ZD.state.povods.find(p => p.kind === 'pk-stat-neighbor-silent').key;
  for (let i = 0; i < 3; i++) { ZD.toggleStatCleared(true); ZD.runPoll(); ZD.toggleStatCleared(false); ZD.runPoll(); }
  const before = ZD.state.povods.some(p => p.kind === 'pk-returning');
  ZD.runPoll();
  const pv = ZD.state.povods.find(p => p.kind === 'pk-returning');
  const fix = ZD.state.tasks.find(t => t.originKind === 'pk-returning');
  ok(67, !before && !!pv && pv.objectId === key && pv.traits.повторов === 3 && !!fix && fix.assignee === 'E4',
    `ключ вновь появился 3 раза за 30 дней — собственный повод «повод возвращается» (${pv && pv.key}) с ` +
    `заданием администратору: разбирать причину, а не симптом`);
})();

/* ЗН-8 — реквизит суммы, строки статистике */
(() => {
  ZD.seed();
  ZD.runPoll();
  const t = ZD.state.tasks.find(x => x.label.indexOf('скан согласия') !== -1);
  ZD.requestExtension(t.id, 'E1', '2026-09-17', 'основание'); ZD.decideExtension(t.id, 'E4', true);
  const rows = ZD.taskRows();
  const row = rows.find(r => r.task === t.id);
  const ruleRow = rows.find(r => r.kind === 'pk-rep-obligation-overdue');
  const noMoney = rows.every(r => !Object.keys(r).some(k => /сумм|amount|sum$/i.test(k)));
  const kindsDeclare = ZD.state.povodKinds.every(k => Object.prototype.hasOwnProperty.call(k, 'sumAttr'));
  const tasksNoSum = ZD.state.tasks.every(x => !Object.keys(x).some(k => /sum|сумм/i.test(k)));
  ok(68, kindsDeclare && tasksNoSum && noMoney && row.initialDue === '2026-09-10' && row.setDue === '2026-09-17' &&
       row.extensions === 1 && ruleRow && ruleRow.sumAttr === null && rows.length === ZD.state.tasks.length,
    `реквизит суммы объявлен у каждого вида повода (у подключённых пуст — денежного объекта нет), у задания ` +
    `сумм нет; строка статистике несёт первоначальный и установленный срок, число продлений и реквизит ` +
    `суммы вида, но не число`);
})();

/* ЗН-9 — вал как контейнер ключей */
(() => {
  ZD.seed();
  ZD.runPoll();
  const val = ZD.state.tasks.find(t => t.originKind === 'pk-rep-obligation-overdue' && t.rollupKeys);
  at('2026-09-08');
  ZD.runPoll();
  const prom = 't-overdue/2026-07-01/dep-prom';
  ok(69, ZD.keyStatus(val, prom) === 'отпал' && !ZD.isTerminal(val) && ZD.liveKeys(val).length === 2 &&
       !ZD.state.tasks.some(t => t.povodKey === prom),
    `08.09 dep-prom сдал форму — ключ помечен «отпал» в списке вала ${val.id}, вал открыт с двумя живыми ` +
    `ключами, поштучного задания на отпавший ключ нет`);
})();

(() => {
  ZD.seed();
  ZD.runPoll();
  const val = ZD.state.tasks.find(t => t.originKind === 'pk-org-head-vacant' && t.rollupKeys);
  const osh = val.rollupKeys.find(k => /Ошская/.test(k));
  at('2026-09-08');
  ZD.runPoll();
  const headTasks = () => ZD.state.tasks.filter(t => t.originKind === 'pk-org-head-vacant').length;
  const n = headTasks();
  ZD.runPoll();
  const single = ZD.state.tasks.filter(t => t.povodKey === osh);
  ok(70, ZD.keyStatus(val, osh) === 'вышел' && single.length === 1 && single[0].assignee === 'E3' &&
       single[0].repeatOf === null && ZD.liveKeys(val).length === 2 && !ZD.isTerminal(val) &&
       headTasks() === n,
    `08.09 куратор «Ошской области» сменился E1 → E3: ключ вышел из непринятого вала ${val.id} поштучным ` +
    `заданием ${single[0] && single[0].id} у нового ответственного (не «повтор»), вал открыт; повторный прогон дублей не дал`);
})();

(() => {
  ZD.seed();
  ZD.runPoll();
  const val = ZD.state.tasks.find(t => t.originKind === 'pk-rep-obligation-overdue' && t.rollupKeys);
  at('2026-09-10'); ZD.runPoll();
  const midOpen = !ZD.isTerminal(val);
  at('2026-09-15'); ZD.runPoll();
  const o = ZD.outcomeOf(val);
  ok(71, midOpen && o && o.outcome === 'исполнено' && val.rollupKeys.every(k => ZD.keyStatus(val, k) === 'отпал'),
    `вал закрыт, только когда живых ключей не осталось: 10.09 ещё открыт, 15.09 сдал последний — все три ` +
    `ключа отпали штатно, исход «исполнено»`);
})();

(() => {
  ZD.seed();
  ZD.runPoll();
  const val = ZD.state.tasks.find(t => t.originKind === 'pk-rep-obligation-overdue' && t.rollupKeys);
  const notExec = throws(() => ZD.splitRollup(val.id, 'E4'));
  const out = ZD.splitRollup(val.id, val.assignee);
  const keys = out.map(t => t.povodKey).sort().join('|');
  const tasksBefore = ZD.state.tasks.length;
  ZD.runPoll();
  ok(72, notExec && out.length === 3 && keys === val.rollupKeys.slice().sort().join('|') &&
       ZD.outcomeOf(val).outcome === 'снято' && out.every(t => t.repeatOf === null) &&
       out.map(t => t.assignee).sort().join(',') === ['E1','E3','E5'].join(',') && ZD.state.tasks.length === tasksBefore,
    `исполнитель разобрал вал на поштучные: три задания по формуле адресата (E1, E3 и запасной E5), вал ` +
    `«снято», «повтором» поштучные не считаются, повторный прогон дублей не дал; не исполнителю — отказ`);
})();

/* ЗН-10 — поглощение периодом */
(() => {
  ZD.seed();
  const clean = ZD.checkRegistry().length === 0;
  ZD.state.povodKinds.push({ id: 'pk-test-periodic', title: 'проверочный периодический', objectType: 'unit', traits: [],
    rollup: 2, sensitive: false, ownerDept: 'Сопровождение', createdAt: '2026-09-02', activatedAt: null,
    sumAttr: null, periodic: true, periodAbsorb: null });
  ZD.state.povodKinds.push({ id: 'pk-test-event', title: 'проверочный событийный', objectType: 'unit', traits: [],
    rollup: 2, sensitive: false, ownerDept: 'Сопровождение', createdAt: '2026-09-02', activatedAt: null,
    sumAttr: null, periodic: false, periodAbsorb: 'да' });
  const errs = ZD.checkRegistry();
  ok(73, clean && errs.some(e => /проверочный периодический.*поглощение/.test(e)) && errs.some(e => /проверочный событийный.*поглощение/.test(e)),
    `реестр видов повода сверяется: периодический вид обязан объявить «поглощение периодом», событийный — не ` +
    `объявлять; на штатном реестре расхождений нет`);
})();

(() => {
  ZD.seed();
  ZD.runPoll();
  at('2026-09-04');
  const r = ZD.runPoll();
  const rep = r.sources.find(s => s.name.indexOf('Отчётность') !== -1);
  const june = ZD.state.povods.filter(p => p.kind === 'pk-rep-obligation-overdue');
  at('2026-09-08');
  const r2 = ZD.runPoll();
  const rep2 = r2.sources.find(s => s.name.indexOf('Отчётность') !== -1);
  const live = june.filter(p => p.status !== 'gone').map(p => p.traits.подразделение);
  ok(74, rep.new === 0 && rep.gone === 0 && rep.matched === 3 && june.length === 3 &&
       june.every(p => p.traits.период === 'июнь 2026') && rep2.gone === 1 && live.length === 2,
    `ключи июньского периода живут, пока сосед их называет: 04.09 все три совпали (модуль не закрыл и не ` +
    `перенёс в новый период), 08.09 отпал ровно один — тот, что сосед перестал называть`);
})();

(() => {
  ZD.seed();
  const own = ZD.SELF_KINDS.slice(6).map(id => [ZD.kindOf(id).rollup, ZD.ruleForKind(id).dueN, ZD.ruleForKind(id).mode].join('/'));
  ZD.runPoll();
  const r2 = ZD.runPoll();
  ok(75, own.join(' · ') === '5/1/авто · 20/1/авто · 20/3/авто' && r2.sources[0].new === 0,
    `три новых собственных вида по таблице канона §4 (порог/срок/режим): ${own.join(' · ')}; на штатном ` +
    `прогоне 02.09 ложных поводов не дают — повтор той же датой: новых 0`);
})();

(() => {
  ZD.seed();
  ZD.runPoll();
  const bat = taskByKey(/Баткенская/);
  ZD.reassignTask(bat.id, 'E3', 'E4', 'Садыков на выезде');
  at('2026-09-04');
  ZD.runPoll();
  ok(76, bat.assignee === 'E3' && !bat.journal.some(e => e.ev === 'переадресовано') && ZD.lastEv(bat) === 'поручено',
    `переназначенное человеком задание смена закрепления не перекрывает: «Баткенская» осталась у E3, ` +
    `хотя 04.09 куратором стал E1 — переадресация системная и только для задания, адресованного формулой`);
})();

/* ---------- отчёт ---------- */
const pass = results.filter(r => r.pass).length;
const lines = results.map(r => `   ${r.pass ? 'PASS' : 'FAIL'}  #${r.n}  ${r.note}`);
console.log(`SMOKE ${new Date().toISOString().slice(0,10)} · ${pass}/${results.length} PASS\n` + lines.join('\n'));

process.exit(pass === results.length ? 0 : 1);
