#!/usr/bin/env python3
"""Rewrite Порядок citations in one artifact to the numbering in force (№41).

This is the executing half of `check_points.py` and deliberately shares its
machinery: the same CITATION / POINT_FIELD regexes, the same ignore markers, the
same MAPPING. Coverage therefore matches by construction — whatever the checker
sees, the migrator rewrites; whatever it skips, the migrator leaves alone. A
hand-rolled sed would have to re-derive both, and would drift on the first edit
to either.

Three things it refuses to guess, printing them for a decision instead:

  * points with no analogue in the redaction (92, 98, 99) — the rule itself is
    gone, so the sentence around the citation has to be rewritten, not the number;
  * a bare «п. 20» — the old point split into new 19 and 20, and only the prose
    says which half is meant;
  * a range that would collapse («пп. 48–49» → «пп. 48–48»).

The pass is NOT idempotent — 17→16 applied twice gives 15. A file already listed
in `MIGRATED` is refused for that reason. The intended cycle is: migrate one
file → add it to `MIGRATED` in check_points.py → run the checker → commit.

Usage:
    python3 scripts/migrate_points.py --dry-run <path>...
    python3 scripts/migrate_points.py <path>...
    python3 scripts/migrate_points.py --stats <path>...   # what is cited, no edits
"""
import argparse
import sys
from collections import Counter
from pathlib import Path

from check_points import MAPPING, PROJECT_BASIS, ROOT, Scanner, is_migrated

DASHES = "–—-"

# Old points that cannot be renumbered because the norm dropped the rule. The
# text has to change, so the migrator stops on them by name rather than silently
# leaving a number that looks migrated.
NO_ANALOGUE = {k for k, v in MAPPING.items() if v is None}

# The old п. 20 spans new 19 and 20 — see the comment in check_points.MAPPING.
AMBIGUOUS = {"20"}


def plan_line(line, spans):
    """→ (new_line, [(old, new)], [(value, reason)]) for one already-scanned line."""
    edits, manual = [], []

    for start, end, value, _kind in spans:
        if PROJECT_BASIS.match(value):
            continue
        if value in NO_ANALOGUE:
            manual.append((value, "аналога в редакции нет — переписать формулировку"))
            continue
        if value in AMBIGUOUS:
            manual.append((value, "старый п. 20 разошёлся на 19 и 20 — решить по смыслу"))
            continue
        new = MAPPING.get(value)
        if new is None or new == value:
            continue
        edits.append(((start, end), value, new))

    # «пп. 48–49» would come out as «пп. 48–48»: a range whose ends land on the same
    # point is no longer a range, and only the prose says what to write.
    by_span = {span: new for span, _, new in edits}
    for left, right in zip(spans, spans[1:]):
        joined = any(d in line[left[1]:right[0]] for d in DASHES)
        new_l, new_r = by_span.get(left[:2]), by_span.get(right[:2])
        if joined and new_l and new_l == new_r:
            manual.append((f"{left[2]}–{right[2]}", f"диапазон схлопывается в {new_l}"))
            edits = [e for e in edits if e[0] not in (left[:2], right[:2])]

    out = line
    for (start, end), _, new in sorted(edits, key=lambda e: e[0][0], reverse=True):
        out = out[:start] + new + out[end:]
    return out, [(old, new) for _, old, new in edits], manual


def migrate(path, dry_run, kinds=None):
    """→ (changed_lines, [(line_no, old, new)], [(line_no, value, reason)])."""
    rel = path.relative_to(ROOT)
    lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
    out, edits, manual, touched = [], [], [], 0
    scanner = Scanner()

    for n, raw in enumerate(lines, 1):
        line = raw.rstrip("\n")
        tail = raw[len(line):]
        spans = scanner.feed(line)
        if kinds:
            spans = [s for s in spans if s[3] in kinds]
        if spans:
            new_line, line_edits, line_manual = plan_line(line, spans)
            edits += [(n, old, new) for old, new in line_edits]
            manual += [(n, value, why) for value, why in line_manual]
            if new_line != line:
                touched += 1
                line = new_line
        out.append(line + tail)

    if touched and not dry_run:
        path.write_text("".join(out), encoding="utf-8")
    return rel, touched, edits, manual


def stats(path):
    rel = path.relative_to(ROOT)
    counter, scanner = Counter(), Scanner()
    for raw in path.read_text(encoding="utf-8").splitlines():
        for _, _, value, _kind in scanner.feed(raw):
            if not PROJECT_BASIS.match(value):
                counter[value] += 1
    print(f"\n{rel}")
    for value, count in sorted(counter.items(), key=lambda kv: (-kv[1], kv[0])):
        target = MAPPING.get(value, "?")
        if value in NO_ANALOGUE:
            mark = "✗ аналога нет"
        elif value in AMBIGUOUS:
            mark = "? разошёлся"
        elif target == "?":
            mark = "· вне таблицы"
        elif target == value:
            mark = "= без изменений"
        else:
            mark = f"→ {target}"
        print(f"  п. {value:<6} {count:>3}×  {mark}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("paths", nargs="+", help="файлы для перевода на нумерацию №41")
    ap.add_argument("--dry-run", action="store_true", help="показать правки, ничего не писать")
    ap.add_argument("--stats", action="store_true", help="что цитируется в файле, без правок")
    ap.add_argument("--force", action="store_true", help="разрешить файл, уже помеченный MIGRATED")
    # Догоняющий проход по одному виду цитат: проза уже переведена, а голые номера
    # в колонке «пункт» вскрылись позже. Без него пришлось бы гнать файл целиком —
    # и проза уехала бы вторым сдвигом.
    ap.add_argument("--kind", action="append", choices=["текст", "point:", "таблица"],
                    help="переводить только цитаты этого вида (можно повторять)")
    args = ap.parse_args()

    paths = []
    for raw in args.paths:
        path = Path(raw) if Path(raw).is_absolute() else ROOT / raw
        if not path.exists():
            sys.exit(f"нет файла: {raw}")
        rel = str(path.relative_to(ROOT))
        if is_migrated(rel) and not (args.force or args.stats):
            sys.exit(f"{rel} уже переведён (MIGRATED) — повторный проход сдвинет номера второй раз")
        paths.append(path)

    if args.stats:
        for path in paths:
            stats(path)
        return 0

    total_edits, total_manual = 0, 0
    for path in paths:
        rel, touched, edits, manual = migrate(path, args.dry_run, args.kind)
        head = "БЫЛО БЫ" if args.dry_run else "ПЕРЕВЕДЕНО"
        print(f"\n{rel} — {head}: {len(edits)} цитат в {touched} строках")
        moves = Counter((old, new) for _, old, new in edits)
        for (old, new), count in sorted(moves.items(), key=lambda kv: -kv[1]):
            print(f"  п. {old} → п. {new}   ×{count}")
        if manual:
            print(f"  РУКАМИ ({len(manual)}):")
            for line_no, value, why in manual:
                print(f"    {rel}:{line_no}  п. {value} — {why}")
        total_edits += len(edits)
        total_manual += len(manual)

    print(f"\nИТОГО: {total_edits} цитат переведено · {total_manual} требуют решения руками")
    if not args.dry_run and total_edits:
        print("Дальше: внести файл в MIGRATED в check_points.py и прогнать проверку.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
