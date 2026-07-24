// Визуальная проверка объединённого реестра credit.html (шаг 1 слияния двух макетов).
// Снимает: свёрнутый фильтр, развёрнутый фильтр, каскад Область→Район, пагинацию.
//   node scripts/inspect/credit-list-merge-shot.mjs
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url';
import { resolve } from 'path';
import { mkdirSync } from 'fs';

const OUT = '.auth/credit-merge';
mkdirSync(OUT, { recursive: true });

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1680, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

await page.goto(pathToFileURL(resolve('mockups/loan-credit/credit.html')).href, { waitUntil: 'load' });
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/01-list-collapsed.png` });

// шапка грида + первая строка — что реально отрисовалось
const head = await page.$$eval('#view-list thead th', ths => ths.map(t => t.textContent.trim()));
const row1 = await page.$$eval('#regBody tr:first-child td', tds => tds.map(t => t.innerText.replace(/\n/g, ' | ')));
const pager = await page.$eval('#regPager', el => el.innerText.replace(/\s+/g, ' '));

// развернуть фильтр
await page.click('.filter-head');
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/02-filter-open.png` });

// каскад: Чуйская → районы
await page.selectOption('#fRegion', 'Чуйская');
await page.waitForTimeout(200);
const districts = await page.$$eval('#fDistrict option', os => os.map(o => o.textContent));
const afterRegion = await page.$eval('#regCount', el => el.textContent);
await page.screenshot({ path: `${OUT}/03-cascade.png` });

// сбросить, проверить бейдж и пагинацию
await page.click('.filter-body .filter-bar .btn');
await page.waitForTimeout(200);
await page.click('.filter-head');            // свернуть
await page.selectOption('#regPager select', '10').catch(() => {});
await page.waitForTimeout(200);

// поиск по ИНН
await page.click('.filter-head');
await page.fill('#fQ', 'Нарын');
await page.waitForTimeout(200);
const qHits = await page.$eval('#regCount', el => el.textContent);
const badge = await page.$eval('#fBadge', el => ({ text: el.textContent, hidden: el.hidden }));
await page.screenshot({ path: `${OUT}/04-search.png` });

// вторая страница
await page.click('.filter-body .filter-bar .btn');
await page.waitForTimeout(200);
let page2 = null;
const p2 = await page.$('#regPager .pg:not(.dis):not(.active)');
if (p2) { await page.click('#regPager .pages .pg.active + .pg'); await page.waitForTimeout(200);
  page2 = await page.$eval('#regPager .pinfo', el => el.textContent); }
await page.screenshot({ path: `${OUT}/05-page2.png` });

console.log('THEAD  :', head.join(' · '));
console.log('ROW1   :', row1.join('  ||  '));
console.log('PAGER  :', pager);
console.log('DISTR(Чуйская):', districts.join(', '));
console.log('после обл.:', afterRegion, '| поиск «Нарын»:', qHits, '| бейдж:', JSON.stringify(badge));
console.log('стр.2  :', page2);
console.log('ERRORS :', errs.length ? errs : 'нет');
await ctx.close();
