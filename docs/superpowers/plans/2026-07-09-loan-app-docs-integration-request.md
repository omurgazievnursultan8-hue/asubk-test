# Запрос документов через интеграцию внешних систем — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** В to-be вкладке «Документы» мокапа заявки для документов с известным госисточником добавить кнопку «Запросить из системы» рядом с «Загрузить»: запрос переводит документ в промежуточный статус «Запрошено», ответ приходит как «Загружен» с пометкой источника.

**Architecture:** Единственный самодостаточный HTML-файл `mockups/loan-application/loan-application.html` (ванильный JS, рендер строкой). Меняем конфиг документов (`DOC_STATUS`, `DOC_SECTIONS`), добавляем маппинг `DOC_SOURCES`, ветку кнопок в `docRow`, три функции-обработчика. Тест-фреймворка нет — верификация Playwright-скриптом, который грузит файл, драйвит флоу и ассертит DOM (паттерн `scripts/inspect/docs-completeness-render.mjs`).

**Tech Stack:** Vanilla JS в HTML, CSS-переменные ASUBK, playwright-core + system Chrome для верификации.

## Global Constraints

- **Русский язык интерфейса** — все ярлыки/тосты по-русски.
- **`Date.now()`/`new Date()` в мокапе НЕ использовать** — даты статические строковые литералы (в файле уже так: `загружен 04.07.2026`). Для запроса использовать литерал `09.07.2026 14:20`.
- **Интеграция только в статических секциях `ident` и `fin`** — не print/contract/coll. Ключ документа — простой `docId` (без `::`).
- **Ручной путь всегда доступен** — «Загрузить»/«Перезагрузить» не убирать.
- **Правит только спец в режиме правки** (`cap.editReq`) — та же гейт-роль, что у загрузки.
- Стиль кода — как в окружающих функциях: строковый рендер, `_docBtn(kind,label,onclick)`, обработчики зовут `_docRerender()` + `showToast(...)`.

---

### Task 1: Модель данных — статус «Запрошено», маппинг источников, док «Кредитный отчёт», CSS

**Files:**
- Modify: `mockups/loan-application/loan-application.html`
  - `DOC_STATUS` (~строка 3901) — добавить статус `requested`
  - `OPEN_BLOCKS` (~строка 3912) — включить `requested`
  - `DOC_SECTIONS` секция `fin` (~строки 3956-3963) — новая строка `cbr`
  - новый конст `DOC_SOURCES` (рядом с `DOC_STATUS`)
  - CSS блок бейджей (~строки 1004-1011) — класс `.doc-st-reqd`
- Test: `scripts/inspect/doc-integration-request.mjs` (Create)

**Interfaces:**
- Produces:
  - `DOC_STATUS.requested = { label:'Запрошено', cls:'doc-st-reqd' }`
  - `DOC_SOURCES` — объект `{ [docId:string]: string }` (ярлык системы)
  - Новый документ в `fin`: `{ id:'cbr', t:'Кредитный отчёт (кредбюро)', req:false, ft:'both', st:'required' }`
  - `OPEN_BLOCKS('requested') === true`

- [ ] **Step 1: Добавить статус `requested` в `DOC_STATUS`**

В объекте `DOC_STATUS` после строки `expired:` добавить (перед `waived:`):

```js
  requested:{ label:'Запрошено',   cls:'doc-st-reqd' },
```

- [ ] **Step 2: Включить `requested` в `OPEN_BLOCKS`**

Заменить:

```js
const OPEN_BLOCKS = s => s === 'required' || s === 'rejected' || s === 'expired';
```

на:

```js
const OPEN_BLOCKS = s => s === 'required' || s === 'rejected' || s === 'expired' || s === 'requested';
```

- [ ] **Step 3: Добавить конст `DOC_SOURCES`**

Сразу после закрывающей `};` объекта `DOC_STATUS` вставить:

```js
/* Документы, доступные из внешних госсистем (шина «Тундук» / кредбюро).
   Ключ = docId, значение = ярлык системы-источника. Только для статических
   секций ident/fin; определяет показ кнопки «Запросить из «X»» в docRow. */
const DOC_SOURCES = {
  p1:'ГРС «Тундук»', p2:'ГРС «Тундук»',
  inn:'ГНС «Тундук»',
  reg:'Минюст «Тундук»', egr:'Минюст «Тундук»',
  inc:'Соцфонд',
  tax:'ГНС', nod:'ГНС',
  cbr:'Кредбюро',
};
```

- [ ] **Step 4: Добавить документ `cbr` в секцию `fin`**

В `DOC_SECTIONS`, в секции `{ key:'fin', ... docs:[ ... ]}`, после строки с `nod` добавить:

```js
    { id:'cbr',t:'Кредитный отчёт (кредбюро)',          req:false, ft:'both', st:'required' },
```

- [ ] **Step 5: Добавить CSS-класс бейджа `.doc-st-reqd`**

После строки `.doc-st-conf{ ... }` (~строка 1011) добавить (янтарный/ожидание, в тон `warning`):

```css
.doc-st-reqd{ color:#7a5b00; background:var(--status-warning-bg); }
```

- [ ] **Step 6: Создать верификационный скрипт**

Создать `scripts/inspect/doc-integration-request.mjs`:

```js
// Проверка фичи «Запрос документов через интеграцию» (спек 2026-07-09).
// Грузит мокап, драйвит флоу запроса, ассертит DOM. Ищет JS-ошибки.
import { chromium } from 'playwright-core';
const FILE = 'file://' + process.cwd() + '/mockups/loan-application/loan-application.html';
const ctx = await chromium.launchPersistentContext('.auth/profile-mock',
  { channel:'chrome', headless:true, viewport:{ width:1500, height:1600 } });
const page = ctx.pages()[0] || await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

await page.goto(FILE, { waitUntil:'networkidle' });
await page.waitForTimeout(400);

// Открыть заявку спецом в режиме правки на вкладке «Документы»
async function openEdit(num){
  await page.evaluate(n => { setRole('spec'); gotoDetail(n, 'tab-2'); enterEdit(); showTab('tab-2'); }, num);
  await page.waitForTimeout(300);
}

const results = [];
const check = (name, ok) => { results.push((ok ? 'PASS ' : 'FAIL ') + name); };

await openEdit('З-2026-000080');

// T1: конфиг загрузился без ошибок, статус и источники объявлены
const cfg = await page.evaluate(() => ({
  hasStatus: !!(window.DOC_STATUS && DOC_STATUS.requested && DOC_STATUS.requested.label === 'Запрошено'),
  openBlocks: !!(window.OPEN_BLOCKS && OPEN_BLOCKS('requested')),
  sources: !!(window.DOC_SOURCES && DOC_SOURCES.inn && DOC_SOURCES.cbr),
  cbr: !!(window.DOC_SECTIONS && DOC_SECTIONS.find(s => s.key === 'fin').docs.find(d => d.id === 'cbr')),
}));
check('T1 статус requested объявлен', cfg.hasStatus);
check('T1 OPEN_BLOCKS(requested)', cfg.openBlocks);
check('T1 DOC_SOURCES.inn/.cbr заданы', cfg.sources);
check('T1 док cbr в секции fin', cfg.cbr);

console.log(results.join('\n'));
console.log(errors.length ? '\nERRORS:\n' + errors.join('\n') : '\nNO JS ERRORS');
await ctx.close();
if (results.some(r => r.startsWith('FAIL')) || errors.length) process.exit(1);
```

- [ ] **Step 7: Запустить верификацию — все проверки Task 1 зелёные**

Run: `node scripts/inspect/doc-integration-request.mjs`
Expected: 4 строки `PASS T1 …`, `NO JS ERRORS`, код выхода 0.

- [ ] **Step 8: Commit**

```bash
git add mockups/loan-application/loan-application.html scripts/inspect/doc-integration-request.mjs
git commit -m "feat(mockup): loan-application — модель интеграционного запроса документов

Статус ЖЦ «Запрошено» (в OPEN_BLOCKS), маппинг DOC_SOURCES (ГРС/ГНС/Минюст/
Соцфонд/кредбюро), новый док «Кредитный отчёт (кредбюро)», CSS-бейдж."
```

---

### Task 2: Кнопки запроса и мета источника в `docRow`

**Files:**
- Modify: `mockups/loan-application/loan-application.html` — функция `docRow` (~строки 4110-4188)
- Test: `scripts/inspect/doc-integration-request.mjs` (Modify — дописать блок T2)

**Interfaces:**
- Consumes: `DOC_SOURCES`, `DOC_STATUS.requested`, `OPEN_BLOCKS`, `_docBtn`, `docRequest`/`docReqCancel`/`docReqFulfill` (реализуются в Task 3 — здесь только вызываются в onclick-строках).
- Produces: строка интеграционного дока в открытом блоке содержит кнопку с текстом `Запросить из «<система>»`; в статусе `requested` — кнопки `Отменить запрос` и `Ответ получен`.

- [ ] **Step 1: Дописать T2-ассерты в верификационный скрипт (сначала падают)**

В `scripts/inspect/doc-integration-request.mjs` перед строкой `console.log(results.join('\n'));` вставить:

```js
// T2: у интеграционного дока (inn) в открытом блоке есть «Запросить из …»,
//     у неинтеграционного (kb — согласие в кредбюро) — нет.
const btns = await page.evaluate(() => {
  const app = _detailApp;
  const inn = _findDocState('inn'); const kb = _findDocState('kb');
  return {
    innReqBtn: docRow(app, { t:'ИНН', req:true, st:'required' }, 'inn', null).includes('Запросить из'),
    kbReqBtn:  docRow(app, { t:'Согласие', req:true, st:'required' }, 'kb', null).includes('Запросить из'),
    requestedActs: docRow(app, { t:'ИНН', req:true, st:'requested' }, 'inn', null),
  };
});
check('T2 «Запросить из» есть у inn', btns.innReqBtn);
check('T2 «Запросить из» нет у kb', !btns.kbReqBtn);
check('T2 в статусе requested есть «Отменить запрос»', btns.requestedActs.includes('Отменить запрос'));
check('T2 в статусе requested есть «Ответ получен»', btns.requestedActs.includes('Ответ получен'));
```

- [ ] **Step 2: Запустить — T2 падает (кнопок ещё нет)**

Run: `node scripts/inspect/doc-integration-request.mjs`
Expected: `FAIL T2 …` (код 1). T1 остаётся PASS.

- [ ] **Step 3: Добавить ветку интеграции в `docRow`**

В `docRow`, внутри `if (spec){ ... }`, в ветке `else {` (обычные секции, ~строки 4134-4144), где формируются `Загрузить`/`Перезагрузить`/`Заменить`. Сразу ПОСЛЕ блока с этими кнопками и перед `if (disp.st === 'uploaded'){` добавить показ «Запросить из …» для интеграционных доков в открытом блоке:

```js
      /* Интеграция: рядом с ручной загрузкой — запрос из госсистемы (только открытый блок). */
      const src = DOC_SOURCES[key];
      if (src && OPEN_BLOCKS(disp.st) && disp.st !== 'requested'){
        acts += _docBtn('ghost', `Запросить из «${src}»`, `docRequest(${kq})`);
      }
```

Затем обработать сам статус `requested` — он open-block, но требует своих кнопок вместо «Загрузить». В начале ветки `else {` (перед `if (disp.st === 'required')`) добавить ранний перехват:

```js
      if (disp.st === 'requested'){
        acts += _docBtn('ghost', 'Отменить запрос', `docReqCancel(${kq})`);
        acts += _docBtn('secondary', '⚙ Ответ получен', `docReqFulfill(${kq})`);
      } else {
```

и закрыть добавленную `}` в конце ветки `else` (после блока `if (disp.req) acts += ... docWaive ...`). Итоговая структура ветки:

```js
    } else if (disp.st === 'waived'){
      acts += _docBtn('ghost', 'Вернуть', `docUnwaive(${kq})`);
    } else {
      if (disp.st === 'requested'){
        acts += _docBtn('ghost', 'Отменить запрос', `docReqCancel(${kq})`);
        acts += _docBtn('secondary', '⚙ Ответ получен', `docReqFulfill(${kq})`);
      } else {
        if (disp.st === 'required') acts += _docBtn('primary', 'Загрузить', `docUpload(${kq})`);
        else if (disp.st === 'rejected' || disp.st === 'expired') acts += _docBtn('primary', 'Перезагрузить', `docUpload(${kq})`);
        else acts += _docBtn('ghost', 'Заменить', `docUpload(${kq})`);
        const src = DOC_SOURCES[key];
        if (src && OPEN_BLOCKS(disp.st)){
          acts += _docBtn('ghost', `Запросить из «${src}»`, `docRequest(${kq})`);
        }
        if (disp.st === 'uploaded'){
          acts += _docBtn('success', 'Проверил', `docAccept(${kq})`);
          acts += _docBtn('danger', 'Отклонить', `docReject(${kq})`);
        }
        if (disp.req) acts += _docBtn('ghost', 'Не требуется', `docWaive(${kq})`);
      }
    }
```

(Примечание: `requested` не входит в `uploaded/rejected/expired`, поэтому старые ветви его не заденут; для него кнопки заданы явно выше.)

- [ ] **Step 4: Добавить мета-строку статуса «Запрошено» и источника получения**

В `docRow`, в блоке формирования `meta` (~строки 4161-4166), добавить строки. После блока про `expired`/`valid` и перед `if (disp.st === 'waived' ...)` вставить:

```js
  if (disp.st === 'requested') meta.push(`<span class="m-req">Запрошено из «${DOC_SOURCES[key] || '—'}» · ${disp.reqAt || '09.07.2026 14:20'}</span>`);
  if (disp.via && ['uploaded','accepted','confirmed'].includes(disp.st)) meta.push(`Получено из «${disp.via}» · автоматически`);
```

- [ ] **Step 5: Добавить CSS для `.m-req`**

После строки `.doc-meta .m-exp{ ... }` (~строка 1019) добавить:

```css
.doc-meta .m-req{ color:#7a5b00; }
```

- [ ] **Step 6: Запустить — T2 зелёный, ошибок нет**

Run: `node scripts/inspect/doc-integration-request.mjs`
Expected: `PASS T2 …` ×4, T1 всё ещё PASS, `NO JS ERRORS`, код 0.
(На этом шаге `docRequest`/`docReqCancel`/`docReqFulfill` ещё не определены, но T2 только рендерит строку — onclick не вызывается, ошибок нет.)

- [ ] **Step 7: Commit**

```bash
git add mockups/loan-application/loan-application.html scripts/inspect/doc-integration-request.mjs
git commit -m "feat(mockup): loan-application — кнопки «Запросить из системы» и мета источника в строке дока"
```

---

### Task 3: Обработчики запроса, флоу end-to-end, формулировка гейта

**Files:**
- Modify: `mockups/loan-application/loan-application.html`
  - новые функции `docRequest`/`docReqCancel`/`docReqFulfill` (рядом с `docUpload`, ~строка 4297)
  - `sendGateReason` (~строки 4076-4089) — упомянуть ожидание интеграции
  - `_docStats` (~строки 4037-4062) — убедиться, что `requested` не считается `blocker`
- Test: `scripts/inspect/doc-integration-request.mjs` (Modify — дописать блок T3)

**Interfaces:**
- Consumes: `_findDocState`, `_docRerender`, `showToast`, `_docTitle`, `DOC_SOURCES`.
- Produces:
  - `docRequest(key)` — `st: 'requested'`, `reqAt:'09.07.2026 14:20'`
  - `docReqCancel(key)` — `st: 'required'`, удаляет `reqAt`
  - `docReqFulfill(key)` — `st: 'uploaded'`, `via: DOC_SOURCES[key]`, удаляет `reqAt`

- [ ] **Step 1: Дописать T3-ассерты (end-to-end флоу) — сначала падают**

В `scripts/inspect/doc-integration-request.mjs` перед `console.log(results.join('\n'));` добавить:

```js
// T3: полный флоу через реальные обработчики + перерисовку DOM.
// cbr — необязательный интеграционный док в fin, стартует 'required'.
const flow = await page.evaluate(() => {
  const seq = [];
  const st = () => _findDocState('cbr').st;
  docRequest('cbr');   seq.push(['afterRequest', st(), _findDocState('cbr').reqAt || '']);
  docReqCancel('cbr'); seq.push(['afterCancel', st()]);
  docRequest('cbr');   seq.push(['afterReRequest', st()]);
  docReqFulfill('cbr');seq.push(['afterFulfill', st(), _findDocState('cbr').via || '']);
  return seq;
});
const byName = Object.fromEntries(flow.map(r => [r[0], r]));
check('T3 запрос → requested', byName.afterRequest[1] === 'requested' && byName.afterRequest[2] === '09.07.2026 14:20');
check('T3 отмена → required', byName.afterCancel[1] === 'required');
check('T3 повторный запрос → requested', byName.afterReRequest[1] === 'requested');
check('T3 ответ → uploaded с источником «Кредбюро»', byName.afterFulfill[1] === 'uploaded' && byName.afterFulfill[2] === 'Кредбюро');

// T3b: пока док в requested — он open-block, в комплекте не закрыт.
const gate = await page.evaluate(() => {
  const inn = _findDocState('inn'); inn.st = 'requested';
  const blocked = OPEN_BLOCKS('requested');
  const reason = sendGateReason(_detailApp);
  inn.st = 'accepted';   // вернуть, чтобы не залипло состояние демо
  return { blocked, reason };
});
check('T3b requested блокирует гейт (open-block)', gate.blocked === true);
```

- [ ] **Step 2: Запустить — T3 падает (`docRequest is not defined`)**

Run: `node scripts/inspect/doc-integration-request.mjs`
Expected: `FAIL T3 …` / PAGEERROR про `docRequest`. T1/T2 остаются PASS.

- [ ] **Step 3: Реализовать обработчики**

После функции `docUpload` (~строка 4302) добавить:

```js
/* ── Интеграция: запрос документа из внешней госсистемы. Промежуточный статус
   «Запрошено» (асинхронно), ответ приходит как «Загружен» с пометкой источника. ── */
function docRequest(key){
  const d = _findDocState(key); if (!d) return;
  const src = DOC_SOURCES[key]; if (!src) return;
  d.st = 'requested'; d.reqAt = '09.07.2026 14:20'; delete d.reason;
  _docRerender(); showToast(`Запрос отправлен в «${src}»: ` + _docTitle(key), 'ok');
}
function docReqCancel(key){
  const d = _findDocState(key); if (!d) return;
  d.st = 'required'; delete d.reqAt;
  _docRerender(); showToast('Запрос отменён: ' + _docTitle(key), 'info');
}
function docReqFulfill(key){
  const d = _findDocState(key); if (!d) return;
  d.st = 'uploaded'; d.via = DOC_SOURCES[key] || '—'; delete d.reqAt; delete d.reason;
  _docRerender(); showToast(`Ответ получен из «${d.via}» — документ загружен: ` + _docTitle(key), 'ok');
}
```

- [ ] **Step 4: Уточнить формулировку гейта при ожидании интеграции**

В `sendGateReason`, в первой ветке `if (!st.met)`, где сейчас:

```js
  if (!st.met) return st.blockers
    ? 'Есть отклонённые/просроченные документы — их нужно перезагрузить'
    : `Собран не полный обязательный комплект документов (${st.reqClosed} из ${st.reqTot})`;
```

добавить между ними ветку про запрошенные. Для этого сначала посчитать запрошенные в `_docStats` — в функции `bump` добавить счётчик. В `_docStats`, где объявлены счётчики, добавить `requested`:

```js
  let reqTot = 0, reqClosed = 0, reqAccepted = 0, reqConfirmed = 0, blockers = 0, requested = 0;
```

в `bump`:

```js
    if (st === 'requested') requested++;
```

и в `return {...}` добавить `requested,`.

Затем `sendGateReason`:

```js
  if (!st.met){
    if (st.blockers) return 'Есть отклонённые/просроченные документы — их нужно перезагрузить';
    if (st.requested) return `Ожидается ответ интеграции по ${st.requested} док. — комплект пока не собран`;
    return `Собран не полный обязательный комплект документов (${st.reqClosed} из ${st.reqTot})`;
  }
```

(`requested` уже НЕ попадает в `blockers`: в `bump` ветка `blockers++` только для `rejected`/`expired`. Проверить, что это так — Step ниже.)

- [ ] **Step 5: Проверить, что `requested` не считается блокером в `_docStats`**

Прочитать `bump` в `_docStats` и убедиться: `if (st === 'rejected' || st === 'expired') blockers++;` — `requested` там не участвует. Если участвует — исключить. (В текущем коде не участвует — правка не требуется, шаг подтверждающий.)

- [ ] **Step 6: Запустить — все проверки зелёные**

Run: `node scripts/inspect/doc-integration-request.mjs`
Expected: все `PASS` (T1×4, T2×4, T3×4, T3b×1), `NO JS ERRORS`, код 0.

- [ ] **Step 7: Commit**

```bash
git add mockups/loan-application/loan-application.html scripts/inspect/doc-integration-request.mjs
git commit -m "feat(mockup): loan-application — обработчики запроса/отмены/ответа интеграции + формулировка гейта"
```

---

### Task 4: Визуальная верификация и синхронизация спеки/TODO

**Files:**
- Modify: `scripts/inspect/doc-integration-request.mjs` — снимок скриншота
- Modify: `TODO.md` — запись рекомендации (если фича новая для бэклога)
- Modify: `mockups/loan-application/loan-application.html` — комментарий-чекпойнт (при необходимости)

**Interfaces:**
- Consumes: готовый флоу из Task 1-3.

- [ ] **Step 1: Добавить скриншот полного состояния в верификатор**

В `scripts/inspect/doc-integration-request.mjs` перед `await ctx.close();` добавить:

```js
// Скриншот: заявка с запрошенными/полученными доками (визуальная проверка)
await page.evaluate(() => { setRole('spec'); gotoDetail('З-2026-000080', 'tab-2'); enterEdit();
  ['inn'].forEach(k => docRequest(k)); ['inc'].forEach(k => docReqFulfill(k)); showTab('tab-2'); });
await page.waitForTimeout(300);
await page.screenshot({ path:'.auth/doc-integration.png', fullPage:true });
```

- [ ] **Step 2: Запустить и глазами проверить скриншот**

Run: `node scripts/inspect/doc-integration-request.mjs`
Expected: код 0; открыть `.auth/doc-integration.png` — у ИНН бейдж «Запрошено» + кнопки «Отменить запрос»/«Ответ получен» + мета «Запрошено из «ГНС «Тундук»»»; у справки о доходах бейдж «Загружен» + мета «Получено из «Соцфонд» · автоматически».

- [ ] **Step 3: Дописать чекпойнт-комментарий в мокапе (кратко)**

В шапке-комментарии CHECKPOINT 4 (~строка 3887) в перечень фич дописать строку про интеграционный запрос, в стиле соседних:

```
   Интеграция: доки с источником (DOC_SOURCES) можно «Запросить из системы»
   (ГРС/ГНС/Минюст/Соцфонд/кредбюро) — статус «Запрошено» → ответ «Загружен».
```

- [ ] **Step 4: Занести рекомендацию в `TODO.md`**

Добавить в раздел фазы заявок новую запись `P?-R?` (следующий свободный номер в секции) — краткое описание фичи «Запрос документов через внешние интеграции», приоритет 🟡 Средний, ссылка на спек `docs/superpowers/specs/2026-07-09-loan-app-docs-integration-request-design.md` и мокап. Формат — как у соседних записей секции (проверить существующий шаблон перед вставкой; авто-хук синхронизирует Sheet).

- [ ] **Step 5: Финальный прогон верификатора**

Run: `node scripts/inspect/doc-integration-request.mjs`
Expected: все `PASS`, `NO JS ERRORS`, код 0.

- [ ] **Step 6: Commit**

```bash
git add mockups/loan-application/loan-application.html scripts/inspect/doc-integration-request.mjs TODO.md
git commit -m "docs(mockup): loan-application — чекпойнт интеграционного запроса + запись в TODO"
```

---

## Self-Review

**Spec coverage:**
- Маппинг источников (спек §1) → Task 1 Step 3-4.
- Статус «Запрошено» + OPEN_BLOCKS (§2) → Task 1 Step 1-2.
- Хранение источника `via` (§3) → Task 3 Step 3 (`docReqFulfill`), рендер Task 2 Step 4.
- Действия/рендер строки (§4) → Task 2.
- Гейт (§5) → Task 3 Step 4.
- Новый док `cbr` кредбюро (решение брейнсторма) → Task 1 Step 4.

**Placeholder scan:** дат-литералы `09.07.2026 14:20` намеренны (Date.now запрещён). TODO Step 4 намеренно ссылается на существующий шаблон секции — номер `P?-R?` определяется при исполнении (структура TODO Russian, порядковый счётчик секции), это не код-плейсхолдер.

**Type consistency:** `docRequest`/`docReqCancel`/`docReqFulfill` — одинаковые имена в Task 2 (onclick) и Task 3 (определение). Поля `reqAt`/`via` — согласованы между обработчиком (Task 3) и рендером меты (Task 2 Step 4). `DOC_SOURCES` ключ = docId — согласован в маппинге (Task 1), кнопке (Task 2), обработчике (Task 3).
