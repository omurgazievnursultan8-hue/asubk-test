# Phase 7 — Servicing (Обслуживание: платежи, резервы, реестр)

> Routes (all under «Приложение»): payments `/payments` (Платеж) · loan-reserves
> `/loan-reserves` (Резерв) · loan-ledgers `/loan-ledgers` (LoanLedger).
> Documented 2026-06-20 from test env (admin); inspected via
> `scripts/inspect/p7.mjs`. Seventh phase of the credit lifecycle: once a loan is
> disbursed (Phase 6), it is **serviced** — borrowers make payments, a loan-loss
> **reserve** is computed, and every financial event is recorded in an immutable
> **ledger**.

## Purpose & data model
After disbursement the credit enters servicing. Three screens cover it:

```
Освоение (Phase 6) ──> generates a repayment schedule
   │
   ├─ Платеж (payment)        — money received, split: ОД / проценты / штраф / комиссия
   ├─ Резерв (loan reserve)   — provisioning on the unused/outstanding amount
   └─ LoanLedger              — append-only log of every accrual / payment / write-off event
```

## Payments — `/payments` (Платеж)
Header: **Платежи**. Toolbar: **Обновить** · **Создать** · **Изменить** ·
**Удалить** · **Добавить условие поиска**. «Изменить»/«Удалить» gated on selection.
16 rows on test env. Detail opens at `/payments/{id}` (single form, no tabs).

Columns: **Статус** · **`Payment uuid`** (sic) · **`Payment version`** (sic) ·
**Статус платежа** · **Код транзакции** · **Номер платежа** · **Дата платежа** ·
**Общая сумма платежа** · **Сумма основного долга** · **Сумма процентов** ·
**Сумма штрафа (пени)** · **Сумма комиссии** · **Валютный** · **Курс валюты** ·
**Описание** · **Дата записи**.

> A payment is split into principal / interest / penalty / commission — e.g.
> Общая 4 615,00 = ОД 3 782,00 + проценты 833,00.

> 🟠 The grid exposes two **internal technical columns** — `Payment uuid` (entity
> UUID) and `Payment version` (optimistic-lock version) — that should not be
> user-visible (P7-02).
> 🟡 The **«Статус»** column shows the raw code **`1`** for every row, redundant
> with **«Статус платежа»** which carries the human value («Оплачен»). One of the
> two is confusing/duplicate (P7-03).

## Reserves — `/loan-reserves` (Резерв)
Header: **Резерв**. Toolbar: **Обновить** · **Добавить условие поиска** only — **no
Создать / Изменить / Просмотр / Удалить**. Double-clicking a row opens nothing
(stays on the list) — there is **no detail view** for a reserve record (P7-04).

Columns (raw entity headers, not localized): **`Loan`** (borrower) · **№** ·
**Дата** · **`Loan amount`** · **`LoanReserve.disbursedAmount`** ·
**`LoanReserve.unusedAmount`** · **`LoanReserve.reserveRate`** ·
**`LoanReserve.reserveAmount`**.

> Reserve math is consistent: unused 200 000 × reserveRate 10 % = reserveAmount
> 20 000. The numbers are right; only the labels (and the missing detail view) are
> the problem.

## Loan ledger — `/loan-ledgers` (LoanLedger)
Header: **LoanLedger** (untranslated page title). Toolbar: **Обновить** ·
**Удалить** · **Добавить условие поиска**. Append-only-style event log; no row
detail (read-only register).

Columns: **Кредит** · **Событие** · **Дата наступления события** · **№** ·
**Описание** · **Флаг** · **Основная сумма** · **Процент** · **Пеня** ·
**Списание** · **Комиссия**.

> The **«Событие»** column is **inconsistently localized**: some rows show the raw
> enum constant **`EventType.PRINCIPAL_ACCRUAL`**, others English **`Interest
> accrual`** / **`Payment`**, others Russian **`Пеня`** (P7-01). The **«Флаг»**
> column surfaces a raw internal value (`-1`).
> 🟡 The ledger is an accounting event log yet exposes a **«Удалить»** action;
> a financial register should be append-only / audited, not row-deletable (P7-05).

> Descriptions are good Russian and traceable: «Начисление ОД по графику освоения
> #7, платеж #1» — i.e. the ledger ties each accrual back to the disbursement
> schedule from Phase 6.

## QA summary
Defects logged in `notes/qa-findings.md`: **P7-01 … P7-05**. Recommendations in
`TODO.md`: **P7-R1 … P7-R5**.

| ID | Sev | One-liner |
|---|---|---|
| P7-01 | 🟠 | Localization leak across all 3 servicing grids — raw `Entity.property` headers and `EventType.*` enum constants / English mixed with Russian. |
| P7-02 | 🟠 | Платежи grid exposes internal `Payment uuid` + `Payment version` columns. |
| P7-03 | 🟡 | Платежи «Статус» shows raw code `1` for every row, redundant with «Статус платежа». |
| P7-04 | 🟡 | Резерв has no detail view and no Создать/Изменить/Просмотр — only filter; rows open nothing. |
| P7-05 | 🟡 | LoanLedger (accounting event log) offers «Удалить» — should be append-only / audited. |
