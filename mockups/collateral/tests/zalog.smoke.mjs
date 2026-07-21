import { load, test, ok, eq, report } from './harness.mjs';

test('S0: файл грузится, шов __zt доступен', () => {
  const { zt } = load();
  ok(zt, 'window.__zt отсутствует');
  ok(typeof zt.requiredCover === 'function', 'requiredCover не в шве');
});

// D1: COVER_MIN — единая псевдоконстанта покрытия — удаляется; требуемое обеспечение
// считается через requiredCover(creditId, cs), т.к. порог зависит от состава залога
// (П1 §2.3–2.4), а не является одним числом на все кредиты.
test('D1-1: COVER_MIN отсутствует как символ', () => {
  const { win } = load();
  // top-level const/let в классическом <script> НЕ становится свойством window,
  // поэтому проверяем сам биндинг верхнего уровня скрипта через win.eval, а не
  // typeof win.COVER_MIN (та проверка была бы 'undefined' и до фикса — не РЕД).
  eq(win.eval('typeof COVER_MIN'), 'undefined', 'COVER_MIN должен быть удалён как символ верхнего уровня');
});

report();
