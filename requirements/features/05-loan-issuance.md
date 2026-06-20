# Phase 5 — Loan issuance (Выдача кредитов / Кредиты)

> Routes: list `/loansCredit` · detail `/loan-credits/{id}` (edit) ·
> `/loan-credits-read/{id}?mode=readonly` (view). Documented 2026-06-20 from test
> env (admin); inspected via `scripts/inspect/loans.mjs`, `loans-detail.mjs`,
> `loans-walk.mjs`, `loans-crash.mjs`.
> Fifth phase of the credit lifecycle: an approved application becomes a **loan**
> — the servicing hub for terms, disbursement, schedule, tranches, reserve,
> payments, and collateral.

## Purpose
A **кредит** is the materialized loan created from an **approved application**
(Phase 3). The list reuses the application's columns (registration number,
borrower, requested/approved amount & term, application status) — i.e. a loan is
the downstream of an approved заявка, not a separately-created entity. The detail
page is the operational hub for the rest of the credit's life: issuance
(«Оформление»), loan terms, the repayment schedule, tranches, reserve, payments,
payment codes, detailed accrual calculation, and collateral.

> Scope note: this phase documents issuance + the loan record. The servicing tabs
> **Транши / Резерв / Платеж / Код оплаты / Детальный расчет** belong to Phases
> 6–7 (disbursement, tranches, servicing) and are mapped here only structurally.

## List view — `/loansCredit`
Toolbar: **Добавить условие поиска** (filter) · **Изменить** · **Просмотр**.

> No **«Создать»** (loans are derived from approved applications — expected) and
> no **«Удалить»**. «Изменить»/«Просмотр» are gated on row selection only.

Columns: **Номер регистрации** · Заемщик · Запрошенная сумма · Запрошенный срок ·
**Одобренная сумма** · Одобренный срок · **Статус заявки** · Дата регистрации ·
Ответственное лицо · Итоговая сумма платежей · Всего платежей.

> The list shows the **application** status («Статус заявки»: Одобрено / Отклонено
> / На рассмотрении), not a distinct loan status — even though the loan record
> itself carries its own «Статус кредита» (see detail). Worth reconciling which
> status the list should surface.

## Detail / edit page — `/loan-credits/{id}`
Header: **Редактирование кредита**. 11 tabs. Footer on every tab: **OK / Отмена**.

| Tab | Contents |
|---|---|
| **Общая информация** | Сумма по договору · Одобренная сумма (ro) · date/time · **Статус кредита** (combo) · Основной · Дата полного погашения (ro) · срок возврата · Внесено/Измнен (ro audit) · Пин (ro) · Информацию по счету (ro) |
| **Оформление** | Issuance: Номер регистрации · date · Комментарии · **file upload** (Загрузить) |
| **Заемщик** | ПИН/ИНН (ro) · Наименование/ФИО (ro) |
| **Условия кредита** | Процентная ставка (ro, empty) · Процент за резерв · Метод погашения · penalty rates & types · accrual-limit fields |
| **График погашений** | Summary (Всего платежей, Сумма кредита, Сумма процентов, Регулярный платёж, Итоговая сумма) + schedule grid; **Построить график** |
| **Транши** | grid · Добавить / Открыть / Удалить _(Phase 6)_ |
| **Резерв** | grid _(Phase 7)_ |
| **Платеж** | grid · Добавить / Редактировать _(Phase 7)_ |
| **Код оплаты** | grid _(Phase 7)_ |
| **Детальный расчет** | grid · Рассчитать / Расчет на весь график / Начислить ОД и проценты / Начислить пеню _(Phase 7)_ |
| **Залог** | grid · Редактировать / Просмотр _(Phase 8 link)_ |

### Repayment schedule works at loan level
For record 18 the **«График погашений» computes interest correctly**: Сумма
процентов 16 121,73; per-row Проценты 1 250,00 / 1 202,74 / 1 155,08 … against
Основной долг 5 671,74 / 5 719,00 …. This **contrasts with the application-level
schedule (P3-R11)** where interest was 0,00 — so the interest-calc bug is
application-side, not loan-side. (Good cross-check; not a Phase-5 defect.)

## Findings (see `notes/qa-findings.md`, P5-xx)
- **P5-01 🔴** — loan detail **crashes** «Непредвиденная ошибка» on records 20 & 22,
  both edit and readonly routes; 18/19/21 open fine. Server-side, data-dependent.
- **P5-02 🟠** — no status gating; «Статус кредита» + «Сумма по договору» + terms
  freely editable regardless of status.
- **P5-03 🟠** — «Сумма по договору» (250 000) can exceed «Одобренная сумма»
  (150 000); editable plain text-field, no numeric/min/max validation.
- **P5-04 🟡** — loans list has no working view page (only read path is «Просмотр»,
  which routes to the crashing readonly view); list shows application status only.
- **P5-05 🟡** — inconsistent amount format on one screen (`150000.00` vs `250 000,00`).
- **P5-06 🟡** — date entry split into 3 unlabeled widgets (date-time + date + time).
- **P5-07 🔵** — UI typos: «Измнен», «начисения»/«начсиления».
- **P5-08 🟡** — «Процентная ставка» empty/readonly on Условия кредита though the
  schedule computes interest.

## Recommendations (for the dev team — see `TODO.md`, P5-R*)
- **P5-R1 🔴** — fix the loan-detail crash (root via server log; graceful error).
- **P5-R2 🟠** — status-gate loan fields; status changes via workflow transitions.
- **P5-R3 🟠** — validate contract amount (≤ approved, > 0) on client + server.
- **P5-R4 🟡** — proper loan «Просмотр» detail page (reuse P2-R4/P3-R2 pattern).
- **P5-R5 🟡** — field/format cleanup (unify amount format, single labeled date
  field, surface rate, reuse the field-semantics component P1-R6/P2-R1/P3-R1, fix typos).
