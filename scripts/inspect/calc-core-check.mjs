// СМОУК ХРАНИМОГО расчётного ядра: журнал фиксаций (ADR-0136) и расчётная проекция
// (ADR-0192/0193/0196).
//
// Сторож зеркал (mirror-check.mjs) сверяет ДВИЖОК: канон против копий. Хранимое в зеркалах
// не живёт — оно собственный код ядра, и сверять его не с чем. Проверять его всё равно надо,
// потому что это единственное, что ядро ХРАНИТ: ошибка здесь не «посчиталось иначе», а
// «отчётность предъявлена, а чем — неизвестно».
//
// Проверяются не числа сида, а СВОЙСТВА, ради которых хранимое заведено:
//   журнал (1–7): охват периода · запрет фиксации без актора · append-only при
//     перезакрытии · ответ на закрытую дату ПЕРЕСЧЁТОМ, а не чтением записи · поимка
//     расхождения · начисленное за период как разность нарастающих итогов;
//   проекция (8): работа берётся из очереди · перенос записан дважды · одометры не
//     крутятся назад · чтение есть досчёт по скорости, а не второй расчёт · ведомость
//     сходится с ответом на дату на ОБОИХ концах · обращений столько, сколько форм вопроса;
//   списание (9): решение НАЗЫВАЕТ, свод снимает только ЧИСЛИВШЕЕСЯ, а разница предъявлена
//     своим именем. Хранимым не является, но и второго безбраузерного сторожа у швов нет,
//     а ячейка в минусе от чужого решения — ровно та ошибка, ради которой заведён этот файл.
// Zero-dep: макет исполняется в node:vm без DOM, как в mirror-check.mjs.
//   node scripts/inspect/calc-core-check.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dir = dirname(fileURLToPath(import.meta.url));
const rel = 'mockups/calc-core/calc-core.html';
const js = [...readFileSync(resolve(__dir, '../../', rel), 'utf8')
  .matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
const win = {}, sb = { window: win, console, setTimeout: () => {}, clearTimeout: () => {} };
vm.createContext(sb);
vm.runInContext(js, sb, { filename: rel });
const C = win.CALC;
if (!C || !C.fixatePeriod) { console.error('window.CALC.fixatePeriod не найден (' + rel + ')'); process.exit(1); }

let fail = 0;
const ok = (name, cond, note) => {
  if (!cond) fail++;
  console.log('  ' + (cond ? 'СОШЛОСЬ  ' : 'ПРОВАЛ   ') + name + (note ? '  · ' + note : ''));
};
const threw = fn => { try { fn(); return null; } catch (e) { return e.message; } };
const P = id => C.PERIODS.find(p => p.id === id);
const reset = () => { C.fixationsReset([]); C.calcReset(); };

const K4 = C.FIXTURE.find(c => c.id === 'K-4');      // действует, просрочка, платежей нет
const K6 = C.FIXTURE.find(c => c.id === 'K-6b');     // закрыт 15.05.2026 (списан РП-77)
const CACTOR = 'Тестовый бухгалтер';

/* ---- 1. ОХВАТ ПЕРИОДА ----------------------------------------------------------
   Фиксируется каждый кредит, действовавший в периоде ХОТЯ БЫ ДЕНЬ, включая закрытый
   внутри него: последняя запись закрытого кредита — единственное место, где видно, с
   чем он ушёл (легаси закрывал с сиротской копейкой, E2E-13/14). Кредит, закрытый ДО
   начала периода, и кредит, заключённый ПОСЛЕ его конца, не фиксируются. */
console.log('\n1. ОХВАТ');
reset();
const jan = C.fixatePeriod(C.FIXTURE, P('01.2026'), CACTOR, null).map(r => r.credit).sort();
ok('01.2026 — кредиты от 05.02.2026 не попали', !jan.includes('K-C1') && !jan.includes('K-C2'),
  jan.join(','));
reset();
const may = C.fixatePeriod(C.FIXTURE, P('05.2026'), CACTOR, null).map(r => r.credit);
ok('05.2026 — закрытый ВНУТРИ периода зафиксирован', may.includes('K-6b'),
  'K-6b закрыт 15.05.2026');
reset();
const jun = C.fixatePeriod(C.FIXTURE, P('06.2026'), CACTOR, null).map(r => r.credit);
ok('06.2026 — закрытый ДО начала не фиксируется', !jun.includes('K-6b'), jun.join(','));
ok('замирание начисления попало в запись', (() => {
  reset(); const r = C.fixatePeriod([K6], P('05.2026'), CACTOR, null)[0];
  return r && r.stopped === true;
})(), 'stopped=true у закрытого кредита');

/* ---- 2. ЯДРО НЕ ФИКСИРУЕТ САМО -------------------------------------------------
   В открытом периоде не хранится ничего (ИЯ-1), и шов чтения записей не создаёт: шов,
   умеющий фиксировать, позволил бы зафиксировать что угодно и когда угодно. */
console.log('\n2. КТО ПИШЕТ');
reset();
C.calcDebt(K4, '23.07.2026'); C.calcAccrual(K4, '23.07.2026'); C.calcFixation(K4, '07.2026');
ok('чтение швов записей не создаёт', C.fixationsAll().length === 0,
  'после calcDebt/calcAccrual/calcFixation в журнале ' + C.fixationsAll().length);
ok('фиксация без актора отклонена', /актора/.test(threw(() => C.fixatePeriod(C.FIXTURE, P('01.2026'), null, null)) || ''));
ok('фиксация без периода отклонена', /период/.test(threw(() => C.fixatePeriod(C.FIXTURE, null, CACTOR, null)) || ''));

/* ---- 3. APPEND-ONLY (ИЯ-12) ----------------------------------------------------
   Перезакрытие после распоряжения главбуха (ADR-0089) дописывает вторую запись, а не
   заменяет первую: по первой ушла отчётность. Действующая — последняя. */
console.log('\n3. APPEND-ONLY');
reset();
C.fixatePeriod([K4], P('03.2026'), CACTOR, null);
const first = C.activeFixation('K-4', '03.2026');
ok('повторное закрытие без распоряжения отклонено',
  /распоряжени/.test(threw(() => C.fixatePeriod([K4], P('03.2026'), CACTOR, null)) || ''));
ok('после отказа журнал не тронут', C.fixationsOf('K-4', '03.2026').length === 1);
C.fixatePeriod([K4], P('03.2026'), CACTOR, { order: 'РП-99', date: '20.07.2026' });
const two = C.fixationsOf('K-4', '03.2026');
ok('вторая запись встала рядом с первой', two.length === 2, 'seq ' + two.map(r => r.seq).join(','));
ok('первая запись цела', two[0].id === first.id && two[0].basis === null);
ok('действующая — последняя', C.activeFixation('K-4', '03.2026').seq === 2);
ok('у второй записи есть основание', (C.activeFixation('K-4', '03.2026').basis || {}).order === 'РП-99');

/* ---- 4. ЗАКРЫТАЯ ДАТА ОТВЕЧАЕТСЯ ПЕРЕСЧЁТОМ (ИЯ-13) ----------------------------
   Не чтением записи. Проверяется подменой: запись портится вручную, а ответ шва обязан
   остаться прежним — иначе ядро где-то читает хранимое вместо того, чтобы считать. */
console.log('\n4. ПЕРЕСЧЁТ, А НЕ ЧТЕНИЕ');
reset();
C.fixatePeriod([K4], P('03.2026'), CACTOR, null);
const before = C.calcDebt(K4, '15.03.2026').articles.principal.bal;
C.activeFixation('K-4', '03.2026').balance = 1;      // порча записи
C.calcReset();
const after = C.calcDebt(K4, '15.03.2026').articles.principal.bal;
ok('ответ не зависит от содержимого записи', before === after, before + ' = ' + after);
const mark = C.calcDebt(K4, '15.03.2026').period;
ok('порча записи поднята расхождением', mark && mark.mismatch === true);
ok('расхождение без основания — тревога', mark && mark.alarm === true);

/* ---- 5. ПОМЕТКА ПЕРИОДА НА ОТВЕТАХ ---------------------------------------------- */
console.log('\n5. ПОМЕТКА ПЕРИОДА');
reset();
ok('в открытом периоде фиксации нет',
  (C.calcDebt(K4, '23.07.2026').period || {}).status === 'открыт');
ok('вне календаря периодов пометки нет', C.calcDebt(K4, '31.12.2026').period === null,
  '31.12.2026 — за последним периодом');
ok('закрытый период БЕЗ записи помечен пробелом',
  (C.calcDebt(K4, '15.03.2026').period || {}).missing === true,
  'закрытие прошло мимо ядра');
ok('шов начисления несёт ту же пометку',
  (C.calcAccrual(K4, '15.03.2026').period || {}).period === '03.2026');

/* ---- 6. НАЧИСЛЕННОЕ ЗА ПЕРИОД = РАЗНОСТЬ НАРАСТАЮЩИХ ИТОГОВ ---------------------
   Отдельной арифметики «за период» в ядре нет: сумма по всем периодам обязана сойтись
   с итогом к концу последнего копейка в копейку, иначе свод и лист разойдутся. */
console.log('\n6. НАЧИСЛЕНО ЗА ПЕРИОД');
reset();
let acc = 0, last = null;
for (const p of C.PERIODS){
  if (p.status !== 'закрыт') continue;
  const r = C.fixatePeriod([K4], p, CACTOR, null)[0];
  if (!r) continue;
  acc = C.round2(acc + r.accrued.interest); last = p.to;
}
const cum = C.accruedTo(K4, last).interest;
ok('сумма по периодам = итог к концу последнего', acc === cum, acc + ' = ' + cum);

/* ---- 7. РАСХОЖДЕНИЕ ЛОВИТСЯ, А НЕ ПРАВИТСЯ -------------------------------------
   Сценарий стенда: обратный каскад ЦК по платежу от 10.02.2026 приходит в июле, когда
   февраль уже закрыт. Расхождение обязано подняться по ВСЕМУ хвосту закрытых периодов,
   а перезакрытие февраля обязано погасить только февраль. */
console.log('\n7. РАСХОЖДЕНИЕ (сценарий стенда)');
C.seedFixations();
const scan = (id) => {
  const out = { alarm: [], explained: [] };
  for (const p of C.PERIODS){
    if (p.status !== 'закрыт') continue;
    const chk = C.fixationCheck(C.FIXTURE.find(c => c.id === id), p);
    if (!chk || !chk.mismatch) continue;
    (chk.alarm ? out.alarm : out.explained).push(p.id);
  }
  return out;
};
const s = scan('K-4');
ok('февраль перезакрыт — расхождения нет', !s.alarm.includes('02.2026') && !s.explained.includes('02.2026'),
  'записей в 02.2026: ' + C.fixationsOf('K-4', '02.2026').length);
ok('хвост март…июнь горит', ['03.2026', '04.2026', '05.2026', '06.2026'].every(x => s.alarm.includes(x)),
  'тревог: ' + s.alarm.join(','));
ok('до февраля расхождений нет', !s.alarm.includes('01.2026') && !s.alarm.includes('12.2025'));
ok('чужие кредиты не задеты', ['K-7', 'K-C1', 'K-C2'].every(id => scan(id).alarm.length === 0));
const feb = C.fixationsOf('K-4', '02.2026');
ok('обе записи февраля читаются историей', feb.length === 2 && feb[0].balance !== feb[1].balance,
  feb.map(r => r.seq + ':' + r.balance).join(' → '));

/* ---- 8. ЧИСЛА ПРОЕКЦИИ (ADR-0192/0193/0196, ADR-0191, ADR-0194) ------------------
   Хранимое №2 — ПРОИЗВОДНАЯ, и своего числа у неё быть не может. Поэтому проверяются не
   величины сида, а тождества, на которых держится право хранить вывод. Пять тождеств
   чтения пересчитываются ЗДЕСЬ, своей арифметикой: сверять `projFold` его же выражением
   значило бы проверять, что равенство равно себе. */
console.log('\n8. ПРОЕКЦИЯ · ЧИСЛА');
const R2 = C.round2, PD = C.pd, DD = C.dd;
const MOVES = ['accrued', 'transferIn', 'repaid', 'writtenOff', 'transferOut'];
// чтение округляет до копейки, а моя арифметика — нет: сходимость проверяется с точностью
// до полукопейки (запас 0,0001 — на двоичную погрешность), а не до копейки.
const near = (a, b) => Math.abs(a - b) <= 0.0051;

C.projReset(); C.calcReset(); C.fixationsReset([]);
const run1 = C.projRun(C.FIXTURE, { on: C.TODAY });
ok('первый прогон взял весь портфель: строк проекции нет ни у кого',
  run1.credits.length === C.FIXTURE.length && run1.rows > 0,
  'кредитов ' + run1.credits.length + ', строк ' + run1.rows);
ok('после прогона очередь пуста — работа берётся из неё, а не перебором (ADR-0196)',
  C.projQueue(C.FIXTURE).length === 0);
const rowsAfter1 = C.projAll().length;
const run2 = C.projRun(C.FIXTURE, { on: C.TODAY });
ok('повторный прогон работы не находит и строк не добавляет',
  run2.credits.length === 0 && C.projAll().length === rowsAfter1,
  'взято ' + run2.credits.length + ', строк ' + C.projAll().length);

/* ОЧЕРЕДЬ — АНТИДЖОЙН ПО ОТПЕЧАТКУ ВХОДА, а не таблица заданий: правка факта возвращает
   кредит в работу сама, и ставить его туда некому. */
K4.mirror.court = K4.mirror.court || [];
const nCourt = K4.mirror.court.length;
K4.mirror.court.push({ date: '20.05.2026', kind: 'Решение суда', il: 'ИЛ-СТОРОЖ/8', amount: 300000 });
C.calcReset();
const queued = C.projQueue(C.FIXTURE).map(c => c.id);
ok('правка факта вернула в очередь ОДИН кредит', queued.length === 1 && queued[0] === 'K-4',
  queued.join(',') || 'очередь пуста');
const run3 = C.projRun(C.FIXTURE, { on: C.TODAY });
ok('прогон построил только его', run3.credits.length === 1 && run3.credits[0] === 'K-4');
const layersK4 = new Set(C.projRowsOf('K-4').map(r => r.layer));
ok('решение суда завело второй слой — перенос между ячейками есть', layersK4.size === 2,
  [...layersK4].join(' | '));

/* ТОЖДЕСТВО ПРОГОНА: переход между ячейками записан ДВАЖДЫ. Не сошлось — поколение не
   объявляется действующим: недостроенная проекция лучше построенной неверно. */
let gapWorst = 0;
for (const c of C.FIXTURE)
  gapWorst = Math.max(gapWorst, Math.abs(C.projTransferGap(C.projRowsOf(c.id))));
ok('Σ перенесено = Σ поступило переносом по каждому кредиту', gapWorst <= 0.005,
  'худшее ' + R2(gapWorst));

/* ОДОМЕТР НЕ КРУТИТСЯ НАЗАД. Пять потоков прихода и расхода считаются СУММОЙ по ячейкам
   кредита: перенос уносит поток из одной ячейки в другую, и по отдельной ячейке убывание
   законно, а по кредиту — нет. */
const sumFlows = (rows) => {
  const o = {}, last = new Map();
  for (const f of MOVES) o[f] = 0;
  for (const r of rows) last.set(r.layer + '|' + r.article, r);
  for (const r of last.values()) for (const f of MOVES) o[f] += r[f] || 0;
  return o;
};
const backwards = [];
for (const c of C.FIXTURE){
  const rows = C.projRowsOf(c.id).slice().sort((a, b) => PD(a.date) - PD(b.date));
  let prev = null;
  for (const d of [...new Set(rows.map(r => r.date))]){
    const cur = sumFlows(rows.filter(r => PD(r.date) <= PD(d)));
    if (prev) for (const f of MOVES)
      if (R2(cur[f] - prev[f]) < -0.005) backwards.push(c.id + ' ' + d + ' ' + f);
    prev = cur;
  }
}
ok('пять одометров движения не убывают ни на одной критической дате', backwards.length === 0,
  backwards.slice(0, 3).join(' · ') || 'кредитов проверено: ' + C.FIXTURE.length);

/* ДВЕ ПРОСРОЧКИ — НЕ ПОТОК, А СОСТОЯНИЕ ЯЧЕЙКИ, и перенос переносит его вместе с суммой:
   у источника оба счётчика обнуляются, у приёмника заводятся заново. Складывать их по
   кредиту поэтому нельзя — проверяются ПО ЯЧЕЙКЕ и только там, где убыль нечем объяснить.
   Объяснений ровно два: ячейка ПЕРЕДАЛА состояние вместе с суммой, либо график переписан
   КОРРЕКТИРУЮЩЕЙ ПОЗИЦИЕЙ — вступившая в силу реструктуризация возвращает переначисленное
   отрицательной позицией и снимает за ней разнесённое (К-7 на 01.06.2026: проценты −436,70
   и погашенное следом). Убыль без обеих причин — рывок назад у счётчика наступившего. */
const overdueBack = [], corrCache = new Map();
const corrective = (c, date) => {
  const k = c.id + '|' + date;
  if (!corrCache.has(k)) corrCache.set(k, C.buildLedger(c, date).rows
    .some(r => r.date === date && ((r.principalDue < -0.005) || (r.interestDue < -0.005))));
  return corrCache.get(k);
};
for (const c of C.FIXTURE){
  const byCell = new Map();
  for (const r of C.projRowsOf(c.id).slice().sort((a, b) => PD(a.date) - PD(b.date))){
    const k = r.layer + '|' + r.article, prev = byCell.get(k);
    byCell.set(k, r);
    if (!prev || r.transferOut - prev.transferOut > 0.005 || corrective(c, r.date)) continue;
    for (const f of ['toOverdue', 'fromOverdue'])
      if (R2(r[f] - prev[f]) < -0.005)
        overdueBack.push(c.id + ' ' + r.date + ' ' + r.article + '/' + r.layer + ' ' + f
          + ' ' + R2(prev[f]) + '→' + R2(r[f]));
  }
}
ok('счётчики просрочки не убывают без переноса и без корректирующей позиции',
  overdueBack.length === 0,
  overdueBack.slice(0, 3).join(' · ') || 'ячеек проверено на всех датах');

/* ПЯТЬ ТОЖДЕСТВ ЧТЕНИЯ И ДОСЧЁТ ПО СКОРОСТИ — своей арифметикой, по хранимым строкам. */
const CHECK_DAYS = ['01.03.2026', '15.05.2026', C.TODAY];
const foldBad = [], speedBad = [], negative = [];
const d5Of = (c, day) => { const k = C.projCheck(c, day); return k.refused ? 0 : (k.d5 || 0); };
for (const c of C.FIXTURE) for (const day of CHECK_DAYS){
  const read = C.projRead(c, day);
  if (read.refused) continue;
  const last = new Map();
  for (const r of C.projRowsOf(c.id).filter(r => PD(r.date) <= PD(day)))
    last.set(r.layer + '|' + r.article, r);
  for (const cell of read.cells){
    const r = last.get(cell.layer + '|' + cell.article);
    if (!r){ foldBad.push(c.id + ' ' + day + ' ячейки нет в строках'); continue; }
    const days    = DD(PD(r.date), PD(day));
    const accrued = r.accrued + r.perDay * days;
    const toOver  = r.toOverdue + r.perDayOverdue * days;
    const balance = accrued + r.transferIn - r.repaid - r.writtenOff - r.transferOut;
    const overdue = toOver - r.fromOverdue;
    const off = [];
    if (cell.days !== days) off.push('дней ' + cell.days + '≠' + days);
    if (!near(cell.accrued, accrued)) off.push('начислено ' + cell.accrued + '≠' + R2(accrued));
    if (!near(cell.balance, balance)) off.push('остаток ' + cell.balance + '≠' + R2(balance));
    if (!near(cell.overdue, overdue)) off.push('просрочено ' + cell.overdue + '≠' + R2(overdue));
    if (!near(cell.term, balance - overdue)) off.push('срочное ' + cell.term + '≠' + R2(balance - overdue));
    if (off.length)
      foldBad.push(c.id + ' ' + day + ' ' + cell.article + '/' + cell.layer + ' (' + off.join('; ') + ')');
    /* СКОРОСТЬ УХОДА В ПРОСРОЧКУ НЕ БЫСТРЕЕ СКОРОСТИ НАЧИСЛЕНИЯ: требовать больше, чем
       начислено, нельзя. Обратное — норма и записано решением: под судом пеня начисляется,
       а требовать её нельзя (ADR-0043), и там скорость ухода ноль при ненулевом начислении. */
    if (r.perDayOverdue - r.perDay > 0.005)
      speedBad.push(c.id + ' ' + r.date + ' ' + cell.article + ': уход ' + R2(r.perDayOverdue)
        + '/дн при начислении ' + R2(r.perDay) + '/дн');
    /* ОСТАТОК ЯЧЕЙКИ НЕ УХОДИТ В МИНУС: погасить, списать и перенести больше начисленного
       нельзя. Объявленное расхождение форм (Д-5) вычитается ИМЕНЕМ, как в `projCheck`: оно
       сидит целиком в процентах, и уводить ячейку на свою величину имеет право. */
    if (cell.balance < -0.005 - (cell.article === 'interest' ? Math.abs(d5Of(c, day)) : 0))
      negative.push(c.id + ' ' + day + ' ' + cell.article + '/' + cell.layer + ' ' + cell.balance);
  }
}
ok('пять тождеств чтения и досчёт по скорости сходятся на трёх датах', foldBad.length === 0,
  foldBad.slice(0, 3).join(' · ') || 'ячейки сверены на ' + CHECK_DAYS.length + ' датах');
ok('уход в просрочку не быстрее начисления', speedBad.length === 0,
  speedBad.slice(0, 2).join(' · ') || 'скорости сверены по всем ячейкам');
ok('ни одна ячейка не ушла в минус', negative.length === 0,
  negative.slice(0, 3).join(' · ') || 'остатки неотрицательны на трёх датах');

/* СВЕРКА СО ШВОМ 2 — по ВСЕМУ сиду, а не на одном кредите: проекция хранит вывод шва, а
   не второй расчёт. Объявленное Д-5 вычитается ИМЕНЕМ и в допуск не входит. */
const chkBad = [];
let chkWorst = 0;
for (const c of C.FIXTURE){
  const chk = C.projCheck(c, C.TODAY);
  if (chk.refused){ chkBad.push(c.id + ': ' + chk.refused); continue; }
  chkWorst = Math.max(chkWorst, chk.worst);
  if (!chk.agrees) chkBad.push(c.id + ' ' + chk.worst);
}
ok('проекция сходится со швом 2 по всем кредитам сида', chkBad.length === 0,
  chkBad.join(' · ') || 'худшее ' + R2(chkWorst));

/* ВЕДОМОСТЬ СХОДИТСЯ С ОТВЕТОМ НА ДАТУ НА ОБОИХ КОНЦАХ (ИЯ-17) — тот самый шов, на
   котором «кредита ещё не было» равнялось отказу и роняло обе границы разом. */
const PFROM = '01.02.2026', PTO = '30.06.2026';
const at0 = C.calcPortfolio(C.FIXTURE, { on: PFROM }).body;
const at1 = C.calcPortfolio(C.FIXTURE, { on: PTO }).body;
const per = C.calcPortfolio(C.FIXTURE, { from: PFROM, to: PTO }).body;
ok('сальдо на начало = ответ на дату начала', near(per.total.open, at0.total.balance),
  per.total.open + ' = ' + at0.total.balance);
ok('сальдо на конец = ответ на дату конца', near(per.total.close, at1.total.balance),
  per.total.close + ' = ' + at1.total.balance);
ok('невязка «начало + обороты = конец» нулевая по каждой статье',
  per.articles.every(r => Math.abs(r.gap) <= 0.005) && Math.abs(per.total.gap) <= 0.005,
  'итог ' + per.total.gap);
ok('кредит, выданный внутри периода, не «выпал», а появился',
  per.counts.dropped === 0 && per.counts.added > 0,
  'выпало ' + per.counts.dropped + ', появилось ' + per.counts.added);

/* ОБРАЩЕНИЙ — ПО ФОРМЕ ВОПРОСА, А НЕ ПО РАЗМЕРУ ОТБОРА (ADR-0191 §4, ADR-0194 §4). */
const qOf = (opts, sel) => C.calcPortfolio(sel || C.FIXTURE, opts).body.queries;
const one = [C.FIXTURE.find(c => c.id === 'K-7')];
const qAt = qOf({ on: C.TODAY }), qPer = qOf({ from: PFROM, to: PTO }),
      qCut = qOf({ from: PFROM, to: PTO, by: 'unit' });
ok('на дату — 2 обращения, за период — 3, период с разрезом — 4',
  qAt === 2 && qPer === 3 && qCut === 4, qAt + ' · ' + qPer + ' · ' + qCut);
ok('тот же вопрос на отборе из одного кредита стоит столько же',
  qOf({ on: C.TODAY }, one) === qAt && qOf({ from: PFROM, to: PTO, by: 'unit' }, one) === qCut,
  'отбор 1 против ' + C.FIXTURE.length);
ok('дата и период вместе — не вопрос, а два вопроса',
  /датой ИЛИ периодом/.test(threw(() => C.calcPortfolio(C.FIXTURE, { on: C.TODAY, from: PFROM })) || ''));

/* ПЕРЕДАЧА ПРИ СМЕНЕ ПРИЗНАКА — ОБОРОТ РАЗРЕЗА, А НЕ ПОРТФЕЛЯ: сколько одно значение
   передало, столько другое приняло, и по портфелю они гасят друг друга. */
const cut = C.calcPortfolio(C.FIXTURE, { from: '01.05.2026', to: '31.05.2026', by: 'unit' }).body;
ok('Σ передано = Σ принято по разрезу, и передача не пустая',
  near(cut.handed, cut.taken) && cut.handed > 0.005,
  'передано ' + cut.handed + ', принято ' + cut.taken);
ok('сальдо разреза складывается в портфельное',
  near(cut.cuts.reduce((a, g) => a + g.total.close, 0), cut.total.close),
  R2(cut.cuts.reduce((a, g) => a + g.total.close, 0)) + ' = ' + cut.total.close);
ok('признак без истории помечен ПЛОСКИМ, а не выдан за отрезковый',
  C.calcPortfolio(C.FIXTURE, { from: PFROM, to: PTO, by: 'program' }).body.cuts.every(g => g.flat === true));
ok('незаведённый разрез отклонён, а не отвечен пустотой',
  /не заведён/.test(threw(() => C.calcPortfolio(C.FIXTURE, { on: C.TODAY, by: 'погода' })) || ''));

/* ПЕРЕСТРОЕНИЕ — НАЗВАННЫЙ ОТКАЗ, А НЕ МОЛЧАЛИВЫЙ НОЛЬ (ADR-0089, ИЯ-14). */
const totalBefore = C.calcPortfolio(C.FIXTURE, { on: C.TODAY }).body.total.balance;
const k7Before = C.calcPortfolio(one, { on: C.TODAY }).body.total.balance;
C.projOrderRebuild('K-7', CACTOR, 'РП-101');
const readK7 = C.projRead('K-7', C.TODAY);
const pfR = C.calcPortfolio(C.FIXTURE, { on: C.TODAY }).body;
ok('назначенное перестроение отказывает НАЗВАННОЙ причиной',
  /перестроение/.test(readK7.refused || ''), readK7.refused);
ok('в своде кредит выпал причиной и распоряжением, а не нулём',
  pfR.counts.dropped === 1 && /перестроение/.test((pfR.dropped[0] || {}).reason || '')
  && (pfR.dropped[0] || {}).order === 'РП-101');
ok('итог уменьшился ровно на его остаток', near(totalBefore - pfR.total.balance, k7Before),
  R2(totalBefore - pfR.total.balance) + ' = ' + k7Before);
ok('перестроение без актора невозможно',
  /актора/.test(threw(() => C.projOrderRebuild('K-7', null, 'РП-102')) || ''));

/* ПОКОЛЕНИЕ ОБЪЯВЛЯЕТСЯ ОДНИМ ДЕЙСТВИЕМ, И НЕДОСТРОЕННОЕ НЕ ЧИТАЕТСЯ. */
const genBefore = C.projState().gen;
const staged = C.projRun(C.FIXTURE, { on: C.TODAY, all: true, stage: true });
ok('построенное с `stage` не переключает чтение', C.projState().gen === genBefore,
  'действующее ' + C.projState().gen + ', построено ' + staged.gen);
C.projPublish(staged.gen);
ok('публикация переключает чтение одним действием', C.projState().gen === staged.gen);
ok('прогон снял перестроение — отказ ушёл вместе с работой',
  !/перестроение/.test(C.projRead('K-7', C.TODAY).refused || ''));

/* ОТСУТСТВИЕ — НЕ НЕИЗВЕСТНОСТЬ И НЕ ПОТЕРЯ (ИЯ-17). Ожидание не вписано числом, а
   выведено из факта: кредита в портфеле нет ровно до первого освоения — договор без
   выдачи денег остатка не имеет (ADR-0105). */
const early = C.calcPortfolio(C.FIXTURE, { on: '01.01.2026' }).body;
const unborn = C.FIXTURE.filter(c => (c.tranches || [])
  .reduce((a, t) => a + C.disbursedTo(t, '01.01.2026'), 0) <= 0.005).map(c => c.id);
ok('до рождения кредит помечен «его не было», а не выпавшим',
  early.counts.absent === unborn.length && early.counts.dropped === 0
  && unborn.every(id => (early.absent || []).includes(id)),
  'не было ' + early.counts.absent + ' (' + unborn.join(',') + '), выпало ' + early.counts.dropped);
ok('дата позже горизонта прогона отдана прогнозу названной причиной',
  /горизонт/.test(C.projRead('K-4', '31.12.2026').refused || ''));

K4.mirror.court.length = nCourt; C.calcReset();

/* ---- 9. СПИСАНИЕ · СНЯТО, А НЕ НАЗВАНО (КВ-63) --------------------------------
   Решение о безнадёжности НАЗЫВАЕТ сумму по статье, но снять может только то, что по
   статье ЧИСЛИЛОСЬ. Срез стоит в своде (`debtOf`), а не в листе: у тела позиции будущих
   сроков носителя не имеют вовсе (K-C34/K-C36 фикстуры кредитного модуля), и срез по
   листу обнулял бы законное списание. Излишек не исчезает и задним числом не
   досписывается — это ВЕЛИЧИНА СО СВОИМ ИМЕНЕМ, по образцу переплаты. Без среза свод
   прятал излишек через `Math.max(0, …)`, а безветочная проекция (ADR-0193) показывала
   ячейку в МИНУСЕ: у К-6б решение назвало 80 329,51 пени при 63 553,86 числившихся. */
console.log('\n9. СПИСАНИЕ');
const ARTS9 = ['principal', 'interest', 'penalty', 'accInterest', 'accPenalty', 'fees'];
const withOff = C.FIXTURE.map(c => C.calcBase(c, C.TODAY))
  .filter(b => ARTS9.some(k => Math.abs((b.led.writtenOffArt || {})[k] || 0) > 0.005));
ok('решение не теряется: снятое + излишек = названное по каждой статье',
  withOff.length > 0 && withOff.every(b => ARTS9.every(k =>
    near((b.debt[k].written || 0) + (b.debt.writeOffExcess[k] || 0), b.led.writtenOffArt[k] || 0))),
  'кредитов с решением ' + withOff.length);
ok('снято столько, сколько числилось, а не сколько названо',
  withOff.every(b => ARTS9.every(k => (b.debt[k].written || 0) <= R2(
    k === 'principal' ? (b.disbursed || 0) - b.debt[k].paid
                      : (b.debt[k].accrued || 0) - b.debt[k].paid) + 0.0051)),
  'проверены все шесть статей');
const H6 = C.calcBase(K6, C.TODAY);
ok('К-6б: пеня снята на 63 553,86 при названных 80 329,51',
  near(H6.debt.penalty.written, 63553.86) && near(H6.led.writtenOffArt.penalty, 80329.51),
  'снято ' + H6.debt.penalty.written + ' из названных ' + H6.led.writtenOffArt.penalty);
ok('излишек назван своим именем, а не оставлен разностью',
  near(H6.debt.writeOffExcess.penalty, 16775.65) && near(H6.debt.writeOffExcess.total, 16775.65),
  'излишек ' + H6.debt.writeOffExcess.total);
ok('ячейка не ушла в минус от того, что решение назвало больше',
  H6.debt.penalty.bal >= -0.005 && ARTS9.every(k => H6.debt[k].bal >= -0.005),
  'остаток пени ' + H6.debt.penalty.bal);
const S2 = C.calcDebt(K6, C.TODAY);
ok('шов 2 отдаёт СНЯТОЕ, а не названное, и излишек рядом',
  near(S2.writtenOff, H6.debt.principal.written) && near(S2.writeOffExcess, 16775.65),
  'снято ' + S2.writtenOff + ', излишек ' + S2.writeOffExcess);
const FX6 = C.fixationValue(K6, P('05.2026'));
ok('фиксация закрытого периода несёт обе величины',
  near(FX6.writtenOff, H6.debt.principal.written) && FX6.writeOffExcess > 0.005,
  'снято ' + FX6.writtenOff + ', излишек ' + FX6.writeOffExcess);
C.calcReset();

console.log('\nХРАНИМОЕ · ' + (fail ? fail + ' проверок провалено' : 'все проверки сошлись'));
process.exit(fail ? 1 : 0);
