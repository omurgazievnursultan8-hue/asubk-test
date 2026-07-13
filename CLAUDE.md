# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is (and is NOT)

This is a **coordination, QA, and documentation workspace** for the **ASUBK Credit
Module** — NOT the application source. The actual app is a separate codebase
(repo URL is still TBD in `references.md`).

There are **two live systems**, and most confusion comes from mixing them up:

- **New app (target, "to-be").** https://fkftest.okmot.kg/ — **Jmix-on-Vaadin** Java SPA,
  Russian-language, test env only. Login at `/login`, creds `admin` / `admin`.
- **Legacy app (predecessor, "as-is").** http://85.113.29.29:8080/ — the old FKF/ASUBK
  system it replaces. Different stack, different vendor. **No login script and no
  credentials in this repo** — the session lives in the user's real Chrome profile
  (user: Сламкулов А.О., `/user/1/details`). Surveyed to build a "было → стало" baseline
  so nothing is lost in the rewrite; the survey lives in `requirements/legacy/`
  (`00-plan.md` = nav map + phase table).

Work here = inspect the running apps, document what they do, log defects, and
write improvement proposals for the dev team. You generally do not write app code.

## Two systems, two browsers

|  | new app | legacy app |
|--|---------|-----------|
| host | `fkftest.okmot.kg` | `85.113.29.29:8080` |
| driven by | **Playwright** — `scripts/inspect/*.mjs`, profile `.auth/profile` | **MCP `claude-in-chrome`** — the user's already-logged-in Chrome |
| scripts | ~180 | **none — do not write any** |

Legacy gotcha (E2E-11): jQuery handlers in the legacy app **ignore a synthetic `.click()`**
— several buttons (e.g. «Претензия» in РАСЧЕТЫ) only fire on a real mouse click via the
`computer` tool. This is an automation artifact, not a product defect.

## The core workflow

Phase-by-phase end-to-end QA of the credit lifecycle (gov decision → loan program →
applications/commissions → borrowers → loans → … → debt collection). For each phase:

1. **Inspect** the live app with a Playwright script in `scripts/inspect/*.mjs`.
2. **Document** the feature in `requirements/features/<NN>-<name>.md`.
3. **Log defects** in `notes/qa-findings.md` (IDs `Pn-NN`).
4. **Write recommendations** as backlog tasks in `TODO.md` (IDs `Pn-Rn`).
5. Sometimes **mock up** a proposed UI as a self-contained HTML file in `mockups/`
   (ASUBK gov-blue design system) to hand to the dev team.

Track state in `STATUS.md`; `README.md` maps which file holds what.

## Conventions that aren't obvious

- **Numbering:** each phase has two independent counters — `Pn-NN` for defects
  (in `qa-findings.md`) and `Pn-Rn` for recommendations (in `TODO.md`). Phase 1
  recommendations are the legacy `R1–R7` form; later phases use `P2-R*`, `P3-R*`, …
- **`Pn` is overloaded — do not merge the counters.** In `requirements/legacy/*`,
  `P1…P13` numbers the **modules of the OLD system** (P1 Заёмщики · P2 Кредиты ·
  P3 Погашения · P4 Залог · P5 Взыскание · P8 Физлица/Организации · P11 Прочее ·
  P12 Справочники; P6/P7/P9/P10/P13 are out of scope). In `qa-findings.md` / `TODO.md`,
  `Pn-NN` / `Pn-Rn` numbers the **phases of the NEW app**. Same prefix, unrelated meaning.
- **Legacy defect IDs.** Per-phase legacy defects are prose ("Дефекты-кандидаты" at the end
  of each `requirements/legacy/NN-*.md`) and have no IDs. The only numbered ones are
  **`E2E-01…E2E-14`** in `requirements/legacy/20-e2e-cycle-plan.md`. They are **not yet
  folded into `notes/qa-findings.md`** — when porting them, keep an `E2E-` prefix so they
  never collide with the new app's `Pn-NN`.
- **Severity scale** (used in `qa-findings.md` and TODO priorities): 🔴 blocker ·
  🟠 major · 🟡 minor · 🔵 cosmetic. TODO priority chips: 🔴 Высокий / 🟡 Средний / 🟢 Низкий.
- **`TODO.md` is written in Russian and is the single source of truth.** It is
  synced one-way to a shared Google Sheet (see below) — never hand-edit the Sheet.
- Every claim about app behavior should be backed by an in-app verification; cite
  the inspection script and date (e.g. "проверено 2026-06-19, `scripts/inspect/...`").
- When you edit `STATUS.md`, update its "Last updated" date line.

## Commands

```bash
# Inspect the live app (Playwright via playwright-core + system Chrome).
# Each script self-logs in and reuses the auth profile under .auth/profile.
node scripts/inspect/login.mjs            # template: login + screenshot a route
OK_USER=admin OK_PASS=admin node scripts/inspect/<name>.mjs   # creds overridable via env

# Annotate screenshots (box UI text + English label). Edit the script, then run.
python3 scripts/annotate.py               # reads/writes files in screenshots/

# Push TODO.md -> Google Sheet (Russian, one tab per section).
python3 scripts/sync_todos.py             # live push
python3 scripts/sync_todos.py --dry-run   # preview rows, no network

# Render a TZ (техзадание) section to a self-contained HTML page
# (gov-blue design system, sticky sidebar nav auto-built from h2/h3).
python3 scripts/build_tz_html.py requirements/tz/03-zayavka-komissiya.md [out.html]
```

`build_tz_html.py` gotcha: the banner kick-line and the routes strip are **hardcoded to
раздел 03** — rendering any other TZ section requires editing the script first.

There is no build/test/lint — this repo holds docs, scripts, and assets only
(`npm test` is a placeholder that errors).

## Gotchas

- **`service-account.json`** (repo root) holds Google credentials for the TODO
  sync. It is git-ignored — never commit it. Sync fails without it. Setup steps
  are in `scripts/README.md`.
- **TODO auto-sync hook:** a `PostToolUse` hook (`scripts/todo_hook.py`, wired in
  the git-ignored `.claude/settings.local.json`) re-syncs the Sheet whenever
  Claude Code edits `TODO.md`. It does NOT fire for edits made in an external
  editor — run the sync manually then. After changing the hook, reopen `/hooks`.
- **`.auth/`** holds the Playwright browser profile and scratch screenshots — git-ignored.
- Inspection scripts target the live test stand; they mutate real test data
  (test records linger because of server-side delete-policy guards). Expect a full
  data reset later, so don't worry about cleaning up created records.
- The module map in `requirements/overview.md` was reconstructed from the running
  app, not from authoritative project docs — treat it as a working draft.
- **The legacy E2E run is already done — read it, don't redo it.** A full credit cycle was
  driven end to end on the legacy stand on 2026-07-12/13 (borrower → decision → loan →
  collateral → guarantor → inspection → disbursement → payments → overdue → collection
  (procedure + 4 phases) → full repayment → closure). Every created id (person-63545,
  debtor-54693, order-734, loan-60540, procedure-68252, phases 84374–84377) is in the
  «Журнал прогона» table of `requirements/legacy/20-e2e-cycle-plan.md`.
- **Six legacy architecture findings** that drive the new design (details in the same file,
  §«ИТОГ ПРОГОНА»): borrower is a thin wrapper over a subject (subject has its own separate
  id); loan terms are versioned but the **payment schedule is typed in by hand** — no
  autogeneration; collateral and guarantee share one "обеспечительный договор" pattern;
  **the outstanding balance is a batch snapshot, not realtime** — it is decoupled from
  payments (E2E-09); collection is 4 levels deep (заёмщик → процедура → фаза → событие);
  closing is manual at every level with **no zero-balance validation** (E2E-13/14 — the
  orphan 0,01 kopeck).
- `screenshots/legacy/` is referenced in the legacy docs but **does not exist** — there are
  no legacy screenshots yet.
- `README.md`, `STATUS.md`, and `requirements/README.md` are **stale**: they do not mention
  `requirements/legacy/` at all (and only partly mention `requirements/tz/`). STATUS.md's
  "Last updated" is 2026-07-12, before the legacy work landed.
