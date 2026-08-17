// Снимки секции «Очередь погашения» на вкладке «Платежи» после КВ-71: хвост свёрнут
// (умолчание) и раскрыт. Три кредита — три случая, ради которых правка и делалась:
//   K-4   — 24 наступивших и 56 ненаступивших, самая длинная очередь сида;
//   K-1   — 4 наступивших при 44 в хвосте, два транша (колонка «Транш» на месте);
//   K-C1  — наступивших ноль, вся секция прежде была серой.
// Заодно проверяется, что «Задолженности по статьям» на вкладке больше нет — свод живёт
// на «Расчётах» (КВ-71).
//   node scripts/inspect/credit-queue-kv71-shot.mjs
// API: CR.toggleQueueTail() — переключает хвост; состояние сбрасывается на каждую карточку.
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url';
import { resolve } from 'path';
import { mkdirSync } from 'fs';

const OUT = '.auth/queue-kv71';
mkdirSync(OUT, { recursive: true });

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, viewport: { width: 1680, height: 1200 } });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

await page.goto(pathToFileURL(resolve('mockups/loan-credit/credit.html')).href, { waitUntil: 'load' });
await page.waitForTimeout(300);

/* Секцию ставим В ВЕРХ окна: заголовок у нижней кромки оставил бы за кадром таблицу,
   ради которой снимок и делается (идиома credit-calc-kv42-shot.mjs). */
const shot = async (name) => {
  await page.evaluate(() => {
    const h = [...document.querySelectorAll('.section-h')].find(x => /Очередь погашения/.test(x.textContent));
    if (h) h.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}/${name}.png` });
};

for (const id of ['K-4', 'K-1', 'K-C1']){
  await page.evaluate(x => { CR.openDetail(x); CR.openTab('Платежи'); }, id);
  await page.waitForTimeout(200);
  const stale = await page.evaluate(() => /Задолженность по статьям/.test(document.body.innerText));
  if (stale) errs.push(`${id}: «Задолженность по статьям» вернулась на «Платежи»`);
  await shot(`${id}-01-svernuto`);
  await page.evaluate(() => CR.toggleQueueTail());
  await page.waitForTimeout(200);
  await shot(`${id}-02-raskryto`);
}

console.log(errs.length ? 'ОШИБКИ:\n' + errs.join('\n') : `снимки в ${OUT}, ошибок нет`);
await ctx.close();
