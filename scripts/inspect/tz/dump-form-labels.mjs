// scripts/inspect/tz/dump-form-labels.mjs
// Extracts labels from Vaadin form fields by looking inside their shadow roots.
// Vaadin renders label text inside a <label> element inside the component's shadow root.
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

await page.goto(BASE + 'gov-decisions/new', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

const result = await page.evaluate(() => {
  const FIELD_TAGS = [
    'vaadin-text-field', 'vaadin-combo-box', 'vaadin-date-picker',
    'vaadin-number-field', 'vaadin-text-area', 'vaadin-select',
    'vaadin-checkbox', 'vaadin-radio-button', 'vaadin-email-field',
    'vaadin-integer-field', 'jmix-entity-picker', 'jmix-value-picker',
    'jmix-entity-combo-box',
  ];

  function getLabelFromShadow(el) {
    // Try attribute first
    const attr = el.getAttribute('label');
    if (attr) return attr;
    // Look inside shadow root for <label> element
    if (el.shadowRoot) {
      const label = el.shadowRoot.querySelector('label');
      if (label) {
        // label may contain a slot — get its text
        const t = label.textContent?.trim();
        if (t) return t;
      }
      // Also try [part="label"]
      const partLabel = el.shadowRoot.querySelector('[part="label"]');
      if (partLabel) {
        return partLabel.textContent?.trim() || '';
      }
    }
    return '';
  }

  function getRequired(el) {
    if (el.hasAttribute('required')) return true;
    // Check shadow root for required indicator
    if (el.shadowRoot) {
      const indicator = el.shadowRoot.querySelector('[part="required-indicator"]');
      if (indicator && getComputedStyle(indicator).display !== 'none') return true;
    }
    return false;
  }

  // Collect all field elements using querySelectorAll on document (pierces shadow DOM in modern Chrome)
  const fields = [];

  // Walk the entire DOM including shadow roots
  function* walkAll(root) {
    const children = root.children || [];
    for (const child of children) {
      yield child;
      if (child.shadowRoot) yield* walkAll(child.shadowRoot);
      yield* walkAll(child);
    }
  }

  const seen = new WeakSet();
  for (const el of walkAll(document)) {
    if (seen.has(el)) continue;
    seen.add(el);
    const tag = el.tagName?.toLowerCase();
    if (!tag || !FIELD_TAGS.includes(tag)) continue;

    const label = getLabelFromShadow(el);
    const req = getRequired(el);
    const ro = el.hasAttribute('readonly');
    const disabled = el.hasAttribute('disabled');
    const value = el.value || el.getAttribute('value') || '';

    fields.push({ tag, label, required: req, readonly: ro, disabled, value });
  }

  return { url: location.href, fields };
});

console.log(JSON.stringify(result, null, 2));
await ctx.close();
