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

- **P1-12** — `/gov-decisions` — 🟠 major — _verified 2026-06-20, `tests/government-decision/*` + inspection probes_
  - **Issue:** The decision list returns **only approved (`Одобрен`) records**.
    A newly created decision saves successfully (toast «Запись … успешно
    сохранена») with status **«На стадии рассмотрения»**, but it **never appears
    in the default list** — `vaadin-grid` reports `size = 7`, all 7 rows
    `Одобрен`, across repeated creates and after sort/scroll. No active filter
    chip is shown.
  - **Impact:** Records in review state are **unreachable from the default list**,
    so the **Одобрить / Отклонить** row-actions (and the whole maker/checker
    approval step) cannot be performed there. This blocked the automated approve/
    reject UI tests (`workflow.spec.js`, currently `describe.skip`).
  - **Open question for domain owner / dev team:** Is this a **persisted default
    filter** (status = Одобрен) on the list, an **approval queue handled on a
    separate screen**, or a **loader/visibility bug**? Confirm where pending
    decisions are reviewed and approved.
  - **Cross-ref:** gates verification of the workflow documented in
    `requirements/features/01-government-decision.md` (status lifecycle).

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
    field, and list the missing fields. → P2-R1.

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

- **P2-09** — `/loan-programs/new` Tab 1 reference-book pickers — 🟠 major — _field-by-field review with owner 2026-06-25_
  - **Issue:** Tab-1 dictionaries are polluted with test junk and **out of sync**
    with the values programs actually reference:
    - **Источник финансирования** — picker has `asdfasdf` (test junk) + `Бюджет`
      only; seed programs reference `Иностранные доноры` / `Собственные средства`,
      which are **missing from the dictionary** (programs show an unlisted source);
    - **Назначение кредита** («Цели кредита») — short categories mixed with 300+
      char project descriptions stuffed in as "goals";
    - **Отрасль** — duplicate `Питомниководство` (codes `NURSERY` and `1212`),
      junk codes (`5`, `7`, `zh-1`, `Liaz-1`, `1212`);
    - **Кредитная линия** — picker has `АРР, ФРР`; programs reference `АБР, МАР, ВБ`
      (missing from dictionary);
    - **Вид счёта погашения** — `123`, `321` (test junk) + one real value.
  - **Expected:** Clean junk; backfill values that existing programs reference so
    no program points at an unlisted entry; long descriptions belong in the
    program's «Краткое описание», not in the shared goals dictionary. Dictionaries
    admin-curated only (no inline add from the program form). → P2-R13.

- **P2-10** — `/loan-programs/new` Tab 1 «Ответственные сотрудники» — 🟠 major — _owner 2026-06-25_
  - **Issue:** Field label is plural («сотрудник**и**») but the picker is
    **single-select**; the field is **optional**, yet the owner confirms it drives
    **application routing** and credit-curator assignment — an empty value leaves
    applications with no one to route to.
  - **Expected:** Make it **multi-select** and **required**. Curator-selection
    logic itself is out of scope here (future «модуль кураторства»). → P2-R12.

- **P2-11** — `/loan-programs/new` Tab 1 — 🔵 cosmetic — _owner 2026-06-25_
  - **Issue:** Terminology drift between field labels and picker dialogs:
    field «Назначение кредита» opens a dialog titled «Цели кредита» (two words for
    one thing); the «Решение правительства» picker hint says «одобренные», but the
    unified status is «Действует» (P2-R5).
  - **Expected:** One term everywhere — keep «Назначение кредита» (rename the
    dictionary); decision picker says «действующие». → P2-R13 / P2-R5.

- **P2-12** — `/loan-programs/new` Tab 2 «Суммы кредита» / «Сроки кредита» pickers — 🟠 major — _field-by-field review with owner 2026-06-25_
  - **Issue:** Both fixed-value reference-books are polluted with invalid test
    junk: «Суммы кредита» contains negatives («-100,00», «-5 000,00»); «Сроки
    кредита» contains negatives and absurd values («-2», «-8 020»). These are
    reused for future reporting/analytics (owner), so the dictionaries must be
    clean and admin-curated, not free-for-all.
  - **Expected:** Validated admin-managed reference-books — amounts strictly
    positive (2 decimals), terms strictly positive integers (months); purge the
    junk rows. Same pollution pattern as P2-09. → P2-R15.

- **P2-13** — `/loan-programs/new` Tab 2 amount/term inputs — 🟠 major — _owner 2026-06-25_
  - **Issue:** «Диапазон» mode min/max are plain text fields with no validation:
    no `0 < мин ≤ макс` check (min can exceed max), no numeric mask, negatives
    accepted. «Фиксированная» grid accepts duplicate values and shows them in
    add-order, not sorted. Term has no unit anywhere — «84 / 6 / 12» without
    «мес.», so days-vs-months is ambiguous.
  - **Expected:** Range = numeric with mask, `0 < мин ≤ макс` (equal allowed with
    a soft «consider Фиксированная» warning); fixed grid bans duplicates and
    auto-sorts ascending; term labelled explicitly in months («мес.» suffix),
    integers only; amounts 2 decimals with thousands separators + currency from
    Tab 1. → P2-R15.

- **P2-14** — `/loan-programs/new` Tab 3 «Маржа к плавающей ставке» — 🟠 major — _owner 2026-06-25, developer misunderstanding_
  - **Issue:** «Маржа к плавающей ставке» is implemented as a separate free-entry
    decimal, but per the owner the margin and the base «Значение фиксированной
    ставки» are the **same figure** — the dev team duplicated one concept into two
    fields. Result: an operator can type a margin that contradicts the base rate.
  - **Expected:** «Маржа» is **read-only**, mirrors the base rate — the fixed
    value(s) (show all chips if multi) or the «с…по» range — and reads together
    with the chosen benchmark, e.g. «от 1 до 5 + ЛИБОР 6м». Final borrower rate =
    base rate + benchmark. Floating is an **additive** surcharge on the base, not
    an alternative rate type. → P2-R16.

- **P2-15** — `/loan-programs/new` Tab 3 rate inputs & dictionaries — 🟠 major — _owner 2026-06-25_
  - **Issue:** «Диапазон» rate fields («с»/«по») are plain text with no `0 < с ≤
    по` check, no numeric mask, no «%» suffix. Fixed-rate combo is fed by a
    «регламентированный справочник ставок» holding a single value «10,00»
    (essentially empty); benchmark reference-book («Тип плавающей ставки», 8 rows)
    is unverified for junk. Fixed values shown as «10,00» without «%».
  - **Expected:** Range numeric with mask + «%», `0 < с ≤ по` (equal allowed →
    soft «consider Фиксированная» warning), no ceiling; rate & benchmark
    reference-books admin-curated, populated, junk-checked; «% годовых» suffix on
    displayed rates. → P2-R16.

- **P2-16** — `/loan-programs/new` Tab 4 penalty «Тип штрафной ставки» select — 🟠 major — _owner 2026-06-25_
  - **Issue:** The «Диапазон» option is mislabelled — its branch shows a floating
    benchmark picker + margin, NOT a «с…по» range, so «Диапазон» here means
    «Плавающая» and contradicts Tab 3's «Диапазон». Same margin-duplication as
    P2-14: «Маржа к плавающей штрафной ставке» is a separate free entry that should
    mirror the fixed penalty rate. Fixed penalty value is a free decimal while
    Tab 3 rates come from a reference-book (inconsistent).
  - **Expected:** Rename the option «Диапазон» → «Плавающая» across Tab 4 (both
    principal & interest blocks); «Маржа» is read-only, mirrors the fixed penalty
    rate (final penalty = benchmark + fixed penalty rate); fixed penalty rate is
    picked from an admin-curated reference-book («% годовых»); benchmark
    reference-books admin-curated + junk-checked. → P2-R17.

- **P2-17** — `/loan-programs/new` Tab 4 «Максимальный размер штрафа» & layout — 🟠 major — _owner 2026-06-25_
  - **Issue:** «Максимальный размер штрафа» (% от суммы кредита) sits in the
    right-hand «просрочка процентов» column, so its scope reads as interest-only,
    but it is meant to cap the **total** penalty. The header «Штраф за просрочку
    процентов» is duplicated (right column + full-width band), conflating two
    different blocks.
  - **Expected:** Move the cap to its own band «Ограничения штрафа» (applies to
    total penalty = principal + interest, computed off the **initial** loan
    amount); required, default **20**. With the cap relocated, the duplicate
    «Штраф за просрочку процентов» header disappears — layout becomes two columns
    [Осн. сумма | Проценты] + one band [Ограничения штрафа]. → P2-R17.

- **P2-18** — `/loan-programs/new` Tab 5 «Льготный период» — 🟡 minor — _owner 2026-06-25_
  - **Issue:** The three grace blocks «по основной сумме» / «по начислению
    процентов» / «по процентам» are easy to confuse — an operator cannot tell
    «начисление» (interest not accrued) from «проценты» (accrued but payment
    deferred) without explanation. Fixed-mode duration options [1,3,6,12,18,24]
    are hardcoded, not a reference-book; the «Диапазон» с/по fields have no `0 < с
    ≤ по` validation; «Условия предоставления» textareas are unbounded.
  - **Expected:** Tooltips/sub-labels clarifying each grace type; durations served
    from an admin-curated reference-book (months, integer, dedup, sort ascending);
    range numeric integers with `0 < с ≤ по` (equal → soft warning), no ceiling;
    «Условия предоставления» capped at 1000 chars with a counter, kept internal
    (NOT rendered in Просмотр). Empty-type select stays required with «— выберите
    —» default. → P2-R18.

- **P2-19** — `/loan-programs/new` Tab 6 «Периодичность платежей» / «Конкретные месяцы» — 🟠 major — _owner 2026-06-25_
  - **Issue:** «Конкретные месяцы платежей» is shown only when periodicity =
    Ежеквартально/Ежегодно, i.e. modelled as a dependent sub-field. Per the owner
    they are **independent alternatives**: a schedule is defined EITHER by a
    standard periodicity OR by an arbitrary set of calendar months (e.g. payments
    only in March + October), which no standard periodicity covers.
  - **Expected:** An explicit mode switch «Стандартная периодичность / По
    конкретным месяцам»; standard → Ежемесячно/Ежекв./Ежегодно; custom → multi
    pick of calendar months (Jan…Dec, any set, no count constraint); exactly one
    mode filled (required = one-of-two). → P2-R19.

- **P2-20** — `/loan-programs/new` Tab 6 day-count & «Тип расчёта процентов» — 🟠 major — _owner 2026-06-25_
  - **Issue:** «Метод расчёта дней» conflates two independent dimensions of a
    day-count convention into one field — the period-numerator (Финансовый 30 /
    Фактический) and the year-denominator (360 / 365 / Фактическая). Separately,
    «Тип расчёта процентов» («формула начисления») duplicates the day-count
    concept — there is no distinct meaning left for it.
  - **Expected:** Split into two reference-book fields «Метод расчёта дней в
    периоде» (numerator) + «База дней в году» (denominator), free pairing (no
    whitelist), default факт/365; **remove** «Тип расчёта процентов» as a
    duplicate. → P2-R19.

- **P2-21** — `/loan-programs/new` Tab 6 schedule fields — 🟡 minor — _owner 2026-06-25_
  - **Issue:** On the live stand none of the 9 Tab-6 fields carry required markers.
    «День месяца для платежа» is free text (accepts «45»/letters); «Обработка
    выходных дней» offers only two shift options (no «не переносить») and ignores
    public holidays; «Период между освоением и первым платежем» min/max are free
    text; the day-count / queue / etc. reference-books are unverified for junk.
  - **Expected:** Mark the core scheduling fields required (mockup already does);
    «День месяца» numeric 1–31 + «short month ⇒ last day» rule; rename «Обработка
    выходных дней» → «Обработка нерабочих дней», honour the KR public-holiday
    calendar, add a third option «Не переносить» as the **default** (Не переносить
    / на след. рабочий / на пред. рабочий); period min/max numeric integer days,
    `мин ≤ макс`, optional; «Метод погашения» default «Аннуитетный», auto →
    «Индивидуальный» when custom-months mode is used; queue scheme expanded in
    Просмотр; lookups admin-curated + junk-checked. → P2-R19.

- **P2-22** — `/loan-programs/new` Tab 7 doc grids & templates — 🟡 minor — _owner 2026-06-29_
  - **Issue:** «Обязательные» / «опциональные» doc grids dedupe only within a
    single grid — the same document can be added to both. Rows are not sorted.
    «Шаблоны договоров» uses a value-picker → read-only «Выбранные шаблоны»
    textarea + a «сохранятся после Сохранить» hint, a different pattern from the
    document grids (no rationale). The `docCredit`/`docColl`/`templates`
    reference-books are unverified for junk.
  - **Expected:** Add cross-grid dedupe (block adding a doc already present in the
    sibling grid) and auto-sort rows alphabetically (same rule as Tab 2). Replace
    the templates picker + textarea with a «+ Добавить / ✕ Исключить» grid
    identical to the document grids (multi-select, dedupe), apply the pick to the
    draft immediately and drop the save hint. Make the doc/template reference-books
    admin-curated + junk-checked. → P2-R20.

- **P2-23** — `/loan-programs/new` Tab 7 collateral-doc text & check-config — 🟡 minor — _owner 2026-06-29_
  - **Issue:** «Требования к оформлению залогового договора» is a single Russian
    textarea, whereas Tab 8 «Требования к залогу» captures ру/кырг/eng — an
    inconsistency. The textarea is unbounded. Under «Настройка проверки
    документов» all three fields (level / term-in-days / responsible) are req=null
    on the live stand, «Срок проверки» is free text, and the `checkLevel`/`staff`
    look-ups are unverified.
  - **Expected:** Keep the requirements field Russian-only for now (single language
    is the owner's decision), but bound it to 1000 chars + counter like the other
    textareas. «Уровень проверки» = single pick from admin-curated `checkLevel`;
    «Срок проверки» numeric positive integer days, optional; «Ответственный за
    проверку» = single staff member, a role distinct from Tab 1 «Ответственные
    сотрудники», from admin-curated `staff`; all three stay optional. → P2-R20.

- **P2-24** — `/loan-programs/new` Tab 8 collateral fields always visible — 🟠 major — _owner 2026-06-29_
  - **Issue:** On the live stand the Tab 8 layout is fixed — «Виды залога» and
    «Требования к залогу» render (all-checked dump) regardless of the «Требуется
    залоговое обеспечение» checkbox, and Tab 7 collateral documents likewise. A
    no-collateral program still shows and can capture collateral data.
  - **Expected:** Gate «Виды залога», «Требования к залогу» and the Tab 7
    collateral-document grids on the checkbox (mockup already does). Default the
    checkbox ON. → P2-R21.

- **P2-25** — `/loan-programs/new` Tab 8 «Виды залога» & requirements — 🟡 minor — _owner 2026-06-29_
  - **Issue:** «Виды залога» grid dedupes only within itself and is unsorted; its
    `collKind` look-up is unverified. «Требования к залогу» is captured in three
    languages (ру req / кырг req / eng opt) whereas the Tab 7 collateral-договор
    requirements are Russian-only — an inconsistency — and the textareas are
    unbounded.
  - **Expected:** «Виды залога» — dedupe + auto-sort (Tab 2 rule), `collKind`
    admin-curated + junk-checked; when collateral is ON the grid requires ≥1 row.
    Collapse «Требования к залогу» to a single Russian textarea (matches Tab 7),
    1000 chars + counter, optional. → P2-R21.

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

- **P3-04** — `/loan-application-commissions` — ✅ resolved — _commission governance_
  - **Issue:** The voting machinery exists (Прогресс голосования, Члены комиссии
    with Роль Член/Председатель, per-member Решение + Крайний срок, Финальное
    решение, Протокол), but the governance rules were not visible in the UI.
  - **Resolution (customer 2026-06-19):**
    - **Quorum:** no threshold — the **chairman** closes voting at any time;
      member votes advisory; the `0/4` / `1/4` tally is informational only.
    - **«Финальное решение»:** **manual** (chairman); each save → audit entry.
    - **4-eyes:** author voting on own commission → warning + audit flag, not blocked.
    - **Ordering:** credit & collateral commissions run **in parallel, independently**;
      neither gates the other.
  - **Verified on stand 2026-06-19** (`scripts/inspect/verify-p3r4*.mjs`):
    - Quorum: no «кворум/порог/закрыть голосование» text anywhere in the UI; no
      auto-block of closing by tally → no quorum rule exists in code (matches
      decision). #3 = no-op (document only).
    - Final decision: rendered as its own «Финальное решение (Председатель
      комиссии)» section; voting is a separate «Проголосовать» action → final is
      already the chairman's manual act. Only the **audit entry** on save is the
      open dev item (not visible via UI — likely backend).
    - Gating: both «Отправить в комиссию» + «Отправить в залоговую комиссию» stay
      **enabled** with a row selected → credit not gated by collateral. #4 = no-op.
    - 4-eyes warning: no such warning present in the UI → real dev item.
  - **Action:** implement per P3-R4 — real code reduced to #1 (final-decision
    audit) + #2 (4-eyes warning); #3/#4 are document-only.

- **P3-05** — `/loan-applications` create dialog «Новая заявка» — 🔴 critical — _verified 2026-06-19 (`scripts/inspect/app-create-fields.mjs`)_
  - **Issue:** **Субъект** (borrower) and **Кредитная программа** — the two core
    fields of an application — are **not required**: both expose `required=false`
    server-side. An application can be advanced/saved with **no borrower and no
    program**.
  - **Expected:** both mandatory. Show red `*` + inline «Поле является
    обязательным» (reuse the сумма/срок pattern), validate **server-side**, and
    block «Далее» until both are set.
  - **Note:** data-integrity gap, not just UI — an application without a subject
    or a program is meaningless and pollutes the list. → P3-R5.

- **P3-06** — `/loan-applications` create dialog «Новая заявка» — 🟡 minor — _verified 2026-06-19_
  - **Issue:** **Eager required-field errors.** «Запрашиваемая сумма» /
    «Запрашиваемый срок» render a **red background + «Поле является обязательным»
    immediately on open**, before any interaction with the form.
  - **Expected:** lazy validation — surface the error on **blur** or on
    **«Далее»**, not on render.
  - **Note:** eager errors on an untouched form read as "you did something wrong"
    before the user starts typing; degrades the otherwise reference-quality
    validation UX of this module. → P3-R6.

- **P3-07** — `/loan-applications` list — 🟠 major — _verified 2026-06-19 (`scripts/inspect/verify-p3r5r8.mjs`)_
  - **Issue:** Toolbar actions are **selection-gated but not status-gated**. With
    no row selected, Изменить / Удалить / Отправить в комиссию / Отправить в
    залоговую комиссию are correctly **disabled**. With **any** row selected they
    all become **enabled regardless of status** — verified on Одобрено (Заявка-60),
    Отклонено (Заявка-55), На рассмотрении (Заявка-81) and Требуется доп.
    информация (Заявка-74).
  - **Consequence:** an already-**Одобрено** application can be re-sent to a
    commission; an **Отклонено** one can be sent again; an Одобрено one can be
    **Удалить**-deleted. Same class as P1-03 (silent terminal action) / P1-05
    (delete not status-guarded).
  - **Expected:** disable «Отправить…» on terminal/approved statuses; disable
    «Удалить» on Одобрено and on records referenced downstream (loan/commission);
    add a confirmation dialog + per-row result toast for bulk sends. Client +
    server guard. → P3-R7.
  - **Evidence:** `.auth/p3r5-app-list.png`; per-status button matrix in the script output.

- **P3-08** — `/loan-applications` list — 🟡 minor — _verified 2026-06-19 (same run)_
  - **Issue:** The list has **8 columns** (Номер документа · Заемщик · Статус
    заявки · Статус залога · Кредитная программа · Запрашиваемая сумма ·
    Запрашиваемый срок · Дополнительная информация) and **no «Одобренная сумма»**
    column (`hasApprovedAmount = false`). The commission can adjust the requested
    amount/term (detail page: «Условия кредита, одобренные кредитной комиссией»),
    but the **approved outcome is invisible in the list** — only the requested
    figure shows. «Дополнительная информация» (free text, often empty) occupies a
    column slot of low scan value.
  - **Expected:** add an **Одобренная сумма** column (and/or vote tally `n/4`,
    Дата создания); drop or demote «Дополнительная информация». → P3-R8.
  - **Evidence:** header dump in the script output.

- **P3-09** — `/loan-applications` — 🟡 minor — _verified 2026-06-19 (same run); doc gap_
  - **Issue:** **Статус заявки has more values than documented.** Observed a 4th
    value **«Требуется доп. информация»** (Заявка-74) on top of the three logged
    earlier (На рассмотрении / Одобрено / Отклонено). This value already exists on
    the commission screen's «Тип решения»; on the application it was undocumented.
  - **Action:** enumerate the **full status set + transitions** for both Статус
    заявки and Статус залога from the model (not just observed rows); update spec.

### Positive patterns to propagate (2026-06-18)
- **Inline required-field validation** (red `*` + «Поле является обязательным») on
  the application form is exactly what P2-R1 requested — reuse it for programs.
- **Status stepper** (Подача → На рассмотрении → Одобрена → Регистрация кредита)
  is the lifecycle visualization P2-R5 wants for programs.
- **Separated voting roles + read-only «Просмотр»** on the commission screen are
  the 4-eyes (P2-R5) and view-mode (P2-R4) patterns the program module lacks.

### Application detail page — tab-by-tab (2026-06-19)
> Screen: `/loan-applications/{id}` — inspected on id 28 → «Заявка - 60», status
> **Одобрено**. Read-only Playwright walk (`scripts/inspect/app-detail-tabs.mjs`,
> `app-detail-geo.mjs`). Full write-up: [app-detail-analysis.md](app-detail-analysis.md).
> Modal-style editor: fixed header (5 fields) + 9 tabs (Общая информация, График,
> Документы заявителя, Кредитные/Залоговые/Проектные документы, Кредитная/Залоговая
> комиссия, История) + sticky OK/Отмена.

- **P3-10** — `/loan-applications/{id}` header — 🟠 major — _verified 2026-06-19_
  - **Issue:** On an **Одобрено** application, **Запрашиваемая сумма** and **Номер
    телефона** remain **editable** while every other field is locked read-only.
  - **Expected:** edit-gating must follow status — an approved application's terms
    should be fully locked (or all consistently editable under a defined right).
  - **Actual:** two stray editable fields amid an otherwise read-only form.

- **P3-11** — `/loan-applications/{id}` → График — 🟠 major — _verified 2026-06-19_
  - **Issue:** The payment schedule shows **Проценты = 0,00 on every row** despite a
    **12 % annual rate** (Годовая ставка). Principal amortizes (16 666,67 ×12 = 200k)
    but no interest is computed.
  - **Expected:** interest column reflects the rate per period.
  - **Actual:** zero interest across the whole schedule.
  - **Repro:** open Заявка-60 → tab «График».

- **P3-12** — `/loan-applications/{id}` → Документы — 🟠 major — _verified 2026-06-19_
  - **Issue:** Mandatory documents (Паспорт лиц./обор., Подписанное согласие on
    «Документы заявителя»; Паспорт on Кредитные/Залоговые) are **empty on an
    approved application**, and the **Загрузить** drop-zones stay **enabled** after
    approval.
  - **Expected:** required docs gate approval; uploads lock once status passes the
    document stage.
  - **Actual:** approval reached with mandatory docs missing; upload still open.

- **P3-13** — `/loan-applications/{id}` → График — 🟡 minor — _verified 2026-06-19_
  - **Issue:** Schedule is **mutable after approval** — «Построить график» and
    «Добавить строку» enabled on an Одобрено loan.
  - **Action:** confirm whether a locked loan's schedule should be editable, and by
    whom; gate behind status/role if not.

- **P3-14** — `/loan-applications/{id}` → Кредитная/Залоговая комиссия — 🟡 minor — _verified 2026-06-19_
  - **Issue:** The commission decision grid has **two columns both headed
    «Сотрудник»** (col 1 = login `[admin]`, col 2 = ФИО «НУРМАНБЕТ КЫЗЫ КАЛИНА»).
  - **Expected:** distinct headers — e.g. «Логин» / «ФИО» (or «Должность»).
  - **Actual:** duplicate header label; ambiguous columns.

- **P3-15** — `/loan-applications/{id}` → Общая информация — 🟡 minor — _verified 2026-06-19_
  - **Issue:** In «Условия кредита, одобренные комиссией», the selects
    **Периодичность платежей**, **Метод погашения кредита**, **Обработка выходных**
    render **blank** even though the loan is approved and a schedule already exists.
  - **Action:** confirm these are persisted; if so, fix read-only render of selects.

- **P3-16** — `/loan-applications/{id}` → История — 🟡 minor — _verified 2026-06-19_
  - **Issue:** Audit grid (Дата · Заголовок · Детали · Автор) is **empty** for an
    application that went Подача → Одобрено — no lifecycle events recorded.
  - **Expected:** status transitions / commission decisions logged to История.
  - **Actual:** no audit trail populated.

- **P3-17** — `/loan-applications/{id}` header — 🔵 cosmetic — _verified 2026-06-19_
  - **Issue:** Display number «Заявка - 60» ≠ URL id (28); the 5 header status
    fields are **repeated on all 9 tabs**, adding vertical noise. «Статус залоговой
    комиссии» shows empty when no collateral commission ran.
  - **Action:** cosmetic — collapse repeated header or clarify id vs display number.

- **P3-18** — `/loan-applications/{id}` → Залоговые документы — 🟠 major — _verified 2026-06-19 (`app-detail-tabs.mjs`); to-be в мокапе 2026-07-09_
  - **Issue:** «Залоговые документы» — это **один плоский набор** на заявку, не
    привязанный к конкретному **предмету залога**: у заявки с несколькими предметами
    (напр. склад + автомобиль) нет способа увидеть, каких документов не хватает по
    какому объекту. Состав набора не зависит от **вида** предмета (у недвижимости и
    у ТС один и тот же перечень). Плюс «Отправить в залоговую комиссию» **не
    гейтится** ни полнотой залоговых документов, ни **коэффициентом покрытия**
    (Σ оценок ÷ сумма кредита) — заявку можно отправить при недостаточном обеспечении.
  - **Expected:** залоговые документы ведутся **по каждому предмету**, комплект — из
    справочника **вида** предмета (оценка/правоустанавливающие/обременения…); отправка
    в комиссию заблокирована, пока не собран обязательный комплект по всем предметам и
    покрытие ниже порога программы.
  - **Actual:** плоский общий набор, не связанный с предметами; отправка без проверки
    покрытия/комплекта.
  - **To-be:** реализовано в мокапе `mockups/loan-application/loan-application.html`
    (модель «по предметам», ключ `<id предмета>::<docId>`; полный ЖЦ документа; гейт
    = комплект + покрытие). Коммит `0897ef6`. Отвечает **P2-R20 / P2-R21 / P3-R20**.

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

---

## Phase 5 — Loan issuance (Выдача кредитов / Кредиты)
Overall: 🟠 core works (loan = materialized approved application; 11-tab servicing
hub; loan-level repayment schedule computes interest correctly — unlike P3-R11),
but a **blocking data-dependent crash** on the detail page and no field/status
gating. Routes: list `/loansCredit`, detail `/loan-credits/{id}`, view
`/loan-credits-read/{id}?mode=readonly`. Verified 2026-06-20
(`scripts/inspect/loans*.mjs`).

- **P5-01** — `/loan-credits/{id}` — 🔴 blocker — _verified 2026-06-20_
  - **Steps:** open loan records 20 or 22 (edit route `loan-credits/20` **or**
    readonly `loan-credits-read/20?mode=readonly`, e.g. select row → «Просмотр»).
  - **Actual:** full-page dialog **«Непредвиденная ошибка»**; the page never
    renders. Records 18 / 19 / 21 open fine — so it is **data-dependent**.
  - **Expected:** every loan opens; bad data yields a handled message, not a crash.
  - **Notes:** server-side unhandled exception — Vaadin renders the error via UIDL
    (HTTP 200, no 4xx/5xx on the wire; only console noise is the push websocket).
    Needs a **server log** at open-time of rec 20/22 to root-cause. → P5-R1.

- **P5-02** — `/loan-credits/{id}` — 🟠 major — _no status gating_
  - **Issue:** «Статус кредита» (combo), «Сумма по договору», and the «Условия
    кредита» terms are **freely editable regardless of loan status**. Loan status
    can be changed by directly picking a value, not via guarded transitions.
  - **Expected:** lock financial terms once issued; drive status via workflow
    transitions with audit. Same class as P3-R10 / P3-R7 / Phase 1 R7. → P5-R2.

- **P5-03** — `/loan-credits/{id}` → Общая информация — 🟠 major — _verified 2026-06-20_
  - **Issue:** «Сумма по договору» = **250 000,00** while «Одобренная сумма»
    (read-only) = **150 000,00** — the contract amount **exceeds the
    commission-approved amount**, and the field is an editable plain text-field
    with **no numeric / min / max validation**.
  - **Expected:** contract amount ≤ approved amount and > 0, enforced on client +
    server; numeric field, not free text. → P5-R3.

- **P5-04** — `/loansCredit` list — 🟡 minor — _no working view page_
  - **Issue:** toolbar = Добавить условие поиска · Изменить · **Просмотр**; the
    only read-only path («Просмотр») routes to the **crashing** readonly view
    (P5-01). List also surfaces the **application** status («Статус заявки»), not
    the loan's own «Статус кредита».
  - **Action:** add a real loan detail/view page (reuse P2-R4 / P3-R2 pattern);
    reconcile which status the list shows. → P5-R4.

- **P5-05** — `/loan-credits/{id}` → Общая информация — 🟡 minor — _format_
  - **Issue:** on one screen «Одобренная сумма» renders raw `150000.00` while
    «Сумма по договору» renders `250 000,00` (grouped, comma decimal).
  - **Expected:** one money format everywhere. → P5-R5.

- **P5-06** — `/loan-credits/{id}` — 🟡 minor — _date affordance_
  - **Issue:** date entry is split into **3 separate unlabeled widgets**
    (date-time-picker + date-picker + time-picker) on Общая информация,
    Оформление and Условия кредита.
  - **Expected:** a single labelled date(-time) field. → P5-R5.

- **P5-07** — `/loan-credits/{id}` — 🔵 cosmetic — _UI typos_
  - **Issue:** «**Измнен**» (→ «Изменён») on Общая информация; «начис**е**ния» /
    «нач**сил**ения» (→ «начисления») on Условия кредита. → P5-R5.

- **P5-08** — `/loan-credits/{id}` → Условия кредита — 🟡 minor — _rate not surfaced_
  - **Issue:** «Процентная ставка» is read-only and **empty**, yet the repayment
    schedule computes interest (Сумма процентов 16 121,73). The rate the schedule
    uses is not shown on the terms tab.
  - **Action:** surface the effective rate (likely inherited from the program). → P5-R5.

---

## Phase 6 — Disbursement & tranches (Освоение и транши)

> Routes: `/sub-loans` (tranches list) · `/sub-loans/{id}` (4 tabs) ·
> `/disbursements` (list) · `/disbursements/{id}`. Verified 2026-06-20 via
> `scripts/inspect/p6.mjs` (admin, test env). See
> `requirements/features/06-disbursement-tranches.md`.

- **P6-01** — `/sub-loans` list + `/disbursements/{id}` — 🟠 major — _verified 2026-06-20_
  - **Issue:** raw entity property names leak into the UI as labels instead of
    localized Russian: the **first column header** of the tranches list is
    **`SubLoan.amount`** (should be «Сумма транша»), and the disbursement detail's
    parent-tranche picker is labelled **`Disbursement.subLoan`** (should be «Транш»).
  - **Expected:** every user-facing label localized; no `Entity.property` strings.
  - **Notes:** missing i18n message keys — same class as the typo/format cleanups
    but more visible (a primary column header). → P6-R1.

- **P6-02** — `/sub-loans/{id}` → График — 🟡 minor — _verified 2026-06-20_
  - **Steps:** open tranche `/sub-loans/1` (Status = Active, Срок 24, ставка 10 %),
    go to the «График» tab.
  - **Actual:** tab is **empty** — Кол-во платежей **0**, Основной долг / Проценты /
    Всего платежей all **0.00**, schedule grid blank — even though the tranche has
    full terms and a disbursement (Освоение №1, 50 000) **with a fully computed
    schedule** sits beneath it (tab «Освоение»).
  - **Expected:** the tranche schedule is generated/aggregated automatically (or the
    summary should not show a misleading all-zero state); needs a manual
    «Пересчитать график» today.
  - **Notes:** disbursement-level schedule is correct (see feature doc); the gap is
    at the tranche roll-up level. → P6-R2.

- **P6-03** — `/sub-loans/{id}` → Условия — 🔵 cosmetic — _verified 2026-06-20_
  - **Issue:** «Очередность погашения» value reads «Основная сумма, проценты,
    **шрафы**» — typo, should be «**штрафы**».
  - **Expected:** «… штрафы». → P6-R3.

---

## Phase 7 — Servicing (Обслуживание: платежи, резервы, реестр)

> Routes: `/payments` (Платеж) · `/loan-reserves` (Резерв) · `/loan-ledgers`
> (LoanLedger). Verified 2026-06-20 via `scripts/inspect/p7.mjs` (admin, test env).
> See `requirements/features/07-servicing.md`.

- **P7-01** — `/payments`, `/loan-reserves`, `/loan-ledgers` — 🟠 major — _verified 2026-06-20_
  - **Issue:** raw entity/enum strings leak as labels across all three servicing
    grids instead of localized Russian: Резерв headers `Loan`, `Loan amount`,
    `LoanReserve.disbursedAmount`, `LoanReserve.unusedAmount`,
    `LoanReserve.reserveRate`, `LoanReserve.reserveAmount`; LoanLedger «Событие»
    mixes the raw enum `EventType.PRINCIPAL_ACCRUAL` with English `Interest accrual`
    / `Payment` and Russian `Пеня`; ledger page title is `LoanLedger`.
  - **Expected:** all headers/values localized; the event enum has a single Russian
    label set. Same class as P6-01, wider. → P7-R1.

- **P7-02** — `/payments` list — 🟠 major — _verified 2026-06-20_
  - **Issue:** the grid exposes two **internal technical columns** — `Payment uuid`
    (entity UUID) and `Payment version` (optimistic-lock version) — to end users.
  - **Expected:** hide infrastructure columns; show business fields only. → P7-R2.

- **P7-03** — `/payments` list — 🟡 minor — _verified 2026-06-20_
  - **Issue:** the first **«Статус»** column shows the raw code **`1`** on every
    row, redundant with **«Статус платежа»** which holds the human value
    («Оплачен»).
  - **Expected:** one status column with a localized value; drop the raw code. → P7-R3.

- **P7-04** — `/loan-reserves` — 🟡 minor — _verified 2026-06-20_
  - **Issue:** toolbar is **Обновить + Добавить условие поиска only** — no
    Создать/Изменить/Просмотр/Удалить — and double-clicking a row opens nothing
    (URL stays `/loan-reserves`). There is **no detail view** for a reserve record.
  - **Expected:** a read-only detail/«Просмотр» page so users can inspect how a
    reserve was computed. → P7-R4.

- **P7-05** — `/loan-ledgers` — 🟡 minor — _verified 2026-06-20_
  - **Issue:** the loan ledger is an **accounting event log** yet the toolbar
    offers **«Удалить»** (gated on selection). Deleting financial events breaks
    auditability.
  - **Expected:** ledger is append-only; corrections via reversing entries, not row
    deletion; any admin removal must be audited. → P7-R5.

---

## Phase 8 — Reference dictionaries (Справочники / классификаторы)

> Cross-cutting data layer used by entities of sections 01–07. Verified 2026-06-24
> via `scripts/inspect/tz/nav-spravochniki.mjs` (menu) and
> `scripts/inspect/tz/dump-dict.mjs --file .auth/dict-routes.txt` (47 screens:
> data + CSS, 0 errors). See `requirements/tz/08-spravochniki.md`. Stand is test —
> values indicate structure, not the normative list.

- **P8-01** — `/loan-states` (Статус кредита) — 🔴 blocker — _verified 2026-06-24_
  - **Issue:** the dictionary that should hold loan lifecycle statuses contains a
    single junk row **«Кредит компании»** — not a status. The status classifier for
    section 05 is effectively unpopulated with valid values.
  - **Expected:** normative loan-status set; remove the junk row. → P8-R4.

- **P8-02** — lookup picker from forms — 🔴 blocker — _verified 2026-06-19/24_
  - **Issue:** opening a `jmix-value-picker` (e.g. «Решение правительства») surfaces
    a full screen with **Создать/Изменить/Удалить/Одобрить/Отклонить** — far too wide
    an access surface from inside a form; the status filter is a removable UI chip
    with no server enforcement.
  - **Expected:** selection-only picker + hard loader filter. **Already tracked as
    P2-R9** — recorded here as the dictionary-layer manifestation, no new task.

- **P8-03** — 14 dictionaries empty — 🟠 major — _verified 2026-06-24_
  - **Issue:** `order-document-types`, `entity-document-states`,
    `entity-document-registered-bies`, `document-package-states`,
    `document-package-types`, `applied-entity-list-states`,
    `applied-entity-list-types`, `applied-entity-states`,
    `order-term-frequency-types`, `order-term-rate-periods`,
    `order-term-accr-methods`, `work-sectors`, `loan-payment-capacity-groups`,
    `good-types` return **0 rows**. Several are status/type enums the workflow
    references — an empty dictionary = a field with no values to pick.
  - **Expected:** populate with normative values before enabling required-field
    server validation (P2-R10). → P8-R3.

- **P8-04** — `/agreement-templates`, `/agreement-template-codes` — 🟠 major — _verified 2026-06-24_
  - **Issue:** grid column headers show **raw Java property paths** instead of
    localized labels — «AgreementTemplate.templateType», «AgreementTemplate.status»,
    «AgreementTemplate.active»; «AgreementTemplateCode.code», «…name», «…description».
  - **Expected:** localized Russian column captions. → P8-R2.

- **P8-05** — `/destination-accounts` — 🟠 major — _verified 2026-06-24_
  - **Issue:** screen title is the untranslated English **«Destination accounts»**.
  - **Expected:** Russian screen title. → P8-R2.

- **P8-06** — 40 of 47 dictionary screens — 🟠 major — _verified 2026-06-24_
  - **Issue:** only 7 screens (industryDirections, collateralTypes, commissions,
    creditTerms, calculationCoefficients, individuals, organizations) expose a
    **«Просмотр»** mode. The other 40 force editing to inspect a record (accidental
    edit risk) — same class as P2-R4.
  - **Expected:** read-only view on every dictionary; standardize on the richer
    archetype (Код + Статус + «Просмотр»). → P8-R1.

- **P8-07** — status dictionaries & «Статус» columns — 🟡 minor — _verified 2026-06-24_
  - **Issue:** status values render as **plain text** everywhere — both in
    status-classifier screens (Статус решения/кредита/документа…) and in the «Статус»
    column of the rich archetype («Активный»). The design system defines colored
    status badges.
  - **Expected:** render statuses as design-system badges (`status-*` tints). → P8-R5.

- **P8-08** — multiple dictionaries — 🟡 minor — _verified 2026-06-24_
  - **Issue:** test garbage in production-candidate dictionaries: «соновное 1»
    (typo, Вид решения), «123/321» (Вид счета погашения / Счет погашения),
    «hidshgiu/fgxdzxh» (Группа заемщика), «шрафы» (typo, Вид очередности погашения),
    «Aibek rate» (Вид ставок).
  - **Expected:** clean and fix typos; fix normative lists with the owner. → P8-R4.

- **P8-09** — `Цели кредита`, `Уровни проверки документов`, `Типы расчета процентов` — 🟡 minor — _verified 2026-06-24_
  - **Issue:** three dictionaries referenced by loan-program form fields were **not
    found as standalone «Справочники» menu routes** (nav enumeration 2026-06-24) —
    reachable only through the in-form picker. Inconsistent management surface.
  - **Expected:** a management screen in the «Справочники» menu for every dictionary.
    → P8-R1.

- **P8-10** — dictionary grids — 🔵 cosmetic — _verified 2026-06-24_
  - **Issue:** grid body font-size varies (14px vs 16px) and row height varies
    (29 / 30 / 32 / 34px / auto) across screens; the rest of the tokens (title,
    primary button, border, container padding) are uniform and match the mockup
    design system.
  - **Expected:** one font-size / row-height across all dictionary grids. → P8-R6.
