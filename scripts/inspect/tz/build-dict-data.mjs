// build-dict-data.mjs — черновик DICTS из .auth/dict/_all.json (ручная чистка после)
import { readFileSync, writeFileSync } from 'node:fs';
const all = JSON.parse(readFileSync('.auth/dict/_all.json','utf8'));

// число колонок грида per-route (по заголовкам стенда; 1 = простой словарь)
const NCOLS = {
  'credit-order-states':1,'credit-order-types':1,'order-document-types':1,
  'entity-document-states':1,'entity-document-registered-bies':1,
  'document-package-states':1,'document-package-types':1,
  'applied-entity-list-states':1,'applied-entity-list-types':1,'applied-entity-states':1,
  'order-term-funds':1,'order-term-currencies':1,'loan-types':1,
  'industryDirections':2,'loan-credit-lines':1,'loan-type-repayment-accounts':1,
  'loan-grace-periods':1,'loan-percent-rates':1,'interest-rates':1,
  'order-term-floating-rate-types':1,'order-term-frequency-types':1,
  'order-term-rate-periods':1,'order-term-days-methods':1,'order-term-accr-methods':1,
  'order-term-transaction-orders':1,'agreement-templates':3,'agreement-template-codes':2,
  'collateralTypes':2,'employees':1,'commissions':4,'borrower-groups':1,
  'debtor-types':1,'work-sectors':1,'organization-forms':1,'loan-payment-capacity-groups':1,
  'loan-states':1,'loan-redemption-accounts':1,'loan-termses':1,'creditTerms':4,
  'calculationCoefficients':2,'installment-states':1,'payment-types':1,'good-types':1,
  'destination-accounts':1,'payment-purpose-requisites':2,
  'individuals':6,'organizations':4,
};
const R = new Set(['industryDirections','collateralTypes','commissions','creditTerms',
  'calculationCoefficients','individuals','organizations']);

const out = all.map(r => {
  const n = NCOLS[r.route] ?? 1;
  const cells = r.cellSample || [];
  const columns = cells.slice(0, n);
  const flat = cells.slice(n);
  const rows = [];
  for (let i = 0; i < flat.length; i += n) rows.push(flat.slice(i, i + n));
  return { route:r.route, title:r.title, archetype:R.has(r.route)?'R':'S',
           ncols:n, columns, rows, total:rows.length };
});
writeFileSync('.auth/dict-data.draft.json', JSON.stringify(out, null, 1));
console.log('dicts:', out.length, '→ .auth/dict-data.draft.json');
