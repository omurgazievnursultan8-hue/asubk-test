// scripts/inspect/tz/dump-create-form.mjs
// Navigates to gov-decisions, clicks «Создать», dumps form fields from the dialog.
// Usage: node scripts/inspect/tz/dump-create-form.mjs
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

// Find and click «Создать» button using shadow DOM piercing
const clicked = await page.evaluate(() => {
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
    if ((tag === 'vaadin-button' || tag === 'button') && el.textContent?.trim() === 'Создать') {
      el.click();
      return true;
    }
  }
  return false;
});
console.error('Clicked Создать:', clicked);
await page.waitForTimeout(3000);

// Take screenshot of create dialog
await page.screenshot({ path: '.auth/tz-gov-decisions-create.png', fullPage: true });

// Dump all field-like elements in the new dialog/page
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
    'vaadin-checkbox', 'vaadin-radio-button', 'vaadin-email-field',
    'vaadin-integer-field', 'jmix-entity-picker', 'jmix-value-picker',
  ]);

  const formFields = [];
  const buttons = [];
  const tabs = [];

  for (const el of walkAll(document)) {
    const tag = el.tagName.toLowerCase();

    if (FIELD_TAGS.has(tag)) {
      const label = el.getAttribute('label') || '';
      const req = el.hasAttribute('required');
      const readonly = el.hasAttribute('readonly') || el.getAttribute('readonly') === 'true';
      if (label) formFields.push({ label, required: req, readonly, tag });
    }

    if (tag === 'vaadin-button' || tag === 'button') {
      const t = (el.textContent || '').trim().replace(/\s+/g, ' ');
      if (t && t.length < 60) buttons.push(t);
    }

    if (tag === 'vaadin-tab' || tag === 'jmix-tab') {
      const t = (el.textContent || '').trim().replace(/\s+/g, ' ');
      if (t && t.length < 80) tabs.push(t);
    }
  }

  const uniq = a => [...new Map(a.map(x => [JSON.stringify(x), x])).values()];
  return { formFields: uniq(formFields), buttons: [...new Set(buttons)], tabs: [...new Set(tabs)], url: location.href };
});

console.log(JSON.stringify(dump, null, 2));
await ctx.close();
