// Вкладка «План»: охват — ОДИН год, выбранный селектором; набор годов селектора строится
// по данным кредита (весь срок ∪ годы с планом ∪ годы с фактом), а не смещением от даты
// среза — старая формула не доставала до конца срока. Проверяем набор и умолчание года,
// переключение, таблицу «квартал → месяцы» только выбранного года, умолчание раскрытия
// (ОДИН квартал: среза; год позади среза — четвёртый, впереди — первый), раскрытие и
// свёртку кварталов, год без плана, плитки за год и чистоту вкладки от подсказок.
//   node scripts/inspect/credit-plan-years-shot.mjs
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url';
import { resolve } from 'path';
import { mkdirSync } from 'fs';

const OUT = '.auth/plan-years';
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

const openPlan = async (id) => {
  await page.evaluate(i => CR.openDetail(i), id);
  await page.evaluate(() => { const t=[...document.querySelectorAll('.dtab')].find(x=>/^План$/.test(x.textContent.trim())); t&&t.click(); });
  await page.waitForTimeout(250);
};
// состояние вкладки: годы селектора и выбранный, строки кварталов, число месяцев, плитки,
// первый столбец таблицы (в нём не должно быть строк года) и подсказки (их быть не должно)
const snap = () => page.evaluate(() => {
  const sel = [...document.querySelectorAll('select')].find(s => /^\d{4}$/.test(s.value));
  return {
    tables: document.querySelectorAll('table.cgrid').length,
    years: sel ? [...sel.options].map(o => +o.value) : null,
    year: sel ? +sel.value : null,
    tiles: [...document.querySelectorAll('.phead-dims .dim-tile, .phead-dims > div')]
      .map(t => t.innerText.replace(/\s+/g,' ').trim()).filter(Boolean),
    toolbar: [...document.querySelectorAll('.gtoolbar .text-muted')].map(x => x.innerText).join(' | '),
    quarters: [...document.querySelectorAll('tr.gyear')].map(tr => ({
      label: tr.querySelector('.gy').textContent,
      open: tr.classList.contains('open'),
      tds: [...tr.children].map(td => td.innerText.replace(/\s+/g,' ').trim()),
    })),
    months: [...document.querySelectorAll('table.cgrid tbody tr.pmonth')].map(tr => tr.children[0].innerText.trim()),
    notes: [...document.querySelectorAll('#cr-card-body .panel-wrap:last-child .section-note')]
      .map(p => p.innerText.slice(0, 40)),
    dropNote: document.getElementById('cr-card-body').innerText.split('в расчёт не входит').length - 1,
  };
});
const brief = (s) => ({ tables: s.tables, years: s.years, year: s.year, months: s.months.length,
  toolbar: s.toolbar, quarters: s.quarters.map(q => q.label + (q.open ? ' ▾' : ' ▸')) });
const setYear = (y) => page.evaluate(v => CR.setPlanYear(v), y);
const btn = (re) => page.evaluate(r => { const b=[...document.querySelectorAll('button')].find(x=>new RegExp(r).test(x.textContent)); if(!b) throw new Error('нет кнопки '+r); b.click(); }, re.source);
const clickQ = (re) => page.evaluate(r => { const tr=[...document.querySelectorAll('tr.gyear')].find(x=>new RegExp(r).test(x.querySelector('.gy').textContent)); if(!tr) throw new Error('нет строки '+r); tr.click(); }, re.source);

// K-1 · выдан 12.05.2026 на 24 мес. (срок до мая 2028), план на 2026 и два месяца 2027.
// Старая формула селектора дала бы 2026–2027 — 2028 в списке сторожит починку.
await openPlan('K-1');
const s1 = await snap();
console.log('K-1 по умолчанию:', JSON.stringify(brief(s1), null, 1));
console.log('K-1 плитки:', JSON.stringify(s1.tiles, null, 1));
console.log('K-1 месяцы только выбранного года:',
  JSON.stringify({ первый: s1.months[0], последний: s1.months[s1.months.length-1] }));
console.log('K-1 подсказки вкладки:', JSON.stringify({ notes: s1.notes, dropNote: s1.dropNote }));
await page.screenshot({ path: `${OUT}/K-1-plan-year.png`, fullPage: true });

// 2027 — план стоит, факта нет; 2028 — год срока вовсе без плана
await setYear(2027); await page.waitForTimeout(200);
const s27 = await snap();
console.log('K-1 год 2027:', JSON.stringify({ year: s27.year, months: s27.months.length, tiles: s27.tiles.slice(-4) }, null, 1));
await setYear(2028); await page.waitForTimeout(200);
const s28 = await snap();
console.log('K-1 год 2028 (без плана):', JSON.stringify({ year: s28.year, months: s28.months.length,
  tiles: s28.tiles.slice(-4), квартал: s28.quarters[0].tds }, null, 1));
await page.screenshot({ path: `${OUT}/K-1-plan-year-2028.png`, fullPage: true });

// раскрытие кварталов — на выбранном году; умолчание = один квартал (среза)
await setYear(2026); await page.waitForTimeout(200);
await clickQ(/^1 квартал$/); await page.waitForTimeout(200);
console.log('K-1 после раскрытия 1 квартала:', JSON.stringify(brief(await snap()), null, 1));
await btn(/Развернуть все кварталы/); await page.waitForTimeout(200);
console.log('K-1 «Развернуть все кварталы»:', JSON.stringify(brief(await snap()).months));
await btn(/Свернуть все кварталы/); await page.waitForTimeout(200);
const sC = await snap();
console.log('K-1 «Свернуть все кварталы»:', JSON.stringify(brief(sC), null, 1));

// смена года возвращает умолчание раскрытия (один квартал), а не переносит свёртку
await setYear(2027); await page.waitForTimeout(200);
console.log('K-1 после смены года со свёрнутыми кварталами:', JSON.stringify(brief(await snap()).quarters));

// K-6 · выдан 15.01.2024, закрыт «Погашен» 20.06.2026 — селектор 2024–2026, июнь 2026 со 101 %
await openPlan('K-6');
const s6 = await snap();
console.log('K-6 по умолчанию:', JSON.stringify(brief(s6), null, 1));
console.log('K-6 плитки:', JSON.stringify(s6.tiles.slice(-4), null, 1));
await setYear(2024); await page.waitForTimeout(200);
console.log('K-6 год 2024:', JSON.stringify((await snap()).tiles.slice(-4), null, 1));
await page.screenshot({ path: `${OUT}/K-6-plan-year-2024.png`, fullPage: true });

// K-3 · один год в наборе — селектор с единственным вариантом, вкладка не вырождается
await openPlan('K-3');
console.log('K-3 по умолчанию:', JSON.stringify(brief(await snap()), null, 1));

console.log('errors:', errs.length ? errs.slice(0,3) : 'нет');
await ctx.close();
