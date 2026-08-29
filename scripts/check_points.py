#!/usr/bin/env python3
"""Validate every reference to a Порядок point against the redaction in force.

The collection module was written against a superseded redaction of «Порядок
мониторинга, взыскания и урегулирования задолженности по бюджетным кредитам»
(described in our materials as «99 пунктов, 17 глав»). The redaction in force is
№41 of 06.07.2026 — 16 chapters, 69 points. Some numbers survived the move
(21, 30, 32, 33, 44, 9), which is worse than a clean break: a citation that is
half right does not catch the eye. This script turns "did we miss one" into a
check.

It does three things:

1. parses the normative source (`docs/normativ/*.txt`) into the real set of
   points and subpoints — points are recognised by strict sequence 1..N, so
   chapter headings ("8. Судебные мероприятия") cannot be mistaken for them;
2. pulls every citation out of the module's artifacts — prose (`п. 20.4`,
   `пп. 22–24`, `пункт 16`) and the `point:` fields of DEADLINE_TEMPLATES /
   GATES in the mockup;
3. sorts them into three buckets:

   ❌ the point does not exist in the redaction in force — always fails;
   ⚠️  the point exists but stands in the renumbering table of the сверка as
      moved, i.e. it most likely still means the old point — fails under
      --strict;
   ✓  everything else.

References to ADR clauses (`ADR-0053` п. 2) and to project decisions
(`Р-8`, `Р-9`, `Р-11`) are not Порядок citations and are counted separately.

Usage:
    python3 scripts/check_points.py
    python3 scripts/check_points.py --strict     # moved points fail the run too
    python3 scripts/check_points.py --list       # dump the parsed points and exit
    python3 scripts/check_points.py --map        # print the renumbering table and exit
"""
import argparse
import re
import sys
from fnmatch import fnmatch
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "docs" / "normativ" / "poryadok-2026-07-06-N41.txt"
SVERKA = "docs/normativ/2026-08-04-sverka-red-N41.md"

# Artifacts that cite the Порядок. Globs are resolved relative to the repo root.
SCANNED = [
    "mockups/collection/ASUBK-vzyskanie-logika.md",
    "mockups/collection/ASUBK-status-razrabotki.md",
    "mockups/collection/collection.html",
    "mockups/classification/classification.html",
    "mockups/classification/ASUBK-klassifikatsiya-logika.md",
    "mockups/classification/ASUBK-status-razrabotki.md",
    "scripts/inspect/classification-check.mjs",
    "mockups/reports/ASUBK-otchetnost-logika.md",
    "mockups/reports/ASUBK-otchetnost-katalog.md",
    "mockups/reports/ASUBK-status-razrabotki.md",
    "mockups/reports/reports.html",
    "scripts/inspect/reports-check.mjs",
    "requirements/tz/13-collection.html",
    "docs/tasks/p14-collection-tasks.html",
    "docs/adr/*.md",
    "docs/voprosy-zakazchiku/2026-08-04-vzyskanie.md",
    "docs/voprosy-zakazchiku/2026-08-09-vzyskanie.md",
    "docs/voprosy-zakazchiku/2026-08-26-otchetnost.md",
    "scripts/inspect/collection-check.mjs",
    "STATUS.md",
    "TODO.md",
    "CONTEXT.md",
    "mockups/analysis/ASUBK-analiz-logika.md",
    "mockups/analysis/ASUBK-status-razrabotki.md",
    "mockups/analysis/analysis.html",
    "scripts/inspect/analysis-check.mjs",
    "docs/tasks/p21-analiz-tasks.html",
]

# Files already carried over to the numbering in force. They are still checked for
# points that do not exist, but not against the renumbering table: a bare «п. 17»
# there means the new point 17, not the old one the table would map away. The
# sweep moves files in here one at a time, and the count below is the progress bar.
MIGRATED = {
    "docs/voprosy-zakazchiku/2026-08-04-vzyskanie.md",
    "docs/voprosy-zakazchiku/2026-08-09-vzyskanie.md",
    "docs/voprosy-zakazchiku/2026-08-26-otchetnost.md",
    "mockups/collection/ASUBK-vzyskanie-logika.md",
    "docs/adr/*.md",
    "mockups/collection/ASUBK-status-razrabotki.md",
    "requirements/tz/13-collection.html",
    "docs/tasks/p14-collection-tasks.html",
    "STATUS.md",
    "TODO.md",
    "mockups/collection/collection.html",
    "mockups/classification/classification.html",
    "mockups/classification/ASUBK-klassifikatsiya-logika.md",
    "mockups/classification/ASUBK-status-razrabotki.md",
    "scripts/inspect/classification-check.mjs",
    "scripts/inspect/collection-check.mjs",
    "mockups/reports/ASUBK-otchetnost-logika.md",
    "mockups/reports/ASUBK-otchetnost-katalog.md",
    "mockups/reports/ASUBK-status-razrabotki.md",
    "mockups/reports/reports.html",
    "scripts/inspect/reports-check.mjs",
    "CONTEXT.md",
    "mockups/analysis/ASUBK-analiz-logika.md",
    "mockups/analysis/ASUBK-status-razrabotki.md",
    "mockups/analysis/analysis.html",
    "scripts/inspect/analysis-check.mjs",
    "docs/tasks/p21-analiz-tasks.html",
}

# Deliberately out of scope, with the reason — printed so the exclusion stays honest.
EXCLUDED = {
    "docs/normativ/*.md": "сверка сама цитирует СТАРЫЕ номера в левой колонке",
    "docs/voprosy-zakazchiku/2026-08-02-vzyskanie.md": "письмо отменено 04.08.2026",
    "requirements/legacy/*": "описывает старую систему, не наш Порядок",
}

# Renumbering table — §3 of the сверка. Value is the point in the redaction in
# force, or None when the norm has no analogue at all.
#
# Points whose number survived unchanged are listed with themselves: that is what
# tells the checker "this citation is fine as it stands" instead of guessing.
MAPPING = {
    "6.5": "6.5",      # number kept; it is the list of monitoring kinds — no 10 р.д. term there
    "9": "9",          # number kept; the term changed (до 1 сентября, not до 1 июля)
    "12": "11",        # risk-category factors
    "12.2": "11.2",
    "13": "12",
    "14": "13",
    "15": "14",
    "16": "15",
    "16.1": "15.1",
    "16.2": "15.2",
    "17": "16",
    # Bare «п. 20» is deliberately absent: the old point spanned new 19 and 20
    # (20.1/20.2 → 19.1/19.2, but 20.3/20.4 → 20.1). Its subpoints are mapped
    # below; a bare citation has to be read by hand.
    "17.1": "16.1",    # 6-й день → 1-й день, see сверка §4.1
    "17.2": "16.2",
    "17.3": "16.3",
    "17.4": "16.4",
    "17.5": "16.5",
    "17.6": "19.2",
    "18": "17",        # гарантийное письмо, see сверка §4.2
    "19": "18",        # реструктуризация
    "20.1": "19.1",
    "20.2": "19.2",
    "20.3": "20.1",
    "20.4": "20.1",    # ускорение больше не решение, а следствие извещения (§4.6)
    "21": "21",
    "22": "23",        # мировое начинается с 23; 22 — судебная защита
    "23": "23",
    "24": "24",
    "30.1": "30.1",
    "30.2": "30.2",
    "30.3": "30.3",
    "32": "32",
    "33": "33",
    "36": "37",        # подтверждение при полном погашении; 36 теперь — возврат ИЛ
    "37": "38",        # соглашение о добровольном исполнении
    "42": "43",        # запрет внесудебного порядка
    "44": "44",
    "48": "48",
    "49": "48",        # распределение выручки (состав другой, §4.9)
    "65": "53",
    "69": "58",
    "70": "59",
    "71": "60",
    "72": "61",
    "83": "62",        # признание безнадёжной — теперь пп. 62–63
    "88": "64",
    # Основания безнадёжности («умершие субъекты», «отсутствующие / недееспособные»)
    # редакция №41 не перечисляет: п. 62 отсылает к отдельному Порядку признания
    # задолженности безнадёжной к взысканию, утверждаемому Минфином. Документа у нас
    # нет — он запрошен письмом от 04.08.2026, часть III.
    "79": None,
    "80": None,
    "87": None,
    "92": None,        # конфликт интересов: гл. 15 без процедуры (§4.10)
    "98": None,        # общего рукопожатия при передаче не существует (§4.11)
    "99": None,        # в редакции 69 пунктов
}


def is_migrated(rel):
    """MIGRATED holds paths and globs — `docs/adr/*.md` moves 25 files at once."""
    return any(fnmatch(str(rel), pattern) for pattern in MIGRATED)


# Values of `point:` that are project decisions, not norm — not an error.
PROJECT_BASIS = re.compile(r"^(Р-\d+|ADR-\d{4}.*|—|-)$")

# Passages that talk ABOUT the renumbering — the warning blocks in the headers of
# the spec, the mockup and the ТЗ — cite old numbers on purpose. They opt out
# with a marker; a whole block is skipped between start and end.
IGNORE_LINE = "check_points:ignore"
IGNORE_START = "check_points:ignore-start"
IGNORE_END = "check_points:ignore-end"

# One citation may name several points — «пп. 62–63», «п. 21, 65», «пп. 60, 72, Р-11».
# The whole enumeration is captured as one group and the numbers are pulled out of it
# afterwards; matching them separately would miss every number after the first, and a
# half-renumbered list («пп. 60, 72») is worse than an untouched one.
_NUM = r"\d+(?:\.\d+)?"
# «п. 98, 5 р.д.» — the 5 is a term, not a second point. A unit right after a number
# ends the enumeration there.
_NOT_UNIT = r"(?!\s*(?:р\.\s*д|к\.\s*д|дн|дней|день|%|мес|лет|год))"
_ITEM = rf"{_NUM}{_NOT_UNIT}(?:\s*[–—-]\s*{_NUM}{_NOT_UNIT})?"
# Косая черта — то же перечисление: «п. 42/48/49», «пп. 18/19». Дважды за проход
# оно оставляло после себя ссылку, переведённую наполовину.
CITATION = re.compile(
    rf"(?<![\w–—-])(?:пп?\.|пункт(?:а|ом|у|ы|ах|ов)?)\s*№?\s*({_ITEM}(?:\s*[,/]\s*{_ITEM})*)"
)
NUMBER = re.compile(_NUM)
POINT_FIELD = re.compile(r"point:\s*'([^']*)'")
ADR_NEARBY = re.compile(r"ADR[-\s]?\d{4}[^.;)]{0,20}$")

# A markdown table whose column is headed «пункт» carries the numbers bare — «17.5»,
# «22–24» — with no «п.» to key on. Three such tables in the spec survived the first
# sweep untouched while the checker called the file clean, which is exactly the
# failure mode this script exists to prevent.
TABLE_HEADS = {"пункт", "пункты", "пункт порядка", "п."}
CELL_IS_POINTS = re.compile(r"^[\s\d.,;–—-]*\d[\s\d.,;–—-]*$")
SEPARATOR_CELL = re.compile(r"^:?-{2,}:?$")


# Page 1 of the PDF has no text layer (it is the approval page). It carries
# гл. 1 «Общие положения» — пп. 1–2 — and the opening of п. 3 «Используемые
# понятия и термины», whose definition list runs on into page 2. So the text
# extraction begins in the middle of п. 3 and the first point it can see is 4.
PREFACE_POINTS = {"1", "2", "3"}
FIRST_PARSED_POINT = 4
LAST_POINT = 69


def parse_source(path):
    """Return ({points}, {subpoints}) parsed from the plain-text Порядок.

    A line opens a new point only when its number is exactly the next one
    expected and it is not centred — chapter headings repeat low numbers
    ("8. Судебные мероприятия" while point 21 is due) and would otherwise be
    read as points. Inside a point, `1)` and `1.` items are its subpoints; the
    same strict sequence keeps those lists from being mistaken for points.

    The result is asserted against the known shape of the document: points must
    run contiguously to the last one. A silently short parse is what makes a
    checker report "all clean" on a file it never read.
    """
    if not path.exists():
        sys.exit(f"нет источника: {path.relative_to(ROOT)} — сначала положите редакцию в docs/normativ/")
    points, subpoints = set(PREFACE_POINTS), set()
    expected, current, expected_sub = FIRST_PARSED_POINT, None, 1
    for raw in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^(\s*)(\d+)\.\s+\S", raw)
        if m and len(m.group(1)) < 15 and int(m.group(2)) == expected:
            current, expected_sub = expected, 1
            points.add(str(current))
            expected += 1
            continue
        if current is None:
            continue
        # Subpoints run 1, 2, 3 … inside their point. The sequence is what tells
        # them from a chapter heading: «9. Обращение взыскания…» sits at the same
        # indent as a list item, but no point opens its list at 9.
        s = re.match(r"^\s*(\d+)[).]\s+\S", raw)
        if s and int(s.group(1)) == expected_sub:
            subpoints.add(f"{current}.{expected_sub}")
            expected_sub += 1

    missing = [str(n) for n in range(1, LAST_POINT + 1) if str(n) not in points]
    if missing or expected != LAST_POINT + 1:
        sys.exit(
            f"разбор источника не сошёлся: найдено {len(points)} пунктов, ждали {LAST_POINT}"
            + (f"; не найдены: {', '.join(missing)}" if missing else "")
            + f"\nисточник: {path.relative_to(ROOT)}"
        )
    return points, subpoints


def iter_files():
    seen = set()
    for pattern in SCANNED:
        matches = sorted(ROOT.glob(pattern)) if "*" in pattern else [ROOT / pattern]
        for path in matches:
            if path.exists() and path not in seen:
                seen.add(path)
                yield path


def row_cells(line):
    """→ [(start, end, text)] for a markdown table row, else None."""
    if not line.lstrip().startswith("|"):
        return None
    cells, pos = [], line.index("|") + 1
    while (nxt := line.find("|", pos)) != -1:
        cells.append((pos, nxt, line[pos:nxt]))
        pos = nxt + 1
    return cells or None


class Scanner:
    """Per-file scanner yielding (start, end, value, kind) spans within a line.

    Both the checker and the migrator read a file through this, so the set of
    citations one validates is by construction the set the other rewrites. It is
    stateful because two things span lines: the ignore blocks, and the header of a
    markdown table that tells which column holds point numbers.
    """

    def __init__(self):
        self.skipping = False
        self.prev_cells = None
        self.point_cols = ()

    def feed(self, line):
        if IGNORE_START in line:
            self.skipping = True
            return []
        if IGNORE_END in line:
            self.skipping = False
            return []
        if self.skipping or IGNORE_LINE in line:
            return []

        found = []
        for m in CITATION.finditer(line):
            # `ADR-0053` п. 2 cites an ADR clause, not the Порядок.
            if ADR_NEARBY.search(line[: m.start()]):
                continue
            base = m.start(1)
            for num in NUMBER.finditer(m.group(1)):
                found.append((base + num.start(), base + num.end(), num.group(0), "текст"))
        for m in POINT_FIELD.finditer(line):
            found.append((*m.span(1), m.group(1), "point:"))

        cells = row_cells(line)
        if cells is None:
            self.prev_cells, self.point_cols = None, ()
        elif all(SEPARATOR_CELL.match(c.strip()) for _, _, c in cells) and self.prev_cells:
            self.point_cols = tuple(
                i for i, (_, _, c) in enumerate(self.prev_cells)
                if c.strip().lower() in TABLE_HEADS
            )
        else:
            for i in self.point_cols:
                if i >= len(cells):
                    continue
                start, _, text = cells[i]
                if CELL_IS_POINTS.match(text):
                    for num in NUMBER.finditer(text):
                        found.append((start + num.start(), start + num.end(), num.group(0), "таблица"))
            self.prev_cells = cells
        return sorted(found)


def citations(path):
    """Yield (line_no, raw_citation, kind) for one file."""
    scanner = Scanner()
    for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        for _, _, value, kind in scanner.feed(line):
            yield n, value, kind


def classify(value, points, subpoints, migrated=False):
    """→ (bucket, note). Buckets: ok · moved · missing · project."""
    if PROJECT_BASIS.match(value):
        return "project", "проектное основание, не норма"
    known = value in points or value in subpoints
    target = MAPPING.get(value, "?")
    if target is None and not (migrated and known):
        return "missing", f"аналога в редакции нет — см. {SVERKA}"
    if not known:
        hint = f" → {target}" if target != "?" else ""
        return "missing", f"пункта нет в действующей редакции{hint}"
    if migrated or target == "?" or target == value:
        return "ok", ""
    return "moved", f"по сверке означает п. {target}"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--strict", action="store_true", help="сдвинутые пункты тоже валят прогон")
    ap.add_argument("--list", action="store_true", help="показать разобранные пункты источника")
    ap.add_argument("--map", action="store_true", help="показать таблицу перенумерации")
    args = ap.parse_args()

    points, subpoints = parse_source(SOURCE)

    if args.list:
        print(f"ИСТОЧНИК: {SOURCE.relative_to(ROOT)}")
        print(f"пунктов: {len(points)} · подпунктов: {len(subpoints)}\n")
        for p in sorted(points, key=int):
            subs = sorted((s for s in subpoints if s.split(".")[0] == p), key=lambda x: int(x.split(".")[1]))
            print(f"  п. {p}" + (f"  ({', '.join(subs)})" if subs else ""))
        return 0

    if args.map:
        print("ПЕРЕНУМЕРАЦИЯ (§3 сверки) — слева как цитирует модуль, справа действующая редакция\n")
        for old, new in MAPPING.items():
            mark = "= " if new == old else ("✗ " if new is None else "→ ")
            print(f"  п. {old:<6} {mark} {new if new else 'аналога нет'}")
        return 0

    print(f"ИСТОЧНИК: {SOURCE.relative_to(ROOT)} — {len(points)} пунктов, {len(subpoints)} подпунктов\n")

    buckets = {"ok": 0, "moved": [], "missing": [], "project": 0}
    per_file = []
    done = 0
    for path in iter_files():
        rel = path.relative_to(ROOT)
        migrated = is_migrated(rel)
        total = 0
        for line_no, value, kind in citations(path):
            total += 1
            bucket, note = classify(value, points, subpoints, migrated)
            if bucket in ("moved", "missing"):
                buckets[bucket].append((f"{rel}:{line_no}", value, kind, note))
            else:
                buckets[bucket] += 1
        if total:
            per_file.append((rel, total, migrated))
            done += migrated

    width = max((len(str(r)) for r, _, _ in per_file), default=10)
    for rel, total, migrated in per_file:
        mark = "  ✓ новая нумерация" if migrated else ""
        print(f"  {str(rel):<{width}}  {total:>4} ссылок{mark}")
    print(f"\nпереведено на нумерацию редакции №41: {done} файлов из {len(per_file)}")

    if buckets["missing"]:
        print("\n❌ ПУНКТА НЕТ В ДЕЙСТВУЮЩЕЙ РЕДАКЦИИ")
        for where, value, kind, note in buckets["missing"]:
            print(f"  {where}  [{kind}] п. {value} — {note}")

    if buckets["moved"]:
        print("\n⚠️  ПУНКТ ЕСТЬ, НО ПО СВЕРКЕ ОН СДВИНУЛСЯ — цитата почти наверняка о старом")
        for where, value, kind, note in buckets["moved"]:
            print(f"  {where}  [{kind}] п. {value} — {note}")

    if EXCLUDED:
        print("\nВНЕ ПРОВЕРКИ (намеренно):")
        for what, why in EXCLUDED.items():
            print(f"  {what} — {why}")

    total = buckets["ok"] + buckets["project"] + len(buckets["moved"]) + len(buckets["missing"])
    print(
        f"\nИТОГО: {total} ссылок · ✓ {buckets['ok']} · ⚠️ {len(buckets['moved'])} сдвинуто · "
        f"❌ {len(buckets['missing'])} нет в редакции · {buckets['project']} проектных"
    )

    if buckets["missing"]:
        return 1
    if buckets["moved"] and args.strict:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
