// scripts/inspect/tz/dump-disbursement-open.mjs
// Opens disbursement detail by clicking "Изменить" in the list, then dumps.
import { chromium } from 'playwright-core';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';
const rowIndex = parseInt(process.argv[2] || '0'); // 0-based row index to open

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1700, height: 1200 },
});
const page = ctx.pages()[0] || await ctx.newPage();

// Login
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', USER);
  await page.fill('input[name=password]', PASS);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}),
    page.keyboard.press('Enter'),
  ]);
  await page.waitForTimeout(2500);
}

await page.goto(BASE + 'disbursements', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);

// Click first data row to select it
await page.evaluate((row) => {
  const grids = document.querySelectorAll('vaadin-grid');
  for (const grid of grids) {
    const cells = [...grid.querySelectorAll('vaadin-grid-cell-content')]
      .filter(c => c.getBoundingClientRect().width > 0);
    // Find data rows (non-header cells that have actual data)
    const dataCells = cells.filter(c => {
      const text = c.innerText?.trim();
      return text && /\d/.test(text);
    });
    if (dataCells.length > row) {
      dataCells[row].click();
      return;
    }
  }
}, rowIndex * 8); // each row has ~8 cells
await page.waitForTimeout(1000);

// Find and click Изменить button
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('vaadin-button')]
    .filter(b => b.getBoundingClientRect().width > 0 && b.innerText.trim() === 'Изменить');
  if (btns.length > 0) btns[0].click();
});
await page.waitForTimeout(3000);

console.log('PAGE URL after Изменить:', page.url());
console.log('PAGE TITLE:', await page.title());

// Field extractor
const fields = await page.evaluate(() => {
  const TAGS = [
    'vaadin-text-field', 'vaadin-text-area', 'vaadin-big-decimal-field',
    'vaadin-number-field', 'vaadin-integer-field', 'jmix-value-picker',
    'vaadin-combo-box', 'vaadin-select', 'vaadin-checkbox', 'vaadin-date-picker',
    'vaadin-date-time-picker',
  ];

  const labelOf = (el) => {
    let l = el.label || el.getAttribute('label');
    if (!l) {
      const id = el.getAttribute('aria-labelledby');
      if (id) { const t = id.split(' ').map(i => document.getElementById(i)?.innerText || '').join(' ').trim(); if (t) l = t; }
    }
    if (!l) { const p = el.closest('vaadin-form-item'); if (p) { const lab = p.querySelector('[slot=label]'); if (lab) l = lab.innerText; } }
    if (!l && el.shadowRoot) { const sr = el.shadowRoot.querySelector('[part=label]'); if (sr) l = sr.innerText; }
    return (l || '').replace(/\s+/g, ' ').trim() || null;
  };

  const valueOf = (el) => {
    try { return el.value !== undefined ? String(el.value) : (el.getAttribute('value') || ''); }
    catch { return ''; }
  };

  return [...document.querySelectorAll(TAGS.join(','))]
    .filter(e => e.getBoundingClientRect().width > 0)
    .map(el => {
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        label: labelOf(el),
        required: el.required === true || el.hasAttribute('required'),
        readonly: el.readonly === true || el.hasAttribute('readonly'),
        value: valueOf(el),
        y: Math.round(r.top),
        x: Math.round(r.left),
      };
    })
    .sort((a, b) => a.y - b.y || a.x - b.x);
});

const NAV_RE = /^(Приложение|Мониторинг|Справочники|Система|Поручительства|Корпоративное|Документы|Отчёты|Регистры|СУГС|Взыскание|Организация|Оформление|Условия|Заемщик|Кредит|Залог|Орг|Кураторство|Сервисы|Администрирование|Безопасность|Инструменты|АСУБК)/;
const buttons = await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-button')]
    .filter(b => b.getBoundingClientRect().width > 0)
    .map(b => b.innerText.trim())
    .filter(t => t && t.length < 80)
);

// Grid with schedule
const grids = await page.evaluate(() => {
  const results = [];
  document.querySelectorAll('vaadin-grid').forEach(grid => {
    if (grid.getBoundingClientRect().width < 1) return;
    const headers = [...grid.querySelectorAll('vaadin-grid-column, vaadin-grid-sort-column')]
      .map(c => c.getAttribute('header') || c.getAttribute('path') || '');
    const cells = [...grid.querySelectorAll('vaadin-grid-cell-content')]
      .filter(c => c.getBoundingClientRect().width > 0)
      .map(c => c.innerText.trim())
      .filter(t => t.length > 0)
      .slice(0, 80);
    results.push({ headers: headers.filter(Boolean), sampleCells: cells });
  });
  return results;
});

console.log('\nFIELDS:', JSON.stringify(fields.map(f => ({
  label: f.label, tag: f.tag, required: f.required, readonly: f.readonly, value: f.value
})), null, 2));
console.log('\nBUTTONS:', JSON.stringify(buttons.filter(b => !NAV_RE.test(b))));
console.log('\nGRIDS:', JSON.stringify(grids, null, 2));

await page.screenshot({ path: '.auth/tz-disbursement-open.png', fullPage: true });
await ctx.close();
console.log('\n=== DONE ===');
