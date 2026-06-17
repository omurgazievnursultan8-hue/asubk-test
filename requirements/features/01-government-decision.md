# Phase 1 — Government decision (Решение правительства)

> Route: `/gov-decisions` · Documented 2026-06-17 from test env (admin).
> First phase of the credit lifecycle: a government act that authorizes lending
> (loan programs reference the decision that created them).

## Purpose
Registers the legal basis for lending — the government order/resolution that
authorizes a loan program. Everything downstream (programs → loans) traces back
to one of these records. Records move through an **approval workflow**.

## List view
Toolbar: **Обновить** (refresh) · **Фильтр / Добавить условие поиска** (filter
builder) · settings (gear, column config).
Row actions: **+ Создать** (create) · **Изменить** (edit) · **Просмотр** (view)
· **Удалить** (delete) · **Одобрить** (approve) · **Отклонить** (reject) ·
gear · row-count + pagination. ~12 records present on test env.

Columns: Наименование · Краткое наименование · Статус · Код · Номер решения ·
Вид решения · Дата решения (all sortable).

## Workflow (status lifecycle)
- New record is created with status **На стадии рассмотрения** (under review) —
  set automatically, field is read-only on the form.
- From the list, **Одобрить** / **Отклонить** move it to **Одобрен** (approved)
  / rejected.
- **Закрыт** (closed) status also observed on existing records.
- So: `Под рассмотрением → Одобрен/Отклонён → Закрыт`.

## Create / edit form
Dialog at `/gov-decisions/new`. Fields:

| Field | Control | Required | Notes |
|---|---|---|---|
| Наименование (name) | text | ✅ | |
| Краткое наименование (short name) | text | ✅ | |
| Код (code) | text | ✅ | Styled grey (looks disabled) but is editable & required |
| Номер решения (decision №) | text | ✅ | |
| Вид решения (decision type) | lookup (•••) | ✅ | Reference picker; values seen: Распоряжение, Постановление, Основное, РКМКР, РПКР, ПКМКР |
| Дата решения (decision date) | date picker | — | Defaults to today |
| Статус (status) | read-only | — | Auto = "На стадии рассмотрения" |
| Примечание (note) | textarea (tab) | — | Free text |

Save: **OK** · Cancel: **Отмена**.

## Business rules observed
- 5 required fields (above); status and date auto-populate.
- New decisions always enter the review queue (cannot be created pre-approved).
- Approve/reject is a separate action from the list, not part of the create form
  (segregation of create vs. approve — supports maker/checker).

## QA result
✅ **Pass.** Required-field validation works: submitting empty shows a
"Внимание / Заполните все обязательные поля!" toast and highlights all 5 required
fields in red. See `notes/qa-findings.md` for minor observations.

## Open questions for domain owner
- Is **Код** entered manually or should it be system-assigned? (Some existing
  rows appear to have no code, yet it's required on create.)
- Who is allowed to Approve vs. Create (role separation)?
- What does **Закрыт** mean for a decision, and what triggers it?

## Recommendations (logged 2026-06-17)
Prioritized improvement proposals for the dev team. Status legend:
✅ confirmed in app · ❓ to verify in app.

| # | Priority | Recommendation | Rationale | Status |
|---|---|---|---|---|
| R1 | 🔴 High | **Attach the source document** — add file upload for the signed government decision (PDF/scan), not just the free-text Примечание. | A government decision is a legal act; an audit/credit system must hold the actual document. Largest functional gap. | ✅ no attachment field exists |
| R2 | 🔴 High | **Add reject reason + confirmation + audit trail** — Отклонить must confirm intent, capture a mandatory reason, and record approver/rejector + timestamp; surface these in the list. Reject is currently immediate, silent, and irreversible (→ Закрыт). | "Who approved/rejected this, when, and why" is the first thing auditors ask; one mis-click closes a decision permanently. | ✅ confirmed — no reason, no confirmation, irreversible (P1-03) |
| R3 | 🔴 High | **Settle Код semantics** — make it system-assigned or enforce uniqueness, and reconcile with existing rows that have no code. | Prevents duplicate/inconsistent codes that downstream loan programs key off. | ✅ required on create, blanks exist (P1-02) |
| R4 | 🟠 Medium | **Guard delete of referenced records** — block delete when a decision is referenced by a loan program. (Edit is already correctly disabled on approved/closed records.) | Deleting an in-use decision is a data-integrity risk; delete button stays enabled on terminal-state records. | ✅ delete stays enabled (P1-05); edit guard OK; server-side referential check still to confirm |
| R5 | 🟡 Low | **Fix Код field styling** — render editable required fields as editable (white), not with the disabled grey style. | Misleading UX (P1-01). | ✅ confirmed |
| R6 | 🟠 Major | **Validate Дата решения** — disallow future dates (and/or dates before a sane floor). | A decision dated in the future is nonsensical. | ✅ confirmed — picker/input accept future dates (P1-04) |

> All six are now confirmed at the UI level. Remaining server-side check: R4
> referential integrity on delete (not tested to avoid destroying data).

## Notes from verification (2026-06-17)
- **Tech stack:** front end is **Vaadin** (vaadin-grid / vaadin-button), Java-based.
- **Open question answered — what is "Закрыт"?** Rejecting a decision moves it to
  **Закрыт** (closed); it is the terminal/rejected state. Edit and approve are
  disabled once a record is Закрыт or Одобрен.
- **Test-data note:** record **РКМ 508-р** was moved from "На стадии рассмотрения"
  to "Закрыт" during reject verification and could not be restored via the UI.
