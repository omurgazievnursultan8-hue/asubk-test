#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Конвертер .docx -> .md без внешних зависимостей.

Нужен потому, что в системе нет ни pandoc, ни python-docx, а исходное ТЗ
приходит только в .docx. Разбирает word/document.xml средствами stdlib:
заголовки по w:pStyle, списки по w:numPr, таблицы w:tbl -> GFM.

    python3 scripts/docx_to_md.py <вход.docx> [выход.md]
"""

import re
import sys
import zipfile
import xml.etree.ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def tag(el):
    return el.tag[len(W):] if el.tag.startswith(W) else el.tag


def para_style(p):
    ppr = p.find(W + "pPr")
    if ppr is None:
        return "", False
    style = ""
    pstyle = ppr.find(W + "pStyle")
    if pstyle is not None:
        style = pstyle.get(W + "val") or ""
    listed = ppr.find(W + "numPr") is not None
    return style, listed


def run_text(r):
    out = []
    for child in r:
        name = tag(child)
        if name == "t":
            out.append(child.text or "")
        elif name == "tab":
            out.append("\t")
        elif name in ("br", "cr"):
            out.append("\n")
    return "".join(out)


def para_text(p):
    out = []
    for r in p.iter(W + "r"):
        text = run_text(r)
        if not text:
            continue
        rpr = r.find(W + "rPr")
        bold = rpr is not None and rpr.find(W + "b") is not None
        if bold and text.strip():
            lead = text[: len(text) - len(text.lstrip())]
            tail = text[len(text.rstrip()):]
            out.append("%s**%s**%s" % (lead, text.strip(), tail))
        else:
            out.append(text)
    return re.sub(r"[ \t]+", " ", "".join(out)).strip()


HEADING = re.compile(r"^(?:Heading|Заголовок)\s*(\d)", re.I)


def para_md(p):
    style, listed = para_style(p)
    text = para_text(p)
    if not text:
        return ""
    m = HEADING.match(style)
    if m:
        level = min(int(m.group(1)), 6)
        return "%s %s" % ("#" * level, text.replace("**", ""))
    if listed:
        return "- %s" % text
    return text


def cell_text(tc):
    parts = [para_text(p) for p in tc.findall(W + "p")]
    return " ".join(x for x in parts if x).replace("|", "\\|")


def table_md(tbl):
    rows = []
    for tr in tbl.findall(W + "tr"):
        rows.append([cell_text(tc) for tc in tr.findall(W + "tc")])
    rows = [r for r in rows if any(c.strip() for c in r)]
    if not rows:
        return ""
    width = max(len(r) for r in rows)
    rows = [r + [""] * (width - len(r)) for r in rows]
    lines = ["| " + " | ".join(rows[0]) + " |",
             "|" + "|".join([" --- "] * width) + "|"]
    for r in rows[1:]:
        lines.append("| " + " | ".join(r) + " |")
    return "\n".join(lines)


def convert(src):
    with zipfile.ZipFile(src) as zf:
        xml = zf.read("word/document.xml")
    body = ET.fromstring(xml).find(W + "body")
    blocks = []
    for el in body:
        name = tag(el)
        if name == "p":
            blocks.append(para_md(el))
        elif name == "tbl":
            blocks.append(table_md(el))
    out, blank = [], False
    for block in blocks:
        if not block:
            blank = True
            continue
        if out and blank:
            out.append("")
        blank = False
        out.append(block)
    return "\n".join(out) + "\n"


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    src = sys.argv[1]
    dst = sys.argv[2] if len(sys.argv) > 2 else re.sub(r"\.docx$", ".md", src)
    text = convert(src)
    with open(dst, "w", encoding="utf-8") as f:
        f.write(text)
    print("%s -> %s (%d символов, %d строк)" % (src, dst, len(text), text.count("\n")))
    return 0


if __name__ == "__main__":
    sys.exit(main())
