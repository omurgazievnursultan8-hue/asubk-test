# Единый переключатель области карточки кредита (КВ-17) — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Схлопнуть три пересекающихся контрола области просмотра карточки кредита
(`condScope`, `detailTrancheNo`, чекбокс `calcConsolidated`) в один переключатель
«Область» в шапке карточки, рядом с датой среза.

**Architecture:** Одна переменная `cardScope` (`'credit'` | номер транша) в замыкании
карточки и один хелпер `scopeTranche(c)`, отдающий транш или `null`. Пять вкладок
(Условия · Транши · График · Прогноз · Расчёты) читают её вместо трёх прежних
переменных; шесть остальных её не читают и гасят контрол. «График» и «Прогноз» при
области «по кредиту» получают слитую по траншам таблицу с колонкой «Транш» — идиома,
уже написанная в макете для консолидированного расчёта.

**Tech Stack:** Один самодостаточный HTML-файл (`mockups/loan-credit/credit.html`,
7392 строки, ванильный JS без сборки). Тесты — Node + jsdom через шов `window.CR`,
по образцу `mockups/collateral/tests/`.

## Global Constraints

- **Спека:** `docs/superpowers/specs/2026-08-04-credit-scope-switcher-design.md`. Все
  формулировки пользовательских строк берутся оттуда дословно.
- **Файл правки один:** `mockups/loan-credit/credit.html`. Модель кредита, `derive()`,
  `buildSchedule()`, реестр и остальные мокапы — не трогаем.
- **Ничего не хранится (Р-11).** Область — состояние экрана, в модель кредита не пишется.
- **Дата среза `cardAsOf` не трогается.** Смена области не сбрасывает дату, смена даты
  не сбрасывает область.
- **Модалки свои селекты транша сохраняют** — там транш это параметр действия.
- **Единица учёта — транш (Р-1).** График принадлежит траншу; агрегата у построения
  графика не бывает.
- **`npm test` в этом репо — Playwright по live-стенду, к мокапу отношения не имеет.**
  Тесты этого плана запускаются отдельным скриптом `npm run test:credit`.
- **Комментарии в коде — по-русски**, как весь файл; при каждой правке ссылаться на
  КВ-17 так же, как соседние правки ссылаются на КВ-10 / КР-29.
- **jsdom требует `url` в опциях** — без него `openDetail` падает с `DOMException`
  на `history.replaceState`.

---

## Структура файлов

| файл | что делает |
|---|---|
| `mockups/loan-credit/tests/harness.mjs` | **создать.** Загрузка `credit.html` в jsdom, шов `window.CR`, ассерты. Копия по форме с `mockups/collateral/tests/harness.mjs` — свой файл, а не импорт: тот жёстко читает `zalog.html` и шов `__zt` на верхнем уровне модуля, и импорт ради ассертов тянул бы чужой мокап в память. |
| `mockups/loan-credit/tests/scope.test.mjs` | **создать.** Все тесты КВ-17. |
| `mockups/loan-credit/credit.html` | **править.** Состояние карточки, `headerHtml()`, пять вкладок, четыре модалки. |
| `package.json` | **править.** Скрипт `test:credit`. |
| `mockups/loan-credit/ASUBK-status-razrabotki.md` | **править.** Запись КВ-17 в журнал решений. |

## Порядок задач

Задачи упорядочены так, чтобы макет оставался работоспособным после каждой. Область
«по кредиту» появляется на «Графике» и «Прогнозе» (задачи 3–4) **раньше**, чем
переключатель переезжает в шапку (задача 5) — иначе между задачами существовало бы
состояние, в котором шапка позволяет выбрать «по кредиту», а вкладка это не умеет.

---

### Task 1: Тестовая обвязка мокапа кредита

Поведение не меняется. Задача ставит опору, на которой стоят все следующие.

**Files:**
- Create: `mockups/loan-credit/tests/harness.mjs`
- Create: `mockups/loan-credit/tests/scope.test.mjs`
- Modify: `package.json` (блок `scripts`)

**Interfaces:**
- Consumes: `window.CR` — шов, объявленный в `credit.html:4696`.
- Produces:
  - `load()` → `{ dom, win, CR }` — свежий jsdom на каждый вызов.
  - `test(name, fn)`, `ok(v,msg)`, `no(v,msg)`, `eq(a,b,msg)`, `has(hay,needle,msg)`,
    `hasNot(hay,needle,msg)`, `report()` — ассерты, `report()` завершает процесс
    кодом 1 при провале.
  - `multiCredit(CR)` → кредит `K-C40` с освоенным траншем №2 и построенными
    графиками на обоих траншах. Единственная многотраншевая фикстура с двумя
    графиками: в сиде таких нет ни одного.

- [ ] **Step 1: Создать harness**

Файл `mockups/loan-credit/tests/harness.mjs`:

```js
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const HERE = dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(join(HERE, '..', 'credit.html'), 'utf8');

/* Свежий DOM на каждый тест → изоляция: тесты мутируют CR.db (освоения, графики).
   url обязателен — без него openDetail падает с DOMException на history.replaceState. */
export function load() {
  const dom = new JSDOM(HTML, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://mockup.test/credit.html',
    beforeParse(window) {
      window.matchMedia = window.matchMedia || (() => ({ matches:false, media:'', onchange:null,
        addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){}, dispatchEvent(){return false;} }));
      window.scrollTo = window.scrollTo || (()=>{});
    }
  });
  const win = dom.window;
  if (!win.CR) throw new Error('window.CR seam missing — скрипт не выполнился или шов отсутствует');
  if (!win.CR.db) throw new Error('CR.db пуст — сид не отработал');
  return { dom, win, CR: win.CR };
}

/* Единственная фикстура с ДВУМЯ построенными графиками. В сиде многотраншевых
   кредитов три (K-1, K-C40, K-C41) и ни у одного нет графика ни на одном транше;
   у K-C40 вдобавок расходится метод погашения (аннуитет | равными долями) —
   ровно случай «несколько методов погашения» из спеки. */
export function multiCredit(CR) {
  const c = CR.db.credits.find(x => x.id === 'K-C40');
  if (!c) throw new Error('фикстура K-C40 исчезла из сида');
  CR.addDisbursement(c, { trancheNo: 2, amount: c.tranches[1].amount, date: '01.03.2026' });
  CR.generateSchedule(c, 1, { from: '15.02.2026' });
  CR.generateSchedule(c, 2, { from: '01.03.2026' });
  return c;
}

let passed = 0, failed = 0; const fails = [];
export function test(name, fn){ try { fn(); passed++; } catch(e){ failed++; fails.push(`  ✗ ${name}\n    ${e.message}`); } }
export function eq(a,b,msg){ if(a!==b) throw new Error(`${msg||'eq'}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
export function ok(v,msg){ if(!v) throw new Error(msg||'expected truthy'); }
export function no(v,msg){ if(v) throw new Error(msg||'expected falsy'); }
export function has(hay,needle,msg){ if(!String(hay).includes(needle)) throw new Error(`${msg||'has'}: "${needle}" not found`); }
export function hasNot(hay,needle,msg){ if(String(hay).includes(needle)) throw new Error(`${msg||'hasNot'}: "${needle}" unexpectedly present`); }
export function report(){ console.log(`\n${passed} passed, ${failed} failed`); fails.forEach(f=>console.log(f)); if(failed) process.exit(1); }
```

- [ ] **Step 2: Написать падающий тест — шов и фикстура**

Файл `mockups/loan-credit/tests/scope.test.mjs`:

```js
import { load, multiCredit, test, ok, no, eq, has, hasNot, report } from './harness.mjs';

test('S0: файл грузится, шов CR доступен, сид отработал', () => {
  const { CR } = load();
  ok(typeof CR.renderTab === 'function', 'CR.renderTab не в шве');
  ok(CR.db.credits.length === 59, 'ожидалось 59 демо-кредитов, стало ' + CR.db.credits.length);
});

test('S1: фикстура K-C40 даёт два графика и расхождение метода', () => {
  const { CR } = load();
  const c = multiCredit(CR);
  eq(c.tranches.length, 2, 'K-C40 должен быть двухтраншевым');
  eq(c.tranches.filter(t => (t.schedules||[]).some(s => s.active)).length, 2,
     'оба транша должны получить активную версию графика');
  const methods = c.tranches.map(t => CR.conditionsAt(t, CR.TODAY).method);
  ok(methods[0] !== methods[1], 'методы траншей должны расходиться, стало: ' + methods.join(' | '));
});

test('S2: cardScope ещё не существует — три переменные на месте', () => {
  const { CR } = load();
  const c = multiCredit(CR);
  CR.openDetail('K-C40');
  has(CR.renderTab('Условия', c), 'setCondScope', 'до правки «Условия» должны звать setCondScope');
  has(CR.renderTab('Расчёты', c), 'setCalcMode', 'до правки «Расчёты» должны звать setCalcMode');
});

report();
```

- [ ] **Step 3: Прописать скрипт запуска**

В `package.json`, блок `scripts`, рядом с `test:zalog`:

```json
"test:credit": "node mockups/loan-credit/tests/scope.test.mjs",
```

- [ ] **Step 4: Запустить — все три должны пройти**

Run: `npm run test:credit`
Expected: `3 passed, 0 failed`

Если S0 падает с `window.CR seam missing` — скрипт мокапа не выполнился в jsdom;
проверить, что `runScripts: 'dangerously'` на месте. Если S2 падает — правка уже
частично сделана, задача 2 выполнена раньше времени.

- [ ] **Step 5: Коммит**

```bash
git add mockups/loan-credit/tests/harness.mjs mockups/loan-credit/tests/scope.test.mjs package.json
git commit -m "test(credit): обвязка jsdom для мокапа кредита + фикстура двух графиков"
```

---

### Task 2: Одна переменная `cardScope` вместо трёх

Контролы остаются на местах, где стояли. Меняется только то, **что** они пишут и
читают. Наблюдаемое изменение одно: выбор транша на «Графике» теперь виден на
«Условиях» и наоборот — вкладки перестают расходиться.

**Files:**
- Modify: `mockups/loan-credit/credit.html:5182-5185` (сброс при открытии карточки)
- Modify: `mockups/loan-credit/credit.html:5272-5274` (объявления)
- Modify: `mockups/loan-credit/credit.html:5728-5764` (чтения `condScope` в «Условиях»)
- Modify: `mockups/loan-credit/credit.html:5783-5787` (селект «Условий»)
- Modify: `mockups/loan-credit/credit.html:5857` (гард блока расхождений)
- Modify: `mockups/loan-credit/credit.html:5974, 5984` («Транши»)
- Modify: `mockups/loan-credit/credit.html:6031, 6073, 6117` (`sel` на График/Прогноз/Расчёты)
- Modify: `mockups/loan-credit/credit.html:6158, 6162, 6173, 6175-6176, 6191, 6197` («Расчёты», `calcConsolidated`)
- Modify: `mockups/loan-credit/credit.html:6628-6629, 6646` (`CR.*` сеттеры)
- Test: `mockups/loan-credit/tests/scope.test.mjs`

**Interfaces:**
- Consumes: `activeTranche(t)` (`credit.html:3893`), `conditionsAt(t, date)`,
  `creditConditionsAt(c, date)`, `divergenceRows(c, date)`.
- Produces:
  - `let cardScope` — `'credit'` | `number`, в замыкании карточки.
  - `function scopeTranche(c)` → объект транша или `null`.
  - `CR.setCardScope(v)` — `v` это `'credit'` либо номер транша (строка или число).
  - `CR.selectDetailTranche`, `CR.setCondScope`, `CR.setCalcMode` — **удаляются**.

- [ ] **Step 1: Написать падающие тесты**

Дописать в `mockups/loan-credit/tests/scope.test.mjs` перед `report()`, и **удалить
тест S2** — он проверял снятое состояние:

```js
test('T2-1: сеттер один — setCardScope; трёх прежних нет', () => {
  const { CR } = load();
  ok(typeof CR.setCardScope === 'function', 'CR.setCardScope отсутствует');
  eq(typeof CR.selectDetailTranche, 'undefined', 'CR.selectDetailTranche должен быть удалён');
  eq(typeof CR.setCondScope, 'undefined', 'CR.setCondScope должен быть удалён');
  eq(typeof CR.setCalcMode, 'undefined', 'CR.setCalcMode должен быть удалён');
});

test('T2-2: область общая — выбор транша виден на всех пяти вкладках', () => {
  const { CR } = load();
  const c = multiCredit(CR);
  CR.openDetail('K-C40');
  CR.setCardScope(2);
  has(CR.renderTab('График', c),  'транш №2', '«График» не увидел область');
  has(CR.renderTab('Прогноз', c), 'транш №2', '«Прогноз» не увидел область');
  has(CR.renderTab('Расчёты', c), 'транш №2', '«Расчёты» не увидели область');
});

test('T2-3: «Расчёты» — область «по кредиту» даёт консолидированный вид без чекбокса', () => {
  const { CR } = load();
  const c = multiCredit(CR);
  CR.openDetail('K-C40');
  CR.setCardScope('credit');
  const h = CR.renderTab('Расчёты', c);
  has(h, 'консолидировано', 'заголовок расчёта должен сказать «консолидировано»');
  hasNot(h, 'retro-toggle', 'чекбокс «консолидировано по кредиту» должен исчезнуть');
});

test('T2-4: «Условия» — агрегат и расхождения только при области «по кредиту»', () => {
  const { CR } = load();
  const c = multiCredit(CR);
  CR.openDetail('K-C40');
  CR.setCardScope('credit');
  has(CR.renderTab('Условия', c), 'Расхождения по траншам', 'при агрегате блок расхождений обязан быть');
  CR.setCardScope(2);
  hasNot(CR.renderTab('Условия', c), 'Расхождения по траншам', 'на транше блок расхождений не показывается');
});

test('T2-5: кредит с одним траншем — область всегда разрешается в транш №1', () => {
  const { CR } = load();
  const c = CR.db.credits.find(x => x.id === 'K-3');
  eq(c.tranches.length, 1, 'фикстура K-3 должна быть однотраншевой');
  CR.openDetail('K-3');
  CR.setCardScope('credit');
  has(CR.renderTab('График', c), 'транш №1', 'при одном транше «по кредиту» обязано дать транш №1');
});

test('T2-6: сброс при открытии карточки — область возвращается в «по кредиту»', () => {
  const { CR } = load();
  const c = multiCredit(CR);
  CR.openDetail('K-C40');
  CR.setCardScope(2);
  CR.backToList();
  CR.openDetail('K-C40');
  has(CR.renderTab('Расчёты', c), 'консолидировано', 'при повторном входе область должна быть «по кредиту»');
});
```

- [ ] **Step 2: Запустить — должны падать**

Run: `npm run test:credit`
Expected: FAIL — `T2-1` роняет `CR.setCardScope отсутствует`, остальные T2-* падают
следом на том же вызове.

- [ ] **Step 3: Объявить переменную и хелпер**

В `credit.html:5272-5274` заменить три объявления:

```js
  let detailId = null, detailTab = 'Договор', detailTrancheNo = 1;
  let calcConsolidated = false;
  let condScope = 'credit';         // 'credit' | номер транша — область просмотра условий (Д-7)
```

на одно:

```js
  let detailId = null, detailTab = 'Договор';
  /* ЕДИНАЯ ОБЛАСТЬ ПРОСМОТРА карточки (КВ-17). Были три переменные: detailTrancheNo
     (Транши/График/Прогноз/Расчёты), condScope (Условия) и calcConsolidated (чекбокс
     «консолидировано» на «Расчётах» — тот же смысл третьим типом контрола). Область —
     второй параметр среза рядом с cardAsOf, и по той же причине, что КВ-10 свёл дату
     (КР-29), она одна на карточку целиком. */
  let cardScope = 'credit';         // 'credit' | номер транша
```

Сразу под объявлением `currentCredit()` (`credit.html:5296`) добавить хелпер:

```js
  /* Транш, к которому относится вкладка. При области «по кредиту» — null (агрегат/сводка).
     Кредит с одним траншем: «по кредиту» и «Транш №1» неразличимы, поэтому транш отдаётся
     всегда — иначе однотраншевый кредит без нужды уходил бы в агрегатную ветку. */
  function scopeTranche(c){
    if (c.tranches.length === 1) return c.tranches[0];
    return cardScope === 'credit' ? null : (c.tranches.find(t => t.no === cardScope) || null);
  }
```

- [ ] **Step 4: Перевести сброс при открытии карточки**

В `credit.html:5185` в строке сброса заменить `condScope = 'credit';` на
`cardScope = 'credit';` и удалить из той же строки `calcConsolidated = false;`
(строка 5184) и `detailTrancheNo = ...` (строка 5183) — присваивание
`detailTrancheNo = (c.tranches[0] && c.tranches[0].no) || 1;` уходит целиком.

- [ ] **Step 5: Перевести «Условия»**

В `credit.html:5728, 5749, 5760` — три одинаковых гарда `if (condScope!=='credit'){`
и следующая за каждым строка `const t=c.tranches.find(x=>x.no===condScope)||c.tranches[0];`
заменяются на одну форму:

```js
      const st = scopeTranche(c);
      if (st){
        // ... тело как было, но вместо переменной t используется st
```

Гард блока расхождений `credit.html:5857`:

```js
          if (condScope!=='credit' || c.tranches.length<=1) return '';
```

становится:

```js
          if (scopeTranche(c) || c.tranches.length<=1) return '';
```

Селект `credit.html:5783-5787` — `onchange` и `selected` переводятся на новое имя,
разметка не меняется:

```js
        ${c.tranches.length>1?`<div class="control" style="max-width:280px"><select onchange="CR.setCardScope(this.value)">
            <option value="credit"${cardScope==='credit'?' selected':''}>по кредиту (агрегат)</option>
            ${c.tranches.map(t=>`<option value="${t.no}"${cardScope===t.no?' selected':''}>Транш №${t.no}</option>`).join('')}
          </select><span class="caret">▾</span></div>`:''}
```

- [ ] **Step 6: Перевести «Транши»**

`credit.html:5974`:

```js
    const sel=scopeTranche(c);
```

`credit.html:5984` — обработчик строки:

```js
      return `<tr style="cursor:pointer${on?';background:var(--asubk-nav-active)':''}${t.closed?';opacity:.6':''}" onclick="CR.setCardScope(${t.no})">
```

Выражение `on` (`credit.html:5977`) уже написано как `sel&&t.no===sel.no` и при
`sel === null` честно даёт «ни одна строка не подсвечена» — правки не требует.

- [ ] **Step 7: Перевести «График» и «Прогноз» (временный откат на транш)**

В `credit.html:6031` и `credit.html:6073` заменить

```js
    const sel=c.tranches.find(t=>t.no===detailTrancheNo)||c.tranches[0];
```

на

```js
    /* КВ-17, временно: слитый вид при области «по кредиту» приходит задачами 3 и 4;
       до тех пор вкладка откатывается на первый транш. */
    const sel=scopeTranche(c)||c.tranches[0];
```

Селекты на этих вкладках (`credit.html:6046`, `credit.html:6099`) переводятся на
`CR.setCardScope`, вариант «по кредиту» **пока не добавляется**:

```js
<select onchange="CR.setCardScope(+this.value)">${c.tranches.map(t=>`<option value="${t.no}"${sel&&t.no===sel.no?' selected':''}>Транш №${t.no}</option>`).join('')}</select>
```

- [ ] **Step 8: Перевести «Расчёты» и снять чекбокс**

`credit.html:6117`:

```js
    const sel=scopeTranche(c);
```

`credit.html:6158` — источник строк инвертируется естественно:

```js
    const ledSrc = sel ? d.ledger.rows.filter(r=>r.trancheNo===sel.no) : d.ledger.rows;
```

Во всех оставшихся местах `calcConsolidated` заменяется на `!sel`:
`credit.html:6162` (`${!sel?`<td>№${l.trancheNo}</td>`:''}`),
`credit.html:6173` (`const nCols = !sel?17:16;`),
`credit.html:6175` (`colspan="${!sel?3:2}"`),
`credit.html:6176` (`${!sel?'<th>Транш</th>':''}`),
`credit.html:6191` (`${!sel?'(консолидировано)':'(транш №'+sel.no+')'}` — обратите
внимание: прежнее `(sel?sel.no:'—')` больше не нужно, в этой ветке `sel` заведомо не
пуст).

Селект `credit.html:6196` получает вариант «по кредиту» — «Расчёты» его и так умели,
просто вторым контролом:

```js
        <div class="field" style="max-width:320px"><span class="flabel">Область</span><div class="control"><select onchange="CR.setCardScope(this.value)">
          <option value="credit"${cardScope==='credit'?' selected':''}>по кредиту (консолидировано)</option>
          ${c.tranches.map(t=>`<option value="${t.no}"${cardScope===t.no?' selected':''}>Транш №${t.no}</option>`).join('')}
        </select><span class="caret">▾</span></div></div>
```

Строка `credit.html:6197` с `retro-toggle` и текстом «консолидировано по кредиту»
удаляется целиком.

Ещё одно чтение — `credit.html:6200`, `esc(sel ? conditionsAt(sel, cardAsOf).dayMethod : bc.dayMethod)`
— уже написано с проверкой на пустой `sel` и правки не требует.

- [ ] **Step 9: Заменить сеттеры в шве**

`credit.html:6628-6629` и `credit.html:6646` — три функции удаляются, вместо них одна:

```js
  /* КВ-17: единственная точка смены области. 'credit' приходит строкой из <select>,
     номер транша — строкой или числом, поэтому нормализуем здесь, а не у вызывающих. */
  CR.setCardScope=function(v){ cardScope = (v==='credit' ? 'credit' : +v); rerenderDetail(); };
```

- [ ] **Step 10: Починить оставшиеся упоминания в модалках**

`detailTrancheNo` остаётся ещё в пяти местах модалок — `credit.html:6015, 6017, 6692,
6707, 6711, 6721, 6737, 6885, 7164`. Во всех предвыбор и подстановка переводятся на
одну форму: `(scopeTranche(c) || c.tranches[0] || {}).no`, а присваивания вида
`detailTrancheNo=no;` — на `cardScope=no;`.

Проверить, что живых упоминаний не осталось:

Run: `grep -n "detailTrancheNo\|condScope\|calcConsolidated" mockups/loan-credit/credit.html`
Expected: только строки комментариев-историй в шапке файла (строки 1–470), ни одного
исполняемого упоминания.

- [ ] **Step 11: Запустить тесты**

Run: `npm run test:credit`
Expected: `8 passed, 0 failed`

- [ ] **Step 12: Коммит**

```bash
git add mockups/loan-credit/credit.html mockups/loan-credit/tests/scope.test.mjs
git commit -m "refactor(credit): три переменные области — в одну cardScope (КВ-17)"
```

---

### Task 3: «График» — слитый вид при области «по кредиту»

**Files:**
- Modify: `mockups/loan-credit/credit.html:6028-6060` (`tabGrafik`)
- Test: `mockups/loan-credit/tests/scope.test.mjs`

**Interfaces:**
- Consumes: `scopeTranche(c)`, `trancheScheduleRows(t)` (`credit.html:3191`),
  `trancheScheduleTotals(t, asOf)` (`credit.html:3871`, возвращает
  `{count, principalSum, interestSum, total, method, payLabel, payValue}`),
  `scheduleRowStatus(row, ledgerRow, asOf)`, `ledgerKey(trancheNo, rowNo)`,
  `pd(dateStr)` — парсер `DD.MM.YYYY`, `activeTranche(t)`, `disabledBtn(label, reason, cls)`.
- Produces: `function scheduleTotalsAll(c, asOf)` → тот же объект, что
  `trancheScheduleTotals`, но просуммированный по траншам; при расхождении методов
  `method` = `null`, `payLabel` = `'Регулярный платёж'`, `payValue` = `'—'`.

- [ ] **Step 1: Написать падающие тесты**

Дописать в `scope.test.mjs` перед `report()`:

```js
test('T3-1: «График» при «по кредиту» — слитая таблица с колонкой «Транш»', () => {
  const { CR } = load();
  const c = multiCredit(CR);
  CR.openDetail('K-C40');
  CR.setCardScope('credit');
  const h = CR.renderTab('График', c);
  has(h, '>Транш<', 'в шапке таблицы позиций должна появиться колонка «Транш»');
  has(h, 'по кредиту', 'заголовки секций должны сказать «по кредиту», а не «транш №N»');
  hasNot(h, 'транш №1)', 'заголовок не должен называть один транш');
});

test('T3-2: слитая таблица содержит позиции ОБОИХ траншей', () => {
  const { CR } = load();
  const c = multiCredit(CR);
  CR.openDetail('K-C40');
  const rowsAt = scope => { CR.setCardScope(scope); return (CR.renderTab('График', c).match(/<tr/g) || []).length; };
  const n1 = rowsAt(1), n2 = rowsAt(2), nAll = rowsAt('credit');
  ok(nAll > n1 && nAll > n2, `слитая (${nAll}) должна быть длиннее каждой отдельной (${n1}/${n2})`);
});

test('T3-3: плитки — суммы по траншам', () => {
  const { CR } = load();
  const c = multiCredit(CR);
  CR.openDetail('K-C40');
  const t1 = CR.trancheScheduleRows(c.tranches[0]).length;
  const t2 = CR.trancheScheduleRows(c.tranches[1]).length;
  CR.setCardScope('credit');
  has(CR.renderTab('График', c), '>' + (t1 + t2) + '<', `плитка «Платежей в графике» должна показать ${t1+t2}`);
});

test('T3-4: расхождение методов — плитка платежа гасится подписью', () => {
  const { CR } = load();
  const c = multiCredit(CR);
  CR.openDetail('K-C40');
  CR.setCardScope('credit');
  has(CR.renderTab('График', c), 'несколько методов погашения',
      'при разных методах траншей плитка платежа обязана это сказать');
});

test('T3-5: «Сформировать график» при «по кредиту» неактивна', () => {
  const { CR } = load();
  const c = multiCredit(CR);
  CR.openDetail('K-C40');
  CR.setCardScope('credit');
  has(CR.renderTab('График', c), 'График принадлежит траншу — выберите транш в шапке',
      'кнопка построения должна быть погашена с этой причиной');
  CR.setCardScope(1);
  hasNot(CR.renderTab('График', c), 'График принадлежит траншу — выберите транш в шапке',
      'на конкретном транше кнопка обязана ожить');
});

test('T3-6: однотраншевый кредит слитого вида не получает', () => {
  const { CR } = load();
  const c = CR.db.credits.find(x => x.id === 'K-3');
  CR.openDetail('K-3');
  CR.setCardScope('credit');
  const h = CR.renderTab('График', c);
  has(h, 'транш №1', 'при одном транше вкладка обязана остаться обычной');
  hasNot(h, 'несколько методов погашения', 'расхождению не с чем возникать');
});
```

- [ ] **Step 2: Запустить — должны падать**

Run: `npm run test:credit`
Expected: FAIL, 6 провалов T3-*, первый — `в шапке таблицы позиций должна появиться колонка «Транш»`.

- [ ] **Step 3: Добавить агрегатор итогов**

Рядом с `trancheScheduleTotals` (после `credit.html:3890`):

```js
/* Итоги графика по ВСЕМ траншам — плитки вкладки «График» при области «по кредиту»
   (КВ-17). Складываются только аддитивные величины. Метод погашения аддитивным не
   является: медиана аннуитета и первый-последний платёж равных долей — величины
   разной природы, и их сумма не платится никем. Разошлись — гасим значение. */
function scheduleTotalsAll(credit, asOf){
  const ts = credit.tranches.filter(activeTranche);
  const parts = ts.map(t => trancheScheduleTotals(t, asOf));
  const sum = k => round2(parts.reduce((a,p) => a + p[k], 0));
  const methods = [...new Set(parts.map(p => p.method))];
  const one = methods.length === 1 ? parts[0] : null;
  return { count: parts.reduce((a,p) => a + p.count, 0),
           principalSum: sum('principalSum'), interestSum: sum('interestSum'), total: sum('total'),
           method: one ? one.method : null,
           payLabel: one ? one.payLabel : 'Регулярный платёж',
           payValue: one ? one.payValue : '—' };
}
```

- [ ] **Step 4: Перевести вкладку на две ветки**

В `tabGrafik` (`credit.html:6029`) снять временный откат задачи 2 и развести ветки:

```js
  function tabGrafik(c,d){
    const sel=scopeTranche(c);                        // null → область «по кредиту» (КВ-17)
    const st = sel ? trancheScheduleTotals(sel, cardAsOf) : scheduleTotalsAll(c, cardAsOf);
    const stPill={'Оплачена':'low','Просрочена':'high','Наступила':'mid','Предстоит':'neutral'};
    const scope = sel ? 'транш №'+sel.no : 'по кредиту';
    /* Слитый вид: те же две таблицы, но по всем активным траншам, каждая с колонкой
       «Транш» — идиома консолидированного расчёта («Расчёты»), а не вторая трактовка
       «по кредиту». Позиции сортируются по дате: агрегат отвечает на вопрос «что платим
       следующим», и порядок по траншам этот вопрос ломает. */
    const srcTranches = sel ? [sel] : c.tranches.filter(activeTranche);
    const verRows = srcTranches.flatMap(t => ((t.schedules)||[]).slice().sort((a,b)=>b.ver-a.ver)
      .map(s=>`<tr class="${s.active?'diff-changed':''}"><td>v${s.ver}</td>${sel?'':`<td>№${t.no}</td>`}<td>${s.active?'<span class="pill low">активна</span>':'<span class="pill neutral">архив</span>'}</td><td>${esc(s.generatedFrom)}</td><td style="text-align:right">${s.rows.length}</td></tr>`));
    const posSrc = srcTranches.flatMap(t => trancheScheduleRows(t).map(r => ({ r, t })))
      .sort((a,b) => pd(a.r.date) - pd(b.r.date) || a.t.no - b.t.no);
    const posRows = posSrc.map(({r,t})=>{
      const s=scheduleRowStatus(r, d.ledger.index.get(ledgerKey(t.no, r.no)), cardAsOf);
      return `<tr><td>№${r.no}</td>${sel?'':`<td>№${t.no}</td>`}<td>${esc(r.date)}</td><td style="text-align:right">${money(r.principal)}</td><td style="text-align:right">${money(r.interest)}</td>${(r.accrued!=null&&Math.abs(r.accrued-r.interest)>0.005)?`<td style="text-align:right" title="начислено за период, но не включено в платёж (льгота по %)">${money(r.accrued)}</td>`:'<td style="text-align:right">—</td>'}<td style="text-align:right">${money(r.total)}</td><td><span class="pill ${stPill[s]||'neutral'}">${esc(s)}</span></td></tr>`;});
```

- [ ] **Step 5: Развести колонки, заголовки, плитку метода и кнопку**

В теле `return` того же `tabGrafik`:

Заголовки секций — `(транш №N)` заменяется на `(${scope})`:

```js
      <div class="section-h" style="margin-top:22px">Версии графика (${esc(scope)})</div>
      ${cgrid([{h:'Версия'}].concat(sel?[]:[{h:'Транш'}]).concat([{h:'Статус'},{h:'От даты'},{h:'Строк',r:1}]), verRows, {empty:'Версий графика нет — сформируйте'})}
      <div class="section-h" style="margin-top:22px">График — позиции (${esc(scope)})</div>
      ${cgrid([{h:'№'}].concat(sel?[]:[{h:'Транш'}]).concat([{h:'Дата'},{h:'Осн. сумма',r:1},{h:'Проценты в платеже',r:1},{h:'Начислено %',r:1},{h:'Платёж',r:1},{h:'Статус'}]), posRows, {empty:'Позиций нет — сформируйте график'})}
```

Плитка платежа (`credit.html:6051`) получает подпись при расхождении:

```js
        <div class="dim"${st.method?` title="метод погашения — ${esc(st.method)}"`:''}><div class="dl">${esc(st.payLabel)}</div><div class="dv">${esc(st.payValue)}</div>${st.method?'':'<div class="src">несколько методов погашения</div>'}</div>
```

Кнопка построения (`credit.html:6049`):

```js
        ${sel ? actBtn(c,'buildSchedule',{tranche:sel},'Сформировать график','CR.openSchedModal()','btn btn-primary btn-sm')
              : disabledBtn('Сформировать график','График принадлежит траншу — выберите транш в шапке','btn btn-primary btn-sm')}
```

Селект вкладки (`credit.html:6046`) получает вариант «по кредиту»:

```js
        <div class="field" style="max-width:320px"><span class="flabel">Область</span><div class="control"><select onchange="CR.setCardScope(this.value)">
          ${c.tranches.length>1?`<option value="credit"${cardScope==='credit'?' selected':''}>по кредиту</option>`:''}
          ${c.tranches.map(t=>`<option value="${t.no}"${cardScope===t.no?' selected':''}>Транш №${t.no}</option>`).join('')}
        </select><span class="caret">▾</span></div></div>
```

- [ ] **Step 6: Запустить тесты**

Run: `npm run test:credit`
Expected: `14 passed, 0 failed`

- [ ] **Step 7: Коммит**

```bash
git add mockups/loan-credit/credit.html mockups/loan-credit/tests/scope.test.mjs
git commit -m "feat(credit): «График» — слитый вид по кредиту с колонкой «Транш» (КВ-17)"
```

---

### Task 4: «Прогноз» — слитый вид при области «по кредиту»

**Files:**
- Modify: `mockups/loan-credit/credit.html:6070-6112` (`tabPrognoz`)
- Test: `mockups/loan-credit/tests/scope.test.mjs`

**Interfaces:**
- Consumes: `scopeTranche(c)`, `trancheForecastRows(t, ledgerIndex, asOf)`
  (`credit.html:3212`, строки несут `{no, date, scheduled, forecast, delta, past}`),
  `scheduleRowStatus`, `ledgerKey`, `pd`, `round2`, `activeTranche`.
- Produces: ничего наружу; вкладка полностью самодостаточна.

- [ ] **Step 1: Написать падающие тесты**

```js
test('T4-1: «Прогноз» при «по кредиту» — слитая таблица с колонкой «Транш»', () => {
  const { CR } = load();
  const c = multiCredit(CR);
  CR.openDetail('K-C40');
  CR.setCardScope('credit');
  const h = CR.renderTab('Прогноз', c);
  has(h, '>Транш<', 'в шапке таблицы прогноза должна появиться колонка «Транш»');
  has(h, 'Прогноз — позиции (по кредиту)', 'заголовок должен назвать область');
});

test('T4-2: плитки прогноза складываются по траншам', () => {
  const { CR } = load();
  const c = multiCredit(CR);
  const idx = CR.derive(c, CR.TODAY).ledger.index;
  const cnt = t => CR.trancheForecastRows(t, idx, CR.TODAY).filter(r => !r.past).length;
  const all = cnt(c.tranches[0]) + cnt(c.tranches[1]);
  CR.openDetail('K-C40');
  CR.setCardScope('credit');
  has(CR.renderTab('Прогноз', c), all + ' позиц.', `плитка «Ждём впереди» должна насчитать ${all} позиций`);
});

test('T4-3: на конкретном транше «Прогноз» колонки «Транш» не показывает', () => {
  const { CR } = load();
  const c = multiCredit(CR);
  CR.openDetail('K-C40');
  CR.setCardScope(2);
  const h = CR.renderTab('Прогноз', c);
  hasNot(h, '>Транш<', 'на одном транше колонка «Транш» избыточна');
  has(h, 'Прогноз — позиции (транш №2)', 'заголовок должен назвать транш');
});
```

- [ ] **Step 2: Запустить — должны падать**

Run: `npm run test:credit`
Expected: FAIL, 3 провала T4-*.

- [ ] **Step 3: Развести ветки в `tabPrognoz`**

`credit.html:6073-6083` заменить на:

```js
    const sel=scopeTranche(c);                        // null → область «по кредиту» (КВ-17)
    const stPill={'Оплачена':'low','Просрочена':'high','Наступила':'mid','Предстоит':'neutral'};
    const scope = sel ? 'транш №'+sel.no : 'по кредиту';
    /* Та же идиома слияния, что на «Графике» и в консолидированном расчёте: строки всех
       активных траншей в одной таблице, колонка «Транш», сортировка по дате. */
    const srcTranches = sel ? [sel] : c.tranches.filter(activeTranche);
    const fr = srcTranches.flatMap(t => trancheForecastRows(t, d.ledger.index, cardAsOf).map(r => ({...r, _t:t})))
      .sort((a,b) => pd(a.date) - pd(b.date) || a._t.no - b._t.no);
    const fut = fr.filter(r=>!r.past), past = fr.filter(r=>r.past);
    const futSum   = round2(fut.reduce((a,r)=>a+r.forecast,0));
    const futSched = round2(fut.reduce((a,r)=>a+r.scheduled,0));
    const tail     = round2(past.reduce((a,r)=>a+r.forecast,0));   // непокрытый хвост прошлого
    const dl       = round2(futSum - futSched);
    const nxt = fut[0];
    const rws = fr.map(r=>{
      const s = scheduleRowStatus({date:r.date}, d.ledger.index.get(ledgerKey(r._t.no, r.no)), cardAsOf);
      const rd = r.delta;
      return `<tr${r.past?' class="text-muted"':''}><td>№${r.no}</td>${sel?'':`<td>№${r._t.no}</td>`}<td>${esc(r.date)}</td>
        <td style="text-align:right">${money(r.scheduled)}</td>
        <td style="text-align:right"><b>${money(r.forecast)}</b></td>
        <td style="text-align:right;color:${Math.abs(rd)>0.005?(rd>0?'var(--asubk-red)':'var(--text-muted)'):'inherit'}">${Math.abs(rd)>0.005?(rd>0?'+':'')+money(rd):'—'}</td>
        <td><span class="pill ${stPill[s]||'neutral'}">${esc(s)}</span></td></tr>`;});
```

- [ ] **Step 4: Заголовок, колонки и селект**

Подпись ближайшего платежа (`credit.html:6103`) при слиянии называет транш:

```js
        <div class="dim"><div class="dl">Ждём ближайшим платежом</div><div class="dv">${nxt?money(nxt.forecast):'—'}</div><div class="src">${nxt?esc(nxt.date)+' · позиция №'+nxt.no+(sel?'':' · транш №'+nxt._t.no)+(tail>0.005?' · включая хвост '+money(tail):''):'будущих позиций нет'}</div></div>
```

Заголовок и колонки (`credit.html:6110-6111`):

```js
      <div class="section-h" style="margin-top:22px">Прогноз — позиции (${esc(scope)})</div>
      ${cgrid([{h:'№'}].concat(sel?[]:[{h:'Транш'}]).concat([{h:'Дата'},{h:'По графику',r:1},{h:'Прогноз',r:1},{h:'Δ',r:1},{h:'Статус'}]), rws,
        {empty:'Графика нет — прогнозировать нечего'})}
```

Селект (`credit.html:6099`) — та же форма, что на «Графике» в задаче 3, шаг 5.

- [ ] **Step 5: Запустить тесты**

Run: `npm run test:credit`
Expected: `17 passed, 0 failed`

- [ ] **Step 6: Коммит**

```bash
git add mockups/loan-credit/credit.html mockups/loan-credit/tests/scope.test.mjs
git commit -m "feat(credit): «Прогноз» — слитый вид по кредиту с колонкой «Транш» (КВ-17)"
```

---

### Task 5: Переключатель переезжает в шапку

Пять внутривкладочных селектов снимаются, один встаёт в `phead-acts`.

**Files:**
- Modify: `mockups/loan-credit/credit.html:5528-5580` (`headerHtml`)
- Modify: `mockups/loan-credit/credit.html` — удаление селектов в
  `tabUsloviya`, `tabGrafik`, `tabPrognoz`, `tabRaschety`
- Test: `mockups/loan-credit/tests/scope.test.mjs`

**Interfaces:**
- Consumes: `cardScope`, `detailTab`, `DTABS` (`credit.html:5294`), `jsAttr`, `esc`.
- Produces:
  - `const SCOPED_TABS = ['Условия','Транши','График','Прогноз','Расчёты']` — вкладки,
    читающие область. Остальные шесть гасят контрол.
  - `scopeBox` — фрагмент разметки внутри `headerHtml`.

- [ ] **Step 1: Написать падающие тесты**

```js
test('T5-1: контрол области — в шапке, внутри вкладок его нет', () => {
  const { CR, win } = load();
  const c = multiCredit(CR);
  CR.openDetail('K-C40');
  CR.openTab('График');
  const head = win.document.querySelector('.phead-acts').innerHTML;
  has(head, 'CR.setCardScope', 'переключатель обязан быть в шапке');
  has(head, 'Область', 'у переключателя должна быть подпись «Область»');
  for (const tab of ['Условия','График','Прогноз','Расчёты'])
    hasNot(CR.renderTab(tab, c), 'CR.setCardScope', `на вкладке «${tab}» свой селект должен исчезнуть`);
});

test('T5-2: область читается раньше даты среза', () => {
  const { CR, win } = load();
  multiCredit(CR);
  CR.openDetail('K-C40');
  const head = win.document.querySelector('.phead-acts').innerHTML;
  ok(head.indexOf('CR.setCardScope') < head.indexOf('По состоянию на'),
     '«Область» должна стоять перед «По состоянию на»');
});

test('T5-3: на инертных вкладках контрол погашен с подсказкой', () => {
  const { CR, win } = load();
  multiCredit(CR);
  CR.openDetail('K-C40');
  CR.openTab('Договор');
  const head = win.document.querySelector('.phead-acts').innerHTML;
  has(head, 'disabled', 'на вкладке «Договор» контрол обязан быть неактивен');
  has(head, 'Вкладка «Договор» — всегда по кредиту целиком', 'подсказка обязана назвать вкладку');
  CR.openTab('Расчёты');
  hasNot(win.document.querySelector('.phead-acts').innerHTML, 'disabled',
         'на вкладке «Расчёты» контрол обязан ожить');
});

test('T5-4: у кредита с одним траншем контрола нет вовсе', () => {
  const { CR, win } = load();
  CR.openDetail('K-3');
  hasNot(win.document.querySelector('.phead-acts').innerHTML, 'CR.setCardScope',
         'при одном транше выбирать нечего — контрол не рендерится');
});

test('T5-5: при выбранном транше под плитками стоит подпись про шапку', () => {
  const { CR, win } = load();
  multiCredit(CR);
  CR.openDetail('K-C40');
  CR.setCardScope(2);
  has(win.document.body.innerHTML, 'Плитки — по кредиту целиком',
      'подпись, снимающая ложное обещание плиток, обязана появиться');
  CR.setCardScope('credit');
  hasNot(win.document.body.innerHTML, 'Плитки — по кредиту целиком',
         'при области «по кредиту» подпись избыточна');
});

test('T5-6: закрытый транш в списке помечен', () => {
  const { CR, win } = load();
  CR.openDetail('K-C41');       // транш №2 закрыт (Г-17)
  const head = win.document.querySelector('.phead-acts').innerHTML;
  has(head, 'Транш №2 · закрыт', 'закрытый транш обязан быть виден и помечен');
});
```

- [ ] **Step 2: Запустить — должны падать**

Run: `npm run test:credit`
Expected: FAIL, 6 провалов T5-*.

- [ ] **Step 3: Собрать контрол в шапке**

В `headerHtml` (`credit.html:5528`), сразу перед объявлением `asOfBox`:

```js
    /* ЕДИНЫЙ ПЕРЕКЛЮЧАТЕЛЬ ОБЛАСТИ (КВ-17) — в шапке, перед датой среза: сначала
       «что смотрим», потом «на когда». Прежде область набиралась пятью контролами
       внутри вкладок (селекты на Условиях/Графике/Прогнозе/Расчётах, клик по строке
       на Траншах) и двумя разными словами — «агрегат» и «консолидировано».
       Кредит с одним траншем контрол не получает: «по кредиту» и «Транш №1» там
       неразличимы, и выбор был бы ложным. */
    const scopeInert = !SCOPED_TABS.includes(detailTab);
    const scopeBox = c.tranches.length > 1 ? `<div style="display:flex;align-items:center;gap:6px">
        <span class="flabel">Область</span>
        <div class="control" style="width:170px"${scopeInert?` title="${jsAttr('Вкладка «'+detailTab+'» — всегда по кредиту целиком')}"`:''}>
          <select onchange="CR.setCardScope(this.value)"${scopeInert?' disabled':''}>
            <option value="credit"${cardScope==='credit'?' selected':''}>По кредиту</option>
            ${c.tranches.map(t=>`<option value="${t.no}"${cardScope===t.no?' selected':''}>Транш №${t.no}${t.closed?' · закрыт':''}</option>`).join('')}
          </select><span class="caret">▾</span></div>
      </div>` : '';
```

Рядом с `DTABS` (`credit.html:5294`) объявить список:

```js
  /* Вкладки, читающие область (КВ-17). Остальные шесть — Договор, Платежи, План,
     Обеспечение, Проблемные, Досье — всегда показывают кредит целиком, и на них
     контрол гасится, а не прячется: шапка не должна дёргаться при смене вкладки,
     а выбранное значение остаётся на виду. */
  const SCOPED_TABS = ['Условия','Транши','График','Прогноз','Расчёты'];
```

Вставить `scopeBox` в `phead-acts` (`credit.html:5561`) перед `asOfBox`:

```js
        <div class="phead-acts">
          ${scopeBox}
          ${asOfBox}
```

- [ ] **Step 4: Добавить подпись под плитками**

В `headerHtml`, сразу после закрывающего `</div>` блока `phead-dims`
(`credit.html:5579`):

```js
      ${cardScope!=='credit' && c.tranches.length>1 ? `<p class="section-note" style="margin:6px 0 0">Плитки — по кредиту целиком; область «Транш №${esc(String(cardScope))}» действует на вкладки ниже.</p>` : ''}
```

Плашку `info-plate` здесь не заводим намеренно: смена даты среза — событие редкое и
плашку заслуживает, выбор транша — рутина, и плашка на каждый клик стала бы шумом.

- [ ] **Step 5: Снять пять внутривкладочных контролов**

Удалить целиком:
- `tabUsloviya` — блок селекта в `gtoolbar` (появился в задаче 2, шаг 5). Кнопка
  «Изменить условия» в той же `gtoolbar` остаётся.
- `tabGrafik` — `<div class="field">` с селектом (задача 3, шаг 5). `spacer` и кнопка
  построения остаются.
- `tabPrognoz` — `<div class="field">` с селектом; если после удаления `gtoolbar`
  пустеет, удалить и её.
- `tabRaschety` — `<div class="field">` с селектом (задача 2, шаг 8); `gtoolbar`
  после этого пустеет — удалить.

Клик по строке в `tabTranshi` **сохраняется**: это не второй контрол области, а
навигация внутри таблицы, и подсветка строки следует за шапкой.

- [ ] **Step 6: Запустить тесты**

Run: `npm run test:credit`
Expected: `23 passed, 0 failed`

- [ ] **Step 7: Коммит**

```bash
git add mockups/loan-credit/credit.html mockups/loan-credit/tests/scope.test.mjs
git commit -m "feat(credit): переключатель области — в шапку карточки (КВ-17)"
```

---

### Task 6: Модалки, ручная проверка и журнал решений

**Files:**
- Modify: `mockups/loan-credit/credit.html` — модалки освоения, графика, платежа
- Modify: `mockups/loan-credit/ASUBK-status-razrabotki.md`
- Test: `mockups/loan-credit/tests/scope.test.mjs`

**Interfaces:**
- Consumes: `scopeTranche(c)`, `CR.setCardScope`.
- Produces: ничего наружу.

- [ ] **Step 1: Написать падающие тесты**

```js
test('T6-1: модалка освоения предвыбрана областью', () => {
  const { CR, win } = load();
  multiCredit(CR);
  CR.openDetail('K-C40');
  CR.setCardScope(2);
  CR.openDisbModal();
  const sel = win.document.getElementById('disbTranche');
  ok(sel, 'селект транша в модалке освоения обязан существовать');
  eq(sel.value, '2', 'предвыбор должен прийти из области карточки');
});

test('T6-2: выбор другого транша в модалке двигает область карточки', () => {
  const { CR, win } = load();
  const c = multiCredit(CR);
  CR.openDetail('K-C40');
  CR.setCardScope(2);
  CR.openDisbModal();
  win.document.getElementById('disbTranche').value = '1';
  win.document.getElementById('disbAmount').value = '1000';
  CR.submitDisb();
  has(CR.renderTab('Расчёты', c), 'транш №1', 'после освоения область обязана встать на транш действия');
});

test('T6-3: смена области не сбрасывает дату среза и наоборот', () => {
  const { CR, win } = load();
  multiCredit(CR);
  CR.openDetail('K-C40');
  CR.setCardAsOf('01.06.2026');
  CR.setCardScope(2);
  has(win.document.body.innerHTML, '01.06.2026', 'дата среза обязана пережить смену области');
  CR.setCardAsOf('01.07.2026');
  has(win.document.querySelector('.phead-acts').innerHTML, 'value="2" selected',
      'область обязана пережить смену даты');
});
```

Поля модалки освоения: `disbTranche` (`credit.html:6692`), `disbAmount`
(`credit.html:6693`), подтверждение — `CR.submitDisb()` (`credit.html:6701`).

- [ ] **Step 2: Запустить — должны падать**

Run: `npm run test:credit`
Expected: FAIL, провалы T6-*.

- [ ] **Step 3: Довести модалки**

В `credit.html:6692` (освоение), `credit.html:6721` (график), `credit.html:6885`
(платёж) предвыбор `${t.no===detailTrancheNo?' selected':''}` уже переведён задачей 2
на `(scopeTranche(c) || c.tranches[0] || {}).no`. Проверить, что во всех трёх местах
подстановка одинаковая, и что обработчики подтверждения (`credit.html:6707`,
`credit.html:6737`) ставят `cardScope=no;`.

Отдельный случай — `credit.html:6721`: селект в модалке графика вызывает
`CR.selectDetailTranche(+this.value);CR.openSchedModal()`. Заменить на
`CR.setCardScope(+this.value);CR.openSchedModal()`.

- [ ] **Step 4: Запустить тесты**

Run: `npm run test:credit`
Expected: `26 passed, 0 failed`

- [ ] **Step 5: Ручная проверка в браузере**

Открыть `mockups/loan-credit/credit.html` в Chrome. Пять сценариев из спеки:

1. `K-C40`, область «Транш №2» — обойти все 11 вкладок. Условия/Транши/График/Прогноз/
   Расчёты показывают транш №2; на остальных шести контрол сер и по наведению даёт
   подсказку; выбранное значение из селекта не пропадает.
2. `K-C40`, область «По кредиту» — «График» и «Прогноз» дают слитую таблицу с колонкой
   «Транш»; «Сформировать график» неактивна с подсказкой; плитка платежа даёт `—` и
   подпись «несколько методов погашения». *Предусловие: у транша №2 в сиде нет
   освоения — сначала внести освоение и построить график на обоих траншах, иначе
   слитая таблица покажет позиции только транша №1.*
3. Однотраншевый (`K-3`) — контрола в шапке нет; График/Прогноз/Расчёты показывают
   транш №1; «Условия» дают его комплект без блока расхождений.
4. `K-C40`, область «Транш №2» → «Внести освоение»: селект модалки предвыбран на №2;
   выбрать №1, подтвердить → область в шапке стала «Транш №1».
5. Сменить дату среза — область не слетела; сменить область — дата не слетела; выйти
   в реестр и войти снова — область «По кредиту».

Записать в теле коммита, какие пункты прошли. Если пункт не проходит — это дефект
реализации, а не повод менять план.

- [ ] **Step 6: Занести решение в журнал**

В `mockups/loan-credit/ASUBK-status-razrabotki.md`, в таблицу решений, строкой
`КВ-17` (следующий свободный — проверено, максимум был КВ-16):

```markdown
| КВ-17 | **Область просмотра — одна на карточку.** Три контрола (`condScope` на «Условиях», `detailTrancheNo` на Траншах/Графике/Прогнозе/Расчётах, чекбокс `calcConsolidated` на «Расчётах») и два разных слова для одного понятия — «агрегат» и «консолидировано» — сведены в один переключатель «Область» в шапке, рядом с датой среза. Тот же перенос, что КВ-10 сделал для `cardAsOf` по дефекту КР-29: область — второй параметр среза, и у отдельной вкладки своей области не бывает. «График» и «Прогноз» при области «по кредиту» получили слитую таблицу с колонкой «Транш» — идиому консолидированного расчёта, а не вторую трактовку. Шапка за областью не следует (плитки — агрегаты по кредиту, на транш не считаются) и говорит об этом подписью | 04.08.2026 |
```

Заодно поправить комментарии-истории в шапке `credit.html`, где написано
«состояние общее — `detailTrancheNo` один на карточку» (строки ~425, ~440) — переменной
больше нет.

- [ ] **Step 7: Коммит**

```bash
git add mockups/loan-credit/credit.html mockups/loan-credit/tests/scope.test.mjs mockups/loan-credit/ASUBK-status-razrabotki.md
git commit -m "feat(credit): модалки на cardScope + запись КВ-17 в журнал решений"
```

---

## Проверка плана на покрытие спеки

| требование спеки | задача |
|---|---|
| одна переменная `cardScope`, три удалены | 2 |
| хелпер `scopeTranche(c)`, однотраншевый кредит → транш | 2, тест T2-5 |
| сброс области при открытии карточки | 2, тест T2-6 |
| контрол в `phead-acts` перед `asOfBox` | 5, тесты T5-1/T5-2 |
| при одном транше контрол не рендерится | 5, тест T5-4 |
| инертные вкладки — `disabled` + подсказка | 5, тест T5-3 |
| подпись под плитками, плашку не заводим | 5, тест T5-5 |
| Условия — агрегат + расхождения | 2, тест T2-4 |
| Транши — подсветка строки | 2, шаг 6 |
| График — слитая таблица + колонка «Транш» | 3, тесты T3-1/T3-2 |
| Прогноз — слитая таблица + колонка «Транш» | 4, тесты T4-1/T4-3 |
| Расчёты — прежний консолидированный вид | 2, тест T2-3 |
| плитка платежа при расхождении методов | 3, тест T3-4 |
| «Сформировать график» погашена при «по кредиту» | 3, тест T3-5 |
| модалки сохраняют свои селекты, предвыбор из области | 6, тесты T6-1/T6-2 |
| область и дата среза независимы | 6, тест T6-3 |
| пять ручных сценариев | 6, шаг 5 |
