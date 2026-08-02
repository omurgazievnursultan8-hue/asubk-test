# Волна ЗС · пересев затравки мокапа «Взыскание» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** заменить накопленную затравку `mockups/collection/collection.html` на декларацию из 40 ситуаций (92 дела), которую разворачивает в дела билдер канонических цепочек, — так, чтобы аудит достоверности давал 0 находок.

**Architecture:** `SEED` — плоский массив кейсов (~10 строк на кейс). `buildSeed(SEED)` разворачивает каждый кейс в дело: считает даты хребта назад от «возраста» последней вехи, выводит `overdueDays` и дату открытия, пишет `LEDGER`, эмитит меры с номерами/основаниями/суммами/вручением, ставит коллегиальные вопросы под гейты, выводит сроки из мер, вешает заседания под судебные меры, собирает историю. `PROCESSES = buildSeed(SEED)`. Прежний литерал `PROCESSES` (строки 2421–4386) удаляется целиком.

**Tech Stack:** один self-contained HTML с инлайновым JS (ES2020, без сборки); проверка — Playwright-скрипты `scripts/inspect/collection-data-audit.mjs` (достоверность затравки) и `scripts/inspect/collection-check.mjs` (смоук экранов); `node` без зависимостей кроме `playwright-core` + системный Chrome.

## Global Constraints

- Рабочий каталог — worktree `/home/azamat/projects/asubk-credit-module/.claude/worktrees/vzyskanie`. Не `cd` в основной чекаут.
- `TODAY = '21.07.2026'` (строка ~6501) не меняется. Все даты затравки — относительно него.
- Даты в данных — строки `dd.mm.yyyy`. Суммы в мерах — строки формата `'420 000,00'`. Деньги в `LEDGER` — числа.
- Виды мер берутся ТОЛЬКО из `MEASURE_KINDS` (51 вид), исходы — только из `outcomes` своего вида, каналы вручения — только из `DELIVERY_CHANNELS_CLAIM = ['СЭД','Почта','Нарочно']`, органы — только из `ORGANS`, предметы вопросов — только из `CQ_SUBJECTS`, шаблоны сроков — только из `DEADLINE_TEMPLATES` (n = 1…45).
- Номер меры уникален по всей затравке.
- Спека: `docs/superpowers/specs/2026-08-01-collection-seed-rebuild-design.md`.
- Тестов в репозитории нет; роль тестов играют два скрипта выше. «Красный» шаг = скрипт печатает находки/провалы, «зелёный» = 0.
- Коммиты — русские, Conventional Commits, с `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

---

## File Structure

| Файл | Что делает | Изменение |
|------|------------|-----------|
| `mockups/collection/collection.html` | мокап целиком: модель, билдер, декларация, экраны | правки модели (3 места), новый блок «ЗС · билдер», новый `SEED`, удаление литерала `PROCESSES`, `LEDGER`, `COSTS_SEED` |
| `scripts/inspect/collection-data-audit.mjs` | аудит достоверности затравки | добавить итоговую строку счёта находок |
| `scripts/inspect/collection-check.mjs` | смоук экранов, ~648 проверок | точечная правка ассертов, завязанных на исчезнувшие дела |
| `mockups/collection/ASUBK-status-razrabotki.md` | журнал волн | новый раздел «Волна ЗС» |
| `mockups/collection/ASUBK-vzyskanie-logika.md` | логика модуля | §17 — новые числа затравки, снятие трёх тупиков |

Билдер и декларация живут в том же `<script>`, что и модель: `SPINE` + `buildSeed()` ставятся НА МЕСТО удалённого литерала (после `msComputeRows`, до `const REAL_STAGES`), `SEED` — сразу за ними. Порядок важен: `normalize()` ниже по файлу и вызывается позже, на готовом `PROCESSES`.

---

### Task 1: Правки модели — три тупика ДС-М1/М2/М3 + счётчик находок в аудите

**Files:**
- Modify: `mockups/collection/collection.html` (`SECTION_CLEVEL` ~1906, `MEASURE_KINDS` — «Требование поручителю» ~1272, «Требование гаранту» ~1275, «Заявление об установлении правопреемника» ~1392)
- Modify: `scripts/inspect/collection-data-audit.mjs` (хвост скрипта)

**Interfaces:**
- Produces: фазы «Претензия» достижима мерами обеспечителям; фаза «Заявление об установлении правопреемника» устанавливается своей мерой; раздел «Безнадёжная» — ступень 4. На это опирается вся дальнейшая затравка (ситуации 6, 26, 27, 31–35).

- [ ] **Шаг 1: снять базовые числа (красный)**

Run:
```bash
node scripts/inspect/collection-data-audit.mjs 2>&1 | grep -c '"code"'
node scripts/inspect/collection-check.mjs 2>&1 | tail -5
```
Expected: аудит печатает 34; смоук — 648 проверок, 19 провалов (известный хвост РР). Записать оба числа в тело будущего коммита.

- [ ] **Шаг 2: добавить в аудит итоговую строку**

В конце `scripts/inspect/collection-data-audit.mjs`, там где печатается результат, дописать после `console.log(JSON.stringify(out, null, 1))`:

```js
console.log(`ИТОГО находок: ${out.findings.length} · дел: ${out.procCount} · требований: ${out.reqCount}`);
```

- [ ] **Шаг 3: проверить, что строка печатается**

Run: `node scripts/inspect/collection-data-audit.mjs 2>&1 | tail -1`
Expected: `ИТОГО находок: 34 · дел: 127 · требований: 139`

- [ ] **Шаг 4: ДС-М3 — «Безнадёжная» параллельна банкротству**

В `SECTION_CLEVEL` заменить:

```js
const SECTION_CLEVEL = { 'Досудебный':1, 'Внесудебный залог':2, 'Судебный':2, 'Правопреемство':2, 'Исполнительное':3, 'Банкротство':4, 'Безнадёжная':4 };
```

Рядом комментарий:

```js
/* ЗС/ДС-М3: было 5 — безнадёжность стояла ВЫШЕ банкротства, и признать задолженность
   безнадёжной можно было только пройдя процедуру банкротства. Для ликвидированного
   юрлица, умершего заёмщика и приговора это бессмыслица: ступень 4 — параллельно
   банкротству, после исполнительного производства. */
```

- [ ] **Шаг 5: ДС-М1 — требования обеспечителям ставят фазу**

В `MEASURE_KINDS` у видов «Требование поручителю» и «Требование гаранту» дописать `setsPhase:'Претензия'` каждому исходу:

```js
  { name:'Требование поручителю', source:'наш документ', resultIsDocument:false,
    /* ЗС/ДС-М1: без setsPhase требование к обеспечителю навсегда оставалось в К0 —
       любая судебная мера к нему падала на гейте стадии, хотя претензионный порядок
       к поручителю пройден тем же документом, что и к заёмщику. */
    outcomes:[{value:'погашено',setsPhase:'Претензия'},{value:'отказ от погашения',setsPhase:'Претензия'},
              {value:'без ответа',setsPhase:'Претензия'}],
    needsDelivery:true, deliveryChannels:DELIVERY_CHANNELS_CLAIM, basisKinds:null },
  { name:'Требование гаранту', source:'наш документ', resultIsDocument:false,
    outcomes:[{value:'погашено',setsPhase:'Претензия'},{value:'отказ от погашения',setsPhase:'Претензия'},
              {value:'без ответа',setsPhase:'Претензия'}],
    needsDelivery:true, deliveryChannels:DELIVERY_CHANNELS_CLAIM, basisKinds:null },
```

- [ ] **Шаг 6: ДС-М2 — первая фаза К5 достижима**

Вид «Заявление об установлении правопреемника» перестаёт быть `resultIsDocument` и получает исход:

```js
  { name:'Заявление об установлении правопреемника', source:'наш документ', resultIsDocument:false,
    /* ЗС/ДС-М2: вид был resultIsDocument, первую фазу К5 не ставил никто, а
       «Решение суда (отсутствие правопреемника)» требует её предшественницей —
       вторая фаза контура была недостижима вовсе. */
    outcomes:[{value:'подано',setsPhase:'Заявление об установлении правопреемника'}],
    needsDelivery:false, deliveryChannels:null, basisKinds:null },
```

- [ ] **Шаг 7: прогнать аудит — находок меньше**

Run: `node scripts/inspect/collection-data-audit.mjs 2>&1 | tail -1`
Expected: находок заметно меньше 34 (ожидаемо 5–15: часть старых дел получит новые расхождения — они уйдут вместе со старой затравкой в задаче 2). Ошибок страницы (`pageerrors: []`) быть не должно.

- [ ] **Шаг 8: смоук не сломался**

Run: `node scripts/inspect/collection-check.mjs 2>&1 | tail -5`
Expected: 0 ошибок консоли; число провалов не выросло против шага 1.

- [ ] **Шаг 9: коммит**

```bash
git add mockups/collection/collection.html scripts/inspect/collection-data-audit.mjs
git commit -m "$(cat <<'EOF'
fix(collection): три модельных тупика ДС-М1/М2/М3 сняты

Требования поручителю и гаранту ставят фазу «Претензия» — требование к
обеспечителю больше не висит в К0. Заявление об установлении правопреемника
ставит первую фазу К5 — вторая фаза контура стала достижимой. Раздел
«Безнадёжная» опущен на ступень 4, параллельно банкротству: ликвидация,
смерть заёмщика и приговор не требуют процедуры банкротства.

Аудит печатает итоговый счёт находок.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Каркас билдера + первые три ситуации (К0), старая затравка удалена

**Files:**
- Modify: `mockups/collection/collection.html` — удалить `const LEDGER = {…}` (~2182–2323), `const COSTS_SEED = {…}` (~2324–2336), `const PROCESSES = [ … ];` (~2421–4386); на их место поставить блок ЗС.

**Interfaces:**
- Produces: `SPINE`, `RU(date)`/`ruAdd(date, days)`, `buildSeed(SEED) → [дело]`, `LEDGER`, `COSTS_SEED`, `PROCESSES`. Все дальнейшие задачи только дописывают записи в `SEED` и, при нужде, ветки в `BRANCHES`.
- Consumes: справочники `MEASURE_KINDS`, `KIND_SECTION`, `DEADLINE_TEMPLATES`, `ORGANS`, `GATES`, `DELIVERY_CHANNELS_CLAIM`, `TODAY` — уже есть в файле выше по тексту.

- [ ] **Шаг 1: удалить старую затравку**

Удалить три литерала (`LEDGER`, `COSTS_SEED`, `PROCESSES`) целиком. Комментарий-шапку `ДЕМО-ДАННЫЕ` и хелпер `const D = (event, registered) => …` сохранить — `D` используется билдером.

- [ ] **Шаг 2: убедиться, что страница падает (красный)**

Run: `node scripts/inspect/collection-data-audit.mjs 2>&1 | head -3`
Expected: `pageerrors` содержит `ReferenceError: PROCESSES is not defined` — ровно то, что чинит следующий шаг.

- [ ] **Шаг 3: билдер**

На место удалённого поставить:

```js
/* ============================================================
   ЗС · ЗАТРАВКА = ДЕКЛАРАЦИЯ + БИЛДЕР.
   92 дела с полной цепочкой вех — это ~3500 строк литерала, и связность в них
   держится вниманием автора. Ровно так накопились 235 находок аудита волны ДС.
   Здесь кейс объявляется десятью строками, а цепочку, даты, суммы, номера,
   основания, гейты, сроки и историю выводит код — противоречить самому себе
   ему негде.
   ============================================================ */

/* Календарь: рабочих дней в модуле нет (производственного календаря не существует,
   см. СК-3), поэтому «10 р.д.» разворачивается в 14 календарных — единица одна. */
const ruAdd = (ru, days) => addDaysRu(ru, days);
const ruSub = (ru, days) => addDaysRu(ru, -days);

/* ХРЕБЕТ — канонический маршрут К1→К3→К4. Ключ ступени = значение `stop` у кейса.
   gap — календарных дней от ПРЕДЫДУЩЕЙ ступени. Первая отсчитывается от 6-го дня
   просрочки (Р-4), то есть от даты открытия дела. */
const SPINE = [
  { key:'претензия',    kind:'Первичная претензия', gap:14, scope:'просроченная сумма',
    outcome:'отказ от погашения', purpose:'погашение просроченной задолженности', pre:'ПР', suf:'/1' },
  { key:'повторная',    kind:'Повторная претензия', gap:24, scope:'просроченная сумма',
    outcome:'отказ от погашения', purpose:'погашение + предупреждение о судебном взыскании', pre:'ПР', suf:'/2' },
  { key:'записка',      kind:'Служебная записка в ДПО', gap:14, scope:null,
    outcome:null, purpose:'передача пакета для судебного взыскания', pre:'СЗ' },
  { key:'иск',          kind:'Исковое заявление', gap:14, scope:'полный остаток',
    outcome:null, purpose:'взыскание задолженности в судебном порядке', pre:'ИСК' },
  { key:'определение',  kind:'Определение о принятии искового заявления к производству', gap:10, scope:null,
    outcome:'принято к производству', purpose:'принятие иска к производству', pre:'ОПР' },
  { key:'решение',      kind:'Решение суда', gap:35, scope:null,
    outcome:'иск удовлетворён полностью', purpose:'взыскание задолженности', pre:'РС' },
  { key:'ил',           kind:'Исполнительный лист', gap:30, scope:'полный остаток',
    outcome:'выдан', purpose:'принудительное исполнение решения суда', pre:'ИЛ' },
  { key:'постановление',kind:'Постановление на исполнении', gap:14, scope:null,
    outcome:'принято к исполнению', purpose:'возбуждение исполнительного производства', pre:'ИП' },
];
const SPINE_KEYS = SPINE.map(s => s.key);

/* Вид меры → шаблон срока, который она ПОРОЖДАЕТ (снимается следующей мерой). */
const DEADLINE_BY_KIND = {
  'Первичная претензия':6, 'Повторная претензия':8, 'Служебная записка в ДПО':41,
  'Исковое заявление':45, 'Определение о принятии искового заявления к производству':26,
  'Решение суда':27,
};

/* Деньги: LEDGER пишется из debt кейса, суммы вех читаются оттуда же по охвату. */
const money = n => n.toLocaleString('ru-RU', {minimumFractionDigits:2, maximumFractionDigits:2}).replace(/ /g,' ');

function buildSeed(seed){
  const procs = [];
  for(const c of seed){
    const dbt = c.credit.debt;
    LEDGER[c.credit.id] = { asOf:'25.07.2026',
      principal:{ accrued:dbt.principal, paid:dbt.paid||0, overdue:dbt.principal-(dbt.paid||0) },
      interest:{ accrued:dbt.interest||0, paid:0, overdue:dbt.interest||0 },
      penalty:{ accrued:dbt.penalty||0, paid:0, overdue:dbt.penalty||0 } };
    const overdueSum = (dbt.principal-(dbt.paid||0)) + (dbt.interest||0) + (dbt.penalty||0);
    const fullSum    = dbt.principal + (dbt.interest||0) + (dbt.penalty||0) - (dbt.paid||0);
    const sumBy = scope => money(scope === 'полный остаток' ? fullSum : overdueSum);

    /* Даты назад: последняя веха стоит `age` дней назад от TODAY, остальные — по gap. */
    const stopAt = SPINE_KEYS.indexOf(c.stop);
    const steps  = stopAt < 0 ? [] : SPINE.slice(0, stopAt+1);
    const dates  = [];
    let d = ruSub(TODAY, c.age ?? 12);
    for(let i=steps.length-1; i>=0; i--){ dates[i] = d; d = ruSub(d, steps[i].gap); }
    const opened = steps.length ? ruSub(dates[0], SPINE[0].gap) : ruSub(TODAY, (c.overdue ?? 8) - 5);
    /* Дело открывается на 6-й день просрочки (Р-4) — просрочка отсчитывается отсюда. */
    const overdueStart = ruSub(opened, 5);
    const overdueDays  = Math.round((dParse(TODAY) - dParse(overdueStart)) / D_MS);

    const measures = [], deadlines = [], history = [];
    let prevNum = null;
    /* Охват держится ПОСЛЕДНЕЙ устанавливающей мерой (ADR-0025): определение, решение и
       ИЛ своего охвата не задают, но сумма у них уже по «полному остатку» — иначе
       аудит увидит расхождение вехи с притязанием (код C4). */
    let curScope = 'просроченная сумма';
    steps.forEach((s, i) => {
      const num = `${s.pre}-${c.credit.id}${s.suf||''}`;
      const kd  = kindOf(s.kind);
      if(s.scope) curScope = s.scope;
      const m = { sec:sectionOf(s.kind), kind:s.kind, dates:D(dates[i], dates[i]), num,
                  purpose:s.purpose, responsible:c.curator, sum:sumBy(curScope) };
      if(s.outcome) m.outcome = s.outcome;
      if(s.scope)   m.scope = { volume:s.scope, method:c.method || 'деньгами' };
      if(kd.source === 'внешний акт') m.received = { date:dates[i] };
      if(kd.needsDelivery){
        const ch = c.channel || 'Почта';
        m.sent   = { date:dates[i], channel:ch };
        m.served = { date:dates[i], doc: ch==='СЭД' ? 'квитанция СЭД'
                                    : ch==='Нарочно' ? 'акт вручения нарочно'
                                    : 'почтовое уведомление о вручении' };
      }
      if(kd.basisKinds && prevNum) m.basedOn = prevNum;
      measures.push(m);
      prevNum = num;
      history.push({ when:`${dates[i]} 10:00`, what:`Мера «${s.kind}» ${num} зарегистрирована`, who:c.curator });
    });

    /* Срок порождает ПОСЛЕДНЯЯ мера: предыдущие сняты своими продолжениями. */
    const last = steps[steps.length-1];
    if(last && DEADLINE_BY_KIND[last.kind]){
      const tpl = TPL_BY_N[DEADLINE_BY_KIND[last.kind]];
      deadlines.push({ tpl:tpl.n, due:ruAdd(dates[dates.length-1], c.dueIn ?? 14),
                       base:`${tpl.base} (${dates[dates.length-1]})` });
    }

    /* Гейт: мера гейтового вида в цепочке → вопрос органу, решённый ДО неё. */
    const committeeQuestions = [];
    for(const [kind, g] of Object.entries(GATES)){
      const m = measures.find(x => x.kind === kind);
      if(!m) continue;
      const at = ruSub(m.dates.event, 10);
      committeeQuestions.push({ organ:g.organ, initiator:c.credit.subdiv || 'ОД', topic:g.topic,
        credits:[c.credit.num], meetingDate:at,
        decision: g.poruchenie ? 'поручение выдано' : 'разрешено', positive:true,
        protocolNo:`ПР-${c.id}`, protocolDate:at });
    }

    procs.push({ id:c.id, borrower:c.borrower, inn:c.inn, region:c.region,
      owner:c.owner, curator:c.curator, opened, openedBy:c.openedBy || 'система',
      basis:c.basis || 'просрочка 6 дней',
      poruchenie: measures.some(m => m.kind === 'Исковое заявление'),
      credits:[{ id:c.credit.id, num:c.credit.num, overdueDays,
                 subdiv:c.credit.subdiv, bezakceptRight:c.credit.bezakcept }],
      measures, committeeQuestions,
      hearings:c.hearings || [], colls:c.colls || [],
      ...(c.extra || {}),
      /* extra ставится ПЕРЕД этими двумя: сроки и история кейса ДОПОЛНЯЮТ выведенные,
         а не затирают их — иначе дело с конфликтом интересов теряло бы срок претензии. */
      deadlines:[...deadlines, ...((c.extra && c.extra.deadlines) || [])],
      history:[...history, ...((c.extra && c.extra.history) || [])]
        .sort((a, b) => dParse(b.when.slice(0,10)) - dParse(a.when.slice(0,10))) });
  }
  return procs;
}

const LEDGER = {};
const COSTS_SEED = {};
```

Порядок объявлений в файле: `const LEDGER = {}` и `const COSTS_SEED = {}` должны стоять **перед** `buildSeed`-вызовом, но после определения функции; проще объявить их сразу над `function buildSeed`, а вызов `const PROCESSES = buildSeed(SEED);` поставить после `SEED`.

- [ ] **Шаг 4: декларация трёх ситуаций К0**

Сразу за билдером:

```js
/* ЗС · КАТАЛОГ. Код ситуации в поле sit — по нему кейсы группируются и ищутся. */
const SEED = [
  // ── K0-ОКНО · окно ожидания зачисления открыто, гейт претензии закрыт ──
  { sit:'K0-ОКНО', id:'201', borrower:'ОсОО «Жаны-Баштоо»', inn:'02501202400118',
    region:'г. Бишкек / Свердловский', owner:'Куратор ОД', curator:'Асанова Ж.Т.',
    credit:{ id:'201', num:'Дог. №201 от 02.03.2025', subdiv:'ОД',
             debt:{ principal:120000, interest:6000, penalty:2000, paid:0 } },
    stop:null, overdue:8,
    extra:{ window:{ open:true, days:5, until:'24.07.2026', closedBy:null, gateDay:'11', claimDay:'20' } } },
];
const PROCESSES = buildSeed(SEED);
```

Ещё два кейса ситуации `K0-ОКНО` (`id:'202'`, `id:'203'`) — те же поля, другие заёмщик/ИНН/регион/куратор/суммы и `overdue` 7 и 9.

- [ ] **Шаг 5: страница поднимается, аудит чист**

Run: `node scripts/inspect/collection-data-audit.mjs 2>&1 | head -3 && node scripts/inspect/collection-data-audit.mjs 2>&1 | tail -1`
Expected: `pageerrors: []`, `ИТОГО находок: 0 · дел: 3 · требований: 3`

- [ ] **Шаг 6: глазами — реестр рисуется**

Run: `node scripts/inspect/collection-check.mjs 2>&1 | tail -20`
Expected: ошибок консоли 0. Провалов будет много — ассерты ждут старых дел; это чинится задачей 11, сейчас важно только «0 ошибок консоли».

- [ ] **Шаг 7: коммит**

```bash
git add mockups/collection/collection.html
git commit -m "$(cat <<'EOF'
refactor(collection): затравка стала декларацией + билдером цепочек

Литералы PROCESSES, LEDGER и COSTS_SEED удалены. Кейс объявляется десятью
строками, а цепочку вех, даты, суммы, номера, основания, гейты, сроки и
историю выводит buildSeed: даты считаются назад от возраста последней вехи,
дата открытия и просрочка — из них, суммы из LEDGER по охвату.

Пока засеяна одна ситуация K0-ОКНО (три дела), аудит 0 находок.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Ситуации К0 целиком — окно закрыто, ретро-закрытие

**Files:**
- Modify: `mockups/collection/collection.html` (`SEED`)

**Interfaces:**
- Consumes: `buildSeed`, поле `extra` для оверлеев дела.
- Produces: ситуации `K0-ЗАКР` (2 дела: 204, 205), `K0-РЕТРО` (2 дела: 206, 207).

- [ ] **Шаг 1: дописать K0-ЗАКР**

```js
  // ── K0-ЗАКР · окно закрыто: истечение срока / досрочная отметка куратора ──
  { sit:'K0-ЗАКР', id:'204', borrower:'ИП Мамытова А.', inn:'21903198500071',
    region:'Чуйская обл. / Сокулукский', owner:'Куратор ОД', curator:'Осмоналиев Т.',
    credit:{ id:'204', num:'Дог. №204 от 18.01.2025', subdiv:'ОД',
             debt:{ principal:86000, interest:3000, penalty:900, paid:0 } },
    stop:null, overdue:13,
    extra:{ window:{ open:false, days:5, until:'16.07.2026', closedBy:'истечение срока' } } },
  { sit:'K0-ЗАКР', id:'205', borrower:'ОсОО «Кен-Сай»', inn:'01808202100263',
    region:'Ошская обл. / Кара-Суйский', owner:'Куратор ОД', curator:'Жээнбеков Н.',
    credit:{ id:'205', num:'Дог. №205 от 05.05.2024', subdiv:'ОД',
             debt:{ principal:54000, interest:2100, penalty:600, paid:0 } },
    stop:null, overdue:11,
    extra:{ window:{ open:false, days:5, until:'18.07.2026', closedBy:'отметка куратора' },
      history:[{ when:'17.07.2026 10:20', what:'Окно ожидания закрыто досрочно: «переговоры проведены, платёж не подтверждён» (п. 17.2)', who:'Куратор ОД' }] } },
```

- [ ] **Шаг 2: дописать K0-РЕТРО**

```js
  // ── K0-РЕТРО · ретро-закрытие Р-9, подтверждённая задержка казначейства Р-11 ──
  { sit:'K0-РЕТРО', id:'206', borrower:'ОсОО «Кут-Инвест»', inn:'01502201700882',
    region:'Иссык-Кульская обл. / Джети-Огузский', owner:'Куратор ОД', curator:'Осмонов К.',
    credit:{ id:'206', num:'Дог. №206 от 12.02.2025', subdiv:'ОД',
             debt:{ principal:74000, interest:0, penalty:0, paid:74000 } },
    stop:null, overdue:9,
    extra:{ retro:true,
      credits0:{ treasuryDelay:{ days:12, doc:'ПП-4471 от 08.07.2026', confirmedBy:'СРМК', date:'09.07.2026' } },
      history:[{ when:'10.07.2026 09:15', what:'Платёж подтверждён задним числом (задержка казначейства 12 дн, ПП-4471) → процесс закрыт ретроспективно (Р-9), скрыт из рабочего списка', who:'СРМК' }] } },
```

Поле `credits0` — оверлей на первый (единственный) кредит дела; поддержать его в билдере одной строкой в конце сборки кредита:

```js
      credits:[Object.assign({ id:c.credit.id, num:c.credit.num, overdueDays,
                 subdiv:c.credit.subdiv, bezakceptRight:c.credit.bezakcept }, c.credits0 || {})],
```

Второй кейс `K0-РЕТРО` (`id:'207'`) — та же форма, задержка 8 дней, другой заёмщик.

- [ ] **Шаг 3: аудит**

Run: `node scripts/inspect/collection-data-audit.mjs 2>&1 | tail -1`
Expected: `ИТОГО находок: 0 · дел: 7 · требований: 7`

- [ ] **Шаг 4: коммит**

```bash
git add mockups/collection/collection.html
git commit -m "$(cat <<'EOF'
feat(collection): затравка — контур К0, семь дел

K0-ОКНО (3), K0-ЗАКР (2), K0-РЕТРО (2). Оверлей на кредит задаётся полем
credits0 — задержка казначейства живёт там, где ей место.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Контур К1 — девять ситуаций, 22 дела

**Files:**
- Modify: `mockups/collection/collection.html` (`SEED`, при нужде — ветка безакцепта в билдере)

**Interfaces:**
- Consumes: `SPINE` (ступени `претензия`, `повторная`, `записка`).
- Produces: ситуации `K1-ПРЕТ1` (3), `K1-ПРЕТ2` (3), `K1-ОБЕСП` (3), `K1-БА-ГЕЙТ` (2), `K1-БА-ИСП` (3), `K1-БА-НЕТ` (2), `K1-ПАУЗА-ГП` (2), `K1-ПАУЗА-РЕСТР` (2), `K1-СТОРНО` (2). Номера дел 210, 301–321.

- [ ] **Шаг 1: ветка безакцепта в билдере**

Хребет заканчивается на `записка`; безакцепт — условная ступень К1 и в хребет не входит. Добавить в билдер после сборки хребта:

```js
    /* Условная ступень К1 (§3.4): регистрируется только там, где право есть по договору
       И гейт комитета пройден. Гейт ставится общим циклом ниже — по наличию меры. */
    if(c.bezakceptOutcome){
      const dt = ruAdd(dates[dates.length-1], 20);
      measures.push({ sec:'Досудебный', kind:'Платёжное требование в банк', dates:D(dt, dt),
        num:`ПТ-${c.credit.id}`, purpose:'списание со счетов в обслуживающих банках',
        outcome: c.bezakceptOutcome === 'не исполнено' ? 'не исполнено' : 'исполнено',
        sum:sumBy('просроченная сумма'), responsible:c.curator });
      const dt2 = ruAdd(dt, 10);
      measures.push({ sec:'Досудебный', kind:'Безакцептное списание', dates:D(dt2, dt2),
        num:`БА-${c.credit.id}`, purpose:'безакцептное списание просроченной суммы',
        outcome:c.bezakceptOutcome, basedOn:`ПТ-${c.credit.id}`,
        scope:{ volume:'просроченная сумма', method:'деньгами' },
        sum:sumBy('просроченная сумма'), responsible:c.curator });
    }
```

- [ ] **Шаг 2: гейт без решения — блокирующая ситуация**

Там же, в цикле гейтов: если у кейса стоит `gateOpen:false`, вопрос пишется без решения, а самой гейтовой меры в цепочке нет (она просто не объявлена):

```js
    if(c.gatePending){
      const g = GATES[c.gatePending];
      const at = ruSub(TODAY, 6);
      committeeQuestions.push({ organ:g.organ, initiator:c.credit.subdiv || 'ОД', topic:g.topic,
        credits:[c.credit.num], meetingDate:at, decision:'', positive:false,
        protocolNo:null, protocolDate:null });
    }
```

- [ ] **Шаг 3: 22 кейса К1**

Образцы по одному на ситуацию, остальные — той же формы с другими заёмщиками/суммами:

```js
  // ── K1-ПРЕТ1 · первичная претензия, срок исполнения 14 к.д. идёт ──
  { sit:'K1-ПРЕТ1', id:'301', borrower:'ОсОО «Береке-Агро»', inn:'02804202000441',
    region:'Чуйская обл. / Сокулукский', owner:'Куратор ДАК', curator:'Токтосунова Б.',
    credit:{ id:'301', num:'Дог. №301 от 14.03.2025', subdiv:'ДАК',
             debt:{ principal:64000, interest:2600, penalty:800, paid:0 } },
    stop:'претензия', age:6, channel:'СЭД' },

  // ── K1-ПРЕТ2 · повторная претензия, срок истёк, записка в ДПО ──
  { sit:'K1-ПРЕТ2', id:'304', borrower:'ОсОО «Ак-Кеме Трейд»', inn:'01912201610558',
    region:'г. Ош / Ошский', owner:'Куратор ДАК', curator:'Токтосунова Б.',
    credit:{ id:'304', num:'Дог. №304 от 02.11.2024', subdiv:'ДАК',
             debt:{ principal:112000, interest:5400, penalty:2600, paid:0 } },
    stop:'записка', age:9 },

  // ── K1-ОБЕСП · требование поручителю (третья координата требования) ──
  { sit:'K1-ОБЕСП', id:'307', borrower:'ОсОО «Бек Кабель»', inn:'01912201610212',
    region:'г. Бишкек / Первомайский', owner:'Куратор ДАК', curator:'Тукинова А.С.',
    credit:{ id:'307', num:'Дог. №307 от 10.04.2024', subdiv:'ДАК',
             debt:{ principal:140000, interest:6000, penalty:6300, paid:0 } },
    stop:'повторная', age:11,
    obligors:[{ id:'п-307', name:'Асанов Т. М.', inn:'22505198700345', kind:'физлицо',
                role:'поручитель', credits:['307'], basis:'договор поручительства ДП-307/1 от 10.04.2024' }],
    guarantorClaim:{ kind:'Требование поручителю', num:'ТП-307' } },

  // ── K1-БА-ГЕЙТ · право есть, комитет не решил ──
  { sit:'K1-БА-ГЕЙТ', id:'310', borrower:'ОсОО «Манас-Ресурс»', inn:'01808202100264',
    region:'г. Бишкек / Свердловский', owner:'Куратор ДАК', curator:'Токтосунова Б.',
    credit:{ id:'310', num:'Дог. №310 от 08.08.2024', subdiv:'ДАК', bezakcept:true,
             debt:{ principal:98000, interest:4200, penalty:1900, paid:0 } },
    stop:'повторная', age:8, gatePending:'Безакцептное списание' },

  // ── K1-БА-ИСП · гейт пройден, списание исполнено частично ──
  { sit:'K1-БА-ИСП', id:'312', borrower:'ОсОО «Чуй-Дан»', inn:'02902201900155',
    region:'Чуйская обл. / Аламудунский', owner:'Куратор ДАК', curator:'Токтосунова Б.',
    credit:{ id:'312', num:'Дог. №312 от 21.09.2024', subdiv:'ДАК', bezakcept:true,
             debt:{ principal:76000, interest:3100, penalty:1200, paid:0 } },
    stop:'повторная', age:34, bezakceptOutcome:'частично исполнено' },

  // ── K1-ПАУЗА-ГП · гарантийное письмо, п. 18 ──
  { sit:'K1-ПАУЗА-ГП', id:'317', borrower:'ОсОО «Ынтымак-Курулуш»', inn:'01502201700340',
    region:'г. Бишкек / Первомайский', owner:'Куратор ДАК', curator:'Токтосунова Б.',
    credit:{ id:'317', num:'Дог. №317 от 12.06.2024', subdiv:'ДАК',
             debt:{ principal:54000, interest:2400, penalty:1100, paid:0 } },
    stop:'повторная', age:15,
    extra:{ settlement:{ type:'guarantee_letter', point:'18', until:'20.09.2026',
      note:'заёмщик направил гарантийное письмо; отсрочка ≤70 к.д. При нарушении — возобновление безакцепта в 10 р.д.' } } },

  // ── K1-ПАУЗА-РЕСТР · реструктуризация, п. 19 ──
  { sit:'K1-ПАУЗА-РЕСТР', id:'319', borrower:'ОсОО «Кара-Балта Кант»', inn:'01607201800623',
    region:'Чуйская обл. / Московский', owner:'Куратор ОД', curator:'Осмоналиев Т.',
    credit:{ id:'319', num:'Дог. №319 от 04.04.2024', subdiv:'ОД',
             debt:{ principal:230000, interest:11000, penalty:5400, paid:0 } },
    stop:'повторная', age:20,
    extra:{ settlement:{ type:'restructuring', point:'19', until:'18.09.2026', on:'заёмщик',
      note:'обращение заёмщика о реструктуризации, письмо в уполномоченный госорган направлено' } } },

  // ── K1-СТОРНО · дубль повторной претензии сторнирован ──
  { sit:'K1-СТОРНО', id:'320', borrower:'ОсОО «Ош-Курулуш»', inn:'01502201700701',
    region:'г. Ош / Ошский', owner:'Куратор ДАК', curator:'Бекболотов Р.',
    credit:{ id:'320', num:'Дог. №320 от 19.05.2024', subdiv:'ДАК',
             debt:{ principal:47000, interest:1900, penalty:700, paid:0 } },
    stop:'повторная', age:10, storno:true },
```

Поддержать в билдере два новых поля:

```js
    /* Требование обеспечителю — своя мера, целится в требование поручителя/гаранта
       (normalize выведет цель по виду). */
    if(c.guarantorClaim){
      const dt = dates[dates.length-1];
      const kd2 = kindOf(c.guarantorClaim.kind);
      measures.push({ sec:'Досудебный', kind:c.guarantorClaim.kind, dates:D(dt, dt),
        num:c.guarantorClaim.num, purpose:'солидарное исполнение обязательства',
        outcome:'отказ от погашения', sent:{ date:dt, channel:'СЭД' },
        served:{ date:dt, doc:'квитанция СЭД' },
        scope:{ volume:'просроченная сумма', method:'деньгами' },
        sum:sumBy('просроченная сумма'), responsible:c.curator });
    }
    /* Сторно — дубль последней меры: строка остаётся зачёркнутой и фазу не двигает (И-3). */
    if(c.storno){
      const src = measures[measures.length-1];
      const dt = ruAdd(src.dates.event, 1);
      measures.push({ ...src, dates:D(dt, dt), num:`${src.num}-дубль`, basedOn:src.num,
        storno:{ reason:`дубль ${src.num} — зарегистрирована повторно по ошибке`,
                 by:c.curator, at:ruAdd(dt, 1) } });
    }
```

- [ ] **Шаг 4: аудит**

Run: `node scripts/inspect/collection-data-audit.mjs 2>&1 | tail -1`
Expected: `ИТОГО находок: 0 · дел: 29 · требований: 30` (одно дело с поручителем даёт второе требование).

- [ ] **Шаг 5: коммит**

```bash
git add mockups/collection/collection.html
git commit -m "$(cat <<'EOF'
feat(collection): затравка — контур К1, 22 дела

Претензии, требования обеспечителям, безакцепт (право/гейт/исход), паузы
п. 18 и п. 19, сторнированный дубль. Безакцепт и требование поручителю
разворачиваются ветками билдера, гейт без решения ставит вопрос без меры.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Контур К2 — внесудебный залог, 5 дел

**Files:**
- Modify: `mockups/collection/collection.html` (`SEED`, ветка извещения в билдере)

**Interfaces:**
- Produces: `K2-ГЕЙТ` (2 дела: 322, 323), `K2-ИЗВЕЩ` (3 дела: 324–326) с непустым `colls`.

- [ ] **Шаг 1: ветка извещения**

```js
    /* К2 — контур, а не охват: извещение регистрируется поверх досудебной цепочки. */
    if(c.izvesh){
      const dt = ruAdd(dates[dates.length-1], 20);
      measures.push({ sec:'Внесудебный залог', kind:'Извещение об обращении на залог',
        dates:D(dt, dt), num:`ИЗВ-${c.credit.id}`,
        purpose:'обращение взыскания на предмет залога во внесудебном порядке',
        outcome:'зарегистрировано', sent:{ date:dt, channel:'Нарочно' },
        served:{ date:dt, doc:'акт вручения нарочно' },
        scope:{ volume:'полный остаток', method:'обращением на предмет залога' },
        sum:sumBy('полный остаток'), responsible:c.curator });
    }
```

- [ ] **Шаг 2: кейсы**

```js
  // ── K2-ГЕЙТ · записка в ДПО есть, комитет ПВОиУИ не решил — извещения нет ──
  { sit:'K2-ГЕЙТ', id:'322', borrower:'ОсОО «Кен-Булак Майнинг»', inn:'01808202100265',
    region:'Ошская обл. / Кара-Суйский', owner:'Департамент правового обеспечения (ДПО)',
    curator:'Эрнисов Б.Т.',
    credit:{ id:'322', num:'Дог. №322 от 06.02.2024', subdiv:'ДПО',
             debt:{ principal:310000, interest:14000, penalty:7200, paid:0 } },
    stop:'записка', age:12, gatePending:'Извещение об обращении на залог',
    colls:[{ item:'Дробильный комплекс', kind:'Оборудование', pledge:'340 000,00',
             order:'внесудебный', real:'не начата', ban:'', startPrice:null, snapshotAt:'10.07.2026' }] },

  // ── K2-ИЗВЕЩ · извещение зарегистрировано, залог готовится к торгам ──
  { sit:'K2-ИЗВЕЩ', id:'324', borrower:'ОсОО «Ак-Марал Недвижимость»', inn:'01912201610559',
    region:'г. Бишкек / Ленинский', owner:'Сектор по работе с активами (САК)',
    curator:'Сагындыков М.',
    credit:{ id:'324', num:'Дог. №324 от 15.01.2024', subdiv:'САК',
             debt:{ principal:420000, interest:19000, penalty:9800, paid:0 } },
    stop:'записка', age:38, izvesh:true,
    colls:[{ item:'Склад, ул. Промышленная 4', kind:'Недвижимость', pledge:'450 000,00',
             order:'внесудебный', real:'подготовка к торгам',
             startPrice:{ value:'450 000,00', report:'Отчёт об оценке №ОЦ-324 от 12.05.2026' },
             ban:'', snapshotAt:'10.07.2026' }] },
```

Третий кейс `K2-ИЗВЕЩ` (`id:'326'`) — предмет с запретом обращения: `ban:'предприятие как имущественный комплекс'`, `order:'судебный'`, `real:'—'`.

- [ ] **Шаг 3: аудит**

Run: `node scripts/inspect/collection-data-audit.mjs 2>&1 | tail -1`
Expected: `ИТОГО находок: 0 · дел: 34 · требований: 35`

- [ ] **Шаг 4: коммит**

```bash
git add mockups/collection/collection.html
git commit -m "$(cat <<'EOF'
feat(collection): затравка — контур К2, пять дел

Гейт комитета ПВОиУИ без решения (извещения нет) и зарегистрированное
извещение с залогом на трёх стадиях реализации.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Контур К3 — судебная стадия, 16 дел

**Files:**
- Modify: `mockups/collection/collection.html` (`SEED`, ветки жалоб и соглашений)

**Interfaces:**
- Produces: `K3-ИСК-ЖДЁМ` (2), `K3-ИСК` (3, с заседаниями), `K3-ИСК-ВОЗВРАТ` (2), `K3-РЕШЕНИЕ` (3), `K3-АПЕЛЛЯЦИЯ` (2), `K3-ИЛ` (2), `K3-МС` (2), `K3-ДОБРОВОЛЬНОЕ` (2). Номера дел 120, 142, 330–345.

- [ ] **Шаг 1: заседания выводятся из судебных мер**

В билдер, после сборки мер:

```js
    /* Заседание — сущность (КР-2): срок «Следующее судебное заседание» выводится
       из него, отдельным хранимым сроком не дублируется. */
    const hearings = c.hearings || [];
    const isk = measures.find(m => m.kind === 'Исковое заявление');
    if(isk && c.court && !hearings.length){
      const h1 = ruAdd(isk.dates.event, 21);
      hearings.push({ measureNum:isk.num, kind:'Извещение о назначении судебного процесса',
        place:c.court, when:`${h1} 10:30`,
        participants:[`${c.curator} (представитель ФКФ)`], outcome:'' });
      const h2 = ruAdd(h1, 14);
      hearings.push({ measureNum:isk.num, kind:'Судебный процесс', place:c.court,
        when:`${h2} 14:00`,
        participants:[`${c.curator} (представитель ФКФ)`, c.defendantAppeared ? 'Ответчик явился' : 'Ответчик не явился'],
        outcome: c.defendantAppeared ? '' : 'отложено — неявка ответчика' });
    }
```

и заменить в `procs.push` `hearings:c.hearings || []` на `hearings,`.

- [ ] **Шаг 2: ветка «определение не о принятии» + частная жалоба**

```js
    /* ADR-0035: у resultIsDocument-вида результат приходит ОТДЕЛЬНОЙ мерой.
       Возврат иска фазу «Иск» не ставит — требование остаётся на досудебной. */
    if(c.iskRefused){
      const dt = ruAdd(dates[dates.length-1], 12);
      const kind = c.iskRefused === 'возврат' ? 'Определение о возвращении искового заявления'
                                              : 'Определение об отказе в принятии искового заявления';
      const num = `ОПР-${c.credit.id}`;
      measures.push({ sec:'Судебный', kind, dates:D(dt, dt), received:{ date:dt }, num,
        purpose:'судьба искового заявления', basedOn:`ИСК-${c.credit.id}`,
        outcome: c.iskRefused === 'возврат' ? 'возвращено' : 'отказано в принятии',
        sum:sumBy('полный остаток'), responsible:c.curator });
      const dt2 = ruAdd(dt, 8);
      measures.push({ sec:'Судебный', kind:'Частная жалоба', dates:D(dt2, dt2),
        num:`ЧЖ-${c.credit.id}`, purpose:'обжалование определения', basedOn:num,
        sum:sumBy('полный остаток'), responsible:c.curator });
    }
```

Кейс с `iskRefused` объявляет `stop:'иск'` — ступень `определение` в хребет не входит.

- [ ] **Шаг 3: ветка апелляции**

```js
    if(c.appeal){
      const rs = measures.find(m => m.kind === 'Решение суда');
      const dt = ruAdd(rs.dates.event, 20);
      measures.push({ sec:'Судебный', kind:'Апелляционная жалоба', dates:D(dt, dt),
        num:`АЖ-${c.credit.id}`, purpose:'обжалование решения суда', basedOn:rs.num,
        sum:sumBy('полный остаток'), responsible:c.curator });
      const dt2 = ruAdd(dt, 40);
      measures.push({ sec:'Судебный', kind:'Постановление апелляционной инстанции',
        dates:D(dt2, dt2), received:{ date:dt2 }, num:`ПА-${c.credit.id}`,
        purpose:'акт апелляционной инстанции', basedOn:`АЖ-${c.credit.id}`,
        outcome:c.appeal, sum:sumBy('полный остаток'), responsible:c.curator });
    }
```

`c.appeal` — `'оставлено в силе'` либо `'отменено, на новое рассмотрение'`.

- [ ] **Шаг 4: ветка соглашений**

```js
    if(c.agreement){
      const a = c.agreement;
      if(a.type === 'mirovoe' && a.status === 'утверждено судом'){
        const dt = a.approvedAt;
        measures.push({ sec:'Судебный', kind:'Мировое соглашение', dates:D(dt, dt),
          received:{ date:dt }, num:a.num, purpose:'утверждение мирового соглашения судом',
          outcome:'утверждено судом', sum:sumBy('полный остаток'), responsible:c.curator });
      }
      if(a.type === 'dobrovolnoe'){
        const dt = a.signedAt;
        measures.push({ sec:'Судебный', kind:'Соглашение о добровольном исполнении',
          dates:D(dt, dt), num:a.num, purpose:'добровольное исполнение судебного акта',
          outcome:'заключено', basedOn:`РС-${c.credit.id}`,
          sum:sumBy('полный остаток'), responsible:c.curator });
      }
    }
```

`agreements:[…]` кейса пробрасывается в дело через `extra`, чтобы вкладка соглашений видела график (`schedule`, `scheduleBy`, `notWorse`) — форма полей как у `msComputeRows`.

- [ ] **Шаг 5: 16 кейсов К3**

Образцы:

```js
  // ── K3-ИСК-ЖДЁМ · иск подан, определения нет — законная дыра, срок 45 ──
  { sit:'K3-ИСК-ЖДЁМ', id:'330', borrower:'ОсОО «Узген-Текстиль»', inn:'02902201900801',
    region:'Ошская обл. / Узгенский', owner:'Отдел проблемных кредитов (ОПК)',
    curator:'Тукинова А.С.',
    credit:{ id:'330', num:'Дог. №330 от 03.03.2024', subdiv:'ОПК',
             debt:{ principal:186000, interest:9200, penalty:4100, paid:0 } },
    stop:'иск', age:6 },

  // ── K3-ИСК · определение о принятии, заседание отложено неявкой ──
  { sit:'K3-ИСК', id:'332', borrower:'ОсОО «Ош-Текстиль»', inn:'01912201610560',
    region:'г. Ош / Ошский', owner:'Отдел проблемных кредитов (ОПК)', curator:'Тукинова А.С.',
    credit:{ id:'332', num:'Дог. №332 от 18.12.2023', subdiv:'ОПК',
             debt:{ principal:264000, interest:12600, penalty:6300, paid:0 } },
    stop:'определение', age:14, court:'Ошский городской суд', defendantAppeared:false },

  // ── K3-РЕШЕНИЕ · иск удовлетворён частично ──
  { sit:'K3-РЕШЕНИЕ', id:'336', borrower:'ОсОО «Лейлек-Строй»', inn:'01502201700341',
    region:'Баткенская обл. / Лейлекский', owner:'Отдел проблемных кредитов (ОПК)',
    curator:'Тукинова А.С.',
    credit:{ id:'336', num:'Дог. №336 от 22.07.2023', subdiv:'ОПК',
             debt:{ principal:198000, interest:9600, penalty:5200, paid:0 } },
    stop:'решение', age:18, court:'Лейлекский районный суд', defendantAppeared:true,
    verdict:'иск удовлетворён частично' },

  // ── K3-МС · мировое утверждено судом, график материализован ──
  { sit:'K3-МС', id:'120', borrower:'ИП Сыдыков А.', inn:'20308197700219',
    region:'Джалал-Абадская обл. / Сузакский', owner:'Отдел проблемных кредитов (ОПК)',
    curator:'Эрнисов Б.Т.',
    credit:{ id:'120', num:'Дог. №120 от 11.09.2023', subdiv:'ОПК',
             debt:{ principal:240000, interest:11000, penalty:6000, paid:0 } },
    stop:'определение', age:60, court:'Сузакский районный суд', defendantAppeared:true,
    agreement:{ type:'mirovoe', num:'МС-120', status:'утверждено судом', approvedAt:'18.03.2026' } },
```

`verdict` кейса подменяет исход ступени `решение` — поддержать в билдере строкой в сборке меры: `if(s.key==='решение' && c.verdict) m.outcome = c.verdict;`.

- [ ] **Шаг 6: аудит**

Run: `node scripts/inspect/collection-data-audit.mjs 2>&1 | tail -1`
Expected: `ИТОГО находок: 0 · дел: 50 · требований: 51`

- [ ] **Шаг 7: коммит**

```bash
git add mockups/collection/collection.html
git commit -m "$(cat <<'EOF'
feat(collection): затравка — контур К3, 16 дел

Иск без ответа суда, определение о принятии с заседаниями, возврат иска с
частной жалобой, три исхода решения, апелляция, исполнительный лист,
мировое соглашение и соглашение о добровольном исполнении. Заседания
выводятся из иска, отдельного хранимого срока у них нет.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Контуры К4, К5, К6 — 15 дел

**Files:**
- Modify: `mockups/collection/collection.html` (`SEED`, ветки торгов, правопреемства, банкротства)

**Interfaces:**
- Produces: `K4-ИСПОЛН` (3), `K4-ТОРГИ` (3), `K4-ВОЗВРАТ` (2), `K5-ПРАВОПР` (2), `K5-НЕТ-ПРАВОПР` (2), `K6-ИНИЦ` (2), `K6-ПРИЗНАН` (2), `K6-ЗАВЕРШЕНО` (2). Номера дел 133, 206→350–366.

- [ ] **Шаг 1: ветки К4**

```js
    if(c.torgi){   /* 'не состоялись' | 'дважды' */
      const ip = measures.find(m => m.kind === 'Постановление на исполнении');
      const dt = ruAdd(ip.dates.event, 45);
      measures.push({ sec:'Исполнительное', kind:'Акт несостоявшихся торгов', dates:D(dt, dt),
        received:{ date:dt }, num:`АТ-${c.credit.id}`, purpose:'фиксация провала торгов',
        outcome:'торги не состоялись', basedOn:ip.num,
        sum:sumBy('полный остаток'), responsible:c.curator });
    }
    if(c.ilReturned){
      const ip = measures.find(m => m.kind === 'Постановление на исполнении');
      const dt = ruAdd(ip.dates.event, 60);
      measures.push({ sec:'Исполнительное', kind:'Постановление о возврате ИЛ', dates:D(dt, dt),
        received:{ date:dt }, num:`ПВ-${c.credit.id}`,
        purpose:'возврат исполнительного листа взыскателю', outcome:'возвращён',
        basedOn:`ИЛ-${c.credit.id}`, sum:sumBy('полный остаток'), responsible:c.curator });
      const dt2 = ruAdd(dt, 10);
      measures.push({ sec:'Исполнительное', kind:'Письмо в ПССИ', dates:D(dt2, dt2),
        num:`ПС-${c.credit.id}`, purpose:'запрос о ходе исполнительного производства',
        sum:sumBy('полный остаток'), responsible:c.curator });
    }
```

- [ ] **Шаг 2: ветка К5 (правопреемство)**

```js
    if(c.succession){   /* 'заявление' | 'нет правопреемника' */
      const base = measures[measures.length-1].dates.event;
      const dt = ruAdd(base, 30);
      measures.push({ sec:'Правопреемство', kind:'Заявление об установлении правопреемника',
        dates:D(dt, dt), num:`ЗП-${c.credit.id}`,
        purpose:'установление правопреемника умершего заёмщика', outcome:'подано',
        sum:sumBy('полный остаток'), responsible:c.curator });
      if(c.succession === 'нет правопреемника'){
        const dt2 = ruAdd(dt, 45);
        measures.push({ sec:'Правопреемство', kind:'Решение суда (отсутствие правопреемника)',
          dates:D(dt2, dt2), received:{ date:dt2 }, num:`РП-${c.credit.id}`,
          purpose:'установление отсутствия правопреемника', outcome:'отсутствие правопреемника',
          basedOn:`ЗП-${c.credit.id}`, sum:sumBy('полный остаток'), responsible:c.curator });
      }
    }
```

Состояние ЛИЦА (смерть) ставится через `extra.personState` — форма поля как у `PERSON_STATE_OPEN`.

- [ ] **Шаг 3: ветка К6 (банкротство)**

```js
    if(c.bankrot){   /* 'инициировано' | 'признан' | 'завершено' */
      const base = measures[measures.length-1].dates.event;
      let dt = ruAdd(base, 25);
      measures.push({ sec:'Судебный', kind:'Заявление на банкротство', dates:D(dt, dt),
        num:`ЗБ-${c.credit.id}`, purpose:'инициирование процедуры банкротства',
        sum:sumBy('полный остаток'), responsible:c.curator });
      dt = ruAdd(dt, 30);
      measures.push({ sec:'Банкротство', kind:'Инициирование банкротства', dates:D(dt, dt),
        received:{ date:dt }, num:`ИБ-${c.credit.id}`, purpose:'принятие заявления к производству',
        outcome:'принято к производству', basedOn:`ЗБ-${c.credit.id}`,
        sum:sumBy('полный остаток'), responsible:c.curator });
      if(c.bankrot !== 'инициировано'){
        dt = ruAdd(dt, 60);
        measures.push({ sec:'Банкротство', kind:'Признание банкротом', dates:D(dt, dt),
          received:{ date:dt }, num:`ПБ-${c.credit.id}`, purpose:'признание должника банкротом',
          outcome:'признан банкротом', basedOn:`ИБ-${c.credit.id}`,
          sum:sumBy('полный остаток'), responsible:c.curator });
      }
      if(c.bankrot === 'завершено'){
        dt = ruAdd(dt, 120);
        measures.push({ sec:'Банкротство', kind:'Завершение процедуры банкротства', dates:D(dt, dt),
          received:{ date:dt }, num:`ЗПБ-${c.credit.id}`, purpose:'завершение процедуры',
          outcome:'завершена', basedOn:`ПБ-${c.credit.id}`,
          sum:sumBy('полный остаток'), responsible:c.curator });
      }
    }
```

- [ ] **Шаг 4: 15 кейсов**

Все с `stop:'постановление'` (К4/К6 идут поверх исполнительного производства) либо `stop:'решение'` для К5 со смертью заёмщика. Расходы: у дел на исполнительном производстве заполнить `COSTS_SEED[credit.id]` — добавить в билдер:

```js
    if(SPINE_KEYS.indexOf(c.stop) >= SPINE_KEYS.indexOf('ил'))
      COSTS_SEED[c.credit.id] = [{ date:'25.07.2026',
        kind:'Расходы по обращению взыскания и реализации', amount:c.costs ?? 8000 }];
```

- [ ] **Шаг 5: аудит**

Run: `node scripts/inspect/collection-data-audit.mjs 2>&1 | tail -1`
Expected: `ИТОГО находок: 0 · дел: 65 · требований: 66`

- [ ] **Шаг 6: коммит**

```bash
git add mockups/collection/collection.html
git commit -m "$(cat <<'EOF'
feat(collection): затравка — контуры К4, К5, К6, 15 дел

Исполнительное производство с арестом и торгами, возврат ИЛ с письмом в
ПССИ, правопреемство (заявление и отсутствие правопреемника), банкротство
на трёх глубинах. Расходы появляются с исполнительного листа — пятая
статья собственная.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Контур К7 и терминалы — 12 дел

**Files:**
- Modify: `mockups/collection/collection.html` (`SEED`, ветка безнадёжности)

**Interfaces:**
- Produces: `K7-ЛИКВИД` (2), `K7-УМЕРШИЙ` (2), `K7-ПРИГОВОР` (2), `K7-КОМИССИЯ` (2), `K7-СПИСАНА` (2), `T-ПОГАШЕНИЕ` (2). Номера дел 097, 207, 208, 370–380.

- [ ] **Шаг 1: ветка К7**

```js
    if(c.hopeless){
      const base = measures[measures.length-1].dates.event;
      let dt = ruAdd(base, 30);
      /* Гейт ПДК: заключение комиссии регистрируется только по решённому вопросу.
         c.hopeless === 'на рассмотрении' → вопрос есть, меры нет (§11). */
      if(c.hopeless === 'на рассмотрении'){
        c.gatePending = 'Заключение комиссии о безнадёжности';
      } else {
        measures.push({ sec:'Безнадёжная', kind:'Заключение комиссии о безнадёжности',
          dates:D(dt, dt), num:`КБ-${c.credit.id}`, purpose:'признание задолженности безнадёжной',
          outcome:'признана безнадёжной', sum:sumBy('полный остаток'), responsible:c.curator });
      }
      if(c.hopelessFact){   /* 'ликвидация' | 'умерший' | 'приговор' */
        dt = ruAdd(dt, 20);
        const map = { 'ликвидация':['Выписка о ликвидации юр. лица','ликвидация зарегистрирована','ВЛ'],
                      'умерший':['Решение суда (умерший / отсутствующий / недееспособный)','установлено','РУ'],
                      'приговор':['Приговор суда','вынесен','ПГ'] };
        const [kind, outcome, pre] = map[c.hopelessFact];
        measures.push({ sec:'Безнадёжная', kind, dates:D(dt, dt), received:{ date:dt },
          num:`${pre}-${c.credit.id}`, purpose:'основание безнадёжности', outcome,
          sum:sumBy('полный остаток'), responsible:c.curator });
      }
      if(c.writeOff){   /* 'кабмин' | 'госорган' */
        dt = ruAdd(dt, 40);
        const kind = c.writeOff === 'кабмин' ? 'Акт Кабинета Министров о списании'
                                             : 'Решение уполномоченного госоргана о списании';
        measures.push({ sec:'Безнадёжная', kind, dates:D(dt, dt), received:{ date:dt },
          num:`СП-${c.credit.id}`, purpose:'списание задолженности', outcome:'списана',
          sum:sumBy('полный остаток'), responsible:c.curator });
      }
    }
```

Порядок важен: `c.gatePending` выставляется ДО цикла гейтов — ветку К7 разместить выше него.

- [ ] **Шаг 2: терминал полного погашения**

```js
    if(c.repaid){
      const dt = ruSub(TODAY, c.age ?? 12);
      measures.push({ sec:'Досудебный', kind:'Акт сверки о полном погашении', dates:D(dt, dt),
        num:`АС-${c.credit.id}`, purpose:'подтверждение полного погашения (п. 88)',
        outcome:'подтверждено', sum:'0,00', responsible:c.curator });
    }
```

У такого кейса `debt` погашен полностью (`paid === principal`, проценты и пеня нулевые) — терминал «Полное погашение» ставит не мера, а нулевой остаток (§3.3).

- [ ] **Шаг 3: 12 кейсов**

```js
  // ── K7-ЛИКВИД · выписка о ликвидации юр. лица ──
  { sit:'K7-ЛИКВИД', id:'370', borrower:'ОсОО «Ноокен-Кант» (ликвидировано)', inn:'02804202000805',
    region:'Джалал-Абадская обл. / Ноокенский', owner:'Отдел проблемных кредитов (ОПК)',
    curator:'Тукинова А.С.',
    credit:{ id:'370', num:'Дог. №370 от 14.06.2022', subdiv:'ОПК',
             debt:{ principal:310000, interest:22000, penalty:14000, paid:0 } },
    stop:'постановление', age:120, hopeless:'вынесено', hopelessFact:'ликвидация' },

  // ── K7-КОМИССИЯ · вопрос на ПДК на рассмотрении, заключения нет ──
  { sit:'K7-КОМИССИЯ', id:'097', borrower:'ОсОО «Нарын-Агро»', inn:'02211199100154',
    region:'Нарынская обл. / Нарынский', owner:'Отдел проблемных кредитов (ОПК)',
    curator:'Тукинова А.С.',
    credit:{ id:'097', num:'Дог. №097 от 03.02.2022', subdiv:'ОПК',
             debt:{ principal:275000, interest:19000, penalty:11000, paid:0 } },
    stop:'постановление', age:90, hopeless:'на рассмотрении' },

  // ── T-ПОГАШЕНИЕ · нулевой остаток + акт сверки, группа «Погашенные» ──
  { sit:'T-ПОГАШЕНИЕ', id:'208', borrower:'ИП Нуркеева Г.', inn:'22607199300512',
    region:'Баткенская обл. / Кадамжайский', owner:'Куратор ОД', curator:'Асанова Ж.Т.',
    credit:{ id:'208', num:'Дог. №208 от 20.02.2025', subdiv:'ОД',
             debt:{ principal:45000, interest:0, penalty:0, paid:45000 } },
    stop:'повторная', age:12, repaid:true },
```

- [ ] **Шаг 4: аудит**

Run: `node scripts/inspect/collection-data-audit.mjs 2>&1 | tail -1`
Expected: `ИТОГО находок: 0 · дел: 77 · требований: 78`

- [ ] **Шаг 5: коммит**

```bash
git add mockups/collection/collection.html
git commit -m "$(cat <<'EOF'
feat(collection): затравка — контур К7 и полное погашение, 12 дел

Ликвидация, смерть, приговор, вопрос на ПДК без заключения, списание
Кабмином и уполномоченным госорганом, терминал полного погашения. Терминал
«Полное погашение» ставит нулевой остаток, а не акт сверки.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Ведение дела и категория риска — 10 дел

**Files:**
- Modify: `mockups/collection/collection.html` (`SEED`, поддержка многокредитных кейсов в билдере)

**Interfaces:**
- Produces: `ВЕД-ПЕРЕДАЧА` (3), `ВЕД-КОНФЛИКТ` (2), `ВЕД-МНОГО` (2), `РИСК` (3). Номера дел 205, 210, 402, 412, 390–398.

- [ ] **Шаг 1: многокредитный кейс**

`ВЕД-МНОГО` и `РИСК` (worst-of) требуют нескольких кредитов в деле. Поддержать поле `credits:[…]` как альтернативу `credit`: билдер разворачивает цепочку ДЛЯ КАЖДОГО кредита и проставляет мерам `targets:[`${c.id}/${cr.id}/з`]` поимённо.

```js
    /* МТ-1: без явных targets normalize целит меру ПО РОЛИ — все меры прилипли бы ко
       всем требованиям дела, свёртка дала бы им одну веху и контуры схлопнулись бы. */
```

Рефакторинг: тело сборки одного кредита вынести в `buildCredit(c, cr, stop, age)`, `buildSeed` вызывает его по каждому кредиту кейса и склеивает `measures`/`deadlines`/`history`.

- [ ] **Шаг 2: передачи материалов**

```js
  // ── ВЕД-ПЕРЕДАЧА · ждёт подтверждения принимающей стороны (п. 98) ──
  { sit:'ВЕД-ПЕРЕДАЧА', id:'390', borrower:'ОсОО «Бакай-Ата Агро»', inn:'01912201610563',
    region:'Таласская обл. / Бакай-Атинский', owner:'Куратор ОД', curator:'Мурзаева Н.',
    credit:{ id:'390', num:'Дог. №390 от 10.02.2024', subdiv:'ОД',
             debt:{ principal:58000, interest:2400, penalty:900, paid:0 } },
    stop:'повторная', age:16,
    extra:{ procedure:{ status:'Работа с судебными органами', since:'16.07.2026', by:'ОД',
      receiving:'ОПК', confirm:{ state:'ожидает', at:null, deadlineRd:5, leftRd:4, until:'23.07.2026' } } } },

  // ── ВЕД-ПЕРЕДАЧА · отклонена, затем передана повторно и принята ──
  { sit:'ВЕД-ПЕРЕДАЧА', id:'392', borrower:'ОсОО «Кадамжай-Сурьма»', inn:'01502201700343',
    region:'Баткенская обл. / Кадамжайский', owner:'Сектор по работе с активами (САК)',
    curator:'Сагындыков М.',
    credit:{ id:'392', num:'Дог. №392 от 05.06.2023', subdiv:'САК',
             debt:{ principal:270000, interest:14000, penalty:8000, paid:0 } },
    stop:'постановление', age:40, torgi:'дважды',
    extra:{ procedure:{ status:'Передан в сектор по работе с активами', since:'10.05.2026',
              by:'ДПО', receiving:'САК', confirm:{ state:'подтверждена', at:'10.05.2026', deadlineRd:5 } },
            procHistory:[
              { status:'Передан в сектор по работе с активами', since:'25.04.2026', by:'ДПО',
                receiving:'САК', done:'25.04.2026', confirm:'отклонена',
                rejected:['Акт несостоявшихся торгов','Акт сверки, подписанный сторонами'] },
              { status:'Передан в сектор по работе с активами', since:'10.05.2026', by:'ДПО',
                receiving:'САК', done:'10.05.2026', confirm:'подтверждена', rejected:[] }] } },
```

- [ ] **Шаг 3: конфликт интересов и категория риска**

```js
  // ── ВЕД-КОНФЛИКТ · куратор отстранён до решения Правления (п. 92) ──
  { sit:'ВЕД-КОНФЛИКТ', id:'205', borrower:'ОсОО «Мурас-Строй»', inn:'01502201700339',
    region:'г. Ош / Ошский', owner:'Куратор ОД', curator:'Бекболотов Р.',
    credit:{ id:'395', num:'Дог. №395 от 03.03.2024', subdiv:'ОД',
             debt:{ principal:41200, interest:1800, penalty:600, paid:0 } },
    stop:'повторная', age:22,
    extra:{ conflict:{ declared:true, date:'12.07.2026', basis:'близкий родственник учредителя',
      status:'на рассмотрении Правления', curatorSuspended:true },
      deadlines:[{ tpl:44, due:'26.07.2026', base:'заявление конфликта (12.07.2026)' }] } },

  // ── РИСК · «высокий» при нуле дней просрочки — фактор нецелевого использования ──
  { sit:'РИСК', id:'397', borrower:'ОсОО «Кыргыз-Дан»', inn:'02804202000199',
    region:'г. Бишкек / Свердловский', owner:'Куратор ОД', curator:'Асанова Ж.Т.',
    credit:{ id:'397', num:'Дог. №397 от 12.01.2025', subdiv:'ОД',
             debt:{ principal:150000, interest:0, penalty:0, paid:0 },
             factors:['нецелевое использование кредитных средств'] },
    stop:null, overdue:0 },
```

Поле `credit.factors` пробросить в кредит дела наравне с `subdiv`.

- [ ] **Шаг 4: аудит**

Run: `node scripts/inspect/collection-data-audit.mjs 2>&1 | tail -1`
Expected: `ИТОГО находок: 0 · дел: 87 · требований: ≥92`

- [ ] **Шаг 5: коммит**

```bash
git add mockups/collection/collection.html
git commit -m "$(cat <<'EOF'
feat(collection): затравка — ведение дела и категория риска, 10 дел

Передача материалов (ждёт / отклонена / повторно принята), конфликт
интересов, три требования одного дела в трёх контурах, worst-of по двум
кредитам и «высокий» риск по фактору при нуле дней просрочки. Многокредитные
дела целят меры поимённо — иначе три контура схлопнулись бы в один.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Добор до 2–3 кейсов на каждую ситуацию + проверка покрытия

**Files:**
- Modify: `mockups/collection/collection.html` (`SEED`)
- Create: `scripts/inspect/collection-seed-coverage.mjs`

**Interfaces:**
- Consumes: поле `sit` у каждого кейса.
- Produces: скрипт покрытия, который печатает ситуацию, число дел и распределение по стадиям.

- [ ] **Шаг 1: скрипт покрытия (красный)**

Create `scripts/inspect/collection-seed-coverage.mjs`:

```js
/* Покрытие каталога ситуаций: у каждой ситуации должно быть 2–3 дела.
   Запуск: node scripts/inspect/collection-seed-coverage.mjs */
import { chromium } from 'playwright-core';
const file = 'file:///home/azamat/projects/asubk-credit-module/.claude/worktrees/vzyskanie/mockups/collection/collection.html';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const p = await b.newPage();
await p.goto(file);
await p.waitForTimeout(400);
const out = await p.evaluate(() => {
  const by = {};
  for(const c of SEED) (by[c.sit] ??= []).push(c.id);
  const stages = {};
  for(const pr of PROCESSES) for(const r of pr.requirements)
    stages[stageOf(displayPhase(r))] = (stages[stageOf(displayPhase(r))] || 0) + 1;
  return { by, stages, procCount:PROCESSES.length };
});
const thin = Object.entries(out.by).filter(([, ids]) => ids.length < 2);
for(const [sit, ids] of Object.entries(out.by)) console.log(`${sit.padEnd(18)} ${ids.length}  ${ids.join(' ')}`);
console.log('стадии:', JSON.stringify(out.stages));
console.log(`ситуаций: ${Object.keys(out.by).length} · дел: ${out.procCount} · тонких (<2): ${thin.length}`);
await b.close();
```

- [ ] **Шаг 2: запустить — увидеть тонкие ситуации**

Run: `node scripts/inspect/collection-seed-coverage.mjs | tail -3`
Expected: печатает список; `тонких (<2)` больше нуля — это и есть список к добору.

- [ ] **Шаг 3: добрать кейсы**

Для каждой ситуации из «тонких» дописать кейс той же формы, что уже есть у ситуации, меняя заёмщика, ИНН, регион, куратора, суммы и `age`. Довести общее число до 40 ситуаций / 92 дел.

- [ ] **Шаг 4: покрытие полное, аудит чист**

Run:
```bash
node scripts/inspect/collection-seed-coverage.mjs | tail -3
node scripts/inspect/collection-data-audit.mjs 2>&1 | tail -1
```
Expected: `ситуаций: 40 · дел: 92 · тонких (<2): 0`; `ИТОГО находок: 0`. В строке стадий все четыре значения ненулевые.

- [ ] **Шаг 5: коммит**

```bash
git add mockups/collection/collection.html scripts/inspect/collection-seed-coverage.mjs
git commit -m "$(cat <<'EOF'
feat(collection): каталог закрыт — 40 ситуаций, 92 дела

Скрипт покрытия печатает ситуацию, число дел и распределение по стадиям;
ситуаций с одним делом не осталось.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Смоук — привести ассерты к новой затравке

**Files:**
- Modify: `scripts/inspect/collection-check.mjs`

**Interfaces:**
- Consumes: новые id дел (якорные 120, 142, 201–210, 330, 337, 374, 402, 412 сохранены за теми же ситуациями).

- [ ] **Шаг 1: снять список провалов**

Run: `node scripts/inspect/collection-check.mjs 2>&1 | grep -i "провал\|FAIL" | head -40`
Expected: список ассертов, ждущих исчезнувших дел, номеров мер и чисел реестров.

- [ ] **Шаг 2: править по одному**

Для каждого провала: если ассерт про ПРАВИЛО — подставить новое дело той же ситуации; если про ЧИСЛО (очередь сроков, счётчики реестров) — пересчитать по факту и записать новое число с комментарием, откуда оно. Ассерты, чью ситуацию новая затравка не воспроизводит, удалять только вместе с записью в разделе волны ЗС статус-дока.

- [ ] **Шаг 3: зелёный смоук**

Run: `node scripts/inspect/collection-check.mjs 2>&1 | tail -5`
Expected: 0 ошибок консоли, 0 провалов.

- [ ] **Шаг 4: аудит не сломался**

Run: `node scripts/inspect/collection-data-audit.mjs 2>&1 | tail -1`
Expected: `ИТОГО находок: 0 · дел: 92 · требований: ≥97`

- [ ] **Шаг 5: коммит**

```bash
git add scripts/inspect/collection-check.mjs
git commit -m "$(cat <<'EOF'
test(collection): смоук приведён к новой затравке

Ассерты про правила переставлены на дела тех же ситуаций, числа реестров
пересчитаны по факту. Провалов 0, ошибок консоли 0.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Документы — волна ЗС

**Files:**
- Modify: `mockups/collection/ASUBK-status-razrabotki.md` (новый раздел в конец)
- Modify: `mockups/collection/ASUBK-vzyskanie-logika.md` (§17, пункты про затравку)

**Interfaces:**
- Consumes: числа из задач 10 и 11.

- [ ] **Шаг 1: раздел волны в статус-док**

Дописать в конец `ASUBK-status-razrabotki.md`:

```markdown
## Волна ЗС · пересев затравки — реализована 01.08.2026

Повод: волна ДС чинила накопленную затравку правкой на месте и упёрлась в потолок —
235 находок аудита стали 34, из них три модельных тупика данными не чинятся, а
каталог ситуаций рос органически с v2 и дублировался.

### Решения — ЗС-1…ЗС-5

| # | Решение |
|---|---------|
| ЗС-1 | Каталог из 40 ситуаций выведен из осей модели (семь контуров × ключевые фазы + оверлеи ведения дела), по 2–3 дела на ситуацию — 92 дела |
| ЗС-2 | Затравка стала декларацией: кейс объявляется десятью строками, цепочку вех, даты, суммы, номера, основания, гейты, сроки и историю выводит `buildSeed` |
| ЗС-3 | Законный негатив сохранён (сторно, просроченный срок, иск без ответа суда, отклонённая передача, конфликт, гейт-блокировка, задержка казначейства); невозможные состояния непредставимы по построению |
| ЗС-4 | Три модельных тупика сняты правкой модели, а не данными (см. таблицу ниже) |
| ЗС-5 | Якорные номера дел сохранены за теми же ситуациями — смоук пережил пересев |

### Тупики, снятые в модели

| # | Правка | Следствие |
|---|--------|-----------|
| ДС-М1 | «Требование поручителю» и «Требование гаранту» ставят фазу «Претензия» | требование к обеспечителю не висит в К0 |
| ДС-М2 | «Заявление об установлении правопреемника» перестало быть `resultIsDocument` | вторая фаза К5 достижима |
| ДС-М3 | `SECTION_CLEVEL['Безнадёжная']` 5 → 4 | безнадёжность параллельна банкротству |

**Итог:** аудит 34 → 0 находок. <ЧИСЛА: дел, требований, мер, распределение стадий —
подставить из вывода `collection-seed-coverage.mjs`.>
```

Плейсхолдер `<ЧИСЛА…>` заменить фактическим выводом скрипта — без него шаг не считается сделанным.

- [ ] **Шаг 2: §17 логики**

В `ASUBK-vzyskanie-logika.md` §17 обновить: пункт про затравку («затравка — декларация + билдер, 40 ситуаций / 92 дела»), числа проверок, и снять из «остатка» три тупика.

- [ ] **Шаг 3: проверить, что плейсхолдеров не осталось**

Run: `grep -n "ЧИСЛА\|TODO\|TBD" mockups/collection/*.md`
Expected: пусто.

- [ ] **Шаг 4: коммит**

```bash
git add mockups/collection/ASUBK-status-razrabotki.md mockups/collection/ASUBK-vzyskanie-logika.md
git commit -m "$(cat <<'EOF'
docs(collection): волна ЗС — журнал пересева затравки

Решения ЗС-1…ЗС-5, три тупика, снятые в модели, итоговые числа.
§17 логики приведён к новой затравке.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Порядок и точки контроля

Задачи строго последовательны: каждая опирается на билдер предыдущей. После задач 2, 6 и 10 стоит открыть мокап глазами (`google-chrome mockups/collection/collection.html`) — аудит проверяет данные, но не то, что реестр читается.

**Критерий готовности волны:**

```bash
node scripts/inspect/collection-data-audit.mjs 2>&1 | tail -1   # ИТОГО находок: 0 · дел: 92
node scripts/inspect/collection-seed-coverage.mjs | tail -1     # ситуаций: 40 · тонких (<2): 0
node scripts/inspect/collection-check.mjs 2>&1 | tail -5        # 0 провалов, 0 ошибок консоли
```
