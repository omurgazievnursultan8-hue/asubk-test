// Probe payment detail fields - navigate to payment detail via double-click
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

// Get cells and double-click first data row
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
  const buttons = [];
  for (const el of walkAll(document)) {
    const tag = el.tagName.toLowerCase();
    if (/^h[1-3]$/.test(tag) || el.classList?.contains('jmix-main-view-title')) {
      const t = (el.textContent || '').trim();
      if (t && t.length < 120) headings.push(t);
    }
    if (FIELD_TAGS.has(tag)) {
      const label = el.getAttribute('label') || '';
      const val = el.getAttribute('value') || el.value || '';
      const readonly = el.hasAttribute('readonly');
      const required = el.hasAttribute('required');
      if (label) formFields.push({ label, value: val, readonly, required });
    }
    if (tag === 'vaadin-button' || tag === 'button') {
      const t = (el.textContent || '').trim();
      if (t && t.length < 50) buttons.push(t);
    }
  }
  return {
    url: location.href,
    headings: [...new Set(headings)],
    formFields,
    buttons: [...new Set(buttons)].slice(0, 40),
  };
});

console.log(JSON.stringify(dump, null, 2));
await page.screenshot({ path: '.auth/tz-payment-fields.png', fullPage: true });
await ctx.close();
