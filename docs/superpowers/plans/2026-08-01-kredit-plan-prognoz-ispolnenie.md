# План · Прогноз · Исполнение плана в макете кредита — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Внедрить в `mockups/loan-credit/credit.html` три сущности ADR-0042 — прогноз (производная транша), план (единственная вводимая величина) и исполнение плана (производная) — не сцепляя их друг с другом.

**Architecture:** Хранимое поле ровно одно: `credit.plan[]` — строки «месяц × сумма» с журналом правок. Прогноз (`trancheForecastRows`/`forecastByMonth`) и исполнение (`planExecOf`) считаются в рантайме при каждом рендере, как всё остальное в макете (Р-11, ADR-0001). Прогноз живёт на вкладке «Расчёты» (гранулярность транша), план и исполнение — на новой 9-й вкладке «План и исполнение» (гранулярность кредита × месяца). Мутация одна — `setPlan`, под новым гейтом Г-30.

**Tech Stack:** Один самодостаточный HTML-файл, ванильный JS без сборки и без зависимостей. Смоук — `node scripts/inspect/credit-check.mjs` (zero-dep, гоняет логический слой в `node:vm`).

**Spec:** `docs/superpowers/specs/2026-08-01-kredit-plan-ispolnenie-design.md`

## Global Constraints

- **Тестирование отложено по требованию владельца.** Задачи 1–8 идут БЕЗ прогона смоука после каждой. Весь тестовый блок — Задача 9 в конце: новые проверки пишутся, весь набор прогоняется один раз, найденное чинится там же. Промежуточных запусков `credit-check.mjs` не делать.
- Язык интерфейса и комментариев в коде — русский. Названия функций и полей — латиницей.
- Правка идёт ТОЛЬКО в `mockups/loan-credit/credit.html`, `scripts/inspect/credit-check.mjs` и двух `.md` рядом с макетом. `CONTEXT.md` не трогать — термины уже внесены коммитом `60f2c00`.
- Демо-«сегодня» зафиксировано: `TODAY = '23.07.2026'`. Ни `Date.now()`, ни `new Date()` без аргументов в новом коде.
- Состояние только в памяти. `localStorage`/`sessionStorage` не использовать.
- Удалений нет (И-14): снятие плана — это `amount: null` плюс прежнее значение в `history`, строка остаётся видимой.
- Формат месяца везде один: `'YYYY-MM'` (например `'2026-08'`). Сравнение месяцев — лексикографическое сравнение строк, без `Date`.
- Суммы плана — в валюте кредита (`credit.currency`), без пересчёта в сомы.
- Всякая новая чистая функция экспортируется в `window.CR` — иначе смоук её не увидит.
- Деньги форматируются `money(...)`, даты — `fd`/`pd`, округление — `round2(...)`. Свои форматтеры не заводить.
- Всё, что подставляется в HTML из данных, экранируется `esc(...)`; всё, что уходит в атрибут `onclick`, — `jsAttr(...)`.
- Ветка `worktree-kredit`. Работа идёт в git-worktree `/home/azamat/projects/asubk-credit-module/.claude/worktrees/kredit` — не переходить в основной чекаут. Бесхозный `git stash` не использовать.

---

## File Structure

| Файл | Ответственность | Задачи |
|---|---|---|
| `mockups/loan-credit/credit.html` — логический слой (до `window.CR`) | модель плана, помощники месяцев, прогноз, исполнение, гейт Г-30, мутация `setPlan`, сид демо-планов | 1, 2, 3, 4, 8 |
| `mockups/loan-credit/credit.html` — DOM-слой (после `if (typeof document !== 'undefined')`) | вкладка «План и исполнение», модалка, блок прогноза в «Расчётах», плитка шапки | 5, 6, 7 |
| `mockups/loan-credit/credit.html` — комментарий-шапка | Р-29, Г-30, Д-9 | 8 |
| `mockups/loan-credit/ASUBK-kredit-logika.md` | § про план как единственную вводимую величину + строка И-18 | 8 |
| `mockups/loan-credit/ASUBK-status-razrabotki.md` | решение волны | 8 |
| `scripts/inspect/credit-check.mjs` | проверки 80–88 | 9 |

Файл макета уже большой (6340 строк) и по устройству одностраничный — дробить его эта волна не должна: смоук извлекает единственный `<script>` регуляркой `/<script>([\s\S]*?)<\/script>/`, второй тег его сломает.

---

### Task 1: Модель плана и помощники месяцев

**Files:**
- Modify: `mockups/loan-credit/credit.html` — вставка блока помощников после `function freqMonths(f)` (около строки 2816, сразу перед `function buildSchedule`)
- Modify: `mockups/loan-credit/credit.html:1683-1724` — `mkCredit`, поле `plan`
- Modify: `mockups/loan-credit/credit.html:4102-4125` — блок `window.CR`

**Interfaces:**
- Produces:
  - `monthKey(dateStr) -> 'YYYY-MM'` — из даты `'дд.мм.гггг'`
  - `monthLabel(mk) -> 'август 2026'`
  - `monthAdd(mk, k) -> 'YYYY-MM'`
  - `monthRange(fromMk, toMk) -> ['YYYY-MM', …]` (пустой массив, если `from > to`)
  - `planRowOf(credit, mk) -> {month, amount, setBy, setAt, seededFrom, history} | null`
  - `planAmountOf(credit, mk) -> number | null` (`null` = плана нет либо снят)
  - `credit.plan` — массив строк плана, у нового кредита пустой

- [ ] **Step 1: Добавить блок помощников месяца и плана**

Вставить сразу ПОСЛЕ функции `freqMonths` (она заканчивается строкой `function freqMonths(f){ return FREQ_MONTHS[f] || 1; }`) и ПЕРЕД комментарием к `buildSchedule`:

```js
/* ============================================================
   ПЛАН КРЕДИТА (ADR-0042) — единственная ВВОДИМАЯ величина среди трёх ориентиров.
   График — контракт транша. Прогноз — текущее ожидание, выводится. План — что сами
   себе поставили целью на месяц: хранится, потому что относится к ПРОШЛОМУ решению,
   а не к текущему состоянию долга. Если бы план пересчитывался вслед за прогнозом,
   % исполнения плавал бы от досрочного погашения по чужому траншу того же кредита,
   хотя ни план, ни факт в этом месяце не менялись. Неподвижность и есть его смысл.
   Три сущности друг на друга НЕ ссылаются (ADR-0042 §4).
   Месяц везде — строка 'YYYY-MM': сравнивается лексикографически, без Date.
   ============================================================ */
const MONTHS_RU = ['январь','февраль','март','апрель','май','июнь',
                   'июль','август','сентябрь','октябрь','ноябрь','декабрь'];

function monthKey(dateStr){                       // '14.08.2026' -> '2026-08'
  const d = pd(dateStr);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
function monthLabel(mk){                          // '2026-08' -> 'август 2026'
  const [y, m] = String(mk || '').split('-');
  return (MONTHS_RU[(+m) - 1] || '—') + ' ' + y;
}
function monthAdd(mk, k){
  const [y, m] = String(mk).split('-').map(Number);
  const t = (y * 12 + (m - 1)) + (k | 0);
  return Math.floor(t / 12) + '-' + String((t % 12) + 1).padStart(2, '0');
}
function monthRange(fromMk, toMk){
  const out = [];
  if (!/^\d{4}-\d{2}$/.test(String(fromMk)) || !/^\d{4}-\d{2}$/.test(String(toMk))) return out;
  for (let mk = fromMk; mk <= toMk; mk = monthAdd(mk, 1)){ out.push(mk); if (out.length > 240) break; }
  return out;
}

/* Строка плана месяца. amount === null — план СНЯТ (И-14: снятие не удаление,
   строка остаётся видимой, прежнее значение уходит в history). */
function planRowOf(credit, mk){
  return ((credit && credit.plan) || []).find(p => p.month === mk) || null;
}
function planAmountOf(credit, mk){
  const r = planRowOf(credit, mk);
  return r && r.amount != null ? r.amount : null;
}
```

- [ ] **Step 2: Завести поле `plan` в модели кредита**

В `mkCredit` (около строки 1712, рядом с `fees`) добавить перед `factors`:

```js
    /* plan — ПЛАН по месяцам (ADR-0042): единственная вводимая величина среди
       ориентиров. Строка: {month:'YYYY-MM', amount, setBy, setAt, seededFrom, history[]}.
       seededFrom — прогноз на МОМЕНТ заведения: снимок, а не связь; без него не отличить
       «приняли прогноз как есть» от «поставили свою цифру». amount:null — план снят.
       history — [{at, by, prev, note}], append-only. */
    plan:[],
```

- [ ] **Step 3: Экспортировать помощники**

В блоке `window.CR = {` добавить строку после `nextPaymentOf, regStatusOf, scheduleRowStatus, trancheScheduleRows, ledgerKey,`:

```js
  monthKey, monthLabel, monthAdd, monthRange, planRowOf, planAmountOf,
```

- [ ] **Step 4: Коммит**

```bash
git add mockups/loan-credit/credit.html
git commit -m "feat(credit-mockup): модель плана кредита и помощники месяцев (ADR-0042)"
```

---

### Task 2: Прогноз — производная транша

**Files:**
- Modify: `mockups/loan-credit/credit.html` — вставка после `function trancheScheduleRows(t)` (около строки 2903-2910), перед `function ledgerKey`
- Modify: `mockups/loan-credit/credit.html` — блок `window.CR`

**Interfaces:**
- Consumes из Задачи 1: `monthKey`
- Consumes из существующего кода: `trancheScheduleRows(t)`, `ledgerKey(trancheNo, no)`, `conditionsAt(t, date)`, `freqMonths(f)`, `disbursedSum(t)`, `round2`, `pd`, `TODAY`; записи детального расчёта из `buildLedger(c, asOf).index` — поля `trancheNo`, `principalPaid`, `principalOverdue`, `interestOverdue`, `penaltyBal`
- Produces:
  - `trancheForecastRows(t, ledgerIndex, asOf) -> [{no, date, scheduled, forecast, delta, past}]`
  - `forecastByMonth(c, ledgerIndex, asOf) -> Map<'YYYY-MM', number>`

- [ ] **Step 1: Написать `trancheForecastRows`**

Вставить после `trancheScheduleRows` и перед комментарием к `ledgerKey`:

```js
/* ПРОГНОЗ транша (ADR-0042) — те же ДАТЫ, что у графика, пересчитанные СУММЫ.
   Даты не двигаем: прогноз отвечает «сколько ждём на этих сроках», а не «когда».
     • позиция в прошлом (дата ≤ среза) — непокрытый остаток позиции: сколько с неё
       ещё не собрано. Оплаченная позиция даёт 0.
     • весь непокрытый хвост прошлого сваливается в БЛИЖАЙШУЮ будущую позицию: собрать
       его ожидаем ближайшим платежом, а не размазанным по всему хвосту графика.
     • будущие — перестройка от ФАКТИЧЕСКОГО остатка ОД на дату среза и оставшегося
       числа платежей, ставка — условия транша на дату среза (Р-21). Позиционная дельта
       здесь не годится: досрочное погашение не уменьшало бы будущие суммы, и прогноз
       выродился бы в третий способ спросить то же, что график.
   Прогноз ничего не хранит и на график/начисление/гейты не влияет (И-18 — про план,
   но прогноз тем более: он производная).
   ledgerIndex — Map из buildLedger(c, asOf).index; может быть null (тогда прошлое
   считается непогашенным целиком). */
function trancheForecastRows(t, ledgerIndex, asOf){
  const rows = trancheScheduleRows(t);
  if (!rows.length) return [];
  const lim  = pd(asOf || TODAY);
  const cnd  = conditionsAt(t, asOf || TODAY);
  const past = rows.filter(r => pd(r.date) <= lim);
  const fut  = rows.filter(r => pd(r.date) >  lim);
  const out  = [];
  let tail = 0;                                       // непокрытый хвост прошлого
  for (const r of past){
    const e = ledgerIndex ? ledgerIndex.get(ledgerKey(t.no, r.no)) : null;
    const uncovered = e
      ? round2((e.principalOverdue || 0) + (e.interestOverdue || 0) + (e.penaltyBal || 0))
      : round2(r.total || 0);
    tail = round2(tail + uncovered);
    out.push({ no:r.no, date:r.date, scheduled:round2(r.total || 0), forecast:uncovered,
               delta:round2(uncovered - (r.total || 0)), past:true });
  }
  /* фактический остаток ОД транша: освоено минус погашенное по его позициям */
  const paidP = ledgerIndex
    ? round2([...ledgerIndex.values()].filter(e => e.trancheNo === t.no)
        .reduce((a, e) => a + (e.principalPaid || 0), 0))
    : 0;
  let bal = round2(Math.max(0, (disbursedSum(t) || t.amount || 0) - paidP));
  const mpp = freqMonths(cnd.freq);
  const i   = (cnd.rate || 0) / 100 / 12 * mpp;       // ставка за период, как в buildSchedule
  const n   = fut.length;
  const ann = n === 0 ? 0 : (i > 0 ? bal * i / (1 - Math.pow(1 + i, -n)) : bal / n);
  fut.forEach((r, k) => {
    const interest = round2(bal * i);
    let principal = (cnd.method === 'в конце срока')
      ? (k === n - 1 ? bal : 0)
      : round2(ann - interest);
    if (k === n - 1) principal = bal;                 // последний платёж гасит остаток
    principal = Math.max(0, Math.min(principal, bal));
    bal = round2(bal - principal);
    const f = round2(principal + interest + (k === 0 ? tail : 0));
    out.push({ no:r.no, date:r.date, scheduled:round2(r.total || 0), forecast:f,
               delta:round2(f - (r.total || 0)), past:false });
  });
  return out;
}
```

- [ ] **Step 2: Написать `forecastByMonth`**

Сразу следом:

```js
/* Прогноз кредита по месяцам — сумма прогноза ВСЕХ траншей, сгруппированная по месяцу
   даты позиции. Этим предзаполняется форма заведения плана (ADR-0042 §2): стартовое
   значение формы, не связь — после сохранения план от прогноза не зависит. */
function forecastByMonth(c, ledgerIndex, asOf){
  const m = new Map();
  for (const t of (c.tranches || [])){
    for (const r of trancheForecastRows(t, ledgerIndex, asOf)){
      const mk = monthKey(r.date);
      m.set(mk, round2((m.get(mk) || 0) + r.forecast));
    }
  }
  return m;
}
```

- [ ] **Step 3: Экспортировать**

В `window.CR` в ту же строку, что и помощники плана из Задачи 1, добавить:

```js
  trancheForecastRows, forecastByMonth,
```

- [ ] **Step 4: Коммит**

```bash
git add mockups/loan-credit/credit.html
git commit -m "feat(credit-mockup): прогноз транша и агрегат прогноза по месяцам"
```

---

### Task 3: Гейт Г-30 и мутация `setPlan`

**Files:**
- Modify: `mockups/loan-credit/credit.html:3508+` — `gate()`, новый `case 'setPlan'`
- Modify: `mockups/loan-credit/credit.html:3691-3697` — `ROLE_ACTIONS`
- Modify: `mockups/loan-credit/credit.html` — новая функция рядом с прочими мутациями (после `function addTargetUse`, около строки 3949)
- Modify: `mockups/loan-credit/credit.html` — блок `window.CR`

**Interfaces:**
- Consumes из Задачи 1: `monthKey`, `monthLabel`, `planRowOf`
- Consumes из существующего кода: `gate(credit, action, ctx)` возвращает `{ok, reasons:[]}`; `pushAudit(credit, what, before, after)`; `currentRole`; `TODAY`; `money`
- Produces: `setPlan(credit, {rows:[{month, amount, seededFrom}], note}) -> {ok, reasons}`

- [ ] **Step 1: Добавить `case 'setPlan'` в `gate()`**

В `switch(action)` функции `gate` — сразу ПЕРЕД `case 'addNote':` (если такого нет, то перед `default:`) вставить:

```js
    /* Г-30 setPlan (ADR-0042). Отказ называет СРАБОТАВШУЮ причину, а не имя гейта:
       иначе куратор правит не то, что мешает. Снятие плана (amount:null) — законная
       операция и через проверку «сумма > 0» не гоняется. */
    case 'setPlan': {
      if (!['Зарегистрирован','Действует'].includes(credit.lifecycle))
        r.push('План ставится только при ЖЦ «Зарегистрирован» или «Действует» — сейчас «' + credit.lifecycle + '»'); // Г-30
      const prows = (ctx && ctx.rows) || [];
      if (!prows.length) r.push('Не выбрано ни одного месяца — ставить нечего');
      const cm = credit.date ? monthKey(credit.date) : null;
      for (const row of prows){
        if (!/^\d{4}-\d{2}$/.test(String(row && row.month))){ r.push('Месяц задан неверно: «' + (row && row.month) + '»'); continue; }
        if (cm && row.month < cm)
          r.push('Месяц ' + monthLabel(row.month) + ' раньше месяца договора (' + monthLabel(cm) + ')');
        if (row.amount != null && !(row.amount > 0))
          r.push('План на ' + monthLabel(row.month) + ' должен быть больше нуля; чтобы отказаться от цели — снимите план');
      }
      break;
    }
```

- [ ] **Step 2: Дать действию роли**

В `ROLE_ACTIONS` добавить `'setPlan'` в наборы `'Куратор'` и `'Начальник отдела'`:

```js
  'Куратор': new Set(['targetUse','inspection','holdAccrual','transferDebt','linkPledge','addNote','setPlan']),
```

и в конец набора `'Начальник отдела'` — `,'setPlan'`.

План — собственная цель куратора, поэтому право у него и у начальника отдела. Кредитному специалисту и бухгалтеру оно не нужно: первый ведёт договор, второй — платежи.

- [ ] **Step 3: Написать мутацию `setPlan`**

Вставить после `function addTargetUse(credit, ctx){ … }`:

```js
/* setPlan(credit, {rows, note}) — ЕДИНСТВЕННАЯ запись плана (ADR-0042 §1/§3).
   rows: [{month:'YYYY-MM', amount:number|null, seededFrom:number|null}].
   amount:null — СНЯТИЕ плана: строка остаётся, прежнее значение уходит в history (И-14).
   Правка задним числом разрешена и тоже оставляет след — кто, когда, прежнее значение:
   без следа правка стирала бы то, на что реально ориентировались в прошлом периоде,
   ровно то, что план и должен показывать.
   seededFrom пишется ТОЛЬКО при заведении строки и при правке не двигается: это снимок
   прогноза на момент заведения, а не текущее значение прогноза. */
function setPlan(credit, ctx){
  const g = gate(credit, 'setPlan', ctx);                                  // Г-30
  if (!g.ok) return g;
  for (const row of ((ctx && ctx.rows) || [])){
    const ex = planRowOf(credit, row.month);
    if (!ex){
      if (row.amount == null) continue;                                    // снимать нечего
      credit.plan.push({ month:row.month, amount:row.amount,
        setBy:currentRole, setAt:TODAY,
        seededFrom:(row.seededFrom == null ? null : row.seededFrom), history:[] });
      pushAudit(credit, 'setPlan', null, { month:row.month, amount:row.amount });
      continue;
    }
    if (ex.amount === row.amount) continue;                                // ничего не изменилось — следа не плодим
    const before = ex.amount;
    ex.history.push({ at:TODAY, by:currentRole, prev:before, note:(ctx && ctx.note) || '' });
    ex.amount = row.amount;
    pushAudit(credit, 'setPlan', { month:ex.month, amount:before }, { month:ex.month, amount:row.amount });
  }
  credit.plan.sort((a, b) => a.month < b.month ? -1 : a.month > b.month ? 1 : 0);
  return g;
}
```

- [ ] **Step 4: Экспортировать**

В `window.CR` — в строку мутаций (после `saveDoc, addNote, addTargetUse,`) добавить `setPlan,`.

- [ ] **Step 5: Коммит**

```bash
git add mockups/loan-credit/credit.html
git commit -m "feat(credit-mockup): гейт Г-30 и мутация setPlan"
```

---

### Task 4: Исполнение плана — производная

**Files:**
- Modify: `mockups/loan-credit/credit.html` — новая функция сразу после `forecastByMonth` (Задача 2)
- Modify: `mockups/loan-credit/credit.html:3432-3482` — `derive`, добавление `planExec` в результат
- Modify: `mockups/loan-credit/credit.html` — блок `window.CR`

**Interfaces:**
- Consumes из Задач 1–2: `monthKey`, `planRowOf`, `forecastByMonth`
- Consumes из существующего кода: `paymentCounts(p)`, `paymentAllocated(p)`, `c.mirror.payments`, `round2`, `pd`, `TODAY`, `buildLedger(c, asOf) -> {index, …}`
- Produces:
  - `planExecOf(c, asOf, ledgerIndex, year) -> {year, rows, quarters, total, current}`
    - `rows: [{month, label, forecast, plan, fact, pct, edits, dropped, removed}]` — ровно 12 строк года
    - `quarters: [{q, plan, fact, pct}]` — 4 строки
    - `total: {plan, fact, pct, monthsWithPlan, monthsTotal}`
    - `current: {month, plan, fact, pct} | null` — месяц даты среза; `null`, если плана на него нет
  - `derive(c, asOf).planExec` — результат `planExecOf` для года даты среза

Два отличия от спеки, оба намеренные. Годовой агрегат называется `total`, а не `year`: поле `year` в том же объекте несёт номер года (число), и два разных смысла под одним именем перепутались бы на первом же чтении. Третий и четвёртый аргументы `planExecOf` — тоже уточнение спеки: `ledgerIndex` передаётся, чтобы `derive` не строил детальный расчёт второй раз, `year` — чтобы селектор года на вкладке считал другой год без второго `derive`. Оба необязательны.

- [ ] **Step 1: Написать `planExecOf`**

Вставить сразу после `forecastByMonth`:

```js
/* ИСПОЛНЕНИЕ ПЛАНА (CONTEXT.md) = факт месяца / план месяца.
   ФАКТ месяца — сумма разнесённого по платежам, которые ЗАСЧИТЫВАЮТСЯ (paymentCounts,
   две оси Р-27) и чья ДАТА ФАКТИЧЕСКОГО ПОСТУПЛЕНИЯ попала в месяц. Входят все четыре
   статьи долга кредита. Расходы по обращению взыскания не входят и войти не могут по
   построению: они приходят отдельным зеркалом mirror.collectionCosts, а не платежами.
   МЕСЯЦ БЕЗ ПЛАНА ВЫПАДАЕТ ЦЕЛИКОМ — из своей строки, из суммы квартала и из суммы года.
   Факт такого месяца показывается справочно: он есть, но сравнивать его не с чем.
   Платежи ПОСЛЕ даты среза не считаются: дата среза одна на карточку (И-13).
   Величина только для показа: ни в гейт, ни в производную долга, ни в категорию риска,
   ни в подгруппу заёмщика не входит (И-18). */
function planExecOf(c, asOf, ledgerIndex, year){
  asOf = asOf || TODAY;
  const lim = pd(asOf);
  const y   = year || pd(asOf).getFullYear();
  const idx = ledgerIndex || buildLedger(c, asOf).index;
  const fc  = forecastByMonth(c, idx, asOf);
  const factByMonth = new Map();
  for (const p of ((c.mirror && c.mirror.payments) || [])){
    if (!p || !p.date || !paymentCounts(p)) continue;
    if (pd(p.date) > lim) continue;
    const mk = monthKey(p.date);
    factByMonth.set(mk, round2((factByMonth.get(mk) || 0) + paymentAllocated(p)));
  }
  const rows = [];
  for (let m = 1; m <= 12; m++){
    const mk  = y + '-' + String(m).padStart(2, '0');
    const pr  = planRowOf(c, mk);
    const plan = pr && pr.amount != null ? pr.amount : null;
    const fact = round2(factByMonth.get(mk) || 0);
    rows.push({ month:mk, label:monthLabel(mk),
      forecast: fc.has(mk) ? fc.get(mk) : null,
      plan, fact,
      pct: plan > 0 ? Math.round(fact / plan * 100) : null,
      edits: pr ? pr.history.length : 0,
      dropped: plan == null,                       // в расчёт исполнения не входит
      removed: !!(pr && pr.amount == null) });     // план СНЯТ (строка есть, цели нет)
  }
  const agg = (list) => {
    const kept = list.filter(r => !r.dropped);
    const plan = round2(kept.reduce((a, r) => a + r.plan, 0));
    const fact = round2(kept.reduce((a, r) => a + r.fact, 0));
    return { plan, fact, pct: plan > 0 ? Math.round(fact / plan * 100) : null, months:kept.length };
  };
  const quarters = [1,2,3,4].map(q => {
    const a = agg(rows.slice((q - 1) * 3, q * 3));
    return { q, plan:a.plan, fact:a.fact, pct:a.pct };
  });
  const ya = agg(rows);
  const curMk = monthKey(asOf);
  const cur   = rows.find(r => r.month === curMk);
  return { year:y, rows, quarters,
    total:{ plan:ya.plan, fact:ya.fact, pct:ya.pct, monthsWithPlan:ya.months, monthsTotal:12 },
    current: (cur && !cur.dropped) ? { month:cur.month, plan:cur.plan, fact:cur.fact, pct:cur.pct } : null };
}
```

- [ ] **Step 2: Подключить к `derive`**

В `derive` после строки `const nextPayment    = nextPaymentOf(c, ledger.index, asOf);` добавить:

```js
  const planExec       = planExecOf(c, asOf, ledger.index);       // ADR-0042: показатель, не вход гейтов (И-18)
```

и в возвращаемый объект — в строку с `fullRepayDate, termAgg, reserveAccrual, scheduleTotals, nextPayment, regStatus, docs,` добавить `planExec,`:

```js
           fullRepayDate, termAgg, reserveAccrual, scheduleTotals, nextPayment, regStatus, docs, planExec,
```

Никакая другая величина `derive` от `planExec` не зависит и зависеть не должна — это и есть И-18.

- [ ] **Step 3: Экспортировать**

В `window.CR` дописать `planExecOf,` рядом с `forecastByMonth`.

- [ ] **Step 4: Коммит**

```bash
git add mockups/loan-credit/credit.html
git commit -m "feat(credit-mockup): исполнение плана — производная факт/план по месяцам"
```

---

### Task 5: Вкладка «План и исполнение»

**Files:**
- Modify: `mockups/loan-credit/credit.html:4628` — `DTABS`
- Modify: `mockups/loan-credit/credit.html:5694-5707` — `renderTab`
- Modify: `mockups/loan-credit/credit.html` — новая функция `tabPlan` перед `function tabObespechenie` (около строки 5462)
- Modify: `mockups/loan-credit/credit.html:5710-5740` — обвязка `CR.*` (состояние года и раскрытия строки)

**Interfaces:**
- Consumes из Задачи 4: `d.planExec`, `planExecOf(c, asOf, ledgerIndex, year)`
- Consumes из существующего кода: `cgrid(cols, rows, o)`, `dimTile(label, value, basis)`, `actBtn(credit, action, ctx, label, onclick, cls)`, `money`, `esc`, `jsAttr`, `derivedHtml()`, `svgInfo()`, `rerenderDetail()`, `cardAsOf`
- Produces: вкладка `'План и исполнение'`, `CR.setPlanYear(y)`, `CR.togglePlanMonth(mk)`. Кнопка «Поставить план» зовёт `CR.openPlanModal()` — саму функцию пишет Задача 6; до неё кнопка на странице есть, но клик ничего не делает. Заглушки не заводить (канон §0.1): между Задачами 5 и 6 разрыв закрывается кодом, а не тостом-обещанием.

- [ ] **Step 1: Вставить вкладку в `DTABS`**

Строка 4628 — вкладка ПОСЛЕ «Платежи» (исполнение сверяется именно с ними):

```js
  const DTABS =['Договор','Условия','Транши и освоение','Расчёты','Платежи','План и исполнение','Обеспечение','Проблемные','Досье'];
```

- [ ] **Step 2: Завести состояние вкладки**

Рядом с `let cardAsOf = TODAY;` (около строки 4624) добавить:

```js
  let planYear = pd(TODAY).getFullYear();   // год на вкладке «План и исполнение»
  let planOpenMonth = null;                 // 'YYYY-MM' развёрнутой строки (журнал правок)
```

- [ ] **Step 3: Написать `tabPlan`**

Вставить перед `function tabObespechenie(c,d){`:

```js
  /* ---- ВКЛАДКА 6: План и исполнение (ADR-0042) ----
     План — единственная ВВОДИМАЯ величина среди трёх ориентиров, и это явное исключение
     из ADR-0001, поэтому подписано прямо на вкладке. Исполнение и прогноз — производные. */
  function tabPlan(c,d){
    const pe  = (planYear === d.planExec.year) ? d.planExec : planExecOf(c, cardAsOf, d.ledger.index, planYear);
    const cur = c.currency;
    const years = (()=>{ const y0 = c.date ? pd(c.date).getFullYear() : planYear;
      const y1 = Math.max(pd(cardAsOf).getFullYear(), y0) + 1; const out=[];
      for (let y=y0; y<=y1; y++) out.push(y); return out; })();
    const pctPill = (p) => p == null ? '<span class="text-muted">—</span>'
      : `<span class="pill ${p >= 100 ? 'low' : p >= 80 ? 'mid' : 'high'}">${p} %</span>`;
    const rows = pe.rows.map(r => {
      const open = planOpenMonth === r.month;
      const prow = planRowOf(c, r.month);
      const main = `<tr${r.dropped?' class="text-muted"':''} style="cursor:${prow?'pointer':'default'}"${prow?` onclick="CR.togglePlanMonth('${jsAttr(r.month)}')"`:''}>
        <td>${esc(r.label)}${r.removed?' <span class="pill neutral">план снят</span>':''}</td>
        <td style="text-align:right">${r.forecast==null?'—':money(r.forecast)}</td>
        <td style="text-align:right">${r.plan==null?'—':`<b>${money(r.plan)}</b>`}</td>
        <td style="text-align:right">${money(r.fact)}</td>
        <td style="text-align:right">${pctPill(r.pct)}</td>
        <td>${r.dropped?'<span style="font:var(--font-label)">в расчёт не входит</span>':(r.edits?`правок: ${r.edits}`:'—')}</td></tr>`;
      if (!open || !prow) return main;
      const hist = prow.history.length
        ? prow.history.map(h=>`<div class="hrow"><b>${esc(h.at)}</b> · ${esc(h.by)} · было <b>${money(h.prev)}</b> → стало <b>${prow.amount==null?'снят':money(prow.amount)}</b>${h.note?' · '+esc(h.note):''}</div>`).join('')
        : '<div class="hrow text-muted">Правок не было</div>';
      return main + `<tr><td colspan="6" style="background:var(--surface-panel)">
        <div style="font:var(--font-label);color:var(--text-muted);margin-bottom:6px">Поставил: ${esc(prow.setBy)} · ${esc(prow.setAt)}${prow.seededFrom!=null?` · предзаполнено прогнозом: ${money(prow.seededFrom)}`:''}</div>
        ${hist}</td></tr>`;
    });
    const qRows = pe.quarters.map(q=>`<tr><td>${q.q} квартал</td><td style="text-align:right">${q.plan?money(q.plan):'—'}</td><td style="text-align:right">${money(q.fact)}</td><td style="text-align:right">${pctPill(q.pct)}</td></tr>`);
    qRows.push(`<tr style="font-weight:var(--weight-semibold);background:var(--surface-panel)"><td>За год</td>
      <td style="text-align:right">${pe.total.plan?money(pe.total.plan):'—'}</td>
      <td style="text-align:right">${money(pe.total.fact)}</td>
      <td style="text-align:right">${pctPill(pe.total.pct)}</td></tr>`);
    return `
      <div class="section-h">План и исполнение ${derivedHtml()}</div>
      <p class="section-note">План — <b>вводимая</b> величина: цель на месяц, поставленная в момент N, и от прогноза
        после сохранения она не зависит (ADR-0042). Это единственное исключение из правила «производные не хранятся».
        Исполнение — производная: факт месяца / план месяца, по всем четырём статьям долга кредита;
        расходы по обращению взыскания в факт не входят. <b>Месяц без плана в расчёт не входит</b> — ни сам,
        ни в квартальной, ни в годовой сумме. Показатель для отображения: на категорию риска, гейты и подгруппу не влияет (И-18).</p>
      <div class="phead-dims" style="grid-template-columns:repeat(4,1fr)">
        <div class="dim"><div class="dl">План за ${pe.year}</div><div class="dv">${pe.total.plan?money(pe.total.plan):'—'}</div><div class="src">${esc(cur)}</div></div>
        <div class="dim"><div class="dl">Факт за ${pe.year}</div><div class="dv">${money(pe.total.fact)}</div><div class="src">по месяцам с планом</div></div>
        <div class="dim"><div class="dl">Исполнение</div><div class="dv">${pe.total.pct==null?'—':pe.total.pct+' %'}</div><div class="src">${pe.total.plan?'факт '+money(pe.total.fact)+' / план '+money(pe.total.plan):'план не поставлен'}</div></div>
        <div class="dim"><div class="dl">Месяцев с планом</div><div class="dv">${pe.total.monthsWithPlan} из ${pe.total.monthsTotal}</div><div class="src">остальные в расчёт не входят</div></div>
      </div>
      <div class="gtoolbar" style="margin-top:14px">
        <div class="field" style="max-width:200px"><span class="flabel">Год</span><div class="control"><select onchange="CR.setPlanYear(+this.value)">${years.map(y=>`<option value="${y}"${y===pe.year?' selected':''}>${y}</option>`).join('')}</select><span class="caret">▾</span></div></div>
        <span class="spacer"></span>
        ${actBtn(c,'setPlan',{rows:[{month:monthKey(cardAsOf),amount:1}]},'Поставить план','CR.openPlanModal()','btn btn-primary btn-sm')}
      </div>
      ${cgrid([{h:'Месяц'},{h:'Прогноз',r:1},{h:'План',r:1},{h:'Факт',r:1},{h:'Исполнение',r:1},{h:'Правки'}], rows)}
      <div class="section-h" style="margin-top:22px">Итоги ${pe.year}</div>
      ${cgrid([{h:'Период'},{h:'План',r:1},{h:'Факт',r:1},{h:'Исполнение',r:1}], qRows)}`;
  }
```

Гейт-контекст у кнопки — минимальная непустая строка (`amount:1` на месяц среза): `actBtn` вызывает `gate()` до открытия формы, а форма ещё не заполнена. Реальный набор месяцев проверяется повторно в `setPlan`.

- [ ] **Step 4: Подключить к диспетчеру**

В `renderTab` добавить после `case 'Платежи': return tabPlatezhi(c, d);`:

```js
      case 'План и исполнение': return tabPlan(c, d);
```

- [ ] **Step 5: Обвязка `CR.*`**

Рядом с `CR.setCalcMode=function(v){…}` добавить:

```js
  CR.setPlanYear=function(y){ planYear=+y||planYear; planOpenMonth=null; rerenderDetail(); };
  CR.togglePlanMonth=function(mk){ planOpenMonth = (planOpenMonth===mk?null:mk); rerenderDetail(); };
```

- [ ] **Step 6: Коммит**

```bash
git add mockups/loan-credit/credit.html
git commit -m "feat(credit-mockup): вкладка «План и исполнение»"
```

---

### Task 6: Модалка «Поставить план»

**Files:**
- Modify: `mockups/loan-credit/credit.html` — после `CR.submitTargetUse` / рядом с прочими модалками (блок модалок начинается около строки 5749)

**Interfaces:**
- Consumes из Задач 1–4: `monthKey`, `monthAdd`, `monthRange`, `monthLabel`, `planRowOf`, `forecastByMonth`, `setPlan`
- Consumes из существующего кода: `modalGuard(action)`, `CR.openModal(title, body, footer)`, `CR.modalErr(reasons)`, `CR.closeModal()`, `toast(msg, kind)`, `rerenderDetail()`, `derive(c, cardAsOf)`
- Produces: `CR.openPlanModal()`, `CR.submitPlan()`

- [ ] **Step 1: Написать модалку**

Вставить в блок модалок (порядок в файле не важен; поставить после модалки платежа):

```js
  /* N) plan (setPlan, Г-30, ADR-0042) — заведение ПАЧКОЙ за период, каждая строка
     предзаполнена прогнозом месяца. Предзаполнение — стартовое значение формы, не связь:
     сохранённый план от прогноза не зависит. Месяцы, где план уже стоит, приходят со
     СВОИМ значением и помечены «будет правка» с прежней суммой — правка задним числом
     не должна выглядеть заведением с нуля. */
  CR.openPlanModal=function(){ const c=modalGuard('setPlan'); if(!c) return;
    const d=derive(c, cardAsOf);
    const from=monthKey(cardAsOf), to=monthAdd(from, 5);
    CR.openModal('Поставить план', CR.planFormHtml(c, d, from, to),
      `<button class="btn btn-secondary" onclick="CR.closeModal()">Отмена</button><button class="btn btn-primary" onclick="CR.submitPlan()">Сохранить план</button>`);
  };
  /* тело формы вынесено: пересобирается при смене периода без переоткрытия модалки */
  CR.planFormHtml=function(c, d, from, to){
    const fc=forecastByMonth(c, d.ledger.index, cardAsOf);
    const mks=monthRange(from, to);
    const rows=mks.map(mk=>{ const ex=planRowOf(c,mk);
      const seed = ex && ex.amount!=null ? ex.amount : (fc.has(mk)?fc.get(mk):0);
      return `<tr>
        <td><label><input type="checkbox" class="plan-on" data-m="${jsAttr(mk)}" checked> ${esc(monthLabel(mk))}</label></td>
        <td style="text-align:right">${fc.has(mk)?money(fc.get(mk)):'—'}</td>
        <td style="text-align:right"><input type="number" min="0" step="0.01" class="plan-amt" data-m="${jsAttr(mk)}" data-seed="${fc.has(mk)?fc.get(mk):''}" value="${seed||''}" style="width:130px;text-align:right"></td>
        <td>${ex&&ex.amount!=null?`<span class="pill mid">будет правка</span> было ${money(ex.amount)}`:(ex?'<span class="pill neutral">план был снят</span>':'—')}</td></tr>`;});
    return `<p class="section-note">План — цель на месяц, которую ставим сами. Строки предзаполнены <b>прогнозом</b>:
        это стартовое значение формы, не связь — после сохранения план от прогноза не зависит (ADR-0042).
        Снять галку — месяц не трогаем. Обнулить план месяца нельзя: чтобы отказаться от цели, снимите план на вкладке.</p>
      <div class="mform" style="grid-template-columns:1fr 1fr">
        <div class="field"><span class="flabel">С месяца</span><div class="control"><input type="month" id="planFrom" value="${esc(from)}" onchange="CR.reloadPlanForm()"></div></div>
        <div class="field"><span class="flabel">По месяц</span><div class="control"><input type="month" id="planTo" value="${esc(to)}" onchange="CR.reloadPlanForm()"></div></div>
      </div>
      <div id="planFormRows">${cgrid([{h:'Месяц'},{h:'Прогноз',r:1},{h:'План',r:1},{h:'Состояние'}], rows, {empty:'Период пуст — «по месяц» раньше «с месяца»'})}</div>
      <div class="field col-span"><span class="flabel">Примечание к правке</span><div class="control"><input id="planNote" placeholder="например: уточнено после ДС-2"></div></div>`;
  };
  CR.reloadPlanForm=function(){ const c=currentCredit(); if(!c) return;
    const from=document.getElementById('planFrom').value, to=document.getElementById('planTo').value;
    const host=document.getElementById('modalHost'); if(!host) return;
    const body=host.querySelector('.modal-b'); if(!body) return;      // тело модалки — .modal-b (см. CR.openModal)
    body.innerHTML=`<div id="modalErr"></div>`+CR.planFormHtml(c, derive(c, cardAsOf), from, to);
  };
  CR.submitPlan=function(){ const c=modalGuard('setPlan'); if(!c) return;
    const rows=[...document.querySelectorAll('.plan-amt')].map(inp=>{
      const mk=inp.getAttribute('data-m');
      const on=document.querySelector('.plan-on[data-m="'+mk+'"]');
      if(!on||!on.checked) return null;
      const seed=inp.getAttribute('data-seed');
      return { month:mk, amount:+inp.value||0, seededFrom: seed===''?null:+seed };
    }).filter(Boolean);
    const note=(document.getElementById('planNote')||{}).value||'';
    const r=CR.setPlan(c,{rows,note}); if(!r.ok){ CR.modalErr(r.reasons); return; }
    CR.closeModal(); toast('План сохранён: месяцев '+rows.length,'ok'); rerenderDetail(); };
```

Перерисовка формы при смене периода — единственное место в макете, где обновляется тело модалки, а не карточка. Контейнер `.modal-b` и `<div id="modalErr">` внутри него заданы в `CR.openModal` (строки 4174–4182); `modalErr` восстанавливается вручную, иначе `CR.modalErr` после смены периода не найдёт, куда писать отказ.

- [ ] **Step 2: Коммит**

```bash
git add mockups/loan-credit/credit.html
git commit -m "feat(credit-mockup): модалка «Поставить план» — пачка месяцев с предзаполнением прогнозом"
```

---

### Task 7: Блок прогноза в «Расчётах» и плитка шапки

**Files:**
- Modify: `mockups/loan-credit/credit.html:5286-5395` — `tabRaschety`, блок после «График — позиции»
- Modify: `mockups/loan-credit/credit.html` — новая функция `tilePlanExec` рядом с `tileNextPay`
- Modify: `mockups/loan-credit/credit.html:4889-4900` — `.phead-dims` шапки

**Interfaces:**
- Consumes из Задач 2 и 4: `trancheForecastRows(t, ledgerIndex, asOf)`, `d.planExec`
- Consumes из существующего кода: `cgrid`, `dimTile`, `scheduleRowStatus`, `d.ledger.index`, `ledgerKey`, `money`, `esc`, `derivedHtml()`, `svgInfo()`

- [ ] **Step 1: Добавить блок «Прогноз» в «Расчёты»**

В `tabRaschety`, в возвращаемом шаблоне, сразу ПОСЛЕ блока «График — позиции» (строка с `${cgrid([{h:'№'},{h:'Дата'},{h:'Осн. сумма',r:1},…], posRows, {empty:'Позиций нет — сформируйте график'})}`) и ПЕРЕД `<div class="section-h" style="margin-top:22px">Детальный расчёт`:

```js
      <div class="section-h" style="margin-top:22px">Прогноз (транш №${sel?sel.no:'—'}) ${derivedHtml()}</div>
      <p class="section-note">Прогноз — предположение о том, как график сложится <b>фактически</b>: даты те же,
        суммы пересчитаны от остатка основного долга на дату среза и непокрытого хвоста прошлого.
        Контракт он не подменяет, в начислении не участвует и в исполнение плана не входит — исполнение
        сверяет факт с <b>планом</b> (ADR-0042). Весь непокрытый хвост прошлых позиций отнесён к ближайшей будущей.</p>
      ${(()=>{ const fr = sel ? trancheForecastRows(sel, d.ledger.index, cardAsOf) : [];
        const rws = fr.map(r=>{
          const s = scheduleRowStatus({date:r.date}, d.ledger.index.get(ledgerKey(sel.no, r.no)), cardAsOf);
          const dl = r.delta;
          return `<tr${r.past?' class="text-muted"':''}><td>№${r.no}</td><td>${esc(r.date)}</td>
            <td style="text-align:right">${money(r.scheduled)}</td>
            <td style="text-align:right"><b>${money(r.forecast)}</b></td>
            <td style="text-align:right;color:${Math.abs(dl)>0.005?(dl>0?'var(--asubk-red)':'var(--text-muted)'):'inherit'}">${Math.abs(dl)>0.005?(dl>0?'+':'')+money(dl):'—'}</td>
            <td><span class="pill ${stPill[s]||'neutral'}">${esc(s)}</span></td></tr>`;});
        return cgrid([{h:'№'},{h:'Дата'},{h:'По графику',r:1},{h:'Прогноз',r:1},{h:'Δ',r:1},{h:'Статус'}], rws,
          {empty:'Графика нет — прогнозировать нечего'});
      })()}
```

`stPill` уже объявлена выше в `tabRaschety` — переиспользуется.

- [ ] **Step 2: Написать плитку шапки**

Вставить после `function tileNextPay(...)`:

```js
  /* Плитка «Исполнение плана» (ADR-0042). Плана на месяц среза нет → так и написано.
     НЕ ноль: ноль означал бы «ничего не собрали», а не «цели не ставили» — разные вещи,
     и в шапке их путать дороже всего. */
  function tilePlanExec(c,d){
    const pe=d.planExec, cur=pe.current;
    if(!cur) return dimTile(`Исполнение плана ${derivedHtml()}`, '<span style="color:var(--text-muted)">—</span>',
      `план на ${esc(monthLabel(monthKey(cardAsOf)))} не поставлен`);
    return dimTile(`Исполнение плана ${derivedHtml()}`,
      `${cur.pct} %`,
      `${esc(monthLabel(cur.month))}: факт <b>${money(cur.fact)}</b> / план <b>${money(cur.plan)}</b>`
      + (pe.total.pct!=null?`<br>за ${pe.year} — <b>${pe.total.pct} %</b>`:''));
  }
```

- [ ] **Step 3: Вставить плитку в шапку**

В `.phead-dims` шапки добавить `${tilePlanExec(c,d)}` сразу после `${tileNextPay(c,d)}`.

- [ ] **Step 4: Коммит**

```bash
git add mockups/loan-credit/credit.html
git commit -m "feat(credit-mockup): блок прогноза в «Расчётах» и плитка исполнения плана"
```

---

### Task 8: Демо-данные, реестр решений и документы

**Files:**
- Modify: `mockups/loan-credit/credit.html` — `seedDb`, сид планов на K-1/K-2/K-3
- Modify: `mockups/loan-credit/credit.html:505-560` — комментарий-шапка: Р-29, Г-30, Д-9
- Modify: `mockups/loan-credit/ASUBK-kredit-logika.md` — новый § и строка И-18 в таблицу §8
- Modify: `mockups/loan-credit/ASUBK-status-razrabotki.md` — решение волны

**Interfaces:**
- Consumes: структура `credit.plan` из Задачи 1

- [ ] **Step 1: Засеять планы**

В `seedDb` вставить блок НЕПОСРЕДСТВЕННО перед строкой 2751 `return { credits, applications, pledgesRegistry };` — к этому месту массив `credits` уже собран целиком:

```js
  /* ПЛАНЫ (ADR-0042) — сеются точечно, чтобы демо показывало все четыре состояния строки:
     обычный план · план с правкой · план снятый · месяц без плана (выпадает из расчёта).
     Фоновые K-B*/K-C* не трогаем: план — ручная работа куратора, а не свойство кредита. */
  (() => {
    const c1 = credits.find(x => x.id === 'K-1');
    if (c1) c1.plan = [
      { month:'2026-03', amount:26000, setBy:'Асанов А. К.', setAt:'25.02.2026', seededFrom:25800, history:[] },
      { month:'2026-04', amount:26000, setBy:'Асанов А. К.', setAt:'25.02.2026', seededFrom:26100, history:[] },
      { month:'2026-05', amount:30000, setBy:'Асанов А. К.', setAt:'25.02.2026', seededFrom:26000,
        history:[{ at:'12.05.2026', by:'Асанов А. К.', prev:26000, note:'уточнено после доп. соглашения' }] },
      /* 2026-06 — плана нет: месяц выпадает из расчёта целиком (и из квартала, и из года) */
      { month:'2026-07', amount:28000, setBy:'Асанов А. К.', setAt:'30.06.2026', seededFrom:27400, history:[] },
      { month:'2026-08', amount:null,  setBy:'Асанов А. К.', setAt:'30.06.2026', seededFrom:27400,
        history:[{ at:'20.07.2026', by:'Начальник отдела', prev:28000, note:'план снят: заёмщик в реструктуризации' }] },
      { month:'2026-09', amount:28000, setBy:'Асанов А. К.', setAt:'30.06.2026', seededFrom:27400, history:[] },
      { month:'2026-10', amount:28000, setBy:'Асанов А. К.', setAt:'30.06.2026', seededFrom:27400, history:[] },
      { month:'2026-11', amount:28000, setBy:'Асанов А. К.', setAt:'30.06.2026', seededFrom:27400, history:[] },
    ];
    const c2 = credits.find(x => x.id === 'K-2');
    if (c2) c2.plan = [
      { month:'2026-07', amount:40000, setBy:'Асанов А. К.', setAt:'01.07.2026', seededFrom:39200, history:[] },
      { month:'2026-08', amount:40000, setBy:'Асанов А. К.', setAt:'01.07.2026', seededFrom:39200, history:[] },
    ];
    const c3 = credits.find(x => x.id === 'K-3');
    if (c3) c3.plan = [
      { month:'2026-07', amount:15000, setBy:'Асанов А. К.', setAt:'01.07.2026', seededFrom:15000, history:[] },
    ];
  })();
```

Сид пишется прямо в объекты массива `credits`, поэтому `seedDb` продолжает возвращать свежие объекты на каждый вызов — тесты в Задаче 9 на это опираются.

- [ ] **Step 2: Записать Р-29, Г-30, Д-9 в шапку**

В комментарии-шапке, после блока `Р-28 СЛОЙ ДОЛГА ПОД РЕШЕНИЕМ СУДА …` добавить:

```
   Р-29 ПЛАН · ПРОГНОЗ · ИСПОЛНЕНИЕ ПЛАНА (01.08.2026, ADR-0042, CONTEXT.md).
        Три ориентира на будущее, и они НЕ ссылаются друг на друга. График — контракт
        транша. Прогноз — те же даты, пересчитанные суммы: производная от остатка ОД
        на дату среза и непокрытого хвоста прошлого, живёт на «Расчётах». План — цель
        на месяц по кредиту целиком: ЕДИНСТВЕННАЯ вводимая величина среди трёх и явное
        исключение из ADR-0001. Заводится не с нуля — предзаполняется прогнозом, но
        после сохранения от него не зависит: иначе % исполнения плавал бы от досрочного
        погашения по чужому траншу, хотя ни план, ни факт месяца не менялись. Правка —
        только вручную, задним числом тоже, и всегда со следом (кто, когда, прежнее
        значение). Снятие плана — не удаление (И-14): amount:null, строка остаётся.
        Исполнение = факт месяца / план месяца, все четыре статьи долга, расходы
        взыскания не входят; месяц без плана выпадает целиком — из строки, из квартала
        и из года.
```

В блок гейтов после Г-29 добавить:

```
   Г-30 setPlan — план ставится при ЖЦ «Зарегистрирован»/«Действует», сумма больше нуля
        (отказ от цели — это снятие плана, а не ноль), месяц не раньше месяца договора.
        Отказ называет сработавшую причину.
```

В блок демо-ограничений после Д-8 добавить:

```
   • Д-9 (01.08.2026). Прогноз — детерминированное упрощение, ровно как и график:
     аннуитет не пересобирается по банковским правилам, производственный календарь не
     применяется (тот же открытый вопрос, что у графика). Прогноз показывает ПОРЯДОК
     ожидаемых сумм, а не банковскую копейку.
```

- [ ] **Step 3: Дописать `ASUBK-kredit-logika.md`**

В таблицу §8 «Инварианты» после строки И-17 добавить:

```
| И-18 | План не входит ни в один гейт, ни в одну производную долга, ни в категорию риска, ни в подгруппу заёмщика | Цель, которую куратор поставил сам себе, не может ужесточать регуляторную оценку кредита. План — показатель для отображения; проверяемо: `derive` на кредите с планом и без плана даёт побитово равные `debtBalance`, `riskCategory`, `coverage`, `overdueDays` |
```

Перед §9 «Швы» добавить новый параграф:

```markdown
## 8.1. План — единственная вводимая величина среди ориентиров

У кредита три ориентира на будущее, и путать их дороже всего в отчётности.

| | Что это | Гранулярность | Хранится |
|---|---|---|---|
| **График погашения** | контрактное расписание | транш | да — версиями |
| **Прогноз** | как график сложится фактически | транш | нет, выводится |
| **План** | что сами себе поставили целью | кредит × месяц | **да** |

План хранится не по недосмотру, а потому, что отвечает на другой вопрос: не «сколько
сейчас должны получить», а «сколько собирались получить, когда план ставили». Если бы он
пересчитывался вслед за прогнозом, факт сравнивался бы с движущейся целью — % исполнения
менялся бы от досрочного погашения по чужому траншу того же кредита, хотя ни план, ни
факт в этом месяце не менялись. Неподвижность и есть его информация (ADR-0042).

Заводится план не с нуля: строка предзаполняется прогнозом месяца и хранит эту величину
отдельным полем `seededFrom`. Без него не отличить «приняли прогноз как есть» от
«поставили свою цифру», а разошлись эти два случая именно там, где спорят.

Исполнение плана — производная: факт месяца / план месяца. Факт — платежи, засчитанные по
двум осям (§4.2), по дате фактического поступления, все четыре статьи долга кредита;
расходы по обращению взыскания в него не входят и не могут войти по построению — они
приходят отдельным зеркалом, а не платежами. Месяц без плана выпадает из расчёта целиком:
и из своей строки, и из квартальной, и из годовой суммы. Его факт показывается справочно —
он существует, но сравнивать его не с чем.
```

- [ ] **Step 4: Дописать `ASUBK-status-razrabotki.md`**

В раздел «Решения волны» добавить строку про Р-29/Г-30/Д-9/И-18, а в конец файла — новый раздел:

```markdown
## Что сделано волной 01.08.2026 — план, прогноз, исполнение (ADR-0042)

Внедрены три термина, принятые 31.07.2026 в `CONTEXT.md` и ADR-0042. До этой волны будущее
кредита описывал только график погашения.

- **Прогноз** — производная транша, вкладка «Расчёты»: те же даты, суммы пересчитаны от
  фактического остатка ОД на дату среза; непокрытый хвост прошлого отнесён к ближайшей
  будущей позиции. Полная перестройка, а не позиционная дельта: иначе досрочное погашение
  не уменьшало бы будущие суммы и прогноз был бы третьим способом спросить то же, что график.
- **План** — новая вкладка «План и исполнение», гранулярность «кредит × месяц».
  Единственное хранимое поле волны (`credit.plan[]`), явное исключение из ADR-0001.
  Заводится пачкой за период, каждая строка предзаполнена прогнозом (`seededFrom` — снимок,
  не связь). Правка задним числом разрешена и оставляет след. Снятие плана — `amount:null`,
  строка остаётся видимой (И-14).
- **Исполнение** — производная факт/план по месяцам, кварталам и году; плитка в шапке
  карточки. Месяц без плана выпадает из расчёта целиком.
- Реестр кредитов НЕ трогали: ни колонки, ни фильтра по исполнению плана — это потребовало
  бы сидировать план на все 59 демо-кредитов, а план ставит куратор вручную.
```

- [ ] **Step 5: Коммит**

```bash
git add mockups/loan-credit/credit.html mockups/loan-credit/ASUBK-kredit-logika.md mockups/loan-credit/ASUBK-status-razrabotki.md
git commit -m "docs(credit-mockup): Р-29, Г-30, Д-9, И-18 и демо-планы"
```

---

### Task 9: Тесты — весь блок разом

Тестирование отложено сюда сознательно (требование владельца): смоук не гоняется после каждой задачи, весь набор пишется и прогоняется один раз.

**Files:**
- Modify: `scripts/inspect/credit-check.mjs` — проверки 80–88 и список `MODALS` в проверке 54
- Modify (по итогам прогона): `mockups/loan-credit/credit.html`

**Interfaces:**
- Consumes: `CR.seedDb`, `CR.derive`, `CR.setPlan`, `CR.planExecOf`, `CR.trancheForecastRows`, `CR.forecastByMonth`, `CR.planRowOf`, `CR.planAmountOf`, `CR.monthKey`, `CR.addPayment`, `CR.gate`, `CR.pd`, `CR.money`

- [ ] **Step 1: Добавить `openPlanModal` в проверку 54**

В массиве `MODALS` (около строки 950) дописать `'openPlanModal'` — проверка 54 открывает каждую модалку на K-1/K-3/K-5/K-6 со стаб-DOM и ловит исключения.

- [ ] **Step 2: Написать проверки 80–88**

Вставить ПЕРЕД строкой `const pass = results.filter(r => r.pass).length;`:

```js
/* ---- ПЛАН · ПРОГНОЗ · ИСПОЛНЕНИЕ (ADR-0042) ---- */

/* 80. И-18: план не двигает НИ ОДНУ производную долга. Ключевая проверка изоляции —
   без неё план рано или поздно просочится в категорию риска. */
(() => { const a = CR.seedDb(), b = CR.seedDb();
  const c1 = byId(a,'K-1'), c2 = byId(b,'K-1');
  c2.plan = [];                                                     // тот же кредит, но без плана
  const d1 = CR.derive(c1), d2 = CR.derive(c2);
  const same = d1.debtBalance === d2.debtBalance && d1.riskCategory === d2.riskCategory
    && d1.overdueDays === d2.overdueDays && d1.coverage.index === d2.coverage.index
    && d1.overdueAmount === d2.overdueAmount;
  ok(80, same, `долг ${d1.debtBalance}/${d2.debtBalance} кат ${d1.riskCategory}/${d2.riskCategory}`);
})();

/* 81. Месяц без плана выпадает ЦЕЛИКОМ: из своей строки, из квартала, из года.
   У K-1 засеян июнь 2026 без плана и август 2026 со снятым планом. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  const pe = CR.planExecOf(c, '23.07.2026', null, 2026);
  const jun = pe.rows.find(r => r.month === '2026-06');
  const aug = pe.rows.find(r => r.month === '2026-08');
  const q2  = pe.quarters.find(q => q.q === 2);
  const sumQ2Plans = ['2026-04','2026-05','2026-06']
    .map(mk => CR.planAmountOf(c, mk) || 0).reduce((a,x) => a + x, 0);
  ok(81, jun.dropped === true && jun.plan === null && aug.removed === true && aug.dropped === true
      && q2.plan === sumQ2Plans && pe.total.monthsWithPlan === 6,
     `июнь=${jun.dropped} авг-снят=${aug.removed} Q2=${q2.plan} vs ${sumQ2Plans} мес=${pe.total.monthsWithPlan}`);
})();

/* Внести ЗАСЧИТЫВАЕМЫЙ платёж. CR.addPayment для этого не годится: он заводит платёж
   ручного ввода со статусом «Ожидает ЦК» и пустым layers — такой по двум осям (Р-27)
   остаток не двигает, то есть ни прогноза, ни факта исполнения не меняет. */
const seedPay = (c, date, principal) => { c.mirror.payments.push({
  num:(c.mirror.payments.length || 0) + 1, date, bindDate:date, amount:principal,
  currency:c.currency || 'KGS', rate:null, tranche:c.tranches[0].no,
  reg:'Импорт ЦК', match:'Подтверждён ЦК', frozen:false, dispute:null,
  method:'денежными средствами',
  layers:{ principal, interest:0, penalty:0, fees:0 } }); };

/* 82. КЛЮЧЕВАЯ ПРОВЕРКА ADR-0042: сохранённый план НЕ движется, когда движется прогноз.
   Вносим платёж — прогноз на месяц меняется, план стоит на прежнем значении. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  const mk = '2026-09';
  const planBefore = CR.planAmountOf(c, mk);
  const fcBefore = CR.forecastByMonth(c, CR.derive(c).ledger.index, '23.07.2026').get(mk);
  seedPay(c, '20.07.2026', 40000);
  const fcAfter = CR.forecastByMonth(c, CR.derive(c).ledger.index, '23.07.2026').get(mk);
  const planAfter = CR.planAmountOf(c, mk);
  ok(82, planBefore === planAfter && fcBefore !== fcAfter,
     `план ${planBefore}→${planAfter} прогноз ${fcBefore}→${fcAfter}`);
})();

/* 83. Прогноз ≠ график там, где есть досрочное/частичное погашение: полная перестройка
   от фактического остатка ОД, а не копия графика с другим заголовком. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  seedPay(c, '20.07.2026', 50000);
  const t = c.tranches[0];
  const fr = CR.trancheForecastRows(t, CR.derive(c).ledger.index, '23.07.2026');
  const fut = fr.filter(r => !r.past);
  const moved = fut.some(r => Math.abs(r.delta) > 0.005);
  ok(83, fut.length > 0 && moved, `будущих=${fut.length} расхождений=${fut.filter(r=>Math.abs(r.delta)>0.005).length}`);
})();

/* 84. Прогноз будущих позиций складывается из остатка ОД, будущих процентов и
   непокрытого хвоста прошлого — и ничего больше не выдумывает. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  const d = CR.derive(c); const t = c.tranches[0];
  const fr = CR.trancheForecastRows(t, d.ledger.index, '23.07.2026');
  const fut = fr.filter(r => !r.past);
  const past = fr.filter(r => r.past);
  const sumFut  = fut.reduce((a,r) => a + r.forecast, 0);
  const tail    = past.reduce((a,r) => a + r.forecast, 0);
  const led = [...d.ledger.index.values()].filter(e => e.trancheNo === t.no);
  const paidP = led.reduce((a,e) => a + e.principalPaid, 0);
  const balP  = Math.max(0, (t.disbursements||[]).reduce((a,x)=>a+(x.amount||0),0) - paidP);
  ok(84, fut.length === 0 || sumFut >= balP + tail - 0.05,
     `Σбудущего=${sumFut.toFixed(2)} остатокОД=${balP.toFixed(2)} хвост=${tail.toFixed(2)}`);
})();

/* 85. Г-30: план не ставится на кредит в «Проекте» и на закрытый; отказ называет причину. */
(() => { const db = CR.seedDb();
  const proj = db.credits.find(c => c.lifecycle === 'Проект');
  const closed = db.credits.find(c => c.lifecycle === 'Закрыт' || c.closure);
  const g1 = proj ? CR.gate(proj, 'setPlan', { rows:[{ month:'2026-09', amount:1000 }] }) : { ok:false, reasons:['нет кредита в «Проекте»'] };
  const g2 = closed ? CR.gate(closed, 'setPlan', { rows:[{ month:'2026-09', amount:1000 }] }) : { ok:false, reasons:['нет закрытого кредита'] };
  const named = g1.reasons.some(r => /ЖЦ/.test(r));
  ok(85, g1.ok === false && g2.ok === false && named, `проект=${g1.ok} закрытый=${g2.ok} причина="${g1.reasons[0]||''}"`);
})();

/* 86. Г-30: ноль и месяц раньше договора отбиваются, снятие (amount:null) проходит. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  const zero = CR.gate(c, 'setPlan', { rows:[{ month:'2026-09', amount:0 }] });
  const early = CR.gate(c, 'setPlan', { rows:[{ month:'2000-01', amount:1000 }] });
  const drop  = CR.gate(c, 'setPlan', { rows:[{ month:'2026-09', amount:null }] });
  ok(86, zero.ok === false && early.ok === false && drop.ok === true,
     `ноль=${zero.ok} рано=${early.ok} снятие=${drop.ok}`);
})();

/* 87. Правка кладёт прежнее значение в history, а seededFrom НЕ двигается: он — снимок
   прогноза на момент заведения, а не текущее его значение (ADR-0042 §2). */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  const mk = '2026-09';
  const before = CR.planRowOf(c, mk);
  const seed0 = before.seededFrom, amt0 = before.amount, hist0 = before.history.length;
  const r = CR.setPlan(c, { rows:[{ month:mk, amount:99000, seededFrom:12345 }], note:'тест' });
  const after = CR.planRowOf(c, mk);
  const h = after.history[after.history.length - 1];
  ok(87, r.ok && after.amount === 99000 && after.seededFrom === seed0
      && after.history.length === hist0 + 1 && h.prev === amt0,
     `сумма=${after.amount} seed=${after.seededFrom}/${seed0} правок=${after.history.length} prev=${h && h.prev}`);
})();

/* 88. Снятие плана — не удаление (И-14): строка остаётся, прежнее значение в history,
   месяц выпадает из расчёта исполнения. */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  const mk = '2026-09'; const n0 = c.plan.length;
  CR.setPlan(c, { rows:[{ month:mk, amount:null }], note:'снят' });
  const row = CR.planRowOf(c, mk);
  const pe = CR.planExecOf(c, '23.07.2026', null, 2026);
  const sep = pe.rows.find(x => x.month === mk);
  ok(88, c.plan.length === n0 && !!row && row.amount === null
      && row.history[row.history.length - 1].prev != null && sep.dropped === true && sep.removed === true,
     `строк=${c.plan.length}/${n0} amount=${row && row.amount} dropped=${sep.dropped}`);
})();

/* 88b. Исполнение считается на ВСЕХ демо-кредитах без исключений — включая кредиты без
   плана, без графика и закрытые. Рендер вкладки опирается ровно на эту функцию. */
(() => { const db = CR.seedDb(); const errs = [];
  for (const c of db.credits){
    try { const pe = CR.planExecOf(c, '23.07.2026');
      if (!pe || pe.rows.length !== 12 || pe.quarters.length !== 4) errs.push(c.id + ': форма результата');
    } catch(e){ errs.push(c.id + ': ' + e.message); }
  }
  ok('88b', errs.length === 0, `кредитов=${db.credits.length} ошибок=${errs.length} ${errs.slice(0,2).join(' | ')}`);
})();
```

- [ ] **Step 3: Прогнать весь смоук один раз**

```bash
node scripts/inspect/credit-check.mjs
```

Ожидается `88/88 PASS` (79 прежних + 9 новых; счёт может отличаться на единицу — важно, что FAIL нет). Скрипт сам впечатывает штамп в комментарий-шапку HTML.

- [ ] **Step 4: Разобрать провалы**

Для каждого `FAIL` — читать напечатанный `note`, править ПРИЧИНУ в `credit.html`, а не подгонять проверку под поведение. Проверку менять можно только если ошибка в самой проверке (например, у K-1 в сиде другие суммы, чем предполагает Шаг 2). Повторять прогон до чистого прохода.

Заведомо хрупкие места, если что-то упадёт:
- проверки 82/83 зависят от того, что платёж `seedPay` реально двигает расчёт: у K-1 должен быть график с будущими позициями. Если у первого транша K-1 графика нет, брать транш с непустым `trancheScheduleRows`;
- проверка 81 завязана на сид Шага 1 Задачи 8 — если суммы в сиде другие, править ожидания в тесте;
- проверка 85 ищет кредит в «Проекте» среди демо-набора; если такого нет, взять любой и выставить `lifecycle='Проект'` перед вызовом гейта.

- [ ] **Step 5: Открыть макет в браузере и щёлкнуть вкладку**

```bash
xdg-open mockups/loan-credit/credit.html
```

Под ролью «Начальник отдела»: открыть K-1 → вкладка «План и исполнение» → проверить плитки, светофор процента, раскрытие строки мая (журнал правок), строку августа («план снят»), строку июня («в расчёт не входит»); нажать «Поставить план», сменить период, сохранить; открыть «Расчёты» и увидеть блок «Прогноз»; проверить плитку шапки. Под ролью «Наблюдатель» кнопка «Поставить план» должна быть погашена с пояснением.

- [ ] **Step 6: Коммит**

```bash
git add scripts/inspect/credit-check.mjs mockups/loan-credit/credit.html
git commit -m "test(credit-mockup): смоук плана, прогноза и исполнения (проверки 80-88b)"
```

---

## Соответствие спеке

| Раздел спеки | Задача |
|---|---|
| §1 Модель (`c.plan`, `seededFrom`, снятие ≠ удаление, history) | 1, 3 |
| §2 Прогноз (`trancheForecastRows`, `forecastByMonth`, Д-9) | 2, 7, 8 |
| §3 Исполнение (`planExecOf`, факт по двум осям, выпадение месяца) | 4 |
| §4.1 Вкладка «План и исполнение» | 5 |
| §4.2 Модалка «Поставить план» | 6 |
| §4.3 Плитка шапки | 7 |
| §5 Г-30 · И-18 · Р-29 | 3, 8 |
| §6 Проверка (8 пунктов) | 9 |
| §7 Демо-данные | 8 |
| §8 Документы к правке | 8 |
| Границы (реестр не трогаем, печати нет) | соблюдены — в задачах нет правок реестра и печатных форм |
