// Probe payment detail by clicking first row + "Изменить"
import { chromium } from 'playwright-core';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';

const ctx = await chromium.launchPersistentContext('/home/azamat/projects/asubk-credit-module/.auth/profile', {
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
await page.waitForTimeout(1500);

// Click first row
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
    if (el.tagName && el.tagName.toLowerCase() === 'vaadin-grid-cell-content') {
      // Find the first data row cell
    }
  }
});

// Try clicking a data row
try {
  const grid = await page.locator('vaadin-grid').first();
  // Click first row
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
      if (el.tagName && el.tagName.toLowerCase() === 'vaadin-grid') {
        const rows = el.shadowRoot?.querySelectorAll('tr[part~="row"]');
        if (rows && rows[1]) rows[1].click();
        break;
      }
    }
  });
  await page.waitForTimeout(500);
} catch(e) {}

// Click Изменить button
try {
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
      if (el.tagName && el.tagName.toLowerCase() === 'vaadin-button') {
        if ((el.textContent || '').trim() === 'Изменить') {
          el.click();
          break;
        }
      }
    }
  });
  await page.waitForTimeout(2000);
} catch(e) {}

// Collect form fields
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
  const txt = el => (el.textContent || '').trim().replace(/\s+/g, ' ');
  const FIELD_TAGS = new Set([
    'vaadin-text-field', 'vaadin-combo-box', 'vaadin-date-picker',
    'vaadin-number-field', 'vaadin-text-area', 'vaadin-select',
    'vaadin-checkbox', 'vaadin-radio-button', 'vaadin-big-decimal-field',
    'vaadin-integer-field', 'jmix-value-picker', 'vaadin-date-time-picker',
  ]);
  const formFields = [];
  const allText = [];
  for (const el of walkAll(document)) {
    const tag = el.tagName.toLowerCase();
    if (FIELD_TAGS.has(tag)) {
      const label = el.getAttribute('label') || '';
      const val = el.getAttribute('value') || el.value || '';
      if (label) formFields.push({ label, value: val, required: el.hasAttribute('required') });
    }
  }
  return { url: location.href, formFields };
});

console.log(JSON.stringify(dump, null, 2));
await page.screenshot({ path: '/home/azamat/projects/asubk-credit-module/.auth/tz-payment-detail.png', fullPage: true });
await ctx.close();
