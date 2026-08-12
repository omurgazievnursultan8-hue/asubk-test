/* КВ-29 · «Сформировать график» в настоящем браузере: где кнопка стоит и сколько её на
   экране. Печатает класс, вертикаль и признак «в заголовке» для КАЖДОЙ найденной кнопки —
   инвариант волны «ровно одна» ловится именно длиной массива. Снимки — .auth/kv29/. */
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url'; import { resolve } from 'path'; import { mkdirSync } from 'fs';
const OUT = '.auth/kv29'; mkdirSync(OUT, { recursive: true });
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1680, height: 1200 } });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type()==='error') errs.push('console: '+m.text()); });
await page.goto(pathToFileURL(resolve('mockups/loan-credit/credit.html')).href, { waitUntil:'load' });
await page.waitForTimeout(300);
const openTab = async (id, tab) => { await page.evaluate(i => CR.openDetail(i), id);
  await page.evaluate(t => { const x=[...document.querySelectorAll('.dtab')].find(e=>e.textContent.trim()===t); x&&x.click(); }, tab);
  await page.waitForTimeout(250); };
const btnBoxes = () => page.evaluate(() => [...document.querySelectorAll('button')]
  .filter(b => b.textContent.trim()==='Сформировать график')
  .map(b => { const r=b.getBoundingClientRect(); const h=b.closest('.section-h');
    return { cls:b.className, inHeader:!!h, top:Math.round(r.top), disabled:/not-allowed/.test(b.style.cursor) }; }));
const shot = n => page.screenshot({ path: `${OUT}/${n}.png`, fullPage: false });

await openTab('K-3','График');
console.log('K-3 кнопки:', JSON.stringify(await btnBoxes()));
console.log('K-3 · плашка Д-5 на экране:', await page.evaluate(() => /прежним условиям/.test((document.querySelector('#detailBody')||document.body).innerText)));
await shot('k3-grafik');

await openTab('K-1','График');
await page.evaluate(() => CR.setCardScope(2)); await page.waitForTimeout(250);
console.log('K-1 Т2 кнопки:', JSON.stringify(await btnBoxes()));
await shot('k1-t2-empty');
console.log('ошибок консоли:', errs.length, errs.slice(0,3));
await ctx.close();
