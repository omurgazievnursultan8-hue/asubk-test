// Снимки секции «Детальный расчёт» (ось КВ-42/ADR-0129, вид один с КВ-64): лист по
// критическим датам в умолчании и в разборе каждой из трёх статей. Кредит K-3 — просрочка,
// решение суда, приостановленная пеня: на нём видно всё сразу.
//   node scripts/inspect/credit-calc-kv42-shot.mjs
// ТРИ СНЯТЫХ API, на которые скрипт опирался по очереди: CR.toggleCalcCol (чипы групп
// колонок, сняты КВ-47 — шапка называет колонки сама), CR.setCalcView (второй вид «По
// позициям», снят КВ-64 — реестр дублировал «График») и CR.toggleCalcRun (три независимых
// разворота, сняты КВ-68 — разбор идёт по одной статье). Действующее API:
// CR.toggleCalcDetail('od'|'int'|'pen') — повторный клик по той же статье возвращает
// умолчание, клик по другой переводит разбор на неё.
// СНИМКОВ ЧЕТЫРЕ, А НЕ ДВА: с КВ-68 «развёрнутого листа» больше нет — состояний столько,
// сколько статей, и каждое сужает лист по-своему.
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
await shot('01-dates-default');
for (const [n, block] of [['02-detail-od','od'], ['03-detail-int','int'], ['04-detail-pen','pen']]){
  await page.evaluate(b => CR.toggleCalcDetail(b), block);
  await page.waitForTimeout(200);
  await shot(n);
  await page.evaluate(b => CR.toggleCalcDetail(b), block);
}

console.log('снимки в', OUT, '· ERRORS:', errs.length ? errs.join(' | ') : 'нет');
await ctx.close();
