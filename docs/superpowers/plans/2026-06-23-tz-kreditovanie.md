# ТЗ по подсистеме кредитования (as-is) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Написать функциональную спецификацию as-is подсистемы «Система кредитования» АСУБК — головной `index.md` + 7 файлов по этапам, каждое утверждение подкреплено live-инспекцией.

**Architecture:** Один переиспользуемый Playwright-дамп-скрипт (`scripts/inspect/tz/dump.mjs`) извлекает с любого маршрута: заголовок, кнопки тулбара, колонки грида, поля форм (label + обязательность). Каждая задача-этап гоняет дамп на своих маршрутах, затем пишет MD-раздел по единому шаблону, сверяя текст с JSON-выводом. Финальная задача синтезирует головной `index.md` (модель данных, глоссарий) из собранных фактов.

**Tech Stack:** Node.js + playwright-core (system Chrome), Markdown. Стенд: https://fkftest.okmot.kg/ (admin/admin). Без сборки/тестов — репо хранит доки и скрипты.

## Global Constraints

- Язык документа — **русский** (конвенция репо; `TODO.md`/`requirements` на русском).
- **Чистый as-is**: основной текст без дефектов и рекомендаций. Дефекты живут в `notes/qa-findings.md`, рекомендации — в `TODO.md`; в ТЗ их не дублировать.
- Каждое утверждение о поведении подкреплено ссылкой: «проверено 2026-06-23, `scripts/inspect/tz/...`».
- Границы: только подсистема кредитования (`Госрешение → Программа → Заявка → Заёмщик → Кредит → Транш → Обслуживание`). Прочие подсистемы — только как внешние связи.
- Скрипты переиспользуют auth-профиль `.auth/profile`, логинятся сами (паттерн `scripts/inspect/login.mjs`).
- Стенд мутирует реальные тест-данные — created records линяют, чистить не нужно.
- Шаблон файла этапа (7 разделов): 1) Назначение · 2) Экраны (URL) · 3) Поля (таблица `поле·тип·обяз.·справочник·описание`) · 4) Функции/действия · 5) Бизнес-правила и расчёты (формула + числовой пример) · 6) Статусная модель · 7) Связи.
- Маршруты по этапам (ВЕРИФИЦИРОВАНЫ дамп-скриптом 2026-06-23):
  - 01 Госрешение — `gov-decisions`
  - 02 Кред. программа — `loan-programs`
  - 03 Заявка/комиссия — `loan-applications`, `loan-application-commissions`, деталь `loan-applications/{id}`
  - 04 Заёмщик — `loan-applicants`, деталь `loan-applicants/{id}`
  - 05 Кредит — `loansCredit`, `loan-credits/{id}`
  - 06 Транши/освоение — `sub-loans`, `disbursements`
  - 07 Обслуживание — `payments`, `loan-reserves`, `loan-ledgers`

---

### Task 1: Переиспользуемый дамп-скрипт + каркас каталога `tz/`

**Files:**
- Create: `scripts/inspect/tz/dump.mjs`
- Create: `requirements/tz/index.md` (каркас, наполняется в Task 9)
- Modify: `requirements/README.md` (ссылка на `tz/`)

**Interfaces:**
- Produces: `node scripts/inspect/tz/dump.mjs <route>` — логинится, переходит на `BASE+<route>`, печатает в stdout JSON `{ url, title, toolbarButtons[], gridColumns[], formFields[] }`, делает скриншот `.auth/tz-<route>.png`. Каждая задача-этап вызывает этот скрипт.

- [ ] **Step 1: Написать дамп-скрипт**

```js
// scripts/inspect/tz/dump.mjs
import { chromium } from 'playwright-core';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';
const route = (process.argv[2] || '').replace(/^\//, '');

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', USER);
  await page.fill('input[name=password]', PASS);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}),
    page.keyboard.press('Enter'),
  ]);
  await page.waitForTimeout(2000);
}
await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(1500);

const dump = await page.evaluate(() => {
  const txt = el => (el.textContent || '').trim().replace(/\s+/g, ' ');
  const uniq = a => [...new Set(a.filter(Boolean))];
  return {
    title: document.title,
    h: uniq([...document.querySelectorAll('h1,h2,[class*=title]')].map(txt)).slice(0, 8),
    toolbarButtons: uniq([...document.querySelectorAll('vaadin-button,button,[role=button]')].map(txt)).filter(t => t && t.length < 40),
    gridColumns: uniq([...document.querySelectorAll('vaadin-grid-cell-content')]
      .map(txt)).slice(0, 60),
    formFields: uniq([...document.querySelectorAll('vaadin-text-field,vaadin-combo-box,vaadin-date-picker,vaadin-number-field,vaadin-text-area,label')]
      .map(el => {
        const label = el.getAttribute && el.getAttribute('label');
        const req = el.hasAttribute && el.hasAttribute('required');
        return label ? `${label}${req ? ' *' : ''}` : txt(el);
      })).filter(Boolean).slice(0, 80),
  };
});
dump.url = page.url();
console.log(JSON.stringify(dump, null, 2));
await page.screenshot({ path: `.auth/tz-${route.replace(/\W+/g, '_') || 'root'}.png`, fullPage: true });
await ctx.close();
```

- [ ] **Step 2: Прогнать дамп на известном маршруте — убедиться, что выдаёт JSON**

Run: `node scripts/inspect/tz/dump.mjs decisions`
Expected: JSON с непустыми `toolbarButtons` и `gridColumns` (список госрешений) + создан `.auth/tz-decisions.png`. Если пусто — поправить селекторы (Vaadin рендерит в shadow DOM; при необходимости расширить `page.evaluate` обходом `*.shadowRoot`).

- [ ] **Step 3: Создать каркас `requirements/tz/index.md`**

```markdown
# ТЗ — Подсистема «Система кредитования» (as-is)

> Функциональная спецификация as-is. Стенд: https://fkftest.okmot.kg/ (admin/admin).
> Все факты верифицированы live-инспекцией, см. `scripts/inspect/tz/`.

## Назначение и границы
_(наполняется в Task 9)_

## Архитектура и доступ
_(наполняется в Task 9)_

## Модель данных
_(наполняется в Task 9 — цепочка Госрешение → Программа → Заявка → Заёмщик → Кредит → Транш → Обслуживание)_

## Глоссарий
_(наполняется в Task 9)_

## Этапы жизненного цикла
1. [Госрешение](01-gosreshenie.md)
2. [Кредитная программа](02-kreditnaya-programma.md)
3. [Заявка / комиссия](03-zayavka-komissiya.md)
4. [Заёмщик](04-zaemshchik.md)
5. [Выдача кредита](05-kredit.md)
6. [Транши / освоение](06-transhi-osvoenie.md)
7. [Обслуживание](07-obsluzhivanie.md)
```

- [ ] **Step 4: Добавить ссылку в `requirements/README.md`**

Добавить строку в список содержимого: `- tz/ — техническое задание (функц. спецификация as-is) подсистемы кредитования.`

- [ ] **Step 5: Commit**

```bash
git add scripts/inspect/tz/dump.mjs requirements/tz/index.md requirements/README.md
git commit -m "tz: add reusable dump script + tz/ skeleton"
```

---

### Task 2: Раздел 01 — Госрешение (`gov-decisions`)

**Files:**
- Create: `requirements/tz/01-gosreshenie.md`
- Reference: `requirements/features/01-government-decision.md`, `mockups/decision/*`

**Interfaces:**
- Consumes: `scripts/inspect/tz/dump.mjs` (Task 1).

- [ ] **Step 1: Инспекция списка и формы создания**

Run:
```bash
node scripts/inspect/tz/dump.mjs gov-decisions
```
Открыть форму создания вручную в том же скрипте при необходимости (адаптировать: после навигации кликнуть «Создать», дамп полей). Зафиксировать: кнопки тулбара, колонки списка, поля формы + обязательность, статусную модель решения (из `requirements/features/01-government-decision.md` — 6-статусная модель, сверить с live).

- [ ] **Step 2: Написать раздел по 7-пунктному шаблону**

Файл `requirements/tz/01-gosreshenie.md`. Структура (заполнить реальными данными из Step 1):
```markdown
# 01. Госрешение

> Маршрут: `/decisions`. Проверено 2026-06-23, `scripts/inspect/tz/dump.mjs decisions`.

## 1. Назначение
Государственное решение — корневая сущность: основание для создания кредитных программ...

## 2. Экраны
| Экран | URL | Действия |
|---|---|---|
| Список | `/decisions` | <кнопки тулбара> |
| Создание | … | … |
| Деталь | … | … |

## 3. Поля
| Поле | Тип | Обяз. | Справочник | Описание |
|---|---|---|---|---|
| … | … | … | … | … |

## 4. Функции и действия
- …

## 5. Бизнес-правила
- …

## 6. Статусная модель
<диаграмма статусов>

## 7. Связи
- Госрешение → Кредитная программа (1:N).
```

- [ ] **Step 3: Сверить раздел с JSON-выводом**

Проверить: каждое поле/кнопка в разделе присутствует в дампе Step 1; нет дефектов/рекомендаций в тексте; есть строка «проверено … `scripts/...`».

- [ ] **Step 4: Commit**

```bash
git add requirements/tz/01-gosreshenie.md
git commit -m "tz: write section 01 — government decision (as-is)"
```

---

### Task 3: Раздел 02 — Кредитная программа (`/loan-programs`)

**Files:**
- Create: `requirements/tz/02-kreditnaya-programma.md`
- Reference: `requirements/features/02-loan-program.md`, `02-loan-program-field-analysis.md`, `mockups/loan-program.html`

**Interfaces:**
- Consumes: `scripts/inspect/tz/dump.mjs`.

- [ ] **Step 1: Инспекция списка + 9-вкладочного мастера создания**

Run: `node scripts/inspect/tz/dump.mjs loan-programs`
Программа создаётся мастером из 9 вкладок (см. `requirements/features/02-loan-program.md`). Пройти каждую вкладку (адаптировать дамп: кликать вкладки, собирать поля). Зафиксировать поля всех вкладок, льготный период, диапазоны срок/ставка.

- [ ] **Step 2: Написать `requirements/tz/02-kreditnaya-programma.md`** по 7-пунктному шаблону (как Task 2 Step 2), с таблицей полей по вкладкам и бизнес-правилами (диапазоны суммы/срока/ставки, льготный период).

- [ ] **Step 3: Сверить с дампом** (как Task 2 Step 3).

- [ ] **Step 4: Commit**

```bash
git add requirements/tz/02-kreditnaya-programma.md
git commit -m "tz: write section 02 — loan program (as-is)"
```

---

### Task 4: Раздел 03 — Заявка / комиссия (`loan-applications`) — ПРИОРИТЕТ

**Files:**
- Create: `requirements/tz/03-zayavka-komissiya.md`
- Reference: `requirements/features/03-application-commission.md`

> Нет отдельного верифицированного фич-дока по полному циклу заявки — инспектировать тщательно (комиссия, решение комиссии, переход заявка→кредит).

**Interfaces:**
- Consumes: `scripts/inspect/tz/dump.mjs`.

- [ ] **Step 1: Инспекция списка заявок, формы создания, экрана комиссии**

Run:
```bash
node scripts/inspect/tz/dump.mjs loan-applications
node scripts/inspect/tz/dump.mjs loan-application-commissions
```
Зафиксировать: поля заявки, статусы заявки (Одобрено/Отклонено/На рассмотрении), связь с госрешением и программой, механику комиссии (`loan-application-commissions`) и переход к кредиту, график погашений на уровне заявки. Деталь — `loan-applications/{id}`.

- [ ] **Step 2: Написать `requirements/tz/03-zayavka-komissiya.md`** по 7-пунктному шаблону. В разделе 5 описать расчёт графика на уровне заявки; в разделе 6 — статусную модель заявки; в разделе 7 — переход заявка→кредит.

- [ ] **Step 3: Сверить с дампом.**

- [ ] **Step 4: Commit**

```bash
git add requirements/tz/03-zayavka-komissiya.md
git commit -m "tz: write section 03 — application/commission (as-is)"
```

---

### Task 5: Раздел 04 — Заёмщик (`loan-applicants`) — ПРИОРИТЕТ

**Files:**
- Create: `requirements/tz/04-zaemshchik.md`
- Reference: `requirements/features/04-borrower.md`

**Interfaces:**
- Consumes: `scripts/inspect/tz/dump.mjs`.

- [ ] **Step 1: Инспекция списка заёмщиков + карточки**

Run: `node scripts/inspect/tz/dump.mjs loan-applicants`
Зафиксировать: поля заёмщика (физ/юр лицо, ПИН/ИНН, реквизиты), типы, связь с заявками/кредитами. Деталь — `loan-applicants/{id}`.

- [ ] **Step 2: Написать `requirements/tz/04-zaemshchik.md`** по 7-пунктному шаблону.

- [ ] **Step 3: Сверить с дампом.**

- [ ] **Step 4: Commit**

```bash
git add requirements/tz/04-zaemshchik.md
git commit -m "tz: write section 04 — borrower (as-is)"
```

---

### Task 6: Раздел 05 — Выдача кредита (`/loansCredit`, `/loan-credits/{id}`)

**Files:**
- Create: `requirements/tz/05-kredit.md`
- Reference: `requirements/features/05-loan-issuance.md`

**Interfaces:**
- Consumes: `scripts/inspect/tz/dump.mjs`.

- [ ] **Step 1: Инспекция списка кредитов + 11-вкладочной детали**

Run: `node scripts/inspect/tz/dump.mjs loansCredit`
Затем деталь рабочей записи (18/19/21 открываются; 20/22 — серверный краш, не документировать как поведение). Адаптировать дамп для `loan-credits/18`. Зафиксировать 11 вкладок, поля «Общая информация»/«Оформление»/«Условия кредита», расчёт графика на уровне кредита (аннуитет — числовой пример из фич-дока: запись 18, Сумма процентов 16 121,73).

- [ ] **Step 2: Написать `requirements/tz/05-kredit.md`** по 7-пунктному шаблону. Раздел 2 — список + 11 вкладок (вкладки Транши/Резерв/Платеж/Код оплаты/Детальный расчёт описать структурно, детали — в разделах 06–07 со ссылкой). Раздел 5 — формула аннуитета + числовой пример. Раздел 6 — «Статус кредита».

- [ ] **Step 3: Сверить с дампом.**

- [ ] **Step 4: Commit**

```bash
git add requirements/tz/05-kredit.md
git commit -m "tz: write section 05 — loan issuance (as-is)"
```

---

### Task 7: Раздел 06 — Транши / освоение (`/sub-loans`, `/disbursements`)

**Files:**
- Create: `requirements/tz/06-transhi-osvoenie.md`
- Reference: `requirements/features/06-disbursement-tranches.md`

**Interfaces:**
- Consumes: `scripts/inspect/tz/dump.mjs`.

- [ ] **Step 1: Инспекция траншей и освоения**

Run:
```bash
node scripts/inspect/tz/dump.mjs sub-loans
node scripts/inspect/tz/dump.mjs disbursements
```
Зафиксировать: модель Кредит→Транш→Освоение, 4-вкладочную деталь транша, график аннуитета на уровне освоения (числовой пример из фич-дока: 50 000 @10%/24мес → 2 307,25).

- [ ] **Step 2: Написать `requirements/tz/06-transhi-osvoenie.md`** по 7-пунктному шаблону. Раздел 5 — расчёт аннуитета на уровне освоения + числовой пример. Раздел 7 — связь Кредит→Транш→Освоение.

- [ ] **Step 3: Сверить с дампом.**

- [ ] **Step 4: Commit**

```bash
git add requirements/tz/06-transhi-osvoenie.md
git commit -m "tz: write section 06 — tranches/disbursement (as-is)"
```

---

### Task 8: Раздел 07 — Обслуживание (`/payments`, `/loan-reserves`, `/loan-ledgers`)

**Files:**
- Create: `requirements/tz/07-obsluzhivanie.md`
- Reference: `requirements/features/07-servicing.md`

**Interfaces:**
- Consumes: `scripts/inspect/tz/dump.mjs`.

- [ ] **Step 1: Инспекция платежей, резервов, реестра**

Run:
```bash
node scripts/inspect/tz/dump.mjs payments
node scripts/inspect/tz/dump.mjs loan-reserves
node scripts/inspect/tz/dump.mjs loan-ledgers
```
Зафиксировать: разбивку платежа (ОД + проценты), расчёт резерва (неосвоенное × ставка), append-only реестр LoanLedger с типами событий.

- [ ] **Step 2: Написать `requirements/tz/07-obsluzhivanie.md`** по 7-пунктному шаблону. Раздел 5 — формулы: разбивка платежа ОД+проценты, резерв = неосвоенная сумма × процент за резерв, с числовыми примерами.

- [ ] **Step 3: Сверить с дампом.**

- [ ] **Step 4: Commit**

```bash
git add requirements/tz/07-obsluzhivanie.md
git commit -m "tz: write section 07 — servicing (as-is)"
```

---

### Task 9: Наполнить головной `index.md` (синтез)

**Files:**
- Modify: `requirements/tz/index.md`
- Reference: `requirements/overview.md`, `guides/access-control.md`, все 7 разделов из Task 2–8

**Interfaces:**
- Consumes: разделы 01–07 (Task 2–8) как источник фактов о сущностях/связях.

- [ ] **Step 1: Заполнить «Назначение и границы»** — что такое подсистема кредитования, что входит/не входит (по Global Constraints).

- [ ] **Step 2: Заполнить «Архитектура и доступ»** — Jmix-on-Vaadin, роли (ссылка на `guides/access-control.md`: роли `Специалист кредитного отдела` и др.).

- [ ] **Step 3: Заполнить «Модель данных»** — диаграмма цепочки с кардинальностью, собранная из разделов 7 «Связи» каждого этапа:

```
Госрешение ──1:N──> Кредитная программа ──1:N──> Заявка ──N:1──> Заёмщик
   Заявка (одобрена) ──1:1──> Кредит ──1:N──> Транш ──1:N──> Освоение
   Кредит ──1:N──> Платёж · Резерв · Записи реестра (LoanLedger)
```

- [ ] **Step 4: Заполнить «Глоссарий»** — термины: Госрешение, Кредитная программа, Заявка, Комиссия, Заёмщик, Кредит, Транш, Освоение, Резерв, LoanLedger, Аннуитет, Льготный период.

- [ ] **Step 5: Сверить index** — все 7 ссылок ведут на существующие файлы; модель данных согласована с разделами 7 каждого этапа.

- [ ] **Step 6: Обновить `STATUS.md`** — changelog-строка «2026-06-23 — написано ТЗ as-is подсистемы кредитования (`requirements/tz/`)» + обновить дату «Last updated».

- [ ] **Step 7: Commit**

```bash
git add requirements/tz/index.md STATUS.md
git commit -m "tz: synthesize index (data model, glossary) + status update"
```

---

## Self-Review (заполнено автором плана)

**Spec coverage:** index → Task 1+9; 7 этапов → Task 2–8; шаблон 7 разделов → в каждой задаче-этапе; полная ре-инспекция → дамп-скрипт Task 1, гоняется в каждом этапе; чистый as-is → Global Constraints + Step «сверить»; README-ссылка → Task 1 Step 4. Все критерии готовности спеки покрыты.

**Placeholder scan:** каркас `index.md` содержит `_(наполняется в Task 9)_` намеренно — это явный placeholder-каркас, закрываемый Task 9; не оставлять в финале. Прочих TBD/TODO нет.

**Type consistency:** имя скрипта `scripts/inspect/tz/dump.mjs` и вызов `node scripts/inspect/tz/dump.mjs <route>` едины во всех задачах. Имена файлов разделов совпадают со ссылками в `index.md` Step 3.
