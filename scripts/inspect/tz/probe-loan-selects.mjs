// probe-loan-selects.mjs — read all vaadin-select values from loan-credits/18 tab 4
import { chromium } from 'playwright-core';
const BASE = 'https://fkftest.okmot.kg/';
const USER = 'admin'; const PASS = 'admin';
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
await page.goto(BASE + 'loan-credits/18', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

// Click tab 4 (Условия кредита)
await page.evaluate(() => {
  const allTabs = [...document.querySelectorAll('vaadin-tab')].filter(t => t.getBoundingClientRect().width > 0);
  allTabs[3] && allTabs[3].click(); // index 3 = tab 4
});
await page.waitForTimeout(2000);

// Get all selects from shadow DOM
const selects = await page.evaluate(() => {
  function* walkAll(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node) {
      yield node;
      if (node.shadowRoot) yield* walkAll(node.shadowRoot);
      node = walker.nextNode();
    }
  }
  const results = [];
  for (const el of walkAll(document)) {
    const tag = el.tagName?.toLowerCase();
    if (tag === 'vaadin-select' && el.getBoundingClientRect().width > 0) {
      const items = [];
      // Try to get list-box items
      const listbox = el.querySelector('vaadin-list-box') || (el.shadowRoot ? el.shadowRoot.querySelector('vaadin-list-box') : null);
      if (listbox) {
        listbox.querySelectorAll('vaadin-item').forEach(item => {
          items.push({ text: item.innerText?.trim(), value: item.value });
        });
      }
      results.push({
        label: el.label || el.getAttribute('label'),
        value: el.value,
        items: items
      });
    }
  }
  return results;
});
console.log('TAB 4 SELECTS:', JSON.stringify(selects, null, 2));

// Click each select to load its options
for (let i = 0; i < selects.length; i++) {
  await page.evaluate((idx) => {
    function* walkAll(root) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
      let node = walker.nextNode();
      while (node) {
        yield node;
        if (node.shadowRoot) yield* walkAll(node.shadowRoot);
        node = walker.nextNode();
      }
    }
    const all = [];
    for (const el of walkAll(document)) {
      if (el.tagName?.toLowerCase() === 'vaadin-select' && el.getBoundingClientRect().width > 0) {
        all.push(el);
      }
    }
    const sel = all[idx];
    if (sel) {
      sel.click();
      sel.opened = true;
    }
  }, i);
  await page.waitForTimeout(1000);

  const items = await page.evaluate(() => {
    function* walkAll(root) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
      let node = walker.nextNode();
      while (node) {
        yield node;
        if (node.shadowRoot) yield* walkAll(node.shadowRoot);
        node = walker.nextNode();
      }
    }
    const results = [];
    for (const el of walkAll(document)) {
      const tag = el.tagName?.toLowerCase();
      if (tag === 'vaadin-item') {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          results.push({ text: el.innerText?.trim(), value: el.value || el.getAttribute('value') });
        }
      }
    }
    return results;
  });
  console.log(`SELECT ${i} ITEMS:`, JSON.stringify(items));

  // Close it
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
}

await ctx.close();
console.log('DONE');
