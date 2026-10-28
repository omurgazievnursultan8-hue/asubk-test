"""Собирает «Перечень.xlsx» — перечень отчётов и бланков кредитного модуля к финальному акту.

Источник один: docs/perechen-otchetov/perechen.json. Руками правится только он, xlsx
пересобирается этим скриптом.

    python3 scripts/build_perechen.py                    # пути по умолчанию
    python3 scripts/build_perechen.py <perechen.json> <out.xlsx>

Листы:
- «Перечень» — правила, обозначения и строки: отчёты, бланки, общие требования. Вид формы —
  отдельная строка с номером своей формы;
- «Вне перечня» — что в перечень не входит и где оно учтено.

Вычисляется, а не пишется в JSON:
- язык: отчёт — язык интерфейса; бланк с "ext": true (получатель вне ОАО) — русский и
  кыргызский, без него — русский;
- ⚠ «кыргызский текст» у каждой внешней строки бланка (тексты даёт заказчик).

Проверки (не сошлось — файл не пишется):
- номер вида ФО-NN или ОТ-N; снятые номера (ФО-21, ФО-22, ФО-23) не встречаются;
- у формы одна главная строка; вид идёт после главной строки своей формы и не повторяется;
- часть — отчёт, бланк или требование; "ext" только у бланков;
- у каждой строки есть название (или вид), модуль, получатель, основание, образец.
"""
import json
import re
import sys
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'docs/perechen-otchetov/perechen.json'
OUT = ROOT / 'docs/perechen-otchetov/Перечень.xlsx'

RETIRED = {'ФО-21', 'ФО-22', 'ФО-23'}
PARTS = {'отчёт': 'Отчёт', 'бланк': 'Бланк', 'требование': 'Требование'}
ID_RE = re.compile(r'^(ФО-\d{2}|ОТ-\d+)$')
REQUIRED = ('module', 'to', 'basis', 'sample')

# Колонки листа «Перечень»: заголовок, ширина.
COLS = [
    ('№', 5), ('Номер', 8), ('Название', 50), ('Часть', 11), ('Модуль', 18),
    ('Получатель', 24), ('Язык', 16), ('Основание', 58), ('Образец-основа', 40),
    ('⚠ Нужно от заказчика', 28), ('Примечание', 44),
]
OUT_COLS = [('№', 5), ('Что', 90), ('Где учтено', 46), ('Основание', 52)]

BLUE = '006AF5'
HEAD_FILL = PatternFill('solid', fgColor=BLUE)
VID_FILL = PatternFill('solid', fgColor='F2F6FC')
WARN_FILL = PatternFill('solid', fgColor='FFF4D6')
THIN = Side(style='thin', color='C9D3E0')
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
WRAP = Alignment(wrap_text=True, vertical='top')


def fail(errors):
    for e in errors:
        print('ошибка:', e, file=sys.stderr)
    sys.exit(1)


def check(data):
    errors = []
    mains, vids = set(), set()
    for i, r in enumerate(data['rows'], 1):
        rid = r.get('id', '')
        where = f'строка {i} ({rid}{", вид «" + r["vid"] + "»" if r.get("vid") else ""})'
        if not ID_RE.match(rid):
            errors.append(f'{where}: номер не ФО-NN / ОТ-N')
        if rid in RETIRED:
            errors.append(f'{where}: номер снят и не переиспользуется')
        if 'vid' in r:
            if rid not in mains:
                errors.append(f'{where}: вид раньше главной строки формы')
            if (rid, r['vid']) in vids:
                errors.append(f'{where}: вид повторяется')
            vids.add((rid, r['vid']))
            if 'part' in r or 'name' in r:
                errors.append(f'{where}: у вида нет своих "part" и "name" — они от формы')
        else:
            if rid in mains:
                errors.append(f'{where}: вторая главная строка формы')
            mains.add(rid)
            if r.get('part') not in PARTS:
                errors.append(f'{where}: часть не из {sorted(PARTS)}')
            if not r.get('name'):
                errors.append(f'{where}: нет названия')
        for k in REQUIRED:
            if not r.get(k):
                errors.append(f'{where}: нет поля "{k}"')
    part = {r['id']: r.get('part') for r in data['rows'] if 'vid' not in r}
    for i, r in enumerate(data['rows'], 1):
        if r.get('ext') and part.get(r['id']) != 'бланк':
            errors.append(f'строка {i} ({r["id"]}): "ext" бывает только у бланка')
    for i, o in enumerate(data.get('outside', []), 1):
        for k in ('what', 'where', 'basis'):
            if not o.get(k):
                errors.append(f'«Вне перечня» {i}: нет поля "{k}"')
    if errors:
        fail(errors)


def expand(data):
    """Строки в порядке листа: часть → номер; вид сразу за своей формой."""
    order = list(PARTS)
    forms = {}
    for r in data['rows']:
        forms.setdefault(r['id'], []).append(r)
    num = lambda rid: int(rid.split('-')[1])
    ids = sorted(forms, key=lambda rid: (order.index(forms[rid][0]['part']), num(rid)))
    out = []
    for rid in ids:
        main = forms[rid][0]
        for r in forms[rid]:
            vid = r.get('vid')
            p = main['part']
            if p == 'отчёт':
                lang = 'язык интерфейса'
            elif p == 'бланк':
                lang = 'рус, кырг' if r.get('ext') else 'рус'
            else:
                lang = '—'
            warn = [r['warn']] if r.get('warn') else []
            if p == 'бланк' and r.get('ext'):
                warn.append('Кыргызский текст')
            out.append(dict(
                id=rid, vid=vid, part=p,
                name=f'вид «{vid}»' if vid else r['name'],
                module=r['module'], to=r['to'], lang=lang, basis=r['basis'],
                sample=r['sample'], warn='; '.join(warn), note=r.get('note', ''),
            ))
    return out


def counts(rows):
    c = {}
    for r in rows:
        key = (r['part'], bool(r['vid']))
        c[key] = c.get(key, 0) + 1
    stub = sum(1 for r in rows if not r['vid'] and r['name'].endswith('(заготовка)'))
    return dict(
        reports=c.get(('отчёт', False), 0), report_vids=c.get(('отчёт', True), 0), stub=stub,
        blanks=c.get(('бланк', False), 0), blank_vids=c.get(('бланк', True), 0),
        reqs=c.get(('требование', False), 0),
        warn=sum(1 for r in rows if r['warn']),
        kg=sum(1 for r in rows if 'Кыргызский текст' in r['warn']),
    )


def set_widths(ws, cols):
    for i, (_, w) in enumerate(cols, 1):
        ws.column_dimensions[get_column_letter(i)].width = w


def text_row(ws, row, text, ncols, font=None, height=None):
    ws.cell(row=row, column=1, value=text)
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=ncols)
    c = ws.cell(row=row, column=1)
    c.alignment = WRAP
    if font:
        c.font = font
    if height:
        ws.row_dimensions[row].height = height


def header(ws, row, cols):
    for i, (title, _) in enumerate(cols, 1):
        c = ws.cell(row=row, column=i, value=title)
        c.font = Font(bold=True, color='FFFFFF')
        c.fill = HEAD_FILL
        c.alignment = Alignment(wrap_text=True, vertical='center')
        c.border = BORDER
    ws.row_dimensions[row].height = 30


def sheet_list(wb, data, rows, n):
    ws = wb.active
    ws.title = 'Перечень'
    nc = len(COLS)
    set_widths(ws, COLS)
    r = 1
    text_row(ws, r, data['title'], nc, Font(bold=True, size=14), 22)
    r += 1
    text_row(ws, r, f'{data["date"]}. {data["stage"]}', nc, Font(italic=True, color='555555'))
    r += 1
    total = (f'Отчётов: {n["reports"]} (из них заготовок внешних форм: {n["stub"]}), видов отчётов: '
             f'{n["report_vids"]}. Бланков: {n["blanks"]}, видов бланков: {n["blank_vids"]}. '
             f'Общих требований: {n["reqs"]}. Строк с ⚠: {n["warn"]} (кыргызский текст: {n["kg"]}).')
    text_row(ws, r, total, nc, Font(bold=True))
    r += 2
    for rule in data['rules']:
        text_row(ws, r, rule, nc, height=30)
        r += 1
    r += 1
    text_row(ws, r, 'Обозначения: ' + '; '.join(data['legend']) + '.', nc,
             Font(color='555555', size=9), 42)
    r += 2
    header(ws, r, COLS)
    head = r
    for k, row in enumerate(rows, 1):
        r += 1
        vals = [k, row['id'], row['name'], PARTS[row['part']], row['module'], row['to'],
                row['lang'], row['basis'], row['sample'], row['warn'], row['note']]
        for i, v in enumerate(vals, 1):
            c = ws.cell(row=r, column=i, value=v)
            c.alignment = WRAP
            c.border = BORDER
            if row['vid']:
                c.fill = VID_FILL
        if row['vid']:
            ws.cell(row=r, column=3).alignment = Alignment(wrap_text=True, vertical='top', indent=2)
            ws.cell(row=r, column=3).font = Font(italic=True)
        else:
            ws.cell(row=r, column=2).font = Font(bold=True)
        if row['warn']:
            ws.cell(row=r, column=10).fill = WARN_FILL
    ws.freeze_panes = ws.cell(row=head + 1, column=4)
    ws.auto_filter.ref = f'A{head}:{get_column_letter(nc)}{r}'
    ws.print_title_rows = f'{head}:{head}'
    ws.page_setup.orientation = 'landscape'
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True


def sheet_outside(wb, data):
    ws = wb.create_sheet('Вне перечня')
    set_widths(ws, OUT_COLS)
    text_row(ws, 1, 'Не входит в перечень — и где учтено', len(OUT_COLS), Font(bold=True, size=14), 22)
    header(ws, 3, OUT_COLS)
    for k, o in enumerate(data['outside'], 1):
        for i, v in enumerate([k, o['what'], o['where'], o['basis']], 1):
            c = ws.cell(row=3 + k, column=i, value=v)
            c.alignment = WRAP
            c.border = BORDER
    ws.freeze_panes = 'A4'
    ws.page_setup.orientation = 'landscape'
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True


def main():
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else SRC
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else OUT
    data = json.loads(src.read_text(encoding='utf-8'))
    check(data)
    rows = expand(data)
    n = counts(rows)
    wb = Workbook()
    sheet_list(wb, data, rows, n)
    sheet_outside(wb, data)
    wb.save(out)
    print(f'{out.relative_to(ROOT) if out.is_relative_to(ROOT) else out}: {len(rows)} строк — '
          f'отчётов {n["reports"]} (заготовок {n["stub"]}) + видов {n["report_vids"]}, '
          f'бланков {n["blanks"]} + видов {n["blank_vids"]}, требований {n["reqs"]}; '
          f'⚠ {n["warn"]} (кыргызский текст {n["kg"]}); вне перечня {len(data["outside"])}')


if __name__ == '__main__':
    main()
