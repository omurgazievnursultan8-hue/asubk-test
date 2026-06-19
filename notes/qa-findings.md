# QA Findings — Credit Module End-to-End Check

> Running defect log from the phase-by-phase walkthrough of the credit lifecycle
> on the test env (https://fkftest.okmot.kg/). Newest phase appended as we go.
>
> **Severity:** 🔴 blocker · 🟠 major · 🟡 minor · 🔵 cosmetic/UX

## Format
Each finding:
- **ID** — `Pn-NN` (phase number, sequence)
- **Screen** — route / label
- **Severity** — 🔴/🟠/🟡/🔵
- **Steps** — how to reproduce
- **Expected vs. Actual**
- **Notes**

---

## Phase 1 — Government decision (Решение правительства)
Overall: ✅ core flow works; required-field validation correct.

- **P1-01** — `/gov-decisions/new` — 🔵 cosmetic
  - **Issue:** The **Код** field is rendered with the grey/disabled styling used
    for read-only fields (e.g. Статус), but it is in fact editable and *required*.
  - **Expected:** Editable required fields should look editable (white), not
    disabled, so users know to fill them.
  - **Actual:** Looks disabled; only revealed as required after an empty submit
    highlights it red.

- **P1-02** — `/gov-decisions` — 🟡 minor (needs domain confirmation)
  - **Issue:** **Код** is required on create, yet some existing rows display no
    code value. Either historical data predates the rule, or code should be
    system-assigned (not a manual required field).
  - **Action:** confirm intended behavior with domain owner.

- **P1-03** — `/gov-decisions` — 🟠 major — _verified 2026-06-17_
  - **Issue:** **Отклонить** (reject) executes immediately with **no reason
    prompt and no confirmation dialog**. The record jumps straight to **Закрыт**
    (closed) and the action is **irreversible from the UI** — Одобрить and
    Изменить both become disabled on a closed record.
  - **Expected:** A destructive, terminal action should confirm intent and
    capture a rejection reason (audit trail); ideally be reversible by an admin.
  - **Actual:** One click silently closes the decision, no reason recorded.
  - **Repro:** select an "На стадии рассмотрения" record → click Отклонить.
  - **Note:** discovered by accidentally rejecting test record **РКМ 508-р**
    during R2 verification — it is now Закрыт and could not be restored via UI.

- **P1-04** — `/gov-decisions` — 🟠 major — _verified 2026-06-17_
  - **Issue:** **Дата решения** accepts **future dates**. The date picker offers
    future years (2027–2029+) and a free-typed `31.12.2030` is accepted into the
    field. (Backend save-time validation not tested to avoid creating junk data.)
  - **Expected:** A government decision cannot be dated in the future.
  - **Actual:** No future-date restriction in the picker or input.

- **P1-05** — `/gov-decisions` — 🟡 minor — _verified 2026-06-17_
  - **Issue:** **Удалить** (delete) stays **enabled** on approved and closed
    records. Edit IS correctly guarded (Изменить disabled once approved/closed),
    but delete is not blocked at the button level.
  - **Action:** confirm whether delete is blocked server-side when the decision
    is referenced by a loan program (referential integrity). Not tested to avoid
    destroying referenced data.

### UX / design — decision detail page (страница решения)
> Holistic design review of the single-decision view. Several items overlap with
> the functional defects above; cross-referenced where they share a root cause.

- **P1-06** — decision detail — 🔵 UX — _field affordance_
  - **Issue:** Form fields don't visually signal their semantics. Editable +
    required fields (e.g. **Код**) use the same grey styling as read-only fields
    (e.g. **Статус**), so users can't tell what to fill vs. what is system-set.
  - **Recommendation:** Editable-required → white bg + border + `*` marker;
    read-only → grey. Make the input style carry the meaning.
  - **Cross-ref:** root cause of **P1-01**.

- **P1-07** — decision detail — 🔵 UX — _action priority & destructive safety_
  - **Issue:** Actions (**Одобрить / Изменить / Отклонить / Удалить**) share one
    row and one visual weight, so the primary action and the irreversible ones
    look identical. There is no separation or confirmation for destructive ones.
  - **Recommendation:**
    - One **primary** (filled) action driven by current status (e.g. Одобрить
      for «На стадии рассмотрения»).
    - **Отклонить / Удалить** → red outline, visually separated, with a
      mandatory confirmation modal + reason field.
    - Disable **Удалить** on Одобрен/Закрыт records too.
  - **Cross-ref:** supports **P1-03** (silent reject) and **P1-05** (delete not
    guarded).

- **P1-08** — decision detail — 🔵 UX — _status visibility_
  - **Issue:** **Статус** — the most decision-relevant field — is rendered as a
    plain field among the others and is easy to miss.
  - **Recommendation:** Surface status as a large coloured badge next to the
    title: На стадии рассмотрения → amber, Одобрен → green, Закрыт → grey/red.

- **P1-09** — decision detail — 🔵 UX — _field grouping_
  - **Issue:** Fields (Код, Дата решения, Наименование, Детали, Статус) are
    presented as one flat list with no grouping, making the page hard to scan.
  - **Recommendation:** Group into cards — *Identification* (Код, Дата решения),
    *Content* (Наименование, Детали), *Service* (Статус, history).

- **P1-10** — decision detail — 🔵 UX — _audit trail / history_
  - **Issue:** No visible history of who changed status and when. For government
    decisions an audit trail is essential.
  - **Recommendation:** Add a "who / when / which action" timeline in a sidebar.
  - **Cross-ref:** reinforces the audit-trail need raised in **P1-03**.

- **P1-11** — decision detail — 🔵 UX — _future-date affordance_
  - **Issue:** **Дата решения** date picker offers future years and accepts
    free-typed future dates with no UI restriction.
  - **Recommendation:** Cap the picker/input at today (plus server-side
    validation). A decision cannot be dated in the future.
  - **Cross-ref:** UI side of **P1-04**.

---

## Phase 2 — Loan program (Кредитная программа)
Overall: ✅ core flow works; required-field validation correct (empty OK → toast
«Заполните все обязательные поля!», 7 Tab-1 fields highlighted, no record saved).
Route `/loan-programs`; create form is a 9-tab wizard `/loan-programs/new`.
Stack confirmed as **Jmix on Vaadin** (`jmix-value-picker`).

- **P2-01** — `/loan-programs/new` — 🟡 minor — _field affordance (recurs P1-06)_
  - **Issue:** Across all 9 wizard tabs (~40 fields) every field uses the grey
    "disabled-looking" styling. Required, optional and read-only fields are
    visually identical; required fields are only revealed (red) **after** pressing
    OK on an empty form. No `*` markers.
  - **Expected:** Editable-required → white bg + `*`; read-only → grey.
  - **Cross-ref:** same root cause as **P1-01 / P1-06**. → P2-R1.

- **P2-02** — `/loan-programs/new` Tab 1 — 🟠 major — _date validation_
  - **Issue:** **Дата с** / **Дата по** pickers have no `min`/`max` and no
    client-side ordering check — **Дата по** earlier than **Дата с** is not
    blocked, and there is no bound to the linked gov-decision's validity.
  - **Expected:** Enforce **Дата по ≥ Дата с** (client + server); ideally bound
    both within the parent decision's validity window. (Future dates ARE valid
    for a program, so this is ordering/consistency, not a future-date ban.)
  - **Note:** cross-field/server behavior not saved to avoid junk data; UI shows
    no restriction. → P2-R2.

- **P2-03** — `/loan-programs/new` footer — 🟡 minor — _dual save buttons_
  - **Issue:** Footer has both **OK** and **Сохранить** with no explained
    difference. Tab 7 states selected templates "сохранятся после нажатия кнопки
    «Сохранить»", implying OK does **not** persist them — a data-loss trap.
  - **Expected:** One clear primary action, or relabelled buttons
    («Сохранить черновик» vs «Готово»). → P2-R3.

- **P2-04** — `/loan-programs` list — 🟡 minor — _no view action_
  - **Issue:** List toolbar has only **Создать / Изменить / Удалить** — no
    **«Просмотр»**. Inspecting a program forces edit mode (risk of accidental
    change). Inconsistent with Phase 1 (gov-decisions has Просмотр).
  - **Expected:** A read-only view (could reuse the Предпросмотр tab). → P2-R4.

- **P2-05** — `/loan-programs` — 🟠 major — _undefined status workflow_
  - **Issue:** All 9 records are **Черновик**; the list has **no Одобрить /
    Отклонить**. The only transition is **«Отправить на подтверждение»** on the
    Предпросмотр tab. The full status set, post-submit transitions and the
    approving role are not discoverable in the UI.
  - **Expected:** A defined lifecycle (statuses, transitions, roles) before
    programs are referenced by applications/loans. Align with Phase 1 R7. → P2-R5.

- **P2-06** — `/loan-programs/new` — 🔵 UX — _large-form error feedback_
  - **Issue:** On empty submit the toast is generic («Заполните все обязательные
    поля!») and names neither the tab nor the fields. All required fields are on
    Tab 1 today, but a required field on another tab would be invisible to the
    user, who lands on a passive toast with no navigation.
  - **Recommendation:** Badge tabs containing errors, focus the first invalid
    field, and list the missing fields. → P2-R6.

- **P2-07** — `/loan-programs` delete — 🟠 major — _verified 2026-06-17_
  - **Issue:** Deleting a program that is referenced fails with a raw
    **«Непредвиденная ошибка»** dialog showing the untranslated technical
    exception: `DeletePolicyException: Unable to delete LoanProgram because there
    are references from GovDecision`. A business rule (referential delete-guard)
    is surfaced as an "unexpected error" with a developer-facing English message.
  - **Expected:** Catch `DeletePolicyException` → a friendly localized message
    («Нельзя удалить: на программу есть ссылки …»). Server-side guard existing is
    good; only its presentation is wrong.
  - **Possible bug:** a **freshly created** program (test record ID 24) with no
    downstream usage is undeletable, blamed on "references from GovDecision" —
    yet the program references the decision, not vice-versa. Delete-policy
    direction / back-reference should be verified by dev. → P2-R8.
  - **Repro:** create a program linked to a gov-decision → list → select →
    Удалить → confirm «Да».
  - **Note:** discovered while cleaning up the OK-vs-Сохранить test record;
    because of this guard, test record **ID 24 remains** in the test env (10 rows;
    pending the planned full data wipe). → P2-R7.
  - **Cross-ref:** the server-side guard is exactly what Phase 1 R4 asked for on
    decisions; here the gap is the error presentation, not the guard.

- **P2-08** — `/loan-programs/new` Tab 1 «Решение правительства» picker — 🔴 critical — _verified 2026-06-19_
  - **Issue:** The gov-decision lookup is **not enforced to approved decisions.**
    The picker opens the full gov-decisions lookup screen with a **removable**
    default filter chip «Статус = Одобрен». The status filter is **only a default
    UI filter** — clear/change the chip inside the picker and **all** decisions
    appear, including **«На стадии рассмотрения»** and **«Закрыт»**. Such a
    decision can be selected, «Выбрать», and the loan program **saves with no
    server-side validation** that the linked decision is approved.
  - **Expected:** A loan program must only reference an **approved/active**
    gov-decision. Enforce on the **server** (reject save when the linked decision
    is not approved), not just via a default UI filter. The picker should hide
    (not merely default-filter) non-approved decisions, or block selection.
  - **Repro:** `/loan-programs/new` → Tab 1 → «Решение правительства» ••• →
    in the lookup dialog remove the «Статус = Одобрен» filter chip (X) →
    grid grows from **7 → 13 rows** (Одобрен · На стадии рассмотрении · Закрыт) →
    pick a «На стадии рассмотрения» decision → «Выбрать» → fill required fields →
    Сохранить → **saves successfully**.
  - **Evidence:** verified via Playwright; picker default `size=7` (Одобрен only),
    after clearing chip `size=13` with the 6 non-approved decisions selectable.
    Same removable default filter also sits on the `/gov-decisions` list itself.
  - **Note:** the picker is the full lookup *screen* — it also exposes
    Создать/Изменить/Удалить/**Одобрить**/**Отклонить** from inside the program
    form, which is broader access than a value-picker should grant. → P2-R9.

### Behaviour confirmed via test record (2026-06-17)
- **«Сохранить» = save & stay** (commits, keeps the editor open; URL → record id,
  toast «…успешно сохранена»). **«OK» = save & close** (commits, leaves the
  editor). Both persist data — standard Jmix maker pattern, not a data-loss trap.
  After OK the app navigates to `/` (home) rather than back to the programs list.
  → P2-R3 (re-scoped to labels/semantics, not data loss).

---

## Phase 3 — Application & commission (Заявка + Комиссия по заявкам)
Overall: ✅ the **most mature** module so far — defined status stepper, separated
voting roles (4-eyes), inline required-field validation, and a read-only view
mode on the commission screen. Findings are lighter and mostly about
cross-screen consistency + a few governance items to confirm.
Routes `/loan-applications` (17 rows) and `/loan-application-commissions`.

- **P3-01** — `/loan-applications` create dialog — 🟡 minor — _field affordance (recurs P1-06/P2-01)_
  - **Issue:** Editable fields (Адрес, Номер телефона, Источник финансирования)
    reuse the grey "disabled-look" styling; required/optional/read-only are
    visually identical.
  - **Note:** Required fields here DO show a red `*` + inline «Поле является
    обязательным» — better than the program form. Only the grey base styling
    remains. → P3-R1.

- **P3-02** — `/loan-applications` list — 🟡 minor — _no view action; cross-screen inconsistency_
  - **Issue:** Toolbar has Создать / Изменить / Удалить / Отправить в комиссию /
    Отправить в залоговую комиссию but **no «Просмотр»** — inspecting forces edit
    mode (`/loan-applications/{id}`, no `?mode=readonly`).
  - **Inconsistency:** the sibling **Комиссии по заявкам** screen DOES have
    «Просмотр» + a `?mode=readonly` view. Two screens in the same phase behave
    differently. → P3-R2 (and recurs P2-04 / Phase 1 R6).

- **P3-03** — `/loan-applications` + commission dates — 🟠 major — _verified 2026-06-18_
  - **Issue:** «Запрашиваемая сумма» / «Запрашиваемый срок» number fields carry
    **no min/max/step**, and the commission date picker has **no min** — the
    client blocks neither 0/negative numbers nor past deadlines.
  - **Expected:** сумма > 0, срок > 0; requested amount/term within the linked
    program's configured bounds (Phase 2); commission Крайний срок ≥ today, Дата
    заседания ≥ creation. Client + server.
  - **Note:** the application has no date range of its own (only a numeric term),
    so the program-bounds check replaces the "validity window" idea. Server-side
    not tested (no junk data). → P3-R3.

- **P3-04** — `/loan-application-commissions` — ❓ to verify — _commission governance_
  - **Issue:** The voting machinery exists (Прогресс голосования, Члены комиссии
    with Роль Член/Председатель, per-member Решение + Крайний срок, Финальное
    решение, Протокол), but the governance rules are not visible in the UI:
    - **Quorum** to close voting (the `0/4` / `1/4` tally implies a fraction rule).
    - How **«Финальное решение»** is derived — auto from member votes or manual,
      and whether it can override the tally.
    - **4-eyes:** whether the application's author can also vote on its commission.
    - Ordering/relationship of the **credit** vs **collateral (залоговая)**
      commissions.
  - **Action:** confirm with domain owner. → P3-R4.

### Positive patterns to propagate (2026-06-18)
- **Inline required-field validation** (red `*` + «Поле является обязательным») on
  the application form is exactly what P2-R6 requested — reuse it for programs.
- **Status stepper** (Подача → На рассмотрении → Одобрена → Регистрация кредита)
  is the lifecycle visualization P2-R5 wants for programs.
- **Separated voting roles + read-only «Просмотр»** on the commission screen are
  the 4-eyes (P2-R5) and view-mode (P2-R4) patterns the program module lacks.

---

## Phase 4 — Borrower (Заёмщик)
Overall: ✅ mature — tabbed detail page + a **«Результаты проверок»** risk/
compliance dashboard (blacklist, credit history, active loans, overdue, scoring,
debt limit). Route `/loan-applicants`. Two data-consistency bugs surfaced.

- **P4-01** — `/loan-applicants` list — 🟡 minor — _no view (and no create) action_
  - **Issue:** Toolbar has only Изменить / Удалить — **no «Просмотр»** (inspect
    forces edit mode) and **no «Создать»** (borrowers appear derived from the
    application's Субъект).
  - **Action:** add «Просмотр» (+ double-click → readonly); confirm whether
    «Создать» belongs here. Recurs P2-04/P3-02. → P4-R1.

- **P4-02** — `/loan-applicants/{id}` — 🟡 minor — _field affordance (recurs)_
  - **Issue:** Borrower form fields use the grey "disabled-look" styling; required/
    optional/read-only indistinguishable. Same root as P1-01/P2-01/P3-01. → P4-R2.

- **P4-03** — `/loan-applicants/{id}` — 🟠 major — _verified 2026-06-18_
  - **Issue:** The header shows «1 активных кредитов на сумму 188 000,00», but the
    risk panel's **Действующие кредиты** check says «Нет активных кредитов» (with
    «Количество кредитов: 1»). The two active-loan figures contradict each other.
  - **Expected:** header and check must agree; clarify *active* (open) vs *total*
    loan count. → P4-R3.

- **P4-04** — `/loan-applicants/{id}` — 🟠 major — _verified 2026-06-18 (rec. 11)_
  - **Issue:** Opening the borrower raises a toast **«Заполните поле "ID в
    системе"»** — a required field that is **not visible** on the form, which
    would block save.
  - **Expected:** surface the field (or make it optional); document what «ID в
    системе» is (scoring / external-integration id). → P4-R4.

- **P4-05** — `/loan-applicants/{id}` risk panel — ❓ to verify — _check semantics_
  - **Issue:** «Результаты проверок» (Чёрный список, Кредитная история,
    Действующие кредиты, Просрочки, Скоринговая система, Лимит задолженности) —
    unclear whether checks are **live integrations** or static, their refresh
    cadence, and which are **blocking** vs advisory for loan approval.
  - **Action:** confirm with domain owner. → P4-R5.
