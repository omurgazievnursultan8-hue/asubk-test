// scripts/inspect/tz/dump-edit-direct.mjs
// Double-clicks a row in gov-decisions to open the edit dialog, captures fields.
import { chromium } from 'playwright-core';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';

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

// Navigate to gov-decisions without any filter to see all records
await page.goto(BASE + 'gov-decisions', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

// Double-click on a data cell in the grid (not the header)
// Try using Playwright's dblclick on the grid
const rowDblClicked = await page.evaluate(() => {
  function* walkAll(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node) {
      yield node;
      if (node.shadowRoot) yield* walkAll(node.shadowRoot);
      node = walker.nextNode();
    }
  }

  const cells = [];
  for (const el of walkAll(document)) {
    if (el.tagName.toLowerCase() === 'vaadin-grid-cell-content') {
      const t = (el.textContent || '').trim();
      // Skip header row cells and empty cells; look for data content
      if (t && t.length > 5 && t.length < 200 && !/^(Наименование|Краткое|Статус|Код|Номер|Вид|Дата)$/.test(t)) {
        cells.push(t);
        if (cells.length === 1) {
          // Double click first data cell
          const event = new MouseEvent('dblclick', { bubbles: true, cancelable: true });
          el.dispatchEvent(event);
          return t;
        }
      }
    }
  }
  return cells[0] || null;
});

console.error('Double-clicked row:', rowDblClicked);
await page.waitForTimeout(3000);

const urlAfter = page.url();
await page.screenshot({ path: '.auth/tz-after-dblclick.png', fullPage: true });
console.error('URL after dblclick:', urlAfter);

// Collect all labels in current state
const labels = await page.evaluate(() => {
  const labels = [];
  function walk(root, depth) {
    if (depth > 30) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node) {
      const tag = node.tagName.toLowerCase();
      if (tag === 'label') {
        const t = (node.textContent || '').trim();
        if (t) labels.push(t);
      }
      if (node.shadowRoot) walk(node.shadowRoot, depth + 1);
      node = walker.nextNode();
    }
  }
  walk(document, 0);
  return [...new Set(labels)];
});

console.log('URL:', urlAfter);
console.log('Labels found:', JSON.stringify(labels, null, 2));
await ctx.close();
