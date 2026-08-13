// Проверка вкладки «Транши» после слияния (шаг 5): FX-колонки + итог-строка.
// Открывает валютный (USD) фон-кредит K-B2 и KGS-кредит K-1, дампит шапки таблиц.
// КВ-33: колонка «Курс» снята — курс у кредита один на все транши и стоит в строке-контексте
// над таблицей; «≈KGS» осталась колонкой, потому что меряет каждую строку по-своему.
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
    const tot=[...document.querySelectorAll('.cgrid tbody tr')].find(r=>/^Итого/.test(r.textContent.trim()));
    return tot ? [...tot.querySelectorAll('td')].map(t=>t.textContent.trim()).join(' | ') : null;
  });
  const note = await page.evaluate(() => {
    const p=document.querySelector('.panel-wrap .section-note'); return p ? p.textContent.trim() : null; });
  console.log(`\n── ${id} (${cur})`);
  heads.forEach(h => console.log('  THEAD:', h));
  console.log('  КОНТЕКСТ:', note);
  console.log('  ИТОГО:', totRow);
  await page.screenshot({ path: `${OUT}/tranche-${id}.png`, clip: { x: 250, y: 90, width: 1420, height: 620 } });
};

await dump('K-B2');   // USD — колонка ≈KGS должна быть, курс — в строке-контексте
await dump('K-1');    // KGS — ни ≈KGS, ни курса

console.log('\nERRORS:', errs.length ? errs : 'нет');
await ctx.close();
