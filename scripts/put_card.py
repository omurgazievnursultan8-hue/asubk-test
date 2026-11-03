"""Вклеивает карточку отчёта или бланка в docs/perechen-otchetov/perechen.json, не переформатируя файл.

    python3 scripts/put_card.py ФО-02 card.json
    python3 scripts/put_card.py "ФО-02|Погашенные за период" card.json
    python3 scripts/put_card.py ФО-02 card.json --name "Задолженность по состоянию на дату" --note "…"
    python3 scripts/put_card.py "ФО-04|Собрано за месяц" --shows "…" --to "…" --old "…"
    python3 scripts/put_card.py ФО-02 --dump card.json        # выгрузить текущую карточку для правки

card.json — объект карточки, как в perechen.json["cards"][ключ]. Карточка заменяется текстом на своём месте;
--note, --shows (Что показывает), --to (Кому), --old (В старой системе), --basis меняют поля строки перечня с этим
ключом: формы или вида. --name — название формы (у вида своего названия нет).
Перед записью скрипт проверяет, что остальные карточки и строки не изменились, иначе ничего не пишет.
После вклейки — python3 scripts/build_perechen.py --only=<номер>.
"""
import argparse
import json
import re
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent / 'docs/perechen-otchetov/perechen.json'
CARD_LINE = re.compile(r'^    "([^"]+)": \{$', re.M)
ROW_FIELDS = ('note', 'shows', 'to', 'old', 'basis')


def card_span(text, key):
    """Начало и конец текста карточки key (от строки ключа до строки следующей карточки)."""
    cards_at = text.index('\n  "cards": {\n')
    hits = [m for m in CARD_LINE.finditer(text) if m.start() > cards_at]
    keys = [m.group(1) for m in hits]
    if key not in keys:
        sys.exit(f'нет карточки «{key}»')
    i = keys.index(key)
    start = hits[i].start()
    end = hits[i + 1].start() if i + 1 < len(hits) else text.index('\n  }', start) + 1
    return start, end, i + 1 == len(hits)


def set_row_field(text, key, field, value):
    """Меняет поле строки перечня: key — номер формы или «номер|вид»."""
    rid, _, vid = key.partition('|')
    tail = r'", "vid": ' + re.escape(json.dumps(vid, ensure_ascii=False)) if vid else r'", "part"'
    m = re.search(r'^    \{"id": "' + re.escape(rid) + tail, text, re.M)
    if not m:
        sys.exit(f'нет строки перечня «{key}»')
    end = re.compile(r'^    \{"id"|^  \]', re.M).search(text, m.end()).start()
    block = text[m.start():end]
    pat = re.compile(r'"' + field + r'": "(?:[^"\\]|\\.)*"')
    item = f'"{field}": ' + json.dumps(value, ensure_ascii=False)
    if pat.search(block):
        new_block = pat.sub(lambda _: item, block, count=1)
    else:
        # поля нет — дописать новой строкой перед закрывающей скобкой строки перечня
        close = block.rindex('}')
        new_block = block[:close] + ',\n     ' + item + block[close:]
    return text[:m.start()] + new_block + text[end:]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('key')
    ap.add_argument('card', nargs='?')
    ap.add_argument('--dump')
    ap.add_argument('--name')
    for field in ROW_FIELDS:
        ap.add_argument('--' + field)
    a = ap.parse_args()
    text = SRC.read_text(encoding='utf-8')
    data = json.loads(text)
    if a.dump:
        Path(a.dump).write_text(json.dumps(data['cards'][a.key], ensure_ascii=False, indent=2), encoding='utf-8')
        print('выгружено:', a.dump)
        return
    new = text
    if a.card:
        card = json.loads(Path(a.card).read_text(encoding='utf-8'))
        start, end, last = card_span(new, a.key)
        body = json.dumps(card, ensure_ascii=False, indent=2)
        body = '\n'.join(('    ' + ln) if i else ln for i, ln in enumerate(body.split('\n')))
        new = new[:start] + f'    {json.dumps(a.key, ensure_ascii=False)}: ' + body + ('\n' if last else ',\n') + new[end:]
    rid = a.key.split('|')[0]
    if a.name is not None:
        new = set_row_field(new, rid, 'name', a.name)
    for field in ROW_FIELDS:
        if getattr(a, field) is not None:
            new = set_row_field(new, a.key, field, getattr(a, field))
    b = json.loads(new)
    # остальное не тронуто
    assert {k: v for k, v in data.items() if k not in ('cards', 'rows')} == \
           {k: v for k, v in b.items() if k not in ('cards', 'rows')}
    assert {k: v for k, v in data['cards'].items() if k != a.key} == \
           {k: v for k, v in b['cards'].items() if k != a.key}
    row_key = lambda r: r['id'] + ('|' + r['vid'] if r.get('vid') else '')
    strip = lambda rows: [{k: v for k, v in r.items()
                           if not (row_key(r) == a.key and k in ROW_FIELDS)
                           and not (r['id'] == rid and 'vid' not in r and k == 'name')} for r in rows]
    assert strip(data['rows']) == strip(b['rows'])
    if new == text:
        print('без изменений')
        return
    SRC.write_text(new, encoding='utf-8')
    print('ok:', a.key)


if __name__ == '__main__':
    main()
