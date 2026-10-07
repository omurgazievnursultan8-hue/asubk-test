#!/usr/bin/env python3
"""Recompute a repayment schedule dumped from the Заявки «График» tab and diff it.

Input: JSON list of grid rows as dumped by scripts/inspect/app-lib.mjs gridAll():
  [№, Дата начала, Дата платежа, Дней, Ставка %, Остаток на начало, Проценты,
   Погашение осн. долга, Платёж итого, Остаток на конец]

Checks, row by row: day count, interest = balance * rate * days / basis, balance
chain, payment = interest + principal; totals: principal sum == loan amount,
final balance == 0; payment dates that fall on Sat/Sun are reported.

  python3 scripts/check_schedule.py .auth/qa-b4-schedule-78.json --basis 365
"""
import argparse
import json
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

Q = Decimal('0.01')


def num(s):
    return Decimal(s.replace(' ', '').replace(' ', '').replace(',', '.'))


def dt(s):
    d, m, y = map(int, s.split('.'))
    return date(y, m, d)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('file')
    ap.add_argument('--basis', default='365', help='365 | 360 | act (actual days in year)')
    a = ap.parse_args()
    rows = json.load(open(a.file, encoding='utf-8'))
    issues = []
    weekend = []
    prev_end = None
    tot_int = tot_pr = Decimal(0)
    amount = num(rows[0][5])
    for r in rows:
        n, d0, d1, days, rate, bal0, intr, pr, pay, bal1 = r[:10]
        d0, d1 = dt(d0), dt(d1)
        days, rate = int(days), num(rate)
        bal0, intr, pr, pay, bal1 = map(num, (bal0, intr, pr, pay, bal1))
        if (d1 - d0).days != days:
            issues.append(f'#{n}: дней {days}, по датам {(d1 - d0).days}')
        if a.basis == 'act':
            yd = 366 if (d0.year % 4 == 0 and (d0.year % 100 or d0.year % 400 == 0)) else 365
        else:
            yd = int(a.basis)
        exp = (bal0 * rate / 100 * days / yd).quantize(Q, ROUND_HALF_UP)
        if abs(exp - intr) > Q:
            issues.append(f'#{n}: проценты {intr}, ожидалось {exp}')
        if prev_end is not None and prev_end != bal0:
            issues.append(f'#{n}: остаток на начало {bal0} ≠ конец прошлой строки {prev_end}')
        if bal0 - pr != bal1:
            issues.append(f'#{n}: {bal0} - {pr} ≠ {bal1}')
        if intr + pr != pay:
            issues.append(f'#{n}: {intr} + {pr} ≠ итого {pay}')
        if d1.weekday() >= 5:
            weekend.append(f'#{n} {d1:%d.%m.%Y} ({"сб" if d1.weekday() == 5 else "вс"})')
        prev_end = bal1
        tot_int += intr
        tot_pr += pr
    print(f'строк {len(rows)}, сумма {amount}, осн. долг итого {tot_pr}, проценты итого {tot_int}, '
          f'остаток в конце {prev_end}')
    if tot_pr != amount:
        issues.append(f'сумма погашений осн. долга {tot_pr} ≠ сумме кредита {amount}')
    if prev_end != 0:
        issues.append(f'остаток после последнего платежа {prev_end} ≠ 0')
    print('расхождения:', *(issues or ['нет']), sep='\n  ')
    print('платежи в выходные:', *(weekend or ['нет']), sep='\n  ')


if __name__ == '__main__':
    main()
