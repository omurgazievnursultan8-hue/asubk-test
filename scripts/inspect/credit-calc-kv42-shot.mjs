// Снимки секции «Детальный расчёт» после КВ-42 (ADR-0129): лист «По датам» узкий и со
// всеми группами колонок + реестр «По позициям». Кредит K-3 — просрочка, решение суда,
// приостановленная пеня: на нём видно всё сразу.
//   node scripts/inspect/credit-calc-kv42-shot.mjs
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url';
import { resolve } from 'path';
import { mkdirSync } from 'fs';

const OUT = '.auth/calc-kv42';
mkdirSync(OUT, { recursive: true });

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, viewport: { width: 1680, height: 1200 } });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

await page.goto(pathToFileURL(resolve('mockups/loan-credit/credit.html')).href, { waitUntil: 'load' });
await page.waitForTimeout(300);
await page.evaluate(() => { CR.openDetail('K-3'); CR.openTab('Расчёты'); });
await page.waitForTimeout(200);

/* Секцию ставим В ВЕРХ окна, а не «просто в видимую область»: заголовок у нижней кромки
   оставлял бы таблицу за кадром, ради которой снимок и делается. */
const shot = async (name) => {
  await page.evaluate(() => {
    const h = [...document.querySelectorAll('.section-h')].find(x => /Детальный расчёт/.test(x.textContent));
    if (h) h.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}/${name}.png` });
};
const GROUPS = ['state','pen','paid','run'];

await shot('01-dates-narrow');
await page.evaluate(g => g.forEach(k => CR.toggleCalcCol(k)), GROUPS);
await page.waitForTimeout(200);
await shot('02-dates-wide');
await page.evaluate(g => { g.forEach(k => CR.toggleCalcCol(k)); CR.setCalcView('positions'); }, GROUPS);
await page.waitForTimeout(200);
await shot('03-positions');
await page.evaluate(() => CR.setCalcView('dates'));

console.log('снимки в', OUT, '· ERRORS:', errs.length ? errs.join(' | ') : 'нет');
await ctx.close();
