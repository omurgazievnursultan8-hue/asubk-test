// scripts/inspect/tz/dump-subloan-tabs.mjs
// Walks the 4-tab tranche (sub-loan) detail for a given record id.
// Usage: node scripts/inspect/tz/dump-subloan-tabs.mjs [id]
import { chromium } from 'playwright-core';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';
const recordId = process.argv[2] || '1';

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1700, height: 1100 },
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

// Navigate directly to the sub-loan detail page
await page.goto(BASE + `sub-loans/${recordId}`, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

const pageTitle = await page.title();
console.log('PAGE TITLE:', pageTitle);
console.log('PAGE URL:', page.url());

// Get tab names
const tabs = await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-tab')]
    .filter(t => t.getBoundingClientRect().width > 0)
    .map(t => t.innerText.trim())
);
console.log('TABS:', JSON.stringify(tabs));

// Field extractor (shadow-DOM aware)
const extractFields = async () => page.evaluate(() => {
  const TAGS = [
    'vaadin-text-field', 'vaadin-text-area', 'vaadin-big-decimal-field',
    'vaadin-number-field', 'vaadin-integer-field', 'jmix-value-picker',
    'jmix-multi-value-picker', 'vaadin-combo-box', 'vaadin-select',
    'vaadin-checkbox', 'vaadin-date-picker', 'vaadin-multi-select-combo-box',
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
    try {
      return el.value !== undefined ? String(el.value) : (el.getAttribute('value') || '');
    } catch { return ''; }
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

// Button extractor (exclude nav)
const NAV_RE = /^(Приложение|Мониторинг|Справочники|Система|Поручительства|Корпоративное|Документы|Отчёты|Регистры|СУГС|Взыскание|Организация|Оформление|Условия|Заемщик|Кредит|Залог|Орг|Кураторство|Сервисы|Администрирование|Безопасность|Инструменты|АСУБК)/;
const extractButtons = async () => page.evaluate(() =>
  [...document.querySelectorAll('vaadin-button')]
    .filter(b => b.getBoundingClientRect().width > 0)
    .map(b => b.innerText.trim())
    .filter(t => t && t.length < 80)
);

// Grid content extractor
const extractGrid = async () => page.evaluate(() => {
  const results = [];
  document.querySelectorAll('vaadin-grid').forEach(grid => {
    if (grid.getBoundingClientRect().width < 1) return;
    const headers = [...grid.querySelectorAll('vaadin-grid-column, vaadin-grid-sort-column')]
      .map(c => c.getAttribute('header') || c.getAttribute('path') || '');
    const cells = [...grid.querySelectorAll('vaadin-grid-cell-content')]
      .filter(c => c.getBoundingClientRect().width > 0)
      .map(c => c.innerText.trim())
      .filter(t => t.length > 0)
      .slice(0, 60);
    results.push({ headers: headers.filter(Boolean), sampleCells: cells });
  });
  return results;
});

for (let i = 0; i < tabs.length; i++) {
  await page.evaluate((idx) => {
    const allTabs = [...document.querySelectorAll('vaadin-tab')].filter(t => t.getBoundingClientRect().width > 0);
    allTabs[idx] && allTabs[idx].click();
  }, i);
  await page.waitForTimeout(2000);

  const fields = await extractFields();
  const buttons = await extractButtons();
  const grids = await extractGrid();
  const screenshot = `.auth/tz-subloan-${recordId}-tab${i + 1}.png`;
  await page.screenshot({ path: screenshot, fullPage: true });

  console.log(`\n=== TAB ${i + 1}: ${tabs[i]} ===`);
  console.log('FIELDS:', JSON.stringify(fields.map(f => ({
    label: f.label, tag: f.tag, required: f.required, readonly: f.readonly, value: f.value
  }))));
  console.log('BUTTONS:', JSON.stringify(buttons.filter(b => !NAV_RE.test(b))));
  console.log('GRIDS:', JSON.stringify(grids));
}

await ctx.close();
console.log('\n=== DONE ===');
