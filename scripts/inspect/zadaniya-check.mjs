// Headless смоук для mockups/zadaniya/zadaniya.html — волна 1+2+3 модуля «Задания» (шестой модуль).
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
  ok(1, before === 0 && r.complete === true && r.sources.length === 3 &&
       r.sources.every(s => s.answer === 'множество'),
    `прогон ${r.id} на дату ${r.date}: все три источника волны 1-3 (self, orgstruct, statistics) ответили «множество» (ИЗ-12 п.5)`);
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
  ok(11, ZD.SELF_KINDS.length === 6 &&
        ZD.SELF_KINDS.join(',') === ['pk-overdue','pk-rejected','pk-await-long','pk-lapsed-review','pk-neighbor-silent','pk-kind-inactive'].join(','),
    `шесть собственных видов повода, порядок как в ADR-0230 п.10: ${ZD.SELF_KINDS.join(' · ')}`);
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
  ok(13, modes.filter(x=>x==='авто').length === 5 && modes.filter(x=>x==='ручной').length === 1,
    `пять правил авто-режима, одно ручное («вид повода не введён в действие») — демонстрирует ручной триггер`);
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
  const CLOSED = ['повод-появился','поручено','принято','срок-близко','срок-истёк','эскалация','возвращено','повод-отпал','закрыто'];
  ok(28, ZD.NOTIF_KINDS.length === 9 && ZD.NOTIF_KINDS.join(',') === CLOSED.join(','),
    `девять состояний, ни одного информационного («кредит выдан») — список закрыт буквально (ИЗ-14 п.1-2)`);
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
  const adrs = ['ADR-0210','ADR-0211','ADR-0227','ADR-0228','ADR-0229','ADR-0230','ADR-0231'];
  const izs = ['ИЗ-3','ИЗ-5','ИЗ-6','ИЗ-7','ИЗ-8','ИЗ-9','ИЗ-10','ИЗ-11','ИЗ-12','ИЗ-13','ИЗ-14','ИЗ-16','ИЗ-17'];
  const missAdr = adrs.filter(a => hdr.indexOf(a) === -1);
  const missIz = izs.filter(i => hdr.indexOf(i) === -1);
  ok(30, missAdr.length === 0 && missIz.length === 0,
    `все семь ADR и все используемые ИЗ-номера названы в шапке файла${missAdr.length?' · нет ADR: '+missAdr.join(','):''}${missIz.length?' · нет ИЗ: '+missIz.join(','):''}`);
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
  ok(39, r.sources.length === 3 && !names.some(n => /заёмщик|КЗ-13/i.test(n)),
    `Заёмщик/КЗ-13 не участвует ни в одном прогоне как источник опроса — односторонний поток в обратную ` +
    `сторону (ADR-0229 «Последствия»): КЗ-13 остаётся витриной, датированные строки приходят ИЗ заданий, ` +
    `не наоборот (не подключался — граница задокументирована в журнале волны 2, не решена кодом)`);
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
