// Вкладка «План»: ГОД стал строкой-группой над своими кварталами, охват вкладки — весь
// срок кредита, селектора года больше нет (КВ-22, волна 11.08.2026). Проверяем набор
// годов, умолчание раскрытия (текущий год до месяцев, прочие одной строкой), клик по
// году и по кварталу внутри года, «Свернуть всё» / «Развернуть всё», год без плана,
// плитки за весь срок и многолетний закрытый кредит K-6.
//   node scripts/inspect/credit-plan-years-shot.mjs
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url';
import { resolve } from 'path';
import { mkdirSync } from 'fs';

const OUT = '.auth/plan-years';
mkdirSync(OUT, { recursive: true });

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1680, height: 1600 },
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
// состояние вкладки: строки годов и кварталов (уровень различаем классом lvl2), сколько
// месяцев видно, плитки шапки, есть ли селектор года (его быть НЕ должно) и одна ли таблица
const snap = () => page.evaluate(() => ({
  tables: document.querySelectorAll('table.cgrid').length,
  yearSelect: [...document.querySelectorAll('select')].filter(s => /^\d{4}$/.test(s.value)).length,
  tiles: [...document.querySelectorAll('.phead-dims .dim-tile, .phead-dims > div')]
    .map(t => t.innerText.replace(/\s+/g,' ').trim()).filter(Boolean),
  toolbar: (document.querySelector('.gtoolbar .text-muted') || {}).innerText || '',
  groups: [...document.querySelectorAll('tr.gyear')].map(tr => ({
    lvl: tr.classList.contains('lvl2') ? 2 : 1,
    label: tr.querySelector('.gy').textContent,
    open: tr.classList.contains('open'),
    tds: [...tr.children].map(td => td.innerText.replace(/\s+/g,' ').trim()),
  })),
  months: document.querySelectorAll('table.cgrid tbody tr.pmonth').length,
  // чистка подсказок: абзаца над таблицей нет, «в расчёт не входит» снято со строк
  notes: [...document.querySelectorAll('#cr-card-body .panel-wrap:last-child .section-note')]
    .map(p => p.innerText.slice(0, 40)),
  dropNote: document.getElementById('cr-card-body').innerText.split('в расчёт не входит').length - 1,
}));
const brief = (s) => ({ tables: s.tables, yearSelect: s.yearSelect, months: s.months,
  toolbar: s.toolbar, groups: s.groups.map(g => `${'  '.repeat(g.lvl-1)}${g.label}${g.open?' ▾':' ▸'}`) });
const btn = (re) => page.evaluate(r => { const b=[...document.querySelectorAll('button')].find(x=>new RegExp(r).test(x.textContent)); if(!b) throw new Error('нет кнопки '+r); b.click(); }, re.source);
const clickGroup = (re) => page.evaluate(r => { const tr=[...document.querySelectorAll('tr.gyear')].find(x=>new RegExp(r).test(x.querySelector('.gy').textContent)); if(!tr) throw new Error('нет строки '+r); tr.click(); }, re.source);

// K-1 · выдан 12.05.2026 на 24 мес., план за 2026 и два месяца 2027 → годы 2026–2028
await openPlan('K-1');
const s1 = await snap();
console.log('K-1 по умолчанию:', JSON.stringify(brief(s1), null, 1));
console.log('K-1 плитки:', JSON.stringify(s1.tiles, null, 1));
console.log('K-1 год без плана (2028):', JSON.stringify((s1.groups.find(g => /^2028$/.test(g.label))||{}).tds));
console.log('K-1 подсказки вкладки:', JSON.stringify({ notes: s1.notes, dropNote: s1.dropNote }));
await page.screenshot({ path: `${OUT}/K-1-plan-years.png`, fullPage: true });

// клик по свёрнутому 2027 — год раскрывается СО СВОИМИ кварталами
await clickGroup(/^2027$/); await page.waitForTimeout(200);
console.log('K-1 после клика по 2027:', JSON.stringify(brief(await snap()), null, 1));

// клик по кварталу внутри года прячет только его три месяца
await clickGroup(/^1 квартал$/); await page.waitForTimeout(200);
console.log('K-1 после сворачивания 1 квартала 2026:', JSON.stringify(brief(await snap()).months));

// со свёрнутым кварталом кнопка предлагает «развернуть всё» — до месяцев всех годов
await btn(/Развернуть всё/); await page.waitForTimeout(200);
const sAll = await snap();
console.log('K-1 после «Развернуть всё»:', JSON.stringify({ months: sAll.months,
  years: sAll.groups.filter(g=>g.lvl===1).length, quarters: sAll.groups.filter(g=>g.lvl===2).length,
  toolbar: sAll.toolbar }));

await btn(/Свернуть всё/); await page.waitForTimeout(200);
console.log('K-1 после «Свернуть всё»:', JSON.stringify(brief(await snap()), null, 1));
await page.screenshot({ path: `${OUT}/K-1-plan-years-collapsed.png`, fullPage: true });

// K-6 · выдан 15.01.2024, закрыт «Погашен» 20.06.2026 — три года, июнь 2026 со 101 %
await openPlan('K-6');
const s6 = await snap();
console.log('K-6 по умолчанию:', JSON.stringify(brief(s6), null, 1));
console.log('K-6 плитки:', JSON.stringify(s6.tiles, null, 1));
console.log('K-6 годы построчно:', JSON.stringify(s6.groups.filter(g=>g.lvl===1).map(g=>g.tds), null, 1));
await page.screenshot({ path: `${OUT}/K-6-plan-years.png`, fullPage: true });

// K-3 · план на один месяц 2026: разрез не вырождается на коротком кредите
await openPlan('K-3');
console.log('K-3 по умолчанию:', JSON.stringify(brief(await snap()), null, 1));

console.log('errors:', errs.length ? errs.slice(0,3) : 'нет');
await ctx.close();
