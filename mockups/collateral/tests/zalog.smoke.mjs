import { load, test, ok, report } from './harness.mjs';

test('S0: файл грузится, шов __zt доступен', () => {
  const { zt } = load();
  ok(zt, 'window.__zt отсутствует');
  ok(typeof zt.requiredCover === 'function', 'requiredCover не в шве');
});

report();
