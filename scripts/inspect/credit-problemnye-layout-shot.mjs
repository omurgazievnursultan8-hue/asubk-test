// Вкладка «Проблемные» после перекладки на две колонки (11.08.2026, КВ-20):
// слева оценка (категория + подгруппа), справа работа с долгом (реструктуризация +
// закрытие), ниже на всю ширину — факторы, требования, суд.
// Снимает состав карточек, их колонку/ширину и геометрию (нет ли горизонтального
// скролла у таблиц и не разъехались ли колонки по высоте).
//   node scripts/inspect/credit-problemnye-layout-shot.mjs
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url';
import { resolve } from 'path';
import { mkdirSync } from 'fs';

const OUT = '.auth/problemnye-layout';
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

const open = async (id) => {
  await page.evaluate(i => CR.openDetail(i), id);
  await page.evaluate(() => { const t=[...document.querySelectorAll('.dtab')].find(x=>/^Проблемные$/.test(x.textContent.trim())); t&&t.click(); });
  await page.waitForTimeout(250);
};
const snap = () => page.evaluate(() => {
  const host = document.querySelector('#cr-detail') || document.body;
  const grid = host.querySelector('.pcards');
  const gb = grid ? grid.getBoundingClientRect() : null;
  const cards = [...host.querySelectorAll('.pcard')].map(p => {
    const r = p.getBoundingClientRect();
    const h = p.querySelector('.section-h');
    return {
      title: h ? h.innerText.replace(/\s+/g,' ').trim() : '(без заголовка)',
      col: !gb ? '?' : (r.width > gb.width * 0.9 ? 'wide' : (r.left - gb.left < gb.width * 0.25 ? 'left' : 'right')),
      w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.top),
    };
  });
  return {
    cards,
    // сбалансированность колонок верхней полосы: разница низа левой и правой стопки
    colStacks: [...host.querySelectorAll('.pcol')].map(c => Math.round(c.getBoundingClientRect().height)),
    // таблица шире своей обёртки = горизонтальный скролл
    scrollingTables: [...host.querySelectorAll('.cgrid-wrap')]
      .filter(w => w.scrollWidth > w.clientWidth + 1)
      .map(w => (w.previousElementSibling && w.previousElementSibling.innerText || '?').replace(/\s+/g,' ').trim().slice(0,40)),
    pageScrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    notes: [...host.querySelectorAll('.section-note')].map(p => p.innerText.replace(/\s+/g,' ').trim().slice(0,70)),
  };
});

for (const id of ['K-3', 'K-1', 'K-4', 'K-C12', 'K-C16']) {
  await open(id);
  console.log(id, JSON.stringify(await snap(), null, 1));
  await page.screenshot({ path: `${OUT}/${id}-problemnye.png`, fullPage: true });
}

// узкая полоса — сетка обязана схлопнуться в одну колонку (@media max-width:1100px)
await page.setViewportSize({ width: 1040, height: 1200 });
await open('K-3');
const narrow = await snap();
console.log('1040px:', JSON.stringify({ cols: narrow.cards.map(c => c.col), pageScrollX: narrow.pageScrollX }));
await page.screenshot({ path: `${OUT}/K-3-problemnye-1040.png`, fullPage: true });

console.log('errors:', errs.length ? errs.slice(0,3) : 'нет');
await ctx.close();
