/* Покрытие каталога ситуаций (design doc §ЗС-1,
   docs/superpowers/specs/2026-08-01-collection-seed-rebuild-design.md):
   у каждой из сорока ситуаций должно быть 2–3 дела, ни одного кода мимо
   каталога. Это ПОСТОЯННАЯ линейка, не разовый скрипт — три правила:
     1. Стадия требования — ТОЙ ЖЕ функцией, что использует приложение:
        stageOfReq(r) = stageOf(effectivePhaseOf(r)), не stageOf(displayPhase(r))
        (так было в брифе Task 10 — ошибка брифа). displayPhase() подменяет фазу
        под паузу/реструктуризацию и может вернуть «Рассмотрение вопроса
        реструктуризации» — строку, которой нет в PHASE_STAGE; stageOf() на ней
        тихо падает в «Досудебный порядок» вместо честной стадии требования.
        effectivePhaseOf() — то же самое чтение, что карточка/реестр/фильтр
        стадии используют для человека (2100–2102).
     2. `pageerror` ловится и превращает прогон в красный — непойманное
        исключение при сборке PROCESSES могло бы не тронуть SEED/PROCESSES
        (например, упасть в рендере) и линейка отчиталась бы чистыми числами
        по неполным данным.
     3. `sit` каждого кейса сверяется со СПРАВОЧНЫМ списком из 40 кодов ниже —
        неизвестный код (опечатка, не только «мало дел») — тоже находка.
   Прогон завершается ненулевым кодом, если что-то из трёх правил нарушено:
   тонкая ситуация, неизвестный/отсутствующий код каталога, или pageerror.
   Запуск: node scripts/inspect/collection-seed-coverage.mjs */
import { chromium } from 'playwright-core';

/* Каталог — вербатим колонка «Код» таблицы §ЗС-1 design doc, все 40 строк по
   порядку. Меняется только вместе со спецификацией, не молча вслед за SEED. */
const CATALOG = [
  'K0-ОКНО', 'K0-ЗАКР', 'K0-РЕТРО',
  'K1-ПРЕТ1', 'K1-ПРЕТ2', 'K1-ОБЕСП', 'K1-БА-ГЕЙТ', 'K1-БА-ИСП', 'K1-БА-НЕТ',
  'K1-ПАУЗА-ГП', 'K1-ПАУЗА-РЕСТР', 'K1-СТОРНО',
  'K2-ГЕЙТ', 'K2-ИЗВЕЩ',
  'K3-ИСК-ЖДЁМ', 'K3-ИСК', 'K3-ИСК-ВОЗВРАТ', 'K3-РЕШЕНИЕ', 'K3-АПЕЛЛЯЦИЯ',
  'K3-ИЛ', 'K3-МС', 'K3-ДОБРОВОЛЬНОЕ',
  'K4-ИСПОЛН', 'K4-ТОРГИ', 'K4-ВОЗВРАТ',
  'K5-ПРАВОПР', 'K5-НЕТ-ПРАВОПР',
  'K6-ИНИЦ', 'K6-ПРИЗНАН', 'K6-ЗАВЕРШЕНО',
  'K7-ЛИКВИД', 'K7-УМЕРШИЙ', 'K7-ПРИГОВОР', 'K7-КОМИССИЯ', 'K7-СПИСАНА',
  'T-ПОГАШЕНИЕ',
  'ВЕД-ПЕРЕДАЧА', 'ВЕД-КОНФЛИКТ', 'ВЕД-МНОГО',
  'РИСК',
];

const file = 'file://' + process.cwd() + '/mockups/collection/collection.html';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(String(e)));
await p.goto(file);
await p.waitForTimeout(400);
const out = await p.evaluate(() => {
  const by = {};
  for(const c of SEED) (by[c.sit] ??= []).push(c.id);
  const stages = {};
  for(const r of allReqs()) stages[stageOfReq(r)] = (stages[stageOfReq(r)] || 0) + 1;
  return { by, stages, procCount:PROCESSES.length };
});
await b.close();

console.log('pageerrors:', JSON.stringify(errs));

const known = new Set(CATALOG);
const unknown = Object.keys(out.by).filter(sit => !known.has(sit));
const missing = CATALOG.filter(sit => !out.by[sit]);
const thin = Object.entries(out.by).filter(([, ids]) => ids.length < 2);

for(const [sit, ids] of Object.entries(out.by)){
  const flag = unknown.includes(sit) ? '  ЗС-1: код не в каталоге' : '';
  console.log(`${sit.padEnd(18)} ${ids.length}  ${ids.join(' ')}${flag}`);
}
for(const sit of missing) console.log(`${sit.padEnd(18)} 0  — отсутствует в затравке (каталог §ЗС-1 требует 2–3 дела)`);
console.log('стадии:', JSON.stringify(out.stages));
console.log(`ситуаций: ${Object.keys(out.by).length} · дел: ${out.procCount} · тонких (<2): ${thin.length}` +
            (unknown.length ? ` · неизвестных: ${unknown.length}` : '') +
            (missing.length ? ` · отсутствующих: ${missing.length}` : ''));

if(errs.length || unknown.length || missing.length || thin.length) process.exit(1);
