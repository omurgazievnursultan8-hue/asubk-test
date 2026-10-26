#!/usr/bin/env python3
"""Оболочка страниц формата 3 (docs/tasks/FORMAT.md §11): остров JSON — источник, остальное — шаблон.

    python3 scripts/f3_page.py tz    requirements/tz/20-otchetnost.html            # обновить оболочку
    python3 scripts/f3_page.py tz    requirements/tz/20-otchetnost.html --island tz.json
    python3 scripts/f3_page.py tasks docs/tasks/p23-otchetnost-tasks.html [--island tasks.json]

Без --island остров берётся из самого файла и не меняется ни на байт; с --island файл
собирается заново из JSON. Шаблоны — docs/tasks/f3/<вид>-template.html.

Страница задач несёт ещё снимок ТЗ (#tz-snapshot): тексты пунктов, экраны, сущности,
связи, словарь и контрольный набор — карточка показывает их, не открывая ТЗ. Снимок
собирается заново при каждой сборке; check_tasks.py роняет страницу с устаревшим снимком.
"""
import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KINDS = {"tz": "tz-data", "tasks": "tasks-data"}
SNAPSHOT_ID = "tz-snapshot"
# Что из ТЗ нужно карточке. Назначение, вопросы заказчику и meta остаются только в ТЗ.
SNAPSHOT_KEYS = ("glossary", "entities", "chapters", "interfaces", "access", "common", "dataset")


def island_re(island_id):
    return re.compile(r'<script\b(?=[^>]*\bid="' + island_id + r'")(?=[^>]*\btype="application/json")'
                      r'[^>]*>.*?</script>', re.S)


def read_island(raw, island_id):
    m = island_re(island_id).search(raw)
    if not m:
        return None, None
    block = m.group(0)
    return block, json.loads(re.sub(r"^<script[^>]*>|</script>$", "", block).replace("<\\/", "</"))


def script_block(island_id, data):
    body = json.dumps(data, ensure_ascii=False, indent=1).replace("</", "<\\/")
    return f'<script type="application/json" id="{island_id}">\n{body}\n</script>'


def snapshot(tz, name):
    """Снимок ТЗ для страницы задач — одна и та же функция у сборщика и у валидатора."""
    snap = {"src": name, "date": (tz.get("meta") or {}).get("date", "")}
    for key in SNAPSHOT_KEYS:
        if key in tz:
            snap[key] = tz[key]
    return snap


def find_tz(package):
    """ТЗ — файл пакета с островом tz-data. Ищется по голому имени, как ссылки пакета."""
    for name in package or []:
        if not str(name).endswith(".html"):
            continue
        for path in [ROOT / "requirements" / "tz" / name, *ROOT.glob(f"**/{name}")]:
            if ".claude" in path.relative_to(ROOT).parts or not path.is_file():
                continue
            _, tz = read_island(path.read_text(encoding="utf-8"), "tz-data")
            if tz is not None:
                return path, tz
    return None, None


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
        block = script_block(island_id, data)
    else:
        if not a.page.exists():
            sys.exit(f"{a.page}: no such file — pass --island to build it")
        block, data = read_island(a.page.read_text(encoding="utf-8"), island_id)
        if block is None:
            sys.exit(f"{a.page}: no #{island_id} island")
    title = (data.get("meta") or {}).get("title", "")
    prefix = "ТЗ" if a.kind == "tz" else "Задачи"
    page = template.replace("{{TITLE}}", f"{prefix} · {title} · АСУБК").replace("{{ISLAND}}", block)
    if a.kind == "tasks":
        tz_path, tz = find_tz((data.get("meta") or {}).get("package"))
        if tz is None:
            sys.exit(f"{a.page}: no ТЗ with a tz-data island in meta.package")
        page = page.replace("{{SNAPSHOT}}", script_block(SNAPSHOT_ID, snapshot(tz, tz_path.name)))
    a.page.write_text(page, encoding="utf-8")
    print(f"{a.page}: {len(page) // 1024} KB")


if __name__ == "__main__":
    main()
