# Design — «Заявка» as-is mockup (создание → отправка в комиссию)

> Date: 2026-06-29 · Author: QA workspace · Status: approved (design), ready for plan
> Scope: a single self-contained interactive HTML mockup that is a **1:1 as-is
> clone** of the live application (Заявка) flow on the test stand, from creating
> an application through sending it to a commission for review.

## 1. Purpose & boundaries

Produce an exact visual + behavioural copy of the live **Заявка** subsystem so
the dev team has a faithful reference of the current state ("текущая версия")
before any redesign. This is the **as-is** mockup — it reproduces the live UI
*including its defects* (grey "disabled-look" field styling, eager required-field
validation, no «Просмотр» mode). No Phase-3 improvements (P3-R*) are baked in;
those belong to a later "to-be" mockup.

Source of truth: the running test stand **https://fkftest.okmot.kg/**
(`/loan-applications`), inspected live on 2026-06-29 (admin/admin). Every screen,
text string, colour, layout, and click-behaviour is taken from the live app, not
from memory or older docs.

**In scope** (the four parts confirmed with the owner):

1. **Список заявок** — `/loan-applications` list screen.
2. **Мастер «Новая заявка»** — the create dialog.
3. **Детальная страница** — `/loan-applications/{id}`, all **9 tabs**, full 1:1.
4. **Отправка в комиссию** — the «Отправить в комиссию» / «Отправить в залоговую
   комиссию» action and everything it shows.

**Out of scope:** the separate **Комиссии по заявкам** screen
(`/loan-application-commissions`) — the voting/commission-review module itself.
The mockup ends at the act of *sending* to a commission. (The commission screen
is a candidate for its own later mockup.)

## 2. Approach

A single self-contained, interactive HTML file, mirroring the established
convention of `mockups/loan-program/loan-program.html`:

- **File:** `mockups/loan-application/loan-application.html` (new folder under
  `mockups/`, sibling of `loan-program/`, `decision/`, `dictionaries/`).
- **Design system:** reuse the **exact** `:root` design-tokens and component CSS
  from `loan-program.html` (sidebar, header, toolbar, data grid, modal dialog,
  inputs, status pills, status stepper, scrollbars). This guarantees pixel
  fidelity and consistency across the workspace's mockups. Copy the CSS verbatim;
  extend only with classes specific to this screen (stat cards, the commission
  picker dialog).
- **Interactivity:** client-side JS only, no backend. Every control works as it
  does live — row selection gating, column sort, pagination, filter panel, the
  create wizard with its (as-is) validation, picker modals, tab switching with a
  horizontally-scrollable tab bar, the status stepper, and the send-to-commission
  dialog.
- **Purity:** as-is. Where the live app has a defect, the mockup reproduces it
  (do **not** silently fix). No `*-R*` improvement markers.

### Rejected alternatives

- **Multiple HTML files (one per screen)** — breaks the single-file convention
  the team already uses; harder to open/hand off. Rejected.
- **Static screenshots / non-interactive** — the owner explicitly requires that
  every component function and that "what appears on click" be reproduced.
  Rejected.

## 3. Live findings (captured 2026-06-29)

What changed since the 2026-06-18/19 documentation in
`requirements/features/03-application-commission.md` (these MUST be in the mockup):

- **Stat cards** above the grid — 5 coloured summary tiles:
  Всего заявок **22** (blue) · На рассмотрении **5** (amber/yellow) ·
  Одобрено **9** (green) · Отклонено **5** (red) · Требуется доп. информация
  **1** (purple).
- A new **«Новый»** application status (e.g. Заявка-99, Заявка-97), in addition
  to the previously documented На рассмотрении / Одобрено / Отклонено /
  Требуется доп. информация.
- Detail page **status stepper** shows a green **check icon** + a **date** under
  completed steps (Подана 24.06.2026 ✓ → На рассмотрении 24.06.2026 ✓ →
  Одобрена → Регистрация кредита).
- «Условия кредита, одобренные комиссией» on the detail page shows a **range
  hint** «Допустимо: от 100000.00 до …» (the program's amount bounds).

### 3.1 Список — `/loan-applications`

- **Sidebar:** АСУБК brand; nav groups Приложение (expanded: Users,
  Подразделения, Сотрудники подразделения, Освоение, Резерв, Платеж, Список
  Траншей, LoanLedger), Система кредитования, Поручительства, Корпоративное
  управление, СУГС, Взыскание задолженности, Справочники, Сервисы,
  Администрирование, Отчёты, Безопасность, Инструменты данных; footer `[admin]` +
  logout icon.
- **Header:** hamburger + «Заявки».
- **Filter panel** («Фильтр : Фильтры *»): Номер документа (text) · Статус
  заявки (select) · Кредитная программа (••• picker + X) · Дата создания
  («в интервале» chip + ••• + X).
- **Toolbar:** Обновить (green, with ▾ split) · gear · «Добавить условие поиска»
  ‖ Создать (blue, +) · Изменить · Удалить · Отправить в комиссию · Отправить в
  залоговую комиссию · gear · pager («22 строки», « ‹ › »).
- **Stat cards:** as listed in §3 (5 cards, wrap to a second row on narrow width).
- **Grid — 8 sortable columns:** Номер документа («Заявка - N») · Заемщик
  (ИНН - name) · Статус заявки · Статус залога · Кредитная программа ·
  Запрашиваемая сумма · Запрашиваемый срок · Дополнительная информация.
  ~22 sample rows covering every status value. No «Одобренная сумма» column
  (matches live). No «Просмотр» action (matches live).
- **Behaviours:** toolbar actions are selection-gated (disabled with no row,
  enabled on any selected row regardless of status — reproduce as-is); header
  sort; pagination; filter; double-click a row → opens the detail page in edit
  mode (no readonly view — as-is).

### 3.2 Мастер «Новая заявка»

Modal dialog (title «Новая заявка», × close). A single form (footer **Далее** /
**Отмена** — "Далее" validates and submits; it is not a true multi-page wizard).

Fields:

| Field | Control | Notes (as-is) |
|---|---|---|
| Субъект | lookup (•••, X) | required* in UI (red bg appears) |
| Кредитная программа | lookup (•••, X) | |
| Адрес | text | readonly, auto-filled from Субъект |
| Номер телефона | text | prefilled `+996`; format check «Введите номер в формате +996 990 000 000» fires on Далее |
| Источник финансирования | lookup (•••, X) | |
| Дополнительная информация | textarea | |
| Запрашиваемая сумма | big-decimal | required `*`; **eager** red bg + «Поле является обязательным» on open (as-is defect) |
| Запрашиваемый срок | number | required `*`; eager red as above |
| Метод погашения кредита | select | default «Аннуитетный»; also «Дифференцированный» |
| Ручные параметры льготного периода | collapsible | 3 checkboxes (по основной сумме / по начислению процентов / по процентам), default off |

Section headers inside the form: «Сумма кредита», «Срок кредита».

Behaviours: eager required display; phone-format validation on Далее; «Далее»
blocked while required empty; picker modals open for the ••• lookups (select-only
list dialog, как в loan-program). On a valid submit the live app creates the
record and opens the detail page — the mockup mirrors this (new row appears,
detail opens).

### 3.3 Детальная страница — `/loan-applications/{id}` (9 tabs, full 1:1)

- **Header band:** Субъект · Номер документа · Статус заявки · Статус залоговой
  комиссии · Запрашиваемая сумма (all rendered as the live grey readonly-look
  fields).
- **Status stepper «Статус заявки»:** Подана → На рассмотрении → Одобрена →
  Регистрация кредита; completed steps show a green check + date; current step
  highlighted; future steps grey.
- **Tab bar (9, horizontally scrollable with a chevron):**
  1. **Общая информация** — three columns: *Данные заявителя* (ИНН, Номер
     телефона, Адрес) · *Условия кредита заемщика* (Запрашиваемая сумма,
     Запрашиваемый срок, метод, льготные периоды) · *Условия кредита, одобренные
     кредитной комиссией* (Сумма + range hint «Допустимо: от … до …», Срок,
     ставка).
  2. **График** — repayment schedule grid.
  3. **Документы заявителя** — documents grid/section.
  4. **Кредитные документы** — documents grid/section.
  5. **Залоговые документы** — documents grid/section.
  6. **Проектные документы** — documents grid/section.
  7. **Кредитная комиссия** — commission-review block for the credit commission.
  8. **Залоговая комиссия** — commission-review block for the collateral commission.
  9. **История** — audit/history list.

  Each of the 9 tabs is cloned 1:1 — its exact content, fields, grids, columns,
  buttons, empty states, and any per-tab toolbar — captured from the live app via
  inspection scripts (see §5). Tabs 2–9 content is to be captured during
  implementation (not yet fully inspected at design time); tab 1 (Общая
  информация) and the header/stepper are already captured.

### 3.4 Отправка в комиссию

From the list, with a row selected, **«Отправить в комиссию»** opens a modal
**«Выберите комиссию»** (× close): a required dropdown «Комиссия *» (red bg +
«Поле является обязательным» until chosen) with options sourced from the
commissions reference — observed values: «Комиссия по залогу test1», «Комиссия по
заявкам». Footer: **ОК** (blue) · **Отмена**. **«Отправить в залоговую
комиссию»** behaves the same for the collateral track. On ОК the live app links
the application to the chosen commission and reflects the change (status /
toast) — capture the exact post-OK feedback during implementation and reproduce
it.

## 4. File & structure conventions

- New folder `mockups/loan-application/` with the single
  `loan-application.html`.
- Top-of-file HTML comment block in the same style as `loan-program.html`:
  states it is an as-is mockup (not prod code), the live source URL + inspection
  date, the four parts covered, and explicitly that **defects are reproduced, no
  improvements applied**.
- One `<style>` block: the verbatim design-system CSS from `loan-program.html`
  plus screen-specific additions (stat cards, commission dialog).
- One `<script>` block: view-router (list ↔ create modal ↔ detail ↔ send
  dialog), grid (sort/paginate/filter/select), wizard validation, tab switching,
  picker modals.
- Sample data: a small in-file dataset of ~22 applications covering all status
  values, plus 1–2 fully-populated detail records to drive the detail page.

## 5. Implementation method

Mirror the loan-program workflow:

1. For each screen/tab, write/extend an inspection script under
   `scripts/inspect/app-*.mjs` that logs in, navigates, and dumps the exact DOM
   text, computed CSS, and layout; save verification screenshots to `.auth/`.
2. Build that screen/tab in the mockup to match the capture.
3. Verify the mockup against the screenshot before moving on.

Order: list → create wizard → detail header + stepper → detail tabs 1–9 → send
dialog. Each is an independent, verifiable unit.

## 6. Companion doc updates

- **`requirements/features/03-application-commission.md`** — append the
  2026-06-29 live findings (stat cards, «Новый» status, stepper check+date,
  approved-terms range hint).
- **`STATUS.md`** — changelog entry + "Last updated" date; note the new
  loan-application as-is mockup.
- Defects/recommendations: this is an as-is clone, so no new `P3-*` findings are
  required by the mockup itself; if the live re-inspection surfaces anything new,
  log it in `notes/qa-findings.md` per the workspace convention.

## 7. Success criteria

- Opening `loan-application.html` in a browser reproduces the live list,
  create wizard, detail page (all 9 tabs), and send-to-commission dialog with
  matching text, colours, layout, and click-behaviour.
- All four parts are interactive (no dead controls within the cloned flow).
- The as-is defects (grey field styling, eager validation, no «Просмотр») are
  present, and no improvement markers appear.
- Design tokens/components are the shared ones from `loan-program.html` (no
  divergent restyling).
