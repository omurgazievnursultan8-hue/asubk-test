// Проверка фичи «Фильтр и колонка по стадии заявки» (2026-07-10).
// Грузит мокап, гоняет селект «Стадия заявки», сверяет выборку грида с эталоном,
// который считает сама страница через stageOfRow(). Ищет JS-ошибки.
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
const set = async (id, val) => { await page.selectOption('#' + id, val); await page.waitForTimeout(50); };
const rows = () => page.$$eval('#appTbody tr', trs => trs.length);
const cells = () => page.$$eval('#appTbody tr', trs => trs.map(tr => ({
  num:    tr.cells[0].textContent.trim(),
  stage:  tr.cells[2].textContent.trim(),
  cls:    (tr.cells[2].querySelector('.stage-badge') || {}).className || '(НЕТ БЕЙДЖА)',
  status: tr.cells[3].textContent.trim(),
})));
const same = (a, b) => a.length === b.length && a.every(x => b.includes(x));

const TOTAL = await page.evaluate(() => APPLICATIONS.length);

// Колонка «Стадия» заполнена у каждой строки.
const all = await cells();
check(`всего строк = ${TOTAL}`, (await rows()) === TOTAL);
const bad = all.filter(c => !/^[1-5] · .+/.test(c.stage) || c.cls === '(НЕТ БЕЙДЖА)' || /undefined/.test(c.stage));
check('каждая ячейка — «N · подпись» с бейджем', bad.length === 0, bad.length ? JSON.stringify(bad.slice(0, 3)) : '');

/* Эталон считает сама страница: фильтр обязан совпасть с stageOfRow() ровно,
   включая пустые выборки. «Должно быть > 0» — это про демо-данные, проверяем отдельно. */
const truth = await page.evaluate(() => {
  const by = { 1:[], 2:[], 3:[], 4:[], 5:[], ready:[], neg:[] };
  APPLICATIONS.forEach(a => {
    const s = stageOfRow(a);
    by[s.i].push(a.num);
    if (s.ready) by.ready.push(a.num);
    if (s.neg)   by.neg.push(a.num);
  });
  return by;
});

// Узлы 1..5: выборка == эталон; сумма == всего (каждая заявка ровно на одном узле); пейджер честен.
let sum = 0;
for (const n of ['1', '2', '3', '4', '5']){
  await set('fStage', n);
  const shown = (await cells()).map(c => c.num);
  sum += shown.length;
  check(`узел ${n}: выборка == stageOfRow (${truth[n].length} шт.)`, same(shown, truth[n]),
    `DOM=[${shown}] эталон=[${truth[n]}]`);
  const info = await page.textContent('#pgInfo');
  check(`узел ${n}: счётчик пейджера == числу строк`, parseInt(info, 10) === shown.length, `pgInfo="${info}"`);
}
check(`сумма по 5 узлам = ${TOTAL}`, sum === TOTAL, `сумма=${sum}`);

// Стадия и статус ортогональны, складываются через AND.
await set('fStage', '5');
const s5 = await rows();
await set('fStatus', 'Одобрена');
const appr = await cells();
check('Стадия=5 + Статус=Одобрена → только одобренные', appr.length > 0 && appr.every(c => c.status === 'Одобрена'));
await set('fStatus', 'Отклонена');
const rej = await cells();
check('Стадия=5 + Статус=Отклонена → только отклонённые', rej.length > 0 && rej.every(c => c.status === 'Отклонена'));
check('AND сужает: 5+статус < 5', appr.length + rej.length <= s5, `${appr.length}+${rej.length} vs ${s5}`);
await set('fStatus', '');

/* «Готовы к отправке» стоит на sendReady — том же гейте, что и кнопка. Расхождение
   здесь = список обещает то, чего кнопка не даст (appStage().ready про группу и
   покрытие залогом не знает, поэтому предикатом фильтра он быть не может). */
await set('fStage', 'ready');
const ready = await cells();
check(`«Готовы к отправке»: выборка == sendReady (${truth.ready.length} шт.)`, same(ready.map(c => c.num), truth.ready));
check('бейджи зелёные (sb-ready)', ready.length > 0 && ready.every(c => c.cls.includes('sb-ready')));
const stuck = [];
for (const c of ready){
  await page.click(`#appTbody tr[data-num="${c.num}"]`);
  if (await page.isDisabled('#btnCom')) stuck.push(c.num);
}
check('кнопка «Отправить в комиссию» активна у всех ready', ready.length > 0 && stuck.length === 0,
  stuck.length ? `серые: ${stuck}` : (ready.length ? '' : 'ВАКУУМНО: ready-заявок нет'));

// Отрицательное заключение: красный бейдж в списке и красный узел 3 в карточке.
await set('fStage', 'neg');
const neg = await cells();
check(`«Отриц. заключение»: выборка == stageOfRow().neg (${truth.neg.length} шт.)`, same(neg.map(c => c.num), truth.neg));
check('бейджи красные (sb-neg)', neg.length > 0 && neg.every(c => c.cls.includes('sb-neg')));
if (neg.length){
  await page.dblclick(`#appTbody tr[data-num="${neg[0].num}"]`);
  await page.waitForSelector('#detailStages .stage-strip');
  /* .stg и .stg-sep — оба <span> и чередуются: nth-of-type попал бы не в тот узел. */
  const strip = await page.$$eval('#detailStages .stage-strip .stg', els => els.map(e => e.className));
  check('в карточке узел 3 красный (.rej) — список и карточка согласованы', strip[2].includes('rej'), `class="${strip[2]}"`);
  await page.evaluate(() => showView('list'));
  await page.waitForSelector('#appTbody tr');
}

// Демо-данные: опция селекта, дающая пустой список, читается как сломанный фильтр.
const empty = ['1', '2', '3', '4', '5', 'ready', 'neg'].filter(k => truth[k].length === 0);
check('каждая опция селекта даёт непустую выборку', empty.length === 0, empty.length ? `пустые: ${empty.join(', ')}` : '');

// Сортировка по производной колонке.
await page.evaluate(() => { document.getElementById('fStage').value = ''; renderGrid(); });
await page.click('#appGrid thead th[data-col="stage"]');
const asc = (await cells()).map(c => +c.stage[0]);
check('сортировка по «Стадия» ↑', asc.every((v, i, a) => !i || a[i - 1] <= v), asc.join(','));
await page.click('#appGrid thead th[data-col="stage"]');
const desc = (await cells()).map(c => +c.stage[0]);
check('сортировка по «Стадия» ↓', desc.every((v, i, a) => !i || a[i - 1] >= v), desc.join(','));
await page.click('#appGrid thead th[data-col="num"]');
check('клик по другой колонке сбрасывает глиф «Стадия»',
  (await page.$eval('#appGrid thead th[data-col="stage"] .sort', el => el.textContent)) === '↕');

// Комбинация с прочими фильтрами и полный сброс.
await set('fStage', '1');
await page.fill('#fNum', 'З-2026');
await page.waitForTimeout(50);
check('Стадия=1 + Номер сужает', (await rows()) > 0);
await page.fill('#fNum', '');
await set('fStage', '');
await page.waitForTimeout(50);
check('сброс фильтров → снова все строки', (await rows()) === TOTAL);

// Выбранная строка ушла под фильтр → выделение снято, кнопки погасли.
const other = (await cells()).find(c => !c.stage.startsWith('1'));
if (other){
  await page.click(`#appTbody tr[data-num="${other.num}"]`);
  const before = !(await page.isDisabled('#btnEdit'));
  await set('fStage', '1');
  const after = !(await page.isDisabled('#btnEdit'));
  const sel = await page.$$eval('#appTbody tr.sel', t => t.length);
  check('строка ушла под фильтр → выделение снято, «Просмотр» погас', before && !after && sel === 0);
}

check('JS-ошибок нет', errors.length === 0, errors.slice(0, 5).join(' | '));

console.log(results.join('\n'));
const failed = results.filter(r => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
await ctx.close();
process.exit(failed ? 1 : 0);
