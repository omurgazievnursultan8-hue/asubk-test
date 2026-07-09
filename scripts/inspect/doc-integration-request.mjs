// Проверка фичи «Запрос документов через интеграцию» (спек 2026-07-09).
// Грузит мокап, драйвит флоу запроса, ассертит DOM. Ищет JS-ошибки.
import { chromium } from 'playwright-core';
const FILE = 'file://' + process.cwd() + '/mockups/loan-application/loan-application.html';
const ctx = await chromium.launchPersistentContext('.auth/profile-mock',
  { channel:'chrome', headless:true, viewport:{ width:1500, height:1600 } });
const page = ctx.pages()[0] || await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

await page.goto(FILE, { waitUntil:'networkidle' });
await page.waitForTimeout(400);

// Открыть заявку спецом в режиме правки на вкладке «Документы»
async function openEdit(num){
  await page.evaluate(n => { setRole('spec'); gotoDetail(n, 'tab-2'); enterEdit(); showTab('tab-2'); }, num);
  await page.waitForTimeout(300);
}

const results = [];
const check = (name, ok) => { results.push((ok ? 'PASS ' : 'FAIL ') + name); };

await openEdit('З-2026-000080');

// T1: конфиг загрузился без ошибок, статус и источники объявлены
const cfg = await page.evaluate(() => ({
  // Примечание: DOC_STATUS/OPEN_BLOCKS/DOC_SOURCES/DOC_SECTIONS — top-level const
  // в не-модульном <script>, поэтому НЕ являются свойствами window; проверяем
  // напрямую через видимость в той же глобальной области (тот же realm страницы).
  hasStatus: !!(typeof DOC_STATUS !== 'undefined' && DOC_STATUS.requested && DOC_STATUS.requested.label === 'Запрошено'),
  openBlocks: !!(typeof OPEN_BLOCKS !== 'undefined' && OPEN_BLOCKS('requested')),
  sources: !!(typeof DOC_SOURCES !== 'undefined' && DOC_SOURCES.inn && DOC_SOURCES.cbr),
  cbr: !!(typeof DOC_SECTIONS !== 'undefined' && DOC_SECTIONS.find(s => s.key === 'fin').docs.find(d => d.id === 'cbr')),
}));
check('T1 статус requested объявлен', cfg.hasStatus);
check('T1 OPEN_BLOCKS(requested)', cfg.openBlocks);
check('T1 DOC_SOURCES.inn/.cbr заданы', cfg.sources);
check('T1 док cbr в секции fin', cfg.cbr);

// T2: у интеграционного дока (inn) в открытом блоке есть «Запросить из …»,
//     у неинтеграционного (kb — согласие в кредбюро) — нет.
const btns = await page.evaluate(() => {
  const app = _detailApp;
  const inn = _findDocState('inn'); const kb = _findDocState('kb');
  return {
    innReqBtn: docRow(app, { t:'ИНН', req:true, st:'required' }, 'inn', null).includes('Запросить из'),
    kbReqBtn:  docRow(app, { t:'Согласие', req:true, st:'required' }, 'kb', null).includes('Запросить из'),
    requestedActs: docRow(app, { t:'ИНН', req:true, st:'requested' }, 'inn', null),
  };
});
check('T2 «Запросить из» есть у inn', btns.innReqBtn);
check('T2 «Запросить из» нет у kb', !btns.kbReqBtn);
check('T2 в статусе requested есть «Отменить запрос»', btns.requestedActs.includes('Отменить запрос'));
check('T2 в статусе requested есть «Ответ получен»', btns.requestedActs.includes('Ответ получен'));

console.log(results.join('\n'));
console.log(errors.length ? '\nERRORS:\n' + errors.join('\n') : '\nNO JS ERRORS');
await ctx.close();
if (results.some(r => r.startsWith('FAIL')) || errors.length) process.exit(1);
