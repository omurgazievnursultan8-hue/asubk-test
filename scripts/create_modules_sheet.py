#!/usr/bin/env python3
"""Create a new Google Sheet with one tab per credit-module (19 modules).

Creates a fresh spreadsheet owned by the service account, adds a worksheet for
each module below, deletes the default "Sheet1", and shares the file (Editor)
with SHARE_EMAIL so a human can open it.

Usage:
    python3 scripts/create_modules_sheet.py
    python3 scripts/create_modules_sheet.py --dry-run
    python3 scripts/create_modules_sheet.py --creds /path/to/key.json
"""
import argparse
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DEFAULT_CREDS = os.path.join(ROOT, "service-account.json")

TITLE = "ASUBK — Модули кредитного модуля"
SHARE_EMAIL = "omurgazievnursultan8@gmail.com"

MODULES = [
    "Модуль оформления кредитной документации",
    "Модуль оформления залоговой документации",
    "Модуль управления кредитной информацией",
    "Модуль управления залоговой информацией",
    "Модуль мониторинга задолженности по кредитам",
    "Модуль управления реструктуризацией",
    "Модуль мониторинга залога",
    "Модуль учёта и сверки платежей",
    "Модуль взыскания",
    "Модуль управления пользователями",
    "Модуль управления справочниками",
    "Модуль управления информацией о сотрудниках",
    "Модуль распределения кураторства",
    "Модуль интеграции с внешними системами",
    "Модуль управления организационной структурой",
    "Модуль управления информацией о ведомстве",
    "Модуль расчётов",
    "Модуль классификации",
    "Модуль анализа",
]

# Google Sheets caps tab titles at 100 chars; all of ours are well under.


def main():
    ap = argparse.ArgumentParser(description="Create the modules Google Sheet.")
    ap.add_argument("--creds", default=os.environ.get(
        "GOOGLE_APPLICATION_CREDENTIALS", DEFAULT_CREDS))
    ap.add_argument("--title", default=TITLE)
    ap.add_argument("--share", default=SHARE_EMAIL)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    print(f"Title: {args.title}")
    print(f"Tabs ({len(MODULES)}):")
    for i, m in enumerate(MODULES, 1):
        print(f"  {i:>2}. {m}")

    if args.dry_run:
        return 0

    if not os.path.exists(args.creds):
        sys.exit(f"ERROR: credentials not found at {args.creds}. See scripts/README.md.")

    import gspread
    from google.oauth2.service_account import Credentials

    creds = Credentials.from_service_account_file(args.creds, scopes=[
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
    ])
    sa_email = getattr(creds, "service_account_email", "<unknown>")
    gc = gspread.authorize(creds)

    sh = gc.create(args.title)

    # Add a worksheet per module, then drop the default first sheet.
    for name in MODULES:
        sh.add_worksheet(title=name, rows=1000, cols=12)
    default = sh.sheet1
    if default.title not in MODULES:
        sh.del_worksheet(default)

    # Share (Editor) so a human can open it.
    try:
        sh.share(args.share, perm_type="user", role="writer",
                 notify=True, email_message="Новый файл: модули кредитного модуля")
    except Exception as e:
        print(f"⚠️  Share to {args.share} failed ({e}). "
              f"File owned by {sa_email}; share manually if needed.")

    print(f"✅ Created '{args.title}' with {len(MODULES)} tabs "
          f"(owner {sa_email}, shared Editor -> {args.share})")
    print(f"   https://docs.google.com/spreadsheets/d/{sh.id}/edit")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
