# «Условия»: карандаш в заголовке карточки — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Убрать с вкладки «Условия» ленту с кнопкой «Изменить условия», перенеся действие
карандашом в заголовки карточек «Ставки» и «Погашение», где модалка фильтруется по группе
параметров своей карточки.

**Architecture:** Правится один файл — `mockups/loan-credit/credit.html` (самодостаточный
HTML-макет: один `<script>` на строках 1642–8479, логический слой экспортируется в
`window.CR`, UI-слой читает его через `CR.*`). Добавляются два реестра-константы рядом с
`MATRIX_ZONE_*`, один UI-хелпер `condIconBtn` рядом с `roleIconBtn`, необязательный
аргумент у `CR.openCondModal`. Тесты — два новых кейса в headless-смоуке
`scripts/inspect/credit-check.mjs`.

**Tech Stack:** ванильный ES2020 в одном `<script>`, шаблонные строки вместо шаблонизатора,
Node 24 + `node:vm` для смоука, JSDOM для `tests/scope.test.mjs`. Сборки нет — файл
открывается браузером напрямую.

## Global Constraints

- **Язык интерфейса и комментариев — русский.** Английские подписи в UI не появляются.
- **Комментарий объясняет «почему», а не «что».** Дословная норма файла: у каждого
  нетривиального решения — комментарий с причиной и с отвергнутой альтернативой.
- **§0.3 — не молчаливый отказ.** Недоступное действие остаётся видимым: погашенный
  контрол + `title` с причиной + `CR.toast(причина,'warn')` по клику. Убирать контрол
  из разметки нельзя.
- **Гейты `gate()` и матрицу ролей не трогаем.** UI-слой только читает `canRole` /
  `gate` / `c.lifecycle`; их логика — предмет смоука.
- **Стиль оформления копируется с образца в том же файле,** а не изобретается: образец
  карандаша в заголовке — `credit.html:6346` (инлайн-стиль, не класс).
- **Смоук сам переписывает `credit.html`.** `scripts/inspect/credit-check.mjs` впечатывает
  стамп `SMOKE (node) …` в шапку файла — после каждого прогона `credit.html` изменён и
  входит в коммит.
- **Базовые числа до начала работ:** смоук `112/112 PASS` (последний кейс — `ok(110, …)`,
  `credit-check.mjs:1588`); `npm run test:credit` — 38 тестов.
- **Номера строк — снимок ДО работ.** Каждая задача сдвигает файл на несколько строк,
  поэтому искать место правки по приведённому тексту-якорю, а номер использовать только
  как ориентир.
- **Спека:** [`docs/superpowers/specs/2026-08-11-usloviya-karandash-v-zagolovke-kartochki-design.md`](../specs/2026-08-11-usloviya-karandash-v-zagolovke-kartochki-design.md).

---

### Task 1: Реестр групп параметров

**Files:**
- Modify: `mockups/loan-credit/credit.html:1770-1774` (рядом с `MATRIX_ZONE_*`)
- Modify: `mockups/loan-credit/credit.html:5374` (строка экспорта в `window.CR`)
- Test: `scripts/inspect/credit-check.mjs` — новый кейс `ok(111, …)` в БЛОКе 3

**Interfaces:**
- Consumes: `PARAM_KEYS` (`credit.html:1768`) — массив из 16 строковых ключей параметров.
- Produces: `CR.COND_CARD_RATES: string[]`, `CR.COND_CARD_REPAY: string[]` — разбиение
  `PARAM_KEYS` на две непересекающиеся группы, покрывающие его целиком. Обеими пользуются
  Task 2 (фильтр модалки) и Task 3 (карандаши в заголовках).

- [ ] **Step 1: Написать падающий тест**

В `scripts/inspect/credit-check.mjs`, внутри IIFE БЛОКа 3, сразу после строки
`ok(53, bad.length === 0, ...)` (`credit-check.mjs:956`) вставить:

```js
  /* 111. ГРУППЫ КАРАНДАШЕЙ вкладки «Условия» (волна 11.08.2026, КВ-25). Ленты с общей
     кнопкой «Изменить условия» больше нет — единственный вход в модалку идёт через
     карандаш карточки, поэтому ключ, не попавший ни в одну группу, становится
     нередактируемым молча. Тест держит разбиение полным и непересекающимся. */
  const gR = CR2.COND_CARD_RATES, gP = CR2.COND_CARD_REPAY;
  const both = (gR||[]).filter(k => (gP||[]).includes(k));
  const union = [...(gR||[]), ...(gP||[])].sort().join('|');
  ok(111, Array.isArray(gR) && Array.isArray(gP) && both.length === 0
          && union === [...CR2.PARAM_KEYS].sort().join('|'),
     `RATES=${(gR||[]).length} REPAY=${(gP||[]).length} пересечение=${both.length}`
     + ` покрытие ${union === [...CR2.PARAM_KEYS].sort().join('|') ? 'полное' : 'НЕПОЛНОЕ'}`);
```

- [ ] **Step 2: Прогнать смоук, убедиться, что кейс падает**

Run: `node scripts/inspect/credit-check.mjs`
Expected: `FAIL #111 RATES=0 REPAY=0 пересечение=0 покрытие НЕПОЛНОЕ`, итог `112/113 PASS`,
код возврата 1.

- [ ] **Step 3: Добавить реестр**

В `mockups/loan-credit/credit.html` сразу после строки
`const MATRIX_ZONE_REPAY = PARAM_KEYS.filter(k => !MATRIX_ZONE_RATES.includes(k));`
(`credit.html:1774`) вставить:

```js
/* Группы карандашей вкладки «Условия» (КВ-25): ровно то, что рисует карточка.
   НЕ MATRIX_ZONE_*: там льготы отнесены к «Ставкам» — это раскладка сводной матрицы
   в две колонки, а карточка «Ставки» льгот не показывает вовсе, и переиспользование
   зон сделало бы фильтр модалки враньём. REPAY считается вычитанием, чтобы новый
   параметр не остался без двери: ленты с общей кнопкой больше нет, и ключ, не попавший
   в группу, стал бы нередактируемым молча. */
const COND_CARD_RATES = ['rate','reserveRate','penaltyMain','penaltyInt'];
const COND_CARD_REPAY = PARAM_KEYS.filter(k => !COND_CARD_RATES.includes(k));
```

- [ ] **Step 4: Экспортировать в `window.CR`**

В `credit.html:5374` строка сейчас читается так:

```js
  conditionsAt, mkConditionRecord, mkPrimaryRecords, PARAMS, PARAM_KEYS, paramLabel, BASIS_KINDS,
```

Заменить на:

```js
  conditionsAt, mkConditionRecord, mkPrimaryRecords, PARAMS, PARAM_KEYS, paramLabel, BASIS_KINDS,
  COND_CARD_RATES, COND_CARD_REPAY,
```

- [ ] **Step 5: Прогнать смоук, убедиться, что кейс проходит**

Run: `node scripts/inspect/credit-check.mjs`
Expected: `PASS #111 RATES=4 REPAY=12 пересечение=0 покрытие полное`, итог `113/113 PASS`,
код возврата 0.

- [ ] **Step 6: Коммит**

```bash
git add mockups/loan-credit/credit.html scripts/inspect/credit-check.mjs
git commit -m "feat(credit): реестр групп параметров условий для карандашей карточек (КВ-25)"
```

---

### Task 2: Модалка принимает группу

**Files:**
- Modify: `mockups/loan-credit/credit.html:7811-7859` (`CR.openCondModal`)
- Test: `scripts/inspect/credit-check.mjs` — расширение кейса `ok(111, …)` не требуется;
  проверка ручная (модалка строится только в браузере, `openModal` пишет в DOM)

**Interfaces:**
- Consumes: `CR.COND_CARD_RATES`, `CR.COND_CARD_REPAY` из Task 1; `CR.PARAMS`
  (`credit.html:1744`) — массив `{key, label, kind, options?}`.
- Produces: `CR.openCondModal(group)` — `group` ∈ `'rates' | 'repay' | undefined`.
  Task 3 зовёт её строками `"CR.openCondModal('rates')"` и `"CR.openCondModal('repay')"`.

- [ ] **Step 1: Ввести фильтр в начале функции**

В `credit.html:7811` строка сейчас читается так:

```js
  CR.openCondModal=function(){ const c=modalGuard('addConditionRecords'); if(!c) return;
```

Заменить на:

```js
  /* group (КВ-25) — из какой карточки нажат карандаш: 'rates' | 'repay' | не задан
     (все шестнадцать). Фильтруем список параметров, а не блокируем чужие: карандаш
     обещает «правлю вот это», и модалка обязана обещание держать — иначе карандаш
     у «Погашения» показал бы и ставку. */
  CR.openCondModal=function(group){ const c=modalGuard('addConditionRecords'); if(!c) return;
    const groupKeys = group==='rates' ? CR.COND_CARD_RATES
                    : group==='repay' ? CR.COND_CARD_REPAY : null;
    const params = groupKeys ? CR.PARAMS.filter(p=>groupKeys.includes(p.key)) : CR.PARAMS;
    const groupTitle = group==='rates' ? 'Изменение условий — ставки'
                     : group==='repay' ? 'Изменение условий — погашение'
                     : 'Изменение условий';
```

- [ ] **Step 2: Переключить рендер полей на отфильтрованный список**

В `credit.html:7837` строка сейчас читается так:

```js
        ${CR.PARAMS.map(p=>{
```

Заменить на:

```js
        ${params.map(p=>{
```

- [ ] **Step 3: Подставить заголовок модалки**

В `credit.html:7855` (вызов `CR.openModal`) строка сейчас читается так:

```js
    CR.openModal('Изменение условий', body,
```

Заменить на:

```js
    CR.openModal(groupTitle, body,
```

- [ ] **Step 4: Проверить, что зависимые функции переживают отсутствующие поля**

Прочитать `CR.condRecalcDefaults` (`credit.html:7893`) и `CR.condPreview` — обе ходят по
`CR.PARAMS` целиком и начинаются со строки вида
`const el=document.getElementById('cbV_'+p.key); if(!el) return;`. Отфильтрованные поля
в DOM отсутствуют, `if(!el) return` их пропускает — правок не требуется. Если проверка
показала обратное (guard отсутствует), добавить его тем же видом и отметить это в отчёте.

- [ ] **Step 5: Прогнать смоук — регрессий нет**

Run: `node scripts/inspect/credit-check.mjs`
Expected: `113/113 PASS`, код возврата 0. (Смоук модалку не открывает — кейс проверяет,
что вкладка «Условия» по-прежнему рендерится без `undefined`/`NaN`, `#53`.)

- [ ] **Step 6: Проверить в браузере**

Открыть `mockups/loan-credit/credit.html`, кредит `K-1` («Действует»), вкладка «Условия»,
кнопка «Изменить условия». Ожидаемо: заголовок модалки «Изменение условий», все 16
параметров — старое поведение сохранено, вызов без аргумента ничего не сломал.

- [ ] **Step 7: Коммит**

```bash
git add mockups/loan-credit/credit.html
git commit -m "feat(credit): модалка изменения условий фильтруется по группе параметров (КВ-25)"
```

---

### Task 3: Карандаши в заголовках, лента удалена

**Files:**
- Modify: `mockups/loan-credit/credit.html:6069` (новый хелпер после `roleIconBtn`)
- Modify: `mockups/loan-credit/credit.html:6522-6531` (удаление ленты)
- Modify: `mockups/loan-credit/credit.html:6540` (заголовок «Ставки»)
- Modify: `mockups/loan-credit/credit.html:6571` (заголовок «Погашение»)
- Test: `scripts/inspect/credit-check.mjs` — новый кейс `ok(112, …)`

**Interfaces:**
- Consumes: `CR.openCondModal(group)` из Task 2; `isTerminal(c)`, `terminalReason(c)`
  (`credit.html:6039, 6043`), `canRole(currentRole, action)`, `currentCredit()`,
  `jsAttr(s)`, `svgPencil()` (`credit.html:6013`).
- Produces: `condIconBtn(title, onclick) → string` — HTML кнопки-карандаша с
  трёхуровневым гейтом. Дальше по плану не используется.

- [ ] **Step 1: Написать падающий тест**

В `scripts/inspect/credit-check.mjs`, сразу после кейса `ok(111, …)` из Task 1, вставить:

```js
  /* 112. КАРАНДАШИ ВКЛАДКИ «УСЛОВИЯ» (КВ-25). Лента .gtoolbar с единственной кнопкой
     «Изменить условия» удалена, вход — карандаш в заголовке каждой из двух карточек.
     Проверяем три состояния: при «Действует» карандаша ровно два и они кликабельны;
     при «Проект» они на месте, но погашены и объясняют Г-22 (§0.3 — не молчаливый
     отказ, карандаш не имеет права исчезнуть); при «Закрыт» — то же с terminalReason. */
  const condHtml = (id) => CR2.renderTab('Условия', CR2.db.credits.find(c => c.id === id));
  const act = condHtml('K-1'), proj = condHtml('K-C26'), clos = condHtml('K-6');
  const nCalls = (h) => (h.match(/CR\.openCondModal\(/g) || []).length;
  ok(112, nCalls(act) === 2
          && /openCondModal\('rates'\)/.test(act) && /openCondModal\('repay'\)/.test(act)
          && !/>Изменить условия</.test(act)
          && nCalls(proj) === 0 && (proj.match(/Г-22/g) || []).length === 2
          && nCalls(clos) === 0 && (clos.match(/терминальном состоянии/g) || []).length >= 2,
     `Действует=${nCalls(act)} Проект=${nCalls(proj)}/Г-22×${(proj.match(/Г-22/g)||[]).length}`
     + ` Закрыт=${nCalls(clos)}`);
```

- [ ] **Step 2: Прогнать смоук, убедиться, что кейс падает**

Run: `node scripts/inspect/credit-check.mjs`
Expected: `FAIL #112 Действует=1 Проект=0/Г-22×1 Закрыт=0`, итог `113/114 PASS`,
код возврата 1. (Сейчас вход один — кнопка в ленте, и Г-22 в разметке встречается один раз.)

- [ ] **Step 3: Добавить хелпер `condIconBtn`**

В `mockups/loan-credit/credit.html` сразу после закрывающей скобки `roleIconBtn`
(`credit.html:6069`, строка `  }`) вставить:

```js
  /* Карандаш «изменить условия» в заголовке карточки (КВ-25). Не roleIconBtn: тот знает
     терминал и роль, а у записи условия причин отказа три — третья это ЖЦ. Погашенное
     состояние обязательно (§0.3): при ЖЦ «Проект» пользователь должен прочитать, что
     условия там правятся напрямую (Г-22), а не обнаружить пустой заголовок. */
  function condIconBtn(title, onclick){
    const _c=currentCredit();
    const off=(msg)=>`<button class="icon-btn" style="opacity:.45;cursor:not-allowed" title="${jsAttr(msg)}" onclick="CR.toast('${jsAttr(msg)}','warn')">${svgPencil()}</button>`;
    if(isTerminal(_c)) return off(terminalReason(_c));
    if(!canRole(currentRole,'addConditionRecords')) return off('Роль «'+currentRole+'» не имеет права на это действие');
    if(!['Зарегистрирован','Действует'].includes(_c.lifecycle))
      return off('Условия меняются только при ЖЦ «Зарегистрирован» или «Действует» — при «Проект» они правятся напрямую (Г-22)');
    return `<button class="icon-btn" title="${jsAttr(title)}" onclick="${onclick}">${svgPencil()}</button>`;
  }
```

- [ ] **Step 4: Удалить ленту**

В `credit.html:6522-6531` удалить целиком блок:

```js
      <div class="gtoolbar" style="margin-bottom:14px">
        ${(()=>{ const cls='btn btn-primary btn-sm', label='Изменить условия';
          if(isTerminal(c)) return disabledBtn(label, terminalReason(c), cls);
          if(!canRole(currentRole,'addConditionRecords'))
            return disabledBtn(label, 'Роль «'+currentRole+'» не имеет права на это действие', cls);
          if(!['Зарегистрирован','Действует'].includes(c.lifecycle))
            return disabledBtn(label, 'Условия меняются только при ЖЦ «Зарегистрирован» или «Действует» — при «Проект» они правятся напрямую (Г-22)', cls);
          return `<button class="${cls}" onclick="CR.openCondModal()">${esc(label)}</button>`;
        })()}
      </div>
```

Ничем не заменять: следующая строка `<div class="pcards">` становится первой после блока
ретро-предупреждения. Блок `warn-inline` выше (Д-5, «Перейти к перегенерации графика») —
не трогать.

- [ ] **Step 5: Вставить карандаш в заголовок «Ставки»**

В `credit.html:6540` строка сейчас читается так:

```html
          <div class="section-h">Ставки</div>
```

Заменить на:

```html
          <div class="section-h" style="display:flex;align-items:center;justify-content:space-between">Ставки
            ${condIconBtn('Изменить ставки', "CR.openCondModal('rates')")}</div>
```

- [ ] **Step 6: Вставить карандаш в заголовок «Погашение»**

В `credit.html:6571` строка сейчас читается так:

```html
          <div class="section-h">Погашение</div>
```

Заменить на:

```html
          <div class="section-h" style="display:flex;align-items:center;justify-content:space-between">Погашение
            ${condIconBtn('Изменить условия погашения', "CR.openCondModal('repay')")}</div>
```

- [ ] **Step 7: Прогнать смоук, убедиться, что кейс проходит**

Run: `node scripts/inspect/credit-check.mjs`
Expected: `PASS #112 Действует=2 Проект=0/Г-22×2 Закрыт=0`, итог `114/114 PASS`,
код возврата 0.

- [ ] **Step 8: Прогнать JSDOM-набор**

Run: `npm run test:credit`
Expected: 38 тестов, все проходят. T2-4 рендерит «Условия» и проверяет блок расхождений —
он не затронут.

- [ ] **Step 9: Проверить в браузере**

Открыть `mockups/loan-credit/credit.html`, вкладка «Условия»:
- `K-1` («Действует») — ленты нет, вкладка начинается с карточек; карандаш справа в
  заголовках «Ставки» и «Погашение»; клик по первому даёт модалку «Изменение условий —
  ставки» с четырьмя параметрами, по второму — «— погашение» с остальными;
- `K-C26` («Проект») — оба карандаша видны погашенными, при наведении и по клику
  объясняют Г-22;
- `K-6` («Закрыт») — оба карандаша погашены с текстом про терминальное состояние;
- переключить роль на «Наблюдатель» — карандаши погашены с текстом про роль;
- консоль браузера без ошибок.

- [ ] **Step 10: Коммит**

```bash
git add mockups/loan-credit/credit.html scripts/inspect/credit-check.mjs
git commit -m "feat(credit): карандаш в заголовке карточки вместо ленты «Изменить условия» (КВ-25)"
```

---

### Task 4: Запись волны в статус разработки

**Files:**
- Modify: `mockups/loan-credit/ASUBK-status-razrabotki.md` (в конец файла)

**Interfaces:**
- Consumes: результат Task 1–3.
- Produces: ничего — документный хвост волны.

- [ ] **Step 1: Прочитать образец предыдущей волны**

Прочитать `mockups/loan-credit/ASUBK-status-razrabotki.md:1507` и далее — раздел
«Что сделано волной 11.08.2026 (восьмая) — модалка плана: селектор года (КВ-24)».
Повторить его структуру: заголовок, «Задача», «Решения», «Реализация», ссылка на спеку.

- [ ] **Step 2: Дописать раздел**

Добавить в конец файла раздел с заголовком:

```markdown
## Что сделано волной 11.08.2026 (девятая) — «Условия»: карандаш в заголовке карточки (КВ-25)
```

Содержание: лента `.gtoolbar` с единственной primary-кнопкой удалена, действие переехало
карандашом в заголовки карточек «Ставки» и «Погашение» по образцу «Реквизитов договора»;
модалка фильтруется по группе `COND_CARD_RATES` / `COND_CARD_REPAY`; хелпер `condIconBtn`
держит три причины отказа с погашенным состоянием (§0.3); смоук вырос `112 → 114`.
Отдельной задачей поверх — фильтр по виду ДС (ADR-0111, Г-23). Ссылка на спеку:
`docs/superpowers/specs/2026-08-11-usloviya-karandash-v-zagolovke-kartochki-design.md`.

- [ ] **Step 3: Коммит**

```bash
git add mockups/loan-credit/ASUBK-status-razrabotki.md
git commit -m "docs(credit): запись волны КВ-25 — карандаш в заголовке карточки «Условий»"
```

---

## Что вне плана

Фильтр `PARAMS` по виду ДС ([ADR-0111](../../adr/0111-vid-ds-razvodit-marshruty-izmeneniya-usloviy.md),
Г-23, зона «вне п. 89») — отдельная задача: требует закрытого справочника видов ДС и двух
новых параметров досрочки (`earlyRepayMoratorium`, `earlyRepayFee`), которых в макете нет.
