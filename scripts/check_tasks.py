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

Two card anatomies live side by side, told apart by meta.format:

    format 1 (default)  зачем · где смотреть · модель · правила · приёмка · границы
    format 2            + что строим · данные · экран · шаги · пример · термины,
                        а прозаическая «модель» запрещена: фактура уходит в data

Format 2 also carries the summary blocks the cards stop repeating — atlas
(модель данных целиком), screens (опись экранов), glossary, walkthrough
(сквозной числовой пример) — and gets a wider body budget, because its cards
are meant to be built from, not skimmed.

Format 3 splits the package differently: the ТЗ is the specification (its own
JSON island id="tz-data", numbered points), the task file is only the build
plan — a card names the points it closes and the checks that prove it. The
validator reads all three together: the task file, the ТЗ from meta.package and
the internal trace file named by the ТЗ (requirement → point). Each point is
closed by exactly one card, checked by at least one acceptance row and traced to
at least one requirement; metaphors and internal codes fail the run.

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
BODY_MAX_F2 = 1200          # карточка формата 2 несёт данные, шаги и пример
BUILD_MAX = 60
WHY_MAX = 120
TRAPS_MAX = 150
ACCEPT_MIN, ACCEPT_MAX = 5, 12
STEPS_MIN, STEPS_MAX = 3, 10
WHY_SENTENCES_MAX = 5

# Поля тела: считаются в бюджет и проверяются на пути/«§ N».
BODY_FIELDS_F2 = ("build", "why", "data", "screen", "steps", "rules",
                  "example", "terms", "accept", "notIn", "open")

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
DIGIT = re.compile(r"\d")
SKIP_DIRS = {".git", "node_modules", ".auth", "screenshots", "tests", ".claude"}

# Format 3 — FORMAT.md §11.
TZ_ISLAND = re.compile(
    r'<script(?=[^>]*type="application/json")(?=[^>]*id="tz-data")[^>]*>(.*?)</script>',
    re.S)
META_KEYS_F3 = ["module", "title", "phase", "date", "registry", "package"]
TZ_META_KEYS = ["module", "title", "date", "package", "trace"]
TOP_KEYS_F3 = {"meta", "stages", "cards"}
CARD_KEYS_F3 = {"id", "stage", "prio", "title", "covers", "deps", "waits", "accept"}
# Чего в ТЗ нет (§11.2): любой ключ сверх этих — причина, история или ловушка.
TZ_TOP_KEYS = {"meta", "purpose", "glossary", "entities", "chapters", "interfaces", "access",
               "questions", "dataset"}
TZ_CHAPTER_KEYS = {"title", "points", "screens"}
TZ_POINT_KEYS = {"id", "text", "cases", "open"}
TZ_SCREEN_KEYS = {"id", "n", "route", "mockNote", "cols", "acts", "msgs"}
TZ_IFACE_KEYS = {"id", "name", "from", "to", "send", "get", "refuse"}
HISTORY_KEYS = ("changelog", "replaces", "idmap", "revision")
PRIOS = ("🔴", "🟡", "🟢")
FIELD_TYPES = {"текст", "число", "сумма", "дата", "дата и время", "признак", "список",
               "ссылка", "набор значений", "файл"}
TITLE_MAX_F3 = 10
POINT_MAX = 60
POINT_SENTENCES_MAX = 2
ACCEPT_MIN_F3 = 3
POINT_ID = re.compile(r"(\d+)\.\d+")
IFACE_NAME = re.compile(r"[a-z][A-Za-z0-9]*")
TASK_ID = re.compile(r"\bP\d+-R\d+\b")
# Внутренний код: ИО-21, ПВ-Д9, ADR-0280. Номер формы ФО-34 и ключи контрольного
# набора (КД-2025/088, ВП-105) разрешены — их видит и разработчик, и заказчик.
# Латиница кодом не считается (UTF-8, ISO-8601), кроме ADR.
CODE = re.compile(r"(?<!\w)([А-ЯЁ]{2,4}|ADR)-(?:Д?\d+)")
CODE_ALLOWED = {"ФО"}
# Метафоры постановки — одна вещь, одно обычное имя (FORMAT.md §11.6). Обычные слова с
# тем же корнем не ловятся: «соседний», «ступенчатый график», «паспортные данные».
METAPHOR = re.compile(
    r"\b(?:шов|шва|шву|швом|шве|швы|швов|швам|швами|швах"
    r"|сосед|соседа|соседу|соседом|соседе|соседи|соседей|соседям|соседями|соседях"
    r"|паспорт(?!н)\w*|провал\w*|крутилк\w*|накрут\w*|витрин\w*|рычаг\w*"
    r"|ступень|ступени|ступенью|ступеней|ступеням|ступенями|ступенях"
    r"|полк[аиеуо]\w*|полок|замок|замка|замку|замком|замке|замки|замков"
    r"|отвалив\w*|рабоч\w+ бумаг\w*)\b",
    re.I)
PLAIN_PATH = re.compile(r"\b[\w.-]+/[\w./-]+\.(?:html|md|py|mjs|json)\b")
TRACE_SOURCES = {"А", "Б", "В", "Г"}
TRACE_DROP = re.compile(r"^—\s*не переносим:\s*\S")
REGISTRY_LINE = re.compile(
    r"^\s*-\s*\[([ xX])\]\s*(P\d+-R\d+)\b\s*(🔴|🟠|🟡|🟢)?")
REPLACED = re.compile(r"заменена:\s*((?:P\d+-R\d+(?:\s*(?:,|и)\s*)?)+)")
WITHDRAWN = re.compile(r"снята:\s*\S")


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


def check_entities(rep, where, field, blocks, need_key=False):
    """Модель данных: сущность с полями, у каждого поля тип и обязательность."""
    if blocks is None:
        return
    if not isinstance(blocks, list) or not blocks:
        rep.err(where, f"{field}: must be a non-empty list of entities")
        return
    for i, b in enumerate(blocks):
        at = f"{field}[{i}]"
        if not isinstance(b, dict):
            rep.err(where, f"{at}: must be an object")
            continue
        if not b.get("n"):
            rep.err(where, f"{at}: needs 'n' — the entity name")
        fields = b.get("fields")
        if not isinstance(fields, list) or not [f for f in fields
                                                if isinstance(f, str) and f.strip()]:
            rep.err(where, f"{at}: 'fields' must list the fields — name, type, obligation")
        if need_key and not b.get("key"):
            rep.err(where, f"{at}: 'key' is required — what identifies the record")


def check_screens(rep, where, field, blocks):
    """Опись экранов: у экрана есть имя и хоть что-то предметное — колонки, действия, заметка."""
    if blocks is None:
        return
    if not isinstance(blocks, list) or not blocks:
        rep.err(where, f"{field}: must be a non-empty list of screens")
        return
    for i, b in enumerate(blocks):
        at = f"{field}[{i}]"
        if not isinstance(b, dict):
            rep.err(where, f"{at}: must be an object")
            continue
        if not b.get("n"):
            rep.err(where, f"{at}: needs 'n' — what the screen is called in the app")
        if not (b.get("cols") or b.get("acts") or b.get("note")):
            rep.err(where, f"{at}: needs 'cols', 'acts' or 'note' — otherwise it names nothing")


def check_terms(rep, where, field, items):
    if items is None:
        return
    if not isinstance(items, list) or not items:
        rep.err(where, f"{field}: must be a non-empty list of {{t, d}}")
        return
    for i, t in enumerate(items):
        if not isinstance(t, dict) or not t.get("t") or not t.get("d"):
            rep.err(where, f"{field}[{i}]: needs 't' (term) and 'd' (what it means here)")


def check_example(rep, where, ex, field="example"):
    """Пример без числа — пересказ карточки; такой не считается."""
    if not isinstance(ex, dict):
        rep.err(where, f"{field}: must be an object {{src, given, do, get}}")
        return
    if not ex.get("src"):
        rep.err(where, f"{field}: 'src' is required — name the record the numbers come from")
    for key in ("given", "get"):
        v = ex.get(key)
        if not isinstance(v, list) or not [s for s in v if isinstance(s, str) and s.strip()]:
            rep.err(where, f"{field}: '{key}' must be a non-empty list")
    if not DIGIT.search(" ".join(s for s in walk_strings(ex) if isinstance(s, str))):
        rep.err(where, f"{field}: no number in it — an example without numbers is a retelling")


def check_card(rep, card, pos, index_by_id, package, index, anchors, phase, fmt=1):
    cid = card.get("id", f"#{pos}")

    required = ["id", "stage", "title", "why", "look", "accept", "notIn", "deps"]
    if fmt >= 2:
        required += ["build", "steps", "example"]
    for key in required:
        if key not in card:
            rep.err(cid, f"missing required field '{key}'")

    if not re.fullmatch(rf"P{phase}-R\d+", str(cid)):
        rep.err(cid, f"id must match P{phase}-R<n> (CLAUDE.md numbering)")

    bad = FORBIDDEN_KEYS & set(walk_keys(card))
    if bad:
        rep.err(cid, f"forbidden fields: {', '.join(sorted(bad))} — they live in TODO.md")

    # Что строим — одна фраза, дальше по карточке уже подробности
    if fmt >= 2:
        if "model" in card:
            rep.err(cid, "model: prose model is gone in format 2 — facts go to 'data', "
                         "the rest to 'rules'")
        build = card.get("build", "")
        if not isinstance(build, str) or not build.strip():
            rep.err(cid, "build: must be a non-empty string — one phrase, what gets built")
        elif words(build) > BUILD_MAX:
            rep.err(cid, f"build: {words(build)} words (max {BUILD_MAX})")

        check_entities(rep, cid, "data", card.get("data"))
        check_screens(rep, cid, "screen", card.get("screen"))
        check_terms(rep, cid, "terms", card.get("terms"))
        check_example(rep, cid, card.get("example"))

        steps = card.get("steps") or []
        if not isinstance(steps, list) or not all(
                isinstance(s, str) and s.strip() for s in steps):
            rep.err(cid, "steps: must be a list of non-empty strings")
        elif not STEPS_MIN <= len(steps) <= STEPS_MAX:
            rep.err(cid, f"steps: {len(steps)} items (allowed {STEPS_MIN}–{STEPS_MAX}) "
                         f"— split the card or fold the small ones")

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
    if fmt >= 2:
        body = []
        for field in BODY_FIELDS_F2:
            body += [s for s in walk_strings(card.get(field)) if isinstance(s, str)]
        limit = BODY_MAX_F2
    else:
        body = [why]
        for groups in (card.get("model") or []) + (card.get("rules") or []):
            body.append(groups.get("h", "") if isinstance(groups, dict) else "")
            body += groups.get("items", []) if isinstance(groups, dict) else []
        body += accept if isinstance(accept, list) else []
        body += not_in if isinstance(not_in, list) else []
        for o in card.get("open") or []:
            if isinstance(o, dict):
                body += [o.get("default", ""), o.get("ask", ""), o.get("impact", "")]
        limit = BODY_MAX
    total = words(*[b for b in body if isinstance(b, str)])
    if total > limit:
        rep.err(cid, f"body: {total} words (max {limit}) — split the card")

    strings = [s for s in walk_strings(card) if isinstance(s, str)]
    check_prose(rep, cid, strings)
    for s in strings:
        for target in HREF.findall(s):
            check_link(rep, cid, target, package, index, anchors)


# --------------------------------------------------------------------------- #
# format 3 — ТЗ is the specification, tasks are the build plan
# --------------------------------------------------------------------------- #
def check_words(rep, where, strings, allowed_codes, no_task_ids=False):
    """Одно обычное имя и только те коды, что открываются внутри пакета."""
    for s in strings:
        plain = text(s)
        m = METAPHOR.search(plain)
        if m:
            rep.err(where, f"metaphor «{m.group(0)}» — use the plain name (FORMAT.md §11.6)")
            break
    for s in strings:
        bad = [m.group(0) for m in CODE.finditer(text(s))
               if m.group(1) not in allowed_codes]
        if bad:
            rep.err(where, f"internal code {bad[0]} — it does not open inside the package")
            break
    for s in strings:
        m = PLAIN_PATH.search(text(s))
        if m:
            rep.err(where, f"file path {m.group(0)} as text — the package is flat, use a link")
            break
    for s in strings:
        if SECTION_REF.search(text(s)):
            rep.err(where, "«§ N» — the package refers to ТЗ points by number (6.2)")
            break
    if no_task_ids:
        for s in strings:
            m = TASK_ID.search(text(s))
            if m:
                rep.err(where, f"task id {m.group(0)} in the ТЗ — the ТЗ does not know the plan")
                break


def check_keys(rep, where, obj, allowed, what):
    extra = set(obj) - allowed
    if extra:
        rep.err(where, f"{what}: {', '.join(sorted(extra))} — not part of the ТЗ "
                       f"(reasons, history and traps stay in the canon)")


def check_cases(rep, where, cases):
    """Таблица случаев: колонки, строки той же ширины и хоть одно число."""
    if not isinstance(cases, dict):
        rep.err(where, "cases: must be an object {given, cols, rows}")
        return
    cols, rows = cases.get("cols"), cases.get("rows")
    if not isinstance(cols, list) or len(cols) < 2:
        rep.err(where, "cases: 'cols' needs at least two columns — condition and result")
        return
    if not isinstance(rows, list) or not rows:
        rep.err(where, "cases: 'rows' must be non-empty")
        return
    for i, r in enumerate(rows):
        if not isinstance(r, list) or len(r) != len(cols):
            rep.err(where, f"cases.rows[{i}]: {len(r) if isinstance(r, list) else '?'} cells, "
                           f"{len(cols)} columns")
    if not DIGIT.search(" ".join(s for s in walk_strings(rows) if isinstance(s, str))):
        rep.err(where, "cases: no number in the rows — a case table is worked on numbers")


def check_point(rep, pid, p):
    check_keys(rep, pid, p, TZ_POINT_KEYS, "point")
    body = p.get("text", "")
    if not isinstance(body, str) or not body.strip():
        rep.err(pid, "point: 'text' is required — the rule itself")
        return
    if words(body) > POINT_MAX:
        rep.err(pid, f"point: {words(body)} words (max {POINT_MAX}) — one point, one rule")
    # «гл. 9», «п. 16 пп. 2», «стр. N из M», «ред. N» — не конец предложения: новое
    # начинается с заглавной и не после сокращения
    flat = re.sub(r"\b(гл|пп|п|стр|ред|см|ст|т|г)\.\s", r"\1. ", text(body).strip())
    sentences = [s for s in re.split(r"(?<=[.!?]) +(?=[«\"(]?[А-ЯЁA-Z])", flat) if s.strip()]
    if len(sentences) > POINT_SENTENCES_MAX:
        rep.warn(pid, f"point: {len(sentences)} sentences — is it one rule?")
    if "cases" in p:
        check_cases(rep, pid, p["cases"])


def check_tz_screen(rep, sid, s):
    check_keys(rep, sid, s, TZ_SCREEN_KEYS, "screen")
    if not s.get("n"):
        rep.err(sid, "screen: needs 'n' — the screen name as the user sees it")
    if not s.get("route"):
        rep.err(sid, "screen: needs 'route' — where it is in the mockup")
    if not (s.get("cols") or s.get("acts")):
        rep.err(sid, "screen: needs 'cols' or 'acts'")
    for i, a in enumerate(s.get("acts") or []):
        if not isinstance(a, dict) or not a.get("a") or not a.get("when"):
            rep.err(sid, f"acts[{i}]: needs 'a' — the action — and 'when' — when it is "
                         f"available («всегда», если без условий)")


def check_tz_entity(rep, eid, e, names):
    if not e.get("n"):
        rep.err(eid, "entity: needs 'n'")
    fields = e.get("fields")
    if not isinstance(fields, list) or not fields:
        rep.err(eid, "entity: 'fields' must be a non-empty table")
        return
    for i, f in enumerate(fields):
        at = f"fields[{i}]"
        if not isinstance(f, dict) or not f.get("n"):
            rep.err(eid, f"{at}: needs 'n'")
            continue
        at = f"field «{f['n']}»"
        if f.get("type") not in FIELD_TYPES:
            rep.err(eid, f"{at}: type {f.get('type')!r} — one of: {', '.join(sorted(FIELD_TYPES))}")
        if not isinstance(f.get("req"), bool):
            rep.err(eid, f"{at}: 'req' must be true or false")
        if f.get("type") == "список" and not f.get("values"):
            rep.err(eid, f"{at}: a list field needs 'values'")
        if f.get("type") == "ссылка":
            ref = f.get("ref")
            if not ref:
                rep.err(eid, f"{at}: a reference needs 'ref' — the entity it points to")
            elif ref not in names and not f.get("ext"):
                rep.err(eid, f"{at}: ref «{ref}» is not an entity of this ТЗ — "
                             f"name its module in 'ext'")


def check_tz(rep, tz, package, index, anchors):
    """ТЗ формата 3. Returns (closable ids → kind, dataset codes, interface ids, all ids)."""
    meta = tz.get("meta") or {}
    for key in TZ_META_KEYS:
        if not meta.get(key):
            rep.err("ТЗ meta", f"'{key}' is missing or empty")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(meta.get("date", ""))):
        rep.err("ТЗ meta", "date must be YYYY-MM-DD")
    for key in HISTORY_KEYS:
        if key in tz or key in meta:
            rep.err("ТЗ", f"'{key}': no history in the package — it lives in TODO.md and ADR")
    check_keys(rep, "ТЗ", {k: v for k, v in tz.items() if k not in HISTORY_KEYS},
               TZ_TOP_KEYS, "blocks")

    purpose = tz.get("purpose") or {}
    if not purpose.get("does"):
        rep.err("ТЗ 1", "purpose.does: what the module does — non-empty")
    if "doesNot" not in purpose:
        rep.err("ТЗ 1", "purpose.doesNot: what it does not do — write [] explicitly if nothing")
    check_terms(rep, "ТЗ 1", "glossary", tz.get("glossary"))

    closable, every = {}, {}

    def claim(pid, kind, chapter):
        if not isinstance(pid, str) or not POINT_ID.fullmatch(pid):
            rep.err("ТЗ", f"id {pid!r} must be <chapter>.<n>")
            return False
        if int(POINT_ID.fullmatch(pid).group(1)) != chapter:
            rep.err(f"ТЗ {pid}", f"sits in chapter {chapter} — renumber")
        if pid in every:
            rep.err(f"ТЗ {pid}", "duplicate id")
            return False
        every[pid] = kind
        return True

    # 2. Данные
    entities = tz.get("entities") or []
    if not entities:
        rep.err("ТЗ 2", "entities: chapter 2 must list every entity")
    names = {e.get("n") for e in entities if isinstance(e, dict)}
    for e in entities:
        if isinstance(e, dict) and claim(e.get("id"), "entity", 2):
            closable[e["id"]] = "entity"
            check_tz_entity(rep, f"ТЗ {e['id']}", e, names)

    # 3…K. Функции
    chapters = tz.get("chapters") or []
    if not chapters:
        rep.err("ТЗ", "chapters: no function chapters")
    open_points = set()
    for n, ch in enumerate(chapters, start=3):
        if not isinstance(ch, dict) or not ch.get("title"):
            rep.err(f"ТЗ {n}", "chapter needs a 'title'")
            continue
        check_keys(rep, f"ТЗ {n}", ch, TZ_CHAPTER_KEYS, "chapter")
        for p in ch.get("points") or []:
            if isinstance(p, dict) and claim(p.get("id"), "point", n):
                closable[p["id"]] = "point"
                check_point(rep, f"ТЗ {p['id']}", p)
                if p.get("open"):
                    open_points.add(p["id"])
        for s in ch.get("screens") or []:
            if isinstance(s, dict) and claim(s.get("id"), "screen", n):
                closable[s["id"]] = "screen"
                check_tz_screen(rep, f"ТЗ {s['id']}", s)
        if not (ch.get("points") or ch.get("screens")):
            rep.err(f"ТЗ {n}", "chapter has neither points nor screens")

    # K+1. Связи с другими модулями
    n_iface = 3 + len(chapters)
    ifaces = set()
    for f in tz.get("interfaces") or []:
        if not isinstance(f, dict) or not claim(f.get("id"), "interface", n_iface):
            continue
        closable[f["id"]] = "interface"
        ifaces.add(f["id"])
        fid = f"ТЗ {f['id']}"
        check_keys(rep, fid, f, TZ_IFACE_KEYS, "interface")
        if not IFACE_NAME.fullmatch(str(f.get("name", ""))):
            rep.err(fid, "interface: 'name' — the fixed request name, e.g. statRows")
        for key in ("from", "to", "send", "get", "refuse"):
            if not f.get(key):
                rep.err(fid, f"interface: '{key}' is required")

    # K+2. Права и видимость
    for p in tz.get("access") or []:
        if isinstance(p, dict) and claim(p.get("id"), "point", n_iface + 1):
            closable[p["id"]] = "point"
            check_point(rep, f"ТЗ {p['id']}", p)
            if p.get("open"):
                open_points.add(p["id"])

    # K+3. Вопросы заказчику — каждая ⚠ в тексте ровно одной строкой здесь
    asked = set()
    for i, q in enumerate(tz.get("questions") or []):
        qid = f"ТЗ вопрос {i + 1}"
        if not isinstance(q, dict):
            rep.err(qid, "must be an object {point, ask, default, impact}")
            continue
        point = str(q.get("point"))
        if point not in open_points:
            rep.err(qid, f"point {point!r} is not marked open in the text")
        if point in asked:
            rep.err(qid, f"point {point} already has a question — one row per point")
        asked.add(point)
        default = str(q.get("default") or "")
        if not default.strip():
            rep.err(qid, "'default' is required — what we build until the answer comes")
        elif VAGUE.search(default):
            rep.err(qid, f"default '{default[:40]}…' is not a value — name a number or a rule")
        for key in ("ask", "impact"):
            if not q.get(key):
                rep.err(qid, f"'{key}' is required")
    for pid in sorted(open_points - asked):
        rep.err(f"ТЗ {pid}", "marked open, but no row in the customer questions chapter")

    # Приложение — контрольный набор данных
    dataset = tz.get("dataset") or []
    if not dataset:
        rep.err("ТЗ набор", "dataset: the control data set the checks run on — non-empty")
    codes = set(CODE_ALLOWED)
    keys = []
    for i, r in enumerate(dataset):
        if not isinstance(r, dict) or not isinstance(r.get("key"), str) or not r.get("kind"):
            rep.err("ТЗ набор", f"dataset[{i}]: needs 'key' (text) and 'kind'")
            continue
        keys.append(r["key"])
        m = CODE.match(r["key"])
        if m:
            codes.add(m.group(1))

    strings = [s for s in walk_strings({k: v for k, v in tz.items() if k != "meta"})
               if isinstance(s, str)]
    check_words(rep, "ТЗ", strings, codes, no_task_ids=True)
    for s in strings:
        for target in HREF.findall(s):
            check_link(rep, "ТЗ", target, package, index, anchors)
    return closable, codes, keys, ifaces, every


def check_trace(rep, path, every):
    """Файл соответствия: требование → пункты ТЗ или явный отказ; у пункта есть источник."""
    rows, traced = 0, set()
    for no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.lstrip().startswith("|"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        where = f"trace:{no}"
        if cells[0] in ("ист.", "источник"):
            continue
        if cells[0] and set(cells[0]) <= {"-", ":"}:
            continue
        if len(cells) < 4:
            rep.err(where, f"{len(cells)} cells — a row is | ист. | где | требование | пункты ТЗ |")
            continue
        rows += 1
        src, at, req, pts = cells[0], cells[1], cells[2], cells[3]
        if src not in TRACE_SOURCES:
            rep.err(where, f"source {src!r} — one of А (оф. ТЗ), Б (легаси), В (форма), Г (решение)")
        if not at or not req:
            rep.err(where, "'где' and 'требование' are required")
        if TRACE_DROP.match(pts):
            continue
        if pts.startswith("—"):
            rep.err(where, "a dropped requirement reads «— не переносим: <причина>»")
            continue
        ids = [p for p in re.split(r"[,\s]+", pts) if p]
        if not ids:
            rep.err(where, "points are empty — name them or write «— не переносим: <причина>»")
        for p in ids:
            if p not in every:
                rep.err(where, f"point {p} is not in the ТЗ")
            traced.add(p)
    if not rows:
        rep.err("trace", "no rows")
    lost = [p for p, kind in every.items() if kind != "entity" and p not in traced]
    if lost:
        rep.err("trace", f"{len(lost)} ТЗ point(s) without a source: "
                         f"{', '.join(lost[:8])}{'…' if len(lost) > 8 else ''}")


def registry_rows(section):
    """id → (done, prio, replaced_by, withdrawn) for the '### …' section of TODO.md."""
    if not TODO.exists():
        return None
    rows, inside, seen = {}, False, False
    for line in TODO.read_text(encoding="utf-8").splitlines():
        if HEADING.match(line):
            inside = line.strip() == section.strip()
            seen = seen or inside
            continue
        if inside:
            m = REGISTRY_LINE.match(line)
            if m:
                r = REPLACED.search(line)
                rows[m.group(2)] = (m.group(1) != " ", m.group(3),
                                    TASK_ID.findall(r.group(1)) if r else [],
                                    bool(WITHDRAWN.search(line)))
    return rows if seen else None


def check_card_f3(rep, card, pos, index_by_id, closable, ifaces, codes, keys, phase,
                  package, index, anchors):
    cid = card.get("id", f"#{pos}")
    for key in ("id", "stage", "prio", "title", "covers", "deps", "accept"):
        if key not in card:
            rep.err(cid, f"missing required field '{key}'")
    extra = set(card) - CARD_KEYS_F3
    if extra:
        rep.err(cid, f"fields {', '.join(sorted(extra))} are gone in format 3 — "
                     f"rules, data and screens live in the ТЗ, reasons in the canon")
    if not re.fullmatch(rf"P{phase}-R\d+", str(cid)):
        rep.err(cid, f"id must match P{phase}-R<n>")
    if card.get("prio") not in PRIOS:
        rep.err(cid, f"prio must be one of {' '.join(PRIOS)}")
    title = card.get("title", "")
    if not isinstance(title, str) or not title.strip():
        rep.err(cid, "title: required — names the function")
    elif words(title) > TITLE_MAX_F3:
        rep.err(cid, f"title: {words(title)} words (max {TITLE_MAX_F3}) — name the function, "
                     f"the rules are in the ТЗ")

    covers = card.get("covers") or []
    if not isinstance(covers, list) or not covers:
        rep.err(cid, "covers: name the ТЗ points this card closes")
        covers = []
    covers = [str(p) for p in covers]
    for p in dict.fromkeys(p for p in covers if covers.count(p) > 1):
        rep.err(cid, f"covers: {p} listed twice")
    covers = list(dict.fromkeys(covers))
    for p in covers:
        if p not in closable:
            rep.err(cid, f"covers: {p} is not a point, screen, entity or interface of the ТЗ")

    deps = card.get("deps") or []
    for d in map(str, deps if isinstance(deps, list) else []):
        if d not in index_by_id:
            rep.err(cid, f"deps: '{d}' is not a card in this file")
        elif index_by_id[d] >= pos:
            rep.err(cid, f"deps: forward reference to {d} (defined later)")

    waits = card.get("waits") or []
    if not isinstance(waits, list):
        rep.err(cid, "waits: must be a list")
        waits = []
    for i, w in enumerate(waits):
        if not isinstance(w, dict) or not w.get("what"):
            rep.err(cid, f"waits[{i}]: needs 'what' — which module, what it must give")
            continue
        if not isinstance(w.get("ready"), bool):
            rep.err(cid, f"waits[{i}]: 'ready' must be true or false")
        if w.get("iface") and str(w["iface"]) not in ifaces:
            rep.err(cid, f"waits[{i}]: iface {w['iface']} is not in the interfaces chapter")

    accept = card.get("accept") or []
    if not isinstance(accept, list) or not ACCEPT_MIN_F3 <= len(accept) <= ACCEPT_MAX:
        n = len(accept) if isinstance(accept, list) else "?"
        rep.err(cid, f"accept: {n} checks (allowed {ACCEPT_MIN_F3}–{ACCEPT_MAX}) — "
                     f"split the card or fold it into its neighbour")
        accept = accept if isinstance(accept, list) else []
    checked = set()
    for i, a in enumerate(accept):
        if not isinstance(a, dict) or not a.get("do") or not a.get("see"):
            rep.err(cid, f"accept[{i}]: needs 'do' (action on the control data) and 'see'")
            continue
        pts = a.get("pts") or []
        if not isinstance(pts, list) or not pts:
            rep.err(cid, f"accept[{i}]: 'pts' — a list of the card's points it proves")
            pts = []
        for p in map(str, pts):
            if p not in covers:
                rep.err(cid, f"accept[{i}]: checks {p}, which this card does not cover")
            checked.add(p)
    unproved = [p for p in covers if closable.get(p) != "entity" and p not in checked]
    if unproved:
        rep.err(cid, f"no check proves {', '.join(unproved)}")
    blob = " ".join(text(s) for s in walk_strings(accept) if isinstance(s, str))
    if keys and accept and not any(
            re.search(rf"(?<!\w){re.escape(k)}(?![\w/])", blob) for k in keys):
        rep.err(cid, "accept: no record of the control data set is named — "
                     "the checks must be repeatable")

    strings = [s for s in walk_strings(card) if isinstance(s, str)]
    check_words(rep, cid, strings, codes)
    for s in strings:
        for target in HREF.findall(s):
            check_link(rep, cid, target, package, index, anchors)
    return covers


def check_file_f3(path, data, index):
    """Кривая форма JSON (число вместо списка и т. п.) — ошибка отчёта, а не падение."""
    rep = Report(path)
    try:
        return _check_file_f3(rep, path, data, index)
    except (TypeError, AttributeError, KeyError, ValueError) as exc:
        rep.err("shape", f"malformed structure ({type(exc).__name__}: {exc}) — "
                         f"fix the JSON shape against FORMAT.md §11.14")
        return rep


def _check_file_f3(rep, path, data, index):
    meta = data.get("meta") or {}
    for key in META_KEYS_F3:
        if not meta.get(key):
            rep.err("meta", f"'{key}' is missing or empty")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(meta.get("date", ""))):
        rep.err("meta", "date must be YYYY-MM-DD")
    extra = set(data) - TOP_KEYS_F3
    if extra:
        rep.err("file", f"blocks {', '.join(sorted(extra))} are gone in format 3 — the summary "
                        f"is the ТЗ, history lives in TODO.md")
    for key in HISTORY_KEYS:
        if key in meta:
            rep.err("meta", f"'{key}': no history in the package — the date names the edition")

    phase = meta.get("phase", r"\d+")
    package = {str(n) for n in meta.get("package") or []} | {path.name}
    anchors = {}

    # ТЗ — тот файл пакета, у которого остров tz-data
    tzs = []
    for name in sorted(package - {path.name}):
        p = index.get(name)
        if p and p.suffix == ".html":
            m = TZ_ISLAND.search(p.read_text(encoding="utf-8", errors="replace"))
            if m:
                tzs.append((p, m.group(1)))
    if len(tzs) != 1:
        rep.err("package", f"format 3 needs exactly one ТЗ with a tz-data island "
                           f"in meta.package, found {len(tzs)}")
        return rep
    tz_path, raw = tzs[0]
    try:
        tz = json.loads(raw)
    except json.JSONDecodeError as exc:
        rep.err("ТЗ", f"invalid JSON in {tz_path.name}: {exc}")
        return rep
    if not isinstance(tz, dict) or not isinstance(tz.get("meta") or {}, dict):
        rep.err("ТЗ", f"{tz_path.name}: the tz-data island must be an object with an object 'meta'")
        return rep
    closable, codes, keys, ifaces, every = check_tz(rep, tz, package, index, anchors)

    trace_name = (tz.get("meta") or {}).get("trace")      # пустое имя check_tz уже назвал
    trace = index.get(trace_name) if trace_name else None
    if trace_name and trace is None:
        rep.err("trace", f"file not found in repo: {trace_name}")
    elif trace is not None:
        if trace_name in package:
            rep.err("trace", f"{trace_name} is internal — it must not be in meta.package")
        check_trace(rep, trace, every)

    # Этапы — у каждого то, что показываем по его окончании
    stages = data.get("stages") or []
    nums = [s.get("n") for s in stages if isinstance(s, dict)]
    if nums != list(range(1, len(nums) + 1)):
        rep.err("stages", f"stage numbers must run 1…N without gaps, got {nums}")
    for s in stages:
        if not isinstance(s, dict) or not s.get("title") or not s.get("show"):
            rep.err("stages", f"stage {s.get('n') if isinstance(s, dict) else '?'}: needs "
                              f"'title' and 'show' — what the customer sees when it ends")
    stage_strings = [x for x in walk_strings(stages) if isinstance(x, str)]
    check_words(rep, "stages", stage_strings, codes)
    for s in stage_strings:
        for target in HREF.findall(s):
            check_link(rep, "stages", target, package, index, anchors)

    cards = data.get("cards") or []
    if not cards:
        rep.err("cards", "no cards")
        return rep
    ids = [str(c.get("id")) for c in cards if isinstance(c, dict)]
    dupes = {i for i in ids if ids.count(i) > 1}
    if dupes:
        rep.err("cards", f"duplicate ids: {', '.join(sorted(dupes))}")
    used = [c.get("stage") for c in cards if isinstance(c, dict)]
    if not all(isinstance(s, int) for s in used):
        rep.err("cards", "every card needs an integer 'stage'")
    elif used != sorted(used):
        rep.err("cards", "cards must be ordered by stage")
    for stage in dict.fromkeys(s for s in used if s not in nums):
        rep.err("stages", f"stage {stage} is not declared in 'stages'")
    index_by_id = {cid: i for i, cid in enumerate(ids)}

    # Каждый пункт закрывает ровно одна карточка; сущность — хотя бы одна
    owners = {}
    for pos, card in enumerate(cards):
        if not isinstance(card, dict):
            rep.err(f"#{pos}", "card must be an object")
            continue
        for p in check_card_f3(rep, card, pos, index_by_id, closable, ifaces, codes, keys, phase,
                               package, index, anchors):
            owners.setdefault(p, []).append(str(card.get("id")))
    for p, who in owners.items():
        if len(who) > 1 and closable.get(p) != "entity":
            rep.err("covers", f"{p} is closed by {len(who)} cards ({', '.join(who)}) — exactly one")
    orphan = [p for p in closable if p not in owners]
    if orphan:
        rep.err("covers", f"{len(orphan)} ТЗ item(s) closed by no card: "
                          f"{', '.join(orphan[:8])}{'…' if len(orphan) > 8 else ''}")

    # Реестр: открытые и закрытые строки, кроме замен, — один в один; приоритет тот же
    section = meta.get("registry")                         # пустое имя уже названо выше
    reg = registry_rows(section) if section else None
    if section and reg is None:
        rep.err("registry", f"section '{section}' not found in TODO.md")
    elif reg is not None:
        live = {i: r for i, r in reg.items() if not r[2] and not r[3]}
        for i, (done, _, new, gone) in reg.items():
            if (new or gone) and not done:
                rep.err("registry", f"{i} is replaced or withdrawn but still open — mark it [x]")
        missing = [i for i in ids if i not in live]
        extra_ids = [i for i in live if i not in index_by_id]
        if missing:
            rep.err("registry", f"not in TODO.md: {', '.join(missing)}")
        if extra_ids:
            rep.err("registry", f"in TODO.md but not here: {', '.join(extra_ids)}")
        for card in cards:
            if isinstance(card, dict) and card.get("id") in live:
                prio = live[card["id"]][1]
                if prio and prio != card.get("prio"):
                    rep.err(card["id"], f"prio {card.get('prio')} here, {prio} in TODO.md")
        for old, (_, _, new, _) in reg.items():
            for n in new:
                if n not in index_by_id:
                    rep.err("registry", f"{old} заменена {n}, but {n} is not a card here")

    rep.count = len(cards)
    rep.revision = None
    return rep


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
    if meta.get("format") == 3:
        return check_file_f3(path, data, index)
    for key in META_KEYS:
        if key not in meta:
            rep.err("meta", f"missing '{key}'")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(meta.get("date", ""))):
        rep.err("meta", "date must be YYYY-MM-DD")

    phase = meta.get("phase", r"\d+")
    package = set(meta.get("package") or []) | {path.name}
    anchors = {}
    fmt = meta.get("format", 1)
    if fmt not in (1, 2):
        rep.err("meta", f"format {fmt!r}: only 1, 2 and 3 exist")
        fmt = 1

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

    # Свод: то, что карточки перестали повторять
    if fmt >= 2:
        for block in ("atlas", "screens", "glossary", "walkthrough"):
            if not data.get(block):
                rep.err(block, f"format 2 requires '{block}' — cards carry only the delta")
        check_entities(rep, "atlas", "atlas", data.get("atlas"), need_key=True)
        check_screens(rep, "screens", "screens", data.get("screens"))
        check_terms(rep, "glossary", "glossary", data.get("glossary"))
        wt = data.get("walkthrough")
        if wt is not None:
            if not isinstance(wt, dict):
                rep.err("walkthrough", "must be an object {src, groups}")
            else:
                if not wt.get("src"):
                    rep.err("walkthrough", "'src' is required — name the record it walks through")
                check_groups(rep, "walkthrough", "walkthrough.groups", wt.get("groups"))
                if not DIGIT.search(" ".join(s for s in walk_strings(wt)
                                             if isinstance(s, str))):
                    rep.err("walkthrough", "no number in it — then it is not a worked example")
        summary_strings = [s for s in walk_strings(
            {k: data.get(k) for k in ("atlas", "screens", "glossary", "walkthrough")})
            if isinstance(s, str)]
        check_prose(rep, "summary", summary_strings)
        for s in summary_strings:
            for target in HREF.findall(s):
                check_link(rep, "summary", target, package, index, anchors)

    for pos, card in enumerate(cards):
        if isinstance(card, dict):
            check_card(rep, card, pos, index_by_id, package, index, anchors, phase, fmt)
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
