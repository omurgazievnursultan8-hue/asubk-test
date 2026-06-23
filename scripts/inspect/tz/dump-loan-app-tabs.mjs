// scripts/inspect/tz/dump-loan-app-tabs.mjs
// Inspects a loan application detail form: opens list, clicks Изменить on first row,
// walks all tabs, captures fields/sections/buttons. Also reads status values.
// Usage: node scripts/inspect/tz/dump-loan-app-tabs.mjs
// Output: JSON to stdout + screenshots in .auth/tz-la-tab*.png
import { chromium } from 'playwright-core';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';

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

// Navigate to loan-applications
await page.goto(BASE + 'loan-applications', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);

// Read the page URL (may have default filter) and list info
const listUrl = page.url();
console.log('LIST URL:', listUrl);

// Clear any generic filter to see all statuses
// Try to read status column values from the grid
const gridData = await page.evaluate(() => {
  function* walkAll(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let n = w.nextNode();
    while (n) { yield n; if (n.shadowRoot) yield* walkAll(n.shadowRoot); n = w.nextNode(); }
  }
  const cells = [];
  for (const el of walkAll(document)) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'vaadin-grid-cell-content') {
      const t = (el.textContent || '').trim().replace(/\s+/g, ' ');
      if (t) cells.push(t);
    }
  }
  return cells;
});

// Find distinct status values from cells
console.log('GRID CELLS (first 80):', JSON.stringify(gridData.slice(0, 80)));

// Look for stepper / status info
const stepperInfo = await page.evaluate(() => {
  const steppers = [];
  document.querySelectorAll('*').forEach(el => {
    const cls = el.className || '';
    if (typeof cls === 'string' && (cls.includes('step') || cls.includes('stepper'))) {
      const t = (el.innerText || '').trim();
      if (t && t.length < 200) steppers.push({ cls, t });
    }
  });
  return steppers.slice(0, 10);
});
console.log('STEPPER elements on list:', JSON.stringify(stepperInfo));

// Screenshot the list
await page.screenshot({ path: '.auth/tz-la-list.png', fullPage: true });

// Attempt to clear saved filter: look for a remove-filter button
await page.evaluate(() => {
  // Try to click remove (×) on any filter badge
  const removes = [...document.querySelectorAll('vaadin-button')].filter(b => {
    const t = (b.innerText || '').trim();
    return t === '×' || t === 'x' || t === '✕';
  });
  removes.forEach(b => b.click());
});
await page.waitForTimeout(1000);

// Select first row and click Изменить
const rowClicked = await page.evaluate(() => {
  // Find the grid and click first data row
  function* walkAll(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let n = w.nextNode();
    while (n) { yield n; if (n.shadowRoot) yield* walkAll(n.shadowRoot); n = w.nextNode(); }
  }
  for (const el of walkAll(document)) {
    if (el.tagName.toLowerCase() === 'vaadin-grid') {
      // Click on first non-header row
      const rows = el.querySelectorAll('tr[part~="row"]');
      if (rows.length > 1) { rows[1].click(); return true; }
    }
  }
  // Fallback: click the grid element itself
  const grid = document.querySelector('vaadin-grid');
  if (grid) { grid.click(); return 'grid-clicked'; }
  return false;
});
console.log('Row click result:', rowClicked);
await page.waitForTimeout(1000);

// Click Изменить button
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('vaadin-button')].find(b => /Изменить/i.test(b.innerText));
  if (btn) btn.click();
});
await page.waitForTimeout(3000);

const detailUrl = page.url();
console.log('DETAIL URL:', detailUrl);
await page.screenshot({ path: '.auth/tz-la-detail-header.png', fullPage: false });

// Get tab names on the detail form
const tabs = await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-tab')]
    .filter(t => t.getBoundingClientRect().width > 0)
    .map(t => t.innerText.trim())
);
console.log('TABS:', JSON.stringify(tabs));

// Read status stepper on the form
const stepperText = await page.evaluate(() => {
  const results = [];
  function* walkAll(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let n = w.nextNode();
    while (n) { yield n; if (n.shadowRoot) yield* walkAll(n.shadowRoot); n = w.nextNode(); }
  }
  for (const el of walkAll(document)) {
    const cls = (el.className || '');
    const tag = el.tagName.toLowerCase();
    if ((typeof cls === 'string' && (cls.includes('step') || cls.includes('status'))) ||
        tag.includes('step') || tag.includes('stepper')) {
      const t = (el.innerText || '').trim().replace(/\s+/g, ' ');
      if (t && t.length > 0 && t.length < 300) {
        results.push({ tag, cls: cls.substring(0, 60), t: t.substring(0, 200) });
      }
    }
  }
  return results.slice(0, 20);
});
console.log('STEPPER/STATUS elements on detail:', JSON.stringify(stepperText));

// Read header fields (status badges, etc.)
const headerInfo = await page.evaluate(() => {
  function* walkAll(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let n = w.nextNode();
    while (n) { yield n; if (n.shadowRoot) yield* walkAll(n.shadowRoot); n = w.nextNode(); }
  }
  const badges = [];
  for (const el of walkAll(document)) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'jmix-status-indicator' || tag === 'span' || tag === 'div') {
      const cls = (el.className || '').toString();
      if (cls.includes('badge') || cls.includes('status') || cls.includes('chip')) {
        const t = (el.innerText || '').trim();
        if (t && t.length < 50) badges.push({ tag, cls: cls.substring(0, 80), t });
      }
    }
    // Also capture any vaadin-text-field with status-related label
    if (tag === 'vaadin-text-field') {
      const lbl = el.getAttribute('label') || '';
      if (/статус|status/i.test(lbl)) {
        badges.push({ tag, lbl, val: el.value || '' });
      }
    }
  }
  return badges.slice(0, 30);
});
console.log('HEADER BADGES/STATUS:', JSON.stringify(headerInfo));

// Field extractor (shadow-DOM aware)
const extractFields = async () => page.evaluate(() => {
  const TAGS = [
    'vaadin-text-field', 'vaadin-text-area', 'vaadin-big-decimal-field',
    'vaadin-number-field', 'vaadin-integer-field', 'jmix-value-picker',
    'jmix-multi-value-picker', 'vaadin-combo-box', 'vaadin-select',
    'vaadin-checkbox', 'vaadin-date-picker', 'vaadin-multi-select-combo-box',
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

  return [...document.querySelectorAll(TAGS.join(','))]
    .filter(e => e.getBoundingClientRect().width > 0)
    .map(el => {
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        label: labelOf(el),
        required: el.required === true || el.hasAttribute('required'),
        readonly: el.readonly === true || el.hasAttribute('readonly'),
        value: (el.value !== undefined ? String(el.value) : '').substring(0, 80),
        y: Math.round(r.top),
        x: Math.round(r.left),
      };
    })
    .sort((a, b) => a.y - b.y || a.x - b.x);
});

// Section header extractor
const extractSections = async () => page.evaluate(() => {
  const out = [];
  document.querySelectorAll('*').forEach(e => {
    if (e.childElementCount) return;
    const r = e.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.top < 150) return;
    const t = (e.innerText || '').trim();
    const fs = parseFloat(getComputedStyle(e).fontSize);
    const fw = parseInt(getComputedStyle(e).fontWeight);
    if (t && t.length < 100 && fs >= 13 && fw >= 600) out.push({ t, y: Math.round(r.top) });
  });
  return [...new Map(out.map(h => [h.t + h.y, h])).values()].sort((a, b) => a.y - b.y);
});

// Button extractor
const extractButtons = async () => page.evaluate(() =>
  [...document.querySelectorAll('vaadin-button')]
    .filter(b => b.getBoundingClientRect().width > 0)
    .map(b => b.innerText.trim())
    .filter(t => t && t.length < 80)
);

const results = [];

for (let i = 0; i < tabs.length; i++) {
  await page.evaluate((idx) => {
    const allTabs = [...document.querySelectorAll('vaadin-tab')].filter(t => t.getBoundingClientRect().width > 0);
    allTabs[idx] && allTabs[idx].click();
  }, i);
  await page.waitForTimeout(2000);

  const fields = await extractFields();
  const sections = await extractSections();
  const buttons = await extractButtons();
  await page.screenshot({ path: `.auth/tz-la-tab${i + 1}.png`, fullPage: true });

  results.push({ tabIndex: i + 1, tabName: tabs[i], sections, fields, buttons });
  console.log(`\n--- TAB ${i + 1}: ${tabs[i]} ---`);
  console.log('sections:', JSON.stringify(sections.slice(0, 20)));
  console.log('fields:', JSON.stringify(fields.slice(0, 40)));
  console.log('action-buttons:', JSON.stringify(buttons.filter(b =>
    /OK|Сохранить|Отмена|Далее|Подтвер|Создать|Добавить|Удалить|Исключить|Выбра|Отправ|Отозва|комисс|кредит/i.test(b)
  )));
}

console.log('\n=== FULL DUMP ===');
console.log(JSON.stringify(results, null, 2));

await ctx.close();
