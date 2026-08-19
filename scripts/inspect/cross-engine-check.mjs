// Сверка ДВУХ движков графика на одних условиях: черновик реструктуризации (RS.amortize,
// mockups/restructuring/restructuring.html) против контракта кредитного модуля
// (CR.buildSchedule, mockups/loan-credit/credit.html). Ради этого совпадения механика
// buildSchedule и переносилась в расчёт: приложение к ДС — контракт (РС-9), и график, который
// утверждает комитет, обязан совпасть со строкой в строку с тем, что кредит построит после
// регистрации ДС. Расхождение здесь = комитет одобрил одно, заёмщик получил другое.
// Zero-dep: оба макета исполняются в node:vm без DOM, как в restructuring-check.mjs.
//   node scripts/inspect/cross-engine-check.mjs
//
// С 19.08.2026 эта проверка — ПОДМНОЖЕСТВО сторожа зеркал: те же 13 условий графика
// прогоняются в scripts/inspect/mirror-check.mjs против канона движка
// (mockups/calc-core/calc-core.html, ADR-0135), где сверяется ещё и текст объявлений, и
// весь сид числами. Файл оставлен до волны уборки — он назван в журналах волн кредита и
// реструктуризации; снимать его заодно с выносом ядра значило бы менять две вещи одним
// движением (mockups/calc-core/ASUBK-status-razrabotki.md, «Что осталось расходиться», п. 3).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dir = dirname(fileURLToPath(import.meta.url));
const load = (rel, key) => {
  const path = resolve(__dir, '../../', rel);
  const js = [...readFileSync(path, 'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
  const win = {};
  const sb = { window: win, console, setTimeout: () => {}, clearTimeout: () => {} };
  vm.createContext(sb);
  vm.runInContext(js, sb, { filename: rel });
  if (!win[key]) { console.error('window.' + key + ' не инициализирован (' + rel + ')'); process.exit(1); }
  return win[key];
};
const RS = load('mockups/restructuring/restructuring.html', 'RS');
const CR = load('mockups/loan-credit/credit.html', 'CR');

// Кредитный модуль живёт в датах ДД.ММ.ГГГГ, реструктуризация — в ISO: равняем на границе.
const ru = s => s.slice(8) + '.' + s.slice(5, 7) + '.' + s.slice(0, 4);
const iso = s => s.slice(6) + '-' + s.slice(3, 5) + '-' + s.slice(0, 2);

const BASE = 701306.83, FROM = '2026-07-19', D = { rate: 9, freq: 'ежемесячно', method: 'аннуитет', dayMethod: 'факт/365' };
const CASES = [
  ['аннуитет, 24 мес.',            { ...D, term: 24 }],
  ['равными долями, кварталы',     { ...D, term: 24, freq: 'ежеквартально', method: 'равными долями' }],
  ['в конце срока',                { ...D, term: 12, method: 'в конце срока' }],
  ['раз в полгода',                { ...D, term: 36, freq: 'раз в полгода' }],
  ['день платежа 15',              { ...D, term: 12, payDay: 15 }],
  ['привязка к 1-му платежу',      { ...D, term: 12, payDay: 15, lastPaymentAnchor: 'по дате 1-го платежа' }],
  ['льгота по ОД 3 мес.',          { ...D, term: 24, graceMain: 3 }],
  ['отсрочка начисления 3 мес.',   { ...D, term: 24, graceAccrual: 3 }],
  ['льгота по % 2 мес., окно 3–8', { ...D, term: 24, graceInterest: 2, graceIntDistFrom: 3, graceIntDistTo: 8 }],
  ['три льготы разом',             { ...D, term: 36, graceMain: 6, graceAccrual: 2, graceInterest: 4 }],
  ['день-база 30/360',             { ...D, term: 12, dayMethod: '30/360' }],
  ['день-база факт/факт',          { ...D, term: 12, dayMethod: 'факт/факт' }],
  ['нулевая ставка',               { ...D, term: 12, rate: 0 }],
];

let bad = 0;
for (const [name, cnd] of CASES) {
  const mine = RS.amortize(BASE, cnd, FROM, []).rows;
  // Кредит читает условия с транша журналом записей {param,value,effectiveFrom} — внутренняя
  // форма его журнала; общий у модулей шов — не она, а ds.conditions того же вокабуляра.
  const tranche = { id: 'X', no: 'X', amount: BASE, ops: [],
    conditionRecords: Object.keys(cnd).map(k => ({ param: k, value: cnd[k], effectiveFrom: '01.01.2020' })) };
  const theirs = CR.buildSchedule(tranche, ru(FROM));
  const rows = Array.isArray(theirs) ? theirs : (theirs && theirs.rows) || [];
  const key = (r, toIso) => [toIso ? iso(r.date) : r.date, r.principal, r.interest].join(' ');
  const A = mine.map(r => key(r, false)), B = rows.map(r => key(r, true));
  const same = A.length === B.length && A.every((x, i) => x === B[i]);
  if (!same) bad++;
  console.log((same ? '  СОВПАЛ    ' : '  РАЗОШЁЛСЯ ') + name.padEnd(30) + ' строк ' + A.length + '/' + B.length);
  if (!same) for (let i = 0, shown = 0; i < Math.max(A.length, B.length) && shown < 3; i++) {
    if (A[i] !== B[i]) { console.log('     #' + (i + 1) + '  расчёт: ' + (A[i] || '—') + '   кредит: ' + (B[i] || '—')); shown++; }
  }
}
console.log('\nДВИЖКИ · ' + (CASES.length - bad) + '/' + CASES.length + ' совпало' + (bad ? ' — черновик разойдётся с контрактом' : ''));
process.exit(bad ? 1 : 0);
