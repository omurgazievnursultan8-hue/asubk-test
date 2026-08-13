# «Классификация» получает правку (КВ-30) — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Открыть дверь в карточку «Классификация» вкладки «Договор» — единственную owned-группу
карточки кредита, у которой её нет вовсе. Двойной режим паттерна КР-55: в ЖЦ «Проект» правка
напрямую, после регистрации — доп. соглашением с датой вступления, значение выводится на дату
среза. Ввод ограничен набором кредитной программы, и ради этого затравка выравнивается по
справочникам (КР-59): сегодня в «Источнике финансирования» у всех 59 кредитов лежит строка из
справочника «Вид кредита».

**Architecture:** Правится один файл — `mockups/loan-credit/credit.html` (самодостаточный
HTML-макет: один `<script>`, логика в `window.CR`, UI перерисовывается целиком). Модель растёт на
одно поле (`classificationRecords: []` в `mkCredit`) и на записи правки; производные не хранятся —
действующее значение выводится `classificationAt(credit, date)`. Набор допустимых значений —
константа-зеркало кредитной программы, третий экземпляр идиомы `PROGRAM_DOCS`. Тесты — новые кейсы
в headless-смоуке `scripts/inspect/credit-check.mjs`.

**Tech Stack:** ванильный ES2020 в одном `<script>`, шаблонные строки вместо шаблонизатора,
Node 24 + `node:vm` для смоука, JSDOM для `tests/scope.test.mjs`. Сборки нет.

## Global Constraints

- **Язык интерфейса и комментариев — русский.**
- **Комментарий объясняет «почему»**, с отвергнутой альтернативой — идиома файла.
- **Производные не хранятся** (ADR-0001): ни действующее значение, ни признак «есть будущая
  запись» в модель не переезжают.
- **§0.3 — не молчаливый отказ.** Кнопка правки при закрытом гейте гаснет с причиной в `title`,
  а не исчезает.
- **Подпись появляется, когда несёт факт** (правило КВ-27): «основание · с даты» рисуется только
  у поля, у которого есть запись.
- **И-11 — зеркало здесь не правится:** набор значений принадлежит программе, кредит его читает.
- **Порядок секций скрипта фиксирован:** utils → `seedDb` → чистая логика → мутации →
  `window.CR` → DOM-блок. Правки ложатся в свои секции.
- **Гейты нумерует реестр** `docs/superpowers/specs/2026-07-26-kredit-gates.md`, а не шапка
  макета: Г-34 и Г-35.
- **Прогон — ОДИН, в самом конце** (Task 5), а не после каждой задачи: полный набор нагружает
  машину. Кейсы пишутся в своих задачах и до Task 5 остаются непрогнанными — это осознанно.
- **Смоук сам переписывает `credit.html`** — впечатывает стамп `SMOKE (node) …` в шапку; после
  прогона файл изменён и входит в коммит Task 5.
- **Базовые числа до начала работ:** `credit-check.mjs` — **140/140 PASS**;
  `restructuring-check.mjs` — 71/71; `npm run test:credit` — 33/38 (пять фейлов «Прогноза»
  унаследованы и этой волной не чинятся).
- **Номера строк — снимок ДО работ.** Каждая задача сдвигает файл; место правки искать по
  тексту-якорю.
- **Спека:** [`docs/superpowers/specs/2026-08-13-klassifikaciya-pravka-design.md`](../specs/2026-08-13-klassifikaciya-pravka-design.md).
- **Язык:** статья «Классификация кредита» в `CONTEXT.md` заведена ДО начала работ (в одном
  коммите со спекой).

---

### Task 1: Модель — набор программы, запись, срез

**Files:**
- Modify: `mockups/loan-credit/credit.html:1837-1864` — `PROGRAM_CLASSIFICATION` рядом с
  `PROGRAM_DOCS` / `PROGRAM_DISB_WINDOW`
- Modify: `mockups/loan-credit/credit.html:2079-2097` — `mkClassificationRecord`,
  `classificationAt` рядом с `mkSubjectRecord` / `subjectAt`
- Modify: `mockups/loan-credit/credit.html:2166` — `classificationRecords: []` в `mkCredit`

**Interfaces:**
- Consumes: `crOrder` (`:1932`), `pd`, `TODAY`, `currentRole`.
- Produces: `programClassification(credit)`, `mkClassificationRecord(over)`,
  `classificationAt(credit, date)`.

- [ ] **Step 1: `PROGRAM_CLASSIFICATION` + `programClassification`**

Значения — из `mockups/dictionaries/dictionaries.html` (`loan-types` · `loan-credit-lines` ·
`order-term-funds`), разрезанные по восьми программам. DEFAULT — весь справочник: неизвестную
программу лучше не блокировать, чем выдумать ей набор (та же мысль, что у
`PROGRAM_DOCS_DEFAULT`). Комментарий обязан сказать: набор — зеркало программы, здесь не
правится и не расширяется (И-11); конкретные разрезы — плейсхолдер, как у
`PROGRAM_DISB_WINDOW`.

- [ ] **Step 2: `mkClassificationRecord`**

Форма — копия `mkConditionRecord` (`:1923`), а не `mkSubjectRecord`: у классификации параметр
всегда есть, меняется значение, `action: 'add'|'remove'` тут не о чем. Поля: `id:'KL-n'`,
`param` (`kind`|`line`|`purpose`|`fundingSource`), `value`, `effectiveFrom`, `basis`
(`kind:'agreement'`), `note`, `createdAt`, `createdBy`.

- [ ] **Step 3: `classificationAt(credit, date)` и поле в `mkCredit`**

База — четыре поля кредита (значение «Проекта»), поверх — записи с
`effectiveFrom ≤ date`, отсортированные существующим `crOrder` (сортировка не завязана на
условия). Возвращает `{kind, line, purpose, fundingSource, src:{param → запись}}` — `src`
нужен подписи «основание · с даты» и хранением не является, он собирается в момент вызова.
В `mkCredit` — `classificationRecords: []` рядом с `subjectRecords: []`.

---

### Task 2: Гейты Г-34/Г-35, роли, мутации, экспорт

**Files:**
- Modify: `mockups/loan-credit/credit.html:5163-5194` — новые case рядом с `editSubject` /
  `addSubjectRecords`
- Modify: `mockups/loan-credit/credit.html:5271-5277` — `ROLE_ACTIONS`
- Modify: `mockups/loan-credit/credit.html:5734-5775` — мутации рядом с `editSubject` /
  `addSubjectRecords`
- Modify: `mockups/loan-credit/credit.html:5845-5847` — экспорт в `window.CR`
- Modify: `docs/superpowers/specs/2026-07-26-kredit-gates.md` — Г-34/Г-35 в реестр

**Interfaces:**
- Consumes: `gate`, `pushAudit` (`:5421`), `programClassification`, `classificationAt`,
  `mkClassificationRecord`.
- Produces: `editClassification(credit, ctx)`, `addClassificationRecords(credit, ctx)`.

- [ ] **Step 1: Г-34 `editClassification`**

Три причины (тексты — в спеке): ЖЦ ≠ «Проект» · пустое обязательное значение · значение вне
набора программы. Причины показываются вместе, как у Г-6/Г-7. Отказ по набору называет
программу и сам набор — иначе пользователю нечем исправиться.

- [ ] **Step 2: Г-35 `addClassificationRecords`**

Шесть причин (спека): ЖЦ · реквизиты ДС (Г-10-паттерн) · пустая дата вступления · дата
раньше даты договора (Г-18-паттерн) · пустой набор изменений · значение вне набора. Значение,
равное действующему на дату вступления, изменением не считается — иначе журнал наполняется
записями «было А, стало А».

- [ ] **Step 3: Роли**

`editClassification` и `addClassificationRecords` — «Кредитный специалист» и «Начальник
отдела», как у предмета кредита. «Наблюдатель» не трогаем.

- [ ] **Step 4: Мутации**

`editClassification` — присваивает поля, один `pushAudit` с `before`/`after` по изменённым.
`addClassificationRecords` — по записи на изменённый параметр, ДС при первом упоминании
попадает в `credit.agreements` (как в `addSubjectRecords`), каждая запись — свой `pushAudit`.
Обе зовут `gate()` первыми строками: мутация без гейта не бывает.

- [ ] **Step 5: Экспорт и реестр гейтов**

`window.CR` — рядом с `editSubject, addSubjectRecords, subjectAt, mkSubjectItem`.
В `2026-07-26-kredit-gates.md`: строки Г-34/Г-35 в таблицу §1, развёртка в §2, две строки в
матрицу ролей §3, обновление §1.2 («следующий свободный номер — Г-36») и покрытия §4.

---

### Task 3: Рендер карточки и две модалки

**Files:**
- Modify: `mockups/loan-credit/credit.html:6858-6866` — карточка «Классификация»
- Modify: `mockups/loan-credit/credit.html:8842-8910` — модалки рядом с `openSubjectAgrModal` /
  `openContractRequisitesModal`

**Interfaces:**
- Consumes: `roleIconBtn`, `roleBtn`, `svgPencil`, `fld`, `modalGuard` (`:8469`),
  `BASIS_KINDS`, `cardAsOf`, `esc`, `toast`, `closeModal`, `rerenderDetail`.

- [ ] **Step 1: Заголовок с кнопкой**

Инлайн `display:flex;align-items:center;justify-content:space-between` — копия «Реквизитов
договора» (`:6848-6849`), своего класса не заводим. В «Проекте» (`c.lifecycle === 'Проект'`,
тот же критерий, что `subjEditableDirect` `:6831`) — карандаш `editClassification`; иначе —
`roleBtn('addClassificationRecords','Изменить (доп. соглашением)')`.

- [ ] **Step 2: Значения на дату среза и подпись основания**

Четыре `fld` читают `classificationAt(c, cardAsOf)`. Под полем с записью — `<span class="src">`
вида `📄 ДС-14 · с 01.09.2026` (идиома `srcLine`, `:6965-6968`). У поля без записи подписи нет.

- [ ] **Step 3: Модалка прямой правки**

`CR.openClassificationModal` / `CR.submitClassification`: три `<select>` из
`programClassification(c)` + `<input>` «Цель». `section-note` называет программу, чей набор
показан. Перед мутацией — повторный `gate()`.

- [ ] **Step 4: Модалка доп. соглашения**

`CR.openClassificationAgrModal` / `CR.submitClassificationAgr`: те же четыре поля плюс № ДС ·
дата ДС · скан · дата вступления · примечание. Отправляются только изменённые параметры;
пустая форма упирается в гейт «ни один параметр не изменён».

---

### Task 4: КР-59 — затравка по справочникам

**Files:**
- Modify: `mockups/loan-credit/credit.html:2314, 2403, 2446, 2526, 2583, 2620, 2658, 2707, 2851`
- Modify: `mockups/loan-credit/credit.html:3075` и таблица сценариев `:3134-3170`
- Test: `scripts/inspect/credit-check.mjs` — кейс регрессии (пишем, не прогоняем)

- [ ] **Step 1: Именованные кредиты**

Каждому — значения из набора его программы, с разбросом (не все восемь одинаковыми).
«Цель» не трогаем: она уже несёт смысл, который уходил в «Вид».

- [ ] **Step 2: Генератор фона**

`kind`/`line`/`fundingSource` — из `programClassification` по индексу сценария. Колонка `k:`
из таблицы сценариев уходит (дублирует `pu:`), вместе с ней — комментарий-легенда над
таблицей. `line: s.tr2?'Возобновляемая':'Единовременный'` уходит: АРР/ФРР это доноры, а не
однократность выдачи.

- [ ] **Step 3: Кейс регрессии**

У всех 59 кредитов `kind`/`line`/`fundingSource` лежат в наборе своей программы. Кейс
защищает не текущие значения, а само правило: следующая правка затравки мимо набора станет
красной.

---

### Task 5: Смоук, прогон, снимок, статус

**Files:**
- Modify: `scripts/inspect/credit-check.mjs` — шесть кейсов сверх регрессии из Task 4
- Create: `scripts/inspect/credit-kv30-shot.mjs`
- Modify: `mockups/loan-credit/credit.html` (стамп смоука)
- Modify: `mockups/loan-credit/ASUBK-status-razrabotki.md`, `ASUBK-kredit-logika.md`

- [ ] **Step 1: Кейсы**

а) `classificationAt` без записей = базовые поля · б) будущая запись не видна на `TODAY`,
видна на своей дате · в) `editClassification` на «Зарегистрирован» отбит · г)
`addClassificationRecords` в «Проекте» отбит · д) значение вне набора отбито обоими гейтами ·
е) успешная запись кладёт ДС в `agreements` и пишет в `audit`.

- [ ] **Step 2: Прогон**

Run: `node scripts/inspect/credit-check.mjs` → ожидается **147/147 PASS** (140 + 7).
Run: `node scripts/inspect/restructuring-check.mjs` → 71/71.
Run: `npm run test:credit` → 33/38, те же пять фейлов «Прогноза».

- [ ] **Step 3: Настоящий браузер**

`scripts/inspect/credit-kv30-shot.mjs` по образцу `credit-kv29-shot.mjs`: карточка
«Классификация» на кредите в «Проекте» (карандаш) и на действующем (кнопка ДС), обе модалки
открыты, консоль чистая.

- [ ] **Step 4: Документы волны**

`ASUBK-status-razrabotki.md`: строка КВ-30 в таблицу решений, дефект КР-59 в раздел C, раздел
«Что сделано волной КВ-30» с числами прогона и ссылками на спеку и этот план.
`ASUBK-kredit-logika.md` §9 «Швы»: классификация — owned с зеркальным набором значений.
В `TODO.md` не идёт — задачи по макетам живут в статус-документе модуля.

- [ ] **Step 5: Коммит**

```bash
git add mockups/loan-credit/credit.html scripts/inspect/credit-check.mjs \
        scripts/inspect/credit-kv30-shot.mjs mockups/loan-credit/ASUBK-status-razrabotki.md \
        mockups/loan-credit/ASUBK-kredit-logika.md
git commit -m "feat(credit): «Классификация» правится — прямо в «Проекте», ДС после (КВ-30)"
```
