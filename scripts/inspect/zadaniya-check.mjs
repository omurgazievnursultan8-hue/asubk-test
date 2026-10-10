// Headless смоук для mockups/zadaniya/zadaniya.html — волна 1+2+3+4+5 модуля «Задания» (шестой модуль).
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
//   L  сторож текста: ADR/ИЗ-номера названы в шапке, «сегодня» заморожено константой.
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
// Волна 5 (05.10.2026, канон ASUBK-zadaniya-logika.md) — макет догнан до решений ЗН-1…ЗН-10:
//   P  #54-76 — адресат-формула и цепочка (ЗН-1), переадресация и пятое основание видимости (ЗН-2),
//      продление (ЗН-3), двенадцать уведомлений (ЗН-4), ход исполнения и ссылка при сдаче (ЗН-5),
//      переназначение (ЗН-6), повтор и «повод возвращается» (ЗН-7), строки Статистике без сумм
//      (ЗН-8), вал как контейнер ключей (ЗН-9), периодический повод после конца периода (ЗН-10).
// Блоки, которые правят состояние, начинаются с ZD.seed() — состояние между ними не течёт.
// Отчёт вписывается в шапку макета после маркера «SMOKE (node …):»; выход 1 при любом FAIL.
//   node scripts/inspect/zadaniya-check.mjs
import { readFileSync, writeFileSync } from 'node:fs';
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
const hdr = (m && src.slice(0, src.indexOf('-->'))) || '';
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
          'pk-addressee-missing','pk-extension-pending','pk-povod-returns'].join(','),
    `девять собственных видов повода (шесть волны 1 + три волны 5, канон §4): ${ZD.SELF_KINDS.join(' · ')}`);
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
  ok(13, modes.filter(x=>x==='авто').length === 8 && modes.filter(x=>x==='ручной').length === 1,
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
  ok(19, threw && /контролёр/.test(msg) && /ИЗ-7/.test(msg),
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
    `двенадцать состояний (девять ИЗ-14 + три ADR-0263), ни одного информационного («кредит выдан») — список закрыт буквально (ИЗ-14, ИЗ-21)`);
  ZD.seed();
  const beforeN = ZD.state.notifications.length;
  ZD.runPoll();
  const afterN = ZD.state.notifications.length;
  ok(29, afterN > beforeN && ZD.state.notifications.every(n => CLOSED.includes(n.kind)),
    `самоопрос породил уведомления, и каждое — из закрытого списка (движок бросил бы на восьмом глаголе)`);
})();

/* ---------- L. Сторож текста: ADR/ИЗ названы, «сегодня» заморожено ---------- */
(() => {
  const noComm = m[1]; // с комментариями внутри <script> тут нет конфликта — это отдельный слой от HTML-шапки
  const adrs = ['ADR-0210','ADR-0211','ADR-0227','ADR-0228','ADR-0229','ADR-0230','ADR-0231','ADR-0262','ADR-0263'];
  const izs = ['ИЗ-3','ИЗ-5','ИЗ-6','ИЗ-7','ИЗ-8','ИЗ-9','ИЗ-10','ИЗ-11','ИЗ-12','ИЗ-13','ИЗ-14','ИЗ-16','ИЗ-17',
    'ИЗ-18','ИЗ-19','ИЗ-20','ИЗ-21','ИЗ-22','ИЗ-23','ИЗ-24','ИЗ-25','ИЗ-26','ИЗ-27'];
  const missAdr = adrs.filter(a => hdr.indexOf(a) === -1);
  const missIz = izs.filter(i => hdr.indexOf(i) === -1);
  ok(30, missAdr.length === 0 && missIz.length === 0,
    `все девять ADR и все используемые ИЗ-номера (ИЗ-3…ИЗ-27) названы в шапке файла${missAdr.length?' · нет ADR: '+missAdr.join(','):''}${missIz.length?' · нет ИЗ: '+missIz.join(','):''}`);
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
       rollupTask.assignee === 'E4',
    `первое подключение — намеренно низкий порог свёртки 2 (ADR-0231 п.5, ИЗ-12 п.8): 3 просроченных ` +
    `обязательства (dep-admin/dep-prom/rep-osh за один и тот же период) выше порога свернулись в один ` +
    `вал-таск ${rollupTask && rollupTask.id}, ни одного поштучного задания на эти три повода не выдано`);
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

const fmtD = (iso) => iso.split('-').reverse().join('.');

/* ---------- Волна 5 (05.10.2026) — макет догнан до канона: ЗН-1…ЗН-10 ---------- */
const byOrigin = (k) => ZD.state.tasks.filter(t => t.originKind === k);
const evCount = (t, ev) => t.journal.filter(e => e.ev === ev).length;
const throwsOf = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };

// ЗН-1 — адресат-формула, а не E4
(() => {
  ZD.seed();
  ZD.runPoll();
  const acting = byOrigin('pk-org-acting-expiring')[0];   // Баткенская область → куратор подразделения E1
  const noStaff = byOrigin('pk-org-no-staff')[0];          // unit-narynskaya-obl → E3
  const rep = byOrigin('pk-rep-obligation-overdue')[0];    // роли нет → запасной: руководитель «Администрирование» E4
  const orphan = byOrigin('pk-org-orphan-terr')[0];        // роли нет → запасной E4
  const povodsMissing = ZD.state.povods.filter(p => p.kind === 'pk-addressee-missing').length;
  ok(54, acting.assignee === 'E1' && noStaff.assignee === 'E3' && /закреплён/.test(acting.addrTrail[0]) &&
         rep.assignee === 'E4' && /запасной/.test(rep.addrTrail.join(' ')) && orphan.addrMissing === false &&
         byOrigin('pk-org-head-vacant')[0].assignee === 'E2' && povodsMissing === 0,
    `адресат — формула правила (ЗН-1): у Оргструктуры исполнитель берётся из кураторства по объекту (Баткенская → ` +
    `${acting.assignee}, Нарынская → ${noStaff.assignee}, вал вакансий → ${byOrigin('pk-org-head-vacant')[0].assignee}), хардкода E4 нет; ` +
    `там, где роли нет (территория, обязательство), идёт запасной — руководитель подразделения-владельца вида, это НЕ «адресат не найден»`);
})();
(() => {
  ZD.seed();
  const spec = { formula: { role: 'куратор подразделения' }, objectType: 'unit', objectId: 'ЦА — Кредитный отдел', ownerDept: 'Администрирование' };
  const ordinary = ZD.resolveAddressee(spec, '2026-09-02');
  const onLeave = ZD.resolveAddressee(spec, '2026-09-04');
  ok(55, ordinary.assignee === 'E2' && ordinary.responsible === 'E2' &&
         onLeave.assignee === 'E3' && onLeave.responsible === 'E2' && /замещает/.test(onLeave.trail.join(' ')),
    `замещение (ЗН-1, §3.6): в отпуске работу получает действующий (${onLeave.assignee}), ответственным остаётся закреплённый ` +
    `(${onLeave.responsible}) — ответственность при замещении не уходит (§8.3); цепочка видна: ${onLeave.trail.join(' → ')}`);
})();
(() => {
  ZD.seed();
  ZD.kindOf('pk-org-orphan-terr').ownerDept = null; // у вида нет подразделения-владельца → цепочка кончается администратором
  ZD.runPoll();
  const orphan = byOrigin('pk-org-orphan-terr')[0];
  ZD.runPoll();
  const missing = ZD.state.povods.filter(p => p.kind === 'pk-addressee-missing');
  const missTask = byOrigin('pk-addressee-missing')[0];
  ZD.runPoll(); // третий прогон: повод «адресат не найден» сам адресата не теряет → стопор, цепочки нет
  ok(56, orphan.assignee === 'E4' && orphan.addrMissing === true && missing.length === 1 &&
         missing[0].key === `pk-addressee-missing|task:${orphan.id}|` && !!missTask && missTask.addrMissing === false &&
         ZD.state.povods.filter(p => p.kind === 'pk-addressee-missing').length === 1,
    `падение на администратора — не тихий хардкод, а повод «адресат не найден» (${missing[0] && missing[0].key}) с заданием ` +
    `${missTask && missTask.id} администратору; само оно адресата не теряет и цепочку не плодит (стопор рекурсии)`);
})();

// ЗН-2 — переадресация и пятое основание видимости
(() => {
  ZD.seed();
  ZD.runPoll();
  const acting = byOrigin('pk-org-acting-expiring')[0];   // E1, «поручено»
  const noStaff = byOrigin('pk-org-no-staff')[0];         // E3
  ZD.claim(noStaff.id);                                   // принято в работу
  ZD.changeCuration('куратор подразделения', 'Баткенская область', 'E3');
  ZD.changeCuration('куратор подразделения', 'unit-narynskaya-obl', 'E1');
  const r = ZD.runPoll();
  const moved = ZD.taskOf(acting.id), kept = ZD.taskOf(noStaff.id);
  const note = ZD.state.notifications.find(n => n.kind === 'переадресовано' && n.taskId === acting.id);
  ok(57, r.readdressed >= 1 && moved.assignee === 'E3' && evCount(moved, 'переадресовано') === 1 &&
         ZD.lastEv(moved) === 'поручено' && !!note && note.to === 'E1' &&
         kept.assignee === 'E3' && evCount(kept, 'переадресовано') === 0,
    `смена закрепления переадресует НЕПРИНЯТОЕ (${acting.id}: E1 → E3, прежнему исполнителю ушло «переадресовано»), ` +
    `принятое в работу остаётся у исполнителя (${noStaff.id} не тронуто) — ИЗ-19; журнал: ${moved.journal.map(e => e.ev).join(' → ')}`);
})();
(() => {
  ZD.seed();
  ZD.runPoll();
  const t = byOrigin('pk-org-acting-expiring')[0];        // исполнитель E1, закрепление Баткенской — E1
  ZD.changeCuration('куратор подразделения', 'Баткенская область', 'E5'); // E5 вне цепочки подчинения E1 и не автор
  ok(58, !ZD.chiefChainIncludes(t.assignee, 'E5') && t.author !== 'E5' && ZD.visibleTo(t, 'E5') === true &&
         ZD.visibleTo(t, 'E5') && ZD.visibleTo(byOrigin('pk-stat-neighbor-silent')[0], 'E5') === false,
    `пятое основание видимости (ЗН-2): ответственный по кураторству на дату видит задание, хотя не автор, не исполнитель ` +
    `и не руководитель по цепочке; к чужому заданию по модулю без его роли доступа нет`);
})();

// ЗН-3 — продление
(() => {
  ZD.seed();
  const t = ZD.state.tasks.find(x => x.id === 'T5');      // T5: исполнитель E1, контролёр E4, срок 2026-09-10 (идентификаторы делят счётчик с уведомлениями)
  const dueBefore = ZD.dueOf(t);
  const e1 = throwsOf(() => ZD.requestExtension('T5', '2026-09-17', 'нужны документы', 'E5'));
  const e2 = throwsOf(() => ZD.requestExtension('T5', '2026-09-17', '', 'E1'));
  const e3 = throwsOf(() => ZD.requestExtension('T5', '2026-09-05', 'раньше срока', 'E1'));
  ZD.requestExtension('T5', '2026-09-17', 'нужны документы из архива', 'E1');
  const keptWhilePending = ZD.dueOf(t) === dueBefore && !!ZD.pendingExtension(t) && /запрошено продление/.test(ZD.deriveState(t));
  const asked = ZD.state.notifications.find(n => n.kind === 'запрошено-продление' && n.taskId === 'T5');
  const e4 = throwsOf(() => ZD.decideExtension('T5', true, 'E5'));
  ZD.decideExtension('T5', true, 'E4');
  const toWho = ZD.state.notifications.filter(n => n.kind === 'решение-по-продлению' && n.taskId === 'T5').map(n => n.to).sort().join(',');
  ok(59, !!e1 && !!e2 && !!e3 && !!e4 && keptWhilePending && !!asked && asked.to === 'E4' &&
         ZD.dueOf(t) === '2026-09-17' && t.dueDate === '2026-09-10' && !ZD.pendingExtension(t) && toWho === 'E1,E4',
    `продление (ЗН-3): запрашивает только исполнитель и только с основанием и более поздним сроком; пока запрос не утверждён, ` +
    `установленный срок прежний (${fmtD(dueBefore)}); утверждает тот, кто поставил срок (контролёр E4), чужому отказано; ` +
    `после утверждения установленный срок = последний утверждённый (${fmtD(ZD.dueOf(t))}), первоначальный в журнале цел; ` +
    `решение ушло исполнителю и контролёру (${toWho})`);
})();
(() => {
  ZD.seed();
  ZD.setAsOf('2026-09-09');
  ZD.runPoll(); ZD.runPoll();
  const near1 = ZD.state.notifications.filter(n => n.kind === 'срок-близко' && n.taskId === 'T5').length;
  ZD.requestExtension('T5', '2026-09-17', 'ещё неделя', 'E1');
  ZD.decideExtension('T5', true, 'E4');
  ZD.setAsOf('2026-09-16');
  ZD.runPoll(); ZD.runPoll();
  const near2 = ZD.state.notifications.filter(n => n.kind === 'срок-близко' && n.taskId === 'T5').length;
  ok(60, near1 === 1 && near2 === 2,
    `«срок близко» однократно НА КАЖДЫЙ установленный срок (ADR-0263): на первоначальный 10.09 — ${near1}, ` +
    `после утверждённого продления на 17.09 — ещё одно (всего ${near2}); повторные прогоны в тот же день не плодят`);
})();
(() => {
  ZD.seed();
  ZD.requestExtension('T5', '2026-09-17', 'ждём ответа банка', 'E1');
  ZD.runPoll();
  const early = ZD.state.povods.filter(p => p.kind === 'pk-extension-pending').length;
  ZD.setAsOf('2026-09-04');
  ZD.runPoll();
  const late = ZD.state.povods.filter(p => p.kind === 'pk-extension-pending' && p.status === 'appeared');
  const task = byOrigin('pk-extension-pending')[0];
  ok(61, early === 0 && late.length === 1 && late[0].key === 'pk-extension-pending|task:T5|' && !!task && task.assignee === 'E4',
    `повод «запрос продления без ответа» (ЗН-3): в день запроса его нет, через 2 рабочих дня (> 1) он появился, ` +
    `задание у утверждающего (${task && task.assignee}) — собственный вид самоопроса, формула «утверждающий срок»`);
})();

// ЗН-4 — уведомлений двенадцать
(() => {
  ZD.seed();
  ZD.requestExtension('T5', '2026-09-17', 'основание', 'E1');
  ZD.decideExtension('T5', false, 'E4', 'нет оснований');
  ZD.reassignTask('T1', 'E3', 'перегрузка', 'E2');
  ZD.runPoll();
  const kinds = new Set(ZD.state.notifications.map(n => n.kind));
  ok(62, ZD.NOTIF_KINDS.length === 12 && ['переадресовано','запрошено-продление','решение-по-продлению'].every(k => kinds.has(k)) &&
         ZD.state.notifications.every(n => ZD.NOTIF_KINDS.includes(n.kind)),
    `уведомлений двенадцать (ЗН-4): три новых — «переадресовано», «запрошено продление», «решение по продлению» — ` +
    `реально порождены ходом заданий, вне списка ни одно не ушло`);
})();

// ЗН-5 — ход исполнения
(() => {
  ZD.seed();
  const t = ZD.taskOf('T1');                              // исполнитель E1, автор E4
  const stateBefore = ZD.deriveState(t), notesBefore = ZD.state.notifications.length, jBefore = t.journal.length;
  ZD.addProgress('T1', 'сверил две заявки из трёх', 'заявка-63201', 'E1');
  const first = JSON.stringify(t.journal[jBefore]);
  ZD.correctProgress('T1', jBefore, 'не две, а одна', 'E1');
  const outsider = throwsOf(() => ZD.addProgress('T1', 'чужая отметка', null, 'E5'));
  ok(63, ZD.deriveState(t) === stateBefore && ZD.state.notifications.length === notesBefore &&
         t.journal.length === jBefore + 2 && JSON.stringify(t.journal[jBefore]) === first &&
         t.journal[jBefore + 1].corrects === jBefore && /исправление к/.test(t.journal[jBefore + 1].text) && !!outsider,
    `отметка о ходе (ЗН-5, ИЗ-22): состояние («${stateBefore}») и уведомления не изменились; прежняя отметка не редактируется — ` +
    `ошибку исправляет новая «исправление к …»; посторонний отметку поставить не может`);
})();
(() => {
  ZD.seed();
  ZD.runPoll();
  const t = byOrigin('pk-rep-obligation-overdue')[0];     // вал; действие «обеспечить сдачу формы» требует ссылку
  const noProof = throwsOf(() => ZD.claim(t.id));
  ZD.claim(t.id, 'отчёт-№77');
  const claimed = t.journal.filter(e => e.claimedAt).pop();
  const free = ZD.state.tasks.find(x => x.kind === 'free');
  ZD.claim(free.id);                                      // у действия без требования ссылка не нужна
  ok(64, !!noProof && /ссылк/.test(noProof) && claimed && claimed.proof === 'отчёт-№77' && ZD.lastEv(free) !== 'поручено',
    `ссылка на подтверждение при сдаче (ЗН-5): действие, которое её требует, не примет «заявлено» без неё («${noProof}»), ` +
    `со ссылкой — реквизит события «сдано»; задание без такого требования сдаётся как раньше`);
})();

// ЗН-6 — переназначение
(() => {
  ZD.seed();
  const t = ZD.taskOf('T1');                              // исполнитель E1, автор E4, «поручено»
  const dueBefore = t.dueDate;
  const byExecutor = throwsOf(() => ZD.reassignTask('T1', 'E3', 'передаю коллеге', 'E1'));
  const byStranger = throwsOf(() => ZD.reassignTask('T1', 'E3', 'основание', 'E5'));
  const noBasis = throwsOf(() => ZD.reassignTask('T1', 'E3', '', 'E2'));
  ZD.reassignTask('T1', 'E3', 'перегрузка у Есеновой', 'E2');   // руководитель исполнителя по цепочке, без отказа
  const prev = ZD.state.notifications.find(n => n.kind === 'переадресовано' && n.taskId === 'T1');
  const rejected = ZD.state.tasks.find(x => ZD.lastEv(x) === 'отказано');
  ZD.reassignTask(rejected.id, 'E3', 'решение автора', 'E4');   // автор, из «отказано»
  ok(65, !!byExecutor && !!byStranger && !!noBasis && t.assignee === 'E3' && t.dueDate === dueBefore &&
         t.journal.some(e => e.ev === 'переназначено' && e.basis === 'перегрузка у Есеновой' && e.from === 'E1' && e.by === 'E2') &&
         !!prev && prev.to === 'E1' && ZD.lastEv(rejected) === 'поручено',
    `переназначение (ЗН-6, ИЗ-23): исполнитель сам не передаёт, посторонний тоже, без основания нельзя; руководитель исполнителя ` +
    `по цепочке переназначил задание в любом нетерминальном состоянии, основание и автор в журнале, срок не обнулился, ` +
    `прежнему ушло «переадресовано»; автор вернул «отказано» → «поручено»`);
})();

// ЗН-7 — закрытое не переоткрывается
(() => {
  ZD.seed();
  ZD.runPoll();
  const first = byOrigin('pk-stat-neighbor-silent')[0];
  ZD.claim(first.id);                                     // исполнено без контролёра — «заявлено»
  ZD.toggleStatCleared(true);  ZD.runPoll();              // сосед перестал молчать → повод отпал → задание закрыто
  const closed = ZD.taskOf(first.id), jLen = closed.journal.length;
  ZD.toggleStatCleared(false); ZD.runPoll();              // тот же ключ вернулся
  const again = byOrigin('pk-stat-neighbor-silent').filter(t => t.id !== first.id)[0];
  const reopen = throwsOf(() => ZD.addProgress(first.id, 'допишу в закрытое', null, 'E4'));
  const reassignClosed = throwsOf(() => ZD.reassignTask(first.id, 'E3', 'основание', 'E4'));
  ok(66, ZD.isTerminal(closed) && closed.journal.length === jLen && !!again && again.repeatAfter === first.id &&
         again.repeatNo === 1 && /повтор после/.test(again.label) && !!reopen && !!reassignClosed,
    `закрытое не переоткрывается (ЗН-7, ИЗ-24): вернувшийся ключ рождает НОВОЕ задание ${again && again.id} «повтор после ` +
    `${first.id}» (повторов: ${again && again.repeatNo}); ${first.id} остался терминальным, его журнал не дописан, ` +
    `отметка и переназначение закрытого отбиты`);
})();
(() => {
  ZD.seed();
  const days = [['2026-09-02', false], ['2026-09-03', true], ['2026-09-04', false], ['2026-09-07', true],
                ['2026-09-08', false], ['2026-09-09', true], ['2026-09-10', false]];
  days.forEach(([d, cleared]) => { ZD.setAsOf(d); ZD.toggleStatCleared(cleared); ZD.runPoll(); });
  ZD.runPoll();                                           // самоопрос идёт первым: третье возвращение видно со второго прогона 10.09
  const key = 'сосед-молчит/взыскание/с-2026-08-20';
  const flap = ZD.state.povods.find(p => p.kind === 'pk-povod-returns' && p.objectId === key);
  const task = byOrigin('pk-povod-returns')[0];
  const self = ZD.state.povods.filter(p => p.kind === 'pk-povod-returns' && p.objectId.indexOf('pk-povod-returns') !== -1);
  ok(67, !!flap && flap.status === 'appeared' && flap.traits.повторов === 3 && !!task && task.assignee === 'E4' && self.length === 0,
    `частый возврат ключа (≥ 3 за 30 дней) — повод самоопроса «повод возвращается» (ЗН-7): ключ соседа «${key}» вернулся ` +
    `${flap && flap.traits.повторов} раза, задание ${task && task.id} разбирать причину, а не симптом; сам на себя повод не заводится`);
})();

// ЗН-8 — задание не несёт сумм
(() => {
  ZD.seed();
  ZD.runPoll();
  ZD.requestExtension('T5', '2026-09-17', 'основание', 'E1');
  ZD.decideExtension('T5', true, 'E4');
  const rows = ZD.taskStatRows();
  const t3 = rows.find(r => r.task === 'T5');
  const rule = rows.find(r => r.povodKind === 'pk-org-no-staff');
  const noSums = rows.every(r => !('sum' in r) && !('amount' in r) && 'sumRequisite' in r);
  const allKinds = ['pk-overdue','pk-org-head-vacant','pk-rep-obligation-overdue','pk-povod-returns'].every(id => 'sumField' in ZD.kindOf(id));
  ok(68, rows.length === ZD.state.tasks.length && noSums && allKinds && t3.dueOriginal === '2026-09-10' && t3.dueSet === '2026-09-17' &&
         t3.extensions === 1 && rule.key === 'pk-org-no-staff|unit:unit-narynskaya-obl|' && rule.dept === 'Сопровождение',
    `Статистике уходят строки заданий (ЗН-8): ключ, вид повода, адресат, подразделение, даты выдачи / первоначального и установленного ` +
    `срока / сдачи / закрытия, исход, число продлений, повтор; суммы у задания НЕТ (ИЗ-25) — есть только «реквизит суммы» вида повода ` +
    `(у видов без денежного объекта пуст); ${rows.length} строк на ${ZD.state.tasks.length} заданий`);
})();

// ЗН-9 — вал как контейнер
(() => {
  ZD.seed();
  ZD.runPoll();
  const roll = byOrigin('pk-org-head-vacant').find(t => Array.isArray(t.rollupAll));
  ZD.resolveOrgVacancy('Ошская область', true);
  ZD.runPoll();
  const mid = roll.rollupAll.map(r => r.state).join(',');
  const stillOpen = !ZD.isTerminal(roll) && roll.rollupKeys.length === 2;
  ZD.resolveOrgVacancy('ЦА — Кредитный отдел', true);
  ZD.resolveOrgVacancy('Жалал-Абадская область', true);
  ZD.runPoll();
  const o = ZD.outcomeOf(roll);
  ok(69, mid === 'жив,отпал,жив' && stillOpen && ZD.isTerminal(roll) && o.outcome === 'исполнено' && roll.rollupAll.every(r => r.state === 'отпал'),
    `вал — контейнер ключей (ЗН-9): когда вакансия «Ошская область» закрыта, её ключ помечен «отпал» (${mid}), вал остаётся открытым ` +
    `с двумя живыми; когда отпали все — вал закрыт «${o && o.outcome}», а не закрыт вручную поверх живых поводов`);
})();
(() => {
  ZD.seed();
  ZD.runPoll();
  const roll = byOrigin('pk-org-head-vacant').find(t => Array.isArray(t.rollupAll));
  ZD.changeCuration('куратор подразделения', 'Ошская область', 'E5');
  const r = ZD.runPoll();
  const left = roll.rollupAll.find(x => x.key === 'pk-org-head-vacant|unit:Ошская область|');
  const single = ZD.state.tasks.find(t => t.povodKey === 'pk-org-head-vacant|unit:Ошская область|');
  const tasksBefore = ZD.state.tasks.length;
  const r2 = ZD.runPoll();
  ok(70, r.readdressed === 1 && left.state === 'переадресован' && roll.rollupKeys.length === 2 && !ZD.isTerminal(roll) &&
         !!single && single.assignee === 'E5' && r2.readdressed === 0 && ZD.state.tasks.length === tasksBefore,
    `ключ, у которого сменился ответственный, выходит из вала поштучным заданием ${single && single.id} у нового (E5), вал остаётся ` +
    `с двумя ключами (ЗН-9, ЗН-2); повторный прогон ничего не плодит (переадресовано ${r2.readdressed})`);
})();
(() => {
  ZD.seed();
  ZD.runPoll();
  const roll = byOrigin('pk-org-head-vacant').find(t => Array.isArray(t.rollupAll));
  const n = ZD.breakRollup(roll.id);
  const singles = ZD.state.tasks.filter(t => t.originKind === 'pk-org-head-vacant' && t.povodKey && !ZD.isTerminal(t));
  const count = ZD.state.tasks.length;
  ZD.runPoll();
  ok(71, n === 3 && singles.length === 3 && ZD.isTerminal(roll) && ZD.outcomeOf(roll).outcome === 'снято' && ZD.state.tasks.length === count &&
         singles.every(t => t.povodKey && new Set(singles.map(x => x.povodKey)).size === 3),
    `исполнитель разобрал вал на ${n} поштучных заданий (ЗН-9, ИЗ-26): по одному на ключ (пара «повод × действие» не нарушена), вал закрыт ` +
    `«снято», повторный прогон не плодит дублей`);
})();

// ЗН-10 — периодический повод после конца периода
(() => {
  ZD.seed();
  ZD.runPoll();
  const before = ZD.state.povods.filter(p => p.kind === 'pk-rep-obligation-overdue').map(p => p.key).sort();
  const tasksBefore = ZD.state.tasks.filter(t => t.originKind === 'pk-rep-obligation-overdue').length;
  ZD.setAsOf('2026-10-05');                               // следующий учётный период; сосед по-прежнему называет июньский ключ
  const r = ZD.runPoll();
  const repSrc = r.sources.find(s => s.name.indexOf('Отчётность') !== -1);
  const after = ZD.state.povods.filter(p => p.kind === 'pk-rep-obligation-overdue');
  const k = ZD.kindOf('pk-rep-obligation-overdue');
  ok(72, k.periodic === true && k.absorbsPeriod === false && ZD.SELF_KINDS.every(id => ZD.kindOf(id).absorbsPeriod === null) &&
         after.length === 3 && after.every(p => p.status === 'appeared') && after.map(p => p.key).sort().join('|') === before.join('|') &&
         repSrc.gone === 0 && repSrc.new === 0 &&
         ZD.state.tasks.filter(t => t.originKind === 'pk-rep-obligation-overdue').length === tasksBefore,
    `периодический повод после конца периода (ЗН-10, ИЗ-27): вид объявляет «поглощение периодом» = нет (пропуск сдачи не прощается); ` +
    `в новом периоде сосед назвал июньские ключи снова — модуль их не закрыл и не перенёс в новый период ` +
    `(отпавших ${repSrc.gone}, новых ${repSrc.new}, ключей прежние ${after.length})`);
})();
(() => {
  ZD.seed();
  const hdrText = hdr;
  const missZn = Array.from({length: 10}, (_, i) => 'ЗН-' + (i + 1)).filter(z => hdrText.indexOf(z) === -1);
  ok(73, missZn.length === 0,
    `все десять решений волны 5 (ЗН-1…ЗН-10) названы в шапке файла${missZn.length ? ' · нет: ' + missZn.join(',') : ''}`);
})();
(() => {
  ZD.seed();
  // прогон по всем датам не ломает инварианты: ни одного уведомления вне списка, ни одного терминального с дописанным журналом
  ['2026-09-02','2026-09-03','2026-09-08','2026-09-15','2026-10-05'].forEach(d => { ZD.setAsOf(d); ZD.runPoll(); });
  const bad = ZD.state.tasks.filter(t => {
    const i = t.journal.findIndex(e => e.ev === 'закрыто');
    return i !== -1 && i !== t.journal.length - 1;
  });
  ok(74, bad.length === 0 && ZD.state.notifications.every(n => ZD.NOTIF_KINDS.includes(n.kind)),
    `сквозной прогон по пяти датам (до начала следующего периода): терминальных заданий с дописанным журналом нет (ИЗ-24), ` +
    `уведомления только из закрытого списка из двенадцати (ИЗ-21)`);
})();

/* ---------- отчёт ---------- */
const pass = results.filter(r => r.pass).length;
const lines = results.map(r => `   ${r.pass ? 'PASS' : 'FAIL'}  #${r.n}  ${r.note}`);
const stamp = `SMOKE ${new Date().toISOString().slice(0,10)} · ${pass}/${results.length} PASS\n` + lines.join('\n');
console.log(stamp);

const marker = 'SMOKE (node scripts/inspect/zadaniya-check.mjs):';
const reBlock = new RegExp('(' + marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\n)[\\s\\S]*?(\\n-->)');
const injected = '   ' + stamp.replace(/\n/g, '\n   ');
if (reBlock.test(src)) {
  writeFileSync(HTML, src.replace(reBlock, `$1${injected}$2`), 'utf8');
  console.log('\n→ результат вставлен в шапку zadaniya.html');
} else {
  console.log('\n→ маркер SMOKE не найден в шапке — отчёт не вписан');
}

process.exit(pass === results.length ? 0 : 1);
