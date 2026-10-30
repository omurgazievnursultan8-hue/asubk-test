"""Собирает перечень отчётов и бланков кредитного модуля к финальному акту.

Источник один: docs/perechen-otchetov/perechen.json. Руками правится только он, всё остальное
пересобирается этим скриптом.

    python3 scripts/build_perechen.py                      # пути по умолчанию
    python3 scripts/build_perechen.py --no-samples         # только Перечень.xlsx
    python3 scripts/build_perechen.py --reports            # только Перечень-отчётов.xlsx
    python3 scripts/build_perechen.py --only=ФО-01,ФО-02   # Перечень.xlsx и образцы только этих отчётов
    python3 scripts/build_perechen.py <perechen.json> <папка вывода>

Что собирается (в папке вывода, по умолчанию docs/perechen-otchetov/):
- Перечень.xlsx, листы:
  «Перечень» — правила, обозначения и строки: отчёты, бланки, общие требования. Вид формы —
  отдельная строка с номером своей формы;
  «Приёмка» — правила проверки каждой строки и заёмщики контрольного набора, на которых она
  проверяется; графы результата заполняются на приёмке;
  «Контрольный набор» — заёмщики набора: подразделение, куратор, кредиты с остатком на дату
  состояния, случай и формы, которые на нём проверяются; по этому листу набор заводится на стенде;
  «Вне перечня» — что в перечень не входит и где оно учтено;
- obrazcy/ФО-NN.xlsx на отчёт: лист «Образец», по листу на каждый вид, лист «Описание»
  (карточка). Образцы только у отчётов: у бланков, заготовок и требований файла нет.
  Файлы ФО-NN.* в obrazcy/, не принадлежащие отчёту перечня, удаляются (кроме сборки с --only).
  Карточка с "style": "стандарт" собирается по стандарту оформления: лист «ФО-NN» (шапка формы,
  таблица с номерами граф, строки групп с итогом над их кредитами, ширина по типу колонки "type",
  печать в одну страницу по ширине, колонтитул) и лист «Параметры» из "sheet_params".
- с --reports вместо всего этого — Перечень-отчётов.xlsx: один лист, только отчёты и их виды
  (без бланков, требований, приёмки и контрольного набора); обозначения — только те, что
  встречаются в строках.

Вычисляется, а не пишется в JSON:
- язык: отчёт — язык интерфейса; бланк с "ext": true (получатель вне ОАО) — русский и
  кыргызский, без него — русский;
- ⚠ «кыргызский текст» у каждой внешней строки бланка (тексты даёт заказчик);
- карточка вида = карточка формы, поверх которой лежат поля вида.

Проверки (не сошлось — ничего не пишется):
- номер вида ФО-NN или ОТ-N; снятые номера (ФО-21, ФО-22, ФО-23) не встречаются;
- у формы одна главная строка; вид идёт после главной строки своей формы и не повторяется;
- часть — отчёт, бланк или требование; "ext" только у бланков;
- у каждой строки есть название (или вид), модуль, получатель, основание, образец;
- у каждой строки есть карточка с обязательными для её части полями, у каждой карточки — строка;
  в образце отчёта у каждой строки столько ячеек, сколько колонок;
- в тексте карточек нет внутренних кодов (ADR-, ИО-, ПВ-…, пунктов ТЗ 20 гл. 13);
- у заёмщика набора есть подразделение, куратор и кредиты (договор, дата, валюта, сумма, остаток),
  номер договора не повторяется у другого заёмщика;
- ссылки контрольного набора на формы однозначны (вид — по началу названия), и каждая строка
  перечня проверяется хотя бы на одном заёмщике, на всём наборе или названа в "none".

Предупреждения (файлы пишутся): подытог в образце отчёта не равен сумме строк под ним;
вопросы владельцу ("open") в карточках.
"""
import json
import re
import sys
from datetime import datetime
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'docs/perechen-otchetov/perechen.json'
OUT_DIR = ROOT / 'docs/perechen-otchetov'
SAMPLES = 'obrazcy'

RETIRED = {'ФО-03', 'ФО-12', 'ФО-13', 'ФО-21', 'ФО-22', 'ФО-23'}
PARTS = {'отчёт': 'Отчёт', 'бланк': 'Бланк', 'требование': 'Требование'}
ID_RE = re.compile(r'^(ФО-\d{2}|ОТ-\d+)$')
SAMPLE_RE = re.compile(r'^(ФО|ОТ)-\d+\.(xlsx|docx)$')
REQUIRED = ('module', 'to', 'basis', 'sample')
CARD_REQ = {
    'отчёт': ('purpose', 'when', 'params', 'layout', 'columns', 'checks', 'sample'),
    'заготовка': ('purpose', 'when', 'checks'),
    'бланк': ('purpose', 'when', 'recipient_rule', 'text_source', 'fields', 'regnum', 'format',
              'checks', 'sample'),
    'требование': ('purpose', 'checks'),
    'вид': ('checks', 'sample'),
}
FORBID = re.compile(r'\b(?:ADR|ИО|ПВ|ОЧ|КВ|СС|РЯ|ДБ|ИМ|ГП|КН|ВБ|ПЗ)-\d|\bН-\d|\b[PП]\d+-R\d'
                    r'|ТЗ 20,? п\. ?13\.')
# «Заёмщиков» не складывается: заёмщик с кредитами в двух валютах считается в каждой, в ИТОГО — один раз (ФО-07)
NOT_ADDITIVE = re.compile(r'%|ставк|курс|\bдн|дней|\bдат|срок|№|номер|групп|заёмщиков', re.I)

# Колонки листа «Перечень»: заголовок, ширина.
COLS = [
    ('№', 5), ('Номер', 8), ('Название', 50), ('Часть', 11), ('Модуль', 18),
    ('Получатель', 24), ('Язык', 16), ('Основание', 58), ('Образец-основа', 40),
    ('Файл образца', 18), ('⚠ Нужно от заказчика', 28), ('Примечание', 44),
]
# Колонки «Перечня отчётов»: часть и язык у всех строк одни, файла образца нет.
REPORT_COLS = [
    ('№', 5), ('Номер', 8), ('Название', 50), ('Модуль', 18), ('Получатель', 24),
    ('Основание', 58), ('Образец-основа', 40), ('⚠ Нужно от заказчика', 28), ('Примечание', 44),
]
REPORTS_TITLE = 'Перечень отчётов кредитного модуля АСУБК'
REPORTS_FILE = 'Перечень-отчётов.xlsx'
ACC_COLS = [
    ('№', 5), ('Номер', 8), ('Название', 44), ('Правила проверки', 80), ('Контрольный набор', 26),
    ('Результат', 14), ('Дата', 11), ('Сдал (разработчик)', 18), ('Принял (заказчик)', 18),
    ('Замечание', 36),
]
SET_COLS = [('Код', 8), ('Заёмщик', 26), ('Район', 26), ('Подразделение', 24), ('Куратор', 16),
            ('Кредитный договор', 22), ('Валюта', 8), ('Сумма по договору', 15),
            ('Остаток основного долга на 01.10.2026', 16), ('Группа', 8), ('О кредите', 40),
            ('Случай', 50), ('Формы', 44)]
LOAN_REQ = ('no', 'date', 'cur', 'amount', 'rest')
OUT_COLS = [('№', 5), ('Что', 90), ('Где учтено', 46), ('Основание', 52)]
RESULTS = '"сдано,сдано с замечанием,не сдано"'

BLUE = '006AF5'
HEAD_FILL = PatternFill('solid', fgColor=BLUE)
SAMPLE_HEAD_FILL = PatternFill('solid', fgColor='DCE6F2')
VID_FILL = PatternFill('solid', fgColor='F2F6FC')
WARN_FILL = PatternFill('solid', fgColor='FFF4D6')
THIN = Side(style='thin', color='C9D3E0')
BLACK = Side(style='thin', color='808080')
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
SAMPLE_BORDER = Border(left=BLACK, right=BLACK, top=BLACK, bottom=BLACK)
WRAP = Alignment(wrap_text=True, vertical='top')
CENTER = Alignment(wrap_text=True, horizontal='center', vertical='center')

# Стандарт оформления отчёта — у карточек с "style": "стандарт".
ORG = 'ОАО «Государственный финансовый холдинг»'
STD_FONT = 'Arial'
STD_HEAD_FILL = PatternFill('solid', fgColor='C0C0C0')
# заливка строки разреза — по смыслу разреза: оргструктура синяя, география зелёная, классификаторы
# сиреневые; ИТОГО тёмный с белым шрифтом; заёмщик и строки кредитов без заливки (заёмщик — жирным)
ITOGO_FILL, ITOGO_FONT = '44546A', 'FFFFFF'
RAZREZ_FILLS = {
    'Блок': '6FA8DC', 'Департамент': '9BC2E6', 'Отдел': 'DDEBF7', 'Куратор': 'EAF2FA',
    'Область': 'A9D08E', 'Район': 'E2EFDA',
    'Категория риска': 'E4DFEC', 'Группа платёжеспособности': 'E4DFEC', 'Тип проекта': 'E4DFEC',
    'Валюта': 'E4DFEC', 'Состояние': 'E4DFEC', 'Стадия': 'E4DFEC', 'Исход': 'E4DFEC',
    'Взыскание': 'E4DFEC', 'Вид залога': 'E4DFEC', 'Статус залога': 'E4DFEC', 'Запрет на отчуждение': 'E4DFEC',
    'Обеспеченность': 'E4DFEC', 'Состояние освоения': 'E4DFEC',
    'Исход обследования': 'E4DFEC', 'Состояние контроля': 'E4DFEC',
    'Вид снятия': 'E4DFEC', 'Основание снятия': 'E4DFEC',
    'Ведущее подразделение': '9BC2E6', 'Процедура взыскания': 'E4DFEC', 'Фаза': 'E4DFEC', 'Раздел меры': 'E4DFEC',
    'Вид меры': 'E4DFEC', 'Состояние листа': 'E4DFEC', 'Предмет взыскания': 'E4DFEC', 'Канал': 'E4DFEC',
    'Раздел досье': 'E4DFEC', 'Вид документа': 'E4DFEC', 'Состояние документа': 'E4DFEC',
    'Тип документа': 'E4DFEC', 'Этап документа': 'E4DFEC', 'Вид отправителя': 'E4DFEC', 'Месяц регистрации': 'E4DFEC',
    'Из старой системы': 'E4DFEC', 'Подразделение автора': '9BC2E6', 'Исполнитель': 'EAF2FA',
    'Подразделение исполнителя': '9BC2E6', 'Источник задания': 'E4DFEC', 'Вид повода': 'E4DFEC',
    'Вид назначения': 'E4DFEC', 'Важность': 'E4DFEC', 'Состояние задания': 'E4DFEC', 'Месяц выдачи': 'E4DFEC',
    'Группа на начало': 'E4DFEC', 'Группа на конец': 'E4DFEC', 'Вид лица': 'E4DFEC',
}
# ячейка, значение которой отличается от первичного (ФО-09: условие изменено после выдачи)
MARK_FILL = PatternFill('solid', fgColor='FFF2CC')
# тип колонки: ширина, формат числа, выравнивание, перенос
COL_TYPES = {
    'name': (40, None, 'left', True),
    'money': (13, '#,##0.00', 'right', False),
    'count': (6, '#,##0', 'right', False),
    'days': (8, '#,##0', 'right', False),
    'code': (7, None, 'left', False),
    'rate': (7, '0.00', 'right', False),
    'pct': (8, '0.0', 'right', False),
    'fx': (10, '0.00000', 'right', False),
    'date': (11, 'DD.MM.YYYY', 'center', False),
    'class': (14, None, 'left', True),
    'text': (28, None, 'left', True),
    'note': (30, None, 'left', True),
}
DATE_RE = re.compile(r'^(\d\d)\.(\d\d)\.(\d{4})$')
PRINT_MM = {'A4': 277, 'A3': 400}  # ширина альбомного листа минус поля по 1 см


def fail(errors):
    for e in errors:
        print('ошибка:', e, file=sys.stderr)
    sys.exit(1)


def key(r):
    return r['id'] + ('|' + r['vid'] if r.get('vid') else '')


def is_stub(r):
    return r.get('name', '').endswith('(заготовка)')


def strings(x):
    if isinstance(x, str):
        yield x
    elif isinstance(x, dict):
        for v in x.values():
            yield from strings(v)
    elif isinstance(x, list):
        for v in x:
            yield from strings(v)


def check_rows(data, errors):
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


def check_cards(data, errors):
    cards = data.get('cards', {})
    main = {r['id']: r for r in data['rows'] if 'vid' not in r}
    keys = {key(r): r for r in data['rows']}
    for k in cards:
        if k not in keys:
            errors.append(f'карточка {k}: нет такой строки')
    for k, r in keys.items():
        c = cards.get(k)
        if c is None:
            errors.append(f'{k}: нет карточки')
            continue
        m = main[r['id']]
        kind = 'вид' if r.get('vid') else ('заготовка' if is_stub(m) else m['part'])
        for f in CARD_REQ[kind]:
            if not c.get(f):
                errors.append(f'{k}: в карточке нет "{f}"')
        bad = sorted({mt.group(0) for s in strings(c) for mt in [FORBID.search(s)] if mt})
        if bad:
            errors.append(f'{k}: внутренние коды в тексте карточки: {", ".join(bad)}')
        s = c.get('sample')
        if not s:
            continue
        if m['part'] == 'отчёт':
            cols = c.get('columns') or cards.get(r['id'], {}).get('columns') or []
            for j, row in enumerate(s.get('rows', []), 1):
                if not isinstance(row.get('level'), int) or row['level'] < 0:
                    errors.append(f'{k}: образец, строка {j}: нет уровня')
                if len(row.get('cells', [])) != len(cols):
                    errors.append(f'{k}: образец, строка {j}: ячеек {len(row.get("cells", []))}, '
                                  f'колонок {len(cols)}')
            if not s.get('title') or not s.get('rows'):
                errors.append(f'{k}: в образце нет заголовка или строк')
        elif m['part'] == 'бланк':
            if not s.get('title') or not s.get('body'):
                errors.append(f'{k}: в образце бланка нет заголовка или текста')


def resolve(ref, keys):
    hit = [k for k in keys if k == ref or ('|' in ref and k.startswith(ref))]
    return hit[0] if len(hit) == 1 else None


def check_control(data, errors):
    ctl = data.get('control')
    if not ctl:
        errors.append('нет контрольного набора "control"')
        return
    keys = [key(r) for r in data['rows']]
    covered = set()
    seen = {}
    for b in ctl['set']:
        for f in ('unit', 'curator', 'loans'):
            if not b.get(f):
                errors.append(f'{b["id"]}: нет поля "{f}"')
        for ln in b.get('loans', []):
            miss = [f for f in LOAN_REQ if ln.get(f) in (None, '')]
            if miss:
                errors.append(f'{b["id"]}: у кредита нет {", ".join(miss)}')
            if ln.get('no') in seen:
                errors.append(f'{b["id"]}: договор {ln["no"]} уже у {seen[ln["no"]]}')
            seen[ln.get('no')] = b['id']
        for ref in b['forms']:
            k = resolve(ref, keys)
            if not k:
                errors.append(f'{b["id"]}: ссылка «{ref}» не находит строку однозначно')
            covered.add(k)
    for ref in list(ctl['all']) + list(ctl['none']):
        k = resolve(ref, keys)
        if not k:
            errors.append(f'контрольный набор: ссылка «{ref}» не находит строку однозначно')
        covered.add(k)
    for k in keys:
        if k not in covered:
            errors.append(f'{k}: не проверяется ни на одном заёмщике контрольного набора')


def check(data):
    errors = []
    check_rows(data, errors)
    check_cards(data, errors)
    check_control(data, errors)
    if errors:
        fail(errors)


def control_for(data, k):
    ctl = data['control']
    keys = [key(r) for r in data['rows']]
    who = [b['id'] for b in ctl['set'] if any(resolve(ref, keys) == k for ref in b['forms'])]
    if any(resolve(ref, keys) == k for ref in ctl['all']):
        return 'весь набор' + ('; особо: ' + ', '.join(who) if who else '')
    if who:
        return ', '.join(who)
    for ref, why in ctl['none'].items():
        if resolve(ref, keys) == k:
            return why
    return ''


def expand(data):
    """Строки в порядке листа: часть → номер; вид сразу за своей формой."""
    order = list(PARTS)
    cards = data['cards']
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
            # вид наследует поля формы, кроме стиля: вид по стандарту объявляет его сам
            card = {k: v for k, v in cards[rid].items() if k != 'style'} if vid else {}
            card.update(cards[key(r)])
            has_file = p == 'отчёт' and not is_stub(main)
            out.append(dict(
                id=rid, vid=vid, key=key(r), part=p, stub=is_stub(main),
                name=f'вид «{vid}»' if vid else r['name'], title=main['name'],
                module=r['module'], to=r['to'], lang=lang, basis=r['basis'],
                sample=r['sample'], warn='; '.join(warn), note=r.get('note', ''),
                card=card, file=f'{rid}.xlsx' if has_file else '',
                control=control_for(data, key(r)),
            ))
    return out


def name_col(rows):
    """Колонка наименования: первая, где в строке ИТОГО стоит текст."""
    cells = rows[0]['cells'] if rows else []
    return next((i for i, v in enumerate(cells) if isinstance(v, str) and v), 0)


def sum_warnings(row):
    """Подытоги образца отчёта, не равные сумме прямых подстрок."""
    c = row['card']
    cols, rows = c.get('columns', []), c.get('sample', {}).get('rows', [])
    out = []
    ni = name_col(rows)
    for i, r in enumerate(rows):
        kids, j = [], i + 1
        while j < len(rows) and rows[j]['level'] > r['level']:
            # строка «в <валюта> (курс …)» — те же суммы в валюте договора, в итоги не входит
            if rows[j]['level'] == r['level'] + 1 and not rows[j].get('fx'):
                kids.append(rows[j])
            j += 1
        if not kids or (len(kids) > 1 and all(kd['cells'][:ni] + kd['cells'][ni + 1:]
                                              == r['cells'][:ni] + r['cells'][ni + 1:] for kd in kids)):
            continue  # нет подстрок или разделы — разные разрезы одного итога
        for ci, col in enumerate(cols):
            label = f'{col.get("group", "")} {col["name"]}'
            if ci == ni or NOT_ADDITIVE.search(col['name']) or '%' in label:
                continue
            v = r['cells'][ci]
            vals = [kd['cells'][ci] for kd in kids]
            if not isinstance(v, (int, float)) or not all(isinstance(x, (int, float)) or x == ''
                                                          for x in vals):
                continue
            nums = [x for x in vals if x != '']
            if not nums:
                continue
            s = sum(nums)
            if abs(v - s) > 0.011:
                out.append(f'строка {i + 1} «{r["cells"][ni]}», колонка «{label.strip()}»: {v} ≠ {s:.2f}')
    return out


def counts(rows):
    c = {}
    for r in rows:
        k = (r['part'], bool(r['vid']))
        c[k] = c.get(k, 0) + 1
    return dict(
        reports=c.get(('отчёт', False), 0), report_vids=c.get(('отчёт', True), 0),
        stub=sum(1 for r in rows if r['stub'] and not r['vid']),
        blanks=c.get(('бланк', False), 0), blank_vids=c.get(('бланк', True), 0),
        reqs=c.get(('требование', False), 0),
        warn=sum(1 for r in rows if r['warn']),
        kg=sum(1 for r in rows if 'Кыргызский текст' in r['warn']),
    )


# --- Перечень.xlsx -----------------------------------------------------------------------

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


def table_row(ws, r, vals, vid=False):
    for i, v in enumerate(vals, 1):
        c = ws.cell(row=r, column=i, value=v)
        c.alignment = WRAP
        c.border = BORDER
        if vid:
            c.fill = VID_FILL
    if vid:
        ws.cell(row=r, column=3).alignment = Alignment(wrap_text=True, vertical='top', indent=2)
        ws.cell(row=r, column=3).font = Font(italic=True)
    else:
        ws.cell(row=r, column=2).font = Font(bold=True)


def page_setup(ws, head=None):
    if head:
        ws.print_title_rows = f'{head}:{head}'
    ws.page_setup.orientation = 'landscape'
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True


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
        path = f'{SAMPLES}/{row["file"]}' if row['file'] else '—'
        table_row(ws, r, [k, row['id'], row['name'], PARTS[row['part']], row['module'], row['to'],
                          row['lang'], row['basis'], row['sample'], path, row['warn'], row['note']],
                  bool(row['vid']))
        if row['file']:
            c = ws.cell(row=r, column=10)
            c.hyperlink = path
            c.font = Font(color=BLUE, underline='single')
        if row['warn']:
            ws.cell(row=r, column=11).fill = WARN_FILL
    ws.freeze_panes = ws.cell(row=head + 1, column=4)
    ws.auto_filter.ref = f'A{head}:{get_column_letter(nc)}{r}'
    page_setup(ws, head)


def sheet_reports(wb, data, rows, n):
    """Перечень отчётов: только отчёты и их виды; rows — уже отобранные строки отчётов."""
    ws = wb.active
    ws.title = 'Перечень отчётов'
    nc = len(REPORT_COLS)
    set_widths(ws, REPORT_COLS)
    used = ' '.join(f'{x["basis"]} {x["sample"]} {x["note"]}' for x in rows)
    legend = [l for l in data['legend'] if re.sub(r' (¶N|NN)$', '', l.split(' — ')[0]) in used]
    scope = next(x for x in data['rules'] if x.startswith('Охват'))
    r = 1
    text_row(ws, r, REPORTS_TITLE, nc, Font(bold=True, size=14), 22)
    r += 1
    text_row(ws, r, data['date'], nc, Font(italic=True, color='555555'))
    r += 1
    total = (f'Отчётов: {n["reports"]} (из них заготовок внешних форм: {n["stub"]}), видов отчётов: '
             f'{n["report_vids"]}. Строк с ⚠: {n["warn"]}.')
    text_row(ws, r, total, nc, Font(bold=True))
    r += 2
    text_row(ws, r, scope, nc, height=30)
    r += 2
    text_row(ws, r, 'Обозначения: ' + '; '.join(legend) + '.', nc, Font(color='555555', size=9), 42)
    r += 2
    header(ws, r, REPORT_COLS)
    head = r
    for k, row in enumerate(rows, 1):
        r += 1
        table_row(ws, r, [k, row['id'], row['name'], row['module'], row['to'], row['basis'],
                          row['sample'], row['warn'], row['note']], bool(row['vid']))
        if row['warn']:
            ws.cell(row=r, column=8).fill = WARN_FILL
    ws.freeze_panes = ws.cell(row=head + 1, column=4)
    ws.auto_filter.ref = f'A{head}:{get_column_letter(nc)}{r}'
    page_setup(ws, head)


def sheet_acceptance(wb, data, rows):
    ws = wb.create_sheet('Приёмка')
    nc = len(ACC_COLS)
    set_widths(ws, ACC_COLS)
    text_row(ws, 1, 'Лист приёмки отчётов и бланков', nc, Font(bold=True, size=14), 22)
    text_row(ws, 2, 'Перечень на дату заморозки: ____________. Проверка — на контрольном наборе '
                    '(лист «Контрольный набор»). Строка сдана, если готовая форма совпадает с '
                    'карточкой (у отчёта — файл образца, лист «Описание») и выполнены все правила '
                    'проверки. Числа образцов — для иллюстрации.', nc, height=44)
    header(ws, 4, ACC_COLS)
    dv = DataValidation(type='list', formula1=RESULTS, allow_blank=True)
    ws.add_data_validation(dv)
    r = 4
    for k, row in enumerate(rows, 1):
        r += 1
        checks = '\n'.join(f'{i}. {t}' for i, t in enumerate(row['card'].get('checks', []), 1))
        table_row(ws, r, [k, row['id'], row['name'], checks, row['control'], '', '', '', '', ''],
                  bool(row['vid']))
        dv.add(f'F{r}')
    ws.freeze_panes = 'D5'
    ws.auto_filter.ref = f'A4:{get_column_letter(nc)}{r}'
    r += 2
    text_row(ws, r, 'Сдал: ____________________ (разработчик)          Принял: ____________________ '
                    '(заказчик)          Дата: ____________', nc)
    page_setup(ws, 4)


def sheet_control(wb, data):
    ws = wb.create_sheet('Контрольный набор')
    ctl = data['control']
    nc = len(SET_COLS)
    set_widths(ws, SET_COLS)
    text_row(ws, 1, 'Контрольный набор', nc, Font(bold=True, size=14), 22)
    text_row(ws, 2, ctl['note'], nc, height=58)
    header(ws, 4, SET_COLS)
    r = 4
    for b in ctl['set']:
        first = r + 1
        for i, ln in enumerate(b['loans']):
            r += 1
            head = [b['id'], b['name'], b['region'], b['unit'], b['curator']] if i == 0 else [''] * 5
            tail = [b['case'], ', '.join(b['forms'])] if i == 0 else ['', '']
            table_row(ws, r, head + [f'№ {ln["no"]} от {ln["date"]}', ln['cur'], ln['amount'], ln['rest'],
                                     ln.get('group', ''), ln.get('note', '')] + tail)
            for ci in (8, 9):
                ws.cell(row=r, column=ci).number_format = '#,##0.00'
        if r > first:
            for ci in (1, 2, 3, 4, 5, 12, 13):
                ws.merge_cells(start_row=first, start_column=ci, end_row=r, end_column=ci)
    r += 2
    text_row(ws, r, 'На всём наборе проверяются: ' + ', '.join(ctl['all']) + '.', nc)
    ws.freeze_panes = 'A5'
    page_setup(ws, 4)


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
    page_setup(ws)


# --- Образцы отчётов (xlsx) --------------------------------------------------------------

def wrapped(text, width):
    """Число строк текста при переносе по словам в колонке шириной width символов."""
    n, cur = 1, 0
    for word in str(text).split():
        if cur and cur + 1 + len(word) > width:
            n, cur = n + 1, len(word)
        else:
            cur += len(word) + (1 if cur else 0)
    return n


def sample_sheet(ws, card, caption=None):
    cols, s = card['columns'], card['sample']
    nc = len(cols)
    r = 1
    if caption:
        ws.cell(row=r, column=1, value=caption).font = Font(italic=True, color='555555')
        r += 2
    for line in s['title']:
        ws.cell(row=r, column=1, value=line)
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=nc)
        ws.cell(row=r, column=1).font = Font(bold=True, size=12)
        ws.cell(row=r, column=1).alignment = CENTER
        r += 1
    r += 1
    two = any(c.get('group') for c in cols)
    top = r
    i = 0
    while i < nc:
        g = cols[i].get('group')
        j = i
        while g and j + 1 < nc and cols[j + 1].get('group') == g:
            j += 1
        if g:
            ws.cell(row=top, column=i + 1, value=g)
            if j > i:
                ws.merge_cells(start_row=top, start_column=i + 1, end_row=top, end_column=j + 1)
            for ci in range(i, j + 1):
                ws.cell(row=top + 1, column=ci + 1, value=cols[ci]['name'])
        else:
            ws.cell(row=top, column=i + 1, value=cols[i]['name'])
            if two:
                ws.merge_cells(start_row=top, start_column=i + 1, end_row=top + 1, end_column=i + 1)
        i = j + 1
    last_head = top + (1 if two else 0)
    ni = name_col(s['rows'])
    widths = [38 if ci == ni else max(12, min(22, max(len(str(x['cells'][ci])) for x in s['rows']) + 3))
              for ci in range(nc)]
    for ci, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(ci)].width = w
    # высота шапки — под самый длинный заголовок колонки
    need = [13 * wrapped(col['name'], int(widths[ci] * 0.9)) + 6 for ci, col in enumerate(cols)]
    if two:
        ws.row_dimensions[top].height = 30
        ws.row_dimensions[last_head].height = max(
            [30] + [need[ci] for ci, col in enumerate(cols) if col.get('group')]
            + [need[ci] - 30 for ci, col in enumerate(cols) if not col.get('group')])
    else:
        ws.row_dimensions[top].height = max([32] + need)
    for hr in range(top, last_head + 1):
        for ci in range(1, nc + 1):
            c = ws.cell(row=hr, column=ci)
            c.font = Font(bold=True, size=9)
            c.alignment = CENTER
            c.fill = SAMPLE_HEAD_FILL
            c.border = SAMPLE_BORDER
    r = last_head
    pct = [bool(re.search('%', f'{c.get("group", "")} {c["name"]}')) for c in cols]
    money = [any(isinstance(x['cells'][ci], float) for x in s['rows']) for ci in range(nc)]
    for row in s['rows']:
        r += 1
        lvl = row['level']
        for ci, v in enumerate(row['cells']):
            c = ws.cell(row=r, column=ci + 1, value=v)
            c.border = SAMPLE_BORDER
            c.font = Font(bold=lvl <= 1, size=9)
            c.alignment = Alignment(vertical='top', wrap_text=ci == ni,
                                    indent=max(0, lvl - 1) if ci == ni else 0)
            if isinstance(v, bool) or not isinstance(v, (int, float)):
                continue
            # в колонке, где есть дробные суммы, целые тоже печатаются с копейками
            c.number_format = '0.0' if pct[ci] else '#,##0.00' if money[ci] else '#,##0'
    ws.freeze_panes = ws.cell(row=last_head + 1, column=ni + 2)
    page_setup(ws)


def text_lines(text, width):
    """Число строк текста с переносами по словам и явными переводами строки."""
    return sum(wrapped(part, width) for part in str(text).split('\n'))


def std_sheet(ws, row, card):
    """Лист отчёта по стандарту: шапка формы, двухъярусная шапка таблицы с номерами граф;
    строки групп с их итогом ("kind": "total"; уровень 0 — ИТОГО) над строками кредитов;
    печать в одну страницу по ширине."""
    cols, s = card['columns'], card['sample']
    nc = len(cols)
    # формат числа типа карточка может заменить полем "fmt" (ставка штрафа в день: 0,05 и 0,0493)
    types = [(t[0], c.get('fmt', t[1]), t[2], t[3])
             for c in cols for t in [COL_TYPES[c.get('type', 'text')]]]
    # ширина по типу, но не уже самого длинного слова заголовка: слово не рвётся посередине (Arial 8)
    # ширину типа карточка может расширить полем "width" (значение справочника длиннее типа)
    widths = [max(c.get('width', t[0]), round(max(len(w) for w in c['name'].split()) * 0.8 + 0.6, 1))
              for t, c in zip(types, cols)]
    ni = next(i for i, c in enumerate(cols) if c.get('type') == 'name')
    grey = Font(name=STD_FONT, size=8, color='808080')
    ws.cell(row=1, column=1, value=ORG).font = grey
    c = ws.cell(row=1, column=nc, value=row['id'])
    c.font = grey
    c.alignment = Alignment(horizontal='right')
    lines = [(s['title'][0], Font(name=STD_FONT, size=12, bold=True))]
    lines += [(t, Font(name=STD_FONT, size=10)) for t in s['title'][1:]]
    lines += [(t, Font(name=STD_FONT, size=9, italic=True)) for t in s.get('notes', [])]
    r = 2
    for text, font in lines:
        ws.cell(row=r, column=1, value=text).font = font
        ws.cell(row=r, column=1).alignment = Alignment(horizontal='center')
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=nc)
        r += 1
    top = r + 1
    i = 0
    while i < nc:
        g = cols[i].get('group')
        j = i
        while g and j + 1 < nc and cols[j + 1].get('group') == g:
            j += 1
        if g:
            ws.cell(row=top, column=i + 1, value=g)
            if j > i:
                ws.merge_cells(start_row=top, start_column=i + 1, end_row=top, end_column=j + 1)
            for ci in range(i, j + 1):
                ws.cell(row=top + 1, column=ci + 1, value=cols[ci]['name'])
        else:
            ws.cell(row=top, column=i + 1, value=cols[i]['name'])
            ws.merge_cells(start_row=top, start_column=i + 1, end_row=top + 1, end_column=i + 1)
        i = j + 1
    nums = top + 2
    for ci in range(nc):
        ws.cell(row=nums, column=ci + 1, value=ci + 1)
    for hr in range(top, nums + 1):
        for ci in range(1, nc + 1):
            c = ws.cell(row=hr, column=ci)
            c.font = Font(name=STD_FONT, size=8)
            c.fill = STD_HEAD_FILL
            c.border = SAMPLE_BORDER
            c.alignment = CENTER
    for ci, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(ci)].width = w
    # высота шапки — под самый длинный заголовок колонки
    need = [11 * wrapped(col['name'], int(widths[ci] * 1.2)) + 8 for ci, col in enumerate(cols)]
    ws.row_dimensions[top].height = 14
    ws.row_dimensions[top + 1].height = max([14] + [need[ci] for ci, col in enumerate(cols) if col.get('group')]
                                            + [need[ci] - 14 for ci, col in enumerate(cols) if not col.get('group')])
    cuts = card.get('razrezy', {}).get('default', [])
    r = nums
    for x in s['rows']:
        r += 1
        lvl, kind, fx = x['level'], x.get('kind', 'detail'), x.get('fx', False)
        size = 9 if lvl == 0 else 8
        color = None
        if kind == 'total':
            color = ITOGO_FILL if lvl == 0 else RAZREZ_FILLS.get(cuts[lvl - 1]) if lvl <= len(cuts) else None
        fill = PatternFill('solid', fgColor=color) if color else None
        ink = ITOGO_FONT if kind == 'total' and lvl == 0 else '555555' if fx else None
        # "mark": номера колонок (с 0), чьи ячейки выделяются заливкой — значение изменено (ФО-09)
        marks = set(x.get('mark', []))
        height = 1
        for ci, v in enumerate(x['cells']):
            _, fmt, align, wrap = types[ci]
            width = widths[ci]
            # явный перевод строки переносится в любой колонке: «Euribor-6m + 4,00» / «= 6,08»
            wrap = wrap or isinstance(v, str) and '\n' in v
            if align == 'center' and isinstance(v, str) and DATE_RE.match(v):
                d, m, y = DATE_RE.match(v).groups()
                v = datetime(int(y), int(m), int(d))
            c = ws.cell(row=r, column=ci + 1, value=None if v == '' else v)
            c.border = SAMPLE_BORDER
            c.font = Font(name=STD_FONT, size=size, bold=kind == 'total', italic=fx, color=ink)
            if ci in marks:
                c.fill = MARK_FILL
            elif fill:
                c.fill = fill
            c.alignment = Alignment(horizontal=align, vertical='top', wrap_text=wrap,
                                    indent=max(0, lvl - 1) if ci == ni else 0)
            if fmt and not isinstance(v, str):
                c.number_format = fmt
            if wrap and isinstance(v, str):
                height = max(height, text_lines(v, int(width * 1.2) - (2 * lvl if ci == ni else 0)))
        ws.row_dimensions[r].height = (12 if size == 9 else 11) * height + 2
    ws.freeze_panes = f'{get_column_letter(ni + 2)}{nums + 1}'
    ws.print_title_rows = f'{top}:{nums}'
    table_mm = sum(w * 7 + 5 for w in widths) * 25.4 / 96
    # A3 — только если на A4 масштаб меньше 50 % (старая система печатала свод в 17 колонок на A4 ≈ 60 %)
    paper = 'A4' if PRINT_MM['A4'] / table_mm >= 0.5 else 'A3'
    ws.page_setup.paperSize = ws.PAPERSIZE_A4 if paper == 'A4' else ws.PAPERSIZE_A3
    ws.page_setup.orientation = 'landscape'
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    for side in ('left', 'right', 'top', 'bottom'):
        setattr(ws.page_margins, side, 0.39)
    ws.oddFooter.center.text = (f'{row["id"]} · сформировал {s["made_by"]} {s["made_at"]} · '
                                f'Страница &P из &N')
    ws.oddFooter.center.size = 8
    ws.oddFooter.center.font = STD_FONT


def std_params_sheet(ws, card):
    """Лист «Параметры»: все параметры, курсы, период, кто и когда сформировал."""
    ws.cell(row=1, column=1, value='Параметры отчёта').font = Font(name=STD_FONT, size=11, bold=True)
    ws.column_dimensions['A'].width = 24
    ws.column_dimensions['B'].width = 80
    for r, (k, v) in enumerate(card['sample']['sheet_params'], 3):
        for ci, (val, bold) in enumerate([(k, True), (v, False)], 1):
            c = ws.cell(row=r, column=ci, value=val)
            c.font = Font(name=STD_FONT, size=9, bold=bold)
            c.border = SAMPLE_BORDER
            c.alignment = WRAP
        ws.row_dimensions[r].height = 12 * wrapped(v, 92) + 3
    ws.page_setup.orientation = 'landscape'
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True


def describe_rows(row):
    c = row['card']
    yield 'Номер', row['id']
    yield 'Название', row['title']
    yield 'Часть', PARTS[row['part']]
    yield 'Модуль', row['module']
    yield 'Получатель', row['to']
    yield 'Язык', row['lang']
    yield 'Основание', row['basis']
    yield 'Образец-основа', row['sample']
    yield 'Кому и зачем', c.get('purpose', '')
    yield 'Когда', c.get('when', '')
    yield 'Параметры', '\n'.join('• ' + p for p in c.get('params', []))
    yield 'Строки', c.get('layout', '')
    if c.get('razrezy'):
        z = c['razrezy']
        yield 'Разрезы', (f'по умолчанию: {" → ".join(z["default"])} → {z["detail"].lower()}; '
                          f'можно выбрать: {", ".join(z["available"])}')
    if c.get('empty'):
        yield 'Если строк нет', c['empty']
    yield 'Выгрузка', c.get('export', 'xlsx, pdf')
    if row['note']:
        yield 'Примечание', row['note']
    if row['warn']:
        yield '⚠ Нужно от заказчика', row['warn']


def vid_rows(row, vrow):
    """Поля вида, отличные от формы."""
    names = {'purpose': 'Кому и зачем', 'when': 'Когда', 'params': 'Параметры', 'layout': 'Строки'}
    for f, label in names.items():
        v = vrow['card'].get(f)
        if v and v != row['card'].get(f):
            yield label, '\n'.join('• ' + p for p in v) if isinstance(v, list) else v
    z = vrow['card'].get('razrezy')
    if z and z != row['card'].get('razrezy'):
        yield 'Разрезы', (f'по умолчанию: {" → ".join(z["default"])} → {z["detail"].lower()}; '
                          f'можно выбрать: {", ".join(z["available"])}')
    yield 'Основание', vrow['basis']
    yield 'Образец-основа', vrow['sample']


def describe_sheet(ws, row, vids):
    ws.column_dimensions['A'].width = 26
    ws.column_dimensions['B'].width = 40
    ws.column_dimensions['C'].width = 70
    r = 1
    ws.cell(row=r, column=1, value=f'{row["id"]} «{row["title"]}» — карточка').font = Font(bold=True, size=13)
    r += 2

    def kv(label, value):
        nonlocal r
        ws.cell(row=r, column=1, value=label).font = Font(bold=True)
        ws.cell(row=r, column=2, value=value)
        ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=3)
        for ci in (1, 2):
            ws.cell(row=r, column=ci).alignment = WRAP
        ws.row_dimensions[r].height = max(15, 15 * (len(str(value)) // 95 + 1 + str(value).count('\n')))
        r += 1

    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True

    def section(title):
        nonlocal r
        r += 1
        ws.cell(row=r, column=1, value=title).font = Font(bold=True, size=11, color=BLUE)
        r += 1

    for label, value in describe_rows(row):
        kv(label, value)
    section('Колонки')
    for ci, (h, w) in enumerate([('Колонка', 0), ('Общая шапка', 0), ('Что в ней', 0)], 1):
        c = ws.cell(row=r, column=ci, value=h)
        c.font = Font(bold=True)
        c.fill = SAMPLE_HEAD_FILL
    r += 1
    for col in row['card']['columns']:
        for ci, v in enumerate([col['name'], col.get('group', ''), col.get('def', '')], 1):
            ws.cell(row=r, column=ci, value=v).alignment = WRAP
        r += 1
    section('Правила проверки')
    for i, t in enumerate(row['card']['checks'], 1):
        kv(f'{i}.', t)
    for n, v in enumerate(vids, 1):
        section(f'Вид {n}: «{v["vid"]}» — лист «Вид {n}»')
        for label, value in vid_rows(row, v):
            kv(label, value)
        if v['card'].get('columns') and v['card']['columns'] != row['card']['columns']:
            kv('Колонки', '; '.join(c['name'] if not c.get('group') else f'{c["group"]}: {c["name"]}'
                                    for c in v['card']['columns']))
        for i, t in enumerate(v['card']['checks'], 1):
            kv(f'Проверка {i}', t)


def build_report(row, vids, path):
    wb = Workbook()
    ws = wb.active
    if row['card'].get('style') == 'стандарт':
        ws.title = row['id']
        std_sheet(ws, row, row['card'])
        std_params_sheet(wb.create_sheet('Параметры'), row['card'])
    else:
        ws.title = 'Образец'
        sample_sheet(ws, row['card'])
    for n, v in enumerate(vids, 1):
        if v['card'].get('style') == 'стандарт':
            std_sheet(wb.create_sheet(f'Вид {n}'), row, v['card'])
            std_params_sheet(wb.create_sheet(f'Вид {n} — параметры'), v['card'])
        else:
            sample_sheet(wb.create_sheet(f'Вид {n}'), v['card'], f'{row["id"]}, вид «{v["vid"]}»')
    describe_sheet(wb.create_sheet('Описание'), row, vids)
    wb.save(path)


def build_samples(rows, out, only=None):
    out.mkdir(exist_ok=True)
    groups = {}
    for r in rows:
        if r['file'] and (not only or r['id'] in only):
            groups.setdefault(r['id'], []).append(r)
    made = set()
    for rid, rs in groups.items():
        main, vids = rs[0], rs[1:]
        made.add(main['file'])
        build_report(main, vids, out / main['file'])
    for f in out.iterdir():
        if not only and SAMPLE_RE.match(f.name) and f.name not in made:
            f.unlink()
            print(f'удалён лишний образец {f.name}')
    return len(made)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    no_samples = '--no-samples' in sys.argv
    only = {x for a in sys.argv[1:] if a.startswith('--only=') for x in a[len('--only='):].split(',')}
    src = Path(args[0]) if args else SRC
    out = Path(args[1]) if len(args) > 1 else OUT_DIR
    data = json.loads(src.read_text(encoding='utf-8'))
    check(data)
    rows = expand(data)
    if '--reports' in sys.argv:
        reports = [r for r in rows if r['part'] == 'отчёт']
        n = counts(reports)
        wb = Workbook()
        sheet_reports(wb, data, reports, n)
        out.mkdir(parents=True, exist_ok=True)
        wb.save(out / REPORTS_FILE)
        print(f'{REPORTS_FILE}: {len(reports)} строк — отчётов {n["reports"]} (заготовок {n["stub"]}) '
              f'+ видов {n["report_vids"]}; ⚠ {n["warn"]}')
        return
    n = counts(rows)
    warns =[(r['key'], w) for r in rows if r['part'] == 'отчёт' and not r['stub'] for w in sum_warnings(r)]
    opens = [(r['key'], q) for r in rows for q in data['cards'][r['key']].get('open', [])]
    wb = Workbook()
    sheet_list(wb, data, rows, n)
    sheet_acceptance(wb, data, rows)
    sheet_control(wb, data)
    sheet_outside(wb, data)
    out.mkdir(parents=True, exist_ok=True)
    wb.save(out / 'Перечень.xlsx')
    made = 0 if no_samples else build_samples(rows, out / SAMPLES, only)
    for k, w in warns:
        print(f'предупреждение: {k}: образец: {w}')
    for k, q in opens:
        print(f'вопрос владельцу: {k}: {q}')
    print(f'Перечень.xlsx: {len(rows)} строк — отчётов {n["reports"]} (заготовок {n["stub"]}) + видов '
          f'{n["report_vids"]}, бланков {n["blanks"]} + видов {n["blank_vids"]}, требований {n["reqs"]}; '
          f'⚠ {n["warn"]} (кыргызский текст {n["kg"]}); вне перечня {len(data["outside"])}; '
          f'образцов {made}; предупреждений {len(warns)}; вопросов владельцу {len(opens)}')


if __name__ == '__main__':
    main()
