#!/usr/bin/env python3
"""Оболочка страниц формата 3 (docs/tasks/FORMAT.md §11): остров JSON — источник, остальное — шаблон.

    python3 scripts/f3_page.py tz    requirements/tz/20-otchetnost.html            # обновить оболочку
    python3 scripts/f3_page.py tz    requirements/tz/20-otchetnost.html --island tz.json
    python3 scripts/f3_page.py tasks docs/tasks/p23-otchetnost-tasks.html [--island tasks.json]

Без --island остров берётся из самого файла и не меняется ни на байт; с --island файл
собирается заново из JSON. Шаблоны — docs/tasks/f3/<вид>-template.html.
"""
import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KINDS = {"tz": "tz-data", "tasks": "tasks-data"}


def island_re(island_id):
    return re.compile(r'<script\b(?=[^>]*\bid="' + island_id + r'")(?=[^>]*\btype="application/json")'
                      r'[^>]*>.*?</script>', re.S)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("kind", choices=sorted(KINDS))
    ap.add_argument("page", type=Path)
    ap.add_argument("--island", type=Path, help="JSON file to build the page from")
    a = ap.parse_args()

    island_id = KINDS[a.kind]
    template = (ROOT / "docs" / "tasks" / "f3" / f"{a.kind}-template.html").read_text(encoding="utf-8")
    if a.island:
        data = json.loads(a.island.read_text(encoding="utf-8"))
        body = json.dumps(data, ensure_ascii=False, indent=1).replace("</", "<\\/")
        block = f'<script type="application/json" id="{island_id}">\n{body}\n</script>'
    else:
        if not a.page.exists():
            sys.exit(f"{a.page}: no such file — pass --island to build it")
        m = island_re(island_id).search(a.page.read_text(encoding="utf-8"))
        if not m:
            sys.exit(f"{a.page}: no #{island_id} island")
        block = m.group(0)
        data = json.loads(re.sub(r"^<script[^>]*>|</script>$", "", block).replace("<\\/", "</"))
    title = (data.get("meta") or {}).get("title", "")
    prefix = "ТЗ" if a.kind == "tz" else "Задачи"
    page = template.replace("{{TITLE}}", f"{prefix} · {title} · АСУБК").replace("{{ISLAND}}", block)
    a.page.write_text(page, encoding="utf-8")
    print(f"{a.page}: {len(page) // 1024} KB")


if __name__ == "__main__":
    main()
