// Проверка вкладки «Расчёты» после слияния (шаг 6): Свод на дату + статус-пилюли позиций.
// K-3 (KGS, просрочка 95 дн) и K-B2 (USD, свод с ≈KGS).
//   node scripts/inspect/credit-raschety-shot.mjs
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
  await page.evaluate(i => CR.openDetail(i), id);
  await page.evaluate(() => { const t=[...document.querySelectorAll('.dtab')].find(x=>/Расч/.test(x.textContent)); t&&t.click(); });
  await page.waitForTimeout(200);
  const cur = await page.evaluate(i => (CR.db.credits.find(c=>c.id===i)||{}).currency, id);
  const svod = await page.evaluate(() => {
    const h=[...document.querySelectorAll('.section-h')].find(x=>/Свод на/.test(x.textContent));
    if(!h) return null;
    const dims=h.nextElementSibling.nextElementSibling; // note, then dims
    return [...document.querySelectorAll('.phead-dims .dim')].slice(0,5).map(d=>d.innerText.replace(/\n/g,' ⟩ '));
  });
  const pos = await page.evaluate(() => {
    const h=[...document.querySelectorAll('.section-h')].find(x=>/График — позиции/.test(x.textContent));
    if(!h) return null;
    const tbl=h.nextElementSibling;
    return [...tbl.querySelectorAll('tbody tr')].map(r=>[...r.querySelectorAll('td')].map(t=>t.textContent.trim()).join(' | '));
  });
  console.log(`\n── ${id} (${cur})`);
  console.log('  СВОД:'); (svod||['—']).forEach(s=>console.log('    •', s));
  console.log('  ПОЗИЦИИ:'); (pos||['—']).forEach(p=>console.log('    ', p));
  await page.screenshot({ path: `${OUT}/raschety-${id}.png`, clip: { x: 250, y: 90, width: 1420, height: 720 } });
};

await dump('K-3');    // KGS, просрочка — статусы Просрочена/Наступила/Предстоит
await dump('K-B2');   // USD — свод с ≈KGS

console.log('\nERRORS:', errs.length ? errs : 'нет');
await ctx.close();
