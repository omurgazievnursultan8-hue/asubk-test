// Headless смоук для mockups/zadaniya/zadaniya.html — волны 1–4 выпуска и 6–13 макета модуля «Задания» (шестой модуль).
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
// Решения гриллинга ЗН-11…ЗН-25 (канон §14), волна 7 макета 10.10.2026:
//   Q  #77-89 — «Взять в работу» и защита от переадресации, возврат заявленного на полном прогоне
//      следующего дня, две оси при контролёре правила, «Снять» без переиздания, «возвращено»
//      нетерминально, просрочка одним сигналом, порог молчания во времени у источника, замещение
//      после выдачи, свёртка по паре «вид × адресат», производственный календарь, порог 10.
//   Поменялись по канону: #15/#58/#64/#65 (сдача — после «Взять в работу»), #18 («Снять» — автор с
//   основанием), #34/#46-52/#69-74 (порог 10 по паре: вал «Отчётности» — 11 ключей у одного куратора).
// Подключение Госрешения (ЗГ-1…ЗГ-11) и кредитной программы (ЗКП-1…ЗКП-12), волна 8 макета 11.10.2026:
//   R  #90-107 — два источника записями реестра, очередь роли «Согласующий» и «Взять в работу» как
//      закрепление, названный автор без принятия, четыре глаза, исполнение у владельца (нет «сдано» и
//      «Снять», отпадение с атрибуцией), «повтор после» на админ-возврате, «закрыто, а программы живы»
//      без каскада, «действует без документа», сроки и порог — значения правила «внутренний акт»,
//      неразобранная очередь (ЗН-19), «истекает → истёк», «Продлить срок», бессрочные, «Сменить
//      основание», два задания на одну программу, «чей повод» в строке статистике (ЗН-21).
//   Поменялись по канону: #1/#39/#53 (шесть источников), #84 (у пятиминутных порог молчания 30),
//   #88 (шестнадцать видов соседей).
// Подключение заявки (ЗЗ-1…ЗЗ-14), волна 9 макета 11.10.2026:
//   S  #108-123 — седьмой источник записями реестра: девять шагов на передачах работы и три повода по данным,
//      адресат специалиста — формула кураторства «специалист заявки» (переадресация, замещение, запасной), очереди
//      ГФ / отдела / «Комиссия», голос и решение — названные записью комиссии; реквизит вида «адресат эскалации»:
//      голос — «лично», срок записи комиссии, просрочка председателю уведомлением, без эскалации и переназначения;
//      истёк «Дополнить» (1 к.м.) — сразу задание очереди «Комиссия» «Отклонить за неустранение недостатков»;
//      «Сменить программу» и гейт «Сформировать кредит»; отпадение с атрибуцией при отзыве/удалении/отклонении;
//      возврат комиссией — «повтор после»; пометка «по своей заявке»; ключ «вид · заявка:id» (+ отдел / член).
//   Поменялись по канону: #1/#39/#53 (семь источников), #84 (три пятиминутных источника), #88 (двадцать восемь
//   видов соседей); #30 ловит и ЗЗ-*; #56 сужен до задания ночного соседа (пятиминутные источники сверяются до
//   ночного самоопроса, их «адресат не найден» — в том же прогоне). Проверка сроков — в конце прогона.
// Подключение документооборота (канон документооборота §10.1, ADR-0271), волна 10 макета 11.10.2026:
//   T  #124-144 — восьмой источник записями трёх реестров: одиннадцать шагов документа, опрос 5 мин, порог молчания
//      объявлен 30 мин; названный поводом без «Взять в работу» (согласующий, подписант «лично», получатель, исполнитель
//      и соисполнитель резолюции, контролёр, получивший оригинал), очереди «Регистратор» и «Архивариус» с неразобранной
//      очередью (заведующая канцелярией → администратор документооборота); ключ «документ × участник», «резолюция ×
//      исполнитель», «резолюция», «выдача»; круг согласования: отказ — шаг исполнен, чужие сняты «круг сброшен», второй
//      круг — «повтор после»; аннулирование и удаление — «снято» с причиной документа; срок резолюции — собственный срок
//      повода, продление в заданиях утверждает автор резолюции, каскад читает действующий срок у заданий; «требует ответа»
//      гаснет отправкой ответа, соисполнитель — «снято»; контроль — отдельный шаг, возврат — «повтор после»; подпись
//      «лично» — замещающего с правом подписи подставляет документ; пачка на подпись — один вал, подпись по документу,
//      ключ вала несёт свой исход; ответ гасит все открытые резолюции, исход выше снимает нижние (как макет документооборота).
//   Поменялись по канону: #1/#39/#53/#108 (восемь источников), #84 (четыре пятиминутных источника), #88 (тридцать девять
//   видов соседей), #106/#118 (виды «документ» есть — над документом, резолюцией и выдачей, не над карточками соседей).
// Подключение имущества (канон имущества §9, §10.1; ЗН-1, ADR-0262), волна 11 макета 11.10.2026:
//   U  #145-164 — девятый источник записями трёх реестров: десять видов pk-im-* (восемь исходных, «ждёт акта» и «требование
//      к отчуждателю»), ночной опрос, порог молчания по умолчанию; адресат — формула «куратор имущества» по предложению или
//      объекту (у договора КП — по объекту), ответ кураторства «держит заведующий отделом», замещение, переадресация
//      непринятого; пороги появления — настройки модуля имущества, в заданиях только срок «внутренний акт»; ключ «вид · объект»,
//      период — только у просрочки рассрочки (платёж по графику); работу закрывает опубликованный факт (второй ключ), не
//      черновик; исход с атрибуцией: «выполнил другой» у бухгалтера, «снято» при отзыве источником и окончании обременения;
//      свёртка «осмотр просрочен» по паре «вид × адресат», вал со сводкой; повтор после несостоявшейся попытки; реквизит суммы.
//   Поменялись по канону: #1/#39/#53/#108/#124 (девять источников), #88 (сорок девять видов соседей).
// Подключение анализа (ЗА-1…ЗА-15, ADR-0276; канон анализа §8), волна 12 макета 11.10.2026:
//   V  #165-183 — десятый источник записями трёх реестров: «обзор требует решения, поручений нет» (ключ «вид · обзор», адресат —
//      руководитель подразделения «кому направлен», 5 р.д. от утверждения; гасит первое поручение с атрибуцией «кто поручил», адресат
//      вправе закрыть «решение без поручений» с основанием — ключ не переиздаётся; замена — «снято: обзор заменён», поручения по
//      заменённому заменяющему не в счёт) и «обзора за период нет» (периодический, поглощения нет; ключ «вид · шаблон · период»;
//      гасит только обзор по всему портфелю; заведующему отделом анализа; срок — поле шаблона от дня закрытия, пусто — 20 р.д.;
//      редакция периодичности на конец периода; эскалация общая); свободное задание с основанием и шов «задания по основанию»;
//      поручение по обзору — куратор объекта подставлен, контролёр — автор; «требует внимания» повода не даёт; суммы нет.
//   Поменялись по канону: #1/#39/#53/#108/#124/#145 (десять источников), #88 (пятьдесят один вид соседей); #30 ловит и ЗА-*, ИА-*.
// Настройка реестров (ЗНС-1…ЗНС-14, ADR-0290; канон §1.2–§1.5), волна 13 макета 13.10.2026:
//   W  #184-198 — правит только администратор заданий с основанием; редакция правила хранит значения, дату начала (сегодня или
//      будущая) и основание, ожидающая одна; выданное держит снимок (разбор вала); автор — должность, держатель на дату, вакантна —
//      администратор; контролёр и важность — редакцией; свёртка — поле правила; род вида (9/24/27), ручной и рубильник — у надзора;
//      «решить по поводам» автору, перевод в авто; порог появления — у соседа; блок «Откуда задание»; один вид — одно правило;
//      выпуск правит свои поля новой редакцией; «вид не введён» — авто.
//   Поменялись по канону: #12/#13, #22/#23 (ручной — «решить» у надзора), #25-#27 (рубильник надзора), #34/#75/#86/#88/#181 (свёртка
//   в правиле), #97/#119/#161 (правка — редакцией администратора, порогов в правиле нет).
// Входящие от дашборда (ЗДБ-1…ЗДБ-16, ADR-0291; канон §7, §8.2), волна 14 макета 14.10.2026:
//   X  #199-211 — у отчётности вид «срок сдачи близко или прошёл» (надзор, работа у владельца): порог «близко» — настройка
//      отчётности (7 к.д.); адресат — очередь роли «Отчётность» подразделения, за которым обязательство; срок — за N к.д. до
//      срока сдачи, прошедший к выдаче — 1 р.д.; в день срока задание то же, просрочка — общим механизмом (руководителю роли
//      сразу, взявшему — его руководителю на 5-й р.д.); выпуск закрывает с атрибуцией, снятие формы — «снято»; старый вид
//      «срок истёк» выведен выпуском 06.10 — открытые «снято: вид выведен выпуском», рубильник его не возвращает; «Мои» —
//      нетерминальные, где я исполнитель или действую за него, закрытые отдельно, меню — то же число; плитка «мои · просрочено
//      · в очередях» по строкам дня сходится с очередью у 11 человек на 5 дат; строка — одна на задание на дату, состав и
//      состояние на дату, охват — исполнитель, у очереди — роль; обязательство не основание свободного поручения.
//   Поменялись по канону: #88 (пятьдесят два вида соседей), #190 (61 вид, надзор 28); #30 ловит и ЗДБ-*, ЗНС-*.
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
  ok(1, before === 0 && r.complete === true && r.sources.length === 10 &&
       r.sources.every(s => s.answer === 'множество'),
    `прогон ${r.id} на дату ${r.date}: все десять источников (self, orgstruct, statistics, reports, gosresh, programs, apps, docs, assets, analysis) ответили «множество» (ИЗ-12 п.5)`);
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
    return k && k.objectType && Array.isArray(k.traits) && k.genus === 'самоопрос' && !('rollup' in k) && 'sensitive' in k;
  });
  const actionsOk = ZD.SELF_KINDS.every(id => ZD.actionOf(ZD.ruleForKind(id).action));
  const rulesOk = ZD.SELF_KINDS.every(id => {
    const r = ZD.ruleForKind(id);
    return r && r.mode === 'авто' && r.author === 'post-admin' && typeof r.rollup === 'number' && Array.isArray(r.editions) &&
      r.editions.length === 1 && r.editions[0].by === 'выпуск 1' && r.editions[0].values.dueN === r.dueN;
  });
  ok(12, kindsOk && actionsOk && rulesOk,
    `три реестра держат разные вещи: вид повода — владелец/объект/признаки/род/чувствительность, действие — формулировку и важность, ` +
    `правило — режим/автора-должность/срок/свёртку и редакции со значениями; порога свёртки у вида больше нет`);
  const modes = ZD.SELF_KINDS.map(id => ZD.ruleForKind(id).mode);
  ok(13, modes.every(x => x === 'авто') && ZD.ruleForKind('pk-kind-inactive').mode === 'авто' &&
        ZD.state.rules.every(r => r.mode === 'авто'),
    `все девять правил самоопроса — авто, «вид не введён в действие» тоже: ручной режим бывает только у надзора; ` +
    `на старте ни одно правило не ручное`);
})();

/* ---------- E. Журнал append-only, состояние выводится, не хранится полем ---------- */
(() => {
  ZD.seed();
  const t = ZD.state.tasks[0];
  const jLenBefore = t.journal.length;
  ok(14, !('state' in t) && !('status' in t),
    `у задания нет поля-состояния — состояние читается функцией по последней записи журнала (ADR-0136 §5)`);
  ZD.take(t.id);
  ok(15, t.journal.length === jLenBefore + 1 && t.journal[jLenBefore].ev === 'принято',
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
  ZD.releaseTask(rejected.id, rejected.author, 'решение автора — демо');
  const o = ZD.outcomeOf(rejected);
  ok(18, o && o.outcome === 'снято' && ZD.isTerminal(rejected),
    `«снято» — исход по решению автора, с основанием (после отказа — частный случай: снимать можно из любого нетерминального)`);
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
  ZD.editRule('rule-org-head-vacant', { mode: 'ручной' }, { by: 'E4', basis: 'приказ №12' });
  ZD.runPoll();
  const dec = ZD.state.tasks.filter(t => t.decide);
  const heads = ZD.state.tasks.filter(t => t.originKind === 'pk-org-head-vacant' && !t.decide);
  ok(22, dec.length === 1 && dec[0].assignee === 'E16' && dec[0].author === 'E16' && dec[0].rollupKeys.length === 3 &&
       heads.length === 0 && dec[0].dueDate === ZD.addWorkdays('2026-09-02', 2) && ZD.lastEv(dec[0]) === 'принято',
    `второй род — правило надзора в ручном режиме: прогон выдал не работу, а одно задание «решить по поводам» автору правила ` +
    `(держатель должности «Заместитель директора» — Токтосунов) со списком из 3 поводов и сроком правила 2 р.д.; поштучных заданий нет`);
  const [k1, k2, k3] = dec[0].rollupKeys;
  const out = ZD.decidePovods(dec[0].id, [k1, k2], 'поручить', 'E16');
  let noBasis = ''; try { ZD.decidePovods(dec[0].id, [k3], 'не поручать', 'E16'); } catch (e) { noBasis = e.message; }
  ZD.decidePovods(dec[0].id, [k3], 'не поручать', 'E16', 'вакансия закрывается конкурсом');
  ZD.runPoll();
  const after = ZD.state.tasks.filter(t => t.originKind === 'pk-org-head-vacant' && !t.decide);
  ok(23, out.length === 2 && out.every(t => t.ruleId === 'rule-org-head-vacant' && t.addr && t.addr.by === 'кураторство') &&
       /основание/.test(noBasis) && ZD.outcomeOf(dec[0]).outcome === 'исполнено' && after.length === 2 &&
       ZD.povodReleased(ZD.povodByKey(k3)) && ZD.state.tasks.filter(t => t.decide).length === 1,
    `автор поручил два повода — задания ушли адресатам по формуле правила тем же путём, что в авто; третий «не поручать» — только ` +
    `с основанием, ключ не всплыл на следующем прогоне; «решить» закрыто «исполнено», нового не выдано`);
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
  const err = fn => { try { fn(); return ''; } catch (e) { return e.message; } };
  ZD.runPoll();
  const open = ZD.state.tasks.filter(t => t.originKind === 'pk-org-head-vacant' && !ZD.isTerminal(t));
  const self = err(() => ZD.deactivateKind('pk-rejected', 'E4', 'приказ'));
  const step = err(() => ZD.deactivateKind('doc-sign', 'E4', 'приказ'));
  const user = err(() => ZD.deactivateKind('pk-org-head-vacant', 'E2', 'приказ'));
  const bare = err(() => ZD.deactivateKind('pk-org-head-vacant', 'E4', ''));
  ZD.deactivateKind('pk-org-head-vacant', 'E4', 'приказ №14 — вакансии ведёт кадровая служба');
  ok(25, /выпуском/.test(self) && /выпуском/.test(step) && /администратор/.test(user) && /основание/.test(bare) &&
       ZD.kindOf('pk-org-head-vacant').activatedAt === null && open.length === 3 &&
       open.every(t => ZD.outcomeOf(t) && ZD.outcomeOf(t).outcome === 'снято' && /вид выключен/.test(ZD.outcomeOf(t).reason)),
    `рубильник — только у надзора и только у администратора заданий с основанием: самоопрос и шаг документа выключаются выпуском; ` +
    `выключение надзора закрыло его 3 открытых задания «снято: вид выключен»`);
  ZD.state.today = '2026-09-03';
  ZD.runPoll();
  const ownPovod = ZD.state.povods.some(p => p.kind === 'pk-org-head-vacant' && p.status !== 'gone');
  const metaOff = ZD.state.povods.some(p => p.kind === 'pk-kind-inactive' && p.objectId === 'pk-org-head-vacant');
  const k = ZD.kindOf('pk-org-liq-blocked'); k.activatedAt = null; k.createdAt = '2026-08-28'; // пришёл выпуском и не введён
  ZD.runPoll();
  const metaNew = ZD.state.povods.some(p => p.kind === 'pk-kind-inactive' && p.objectId === 'pk-org-liq-blocked' && p.status !== 'gone');
  ok(26, !ownPovod && !metaOff && metaNew,
    `выключенный надзор своих поводов не даёт и «не введён в действие» не считается — выключен с основанием; вид, пришедший ` +
    `выпуском и не введённый дольше срока, — повод «вид повода не введён в действие»`);
  ZD.activateKind('pk-org-head-vacant', 'E4', 'приказ №15');
  ZD.runPoll();
  const revived = ZD.state.povods.some(p => p.kind === 'pk-org-head-vacant' && p.status !== 'gone');
  ok(27, revived && ZD.kindOf('pk-org-head-vacant').switches.map(s => s.ev).join() === 'выключен,введён в действие',
    `надзор включён обратно — поводы вернулись; ввод и выключение лежат в истории вида с основанием — рубильник обратим`);
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
  const refs = src.match(/ADR-\d{4}|ИЗ-\d+|ИО-\d+|ЗН-\d+|ЗГ-\d+|ЗКП-\d+|ЗЗ-\d+|ЗА-\d+|ИА-\d+|ЗДБ-\d+|ЗНС-\d+|P\d+-R\d+|[Вв]олн[аеыуой][ -]*\d/g) || [];
  ok(30, refs.length === 0,
    `макет чистый: ни ADR-, ни ИЗ-/ИО-/ЗН-/ЗГ-/ЗКП-/ЗЗ-/ЗА-/ИА-номеров, ни истории волн — пояснения живут в ` +
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
  const rollupTask = ZD.state.tasks.find(t => t.originKind === 'pk-org-head-vacant' && Array.isArray(t.rollupKeys));
  const single = ZD.state.tasks.filter(t => t.originKind === 'pk-org-head-vacant' && t.povodKey);
  ok(34, !orgSrc.rollup.includes('pk-org-head-vacant') && headPovods.length === 3 && !rollupTask && single.length === 3 &&
       ZD.ruleForKind('pk-org-head-vacant').rollup === null && ZD.rollupOf(ZD.ruleForKind('pk-org-head-vacant')) === 10,
    `демо-порог 2 снят (ЗН-25): правило не объявило своего — действует умолчание 10; три вакансии руководителя ` +
    `(у E2 одна, у E1 две) ниже порога по паре «вид × адресат» — три поштучных задания, вала нет`);
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
  ok(39, r.sources.length === 10 && !names.some(n => /заёмщик|КЗ-13/i.test(n)),
    `Заёмщик/КЗ-13 не участвует ни в одном прогоне как источник опроса — односторонний поток в обратную ` +
    `сторону (ADR-0229 «Последствия»): КЗ-13 остаётся витриной, датированные строки приходят ИЗ заданий, ` +
    `не наоборот (не подключался — граница задокументирована в журнале волны 2, не решена кодом; ` +
    `${r.sources.length} источников — self/orgstruct/statistics/reports/gosresh/programs/apps/docs/assets/analysis)`);
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
  ok(46, before === 0 && repSrc && repSrc.answer === 'множество' && repSrc.new === 13 &&
       repPovods.length === 13,
    `первый прогон от Отчётности непустой: источник «${repSrc && repSrc.name}» ответил «множество», ` +
    `13 новых поводов (только state==='просрочено' из всей формы RP.obligations() — ` +
    `кандидатная фраза ADR-0210 «срок сдачи формы истекает/истёк»); подключение — записью реестра, ` +
    `четвёртым в SOURCES (ADR-0231 п.4)`);
})();

(() => {
  ZD.seed();
  const r = ZD.runPoll();
  const repSrc = r.sources.find(s => s.name.indexOf('Отчётность') !== -1);
  const rep = ZD.state.tasks.filter(t => t.originKind === 'pk-rep-obligation-overdue');
  const rollupTask = rep.find(t => Array.isArray(t.rollupKeys));
  const prom = rep.find(t => t.povodKey === 't-overdue/2026-07-01/dep-prom');
  const osh = rep.find(t => t.povodKey === 't-overdue/2026-07-01/rep-osh');
  ok(47, repSrc.rollup.indexOf('pk-rep-obligation-overdue') !== -1 && rep.length === 3 &&
       !!rollupTask && rollupTask.rollupKeys.length === 11 && rollupTask.addr.by === 'кураторство' &&
       rollupTask.addr.responsible === 'E1' && rollupTask.assignee === 'E1' &&
       prom && prom.assignee === 'E3' && osh && osh.addr.via === 'запасной' && osh.assignee === 'E5',
    `порог считается по паре «вид × адресат» (ЗН-23): 13 просроченных форм разложены по кураторам — 11 у E1 ` +
    `выше порога 10 → один вал ${rollupTask && rollupTask.id} с одним ответственным; dep-prom (E3) и ` +
    `rep-osh (куратора нет → запасной E2, в отпуске → E5) — поштучно; ни вала запасному, ни вала на троих`);
})();

(() => {
  ZD.seed();
  ZD.runPoll();
  const tasksBefore = ZD.state.tasks.length;
  const r2 = ZD.runPoll();
  const repSrc = r2.sources.find(s => s.name.indexOf('Отчётность') !== -1);
  ok(48, repSrc.new === 0 && repSrc.matched === 13 && repSrc.gone === 0 && ZD.state.tasks.length === tasksBefore,
    `повторный прогон той же датой на источнике Отчётности: new=0, matched=3, gone=0, второй вал-таск ` +
    `поверх открытого не выдан — полная сверка идемпотентна и здесь (ИЗ-3 п.2), тем же движком, что у ` +
    `self/orgstruct/statistics`);
})();

(() => {
  ZD.seed();
  ZD.runPoll();
  const keys = ZD.state.povods.filter(p => p.kind === 'pk-rep-obligation-overdue').map(p => p.key).sort();
  const expected = ['dep-admin','dep-prom','rep-osh','rep-batken','rep-jalal','rep-issyk','rep-naryn','rep-talas','rep-chui',
    'rep-bishkek','rep-tokmok','rep-kara-balta','rep-karakol'].map(d => 't-overdue/2026-07-01/' + d).sort();
  const p = ZD.povodByKey('t-overdue/2026-07-01/dep-admin');
  ok(49, keys.join('|') === expected.join('|') && p && p.objectType === 'obligation' && p.objectId === 'dep-admin',
    `ключ шва — целиком тот, что отдаёт сосед (o.id из RP.obligations(), ${keys.length} ключей, «${keys[0]}» …), тем же ` +
    `приёмом, что у Статистики в волне 3 — не пересобран в свою тройку «kindId|type:id|» (ИЗ-13 п.9, ` +
    `у Отчётности тоже ровно один вид повода на дверь); вид объекта — «obligation», объект — подразделение ` +
    `(dept), не «task», как у собственных видов`);
})();

(() => {
  ZD.seed();
  ZD.runPoll();
  const repPovods = ZD.state.povods.filter(p => p.kind === 'pk-rep-obligation-overdue');
  const clamped = repPovods.length === 13 && repPovods.every(p => p.stateDate === '2026-09-02');
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
  ok(51, periods.length === 13 && periods.every(pd => pd === 'июнь 2026'),
    `фильтр по state==='просрочено' действительно отсёк НЕ-povod-worthy строки соседа (RP.obligations() ` +
    `отдаёт 15 строк одного шаблона: 13 «просрочено» за июнь + 1 «сдано» за июль + 1 «ожидается» за август) — ` +
    `поводов ровно 13, все с периодом «июнь 2026», ни одна строка «сдано»/«ожидается» повода не породила`);
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
       statStillAppeared === statAppearedBefore && repFrozen === 13,
    `независимая заморозка четвёртого источника: молчит только Отчётность — её ${repFrozen} повода замерзают, ` +
    `self (${selfStillAppeared}), Оргструктура (${orgStillAppeared}) и Статистика (${statStillAppeared}) ` +
    `остаются целы без изменений — четыре источника не гасят друг друга (ИЗ-12 п.6)`);
})();

(() => {
  ZD.seed();
  const r = ZD.runPoll();
  ok(53, r.sources.length === 10 && r.sources[3].name.indexOf('Отчётность') !== -1 &&
       r.sources[4].name === 'Госрешение' && r.sources[5].name === 'Кредитные программы' && r.sources[6].name === 'Заявки' &&
       r.sources[7].name === 'Документооборот' && r.sources[8].name === 'Имущество' && r.sources[9].name === 'Анализ',
    `сторож структуры источников: SOURCES держит 10 записей, четвёртая — Отчётность, пятая и шестая — Госрешение ` +
    `и Кредитные программы (волна макета 8), седьмая — Заявки (волна макета 9), восьмая — Документооборот (волна макета 10), девятая — Имущество (волна макета 11), десятая — Анализ (волна макета 12); Отчётность ` +
    `(RP.obligations), подключённая тем же приёмом реестра, что Оргструктура и Статистика — движок ` +
    `runPoll()/computeExpectedForKind не переписан целиком, только дополнена одна ветка сверки (ADR-0228 ИЗ-8)`);
})();

/* ---------- P. Решения ЗН-1…ЗН-10 (канон §14) ---------- */
const at = d => { ZD.state.today = d; };
const taskByKey = re => ZD.state.tasks.find(t => t.povodKey && re.test(t.povodKey));
const notes = (kind, taskId) => ZD.state.notifications.filter(n => n.kind === kind && (!taskId || n.taskId === taskId));
const throws = fn => { try { fn(); return ''; } catch (e) { return e.message || 'ошибка'; } };
const setRule = (id, field, v, by = 'E4') => ZD.editRule(id, { [field]: v }, { by, basis: 'приказ' });

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
  const sameRun = ZD.state.povods.some(p => p.kind === 'pk-addr-missing' && zalog && p.objectId === zalog.id); // ночной сосед — повод на следующем самоопросе
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
  ZD.addProgress(bat.id, 'E5', 'запросил проект приказа');
  ZD.take(bat.id, 'E5');
  at('2026-09-04');
  ZD.runPoll();
  ok(58, bat.assignee === 'E5' && !bat.journal.some(e => e.ev === 'переадресовано') && ZD.lastEv(bat) === 'принято',
    `то же закрепление сменилось, но задание взято в работу («Взять в работу» → «принято») — остаётся у ` +
    `исполнителя E5, переадресации нет (состояние «${ZD.deriveState(bat)}»)`);
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
  ZD.take(bat.id);
  const noProof = throws(() => ZD.claim(bat.id));
  const stillOpen = ZD.lastEv(bat) === 'принято';
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
  ZD.take(closed.id); ZD.claim(closed.id); ZD.acceptDecision(closed.id, true);
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

/* ЗН-9 — вал как контейнер ключей (вал «Отчётности» у E1: 11 ключей) */
const repVal = () => ZD.state.tasks.find(t => t.originKind === 'pk-rep-obligation-overdue' && t.rollupKeys);
const repKey = d => 't-overdue/2026-07-01/' + d;
(() => {
  ZD.seed();
  ZD.runPoll();
  const val = repVal();
  at('2026-09-08');
  ZD.runPoll();
  const gone = ['rep-batken','rep-jalal','rep-issyk'].map(repKey);
  ok(69, gone.every(k => ZD.keyStatus(val, k) === 'отпал') && !ZD.isTerminal(val) && ZD.liveKeys(val).length === 7 &&
       !ZD.state.tasks.some(t => gone.includes(t.povodKey)),
    `08.09 три представительства сдали форму — их ключи помечены «отпал» в списке вала ${val.id}, вал открыт ` +
    `с ${ZD.liveKeys(val).length} живыми ключами (ещё один вышел — #70), поштучных заданий на отпавшие ключи нет`);
})();

(() => {
  ZD.seed();
  ZD.runPoll();
  const val = repVal();
  const kar = repKey('rep-karakol');
  at('2026-09-08');
  ZD.runPoll();
  const repTasks = () => ZD.state.tasks.filter(t => t.originKind === 'pk-rep-obligation-overdue').length;
  const n = repTasks();
  ZD.runPoll();
  const single = ZD.state.tasks.filter(t => t.povodKey === kar);
  ok(70, ZD.keyStatus(val, kar) === 'вышел' && single.length === 1 && single[0].assignee === 'E3' &&
       single[0].repeatOf === null && !ZD.isTerminal(val) && repTasks() === n,
    `08.09 куратор «Каракола» сменился E1 → E3: ключ вышел из непринятого вала ${val.id} поштучным ` +
    `заданием ${single[0] && single[0].id} у нового ответственного (не «повтор»), вал открыт; повторный прогон дублей не дал`);
})();

(() => {
  ZD.seed();
  ZD.runPoll();
  const val = repVal();
  at('2026-09-04'); ZD.runPoll();
  const midOpen = !ZD.isTerminal(val) && ZD.liveKeys(val).length === 11;
  at('2026-09-15'); ZD.runPoll();
  const o = ZD.outcomeOf(val);
  ok(71, midOpen && o && o.outcome === 'исполнено' && val.rollupKeys.every(k => ZD.keyStatus(val, k) === 'отпал'),
    `вал закрыт, только когда живых ключей не осталось: 04.09 открыт со всеми 11, к 15.09 сдали все — ` +
    `ключи отпали штатно, исход «исполнено»`);
})();

(() => {
  ZD.seed();
  ZD.runPoll();
  const val = repVal();
  const notExec = throws(() => ZD.splitRollup(val.id, 'E4'));
  const out = ZD.splitRollup(val.id, val.assignee);
  const keys = out.map(t => t.povodKey).sort().join('|');
  const tasksBefore = ZD.state.tasks.length;
  ZD.runPoll();
  ok(72, notExec && out.length === 11 && keys === val.rollupKeys.slice().sort().join('|') &&
       ZD.outcomeOf(val).outcome === 'снято' && out.every(t => t.repeatOf === null && t.assignee === 'E1') &&
       ZD.state.tasks.length === tasksBefore,
    `исполнитель разобрал вал на поштучные: 11 заданий по формуле адресата (все — куратору E1), вал ` +
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
  ok(74, rep.new === 0 && rep.gone === 0 && rep.matched === 13 && june.length === 13 &&
       june.every(p => p.traits.период === 'июнь 2026') && rep2.gone === 4 && live.length === 9,
    `ключи июньского периода живут, пока сосед их называет: 04.09 все 13 совпали (модуль не закрыл и не ` +
    `перенёс в новый период), 08.09 отпали ровно четыре — те, что сосед перестал называть`);
})();

(() => {
  ZD.seed();
  const own = ZD.SELF_KINDS.slice(6).map(id => [ZD.ruleForKind(id).rollup, ZD.ruleForKind(id).dueN, ZD.ruleForKind(id).mode].join('/'));
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

/* ---------- Q. Решения гриллинга ЗН-11…ЗН-25 (канон §14) ---------- */
const statTask = () => ZD.state.tasks.find(t => t.originKind === 'pk-stat-neighbor-silent' && /взыскание/.test(t.povodKey));

/* ЗН-11 — «Взять в работу» */
(() => {
  ZD.seed();
  const t = ZD.state.tasks.find(x => x.label.indexOf('скан согласия') !== -1); // E1, автор и контролёр E4
  const early = throws(() => ZD.claim(t.id));
  const stranger = throws(() => ZD.take(t.id, 'E3'));
  ZD.take(t.id, 'E1');
  const taken = ZD.lastEv(t) === 'принято' && ZD.deriveState(t) === 'в работе';
  const accepted = notes('принято', t.id).map(n => n.to).join(',');
  ZD.claim(t.id);
  ok(77, /Взять в работу/.test(early) && !!stranger && taken && accepted === 'E4' &&
       notes('принято', t.id).length === 1 && ZD.lastEv(t) === 'ожидает приёмки',
    `заявить из «поручено» нельзя («${early}»); «Взять в работу» — событие «принято», уведомление «принято» ` +
    `автору-контролёру E4 один раз (не исполнителю и не дважды); при заявлении второго «принято» нет; ` +
    `посторонний в работу не берёт`);
})();

(() => {
  ZD.seed();
  ZD.runPoll();
  const bat = taskByKey(/Баткенская/);
  ZD.addProgress(bat.id, 'E5', 'изучаю приказ об и.о.');
  at('2026-09-04');
  ZD.runPoll();
  ok(78, bat.assignee === 'E1' && bat.journal.some(e => e.ev === 'переадресовано') && ZD.lastEv(bat) === 'поручено',
    `отметка о ходе от переадресации не защищает — только «Взять в работу»: задание с отметкой, но не взятое, ` +
    `при смене куратора ушло E5 → E1 (сравнить с #58)`);
})();

/* ЗН-12 — возврат заявленного только на полном прогоне со срезом позже дня заявления */
(() => {
  ZD.seed();
  ZD.runPoll();
  const t = statTask();
  ZD.take(t.id); ZD.claim(t.id);
  ZD.runPoll();
  const sameDay = ZD.lastEv(t);
  at('2026-09-03');
  const r3 = ZD.runPoll({ downSources: ['reports'] });
  const partial = ZD.lastEv(t);
  at('2026-09-04');
  ZD.runPoll();
  const back = ZD.lastEv(t);
  ZD.claim(t.id);
  ZD.toggleStatCleared(true);
  ZD.runPoll();
  const o = ZD.outcomeOf(t);
  ok(79, sameDay === 'заявлено' && !r3.complete && partial === 'заявлено' && back === 'возвращено' &&
       notes('возвращено', t.id).length === 1 && o && o.outcome === 'исполнено',
    `заявлено 02.09, повод жив: прогон того же дня — «заявлено»; неполный прогон 03.09 — «заявлено»; полный ` +
    `04.09 — «возвращено» с уведомлением; снова заявлено — повод отпал → «исполнено»`);
})();

/* ЗН-13 — две оси при названном контролёре */
(() => {
  ZD.seed();
  ZD.runPoll();
  const t = taskByKey(/^pk-org-no-staff/);
  const ctrl = t && t.controller === 'E4' && t.assignee === 'E3';
  ZD.take(t.id); ZD.claim(t.id);
  const early = throws(() => ZD.acceptDecision(t.id, true));
  ZD.acceptDecision(t.id, false, 'приложите штатное расписание');
  const returned = ZD.lastEv(t) === 'возвращено';
  ZD.claim(t.id);
  at('2026-09-10');
  ZD.runPoll();
  const waits = ZD.lastEv(t) === 'ожидает приёмки' && t.journal.some(e => e.ev === 'повод отпал') &&
    notes('повод-отпал', t.id).some(n => n.to === 'E4') && !ZD.isTerminal(t);
  ZD.acceptDecision(t.id, true);
  const n = ZD.state.tasks.filter(x => x.originKind === 'pk-org-no-staff').length;
  ZD.runPoll();
  ok(80, ctrl && /жив/.test(early) && returned && waits && ZD.outcomeOf(t).outcome === 'исполнено' &&
       ZD.state.tasks.filter(x => x.originKind === 'pk-org-no-staff').length === n,
    `у правила «подразделение без штата» назван контролёр E4: пока повод жив, «Принять» отбито («${early}»), ` +
    `«Вернуть» работает; 10.09 подразделение укомплектовано — задание не закрылось само, а ждёт контролёра ` +
    `с отметкой «повод отпал»; принял — «исполнено», переиздания нет`);
})();

/* ЗН-14 — «Снять»: автор, любое нетерминальное, пара не переиздаётся */
(() => {
  ZD.seed();
  ZD.runPoll();
  const t = statTask();
  const notAuthor = throws(() => ZD.releaseTask(t.id, 'E1', 'не нужно'));
  const noReason = throws(() => ZD.releaseTask(t.id, 'E4', ''));
  ZD.releaseTask(t.id, 'E4', 'молчание согласовано с владельцем соседа');
  const p = ZD.povodByKey(t.povodKey);
  const n = ZD.state.tasks.filter(x => x.povodKey === t.povodKey).length;
  ZD.runPoll();
  const noReissue = ZD.state.tasks.filter(x => x.povodKey === t.povodKey).length === n && ZD.povodReleased(p);
  ZD.toggleStatCleared(true); ZD.runPoll();
  ZD.toggleStatCleared(false); ZD.runPoll();
  const again = ZD.state.tasks.filter(x => x.povodKey === t.povodKey);
  const claimed = ZD.state.tasks.find(x => ZD.lastEv(x) === 'ожидает приёмки' && x.kind === 'free');
  ZD.releaseTask(claimed.id, claimed.author, 'заёмщик погасил долг');
  ok(81, notAuthor && noReason && ZD.outcomeOf(t).outcome === 'снято' && noReissue && n === 1 &&
       again.length === 2 && again[1].repeatOf === t.id && ZD.outcomeOf(claimed).outcome === 'снято',
    `снимает только автор и с основанием; снятое из «поручено» — ключ помечен «снят без поручения», ` +
    `повторный прогон нового задания не дал; ключ отпал и вернулся — «повтор после ${t.id}»; ` +
    `автор снял и задание в «ожидает приёмки»`);
})();

/* ЗН-15 — «возвращено» нетерминально, работа у того же исполнителя */
(() => {
  ZD.seed();
  ZD.runPoll();
  const bat = taskByKey(/Баткенская/);
  const due = ZD.dueOf(bat);
  ZD.take(bat.id); ZD.claim(bat.id, 'приказ №12');
  at('2026-09-04');
  ZD.runPoll();
  const st = ZD.lastEv(bat);
  ZD.claim(bat.id, 'приказ №12, редакция 2');
  ok(82, st === 'возвращено' && bat.assignee === 'E5' && !bat.journal.some(e => e.ev === 'переадресовано') &&
       ZD.dueOf(bat) === due && ZD.lastEv(bat) === 'заявлено' && !ZD.isTerminal(bat),
    `возвращённое задание осталось у E5 — смена куратора 04.09 его не переадресовала, срок прежний ` +
    `(${due}); доделано и заявлено повторно без нового «Взять в работу»`);
})();

/* ЗН-16 — просрочка одним сигналом каждому */
(() => {
  ZD.seed();
  ZD.runPoll();
  const t1 = ZD.state.tasks.find(x => x.label.indexOf('Сверить остаток') !== -1); // E1, срок 25.08
  const esc = ZD.state.tasks.find(x => x.povodKey === `pk-overdue|task:${t1.id}|`);
  const sig = esc ? ZD.state.notifications.filter(n => n.taskId === esc.id).map(n => n.kind).join(',') : '';
  const fresh = ZD.createFreeTask({ label: 'сверить реестр', assignee: 'E3', controller: 'E4', author: 'E4', dueDate: '2026-09-01' });
  ZD.runPoll();
  const key = `pk-overdue|task:${fresh.id}|`;
  const day1 = !ZD.povodByKey(key) && notes('срок-истёк', fresh.id).some(n => n.to === 'E3');
  at('2026-09-04'); ZD.runPoll();
  const day3 = !ZD.povodByKey(key);
  at('2026-09-08'); ZD.runPoll();
  const day5 = ZD.state.tasks.find(x => x.povodKey === key);
  ok(83, esc && esc.assignee === 'E5' && sig === 'эскалация' && notes('эскалация', t1.id).length === 0 &&
       notes('срок-истёк', t1.id).some(n => n.to === 'E1') && day1 && day3 && day5 && day5.addr.responsible === 'E2' && day5.assignee === 'E5',
    `исполнителю — «срок истёк»; руководителю на 5-й р.д. — задание «Просрочено задание» (${esc && esc.id}, ` +
    `E2 в отпуске → E5), пришедшее уведомлением «эскалация», а не «поручено», и без отдельной «эскалации» ` +
    `по самому заданию; новое просроченное 01.09: 02.09 и 04.09 повода нет, 08.09 (5 р.д.) — задание руководителю E2 (действует E5)`);
})();

/* ЗН-20 — порог молчания: время, объявляет источник */
(() => {
  const thr = ZD.SOURCES.map(s => ZD.silenceThreshold(s));
  const doc = ZD.silenceThreshold({ pollEveryMin: 5, silenceMin: null });
  const own = ZD.silenceThreshold({ pollEveryMin: 60, silenceMin: 240 });
  ZD.seed();
  ZD.runPoll();
  at('2026-09-03'); ZD.runPoll({ downSources: ['reports'] });
  const after1 = ZD.state.povods.some(p => p.kind === 'pk-neighbor-silent');
  at('2026-09-04'); ZD.runPoll({ downSources: ['reports'] });
  const pv = ZD.povodByKey('pk-neighbor-silent|source:reports|');
  const only = ZD.state.povods.filter(p => p.kind === 'pk-neighbor-silent').length === 1;
  const fix = pv && ZD.state.tasks.find(t => t.povodKey === pv.key);
  const tr = pv ? Object.assign({}, pv.traits) : {};
  at('2026-09-08'); ZD.runPoll(); ZD.runPoll();
  ok(84, thr.every((x, i) => x === (ZD.SOURCES[i].pollEveryMin === 5 ? 30 : 2880)) && thr.filter(x => x === 30).length === 4 && doc === 30 && own === 240 && !after1 && pv && only &&
       tr.порог_минут === 2880 && tr.молчит_минут === 2880 && pv.stateDate === '2026-09-03' &&
       fix && fix.assignee === 'E4' && pv.status === 'gone',
    `порог — время: у ночных источников два интервала = 2880 мин, у пятиминутных (Госрешение, программы, заявки, документооборот) — не меньше 30, объявленный ` +
    `источником — свой (240); Отчётность молчит с 03.09: сутки — не повод, двое суток — повод на источник ` +
    `с заданием администратору; ответила 08.09 — повод отпал`);
})();

/* ЗН-22 — замещение после выдачи */
(() => {
  ZD.seed();
  ZD.runPoll();
  const t = statTask(); // выдано E1 02.09; E1 в командировке 09.09–12.09, замещает E3
  const before = ZD.visibleTo(t, 'E3');
  at('2026-09-10');
  const sees = ZD.visibleTo(t, 'E3');
  const stranger = throws(() => ZD.take(t.id, 'E5'));
  ZD.take(t.id, 'E3');
  const e = t.journal[t.journal.length - 1];
  ZD.addProgress(t.id, 'E3', 'запросил объяснение у владельца взыскания');
  ZD.claim(t.id, null, 'E3');
  at('2026-09-15');
  ok(85, !before && sees && !!stranger && t.assignee === 'E1' && e.ev === 'принято' && e.by === 'E3' && e.for === 'E1' &&
       ZD.lastEv(t) === 'заявлено' && !ZD.visibleTo(t, 'E3'),
    `задание не переехало: исполнитель E1, но 10.09 замещающий E3 его видит и действует за него — взял ` +
    `в работу («E3 за E1» в журнале), отметил ход, заявил; посторонний — отказ; 15.09 замещение кончилось — не видит`);
})();

/* ЗН-23 — свёртка по паре «вид × адресат» */
(() => {
  ZD.seed();
  setRule('rule-org-head-vacant', 'rollup', 1);
  ZD.runPoll();
  const head = ZD.state.tasks.filter(t => t.originKind === 'pk-org-head-vacant');
  const val = head.find(t => t.rollupKeys);
  const single = head.filter(t => t.povodKey);
  ok(86, head.length === 2 && val && val.rollupKeys.length === 2 && val.assignee === 'E1' &&
       Object.values(val.rollupResp).every(x => x === 'E1') && single.length === 1 && single[0].addr.responsible === 'E2',
    `правило объявило порог 1 (редакцией): у E1 две вакансии (Ош, Жалал-Абад) — вал ${val && val.id} ему, у E2 одна — поштучно; ` +
    `у вала один ответственный`);
})();

/* ЗН-24 — производственный календарь */
(() => {
  ZD.seed();
  ZD.runPoll();
  const ruleDue = taskByKey(/^pk-org-no-staff/).dueDate;
  ok(87, !ZD.isWork('2026-08-31') && ZD.addWorkdays('2026-08-28', 1) === '2026-09-01' && ZD.isWork('2026-03-28') &&
       ZD.workdaysBetween('2026-08-25', '2026-09-02') === 5 && ruleDue === '2026-09-04' &&
       /2027/.test(ZD.calNote('2026-12-28', '2027-01-05')) && ZD.calNote('2026-09-02', '2026-09-04') === '',
    `сроки по общему календарю: 31.08 (День независимости) не рабочий, 28.03.2026 — рабочая суббота, после ` +
    `25.08 по 02.09 — 5 р.д., а не 6; год 2027 не заведён — видимая отметка «${ZD.calNote('2026-12-28', '2027-01-05')}»`);
})();

/* ЗН-25 — порог свёртки по умолчанию 10 */
(() => {
  ZD.seed();
  const neigh = ZD.state.povodKinds.filter(k => !ZD.SELF_KINDS.includes(k.id));
  const own = ZD.SELF_KINDS.map(id => ZD.ruleForKind(id).rollup);
  ok(88, ZD.ROLLUP_DEFAULT === 10 && neigh.length === 52 && neigh.every(k => ZD.ruleForKind(k.id).rollup === null && ZD.rollupOf(ZD.ruleForKind(k.id)) === 10) &&
       own.every(x => typeof x === 'number') && own.filter(x => x === 5).length === 2,
    `у правил пятидесяти двух видов соседей (восемь — Госрешение и программы, двенадцать — заявки, одиннадцать — документооборот, десять — имущество, два — анализ, два — отчётность, один из них выведен выпуском) своего порога нет — действует умолчание 10; правила собственных видов объявили своё ` +

    `(20, у «сосед не отвечает» и «адресат не найден» — 5)`);
})();

/* ИЗ-5 — вернувшийся ключ при открытом задании второго не порождает */
(() => {
  ZD.seed();
  ZD.runPoll();
  const t = statTask();
  ZD.toggleStatCleared(true); ZD.runPoll();
  const lapsed = ZD.lastEv(t) === 'отпало';
  ZD.toggleStatCleared(false); ZD.runPoll();
  const open = ZD.state.tasks.filter(x => x.povodKey === t.povodKey && !ZD.isTerminal(x));
  ok(89, lapsed && open.length === 1 && open[0] === t,
    `повод отпал (задание «отпало — ждёт разбора»), потом вернулся тем же ключом — открытое задание на паре ` +
    `одно (${t.id}), второе не выдано; новое появится после разбора — «повтор после» (#66)`);
})();

/* ---------- R. Госрешение и кредитная программа — шаги согласования и поводы по данным ---------- */
const gdTask = (kind, obj) => ZD.state.tasks.filter(t => t.povodKey === `${kind}|${/^GD/.test(obj) ? 'gosreshenie' : 'program'}:${obj}|`);
const lastOf = (kind, obj) => { const a = gdTask(kind, obj); return a[a.length - 1]; };

/* ЗГ-1, ЗКП-1 — два новых источника записями реестра, оба рода поводов */
(() => {
  ZD.seed();
  const gd = ZD.SOURCES.find(s => s.id === 'gosresh'), lp = ZD.SOURCES.find(s => s.id === 'programs');
  const kinds = [...gd.kinds, ...lp.kinds];
  const wired = kinds.every(k => ZD.kindOf(k) && ZD.ruleForKind(k) && ZD.actionOf(ZD.ruleForKind(k).action) && ZD.kindOf(k).ownerExec);
  const steps = ['gd-review','gd-revise','lp-review','lp-revise'], data = ['gd-closed-live-programs','gd-active-no-doc','lp-expiring','lp-expired'];
  ok(90, gd.pollEveryMin === 5 && lp.pollEveryMin === 5 && kinds.length === 8 && wired && ZD.checkRegistry().length === 0 &&
       steps.every(k => kinds.includes(k)) && data.every(k => kinds.includes(k)) &&
       ZD.ownerOfKind('gd-closed-live-programs') === 'Госрешение' && lp.kinds.includes('gd-closed-live-programs'),
    `Госрешение и Кредитные программы — пятый и шестой источник, опрос 5 мин; восемь видов (по четыре: шаги ` +
    `согласования и поводы по данным) заведены записями трёх реестров, реестр сходится; «закрыто, а программа ` +
    `действует» — вид Госрешения, ответ о программах даёт владелец программ`);
})();

/* ЗГ-2, ЗН-17 — очередь роли «Согласующий» и названный автор; принятие — реквизит вида */
(() => {
  ZD.seed();
  ZD.runPoll();
  const q = lastOf('gd-review', 'GD-12'), n = lastOf('gd-revise', 'GD-15');
  const queued = q && q.assignee === null && ZD.inQueue(q) && ZD.visibleTo(q, 'E6') && ZD.visibleTo(q, 'E8') && !ZD.visibleTo(q, 'E3') &&
    ZD.state.notifications.filter(x => x.taskId === q.id && x.kind === 'поручено').map(x => x.to).sort().join() === 'E6,E8' &&
    ZD.queueTasks && (ZD.state.viewer = 'E8', ZD.queueTasks('role').includes(q)) && !ZD.queueTasks('mine').includes(q);
  const stranger = throws(() => ZD.take(q.id, 'E3'));
  ZD.take(q.id, 'E8');
  const taken = q.assignee === 'E8' && ZD.lastEv(q) === 'принято' && !ZD.inQueue(q) && !ZD.visibleTo(q, 'E6');
  const named = n && n.assignee === 'E1' && n.addr.via === 'названный' && ZD.lastEv(n) === 'принято' && ZD.kindOf('gd-revise').take === 'не нужно';
  const noTake = throws(() => ZD.take(n.id, 'E1'));
  ZD.state.viewer = 'E4';
  ok(91, queued && /носитель роли/.test(stranger) && taken && named && /не нужно/.test(noTake),
    `«Рассмотреть госрешение» GD-12 — в очереди роли «Согласующий»: исполнителя нет, видят и получают «поручено» ` +
    `оба носителя (E6, E8), посторонний взять не может; E8 «Взял в работу» — закреплено за ним, очередь его ` +
    `больше не показывает; «Доработать госрешение» GD-15 — автору E1, названному поводом, сразу в работе («${noTake}»)`);
})();

/* ЗКП-2 — четыре глаза: lp-review по своей программе автору-носителю роли не виден */
(() => {
  ZD.seed();
  ZD.runPoll();
  const t = lastOf('lp-review', 'LP-14'); // автор программы — E6, носитель роли «Согласующий»
  const hidden = t.queue.exclude.join() === 'E6' && !ZD.visibleTo(t, 'E6') && ZD.visibleTo(t, 'E8') &&
    !ZD.state.notifications.some(x => x.taskId === t.id && x.to === 'E6');
  const appeared = ZD.state.notifications.filter(x => x.kind === 'повод-появился' && x.t === '2026-09-02').map(x => x.to);
  const self = throws(() => ZD.take(t.id, 'E6'));
  const ownerSelf = throws(() => ZD.ownerStep('lp', 'LP-14', 'E6', 'одобрить'));
  ok(92, hidden && /автор/.test(self) && /автор/.test(ownerSelf) && appeared.includes('E8'),
    `«Рассмотреть программу» LP-14: автор E6 — носитель роли, но задание ему не видно, «поручено» не пришло, ` +
    `взять нельзя («${self}»); у владельца одобрить свою программу он тоже не может («${ownerSelf}»); E8 видит`);
})();

/* ЗГ-3, ЗН-18 — исполнение у владельца: «сдано» и «Снять» нет, отпадение сменой статуса с атрибуцией */
(() => {
  ZD.seed();
  ZD.runPoll();
  const rev = lastOf('gd-review', 'GD-9'), exp = lastOf('lp-expiring', 'LP-8'), fix = lastOf('gd-revise', 'GD-15');
  ZD.take(exp.id, 'E8');
  const noClaim = throws(() => ZD.claim(exp.id, null, 'E8'));
  const noRelease = throws(() => ZD.releaseTask(exp.id, 'E4', 'не нужно'));
  at('2026-09-03'); ZD.runPoll();   // GD-9 отклонил E8 — очередь никто не брал
  const o1 = ZD.outcomeOf(rev);
  at('2026-09-09'); ZD.runPoll();   // LP-8 продлила E6, а задание брал E8
  const o2 = ZD.outcomeOf(exp);
  at('2026-09-10'); ZD.runPoll();   // GD-15 отправила E3 за E1 (командировка)
  const o3 = ZD.outcomeOf(fix), e3 = fix.journal[fix.journal.length - 1];
  const neverLapsed = ZD.state.tasks.filter(t => /^(gd|lp)-/.test(t.originKind)).every(t => !t.journal.some(e => e.ev === 'отпало'));
  ok(93, /владельц/.test(noClaim) && /владел/.test(noRelease) && o1.outcome === 'исполнено' && o1.by === 'E8' &&
       o2.outcome === 'исполнено · выполнил другой' && o2.by === 'E6' && o3.outcome === 'исполнено' && e3.by === 'E3' && e3.for === 'E1' &&
       neverLapsed,
    `«Заявить» и «Снять» отбиты («${noClaim}»); GD-9 отклонён 03.09 — задание очереди «исполнено», выполнил E8; LP-8 ` +
    `продлена E6, а задание брал E8 — «исполнено · выполнил другой»; GD-15 отправлена E3 за E1 — «исполнено» ` +
    `(действующий за адресата); «отпало — ждёт разбора» у таких видов не бывает`);
})();

/* ЗГ-4 — ключ «вид · госрешение:id», админ-возврат — «повтор после» */
(() => {
  ZD.seed();
  ZD.runPoll();
  const first = lastOf('gd-review', 'GD-9');
  at('2026-09-03'); ZD.runPoll();
  at('2026-09-08'); ZD.runPoll();   // администратор вернул отклонённое решение на рассмотрение
  const again = lastOf('gd-review', 'GD-9');
  const ev = ZD.ownerAt('gd', 'GD-9', '2026-09-08').last;
  ok(94, first.povodKey === 'gd-review|gosreshenie:GD-9|' && again !== first && again.repeatOf === first.id && again.repeatCount === 1 &&
       ev.by === 'E4' && ZD.silenceThreshold(ZD.SOURCES.find(s => s.id === 'gosresh')) === 30,
    `ключ ${first.povodKey} — период пуст; «Отклонён» → «На рассмотрении» администратором 08.09 — новое задание ` +
    `${again.id} «повтор после ${first.id}»; опрос 5 мин, порог молчания 30 мин`);
})();

/* ЗГ-5, ЗГ-6, ЗКП-3 — «закрыто, а программы живы»: объект — программа, каскада нет */
(() => {
  ZD.seed();
  ZD.runPoll();
  at('2026-09-04'); ZD.runPoll();   // GD-4 закрыт; на него ссылаются LP-5 и LP-11
  const ts = ZD.state.tasks.filter(t => t.originKind === 'gd-closed-live-programs');
  const p = ZD.povodByKey('gd-closed-live-programs|program:LP-5|');
  const live = ['LP-5', 'LP-11'].every(id => ZD.ownerAt('lp', id, '2026-09-04').status === 'Действует');
  ok(95, ts.length === 2 && ts.map(t => t.povodKey).sort().join() === 'gd-closed-live-programs|program:LP-11|,gd-closed-live-programs|program:LP-5|' &&
       ts.every(t => t.queue && t.queue.role === 'lp-approver' && t.addr.via === 'очередь') && live &&
       p.objectType === 'program' && /не принимаются/.test(p.traits.заявки) && p.stateDate === '2026-09-04' &&
       !ZD.state.tasks.some(t => t.povodKey && /gosreshenie:GD-4/.test(t.povodKey)),
    `GD-4 закрыт 04.09 — повод на каждую действующую программу под ним (LP-5, LP-11), очередь «Согласующий» ` +
    `программ; программы остались «Действует» (каскада статуса нет), приём заявок виден заблокированным сразу; ` +
    `на само решение задания нет`);
})();

/* ЗГ-7 — «Действует без документа»: автору, без автора — администратору; отпадает после загрузки */
(() => {
  ZD.seed();
  ZD.runPoll();
  at('2026-09-03'); ZD.runPoll();   // перенос данных: GD-1 без автора, GD-3 автора знает
  const g1 = lastOf('gd-active-no-doc', 'GD-1'), g3 = lastOf('gd-active-no-doc', 'GD-3');
  at('2026-09-04'); ZD.runPoll();
  const miss = ZD.state.tasks.find(t => t.povodKey === `pk-addr-missing|task:${g1.id}|`);
  const wrong = throws(() => ZD.gdAttachDoc('GD-1', 'E3'));
  at('2026-09-10'); ZD.runPoll();   // E3 приложила документ к GD-3
  ok(96, g3.assignee === 'E3' && g3.addr.via === 'названный' && g1.assignee === 'E4' && g1.addr.via === 'администратор' && !!miss &&
       ZD.outcomeOf(g3).outcome === 'исполнено' && ZD.ownerAt('gd', 'GD-3', '2026-09-10').status === 'Действует' && /автор/.test(wrong),
    `перенесённые 03.09 решения без документа: GD-3 — автору E3, GD-1 (автора нет) — администратору E4, и это ` +
    `повод «адресат не найден» (${miss && miss.id}); E3 приложила документ 10.09 без смены статуса — задание исполнено`);
})();

/* ЗГ-8, ЗКП-8 — сроки и порог: значения правила с источником «внутренний акт» */
(() => {
  ZD.seed();
  ZD.runPoll();
  const due = id => ZD.ruleForKind(id).dueN;
  const allActs = ['gd-review','gd-revise','gd-closed-live-programs','gd-active-no-doc','lp-review','lp-revise','lp-expiring','lp-expired']
    .every(k => ZD.ruleForKind(k).dueSource === 'внутренний акт');
  const exp = lastOf('lp-expiring', 'LP-8'), rev = lastOf('gd-review', 'GD-12');
  setRule('rule-gd-review', 'dueN', 7, 'E4');
  at('2026-09-03'); ZD.runPoll();   // GD-9 отклонён — задание закрыто
  at('2026-09-08'); ZD.runPoll();   // возвращён на рассмотрение — новое задание по новой редакции
  const again = lastOf('gd-review', 'GD-9');
  const bad = throws(() => setRule('rule-org-head-vacant', 'dueN', 3, 'E2'));
  ok(97, [due('gd-review'), due('gd-revise'), due('gd-closed-live-programs'), due('gd-active-no-doc')].join('/') === '7/10/5/10' &&
       [due('lp-review'), due('lp-revise'), due('lp-expired')].join('/') === '5/10/5' && ZD.expiringDays() === 30 && allActs &&
       exp.dueDate === '2026-09-24' && rev.dueDate === '2026-09-09' && ZD.dueOf(rev) === '2026-09-09' &&
       again.dueDate === ZD.addWorkdays('2026-09-08', 7) && again.ruleEdition === 2 && /администратор/.test(bad) &&
       !('threshold' in ZD.ruleForKind('lp-expiring')) && ZD.state.neighborSet.lp.expiringDays === 30,
    `сроки 5/10/5/10 р.д. у Госрешения и 5/10/5 у программ, «срок истекает» — день перед «Датой по» (LP-8: 24.09), ` +
    `порог 30 к.д. — настройка программ, не правила; источник — «внутренний акт»; правка срока «Рассмотреть госрешение» на 7 — ` +
    `новая редакция, выданное держит снимок (GD-12: 09.09), новое — по 7 р.д.; правит только администратор заданий`);

})();

/* ЗГ-9, ЗН-19 — неразобранная очередь: сразу руководителю подразделения роли, на 5-й р.д. — администратору */
(() => {
  ZD.seed();
  ZD.runPoll();
  const q = lastOf('gd-review', 'GD-12'); // срок 09.09, никто не берёт
  at('2026-09-10'); ZD.runPoll();
  const s1 = ZD.state.tasks.find(t => t.povodKey === `pk-overdue|task:${q.id}|никто не взял`);
  const lateAll = ZD.state.notifications.filter(n => n.taskId === q.id && n.kind === 'срок-истёк').map(n => n.to).sort().join();
  const s1sig = s1 ? ZD.state.notifications.filter(n => n.taskId === s1.id).map(n => n.kind).join() : '';
  at('2026-09-15'); ZD.runPoll();
  const before5 = !ZD.state.tasks.some(t => t.povodKey === `pk-overdue|task:${q.id}|никто не взял, 5-й р.д.`);
  at('2026-09-16'); ZD.runPoll();
  const s2 = ZD.state.tasks.find(t => t.povodKey === `pk-overdue|task:${q.id}|никто не взял, 5-й р.д.`);
  const notHolder = throws(() => ZD.reassignTask(q.id, 'E3', 'E7', 'нагрузка'));
  ZD.reassignTask(q.id, 'E8', 'E7', 'распределено руководителем');
  ZD.runPoll();
  ok(98, s1 && s1.assignee === 'E7' && s1sig === 'эскалация' && lateAll === 'E6,E8' && before5 && s2 && s2.assignee === 'E4' &&
       /носителя роли/.test(notHolder) && q.assignee === 'E8' && ZD.povodByKey(s1.povodKey).status === 'gone' && ZD.povodByKey(s2.povodKey).status === 'gone',
    `GD-12 в очереди, срок 09.09: 10.09 — сразу задание руководителю подразделения роли E7 (уведомлением «эскалация»), ` +
    `обоим носителям — «срок истёк»; 15.09 администратору ещё нет, 16.09 (5-й р.д.) — задание E4; E7 назначил из ` +
    `очереди E8 (только носителя роли) — оба повода эскалации отпали`);
})();

/* ЗГ-10 — «Черновик» и «Отклонён» поводов не дают */
(() => {
  ZD.seed();
  at('2026-09-01'); ZD.runPoll();   // GD-12 ещё черновик
  const draft = !ZD.state.povods.some(p => /GD-12/.test(p.key));
  at('2026-09-03'); ZD.runPoll();
  at('2026-09-04'); ZD.runPoll();   // GD-9 отклонён 03.09
  const rejected = !ZD.state.povods.some(p => /GD-9/.test(p.key) && p.status !== 'gone');
  ok(99, draft && rejected && ZD.ownerAt('gd', 'GD-12', '2026-09-01').status === 'Черновик' && ZD.ownerAt('gd', 'GD-9', '2026-09-04').status === 'Отклонён',
    `GD-12 в «Черновике» 01.09 — поводов нет; GD-9 «Отклонён» 03.09 — живых поводов нет`);
})();

/* ЗКП-4, ЗКП-6 — «истекает → истёк» */
(() => {
  ZD.seed();
  ZD.runPoll();
  const ing = lastOf('lp-expiring', 'LP-5'); // «Дата по» 07.09
  at('2026-09-07'); ZD.runPoll();
  const stillOn = !ZD.isTerminal(ing) && !ZD.povodByKey('lp-expired|program:LP-5|');
  at('2026-09-08'); ZD.runPoll();
  const ed = lastOf('lp-expired', 'LP-5');
  const p = ZD.povodByKey('lp-expired|program:LP-5|');
  ok(100, ing.dueDate === '2026-09-06' && stillOn && ZD.outcomeOf(ing).outcome === 'снято' && ZD.outcomeOf(ing).reason === 'перешло в истёкший' &&
       ed && !ed.repeatOf && ed.dueDate === ZD.addWorkdays('2026-09-08', 5) && p.stateDate === '2026-09-08' && /не принимаются/.test(p.traits.заявки),
    `LP-5: «Срок истекает» с 02.09 (до 07.09 ≤ 30 к.д.), срок задания 06.09; 07.09 — ещё истекает; 08.09 «Дата по» ` +
    `прошла — задание снято «перешло в истёкший», новое «Срок истёк» (${ed && ed.id}) на 5 р.д., приём заявок заблокирован`);
})();

/* ЗКП-5 — «Продлить срок»: Согласующий, только «Дата по», без смены статуса; потом — «повтор после» */
(() => {
  ZD.seed();
  ZD.runPoll();
  const t = lastOf('lp-expiring', 'LP-8');
  const notHolder = throws(() => ZD.lpExtend('LP-8', 'E3', '2027-03-31', 'приказ'));
  const noReason = throws(() => ZD.lpExtend('LP-8', 'E8', '2027-03-31', ''));
  const notActive = throws(() => ZD.lpExtend('LP-14', 'E8', '2028-01-01', 'приказ'));
  at('2026-09-09'); ZD.runPoll();   // E6 продлила до 31.03.2027
  const s = ZD.ownerAt('lp', 'LP-8', '2026-09-09');
  at('2027-03-01'); ZD.runPoll();
  const back = lastOf('lp-expiring', 'LP-8');
  ok(101, /Согласующий/.test(notHolder) && /причина/.test(noReason) && /действующ/.test(notActive) &&
       ZD.outcomeOf(t).outcome === 'исполнено' && s.status === 'Действует' && s.dateTo === '2027-03-31' &&
       back !== t && back.repeatOf === t.id && /2027/.test(ZD.calNote(back.journal[0].t, ZD.dueOf(back))),
    `продлевает только Согласующий, с причиной и только действующую; E6 продлила LP-8 09.09 — статус «Действует», ` +
    `изменилась одна «Дата по», задание «Срок истекает» исполнено; 01.03.2027 под новую дату — «повтор после ${t.id}», ` +
    `у срока отметка «${ZD.calNote(back.journal[0].t, ZD.dueOf(back))}»`);
})();

/* ЗКП-7 — бессрочная программа поводов о сроке не даёт */
(() => {
  ZD.seed();
  for (const d of ['2026-09-02', '2026-09-10', '2027-03-01']) { at(d); ZD.runPoll(); }
  ok(102, ZD.ownerAt('lp', 'LP-11', '2027-03-01').dateTo === null &&
       !ZD.state.povods.some(p => /^lp-expir/.test(p.kind) && p.objectId === 'LP-11'),
    `LP-11 без «Даты по» — ни «истекает», ни «истёк» ни на одну дату`);
})();

/* ЗКП-9 — «Сменить основание»: только на действующее решение, «Дата с» ≥ даты решения */
(() => {
  ZD.seed();
  ZD.runPoll();
  at('2026-09-04'); ZD.runPoll();
  const t = lastOf('gd-closed-live-programs', 'LP-11');
  const notActive = throws(() => ZD.lpChangeBase('LP-11', 'E8', 'GD-12', 'перевод'));
  const early = throws(() => ZD.lpChangeBase('LP-5', 'E8', 'GD-2', 'перевод'));
  ZD.take(t.id, 'E8');
  at('2026-09-15'); ZD.runPoll();   // E8 сменил основание LP-11 на GD-2
  const s = ZD.ownerAt('lp', 'LP-11', '2026-09-15');
  ok(103, /действующее/.test(notActive) && /Дата с/.test(early) && s.base === 'GD-2' && s.status === 'Действует' &&
       ZD.outcomeOf(t).outcome === 'исполнено' && ZD.outcomeOf(t).by === 'E8' && ZD.povodByKey(t.povodKey).status === 'gone',
    `основание — только действующее решение («${notActive}»), «Дата с» не раньше даты решения («${early}»); E8 взял ` +
    `задание и 15.09 сменил основание LP-11 на GD-2 — статус прежний, задание исполнено с атрибуцией`);
})();

/* ЗКП-10 — адресация только очередями и названным автором, кураторство не применяется */
(() => {
  ZD.seed();
  for (const d of ['2026-09-02', '2026-09-04', '2026-09-08']) { at(d); ZD.runPoll(); }
  const ts = ZD.state.tasks.filter(t => /^(gd|lp)-/.test(t.originKind));
  const rules = ZD.state.rules.filter(r => /^(gd|lp)-/.test(r.kind));
  ok(104, ts.length >= 10 && ts.every(t => ['очередь', 'названный', 'администратор'].includes(t.addr.via) && t.addr.by !== 'кураторство') &&
       rules.every(r => ['очередь', 'названный'].includes(r.addressee.by)) && ts.every(t => ZD.responsibleNow(t) === null),
    `${ts.length} заданий Госрешения и программ: адресат — очередь роли или названный поводом автор (без автора — ` +
    `администратор); формулы через кураторство ни у одного правила нет`);
})();

/* ЗКП-11 — два повода на одну программу — два независимых задания; закрытие снимает оба */
(() => {
  ZD.seed();
  for (const d of ['2026-09-02', '2026-09-04', '2026-09-08']) { at(d); ZD.runPoll(); }
  const a = lastOf('gd-closed-live-programs', 'LP-5'), b = lastOf('lp-expired', 'LP-5');
  const both = !ZD.isTerminal(a) && !ZD.isTerminal(b) && a.id !== b.id;
  ZD.take(b.id, 'E6');
  at('2026-09-10'); ZD.runPoll();   // E8 закрыл LP-5
  ok(105, both && ZD.outcomeOf(a).outcome === 'исполнено' && ZD.outcomeOf(a).by === 'E8' &&
       ZD.outcomeOf(b).outcome === 'исполнено · выполнил другой' && ZD.outcomeOf(b).by === 'E8',
    `на LP-5 08.09 открыты два задания — «закрыто, а программа действует» (${a.id}) и «срок истёк» (${b.id}); ` +
    `E8 закрыл программу 10.09 — закрылись оба с атрибуцией (второе брала E6 — «выполнил другой»)`);
})();

/* ЗГ-11, ЗКП-12 — без пересечения с документооборотом */
(() => {
  ZD.seed();
  const kinds = ZD.state.povodKinds.filter(k => /^(gd|lp)-/.test(k.id));
  const docs = ZD.state.povodKinds.filter(k => /^doc-/.test(k.id));
  ok(106, kinds.length === 8 && kinds.every(k => ['gosreshenie', 'program'].includes(k.objectType)) &&
       docs.length === 11 && docs.every(k => ['document', 'resolution', 'issue'].includes(k.objectType)),
    `виды Госрешения и программ — над карточкой решения и программы, не над документом; виды «документ» — над ` +
    `документом, резолюцией и выдачей — входящий акт даёт свои шаги отдельно`);
})();

/* ЗН-21 — «чей повод» в строке статистике */
(() => {
  ZD.seed();
  ZD.runPoll();
  at('2026-09-04'); ZD.runPoll();
  const rows = ZD.taskRows();
  const own = k => (rows.find(r => r.kind === k) || {}).owner;
  ok(107, own('gd-review') === 'Госрешение' && own('gd-closed-live-programs') === 'Госрешение' && own('lp-expiring') === 'Кредитные программы' &&
       own('pk-rep-obligation-overdue') === 'Отчётность' && own('pk-overdue') === 'Задания' && rows.filter(r => r.kind === null).every(r => r.owner === null),
    `строка задания несёт «чей повод»: Госрешение, Кредитные программы, Отчётность, сами Задания; у свободного — пусто`);
})();

/* ---------- S. Заявка — шаги на передачах работы, поводы по данным, адресат эскалации ---------- */
const apTasks = (kind, app, sub) => ZD.state.tasks.filter(t => t.povodKey === `${kind}|application:${app}${sub ? '·' + sub : ''}|`);
const apLast = (kind, app, sub) => { const a = apTasks(kind, app, sub); return a[a.length - 1]; };
const pollOn = (...ds) => ds.forEach(d => { at(d); ZD.runPoll(); });
const AP_STEP_KINDS = ['ap-confirm','ap-conclusion','ap-prelim','ap-vote','ap-decide','ap-supplement','ap-form-credit','ap-bind','ap-register'];
const AP_DATA_KINDS = ['ap-program-closed','ap-stuck-new','ap-doc-expired'];

/* ЗЗ-1 — седьмой источник, оба рода поводов записями реестра */
(() => {
  ZD.seed();
  const ap = ZD.SOURCES.find(s => s.id === 'apps');
  const wired = ap.kinds.every(k => { const kd = ZD.kindOf(k), r = ZD.ruleForKind(k), a = r && ZD.actionOf(r.action);
    return kd && kd.ownerExec && kd.objectType === 'application' && r.mode === 'авто' && a && a.where; });
  ok(108, ZD.SOURCES.length === 10 && ZD.SOURCES[6] === ap && ap.pollEveryMin === 5 && ap.kinds.length === 12 &&
       AP_STEP_KINDS.every(k => ap.kinds.includes(k)) && AP_DATA_KINDS.every(k => ap.kinds.includes(k)) && wired &&
       ZD.checkRegistry().length === 0 && ZD.ownerOfKind('ap-vote') === 'Заявки',
    `Заявки — седьмой источник, опрос 5 мин: девять шагов на передачах работы и три повода по данным заведены записями ` +
    `трёх реестров, у каждого действия — где делается работа; реестр сходится`);
})();

/* ЗЗ-2 — шаги только на передачах: свой «Новый» задания не даёт; форма адресата по шагу */
(() => {
  ZD.seed();
  pollOn('2026-09-02');
  const own = ['AP-103', 'AP-107'].every(id => !ZD.state.povods.some(p => p.objectId === id));
  const gf = apLast('ap-confirm', 'AP-102');
  pollOn('2026-09-03', '2026-09-04', '2026-09-08');
  const back = apLast('ap-supplement', 'AP-106');
  const form = k => ZD.kindOf(k).addrForm;
  ok(109, own && gf && ZD.inQueue(gf) && back && back.assignee === 'E3' &&
       ['ap-confirm','ap-conclusion','ap-prelim'].every(k => form(k) === 'очередь') && ['ap-vote','ap-decide'].every(k => form(k) === 'названный') &&
       ['ap-supplement','ap-form-credit','ap-bind','ap-register'].every(k => form(k) === 'формула'),
    `02.09 AP-103 и AP-107 — свой черновик в «Новый», поводов нет; AP-102 ушла ГФ — шаг «Подтвердить комплект» в очереди; ` +
    `AP-106 вернулась специалисту 08.09 — «Дополнить заявку» E3; ГФ, отдел, изучение — очереди, голос и решение — ` +
    `названные, шаги специалиста — формула`);
})();

/* ЗЗ-3 — адресат шагов специалиста — формула кураторства «специалист заявки» */
(() => {
  ZD.seed();
  pollOn('2026-09-02');
  const sup = apLast('ap-supplement', 'AP-104');
  const first = sup.assignee, formula = sup.addr.by === 'кураторство' && sup.addr.role === 'специалист заявки';
  pollOn('2026-09-03', '2026-09-04', '2026-09-08');
  const moved = sup.assignee === 'E3' && sup.journal.some(e => e.ev === 'переадресовано') && ZD.responsibleNow(sup) === 'E3';
  pollOn('2026-09-09');
  const stuck = apLast('ap-stuck-new', 'AP-107');
  at('2026-09-10');
  const pc = apLast('ap-program-closed', 'AP-105'); // E1 в командировке, замещает E3
  const subst = pc.assignee === 'E1' && ZD.visibleTo(pc, 'E3') && ZD.canActFor(pc, 'E3');
  const queues = apLast('ap-conclusion', 'AP-101', 'отдел:risk').queue.role === 'ap-dept-risk' &&
    apLast('ap-conclusion', 'AP-101', 'отдел:credit').queue.role === 'ap-dept-credit' && apLast('ap-prelim', 'AP-101').queue.role === 'ap-commission';
  const named = apLast('ap-decide', 'AP-101').assignee === 'E12' && apLast('ap-vote', 'AP-101', 'член:E5').assignee === 'E5';
  ok(110, formula && first === 'E1' && moved && stuck.addr.via === 'запасной' && stuck.addr.responsible === 'E2' && stuck.assignee === 'E5' &&
       subst && queues && named,
    `«Дополнить заявку» AP-104 — формулой «специалист заявки»: 02.09 E1, 08.09 закрепление сменилось — непринятое ` +
    `переадресовано E3; AP-107 без закрепления — запасной (руководитель E2, в отпуске — действует E5); E1 в командировке — ` +
    `её задание видит и ведёт E3; отделы — своими очередями, изучение — «Комиссия», решение — председатель E12, голос — член`);
})();

/* ЗЗ-4 — голос: срок записи комиссии, лично, просрочка — председателю уведомлением, без эскалации и переназначения */
(() => {
  ZD.seed();
  pollOn('2026-09-02', '2026-09-09');
  const votes = ['E12', 'E5', 'E8', 'E1'].map(m => apLast('ap-vote', 'AP-101', 'член:' + m));
  const due = votes.every(t => t.dueDate === '2026-09-11' && ZD.lastEv(t) === 'принято');
  const e1 = votes[3];
  at('2026-09-10');
  const personal = !ZD.visibleTo(e1, 'E3') && !ZD.canActFor(e1, 'E3') && ZD.actingFor('E1', '2026-09-10') === 'E3';
  pollOn('2026-09-10', '2026-09-15');
  const n = ZD.state.notifications.filter(x => x.taskId === e1.id).map(x => x.kind + ':' + x.to);
  const chairOwn = ZD.state.notifications.some(x => x.taskId === votes[0].id && (x.kind === 'срок-истёк' || x.kind === 'эскалация'));
  const noReassign = throws(() => ZD.reassignTask(e1.id, 'E3', 'E4', 'командировка'));
  const noExtend = throws(() => ZD.requestExtension(e1.id, 'E1', '2026-09-25', 'командировка'));
  const app = ZD.state.owner.ap.find(o => o.id === 'AP-101');
  app.ev = app.ev.filter(e => e.t < '2026-09-16'); // решение не вынесено — голос E1 так и не подан
  pollOn('2026-09-22');
  const general = ZD.state.tasks.some(t => t.povodKey && t.povodKey.indexOf(`task:${e1.id}|`) !== -1);
  ok(111, due && personal && n.includes('срок-истёк:E1') && n.includes('эскалация:E12') && !chairOwn && /не переназначается/.test(noReassign) && /владелец/.test(noExtend) &&
       !general && ZD.kindOf('ap-vote').personal && ZD.kindOf('ap-vote').escalate.to === 'уведомление',
    `AP-101: четыре голоса со сроком «Крайний срок» 11.09; голос E1 — лично: замещающий E3 его не видит; 15.09 E1 — ` +
    `«срок истёк», председателю E12 — «эскалация»; E12 голосовал 11.09 — ему сигнала нет; переназначить нельзя («${noReassign}»), ` +
    `продлить в заданиях — тоже («${noExtend}»); ` +
    `на 22.09 (> 5 р.д.) задания руководителю нет`);
})();

/* ЗЗ-5 — три повода по данным, адресат — формула */
(() => {
  ZD.seed();
  pollOn('2026-09-02', '2026-09-04');
  const pc = ZD.povodByKey('ap-program-closed|application:AP-103|');
  pollOn('2026-09-08');
  const stuck8 = !!ZD.povodByKey('ap-stuck-new|application:AP-107|');
  const doc = ZD.povodByKey('ap-doc-expired|application:AP-104|'), docT = apLast('ap-doc-expired', 'AP-104');
  pollOn('2026-09-09');
  const st = ZD.povodByKey('ap-stuck-new|application:AP-107|');
  const ts = AP_DATA_KINDS.map(k => ZD.state.tasks.find(t => t.originKind === k));
  ok(112, pc && pc.stateDate === '2026-09-04' && pc.traits.причина === 'основание закрыто' && apLast('ap-program-closed', 'AP-103').assignee === 'E3' &&
       !stuck8 && st && st.stateDate === '2026-09-09' && st.traits.без_событий_раб_дней === 10 &&
       doc && doc.stateDate === '2026-09-08' && /Орозбекова/.test(doc.traits.документы) && docT.assignee === 'E3' &&
       ts.every(t => t && t.addr.role === 'специалист заявки'),
    `«программа не принимает» AP-103 с 04.09 (основание LP-11 закрыто) — E3; «застряла в „Новый“» AP-107 — 08.09 ещё нет, ` +
    `09.09 (10 р.д. без событий) — есть; «документ просрочен» AP-104 с 08.09 — E3; все три — формулой «специалист заявки»`);
})();

/* ЗЗ-6 — перевести или отозвать: «Сменить программу», гейт «Сформировать кредит» */
(() => {
  ZD.seed();
  pollOn('2026-09-02', '2026-09-03', '2026-09-04');
  at('2026-09-10');
  const gate = throws(() => ZD.apStep('AP-105', 'E3', 'сформировать кредит'));
  const review = throws(() => ZD.apStep('AP-101', 'E1', 'сменить программу', 'LP-8', 'перевод'));
  const closed = throws(() => ZD.apStep('AP-104', 'E3', 'сменить программу', 'LP-5', 'перевод'));
  const noWhy = throws(() => ZD.apStep('AP-104', 'E3', 'сменить программу', 'LP-14', ''));
  ZD.runPoll();
  const a103 = apLast('ap-program-closed', 'AP-103');
  pollOn('2026-09-15');
  const a105 = apLast('ap-program-closed', 'AP-105');
  pollOn('2026-09-16');
  ok(113, /не принимает/.test(gate) && /сначала возврат/.test(review) && /принимать заявки/.test(closed) && /причина/.test(noWhy) &&
       ZD.outcomeOf(a103).outcome === 'исполнено' && ZD.outcomeOf(a103).by === 'E3' &&
       ZD.outcomeOf(a105).outcome === 'снято' && ZD.outcomeOf(a105).reason === 'программа снова принимает заявки' &&
       ZD.ownerAt('ap', 'AP-105', '2026-09-16').status === 'Ожидает решения/программы' && !!apLast('ap-bind', 'AP-105'),
    `кредит по LP-11, которая не принимает заявки, не формируется («${gate}»); на рассмотрении программу не сменить ` +
    `(«${review}»), на закрытую — тоже; AP-103: E3 сменила программу 10.09 — задание исполнено; AP-105: 15.09 основание ` +
    `LP-11 сменено — «снято: программа снова принимает заявки», 16.09 кредит сформирован (поток B) — шаг «Привязать решение и программу»`);
})();

/* ЗЗ-7 — отзыв, удаление, отклонение: шаги отпадают с атрибуцией */
(() => {
  ZD.seed();
  pollOn('2026-09-02', '2026-09-03', '2026-09-04');
  const del = ['отдел:risk', 'отдел:credit'].map(x => apLast('ap-conclusion', 'AP-108', x));
  const pre = apLast('ap-prelim', 'AP-106');
  const noClaim = throws(() => ZD.claim(pre.id, null, 'E13')), noRelease = throws(() => ZD.releaseTask(pre.id, 'E4', 'лишнее'));
  ZD.apStep('AP-106', 'E3', 'отозвать');
  ZD.runPoll();
  const apIds = ZD.state.tasks.filter(t => /^ap-/.test(t.originKind));
  ok(114, del.every(t => ZD.outcomeOf(t).outcome === 'снято' && ZD.outcomeOf(t).reason === 'заявка удалена') &&
       ZD.outcomeOf(pre).outcome === 'снято' && ZD.outcomeOf(pre).reason === 'отозвано специалистом' &&
       /владельц/.test(noClaim) && /владел/.test(noRelease) && apIds.every(t => !t.journal.some(e => e.ev === 'отпало')),
    `AP-108 удалена 04.09 — оба задания отделов «снято: заявка удалена»; AP-106 отозвана — изучение «снято: отозвано ` +
    `специалистом»; «Заявить» и «Снять» отбиты; «отпало — ждёт разбора» у шагов заявки не бывает`);
})();

/* ЗЗ-8 — возврат комиссией: сброшенные ГФ и заключения при новой отправке — «повтор после» */
(() => {
  ZD.seed();
  pollOn('2026-09-02', '2026-09-03', '2026-09-04', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-15');
  const pairs = [['ap-confirm'], ['ap-conclusion', 'отдел:risk'], ['ap-conclusion', 'отдел:credit'], ['ap-prelim']]
    .map(([k, x]) => apTasks(k, 'AP-106', x));
  ok(115, pairs.every(a => a.length === 2 && a[1].repeatOf === a[0].id && a[1].repeatCount === 1 && ZD.isTerminal(a[0])),
    `AP-106 возвращена 08.09 «Запросить замену» — ГФ и заключения сброшены; 09.09 комплект снова у ГФ, 10.09 — снова у ` +
    `отделов, 15.09 — снова в комиссии: четыре новых задания «повтор после» (${pairs.map(a => a[1].id + '←' + a[0].id).join(', ')})`);
})();

/* ЗЗ-9 — член комиссии по своей заявке: пометка, не блокирует */
(() => {
  ZD.seed();
  pollOn('2026-09-02', '2026-09-09');
  const own = apLast('ap-vote', 'AP-101', 'член:E1'), other = apLast('ap-vote', 'AP-101', 'член:E5');
  at('2026-09-10');
  ZD.apStep('AP-101', 'E1', 'проголосовать');
  ZD.runPoll();
  ok(116, own.mark === 'по своей заявке' && !other.mark && ZD.outcomeOf(own).outcome === 'исполнено' && ZD.outcomeOf(own).by === 'E1',
    `AP-101 подала E1, она же член комиссии: её задание «Проголосовать» с пометкой «${own.mark}», у других членов пометки ` +
    `нет; голос не заблокирован — E1 проголосовала, задание исполнено`);
})();

/* ЗЗ-10 — групповая заявка, ключ, частота */
(() => {
  ZD.seed();
  pollOn('2026-09-02', '2026-09-03', '2026-09-08', '2026-09-09');
  const keys = ['ap-vote|application:AP-101·член:E5|', 'ap-conclusion|application:AP-106·отдел:risk|', 'ap-confirm|application:AP-102|'];
  const group = ZD.state.povods.filter(p => p.objectId === 'AP-104' && p.kind === 'ap-doc-expired');
  ok(117, keys.every(k => ZD.povodByKey(k)) && group.length === 1 && group[0].traits.группа === '3 чл.' &&
       ZD.state.povods.filter(p => /^ap-/.test(p.kind)).every(p => /^ap-[a-z-]+\|application:AP-\d+(·(отдел|член):[A-Za-z0-9]+)?\|$/.test(p.key)) &&
       ZD.silenceThreshold(ZD.SOURCES.find(s => s.id === 'apps')) === 30,
    `ключ «вид · заявка:id», у заключения и голоса — плюс отдел / член, период пуст (${keys.join(', ')}); групповая AP-104 ` +
    `(3 чл.) — один повод на заявку, а не на члена; опрос 5 мин, порог молчания 30 мин`);
})();

/* ЗЗ-11 — без пересечения с документооборотом */
(() => {
  ZD.seed();
  const kinds = ZD.state.povodKinds.filter(k => /^ap-/.test(k.id));
  ok(118, kinds.length === 12 && kinds.every(k => k.objectType === 'application') &&
       ZD.state.povodKinds.filter(k => /^doc-/.test(k.id)).every(k => k.objectType !== 'application'),
    `двенадцать видов заявки — над карточкой заявки; виды «документ» над заявкой не заводятся, «документ просрочен» — состояние заявки`);
})();

/* ЗЗ-12 — сроки: значения правил, норма где есть, срок владельца у голоса и решения */
(() => {
  ZD.seed();
  pollOn('2026-09-02', '2026-09-09');
  const r = k => ZD.ruleForKind(k);
  const wd = ['ap-confirm','ap-conclusion','ap-prelim','ap-form-credit','ap-bind','ap-register'].map(k => r(k).dueN).join('/');
  const data = AP_DATA_KINDS.map(k => r(k).dueN).join('/');
  const sup = apLast('ap-supplement', 'AP-104'), dec = apLast('ap-decide', 'AP-101');
  const named = throws(() => setRule('rule-ap-vote', 'dueN', 5, 'E4'));
  const thr = throws(() => setRule('rule-ap-stuck-new', 'threshold', 12, 'E4'));
  ok(119, wd === '2/3/3/2/30/10' && data === '5/5/5' && r('ap-supplement').dueN === 1 && r('ap-supplement').dueUnit === 'month' &&
       r('ap-supplement').dueSource === 'Типовое положение, п. 66' && r('ap-vote').dueUnit === 'named' && r('ap-decide').dueUnit === 'named' &&
       r('ap-confirm').dueSource === 'внутренний акт' && sup.dueDate === '2026-10-02' && dec.dueDate === '2026-09-16' &&
       /не настраивается/.test(named) && /настройка соседа/.test(thr) && !('threshold' in r('ap-stuck-new')) &&
       r('ap-stuck-new').editions.length === 1 && ZD.state.neighborSet.ap.stuckWd === 10,
    `ГФ 2, заключение 3, изучение 3, сформировать 2, привязать 30, зарегистрировать 10 р.д.; поводы — 5 р.д.; порог застоя 10 р.д. — ` +
    `настройка заявок, в правиле его нет и правкой правила он не меняется; «Дополнить» — 1 к.м. по норме (AP-104: 02.09 → 02.10); ` +
    `решение — дата заседания (AP-101: 16.09); срок голоса называет запись комиссии и не настраивается`);
})();

/* ЗЗ-13 — истёк «Дополнить» — задание очереди «Комиссия», не эскалация руководителю */
(() => {
  ZD.seed();
  pollOn('2026-09-02', '2026-09-08', '2026-10-02');
  const sup = apLast('ap-supplement', 'AP-104');
  const early = ZD.state.tasks.some(t => t.esc);
  pollOn('2026-10-05');
  const esc = ZD.state.tasks.find(t => t.esc && t.povodKey === `pk-overdue|task:${sup.id}|недостатки не устранены`);
  const toHolders = esc && ZD.state.notifications.filter(n => n.taskId === esc.id && n.kind === 'эскалация').map(n => n.to).sort().join();
  const late = ZD.state.notifications.some(n => n.taskId === sup.id && n.kind === 'срок-истёк' && n.to === 'E3');
  pollOn('2026-10-12');
  const general = ZD.state.tasks.some(t => t.povodKey === `pk-overdue|task:${sup.id}|`);
  const notRole = throws(() => ZD.apStep('AP-104', 'E2', 'отклонить за неустранение недостатков', null, 'п. 66'));
  const noWhy = throws(() => ZD.apStep('AP-104', 'E13', 'отклонить за неустранение недостатков', null, ''));
  const noClaim = esc && throws(() => ZD.claim(esc.id, null, 'E13'));
  ZD.apStep('AP-104', 'E13', 'отклонить за неустранение недостатков', null, 'недостатки не устранены за месяц');
  ZD.runPoll(); ZD.runPoll();
  ok(120, sup.dueDate === '2026-10-02' && !early && esc && ZD.inQueue(esc) && esc.queue.role === 'ap-commission' && esc.action === 'act-ap-reject-unfixed' &&
       toHolders === 'E12,E13' && late && !general && /Комиссия/.test(notRole) && /причина/.test(noWhy) && /владельц/.test(noClaim) &&
       ZD.outcomeOf(sup).outcome === 'снято' && ZD.outcomeOf(esc).outcome === 'исполнено' && ZD.outcomeOf(esc).by === 'E13' &&
       ZD.ownerAt('ap', 'AP-104', '2026-10-12').status === 'Отклонена',
    `«Дополнить» AP-104 до 02.10: 02.10 ещё в срок; 05.10 — E3 «срок истёк», очереди «Комиссия» (E12, E13) — задание ` +
    `«Отклонить за неустранение недостатков» ${esc && esc.id}; руководителю задания нет и на 12.10; отклоняет носитель ` +
    `роли с причиной; E13 отклонила — «Дополнить» снято, задание комиссии исполнено (E13)`);
})();

/* ЗЗ-14 — неразобранные очереди заявки — по общему правилу, администратор — модуля заявок */
(() => {
  ZD.seed();
  pollOn('2026-09-02', '2026-09-04', '2026-09-08');
  const q = apLast('ap-confirm', 'AP-102'); // срок 04.09, никто не берёт
  const s1 = ZD.state.tasks.find(t => t.povodKey === `pk-overdue|task:${q.id}|никто не взял`);
  const late = ZD.state.notifications.filter(n => n.taskId === q.id && n.kind === 'срок-истёк').map(n => n.to).join();
  pollOn('2026-09-15');
  const s2 = ZD.state.tasks.find(t => t.povodKey === `pk-overdue|task:${q.id}|никто не взял, 5-й р.д.`);
  pollOn('2026-09-16');
  ok(121, q.dueDate === '2026-09-04' && s1 && s1.assignee === 'E10' && late === 'E9' && s2 && s2.assignee === 'E4' &&
       ZD.SOURCES.find(s => s.id === 'apps').ownerAdmin === 'E4' && ZD.outcomeOf(q).outcome === 'исполнено' && ZD.outcomeOf(q).by === 'E9',
    `AP-102 у ГФ с 02.09, срок 04.09: 08.09 — задание руководителю ГФ E10, носителю E9 — «срок истёк»; 15.09 (5-й р.д.) — ` +
    `администратору модуля заявок E4; 16.09 E9 подтвердила комплект — задание очереди исполнено`);
})();

/* атрибуция у владельца: замещение, «выполнил другой», голос без голоса */
(() => {
  ZD.seed();
  pollOn('2026-09-02', '2026-09-09', '2026-09-10', '2026-09-15', '2026-09-16');
  const reg = apLast('ap-register', 'AP-109'), e = reg.journal[reg.journal.length - 1];
  const stuck = apLast('ap-stuck-new', 'AP-107'), vote = apLast('ap-vote', 'AP-101', 'член:E1');
  ok(122, ZD.outcomeOf(reg).outcome === 'исполнено' && e.by === 'E3' && e.for === 'E1' &&
       ZD.outcomeOf(stuck).outcome === 'исполнено · выполнил другой' && ZD.outcomeOf(stuck).by === 'E3' &&
       ZD.outcomeOf(vote).outcome === 'снято' && ZD.outcomeOf(vote).reason === 'одобрено комиссией',
    `AP-109: договоры 10.09 зарегистрировала E3 за E1 (командировка) — «исполнено»; AP-107: застой у запасного E5, ` +
    `возобновила E3 — «исполнено · выполнил другой»; голос E1 по AP-101 не подан, 16.09 решение вынесено — «снято: одобрено комиссией»`);
})();

/* «чей повод» и сверка реестра у адресата эскалации */
(() => {
  ZD.seed();
  pollOn('2026-09-02');
  const rows = ZD.taskRows().filter(r => r.kind && /^ap-/.test(r.kind));
  ZD.kindOf('ap-supplement').escalate = Object.assign({}, ZD.kindOf('ap-supplement').escalate, { role: 'нет-такой' });
  const errs = ZD.checkRegistry();
  ok(123, rows.length >= 5 && rows.every(r => r.owner === 'Заявки') && errs.some(e => /адресат эскалации/.test(e)),
    `строки заданий заявки несут «чей повод» — Заявки; сверка реестра ловит адресата эскалации с незаведённой очередью`);
})();

/* ---------- T. Подключение документооборота (волна макета 10) ---------- */
const docTasks = (kind, obj, sub) => ZD.state.tasks.filter(t => t.povodKey === `${kind}|${obj}${sub ? '·' + sub : ''}|`);
const docLast = (kind, obj, sub) => { const a = docTasks(kind, obj, sub); return a[a.length - 1]; };
const DOC_STEP_DUES = { 'doc-revise': 3, 'doc-approve': 2, 'doc-sign': 2, 'doc-register': 1, 'doc-dispatch': 2, 'doc-review': 2,
  'doc-control': 2, 'doc-acquaint': 3, 'doc-file': 5 };

/* восьмой источник записями трёх реестров; формы адресата — реквизиты вида */
(() => {
  ZD.seed();
  const doc = ZD.SOURCES.find(s => s.id === 'docs');
  const wired = doc.kinds.every(k => { const kd = ZD.kindOf(k), r = ZD.ruleForKind(k), a = r && ZD.actionOf(r.action);
    return kd && kd.ownerExec && r.mode === 'авто' && !r.controller && a && a.where && ZD.ownerOfKind(k) === 'Документооборот'; });
  const queue = doc.kinds.filter(k => ZD.kindOf(k).addrForm === 'очередь');
  const named = doc.kinds.filter(k => ZD.kindOf(k).addrForm === 'названный');
  const personal = doc.kinds.filter(k => ZD.kindOf(k).personal);
  ok(124, ZD.SOURCES.length === 10 && ZD.SOURCES[7] === doc && doc.pollEveryMin === 5 && doc.silenceMin === 30 && ZD.silenceThreshold(doc) === 30 &&
       doc.ownerAdmin === 'E18' && doc.kinds.length === 11 && wired && ZD.checkRegistry().length === 0 &&
       queue.join() === 'doc-register,doc-dispatch,doc-file' && queue.every(k => ZD.kindOf(k).take === 'через очередь') &&
       named.length === 8 && named.every(k => ZD.kindOf(k).take === 'не нужно') && personal.join() === 'doc-sign' &&
       ZD.ruleForKind('doc-register').addressee.role === 'doc-registrar' && ZD.ruleForKind('doc-file').addressee.role === 'doc-archivist',
    `Документооборот — восьмой источник, опрос 5 мин, порог молчания объявлен 30 мин, администратор владельца E18; одиннадцать ` +
    `видов записями трёх реестров, исполнение у владельца, контролёра заданий нет; очередь роли — регистрация, отправка ` +
    `(«Регистратор») и сдача в дело («Архивариус»), остальные восемь — названный поводом без принятия, «лично» — только подпись`);
})();

/* ключ шва: документ × участник, резолюция × исполнитель, резолюция, выдача */
(() => {
  ZD.seed();
  pollOn('2026-09-02', '2026-09-03', '2026-09-04', '2026-09-10', '2026-09-15', '2026-09-16', '2026-10-05');
  const keys = ZD.state.povods.filter(p => /^doc-/.test(p.kind)).map(p => p.key);
  const shape = keys.every(k => /^doc-[a-z]+\|(document:D-\d+(·(согласующий|получатель):E\d+)?|resolution:R-\d+(·исполнитель:E\d+)?|issue:V-\d+)\|$/.test(k));
  const want = ['doc-approve|document:D-201·согласующий:E2|', 'doc-review|document:D-202·получатель:E7|', 'doc-execute|resolution:R-1·исполнитель:E6|',
    'doc-execute|resolution:R-1·исполнитель:E8|', 'doc-control|resolution:R-2|', 'doc-return|issue:V-1|', 'doc-sign|document:D-201|',
    'doc-register|document:D-201|', 'doc-file|document:D-203|'];
  const p = ZD.povodByKey('doc-execute|resolution:R-1·исполнитель:E6|');
  ok(125, shape && want.every(k => keys.includes(k)) && p.objectType === 'resolution' && p.objectId === 'R-1' && p.ownerId === 'D-202',
    `ключ — «вид · объект», у шага на участника — плюс участник: согласующий, получатель, исполнитель резолюции; контроль — ` +
    `резолюция, возврат — выдача, подпись, регистрация и дело — документ; период пуст; объект повода — резолюция R-1, ` +
    `карточка — документ D-202`);
})();

/* названный поводом: без «Взять в работу», замещение на выдачу */
(() => {
  ZD.seed();
  pollOn('2026-09-02');
  const a2 = docLast('doc-approve', 'document:D-201', 'согласующий:E2'), a14 = docLast('doc-approve', 'document:D-201', 'согласующий:E14');
  const noTake = throws(() => ZD.take(a14.id, 'E14'));
  ok(126, a2.assignee === 'E5' && a2.addr.responsible === 'E2' && a2.addr.subst && a14.assignee === 'E14' &&
       ZD.lastEv(a2) === 'принято' && ZD.lastEv(a14) === 'принято' && /не нужно/.test(noTake) && a2.dueDate === '2026-09-04' &&
       !a2.controller && !ZD.inQueue(a2),
    `D-201 на согласовании 02.09: согласующих назвал автор — E2 (в отпуске, действует E5 — замещение на выдачу) и E14; ` +
    `задание сразу в работе, «Взять в работу» — отказ «${noTake}»; срок 2 р.д. — 04.09; контролёра нет`);
})();

/* круг согласования: отказ закрывает свой шаг, сбрасывает чужие; второй круг — «повтор после» */
(() => {
  ZD.seed();
  pollOn('2026-09-02', '2026-09-03');
  const a2 = docTasks('doc-approve', 'document:D-201', 'согласующий:E2')[0], a14 = docTasks('doc-approve', 'document:D-201', 'согласующий:E14')[0];
  const rev = docLast('doc-revise', 'document:D-201');
  pollOn('2026-09-08');
  const n2 = docLast('doc-approve', 'document:D-201', 'согласующий:E2'), n14 = docLast('doc-approve', 'document:D-201', 'согласующий:E14');
  ok(127, ZD.outcomeOf(a14).outcome === 'исполнено' && ZD.outcomeOf(a14).by === 'E14' &&
       ZD.outcomeOf(a2).outcome === 'снято' && ZD.outcomeOf(a2).reason === 'круг сброшен: отказ Орозов Н.К.' &&
       rev && rev.assignee === 'E3' && rev.dueDate === '2026-09-08' && ZD.outcomeOf(rev).outcome === 'исполнено' && ZD.outcomeOf(rev).by === 'E3' &&
       n2 !== a2 && n2.repeatOf === a2.id && n2.repeatCount === 1 && n14.repeatOf === a14.id && n14.repeatCount === 1,
    `03.09 E14 отказал — его шаг исполнен (отказ — решение), шаг E2 снят «круг сброшен: отказ Орозов Н.К.», автору E3 — ` +
    `«Доработать» до 08.09; 08.09 снова на согласовании — «Доработать» исполнено, по ключам «документ × согласующий» — ` +
    `новые задания «повтор после» ${a2.id} и ${a14.id}`);
})();

/* исполнение у владельца: ни «сдано», ни «Снять» — шаг убирает документ */
(() => {
  ZD.seed();
  pollOn('2026-09-02');
  const t = docLast('doc-review', 'document:D-202', 'получатель:E7');
  const noClaim = throws(() => ZD.claim(t.id, null, 'E7'));
  const noRelease = throws(() => ZD.releaseTask(t.id, 'E4', 'не нужно'));
  pollOn('2026-09-03');
  ok(128, /владельц/.test(noClaim) && /снять нельзя/.test(noRelease) && ZD.outcomeOf(t).outcome === 'исполнено' && ZD.outcomeOf(t).by === 'E7' &&
       t.journal[t.journal.length - 1].how === 'дана резолюция R-1',
    `«Рассмотреть входящий» Вх-342 у E7: заявить — отказ («${noClaim}»), снять автору правила — отказ; 03.09 E7 дал ` +
    `резолюцию в карточке документа — задание закрыто «исполнено» с атрибуцией «дана резолюция R-1»`);
})();

/* очередь «Регистратор» и «Архивариус»: взял один — сделал другой */
(() => {
  ZD.seed();
  pollOn('2026-09-02', '2026-09-10', '2026-09-15');
  const reg = docLast('doc-register', 'document:D-201');
  const seen = ZD.visibleTo(reg, 'E15') && ZD.visibleTo(reg, 'E20') && !ZD.visibleTo(reg, 'E19');
  ZD.take(reg.id, 'E15');
  const f2 = docLast('doc-file', 'document:D-202'), f3 = docLast('doc-file', 'document:D-203');
  pollOn('2026-09-16');
  ok(129, seen && reg.dueDate === '2026-09-16' && reg.assignee === 'E15' &&
       ZD.outcomeOf(reg).outcome === 'исполнено · выполнил другой' && ZD.outcomeOf(reg).by === 'E20' &&
       f2 && f2.queue.role === 'doc-archivist' && ZD.outcomeOf(f2).outcome === 'исполнено' && ZD.outcomeOf(f2).by === 'E19' &&
       ZD.outcomeOf(f3).outcome === 'исполнено · выполнил другой' && ZD.outcomeOf(f3).by === 'E15',
    `D-201 подписан 15.09: задание «Зарегистрировать» видят оба регистратора (E15, E20), не архивариус; взяла E15, ` +
    `16.09 зарегистрировал E20 — «исполнено · выполнил другой»; в дело D-202 сдала архивариус E19, не взяв — «исполнено», ` +
    `D-203 сдала регистратор E15 из очереди «Архивариус» — «выполнил другой»`);
})();

/* неразобранная очередь регистратора: сразу — заведующей канцелярией, на 5-й р.д. — администратору документооборота */
(() => {
  ZD.seed();
  pollOn('2026-09-08', '2026-09-09', '2026-09-10');
  const q = docLast('doc-register', 'document:D-208');
  const s1 = ZD.state.tasks.find(t => t.povodKey === `pk-overdue|task:${q.id}|никто не взял`);
  const late = ZD.state.notifications.filter(n => n.taskId === q.id && n.kind === 'срок-истёк').map(n => n.to).sort().join();
  pollOn('2026-09-15');
  const early2 = ZD.state.tasks.some(t => t.povodKey === `pk-overdue|task:${q.id}|никто не взял, 5-й р.д.`);
  pollOn('2026-09-16');
  const s2 = ZD.state.tasks.find(t => t.povodKey === `pk-overdue|task:${q.id}|никто не взял, 5-й р.д.`);
  ok(130, q.dueDate === '2026-09-09' && s1 && s1.assignee === 'E17' && late === 'E15,E20' && !early2 && s2 && s2.assignee === 'E18' &&
       ZD.inQueue(q),
    `D-208 подписан 08.09, срок регистрации 09.09, никто не взял: 10.09 — задание «никто не взял» заведующей канцелярией ` +
    `E17, обоим регистраторам — «срок истёк»; 16.09 (5-й р.д.) — администратору документооборота E18`);
})();

/* аннулирование и удаление — «снято» с причиной документа */
(() => {
  ZD.seed();
  pollOn('2026-09-03', '2026-09-04', '2026-09-08', '2026-09-10');
  const dis = docLast('doc-dispatch', 'document:D-207'), rev = docLast('doc-revise', 'document:D-206');
  const noAnnul = throws(() => ZD.docStep('D-201', 'E15', 'аннулировать', null, 'ошибка'));
  ok(131, ZD.outcomeOf(dis).outcome === 'снято' && ZD.outcomeOf(dis).reason === 'аннулирован: регистрация по ошибке — дубль Исх-111' &&
       ZD.outcomeOf(rev).outcome === 'снято' && ZD.outcomeOf(rev).reason === 'черновик удалён' && ZD.ownerAt('doc', 'D-206', '2026-09-10') === null &&
       !!noAnnul,
    `Исх-112 аннулирован 08.09 — «Отправить» снято с основанием документа; черновик D-206 удалён 10.09 — «Доработать» снято ` +
    `«черновик удалён»; неотправленный не аннулируется вне этапа («${noAnnul}»)`);
})();

/* резолюция: собственный срок повода, продление — в заданиях, утверждает автор резолюции */
(() => {
  ZD.seed();
  pollOn('2026-09-03');
  const t = docLast('doc-execute', 'resolution:R-1', 'исполнитель:E6');
  at('2026-09-04');
  ZD.requestExtension(t.id, 'E6', '2026-09-10', 'нужны данные Нацбанка');
  const ruleAuthor = throws(() => ZD.decideExtension(t.id, 'E4', true));
  ZD.decideExtension(t.id, 'E7', true);
  const st = ZD.stepByKey('doc-execute|resolution:R-1·исполнитель:E6|');
  const noOwnerSet = throws(() => setRule('rule-doc-execute', 'dueN', 5, 'E4'));
  ok(132, t.dueDate === '2026-09-08' && t.approver === 'E7' && /автор резолюции/.test(ruleAuthor) && ZD.dueOf(t) === '2026-09-10' &&
       st.initialDue === '2026-09-08' && st.setDue === '2026-09-10' && st.extensions === 1 && /не настраивается/.test(noOwnerSet) &&
       ZD.ruleForKind('doc-execute').dueUnit === 'named' && ZD.ruleForKind('doc-execute').extendBy === 'автор резолюции',
    `R-1 по Вх-342: срок задания E6 — срок резолюции 08.09 (не правило); E6 просит до 10.09 — автор правила E4 решить не ` +
    `может («${ruleAuthor}»), утвердил автор резолюции E7; документ читает у заданий действующий срок 10.09 и одно продление`);
})();

/* каскад: срок ниже — не позже действующего срока выше, читаемого у заданий */
(() => {
  ZD.seed();
  pollOn('2026-09-03');
  const t = docLast('doc-execute', 'resolution:R-1', 'исполнитель:E6');
  at('2026-09-04');
  const arg = { resp: 'E8', due: '2026-09-10', text: 'Собрать данные по МСБ', parent: 'R-1' };
  const tooLate = throws(() => ZD.docStep('D-202', 'E6', 'дать резолюцию', arg));
  const notExec = throws(() => ZD.docStep('D-202', 'E8', 'дать резолюцию', Object.assign({}, arg, { due: '2026-09-07' })));
  ZD.requestExtension(t.id, 'E6', '2026-09-10', 'нужны данные Нацбанка');
  ZD.decideExtension(t.id, 'E7', true);
  ZD.docStep('D-202', 'E6', 'дать резолюцию', arg);
  ZD.runPoll();
  const child = ZD.state.tasks.find(x => x.originKind === 'doc-execute' && /·исполнитель:E8\|$/.test(x.povodKey) && !/R-1·/.test(x.povodKey));
  ok(133, /08\.09\.2026/.test(tooLate) && /исполнитель резолюции выше/.test(notExec) && child && child.dueDate === '2026-09-10' &&
       child.approver === 'E6',
    `E6 даёт резолюцию ниже со сроком 10.09 — отказ «${tooLate}»; дать её может только исполнитель резолюции выше; после ` +
    `продления R-1 до 10.09 в заданиях — та же резолюция принята, у E8 задание со сроком 10.09, продление утверждает E6`);
})();

/* «требует ответа»: гаснет отправкой ответного исходящего; соисполнитель — снят */
(() => {
  ZD.seed();
  pollOn('2026-09-03');
  at('2026-09-04');
  const noMark = throws(() => ZD.docStep('D-202', 'E6', 'исполнено', 'R-1', 'ответ подготовлен'));
  pollOn('2026-09-08', '2026-09-09', '2026-09-10');
  const resp = docLast('doc-execute', 'resolution:R-1', 'исполнитель:E6'), co = docLast('doc-execute', 'resolution:R-1', 'исполнитель:E8');
  const fin = resp.journal[resp.journal.length - 1];
  ok(134, /требует ответа/.test(noMark) && ZD.outcomeOf(resp).outcome === 'исполнено' && ZD.outcomeOf(resp).by === 'E6' &&
       fin.how === 'ответ отправлен: Исх-117' && ZD.outcomeOf(co).outcome === 'снято' && ZD.outcomeOf(co).reason === 'резолюция исполнена',
    `Вх-342 требует ответа: отметка «Исполнено» без ответа — отказ; 10.09 ответ Исх-117 отправлен в Минфин — задание ` +
    `ответственного E6 «исполнено» («${fin.how}»), соисполнителя E8 — «снято: резолюция исполнена»`);
})();

/* на контроле: отдельный шаг контролёра, возврат — «повтор после» исполнителю */
(() => {
  ZD.seed();
  pollOn('2026-09-04', '2026-09-10');
  const e1 = docTasks('doc-execute', 'resolution:R-2', 'исполнитель:E3')[0];
  const ctl = docLast('doc-control', 'resolution:R-2');
  pollOn('2026-09-15');
  const e2 = docLast('doc-execute', 'resolution:R-2', 'исполнитель:E3');
  ok(135, ZD.outcomeOf(e1).outcome === 'исполнено' && ZD.outcomeOf(e1).by === 'E3' && ctl && ctl.assignee === 'E14' && ctl.dueDate === '2026-09-14' &&
       !ctl.controller && !e1.controller && ZD.outcomeOf(ctl).outcome === 'исполнено' && ZD.outcomeOf(ctl).by === 'E14' &&
       e2 !== e1 && e2.repeatOf === e1.id && e2.dueDate === '2026-10-02' && !ZD.isTerminal(e2),
    `R-2 по Вх-347 на контроле Орозова: 10.09 E3 отметил «Исполнено» — его задание закрыто, контролёру E14 — «Подтвердить» ` +
    `до 14.09 (контролёра заданий нет — две оси не нужны); 15.09 E14 вернул — его шаг исполнен, E3 — новое задание «повтор ` +
    `после» ${e1.id} со сроком резолюции 02.10`);
})();

/* ознакомление: по получателю, просрочка — одним сигналом; документ без ознакомления в дело не идёт */
(() => {
  ZD.seed();
  pollOn('2026-09-02', '2026-09-03', '2026-09-04', '2026-09-08');
  const acq = ZD.state.tasks.filter(t => t.originKind === 'doc-acquaint' && /D-205/.test(t.povodKey));
  const e8 = docLast('doc-acquaint', 'document:D-205', 'получатель:E8');
  const late = ZD.state.notifications.some(n => n.taskId === e8.id && n.kind === 'срок-истёк' && n.to === 'E8');
  pollOn('2026-09-15');
  const esc = ZD.state.tasks.find(t => t.povodKey === `pk-overdue|task:${e8.id}|`);
  const subst = throws(() => ZD.docStep('D-205', 'E7', 'ознакомлен'));
  ok(136, acq.length === 4 && acq.filter(t => ZD.isTerminal(t)).length === 3 && e8.dueDate === '2026-09-07' && late &&
       esc && esc.assignee === 'E7' && !ZD.state.povods.some(p => p.key === 'doc-file|document:D-205|') && !!subst,
    `Пр-56 на ознакомление четырём: трое ознакомились — задания исполнены; E8 нет — 08.09 «срок истёк», 15.09 (5-й р.д.) — ` +
    `руководителю E7 «Просрочено задание»; не все ознакомлены — «Сдать в дело» не рождается; за получателя не знакомятся`);
})();

/* подпись «лично»: замещающего подставляет документ — по приказу с правом подписи */
(() => {
  ZD.seed();
  pollOn('2026-09-15', '2026-09-16');
  const val = ZD.state.tasks.find(t => t.originKind === 'doc-sign' && t.rollupKeys);
  const n = val && val.rollupKeys.length;
  const viaSub = val && ZD.visibleTo(val, 'E7');
  pollOn('2026-10-02');
  const d210 = docLast('doc-sign', 'document:D-210');
  const subSees = ZD.visibleTo(val, 'E7');
  const stranger = throws(() => ZD.docSignBatch(['D-301'], 'E5'));
  const signed = ZD.docSignBatch(val.rollupKeys.map(k => ZD.povodByKey(k).ownerId), 'E7');
  const marks = ['D-301', 'D-312'].map(id => ZD.state.owner.doc.find(o => o.id === id).ev.filter(e => e.sign && e.by === 'E7' && e.for === 'E16').length);
  ZD.runPoll();
  ok(137, n === 12 && val.assignee === 'E16' && ZD.lastEv(val) !== 'поручено' && !viaSub && !subSees && d210 && d210.assignee === 'E7' &&
       d210.addr.responsible === 'E7' && /приказ/.test(stranger) && signed === 12 && marks.join() === '1,1' &&
       ZD.outcomeOf(val).outcome === 'исполнено' && /шагов 12: исполнено 12, снято 0/.test(JSON.stringify(val.journal[val.journal.length - 1])) &&
       val.journal.filter(e => e.ev === 'ключ отпал' && e.by === 'E7' && e.for === 'E16').length === 12,
    `16.09 пачка из 12 уведомлений на подпись Токтосунову — один вал (порог 10 по паре «вид × адресат»), сразу в работе; ` +
    `с 01.10 он в отпуске с приказом «с правом подписи» на E7: вал остаётся у E16 и замещающему в заданиях не виден («лично»), ` +
    `новый D-210 документ назвал прямо E7; E5 без приказа подписать не может; E7 подписал пачку одним действием — по записи ` +
    `в журнале каждого документа («E7 за E16»), каждый ключ вала несёт свой исход и атрибуцию, вал закрыт «исполнено» со сводкой «шагов 12: исполнено 12, снято 0»`);
})();

/* возврат оригинала: повод — не вернули к сроку выдачи, срок задания — срок выдачи */
(() => {
  ZD.seed();
  pollOn('2026-09-16', '2026-10-02');
  const early = docTasks('doc-return', 'issue:V-1').length;
  pollOn('2026-10-05');
  const t = docLast('doc-return', 'issue:V-1');
  const late = ZD.state.notifications.some(n => n.taskId === t.id && n.kind === 'срок-истёк' && n.to === 'E6');
  pollOn('2026-10-12');
  ok(138, early === 0 && t.assignee === 'E6' && t.dueDate === '2026-10-02' && late && ZD.outcomeOf(t).outcome === 'исполнено' &&
       ZD.outcomeOf(t).by === 'E6' && ZD.povodByKey('doc-return|issue:V-1|').stateDate === '2026-10-03' &&
       /не настраивается/.test(throws(() => setRule('rule-doc-return', 'dueN', 3, 'E4'))),
    `оригинал Вх-342 выдан 16.09 Жээнбековой до 02.10: пока срок не прошёл, повода нет; 05.10 — задание «Вернуть оригинал» ` +
    `со сроком выдачи 02.10 и сразу «срок истёк»; 12.10 архивариус отметила возврат — исполнено, исполнитель — вернувшая E6; ` +
    `срок не настраивается правилом`);
})();

/* сроки шагов — значения правил по умолчанию документооборота */
(() => {
  ZD.seed();
  const dues = Object.keys(DOC_STEP_DUES).every(k => ZD.ruleForKind(k).dueN === DOC_STEP_DUES[k] && ZD.ruleForKind(k).dueUnit === 'workday' &&
    ZD.ruleForKind(k).dueSource === 'умолчание документооборота');
  setRule('rule-doc-approve', 'dueN', 3, 'E4');
  pollOn('2026-09-02');
  const a = docLast('doc-approve', 'document:D-201', 'согласующий:E14');
  ok(139, dues && ZD.ruleForKind('doc-approve').editions.length === 2 && a.dueDate === '2026-09-07' && a.ruleEdition === 2,
    `доработать 3, согласовать 2, подписать 2, зарегистрировать 1, отправить 2, рассмотреть 2, контроль 2, ознакомиться 3, ` +
    `сдать в дело 5 р.д. — значения правил «умолчание документооборота»; администратор заданий поставил согласованию 3 р.д. — ` +
    `новая редакция, задание 02.09 со сроком 07.09`);
})();

/* что модуль отдаёт: действующий срок, продления, исход по ключу; «чей повод» */
(() => {
  ZD.seed();
  pollOn('2026-09-04', '2026-09-10', '2026-09-15');
  const r2 = ZD.stepByKey('doc-execute|resolution:R-2·исполнитель:E3|');
  const none = ZD.stepByKey('doc-execute|resolution:R-9·исполнитель:E3|');
  const rows = ZD.taskRows().filter(r => r.kind && /^doc-/.test(r.kind));
  ok(140, r2 && r2.rounds === 2 && r2.outcome === null && r2.setDue === '2026-10-02' && none === null &&
       rows.length >= 5 && rows.every(r => r.owner === 'Документооборот') && rows.some(r => r.outcome === 'исполнено' && r.doneBy === 'E3'),
    `по ключу шага документ читает у заданий действующий срок, продления и исход (R-2 — второй круг, открыт, срок 02.10; ` +
    `неизвестный ключ — пусто); строки заданий статистике несут «чей повод» — Документооборот`);
})();

/* молчание документооборота: замораживаются только его поводы */
(() => {
  ZD.seed();
  pollOn('2026-09-02');
  const before = ZD.state.povods.filter(p => p.status === 'appeared' && !/^doc-/.test(p.kind)).length;
  const r = ZD.runPoll({ downSources: ['docs'] });
  const docFrozen = ZD.state.povods.filter(p => /^doc-/.test(p.kind) && p.status !== 'gone').every(p => p.status === 'frozen');
  const others = ZD.state.povods.filter(p => p.status === 'appeared' && !/^doc-/.test(p.kind)).length;
  ok(141, !r.complete && r.sources[7].answer === 'таймаут' && docFrozen && others === before,
    `документооборот молчит — его поводы заморожены, ${others} поводов остальных семи источников живы`);
})();

/* подписант отказал: шаг подписи исполнен, автору — «Доработать»; сверка реестра ловит утверждающего без срока владельца */
(() => {
  ZD.seed();
  pollOn('2026-09-04');
  const sign = docLast('doc-sign', 'document:D-208');
  at('2026-09-07');
  const noWhy = throws(() => ZD.docStep('D-208', 'E16', 'отказать', null, ''));
  ZD.docStep('D-208', 'E16', 'отказать', null, 'не указан ИНН');
  ZD.runPoll();
  const rev = docLast('doc-revise', 'document:D-208');
  ZD.ruleForKind('doc-approve').extendBy = 'автор резолюции';
  const errs = ZD.checkRegistry();
  ok(142, /комментарий/.test(noWhy) && ZD.outcomeOf(sign).outcome === 'исполнено' && ZD.outcomeOf(sign).by === 'E16' &&
       rev && rev.assignee === 'E8' && rev.povodKey === 'doc-revise|document:D-208|' && errs.some(e => /утверждающий продление/.test(e)),
    `Токтосунов отказал в подписи D-208 с комментарием (без него — отказ) — его шаг исполнен, автору E8 — «Доработать»; ` +
    `сверка реестра ловит правило, назвавшее утверждающего продление при сроке правила`);
})();

/* срок «лично» у названного: подписанта не подменяет замещение заданий */
(() => {
  ZD.seed();
  const d208 = ZD.state.owner.doc.find(o => o.id === 'D-208');
  d208.ev = d208.ev.filter(e => !e.sign); // в этой ветке демо Токтосунов до отпуска не подписал
  pollOn('2026-09-04');
  const t = docLast('doc-sign', 'document:D-208');
  at('2026-10-02'); // Токтосунов в отпуске, приказ с правом подписи на E7
  const acting = ZD.canActFor(t, 'E7');
  const addr = ZD.resolveAddressee(ZD.ruleForKind('doc-sign'), Object.assign({}, ZD.povodByKey(t.povodKey), { named: 'E16' }), '2026-10-02');
  ZD.docStep('D-208', 'E7', 'подписать');
  ZD.runPoll();
  const e = t.journal[t.journal.length - 1];
  ok(143, !acting && addr.assignee === 'E16' && !addr.subst && ZD.outcomeOf(t).outcome === 'исполнено' && e.by === 'E7' && e.for === 'E16' &&
       ZD.signerOn('E16', '2026-10-02') === 'E7' && ZD.signerOn('E16', '2026-09-08') === 'E16',
    `«лично»: задания за подписанта замещающего не подставляют — E7 не действует за E16 в заданиях; документ по приказу ` +
    `с правом подписи дал E7 подписать — задание E16 закрыто «исполнено», «E7 за E16»`);
})();

/* ветка резолюций: ответ гасит все открытые резолюции, исход выше снимает открытые ниже */
(() => {
  ZD.seed();
  pollOn('2026-09-03');
  const t1 = docLast('doc-execute', 'resolution:R-1', 'исполнитель:E6');
  at('2026-09-04');
  ZD.requestExtension(t1.id, 'E6', '2026-09-10', 'нужны данные Нацбанка');
  ZD.decideExtension(t1.id, 'E7', true);
  ZD.docStep('D-202', 'E6', 'дать резолюцию', { resp: 'E8', due: '2026-09-10', text: 'Собрать данные', parent: 'R-1' });
  ZD.runPoll();
  const kid = ZD.state.tasks.find(x => x.originKind === 'doc-execute' && /·исполнитель:E8\|$/.test(x.povodKey) && !/R-1·/.test(x.povodKey));
  pollOn('2026-09-08');
  ZD.docStep('D-204', 'E3', 'дать резолюцию', { resp: 'E1', due: '2026-09-30', text: 'Подготовить письменный ответ', parent: 'R-2' });
  ZD.runPoll();
  const low = ZD.state.tasks.find(x => x.originKind === 'doc-execute' && /·исполнитель:E1\|$/.test(x.povodKey));
  pollOn('2026-09-09', '2026-09-10');
  ok(144, kid && ZD.outcomeOf(kid).outcome === 'исполнено · выполнил другой' && ZD.outcomeOf(kid).by === 'E6' &&
       low && ZD.outcomeOf(low).outcome === 'снято' && ZD.outcomeOf(low).reason === 'резолюция выше закрыта',
    `ответ Исх-117 отправлен 10.09 — гаснут все открытые резолюции Вх-342, и нижняя у E8 тоже: «исполнено · выполнил другой» ` +
    `(ответ отправила E6); по Вх-347 E3 дал резолюцию ниже E1 и 10.09 отметил R-2 «Исполнено» — нижняя снята «резолюция выше закрыта»`);
})();

/* ---------- U. Подключение имущества (волна макета 11) ---------- */
const imTasks = key => ZD.state.tasks.filter(t => t.povodKey === key);
const imLast = key => { const a = imTasks(key); return a[a.length - 1]; };
const IM_ORDER = ['pk-im-offer-overdue','pk-im-act-pending','pk-im-registration-pending','pk-im-topup-pending','pk-im-no-inspection',
  'pk-im-not-listed','pk-im-unsold','pk-im-instalment-overdue','pk-im-encumbrance-ending','pk-im-claim-open'];

/* девятый источник: десять видов записями трёх реестров, адресат — формула кураторства */
(() => {
  ZD.seed();
  const im = ZD.SOURCES.find(s => s.id === 'assets');
  const wired = im.kinds.every(k => { const kd = ZD.kindOf(k), r = ZD.ruleForKind(k), a = r && ZD.actionOf(r.action);
    return kd && kd.ownerExec && kd.addrForm === 'формула' && kd.take === 'нужно' && !kd.periodic && kd.activatedAt === '2026-10-01' &&
      r.mode === 'авто' && !r.controller && r.addressee.by === 'кураторство' && r.addressee.role === 'куратор имущества' &&
      a && a.where && ZD.ownerOfKind(k) === 'Имущество'; });
  ok(145, ZD.SOURCES.length === 10 && ZD.SOURCES[8] === im && im.pollEveryMin === 1440 && im.silenceMin === null &&
       ZD.silenceThreshold(im) === 2880 && im.kinds.join() === IM_ORDER.join() && wired && ZD.checkRegistry().length === 0,
    `Имущество — девятый источник, ночной опрос, порог молчания по умолчанию (две ночи); десять видов pk-im-* — восемь ` +
    `исходных, «принятая позиция ждёт акта» и «требование к отчуждателю» — записями трёх реестров: адресат — формула ` +
    `«куратор имущества», «Взять в работу», работа в карточке имущества, контролёра нет; реестр сходится`);
})();

/* рубильник и клэмп: до 01.10 поводов нет, база срока прижата, давность честная */
(() => {
  ZD.seed();
  const r0 = ZD.runPoll();
  const before = r0.sources.find(s => s.src === 'assets');
  const inactive = ZD.state.povods.filter(p => p.kind === 'pk-kind-inactive' && /pk-im-/.test(p.key)).length;
  at('2026-10-01');
  const r1 = ZD.runPoll(), a1 = r1.sources.find(s => s.src === 'assets');
  const reg = ZD.povodByKey('pk-im-registration-pending|asset:ОИ-501|'), act = ZD.povodByKey('pk-im-act-pending|offer:П-42·позиция:1|');
  ok(146, before.new === 0 && before.answer === 'множество' && inactive === 0 && a1.new === 23 &&
       ZD.state.povods.filter(p => /^pk-im-/.test(p.kind)).every(p => p.stateDate === '2026-10-01') &&
       reg.traits.дней === 73 && act.traits.дней_без_акта === 57,
    `до ввода видов в действие (01.10) имущество отвечает пустым множеством, «вид не введён» не возникает; 01.10 — 23 повода, ` +
    `база срока каждого прижата к 01.10, а признак хранит давность: квартира ждёт регистрации 73 дня, дом без акта 57 дней`);
})();

/* ключ: «вид · объект», у позиции — плюс позиция, период — только платёж по графику */
(() => {
  ZD.seed();
  pollOn('2026-10-01');
  const keys = ZD.state.povods.filter(p => /^pk-im-/.test(p.kind)).map(p => p.key);
  const shape = keys.every(k => /^pk-im-[a-z-]+\|(offer:П-\d+(·позиция:\d+)?|asset:ОИ-\d+|contract:КП-\d+)\|(\d{4}-\d{2}-\d{2})?$/.test(k));
  const withPeriod = keys.filter(k => !/\|$/.test(k));
  const c = ZD.povodByKey('pk-im-instalment-overdue|contract:КП-7|2026-09-20');
  ok(147, shape && withPeriod.length === 1 && withPeriod[0] === 'pk-im-instalment-overdue|contract:КП-7|2026-09-20' &&
       c.objectType === 'contract' && c.objectId === 'КП-7' && c.ownerId === 'ОИ-508' && c.curObj === 'ОИ-508' &&
       ZD.povodByKey('pk-im-act-pending|offer:П-42·позиция:1|').curObj === 'П-42',
    `ключ — «вид · объект · период»: предложение (у ожидания акта — плюс позиция), объект, договор; период назван только у ` +
    `просрочки рассрочки — платёж по графику 20.09; месяца в ключе нет; адресат договора — куратор его объекта ОИ-508`);
})();

/* адресат — формула: куратор предложения / объекта, ответ кураторства «держит заведующий», «Взять в работу» */
(() => {
  ZD.seed();
  pollOn('2026-10-01');
  const off = imLast('pk-im-offer-overdue|offer:П-41|'), enc = imLast('pk-im-encumbrance-ending|asset:ОИ-509|');
  const reg = imLast('pk-im-registration-pending|asset:ОИ-501|');
  const noClaim = throws(() => ZD.claim(reg.id, null, 'E22'));
  ZD.take(reg.id, 'E22');
  ok(148, off.assignee === 'E21' && off.addr.by === 'кураторство' && off.addr.role === 'куратор имущества' && off.addr.curObj === 'П-41' &&
       reg.assignee === 'E22' && enc.assignee === 'E23' && enc.addr.responsible === 'E23' && /держит заведующий/.test(enc.addr.hold || '') &&
       !!noClaim && ZD.lastEv(reg) === 'принято',
    `«Срок ответа истёк» — куратору предложения П-41 (Абдраимова), «ждёт регистрации» — куратору объекта ОИ-501 (Усенов); ` +
    `у ОИ-509 правило работника не называет — кураторство отвечает «держит заведующий отделом», задание Касеновой; ` +
    `задание берут в работу, «Заявить» отбито — работа у владельца`);
})();

/* порог осмотра — по виду: скот 1 мес., офис 6 мес. */
(() => {
  ZD.seed();
  pollOn('2026-10-01');
  ok(149, !!ZD.povodByKey('pk-im-no-inspection|asset:ОИ-503|') && !ZD.povodByKey('pk-im-no-inspection|asset:ОИ-504|') &&
       ZD.povodByKey('pk-im-no-inspection|asset:ОИ-503|').traits.порог_вида === '1 мес. (скот)',
    `скот и офис осмотрены 25.08: по скоту (порог вида 1 мес.) повод есть, по офису (умолчание 6 мес.) — нет; порог объявляет сосед`);
})();

/* свёртка по паре «вид × адресат»: двенадцать партий зерна — вал Усенову, скот — поштучно Абдраимовой */
(() => {
  ZD.seed();
  pollOn('2026-10-01');
  const insp = ZD.state.tasks.filter(t => t.originKind === 'pk-im-no-inspection');
  const val = insp.find(t => t.rollupKeys), one = insp.filter(t => t.povodKey);
  pollOn('2026-10-14');
  const end = val && val.journal[val.journal.length - 1];
  ok(150, insp.length === 2 && val && val.rollupKeys.length === 12 && val.assignee === 'E22' && one.length === 1 && one[0].assignee === 'E21' &&
       ZD.outcomeOf(val).outcome === 'исполнено' && end.note === 'шагов 12: исполнено 12, снято 0',
    `«давно не осматривали» 01.10: двенадцать партий зерна у Усенова — больше порога 10 — один вал ему, скот у Абдраимовой — ` +
    `поштучно; 14.10 осмотр элеватора — все ключи вала отпали с атрибуцией, вал «исполнено» со сводкой`);
})();

/* срок ответа истёк: промежуточное письмо — исполнено */
(() => {
  ZD.seed();
  pollOn('2026-10-01');
  const t = imLast('pk-im-offer-overdue|offer:П-41|');
  pollOn('2026-10-02');
  ok(151, t.dueDate === '2026-10-05' && ZD.outcomeOf(t).outcome === 'исполнено' && ZD.outcomeOf(t).by === 'E21' &&
       ZD.povodByKey(t.povodKey).status === 'gone',
    `срок ответа П-41 — 28.09, повод с 01.10, срок задания 2 р.д. (05.10); 02.10 куратор отправила промежуточное письмо — ` +
    `повод отпал, задание «исполнено», выполнила Абдраимова`);
})();

/* ждёт акта: черновик акта не гасит повод, публикация — гасит; замещающий за куратора */
(() => {
  ZD.seed();
  pollOn('2026-10-01', '2026-10-05', '2026-10-07');
  const t = imLast('pk-im-act-pending|offer:П-42·позиция:1|');
  const alive = !ZD.isTerminal(t) && ZD.povodByKey(t.povodKey).status === 'appeared';
  pollOn('2026-10-08');
  const e = t.journal[t.journal.length - 1];
  ok(152, alive && t.assignee === 'E21' && ZD.outcomeOf(t).outcome === 'исполнено' && e.by === 'E22' && e.for === 'E21',
    `решение «принять» дом 05.08, акта нет — задание куратору П-42 Абдраимовой 01.10; 07.10 акт подготовлен, но без второго ` +
    `ключа сосед его не видит — повод жив; 08.10 начальник Управления опубликовал — «исполнено», Усенов за Абдраимову (отпуск)`);
})();

/* отзыв источником — «снято» с причиной владельца */
(() => {
  ZD.seed();
  pollOn('2026-10-01', '2026-10-06');
  const t = imLast('pk-im-act-pending|offer:П-43·позиция:1|');
  ok(153, ZD.outcomeOf(t).outcome === 'снято' && ZD.outcomeOf(t).reason === 'позиция 1 отозвана источником',
    `помещение П-43 принято 25.08, акта нет; 06.10 ПССИ отозвал позицию — работа больше не нужна: «снято», причина — от владельца`);
})();

/* ждёт регистрации: черновик регистрации 13.10 — повод жив, публикация 14.10 — исполнено */
(() => {
  ZD.seed();
  pollOn('2026-10-01', '2026-10-13');
  const t = imLast('pk-im-registration-pending|asset:ОИ-501|');
  const alive = !ZD.isTerminal(t);
  pollOn('2026-10-14');
  ok(154, alive && ZD.outcomeOf(t).outcome === 'исполнено' && ZD.outcomeOf(t).by === 'E22' &&
       ZD.ownerAt('ima', 'ОИ-501', '2026-10-14').status === 'на учёте',
    `квартира ОИ-501 ждёт регистрации с 20.07; регистрация внесена 13.10 черновиком — задание открыто; 14.10 опубликована ` +
    `вторым ключом — переход права, повод отпал, «исполнено», выполнил Усенов`);
})();

/* доплата: исполнил бухгалтер в Платежах — «исполнено · выполнил другой»; «Снять» нет */
(() => {
  ZD.seed();
  pollOn('2026-10-01');
  const t = imLast('pk-im-topup-pending|asset:ОИ-502|');
  const noRelease = throws(() => ZD.releaseTask(t.id, 'E4', 'не нужно'));
  pollOn('2026-10-12');
  ok(155, t.dueDate === '2026-10-08' && !!noRelease && ZD.outcomeOf(t).outcome === 'исполнено · выполнил другой' && ZD.outcomeOf(t).by === 'E25',
    `доплата 120 000 по автомобилю не исполнена с 21.08 — задание куратору на 5 р.д.; снять его автор не может — шаг у владельца; ` +
    `12.10 Возврат исполнила бухгалтер — «исполнено · выполнил другой»`);
})();

/* смена куратора переадресует непринятое; попытка продажи закрывает */
(() => {
  ZD.seed();
  pollOn('2026-10-01');
  const t = imLast('pk-im-not-listed|asset:ОИ-506|');
  const first = t.assignee;
  pollOn('2026-10-12');
  const moved = t.journal.find(e => e.ev === 'переадресовано');
  pollOn('2026-10-20');
  ok(156, first === 'E21' && moved && moved.from === 'E21' && moved.to === 'E22' && t.assignee === 'E22' &&
       ZD.outcomeOf(t).outcome === 'исполнено' && ZD.outcomeOf(t).by === 'E22',
    `склад ОИ-506 на учёте с 02.03 без попыток — задание куратору Абдраимовой, в работу не взято; 12.10 закрепление ` +
    `перешло к Усенову — задание переадресовано; 20.10 он открыл попытку продажи — «исполнено»`);
})();

/* несостоявшиеся попытки: новая попытка — исполнено, снова не состоялась — «повтор после» */
(() => {
  ZD.seed();
  pollOn('2026-10-01', '2026-10-16');
  const t1 = imLast('pk-im-unsold|asset:ОИ-507|');
  pollOn('2026-10-30');
  const t2 = imLast('pk-im-unsold|asset:ОИ-507|');
  const p = ZD.povodByKey('pk-im-unsold|asset:ОИ-507|');
  ok(157, ZD.outcomeOf(t1).outcome === 'исполнено' && t2 !== t1 && t2.repeatOf === t1.id && t2.repeatCount === 1 &&
       p.traits.несостоявшихся === 4 && p.journal.some(e => e.ev === 'вновь-появился'),
    `трактор: три попытки не состоялись — задание; 16.10 открыта четвёртая по новой оценке — «исполнено»; 30.10 и она ` +
    `не состоялась — тот же ключ вернулся, новое задание «повтор после ${t1.id}»`);
})();

/* рассрочка: ключ — платёж; претензия — отметка о ходе; оплата — «выполнил другой»; следующий платёж — новый ключ */
(() => {
  ZD.seed();
  pollOn('2026-10-01');
  const key = 'pk-im-instalment-overdue|contract:КП-7|2026-09-20';
  const t = imLast(key);
  at('2026-10-05'); ZD.take(t.id, 'E22'); ZD.addProgress(t.id, 'E22', 'претензия покупателю № 22 направлена');
  const st = ZD.lastEv(t);
  pollOn('2026-10-09', '2026-10-20');
  const none = ZD.state.povods.filter(p => p.kind === 'pk-im-instalment-overdue' && p.status !== 'gone').length;
  pollOn('2026-10-26');
  const t2 = imLast('pk-im-instalment-overdue|contract:КП-7|2026-10-20');
  ok(158, st === 'принято' && ZD.outcomeOf(t).outcome === 'исполнено · выполнил другой' && ZD.outcomeOf(t).by === 'E25' && none === 0 &&
       t2 && t2.repeatOf === null && t2.assignee === 'E22',
    `платёж 20.09 по КП-7 не поступил — повод на этот платёж; претензия — отметка о ходе, состояние «в работе»; 09.10 оплата ` +
    `зачислена — «исполнено · выполнил другой»; 20.10 повода нет (порог 5 к.д.), 26.10 — новый ключ на платёж 20.10, не повтор`);
})();

/* обременение: кончилось по сроку — «снято»; продлено — «исполнено» */
(() => {
  ZD.seed();
  pollOn('2026-10-01', '2026-10-30');
  const t = imLast('pk-im-encumbrance-ending|asset:ОИ-509|');
  const alive = !ZD.isTerminal(t);
  pollOn('2026-11-02');
  ZD.seed();
  pollOn('2026-10-01');
  const u = imLast('pk-im-encumbrance-ending|asset:ОИ-509|');
  at('2026-10-05'); ZD.imStep('ima', 'ОИ-509', 'E23', 'продлить обременение', '2027-06-30'); ZD.runPoll();
  ok(159, alive && ZD.outcomeOf(t).outcome === 'снято' && ZD.outcomeOf(t).reason === 'обременение кончилось 31.10.2026' &&
       ZD.outcomeOf(u).outcome === 'исполнено' && ZD.outcomeOf(u).by === 'E23',
    `аренда ОИ-509 до 31.10 — повод с 01.10; 02.11 аренда кончилась сама — «снято: обременение кончилось 31.10.2026»; ` +
    `в другом прогоне 05.10 заведующая продлила аренду — «исполнено»`);
})();

/* требование к отчуждателю: частичная оплата повод не гасит, остаток 0 — гасит */
(() => {
  ZD.seed();
  pollOn('2026-10-01', '2026-10-20');
  const t = imLast('pk-im-claim-open|asset:ОИ-510|');
  const p = ZD.povodByKey(t.povodKey);
  const mid = !ZD.isTerminal(t) && p.status === 'appeared' && p.traits.остаток === 150000;
  pollOn('2026-11-02');
  ok(160, mid && ZD.outcomeOf(t).outcome === 'исполнено' && ZD.outcomeOf(t).by === 'E22' && t.dueDate === '2026-10-15',
    `требование 200 000 открыто с 01.08 — повод с 30.09 (60 к.д.); 20.10 погашено 50 000 — повод жив, остаток 150 000; ` +
    `02.11 погашен остаток — «исполнено»`);
})();

/* пороги — настройки соседа; в заданиях только срок «внутренний акт» и реквизит суммы */
(() => {
  ZD.seed();
  const rules = IM_ORDER.map(k => ZD.ruleForKind(k)), dues = rules.map(r => r.dueN).join();
  const noThr = throws(() => setRule('rule-pk-im-unsold', 'threshold', 4, 'E4'));
  setRule('rule-pk-im-no-inspection', 'dueN', 5, 'E4');
  pollOn('2026-10-01');
  const one = imLast('pk-im-no-inspection|asset:ОИ-503|');
  const rows = ZD.taskRows().filter(r => /^pk-im-/.test(r.kind || ''));
  ok(161, dues === '2,10,10,5,10,15,15,5,10,10' && rules.every(r => r.dueSource === 'внутренний акт' && !('threshold' in r)) &&
       !!noThr && one.dueDate === '2026-10-08' && one.ruleEdition === 2 &&
       IM_ORDER.every(k => ZD.kindOf(k).sumAttr) && rows.length && rows.every(r => r.owner === 'Имущество' && r.sumAttr),
    `порог появления повода — настройка модуля имущества, у правила заданий его нет; срок задания — значение правила ` +
    `«внутренний акт» (2/10/10/5/10/15/15/5/10/10 р.д.), правка — новой редакцией; у каждого вида — реквизит суммы, строка ` +
    `статистике несёт «чей повод» — Имущество`);
})();

/* молчит имущество — замерзают только его поводы */
(() => {
  ZD.seed();
  pollOn('2026-10-01');
  const others = ZD.state.povods.filter(p => p.status === 'appeared' && !/^pk-im-/.test(p.kind)).length;
  at('2026-10-02'); const r = ZD.runPoll({ downSources: ['assets'] });
  const frozen = ZD.state.povods.filter(p => /^pk-im-/.test(p.kind) && p.status === 'frozen').length;
  const offer = imLast('pk-im-offer-overdue|offer:П-41|');
  ok(162, !r.complete && r.sources.find(s => s.src === 'assets').answer === 'таймаут' && frozen === 23 &&
       ZD.state.povods.filter(p => !/^pk-im-/.test(p.kind) && p.status === 'frozen').length === 0 && others > 0 && !ZD.isTerminal(offer),
    `02.10 имущество не ответило: его 23 повода заморожены, промежуточное письмо по П-41 задания не закрыло — ждёт ответа; ` +
    `поводы остальных источников не тронуты`);
})();

/* демо-карточка имущества: факт вводит специалист, публикует начальник Управления, деньги — бухгалтер */
(() => {
  ZD.seed();
  at('2026-10-05');
  const notStaff = throws(() => ZD.imStep('ima', 'ОИ-503', 'E5', 'осмотр'));
  const notChief = throws(() => ZD.imStep('ima', 'ОИ-501', 'E22', 'опубликовать'));
  const notBook = throws(() => ZD.imStep('ima', 'ОИ-502', 'E21', 'доплата исполнена'));
  const noAct = throws(() => ZD.imStep('imo', 'П-41', 'E21', 'акт по позиции', 1));
  ZD.imStep('ima', 'ОИ-501', 'E22', 'регистрация права');
  const draft = ZD.ownerAt('ima', 'ОИ-501', '2026-10-05').status;
  ZD.imStep('ima', 'ОИ-501', 'E24', 'опубликовать');
  const pub = ZD.ownerAt('ima', 'ОИ-501', '2026-10-05');
  ok(163, !!notStaff && !!notChief && !!notBook && !!noAct && draft === 'принят, ждёт регистрации' && pub.status === 'на учёте' &&
       pub.last.by === 'E22' && pub.last.pubBy === 'E24',
    `в демо-карточке: осмотр вводит специалист по имуществу, публикует только начальник Управления, доплату отмечает бухгалтер, ` +
    `акт — только по принятой позиции; регистрация черновиком состояния не меняет, публикация — переход права (подготовил ` +
    `Усенов, опубликовал Джолдошев)`);
})();

/* виды имущества — над предложением, объектом и договором; «документ» и заявка к ним не примешаны */
(() => {
  ZD.seed();
  const kinds = ZD.state.povodKinds.filter(k => /^pk-im-/.test(k.id));
  ok(164, kinds.length === 10 && kinds.every(k => ['offer', 'asset', 'contract'].includes(k.objectType)) &&
       kinds.filter(k => k.objectType === 'offer').map(k => k.id).join() === 'pk-im-offer-overdue,pk-im-act-pending' &&
       kinds.filter(k => k.objectType === 'contract').map(k => k.id).join() === 'pk-im-instalment-overdue' &&
       ZD.describePovod({ objectType: 'contract', objectId: 'КП-7', ownerId: 'ОИ-508', sub: '2026-09-20' }).indexOf('платёж от 20.09.2026') !== -1,
    `десять видов: два — над предложением, один — над договором купли-продажи, семь — над объектом имущества`);
})();

/* ---------- V. Подключение анализа (волна макета 12) ---------- */
const anLast = key => { const a = ZD.state.tasks.filter(t => t.povodKey === key); return a[a.length - 1]; };
const AN_D = no => `pk-an-decision|review:${no}|`;
const AN_P = (tpl, per) => `pk-an-no-review|template:${tpl}|${per}`;
const Q2 = '2026-04-01..2026-06-30', Q3 = '2026-07-01..2026-09-30', AUG = '2026-08-01..2026-08-31', SEP = '2026-09-01..2026-09-30';
const poruch = (no, obj, by, extra) => ZD.createFreeTask(Object.assign(ZD.reviewTaskDraft(no, obj, by), { dueDate: '2026-10-30' }, extra || {}));

/* десятый источник: два вида записями трёх реестров */
(() => {
  ZD.seed();
  const an = ZD.SOURCES.find(s => s.id === 'analysis');
  const d = ZD.kindOf('pk-an-decision'), m = ZD.kindOf('pk-an-no-review');
  const rd = ZD.ruleForKind('pk-an-decision'), rm = ZD.ruleForKind('pk-an-no-review');
  ok(165, ZD.SOURCES.length === 10 && ZD.SOURCES[9] === an && an.name === 'Анализ' && an.pollEveryMin === 1440 && an.silenceMin === null &&
       ZD.silenceThreshold(an) === 2880 && an.kinds.join() === 'pk-an-decision,pk-an-no-review' && ZD.AN_KINDS.length === 2 &&
       d.ownerExec && d.selfRelease === 'решение без поручений' && !d.periodic && d.objectType === 'review' &&
       m.ownerExec && !m.selfRelease && m.periodic && m.periodAbsorb === 'нет' && m.objectType === 'template' &&
       [d, m].every(k => k.addrForm === 'формула' && k.take === 'нужно' && k.activatedAt === '2026-10-01' && ZD.ownerOfKind(k.id) === 'Анализ') &&
       rd.mode === 'авто' && !rd.controller && rm.mode === 'авто' && !rm.controller && ZD.actionOf(rd.action).here && ZD.actionOf(rm.action).where &&
       ZD.checkRegistry().length === 0,
    `Анализ — десятый источник, ночной опрос, порог молчания по умолчанию; два вида записями трёх реестров: «обзор требует решения, ` +
    `поручений нет» (решение адресата без поручений с основанием) и «обзора за период нет» (периодический, поглощения периодом нет); ` +
    `адресат — формула, «Взять в работу», контролёра у правил нет; реестр сходится`);
})();

/* рубильник и клэмп: до 01.10 — пусто; 01.10 — пять поводов, база прижата, давность честная */
(() => {
  ZD.seed();
  const r0 = ZD.runPoll(), a0 = r0.sources.find(s => s.src === 'analysis');
  const inactive = ZD.state.povods.filter(p => p.kind === 'pk-kind-inactive' && /pk-an-/.test(p.key)).length;
  at('2026-10-01');
  const a1 = ZD.runPoll().sources.find(s => s.src === 'analysis');
  const pv = ZD.state.povods.filter(p => /^pk-an-/.test(p.kind));
  const ob2 = ZD.povodByKey(AN_D('ОБ-2')), q2 = ZD.povodByKey(AN_P('ШО-04', Q2));
  ok(166, a0.new === 0 && a0.answer === 'множество' && inactive === 0 && a1.new === 5 && pv.every(p => p.stateDate === '2026-10-01') &&
       ob2.traits.утверждён === '2026-04-22' && q2.traits.закрыт === '2026-07-06',
    `до ввода видов (01.10) анализ отвечает пустым множеством, «вид не введён» не возникает; 01.10 — 5 поводов (ОБ-2, ОБ-3, ОБ-4; ` +
    `ШО-04 за II квартал, ШО-12 за август), база срока прижата к 01.10, а признак хранит правду: ОБ-2 утверждён 22.04, квартал закрыт 06.07`);
})();

/* «поручений нет»: ключ «вид · обзор», адресат — руководитель подразделения «кому направлен», срок 5 р.д. от утверждения */
(() => {
  ZD.seed();
  pollOn('2026-10-01');
  const t2 = anLast(AN_D('ОБ-2')), t3 = anLast(AN_D('ОБ-3')), t4 = anLast(AN_D('ОБ-4'));
  at('2026-10-12'); ZD.runPoll();
  const t5 = anLast(AN_D('ОБ-5'));
  ok(167, t2.assignee === 'E2' && t3.assignee === 'E5' && t4.assignee === 'E7' && t5.assignee === 'E5' &&
       t2.addr.by === 'должность' && t2.addr.unit === 'Сопровождение' && !t2.queue && !t2.controller &&
       t2.dueDate === '2026-10-08' && t5.dueDate === '2026-10-19' && ZD.lastEv(t2) === 'поручено' &&
       ZD.povodByKey(AN_D('ОБ-2')).traits.кому_направлен === 'Сопровождение',
    `ключ «вид · обзор» (${t2.povodKey}); адресат — руководитель подразделения, которому обзор направлен: Сопровождение — ` +
    `Токтогулов, Взыскание — Садыков, Кредитные программы — Мамбетов; срок 5 р.д. от даты утверждения (ОБ-5 утверждён 12.10 — до 19.10), ` +
    `у подключения — от 01.10; задание ждёт «Взять в работу»`);
})();

/* «требует внимания» и черновик повода не дают */
(() => {
  ZD.seed();
  pollOn('2026-10-01', '2026-10-14', '2026-10-26');
  const keys = ZD.state.povods.filter(p => p.kind === 'pk-an-decision').map(p => p.objectId).sort().join();
  ok(168, keys === 'ОБ-2,ОБ-3,ОБ-4,ОБ-5' && !ZD.povodByKey(AN_D('ОБ-1')) && !ZD.povodByKey(AN_D('ОБ-6')) && !ZD.povodByKey(AN_D('ОБ-9')) &&
       ZD.ownerAt('an', 'ОБ-1', '2026-10-26').verdict === 'требует внимания' && !ZD.ownerAt('an', 'ОБ-9', '2026-10-26').approved,
    `поводом стали только утверждённые обзоры с выводом «требует решения руководства» (${keys}); ОБ-1, ОБ-6–ОБ-8 «требуют внимания», ` +
    `ОБ-9 — черновик: повода нет`);
})();

/* поручение по обзору — свободное задание: подставлен куратор объекта, автор вправе заменить, контролёр — автор */
(() => {
  ZD.seed();
  at('2026-10-05');
  const dr = ZD.reviewTaskDraft('ОБ-2', 'КД-2024/031', 'E2');
  const t = poruch('ОБ-2', 'КД-2024/031', 'E2');
  const t2 = poruch('ОБ-2', 'КД-2023/187', 'E2', { assignee: 'E5' });
  const otherCtrl = throws(() => poruch('ОБ-2', 'КД-2023/187', 'E2', { controller: 'E4' }));
  const notInList = throws(() => poruch('ОБ-2', 'КД-2025/044', 'E2'));
  const noAssignee = throws(() => poruch('ОБ-2', null, 'E2'));
  at('2026-10-14');
  const replaced = throws(() => poruch('ОБ-4', 'КД-2023/187', 'E7'));
  const draft = throws(() => poruch('ОБ-9', null, 'E27', { assignee: 'E26' }));
  const plain = throws(() => ZD.createFreeTask({ label: 'без основания', assignee: 'E1', author: 'E2', dueDate: '2026-10-20' }));
  ok(169, dr.assignee === 'E3' && dr.controller === 'E2' && t.kind === 'free' && t.basis === 'ОБ-2' && t.object === 'КД-2024/031' &&
       t.assignee === 'E3' && t.controller === 'E2' && t.author === 'E2' && !t.povodKey && !t.ruleId &&
       t2.assignee === 'E5' && /автор/.test(otherCtrl) && /черновик/.test(draft) && /рабочем списке/.test(notInList) &&
       /исполнителя/.test(noAssignee) && /заменён ОБ-6/.test(replaced) && /контролёр/.test(plain),
    `форма подставила куратора КД-2024/031 на дату — Нурланову; по КД-2023/187 автор заменил куратора на Садыкова; контролёр — автор, ` +
    `другой — отказ («${otherCtrl}»); по черновику, по объекту вне рабочего списка, без исполнителя и по заменённому — отказ ` +
    `(«${replaced}»); свободное без основания по-прежнему требует контролёра`);
})();

/* шов «задания по основанию»: только поручения; задание по поводу не в счёт; первое поручение гасит повод */
(() => {
  ZD.seed();
  pollOn('2026-10-01');
  const rule = anLast(AN_D('ОБ-2'));
  const before = ZD.tasksByBasis('ОБ-2');
  at('2026-10-02'); ZD.runPoll();
  const alive = ZD.povodByKey(AN_D('ОБ-2')).status;
  at('2026-10-05');
  const p = poruch('ОБ-2', 'КД-2024/031', 'E2');
  const seam = ZD.tasksByBasis('ОБ-2');
  const stillOpen = !ZD.isTerminal(rule);
  ZD.runPoll();
  const o = ZD.outcomeOf(rule), e = rule.journal[rule.journal.length - 1];
  ok(170, before.length === 0 && alive === 'appeared' && seam.length === 1 && seam[0].task === p.id && seam[0].assignee === 'E3' &&
       seam[0].due === '2026-10-30' && seam[0].object === 'КД-2024/031' && stillOpen &&
       ZD.povodByKey(AN_D('ОБ-2')).status === 'gone' && o.outcome === 'исполнено' && o.by === 'E2' && e.how.indexOf(p.id) !== -1 &&
       ZD.tasksByBasis('ОБ-3').length === 0,
    `задание ${rule.id} по поводу ОБ-2 в шов не попало — повод жив и на 02.10; 05.10 Токтогулов поручил ${p.id} по КД-2024/031 — шов ` +
    `отдаёт его с существом, сроком, адресатом и состоянием; ночью повод отпал, задание «исполнено» с атрибуцией: ${e.how}`);
})();

/* поручил не адресат — «выполнил другой» */
(() => {
  ZD.seed();
  pollOn('2026-10-01');
  const t4 = anLast(AN_D('ОБ-4'));
  at('2026-10-05');
  poruch('ОБ-4', 'КД-2023/187', 'E16');
  ZD.runPoll();
  const o = ZD.outcomeOf(t4);
  ok(171, o.outcome === 'исполнено · выполнил другой' && o.by === 'E16' && t4.assignee === 'E7',
    `по ОБ-4 задание у Мамбетова, а поручил заместитель директора Токтосунов — «исполнено · выполнил другой», атрибуция — кто поручил`);
})();

/* решение без поручений: адресат, обязательное основание, ключ не переиздаётся, пока жив */
(() => {
  ZD.seed();
  pollOn('2026-10-01');
  const t3 = anLast(AN_D('ОБ-3'));
  at('2026-10-02');
  const noReason = throws(() => ZD.releaseTask(t3.id, 'E5', ''));
  const author = throws(() => ZD.releaseTask(t3.id, 'E4', 'не наш вопрос'));
  const claimNo = throws(() => ZD.claim(t3.id, null, 'E5'));
  ZD.releaseTask(t3.id, 'E5', 'реструктуризация уже на комитете, поручать нечего');
  const o = ZD.outcomeOf(t3);
  pollOn('2026-10-02', '2026-10-05', '2026-10-08');
  const p = ZD.povodByKey(AN_D('ОБ-3'));
  const again = ZD.state.tasks.filter(t => t.povodKey === AN_D('ОБ-3')).length;
  ok(172, /основание/.test(noReason) && /адресат/.test(author) && !!claimNo && o.outcome === 'снято' &&
       o.reason === 'решение без поручений: реструктуризация уже на комитете, поручать нечего' && o.by === 'E5' &&
       p.status === 'appeared' && ZD.povodReleased(p) && again === 1,
    `Садыков закрыл задание по ОБ-3 «снято: решение без поручений» с основанием; без основания и не адресату — отказ, «заявить» — ` +
    `отказ; повод жив (поручений нет), но помечен «снят без поручения» — нового задания 02.10–08.10 не выдано`);
})();

/* замена обзора: открытое задание по заменённому — «снято: обзор заменён», заменяющий — новый ключ */
(() => {
  ZD.seed();
  pollOn('2026-10-01', '2026-10-08');
  const t4 = anLast(AN_D('ОБ-4'));
  pollOn('2026-10-12', '2026-10-14');
  const o = ZD.outcomeOf(t4), t5 = anLast(AN_D('ОБ-5'));
  ok(173, o.outcome === 'снято' && o.reason === 'обзор заменён ОБ-6' && o.by === 'владелец' &&
       ZD.ownerAt('an', 'ОБ-4', '2026-10-14').replacedBy === 'ОБ-6' && !ZD.povodByKey(AN_D('ОБ-6')) &&
       t5 && !t5.repeatOf && ZD.outcomeOf(anLast(AN_D('ОБ-3'))).reason === 'обзор заменён ОБ-5',
    `14.10 ОБ-4 заменён ОБ-6 — задание Мамбетова «снято: обзор заменён ОБ-6»; ОБ-6 «требует внимания» — повода нет; ОБ-3 заменён ОБ-5 — ` +
    `тоже «снято», а ОБ-5 даёт новый ключ и новое задание, не «повтор после»`);
})();

/* поручения по заменённому заменяющему не засчитываются: «без поручений» с основанием «поручено по ОБ-…» */
(() => {
  ZD.seed();
  pollOn('2026-10-01');
  at('2026-10-05');
  const p3 = poruch('ОБ-3', 'КД-2025/044', 'E5');
  ZD.runPoll();
  const t3 = anLast(AN_D('ОБ-3'));
  pollOn('2026-10-12');
  const t5 = anLast(AN_D('ОБ-5'));
  const seam5 = ZD.tasksByBasis('ОБ-5').length;
  ZD.releaseTask(t5.id, 'E5', `поручено по ОБ-3: ${p3.id}`);
  pollOn('2026-10-14', '2026-10-20');
  ok(174, ZD.outcomeOf(t3).outcome === 'исполнено' && seam5 === 0 && ZD.tasksByBasis('ОБ-3').length === 1 &&
       ZD.outcomeOf(t5).reason === `решение без поручений: поручено по ОБ-3: ${p3.id}` &&
       ZD.state.tasks.filter(t => t.povodKey === AN_D('ОБ-5')).length === 1 && ZD.povodByKey(AN_D('ОБ-5')).status === 'appeared',
    `по ОБ-3 поручено ${p3.id} — задание исполнено; 12.10 ОБ-3 заменён ОБ-5: его поручение заменяющему не засчитано, повод по ОБ-5 есть; ` +
    `Садыков закрыл «решение без поручений» с основанием «поручено по ОБ-3: ${p3.id}» — до 20.10 не переиздано`);
})();

/* период закрывает только обзор по всему портфелю */
(() => {
  ZD.seed();
  pollOn('2026-10-01');
  const t = anLast(AN_P('ШО-04', Q2));
  pollOn('2026-10-12', '2026-10-14');
  const regional = ZD.ownerAt('an', 'ОБ-5', '2026-10-14');
  const alive = ZD.povodByKey(AN_P('ШО-04', Q2)).status === 'appeared' && !ZD.isTerminal(t);
  pollOn('2026-10-20');
  const o = ZD.outcomeOf(t);
  ok(175, regional.approved && Object.keys(regional.cuts).length === 1 && alive && o.outcome === 'исполнено' && o.by === 'E27' &&
       /ОБ-7/.test(t.journal[t.journal.length - 1].how) && t.povodKey === AN_P('ШО-04', Q2),
    `ключ «вид · шаблон · период» (${t.povodKey}); обзоры ОБ-3 и ОБ-5 по Ошской области за II квартал утверждены — период не закрыт, ` +
    `задание открыто; 20.10 Тентимишев утвердил ОБ-7 по всему портфелю — «исполнено» с атрибуцией`);
})();

/* «обзора за период нет» — заведующему отделом анализа; срок — поле шаблона от дня закрытия, пусто — 20 р.д. */
(() => {
  ZD.seed();
  pollOn('2026-10-01');
  const q2 = anLast(AN_P('ШО-04', Q2)), aug = anLast(AN_P('ШО-12', AUG));
  pollOn('2026-10-06');
  const q3 = anLast(AN_P('ШО-04', Q3)), sep = anLast(AN_P('ШО-12', SEP));
  const pq3 = ZD.povodByKey(AN_P('ШО-04', Q3));
  ok(176, [q2, aug, q3, sep].every(t => t.assignee === 'E27' && !t.queue && t.addr.by === 'должность' && t.addr.unit === 'Отдел анализа' && ZD.lastEv(t) === 'поручено') &&
       q2.dueDate === '2026-10-22' && aug.dueDate === '2026-10-29' && q3.dueDate === '2026-10-27' && sep.dueDate === '2026-11-03' &&
       pq3.stateDate === '2026-10-06' && pq3.dueN === 15 && ZD.povodByKey(AN_P('ШО-12', SEP)).dueN === null &&
       ZD.ruleForKind('pk-an-no-review').dueN === 20,
    `адресат — заведующий отделом анализа Тентимишев, не очередь; повод — в день закрытия периода (III квартал — 06.10); срок по полю ` +
    `шаблона ШО-04 «15 р.д. после закрытия» — 27.10 (у II квартала от подключения — 22.10); у ШО-12 поле пусто — 20 р.д. правила (29.10, 03.11)`);
})();

/* утвердил другой — «выполнил другой» */
(() => {
  ZD.seed();
  pollOn('2026-10-01', '2026-10-06');
  const q3 = anLast(AN_P('ШО-04', Q3));
  pollOn('2026-10-20', '2026-10-26');
  const o = ZD.outcomeOf(q3);
  ok(177, o.outcome === 'исполнено · выполнил другой' && o.by === 'E16' && /ОБ-8/.test(q3.journal[q3.journal.length - 1].how),
    `обзор ОБ-8 за III квартал утвердил заместитель директора Токтосунов — задание заведующего «исполнено · выполнил другой»`);
})();

/* редакция периодичности на конец периода: до приказа — не в множестве, отмена названное не прощает */
(() => {
  ZD.seed();
  pollOn('2026-10-01', '2026-10-06', '2026-11-05');
  const keys = ZD.state.povods.filter(p => p.kind === 'pk-an-no-review').map(p => p.key);
  const t12 = ZD.ownerAt('ant', 'ШО-12', '2026-11-05');
  ok(178, keys.includes(AN_P('ШО-12', AUG)) && keys.includes(AN_P('ШО-12', SEP)) && !keys.includes(AN_P('ШО-12', '2026-07-01..2026-07-31')) &&
       !keys.includes(AN_P('ШО-12', '2026-10-01..2026-10-31')) && !keys.includes(AN_P('ШО-04', '2025-10-01..2025-12-31')) &&
       !keys.some(k => /ШО-09/.test(k)) && t12.status === 'периодичность не объявлена' &&
       ZD.povodByKey(AN_P('ШО-12', SEP)).status === 'appeared',
    `ШО-12: ежемесячно по приказу от 15.08 — июль (до приказа) не в множестве, август и сентябрь — в нём; приказом от 01.10 ` +
    `периодичность отменена — сентябрь остался названным, октябрь (закрыт 05.11) уже нет; IV квартал 2025 у ШО-04 — до приказа; ` +
    `ШО-09 периодичности не объявлял`);
})();

/* поглощения периодом нет: пропущенный период висит рядом со следующим */
(() => {
  ZD.seed();
  pollOn('2026-10-01', '2026-10-06', '2026-10-26', '2026-11-05');
  const aug = anLast(AN_P('ШО-12', AUG)), sep = anLast(AN_P('ШО-12', SEP));
  ok(179, !ZD.isTerminal(aug) && !ZD.isTerminal(sep) && ZD.povodByKey(AN_P('ШО-12', AUG)).status === 'appeared' &&
       ZD.kindOf('pk-an-no-review').periodAbsorb === 'нет' && ZD.kindOf('pk-an-decision').periodAbsorb === null,
    `на 05.11 август и сентябрь ШО-12 — два открытых задания: следующий период пропуск не прощает, модуль ключ прошлого периода не ` +
    `закрывает и не переносит; поглощение периодом объявлено «нет», у событийного вида — пусто`);
})();

/* эскалация — по общему правилу: руководителю исполнителя на 5-й р.д. просрочки */
(() => {
  ZD.seed();
  pollOn('2026-10-01', '2026-10-06', '2026-10-26', '2026-11-02');
  const aug = anLast(AN_P('ШО-12', AUG));
  const early = ZD.state.tasks.some(t => t.povodKey === `pk-overdue|task:${aug.id}|`);
  pollOn('2026-11-05');
  const esc = ZD.state.tasks.find(t => t.povodKey === `pk-overdue|task:${aug.id}|`);
  ok(180, !early && esc && esc.assignee === 'E16' && ZD.chiefOf('E27') === 'E16' && !esc.queue &&
       ZD.state.notifications.some(n => n.taskId === aug.id && n.kind === 'срок-истёк' && n.to === 'E27'),
    `август ШО-12 просрочен с 29.10: заведующему — «срок истёк», 02.11 эскалации ещё нет, 05.11 (5-й р.д.) — задание «Просрочено задание» ` +
    `его руководителю Токтосунову; особого адресата эскалации и неразобранной очереди у вида нет`);
})();

/* суммы нет, свёртка — общий порог, «чей повод» — Анализ */
(() => {
  ZD.seed();
  pollOn('2026-10-01');
  const rows = ZD.taskRows().filter(r => /^pk-an-/.test(r.kind || ''));
  ok(181, ['pk-an-decision', 'pk-an-no-review'].every(k => ZD.kindOf(k).sumAttr === null && ZD.ruleForKind(k).rollup === null && ZD.rollupOf(ZD.ruleForKind(k)) === 10) &&
       rows.length === 5 && rows.every(r => r.owner === 'Анализ' && r.sumAttr === null),
    `у видов анализа реквизита суммы нет — денежного объекта нет; порог свёртки — умолчание 10; строки статистике несут «чей повод» — Анализ`);
})();

/* молчит анализ — замерзают только его поводы */
(() => {
  ZD.seed();
  pollOn('2026-10-01');
  const t = anLast(AN_P('ШО-04', Q2));
  pollOn('2026-10-12', '2026-10-14');
  at('2026-10-20'); const r = ZD.runPoll({ downSources: ['analysis'] });
  const frozen = ZD.state.povods.filter(p => /^pk-an-/.test(p.kind) && p.status === 'frozen').length;
  const live = ZD.state.povods.filter(p => /^pk-an-/.test(p.kind) && p.status !== 'gone').length;
  ok(182, !r.complete && r.sources.find(s => s.src === 'analysis').answer === 'таймаут' && frozen === live && frozen > 0 &&
       ZD.state.povods.filter(p => !/^pk-an-/.test(p.kind) && p.status === 'frozen').length === 0 && !ZD.isTerminal(t),
    `20.10 анализ не ответил: его ${frozen} повода заморожены, утверждённый ОБ-7 задание по II кварталу не закрыл — ждёт ответа; ` +
    `поводы остальных источников не тронуты`);
})();

/* демо-карточка обзора: утверждает заведующий отделом анализа или руководство; утверждение закрывает период */
(() => {
  ZD.seed();
  pollOn('2026-10-01');
  const aug = anLast(AN_P('ШО-12', AUG));
  at('2026-10-12');
  const analyst = throws(() => ZD.anStep('ОБ-9', 'E26', 'утвердить'));
  const twice = throws(() => ZD.anStep('ОБ-2', 'E27', 'утвердить'));
  ZD.anStep('ОБ-9', 'E27', 'утвердить');
  ZD.runPoll();
  const o = ZD.outcomeOf(aug);
  ok(183, /заведующий/.test(analyst) && /уже утверждён/.test(twice) && o.outcome === 'исполнено' && o.by === 'E27' &&
       ZD.describePovod(ZD.povodByKey(AN_P('ШО-12', AUG))).indexOf('период 01.08.2026—31.08.2026') !== -1 &&
       ZD.describePovod(ZD.povodByKey(AN_D('ОБ-3'))).indexOf('Ошская область') !== -1,
    `в демо-карточке шаблона ОБ-9 утверждает заведующий, не аналитик; утверждённый — повторно нельзя; утверждение ОБ-9 за август по ` +
    `всему портфелю — на опросе 12.10 задание по августу «исполнено»`);
})();

/* ---------- W. Настройка реестров (волна макета 13) ---------- */

/* правит только администратор заданий, с основанием, с даты сегодня или будущей */
(() => {
  ZD.seed();
  const user = throws(() => setRule('rule-gd-review', 'dueN', 7, 'E7'));
  const bare = throws(() => ZD.editRule('rule-gd-review', { dueN: 7 }, { by: 'E4' }));
  const past = throws(() => ZD.editRule('rule-gd-review', { dueN: 7 }, { by: 'E4', basis: 'приказ', from: '2026-09-01' }));
  const sw = throws(() => ZD.deactivateKind('pk-org-orphan-terr', 'E7', 'приказ'));
  ok(184, /администратор/.test(user) && /основание/.test(bare) && /задним числом/.test(past) && /администратор/.test(sw) &&
       ZD.isTasksAdmin('E4') && !ZD.isTasksAdmin('E7') && ZD.ruleForKind('gd-review').editions.length === 1,
    `правку правила и рубильник принимает только администратор заданий (Абдразакова): заведующий отделом программ — отказ; ` +
    `без основания — отказ; дата начала в прошлом — отказ; ни одна попытка не дала редакции`);
})();

/* редакция хранит значения, дату начала и основание; ожидающая одна — заменяется или отменяется */
(() => {
  ZD.seed();
  const r = ZD.ruleForKind('gd-review');
  const e2 = ZD.editRule(r.id, { dueN: 7 }, { by: 'E4', basis: 'приказ №40 от 01.09.2026', from: '2026-09-10' });
  const waits = ZD.pendingEdition(r) === e2 && r.dueN === 5 && r.edN === 1;
  const sameDay = throws(() => ZD.editRule(r.id, { dueN: 6 }, { by: 'E4', basis: 'записка' }));
  const e3 = ZD.editRule(r.id, { dueN: 8 }, { by: 'E4', basis: 'приказ №41', from: '2026-09-15' });
  const replaced = !!e2.cancelled && ZD.pendingEdition(r) === e3;
  ZD.cancelEdition(r.id, e3.n, 'E4', 'приказ №41 отменён');
  const none = ZD.pendingEdition(r) === null && !!e3.cancelled;
  const e4 = ZD.editRule(r.id, { dueN: 7 }, { by: 'E4', basis: 'приказ №42', from: '2026-09-10' });
  at('2026-09-09'); ZD.runPoll();
  const before = r.dueN;
  at('2026-09-10'); ZD.runPoll();
  ok(185, waits && /ждёт редакция/.test(sameDay) && replaced && none && before === 5 && r.dueN === 7 && r.edN === e4.n &&
       e4.was === 1 && e4.values.dueN === 7 && r.editions[0].values.dueN === 5 && e4.basis === 'приказ №42' && e4.by === 'E4',
    `приказ с будущей датой вносится заранее: редакция ${e2.n} ждёт 10.09, правило до неё — 5 р.д.; правка «сегодня» при ` +
    `ожидающей — отказ; будущая ${e3.n} заменила ${e2.n}, затем отменена с основанием; редакция ${e4.n} вступила сама 10.09 ` +
    `(9-го ещё 5) и хранит «было 5 → стало 7», основание и автора правки`);
})();

/* выданное держит снимок: разбор вала после правки — срок и автор по редакции вала */
(() => {
  ZD.seed();
  setRule('rule-org-head-vacant', 'rollup', 1);
  ZD.runPoll();
  const val = ZD.state.tasks.find(t => t.originKind === 'pk-org-head-vacant' && t.rollupKeys);
  ZD.editRule('rule-org-head-vacant', { dueN: 9, author: 'post-admin' }, { by: 'E4', basis: 'приказ №43' });
  const pieces = ZD.splitRollup(val.id, val.assignee);
  const fresh = ZD.state.tasks.find(t => t.originKind === 'pk-org-head-vacant' && t.povodKey && pieces.indexOf(t) === -1);
  ok(186, val.ruleEdition === 2 && pieces.length === 2 &&
       pieces.every(t => t.ruleEdition === 2 && t.dueDate === ZD.addWorkdays('2026-09-02', 2) && t.author === 'E16') &&
       ZD.ruleForKind('pk-org-head-vacant').edN === 3 && fresh && fresh.ruleEdition === 2 && fresh.dueDate === ZD.addWorkdays('2026-09-02', 2),
    `вал выдан по редакции 2; правило переправлено (срок 9, автор — администратор); разбор вала дал поштучные по снимку вала — ` +
    `редакция 2, срок 2 р.д., поручил заместитель директора; поштучное, выданное раньше правки, тоже не тронуто`);
})();

/* автор правила — должность; автор задания — держатель на дату выдачи; вакантна — администратор */
(() => {
  ZD.seed();
  ZD.runPoll();
  const stat = ZD.state.tasks.find(t => t.originKind === 'pk-stat-neighbor-silent');
  const gd = ZD.state.tasks.find(t => t.originKind === 'gd-review');
  const posts = ZD.state.rules.every(r => ZD.POSTS.some(p => p.id === r.author));
  ok(187, posts && gd.author === 'E7' && gd.authorPost === 'post-lp' && ZD.approverOf(gd) === 'E7' &&
       stat.author === 'E4' && stat.authorPost === 'post-stat' && stat.authorVia === 'вакантна' &&
       ZD.ruleForKind('pk-im-unsold').author === 'post-assets' && ZD.ruleForKind('doc-sign').author === 'post-office' &&
       ZD.ruleForKind('pk-overdue').author === 'post-admin',
    `у всех 60 правил автор — должность, а не фамилия: «Рассмотреть госрешение» поручил заведующий отделом программ ` +
    `(Мамбетов) — он и утверждает продление; у «сосед статистики молчит» должность «Руководитель аналитики» вакантна — ` +
    `поручил администратор модуля, с отметкой; имущество — начальник Управления, документ — канцелярия, самоопрос — администратор`);
})();

/* контролёр и важность правятся редакцией; выданное держит снимок */
(() => {
  ZD.seed();
  ZD.editRule('rule-org-orphan-terr', { controller: 'автор', importance: 'низкая' }, { by: 'E4', basis: 'служебная записка №7' });
  ZD.runPoll();
  const t = ZD.state.tasks.find(x => x.originKind === 'pk-org-orphan-terr');
  const other = ZD.state.tasks.find(x => x.originKind === 'pk-org-acting-expiring');
  ZD.editRule('rule-org-orphan-terr', { controller: null, importance: 'высокая' }, { by: 'E4', basis: 'служебная записка №8' });
  ok(188, t.controller === 'E16' && t.controller === t.author && t.importance === 'низкая' && other.controller === null &&
       other.importance === ZD.actionOf(other.action).importance && t.controller === 'E16' && t.importance === 'низкая' &&
       ZD.ruleForKind('pk-org-orphan-terr').controller === null && ZD.ruleForKind('pk-org-orphan-terr').importance === 'высокая',
    `в правиле «территория без подразделения» контролёр — автор, важность — низкая: задание выдано с контролёром ` +
    `(заместитель директора) и низкой важностью; соседнее правило без правки — по действию; следующая редакция задание не трогает`);
})();

/* порог свёртки — поле правила, правится редакцией с основанием; у вида его нет */
(() => {
  ZD.seed();
  const e = setRule('rule-org-head-vacant', 'rollup', 1);
  const r = ZD.ruleForKind('pk-org-head-vacant');
  ok(189, ZD.state.povodKinds.every(k => !('rollup' in k)) && e.values.rollup === 1 && e.by === 'E4' && e.basis === 'приказ' &&
       r.editions.length === 2 && ZD.rollupOf(r) === 1 && r.editions[0].values.rollup === null,
    `порога свёртки у вида больше нет: он в правиле и меняется редакцией — с автором правки и основанием, прежнее значение ` +
    `(умолчание 10) остаётся в редакции 1`);
})();

/* род вида: шаг и самоопрос — всегда авто; ручной и рубильник — только у надзора */
(() => {
  ZD.seed();
  const g = x => ZD.state.povodKinds.filter(k => k.genus === x).length;
  const step = throws(() => setRule('rule-doc-sign', 'mode', 'ручной'));
  const self = throws(() => setRule('rule-overdue', 'mode', 'ручной'));
  const nad = setRule('rule-pk-im-unsold', 'mode', 'ручной');
  ok(190, g('самоопрос') === 9 && g('шаг') === 24 && g('надзор') === 28 && /всегда авто/.test(step) && /всегда авто/.test(self) &&
       nad.values.mode === 'ручной' && ZD.checkRegistry().length === 0,
    `род объявлен у всех 61 вида: самоопрос 9, шаг 24 (согласования, заявка на передачах работы, документ), надзор 28; ` +
    `ручной режим у шага подписи и у самоопроса — отказ, у надзора «не продан» — новая редакция; реестр сходится`);
})();

/* ручной режим: «решить по поводам» автору; новые поводы — в открытое; перевод в авто — нерешённые поручаются */
(() => {
  ZD.seed();
  setRule('rule-stat-silent', 'mode', 'ручной');
  ZD.runPoll();
  const t = ZD.state.tasks.find(x => x.decide && x.originKind === 'pk-stat-neighbor-silent');
  const n0 = t.rollupKeys.length, own = t.assignee;
  const alien = throws(() => ZD.decidePovods(t.id, t.rollupKeys, 'поручить', 'E7'));
  at('2026-09-04'); ZD.runPoll();
  const added = t.journal.filter(e => e.ev === 'ключ добавлен').length, label = t.label, st = ZD.lastEv(t);
  setRule('rule-stat-silent', 'mode', 'авто');
  ZD.runPoll();
  const issued = ZD.state.tasks.filter(x => x.originKind === 'pk-stat-neighbor-silent' && !x.decide);
  const o = ZD.outcomeOf(t);
  ok(191, n0 === 1 && own === 'E4' && /автор/.test(alien) && added === 1 && /2 шт\./.test(label) && st === 'принято' && issued.length === 2 &&
       o.outcome === 'снято' && /переведено в авто/.test(o.reason) && ZD.state.tasks.filter(x => x.decide).length === 1,
    `правило «сосед статистики молчит» в ручном: прогон 02.09 — «решить» на 1 повод автору (должность вакантна — ` +
    `администратор); чужой решать не может; 04.09 второй повод добавлен в то же открытое «решить» (2 шт.); правило переведено в авто — ` +
    `оба нерешённых поручены сами, «решить» снято`);
})();

/* ручной режим: свёртки нет; не решил в срок — обычная просрочка; кнопки «поручить вручную» нет */
(() => {
  ZD.seed();
  setRule('rule-org-head-vacant', 'rollup', 1);
  setRule('rule-org-head-vacant', 'mode', 'ручной');
  ZD.runPoll();
  const t = ZD.state.tasks.find(x => x.decide);
  const rolled = ZD.state.tasks.some(x => x.originKind === 'pk-org-head-vacant' && x.rollupKeys && !x.decide);
  at('2026-09-15'); ZD.runPoll();
  const ov = ZD.state.povods.find(p => p.kind === 'pk-overdue' && p.objectId === t.id);
  const ovTask = ov && ZD.state.tasks.find(x => x.povodKey === ov.key);
  ok(192, t.rollupKeys.length === 3 && !rolled && t.dueDate === '2026-09-04' && !!ovTask && ovTask.assignee === 'E4' &&
       typeof ZD.issueManual === 'undefined',
    `порог 1 при ручном режиме вал не выдал — все 3 повода в «решить»; автор не решил к 04.09 — 15.09 «Просрочено задание» ` +
    `руководителю автора; кнопки «поручить все разом» больше нет`);
})();

/* вернувшийся повод снова в открытом «решить» — живой, без второй строки */
(() => {
  ZD.seed();
  setRule('rule-org-head-vacant', 'mode', 'ручной');
  ZD.runPoll();
  const t = ZD.state.tasks.find(x => x.decide);
  const [k1] = t.rollupKeys;
  ZD.decidePovods(t.id, [k1], 'не поручать', 'E16', 'конкурс объявлен');
  ZD.povodByKey(k1).status = 'gone'; // повод отпал и вернулся
  ZD.runPoll();
  ok(198, t.rollupKeys.length === 3 && ZD.liveKeys(t).length === 3 && !ZD.isTerminal(t) && ZD.lastEv(t) === 'принято',
    `повод, по которому решили «не поручать», отпал и вернулся — снова живой в том же «решить», без второй строки; ` +
    `состояние «решить» — по-прежнему в работе`);
})();

/* порог появления — настройка соседа: правило его не хранит, сверка не пропускает */

(() => {
  ZD.seed();
  ZD.runPoll();
  const n30 = ZD.state.povods.filter(p => p.kind === 'lp-expiring').length;
  ZD.seed();
  ZD.state.neighborSet.lp.expiringDays = 10;
  ZD.runPoll();
  const n10 = ZD.state.povods.filter(p => p.kind === 'lp-expiring').length;
  ZD.seed();
  ZD.ruleForKind('ap-stuck-new').threshold = 12;
  const errs = ZD.checkRegistry();
  ok(193, n30 > n10 && !('threshold' in ZD.ruleForKind('lp-expiring')) && errs.some(e => /настройка соседа/.test(e)),
    `«Истекает» — настройка программ: 30 к.д. дают ${n30} повода, 10 к.д. — ${n10}; правило заданий порога не хранит, а ` +
    `подложенный в правило порог сверка реестра ловит`);
})();

/* блок «Откуда задание» в карточке */
(() => {
  ZD.seed();
  ZD.runPoll();
  const t = ZD.state.tasks.find(x => x.originKind === 'gd-review');
  const h = ZD.renderOrigin(t, ZD.povodByKey(t.povodKey));
  ok(194, /Откуда задание/.test(h) && h.indexOf('Заведующий отделом кредитных программ — Мамбетов') !== -1 &&
       h.indexOf('редакция 1 с 01.09.2026 · основание: подключение соседа «Госрешение» · правка: выпуск 1') !== -1 &&
       h.indexOf('5 р.д. от выдачи · источник: внутренний акт') !== -1 && /род вида: шаг/.test(h) &&
       h.indexOf("ZD.showRule('rule-gd-review')") !== -1,
    `в карточке — повод (вид, объект, с какой даты, признаки, род), правило с редакцией, датой и основанием, кто поручил ` +
    `(должность и человек), откуда срок и ссылка на правило в реестре`);
})();

/* один вид — одно правило; правило называет существующие вид и действие */
(() => {
  ZD.seed();
  const r = ZD.ruleForKind('pk-org-orphan-terr');
  ZD.state.rules.push(Object.assign({}, r, { id: 'rule-dup' }), Object.assign({}, r, { id: 'rule-bad', kind: 'pk-nope', action: 'act-nope' }));
  const errs = ZD.checkRegistry();
  ZD.runPoll();
  ok(195, errs.some(e => /правил 2/.test(e)) && errs.some(e => /pk-nope.*не заведён/.test(e)) && ZD.ruleForKind('pk-org-orphan-terr') === null &&
       ZD.state.povods.some(p => p.kind === 'pk-org-orphan-terr') && !ZD.state.tasks.some(t => t.originKind === 'pk-org-orphan-terr'),
    `второе правило на вид и правило на незаведённый вид сверка ловит; вид с двумя правилами повод видит, но не поручает ` +
    `ни по одному — первое попавшееся не берётся`);
})();

/* выпуск правит только свои поля — новой редакцией, деловые значения прода сохраняет */
(() => {
  ZD.seed();
  setRule('rule-org-orphan-terr', 'dueN', 4);
  const e = ZD.releaseRule('rule-org-orphan-terr', 14, { addressee: { by: 'должность', who: 'администратор модуля' } });
  const bad = throws(() => ZD.releaseRule('rule-org-orphan-terr', 14, { dueN: 2 }));
  const r = ZD.ruleForKind('pk-org-orphan-terr');
  ok(196, e.by === 'выпуск 14' && e.values.dueN === 4 && r.dueN === 4 && r.addressee.by === 'должность' && r.edN === e.n &&
       /поле прода/.test(bad),
    `выпуск 14 сменил адресата новой редакцией и сохранил срок 4, поставленный администратором по приказу; срок выпуском ` +
    `не меняется`);
})();

/* «вид повода не введён в действие» — самоопрос в авторежиме, автор — администратор заданий */
(() => {
  ZD.seed();
  const k = ZD.kindOf('pk-org-liq-blocked'); k.activatedAt = null; k.createdAt = '2026-08-28'; // пришёл выпуском, не введён
  ZD.runPoll();
  const r = ZD.ruleForKind('pk-kind-inactive');
  const t = ZD.state.tasks.filter(x => x.originKind === 'pk-kind-inactive');
  ok(197, r.mode === 'авто' && r.author === 'post-admin' && t.length === 1 && t[0].assignee === 'E4' && !t[0].decide &&
       !ZD.state.tasks.some(x => x.decide),
    `вид «ликвидация заблокирована» пришёл выпуском 28.08 и не введён — прогон 02.09 сам выдал задание «ввести вид в действие» ` +
    `администратору, без «решить по поводам»: самоопрос ручным не бывает`);
})();


/* ---------- X. Входящие от дашборда: строки «Задание», очередь «Мои задания», обязательство одним видом ---------- */
const REP_DUE = 'pk-rep-obligation-due';
const repTask = re => ZD.state.tasks.find(t => t.originKind === REP_DUE && re.test(t.povodKey || ''));
const overOf = id => ZD.state.tasks.filter(t => t.originKind === 'pk-overdue' && (t.povodKey || '').indexOf(`task:${id}|`) !== -1);
const walk = (until, hooks = {}) => { // по рабочим дням от сегодняшнего: прогон в конце дня, действия людей — до него
  for (let d = ZD.state.today; d <= until; d = ZD.addWorkdays(d, 1)) { at(d); if (hooks[d]) hooks[d](); ZD.runPoll(); }
};
const outc = t => (ZD.outcomeOf(t) || {});

/* реестр: новый вид — надзор с исполнением у владельца, старый выведен выпуском и рубильником не возвращается */
(() => {
  ZD.seed();
  const k = ZD.kindOf(REP_DUE), old = ZD.kindOf('pk-rep-obligation-overdue'), r = ZD.ruleForKind(REP_DUE);
  const src = ZD.SOURCES.find(s => s.id === 'reports');
  walk('2026-10-06');
  const back = throws(() => ZD.activateKind('pk-rep-obligation-overdue', 'E4', 'приказ'));
  ok(199, k.genus === 'надзор' && k.ownerExec && k.addrForm === 'очередь' && k.take === 'через очередь' &&
       old.retiredAt === '2026-10-06' && src.kinds.length === 2 && src.kinds.includes(REP_DUE) &&
       r.dueUnit === 'beforeDate' && r.dueN === 0 && r.addressee.by === 'очередь' && !('threshold' in r) &&
       ZD.checkRegistry().length === 0 && /выведен выпуском/.test(back) && !ZD.activeOn(old, '2026-10-06') &&
       !ZD.state.povods.some(p => p.kind === 'pk-rep-obligation-overdue' && p.status === 'appeared'),
    `ЗДБ-8/13/14 — у отчётности два вида: «срок сдачи близко или прошёл» (надзор, очередь роли, работа у владельца, срок — ` +
    `${r.dueN} к.д. до срока сдачи) и выведенный 06.10 выпуском «срок истёк» — рубильник его не возвращает («${back}»); ` +
    `«числа изменились» поводом не стал; реестр сходится`);
})();

/* порог «близко» — настройка отчётности, 7 к.д.: повод с 08.10 под срок 15.10 */
(() => {
  ZD.seed();
  walk('2026-10-07');
  const on7 = !!repTask(/sopr/);
  walk('2026-10-08');
  const p = ZD.state.povods.find(x => x.kind === REP_DUE && /sopr/.test(x.key));
  ZD.seed(); ZD.state.neighborSet.rp.soonDays = 3;
  walk('2026-10-09');
  const on3 = !!repTask(/sopr/);
  walk('2026-10-12');
  ok(200, !on7 && p && p.stateDate === '2026-10-08' && p.traits.состояние === 'срок близко' && !on3 && !!repTask(/sopr/),
    `ЗДБ-10 — при настройке отчётности «за 7 к.д.» повода 07.10 нет, 08.10 есть (дата состояния 08.10, «срок близко»); ` +
    `отчётность поставила 3 к.д. — 09.10 повода нет, 12.10 есть; у правила заданий порога нет`);
})();

/* адресат — очередь роли «Отчётность» подразделения, за которым обязательство */
(() => {
  ZD.seed();
  walk('2026-10-08');
  const s = repTask(/sopr/), kp = repTask(/kp/), gf = repTask(/overdue\/2026-10-01\/gf/);
  ZD.state.viewer = 'E6'; const e6 = ZD.queueTasks('role').map(t => t.id);
  ZD.state.viewer = 'E3'; const e3 = ZD.queueTasks('role').map(t => t.id);
  ok(201, s && kp && gf && s.queue.role === 'rep-sopr' && kp.queue.role === 'rep-kp' && gf.queue.role === 'rep-gf' &&
       !s.assignee && e6.includes(kp.id) && !e6.includes(s.id) && e3.includes(s.id) && !e3.includes(kp.id) &&
       ZD.queueHolders(s).join() === 'E1,E3',
    `ЗДБ-9 — три задания «${ZD.actionOf('act-rep-due').label}» в три очереди роли «Отчётность»: Сопровождения (E1, E3), ` +
    `Кредитных программ (E6), Головного филиала (E9); чужую очередь носитель не видит`);
})();

/* срок — за N к.д. до срока сдачи; прошедший к выдаче — 1 р.д. от выдачи; N правится редакцией, в том числе 0 */
(() => {
  ZD.seed();
  walk('2026-10-06');
  const loans = repTask(/t-loans/);
  setRule('rule-rep-due', 'dueN', 2);
  walk('2026-10-08');
  const s = repTask(/sopr/);
  const zero = throws(() => setRule('rule-rep-due', 'dueN', '0'));
  ok(202, loans && loans.journal[0].t === '2026-10-06' && loans.dueDate === '2026-10-07' && s && s.dueDate === '2026-10-13' &&
       zero === '' && ZD.ruleForKind(REP_DUE).dueN === 0 && /к\.д\. до срока сдачи/.test(ZD.dueText(ZD.ruleForKind(REP_DUE))),
    `ЗДБ-11 — форма со сроком 05.10 к вводу вида 06.10 уже просрочена: срок задания ${loans && loans.dueDate} (1 р.д. от выдачи), ` +
    `а не 05.10; правило «за 2 к.д.» дало сдаче к 15.10 срок ${s && s.dueDate}; «0» принимается — в самый день срока`);
})();

/* исполнение у владельца: выпуск закрывает задание с атрибуцией, снятие формы — «снято» с причиной отчётности */
(() => {
  ZD.seed();
  walk('2026-10-30', { '2026-10-09': () => ZD.take(repTask(/kp/).id, 'E6') });
  const s = repTask(/sopr/), kp = repTask(/kp/), loans = repTask(/t-loans/);
  ok(203, outc(s).outcome === 'исполнено' && ZD.lastEv(s) === 'закрыто' && s.journal.slice(-1)[0].t === '2026-10-14' &&
       s.journal.slice(-1)[0].by === 'E3' && outc(kp).outcome === 'исполнено' && kp.journal.slice(-1)[0].t === '2026-10-26' &&
       outc(loans).outcome === 'снято' && /снята с расписания/.test(outc(loans).reason || ''),
    `ЗДБ-12 — Сопровождение: в работу никто не взял, 14.10 Нурланова выпустила окончательно — «исполнено», выпустила E3; ` +
    `Кредитные программы: взяла E6, выпустила 26.10 — «исполнено» после срока; «Сведения о выданных кредитах» сняты с ` +
    `расписания 30.10 — «снято: ${outc(loans).reason}»`);
})();

/* прошёл срок — то же задание просрочено; дальше общий механизм: очередь — руководителю роли сразу, взявший — его руководителю на 5-й р.д. */
(() => {
  ZD.seed();
  walk('2026-10-26', { '2026-10-09': () => ZD.take(repTask(/kp/).id, 'E6') });
  const gf = repTask(/overdue\/2026-10-01\/gf/), kp = repTask(/kp/);
  const pov = ZD.state.povods.find(x => x.kind === REP_DUE && /overdue\/2026-10-01\/gf/.test(x.key));
  const gfEsc = overOf(gf.id), kpEsc = overOf(kp.id);
  const first = gfEsc.find(t => /\|никто не взял$/.test(t.povodKey));
  const kpE = kpEsc[0];
  ok(204, pov && pov.journal.filter(j => /появился/.test(j.ev)).length === 1 && pov.traits.состояние === 'просрочено' &&
       !ZD.isTerminal(gf) && first && first.assignee === 'E10' && first.journal[0].t === '2026-10-16' &&
       kpE && kpE.assignee === 'E7' && kpE.journal[0].t === '2026-10-22' && ZD.isTerminal(kp),
    `ЗДБ-8/9 — Головной филиал: один повод с 08.10, в день срока не сменился — 16.10 он «просрочено», задание то же, ` +
    `открыто; никто не взял — 16.10 задание Иманалиеву (руководитель подразделения роли); Кредитные программы: взяла E6, ` +
    `просрочила — 22.10 (5-й р.д.) задание её руководителю Мамбетову; 26.10 выпуск закрыл и её задание`);
})();

/* вывод вида выпуском: «снято: вид выведен» — только задание, чей повод держался бы и без вывода; отпавшее — обычным порядком */
(() => {
  ZD.seed();
  ZD.state.owner.rp.filter(o => o.period === 'июнь 2026').forEach(o => { o.ev = o.ev.filter(e => !e.issue); }); // июнь так и не сдан
  ZD.runPoll();
  const open = ZD.state.tasks.filter(t => t.originKind === 'pk-rep-obligation-overdue' && !ZD.isTerminal(t)).map(t => t.id);
  at('2026-10-06'); ZD.runPoll();
  const after = open.map(ZD.taskOf);
  const povs = ZD.state.povods.filter(p => p.kind === 'pk-rep-obligation-overdue');
  const gone = povs.every(p => p.status !== 'appeared') && povs.every(p => (p.journal.slice(-1)[0] || {}).reason !== 'поручения не было');
  ZD.seed(); ZD.runPoll(); // июнь сдан 08.09–15.09, а прогона между 02.09 и 06.10 не было
  const skip = ZD.state.tasks.filter(t => t.originKind === 'pk-rep-obligation-overdue' && !ZD.isTerminal(t)).map(t => t.id);
  at('2026-10-06'); ZD.runPoll();
  const skipAfter = skip.map(ZD.taskOf);
  ZD.seed(); walk('2026-10-06'); // день за днём: задания отпали в сентябре
  const lapsed = ZD.state.tasks.filter(t => t.originKind === 'pk-rep-obligation-overdue');
  ok(205, open.length > 0 && after.every(t => outc(t).outcome === 'снято' && outc(t).reason === 'вид выведен выпуском') && gone &&
       skipAfter.length > 0 && skipAfter.every(t => outc(t).reason !== 'вид выведен выпуском') &&
       lapsed.length > 0 && lapsed.every(t => ZD.lastEv(t) === 'отпало'),
    `ЗНС-1 — июнь не сдан: ${open.length} задания старого вида 06.10 закрыты «снято: вид выведен выпуском», у поводов — та же ` +
    `причина, не «поручения не было»; июнь сдан, а прогона между 02.09 и 06.10 не было — задания ` +
    `«${skipAfter.map(t => ZD.deriveState(t)).join('», «')}», выпуск их не закрывает; при ежедневном опросе — ` +
    `${lapsed.length} задания «отпало» ждут разбора`);
})();

/* «Мои» — нетерминальные, где я исполнитель или действую за исполнителя; контролёр — нет; закрытые — отдельно; меню — то же число */
(() => {
  ZD.seed();
  walk('2026-09-10');
  ZD.state.viewer = 'E3';
  const mineE3 = ZD.queueTasks('mine');
  const forE1 = mineE3.filter(t => t.assignee === 'E1');
  ZD.state.viewer = 'E4';
  const ctl = ZD.state.tasks.filter(t => t.controller === 'E4' && t.assignee !== 'E4' && !ZD.isTerminal(t));
  const mineE4 = ZD.queueTasks('mine');
  ZD.state.viewer = 'E3';
  const seenE3 = ZD.queueTasks('dept'), closedE1 = ZD.state.tasks.filter(t => t.assignee === 'E1' && ZD.isTerminal(t) && ZD.visibleTo(t, 'E3'));
  const early = forE1.length > 0 && mineE3.every(t => !ZD.isTerminal(t)) && ctl.length > 0 && ctl.every(t => !mineE4.includes(t)) &&
    closedE1.length > 0 && closedE1.every(t => seenE3.includes(t));
  walk('2026-10-26', { '2026-10-09': () => ZD.take(repTask(/kp/).id, 'E6') });
  ZD.state.viewer = 'E6';
  const m = ZD.queueTasks('mine'), c = ZD.queueTasks('closed'), kp = repTask(/kp/);
  ok(206, early && m.every(t => !ZD.isTerminal(t)) && c.includes(kp) && !m.includes(kp) && c.every(t => ZD.isTerminal(t) && t.assignee === 'E6'),
    `ЗДБ-2/4 — 10.09 Нурланова замещает Есенову (командировка): ${forE1.length} заданий E1 в «Мои» у E3, закрытых там нет; задания, где E4 только ` +
    `контролёр (${ctl.length}), в его «Мои» нет; закрытые задания E1 (${closedE1.length}) замещающая видит в «Видимые мне»; у E6 26.10 задание по форме закрыто — оно в свёрнутых «Мои закрытые», не в «Мои»`);
})();

/* плитка «Мои задания» по строкам дня сходится с очередью строка в строку — у каждого и в разные дни */
(() => {
  ZD.seed();
  const VIEW = ['E1','E2','E3','E4','E5','E6','E7','E9','E10','E21','E22'];
  const bad = [], seen = [];
  const check = () => VIEW.forEach(v => {
    ZD.state.viewer = v;
    const t = ZD.myTile(v, ZD.state.today), m = ZD.queueTasks('mine'), q = ZD.queueTasks('role');
    const over = m.filter(x => ZD.dueOf(x) < ZD.state.today && ['поручено','принято','возвращено'].includes(ZD.lastEv(x))).length;
    if (t.mine !== m.length || t.overdue !== over || t.queues !== q.length || t.light !== (over > 0 ? 'красный' : 'норма'))
      bad.push(`${ZD.state.today} ${v}: плитка ${t.mine}/${t.overdue}/${t.queues}, очередь ${m.length}/${over}/${q.length}`);
    if (t.mine || t.queues) seen.push(`${v} ${t.mine}·${t.overdue}·${t.queues}`);
  });
  const days = ['2026-09-03','2026-09-10','2026-10-08','2026-10-16','2026-10-22'];
  ZD.seed();
  for (const d of days) { walk(d, { '2026-10-09': () => ZD.take(repTask(/kp/).id, 'E6') }); check(); }
  at('2026-10-16'); ZD.state.viewer = 'E9';
  ok(207, bad.length === 0 && seen.length > 10,
    `ЗДБ-3/16 — по ${VIEW.length} людям на ${days.length} дат «мои · просрочено · в очередях» из строк дня совпали с ` +
    `очередью; просрочено — только где ход за исполнителем (не «ожидает приёмки», «отказано», «отпало»); светофор красный при просрочке${bad.length ? ' · расхождения: ' + bad.slice(0, 3).join('; ') : ''}; ` +
    `например ${seen.slice(-3).join(', ')}`);
})();

/* строка — одна на задание на дату; закрытые остаются, вал — одна строка с числом ключей */
(() => {
  ZD.seed();
  walk('2026-10-16', { '2026-10-09': () => ZD.take(repTask(/kp/).id, 'E6') });
  const rows = ZD.taskRows('2026-10-16'), early = ZD.taskRows('2026-09-02');
  const ids = rows.map(r => r.task), val = rows.find(r => r.genus === 'вал');
  const closed = rows.filter(r => r.closed);
  const total = ZD.state.tasks.filter(t => t.journal[0].t <= '2026-10-16').length;
  ZD.seed();
  at('2026-10-05'); setRule('rule-rep-due', 'mode', 'ручной');
  walk('2026-10-08');
  const dec = ZD.state.tasks.find(t => t.decide && t.ruleId === 'rule-rep-due');
  const k6 = dec && ZD.taskRows('2026-10-06').find(r => r.task === dec.id), k8 = dec && ZD.taskRows('2026-10-08').find(r => r.task === dec.id);
  ok(208, k6 && k8 && k6.genus === 'решить' && k6.keys === 1 && k8.keys === 4 &&
       new Set(ids).size === ids.length && ids.length === total &&
       early.length < rows.length && early.every(r => r.issued <= '2026-09-02') && val && val.keys === val.rollupKeys.length && val.keys > 1 &&
       closed.length > 0 && rows.every(r => r.date === '2026-10-16'),
    `ЗДБ-5 — на 16.10 ${rows.length} строк, по одной на задание, из них закрытых ${closed.length}; на 02.09 — ${early.length} ` +
    `(только выданные к той дате); вал ${val && val.task} — одна строка, ключей ${val && val.keys}; «решить по поводам» ` +
    `при ручном правиле — на 06.10 ключей ${k6 && k6.keys}, на 08.10 — ${k8 && k8.keys}`);
})();

/* состав строки и состояние на дату: одно задание в четыре дня; охват — исполнитель, у очереди — роль */
(() => {
  ZD.seed();
  walk('2026-10-26', { '2026-10-09': () => ZD.take(repTask(/kp/).id, 'E6') });
  const id = repTask(/kp/).id, row = d => ZD.taskRows(d).find(r => r.task === id);
  const a = row('2026-10-08'), b = row('2026-10-09'), c = row('2026-10-20'), e = row('2026-10-26');
  const gf = ZD.taskRows('2026-10-20').find(r => r.task === repTask(/overdue\/2026-10-01\/gf/).id);
  const sopr = ZD.taskRows('2026-10-16').find(r => r.task === repTask(/sopr/).id);
  ok(209, a.assignee === null && a.queueRole === 'rep-kp' && a.dept === 'Кредитные программы' && /поручено/i.test(a.state) && !a.overdue &&
       b.assignee === 'E6' && b.queueRole === null && /принято|в работе/i.test(b.state) &&
       c.overdue && c.overdueWd === 3 && c.closed === null && e.closed === '2026-10-26' && e.outcome === 'исполнено' && !e.overdue &&
       a.genus === 'по правилу' && a.kindGenus === 'надзор' && a.importance === 'высокая' && a.authorPost && a.keys === 1 &&
       gf.assignee === null && gf.dept === 'Головной филиал' && gf.overdue && sopr.closed && sopr.dept === 'Сопровождение' && sopr.queueRole === null,
    `ЗДБ-6/7 — задание ${id}: 08.10 «${a.state}» в очереди «Отчётность · Кредитные программы», охват — подразделение роли; ` +
    `09.10 «${b.state}» у E6; 20.10 просрочено ${c.overdueWd} р.д.; 26.10 закрыто «${e.outcome}»; род — по правилу, вид — ` +
    `надзор, важность высокая; неразобранная очередь Головного филиала — в охвате своего подразделения; закрытое без ` +
    `взятия задание Сопровождения на 16.10 — тоже`);
})();

/* действие «действует за исполнителя» на дату — в строке; «лично» — без замещения */
(() => {
  ZD.seed();
  walk('2026-09-14');
  const r = ZD.taskRows('2026-09-10').filter(x => x.assignee === 'E1' && !x.closed);
  const after = ZD.taskRows('2026-09-14').filter(x => x.assignee === 'E1' && !x.closed);
  const pers = x => !!x.kind && ZD.kindOf(x.kind).personal;
  ok(210, r.filter(x => !pers(x)).length > 0 && r.filter(x => !pers(x)).every(x => x.actingFor === 'E3') &&
       r.filter(pers).length > 0 && r.filter(pers).every(x => x.actingFor === null) && after.length > 0 && after.every(x => x.actingFor === null),
    `ЗДБ-6 — строки на 10.09: у ${r.filter(x => !pers(x)).length} открытых заданий Есеновой «действует за исполнителя» — ` +
    `Нурланова (командировка 09.09–12.09), у ${r.filter(pers).length} «лично» (голос члена комиссии) — пусто; на 14.09 ` +
    `замещения нет — у ${after.length} строк поле пусто`);
})();

/* обязательство не основание свободного поручения; демо-карточка: выпускает только носитель роли подразделения */
(() => {
  ZD.seed();
  walk('2026-10-12');
  const s = repTask(/sopr/);
  const free = throws(() => ZD.createFreeTask({ label:'сдать форму', assignee:'E1', controller:'E2', author:'E2', dueDate:'2026-10-15',
    basis:'t-overdue/2026-10-01/sopr' }));
  const stranger = throws(() => ZD.repIssue('t-overdue/2026-10-01/sopr', 'E6'));
  const okIssue = throws(() => ZD.repIssue('t-overdue/2026-10-01/sopr', 'E1'));
  const twice = throws(() => ZD.repIssue('t-overdue/2026-10-01/sopr', 'E3'));
  ZD.runPoll();
  ZD.repIssue('t-overdue/2026-10-01/kp', 'E6');                      // в стенде Кредитные программы выпускают 26.10 — поздно
  const kpLater = ZD.obligationAt(ZD.state.owner.rp.find(o => o.id === 't-overdue/2026-10-01/kp'), '2026-10-30');
  ok(211, /нет/.test(free) && /подразделение, за которым/.test(stranger) && okIssue === '' && /уже закрыто/.test(twice) &&
       outc(s).outcome === 'исполнено' && s.journal.slice(-1)[0].by === 'E1' && kpLater.state === 'сдано' && kpLater.issued.t === '2026-10-12',
    `ЗДБ-15/12 — основание свободного поручения — только обзор анализа, обязательство отбито как любое другое («${free}»); в карточке отчётности чужой выпуск отбит, ` +
    `12.10 выпустила Есенова — прогон закрыл задание «исполнено», выпустила E1; выпуск Кредитных программ 12.10 — на 30.10 ` +
    `обязательство «${kpLater.state}» от 12.10, повторный выпуск 26.10 его не перекрыл`);
})();


/* ---------- отчёт ---------- */

const pass = results.filter(r => r.pass).length;
const lines = results.map(r => `   ${r.pass ? 'PASS' : 'FAIL'}  #${r.n}  ${r.note}`);
console.log(`SMOKE ${new Date().toISOString().slice(0,10)} · ${pass}/${results.length} PASS\n` + lines.join('\n'));

process.exit(pass === results.length ? 0 : 1);
