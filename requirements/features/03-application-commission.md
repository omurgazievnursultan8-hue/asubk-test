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

Columns (8, all sortable): Номер документа («Заявка - N») · Заемщик · **Статус
заявки** · **Статус залога** · Кредитная программа · Запрашиваемая сумма ·
Запрашиваемый срок · Дополнительная информация.
**No «Одобренная сумма» column** (`hasApprovedAmount = false`, verified
2026-06-19) — the commission-approved amount/term is invisible in the list,
only the requested figure shows. → P3-R8. «Дополнительная информация»
(free text, often empty) is low-value as a column.
Observed Статус заявки values: На рассмотрении · Одобрено · Отклонено ·
**Требуется доп. информация** (4th value, found 2026-06-19 on Заявка-74; full
set + transitions still to be enumerated from the model → P3-09).
Статус залога is a **separate** track: На рассмотрении · Одобрено.

> **Action gating (verified 2026-06-19, `verify-p3r5r8.mjs`):** toolbar actions
> are **selection-gated but not status-gated** — Изменить/Удалить/Отправить are
> disabled with no selection, but **enabled for any selected row regardless of
> status** (tested Одобрено/Отклонено/На рассмотрении/Требуется доп. информация).
> So an Одобрено app can be re-sent or deleted, an Отклонено one re-sent. → P3-R7.

### Create form — multi-step dialog «Новая заявка»
Modal dialog (not a routed page). Footer: **Далее** (next) · **Отмена**.
Step 1 fields:

| Field | Control | Required |
|---|---|---|
| Субъект (borrower) | lookup (•••) | — (core, logically required) |
| Кредитная программа | lookup (•••) | — |
| Адрес | text (**readonly** — auto-filled from Субъект) | — |
| Номер телефона | text (format mask, prefilled `+996`) | — |
| Источник финансирования | lookup (•••) | — |
| Дополнительная информация | textarea | — |
| Запрашиваемая сумма | big-decimal | ✅ |
| Запрашиваемый срок | number | ✅ |
| Метод погашения кредита | select (Аннуитетный [default] / Дифференцированный) | — |
| Льготный период по основному долгу | checkbox (default off, under collapsible «Ручные параметры льготного периода») | — |
| Льготный период по начислению процентов | checkbox | — |
| Льготный период по процентам | checkbox | — |

> **Good:** required fields (Запрашиваемая сумма, Запрашиваемый срок) show a
> red `*` AND an inline «Поле является обязательным» message — the exact pattern
> Phase 2 asked for in P2-R6. This module is the reference implementation; the
> remaining gap is the **grey "disabled-look" field styling** (P3-01), shared
> with P1-01/P2-01.
>
> **Live re-inspection 2026-06-19** (`scripts/inspect/app-create-fields.mjs`,
> screenshot `.auth/app-create-step1.png`):
> - **Phone format validation** added since the original doc — «Номер телефона»
>   is prefilled `+996` and validates against «Введите номер в формате
>   +996 990 000 000». New behaviour, not present at first pass.
> - **Eager required-validation:** «Запрашиваемая сумма» / «Запрашиваемый срок»
>   render with red background + «Поле является обязательным» **immediately on
>   open**, before the user touches them → defer to blur / «Далее». → P3-R6.
> - **No numeric bounds:** both amount and term expose `min/max/step = null`
>   (confirms P3-R3).
> - **Субъект & Кредитная программа are `required=false`** server-side despite
>   being core — an application can be advanced without them. → P3-R5.
> - **«Далее» gating:** the wizard does not advance while required fields are
>   empty (validation blocks it) — correct gating, only the eager display is the
>   issue.
> - Адрес is **readonly** (auto-filled from Субъект); Метод погашения defaults to
>   «Аннуитетный»; the three льготный-период checkboxes default **off**.

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
- **Quorum & final decision:** ✅ resolved (customer 2026-06-19) — «Финальное
  решение» is **manual** (chairman), member votes advisory; **no quorum threshold**,
  the chairman closes voting at any time (the `0/4` tally is informational). → P3-R4.
- **Role separation (4-eyes):** can the application author / submitter also be a
  voting member or chairman on the same application's commission? Should be
  forbidden. → P3-R4.
- **Deadlines:** ✅ resolved (customer 2026-06-19) — the per-member **Крайний
  срок** is enforced via **reminder / escalation**: as the deadline nears/passes,
  notify the member (and chairman), but **do not** auto-change the vote (no
  auto-abstain — that would clash with «chairman closes voting at any time»). The
  vote stays open until cast or the chairman closes. Needs dev (timer +
  notification). → P3-R4 (e).
- **Two commissions:** ✅ resolved (customer 2026-06-19) — the **credit** and
  **collateral (залоговая)** commissions run **in parallel, independently**;
  neither gates the other (matches the two parallel application statuses). → P3-R4.
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
| P3-R4 | 🟠 Medium | **Commission governance rules** (stance agreed 2026-06-18; quorum & ordering confirmed by customer 2026-06-19). (a) **«Финальное решение» stays manual** (set by the chairman), member votes advisory — but each save writes an **audit entry** (who/when/decision + reason, especially when it diverges from the vote tally). (b) **4-eyes as a warning**: if the application's author/submitter is also a member/chairman on its commission, don't block — show a warning and flag it in the audit. (c) **No quorum threshold** — the chairman closes voting at any time; member votes are advisory; the `0/4`/`1/4` tally is informational, not a closing rule. (d) **Credit & collateral commissions run in parallel, independently** — neither gates the other; matches the application's two parallel statuses (Статус заявки + Статус залога). (e) **Per-member «Крайний срок» — reminder/escalation, not auto-abstain** (confirmed 2026-06-19): notify the member + chairman as the deadline nears/passes; the vote stays open (no auto-vote-change, to avoid clashing with chairman-closes-anytime). Real dev (timer + notification). | The voting machinery exists but its governance (final-decision authority, self-voting, quorum, deadline enforcement) is not visible in the UI. | ✅ confirmed — ready to build (P3-04) |
| P3-R5 | 🔴 High | **Make «Субъект» and «Кредитная программа» required** on the «Новая заявка» form (logged 2026-06-19). Both are core to an application yet expose `required=false` server-side — an application can be advanced/saved without a borrower or a program. Add `*` + inline required message (reuse the сумма/срок pattern) **and** server-side validation, and block «Далее» until both are set. | An application with no subject or no program is meaningless and pollutes the list; the missing flags are a data-integrity gap, not just a UI one. | ✅ confirmed — `required=false` on test (P3-05) |
| P3-R6 | 🟡 Low | **Defer required-field error display** on «Новая заявка» (logged 2026-06-19). «Запрашиваемая сумма» / «Запрашиваемый срок» show red background + «Поле является обязательным» **immediately on open**, before any interaction. Switch to lazy validation — surface the error on blur or on «Далее», not on render. | Eager errors on an untouched form read as "you did something wrong" before the user starts; degrades the otherwise-reference-quality validation UX. | ✅ confirmed on test (P3-06) |
| P3-R7 | 🟠 Medium | **Status-gate the list toolbar actions** (logged 2026-06-19). Today «Отправить в комиссию» / «Отправить в залоговую комиссию» / «Удалить» are only **selection-gated** — enabled for any selected row regardless of status. Disable «Отправить…» on terminal/approved statuses (Одобрено, Отклонено), disable «Удалить» on Одобрено and on rows referenced downstream (loan/commission), and add a **confirmation dialog + per-row result toast** for the bulk sends. Client + server. Same class as Phase 1 R4/R5 (P1-03/P1-05). | An Одобрено application can be re-sent to a commission or deleted, an Отклонено one re-sent — no guard beyond "a row is selected". | ✅ confirmed on stand (P3-07) |
| P3-R8 | 🟡 Low | **List columns: surface the outcome, drop dead weight** (logged 2026-06-19). Add an **«Одобренная сумма»** column (the commission-approved amount/term, currently invisible in the list — `hasApprovedAmount = false`); optionally add commission **vote tally** (`n/4`, already on the sibling screen) and **Дата создания**. Drop or demote **«Дополнительная информация»** (free text, mostly empty, low scan value). | The list shows only the requested figure, never the approved result; a free-text column wastes a slot. | ✅ confirmed on stand (P3-08) |

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
