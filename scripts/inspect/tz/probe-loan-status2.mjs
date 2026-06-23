// probe-loan-status2.mjs — open combo and screenshot to capture dropdown options
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

// First, see all combo boxes on tab 1
const allCombos = await page.evaluate(() => {
  return [...document.querySelectorAll('vaadin-combo-box')]
    .filter(c => c.getBoundingClientRect().width > 0)
    .map(c => ({
      label: c.getAttribute('label'),
      value: c.value,
      items: (c.items || []).slice(0, 20).map(i => typeof i === 'object' ? JSON.stringify(i) : String(i))
    }));
});
console.log('ALL COMBO BOXES:', JSON.stringify(allCombos, null, 2));

// Try clicking the status combo field input directly
const statusFieldHandle = await page.evaluateHandle(() => {
  const combos = [...document.querySelectorAll('vaadin-combo-box')]
    .filter(c => c.getBoundingClientRect().width > 0);
  // Find by label
  const found = combos.find(c => (c.getAttribute('label') || '').includes('Статус'));
  return found;
});

if (statusFieldHandle) {
  // Click the input inside the combo
  await page.evaluate((combo) => {
    if (combo) {
      const input = combo.shadowRoot ? combo.shadowRoot.querySelector('input') : combo.querySelector('input');
      if (input) {
        input.focus();
        input.click();
      } else {
        combo.click();
      }
    }
  }, statusFieldHandle);
  await page.waitForTimeout(2000);

  // Screenshot
  await page.screenshot({ path: '.auth/tz-loan-status-click.png', fullPage: false });

  // Read dropdown
  const items = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('vaadin-combo-box-item').forEach(item => {
      results.push({ text: item.innerText?.trim(), value: item.getAttribute('value') });
    });
    // Also search in shadow DOMs
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
      if (el.tagName === 'VAADIN-COMBO-BOX-ITEM') {
        results.push({ shadow: true, text: el.textContent?.trim() });
      }
    }
    return results;
  });
  console.log('DROPDOWN ITEMS AFTER CLICK:', JSON.stringify(items, null, 2));
}

// Also try getting status via a broader lookup in page text
const allSelectOptions = await page.evaluate(() => {
  const results = {};
  // Look at all selects
  document.querySelectorAll('vaadin-select, select').forEach(s => {
    const label = s.getAttribute('label') || s.getAttribute('name') || 'unknown';
    const opts = [...(s.querySelectorAll('vaadin-item, option') || [])].map(o => o.innerText?.trim());
    if (opts.length) results[label] = opts;
  });
  return results;
});
console.log('ALL SELECT OPTIONS:', JSON.stringify(allSelectOptions, null, 2));

await ctx.close();
console.log('DONE');
