// Чистка шума по ВСЕМ вкладкам карточки кредита (волна 11.08.2026, третья).
// Снимает по каждой вкладке: заголовки секций, оставшиеся подсказки-абзацы,
// плашки, мёртвые ссылки на вложения — и пишет PNG на каждую вкладку.
//   node scripts/inspect/credit-tabs-cleanup-shot.mjs
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url';
import { resolve } from 'path';
import { mkdirSync } from 'fs';

const OUT = '.auth/tabs-cleanup';
mkdirSync(OUT, { recursive: true });

const TABS = ['Договор','Состав','Условия','График','Прогноз','Платежи','Расчёты','План','Обеспечение'];
const IDS = ['K-1', 'K-3', 'K-C12'];      // мультитранш · суд и взыскание · закрытый/сложный

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

const open = async (id, tab) => {
  await page.evaluate(i => CR.openDetail(i), id);
  await page.evaluate(t => { const b=[...document.querySelectorAll('.dtab')].find(x=>x.textContent.trim()===t); b&&b.click(); }, tab);
  await page.waitForTimeout(200);
};
const snap = () => page.evaluate(() => {
  const host = document.querySelector('#cr-detail') || document.body;
  const dead = a => /вне объёма макета/.test(a.getAttribute('onclick') || '');
  return {
    notes: [...host.querySelectorAll('.section-note')].map(p => p.innerText.replace(/\s+/g,' ').trim()),
    plates: [...host.querySelectorAll('.info-plate')].map(p => p.innerText.replace(/\s+/g,' ').trim()),
    warns: [...host.querySelectorAll('.warn-inline')].map(p => p.innerText.replace(/\s+/g,' ').trim()),
    deadLinks: [...host.querySelectorAll('a')].filter(dead).map(a => a.textContent.trim()),
  };
});

let totalNotes = 0, totalDead = 0;
for (const id of IDS) {
  for (const tab of TABS) {
    await open(id, tab);
    const s = await snap();
    totalNotes += s.notes.length; totalDead += s.deadLinks.length;
    console.log(`\n=== ${id} · ${tab} · подсказок ${s.notes.length} · плашек ${s.plates.length} · мёртвых ссылок ${s.deadLinks.length}`);
    s.notes.forEach(n => console.log('  note: ' + n));
    s.plates.forEach(n => console.log('  plate: ' + n.slice(0, 220)));
    s.warns.forEach(n => console.log('  warn: ' + n.slice(0, 220)));
    s.deadLinks.forEach(n => console.log('  DEAD LINK: ' + n));
    if (id === 'K-1' || (id === 'K-3' && ['Платежи','Обеспечение'].includes(tab)))
      await page.screenshot({ path: `${OUT}/${id}-${tab}.png`, fullPage: true });
  }
}

console.log(`\nИТОГО подсказок ${totalNotes} · мёртвых ссылок ${totalDead}`);
console.log('errors:', errs.length ? errs.slice(0,3) : 'нет');
await ctx.close();
