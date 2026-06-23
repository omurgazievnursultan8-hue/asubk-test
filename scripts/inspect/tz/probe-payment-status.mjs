// Probe payment status enum by opening the combo-box
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

// Double-click first data row (date cell)
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

// Open the combo-box for "Статус платежа"
await page.evaluate(() => {
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
    if (tag === 'jmix-combo-box-picker' || tag === 'vaadin-combo-box') {
      el.opened = true;
      break;
    }
  }
});
await page.waitForTimeout(1500);

// Get combo-box items
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
  for (const el of walkAll(document)) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'vaadin-combo-box-item') {
      const t = (el.textContent || '').trim();
      if (t) items.push(t);
    }
    if (tag === 'jmix-combo-box-picker' || tag === 'vaadin-combo-box') {
      const fi = el.filteredItems || el.items || [];
      if (fi.length) items.push(...fi.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)));
    }
  }
  return { url: location.href, comboItems: [...new Set(items)] };
});

console.log(JSON.stringify(dump, null, 2));
await ctx.close();
