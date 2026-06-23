// Extract ALL text content from payment detail page
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
await page.goto(BASE + 'payments', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);

// Double-click first data row
const cells = await page.evaluate(() => {
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
    if (el.tagName && el.tagName.toLowerCase() === 'vaadin-grid-cell-content') {
      const t = (el.textContent || '').trim();
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && t) {
        cells.push({ text: t, x: rect.x + rect.width/2, y: rect.y + rect.height/2 });
      }
    }
  }
  return cells;
});
const dataCell = cells.find(c => /^\d{2}\.\d{2}\.\d{4}/.test(c.text)) || cells[0];
await page.mouse.dblclick(dataCell.x, dataCell.y);
await page.waitForTimeout(3000);
await page.waitForLoadState('networkidle').catch(() => {});

// Collect every visible element with a label attribute
const dump = await page.evaluate(() => {
  function* walkAll(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node) {
      yield node;
      if (node.shadowRoot) yield* walkAll(node.shadowRoot);
      node = walker.nextNode();
    }
  }
  const items = [];
  const seen = new Set();
  for (const el of walkAll(document)) {
    const tag = el.tagName.toLowerCase();
    // Get any element with a label attribute
    const label = el.getAttribute('label');
    if (label && !seen.has(label)) {
      seen.add(label);
      const val = el.getAttribute('value') || el.value || '';
      const readonly = el.hasAttribute('readonly');
      const required = el.hasAttribute('required');
      items.push({ tag, label, value: val, readonly, required });
    }
    // Also label elements
    if (tag === 'label') {
      const t = (el.textContent || '').trim();
      if (t && !seen.has('label:' + t)) {
        seen.add('label:' + t);
        items.push({ tag: 'label', label: t });
      }
    }
  }
  return { url: location.href, items };
});

console.log(JSON.stringify(dump, null, 2));
await ctx.close();
