# TODO → Google Sheet sync

One-way push of `TODO.md` into the shared Google Sheet. **`TODO.md` in this repo
stays the single source of truth** — the Sheet is a read view for collaborators.
Don't hand-edit the Sheet; your changes are overwritten on the next sync.

Target sheet: https://docs.google.com/spreadsheets/d/1hawaSxsCEZObOvEB-US8jztUDdSvOMGXWqY0LeeaFew/edit

## What gets synced
`sync_todos.py` parses every `- [ ]` / `- [x]` item under each `##`/`###`
heading into rows: **Section · ID · Priority · Task · Status · Notes**. The
header is frozen and bold; cell H1 records the last sync time.

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

## Troubleshooting
- **"credentials not found"** — `service-account.json` isn't in the repo root
  (or pass `--creds /path/to/key.json`).
- **"permission denied" / 403** — you didn't share the Sheet with the service
  account's `client_email` (step 6), or gave it less than Editor.
- **Sheets API not enabled** — redo step 2 for the same project as the key.
