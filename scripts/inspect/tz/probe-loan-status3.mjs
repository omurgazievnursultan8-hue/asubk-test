// probe-loan-status3.mjs — intercept network to find status enum
import { chromium } from 'playwright-core';
const BASE = 'https://fkftest.okmot.kg/';
const USER = 'admin'; const PASS = 'admin';
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1700, height: 1100 },
});
const page = ctx.pages()[0] || await ctx.newPage();

// Capture API responses
const responses = [];
page.on('response', async (res) => {
  const url = res.url();
  if (url.includes('status') || url.includes('enum') || url.includes('loancredit') || url.includes('loan-credit')) {
    try {
      const body = await res.text().catch(() => '');
      if (body && body.length < 5000) responses.push({ url: url.substring(0, 200), body: body.substring(0, 500) });
    } catch {}
  }
});

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

// Get the combo box by clicking it to trigger loading
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
  // Find all combo boxes and log them
  const combos = [];
  for (const el of walkAll(document)) {
    if (el.tagName?.toLowerCase() === 'vaadin-combo-box' && el.getBoundingClientRect().width > 0) {
      combos.push({ label: el.label || el.getAttribute('label'), value: el.value });
      // Click it to load items
      el.click();
    }
  }
  window._debugCombos = combos;
});
await page.waitForTimeout(3000);

// Now read from all combo boxes in shadow DOM
const allCombos = await page.evaluate(() => {
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
    if (el.tagName?.toLowerCase() === 'vaadin-combo-box' && el.getBoundingClientRect().width > 0) {
      results.push({
        label: el.label || el.getAttribute('label'),
        value: el.value,
        itemsCount: (el.items || []).length,
        items: (el.items || []).slice(0, 20).map(i => typeof i === 'object' ? JSON.stringify(i) : String(i)),
        filteredItems: (el.filteredItems || []).slice(0, 20).map(i => typeof i === 'object' ? JSON.stringify(i) : String(i)),
      });
    }
  }
  return results;
});
console.log('SHADOW DOM COMBOS AFTER CLICK:', JSON.stringify(allCombos, null, 2));

// Look at combo-box items in overlay
const overlayItems = await page.evaluate(() => {
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
    const tag = el.tagName?.toLowerCase();
    if (tag === 'vaadin-combo-box-item') {
      items.push({ text: el.textContent?.trim(), item: el.item ? JSON.stringify(el.item) : null });
    }
  }
  return items;
});
console.log('OVERLAY ITEMS:', JSON.stringify(overlayItems, null, 2));

console.log('INTERCEPTED RESPONSES:', JSON.stringify(responses.slice(0, 10), null, 2));

// Screenshot the state
await page.screenshot({ path: '.auth/tz-loan-status3.png', fullPage: false });
await ctx.close();
console.log('DONE');
