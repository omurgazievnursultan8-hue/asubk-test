# Кредит публикует очередь погашения (P15-R24) — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** научить эталонный макет `mockups/loan-credit/credit.html` публиковать очередь погашения (`d.queue`) и заменить отвергнутую пропорцию Д-8 лестницей `ADR-0060 §3` — одним правилом с двумя потребителями.

**Architecture:** одна лестница (`ladderAt`) даёт порядок «самое раннее просроченное → дальше»; `layersByLadder` прогоняет её на дату каждого судебного акта и метит позиции, пока присуждённое не исчерпается; `buildLedger` берёт режим начисления у слоя СВОЕЙ строки вместо доли от тела; `buildQueue` собирает из готового леджера упорядоченный перечень непогашенного и кладёт его в возврат `derive()`; вкладка «Платежи» показывает перечень секцией под сводом по статьям.

**Tech Stack:** self-contained HTML-макет (один `<script>`, чистые функции в `window.CR`); смоук `scripts/inspect/credit-check.mjs` (zero-dep, `node:vm`, без DOM для логики и с DOM-заглушкой для рендера); Markdown-документация; `docs/tasks/*.html` с JSON-островом, валидируется `scripts/check_tasks.py`.

**Спека:** [`docs/superpowers/specs/2026-08-10-kredit-publikaciya-ocheredi-design.md`](../specs/2026-08-10-kredit-publikaciya-ocheredi-design.md). **ADR:** [`docs/adr/0060-transh-schet-oblast-ochered.md`](../../adr/0060-transh-schet-oblast-ochered.md).

## Global Constraints

- **Рабочая директория — ворктри** `/home/azamat/projects/asubk-credit-module/.claude/worktrees/credit`. Все команды оттуда, `cd` в основной чекаут запрещён.
- **Цикл теста в этом репозитории один:** дописать `ok(N, …)` в `scripts/inspect/credit-check.mjs` → `node scripts/inspect/credit-check.mjs` → увидеть **FAIL** → править `mockups/loan-credit/credit.html` → тот же запуск → **PASS** → коммит.
- **Смоук переписывает блок `SMOKE (node)` внутри `credit.html`** (`credit-check.mjs:1242-1254`) и выходит с кодом 1 при любом FAIL. Строка вида `SMOKE (node) 2026-08-10 · N/N PASS` меняется при каждом запуске — она **ожидаемая часть каждого коммита**, не мусор.
- **Стартовое состояние рабочего дерева:** `credit.html` уже содержит одну незакоммиченную правку — штамп смоука `2026-08-05` → `2026-08-10` от контрольного прогона. Первый коммит забирает её вместе со своими изменениями.
- **Было 98 проверок, станет 101.** Новые номера — только **#97, #98, #99**. Последний занятый числовой номер — `ok(96)`; суффиксы (`0a`, `60b`, `98b` и т. п.) в этом плане **не заводятся** — спека фиксирует итог 101/101.
- **Новые чистые функции обязаны попасть в экспорт** `window.CR` (`credit.html:4754-4780`) — иначе смоук до них не дотянется.
- **Ничего не трогать в** `mockups/payments/payments.html` (демо-наборы не пересекаются: `C-112`/`C-56` против `K-*`), `CONTEXT.md` (термины уже разведены верно) и `docs/adr/` (новых модельных решений не принимается — реализуется принятое `ADR-0060`).
- **Язык кода и комментариев — русский**, как во всём файле. Комментарий объясняет ПОЧЕМУ, а не что; так написан весь `credit.html`.
- **Хук авто-синка:** правка `TODO.md` инструментами Claude Code запускает `scripts/todo_hook.py` → выгрузку в Google Sheet. Это нормально; вручную Sheet не править.
- **Даты в модели — `дд.мм.гггг`**, парсер `pd()`, форматтер `fd()`; `TODAY = '23.07.2026'` (демо-«сегодня» зафиксировано).
- **Никаких новых внешних зависимостей**: макет самодостаточен, смоук zero-dep.

---

## File Structure

| Файл | Ответственность | Что делаем |
|---|---|---|
| `mockups/loan-credit/credit.html` | эталон модуля «Кредиты» целиком: модель, чистый логический слой, рендер | добавляем `ladderAt`, `layersByLadder`, `buildQueue`; `courtLayersOf` получает `id`/`label`; `buildLedger` теряет `frozenShareAt`; `derive()` возвращает `queue`; секция «Очередь погашения» на вкладке «Платежи»; правки текстов шапки и вкладок |
| `scripts/inspect/credit-check.mjs` | headless-смоук: чистые функции в `node:vm` + рендер вкладок в DOM-заглушке | проверки #97…#99; в #53 добавляется условие на секцию очереди |
| `mockups/loan-credit/ASUBK-status-razrabotki.md` | журнал решений (`КВ-*`) и дефектов (`КР-*`) макета кредита | КВ-18, КР-58 (отложено), запись волны 10.08.2026 |
| `mockups/payments/ASUBK-platezhi-logika.md` | спека модуля платежей | §12: обещание волны 2 закрывается, пропорция Д-8 снимается |
| `docs/tasks/p15-kredit-tasks.html` | бэклог разработки P15 (JSON-остров) | `P15-R24` → `state:'mock'`; новая карточка `P15-R25` (`state:'debt'`) |
| `TODO.md` | единственный источник правды по задачам, синхронизируется в Sheet | запись `P15-R25` |

**Границы.** `ladderAt` не знает ни пени, ни слоёв — только даты, ОД и проценты; ею пользуются ДО того, как слой известен. `layersByLadder` не знает начисления — только присуждённые суммы и лестницу. `buildQueue` не считает ничего: он читает готовый леджер и упорядочивает. Рендер не считает ничего: он читает `d.queue`.

---

### Task 1: Лестница и идентичность слоя

**Files:**
- Modify: `mockups/loan-credit/credit.html:3513-3519` (`courtLayersOf`), новые функции сразу после неё, экспорт `:4754-4780`
- Test: `scripts/inspect/credit-check.mjs` — новая проверка `#98` в конце файла, между `ok(96, …)` (`:1240`) и хвостом печати результатов (`:1242`)

**Interfaces:**
- Consumes: `courtLayersOf(c, asOf)`, `accrualModeOf(date)`, `trancheScheduleRows(t)`, `ledgerKey(trancheNo, no)`, `paidPool(c, asOf)`, `pd`/`fd`/`round2` — всё уже есть в файле.
- Produces:
  - `courtLayersOf(c, asOf) → [{date, kind, il, amount, mode, id, label}]`, `id` = `'L-1' | 'L-2' | …` по возрастанию даты решения, `label` = `'Слой решения от 28.05.2026 · ИЛ-2201/1'`.
  - `ladderAt(c, date) → [{key, trancheNo, no, date, principalDue, interestDue, overdue, principalBal, interestBal}]`, отсортировано по дате наступления, без позиций с нулевым остатком.
  - `layersByLadder(c, asOf) → Map<key, layerId>`.
  - Обе новые функции в `window.CR`.

- [ ] **Step 1: Написать падающий тест**

Дописать в `scripts/inspect/credit-check.mjs` после блока `ok(96, …)` (кончается на `:1240`) и **перед** строкой `const pass = results.filter(r => r.pass).length;` (`:1242`):

```js
/* 97…99 — ОЧЕРЕДЬ ПОГАШЕНИЯ (ADR-0060, задача P15-R24). */

/* 98. СОСТАВ СЛОЯ ВЫВОДИТ ЛЕСТНИЦА, А НЕ ПРОПОРЦИЯ (ADR-0060 §3 — снятие допущения Д-8).
   K-3: судебный приказ от 28.05.2026 на 18 300 при взносах по 12 300. Присуждённое
   обязано накрыть ПЕРВЫЕ ДВЕ позиции целиком (12 300 + остаток 6 000 уходит во вторую)
   и не дотянуться до третьей. Пропорция к телу дала бы вместо этого по 9,15 % КАЖДОЙ
   позиции — «верный порядок величины при неверной копейке». */
(() => { const db = CR.seedDb(); const c = byId(db,'K-3');
  const L   = CR.courtLayersOf(c, CR.TODAY)[0];
  const lad = CR.ladderAt(c, L.date).map(p => p.key);
  const map = CR.layersByLadder(c, CR.TODAY);
  ok(98, L.id === 'L-1' && /28\.05\.2026/.test(L.label)
      && lad[0] === 'T1#1' && lad[1] === 'T1#2' && lad[2] === 'T1#3'
      && map.get('T1#1') === 'L-1' && map.get('T1#2') === 'L-1'
      && !map.has('T1#3') && !map.has('T1#4'),
     `слой ${L.id} на ${L.amount}: лестница ${lad.slice(0,3).join(' → ')};`
     + ` помечено ${[...map.keys()].join(', ') || '—'}`);
})();
```

- [ ] **Step 2: Запустить и убедиться, что тест падает**

Run: `node scripts/inspect/credit-check.mjs`
Expected: FAIL — вывод содержит строку `#98 ✗` и текст ошибки `CR.ladderAt is not a function` либо (если исключение всплывёт наружу) падение всего скрипта на этом месте. Итог не 99/99.

- [ ] **Step 3: Дать `courtLayersOf` идентичность**

Заменить хвост функции (`credit.html:3516-3519`):

```js
function courtLayersOf(c, asOf){
  const lim = pd(asOf || TODAY);
  return ((c.mirror && c.mirror.court) || [])
    .filter(x => x && x.date && (x.amount || 0) > 0 && pd(x.date) <= lim)
    .map(x => ({ date:x.date, kind:x.kind, il:x.il || null, amount:x.amount || 0, mode:accrualModeOf(x.date) }))
    .sort((a,b) => pd(a.date) - pd(b.date))
    /* ИДЕНТИЧНОСТЬ СЛОЯ (ADR-0060 §3). Пока слой был долей от тела, имени ему не
       требовалось; теперь строка очереди обязана назвать СВОЙ слой, а строк много.
       Нумерация по возрастанию даты акта устойчива: срез отсекает решения позже даты,
       то есть всегда хвост отсортированного списка, и L-1 остаётся L-1 на любую дату.
       Подпись отдаётся готовой — справочника слоёв (`c.layers`, как в payments.html)
       у кредита в модели нет, разворачивать id некому. */
    .map((x, i) => Object.assign(x, { id:'L-' + (i + 1),
      label:'Слой решения от ' + x.date + (x.il ? ' · ' + x.il : '') }));
}
```

- [ ] **Step 4: Добавить лестницу и назначение слоя**

Вставить сразу после `courtLayersOf`, перед комментарием к `buildLedger`:

```js
/* ЛЕСТНИЦА (ADR-0060 §3) — непогашенные позиции графика с остатками ОД и процентов в
   порядке «самое раннее просроченное → дальше». Это первый проход buildLedger, вынутый
   и обеднённый: ни пени, ни слоёв здесь нет, потому что ею пользуются ДО того, как слой
   известен. Проценты берутся ДО заморозки (interestDue): заморозка — ровно то, что
   лестница и определяет.
     Хвост НЕ обрезается датой, в отличие от buildLedger. Присуждённое дотягивается и до
   ненаступивших взносов — суд присуждает по требованию о ДОСРОЧНОМ возврате (у К-3 оно
   прямо в модели, targetUse.measures), и «дальше» в ADR-0060 §3 тем и кончается. Порядок
   от этого не меняется: обход идёт по дате наступления, и наступившее стоит впереди по
   построению. Обрезка же давала бы пустую лестницу всякий раз, когда акт датирован
   раньше первой позиции графика, — слой оказался бы пуст при непустой присуждённой
   сумме. */
function ladderAt(c, date){
  const lim = pd(date || TODAY);
  const rows = [];
  for (const t of c.tranches)
    for (const r of trancheScheduleRows(t))
      rows.push({ key:ledgerKey(t.no, r.no), trancheNo:t.no, no:r.no, date:r.date,
        principalDue:r.principal || 0, interestDue:r.interest || 0, overdue:pd(r.date) <= lim });
  rows.sort((a,b) => pd(a.date) - pd(b.date) || a.trancheNo - b.trancheNo || a.no - b.no);
  const pool = paidPool(c, fd(lim));
  let pP = pool.principal, pI = pool.interest;
  for (const r of rows){
    const pPaid = round2(Math.min(pP, r.principalDue)); pP = round2(pP - pPaid);
    const iPaid = round2(Math.min(pI, r.interestDue));  pI = round2(pI - iPaid);
    r.principalBal = round2(r.principalDue - pPaid);
    r.interestBal  = round2(r.interestDue  - iPaid);
  }
  return rows.filter(r => r.principalBal + r.interestBal > 0.005);
}

/* СОСТАВ СЛОЯ ПО ТРАНШАМ — производная НА ДАТУ АКТА, не поле (ADR-0060 §3). Каждое
   решение прогоняет лестницу на СВОЮ дату и метит позиции, пока присуждённое не
   исчерпается. asOf отсекает решения ПОЗЖЕ даты среза — те же, что отсекает
   courtLayersOf; сам обход от даты среза не зависит.
     Позиция достаётся ПЕРВОМУ по дате решению, которое до неё дотянулось, и принадлежит
   ровно одному слою: иначе её начисление подчинялось бы двум режимам сразу. Помеченную
   позицию следующий слой пропускает, НЕ расходуя на неё присуждённое, — второй акт
   присуждает свой долг, обычно более поздний, и должен дотянуться дальше первого, а не
   упереться в его хвост.
     Довод в пользу общей лестницы — симметрия (ADR-0060 §4): слой поглощает долг в том
   же порядке, в каком платёж его гасит. Две лестницы в одном модуле разъедутся молча. */
function layersByLadder(c, asOf){
  const map = new Map();
  for (const L of courtLayersOf(c, asOf)){
    let left = L.amount;
    for (const p of ladderAt(c, L.date)){
      if (left <= 0.005) break;
      if (map.has(p.key)) continue;
      map.set(p.key, L.id);
      left = round2(left - p.principalBal - p.interestBal);
    }
  }
  return map;
}
```

- [ ] **Step 5: Зарегистрировать функции в экспорте**

В `credit.html:4754-4780` заменить строку

```js
  disputeWindows, courtLayersOf, accrualModeOf,
```

на

```js
  disputeWindows, courtLayersOf, accrualModeOf, ladderAt, layersByLadder,
```

- [ ] **Step 6: Запустить тесты и убедиться, что они проходят**

Run: `node scripts/inspect/credit-check.mjs`
Expected: PASS — `#98 ✓`, итог **99/99 PASS**. Остальные 98 проверок остаются зелёными: `buildLedger` в этой задаче не менялся, `courtLayersOf` только добавила поля.

- [ ] **Step 7: Коммит**

```bash
git add mockups/loan-credit/credit.html scripts/inspect/credit-check.mjs
git commit -m "feat(credit): лестница ADR-0060 §3 — ladderAt, layersByLadder, идентичность слоя"
```

---

### Task 2: `buildLedger` берёт режим у слоя строки, а не долю от тела

**Files:**
- Modify: `mockups/loan-credit/credit.html:3543-3561` (блок Д-8 и `frozenShareAt`), `:3567-3589` (первый проход), `:3622` (возврат)
- Test: `scripts/inspect/credit-check.mjs` — расширение проверки `#98`

**Interfaces:**
- Consumes: `layersByLadder(c, asOf)`, `courtLayersOf(c, asOf) → …{id, label, mode}` (Task 1).
- Produces:
  - строка леджера получает поле `layerId: 'L-1' | null`;
  - `buildLedger(...)` дополнительно возвращает `byLadder` — ту же `Map<key, layerId>`, включая ключи ненаступивших позиций (нужна `buildQueue` в Task 3);
  - `frozenShareAt`, `body`, `awardedI`, `awardedP`, `firstLayer` в файле больше не существуют.

- [ ] **Step 1: Расширить тест #98 ожиданиями по замораживанию**

В `scripts/inspect/credit-check.mjs` заменить проверку `#98`, добавив в неё `derive` и точные величины:

```js
/* 98. СОСТАВ СЛОЯ ВЫВОДИТ ЛЕСТНИЦА, А НЕ ПРОПОРЦИЯ (ADR-0060 §3 — снятие допущения Д-8).
   K-3: судебный приказ от 28.05.2026 на 18 300 при взносах по 12 300. Присуждённое
   обязано накрыть ПЕРВЫЕ ДВЕ позиции целиком (12 300 + остаток 6 000 уходит во вторую)
   и не дотянуться до третьей. Пропорция к телу дала бы вместо этого по 9,15 % КАЖДОЙ
   позиции — «верный порядок величины при неверной копейке».
     Отсюда и величины: приостановлены проценты ровно двух накрытых позиций
   (4 000 + 3 900 = 7 900). Пеня у К-3 начисляется ТОЛЬКО на проценты (penaltyMain:0,
   penaltyInt:0,1) и замораживается за дни ПОСЛЕ решения: 4 000 × 0,1 % × 56 дн. +
   3 900 × 0,1 % × 56 дн. = 224,00 + 218,40 = 442,40, где 56 = дни 28.05 → 23.07.
   Прежняя пропорция замораживала по 9,15 % процентов ПОЗДНИХ позиций и не трогала
   ранние — то есть ровно наоборот (686,25 и 52,45). */
(() => { const db = CR.seedDb(); const c = byId(db,'K-3');
  const L   = CR.courtLayersOf(c, CR.TODAY)[0];
  const lad = CR.ladderAt(c, L.date).map(p => p.key);
  const map = CR.layersByLadder(c, CR.TODAY);
  const d   = CR.derive(c);
  ok(98, L.id === 'L-1' && /28\.05\.2026/.test(L.label)
      && lad[0] === 'T1#1' && lad[1] === 'T1#2' && lad[2] === 'T1#3'
      && map.get('T1#1') === 'L-1' && map.get('T1#2') === 'L-1'
      && !map.has('T1#3') && !map.has('T1#4')
      && d.debt.interest.frozen === 7900 && Math.abs(d.debt.penalty.frozen - 442.40) < 0.05
      && d.ledger.index.get('T1#1').layerId === 'L-1'
      && d.ledger.index.get('T1#3').layerId === null,
     `слой ${L.id} на ${L.amount}: лестница ${lad.slice(0,3).join(' → ')};`
     + ` помечено ${[...map.keys()].join(', ') || '—'};`
     + ` приостановлено %=${d.debt.interest.frozen}, пеня=${d.debt.penalty.frozen}`);
})();
```

- [ ] **Step 2: Запустить и убедиться, что тест падает**

Run: `node scripts/inspect/credit-check.mjs`
Expected: FAIL — `#98 ✗` с примечанием вида `… приостановлено %=686.25, пеня=52.45` (нынешние величины пропорции) и `layerId` = `undefined`. Итог 98/99.

- [ ] **Step 3: Убрать пропорцию, взять слой у строки**

В `buildLedger` заменить блок «ДОЛЯ ДОЛГА ПОД РЕШЕНИЕМ СУДА» (`credit.html:3543-3561`, от комментария до строки `const wins = disputeWindows(c);` включительно) на:

```js
  /* СЛОЙ СТРОКИ. Присуждённое покрывает взносы лестницей на дату акта (ADR-0060 §3):
     у строки ровно один слой, и режим начисления берётся у НЕГО. Прежняя пропорция к
     телу (допущение Д-8) отвергнута тем же ADR: просрочка накапливается неравномерно,
     у старого транша её больше, и доля всегда занижала его долю. Непомеченная строка —
     свободный слой: начисление по договору, ничего не приостановлено. */
  const layers    = courtLayersOf(c, fd(lim));
  const byLadder  = layersByLadder(c, fd(lim));
  const layerById = new Map(layers.map(L => [L.id, L]));
  const layerOf   = (r) => layerById.get(byLadder.get(r.key)) || null;
  const wins = disputeWindows(c);
```

- [ ] **Step 4: Переписать заморозку процентов в первом проходе**

Заменить (`credit.html:3567-3570`):

```js
    /* проценты: часть, приходящаяся на присуждённую долю, приостановлена решением суда */
    const fs = frozenShareAt(pd(r.date));
    r.interestFrozen  = round2((r.interestDue || 0) * fs.i);
    r.interestCharged = round2((r.interestDue || 0) - r.interestFrozen);
```

на:

```js
    /* проценты: у строки под решением суда статья приостановлена ЦЕЛИКОМ — слой несёт
       позицию, а не долю позиции. layerId остаётся на строке: очередь и экран обязаны
       назвать слой, а второй раз выводить его было бы второй реализацией правила. */
    const CL = layerOf(r);
    r.layerId = CL ? CL.id : null;
    r.interestFrozen  = (CL && !CL.mode.interest) ? round2(r.interestDue || 0) : 0;
    r.interestCharged = round2((r.interestDue || 0) - r.interestFrozen);
```

- [ ] **Step 5: Переписать базу и заморозку пени**

Заменить целиком (`credit.html:3579-3589`) — от комментария про пеню до строки `r.penaltyFrozen`:

```js
    /* пеня — на непокрытый остаток за дни просрочки; при паузе начисления процентов
       пеня не затрагивается (Р-17), поэтому holds здесь не участвуют */
    const perDay = r.principalOverdue * (r.penaltyMain/100) + r.interestOverdue * (r.penaltyInt/100);
    r.penaltyAccrued = round2(perDay * r.days);
    /* пеня на присуждённую долю приостановлена ОБОИМИ режимами — но только за дни ПОСЛЕ
       решения: до него пеня начислялась по договору и решением не отменяется. Доля берётся
       на дату среза, а дни — от ПЕРВОГО решения: при нескольких решениях с разными датами
       это огрубление в пользу заёмщика и часть допущения Д-8 (точный учёт — по слоям, у
       владельца разнесения). */
    const daysAfterCourt = firstLayer ? Math.max(0, dd(Math.max(pd(r.date), firstLayer), lim)) : 0;
    r.penaltyFrozen  = round2(perDay * daysAfterCourt * frozenShareAt(lim).p);
```

на:

```js
    /* пеня — на непокрытый остаток за дни просрочки; при паузе начисления процентов
       пеня не затрагивается (Р-17), поэтому holds здесь не участвуют.
       База берётся ДО заморозки процентов. Пока слой был долей, вопроса не возникало:
       доля морозила часть процентов, база оставалась. Теперь статья под решением
       приостановлена ЦЕЛИКОМ, и база из interestOverdue обнулилась бы вместе с ней — а
       у К-3 пеня начисляется ТОЛЬКО на проценты (penaltyMain:0). Исчезла бы не только
       приостановленная пеня, но и пеня за дни ДО решения, которую решение не отменяет
       (об этом же говорит комментарий ниже). Отсюда interestBase. */
    const interestBase = Math.max(0, round2((r.interestDue || 0) - r.interestPaid));
    const perDay = (r.principalBal + interestBase > 0.005)
      ? r.principalBal * (r.penaltyMain/100) + interestBase * (r.penaltyInt/100) : 0;
    r.penaltyAccrued = round2(perDay * r.days);
    /* пеня позиции под решением приостановлена ОБОИМИ режимами — но только за дни ПОСЛЕ
       решения: до него пеня начислялась по договору и решением не отменяется. Дни идут
       от даты СВОЕГО решения; прежнее огрубление «доля на дату среза, дни от ПЕРВОГО
       решения» ушло вместе с пропорцией — при нескольких решениях с разными датами оно
       считало по чужому акту. Заморозка не превысит начисленного: множитель тот же,
       а daysAfterCourt ≤ days. */
    const daysAfterCourt = (CL && !CL.mode.penalty)
      ? Math.max(0, dd(Math.max(pd(r.date), pd(CL.date)), lim)) : 0;
    r.penaltyFrozen  = round2(perDay * daysAfterCourt);
```

На строках БЕЗ слоя формула не меняется ни на копейку: `principalBal` и `interestBase`
там равны `principalOverdue` и `interestOverdue`, а полностью погашенная позиция даёт
нули в обеих записях. Поэтому 56 кредитов без судебных решений остаются нетронутыми.

- [ ] **Step 6: Отдать карту слоёв наружу**

В возврате `buildLedger` (`credit.html:3622`) заменить

```js
  return { rows, index, pool, feeRows, layers, disputes:wins,
```

на

```js
  return { rows, index, pool, feeRows, layers, byLadder, disputes:wins,
```

- [ ] **Step 7: Запустить тесты и убедиться, что они проходят**

Run: `node scripts/inspect/credit-check.mjs`
Expected: PASS — `#98 ✓`, итог **99/99 PASS**.

Три проверки в зоне риска, все обязаны остаться зелёными:
- **#60** (`:791`) — держит порог `d.debt.interest.frozen > 0` и `d.debt.penalty.frozen > 0` на K-3: 686,25 → 7 900 и 52,45 → 442,40, порог держится.
- **#60b** (`:806`) — переносит то же решение на 01.03.2025 (старая норма: проценты идут, пеня приостановлена). Лестница на эту дату непуста именно потому, что хвост не обрезается по дате (Task 1): позиции K-3 начинаются 19.04.2026, и присуждённое накрывает те же T1#1 и T1#2. Ожидание: `interest.frozen === 0` (режим `interest:true`), `penalty.frozen > 0` — дни идут от даты наступления позиции, потому что решение старше её: 4 × 95 + 3,9 × 65 = 633,50.
- **#61** (`:816`) — «переплата ровно у одного кредита». Начисленные проценты K-3 падают с 14 713,75 до 7 500, но пул процентов у K-3 равен нулю, переплате взяться неоткуда.

Если упало что-то другое — **не подгонять константы**: расхождение означает, что слой назначен не тем позициям. Диагностика: `CR.layersByLadder(c, CR.TODAY)` и `CR.ladderAt(c, L.date)` печатают состав напрямую.

- [ ] **Step 8: Убедиться, что пропорции в файле не осталось**

Run: `grep -n "frozenShareAt\|awardedI\|awardedP\|firstLayer" mockups/loan-credit/credit.html`
Expected: пусто (нулевой вывод, `grep` вернёт код 1).

- [ ] **Step 9: Коммит**

```bash
git add mockups/loan-credit/credit.html scripts/inspect/credit-check.mjs
git commit -m "feat(credit): режим начисления берётся у слоя строки — пропорция Д-8 снята"
```

---

### Task 3: `buildQueue` и публикация в `derive()`

**Files:**
- Modify: `mockups/loan-credit/credit.html` — новая функция сразу после `debtOf`/`DEBT_ARTICLES` (`:3689`), `derive()` (`:3968` и возврат `:3997`), экспорт `:4754-4780`
- Test: `scripts/inspect/credit-check.mjs` — новые проверки `#97` и `#99`

**Interfaces:**
- Consumes: `buildLedger(...) → {rows, feeRows, layers, byLadder, until, …}` (Task 2), `trancheScheduleRows(t)`, `ledgerKey(trancheNo, no)`.
- Produces:
  ```js
  d.queue = { asOf:'23.07.2026', rows:[
    { due:'19.04.2026', layer:'L-1', layerLabel:'Слой решения от 28.05.2026 · ИЛ-2201/1',
      tranche:1, article:'Основной долг', urg:'over', amount:8300, future:false },
    …
  ]}
  ```
  `layer` — `'L-1' | 'L-2' | … | 'free'`; `layerLabel` — готовая подпись либо `'Вне решения суда'`; `tranche` — номер транша либо `null` у комиссии (Д-10); `article` — одно из четырёх значений `DEBT_ARTICLES`; `urg` — `'over' | 'cur'`; `amount` — всегда > 0.
  `buildQueue` в `window.CR`.

- [ ] **Step 1: Написать падающие тесты**

Дописать в `scripts/inspect/credit-check.mjs` перед проверкой `#98`:

```js
/* 97. ОЧЕРЕДЬ ПУБЛИКУЕТ КРЕДИТ (ADR-0060 §4). Перечень непогашенного отдаётся из
   derive(), и его просроченная часть сходится со сводом по статьям копейка в копейку.
   Расхождение означало бы, что лестница и debtOf разошлись молча — ровно тот дефект,
   ради которого очередь и передана одному владельцу. Проверяется на всём демонаборе:
   инвариант обязан держаться и у закрытого кредита, и у кредита без графика. */
(() => { const db = CR.seedDb();
  let bad = null, withRows = 0;
  for (const c of db.credits){
    const d = CR.derive(c);
    if (!d.queue || !Array.isArray(d.queue.rows)){ bad = `${c.id}: очереди нет`; break; }
    if (d.queue.asOf !== d.calcUntil){
      bad = `${c.id}: очередь на ${d.queue.asOf}, расчёт доведён до ${d.calcUntil}`; break; }
    if (d.queue.rows.some(r => !(r.amount > 0))){ bad = `${c.id}: в очереди нулевая строка`; break; }
    if (d.queue.rows.length) withRows++;
    const over = Math.round(d.queue.rows.filter(r => r.urg === 'over')
                     .reduce((a, r) => a + r.amount, 0) * 100) / 100;
    if (Math.abs(over - d.overdueAmount) > 0.02){
      bad = `${c.id}: Σ просроченного в очереди ${over} ≠ своду ${d.overdueAmount}`; break; }
  }
  ok(97, !bad && withRows > 0,
     bad || `очередь непуста у ${withRows} кредитов из ${db.credits.length}, Σ просроченного сходится со сводом`);
})();
```

и после проверки `#98`:

```js
/* 99. ПОРЯДОК ОЧЕРЕДИ — один, по дате наступления (ADR-0060 §2: «независимо от того,
   чьи они»), ненаступившее хвостом. K-1: комиссия 1 000 от 18.05.2026 (не погашена),
   позиция 18.06.2026 погашена целиком и в перечень не попадает, 18.07.2026 просрочена,
   дальше 22 будущие позиции. Комиссия идёт первой строкой не по статье, а по дате —
   и несёт tranche:null (допущение Д-10: транша у комиссии в модели нет). */
(() => { const db = CR.seedDb(); const c = byId(db,'K-1');
  const rs = CR.derive(c).queue.rows;
  let mono = true, tail = true, seenFuture = false;
  for (let i = 0; i < rs.length; i++){
    if (i && pd(rs[i].due) < pd(rs[i-1].due)) mono = false;
    if (rs[i].future) seenFuture = true; else if (seenFuture) tail = false;
  }
  const fee = rs[0] || {};
  ok(99, rs.length > 0 && mono && tail
      && rs.every(r => r.urg === (r.future ? 'cur' : 'over'))
      && rs.every(r => r.layer === 'free' || /^L-\d+$/.test(r.layer))
      && fee.article === 'Сборы и комиссии' && fee.tranche === null && fee.due === '18.05.2026'
      && !rs.some(r => r.due === '18.06.2026'),
     `строк=${rs.length}, ненаступивших=${rs.filter(r=>r.future).length},`
     + ` первая — ${fee.article} на ${fee.due}, порядок дат ${mono?'не убывает':'СБИТ'},`
     + ` хвост ${tail?'в конце':'ПЕРЕМЕШАН'}`);
})();
```

- [ ] **Step 2: Запустить и убедиться, что тесты падают**

Run: `node scripts/inspect/credit-check.mjs`
Expected: FAIL — `#97 ✗` с примечанием `K-1: очереди нет`; `#99 ✗` либо падение на `Cannot read properties of undefined (reading 'rows')`. Итог 99/101.

- [ ] **Step 3: Написать `buildQueue`**

Вставить в `credit.html` сразу после массива `DEBT_ARTICLES` (`:3689-3692`):

```js
/* ОЧЕРЕДЬ ПОГАШЕНИЯ (ADR-0060 §4) — упорядоченный НА ДАТУ перечень непогашенного:
   транш · слой · статья · дата наступления · сумма. Публикует его КРЕДИТ: сырьё —
   взносы, графики, ставки, режимы — целиком у него, у платежей нет ни одной из этих
   величин. Платежи льют деньги по готовому списку сверху вниз и своей лестницы не
   строят; иначе одно правило имело бы двух владельцев и разъехалось молча (ADR-0001).
   Зеркало ADR-0010 становится двусторонним без кольца: кредит отдаёт ЧТО ПОДЛЕЖИТ
   ГАШЕНИЮ, платежи возвращают ЧЕМ ПОГАШЕНО. Перечень производный, не реестр: строится
   на дату, не хранится и платежами не кэшируется.

   Сортировка одна — по дате наступления, независимо от того, чей это транш (ADR-0060
   §2). Внутри даты — по очерёдности статей (комиссия → основной долг → проценты → пеня,
   ADR-0087; расходов по обращению взыскания здесь нет — они собственность взыскания,
   ADR-0004, и в остаток кредита не входят). Внутри статьи — по номеру транша. urg и
   future строку только подписывают и ключами сортировки не служат: у наступившего дата
   меньше даты расчёта, у ненаступившего больше, и хвост встаёт в конец сам.

   Нулевые строки не публикуются: в перечень «что подлежит гашению» ноль не входит,
   лить в него нечего. Отсюда и сходимость Σ просроченного со сводом по статьям.

   Допущение Д-10: комиссии живут на кредите (c.fees), транша у них в модели нет, и в
   очереди они идут строкой «по кредиту» (tranche:null). ADR-0060 §2 требует называть
   транш у строки РАЗНЕСЕНИЯ («иначе не сойдётся ни леджер транша, ни зеркало кредита»),
   а не публикации; выдумывать транш комиссии макет не станет. */
const QUEUE_ARTICLE_ORDER = { 'Сборы и комиссии':0, 'Основной долг':1, 'Проценты':2, 'Пеня':3 };
function buildQueue(c, led){
  const lim = pd(led.until);
  const layerById = new Map(led.layers.map(L => [L.id, L]));
  const rows = [];
  const push = (due, key, trancheNo, article, amount, future) => {
    if (!(amount > 0.005)) return;
    const L = key ? layerById.get(led.byLadder.get(key)) : null;
    rows.push({ due, layer:L ? L.id : 'free', layerLabel:L ? L.label : 'Вне решения суда',
      tranche:(trancheNo == null ? null : trancheNo), article,
      urg:future ? 'cur' : 'over', amount:round2(amount), future:!!future });
  };
  for (const f of led.feeRows) push(f.date, null, null, 'Сборы и комиссии', f._bal || 0, false);
  for (const r of led.rows){
    push(r.date, r.key, r.trancheNo, 'Основной долг', r.principalOverdue, false);
    push(r.date, r.key, r.trancheNo, 'Проценты',      r.interestOverdue,  false);
    push(r.date, r.key, r.trancheNo, 'Пеня',          r.penaltyBal,       false);
  }
  /* ненаступившее — тем же перечнем, серым хвостом: платежам нужен весь список, а не
     его просроченная голова, — досрочное погашение льётся в тот же хвост. Слой у такой
     строки берётся из той же карты: решение о досрочном возврате накрывает и будущий
     взнос, и тогда строка обязана назвать его слой, иначе экран скажет «начисление
     идёт по договору» там, где оно приостановлено. */
  for (const t of c.tranches)
    for (const r of trancheScheduleRows(t)){
      if (pd(r.date) <= lim) continue;
      const key = ledgerKey(t.no, r.no);
      push(r.date, key, t.no, 'Основной долг', r.principal || 0, true);
      push(r.date, key, t.no, 'Проценты',      r.interest  || 0, true);
    }
  rows.sort((a,b) => pd(a.due) - pd(b.due)
    || QUEUE_ARTICLE_ORDER[a.article] - QUEUE_ARTICLE_ORDER[b.article]
    || (a.tranche || 0) - (b.tranche || 0));
  /* дата очереди — та, ДО которой реально считали (у закрытого кредита это дата
     остановки начисления, не дата среза): потребитель сверяет её со своей датой
     разнесения, и соврать здесь значит сравнить разные срезы */
  return { asOf:led.until, rows };
}
```

- [ ] **Step 4: Положить очередь в контракт `derive()`**

В `derive()` после строки `const debt          = debtOf(ledger, disbursed);` (`credit.html:3970`) добавить:

```js
  const queue         = buildQueue(c, ledger);                       // ADR-0060 §4: очередь публикует кредит
```

и в возврате (`credit.html:4003`) заменить

```js
           overpay:debt.overpay, courtLayers:ledger.layers, disputes:ledger.disputes,
```

на

```js
           overpay:debt.overpay, courtLayers:ledger.layers, queue, disputes:ledger.disputes,
```

- [ ] **Step 5: Зарегистрировать `buildQueue` в экспорте**

В `credit.html:4754-4780` заменить

```js
  buildLedger, debtOf, overdueOf, coverageOf, atRiskAmountOf, riskBasisOf,
```

на

```js
  buildLedger, buildQueue, debtOf, overdueOf, coverageOf, atRiskAmountOf, riskBasisOf,
```

- [ ] **Step 6: Запустить тесты и убедиться, что они проходят**

Run: `node scripts/inspect/credit-check.mjs`
Expected: PASS — `#97 ✓`, `#98 ✓`, `#99 ✓`, итог **101/101 PASS**.

- [ ] **Step 7: Коммит**

```bash
git add mockups/loan-credit/credit.html scripts/inspect/credit-check.mjs
git commit -m "feat(credit): derive() публикует очередь погашения (ADR-0060 §4)"
```

---

### Task 4: Секция «Очередь погашения» на вкладке «Платежи»

**Files:**
- Modify: `mockups/loan-credit/credit.html:6416-6421` (между «Задолженность по статьям» и «Счета и код оплаты» внутри `tabPlatezhi`)
- Test: `scripts/inspect/credit-check.mjs:944-951` (цикл рендера в проверке `#53`)

**Interfaces:**
- Consumes: `d.queue` (Task 3), `d.calcStopped`, `d.calcUntil`, `d.calcProvisional`, `d.paymentsAsOf`, `d.overdueAmount`; хелперы рендера `cgrid(cols, rows, {empty})`, `esc`, `money`, `round2`, переменная `cardAsOf`.
- Produces: разметку секции; новых функций не появляется.

- [ ] **Step 1: Написать падающий тест**

В `scripts/inspect/credit-check.mjs` внутри цикла рендера проверки `#53` (`:948-950`) добавить условие после проверки на мусор:

```js
    if (typeof html !== 'string' || html.length < 50) bad.push(`${c.id}/${t}: пусто`);
    else if (/undefined|\[object Object\]|NaN/.test(html)) bad.push(`${c.id}/${t}: мусор в разметке`);
    /* ADR-0060 §4: очередь публикуется на «Платежах» и обязана быть на КАЖДОМ кредите —
       у кредита без графика она пуста, но секция с подписью «непогашенного нет» стоит */
    else if (t === 'Платежи' && !/Очередь погашения/.test(html))
      bad.push(`${c.id}/${t}: секции очереди нет`);
```

- [ ] **Step 2: Запустить и убедиться, что тест падает**

Run: `node scripts/inspect/credit-check.mjs`
Expected: FAIL — `#53 ✗` с примечанием `вкладок=649 проблем=59 K-1/Платежи: секции очереди нет | …`. Итог 100/101.

- [ ] **Step 3: Отрисовать секцию**

В `tabPlatezhi` вставить между закрывающим `</div>` таблицы «Задолженность по статьям» (`credit.html:6420`) и строкой `<div class="section-h" style="margin-top:22px">Счета и код оплаты</div>`:

```js
      ${(() => {
        const q = d.queue || { asOf:d.calcUntil, rows:[] };
        const over = round2(q.rows.filter(r => r.urg === 'over').reduce((a,r) => a + r.amount, 0));
        const rows = q.rows.map(r => `<tr${r.future?' style="color:var(--text-muted)"':''}>
          <td>${esc(r.due)}<br>${r.future
              ? '<span class="pill neutral">не наступило</span>'
              : '<span class="pill high">просрочено</span>'}</td>
          <td>${r.layer==='free'
              ? '—'
              : `<span class="pill mid">${esc(r.layer)}</span><br><span class="text-muted" style="font:var(--font-label)">${esc(r.layerLabel)}</span>`}</td>
          <td>${r.tranche==null?'<span class="text-muted">по кредиту</span>':'№'+esc(r.tranche)}</td>
          <td>${esc(r.article)}</td>
          <td style="text-align:right">${money(r.amount)}</td></tr>`);
        const foot = q.rows.length?`<tr style="font-weight:var(--weight-semibold);background:var(--surface-panel)">
          <td colspan="4">Итого просроченного</td><td style="text-align:right">${money(over)}</td></tr>`:'';
        const when = d.calcStopped
          ? `на <b>${esc(q.asOf)}</b> — дату остановки начисления, а не на дату среза ${esc(cardAsOf)}: расчёт закрытого кредита замер`
          : `на <b>${esc(q.asOf)}</b>`;
        return `
      <div class="section-h" style="margin-top:22px">Очередь погашения <span class="pill info">отдаётся в ПЛАТЕЖИ</span></div>
      <p class="section-note">Упорядоченный перечень непогашенного ${when}: транш · слой · статья · дата наступления · сумма (<b>ADR-0060 §4</b>).
        Порядок один — по дате наступления, независимо от того, чей это транш; внутри даты — по очерёдности статей.
        Платежи льют деньги по готовому списку сверху вниз и своей лестницы не строят: сырьё (взносы, графики, ставки, режимы) целиком у кредита.
        Перечень производный — отдаётся на дату, не хранится.${d.calcProvisional
          ? ` <b>Расчёт предварительный:</b> снимок зеркала платежей от ${esc(d.paymentsAsOf)} старше даты расчёта — хвост очереди посчитан по платежам, которых владелец ещё не прислал.`
          : ''}</p>
      ${cgrid([{h:'Срок'},{h:'Слой'},{h:'Транш'},{h:'Статья'},{h:'Сумма',r:1}],
              rows.concat(foot?[foot]:[]), {empty:'Непогашенного нет'})}
      <p class="section-note">Σ просроченных строк = <b>${money(over)}</b> — та же величина, что в своде по статьям выше.
        Разошлись бы они только при двух разных лестницах, а лестница здесь одна.</p>`;
      })()}
```

Замок `lockHtml()` в этой секции **не ставится**: она собственный вывод кредита, а не зеркало, и замок соврал бы ровно наоборот.

- [ ] **Step 4: Запустить тесты и убедиться, что они проходят**

Run: `node scripts/inspect/credit-check.mjs`
Expected: PASS — `#53 ✓` (`вкладок=649 проблем=0`), итог **101/101 PASS**.

Если `#53` жалуется на `мусор в разметке` — значит куда-то просочился `undefined`: проверить, что `r.tranche == null` сравнивается через `==` (ловит и `null`, и `undefined`), а `layerLabel` у свободной строки не читается вовсе.

- [ ] **Step 5: Коммит**

```bash
git add mockups/loan-credit/credit.html scripts/inspect/credit-check.mjs
git commit -m "feat(credit): секция «Очередь погашения» на вкладке «Платежи»"
```

---

### Task 5: Тексты эталона — «очерёдность» против «очереди погашения»

**Files:**
- Modify: `mockups/loan-credit/credit.html` — `:189`, `:218`, `:365`, `:613` (после Р-29), `:656-661` (Д-8), `:675-678` (открытый вопрос №4), `:707` (шапка SMOKE не трогается), `:1537`, `:6358`, `:6405`, `:6411-6415`
- Test: проверок смоука не добавляется — тексты им не покрываются; верификация grep-ами

**Interfaces:**
- Consumes: ничего.
- Produces: ничего исполняемого. Меняются только подпись поля на экране и комментарии.

**Терминология (`CONTEXT.md:241`, не подлежит обсуждению):** **Очерёдность** — правило порядка (`_Avoid_: очередь погашения`); **Очередь погашения** — перечень на дату (`_Avoid_: очерёдность`). Поле `bc.queue` = правило → «Очерёдность». Новый перечень = «Очередь погашения».

- [ ] **Step 1: Переименовать поле на вкладке «Расчёты»**

`credit.html:6358` — заменить

```js
        ${fld('Очередь погашения', esc(bc.queue))}
```

на

```js
        ${/* «Очерёдность», а не «Очередь погашения»: это ПРАВИЛО старшинства статей, а
              перечень на дату с волны 10.08.2026 живёт на «Платежах» и зовётся очередью
              погашения (CONTEXT.md:241, ADR-0060). Одно имя на два предмета путало. */''}
        ${fld('Очерёдность', esc(bc.queue))}
```

- [ ] **Step 2: Переписать открытый вопрос №4**

`credit.html:675-678` — заменить

```
   4. ЗАКРЫТ волной 27.07.2026 (КВ-3, ADR-0010) в части ответственности: очередь и
      разнесение платежа по статьям принадлежат МОДУЛЮ ПЛАТЕЖЕЙ, кредит принимает их
      готовыми. Сама матрица очередей проектируется там же. Признак «есть судебное
      решение» кредит берёт из зеркала суда, а не регуляркой по строке фазы.
```

на

```
   4. ЗАКРЫТ волной 27.07.2026 (КВ-3, ADR-0010) и ПЕРЕИГРАН волной 10.08.2026
      (КВ-18, ADR-0060 §4). Прежняя редакция отдавала платежам и очередь, и разнесение
      целиком. ADR-0060 §4 разделил: ОЧЕРЕДЬ ПОГАШЕНИЯ (упорядоченный перечень
      непогашенного на дату) публикует КРЕДИТ — сырьё, взносы и режимы у него, у платежей
      нет ни одной из этих величин; платежи льют деньги по готовому списку сверху вниз.
      За платежами остаются МАТРИЦА РАЗНЕСЕНИЯ и привязка к исполнительному листу.
      Признак «есть судебное решение» кредит по-прежнему берёт из зеркала суда, а не
      регуляркой по строке фазы.
```

- [ ] **Step 3: Снять допущение Д-8**

`credit.html:656-661` — заменить весь пункт

```
   • Д-8 (этап 4). Доля долга под решением суда берётся ПРОПОРЦИОНАЛЬНО телу: сумма
     присуждённого к освоенному, не более единицы. Отдельных остатков по слоям кредит не
     ведёт — сырья для этого у него нет: чтобы знать остаток слоя, нужно разнесение
     платежей по слоям, а оно принадлежит модулю платежей (там же привязка к конкретному
     исполнительному листу). Пропорция даёт верный ПОРЯДОК величины приостановленного
     начисления и неверную копейку; настоящий учёт ведётся у владельца.
```

на

```
   • Д-8 СНЯТО волной 10.08.2026 (ADR-0060 §3). Доля долга под решением суда бралась
     пропорционально телу — «верный порядок величины при неверной копейке». ADR-0060 §3
     эту пропорцию отверг: просрочка накапливается неравномерно, у старого транша её
     больше, и доля всегда занижала его долю. Состав слоя выводится ЛЕСТНИЦЕЙ на дату
     акта: присуждённое покрывает взносы траншей в порядке «самое раннее просроченное →
     дальше», пока не исчерпается. Одна позиция принадлежит ровно одному слою.
   • Д-10 (10.08.2026). Комиссии живут на кредите (c.fees), транша у них в модели нет —
     в очереди погашения они публикуются строкой «по кредиту». ADR-0060 §2 требует
     называть транш у строки РАЗНЕСЕНИЯ, а не публикации; выдумывать транш комиссии
     макет не станет.
```

- [ ] **Step 4: Завести решение Р-31 в шапке**

`credit.html` — вставить после блока Р-29 (заканчивается строкой `и из года.`, `:625`) перед пустой строкой и заголовком «ГЕЙТЫ, ДОБАВЛЕННЫЕ ВОЛНОЙ 27.07.2026»:

```
   Р-31 ОЧЕРЕДЬ ПОГАШЕНИЯ ПУБЛИКУЕТСЯ КРЕДИТОМ (10.08.2026, КВ-18, ADR-0060 §3/§4).
        Лестница «самое раннее просроченное → дальше» нужна двоим: платежам — разносить
        деньги, кредиту — выводить состав слоя под решением суда. Одно правило с двумя
        владельцами и есть дефект, ради которого писан ADR-0001, поэтому лестница в
        макете одна (ladderAt) и у неё два потребителя: layersByLadder метит позиции
        присуждённым на дату акта, buildQueue упорядочивает перечень непогашенного.
        Кредит ОТДАЁТ очередь (транш · слой · статья · дата наступления · сумма) —
        d.queue из derive(), секция на вкладке «Платежи»; платежи льют деньги по
        готовому списку сверху вниз и своей лестницы не строят. Зеркало ADR-0010
        становится двусторонним без кольца: величины разные — кредит отдаёт ЧТО
        ПОДЛЕЖИТ ГАШЕНИЮ, платежи возвращают ЧЕМ ПОГАШЕНО. Очередь производная: строится
        на дату, не хранится. Пропорция (Д-8) снята — см. ДЕМО-ОГРАНИЧЕНИЯ.
        ТЕРМИНЫ РАЗВЕДЕНЫ (CONTEXT.md): «очерёдность» — правило старшинства статей
        (параметр bc.queue на «Расчётах»), «очередь погашения» — перечень на дату.
```

- [ ] **Step 5: Переименовать параметр в трёх местах шапки и в сиде**

Четыре точечные правки, каждая — «`queue`» как имя параметра → «`queue` (очерёдность)»:

- `:189` — `Реестр PARAMS — 10 ключей; dayMethod/queue остались в «Расчётах»` → `Реестр PARAMS — 10 ключей; dayMethod/queue (очерёдность) остались в «Расчётах»`
- `:218` — `НЕ ДЕЛАЛОСЬ: … перевод dayMethod/queue` → `НЕ ДЕЛАЛОСЬ: … перевод dayMethod/queue (очерёдность)`
- `:365` — `queue остаётся в «Расчётах» — не запрошено` → `queue (очерёдность — правило старшинства статей, не перечень) остаётся в «Расчётах» — не запрошено`
- `:1537` — в `condDefaults` строку `penaltyMaxPct:20, queue:'по договору', dayMethod:'факт/365',` оставить как есть, а над ней добавить комментарий:
  ```js
    /* queue — ОЧЕРЁДНОСТЬ: правило старшинства статей из договора. Не путать с очередью
       погашения — перечнем непогашенного на дату, который кредит публикует в d.queue
       (ADR-0060 §4, CONTEXT.md:241). */
  ```

- [ ] **Step 6: Поправить тексты вкладки «Платежи»**

Термин «матрица очередей» неверен во всём файле — матрица у платежей одна и она **разнесения**;
«очередь» с этой волны занята перечнем. Пять вхождений, каждое правится точечно:

`credit.html:6405` — в подписи секции «Платежи» заменить

```
Разнесение по статьям приходит вместе с подтверждением и здесь не правится: матрица очередей принадлежит платежам.
```

на

```
Разнесение по статьям приходит вместе с подтверждением и здесь не правится: матрица разнесения принадлежит платежам, а очередь погашения — кредиту (секция ниже, ADR-0060 §4).
```

`credit.html:550` — `снимка (матрица очередей принадлежит платежам, §10.4). Статей у кредита ЧЕТЫРЕ:`
→ `снимка (матрица разнесения принадлежит платежам, §10.4). Статей у кредита ЧЕТЫРЕ:`

`credit.html:1868-1869` — `Погашенное и его разнесение по статьям кредит НЕ выводит: матрица очередей` /
`живёт у платежей, и при судебном решении очередей несколько (§10.4). */`
→ `Погашенное и его разнесение по статьям кредит НЕ выводит: матрица разнесения` /
`живёт у платежей, и при судебном решении слоёв несколько (§10.4). Очередь погашения —` /
`наоборот, собственность кредита (ADR-0060 §4). */`

`credit.html:3499` — `по слоям — у платежей (там матрица очередей и привязка к исполнительному листу). */`
→ `по слоям — у платежей (там матрица разнесения и привязка к исполнительному листу), а состав` /
`слоя и очередь погашения — у кредита (ADR-0060 §3/§4). */`

`credit.html:4587` — `кредит его не выдумывает (матрица очередей у платежей). */`
→ `кредит его не выдумывает (матрица разнесения у платежей). */`

`credit.html:6414` — в плитке слоя суда заменить

```
        Начисление на присуждённую долю кредит останавливает сам (сырьё — его), а разнесение платежа по слоям принимает готовым: очередь и привязка к исполнительному листу живут в модуле платежей.
```

на

```
        Состав слоя по траншам кредит выводит ЛЕСТНИЦЕЙ на дату акта (ADR-0060 §3): присуждённое покрывает взносы в порядке «самое раннее просроченное → дальше», пока не исчерпается; пропорция к телу отвергнута. Начисление на накрытые позиции кредит останавливает сам (сырьё — его) и очередь погашения публикует сам; разнесение платежа по слоям и привязку к исполнительному листу принимает готовыми от платежей.
```

- [ ] **Step 7: Проверить тексты grep-ами**

```bash
grep -c "ADR-0060" mockups/loan-credit/credit.html          # ожидается ≥ 5
grep -n "Очередь погашения'" mockups/loan-credit/credit.html # ожидается пусто: подпись поля переименована
grep -n "матрица очередей" mockups/loan-credit/credit.html   # ожидается пусто
grep -n "Д-10" mockups/loan-credit/credit.html               # ожидается ≥ 2 (демо-ограничения + buildQueue)
```

- [ ] **Step 8: Запустить смоук — правки текстов не должны ничего уронить**

Run: `node scripts/inspect/credit-check.mjs`
Expected: **101/101 PASS**. Внимание на `#53`: подпись поля «Очерёдность» меняет разметку вкладки «Расчёты», а условие на секцию очереди из Task 4 проверяет только вкладку «Платежи» — конфликта нет.

- [ ] **Step 9: Коммит**

```bash
git add mockups/loan-credit/credit.html
git commit -m "docs(credit): очерёдность против очереди погашения — тексты эталона под ADR-0060"
```

---

### Task 6: Внешние документы — КВ-18/КР-58, §12 платежей, P15-R24 → P15-R25

**Files:**
- Modify: `mockups/loan-credit/ASUBK-status-razrabotki.md` (таблица «Решения волны» `:30-53`, хвост файла `:794`)
- Modify: `mockups/payments/ASUBK-platezhi-logika.md` §12 (`:1057-1104`)
- Modify: `docs/tasks/p15-kredit-tasks.html:496` (карточка `P15-R24`) и следом новая карточка
- Modify: `TODO.md:1464` и следом новая запись
- Test: `python3 scripts/check_tasks.py docs/tasks/p15-kredit-tasks.html`

**Interfaces:**
- Consumes: результаты задач 1–5.
- Produces: `P15-R25` в двух местах (карточка + запись `TODO.md`) — идентификаторы обязаны совпадать 1:1, это и проверяет `check_tasks.py`.

- [ ] **Step 1: Добавить решение КВ-18**

В `mockups/loan-credit/ASUBK-status-razrabotki.md` в конец таблицы «Решения волны» (после строки `| КВ-17 | …`) дописать:

```markdown
| КВ-18 | **Очередь погашения публикуется кредитом** (ADR-0060 §3/§4). Лестница «самое раннее просроченное → дальше» одна на модуль, у неё два потребителя: `layersByLadder` метит позиции присуждённым на дату акта, `buildQueue` упорядочивает перечень непогашенного. Кредит отдаёт `d.queue` (транш · слой · статья · дата наступления · сумма) секцией на вкладке «Платежи»; платежи льют деньги по готовому списку и своей лестницы не строят. Допущение **Д-8** (доля под решением суда пропорционально телу) снято: пропорция занижала долю старого транша, у которого просрочки больше. Термины разведены — «очерёдность» это правило (поле `bc.queue` на «Расчётах»), «очередь погашения» это перечень на дату | ✅ ADR-0060 |
```

- [ ] **Step 2: Добавить дефект КР-58 со статусом «отложено»**

Туда же, в раздел `### Дефекты, оставшиеся открытыми` (`:376-384`), дописать строкой таблицы:

```markdown
| КР-58 | **Дни просрочки — число у кредита, а не величина слоя** (§6.7 спеки платежей, обещание волны 2 в `ASUBK-platezhi-logika.md` §12). `overdueDays` одно на кредит и кормит `riskBasisOf` → категорию риска (ADR-0012) и гейты. Довести §6.7 до конца значит переписать `riskBasisOf`, `overdueOf` и `buildStateFlags` — далеко за границей P15-R24, где очередь и снятие Д-8 сделаны 10.08.2026. **Отложено осознанно**, заведено задачей `P15-R25` (`state:'debt'`), чтобы не повторилась история самой P15-R24: ADR приняли, в бэклог не занесли, дыру нашли случайно пять дней спустя |
```

- [ ] **Step 3: Записать волну в конец файла**

В конец `ASUBK-status-razrabotki.md` дописать:

```markdown

---

## Что сделано волной 10.08.2026 — кредит публикует очередь погашения (P15-R24)

`ADR-0060` был принят 02.08.2026 — позже сборки бэклога P15 (26.07.2026) — и в макет
кредита не попал ни одной строкой: 0 вхождений «0060» в `credit.html`. Хуже того, шапка
макета утверждала обратное (открытый вопрос №4: «очередь принадлежит МОДУЛЮ ПЛАТЕЖЕЙ»),
а отвергнутое ADR-ом допущение Д-8 продолжало работать в `buildLedger`.

**Сделано.**

- **Одна лестница, два потребителя.** `ladderAt(c, date)` — непогашенные позиции в
  порядке «самое раннее просроченное → дальше», без пени и без слоёв: ею пользуются ДО
  того, как слой известен. `layersByLadder(c, asOf)` прогоняет её на дату каждого акта и
  метит позиции, пока присуждённое не исчерпается; одна позиция — ровно один слой.
- **Пропорция Д-8 снята.** `frozenShareAt` удалён. Строка берёт режим начисления у
  СВОЕГО слоя: статья замораживается целиком, пеня — за дни после СВОЕГО решения (прежде
  доля бралась на дату среза, а дни от ПЕРВОГО решения). У К-3 приостановленные проценты
  выросли с 686,25 до 7 900, приостановленная пеня — с 52,45 до 442,40: прежняя пропорция
  морозила по 9,15 % поздних позиций и не трогала ранние, то есть ровно наоборот. База
  пени при этом берётся ДО заморозки процентов — иначе у К-3, где пеня начисляется только
  на проценты, вместе с приостановленной статьёй исчезла бы и пеня за дни ДО решения,
  которую решение не отменяет.
- **Слой получил идентичность** (`L-1`, `L-2`… по возрастанию даты акта) и готовую
  подпись: справочника слоёв у кредита в модели нет, разворачивать `id` некому.
- **`derive()` публикует `d.queue`** — `{asOf, rows:[{due, layer, layerLabel, tranche,
  article, urg, amount, future}]}`. Сортировка одна: по дате наступления, внутри даты по
  очерёдности статей, внутри статьи по номеру транша. Нулевые строки не публикуются.
- **Секция «Очередь погашения»** на вкладке «Платежи», под сводом по статьям: сверху чем
  погашено, снизу что подлежит гашению — двусторонность ADR-0010 видна одним экраном.
  Пилюля зеркальная — `отдаётся в ПЛАТЕЖИ` против `публикует КРЕДИТ` у потребителя;
  `lockHtml()` не ставится, секция — собственный вывод кредита, а не зеркало.
- **Термины разведены** по `CONTEXT.md`: поле `bc.queue` на «Расчётах» переименовано в
  «Очерёдность», имя «очередь погашения» освободилось под перечень.

**Проверено** 2026-08-10: `node scripts/inspect/credit-check.mjs` — **101/101 PASS**.
Новые проверки: **#97** (очередь публикуется у всех 59 кредитов, Σ строк `urg:'over'`
сходится с `d.overdueAmount` копейка в копейку — разойдись они, значит лестница и
`debtOf` разъехались молча), **#98** (слой K-3 накрывает первые две позиции, а не долю
каждой), **#99** (даты не убывают, ненаступившее хвостом, комиссия идёт «по кредиту»).
Проверка **#53** дополнена условием, что секция очереди есть на «Платежах» каждого
кредита.

**Не делали.** §6.7 спеки платежей («дни просрочки принадлежат слою») — отложено, см.
**КР-58** и задачу **P15-R25**. `payments.html` не трогали: демо-наборы не пересекаются
(`C-112`/`C-56` против `K-*`), чтение очереди на стороне потребителя — задача P15-R17.
```

- [ ] **Step 4: Закрыть обещание в §12 спеки платежей**

В `mockups/payments/ASUBK-platezhi-logika.md` §12 (`:1057-1104`) найти перечень правок
волны 2 и отметить исполненными два пункта — «кредит начинает публиковать очередь» и
«допущение Д-8 отменяется», — а пункт про §6.7 пометить отложенным. Формулировка
(вставляется как абзац в конце §12):

```markdown
> **Исполнено 10.08.2026 в `mockups/loan-credit/credit.html`** (задача P15-R24, волна
> «кредит публикует очередь погашения»): кредит публикует `d.queue` — упорядоченный на
> дату перечень непогашенного (транш · слой · статья · дата наступления · сумма), секция
> «Очередь погашения» на вкладке «Платежи»; допущение **Д-8** (доля под решением суда
> пропорционально телу) снято — состав слоя выводится лестницей `ADR-0060 §3` на дату
> акта. **Не исполнено:** «дни просрочки перестают быть числом у кредита — величина
> принадлежит слою» (§6.7). `overdueDays` в макете кредита по-прежнему одно число и
> кормит категорию риска; отложено осознанно, заведено как **КР-58** в
> `mockups/loan-credit/ASUBK-status-razrabotki.md` и задачей **P15-R25** в
> `docs/tasks/p15-kredit-tasks.html`.
```

Точное место вставки найти командой:

```bash
grep -n "публиков\|Д-8\|6\.7" mockups/payments/ASUBK-platezhi-logika.md | sed -n '1,40p'
```

- [ ] **Step 5: Перевести P15-R24 в `state:'mock'` и завести P15-R25**

В `docs/tasks/p15-kredit-tasks.html` в карточке `P15-R24` (`:496`) заменить `state:'open'`
на `state:'mock'` (значение означает «Есть эталон в макете», `STATE_META` `:516-520`).

Сразу за закрывающей скобкой карточки `P15-R24` (перед `];`) добавить:

```js
{ id:'P15-R25', step:'Шаг 25', prio:'minor', theme:'ops', state:'debt',
  title:'Дни просрочки — число у кредита, а не величина слоя (§6.7 спеки платежей)',
  pain:'Спека платежей <code>mockups/payments/ASUBK-platezhi-logika.md</code> §6.7 объявляет: просрочка считается ПО СЛОЮ — у каждого слоя долга свои дни, потому что решение суда останавливает начисление на свою часть и с своей даты. В макете кредита <code>overdueDays</code> — одно число на кредит: <code>overdueOf(ledger)</code> берёт самую раннюю непогашенную позицию и меряет от неё. Это число кормит <code>riskBasisOf</code> → категорию риска (<b>ADR-0012</b>), пилюлю ЖЦ и гейты. Пока слой был долей от тела, вопроса не возникало; с волны 10.08.2026 (P15-R24) у каждой позиции есть СВОЙ слой со своей датой акта и своим режимом — и «95 дней просрочки по кредиту» стало сводкой двух разных величин.',
  todo:['Развести дни просрочки по слоям: у каждого слоя своя дата отсчёта (дата акта) и свой режим начисления; свободный слой считается от даты наступления позиции.',
        'Решить, ЧТО идёт на вход категории риска (<b>ADR-0012</b>): максимум по слоям, дни свободного слоя или взвешенная величина — сегодня вход один и другого не предусмотрено.',
        'Пересобрать <code>overdueOf</code>, <code>riskBasisOf</code> и <code>buildStateFlags</code> под многозначную просрочку; в эталоне они написаны от одного числа.',
        'Свести с механикой спорной пени (§4.4): спорные дни уже исключаются из входа категории, и второе измерение обязано с ней сойтись, а не завести вторую трактовку.'],
  deps:['P15-R24'],
  dev:['<b>Технический долг, отложенный осознанно.</b> Заведён 10.08.2026 при закрытии P15-R24: очередь и снятие Д-8 сделаны, §6.7 — нет. Записан также как КР-58 в <code>mockups/loan-credit/ASUBK-status-razrabotki.md</code>.',
       'Причина отсрочки: §6.7 переписывает вход категории риска, то есть трогает ADR-0012 и гейты, — это отдельная задача, а не хвост публикации очереди.',
       'Спека: <code>mockups/payments/ASUBK-platezhi-logika.md</code> §6.7 и §12. ADR: <code>docs/adr/0060-transh-schet-oblast-ochered.md</code>, <code>docs/adr/0057-matrica-po-nastupivshemu-prosrochka-po-sloyu.md</code>.'] },
```

Заодно поправить два счётчика в шапке файла: `:8-9` (`задачи P15-R1…P15-R24`) и `:153`
(«24 задачи») — станет `P15-R1…P15-R25` и «25 задач».

- [ ] **Step 6: Проверить валидатор задач**

Run: `python3 scripts/check_tasks.py docs/tasks/p15-kredit-tasks.html`
Expected: без ошибок (валидатор молчит либо печатает «OK»); ненулевой код возврата означает расхождение ID между карточкой и `TODO.md` — тогда сначала Step 7, потом повтор.

- [ ] **Step 7: Записать P15-R24 закрытой и завести P15-R25 в `TODO.md`**

В `TODO.md` отметить `P15-R24` выполненной (`- [x]`) с пометкой о волне и дописать следом:

```markdown
- [ ] P15-R25 🟡 Дни просрочки — число у кредита, а не величина слоя (§6.7 спеки платежей)
  - **Технический долг, отложенный осознанно** при закрытии P15-R24 (10.08.2026). Спека платежей §6.7 объявляет: просрочка считается ПО СЛОЮ — у каждого слоя своя дата отсчёта и свой режим. В макете кредита `overdueDays` — одно число на кредит, и оно кормит `riskBasisOf` → категорию риска (ADR-0012), пилюлю ЖЦ и гейты. Пока слой был долей от тела, вопроса не возникало; с волны 10.08.2026 у каждой позиции есть свой слой со своей датой акта.
  - **Сделать:**
    - развести дни просрочки по слоям: дата отсчёта слоя — дата акта, у свободного слоя — дата наступления позиции;
    - решить, что идёт на вход категории риска (ADR-0012): максимум по слоям, дни свободного слоя или взвешенная величина;
    - пересобрать `overdueOf`, `riskBasisOf` и `buildStateFlags` под многозначную просрочку;
    - свести с механикой спорной пени (§4.4) — спорные дни уже исключаются из входа категории.
  - Зависимости: P15-R24. Дефект в макете — КР-58 (`mockups/loan-credit/ASUBK-status-razrabotki.md`).
```

Правка `TODO.md` инструментом Claude Code запустит хук `scripts/todo_hook.py` и выгрузку в Google Sheet — это ожидаемо; Sheet руками не трогать.

- [ ] **Step 8: Финальная проверка**

```bash
node scripts/inspect/credit-check.mjs          # 101/101 PASS
python3 scripts/check_tasks.py                 # все файлы с JSON-островом
git status --short                             # только ожидаемые файлы
```

- [ ] **Step 9: Коммит**

```bash
git add mockups/loan-credit/ASUBK-status-razrabotki.md mockups/payments/ASUBK-platezhi-logika.md \
        docs/tasks/p15-kredit-tasks.html TODO.md mockups/loan-credit/credit.html
git commit -m "docs(credit): P15-R24 закрыта, §6.7 вынесен в P15-R25 — КВ-18, КР-58"
```

---

## Порядок и зависимости

```
Task 1 (лестница + id слоя)
   └─ Task 2 (buildLedger по слою строки)
         └─ Task 3 (buildQueue + derive)
               └─ Task 4 (секция на «Платежах»)
Task 5 (тексты)  — после Task 4, чтобы правки текста не смешивались с правками логики
Task 6 (внешние документы) — последняя: описывает уже сделанное
```

Задачи 1→4 строго последовательны: каждая следующая читает то, что произвела предыдущая.
Задачи 5 и 6 переставлять между собой нельзя — §12 спеки платежей и запись волны
ссылаются на итоговые формулировки шапки.

## Что НЕ входит в работу

- **§6.7 спеки платежей** — дни просрочки по слоям. Отложено осознанно, заведено как
  КР-58 и P15-R25 (Task 6). Трогать `overdueOf`, `riskBasisOf`, `buildStateFlags` в этой
  работе нельзя: они кормят категорию риска, и правка уронит смоук в части риска.
- **`mockups/payments/payments.html`** — чтение очереди потребителем. Это задача P15-R17;
  демо-наборы двух макетов не пересекаются, соединять их нечем.
- **`CONTEXT.md`** — термины уже разведены верно (`:241-257`), правок не требуется.
- **`docs/adr/`** — новых модельных решений не принимается, реализуется принятое
  `ADR-0060`.
