// Вкладка «График»: позиции сгруппированы по годам, итоги года — под своими колонками,
// развёрнут только текущий год, прочие открываются кликом (КВ-19, волна 10.08.2026).
// K-1 — многолетний (2026–2028), K-3 — однолетний (строк года не имеет).
//   node scripts/inspect/credit-grafik-year-shot.mjs
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

const openGrafik = async (id) => {
  await page.evaluate(i => CR.openDetail(i), id);
  await page.evaluate(() => { const t=[...document.querySelectorAll('.dtab')].find(x=>/^График$/.test(x.textContent.trim())); t&&t.click(); });
  await page.waitForTimeout(250);
};
// состояние таблицы: строки года (год, развёрнут ли, итоги) + сколько позиций видно
const snap = () => page.evaluate(() => ({
  years: [...document.querySelectorAll('tr.gyear')].map(tr => ({
    y: tr.querySelector('.gy').textContent,
    open: tr.classList.contains('open'),
    tds: [...tr.children].map(td => td.innerText.replace(/\s+/g,' ').trim()),
  })),
  pos: [...document.querySelectorAll('table.cgrid tbody tr')].filter(tr => !tr.classList.contains('gyear')
        && /^№\d+$/.test((tr.children[0]||{}).innerText || '')).length,
}));

for (const id of ['K-1', 'K-3']) {
  await openGrafik(id);
  console.log(id, 'по умолчанию:', JSON.stringify(await snap(), null, 1));
  await page.screenshot({ path: `${OUT}/${id}-grafik.png`, fullPage: true });
}

// K-1: развернуть 2027 кликом по строке года, затем «Развернуть все годы»
await openGrafik('K-1');
await page.evaluate(() => { const tr=[...document.querySelectorAll('tr.gyear')].find(x=>/2027/.test(x.textContent)); tr&&tr.click(); });
await page.waitForTimeout(200);
console.log('K-1 после клика по 2027:', JSON.stringify(await snap()));
await page.screenshot({ path: `${OUT}/K-1-grafik-2027.png`, fullPage: true });
await page.evaluate(() => { const b=[...document.querySelectorAll('button')].find(x=>/Развернуть все годы|Свернуть все годы/.test(x.textContent)); b&&b.click(); });
await page.waitForTimeout(200);
console.log('K-1 после кнопки:', JSON.stringify(await snap()));
await page.evaluate(() => { const b=[...document.querySelectorAll('button')].find(x=>/Свернуть все годы/.test(x.textContent)); b&&b.click(); });
await page.waitForTimeout(200);
console.log('K-1 после «свернуть все»:', JSON.stringify(await snap()));
await page.screenshot({ path: `${OUT}/K-1-grafik-collapsed.png`, fullPage: true });

console.log('errors:', errs.length ? errs.slice(0,3) : 'нет');
await ctx.close();
