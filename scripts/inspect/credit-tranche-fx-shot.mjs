// Проверка вкладки «Транши» после слияния (шаг 5): FX-колонки + итог-строка.
// Открывает валютный (USD) фон-кредит K-B2 и KGS-кредит K-1, дампит шапки таблиц.
//   node scripts/inspect/credit-tranche-fx-shot.mjs
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url';
import { resolve } from 'path';
import { mkdirSync } from 'fs';

const OUT = '.auth/credit-merge';
mkdirSync(OUT, { recursive: true });

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1680, height: 1050 },
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

await page.goto(pathToFileURL(resolve('mockups/loan-credit/credit.html')).href, { waitUntil: 'load' });
await page.waitForTimeout(300);

const dump = async (id) => {
  await page.evaluate(i => { CR.openDetail(i); CR.selectDetailTab && CR.selectDetailTab('Транши'); }, id);
  // клик по вкладке через DOM, если нет API
  await page.evaluate(() => { const t=[...document.querySelectorAll('.dtab')].find(x=>/Транши/.test(x.textContent)); t&&t.click(); });
  await page.waitForTimeout(200);
  const cur = await page.evaluate(i => (CR.db.credits.find(c=>c.id===i)||{}).currency, id);
  const heads = await page.$$eval('.cgrid thead tr', trs => trs.map(tr => [...tr.querySelectorAll('th')].map(t=>t.textContent.trim()).join(' · ')));
  const totRow = await page.evaluate(() => {
    const tot=[...document.querySelectorAll('.cgrid tbody tr')].find(r=>/Итого освоено/.test(r.textContent));
    return tot ? [...tot.querySelectorAll('td')].map(t=>t.textContent.trim()).join(' | ') : null;
  });
  console.log(`\n── ${id} (${cur})`);
  heads.forEach(h => console.log('  THEAD:', h));
  console.log('  ИТОГО:', totRow);
  await page.screenshot({ path: `${OUT}/tranche-${id}.png`, clip: { x: 250, y: 90, width: 1420, height: 620 } });
};

await dump('K-B2');   // USD — колонки Курс/≈KGS должны быть
await dump('K-1');    // KGS — колонок Курс/≈KGS быть не должно

console.log('\nERRORS:', errs.length ? errs : 'нет');
await ctx.close();
