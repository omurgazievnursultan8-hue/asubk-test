# Phase 6 — Disbursement & tranches (Освоение и транши)

> Routes: tranches list `/sub-loans` · tranche detail `/sub-loans/{id}` (4 tabs) ·
> disbursements list `/disbursements` · disbursement detail `/disbursements/{id}`.
> Documented 2026-06-20 from test env (admin); inspected via
> `scripts/inspect/p6-probe.mjs` (route discovery) and `scripts/inspect/p6.mjs`.
> Sixth phase of the credit lifecycle: an issued loan (Phase 5) is split into
> **tranches** (субкредиты / sub-loans), and each tranche is drawn down through
> one or more **disbursements** (освоения) that generate the repayment schedule.

## Purpose & data model
An issued **кредит** (Phase 5) is not paid out in one lump. It is distributed as:

```
Кредит (loan, Phase 5)
  └─ Транш / субкредит (sub-loan)        — a slice of the approved amount to a borrower
       ├─ Условия (terms: rate, term, penalties, repayment order)
       ├─ График (repayment schedule for the tranche)
       └─ Освоение (disbursement)        — actual drawdown of cash under the tranche
            └─ График платежей (annuity schedule per disbursement)
```

- A tranche tracks **Одобренная сумма кредита** vs **Уже распределено по траншам**
  vs **Доступно к распределению** — so the sum of tranches must not exceed the
  loan's approved amount.
- A disbursement (Освоение) is the money actually released; it carries its own
  amount, term, rate, periodicity and a generated repayment schedule. A tranche
  tracks **Сумма субкредита** vs **Освоено** vs **Остаток к освоению**.

Two list screens live under **Приложение** (operations module): **Список Траншей**
(`/sub-loans`) and **Освоение** (`/disbursements`).

## Tranches list — `/sub-loans` (Список Траншей)
Header: **Список Траншей**. Toolbar: **Обновить** · **Создать** · **Изменить** ·
**Удалить** · **Добавить условие поиска** (filter). «Изменить»/«Удалить» gated on
row selection. 11 rows on test env.

Columns: **`SubLoan.amount`** (sic — raw entity property, not localized; should be
«Сумма транша») · **Заемщик** (ПИН/ИНН + name) · **Дата транша**.

> 🟠 The first column header is the untranslated entity field name `SubLoan.amount`
> instead of a Russian label (P6-01).

## Tranche detail — `/sub-loans/{id}`
Header: **Транш**. 4 tabs. Footer on every tab: **OK / Отмена**.

### Tab 1 — Общие данные
Read-only roll-up + the tranche slice:
- **Одобренная сумма кредита** (ro) · **Уже распределено по траншам** (ro) ·
  **Доступно к распределению** (ro) — e.g. 150 000 / 100 000 / 50 000.
- **ПИН/ИНН** (ro, borrower) · **Сумма субкредита** (editable) · **Дата транша**.

### Tab 2 — Условия
Full terms form: **Статус** (e.g. Active) · **Начало действия** (date-time) ·
**Срок** · **Процентная ставка** · **Периодичность платежа** (Ежемесячно) ·
**Тип начисления процентов** (Аннуитет) · **Валюта** (KGS) · **Метод погашения
кредита** (Аннуитетный) · **День платежа** · **Обработка выходных** (Переносить на
следующий рабочий день) · grace periods (**Льгота по осн. долгу / по начислению
процентов / по уплате процентов, мес.**) · penalties (**Штраф по осн. долгу**,
**Штраф по процентам**, **Вид штрафа …** Фиксированная, **Лимит штрафов**, **Дата
лимита штрафов**) · **Метод расчёта дней** (календарный 365) · **Очередность
погашения** («Основная сумма, проценты, ш<u>р</u>афы» — typo, P6-03).

### Tab 3 — График
Summary (ro): **Кол-во платежей** · **Основной долг** · **Проценты** · **Всего
платежей**. Button **Пересчитать график**. Grid: № · Дата платежа · Общая сумма ·
Основной долг · Проценты · Статус.

> On the inspected tranche (`/sub-loans/1`, Status = Active, Срок 24, ставка 10%)
> this tab is **empty** — Кол-во платежей 0, all sums 0.00, grid blank — even
> though a disbursement with a full schedule exists beneath it (P6-02). The
> schedule is not auto-generated; it appears to require a manual «Пересчитать
> график».

### Tab 4 — Освоение
The disbursements made under this tranche.
- Roll-up (ro): **Сумма субкредита** · **Освоено** · **Остаток к освоению**
  (e.g. 100 000 / 50 000 / 50 000).
- Selected disbursement (ro): **Номер освоения** · **Дата освоения** · **Сумма** ·
  **Срок** · **Годовая процентная ставка** · **Периодичность платежей** ·
  **Примечание**.
- Grid: № · Дата освоения · Сумма · Валюта · Срок · Годовая ставка.
  Toolbar: **Добавить · Изменить · Просмотр · Удалить**.

## Disbursements list — `/disbursements` (Освоение)
Header: **Освоение**. Toolbar: **Создать** · **Изменить** · **Удалить** ·
**Добавить условие поиска**. «Изменить»/«Удалить» gated on row selection.

Columns: **Сумма** · **Дата освоения** · **Срок** · **Годовая процентная ставка** ·
**Периодичность платежей** · **Метод начисления процентов** · **Номер освоения** ·
**Примечание**.

## Disbursement detail — `/disbursements/{id}`
Header: **Освоение**. Single form (no tabs). Footer: **Пересчитать график / OK /
Отмена**.

Fields: **`Disbursement.subLoan`** (sic — raw entity label, ref picker to the parent
tranche; should be «Транш», P6-01) · **Сумма*** · **Дата освоения*** · **Срок** ·
**Годовая процентная ставка** · **Периодичность платежей** (Ежемесячно) · **Метод
начисления процентов** (Аннуитет) · **Валюта** (KGS) · **Номер освоения** (ro) ·
**Примечание**.

Computed (ro): **Всего платежей** · **Сумма кредита** · **Сумма процентов** ·
**Регулярный платеж** · **Итоговая сумма платежей**.

Schedule grid: № платежа · Дата платежа · Сумма платежа · Основной долг ·
Проценты · Остаток до платежа · Остаток после платежа. **Пересчитать график**
regenerates it.

> ✅ Schedule math is correct: 50 000 @ 10 % / 24 mo annuity → Регулярный платеж
> **2 307,25**, Сумма процентов **5 373,92**, Итоговая сумма **55 373,92**. The
> disbursement level computes interest correctly — consistent with the loan-level
> check in Phase 5, and contra the app-level zero-interest defect noted in P3-R11.

## QA summary
Defects logged in `notes/qa-findings.md`: **P6-01 … P6-03**. Recommendations in
`TODO.md`: **P6-R1 … P6-R3**.

| ID | Sev | One-liner |
|---|---|---|
| P6-01 | 🟠 | Raw entity labels leak: `SubLoan.amount` (tranches list), `Disbursement.subLoan` (disbursement detail) — missing i18n keys. |
| P6-02 | 🟡 | Tranche «График» empty (0 / 0.00) for an Active tranche with terms and a disbursement schedule beneath — schedule not auto-generated; empty 0.00 summary misleads. |
| P6-03 | 🔵 | Typo «ш**р**афы» → «штрафы» in Условия → Очередность погашения. |
