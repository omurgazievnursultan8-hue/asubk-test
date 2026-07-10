# Мокап «Взыскание задолженности» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Собрать `mockups/collection/collection.html` — самодостаточный интерактивный to-be макет модуля взыскания задолженности, укрепив готовый черновик до уровня спека.

**Architecture:** Один HTML-файл (CSS в `<head>`, ванильный JS перед `</body>`). База — черновик `/home/azamat/Downloads/collection.html` (890 строк, рабочий). Данные — константа `PROCESSES`; производные значения (категория риска, стадия, пересечение охвата) вычисляются функциями, а не хранятся. Рендер — строковые шаблоны в функции-панели на вкладку.

**Tech Stack:** HTML5 + vanilla JS. Проверка — `playwright-core` (уже в `node_modules`) + system Chrome, скрипт `scripts/inspect/collection-check.mjs`, гоняющий `file://`-URL мокапа.

## Global Constraints

- Спек: `docs/superpowers/specs/2026-07-10-collection-mockup-design.md`. При расхождении плана и спека — прав спек.
- Один файл, без внешних зависимостей, CDN, шрифтов. Открывается двойным кликом.
- Весь текст, данные и комментарии — на русском.
- Палитра: синий `#006AF5`, зелёный `#158443`, красный `#E03A3A`, янтарный `#B8860B`. Только светлая тема. Сетка 4px, радиусы 4px, контролы 36px.
- Категория риска: `0–5 дн` норма · `6–180 дн` средний · `181+ дн` высокий.
- Номера процессов — структурные: `В-2026-000142`.
- Фаза НЕ редактируется селектором. Стадия и категория НЕ хранятся в данных.
- Внизу карточки — только «Закрыть». Никаких OK/Отмена.
- `notes/qa-findings.md` не трогать.
- Тест-цикл каждой задачи: дописать ассерты в `scripts/inspect/collection-check.mjs` → `node scripts/inspect/collection-check.mjs` → увидеть `FAIL` → реализовать → увидеть `ok` → коммит.
- Скрипт печатает `ok` / `FAIL` построчно и в конце `ОШИБОК КОНСОЛИ: N`. Считать задачу сделанной только при нуле `FAIL` и нуле ошибок консоли.

---

### Task 1: Порт черновика в репо + чек-скрипт

**Files:**
- Create: `mockups/collection/collection.html` (копия черновика + правки шапки и номеров)
- Create: `scripts/inspect/collection-check.mjs`

**Interfaces:**
- Consumes: черновик `/home/azamat/Downloads/collection.html`
- Produces: `PROCESSES` (массив объектов процесса), `procNo(id)` → `'В-2026-000142'`, глобальные `openDetail(id)`, `selectRow(id, el)`, `renderList()`. DOM-якоря: `#listBody tr[data-id]`, `#btnOpen`, `#detailTabbar .dtab`, `#detailPanels .detail-panel`, `#modalHost`, `#toastWrap`, `#crumbTitle`.

- [ ] **Step 1: Скопировать черновик в репо**

```bash
mkdir -p mockups/collection
cp "/home/azamat/Downloads/collection.html" mockups/collection/collection.html
```

- [ ] **Step 2: Написать чек-скрипт с падающими ассертами**

Create `scripts/inspect/collection-check.mjs`:

```js
// Проверка to-be мокапа взыскания (mockups/collection/collection.html).
// Спек: docs/superpowers/specs/2026-07-10-collection-mockup-design.md
// Запуск: node scripts/inspect/collection-check.mjs
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const FILE = pathToFileURL(resolve('mockups/collection/collection.html')).href;
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.goto(FILE, { waitUntil: 'load' });

let fails = 0;
const ok = (name, cond) => { if (!cond) fails++; console.log(`${cond ? '  ok' : 'FAIL'}  ${name}`); };

// --- T1: список ---
ok('4 процесса в гриде', (await page.locator('#listBody tr').count()) === 4);
ok('№ процесса структурный', (await page.locator('#listBody tr[data-id="142"] td').first().innerText()) === 'В-2026-000142');
ok('«Открыть процесс» заблокирована до выбора', await page.locator('#btnOpen').isDisabled());
await page.click('#listBody tr[data-id="142"]');
ok('после выбора строки кнопка активна', !(await page.locator('#btnOpen').isDisabled()));
await page.click('#btnOpen');
ok('7 вкладок', (await page.locator('#detailTabbar .dtab').count()) === 7);
ok('хлебная крошка с номером', (await page.locator('#crumbTitle').innerText()).includes('В-2026-000142'));

console.log(`\nОШИБОК КОНСОЛИ: ${errors.length}`);
errors.forEach(e => console.log('  ' + e));
console.log(`ПРОВАЛЕНО АССЕРТОВ: ${fails}`);
await ctx.close();
process.exit(fails || errors.length ? 1 : 0);
```

- [ ] **Step 3: Запустить — часть ассертов падает**

Run: `node scripts/inspect/collection-check.mjs`
Expected: `FAIL  № процесса структурный` (сейчас `№142`), `FAIL  хлебная крошка с номером`. Остальные `ok`.

- [ ] **Step 4: Добавить `procNo()` и применить в трёх местах**

В `mockups/collection/collection.html`, сразу после объявления `const PROCESSES = [...]`:

```js
/* Структурный номер процесса — единый формат с З-… (заявки) и К-… (комиссии), P3-R27. */
const procNo = id => `В-2026-${String(id).padStart(6, '0')}`;
```

В `renderList()` заменить ячейку номера:

```js
      <td>${procNo(p.id)}</td>
```

В `openDetail(id)` заменить строку крошки:

```js
  document.getElementById('crumbTitle').textContent = `${procNo(curProc.id)} · ${curProc.borrower}`;
```

В `phaseHeader()` заменить подпись под именем заёмщика:

```js
        <div class="phead-sub" style="width:100%">${procNo(p.id)} · охват: <b>${p.scope}</b></div>
```

- [ ] **Step 5: Заменить шапку-комментарий файла**

Заменить весь HTML-комментарий после `<title>` (строки 7–30 черновика) на:

```html
<!--
  MOCKUP (single-file, interactive) — TO-BE модуля «Взыскание задолженности»
  (список процессов → карточка процесса). Образец для команды разработки, не прод-код.

  ЭТО НЕ КЛОН ЖИВОГО СТЕНДА: экрана взыскания в системе нет, модуль проектируется
  с нуля. Дефектов по нему нет и в `notes/qa-findings.md` не заводится.
  Рекомендации команде: `TODO.md`, секция «Фаза 9 — Взыскание задолженности» (P9-R1…R9).
  Спек: `docs/superpowers/specs/2026-07-10-collection-mockup-design.md`.
  Проверка: `node scripts/inspect/collection-check.mjs`.

  Источники логики (вне репозитория): регламент «Порядок мониторинга, взыскания и
  урегулирования задолженности по бюджетным кредитам ОАО "Госфинхолдинг"» (99 пунктов,
  17 глав) и ТЗ, раздел 2.5. Стиль сверен с `mockups/loan-credit/`.

  КЛЮЧЕВЫЕ ДОМЕННЫЕ РЕШЕНИЯ

  1. Единица работы — ПРОЦЕСС ВЗЫСКАНИЯ, не кредит. Список показывает процессы.
     Процесс привязан к ОДНОМУ ЗАЁМЩИКУ (ИНН — якорь).

  2. Кредит ↔ процесс — МНОГИЕ-КО-МНОГИМ. Ранняя редакция логики фиксировала
     «не более одного активного процесса на кредит» — ЭТО РЕШЕНИЕ ОТМЕНЕНО.
     По одному кредиту идут несколько процессов, различающихся ПРЕДМЕТОМ ТРЕБОВАНИЯ
     (см. пару 142 «просроченная сумма» / 151 «залог» по дог. №56). Связь живёт
     в «Охвате процесса». Контроль пересечения — мягкое предупреждение, не запрет.

  3. ТРИ НЕЗАВИСИМЫХ ИЗМЕРЕНИЯ СОСТОЯНИЯ, не сливать в одно поле «статус»:
       • Категория риска — ВЫЧИСЛЕНА из дней просрочки (catOf), только чтение.
         0–5 дн норма · 6–180 дн средний риск · 181+ дн высокий риск.
       • Группа платежеспособности — атрибут ЗАЁМЩИКА, процесс её только читает.
       • Фаза — двигается ТОЛЬКО регистрацией меры-вехи в журнале мер, не селектором.
       • Стадия — ПРОИЗВОДНАЯ от фазы (stageOf), не хранится.
     Поэтому в данных процесса нет полей `cat` и `stage` — только `catDays` и `phase`.

  4. Шапка карточки — панель-ИНДИКАТОР, а не форма. Под каждой плиткой подпись
     источника значения. Ни одно из четырёх измерений не редактируется.
     Карточка целиком read-only → внизу только «Закрыть», без OK/Отмена (единая ИА
     с `mockups/loan-application-commission/commission.html`, P3-R29).

  5. ТРИ РАЗНЫХ не-фазовых механизма поверх любой стадии, баннером в шапке:
       • ПАУЗА (янтарный) — заморозка с дедлайном ≤70 дн. Фаза сохраняется,
         счётчик дней НЕ замораживается. Обязателен scope: весь процесс vs одна мера.
       • СОГЛАШЕНИЕ (синий) — мировое / добровольное исполнение. НЕ пауза:
         у паузы дедлайн, который пережидают; здесь новый график, который мониторят.
       • СОБЫТИЕ (красный) — смерть, недееспособность. Уводит вбок в спецпроцедуру.
     У всех трёх фаза СОХРАНЯЕТСЯ.

  6. Исход переключает группу платежеспособности заёмщика. Необратимое действие
     (безакцепт, принятие имущества, списание, внесудебное обращение) требует
     решения комитета — общий паттерн, не частный случай.

  7. Апелляции и кассации — меры ВНУТРИ фазы «Иск» / «Решение суда», не новые фазы.

  8. Демо-ограничения: кнопки паузы/соглашения/события показывают тост, без модалок;
     пересчёт суммы при извещении не выполняется в рантайме (показан результат
     в данных процесса 151 + заметка о правиле).

  ОТКРЫТЫЕ ВОПРОСЫ (макет их фиксирует, но не решает)

  - Пени во время паузы: продолжают ли начисляться финансовые санкции при заморозке
    (реструктуризация / мировое соглашение). Бизнес-вопрос, ответа нет.
  - Вкладку обеспечения кредита нужно расширить на поручительства, гарантии и депозит —
    без этого не автогенерируется список требований обеспечителям (досудебный шаг 2).
  - Флаг «право безакцептного списания» на кредитном договоре: вероятно, отсутствует.
    Требует проверки — это предусловие фазы «Безакцептное списание».
-->
```

- [ ] **Step 6: Запустить чек-скрипт — всё зелёное**

Run: `node scripts/inspect/collection-check.mjs`
Expected: все ассерты `ok`, `ОШИБОК КОНСОЛИ: 0`, `ПРОВАЛЕНО АССЕРТОВ: 0`, exit 0.

- [ ] **Step 7: Коммит**

```bash
git add mockups/collection/collection.html scripts/inspect/collection-check.mjs
git commit -m "feat(mockup): collection — порт черновика, структурные номера, чек-скрипт"
```

---

### Task 2: Категория и стадия — из данных в код

**Files:**
- Modify: `mockups/collection/collection.html` (константы фаз, `PROCESSES`, `renderList`, `phaseHeader`, `panelObschaya`, `phaseTimeline`)
- Modify: `scripts/inspect/collection-check.mjs`

**Interfaces:**
- Consumes: `PROCESSES`, `procNo(id)` из Task 1.
- Produces: `catOf(days)` → `'norm' | 'mid' | 'high'`; `stageOf(phase)` → `'Досудебная' | 'Принудительная'`; `catLabel(c)`, `catCls(c)`. Поля `cat` и `stage` из объектов `PROCESSES` **удалены**. Позже задачи читают категорию как `catOf(p.catDays)`, стадию как `stageOf(p.phase)`.

- [ ] **Step 1: Дописать падающие ассерты**

В `scripts/inspect/collection-check.mjs` перед строкой `console.log(\`\nОШИБОК КОНСОЛИ...\`)` вставить:

```js
// --- T2: вычисляемые правила ---
const rules = await page.evaluate(() => ({
  hasCatOf: typeof catOf === 'function',
  hasStageOf: typeof stageOf === 'function',
  b5:   typeof catOf === 'function' && catOf(5),
  b6:   typeof catOf === 'function' && catOf(6),
  b180: typeof catOf === 'function' && catOf(180),
  b181: typeof catOf === 'function' && catOf(181),
  storedCat:   PROCESSES.some(p => 'cat' in p),
  storedStage: PROCESSES.some(p => 'stage' in p),
  stageOfIsk:  typeof stageOf === 'function' && stageOf('Иск'),
  stageOfPret: typeof stageOf === 'function' && stageOf('Повторная претензия'),
}));
ok('catOf объявлена', rules.hasCatOf);
ok('stageOf объявлена', rules.hasStageOf);
ok('граница 5 дн → норма', rules.b5 === 'norm');
ok('граница 6 дн → средний', rules.b6 === 'mid');
ok('граница 180 дн → средний', rules.b180 === 'mid');
ok('граница 181 дн → высокий', rules.b181 === 'high');
ok('поле cat удалено из данных', rules.storedCat === false);
ok('поле stage удалено из данных', rules.storedStage === false);
ok('stageOf(«Иск») → Принудительная', rules.stageOfIsk === 'Принудительная');
ok('stageOf(«Повторная претензия») → Досудебная', rules.stageOfPret === 'Досудебная');
```

- [ ] **Step 2: Запустить — падает**

Run: `node scripts/inspect/collection-check.mjs`
Expected: `PAGEERROR: catOf is not defined` либо `FAIL catOf объявлена` и далее. Exit 1.

- [ ] **Step 3: Объявить правила и вычистить данные**

Заменить строки-константы фаз и хелперы категории (сразу после `const PROCESSES = [...]`, там где сейчас `const catLabel = ...`) на:

```js
/* ============================================================
   ВЫЧИСЛЯЕМЫЕ ПРАВИЛА — не хранить то, что выводится.
   Категория и стадия НЕ лежат в данных процесса: категория считается
   из дней просрочки, стадия — из фазы. Разработчик видит формулу.
   ============================================================ */
const catOf   = days  => days <= 5 ? 'norm' : days <= 180 ? 'mid' : 'high';
const stageOf = phase => PHASES_PRE.includes(phase) ? 'Досудебная' : 'Принудительная';

const catLabel = c => c === 'norm' ? 'Норма' : c === 'mid' ? 'Средний' : 'Высокий';
const catCls   = c => c === 'norm' ? 'low'   : c === 'mid' ? 'mid'     : 'high';
```

В каждом из 4 объектов `PROCESSES` удалить поля `cat:` и `stage:`, оставив `catDays:` и `phase:`. Пример для процесса 142 — было:

```js
    stage:'Принудительная', phase:'Иск', cat:'high', catDays:214, group:'2.1',
```

стало:

```js
    phase:'Иск', catDays:214, group:'2.1',
```

- [ ] **Step 4: Обновить три места чтения**

`renderList()` — ячейка категории:

```js
      <td><span class="pill ${catCls(catOf(p.catDays))}">${catLabel(catOf(p.catDays))}</span></td>
```

`phaseHeader()` — плитки стадии и категории:

```js
      <div class="dim"><div class="dl">Стадия</div><div class="dv">${stageOf(p.phase)}</div><div class="src">производная от фазы</div></div>
```

```js
      <div class="dim"><div class="dl">Категория риска</div><div class="dv"><span class="pill ${catCls(catOf(p.catDays))}">${catLabel(catOf(p.catDays))}</span></div><div class="src">вычислено · ${p.catDays} дн просрочки</div></div>
```

`panelObschaya()` — поле стадии:

```js
      ${ro('Стадия', stageOf(p.phase))}
```

`phaseTimeline()` — выбор цепочки:

```js
  const chain = stageOf(p.phase) === 'Досудебная' ? PHASES_PRE : PHASES_FORCE;
```

- [ ] **Step 5: Запустить — зелёное**

Run: `node scripts/inspect/collection-check.mjs`
Expected: все ассерты `ok`, `ПРОВАЛЕНО АССЕРТОВ: 0`, exit 0.

- [ ] **Step 6: Коммит**

```bash
git add mockups/collection/collection.html scripts/inspect/collection-check.mjs
git commit -m "feat(mockup): collection — категория и стадия вычисляются, а не хранятся"
```

---

### Task 3: Данные — 6 процессов, два терминальных

**Files:**
- Modify: `mockups/collection/collection.html` (`PROCESSES`, `renderList`, `panelObschaya`, CSS)
- Modify: `scripts/inspect/collection-check.mjs`

**Interfaces:**
- Consumes: `catOf`, `stageOf`, `procNo`.
- Produces: у объектов процесса новые поля `outcome` (строка или `null`) и `closed` (дата или `''`). Функция `isTerminal(p)` → `boolean`. CSS-класс `tr.terminal` для приглушённой строки списка. Процессы 104 и 097 — терминальные.

- [ ] **Step 1: Дописать падающие ассерты**

```js
// --- T3: 6 процессов, два терминальных ---
await page.goto(FILE, { waitUntil: 'load' });
ok('6 процессов в гриде', (await page.locator('#listBody tr').count()) === 6);
ok('терминальная строка приглушена', (await page.locator('#listBody tr.terminal').count()) === 2);
const t104 = page.locator('#listBody tr[data-id="104"]');
ok('у 104 в колонке фазы — исход', (await t104.locator('td').nth(3).innerText()).includes('Принятие имущества'));
const t097 = page.locator('#listBody tr[data-id="097"], #listBody tr[data-id="97"]');
ok('у 097 группа 4', (await t097.locator('td').nth(5).innerText()) === '4');
await page.click('#listBody tr[data-id="104"]');
await page.click('#btnOpen');
const gen104 = page.locator('#detailPanels .detail-panel').first();
ok('исход заполнен на «Общей»', (await gen104.innerText()).includes('Принятие имущества'));
ok('дата закрытия заполнена', (await gen104.innerText()).includes('14.05.2026'));
```

- [ ] **Step 2: Запустить — падает**

Run: `node scripts/inspect/collection-check.mjs`
Expected: `FAIL  6 процессов в гриде` (сейчас 4), `FAIL  терминальная строка приглушена`, и далее таймаут/ошибка на `#listBody tr[data-id="104"]`. Exit 1.

- [ ] **Step 3: Добавить два процесса в `PROCESSES`**

Вставить перед закрывающей `];` массива:

```js
  { id:'104', borrower:'ОсОО «Тянь-Строй»', inn:'01705199200338', scope:'залог',
    phase:'На исполнении', catDays:512, group:'2.2',
    owner:'Сектор по работе с активами', opened:'18.01.2025', basis:'служебная записка в ДПО',
    overlay:null, outcome:'Принятие имущества', closed:'14.05.2026',
    credits:[ {id:'71', num:'Дог. №71 от 22.08.2023', subject:'залог', claim:'310 000,00', coll:'Имущественный комплекс'} ],
    measures:[
      {sec:'Судебный', kind:'Извещение об обращении на залог', date:'18.01.2025', num:'ИЗВ-03', purpose:'начало обращения взыскания', deliver:'зарегистрировано в госоргане', delivered:true, result:'без изменения', stageEx:'исполнено', sum:'310 000,00'},
      {sec:'Исполнительное', kind:'Исполнительный лист', date:'02.09.2025', num:'ИЛ-288', purpose:'принудительное исполнение', deliver:'передан приставам', delivered:true, result:'на исполнении', stageEx:'исполнено', sum:'310 000,00'},
      {sec:'Отчуждение', kind:'Акт несостоявшихся торгов', date:'20.04.2026', num:'АТ-11', purpose:'фиксация второго провала торгов', deliver:'акт ПССИ', delivered:true, result:'отрицательный', stageEx:'исполнено', sum:'310 000,00'},
      {sec:'Отчуждение', kind:'Решение комитета по имуществу', date:'14.05.2026', num:'КИ-06', purpose:'принятие имущества на баланс', deliver:'протокол комитета', delivered:true, result:'положительный', stageEx:'исполнено', sum:'295 000,00'},
    ],
    handoffs:[
      {from:'Куратор ОД', to:'Департамент правового обеспечения', when:'18.01.2025', checklist:'расчёт долга, договоры, претензии', status:'подтверждено', reason:''},
      {from:'Департамент правового обеспечения', to:'Сектор по работе с активами', when:'28.04.2026', checklist:'исполнительный лист, отчёт об оценке', status:'отклонено', reason:'неполный пакет: нет акта несостоявшихся торгов'},
      {from:'Департамент правового обеспечения', to:'Сектор по работе с активами', when:'06.05.2026', checklist:'исполнительный лист, отчёт об оценке, акт торгов АТ-11', status:'подтверждено', reason:''},
    ],
    special:[],
    colls:[
      {item:'Производственная база, с. Лебединовка', kind:'Имущественный комплекс', pledge:'295 000,00', order:'судебный', real:'торги не состоялись (2 раза)', ban:'имущественный комплекс'},
    ],
    history:[
      {when:'14.05.2026 16:40', what:'Исход: принятие имущества → передача в отчуждение активов', who:'Комитет по имуществу'},
      {when:'06.05.2026 10:15', what:'Передача дела принята (пакет дополнен АТ-11)', who:'Сектор по работе с активами'},
      {when:'28.04.2026 09:50', what:'Передача дела ОТКЛОНЕНА: неполный пакет', who:'Сектор по работе с активами'},
      {when:'20.04.2026 12:00', what:'Мера «Акт несостоявшихся торгов» зарегистрирована', who:'ПССИ'},
      {when:'18.01.2025 08:30', what:'Процесс открыт (первая мера: служебная записка)', who:'Куратор ОД'},
    ] },

  { id:'097', borrower:'ОсОО «Нарын-Агро»', inn:'02211199100154', scope:'полный остаток',
    phase:'На исполнении', catDays:890, group:'4',
    owner:'Сектор по работе с активами', opened:'03.03.2024', basis:'первичная претензия',
    overlay:null, outcome:'Безнадёжный долг', closed:'27.06.2026',
    credits:[ {id:'33', num:'Дог. №33 от 11.01.2022', subject:'полный остаток', claim:'64 800,00', coll:'—'} ],
    measures:[
      {sec:'Досудебный', kind:'Первичная претензия', date:'03.03.2024', num:'ПР-045', purpose:'погашение', deliver:'почта (вручено)', delivered:true, result:'без изменения', stageEx:'исполнено', sum:'64 800,00'},
      {sec:'Судебный', kind:'Исковое заявление', date:'10.10.2024', num:'ИСК-52', purpose:'взыскание полного остатка', deliver:'подано в суд', delivered:true, result:'положительный', stageEx:'исполнено', sum:'64 800,00'},
      {sec:'Исполнительное', kind:'Исполнительный лист', date:'21.01.2025', num:'ИЛ-201', purpose:'принудительное исполнение', deliver:'передан приставам', delivered:true, result:'отрицательный', stageEx:'исполнено', sum:'64 800,00'},
      {sec:'Исполнительное', kind:'Постановление о возврате ИЛ', date:'19.02.2026', num:'ПВ-14', purpose:'у должника нет имущества', deliver:'постановление ПССИ', delivered:true, result:'отрицательный', stageEx:'исполнено', sum:'64 800,00'},
      {sec:'События', kind:'Решение спецкомиссии о списании', date:'27.06.2026', num:'СК-02', purpose:'признание долга безнадёжным', deliver:'протокол спецкомиссии', delivered:true, result:'положительный', stageEx:'исполнено', sum:'64 800,00'},
    ],
    handoffs:[
      {from:'Куратор ОД', to:'Департамент правового обеспечения', when:'12.09.2024', checklist:'расчёт долга, договор, претензии', status:'подтверждено', reason:''},
      {from:'Отдел проблемных кредитов', to:'Сектор по работе с активами', when:'02.03.2026', checklist:'постановление о возврате ИЛ, справка об имуществе', status:'подтверждено', reason:''},
    ],
    special:[],
    colls:[],
    history:[
      {when:'27.06.2026 15:00', what:'Исход: безнадёжный долг → списание, группа заёмщика → 4', who:'Спецкомиссия'},
      {when:'02.03.2026 11:30', what:'Передача дела принята', who:'Сектор по работе с активами'},
      {when:'19.02.2026 14:20', what:'Мера «Постановление о возврате ИЛ» зарегистрирована', who:'ПССИ'},
      {when:'03.03.2024 09:00', what:'Процесс открыт (первая мера: претензия)', who:'Куратор ОД'},
    ] },
```

- [ ] **Step 4: Привести 4 старых процесса к новой форме**

Сначала объявить два хелпера — их использует `renderList()` ниже в этом же шаге. Место: рядом с `catOf` / `stageOf`.

```js
const isTerminal   = p => Boolean(p.outcome);
const overlayShort = t => t === 'Пауза' ? 'пауза' : t === 'Соглашение' ? 'соглашение' : 'событие';
```

`id` становится строкой: `id:'142'`, `id:'151'`, `id:'133'`, `id:'120'`. Поле `pause` переименовывается в `overlay` (в Task 5 оно обрастает третьим типом). Каждому добавляются `outcome:null, closed:''`. Каждой мере добавляется `delivered:` — `true` везде, кроме меры `ПР-233` процесса 133 (`deliver:'почта (в пути)'`), где `delivered:false`.

Из `special` процессов 142 и 133 **удалить фейковые строки-заглушки** `{type:'Событие', name:'—', note:'событий и приостановок нет', when:'', deadline:''}` — оставить `special:[]`.

`procNo` должна работать со строковым id — она уже работает (`String(id).padStart(6,'0')`).

Селекторы, зависящие от id, в `renderList()` берут строку в кавычки:

```js
    <tr data-id="${p.id}" class="${isTerminal(p) ? 'terminal' : ''}" onclick="selectRow('${p.id}',this)" ondblclick="openDetail('${p.id}')">
```

`selectRow` сравнивает строки:

```js
function selectRow(id,el){
  selectedRow=id;
  document.querySelectorAll('#listBody tr').forEach(r=>r.classList.toggle('sel', r.dataset.id===id));
  document.getElementById('btnOpen').disabled=false;
}
```

`openDetail` тоже:

```js
  curProc = PROCESSES.find(p=>p.id===id) || PROCESSES[0];
```

`sortList` сортирует id как строку — числовая ветка `typeof x==='number'` перестаёт срабатывать, `localeCompare` даёт `097 < 104 < 120 < 133 < 142 < 151`. Это верный порядок, менять ничего не нужно.

- [ ] **Step 5: Показать исход в списке и на «Общей»**

`renderList()` — колонка фазы показывает исход у терминальных:

```js
      <td>${isTerminal(p)
        ? `<span class="pill neutral">${p.outcome}</span>`
        : `${p.phase}${p.overlay ? ` <span class="pill neutral">${overlayShort(p.overlay.type)}</span>` : ''}`}</td>
```

`panelObschaya()` — два поля вместо одного:

```js
      ${ro('Исход', p.outcome || '—')}
      ${ro('Дата закрытия', p.closed || '—')}
```

- [ ] **Step 6: CSS приглушённой строки**

В `<style>`, после блока `.grid tbody tr.sel`:

```css
/* Терминальный процесс — работа завершена, строка приглушена. */
.grid tbody tr.terminal td{ color:var(--text-muted); }
.grid tbody tr.terminal td:first-child{ font-style:italic; }
```

- [ ] **Step 7: Запустить — зелёное**

Run: `node scripts/inspect/collection-check.mjs`
Expected: все ассерты `ok`, `ПРОВАЛЕНО АССЕРТОВ: 0`, exit 0. Проверить глазами, что первый ассерт «4 процесса в гриде» из Task 1 обновлён на 6 — если нет, поправить его в скрипте.

- [ ] **Step 8: Коммит**

```bash
git add mockups/collection/collection.html scripts/inspect/collection-check.mjs
git commit -m "feat(mockup): collection — 6 процессов, два терминальных исхода"
```

---

### Task 4: `overlaps()` — живой контроль пересечения охвата

**Files:**
- Modify: `mockups/collection/collection.html` (новая функция, `panelOhvat`, `addCreditToScope`, CSS)
- Modify: `scripts/inspect/collection-check.mjs`

**Interfaces:**
- Consumes: `PROCESSES`, `procNo`, `isTerminal`, `curProc`.
- Produces: `overlaps(proc)` → массив `{ credit, subject, other }`, где `credit` — объект кредита из `proc.credits`, `subject` — предмет требования, `other` — пересекающийся процесс. Пустой массив, если пересечений нет. Глобальная `openDetail(id)` используется как ссылка перехода.

- [ ] **Step 1: Дописать падающие ассерты**

```js
// --- T4: контроль пересечения охвата ---
await page.goto(FILE, { waitUntil: 'load' });
const ov = await page.evaluate(() => ({
  has: typeof overlaps === 'function',
  n142: typeof overlaps === 'function' && overlaps(PROCESSES.find(p => p.id === '142')).length,
  n133: typeof overlaps === 'function' && overlaps(PROCESSES.find(p => p.id === '133')).length,
  other142: typeof overlaps === 'function' && overlaps(PROCESSES.find(p => p.id === '142'))[0]?.other.id,
}));
ok('overlaps объявлена', ov.has);
ok('у 142 одно пересечение', ov.n142 === 1);
ok('пересечение указывает на 151', ov.other142 === '151');
ok('у одинокого 133 пересечений нет', ov.n133 === 0);

await page.click('#listBody tr[data-id="142"]');
await page.click('#btnOpen');
await page.click('#detailTabbar .dtab >> nth=1');           // вкладка «Охват»
const ohvat = page.locator('#detailPanels .detail-panel >> nth=1');
ok('плашка пересечения видна', await ohvat.locator('.overlap-note').isVisible());
ok('плашка называет соседний процесс', (await ohvat.locator('.overlap-note').innerText()).includes('В-2026-000151'));
await ohvat.locator('.overlap-note .rowlink').click();
ok('ссылка открыла соседний процесс', (await page.locator('#crumbTitle').innerText()).includes('В-2026-000151'));

// у 133 плашки нет
await page.click('#detailPanels');                            // фокус, не важно
await page.goto(FILE, { waitUntil: 'load' });
await page.click('#listBody tr[data-id="133"]');
await page.click('#btnOpen');
await page.click('#detailTabbar .dtab >> nth=1');
ok('у 133 плашки нет', (await page.locator('#detailPanels .detail-panel >> nth=1').locator('.overlap-note').count()) === 0);

// модалка «Добавить кредит» предупреждает по реальным данным
await page.goto(FILE, { waitUntil: 'load' });
await page.click('#listBody tr[data-id="142"]');
await page.click('#btnOpen');
await page.click('#detailTabbar .dtab >> nth=1');
await page.click('#detailPanels .detail-panel >> nth=1 >> .gtoolbar .btn');
ok('модалка охвата открыта', await page.locator('#modalHost.open').isVisible());
ok('модалка предупреждает о конкретном пересечении', (await page.locator('#modalHost .warn-inline').innerText()).includes('В-2026-000151'));
```

- [ ] **Step 2: Запустить — падает**

Run: `node scripts/inspect/collection-check.mjs`
Expected: `FAIL  overlaps объявлена`, далее падения на `.overlap-note`. Exit 1.

- [ ] **Step 3: Реализовать `overlaps()`**

Рядом с `isTerminal`:

```js
/* ============================================================
   КОНТРОЛЬ ПЕРЕСЕЧЕНИЯ ОХВАТА
   Кредит ↔ процесс — многие-ко-многим. Два активных процесса по одному
   кредиту законны, если предмет требования разный (142: просроченная сумма,
   151: залог по тому же дог. №56). Пересечением считается совпадение ПАРЫ
   (кредит, предмет требования) с другим активным процессом.
   Это мягкое предупреждение, а не запрет: решает человек.
   ============================================================ */
function overlaps(proc){
  const out = [];
  for(const c of proc.credits){
    for(const other of PROCESSES){
      if(other.id === proc.id || isTerminal(other)) continue;
      if(other.credits.some(oc => oc.id === c.id))
        out.push({ credit:c, subject:c.subject, other });
    }
  }
  return out;
}
```

Замечание для реализующего: функция ищет **общий кредит**, а не совпадение предмета. Совпадение пары (кредит, предмет) означало бы дубль-процесс — его в данных нет и быть не должно; полезное предупреждение — «по этому кредиту уже идёт другая работа, посмотри, не задваиваешь ли предмет». Именно это показывает плашка.

- [ ] **Step 4: Плашка на вкладке «Охват»**

В `panelOhvat()`, между `<p class="section-note">…</p>` и `<div class="gtoolbar">`:

```js
  const ovs = overlaps(p);
  const note = ovs.length ? `<div class="overlap-note">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>
    <span>${ovs.map(o=>`По ${o.credit.num} идёт процесс <span class="rowlink" onclick="openDetail('${o.other.id}')">${procNo(o.other.id)}</span> (предмет: ${o.other.scope}). Проверьте, не задваивается ли требование.`).join('<br>')}</span>
  </div>` : '';
```

и подставить `${note}` в разметку панели перед `<div class="gtoolbar">`.

- [ ] **Step 5: Модалка «Добавить кредит» предупреждает по данным**

В `addCreditToScope()` заменить статичный `warn-inline` на:

```js
  const ovs = overlaps(curProc);
  const live = ovs.length
    ? ovs.map(o=>`По ${o.credit.num} уже идёт процесс ${procNo(o.other.id)} (предмет: ${o.other.scope}).`).join(' ')
    : 'Пересечений с активными процессами по текущему охвату не обнаружено.';
```

и в шаблоне:

```js
    <div class="warn-inline"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg><span>Можно добавить только кредит того же заёмщика. ${live} Предупреждение мягкое: пересечение по разным предметам требования допустимо.</span></div>
```

- [ ] **Step 6: CSS плашки**

```css
/* Мягкое предупреждение о пересечении охвата — не запрет. */
.overlap-note{ display:flex; gap:8px; align-items:flex-start; background:var(--status-warning-bg);
  color:var(--asubk-amber); border-radius:var(--radius-md); padding:10px 12px; margin:0 0 14px;
  font:var(--font-label); }
.overlap-note svg{ flex:none; margin-top:2px; }
.overlap-note .rowlink{ color:var(--text-link); font-weight:600; }
```

- [ ] **Step 7: Запустить — зелёное**

Run: `node scripts/inspect/collection-check.mjs`
Expected: все ассерты `ok`, `ПРОВАЛЕНО АССЕРТОВ: 0`, exit 0.

- [ ] **Step 8: Коммит**

```bash
git add mockups/collection/collection.html scripts/inspect/collection-check.mjs
git commit -m "feat(mockup): collection — живой контроль пересечения охвата + ссылка на процесс-сосед"
```

---

### Task 5: Шапка-индикатор, три оверлея, «Закрыть»

**Files:**
- Modify: `mockups/collection/collection.html` (`phaseHeader`, футер карточки, CSS, данные 151/120)
- Modify: `scripts/inspect/collection-check.mjs`

**Interfaces:**
- Consumes: `curProc`, `catOf`, `stageOf`, `procNo`, `isTerminal`.
- Produces: `phaseSource(p)` → строка вида `по документу-основанию: ИСК-77`; `overlayBanner(p)` → HTML или `''`. Форма оверлея: `{type:'Пауза'|'Соглашение'|'Событие', label, until, scope, note}`. CSS `.phead-banner.danger`.

- [ ] **Step 1: Дописать падающие ассерты**

```js
// --- T5: шапка-индикатор ---
await page.goto(FILE, { waitUntil: 'load' });
await page.click('#listBody tr[data-id="142"]');
await page.click('#btnOpen');
const head = page.locator('#detailPanels .phead').first();
ok('4 плитки в шапке', (await head.locator('.dim').count()) === 4);
const srcs = await head.locator('.dim .src').allInnerTexts();
ok('подпись стадии', srcs[0] === 'производная от фазы');
ok('подпись фазы называет меру-основание', srcs[1] === 'по документу-основанию: ИСК-77');
ok('подпись категории с днями', srcs[2] === 'вычислено · 214 дн просрочки');
ok('подпись группы', srcs[3] === 'атрибут заёмщика');
ok('плитка фазы не селектор', (await head.locator('.dim select').count()) === 0);
ok('внизу карточки только «Закрыть»', (await page.locator('#view-detail .footer .btn').count()) === 1);
ok('кнопка называется «Закрыть»', (await page.locator('#view-detail .footer .btn').innerText()).includes('Закрыть'));
ok('OK/Отмена отсутствуют', !(await page.locator('#view-detail .footer').innerText()).includes('Отмена'));

// баннеры трёх типов
const banner = async id => {
  await page.goto(FILE, { waitUntil: 'load' });
  await page.click(`#listBody tr[data-id="${id}"]`);
  await page.click('#btnOpen');
  const b = page.locator('#detailPanels .phead-banner').first();
  return (await b.count()) ? { cls: await b.getAttribute('class'), txt: await b.innerText() } : null;
};
const b151 = await banner('151');
ok('у 151 янтарный баннер паузы', b151 && b151.cls.includes('warn') && b151.txt.includes('Пауза'));
ok('баннер паузы называет scope и дедлайн', b151 && b151.txt.includes('весь процесс') && b151.txt.includes('18.09.2026'));
ok('баннер паузы говорит, что фаза сохранена', b151 && b151.txt.includes('фаза сохранена'));
const b120 = await banner('120');
ok('у 120 синий баннер соглашения', b120 && b120.cls.includes('info') && b120.txt.includes('соглашени'));
ok('баннер соглашения про график, не дедлайн', b120 && b120.txt.includes('график'));
const b133 = await banner('133');
ok('у 133 баннера нет', b133 === null);
ok('CSS для события объявлен', await page.evaluate(() =>
  [...document.styleSheets[0].cssRules].some(r => r.selectorText === '.phead-banner.danger')));
```

- [ ] **Step 2: Запустить — падает**

Run: `node scripts/inspect/collection-check.mjs`
Expected: `FAIL  подпись фазы называет меру-основание` (сейчас `по документу-основанию`), `FAIL  внизу карточки только «Закрыть»` (сейчас 2 кнопки), `FAIL  CSS для события объявлен`. Exit 1.

- [ ] **Step 3: Мера-основание в подписи фазы**

Рядом с `overlayShort`:

```js
/* Фаза установлена мерой-вехой. Показываем ЕЁ номер — так правило
   «фаза следует из журнала мер» видно, а не только объявлено. */
const PHASE_BY_MEASURE = {
  'Претензия':'Первичная претензия', 'Повторная претензия':'Повторная претензия',
  'Безакцептное списание':'Безакцептное списание', 'Извещение':'Извещение об обращении на залог',
  'Иск':'Исковое заявление', 'Решение суда':'Решение суда',
  'Исполнительный лист':'Исполнительный лист', 'На исполнении':'Исполнительный лист',
};
function phaseSource(p){
  const kind = PHASE_BY_MEASURE[p.phase];
  const m = [...p.measures].reverse().find(x => x.kind === kind);
  return m ? `по документу-основанию: ${m.num}` : 'по документу-основанию';
}
```

Для процесса 142 фаза `Иск` → мера `Исковое заявление` → `ИСК-77`. Совпадает с ассертом.

- [ ] **Step 4: Три баннера оверлея**

Заменить блок `let banner=''; if(p.pause){…}` в `phaseHeader()` на вызов:

```js
function overlayBanner(p){
  if(!p.overlay) return '';
  const o = p.overlay;
  if(o.type === 'Пауза') return `<div class="phead-banner warn">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>
    <span>Пауза: ${o.label} · до ${o.until} · фаза сохранена · область: ${o.scope} · счётчик дней не заморожен</span></div>`;
  if(o.type === 'Соглашение') return `<div class="phead-banner info">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
    <span>Исполнение по соглашению: ${o.label} · наблюдение за графиком (не пауза — дедлайна нет) · фаза сохранена</span></div>`;
  return `<div class="phead-banner danger">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg>
    <span>Событие: ${o.label} · процесс уведён в спецпроцедуру · фаза сохранена</span></div>`;
}
```

и в `phaseHeader()`: `${overlayBanner(p)}` вместо `${banner}`.

- [ ] **Step 5: Обновить данные оверлеев**

Процесс 151: `overlay:{type:'Пауза', label:'реструктуризация', until:'18.09.2026', scope:'весь процесс'}`.
Процесс 120: `overlay:{type:'Соглашение', label:'мировое соглашение', until:'', scope:'график погашения'}`.
Процессы 142, 133, 104, 097: `overlay:null`.

- [ ] **Step 6: Плитки с новыми подписями**

В `phaseHeader()` блок `.phead-dims` целиком:

```js
    <div class="phead-dims">
      <div class="dim"><div class="dl">Стадия</div><div class="dv">${stageOf(p.phase)}</div><div class="src">производная от фазы</div></div>
      <div class="dim"><div class="dl">Фаза</div><div class="dv">${p.phase}</div><div class="src">${phaseSource(p)}</div></div>
      <div class="dim"><div class="dl">Категория риска</div><div class="dv"><span class="pill ${catCls(catOf(p.catDays))}">${catLabel(catOf(p.catDays))}</span></div><div class="src">вычислено · ${p.catDays} дн просрочки</div></div>
      <div class="dim"><div class="dl">Группа платёжесп.</div><div class="dv">${p.group}</div><div class="src">атрибут заёмщика</div></div>
    </div>
```

- [ ] **Step 7: Футер — только «Закрыть»**

Заменить `<div class="footer">…</div>` в `#view-detail`:

```html
        <div class="footer">
          <button class="btn btn-secondary" onclick="showView('list')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Закрыть</button>
        </div>
```

- [ ] **Step 8: CSS красного баннера**

Рядом с `.phead-banner.info`:

```css
/* Событие (смерть, недееспособность) — уводит процесс вбок, фаза сохраняется. */
.phead-banner.danger{ background:var(--status-error-bg); color:var(--asubk-red); }
```

Ассерт `document.styleSheets[0].cssRules` требует, чтобы правило было в **первом** `<style>` (он единственный) и селектор писался ровно `.phead-banner.danger` без запятых.

- [ ] **Step 9: Запустить — зелёное**

Run: `node scripts/inspect/collection-check.mjs`
Expected: все ассерты `ok`, `ПРОВАЛЕНО АССЕРТОВ: 0`, exit 0.

- [ ] **Step 10: Коммит**

```bash
git add mockups/collection/collection.html scripts/inspect/collection-check.mjs
git commit -m "feat(mockup): collection — шапка-индикатор с источниками, три оверлея, футер «Закрыть»"
```

---

### Task 6: Журнал мер — вручение, виды меры, условное предупреждение

**Files:**
- Modify: `mockups/collection/collection.html` (`MEASURE_KINDS`, `panelMery`, `openMeasureModal`, CSS)
- Modify: `scripts/inspect/collection-check.mjs`

**Interfaces:**
- Consumes: `curProc`, `stageOf`, поля меры `delivered`, `deliver`, `kind`.
- Produces: `MEASURE_KINDS` — массив из 20 строк; `MILESTONE_KINDS` — `Set` видов-вех; `NEEDS_DELIVERY` — `Set` видов, требующих подтверждения вручения; `isMilestone(kind)`, `needsDelivery(kind)`. DOM: `#mKind` (селект вида меры в модалке), `#mWarnPhase`, `#mWarnDelivery` (условные предупреждения), `.mrow-undelivered` (класс строки неисполненной меры).

- [ ] **Step 1: Дописать падающие ассерты**

```js
// --- T6: журнал мер ---
await page.goto(FILE, { waitUntil: 'load' });
const kinds = await page.evaluate(() => ({
  n: MEASURE_KINDS.length,
  milestoneIsk: isMilestone('Исковое заявление'),
  milestoneApel: isMilestone('Апелляционная жалоба'),
  needsPret: needsDelivery('Первичная претензия'),
  needsIl: needsDelivery('Исполнительный лист'),
}));
ok('20 видов меры', kinds.n === 20);
ok('иск — веха', kinds.milestoneIsk === true);
ok('апелляция — НЕ веха (мера внутри фазы)', kinds.milestoneApel === false);
ok('претензия требует вручения', kinds.needsPret === true);
ok('исполнительный лист вручения не требует', kinds.needsIl === false);

// 133: мера ПР-233 без подтверждения вручения → помечена
await page.click('#listBody tr[data-id="133"]');
await page.click('#btnOpen');
await page.click('#detailTabbar .dtab >> nth=2');
const mery = page.locator('#detailPanels .detail-panel >> nth=2');
ok('неисполненная мера помечена', (await mery.locator('tr.mrow-undelivered').count()) === 1);
ok('пометка объясняет причину', (await mery.locator('tr.mrow-undelivered').innerText()).includes('не исполнена'));

// таймлайн — досудебная цепочка из 3 фаз, текущая «Повторная претензия»
ok('таймлайн досудебной стадии — 3 шага', (await mery.locator('.tl-step').count()) === 3);
ok('текущий шаг — второй', (await mery.locator('.tl-step >> nth=1 >> .tl-dot').getAttribute('class')).includes('cur'));
ok('первый шаг пройден', (await mery.locator('.tl-step >> nth=0 >> .tl-dot').innerText()) === '✓');

// таймлайн 142 — принудительная цепочка из 5 фаз
await page.goto(FILE, { waitUntil: 'load' });
await page.click('#listBody tr[data-id="142"]');
await page.click('#btnOpen');
await page.click('#detailTabbar .dtab >> nth=2');
ok('таймлайн принудительной стадии — 5 шагов', (await page.locator('#detailPanels .detail-panel >> nth=2 >> .tl-step').count()) === 5);

// модалка меры: предупреждение о сдвиге фазы условное
await page.click('#detailPanels .detail-panel >> nth=2 >> .gtoolbar .btn');
ok('модалка меры открыта', await page.locator('#modalHost.open').isVisible());
await page.selectOption('#mKind', 'Исковое заявление');
ok('для вехи предупреждение о фазе видно', await page.locator('#mWarnPhase').isVisible());
await page.selectOption('#mKind', 'Апелляционная жалоба');
ok('для не-вехи предупреждение о фазе скрыто', !(await page.locator('#mWarnPhase').isVisible()));
await page.selectOption('#mKind', 'Первичная претензия');
ok('для претензии видно предупреждение о вручении', await page.locator('#mWarnDelivery').isVisible());
await page.selectOption('#mKind', 'Исполнительный лист');
ok('для ИЛ предупреждение о вручении скрыто', !(await page.locator('#mWarnDelivery').isVisible()));
```

- [ ] **Step 2: Запустить — падает**

Run: `node scripts/inspect/collection-check.mjs`
Expected: `PAGEERROR: MEASURE_KINDS is not defined`. Exit 1.

- [ ] **Step 3: Справочник видов меры**

После `PHASES_PRE` / `PHASES_FORCE`:

```js
/* ============================================================
   СПРАВОЧНИК ВИДОВ МЕРЫ (в проде — пополняемый справочник).
   МАТРИЦА «фаза ← вид меры-основания» — конфигурация, не данные:
   иначе теряется контроль п. 98 регламента (статус только по документу).
   Апелляции и кассации — меры ВНУТРИ фазы, не вехи.
   ============================================================ */
const MEASURE_KINDS = [
  'Первичная претензия', 'Повторная претензия', 'Требование поручителю',
  'Требование гаранту', 'Требование отраслевому госоргану', 'Акт сверки',
  'Безакцептное списание', 'Платёжное требование в банк', 'Решение комитета',
  'Служебная записка в ДПО', 'Извещение об обращении на залог', 'Исковое заявление',
  'Уточнение исковых требований', 'Решение суда', 'Апелляционная жалоба',
  'Кассационная жалоба', 'Исполнительный лист', 'Письмо в ПССИ',
  'Акт несостоявшихся торгов', 'Постановление о возврате ИЛ',
];

/* Вехи двигают фазу. Всё остальное живёт в журнале, не трогая фазу. */
const MILESTONE_KINDS = new Set([
  'Первичная претензия', 'Повторная претензия', 'Безакцептное списание',
  'Извещение об обращении на залог', 'Исковое заявление', 'Решение суда',
  'Исполнительный лист',
]);
const isMilestone = kind => MILESTONE_KINDS.has(kind);

/* Претензии и извещения — будущие доказательства в суде. Без подтверждения
   вручения (СЭД-квитанция / почтовое уведомление / отметка заёмщика)
   мера НЕ считается исполненной, п. 20.2. */
const NEEDS_DELIVERY = new Set([
  'Первичная претензия', 'Повторная претензия', 'Требование поручителю',
  'Требование гаранту', 'Требование отраслевому госоргану',
  'Извещение об обращении на залог',
]);
const needsDelivery = kind => NEEDS_DELIVERY.has(kind);
```

- [ ] **Step 4: Пометка неисполненной меры**

В `panelMery()` заменить построение `rows`:

```js
  const rows = p.measures.map(m=>{
    const bad = needsDelivery(m.kind) && !m.delivered;
    return `<tr class="${bad ? 'mrow-undelivered' : ''}">
      <td>${m.sec}</td><td>${m.kind}</td><td>${m.date}</td><td>${m.num}</td>
      <td>${m.deliver}${bad ? ' <span class="pill mid">не исполнена: нет подтверждения вручения</span>' : ''}</td>
      <td>${m.result}</td><td>${m.stageEx}</td><td style="text-align:right">${m.sum}</td></tr>`;
  }).join('');
```

CSS:

```css
/* Мера без подтверждения вручения не считается исполненной — она не годится
   как доказательство в суде. Строка подсвечена, а не спрятана. */
.cgrid tbody tr.mrow-undelivered{ background:var(--status-warning-bg); }
```

- [ ] **Step 5: Условные предупреждения в модалке**

Заменить `openMeasureModal()` целиком:

```js
function openMeasureModal(){
  const host=document.getElementById('modalHost');
  host.innerHTML=`<div class="modal form">
    <div class="modal-h"><span class="mt">Регистрация меры</span><button class="modal-x" onclick="closeModal()"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="modal-b"><div class="mform">
      ${sel('Раздел','Судебный',['Досудебный','Судебный','Исполнительное','Отчуждение','События'])}
      <div class="field"><span class="flabel">Вид меры</span><div class="control grey"><select id="mKind" onchange="syncMeasureWarnings()">${MEASURE_KINDS.map(k=>`<option${k==='Исковое заявление'?' selected':''}>${k}</option>`).join('')}</select>${caret()}</div></div>
      ${inp('Дата','')}
      ${inp('Номер','')}
      ${sel('Способ направления / вручения','СЭД (квитанция)',['СЭД (квитанция)','Почта (уведомление о вручении)','Отметка заёмщика','Подано в суд','Зарегистрировано в госоргане','Не направлялась'])}
      ${sel('Результат','на рассмотрении',['на рассмотрении','без изменения','частичное погашение','полное погашение','положительный','отрицательный'])}
      <div class="field col-span"><span class="flabel">Назначение (цель)</span><div class="control"><input value=""></div></div>
    </div>
    <div class="warn-inline" id="mWarnPhase"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg><span>Это <b>мера-веха</b>: сохранение сдвинет фазу процесса. Фаза двигается только так — селектора фазы в системе нет.</span></div>
    <div class="warn-inline" id="mWarnDelivery"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg><span>Без подтверждения вручения мера не считается исполненной и не годится как доказательство в суде.</span></div>
    </div>
    <div class="modal-f"><button class="btn btn-secondary" onclick="closeModal()">Отмена</button><button class="btn btn-primary" onclick="closeModal();toast('Мера зарегистрирована (демо)')">Сохранить</button></div>
  </div>`;
  host.classList.add('open');
  syncMeasureWarnings();
}
function syncMeasureWarnings(){
  const kind = document.getElementById('mKind').value;
  document.getElementById('mWarnPhase').style.display    = isMilestone(kind)   ? 'flex' : 'none';
  document.getElementById('mWarnDelivery').style.display = needsDelivery(kind) ? 'flex' : 'none';
}
```

- [ ] **Step 6: Запустить — зелёное**

Run: `node scripts/inspect/collection-check.mjs`
Expected: все ассерты `ok`, `ПРОВАЛЕНО АССЕРТОВ: 0`, exit 0.

- [ ] **Step 7: Коммит**

```bash
git add mockups/collection/collection.html scripts/inspect/collection-check.mjs
git commit -m "feat(mockup): collection — журнал мер: 20 видов, вехи, подтверждение вручения"
```

---

### Task 7: Escape закрывает модалку

**Files:**
- Modify: `mockups/collection/collection.html` (обработчик в конце `<script>`)
- Modify: `scripts/inspect/collection-check.mjs`

**Interfaces:**
- Consumes: `closeModal()`, `#modalHost`.
- Produces: глобальный `keydown`-listener. Клик по подложке уже работает (`#modalHost onclick`), Escape добавляется — стандарт репо P3-R33.

- [ ] **Step 1: Дописать падающие ассерты**

```js
// --- T7: Escape и подложка ---
await page.goto(FILE, { waitUntil: 'load' });
await page.click('#listBody tr[data-id="142"]');
await page.click('#btnOpen');
await page.click('#detailTabbar .dtab >> nth=2');
await page.click('#detailPanels .detail-panel >> nth=2 >> .gtoolbar .btn');
ok('модалка открыта', await page.locator('#modalHost.open').isVisible());
await page.keyboard.press('Escape');
ok('Escape закрыл модалку', !(await page.locator('#modalHost').evaluate(e => e.classList.contains('open'))));
await page.click('#detailPanels .detail-panel >> nth=2 >> .gtoolbar .btn');
await page.mouse.click(20, 20);   // клик по подложке вне окна модалки
ok('клик по подложке закрыл модалку', !(await page.locator('#modalHost').evaluate(e => e.classList.contains('open'))));
```

- [ ] **Step 2: Запустить — падает**

Run: `node scripts/inspect/collection-check.mjs`
Expected: `FAIL  Escape закрыл модалку`. Exit 1.

- [ ] **Step 3: Добавить listener**

В конце `<script>`, перед `renderNav(); renderList();`:

```js
/* Escape закрывает диалог — единый стандарт диалогов модуля (P3-R33).
   Клик по подложке уже обрабатывается на #modalHost. */
document.addEventListener('keydown', e => {
  if(e.key === 'Escape' && document.getElementById('modalHost').classList.contains('open')) closeModal();
});
```

- [ ] **Step 4: Запустить — зелёное**

Run: `node scripts/inspect/collection-check.mjs`
Expected: все ассерты `ok`, `ПРОВАЛЕНО АССЕРТОВ: 0`, exit 0.

- [ ] **Step 5: Коммит**

```bash
git add mockups/collection/collection.html scripts/inspect/collection-check.mjs
git commit -m "feat(mockup): collection — Escape закрывает диалог"
```

---

### Task 8: Особые состояния, передачи, залог

**Files:**
- Modify: `mockups/collection/collection.html` (`panelSpecial`, `panelHandoffs`, `panelZalog`)
- Modify: `scripts/inspect/collection-check.mjs`

**Interfaces:**
- Consumes: `curProc.special`, `curProc.handoffs`, `curProc.colls`.
- Produces: `panelSpecial` без фильтра-костыля `s.name!=='—'`; строки `special` формы `{type, name, note, when, deadline}`; `handoffs[].status === 'отклонено'` рендерится красным pill с причиной; `colls[].ban` — причина запрета либо `''`.

- [ ] **Step 1: Дописать падающие ассерты**

```js
// --- T8: особые состояния / передачи / залог ---
await page.goto(FILE, { waitUntil: 'load' });
const noFake = await page.evaluate(() =>
  PROCESSES.every(p => p.special.every(s => s.name !== '—')));
ok('фейковых строк-заглушек в данных нет', noFake);
const noFilter = await page.evaluate(() => panelSpecial.toString().includes("!=='—'"));
ok('костыль-фильтр убран из panelSpecial', noFilter === false);

// 142: особых состояний нет → честное пустое состояние
await page.click('#listBody tr[data-id="142"]');
await page.click('#btnOpen');
await page.click('#detailTabbar .dtab >> nth=4');
ok('у 142 пустое состояние', (await page.locator('#detailPanels .detail-panel >> nth=4 >> .cgrid-empty').count()) === 1);

// 151: пауза одной строкой
await page.goto(FILE, { waitUntil: 'load' });
await page.click('#listBody tr[data-id="151"]');
await page.click('#btnOpen');
await page.click('#detailTabbar .dtab >> nth=4');
const sp151 = page.locator('#detailPanels .detail-panel >> nth=4');
ok('у 151 одна строка особого состояния', (await sp151.locator('tbody tr').count()) === 1);
ok('строка — пауза', (await sp151.locator('tbody tr .pill').innerText()) === 'пауза');
ok('дедлайн паузы в строке', (await sp151.locator('tbody tr').innerText()).includes('18.09.2026'));

// 104: отклонённая передача с причиной + залог с причиной запрета
await page.goto(FILE, { waitUntil: 'load' });
await page.click('#listBody tr[data-id="104"]');
await page.click('#btnOpen');
await page.click('#detailTabbar .dtab >> nth=3');
const ho = page.locator('#detailPanels .detail-panel >> nth=3');
ok('три передачи у 104', (await ho.locator('tbody tr').count()) === 3);
ok('одна отклонена', (await ho.locator('tbody tr .pill.high').count()) === 1);
ok('причина отклонения показана', (await ho.innerText()).includes('нет акта несостоявшихся торгов'));

await page.click('#detailTabbar .dtab >> nth=5');
const zl = page.locator('#detailPanels .detail-panel >> nth=5');
ok('запрет внесудебного с причиной', (await zl.locator('tbody tr .pill.high').innerText()) === 'имущественный комплекс');
ok('статус реализации показан', (await zl.innerText()).includes('торги не состоялись'));

// 142: залога нет → пустое состояние
await page.goto(FILE, { waitUntil: 'load' });
await page.click('#listBody tr[data-id="142"]');
await page.click('#btnOpen');
await page.click('#detailTabbar .dtab >> nth=5');
ok('у 142 залога нет', (await page.locator('#detailPanels .detail-panel >> nth=5 >> .cgrid-empty').count()) === 1);
```

- [ ] **Step 2: Запустить — падает**

Run: `node scripts/inspect/collection-check.mjs`
Expected: `FAIL  костыль-фильтр убран из panelSpecial`. Остальное может пройти уже после Task 3 — это нормально, ассерты закрепляют поведение.

- [ ] **Step 3: Убрать костыль-фильтр**

В `panelSpecial()` заменить:

```js
  const rows = p.special.map(s=>{
    const pill = s.type==='Пауза'?'<span class="pill mid">пауза</span>'
               : s.type==='Соглашение'?'<span class="pill info">соглашение</span>'
               : '<span class="pill high">событие</span>';
    return `<tr><td>${pill}</td><td>${s.name}</td><td>${s.note}</td><td>${s.when||'—'}</td><td>${s.deadline||'—'}</td></tr>`;
  }).join('');
```

Фейковых строк в данных больше нет (Task 3), фильтр не нужен. Событие получает красный `pill high` — согласуется с красным баннером из Task 5.

- [ ] **Step 4: Залог — причина запрета вместо «нет»**

В данных процесса 151 заменить `ban:'нет'` на `ban:''`; у 120 — `ban:'нет'` на `ban:''`. У 104 — `ban:'имущественный комплекс'` (уже задан в Task 3).

В `panelZalog()`:

```js
    <td>${c.ban ? `<span class="pill high">${c.ban}</span>` : '—'}</td>
```

- [ ] **Step 5: Запустить — зелёное**

Run: `node scripts/inspect/collection-check.mjs`
Expected: все ассерты `ok`, `ПРОВАЛЕНО АССЕРТОВ: 0`, exit 0.

- [ ] **Step 6: Коммит**

```bash
git add mockups/collection/collection.html scripts/inspect/collection-check.mjs
git commit -m "feat(mockup): collection — честные пустые состояния, отклонённая передача, причина запрета внесудебного"
```

---

### Task 9: Роль, сортировка, финальная приёмка

**Files:**
- Modify: `mockups/collection/collection.html` (`onRoleChange`)
- Modify: `scripts/inspect/collection-check.mjs`

**Interfaces:**
- Consumes: `#roleSel`, `toast()`, `sortList(k)`.
- Produces: ничего нового. Задача закрывает чек-лист приёмки из спека.

- [ ] **Step 1: Дописать финальные ассерты**

```js
// --- T9: роль, сортировка, приёмка ---
await page.goto(FILE, { waitUntil: 'load' });
const roles = await page.locator('#roleSel option').allInnerTexts();
ok('5 ролей в переключателе', roles.length === 5);
ok('роли модуля перечислены', roles.includes('Отдел проблемных кредитов') && roles.includes('Наблюдатель'));
await page.selectOption('#roleSel', 'Наблюдатель');
ok('смена роли даёт тост', (await page.locator('#toastWrap .toast').innerText()).includes('Наблюдатель'));

// сортировка по клику на заголовок
const firstId = () => page.locator('#listBody tr').first().getAttribute('data-id');
await page.click('#listHead th >> nth=0');
const asc = await firstId();
await page.click('#listHead th >> nth=0');
const desc = await firstId();
ok('сортировка по № переворачивается', asc !== desc);

// каждая из 7 вкладок непуста у каждого процесса
for(const id of ['142','151','133','120','104','097']){
  await page.goto(FILE, { waitUntil: 'load' });
  await page.click(`#listBody tr[data-id="${id}"]`);
  await page.click('#btnOpen');
  for(let t=0; t<7; t++){
    await page.click(`#detailTabbar .dtab >> nth=${t}`);
    const txt = (await page.locator(`#detailPanels .detail-panel >> nth=${t}`).innerText()).trim();
    ok(`процесс ${id}, вкладка ${t+1} непуста`, txt.length > 40);
  }
}

// фаза нигде не редактируется селектором
await page.goto(FILE, { waitUntil: 'load' });
await page.click('#listBody tr[data-id="142"]');
await page.click('#btnOpen');
ok('в карточке нет селектора фазы', (await page.locator('#detailPanels select').count()) === 0);
```

- [ ] **Step 2: Запустить**

Run: `node scripts/inspect/collection-check.mjs`
Expected: возможен `FAIL  5 ролей в переключателе` — проверить `#roleSel` в разметке. Если ролей не 5, привести список к: `Куратор отраслевого департамента`, `Департамент правового обеспечения (ДПО)`, `Отдел проблемных кредитов`, `Сектор по работе с активами`, `Наблюдатель`.

- [ ] **Step 3: Починить найденное**

Если `#roleSel` не имеет id — добавить. Если тост не содержит имени роли — `onRoleChange` уже собирает `'Роль: '+value`, этого достаточно.

Если ассерт «в карточке нет селектора фазы» падает — найти `<select>` в панелях и заменить на `ro(...)`.

- [ ] **Step 4: Запустить — зелёное**

Run: `node scripts/inspect/collection-check.mjs`
Expected: `ОШИБОК КОНСОЛИ: 0`, `ПРОВАЛЕНО АССЕРТОВ: 0`, exit 0.

- [ ] **Step 5: Открыть файл глазами**

Run: `xdg-open mockups/collection/collection.html`
Проверить вручную: светлая тема, ничего не разъехалось, тосты появляются и гаснут, таймлайн читается, баннеры трёх цветов (открыть 151 — янтарь, 120 — синий; красный баннер данными не покрыт, проверить через консоль: `PROCESSES[0].overlay={type:'Событие',label:'смерть заёмщика'}; openDetail('142')`).

- [ ] **Step 6: Коммит**

```bash
git add mockups/collection/collection.html scripts/inspect/collection-check.mjs
git commit -m "feat(mockup): collection — роли, сортировка, приёмочные ассерты"
```

---

### Task 10: TODO.md «Фаза 9» и STATUS.md

**Files:**
- Modify: `TODO.md` (новая секция после «Фаза 8 — Справочники», строка ~654)
- Modify: `STATUS.md` (строка `Last updated`, блок `Recent changes`)

**Interfaces:**
- Consumes: готовый мокап.
- Produces: ID `P9-R1…P9-R9` — на них ссылается шапка-комментарий мокапа.

- [ ] **Step 1: Прочитать формат соседней секции**

Run: `sed -n 629,660p TODO.md`
Скопировать структуру заголовка, чипов приоритета и полей задачи один-в-один. Чипы: `🔴 Высокий` / `🟡 Средний` / `🟢 Низкий`.

- [ ] **Step 2: Вставить секцию «Фаза 9»**

Перед строкой `## 🟢 Позже / идеи` вставить (адаптировав разметку под формат, увиденный в Step 1):

```markdown
### Фаза 9 — Взыскание задолженности: предложения по улучшению (для команды разработки)

> Модуля в системе нет — проектируется с нуля. Мокап: `mockups/collection/collection.html`.
> Спек: `docs/superpowers/specs/2026-07-10-collection-mockup-design.md`.
> Дефектов нет (нечего проверять), поэтому в `notes/qa-findings.md` записей по фазе 9 не будет.

- **P9-R1** 🔴 Высокий — Сущности «Процесс взыскания» и «Охват процесса». Процесс привязан к одному заёмщику (ИНН — якорь). Связь процесс ↔ кредиты — многие-ко-многим, с предметом требования и суммой у каждой пары. Процесс создаётся при регистрации первой меры, а не по счётчику дней — «пустых» процессов на каждый кредит быть не должно.
- **P9-R2** 🔴 Высокий — Три независимых измерения состояния: категория риска (вычислена из дней просрочки), группа платежеспособности (атрибут заёмщика), фаза + стадия (фаза по документу-основанию, стадия производная). Не сливать в одно поле «статус». Категорию и стадию не хранить.
- **P9-R3** 🔴 Высокий — Машина фаз: досудебная (Претензия → Повторная претензия → Безакцептное списание), принудительная (Извещение → Иск → Решение суда → Исполнительный лист → На исполнении). Матрица «фаза ← вид меры-основания» — конфигурация, не пользовательские данные. Селектора фазы в UI быть не должно. Апелляции и кассации — меры внутри фазы, не новые фазы.
- **P9-R4** 🟡 Средний — Журнал мер с обязательным подтверждением вручения для претензий, требований обеспечителям и извещений (способ + тип + дата + скан). Без подтверждения мера не считается исполненной и не годится как доказательство в суде.
- **P9-R5** 🟡 Средний — Передача дела с подтверждением или отклонением пакета принимающей стороной, с причиной отклонения (паттерн «четырёх глаз», п. 98, срок 5 р.д.). Эстафета: куратор → ДПО → отдел проблемных кредитов → ПССИ / сектор активов.
- **P9-R6** 🔴 Высокий — Три раздельных не-фазовых механизма поверх любой стадии: пауза (дедлайн ≤70 дн, обязательный scope «процесс / мера», автоснятие, счётчик дней не замораживается), соглашение (новый график, мониторинг, не пауза), событие (смерть, недееспособность — увод вбок). У всех трёх фаза сохраняется.
- **P9-R7** 🟡 Средний — Флаг «право безакцептного списания» на кредитном договоре. Предусловие безакцепта наряду с решением комитета. В текущем мокапе кредита, вероятно, отсутствует — проверить.
- **P9-R8** 🟡 Средний — Общий механизм «серьёзное необратимое действие санкционируется решением комитета»: безакцептное списание, принятие имущества, списание безнадёжного долга, внесудебное обращение на залог. Не заводить под каждый случай отдельную реализацию.
- **P9-R9** 🟢 Низкий — Расчётные эффекты: регистрация извещения влечёт досрочное наступление всего долга (пересчёт требуемой суммы с просроченной части на полный остаток); при наличии решения суда погашение сначала направляется на сумму по судебному акту.
```

- [ ] **Step 3: Проверить, что хук синка не сломал Sheet**

Хук `scripts/todo_hook.py` срабатывает на правку `TODO.md` через Claude Code и пушит в Google Sheet. Проверить вывод хука. Если правка делалась внешним редактором — синкнуть руками:

Run: `python3 scripts/sync_todos.py --dry-run`
Expected: в превью видна новая вкладка/секция «Фаза 9» с девятью строками. Затем `python3 scripts/sync_todos.py`.

Если `service-account.json` отсутствует — синк упадёт; это не блокер задачи, отметить в отчёте.

- [ ] **Step 4: Обновить STATUS.md**

Строку `> Last updated:` заменить на:

```markdown
> Last updated: 2026-07-10 (мокап модуля взыскания: процессы вместо кредитов, M:N кредит↔процесс, три независимых измерения состояния, три оверлея) — _(update this date every time you edit)_
```

В `## Recent changes (changelog)`, первой строкой после `_Newest first._`, добавить запись в формате соседних строк (посмотреть `sed -n 40,50p STATUS.md`), по смыслу:

```markdown
- **2026-07-10** — Собран to-be мокап модуля «Взыскание задолженности» (`mockups/collection/collection.html`): список процессов взыскания (не кредитов), карточка на 7 вкладок, шапка-индикатор четырёх измерений, живой контроль пересечения охвата, 6 демо-процессов включая пару «два процесса на один кредит» и два терминальных исхода. Проверка: `scripts/inspect/collection-check.mjs`. Рекомендации команде: `TODO.md`, «Фаза 9» (P9-R1…R9).
```

- [ ] **Step 5: Финальный прогон**

Run: `node scripts/inspect/collection-check.mjs`
Expected: `ПРОВАЛЕНО АССЕРТОВ: 0`, `ОШИБОК КОНСОЛИ: 0`, exit 0.

- [ ] **Step 6: Коммит**

```bash
git add TODO.md STATUS.md
git commit -m "docs: TODO «Фаза 9 — Взыскание» (P9-R1…R9), STATUS — мокап взыскания"
```

---

## Приёмка (чек-лист спека)

Прогнать после Task 10. Каждый пункт закрыт ассертом в `collection-check.mjs`, кроме помеченных «глазами».

- [ ] Один файл, открывается в браузере, без внешних зависимостей — **глазами** (Task 9, Step 5)
- [ ] Ошибок в консоли нет — `ОШИБОК КОНСОЛИ: 0`
- [ ] Список показывает процессы, не кредиты — 6 строк, колонка «№ процесса»
- [ ] Есть кейс «2 процесса на 1 кредит» — 142 / 151 по дог. №56, `overlaps()` их находит
- [ ] Карточка: 7 вкладок, все переключаются, все непусты — цикл по 6 процессам × 7 вкладок в Task 9
- [ ] Шапка-индикатор: 4 измерения с подписью источника — Task 5
- [ ] Категория цветным бейджем — `pill.low/mid/high`
- [ ] Баннер паузы (янтарь) / соглашения (синий) / события (красный) — Task 5
- [ ] Фаза не редактируется селектором — `#detailPanels select` = 0
- [ ] Таймлайн фаз отражает текущую фазу и свою стадию — Task 6
- [ ] Модалка «Зарегистрировать меру» с условными предупреждениями — Task 6
- [ ] Модалка «Добавить кредит» с живым предупреждением о пересечении — Task 4
- [ ] Escape и клик по подложке закрывают модалку — Task 7
- [ ] Переключатель роли работает — Task 9
- [ ] Весь текст на русском, стиль деловой, светлая тема — **глазами**
