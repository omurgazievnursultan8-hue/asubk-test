// scripts/inspect/tz/dump-view-form.mjs
// Clicks «Просмотр» on the first approved record in gov-decisions list, captures URL + fields.
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

// Click first row to select it, then click Просмотр
// First: select a row by clicking on the grid
const gridRow = page.locator('vaadin-grid-cell-content').first();
await gridRow.click().catch(() => {});
await page.waitForTimeout(500);

// Find and click «Просмотр»
const clickedView = await page.evaluate(() => {
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
console.error('Clicked Просмотр:', clickedView);
await page.waitForTimeout(3000);

const url = page.url();
await page.screenshot({ path: '.auth/tz-gov-decisions-view.png', fullPage: true });

// Get all labels
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

  const buttons = [];
  function walkBtns(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node) {
      const tag = node.tagName.toLowerCase();
      if (tag === 'vaadin-button' || tag === 'button') {
        const t = (node.textContent || '').trim().replace(/\s+/g, ' ');
        if (t && t.length < 60) buttons.push(t);
      }
      if (node.shadowRoot) walkBtns(node.shadowRoot);
      node = walker.nextNode();
    }
  }
  walkBtns(document);

  const tabs = [];
  function walkTabs(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node) {
      const tag = node.tagName.toLowerCase();
      if (tag === 'vaadin-tab') {
        const t = (node.textContent || '').trim().replace(/\s+/g, ' ');
        if (t && t.length < 80) tabs.push(t);
      }
      if (node.shadowRoot) walkTabs(node.shadowRoot);
      node = walker.nextNode();
    }
  }
  walkTabs(document);

  return { labels: [...new Set(labels)], buttons: [...new Set(buttons)], tabs: [...new Set(tabs)], url: location.href };
});

console.log(JSON.stringify({ url, ...labels }, null, 2));
await ctx.close();
