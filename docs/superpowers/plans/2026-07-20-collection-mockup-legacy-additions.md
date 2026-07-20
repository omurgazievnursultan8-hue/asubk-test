# Взыскание — дозагрузка legacy-возможностей в макет: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Достроить макет `mockups/collection/collection.html` шестью возможностями из legacy-взыскания (финразбивка, заседания, кросс-процессные реестры, вложения, ФИО-ответственный, состояние претензии + аннулирование), не отменяя принятых доменных решений.

**Architecture:** Единый HTML-файл, данные-в-JS (`PROCESSES[]` + панель-билдеры). Каждая фича = расширение модели данных + новая панель/вкладка/список. Тест-цикл — Playwright-скрипт `scripts/inspect/collection-check.mjs` с ассертами `ok(name, cond)`; он аккумулирует `fails` и выходит `1` при провале или ошибке консоли. Юнит-тест-фреймворка в репо нет.

**Tech Stack:** Vanilla HTML/CSS/JS (макет), Playwright-core (проверка, `node scripts/inspect/collection-check.mjs`).

## Global Constraints

- **Единый файл, новых файлов нет.** Всё в `mockups/collection/collection.html`.
- **Демо-уровень:** действия-кнопки → `toast(...)`, без рантайм-вычислений; результат зашит в данные + заметка о правиле.
- **Дизайн-система:** переиспользовать существующие классы (`.cgrid`, `.cgrid-wrap`, `.pill`, `.pill.mid/.neutral`, `.total`, `.cgrid-empty`, `.gtoolbar`, `.section-h`, `.section-note`, модалки, тосты). Новых CSS-классов не вводить без нужды.
- **Инвариант сумм:** итог «Начислено» по bucket'ам требования = сумма меры-основания текущей фазы (мера, чей `kind` = `PHASE_BY_MEASURE[p.phase]`). Демо-данные согласованы вручную.
- **Формат суммы:** `fmtKGS(40000)` → `'40 000,00'` (обычный пробел-разделитель; НЕ `toLocaleString` — тот ставит U+202F и рассинхронит с зашитыми строками вида `'42 600,00'`).
- **Спек:** `docs/superpowers/specs/2026-07-20-collection-mockup-legacy-additions-design.md`.
- **Проверка после каждой задачи:** `node scripts/inspect/collection-check.mjs` — ожидается `ПРОВАЛЕНО АССЕРТОВ: 0` и `ОШИБОК КОНСОЛИ: 0`.

---

### Task 1: Харденинг check-скрипта — выбор вкладок по тексту, а не по индексу

Вставка двух новых вкладок сдвинет `nth`-индексы, на которые опираются ~30 ассертов. Перед изменением макета делаем выбор вкладок порядко-независимым: клик по тексту, панель — по классу `.active`.

**Files:**
- Modify: `scripts/inspect/collection-check.mjs`

**Interfaces:**
- Produces: паттерн `page.click('#detailTabbar .dtab:has-text("<Имя>")')` для перехода на вкладку и `page.locator('#detailPanels .detail-panel.active')` для активной панели. Все последующие задачи используют его.

- [ ] **Step 1: Заменить index-клики вкладок на текстовые**

В `scripts/inspect/collection-check.mjs` заменить каждое `await page.click('#detailTabbar .dtab >> nth=N')` на клик по тексту соответствующей вкладки. Соответствие текущих индексов (7 вкладок):

| nth | вкладка |
|---|---|
| 0 | Общая информация |
| 1 | Охват |
| 2 | Журнал мер |
| 3 | Передачи дела |
| 4 | Особые состояния |
| 5 | Залог / реализация |
| 6 | История |

Пример: `await page.click('#detailTabbar .dtab >> nth=1');` → `await page.click('#detailTabbar .dtab:has-text("Охват")');`
Для «Залог / реализация» использовать `:has-text("Залог")`.

- [ ] **Step 2: Заменить панели `.detail-panel >> nth=N` на активную панель**

Каждое `page.locator('#detailPanels .detail-panel >> nth=N')`, где N — панель только что открытой вкладки, заменить на `page.locator('#detailPanels .detail-panel.active')`. (`switchTab` вешает класс `active` ровно на одну панель — строка ~883 макета.)

Строки с `.gtoolbar .btn` внутри панели: `#detailPanels .detail-panel >> nth=2 >> .gtoolbar .btn` → `#detailPanels .detail-panel.active >> .gtoolbar .btn`.

- [ ] **Step 3: Сделать цикл «каждая вкладка непуста» динамическим по числу вкладок**

Найти цикл (около строки 357–364) `// каждая из 7 вкладок непуста у каждого процесса`. Заменить фиксированную границу на реальное число вкладок:

```javascript
const tabCount = await page.locator('#detailTabbar .dtab').count();
for (let t = 0; t < tabCount; t++) {
  await page.click(`#detailTabbar .dtab >> nth=${t}`);
  const txt = (await page.locator(`#detailPanels .detail-panel >> nth=${t}`).innerText()).trim();
  ok(`вкладка ${t} непуста`, txt.length > 0);
}
```

- [ ] **Step 4: Обновить счётчик вкладок на динамический**

Строку `ok('7 вкладок', (await page.locator('#detailTabbar .dtab').count()) === 7);` заменить на утверждение о текущем числе вкладок (пока 7):

```javascript
ok('карточка имеет вкладки', (await page.locator('#detailTabbar .dtab').count()) >= 7);
```

(Точное число проверяется в задачах, где добавляются вкладки.)

- [ ] **Step 5: Прогнать — скрипт остаётся зелёным**

Run: `node scripts/inspect/collection-check.mjs`
Expected: `ПРОВАЛЕНО АССЕРТОВ: 0`, `ОШИБОК КОНСОЛИ: 0` (рефактор не меняет поведение).

- [ ] **Step 6: Commit**

```bash
git add scripts/inspect/collection-check.mjs
git commit -m "test(collection): выбор вкладок по тексту вместо индекса (харденинг перед вставкой вкладок)"
```

---

### Task 2: #1 Финансовая разбивка — вкладка «Расчёт долга»

**Files:**
- Modify: `mockups/collection/collection.html` (данные `credits[].debt`, хелперы, `panelRaschet`, регистрация вкладки)
- Modify: `scripts/inspect/collection-check.mjs` (ассерты)

**Interfaces:**
- Consumes: `PHASE_BY_MEASURE`, `curProc`, `toast`, `fmtKGS` (создаётся здесь).
- Produces:
  - `const DEBT_BUCKETS = ['principal','interest','penalty','fees']`
  - `fmtKGS(n:number) → string`, `debtLeft(b:{accrued,paid}) → number`
  - `parseSum(s:string) → number`, `phaseMeasureSum(p) → number|null`
  - `panelRaschet() → string` (HTML), вставлен в `TABS`/`builders` под индексом 2.
  - Поле `credits[i].debt` формы `{principal:{accrued,paid[,note]}, interest:{...}, penalty:{...}, fees:{...}}`; опц. `credits[i].debtNote:string`, `credits[i].writtenOff:boolean`.

- [ ] **Step 1: Написать падающие ассерты «Расчёт долга»**

В конец `scripts/inspect/collection-check.mjs`, ПЕРЕД финальным блоком `console.log(\`\nОШИБОК КОНСОЛИ...`, вставить:

```javascript
// === #1 Расчёт долга ===
await page.goto(FILE, { waitUntil: 'load' });
const fin = await page.evaluate(() => ({
  hasFmt: typeof fmtKGS === 'function',
  fmt: typeof fmtKGS === 'function' && fmtKGS(40000),
  hasLeft: typeof debtLeft === 'function',
  left: typeof debtLeft === 'function' && debtLeft({accrued:48900, paid:900}),
  // инвариант сумм: итог начислено = сумма меры-основания фазы, для всех процессов
  invariantOk: (typeof phaseMeasureSum === 'function') && PROCESSES.every(p => {
    const c = p.credits[0];
    if (!c || !c.debt) return false;
    const acc = ['principal','interest','penalty','fees'].reduce((s,k)=>s+c.debt[k].accrued, 0);
    const ms = phaseMeasureSum(p);
    return ms === null ? false : Math.abs(acc - ms) < 0.005;
  }),
  penaltyNote151: PROCESSES.find(p=>p.id==='151').credits[0].debt.penalty.note || '',
  writtenOff097: !!PROCESSES.find(p=>p.id==='097').credits[0].writtenOff,
}));
ok('fmtKGS форматирует с пробелом-разделителем', fin.fmt === '40 000,00');
ok('debtLeft = начислено − погашено', fin.left === 48000);
ok('инвариант: итог по статьям = сумма меры-основания фазы (все процессы)', fin.invariantOk === true);
ok('у 151 пеня несёт метку открытого вопроса (пауза)', /откр|пауз/i.test(fin.penaltyNote151));
ok('у 097 требование помечено «списано»', fin.writtenOff097 === true);

await page.click('#listBody tr[data-id="142"]');
await page.click('#btnOpen');
ok('после Task 2 вкладок 8', (await page.locator('#detailTabbar .dtab').count()) === 8);
await page.click('#detailTabbar .dtab:has-text("Расчёт долга")');
const rasch = page.locator('#detailPanels .detail-panel.active');
ok('в «Расчёт долга» есть итоговая строка', (await rasch.locator('table.cgrid tr.total').count()) >= 1);
ok('итог 142 = 48 900,00', (await rasch.locator('table.cgrid tr.total').first().innerText()).includes('48 900,00'));
```

- [ ] **Step 2: Прогнать — новые ассерты падают**

Run: `node scripts/inspect/collection-check.mjs`
Expected: FAIL на `fmtKGS`, `debtLeft`, инварианте и т.д. (функции/данные не объявлены).

- [ ] **Step 3: Добавить хелперы финразбивки**

В `collection.html`, сразу после объявления `stageOf` (около строки 770), добавить:

```javascript
/* ---- Финансовая разбивка требования (#1) ---- */
const DEBT_BUCKETS = ['principal','interest','penalty','fees'];
const DEBT_LABELS  = {principal:'Основная сумма', interest:'Проценты', penalty:'Пеня / фин. санкции', fees:'Сборы'};
/* Формат суммы в стиле макета: 40000 → '40 000,00' (обычный пробел, не U+202F от toLocaleString). */
const fmtKGS   = n => n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
/* Разбор зашитой строки суммы обратно в число: '48 900,00' → 48900. */
const parseSum = s => Number(String(s).replace(/\s/g, '').replace(',', '.'));
/* Остаток bucket'а — производное, в данных не хранится. */
const debtLeft = b => b.accrued - b.paid;
/* Сумма меры, установившей текущую фазу (инвариант сумм привязан к ней, не к последней мере). */
function phaseMeasureSum(p){
  const kind = PHASE_BY_MEASURE[p.phase];
  const m = [...p.measures].reverse().find(x => x.kind === kind);
  return m ? parseSum(m.sum) : null;
}
```

- [ ] **Step 4: Добавить поле `debt` каждому кредиту в `PROCESSES`**

К единственному объекту в `credits:[...]` каждого процесса добавить `debt` (и, где указано, `debtNote`/`writtenOff`). Итог `accrued` сходится с суммой меры-основания фазы:

```javascript
// 142 — фаза «Иск» ← ИСК-77 (48 900): рост пени
debt:{ principal:{accrued:40000,paid:0}, interest:{accrued:2600,paid:0}, penalty:{accrued:6300,paid:0}, fees:{accrued:0,paid:0} },
debtNote:'Требование выросло с первоначальных 42 600,00 за счёт начисленной пени.',
// 151 — фаза «Извещение» ← ИЗВ-09 (150 000): под паузой
debt:{ principal:{accrued:140000,paid:0}, interest:{accrued:6000,paid:0}, penalty:{accrued:4000,paid:0,note:'начисление при паузе — открытый вопрос'}, fees:{accrued:0,paid:0} },
// 133 — фаза «Повторная претензия» ← ПР-233 (18 200)
debt:{ principal:{accrued:17000,paid:0}, interest:{accrued:800,paid:0}, penalty:{accrued:400,paid:0}, fees:{accrued:0,paid:0} },
// 120 — фаза «На исполнении» ← ИЛ-305 (96 400): частичное погашение по мировому
debt:{ principal:{accrued:88000,paid:20000}, interest:{accrued:5000,paid:1000}, penalty:{accrued:3400,paid:0}, fees:{accrued:0,paid:0} },
debtNote:'Погашение идёт по графику мирового соглашения (МС-12).',
// 104 — фаза «На исполнении» ← ИЛ-288 (310 000): принятие имущества, остаток
debt:{ principal:{accrued:290000,paid:280000}, interest:{accrued:12000,paid:10000}, penalty:{accrued:8000,paid:5000}, fees:{accrued:0,paid:0} },
debtNote:'Имущество принято на 295 000,00; остаток 15 000,00 — судьба остатка не определена (ср. E2E-14).',
// 097 — фаза «На исполнении» ← ИЛ-201 (64 800): списано
debt:{ principal:{accrued:60000,paid:0}, interest:{accrued:3000,paid:0}, penalty:{accrued:1800,paid:0}, fees:{accrued:0,paid:0} },
writtenOff:true,
```

Вставлять каждое `debt:{...}` внутрь соответствующего объекта `credits:[{ ... }]` (после поля `coll`).

- [ ] **Step 5: Добавить билдер панели `panelRaschet`**

Перед `function renderPanels()` (около строки 1071) добавить:

```javascript
/* ---- panel: Расчёт долга (#1) ---- */
function panelRaschet(){
  const p = curProc;
  const blocks = p.credits.map(c => {
    if(!c.debt) return '';
    const rows = DEBT_BUCKETS.map(k => {
      const b = c.debt[k];
      const left = c.writtenOff ? '<span class="pill neutral">списано</span>' : fmtKGS(debtLeft(b));
      const note = b.note ? ` <span class="pill mid">${b.note}</span>` : '';
      return `<tr><td>${DEBT_LABELS[k]}${note}</td>
        <td style="text-align:right">${fmtKGS(b.accrued)}</td>
        <td style="text-align:right">${fmtKGS(b.paid)}</td>
        <td style="text-align:right">${left}</td></tr>`;
    }).join('');
    const tAcc  = DEBT_BUCKETS.reduce((s,k)=>s + c.debt[k].accrued, 0);
    const tPaid = DEBT_BUCKETS.reduce((s,k)=>s + c.debt[k].paid, 0);
    const tLeft = c.writtenOff ? '<span class="pill neutral">списано</span>' : fmtKGS(tAcc - tPaid);
    const noteBlk = c.debtNote ? `<p class="section-note" style="margin-top:8px">${c.debtNote}</p>` : '';
    return `<p class="section-h" style="margin-top:14px">${c.num}</p>
      <div class="cgrid-wrap"><table class="cgrid">
        <thead><tr><th>Статья долга</th><th style="text-align:right">Начислено</th><th style="text-align:right">Погашено</th><th style="text-align:right">Остаток</th></tr></thead>
        <tbody>${rows}
          <tr class="total"><td>Итого</td><td style="text-align:right">${fmtKGS(tAcc)}</td><td style="text-align:right">${fmtKGS(tPaid)}</td><td style="text-align:right">${tLeft}</td></tr>
        </tbody></table></div>${noteBlk}`;
  }).join('');
  return `<div class="panel-wrap">
    <p class="section-h">Расчёт долга</p>
    <p class="section-note">Разбивка требования на статьи (основная · проценты · пеня · сборы) с начислено / погашено / остаток. Порядок направления погашения (waterfall): при наличии судебного акта — сначала на присуждённую сумму; иначе основная → проценты → пеня → сборы. Пересчёт демонстрационный; итог «Начислено» сходится с суммой меры-основания текущей фазы.</p>
    ${blocks}
    <div class="gtoolbar" style="margin-top:12px">
      <button class="btn btn-tint btn-sm" onclick="toast('Распределение погашения по waterfall (демо)')">Распределить погашение</button>
    </div>
  </div>`;
}
```

- [ ] **Step 6: Зарегистрировать вкладку под индексом 2**

Изменить массивы `TABS` и `builders` (около строк 872 и 1072):

```javascript
const TABS = ['Общая информация','Охват','Расчёт долга','Журнал мер','Передачи дела','Особые состояния','Залог / реализация','История'];
```
```javascript
const builders=[panelObschaya,panelOhvat,panelRaschet,panelMery,panelHandoffs,panelSpecial,panelZalog,panelHistory];
```

- [ ] **Step 7: Прогнать — все ассерты зелёные**

Run: `node scripts/inspect/collection-check.mjs`
Expected: `ПРОВАЛЕНО АССЕРТОВ: 0`, `ОШИБОК КОНСОЛИ: 0`.

- [ ] **Step 8: Commit**

```bash
git add mockups/collection/collection.html scripts/inspect/collection-check.mjs
git commit -m "feat(mockup): взыскание — вкладка «Расчёт долга» (bucket'ы + waterfall, P9-R9)"
```

---

### Task 3: #2 Судебные заседания — вкладка «Заседания»

**Files:**
- Modify: `mockups/collection/collection.html` (данные `hearings[]`, `panelHearings`, регистрация вкладки)
- Modify: `scripts/inspect/collection-check.mjs`

**Interfaces:**
- Consumes: `curProc`, `toast`, `TABS`/`builders` из Task 2.
- Produces:
  - Поле `PROCESSES[i].hearings` — массив `{measureNum, kind, place, when, participants:string[], status, substatus}`.
  - `panelHearings() → string`, вставлен в `TABS`/`builders` под индексом 4 (после «Журнал мер»).

- [ ] **Step 1: Написать падающие ассерты «Заседания»**

В конец `scripts/inspect/collection-check.mjs` (перед финальным `console.log`) добавить:

```javascript
// === #2 Заседания ===
await page.goto(FILE, { waitUntil: 'load' });
await page.click('#listBody tr[data-id="142"]');
await page.click('#btnOpen');
ok('после Task 3 вкладок 9', (await page.locator('#detailTabbar .dtab').count()) === 9);
await page.click('#detailTabbar .dtab:has-text("Заседания")');
const hear = page.locator('#detailPanels .detail-panel.active');
ok('у 142 три заседания', (await hear.locator('table.cgrid tbody tr').count()) === 3);
ok('заседание ссылается на меру ИСК-77', (await hear.innerText()).includes('ИСК-77'));
ok('есть подстатус отложения', /отлож/i.test(await hear.innerText()));
ok('есть место — районный суд', /районный суд/i.test(await hear.innerText()));
// у досудебного 133 — пустое состояние
await page.goto(FILE, { waitUntil: 'load' });
await page.click('#listBody tr[data-id="133"]');
await page.click('#btnOpen');
await page.click('#detailTabbar .dtab:has-text("Заседания")');
ok('у 133 заседаний нет (пустое состояние)', (await page.locator('#detailPanels .detail-panel.active .cgrid-empty').count()) === 1);
```

- [ ] **Step 2: Прогнать — падает**

Run: `node scripts/inspect/collection-check.mjs`
Expected: FAIL (вкладок 8, «Заседания» нет).

- [ ] **Step 3: Добавить данные `hearings` процессам**

Процессу **142** добавить (внутрь объекта процесса, после массива `measures`):

```javascript
hearings:[
  {measureNum:'ИСК-77', kind:'Извещение о назначении судебного процесса', place:'Первомайский районный суд г. Бишкек', when:'02.06.2026 10:30', participants:['Тукинова А.С. (представитель ФКФ)'], status:'на рассмотрении', substatus:'назначено к предварительному слушанию'},
  {measureNum:'ИСК-77', kind:'Судебный процесс', place:'Первомайский районный суд г. Бишкек', when:'18.06.2026 14:00', participants:['Тукинова А.С. (представитель ФКФ)','Ответчик не явился'], status:'на рассмотрении', substatus:'отложено — неявка ответчика'},
  {measureNum:'ИСК-77', kind:'Судебный процесс', place:'Первомайский районный суд г. Бишкек', when:'09.07.2026 14:00', participants:['Тукинова А.С. (представитель ФКФ)','Бакиров Э. (ответчик)'], status:'на рассмотрении', substatus:'рассмотрение по существу'},
],
```

Остальным процессам (**151, 133, 120, 104, 097**) добавить пустой массив `hearings:[],` (после `measures`), чтобы билдер не падал на `undefined`.

- [ ] **Step 4: Добавить билдер `panelHearings`**

Перед `function renderPanels()` добавить:

```javascript
/* ---- panel: Заседания (#2) ---- */
function panelHearings(){
  const p = curProc;
  const rows = (p.hearings || []).map(h => `<tr>
    <td>${h.measureNum}</td><td>${h.kind}</td><td>${h.place}</td><td>${h.when}</td>
    <td>${(h.participants || []).join('<br>')}</td>
    <td>${h.status}${h.substatus ? ` <span class="pill mid">${h.substatus}</span>` : ''}</td></tr>`).join('');
  const body = rows || `<tr><td colspan="6"><div class="cgrid-empty">Судебных заседаний по процессу нет</div></td></tr>`;
  return `<div class="panel-wrap">
    <p class="section-h">Судебные заседания</p>
    <p class="section-note">Заседания и извещения о назначении — самостоятельные события внутри судебных мер («Иск», «Извещение», «Решение суда»). Каждое ссылается на меру-основание; статус несёт подстатус (исход / отложение).</p>
    <div class="gtoolbar">
      <button class="btn btn-tint btn-sm" onclick="toast('Назначить заседание (демо)')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg> Назначить заседание</button>
    </div>
    <div class="cgrid-wrap"><table class="cgrid">
      <thead><tr><th>Мера-основание</th><th>Вид события</th><th>Место</th><th>Дата / время</th><th>Участники</th><th>Статус</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div></div>`;
}
```

- [ ] **Step 5: Зарегистрировать вкладку под индексом 4**

```javascript
const TABS = ['Общая информация','Охват','Расчёт долга','Журнал мер','Заседания','Передачи дела','Особые состояния','Залог / реализация','История'];
```
```javascript
const builders=[panelObschaya,panelOhvat,panelRaschet,panelMery,panelHearings,panelHandoffs,panelSpecial,panelZalog,panelHistory];
```

- [ ] **Step 6: Прогнать — зелёные**

Run: `node scripts/inspect/collection-check.mjs`
Expected: `ПРОВАЛЕНО АССЕРТОВ: 0`, `ОШИБОК КОНСОЛИ: 0`.

- [ ] **Step 7: Commit**

```bash
git add mockups/collection/collection.html scripts/inspect/collection-check.mjs
git commit -m "feat(mockup): взыскание — вкладка «Заседания» (события внутри судебных мер)"
```

---

### Task 4: #5 Ответственный (ФИО) на мере и участники заседания

**Files:**
- Modify: `mockups/collection/collection.html` (`measures[].responsible`, колонка в `panelMery`)
- Modify: `scripts/inspect/collection-check.mjs`

**Interfaces:**
- Consumes: `panelMery` (существующий), `panelHearings` (Task 3; участники уже там).
- Produces: поле `measures[i].responsible:string`; колонка «Ответственный» в таблице «Журнал мер».

- [ ] **Step 1: Написать падающий ассерт**

В конец check-скрипта добавить:

```javascript
// === #5 Ответственный ===
await page.goto(FILE, { waitUntil: 'load' });
await page.click('#listBody tr[data-id="142"]');
await page.click('#btnOpen');
await page.click('#detailTabbar .dtab:has-text("Журнал мер")');
const meryResp = page.locator('#detailPanels .detail-panel.active');
ok('в «Журнале мер» есть колонка «Ответственный»', (await meryResp.locator('thead th:has-text("Ответственный")').count()) === 1);
ok('ФИО ответственного отрисовано', /Тукинова|Танаев|Осмонов/.test(await meryResp.innerText()));
```

- [ ] **Step 2: Прогнать — падает**

Run: `node scripts/inspect/collection-check.mjs`
Expected: FAIL (колонки «Ответственный» нет).

- [ ] **Step 3: Добавить `responsible` каждой мере**

Каждому объекту в `measures:[...]` всех процессов добавить поле `responsible` (ФИО в стиле legacy). Конкретные значения — по процессам:
- 142: все меры — `responsible:'Тукинова А.С.'`
- 151: `responsible:'Танаев У.Ш.'`
- 133: `responsible:'Осмонов К.'`
- 120: `responsible:'Эрнисов Б.Т.'`
- 104: `responsible:'Сагындыков М.'`
- 097: `responsible:'Тукинова А.С.'`

- [ ] **Step 4: Добавить колонку «Ответственный» в `panelMery`**

В `panelMery` (около строки 968) в шапке таблицы добавить `<th>` перед `<th style="text-align:right">Сумма</th>`:

```javascript
<th>Ответственный</th><th style="text-align:right">Сумма</th>
```

В теле строки (`rows`) добавить `<td>` перед ячейкой суммы:

```javascript
<td>${m.result}</td><td>${m.stageEx}</td><td>${m.responsible || '—'}</td><td style="text-align:right">${m.sum}</td></tr>`;
```

- [ ] **Step 5: Прогнать — зелёные**

Run: `node scripts/inspect/collection-check.mjs`
Expected: `ПРОВАЛЕНО АССЕРТОВ: 0`, `ОШИБОК КОНСОЛИ: 0`.

- [ ] **Step 6: Commit**

```bash
git add mockups/collection/collection.html scripts/inspect/collection-check.mjs
git commit -m "feat(mockup): взыскание — ответственный (ФИО) в журнале мер + участники заседаний"
```

---

### Task 5: #4 Доказательная база — вложения на мере

**Files:**
- Modify: `mockups/collection/collection.html` (`measures[].docs`, колонка-скрепка, `openDocsModal`, стаб загрузки в модалке меры)
- Modify: `scripts/inspect/collection-check.mjs`

**Interfaces:**
- Consumes: `curProc`, `closeModal`, `modalHost`, `escAttr`.
- Produces:
  - Поле `measures[i].docs` — массив `{name, kind}`.
  - `openDocsModal(procId:string, mIdx:number)` — модалка со списком вложений меры.
  - Колонка «Вложения» (скрепка + счётчик) в «Журнал мер».

- [ ] **Step 1: Написать падающие ассерты**

В конец check-скрипта добавить:

```javascript
// === #4 Вложения ===
await page.goto(FILE, { waitUntil: 'load' });
await page.click('#listBody tr[data-id="142"]');
await page.click('#btnOpen');
await page.click('#detailTabbar .dtab:has-text("Журнал мер")');
const meryDocs = page.locator('#detailPanels .detail-panel.active');
ok('в «Журнале мер» есть колонка «Вложения»', (await meryDocs.locator('thead th:has-text("Вложения")').count()) === 1);
ok('есть кнопка-скрепка со счётчиком', (await meryDocs.locator('button.docs-btn').first().isVisible()));
await meryDocs.locator('button.docs-btn').first().click();
ok('модалка вложений открылась', await page.locator('#modalHost.open').isVisible());
ok('в модалке перечислены сканы', /квитанц|скан|\.pdf/i.test(await page.locator('#modalHost').innerText()));
await page.keyboard.press('Escape');
ok('модалка вложений закрылась по Escape', !(await page.locator('#modalHost.open').isVisible()));
```

- [ ] **Step 2: Прогнать — падает**

Run: `node scripts/inspect/collection-check.mjs`
Expected: FAIL (колонки/кнопки нет).

- [ ] **Step 3: Добавить `docs` мерам (там, где есть подтверждение вручения)**

Мерам с подтверждённым вручением добавить `docs`. Минимально — первым мерам 142:
- 142 / Первичная претензия (ПР-118): `docs:[{name:'СЭД-квитанция ПР-118.pdf', kind:'подтверждение вручения'}]`
- 142 / Повторная претензия (ПР-140): `docs:[{name:'Почтовое уведомление ПР-140.pdf', kind:'подтверждение вручения'}]`
- 142 / Исковое заявление (ИСК-77): `docs:[{name:'Исковое заявление ИСК-77.pdf', kind:'процессуальный документ'},{name:'Расчёт задолженности.xlsx', kind:'приложение'}]`

Остальным мерам поле не обязательно (билдер обрабатывает отсутствие через `|| []`).

- [ ] **Step 4: Добавить колонку «Вложения» + кнопку-скрепку в `panelMery`**

Билдер `panelMery` строит строки через `p.measures.map(m => ...)`. Чтобы знать индекс меры, изменить сигнатуру map на `(m, mi)`. В шапку добавить `<th>Вложения</th>` (перед «Ответственный»). В строку — ячейку перед «Ответственный»:

```javascript
const rows = p.measures.map((m, mi) => {
    const bad = needsDelivery(m.kind) && !m.delivered;
    const nDocs = (m.docs || []).length;
    const docCell = nDocs
      ? `<button class="docs-btn btn-tint btn-sm" onclick="openDocsModal('${p.id}',${mi})" title="Вложения">📎 ${nDocs}</button>`
      : '<span style="color:var(--text-placeholder)">—</span>';
    return `<tr class="${bad ? 'mrow-undelivered' : ''}">
      <td>${m.sec}</td><td>${m.kind}</td><td>${m.date}</td><td>${m.num}</td>
      <td>${m.deliver}${bad ? ' <span class="pill mid">не исполнена: нет подтверждения вручения</span>' : ''}</td>
      <td>${m.result}</td><td>${m.stageEx}</td><td>${docCell}</td><td>${m.responsible || '—'}</td><td style="text-align:right">${m.sum}</td></tr>`;
  }).join('');
```

И в `<thead>` строку заголовков привести к:

```javascript
<thead><tr><th>Раздел</th><th>Вид меры</th><th>Дата</th><th>Номер</th><th>Направление / вручение</th><th>Результат</th><th>Стадия</th><th>Вложения</th><th>Ответственный</th><th style="text-align:right">Сумма</th></tr></thead>
```

- [ ] **Step 5: Добавить `openDocsModal`**

Рядом с `openMeasureModal` (около строки 1080) добавить:

```javascript
function openDocsModal(procId, mIdx){
  const p = PROCESSES.find(x => x.id === procId) || curProc;
  const m = p.measures[mIdx];
  const list = (m.docs || []).map(d => `<tr><td>${d.name}</td><td>${d.kind}</td></tr>`).join('')
    || `<tr><td colspan="2"><div class="cgrid-empty">Вложений нет</div></td></tr>`;
  const host = document.getElementById('modalHost');
  host.innerHTML = `<div class="modal narrow">
    <div class="modal-h"><span class="mt">Вложения меры ${m.num || m.kind}</span><button class="modal-x" onclick="closeModal()"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="modal-b"><div class="cgrid-wrap"><table class="cgrid">
      <thead><tr><th>Файл</th><th>Тип документа</th></tr></thead><tbody>${list}</tbody>
    </table></div></div>
    <div class="modal-f"><button class="btn btn-secondary" onclick="closeModal()">Закрыть</button></div>
  </div>`;
  host.classList.add('open');
}
```

- [ ] **Step 6: Добавить стаб загрузки скана в модалку регистрации меры**

В `openMeasureModal`, внутри `.mform` (после поля «Назначение»), добавить:

```javascript
<div class="field col-span"><span class="flabel">Скан документа / подтверждения вручения</span><div class="control grey"><input type="file"></div></div>
```

- [ ] **Step 7: Прогнать — зелёные**

Run: `node scripts/inspect/collection-check.mjs`
Expected: `ПРОВАЛЕНО АССЕРТОВ: 0`, `ОШИБОК КОНСОЛИ: 0`.

- [ ] **Step 8: Commit**

```bash
git add mockups/collection/collection.html scripts/inspect/collection-check.mjs
git commit -m "feat(mockup): взыскание — вложения-сканы на мере (доказательная база, P9-R4)"
```

---

### Task 6: #6 Состояние претензии (черновик/зарегистр.) + аннулирование меры-вехи

**Files:**
- Modify: `mockups/collection/collection.html` (`measures[].regState`, pill «черновик» в `panelMery`, действие «Аннулировать», `annulMeasure`)
- Modify: `scripts/inspect/collection-check.mjs`

**Interfaces:**
- Consumes: `panelMery`, `isMilestone`, `toast`, поле `responsible` (Task 4), колонка «Вложения» (Task 5).
- Produces:
  - Поле `measures[i].regState: 'черновик' | 'зарегистрирована'` (по умолчанию — зарегистрирована, если поле отсутствует).
  - `annulMeasure(kind:string)` — демо-действие с откатом фазы для вех.
  - Колонка действий с кнопкой «Аннулировать»; pill «черновик» в колонке «Номер».

- [ ] **Step 1: Написать падающие ассерты**

В конец check-скрипта добавить:

```javascript
// === #6 Состояние претензии + аннулирование ===
await page.goto(FILE, { waitUntil: 'load' });
await page.click('#listBody tr[data-id="133"]');
await page.click('#btnOpen');
await page.click('#detailTabbar .dtab:has-text("Журнал мер")');
const meryReg = page.locator('#detailPanels .detail-panel.active');
ok('у 133 есть мера-черновик (pill «черновик»)', (await meryReg.locator('.pill:has-text("черновик")').count()) >= 1);
ok('есть кнопка «Аннулировать»', (await meryReg.locator('button:has-text("Аннулировать")').first().isVisible()));
// аннулирование меры-вехи показывает откат фазы
await meryReg.locator('button:has-text("Аннулировать")').first().click();
ok('аннулирование меры-вехи даёт тост об откате фазы', /откач|фаз/i.test(await page.locator('#toastWrap').innerText()));
```

- [ ] **Step 2: Прогнать — падает**

Run: `node scripts/inspect/collection-check.mjs`
Expected: FAIL (нет pill «черновик»/кнопки).

- [ ] **Step 3: Добавить мере-черновику процесс 133**

В массив `measures` процесса **133** добавить (последним элементом) черновик-претензию:

```javascript
{sec:'Досудебный', kind:'Требование отраслевому госоргану', date:'', num:'', purpose:'уведомление отраслевого госоргана', deliver:'Не направлялась', delivered:false, result:'на рассмотрении', stageEx:'черновик', sum:'18 200,00', responsible:'Осмонов К.', regState:'черновик'},
```

(Остальные меры регистрируются по умолчанию — поле `regState` можно не добавлять; отсутствие трактуется как «зарегистрирована».)

- [ ] **Step 4: Показать pill «черновик» и колонку действий в `panelMery`**

В `panelMery`, в ячейке «Номер» показать pill, если мера — черновик; добавить финальную колонку действий. Обновить строку (в дополнение к изменениям Task 5):

Ячейка номера:
```javascript
<td>${m.num || ''}${m.regState === 'черновик' ? ' <span class="pill mid">черновик</span>' : ''}</td>
```
Перед закрывающим `</tr>` строки — колонка действий:
```javascript
<td><button class="btn-tint btn-sm danger" onclick="annulMeasure('${escAttr(m.kind)}')">Аннулировать</button></td></tr>`;
```
В `<thead>` в конец строки заголовков добавить `<th></th>` (для колонки действий).

- [ ] **Step 5: Добавить `annulMeasure`**

Рядом с `openMeasureModal` добавить:

```javascript
/* Аннулирование меры (#6). Веха — единственный обратный ход в forward-only машине фаз:
   откат к предыдущей вехе. Демо: тост + (в проде) запись в Историю. */
function annulMeasure(kind){
  if(isMilestone(kind)) toast('Мера аннулирована → фаза откачена к предыдущей вехе (демо)', 'warn');
  else toast('Мера аннулирована (демо)');
}
```

- [ ] **Step 6: Прогнать — зелёные**

Run: `node scripts/inspect/collection-check.mjs`
Expected: `ПРОВАЛЕНО АССЕРТОВ: 0`, `ОШИБОК КОНСОЛИ: 0`.

- [ ] **Step 7: Commit**

```bash
git add mockups/collection/collection.html scripts/inspect/collection-check.mjs
git commit -m "feat(mockup): взыскание — состояние претензии черновик/зарегистр. + аннулирование меры-вехи"
```

---

### Task 7: #3 Кросс-процессные реестры + фильтры стадии в сайдбаре

**Files:**
- Modify: `mockups/collection/collection.html` (сайдбар-роутер, `stageFilter` в `renderList`, две новые view-секции + рендер-функции)
- Modify: `scripts/inspect/collection-check.mjs`

**Interfaces:**
- Consumes: `PROCESSES`, `procNo`, `renderList`, `showView`, `phaseFullText`, `isTerminal`.
- Produces:
  - Глобаль `let stageFilter = null` и фильтрация в `renderList`.
  - `navClick(label)` — роутер (реестры / фильтры стадии / список).
  - `renderHearingsRegistry()`, `renderClaimsRegistry()` — заполняют новые секции `#view-hearings`, `#view-claims`.

- [ ] **Step 1: Написать падающие ассерты**

В конец check-скрипта добавить:

```javascript
// === #3 Кросс-процессные реестры + фильтры стадии ===
await page.goto(FILE, { waitUntil: 'load' });
// реестр заседаний
await page.click('.nav-item:has-text("Заседания (реестр)")');
ok('реестр заседаний открылся', await page.locator('#view-hearings').isVisible());
ok('в реестре заседаний собраны заседания всех процессов (>=3)', (await page.locator('#hearingsBody tr').count()) >= 3);
ok('в реестре заседаний есть фильтр по датам', (await page.locator('#view-hearings input[type="date"]').count()) === 2);
// реестр претензий
await page.click('.nav-item:has-text("Претензии (реестр)")');
ok('реестр претензий открылся', await page.locator('#view-claims').isVisible());
ok('в реестре претензий есть строка-черновик', /черновик/i.test(await page.locator('#claimsBody').innerText()));
// фильтр стадии
await page.click('.nav-item:has-text("Судебный порядок")');
ok('фильтр «Судебный порядок» вернул к списку', await page.locator('#view-list').isVisible());
const filtered = await page.locator('#listBody tr').count();
ok('судебный фильтр отсеивает часть процессов', filtered > 0 && filtered < 6);
// сброс через «Процессы взыскания»
await page.click('.nav-item:has-text("Процессы взыскания")');
ok('сброс фильтра возвращает 6 процессов', (await page.locator('#listBody tr').count()) === 6);
```

- [ ] **Step 2: Прогнать — падает**

Run: `node scripts/inspect/collection-check.mjs`
Expected: FAIL (секций/пунктов нет).

- [ ] **Step 3: Добавить пункты в сайдбар-дерево**

В `TREE`, узел `debt` (около строки 546), в `items` группы `debt-all` добавить два реестра после существующих пунктов:

```javascript
{ id:"debt", label:"Взыскание задолженности", open:true, subs:[
  { id:"debt-all", headerless:true, items:[
    { label:"Процессы взыскания", active:true },
    { label:"Досудебный порядок" }, { label:"Судебный порядок" },
    { label:"Исполнительное производство" }, { label:"Отчуждение активов" },
    { label:"Заседания (реестр)" }, { label:"Претензии (реестр)" } ]} ]},
```

- [ ] **Step 4: Добавить `stageFilter` и фильтрацию в `renderList`**

Возле `let selectedRow = null, sortKey='id', sortDir=1;` (строка 824) добавить:

```javascript
let stageFilter = null;   // фильтр по разделу мер (sec): 'Досудебный' | 'Судебный' | 'Исполнительное' | 'Отчуждение'
```

В `renderList`, строку `const rows = [...PROCESSES].sort(...)` заменить так, чтобы сначала применялся фильтр:

```javascript
  let src = [...PROCESSES];
  if(stageFilter) src = src.filter(p => p.measures.some(m => m.sec === stageFilter));
  const rows = src.sort((a,b)=>{
```

И строку счётчика — на длину отфильтрованного набора:

```javascript
  document.getElementById('pagerCount').textContent = rows.length + ' процессов';
```

- [ ] **Step 5: Переписать `navClick` в роутер**

Заменить `function navClick(l){ ... }` (строка 568) на:

```javascript
function navClick(l){
  if(l === 'Процессы взыскания'){ stageFilter = null; renderList(); showView('list'); return; }
  if(l === 'Заседания (реестр)'){ renderHearingsRegistry(); showView('hearings'); return; }
  if(l === 'Претензии (реестр)'){ renderClaimsRegistry(); showView('claims'); return; }
  const secMap = {
    'Досудебный порядок':'Досудебный', 'Судебный порядок':'Судебный',
    'Исполнительное производство':'Исполнительное', 'Отчуждение активов':'Отчуждение',
  };
  if(l in secMap){ stageFilter = secMap[l]; renderList(); showView('list'); toast(`Фильтр: ${l}`); return; }
  toast('Демо-макет: раздел в разработке');
}
```

- [ ] **Step 6: Добавить две view-секции в разметку**

После секции `<section class="view" id="view-detail">…</section>` (перед закрывающим `</div>` контента, около строки 527) добавить:

```html
      <!-- ============ РЕЕСТР ЗАСЕДАНИЙ ============ -->
      <section class="view" id="view-hearings">
        <div class="grid-wrap" style="padding-top:16px">
          <div class="gtoolbar">
            <span class="section-note">С даты <input type="date"></span>
            <span class="section-note">по дату <input type="date"></span>
            <button class="btn btn-tint btn-sm" onclick="toast('Фильтр применён (демо)')">Применить</button>
          </div>
          <div class="cgrid-wrap"><table class="cgrid">
            <thead><tr><th>Заёмщик</th><th>Процесс</th><th>Мера</th><th>Вид события</th><th>Место</th><th>Дата / время</th><th>Статус</th></tr></thead>
            <tbody id="hearingsBody"></tbody>
          </table></div>
        </div>
      </section>

      <!-- ============ РЕЕСТР ПРЕТЕНЗИЙ ============ -->
      <section class="view" id="view-claims">
        <div class="grid-wrap" style="padding-top:16px">
          <div class="cgrid-wrap"><table class="cgrid">
            <thead><tr><th>Статус</th><th>Номер</th><th>Дата рег.</th><th>Заёмщик</th><th>Процесс</th><th style="text-align:right">Сумма</th></tr></thead>
            <tbody id="claimsBody"></tbody>
          </table></div>
        </div>
      </section>
```

- [ ] **Step 7: Добавить рендер-функции реестров**

Перед `renderNav(); renderList();` (конец скрипта, около строки 1145) добавить:

```javascript
/* ---- Кросс-процессные реестры (#3) ---- */
function renderHearingsRegistry(){
  const rows = PROCESSES.flatMap(p => (p.hearings || []).map(h => `<tr class="rowlink" onclick="openDetail('${p.id}')">
    <td>${p.borrower}</td><td>${procNo(p.id)}</td><td>${h.measureNum}</td><td>${h.kind}</td>
    <td>${h.place}</td><td>${h.when}</td>
    <td>${h.status}${h.substatus ? ` <span class="pill mid">${h.substatus}</span>` : ''}</td></tr>`)).join('');
  document.getElementById('hearingsBody').innerHTML = rows
    || `<tr><td colspan="7"><div class="cgrid-empty">Заседаний нет</div></td></tr>`;
}
const CLAIM_KINDS = new Set(['Первичная претензия','Повторная претензия','Требование поручителю','Требование гаранту','Требование отраслевому госоргану']);
function renderClaimsRegistry(){
  const rows = PROCESSES.flatMap(p => p.measures
    .filter(m => CLAIM_KINDS.has(m.kind))
    .map(m => {
      const draft = m.regState === 'черновик';
      const pill = draft ? '<span class="pill mid">черновик</span>' : '<span class="pill low">зарегистрирована</span>';
      return `<tr class="rowlink" onclick="openDetail('${p.id}')">
        <td>${pill}</td><td>${m.num || '—'}</td><td>${m.date || '—'}</td>
        <td>${p.borrower}</td><td>${procNo(p.id)}</td><td style="text-align:right">${m.sum}</td></tr>`;
    })).join('');
  document.getElementById('claimsBody').innerHTML = rows
    || `<tr><td colspan="6"><div class="cgrid-empty">Претензий нет</div></td></tr>`;
}
```

- [ ] **Step 8: Разрешить `showView` для новых секций**

Проверить `showView(v)` (строка 1129): он скрывает все `.view` и показывает `#view-<v>` как `flex`. Значения `'hearings'`/`'claims'` работают без изменений, т.к. секции имеют id `view-hearings`/`view-claims`. Убедиться, что крошка сбрасывается: в `showView`, ветку `if(v==='list')` дополнить заголовками реестров:

```javascript
function showView(v){ document.querySelectorAll('.view').forEach(s=>s.style.display='none');
  document.getElementById('view-'+v).style.display='flex';
  const titles = {list:'Взыскание задолженности', hearings:'Реестр заседаний', claims:'Реестр претензий'};
  if(titles[v]) document.getElementById('crumbTitle').textContent = titles[v]; }
```

- [ ] **Step 9: Прогнать — зелёные**

Run: `node scripts/inspect/collection-check.mjs`
Expected: `ПРОВАЛЕНО АССЕРТОВ: 0`, `ОШИБОК КОНСОЛИ: 0`.

- [ ] **Step 10: Commit**

```bash
git add mockups/collection/collection.html scripts/inspect/collection-check.mjs
git commit -m "feat(mockup): взыскание — реестры заседаний/претензий + фильтры стадии в сайдбаре"
```

---

### Task 8: Обновить документацию модуля

**Files:**
- Modify: `mockups/collection/collection.html` (шапка-комментарий — новые вкладки/реестры)
- Modify: `TODO.md` (отметить закрытые пункты P9-R*, если применимо)

**Interfaces:**
- Consumes: всё построенное в Task 2–7.

- [ ] **Step 1: Обновить шапку-комментарий макета**

В верхнем комментарии `collection.html` (блок «КЛЮЧЕВЫЕ ДОМЕННЫЕ РЕШЕНИЯ») добавить пункт про 9 вкладок и два кросс-процессных реестра, а в «ОТКРЫТЫЕ ВОПРОСЫ» — про судьбу остатка после принятия имущества (процесс 104). Держать демо-ограничения актуальными (кнопки «Распределить погашение», «Назначить заседание», «Аннулировать» — тосты).

- [ ] **Step 2: Обновить `TODO.md` (P9-R9 — расчётные эффекты теперь показаны)**

В `TODO.md` §«Фаза 9», в пункте `P9-R9`, дописать, что макет теперь демонстрирует финразбивку и waterfall на вкладке «Расчёт долга». Не менять статус чекбокса (это рекомендация команде, не задача репо). Правку `TODO.md` делать через редактор Claude Code — сработает hook авто-синка Sheet.

- [ ] **Step 3: Финальный прогон проверки**

Run: `node scripts/inspect/collection-check.mjs`
Expected: `ПРОВАЛЕНО АССЕРТОВ: 0`, `ОШИБОК КОНСОЛИ: 0`.

- [ ] **Step 4: Commit**

```bash
git add mockups/collection/collection.html TODO.md
git commit -m "docs(mockup): взыскание — синхронизация шапки макета и TODO с дозагрузкой legacy-фич"
```

---

## Self-Review

**Spec coverage:**
- #1 Финразбивка → Task 2 ✓ (bucket'ы, waterfall-заметка, инвариант, истории 142/151/120/104/097)
- #2 Заседания → Task 3 ✓ (вкладка, hearings, подстатус, пустое состояние)
- #3 Кросс-процессные реестры → Task 7 ✓ (2 реестра, фильтр дат, фильтры стадии)
- #4 Вложения → Task 5 ✓ (docs, скрепка, модалка, стаб загрузки)
- #5 ФИО → Task 4 ✓ (responsible, участники уже в Task 3)
- #6 Состояние претензии + аннулирование → Task 6 ✓
- Инвариант сумм → Task 2 Step 1 (ассерт на всех процессах) ✓
- Открытые вопросы (пеня при паузе, остаток 104) → данные Task 2 + доки Task 8 ✓

**Placeholder scan:** код приведён полностью в каждом шаге; «—» в ячейках — это UI-заглушки пустых значений, не плейсхолдеры плана.

**Type consistency:** имена сквозные — `fmtKGS`, `debtLeft`, `parseSum`, `phaseMeasureSum`, `DEBT_BUCKETS`, `panelRaschet`, `panelHearings`, `openDocsModal`, `annulMeasure`, `stageFilter`, `renderHearingsRegistry`, `renderClaimsRegistry`. Порядок `TABS`/`builders` синхронизирован (Task 2 индекс 2, Task 3 индекс 4). Колонки `panelMery` наращиваются согласованно через Task 4→5→6 (Ответственный → Вложения → действия/черновик).

**Порядок задач:** харденинг (1) → две вкладки (2,3) → обогащение журнала мер (4,5,6, все правят `panelMery` последовательно) → кросс-процессные реестры (7, зависят от `hearings` из 3 и `regState` из 6) → доки (8).
