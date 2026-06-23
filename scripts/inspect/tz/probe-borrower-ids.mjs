// probe-borrower-ids.mjs
// Extract borrower IDs from the loan-applicants list using Jmix data provider
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

// Navigate without filter to get all records
await page.goto(BASE + 'loan-applicants', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

// Try to intercept AJAX calls to find item IDs
const borrowerData = await page.evaluate(() => {
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
  if (!g) return { found: false };

  // Try various internal properties
  const dp = g._dataProviderController;
  if (!dp) return { found: false, note: 'no _dataProviderController' };

  const rc = dp.rootCache;
  if (!rc) return { found: false, note: 'no rootCache' };

  const items = rc.items || [];
  const flatItems = items.flatMap(i => i ? [i] : []);

  return {
    found: true,
    count: flatItems.length,
    items: flatItems.map(item => {
      // Jmix entities have different shapes — try to extract id
      const raw = JSON.stringify(item);
      return {
        id: item.id || item.entityId || item['@id'],
        raw: raw.substring(0, 300),
      };
    }).slice(0, 20),
  };
});
console.log('Grid data:', JSON.stringify(borrowerData, null, 2));

// Also try to find any ID via DOM cell text — cross-reference with URL
// Try to click a row and see if toolbar changes or URL changes
const cellTexts = await page.evaluate(() => {
  function* walkAll(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let n = w.nextNode();
    while (n) { yield n; if (n.shadowRoot) yield* walkAll(n.shadowRoot); n = w.nextNode(); }
  }
  const cells = [];
  for (const el of walkAll(document)) {
    if (el.tagName.toLowerCase() === 'vaadin-grid-cell-content') {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.top > 150 && r.top < 500) {
        const t = (el.innerText || '').trim();
        if (t && t.length < 100) cells.push({ t, y: Math.round(r.top), x: Math.round(r.left) });
      }
    }
  }
  return cells.sort((a, b) => a.y - b.y || a.x - b.x).slice(0, 50);
});
console.log('Cell texts (visible rows):', JSON.stringify(cellTexts));

// Try pressing F5 and then navigate to known test IDs
// The feature doc mentioned record 11 — already confirmed
// Let's try sequential IDs to find more
console.log('\nTrying sequential IDs...');
for (const id of [5, 7, 8, 9, 10, 12, 13, 14, 15, 16, 20, 25, 30]) {
  await page.goto(BASE + 'loan-applicants/' + id, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  const url = page.url();
  if (url.includes('/loan-applicants/' + id)) {
    // Found a valid record
    const nameField = await page.evaluate(() => {
      const f = document.querySelector('vaadin-text-field[label="ФИО/Наименование"]');
      return f ? { value: f.value, readonly: f.hasAttribute('readonly') } : null;
    });
    const header = await page.evaluate(() => {
      function* walkAll(root) {
        const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
        let n = w.nextNode();
        while (n) { yield n; if (n.shadowRoot) yield* walkAll(n.shadowRoot); n = w.nextNode(); }
      }
      const texts = [];
      for (const el of walkAll(document)) {
        const r = el.getBoundingClientRect();
        if (r.top > 60 && r.top < 280 && r.width > 0 && el.childElementCount < 3) {
          const t = (el.innerText || '').trim();
          if (t && t.length > 1 && t.length < 200) texts.push({ t: t.substring(0, 100), y: Math.round(r.top) });
        }
      }
      return [...new Map(texts.map(h => [h.t, h])).values()].sort((a, b) => a.y - b.y).slice(0, 10);
    });
    console.log(`ID ${id}: VALID — header:`, JSON.stringify(header));
  } else {
    console.log(`ID ${id}: redirected to ${url.replace(BASE, '/')}`);
  }
}

await ctx.close();
