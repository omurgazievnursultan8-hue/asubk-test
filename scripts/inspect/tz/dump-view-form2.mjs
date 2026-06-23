// scripts/inspect/tz/dump-view-form2.mjs
// Clicks first row + Просмотр on gov-decisions, captures the resulting dialog/route.
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

await page.goto(BASE + 'gov-decisions', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);

// Select first data row in the grid by clicking on vaadin-grid body row
const selected = await page.evaluate(() => {
  function* walkAll(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node) {
      yield node;
      if (node.shadowRoot) yield* walkAll(node.shadowRoot);
      node = walker.nextNode();
    }
  }

  // Find vaadin-grid
  let grid = null;
  for (const el of walkAll(document)) {
    if (el.tagName.toLowerCase() === 'vaadin-grid') {
      grid = el;
      break;
    }
  }

  if (!grid) return 'no grid found';

  // Try selecting first item via grid.selectedItems or activeItem
  if (grid.items && grid.items.length > 0) {
    grid.selectedItems = [grid.items[0]];
    return 'selected via items[0]';
  }

  return 'grid found but items empty';
});

console.error('Selection:', selected);
await page.waitForTimeout(1000);

// Take screenshot to see current state
await page.screenshot({ path: '.auth/tz-before-view.png' });

// Double-click first row cell content instead
const firstRowDoubleClick = await page.evaluate(() => {
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
      if (t && t.length > 3 && t.length < 100) {
        cells.push({ text: t, el });
      }
    }
  }

  // Click and double-click the first data cell
  if (cells.length > 0) {
    cells[0].el.click();
    return cells[0].text;
  }
  return null;
});

console.error('Double clicked cell:', firstRowDoubleClick);
await page.waitForTimeout(1000);

// Now click Просмотр button
const viewClicked = await page.evaluate(() => {
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
    if ((tag === 'vaadin-button' || tag === 'button') && el.textContent?.trim() === 'Просмотр') {
      el.click();
      return true;
    }
  }
  return false;
});

console.error('View clicked:', viewClicked);
await page.waitForTimeout(4000);

const urlAfter = page.url();
await page.screenshot({ path: '.auth/tz-after-view.png', fullPage: true });

// Collect labels and fields
const result = await page.evaluate(() => {
  const labels = [];
  const inputs = [];
  const buttons = [];
  const tabs = [];

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

      if (['input', 'textarea', 'select'].includes(tag)) {
        inputs.push({
          tag,
          id: node.id || '',
          type: node.getAttribute('type') || '',
          readonly: node.hasAttribute('readonly'),
          value: (node.value || '').slice(0, 60),
        });
      }

      if (tag === 'vaadin-button' || tag === 'button') {
        const t = (node.textContent || '').trim().replace(/\s+/g, ' ');
        if (t && t.length < 60) buttons.push(t);
      }

      if (tag === 'vaadin-tab') {
        const t = (node.textContent || '').trim().replace(/\s+/g, ' ');
        if (t && t.length < 80) tabs.push(t);
      }

      if (node.shadowRoot) walk(node.shadowRoot, depth + 1);
      node = walker.nextNode();
    }
  }
  walk(document, 0);

  const uniq = a => [...new Set(a)];
  return { url: location.href, labels: uniq(labels), inputs, buttons: uniq(buttons), tabs: uniq(tabs) };
});

console.log('URL after:', urlAfter);
console.log(JSON.stringify(result, null, 2));
await ctx.close();
