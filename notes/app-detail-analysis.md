# Application Detail Page — Tab-by-Tab Analysis

> Screen: `/loan-applications/{id}` (inspected on **id 28 → «Заявка - 60»**, status **Одобрено**)
> Test env: https://fkftest.okmot.kg/ · Inspected 2026-06-19 (read-only Playwright walk)
> Component dumps: `.auth/app-detail-tabs.json`, `.auth/app-detail-geo.json`
> Screenshots: `.auth/app-detail-tab-0..8-*.png`

The detail screen is a **modal-style editor**: a fixed header (subject + status), a
horizontal **tab bar of 9 tabs** (scrolls with chevrons), and a sticky footer with
**OK / Отмена**. The same 5 header fields repeat on every tab.

## Persistent header (all tabs)
| Field | Value (sample) | State | Note |
|---|---|---|---|
| Субъект | `01103199710105 - Финансово-кредитный фонд…` | read-only | borrower/subject |
| Номер документа | `Заявка - 60` | read-only | display number ≠ URL id (28) |
| Статус заявки | `Одобрено` | read-only | main status track |
| Статус залоговой комиссии | _(empty)_ | read-only | empty — no collateral commission ran |
| Запрашиваемая сумма | `200 000,00` | **editable (rw)** | ⚠ stays editable on an approved app |

Status track (stepper on tab 0): **Подача → На рассмотрении → Одобрена → Регистрация кредита**.

---

## Tab 0 — Общая информация
Three labelled sections side by side. Almost everything read-only.

**Данные заявителя:** ИНН · Номер телефона `+996…` (**editable**) · Адрес.

**Условия кредита заемщика** (requested): Запрашиваемая сумма `200 000,00` · Запрашиваемый
срок `12` · Кредитная программа `тест1` · Льготный период (осн. сумма / начисление % / %) ·
Дополнительная информация `ртапр` · Дата подтверждения кредитных документов · Дата
подтверждения залоговых документов.

**Условия кредита, одобренные комиссией** (approved): Сумма `200000,00` · Срок `12` ·
Годовая ставка % `12,00` · Процент за резерв `0` · Периодичность платежей _(empty)_ ·
Метод погашения кредита _(empty)_ · День платежа `10` · Обработка выходных _(empty)_ ·
Льготный период ×3 `0` · Комментарий.

Two parallel credit-condition blocks (requested vs commission-approved) is good design — clean
audit of what changed. But three `select`s (Периодичность / Метод погашения / Обработка
выходных) render **blank** even though the loan is approved and a schedule already exists.

---

## Tab 1 — График (payment schedule)
Grid: № платежа · Дата платежа · Сумма платежа · Основной долг · Проценты · Остаток до
платежа · Остаток после платежа. Buttons: **Построить график**, **Добавить строку**
(enabled), Изменить/Удалить строку (disabled until row select).

Sample row 1: `10.04.2026 · 16 666,67 · 16 666,67 · 0,00 · 200 000,00 → 183 333,33`.
Equal-principal, 12 months = 200k. **Проценты column = 0,00 on every row** despite 12 %
annual rate → interest not computed/persisted.

On an **Одобрено** application the schedule is still **mutable** (Построить график / Добавить
строку enabled).

---

## Tabs 2–4 — Document folders
Same widget three times: grid **Наименование · Файл · Дата загрузки · Размер файла**, each
required doc shown as a row with an inline **Загрузить** drop-zone; per-row
"Поле является обязательным" marks mandatory docs. **Изменить** disabled.

- **Документы заявителя:** Паспорт (лицевая), Паспорт (оборотная), Подписанное согласие — all marked **обязательное**, all **empty**.
- **Кредитные документы:** Справка о доходах, Паспорт (**обязательное**), Выписка из банка.
- **Залоговые документы:** Выписка из банка, Паспорт (**обязательное**).

Mandatory documents are **empty even though the application is approved**, and **Загрузить
is still enabled** post-approval → upload/required-doc gating not enforced against status.

## Tab 5 — Проектные документы
Grid: Наименование · Файл · Статус · Дата загрузки · Размер файла (empty). Buttons:
**Сгенерировать документ** (template generation, enabled) · Исключить / Изменить / Просмотр
(disabled until selection). Adds a "Статус" column the other doc tabs lack.

## Tab 6 — Кредитная комиссия
Decision log grid: **Сотрудник · Сотрудник · Тип решения · Примечание · Дата создания**.
Rows: `[admin] · НУРМАНБЕТ КЫЗЫ КАЛИНА · На рассмотрении · 30/03/2026 14:30` then
`… · Одобрено · 30/03/2026 14:31` — 1-minute gap between submission and approval.
**Two columns both headed «Сотрудник»** (col1 = login `[admin]`, col2 = ФИО) → header bug,
second should read ФИО/Должность. No Примечание captured on either decision.

## Tab 7 — Залоговая комиссия
Same grid, **empty** (no collateral-commission decision) — consistent with empty «Статус
залоговой комиссии» in header. Same duplicate «Сотрудник» header.

## Tab 8 — История (audit trail)
Grid: Дата · Заголовок · Детали · Автор. **Empty** — no lifecycle events logged for an
application that went Подача→Одобрено. Audit trail not populated.

---

## Findings (candidate, for qa-findings.md → Phase 3)
| # | Sev | Tab | Issue |
|---|---|---|---|
| 1 | 🟠 | header/всё | On an **Одобрено** application **Запрашиваемая сумма** and **Номер телефона** stay editable while everything else is locked — inconsistent edit-gating by status. |
| 2 | 🟠 | График | **Проценты = 0,00** on every schedule row despite 12 % annual rate — interest not calculated. |
| 3 | 🟠 | 2–4 | Mandatory documents (Паспорт, Согласие…) **empty on an approved app**; **Загрузить still enabled** post-approval → required-doc / status gating not enforced. |
| 4 | 🟡 | График | Schedule editable (Построить график / Добавить строку) after approval — should a locked loan's schedule be mutable? |
| 5 | 🟡 | 6,7 | Commission grid has **two columns both labelled «Сотрудник»** — second should be ФИО / Должность. |
| 6 | 🟡 | 0 | Approved-conditions selects (Периодичность платежей / Метод погашения / Обработка выходных) render **blank** though loan approved + schedule exists. |
| 7 | 🟡 | 8 | **История empty** — no audit events for a Подача→Одобрено lifecycle. |
| 8 | 🔵 | header | Display number «Заявка - 60» ≠ URL id 28; header status fields duplicated on all 9 tabs (vertical noise). |
