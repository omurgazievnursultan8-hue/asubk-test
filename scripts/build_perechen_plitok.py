"""Собирает перечень плиток дашборда к финальному акту — приложение к ТЗ 24.

Источник один: docs/perechen-plitok/plitki.json. Руками правится только он, xlsx
пересобирается этим скриптом. Карточки перечня отчётов (docs/perechen-otchetov/perechen.json)
только читаются: плитка на отчёте перечня называет его колонку и разрез, а название отчёта берётся
из его строки.

    python3 scripts/build_perechen_plitok.py                         # пути по умолчанию
    python3 scripts/build_perechen_plitok.py <plitki.json> <папка вывода>

Что собирается (в папке вывода, по умолчанию docs/perechen-plitok/):
- «Перечень плиток.xlsx», листы:
  «Плитки» — шапка, три правила, строка обозначений; дальше роль → секция → плитки в порядке экрана,
  четыре колонки: №, Плитка, Что показывает, Откуда;
  «Отчёты плиток» — отчёты плиток к сдаче, колонки: №, Отчёт, Что считает, Плитки.

В файл не печатаются, но хранятся в JSON и сверяются с макетом: сдвиг, виды, параметры, точная колонка
отчёта. Плитки только каталога хранятся с пометкой catalogOnly: на экранах их нет, в файл они не идут.

Вычисляется, а не пишется в JSON: плитки у отчёта, итоги в шапке, число плиток у роли.

Проверки (не сошлось — ничего не пишется):
- номера ПЛ-NN и ОП-NN возрастают, не повторяются и не берут снятые (блок «retired»);
- итоги равны блоку «expect»: плиток на экранах, строк, отчётов плиток, плиток только каталога;
- у плитки заполнены все поля; у плитки на экране — фраза «Что показывает», у плитки без экрана —
  пометка catalogOnly; обзорная ссылается на ОП или на ФО, ссылочная — на очередь модуля;
  у каждого ОП есть фраза «Что считает» и плитка на экране;
- порог во фразе равен порогу плитки в макете: цвет, знак, граница («если есть» — больше нуля);
  у плитки без светофора цвета во фразе нет;
- плитка на ФО: колонка и второе число есть в карточке отчёта, разрез — среди доступных; чего в
  карточке нет, записано заявкой (имя в кавычках «»). У заготовки колонок ещё нет: число названо в её
  назначении или заявкой. Заявка на показатель или разрез, который уже есть в карточке, устарела;
- в тексте нет внутренних кодов (ADR-, ДБ-, ПЕР-…), номеров задач и запрещённых слов;
- сверка с макетом mockups/dashboard/dashboard.html (scripts/perechen_plitok_maket.mjs): те же
  плитки каталога с теми же названиями, видом, отчётом и очередью; отчёт макета для ФО — запись
  блока «fo» с тем же номером и названием; второе число есть там же;
  светофор — те же цвета, знаки и границы, зелёный и число, на котором горит; та же база
  сдвига; те же виды по умолчанию (по роду вида: Движение, Разрез, Ряд, Карта, Таблица); те же
  значения параметров; те же отчёты под плитками; раскладки ролей — те же роли, те же плитки в тех же
  секциях и в том же порядке.
  Не сверяются (тексты перечня): модуль, охват роли, слова фразы, главного и второго числа, разрез и
  колонки внутри вида, отбор плитки на ФО (свободный текст).
"""
import json
import math
import re
import subprocess
import sys
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'docs/perechen-plitok/plitki.json'
OUT_DIR = ROOT / 'docs/perechen-plitok'
OUT_NAME = 'Перечень плиток.xlsx'
MAKET = ROOT / 'scripts/perechen_plitok_maket.mjs'
FO_SRC = ROOT / 'docs/perechen-otchetov/perechen.json'
DRAFT = ' (заготовка)'

TILE_RE = re.compile(r'^ПЛ-\d{2}$')
REPORT_RE = re.compile(r'^ОП-\d{2}$')
KINDS = ('обзорная', 'ссылочная')
TILE_REQ = ('maket', 'name', 'module', 'kind', 'scope', 'params', 'main', 'second', 'shift', 'tl', 'views')
REPORT_REQ = ('maket', 'name', 'shows', 'object', 'filter')
QUOTED = re.compile(r'«([^»]+)»')
FORBID = re.compile(r'\b(?:ADR|ИО|ПВ|ОЧ|ОД|КВ|СС|РЯ|ДБ|ИМ|ГП|КН|ВБ|ПЗ|ПЛТ|ПЕР|ППЛ)-Д?\d|\b[PП]\d+-R\d')
FORBID_WORD = re.compile(r'должник|\bволн[аыеу]\b', re.I)
# база сдвига макета → слова перечня; у ссылочной плитки сдвига нет («—»)
SHIFTS = {'prevMonthEnd': 'за месяц', 'quarterStart': 'за квартал', 'halfStart': 'за полугодие',
          'yearStart': 'за год', 'yearAgo': 'за 12 месяцев', 'period': 'к прошлому периоду',
          'none': 'без сдвига'}
VIEWS = {'move': 'Движение', 'slice': 'Разрез', 'series': 'Ряд', 'map': 'Карта', 'table': 'Таблица'}
TL_COLORS = {'red': 'красный', 'yellow': 'жёлтый'}
# светофор на втором числе: «на втором: …», «на доле: …», у «Мои задания» — «просрочено > 0»
TL_ON_SECOND = re.compile(r'^на (?:втором|доле)\b|просрочено')
# порог во фразе: «Жёлтый больше 4 %», «красный меньше 80 %», «красный, если есть»
SHOWS_TL = re.compile(r'(жёлтый|красный)(?:, если есть| (больше|меньше) (\d+))', re.I)
SHOWS_COLOR = re.compile(r'жёлтый|красный|зелёный', re.I)
SIGNS = {'больше': '>', 'меньше': '<'}

COLS = [('№', 8), ('Плитка', 40), ('Что показывает', 72), ('Откуда', 46)]
REPORT_COLS = [('№', 8), ('Отчёт', 44), ('Что считает', 72), ('Плитки', 28)]
REPORTS_SHEET = 'Отчёты плиток'
REPORTS_HEAD = 4

BLUE = '006AF5'
HEAD_FILL = PatternFill('solid', fgColor=BLUE)
ROLE_FILL = PatternFill('solid', fgColor='DCE9FB')
SECTION_FILL = PatternFill('solid', fgColor='F1F4F8')
THIN = Side(style='thin', color='C9D3E0')
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
WRAP = Alignment(wrap_text=True, vertical='top')


def font(size=11, **kw):
    """Шрифт с именем: без него часть программ показывает жирное шрифтом с засечками."""
    return Font(name='Calibri', size=size, **kw)


def fail(errors):
    for e in errors:
        print('✗', e, file=sys.stderr)
    print(f'ошибок: {len(errors)} — файл не записан', file=sys.stderr)
    sys.exit(1)


def strings(x):
    if isinstance(x, str):
        yield x
    elif isinstance(x, dict):
        for v in x.values():
            yield from strings(v)
    elif isinstance(x, list):
        for v in x:
            yield from strings(v)


def plural(n, one, few, many):
    if n % 10 == 1 and n % 100 != 11:
        return f'{n} {one}'
    if 2 <= n % 10 <= 4 and not 12 <= n % 100 <= 14:
        return f'{n} {few}'
    return f'{n} {many}'


def check_numbers(items, rx, retired, errors):
    """Номера постоянные: убранный номер не используется повторно, порядок по возрастанию."""
    ids = [str(it.get('id')) for it in items]
    for x in ids:
        if not rx.match(x):
            errors.append(f'{x}: номер не по образцу')
        if x in retired:
            errors.append(f'{x}: номер снят и повторно не используется')
    if len(set(ids)) != len(ids):
        errors.append(f'номера повторяются: {sorted(x for x in set(ids) if ids.count(x) > 1)}')
    if ids != sorted(ids):
        errors.append('номера идут не по возрастанию')


def read_fo():
    """Карточки перечня отчётов, только чтение: название, колонки, разрезы, назначение."""
    d = json.loads(FO_SRC.read_text(encoding='utf-8'))
    fo = {}
    for r in d['rows']:
        if r.get('part') != 'отчёт' or not r.get('name') or r['id'] in fo:
            continue
        card = d['cards'].get(r['id']) or {}
        razrezy = card.get('razrezy') or {}
        fo[r['id']] = {
            'name': r['name'].replace(DRAFT, ''),
            'cols': {(c['group'] + ' — ' if c.get('group') else '') + c['name'] for c in card.get('columns') or []},
            'dims': set(razrezy.get('available') or []) | set(razrezy.get('default') or []),
            'purpose': card.get('purpose') or '',
        }
    return fo


def check_fo_source(t, fo, errors):
    """Что плитка берёт из ФО, есть в карточке или записано заявкой."""
    tid, s = t['id'], t['source']
    card = fo.get(s['fo'])
    if not card:
        errors.append(f'{tid}: отчёта {s["fo"]} нет в перечне отчётов')
        return
    if not (isinstance(s.get('col'), str) and s['col'] and isinstance(s.get('filter'), str)
            and isinstance(s.get('dims'), list)):
        errors.append(f'{tid}: у плитки на отчёте перечня — col, filter, dims')
        return
    requests = s.get('request') or []
    asked = {name for q in requests for name in QUOTED.findall(q)}
    cols = [s['col']] + [c.strip() for c in (s.get('col2') or '').split('÷') if c.strip()]
    for col in cols:
        known = col in card['cols'] if card['cols'] else col.lower() in card['purpose'].lower()
        if not known and col not in asked:
            errors.append(f'{tid}: колонки «{col}» нет в карточке {s["fo"]} и нет в заявке')
    for dim in s['dims']:
        if dim not in card['dims'] and dim not in asked:
            errors.append(f'{tid}: разреза «{dim}» нет в карточке {s["fo"]} и нет в заявке')
    for q in requests:
        have = card['cols'] if q.startswith('показатель') else card['dims'] if q.startswith('разрез') else set()
        if any(name in have for name in QUOTED.findall(q)):
            errors.append(f'{tid}: заявка «{q}» устарела — это уже есть в карточке {s["fo"]}')


def check_tiles(data, fo, errors):
    reports = {r['id'] for r in data['reports']}
    roles = {r['name'] for r in data['roles']}
    for t in data['tiles']:
        tid = t.get('id')
        for k in TILE_REQ:
            if not isinstance(t.get(k), str) or not t[k].strip():
                errors.append(f'{tid}: нет поля «{k}»')
        if t.get('kind') not in KINDS:
            errors.append(f'{tid}: вид «{t.get("kind")}» — обзорная или ссылочная')
        src = t.get('source') or {}
        if t.get('kind') == 'обзорная':
            if src.get('fo'):
                if src['fo'] not in data['fo']:
                    errors.append(f'{tid}: отчёта {src["fo"]} нет в блоке «fo»')
                check_fo_source(t, fo, errors)
            elif src.get('report') not in reports:
                errors.append(f'{tid}: обзорная плитка ссылается на отчёт плитки или на ФО, а не на {src}')
        if t.get('kind') == 'ссылочная' and not (src.get('queue') and src.get('module')):
            errors.append(f'{tid}: ссылочная плитка ссылается на очередь модуля (queue, module)')
        where = t.get('where')
        if not isinstance(where, list) or any(
                not (w.get('role') and w.get('section') and isinstance(w.get('n'), int)) for w in where):
            errors.append(f'{tid}: «где стоит» — список {{role, section, n}}')
            where = []
        for w in where:
            if w['role'] not in roles:
                errors.append(f'{tid}: роли «{w["role"]}» нет в блоке «roles»')
        if bool(where) == bool(t.get('catalogOnly')):
            errors.append(f'{tid}: плитка либо на экране, либо с пометкой catalogOnly')
        if where and not (isinstance(t.get('shows'), str) and t['shows'].strip()):
            errors.append(f'{tid}: пустая фраза «Что показывает»')


def check_reports(data, errors):
    used = {t['source'].get('report') for t in data['tiles'] if t.get('where')}
    for r in data['reports']:
        for k in REPORT_REQ:
            if not isinstance(r.get(k), str) or not r[k].strip():
                errors.append(f'{r.get("id")}: нет поля «{k}»')
        for k in ('cols', 'params'):
            if not isinstance(r.get(k), list) or not r[k]:
                errors.append(f'{r.get("id")}: «{k}» — непустой список')
        if not isinstance(r.get('dims'), list):
            errors.append(f'{r.get("id")}: «dims» — список')
        if r.get('id') not in used:
            errors.append(f'{r.get("id")}: на экранах ролей нет ни одной плитки на этом отчёте')


def check_totals(data, errors):
    screen = [t for t in data['tiles'] if t.get('where')]
    got = {'tiles': len(screen), 'rows': sum(len(t['where']) for t in screen),
           'reports': len(data['reports']), 'catalogOnly': len(data['tiles']) - len(screen)}
    for k, v in data['expect'].items():
        if got.get(k) != v:
            errors.append(f'итог «{k}»: {got.get(k)}, ожидалось {v}')
    for r in data['roles']:
        if not r.get('name') or not r.get('scope'):
            errors.append(f'роль {r}: нужны name и scope')
        if not any(w['role'] == r.get('name') for t in screen for w in t['where']):
            errors.append(f'у роли «{r.get("name")}» нет плиток')


def tl_diff(text, tl):
    """Расхождение текста светофора перечня с порогом макета; None — сошлось."""
    if not tl:
        return None if text == '—' else 'в макете светофора нет'
    if text == '—':
        return 'в макете светофор есть'
    have = {c: (s, n) for c, s, n in re.findall(r'(жёлтый|красный)[^,;]*?([<>])\s*(\d+)', text)}
    want = {TL_COLORS[c]: (tl[c][0], str(tl[c][1])) for c in TL_COLORS if tl.get(c)}
    if have != want:
        return f'пороги {have}, в макете {want}'
    if ('зелёный' in text) != bool(tl.get('green')):
        return 'зелёный ' + ('есть' if tl.get('green') else 'не показывается') + ' в макете'
    if bool(TL_ON_SECOND.search(text)) != (tl.get('on') == 'second'):
        return f'светофор в макете на {"втором" if tl.get("on") == "second" else "главном"} числе'
    return None


def shows_tl_diff(text, tl):
    """Расхождение порога во фразе «Что показывает» с порогом плитки в макете; None — сошлось."""
    if not tl:
        return 'во фразе цвет, в макете светофора нет' if SHOWS_COLOR.search(text) else None
    have = {m[0].lower(): (SIGNS[m[1]], m[2]) if m[1] else ('>', '0') for m in SHOWS_TL.findall(text)}
    want = {TL_COLORS[c]: (tl[c][0], str(tl[c][1])) for c in TL_COLORS if tl.get(c)}
    if have != want:
        return f'во фразе порог {have}, в макете {want}'
    if not want and not re.search('зелёный', text, re.I):
        return 'в макете зелёный, во фразе его нет'
    return None


def view_kinds(text):
    return [] if text == '—' else sorted(v.strip().split()[0] for v in text.split(';'))


def check_tile_maket(t, x, errors):
    tid = t['id']
    if (t['second'] != '—') != x['second']:
        errors.append(f'{tid}: второе число {"есть" if x["second"] else "нет"} в макете')
    why = tl_diff(t['tl'], x['tl'])
    if why:
        errors.append(f'{tid}: светофор «{t["tl"]}» — {why}')
    if t.get('where'):
        why = shows_tl_diff(t['shows'], x['tl'])
        if why:
            errors.append(f'{tid}: фраза «{t["shows"]}» — {why}')
    shift = SHIFTS.get(x['shift'], x['shift']) if x['shift'] else '—'
    if t['shift'] != shift:
        errors.append(f'{tid}: сдвиг «{t["shift"]}», в макете «{shift}»')
    want = sorted(VIEWS[k] for k in x['views'])
    if view_kinds(t['views']) != want:
        errors.append(f'{tid}: виды {view_kinds(t["views"])}, в макете {want}')
    params = x['params'] or '—'
    if t['params'] != params:
        errors.append(f'{tid}: параметры «{t["params"]}», в макете «{params}»')


def check_maket(data, fo, errors):
    try:
        run = subprocess.run(['node', str(MAKET)], capture_output=True, text=True)
    except OSError as e:
        errors.append(f'сверка с макетом не запустилась: {e}')
        return
    if run.returncode:
        errors.append(f'сверка с макетом не запустилась: {run.stderr.strip() or run.returncode}')
        return
    mk = json.loads(run.stdout)
    mt = {t['id']: t for t in mk['tiles']}
    rep = {r['id']: r['maket'] for r in data['reports']}
    ours = {t['maket']: t for t in data['tiles']}
    for m in sorted(set(mt) - set(ours)):
        errors.append(f'плитки каталога макета «{mt[m]["title"]}» ({m}) нет в перечне')
    for m in sorted(set(ours) - set(mt)):
        errors.append(f'{ours[m]["id"]}: в каталоге макета нет плитки {m}')
    for m, t in ours.items():
        x = mt.get(m)
        if not x:
            continue
        if t['name'] != x['title']:
            errors.append(f'{t["id"]}: название «{t["name"]}», в макете «{x["title"]}»')
        if (t['kind'] == 'ссылочная') != (x['kind'] == 'link'):
            errors.append(f'{t["id"]}: вид «{t["kind"]}», в макете {x["kind"]}')
        src = t.get('source') or {}
        if src.get('fo'):
            if x['report'] not in data['fo'].get(src['fo'], []):
                errors.append(f'{t["id"]}: отчёт {src["fo"]}, в макете {x["report"]}')
        elif x['report'] and rep.get(src.get('report')) != x['report']:
            errors.append(f'{t["id"]}: отчёт {src.get("report")}, в макете {x["report"]}')
        if x['queue'] and src.get('queue') != x['queue']:
            errors.append(f'{t["id"]}: очередь «{src.get("queue")}», в макете «{x["queue"]}»')
        check_tile_maket(t, x, errors)
    mr = {r['id']: r['title'] for r in mk['reports']}
    mc = {r['id']: r['cols'] for r in mk['reports']}
    fo_of = {m: f for f, ms in data['fo'].items() for m in ms}
    for r in mk['reports']:
        f = fo_of.get(r['id'])
        if (r['fo'] or None) != f:
            errors.append(f'отчёт макета {r["id"]}: номер {r["fo"]}, в блоке «fo» {f}')
        elif f and r['title'] != fo[f]['name']:
            errors.append(f'отчёт макета {r["id"]}: название «{r["title"]}», у {f} «{fo[f]["name"]}»')
    for m in sorted(set(fo_of) - set(mr)):
        errors.append(f'{fo_of[m]}: под плитками каталога макета нет отчёта {m}')
    for r in data['reports']:
        if r['maket'] not in mr:
            errors.append(f'{r["id"]}: в макете под плитками каталога нет отчёта {r["maket"]}')
        elif r['name'] != mr[r['maket']]:
            errors.append(f'{r["id"]}: название «{r["name"]}», в макете «{mr[r["maket"]]}»')
        elif r['cols'] != mc[r['maket']]:
            errors.append(f'{r["id"]}: показатели {r["cols"]}, в макете {mc[r["maket"]]}')
    for m in sorted(set(mr) - set(rep.values()) - set(fo_of)):
        errors.append(f'отчёта макета «{mr[m]}» ({m}) нет в перечне')
    roles = [r['name'] for r in data['roles']]
    if roles != [lay['role'] for lay in mk['layouts']]:
        errors.append(f'роли {roles}, в макете {[lay["role"] for lay in mk["layouts"]]}')
    placed = {}
    for t in data['tiles']:
        for w in t['where']:
            placed.setdefault(w['role'], []).append((w['n'], w['section'], t['maket']))
    for lay in mk['layouts']:
        want = [(i, x['section'], x['tile']) for i, x in enumerate(lay['items'], 1)]
        have = sorted(placed.pop(lay['role'], []))
        if have != want:
            diff = next((f'место {a[0]}: в перечне {a[1:]}, в макете {b[1:]}'
                         for a, b in zip(have, want) if a != b),
                        f'плиток в перечне {len(have)}, в макете {len(want)}')
            errors.append(f'раскладка «{lay["role"]}» расходится с макетом — {diff}')
    for role in placed:
        errors.append(f'роли «{role}» нет среди объявленных раскладок макета')


def check(data, fo):
    errors = []
    for k in ('title', 'date', 'expect', 'rules', 'legend', 'roles', 'retired', 'fo', 'tiles', 'reports'):
        if not data.get(k):
            errors.append(f'нет «{k}»')
    if errors:
        fail(errors)
    check_numbers(data['tiles'], TILE_RE, data['retired']['tiles'], errors)
    check_numbers(data['reports'], REPORT_RE, data['retired']['reports'], errors)
    check_tiles(data, fo, errors)
    check_reports(data, errors)
    if not errors:
        check_totals(data, errors)
    for s in strings(data):
        m = FORBID.search(s) or FORBID_WORD.search(s)
        if m:
            errors.append(f'запрещено «{m.group(0)}» в «{s[:60]}…»')
    if errors:
        fail(errors)
    check_maket(data, fo, errors)
    if errors:
        fail(errors)


# --- xlsx --------------------------------------------------------------------------------

def set_widths(ws, cols):
    for i, (_, w) in enumerate(cols, 1):
        ws.column_dimensions[get_column_letter(i)].width = w


def lines_of(text, width):
    """Сколько строк займёт текст в колонке этой ширины; с запасом: шрифт у читателя может оказаться шире."""
    return sum(max(1, math.ceil(len(p) / (width * 0.92))) for p in str(text).split('\n'))


def text_row(ws, row, text, cols, fnt=None, fill=None):
    """Строка на всю ширину таблицы; высота — по числу строк текста (объединённая ячейка сама не растёт)."""
    ncols, width = len(cols), sum(w for _, w in cols)
    ws.cell(row=row, column=1, value=text)
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=ncols)
    c = ws.cell(row=row, column=1)
    c.alignment = WRAP
    c.font = fnt or font()
    if fill:
        for i in range(1, ncols + 1):
            ws.cell(row=row, column=i).fill = fill
    size = fnt.size if fnt else 11
    ws.row_dimensions[row].height = round(lines_of(text, width * 11 / size) * size * 1.4 + 3)


def header(ws, row, cols):
    for i, (title, _) in enumerate(cols, 1):
        c = ws.cell(row=row, column=i, value=title)
        c.font = font(bold=True, color='FFFFFF')
        c.fill = HEAD_FILL
        c.alignment = Alignment(wrap_text=True, vertical='center')
        c.border = BORDER
    ws.row_dimensions[row].height = 22


def table_row(ws, r, vals, cols):
    for i, v in enumerate(vals, 1):
        c = ws.cell(row=r, column=i, value=v)
        c.alignment = WRAP
        c.border = BORDER
        c.font = font()
    ws.cell(row=r, column=1).font = font(bold=True)
    ws.row_dimensions[r].height = max(lines_of(v, w) for v, (_, w) in zip(vals, cols)) * 15 + 3


def page_setup(ws, head):
    ws.print_title_rows = f'{head}:{head}'
    ws.page_setup.orientation = 'landscape'
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_margins.left = ws.page_margins.right = 0.4
    ws.page_margins.top = ws.page_margins.bottom = 0.5
    ws.oddFooter.center.text = 'Страница &P из &N'
    ws.freeze_panes = ws.cell(row=head + 1, column=1)


def source_text(t, names, fo):
    s = t['source']
    if 'fo' in s:
        return f'{s["fo"]} {fo[s["fo"]]["name"]}'
    if 'report' in s:
        return f'{s["report"]} {names[s["report"]]}'
    return f'Очередь {s["queue"]}'


def sheet_tiles(wb, data, fo):
    ws = wb.active
    ws.title = 'Плитки'
    set_widths(ws, COLS)
    names = {r['id']: r['name'] for r in data['reports']}
    report_row = {r['id']: REPORTS_HEAD + i for i, r in enumerate(data['reports'], 1)}
    screen = [t for t in data['tiles'] if t['where']]
    rows = sum(len(t['where']) for t in screen)
    r = 1
    text_row(ws, r, data['title'], COLS, font(14, bold=True))
    r += 1
    text_row(ws, r, f'{plural(len(screen), "плитка", "плитки", "плиток")} на экранах '
                    f'{plural(len(data["roles"]), "роли", "ролей", "ролей")}, '
                    f'{plural(rows, "строка", "строки", "строк")}. Ещё '
                    f'{plural(len(data["reports"]), "отчёт", "отчёта", "отчётов")} плиток на втором листе. '
                    f'Редакция {data["date"]}.', COLS, font(color='555555'))
    r += 2
    for i, rule in enumerate(data['rules'], 1):
        text_row(ws, r, f'{i}. {rule}', COLS)
        r += 1
    r += 1
    text_row(ws, r, data['legend'], COLS, font(10, color='555555'))
    r += 2
    head = r
    header(ws, head, COLS)
    for role in data['roles']:
        items = sorted(((w['n'], w['section'], t) for t in screen for w in t['where'] if w['role'] == role['name']),
                       key=lambda x: x[0])
        r += 1
        text_row(ws, r, f'{role["name"]} · {plural(len(items), "плитка", "плитки", "плиток")} · {role["scope"]}',
                 COLS, font(12, bold=True), ROLE_FILL)
        section = None
        for _, sec, t in items:
            if sec != section:
                section = sec
                r += 1
                text_row(ws, r, sec, COLS, font(bold=True), SECTION_FILL)
            r += 1
            table_row(ws, r, [t['id'], t['name'], t['shows'], source_text(t, names, fo)], COLS)
            rep = t['source'].get('report')
            if rep:
                c = ws.cell(row=r, column=4)
                c.hyperlink = f"#'{REPORTS_SHEET}'!A{report_row[rep]}"
                c.font = font(color=BLUE, underline='single')
    page_setup(ws, head)


def sheet_reports(wb, data):
    ws = wb.create_sheet(REPORTS_SHEET)
    set_widths(ws, REPORT_COLS)
    on = {}
    for t in data['tiles']:
        rep = t['source'].get('report')
        if rep and t['where']:
            on.setdefault(rep, []).append(t['id'])
    text_row(ws, 1, REPORTS_SHEET, REPORT_COLS, font(14, bold=True))
    text_row(ws, 2, f'{plural(len(data["reports"]), "отчёт", "отчёта", "отчётов")}, которых нет в перечне отчётов, '
                    f'но сдать их надо.', REPORT_COLS, font(color='555555'))
    r = REPORTS_HEAD
    header(ws, r, REPORT_COLS)
    for rep in data['reports']:
        r += 1
        table_row(ws, r, [rep['id'], rep['name'], rep['shows'], ', '.join(on[rep['id']])], REPORT_COLS)
    page_setup(ws, REPORTS_HEAD)


def main():
    args = sys.argv[1:]
    src = Path(args[0]) if args else SRC
    out = Path(args[1]) if len(args) > 1 else OUT_DIR
    data = json.loads(src.read_text(encoding='utf-8'))
    fo = read_fo()
    check(data, fo)
    wb = Workbook()
    sheet_tiles(wb, data, fo)
    sheet_reports(wb, data)
    out.mkdir(parents=True, exist_ok=True)
    path = out / OUT_NAME
    wb.save(path)
    screen = [t for t in data['tiles'] if t['where']]
    print(f'{path.relative_to(ROOT) if path.is_relative_to(ROOT) else path}: '
          f'плиток {len(screen)}, строк {sum(len(t["where"]) for t in screen)}, '
          f'отчётов плиток {len(data["reports"])}, только в каталоге {len(data["tiles"]) - len(screen)} '
          f'(в файл не идут); сверка с макетом и карточками — сошлось')


if __name__ == '__main__':
    main()
