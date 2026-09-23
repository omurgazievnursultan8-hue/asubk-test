#!/usr/bin/env python3
"""Sync the 12 copied module specs in docs/logika/ with their originals in mockups/.

Files 01-04 and 17-24 are written in docs/logika/ itself and are never touched here.
Files 05-16 are copies of mockups/*/ASUBK-*-logika.md, kept in one folder for export.

    python3 scripts/logika_sync.py           # report drift, exit 1 if any
    python3 scripts/logika_sync.py --write   # overwrite the copies from the originals
"""
import hashlib
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / "docs" / "logika"

# copy name in docs/logika  ->  original path relative to repo root
PAIRS = {
    "05-subekt.md":              "mockups/subject/ASUBK-subekt-logika.md",
    "06-zaemshchik.md":          "mockups/borrower/ASUBK-zaemshik-logika.md",
    "07-kredit.md":              "mockups/loan-credit/ASUBK-kredit-logika.md",
    "08-raschetnoe-yadro.md":    "mockups/calc-core/ASUBK-raschetnoe-yadro-logika.md",
    "09-platezhi.md":            "mockups/payments/ASUBK-platezhi-logika.md",
    "10-zalog.md":               "mockups/collateral/ASUBK-zalog-logika.md",
    "11-restrukturizatsiya.md":  "mockups/restructuring/ASUBK-restrukturizatsiya-logika.md",
    "12-vzyskanie.md":           "mockups/collection/ASUBK-vzyskanie-logika.md",
    "13-klassifikatsiya.md":     "mockups/classification/ASUBK-klassifikatsiya-logika.md",
    "14-finansovyy-analiz.md":   "mockups/analysis/ASUBK-analiz-logika.md",
    "15-statistika.md":          "mockups/statistics/ASUBK-statistika-logika.md",
    "16-otchetnost.md":          "mockups/reports/ASUBK-otchetnost-logika.md",
}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    write = "--write" in sys.argv[1:]
    drift, missing = [], []

    for name, rel in PAIRS.items():
        src, dst = ROOT / rel, DEST / name
        if not src.exists():
            missing.append(f"{rel} — оригинал не найден")
            continue
        if not dst.exists() or digest(src) != digest(dst):
            drift.append((name, rel, dst.exists()))

    for m in missing:
        print(f"ОШИБКА: {m}")

    if not drift:
        print(f"Все {len(PAIRS)} копий совпадают с оригиналами.")
        return 1 if missing else 0

    for name, rel, existed in drift:
        mark = "расходится" if existed else "отсутствует"
        if write:
            shutil.copyfile(ROOT / rel, DEST / name)
            print(f"обновлено: {name}  ←  {rel}  ({mark})")
        else:
            print(f"{mark}: {name}  ←  {rel}")

    if not write:
        print(f"\nРасхождений: {len(drift)}. Перезалить: scripts/logika_sync.py --write")
        return 1
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
