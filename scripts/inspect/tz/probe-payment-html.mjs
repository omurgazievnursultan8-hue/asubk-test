// Probe payment detail - get all visible text and element info
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

// Get all unique element tags that appear in this page's full DOM tree
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

  const tagCounts = {};
  const visibleTexts = [];
  const inputValues = [];

  for (const el of walkAll(document)) {
    const tag = el.tagName.toLowerCase();
    tagCounts[tag] = (tagCounts[tag] || 0) + 1;

    // Find input elements of all kinds
    if (tag.startsWith('vaadin-') || tag.startsWith('jmix-')) {
      const label = el.getAttribute('label') || '';
      const val = el.getAttribute('value') || el.value || '';
      const inner = el.shadowRoot ? el.shadowRoot.querySelector('input')?.value : '';
      if (label || val || inner) {
        inputValues.push({ tag, label, value: val || inner || '', readonly: el.hasAttribute('readonly') });
      }
    }

    // Collect short visible text near form area
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && rect.y > 200 && rect.y < 900) {
      const t = (el.textContent || '').trim().replace(/\s+/g, ' ');
      if (t && t.length > 1 && t.length < 60 && !visibleTexts.includes(t)) {
        visibleTexts.push(t);
      }
    }
  }

  // Filter to vaadin/jmix tags
  const relevantTags = Object.entries(tagCounts)
    .filter(([k]) => k.startsWith('vaadin') || k.startsWith('jmix'))
    .sort(([,a],[,b]) => b - a);

  return {
    url: location.href,
    relevantTags: relevantTags.slice(0, 30),
    inputValues: inputValues.slice(0, 50),
    visibleTexts: [...new Set(visibleTexts)].slice(0, 60),
  };
});

console.log(JSON.stringify(dump, null, 2));
await ctx.close();
