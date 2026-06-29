// Regenerate the DICTS array literal for mockups/dictionaries/dictionaries.html
// from the fresh live capture (.auth/dict-rich/*.json) + vision overrides
// (.auth/specs/*). Preserves group / statusDict / picker-only metadata.
// Output: prints the JS array body to stdout.
import { readFileSync } from 'node:fs';
const rd = p => JSON.parse(readFileSync(p, 'utf8'));
const richAll = rd('.auth/dict-rich/_all.json');
const rich = Object.fromEntries(richAll.map(r => [r.route, r]));
const ov = rd('.auth/specs/overrides.json');
ov.individuals = rd('.auth/specs/individuals.json');
ov.industryDirections = rd('.auth/specs/industry.json');

// route order + group (verbatim from prior mockup)
const ORDER = [
  ['dec',['credit-order-states','credit-order-types','order-document-types','entity-document-states','entity-document-registered-bies','document-package-states','document-package-types','applied-entity-list-states','applied-entity-list-types','applied-entity-states']],
  ['src',['order-term-funds','order-term-currencies','loan-types','loan-credit-lines']],
  ['rate',['loan-percent-rates','interest-rates','order-term-floating-rate-types','order-term-frequency-types','order-term-rate-periods']],
  ['calc',['order-term-days-methods','order-term-accr-methods','order-term-transaction-orders','loan-grace-periods','installment-states','payment-types','loan-termses','creditTerms','calculationCoefficients']],
  ['agr',['agreement-templates','agreement-template-codes','collateralTypes']],
  ['subj',['employees','commissions','borrower-groups','debtor-types','organization-forms','work-sectors','loan-payment-capacity-groups','individuals','organizations']],
  ['loan',['loan-states','loan-type-repayment-accounts','loan-redemption-accounts']],
  ['goods',['good-types','destination-accounts','payment-purpose-requisites','industryDirections']],
  ['picker',['loan-credit-purposes','document-check-levels','interest-calc-types']],
];
const STATUS = new Set(['credit-order-states','entity-document-states','document-package-states','applied-entity-list-states','applied-entity-states','installment-states','loan-states']);
// fallback titles (used when live capture has no heading)
const TITLE = {
  'credit-order-states':'Статус решения','credit-order-types':'Вид решения','order-document-types':'Вид документа',
  'entity-document-states':'Статус документа','entity-document-registered-bies':'Вид регистратора документа',
  'document-package-states':'Статус пакета документации','document-package-types':'Вид пакета документации',
  'applied-entity-list-states':'Статус списка получателей','applied-entity-list-types':'Вид списка получателей',
  'applied-entity-states':'Статус получателя','order-term-funds':'Источник финансирования','order-term-currencies':'Вид валют',
  'loan-types':'Вид кредита','loan-credit-lines':'Кредитная линия','loan-percent-rates':'Фиксированные процентные ставки',
  'interest-rates':'Процентные ставки','order-term-floating-rate-types':'Вид ставок','order-term-frequency-types':'Вид цикла начисления',
  'order-term-rate-periods':'Вид периода начисления','order-term-days-methods':'Вид расчета количества дней',
  'order-term-accr-methods':'Вид начисления','order-term-transaction-orders':'Вид очередности погашения',
  'loan-grace-periods':'Льготные периоды','installment-states':'Статус графика погашений','payment-types':'Вид погашений',
  'loan-termses':'Кредитные условия','creditTerms':'Сроки кредита','calculationCoefficients':'Расчетные коэффициенты',
  'agreement-templates':'Шаблоны договоров','agreement-template-codes':'Справочник кодов шаблонов','collateralTypes':'Виды обеспечения',
  'employees':'Сотрудники','commissions':'Комиссии','borrower-groups':'Группа заемщика','debtor-types':'Вид заемщика',
  'organization-forms':'Вид организационных форм','work-sectors':'Вид отраслей','loan-payment-capacity-groups':'Группа платежоспособности',
  'individuals':'Физ лица','organizations':'Организации','loan-states':'Статус кредита','loan-type-repayment-accounts':'Вид счета погашения',
  'loan-redemption-accounts':'Счет погашения','good-types':'Вид товаров','destination-accounts':'Счета назначения',
  'payment-purpose-requisites':'Счет для оплаты','industryDirections':'Отрасли и направления',
  'loan-credit-purposes':'Цели кредита','document-check-levels':'Уровни проверки документов','interest-calc-types':'Типы расчёта процентов',
};
// picker-only seed data (no menu screen; values from picker captures 2026-06-19)
const PICKER = {
  'loan-credit-purposes':{columns:['Наименование'],rows:[['Пополнение оборотных средств'],['Приобретение основных средств'],['Рефинансирование'],['Строительство']],total:4},
  'document-check-levels':{columns:['Наименование'],rows:[['Первичная'],['Юридическая'],['Финансовая'],['Окончательная']],total:4},
  'interest-calc-types':{columns:['Наименование'],rows:[['Аннуитет'],['Дифференцированный'],['В конце срока']],total:3},
};

const J = s => JSON.stringify(s); // arrays/strings -> compact JSON (valid JS literal)
const out = [];
for (const [group, routes] of ORDER) {
  out.push(`\n  // ── ${group} ─────────────────────────────────────────────────────────────`);
  for (const route of routes) {
    const o = ov[route], r = rich[route] || {}, p = PICKER[route];
    const title = (r.h && r.h[0]) || TITLE[route] || route;
    let columns, rows, total, note, archetype, loc=false;
    if (p) { ({columns, rows, total} = p); note = null; archetype = 'S'; }
    else if (o) { columns = o.columns; rows = o.rows || r.rows || []; total = o.total; note = o.note || null; archetype = o.archetype || r.archetype || 'S'; loc = !!o.loc; }
    else { columns = (r.columns && r.columns.length) ? r.columns : ['Наименование']; rows = r.rows || []; total = (r.total!=null?r.total:rows.length); archetype = r.archetype || 'S'; note = (r.rowsShown!=null && total!=null && r.rowsShown < total) ? `показано ${r.rowsShown} из ${total}` : null; }
    const parts = [`route:${J(route)}`, `title:${J(title)}`, `archetype:${J(archetype)}`, `group:${J(group)}`];
    if (STATUS.has(route)) parts.push('statusDict:true');
    if (loc) parts.push('loc:true');
    parts.push(`columns:${J(columns)}`);
    parts.push(`total:${total}`);
    if (note) parts.push(`note:${J(note)}`);
    // rows multiline for readability
    const rowsStr = rows.length ? '[\n      ' + rows.map(J).join(',\n      ') + ']' : '[]';
    out.push(`  { ${parts.join(', ')},\n    rows:${rowsStr} },`);
  }
}
process.stdout.write(out.join('\n') + '\n');
