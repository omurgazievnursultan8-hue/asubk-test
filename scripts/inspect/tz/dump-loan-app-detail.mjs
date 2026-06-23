// scripts/inspect/tz/dump-loan-app-detail.mjs
// Inspects a loan application detail form by navigating directly to a known ID.
// Opens the list, selects first row via keyboard, then Изменить.
// Usage: node scripts/inspect/tz/dump-loan-app-detail.mjs [appId]
// E.g.: node scripts/inspect/tz/dump-loan-app-detail.mjs 60
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

// Try to click the first row in the grid using the vaadin-grid item click
const firstRowInfo = await page.evaluate(() => {
  function* walkAll(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let n = w.nextNode();
    while (n) { yield n; if (n.shadowRoot) yield* walkAll(n.shadowRoot); n = w.nextNode(); }
  }
  let gridEl = null;
  for (const el of walkAll(document)) {
    if (el.tagName.toLowerCase() === 'vaadin-grid') { gridEl = el; break; }
  }
  if (!gridEl) return { found: false };
  // Get all rendered items
  const items = gridEl._dataProviderController?.rootCache?.items || [];
  const firstItem = items[0];
  return { found: true, itemCount: items.length, firstItem: firstItem ? JSON.stringify(firstItem).substring(0, 200) : null };
});
console.log('Grid info:', JSON.stringify(firstRowInfo));

// Click on the first cell of first data row
await page.evaluate(() => {
  function* walkAll(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let n = w.nextNode();
    while (n) { yield n; if (n.shadowRoot) yield* walkAll(n.shadowRoot); n = w.nextNode(); }
  }
  // Find vaadin-grid and click first row via cell content
  const cells = [];
  for (const el of walkAll(document)) {
    if (el.tagName.toLowerCase() === 'vaadin-grid-cell-content') {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.top > 100) {
        cells.push({ el, top: r.top, left: r.left });
      }
    }
  }
  cells.sort((a, b) => a.top - b.top || a.left - b.left);
  // First 8 are header row, click ~9th cell (first data cell)
  if (cells.length > 8) cells[8].el.click();
});
await page.waitForTimeout(800);

// Now click Изменить button
const btnClicked = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('vaadin-button')].find(b => {
    const t = (b.innerText || '').trim();
    return t === 'Изменить';
  });
  if (btn) { btn.click(); return 'clicked'; }
  return 'not-found';
});
console.log('Изменить button:', btnClicked);
await page.waitForTimeout(4000);

const detailUrl = page.url();
console.log('DETAIL URL:', detailUrl);

// If still on list, try double-click approach
if (!detailUrl.includes('/loan-applications/')) {
  console.log('Still on list, trying double-click...');
  await page.evaluate(() => {
    function* walkAll(root) {
      const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
      let n = w.nextNode();
      while (n) { yield n; if (n.shadowRoot) yield* walkAll(n.shadowRoot); n = w.nextNode(); }
    }
    const cells = [];
    for (const el of walkAll(document)) {
      if (el.tagName.toLowerCase() === 'vaadin-grid-cell-content') {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.top > 100) {
          cells.push({ el, top: r.top, left: r.left });
        }
      }
    }
    cells.sort((a, b) => a.top - b.top || a.left - b.left);
    if (cells.length > 8) {
      const el = cells[8].el;
      el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    }
  });
  await page.waitForTimeout(4000);
  console.log('DETAIL URL after double-click:', page.url());
}

// Screenshot header
await page.screenshot({ path: '.auth/tz-la-detail-open.png', fullPage: false });

// Check if we're on a detail page
const currentUrl = page.url();
if (currentUrl.includes('/loan-applications/') || !currentUrl.includes('?')) {
  console.log('On detail page:', currentUrl);
} else {
  // Try direct URL approach - navigate to a known application record
  // From the dump we know "Заявка - 60" exists. Let's try to find its ID.
  // Navigate to list and find IDs via API
  await page.goto(BASE + 'loan-applications', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);

  // Try to get application IDs from the page's Jmix data
  const appIds = await page.evaluate(() => {
    // Look for data in the grid's internal store
    function findGrid(root) {
      const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
      let n = w.nextNode();
      while (n) {
        if (n.tagName && n.tagName.toLowerCase() === 'vaadin-grid') return n;
        if (n.shadowRoot) { const g = findGrid(n.shadowRoot); if (g) return g; }
        n = w.nextNode();
      }
      return null;
    }
    const g = findGrid(document);
    if (!g) return [];
    const cache = g._dataProviderController?.rootCache;
    if (!cache) return [];
    const items = cache.items || [];
    return items.map(item => ({
      id: item.id,
      number: item.number,
      status: item.status,
    })).filter(i => i.id).slice(0, 10);
  });
  console.log('App IDs from grid:', JSON.stringify(appIds));

  if (appIds.length > 0) {
    const firstId = appIds[0].id;
    await page.goto(BASE + 'loan-applications/' + firstId, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);
    console.log('DIRECT URL:', page.url());
  }
}

const finalUrl = page.url();
console.log('FINAL DETAIL URL:', finalUrl);
await page.screenshot({ path: '.auth/tz-la-detail-final.png', fullPage: true });

// Get tab names on the detail form
const tabs = await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-tab')]
    .filter(t => t.getBoundingClientRect().width > 0)
    .map(t => t.innerText.trim())
);
console.log('TABS:', JSON.stringify(tabs));

if (tabs.length === 0) {
  console.log('No tabs found. Page content:');
  const content = await page.evaluate(() => document.body.innerText.substring(0, 1000));
  console.log(content);
  await ctx.close();
  process.exit(0);
}

// Read status stepper
const stepperInfo = await page.evaluate(() => {
  const results = [];
  // Look for any element containing status/step text
  function* walkAll(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let n = w.nextNode();
    while (n) { yield n; if (n.shadowRoot) yield* walkAll(n.shadowRoot); n = w.nextNode(); }
  }
  for (const el of walkAll(document)) {
    const tag = el.tagName.toLowerCase();
    const cls = (el.className || '').toString();
    const t = (el.innerText || '').trim();
    // Check for stepper-like elements
    if (tag.includes('step') || cls.includes('step') || cls.includes('stepper') ||
        cls.includes('wizard') || cls.includes('progress')) {
      if (t && t.length < 500) results.push({ tag, cls: cls.substring(0, 80), text: t.substring(0, 200) });
    }
  }
  return results.slice(0, 20);
});
console.log('STEPPER elements:', JSON.stringify(stepperInfo));

// Read header area (first ~200px) for status info
const headerFields = await page.evaluate(() => {
  const TAGS = ['vaadin-text-field', 'vaadin-select', 'jmix-entity-combo-box'];
  const all = [];
  document.querySelectorAll(TAGS.join(',')).forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.top < 250 && r.width > 0) {
      all.push({
        tag: el.tagName.toLowerCase(),
        label: el.getAttribute('label') || '',
        value: el.value || '',
        readonly: el.hasAttribute('readonly'),
        y: Math.round(r.top),
      });
    }
  });
  return all.sort((a, b) => a.y - b.y);
});
console.log('HEADER FIELDS:', JSON.stringify(headerFields));

// Field extractor
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
        value: (el.value !== undefined ? String(el.value) : '').substring(0, 100),
        y: Math.round(r.top),
        x: Math.round(r.left),
      };
    })
    .sort((a, b) => a.y - b.y || a.x - b.x);
});

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

const extractButtons = async () => page.evaluate(() =>
  [...document.querySelectorAll('vaadin-button')]
    .filter(b => b.getBoundingClientRect().width > 0)
    .map(b => (b.innerText || '').trim())
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
  console.log('fields:', JSON.stringify(fields.slice(0, 50)));
  console.log('action-buttons:', JSON.stringify(buttons.filter(b =>
    /OK|Сохранить|Отмена|Далее|Подтвер|Создать|Добавить|Удалить|Исключить|Выбра|Отправ|Отозва|комисс|кредит|регистр/i.test(b)
  )));
}

await ctx.close();
