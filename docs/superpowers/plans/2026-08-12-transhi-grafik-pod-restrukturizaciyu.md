# «Транши» и «График» под реструктуризацию — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Научить вкладки «Транши» и «График» карточки кредита тому, что решила
реструктуризация: транш рождается **освоением либо разделением по ДС** (ADR-0092), строку
графика несут **статьи** (ADR-0109), а применение ДС идёт **одной дверью** в кредите
(ADR-0096). Производный транш при этом **не расходует сумму договора** (ADR-0115).

**Architecture:** Правится один файл — `mockups/loan-credit/credit.html` (самодостаточный
HTML-макет: один `<script>`, логический слой экспортируется в `window.CR` на `:5382`, UI
читает его через `CR.*`). Новое хранилище ровно одно — `t.transfers[]`; всё остальное
(происхождение транша, остаток тела, действующая версия графика, состав статейных колонок)
— **производные** (Р-11 / ADR-0001). Пишущая дверь одна: `restructureApplied(ds)`. Тесты —
новые кейсы в headless-смоуке `scripts/inspect/credit-check.mjs`.

**Tech Stack:** ванильный ES2020 в одном `<script>`, шаблонные строки вместо шаблонизатора,
Node 24 + `node:vm` для смоука, JSDOM для `tests/scope.test.mjs`. Сборки нет — файл
открывается браузером напрямую.

## Global Constraints

- **Язык интерфейса и комментариев — русский.** Английских подписей в UI не появляется.
- **Комментарий объясняет «почему», а не «что»** — у каждого нетривиального решения причина
  и отвергнутая альтернатива.
- **Производные не хранятся (Р-11 / ADR-0001).** Происхождение транша, остаток тела,
  действующая версия графика, состав статейных колонок — считаются на лету. Единственное
  новое поле-хранилище за всю волну — `t.transfers[]`.
- **§0.3 — не молчаливый отказ.** Недоступное действие остаётся видимым: погашенный контрол
  + `title` с причиной + `CR.toast(причина,'warn')` по клику.
- **Порядок секций скрипта фиксирован:** utils → `seedDb` → чистая логика → мутации →
  `window.CR` → `if (typeof document !== 'undefined')` DOM-блок. Правки ложатся в свои
  секции, не поперёк.
- **Пустая колонка не рисуется.** Статейные колонки появляются только когда в строках есть
  что показать — как «Курс / ≈KGS» у валютных кредитов.
- **Зеркало read-only.** `c.mirror.restructuring` дверь **читает**; пишет она только в
  собственные структуры кредита. Замок и подпись источника на зеркальных строках обязательны.
- **Р-16 цел.** Кредит реструктуризацию не **заводит** — он **применяет** пришедшее зеркалом
  ДС. Кнопка называется «Применить ДС», не «Реструктурировать».
- **Р-4.** Версии графика не перезаписываются и не удаляются — только добавляются.
- **Смоук сам переписывает `credit.html`** — впечатывает стамп `SMOKE (node) …` в шапку;
  после каждого прогона файл изменён и входит в коммит.
- **Базовые числа до начала работ:** `credit-check.mjs` — `114/114 PASS` (последние кейсы —
  `ok(111,…)` `:965`, `ok(112,…)` `:978`; нумерация ярлыков не сплошная, счёт идёт по
  `results.length`); `restructuring-check.mjs` — `57/57`; `npm run test:credit` — 38 тестов.
- **Номера строк — снимок ДО работ.** Каждая задача сдвигает файл; место правки искать по
  тексту-якорю, номер — только ориентир.
- **Спека:** [`docs/superpowers/specs/2026-08-12-transhi-grafik-pod-restrukturizaciyu-design.md`](../specs/2026-08-12-transhi-grafik-pod-restrukturizaciyu-design.md).
- **ADR:** [0115](../../adr/0115-proizvodnyy-transh-ne-rashoduet-summu-dogovora.md) (заведён и
  закоммичен до начала работ) · [0092](../../adr/0092-restrukturizaciya-delit-transh-perenos-datirovan.md)
  · [0096](../../adr/0096-odna-dver-v-kredit-dvizhok-amortizacii-u-kredita.md)
  · [0109](../../adr/0109-stroka-grafika-neset-stati.md).

---

### Task 1: Перенос, происхождение транша и остаток тела

**Files:**
- Modify: `mockups/loan-credit/credit.html` — секция чистой логики, рядом с `disbursedSum`
  (`:3282`)
- Modify: `mockups/loan-credit/credit.html:4587-4589` (`derive`: `allocated` / `allocatable`)
- Modify: `mockups/loan-credit/credit.html:4677` (гейт `addTranche`, Г-3)
- Modify: `mockups/loan-credit/credit.html:5382+` (экспорт в `window.CR`)
- Test: `scripts/inspect/credit-check.mjs` — новые кейсы `ok(113,…)`, `ok(114,…)`

**Interfaces:**
- Consumes: `disbursedSum(t)` (`:3282`), `buildLedger(c, asOf)` (`:4069`) — поле
  `r.principalPaid`, `round2`, `pd`.
- Produces: `CR.trancheOrigin(t) → 'освоение'|'разделение'` · `CR.transferredOut(t,d)` ·
  `CR.transferredIn(t,d)` · `CR.repaidPrincipalOf(c,t,d)` · `CR.trancheBalanceAt(c,t,d)`.
  Ими пользуются Task 4 (Г-4/Г-8), Task 5 (дверь), Task 7 (рендер «Траншей»).

- [ ] **Step 1: Написать падающие тесты**

В `scripts/inspect/credit-check.mjs`, после кейса `ok(112,…)` (`:978`), вставить два кейса.
`#113` — происхождение и Г-3 на кредите **без** производных (ничего не изменилось);
`#114` — формула ИР-3 на синтетическом транше с переносом в обе стороны:

```js
  /* 113. ПРОИСХОЖДЕНИЕ ТРАНША и Г-3 (КВ-26, ADR-0115). У обычного кредита производных нет,
     значит распределение обязано считаться ровно как прежде — этот кейс держит регресс:
     фильтр по происхождению не имеет права поменять цифры там, где реструктуризации не было. */
  const kOrd = CR2.db.credits.find(c => c.id === 'K-1');
  const dOrd = CR2.derive(kOrd, '23.07.2026');
  const sumAll = kOrd.tranches.reduce((a,t) => a + (t.amount||0), 0);
  ok(113, kOrd.tranches.every(t => CR2.trancheOrigin(t) === 'освоение')
          && Math.abs(dOrd.allocated - sumAll) < 0.005
          && Math.abs(dOrd.allocatable - (kOrd.contractAmount - sumAll)) < 0.005,
     `происхождений «освоение» ${kOrd.tranches.length} allocated=${dOrd.allocated}`);

  /* 114. ИР-3 — остаток тела четырьмя слагаемыми (ADR-0092 §2). Проверяем на синтетическом
     транше, а не на сеяном: формула обязана держаться в обе стороны, а сеять транш,
     который и отдал, и принял, значило бы придумывать демо ради теста. */
  const tSyn = { no:99, amount:100000,
    disbursements:[{ date:'01.02.2026', amount:100000 }],
    transfers:[{ date:'01.05.2026', dir:'out', amount:40000, counterTranche:100 },
               { date:'01.06.2026', dir:'in',  amount:5000,  counterTranche:100 }] };
  const b0 = CR2.trancheBalanceAt(kOrd, tSyn, '01.04.2026');   // до переносов
  const b1 = CR2.trancheBalanceAt(kOrd, tSyn, '15.05.2026');   // после out
  const b2 = CR2.trancheBalanceAt(kOrd, tSyn, '15.06.2026');   // после out и in
  ok(114, Math.abs(b0 - 100000) < 0.005 && Math.abs(b1 - 60000) < 0.005
          && Math.abs(b2 - 65000) < 0.005,
     `${b0} → ${b1} → ${b2}`);
```

- [ ] **Step 2: Прогнать смоук, убедиться, что кейсы падают**

Run: `node scripts/inspect/credit-check.mjs`
Expected: `FAIL #113` и `FAIL #114` (`CR2.trancheOrigin is not a function` — смоук ловит
исключение кейса как FAIL), итог `114/116 PASS`, код возврата 1.

- [ ] **Step 3: Добавить чистую логику переноса**

В `mockups/loan-credit/credit.html` сразу после `disbursedSum` (`:3282`) вставить:

```js
/* ПЕРЕНОС ТЕЛА между траншами (ADR-0092 §2, КВ-26). t.transfers[] — единственное новое
   ХРАНИЛИЩЕ волны; всё остальное считается от него. Запись:
     { date, dir:'out'|'in', amount, counterTranche, basis:{ds,date}, parts:[…] }
   Две записи на одну операцию (у отдающего и у принимающего), а не одна общая: транш
   читается сам по себе — карточка, отчёт и ИР-3 не должны ходить по соседям, чтобы
   узнать свой остаток. */
function transfersOf(t, d){
  const lim = d ? pd(d) : null;
  return (t.transfers || []).filter(x => !lim || pd(x.date) <= lim);
}
function transferredOut(t, d){ return round2(transfersOf(t,d).filter(x=>x.dir==='out').reduce((a,x)=>a+(x.amount||0),0)); }
function transferredIn (t, d){ return round2(transfersOf(t,d).filter(x=>x.dir==='in' ).reduce((a,x)=>a+(x.amount||0),0)); }

/* Происхождение транша ВЫВОДИТСЯ (Р-11 / ADR-0001): есть входящий перенос ⇒ транш рождён
   разделением по ДС, иначе — освоением. Поля на транше нет намеренно: оно завело бы второй
   источник истины рядом с самим переносом и разъехалось бы с ним при первой правке. */
function trancheOrigin(t){ return (t.transfers||[]).some(x=>x.dir==='in') ? 'разделение' : 'освоение'; }
function originDs(t){ const x=(t.transfers||[]).find(y=>y.dir==='in'); return (x && x.basis && x.basis.ds) || null; }

/* Погашенное тело транша на дату — сворачивается из ЛЕДЖЕРА (r.principalPaid), своего
   хранилища у погашения нет и не заводится: платежи приходят зеркалом (ADR-0010), и
   вторая копия разошлась бы с ним молча. */
function repaidPrincipalOf(credit, t, d){
  const led = buildLedger(credit, d);
  return round2(led.filter(r => r.trancheNo === t.no).reduce((a,r) => a + (r.principalPaid || 0), 0));
}

/* ИР-3 (ADR-0092 §2): остаток тела транша = освоено − погашено − перенесено + принято.
   Именно ЧЕТЫРЕ слагаемых, а не «сумма минус погашенное»: после разделения по ДС сумма
   транша и его тело — разные величины. */
function trancheBalanceAt(credit, t, d){
  return round2(disbursedSum(t) - repaidPrincipalOf(credit, t, d)
                - transferredOut(t, d) + transferredIn(t, d));
}
```

Если сигнатура `buildLedger`/имя поля погашенного тела разошлись со снимком — читать
`buildLedger` (`:4069`) и `:4033-4035` и брать фактическое; формулу ИР-3 не менять.

- [ ] **Step 4: Развести распределение договора и Σ траншей**

В `credit.html:4587-4589` блок сейчас читается так:

```js
  const allocated   = c.tranches.reduce((a,t) => a + (t.amount || 0), 0);
  const allocatable = c.contractAmount - allocated;
```

Заменить на:

```js
  /* ADR-0115: распределение суммы договора меряется ПРОИСХОЖДЕНИЕМ, а не количеством
     траншей. Производный транш несёт перенесённую базу, а не новую выдачу, — сложив его
     в allocated, Г-3 рапортовал бы превышение суммы договора там, где выдача не менялась.
     Отвергнуто вычитать сумму переноса: арифметика сходится, но плитка перестаёт отвечать
     на свой вопрос «сколько договора ещё можно раздать». */
  const ownTranches = c.tranches.filter(t => trancheOrigin(t) === 'освоение');
  const derivedTr   = c.tranches.filter(t => trancheOrigin(t) === 'разделение');
  const allocated   = ownTranches.reduce((a,t) => a + (t.amount || 0), 0);
  const allocatable = c.contractAmount - allocated;
  const derivedCount = derivedTr.length;
  const derivedSum   = round2(derivedTr.reduce((a,t) => a + (t.amount || 0), 0));
```

`derivedCount` / `derivedSum` вернуть из `derive` рядом с `allocated` — их читает подпись
плитки в Task 7.

- [ ] **Step 5: Экспортировать в `window.CR`**

В `credit.html:5386` строка сейчас читается так:

```js
  creditConditionsAt, divergenceRows, basisGroups, retroFlags, retroPendingFlags, activeTranche,
```

Заменить на:

```js
  creditConditionsAt, divergenceRows, basisGroups, retroFlags, retroPendingFlags, activeTranche,
  trancheOrigin, originDs, transferredOut, transferredIn, repaidPrincipalOf, trancheBalanceAt,
```

- [ ] **Step 6: Прогнать смоук**

Run: `node scripts/inspect/credit-check.mjs`
Expected: `PASS #113`, `PASS #114`, итог `116/116 PASS`, код возврата 0. Ни один прежний
кейс не падает — на кредитах без переносов `ownTranches === c.tranches`.

- [ ] **Step 7: Коммит**

```bash
git add mockups/loan-credit/credit.html scripts/inspect/credit-check.mjs
git commit -m "feat(credit): перенос тела, происхождение транша и ИР-3 (КВ-26, ADR-0092/0115)"
```

---

### Task 2: Версия графика получает период действия и основание

**Files:**
- Modify: `mockups/loan-credit/credit.html:2255` (`seedSchedule`)
- Modify: `mockups/loan-credit/credit.html:2420` (сеяная версия К-3)
- Modify: `mockups/loan-credit/credit.html:2021` (`retroPendingFlags`)
- Modify: `mockups/loan-credit/credit.html:3476` (`trancheScheduleRows`)
- Modify: `mockups/loan-credit/credit.html:4917-4935` (`generateSchedule`)
- Modify: `mockups/loan-credit/credit.html:6827` (грид версий)
- Test: `scripts/inspect/credit-check.mjs` — переписать `ok(11,…)`, новый `ok(115,…)`

**Interfaces:**
- Consumes: `pd`, `TODAY`, `_crSeq`, `pushAudit`.
- Produces: `CR.scheduleAt(t, d) → version|null` · `CR.validTo(t, ver) → 'дд.мм.гггг'|null`.
  Заменяют собой всякое чтение `s.active`. Ими пользуются Task 3, 5, 8.

- [ ] **Step 1: Написать падающий тест и переписать №11**

Кейс `ok(11,…)` (`credit-check.mjs:148-151`) сейчас держит инвариант «ровно одна активная
версия». Флага больше нет — инвариант переезжает на `scheduleAt`:

```js
  const v1 = t.schedules.length;
  /* 11. ВЕРСИИ ГРАФИКА (переписан КВ-26). Флаг active снят: действующая версия ВЫВОДИТСЯ
     по срезу (последняя с validFrom ≤ дата), как conditionsAt/subjectAt (КВ-10). Инвариант
     тот же — на любую дату действующая ровно одна, — но теперь он держится по построению,
     а не поддержкой флага при каждой записи. */
  const at = CR2.scheduleAt(t, '23.07.2026');
  ok(11, v1>=1 && t.schedules.length===v1+1 && at && at.ver===t.schedules.length
         && t.schedules.every(s => s.active === undefined),
     `n=${t.schedules.length} действует v${at && at.ver}`);
```

И новый кейс после `ok(114,…)`:

```js
  /* 115. ПЕРИОД ДЕЙСТВИЯ И ОСНОВАНИЕ ВЕРСИИ (КВ-26, РС-5 п. 3). validFrom («с какой даты
     версия действует») и generatedFrom («от какой даты построена») — разные величины, и
     версия с будущим validFrom не должна становиться действующей раньше срока. */
  const tv = { no:1, amount:0, disbursements:[], schedules:[
    { ver:1, validFrom:'01.01.2026', by:{kind:'engine'}, generatedFrom:'01.01.2026', rows:[] },
    { ver:2, validFrom:'01.09.2026', by:{kind:'ДС', ref:'ДС-1'}, generatedFrom:'01.09.2026', rows:[] } ] };
  ok(115, CR2.scheduleAt(tv,'01.06.2026').ver===1 && CR2.scheduleAt(tv,'01.10.2026').ver===2
          && CR2.validTo(tv, tv.schedules[0])==='31.08.2026' && CR2.validTo(tv, tv.schedules[1])===null,
     `срез 01.06→v${CR2.scheduleAt(tv,'01.06.2026').ver} 01.10→v${CR2.scheduleAt(tv,'01.10.2026').ver}`);
```

- [ ] **Step 2: Прогнать смоук, убедиться, что кейсы падают**

Run: `node scripts/inspect/credit-check.mjs`
Expected: `FAIL #11` и `FAIL #115`, итог `115/117 PASS`, код возврата 1.

- [ ] **Step 3: Добавить `scheduleAt` / `validTo`**

В чистую логику, рядом с `trancheScheduleRows` (`:3474`), вставить (образец —
`mockups/restructuring/restructuring.html:930-938`):

```js
/* Действующая версия графика на дату (КВ-26). Флага active больше нет: он разъезжался
   с ДС, у которого дата вступления в будущем, — версия уже записана, но действовать ещё
   не должна. Идиома та же, что conditionsAt/subjectAt/derive: спрашиваем срез, а не флаг.
   validFrom — начало действия; generatedFrom («от какой даты строим») и generatedAt
   («когда построена», гасит плашку Д-5) остаются раздельными и путать их нельзя. */
function scheduleAt(t, d){
  const lim = pd(d || TODAY);
  const list = (t.schedules || []).filter(s => pd(s.validFrom || s.generatedFrom) <= lim)
    .sort((a,b) => pd(a.validFrom||a.generatedFrom) - pd(b.validFrom||b.generatedFrom) || (a.ver||0) - (b.ver||0));
  return list.length ? list[list.length-1] : null;
}
/* Конец действия версии — день до начала следующей; null = «по сей день». */
function validTo(t, ver){
  const key = s => pd(s.validFrom || s.generatedFrom);
  const nx = (t.schedules || []).filter(s => key(s) > key(ver))
    .sort((a,b) => key(a) - key(b))[0];
  if (!nx) return null;
  const d = new Date(key(nx)); d.setDate(d.getDate() - 1);
  return fd(d);
}
```

- [ ] **Step 4: Перевести четыре места чтения на `scheduleAt`**

| Якорь | Было | Стало |
|---|---|---|
| `:2021` (`retroPendingFlags`) | `((t && t.schedules) \|\| []).find(s => s.active)` | `t ? scheduleAt(t, TODAY) : null` |
| `:3476` (`trancheScheduleRows`) | `(t.schedules \|\| []).find(s => s.active)` | `scheduleAt(t, TODAY)` |
| `:4923-4924` (`generateSchedule`) | `prevActive` + `prevActive.active = false` | демоции нет: версии добавляются, действующая выводится (Р-4 соблюдён по построению). `prevActive` оставить только как аргумент `pushAudit` — им становится `scheduleAt(t, params.from)` |
| `:6827` (грид версий) | пилюли «активна»/«архив» по `s.active` | Task 8 |

- [ ] **Step 5: Дописать `validFrom` и `by` в `generateSchedule`**

В `credit.html:4926-4928` объект версии сейчас читается так:

```js
  const version = { ver, active:true, generatedFrom: params.from, generatedAt: TODAY,
                    generatedSeq: _crSeq, rows: built.rows };
```

Заменить на:

```js
  /* validFrom — с какой даты версия ДЕЙСТВУЕТ; by — чем она рождена. У версии, построенной
     движком, начало действия совпадает с датой построения графика: движок не умеет
     назначать будущее вступление, это умеет только ДС. */
  const version = { ver, validFrom: params.validFrom || params.from,
                    by: params.by || { kind:'engine', label:'Перестроение графика' },
                    generatedFrom: params.from, generatedAt: TODAY,
                    generatedSeq: _crSeq, rows: built.rows };
```

Сигнатура совместима: старые вызовы `generateSchedule(c, no, {from})` работают как прежде.

- [ ] **Step 6: Снять `active` из сеяных данных**

`:2255` — `return { ver:1, active:true, generatedFrom:fromDate, … }` →
`return { ver:1, validFrom:fromDate, by:{kind:'engine',label:'Первичный график'}, generatedFrom:fromDate, … }`.
`:2420` — сеяная версия К-3, та же правка. Прогнать
`grep -n "active:true\|s\.active\|\.active =" mockups/loan-credit/credit.html` и убедиться,
что остались только CSS-классы (`.nav-item.active`, `.tile.active`, …) и зеркало
`mirror.restructuring.active` — это чужое поле, его не трогаем.

- [ ] **Step 7: Экспортировать и прогнать смоук**

Дописать `scheduleAt, validTo,` в `window.CR` рядом с `generateSchedule`.

Run: `node scripts/inspect/credit-check.mjs`
Expected: `PASS #11`, `PASS #115`, итог `117/117 PASS`.

Run: `npm run test:credit`
Expected: 38 тестов проходят.

- [ ] **Step 8: Коммит**

```bash
git add mockups/loan-credit/credit.html scripts/inspect/credit-check.mjs
git commit -m "feat(credit): версия графика несёт период действия и основание, флаг active снят (КВ-26)"
```

---

### Task 3: Строка графика несёт статьи

**Files:**
- Modify: `mockups/loan-credit/credit.html` — чистая логика рядом с `buildSchedule`
- Modify: `mockups/loan-credit/credit.html:3468` (`rows.push` в `buildSchedule`)
- Modify: `mockups/loan-credit/credit.html:4511` (`trancheScheduleTotals`) и `scheduleTotalsAll`
- Test: `scripts/inspect/credit-check.mjs` — новые кейсы `ok(116,…)`, `ok(117,…)`

**Interfaces:**
- Consumes: строки графика `{no,date,total,principal,interest,accrued}` (`:3468`).
- Produces: `CR.rowArticlesSum(r)` · `CR.scheduleArticleCols(rows)` ·
  `CR.spreadArticles(rows, parts)`. Ими пользуются Task 5 (Г-25) и Task 8 (колонки).

- [ ] **Step 1: Написать падающие тесты**

```js
  /* 116. СТАТЬИ СТРОКИ ГРАФИКА (КВ-26, ADR-0109). Только БЕЗСТАВОЧНЫЕ: основной долг
     (тело + капитализированные проценты) остаётся в r.principal — по ADR-0109 это
     единственная ставочная колонка, и она уже авторитетна для леджера и прогноза.
     Пустая колонка не рисуется — состав считается по строкам, а не по справочнику. */
  const rowsA = [ { no:1, date:'01.03.2026', principal:1000, interest:50, total:1050 },
                  { no:2, date:'01.04.2026', principal:1000, interest:40, total:1290,
                    articles:{ accPenalty:200 } } ];
  const cols = CR2.scheduleArticleCols(rowsA);
  ok(116, CR2.rowArticlesSum(rowsA[0])===0 && Math.abs(CR2.rowArticlesSum(rowsA[1])-200)<0.005
          && cols.length===1 && cols[0].key==='accPenalty'
          && CR2.scheduleArticleCols([rowsA[0]]).length===0,
     `колонок ${cols.length} (${cols.map(x=>x.key).join(',')})`);

  /* 117. РАСКЛАДКА БЕЗСТАВОЧНЫХ (ИР-2′). Части раскладываются равными долями по позициям
     своего интервала, остаток от округления падает в ПОСЛЕДНЮЮ позицию интервала: иначе
     Σ колонок разъезжается с суммой переноса на копейки, и плашка ИР-2′ врёт. */
  const rowsB = [1,2,3].map(k => ({ no:k, date:`0${k}.03.2026`, principal:1000, interest:0, total:1000 }));
  CR2.spreadArticles(rowsB, [{ key:'accInterest', amount:100.00, from:1, to:3 }]);
  const sB = rowsB.reduce((a,r) => a + CR2.rowArticlesSum(r), 0);
  ok(117, Math.abs(sB - 100) < 0.005 && rowsB.every(r => r.articles && r.articles.accInterest > 0),
     `Σ=${sB} по строкам ${rowsB.map(r=>r.articles.accInterest).join('/')}`);
```

- [ ] **Step 2: Прогнать смоук, убедиться, что кейсы падают**

Run: `node scripts/inspect/credit-check.mjs` → `117/119 PASS`, код возврата 1.

- [ ] **Step 3: Добавить логику статей**

Рядом с `buildSchedule`, до неё, вставить (образец — `restructuring.html:853-877`, `:985-992`):

```js
/* СТАТЬИ СТРОКИ ГРАФИКА (ADR-0109, КВ-26). Реструктуризация раскладывает по графику не
   только тело: накопленные проценты, накопленную пеню и распределённое. Ставка при этом
   начисляется ТОЛЬКО по основному долгу — поэтому статьи держатся отдельным вложенным
   объектом, а не подмешиваются в r.principal.
   Порядок реестра = очередь погашения: что гасится раньше, стоит левее. */
const SCHED_ARTICLES = [
  { key:'accInterest', label:'Накопл. проценты' },
  { key:'accPenalty',  label:'Накопл. пеня' },
  { key:'other',       label:'Прочие' }
];
function rowArticlesSum(r){
  const a = r && r.articles; if (!a) return 0;
  return round2(SCHED_ARTICLES.reduce((s,x) => s + (a[x.key] || 0), 0));
}
/* Состав НЕПУСТЫХ статейных колонок. Пустая не рисуется — та же идиома, что «Курс / ≈KGS»
   у валютных: обычный кредит обязан выглядеть ровно как до волны. */
function scheduleArticleCols(rows){
  return SCHED_ARTICLES.filter(x => (rows||[]).some(r => r.articles && (r.articles[x.key]||0) > 0.005));
}
/* Раскладка безставочной части по позициям интервала [from..to] равными долями; остаток
   от округления — в последнюю позицию интервала, иначе Σ колонок разъедется с суммой
   переноса и плашка ИР-2′ соврёт (ИР-2′ мерится в копейку, порог 0,005). */
function spreadArticles(rows, parts){
  (parts || []).forEach(p => {
    const seg = (rows||[]).filter(r => r.no >= (p.from||1) && r.no <= (p.to || rows.length));
    if (!seg.length) return;
    const per = round2((p.amount || 0) / seg.length);
    let acc = 0;
    seg.forEach((r,i) => {
      const v = i === seg.length-1 ? round2((p.amount||0) - acc) : per;
      acc = round2(acc + v);
      r.articles = r.articles || {};
      r.articles[p.key] = round2((r.articles[p.key] || 0) + v);
      r.total = round2((r.total || 0) + v);      // «Платёж» = то, что человек платит в эту дату
    });
  });
  return rows;
}
```

- [ ] **Step 4: Учесть статьи в итогах**

`trancheScheduleTotals` (`:4511`) и `scheduleTotalsAll` считают `principal`/`interest`/`total`.
Добавить `articles` — суммой по ключам, чтобы итог-строка и годовые строки (КВ-19) сходились
с колонками. `r.total` уже включает статейные (`spreadArticles`), поэтому «Платёж» править
не нужно — проверить это явно, а не предположить.

- [ ] **Step 5: Экспортировать и прогнать смоук**

Дописать `SCHED_ARTICLES, rowArticlesSum, scheduleArticleCols, spreadArticles,` в `window.CR`.

Run: `node scripts/inspect/credit-check.mjs` → `119/119 PASS`.

- [ ] **Step 6: Коммит**

```bash
git add mockups/loan-credit/credit.html scripts/inspect/credit-check.mjs
git commit -m "feat(credit): строка графика несёт безставочные статьи (КВ-26, ADR-0109)"
```

---

### Task 4: Гейты — Г-8 вторая ветка, Г-4 запрет освоения производного

**Files:**
- Modify: `mockups/loan-credit/credit.html:4679-4684` (`case 'addDisbursement'`, Г-4)
- Modify: `mockups/loan-credit/credit.html:4781-4782` (`case 'buildSchedule'`, Г-8)
- Modify: `mockups/loan-credit/credit.html` — `buildSchedule`: точка отсчёта
- Test: `scripts/inspect/credit-check.mjs` — новые кейсы `ok(118,…)`, `ok(119,…)`

**Interfaces:**
- Consumes: `trancheOrigin(t)`, `originDs(t)` из Task 1.
- Produces: ничего нового в `CR` — правятся существующие ветки `gate()` и `buildSchedule`.

- [ ] **Step 1: Написать падающие тесты**

```js
  /* 118. Г-8 ЗНАЕТ ДВЕ ВЕТКИ (КВ-26, ADR-0092 §1). Транш происхождением «освоение» строит
     график от фактической даты освоения (как было); производный — от даты вступления ДС,
     потому что освоения у него нет и не будет. Прежняя формулировка отказывала второму
     навсегда. */
  const tDer = { no:2, amount:50000, disbursements:[],
                 transfers:[{ date:'01.05.2026', dir:'in', amount:50000, counterTranche:1,
                              basis:{ ds:'ДС-РС-2001', date:'01.05.2026' } }] };
  const tEmpty = { no:3, amount:50000, disbursements:[], transfers:[] };
  const gDer = CR2.gate(kOrd, 'buildSchedule', { tranche: tDer });
  const gEmp = CR2.gate(kOrd, 'buildSchedule', { tranche: tEmpty });
  ok(118, gDer.ok === true && gEmp.ok === false
          && /освоен/i.test(gEmp.reasons.join(' ')),
     `производный ${gDer.ok} пустой ${gEmp.ok}`);

  /* 119. Г-4 ОТКАЗЫВАЕТ ПРОИЗВОДНОМУ (ADR-0092 «Последствия»). Сумма пришла переносом,
     а не выдачей: освоить её ещё раз значило бы выдать деньги дважды. Причина обязана
     называть ДС — иначе куратор увидит немой отказ (§0.3). */
  const kD = CR2.db.credits.find(c => c.id === 'K-1');
  const saved = kD.tranches.slice();
  kD.tranches = saved.concat([tDer]);
  const g4 = CR2.gate(kD, 'addDisbursement', { trancheNo:2, amount:1000 });
  kD.tranches = saved;
  ok(119, g4.ok === false && /ДС-РС-2001/.test(g4.reasons.join(' ')),
     g4.reasons.join(' | ').slice(0,90));
```

- [ ] **Step 2: Прогнать смоук, убедиться, что кейсы падают**

Run: `node scripts/inspect/credit-check.mjs` → `119/121 PASS`, код возврата 1.

- [ ] **Step 3: Разветвить Г-8**

В `credit.html:4781-4782` блок сейчас читается так:

```js
    case 'buildSchedule':
      if (!ctx.tranche || ctx.tranche.disbursements.length===0) r.push('График строится только от фактической даты освоения транша'); // Г-8
      break;
```

Заменить на:

```js
    /* Г-8 — две ветки (ADR-0092 §1): производному траншу §1 прямо даёт «дату начала,
       равную дате вступления ДС, и свой график». Освоения у него нет и не будет, поэтому
       прежняя единственная формулировка отказывала ему навсегда. Тексты отказов разные:
       у обычного транша чинится освоением, у производного — только основанием ДС. */
    case 'buildSchedule': {
      if (!ctx.tranche) { r.push('Транш не выбран'); break; }
      if (trancheOrigin(ctx.tranche) === 'разделение') {
        if (!originDs(ctx.tranche)) r.push('У производного транша нет основания ДС — график строить не от чего');
      } else if ((ctx.tranche.disbursements||[]).length === 0) {
        r.push('График строится только от фактической даты освоения транша'); // Г-8
      }
      break;
    }
```

- [ ] **Step 4: Дать `buildSchedule` вторую точку отсчёта**

`buildSchedule(t, from)` вызывается с датой снаружи (`trancheScheduleRows:3479`,
`generateSchedule:4921`). Ветка нужна там, где дата **выбирается**: в
`trancheScheduleRows` вместо первого освоения у производного транша брать дату входящего
переноса. Правка точечная:

```js
  const disb = (t.disbursements || []).slice().sort((a,b) => pd(a.date) - pd(b.date))[0];
  /* У производного транша освоений нет — точка отсчёта берётся от даты вступления ДС
     (ADR-0092 §1), иначе вкладка «Расчёты» показывала бы ему пустой график. */
  const inTr = (t.transfers || []).find(x => x.dir === 'in');
  const from = disb ? disb.date : (inTr ? inTr.date : null);
  return from ? buildSchedule(t, from).rows : [];
```

Кроме того, `buildSchedule` при перестроении производного транша обязан **заново разложить**
безставочные статьи из его базы (`spreadArticles` по `t.articleBase`, который пишет дверь в
Task 5) — иначе статьи исчезнут по нажатию кнопки «Сформировать график».

- [ ] **Step 5: Запретить освоение производного (Г-4)**

В `credit.html:4684` после строки Г-4 добавить:

```js
      /* Производный транш не осваивается (ADR-0092 «Последствия»): его сумма ПРИШЛА
         переносом по ДС, а не выдачей. Разрешить освоение значило бы выдать одни и те же
         деньги дважды. Причина называет ДС — немого отказа быть не должно (§0.3). */
      if (t && trancheOrigin(t) === 'разделение')
        r.push('Производный транш не осваивается: сумма пришла переносом по ' + (originDs(t) || 'ДС'));
```

- [ ] **Step 6: Прогнать смоук**

Run: `node scripts/inspect/credit-check.mjs` → `121/121 PASS`.

- [ ] **Step 7: Коммит**

```bash
git add mockups/loan-credit/credit.html scripts/inspect/credit-check.mjs
git commit -m "feat(credit): Г-8 знает вторую ветку, Г-4 не пускает освоение производного (КВ-26)"
```

---

### Task 5: Дверь `restructureApplied` и гейт Г-25

**Files:**
- Modify: `mockups/loan-credit/credit.html` — секция мутаций, после `generateSchedule`
- Modify: `mockups/loan-credit/credit.html:4719-4729` (`case 'closeTranche'`)
- Modify: `mockups/loan-credit/credit.html:4917` (`generateSchedule` — Р11)
- Test: `scripts/inspect/credit-check.mjs` — новые кейсы `ok(120,…)`…`ok(124,…)`

**Interfaces:**
- Consumes: всё из Task 1–4; `mkTranche` (`:2114`), `mkConditionRecord`, `pushAudit`, `gate`.
- Produces: `CR.restructureApplied(credit, ds) → {ok, reasons?}` · `CR.validateDsRows(credit, ds)`
  (Г-25) · `CR.closeIfEmptied(credit, t, ds)`. Дверь зовёт Task 9 (кнопка).

- [ ] **Step 1: Написать падающие тесты**

Пять кейсов: Г-25 показывает **все** причины разом · дверь атомарна (при отказе кредит не
изменился) · после применения появился производный транш и пара переносов · опустошённый
источник закрыт с причиной «перенос» и её нельзя ввести руками · счётчик вырос на **ДС**,
а не на транш. Плюс grep-кейс границы:

```js
  /* 124. ГРАНИЦА ДВЕРИ (ADR-0096). t.transfers.push вне restructureApplied означает второй
     вход в модель переноса — ровно то, от чего одна дверь и защищает. Тот же приём, что
     в смоуке реструктуризации: проверяем ИСХОДНИК, а не поведение. */
  const srcTxt = readFileSync(HTML, 'utf8');
  const pushes = (srcTxt.match(/\.transfers\.push\(/g) || []).length;
  const inDoor = srcTxt.slice(srcTxt.indexOf('function restructureApplied'),
                             srcTxt.indexOf('function restructureApplied') + 4000);
  ok(124, pushes === (inDoor.match(/\.transfers\.push\(/g) || []).length,
     `всего ${pushes}, внутри двери ${(inDoor.match(/\.transfers\.push\(/g)||[]).length}`);
```

- [ ] **Step 2: Прогнать смоук, убедиться, что кейсы падают**

Run: `node scripts/inspect/credit-check.mjs` → `121/126 PASS`, код возврата 1.

- [ ] **Step 3: Добавить Г-25 — приём строк из приложения к ДС**

В `gate()` новый case, рядом с `buildSchedule`:

```js
    /* Г-25 — приём строк графика из приложения к ДС (ADR-0096 §3, КВ-26). Кредит владеет
       ПЕРЕСТРОЕНИЕМ, но первичную ДС-версию не строит сам: у реструктуризации месяц = 30
       дней, у кредита — реальный календарь с payDay/freq, и сверять две арифметики строка
       в строку бессмысленно. Поэтому строки ПРИХОДЯТ, а кредит проверяет форму контракта.
       Все причины показываются вместе, как Г-6/Г-7: чинить их по одной — четыре круга. */
    case 'applyDs': {
      const ds = ctx.ds || {};
      const src = credit.tranches.find(t => t.no === ds.sourceTranche);
      if (!src) r.push('Исходный транш ДС не найден в кредите');
      if (!ds.effectiveFrom) r.push('У ДС нет даты вступления');
      const rows = ds.rows || [];
      if (!rows.length) r.push('В приложении к ДС нет строк графика');
      const moved = round2((ds.parts || []).reduce((a,p) => a + (p.amount||0), 0));
      const sum = round2(rows.reduce((a,x) => a + (x.principal||0) + rowArticlesSum(x), 0));
      if (rows.length && Math.abs(sum - moved) > 0.005)
        r.push('ИР-2′: Σ колонок графика ' + money(sum) + ' ≠ сумме переноса ' + money(moved));
      for (let i = 1; i < rows.length; i++)
        if (pd(rows[i].date) <= pd(rows[i-1].date)) { r.push('Даты позиций графика не строго возрастают (позиция №' + rows[i].no + ')'); break; }
      if (ds.termEnd && rows.length && pd(rows[rows.length-1].date) > pd(ds.termEnd))
        r.push('Последняя позиция выходит за конец срока по ДС (' + ds.termEnd + ')');
      (ds.parts || []).forEach(p => {                                        // ИР-15
        if ((p.from||1) < 1 || (p.to || rows.length) > rows.length)
          r.push('Интервал распоряжения «' + p.key + '» выходит за длину графика');
      });
      break;
    }
```

- [ ] **Step 4: Добавить дверь**

В секцию мутаций, после `generateSchedule`:

```js
/* ЕДИНСТВЕННАЯ ПИШУЩАЯ ДВЕРЬ реструктуризации в кредит (ADR-0096). Шесть шагов
   НЕПЕРЕСТАНОВИМЫ, и полуприменённого ДС не бывает: вся валидация — до первой записи.
   Кредит ПРИМЕНЯЕТ пришедшее зеркалом ДС, а не заводит его (Р-16). */
function restructureApplied(credit, ds){
  const g = gate(credit, 'applyDs', { ds });                                 // Г-25
  if (!g.ok) return g;
  const src = credit.tranches.find(t => t.no === ds.sourceTranche);
  const moved = round2((ds.parts || []).reduce((a,p) => a + (p.amount||0), 0));
  // 1. производный транш — сумма равна перенесённой (И-3 к нему неприменим)
  const no = credit.tranches.reduce((m,t) => Math.max(m, t.no), 0) + 1;
  const der = mkTranche({ id: credit.id + '-T' + no, no, subject: src.subject,
                          amount: moved, plannedDate: ds.effectiveFrom,
                          disbursements: [], transfers: [] });
  credit.tranches.push(der);
  // 2. ПАРА переносов — датированная двусторонняя операция с основанием (ADR-0092 §2)
  const basis = { ds: ds.num, date: ds.date };
  src.transfers = src.transfers || [];
  src.transfers.push({ date: ds.effectiveFrom, dir:'out', amount: moved, counterTranche: no, basis, parts: ds.parts || [] });
  der.transfers.push({ date: ds.effectiveFrom, dir:'in',  amount: moved, counterTranche: src.no, basis, parts: ds.parts || [] });
  der.articleBase = (ds.parts || []).filter(p => p.key !== 'principal');     // чтобы перестроение не потеряло статьи
  // 3. версия графика — строки ПРИШЛИ, движок их не пересчитывает
  der.schedules = [{ ver:1, validFrom: ds.effectiveFrom,
                     by:{ kind:'ДС', ref: ds.num, label:'Реструктуризация ' + ds.num },
                     generatedFrom: ds.effectiveFrom, generatedAt: TODAY, generatedSeq: _crSeq,
                     rows: (ds.rows || []).map(r => ({ ...r })) }];
  // 4. записи условий производного транша
  (ds.conditions || []).forEach(x => {
    der.conditionRecords = der.conditionRecords || [];
    der.conditionRecords.push(mkConditionRecord({ ...x, effectiveFrom: ds.effectiveFrom,
      basis:{ kind:'ДС', ref: ds.num, date: ds.date } }));
  });
  // 5. опустошённый источник закрывается ПЕРЕНОСОМ, не погашением (ИР-5)
  closeIfEmptied(credit, src, ds);
  // 6. счётчик считает ДС, а не траншы (ADR-0092 «Последствия»)
  credit.restructuring = credit.restructuring || { count:0 };
  credit.restructuring.count = (credit.restructuring.count || 0) + 1;
  pushAudit(credit, 'Применено ' + ds.num + ' от ' + ds.date + ': перенос ' + money(moved)
    + ' с транша №' + src.no + ' на новый транш №' + no, null, der);
  return { ok:true, tranche: der };
}
/* ИР-5: причина закрытия ВЫВОДИТСЯ обнулившей операцией — ручной closeTranche ввести
   «перенос» не может, это причина двери, а не человека. */
function closeIfEmptied(credit, t, ds){
  if (t.closed) return false;
  if (trancheBalanceAt(credit, t, ds.effectiveFrom) > 0.005) return false;
  t.closed = { date: ds.effectiveFrom, reason:'перенос', by:{ kind:'ДС', ref: ds.num } };
  return true;
}
```

- [ ] **Step 5: Закрыть ручному `closeTranche` причину «перенос»**

В `case 'closeTranche'` (`:4719`) добавить проверку: `ctx.reason`, совпавшая с «перенос»
без основания ДС, отклоняется — причина принадлежит двери. Текст отказа:
«Причина «перенос» выставляется применением ДС, а не вручную (ИР-5)».

- [ ] **Step 6: Р11 — перестроение ДС-версии требует основания**

В `generateSchedule` (`:4917`) перед построением: если действующая версия
`scheduleAt(t, params.from)` имеет `by.kind === 'ДС'`, требуется основание — ретро-запись
условия (суд / ПП) либо заявление на досрочку, передаётся `params.basis`. Без него —
отказ с причиной. Новая версия **наследует** основание и получает `by.kind='engine'`.
Граница узкая: у версий `by.kind==='engine'` поведение прежнее, сигнатура совместима.

- [ ] **Step 7: Экспортировать и прогнать смоук**

Дописать `restructureApplied, closeIfEmptied,` в `window.CR`.

Run: `node scripts/inspect/credit-check.mjs` → `126/126 PASS`.
Run: `node scripts/inspect/restructuring-check.mjs` → `57/57 PASS` (регресса быть не должно).

- [ ] **Step 8: Коммит**

```bash
git add mockups/loan-credit/credit.html scripts/inspect/credit-check.mjs
git commit -m "feat(credit): дверь restructureApplied, гейт Г-25 и закрытие переносом (КВ-26, ADR-0096)"
```

---

### Task 6: Демо-кредит К-7 и зеркало ДС

**Files:**
- Modify: `mockups/loan-credit/credit.html` — `seedDb`, рядом с К-6 (id `K-7` свободен)
- Test: `scripts/inspect/credit-check.mjs` — новый кейс `ok(125,…)`

**Interfaces:**
- Consumes: `mkTranche`, `mkCredit`, форма `c.mirror.restructuring`.
- Produces: кредит `K-7` с одним освоенным траншем и двумя ДС в зеркале. Его читают
  Task 7–9 и ручная проверка.

**К-4 не трогаем** — он уже несёт три демо разом: ДС-РС-1004 записями условий (случай
«весь остаток на новые условия, разделения нет», ADR-0092 §4), ДС-РС-1005 в хвосте журнала
(смоук №13, `:5245`) и активную заявку «Направлено в Минфин» с послаблением `suppress181`.

- [ ] **Step 1: Написать падающий тест**

```js
  /* 125. ДЕМО РАЗДЕЛЕНИЯ ПО ДС (КВ-26). К-7 несёт то, чего не несёт ни один другой кредит:
     два применённых ДС, три транша, закрытый переносом источник. Счётчик считает ДС (2),
     а траншей три — числа обязаны расходиться, и кейс держит это расхождение. */
  const k7 = CR2.db.credits.find(c => c.id === 'K-7');
  const der7 = k7.tranches.filter(t => CR2.trancheOrigin(t) === 'разделение');
  const d7 = CR2.derive(k7, '23.07.2026');
  ok(125, k7 && k7.tranches.length === 3 && der7.length === 2
          && k7.restructuring.count === 2 && d7.allocatable >= -0.005
          && k7.tranches[0].closed && k7.tranches[0].closed.reason === 'перенос',
     `траншей ${k7 && k7.tranches.length} производных ${der7.length} ДС ${k7 && k7.restructuring.count}`
     + ` доступно ${d7 && d7.allocatable}`);
```

- [ ] **Step 2: Прогнать смоук, убедиться, что кейс падает**

Run: `node scripts/inspect/credit-check.mjs` → `126/127 PASS`, код возврата 1.

- [ ] **Step 3: Засеять К-7**

Кредит «Действует», один транш полностью освоен. В зеркале —
`c.mirror.restructuring.ds[]` из двух записей, **обе применены** сидом через
`restructureApplied` (а не выписаны руками): иначе демо разойдётся с дверью при первой же
её правке. Первое ДС — **частичный** перенос (источник живёт, рождается Т 2), второе —
остаток источника **целиком** (Т 3, Т 1 закрыт переносом). Разбивка `parts` включает
капитализированные проценты (в тело), капитализированную пеню (в `accPenalty`) и
распределённое (`other`) — иначе новые колонки некому показать.

Форма записи зеркала:

```js
/* Приложение к ДС живёт в ЗЕРКАЛЕ (ADR-0096 §3): c.agreements остаётся регистрационной
   строкой {num,date,source,scan}, а полезная нагрузка — строки, разбивка и новые условия —
   приходит из реструктуризации и кредитом не правится. Замок и подпись источника на месте. */
mirror:{ restructuring:{ count:2, ds:[
  { num:'ДС-РС-2001', date:'…', effectiveFrom:'…', sourceTranche:1, termEnd:'…',
    parts:[{key:'principal',…},{key:'accPenalty',…},{key:'other',…}],
    rows:[…], conditions:[…], applied:true },
  { num:'ДС-РС-2002', … } ] } }
```

- [ ] **Step 4: Прогнать смоук**

Run: `node scripts/inspect/credit-check.mjs` → `127/127 PASS`.

- [ ] **Step 5: Коммит**

```bash
git add mockups/loan-credit/credit.html scripts/inspect/credit-check.mjs
git commit -m "feat(credit): демо-кредит К-7 — два ДС, три транша, закрытие переносом (КВ-26)"
```

---

### Task 7: Рендер «Траншей»

**Files:**
- Modify: `mockups/loan-credit/credit.html:6732-6804` (`tabTranshi`)
- Modify: `mockups/loan-credit/credit.html:6034` (`trancheState`)
- Test: `scripts/inspect/credit-check.mjs` — новый кейс `ok(126,…)`

**Interfaces:**
- Consumes: `trancheOrigin`, `originDs`, `trancheBalanceAt`, `d.derivedCount`, `d.derivedSum`.
- Produces: ничего для логики — только разметка.

- [ ] **Step 1: Написать падающий тест**

Кейс `#126` проверяет три вещи разом: у К-1 разметка «Траншей» **не изменилась** по составу
колонок (регресс — производных нет, значит ни колонки «Происхождение», ни секции «Движение
по траншу» быть не должно); у К-7 обе есть; «Освоено» у производного — прочерк, не `0`.

- [ ] **Step 2: Прогнать смоук, убедиться, что кейс падает**

Run: `node scripts/inspect/credit-check.mjs` → `127/128 PASS`, код возврата 1.

- [ ] **Step 3: Плитки распределения**

Под плиткой «Распределено по траншам» — подпись, когда `d.derivedCount > 0`:
«+ N производных на X (перенос по ДС, в распределение не входят)». Молчаливое
несовпадение двух чисел на экране хуже, чем явное.

- [ ] **Step 4: Колонка «Происхождение»**

Пилюля «освоение» / «разделение по ДС»; у производного — номер ДС и ссылка на родителя
(`counterTranche` входящего переноса). Колонка рисуется **всегда**, как «Состояние»: она
отвечает на вопрос, который у обычного кредита имеет один и тот же ответ, и её отсутствие
читалось бы как «у всех траншей происхождение одинаковое по определению».

- [ ] **Step 5: «Остаток тела» вместо «Остатка», «Освоено» с прочерком**

`rest = (t.amount||0) - s` → `trancheBalanceAt(c, t, cardAsOf)`; заголовок колонки —
«Остаток тела» с `title` про ИР-3. У производного «Освоено» — `—`, не `0`: ноль читается
как «деньги не выдавали», а они выданы на родителе. Итог-строка «Итого освоено» суммирует
только траншы происхождением «освоение».

- [ ] **Step 6: Секция «Движение по траншу»**

Слитый вид трёх источников по дате (освоения · погашения · переносы), колонка вида
движения, замок и подпись источника на зеркальных строках — та же идиома, что КВ-17.
Рисуется, **только когда переносы есть**: у обычного кредита вкладка обязана выглядеть
ровно как до волны.

- [ ] **Step 7: `trancheState` для производного**

`:6034` — состояние производного не «Не освоен» (освоений у него нет по определению).
Показывать «Из переноса по ДС-…» либо состояние по остатку тела.

- [ ] **Step 8: Прогнать смоук и JSDOM**

Run: `node scripts/inspect/credit-check.mjs` → `128/128 PASS`.
Run: `npm run test:credit` → 38 тестов.

- [ ] **Step 9: Коммит**

```bash
git add mockups/loan-credit/credit.html scripts/inspect/credit-check.mjs
git commit -m "feat(credit): «Транши» показывают происхождение, остаток тела и движение (КВ-26)"
```

---

### Task 8: Рендер «Графика»

**Files:**
- Modify: `mockups/loan-credit/credit.html:6813-6913` (`tabGrafik`), в т. ч. `:6827` (грид
  версий) и `:6846-6880` (годовые строки, КВ-19)
- Test: `scripts/inspect/credit-check.mjs` — новые кейсы `ok(127,…)`, `ok(128,…)`

**Interfaces:**
- Consumes: `scheduleAt`, `validTo`, `scheduleArticleCols`, `rowArticlesSum`.
- Produces: только разметка.

- [ ] **Step 1: Написать падающие тесты**

`#127` — грид версий несёт основание, «Действует с» и «По», пилюли «активна»/«архив»
исчезли, вместо них «действует» / «будущая» / «архив» по срезу. `#128` — статейные колонки:
у К-1 их нет вовсе, у К-7 на производном транше есть, годовые строки (КВ-19) суммируют и
их, плашка ИР-2′ сходится в копейку.

- [ ] **Step 2: Прогнать смоук, убедиться, что кейсы падают**

Run: `node scripts/inspect/credit-check.mjs` → `128/130 PASS`, код возврата 1.

- [ ] **Step 3: Переписать грид версий**

`:6827` — колонки `Версия · [Транш] · Основание · Действует с · По · Построена · Строк`.
Статус — от `scheduleAt(t, cardAsOf)`: `действует` / `будущая` (validFrom > срез) / `архив`.
Основание — `by.label` со ссылкой на ДС, когда `by.kind==='ДС'`.

- [ ] **Step 4: Статейные колонки позиций**

После «Осн. сумма» — колонки из `scheduleArticleCols(rows)`. Пустая не рисуется. На
заголовке «Осн. сумма» — `title` «ставка начисляется только по этой колонке (ADR-0109)».

- [ ] **Step 5: Годовые строки и плашка ИР-2′**

`byYear` (`:6846-6880`) суммирует статейные вместе с телом и процентами. Под таблицей, для
версий с `by.kind==='ДС'` — плашка «ИР-2′: Σ колонок X = сумме переноса Y» с расхождением,
когда оно есть (порог 0,005).

- [ ] **Step 6: Пометка ДС в слитом виде**

В области «по кредиту» строки производного транша помечаются своим ДС — иначе слитая
таблица мешает позиции исходного и производного без указания, каким документом они правятся.

- [ ] **Step 7: Прогнать смоук и JSDOM**

Run: `node scripts/inspect/credit-check.mjs` → `130/130 PASS`.
Run: `npm run test:credit` → 38 тестов (переключатель области не должен сломаться о новые
колонки).

- [ ] **Step 8: Коммит**

```bash
git add mockups/loan-credit/credit.html scripts/inspect/credit-check.mjs
git commit -m "feat(credit): «График» — статьи, период действия версии и основание (КВ-26)"
```

---

### Task 9: Кнопка «Применить ДС» в хвосте «Условий»

**Files:**
- Modify: `mockups/loan-credit/credit.html:6665-6675` (хвост «Документы без изменения условий»)
- Modify: `mockups/loan-credit/credit.html` — DOM-блок: `CR.openApplyDsModal(num)`
- Test: `scripts/inspect/credit-check.mjs` — новый кейс `ok(129,…)`

**Interfaces:**
- Consumes: `CR.restructureApplied`, `c.mirror.restructuring.ds[]`, `gate(c,'applyDs',…)`.
- Produces: `CR.openApplyDsModal(num)` — предпросмотр приложения и вызов двери.

- [ ] **Step 1: Написать падающий тест**

`#129` — у К-7 **до** применения ДС висит в хвосте с кнопкой; у К-4 хвост прежний (ДС-РС-1005
без строк — кнопки быть не должно, применять нечего); у К-1 хвоста нет вовсе.

- [ ] **Step 2: Прогнать смоук, убедиться, что кейс падает**

Run: `node scripts/inspect/credit-check.mjs` → `130/131 PASS`, код возврата 1.

- [ ] **Step 3: Кнопка в хвосте**

В `:6669` строку хвоста дополнить пятой ячейкой — кнопкой «Применить ДС», **только** у ДС
с `source='реструктуризация'` и непустым приложением в зеркале. Гейт `applyDs`; отказ —
погашенная кнопка с причиной (§0.3). Комментарий обязателен:

```js
/* Кнопка «Применить ДС» (КВ-26, ADR-0096). Стоит именно здесь: непринятое зеркальное ДС
   висит в этом хвосте сегодня, и применение выносит его в основной журнал — шаг виден
   глазом. Р-16 цел: кредит реструктуризацию не ЗАВОДИТ, он ПРИМЕНЯЕТ пришедшее зеркалом
   ДС, и это его собственное действие. Отвергнута кнопка в шапке «Траншей» — она читается
   как «завести реструктуризацию из кредита», в лоб против Р-16. */
```

- [ ] **Step 4: Модалка предпросмотра**

`CR.openApplyDsModal(num)` показывает: исходный транш, сумму переноса, разбивку `parts`,
первые позиции графика и новые условия. Кнопка подтверждения зовёт `CR.restructureApplied`;
причины Г-25 показываются **все разом**, как Г-6/Г-7.

- [ ] **Step 5: Прогнать смоук**

Run: `node scripts/inspect/credit-check.mjs` → `131/131 PASS`.

- [ ] **Step 6: Проверить в браузере**

Открыть `mockups/loan-credit/credit.html`:
- **K-1** — «Транши» и «График» выглядят **ровно как прежде**: статейных колонок нет, секции
  «Движение по траншу» нет, кнопка графика по-старому. Главный признак того, что пустая
  колонка не рисуется;
- **K-4** — не изменился: ДС-РС-1004 записями условий, ДС-РС-1005 в хвосте, послабление на месте;
- **K-7 · «Условия»** — ДС в хвосте с кнопкой; после применения уходят в основной журнал;
- **K-7 · «Транши»** — производные с происхождением и ссылкой на ДС; «Освоено» прочерк;
  «Остаток тела» сходится по ИР-3; «Внести освоение» гаснет с причиной; исходный закрыт с
  причиной «перенос»; счётчик — 2 ДС при 3 траншах; «Доступно к распределению» **не в минусе**;
- **K-7 · «График»** — версия несёт основание, период действия и дату построения; статейные
  колонки на месте; плашка ИР-2′ сходится в копейку; «Сформировать» гаснет с причиной «нет
  основания» и оживает, когда основание появилось;
- **область «по кредиту»** — слитая таблица разводит траншы колонкой, строки производного
  помечены своим ДС, группировка по годам (КВ-19) считает и статейные суммы;
- консоль браузера без ошибок.

- [ ] **Step 7: Коммит**

```bash
git add mockups/loan-credit/credit.html scripts/inspect/credit-check.mjs
git commit -m "feat(credit): кнопка «Применить ДС» в хвосте «Условий» (КВ-26, Р-16)"
```

---

### Task 10: Документы

**Files:**
- Modify: `mockups/loan-credit/ASUBK-kredit-logika.md`
- Modify: `docs/superpowers/specs/2026-07-26-kredit-gates.md`
- Modify: `requirements/tz/05-kredit.html`
- Modify: `TODO.md`
- Modify: `CONTEXT.md`

**Interfaces:**
- Consumes: результат Task 1–9.
- Produces: документный слой волны.

- [ ] **Step 1: Спека логики**

`ASUBK-kredit-logika.md`: §2 — транш рождается двумя способами; §5 — раздел о переносе и о
том, что ДС-версию перестраивает только основание (рядом с §5.3 «Ретро-расхождение запирает
период», `:257-265`); §8 — переформулировать **И-3**, добавить **И-21** (ИР-3), **И-22**
(ИР-2′), **И-23** (ИР-5).

- [ ] **Step 2: Реестр гейтов**

`2026-07-26-kredit-gates.md`: **Г-25** в §1.1 «заявлены»; правки формулировок **Г-3**
(меряет происхождением), **Г-4** (не пускает производный), **Г-8** (две ветки).

- [ ] **Step 3: ТЗ**

`requirements/tz/05-kredit.html`: §8 «Транши» и §9 «График» — новые колонки и правила;
§14 — тексты отказов Г-3/Г-4/Г-8 и новый Г-25.

- [ ] **Step 4: TODO**

Тела **P15-R7** (`:1338`), **P15-R8** (`:1346`), **P15-R14** (`:1400`) описывают прежнее
поведение — дополнить. Новые строки **P15-R29** (транши под перенос) и **P15-R30** (график
со статьями) в секцию `### Кредит (целевая модель)`. Секция кредита — **легаси-формы**
(полная вложенная спека в строке), не JSON-island: пишем в её стиле, `check_tasks.py` на неё
не распространяется. Правка `TODO.md` руками Claude Code запускает hook синхронизации с
Google Sheet — Sheet не трогать.

- [ ] **Step 5: Глоссарий**

`CONTEXT.md`: **«График погашения»** (`:148-153`) — строится от даты освоения **либо от даты
вступления ДС**, версия несёт **период действия**, а не признак активной; **«Освоение»**
(`:99-102`) — снять безусловное «до него графика не существует». Статьи «Транш» (`:86-88`),
«Производный транш» (`:91-97`) и «Перенос» (`:104-110`) уже точны — **не трогать**.

- [ ] **Step 6: Коммит**

```bash
git add mockups/loan-credit/ASUBK-kredit-logika.md docs/superpowers/specs/2026-07-26-kredit-gates.md requirements/tz/05-kredit.html TODO.md CONTEXT.md
git commit -m "docs(credit): логика, гейты, ТЗ, бэклог и глоссарий под перенос и статьи (КВ-26)"
```

---

### Task 11: Запись волны в статус разработки

**Files:**
- Modify: `mockups/loan-credit/ASUBK-status-razrabotki.md`

- [ ] **Step 1: Прочитать образец**

Раздел волны КВ-25 в конце файла — повторить структуру: заголовок, «Задача», «Решения»,
«Реализация», ссылка на спеку.

- [ ] **Step 2: Доложить пропущенную КВ-25 в таблицу решений**

Таблица решений (`:30-57`) не содержит строки КВ-25 — дописать её вместе со строкой **КВ-26**.

- [ ] **Step 3: Дописать раздел волны**

```markdown
## Что сделано волной 12.08.2026 (десятая) — «Транши» и «График» под реструктуризацию (КВ-26)
```

Содержание: три решения реструктуризации приземлены в кредит; `t.transfers[]` —
единственное новое хранилище, ИР-3 держится производной формулой; флаг `active` снят,
действующая версия выводится `scheduleAt`; строка графика несёт безставочные статьи;
дверь `restructureApplied` + гейт Г-25; демо-кредит К-7; смоук `114 → 131`. Ссылки на
спеку и ADR-0115.

- [ ] **Step 4: Коммит**

```bash
git add mockups/loan-credit/ASUBK-status-razrabotki.md
git commit -m "docs(credit): запись волны КВ-26 — «Транши» и «График» под реструктуризацию"
```

---

## Что вне плана

- **Постановка разработке.** `docs/tasks/p15-kredit-tasks.html` заморожен как легаси-формат
  (`docs/tasks/FORMAT.md:6-9`); переиздание модуля целиком — отдельная работа.
- **Дублирование движка.** `restructuring.html` сохраняет свою копию `amortize`/`spreadParts`
  для чернового предпросмотра — макеты самодостаточны и вызвать друг друга не могут. Кредит
  становится хозяином **формы контракта** (Г-25 валидирует принятые строки), не единственным
  исполнителем арифметики.
- **Фильтр по виду ДС** (Г-23, [ADR-0111](../../adr/0111-vid-ds-razvodit-marshruty-izmeneniya-usloviy.md))
  — отложен поверх КВ-25, требует справочника видов ДС.
- **Компенсирующее ДС** (отмена применённого) — механизм назван в РС-10, своей двери не
  получает.
- **Открытый вопрос ГФХ** о капитализации ненаступившего накопленного и дефект **КЛ-2** —
  чужие, живут в макете реструктуризации.
