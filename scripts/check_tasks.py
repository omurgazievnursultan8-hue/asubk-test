#!/usr/bin/env python3
"""Validate docs/tasks/*-tasks.html against the contract in docs/tasks/FORMAT.md.

New-format task files carry their data in a JSON island:

    <script type="application/json" id="tasks-data"> { … } </script>

The eight files handed over before 02.08.2026 have no island; they are frozen
and reported as legacy, not checked.

Checks (FORMAT.md §9): no forward deps · deps resolve · word/acceptance budgets ·
"not in this task" filled · links and anchors alive and inside the package ·
no paths or "ТЗ §5" as plain text · ids match the TODO.md registry 1:1 ·
no priority/status fields · open questions name a default · stages contiguous.

Usage:
    python3 scripts/check_tasks.py
    python3 scripts/check_tasks.py docs/tasks/p14-collection-tasks.html
    python3 scripts/check_tasks.py --strict      # warnings fail the run too
"""
import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TASKS_DIR = ROOT / "docs" / "tasks"
TODO = ROOT / "TODO.md"

# Budgets — FORMAT.md §7.
BODY_MAX = 400
WHY_MAX = 120
TRAPS_MAX = 150
ACCEPT_MIN, ACCEPT_MAX = 5, 12
WHY_SENTENCES_MAX = 5

FORBIDDEN_KEYS = {"prio", "state", "status", "done", "merged", "theme"}
META_KEYS = ["module", "title", "phase", "revision", "date", "registry", "package"]

ISLAND = re.compile(
    r'<script[^>]*type="application/json"[^>]*id="tasks-data"[^>]*>(.*?)</script>',
    re.S)
TAG = re.compile(r"<[^>]+>")
HREF = re.compile(r'href="([^"]+)"')
CODE_PATH = re.compile(r"<code>[^<]*\.(?:html|md|py|mjs)[^<]*</code>")
SECTION_REF = re.compile(r"§\s*\d")
ANCHOR = re.compile(r'(?:id|name)="([^"]+)"')
TODO_ITEM = re.compile(r"^\s*-\s*\[[ xX]\]\s*(P\d+-R\d+)\b")
HEADING = re.compile(r"^#{2,3}\s")
VAGUE = re.compile(r"уточн|TBD|будет решено|не решен|to be decided", re.I)
SKIP_DIRS = {".git", "node_modules", ".auth", "screenshots", "tests"}


def text(s):
    return TAG.sub(" ", s)


def words(*chunks):
    return sum(len(text(c).split()) for c in chunks if c)


def walk_strings(value):
    """Yield every string inside a nested list/dict structure."""
    if isinstance(value, str):
        yield value
    elif isinstance(value, list):
        for v in value:
            yield from walk_strings(v)
    elif isinstance(value, dict):
        for v in value.values():
            yield from walk_strings(v)


def walk_keys(value):
    if isinstance(value, dict):
        for k, v in value.items():
            yield k
            yield from walk_keys(v)
    elif isinstance(value, list):
        for v in value:
            yield from walk_keys(v)


def file_index():
    """basename -> path, for every doc/mockup file that could be linked."""
    idx = {}
    for p in ROOT.rglob("*"):
        if p.is_dir() or p.suffix not in {".html", ".md"}:
            continue
        if SKIP_DIRS & set(p.relative_to(ROOT).parts):
            continue
        idx.setdefault(p.name, p)
    return idx


class Report:
    def __init__(self, path):
        self.path = path
        self.errors = []
        self.warnings = []

    def err(self, where, msg):
        self.errors.append((where, msg))

    def warn(self, where, msg):
        self.warnings.append((where, msg))

    def dump(self):
        try:
            rel = self.path.relative_to(ROOT)
        except ValueError:
            rel = self.path
        print(f"\n{rel}")
        for level, rows in (("ERROR", self.errors), ("WARN ", self.warnings)):
            for where, msg in rows:
                print(f"  {level}  {where:<10} {msg}")
        if not self.errors and not self.warnings:
            print("  OK")
        else:
            print(f"  {len(self.errors)} errors, {len(self.warnings)} warnings")


# --------------------------------------------------------------------------- #
# registry
# --------------------------------------------------------------------------- #
def registry_ids(section):
    """IDs listed under a given '### …' heading in TODO.md."""
    if not TODO.exists():
        return None
    ids, inside = [], False
    for line in TODO.read_text(encoding="utf-8").splitlines():
        if HEADING.match(line):
            inside = line.strip() == section.strip()
            continue
        if inside:
            m = TODO_ITEM.match(line)
            if m:
                ids.append(m.group(1))
    return ids if inside or ids else None


# --------------------------------------------------------------------------- #
# links
# --------------------------------------------------------------------------- #
def check_link(rep, where, target, package, index, anchors):
    """A link must stay inside the delivered package and point at a live anchor."""
    if target.startswith(("http://", "https://", "mailto:")):
        return
    name, _, frag = target.partition("#")
    if not name:                                     # intra-file "#anchor"
        return
    if "/" in name:
        rep.err(where, f"link with a path: {target} — package is flat, use the bare filename")
        return
    if name not in package:
        rep.err(where, f"link outside the package: {name} (package: {', '.join(sorted(package))})")
        return
    path = index.get(name)
    if path is None:
        rep.err(where, f"file not found in repo: {name}")
        return
    if frag and not frag.startswith("/"):            # "#/route" = mockup hash route
        if frag not in anchors.setdefault(name, set(ANCHOR.findall(
                path.read_text(encoding="utf-8", errors="replace")))):
            rep.err(where, f"anchor #{frag} not found in {name}")


def check_prose(rep, where, strings):
    for s in strings:
        if CODE_PATH.search(s):
            rep.err(where, "file path inside <code> — must be a link (FORMAT.md §9.6)")
            break
    for s in strings:
        if SECTION_REF.search(s) and "<a " not in s:
            rep.err(where, "TZ section referenced as text (§N) — must be an anchor link")
            break


# --------------------------------------------------------------------------- #
# card
# --------------------------------------------------------------------------- #
def check_groups(rep, where, field, groups):
    if groups is None:
        return
    if not isinstance(groups, list):
        rep.err(where, f"{field}: must be a list of groups")
        return
    for i, g in enumerate(groups):
        if not isinstance(g, dict) or not g.get("h") or not g.get("items"):
            rep.err(where, f"{field}[{i}]: needs a non-empty 'h' and 'items'")


def check_card(rep, card, pos, index_by_id, package, index, anchors, phase):
    cid = card.get("id", f"#{pos}")

    for key in ("id", "stage", "title", "why", "look", "accept", "notIn", "deps"):
        if key not in card:
            rep.err(cid, f"missing required field '{key}'")

    if not re.fullmatch(rf"P{phase}-R\d+", str(cid)):
        rep.err(cid, f"id must match P{phase}-R<n> (CLAUDE.md numbering)")

    bad = FORBIDDEN_KEYS & set(walk_keys(card))
    if bad:
        rep.err(cid, f"forbidden fields: {', '.join(sorted(bad))} — they live in TODO.md")

    # Зачем
    why = card.get("why", "")
    if words(why) > WHY_MAX:
        rep.err(cid, f"why: {words(why)} words (max {WHY_MAX})")
    sentences = [s for s in re.split(r"[.!?]+", text(why)) if s.strip()]
    if len(sentences) > WHY_SENTENCES_MAX:
        rep.warn(cid, f"why: {len(sentences)} sentences (guide: 2–4)")

    # Где смотреть
    look = card.get("look") or {}
    if not isinstance(look, dict):
        rep.err(cid, "look: must be an object")
        look = {}
    elif not (look.get("mock") or look.get("mockNote")):
        rep.err(cid, "look: needs 'mock' (link) or 'mockNote' ('в макете этого нет')")
    for field in ("mock", "tz"):
        if look.get(field):
            check_link(rep, cid, look[field], package, index, anchors)

    check_groups(rep, cid, "model", card.get("model"))
    check_groups(rep, cid, "rules", card.get("rules"))

    # Приёмка
    accept = card.get("accept") or []
    if not isinstance(accept, list) or not all(isinstance(a, str) and a.strip() for a in accept):
        rep.err(cid, "accept: must be a list of non-empty strings")
    elif not ACCEPT_MIN <= len(accept) <= ACCEPT_MAX:
        rep.err(cid, f"accept: {len(accept)} items (allowed {ACCEPT_MIN}–{ACCEPT_MAX}) — split the card")

    # Не в этой задаче
    not_in = card.get("notIn")
    if not isinstance(not_in, list) or not [x for x in not_in if isinstance(x, str) and x.strip()]:
        rep.err(cid, "notIn: must be filled — write 'границ нет' explicitly")

    # Зависимости
    deps = card.get("deps") or []
    if not isinstance(deps, list):
        rep.err(cid, "deps: must be a list")
        deps = []
    for d in deps:
        if d not in index_by_id:
            rep.err(cid, f"deps: '{d}' is not a card in this file — use extDeps")
        elif index_by_id[d] >= pos:
            rep.err(cid, f"deps: forward reference to {d} (defined later) — renumber")
    for i, e in enumerate(card.get("extDeps") or []):
        if not isinstance(e, dict) or not e.get("what"):
            rep.err(cid, f"extDeps[{i}]: needs 'what' — what must be ready")
        elif e.get("href"):
            check_link(rep, cid, e["href"], package, index, anchors)

    # Решения нет
    for i, o in enumerate(card.get("open") or []):
        if not isinstance(o, dict):
            rep.err(cid, f"open[{i}]: must be an object")
            continue
        default = o.get("default", "")
        if not default.strip():
            rep.err(cid, f"open[{i}]: 'default' is required — name the fallback we build on")
        elif VAGUE.search(default):
            rep.err(cid, f"open[{i}]: default '{default[:40]}…' is not a value — name a number or a rule")
        for key in ("ask", "impact"):
            if not o.get(key):
                rep.err(cid, f"open[{i}]: '{key}' is required")

    # Ловушки
    traps = card.get("traps") or []
    if words(*traps) > TRAPS_MAX:
        rep.err(cid, f"traps: {words(*traps)} words (max {TRAPS_MAX})")

    # Бюджет тела
    body = [why]
    for groups in (card.get("model") or []) + (card.get("rules") or []):
        body.append(groups.get("h", "") if isinstance(groups, dict) else "")
        body += groups.get("items", []) if isinstance(groups, dict) else []
    body += accept if isinstance(accept, list) else []
    body += not_in if isinstance(not_in, list) else []
    for o in card.get("open") or []:
        if isinstance(o, dict):
            body += [o.get("default", ""), o.get("ask", ""), o.get("impact", "")]
    total = words(*[b for b in body if isinstance(b, str)])
    if total > BODY_MAX:
        rep.err(cid, f"body: {total} words (max {BODY_MAX}) — split the card")

    strings = [s for s in walk_strings(card) if isinstance(s, str)]
    check_prose(rep, cid, strings)
    for s in strings:
        for target in HREF.findall(s):
            check_link(rep, cid, target, package, index, anchors)


# --------------------------------------------------------------------------- #
# file
# --------------------------------------------------------------------------- #
def check_file(path, index):
    rep = Report(path)
    raw = path.read_text(encoding="utf-8")
    m = ISLAND.search(raw)
    if not m:
        return None                                   # legacy, frozen
    try:
        data = json.loads(m.group(1))
    except json.JSONDecodeError as exc:
        rep.err("island", f"invalid JSON: {exc}")
        return rep

    meta = data.get("meta") or {}
    for key in META_KEYS:
        if key not in meta:
            rep.err("meta", f"missing '{key}'")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(meta.get("date", ""))):
        rep.err("meta", "date must be YYYY-MM-DD")

    phase = meta.get("phase", r"\d+")
    package = set(meta.get("package") or []) | {path.name}
    anchors = {}

    # Версионирование
    revision = meta.get("revision", 1)
    if isinstance(revision, int) and revision > 1:
        if not meta.get("replaces"):
            rep.err("meta", "revision > 1 requires 'replaces' (which edition it supersedes)")
        if not data.get("changelog"):
            rep.err("changelog", "revision > 1 requires a changelog — the dev must not re-read everything")

    cards = data.get("cards") or []
    if not cards:
        rep.err("cards", "no cards")
        return rep
    ids = [c.get("id") for c in cards]
    dupes = {i for i in ids if ids.count(i) > 1}
    if dupes:
        rep.err("cards", f"duplicate ids: {', '.join(sorted(dupes))}")
    index_by_id = {cid: i for i, cid in enumerate(ids)}

    # Этапы
    stages = data.get("stages") or []
    nums = [s.get("n") for s in stages if isinstance(s, dict)]
    if nums != list(range(1, len(nums) + 1)):
        rep.err("stages", f"stage numbers must run 1…N without gaps, got {nums}")
    for s in stages:
        if not isinstance(s, dict) or not s.get("title"):
            rep.err("stages", "every stage needs a title")
    used = [c.get("stage") for c in cards]
    if used != sorted(used):
        rep.err("cards", "cards must be ordered by stage")
    for n in nums:
        if n not in used:
            rep.warn("stages", f"stage {n} has no cards")
    # One line per undeclared stage — a missing stage otherwise shouts once per card.
    for stage in dict.fromkeys(s for s in used if s not in nums):
        owners = [c.get("id", "?") for c in cards if c.get("stage") == stage]
        rep.err("stages", f"stage {stage} is not declared in 'stages' "
                          f"({len(owners)} cards: {', '.join(owners[:4])}"
                          f"{'…' if len(owners) > 4 else ''})")

    # Журнал редакции
    log = data.get("changelog") or {}
    for cid in log.get("added") or []:
        if cid not in index_by_id:
            rep.err("changelog", f"added '{cid}' is not among the cards")
    for row in log.get("changed") or []:
        if not isinstance(row, dict) or row.get("id") not in index_by_id:
            rep.err("changelog", f"changed '{row}' is not among the cards")
        elif not row.get("what"):
            rep.err("changelog", f"changed {row.get('id')}: 'what' is required")
    for row in log.get("removed") or []:
        if not isinstance(row, dict) or not row.get("to"):
            rep.err("changelog", f"removed '{row}': 'to' is required — say where it went")
        elif row.get("id") in index_by_id:
            rep.err("changelog", f"removed '{row.get('id')}' is still present among the cards")
    for row in data.get("idmap") or []:
        if not isinstance(row, dict) or not row.get("old"):
            rep.err("idmap", f"bad row: {row}")
        elif row.get("new") and row["new"] not in index_by_id:
            rep.err("idmap", f"{row['old']} → {row['new']}: target does not exist")

    # Справка модуля
    check_groups(rep, "guide", "guide", data.get("guide"))
    guide_strings = [s for s in walk_strings(data.get("guide") or []) if isinstance(s, str)]
    check_prose(rep, "guide", guide_strings)
    for s in guide_strings:
        for target in HREF.findall(s):
            check_link(rep, "guide", target, package, index, anchors)

    for pos, card in enumerate(cards):
        if isinstance(card, dict):
            check_card(rep, card, pos, index_by_id, package, index, anchors, phase)
        else:
            rep.err(f"#{pos}", "card must be an object")

    # Реестр
    section = meta.get("registry")
    if section:
        reg = registry_ids(section)
        if reg is None:
            rep.err("registry", f"section '{section}' not found in TODO.md")
        else:
            missing = [i for i in ids if i not in reg]
            extra = [i for i in reg if i not in ids]
            if missing:
                rep.err("registry", f"not in TODO.md: {', '.join(missing)}")
            if extra:
                rep.err("registry", f"in TODO.md but not here: {', '.join(extra)}")

    rep.count = len(cards)
    rep.revision = revision
    return rep


def main():
    ap = argparse.ArgumentParser(description="Validate task files against docs/tasks/FORMAT.md")
    ap.add_argument("files", nargs="*", help="task html files (default: docs/tasks/*-tasks.html)")
    ap.add_argument("--strict", action="store_true", help="warnings fail the run too")
    args = ap.parse_args()

    targets = [Path(f) for f in args.files] or sorted(TASKS_DIR.glob("*-tasks.html"))
    if not targets:
        print("no task files found")
        return 0

    index = file_index()
    checked, legacy, errors, warnings = 0, [], 0, 0
    for path in targets:
        path = path if path.is_absolute() else (ROOT / path)
        if not path.exists():
            print(f"{path}: not found")
            errors += 1
            continue
        rep = check_file(path, index)
        if rep is None:
            legacy.append(path.name)
            continue
        checked += 1
        errors += len(rep.errors)
        warnings += len(rep.warnings)
        rep.dump()

    if legacy:
        print(f"\nlegacy (no JSON island, frozen — not checked): {', '.join(sorted(legacy))}")
    print(f"\n{checked} file(s) checked · {errors} errors · {warnings} warnings")
    return 1 if errors or (args.strict and warnings) else 0


if __name__ == "__main__":
    sys.exit(main())
