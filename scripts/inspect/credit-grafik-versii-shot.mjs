import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url';
import { resolve } from 'path';
import { mkdirSync } from 'fs';
const OUT = '.auth/kv2728'; mkdirSync(OUT, { recursive: true });
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1680, height: 1500 } });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type()==='error') errs.push('console: '+m.text()); });
await page.goto(pathToFileURL(resolve('mockups/loan-credit/credit.html')).href, { waitUntil:'load' });
await page.waitForTimeout(300);
const openTab = async (id, tab) => { await page.evaluate(i => CR.openDetail(i), id);
  await page.evaluate(t => { const x=[...document.querySelectorAll('.dtab')].find(e=>e.textContent.trim()===t); x&&x.click(); }, tab);
  await page.waitForTimeout(250); };
const text = () => page.evaluate(() => (document.querySelector('#detailBody')||document.body).innerText);
/* Заголовки таблицы ПОЗИЦИЙ (последний .cgrid на вкладке). По innerText проверять нельзя:
   слово «Статус» несёт и грид версий за раскрытием — проба ловила бы чужую колонку. */
const posHead = () => page.evaluate(() => { const ts=[...document.querySelectorAll('.cgrid')];
  const tb=ts[ts.length-1]; return tb ? [...tb.querySelectorAll('thead th')].map(x=>x.textContent.trim()) : []; });
const shot = n => page.screenshot({ path: `${OUT}/${n}.png`, fullPage: true });
const say = (k,v) => console.log(`${k}: ${v}`);

await openTab('K-1','График'); let t = await text();
say('K-1 · строки-контекста нет', !/Действует v/.test(t));
say('K-1 · раскрытия версий нет', !/Версии графика/.test(t));
await shot('k1-grafik');

await openTab('K-7','График');
await page.evaluate(() => CR.setCardScope(2)); await page.waitForTimeout(250);
t = await text();
say('K-7 Т2 · строка-контекст', /Действует v/.test(t));
say('K-7 Т2 · раскрытие с счётчиком', /Версии графика \(\d+\)/.test(t));
say('K-7 Т2 · грид свёрнут', !/Действует с/.test(t));
await page.evaluate(() => CR.toggleGrafikVers()); await page.waitForTimeout(250);
t = await text(); say('K-7 Т2 · грид открыт', /Действует с/.test(t));
await shot('k7-t2-versii');

// K-3: ставим будущую версию и открываем архивную (действующую v1 после неё)
await page.evaluate(() => { const c = CR.db.credits.find(x=>x.id==='K-3'); const tr = c.tranches[0];
  const fut = CR.TODAY.slice(0,6) + (Number(CR.TODAY.slice(6))+1);
  const mx = tr.schedules.reduce((m,s)=>Math.max(m,s.ver||0),0);
  tr.schedules.push({ ver:mx+1, rows: tr.schedules[0].rows.slice(0,3), validFrom:fut,
    generatedFrom:fut, generatedAt:CR.TODAY, by:{kind:'ДС', ref:'ДС-БУД-1'} }); });
await openTab('K-3','График'); t = await text();
say('K-3 · хвост «вступает»', /вступает v/.test(t));
const tileBefore = (t.match(/Платежей в графике\s*\n?\s*(\d+)/)||[])[1];
await page.evaluate(() => { const c = CR.db.credits.find(x=>x.id==='K-3'); const tr=c.tranches[0];
  const mx = tr.schedules.reduce((m,s)=>Math.max(m,s.ver||0),0); CR.setGrafikVer(tr.no, mx); });
await page.waitForTimeout(250); t = await text();
const tileAfter = (t.match(/Платежей в графике\s*\n?\s*(\d+)/)||[])[1];
say('K-3 · плашка режима', /ещё не действует, вступает/.test(t));
say('K-3 · кнопка возврата', /Вернуться к действующей/.test(t));
say('K-3 · колонки «Статус» нет', !(await posHead()).includes('Статус'));
say('K-3 · плитка поехала', `${tileBefore} → ${tileAfter}`);
await shot('k3-view-version');
await page.evaluate(() => CR.clearGrafikVer()); await page.waitForTimeout(250);
say('K-3 · возврат вернул «Статус»', (await posHead()).includes('Статус'));
console.log(errs.length ? 'ОШИБКИ КОНСОЛИ:\n' + errs.join('\n') : 'ошибок консоли нет');
await ctx.close();
