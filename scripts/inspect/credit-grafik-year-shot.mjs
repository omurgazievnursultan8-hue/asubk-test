// Скриншот вкладки «График» с группировкой позиций по годам (волна 10.08.2026).
// K-1 (2 транша, слитый вид «по кредиту») и K-3 (просрочка 95 дн).
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url';
import { resolve } from 'path';
import { mkdirSync } from 'fs';

const OUT = '.auth/grafik-year';
mkdirSync(OUT, { recursive: true });

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1680, height: 1400 },
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

await page.goto(pathToFileURL(resolve('mockups/loan-credit/credit.html')).href, { waitUntil: 'load' });
await page.waitForTimeout(300);

for (const id of ['K-1', 'K-3']) {
  await page.evaluate(i => CR.openDetail(i), id);
  await page.evaluate(() => { const t=[...document.querySelectorAll('.dtab')].find(x=>/^График$/.test(x.textContent.trim())); t&&t.click(); });
  await page.waitForTimeout(250);
  const heads = await page.evaluate(() => [...document.querySelectorAll('tr.gyear')].map(tr => tr.innerText.replace(/\s+/g,' ').trim()));
  console.log(id, JSON.stringify(heads, null, 1));
  await page.screenshot({ path: `${OUT}/${id}-grafik.png`, fullPage: true });
}
console.log('errors:', errs.length ? errs.slice(0,3) : 'нет');
await ctx.close();
