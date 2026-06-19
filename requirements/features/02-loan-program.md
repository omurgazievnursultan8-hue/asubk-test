# Phase 2 — Loan program (Кредитная программа)

> Route: `/loan-programs` · Documented 2026-06-17 from test env (admin).
> Second phase of the credit lifecycle: a lending product defined under a
> government decision. Applications (Phase 3) and loans reference a program.

## Purpose
Defines a **lending product** — its naming, the gov-decision it derives from,
purpose/type/currency, amount & term rules, interest and penalty rates, grace
periods, payment schedule logic, required document sets, and collateral
requirements. Everything an application/loan needs to be issued is templated here.
A program traces up to a **Решение правительства** (Phase 1) and is the parent
of downstream applications and loans.

## List view
Toolbar: **Обновить** (refresh, + split-button) · settings (gear) ·
**Фильтр / Добавить условие поиска** (filter builder).
Row actions: **+ Создать** (create) · **Изменить** (edit) · **Удалить** (delete)
· row-count + pagination. **9 records** on test env.

> Note: unlike Phase 1 (gov-decisions), there is **no «Просмотр» (view)** action
> and **no «Одобрить»/«Отклонить»** in the toolbar. To inspect a program you
> open **Изменить**; approval is initiated from inside the form (see Workflow).

Columns (all sortable): Наименование на русском · Краткое описание ·
Решение правительства · Назначение кредита · Вид кредита · Дата с · Дата по ·
Статус. All 9 visible records have status **Черновик** (Draft).

## Create / edit form — a 9-tab wizard
Dialog at `/loan-programs/new` (title «Кредитная программа»). The form is a
**9-step wizard** (vaadin-tabsheet). Footer on every tab: **OK** · **Сохранить**
· **Отмена**; the last tab additionally shows **«Отправить на подтверждение»**.

### Tab 1 — Основные данные
Three column groups.

**Общая информация**
| Field | Control | Required |
|---|---|---|
| Наименование на русском | text | ✅ |
| Наименование на кыргызском | text | — |
| Наименование на английском | text | — |
| Источник финансирования | lookup (•••) | — |
| Краткое описание | textarea | ✅ |
| Решение правительства | lookup (•••) | ✅ → links to Phase 1 |

**Параметры программы**
| Field | Control | Required |
|---|---|---|
| Назначение кредита | lookup (•••) | ✅ |
| Вид кредита | lookup (•••) | ✅ |
| Дата с | date picker | ✅ |
| Дата по | date picker | ✅ |
| Отрасль | lookup (•••) | — |
| Валюта | lookup (•••) | — |
| Кредитная линия | lookup (•••) | — |
| Вид счета погашения | lookup (•••) | — |

**Дополнительные параметры**
| Field | Control | Required |
|---|---|---|
| Список заявителей (физ. лица) | lookup (•••) | — |
| Список заявителей (юр. лица) | lookup (•••) | — |
| Ответственные сотрудники | lookup (•••) | — |
| Комментарий | textarea | — |

→ **7 required fields, all on Tab 1** (see QA result).

### Tab 2 — Сумма и срок
- **Сумма кредита** → *Тип суммы кредита* select: **Фиксированная / Диапазон**;
  *Фиксированные суммы* — editable grid (Сумма) with + Добавить / Удалить;
  *Валюта* (read-only, inherited from Tab 1).
- **Срок кредита** → *Тип срока кредита* select: **Фиксированная / Диапазон**;
  *Фиксированные сроки* — editable grid (Срок) with + Добавить / Удалить.

### Tab 3 — Процентные ставки
**Основная процентная ставка** → *Тип основной ставки* select
(**Фиксированная / Диапазон**) · *Значение фиксированной ставки* select ·
*Использовать плавающую ставку* checkbox.

### Tab 4 — Штрафы
- **Штраф за просрочку основной суммы** → *Тип штрафной ставки за основную сумму*
  (Фиксированная / Диапазон) · *Значение фиксированной штрафной ставки*.
- **Штраф за просрочку процентов** → *Максимальный размер штрафа* (% от суммы кредита).
- **Штраф за просрочку процентов** (2nd block) → *Тип штрафной ставки за проценты*
  (Фиксированная / Диапазон) · *Значение фиксированной штрафной ставки за проценты*.

### Tab 5 — Льготный период
Three checkbox blocks: *Использовать льготный период по основной сумме* ·
*…по начислению процентов* · *…по процентам*.

### Tab 6 — Платежи и расчеты
| Group | Field | Control / values |
|---|---|---|
| Периодичность платежей | Периодичность платежей | select: **Ежемесячно / Ежеквартально / Ежегодно** |
| | Конкретные месяцы платежей | multi-select combo |
| День платежа | День месяца для платежа | integer |
| | Обработка выходных дней | select: **Переносить на следующий / на предыдущий рабочий день** |
| Метод расчета дней | Метод расчета дней | lookup (•••) |
| Метод погашения кредита | Метод погашения кредита | select: **Аннуитетный / Дифференцированный** |
| Расчеты | Тип расчета процентов | lookup (•••) |
| Очередь погашения | Очередь погашения | lookup (•••) |
| Период между освоением и первым платежем | Минимальное кол-во дней / Максимальное кол-во дней | integer / integer |

### Tab 7 — Документы
- **Кредитные документы** — *Список обязательных* / *Список опциональных* кредитных
  документов (two grids, + Добавить / Исключить); *Шаблоны договоров* lookup +
  *Выбранные шаблоны* (read-only; "сохранятся после нажатия кнопки «Сохранить»").
- **Залоговые документы** — *Список обязательных* / *Список опциональных* залоговых
  документов (two grids); *Требования к оформлению залогового договора* textarea.
- **Настройка проверки документов** — *Уровень проверки документов* (lookup) ·
  *Срок проверки документов (в днях)* (integer) · *Ответственный за проверку
  документов* (lookup).

### Tab 8 — Залоговое обеспечение
- *Требуется залоговое обеспечение* checkbox.
- **Виды залога** → *Список видов залога* grid (+ Добавить / Исключить).
- **Требования к залогу** → *Требования к залогу (ру)* / *Талаптар (кырг)* /
  *Requirements (eng)* (three textareas).

### Tab 9 — Предпросмотр (read-only summary)
A read-only roll-up of the whole program in cards: **Сводная информация о
программе** (Наименование, Статус, Решение правительства, …) · **Финансовые
параметры** · **Условия погашения** · **Требуемые документы** · **Настройки
проверки**. Footer adds **«Отправить на подтверждение»** — the action that pushes
the draft into the approval flow.

## Enumerations observed
- Тип суммы / срока / ставки / штрафной ставки: **Фиксированная · Диапазон**
- Периодичность платежей: **Ежемесячно · Ежеквартально · Ежегодно**
- Обработка выходных дней: **Переносить на следующий рабочий день · …на предыдущий**
- Метод погашения кредита: **Аннуитетный · Дифференцированный**

## Workflow (status lifecycle)
- New program is created as **Черновик** (Draft) — all 9 test records are Draft.
- From the **Предпросмотр** tab the author presses **«Отправить на подтверждение»**
  to move the draft into approval. Approve/reject is **not** available from the
  list toolbar (contrast Phase 1).
- The full status set, the transitions after «Отправить на подтверждение», and
  **who** confirms/approves are **not yet established from the UI** (open question).

## Business rules observed
- A program **must reference a gov-decision** (Решение правительства required) —
  this is the downstream link Phase 1 R4 (referential delete-guard) refers to.
- Only **7 fields are required**, all on Tab 1; tabs 2–8 are optional at create
  time (rate/penalty/schedule/document/collateral config can be left blank).
- Amount, term, base rate and penalty rates each switch between a single
  **Фиксированная** value and a **Диапазон**, with editable grids for fixed sets.
- Document requirements are split into **mandatory vs optional** sets, separately
  for **credit** and **collateral** documents, plus a document-check config.

## QA result
✅ **Pass.** Required-field validation works: pressing **OK** on an empty form
shows the toast **«Внимание / Заполните все обязательные поля!»**, highlights the
7 required Tab-1 fields in red, and does **not** create a record (URL stays on
`/loan-programs/new`). See `notes/qa-findings.md` (P2-xx) for observations.

## Open questions for domain owner
- Full **status lifecycle** of a program after «Отправить на подтверждение», and
  **who** is authorized to confirm/approve (role separation)?
- Difference between **OK** and **Сохранить** in the footer? (Tab 7 implies
  «Сохранить» persists selected templates; is OK = save & close?)
- Should **Дата с / Дата по** be bounded by the linked gov-decision's validity,
  and must **Дата по ≥ Дата с** be enforced?
- Are RU-only names intended (кырг/англ optional) while «Краткое описание» is
  mandatory?

## Recommendations (logged 2026-06-17, draft for review)
Prioritized improvement proposals for the dev team. Numbered **P2-R1…** — a
per-phase counter (mirrors the `P2-xx` finding IDs); Phase 1's `R1–R7` counter
stays independent. Status legend: ✅ confirmed in app · ❓ to verify.

| # | Priority | Recommendation | Rationale | Status |
|---|---|---|---|---|
| P2-R1 | 🟡 Low | **Field visual semantics** (agreed 2026-06-17). Three field states: required-editable → white bg + border + **red `*`** at the label; optional-editable → white bg + border, no `*`; read-only/computed → grey, no border. Show the `*` **immediately on form open**, not only after a failed submit. Implement as **one shared design-system field style with Phase 1 R6** and apply across all 9 tabs. | A ~40-field wizard where required/optional/read-only look identical is hard to fill correctly. | ✅ confirmed (P2-01) — recurs P1-06 |
| P2-R2 | 🟠 Medium | **Дата с / Дата по validation** (agreed 2026-06-17). Enforce **Дата по ≥ Дата с** (equality allowed) on client + server, and **Дата с ≥ Дата решения** of the linked decision as the lower bound. The gov-decision has **no validity period** — only a single «Дата решения» (verified 2026-06-17), so that date is the lower bound. Future dates ARE legitimate for a program (unlike a decision), so this is *ordering/consistency*, not a future-date ban. Clear error message on violation. | A program starting before its legal basis, or ending before it starts, is invalid. | ✅ no min/max, no client ordering (P2-02) |
| P2-R3 | 🟡 Low | **Save-button semantics & labels** (re-scoped 2026-06-17 after testing). Verified: **OK = save & close**, **Сохранить = save & stay** — both persist data (standard Jmix maker pattern, *not* a data-loss trap). The issue is that the distinction isn't obvious and labels are inconsistent (English «OK» next to Russian «Сохранить»/«Отмена»). Use one language and clear semantics — e.g. «Сохранить» (stay) + «Сохранить и закрыть» + «Отмена», or tooltips. Minor: after OK the app goes to `/` (home), not the programs list — return to the list. | Two same-weight save buttons with unexplained difference confuse users. | ✅ behavior confirmed via test record (P2-03) |
| P2-R4 | 🟡 Low | **Dedicated program detail page («Просмотр»)** — currently only Создать/Изменить/Удалить; inspecting forces edit mode. Build a separate read-only detail page (not the Предпросмотр tab, not a read-only wizard); open via a **«Просмотр»** toolbar button **and double-click** on a row; offer **«Изменить»** from the view. Align with Phase 1 R6 "Просмотр + действия". | Read-only view prevents accidental edits and matches gov-decisions UX. | ✅ no view action (P2-04) |
| P2-R5 | 🟠 Medium | **Formalize the program status workflow** — list shows only «Черновик»; no approve/reject in toolbar; submission only via «Отправить на подтверждение» on the Предпросмотр tab. **Status set mirrors the gov-decision (Phase 1 R7), 3 core states:** `На рассмотрении → Одобрена / Отклонена → Закрыта` (Черновик is the pre-submit working state; «Отправить на подтверждение» = Черновик → На рассмотрении). **Roles are separated (4-eyes):** the editor submits, a *different* user (confirmer/manager, by role) approves/rejects — no self-confirmation. **Transitions live in both the list toolbar and the detail page (P2-R4).** Reject/close require confirmation + reason + audit entry (per Phase 1 R2); status shown as a badge (P1-08). | Without a defined lifecycle, programs can't be reliably governed before loans reference them. | ✅ undefined in UI (P2-05) |
| P2-R6 | 🔵 UX | **Large-form error UX** — validation toast is generic and doesn't name the tab/field; all required happen to be on Tab 1, but a future required field on another tab would be invisible. **Scope:** badge/count the tabs with errors (red indicator + number) so the user sees where to look on the 9-tab wizard; **inline message under each invalid field** («Обязательное поле»), not just a red border. (Not in scope, by decision: auto-switch+focus to the first error tab, aggregate list of missing fields.) | Generic "fill required fields" on a 9-tab wizard is a dead end for the user. | ✅ confirmed (P2-06) |
| P2-R7 | 🟠 Medium | **Delete-error handling (localized message)** — deleting a referenced program throws a raw **«Непредвиденная ошибка»** with `DeletePolicyException: Unable to delete LoanProgram because there are references from GovDecision` (untranslated, technical). Catch it → a **general** localized message («Нельзя удалить: на программу есть ссылки»), without listing the referencing entities; align wording with R4 (Phase 1). | A business rule shown as an "unexpected error" with a developer message. | ✅ confirmed (P2-07) |
| P2-R9 | 🔴 Critical | **Enforce approved-decision-only on the server** (verified 2026-06-19). The «Решение правительства» picker's «Статус = Одобрен» is only a **removable default UI filter** — clear the chip and all decisions (incl. «На стадии рассмотрения» / «Закрыт») become selectable, and the program **saves with no server validation** (P2-08, 7→13 rows). Validate on save that the linked decision is approved/active; make the picker filter a **hard loader condition** (hide non-approved), not a default; and narrow the picker from the full lookup screen (Создать/Одобрить/Отклонить exposed) to selection-only. Tie to Phase 1 R7 («Одобрен»→«Действует»). | A program can be created under a non-approved or closed legal basis — the core referential rule is unenforced. | ✅ confirmed (P2-08) |
| P2-R8 | 🟠 Medium | **Bug: delete-policy direction** — a freshly created program (ID 24) with **no** downstream usage cannot be deleted, blamed on "references from GovDecision" — yet the program references the decision, not vice versa. Dev to verify the LoanProgram↔GovDecision link direction and delete-policy; a program with no real downstream references (applications/loans) should be deletable. Separate from P2-R7 (that is error presentation; this is policy correctness). | A possibly inverted delete-policy / back-reference makes valid records undeletable. | ✅ confirmed (P2-07) |

## Notes from verification (2026-06-17)
- **Tech stack:** confirmed **Jmix on Vaadin** — lookup pickers are
  `jmix-value-picker`, selects/grids are Vaadin components. (Phase 1 said
  "Vaadin"; Jmix is the application framework on top.)
- **Select field IDs** (useful for dev/automation): `loanAmountTypeField`,
  `loanTermTypeField`, `loanBaseRateTypeField`, `baseAmountPenaltyTypeField`,
  `interestPenaltyTypeField`, `paymentPeriodicityField`, `weekendProcessingField`,
  `repaymentMethodField`.
- **Program → decision link** is live: the list "Решение правительства" column
  shows the parent decision per program (e.g. «ПКМКР №554 от 11.09.2024»),
  confirming the downstream reference behind Phase 1 R4.
- Explored via Playwright (system Chrome, saved admin session). Mostly read-only;
  one realistic test record was created on 2026-06-17 to verify save/delete
  behaviour (see below).
- **Save buttons (verified):** **«Сохранить» = save & stay** (commits, keeps the
  editor open; URL → `/loan-programs/<id>`, toast «…успешно сохранена»);
  **«OK» = save & close** (commits, leaves the editor; then navigates to `/`).
  Both persist data — standard Jmix maker pattern. → P2-R3.
- **Delete (verified):** server-side referential guard exists — deleting a
  referenced program raises `DeletePolicyException` surfaced as a raw
  «Непредвиденная ошибка» (finding P2-07). → P2-R7.
- **Test record:** «Программа льготного кредитования сельхозпроизводителей 2026»
  (ID 24) was created and **could not be deleted** via UI due to the delete-policy
  above; it remains in the test env pending the planned full data wipe.
