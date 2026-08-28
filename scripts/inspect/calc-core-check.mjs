// СМОУК ЖУРНАЛА ФИКСАЦИЙ расчётного ядра (ADR-0136).
//
// Сторож зеркал (mirror-check.mjs) сверяет ДВИЖОК: канон против копий. Фиксация в зеркалах
// не живёт — она собственный код ядра, и сверять её не с чем. Проверять её всё равно надо,
// потому что она единственное, что ядро ХРАНИТ: ошибка здесь не «посчиталось иначе», а
// «отчётность предъявлена, а чем — неизвестно».
//
// Проверяются не числа сида, а СВОЙСТВА, ради которых журнал заведён:
//   охват периода · запрет фиксации без актора · append-only при перезакрытии ·
//   ответ на закрытую дату ПЕРЕСЧЁТОМ, а не чтением записи · поимка расхождения ·
//   начисленное за период как разность нарастающих итогов.
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

console.log('\nФИКСАЦИЯ · ' + (fail ? fail + ' проверок провалено' : 'все проверки сошлись'));
process.exit(fail ? 1 : 0);
