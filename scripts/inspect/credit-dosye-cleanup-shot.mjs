// Вкладка «Досье» после чистки шума (11.08.2026): убраны 5 подсказок-абзацев,
// плашка «комплект собран» (→ пилл у заголовка), колонки «Примечание» и «Решение
// Комитета», мёртвые ссылки на вложения, служебный #seq и жаргон «append-only».
//   node scripts/inspect/credit-dosye-cleanup-shot.mjs
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url';
import { resolve } from 'path';
import { mkdirSync } from 'fs';

const OUT = '.auth/dosye-cleanup';
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

const openDosye = async (id) => {
  await page.evaluate(i => CR.openDetail(i), id);
  await page.evaluate(() => { const t=[...document.querySelectorAll('.dtab')].find(x=>/^Досье$/.test(x.textContent.trim())); t&&t.click(); });
  await page.waitForTimeout(250);
};
const snap = () => page.evaluate(() => {
  const host = document.querySelector('#cr-detail') || document.body;
  const txt = host.innerText;
  return {
    heads: [...host.querySelectorAll('.section-h')].map(h => h.innerText.replace(/\s+/g,' ').trim()),
    notes: [...host.querySelectorAll('.section-note')].map(p => p.innerText.replace(/\s+/g,' ').trim()),
    tableHeads: [...host.querySelectorAll('table.cgrid')].map(t =>
      [...t.querySelectorAll('thead th')].map(th => th.innerText.trim()).join(' | ')),
    deadLinks: [...host.querySelectorAll('a.lnk')].filter(a => /вне объёма макета/.test(a.getAttribute('onclick')||'')).length,
    seqBadges: (txt.match(/#\d+\s+·/g) || []).length,
    appendOnly: /append-only/.test(txt),
    infoPlates: [...host.querySelectorAll('.info-plate')].map(p => p.innerText.trim()),
    warns: [...host.querySelectorAll('.warn-inline')].map(p => p.innerText.replace(/\s+/g,' ').trim()),
  };
});

for (const id of ['K-1', 'K-C12']) {
  await openDosye(id);
  console.log(id, JSON.stringify(await snap(), null, 1));
  await page.screenshot({ path: `${OUT}/${id}-dosye.png`, fullPage: true });
}

console.log('errors:', errs.length ? errs.slice(0,3) : 'нет');
await ctx.close();
