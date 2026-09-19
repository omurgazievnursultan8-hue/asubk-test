"""Собирает страницу «Поля статистики» из физической схемы и словаря полей.

Источники:
- mockups/statistics/ASUBK-statistika-fizschema.md — состав колонок, типы, источники
  (§0.1 сводка, §0.2 имена, §1–§11 таблицы строк, §12 служебные таблицы);
- mockups/statistics/ASUBK-statistika-polya.md — словарь: §0 «Как хранятся данные» и по
  каждой таблице поля «что это · зачем · опора».

Шаблон — build_stat_fields.tpl.html рядом со скриптом; данные встраиваются в него JSON-ом
вместо метки /*__DATA__*/null.

    python3 scripts/build_stat_fields.py                  # пути по умолчанию
    python3 scripts/build_stat_fields.py <fizschema.md> <polya.md> <out.html>

Проверки (не сошлось — страница не пишется):
- счёт колонок таблиц строк сверяется со сводкой §0.1;
- у каждой таблицы — строк и служебной — есть раздел в словаре;
- каждая колонка схемы лежит ровно в одном поле, каждая колонка поля есть в схеме, и все
  колонки поля — из одной группы схемы;
- пометка ⚑ («у соседа пока нет») строки схемы переходит к полю, которое забрало строку
  целиком. Если строка разделена на несколько полей, ⚑ ставится в тексте тех полей, к
  которым она относится; ⚑ строки, не дошедший ни до одного поля, и ⚑ в поле без пометки
  в схеме — ошибка.
"""
import html
import itertools
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'mockups/statistics/ASUBK-statistika-fizschema.md'
DICT = ROOT / 'mockups/statistics/ASUBK-statistika-polya.md'
OUT = ROOT / 'mockups/statistics/statistics-fields.html'
TPL = Path(__file__).resolve().with_suffix('.tpl.html')

SLUG = {
    'stat_row_credit': 'credit', 'stat_row_borrower': 'borrower', 'stat_row_group_member': 'group',
    'stat_row_collateral': 'collateral', 'stat_row_zdeal': 'zdeal', 'stat_row_case': 'case',
    'stat_row_claim': 'claim', 'stat_row_program': 'program', 'stat_row_repay': 'repay',
    'stat_row_receipt': 'receipt', 'stat_row_measure': 'measure',
}
# подразделы §12 → адрес группы служебных таблиц на странице
SVC_SLUG = {'12.1': 'svc-registry', '12.2': 'svc-run', '12.3': 'svc-queue', '12.4': 'svc-marker',
            '12.5': 'svc-calendar', '12.6': 'svc-refindex', '12.7': 'svc-export'}


# ---------- разметка ----------

def md(s):
    """Инлайн-markdown → HTML: экранирование, `код`, **жирный** (в том числе вокруг кода)."""
    codes = []

    def keep(m):
        codes.append('<code>' + html.escape(m.group(1)) + '</code>')
        return f'\x00{len(codes) - 1}\x00'
    e = html.escape(re.sub(r'`([^`]*)`', keep, s), quote=False)
    e = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', e)
    return re.sub(r'\x00(\d+)\x00', lambda m: codes[int(m.group(1))], e)


def plain(s):
    return re.sub(r'[`*]', '', s)


def cells(line):
    return [c.strip() for c in line.strip().strip('|').split('|')]


def slugify(s):
    s = plain(s).lower()
    s = re.sub(r'[^\w\s-]', '', s)
    return re.sub(r'\s+', '-', s.strip())[:60]


LIST_RE = re.compile(r'^(\s*)([-*]|\d+\.)\s+(.*)$')


def render_list(lines, i, indent):
    ordered = LIST_RE.match(lines[i]).group(2)[0].isdigit()
    items = []
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            m = LIST_RE.match(lines[j]) if j < len(lines) else None
            if m and len(m.group(1)) == indent:
                i = j
                continue
            break
        m = LIST_RE.match(line)
        ind = len(line) - len(line.lstrip())
        if m and ind == indent:
            items.append([m.group(3), ''])
            i += 1
        elif m and ind > indent and items:
            sub, i = render_list(lines, i, ind)
            items[-1][1] += sub
        elif ind > indent and items:
            items[-1][0] += ' ' + line.strip()
            i += 1
        else:
            break
    tag = 'ol' if ordered else 'ul'
    return f'<{tag}>' + ''.join(f'<li>{md(t)}{c}</li>' for t, c in items) + f'</{tag}>', i


def render_md(lines, marks, toc=None):
    """Блочный markdown раздела §0: заголовки ###/####, абзацы, списки, таблицы, код, цитаты."""
    out = []
    i = 0
    while i < len(lines):
        line = lines[i]
        s = line.strip()
        if not s or s == '---':
            i += 1
            continue
        if s in marks:
            out.append(marks[s])
            i += 1
            continue
        if line.startswith('```'):
            j = i + 1
            buf = []
            while j < len(lines) and not lines[j].startswith('```'):
                buf.append(lines[j])
                j += 1
            out.append('<pre class="code"><code>' + html.escape('\n'.join(buf)) + '</code></pre>')
            i = j + 1
            continue
        m = re.match(r'^(#{3,4}) (.+)$', line)
        if m:
            lvl = len(m.group(1))
            hid = 'l-' + slugify(m.group(2))
            if toc is not None and lvl == 3:
                toc.append({'id': hid, 'text': plain(m.group(2))})
            out.append(f'<h{lvl} id="{hid}">{md(m.group(2))}</h{lvl}>')
            i += 1
            continue
        if line.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].startswith('|'):
                if not re.match(r'^\|[-\s|:]+\|$', lines[i].strip()):
                    rows.append(cells(lines[i]))
                i += 1
            head, body = rows[0], rows[1:]
            out.append('<div class="mdt"><table><thead><tr>' + ''.join(f'<th>{md(c)}</th>' for c in head)
                       + '</tr></thead><tbody>' + ''.join('<tr>' + ''.join(f'<td>{md(c)}</td>' for c in r) + '</tr>' for r in body)
                       + '</tbody></table></div>')
            continue
        if line.startswith('>'):
            buf = []
            while i < len(lines) and lines[i].startswith('>'):
                buf.append(lines[i][2:] if lines[i].startswith('> ') else lines[i][1:])
                i += 1
            out.append('<div class="callout">' + render_md(buf, marks) + '</div>')
            continue
        if LIST_RE.match(line):
            h, i = render_list(lines, i, len(line) - len(line.lstrip()))
            out.append(h)
            continue
        buf = []
        while i < len(lines):
            t = lines[i]
            if (not t.strip() or t.startswith(('```', '#', '|', '>')) or LIST_RE.match(t)
                    or t.strip() in marks):
                break
            buf.append(t.strip())
            i += 1
        out.append('<p>' + md(' '.join(buf)) + '</p>')
    return ''.join(out)


# ---------- имена колонок ----------

def expand(p):
    """`i_{od,int}_{v,som}` → i_od_v, i_od_som, …; `d_cls{1..10}_x` → d_cls1_x … d_cls10_x."""
    parts = re.split(r'(\{[^}]*\})', p)
    opts = []
    for x in parts:
        if x.startswith('{'):
            r = re.fullmatch(r'\{(\d+)\.\.(\d+)\}', x)
            opts.append([str(k) for k in range(int(r.group(1)), int(r.group(2)) + 1)] if r else x[1:-1].split(','))
        else:
            opts.append([x])
    return [''.join(t) for t in itertools.product(*opts)]


def schema_cols(cell):
    """Колонки ячейки «Колонки» таблиц §1–§11."""
    m = re.search(r'`(\w+?)1_(\w+)` … `\1(\d+)_\w+` \((.+)\)', cell)
    if m:  # `d_cls1_code` … `d_cls10_ord` (`d_clsN_code` · `_lbl` · `_ord`)
        sufs = [t.split('_')[-1] for t in re.findall(r'`([^`]+)`', m.group(4))]
        return [f'{m.group(1)}{k}_{s}' for k in range(1, int(m.group(3)) + 1) for s in sufs]
    return [n for t in re.findall(r'`([^`]+)`', cell) for n in expand(t)]


def short_names(tokens):
    """`ordered_by_id` + `_lbl` → ordered_by_id, ordered_by_lbl."""
    res = []
    for t in tokens:
        if t.startswith('_') and res:
            t = res[-1].rsplit('_', 1)[0] + t
        res.append(t)
    return res


def svc_types(names_cell, type_cell):
    """`actor_id` + `actor_lbl`, `reason` | uuid + text, text → тип каждой колонки, если счёт сходится."""
    groups = [short_names(re.findall(r'`([^`]+)`', g)) for g in re.split(r',\s+(?=`)', names_cell)]
    names = short_names([n for g in groups for n in g])
    tparts = [t.strip() for t in type_cell.split(', ')] if type_cell else []
    if len(tparts) != len(groups):
        return [(n, type_cell) for n in names]
    res, k = [], 0
    for g, t in zip(groups, tparts):
        sub = [x.strip() for x in t.split(' + ')]
        for j, _ in enumerate(g):
            res.append((names[k], sub[j] if len(sub) == len(g) else t))
            k += 1
    return res


def svc_list(text):
    """`record_id` → `stat_registry`, `ord` smallint, `by_id` uuid + `by_lbl` text → [(имя, тип)]."""
    res = []
    for part in re.split(r',\s+(?=`)', text):
        for sub in part.split(' + '):
            m = re.match(r'\s*`([^`]+)`\s*(.*)$', sub)
            if not m:
                continue
            name = m.group(1)
            if name.startswith('_') and res:
                name = res[-1][0].rsplit('_', 1)[0] + name
            res.append((name, md(m.group(2).strip().rstrip('.'))))
    return res


def kind_of(name):
    n = name.lower()
    if n.startswith('служеб'):
        return 'svc'
    if n.startswith('разрез'):
        return 'dim'
    return 'ind'


def num(s):
    return int(plain(s))


# ---------- схема ----------

def parse_schema(lines):
    objects, legend, summary, total = [], [], {}, None
    services, svc_sub, svc_mode, svc_cur = [], None, None, None
    cur = grp = None
    in_legend = in_svc = False
    for line in lines:
        m = re.match(r'^\| §\d+ \| `(stat_row_\w+)` \|', line)
        if m:
            c = cells(line)
            summary[m.group(1)] = {'object': c[2], 'storage': plain(c[3]), 'svc': num(c[4]), 'dim': num(c[5]),
                                   'ind': num(c[6]), 'total': num(c[7])}
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
            in_legend = in_svc = False
            continue
        if line.startswith('## '):
            cur = grp = None
            in_legend = False
            in_svc = line.startswith('## 12.')
            continue
        if in_svc:
            m = re.match(r'^### (12\.\d+)\. (.+)$', line)
            if m:
                svc_sub = {'n': m.group(1), 'slug': SVC_SLUG[m.group(1)], 'title': plain(m.group(2)).split(' (')[0],
                           'tables': []}
                services.append(svc_sub)
                svc_mode, svc_cur = None, None
                continue
            m = re.match(r'^\*\*`(\w+)`\*\*(.*)$', line)
            if m:
                desc = m.group(2).strip()
                desc = re.sub(r'^—\s*', '', desc).rstrip('.')
                svc_cur = {'table': m.group(1), 'desc': md(desc), 'cols': []}
                svc_sub['tables'].append(svc_cur)
                svc_mode = 'cols'
                continue
            if 'Дочерние таблицы реестра' in line:
                svc_mode, svc_cur = 'children', None
                continue
            if line.startswith('Статистика пишет в `period_calendar`'):
                svc_cur = {'table': 'period_calendar', 'desc': md('общий календарь периодов (`ADR-0204`); статистика пишет в него только свои колонки: когда закрыт период, кем, каким распоряжением и каким прогоном'), 'cols': []}
                svc_sub['tables'].append(svc_cur)
                svc_mode = 'cols'
                continue
            m = re.match(r'^- \*\*[^*]+\*\* — таблица `(\w+)`: (.+?)\.(?:\s|$)', line)
            if m:
                svc_sub['tables'].append({'table': m.group(1), 'desc': '', 'cols': [
                    {'name': n, 'type': t, 'meaning': ''} for n, t in svc_list(m.group(2))]})
                continue
            if line.startswith('| `'):
                c = cells(line)
                if svc_mode == 'children':
                    svc_sub['tables'].append({'table': plain(c[0]), 'desc': '', 'key': md(c[2]), 'cols': [
                        {'name': n, 'type': t, 'meaning': ''} for n, t in svc_list(c[1])]})
                elif svc_mode == 'cols' and svc_cur is not None:
                    typ = c[1] if len(c) > 1 else ''
                    for n, t in svc_types(c[0], typ):
                        svc_cur['cols'].append({'name': n, 'type': md(t), 'meaning': md(c[2]) if len(c) > 2 else ''})
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
            names = schema_cols(cols)
            assert len(names) == n, (cur['table'], cols, len(names), n)
            grp['rows'].append({
                'cols': re.findall(r'`([^`]+)`', cols) or [plain(cols)],
                'colnames': names,
                'n': n,
                'type': md(typ),
                'rawtype': plain(typ),
                'meaning': md(meaning),
                'source': md(source),
                'flag': '⚑' in source,
                'warn': '⚠' in meaning or '⚠' in source,
                'text': (plain(cols) + ' ' + ' '.join(names) + ' ' + plain(typ) + ' ' + plain(meaning) + ' ' + plain(source)).lower(),
            })
    return objects, legend, summary, total, services


def join_bullets(lines):
    """Продолжение пункта списка (строка с отступом без маркера) приклеивается к пункту."""
    res = []
    for line in lines:
        if (res and res[-1].startswith('- ') and line.startswith('  ') and line.strip()
                and not LIST_RE.match(line)):
            res[-1] += ' ' + line.strip()
        else:
            res.append(line)
    return res


def check_counts(objects, summary, total):
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


# ---------- словарь ----------

def parse_dict(lines):
    """§0 — строки markdown; дальше блоки таблиц: заголовок с `имя_таблицы`, текст, поля."""
    logic, blocks = [], {}
    part = None  # None — шапка, 'logic' — §0, иначе — имя таблицы текущего блока
    for line in lines:
        m = re.match(r'^#{2,3} (?:\d+\. )?`(\w+)`(?: — (.+))?$', line)
        if m:
            part = m.group(1)
            assert part not in blocks, ('таблица описана дважды', part)
            blocks[part] = {'about': [], 'fields': []}
            continue
        if line.startswith('## '):
            part = 'logic' if line.startswith('## 0.') else None
            continue
        if part == 'logic':
            logic.append(line)
            continue
        if part is None:
            continue
        b = blocks[part]
        if line.startswith('|'):
            if line.startswith('| Поле ') or re.match(r'^\|[-\s|:]+\|$', line.strip()):
                continue
            c = cells(line)
            assert len(c) == 5, ('поле: нужно 5 ячеек', part, line[:80])
            names = [n for t in re.findall(r'`([^`]+)`', c[1]) for n in expand(t)]
            assert names, ('поле без колонок', part, c[0])
            b['fields'].append({'name': c[0], 'cols': names, 'what': md(c[2]), 'why': md(c[3]),
                                'basis': md(c[4]), 'flag_mark': any('⚑' in x for x in c[2:]),
                                'text': ' '.join([c[0], ' '.join(names), plain(c[2]), plain(c[3]), plain(c[4])]).lower()})
        elif line.startswith('### '):
            continue
        elif line.strip() and line.strip() != '---':
            b['about'].append(line)
    return logic, blocks


def cover(table, schema, fields):
    """schema: [(колонка, ключ группы)]; каждая колонка — ровно в одном поле; поле — в одной группе."""
    where = {}
    for f in fields:
        for c in f['cols']:
            assert c not in where, (table, 'колонка в двух полях', c, where.get(c), f['name'])
            where[c] = f['name']
    known = dict(schema)
    extra = [c for c in where if c not in known]
    assert not extra, (table, 'колонок нет в схеме', extra)
    missing = [c for c, _ in schema if c not in where]
    assert not missing, (table, 'колонки без описания', missing)
    for f in fields:
        groups = {known[c] for c in f['cols']}
        assert len(groups) == 1, (table, 'поле в нескольких группах схемы', f['name'], groups)


def strip_mult(t):
    return re.sub(r'\s*×\d+$', '', t).strip()


def attach_objects(objects, blocks):
    missing = []
    for o in objects:
        b = blocks.pop(o['table'], None)
        if not b:
            o['described'] = False
            missing.append(o['table'])
            continue
        schema = [(c, gi) for gi, g in enumerate(o['groups']) for r in g['rows'] for c in r['colnames']]
        cover(o['table'], schema, b['fields'])
        row_of = {c: r for g in o['groups'] for r in g['rows'] for c in r['colnames']}
        gi_of = dict(schema)
        for g in o['groups']:
            g['fields'] = []
        flagged = {}  # id строки схемы с ⚑ → поля, получившие пометку
        for f in b['fields']:
            rows = []
            for c in f['cols']:
                if row_of[c] not in rows:
                    rows.append(row_of[c])
            types = []
            for r in rows:
                t = strip_mult(r['rawtype'])
                if t not in types:
                    types.append(t)
            srcs = []
            for r in rows:
                if r['source'] not in srcs:
                    srcs.append(r['source'])
            # ⚑ строки схемы переходит к полю, забравшему строку целиком; поле с частью
            # строки помечено, только если ⚑ стоит в его собственном тексте
            own = f.pop('flag_mark')
            assert not own or any(r['flag'] for r in rows), (o['table'], '⚑ у поля, а в схеме нет', f['name'])
            flag = any(r['flag'] and (own or set(r['colnames']) <= set(f['cols'])) for r in rows)
            for r in rows:
                if r['flag'] and flag:
                    flagged.setdefault(id(r), []).append(f['name'])
            f.update({'n': len(f['cols']), 'type': md(' · '.join(types)),
                      'source': ' · '.join(srcs), 'flag': flag,
                      'warn': any(r['warn'] for r in rows)})
            f['text'] += ' ' + ' '.join(plain(r['source']) for r in rows).lower()
            o['groups'][gi_of[f['cols'][0]]]['fields'].append(f)
        lost = [' '.join(r['cols']) for g in o['groups'] for r in g['rows'] if r['flag'] and id(r) not in flagged]
        assert not lost, (o['table'], '⚑ строки схемы не дошёл ни до одного поля — поставьте ⚑ в тексте поля', lost)
        o['described'] = True
        o['about'] = render_md(b['about'], {})
    return missing


def attach_services(services, blocks):
    missing = []
    for s in services:
        for t in s['tables']:
            names = [c['name'] for c in t['cols']]
            assert len(names) == len(set(names)), ('служебная таблица: колонка дважды', t['table'])
            t['total'] = len(names)
            b = blocks.pop(t['table'], None)
            if not b:
                t['described'] = False
                missing.append(t['table'])
                for c in t['cols']:
                    c['text'] = ' '.join([t['table'], c['name'], plain(c['type']), plain(c['meaning'])]).lower()
                continue
            cover(t['table'], [(n, 0) for n in names], b['fields'])
            col = {c['name']: c for c in t['cols']}
            for f in b['fields']:
                assert not f.pop('flag_mark'), (t['table'], '⚑ у служебной таблицы', f['name'])
                types = []
                for c in f['cols']:
                    if col[c]['type'] and col[c]['type'] not in types:
                        types.append(col[c]['type'])
                f.update({'n': len(f['cols']), 'type': ' · '.join(types)})
                f['text'] += ' ' + t['table']
            t['fields'] = b['fields']
            t['described'] = True
            t['about'] = render_md(b['about'], {})
    return missing


# ---------- сборка ----------

def tables_html(objects, summary):
    storage = {'state': 'состояние', 'event_delta': 'событие, приращения', 'event_full': 'событие, полное состояние'}
    rows = ''.join(
        f'<tr><td><a href="#{o["slug"]}" data-go="{o["slug"]}"><code>{o["table"]}</code></a></td><td>{html.escape(o["title"])}</td>'
        f'<td>{storage.get(summary[o["table"]]["storage"], summary[o["table"]]["storage"])}</td>'
        f'<td class="num">{o["total"]}</td></tr>' for o in objects)
    return ('<div class="mdt"><table><thead><tr><th>таблица</th><th>объект</th><th>способ хранения</th>'
            '<th class="num">колонок</th></tr></thead><tbody>' + rows + '</tbody></table></div>')


def legend_html(legend):
    return ('<div class="mdt"><table><thead><tr><th>Часть имени</th><th>Значение</th><th>Пример</th></tr></thead><tbody>'
            + ''.join(f'<tr><td>{l["part"]}</td><td>{l["meaning"]}</td><td>{l["example"]}</td></tr>' for l in legend)
            + '</tbody></table></div>')


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    src, dct, out = (Path(args[0]), Path(args[1]), Path(args[2])) if len(args) > 2 else (SRC, DICT, OUT)
    objects, legend, summary, total, services = parse_schema(join_bullets(src.read_text(encoding='utf-8').splitlines()))
    check_counts(objects, summary, total)
    assert len(services) == 7, ('подразделы §12', [s['n'] for s in services])
    logic_lines, blocks = parse_dict(dct.read_text(encoding='utf-8').splitlines())
    miss = attach_objects(objects, blocks) + attach_services(services, blocks)
    assert not blocks, ('в словаре описаны таблицы, которых нет в схеме', sorted(blocks))
    assert not miss, f'нет раздела в словаре: {", ".join(miss)}'
    toc = []
    logic = render_md(logic_lines, {'{{tables}}': tables_html(objects, summary), '{{legend}}': legend_html(legend)}, toc)
    for o in objects:
        for g in o['groups']:
            for r in g['rows']:
                r.pop('colnames')
                r.pop('rawtype')
    data = json.dumps({'objects': objects, 'services': services, 'logic': {'html': logic, 'toc': toc}},
                      ensure_ascii=False)
    tpl = TPL.read_text(encoding='utf-8')
    assert tpl.count('/*__DATA__*/null') == 1, 'метка данных в шаблоне'
    out.write_text(tpl.replace('/*__DATA__*/null', data), encoding='utf-8')
    svc_tables = sum(len(s['tables']) for s in services)
    svc_cols = sum(t['total'] for s in services for t in s['tables'])
    fields = sum(len(g.get('fields', [])) for o in objects for g in o['groups']) + \
        sum(len(t.get('fields', [])) for s in services for t in s['tables'])
    print(f'{out}: таблиц строк {len(objects)}, колонок {total}; служебных таблиц {svc_tables}, '
          f'колонок {svc_cols}; описано полей {fields}')


if __name__ == '__main__':
    main()
