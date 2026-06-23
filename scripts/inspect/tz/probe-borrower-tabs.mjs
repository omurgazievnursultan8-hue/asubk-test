// probe-borrower-tabs.mjs
// Inspect the grid content of sub-tabs (Кредиты, Контакты, Документы, История) on a borrower detail page.
// Usage: node scripts/inspect/tz/probe-borrower-tabs.mjs [id]
import { chromium } from 'playwright-core';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';
const id = process.argv[2] || '5';

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

await page.goto(BASE + 'loan-applicants/' + id, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);

const tabs = await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-tab')]
    .filter(t => t.getBoundingClientRect().width > 0)
    .map(t => (t.innerText || '').trim())
);
console.log('TABS:', JSON.stringify(tabs));

// Grid column + cell extractor
const gridExtractor = async () => page.evaluate(() => {
  function* walkAll(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let n = w.nextNode();
    while (n) { yield n; if (n.shadowRoot) yield* walkAll(n.shadowRoot); n = w.nextNode(); }
  }

  const columns = [];
  const cells = [];

  for (const el of walkAll(document)) {
    const tag = el.tagName.toLowerCase();
    const r = el.getBoundingClientRect();

    if ((tag === 'vaadin-grid-column' || tag === 'vaadin-grid-sort-column' ||
         tag === 'vaadin-grid-filter-column') && el.getAttribute('header')) {
      columns.push({ header: el.getAttribute('header'), path: el.getAttribute('path') || '' });
    }

    if (tag === 'vaadin-grid-cell-content' && r.width > 0 && r.height > 0) {
      const t = (el.innerText || '').trim();
      if (t && t.length < 200) cells.push({ t, y: Math.round(r.top), x: Math.round(r.left) });
    }
  }

  return {
    columns,
    cells: cells.sort((a, b) => a.y - b.y || a.x - b.x).slice(0, 60),
  };
});

// Inspect Кредиты tab (index 1)
for (let tabIdx = 1; tabIdx < tabs.length; tabIdx++) {
  await page.evaluate((idx) => {
    const allTabs = [...document.querySelectorAll('vaadin-tab')].filter(t => t.getBoundingClientRect().width > 0);
    allTabs[idx] && allTabs[idx].click();
  }, tabIdx);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `.auth/tz-borrower-${id}-subtab${tabIdx + 1}-${tabs[tabIdx]}.png`, fullPage: true });

  const grid = await gridExtractor();
  console.log(`\n=== TAB: ${tabs[tabIdx]} ===`);
  console.log('Grid columns:', JSON.stringify(grid.columns));
  console.log('Grid cells (first visible):', JSON.stringify(grid.cells.slice(0, 30)));
}

// Also get full page text of Кредиты tab
await page.evaluate((idx) => {
  const allTabs = [...document.querySelectorAll('vaadin-tab')].filter(t => t.getBoundingClientRect().width > 0);
  allTabs[idx] && allTabs[idx].click();
}, 1);
await page.waitForTimeout(2000);

const bodyText = await page.evaluate(() => {
  // Get text only in the main content area
  const main = document.querySelector('main') || document.body;
  return main.innerText.substring(0, 2000);
});
console.log('\n=== LOANS TAB BODY TEXT ===');
console.log(bodyText.substring(0, 1500));

await ctx.close();
