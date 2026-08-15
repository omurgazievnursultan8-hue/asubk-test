// Приёмка волны 03.08.2026 «фильтр реестра кредитов» (спека
// docs/superpowers/specs/2026-08-03-credit-registry-filter-design.md).
// Проверяет: быструю строку без раскрытия, объединённый поиск, старт без фильтров + чипы,
// счётчик условий, три строки панели без пустых хвостов, сброс.
//   node scripts/inspect/credit-filter-shot.mjs
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url';
import { resolve } from 'path';
import { mkdirSync } from 'fs';

const OUT = '.auth/credit-filter';
mkdirSync(OUT, { recursive: true });

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1680, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

await page.goto(pathToFileURL(resolve('mockups/loan-credit/credit.html')).href, { waitUntil: 'load' });
await page.waitForTimeout(400);
// Реестр показывает весь сид сам (КВ-52 снял переключатель набора), поэтому разворачивать
// показ больше не нужно: «Кара-Балта» = K-C11, каскад и счётчики видны сразу.

const chips = () => page.$$eval('#fChips .fchip', els => els.map(e => e.innerText.replace(/\s+/g, ' ').trim()));
const count = () => page.$eval('.pager .pinfo', el => el.textContent.trim());
const badge = () => page.$eval('#fBadge', el => (el.hidden ? '(скрыт)' : el.textContent));
const nums  = () => page.$$eval('#regBody tr td:first-child', tds => tds.map(t => t.innerText.split('\n')[0].trim()));

// 1. быстрая строка видна при свёрнутой панели
const quick = await page.$$eval('.tb-quick .field', fs => fs.map(f => ({
  label: f.querySelector('.flabel').textContent, w: Math.round(f.getBoundingClientRect().width),
})));
const panelOpen = await page.$eval('#filterBody', el => getComputedStyle(el).display);
await page.screenshot({ path: `${OUT}/01-collapsed.png` });

// 2. старт без предвыбранного ЖЦ: видны все договоры, чипов нет; чип появляется по выбору
const start = { count: await count(), chips: await chips(), badge: await badge() };
await page.selectOption('#fLifecycle', 'Действует');             // задать ЖЦ вручную
await page.waitForTimeout(200);
const withLc = { count: await count(), chips: await chips(), badge: await badge() };
await page.click('#fChips .fchip button');                       // снять «ЖЦ: Действует»
await page.waitForTimeout(200);
const afterChipX = { count: await count(), chips: await chips(), badge: await badge() };
await page.screenshot({ path: `${OUT}/02-chip-removed.png` });

// 3. объединённый поиск: текст и номер
await page.fill('#fQ', 'Кара-Балта'); await page.waitForTimeout(200);
const byName = { count: await count(), nums: await nums() };
await page.fill('#fQ', '56'); await page.waitForTimeout(200);
const byNum = { count: await count(), nums: await nums() };
await page.screenshot({ path: `${OUT}/03-search-56.png` });
await page.fill('#fQ', ''); await page.waitForTimeout(150);

// 4. счётчик условий: ЖЦ + диапазон дат + просрочка = 3
await page.click('#btnFilters'); await page.waitForTimeout(200);
await page.selectOption('#fLifecycle', 'Действует');
await page.fill('#fDateFrom', '2024-01-01');
await page.fill('#fDateTo', '2026-12-31');
await page.fill('#fOdMin', '30');
await page.waitForTimeout(250);
const three = { badge: await badge(), chips: await chips(), count: await count() };
await page.screenshot({ path: `${OUT}/04-badge-3.png`, fullPage: false });

// 5. геометрия панели: три строки, ширины по содержимому
const layout = await page.$$eval('#filterBody > *', els => els.map(e => {
  const r = e.getBoundingClientRect();
  const l = e.querySelector('.flabel');
  return { label: l ? l.textContent : '(действия)', top: Math.round(r.top), w: Math.round(r.width) };
}));
const rows = [...new Set(layout.map(x => x.top))].sort((a, b) => a - b);
const wOf = n => (layout.find(x => x.label.startsWith(n)) || {}).w;

// 6. сброс
await page.click('#filterBody .filter-actions .btn'); await page.waitForTimeout(250);
const afterReset = {
  count: await count(), chips: await chips(),
  vals: await page.$$eval('#fQ,#fLifecycle,#fCurator,#fOdMin,#fOdMax,#fProblem,#fCategory,#fProgram,#fSubgroup,#fRegion,#fDistrict,#fDateFrom,#fDateTo',
    els => els.map(e => e.id + '=' + (e.value || '∅'))),
};
await page.screenshot({ path: `${OUT}/05-after-reset.png` });

console.log('1 быстрая строка :', quick.map(q => `${q.label} ${q.w}px`).join(' · '), '| панель display:', panelOpen);
console.log('2 старт          :', start.count, '| чипы:', start.chips, '| бейдж:', start.badge);
console.log('  ЖЦ=Действует   :', withLc.count, '| чипы:', withLc.chips, '| бейдж:', withLc.badge);
console.log('  после × чипа   :', afterChipX.count, '| чипы:', afterChipX.chips, '| бейдж:', afterChipX.badge);
console.log('3 «Кара-Балта»   :', byName.count, '| строки:', byName.nums.join(', '));
console.log('  «56»           :', byNum.count, '| строки:', byNum.nums.join(', '));
console.log('4 ЖЦ+даты+просроч:', three.badge, '| чипы:', three.chips, '| выдача:', three.count);
console.log('5 строк панели   :', rows.length, '| ширины: Категория', wOf('Категория'), 'Программа', wOf('Программа'),
  'Просрочка', wOf('Просрочка'), 'Область', wOf('Область'));
console.log('  раскладка      :', layout.map(x => `${x.label}:${x.w}`).join(' · '));
console.log('6 после сброса   :', afterReset.count, '| чипы:', afterReset.chips);
console.log('  контролы       :', afterReset.vals.join(' '));
console.log('ERRORS :', errs.length ? errs : 'нет');
await ctx.close();
