/* Замер под КР-62 / КР-63: где лист детального расчёта расходится со сводом по статьям
   и какая доля расхождения объясняется ретро-правкой условий.
   Zero-DOM не выйдет — dateSheet живёт в buildLedger, поэтому берём тот же шов, что тесты
   макета (jsdom, mockups/loan-credit/tests/harness.mjs). Ничего не мутирует и не пишет.
     node scripts/inspect/credit-kr62-gap.mjs
   Замер 15.08.2026: 30 разделов из 51 расходятся, Σ 23 265,51; ретро-условия объясняют 2
   раздела (4 818,95), остальные 28 — период первой позиции (КР-63). */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const { load } = await import(resolve(HERE, '../../mockups/loan-credit/tests/harness.mjs'));

const { CR } = load();
const db = CR.db;
const pd = CR.pd;

/* Параметры, чья правка двигает НАЧИСЛЕНИЕ (пенные ставки и резерв сюда не входят). */
const ACCRUAL_KEYS = ['rate','dayMethod','freq','term','method',
                      'graceMain','graceInterest','graceAccrual','payDay'];

/* 1. Транши, у которых начисляющие условия менялись ПОСЛЕ даты договора. */
const retro = new Set();
for (const c of db.credits)
  for (const t of (c.tranches || []))
    if ((t.conditionRecords || []).some(r => r.effectiveFrom
        && pd(r.effectiveFrom) > pd(c.date) && ACCRUAL_KEYS.includes(r.param)))
      retro.add(c.id + '/т' + t.no);

/* 2. Расхождение разделов листа со сводом (gap = Σ отрезков − Σ начисленного по позициям). */
let sections = 0, gapped = 0, sumGap = 0;
const rows = [];
for (const c of db.credits){
  let led;
  try { led = CR.buildLedger(c, CR.TODAY); }
  catch (e){ console.log('!! ' + c.id + ': ' + e.message); continue; }
  for (const s of (led.dateSheet || [])){
    sections++;
    const key = c.id + '/т' + s.trancheNo;
    if (Math.abs(s.gap) <= 0.01) continue;
    gapped++; sumGap += s.gap;
    /* Разделяем причины: отрезки ВНЕ наступивших позиций (разный охват листа и свода)
       против расхождения на ОДНИХ И ТЕХ ЖЕ позициях (разный расчёт). */
    const pos = new Set(led.rows.filter(r => r.trancheNo === s.trancheNo).map(r => r.no));
    let matched = 0, tail = 0;
    for (const r of s.rows){
      const a = r.accrued || 0;
      if (r.posNo != null && pos.has(r.posNo)) matched += a; else tail += a;
    }
    rows.push({ key, gap:s.gap, sheet:s.sumInterest, ledger:s.ledgerInterest,
                tail, residual: Math.round((matched - s.ledgerInterest) * 100) / 100,
                retro: retro.has(key) });
  }
}

console.log('разделов листа (транш с графиком): ' + sections);
console.log('с расхождением >0,01: ' + gapped + ' | Σ gap: ' + sumGap.toFixed(2));

console.log('\nтоп-10 по |gap|:');
rows.slice().sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap)).slice(0, 10).forEach(r =>
  console.log(' ' + r.key.padEnd(12) + ' gap=' + r.gap.toFixed(2).padStart(11)
    + ' лист=' + r.sheet.toFixed(2).padStart(11) + ' свод=' + r.ledger.toFixed(2).padStart(11)
    + ' ретро-условия: ' + (r.retro ? 'ДА' : 'нет')));

const withRetro = rows.filter(r => r.retro), noRetro = rows.filter(r => !r.retro);
console.log('\nразрез по причине:');
console.log(' на траншах С ретро-правкой условий: ' + withRetro.length
  + ' | Σ ' + withRetro.reduce((a, r) => a + r.gap, 0).toFixed(2));
console.log(' на траншах БЕЗ ретро-правки: ' + noRetro.length
  + ' | Σ ' + noRetro.reduce((a, r) => a + r.gap, 0).toFixed(2));
console.log(' Σ хвоста (отрезки вне наступивших позиций): '
  + rows.reduce((a, r) => a + r.tail, 0).toFixed(2));
console.log(' разделов с расхождением НА ОДНИХ И ТЕХ ЖЕ позициях: '
  + rows.filter(r => Math.abs(r.residual) > 0.01).length);
console.log(' транши с ретро-правкой начисляющих условий: ' + ([...retro].join(', ') || '—'));

/* 3. Разбор образца: первая позиция графика против отрезков листа (КР-63). */
const sample = db.credits.find(x => x.id === 'K-B2');
if (sample){
  const led = CR.buildLedger(sample, CR.TODAY);
  const s = (led.dateSheet || []).find(x => x.trancheNo === 1);
  const t1 = sample.tranches.find(t => t.no === 1);
  console.log('\nK-B2/т1 — период первой позиции:');
  console.log(' освоения: ' + JSON.stringify((t1.disbursements || []).map(d => d.date + ':' + d.amount)));
  for (const r of (s ? s.rows : []))
    console.log('  ' + r.date + '→' + r.to + ' дней=' + String(r.days).padStart(4)
      + ' база=' + (r.base == null ? '—' : r.base.toFixed(2)).padStart(11)
      + ' ставка=' + (r.rate == null ? '—' : r.rate)
      + ' начислено=' + (r.accrued == null ? '—' : r.accrued.toFixed(2)).padStart(10)
      + ' позиция=' + (r.posNo == null ? '—' : r.posNo));
  for (const r of led.rows.filter(r => r.trancheNo === 1))
    console.log('  позиция ' + r.no + ' ' + r.date + ': свод=' + (r.interestAccrued || 0).toFixed(2)
      + ' контракт=' + (r.interestCtr || 0).toFixed(2) + ' надбавка=' + (r.interestExtra || 0).toFixed(2));
}
