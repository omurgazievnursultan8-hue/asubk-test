// scripts/inspect/tz/dump.mjs
// Reusable UI structure dumper for ASUBK Credit Module ТЗ inspection.
// Usage: node scripts/inspect/tz/dump.mjs <route>
// Output: JSON { url, title, h, toolbarButtons[], gridColumns[], formFields[] } to stdout
//         Screenshot: .auth/tz-<route>.png
//
// The app is Vaadin/Jmix: almost all UI lives in shadow DOM.
// We use document.createTreeWalker + recursive shadowRoot traversal to pierce it.
import { chromium } from 'playwright-core';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';
const route = (process.argv[2] || '').replace(/^\//, '');

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1600, height: 1000 },
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
  await page.waitForTimeout(2000);
}
await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(1500);

// Shadow-DOM-aware collector using TreeWalker to traverse all shadow roots.
const dump = await page.evaluate(() => {
  // Generator that walks the full element tree including shadow roots.
  function* walkAll(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node) {
      yield node;
      if (node.shadowRoot) yield* walkAll(node.shadowRoot);
      node = walker.nextNode();
    }
  }

  const txt = el => (el.textContent || '').trim().replace(/\s+/g, ' ');
  const uniq = a => [...new Set(a.filter(Boolean))];

  const headings = [];
  const toolbarButtons = [];
  const gridColumns = [];
  const formFields = [];

  const FIELD_TAGS = new Set([
    'vaadin-text-field', 'vaadin-combo-box', 'vaadin-date-picker',
    'vaadin-number-field', 'vaadin-text-area', 'vaadin-select',
    'vaadin-checkbox', 'vaadin-radio-button',
  ]);

  for (const el of walkAll(document)) {
    const tag = el.tagName.toLowerCase();

    // Page title / section headings
    if (/^h[1-3]$/.test(tag) || el.classList?.contains('jmix-main-view-title')) {
      const t = txt(el);
      if (t && t.length < 120) headings.push(t);
    }

    // Toolbar / action buttons (exclude nav sidebar items by capping length)
    if (tag === 'vaadin-button' || tag === 'button' || el.getAttribute?.('role') === 'button') {
      const t = txt(el);
      if (t && t.length < 50) toolbarButtons.push(t);
    }

    // Grid column headers (from column definitions — most reliable)
    if (tag === 'vaadin-grid-column' || tag === 'vaadin-grid-sort-column' ||
        tag === 'vaadin-grid-filter-column') {
      const h = el.getAttribute('header') || el.getAttribute('path') || '';
      if (h) gridColumns.push(h);
    }

    // Grid cell content in header rows (rendered header text)
    if (tag === 'vaadin-grid-cell-content') {
      const t = txt(el);
      // Only likely-header rows: short text, no numerics
      if (t && t.length > 1 && t.length < 60 && !/^\d+$/.test(t)) {
        gridColumns.push(t);
      }
    }

    // Form field components
    if (FIELD_TAGS.has(tag)) {
      const label = el.getAttribute('label') || '';
      const req = el.hasAttribute('required');
      if (label) formFields.push(label + (req ? ' *' : ''));
    }
  }

  return {
    title: document.title,
    h: uniq(headings).slice(0, 8),
    toolbarButtons: uniq(toolbarButtons).slice(0, 40),
    gridColumns: uniq(gridColumns).slice(0, 60),
    formFields: uniq(formFields).slice(0, 80),
  };
});
dump.url = page.url();
console.log(JSON.stringify(dump, null, 2));
const screenshotPath = `.auth/tz-${route.replace(/\W+/g, '_') || 'root'}.png`;
await page.screenshot({ path: screenshotPath, fullPage: true });
await ctx.close();
