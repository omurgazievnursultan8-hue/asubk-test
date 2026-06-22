#!/usr/bin/env python3
"""Push TODO.md -> Google Sheet (one-way), grouped into formatted Russian tabs.

Each TODO.md section (##/### heading) becomes its own worksheet (tab). Columns
are translated to Russian; the header is styled, columns sized, the table
bordered, and priority/status cells colour-coded via conditional formatting.
TODO.md stays the single source of truth.

Setup: see scripts/README.md (service-account key + share the Sheet as Editor).

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

SHEET_KEY = "1hawaSxsCEZObOvEB-US8jztUDdSvOMGXWqY0LeeaFew"

# Keep each worksheet padded to this many rows so the native Google Sheets
# "add 1000 more rows" button stays far below the data, out of view.
MIN_ROWS = 1000

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
TODO_PATH = os.path.join(ROOT, "TODO.md")
DEFAULT_CREDS = os.path.join(ROOT, "service-account.json")

PRIORITY = {"🔴": "High", "🟠": "Medium", "🟡": "Low", "🟢": "Idea", "🔵": "Cosmetic"}
PRIO_RU = {"High": "Высокий", "Medium": "Средний", "Low": "Низкий",
           "Idea": "Идея", "Cosmetic": "Косметика", "": ""}
STATUS_RU = {"Done": "Готово", "Todo": "К выполнению"}
HEADER_RU = ["ID", "Приоритет", "Задача", "Детали задачи", "Статус", "Примечания"]
COL_WIDTHS = [60, 90, 250, 820, 120, 240]

# Section headings (substring, lower-cased) excluded from the sync entirely —
# they stay in TODO.md as backlog but get no worksheet/tab.
SKIP_SECTIONS = ["позже", "идеи"]

# Map a section heading (substring, lower-cased) -> short tab title, in order.
# More specific keys must precede generic ones (first match wins). Per-phase
# recommendation sections get their own tab so phases don't merge.
SECTION_TABS = [
    ("сквозная проверка", "Проверка модуля"),
    ("решение правительства: предложения", "Решения"),
    ("кредитные программы: предложения", "Кред. программы"),
    ("комиссии по заявкам: предложения", "Заявки"),
    ("заёмщики: предложения", "Заёмщики"),
    ("выдача кредитов: предложения", "Выдача кредитов"),
    ("освоение и транши: предложения", "Освоение/транши"),
    ("обслуживание", "Обслуживание"),
    # generic fallback — must stay LAST so phase-specific keys win first
    ("предложения по улучшению", "Решения"),
    ("позже", "Идеи / позже"),
    ("недавно сделано", "Сделано"),
]

# Colours (hex)
C_HEADER_BG = "#0b57d0"
C_HEADER_FG = "#ffffff"
PRIO_COLORS = {"Высокий": "#f4cccc", "Средний": "#fce5cd", "Низкий": "#fff2cc"}
STATUS_COLORS = {"Готово": "#d9ead3", "К выполнению": "#f3f3f3"}


def parse_todos(text):
    """TODO.md -> list of (section, id, priority_en, name, task, status_en, notes).

    The main `- [ ]` line becomes the short title (Наименование); indented
    sub-bullets fold into the details cell (Задача). For simple title-only items
    (no sub-bullets) a trailing " — note" is split off into Примечания.
    """
    rows, section = [], ""
    for raw in text.splitlines():
        line = raw.rstrip()
        heading = re.match(r"^#{2,3}\s+(.*)", line)
        if heading:
            section = heading.group(1).strip()
            continue
        item = re.match(r"^\s*-\s*\[([ xX])\]\s*(.*)", line)
        if not item:
            # Indented continuation (sub-bullet or wrapped text) folds into the
            # previous item's "Задача" details cell.
            cont = re.match(r"^\s+(?:[-*]\s+)?(\S.*)", line)
            if cont and rows:
                s, tid, prio, name, task, status, notes = rows[-1]
                extra = re.sub(r"\s+", " ", cont.group(1)).strip().replace("**", "")
                task = (task + "\n• " + extra) if task else "• " + extra
                rows[-1] = (s, tid, prio, name, task, status, notes)
            continue
        done = item.group(1).lower() == "x"
        rest = item.group(2).strip()
        idm = re.match(r"^(P\d+-R\d+|R\d+|Фаза\s*\d+|Phase\s*\d+)\b[:\-\s—–]*(.*)", rest)
        if idm:
            tid = re.sub(r"\s+", " ", idm.group(1))
            rest = idm.group(2).strip()
        else:
            tid = ""
        prio = ""
        for emoji, pname in PRIORITY.items():
            if emoji in rest:
                prio = pname
                rest = rest.replace(emoji, "").strip()
                break
        name = rest.replace("**", "").strip()
        rows.append((section, tid, prio, name, "",
                     "Done" if done else "Todo", ""))
    # Title-only items (no details): split a trailing " — note" into Примечания.
    out = []
    for s, tid, prio, name, task, status, notes in rows:
        if not task:
            for sep in (" — ", " – ", " - "):
                if sep in name:
                    name, notes = name.split(sep, 1)
                    break
        out.append((s, tid, prio, name.strip(), task.strip(), status, notes.strip()))
    return out


def tab_title(section):
    low = section.lower()
    for key, title in SECTION_TABS:
        if key in low:
            return title
    clean = re.sub(r"[^\w\s·/.-]", "", section).strip()
    return (clean[:40] or "Задачи")


def group_rows(rows):
    """Ordered: [(tab_title, [[ID, Приоритет, Задача, Статус, Примечания], ...])]."""
    groups, order = {}, []
    for section, tid, prio, name, task, status, notes in rows:
        low = section.lower()
        if any(skip in low for skip in SKIP_SECTIONS):
            continue
        title = tab_title(section)
        if title not in groups:
            groups[title] = []
            order.append(title)
        groups[title].append([tid, PRIO_RU.get(prio, prio), name, task,
                              STATUS_RU.get(status, status), notes])
    return [(t, groups[t]) for t in order]


def rgb(h):
    h = h.lstrip("#")
    return {"red": int(h[0:2], 16) / 255, "green": int(h[2:4], 16) / 255,
            "blue": int(h[4:6], 16) / 255}


def sheet_requests(sid, index, nrows):
    """Formatting batch requests for one worksheet."""
    ncols = len(HEADER_RU)
    reqs = [
        {"updateSheetProperties": {
            "properties": {"sheetId": sid, "index": index,
                           "gridProperties": {"frozenRowCount": 1}},
            "fields": "index,gridProperties.frozenRowCount"}},
        {"repeatCell": {
            "range": {"sheetId": sid, "startRowIndex": 0, "endRowIndex": 1,
                      "startColumnIndex": 0, "endColumnIndex": ncols},
            "cell": {"userEnteredFormat": {
                "backgroundColor": rgb(C_HEADER_BG), "horizontalAlignment": "CENTER",
                "verticalAlignment": "MIDDLE",
                "textFormat": {"bold": True, "foregroundColor": rgb(C_HEADER_FG),
                               "fontSize": 11}}},
            "fields": "userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)"}},
        {"repeatCell": {
            "range": {"sheetId": sid, "startRowIndex": 1, "startColumnIndex": 0,
                      "endColumnIndex": ncols},
            "cell": {"userEnteredFormat": {"wrapStrategy": "WRAP",
                                           "verticalAlignment": "MIDDLE"}},
            "fields": "userEnteredFormat(wrapStrategy,verticalAlignment)"}},
        {"updateBorders": {
            "range": {"sheetId": sid, "startRowIndex": 0, "endRowIndex": nrows,
                      "startColumnIndex": 0, "endColumnIndex": ncols},
            "top": {"style": "SOLID"}, "bottom": {"style": "SOLID"},
            "left": {"style": "SOLID"}, "right": {"style": "SOLID"},
            "innerHorizontal": {"style": "SOLID", "color": rgb("#d0d0d0")},
            "innerVertical": {"style": "SOLID", "color": rgb("#d0d0d0")}}},
    ]
    for col, width in enumerate(COL_WIDTHS):
        reqs.append({"updateDimensionProperties": {
            "range": {"sheetId": sid, "dimension": "COLUMNS",
                      "startIndex": col, "endIndex": col + 1},
            "properties": {"pixelSize": width}, "fields": "pixelSize"}})
    idx = 0
    for col, table in ((1, PRIO_COLORS), (4, STATUS_COLORS)):
        for value, hexbg in table.items():
            reqs.append({"addConditionalFormatRule": {"rule": {
                "ranges": [{"sheetId": sid, "startRowIndex": 1,
                            "startColumnIndex": col, "endColumnIndex": col + 1}],
                "booleanRule": {
                    "condition": {"type": "TEXT_EQ",
                                  "values": [{"userEnteredValue": value}]},
                    "format": {"backgroundColor": rgb(hexbg)}}}, "index": idx}})
            idx += 1
    return reqs


def main():
    ap = argparse.ArgumentParser(description="Push TODO.md to the Google Sheet.")
    ap.add_argument("--creds", default=os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", DEFAULT_CREDS))
    ap.add_argument("--key", default=SHEET_KEY)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    with open(TODO_PATH, encoding="utf-8") as f:
        groups = group_rows(parse_todos(f.read()))
    total = sum(len(r) for _, r in groups)
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    print(f"Parsed {total} rows into {len(groups)} tabs: " +
          ", ".join(f"{t} ({len(r)})" for t, r in groups))

    if args.dry_run:
        for title, rows in groups:
            print(f"\n=== {title} ===")
            for r in rows:
                print("  " + " | ".join((c or "")[:34] for c in r))
        return 0

    if not os.path.exists(args.creds):
        sys.exit(f"ERROR: credentials not found at {args.creds}. See scripts/README.md.")

    import gspread
    from google.oauth2.service_account import Credentials

    creds = Credentials.from_service_account_file(
        args.creds, scopes=["https://www.googleapis.com/auth/spreadsheets"])
    sa_email = getattr(creds, "service_account_email", "<unknown>")
    gc = gspread.authorize(creds)

    try:
        sh = gc.open_by_key(args.key)
        existing = {ws.title: ws for ws in sh.worksheets()}
        wanted = [t for t, _ in groups]

        # Ensure a worksheet per group (reuse or create), then write values.
        sheets = []
        for title, rows in groups:
            need = max(len(rows) + 1, MIN_ROWS)
            if title in existing:
                ws = existing[title]
                ws.resize(rows=need, cols=len(HEADER_RU) + 2)
                ws.clear()
            else:
                ws = sh.add_worksheet(title=title, rows=need,
                                      cols=len(HEADER_RU) + 2)
            ws.update(values=[HEADER_RU] + rows, range_name="A1")
            sheets.append((ws, rows))

        # Stamp sync time on the first tab.
        if sheets:
            sheets[0][0].update(values=[[f"Обновлено {ts} из TODO.md"]], range_name="G1")

        # Remove leftover tabs not in our set.
        for title, ws in existing.items():
            if title not in wanted:
                sh.del_worksheet(ws)

        # One batched formatting pass for all tabs.
        requests = []
        for index, (ws, rows) in enumerate(sheets):
            requests += sheet_requests(ws.id, index, len(rows) + 1)
        sh.batch_update({"requests": requests})

    except gspread.exceptions.APIError as e:
        if "PERMISSION_DENIED" in str(e) or "403" in str(e):
            sys.exit(f"ERROR: permission denied. Share the Sheet (Editor) with:\n    {sa_email}\n({e})")
        raise

    print(f"✅ Synced {total} rows into {len(groups)} tabs -> "
          f"https://docs.google.com/spreadsheets/d/{args.key}/edit")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
