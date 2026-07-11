// Проверка «командного центра документов» во вкладке «Документы» заявки (2026-07-11).
// Грузит мокап, открывает деталку, гоняет сегментный прогресс, конвейер стадий-фильтр и
// очередь действий по ролям. Эталоны считает сама страница через _docStats()/_docStageCounts().
import { chromium } from 'playwright-core';
const FILE = 'file://' + process.cwd() + '/mockups/loan-application/loan-application.html';
const ctx = await chromium.launchPersistentContext('.auth/profile-mock',
  { channel:'chrome', headless:true, viewport:{ width:1500, height:1200 } });
const page = ctx.pages()[0] || await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

await page.goto(FILE, { waitUntil:'networkidle' });
await page.waitForSelector('#appTbody tr');

const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS ' : 'FAIL '}${name}${detail ? ' — ' + detail : ''}`);

// Открыть первую заявку (gotoDetail по номеру строки) и вкладку «Документы».
const num = await page.$eval('#appTbody tr', tr => tr.dataset.num);
await page.evaluate(n => gotoDetail(n), num);
await page.waitForSelector('#view-detail', { state:'visible' });
await page.evaluate(() => showTab('tab-2'));
await page.waitForSelector('.docprog');

// 1) Сегментный прогресс: три процента согласованы и headline = финальная стадия.
const prog = await page.evaluate(() => {
  const s = _docStats(_detailApp);
  const r = n => s.reqTot ? Math.round(n / s.reqTot * 100) : 0;
  return { pct:r(s.reqClosed), acc:r(s.reqAccepted), conf:r(s.reqConfirmed),
           headline: document.querySelector('.docprog-pct').textContent.trim() };
});
check('прогресс: Подтверждено ≤ Принято ≤ Собрано', prog.conf <= prog.acc && prog.acc <= prog.pct,
  `${prog.conf}% ≤ ${prog.acc}% ≤ ${prog.pct}%`);
check('headline = % последней стадии (Подтверждено ГФ)', prog.headline === prog.conf + '%', `headline=${prog.headline}, conf=${prog.conf}%`);

// 2) Конвейер стадий: чипов столько же, сколько присутствующих стадий; сумма счётчиков = всем докам.
const rail = await page.evaluate(() => {
  const counts = _docStageCounts(_detailApp);
  const present = Object.keys(counts).length;
  const chips = document.querySelectorAll('.docstage-chip').length;
  const railTotal = Object.values(counts).reduce((a, c) => a + c.req + c.opt, 0);
  return { present, chips, railTotal };
});
check('чип на каждую присутствующую стадию', rail.chips === rail.present, `chips=${rail.chips}, стадий=${rail.present}`);
check('в конвейере есть документы', rail.railTotal > 0, `всего=${rail.railTotal}`);

// 3) Клик по чипу = фильтр: появляется приглушение и строка активного фильтра; сброс снимает.
await page.click('.docstage-chip');
await page.waitForTimeout(60);
const filtered = await page.evaluate(() => ({
  dim: document.querySelectorAll('.doc-dim').length,
  active: !!document.querySelector('.docstage-active'),
  on: document.querySelectorAll('.docstage-chip.on').length,
}));
check('фильтр приглушает несовпадающее', filtered.dim > 0, `dim=${filtered.dim}`);
check('строка активного фильтра показана', filtered.active && filtered.on === 1);
await page.click('.docstage-reset');
await page.waitForTimeout(60);
const cleared = await page.evaluate(() => document.querySelectorAll('.doc-dim').length + '/' + document.querySelectorAll('.docstage-active').length);
check('сброс фильтра снимает приглушение', cleared === '0/0', `dim/active=${cleared}`);

// Найти заявку с «пёстрым» комплектом (у спеца есть что делать) — иначе очередь/переход
// не проверить: первая заявка засеяна в «всё подтверждено».
const mixedNum = await page.evaluate(() => {
  setRole('spec');
  for (const a of APPLICATIONS){ gotoDetail(a.num); if (_docActionQueue(_detailApp).length > 0) return a.num; }
  return null;
});
check('найдена заявка с ожидающими действиями спеца', mixedNum !== null, mixedNum ? '№' + mixedNum : 'нет');

// 4) Очередь действий: бейдж = числу пунктов; смена роли spec↔gf меняет набор действий.
const gotoMixed = async (role) => {
  await page.selectOption('#roleSel', role);
  await page.evaluate(n => gotoDetail(n), mixedNum);
  await page.evaluate(() => showTab('tab-2'));
  await page.waitForSelector('.docq');
  return page.evaluate(() => {
    const badge = +document.querySelector('.docq-count').textContent.trim();
    const items = [...document.querySelectorAll('.docq-item')];
    const acts = [...new Set(items.map(i => i.querySelector('.docq-act').textContent.trim()))];
    return { badge, count: items.length, acts };
  });
};
const spec = await gotoMixed('spec');
check('spec: очередь непустая', spec.count > 0, `items=${spec.count}`);
check('spec: бейдж очереди = числу пунктов', spec.badge === spec.count, `badge=${spec.badge}, items=${spec.count}`);
check('spec: действия только из набора спеца', spec.acts.every(a => ['Загрузить','Перезагрузить','Проверить','Ответ получен'].includes(a)),
  spec.acts.join(', ') || '(пусто)');
const gf = await gotoMixed('gf');
check('ГФ: бейдж очереди = числу пунктов', gf.badge === gf.count, `badge=${gf.badge}, items=${gf.count}`);
check('ГФ: только «Подтвердить» (или пусто)', gf.acts.every(a => a === 'Подтвердить'), gf.acts.join(', ') || '(пусто)');

// 5) Переход из очереди раскрывает секцию и подсвечивает целевую строку.
await gotoMixed('spec');
const jumped = await page.evaluate(() => {
  const it = document.querySelector('.docq-item'); if (!it) return 'нет пунктов';
  it.click();
  return document.querySelectorAll('.doc-row.flash').length > 0 ? 'flash' : 'нет подсветки';
});
check('клик по пункту очереди подсвечивает строку', jumped === 'flash', jumped);

check('нет JS-ошибок на странице', errors.length === 0, errors.slice(0, 4).join(' | '));

console.log('\n' + results.join('\n'));
console.log(`\nИтог: ${results.filter(r => r.startsWith('PASS')).length}/${results.length} PASS`);
await ctx.close();
process.exit(results.some(r => r.startsWith('FAIL')) ? 1 : 0);
