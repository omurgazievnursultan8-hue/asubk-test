// scripts/inspect/tz/dump-edit-modal.mjs
// Removes status filter from gov-decisions, clicks first row + Изменить, dumps modal.
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

// Navigate without filter to see "На стадии рассмотрения" records
await page.goto(BASE + 'gov-decisions', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);

// Take screenshot of list
await page.screenshot({ path: '.auth/tz-gov-list.png' });

// Try to select and edit the first "На стадии рассмотрения" record
// First find and click on a data row that's NOT a column header
const clickResult = await page.evaluate(() => {
  function* walkAll(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node) {
      yield node;
      if (node.shadowRoot) yield* walkAll(node.shadowRoot);
      node = walker.nextNode();
    }
  }

  // Find the vaadin-grid and try to set selectedItems
  for (const el of walkAll(document)) {
    if (el.tagName.toLowerCase() === 'vaadin-grid') {
      // Trigger a click on the grid's row via the grid API
      const rowCount = el._getRowCount ? el._getRowCount('body') : 0;
      return { tag: el.tagName, rowCount, hasItems: Array.isArray(el.items), itemsLength: el.items?.length };
    }
  }
  return null;
});

console.error('Grid info:', JSON.stringify(clickResult));

// Click the «Создать» button approach: instead directly navigate to existing record
// by inspecting URLs from network — but better: click the row using page.locator
const rows = page.locator('vaadin-grid-cell-content');
const rowCount = await rows.count();
console.error('Row count:', rowCount);

// Click on first real data cell (skip header)
// Try clicking the 8th cell (after 7 header columns)
if (rowCount > 7) {
  await rows.nth(8).click();
  await page.waitForTimeout(500);
  // Now click Изменить
  const btnClicked = await page.evaluate(() => {
    function* walkAll(root) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
      let node = walker.nextNode();
      while (node) {
        yield node;
        if (node.shadowRoot) yield* walkAll(node.shadowRoot);
        node = walker.nextNode();
      }
    }
    for (const el of walkAll(document)) {
      const tag = el.tagName.toLowerCase();
      if ((tag === 'vaadin-button') && el.textContent?.trim() === 'Изменить') {
        el.click();
        return true;
      }
    }
    return false;
  });
  console.error('Clicked Изменить:', btnClicked);
  await page.waitForTimeout(4000);
}

const urlAfter = page.url();
await page.screenshot({ path: '.auth/tz-edit-modal.png', fullPage: true });

// Collect labels
const result = await page.evaluate(() => {
  const labels = [];
  const inputs = [];
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
      if (['input', 'textarea'].includes(tag)) {
        inputs.push({ tag, id: node.id || '', readonly: node.readOnly, value: (node.value || '').slice(0, 60) });
      }
      if (node.shadowRoot) walk(node.shadowRoot, depth + 1);
      node = walker.nextNode();
    }
  }
  walk(document, 0);
  return { labels: [...new Set(labels)], inputs, url: location.href };
});

console.log('URL:', urlAfter);
console.log(JSON.stringify(result, null, 2));
await ctx.close();
