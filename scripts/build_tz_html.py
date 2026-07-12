#!/usr/bin/env python3
"""Render a ТЗ markdown file to a self-contained HTML page in the ASUBK gov-blue
design system (matches requirements/tz/*.html). Builds a sticky sidebar nav from
h2/h3 headings.

Usage:
    python3 scripts/build_tz_html.py requirements/tz/03-zayavka-komissiya.md
    # -> writes requirements/tz/03-zayavka-komissiya.html
"""
import re
import sys
import html as _html
from pathlib import Path

import markdown

CSS = """
  :root{
    --blue:#1b4b8f; --blue-d:#143a6f; --ink:#1c2733; --muted:#6b7885;
    --line:#e2e8f0; --bg:#f4f6f9; --card:#fff; --accent:#eef3fa;
    --req:#d64545; --note:#0b6b53; --note-bg:#e9f6f1;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);
    font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif;font-size:14px;line-height:1.55}
  header{background:linear-gradient(135deg,var(--blue),var(--blue-d));color:#fff;padding:30px 40px}
  header .kick{font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:.75}
  header h1{margin:6px 0 8px;font-size:26px;font-weight:600}
  header .routes{font-size:12px;opacity:.85;font-family:ui-monospace,Menlo,Consolas,monospace}
  .layout{display:flex;max-width:1200px;margin:0 auto;gap:0}
  nav{position:sticky;top:0;align-self:flex-start;width:260px;flex:0 0 260px;
    padding:26px 18px;height:100vh;overflow:auto;border-right:1px solid var(--line);background:var(--card)}
  nav h3{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin:0 0 10px}
  nav a{display:block;color:var(--ink);text-decoration:none;font-size:13px;padding:4px 8px;border-radius:6px}
  nav a:hover{background:var(--accent);color:var(--blue-d)}
  nav a.sub{padding-left:20px;color:var(--muted);font-size:12px}
  main{flex:1;padding:26px 40px 80px;min-width:0}
  h1.doc{font-size:22px;color:var(--blue-d);margin:8px 0 16px}
  h2{font-size:19px;color:var(--blue-d);margin:38px 0 12px;padding-bottom:8px;border-bottom:2px solid var(--line);scroll-margin-top:12px}
  h3{font-size:15px;color:var(--blue);margin:26px 0 8px;scroll-margin-top:12px}
  h4{font-size:13px;color:var(--ink);margin:16px 0 6px;text-transform:uppercase;letter-spacing:.4px}
  p{margin:8px 0}
  code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;
    background:var(--accent);padding:1px 5px;border-radius:4px;color:var(--blue-d)}
  table{border-collapse:collapse;width:100%;margin:12px 0;font-size:13px}
  th,td{border:1px solid var(--line);padding:7px 10px;text-align:left;vertical-align:top}
  th{background:var(--accent);color:var(--blue-d);font-weight:600}
  tr:nth-child(even) td{background:#fafbfd}
  blockquote{background:var(--note-bg);border-left:3px solid var(--note);padding:10px 14px;
    margin:12px 0;border-radius:0 6px 6px 0;font-size:13px;color:#234}
  blockquote p{margin:4px 0}
  blockquote strong{color:var(--note)}
  pre{background:#0f2440;color:#dbe7f7;padding:14px 16px;border-radius:8px;overflow:auto;
    font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;line-height:1.4}
  pre code{background:none;color:inherit;padding:0}
  ul,ol{margin:8px 0;padding-left:22px}
  li{margin:4px 0}
  hr{border:none;border-top:1px solid var(--line);margin:28px 0}
  em{color:var(--muted)}
  @media print{nav{display:none} .layout{max-width:none} header{padding:20px}}
"""


def slugify(text: str) -> str:
    t = re.sub(r"<[^>]+>", "", text)
    t = t.strip().lower()
    t = re.sub(r"[^\wЀ-ӿ]+", "-", t)
    return t.strip("-") or "s"


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit("usage: build_tz_html.py <file.md> [out.html]")
    src = Path(sys.argv[1])
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else src.with_suffix(".html")
    text = src.read_text(encoding="utf-8")

    # Pull the H1 title (first "# ..." line) out for the header banner.
    title = "ТЗ"
    lines = text.splitlines()
    for i, ln in enumerate(lines):
        m = re.match(r"^#\s+(.*)$", ln)
        if m:
            title = m.group(1).strip()
            del lines[i]
            break
    body_md = "\n".join(lines)

    md = markdown.Markdown(extensions=["tables", "fenced_code", "attr_list", "sane_lists"])
    body_html = md.convert(body_md)

    # Assign ids to h2/h3 and collect nav entries.
    nav = []

    def add_id(m):
        tag, attrs, inner = m.group(1), m.group(2), m.group(3)
        slug = slugify(inner)
        nav.append((tag, slug, re.sub(r"<[^>]+>", "", inner)))
        return f'<{tag}{attrs} id="{slug}">{inner}</{tag}>'

    body_html = re.sub(r"<(h[23])((?:\s[^>]*)?)>(.*?)</\1>", add_id, body_html, flags=re.S)

    nav_html = ['<h3>Содержание</h3>']
    for tag, slug, label in nav:
        cls = ' class="sub"' if tag == "h3" else ""
        nav_html.append(f'<a href="#{slug}"{cls}>{_html.escape(label)}</a>')

    doc = f"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{_html.escape(title)}</title>
<style>{CSS}</style>
</head>
<body>
<header>
  <div class="kick">Техническое задание · Раздел 03 · целевая модель (to-be)</div>
  <h1>{_html.escape(title)}</h1>
  <div class="routes">/loan-applications · /loan-applications/{{id}} · /loan-application-commissions</div>
</header>
<div class="layout">
<nav>
{chr(10).join(nav_html)}
</nav>
<main>
{body_html}
</main>
</div>
</body>
</html>
"""
    out.write_text(doc, encoding="utf-8")
    print(f"wrote {out} ({len(doc)} bytes, {len(nav)} nav entries)")


if __name__ == "__main__":
    main()
