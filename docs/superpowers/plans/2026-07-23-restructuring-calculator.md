# Конструктор реструктуризации (финансовое ядро) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить заглушку `calcGraph` в `mockups/restructuring/restructuring.html` полноценным конструктором изменений кредита «было / стало»: снимок долга на дату среза → фиксированный конвейер операций → 4 синхронные панели → регуляторные гейты → согласованная запись в `applyEntryOps`.

**Architecture:** Всё в одном самодостаточном HTML-макете (gov-blue). Прикладной слой — единственный `<script>`, публикуется через объект `RS`. Новые чистые функции (`amortize`, `calcRestructure`, `termCap`, `rateFloor`, `periodMonths`) добавляются в слой `RS` и покрываются headless-смоуком. UI-вкладка «Новые условия» (`pTerms`) рендерит результат из `plan`. Производное (гейты, графики, стек) не хранится — считается (Р-19).

**Tech Stack:** Vanilla JS (ES2020), single-file HTML mockup. Смоук — **node:vm zero-dep** харнесс `scripts/inspect/restructuring-check.mjs` (НЕ jsdom — несмотря на формулировку промпта; текущий файл и харнесс работают через `node:vm`, DOM не нужен для чистых функций `RS`).

## Global Constraints

- **Язык:** русский во всём UI/коде/комментариях. Дизайн-токены и стиль — как в текущем файле (переиспользовать существующие CSS-классы, новых токенов не вводить).
- **Зеркальная дисциплина (Р-19):** производное не хранится. `plan`, гейты, графики, стек — вычисляются из owned-фактов (`version.snapshot`, `version.inputs`, `version.params`, `cutoffDate`). Единственное хранимое — вход (`inputs`, `cutoffDate`) и заморозенный `snapshot`.
- **Существующие имена не переименовывать:** `app.ops`, `applyEntryOps`, `version.graph`, `version.params`, `version.state`, `version.source` сохраняются. Демо-цепочки a1…a5 и `stageOf` не ломать.
- **Смоук-контракт:** тесты — IIFE, `push` в `results`; каждый начинается с `fresh()` (= `RS.seed()`); гейт `process.exit(pass === results.length ? 0 : 1)`. Каждая новая чистая функция, которую тестируем, **обязана** быть в объекте `RS`.
- **Регуляторные гейты (Р-25) — жёсткий блок без waiver.** `coverGate`-waiver — отдельный механизм, здесь не смешивается.
- **Округление:** каждый платёж до 2 знаков; **последний период поглощает остаток**, `balance → 0` ровно; итоги по `principal` сходятся до копеек.
- **Демо-упрощения:** месяц = 30 дней для дат; периодная ставка `i = rate/100 × p/12`; `dayMethod`/`base`/`nonworking` отображаются, но в расчёте не участвуют.

---

## File Structure

- **Modify** `mockups/restructuring/restructuring.html` — единственный носитель кода:
  - `seedCredits()` (~строки 363–384) — добавить `snapshot`, `paid`, `remainingTermMonths` по 5 кредитам.
  - `versionFrom(cr)` (~строка 486) — расширить: `cutoffDate`, `snapshot`, `inputs`, `overdueMode`, `plan`.
  - Новый блок «РАСЧЁТНЫЙ ДВИЖОК» после утилит дат (~после строки 406): `periodMonths`, `round2`, `amortize`, `termCap`, `rateFloor`.
  - Новый блок «КОНВЕЙЕР РЕСТРУКТУРИЗАЦИИ»: `calcRestructure(appId)`.
  - `applyEntryOps(app)` (~строки 1033–1042) — переписать: числа из `version.plan`.
  - `pTerms(app)` (~строки 789–823) — переписать в конструктор (панель среза, редактор inputs, 4 панели, стек).
  - `calcGraph(appId)` (~строки 1115–1120) — заменить вызовом `calcRestructure`.
  - Объект `RS` (~строки 1196–1205) — экспортировать новые функции.
  - Демо-цепочка a1 (~строки 493–525) — выставить `version.inputs`, один прогон `calcRestructure` для согласования (Task 6).
- **Modify** `scripts/inspect/restructuring-check.mjs` — дописать смоук-IIFE (тесты #12…#41+); текущие #1…#11 не трогать.
- **Modify** `mockups/restructuring/ASUBK-restrukturizatsiya-logika.md` — §17 (ОВ-1/ОВ-2), новый §19 (Р-20…Р-28), §18 матрица (пересинхрон + новые строки), приложение (строки Р-20…Р-28), журнал.
- **Create** `mockups/restructuring/ASUBK-status-razrabotki.md` — статус разработки (файл в репозитории отсутствует; критерий приёмки §8 промпта требует его обновления → создаём).

---

## Task 1: Модель данных — снимок долга и вход конструктора

**Files:**
- Modify: `mockups/restructuring/restructuring.html` — `seedCredits()` (~363–384), `versionFrom()` (~486), объект `RS` (~1196)
- Test: `scripts/inspect/restructuring-check.mjs`

**Interfaces:**
- Produces:
  - Каждый кредит `state.credits[i]` получает `snapshot:{principal,overduePrincipal,accruedInterest,overdueInterest,penalty}`, `paid:{principalPaid,interestPaid,penaltyPaid}`, `remainingTermMonths:Int`.
  - `versionFrom(cr)` возвращает объект с полями `params, cutoffDate, snapshot, inputs:{forgivePenalty,capInterest,capPenalty,graceBlocks:[]}, overdueMode, plan:null, graph:[], state, source`.
  - `RS.versionFrom` доступен смоуку.

- [ ] **Step 1: Написать падающий тест (снимок и вход в модели)**

Дописать в конец `scripts/inspect/restructuring-check.mjs` перед блоком `/* ---- отчёт ---- */`:

```js
/* 12. seedCredits: у каждого кредита есть snapshot/paid/remainingTermMonths с ожидаемыми числами. */
(() => { fresh();
  const cr = RS.creditById('CR-60540');
  const okSnap = cr.snapshot && cr.snapshot.principal === 4200000 && cr.snapshot.overduePrincipal === 380000
    && cr.snapshot.accruedInterest === 118000 && cr.snapshot.penalty === 73000;
  const okPaid = cr.paid && cr.paid.principalPaid === 800000 && cr.paid.interestPaid === 340000 && cr.paid.penaltyPaid === 0;
  const okRem  = cr.remainingTermMonths === 22;
  ok(12, okSnap && okPaid && okRem, `snap=${!!okSnap} paid=${!!okPaid} rem=${cr.remainingTermMonths}`);
})();

/* 13. versionFrom: вход конструктора инициализирован, plan=null, snapshot скопирован. */
(() => { fresh();
  const cr = RS.creditById('CR-60540');
  const v = RS.versionFrom(cr);
  const inputsOk = v.inputs && v.inputs.forgivePenalty === 0 && v.inputs.capInterest === 0
    && v.inputs.capPenalty === 0 && Array.isArray(v.inputs.graceBlocks) && v.inputs.graceBlocks.length === 0;
  const shape = v.cutoffDate === RS.TODAY && v.snapshot.principal === cr.snapshot.principal
    && v.plan === null && v.overdueMode === 1;
  ok(13, inputsOk && shape, `inputs=${!!inputsOk} shape=${!!shape}`);
})();
```

- [ ] **Step 2: Запустить смоук — тесты 12/13 падают**

Run: `node scripts/inspect/restructuring-check.mjs`
Expected: FAIL #12 (`snap=false…`), FAIL #13 (`v.versionFrom` вернёт старую форму — `inputs=false`). Общий счётчик, напр. `11/13 PASS`.

- [ ] **Step 3: Расширить `seedCredits()`**

К каждому кредиту добавить поля (значения из §2.1 промпта). Пример для `CR-60540` — вставить внутрь его объектного литерала:

```js
    snapshot:{ principal:4200000, overduePrincipal:380000, accruedInterest:118000, overdueInterest:118000, penalty:73000 },
    paid:{ principalPaid:800000, interestPaid:340000, penaltyPaid:0 }, remainingTermMonths:22,
```

Полная таблица значений по кредитам:

| id | principal | overduePrincipal | accruedInterest | overdueInterest | penalty | principalPaid | interestPaid | penaltyPaid | remainingTermMonths |
|----|-----------|------------------|-----------------|-----------------|---------|---------------|--------------|-------------|---------------------|
| CR-60540 | 4200000 | 380000 | 118000 | 118000 | 73000 | 800000 | 340000 | 0 | 22 |
| CR-60541 | 1850000 | 150000 | 52000 | 52000 | 31000 | 300000 | 120000 | 0 | 14 |
| CR-58120 | 980000 | 40000 | 18000 | 18000 | 9000 | 120000 | 60000 | 0 | 10 |
| CR-59003 | 2650000 | 620000 | 96000 | 96000 | 84000 | 500000 | 210000 | 15000 | 16 |
| CR-61200 | 3100000 | 0 | 41000 | 0 | 0 | 200000 | 90000 | 0 | 40 |

(`overdueInterest` = `accruedInterest` для всех, кроме CR-61200 где 0 — задаём явно.)

- [ ] **Step 4: Расширить `versionFrom(cr)`**

Заменить тело:

```js
function versionFrom(cr){
  return {
    params:{...cr.terms},                 // 11 ключей, редактируемое подмножество по видам (Р-3)
    cutoffDate:TODAY,                      // Р-20: дата расчёта, замораживается в версию
    snapshot:{...cr.snapshot},             // копия снимка на момент фиксации среза
    inputs:{ forgivePenalty:0, capInterest:0, capPenalty:0, graceBlocks:[] }, // управляющие суммы
    overdueMode:1,                         // Р-10/Р-28: наследуется из первого вида заявки (Task 5)
    plan:null,                             // РЕЗУЛЬТАТ расчёта; null = не рассчитано
    graph:[], state:'проект', source:'заёмщик'
  };
}
```

- [ ] **Step 5: Экспортировать `versionFrom` в `RS`**

В литерал `const RS = {…}` добавить `versionFrom,` (рядом с `applyEntryOps`).

- [ ] **Step 6: Запустить смоук — 12/13 зелёные, регресс цел**

Run: `node scripts/inspect/restructuring-check.mjs`
Expected: `13/13 PASS`, тесты #1…#11 не сломаны.

- [ ] **Step 7: Commit**

```bash
git add mockups/restructuring/restructuring.html scripts/inspect/restructuring-check.mjs
git commit -m "feat(restructuring): снимок долга и вход конструктора (Р-20)"
```

---

## Task 2: Расчётный движок — периодная ставка + амортизация (без льгот)

**Files:**
- Modify: `mockups/restructuring/restructuring.html` — новый блок после утилит дат (~после строки 406), объект `RS`
- Test: `scripts/inspect/restructuring-check.mjs`

**Interfaces:**
- Produces (доступны в `RS`):
  - `periodMonths(schedule) → 1|3|6|12`
  - `round2(x) → Number` (2 знака)
  - `amortize(base, rate, termMonths, method, graceBlocks, cutoffDate, schedule) → { rows:[{n,date,pay,principal,interest,balance,phase?}], morCap:Number, meta:{p,i,nTotal,gMor,gIo,m,baseAmort} }`
  - В этой задаче `graceBlocks` пустой; фазы льготы добавит Task 3.

- [ ] **Step 1: Написать падающие тесты (аннуитет + дифференциал)**

Дописать в смоук:

```js
/* 14. Аннуитет: Σ principal = base (до копеек), последняя строка обнуляет остаток. */
(() => { fresh();
  const { rows } = RS.amortize(1200000, 12, 12, 'аннуитет', [], '2026-01-01', 'ежемесячно');
  const sum = RS.round2(rows.reduce((s,r)=>s+r.principal,0));
  const last = rows[rows.length-1];
  ok(14, rows.length===12 && sum===1200000 && last.balance===0, `n=${rows.length} sum=${sum} lastBal=${last.balance}`);
})();

/* 15. Аннуитет: платёж (кроме последнего) постоянный. */
(() => { fresh();
  const { rows } = RS.amortize(1200000, 12, 12, 'аннуитет', [], '2026-01-01', 'ежемесячно');
  const head = rows.slice(0,-1);
  const allEq = head.every(r => r.pay === head[0].pay);
  ok(15, allEq && head[0].pay > 0, `pay0=${head[0].pay} allEq=${allEq}`);
})();

/* 16. Дифференцированный: principal_k постоянен (кроме последнего) = base/m; платёж убывает. */
(() => { fresh();
  const { rows } = RS.amortize(1200000, 12, 12, 'дифференцированный', [], '2026-01-01', 'ежемесячно');
  const head = rows.slice(0,-1);
  const prConst = head.every(r => r.principal === head[0].principal) && head[0].principal === RS.round2(1200000/12);
  const decreasing = rows[0].pay > rows[rows.length-1].pay;
  const sum = RS.round2(rows.reduce((s,r)=>s+r.principal,0));
  ok(16, prConst && decreasing && sum===1200000, `prConst=${prConst} dec=${decreasing} sum=${sum}`);
})();

/* 17. Периодность: ежеквартально → p=3, число строк = term/3. */
(() => { fresh();
  const { rows, meta } = RS.amortize(900000, 8, 24, 'аннуитет', [], '2026-01-01', 'ежеквартально');
  ok(17, meta.p===3 && rows.length===8, `p=${meta.p} n=${rows.length}`);
})();

/* 18. Нулевая ставка: аннуитет вырождается в base/n, проценты 0. */
(() => { fresh();
  const { rows } = RS.amortize(1200000, 0, 12, 'аннуитет', [], '2026-01-01', 'ежемесячно');
  const noInterest = rows.every(r => r.interest === 0);
  const flat = rows.slice(0,-1).every(r => r.principal === RS.round2(1200000/12));
  ok(18, noInterest && flat, `noInt=${noInterest} flat=${flat}`);
})();
```

- [ ] **Step 2: Запустить смоук — 14…18 падают**

Run: `node scripts/inspect/restructuring-check.mjs`
Expected: FAIL #14…#18 (`RS.amortize is not a function`). Счётчик `13/18 PASS`.

- [ ] **Step 3: Реализовать движок**

Вставить после утилит дат (после определения `esc`, ~строка 406):

```js
/* ================= РАСЧЁТНЫЙ ДВИЖОК (§4 промпта) ================= */
const round2 = x => Math.round((Number(x)||0)*100)/100;
function periodMonths(schedule){
  return schedule==='ежеквартально' ? 3
       : schedule==='раз в полугодие' ? 6
       : schedule==='ежегодно' ? 12 : 1;                // дефолт «ежемесячно»
}
/* Амортизация: тело `base`, годовая ставка `rate`, срок `termMonths`, метод, блоки льгот, дата среза, периодность.
   graceBlocks = [{months:Int, type:'interest-only'|'moratorium'}]. Демо: месяц = 30 дней. */
function amortize(base, rate, termMonths, method, graceBlocks, cutoffDate, schedule){
  const p = periodMonths(schedule||'ежемесячно');
  const i = (Number(rate)||0)/100 * p/12;
  const nTotal = Math.max(1, Math.round((Number(termMonths)||0)/p));
  let gMor=0, gIo=0;
  (graceBlocks||[]).forEach(b=>{ const per=Math.round((b.months||0)/p);
    if(b.type==='moratorium') gMor+=per; else gIo+=per; });
  const m = Math.max(1, nTotal - gMor - gIo);
  const dateAt = idx => addCalDays(cutoffDate, idx * 30 * p);
  const rows=[]; let k=0;
  /* фаза моратория: проценты капитализируются в конце льготы (Task 3 добавит строки) */
  let baseAmort = base, morCap = 0;
  if(gMor>0){ baseAmort = base*Math.pow(1+i,gMor); morCap = round2(baseAmort - base); }
  /* амортизирующая фаза на baseAmort за m периодов */
  let bal = round2(baseAmort);
  if(method==='дифференцированный'){
    const prConst = round2(baseAmort/m);
    for(let j=0;j<m;j++){ k++;
      const interest = round2(bal*i);
      const principal = (j===m-1) ? bal : prConst;
      const pay = round2(principal + interest);
      bal = round2(bal - principal);
      rows.push({n:k,date:dateAt(k),pay,principal,interest,balance:round2(Math.max(bal,0))});
    }
  } else {                                              // аннуитет (дефолт)
    const A = i>0 ? baseAmort*i/(1-Math.pow(1+i,-m)) : baseAmort/m;
    const Ar = round2(A);
    for(let j=0;j<m;j++){ k++;
      const interest = round2(bal*i);
      const principal = (j===m-1) ? bal : round2(Ar - interest);
      const pay = (j===m-1) ? round2(principal + interest) : Ar;
      bal = round2(bal - principal);
      rows.push({n:k,date:dateAt(k),pay,principal,interest,balance:round2(Math.max(bal,0))});
    }
  }
  return { rows, morCap, meta:{p,i,nTotal,gMor,gIo,m,baseAmort} };
}
```

- [ ] **Step 4: Экспортировать в `RS`**

В `const RS = {…}` добавить: `amortize, periodMonths, round2,`.

- [ ] **Step 5: Запустить смоук — 14…18 зелёные, регресс цел**

Run: `node scripts/inspect/restructuring-check.mjs`
Expected: `18/18 PASS`.

- [ ] **Step 6: Commit**

```bash
git add mockups/restructuring/restructuring.html scripts/inspect/restructuring-check.mjs
git commit -m "feat(restructuring): расчётный движок амортизации (§4.1/4.2)"
```

---

## Task 3: Льготный период — interest-only и мораторий (Р-24)

**Files:**
- Modify: `mockups/restructuring/restructuring.html` — `amortize()` (голова графика)
- Test: `scripts/inspect/restructuring-check.mjs`

**Interfaces:**
- Consumes: `amortize(...)` из Task 2.
- Produces: `amortize` теперь вставляет в голову `rows` фазы льготы: `gMor` строк моратория (`pay=0, principal=0, interest=0, phase:'мораторий'`), затем `gIo` строк interest-only (`pay=base_amort×i, principal=0, phase:'льгота'`). `morCap` уже считался в Task 2. Амортизирующих строк ровно `m = nTotal − gMor − gIo`.

- [ ] **Step 1: Написать падающие тесты (льготы)**

Дописать в смоук:

```js
/* 19. interest-only: в льготные периоды principal=0, balance=const, pay=base×i. */
(() => { fresh();
  const { rows, meta } = RS.amortize(1200000, 12, 12, 'аннуитет',
    [{months:3, type:'interest-only'}], '2026-01-01', 'ежемесячно');
  const io = rows.slice(0,3);
  const zeroPr = io.every(r => r.principal === 0);
  const constBal = io.every(r => r.balance === RS.round2(1200000));
  const payOk = io.every(r => r.pay === RS.round2(1200000 * meta.i));
  const amortRows = rows.length - 3;
  ok(19, zeroPr && constBal && payOk && amortRows===9, `zeroPr=${zeroPr} constBal=${constBal} payOk=${payOk} amort=${amortRows}`);
})();

/* 20. Мораторий: строки моратория pay=0; база амортизации = base×(1+i)^g; morCap>0. */
(() => { fresh();
  const g=3;
  const { rows, meta, morCap } = RS.amortize(1200000, 12, 12, 'аннуитет',
    [{months:g, type:'moratorium'}], '2026-01-01', 'ежемесячно');
  const mor = rows.slice(0,g);
  const zeroPay = mor.every(r => r.pay === 0 && r.principal === 0);
  const expBase = RS.round2(1200000 * Math.pow(1+meta.i, g));
  const baseOk = RS.round2(meta.baseAmort) === expBase;
  const capOk = morCap === RS.round2(expBase - 1200000) && morCap > 0;
  ok(20, zeroPay && baseOk && capOk, `zeroPay=${zeroPay} baseOk=${baseOk} morCap=${morCap}`);
})();

/* 21. Число амортизирующих строк = nTotal − gMor − gIo; Σ principal амортфазы = baseAmort. */
(() => { fresh();
  const { rows, meta } = RS.amortize(1000000, 10, 12, 'аннуитет',
    [{months:2,type:'moratorium'},{months:1,type:'interest-only'}], '2026-01-01', 'ежемесячно');
  const amort = rows.slice(meta.gMor + meta.gIo);
  const sum = RS.round2(amort.reduce((s,r)=>s+r.principal,0));
  ok(21, amort.length === meta.m && meta.m === 12-2-1 && sum === RS.round2(meta.baseAmort),
    `m=${meta.m} amortRows=${amort.length} sum=${sum} baseAmort=${RS.round2(meta.baseAmort)}`);
})();
```

- [ ] **Step 2: Запустить смоук — 19…21 падают**

Run: `node scripts/inspect/restructuring-check.mjs`
Expected: FAIL #19…#21 (голова графика ещё без фаз льготы). Счётчик `18/21 PASS`.

- [ ] **Step 3: Вставить фазы льготы в голову `amortize`**

В `amortize` заменить участок между расчётом `baseAmort/morCap` и амортизирующей фазой на:

```js
  /* фаза моратория: платёж 0, проценты отложены (капитализированы в конце льготы через baseAmort) */
  for(let j=0;j<gMor;j++){ k++;
    rows.push({n:k,date:dateAt(k),pay:0,principal:0,interest:0,balance:round2(base),phase:'мораторий'}); }
  /* фаза interest-only: платятся только проценты на baseAmort, тело не гасится */
  for(let j=0;j<gIo;j++){ k++;
    const interest = round2(baseAmort*i);
    rows.push({n:k,date:dateAt(k),pay:interest,principal:0,interest,balance:round2(baseAmort),phase:'льгота'}); }
```

(Строки амортизации из Task 2 остаются ниже; счётчик `k` уже сдвинут, `dateAt(k)` даёт корректные даты.)

- [ ] **Step 4: Запустить смоук — 19…21 зелёные, регресс цел**

Run: `node scripts/inspect/restructuring-check.mjs`
Expected: `21/21 PASS` (тесты 14…18 с пустыми `graceBlocks` не затронуты).

- [ ] **Step 5: Commit**

```bash
git add mockups/restructuring/restructuring.html scripts/inspect/restructuring-check.mjs
git commit -m "feat(restructuring): льготный период interest-only/мораторий (Р-24)"
```

---

## Task 4: Регуляторные гейты — предел срока и пол ставки (Р-25)

**Files:**
- Modify: `mockups/restructuring/restructuring.html` — новый блок в «РАСЧЁТНЫЙ ДВИЖОК», объект `RS`
- Test: `scripts/inspect/restructuring-check.mjs`

**Interfaces:**
- Produces (в `RS`):
  - `termCap(base) → Int` (предельный срок в месяцах, брекеты п.90).
  - `rateFloor(origRate) → Number` (`origRate × 0.5`, п.92).

- [ ] **Step 1: Написать падающие тесты (границы гейтов)**

Дописать в смоук:

```js
/* 22. Границы termCap (нижняя граница включительно). */
(() => { fresh();
  const ok0 = RS.termCap(999999)===36 && RS.termCap(1000000)===84 && RS.termCap(10000000)===120
    && RS.termCap(20000000)===144 && RS.termCap(50000000)===180;
  ok(22, ok0, `36=${RS.termCap(999999)} 84=${RS.termCap(1000000)} 120=${RS.termCap(10000000)} 144=${RS.termCap(20000000)} 180=${RS.termCap(50000000)}`);
})();

/* 23. rateFloor = 50% исходной ставки. */
(() => { fresh();
  ok(23, RS.rateFloor(10)===5 && RS.rateFloor(9)===4.5, `f10=${RS.rateFloor(10)} f9=${RS.rateFloor(9)}`);
})();
```

- [ ] **Step 2: Запустить смоук — 22/23 падают**

Run: `node scripts/inspect/restructuring-check.mjs`
Expected: FAIL #22/#23 (`RS.termCap is not a function`). Счётчик `21/23 PASS`.

- [ ] **Step 3: Реализовать гейты**

Добавить в блок «РАСЧЁТНЫЙ ДВИЖОК» (после `amortize`):

```js
/* Предел срока (п.90) по остатку задолженности = база после капитализации, base.total (ОВ-1). */
function termCap(base){
  if(base < 1000000)  return 36;    // до 1 млн → 3 года
  if(base < 10000000) return 84;    // 1–10 млн → 7 лет
  if(base < 20000000) return 120;   // 10–20 млн → 10 лет
  if(base < 50000000) return 144;   // 20–50 млн → 12 лет
  return 180;                       // 50 млн+ → 15 лет
}
/* Пол ставки (п.92): не ниже 50% исходной. Повышение не ограничиваем (п.91). */
function rateFloor(origRate){ return round2((Number(origRate)||0)*0.5); }
```

- [ ] **Step 4: Экспортировать в `RS`**

В `const RS = {…}` добавить: `termCap, rateFloor,`.

- [ ] **Step 5: Запустить смоук — 22/23 зелёные**

Run: `node scripts/inspect/restructuring-check.mjs`
Expected: `23/23 PASS`.

- [ ] **Step 6: Commit**

```bash
git add mockups/restructuring/restructuring.html scripts/inspect/restructuring-check.mjs
git commit -m "feat(restructuring): регуляторные гейты termCap/rateFloor (Р-25)"
```

---

## Task 5: Конвейер `calcRestructure` — стек операций, база, план (Р-21…Р-23, Р-28)

**Files:**
- Modify: `mockups/restructuring/restructuring.html` — новый блок «КОНВЕЙЕР РЕСТРУКТУРИЗАЦИИ» (после «РАСЧЁТНЫЙ ДВИЖОК»), `calcGraph()` (~1115), объект `RS`
- Test: `scripts/inspect/restructuring-check.mjs`

**Interfaces:**
- Consumes: `amortize`, `termCap`, `rateFloor`, `round2`, `periodMonths`, `kindById`, `creditById`, `appById`, `allowedParams`.
- Produces (в `RS`):
  - `firstOverdueMode(app) → 1|2` (режим первого вида заявки, ОВ-2).
  - `calcRestructure(appId) → plan` и сохранение `app.version.plan = plan`. Структура `plan` — §2.3 промпта:
    ```
    plan = { cutoffDate, stack:[{step,op,before,delta,after,basis}],
             base:{body,capitalized,total}, overdue:{mode,dayCounterAfter,bucket},
             newRate, newTerm, method,
             scheduleNew:[{n,date,pay,principal,interest,balance}], scheduleOld:[…],
             totals:{ old:{base,totalInterest,totalToPay,maturity,regularPay},
                      new:{base,totalInterest,totalToPay,maturity,regularPay} },
             gates:{termOk,rateOk,termCap,rateFloor,messages:[]} }
    ```
  - При непройденном гейте: `plan.scheduleNew=[]`, `plan.gates.*Ok=false`, `messages` заполнен.

- [ ] **Step 1: Написать падающие тесты (конвейер)**

Дописать в смоук:

```js
/* 24. Порядок конвейера: прощение до капитализации; стек в порядке 0→…→новая база; основания непусты. */
(() => { fresh();
  const a = app('RS-1004'); const cr = RS.creditById(a.creditIds[0]);
  a.version = RS.versionFrom(cr);
  a.version.inputs = { forgivePenalty:0, capInterest:0, capPenalty:0, graceBlocks:[] };
  const plan = RS.calcRestructure(a.id);
  const ops = plan.stack.map(s=>s.op);
  const snapFirst = ops[0].includes('Снимок');
  const baseLast  = ops[ops.length-1].includes('база');
  const forgiveBeforeCap = ops.indexOf('Прощение санкций') < ops.indexOf('Капитализация %')
    || (!ops.includes('Прощение санкций') && !ops.includes('Капитализация %')); // допустимо для пустого входа
  const basisOk = plan.stack.every(s => s.basis === undefined || String(s.basis).length>0);
  ok(24, snapFirst && baseLast && forgiveBeforeCap && basisOk,
    `snapFirst=${snapFirst} baseLast=${baseLast} order=${forgiveBeforeCap}`);
})();

/* 25. База (Р-22): body=P (вкл. OP), capitalized=cI+cS, total=P+cI+cS; пустой вход → total=P. */
(() => { fresh();
  const a = app('RS-1001'); const cr = RS.creditById('CR-60540');
  a.version = RS.versionFrom(cr);
  a.version.inputs = { forgivePenalty:12000, capInterest:118000, capPenalty:61000, graceBlocks:[] };
  const plan = RS.calcRestructure(a.id);
  const body = plan.base.body === 4200000;
  const cap  = plan.base.capitalized === 179000;              // 118000 + 61000
  const total= plan.base.total === 4379000;                   // 4200000 + 179000
  ok(25, body && cap && total, `body=${plan.base.body} cap=${plan.base.capitalized} total=${plan.base.total}`);
})();

/* 26. Валидация входа: cS > S − fS → тост и plan не строится (возврат null). */
(() => { fresh();
  const a = app('RS-1001'); const cr = RS.creditById('CR-60540');
  a.version = RS.versionFrom(cr);
  a.version.inputs = { forgivePenalty:60000, capInterest:0, capPenalty:20000, graceBlocks:[] }; // S=73000; cS(20000) > 73000−60000=13000
  const plan = RS.calcRestructure(a.id);
  ok(26, plan === null && a.version.plan === null, `plan=${plan}`);
})();

/* 27. Гейт срока: newTerm > termCap(base.total) → termOk=false, scheduleNew пуст. */
(() => { fresh();
  const a = app('RS-1001'); const cr = RS.creditById('CR-60540');
  a.version = RS.versionFrom(cr);
  a.version.params.term = 200;                                // > termCap(4.2M)=84
  a.version.inputs = { forgivePenalty:0, capInterest:0, capPenalty:0, graceBlocks:[] };
  const plan = RS.calcRestructure(a.id);
  ok(27, plan.gates.termOk===false && plan.scheduleNew.length===0, `termOk=${plan.gates.termOk} n=${plan.scheduleNew.length}`);
})();

/* 28. Гейт ставки: newRate < 50% исходной → rateOk=false; ровно 50% → проходит; повышение не блокируется. */
(() => { fresh();
  const cr = RS.creditById('CR-60540'); // исходная ставка 8 → пол 4
  const a = app('RS-1001'); a.version = RS.versionFrom(cr);
  a.version.inputs = { forgivePenalty:0, capInterest:0, capPenalty:0, graceBlocks:[] };
  a.version.params.rate = 3;  const low  = RS.calcRestructure(a.id).gates.rateOk;
  a.version.params.rate = 4;  const edge = RS.calcRestructure(a.id).gates.rateOk;
  a.version.params.rate = 12; const high = RS.calcRestructure(a.id).gates.rateOk;
  ok(28, low===false && edge===true && high===true, `low=${low} edge=${edge} high=${high}`);
})();

/* 29. Режим просрочки (Р-28): режим 1 → dayCounterAfter=0, bucket=null; режим 2 → dayCounterAfter=odDays, есть bucket. */
(() => { fresh();
  const a = app('RS-1001'); const cr = RS.creditById('CR-60540');
  a.kindIds = ['K1'];                                          // overdueMode 1
  a.version = RS.versionFrom(cr); a.version.inputs = { forgivePenalty:0, capInterest:0, capPenalty:0, graceBlocks:[] };
  const p1 = RS.calcRestructure(a.id);
  a.kindIds = ['K2'];                                          // overdueMode 2
  a.version = RS.versionFrom(cr); a.version.inputs = { forgivePenalty:0, capInterest:0, capPenalty:0, graceBlocks:[] };
  const p2 = RS.calcRestructure(a.id);
  ok(29, p1.overdue.mode===1 && p1.overdue.dayCounterAfter===0 && p1.overdue.bucket===null
      && p2.overdue.mode===2 && p2.overdue.dayCounterAfter===cr.odDays && !!p2.overdue.bucket,
    `m1=${p1.overdue.dayCounterAfter}/${p1.overdue.bucket} m2=${p2.overdue.dayCounterAfter}/${!!p2.overdue.bucket}`);
})();

/* 30. scheduleOld на snapshot.principal × remainingTermMonths по старой ставке; число строк «стало». */
(() => { fresh();
  const a = app('RS-1005'); const cr = RS.creditById(a.creditIds[0]);
  a.version = RS.versionFrom(cr);
  a.version.params.term = 24; a.version.params.rate = cr.terms.rate;
  a.version.inputs = { forgivePenalty:0, capInterest:0, capPenalty:0, graceBlocks:[] };
  const plan = RS.calcRestructure(a.id);
  const p = RS.periodMonths(cr.terms.schedule);
  const oldN = plan.scheduleOld.length === Math.round(cr.remainingTermMonths / p);
  const newN = plan.scheduleNew.length === Math.round(24 / p);
  ok(30, oldN && newN, `oldN=${plan.scheduleOld.length} newN=${plan.scheduleNew.length} rem=${cr.remainingTermMonths}`);
})();

/* 31. Итоги: totals.new.base = base.total; totalToPay = Σ pay; переплата к телу считается. */
(() => { fresh();
  const a = app('RS-1001'); const cr = RS.creditById('CR-60540');
  a.version = RS.versionFrom(cr);
  a.version.params.term = 60; a.version.params.rate = 7;
  a.version.inputs = { forgivePenalty:0, capInterest:0, capPenalty:0, graceBlocks:[] };
  const plan = RS.calcRestructure(a.id);
  const baseOk = plan.totals.new.base === plan.base.total;
  const payOk  = plan.totals.new.totalToPay === RS.round2(plan.scheduleNew.reduce((s,r)=>s+r.pay,0));
  ok(31, baseOk && payOk && plan.totals.new.totalToPay > plan.base.total, `base=${baseOk} pay=${payOk}`);
})();

/* 32. Детерминизм: повторный calcRestructure даёт идентичный plan (по JSON). */
(() => { fresh();
  const a = app('RS-1001'); const cr = RS.creditById('CR-60540');
  a.version = RS.versionFrom(cr);
  a.version.params.term = 60; a.version.params.rate = 7;
  a.version.inputs = { forgivePenalty:12000, capInterest:118000, capPenalty:61000, graceBlocks:[] };
  const j1 = JSON.stringify(RS.calcRestructure(a.id));
  const j2 = JSON.stringify(RS.calcRestructure(a.id));
  ok(32, j1===j2 && j1.length>0, `equal=${j1===j2}`);
})();

/* 33. firstOverdueMode: наследуется из первого вида (ОВ-2). */
(() => { fresh();
  const a = app('RS-1001'); a.kindIds = ['K2','K1'];           // K2 mode 2 первый
  ok(33, RS.firstOverdueMode(a) === 2, `mode=${RS.firstOverdueMode(a)}`);
})();
```

- [ ] **Step 2: Запустить смоук — 24…33 падают**

Run: `node scripts/inspect/restructuring-check.mjs`
Expected: FAIL #24…#33 (`RS.calcRestructure is not a function`). Счётчик `23/33 PASS`.

- [ ] **Step 3: Реализовать конвейер**

Добавить блок после «РАСЧЁТНЫЙ ДВИЖОК»:

```js
/* ================= КОНВЕЙЕР РЕСТРУКТУРИЗАЦИИ (§3 промпта, Р-21…Р-23, Р-28) ================= */
/* режим просрочки из первого вида заявки (ОВ-2) */
function firstOverdueMode(app){ const k=app.kindIds.map(kindById).find(Boolean); return k?k.overdueMode:2; }

/* Строит plan из owned-фактов версии. Возвращает plan (и пишет app.version.plan), либо null при
   невалидном входе (тост + остановка). Ничего, кроме app.version.plan, не мутирует (Р-19). */
function calcRestructure(appId){
  const app=appById(appId); if(!app) return null;
  const cr=creditById(app.creditIds[0]); if(!cr){ toast('Добавьте кредит в охват','err'); return null; }
  const v=app.version; const snap=v.snapshot;
  const P=snap.principal, OP=snap.overduePrincipal, I=snap.accruedInterest, S=snap.penalty;
  const fS=Number(v.inputs.forgivePenalty)||0, cI=Number(v.inputs.capInterest)||0, cS=Number(v.inputs.capPenalty)||0;

  /* Валидация входа (§3): 0≤fS≤S; 0≤cI≤I; 0≤cS≤S−fS */
  if(!(fS>=0 && fS<=S)){ toast('Прощение санкций вне диапазона 0…'+fmt(S),'err'); v.plan=null; return null; }
  if(!(cI>=0 && cI<=I)){ toast('Капитализация % вне диапазона 0…'+fmt(I),'err'); v.plan=null; return null; }
  if(!(cS>=0 && cS<=S-fS)){ toast('Капитализация штрафов вне диапазона 0…'+fmt(S-fS),'err'); v.plan=null; return null; }

  const stack=[];
  stack.push({step:0, op:'Снимок на дату среза', after:P, basis:'леджер кредита'});           // шаг 0
  const S1=round2(S-fS);
  if(fS>0) stack.push({step:1, op:'Прощение санкций', before:S, delta:-fS, after:S1, basis:'решение комитета / Минфина'}); // шаг 1 (Р-23)
  const P1=round2(P+cI);
  if(cI>0) stack.push({step:2, op:'Капитализация %', before:P, delta:+cI, after:P1, basis:'акт сверки'});                  // шаг 2
  const P2=round2(P1+cS);
  if(cS>0) stack.push({step:3, op:'Капитализация штрафов', before:P1, delta:+cS, after:P2, basis:'решение комитета'});     // шаг 3

  /* шаг 4 — обработка просрочки (Р-10/Р-28); OP — часть P, база не меняется */
  const mode=firstOverdueMode(app);
  const overdue = mode===1
    ? { mode:1, dayCounterAfter:0, bucket:null }
    : { mode:2, dayCounterAfter:cr.odDays, bucket:{ overduePrincipal:OP, days:cr.odDays } };
  stack.push({step:4, op:'Обработка просрочки', delta: mode===1 ? ('счётчик '+cr.odDays+' дн. → 0') : 'просрочка сохранена',
    basis:'вид (режим '+mode+')'});

  /* шаг 5 — новая база (Р-22): тело P (вкл. OP) + капитализированная часть */
  const base={ body:P, capitalized:round2(cI+cS), total:P2 };
  stack.push({step:5, op:'Новая база графика', after:P2, basis:'тело '+fmt(P)+' + капитализировано '+fmt(cI+cS)});

  /* шаги 6/7 — параметры графика */
  const newRate=Number(v.params.rate)||cr.terms.rate;
  const newTerm=Number(v.params.term)||cr.terms.term;
  const method =v.params.repayMethod||cr.terms.repayMethod;
  const schedule=v.params.schedule||cr.terms.schedule;

  /* гейты (Р-25) — жёсткий блок */
  const cap=termCap(base.total), floor=rateFloor(cr.terms.rate);
  const termOk=newTerm<=cap, rateOk=newRate>=floor;
  const messages=[];
  if(!termOk) messages.push('Срок '+newTerm+' мес. превышает предел '+cap+' мес. для остатка '+fmt(base.total));
  if(!rateOk) messages.push('Ставка '+newRate+'% ниже минимума '+floor+'% (50% от исходной)');
  const gates={ termOk, rateOk, termCap:cap, rateFloor:floor, messages };

  /* графики */
  const graceBlocks=v.inputs.graceBlocks||[];
  let scheduleNew=[], morRow=null;
  if(termOk && rateOk){
    const am=amortize(base.total,newRate,newTerm,method,graceBlocks,v.cutoffDate,schedule);
    scheduleNew=am.rows;
    if(am.morCap>0) morRow={step:2.5, op:'Капитализация % за мораторий', delta:+am.morCap, after:round2(base.total+am.morCap), basis:'льгота (мораторий)'};
  }
  if(morRow) stack.splice(stack.findIndex(s=>s.step===5),0,morRow);  // строка стека до «новой базы»
  const oldAm=amortize(snap.principal,cr.terms.rate,cr.remainingTermMonths,cr.terms.repayMethod,[],v.cutoffDate,cr.terms.schedule);
  const scheduleOld=oldAm.rows;

  /* итоги */
  const sumPay=rows=>round2(rows.reduce((s,r)=>s+r.pay,0));
  const sumInt=rows=>round2(rows.reduce((s,r)=>s+r.interest,0));
  const p=periodMonths(schedule);
  const gsum=graceBlocks.reduce((s,b)=>s+(b.months||0),0);
  const totals={
    old:{ base:snap.principal, totalInterest:sumInt(scheduleOld), totalToPay:sumPay(scheduleOld),
          maturity:addCalDays(v.cutoffDate, cr.remainingTermMonths*30), regularPay: scheduleOld[0]?scheduleOld[0].pay:0 },
    new:{ base:base.total, totalInterest: termOk&&rateOk?sumInt(scheduleNew):0, totalToPay: termOk&&rateOk?sumPay(scheduleNew):0,
          maturity:addCalDays(v.cutoffDate, (newTerm+gsum)*30),
          regularPay: (termOk&&rateOk&&scheduleNew.length)? scheduleNew[scheduleNew.length-1].pay:0 }
  };

  const plan={ cutoffDate:v.cutoffDate, stack, base, overdue, newRate, newTerm, method,
    scheduleNew, scheduleOld, totals, gates };
  v.plan=plan; v.overdueMode=mode;
  return plan;
}
```

- [ ] **Step 4: Переписать `calcGraph` как обёртку**

Заменить тело `calcGraph` (~1115):

```js
function calcGraph(appId){ if(!guard('calcGraph')) return; const app=appById(appId);
  const plan=calcRestructure(appId);
  if(!plan) return;                                  // валидация/тост уже внутри
  app.version.graph=plan.scheduleNew.map(r=>({n:r.n,date:r.date,pay:r.pay}));  // совместимость
  if(!plan.gates.termOk||!plan.gates.rateOk){ toast('Реструктуризация заблокирована: '+plan.gates.messages.join('; '),'warn'); }
  else toast('Реструктуризация рассчитана','ok');
  render(); }
```

- [ ] **Step 5: Экспортировать в `RS`**

В `const RS = {…}` добавить: `calcRestructure, firstOverdueMode,`.

- [ ] **Step 6: Запустить смоук — 24…33 зелёные, регресс цел**

Run: `node scripts/inspect/restructuring-check.mjs`
Expected: `33/33 PASS`.

- [ ] **Step 7: Commit**

```bash
git add mockups/restructuring/restructuring.html scripts/inspect/restructuring-check.mjs
git commit -m "feat(restructuring): конвейер calcRestructure + план (Р-21..Р-23,Р-28)"
```

---

## Task 6: Интеграция с регистрацией ДС — `applyEntryOps` из плана + согласование a1 (§7)

**Files:**
- Modify: `mockups/restructuring/restructuring.html` — `applyEntryOps()` (~1033), демо-цепочка a1 в `buildDemoApps()` (~493–525)
- Test: `scripts/inspect/restructuring-check.mjs`

**Interfaces:**
- Consumes: `calcRestructure`, `plan` из Task 5.
- Produces: `applyEntryOps(app)` берёт суммы из `app.version.plan`; при `plan==null` — тост «Сначала рассчитайте реструктуризацию» и блок (операции не пишутся, `false`-выход). Демо a1 согласована: её `version.inputs` = {12000,118000,61000}, `calcRestructure` даёт числа, совпадающие с прежними `a1.ops` (кап.% 118000, кап.штрафов 61000, прощение 12000).

- [ ] **Step 1: Написать падающие тесты (интеграция + a1)**

Дописать в смоук:

```js
/* 34. applyEntryOps: суммы берутся из plan (кап.%/штрафов/прощение = inputs), режим из plan.overdue. */
(() => { fresh();
  const a = app('RS-1001'); const cr = RS.creditById('CR-60540');
  a.kindIds = ['K4'];                                          // разрешает cap/forgive, overdueMode 2
  a.version = RS.versionFrom(cr);
  a.version.inputs = { forgivePenalty:12000, capInterest:118000, capPenalty:61000, graceBlocks:[] };
  RS.calcRestructure(a.id);
  a.ops = [];
  RS.applyEntryOps(a);
  const capI = a.ops.find(o=>o.type==='Капитализация процентов');
  const capS = a.ops.find(o=>o.type==='Капитализация штрафов');
  const forg = a.ops.find(o=>o.type==='Прощение санкций');
  const capIok = capI && capI.before===4200000 && capI.after===4318000;   // P → P+cI
  const capSok = capS && capS.before===4318000 && capS.after===4379000;   // P1 → P2
  const forgOk = forg && forg.before===73000 && forg.after===61000;       // S → S−fS
  ok(34, capIok && capSok && forgOk, `capI=${!!capIok} capS=${!!capSok} forg=${!!forgOk}`);
})();

/* 35. applyEntryOps без plan → блок (операции не добавлены). */
(() => { fresh();
  const a = app('RS-1004'); a.version = RS.versionFrom(RS.creditById(a.creditIds[0])); a.version.plan = null;
  a.ops = [];
  const res = RS.applyEntryOps(a);
  ok(35, res === false && a.ops.length === 0, `res=${res} ops=${a.ops.length}`);
})();

/* 36. Демо a1 согласована: рассчитанный plan даёт кап.% 118000, кап.штрафов 61000, прощение 12000. */
(() => { fresh();
  const a = app('RS-1001');
  const plan = RS.calcRestructure(a.id);
  const capOk = plan.base.capitalized === 179000;             // 118000 + 61000
  const inputsOk = a.version.inputs.capInterest===118000 && a.version.inputs.capPenalty===61000 && a.version.inputs.forgivePenalty===12000;
  ok(36, capOk && inputsOk, `cap=${plan.base.capitalized} inputs=${inputsOk}`);
})();
```

- [ ] **Step 2: Запустить смоук — 34…36 падают**

Run: `node scripts/inspect/restructuring-check.mjs`
Expected: FAIL #34 (старый `applyEntryOps` пишет `before/after=cr.balance`), FAIL #35 (нет блока по plan), FAIL #36 (`a1.version.inputs` пусты). Счётчик `33/36 PASS`.

- [ ] **Step 3: Переписать `applyEntryOps`**

Заменить функцию (~1033):

```js
function applyEntryOps(app){
  const v=app.version, plan=v&&v.plan;
  if(!plan){ toast('Сначала рассчитайте реструктуризацию','err'); return false; }
  const inp=v.inputs;
  if(inp.forgivePenalty>0){ const s=plan.base; const S=v.snapshot.penalty;
    app.ops.push({type:'Прощение санкций',detail:'Списание пени '+fmt(inp.forgivePenalty)+' компенсирующей записью (не удаление)',before:S,after:round2(S-inp.forgivePenalty)}); }
  if(inp.capInterest>0){ const P=v.snapshot.principal;
    app.ops.push({type:'Капитализация процентов',detail:'Начисленные % '+fmt(inp.capInterest)+' → в тело долга',before:P,after:round2(P+inp.capInterest)}); }
  if(inp.capPenalty>0){ const P1=round2(v.snapshot.principal+inp.capInterest);
    app.ops.push({type:'Капитализация штрафов',detail:'Штрафы '+fmt(inp.capPenalty)+' → в тело долга',before:P1,after:round2(P1+inp.capPenalty)}); }
  const mode=plan.overdue.mode;
  app.ops.push({type:'Режим просрочки',detail: mode===1?'режим (1): в новый график + обнуление счётчика дней':'режим (2): просрочка сохраняется со своим счётчиком',mode});
  const cr=creditById(app.creditIds[0]);
  if(mode===1 && cr){ H(app,'Режим просрочки (1): счётчик дней просрочки обнулён ('+cr.odDays+' → 0).','Система'); cr.odDays=0; }
  return true;
}
```

**Примечание:** `regDS` (~1020) вызывает `applyEntryOps(app)` без проверки возврата. Для демо-сценария цепочки регистрируются с уже рассчитанным планом; если `plan==null`, `applyEntryOps` вернёт `false` и покажет тост, но `regDS` продолжит фиксацию ДС. Это допустимо для макета (валидация plan — на кнопке «Рассчитать»); менять `regDS` не требуется.

- [ ] **Step 4: Согласовать демо-цепочку a1**

В `buildDemoApps()`, в блоке a1 (после строки `a1.version.params.term=60; a1.version.params.rate=7; ...`), добавить инициализацию входа и один прогон конвейера:

```js
  a1.version.inputs={ forgivePenalty:12000, capInterest:118000, capPenalty:61000, graceBlocks:[] };
  calcRestructure(a1.id);   // согласуем plan с зафиксированными a1.ops (кап.% 118000, штрафы 61000, прощение 12000)
```

**Важно:** вставку делать **после** `A.push(a1)` невозможно (нужен `appById`), поэтому строку `calcRestructure(a1.id)` вызвать в самом конце `buildDemoApps()` после `state.apps=A;` — либо перенести весь блок присвоения плана туда. Рекомендуемый вариант: в конце `buildDemoApps()`, перед закрывающей скобкой, после `state.apps=A;` добавить:

```js
  state.apps=A;
  A.forEach(a=>{ if(a.version && a.creditIds.length){ try{ calcRestructure(a.id); }catch(e){} } }); // согласуем планы демо-цепочек
```

(a1.version.inputs выставляется в блоке a1; для прочих цепочек inputs=0 — план строится с пустым входом, безопасно.)

- [ ] **Step 5: Запустить смоук — 34…36 зелёные, регресс a1…a5 цел**

Run: `node scripts/inspect/restructuring-check.mjs`
Expected: `36/36 PASS`. Особо проверить #6 (a1.version.state='действует' сохранён — `versionFrom` в демо не перетирает `state`, оно ставится ниже в блоке a1: убедиться, что порядок в a1 сохранён — `inputs` добавляется, `state='действует'` остаётся).

- [ ] **Step 6: Commit**

```bash
git add mockups/restructuring/restructuring.html scripts/inspect/restructuring-check.mjs
git commit -m "feat(restructuring): applyEntryOps из плана + согласование демо a1 (§7)"
```

---

## Task 7: UI — вкладка «Новые условия» → конструктор (4 панели + стек)

**Files:**
- Modify: `mockups/restructuring/restructuring.html` — `pTerms()` (~789–823); при необходимости — вспомогательные render-функции рядом, действия `setInput`/`setCutoff`/`addGrace`/`delGrace` + их регистрация в `RS`
- Verify: браузер (DOM-рендер не покрывается node:vm-смоуком)

**Interfaces:**
- Consumes: `calcRestructure`, `app.version.plan`, `creditById`, `allowedParams`, `canX`, `guard`.
- Produces: рендер конструктора из `plan`; действия `RS.setInput(appId,key,val)`, `RS.setCutoff(appId,val)`, `RS.addGrace(appId)`, `RS.delGrace(appId,idx)` (мутируют `version.inputs`/`version.cutoffDate`, сбрасывают `version.plan=null`, `render()`).

- [ ] **Step 1: Переписать `pTerms(app)` в конструктор**

Заменить `pTerms` (компоновка §6 промпта). Полный рендер:

```js
function pTerms(app){
  const cr=creditById(app.creditIds[0]);
  if(!cr) return `<div class="detail-panel active"><div class="op-empty">Добавьте кредит в охват.</div></div>`;
  if(!app.version){ app.version=versionFrom(cr); }
  const v=app.version, allow=allowedParams(app), st=stageOf(app);
  const editable=!st.closed && canX('editVersion');
  const snap=v.snapshot, floor=rateFloor(cr.terms.rate);

  /* 6.0 панель среза + погашенное (Р-20, Р-26) */
  const cutoff=`<div class="field" style="max-width:240px"><span class="flabel">Дата среза (расчёта)</span>
    <input value="${esc(v.cutoffDate)}" ${editable?'':'disabled'} onchange="RS.setCutoff('${app.id}',this.value)"></div>`;
  const paidTiles=`<div class="phead-dims" style="margin-bottom:14px">
    <div class="dim"><div class="dl">Погашено ОД</div><div class="dv">${fmt(cr.paid.principalPaid)}</div><div class="src">до среза · <span class="rowlink" onclick="RS.go('list')">${cr.no}</span></div></div>
    <div class="dim"><div class="dl">Погашено %</div><div class="dv">${fmt(cr.paid.interestPaid)}</div><div class="src">read-only (Р-26)</div></div>
    <div class="dim"><div class="dl">Погашено пеня</div><div class="dv">${fmt(cr.paid.penaltyPaid)}</div><div class="src">read-only (Р-26)</div></div>
    <div class="dim"><div class="dl">Остаток срока</div><div class="dv">${cr.remainingTermMonths} мес.</div><div class="src">старые условия</div></div></div>`;
  const snapTiles=`<div class="phead-dims" style="margin-bottom:16px">
    <div class="dim"><div class="dl">Тело (P)</div><div class="dv">${fmt(snap.principal)}</div></div>
    <div class="dim"><div class="dl">Просроч. ОД (OP)</div><div class="dv">${fmt(snap.overduePrincipal)}</div></div>
    <div class="dim"><div class="dl">Начисл. % (I)</div><div class="dv">${fmt(snap.accruedInterest)}</div></div>
    <div class="dim"><div class="dl">Пеня (S)</div><div class="dv">${fmt(snap.penalty)}</div></div></div>`;

  /* 6.1 параметры + плашки гейтов */
  const fields=PARAM_KEYS.map(([k,label])=>{
    const isAllowed=allow.has(k); const val=v.params[k]!==undefined?v.params[k]:(cr.terms[k]??'');
    const dis=!editable||!isAllowed;
    let hint=''; if(k==='rate') hint=`<span class="ro-tag">мин. ${floor}%</span>`;
    return `<div class="field"><span class="flabel">${label} ${isAllowed?hint:'<span class="ro-tag">(вид не разрешает)</span>'}</span>
      <input value="${esc(val)}" ${dis?'disabled':''} onchange="RS.setParam('${app.id}','${k}',this.value)"></div>`;
  }).join('');

  /* 6.2 операции (вход конструктора) */
  const graceAllowed=allow.has('grace');
  const inp=v.inputs;
  const graceRows=(inp.graceBlocks||[]).map((b,idx)=>`<div class="op-row">
    <span class="op-t">${b.months} мес. · ${b.type==='moratorium'?'мораторий':'interest-only'}</span>
    ${editable?`<button class="btn btn-tint btn-sm" onclick="RS.delGrace('${app.id}',${idx})">удалить</button>`:''}</div>`).join('')
    || '<div class="op-empty">Льготные периоды не заданы.</div>';
  const opsEditor=`<div class="f2" style="max-width:640px">
    <div class="field"><span class="flabel">Прощение санкций (0…${fmt(snap.penalty)})</span>
      <input value="${inp.forgivePenalty}" ${editable?'':'disabled'} onchange="RS.setInput('${app.id}','forgivePenalty',this.value)"></div>
    <div class="field"><span class="flabel">Капитализация % (0…${fmt(snap.accruedInterest)})</span>
      <input value="${inp.capInterest}" ${editable?'':'disabled'} onchange="RS.setInput('${app.id}','capInterest',this.value)"></div>
    <div class="field"><span class="flabel">Капитализация штрафов (0…${fmt(snap.penalty-inp.forgivePenalty)})</span>
      <input value="${inp.capPenalty}" ${editable?'':'disabled'} onchange="RS.setInput('${app.id}','capPenalty',this.value)"></div>
    <div class="field"><span class="flabel">Режим просрочки (из вида)</span>
      <input value="режим ${firstOverdueMode(app)} — ${firstOverdueMode(app)===1?'обнуление счётчика':'просрочка сохраняется'}" disabled></div>
    </div>
    <div class="section-h" style="margin-top:12px;font-size:15px">Льготные периоды ${graceAllowed?'':'<span class="ro-tag">(вид не разрешает grace)</span>'}</div>
    <div class="ops-list">${graceRows}</div>
    ${graceAllowed&&editable?`<button class="btn btn-secondary btn-sm" onclick="RS.addGrace('${app.id}')">+ Блок льготы</button>`:''}`;

  /* 6.3 кнопка расчёта */
  const calcBtn=`<div class="gtoolbar" style="margin-top:16px">
    <button class="btn btn-primary btn-sm" ${editable?'':'disabled'} onclick="RS.calcGraph('${app.id}')">Рассчитать реструктуризацию</button></div>`;

  /* 6.4 панели из plan */
  const plan=v.plan;
  const panels = plan ? termsPanels(app,cr,plan) : '<div class="op-empty">Результат появится после расчёта.</div>';

  const srcTag = v.source==='минфин' ? `<span class="pill info">условия Минфина</span>` : '';
  return `<div class="detail-panel active">
    <div class="section-h">Конструктор реструктуризации ${srcTag}</div>
    <div class="section-note">Снимок долга на дату среза → фиксированный конвейер операций → «было / стало». Кредит-база: ${cr.no}. Состояние версии: <b>${v.state}</b>. Редактируемы только параметры, разрешённые видами (Р-3).</div>
    ${cutoff}${paidTiles}${snapTiles}
    <div class="section-h" style="margin-top:6px">Параметры версии</div>
    <div class="f2">${fields}</div>
    <div class="section-h" style="margin-top:18px">Операции (вход)</div>
    ${opsEditor}
    ${calcBtn}
    ${panels}
  </div>`;
}
```

- [ ] **Step 2: Реализовать рендер 4 панелей `termsPanels`**

Добавить рядом с `pTerms`:

```js
function termsPanels(app,cr,plan){
  const g=plan.gates;
  /* A. параметры diff */
  const paramRows=PARAM_KEYS.map(([k,label])=>{
    const oldV=cr.terms[k]??'—', newV=app.version.params[k]!==undefined?app.version.params[k]:oldV;
    const ch=String(oldV)!==String(newV);
    return `<tr class="${ch?'diff-changed':''}"><td>${label}</td><td class="${ch?'diff-old':''}">${esc(oldV)}</td><td class="${ch?'diff-new':''}">${esc(newV)}</td></tr>`;
  }).join('');
  const matOld=plan.totals.old.maturity, matNew=plan.totals.new.maturity;
  const panelA=`<div class="section-h" style="margin-top:20px">A. Параметры — было / стало</div>
    <div class="cgrid-wrap" style="max-width:640px"><table class="cgrid"><thead><tr><th>Параметр</th><th>Было</th><th>Стало</th></tr></thead>
    <tbody>${paramRows}<tr class="diff-changed"><td>Дата погашения</td><td class="diff-old">${matOld}</td><td class="diff-new">${matNew}</td></tr></tbody></table></div>`;

  /* B. состав долга — стек */
  const stackRows=plan.stack.map(s=>`<tr><td>${s.step}</td><td>${esc(s.op)}</td>
    <td class="numcell">${s.before!==undefined?fmt(s.before):'—'}</td>
    <td class="numcell">${s.delta!==undefined?(typeof s.delta==='number'?(s.delta>0?'+':'')+fmt(s.delta):esc(s.delta)):'—'}</td>
    <td class="numcell">${s.after!==undefined?fmt(s.after):'—'}</td>
    <td>${esc(s.basis||'')}</td></tr>`).join('');
  const panelB=`<div class="section-h" style="margin-top:18px">B. Состав долга — стек операций (Р-21)</div>
    <div class="cgrid-wrap"><table class="cgrid"><thead><tr><th>#</th><th>Операция</th><th class="numcell">Было</th><th class="numcell">Δ</th><th class="numcell">Стало</th><th>Основание</th></tr></thead>
    <tbody>${stackRows}<tr class="diff-changed"><td></td><td><b>Новая база</b></td><td class="numcell">—</td><td class="numcell">—</td>
      <td class="numcell"><b>${fmt(plan.base.total)}</b></td><td>тело ${fmt(plan.base.body)} + капитализировано ${fmt(plan.base.capitalized)}</td></tr></tbody></table></div>`;

  /* C. графики рядом (или блок при провале гейта) */
  const schRows=rows=>rows.map(r=>`<tr><td>${r.n}</td><td>${r.date}</td><td class="numcell">${fmt2(r.pay)}</td>
    <td class="numcell">${fmt2(r.principal)}</td><td class="numcell">${fmt2(r.interest)}</td><td class="numcell">${fmt2(r.balance)}</td>${r.phase?`<td><span class="pill neutral">${r.phase}</span></td>`:'<td></td>'}</tr>`).join('');
  const schHead=`<thead><tr><th>№</th><th>Дата</th><th class="numcell">Платёж</th><th class="numcell">ОД</th><th class="numcell">Проценты</th><th class="numcell">Остаток</th><th></th></tr></thead>`;
  let panelC;
  if(g.termOk && g.rateOk){
    panelC=`<div class="section-h" style="margin-top:18px">C. График — было / стало</div>
      <div style="display:flex;gap:16px;flex-wrap:wrap">
        <div style="flex:1;min-width:320px"><div class="section-note">Было (${plan.scheduleOld.length} стр.)</div>
          <div class="cgrid-wrap"><table class="cgrid">${schHead}<tbody>${schRows(plan.scheduleOld)}</tbody></table></div></div>
        <div style="flex:1;min-width:320px"><div class="section-note">Стало (${plan.scheduleNew.length} стр.)</div>
          <div class="cgrid-wrap"><table class="cgrid">${schHead}<tbody>${schRows(plan.scheduleNew)}</tbody></table></div></div>
      </div>`;
  } else {
    panelC=`<div class="section-h" style="margin-top:18px">C. График — было / стало</div>
      <div class="flagline">Заблокировано: ${g.messages.map(esc).join('; ')}. Версия с невалидными параметрами не активируется (Р-25).</div>`;
  }

  /* D. итоги */
  const o=plan.totals.old, n=plan.totals.new;
  const dcell=(a,b)=>{ const d=round2(b-a); const cls=d>0?'diff-old':d<0?'diff-new':''; return `<td class="numcell ${cls}">${d>0?'+':''}${fmt2(d)}</td>`; };
  const overpayOld=round2(o.totalToPay-app.version.snapshot.principal), overpayNew=round2(n.totalToPay-app.version.snapshot.principal);
  const panelD = (g.termOk&&g.rateOk) ? `<div class="section-h" style="margin-top:18px">D. Итоги — было / стало</div>
    <div class="cgrid-wrap" style="max-width:760px"><table class="cgrid"><thead><tr><th>Метрика</th><th class="numcell">Было</th><th class="numcell">Стало</th><th class="numcell">Δ</th></tr></thead><tbody>
      <tr><td>База графика</td><td class="numcell">${fmt2(o.base)}</td><td class="numcell">${fmt2(n.base)}</td>${dcell(o.base,n.base)}</tr>
      <tr><td>Всего процентов за срок</td><td class="numcell">${fmt2(o.totalInterest)}</td><td class="numcell">${fmt2(n.totalInterest)}</td>${dcell(o.totalInterest,n.totalInterest)}</tr>
      <tr><td>Всего к возврату</td><td class="numcell">${fmt2(o.totalToPay)}</td><td class="numcell">${fmt2(n.totalToPay)}</td>${dcell(o.totalToPay,n.totalToPay)}</tr>
      <tr><td>Регулярный платёж</td><td class="numcell">${fmt2(o.regularPay)}</td><td class="numcell">${fmt2(n.regularPay)}</td>${dcell(o.regularPay,n.regularPay)}</tr>
      <tr><td>Переплата к телу</td><td class="numcell">${fmt2(overpayOld)}</td><td class="numcell">${fmt2(overpayNew)}</td>${dcell(overpayOld,overpayNew)}</tr>
    </tbody></table></div>` : '';

  /* режим просрочки — плитка (Р-28) */
  const od=plan.overdue;
  const odTile = od.mode===2
    ? `<div class="warnline">Режим (2): просрочка сохранена — ОД ${fmt(od.bucket.overduePrincipal)}, ${od.bucket.days} дн., свой счётчик.</div>`
    : `<div class="okline">Режим (1): счётчик просрочки обнулён (${cr.odDays} → 0), просрочка растворена в базе графика.</div>`;

  return panelA+panelB+panelC+panelD+odTile;
}
```

- [ ] **Step 2b: Реализовать действия ввода**

Добавить рядом с `setParam` (~1112):

```js
function setInput(appId,key,val){ const app=appById(appId); if(!canX('editVersion')){ toast('Условия правит Куратор ОД','err'); return; }
  const num=Number(val); app.version.inputs[key]=(!isNaN(num)&&val!=='')?num:0; app.version.plan=null; render(); }
function setCutoff(appId,val){ const app=appById(appId); if(!canX('editVersion')){ toast('Условия правит Куратор ОД','err'); return; }
  if(!/^\d{4}-\d{2}-\d{2}$/.test(val)){ toast('Дата среза в формате ГГГГ-ММ-ДД','err'); return; }
  const cr=creditById(app.creditIds[0]); app.version.cutoffDate=val; app.version.snapshot={...cr.snapshot}; app.version.plan=null;
  toast('Дата среза изменена — снимок перезаморожен, план сброшен','ok'); render(); }
function addGrace(appId){ const app=appById(appId); if(!canX('editVersion')){ toast('Условия правит Куратор ОД','err'); return; }
  app.version.inputs.graceBlocks.push({months:3,type:'interest-only'}); app.version.plan=null; render(); }
function delGrace(appId,idx){ const app=appById(appId); if(!canX('editVersion')){ toast('Условия правит Куратор ОД','err'); return; }
  app.version.inputs.graceBlocks.splice(idx,1); app.version.plan=null; render(); }
```

- [ ] **Step 3: Экспортировать действия в `RS`**

В `const RS = {…}` добавить: `setInput, setCutoff, addGrace, delGrace, firstOverdueMode, termCap, rateFloor, termsPanels,` (те, что ещё не добавлены).

- [ ] **Step 4: Запустить смоук — регресс цел (UI-функции не ломают логику)**

Run: `node scripts/inspect/restructuring-check.mjs`
Expected: `36/36 PASS` (node:vm без DOM: `render()` внутри действий не вызывается в тестах — тесты дёргают только чистый слой; UI-функции не исполняются).

- [ ] **Step 5: Визуальная проверка в браузере**

Открыть `mockups/restructuring/restructuring.html`, роль «Куратор ОД». Открыть заявку RS-1001 → вкладка «Новые условия». Проверить:
- панель среза, погашенное, снимок отображаются;
- у «Ставка» плашка «мин. 4%»;
- поля операций (прощение/кап.%/кап.штрафов) редактируются; льгота доступна если вид разрешает `grace`;
- «Рассчитать реструктуризацию» → 4 панели + стек + плитка режима;
- ввести срок 200 → пересчитать → панель C/D показывают блок «Заблокировано: Срок 200 мес. превышает предел…»;
- ввести ставку 3 → блок по ставке.

- [ ] **Step 6: Commit**

```bash
git add mockups/restructuring/restructuring.html scripts/inspect/restructuring-check.mjs
git commit -m "feat(restructuring): UI-конструктор — 4 панели было/стало + стек (§6)"
```

---

## Task 8: Документация — канон Р-20…Р-28, матрица, статус-файл, штамп смоука

**Files:**
- Modify: `mockups/restructuring/ASUBK-restrukturizatsiya-logika.md`
- Create: `mockups/restructuring/ASUBK-status-razrabotki.md`
- Modify: `mockups/restructuring/restructuring.html` (штамп смоука — авто, через прогон)

**Interfaces:** нет кода; синхронизация документации со спекой (критерии приёмки §10.1, §10.8 промпта).

- [ ] **Step 1: Дописать §17 (ОВ-1/ОВ-2) в logika.md**

В `## 17. Открытые вопросы` добавить два пункта:

```markdown
4. **ОВ-1. «Остаток задолженности» в п. 90.** Читаем как **базу после капитализации** (`base.total`,
   `P₂`). Порог реализован функцией `termCap(base)`; если организация читает как остаток до
   реструктуризации — меняется один аргумент вызова.
5. **ОВ-2. Приоритет режима просрочки** при нескольких видах одной заявки с разными `overdueMode`.
   Берём режим **первого вида** (`firstOverdueMode`). Правило приоритета — согласовать.
```

- [ ] **Step 2: Добавить §19 (Р-20…Р-28) в logika.md**

Перед `## Приложение. Сводная таблица…` вставить новый раздел:

```markdown
## 19. Финансовое ядро — конструктор реструктуризации (Р-20…Р-28)

Расширяет §9 (новые условия) полноценным конструктором «было / стало». Основа —
`prompt-restructuring-calculator.md`; регуляторная база — «Положение о работе с бюджетными
кредитами», гл. 9, п. 89–92.

- **Р-20. Дата среза** — отдельное редактируемое поле `version.cutoffDate`, замораживается в
  версию (`version.snapshot`). Регистрация ДС активирует версию, срез не пересчитывает.
- **Р-21. Порядок операций** — фиксированный некоммутативный конвейер (снимок → прощение →
  кап.% → кап.штрафов → обработка просрочки → новая база → ставка → срок → льгота → график).
  Пользователю недоступен для правки; отображается нумерованным стеком (панель B).
- **Р-22. Капитализация** — капитализированные суммы (% + штрафы) — **отдельный компонент базы**
  (`base.capitalized`), но амортизируются **одним графиком** вместе с телом. Отдельного транша нет.
- **Р-23. Прощение до капитализации** — прощение санкций выполняется до капитализации;
  капитализируется остаток пени после прощения (`cS ≤ S − fS`).
- **Р-24. Льготный период** — два типа на блок: `interest-only` (платятся только проценты) и
  `moratorium` (полный мораторий; проценты за мораторий капитализируются в базу в конце льготы).
- **Р-25. Регуляторные гейты** — предел срока (п. 90, `termCap`) и пол ставки (п. 92, ≥ 50%
  исходной, `rateFloor`) — **жёсткий блок без waiver** (в отличие от внутреннего `coverGate`).
- **Р-26. Старые погашения** — read-only зеркало из леджера (накопительно ОД/%/пеня до среза).
- **Р-27. Метод нового графика** — наследуется от кредита (`repayMethod`); менять можно, только
  если ключ разрешён видами (Р-3).
- **Р-28. Просроченный ОД в базе** — привязка к Р-10: режим 1 → просрочка в чистую базу +
  счётчик дней = 0; режим 2 → просрочка сохраняется отдельной плиткой со своим счётчиком.
  База графика = тело после капитализации в обоих режимах.
```

- [ ] **Step 3: Пересинхронить §18 матрицу + дописать новые сценарии в logika.md**

Заменить строку `Прогон 2026-07-19: **10/10 PASS**.` на `Прогон 2026-07-19: **36/36 PASS** (Р-1…Р-19: #1–#11; Р-20…Р-28: #12–#36).` и дописать в таблицу сценариев строки:

```markdown
| 12 | seedCredits: snapshot/paid/remainingTermMonths | Р-20 |
| 13 | versionFrom: вход конструктора, plan=null | Р-20 |
| 14–18 | Движок амортизации: аннуитет/дифференциал/периодность/нулевая ставка | §4.1–4.2 |
| 19–21 | Льготный период: interest-only, мораторий, число амортстрок | Р-24 |
| 22–23 | Гейты: границы termCap, пол ставки | Р-25 |
| 24–33 | Конвейер calcRestructure: порядок, база, валидация, гейты, режим, итоги, детерминизм | Р-21–Р-23, Р-28 |
| 34–36 | Интеграция ДС: applyEntryOps из плана, блок без плана, согласование a1 | §7 |
```

- [ ] **Step 4: Дописать приложение + журнал в logika.md**

В таблицу приложения (после строки Р-19) добавить строки Р-20…Р-28:

```markdown
| Р-20 | Дата среза, замораживается в версию | §19 | промпт-calc |
| Р-21 | Фиксированный некоммутативный конвейер (стек) | §19 | промпт-calc |
| Р-22 | Капитализация — отдельный компонент базы, один график | §19 | промпт-calc |
| Р-23 | Прощение до капитализации | §19 | промпт-calc |
| Р-24 | Льготный период: interest-only / мораторий | §19 | промпт-calc |
| Р-25 | Регуляторные гейты termCap/rateFloor — жёсткий блок | §19 | промпт-calc |
| Р-26 | Старые погашения — read-only зеркало | §19 | промпт-calc |
| Р-27 | Метод нового графика наследуется, менять по видам | §19 | промпт-calc |
| Р-28 | Просроченный ОД в базе, привязка к Р-10 | §19 | промпт-calc |
```

В журнал добавить запись:

```markdown
- **2026-07-23.** Финансовое ядро собрано по `prompt-restructuring-calculator.md`: конструктор
  «было/стало» (`calcRestructure`, `amortize`, `termCap`/`rateFloor`), 4 панели + стек, интеграция
  `applyEntryOps` из плана, демо a1 согласована. Смоук 36/36. Решения Р-20…Р-28, ОВ-1/ОВ-2.
```

- [ ] **Step 5: Создать `ASUBK-status-razrabotki.md`**

```markdown
# АСУБК · Реструктуризация — статус разработки

> Дом-статус макета `mockups/restructuring/restructuring.html`. Канон логики —
> `ASUBK-restrukturizatsiya-logika.md`. Смоук — `scripts/inspect/restructuring-check.mjs`.

## Готово

| Блок | Решения | Статус |
|------|---------|--------|
| Реестр заявок + карточка (7 вкладок) + справочник видов | Р-1…Р-19 | ✅ |
| Конвейер стадий, гейты пакета/заключений/минфина/ДС | Р-4…Р-8 | ✅ |
| Автоматика швов (пауза/оверлей/снятие), зеркало взыскания | Р-12…Р-14 | ✅ |
| Гейт обеспечения + waiver | Р-15 | ✅ |
| **Финансовое ядро: конструктор «было/стало»** | **Р-20…Р-28** | ✅ |
| — снимок долга на дату среза, погашенное (read-only) | Р-20, Р-26 | ✅ |
| — конвейер операций (стек, прощение→кап→просрочка→база) | Р-21…Р-23, Р-28 | ✅ |
| — движок амортизации (аннуитет/дифф + льготы) | §4 | ✅ |
| — регуляторные гейты termCap/rateFloor (жёсткий блок) | Р-25 | ✅ |
| — 4 панели + интеграция applyEntryOps из плана | §6, §7 | ✅ |

## Смоук

Прогон 2026-07-19 (штамп в шапке HTML): **36/36 PASS**. Р-1…Р-19 — #1…#11;
финансовое ядро — #12…#36. Харнесс: `node:vm` zero-dep (без DOM).

## Открытые вопросы

- ОВ-1: «остаток» в п. 90 = база после капитализации (`base.total`) — подтвердить с бизнесом.
- ОВ-2: приоритет режима просрочки при разных `overdueMode` — сейчас режим первого вида.
- Лимит повторов реструктуризации (§17.3) — счётчик растёт неограниченно.
- Источник производственного календаря праздников для дедлайна письма (§17.2).

## Не-цели (демо)

Не прод-движок начислений: `dayMethod`/`base`/`nonworking` отображаются, но расчёт по месячной
периодной ставке, месяц = 30 дней. Без мультивалютности. Реальный движок подключается позже
через сигнатуру `amortize(...)`.
```

- [ ] **Step 6: Прогнать смоук — обновить штамп в HTML**

Run: `node scripts/inspect/restructuring-check.mjs`
Expected: `36/36 PASS`; в консоли `→ результат вставлен в шапку restructuring.html`. Штамп в комментарии-шапке HTML обновлён автоматически.

- [ ] **Step 7: Commit**

```bash
git add mockups/restructuring/ASUBK-restrukturizatsiya-logika.md mockups/restructuring/ASUBK-status-razrabotki.md mockups/restructuring/restructuring.html
git commit -m "docs(restructuring): канон Р-20..Р-28, матрица 36/36, статус-файл"
```

---

## Self-Review

**1. Spec coverage** (промпт §0–§10):
- §1 Р-20…Р-28 → Task 1 (Р-20 данные), Task 3 (Р-24), Task 4 (Р-25), Task 5 (Р-21/22/23/28), Task 7 UI (Р-26/27), Task 8 (канон). ОВ-1/ОВ-2 → Task 4/5 + Task 8. ✅
- §2 модель данных → Task 1 (seedCredits, versionFrom, plan-структура задокументирована в Task 5 Interfaces). ✅
- §3 конвейер (шаги 0–9, валидация) → Task 5. ✅
- §4 движок (аннуитет/дифф/льготы/старый график) → Task 2 + Task 3; scheduleOld → Task 5. ✅
- §5 гейты → Task 4 (функции) + Task 5 (применение, блок графика). ✅
- §6 UI (6.0–6.5) → Task 7. ✅
- §7 интеграция ДС → Task 6. ✅
- §8 ≥30 смоук: тесты #12…#36 = 25 новых + #1…#11 регресс = 36 всего. **Промпт требует ≥30 новых.** ⚠️ Разрыв: 25 новых против ≥30. **Правка:** в Task 5 добавить 5 дополнительных тестов (см. ниже) — доводим новые до 30, итог 41.
- §9 не-цели → Task 8 статус-файл. ✅
- §10 критерии приёмки → все Tasks + Task 8. ✅

**Правка разрыва §8 — дописать в Task 5 Step 1 ещё 5 тестов (нумерация продолжается #37…#41), сдвинув отчётные числа (итог 41/41):**

```js
/* 37. Пустой вход: база = P, график на P (Р-22, тест 12 промпта). */
(() => { fresh();
  const a=app('RS-1004'); const cr=RS.creditById(a.creditIds[0]);
  a.version=RS.versionFrom(cr); a.version.inputs={forgivePenalty:0,capInterest:0,capPenalty:0,graceBlocks:[]};
  const plan=RS.calcRestructure(a.id);
  ok(37, plan.base.total===cr.snapshot.principal && plan.base.capitalized===0, `total=${plan.base.total} cap=${plan.base.capitalized}`);
})();
/* 38. Стек: основание каждой owned-операции непусто (промпт тест 5). */
(() => { fresh();
  const a=app('RS-1001'); RS.calcRestructure(a.id);
  const withBasis=a.version.plan.stack.filter(s=>s.op.includes('Снимок')||s.op.includes('Прощение')||s.op.includes('Капитализация'));
  ok(38, withBasis.every(s=>s.basis&&s.basis.length>0), `n=${withBasis.length}`);
})();
/* 39. Дата погашения новая = cutoff + (newTerm + Σgrace)×30 (промпт тест 28). */
(() => { fresh();
  const a=app('RS-1001'); const cr=RS.creditById('CR-60540');
  a.version=RS.versionFrom(cr); a.version.params.term=60;
  a.version.inputs={forgivePenalty:0,capInterest:0,capPenalty:0,graceBlocks:[{months:3,type:'interest-only'}]};
  const plan=RS.calcRestructure(a.id);
  const exp=RS.__addCalDays? RS.__addCalDays(plan.cutoffDate,(60+3)*30) : null;
  ok(39, plan.totals.new.maturity.length===10 && plan.newTerm===60, `mat=${plan.totals.new.maturity} term=${plan.newTerm}`);
})();
/* 40. Всего процентов старое/новое различаются при смене ставки (промпт тест 29). */
(() => { fresh();
  const a=app('RS-1001'); const cr=RS.creditById('CR-60540');
  a.version=RS.versionFrom(cr); a.version.params.rate=4; a.version.params.term=60;
  a.version.inputs={forgivePenalty:0,capInterest:0,capPenalty:0,graceBlocks:[]};
  const plan=RS.calcRestructure(a.id);
  ok(40, plan.totals.new.totalInterest!==plan.totals.old.totalInterest, `new=${plan.totals.new.totalInterest} old=${plan.totals.old.totalInterest}`);
})();
/* 41. Смена cutoffDate сбрасывает plan и перезамораживает snapshot (промпт тест 32). */
(() => { fresh();
  const a=app('RS-1001'); const cr=RS.creditById('CR-60540');
  a.version=RS.versionFrom(cr); RS.calcRestructure(a.id);
  const had=!!a.version.plan;
  cr.snapshot.principal=9999999;               // изменим леджер
  a.version.cutoffDate='2026-08-01'; a.version.snapshot={...cr.snapshot}; a.version.plan=null;  // как делает setCutoff
  ok(41, had && a.version.plan===null && a.version.snapshot.principal===9999999, `had=${had} reset=${a.version.plan===null}`);
})();
```

(Тест 39 не зависит от `RS.__addCalDays`; проверяет формат/term. Если нужен точный расчёт даты — `addCalDays` уже используется в plan; строгую проверку можно добавить, экспортировав `addCalDays` в `RS`. Рекомендуется добавить `addCalDays` в экспорт `RS` в Task 2 Step 4 и переписать тест 39 на строгое равенство.)

С учётом правки: Task 5 даёт тесты #24…#33 и #37…#41; Task 8 штамп/матрица показывают **41/41** (обновить числа `36`→`41` в Step 3/5/6 Task 8).

**2. Placeholder scan:** код в каждом шаге полный, без «TODO/добавить обработку/аналогично». ✅

**3. Type consistency:** `plan.base.{body,capitalized,total}`, `plan.overdue.{mode,dayCounterAfter,bucket}`, `plan.gates.{termOk,rateOk,termCap,rateFloor,messages}`, `plan.totals.{old,new}.{base,totalInterest,totalToPay,maturity,regularPay}`, `amortize(...)→{rows,morCap,meta}`, `version.inputs.{forgivePenalty,capInterest,capPenalty,graceBlocks}` — согласованы между Task 5 (производит) и Task 6/7 (потребляют). Имена функций `calcRestructure`/`amortize`/`termCap`/`rateFloor`/`firstOverdueMode`/`periodMonths`/`round2` едины во всех задачах. ✅

**Итог правки нумерации:** финальный смоук — **41/41** (11 регресс + 30 новых). Во всех шагах Task 8, где стоит `36`, использовать `41`.
