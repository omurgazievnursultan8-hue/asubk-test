# TODO → Google Sheet sync

One-way push of `TODO.md` into the shared Google Sheet. **`TODO.md` in this repo
stays the single source of truth** — the Sheet is a read view for collaborators.
Don't hand-edit the Sheet; your changes are overwritten on the next sync.

Target sheet: https://docs.google.com/spreadsheets/d/1hawaSxsCEZObOvEB-US8jztUDdSvOMGXWqY0LeeaFew/edit

## What gets synced
`sync_todos.py` parses every `- [ ]` / `- [x]` item under each `##`/`###`
heading. **Each section becomes its own tab** (worksheet), with Russian columns:
**ID · Приоритет · Задача · Статус · Примечания**.

Formatting applied automatically: frozen bold blue header, sized + wrapped
columns, table borders, and conditional colour-coding — priority
(Высокий/Средний/Низкий → red/orange/yellow) and status (Готово → green). Cell
G1 of the first tab records the last sync time. Tabs no longer present in
TODO.md are removed on sync.

Section → tab-name mapping lives in `SECTION_TABS` at the top of the script;
status/priority translations live in `STATUS_RU` / `PRIO_RU`. TODO.md content
should be written in Russian (it's the source of truth for the shared sheet).

## One-time setup (service account)
1. Go to https://console.cloud.google.com/ → create or pick a project.
2. **Enable the Google Sheets API**: APIs & Services → Library → "Google Sheets
   API" → Enable.
3. **Create a service account**: APIs & Services → Credentials → Create
   credentials → Service account. Name it e.g. `todo-sync`. (No roles needed.)
4. **Create a key**: open the service account → Keys → Add key → Create new key →
   **JSON** → download.
5. Save the downloaded file as **`service-account.json` in the repo root**
   (already git-ignored — never commit it).
6. **Share the Sheet with the service account**: open the JSON and copy the
   `client_email` (looks like `todo-sync@<project>.iam.gserviceaccount.com`).
   In the Google Sheet → Share → paste that email → give **Editor** → Send.

## Run it
```bash
python3 scripts/sync_todos.py            # push TODO.md -> Sheet
python3 scripts/sync_todos.py --dry-run  # preview rows, no network
```

Dependencies (already installed for this user): `gspread`, `google-auth`.
Reinstall if needed: `pip install --user gspread google-auth`.

## Updating the Sheet later
Edit `TODO.md`, then re-run `python3 scripts/sync_todos.py`. That's it.

## Auto-sync on edit (Claude Code hook)
A `PostToolUse` hook in `.claude/settings.local.json` runs `todo_hook.py`
whenever `TODO.md` is changed through Claude Code. The hook launches the sync in
the background (non-blocking) and logs to `scripts/.sync.log`. It only acts on
this project's `TODO.md` and always exits 0, so it never blocks editing.

The hook lives in machine-local settings (git-ignored) because it depends on the
local `service-account.json`. After adding/changing the hook, open `/hooks` once
(or restart Claude Code) so the config reloads. Edits you make in an external
editor are NOT caught by this hook — run the sync manually for those.

## Troubleshooting
- **"credentials not found"** — `service-account.json` isn't in the repo root
  (or pass `--creds /path/to/key.json`).
- **"permission denied" / 403** — you didn't share the Sheet with the service
  account's `client_email` (step 6), or gave it less than Editor.
- **Sheets API not enabled** — redo step 2 for the same project as the key.

---

# Task-file validator

`check_tasks.py` enforces the contract in `docs/tasks/FORMAT.md` on the HTML task
files handed to the dev team. No dependencies — stdlib only.

```bash
python3 scripts/check_tasks.py                        # every file with a JSON island
python3 scripts/check_tasks.py docs/tasks/<file>.html
python3 scripts/check_tasks.py --strict               # warnings fail too
```

Exit code 1 on any error — run it before packaging a handover. It checks: no forward
dependencies, every `deps` resolves, word and acceptance budgets, "not in this task"
filled, links live and inside the delivered package, anchors exist, no file paths or
"ТЗ §5" as plain text, ids matching the `TODO.md` registry 1:1, no priority/status
fields, open questions naming a default, contiguous stages.

The eight files handed over before 02.08.2026 carry no JSON island; they are reported
as frozen legacy and skipped.

---

# Statistics fields page

`build_stat_fields.py` renders `mockups/statistics/statistics-fields.html` — a searchable
developer reference: how the statistics module stores data, then every column of the 11
`stat_row_*` tables and the 18 service tables, explained field by field. Two sources:

- `mockups/statistics/ASUBK-statistika-fizschema.md` — the columns, types and sources (master);
- `mockups/statistics/ASUBK-statistika-polya.md` — the dictionary: §0 storage logic, then one
  section per table with fields «что это · зачем · опора».

The page shell lives next to the script in `build_stat_fields.tpl.html`; the data is injected
as JSON. Stdlib only.

```bash
python3 scripts/build_stat_fields.py                                   # default paths
python3 scripts/build_stat_fields.py <fizschema.md> <polya.md> <out.html>
```

Rerun it after every edit to either file. On any mismatch it fails and writes nothing:

- column counts against the fizschema §0.1 summary (per table and grand total);
- every table has a dictionary section; every schema column sits in exactly one field, every
  field column exists in the schema, and a field never spans two schema groups;
- the ⚑ mark («the neighbour doesn't have it yet») of a schema row passes to the field that
  takes the whole row. When a row is split across fields, put ⚑ in the text of the fields it
  applies to; a row ⚑ that reaches no field, or a field ⚑ with no mark in the schema, fails.

So a new schema column needs a dictionary line before the page builds. The page itself is
never hand-edited.

---

# Report & print-form list (Перечень)

`build_perechen.py` builds the closed list of reports and print forms of the credit module for
the final acceptance act, with a card and a sample for every row. One source:
`docs/perechen-otchetov/perechen.json` (rules, legend, rows, «вне перечня», control set, cards).
Needs `openpyxl`; blank samples also need LibreOffice (`soffice`).

```bash
python3 scripts/build_perechen.py                          # default paths
python3 scripts/build_perechen.py --no-samples             # Перечень.xlsx only, no LibreOffice
python3 scripts/build_perechen.py <perechen.json> <out dir>
```

Output (default `docs/perechen-otchetov/`):

- `Перечень.xlsx` — sheets «Перечень» (rows: reports, blanks, general requirements; a form
  variant is its own row under the form's number; link to the sample file), «Приёмка» (check
  rules of every row, the control-set borrowers it is checked on, result columns with a
  сдано/не сдано list), «Контрольный набор» (borrowers КЗ-01…КЗ-20 and their cases),
  «Вне перечня» (what is not in the list and where it is covered);
- `obrazcy/ФО-NN.xlsx` per report — sheet «Образец», one sheet per variant, sheet «Описание»
  (the card); `obrazcy/ФО-NN.docx` per blank — the sample, variant samples after page breaks,
  then the card. Values the system fills in are highlighted. Stale `ФО-NN.*` files are removed.

Language and the «Кыргызский текст» warning are computed from `"ext": true` on a blank; a
variant's card is the form's card overlaid with the variant's own fields. On any error it fails
and writes nothing: bad or retired number (ФО-21/22/23), a second main row for a number, a
variant before its form or repeated, `ext` outside blanks, a missing required row field, a row
without a card or a card without a row, a missing card field for its part, a report sample row
whose cell count differs from the columns, an internal code (ADR-, ИО-, ПВ-…) in card text, a
control-set reference that is ambiguous, or a row not checked on any control-set borrower.
It warns (and still writes) when a sample subtotal is not the sum of its rows, and prints the
owner questions (`open`) — those are never rendered into the package.
The xlsx and docx files are never hand-edited.
