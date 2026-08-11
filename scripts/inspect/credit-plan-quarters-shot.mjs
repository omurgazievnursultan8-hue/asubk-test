// Вкладка «План»: кварталы и месяцы в ОДНОЙ таблице — квартал стоит строкой-группой
// над своими тремя месяцами, отдельной карточки «Итоги года» больше нет (КВ-21,
// волна 11.08.2026). Проверяем умолчание (все четыре развёрнуты), клик по кварталу,
// «Свернуть все кварталы» (даёт ровно прежний вид «Итогов года») и обратно.
//   node scripts/inspect/credit-plan-quarters-shot.mjs
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url';
import { resolve } from 'path';
import { mkdirSync } from 'fs';

const OUT = '.auth/plan-quarters';
mkdirSync(OUT, { recursive: true });

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1680, height: 1500 },
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
// состояние таблицы: строки квартала (подпись, развёрнут ли, ячейки) + сколько месяцев видно
// + сколько на вкладке таблиц вообще (должна остаться ОДНА — вторая карточка снята)
const snap = () => page.evaluate(() => ({
  tables: document.querySelectorAll('table.cgrid').length,
  quarters: [...document.querySelectorAll('tr.gyear')].map(tr => ({
    q: tr.querySelector('.gy').textContent,
    open: tr.classList.contains('open'),
    tds: [...tr.children].map(td => td.innerText.replace(/\s+/g,' ').trim()),
  })),
  months: [...document.querySelectorAll('table.cgrid tbody tr')].filter(tr => !tr.classList.contains('gyear')
        && /^[А-Яа-я]+ \d{4}/.test((tr.children[0]||{}).innerText || '')).length,
}));

for (const id of ['K-1', 'K-3']) {
  await openPlan(id);
  console.log(id, 'по умолчанию:', JSON.stringify(await snap(), null, 1));
  await page.screenshot({ path: `${OUT}/${id}-plan.png`, fullPage: true });
}

// K-1: свернуть 1 квартал кликом по строке
await openPlan('K-1');
await page.evaluate(() => { const tr=[...document.querySelectorAll('tr.gyear')].find(x=>/^1 квартал/.test(x.querySelector('.gy').textContent)); tr&&tr.click(); });
await page.waitForTimeout(200);
console.log('K-1 после клика по 1 кварталу:', JSON.stringify(await snap()));

// с одним свёрнутым кнопка предлагает «развернуть все» — возвращаемся к двенадцати месяцам
const btn = (re) => page.evaluate(r => { const b=[...document.querySelectorAll('button')].find(x=>new RegExp(r).test(x.textContent)); if(!b) throw new Error('нет кнопки '+r); b.click(); }, re.source);
await btn(/Развернуть все кварталы/); await page.waitForTimeout(200);
console.log('K-1 после «развернуть все»:', JSON.stringify(await snap()));

// «Свернуть все кварталы» → остаются четыре итоговые строки (прежняя карточка «Итоги года»)
await btn(/Свернуть все кварталы/); await page.waitForTimeout(200);
console.log('K-1 после «свернуть все»:', JSON.stringify(await snap()));
await page.screenshot({ path: `${OUT}/K-1-plan-collapsed.png`, fullPage: true });

// смена года сбрасывает набор кварталов к умолчанию (planQuartersKey = кредит|год)
await page.evaluate(() => { const s=[...document.querySelectorAll('select')].find(x=>/^\d{4}$/.test(x.value)); if(s){ s.value=String(+s.value+1); s.dispatchEvent(new Event('change')); } });
await page.waitForTimeout(200);
console.log('K-1 после смены года (ожидаем 4 развёрнутых):', JSON.stringify((await snap()).quarters.map(q=>q.open)));

console.log('errors:', errs.length ? errs.slice(0,3) : 'нет');
await ctx.close();
