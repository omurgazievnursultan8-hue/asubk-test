#!/usr/bin/env python3
"""Push TODO.md -> Google Sheet (one-way).

Parses the workspace TODO.md into rows and overwrites the target Google Sheet.
Source of truth stays TODO.md; collaborators read the Sheet.

Setup: see scripts/README.md. Needs a Google service-account key and the Sheet
shared (Editor) with that account's email.

Usage:
    python3 scripts/sync_todos.py
    python3 scripts/sync_todos.py --dry-run        # parse + print, no network
    python3 scripts/sync_todos.py --creds /path/to/key.json
"""
import argparse
import datetime
import os
import re
import sys

# Spreadsheet key from the shared URL (.../d/<KEY>/edit)
SHEET_KEY = "1hawaSxsCEZObOvEB-US8jztUDdSvOMGXWqY0LeeaFew"
WORKSHEET_INDEX = 0  # gid=0 (first tab)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
TODO_PATH = os.path.join(ROOT, "TODO.md")
DEFAULT_CREDS = os.path.join(ROOT, "service-account.json")

PRIORITY = {"🔴": "High", "🟠": "Medium", "🟡": "Low", "🟢": "Idea", "🔵": "Cosmetic"}
HEADER = ["Section", "ID", "Priority", "Task", "Status", "Notes"]


def parse_todos(text):
    """TODO.md markdown -> list of [Section, ID, Priority, Task, Status, Notes]."""
    rows = []
    section = ""
    for raw in text.splitlines():
        line = raw.rstrip()
        heading = re.match(r"^#{2,3}\s+(.*)", line)
        if heading:
            section = heading.group(1).strip()
            continue
        item = re.match(r"^\s*-\s*\[([ xX])\]\s*(.*)", line)
        if not item:
            continue
        done = item.group(1).lower() == "x"
        text_part = item.group(2).strip()

        # Leading ID like "R1" or "Phase 2"
        idm = re.match(r"^(R\d+|Phase\s*\d+)\b[:\-\s—–]*(.*)", text_part)
        if idm:
            tid = re.sub(r"\s+", " ", idm.group(1))
            rest = idm.group(2).strip()
        else:
            tid, rest = "", text_part

        # Priority emoji anywhere in the remainder
        prio = ""
        for emoji, name in PRIORITY.items():
            if emoji in rest:
                prio = name
                rest = rest.replace(emoji, "").strip()
                break

        # Split task vs notes on the first dash separator
        task, notes = rest, ""
        for sep in (" — ", " – ", " - "):
            if sep in rest:
                task, notes = rest.split(sep, 1)
                break

        rows.append([
            section, tid, prio, task.strip(),
            "Done" if done else "Todo", notes.strip(),
        ])
    return rows


def main():
    ap = argparse.ArgumentParser(description="Push TODO.md to the Google Sheet.")
    ap.add_argument("--creds", default=os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", DEFAULT_CREDS),
                    help="Path to service-account JSON key.")
    ap.add_argument("--key", default=SHEET_KEY, help="Spreadsheet key.")
    ap.add_argument("--dry-run", action="store_true", help="Parse and print, no network.")
    args = ap.parse_args()

    with open(TODO_PATH, encoding="utf-8") as f:
        rows = parse_todos(f.read())

    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    print(f"Parsed {len(rows)} task rows from TODO.md")

    if args.dry_run:
        widths = [max(len(str(r[i])) for r in ([HEADER] + rows)) for i in range(len(HEADER))]
        for r in [HEADER] + rows:
            print(" | ".join(str(c).ljust(widths[i])[:40] for i, c in enumerate(r)))
        return 0

    if not os.path.exists(args.creds):
        sys.exit(f"ERROR: credentials not found at {args.creds}\n"
                 f"Create a service-account key and place it there, or pass --creds. "
                 f"See scripts/README.md.")

    import gspread
    from google.oauth2.service_account import Credentials

    scopes = ["https://www.googleapis.com/auth/spreadsheets"]
    creds = Credentials.from_service_account_file(args.creds, scopes=scopes)
    sa_email = getattr(creds, "service_account_email", "<unknown>")
    gc = gspread.authorize(creds)

    try:
        sh = gc.open_by_key(args.key)
        ws = sh.get_worksheet(WORKSHEET_INDEX)
        ws.clear()
        ws.update(values=[HEADER] + rows, range_name="A1")
        ws.update(values=[[f"Synced {ts} from TODO.md — source of truth is the repo, do not hand-edit"]],
                  range_name="H1")
        ws.freeze(rows=1)
        ws.format("A1:F1", {"textFormat": {"bold": True}})
    except gspread.exceptions.APIError as e:
        if "PERMISSION_DENIED" in str(e) or "403" in str(e):
            sys.exit(f"ERROR: permission denied. Share the Sheet (Editor) with:\n"
                     f"    {sa_email}\nthen re-run. ({e})")
        raise

    print(f"✅ Synced {len(rows)} rows to https://docs.google.com/spreadsheets/d/{args.key}/edit")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
