// Probe payment detail — select first row + click "Изменить"
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

// Click first data row in vaadin-grid
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
      // Try selecting first item
      el.activeItem = el.items && el.items[0];
      el.selectedItems = el.items ? [el.items[0]] : [];
      break;
    }
  }
});
await page.waitForTimeout(500);

// Also try clicking any visible row
try {
  await page.click('vaadin-grid-cell-content', { timeout: 3000 });
} catch(e) {}
await page.waitForTimeout(500);

// Click Изменить
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
      const t = (el.textContent || '').trim();
      if (t === 'Изменить') { el.click(); break; }
    }
  }
});
await page.waitForTimeout(3000);

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
  const FIELD_TAGS = new Set([
    'vaadin-text-field', 'vaadin-combo-box', 'vaadin-date-picker',
    'vaadin-number-field', 'vaadin-text-area', 'vaadin-select',
    'vaadin-checkbox', 'vaadin-big-decimal-field',
    'vaadin-integer-field', 'jmix-value-picker', 'vaadin-date-time-picker',
  ]);
  const formFields = [];
  const headings = [];
  for (const el of walkAll(document)) {
    const tag = el.tagName.toLowerCase();
    if (/^h[1-3]$/.test(tag) || el.classList?.contains('jmix-main-view-title')) {
      const t = (el.textContent || '').trim();
      if (t && t.length < 120) headings.push(t);
    }
    if (FIELD_TAGS.has(tag)) {
      const label = el.getAttribute('label') || '';
      const val = el.getAttribute('value') || '';
      const readonly = el.hasAttribute('readonly');
      if (label) formFields.push({ label, value: val, readonly });
    }
  }
  return { url: location.href, headings: [...new Set(headings)], formFields };
});

console.log(JSON.stringify(dump, null, 2));
await page.screenshot({ path: '.auth/tz-payment-open.png', fullPage: true });
await ctx.close();
