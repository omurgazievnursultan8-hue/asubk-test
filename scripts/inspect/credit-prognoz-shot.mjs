// Вкладка «Прогноз» после разбора 10.08.2026 (ADR-0104): три ответа плитками, таблица
// свёрнута до расхождений с графиком, особые состояния названы плитками.
// K-1 — есть и хвост, и будущее (сюда же вносим досрочку и смотрим, как уезжает закрытие);
// K-3 — мировое соглашение + исчерпанный график; K-6b — закрытый (списан).
//   node scripts/inspect/credit-prognoz-shot.mjs
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url';
import { resolve } from 'path';
import { mkdirSync } from 'fs';

const OUT = '.auth/prognoz';
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
  await page.evaluate(() => { const t=[...document.querySelectorAll('.dtab')].find(x=>/^Прогноз$/.test(x.textContent.trim())); t&&t.click(); });
  await page.waitForTimeout(250);
};
// плитки (подпись/значение/сноска), плашки и число строк таблицы
const snap = () => page.evaluate(() => ({
  dims: [...document.querySelectorAll('.phead-dims .dim')].map(d => ({
    l: (d.querySelector('.dl')||{}).innerText,
    v: (d.querySelector('.dv')||{}).innerText,
    s: ((d.querySelector('.src')||{}).innerText || '').replace(/\s+/g,' ').trim(),
  })),
  plates: [...document.querySelectorAll('.info-plate')].map(p => p.innerText.replace(/\s+/g,' ').trim().slice(0,110)),
  rows: [...document.querySelectorAll('table.cgrid tbody tr')].filter(tr => /^№\d+$/.test((tr.children[0]||{}).innerText||'')).length,
  toolbar: ((document.querySelector('.gtoolbar .text-muted')||{}).innerText || '').replace(/\s+/g,' ').trim(),
}));

for (const id of ['K-1', 'K-3', 'K-6b']) {
  await open(id);
  console.log(id, JSON.stringify(await snap(), null, 1));
  await page.screenshot({ path: `${OUT}/${id}-prognoz.png`, fullPage: true });
}

// K-1: досрочка 40 000 — закрытие обязано уехать раньше договорной даты, хвост расписания обнулиться
await open('K-1');
await page.evaluate(() => {
  const c = CR.db.credits.find(x => x.id === 'K-1');
  c.mirror.payments.push({ num: 900, date: '20.07.2026', bindDate: '20.07.2026', amount: 40000,
    currency: 'KGS', rate: null, tranche: 1, reg: 'Импорт ЦК', match: 'Подтверждён ЦК',
    frozen: false, dispute: null, method: 'денежными средствами',
    layers: { principal: 40000, interest: 0, penalty: 0, fees: 0 } });
  CR.openDetail('K-1', 'Прогноз');
});
await page.waitForTimeout(250);
console.log('K-1 после досрочки 40000:', JSON.stringify(await snap(), null, 1));
await page.screenshot({ path: `${OUT}/K-1-prognoz-dosrochka.png`, fullPage: true });

// кнопка «Показать все позиции» — состав таблицы переключается, страница не падает
await page.evaluate(() => { const b=[...document.querySelectorAll('button')].find(x=>/Показать все позиции/.test(x.textContent)); b&&b.click(); });
await page.waitForTimeout(200);
console.log('K-1 после «показать все»:', JSON.stringify(await snap()));
await page.screenshot({ path: `${OUT}/K-1-prognoz-all.png`, fullPage: true });
await page.evaluate(() => { const b=[...document.querySelectorAll('button')].find(x=>/Только расхождения/.test(x.textContent)); b&&b.click(); });
await page.waitForTimeout(200);
console.log('K-1 обратно:', JSON.stringify(await snap()));

console.log(errs.length ? 'ОШИБКИ: ' + errs.join(' | ') : 'ошибок консоли нет');
await ctx.close();
