# Phase 3 — Application & application commission (Заявка + Комиссия по заявкам)

> Routes: `/loan-applications`, `/loan-application-commissions` ·
> Documented 2026-06-18 from test env (admin).
> Third phase of the credit lifecycle: a borrower's **application** for a loan
> under a program (Phase 2), and the **commission review** (voting body) that
> approves or rejects it. An approved application becomes a loan (Phase 5).

## Purpose
An **application (Заявка)** records a request from a subject (borrower) for a
loan under a specific **Кредитная программа** (Phase 2): requested amount, term,
repayment method, grace periods, plus the borrower's documents, credit/collateral
documents, and project documents. It is routed to two review bodies — a **credit
commission** and a **collateral (залоговая) commission** — and carries two
parallel statuses (Статус заявки + Статус залоговой комиссии).

A **commission review (Комиссия по заявкам)** is a voting record: a body of
members + a chairman vote (Одобрить / Отклонить / Воздержаться) on a linked
application, with a voting-progress bar, quorum tally, a protocol (number + date),
per-member deadlines, and a final decision.

This is the most mature module reviewed so far — it already implements a
status stepper, separated voting roles (4-eyes), inline required-field
validation, and a read-only view mode (on the commission screen).

---

## Заявки (applications) — `/loan-applications`

### List view
Toolbar: **Добавить условие поиска** (filter builder) · **Создать** · **Изменить**
· **Удалить** · **Отправить в комиссию** · **Отправить в залоговую комиссию**.
Pager shows **17 строк** on test env. Built-in generic filter exposes
`number`, `status`, `loanProgram`, `createdDate` conditions.

> Note: there is **no «Просмотр» (view)** action — inspecting an application
> forces edit mode (`/loan-applications/{id}`, no `?mode=readonly`). The sibling
> **Комиссии по заявкам** screen DOES have «Просмотр» + a readonly mode, so the
> two screens are inconsistent. → P3-R2.

Columns (all sortable): Номер документа («Заявка - N») · Заемщик · **Статус
заявки** · **Статус залога** · Кредитная программа · Запрашиваемая сумма ·
Запрашиваемый срок · Дополнительная информация.
Observed Статус заявки values: На рассмотрении · Одобрено · Отклонено.
Статус залога is a **separate** track: На рассмотрении · Одобрено.

### Create form — multi-step dialog «Новая заявка»
Modal dialog (not a routed page). Footer: **Далее** (next) · **Отмена**.
Step 1 fields:

| Field | Control | Required |
|---|---|---|
| Субъект (borrower) | lookup (•••) | — (core, logically required) |
| Кредитная программа | lookup (•••) | — |
| Адрес | text | — |
| Номер телефона | text | — |
| Источник финансирования | lookup (•••) | — |
| Дополнительная информация | textarea | — |
| Запрашиваемая сумма | big-decimal | ✅ |
| Запрашиваемый срок | number | ✅ |
| Метод погашения кредита | select (Аннуитетный / Дифференцированный) | — |
| Льготный период по основному долгу | checkbox | — |
| Льготный период по начислению процентов | checkbox | — |
| Льготный период по процентам | checkbox | — |

> **Good:** required fields (Запрашиваемая сумма, Запрашиваемый срок) show a
> red `*` AND an inline «Поле является обязательным» message — the exact pattern
> Phase 2 asked for in P2-R6. This module is the reference implementation; the
> remaining gap is the **grey "disabled-look" field styling** (P3-01), shared
> with P1-01/P2-01.

### Detail / edit page — `/loan-applications/{id}`
Header: Субъект · Номер документа · **Статус заявки** · **Статус залоговой
комиссии** · Запрашиваемая сумма.

**Status stepper** (horizontal): **Подача → На рассмотрении → Одобрена →
Регистрация кредита** — a defined, visualized lifecycle (what loan programs
lacked, P2-R5).

Tabs (9): **Общая информация** · График · Документы заявителя · Кредитные
документы · Залоговые документы · Проектные документы · **Кредитная комиссия** ·
**Залоговая комиссия** · История.

Общая информация sections: *Данные заявителя* (Субъект, Номер телефона, Адрес) ·
*Условия кредита заемщика* (Запрашиваемая сумма/срок, метод, льготные периоды) ·
*Условия кредита, одобренные кредитной комиссией* (approved amount/term/rate —
the commission can adjust the requested terms).

---

## Комиссии по заявкам (commission review) — `/loan-application-commissions`

### List view
Toolbar: **Создать** · **Изменить** · **Просмотр** · **Удалить** (has a
read-only view, unlike Заявки).
Columns: № («Проверка комиссии - N») · Дата · Заявитель · **Комиссия** (vote
tally, e.g. `1/4`, `0/4`) · Кредитная программа · Номер документа · Тип документа
(«Заявки») · **Тип решения** (На рассмотрении / Одобрено / Требуется доп.
информация) · Комментарий к решению.

### Detail / view page — `/loan-application-commissions/{id}?mode=readonly`
Header: № · Номер документа · Тип решения · Тип документа · **Заявка** (link to
the reviewed application) · **Комиссия** (the body, e.g. «Газификация-Комиссия»)
· button **«Просмотр заявки»** (open the linked application).

**Прогресс голосования — N%** with a tally: **Одобрили · Отклонили ·
Воздержалось · Не проголосовали**.

Tabs: **Обзор** · Отзывы (N) · Документы (N) · История (N) · Протокол.
*Обзор → Члены комиссии* table: **Роль** (Член комиссии / Председатель) ·
Сотрудник · **Решение** (Одобрить / Отклонить / Воздержаться) · Крайний срок ·
Дата отзыва · Комментарий (per-member, hidden behind an eye toggle).
Protocol fields: **Финальное решение** · Номер протокола · Дата заседания.

> The voting body separates **Член комиссии** from **Председатель** and records a
> per-member decision + deadline — a real 4-eyes implementation. Open questions
> below concern its governance rules, not its existence.

---

## Open questions (need domain confirmation)
- **Quorum & final decision:** how is «Финальное решение» derived — auto from the
  member votes (majority?), or set manually? Can it override the tally? What
  quorum is required (the `0/4` tally suggests a fraction-of-members rule). → P3-R4.
- **Role separation (4-eyes):** can the application author / submitter also be a
  voting member or chairman on the same application's commission? Should be
  forbidden. → P3-R4.
- **Deadlines:** is the per-member **Крайний срок** enforced (escalation /
  reminder / auto-abstain on expiry), or informational only?
- **Two commissions:** the relationship/ordering between the **credit** and
  **collateral (залоговая)** commissions — sequential or parallel? Does
  collateral approval gate credit approval?
- **Date validation:** are application dates (срок > 0) and commission dates
  (Крайний срок, Дата заседания) range/order-validated? Not tested. → P3-R3.

## Recommendations (logged 2026-06-18, draft for review)
Prioritized improvement proposals for the dev team. Numbered **P3-R1…** — a
per-phase counter (mirrors the `P3-xx` finding IDs); earlier phases' counters
(`R1–R7`, `P2-R1–R8`) stay independent. Legend: ✅ confirmed · ❓ to verify.

| # | Priority | Recommendation | Rationale | Status |
|---|---|---|---|---|
| P3-R1 | 🟡 Low | **Field visual semantics (create form only)** (agreed 2026-06-18). **Scope: the «Новая заявка» create dialog only** (where grey styling is visually confirmed) — the detail page and commission screen are out of scope here. **Reuse the shared design-system field component** from P1-R6/P2-R1 (required-editable → white + border + red `*`; optional-editable → white + border; read-only → grey) rather than building a new one; kept as a separate per-phase task for tracking. Note: required fields here already show `*` + inline «Поле является обязательным» — only the grey base styling remains. | Required/optional/read-only fields look identical; recurs P1-01/P2-01. | ✅ confirmed (P3-01) |
| P3-R2 | 🟡 Low | **Dedicated application detail page («Просмотр»)** (agreed 2026-06-18). Build a **separate read-only detail page** (same decision as programs P2-R4 and decisions Phase 1 R6) — a single readable overview of the application. Open via a **«Просмотр»** toolbar button **and double-click on a row → Просмотр (readonly)**; offer **«Изменить»** from the view. Aligns with the **commission screen (already has «Просмотр» + `?mode=readonly`)**, P2-R4 and Phase 1 R6. Inspecting an application currently forces edit mode. | Cross-screen inconsistency: sibling screens behave differently; edit-to-inspect risks accidental change. | ✅ confirmed (P3-02) |
| P3-R3 | 🟠 Medium | **Date & numeric validation** (agreed 2026-06-18; gap confirmed — fields carry no min/max/step). Enforce: **Запрашиваемая сумма > 0** and **Запрашиваемый срок > 0**; requested **amount & term within the linked program's** configured min/max amount & term bounds (cross-check with Phase 2 program rules); commission **Крайний срок ≥ today** and **Дата заседания** not before creation (ordering). Client + server, clear messages (no silent reset). Note: the application has no date range of its own (only a numeric term), so the program-bounds check replaces the "validity window" idea. | An application whose amount/term falls outside its program's rules, or a past-dated voting deadline, is invalid. | ✅ confirmed — no client min/max (P3-03) |
| P3-R4 | 🟠 Medium | **Commission governance rules** (stance agreed 2026-06-18). (a) **«Финальное решение» stays manual** (set by the chairman), member votes advisory — but each save writes an **audit entry** (who/when/decision + reason, especially when it diverges from the vote tally). (b) **4-eyes as a warning**: if the application's author/submitter is also a member/chairman on its commission, don't block — show a warning and flag it in the audit. (c) **Quorum to close voting is an open question for the customer** — no threshold proposed here (the `0/4`/`1/4` tally hints at a fraction rule, but the customer sets it). Document the credit↔collateral commission ordering (sequential/parallel, does collateral gate credit). | The voting machinery exists but its governance (final-decision authority, self-voting, quorum) is not visible in the UI. | ❓ domain confirmation (P3-04) — quorum & ordering open |

## Notes (2026-06-18)
- **Reference implementations to propagate to earlier phases:**
  - **Inline required-field validation** (red `*` + «Поле является обязательным»)
    on the application form is exactly what P2-R6 requested — reuse it.
  - **Status stepper** (Подача → На рассмотрении → Одобрена → Регистрация
    кредита) is the lifecycle visualization P2-R5 wants for programs.
  - **Separated voting roles + read-only view** on the commission screen are the
    4-eyes (P2-R5) and «Просмотр» (P2-R4) patterns the program module lacks.
- **Application ↔ program link** is live (list "Кредитная программа" column).
- **Commission ↔ application link** is live («Заявка» field + «Просмотр заявки»).
- Stack: **Jmix on Vaadin** (lookups = `jmix-value-picker`), consistent with
  Phases 1–2.
