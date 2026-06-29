# «Заявка» as-is Mockup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single self-contained interactive HTML mockup that is a 1:1 as-is clone of the live Заявка flow — list, create wizard, detail page (all 9 tabs), and send-to-commission dialog.

**Architecture:** One HTML file, `mockups/loan-application/loan-application.html`, mirroring `mockups/loan-program/loan-program.html`. It reuses that file's design-system CSS verbatim and renders four JS-switched views (list ↔ create modal ↔ detail ↔ send dialog). No backend; all behaviour is client-side JS. Each screen/tab is captured from the live test stand with a Playwright inspection script, built to match, and verified against the captured screenshot.

**Tech Stack:** Static HTML/CSS/vanilla JS for the mockup; `playwright-core` + system Chrome (`channel: 'chrome'`) for live inspection, reusing the persistent auth profile at `.auth/profile`.

## Global Constraints

- **As-is purity:** reproduce the live UI *including its defects* — grey "disabled-look" field styling, eager required-field validation on the create form, phone-format validation only on «Далее», no «Просмотр» (read-only) mode. Do NOT fix anything. No `P3-R*` / improvement markers anywhere in the file.
- **Design system:** copy the `:root` tokens and component CSS verbatim from `mockups/loan-program/loan-program.html`. Do not restyle; only add screen-specific classes (stat cards, commission dialog).
- **Source of truth:** the live stand `https://fkftest.okmot.kg/` (`/loan-applications`), admin/admin. Every string, colour, layout, behaviour comes from the live app, not memory.
- **Language:** UI is Russian; preserve exact live wording.
- **Inspection:** scripts live in `scripts/inspect/app-*.mjs`; screenshots go to `.auth/` (git-ignored). Each is overridable via `OK_USER`/`OK_PASS`.
- **File convention:** new folder `mockups/loan-application/`, single file `loan-application.html`, with a top-of-file HTML comment block in the loan-program.html style (as-is mockup, not prod code; live URL + inspection date; four parts; "defects reproduced, no improvements").
- **No build/test/lint** in this repo. "Verification" for every task = run the inspection script, then visually compare the mockup view against the captured `.auth/*.png` screenshot.
- **Commits:** frequent, one per task. Commit message footer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 1: Reusable inspection script + capture the list screen

Build one parameterized capture script used by every later task, and capture the list screen as its first target.

**Files:**
- Create: `scripts/inspect/app-capture.mjs`
- Output: `.auth/app-list.png`, console DOM/CSS dump

**Interfaces:**
- Produces: `app-capture.mjs` — a script driven by env vars `ROUTE` (path after BASE, default `loan-applications`), `OPEN` (optional JS snippet string eval'd after load to open a dialog/row), `SHOT` (screenshot filename under `.auth/`, default `app-capture`). Dumps: visible toolbar buttons, grid column headers, stat-card texts, all form-field metadata (tag/label/required/readonly/coords/bg/border-radius/border), and section headers. Later tasks reuse it by setting these env vars.

- [ ] **Step 1: Write the capture script**

```js
// scripts/inspect/app-capture.mjs
import { chromium } from 'playwright-core';

const BASE  = 'https://fkftest.okmot.kg/';
const USER  = process.env.OK_USER || 'admin';
const PASS  = process.env.OK_PASS || 'admin';
const ROUTE = process.env.ROUTE  || 'loan-applications';
const OPEN  = process.env.OPEN   || '';            // JS eval'd in page after load
const SHOT  = process.env.SHOT   || 'app-capture';

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1700, height: 1100 },
});
const page = ctx.pages()[0] || await ctx.newPage();
const log = (...a) => console.log(...a);

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', USER);
  await page.fill('input[name=password]', PASS);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}),
    page.keyboard.press('Enter'),
  ]);
  await page.waitForTimeout(2500);
}
await page.goto(BASE + ROUTE, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);
if (OPEN) { await page.evaluate(OPEN); await page.waitForTimeout(2000); }

log('URL:', page.url());

log('TOOLBAR:', JSON.stringify(await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-button')]
    .filter(b => b.getBoundingClientRect().width > 0)
    .map(b => b.innerText.trim()).filter(Boolean))));

log('TABS:', JSON.stringify(await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-tab')]
    .filter(t => t.getBoundingClientRect().width > 0)
    .map(t => t.innerText.trim()))));

log('COLUMNS:', JSON.stringify(await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-grid-column, vaadin-grid-sort-column')]
    .map(c => (c.getAttribute('header') || c.path || c.innerText || '').trim())
    .filter(Boolean))));

log('GRID_HEADER_CELLS:', JSON.stringify(await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-grid-cell-content')]
    .map(c => c.innerText.trim()).filter(Boolean).slice(0, 60))));

log('STATCARDS:', JSON.stringify(await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('*').forEach(e => {
    if (e.childElementCount > 3) return;
    const t = (e.innerText || '').replace(/\s+/g, ' ').trim();
    if (/Всего заявок|На рассмотрении|Одобрено|Отклонено|Требуется доп/i.test(t) && t.length < 60) {
      const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
      out.push({ t, x: Math.round(r.left), y: Math.round(r.top),
        bg: cs.backgroundColor, border: cs.border, color: cs.color });
    }
  });
  return out;
})));

log('FIELDS:', JSON.stringify(await page.evaluate(() => {
  const TAGS = ['vaadin-text-field','vaadin-text-area','vaadin-big-decimal-field','vaadin-number-field','vaadin-integer-field','jmix-value-picker','jmix-multi-value-picker','vaadin-combo-box','vaadin-select','vaadin-checkbox','vaadin-date-picker','vaadin-multi-select-combo-box'];
  const labelOf = (el) => {
    let l = el.label || el.getAttribute('label');
    if (!l) { const p = el.closest('vaadin-form-item'); const lab = p?.querySelector('[slot=label]'); if (lab) l = lab.innerText; }
    if (!l && el.shadowRoot) { const sr = el.shadowRoot.querySelector('[part=label]'); if (sr) l = sr.innerText; }
    return (l || '').replace(/\s+/g, ' ').trim() || null;
  };
  return [...document.querySelectorAll(TAGS.join(','))]
    .filter(e => e.getBoundingClientRect().width > 0)
    .map(el => {
      const r = el.getBoundingClientRect();
      const f = el.shadowRoot?.querySelector('[part="input-field"]');
      const cs = f ? getComputedStyle(f) : null;
      return { tag: el.tagName.toLowerCase(), label: labelOf(el),
        required: el.required === true || el.hasAttribute('required'),
        readonly: el.readonly === true || el.hasAttribute('readonly'),
        value: el.value ?? null,
        x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width),
        bg: cs?.backgroundColor || null, radius: cs?.borderRadius || null, border: cs?.border || null };
    });
})));

await page.screenshot({ path: `.auth/${SHOT}.png`, fullPage: true });
log('SHOT saved:', `.auth/${SHOT}.png`);
await ctx.close();
```

- [ ] **Step 2: Run it against the list screen**

Run: `SHOT=app-list node scripts/inspect/app-capture.mjs`
Expected: prints `TOOLBAR:` (Обновить, Создать, Изменить, Удалить, Отправить в комиссию, Отправить в залоговую комиссию …), `COLUMNS:` (8 columns), `STATCARDS:` (5 cards with bg colours), `GRID_HEADER_CELLS:` with sample rows, and saves `.auth/app-list.png`. No errors/timeouts.

- [ ] **Step 3: Sanity-check the dump**

Open `.auth/app-list.png` and confirm it shows the Заявки list with the 5 stat cards and the grid. Confirm the console `STATCARDS` colours and `COLUMNS` order match the screenshot.

- [ ] **Step 4: Commit**

```bash
git add scripts/inspect/app-capture.mjs
git commit -m "chore(inspect): reusable app-capture script; capture Заявки list

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Mockup scaffold — file, design-system CSS, app shell, view router

Create the mockup file with the shared design system, the sidebar + header shell, and a JS router that can switch between the four views (list/create/detail/send). Render an empty list view placeholder to prove the shell works.

**Files:**
- Create: `mockups/loan-application/loan-application.html`
- Reference: `mockups/loan-program/loan-program.html` (copy CSS + shell markup from here)

**Interfaces:**
- Produces: global JS `showView(name)` where `name ∈ {'list','detail'}`; modal helpers `openModal(id)` / `closeModal(id)`; the `<aside class="sidebar">`, `<header>`, and a `<main id="view-root">` container that later tasks fill. CSS classes from loan-program (`.app`, `.sidebar`, `.brand`, `.nav*`, `.toolbar`, grid/modal/input classes) are available.

- [ ] **Step 1: Create the file with the design system + shell**

Copy, verbatim, from `mockups/loan-program/loan-program.html`: the entire `<style>` block (the `:root` token set and all component CSS), and the `<aside class="sidebar">…</aside>` + `<header>` shell markup. Then adapt:
- `<title>` → `Заявки · АСУБК`.
- Header title text → `Заявки`.
- Add the top-of-file HTML comment block (as-is mockup; live URL `https://fkftest.okmot.kg/loan-applications`; inspected 2026-06-29; four parts: список / мастер / деталь 9 вкладок / отправка; "воспроизводит дефекты, без улучшений").
- Sidebar nav: keep the loan-program nav groups but ensure the «Приложение» group is expanded and the active route highlight is removed from loan-programs (this screen lives under «Система кредитования», but match what the live screenshot shows — no item is visually active on `/loan-applications`; leave none highlighted).
- Add a `<main id="view-root"></main>` and two empty containers `<section id="view-list">` and `<section id="view-detail" hidden>`.

Add the router script at the end of `<body>`:

```html
<script>
function showView(name){
  document.getElementById('view-list').hidden   = (name !== 'list');
  document.getElementById('view-detail').hidden = (name !== 'detail');
  window.scrollTo(0,0);
}
function openModal(id){ document.getElementById(id).classList.add('open'); }
function closeModal(id){ document.getElementById(id).classList.remove('open'); }
document.addEventListener('DOMContentLoaded', () => showView('list'));
</script>
```

- [ ] **Step 2: Open in a browser and screenshot**

Open `mockups/loan-application/loan-application.html` in Chrome. Take a screenshot of the page.
Expected: the АСУБК sidebar + «Заявки» header render with the exact loan-program look (same fonts, colours, spacing); no console errors; body is otherwise empty (containers present but empty).

- [ ] **Step 3: Compare shell to live**

Side-by-side with `.auth/app-list.png`: the sidebar, brand, nav typography, and header must match. Fix any divergence (it should be exact since CSS is copied).

- [ ] **Step 4: Commit**

```bash
git add mockups/loan-application/loan-application.html
git commit -m "feat(mockup): loan-application scaffold — design system, shell, router

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: List view — filter panel, toolbar, stat cards, grid + data

Fill `#view-list` with the full list screen and its behaviours.

**Files:**
- Modify: `mockups/loan-application/loan-application.html` (`#view-list` section + JS)
- Reference: `.auth/app-list.png` + Task 1 console dump

**Interfaces:**
- Consumes: `showView`, shell CSS from Task 2.
- Produces: a JS array `APPLICATIONS` (the sample dataset — each row `{num, inn, name, status, collateralStatus, program, amount, term, info}`); functions `renderGrid()`, `selectRow(num)`, `sortBy(col)`, `applyFilter()`, `gotoDetail(num)`. `gotoDetail` is consumed by Task 5.

- [ ] **Step 1: Build the filter panel + toolbar + stat cards**

Using the Task 1 dump, add inside `#view-list`:
- Filter panel «Фильтр : Фильтры *» with: Номер документа (text), Статус заявки (`<select>` with options: «» / Новый / На рассмотрении / Одобрено / Отклонено / Требуется доп. информация), Кредитная программа (••• picker button + X), Дата создания («в интервале» chip + ••• + X). Use loan-program input classes; render fields with the **grey readonly-look** as live (as-is defect).
- Toolbar: Обновить (green + ▾) · gear · «Добавить условие поиска» (muted) ‖ Создать (blue, +) · Изменить · Удалить · Отправить в комиссию · Отправить в залоговую комиссию · gear · pager «22 строки» with « ‹ › ».
- Stat cards row — 5 cards with the exact captured backgrounds: Всего заявок 22 (blue), На рассмотрении 5 (amber), Одобрено 9 (green), Отклонено 5 (red), Требуется доп. информация 1 (purple). Add a `.statcard` CSS class set with `--bg`/`--border` per card matching the `STATCARDS` dump colours.

- [ ] **Step 2: Add the dataset + render the grid**

Add `const APPLICATIONS = [ … ]` — ~22 rows reproducing the live rows from `.auth/app-list.png` / `GRID_HEADER_CELLS` (Заявка-103 … with their statuses, programs, amounts, terms), covering every status value including «Новый». Add `renderGrid()` that builds an 8-column sortable table (Номер документа, Заемщик, Статус заявки, Статус залога, Кредитная программа, Запрашиваемая сумма, Запрашиваемый срок, Дополнительная информация) using loan-program grid CSS. Render status values as plain text (live shows plain text, not pills — confirm against screenshot; if live uses coloured text, match it).

- [ ] **Step 3: Wire behaviours**

- `selectRow(num)`: highlight the row (blue selection bg as live) and enable Изменить/Удалить/Отправить… toolbar buttons (disabled when no selection). Reproduce as-is: enable for any row regardless of status.
- `sortBy(col)`: toggle asc/desc on header click, re-render.
- `applyFilter()`: filter `APPLICATIONS` by Номер документа substring + Статус заявки equals; «Обновить» re-renders.
- double-click a row → `gotoDetail(num)`.
- Pager is visual (no real paging needed for 22 rows) but must render «22 строки».

- [ ] **Step 4: Screenshot + compare to live**

Open the file, screenshot the list view. Compare to `.auth/app-list.png`: filter panel, toolbar buttons (text + order + colours), 5 stat cards (numbers + colours), grid columns + sample rows, pager. Click a row → toolbar enables; click a header → sorts. Fix discrepancies and re-compare.

- [ ] **Step 5: Commit**

```bash
git add mockups/loan-application/loan-application.html
git commit -m "feat(mockup): Заявки list — filter, toolbar, stat cards, grid

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Create wizard — «Новая заявка» modal

Capture and build the create dialog with its as-is validation.

**Files:**
- Modify: `mockups/loan-application/loan-application.html`
- Output: `.auth/app-create.png` (capture)

**Interfaces:**
- Consumes: `openModal`/`closeModal`, list `Создать` button.
- Produces: modal `#modal-create`; functions `validateCreate()` (returns bool, shows eager errors), `submitCreate()` (adds a row to `APPLICATIONS`, calls `renderGrid()`, closes modal, calls `gotoDetail(newNum)`).

- [ ] **Step 1: Capture the create dialog**

Run:
`ROUTE=loan-applications SHOT=app-create OPEN="(()=>{const b=[...document.querySelectorAll('vaadin-button')].find(b=>/Создать/i.test(b.innerText)); b&&b.click();})()" node scripts/inspect/app-capture.mjs`
Expected: `FIELDS:` lists Субъект (jmix-value-picker), Кредитная программа (picker), Адрес (text, readonly), Номер телефона (text), Источник финансирования (picker), Дополнительная информация (text-area), Запрашиваемая сумма (big-decimal, required), Запрашиваемый срок (number/integer, required), Метод погашения (select), 3 checkboxes; saves `.auth/app-create.png`.

- [ ] **Step 2: Build the modal markup**

Add `#modal-create` (title «Новая заявка», × close) with the fields from the dump, in the live layout: two-column top block (Субъект, Кредитная программа full-width pickers; then Адрес | Номер телефона; Источник финансирования | Дополнительная информация), then section headers «Сумма кредита» / «Срок кредита» with Запрашиваемая сумма* and Запрашиваемый срок* side by side, then «Метод погашения кредита» select (default Аннуитетный), then collapsible «Ручные параметры льготного периода» with 3 checkboxes (по основной сумме / по начислению процентов / по процентам, default off). Footer: Далее (blue) · Отмена. Адрес is readonly. Номер телефона value prefilled `+996`. Pickers render as a field + ••• button + X (button opens a stub select-list modal — reuse loan-program picker modal pattern).

- [ ] **Step 3: Wire as-is validation**

- On modal open, immediately render Запрашиваемая сумма / Запрашиваемый срок with red background + «Поле является обязательным» (eager — as-is defect P3-06).
- `validateCreate()`: on «Далее», also validate Номер телефона against `+996 ` format and show «Введите номер в формате +996 990 000 000» if malformed; block submit while required empty.
- `submitCreate()`: when valid, push a new `{num:'Заявка - N', status:'Новый', …}` to `APPLICATIONS`, re-render grid, close modal, open its detail page.
- Создать button on the list opens the modal; Отмена / × close it.

- [ ] **Step 4: Screenshot + compare**

Open file, click Создать, screenshot the modal. Compare to `.auth/app-create.png`: every field label/control/order, the eager red errors, the +996 prefill, the collapsible section, footer buttons. Click Далее with empty fields → errors show, modal stays. Fix and re-compare.

- [ ] **Step 5: Commit**

```bash
git add mockups/loan-application/loan-application.html scripts/inspect/app-capture.mjs
git commit -m "feat(mockup): Новая заявка create wizard with as-is validation

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Detail shell — header band, status stepper, tab bar

Capture and build the detail page chrome (everything except tab contents).

**Files:**
- Modify: `mockups/loan-application/loan-application.html` (`#view-detail`)
- Output: `.auth/app-detail.png`

**Interfaces:**
- Consumes: `showView('detail')`, `gotoDetail(num)` from Task 3.
- Produces: `#view-detail` with header band, `.stepper` block, and `.tabbar` (9 tabs); function `showTab(idx)` that switches `#tab-0`…`#tab-8` panels (Task 6–10 fill them); `gotoDetail(num)` populates the header from the `APPLICATIONS` row and calls `showView('detail')`.

- [ ] **Step 1: Capture the detail page**

Run: `ROUTE=loan-applications/41 SHOT=app-detail node scripts/inspect/app-capture.mjs`
Expected: `TABS:` lists the 9 tab names (Общая информация, График, Документы заявителя, Кредитные документы, Залоговые документы, Проектные документы, Кредитная комиссия, Залоговая комиссия, История); `FIELDS:` lists the header fields (Субъект, Номер документа, Статус заявки, Статус залоговой комиссии, Запрашиваемая сумма); saves `.auth/app-detail.png` showing the stepper. (Note: id `41` = Заявка-103 on test; if it 404s, open the list and grab a current id.)

- [ ] **Step 2: Build header band + stepper**

In `#view-detail` add the header band: Субъект, Номер документа, Статус заявки, Статус залоговой комиссии, Запрашиваемая сумма — grey readonly-look fields in the live two-row layout. Add a `.stepper` with 4 steps: Подана → На рассмотрении → Одобрена → Регистрация кредита. Completed steps show a filled circle with a green check + a date line (e.g. 24.06.2026); the current step is highlighted; future steps are grey empty circles. Add `.stepper` CSS (circles, connector line, check icon as inline SVG, date caption) matching `.auth/app-detail.png`.

- [ ] **Step 3: Build the tab bar + panel containers**

Add `.tabbar` with the 9 tabs, horizontally scrollable with a right chevron (as live). Active tab underlined blue. Add 9 empty panels `#tab-0`…`#tab-8` (only `#tab-0` visible). `showTab(idx)` toggles active tab + panel. `gotoDetail(num)` fills the header from the selected row, resets to tab 0, calls `showView('detail')`.

- [ ] **Step 4: Screenshot + compare**

Open file → double-click a list row → detail opens. Screenshot. Compare header + stepper + tab bar to `.auth/app-detail.png`. Click through tabs → switching works (panels empty for now). Fix and re-compare.

- [ ] **Step 5: Commit**

```bash
git add mockups/loan-application/loan-application.html
git commit -m "feat(mockup): application detail shell — header, status stepper, tabs

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Tab 1 — Общая информация

**Files:**
- Modify: `mockups/loan-application/loan-application.html` (`#tab-0`)
- Output: `.auth/app-tab-obshaya.png`

**Interfaces:**
- Consumes: detail shell (Task 5).
- Produces: filled `#tab-0`.

- [ ] **Step 1: Capture**

Run: `ROUTE=loan-applications/41 SHOT=app-tab-obshaya node scripts/inspect/app-capture.mjs`
Expected: `FIELDS:` / `SECTIONS:` cover the three column groups; saves screenshot.

- [ ] **Step 2: Build**

Fill `#tab-0` with the three-column layout: *Данные заявителя* (ИНН, Номер телефона, Адрес) · *Условия кредита заемщика* (Запрашиваемая сумма, Запрашиваемый срок, Метод погашения, льготные периоды) · *Условия кредита, одобренные кредитной комиссией* (Сумма + range hint «Допустимо: от … до …», Срок, ставка). Grey readonly-look fields; section headers bold as captured. Use a real `APPLICATIONS` row for values.

- [ ] **Step 3: Screenshot + compare** to `.auth/app-tab-obshaya.png`; fix discrepancies.

- [ ] **Step 4: Commit**

```bash
git add mockups/loan-application/loan-application.html
git commit -m "feat(mockup): detail tab — Общая информация

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Tab 2 — График

**Files:**
- Modify: `mockups/loan-application/loan-application.html` (`#tab-1`)
- Output: `.auth/app-tab-grafik.png`

**Interfaces:** Consumes detail shell; produces filled `#tab-1`.

- [ ] **Step 1: Capture**

Run: `ROUTE=loan-applications/41 SHOT=app-tab-grafik node scripts/inspect/app-capture.mjs`, then in the saved screenshot open the «График» tab manually if the dump didn't switch tabs — extend `OPEN` to click the tab:
`OPEN="(()=>{const t=[...document.querySelectorAll('vaadin-tab')].find(t=>/График/.test(t.innerText)); t&&t.click();})()"` (re-run with `ROUTE=loan-applications/41 SHOT=app-tab-grafik`).
Expected: `COLUMNS:` of the schedule grid (e.g. № платежа, Дата, Основной долг, Проценты, Итого… — record the exact captured headers); screenshot of the График tab.

- [ ] **Step 2: Build** `#tab-1` as the repayment-schedule grid with the captured columns and any toolbar; show a few sample rows (or the live empty state if the schedule is empty for this record — match what the screenshot shows).

- [ ] **Step 3: Screenshot + compare** to `.auth/app-tab-grafik.png`; fix.

- [ ] **Step 4: Commit**

```bash
git add mockups/loan-application/loan-application.html
git commit -m "feat(mockup): detail tab — График

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Tabs 3–6 — document tabs (Документы заявителя / Кредитные / Залоговые / Проектные)

These four share a structure (a documents grid/section). Capture each, then build all four; they differ mainly in title and possibly columns.

**Files:**
- Modify: `mockups/loan-application/loan-application.html` (`#tab-2`…`#tab-5`)
- Output: `.auth/app-tab-doc-zayavitel.png`, `…-kreditnye.png`, `…-zalogovye.png`, `…-proektnye.png`

**Interfaces:** Consumes detail shell; produces filled `#tab-2`…`#tab-5`.

- [ ] **Step 1: Capture each of the four tabs**

For each tab name, run `app-capture.mjs` with `ROUTE=loan-applications/41`, the `OPEN` snippet clicking that tab (as in Task 7), and a distinct `SHOT`:
- `SHOT=app-tab-doc-zayavitel` + click «Документы заявителя»
- `SHOT=app-tab-doc-kreditnye` + click «Кредитные документы»
- `SHOT=app-tab-doc-zalogovye` + click «Залоговые документы»
- `SHOT=app-tab-doc-proektnye` + click «Проектные документы»
Record each tab's `COLUMNS:` and any toolbar buttons (Добавить/Загрузить/Удалить etc.) from the dump.

- [ ] **Step 2: Build the four panels**

Fill `#tab-2`…`#tab-5` each with the captured documents grid (columns + toolbar) and the live empty/populated state from its screenshot. If all four share identical structure, build a small helper `renderDocsTab(elId, columns, rows)` and call it 4× (DRY); if a tab differs, build it explicitly.

- [ ] **Step 3: Screenshot + compare** each panel to its `.auth/*.png`; fix discrepancies.

- [ ] **Step 4: Commit**

```bash
git add mockups/loan-application/loan-application.html
git commit -m "feat(mockup): detail tabs — document tabs (4)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Tabs 7–8 — Кредитная комиссия / Залоговая комиссия

**Files:**
- Modify: `mockups/loan-application/loan-application.html` (`#tab-6`, `#tab-7`)
- Output: `.auth/app-tab-kred-komissiya.png`, `.auth/app-tab-zalog-komissiya.png`

**Interfaces:** Consumes detail shell; produces filled `#tab-6`, `#tab-7`.

- [ ] **Step 1: Capture both tabs**

Run `app-capture.mjs` twice (`ROUTE=loan-applications/41`), `OPEN` clicking «Кредитная комиссия» (`SHOT=app-tab-kred-komissiya`) then «Залоговая комиссия» (`SHOT=app-tab-zalog-komissiya`). Record the block contents: any voting-progress display, members table columns (Роль/Сотрудник/Решение/Крайний срок/…), protocol fields, and buttons — exactly as captured.

- [ ] **Step 2: Build** `#tab-6` and `#tab-7` to match the captured commission blocks (the in-application view of each commission). Match the live empty state if no commission is linked yet.

- [ ] **Step 3: Screenshot + compare** each to its `.auth/*.png`; fix.

- [ ] **Step 4: Commit**

```bash
git add mockups/loan-application/loan-application.html
git commit -m "feat(mockup): detail tabs — Кредитная / Залоговая комиссия

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Tab 9 — История

**Files:**
- Modify: `mockups/loan-application/loan-application.html` (`#tab-8`)
- Output: `.auth/app-tab-istoriya.png`

**Interfaces:** Consumes detail shell; produces filled `#tab-8`.

- [ ] **Step 1: Capture** — `app-capture.mjs` with `ROUTE=loan-applications/41`, `OPEN` clicking «История», `SHOT=app-tab-istoriya`. Record the history list/grid columns (e.g. Дата, Пользователь, Действие/Изменение).

- [ ] **Step 2: Build** `#tab-8` as the captured history grid with a few sample entries (or live empty state).

- [ ] **Step 3: Screenshot + compare** to `.auth/app-tab-istoriya.png`; fix.

- [ ] **Step 4: Commit**

```bash
git add mockups/loan-application/loan-application.html
git commit -m "feat(mockup): detail tab — История

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Send-to-commission dialogs + post-send feedback

Capture and build the «Выберите комиссию» modal for both the credit and collateral actions, plus the post-OK feedback.

**Files:**
- Modify: `mockups/loan-application/loan-application.html`
- Output: `.auth/app-send-commission.png`

**Interfaces:**
- Consumes: list toolbar buttons «Отправить в комиссию» / «Отправить в залоговую комиссию», `selectRow`.
- Produces: modal `#modal-send` with a `Комиссия *` dropdown; function `submitSend(track)` (`track ∈ {'credit','collateral'}`) that on OK updates the selected row's status and shows a toast.

- [ ] **Step 1: Capture the send modal + the post-OK result**

Run with the modal opened on a selected «Новый» row:
`ROUTE=loan-applications SHOT=app-send-commission OPEN="(()=>{const rows=document.querySelectorAll('vaadin-grid'); const g=rows[0]; g&&g.activeItem; const sel=[...document.querySelectorAll('vaadin-grid-cell-content')].find(c=>/Заявка - 99/.test(c.innerText)); sel&&sel.click(); setTimeout(()=>{const b=[...document.querySelectorAll('vaadin-button')].find(b=>/^Отправить в комиссию/.test(b.innerText)); b&&b.click();},800);})()" node scripts/inspect/app-capture.mjs`
Expected: screenshot shows the «Выберите комиссию» modal with the required «Комиссия *» dropdown; `FIELDS:` includes the combo-box. (Dropdown options observed live: «Комиссия по залогу test1», «Комиссия по заявкам».) Then, separately, observe via the live app what appears after pressing ОК (status change and/or toast) and record it — this is needed for Step 3.

- [ ] **Step 2: Build the modal**

Add `#modal-send` (title «Выберите комиссию», ×): one required `<select>` «Комиссия *» (options «Комиссия по залогу test1», «Комиссия по заявкам»; eager red bg + «Поле является обязательным» until chosen). Footer: ОК (blue) · Отмена. Both list buttons open it (passing the track); the залоговая button targets `Статус залоговой комиссии`.

- [ ] **Step 3: Wire behaviour + toast**

- Buttons enabled only with a row selected (as-is: any status).
- `submitSend(track)`: require a commission; on OK, set the selected row's `status` (credit track) or `collateralStatus` (collateral track) to «На рассмотрении», re-render grid, close modal, and show the captured post-OK feedback (toast — reproduce the live text/style recorded in Step 1; add a `.toast` class if live shows one).

- [ ] **Step 4: Screenshot + compare**

Open file → select a row → Отправить в комиссию → screenshot modal, compare to `.auth/app-send-commission.png`. Click ОК with no commission → error; pick one → OK → status updates + toast. Repeat for залоговая. Fix and re-compare.

- [ ] **Step 5: Commit**

```bash
git add mockups/loan-application/loan-application.html scripts/inspect/app-capture.mjs
git commit -m "feat(mockup): Выберите комиссию dialogs + send feedback

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Companion doc updates + final pass

**Files:**
- Modify: `requirements/features/03-application-commission.md`
- Modify: `STATUS.md`
- Modify: `README.md` (mockups map, if it lists mockups)

**Interfaces:** none (docs only).

- [ ] **Step 1: Update the feature doc**

Append a dated «Live re-inspection 2026-06-29» note to `requirements/features/03-application-commission.md`: stat cards (5, with counts), new «Новый» status, stepper check-icon + date, approved-terms range hint «Допустимо: от … до …». Cite `scripts/inspect/app-capture.mjs`.

- [ ] **Step 2: Update STATUS.md**

Add a changelog entry (newest first) describing the new `mockups/loan-application/loan-application.html` as-is clone (list + create wizard + detail 9 tabs + send dialog) and the live findings; bump the "Last updated" date line to 2026-06-29.

- [ ] **Step 3: Update README mockups map** (if present) to list `loan-application/loan-application.html`.

- [ ] **Step 4: Full-flow smoke check**

Open the mockup; walk the whole flow: list → Создать → fill → Далее → detail opens → click through all 9 tabs → back to list → select row → Отправить в комиссию → ОК → status updates. Confirm no dead controls and no console errors.

- [ ] **Step 5: Commit**

```bash
git add requirements/features/03-application-commission.md STATUS.md README.md
git commit -m "docs: log 2026-06-29 Заявка re-inspection + loan-application mockup

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-review notes

- **Spec coverage:** list (Task 3) · create wizard (Task 4) · detail shell + 9 tabs (Tasks 5–10) · send dialog (Task 11) · companion docs (Task 12) · design-system reuse + as-is purity (Global Constraints, every build task) · inspection method (Task 1 + every capture step). All spec §3 parts covered.
- **As-is defects** (grey fields, eager validation, phone-on-Далее, no Просмотр) are called out explicitly in Tasks 3/4/6 and the Global Constraints.
- **Capture-before-build** is enforced: every build task has a capture step producing a `.auth/*.png` and a console dump that the build must match. Tab contents for tabs 2–9 are captured at execution time (live data), not pre-written — this is the method, not a placeholder.
- **Type/name consistency:** `showView`, `openModal/closeModal`, `APPLICATIONS`, `renderGrid`, `selectRow`, `gotoDetail`, `showTab`, `validateCreate/submitCreate`, `submitSend(track)` are defined once and reused consistently across tasks.
