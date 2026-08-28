// СТОРОЖ КАНОНА И ЗЕРКАЛ РАСЧЁТНОГО ЯДРА (ADR-0135).
//
// Макеты репозитория однофайловые — физически общего кода между ними быть не может.
// Значит выбор не «шарить или дублировать», а «дублировать молча или дублировать
// помеченно и под сторожем». Канон — mockups/calc-core/calc-core.html, блок между
// маркерами `<<< mirror:calc-core >>>`. Зеркала:
//   mockups/loan-credit/credit.html          — те же имена; сверяются ТЕКСТОМ объявлений
//                                              и ЧИСЛАМИ на всём сиде (кредиты × 3 даты);
//   mockups/restructuring/restructuring.html — имена свои (RS.amortize и своя механика
//                                              периода); текстом не сверить, поэтому
//                                              только ЧИСЛАМИ на 13 условиях (бывший
//                                              cross-engine-check.mjs, теперь против канона).
//
// Падает на первом расхождении: правка движка начинается в каноне и зеркалится,
// обратный порядок сторож увидит, но уже как расхождение.
//   node scripts/inspect/mirror-check.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dir = dirname(fileURLToPath(import.meta.url));
const abs = rel => resolve(__dir, '../../', rel);
const scripts = rel => [...readFileSync(abs(rel), 'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map(m => m[1]).join('\n');
const load = (rel, key) => {
  const win = {}, sb = { window: win, console, setTimeout: () => {}, clearTimeout: () => {} };
  vm.createContext(sb);
  vm.runInContext(scripts(rel), sb, { filename: rel });
  if (!win[key]) { console.error('window.' + key + ' не инициализирован (' + rel + ')'); process.exit(1); }
  return win[key];
};

/* ---- разбор объявлений ---------------------------------------------------------
   Стиль макетов: `function NAME(` и `const NAME =` в нулевой колонке. Конец объявления
   ищется БАЛАНСОМ СКОБОК по очищенному тексту — без комментариев, литералов и регулярок.
   Построчные эвристики («первая `}` в нулевой колонке») склеивают соседей: однострочная
   `function activeTranche(t){ return !t.closed; }` проглатывает следующие 200 строк. */
function declMap(js){
  const blanked = js.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  const clean = L => L
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\[\s\S]|[^`\\])*`/g, '``')
    .replace(/([=(,:[]\s*)\/[^/\n*][^/\n]*\/[gimsuy]*/g, '$1 ');
  const lines = js.split('\n'), src2 = blanked.split('\n').map(clean);
  const startRe = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/;
  const constRe = /^const\s+([A-Za-z_$][\w$]*)\s*=/;
  const end = i => {
    let bal = 0;
    for (let j = i; j < lines.length && j < i + 2000; j++){
      for (const ch of src2[j]){
        if (ch === '{' || ch === '(' || ch === '[') bal++;
        else if (ch === '}' || ch === ')' || ch === ']') bal--;
      }
      if (bal <= 0) return j;                       // ноль в конце строки = объявление закрылось
    }
    return i;
  };
  const out = new Map();
  for (let i = 0; i < lines.length; i++){
    const m = src2[i].match(startRe) || src2[i].match(constRe);
    if (!m || out.has(m[1])) continue;
    out.set(m[1], lines.slice(i, end(i) + 1).join('\n'));
  }
  return out;
}
/* Сверяется ТЕЛО, а не буквы: комментарий у зеркала может говорить о карточке, у канона —
   о ядре, и это не расхождение движка. Расхождение комментариев видно глазами в дифе;
   расхождение кода не видно никак — за него и держится сторож. */
const body = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
  .split('\n').map(s => s.trim()).filter(Boolean).join('\n');

let fail = 0;

/* ---- 1. ТЕКСТ: канон против credit.html --------------------------------------- */
const canonJs = (() => {
  const all = scripts('mockups/calc-core/calc-core.html');
  const a = all.indexOf('<<< mirror:calc-core >>>'), b = all.indexOf('<<< /mirror:calc-core >>>');
  if (a < 0 || b < 0) { console.error('маркеры канона не найдены в calc-core.html'); process.exit(1); }
  return all.slice(a, b);
})();
const CANON = declMap(canonJs), MIRROR = declMap(scripts('mockups/loan-credit/credit.html'));
const missing = [], diverged = [];
for (const [name, text] of CANON){
  const m = MIRROR.get(name);
  if (!m) { missing.push(name); continue; }
  if (body(m) !== body(text)) diverged.push(name);
}
console.log('ТЕКСТ · объявлений в каноне ' + CANON.size + ' · нет в зеркале ' + missing.length
  + ' · разошлось ' + diverged.length);
for (const n of missing)  console.log('  НЕТ В ЗЕРКАЛЕ  ' + n + '  (credit.html)');
for (const n of diverged) console.log('  РАЗОШЛОСЬ      ' + n + '  (credit.html)');
if (missing.length || diverged.length) fail = 1;

/* ---- 2. ЧИСЛА: канон против credit.html на всём сиде ---------------------------
   Текст сверяет буквы, числа — смысл: зеркало могли поправить «эквивалентно», и только
   прогон на живых кредитах скажет, эквивалентно ли. Зонды зовут функции ТАК ЖЕ, как их
   зовёт карточка (лист, а не кредит первым аргументом): иначе сверялись бы две
   одинаковые ошибки и совпадение ничего не доказывало бы. */
const CALC = load('mockups/calc-core/calc-core.html', 'CALC');
const CR   = load('mockups/loan-credit/credit.html', 'CR');
const ser = v => JSON.stringify(v, (k, x) => x instanceof Map ? { __map: [...x] }
  : x instanceof Set ? { __set: [...x] } : x);
const disb = (M, c) => (c.tranches || []).reduce((a, t) => a + M.disbursedSum(t), 0);
const DATES = ['23.07.2026', '01.01.2026', '31.12.2026'];
const PROBES = [
  ['buildLedger',         (M, c, d) => M.buildLedger(c, d)],
  ['debtOf',              (M, c, d) => M.debtOf(M.buildLedger(c, d), disb(M, c))],
  ['debtArticlesOf',      (M, c, d) => M.debtArticlesOf(M.debtOf(M.buildLedger(c, d), disb(M, c)))],
  ['overdueOf',           (M, c, d) => M.overdueOf(M.buildLedger(c, d))],
  ['buildQueue',          (M, c, d) => M.buildQueue(c, M.buildLedger(c, d))],
  ['feeAccrual',          (M, c, d) => M.feeAccrual(c, d)],
  ['paidPool',            (M, c, d) => M.paidPool(c, d)],
  ['forecastByMonth',     (M, c, d) => M.forecastByMonth(c, M.buildLedger(c, d).index, d)],
  ['trancheForecastRows', (M, c, d) => (c.tranches || []).map(t =>
                            M.trancheForecastRows(c, t, M.buildLedger(c, d).index, d))],
  ['scheduleAt',          (M, c, d) => (c.tranches || []).map(t => M.scheduleAt(t, d))],
  ['nextPaymentOf',       (M, c, d) => M.nextPaymentOf(c, M.buildLedger(c, d).index, d)],
  // сетка критических дат наружу у credit.html не выведена (её нет в window.CR), поэтому
  // обоим движкам подаётся сетка канона: сверяется начисление, а сама сетка — через
  // buildLedger, который строит её внутри
  ['trancheAccrual',      (M, c, d) => (c.tranches || []).map(t =>
                            M.trancheAccrual(c, t, d, CALC.calcGrid(c, d)))],
];
const credits = (CR.seedDb().credits) || [];
let checks = 0, bad = 0; const shown = new Set();
for (const c of credits) for (const d of DATES) for (const [name, fn] of PROBES){
  let a, b, ea = null, eb = null;
  try { a = ser(fn(CR, c, d)); } catch (e) { ea = e.message; }
  try { b = ser(fn(CALC, c, d)); } catch (e) { eb = e.message; }
  checks++;
  if (ea || eb){
    if (ea === eb) continue;                       // одинаково упали — расхождения нет
    bad++;
    if (!shown.has(name + '!')){ shown.add(name + '!');
      console.log('  ИСКЛЮЧЕНИЕ ' + name + ' · ' + (c.no || c.id) + ' · ' + d
        + '\n     канон: ' + eb + '\n     зеркало: ' + ea); }
    continue;
  }
  if (a !== b){ bad++;
    if (!shown.has(name)){ shown.add(name);
      console.log('  РАЗОШЛОСЬ ' + name + ' · кредит ' + (c.no || c.id) + ' · ' + d); } }
}
console.log('ЧИСЛА · credit.html · кредитов ' + credits.length + ' · сверок ' + checks
  + ' · расхождений ' + bad);
if (bad) fail = 1;

/* ---- 3. ЧИСЛА: канон против restructuring.html на 13 условиях -------------------
   Приложение к ДС — контракт (РС-9): график, который утверждает комитет, обязан совпасть
   строка в строку с тем, что построит кредит после регистрации ДС. */
const RS = load('mockups/restructuring/restructuring.html', 'RS');
const ru  = s => s.slice(8) + '.' + s.slice(5, 7) + '.' + s.slice(0, 4);
const iso = s => s.slice(6) + '-' + s.slice(3, 5) + '-' + s.slice(0, 2);
const BASE = 701306.83, FROM = '2026-07-19',
      D = { rate: 9, freq: 'ежемесячно', method: 'аннуитет', dayMethod: 'факт/365' };
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
let badCases = 0;
for (const [name, cnd] of CASES){
  const mine = RS.amortize(BASE, cnd, FROM, []).rows;
  // Кредит читает условия с транша журналом записей {param,value,effectiveFrom} — внутренняя
  // форма его журнала; общий у модулей шов — не она, а вокабуляр условий.
  const tranche = { id: 'X', no: 'X', amount: BASE, ops: [],
    conditionRecords: Object.keys(cnd).map(k => ({ param: k, value: cnd[k], effectiveFrom: '01.01.2020' })) };
  const built = CALC.buildSchedule(tranche, ru(FROM));
  const rows = Array.isArray(built) ? built : (built && built.rows) || [];
  const key = (r, toIso) => [toIso ? iso(r.date) : r.date, r.principal, r.interest].join(' ');
  const A = mine.map(r => key(r, false)), B = rows.map(r => key(r, true));
  const same = A.length === B.length && A.every((x, i) => x === B[i]);
  if (!same){
    badCases++;
    console.log('  РАЗОШЛОСЬ ' + name.padEnd(30) + ' строк ' + A.length + '/' + B.length);
    for (let i = 0, k = 0; i < Math.max(A.length, B.length) && k < 3; i++)
      if (A[i] !== B[i]){ console.log('     #' + (i + 1) + '  зеркало: ' + (A[i] || '—')
        + '   канон: ' + (B[i] || '—')); k++; }
  }
}
console.log('ЧИСЛА · restructuring.html · ' + (CASES.length - badCases) + '/' + CASES.length + ' совпало');
if (badCases) fail = 1;

console.log('\nЗЕРКАЛА · ' + (fail ? 'РАСХОЖДЕНИЕ — правь канон и зеркаль' : 'сошлись'));
process.exit(fail);
