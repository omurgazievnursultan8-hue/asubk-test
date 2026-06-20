# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is (and is NOT)

This is a **coordination, QA, and documentation workspace** for the **ASUBK Credit
Module** — NOT the application source. The actual app is a separate codebase
(repo URL is still TBD in `references.md`). The app is a live **Jmix-on-Vaadin**
Java SPA, Russian-language, running only on the test env:

- **Test env:** https://fkftest.okmot.kg/ — login at `/login`, creds `admin` / `admin`.

Work here = inspect the running app, document what it does, log defects, and
write improvement proposals for the dev team. You generally do not write app code.

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
```

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
