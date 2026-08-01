/* Покрытие каталога ситуаций: у каждой ситуации должно быть 2–3 дела.
   Запуск: node scripts/inspect/collection-seed-coverage.mjs */
import { chromium } from 'playwright-core';
const file = 'file://' + process.cwd() + '/mockups/collection/collection.html';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const p = await b.newPage();
await p.goto(file);
await p.waitForTimeout(400);
const out = await p.evaluate(() => {
  const by = {};
  for(const c of SEED) (by[c.sit] ??= []).push(c.id);
  const stages = {};
  for(const pr of PROCESSES) for(const r of pr.requirements)
    stages[stageOf(displayPhase(r))] = (stages[stageOf(displayPhase(r))] || 0) + 1;
  return { by, stages, procCount:PROCESSES.length };
});
const thin = Object.entries(out.by).filter(([, ids]) => ids.length < 2);
for(const [sit, ids] of Object.entries(out.by)) console.log(`${sit.padEnd(18)} ${ids.length}  ${ids.join(' ')}`);
console.log('стадии:', JSON.stringify(out.stages));
console.log(`ситуаций: ${Object.keys(out.by).length} · дел: ${out.procCount} · тонких (<2): ${thin.length}`);
await b.close();
