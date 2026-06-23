// probe-borrower-filter.mjs
// Extract the filter selector options on the loan-applicants list (statuses, etc.)
import { chromium } from 'playwright-core';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1700, height: 1100 },
});
const page = ctx.pages()[0] || await ctx.newPage();

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

// Navigate without filter
await page.goto(BASE + 'loan-applicants', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);

// Get all select options for status filter
const filterInfo = await page.evaluate(() => {
  function* walkAll(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let n = w.nextNode();
    while (n) { yield n; if (n.shadowRoot) yield* walkAll(n.shadowRoot); n = w.nextNode(); }
  }

  const selects = [];
  const combos = [];
  const texts = [];

  for (const el of walkAll(document)) {
    const tag = el.tagName.toLowerCase();
    const r = el.getBoundingClientRect();

    if (tag === 'vaadin-select' && r.width > 0) {
      const label = el.getAttribute('label') || '';
      const val = el.value || '';
      // Try to get options by opening
      selects.push({ label, val, y: Math.round(r.top) });
    }

    if ((tag === 'vaadin-combo-box' || tag === 'vaadin-multi-select-combo-box') && r.width > 0) {
      const label = el.getAttribute('label') || '';
      combos.push({ label, y: Math.round(r.top) });
    }

    // Status filter text
    if ((tag === 'span' || tag === 'div') && r.width > 0 && r.top < 400) {
      const t = (el.innerText || '').trim();
      if (t && t.length < 50 && t.includes('=')) texts.push(t);
    }
  }

  return { selects: selects.slice(0, 10), combos: combos.slice(0, 10), filterTexts: texts.slice(0, 5) };
});
console.log('Filter info:', JSON.stringify(filterInfo, null, 2));

// Try clicking the Статус = filter combo to get its options
// First try to open the status filter combo
await page.evaluate(() => {
  function* walkAll(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let n = w.nextNode();
    while (n) { yield n; if (n.shadowRoot) yield* walkAll(n.shadowRoot); n = w.nextNode(); }
  }
  for (const el of walkAll(document)) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'vaadin-combo-box') {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.top < 400) {
        el.click();
        break;
      }
    }
  }
});
await page.waitForTimeout(1500);

// Get overlay options
const statusOptions = await page.evaluate(() => {
  const overlays = document.querySelectorAll('vaadin-combo-box-overlay, vaadin-select-overlay');
  const opts = [];
  overlays.forEach(ov => {
    const items = ov.querySelectorAll('vaadin-combo-box-item, vaadin-item');
    items.forEach(i => {
      const t = (i.innerText || '').trim();
      if (t) opts.push(t);
    });
  });
  return opts;
});
console.log('Status options from overlay:', JSON.stringify(statusOptions));

// Also check the grid data for all statuses
const allGridStatuses = await page.evaluate(() => {
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
  const dp = g._dataProviderController;
  if (!dp || !dp.rootCache) return [];
  const items = dp.rootCache.items || [];
  return [...new Set(items.map(item => item.col4 || item.status).filter(Boolean))];
});
console.log('All distinct statuses in grid:', JSON.stringify(allGridStatuses));

// Page text for filter area
const filterAreaText = await page.evaluate(() => {
  // Find the filter area by looking for "Статус" text near top
  function* walkAll(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let n = w.nextNode();
    while (n) { yield n; if (n.shadowRoot) yield* walkAll(n.shadowRoot); n = w.nextNode(); }
  }
  const texts = [];
  for (const el of walkAll(document)) {
    const r = el.getBoundingClientRect();
    if (r.top < 420 && r.top > 0 && r.width > 0 && el.childElementCount < 4) {
      const t = (el.innerText || '').trim();
      if (t && t.length < 200 && t.length > 1) texts.push({ t: t.substring(0, 100), y: Math.round(r.top) });
    }
  }
  return [...new Map(texts.map(h => [h.t, h])).values()].sort((a, b) => a.y - b.y).slice(0, 30);
});
console.log('Filter area text:', JSON.stringify(filterAreaText));

await ctx.close();
