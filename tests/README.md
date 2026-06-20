# UI tests

Playwright (`@playwright/test`) UI tests for the ASUBK Credit Module, run against
the live test stand (`https://fkftest.okmot.kg/`). These are end-to-end checks of
the running Jmix-on-Vaadin SPA — they complement the exploratory probes in
`scripts/inspect/`, which stay ad-hoc.

## Layout

One folder per **entity**, mirroring the phase-by-phase QA in
`requirements/features/`. Folder name = entity name.

```
tests/
  auth.setup.js            # logs in once, saves storageState (reused by all)
  government-decision/     # Phase 1 — /gov-decisions
    list.spec.js           # list view: grid, columns, toolbar, rows
    create.spec.js         # create form: controls, status, date, validation
```

Add later phases as sibling folders: `loan-program/`, `application-commission/`,
`borrower/`, `loan-issuance/`, …

## Run

```bash
npm test                 # all entities (auth setup runs first, headless system Chrome)
npm run test:report      # open the last HTML report
npx playwright test tests/government-decision   # one entity
npx playwright test -g "create form"            # by title
```

Creds default to `admin`/`admin`; override with `OK_USER` / `OK_PASS`. Base URL
override: `OK_BASE`.

## Conventions

- **Non-destructive by default.** Tests assert structure and read-only behavior;
  the create form is only exercised with an empty submit (validation), no record
  is saved. If a test must create data, note it — test records linger on the
  stand (server-side delete guards), a full reset is pending.
- **Vaadin gotcha:** field labels and values live in shadow DOM. Match grid text
  via `vaadin-grid-cell-content`; read field values with `.evaluate(el => el.value)`,
  not by visible page text.
- Browser is **system Chrome** (`channel: 'chrome'`) — no bundled browser to
  install, matching `scripts/inspect/*.mjs`.
- Auth state (`tests/.auth/`) and reports (`tests/.report/`, `test-results/`) are
  git-ignored.
