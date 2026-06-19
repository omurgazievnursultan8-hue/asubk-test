# Phase 4 — Borrower (Заёмщик)

> Route: `/loan-applicants` · Documented 2026-06-18 from test env (admin).
> Fourth phase of the credit lifecycle: the **borrower** — the subject (party)
> behind an application/loan. A borrower aggregates identity, contacts, the loans
> held, documents, history, and a **compliance/risk check panel**.

## Purpose
A borrower (Заёмщик / loan-applicant) is a **party that participates in lending** —
an individual (Физ. лицо) or legal entity (Юр. лицо). The record carries identity
(ИНН, ФИО/Наименование), industry, borrower group, contacts/address, the loans
held (count + total), documents, a change history, and a **«Результаты проверок»**
risk dashboard used to vet the borrower before a loan is granted.

This module continues the mature trend — it adds a compliance/risk check panel on
top of the now-familiar tabbed detail page.

## List view — `/loan-applicants`
Toolbar: **Добавить условие поиска** (filter) · **Изменить** · **Удалить**.

> Note: there is **no «Создать»** and **no «Просмотр»**. Borrowers are not created
> from this screen — a borrower appears to be derived from the application's
> **Субъект** (party). Inspecting one forces edit mode (`/loan-applicants/{id}`),
> the same view-action gap seen in P2-04 / P3-02. Whether «Создать» *should* exist
> here (vs strictly deriving borrowers upstream) needs domain confirmation.

Columns (sortable): **ИНН** · ФИО/Наименование · **Тип** (Физ. лицо / Юр. лицо)
· Отрасль · **Статус** (observed: Активный). Filter exposes `status` and
`party.industryDirection`.

## Detail / edit page — `/loan-applicants/{id}`
Header: ФИО/Наименование · ИНН · Тип · **Статус** (Активный) ·
**Кредиты** (count + total sum, e.g. «1 активных кредитов на сумму 188 000,00») ·
Последнее обновление.

Tabs: **Основная информация** · Кредиты · Документы · История · Контакты.

**Основная информация → Данные заёмщика → Основные данные:**
| Field | Control |
|---|---|
| ФИО/Наименование | text |
| ИНН | text |
| Номер телефона | text |
| Отрасль | lookup |
| Группа заёмщика | lookup |
| Адрес: Область · Район · Город · Улица · Дом · Помещение | text fields |

> Same grey "disabled-look" field styling as Phases 1–3 (P4-02).

### Результаты проверок (risk / compliance dashboard)
A right-hand panel of vetting checks, each with a status icon:
- **Чёрный список** — «Заёмщик отсутствует в чёрных списках» (✓)
- **Кредитная история** — «Положительная кредитная история» (✓)
- **Действующие кредиты** — «Нет активных кредитов» · Количество кредитов: 1 ·
  Общая сумма: 188 000,00 (✓)
- **Просрочки** — «Просроченных платежей не обнаружено» (✓)
- **Скоринговая система** (✓)
- **Лимит задолженности** (✓)

> This is a strong feature — a single vetting view. Two issues surfaced on
> record 11: a **count inconsistency** (header «1 активных кредитов» vs check
> «Нет активных кредитов» while «Количество кредитов: 1») → P4-R3; and a
> validation toast **«Заполните поле "ID в системе"»** on open, pointing at a
> required field not visible in the form (scoring-system integration id?) → P4-R4.

## Open questions (need domain confirmation)
- **Borrower creation:** is the missing «Создать» intentional (borrowers derived
  strictly from the application's Субъект / a party registry), or a gap? → P4-R1.
- **Risk checks data source:** are «Результаты проверок» **live integrations**
  (blacklist, credit bureau, scoring engine, debt-limit calc) or static
  placeholders? What refresh cadence, and **which checks block** a loan? → P4-R5.
- **«ID в системе»:** what system, is it mandatory, and why is it required but not
  shown on the form? → P4-R4.
- **Статус** set: only «Активный» observed — what are the other states and
  transitions (blocked / inactive / blacklisted)?

## Recommendations (logged 2026-06-18, draft for review)
Per-phase counter **P4-R1…**. Legend: ✅ confirmed · ❓ to verify.

| # | Priority | Recommendation | Rationale | Status |
|---|---|---|---|---|
| P4-R1 | 🟡 Low | **Add «Просмотр» and «Создать» to borrowers** (agreed 2026-06-18). **«Просмотр» = a separate read-only detail page** (like P2-R4 / P3-R2 / Phase 1 R6): toolbar button + double-click → readonly, «Изменить» from the view. **«Создать» is wanted** — manual borrower registration (linked to a party/registry), form modelled on the «Основная информация» tab — in addition to borrowers auto-appearing from an application's Субъект. Align the toolbar with the other modules (Создать/Просмотр/Изменить/Удалить). | Inspecting forces edit mode; the toolbar is inconsistent with sibling screens and offers no manual create. | ✅ no view/create action (P4-01) |
| P4-R2 | 🟡 Low | **Field visual semantics — borrower card only** (agreed 2026-06-18). **Scope: the «Основная информация» tab** of the edit/detail card (where grey styling is confirmed); the new «Создать» form is out of scope here. Reuse the shared design-system field component (P1-R6/P2-R1): required → white + border + red `*`; optional → white + border; read-only → grey. Kept as a separate per-phase task for tracking. | Grey "disabled-look" fields again; recurs P1-01/P2-01/P3-01. | ✅ confirmed (P4-02) |
| P4-R3 | 🟠 Medium | **Fix active-loans count inconsistency** (agreed 2026-06-19) — the header says «1 активных кредитов на сумму 188 000» while the check panel says «Действующие кредиты: Нет активных кредитов» (with «Количество кредитов: 1»). **Single source:** one computed «active loans» figure (by loan status — open/unpaid) feeds both the header and the «Результаты проверок» panel, so they can't diverge. **Separate the terms explicitly:** *active/действующие* = currently open (unpaid); *всего кредитов* = full history — distinct labels in header vs panel so «1» (total) isn't read as active count. | Contradictory active-loan figures undermine the vetting dashboard's trust. | ✅ confirmed (P4-03) |
| P4-R4 | 🟠 Medium | **«Заполните поле "ID в системе"»** (agreed 2026-06-19) — opening the borrower raises a validation toast for a required field that isn't visible on the form, which would block save. **«ID в системе» is a technical id** (scoring / external integration), not user-entered: **auto-fill it from the system/integration, remove it from the form, and drop the user-facing required validation** so the toast never fires. Document which system/integration issues the id. | A required-but-hidden field is an un-fixable error for the user. | ✅ observed on rec. 11 (P4-04) |
| P4-R5 | 🟠 Medium | **Define the risk-check dashboard semantics** (agreed 2026-06-19: left fully open — no default proposed) — for each check (Чёрный список, Кредитная история, Действующие кредиты, Просрочки, Скоринговая система, Лимит задолженности) ask the customer: the **data source** (live integration vs computed vs manual), refresh cadence, and whether it is **blocking** for loan approval or advisory. Do not pre-assign a blocking/advisory split — collect the customer's answers first. | The vetting panel exists but its authority over the decision and its data provenance are undefined. | ❓ domain confirmation (P4-05) |

## Notes (2026-06-18)
- Borrowers mix **Физ. лицо** and **Юр. лицо**; legal entities link to the
  corporate registry (Phase «Корпоративное управление»).
- The risk-check dashboard is the standout feature of this phase — propagate the
  pattern (single vetting view) where borrower risk matters downstream (issuance,
  collection).
- Stack: **Jmix on Vaadin**, consistent with Phases 1–3.
