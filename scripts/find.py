#!/usr/bin/env python3
"""Навигатор по репозиторию: где определён ID и где он упомянут.

Смысл: 654 сквозных ID (P2-R1, P1-12, E2E-09, ADR-0004, Г-26) разбросаны
по 328 .md и 48 .html. Без карты агент читает файлы целиком, чтобы найти
одну строку. Скрипт отвечает «файл:строка» за один вызов.

    python3 scripts/find.py P15-R33      # определение + упоминания
    python3 scripts/find.py "неосвоенный остаток"   # свободный текст
    python3 scripts/find.py --build      # пересобрать INDEX.md
    python3 scripts/find.py --list P15   # все ID префикса

Индекс строится на лету (~0.3 с на репо) — кэш не хранится, рассинхрона нет.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Сквозные идентификаторы проекта. Порядок важен: более длинные шаблоны первыми,
# иначе P15-R33 распадётся на P15-R3.
# `(?<![-\w])` вместо голого `\b`: иначе в номере документа RESH-E2E-001
# найдётся несуществующий дефект E2E-001.
ID_RE = re.compile(
    r"(?<![-\w])(?:"
    r"P\d+-R\d+"  # рекомендации TODO.md
    r"|P\d+-\d+"  # дефекты qa-findings.md
    r"|E2E-\d{2}"  # дефекты обследования легаси, ровно две цифры
    r"|ADR-\d{1,4}"  # архитектурные решения
    r"|Г-\d+"  # гейты ТЗ
    r")(?![-\w])"
)

# Строка считается ОПРЕДЕЛЕНИЕМ ID, а не упоминанием, если ID стоит в начале
# пункта списка или заголовка. Так «- [ ] P2-R1 Визуальная семантика» —
# определение, а ссылка на P2-R1 в середине абзаца — упоминание.
DEF_RE = re.compile(
    r"^\s{0,8}(?:[-*+]\s+(?:\[[ xX~]\]\s+)?|#{1,6}\s+|\|\s*)?"
    r"(?:\*\*|__|`)?\s*"
    r"(?P<id>P\d+-R\d+|P\d+-\d+|E2E-\d{2}|ADR-\d{1,4}|Г-\d+)"
    r"(?:\*\*|__|`)?"
    # Дальше идёт эмодзи приоритета, тире или конец строки — важно лишь,
    # что ID закончился и это не длинный ID вроде P15-R331.
    r"(?![-\w])"
)

HEADING_RE = re.compile(r"^(#{1,3})\s+(.+?)\s*#*$")
# В .html постановках заголовок задачи лежит в <h1>…<h3>, а не в markdown.
HTML_HEADING_RE = re.compile(r"<h([1-3])[^>]*>(.*?)</h\1>", re.I | re.S)
TAG_RE = re.compile(r"<[^>]+>")

SKIP_DIRS = {".git", ".auth", "node_modules", "graphify-out", ".codegraph"}


@dataclass
class Entry:
    """Всё, что известно про один ID."""

    ident: str
    definition: tuple[str, int, str] | None = None  # (файл, строка, текст)
    mentions: list[tuple[str, int]] = field(default_factory=list)


def tracked_files() -> list[Path]:
    """Файлы под git — так автоматически отсекаются .auth/ и прочий мусор."""
    try:
        out = subprocess.run(
            ["git", "ls-files", "-z", "*.md", "*.html", "*.txt"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=True,
        ).stdout
        names = [n for n in out.split("\0") if n]
    except (subprocess.CalledProcessError, FileNotFoundError):
        names = [
            str(p.relative_to(ROOT))
            for p in ROOT.rglob("*")
            if p.suffix in {".md", ".html", ".txt"}
        ]
    files = []
    for name in names:
        path = ROOT / name
        if SKIP_DIRS & set(path.relative_to(ROOT).parts):
            continue
        if path.is_file():
            files.append(path)
    return files


def strip_tags(text: str) -> str:
    return re.sub(r"\s+", " ", TAG_RE.sub(" ", text)).strip()


def clean(line: str, ident: str) -> str:
    """Заголовок пункта: убрать разметку и сам ID, оставить суть."""
    text = strip_tags(line).strip()
    text = re.sub(r"^\s*[-*+]\s+(?:\[[ xX~]\]\s+)?", "", text)
    text = re.sub(r"^#{1,6}\s+", "", text)
    text = re.sub(r"^\|\s*", "", text)
    text = re.sub(r"[*_`]", "", text)
    text = text.replace(ident, "", 1)
    text = re.sub(r"^\s*[—–\-:.)|]+\s*", "", text)
    return re.sub(r"\s+", " ", text).strip()[:110]


def scan() -> tuple[dict[str, Entry], list[tuple[str, int, int, str]]]:
    """Один проход по репо: собрать ID и заголовки."""
    entries: dict[str, Entry] = {}
    headings: list[tuple[str, int, int, str]] = []  # (файл, строка, уровень, текст)

    for path in tracked_files():
        rel = str(path.relative_to(ROOT))
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        is_html = path.suffix == ".html"

        # ADR нумеруются именем файла, а не строкой внутри.
        adr = re.match(r"(\d{4})-", path.name)
        if adr and path.parent.name == "adr":
            ident = f"ADR-{int(adr.group(1)):04d}"
            entry = entries.setdefault(ident, Entry(ident))
            entry.definition = (rel, 1, path.stem.split("-", 1)[-1].replace("-", " "))

        for lineno, line in enumerate(text.splitlines(), 1):
            match = DEF_RE.match(line)
            if match:
                ident = match.group("id")
                entry = entries.setdefault(ident, Entry(ident))
                # Первое определение выигрывает: реестр идёт раньше пересказов.
                if entry.definition is None:
                    entry.definition = (rel, lineno, clean(line, ident))

            for found in ID_RE.finditer(line):
                ident = found.group(0)
                entry = entries.setdefault(ident, Entry(ident))
                if entry.definition and entry.definition[:2] == (rel, lineno):
                    continue
                if (rel, lineno) not in entry.mentions:
                    entry.mentions.append((rel, lineno))

            if not is_html:
                head = HEADING_RE.match(line)
                if head:
                    headings.append(
                        (rel, lineno, len(head.group(1)), strip_tags(head.group(2)))
                    )

        if is_html:
            for head in HTML_HEADING_RE.finditer(text):
                lineno = text.count("\n", 0, head.start()) + 1
                title = strip_tags(head.group(2))
                if title:
                    headings.append((rel, lineno, int(head.group(1)), title))

    return entries, headings


def sort_key(ident: str) -> tuple:
    """P2-R1 < P2-R10 < P15-R1 — сортировка по числам, не по строке."""
    prefix = re.match(r"[^\d]*", ident).group(0)
    nums = [int(n) for n in re.findall(r"\d+", ident)]
    return (prefix, *nums)


def cmd_lookup(query: str, entries: dict[str, Entry], headings) -> int:
    exact = ID_RE.fullmatch(query.strip())
    if exact and query.strip() in entries:
        entry = entries[query.strip()]
        print(f"# {entry.ident}")
        if entry.definition:
            rel, lineno, title = entry.definition
            print(f"определён:  {rel}:{lineno}")
            if title:
                print(f"заголовок:  {title}")
        else:
            print("определён:  — (только упоминания)")
        if entry.mentions:
            print(f"упомянут ({len(entry.mentions)}):")
            for rel, lineno in entry.mentions[:40]:
                print(f"  {rel}:{lineno}")
            if len(entry.mentions) > 40:
                print(f"  … ещё {len(entry.mentions) - 40}")
        return 0

    # Свободный текст: сначала заголовки (дешёвый и точный сигнал), потом grep.
    needle = query.lower()
    hits = [h for h in headings if needle in h[3].lower()]
    if hits:
        print(f"# заголовки, совпавшие с «{query}» ({len(hits)})")
        for rel, lineno, level, title in hits[:40]:
            print(f"  {rel}:{lineno}  {'#' * level} {title}")
        if len(hits) > 40:
            print(f"  … ещё {len(hits) - 40}")
        print()

    print(f"# строки, совпавшие с «{query}»")
    grep = subprocess.run(
        ["git", "grep", "-n", "-i", "-F", query, "--", "*.md", "*.html", "*.txt"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    lines = [l for l in grep.stdout.splitlines() if l.strip()]
    if not lines:
        print("  ничего не найдено" if not hits else "  (только заголовки выше)")
        return 0 if hits else 1
    by_file: dict[str, list[str]] = defaultdict(list)
    for line in lines:
        rel, _, rest = line.partition(":")
        by_file[rel].append(rest)
    for rel, rows in sorted(by_file.items(), key=lambda kv: -len(kv[1]))[:25]:
        lineno = rows[0].partition(":")[0]
        print(f"  {rel}:{lineno}  ({len(rows)} совп.)")
    if len(by_file) > 25:
        print(f"  … ещё {len(by_file) - 25} файлов")
    return 0


def cmd_list(prefix: str, entries: dict[str, Entry]) -> int:
    picked = [e for k, e in entries.items() if k.startswith(prefix)]
    if not picked:
        print(f"нет ID с префиксом «{prefix}»")
        return 1
    for entry in sorted(picked, key=lambda e: sort_key(e.ident)):
        where = f"{entry.definition[0]}:{entry.definition[1]}" if entry.definition else "—"
        title = entry.definition[2] if entry.definition else ""
        print(f"{entry.ident:<12} {where:<44} {title}")
    return 0


def cmd_build(entries: dict[str, Entry], headings) -> int:
    """INDEX.md — реестр ID для чтения человеком и грепа агентом."""
    out = [
        "# INDEX — карта сквозных идентификаторов",
        "",
        "Собран `scripts/find.py --build`. **Не править руками.**",
        "",
        "Точечный поиск быстрее чтения этого файла:",
        "`python3 scripts/find.py P15-R33`",
        "",
        f"Всего ID: {len(entries)}.",
        "",
        "| ID | Определён | Заголовок | Упом. |",
        "|---|---|---|---|",
    ]
    for entry in sorted(entries.values(), key=lambda e: sort_key(e.ident)):
        if entry.definition:
            rel, lineno, title = entry.definition
            where = f"`{rel}:{lineno}`"
        else:
            where, title = "—", ""
        title = title.replace("|", "\\|")
        out.append(f"| {entry.ident} | {where} | {title} | {len(entry.mentions)} |")
    out.append("")

    target = ROOT / "INDEX.md"
    target.write_text("\n".join(out), encoding="utf-8")
    size = target.stat().st_size
    orphans = [e.ident for e in entries.values() if not e.definition]
    print(f"INDEX.md: {len(entries)} ID, {size / 1024:.0f} КБ")
    print(f"заголовков просканировано: {len(headings)}")
    if orphans:
        print(f"без определения ({len(orphans)}): {', '.join(sorted(orphans, key=sort_key)[:20])}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Найти ID или текст в репозитории без чтения файлов целиком.",
    )
    parser.add_argument("query", nargs="?", help="ID (P15-R33) или подстрока")
    parser.add_argument("--build", action="store_true", help="пересобрать INDEX.md")
    parser.add_argument("--list", metavar="PREFIX", help="все ID с префиксом, напр. P15")
    args = parser.parse_args()

    entries, headings = scan()

    if args.build:
        return cmd_build(entries, headings)
    if args.list:
        return cmd_list(args.list, entries)
    if args.query:
        return cmd_lookup(args.query, entries, headings)
    parser.print_help()
    return 2


if __name__ == "__main__":
    sys.exit(main())
