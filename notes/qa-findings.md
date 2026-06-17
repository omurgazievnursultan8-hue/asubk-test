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
