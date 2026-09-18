"""Собирает страницу «Поля статистики» из физической схемы статистики.

Источник — mockups/statistics/ASUBK-statistika-fizschema.md (§0.1 сводка, §0.2 имена,
§1–§11 таблицы строк). Шаблон — build_stat_fields.tpl.html рядом со скриптом; данные
встраиваются в него JSON-ом вместо метки /*__DATA__*/null.

    python3 scripts/build_stat_fields.py                  # пути по умолчанию
    python3 scripts/build_stat_fields.py <fizschema.md> <out.html>

Счёт сверяется со сводкой §0.1: по каждой таблице — служебные / разрезы / показатели /
всего, и итог. Не сошлось — страница не пишется.
"""
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'mockups/statistics/ASUBK-statistika-fizschema.md'
OUT = ROOT / 'mockups/statistics/statistics-fields.html'
TPL = Path(__file__).resolve().with_suffix('.tpl.html')

SLUG = {
    'stat_row_credit': 'credit', 'stat_row_borrower': 'borrower', 'stat_row_group_member': 'group',
    'stat_row_collateral': 'collateral', 'stat_row_zdeal': 'zdeal', 'stat_row_case': 'case',
    'stat_row_claim': 'claim', 'stat_row_program': 'program', 'stat_row_repay': 'repay',
    'stat_row_receipt': 'receipt', 'stat_row_measure': 'measure',
}


def md(s):
    """Инлайн-markdown → HTML: экранирование, `код`, **жирный**."""
    parts = re.split(r'(`[^`]*`)', s)
    res = []
    for p in parts:
        if p.startswith('`') and p.endswith('`') and len(p) >= 2:
            res.append('<code>' + html.escape(p[1:-1]) + '</code>')
        else:
            e = html.escape(p)
            e = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', e)
            res.append(e)
    return ''.join(res)


def plain(s):
    return re.sub(r'[`*]', '', s)


def cells(line):
    return [c.strip() for c in line.strip().strip('|').split('|')]


def kind_of(name):
    n = name.lower()
    if n.startswith('служеб'):
        return 'svc'
    if n.startswith('разрез'):
        return 'dim'
    return 'ind'


def num(s):
    return int(plain(s))


def parse(lines):
    objects = []
    legend = []
    summary = {}
    total = None
    cur = None
    grp = None
    in_legend = False
    for line in lines:
        m = re.match(r'^\| §\d+ \| `(stat_row_\w+)` \|', line)
        if m:
            c = cells(line)
            summary[m.group(1)] = {'svc': num(c[4]), 'dim': num(c[5]), 'ind': num(c[6]), 'total': num(c[7])}
            continue
        if re.match(r'^\| \| \*\*итого\*\* \|', line):
            total = num(cells(line)[-1])
            continue
        m = re.match(r'^## (\d+)\. `(stat_row_\w+)` — (.+?) · колонок: (\d+)$', line)
        if m:
            cur = {'n': int(m.group(1)), 'table': m.group(2), 'slug': SLUG[m.group(2)],
                   'title': m.group(3), 'total': int(m.group(4)), 'facts': [], 'groups': [], 'notes': []}
            objects.append(cur)
            grp = None
            in_legend = False
            continue
        if line.startswith('## '):
            cur = None
            grp = None
            in_legend = False
            continue
        if line.startswith('### 0.2'):
            in_legend = True
            continue
        if line.startswith('### ') and in_legend:
            in_legend = False
        if in_legend and line.startswith('| ') and not line.startswith('| Часть'):
            c = cells(line)
            legend.append({'part': md(c[0]), 'meaning': md(c[1]), 'example': md(c[2])})
            continue
        if cur is None:
            continue
        m = re.match(r'^### (\d+\.\d+)\. (.+?) — (\d+)$', line)
        if m:
            grp = {'name': m.group(2), 'kind': kind_of(m.group(2)), 'count': int(m.group(3)), 'rows': []}
            cur['groups'].append(grp)
            continue
        m = re.match(r'^- \*\*(.+?):\*\* (.+)$', line)
        if m and grp is None:
            # «Способ хранения: `state` · ключ: (...)» — разбить на два факта
            val = m.group(2)
            km = re.match(r'^(.*?) · \*\*ключ:\*\* (.*)$', val)
            if km:
                cur['facts'].append({'label': m.group(1), 'value': md(km.group(1))})
                cur['facts'].append({'label': 'Ключ', 'value': md(km.group(2))})
            else:
                cur['facts'].append({'label': m.group(1), 'value': md(val)})
            continue
        if line.startswith('> '):
            cur['notes'].append(md(line[2:]))
            continue
        if grp is not None and line.startswith('| ') and not line.startswith('| Колонки') and not line.startswith('|---'):
            c = cells(line)
            cols, n, typ, meaning, source = c[0], int(c[1]), c[2], c[3], c[4]
            names = re.findall(r'`([^`]+)`', cols)
            grp['rows'].append({
                'cols': names or [plain(cols)],
                'n': n,
                'type': md(typ),
                'meaning': md(meaning),
                'source': md(source),
                'flag': '⚑' in source,
                'warn': '⚠' in meaning or '⚠' in source,
                'text': (plain(cols) + ' ' + plain(typ) + ' ' + plain(meaning) + ' ' + plain(source)).lower(),
            })
    return objects, legend, summary, total


def check(objects, summary, total):
    """Счёт колонок: строки группы = заголовок группы; группы = заголовок раздела = сводка §0.1."""
    assert objects, 'разделы §1–§11 не найдены'
    assert set(summary) == {o['table'] for o in objects}, ('сводка §0.1 ≠ разделы', sorted(summary))
    for o in objects:
        by_kind = {'svc': 0, 'dim': 0, 'ind': 0}
        for g in o['groups']:
            assert sum(r['n'] for r in g['rows']) == g['count'], (o['table'], g['name'])
            by_kind[g['kind']] += g['count']
        assert sum(by_kind.values()) == o['total'], (o['table'], by_kind, o['total'])
        s = summary[o['table']]
        assert (by_kind, o['total']) == ({k: s[k] for k in by_kind}, s['total']), (o['table'], by_kind, s)
    assert sum(o['total'] for o in objects) == total, ('итого §0.1', total)


def main():
    src, out = (Path(sys.argv[1]), Path(sys.argv[2])) if len(sys.argv) > 2 else (SRC, OUT)
    objects, legend, summary, total = parse(src.read_text(encoding='utf-8').splitlines())
    check(objects, summary, total)
    data = json.dumps({'objects': objects, 'legend': legend}, ensure_ascii=False)
    tpl = TPL.read_text(encoding='utf-8')
    assert tpl.count('/*__DATA__*/null') == 1, 'метка данных в шаблоне'
    out.write_text(tpl.replace('/*__DATA__*/null', data), encoding='utf-8')
    print(f'{out}: таблиц {len(objects)}, колонок {total}, строк легенды {len(legend)}')


if __name__ == '__main__':
    main()
